Diagnosis: What Went Wrong

The short version: Claude Code didn't design anything. It reformatted your source markdown with nicer fonts and colors, but left the shape of the content almost exactly as it was in the raw .md files — including literally copy-pasting ASCII box-drawing diagrams into the PDF. Document 1 told it what the components should look like; nothing forced it to actually replace the source content with those components instead of just prettifying the text around it. Here are the specific failures, in order of severity.

1. ASCII art was copy-pasted straight into the PDF (the biggest failure)

This is the root of almost everything that looks "horrible." Your source markdown files contained hand-drawn ASCII diagrams (box-drawing characters like +---+, |, ====) for the decision tree, the fridge chart, the tracker, and the rescue card. Claude Code took those blocks and dropped them into bordered/dashed boxes verbatim, as monospace text:

[ START HERE ]
        |
+-------+-------+
|               |
[Partner...]  [No Partner...]

This is exactly the thing Document 1 §6.6 explicitly forbids ("Never render a decision tree as an ASCII diagram... it must be real boxes and lines") and exactly what Document 2's core rule was built to prevent ("the source markdown tells you what the content is, not how it should look"). It happened to every single component-type asset: the decision tree, the schedule-grid bars (Roster A/B/C, Fridge Chart), the tracker table, and the Recovery Bank ledger. None of them became real HTML components — they all stayed as preformatted ASCII text in a pretty frame.

Why this happened: Document 1 describes what a schedule-grid or decision-tree should look like in prose. It never says "if the source file already contains an ASCII diagram of this exact thing, throw it away and rebuild it as markup." Claude Code took the path of least resistance — preserve the source, decorate around it.

2. Every single page header is visually broken — a real CSS bug

Look at literally any page: IPRODUCT IDENTITY, IIC O N T E N T S, 0 4M O D U L E 0 4 · D E C I D E, X I I IA P P E N D I X. The numeral chip and the label text are glued together with zero gap. This isn't a content issue — it's a missing gap/margin between the eyebrow number chip and its label, and it's on every page in the document. This is the single most visible defect and it alone would make the document look unfinished.

3. The cover doesn't fill the page

The navy cover background stops partway down the page and leaves plain white beneath it before the page ends. I recognize this bug immediately — it's the exact height: 100% same-element conflict I hit and fixed in my own build (when .page and .cover are the same div and both try to set height, the second declaration wins and collapses against an unconstrained parent). Document 1 describes the cover's appearance, not this CSS trap. Claude Code rebuilt the CSS from scratch and fell into a bug I'd already solved.

4. Structural components were abandoned in favor of "prose with bold subheads"
Roster A/B/C (meant to be a navy-header card with a gold letter badge, a proportional schedule bar, two-column duty lists, a callout, and a signature block) became plain paragraphs with bold labels like "1. THE GOAL."
Safety & Boundary Rules (meant to be three distinct color-coded callout boxes — red/amber/blue) became plain paragraphs with bold subheadings.
The Read / dialogue and pull-quote (meant to be a shaded dialogue box + a large serif pull-quote) shows no evidence of either treatment.
Script cards lost their card border, numbered badge, and purple category pill — they read as a heading plus an italic paragraph in a tan box, not an object.
5. Content got duplicated because of a front-matter/source-file mixup

Document 2 says the Roadmap is one of five always-synthesized front-matter pages that comes before Module 1. Your source bundle happens to also have a file called part01-roadmap.md. Claude Code did both: it built the synthesized Roadmap page correctly (Roman numeral "III"), and it separately turned the source file into "Module 01," reprinting the same 10-step journey content almost word-for-word a second time. Document 2 never told it what to do when a source file's content overlaps with a front-matter page it's already required to generate.

6. The cover's own copy is duplicated and mismatched

The one-line promise text ("A written, fair night-shift system...") appears twice on the cover — once as the subtitle under the title, and again inside a quote box lower down — while the actual subtitle field ("A postpartum night-coordination system that replaces...") got pushed up into the eyebrow line, where it's too long for that slot. Nobody told the model that eyebrow ≠ subtitle ≠ promise, or that it must never place the same sentence in two visual slots on one page.