# Writing / Generation Control — config + how it integrates

The **Writing / Generation Control Layer V1** controls how the factory's LLM turn an
already-approved product specification into the actual product. It is an **execution layer inside the
existing factory** — it does not replace the Transformation Specification, Product Schema, Design
System, Acceptance Tests or Publishing Gates. It is a **generation control**, not an acceptance-test
framework.

- Authoritative spec: `../Swiipt_Writing_Generation_Control_Layer_v1.md`
- Agent-readable standard: `../standards/writing-standard.md`
- Structured config: `writing-control.v1.json` (validated by `../schemas/writing-control.schema.json`)

## Position in the flow

```
APPROVED PRODUCT → TRANSFORMATION SPEC → PRODUCT SCHEMA → PRODUCT ARCHITECTURE
→ WRITING / GENERATION CONTROL → GENERATION → GENERATOR SELF-CHECK
→ TRANSFORMATION QA → ACCEPTANCE TESTS (qa-checks + A–R) → PUBLISHING GATES
```

## Stages (harness)

| Stage | File | What it does |
|---|---|---|
| Pass 1 — contract ingestion | `../harness/writing-control.mjs` | builds the Generation Brief from the records; returns `SOURCE_REQUIRED`/`MISSING` and stops if upstream is thin |
| Passes 2–7 | `../harness/writing-passes.mjs` | architecture check → content generation (reuses `gen-content.mjs`) → asset structure → voice → anti-AI → QA handoff |
| Deterministic controls | `../harness/writing-checks.mjs` | NEVER phrases (BLOCKER), filler/repetition/density/heading/bullet (WARNING), asset structure |
| Critic + revision + change control | `../harness/writing-critic.mjs` | deterministic critique + dormant LLM critic (provider adapter); targeted-revision plan; protected-field change control |
| Manifest + versioning | `../harness/writing-manifest.mjs` | writes `copy/generation-manifest.json`; stamps `product.json → generation.writing_control_version` |

## Run order (per product)

```
node harness/gen-content.mjs <PRODUCT_ID>          # (optional) existing content generation
node harness/writing-manifest.mjs <PRODUCT_ID>     # passes + critic + generation manifest
node harness/build-manifest.mjs <PRODUCT_ID>       # publish manifest (carries generation block)
node harness/qa-checks.mjs                         # authoritative deterministic QA (unchanged)
```

## Severity (owner-locked)

- **BLOCKER:** `NEVER` · `SCOPE_DRIFT` · `UNSUPPORTED` · `SAFETY_ISSUE`
- **WARNING → targeted revision:** density · heading excess · bullet excess · repetition · filler · `WRITING_QUALITY_ISSUE`

## Critic / provider

Deterministic controls always run. The LLM critic uses a replaceable provider adapter
(`WRITING_CRITIC_PROVIDER`, default `none`) and is **dormant by default**. A PASS is never recorded
when the critic did not run — the status is `NOT_RUN`, and under `--strict` a required-but-unavailable
critic becomes `HUMAN_REVIEW`. No credentials are hard-coded.

## Text intelligence operating mode

- Structured config: `text-intelligence.v1.json` (validated by `../schemas/text-intelligence.schema.json`)
- Canonical doc: `../SWIIPT-TEXT-INTELLIGENCE-STACK-PRE-REVENUE.md`
- Code: `../lib/text-intelligence.mjs` (routing + human-review state) · `../harness/evidence-provenance.mjs`
- Tests: `node harness/text-intelligence.test.mjs`

The current mode is **PRE_REVENUE**: the Premium Supervisor is **DEFERRED_UNTIL_REVENUE** (permanent,
not removed) and `SUPERVISOR_REQUIRED` / `HUMAN_REVIEW_REQUIRED` route to a blocking `HUMAN_REVIEW`
record. No paid supervisor call occurs in this mode and no supervisor `PASS` is ever manufactured.
