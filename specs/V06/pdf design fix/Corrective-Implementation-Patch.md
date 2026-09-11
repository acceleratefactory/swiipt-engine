Corrective Implementation Patch
Read this after Document 1 and Document 2. It fixes specific, observed failures from the first build attempt. Follow it exactly — do not reinterpret.
Patch 1 — Never preserve source-file ASCII diagrams. Ever.

If a markdown source file contains a diagram made of characters like +, -, |, =, ↓, treat that diagram as content data to extract, not markup to reuse. Parse out the actual information (the nodes, the labels, the branches, the time values, the table columns) and discard the box-drawing characters entirely. Then rebuild using the real markup below. If you ever find yourself wrapping a <pre> or monospace block around content lifted from the source file, stop — that is the exact failure mode this patch exists to prevent.

Decision tree — required markup shape (not prose, not ASCII):

html
<div class="tree-root"><div class="tbox start">START HERE</div></div>
<div class="vline"></div>
<div class="branch-row">
  <div class="branch">
    <div class="tbox q">Partner Available at Night</div>
    <div class="vline"></div>
    <div class="branch-row">
      <div class="branch"><div class="tbox">Breastfeeding (direct latch)</div><div class="vline"></div><div class="tbox leaf">Roster A</div></div>
      <div class="branch"><div class="tbox">Bottle / Formula / Expressed</div><div class="vline"></div><div class="tbox leaf">Roster B</div></div>
    </div>
  </div>
  <div class="branch"><div class="tbox q">No Partner / Solo</div><div class="vline"></div><div class="tbox leaf">Roster C</div></div>
</div>

Real boxes, real CSS-drawn connector lines (border or a 1–2px div), never characters.

Schedule-grid — required markup shape:

html
<div class="sched-bar">
  <div class="sched-seg a" style="flex:1;">Partner · 9PM–2AM</div>
  <div class="sched-seg t">HANDOFF</div>
  <div class="sched-seg b" style="flex:1;">Mother · 2AM–7AM</div>
</div>

A flexbox bar with proportional widths. Never a fill-in-the-blank line of underscores, never an ASCII box.

Tracker / ledger — required markup shape: a real <table> with a dark header row, alternating row shading, and one <tr> per day/entry. Never a +---+---+ grid.

Rescue card — required markup shape: a bordered, shadowed <div> with a colored header band and rounded corners, positioned as an object on the page — never a box drawn with +===+ characters, even inside a nice frame.

Patch 2 — Fix the eyebrow-chip spacing (present on every page in the last build)

The numeral/roman-numeral chip and its label text must never touch. Use explicit spacing, not reliance on inline whitespace collapsing:

css
.eyebrow { display:flex; align-items:center; gap:6pt; }
.eyebrow .num { /* the colored numeral box */ padding:2pt 6pt; border-radius:5pt; }

The gap:6pt is mandatory. Before shipping, visually inspect every single eyebrow line in the rendered output — if the numeral and the text are touching or overlapping, the build fails review. This must be checked on every page, not spot-checked on one.

Patch 3 — Fix the cover full-bleed bug

This is a known CSS trap: if the same HTML element carries both a fixed-page-size class and a background/color class (e.g. class="page cover"), and both classes declare a height property, the one that's declared later in the stylesheet wins — and if that class's height is a percentage, it resolves against an unconstrained parent and collapses to the content's natural height, not the full page.

Fix: the page-sizing class (.page) owns height. Any combined class like .cover must never also declare height — only background, color, padding. Before shipping, render the cover and confirm the navy background reaches every edge of the page with no white gap below it.

Patch 4 — Rebuild the abandoned card components

These modules must use their dedicated component, not paragraphs with bold labels:

Roster A/B/C → the roster-card pattern: navy header bar + circular letter badge, schedule-grid bar, two-column duty list with colored swatches, a callout for boundary rules, a signature block with real underline fields (border-bottom divs, not underscores).
Roster Safety & Boundary Rules → three separate callout divs, colored per Document 1 §6.1 (Rule 1 = safety/red, Rule 2 = warning/amber, Rule 3 = info/blue). Never plain paragraphs with bold subheadings for a rules module.
The Read (dialogue + pull-quote) → the spoken exchange goes in a shaded dialogue box with bold speaker names; "Unstructured nightly negotiation fails 100% of the time" goes in a pullquote block (serif, gold left border, tinted background) — never inline paragraph text.
Script cards → bordered card, numbered circular badge overlapping the top-left corner, purple pill tag, serif-italic quote in a tinted block. Never a plain heading + italic paragraph.
Patch 5 — Front matter vs. source files: resolve overlaps by merging, never duplicating

Before generating the five always-synthesized front-matter pages (Document 2 §4), check every source file's content against them. If a source file's content is substantially the same thing as a front-matter page you are about to generate (e.g., a file literally titled "roadmap"), that source file becomes the input for the synthesized page — it does not also become its own numbered module. Every distinct idea in the source bundle appears exactly once in the final document. Before finalizing, scan the full page list for near-duplicate content between any two pages; if found, delete one and keep only the version in its correct structural position (front matter takes priority over being renumbered as Module 1).

Patch 6 — Cover copy: three distinct fields, three distinct slots, never duplicated

The cover uses three different pieces of text — if you only have two, write a third rather than reusing one twice:

Slot	Source field	Rule
Eyebrow (small gold uppercase line)	Write a new, short (≤8 word) category phrase	Never the full subtitle sentence — it will overflow and looks wrong at that size
Cover subtitle (paragraph under the title)	The spec's SUBTITLE field	
Bottom promise (small text in the accent-bordered box)	The spec's ONE-LINE PROMISE field	Must be different text from the subtitle — if they're the same sentence in your source, rewrite one of them

Before finalizing the cover, confirm no sentence appears twice on the page.

Patch 7 — Final pre-ship checklist (run this against the actual rendered PDF, not the code)
 Zero <pre>/monospace ASCII diagrams anywhere in the document
 Every eyebrow label has visible spacing between its numeral and its text
 The cover's background fills the entire page edge-to-edge
 Every roster template renders as a card with a schedule bar, not paragraphs
 Every safety-rule module renders as colored callouts, not bold subheadings
 No two pages contain substantially the same paragraph or list
 No sentence is repeated twice on the same page
 Every script card has a border, a numbered badge, and a purple tag
 The decision tree is boxes-and-lines, not characters

Do not mark the build complete until every item above is visually confirmed against the rendered output — not the source code.