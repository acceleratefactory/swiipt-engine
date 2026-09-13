// MAE Visual Output QA + frozen qualification harness — deterministic tests. No provider, no vision model.
// Run: node mae/harness/visual-qualification.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAjv, schemaId } from "../lib/schema.js";
import { VISUAL_QA_DIMENSIONS, DIMENSION_CLASS, QA_STATUS, VISUAL_ZERO_TOLERANCE_CLASSES, VisualOutputQA } from "../services/visual-output-qa.js";
import { loadFixtures, loadFixture, validateFixture, computeFixtureHash, FIXTURE_IDS, QUALIFICATION_BUDGET, ELIGIBILITY_POLICY, METRICS_REQUIRING_CALIBRATION, buildQualificationResult } from "../services/visual-qualification.js";
import { Router } from "../media/router.js";
import { PROVIDER_STATE } from "../media/providers.js";
import { csecApprovedFamily } from "./fixtures.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const JUDGMENT_IDS = VISUAL_QA_DIMENSIONS.filter((d) => d.class !== DIMENSION_CLASS.DETERMINISTIC).map((d) => d.id);

// 1
test("1. all 15 QA dimensions are represented", () => {
  assert.equal(VISUAL_QA_DIMENSIONS.length, 15);
  assert.deepEqual([...new Set(VISUAL_QA_DIMENSIONS.map((d) => d.id))].length, 15);
});
// 2
test("2. every dimension has a deterministic/judgment classification", () => {
  const allowed = new Set(Object.values(DIMENSION_CLASS));
  for (const d of VISUAL_QA_DIMENSIONS) assert.ok(allowed.has(d.class), d.id);
});
// 3
test("3. judgment-required checks never auto-PASS (no vision model)", () => {
  const r = VisualOutputQA.evaluate({ fixture: loadFixture("VF-1") });
  for (const dim of r.dimensions) if (dim.class !== DIMENSION_CLASS.DETERMINISTIC) assert.notEqual(dim.status, QA_STATUS.PASS, dim.id);
  assert.notEqual(r.overall_status, QA_STATUS.PASS);
  assert.equal(r.human_review_required, true);
  assert.equal(r.vision_model, null);
});
// 4
test("4. unsupported visual claims block", () => {
  const r = VisualOutputQA.evaluate({ fixture: loadFixture("VF-1"), judgment: { UNSUPPORTED_VISUAL_CLAIM: { status: QA_STATUS.FAIL, reason: "implies a result not in Truth" } } });
  assert.equal(r.overall_status, QA_STATUS.BLOCK);
  assert.ok(r.blocking_failures.includes("UNSUPPORTED_VISUAL_CLAIM"));
});
// 5
test("5. Product Truth violation blocks (zero tolerance)", () => {
  const r = VisualOutputQA.evaluate({ fixture: loadFixture("VF-2"), judgment: { PRODUCT_TRUTH_FIDELITY: { status: QA_STATUS.FAIL, reason: "shows a clinical outcome claim" } } });
  assert.equal(r.overall_status, QA_STATUS.BLOCK);
  assert.ok(r.blocking_failures.includes("PRODUCT_TRUTH_VIOLATION"));
});
// 6
test("6. safety violation blocks", () => {
  const r = VisualOutputQA.evaluate({ fixture: loadFixture("VF-1"), judgment: { safety_violation: true } });
  assert.equal(r.overall_status, QA_STATUS.BLOCK);
  assert.ok(r.blocking_failures.includes("SAFETY_VIOLATION"));
});
// 7
test("7. fixture set contains exactly 6 canonical fixtures", () => {
  assert.equal(loadFixtures().length, 6);
});
// 8
test("8. fixture ids are stable", () => {
  assert.deepEqual(loadFixtures().map((f) => f.fixture_id), [...FIXTURE_IDS]);
});
// 9
test("9. fixture hashes are stable and self-consistent", () => {
  for (const f of loadFixtures()) assert.equal(computeFixtureHash(f), f.fixture_hash, f.fixture_id);
});
// 10
test("10. provider/model identity is excluded from the fixture hash", () => {
  const f = loadFixture("VF-1");
  const h1 = computeFixtureHash(f);
  const clone = JSON.parse(JSON.stringify(f));
  clone.provider = "some-provider"; clone.model = "some-model"; clone.returned_model = "x"; clone.seed_if_available = 42; clone.latency_ms = 99; clone.cost = 1.5;
  assert.equal(computeFixtureHash(clone), h1);
});
// 11
test("11. Day-6 fixture references the canonical ANG/VG/VAS/IPP records", () => {
  const f = loadFixture("VF-2");
  assert.equal(f.source_ref.angle_id, "ANG-CSEC-006");
  assert.equal(f.visual_grounding.id, "VG-CSEC-006");
  assert.equal(f.visual_asset_spec.id, "VAS-CSEC-006");
  assert.equal(f.prompt_package.id, "IPP-CSEC-006");
});
// 12
test("12. Day-6 source-grounded vs production-instruction distinction is preserved", () => {
  const f = loadFixture("VF-2");
  assert.equal(f.grounding_classification.scene, "source_grounded");
  assert.equal(f.grounding_classification.gesture_posture, "source_grounded");
  assert.equal(f.grounding_classification.lighting, "production_instruction");
  assert.equal(f.grounding_classification.composition, "production_instruction");
});
// 13
test("13. every fixture validates against the fixture schema", () => {
  const ajv = getAjv();
  for (const f of loadFixtures()) {
    assert.equal(ajv.validate(schemaId("visual-qualification-fixture.schema.json"), f), true, f.fixture_id + " " + JSON.stringify(ajv.errors));
    assert.equal(validateFixture(f), f);
  }
});
// 14
test("14. qualification result schema validates (populated and empty)", () => {
  const ajv = getAjv();
  const f = loadFixture("VF-1");
  const empty = buildQualificationResult({});
  assert.equal(ajv.validate(schemaId("visual-qualification-result.schema.json"), empty), true, JSON.stringify(ajv.errors));
  const populated = buildQualificationResult({ provider: "example", requested_model: "m-1", fixture_id: f.fixture_id, fixture_hash: f.fixture_hash, generation_status: "FAILED", overall_status: "NOT_RUN" });
  assert.equal(ajv.validate(schemaId("visual-qualification-result.schema.json"), populated), true, JSON.stringify(ajv.errors));
});
// 15
test("15. no provider metadata is fabricated", () => {
  const r = buildQualificationResult({});
  assert.equal(r.provider, null);
  assert.equal(r.requested_model, null);
  assert.equal(r.returned_model, null);
  assert.equal(r.artifact_id, null);
  assert.equal(r.latency_ms, null);
  assert.equal(r.cost, null);
  assert.equal(r.seed_if_available, null);
  assert.equal(r.generation_status, "NOT_RUN");
  assert.equal(r.human_review_required, true);
});
// 16
test("16. no image provider is invoked", () => {
  assert.equal(Router.route("GENERATED_SCENE").available, false);
  assert.equal(Router.route("GENERATED_SCENE").state, PROVIDER_STATE.PROVIDER_UNAVAILABLE);
  for (const rel of ["mae/services/visual-output-qa.js", "mae/services/visual-qualification.js"]) {
    const src = readFileSync(join(root, rel), "utf8");
    assert.ok(!/fetch\s*\(/.test(src), `${rel} must not call fetch`);
    assert.ok(!/provider-client/.test(src), `${rel} must not import the provider client`);
  }
});
// 17
test("17. no vision model is invoked (judgment stays explicit)", () => {
  const src = readFileSync(join(root, "mae/services/visual-output-qa.js"), "utf8");
  assert.ok(!/openai|anthropic|gemini|vision_api|image-critic/i.test(src));
  const r = VisualOutputQA.evaluate({ fixture: loadFixture("VF-2") });
  assert.equal(r.judgment_run, false);
  assert.equal(r.overall_status, QA_STATUS.JUDGMENT_REQUIRED);
});
// 18
test("18. compositor tests remain present", () => {
  assert.ok(existsSync(join(root, "mae/harness/compositor.test.mjs")));
});
// 19
test("19. visual foundation tests remain present", () => {
  assert.ok(existsSync(join(root, "mae/harness/visual-foundation.test.mjs")));
});
// 20
test("20. Asset Family architecture remains unchanged", () => {
  const f = csecApprovedFamily();
  assert.equal(f.family.id, "FAM-CSEC-006");
  assert.ok(f.family.approved_asset_ids.length >= 6);
});
// 21 (supporting) — budget + policy are frozen and honest
test("21. provider call budget + eligibility policy are frozen; calibration metrics declared", () => {
  assert.equal(QUALIFICATION_BUDGET.providers_max, 4);
  assert.equal(QUALIFICATION_BUDGET.fixtures, 6);
  assert.equal(QUALIFICATION_BUDGET.calls_base, 6);
  assert.equal(QUALIFICATION_BUDGET.calls_max_per_provider, 12);
  for (const z of VISUAL_ZERO_TOLERANCE_CLASSES) assert.ok(ELIGIBILITY_POLICY.zero_tolerance_classes.includes(z));
  assert.ok(ELIGIBILITY_POLICY.no_arbitrary_numeric_thresholds.length > 0);
  assert.ok(METRICS_REQUIRING_CALIBRATION.includes("artifact_rate"));
});
