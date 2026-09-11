Content Structuring & Arrangement Logic
How raw source markdown becomes a finished, multi-format product
0. Purpose

This document explains the reasoning I used to turn the raw markdown files you supplied (V6-spec.md, V06-deliverables.md, V06-part01…13.md) into the finished ebook's structure, page order, and component choices — and generalizes that reasoning into a repeatable procedure Claude Code should run for any product's source markdown.

1. Input Assumptions

A product's source bundle typically contains:

One spec file (*-spec.md) — product identity: life area, life state, situation, the problem, constraints, the transformation statement.
One deliverables/manifest file (*-deliverables.md) — the list of assets the product must contain (which templates, trackers, scripts, printables exist and how many).
N numbered "part" files — each representing one self-contained teaching unit or tool ("the read," "the decision tree," "the roster templates," "the script cards," etc.), usually already in the product's intended order by filename.

The procedure below assumes this shape but degrades gracefully if files are named differently — classification (Step 2) does not depend on filenames, only on content.

2. Step 1 — Ingest & Classify

Read every file fully before writing anything. Extract three things:

Product identity fields from the spec file → these become the "Product Identity" page (life area / situation / problem / constraints / transformation — rendered as a fact-table, never as prose paragraphs).
The asset manifest from the deliverables file → this becomes your checklist for Step 7 (validation) and directly determines which "printable" pages must exist and how many script cards / tracker days / rescue steps to expect.
One content module per part file.
3. Step 2 — Asset-Type Detection (content → component mapping)

For each part file, detect its dominant structural shape and assign it exactly one primitive from Document 1 §6. Detection heuristics, in priority order:

If the content contains…	Classify as	Render using
A physical wall-chart / fill-in-the-blank schedule described in prose	schedule-grid	§6.4
Branching "if X then Y" logic across a scenario	decision-tree	§6.6
A day-by-day or row-by-row log meant to be filled in over time	tracker	§6.5
A short list of yes/no self-assessment items	checklist	§6.3
Numbered emergency/crisis steps meant to be used in the moment	rescue-card	§6.7
Verbatim quoted dialogue meant to be spoken aloud, tied to a specific trigger situation	script-card	§6.8
A single non-negotiable rule or a warning	callout (pick the correct state from §6.1)	§6.1
Anything else (explanation, argument, narrative)	plain editorial page	prose + pull-quote + numbered-reason pattern

Never render a module in its raw markdown shape (e.g., don't turn a "tracker" module into a bulleted list just because the source file wrote it as bullets) — always re-express through the matched component. This is the single most important rule: the source markdown tells you what the content is, not how it should look.

4. Step 3 — Synthesize Front Matter (always, regardless of source content)

Regardless of what the source files contain, always generate these pages before the first content module, in this order:

Cover — product title + one-line promise, pulled/condensed from the spec's "transformation" field.
Product Identity — the spec fields as a fact-table (Document 1 §6.2/table style).
Contents — one row per module, each tagged with a short verb badge (READ, DECIDE, BUILD, TRACK, PRINT, REFERENCE) derived from the asset-type classification in Step 2.
Roadmap — a numbered vertical timeline restating the module sequence as a journey ("Step 1 — Read — …", "Step 2 — Decide — …"). This is synthesized, never copied from source.
Printable-assets index — one row per module classified as schedule-grid / tracker / rescue-card / script-card, telling the reader which pages to print and why.

None of these five pages exist verbatim in the source files — they are structural scaffolding the system always builds, because every multi-asset product needs orientation before content.

5. Step 4 — Module Sequencing Rule

Order the classified modules into this general shape (skip any bucket with no matching module; never reorder within a bucket unless the source's numbering says otherwise):

1. READ      — why the problem exists / the argument (editorial modules)
2. DECIDE    — self-triage + decision-tree modules (which path fits the reader)
3. RULES     — safety/boundary callouts (non-negotiables before any tool is used)
4. BUILD     — the core fillable templates / schedule-grids
5. TRACK     — trackers and ledgers
6. COMMUNICATE — script-cards
7. EXECUTE   — the physical/printable wall-chart type asset
8. TRACK (extended) — longer-duration trackers (e.g., 14-day)
9. RESCUE    — the rescue-card / crisis protocol
10. RECOVER  — re-entry / restart-without-guilt modules
11. ESCALATE — the safety-gate / clinical-handoff module (always second-to-last, always calm/serious tone)
12. REFERENCE — the auto-generated Authoring Standard appendix (Step 7)
13. CLOSE    — colophon / next-in-journey teaser

This ordering exists because it mirrors how a reader actually needs the material in real time: understand → choose → know the limits → get the tool → use it → talk about friction → track it → recover from failure → know when to stop and get help.

6. Step 5 — Printable Isolation Rule

Any module classified as schedule-grid, tracker, rescue-card, or script-card is placed alone on its own page(s) — never sharing a page with another module, even if there's white space left over. If a module (like 7 script cards) doesn't divide evenly onto pages-of-two, the last page gets a calm empty state rather than being crammed. Apply the printable-page framing from Document 1 §6.9 to every one of these pages, numbered "n of m" against others of the same asset type.

7. Step 6 — Component Selection

Use the table in Step 2 directly — it is the same mapping table as Document 1 §6. Do not re-derive it per product.

8. Step 7 — Auto-Generate the Authoring Standard Appendix

Always generate a final reference page, placed immediately before the colophon, that is a table with columns: Asset type | Visual pattern used | Where it appears in this product | Why this pattern was chosen. Populate it from the actual classifications made in Step 2 for this product (don't reuse another product's appendix verbatim — the "where it appears" column must point at this product's real module numbers). This page exists so any future editor (human or Claude) can audit why a design decision was made without re-deriving it from scratch.

9. Step 8 — Cross-Format Adaptation (same content tree, different shells)

Once the module list + component assignments exist, that single structure drives all delivery formats:

PDF/Flipbook — render each module as a fixed-size sheet per Document 1 §8.
Read — render the identical module list as flowed responsive sections; do not re-classify or re-order.
Interactive App — this is where classification pays off directly: modules classified as checklist become the TODAY tab's stateful checklist; the decision-tree module becomes the CHECK-IN tab's real branching engine; tracker modules become the TRACK tab's persisted log; script-card modules become the COMMUNICATE tab's tap-to-reveal cards with copy/share/read-aloud; the rescue-card module becomes the persistent floating RESCUE action. The mapping from Step 2 is what tells the app-generator which tab a given piece of source content belongs in — this is the direct link between "how the document was structured" and "how the app was structured." Nothing about the content is rewritten between formats; only its container and interactivity change.
10. Step 9 — Validation Before Finalizing

Before treating the product as complete, check:

Every asset named in the deliverables manifest appears exactly once, in its correct component form (no missing script cards, no tracker with the wrong day count).
Every printable module has its own page(s) and the correct "n of m" tag.
The decision-tree has no orphaned branches and every leaf resolves to an outcome (no dead ends).
The Authoring Standard appendix's row count matches the number of distinct asset types actually used — not more, not fewer.
Every content page has the footer wayfinding strap; every printable page has the dashed frame + tag.
11. The One-Sentence Version

Classify each source file by what kind of tool it is, not by how it happens to be formatted; always build the same five orientation pages first; sequence modules by real-world usage order, not source order; isolate anything meant to leave the document onto its own page; and let that same classification drive every downstream format — print, web, flipbook, and app — without ever re-deriving structure from scratch per format.