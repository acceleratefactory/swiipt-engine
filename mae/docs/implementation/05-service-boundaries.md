# MAE-05 · Service Boundaries

Modular monolith (Node, ESM). No new stack, no microservices, no vector DB (S11 §86/§87). Business rules live in services; providers are replaceable workers; the LLM is never trusted to enforce hard invariants.

## Location & stack decision (owner-approved)
- The MAE is a **Node subsystem inside `Product Pipeline/`** at `Product Pipeline/mae/`.
- It reuses: `ajv` (schemas), the `data/` record-store conventions, the Writing Control layer for the writing register, the design tokens for render specs, and the existing publish boundary (`../harness/build-manifest.mjs` + `swiipt-core/includes/publisher.php`).
- PHP/`swiipt-core` remains the **live delivery/publishing/runtime** layer. Nothing core moves there.
- Existing factory work is untouched except surgical integration.

## Module layout
```text
Product Pipeline/mae/
  schemas/            JSON Schema contracts
  data/               governed records (truth, angles, briefs, assets, families, usage, campaigns, media, performance, gaps)
  data/fixtures/      labeled synthetic fixtures (test scope only)
  lib/                ids.js · schema.js (ajv pool) · store.js (JSON read/write) · evidence.js (enum+promotion) · errors.js · transition.js
  services/
    truth.js          TruthService: retrieve, evidence state, weighting, conflict hierarchy, fixture gate
    crf.js            CustomerRealityService: ingest/query CRF (tag/filter retrieval)
    mif.js            MarketIntelligenceService: ingest/query MIF + absence-claim safeguard
    brand.js          BrandTruthService: versioned brand config; references Writing Control
    angle.js          AngleService: build/validate Angle Record (+3.10 grounding)
    validation.js     AngleValidationService: 5 criteria → GREEN/YELLOW/RED, scope, human thresholds
    critic.js         CriticAdapter: replaceable, dormant-by-default judgment evaluator (never fake PASS)
    architecture.js   AssetArchitectureService: weighting matrix + platform rules → AssetBrief (+grounding)
    generation.js     GenerationService: constrained prompt assembly + draft asset production (dormant LLM)
    qa.js             QAOrchestrator + Gate1..7 checkers (+AntiSlop, Interchangeability, PlatformFit, BrandCultural, TruthCompliance, Consistency, HumanReview)
    family.js         AssetFamilyService: assembly, anchor, locked phrases, coverage, redundancy, completeness
    governance.js     TraceabilityService/Governance/Dependency/Version: lineage, usage, retirement, audit
    campaign.js       AudienceStateService · SequenceService · CampaignService · RotationService · FatigueService · CalendarService · GapRequestService
    publishing.js     PublishingService: consume approved records; record publication; never rewrite meaning
    learning.js       PerformanceService · ExperimentService (A/B) · LearningService
  media/
    router.js         capability registry + provider routing (+fallback/dormant)
    providers.js      replaceable adapters (dormant: none/openai/image/video/tts stubs)
    layout.js         deterministic Typographic/Core renderer → real SVG artifact (locked text verbatim)
    render-specs.js   Image/Layout/Carousel/Cover/Mockup/Video/Audio spec builders
    pipeline.js       ProductionJob orchestration → MediaArtifact(s); real-file-or-explicit-pending
    zip.js            dependency-free ZIP writer (STORED) for export packages
    export.js         AssetManifest (JSON+CSV) + Master Pack + ExportPackage (ZIP) + export QA
  harness/            CLI runners + tests (node:test)
  docs/implementation/
```

**Status (2026-09-11):** every service above is implemented and covered by the test suite (Waves A–F + acceptance).

## Boundaries & one canonical owner per rule (S11 §106)
| Concern | Owner | Consumers call |
|---|---|---|
| Truth retrieval/conflict/weighting | `truth.js` | angle, architecture, qa |
| Angle status / validation | `validation.js` | architecture, family |
| Asset approval | `qa.js` | family, campaign |
| Family eligibility | `family.js` | campaign |
| Usage history / identity | `governance.js` | campaign, learning |
| Campaign selection / rotation | `campaign.js` | publishing |
| Media rendering | `media/*` | qa (Section 7 stays the marketing approval authority) |

## Provider model (owner decision #2)
- Provider adapters are **dormant by default** (`none`). Deterministic functionality works with no keys.
- Capabilities: `text_generation, evaluation, visual_reasoning, image_generation, video_generation, tts, layout_render, document_render`. The layout renderer is **internal/deterministic**.
- Unavailable provider → typed state (`PROVIDER_UNAVAILABLE`, `PRODUCTION_BLOCKED`, `RENDER_PENDING_EXTERNAL_PROVIDER`); **never** a false "complete".
- No vendor code in business rules; swapping a provider creates a new production/version, never changes identity.

## Deterministic vs judgment (S11 §11.19)
- **Deterministic (code):** required fields, ids, references, enums, legal transitions, Red exclusion, Yellow scope, banned phrases, dimensions/length, locked text, evidence citation/freshness, approval-before-schedule, traceability completeness.
- **Judgment (critic, dormant-by-default, or human):** interchangeability, emotional integrity, cultural fit, strategic coherence, scene specificity, native platform feel, nuanced brand fit. Never faked as numbers.

## Deterministic rendering note (implementation choice)
Per owner decision #2, the **Typographic/Core renderer emits a real SVG** (deterministic, no external deps) and preserves the exact approved text. Rasterization to PNG/WebP and PDF is a **provider/deferred modality** (`document_render`/`image_render`) and is marked `RENDER_PENDING_EXTERNAL_PROVIDER` when unconfigured — never claimed as a produced raster. The full render spec + SVG + production package are always produced. (Recorded in `08-open-questions.md`.)
