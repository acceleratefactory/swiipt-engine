Swiipt Visual Design System Specification
Reference for automated product/asset generation — do not guess, implement exactly as specified
0. Purpose

This document is the authoritative design source for anything the Swiipt platform generates automatically — PDFs, flipbooks, web "Read" pages, images, and Interactive Apps. Every generated asset must derive from these tokens and component patterns. If a generator needs a visual decision this document doesn't cover, it should fall back to the nearest matching pattern here, not invent a new one.

1. Design Philosophy

The visual language is "Quiet Intelligence." It should never read as:

a generic SaaS dashboard (no heavy shadows-everywhere, no bright flat "startup" gradients, no dense charts)
a clinical/medical document (no sterile blue-and-white hospital aesthetic)
gamified or juvenile (no badges, XP bars, confetti, mascots, or cartoon iconography)

It should read as: calm, editorial, trustworthy, premium — closer to a well-designed print magazine or a high-end operating manual than an app.

2. Color Tokens
--navy:          #0B1F33   /* primary — headers, dark surfaces, primary text on light */
--purple:        #6F35B5   /* accent — interactive/decision moments, category tags */
--gold:          #D9A52E   /* accent — emphasis, printable tags, dividers, premium accents */
--blush:         #F3C7D2   /* accent — human/emotional moments only */
--warm-surface:  #F8F4EC   /* tinted card backgrounds, quote blocks */
--soft-surface:  #F4F6F8   /* neutral card/table backgrounds */
--white:         #FFFFFF
--ink:           #17212B   /* body text */
--text-secondary:#52606D
--text-muted:    #7B8794 / #8593A1
--border:        #DDE2E7 / #E3E7EB

--success:       #18794E   tint #E7F3EC
--warning:       #A15C00   tint #FBF0DE
--error:         #B42318   tint #FBEAE8
--info:          #1769AA   tint #E9F2FA

Rule: every semantic color has exactly one tint pairing. Never invent a new tint ratio. Never use raw success/warning/error/info colors as large background fills — they are for the small icon chip only; the tint is the background.

3. Typography
Display / headline font: DM Serif Display (regular + italic only, weight 400). Used for: page titles, section headlines, pull-quotes, script-card quotes, large numerals, logo wordmark pairing. Italic is used specifically for the "accent" half of a two-part headline (e.g., "What This System Is — And Isn't") and for quoted/spoken text.
UI / body font: Inter (weights 400, 500, 600, 700). Used for everything else: body copy, labels, buttons, tables, navigation.
Never use a third font family. Never use a display serif for body paragraphs. Never use Inter for a pull-quote or a script-card's spoken line.

Type scale (print/pt-equivalent — same ratios apply in px on screen):

Role	Size	Weight	Font
Cover title	44–56pt	400	DM Serif Display
Page title (h1)	22–29pt	400	DM Serif Display
Card title	12–15pt	700	Inter
Body	9.5–10.5pt	400	Inter
Small/meta	8–9pt	500–600	Inter
Eyebrow/label	8–10px	700, uppercase, letter-spacing .06–.14em	Inter
4. The Transformation Mark (logo)

A geometric mark representing "before → transition → after," built from two rotated rounded squares joined by a short diagonal bridge:

Shape A (before-state): rounded square, rotated 45°, positioned lower-left
Shape B (after-state):  rounded square, rotated 45°, positioned upper-right
Bridge: a short rounded line connecting A's upper-right corner to B's lower-left corner

Color variants:

Reverse (on navy): A = white, B = gold, bridge = gold
Primary (on light): A = navy, B = purple, bridge = gold

Never use any other logo mark. Never stretch, recolor outside these two variants, or add a wordmark lockup other than "SWIIPT" in Inter 700, letter-spacing .1–.16em, uppercase, set immediately beside the mark.

5. Iconography
Icon set: Lucide (stroke-based outline icons only — never filled/solid icon styles, never emoji, never flags).
Icons always render as stroke="currentColor", stroke-width="2", fill="none" so color is controlled by context.
Standard sizes: 10–13px inline with small labels, 14–16px in buttons/rows, 20–28px in icon chips.
Icons sit inside a colored chip (see Callout spec) or are colored to match surrounding text — never a random accent color unrelated to the content's semantic state.
6. Component Library

Every generator must use these exact patterns. Do not invent alternatives.

6.1 Callout (semantic state block)

Structure: rounded container (10–13px radius) → colored icon chip (left) → uppercase label (top) → body text.
One-to-one color mapping — never mix:

State	Use for	Background tint	Icon chip color	Label color
safety	hard safety rules, non-negotiables	error tint	error	error
warning	caution, "override the plan if X"	warning tint	warning	warning
info	neutral guidance, definitions, print notes	info tint	info	info
success / good	resolution, "this is the fix," reassurance	success tint	success	success
human	emotional/relational moments, empathy	blush-family tint (
#FCF1F4 / border 
#EFC9D4)	
#C77B93	
#B45C77
protocol	system/process rules (navy-flavored, not a warning)	warm-surface	navy	navy
6.2 Card

White background, 1px border, 12–16px radius, 14–16px padding. Generic content container — a title (Inter 700) + optional sub-line (muted) + body.

6.3 Checklist

Square checkbox glyph (not a circle, not a numeral) + left-aligned statement, generous line height (1.5), no numbering. Checkbox border color follows context (warning-colored border for a self-assessment gate; success-colored fill when interactively completed).

6.4 Schedule-grid

A horizontal proportional timeline bar, segmented by owner, with a distinct (gold) "handoff/transition" segment sized ~8–10% of the bar, and time labels below. Two owner colors: navy = first block, purple = second block. Never represent a schedule as prose ("partner works 9pm–2am") when a schedule-grid is available — always render the bar.

6.5 Tracker table

Ruled <table>, dark-navy header row (white text, uppercase, 7.5–8px), alternating row shading (white / soft-surface), cells sized generously (≥14pt row height) so it reads as writable, not just a list. Review/checkpoint rows get a distinct band tint (light purple/blush, e.g. 
#EFE3EF) spanning all columns.

6.6 Decision tree

A true node-and-connector diagram: boxed nodes (question nodes = light/outlined; start node = solid navy; terminal/leaf nodes = solid purple or solid error for a flagged outcome) joined by ruled vertical/horizontal connector lines in --border color. Never render a decision tree as an ASCII diagram, a nested bullet list, or a flowchart image — it must be real boxes and lines.

6.7 Rescue card (physical-object treatment)

Distinct from a normal card: 2px navy border, 16–18px radius, drop shadow (0 10px 26px rgba(11,31,51,.16)), a solid-color header band (error-red for a "bad situation" protocol) bleeding to the card's edges, centered on its own page/screen at roughly index-card proportions. This must look like an object you could hold, not a paragraph in a document.

6.8 Script card

Bordered card (1.4px navy border, 16px radius) with: a numbered circular badge overlapping the top-left corner, a pill-shaped category tag (purple, uppercase), a bold title, a muted "when to use" line, and the script itself set in DM Serif Display italic inside a warm-surface tinted block — never in Inter, never unstyled body text. The italic serif is the visual signal "these are words to say."

6.9 Printable-page framing

Any asset meant to leave the document (chart, tracker, rescue card, script cards) is: (a) placed alone on its own page, (b) wrapped in a dashed border (1.6px dashed #C7CFD6), (c) tagged top-left with a pill: gold background, navy text, printer icon, uppercase label "PRINTABLE · [source] · [n of m]". This convention must never be applied to a page that is not meant to be printed/extracted.

7. Layout & Spacing
Print/PDF canvas: A4 (210×297mm), 18–20mm margins, one component group per page where reasonable.
A short gold divider rule (2.4pt, 34pt wide) separates a page's dek/subtitle from its body content — used consistently, never a full-width line.
Footer wayfinding strap on every content page: small mark + product name (left), section/module label (right), separated by a thin top border.
Numbered "eyebrow" labels (01, 02, i, ii…) precede every section title in a small colored square/chip.
8. Format Adaptation Rules

The tokens and components above never change across delivery formats. Only the shell/container logic changes:

Format	Container behavior
PDF	Fixed A4 sheets, page-break-after, print-safe fonts embedded
Read (web)	Same page content, flowed as auto-height cards in a responsive scroll container (max-width ~900px), sticky nav + progress bar added
Flipbook	Same PDF pages rendered as images inside a page-turn viewer; landscape pages are padded onto a portrait canvas to preserve uniform page proportions
Interactive App	Content is restructured into stateful components (see Document 2, Step 8) inside a mobile app-frame shell; same color tokens, same card/callout/schedule-grid visual language, bottom tab bar + floating action button pattern for the "Rescue" primitive
9. Hard "Never" List
Never use a color outside §2, or a font outside §3.
Never render a callout without its matching icon+label+tint triplet.
Never use filled icons, emoji, or country flags.
Never compress a printable asset onto a page with other content.
Never use generic dashboard chart widgets (donut charts, big vanity numbers, sparkline grids) — status is shown via callouts, pills, and simple stat boxes only, not data-viz.
Never gamify (no points/badges/streasks-as-a-game framing) — the Recovery Bank/NSC ledger is domain content, not a generic gamification layer, and must never be styled like one (no trophy icons, no level-up language).