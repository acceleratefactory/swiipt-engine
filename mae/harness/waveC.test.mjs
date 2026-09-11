// MAE Wave C — Asset Architecture + Generation + Media Production (Gate C: Asset Integrity).
import { test } from "node:test";
import assert from "node:assert/strict";
import { AssetArchitectureService, PLATFORM_RULES, TEMPLATE_BY_PURPOSE } from "../services/architecture.js";
import { GenerationService } from "../services/generation.js";
import { csecAngleWithValidation, buildCsecAngle } from "./fixtures.mjs";
import { Router } from "../media/router.js";
import { PROVIDER_STATE } from "../media/providers.js";
import { renderSvg, textMatches, svgVisibleText } from "../media/layout.js";
import { RenderSpecs } from "../media/render-specs.js";
import { MediaPipeline } from "../media/pipeline.js";

function greenBrief(over = {}) {
  const { angle, validation } = csecAngleWithValidation();
  return { angle, validation, brief: AssetArchitectureService.buildBrief(angle, validation, { platform: "whatsapp", ...over }) };
}

test("no Asset Brief can be built for a RED or unvalidated angle", () => {
  const angle = buildCsecAngle();
  assert.throws(() => AssetArchitectureService.buildBrief(angle, { verdict: "RED" }), /RED|unvalidated/);
});

test("truth weighting profile is applied per asset type", () => {
  const { brief } = greenBrief({ asset_type: "WhatsApp broadcast" });
  assert.equal(brief.truth_weighting.customer, 45);
  assert.equal(brief.truth_weighting.brand, 35);
});

test("platform-native rules are attached to the brief", () => {
  const { brief } = greenBrief();
  assert.deepEqual(brief.platform_rules, PLATFORM_RULES.whatsapp);
});

test("validation scope is binding: excluded platform is refused", () => {
  const { angle, validation } = csecAngleWithValidation(); // excludes linkedin
  assert.throws(() => AssetArchitectureService.buildBrief(angle, validation, { platform: "linkedin" }), /excluded by the validation scope/);
});

test("structural template is fixed by Asset Purpose", () => {
  const { brief } = greenBrief();
  assert.equal(brief.structural_template, TEMPLATE_BY_PURPOSE.stop_scroll_identification);
  assert.equal(brief.structural_template, "Problem-Led Post");
});

test("prompt assembly puts constraints before the task and includes the negative instruction", () => {
  const { brief } = greenBrief();
  const p = GenerationService.buildPrompt(brief);
  assert.ok(p.indexOf("BRAND TRUTH CONSTRAINTS") < p.indexOf("[6] TASK"));
  assert.ok(p.includes("EXPLICIT NEGATIVE INSTRUCTION"));
  assert.ok(p.includes("Do not introduce any claim"));
  assert.ok(p.includes("STRUCTURAL TEMPLATE"));
});

test("deterministic generation produces a draft linked to brief + angle", () => {
  const { angle, brief } = greenBrief();
  const gen = GenerationService.generate(brief);
  assert.equal(gen.status, "GENERATED");
  assert.equal(gen.angle_id, angle.id);
  assert.equal(gen.brief_id, brief.id);
  const content = GenerationService.selectedContent(gen);
  assert.ok(content.includes("day 6") || content.toLowerCase().includes("3 am"));
});

test("three consecutive failures escalate to BRIEF_REVIEW_REQUIRED (not endless retry)", () => {
  const huge = "she needs to stand up " + Array.from({ length: 400 }, (_, i) => `detail${i}`).join(" ");
  const { angle, validation } = csecAngleWithValidation();
  const brief = AssetArchitectureService.buildBrief({ ...angle, tier1: { ...angle.tier1, scene: huge } }, validation, { platform: "whatsapp" });
  const gen = GenerationService.generate(brief);
  assert.equal(gen.status, "BRIEF_REVIEW_REQUIRED");
  assert.ok(gen.failure_log.some((f) => f.code === "PLATFORM_LENGTH"));
});

test("providers are dormant by default; image generation is unavailable", () => {
  const r = Router.route("GENERATED_SCENE");
  assert.equal(r.available, false);
  assert.equal(r.state, PROVIDER_STATE.PROVIDER_UNAVAILABLE);
  assert.equal(Router.route("STATIC_GRAPHIC").available, true); // internal layout
});

test("deterministic layout renderer emits a real SVG and preserves locked text", () => {
  const spec = RenderSpecs.layoutRender({
    headline: "Nobody tells you what standing up feels like on day 6.",
    body_copy: "A specific way to rise without straining the incision.",
    cta: "Reply YES",
  });
  const out = renderSvg(spec, { filename: "test-locked.svg" });
  assert.equal(out.mime_type, "image/svg+xml");
  assert.ok(out.svg.startsWith("<svg"));
  assert.equal(textMatches(out.svg, spec.headline), true);
  assert.match(svgVisibleText(out.svg), /Nobody tells you what standing up feels like on day 6/i);
});

test("production pipeline: layout mode yields a real artifact; image mode is blocked", () => {
  const base = { asset_id: "AST-CSEC-1", brief_id: "BRIEF-CSEC-1", product_id: "PROD-CSEC", angle_id: "ANG-CSEC-006", asset_type: "hook graphic", platform: "instagram", required_outputs: ["svg"] };
  const graphic = MediaPipeline.createJob({ ...base, production_mode: "STATIC_GRAPHIC", render_spec: RenderSpecs.layoutRender({ headline: "Day 6.", body_copy: "Stand up without bracing.", cta: "Reply YES" }) });
  const g = MediaPipeline.run(graphic, { product_slug: "csec" });
  assert.equal(g.artifacts.length, 1);
  assert.equal(g.artifacts[0].mime_type, "image/svg+xml");

  const scene = MediaPipeline.createJob({ ...base, production_mode: "GENERATED_SCENE" });
  const s = MediaPipeline.run(scene, { product_slug: "csec" });
  assert.equal(s.job.status, "PRODUCTION_BLOCKED");
  assert.equal(s.artifacts.length, 0);
});

test("video without a provider yields a complete package + pending status, never 'complete'", () => {
  const job = MediaPipeline.createJob({ asset_id: "AST-CSEC-2", brief_id: "BRIEF-CSEC-1", product_id: "PROD-CSEC", angle_id: "ANG-CSEC-006", asset_type: "video", platform: "tiktok", production_mode: "VIDEO_PACKAGE", required_outputs: ["script", "storyboard"] });
  const r = MediaPipeline.run(job, { product_slug: "csec", script: "Hook: day 6." });
  assert.ok(r.artifacts.length >= 5);
  assert.ok(["PRODUCTION_BLOCKED", "RENDER_PENDING_EXTERNAL_PROVIDER"].includes(r.job.status));
  const manifestArt = r.artifacts.find((a) => a.artifact_role === "RENDER-MANIFEST" || a.artifact_role === "RENDER");
  assert.ok(r.artifacts.some((a) => /render-manifest/i.test(a.artifact_role) || /render-manifest/i.test(a.storage_uri)));
});
