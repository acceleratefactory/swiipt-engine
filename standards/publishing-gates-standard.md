# PUBLISHING GATES STANDARD
*Factory standards file · derived from Standard v1 section 18 (state machine), section 19 (gates 0-10), section 20 (publish manifest), section 21 (human authority); record structure in `schemas/publish-manifest.schema.json`.*

## 1 - State machine (section 18)

```
RESEARCH -> CANDIDATE -> TRANSFORMATION_VALIDATED -> PRODUCT_SELECTED ->
SPECIFIED -> CONTENT_READY -> BUILT -> DETERMINISTIC_QA -> AI_QA ->
SAFETY_EVIDENCE_REVIEW -> COMMERCE_QA -> CUSTOMER_JOURNEY_TEST ->
READY_TO_PUBLISH -> PUBLISHED -> MONITORED
```

- A product may move BACKWARD at any time (e.g. AI_QA -> SPECIFIED when drift is discovered).
- **No state transition may be inferred from the existence of files alone** - states are written
  into records explicitly.

## 2 - Gates 0-10 (section 19)

| Gate | Question / requirement | FAIL means |
|---|---|---|
| 0 Research disposition | Which of the 13 library roles? No unclassified research proceeds | no progression |
| 1 Situation | exact person · situation · timeframe/life state · trigger · problem · failed attempt/constraint · emotional stake · desired transformation | no transformation build |
| 2 Transformation | before · after · mechanism · action path · evidence of change · safety boundary | no product specification |
| 3 Product architecture | role · asset map · customer path · first win · failure map · rescue system · TSM · re-entry · maintenance · next transformation | no build |
| 4 Evidence | every claim labeled sourced/expert-reviewed/lived-experience/model-inference/hypothesis; clinical facts never invented | no publish |
| 5 Safety | scope boundaries · disclaimers · red flags · escalation routes · no diagnosis · no unsupported medical promises | no publish |
| 6 Content | customer jobs (READ/DO/DECIDE/TRACK/COMMUNICATE/RESCUE/RE-ENTRY/MAINTENANCE) covered by existing formats - only jobs the transformation requires | revision |
| 7 Product QA | all deterministic + AI acceptance tests pass | revision |
| 8 Commerce | price · product record · access entitlement · payment · delivery · downloads/tools · upsells · bundle relationships | no publish |
| 9 Customer journey | REAL walk-through: discover -> landing -> purchase -> access -> onboarding -> first win -> path -> completion -> TSM check-in -> next transformation. Technical integrity test, NOT an MVP experiment | no publish |
| 10 Publish | only a product with all required gates passed receives READY_TO_PUBLISH; publisher consumes the immutable manifest | stays queued |

## 3 - Manifest rule (section 20)

The publisher never infers missing product information. It accepts only a manifest valid against
`schemas/publish-manifest.schema.json`: all five QA verdicts (`deterministic`, `ai`, `safety`,
`commerce`, `journey`) must be `PASS`, `publish_authorization.status` must be `READY_TO_PUBLISH`,
and a named human authorizer recorded. **If any required gate is not PASS, the publisher refuses
publication** - and can never repair an incomplete product itself.

## 4 - Human authority (section 21)

Automation eliminates manual labour, never human governance. Humans retain: transformation
boundary · high-risk medical/safety approval · major claims · pricing strategy · brand-level
exceptions · publication override in exceptional cases.
