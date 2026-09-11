# MAE-03 · State Machines

Explicit lifecycle states; no object silently jumps a gate. Transitions are recorded (see Section 9 governance). Red remains stored; Yellow retains restrictions.

## Truth
- **CRF/MIF evidence_status:** `directly_stated` ⇄ `strongly_evidenced` · `analyst_interpretation` · `hypothesis`. (Promotion up is explicit, logged; never silent.)
- **BrandTruth:** `draft → active → superseded` (versioned; old versions preserved).

## Marketing Angle (S3 §3.7, S11 §11.17)
`DRAFT → EVIDENCE_LINKED → VALIDATION_PENDING → GREEN | YELLOW | RED → ARCHITECTED → ACTIVE → RETIRED`
- `RED` stays stored (reason, evidence gap, counter-evidence, future potential).
- `FLAGGED_FOR_RE_VERIFICATION` when upstream evidence changes.
- A Yellow angle was `VALIDATED` but restricted; family inherits scope.

## Angle Validation (S4)
`PENDING → (GREEN | YELLOW | RED)` — terminal per round; a Red returned to Section 3 drafting may re-enter as a new round (history kept).

## Asset (S6/S7/S11)
`BRIEFED → GENERATED → QA_PENDING → (REVISION_REQUIRED | QA_PASSED) → HUMAN_REVIEW? → APPROVED → SCHEDULED → PUBLISHED → RETIRED`
- `REVISION_REQUIRED` re-enters generation (targeted).
- 3 consecutive generation failures → `BRIEF_REVIEW_REQUIRED` (escalation, not just retry).
- `REJECTED` (Gate-5 truth overclaim cannot be auto-fixed) → back to architecture/angle.
- `RE_VERIFICATION_REQUIRED` when upstream changes.

## Media Production (Media-01 §12)
`QUEUED → PREPARING → GENERATING → RENDERED → MEDIA_QA_PENDING → (REVISION_REQUIRED | QA_PASSED) → SECTION_7_QA_PENDING → APPROVED → EXPORTED → (PUBLISHED | ARCHIVED)`
- Provider-bound modalities unavailable → `PRODUCTION_BLOCKED` (image) or `RENDER_PENDING_EXTERNAL_PROVIDER` (video/audio). **Never** `APPROVED`/"complete" when the real file is absent.
- Typographic/Core deterministic renderer → real SVG artifact (raster/PNG/PDF = provider step, marked pending when unconfigured).

## Asset Family (S8 §8.41, S9 §9.38)
`BUILDING → APPROVED | RESTRICTED → ACTIVE → PAUSED → RETIRED` ; plus `RE_VERIFICATION_REQUIRED`.
- Only `APPROVED`, `RESTRICTED`, `ACTIVE` are scheduling-eligible (within scope).
- Angle retired/invalid → all future family scheduling blocked regardless of individual assets.

## Sequence (S10 §10.13)
`DRAFT → QA_PENDING → READY → ACTIVE → PAUSED → COMPLETED → ARCHIVED`

## Campaign (S10 §10.13)
`PLANNING → ASSEMBLED → QA_PENDING → READY → ACTIVE → PAUSED → COMPLETED → ARCHIVED`

## Calendar
`DRAFT → READY → ACTIVE → PAUSED → COMPLETED → ARCHIVED`

## Gap Request
`OPEN → (UPSTREAM_ACTION | RESOLVED | WAIVED)` (Section 10 must not freehand-generate).

## Transition guard
Every transition passes through a guard that checks the prior required gate. Illegal transitions raise `ILLEGAL_TRANSITION`. A retired/Red/draft object cannot enter a schedule. Approval belongs to a specific version, not to an id.
