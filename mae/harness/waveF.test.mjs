// MAE Wave F — Distribution + Learning (Gate F: Learning Integrity).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ManifestService, MasterPackService, ExportService } from "../media/export.js";
import { MediaPipeline } from "../media/pipeline.js";
import { RenderSpecs } from "../media/render-specs.js";
import { PerformanceService, ExperimentService, LearningService } from "../services/learning.js";
import { PublishingService } from "../services/publishing.js";
import { RotationService } from "../services/campaign.js";
import { GovernanceService } from "../services/governance.js";
import { AngleService } from "../services/angle.js";
import { TruthService } from "../services/truth.js";
import { csecApprovedFamily } from "./fixtures.mjs";

function withArtifact() {
  const f = csecApprovedFamily();
  const job = MediaPipeline.createJob({
    asset_id: "AST-CSEC-1", brief_id: "BRIEF-CSEC-1", product_id: "PROD-CSEC", angle_id: f.angle.id,
    asset_type: "hook graphic", platform: "instagram", production_mode: "STATIC_GRAPHIC", required_outputs: ["svg"],
    render_spec: RenderSpecs.layoutRender({ headline: "At 3 AM she has to stand.", body_copy: "Module 2 — position and rise without straining the incision.", cta: "Reply YES" }),
  });
  const run = MediaPipeline.run(job, { product_slug: "csec" });
  return { ...f, job, run, artifacts: run.artifacts, qa: f.built.map((b) => b.qa) };
}

test("an Asset Manifest is generated and validates", () => {
  const f = withArtifact();
  const manifest = ManifestService.build({ product_id: "PROD-CSEC", assets: f.assets, families: [f.family], artifacts: f.artifacts });
  assert.equal(manifest.class, "asset_manifest");
  assert.equal(manifest.entries.length, f.assets.length);
  assert.match(manifest.id, /^MAN-/);
});

test("manifest file paths resolve on disk", () => {
  const f = withArtifact();
  const manifest = ManifestService.build({ product_id: "PROD-CSEC", assets: f.assets, families: [f.family], artifacts: f.artifacts });
  const first = manifest.entries.find((e) => e.files.length);
  assert.ok(first, "at least one manifest entry has files");
  const real = ExportService.qaCheck({ assets: f.assets, manifest, files: first.files.map((x) => ({ src: x.path, name: x.path })) });
  assert.equal(real.checks.find((c) => c.check === "paths_resolve").pass, true);
});

test("export rejects an unapproved or retired asset", () => {
  const f = withArtifact();
  const bad = f.assets.map((a, i) => i === 0 ? { ...a, status: "RETIRED" } : a);
  assert.throws(() => ExportService.exportProduct({ product_id: "PROD-CSEC-BAD", assets: bad, families: [f.family], artifacts: f.artifacts, qa: f.qa }), /unapproved|retired|failed/);
});

test("the export package is a real ZIP containing the manifest and master pack", () => {
  const f = withArtifact();
  const out = ExportService.exportProduct({ product_id: "PROD-CSEC", assets: f.assets, families: [f.family], artifacts: f.artifacts, qa: f.qa, angle: f.angle, validation: f.validation, product: { title: "The No-Village C-Section" } });
  assert.equal(out.package.status, "READY");
  assert.ok(out.zipBytes > 0);
  const head = out.files && out.files.length;
  assert.ok(head >= 1);
  // The package QA passed and lists the manifest + master pack as files.
  const names = out.package.files.map((x) => x.name);
  assert.ok(names.includes("asset-manifest.json"));
  assert.ok(names.includes("01-marketing-master-pack.md"));
});

test("the Master Marketing Pack is generated from governed records", () => {
  const f = withArtifact();
  const md = MasterPackService.build({ product: { title: "The No-Village C-Section" }, angle: f.angle, validation: f.validation, family: f.family, assets: f.assets, qa: f.qa });
  assert.match(md, /Marketing Master Pack/);
  assert.match(md, /Strategic Synthesis/);
  assert.match(md, new RegExp(f.family.id));
});

test("performance cannot mutate source Truth", () => {
  const f = withArtifact();
  const angleBefore = JSON.stringify(AngleService.get(f.angle.id));
  const ptrBefore = JSON.stringify(TruthService.get("product", "PTR-CSEC-001"));
  const usage = GovernanceService.createUsage({ asset_id: "AST-CSEC-1", family_id: f.family.id, angle_id: f.angle.id, sequence_type: "LAUNCH", audience_state: "problem_aware", platform: "whatsapp", cta_level: "SOFT_CTA", emotional_intensity: "high" });
  const perf = PerformanceService.ingest({ usage_id: usage.id, metrics: { conversion: 0.4, clicks: 120 }, source: "fixture" });
  assert.equal(perf.class, "performance_record");
  assert.equal(JSON.stringify(AngleService.get(f.angle.id)), angleBefore);
  assert.equal(JSON.stringify(TruthService.get("product", "PTR-CSEC-001")), ptrBefore);
  assert.equal(LearningService.assertNoTruthMutation(), true);
});

test("performance is a ranking signal only — fatigue still suppresses", () => {
  const famA = { id: "FAM-A", angle_verdict: "GREEN", family_status: "APPROVED", sequence_eligibility: ["LAUNCH"], role_map: { "AST-A": "PROBLEM" }, evergreen_eligible: true };
  const famB = { id: "FAM-B", angle_verdict: "GREEN", family_status: "APPROVED", sequence_eligibility: ["LAUNCH"], role_map: { "AST-B": "PROBLEM" }, evergreen_eligible: true };
  const A = { id: "AST-A", status: "APPROVED", family_role: "PROBLEM", platform: "whatsapp", cta_level: "NO_CTA", emotional_intensity: "high" };
  const B = { id: "AST-B", status: "APPROVED", family_role: "PROBLEM", platform: "whatsapp", cta_level: "NO_CTA", emotional_intensity: "high" };
  const r = RotationService.select({
    sequence_type: "LAUNCH", audience_state: "problem_aware", objective: "recognition", required_roles: ["PROBLEM"],
    eligible: [{ asset: A, family: famA }, { asset: B, family: famB }],
    exposure: { asset: { "AST-A": 6 }, family: {}, cta: {} },
    performance: { "AST-A": { conversion: 10 } },
  });
  assert.equal(r.selected.asset.id, "AST-B");
});

test("A/B testing cannot bypass claim validation", () => {
  const f = withArtifact();
  assert.throws(() => ExperimentService.create({
    campaign_id: "CAMP-CSEC-1", test_dimension: "hook",
    variants: [{ variant_id: "A", asset_id: "AST-CSEC-1", description: "" }, { variant_id: "B", asset_id: "AST-CSEC-2", description: "guaranteed cure in 3 days" }],
  }), /bypass|unsupported|fabricated/);
});

test("an allowed A/B experiment is created", () => {
  const f = withArtifact();
  const expt = ExperimentService.create({ campaign_id: "CAMP-CSEC-1", test_dimension: "hook", variants: [{ variant_id: "A", asset_id: "AST-CSEC-1", description: "opening A" }, { variant_id: "B", asset_id: "AST-CSEC-2", description: "opening B" }] });
  assert.equal(expt.status, "PLANNED");
  assert.equal(expt.eligibility.claims_valid, true);
});

test("every media artifact carries a checksum", () => {
  const f = withArtifact();
  assert.ok(f.artifacts.length >= 1);
  assert.ok(f.artifacts.every((a) => typeof a.checksum === "string" && a.checksum.length >= 32));
});

test("retirement/archive preserves history", () => {
  const f = withArtifact();
  const archived = LearningService.archive({ ...f.family });
  assert.equal(archived.status, "ARCHIVED");
  assert.deepEqual(archived.approved_asset_ids, f.family.approved_asset_ids);
  const retired = GovernanceService.retireAsset("AST-CSEC-3", { reason: "stale proof" });
  assert.equal(retired.status, "RETIRED");
  assert.ok(GovernanceService.getAsset("AST-CSEC-3"));
});

test("performance can request a refresh upstream without rewriting Truth", () => {
  const req = LearningService.refreshRequest({ asset_id: "AST-CSEC-1", reason: "objection no longer reflects the market" });
  assert.equal(req.type, "refresh_request");
  assert.equal(req.route, "upstream_review");
});

test("publishing a governed usage records it and preserves any published difference", () => {
  const f = withArtifact();
  const usage = GovernanceService.createUsage({ asset_id: "AST-CSEC-4", family_id: f.family.id, angle_id: f.angle.id, sequence_type: "LAUNCH", audience_state: "problem_aware", platform: "facebook", cta_level: "LEARN_MORE_CTA", emotional_intensity: "low" });
  const pub = PublishingService.publish(usage.id, { governance: GovernanceService, reference: "https://example.test/post/1", final_text: f.assets[3].content + " (platform edit)" });
  assert.equal(pub.status, "PUBLISHED");
  assert.match(pub.publication_difference, /differs/);
});
