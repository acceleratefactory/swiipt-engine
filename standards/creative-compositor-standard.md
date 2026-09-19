# Creative Compositor Standard (frozen)

**Status:** FROZEN · the default downstream creative renderer for SWIIPT marketing production.
**Implementation:** `mae/harness/creative-compositor.mjs` (+ `mae/harness/png-decode.mjs`).
**Benchmark product:** `PPL-NIGHT-SHIFT-001` (V06 · "Every Night, Just Me").

---

## 1. Position in the pipeline

```
ASSET PURPOSE + ASSET ARCHITECTURE + VISUAL GROUNDING + PLATFORM / FORMAT
+ TRUTH WEIGHTING + CONTENT ROLE
        ↓
CREATIVE TREATMENT
        ↓
GENERATED VISUAL (where required) + REAL PRODUCT EVIDENCE (where required)
+ DETERMINISTIC TYPOGRAPHY + SWIIPT BRAND COMPOSITION
        ↓
FINAL CREATIVE
```

The compositor runs **after** the approved marketing records exist. It never invents copy,
truth, angles or research. It is an execution layer for an already-approved contract.

## 2. Reusable treatment model

| ID | Treatment | Visual priority |
|---|---|---|
| A | Emotional / Problem Hook | the generated photograph **is** the canvas; navy is only a scrim/text-safe region |
| B | Product / Mechanism Proof | the **real product artifact** dominates (deterministically composited, never model-generated) |
| C | Editorial / Quote / Insight | typography-led; navy **or** cream surface; photography NOT required |
| D | Educational / Carousel | per-panel progression HOOK → EXPLANATION → MECHANISM → SUPPORT → CTA |
| E | Transformation / Outcome | context-grounded outcome scene + restrained copy |
| F | Product / CTA | real product evidence + approved promise + strong CTA |

These are **SWIIPT creative treatments, not product templates**. A future product inherits the
treatment system; it does not inherit V06's content or scenes.

## 3. Treatment selection is data-driven

`selectTreatment(asset, des)` derives the treatment only from generic record fields —
`asset_type`, `asset_purpose`, `family_role`, `weighting_profile.product`, design-spec
`asset_purpose` / `layout_family`:

| Signal | Treatment |
|---|---|
| `SOCIAL_CAROUSEL` / `SOCIAL_STORY_SEQUENCE` | D |
| conversion / product / offer / commerce / cta | F |
| objection (product weight ≥ 20), mechanism / proof / education / decision | B |
| myth / reframe / quote / editorial / insight | C |
| outcome / success / after | E |
| stop_scroll / identification / problem / story / reassurance | A (default) |

Multi-panel assets vary per panel via `slideTreatment(asset, des, index, total)` so a carousel or
story is never N copies of one card.

**Hard rule (§32):** the compositor contains **no** product id, asset id, angle id or design-spec
id, and no product-specific rendering branch. Only V06-specific production drivers and regression
fixtures may reference V06 records.

## 4. Consumer-creative rule

The rendered advertisement carries only:
- SWIIPT branding, and
- approved customer-facing copy (headline / supporting line / CTA / trust line / product name).

It **must never** carry: product ids (`PPL-…`), transformation ids (`TR-…`), asset ids (`AST-…`),
angle ids (`ANG-…`), design-spec ids (`DES-…`), brief/generation/QA ids, internal campaign ids,
internal QA labels (e.g. "Real system page"), or platform labels (FACEBOOK / INSTAGRAM / WHATSAPP).
Platform is production metadata and belongs in filenames, manifests, gallery diagnostics, QA
reports and production records — not on the creative.

Enforced by `mae/harness/audit-v06-consumer-metadata.mjs`, which audits the **rendered text layer**
of every final creative (not filenames).

## 5. Photography rule — ratified as `NO_GENERIC_STOCK_PHOTO`

The design specs' literal `no_stock_photo: true` is interpreted as **no generic stock photography**,
not "no photography".

**Prohibited:** random smiling people · generic motherhood photography · decorative lifestyle
imagery unrelated to the specific situation · interchangeable stock scenes · culturally irrelevant
stock scenes · imagery added merely to make a design look attractive · scenes unsupported by Visual
Grounding.

**Allowed:** context-grounded generated scenes · situation-specific lifestyle scenes ·
human/environmental storytelling required by Treatment A or E · generated environments supporting
Treatment B/F · imagery directly traceable to the approved Visual Grounding Block.

**Enforcement:** `assertSceneGrounded()` — a scene may be used only when its exact prompt (built
from the approved Visual Grounding Block) is archived beside it. Visual Grounding is never weakened.

## 6. Fatal render gates

A render is `RENDERED` only when the required visual communication actually reached the final image.

1. **Pre-render decode gate** — every required visual is decoded in Node (`assertImageDecodable`:
   JPEG SOI/EOI + SOF, or full PNG inflate). A missing/malformed required image throws.
2. **Grounded-scene gate** — every generated scene must carry its archived VGB-derived prompt.
3. **Post-render verification gate** — the rendered document reports `img_ok`, `text_ok`, CTA and
   logo presence, and text bounding-box containment. Only `ok` proceeds to screenshot (unique Edge
   profile + retry).
4. **Objective pixel checks** (`checkCreative`) — flat-navy scaffold detection, scene-region
   coverage for image-led treatments, artifact-detail (luma stddev) for product proof, editorial
   surface + ink, exact dimensions.

Required visuals are inlined as `data:` URIs, so a path/resolve/load failure is structurally
impossible. A blank artifact, a broken image or a navy fallback is a **RENDER FAILURE** — never a
silent placeholder.

## 7. How a new SWIIPT product uses it

1. Production drivers pass the approved records (asset record + design spec + Visual Grounding).
2. Generate scenes through the existing qualified route; archive each exact prompt beside the scene.
3. Call `renderCreative(selectTreatment(asset, des), ctx)` and `shotVerified(...)` per asset.
4. Run the compositor-boundary checks and the marketing/anti-slop gates.
5. Freeze outputs into the product's own asset tree; run the visual regression for that product.

**Future products inherit:** treatment selection · scene/evidence composition principles ·
deterministic typography behaviour · asset-load safety · visual QA behaviour · brand composition.
**Future products do NOT inherit:** V06 content, V06 scenes, V06 product evidence, or V06 copy.

## 8. V06 regression benchmark

V06 is the **visual regression benchmark**, not a design to be copied. It stores production-integrity
and treatment-behaviour expectations (not pixel-perfect appearance):

```
mae/harness/v06-visual-regression.mjs --record    # refresh the benchmark
mae/harness/v06-visual-regression.mjs             # verify current campaign
```

A future compositor change is safe when the regression still passes; a broken scene, a missing
artifact, a navy fallback or a changed treatment fails it. Legitimate creative evolution is
tolerated by design.

**Automated QA verifies production integrity. Owner visual review verifies aesthetic acceptance.
These are distinct, and QA never claims "professional", "beautiful" or "owner-approved".**
