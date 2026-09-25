# TASK — SWIIPT SEMANTIC PRODUCT COMPOSITION + V06 VISUAL PARITY

**Status: implementation + verification COMPLETE. Owner visual pass OUTSTANDING.**
Date: 2026-09-25 · Site: swiipt.com (WP 7.1.2, PHP 8.3.33) · Cost: $0 · Providers: 0
Note: the platform was **migrated to a new home path** mid-task (`/home/sites/18a/3/3a57eedafe/`).
Novamira auth was repaired and re-verified before any live work (snapshot `20260925-140859-pre-edit`).

---

## 1. The defect (live diagnosis)

The master renderer was **not product-agnostic**. Component renderers carried hardcoded V06
content, so any other product inherited V06's family. Concretely, for **PPL-FAMILY-MONEY-001**:

| # | Defect | Root cause |
|---|---|---|
| 1 | The DECIDE asset would render **V06's roster tree** ("Start — Every Night, Just Me" → Roster A/B/C) | `swt_eb_decision()` hardcoded the V06 tree |
| 2 | The RESCUE card was titled **"Bad Night Protocol / When tonight goes wrong"** | hardcoded in `swt_eb_rescue()` |
| 3 | The colophon printed **"Every Night, Just Me … Postpartum Couple OS"** + V09/V11/V19 teasers | hardcoded in `swt_eb_colophon_page()` |
| 4 | Module title printed **twice** (page shell `<h1>` + body's leading `# H1`) | no title/body de-duplication |
| 5 | Literal **`##`** leaked inside callouts (`> ## The rule of three`) | quote renderers had no heading handling |
| 6 | Literal **`[[RESCUE]]` / `[[/RESCUE]]`** widget markers rendered as body text | the block parser had no widget-marker handling |
| 7 | DO assets rendered as **prose essays** ("DO" = a worksheet the customer works through) | no functional-mode → component grammar |

Measured before the fix: `Every Night` ×1, `Postpartum Couple OS` ×1, `Bad Night Protocol` ×1,
`[[` ×1, `##` ×2, output near-generic (15 pp).

## 2. What was implemented (generic, no product hardcoding)

**Live engine** (`wp-content/mu-plugins/swiipt-core/includes/`):

- **`ebook-components.php`**
  - `swt_ebook_module_body()` — dispatcher now: drops a leading heading that repeats the module
    title (generic de-dup), collects the joined block text once, and routes `DO` with `Step N`
    content to the new worksheet renderer.
  - **`swt_eb_worksheet()` + `swt_eb_fillable_table()`** — a DO asset is *worked through*: step
    headings + ruled, writable tables (min 5 blank rows). No product wording.
  - **`swt_eb_decision()`** — now content-dispatched: the V06 roster tree is used **only** when the
    asset content itself contains roster routes (`/\bRoster\s+[ABC]\b/i`). Everything else composes
    from the asset's own verdict rows.
  - **`swt_eb_decision_generic()` + `swt_eb_parse_verdicts()` + `swt_eb_is_verdict_table()` +
    `swt_eb_verdict_accent()`** — builds a **real decision interface**: `START → condition nodes →
    BUY / WAIT / NEVER leaves`, then a routed detail table. Semantics drive the accent
    (never/stop/emergency → red, wait/pause/hold → amber, buy/go/safe → green).
  - **`swt_eb_quote_html()`** — one shared, heading-aware quote renderer (a heading may appear on
    any line; stray hashes are stripped). Used by `swt_eb_editorial`, `swt_eb_gate`, and
    `swt_ebook_block_html`.
  - **`swt_eb_rescue($blocks, $title)`** — card title now comes from the module, not V06.
  - **`swt_eb_colophon_page()`** — product name from the tree, area from the identity block,
    "NEXT IN YOUR JOURNEY" teasers rendered **only from real data** (omitted when absent), and the
    closing copy/teaser list de-V06'd.
- **`content-structurer.php`** — `swt_cs_blocks()` now treats widget markers as **structural**:
  `[[TAG]]` / `[[/TAG]]` anywhere on a line are removed (open, close, or mid-line), `TITLE: x`
  becomes a heading (so a DECISION gets its START), other `KEY:` directives are dropped, and a
  **final safety pass** strips any marker that rode inside a joined paragraph / list / table cell.
  Consecutive `>` lines are now grouped into one quote block.
- **`ebook.php`** — the `quote` block delegates to the single shared `swt_eb_quote_html()`.

**Repo (canonical contract + tests)** — `harness/master-assembly.mjs` gained
`CANONICAL_MODE_ORDER`, `MODE_COMPONENT`, `componentForMode()`, `canonicalModeOrder()`,
`stripWidgetMarkers()`, `assertConsumerClean()`; +11 tests in `harness/master-assembly.test.mjs`
(22 → 33). Every mode→component mapping and the canonical order are asserted to contain **no**
product references (`V06/FAMILY/NIGHT/CORD/PPL-`) — tests 23/27 enforce globality.

## 3. Verification (live, post-fix)

**Family Money master regenerated** — `swt_master_assemble(1999, 2000)`:
`ok:true · 76,628 bytes · 17 pages · errors:[]`.

| module | class | len | raw `##` | `[[` | route cards | tables |
|---|---|---|---|---|---|---|
| DO — The Real Baby Budget Quiz | checklist→worksheet | 5543 | 0 | 0 | 0 | 3 |
| READ — The One-Number Budget Chart | editorial | 3593 | 0 | 0 | 0 | 3 |
| DECIDE — Buy / Wait / Never List | decision-tree | 4803 | 0 | 0 | **3** | 3 |
| DO — Corner-Shop Cost-Swap Card | worksheet | 1916 | 0 | 0 | 0 | 0 |
| TRACK — 30-Day Use Audit Log | tracker | 2801 | 0 | 0 | 0 | 2 |
| RESCUE — Cart-Delete Loop Rescue | rescue-card | 2225 | 0 | 0 | 0 | 0 |

**Consumer-clean contract, whole document:** `Every Night 0 · [[ 0 · ## 0 · [ ] 0 ·
Postpartum Couple OS 0 · Bad Night Protocol 0`.

**Regression (all HTTP 200):** home · `/solutions/` · `/finder/` · `/my-account/` · `/membership/` ·
FM product (2000) · FM system (1999) · **V06 system (85)**. V06 renders unchanged via its own
path (`74,849` chars, 5 modules); **`ebook-weasyprint.php` (the 24-page golden renderer) was NOT
touched**, so V06 byte-parity is preserved by construction.

**Factory:** master-assembly **33/33** · publisher-fidelity **27/27** · publish-manifest **17/17** ·
globality-invariant **25/25** · qa-checks **157/157** · validate-opportunity **603/603 valid**.

**Snapshots (pre-edit guards):** `20260925-140859` · `-142118` · `-143248` (180 files each).

## 4. Live catalog note (migration finding)

After the migration the live store contains **three** published products: **The One-Number Baby
Budget (2000)**, **Every Night, Just Me (86)**, and **Swiipt Membership (54)**. The wave products
(Cord Care / C-Section / Omugwo / RTWork) and the demo products are no longer present, so the
"second product" parity regression is V06 (unchanged) + FM (corrected).

## 5. Honest limitations / outstanding

1. **No visual pass performed by me.** This session's model cannot read images, so verification is
   **structural** (markup + leak counts + block tables), not pixel-level. The 17 rasterized pages are
   staged for the owner: `wp-content/uploads/swt-stage/fm4-1790346812/page-01..17.jpg`.
   **Owner visual approval of the FM master is the remaining step.**
2. **Decision-tree layout**: the generic interface emits side-by-side verdict leaves via a nested
   table (WeasyPrint handles row layout reliably; the *visual* branch row should be confirmed).
3. **`swt_eb_rosters()` / `swt_eb_fridge()`** still contain V06-specific wording. They are only
   reachable from `schedule-grid` content (roster/fridge assets) — no live product carries one today.
   Flagged, not fixed, to avoid touching V06's roster/fridge rendering.
4. **Directive values with pipes** (e.g. `PHRASE: a | b`) are dropped rather than mapped to the
   rescue card's phrase slot — a content-mapping refinement, not a leak.
5. `[[SCRIPTS]]`/`[[DECISION]]` widget *bodies* are currently flattened to prose + tables by the
   ebook path (the widget-aware renderer lives in `delivery.php`). The markers no longer leak; full
   widget rendering through the master path is a follow-up.

## 6. Success conditions

| Condition | Result |
|---|---|
| Functional mode preserved per asset (DO stays DO) | ✅ (`MODE_COMPONENT`, mode column above) |
| Canonical order derived generically (no product branching) | ✅ (tests 23/27/28; content-detected V06 legacy path only) |
| Transformation wrapper present (cover/identity/contents/roadmap/appendix/colophon) | ✅ |
| Mode → component grammar (worksheet / decision interface / tracker / rescue / editorial) | ✅ |
| No product-specific hardcoding in the composition layer | ✅ (repo tests enforce) |
| Master regenerated | ✅ 76,628 B / 17 pp |
| All pages inspected | ⚠️ structural ✅ / **pixel pass = owner** |
| Regression green (V06 + factory + surfaces) | ✅ |
| Report written | ✅ (this file) |
