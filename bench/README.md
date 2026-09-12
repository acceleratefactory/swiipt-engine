# Swiipt · Text Provider Benchmark Harness

Compares generator and critic models against the **same** Swiipt-controlled inputs before you set
`COPYWRITER_MODEL` / `WRITING_CRITIC_MODEL`. It measures **Swiipt-specific suitability** (truth
adherence, anti-slop, interchangeability, mechanism fidelity, instruction following, structured-output
reliability, critic defect detection) — not generic AI quality.

This is provider **evaluation only**: it never activates providers, never sets production env vars,
never substitutes a model silently, never writes API keys, and only **recommends** (the owner approves).

## Input (fixed for every candidate)

Synthetic fixtures only (never production Truth):
- Product Truth — `mae/data/fixtures/product-truth/PTR-CSEC-001.json`
- Customer Truth — `mae/data/fixtures/customer-reality/CRF-CSEC-014/021/033.json`
- Market Truth — `mae/data/fixtures/market-intelligence/MIF-CSEC-011/017.json`
- Brand Truth — `mae/data/brand-truth.json`
- Writing Constitution — `config/writing-control.v1.json`
- Marketing Angle Record — built deterministically (`mae/harness/fixtures.mjs`)
- Fixed generation instruction + JSON contract — `bench/schemas/bench-asset.schema.json`

## Run

Credentials come from the environment ONLY (never written to results).

**Single provider (openai-compatible):**

```bash
export OPENAI_API_KEY=...            # optionally OPENAI_BASE_URL / OPENAI_TIMEOUT_MS
node bench/text-provider-bench.mjs --generators "model-a,model-b" --critics "model-c,model-d" --retries 1 --timeout 60000
```

**Multiple named providers** — a candidate file defines provider *profiles* (env-var names only)
and generator/critic candidates that reference them (see `bench/candidates.example.json`):

```json
{
  "providers": {
    "openai": { "base_url_env": "OPENAI_BASE_URL", "api_key_env": "OPENAI_API_KEY", "default_base": true },
    "deepseek": { "base_url_env": "DEEPSEEK_BASE_URL", "api_key_env": "DEEPSEEK_API_KEY" }
  },
  "generators": [ { "provider": "deepseek", "model": "..." } ],
  "critics":    [ { "provider": "openai", "model": "..." } ]
}
```

```bash
export DEEPSEEK_BASE_URL=... DEEPSEEK_API_KEY=... OPENAI_API_KEY=...
node bench/text-provider-bench.mjs --candidates bench/candidates.json
```

A profile defines **only** `base_url_env` and `api_key_env` (and optionally `default_base: true` for
the official OpenAI default). **No secret ever appears in the candidate file.** Each candidate resolves
its own base URL + key at runtime; a missing credential fails **only that candidate** — never another
provider, and never a fallback to `OPENAI_*`.

Options: `--generators` · `--critics` · `--candidates` · `--retries N` · `--timeout MS` ·
`--base-url URL` (legacy single-provider, run-scoped only) · `--out FILE` · `--report FILE` · `--no-judge`.

Outputs: `bench/results/<stamp>-results.json` (machine-readable) + `<stamp>-report.md` (human-readable).

## What is measured

**Per model run:** provider id, endpoint host, requested model, returned model (when the endpoint
reports it), model identity (`OK` / `OK_UNVERIFIED` / `MODEL_ID_MISMATCH`), timestamp, latency,
HTTP/provider status, structured-output parse success, schema validity, `schema_errors`, retry count,
usage/token metadata (when returned), generation status, actual generator. **If the provider returns a
different model than requested, it is recorded as `MODEL_ID_MISMATCH` and excluded from the
recommendation** — provider substitution is never silently accepted.

**Three separated scores (never conflated):**
- `content_quality_score` — mean of the content-quality dimensions that could be **evaluated**.
- `structural_reliability_score` — `1` (parse + schema pass) · `0.5` (parse pass only) · `0` (no parse).
- `provider_reliability` — fraction of provider calls that succeeded at the transport level.

### Strict schema gate
- **JSON parse fails** → all content dimensions are `NOT_EVALUATED` (score `null`, never a genuine `0`),
  structural reliability `FAIL`, `usable_without_rewrite = false`.
- **JSON parses but schema fails** → the exact `schema_errors` are recorded, content dimensions that can
  be read from the parsed fields are still evaluated, structural reliability is `FAIL`,
  `usable_without_rewrite = false`, and the candidate is **blocked from production recommendation**.
- **Only structurally-valid candidates** can be recommended. `NOT_EVALUATED` is reported as such and is
  never treated as a score of 0.

**Generator quality dimensions (A–P):** Product Truth adherence · Customer Truth adherence · Market
Truth adherence · Brand Truth adherence · Writing Constitution compliance · Anti-Slop compliance ·
Interchangeability · unsupported-claim/hallucination incidence · transformation specificity · mechanism
fidelity · instruction following · required-field completeness · structural/JSON reliability ·
cultural/context integrity · unnecessary emotional invention · usable-without-rewrite.

Deterministic checks (`analyzeProse`, `anchorCount`, schema validation, grounded-number tracing) form
the official scores. Judgment is kept **separate**: if a judge is used, it must be a **different**
critic candidate — a model never judges itself in the official comparison.

**Critic benchmark** runs controlled cases with known defects (generic/interchangeable, invented
evidence, unsupported emotional claim, Product Truth contradiction, wrong mechanism, anti-slop phrase,
platform mismatch, missing required fields, plus one valid control) and measures true detection,
false positives/negatives, severity accuracy, schema reliability and latency.

### Critic recommendation eligibility (separate from ranking)
Ranking (`critic_ranking`) is comparative and lists **all** critics; recommendation is a hard
qualification gate. `CRITIC_ELIGIBILITY` (controlled-suite thresholds, exported for auditability):
`provider_reliability = 1.0`, `schema_reliability = 1.0`, `precision = 1.0`, `recall ≥ 0.8`,
`f1 ≥ 0.8`, `severity_accuracy ≥ 0.8`; plus `model_identity !== MODEL_ID_MISMATCH` and no self-judge
conflict with the recommended generator. **Missing metrics never silently pass** (explicit reason).
`recommended_critic`/`secondary_critic` are selected **only from eligible critics**; when none qualify
they are `null` and `critic_recommendation_blocked` lists each ineligible critic with reasons. A critic
may be top-ranked yet not recommended. Per-critic case performance (precision/recall per defect) is
retained so critical-class requirements can be added later.

### Failure metrics (candidate-level vs case-level)
The former ambiguous `failure_rate` is replaced by `failure_metrics`:
- `candidates_total`, `candidates_with_any_failure`, `candidates_with_any_failure_rate` — **candidate-level**.
- `case_failure_rate` — **case-level**, weighted (`failed attempts / attempted attempts`); for a single
  critic with 2 failed of 9 cases this is `0.2222`.
- `provider_reliability_mean` — retained separately (transport reliability is not case failure).
Both generators and critics report the same explicit shape.

### Customer Truth scoring (deterministic)
`customer_truth_adherence` is a graded 0–1 **grounding coverage** over **all** `customer_truth` records
(not just the first). It derives content-token anchors (stopwords/short tokens removed, light stemming)
and distinctive 2-word phrases from the CRF narrative fields (`situation`, `trigger`, `context`,
`behaviour`, `failed_attempts`, `constraint`, `thought`, `fear`, `emotional_stake`, `desired_change`,
`exact_language`), then scores the best-covered record as `min(1, matchedDistinctAnchors / 8)`.
Set-based matching means repeating one phrase cannot inflate the score; a verbatim single word such as
*"scared"* scores ≈0.13 and never passes. A separate **invented-customer-detail guard** flags quoted
customer statements not grounded in the CRF and caps the score at 0.2 (and adds
`customer_truth_invention` to blocking, forcing `usable_without_rewrite = false`). Diagnostics
(`records_represented`, `best_record`, `available/matched/unmatched anchors`, `per_record_coverage`,
`invention_flags`) are recorded with the dimension.

### Structured-output mode
The requested structured-output mode is explicit and operator-selectable:
`--structured-output json_schema|json_object|none` (default `json_schema`).
- `json_schema` sends `response_format: { type:"json_schema", json_schema:{ name, strict:true, schema } }`
  using the **canonical** `bench/schemas/bench-asset.schema.json` (also included in the generation
  context as `output_contract`, so the typed contract is unambiguous even when schema mode is unsupported).
- `json_object` sends the legacy `{ type:"json_object" }`.
- **No silent downgrade:** a provider rejection of `json_schema` is reported explicitly
  (`structured_output_provider_response: "rejected"`) and retried in the same mode — never swapped to
  `json_object`. Local AJV validation remains authoritative; provider-side enforcement never produces a
  content-quality PASS.

### Live progress
The CLI prints per-candidate progress (disable with `--quiet`):
```
[GEN 1/2] DeepSeek V4 Flash START
[GEN 1/2] SUCCESS 43.1s — JSON PASS / SCHEMA FAIL
[CRITIC 1/18] openai/critic-model case=valid-control START
[CRITIC 1/18] openai/critic-model case=valid-control SUCCESS 2.4s — SCHEMA PASS
```

## Report sections

GENERATOR COMPARISON · CRITIC COMPARISON · STRUCTURED OUTPUT RELIABILITY · STRUCTURED OUTPUT MODE ·
SCHEMA ERRORS · MODEL IDENTITY / MODEL_ID_MISMATCH · RECOMMENDATION BLOCKED · PROVIDER RELIABILITY ·
TRUTH-ADHERENCE RESULTS · WRITING QUALITY RESULTS · LATENCY · USAGE/COST METADATA ·
FAILURE METRICS (candidate-level + case-level) · RECOMMENDED GENERATOR · TOP-RANKED CRITIC ·
RECOMMENDED CRITIC · CRITIC RECOMMENDATION BLOCKED.

## Honesty & secrets

Provider failure, rate limiting, timeout, malformed response or an unavailable model remain **explicit**
(`PROVIDER_NOT_CONFIGURED`, `PROVIDER_ATTEMPT_FAILED`, `PROVIDER_RESPONSE_INVALID`). Another model is
never silently substituted. Credentials are read from the environment only and are redacted from all
recorded errors; result JSON contains no key.

## Tests

```bash
node --test bench/text-provider-bench.test.mjs
```
