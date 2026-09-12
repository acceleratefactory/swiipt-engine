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
HTTP/provider status, structured-output parse success, schema validity, retry count, usage/token
metadata (when returned), generation status, actual generator. **If the provider returns a different
model than requested, it is recorded as `MODEL_ID_MISMATCH` and excluded from the recommendation** —
provider substitution is never silently accepted.

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

## Report sections

GENERATOR COMPARISON · CRITIC COMPARISON · STRUCTURED OUTPUT RELIABILITY · TRUTH-ADHERENCE RESULTS ·
WRITING QUALITY RESULTS · LATENCY · USAGE/COST METADATA · FAILURE RATE · RECOMMENDED GENERATOR ·
RECOMMENDED CRITIC · SECONDARY FALLBACK CANDIDATES.

## Honesty & secrets

Provider failure, rate limiting, timeout, malformed response or an unavailable model remain **explicit**
(`PROVIDER_NOT_CONFIGURED`, `PROVIDER_ATTEMPT_FAILED`, `PROVIDER_RESPONSE_INVALID`). Another model is
never silently substituted. Credentials are read from the environment only and are redacted from all
recorded errors; result JSON contains no key.

## Tests

```bash
node --test bench/text-provider-bench.test.mjs
```
