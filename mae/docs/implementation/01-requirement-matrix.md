# MAE-01 · Requirement Matrix

Every normative rule maps to a component, an enforcement point, and a test. Status: TODO / IMPLEMENTED / TESTED / BLOCKED. (Updated through the build; see `07-implementation-progress.md`.)

Legend: **E** = deterministic enforcement · **J** = judgment (critic) · **H** = human review.

## Wave A — Truth foundation
| REQ-ID | Src | Rule | Component | Enforcement | Test | Status |
|---|---|---|---|---|---|---|
| REQ-A-001 | S2/§14 | Four Truths are distinct stores, never collapsed | truth service | E (separate schemas) | test_truths_separate | TESTED |
| REQ-A-002 | S2 §6 | Evidence state: observed/inferred/hypothesised never equivalent | evidence lib | E (enum + carry-through) | test_evidence_state_not_promoted | TESTED |
| REQ-A-003 | S2 §12 | Conflict hierarchy Product→Customer→Brand→Market | truth service | E (`resolveConflict`) | test_product_truth_beats_market | TESTED |
| REQ-A-004 | S2 §10 | Truth weighting is emphasis, never authority | truth service | E (profile lookup) | test_weighting_cannot_weaken_product_truth | TESTED |
| REQ-A-005 | S2 §16/§17 | No freehand emotional/market invention | truth service + generation | E (grounding present) | test_no_invented_customer_fact | TESTED |
| REQ-A-006 | S2 §711 | Absence-claim safeguard (scan coverage caveat) | MIF schema | E (caveat required for unclaimed) | test_absence_claim_requires_coverage | TESTED |
| REQ-A-007 | S1/S9 | Every truth record traceable to source | schema | E (source required) | test_truth_source_required | TESTED |
| REQ-A-008 | S2 §13 | Product Truth is inherited, not shadowed | product-truth-ref | E (references factory ids) | test_product_truth_reference_only | TESTED |
| REQ-A-009 | WC | Brand writing register reuses Writing Control (no fork) | brand-truth | E (references config) | test_brand_truth_references_writing_control | TESTED |
| REQ-A-010 | M/§93 | Synthetic fixtures labelled; never production Truth | fixtures | E (`is_fixture`, `provenance=synthetic`) | test_fixture_not_production_truth | TESTED |

## Wave B — Angle intelligence
| REQ-ID | Src | Rule | Component | Enforcement | Test | Status |
|---|---|---|---|---|---|---|
| REQ-B-001 | S3 | No asset generated without an Angle Record | angle + architecture | E (brief requires angle) | test_no_asset_without_angle | TESTED |
| REQ-B-002 | S3 Tier3 | ≥1 CRF citation required before validation | truth/angle | E (`validateAngleCompleteness`) | test_angle_requires_citation | TESTED |
| REQ-B-003 | S3 | Insight labelled Strategic Synthesis, not fact | angle schema | E (enum) | test_insight_is_synthesis | TESTED |
| REQ-B-004 | S3.4/§37 | Conflict + resolution logged on the angle | angle | E (truth_conflict_log) | test_angle_logs_conflict | TESTED |
| REQ-B-005 | S3.10 | Affirmation requires a populated grounding block | affirmation grounding | E (`validateAffirmationGrounding`) | test_generic_affirmation_rejected | TESTED |
| REQ-B-006 | S3.10.7 | Faith register gated by CRF evidence + approval | angle/affirmation | E (faith gate) | test_declaration_faith_gate | TESTED |
| REQ-B-007 | S4 §4.4 | Green/Yellow/Red verdict logic; C2/C4 hard blockers | validation service | E | test_proof_fail_is_red / test_brand_fail_is_red | TESTED |
| REQ-B-008 | S4 §4.4 | Yellow restricted scope (4–6 assets) | validation | E (`max_assets`) | test_yellow_scope_limits_fanout | TESTED |
| REQ-B-009 | S4 §4.6 | Human review thresholds (moderate/sensitive/faith) | validation | E (triggers) | test_validation_human_review_threshold | TESTED |
| REQ-B-010 | S4 §4.9 | Counter-evidence restatement mandatory | validation | E (field required when failing) — enforced at verdict record | test_counter_evidence_restated | TESTED |
| REQ-B-011 | §76 | Red retained, not deleted (reason + evidence gap) | angle store | E (status RED kept) | test_red_angle_retained | TESTED |

## Wave C — Asset production + media
| REQ-ID | Src | Rule | Component | Enforcement | Test | Status |
|---|---|---|---|---|---|---|
| REQ-C-001 | S5 §5.7 | Asset generated from an Asset Brief, never raw angle | architecture | E | test_no_brief_no_generation | TESTED |
| REQ-C-002 | S5.2 | Asset-specific truth weighting applied | architecture | E (matrix lookup) | test_weighting_profile_applied | TESTED |
| REQ-C-003 | S5.3 | Platform-native rules applied | architecture | E (per-platform) | test_platform_rules_applied | TESTED |
| REQ-C-004 | S5.5 | Validation scope binding on architecture (no LinkedIn if excluded) | architecture | E | test_scope_exclusion_respected | TESTED |
| REQ-C-005 | S6.2 | Prompt order: constraints → template → grounding → platform → negative → task | generation | E (assembly order) | test_prompt_order | TESTED |
| REQ-C-006 | S6.2.1 | Explicit negative instruction present | generation | E | test_negative_instruction | TESTED |
| REQ-C-007 | S6.3 | Structural template fixed by Asset Purpose | architecture/generation | E (mapping) | test_template_by_purpose | TESTED |
| REQ-C-008 | S6.8 | Locked Phrase Set consistency across family | generation/consistency | E check | test_locked_phrase_consistency | TESTED |
| REQ-C-009 | S6.9 | 3 consecutive failures → brief review | generation | E (counter) | test_three_failures_escalate | TESTED |
| REQ-C-010 | Media §5 | Real file when provider supports; else explicit pending | media pipeline | E (status) | test_real_artifact_or_pending | TESTED |
| REQ-C-011 | Media §9 | Locked text not paraphrased by renderer | layout renderer | E (locked text verbatim) | test_locked_text_verbatim | TESTED |
| REQ-C-012 | Media §11 | Derivatives point to master; not overwritten | export | E | test_derivative_points_to_master | TESTED |
| REQ-C-013 | Media §9/§14 | Video without provider → package + `RENDER_PENDING_EXTERNAL_PROVIDER` | media video | E | test_video_without_provider_pending | TESTED |
| REQ-C-014 | Media §2 | Provider workers dormant, replaceable; no vendor in business rules | router/providers | E | test_provider_dormant | TESTED |
| REQ-C-015 | Media §8 | Text-heavy: layout renderer handles typography | layout | E | test_layout_renderer_text | TESTED |

## Wave D — QA, family, governance
| REQ-ID | Src | Rule | Component | Enforcement | Test | Status |
|---|---|---|---|---|---|---|
| REQ-D-001 | S7 | Seven gates run in fixed order, each records a result | qa orchestrator | E | test_seven_gates_order | TESTED |
| REQ-D-002 | S7.2 | Gate 1 Tier-1 banned phrase → auto-reject | anti-slop | E | test_gate1_tier1_reject | TESTED |
| REQ-D-003 | S7.3 | Gate 2 interchangability (copy + visual ≥3 scene details) | interchangeability | J/E | test_gate2_interchangeability | TESTED |
| REQ-D-004 | S7.4 | Gate 3 platform fitness (length/format/CTA; safe auto-fix) | platform fitness | E | test_gate3_platform | TESTED |
| REQ-D-005 | S7.5 | Gate 4 brand/cultural (cultural = human) | brand/cultural | E/J/H | test_gate4_cultural_human | TESTED |
| REQ-D-006 | S7.6 | Gate 5 truth compliance (overclaim/universality/leakage/absence) | truth compliance | E | test_gate5_universality / test_gate5_overclaim | TESTED |
| REQ-D-007 | S7.7 | Gate 6 consistency lock contradiction → reject | consistency | E | test_gate6_contradiction | TESTED |
| REQ-D-008 | S7.8 | Gate 7 triggers (cultural, faith, yellow, sensitive, first asset) | human router | E triggers | test_gate7_triggers | TESTED |
| REQ-D-009 | S8.2 | Entry criteria; only approved assets enter family | family | E | test_failed_qa_cannot_enter_family | TESTED |
| REQ-D-010 | S8.5 | Anchor establishes Locked Phrase Set | family | E | test_anchor_locked_phrase | TESTED |
| REQ-D-011 | S8.10/§37 | Family role ≠ sequence position (separate fields) | family/campaign | E | test_family_role_not_position | TESTED |
| REQ-D-012 | S8 §8.4 | 13 assets not a quota | family | E (no forced count) | test_no_asset_quota | TESTED |
| REQ-D-013 | S9 §9.55 | Every asset fully traceable (Asset→Brief→Angle→Truth) | governance | E (`trace`) | test_asset_lineage_resolves | TESTED |
| REQ-D-014 | S9 §9.65 | No approval by association | governance | E | test_no_approval_by_association | TESTED |
| REQ-D-015 | S9 §9.35 | Creative change → new version, no auto-inherit approval | governance | E | test_new_version_needs_qa | TESTED |
| REQ-D-016 | S9 §9.40 | Retirement ≠ deletion | governance | E (status, retained) | test_retirement_preserves_history | TESTED |
| REQ-D-017 | S9 §9.33 | Source change → dependency review | dependency service | E | test_truth_change_flags_dependents | TESTED |

## Wave E — Campaign
| REQ-ID | Src | Rule | Component | Enforcement | Test | Status |
|---|---|---|---|---|---|---|
| REQ-E-001 | S10 §10.2 | Audience state before asset selection | campaign | E | test_audience_state_first | TESTED |
| REQ-E-002 | S10 §10.2 | Objective before calendar fill | campaign | E | test_objective_before_slot | TESTED |
| REQ-E-003 | S10 §10.1 | Hard exclusions (Red/retired/stale/scope/suppression) | rotation | E | test_hard_exclusions | TESTED |
| REQ-E-004 | S10 §10.3 | Four sequences implemented | sequence | E | test_four_sequences | TESTED |
| REQ-E-005 | S10 §10.4 | Evergreen = inventory not queue; no round-robin | rotation | E | test_rotation_not_roundrobin | TESTED |
| REQ-E-006 | S10 §10.5 | Emotional intensity managed through time | rotation | E (band balance) | test_emotional_density | TESTED |
| REQ-E-007 | S10 §10.6 | Frequency/fatigue + conservative defaults | fatigue | E | test_fatigue_influences_selection | TESTED |
| REQ-E-008 | S10 §10.8 | CTA progression (no identical hard CTA) | campaign | E | test_cta_progression | TESTED |
| REQ-E-009 | S10 §10.10 | Gap request when no eligible asset | gap | E (`raiseGap`) | test_missing_asset_gap_request | TESTED |
| REQ-E-010 | S10 §10.12 | Sequence QA separate from asset QA | campaign qa | E/J | test_sequence_qa_can_fail | TESTED |
| REQ-E-011 | S10 §10.13 | Conversion suppresses acquisition; state change | audience state | E | test_conversion_suppresses | TESTED |
| REQ-E-012 | S10 §10.14 | Performance is a ranking signal only | learning | E | test_performance_ranking_only | TESTED |

## Wave F — Distribution + learning
| REQ-ID | Src | Rule | Component | Enforcement | Test | Status |
|---|---|---|---|---|---|---|
| REQ-F-001 | Media §5/§10 | Master Pack + Asset Manifest (JSON+CSV) generated from records | manifest/masterpack | E | test_manifest_generated | TESTED |
| REQ-F-002 | Media §9 | Export QA: only approved, no retired/failed/temp/secret | export | E | test_export_rejects_unapproved | TESTED |
| REQ-F-003 | Media §9 | Export ZIP contains eligible approved + Master Pack + manifest | export | E | test_export_package_integrity | TESTED |
| REQ-F-004 | S9 §9.50 | Performance cannot rewrite Truth | learning | E | test_performance_cannot_mutate_truth | TESTED |
| REQ-F-005 | S10 §10.14 | A/B cannot bypass QA/claims | experiment | E | test_ab_cannot_bypass_claims | TESTED |
| REQ-F-006 | Media §6 | Checksums recorded for final artifacts | media artifact | E | test_artifact_checksum | TESTED |
| REQ-F-007 | §97 | Archive preserves history (no hard delete) | governance | E | test_archive_preserves | TESTED |

## Global / acceptance
| REQ-ID | Src | Rule | Enforcement | Test | Status |
|---|---|---|---|---|---|
| REQ-G-001 | §90 | 12 end-to-end scenarios pass | E/J/H | acceptance suite | TESTED |
| REQ-G-002 | §91 | 16 additional required tests | E | acceptance suite | TESTED |
| REQ-G-003 | §116 | Generator uses only grounded inputs; never fabricates | E | test_no_fabrication | TESTED |
| REQ-G-004 | §108 | No premature completion claims | process | progress doc honesty | TESTED |
| REQ-G-005 | §85 | Existing factory untouched except surgical integration | process | git cleanliness check | TESTED |
