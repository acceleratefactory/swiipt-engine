# Swiipt Ebook Design System — Reference Implementation Skill

## What this is

This is not a description of the Swiipt design system — it is the **actual, tested, working code** that produces a correct 24-page Swiipt ebook. It exists because two prior attempts to build this from written design specifications alone (however detailed) produced structurally broken output: a cover that only fills the top third of the page, roster-template cards emitted twice each, and 13 near-blank orphan pages caused by content silently overflowing its page instead of being sized to fit — inflating a 24-page book to 37 pages.

Written specs cannot prevent those three failures, because they are facts about *rendered output*, not things a description can enforce. This skill fixes that by giving you (1) real code to copy and adapt instead of reinterpret, and (2) an automated script that checks your generated PDF for exactly those three failure modes before you ship it.

## When to use this skill

Use this whenever the platform needs to generate a Swiipt-branded PDF/ebook asset — for any product, not just "Every Night, Just Me." The example product in `reference/build.py` is the reference instance; the system underneath it (`style.css`, the component patterns, the page-fitting discipline) is what you are actually adopting.

## Directory contents

```
reference/
  build.py           — the actual Python generator for the reference product.
                        Read this top to bottom before writing any new generator.
  style.css           — the complete, working CSS. Copy this verbatim as your
                         starting point. Do not rewrite it from memory or from
                         Document 1's prose description — that description was
                         written FROM this file, so this file is more precise
                         than any summary of it.
  helpers.py          — icon-inlining and small utility functions used by build.py.
  fonts/              — the exact font files (Inter x4 weights, DM Serif Display).
  icons/              — the exact Lucide icon SVGs used, pre-fetched.
  validate_pdf.py     — run this against every PDF you generate, for every
                         product, before considering the task done. See below.

golden-output/
  Every-Night-Just-Me-V06.pdf   — the correct, approved 24-page output.
  page-images/page-01.png ... page-24.png
                        — every page of the golden PDF pre-rendered as an image,
                          so you can open them directly and compare against your
                          own output page-by-page without needing to render
                          anything yourself first.
```

## How to work with this skill

### Step 1 — Read, don't reinterpret
Open `reference/build.py` and `reference/style.css` and read them fully before writing a single line of new code for a new product. Notice:
- Every component (`callout`, `roster-card`, `sched-bar`, `tracker-table`, `script-card`, `rescue-card-obj`, `tree`/decision-tree nodes, etc.) is a **CSS class family plus a Python string-building function** that emits it once, with content as parameters. There is exactly one function that builds a roster card, and it is called exactly once per roster. If you ever find yourself writing a "template" version of a component followed later by a "real content" version of the same component, stop — that is the exact duplication bug this skill exists to prevent. A component has one job: render once, fully, with its real content, the first time.
- The cover (`add(f'''<div class="page cover">...''')` in `build.py`) uses a flex column with content split between a `.top-row`, a `.center` block, and a `.bottom-row`, with the outer container using `justify-content: space-between`. This is what makes the cover use its *entire* page height instead of stacking everything at the top and leaving the bottom blank. When you build a new full-bleed page (a cover, a poster, a printable), always anchor content to top, middle, AND bottom the same way — never let a full-bleed page's layout be a simple top-down stack.

### Step 2 — Port the system, swap the content
For a new product:
1. Copy `style.css`, `helpers.py`, and the `fonts/`/`icons/` directories unchanged.
2. Write a new `build_<product>.py` modeled on `build.py`'s structure: same page shell classes (`page`, `page-pad`, `printable-page`, etc.), same component-calling functions, but with the new product's own content substituted in as data (roster names, script text, callout copy, etc.) — the same way `build.py`'s `scripts = [...]` list holds this product's 7 scripts as data, not as hand-written HTML per card.
3. Do not invent new CSS class names for a need that an existing class already covers. If a genuinely new component type is needed (something none of the existing patterns fit), add it to `style.css` following the naming and sizing conventions already present, and document it the same way the existing classes are commented.

### Step 3 — Enforce page budgets while writing content, not after
The single biggest cause of the 37-page failure was content that was too long for its page, discovered only after rendering. Do not write a module's copy first and then "see if it fits" — while drafting each page's content, keep it within the same rough word/line budgets the golden reference uses for an equivalent page type (a callout is 2-4 sentences; a module's body is what fits in ~250mm of vertical space at the type sizes `style.css` defines; a script card's quote is one paragraph, not two). If you're unsure whether something fits, render that one page in isolation and look at it before moving on — don't wait until the full 24+ page document is assembled to find out.

### Step 4 — Validate before shipping, every time
After generating any product's PDF, run:
```
pip install pdf2image numpy pillow --break-system-packages
python3 reference/validate_pdf.py /path/to/your-generated.pdf --expected-pages <N> --full-bleed-pages <comma-separated page numbers>
```
This checks, automatically, against the rendered PDF itself:
- **Exact page count** matches what the product's module count should produce (you must know and state the expected count going in — if you don't know what it should be, that's a sign you haven't finished planning the document structure).
- **No near-blank orphan pages** (< 4% ink coverage) — catches overflow spillover.
- **No duplicated text content** between consecutive pages — catches component-emitted-twice bugs.
- **Full-bleed pages use their entire canvas height**, not just the top portion — catches the "everything crammed at the top, blank at the bottom" cover bug.

**Do not report a build as complete if this script exits with a failure.** Fix the flagged pages and re-run it. Treat a passing run of this script as a minimum bar, not a guarantee of quality — also visually open a handful of pages yourself (the golden `page-images/` folder shows you what "correct" looks like for direct comparison) before calling the work done.

### Step 5 — When something looks visually wrong that the script doesn't catch
The validator catches the three specific failure modes observed so far. It will not catch everything (e.g., a wrong color, a misaligned icon, awkward text wrapping). For anything else: render the page in question to a PNG (`pdftoppm -png -r 100 -f <n> -l <n> file.pdf out`) and actually look at the image before deciding it's correct. Do not judge a page's correctness from the HTML/CSS source code alone — the same way the two prior broken attempts read as reasonable-looking code but produced a broken cover and duplicated cards, source code can look plausible while the render is wrong. The render is the only ground truth.

## The one-paragraph version

Copy `style.css` and the component-building pattern in `build.py` verbatim rather than reimplementing them from a written description; write new product content as data fed into that same pattern, never as one-off hand-built HTML; keep every component to exactly one render call; make full-bleed pages compose top-to-bottom across the whole canvas, not stack from the top; budget content to fit its page while writing it, not after; and run `validate_pdf.py` against your actual rendered output before calling any build finished.
