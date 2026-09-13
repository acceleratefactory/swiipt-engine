# SWIIPT TEXT INTELLIGENCE STACK — PRE-REVENUE

Canonical operating-mode document. This is an **OPERATING MODE change**, not an architecture redesign.
The Premium Supervisor has **not been removed**: it remains the permanent adjudication layer for the
difficult minority of cases. In PRE_REVENUE mode its invocations are replaced by **HUMAN_REVIEW**.

## Architecture

```
Generator  (DeepSeek V4 Flash · ACTIVE INCUMBENT)
    ↓
Deterministic QA  (truth · schema · evidence/provenance · safety · acceptance · writing controls · transformation QA · publishing gates · AUTHORITATIVE)
    ↓
Primary Critic  (xKiro Mistral Large 2512 · QUALIFIED)
    ↓
Escalation
    NO_ESCALATION          → continue
    DETERMINISTIC_BLOCK    → block
    SUPERVISOR_OPTIONAL    → existing policy → HUMAN_REVIEW where unresolved/risk-sensitive
    SUPERVISOR_REQUIRED    → HUMAN_REVIEW   (PRE_REVENUE)
    HUMAN_REVIEW_REQUIRED  → HUMAN_REVIEW
    ↓
Premium Supervisor  (DEFERRED UNTIL REVENUE · fallback: HUMAN_REVIEW)
```

```
Generator
   ↓
Deterministic QA
   ↓
Mistral Critic
   ↓
┌──────────────────────────────┐
│                              │
CLEAN PASS              UNRESOLVED / RISKY
│                              │
Continue                 HUMAN_REVIEW
```

> The Premium Supervisor has not been removed. It remains the permanent adjudication layer for difficult
> cases. In PRE_REVENUE operating mode, cases that require the Premium Supervisor are routed to
> HUMAN_REVIEW. Once revenue justifies paid inference, a candidate must pass the frozen Premium
> Supervisor qualification framework before activation.

## Component status

| Component | Value | Status |
|---|---|---|
| Generator | `nvidia / deepseek-ai/deepseek-v4-flash-0731` | **ACTIVE_INCUMBENT** (incumbent, *not* permanently qualified) |
| Deterministic system | truth, schema, evidence/provenance, safety, acceptance, writing controls, transformation QA, publishing gates | **AUTHORITATIVE** |
| Primary critic | `xkiro / mistralai/mistral-large-2512` | **QUALIFIED_PRIMARY_CRITIC** (known limitation: missed one invented-evidence case; mitigated by deterministic evidence/provenance) |
| Premium supervisor | permanent architectural role | **DEFERRED_UNTIL_REVENUE** · fallback **HUMAN_REVIEW** · qualification **UNFILLED** |

## Machine-readable configuration
`config/text-intelligence.v1.json` (validated by `schemas/text-intelligence.schema.json`). No API keys.

## Routing behaviour (deterministic — `lib/text-intelligence.mjs`)
| Classification | PRE_REVENUE action |
|---|---|
| `NO_ESCALATION` | `CONTINUE` (only if all downstream deterministic + critic conditions allow) |
| `DETERMINISTIC_BLOCK` | `BLOCK` (authoritative; no LLM may override) |
| `HUMAN_REVIEW_REQUIRED` | `HUMAN_REVIEW` |
| `SUPERVISOR_REQUIRED` | `HUMAN_REVIEW` — reason `PREMIUM_SUPERVISOR_DEFERRED_UNTIL_REVENUE` |
| `SUPERVISOR_OPTIONAL` | existing policy; `HUMAN_REVIEW` where unresolved/risk-sensitive |

In PRE_REVENUE mode a premium supervisor is **never invoked**, no supervisor result is produced, and no
`PASS` is ever manufactured. `REVENUE` mode would route `SUPERVISOR_REQUIRED` to `SUPERVISOR`, but only
for a candidate that has passed the frozen qualification framework (`supervisor_qualified === true`).

## Human review is a real, blocking state
`PENDING_HUMAN_REVIEW` · `RESOLVED` · `BLOCKED`. A `PENDING_HUMAN_REVIEW` or `BLOCKED` record **blocks
publication** — `build-manifest.mjs` refuses and the manifest is never written. Resolution is explicit by
a human; there is no auto-resolve and no auto-approve. After resolution, publication still flows through
every normal downstream gate + the explicit human authorization (Gate 10 / §21).

## Evidence / provenance hardening
Core rule: **the existence of evidence is a system property, not an LLM confidence judgment.**
`harness/evidence-provenance.mjs` enforces the deterministic chain:
`CLAIM → requires evidence? → source reference exists? → source supports claim? → evidence classification valid? → safety boundary respected? → OK`.
Failure → `SOURCE_REQUIRED` (or `BLOCK`/`HUMAN_REVIEW` for safety). Critic/supervisor confidence can
never manufacture provenance. Missing evidence can never become `PASS`.

## Non-negotiables
1. Do not remove the Premium Supervisor architecture. 2. Do not mark the supervisor as `PASS`.
3. Do not manufacture a supervisor result. 4. Never silently convert `SUPERVISOR_REQUIRED` into `PASS`.
5. Do not weaken deterministic QA. 6. Deterministic gates outrank the Mistral critic.
7. The generator is never its own critic. 8. `HUMAN_REVIEW` never means automatic approval.
9. `HUMAN_REVIEW` blocks until explicitly resolved. 10. The supervisor benchmark, schema, A–L cases,
thresholds, provider boundaries and qualification framework remain intact.

## Activation path (later, when revenue justifies paid inference)
`deterministic QA → Mistral critic → Premium Supervisor where required → Human Review where still
unresolved`. Inserting a qualified supervisor requires **no redesign** — it fills the existing slot.

## Tests
`node harness/text-intelligence.test.mjs` — 20 deterministic tests (routing, no supervisor fabrication,
human-review blocking, evidence provenance, framework integrity). No live model calls.
