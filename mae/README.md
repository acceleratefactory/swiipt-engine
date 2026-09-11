# Swiipt Marketing Asset Engine (MAE)

A governed Node subsystem inside `Product Pipeline/`. It transforms authoritative Product Truth
plus structured Customer, Market and Brand Truth into validated, customer-specific, platform-native
marketing — without losing evidence, provenance, strategic coherence or control.

The canonical operating chain is implemented end to end:

```
PRODUCT FACTORY OUTPUT → FOUR TRUTHS → MARKETING ANGLE RECORD → ANGLE VALIDATION →
ASSET ARCHITECTURE → GROUNDING → GENERATION → SEVEN-GATE QA → APPROVED ASSET →
ASSET FAMILY → TRACEABILITY / GOVERNANCE → AUDIENCE STATE → SEQUENCE / CAMPAIGN →
CAMPAIGN QA → PUBLISH → USAGE + PERFORMANCE → LEARNING / REFRESH ↺
```

This is a **Node subsystem** (ESM), not a separate application. PHP / `swiipt-core` remains the live
delivery/publishing/runtime layer. The MAE emits approved records + an export package that the
existing publisher bridge (`../harness/build-manifest.mjs` + `swiipt-core/includes/publisher.php`)
can consume.

## Layout

```
mae/
  schemas/    JSON Schema 2020-12 contracts (validated with ajv)
  data/       governed records (truth, angles, briefs, generated, qa, assets, families, psets,
              usage, audience, sequences, campaigns, gaps, performance, experiments, audit)
  data/fixtures/  labelled synthetic fixtures (test scope only; never production Truth)
  lib/        ids · schema (ajv pool) · store · evidence · errors · transition
  services/   truth crf mif brand angle validation critic architecture generation qa family
              governance campaign publishing learning
  media/      router providers layout render-specs pipeline zip export
  storage/    work/ (renders) · exports/ (packages)
  harness/    fixtures.mjs + wave*.test.mjs + acceptance.test.mjs
  docs/implementation/  00–08 implementation aids
```

## Setup / configuration

- **No install required beyond the factory's `ajv`** (already in `Product Pipeline/node_modules`).
  This is why the MAE uses JSON-file records rather than a database: it is a modular monolith (S11 §86/§87).
- Records are plain JSON under `mae/data/**`; the filesystem is the export surface, not the source of truth.
- Node 22+ (`node --test`, ESM). No transpiler.

### Environment variables (all optional — dormant by default)

| Variable | Enables | Behaviour when absent |
|---|---|---|
| `OPENAI_API_KEY` | `openai-copy` / `openai-critic` adapters | deterministic generation + `NOT_RUN` critic |
| `MAE_CRITIC_API_KEY` | judgment critic | interchangeability falls back to deterministic anchors |
| `MAE_IMAGE_API_KEY` | image generation | `GENERATED_SCENE` → `PRODUCTION_BLOCKED` |
| `MAE_VIDEO_API_KEY` | final video render | complete video package + `RENDER_PENDING_EXTERNAL_PROVIDER` |
| `MAE_TTS_API_KEY` | voiceover | voiceover **text** produced; audio pending |

No keys are ever hard-coded. Absence of a key **never** removes the architecture and **never**
reports false completion.

## Running the tests

```bash
# entire MAE suite (from Product Pipeline/)
node --test mae/harness/*.test.mjs

# one wave
node --test mae/harness/waveD.test.mjs
```

Expected: **118/118 PASS** (waveA 11 · waveB 14 · waveC 12 · waveD 28 · waveE 13 · waveF 13 · acceptance 27).
Factory regression (must also stay green): `node harness/qa-checks.mjs`, `node harness/validate-opportunity.mjs --all`,
`node --test harness/writing-control.test.mjs`, `node --test harness/publish-manifest.test.mjs`.

## Deterministic vs judgment

- **Deterministic (code):** required fields, IDs, references, enums, legal transitions, Red exclusion,
  Yellow scope, banned phrases, platform length/format, locked text, evidence citation/freshness,
  approval-before-schedule, traceability completeness, export eligibility.
- **Judgment (critic, dormant-by-default, or human):** interchangeability, emotional integrity,
  cultural fit, strategic coherence, scene specificity, native platform feel, nuanced brand fit.
  Judgment is never faked as a number; an unconfigured critic returns `NOT_RUN` and routes to human review.

## Publishing boundary

The MAE produces approved assets, an Asset Family, a Master Marketing Pack, an Asset Manifest
(JSON + CSV) and an approved-only export ZIP. It does **not** publish to platforms directly. The
existing factory publisher consumes the manifest. This keeps "Section 10 decides / Section 9 records"
and the publishing boundary (S11 §11.15) intact.

## Provider adapters

`media/providers.js` exposes a capability registry (`text_generation, evaluation, visual_reasoning,
image_generation, video_generation, tts, layout_render, document_render`). The internal deterministic
layout renderer is always available; external adapters stay dormant until an env key is present.
Swapping a provider creates a new `ProductionJob`/artifact version — asset and Angle identity never change.

## Adding a new product

Author Truth records (CRF/MIF), a Product Truth Reference, an Angle Record, run the validation gate,
build Asset Briefs, generate, run the seven-gate QA, assemble the family, then assemble campaigns.
See `docs/implementation/` and the acceptance scenarios in `harness/acceptance.test.mjs` for a complete worked example.
