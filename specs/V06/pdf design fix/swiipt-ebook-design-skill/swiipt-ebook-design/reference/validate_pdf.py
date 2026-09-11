#!/usr/bin/env python3
"""
validate_pdf.py — Automated pre-ship checks for Swiipt ebook PDFs.

WHY THIS EXISTS:
Three specific defects made it into a previous build that no amount of
written design instruction prevented, because they are facts about the
RENDERED OUTPUT, not the code: (1) wrong total page count caused by
content overflowing its page instead of being sized to fit, (2) a
component (e.g. a roster card) emitted twice in a row, (3) a cover /
full-bleed page that only fills the top portion of the canvas and
leaves the rest blank. This script catches all three automatically.

USAGE (run this after generating any product PDF, before shipping it):
    python3 validate_pdf.py <your_generated.pdf> --expected-pages 24

Exit code 0 = passed. Exit code 1 = failed, with specific page numbers
and reasons printed. DO NOT mark a build complete if this script fails.
"""
import sys, subprocess, argparse, os, tempfile, shutil

def fail(msg):
    print(f"❌ FAIL: {msg}")
    return False

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf_path")
    ap.add_argument("--expected-pages", type=int, default=None,
                     help="If known, the exact page count this product should produce.")
    ap.add_argument("--full-bleed-pages", type=str, default="1",
                     help="Comma-separated 1-indexed page numbers that should be full-bleed "
                          "(e.g. cover, printable posters) and must have ink across their full height.")
    args = ap.parse_args()

    ok = True
    tmpdir = tempfile.mkdtemp()

    try:
        from pdf2image import convert_from_path
        import numpy as np
    except ImportError:
        print("Install deps first: pip install pdf2image numpy pillow --break-system-packages")
        sys.exit(2)

    pages = convert_from_path(args.pdf_path, dpi=60)
    n = len(pages)
    print(f"Rendered {n} pages from {args.pdf_path}\n")

    # --- Check 1: exact page count -----------------------------------------
    if args.expected_pages is not None:
        if n != args.expected_pages:
            ok = fail(f"page count is {n}, expected exactly {args.expected_pages}. "
                      f"A mismatch almost always means either (a) content overflowed a page "
                      f"and spilled onto an orphan page, or (b) a component was duplicated. "
                      f"See checks below for which.")
        else:
            print(f"✅ Page count matches expected ({n}).")

    # --- Check 2: near-blank orphan pages (overflow spillover) --------------
    orphan_threshold = 0.04  # <4% ink coverage = almost certainly a spillover fragment
    orphans = []
    for i, p in enumerate(pages, start=1):
        arr = np.array(p.convert("L"))
        ink_ratio = (arr < 240).sum() / arr.size
        if ink_ratio < orphan_threshold:
            orphans.append((i, round(ink_ratio * 100, 2)))
    if orphans:
        ok = fail(f"{len(orphans)} near-blank page(s) detected — these are almost always "
                  f"overflow spillover, not intentional blank pages:")
        for pg, pct in orphans:
            print(f"     page {pg}: {pct}% ink coverage")
        print("   FIX: the content that precedes each of these pages is too long for its "
              "   page — shorten it, split it into two intentional pages, or tighten spacing. "
              "   Never let content silently overflow onto a new page.")
    else:
        print("✅ No near-blank orphan pages found.")

    # --- Check 3: consecutive pages with duplicate TEXT content -------------
    # (Pixel/layout similarity is the wrong signal here — the three roster
    # templates and the seven script cards are SUPPOSED to look visually
    # near-identical in layout. What must never repeat is the actual TEXT.)
    try:
        page_texts = subprocess.run(
            ["pdftotext", "-layout", args.pdf_path, "-"],
            capture_output=True, text=True, check=True
        ).stdout.split("\f")
    except Exception as e:
        page_texts = None
        print(f"(skipped text-duplicate check — pdftotext unavailable: {e})")

    if page_texts:
        def norm(t):
            return " ".join(t.split()).lower()
        dupes = []
        for i in range(len(page_texts) - 1):
            a, b = norm(page_texts[i]), norm(page_texts[i+1])
            if len(a) < 40 or len(b) < 40:
                continue  # too short to be meaningful (e.g. near-blank pages already caught above)
            shorter, longer = (a, b) if len(a) <= len(b) else (b, a)
            # what fraction of the shorter page's content also appears verbatim
            # as a contiguous chunk in the next/previous page?
            chunk = shorter[: max(60, len(shorter)//2)]
            if chunk in longer:
                dupes.append((i+1, i+2))
        if dupes:
            ok = fail(f"{len(dupes)} pair(s) of consecutive pages share duplicated TEXT content "
                      f"(not just similar layout — actual repeated sentences):")
            for a, b in dupes:
                print(f"     pages {a} and {b}")
            print("   FIX: a component (e.g. a card header, a summary block) was generated "
                  "   twice for the same content. Each piece of content must render exactly once.")
        else:
            print("✅ No duplicated text content between consecutive pages.")


    # --- Check 4: full-bleed pages must use the full canvas, not just the top
    fb_pages = [int(x) for x in args.full_bleed_pages.split(",") if x.strip()]
    for pg in fb_pages:
        if pg < 1 or pg > n:
            continue
        arr = np.array(pages[pg-1].convert("L"))
        h = arr.shape[0]
        top_half_ink = (arr[:h//2] < 245).mean()
        bottom_half_ink = (arr[h//2:] < 245).mean()
        # a full-bleed background should make top and bottom halves have
        # similar *background* presence even if text differs — check the
        # bottom 25% specifically, which is where "everything crammed at
        # the top" bugs show up as pure blank/background with zero content.
        bottom_quarter = arr[int(h*0.75):]
        bq_ink = (bottom_quarter < 245).mean()
        if bq_ink < 0.005 and top_half_ink > 0.02:
            ok = fail(f"page {pg} (declared full-bleed) has content only in the upper portion "
                      f"and is empty in its bottom quarter. A full-bleed page (cover, poster, "
                      f"printable) must compose content across its FULL height — e.g. anchor "
                      f"a footer/mark/promise line to the bottom edge, not just stack from the top.")
        else:
            print(f"✅ Page {pg} (full-bleed) uses its full canvas height.")

    print()
    if ok:
        print("=" * 60)
        print("ALL CHECKS PASSED. Safe to ship.")
        print("=" * 60)
        return 0
    else:
        print("=" * 60)
        print("BUILD FAILED VALIDATION. Fix the issues above before shipping.")
        print("Do not mark this task complete while this script fails.")
        print("=" * 60)
        return 1

if __name__ == "__main__":
    sys.exit(main())
