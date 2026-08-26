# ASSET RENDERING & AUTHORING STANDARD
*Factory standards file · companion to `design-standard.md` §3.3 (component library). This is the
concrete authoring contract for every delivery asset (Guide / Action Toolkit / Decision Aid /
Script Pack / Rescue Card / Tracker). The renderer in `swiipt-core/includes/delivery.php` enforces
this automatically — author to it and every product renders V06-grade with zero per-product CSS.*

## 0 · The one rule

**Author assets as clean markdown (or the structured widget syntax below). Never author HTML, never
author inline CSS, never paste "copy-paste text" tables.** The renderer converts markdown into V06's
designed components. If an asset looks like plain text, the CONTENT is wrong, not the renderer.

Storage contract: asset `content` is stored **RAW** (the publisher must NOT run it through
`wp_kses_post`/`esc_html`). Escaping happens at render time only.

## 1 · The automatic baseline (plain markdown → V06 components)

Write normal markdown; the renderer emits V06's exact design on web, magazine reader, and PDF:

| You author | It renders as |
|---|---|
| `# / ## / ### / ####` heading | navy sans heading, gold underline on h2 |
| `**bold**`, `*italic*` | strong / em |
| `->` or `<-` | proper arrow `→` / `←` |
| `- item` or `* item` | bulleted list |
| `1. item` | numbered list |
| `- [ ] task` / `- [x] done` | tick-box checklist row |
| `[]` / `[ ]` / `[x]` (even inside a table cell) | CSS tick-box |
| a pipe table (`| a | b |`) | cream card + navy-header table |
| `> quote` | gold left-border callout |
| `> ## HEAD` + `> body` | callout with bold navy head |

Design tokens (canonical, already in the renderer): serif body Georgia 17–18px · sans headings navy
`#0B1F33` · h2 gold `#D9A52E` underline · cream cards `#F8F4EC` · border `#DDE2E7` · table header
navy/white. Do not override.

## 2 · Structured widgets (use when prose markdown can't express the layout)

Three block widgets exist. Each is a multi-line block: `[[TAG]]` … directives … `[[/TAG]]`.
The flipbook page-chunker keeps each block on one page. Directives are `KEY: value`; the
`|` character separates fields within a directive.

### 2.1 `[[DECISION]]` — decision tree / triage (route cards)
Use for any "what do I do?" asset. Emits V06 route cards (condition → action) with urgency accents.
```
[[DECISION]]
TITLE: The Stump Decision Tree
SUB: Run this every time the stump looks wrong. One question at a time.
START: START — What changed?
ROUTE: emergency | Baby unwell? Fever, floppy, refusing feeds | EMERGENCY NOW — hospital today | Do not wait for morning
ROUTE: urgent | Skin around stump red, swollen, hot | URGENT TODAY — clinic today | Newborn infections move fast
ROUTE: ok | Dark, dry, hard, shrinking stump | Normal — continue routine | Log it in the tracker
BAND: Educational triage support — never a diagnosis.
[[/DECISION]]
```
`ROUTE: level | condition | action | meta` — `level` = `emergency` (red) / `urgent` (gold) / `ok` (green).
You may follow the block with normal markdown (extra detail, tables, callouts).

### 2.2 `[[RESCUE]]` — rescue / red-flag / bad-day card
Use for any "open this when it goes wrong" asset. Emits the red rescue frame: red banner, body,
navy phrase bar, red tap-to-call chips. Everything that is not a directive renders as markdown
INSIDE the frame.
```
[[RESCUE]]
TITLE: Bad-Day Rescue Card
## The rule of the bad day
A bad day is not a failed recovery. Drop to minimum mode.
## Minimum Mode — the only 5 things
1. Meds on schedule
2. Baby fed somehow
3. You ate one real thing
PHRASE: We got through it. | 5-min reset tonight, no blame.
EMERG: Nigeria 112 | 112
EMERG: UK 999 | 999
[[/RESCUE]]
```
`TITLE:` red banner · `PHRASE: text | note` navy bar · `EMERG: label | tel-number` tap-to-call chip
(repeatable). Keep the body's own fill-in contact tables; EMERG chips are the quick-dial row.

### 2.3 `[[SCRIPTS]]` — script pack
Use for any "say these exact words" asset. Emits numbered script cards (label + gold-bordered words).
```
[[SCRIPTS]]
TITLE: Script Pack
SUB: Warm, firm, zero war.
SCRIPT: Announcing the rule | We have made one house rule for the cord: nothing goes on it.
SCRIPT: Grandma offers herbs | Mama, the doctors now say the stump heals best when nothing touches it.
BAND: Honour the person, state the rule once, give them a role.
[[/SCRIPTS]]
```
`SCRIPT: situation-label | the-exact-words` (repeatable, auto-numbered) · `BAND:` closing note.

## 3 · Format → authoring mapping (default)

| Asset format | Author as |
|---|---|
| Guide (Read) | markdown baseline (headings, callouts, tables) |
| Action Toolkit (Do) | markdown baseline — trackers as pipe tables with `[]` cells, checklists as `- [ ]` |
| Decision Aid (Decide) | `[[DECISION]]` (+ supporting markdown) |
| Script Pack (Communicate) | `[[SCRIPTS]]` |
| Rescue / Red-flag card | `[[RESCUE]]` |

## 4 · Non-negotiables

1. No raw HTML or inline styles in asset content. 2. No literal ASCII tables drawn with dashes —
use pipe tables. 3. No literal `[ ]` left as text when a tick-box is meant — the renderer converts
them, so just author them. 4. Store content RAW (no `wp_kses_post`). 5. After authoring, regenerate
instances (`swt_delivery_generate_instance`) in batches of ≤6 (mPDF memory). 6. Verify the rendered
HTML/flipbook has zero raw tokens (`[[DECISION]]`, `ROUTE:`, `[]` as text, `##`, `->`). 7. Never
reintroduce a mobile-only `@media` wrapper around component classes — component CSS must be global
(the reader paper is ~760px; a ≤620px trap makes tables render as unstyled text).

## 5 · How the factory enforces this standard

Future products flow through the Product Factory as **markdown source files + asset JSON**, and this
standard is wired into every stage so conformance is automatic, not optional:

| Stage | Where | What it does |
|---|---|---|
| Authoring | `agents/builder.md` (hard rule) | Builder authors every `content/*.md` to this standard (baseline markdown + widgets). |
| Schema | `schemas/asset.schema.json` (`tool_widgets`) | Documents the block-widget vocabulary; `source_path` points at the authored markdown. |
| Deterministic QA | `harness/qa-checks.mjs` | BLOCKER checks per asset: source exists, **no raw HTML/inline CSS**, widget blocks balanced, required directives present. Exit 1 on any FAIL. |
| Manifest build | `harness/build-manifest.mjs` | Inlines each asset's markdown `content` into the publish manifest. |
| Publish (runtime) | `swiipt-core/includes/publisher.php` `swt_pb_validate_manifest` + `swt_pb_validate_asset_content` | Bridge re-validates every asset's content and REFUSES the manifest on raw HTML or a malformed widget block. |
| Render | `swiipt-core/includes/delivery.php` `swt_delivery_markdown` | Converts the stored markdown/widgets into the V06 components on web / magazine / PDF. |

**Source-of-truth rule:** the factory `content/*.md` is the authoring source; the live WordPress asset
must match it. If an asset is improved directly in WordPress (e.g. re-authored to a widget), port the
change back to the product's `content/*.md` so a republish does not regress it. Baseline prose markdown
is always conformant; widgets are required only where prose cannot express the layout (decision trees,
rescue frames, script packs).
