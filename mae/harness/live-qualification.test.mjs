// MAE live qualification caller — tests. Mock provider only. No network, no real provider.
// Run: node mae/harness/live-qualification.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runLiveQualification, RUN_STATUS, safePathSegment } from "./run-live-qualification.mjs";
import { makeMockImageAdapter } from "../media/image-provider-mock.js";
import { makeOpenAICompatibleImageAdapter } from "../media/image-provider.js";
import { loadFixtures, computeFixtureHash } from "../services/visual-qualification.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const mk = () => { const t = mkdtempSync(join(tmpdir(), "swt-lq-")); return { outRoot: join(t, "exports"), imageOut: join(t, "images") }; };
const success = () => makeMockImageAdapter({ behavior: "success_base64", model: "m-1", modelOverride: "m-1" });
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

// 1
test("1. no --live means zero calls", async () => {
  let calls = 0;
  const adapter = success(); const orig = adapter.generate; adapter.generate = (...a) => { calls++; return orig(...a); };
  const { outRoot, imageOut } = mk();
  const r = await runLiveQualification({ provider: "mock", model: "m-1", adapter, runId: "run-001", live: false, dryRun: false, outRoot, imageOut });
  assert.equal(r.status, RUN_STATUS.SKIPPED_REQUIRES_LIVE);
  assert.equal(calls, 0);
  assert.equal(r.calls, 0);
});
// 2
test("2. --dry-run means zero calls and writes a DRY_RUN manifest", async () => {
  let calls = 0;
  const adapter = success(); const orig = adapter.generate; adapter.generate = (...a) => { calls++; return orig(...a); };
  const { outRoot, imageOut } = mk();
  const r = await runLiveQualification({ provider: "mock", model: "m-1", adapter, runId: "run-002", dryRun: true, outRoot, imageOut });
  assert.equal(r.status, RUN_STATUS.DRY_RUN);
  assert.equal(calls, 0);
  assert.ok(existsSync(r.manifestPath));
  assert.equal(readJson(r.manifestPath).status, "DRY_RUN");
});
// 3
test("3. all six fixture hashes are verified before any call", async () => {
  const { outRoot, imageOut } = mk();
  const r = await runLiveQualification({ provider: "mock", model: "m-1", adapter: success(), runId: "run-003", dryRun: true, outRoot, imageOut });
  const m = readJson(r.manifestPath);
  assert.equal(m.fixture_hashes.length, 6);
  for (const f of loadFixtures()) {
    const row = m.fixture_hashes.find((x) => x.fixture_id === f.fixture_id);
    assert.equal(row.fixture_hash, computeFixtureHash(f));
  }
});
// 4
test("4. output directory is deterministic and path-safe", async () => {
  const { outRoot, imageOut } = mk();
  const provider = "My Provider/../x";
  const a = await runLiveQualification({ provider, model: "m-1", adapter: success(), runId: "run-004", live: false, outRoot, imageOut });
  const b = await runLiveQualification({ provider, model: "m-1", adapter: success(), runId: "run-004", live: false, outRoot, imageOut });
  assert.equal(a.runDir, b.runDir);
  assert.ok(a.runDir.startsWith(outRoot));
  assert.ok(!safePathSegment(provider).includes("/"));
  assert.ok(!a.runDir.split(sep).includes(".."));
});
// 5
test("5. qualification-results.json is written from a mock run (all six)", async () => {
  const { outRoot, imageOut } = mk();
  const r = await runLiveQualification({ provider: "mock", model: "m-1", adapter: success(), runId: "run-005", live: true, outRoot, imageOut });
  assert.ok(existsSync(r.resultsPath));
  assert.equal(readJson(r.resultsPath).length, 6);
});
// 6
test("6. qualification-summary.json is written", async () => {
  const { outRoot, imageOut } = mk();
  const r = await runLiveQualification({ provider: "mock", model: "m-1", adapter: success(), runId: "run-006", live: true, outRoot, imageOut });
  assert.ok(existsSync(r.summaryPath));
  const s = readJson(r.summaryPath);
  assert.equal(s.fixture_count, 6);
  assert.equal(s.provider, "mock");
});
// 7
test("7. run-manifest.json is written", async () => {
  const { outRoot, imageOut } = mk();
  const r = await runLiveQualification({ provider: "mock", model: "m-1", adapter: success(), runId: "run-007", live: true, outRoot, imageOut });
  assert.ok(existsSync(r.manifestPath));
  const m = readJson(r.manifestPath);
  assert.equal(m.provider, "mock");
  assert.equal(m.model, "m-1");
  assert.equal(m.fixture_ids.length, 6);
});
// 8
test("8. secrets are absent from every persisted file", async () => {
  const secret = "sk-live-secret-abcdef1234567890";
  const { outRoot, imageOut } = mk();
  const r = await runLiveQualification({ provider: "mock", model: "m-1", adapter: success(), env: { MOCK_API_KEY: secret }, runId: "run-008", live: true, outRoot, imageOut });
  for (const p of [r.resultsPath, r.summaryPath, r.manifestPath]) assert.ok(!readFileSync(p, "utf8").includes(secret), p);
});
// 9a
test("9a. an unavailable provider still produces honest results + a failure manifest", async () => {
  const { outRoot, imageOut } = mk();
  const adapter = makeOpenAICompatibleImageAdapter({ name: "unconfigured", baseUrlEnv: "X_BASE_URL", apiKeyEnv: "X_API_KEY" });
  const r = await runLiveQualification({ provider: "unconfigured", model: "m-1", adapter, env: {}, runId: "run-009a", live: true, outRoot, imageOut });
  assert.equal(r.status, RUN_STATUS.COMPLETED_WITH_FAILURES);
  assert.ok(existsSync(r.manifestPath));
  const s = readJson(r.summaryPath);
  assert.equal(s.provider_unavailable_count, 6);
});
// 9b
test("9b. an aborted run (fixture hash mismatch) writes an honest manifest and NO results", async () => {
  const tampered = JSON.parse(JSON.stringify(loadFixtures()));
  tampered[0].visual_grounding.scene = "tampered";
  const { outRoot, imageOut } = mk();
  const r = await runLiveQualification({ provider: "mock", model: "m-1", adapter: success(), runId: "run-009b", live: true, outRoot, imageOut, fixtures: tampered });
  assert.equal(r.status, RUN_STATUS.ABORTED);
  assert.equal(r.resultsPath, null);
  assert.ok(existsSync(r.manifestPath));
  assert.equal(readJson(r.manifestPath).status, "ABORTED");
});
// 10
test("10. call budget is preserved (6 base; ≤12 hard cap)", async () => {
  const { outRoot, imageOut } = mk();
  const ok = await runLiveQualification({ provider: "mock", model: "m-1", adapter: success(), runId: "run-010a", live: true, outRoot, imageOut });
  assert.equal(ok.calls, 6);
  const { outRoot: o2, imageOut: i2 } = mk();
  const to = await runLiveQualification({ provider: "mock", model: "m-1", adapter: makeMockImageAdapter({ behavior: "timeout" }), runId: "run-010b", live: true, outRoot: o2, imageOut: i2 });
  assert.equal(to.calls, 12);
});
// 11
test("11. retry count is preserved in the summary", async () => {
  const { outRoot, imageOut } = mk();
  const r = await runLiveQualification({ provider: "mock", model: "m-1", adapter: makeMockImageAdapter({ behavior: "timeout" }), runId: "run-011", live: true, outRoot, imageOut });
  assert.equal(readJson(r.summaryPath).retries, 6);
});
// 12
test("12. generated image paths are retained", async () => {
  const { outRoot, imageOut } = mk();
  const r = await runLiveQualification({ provider: "mock", model: "m-1", adapter: success(), runId: "run-012", live: true, outRoot, imageOut });
  const s = readJson(r.summaryPath);
  assert.ok(s.image_paths.length >= 6);
  for (const p of s.image_paths) assert.ok(existsSync(p), p);
});
// 13
test("13. compositor SVG paths are retained", async () => {
  const { outRoot, imageOut } = mk();
  const r = await runLiveQualification({ provider: "mock", model: "m-1", adapter: success(), runId: "run-013", live: true, outRoot, imageOut });
  const s = readJson(r.summaryPath);
  assert.ok(s.compositor_paths.length >= 4, `expected compound composites, got ${s.compositor_paths.length}`);
  for (const p of s.compositor_paths) assert.ok(existsSync(p), p);
});
// 14
test("14. cost is null when the provider does not return it", async () => {
  const { outRoot, imageOut } = mk();
  const r = await runLiveQualification({ provider: "mock", model: "m-1", adapter: makeMockImageAdapter({ behavior: "missing_cost", modelOverride: "m-1" }), runId: "run-014", live: true, outRoot, imageOut });
  assert.equal(readJson(r.summaryPath).reported_cost, null);
});
// 15
test("15. reported cost is retained when available", async () => {
  const { outRoot, imageOut } = mk();
  const r = await runLiveQualification({ provider: "mock", model: "m-1", adapter: makeMockImageAdapter({ behavior: "success_base64", modelOverride: "m-1", cost: 0.02 }), runId: "run-015", live: true, outRoot, imageOut });
  const s = readJson(r.summaryPath);
  assert.ok(s.reported_cost && s.reported_cost.total > 0);
});
// 16
test("16. model mismatch is surfaced", async () => {
  const { outRoot, imageOut } = mk();
  const r = await runLiveQualification({ provider: "mock", model: "m-1", adapter: makeMockImageAdapter({ behavior: "mismatch" }), runId: "run-016", live: true, outRoot, imageOut });
  assert.equal(readJson(r.summaryPath).model_mismatches, 6);
});
// 17
test("17. judgment-required count is surfaced (never auto-PASS)", async () => {
  const { outRoot, imageOut } = mk();
  const r = await runLiveQualification({ provider: "mock", model: "m-1", adapter: success(), runId: "run-017", live: true, outRoot, imageOut });
  const s = readJson(r.summaryPath);
  assert.ok(s.judgment_required_count > 0);
  for (const res of readJson(r.resultsPath)) assert.equal(res.human_review_required, true);
});
// 18
test("18. Postpartum deletion remains untouched", () => {
  const deleted = join(root, "Postpartum Product Library — Full Extraction.md");
  assert.equal(existsSync(deleted), false);
});
