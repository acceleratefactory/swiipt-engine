# QA STANDARD
*Factory standards file · derived from Standard v1 §13–§17 (acceptance tests, output format, severity model), pipeline.md §18–§19 (deterministic-vs-AI split, machine gate).*

## 1 · Two test classes — neither replaces the other

- **Deterministic tests:** a machine checks them. Never ask an LLM to check what code can check.
- **AI judgment tests:** a model evaluates against these standards.

## 2 · Deterministic checklist (every product)

**Schema:** product.json valid · transformation.json valid · manifest valid · no missing required
fields · no duplicate IDs · no invalid relationships · version valid.
**Content:** landing page, product page, specs, deliverables exist · FAQ where required ·
onboarding exists · completion exists · next transformation exists or explicit "none yet" reason.
**Assets:** every declared asset exists · no orphan critical assets · links resolve · downloads
resolve · media references exist.
**Build:** builds clean · tests pass · lint passes · type checks pass · no blocking console errors ·
no broken routes.
**UX:** responsive breakpoints pass · keyboard navigation works · form validation works · error /
loading / empty states exist.
**Accessibility:** semantic headings · labels for inputs · keyboard operation · sufficient
contrast · focus visibility · alt text · no color-only meaning · appropriate ARIA.
**Commerce:** price exists · currency mapping exists (USD base + manual per-currency prices) ·
product correctly linked · access entitlement works · purchase flow works · correct product
delivered · upsell/bundle relationships correct.
**Platform:** transformation relationship exists · situation relationship exists · journey
relationship exists · next-transformation edge resolves.

## 3 · AI tests A–R (independent reviewer; Test R mandatory every round)

A Situation integrity · B Scope integrity · C Transformation integrity · D Mechanism integrity ·
E Action integrity · F Sequence integrity · G First-win integrity · H Failure integrity ·
I Rescue integrity · J TSM integrity · K Evidence integrity · L Safety integrity · M Format
integrity · N Emotional integrity · O Journey integrity · P Ecosystem integrity · Q Copy
integrity · **R Drift integrity** (did the product change its situation definition while keeping
its name? — this exact failure was caught in PP-01/PP-02B/PP-02/PP-03 reviews).

## 4 · Severity model

| Severity | Meaning |
|---|---|
| BLOCKER | Cannot publish: unsafe clinical claim · missing transformation/TSM · broken purchase/access · incorrect boundary · missing required asset · invalid manifest · evidence failure · major scope drift |
| MAJOR | Must be corrected before publish |
| MINOR | Queue for post-launch if it does not affect transformation, safety, commerce or trust |
| OBSERVATION | No correction required |

## 5 · Reviewer output format (structured, §16)

`overall_status: PASS | FAIL | REVISION_REQUIRED`, per-test status/severity/reason/evidence,
blocking_issues, non_blocking_issues, scope_drift, safety_issues, required_changes.

## 6 · Independence rules

The reviewer evaluates independently from the builder. **The builder does not get to
self-approve.** The AI cannot override a safety gate. QA results are written into the product
record (`qa.deterministic_tests`, `qa.ai_tests`, `qa.gate_results`) and only an all-PASS state
produces a publish manifest.
