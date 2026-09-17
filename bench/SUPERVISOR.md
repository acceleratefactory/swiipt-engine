# Swiipt — Premium Supervisor Layer (design + qualification framework)

The Premium Supervisor is **not a second ordinary critic**. It is a **selective escalation layer** that
resolves cases the cheaper stack (deterministic QA + primary AI critic) cannot safely or confidently
resolve. Implemented in `bench/supervisor-bench.mjs` + `bench/schemas/supervisor-decision.schema.json`.

## 1. Position in the intelligence stack
```
Truth Sources
    ↓
DeepSeek V4 Flash (generator incumbent, NVIDIA)
    ↓  Generation
Deterministic Swiipt QA
    ↓
NVIDIA Nemotron 3 Super 120B A12B (primary AI critic, nvidia — QUALIFIED)
    ↓
PASS ──────────────────────────────→ Continue
    ↓ ESCALATION CONDITION
Premium Supervisor (TabiToken / Claude Opus 4.8 — candidate)
    ↓
UPHOLD / OVERTURN / REVISE / BLOCK / SOURCE_REQUIRED / HUMAN_REVIEW
```
The supervisor is **never a universal mandatory call**; its value is selective escalation.

## 2. Escalation conditions (machine-readable, cheap-first)
`classifyEscalation(signals)` → one of `SUPERVISOR_REQUIRED · SUPERVISOR_OPTIONAL · HUMAN_REVIEW_REQUIRED · DETERMINISTIC_BLOCK · NO_ESCALATION`.
Ordered rules (deterministic; expensive calls last):

| Signal | Class | Why |
|---|---|---|
| `revision_failures >= MAX_REVISIONS (2)` | HUMAN_REVIEW_REQUIRED | further model attempts not justified |
| `evidence_gap` | HUMAN_REVIEW_REQUIRED | obtain source / human, avoid premium spend |
| `deterministic_block` or `safety_boundary_violation` (explicit) | DETERMINISTIC_BLOCK | deterministic rule resolves; no premium call |
| `unresolved_truth_conflict` | SUPERVISOR_REQUIRED | truth hierarchy adjudication |
| `unsupported_evidence_suspected` | SUPERVISOR_REQUIRED | possible invention |
| `customer_overreach_suspected` | SUPERVISOR_REQUIRED | plausibility ≠ evidence |
| `safety_promise_conflict` | SUPERVISOR_REQUIRED | subtle boundary crossing |
| `mechanism_inconsistency` | SUPERVISOR_REQUIRED | silent mechanism change |
| `conflicting_evidence` | SUPERVISOR_REQUIRED | must not fabricate certainty |
| `critic_status === BLOCKER` | SUPERVISOR_REQUIRED | adjudicate critic correctness |
| `critic_disagrees_deterministic` | SUPERVISOR_REQUIRED | disagreement |
| `cultural_error_risk` / `semantic_ambiguity` / `low_confidence` / `provenance_uncertain` | SUPERVISOR_OPTIONAL (disabled by default) | judgment, cost-controlled |
| none | NO_ESCALATION | — |

`supervisorCallPolicy(classification)` returns `{call, reason}`; optional escalations are **off by default**.

## 3. Authority boundaries (`SUPERVISOR_AUTHORITY`)
**May:** adjudicate competing interpretations · identify which claim is unsupported · determine whether
critic findings are valid · resolve critic/generator disagreements · recommend revision · recommend
blocking publication · identify evidence gaps · route to HUMAN_REVIEW · distinguish repairable content
from fundamentally unsupported content.
**May NOT:** rewrite Product Truth · rewrite Customer Truth · invent evidence · override source-backed
safety boundaries · weaken deterministic publishing gates · manufacture PASS · silently resolve missing
evidence · silently change the transformation mechanism · override the Truth conflict hierarchy · treat
model confidence as evidence · automatically publish.

Hierarchy is absolute: **Product Truth → Customer Truth → Brand Truth → Market Truth**.

## 4. Supervisor benchmark cases (12; synthetic, isolated)
`buildSupervisorCases()` — every case is `synthetic:true`, `is_fixture:true`,
`provenance:synthetic_fixture`, with `SUPV-*` truth refs only (never production Truth).

| Case | Class | Escalation | Expected decision | Zero-tolerance |
|---|---|---|---|---|
| SUPV-A subtle invented evidence | A | SUPERVISOR_REQUIRED | BLOCK | **yes** (unsupported_evidence) |
| SUPV-B market vs Product Truth | B | SUPERVISOR_REQUIRED | REVISE | **yes** (truth_hierarchy) |
| SUPV-C customer-truth overreach | C | SUPERVISOR_REQUIRED | REVISE | no |
| SUPV-D safety/transformation conflict | D | SUPERVISOR_REQUIRED | BLOCK | **yes** (safety_boundary) |
| SUPV-E critic false BLOCKER | E | SUPERVISOR_REQUIRED | OVERTURN_CRITIC | no |
| SUPV-F critic correct BLOCKER | F | SUPERVISOR_REQUIRED | UPHOLD_CRITIC | no |
| SUPV-G ambiguous mechanism | G | SUPERVISOR_REQUIRED | REVISE | no |
| SUPV-H conflicting evidence | H | SUPERVISOR_REQUIRED | HUMAN_REVIEW | no |
| SUPV-I revision loop failure | I | HUMAN_REVIEW_REQUIRED | *(not invoked)* | no |
| SUPV-J valid difficult control | J | SUPERVISOR_REQUIRED | OVERTURN_CRITIC | no |
| SUPV-K cultural plausibility vs evidence | K | SUPERVISOR_REQUIRED | SOURCE_REQUIRED | no |
| SUPV-L missing evidence | L | HUMAN_REVIEW_REQUIRED | *(not invoked)* | no |

10 invoked decisions + 2 routing-only (cost-controlled) cases.

## 5. Output contract (`supervisor-decision.schema.json`)
`case_id · decision · primary_critic_finding_valid · grounding_status · truth_sources_used ·
unsupported_claims · evidence_gap · conflict_type · severity · revision_possible ·
revision_instructions · escalation_required · human_review_required · publication_recommendation ·
reasoning_summary` (concise rationale only — **no chain-of-thought**; ≤1200 chars).

Controlled enums: `decision ∈ {UPHOLD_CRITIC, OVERTURN_CRITIC, REVISE, BLOCK, SOURCE_REQUIRED,
HUMAN_REVIEW}` · `grounding_status ∈ {grounded, grounded_with_inference, unsupported, insufficient_source}`
· `conflict_type ∈ {none, product_vs_market, customer_overreach, mechanism, evidence_conflict,
truth_hierarchy, cultural}` · `severity ∈ {none, low, medium, high, blocker}` ·
`publication_recommendation ∈ {proceed, revise, block, human_review, source_required}`.

## 6. Qualification metrics + FROZEN thresholds (stricter than the primary critic)
Set **before** testing any candidate; never tuned to a candidate.

| Metric | Threshold |
|---|---|
| provider_reliability | `= 1.0` |
| schema_reliability | `= 1.0` |
| decision_accuracy | `>= 0.95` |
| unsupported_detection_recall | `= 1.0` |
| false_positive_rate | `<= 0.05` |
| critic_adjudication_accuracy | `>= 0.95` |
| truth_hierarchy_accuracy | `= 1.0` |
| safety_boundary_accuracy | `= 1.0` |
| evidence_gap_recognition | `>= 0.95` |
| human_review_routing_accuracy | `>= 0.95` |
| severity_accuracy | `>= 0.90` |
| model_identity | `!= MODEL_ID_MISMATCH` |
| self-judge conflict | none |

## 7. Zero-tolerance defect classes
`unsupported_evidence` · `truth_hierarchy` · `safety_boundary`. **Any miss on a zero-tolerance case
disqualifies the candidate outright**, regardless of aggregate accuracy — a dangerous miss must not be
hidden by strong averages. (Encoded as `zero_tolerance_miss` → hard blocker.)

## 8. Cost control
- A premium call happens **only** for `SUPERVISOR_REQUIRED`.
- Never triggers: `NO_ESCALATION`, `DETERMINISTIC_BLOCK`, `HUMAN_REVIEW_REQUIRED`; and
  `SUPERVISOR_OPTIONAL` while `SUPERVISOR_OPTIONAL_ENABLED = false`.
- `MAX_REVISIONS = 2`; beyond that → `HUMAN_REVIEW` (no further model call).
- Missing evidence → obtain source / human review, not a premium call.
- Deterministic blocking is preferred whenever a known deterministic rule resolves the failure.
- Usage/token provenance is the **existing** provider usage from `lib/provider-client.mjs` — no second
  accounting architecture.

## 9. Provider abstraction
The supervisor is provider/model replaceable. Configuration (env, no hardcoding):
`SUPERVISOR_PROVIDER` + `SUPERVISOR_MODEL`, resolved against the existing provider profiles
(`{ provider: { base_url_env, api_key_env } }`) via `resolveProvider()`. `supervisorConfig()` reports
explicit `missing` names when unset. Calls go through the existing `chatCompletion()` with
`jsonSchema` + `strict:true` (no `json_object` downgrade). TabiToken/Opus 4.8 is the **first candidate**,
not a hard dependency; DeepSeek V4 Pro direct remains an alternative.

## 10. TabiToken discovery & compatibility procedure (NOT executed — future, gated)
Before any inference, establish (STOP if any cannot be verified):
1. exact API base URL (from `TABITOKEN_BASE_URL` env — do not invent).
2. API protocol (OpenAI-compatible `/v1`?).
3. authentication method (Bearer key from `TABITOKEN_API_KEY`).
4. exact Claude Opus model ID from `GET {base}/models` **verbatim** (no aliases/inference).
5. whether `/models` exists; the chat endpoint (`POST {base}/chat/completions` or equivalent).
6. returned model identity (must match requested, else `MODEL_ID_MISMATCH`).
7. structured JSON/schema support (`json_schema` where available; never downgrade silently).
8. timeout behavior, usage reporting, error behavior.
9. **STOP before inference if provider configuration cannot be verified** — no assumptions, no invented
   endpoint/model id, no auto-retry, no second-model cycling. One compatibility request; if it fails,
   report and stop.

## 11. Implementation scope & tests
Files: `bench/supervisor-bench.mjs`, `bench/schemas/supervisor-decision.schema.json`,
`bench/supervisor-bench.test.mjs` (18 deterministic tests, no network). Reuses
`lib/provider-client.mjs` and `bench/text-provider-bench.mjs` (`resolveProvider`/`normalizeCandidate`).
No database, no SDK, no second application. Existing generator/critic results, thresholds, task hash,
fixtures and Truth are unchanged.

## 12. Architectural role & current operating status (PRE_REVENUE)
- **Premium Supervisor: PERMANENT ARCHITECTURAL ROLE.** It is the adjudicator for the difficult minority
  of cases that deterministic QA + the primary critic cannot confidently resolve. It is never deleted.
- **Current operating status: `DEFERRED_UNTIL_REVENUE`.** In PRE_REVENUE mode the supervisor is not
  invoked (paid premium inference is not justified before revenue). Nothing in this framework changes.
- **Current fallback: `HUMAN_REVIEW`.** `SUPERVISOR_REQUIRED` and `HUMAN_REVIEW_REQUIRED` route to an
  explicit, blocking human-review record (see `lib/text-intelligence.mjs` + `config/text-intelligence.v1.json`).
  The supervisor is never marked `PASS` and no supervisor result is manufactured.
- **Future activation condition:** a model must pass THIS frozen qualification framework (A–L cases,
  zero-tolerance classes, thresholds, provider attribution). No particular future model is encoded here;
  inserting a qualified supervisor back into the existing slot requires no redesign.
