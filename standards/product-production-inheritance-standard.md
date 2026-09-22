# SWIIPT Product Production Inheritance Standard

Status: **active** · Scope: how ANY approved SWIIPT Transformation/Product is produced without
product-specific production code or manual visual redesign.
Companion authorities: `mae/data/brand-truth.json` (brand), `mae/harness/design-authority.mjs`
(machine-readable projection), `asset design/style.css` (locked customer-product design system),
`asset design/swiipt-brand-assets/` (official brand kit), `Swiipt-Marketing-Visual-System.pdf`.

> The PDFs are the human authority. The machine-readable projection is the implementation of the
> rules. If they ever disagree, the PDF wins and the projection is corrected.

---

## 1. Authority hierarchy

1. **Brand authority** — `asset design/swiipt-brand-assets/04-brand-guide/swiipt-brand-quick-reference.pdf`
   ("Quiet Intelligence"): colour tokens, Transformation Mark, typography, iconography, callout
   semantics, prohibited treatments, favicon/app-icon.
2. **Customer-product design authority** — the approved product design references (Doctor Visit
   Brief etc.) + `asset design/style.css`. **LOCKED. Never redesigned.**
3. **Marketing visual authority** — `Swiipt-Marketing-Visual-System.pdf` ("Visual Interchangeability
   Standard v1.0"): two visual modes, Grounding Element Rule, typography conventions, intensity
   mapping, the 6-component library, platform fitness, the 8-gate Visual QA.
4. **V06** — the known-good production/marketing/organic/export **regression benchmark**, not an
   authority that may replace 1–3.

Conflict rule: on any conflict, the locked authority wins; the conflict is recorded, never silently
resolved.

## 2. Required upstream inputs (what the owner supplies — data, not code)

Per product, the following must exist before a production run:

| Input | Location | Notes |
|---|---|---|
| Transformation record | `data/transformations/<TR-id>.json` | situation, before, after, mechanism, failure points, first win, TSM, safety — owner/validator approved |
| Product record | `data/products/<PPL-id>/product.json` | identity, customer, design (components), asset_map, commerce (+per-currency price), safety, generation.voice |
| Marketing Angle Record(s) | validated angle set | one per asset; every asset traces to exactly one |
| Visual Grounding Block | derived from the angle | person/environment/situation truth for generated imagery |
| Evidence | product/transformation evidence block | claims carry a status (`sourced_evidence`/`model_inference`/`hypothesis`) |
| Prices | `commerce.price` (per currency) | owner business call — required for the commerce/CTA contract |
| TSM success threshold | transformation/product TSM | owner-approved; never auto-set |
| Gate results + publish authorization | `qa.gate_results` + `publishing.authorization` | gates 0–10 + a named human authorizer |

**If any is missing the run STOPs and reports it.** The factory never invents an upstream decision.

## 3. Generic production (the code — never per product)

| Stage | Generic module | Reuses |
|---|---|---|
| Design authority | `mae/harness/design-authority.mjs` | brand-truth + style.css + brand kit |
| Creative composition (A–F) | `mae/harness/creative-compositor.mjs` | design authority |
| Marketing components | `mae/harness/marketing-components.mjs` | compositor + design authority |
| Brand continuity QA | `mae/harness/brand-continuity-qa.mjs` | design authority |
| Organic media | `mae/harness/organic-media.mjs` | compositor + design authority |
| Final export | `mae/harness/export-final-campaign.mjs` | campaign ledger + `_packages.json` |

A product supplies **data + config only**. No product id, product name or situation string may be a
required assumption in these modules (enforced by `zero-v06-audit.mjs`).

## 4. Locked customer-product design

The purchased product renders through the **existing** design system (`asset design/style.css`) and
the approved product-design components. Inheritance centralizes only what is necessary — tokens,
typography roles, callout treatments, table/printable framing, logo variants — and does not alter
the approved appearance. Themed product/ebook generation goes through the locked pipeline (the
WeasyPrint renderer); the generic factory does not redesign it.

## 5. Marketing inheritance

`ANGLE / PURPOSE → A–F treatment + intensity + visual mode + grounding element + brand tokens +
product evidence → FINAL CREATIVE.`
- Intensity mapping controls colour behaviour only — it never collapses into four rigid layouts.
- The Grounding Element Rule is enforced and machine-checkable (`data-swt-grounding`); it is
  distinct from Visual Grounding.
- The 6-component library (Hook Graphic, Quote Card, Situation Timeline, Angle Record Card, OG
  Share Image, Carousel Slide) is produced on request; counts come from the campaign spec, never
  from V06.

## 6. Organic-media inheritance

Platform contracts (`ORGANIC_CONTRACTS`) are keyed by package **type** (LONG_FORM, SHORT,
SHORT_VERTICAL, PIN, EMAIL) — not by product. Thumbnails (1280×720) and Pins (1000×1500) render
through the frozen verified pipeline. Video is **truthful-pending**: packages ship complete with a
`VIDEO-STATUS.txt` and no fake MP4; when rendered, the MP4 drops into the same folder.

## 7. Platform contracts (centralized)

Square 1080×1080 (text out of the bottom 12%) · vertical 1080×1920 (top 250 / bottom 350 occluded;
hook + CTA inside the middle 1320) · FB/OG 1200×630 · carousel first slide works with zero swipe,
last slide is the CTA · email header 1200×400. Minimum text 60 px @1080 (message text); minimum
contrast 4.5:1. Machine-checked by `brand-continuity-qa.mjs`.

## 8. Evidence / artifacts

Real product artifacts (worksheet, tracker, checklist, decision tool, printable, card, table) are
composed **as-is**; their locked visual integrity is preserved. Presentation modes (flat, phone,
tablet, printed, hand-held, environment, workbook spread, close-up, bundle) are generic; product
data identifies the artifact.

## 9. QA (do not weaken)

`qa-checks` · `validate-opportunity` · `writing-control` · `publish-manifest` · `audit-consumer-copy`
· `audit-v06-consumer-metadata` · `v06-visual-regression` · `social-*` · `design-inheritance`
(design-authority compliance, brand continuity, synthetic fixture, zero-V06 audit).

## 10. Final export

The exporter discovers assets from the campaign ledger and maps each to a FINAL destination from
its own `(platform, asset_type)`. Counts and expectations are derived from the ledger +
`_packages.json`; nothing platform- or product-specific is hardcoded. FINAL contains finished media
+ exact approved copy/prompts only.

## 11. Video pending

No placeholder or empty MP4 is ever created. Video packages carry their exact prompt, script and
truthful status.

## 12. Future-product entry (one path)

1. Ensure the **§2 upstream inputs** exist and are approved.
2. Run the generic production modules (§3) — no new production code.
3. Run the QA suite (§9). A product with no per-product code and no manual visual redesign is the
   target state.
4. Export (§10).

`node mae/harness/design-inheritance.test.mjs` + `node mae/harness/family-money-structural-dryrun.mjs`
are the readiness gates for a new product.
