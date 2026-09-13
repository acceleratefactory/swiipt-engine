// MAE visual qualification RUNNER — tests. No network, no real provider (mock only).
// Run: node mae/harness/visual-qualification-runner.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAjv, schemaId } from "../lib/schema.js";
import { runQualification } from "../services/visual-qualification-runner.js";
import { loadFixtures, computeFixtureHash, QUALIFICATION_BUDGET } from "../services/visual-qualification.js";
import { VisualOutputQA, QA_STATUS } from "../services/visual-output-qa.js";
import { makeMockImageAdapter } from "../media/image-provider-mock.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const success = () => makeMockImageAdapter({ behavior: "success_base64", model: "m-1", modelOverride: "m-1" });

// 19
test("19. runner loads exactly 6 fixtures and runs 6 base calls", async () => {
  const r = await runQualification({ provider: "mock", model: "m-1", adapter: success() });
  assert.equal(r.aborted, false);
  assert.equal(r.results.length, 6);
  assert.equal(r.calls, 6);
});
// 20
test("20. fixture hashes are reverified before any call", async () => {
  const tampered = JSON.parse(JSON.stringify(loadFixtures()));
  tampered[0].visual_grounding.scene = "tampered scene";
  const r = await runQualification({ provider: "mock", model: "m-1", adapter: success(), fixtures: tampered });
  assert.equal(r.aborted, true);
  assert.equal(r.reason, "fixture_hash_mismatch");
  assert.equal(r.calls, 0);
});
// 21
test("21. provider/model never alter the fixture hash", () => {
  for (const f of loadFixtures()) assert.equal(computeFixtureHash(f), f.fixture_hash, f.fixture_id);
  const f = loadFixtures()[0];
  const clone = JSON.parse(JSON.stringify(f));
  clone.provider = "openai"; clone.model = "gpt-image-1"; clone.returned_model = "gpt-image-1";
  assert.equal(computeFixtureHash(clone), f.fixture_hash);
});
// 22
test("22. base budget = 6 calls with a successful provider", async () => {
  const r = await runQualification({ provider: "mock", model: "m-1", adapter: success() });
  assert.equal(r.base_calls, 6);
  assert.equal(r.calls, 6);
  assert.equal(r.retries, 0);
});
// 23
test("23. maximum budget = 12 calls/provider (retryable failures capped)", async () => {
  const r = await runQualification({ provider: "mock", model: "m-1", adapter: makeMockImageAdapter({ behavior: "timeout" }) });
  assert.equal(r.calls, 12);
  assert.equal(r.calls, QUALIFICATION_BUDGET.calls_max_per_provider);
});
// 24
test("24. retries are explicit (fixture + reason + attempt)", async () => {
  const r = await runQualification({ provider: "mock", model: "m-1", adapter: makeMockImageAdapter({ behavior: "timeout" }) });
  assert.ok(r.retry_log.length >= 1);
  for (const e of r.retry_log) { assert.ok(e.fixture); assert.ok(e.reason); assert.equal(e.attempt, 1); }
});
// 25
test("25. hidden retries are impossible (calls = fixtures + explicit retries)", async () => {
  const cap = await runQualification({ provider: "mock", model: "m-1", adapter: makeMockImageAdapter({ behavior: "timeout" }) });
  assert.equal(cap.calls, cap.results.length + cap.retry_log.length);
  const ok = await runQualification({ provider: "mock", model: "m-1", adapter: success() });
  assert.equal(ok.calls, ok.results.length + ok.retry_log.length);
});
// 26
test("26. judgment dimensions remain unresolved without a vision/human result", async () => {
  const r = await runQualification({ provider: "mock", model: "m-1", adapter: success() });
  const first = r.results[0];
  assert.ok(first.judgment_checks.length > 0);
  assert.ok(first.judgment_checks.every((c) => c.status === QA_STATUS.JUDGMENT_REQUIRED));
  assert.equal(first.overall_status, QA_STATUS.JUDGMENT_REQUIRED);
  assert.equal(first.human_review_required, true);
});
// 27
test("27. zero-tolerance conditions still block", () => {
  const f = loadFixtures()[1];
  const r = VisualOutputQA.evaluate({ fixture: f, judgment: { PRODUCT_TRUTH_FIDELITY: { status: QA_STATUS.FAIL, reason: "clinical claim" } } });
  assert.equal(r.overall_status, QA_STATUS.BLOCK);
  assert.ok(r.blocking_failures.includes("PRODUCT_TRUTH_VIOLATION"));
});
// 28
test("28. qualification results validate against the result schema", async () => {
  const r = await runQualification({ provider: "mock", model: "m-1", adapter: success() });
  const ajv = getAjv();
  for (const res of r.results) assert.equal(ajv.validate(schemaId("visual-qualification-result.schema.json"), res), true, JSON.stringify(ajv.errors));
});
// 29
test("29. provider cost remains null when the provider does not return it", async () => {
  const r = await runQualification({ provider: "mock", model: "m-1", adapter: makeMockImageAdapter({ behavior: "missing_cost", modelOverride: "m-1" }) });
  assert.equal(r.results[0].cost, null);
});
// 30
test("30. credentials never appear in runner results", async () => {
  const secret = "sk-runner-secret-abcdef123456";
  const r = await runQualification({ provider: "mock", model: "m-1", adapter: success(), env: { MOCK_IMAGE_API_KEY: secret } });
  assert.ok(!JSON.stringify(r).includes(secret));
});
// 31
test("31. compositor tests remain present", () => {
  assert.ok(existsSync(join(root, "mae/harness/compositor.test.mjs")));
});
// 32
test("32. visual-qualification tests remain present", () => {
  assert.ok(existsSync(join(root, "mae/harness/visual-qualification.test.mjs")));
});
