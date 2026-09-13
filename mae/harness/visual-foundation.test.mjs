// MAE Visual Production Foundation — deterministic tests. No provider, no image, no network.
// Run: node mae/harness/visual-foundation.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { getAjv, schemaId } from "../lib/schema.js";
import { VisualGroundingService } from "../services/visual-grounding.js";
import { VisualAssetSpecService, ProductionModeService } from "../services/visual-asset-spec.js";
import { buildImageRenderSpec, compilePromptPackage, VisualPromptService } from "../media/prompt-compiler.js";
import { VisualQA } from "../services/visual-qa.js";
import { BrandTruthService } from "../services/brand.js";
import { MediaPipeline } from "../media/pipeline.js";
import { Router } from "../media/router.js";
import { PROVIDER_STATE } from "../media/providers.js";
import { renderSvg, textMatches } from "../media/layout.js";
import { RenderSpecs } from "../media/render-specs.js";
import { csecAngleWithValidation, csecApprovedFamily, csecVisualFoundation } from "./fixtures.mjs";

const brand = BrandTruthService.loadBrand();
const vg = (angle, opts = {}) => VisualGroundingService.build(angle, { brandTruth: brand, id: "VG-CSEC-006", ...opts });

// 1
test("1. Angle -> VisualGroundingBlock", () => {
  const { angle } = csecAngleWithValidation();
  const g = vg(angle);
  assert.equal(g.class, "visual_grounding");
  assert.ok(g.scene && g.environment && g.gesture_posture);
});

// 2
test("2. grounding validates against the canonical visual-grounding schema", () => {
  const { angle } = csecAngleWithValidation();
  const g = vg(angle);
  const ajv = getAjv();
  assert.equal(ajv.validate(schemaId("visual-grounding.schema.json"), g), true, JSON.stringify(ajv.errors));
});

// 3
test("3. missing required scene data fails deterministically", () => {
  const bad = { id: "ANG-BAD-001", tier1: { scene: "", customer: "" }, tier2: {}, tier3: { source_evidence: [] } };
  assert.throws(() => vg(bad), /scene|required|truth-supported/i);
});

// 4
test("4. Day-6 canonical fixture produces non-null grounding", () => {
  const f = csecVisualFoundation();
  assert.ok(f.grounding, "grounding must not be null");
  assert.equal(f.qa.pass, true, JSON.stringify(f.qa.checks));
});

// 5
test("5. grounding references ANG-CSEC-006", () => {
  assert.equal(csecVisualFoundation().grounding.provenance.angle_id, "ANG-CSEC-006");
});

// 6
test("6. grounding preserves Customer Truth provenance", () => {
  const g = csecVisualFoundation().grounding;
  assert.ok(g.provenance.customer_truth_refs.includes("CRF-CSEC-014"), JSON.stringify(g.provenance.customer_truth_refs));
  assert.ok(g.provenance.product_truth_refs.includes("PTR-CSEC-001"));
});

// 7
test("7. production interpretation is not mislabelled as Customer Truth", () => {
  const g = csecVisualFoundation().grounding;
  assert.equal(g.detail_classes.lighting, "production_instruction");
  assert.equal(g.detail_classes.scene, "source_grounded");
  assert.match(g.lighting, /implied by|night/i);
});

// 8
test("8. unsupported customer detail is not silently introduced", () => {
  const g = csecVisualFoundation().grounding;
  assert.equal(g.wardrobe, null, "no wardrobe in Truth -> must remain null");
  for (const p of g.props) assert.ok(["bed frame", "dresser"].includes(p), `unexpected prop ${p}`);
});

// 9
test("9. VisualGrounding -> VisualAssetSpec", () => {
  const f = csecVisualFoundation();
  assert.equal(f.spec.class, "visual_asset_spec");
  assert.equal(f.spec.visual_grounding_id, f.grounding.id);
  assert.equal(f.spec.compound, true, "generated scene + deterministic overlays => compound");
});

// 10
test("10. VisualAssetSpec validates against its schema", () => {
  const f = csecVisualFoundation();
  const ajv = getAjv();
  assert.equal(ajv.validate(schemaId("visual-asset-spec.schema.json"), f.spec), true, JSON.stringify(ajv.errors));
});

// 11
test("11. spec references grounding (and angle)", () => {
  const f = csecVisualFoundation();
  assert.equal(f.spec.visual_grounding_id, f.grounding.id);
  assert.equal(f.spec.angle_id, "ANG-CSEC-006");
});

// 12
test("12. deterministic production-mode decision", () => {
  const f = csecVisualFoundation();
  const a = ProductionModeService.decide({ brief: f.brief, grounding: f.grounding, platform: "instagram" });
  const b = ProductionModeService.decide({ brief: f.brief, grounding: f.grounding, platform: "instagram" });
  assert.deepEqual(a, b);
  assert.equal(a.mode, "GENERATED_SCENE");
  assert.equal(a.compound, true);
  assert.equal(ProductionModeService.decide({ grounding: null, platform: "instagram" }).mode, "STATIC_GRAPHIC");
});

// 13
test("13. VisualAssetSpec -> ImageRenderSpec (existing shape)", () => {
  const f = csecVisualFoundation();
  const rs = buildImageRenderSpec(f.grounding, f.spec, brand);
  assert.equal(rs.spec_type, "ImageRenderSpec");
  assert.equal(rs.scene, f.grounding.scene);
  assert.equal(rs.aspect_ratio, f.spec.aspect_ratio);
  assert.ok(rs.negative_constraints.length >= 1);
});

// 14
test("14. ImageRenderSpec -> provider-neutral prompt package", () => {
  const f = csecVisualFoundation();
  const pkg = compilePromptPackage({ grounding: f.grounding, spec: f.spec, brand, productTruth: { prohibited_claims: ["you will heal faster"] } });
  assert.ok(pkg.prompt.includes(f.grounding.scene));
  assert.ok(pkg.negative_prompt.length > 0);
  assert.equal(pkg.aspect_ratio, f.spec.aspect_ratio);
  assert.equal(pkg.grounding_refs.visual_grounding_id, f.grounding.id);
  assert.equal(pkg.spec_refs.visual_asset_spec_id, f.spec.id);
});

// 15
test("15. same input produces identical prompt package", () => {
  const f = csecVisualFoundation();
  const a = compilePromptPackage({ grounding: f.grounding, spec: f.spec, brand, productTruth: null });
  const b = compilePromptPackage({ grounding: f.grounding, spec: f.spec, brand, productTruth: null });
  assert.deepEqual(a, b);
});

// 16
test("16. exclusions produce deterministic negative constraints (categorised)", () => {
  const f = csecVisualFoundation();
  const pkg = compilePromptPackage({ grounding: f.grounding, spec: f.spec, brand, productTruth: { prohibited_claims: ["guaranteed pain-free movement"] } });
  const cats = new Set(pkg.negative_constraints.map((c) => c.category));
  assert.ok(cats.has("grounding_exclusion"));
  assert.ok(cats.has("product_truth"));
  for (const c of pkg.negative_constraints) assert.ok(c.reason && c.text);
  // deterministic across calls
  const pkg2 = compilePromptPackage({ grounding: f.grounding, spec: f.spec, brand, productTruth: { prohibited_claims: ["guaranteed pain-free movement"] } });
  assert.deepEqual(pkg.negative_constraints, pkg2.negative_constraints);
});

// 17
test("17. Product Truth boundary is not converted into an unsupported visual claim", () => {
  const f = csecVisualFoundation();
  const pkg = compilePromptPackage({ grounding: f.grounding, spec: f.spec, brand, productTruth: { prohibited_claims: ["guaranteed pain-free movement"] } });
  assert.ok(!pkg.prompt.includes('guaranteed pain-free movement'), "prompt must not state the prohibited claim positively");
  assert.ok(pkg.negative_prompt.includes("guaranteed pain-free movement"), "prohibited claim must appear as a negative constraint");
});

// 18
test("18. generated-scene production requires grounding", () => {
  const { angle } = csecAngleWithValidation();
  const qa = VisualQA.preGeneration({ angle, grounding: null, spec: { id: "VAS-X", production_mode: "GENERATED_SCENE" }, promptPackage: null, requiresVisual: true });
  assert.equal(qa.pass, false);
  assert.equal(qa.checks.find((c) => c.check === "grounding_exists_when_required").pass, false);
});

// 19
test("19. generated-scene production requires a VisualAssetSpec", () => {
  const { angle } = csecAngleWithValidation();
  const g = vg(angle);
  const qa = VisualQA.preGeneration({ angle, grounding: g, spec: null, promptPackage: null, requiresVisual: true });
  assert.equal(qa.pass, false);
  assert.equal(qa.checks.find((c) => c.check === "spec_exists").pass, false);
});

// 20
test("20. provider-ready job reaches the existing provider boundary", () => {
  const f = csecVisualFoundation();
  const job = MediaPipeline.createJob({
    asset_id: "AST-CSEC-1", brief_id: f.brief.id, product_id: f.angle.product_id, angle_id: f.angle.id,
    asset_type: "Generated scene", platform: "instagram", production_mode: f.spec.production_mode, required_outputs: ["png"],
    visual_grounding_id: f.grounding.id, visual_asset_spec_id: f.spec.id, prompt_package: f.promptPackage, render_spec: f.imageRenderSpec,
  });
  const route = Router.route(job.production_mode);
  assert.equal(route.capability, "image_generation");
  assert.equal(route.available, false);
  assert.equal(route.state, PROVIDER_STATE.PROVIDER_UNAVAILABLE);
  assert.equal(job.visual_grounding_id, f.grounding.id);
  assert.equal(job.visual_asset_spec_id, f.spec.id);
});

// 21
test("21. provider unavailable returns an honest blocked state", () => {
  const f = csecVisualFoundation();
  const job = MediaPipeline.createJob({
    asset_id: "AST-CSEC-1", brief_id: f.brief.id, product_id: f.angle.product_id, angle_id: f.angle.id,
    asset_type: "Generated scene", platform: "instagram", production_mode: "GENERATED_SCENE", required_outputs: ["png"],
    visual_grounding_id: f.grounding.id, visual_asset_spec_id: f.spec.id, prompt_package: f.promptPackage, render_spec: f.imageRenderSpec,
  });
  const r = MediaPipeline.run(job, { product_slug: "csec" });
  assert.ok(["PRODUCTION_BLOCKED", "RENDER_PENDING_EXTERNAL_PROVIDER"].includes(r.job.status));
  assert.match(String(r.job.blocked_reason), /provider/i);
});

// 22
test("22. no fake media artifact is produced for a blocked image job", () => {
  const f = csecVisualFoundation();
  const job = MediaPipeline.createJob({
    asset_id: "AST-CSEC-1", brief_id: f.brief.id, product_id: f.angle.product_id, angle_id: f.angle.id,
    asset_type: "Generated scene", platform: "instagram", production_mode: "GENERATED_SCENE", required_outputs: ["png"],
    visual_grounding_id: f.grounding.id, visual_asset_spec_id: f.spec.id, prompt_package: f.promptPackage, render_spec: f.imageRenderSpec,
  });
  const r = MediaPipeline.run(job, { product_slug: "csec" });
  assert.equal(r.artifacts.length, 0);
});

// 23
test("23. no provider/model/cost metadata is fabricated", () => {
  const f = csecVisualFoundation();
  const job = MediaPipeline.createJob({
    asset_id: "AST-CSEC-1", brief_id: f.brief.id, product_id: f.angle.product_id, angle_id: f.angle.id,
    asset_type: "Generated scene", platform: "instagram", production_mode: "GENERATED_SCENE", required_outputs: ["png"],
    visual_grounding_id: f.grounding.id, visual_asset_spec_id: f.spec.id, prompt_package: f.promptPackage, render_spec: f.imageRenderSpec,
  });
  const r = MediaPipeline.run(job, { product_slug: "csec" });
  assert.equal(r.job.provider, null);
  assert.equal(r.job.model, undefined);
  assert.equal(r.job.cost, undefined);
});

// 24
test("24. existing basic SVG path still works", () => {
  const spec = RenderSpecs.layoutRender({ headline: "At 3 AM she has to stand.", body_copy: "Module 2.", cta: "Reply YES" });
  const out = renderSvg(spec, { filename: "vf-locked.svg" });
  assert.equal(out.mime_type, "image/svg+xml");
  assert.equal(textMatches(out.svg, spec.headline), true);
});

// 25
test("25. existing Asset Family architecture remains unchanged", () => {
  const f = csecApprovedFamily();
  assert.equal(f.family.id, "FAM-CSEC-006");
  assert.ok(f.family.approved_asset_ids.length >= 6);
});

// 26 (acceptance) — end-to-end DAY-6 dry trace
test("26. DAY-6 end-to-end dry trace reaches PROVIDER_UNAVAILABLE", () => {
  const f = csecVisualFoundation();
  const job = MediaPipeline.createJob({
    asset_id: "AST-CSEC-1", brief_id: f.brief.id, product_id: f.angle.product_id, angle_id: f.angle.id,
    asset_type: "Generated scene", platform: "instagram", production_mode: f.spec.production_mode, required_outputs: ["png"],
    visual_grounding_id: f.grounding.id, visual_asset_spec_id: f.spec.id, prompt_package: f.promptPackage, render_spec: f.imageRenderSpec,
  });
  const r = MediaPipeline.run(job, { product_slug: "csec" });
  console.log(JSON.stringify({
    trace: "ANG-CSEC-006 -> VG -> VAS -> mode -> ImageRenderSpec -> prompt -> job -> boundary",
    angle_id: f.angle.id,
    visual_grounding_id: f.grounding.id,
    visual_asset_spec_id: f.spec.id,
    production_mode: f.spec.production_mode,
    compound: f.spec.compound,
    prompt_package_id: f.promptPackage.id,
    job_id: job.id,
    route_capability: r.route.capability,
    route_available: r.route.available,
    job_status: r.job.status,
    blocked_reason: r.job.blocked_reason,
    artifacts: r.artifacts.length,
  }, null, 2));
  assert.equal(r.route.capability, "image_generation");
  assert.equal(r.route.available, false);
  assert.equal(r.job.status, "PRODUCTION_BLOCKED");
  assert.equal(r.artifacts.length, 0);
});
