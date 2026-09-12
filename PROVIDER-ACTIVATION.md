# Swiipt — Provider Activation (readiness layer)

Status: **readiness implemented; no provider activated; no keys configured; no CRF/MIF corpus ingested.**
This document describes the provider integration seams present in the code. It is documentation, not
activation.

## Status classes

| Class | Meaning | Example |
|---|---|---|
| **IMPLEMENTED PROVIDER INTERFACE** | The adapter/capability exists and routes; may be dormant. | MAE `image_generation`, `video_generation`, `tts`, `document_render`; MAE `CriticAdapter` |
| **CONFIGURED PROVIDER** | An endpoint/model/key are present in the environment. | `OPENAI_BASE_URL` + `OPENAI_API_KEY` + `COPYWRITER_MODEL` |
| **ACTIVE PROVIDER** | Configured **and** selected for a run (e.g. `COPYWRITER_PROVIDER=openai`). | copywriter on an OpenAI-compatible endpoint |
| **DORMANT PROVIDER** | No key/selection → returns a typed not-run/blocked state. | image/video/TTS/PDF, MAE critic |
| **PROVIDER REQUIRED** | Capability cannot be produced deterministically. | image generation, video render, TTS audio, PDF raster |
| **PROVIDER OPTIONAL** | Deterministic path exists; provider improves it. | copywriter narrative enrichment, writing critic |

## Environment variables (all optional; dormant by default)

| Variable | Purpose | Default when unset |
|---|---|---|
| `OPENAI_BASE_URL` | OpenAI-compatible base URL (official OpenAI or any compatible gateway) | `https://api.openai.com/v1` |
| `OPENAI_API_KEY` | Key for the OpenAI-compatible endpoint | not set → `PROVIDER_NOT_CONFIGURED` |
| `OPENAI_MODEL` | Shared fallback model | `gpt-4o-mini` |
| `COPYWRITER_MODEL` | Model for the copywriter worker (precedence over `OPENAI_MODEL`) | — |
| `WRITING_CRITIC_MODEL` | Model for the writing critic worker | — |
| `MAE_GENERATION_MODEL` | Reserved for MAE text/reasoning generation adapter | — |
| `MAE_CRITIC_MODEL` | Reserved for the MAE critic adapter | — |
| `OPENAI_TIMEOUT_MS` | Request timeout (ms) | `60000` |
| `COPYWRITER_PROVIDER` | `deterministic` \| `openai` | `deterministic` |
| `WRITING_CRITIC_PROVIDER` | `none` \| `openai` | `none` |
| `MAE_CRITIC_API_KEY` | MAE critic adapter key | not set |
| `MAE_IMAGE_API_KEY` | Image adapter key (dormancy toggle) | not set |
| `MAE_VIDEO_API_KEY` | Video adapter key (dormancy toggle) | not set |
| `MAE_TTS_API_KEY` | TTS adapter key (dormancy toggle) | not set |

See `.env.example` for the safe template (empty values only — never commit real values; `.env` is git-ignored).

## Shared client

`lib/provider-client.mjs` is the single small OpenAI-compatible client used by the factory
(`copywriter`, `writing-critic`) and reusable by future MAE text/reasoning adapters. It handles:
base URL, key, model, request, structured (JSON) response, timeout, HTTP failure, invalid response,
and provider metadata (endpoint host). It is intentionally not a platform/SDK.

### Base-URL normalization

`normalizeBaseUrl()` guarantees configuration cannot produce `/v1/v1/...` or duplicate
`/chat/completions`:

```
https://api.openai.com        → https://api.openai.com/v1
https://host/v1/v1/           → https://host/v1
https://host/v1/chat/completions → https://host/v1            (endpoint re-appends /chat/completions)
(empty)                       → https://api.openai.com/v1
```

## Model routing

Worker-specific model env takes precedence, then `OPENAI_MODEL`, then the default:

```
resolveModel(worker) = WORKER_MODEL[worker] || OPENAI_MODEL || "gpt-4o-mini"
copywriter      → COPYWRITER_MODEL
writing-critic  → WRITING_CRITIC_MODEL
mae-generation  → MAE_GENERATION_MODEL
mae-critic      → MAE_CRITIC_MODEL
```

Generator and Critic must never be required to share a model merely because they share a gateway.

## Honest provider-status & fallback

Typed statuses: `PROVIDER_NOT_CONFIGURED` · `PROVIDER_ATTEMPT_FAILED` · `PROVIDER_RESPONSE_INVALID`
· `PROVIDER_SUCCESS` · `DETERMINISTIC_GENERATION` (plus MAE media `PRODUCTION_BLOCKED`,
`RENDER_PENDING_EXTERNAL_PROVIDER`, and critic `NOT_RUN` / `HUMAN_REVIEW`).

When `COPYWRITER_PROVIDER=openai` and the call fails, the copywriter falls back to deterministic
output **and records it** in `copy/provider-status.json`:

```
requested_provider · provider_attempt_status · fallback_used · actual_generator · model · endpoint_host · error
```

The requested external model is **never** reported as the actual generator when it did not generate
the content. `writing-manifest.json → generator_model` reflects the recorded `actual_generator`. No
API key is ever written to a record or log (redacted).

## CRF / MIF ingest

`mae/harness/ingest-crf.mjs` and `mae/harness/ingest-mif.mjs` are thin CLIs over the existing
`services/crf.js::ingest()` / `services/mif.js::ingest()`:

```
node mae/harness/ingest-crf.mjs <file|dir> [...] [--scope production|test] [--dry-run]
node mae/harness/ingest-mif.mjs <file|dir> [...] [--scope production|test] [--dry-run]
```

Guarantees: schema validation before persistence; production scope rejects synthetic fixtures;
provenance/evidence-state preserved; all-or-nothing batches (a rejected record persists nothing).

## Still dormant (providers not chosen; interfaces retained)

`image_generation` · `image editing` (no interface) · `video_generation` · `image-to-video` (no
interface) · `tts` · `visual_reasoning` (MAE) · `document_render` (PDF). These remain behind their
capability interfaces and honest blocked/pending states.
