# V06 Ebook — Updated Visual Analysis & Corrective Plan
## (After reading the complete swiipt-ebook-design skill)

**Files analyzed:** `README.md`, `SKILL.md`, `reference/build.py` (916 lines), `reference/helpers.py`, `reference/style.css` (512 lines), `reference/validate_pdf.py`, and all 24 page-images of the golden reference.
**Location of this report:** `C:\Users\User\Desktop\Transformation\Product Pipeline\specs\V06\pdf design fix\swiipt-ebook-design-skill\swiipt-ebook-design\golden-output\DIAGNOSIS_V06_EBOOK_CURRENT_VS_ORIGINAL.md`

---

## 1. The shift in understanding — what the skill makes clear

My previous diagnosis was **directionally correct but strategically wrong**. I listed 7 specific fixes for the visible symptoms (page count, schedule bar, script cards, etc.), which is correct in identifying *what* is wrong. But the SKILL.md is explicit that this approach is exactly what fails:

> "Two prior attempts to build this from written design specifications alone (however detailed) produced structurally broken output: a cover that only fills the top third of the page, roster-template cards emitted twice each, and 13 near-blank orphan pages caused by content silently overflowing its page instead of being sized to fit — inflating a 24-page book to 37 pages."
>
> "Written specs cannot prevent those three failures, because they are facts about *rendered output*, not things a description can enforce. This skill fixes that by giving you (1) real code to copy and adapt instead of reinterpret, and (2) an automated script that checks your generated PDF for exactly those three failure modes before you ship it."

The current V06-EBOOK-1787870590.pdf has **exactly those three failure modes** the skill was built to prevent:
- **37 pages instead of 24** = content overflow → near-blank orphan pages
- Some modules show the cover-style "everything crammed at the top" pattern (mPDF rendering of the .page CSS collision)
- The schedule bar and script cards are *visually close* but built from a reinterpreted CSS spec rather than the original `build.py` patterns

The original `build.py` is 916 lines of working, tested code that produces the 24-page golden PDF. My correct course is to **copy that build.py verbatim as the renderer**, substitute the product content as data, and not re-implement the design system from CSS prose.

---

## 2. Why my previous "7 fixes" was the wrong approach

The 7 items I listed (page-composition cap, Lucide restore, script pill width, schedule bar height, decision tree layout, closing page, A/B/C circle weight) are all **surface-level patches to a broken mPDF implementation**. They are correct in identifying the symptoms, but they don't address the root cause: **the current `ebook.php` + `ebook-components.php` were re-implemented from a written spec, not built from the reference code**. The skill explicitly warns against exactly this.

If I patch 7 things in the current implementation:
- mPDF's flex/table/grid support will continue to produce subtle visual differences from the original at every page boundary.
- The next product (V07, V08...) will hit the same problems all over again because the renderer is tied to V06-specific component hacks rather than a reusable engine.
- The validator (`validate_pdf.py`) will still flag the page-count and orphan issues.

The correct path is: **swap the entire PDF renderer to the reference's Python/WeasyPrint-equivalent architecture** (or a faithful PHP port of it), then validate the output with `validate_pdf.py`.

---

## 3. What the reference architecture actually looks like

Reading `build.py` and `style.css` together, the reference has these structural elements that the current PHP/mPDF build lacks:

| Reference architecture | Current PHP build | Gap |
|---|---|---|
| Single Python script `build.py` that runs top-to-bottom, building a `pages = []` list and concatenating | PHP functions per page called from `swt_ebook_render` — same pattern in principle, but | ✓ structurally aligned |
| Each page wrapped in `<div class="page">` with `width:210mm; height:296mm; overflow:hidden; page-break-after:always` | Same | ✓ |
| Page shell with `.page-pad` (20mm padding) and `.page-pad-sm` (14mm) | Same | ✓ |
| Component class families in `style.css` used by *inline templates* in `build.py` (`.roster-card`, `.script-card`, `.rescue-card-obj`, `.callout`, `.tree`, `.route-table`, `.fchart`, etc.) — every class is **defined in the CSS once, used by an inline template once per instance** | `swt_ds_*` builders emit the same classes, but the mPDF rendering of the same HTML diverges | The render engine is the problem, not the HTML |
| Each component built **once, with its real content, the first time** — `if you ever find yourself writing a "template" version of a component followed later by a "real content" version of the same component, stop` | The current PHP build has the "once, with real content" principle | ✓ |
| `body{ font-family:'Inter'; font-size:16px; line-height:1.55 }` + `style.css` token system | Same design tokens | ✓ |
| Cover: `display:flex; flex-direction:column; justify-content:space-between` with `.top-row`, `.center`, `.bottom-row` anchors — content distributed **top + middle + bottom** so the navy fills the full page | `display:block; height:297mm; overflow:hidden; background:navy;` + content in fixed positions — the navy fills the page but the *layout philosophy is different* (block-stacking vs space-between-flex) | **The cover works now, but the rest of the printable pages don't compose the same way** — they use the original `display:flex` for the printable frame and child stacking, and mPDF's flex support is incomplete |
| `footer-strap{ position:absolute; bottom:10mm; left:18mm; right:18mm; display:flex; justify-content:space-between; align-items:center; border-top:0.75pt solid var(--border); padding-top:5mm; }` — every page has this exact footer | Same | ✓ |
| Roster `sched-bar` is `display:flex; height:30pt` with three children `flex:0 0 <pct>%` — single horizontal bar | `display:table; table-layout:fixed; height:30pt` with three `td width="42%/16%/42%"` — works in mPDF but renders as a thin row | **The visual height (30pt) is being honored as a minimum, not a fixed height** — this is a known mPDF/CSS limitation. The reference uses a real flex layout that prints correctly because the reference's print engine (WeasyPrint or similar) respects it. The fix is either (a) accept that mPDF needs explicit `height` on the table itself, not just the cells, or (b) switch renderers |
| Script card `script-card-page{ display:flex; flex-direction:column; height:100% }` with `script-card{ flex:1 }` and `script-quote{ flex:1 }` — **two cards per A4 page, each card fills exactly half the page** | The current build stacks all script cards into one big `<div class="script-card-page">` and relies on `overflow:hidden` of the outer `.page` to clip — the cards don't `flex:1` and the page is overstuffed | The reference's per-page flex distribution is the key |
| Each script card has `<div class="sc-icon">` (top-right Lucide icon) and `<div class="sc-tag">` (top-left purple pill) as **inline** elements, not full-width | The current build's `eb-ascii { display:none }` accidentally hides all SVGs, and the script-tag pill is rendered as a full-width block in mPDF | The reference layout works; the current PHP mPDF rendering does not |
| Tracker page is **landscape** (`.page.landscape{ width:297mm; height:210mm; page:landscape }`) — explicit landscape page with full table | The current build puts the 14-day tracker in a tall `.page.printable-page` on portrait | **The reference explicitly uses landscape for the tracker — a critical page-composition choice my report missed** |
| Decision tree is a true branching layout with `flex:1` branches in a `branch-row{ display:flex }` | The current build uses `<table>` with `display:table-cell` — mPDF renders it stacked vertically instead of side-by-side | The reference uses flex which its renderer (not mPDF) supports; the current build needs a different layout strategy in mPDF |
| Closing page is `<div class="page navy-bg"><div class="page-pad" style="display:flex; flex-direction:column; height:100%; color:#fff;">` with `margin-top:auto` content blocks for the V09/V11/V19 teasers — flex column with auto-spacer pushes the teasers to the bottom | The current build uses auto-spaced flow but the navy background may not reach the bottom because of the same .page height collapse issue | Working once the page model is right |
| Rescues as a `<div class="rescue-stage"><div class="rescue-card-obj">` — an indexed object centered on the page with 150mm width, not a full-width form | The current build's rescue is full-width and overflows | **Width constraint is the key** |
| Fridge chart uses a nested layout: `.fchart{ height:100%; display:flex; flex-direction:column; }` with `.fchart-head` (flex: none), `.fchart-meta` (flex: none), `.fblock` (flex: none), `.transition-strip` (flex: none) — content stacks but the navy header sits at the top with auto height | The current build does similar but the `.fblock` doesn't have explicit `flex: none` so the children's intrinsic heights may be taking over | Minor; same root cause as everything else |
| The reference has `<div class="rescue-below-label">` with **scissors icons** as the "cut out and keep near the crib" line | The current build's `eb-ascii { display:none }` hides these icons | Fix: scope the rule to `pre.eb-ascii` only |
| `.reason-grid` uses `display:flex; flex-direction:column; gap:9pt` — vertical stack of reason cards | The current build uses table; flex-column should also work in mPDF | OK if scoped correctly |
| Crisis directory uses `.crisis-grid{ display:flex; gap:10pt }` and `.crisis-card{ flex:1 }` — three cards side-by-side | The current build uses `display:table`; the layout is close but the card borders differ | The CSS is the same; the issue is mPDF |
| The `<div class="page">` has `overflow:hidden` — content that doesn't fit is **clipped, not allowed to overflow** | Same | ✓ — this is what prevents the 13-orphan-page bug |
| `@page { size: A4; margin: 0 }` — zero printer margins, the `.page-pad` provides the visual margin | The current build uses `margin_left/right/top/bottom: 0` in mPDF config | ✓ equivalent |

---

## 4. The three validation failures the current build will hit (per `validate_pdf.py`)

If I ran the current 37-page PDF through `validate_pdf.py` (with the appropriate Python deps installed — it was timing out earlier, that's a separate problem), it would fail **all three checks** the script enforces:

1. **Check 1 (exact page count)**: `n=37 ≠ expected 24` → **FAIL: page count is 37, expected 24**. The script's own error message will say: *"A mismatch almost always means either (a) content overflowed a page and spilled onto an orphan page, or (b) a component was duplicated."*
2. **Check 2 (near-blank orphan pages, <4% ink)**: Will flag several pages — particularly the trailing page after the tracker, the rescue, the fridge, and the modules where the body content doesn't fill the printable frame, plus the final closing page.
3. **Check 3 (duplicated text between consecutive pages)**: Risk of this if any module's body accidentally renders twice.
4. **Check 4 (full-bleed pages use the full canvas)**: The cover and closing page should pass, but if the page-margins or background positioning is off by even 1mm, the validator will flag it.

The reference golden PDF **passes all four** by construction. The current build cannot, regardless of how many of my "7 small fixes" I apply.

---

## 5. The correct corrective plan (replacing my previous one)

**Stop patching the mPDF implementation. Copy the reference architecture.**

Concretely, the next fix pass is:

| # | Step | What it produces |
|---|---|---|
| 1 | **Add a Python build pipeline to the platform** that takes a product's source bundle + product config and runs the equivalent of `build.py` to produce the combined-ebook PDF server-side. Use the **exact reference `build.py` as the template** (copy it; only change the product content data). The reference's PDF output matches the golden exactly. | A `build_<product>_ebook.py` script per product that produces a 24-page PDF. |
| 2 | **Add `style.css` + `helpers.py` + `icons/` + `fonts/` as platform assets** — these are the working design system, copied verbatim from `reference/`. The platform's current `swt-asset-design.css` (F0) is *compatible* in design tokens but is missing many classes (`.script-card`, `.rescue-card-obj`, `.roster-dots`, `.transition-strip`, `.next-teaser`, etc.) and uses different conventions (CSS Grid, literal colors, etc.). | A new `assets/ebook-style.css` that is byte-identical to `reference/style.css` (or near-identical, with font paths adjusted). |
| 3 | **Add `validate_pdf.py` to the platform's CI/validation flow** — every generated ebook PDF must pass it before shipping. The script can run on the server (Python + pdf2image + numpy are needed; `pip install --break-system-packages` may be required; if pip times out again, a small PHP port of the three checks is acceptable). | A `swt_ebook_validate()` function equivalent to the Python script, callable server-side. |
| 4 | **For the immediate V06 ship:** run the reference `build.py` with the existing V06 product data → produces the golden `Every-Night-Just-Me-V06.pdf` (which already exists in `golden-output/`) → ship that as the canonical V06 ebook. Do **not** ship the current mPDF build. | A verified 24-page PDF that matches the original. |
| 5 | **For the immediate ship (faster path):** if the Python pipeline is too heavy to add right now, do a **faithful PHP port of the reference `build.py` and `style.css`** — not a "patches to the current build" but a rewrite. Use the same inline-template pattern, the same component CSS (copied), the same flex/space-between cover, the same flex:1 script cards, the same landscape tracker. | A new `includes/ebook.py` or `ebook.php` (rewritten from scratch) that mirrors the reference's structure. |
| 6 | **Per the skill:** for any new product, the content is data passed to the same renderer, not a re-implementation. The current build's pattern of "extract content from markdown, then call a builder" is *close* in principle, but the builders themselves are not the reference's builders. | A reusable engine for V07, V08, etc. |

---

## 6. What I should do now (if you approve)

I will not touch the current `ebook.php` / `ebook-components.php` further. Instead, I propose:

1. **Read both files in full one more time** (I have done this).
2. **Copy `reference/style.css` and `reference/build.py` into the platform's `swiipt-core` tree** as the new starting point for the combined-ebook renderer.
3. **Port the reference's `build.py` structure to a new `includes/ebook-render.php`** — a thin PHP layer that produces the same HTML `build.py` would have produced, calling the same per-component templates with the same content. Use `swt_ds_*` builders (F0) only where they are *structurally identical* to the reference's inline classes; otherwise emit the reference's exact HTML markup.
4. **Add `validate_pdf.py` (or a PHP equivalent)** to the platform's validation.
5. **Regenerate the V06 ebook** from the new renderer and verify every page against `golden-output/page-images/`.

If you want me to do a *faster* intermediate ship (without rewriting the renderer), the absolute minimum is:
- **Add an explicit `height="34"` on the `.sched-bar` table** in the current `ebook-components.php` (fixes the thin schedule bar).
- **Fix the script-card purple pill** to be `display:inline-block; width:auto` instead of full-width block.
- **Remove the `eb-ascii { display:none }` over-broad rule** and replace with `pre.eb-ascii { display:none }` only.
- **Add a "what next" copy section** in the closing page with hard-coded V09/V11/V19 teasers.

These four targeted edits are *symptomatic* and won't restore all 24 pages or fix the decision-tree layout, but they will make the current 37-page build noticeably closer to the original and unblock the ship — at the cost of the page count still being wrong. After the ship, the proper rewrite (items 1-5 above) is the real fix.

---

## 7. Final answer to "what's wrong with the current build and why doesn't it look like the original"

**Direct cause:** The current `ebook.php` + `ebook-components.php` were authored from `visual.md` + `style.css` + `content structuring.md` (prose descriptions and a ported stylesheet), not from the working `reference/build.py`. They produce the *right components* (per the F2 corrective pass) but the *wrong page composition* (37 pages, vertical tree stacks, thin schedule bar, full-width script pills, missing icons, etc.) because mPDF's flex/CSS-Grid support diverges from the reference's renderer's, and the reference's per-component inline templates are designed around the reference's renderer — not around a generic CSS spec.

**Why this is structural, not fixable with patches:** The reference's 24-page layout comes from the interplay of component templates (each tuned to fit exactly half an A4 in a flex:1 container, exactly one A4 in a full container, etc.) and a render engine that respects those constraints. mPDF does not. The only way to get the 24 pages back is to either (a) switch the render engine to one that respects the reference's CSS flex model (WeasyPrint or similar — `pim-weasyprint` is the closest PHP equivalent but heavy), or (b) port `build.py`'s structure to PHP using explicit page breaks + height-capped containers, validated by `validate_pdf.py`.

**What I will not do without your approval:** rewrite the renderer. It's a substantial refactor that touches every page, and getting the page composition right is the difference between a 24-page and 37-page document. My "7 small fixes" from the previous report would have produced something closer-but-still-not-right. The reference's `build.py` is the source of truth and should be the basis of the new renderer, not the current mPDF hacks.

**What I will do if you approve (either path):**
- **Path A (fast, intermediate):** the four targeted edits above + a tightened page-composition cap. Ships a noticeably closer-to-original 30-something-page build. The page count will still be wrong, but most of the visible breakage will be fixed. *Recommended only if you need a quick visual improvement to ship this week.*
- **Path B (correct, recommended):** port `build.py` to `includes/ebook-render.php` with `style.css` and `helpers.py` ported faithfully; re-emit each page as inline HTML; add `validate_pdf.py` (or a PHP equivalent); regenerate. The 24-page golden layout returns. *Recommended for the long-term quality bar the skill is designed to maintain.*

The original 24-page golden PDF is the ground truth. The skill is designed to be copy-and-adapt, not reinterpret. The current build needs the reference's renderer structure, not more patches on top of a fundamentally different approach.

Tell me which path to take. I will not ship either without your explicit go.
