# PRODUCT STANDARD
*Factory standards file · derived from MEMORY.md (Product Creation Standard, 10-component template, A–O quality gate), Standard v1 §7–§9, §22, §24, §27; record structure in `schemas/product.schema.json`.*

## 1 · Definition

A product is not the transformation. It is the **delivery system** for the transformation,
assembled from validated transformation + asset records.

## 2 · Product creation standard (ten requirements, in order)

1. **Situation statement** — "When [person] experiencing [situation], struggles with [problem]
   because [constraint], wants [transformation]."
2. **Before → Mechanism → After** — not just information.
3. **Day-by-day sequence** — never a pile of content.
4. **Implementation assets** — worksheets, trackers, decision trees, scripts.
5. **Failure-point system** — normal path, bad day, missed day, resistance, overwhelm, relapse,
   re-entry, escalation.
6. **Rescue protocols** — "When X happens, do Y."
7. **Multi-format delivery** — READ / DO / DECIDE / TRACK / COMMUNICATE / RESCUE (+ RE-ENTER /
   MAINTAIN / REMEMBER per §9). Never PDF-by-default: format follows the customer job.
8. **First win within ~15 minutes.**
9. **Proof of transformation at the end** ("Did your situation actually change?").
10. **Next situation recommendation.**

## 3 · The 11-section contract (every product defines)

01 Identity · 02 Before · 03 After · 04 Mechanism · 05 Path · 06 Assets · 07 Failure system ·
08 First win · 09 TSM · 10 Re-entry/maintenance · 11 Next transformation.

## 4 · Commercial roles (§22 — quality ≠ role)

core | entry | upsell | order_bump | bundle | lead_magnet | bonus | module.
"NOT a standalone product" NEVER means "discarded." Upsells must be natural adjacent needs on the
journey — the journey creates the commercial relationship, never artificial attachment (§23).
Distribution is a deliberate decision (e.g., PP-03 warm-channel only; order-bumps stay attached).

## 5 · Quality gate A–O (15 criteria)

A Situation clarity · B Before/after clarity · C Mechanism · D Implementation · E Sequence ·
F First win · G Failure handling · H Decision support · I Measurement · J Re-entry · K Maintenance
· L Next situation · M Format fit · N Evidence · O Safety.

## 6 · Completion standard (§27)

Completion means: intended actions attempted · system implemented · TSM measured · remaining gap
identified · maintenance plan activated · next situation identified. Reaching the final page is
not completion.

## 7 · Duplicate rule

Two products cannot own the same situation nucleus (see validation-standard §7).

## 8 · Build hygiene

- Products live as structured records (`product.json` valid against schema) inside the product
  directory — nothing to hand-copy.
- Content (landing page, product page, FAQ, specs, deliverables, SEO) is **generated FROM the
  record** by the copy agent, so it cannot drift from the actual transformation.
- Missing TSM, missing required asset, broken purchase/access, incorrect boundary = BLOCKER
  (severity model, §17).

## 9 · One canonical product (global by default)

One Transformation gets **one canonical product family**. The same mechanism in different source
geographies must never become `PRODUCT-{NG,GH,UK,US,CA,EU}`; customer contexts are handled via
**customer-input-first adaptation** (entered currency/prices/income/structure), never
country-assumption. Multiple customers explicitly requesting the same product's contexts is a
Context Adapter on one canonical product — never a duplicate product.
