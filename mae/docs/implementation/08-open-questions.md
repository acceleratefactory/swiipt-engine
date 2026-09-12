# MAE-08 · Open Questions

Only genuine unresolved implementation questions (not matters the spec already answers). Searched
Sections 1–11 + the Media package before adding.

## IMPLEMENTATION BLOCKERS

**None.** The V1 architecture is implemented. The default configuration — deterministic, no keys —
runs the complete chain (truth → angle → validation → architecture → generation → seven-gate QA →
family → governance → campaign → export), with judgment routed to human review and provider-only
media reported as explicit blocked/pending states.

## PRODUCTION ACTIVATION DEPENDENCIES

These are activation items, not unfinished architecture. The interfaces and honest blocked states
already exist.

1. **Real evidence-backed Customer Reality File corpus** — ingested through the implemented workflow
   (`mae/harness/ingest-crf.mjs` → `services/crf.js::ingest()`). Production scope rejects synthetic
   fixtures; provenance/evidence-state preserved.
2. **Real evidence-backed Market Intelligence File corpus** — ingested through
   (`mae/harness/ingest-mif.mjs` → `services/mif.js::ingest()`).
3. **Configured external providers** for capabilities that require them:
   - *Text / reasoning (optional)* — set `OPENAI_BASE_URL` + `OPENAI_API_KEY` (+ per-worker models).
     Deterministic generation and deterministic QA always work without this.
   - *Image generation, video render, TTS audio, PDF/document render* — the adapter interfaces and
     honest blocked/pending states (`PRODUCTION_BLOCKED`, `RENDER_PENDING_EXTERNAL_PROVIDER`) exist,
     but no external HTTP adapter is implemented yet. Actual provider selection is a later owner
     decision (deliberately out of scope for the readiness layer).

## IMPLEMENTATION CHOICES (not blockers)

1. **Typography rasterization.** The deterministic Typographic/Core renderer emits a real **SVG** and
   the full layout spec; PNG/WebP/PDF rasterization is a provider/deferred modality
   (`RENDER_PENDING_EXTERNAL_PROVIDER` when unconfigured), never faked.
2. **Real CRF/MIF corpus.** No structured Customer/Market corpus exists in the repo yet; V1 uses
   labeled synthetic fixtures for tests. The ingest CLIs above are the production path.
3. **Image/video/TTS providers.** Adapters are dormant; no credentials stored; selection deferred.
4. **Live publish handoff.** The MAE emits approved records + Master Pack + Asset Manifest + export
   ZIP; the live WordPress publishing stays with `harness/build-manifest.mjs` +
   `swiipt-core/includes/publisher.php`. Whether MAE auto-invokes it is an operational choice.
