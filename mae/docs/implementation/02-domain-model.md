# MAE-02 · Domain Model

Objects, identity, relationships. IDs are stable and immutable; a fact lives in one record and is referenced elsewhere by id (never copied).

## Identity conventions (locked)
`PROD-` product · `TR-` transformation · `PTR-` ProductTruthReference · `CRF-` CustomerRealityRecord · `MIF-` MarketIntelligenceRecord · `BRAND-` BrandTruth (versioned) · `ANG-` MarketingAngleRecord · `VAL-` AngleValidationRecord · `BRIEF-` AssetBrief · `CG-` ContentGroundingBlock · `VG-` VisualGroundingBlock · `AG-` AffirmationGroundingBlock · `GEN-` GeneratedAssetRecord · `PJ-` ProductionJob · `ART-` MediaArtifact · `QA-` QARecord · `FAM-` AssetFamilyRecord · `PSET-` LockedPhraseSet · `USE-` UsageRecord · `SEQ-` SequenceRecord · `CAMP-` CampaignRecord · `PERF-` PerformanceRecord · `GAP-` GapRequest · `OVR-` OverrideRecord.

Format: `TYPE-[PRODUCT/ANGLE]-[NNN]` (zero-padded). e.g. `ANG-CSEC-006`, `FAM-CSEC-ANG006`, `AST-CSEC-ANG006-LAUNCH-WA-001`. Existing factory ids (`PPL-*`, `TR-PPL-*`) are referenced as-is.

## Truth layer (S2, Wave A)
- **ProductTruthReference** — read-only pointer into factory records (transformation_id, product_id, before/after/mechanism/safety/permitted+prohibited claims, tsm, evidence). No duplication.
- **CustomerRealityRecord (CRF)** — `person, situation, trigger, context, behaviour, failed_attempts[], constraint, thought, fear, emotional_stake, exact_language, desired_change, evidence_source{id,type,date,frequency,excerpt}, evidence_status, cultural_context, relationships, tags[]`. Sub-systems: voice bank, scene library, fear/frustration index, failed-attempt log, relationship map, cultural tags.
- **MarketIntelligenceRecord (MIF)** — `category(competitor|cliche|myth|gap|alternative|objection|trend|unclaimed_angle|conversation|positioning), statement, evidence, evidence_status, scan_coverage_note, freshness, source`.
- **BrandTruthRecord** — global, versioned: `voice_dna, writing_constitution_ref (→ Writing Control), anti_slop_ref, visual_language, boundaries, vocabulary, tone, cultural, faith_register_allowed[], trust_safety, prohibited_behaviours, claims_boundaries, design_tokens_version`.

**Evidence state enum (locked):** `directly_stated` (observed) · `strongly_evidenced` (observed) · `analyst_interpretation` (inferred) · `hypothesis`. Promotion is one-directional and must be explicit.

**Conflict hierarchy:** Product → Customer → Brand → Market (used only when truths conflict; not weighting).

## Strategy layer (S3/S4, Wave B)
- **MarketingAngleRecord** — Tier1 situational (customer, scene, pain, failed_attempt, emotional_stake[+evidence_status]); Tier2 synthesis (insight[=Strategic Synthesis], mechanism[Product Truth ref], desired_change, angle, asset_purpose); Tier3 traceability (source_evidence[], market_truth_support[], counter_evidence_acknowledged, product_truth_ref, brand_truth_compliance, truth_conflict_log[]). `status`, `tags[]`, `affirmation_grounding?`.
- **AffirmationGroundingBlock (AG)** — `source_record, grounding_tier(micro|macro), anchor_fear_or_constraint, anchor_desired_change, mechanism_ref?, register(affirmation|declaration|motivational_quote), faith_inflected(bool), what_to_avoid[]`.
- **AngleValidationRecord (VAL)** — five criteria {customer_resonance, proof_availability, market_differentiation, brand_alignment, platform_fitness}, `verdict(GREEN|YELLOW|RED)`, `scope_note`, `max_assets`, `approved_platforms[]`, `restrictions[]`, `human_review_required`, `counter_evidence_restatement`, `reviewer`.

## Production layer (S5/S6 + Media, Wave C)
- **AssetBrief** — `asset_type, platform, asset_purpose, audience, angle_id, product_id, truth_weighting{product,customer,market,brand}, content_grounding(CG), visual_grounding(VG)?, affirmation_grounding(AG)?, brand_constraints[], platform_rules[], structural_template, cta_requirements, proof_requirements, locked_phrase_set_ref?, restrictions[], traceability`.
- **ContentGroundingBlock (CG)** — `foreground_fields[]` (values quoted) + `background_fields[]` (reference lightly).
- **VisualGroundingBlock (VG)** — `scene, environment, gesture_posture, props[], wardrobe, lighting, cultural_markers[], composition, exclusions[]`.
- **GeneratedAssetRecord (GEN)** — `angle_id, brief_id, candidates[], selected, prompt_version, generation_version, provider, model, regeneration_count, status`.
- **ProductionJob (PJ)** — `asset_id, brief_id, asset_type, platform, production_mode, required_outputs[], source_versions{}, provider_policy, status`.
- **Render specs** — ImageRenderSpec, LayoutRenderSpec, CarouselSpec, ProductCoverSpec, MockupSpec, VideoProductionSpec, AudioProductionSpec (fields per Media-03).
- **MediaArtifact (ART)** — `production_job_id, asset_id, artifact_role, mime_type, storage_uri, checksum, width/height/duration/file_size, provider, model, source_artifact_ids[], version, status`.

## QA layer (S7, Wave D)
- **QARecord (QA)** — `asset_id, gates[{gate, input_ref, result, reason, remediation, traceability}], overall(PASS|FAIL|REVISION_REQUIRED), severity, human_review{}?, manual_override{}?, timestamp`.

## Family + governance (S8/S9, Wave D)
- **AssetFamilyRecord (FAM)** — `source_angle_id, angle_verdict, platform_scope[], anchor_asset_id, approved_asset_ids[], roles{}, truth_source_refs[], weighting_refs[], locked_phrase_set_ref, sequence_eligibility[], evergreen_eligible, emotional_intensity_profile, family_status, usage_summary, version, restrictions`.
- **LockedPhraseSet (PSET)** — `angle_id, phrases[], established_by_asset_id, version, status`.
- **UsageRecord (USE)** — `asset_id, asset_version, family_id, angle_id, campaign_id, sequence_id, sequence_type, audience_state, sequence_role, platform, scheduled_at, published_at, cta_level, status, performance_ref?`.
- **Dependency** — edges {source_ref → angle → family → asset → usage} for forward/backward queries.

## Campaign layer (S10, Wave E)
- **AudienceStateRecord** — `segment, state(unaware|problem_aware|solution_aware|product_aware|engaged_non_buyer|cart_abandoner|previous_customer|inactive|returning|recently_converted), evidence, suppression`.
- **SequenceRecord (SEQ)** — `campaign_id, sequence_type(LAUNCH|NURTURE|RETARGETING|RE_ENGAGEMENT), audience_state, objective, entry_conditions, exit_conditions, items[{position, asset_id, role, cta_level, emotional_intensity, proof_type}], status`.
- **CampaignRecord (CAMP)** — `objective, audience_states[], sequences[], window, offer, kpi_set, status`.
- **GapRequest (GAP)** — `campaign_id, sequence_id, audience_state, missing_role, required_platform, required_scope, reason, requested_upstream_action`.

## Learning layer (Wave F)
- **PerformanceRecord (PERF)** — `usage_id, platform, audience_state, sequence_position, metrics{}, source`.
- **ExperimentRecord** — `test_dimension, variants[], eligibility, status` (never bypasses claims/QA).
- **ExportPackage / AssetManifest** — per Media-03/05.

## Relationships (cardinality)
`Product 1─* Angle` · `Angle 1─1 Validation` · `Angle 1─* Brief` · `Angle 1─1 Family` · `Brief 1─* GeneratedAsset` · `GeneratedAsset 1─* MediaArtifact` · `Asset 1─1 QARecord` · `Asset *─1 Family` · `Asset 1─* Usage` · `Campaign 1─* Sequence 1─* Usage` · `Usage 1─* Performance`.
