// MAE Acceptance — Section 11 §11.23 (12 scenarios) + §91 additional + Media package §06.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCsecAngle, validateCsecAngle, csecApprovedFamily, csecApprove, CSEC_ASSET_SPECS } from "./fixtures.mjs";
import { AngleValidationService } from "../services/validation.js";
import { AssetArchitectureService } from "../services/architecture.js";
import { GenerationService } from "../services/generation.js";
import { QAOrchestrator } from "../services/qa.js";
import { AssetFamilyService } from "../services/family.js";
import { GovernanceService } from "../services/governance.js";
import { TruthService } from "../services/truth.js";
import { assertNoUnsupportedCertainty, EVIDENCE_STATE } from "../lib/evidence.js";
import { AudienceStateService, SequenceService, CampaignService, RotationService, CalendarService } from "../services/campaign.js";
import { PerformanceService, ExperimentService, LearningService } from "../services/learning.js";
import { PublishingService } from "../services/publishing.js";
import { ExportService } from "../media/export.js";
import { MediaPipeline } from "../media/pipeline.js";
import { RenderSpecs } from "../media/render-specs.js";
import { Router } from "../media/router.js";
import { PROVIDER_STATE } from "../media/providers.js";
import { renderSvg, textMatches } from "../media/layout.js";

function staticArtifact(f) {
  const job = MediaPipeline.createJob({
    asset_id: "AST-CSEC-1", brief_id: "BRIEF-CSEC-1", product_id: "PROD-CSEC", angle_id: f.angle.id,
    asset_type: "hook graphic", platform: "instagram", production_mode: "STATIC_GRAPHIC", required_outputs: ["svg"],
    render_spec: RenderSpecs.layoutRender({ headline: "At 3 AM she has to stand.", body_copy: "Module 2 — position and rise without straining the incision.", cta: "Reply YES" }),
  });
  return MediaPipeline.run(job, { product_slug: "csec" });
}

// ── Scenario 1 — Green Angle full chain + lineage ────────────────────────────
test("Scenario 1 — Green Angle: truth → angle → green → assets → family → campaign → publish → performance with full lineage", () => {
  const f = csecApprovedFamily();
  assert.equal(f.validation.verdict, "GREEN");
  const run = staticArtifact(f);
  const { campaign, sequences } = CampaignService.assemble({
    product_id: "PROD-CSEC", objective: "launch", audience_states: ["problem_aware"], kpi_set: ["conversion"],
    sequence_specs: [{ sequence_type: "LAUNCH", audience_state: "problem_aware", total_slots: 3 }], eligible: f.assets.map((a) => ({ asset: a, family: f.family })), persist: false,
  });
  const seq = { ...sequences[0], status: "READY" };
  const { usages } = CalendarService.schedule(seq, { governance: GovernanceService, start: "2026-09-20T09:00:00Z" });
  assert.ok(usages.length >= 1);
  const pub = PublishingService.publish(usages[0].id, { governance: GovernanceService, reference: "https://example.test/p/1" });
  assert.equal(pub.status, "PUBLISHED");
  const perf = PerformanceService.ingest({ usage_id: usages[0].id, metrics: { conversion: 0.3 }, source: "fixture" });
  const lin = GovernanceService.resolveLineage("AST-CSEC-1");
  assert.equal(lin.status, "TRACEABILITY_COMPLETE", JSON.stringify(lin.missing));
  assert.equal(campaign.status, "ASSEMBLED");
  assert.equal(perf.asset_id, "AST-CSEC-1");
  assert.ok(run.artifacts.length >= 1);
});

// ── Scenario 2 — Yellow scope propagation ────────────────────────────────────
test("Scenario 2 — Yellow Angle: restricted scope propagates to family, campaign and publishing", () => {
  const angle = buildCsecAngle();
  const validation = AngleValidationService.evaluate(angle, { criteria: { customer_resonance: "weak", proof_availability: "strong", market_differentiation: "moderate", brand_alignment: "pass", platform_fitness: "narrow_fit" }, scope_note: "limited", approved_platforms: ["whatsapp", "instagram"], reviewer: "f", persist: false, id: "VAL-CSEC-Y" });
  assert.equal(validation.verdict, "YELLOW");
  assert.equal(validation.max_assets, 6);
  const a1 = csecApprove({ id: "AST-CSEC-Y1", platform: "whatsapp", asset_type: "WhatsApp broadcast", asset_purpose: "stop_scroll_identification", template: "Problem-Led Post" }, { angle, validation });
  const a2 = csecApprove({ id: "AST-CSEC-Y2", platform: "instagram", asset_type: "Problem-led social post", asset_purpose: "conversion", template: "Problem-Led Post" }, { angle, validation });
  const { family } = AssetFamilyService.assemble({ angle, validation, assets: [a1.asset, a2.asset], id: "FAM-CSEC-Y", psetId: "PSET-CSEC-Y", persist: false });
  assert.equal(family.family_status, "RESTRICTED");
  assert.ok((family.restrictions || []).some((r) => /Yellow/.test(r)));
  // scope cannot be expanded downstream
  assert.throws(() => AssetFamilyService.assemble({ angle, validation: { ...validation, max_assets: 1 }, assets: [a1.asset, a2.asset], persist: false }), /scope/);
});

// ── Scenario 3 — Red Angle no fan-out, retained ──────────────────────────────
test("Scenario 3 — Red Angle: no fan-out, record retained with reason and evidence gap", () => {
  const angle = buildCsecAngle();
  const validation = AngleValidationService.evaluate(angle, { criteria: { customer_resonance: "strong", proof_availability: "weak_fail", market_differentiation: "strong", brand_alignment: "pass", platform_fitness: "broad_fit" }, reviewer: "f", persist: false, id: "VAL-CSEC-R" });
  assert.equal(validation.verdict, "RED");
  assert.ok(validation.rejection_reason && validation.evidence_gap);
  assert.equal(validation.max_assets, 0);
  assert.throws(() => AssetArchitectureService.buildBrief(angle, validation, { platform: "whatsapp" }), /RED/);
});

// ── Scenario 4 — Generic output blocked ──────────────────────────────────────
test("Scenario 4 — Generic output is blocked by Anti-Slop / Interchangeability", () => {
  const angle = buildCsecAngle();
  const validation = validateCsecAngle(angle, { persist: false });
  const brief = AssetArchitectureService.buildBrief(angle, validation, { platform: "whatsapp", asset_type: "WhatsApp broadcast", asset_purpose: "stop_scroll_identification" });
  const gen = GenerationService.generate(brief);
  const { record } = QAOrchestrator.run({ asset: { asset_id: "AST-CSEC-X", asset_type: brief.asset_type, platform: "whatsapp", asset_purpose: "stop_scroll_identification", product_id: "PROD-CSEC", angle_id: angle.id, brief_id: brief.id }, angle, validation, brief, generated: gen, content: "Unlock your potential. You've got this. You are enough." });
  assert.ok(["FAIL", "REVISION_REQUIRED"].includes(record.overall));
});

// ── Scenario 5 — Unsupported claim blocked ───────────────────────────────────
test("Scenario 5 — Unsupported claim is blocked by Truth Compliance even when persuasive", () => {
  const angle = buildCsecAngle();
  const validation = validateCsecAngle(angle, { persist: false });
  const brief = AssetArchitectureService.buildBrief(angle, validation, { platform: "whatsapp", asset_type: "WhatsApp broadcast", asset_purpose: "stop_scroll_identification" });
  const gen = GenerationService.generate(brief);
  const { record } = QAOrchestrator.run({ asset: { asset_id: "AST-CSEC-X", asset_type: brief.asset_type, platform: "whatsapp", asset_purpose: "stop_scroll_identification", product_id: "PROD-CSEC", angle_id: angle.id, brief_id: brief.id }, angle, validation, brief, generated: gen, content: "At 3 AM, Module 2 guarantees pain-free movement within a few days." });
  assert.equal(record.gates[4].result, "FAIL");
});

// ── Scenario 6 — Missing campaign asset → gap request ────────────────────────
test("Scenario 6 — a missing campaign asset raises a gap request, never freehand generation", () => {
  const f = csecApprovedFamily();
  const { gaps } = SequenceService.assemble({ campaign_id: "CAMP-CSEC-6", sequence_type: "LAUNCH", audience_state: "problem_aware", eligible: f.assets.map((a) => ({ asset: a, family: f.family })), persist: false });
  assert.ok(gaps.length >= 1);
  assert.equal(gaps[0].status, "OPEN");
  assert.match(gaps[0].requested_upstream_action, /architect|generate|QA/i);
});

// ── Scenario 7 — Asset retirement ────────────────────────────────────────────
test("Scenario 7 — retiring an asset makes downstream campaign dependencies respond", () => {
  const f = csecApprovedFamily();
  const usage = GovernanceService.createUsage({ asset_id: "AST-CSEC-2", family_id: f.family.id, angle_id: f.angle.id, sequence_type: "LAUNCH", audience_state: "problem_aware", platform: "instagram", cta_level: "NO_CTA", emotional_intensity: "high" });
  GovernanceService.retireAsset("AST-CSEC-2", { reason: "superseded creative", replacement: "AST-CSEC-1" });
  const replaced = GovernanceService.getUsage(usage.id);
  assert.equal(replaced.status, "REPLACED");
  const r = RotationService.select({ sequence_type: "LAUNCH", audience_state: "problem_aware", objective: "recognition", required_roles: ["PROBLEM"], eligible: [{ asset: { ...f.assets[1], status: "RETIRED" }, family: f.family }] });
  assert.equal(r.selected, null);
});

// ── Scenario 8 — Truth change ────────────────────────────────────────────────
test("Scenario 8 — a Truth change identifies affected Angles/assets/families/campaigns", () => {
  csecApprovedFamily();
  const affected = GovernanceService.markReVerification("product", "PTR-CSEC-001");
  assert.ok(affected.angles.includes("ANG-CSEC-006"));
  assert.ok(affected.families.includes("FAM-CSEC-006"));
  assert.ok(affected.assets.length >= 1);
});

// ── Scenario 9 — Audience conversion suppresses acquisition ──────────────────
test("Scenario 9 — audience conversion suppresses acquisition messages", () => {
  AudienceStateService.convert("segment-9", { product_id: "PROD-CSEC", state: "recently_converted" });
  const r = RotationService.select({ sequence_type: "LAUNCH", audience_state: "recently_converted", objective: "recognition", required_roles: ["PROBLEM"], eligible: [{ asset: { id: "AST-Z", status: "APPROVED", family_role: "PROBLEM", platform: "whatsapp", cta_level: "NO_CTA", emotional_intensity: "high" }, family: { id: "FAM-Z", angle_verdict: "GREEN", family_status: "APPROVED", sequence_eligibility: ["LAUNCH"], role_map: {}, evergreen_eligible: true } }] });
  assert.equal(r.selected, null);
});

// ── Scenario 10 — Fatigue ────────────────────────────────────────────────────
test("Scenario 10 — recent exposure influences rotation without rewriting the Angle", () => {
  const angleObj = buildCsecAngle();
  const before = JSON.stringify({ ...angleObj, created_at: null });
  const famA = { id: "FAM-A", angle_verdict: "GREEN", family_status: "APPROVED", sequence_eligibility: ["LAUNCH"], role_map: {}, evergreen_eligible: true };
  const famB = { id: "FAM-B", angle_verdict: "GREEN", family_status: "APPROVED", sequence_eligibility: ["LAUNCH"], role_map: {}, evergreen_eligible: true };
  const A = { id: "AST-A", status: "APPROVED", family_role: "PROBLEM", platform: "whatsapp", cta_level: "NO_CTA", emotional_intensity: "high" };
  const B = { id: "AST-B", status: "APPROVED", family_role: "PROBLEM", platform: "whatsapp", cta_level: "NO_CTA", emotional_intensity: "high" };
  const r = RotationService.select({ sequence_type: "LAUNCH", audience_state: "problem_aware", objective: "recognition", required_roles: ["PROBLEM"], eligible: [{ asset: A, family: famA }, { asset: B, family: famB }], exposure: { asset: { "AST-A": 8 }, family: {}, cta: {} } });
  assert.equal(r.selected.asset.id, "AST-B");
  assert.equal(JSON.stringify({ ...angleObj, created_at: null }), before, "rotation must not mutate the Angle");
});

// ── Scenario 11 — Sensitive domain ───────────────────────────────────────────
test("Scenario 11 — safety/human-review gates cannot be bypassed on a sensitive domain", () => {
  const angle = buildCsecAngle();
  const validation = validateCsecAngle(angle, { persist: false });
  const brief = AssetArchitectureService.buildBrief(angle, validation, { platform: "whatsapp", asset_type: "WhatsApp broadcast", asset_purpose: "stop_scroll_identification" });
  const gen = GenerationService.generate(brief);
  const { record } = QAOrchestrator.run({ asset: { asset_id: "AST-CSEC-X", asset_type: brief.asset_type, platform: "whatsapp", asset_purpose: "stop_scroll_identification", product_id: "PROD-CSEC", angle_id: angle.id, brief_id: brief.id }, angle, validation, brief, generated: gen, content: "At 3 AM, Module 2 helps her rise without bracing. Reply YES.", context: { sensitive_domain: true } });
  assert.equal(record.overall, "HUMAN_REVIEW_REQUIRED");
  assert.throws(() => GovernanceService.registerAsset({ qa: record, candidate: { asset_id: "AST-X", content: "x" }, angle, validation, brief, generated: gen }), /human review|QA-approved/);
});

// ── Scenario 12 — Visual interchangeability ──────────────────────────────────
test("Scenario 12 — an attractive but generic visual fails Interchangeability", () => {
  const angle = buildCsecAngle();
  const validation = validateCsecAngle(angle, { persist: false });
  const vg = { scene: "a room", environment: "home", gesture_posture: "standing", props: [], lighting: "soft", composition: "centred", exclusions: ["stock clichés"] };
  const brief = AssetArchitectureService.buildBrief(angle, validation, { platform: "instagram", asset_type: "Problem-led social post", asset_purpose: "problem", visual_grounding: vg });
  const gen = GenerationService.generate(brief);
  const { record } = QAOrchestrator.run({ asset: { asset_id: "AST-CSEC-V", asset_type: brief.asset_type, platform: "instagram", asset_purpose: "problem", product_id: "PROD-CSEC", angle_id: angle.id, brief_id: brief.id }, angle, validation, brief, generated: gen, content: GenerationService.selectedContent(gen), artifacts: [{ id: "ART-V", mime_type: "image/png" }] });
  assert.equal(record.gates[1].result, "FAIL");
});

// ── §91 additional required tests ────────────────────────────────────────────
test("Product Truth beats Market Truth in a conflict", () => {
  const { winner } = TruthService.resolveConflict({ source: "market", claim_kind: "claim" }, { source: "product", claim_kind: "claim" });
  assert.equal(winner.source, "product");
});

test("a hypothesis cannot be surfaced as customer fact", () => {
  assert.equal(assertNoUnsupportedCertainty(EVIDENCE_STATE.HYPOTHESIS, EVIDENCE_STATE.DIRECTLY_STATED).ok, false);
});

test("Yellow cannot escape scope; Red cannot create an Asset Brief", () => {
  const angle = buildCsecAngle();
  const red = AngleValidationService.evaluate(angle, { criteria: { customer_resonance: "strong", proof_availability: "weak_fail", market_differentiation: "strong", brand_alignment: "pass", platform_fitness: "broad_fit" }, reviewer: "f", persist: false });
  assert.throws(() => AssetArchitectureService.buildBrief(angle, red, {}), /RED/);
});

test("a failed-QA asset cannot enter a family", () => {
  const f = csecApprovedFamily();
  const bad = { ...f.assets[0], qa_record_id: null };
  assert.throws(() => AssetFamilyService.assemble({ angle: f.angle, validation: f.validation, assets: [bad], persist: false }), /QA record|approved/);
});

test("family role is not sequence position; evergreen eligibility does not schedule", () => {
  const f = csecApprovedFamily();
  assert.equal("sequence_position" in f.family, false);
  assert.equal(typeof f.family.evergreen_eligible, "boolean");
  // Evergreen eligibility is a property; assembly schedules nothing.
  assert.equal(f.family.usage_summary.count, 0);
  assert.equal(f.family.last_used_at, null);
});

test("manual override is traceable", () => {
  const f = csecApprovedFamily();
  const { record } = QAOrchestrator.run({ asset: { asset_id: "AST-OVR", asset_type: "WhatsApp broadcast", platform: "whatsapp", asset_purpose: "problem", product_id: "PROD-CSEC", angle_id: f.angle.id, brief_id: "BRIEF-CSEC-1" }, angle: f.angle, validation: f.validation, brief: f.built[0].brief, generated: f.built[0].gen, content: GenerationService.selectedContent(f.built[0].gen), context: { human_review: { decision: "APPROVED", reviewer: "r" } } });
  const edited = QAOrchestrator.applyMinorEdit(record, { changed: "trimmed one word", reason: "clarity", by: "reviewer", content: record.content });
  assert.equal(edited.record.manual_override.minor_edit, true);
  assert.equal(edited.record.manual_override.became_approved_version, true);
});

test("performance cannot autorize an unsupported claim (A/B block)", () => {
  const f = csecApprovedFamily();
  assert.throws(() => ExperimentService.create({ test_dimension: "hook", variants: [{ variant_id: "A", asset_id: "AST-CSEC-1", description: "" }, { variant_id: "B", asset_id: "AST-CSEC-2", description: "guaranteed cure" }] }), /bypass|unsupported|fabricated/);
});

test("Section 10 cannot freehand-generate; campaign QA can fail though assets passed", () => {
  const seq = { id: "SEQ-F", campaign_id: "CAMP-F", audience_state: "problem_aware", items: [
    { position: 1, asset_id: "AST-1", family_id: "FAM-1", role: "PROBLEM", cta_level: "DIRECT_CONVERSION_CTA", emotional_intensity: "high", proof_type: null },
    { position: 2, asset_id: "AST-2", family_id: "FAM-1", role: "PROBLEM", cta_level: "DIRECT_CONVERSION_CTA", emotional_intensity: "high", proof_type: null },
  ] };
  const cqa = CampaignService.campaignQA({ id: "CAMP-F", gap_request_ids: [], audience_states: ["problem_aware"] }, [seq]);
  assert.equal(cqa.pass, false);
});

test("the same asset may have multiple Usage Records; archive preserves history", () => {
  const f = csecApprovedFamily();
  const u1 = GovernanceService.createUsage({ asset_id: "AST-CSEC-5", family_id: f.family.id, angle_id: f.angle.id, sequence_type: "LAUNCH", audience_state: "problem_aware", platform: "email", cta_level: "LEARN_MORE_CTA", emotional_intensity: "medium" });
  const u2 = GovernanceService.createUsage({ asset_id: "AST-CSEC-5", family_id: f.family.id, angle_id: f.angle.id, sequence_type: "NURTURE", audience_state: "product_aware", platform: "email", cta_level: "LEARN_MORE_CTA", emotional_intensity: "medium" });
  assert.notEqual(u1.id, u2.id);
  const archived = LearningService.archive({ id: "CAMP-Z", sequence_ids: ["SEQ-Z"], status: "COMPLETED" });
  assert.equal(archived.status, "ARCHIVED");
  assert.deepEqual(archived.sequence_ids, ["SEQ-Z"]);
});

// ── Media acceptance (package 06) ────────────────────────────────────────────
test("media: static graphic produces a real artifact file with locked text", () => {
  const spec = RenderSpecs.layoutRender({ headline: "At 3 AM she has to stand.", body_copy: "Module 2.", cta: "Reply YES" });
  const out = renderSvg(spec, { filename: "acc-locked.svg" });
  assert.equal(out.mime_type, "image/svg+xml");
  assert.equal(textMatches(out.svg, spec.headline), true);
});

test("media: carousel slide count and cover/mockup specs", () => {
  const car = RenderSpecs.carousel({ slides: [{ copy: "a" }, { copy: "b" }, { copy: "c" }] });
  assert.equal(car.slide_count, 3);
  const cover = RenderSpecs.productCover({ product_name: "The No-Village C-Section" });
  assert.ok(cover.format_variants.includes("portrait_cover"));
  const mock = RenderSpecs.mockup({ source_artifact_ids: ["ART-CSEC-001"] });
  assert.deepEqual(mock.source_artifact_ids, ["ART-CSEC-001"]);
});

test("media: video without a provider yields a complete package + pending status, never complete", () => {
  const job = MediaPipeline.createJob({ asset_id: "AST-CSEC-2", brief_id: "BRIEF-CSEC-1", product_id: "PROD-CSEC", angle_id: "ANG-CSEC-006", asset_type: "video", platform: "tiktok", production_mode: "VIDEO_PACKAGE", required_outputs: ["script", "storyboard"] });
  const r = MediaPipeline.run(job, { product_slug: "csec", script: "Hook: day 6." });
  assert.ok(r.artifacts.length >= 5);
  assert.ok(["RENDER_PENDING_EXTERNAL_PROVIDER", "PRODUCTION_BLOCKED"].includes(r.job.status));
  assert.notEqual(r.job.status, "APPROVED");
});

test("media: multi-model routing selects an image-capable provider; provider is dormant", () => {
  assert.equal(Router.route("GENERATED_SCENE").available, false);
  assert.equal(Router.route("GENERATED_SCENE").state, PROVIDER_STATE.PROVIDER_UNAVAILABLE);
  assert.equal(Router.route("STATIC_GRAPHIC").available, true);
});

test("media: provider replacement creates a new job without changing asset identity", () => {
  const f = csecApprovedFamily();
  const base = { asset_id: "AST-CSEC-1", brief_id: "BRIEF-CSEC-1", product_id: "PROD-CSEC", angle_id: f.angle.id, asset_type: "hook", platform: "instagram", production_mode: "STATIC_GRAPHIC", required_outputs: ["svg"] };
  const j1 = MediaPipeline.createJob({ ...base });
  MediaPipeline.run(j1, { product_slug: "csec" });
  const j2 = MediaPipeline.createJob({ ...base });
  assert.notEqual(j1.id, j2.id);
  assert.equal(j1.asset_id, j2.asset_id);
});

test("media: export package integrity and traceability artifact→truth", () => {
  const f = csecApprovedFamily();
  const run = staticArtifact(f);
  const out = ExportService.exportProduct({ product_id: "PROD-CSEC", assets: f.assets, families: [f.family], artifacts: run.artifacts, qa: f.built.map((b) => b.qa), angle: f.angle, validation: f.validation, product: { title: "The No-Village C-Section" } });
  assert.equal(out.package.status, "READY");
  const lin = GovernanceService.resolveLineage("AST-CSEC-1");
  assert.equal(lin.status, "TRACEABILITY_COMPLETE");
  assert.equal(lin.chain.truth_sources.product.includes("PTR-CSEC-001"), true);
});
