# Swiipt Ebook Design — Reference Package for Claude Code

Start here: **`swiipt-ebook-design/SKILL.md`**

This package exists because two prior attempts to build the Swiipt ebook design
system from written specifications alone produced structurally broken output
(a cover using only the top third of the page, duplicated roster-card
components, and 13 orphaned near-blank pages from content overflow — 37 pages
instead of the correct 24). Those are rendering-behavior bugs that a written
spec cannot reliably prevent, no matter how precisely worded.

This package instead gives Claude Code:
1. The actual working source code (`reference/build.py`, `reference/style.css`,
   `reference/helpers.py`) that correctly produces the target design —
   to be copied and adapted, not reinterpreted from a description.
2. The correct, approved output (`golden-output/Every-Night-Just-Me-V06.pdf`
   and its pages pre-rendered as images) to visually compare against.
3. An automated checker (`reference/validate_pdf.py`) that catches the exact
   three failure modes observed previously, so they can be caught and fixed
   automatically instead of requiring another manual review cycle.

Read `swiipt-ebook-design/SKILL.md` in full before generating anything.
