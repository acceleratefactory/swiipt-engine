# OWNER DECISION PACKAGE — TSM success / cohort threshold
**Product:** PPL-FAMILY-MONEY-001 (The One-Number Baby Budget)
**Transformation:** TR-PPL-FAMILY-MONEY-001
**Gate:** TSM success threshold (product `tsm.cohort_threshold` + transformation `tsm.success_threshold`)
**Status:** PENDING OWNER APPROVAL — the factory must not decide this value.
**Prepared by:** production run (2026-09-23). Nothing below is invented; every existing value is quoted from the canonical records.

## 1. The exact decision required
Approve (or amend) **one** value: the success threshold that defines when this transformation has worked across a cohort.

- `TR-PPL-FAMILY-MONEY-001.tsm.success_threshold` — currently the literal string `PENDING OWNER APPROVAL`.
- `PPL-FAMILY-MONEY-001.tsm.cohort_threshold` — currently the same placeholder.

No other TSM field is open. Everything else below is already canonical.

## 2. What is already canonical (no decision needed)
| Field | Value (verbatim from records) |
|---|---|
| Individual progress metrics (4) | 1. Decision clarity: the household can state one trusted first-year budget number. 2. A completed Buy/Wait/Never classification covering the planned purchases. 3. A documented first-year cost range with source dates. 4. A completed 30-day use audit with resell actions logged. |
| Measurement days | 0, 7, 14, 30 |
| Measurement method | Self-reported log of the budget chart plus a structured check-in against the Day-0 baseline at the scheduled check-ins |
| Before baseline | No first-year budget exists; money disappears into feared purchases and re-added carts while the couple fights over baby spending. |
| Explicit honesty note | Individual metrics measure actual before→after movement — never engagement, pages read, or quiz scores. No scientifically validated threshold exists; none is claimed. |

## 3. Why the threshold is required
- It converts the four individual metrics into a single cohort success statement, without which "the transformation worked" cannot be evaluated.
- It is consumed downstream by the TSM completion logic and by **g9 journey review** (checklist question 15: *"Can the customer recognize completion/success?"* references `tsm.success_criteria` / `tsm.measurement_days`), and it frames the publish manifest's success position.
- Per `standards/transformation-standard.md` §4 and `standards/safety-standard.md` §5, the success threshold is a **business call reserved to the owner**. The runner and the builder are explicitly forbidden from setting it.

## 4. The repository already implies a canonical value (provenance)
Five built transformations use one consistent pattern — **"60%+ of completers meet ≥N of M indicators at Day X review"**:

| Transformation | Success threshold (verbatim) |
|---|---|
| TR-PPL-CORD-CARE-001 | 60%+ of completers meet >=3 of 4 indicators at Day 30 review |
| TR-PPL-CS-FIRST14DAYS-001 | 60%+ completers meet >=3 of 4 indicators at Day 14/30 review |
| TR-PPL-NIGHT-SHIFT-001 | 60%+ of buyers who complete Days 1-14 report meeting the sleep-opportunity-protection and argument-reduction criteria at Day 30 (owner-approved business call) |
| TR-PPL-OMUGWO-TERMS-001 | 60%+ completers meet >=3 of 4 indicators at Day-14 review |
| TR-PPL-RTWORK-OS-001 | 60%+ completers meet >=3 of 4 indicators at Day-15-back review |

Family Money has **four** individual metrics and a **Day 30** final check-in — the same shape as CORD-CARE. The repository therefore implies:

> **Proposed value to confirm or amend: "60%+ of completers meet ≥3 of the 4 stated indicators at Day 30 review."**

This is surfaced for confirmation only. It is **not applied**; the records keep `PENDING OWNER APPROVAL` until the owner states the value.

## 5. Evidence already available
- The four metrics are behavioural and observable (a stated number, a classified list, a dated range, a completed audit) — no engagement or sentiment proxy.
- The measurement method already exists and matches the TSM check-in loop (Day 0 baseline + Day 7/14/30 check-ins).
- The honesty position is explicit: no scientifically validated threshold exists and none is claimed. The threshold is an owner business decision, not an evidence claim.

## 6. What happens under the proposed value (worked example)
At the Day-30 review, take the cohort that began the system:
- If **≥60%** of them meet **≥3 of the 4** indicators → the cohort success condition is met.
- If **<60%** → the transformation is not declared successful for that cohort; the recorded failure modes (cart-delete loop; no trusted number; irregular income) route to their rescue protocols, and the next-action-on-miss applies rather than treating partial adherence as failure.

Nothing about pricing, scope, or safety changes with this value.

## 7. Exact owner action to close the checkpoint
State the threshold (confirm the proposed value, or give your own) and, if you want it recorded formally, authorise the one-line update to:
- `data/transformations/TR-PPL-FAMILY-MONEY-001.json` → `tsm.success_threshold`
- `data/products/PPL-FAMILY-MONEY-001/product.json` → `tsm.cohort_threshold`

Until that is supplied, g9 journey review and publication eligibility remain pending for this TSM item, and no gate is marked PASS for it.
