# MAE-04 · Data Contract Map

Machine-readable schemas live in `mae/schemas/*.schema.json` (JSON Schema 2020-12, validated with `ajv` via `mae/lib/schema.js`). Records live under `mae/data/**` (JSON). IDs per `02-domain-model.md`.

> **Status (2026-09-11):** all contracts in the table below are implemented and enforced. Waves D–F added `qa-record`, `asset-record`, `asset-family-record`, `locked-phrase-set`, `usage-record`, `audience-state`, `sequence-record`, `campaign-record`, `gap-request`, `performance-record`, `experiment-record`, `export-package`, `asset-manifest`.

## Schema → file → record → owner
| Object | Schema | Stored under | Written by | Read by |
|---|---|---|---|---|
| ProductTruthReference | `product-truth-reference.schema.json` | `data/truth/product-truth/*.json` | TruthService (from factory) | Angle, Architecture, Governance |
| CustomerRealityRecord | `customer-reality-record.schema.json` | `data/truth/customer-reality/*.json` | CRF ingest (`harness/ingest-crf.mjs`) | TruthService, Angle, QA |
| MarketIntelligenceRecord | `market-intelligence-record.schema.json` | `data/truth/market-intelligence/*.json` | MIF ingest (`harness/ingest-mif.mjs`) | TruthService, Angle, QA |
| BrandTruthRecord | `brand-truth-record.schema.json` | `data/truth/brand-truth.json` + `versions/` | BrandTruthService | Angle, Architecture, QA |
| MarketingAngleRecord | `marketing-angle-record.schema.json` | `data/angles/*.json` | AngleService | Validation, Architecture, Governance |
| AffirmationGroundingBlock | `affirmation-grounding.schema.json` | embedded in angle / brief | AngleService | Generation, QA |
| AngleValidationRecord | `angle-validation-record.schema.json` | `data/validations/*.json` | AngleValidationService | Architecture, Family |
| ContentGroundingBlock | `content-grounding.schema.json` | embedded in brief | ArchitectureService | Generation |
| VisualGroundingBlock | `visual-grounding.schema.json` | embedded in brief / standalone | ArchitectureService | Media router, Visual QA |
| AssetBrief | `asset-brief.schema.json` | `data/briefs/*.json` | ArchitectureService | Generation, Media, QA |
| GeneratedAssetRecord | `generated-asset-record.schema.json` | `data/generated/*.json` | GenerationService | Media, QA |
| ProductionJob | `production-job.schema.json` | `data/media/jobs/*.json` | Media pipeline | Router, export |
| Image/Layout/Carousel/Cover/Mockup/Video/Audio RenderSpec | `*-spec.schema.json` | embedded in job/brief | Media pipeline | Producers |
| MediaArtifact | `media-artifact.schema.json` | `data/media/artifacts/*.json` | Media producers | QA, export, manifest |
| QARecord | `qa-record.schema.json` | `data/qa/*.json` | QAOrchestrator | Family, Governance |
| AssetRecord | `asset-record.schema.json` | `data/assets/*.json` | Family/Governance | Campaign, export |
| AssetFamilyRecord | `asset-family-record.schema.json` | `data/families/*.json` | AssetFamilyService | Campaign, Governance |
| LockedPhraseSet | `locked-phrase-set.schema.json` | `data/psets/*.json` | FamilyService | Generation, QA |
| UsageRecord | `usage-record.schema.json` | `data/usage/*.json` | Campaign/Governance | Fatigue, Performance |
| AudienceStateRecord | `audience-state.schema.json` | `data/campaigns/audience/*.json` | AudienceStateService | Campaign |
| SequenceRecord | `sequence-record.schema.json` | `data/campaigns/sequences/*.json` | SequenceService | Campaign QA |
| CampaignRecord | `campaign-record.schema.json` | `data/campaigns/*.json` | CampaignService | Campaign QA, export |
| GapRequest | `gap-request.schema.json` | `data/gaps/*.json` | Campaign | Governance |
| PerformanceRecord | `performance-record.schema.json` | `data/performance/*.json` | LearningService | Rotation (ranking only) |
| ExportPackage | `export-package.schema.json` | `data/exports/*.json` | ExportService | Publishing |
| AssetManifest | `asset-manifest.schema.json` | `exports/<product>/asset-manifest.json/.csv` | ManifestService | Publishing, audit |

## Evidence-state propagation (non-negotiable)
A downstream object must never assert more certainty than its source. `evidence_status` carries: CRF/MIF → Angle `emotional_stake`/`source_evidence` → Brief fields → Generated copy → QA Gate 5. Lower→higher promotion is only allowed with a stronger cited source and is logged (`evidence_promotion`).

## Conflict hierarchy in data
`TruthService.resolveConflict(a,b)` returns the higher-authority source with a logged resolution. Weighting (`truth_weighting`) affects emphasis only and is stored on the brief; it is validated to never contradict a higher-authority claim.

## Synthetic vs evidence-backed vs inference vs hypothesis
Every record carries `provenance` (`synthetic_fixture` | `evidence_backed` | `inference` | `hypothesis`) and, for fixtures, `is_fixture:true`, `environment:"test"`. Fixture records are readable only in test/fixture scope and are refused by production generation unless `allowFixtures` is explicitly set in a test run. See `TruthService.assertProductionSafe()`.

## Versioning
Angles, Brand Truth, evidence, briefs, asset versions, families, campaign configs are versioned. A creative change → new asset version (no auto-inherit approval). Source change → dependency review (S9 §9.33).

## Validation & errors
Every write validates against its schema (ajv) and business rules; failures raise typed errors (`lib/errors.js`): `SCHEMA_INVALID`, `MISSING_FIELD`, `REFERENCE_UNRESOLVED`, `EVIDENCE_REQUIRED`, `ILLEGAL_TRANSITION`, `SCOPE_VIOLATION`, `PROVIDER_UNAVAILABLE`, `PRODUCTION_BLOCKED`, `REAL_FILE_REQUIRED`, `FIXTURE_NOT_PRODUCTION_SAFE`, `UNSUPPORTED_MODALITY`.
