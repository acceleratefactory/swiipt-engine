# Report on the 4 Product Spec Sheets (PP-01 / PP-02 / PP-02B / PP-03)

> What they document, what to learn from them, and what you (the owner) need to do next.
> Date: 2026-08-19 · Source: AGENTS.md + implementation-plan-wordpress-v2.0.md + live site check

---

## 1. What these 4 files ARE

They are **6.1 spec sheets** — one per product in your validated build set — written to the
11-section template from `Product creation guideline.md`, using `product2.md` (the validated build
set) as source material. Each spec is a **blueprint that has already pinned every engineering
decision**, so the only variable left open is **your content**.

| Spec | Product | Core situation | Character notes |
|---|---|---|---|
| PP-01 | *Is This Normal?* (Postpartum Reality Reorientation) | "Is my body healing right?" / "Why am I crying?" / overwhelmed / partner strain | Flipbook magazine; 4 entry doors (A1/A2/B4/C5) → 1 transformation; flagship |
| PP-02 | *New-Body Closet* (Body Recovery & Wardrobe System) | Body changed, nothing fits, scar/scar-care anxiety, body-image grief | Flipbook magazine; upsells into PP-02B |
| PP-02B | *3-Week Notice* (Return-to-Work / Routine Reset) | Leave ending, routine collapse, childcare worry, work anxiety | Flipbook optional (functional-first OK); upsell / order-bump of PP-02 |
| PP-03 | *Quiet Leak* (Bladder / Pelvic-Floor Confidence) | Leaks on laugh/sneeze/run, avoidance, shame, silence | **Functional-first PDF/html — NOT a flipbook**; sensitive warm-channel; **safety-critical** |

### Already live on swiipt.com

These products were ingested in Phase 6.5 and exist on the live site with placeholder content:

| Product | Woo product | Transformation System | Transformation |
|---|---|---|---|
| PP-01 Is This Normal? | #71 | #70 | #69 |
| PP-02 New-Body Closet | #74 | #73 | #72 |
| PP-02B 3-Week Notice | #77 | #76 | #75 |
| PP-03 Quiet Leak | #80 | #79 | #78 |

Each is linked via `swt_link_product_transformation` (so a completed purchase grants system access —
verified), has default 4-format assets generated (Read→flipbook for PP-01/02; PP-03 functional-first),
and carries **placeholder prices** (PP-01/02/03 = $29 / ₦45,000 / €27 / GH₵450; PP-02B upsell =
$19 / ₦29,000 / €18 / GH₵290). The specs are the recipe for replacing that placeholder with the real thing.

---

## 2. What to LEARN from them

### a) The 11-section discipline — each section drives a live engine feature

The sections are not marketing fluff. Every section maps to something the engine already does:

| Section | Content | Engine feature it feeds |
|---|---|---|
| 01 Identity | Situation, problem, target person, constraints, desired transformation | `swiipt_trans` CPT + routing via situation graph / `swt_ai_navigate` |
| 02 Before state | What she experiences/does/emotions now | Journey graph context; AI navigator empathy; marketing copy source |
| 03 After state | What she can now do / reduce / evidence | TSM definition; outcome-evidence rows |
| 04 Mechanism | Why the transformation works (M1–M4) | System logic; makes the product defensible |
| 05 Path | Step sequence | Delivery system steps; `swt_progress_records` |
| 06 Asset map | READ / DO / DECIDE / COMMUNICATE / TRACK / RECOVER | Delivery generator → flipbook / pdf / html / svg poster / txt transcript |
| 07 Failure-point map | What breaks + rescue plan | RECOVER asset (reset cards); check-in nudges; no-guilt re-entry |
| 08 First win | 15-minute win inside the product | Onboarding; D0 check-in experience |
| 09 TSM | Success indicators + checkin days | `swiipt_tsm_definitions` → auto-scheduled D0/7/14/30 check-ins |
| 10 Re-entry / maintenance | What happens on relapse/restart | Re-entry protocol; forgiveness model |
| 11 Next transformation | What comes after | Situation-graph journey edge → natural cross-sell slot (PP-02 → PP-02B) |

### b) The A–O quality gate is the publish checklist

Every spec ends with `A✓ B✓ … M✓ N[pending] O✓`. Gates A–M (situation, before/after, mechanism,
implementation, sequence, first win, failure, decision, measurement, re-entry, maintenance, next,
format-fit) are **already engineered/passed**. **Gate N (evidence) is the single gate blocking all
four products, and only you can clear it.** Gate O (safety) is engineering-complete but PP-03 needs
your safety copy.

### c) The locked philosophy is already enforced in each spec

- The unit is the **situation**, not the product. Many entry doors (PP-01: A1/A2/B4/C5; PP-03:
  B1-A/B/C/D) funnel into ONE transformation record.
- The sale happens via the journey's "next transformation" slot (PP-02 → PP-02B), never via
  product-first upsell mechanics.
- Honest claims: evidence labels site-wide, no promised outcomes, signposting to professional care.

### d) The design split between products is deliberate

- **PP-01 / PP-02 = flipbook magazines** (beautiful, scannable, swipeable — the `[swiipt_system_details]`
  + flipbook pipeline is built and verified for these).
- **PP-03 = functional-first** (plain PDF/html, private, warm-channel — because a beautiful magazine
  about bladder leaks is the wrong tone; function beats beauty here).
- **PP-02B = upsell extension** — cheaper (set lower), linked as order-bump / cross-sell from PP-02.

---

## 3. What YOU should do next (the 5 open workstreams)

Everything marked `[OWNER INPUT REQUIRED]` across the specs collapses into five streams:

### Workstream 1 — Evidence label (blocks Gate N, all 4 products)
Decide the evidence label wording per product, e.g.:
> "Educational and lived-experience based. Not a substitute for clinical assessment."

/education / lived-experience / expert-reviewed — pick per product. Without this the A–O gate stays
`N[pending]` and technically nothing should launch.

### Workstream 2 — Safety / clinical copy (PP-03 first, then PP-01)
- **PP-03 (highest priority):** pelvic-floor claims need clinical sourcing OR an explicit
  "see a pelvic-health physiotherapist / provider if pain, worsening, or no improvement by X weeks"
  escalation + red-flag list (blood, pain, fever) written into the DECIDE asset.
- **PP-01:** any medical claims (bleeding timelines, fever thresholds, mood red-flags) need SRC/
  clinical sourcing for the triage card (red/amber/green). This is the safety backbone of PP-01.

### Workstream 3 — The actual asset content (§06 of each spec)
The body of each product. For each: magazine pages / guide copy, checklists & worksheets, triage
& decision trees, scripts (partner / provider / caregiver), trackers (14-day logs), reset cards.
The delivery engine converts whatever you hand me into flipbook / pdf / html / svg / txt
automatically — you supply the words, the engine supplies the formats.

### Workstream 4 — TSM success criteria + checkin days (§09 of each spec)
Specs suggest `checkin_days = 0, 7, 14, 30` (confirm) and give draft indicators. Write the final
success-criteria copy. This drives the check-in scheduler and the "did it work?" evidence loop.

### Workstream 5 — Real per-currency prices
Replace placeholders. Current values:
- PP-01/02/03: USD $29 · NGN ₦45,000 · EUR €27 · GHS GH₵450
- PP-02B: USD $19 · NGN ₦29,000 · EUR €18 · GH₵290
Edit via the `_swiipt_prices` metabox on each product (geo display verified: NG→₦, GH→GH₵, EU→€, rest→$).

---

## 4. Recommended sequencing

Supply content **one product at a time**, in this order:

1. **PP-01 first** — flagship, m01 beachhead, simplest safety story, unlocks the trip-check for the whole library.
2. **PP-02** — same beachhead, rides PP-01's momentum.
3. **PP-02B** — small upsell extension; quick after PP-02 patterns exist.
4. **PP-03 last** — carries the heaviest clinical/safety review load.

For each product the flow is: you hand me content → I ingest into live assets, TSM meta, evidence
label, prices → you do a real purchase test → Gate N clears → launch.

---

## 5. One-line summary

> The 4 specs are complete engineering blueprints with one missing ingredient: **your voice**.
> The engine (delivery, pricing, purchase→access, check-ins, evidence, navigation) is built,
> linked, and verified. Fill the `[OWNER INPUT REQUIRED]` slots and the products become real.
