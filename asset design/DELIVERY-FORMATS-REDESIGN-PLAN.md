# Delivery Formats Redesign — Implementation Plan

**Date:** 2026-08-27
**Author:** opencode (eng)
**Status:** planning — no code changed
**Companion doc:** `OPENCODE-INVESTIGATION-2026-08-27.md` (the Interactive App, one of the six formats here)
**Design source of truth:** `Product Pipeline/asset design/visual.md`

---

## 0. What this document is

The owner shared a complete design kit in `Product Pipeline/asset design/`. It is not just a new interactive app — it is a **full redesign of every Swiipt delivery format on one shared design system**. This document is the build plan to bring that design direction into the live platform (`swiipt-core` mu-plugin + `swiipt` theme), format by format, plus the system-page (format list) redesign from `new format.jpeg`.

It is a living implementation standard. The Interactive App has its own focused doc (`OPENCODE-INVESTIGATION-2026-08-27.md`); here it is treated as the sixth format in one coherent system.

---

## 1. The design kit (what exists in `asset design/`, verified)

| File / folder | Format it defines | What it is |
|---|---|---|
| `visual.md` | — | **Authoritative design system** — "Quiet Intelligence." Tokens, type, iconography, and a fixed component library. This is the contract; generators must derive from it, never invent. |
| `style.css` (512 lines) | — | Reference implementation of `visual.md`: all tokens + every component class + A4 `@page` print rules. |
| `read.html` + `style-read.css` | **Read** | The full 24-module system as responsive flowed cards; sticky top bar, reading-progress bar, Contents drawer, links out to App / Flipbook / PDF. |
| `Every-Night-Just-Me-V06.pdf` | **PDF** | The same content as fixed A4 print sheets (the print master). |
| `flipbook/index.html` + `assets/` | **Read as magazine** | A real page-turn viewer using `page-flip.browser.js` (vendored locally, no CDN) showing the PDF **rasterized to 24 JPGs** (`assets/pages/page-01..24.jpg`) + TOC drawer, progress, fullscreen, download-PDF. |
| `app/` (`index.html`, `app.js`) | **Interactive** | Claude's reference app (see companion doc). Strictly conforms to `Swiipt_Transformation_Interactive_Engine_Build_Spec_v1.md`. |
| `new format.jpeg` / `new format.htm` | **System page** | The redesigned Transformation System page (format list). `.htm` is the reference layout code, token-accurate to §37; renders inside the platform sitewide header, everything data-driven (see §5). |
| `fonts/` | — | Self-hosted Inter (400/500/600/700 + italic) + DM Serif Display (regular + italic). |

### 1.1 The design system in one screen (from `visual.md` + `style.css`)

- **Philosophy:** calm, editorial, premium — a print magazine / high-end operating manual, never a SaaS dashboard, clinical document, or gamified app.
- **Colour tokens:** `--navy #0B1F33` (primary) · `--purple #6F35B5` (interactive/decision) · `--gold #D9A52E` (emphasis/dividers/printable tags) · `--blush #F3C7D2` (human moments) · `--warm-surface #F8F4EC` · `--soft-surface #F4F6F8` · `--ink #17212B` · semantic `success/warning/error/info` each with **exactly one tint**. Semantic colours are icon-chip only; the tint is the background.
- **Type:** DM Serif Display (titles, pull-quotes, script-card quotes, big numerals, the italic "accent" half of a two-part headline) + Inter (everything else). Never a third family; never serif for body; never Inter for a script quote.
- **Icons:** Lucide, stroke-only, `stroke="currentColor" stroke-width="2" fill="none"`. Never filled, emoji, or flags.
- **Fixed component library (do not invent alternatives):** Callout (6 states: safety/warning/info/success/human/protocol) · Card · Checklist (square box) · Schedule-grid (proportional owner bar + gold handoff segment) · Tracker table (navy header, zebra, review-row band) · Decision tree (real boxes + connector lines, never ASCII) · Rescue card (physical-object treatment: 2px navy border, shadow, red header band, index-card proportions) · Script card (numbered badge, purple pill tag, serif-italic quote in warm block) · Printable-page framing (own page, dashed border, gold "PRINTABLE" pill).
- **Format adaptation rule (`visual.md` §8) — the architecture:** *tokens and components never change across formats; only the shell/container changes.* PDF = fixed A4 · Read = responsive scroll cards · Flipbook = rasterized pages in a turn viewer · Interactive = stateful mobile app-frame. This single rule is the whole plan.

---

## 2. Current live render path (verified via MCP) vs target

### 2.1 What is live today (`swiipt-core/includes/delivery.php`, 73.8 KB)

Every asset (Guide/Action toolkit/Decision aid/Script pack) is authored as markdown in `swiipt_transformation_system_assets.content`, then `swt_delivery_generate_instance()` renders **five instance files** into `uploads/swiipt-assets/`, stored in `swiipt_asset_instances.kind`:

| Current `kind` | Format button | Current renderer |
|---|---|---|
| `flipbook` | Read as magazine | `swt_delivery_flipbook_build()` → in-house vanilla-JS `swt_delivery_reader()` (self-contained, **no** page-turn library) |
| `html` | Read | `swt_delivery_reader()` doc mode, from `swt_delivery_markdown()` |
| `pdf` | PDF | `swt_pdf_build()` via **mPDF** + `pdf-brand.css` |
| `image` | Image | `swt_delivery_svg_poster()` (SVG) |
| `audio_transcript` | Read aloud | `.txt` → browser SpeechSynthesis (TTS) |

The renderer is a **custom markdown parser** (`swt_delivery_markdown`) plus the Option-A widget system (`[[DECISION]]/[[RESCUE]]/[[SCRIPTS]]`, `asset-rendering-standard.md`). It approximates the design; it is not driven by `style.css`.

### 2.2 Target

Same five generated files + the sixth (Interactive) surfaced at system level, **but every rendered format derives from `visual.md`/`style.css`** and matches the reference kit:

| Format | Target renderer |
|---|---|
| Read as magazine | **`page-flip.browser.js`** viewer over **rasterized page images** (the flipbook kit), replacing the in-house reader |
| Read | `read.html` structure + `style.css` + `style-read.css`, responsive card flow |
| PDF | Design-system A4 (matches `Every-Night-Just-Me-V06.pdf`), fonts embedded |
| Image | Design-system share/reference card(s) |
| Read aloud | Unchanged mechanism (TTS), but launched from the redesigned shell |
| Interactive | The reference app (see companion doc) surfaced per `new format.jpeg` |

### 2.3 The core tension to resolve (flagged, needs an owner decision — see §9)

The reference **Read as magazine** loads **pre-rasterized page JPGs**. Two ways to produce those at scale for hundreds of products:

- **(A) Render→rasterize pipeline:** author content → produce design-system HTML → render to A4 PDF → rasterize each page to JPG → feed the flipbook. One source, all formats derive. Highest fidelity, matches the kit exactly.
- **(B) Reflow (no rasterization):** keep the flipbook as HTML pages (no images). Cheaper, but it will not match the print master pixel-for-pixel and loses the "real page" fidelity the owner chose.

**RESOLVED (§9.1): pipeline (A), using Ghostscript — confirmed working on the host by a live test.** Option (B) is not needed.

---

## 3. The shared design-system layer (foundation — build first)

Everything else depends on this. Port `visual.md`/`style.css` into the platform as **one canonical stylesheet the generators consume**, so no format re-implements tokens.

1. **Fonts:** ship the 7 `fonts/*.ttf` (or woff2) into the theme (they largely already exist per C.10) and reference them in one `@font-face` block.
2. **Design-system CSS:** add `swiipt-core` asset `swt-asset-design.css` = `style.css` verbatim (tokens + all component classes), the single source for Read/PDF/Flipbook page HTML. Reconcile against the theme's canonical `swt-tokens.css` (C.9) so values match (they already align: navy `#0B1F33`, purple `#6F35B5`, gold `#D9A52E`).
3. **Component partials:** a PHP helper library `swt_ds_*` that emits each `visual.md` component (callout, card, checklist, schedule-grid, tracker-table, decision-tree, rescue-card, script-card, printable-frame) as design-system HTML — so both the render pipeline and the interactive engine call the same builders. This replaces ad-hoc markdown-to-HTML for structured components.
4. **Hard "never" list (`visual.md` §9)** encoded as a lint in QA: no off-token colour, no third font, no filled icons/emoji/flags, no printable asset sharing a page, no dashboard chart widgets, no gamification.

Deliverable: `swt-asset-design.css` + `swt_ds_*` helpers + font loading, verified to render one reference component set identically to `read.html`.

---

## 4. Per-format implementation

### 4.1 Read (web) — `read.html` + `style-read.css`
- Port `style-read.css` (sticky top bar, `.readprogress` scroll bar, `.readshell` max-width flow, TOC drawer) into the platform.
- The Read instance becomes: design-system page sections (from `swt_ds_*`) flowed as auto-height cards in the responsive scroll container. Keep the top-bar links out to App / Flipbook / PDF.
- Replaces `swt_delivery_reader()` doc mode.

### 4.2 PDF — design-system A4
- The PDF must match `Every-Night-Just-Me-V06.pdf`: A4, 18–20mm margins, one component group per page, footer wayfinding strap, printable pages framed + gold PRINTABLE pill, fonts embedded.
- Current mPDF (`swt_pdf_build`) supports most of `style.css` but **not** CSS `var()` (AGENTS.md lesson #28) — so feed it a literal-colour build of `style.css`. Decision in §9.1: keep mPDF (fast, in-process, proven) vs a headless-Chrome renderer (perfect fidelity, heavier). Recommendation: **mPDF for the PDF file**, headless only if we adopt pipeline (A) for rasterization.

### 4.3 Read as magazine (Flipbook) — `page-flip.browser.js` + page images = the ebook reader hub
- Vendor `flipbook/assets/vendor/page-flip.browser.js` into `swiipt-core` (no CDN — matches AGENTS.md lesson #22 intent, just with a real library bundled locally).
- Ship the flipbook shell (`flipbook/index.html`: topbar, side-nav, progress, TOC, fullscreen, download-PDF) as a template that loads `assets/pages/page-NN.jpg` + a per-product TOC.
- **Page images:** produced by rasterizing the A4 PDF (pipeline A, §9.1). Store JPGs in `uploads/swiipt-assets/<asset>/pages/`. The `flipbook` instance's `file_url` points at the shell.
- Replaces the in-house `swt_delivery_reader` magazine mode.
- **The flipbook is the ebook READER HUB (owner directive 2026-08-27).** It is the surface a customer lands on to *read the whole ebook in-browser without downloading first*. Its cross-links tie the reading surfaces together (verified in `flipbook/index.html` + `read.html`): **Download PDF** (the actual file), **Read** (`../read.html` clean-doc mode), **Open App** (`../app/`), **Contents** (TOC drawer), **Fullscreen**. So the literal PDF file-download is a *button inside the flipbook*, not the entry action (see §14.1).
- **NEW requirements (owner 2026-08-27):**
  - **Zoom in/out at multiple percentages** (e.g. 100 / 125 / 150 / 200% or +/− steps + reset), with pan when zoomed — currently absent from the reference shell; must be added.
  - **Mobile-optimized + fully responsive** — single-page portrait on phones (page-flip `usePortrait`), large tap targets, pinch-to-zoom friendly, controls reachable one-handed; the topbar/bottombar collapse gracefully (the reference has a `@media(max-width:720px)` start point but zoom + touch polish must be added).

### 4.4 Image — printable modules, sized per artifact
- Export the **printable modules** as images at their real usable proportions (owner directive): fridge chart **landscape**, 14-day tracker **landscape**, **each script card as its own image**, rescue card **index-card**, checklist portrait. Produced by rasterizing that module's isolated printable page (Ghostscript, §9.1) or from its component HTML (Imagick). Purpose per `visual.md`/spec: "remember quickly" + practical print/share.

### 4.5 Read aloud — unchanged mechanism
- Keep the `.txt` transcript + browser SpeechSynthesis. Only the launch button + surrounding shell restyle to the new system. Ensure `swt_tts_script()` still emits wherever the button renders (AGENTS.md lesson #31).

### 4.6 Interactive — see companion doc; strictly per the build spec
- Built and deployed (client-driven engine, V06 config). Surface it per `new format.htm` (§5). **All interactive apps strictly follow `Swiipt_Transformation_Interactive_Engine_Build_Spec_v1.md`** (config-driven §27, registry §14, structured state §11/§20, 13 canonical events §23, validation §29, publishing gate §31, build order §37 — see §5.3). Full detail + fix list in `OPENCODE-INVESTIGATION-2026-08-27.md`.

---

## 5. System page (format list) redesign — `new format.jpeg` + `new format.htm`

This is where all six formats meet. The owner's `new format.jpeg` (visual) + **`new format.htm` (the actual reference layout code)** supersede today's 4-card / 5-button list. `new format.htm` is token-accurate to the platform's canonical §37 layer (`--color-brand-*`, `--space-*`, `--radius-*`, `--shadow-*` — same as `swt-tokens.css`), so it drops straight onto the live token system.

### 5.1 Canonical layout (`new format.htm`), top to bottom
*(No bespoke product bar — the mockup's `.appbar` is dropped; the platform sitewide header sits above. The product-context line is **folded into the hero**, per owner decision 2026-08-27.)*
1. **Hero** — eyebrow "Complete System · V06" → serif title → a **dynamic product-context line folded in** (life area · version · review-status dot+label, e.g. "Postpartum & New-Parent Life · v1.2 · Clinically reviewed") → description naming the six modes → chips (`7 components · 6 delivery modes · TSM · Interactive included`) → journey ribbon `1 See → 2 Understand → 3 Act → 4 Measure → 5 Continue`.
2. **"One system · six ways in"** — 6 mode tiles (`MODES` map), each stating that mode's job (Spec §1).
3. **"The system · components"** — the `COMPONENTS` array rendered as cards; each: badge · title · sub · "Recommended: <mode>" · a `mode-row` where the recommended mode is filled-purple and first, then only the modes that apply; a note line.
4. **Footer note** — "Educational, not medical advice…".

Component/mode data as authored in `new format.htm` (this is the shape the content tree must emit):

| Badge | Component | Recommended | Modes shown |
|---|---|---|---|
| READ | Guide | magazine | magazine · read · pdf · image · aloud |
| DO | Action toolkit | interactive | interactive · magazine · read · pdf · image · aloud |
| DECIDE | Decision aid | interactive | interactive · read · image · pdf |
| COMMUNICATE | Script pack | interactive | interactive · aloud · read · pdf |
| TRACK | Shift tracker | interactive | interactive · pdf |
| RESCUE | Bad-night protocol | interactive | interactive · image · pdf |
| PROGRESS | Progress & TSM | interactive | interactive |

### 5.2 Owner rules for implementing `new format.htm` (2026-08-27)
- **No bespoke header.** The mockup's navy `.appbar` is **not** hardcoded into the page. The page renders inside the **platform sitewide header/footer** (the theme chrome from Phase C.12). The product-context line (name / life area / version / review status) is **folded into the hero** (owner decision 2026-08-27) as **dynamic** data from the TS/product — never the hardcoded "Every Night, Just Me — Complete System · Postpartum & New-Parent Life · v1.2 · Clinically reviewed" string.
- **Nothing hardcoded — everything fetched dynamically.** The `COMPONENTS` array, `MODES`, chips, journey ribbon, title, eyebrow, review status, and footer are **data** from the product content tree (§13/§15) + TS meta. `new format.htm`'s inline JS arrays are the *reference shape*, not content to ship. The template iterates real data.
- **Honesty:** the review-status dot/label and chips render only from real values (real clinical-review status, real TSM presence, real component count) or are omitted (Spec §22/§31; AGENTS.md #6).
- **Fonts:** drop the `cdn.jsdelivr.net` fontsource links in the mockup; use the platform's **self-hosted** Inter + DM Serif Display (C.10). No CDN.
- **Tokens:** consume the existing `swt-tokens.css` §37 layer; the mockup's `:root` values already match, so no new palette.

**Non-negotiables:** every "Open interactive" opens the **same** app instance deep-linked to the right tab (never six apps). Delete the dead `?ia=` launch list (companion doc §3). The interactive app **strictly follows** `Swiipt_Transformation_Interactive_Engine_Build_Spec_v1.md` (see §5.3).

### 5.3 Interactive conformance (owner directive)
All interactive apps — for every product, now and at scale — **strictly follow** `Swiipt_Transformation_Interactive_Engine_Build_Spec_v1.md`: config-driven (content/code separation §27), the component registry §14, structured state §11/§20, the 13 canonical analytics events §23, validation §29, publishing gate §31, and the build order §37. The reference app (`asset design/app/`) is the concrete expression of that spec; the engine renders product config, never hardcoded product logic.

---

## 6. Data model changes

1. **Component (7) × mode (6) two-axis model.** Today there are 4 asset rows (Read/Do/Decide/Communicate) and `swiipt_asset_format` has 4 terms. The new page needs 7 components and, per component, *which modes apply + which is recommended*.
   - Keep the 4 document assets (Guide/Toolkit/Decision aid/Script pack) as-is.
   - Represent **TRACK / RESCUE / PROGRESS** as **interactive-primary components** (config-driven, optional PDF/Image export) — do **not** fabricate document assets that don't exist (honesty).
   - Store per-component `{ modes_shown[], recommended_mode, interactive_tab }` in product config (`_swiipt_interactive_config` / product schema), because it is product content (Spec §13/§27), not `delivery.php` logic.
2. **Flipbook page images:** new storage `uploads/swiipt-assets/<asset>/pages/page-NN.jpg` + a TOC structure per product (title + module list, as in `flipbook/index.html`).
3. **`swiipt_asset_instances`** already carries `kind` (html/pdf/image/audio_transcript/flipbook) — no schema change; the `flipbook` instance now points at the page-flip shell.

---

## 7. Content → render pipeline

The scaling goal: author once, generate all six. Proposed flow (aligns with the Product Factory):

```
asset content (structured: sections + visual.md components)
        │
        ├── swt_ds_* component builders  → design-system HTML (single source)
        │        ├── Read      : responsive card flow (style-read.css shell)
        │        ├── PDF        : A4 print build (mPDF, literal-colour style.css)
        │        └── Flipbook   : PDF → rasterize pages → page-flip shell   [pipeline A]
        ├── Image     : selected component(s) → PNG/SVG
        ├── Read aloud: strip to transcript → TTS
        └── Interactive: product config → reference engine (already built)
```

- Author content as **structured sections** (each maps to `visual.md` components), not free markdown, so every format renders design-grade automatically. This extends `asset-rendering-standard.md` (which already defines the `[[DECISION]]/[[RESCUE]]/[[SCRIPTS]]` widgets) toward the full component library.
- The interactive engine and the render pipeline **share the `swt_ds_*` builders** so a decision tree looks identical in PDF, Read, and the app.

---

## 8. Migration & sequencing (each step reversible, temp-lint discipline)

| Phase | Deliverable | Gate |
|---|---|---|
| **F0** | Foundation: `swt-asset-design.css` (= `style.css`), fonts, `swt_ds_*` component builders; render one reference component set == `read.html` | visual parity check |
| **F1** | System-page redesign (`new format.jpeg`): hero + legend + 7 component cards + recommended-mode buttons; delete dead `?ia=` list; wire "Open interactive" deep-links to the one app | companion-doc fix list §6 |
| **F2** | Read format on the new shell (`style-read.css`) | matches `read.html` |
| **F3** | PDF on design-system A4 (mPDF, literal-colour) | matches `Every-Night-Just-Me-V06.pdf` |
| **F4** | Flipbook: vendor `page-flip.browser.js`, page-image pipeline (A), shell | matches `flipbook/` |
| **F5** | Image + Read-aloud restyle | tokens correct |
| **F6** | Retire legacy `interactive-engine.php`; regenerate all V06 instances; QA the `visual.md` §9 "never" lint | full acceptance |
| **F7** | Second product (Cord Care) proves the pipeline reusable with zero engine-code change | Spec §32 |

Start F0+F1 (foundation + the visible system page) since they unblock everything and fix the current "not good" surfacing. F4 depends on the §9.1 decision.

---

## 9. Open decisions for the owner

### 9.1 Flipbook page images — RESOLVED (host probed 2026-08-27)
**Decision: pipeline (A) render→rasterize, using Ghostscript. Confirmed viable by live test.**

Host probe results (via MCP `exec`):
- **Ghostscript 9.54.0** at `/bin/gs` ✓ · **ImageMagick 7.1.1** (`magick`/`convert`) ✓ · **PHP Imagick ext loaded with PDF support** ✓ · GD ✓
- `exec`/`shell_exec` enabled, `disable_functions` empty ✓
- Not present (not needed): poppler (`pdftoppm`/`pdftocairo`), `mutool`, chromium/chrome, `wkhtmltopdf`, `node`
- **Live end-to-end test:** rasterized the real `asset-29.pdf` (50 KB) → `page-01.jpg` (104 KB) + `page-02.jpg` (392 KB) at 150 DPI in **0.23 s**, rc 0, then cleaned up. The pipeline works today.

Chosen invocation (tune DPI down for weight):
```
gs -q -dNOPAUSE -dBATCH -dSAFER -sDEVICE=jpeg -r135 -dJPEGQ=86 \
   -sOutputFile=<dir>/page-%02d.jpg <input>.pdf
```
So the flipbook uses the reference kit exactly: content → mPDF A4 PDF → `gs` rasterize → `page-flip.browser.js`. Option (B) HTML-flipbook is **not** needed.

**Tuning note:** 150 DPI gave a 392 KB page; drop to ~120–135 DPI and/or post-resize to a max width (Imagick) so 24-page books stay light on mobile. Run `gs` per-product on generate, store JPGs under `uploads/swiipt-assets/<asset>/pages/`. Watch per-request memory/time (batch, like mPDF — AGENTS.md #49).

### 9.2 PDF engine
- Keep **mPDF** (in-process, proven, already installed) fed a literal-colour `style.css`? **Recommended.** Or move to headless-Chrome for pixel-perfect parity (heavier, only worth it if we already run it for 9.1).

### 9.3 Content authoring model
- Adopt **structured sections mapped to `visual.md` components** as the authoring standard for new products (extends `asset-rendering-standard.md`)? Required for all six formats to render design-grade automatically at scale.

### 9.4 Scope of first cut
- Ship **F0+F1 first** (foundation + the redesigned system page — fixes the visible problem and unblocks the rest), then Read/PDF/Flipbook? **Recommended.**

---

## 10. Risks & safety

- **mu-plugin parse errors kill the whole site + all MCP abilities** (AGENTS.md #5/#23/#42/#47). Every `delivery.php` edit: write candidate → `/usr/bin/php83 -l` → copy live only if clean → `opcache_reset()` → purge StackCache → verify with `?c=rand`. Never splice across the `$swt_reader_css`/`$swt_tool_css` globals.
- **Regeneration is memory-hungry** (mPDF): batch ≤6 assets per call (#49).
- **Honesty rule:** never fabricate "Clinically reviewed / TSM" chips or components without real backing (Spec §22/§31; AGENTS.md decision #6).
- **No CDN** for the flipbook library — vendor `page-flip.browser.js` locally (#22).
- **Cache-bust** regenerated static asset URLs with `?v=time()` (#30).

---

## 11. Verification

- **Visual parity:** each format rendered for V06 must match its reference file in `asset design/` (Read↔`read.html`, PDF↔`Every-Night-Just-Me-V06.pdf`, Flipbook↔`flipbook/`, System page↔`new format.jpeg`).
- **Design lint:** `visual.md` §9 "never" list automated (off-token colours, third fonts, filled icons/emoji/flags, printable-page sharing, dashboard widgets, gamification).
- **Interactive:** companion-doc acceptance (B1–B10) in a real browser.
- **Reusability:** a second product (Cord Care) renders all six formats + a different interactive component mix with **zero engine-code change** (Spec §32).

---

## 12. Bottom line

- The design kit is a **complete six-format redesign on one system** (`visual.md`), governed by one rule: same tokens/components, different shell.
- Build the **foundation (`style.css` + `swt_ds_*` + fonts)** first, then the **`new format.jpeg` system page** (which also fixes the current interactive surfacing bug), then Read → PDF → Flipbook → Image/Read-aloud → legacy retirement → reusability proof.
- The one decision that gates the flipbook is **how page images are produced (§9.1)** — **RESOLVED: Ghostscript render→rasterize, confirmed working live on the host.** Everything else is a straight port of the reference kit with the standard safety discipline.
- No code changed to produce this plan. On your go, I start with F0+F1 through the MCP.

---

## 13. HOW V06 WAS BUILT — the origin story + the Content Structuring Engine

*(Appended 2026-08-27 after the owner walked me through the V06 source in `specs/V06/`. This is the missing link between raw research and the multi-format factory, and it changes the delivery/download model — read §14.)*

### 13.1 The source bundle (what a product starts as)

A product begins as **raw markdown**, authored per the Product Factory research/spec stages. V06's bundle:

| Source file | Role |
|---|---|
| `V6-spec.md` | **Product identity + transformation logic** — 13 identity fields, before/after state, mechanism, transformation path, the **§06 Asset Map** (customer-need → format), failure-point map, first-win, **§09 TSM**, re-entry, next transformation, and the **A–O quality gate** self-score. |
| `V06-deliverables.md` | **The customer-facing content** — 13 PARTS (roadmap, the read, situation finder, decision tree, safety rules, 3 roster templates, sleep banker, 7 script cards, fridge chart, 14-day tracker, rescue card, re-entry, safety gate). Raw markdown with ASCII tables/trees. Explicitly says: *"the delivery engine converts this markdown into interactive stages. Do not bundle this into a single plain text PDF file."* |
| `V06-part01…13.md` | The same content split into numbered per-module files. |

### 13.2 The Content Structuring Engine (`content structuring.md`)

Claude then turned that raw bundle into the finished multi-format product using a **repeatable 9-step algorithm** (documented in `specs/V06/V06-part11-rescue-card/content structuring.md`). This algorithm is the **single most important thing to bake into the factory**, because it is what makes "author once → generate every format" work at scale. Summary:

1. **Ingest & classify** — read all files; spec → identity fields; deliverables → asset manifest (the validation checklist); each part → one content module.
2. **Asset-type detection** — classify each module by *what kind of tool it is*, not how it was formatted, and assign exactly one `visual.md` component:
   | Source content shape | Component |
   |---|---|
   | fill-in wall-chart / schedule in prose | schedule-grid (§6.4) |
   | branching if-X-then-Y logic | decision-tree (§6.6) |
   | day/row log filled over time | tracker (§6.5) |
   | yes/no self-assessment list | checklist (§6.3) |
   | numbered in-the-moment crisis steps | rescue-card (§6.7) |
   | verbatim spoken dialogue tied to a trigger | script-card (§6.8) |
   | a single rule / warning | callout (§6.1) |
   | anything else (argument, narrative) | editorial page (prose + pull-quote + numbered reasons) |
   **The cardinal rule:** *the source markdown tells you WHAT the content is, not HOW it should look* — never render a module in its raw markdown shape; always re-express through the matched component.
3. **Synthesize front matter (always)** — Cover, Product Identity (fact-table), Contents (verb-badged), Roadmap (vertical timeline), Printable-assets index. None of these exist in source; the system always builds them.
4. **Module sequencing** — reorder into real-world usage order: READ → DECIDE → RULES → BUILD → TRACK → COMMUNICATE → EXECUTE → TRACK(extended) → RESCUE → RECOVER → ESCALATE → REFERENCE → CLOSE.
5. **Printable isolation** — any schedule-grid / tracker / rescue-card / script-card goes **alone on its own page(s)** with the dashed printable frame + gold "PRINTABLE · n of m" tag.
6. **Component selection** — use the Step 2 table (= `visual.md` §6); never re-derive per product.
7. **Auto-generate the Authoring Standard appendix** — a table (asset type | pattern used | where it appears | why) populated from *this* product's real classifications.
8. **Cross-format adaptation** — the single classified module tree drives **every** format: PDF/Flipbook render each module as a sheet; Read flows the identical list as responsive sections; **the Interactive App maps by classification** — checklist→Tonight, decision-tree→Check-in, tracker→Tracker, script-card→Scripts, rescue-card→Rescue FAB. *Nothing about the content is rewritten between formats; only the container/interactivity changes.* This is the exact link between "how the document was structured" and "how the app was structured."
9. **Validation** — every manifest asset appears once in correct component form; every printable isolated + tagged; decision tree has no orphan branches / every leaf resolves; appendix row count == distinct asset types used; footer strap on content pages, dashed frame on printables.

**This algorithm is currently NOT in the platform factory.** Today `publisher.php` + `delivery.php` attach 4 asset families and render per-family files via a markdown parser. The factory is missing the **structuring/assembly stage** that turns a source bundle into one classified module tree. Building that stage is the core of getting this "right from the beginning."

---

## 14. REVISED DELIVERY & DOWNLOAD MODEL (owner directive 2026-08-27)

This supersedes the per-asset-family model in §2/§5 above where they conflict.

### 14.1 One ebook, not many files

The owner's rule: **customers download ONE combined ebook, not many PDFs.** The whole product is a single assembled document (the classified module tree from §13.2), delivered as:

| Delivery | What it is |
|---|---|
| **PDF (download)** | **ONE combined ebook** = all modules in sequence (the full `Every-Night-Just-Me-V06.pdf`). **But clicking the ebook/"PDF" entry in My Library does NOT force a file download — it opens the flipbook reader** (§14.1a). The actual PDF file downloads via the **Download PDF** button *inside* the flipbook. |
| **Read as magazine** | The same combined ebook in the page-flip viewer — **this is the reader hub the ebook entry opens** (§4.3). |
| **Read** | The same combined ebook as responsive web sections. |
| **Read aloud** | TTS over the same combined content. |
| **Images (download)** | The **printable modules only** — tracker, checklist, fridge chart, rescue card, script cards — each exportable **as an image**, **sized for practical printing/sharing per artifact** (owner directive 2026-08-27): fridge chart = **landscape**, 14-day tracker = **landscape**, **script cards = individual cards** (one image each, not a strip), rescue card = **index-card proportions**, checklist = portrait. Not one tall full-page dump; each printable exported at its real usable proportions. **These download IMMEDIATELY on click** (no reader) — unlike the ebook. |
| **Interactive** | The operational modules as the stateful app. |

So My Library shows, per product: **1 ebook (opens as a flipbook reader) + a small set of printable images (immediate download) + the interactive app** — never the current 12-file dump (html/pdf/txt × 4).

### 14.1a Ebook opens the flipbook reader, not a raw download (owner directive 2026-08-27)
In My Library → assets & downloads, clicking the ebook/**PDF** entry **opens the flipbook reader in-browser** rather than pushing a file. Rationale (owner): give customers the feeling they can **read the entire ebook without downloading first**, in a nice flipbook. The flipbook already carries every action they need — **Download PDF · Read · Open App · Contents · Fullscreen** (verified cross-links in `flipbook/index.html` ↔ `read.html` ↔ `app/`) — plus the new **zoom** and **mobile-responsive** requirements (§4.3). The literal PDF file is downloaded from the **Download PDF** button inside the reader.
- **Only the ebook behaves this way.** The printable images (tracker, checklist, fridge chart, rescue card, script cards) **download immediately on click** — no reader, no intermediate screen.

### 14.2 How this reconciles with `new format.jpeg`

The 7 component cards on the system page are the **structure of the one ebook**, not 7 separate downloads. Each card's buttons are *ways to consume that section*:
- **Read as magazine / Read** on a component → open the one ebook (ideally deep-linked to that module).
- **PDF** → the one combined ebook download (same file for every card).
- **Image** → download *that* printable module as an image (only shown on printable components: tracker, fridge chart, rescue card, script pack).
- **Open interactive** → the one app at the matching tab.

One product = one ebook + its printables-as-images + one app. The cards are navigation into that, not a file per card.

### 14.3 Platform changes this forces

1. **Assembly stage:** build the combined ebook from all modules (§13 engine) instead of 4 independent family documents.
2. **Downloads:** `swt_commerce_attach_downloads` must attach **one** ebook PDF + the printable images, not html/pdf/txt × 4. (AGENTS.md lesson #20 territory — rework the download set.)
3. **Printable-as-image export:** each printable module rendered to an image (Ghostscript can rasterize its isolated PDF page, or Imagick from the component HTML).
4. **My Library / Account OS:** the assets/downloads UI lists **1 ebook that opens the flipbook reader** (§14.1a — not a raw file link) + N printable images (immediate download) + app launch; the interactive-activity indicator (already built) stays beside progress.
5. **Flipbook reader upgrade:** add **zoom (multiple %)** + **mobile-responsive/touch** to the vendored flipbook shell (§4.3), and keep its cross-links (Download PDF / Read / Open App / Contents / Fullscreen) wired to this product's real instances.

---

## 15. WHAT THIS MEANS FOR THE PRODUCT FACTORY (getting it right at scale)

Hundreds of thousands of auto-generated products means the **structuring engine (§13.2) must be a real, deterministic factory stage**, not a per-product manual pass. Proposed factory shape:

```
RESEARCH → SPEC (*-spec.md) + DELIVERABLES (*-deliverables.md) + PARTS (*-partNN.md)
        │
        ▼  [NEW] CONTENT STRUCTURING STAGE  (implements content structuring.md §1–9)
        │     • classify each module → visual.md component
        │     • synthesize front matter (cover/identity/contents/roadmap/printable-index)
        │     • sequence modules (READ→…→CLOSE)
        │     • isolate printables
        │     • emit ONE canonical "product content tree" (JSON: ordered modules + component type + fields)
        │     • auto-generate authoring-standard appendix
        │     • validate (manifest coverage, decision-tree integrity, printable framing)
        ▼
   PRODUCT CONTENT TREE  (the single source of truth for this product)
        │
        ├── Combined ebook  → PDF (mPDF, style.css) → rasterize → Flipbook
        ├── Read (web)       → responsive sections (style-read.css)
        ├── Read aloud       → transcript → TTS
        ├── Printables       → per-printable image export
        └── Interactive      → product config for the reference engine (tab = component class)
```

Key principles for scale:
- **One content tree per product** drives all six formats + downloads (no per-format re-authoring). Same tree → PDF, flipbook, read, read-aloud, images, app.
- **Classification is content-driven** (Step 2 heuristics), so the pipeline degrades gracefully across the whole library regardless of how each source was written.
- **Deterministic + validated** (Step 9) so a malformed product is rejected, not silently shipped (matches Spec §29/§31 + the factory QA gates already in `harness/qa-checks.mjs`).
- **The interactive config is generated from the same classifications** (Step 8), so a product's app and its ebook never drift.
- Reuses what exists: `visual.md`/`style.css` (§3 foundation), mPDF, Ghostscript (§9.1), the reference interactive engine, and the factory's existing record store + QA runner.

### 15.1 Revised build order (supersedes §8 where it conflicts)

| Phase | Deliverable |
|---|---|
| **F0** | Design-system foundation: `style.css` + `swt_ds_*` component builders + fonts |
| **F1** | **Content Structuring Engine** — the §13.2 algorithm as a deterministic stage producing the product content tree (start with V06's bundle; output must reproduce the reference ebook order/classification) |
| **F2** | Combined-ebook PDF from the tree (mPDF, `style.css`), matching `Every-Night-Just-Me-V06.pdf` |
| **F3** | Flipbook (Ghostscript rasterize the ebook → `page-flip`) + Read (web) + Read-aloud from the same tree |
| **F4** | Printable-as-image export; rework `swt_commerce_attach_downloads` → **one ebook + images** |
| **F5** | `new format.jpeg` system page (7 components = tree structure; recommended-mode buttons; one app deep-links) — fixes the interactive surfacing bug too |
| **F6** | Interactive config auto-generated from the tree's classifications; retire legacy engine |
| **F7** | Second product (Cord Care) end-to-end through the engine = the scale/reusability proof |

The **Content Structuring Engine (F1)** is the keystone — everything downstream reads its output. Build it first after the design foundation, prove it reproduces V06, then wire each format to it.

---

## 16. Updated bottom line

- V06 was built as **raw source bundle (spec + deliverables + parts) → a 9-step Content Structuring algorithm → one classified module tree → every format.** That algorithm (`content structuring.md`) is the factory's missing stage and the key to scale.
- The delivery model is now **one combined ebook** (PDF/flipbook/read/read-aloud) **+ printables as images + one interactive app** per product — never many PDFs.
- Build order: **design foundation → Content Structuring Engine (reproduce V06) → ebook PDF → flipbook/read/read-aloud → printable images + one-ebook downloads → new system page → interactive from the tree → 2nd-product proof.**
- Nothing is manual per product: one content tree, deterministically classified and validated, drives all six formats and the downloads — which is exactly what "hundreds of thousands of products" requires.
- Still no code changed. On your go I start F0 (foundation) + F1 (the Content Structuring Engine, validated against the V06 bundle).
