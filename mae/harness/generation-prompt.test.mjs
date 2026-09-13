// Exact image-generation prompt capture/persist/expose — tests. Mock only; no provider calls.
// Run: node mae/harness/generation-prompt.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runQualification } from "../services/visual-qualification-runner.js";
import { runLiveQualification } from "./run-live-qualification.mjs";
import { makeResponseAdapter, invokeImageProvider, canonicalImageRequest } from "../media/image-provider.js";
import { loadFixture, loadFixtures, computeFixtureHash, developmentProviderRecord, isProductionQualified } from "../services/visual-qualification.js";

const tmp = () => mkdtempSync(join(tmpdir(), "swt-prompt-"));
function pngBytes(w, h) { const b = Buffer.alloc(32); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0); b.writeUInt32BE(13, 8); b.write("IHDR", 12, "ascii"); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; }
const okPng = () => pngBytes(1024, 1024).toString("base64");
const success = () => makeResponseAdapter({ name: "mock", generate: async () => ({ output_base64: okPng(), mime_type: "image/png" }) });
const transform = () => makeResponseAdapter({ name: "mock", generate: async () => ({ provider_prompt: "TRANSFORMED PROMPT TEXT", output_base64: okPng(), mime_type: "image/png" }) });
const fail = () => makeResponseAdapter({ name: "mock", generate: async () => ({ error_code: "HTTP_500", error_message: "boom" }) });
const FIXTURE_PROMPT = loadFixture("VF-2").prompt_package.prompt;

// 1
test("1. generated result retains its exact generation prompt", async () => {
  const r = await runQualification({ provider: "mock", model: "m", adapter: success(), fixtures: [loadFixture("VF-2")] });
  const c = r.results[0].deterministic_checks.find((x) => x.check === "generation_prompt");
  assert.ok(c, "generation_prompt check present");
  assert.equal(c.detail, FIXTURE_PROMPT);
});
// 2
test("2. persisted qualification result retains the exact prompt", async () => {
  const { outRoot, imageOut } = (() => { const t = tmp(); return { outRoot: join(t, "exp"), imageOut: join(t, "img") }; })();
  const r = await runLiveQualification({ provider: "mock", model: "m", adapter: success(), fixtures: [loadFixture("VF-2")], live: true, runId: "p-002", outRoot, imageOut });
  const persisted = JSON.parse(readFileSync(r.resultsPath, "utf8"));
  const c = persisted[0].deterministic_checks.find((x) => x.check === "generation_prompt");
  assert.equal(c.detail, FIXTURE_PROMPT);
});
// 3
test("3. prompt survives without modification (verbatim)", async () => {
  const r = await runQualification({ provider: "mock", model: "m", adapter: success(), fixtures: [loadFixture("VF-2")] });
  const got = r.results[0].deterministic_checks.find((x) => x.check === "generation_prompt").detail;
  assert.equal(got, FIXTURE_PROMPT);
  assert.equal(got.includes("\n"), FIXTURE_PROMPT.includes("\n")); // newlines preserved verbatim
});
// 4
test("4. prompt is associated with the correct fixture + artifact", async () => {
  const t = tmp();
  const r = await runLiveQualification({ provider: "mock", model: "m", adapter: success(), fixtures: [loadFixture("VF-2")], live: true, runId: "p-004", outRoot: join(t, "exp"), imageOut: join(t, "img") });
  assert.ok(existsSync(r.promptsPath));
  const txt = readFileSync(r.promptsPath, "utf8");
  assert.ok(txt.includes("=== VF-2 ==="));
  assert.ok(txt.includes(FIXTURE_PROMPT));
  const summary = JSON.parse(readFileSync(r.summaryPath, "utf8"));
  assert.equal(summary.prompts[0].fixture_id, "VF-2");
  assert.equal(summary.prompts[0].prompt, FIXTURE_PROMPT);
  assert.ok(summary.prompts[0].image_path && existsSync(summary.prompts[0].image_path));
});
// 5
test("5. no credential/header appears in exposed prompt text", async () => {
  const secret = "sk-prompt-secret-abcdef123456";
  const t = tmp();
  const r = await runLiveQualification({ provider: "mock", model: "m", adapter: success(), fixtures: [loadFixture("VF-2")], live: true, runId: "p-005", outRoot: join(t, "exp"), imageOut: join(t, "img"), env: { MOCK_API_KEY: secret } });
  const all = readFileSync(r.resultsPath, "utf8") + readFileSync(r.summaryPath, "utf8") + readFileSync(r.promptsPath, "utf8");
  assert.ok(!all.includes(secret));
  const prompt = JSON.parse(readFileSync(r.summaryPath, "utf8")).prompts[0].prompt;
  assert.ok(!/bearer|x-goog-api-key|authorization/i.test(prompt));
});
// 6
test("6. identical canonical/provider prompt creates no conflicting values", async () => {
  const req = { ...canonicalImageRequest({ promptPackage: { prompt: "PROMPT-X" }, spec: { aspect_ratio: "1:1", canvas: { width: 64, height: 64 } } }), model: "m" };
  const r = await invokeImageProvider({ adapter: success(), request: req, model: "m", env: {}, dir: tmp() });
  assert.equal(r.canonical_prompt, "PROMPT-X");
  assert.equal(r.provider_prompt_sent, "PROMPT-X");
  assert.equal(r.prompt_modified_by_adapter, false);
});
// 7
test("7. adapter-transformed prompt is distinguishable from canonical", async () => {
  const req = { ...canonicalImageRequest({ promptPackage: { prompt: "PROMPT-X" }, spec: { aspect_ratio: "1:1", canvas: { width: 64, height: 64 } } }), model: "m" };
  const r = await invokeImageProvider({ adapter: transform(), request: req, model: "m", env: {}, dir: tmp() });
  assert.equal(r.canonical_prompt, "PROMPT-X");
  assert.equal(r.provider_prompt_sent, "TRANSFORMED PROMPT TEXT");
  assert.equal(r.prompt_modified_by_adapter, true);
});
// 8
test("8. failed generation does not manufacture a prompt claiming an image was generated", async () => {
  const r = await runQualification({ provider: "mock", model: "m", adapter: fail(), fixtures: [loadFixture("VF-2")] });
  assert.equal(r.results[0].generation_status, "FAILED");
  assert.equal(r.results[0].deterministic_checks.find((x) => x.check === "generation_prompt"), undefined);
  const t = tmp();
  const live = await runLiveQualification({ provider: "mock", model: "m", adapter: fail(), fixtures: [loadFixture("VF-2")], live: true, runId: "p-008", outRoot: join(t, "exp"), imageOut: join(t, "img") });
  assert.ok(!existsSync(live.promptsPath) || !readFileSync(live.promptsPath, "utf8").includes(FIXTURE_PROMPT));
});
// 9
test("9. development-provider classification remains green", () => {
  const rec = developmentProviderRecord("9router/ag/gemini-3.1-flash-image");
  assert.ok(rec);
  assert.equal(rec.provider_role, "DEVELOPMENT_ONLY");
  assert.equal(rec.geometry_control, "GEOMETRY_UNRELIABLE");
  assert.equal(isProductionQualified("9router/ag/gemini-3.1-flash-image"), false);
});
// 10
test("10. frozen fixture hashes unchanged", () => {
  for (const f of loadFixtures()) assert.equal(computeFixtureHash(f), f.fixture_hash, f.fixture_id);
});
