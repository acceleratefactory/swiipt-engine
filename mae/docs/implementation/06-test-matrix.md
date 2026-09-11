# MAE-06 · Test Matrix

Runner: `node --test mae/harness/*.test.mjs` (node:test). All deterministic tests must pass with **no provider keys** (dormant providers). Judgment tests run against deterministic critic stubs; LLM critic is `NOT_RUN` unless configured (never a fake PASS).

> **Status (2026-09-11):** implemented and green — waveA 11 · waveB 14 · waveC 12 · waveD 28 · waveE 13 · waveF 13 · acceptance 27 = **118/118 PASS**. The bullet lists below are the coverage map; every listed class is exercised.

## Classes
unit · schema/contract · state-transition · deterministic-rule · integration · critic/judgment (stub) · end-to-end · regression fixtures.

## Wave A — Truth
- test_truths_separate · test_evidence_state_not_promoted · test_product_truth_beats_market · test_weighting_cannot_weaken_product_truth · test_no_invented_customer_fact · test_absence_claim_requires_coverage · test_truth_source_required · test_product_truth_reference_only · test_brand_truth_references_writing_control · test_fixture_not_production_truth · test_fixture_refused_in_production.

## Wave B — Angle + Validation
- test_no_asset_without_angle · test_angle_requires_citation · test_insight_is_synthesis · test_angle_logs_conflict · test_generic_affirmation_rejected · test_declaration_faith_gate · test_proof_fail_is_red · test_brand_fail_is_red · test_weak_resonance_no_corroboration_is_red · test_yellow_scope_limits_fanout · test_validation_human_review_threshold · test_counter_evidence_restated · test_red_angle_retained.

## Wave C — Architecture + Generation + Media
- test_no_brief_no_generation · test_weighting_profile_applied · test_platform_rules_applied · test_scope_exclusion_respected · test_prompt_order · test_negative_instruction · test_template_by_purpose · test_locked_phrase_consistency · test_three_failures_escalate · test_provider_dormant · test_layout_renderer_text · test_locked_text_verbatim · test_real_artifact_or_pending · test_video_without_provider_pending · test_video_package_complete · test_derivative_points_to_master.

## Wave D — QA + Family + Governance
- test_seven_gates_order · test_gate1_tier1_reject · test_gate1_tier2_review · test_gate2_interchangeability · test_gate2_visual_min3details · test_gate3_platform · test_gate3_autofix · test_gate4_cultural_human · test_gate4_faith · test_gate5_universality · test_gate5_overclaim · test_gate5_interpretation_leakage · test_gate5_absence_claim · test_gate6_contradiction · test_gate7_triggers · test_gate7_spotcheck · test_qa_record_permanent · test_failed_qa_cannot_enter_family · test_family_entry_criteria · test_anchor_locked_phrase · test_family_role_not_position · test_no_asset_quota · test_family_coverage_test · test_family_redundancy · test_asset_lineage_resolves · test_no_approval_by_association · test_new_version_needs_qa · test_retirement_preserves_history · test_truth_change_flags_dependents · test_usage_separate_from_asset.

## Wave E — Campaign
- test_audience_state_first · test_objective_before_slot · test_hard_exclusions · test_four_sequences · test_rotation_not_roundrobin · test_emotional_density · test_fatigue_influences_selection · test_cta_progression · test_missing_asset_gap_request · test_sequence_qa_can_fail · test_conversion_suppresses · test_yellow_scope_in_campaign · test_red_never_scheduled · test_campaign_cannot_schedule_retired.

## Wave F — Distribution + Learning
- test_manifest_generated · test_manifest_resolves_paths · test_export_rejects_unapproved · test_export_package_integrity · test_master_pack_generated · test_performance_cannot_mutate_truth · test_performance_ranking_only · test_ab_cannot_bypass_claims · test_artifact_checksum · test_archive_preserves · test_refresh_request.

## Media acceptance (package 06)
- test_real_asset_generation (static graphic → real artifact) · test_carousel_slide_count · test_cover_and_mockup · test_video_with_provider (dormant→pending) · test_video_without_provider · test_multi_model_routing · test_provider_swap · test_locked_text · test_export_package · test_traceability_artifact_to_truth.

## End-to-end acceptance (§90 / §11.23) — 12 scenarios
1 Green full chain+lineage · 2 Yellow scope propagation · 3 Red no fan-out + retained · 4 Generic output blocked (Anti-Slop/Interchangeability) · 5 Unsupported claim blocked (Truth Compliance) · 6 Missing campaign asset → gap request · 7 Asset retirement → dependents respond · 8 Truth change → impacted objects identifiable · 9 Audience conversion → acquisition suppressed · 10 Fatigue → recent exposure influences rotation · 11 Sensitive domain → human/safety gates not bypassable · 12 Visual interchangeability → attractive generic rejected.

## Additional required tests (§91) — 16
Product Truth beats Market · hypothesis not surfaced as fact · Yellow cannot escape scope · Red cannot create Asset Brief · failed QA asset cannot enter Family · family role ≠ sequence position · evergreen eligibility does not schedule · retired evidence blocks dependent claims · campaign cannot schedule retired asset · manual override traceable · performance cannot mutate Truth · A/B cannot bypass claim validation · Section 10 cannot freehand-generate · campaign QA can fail despite all assets passing · same asset may have multiple Usage Records · archive preserves history.

## Regression (existing factory — must stay green)
`node harness/qa-checks.mjs` (320/320) · `node harness/validate-opportunity.mjs --all` (603) · `node harness/writing-control.test.mjs` (16/16) · `node harness/publish-manifest.test.mjs` (14/14).
