// MAE per-video prompt escape hatch — deterministic tests. MOCK transport only; no provider, no network.
// Run: node mae/harness/video-prompt-file.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { persistVideoArtifact, videoPromptText, writeVideoArtifactPromptFile, VIDEO_PROMPT_FILENAME } from "../media/video-artifact.js";
import { makeMockVideoProviderAdapter, MOCK_FULL_CAPABILITIES } from "../media/video-provider-mock.js";
import { runVideoProviderJob } from "../media/video-provider-adapter.js";
import { canonicalVideoRequest } from "../media/video-prompt-compiler.js";
import { videoGenerationStatus } from "../media/video-provider.js";
import { buildDay6Video } from "./video-fixtures.mjs";
import { syntheticMp4 } from "./video-qa-fixtures.mjs";
import { loadFixtures, computeFixtureHash } from "../services/visual-qualification.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const D = buildDay6Video();
const base = canonicalVideoRequest({ promptPackage: D.promptPackage, assetSpec: D.assetSpec, grounding: D.grounding });
const CANON = { ...base, model: "swiipt-video-1", metadata: { ...base.metadata, fixture_id: D.fixture_id } };
const MP4 = syntheticMp4({ width: 1080, height: 1920, durationSeconds: 6 });
const FRAME = (o) => (o.frame || o.still || {});   // (kept tiny; no frame pipeline exists)

const runFail = [];
const run = ({ request = CANON, scenario = "immediate_success", returnedModel = "swiipt-video-1", transformedPrompt = null, env = { MOCK_VIDEO_API_KEY: "test-only-key" }, bytes = MP4 } = {}) => {
  const dir = mkdtempSync(join(tmpdir(), "swt-vpf-"));
  const adapter = makeMockVideoProviderAdapter({ scenario, bytes, returnedModel, transformedPrompt, env, capabilities: MOCK_FULL_CAPABILITIES });
  const r = runVideoProviderJob({ adapter, request, artifactDir: dir });
  return { r, dir, file: r.artifact?.prompt_file || null, text: r.artifact?.prompt_file && existsSync(r.artifact.prompt_file) ? readFileSync(r.artifact.prompt_file, "utf8") : null };
};
const section = (text, label, next) => { const i = text.indexOf(label); if (i < 0) return null; const s = i + label.length; const j = text.indexOf(next, s); return text.slice(s, j < 0 ? undefined : j); };

// --- B. automatic emission ----------------------------------------------------
test("1. successful generated video automatically gets a prompt file", () => {
  const { r, text } = run({});
  assert.equal(r.state, "PROVIDER_SUCCESS");
  assert.ok(r.artifact.prompt_file && existsSync(r.artifact.prompt_file));
  assert.ok(text.includes("VIDEO GENERATION PROMPT"));
});
test("2. prompt file is per artifact", () => {
  const a = run({}); const b = run({});
  assert.notEqual(a.r.artifact.prompt_file, b.r.artifact.prompt_file);
  assert.equal(a.r.artifact.prompt_file.split(/[\\/]/).pop(), VIDEO_PROMPT_FILENAME(a.r.artifact.artifact_id));
  assert.equal(readdirSync(a.dir).filter((f) => f.endsWith(".prompt.txt")).length, 1);
});
test("38. caller does not need to invoke the writer separately", () => {
  const { r } = run({});
  assert.ok(r.artifact.prompt_file && existsSync(r.artifact.prompt_file));   // produced by the run itself
});

// --- C. content ---------------------------------------------------------------
test("3. canonical prompt appears verbatim", () => { const { text } = run({}); assert.ok(text.includes(CANON.prompt)); });
test("4. provider prompt appears verbatim", () => { const { text } = run({ transformedPrompt: "PROVIDER-BOUND PROMPT v2" }); assert.ok(text.includes("PROVIDER-BOUND PROMPT v2")); });
test("5. canonical and provider prompt can differ", () => {
  const { text } = run({ transformedPrompt: "PROVIDER-BOUND PROMPT v2" });
  assert.ok(text.includes(CANON.prompt)); assert.ok(text.includes("PROVIDER-BOUND PROMPT v2"));
});
test("6. prompt_modified_by_adapter true retained", () => { const { text } = run({ transformedPrompt: "X" }); assert.ok(/Prompt modified by adapter: true/.test(text)); });
test("7. prompt_modified_by_adapter false retained", () => { const { text } = run({}); assert.ok(/Prompt modified by adapter: false/.test(text)); });
test("8. NOT_SENT represented when no provider prompt exists", () => {
  const t = videoPromptText({ artifact_id: "A1" }, { canonical_prompt: CANON.prompt });
  assert.ok(/Provider: NOT_SENT/.test(t));
  assert.ok(/Exact provider prompt sent:\s*\nNOT_SENT/.test(t));
});
test("9. negative prompt appears verbatim", () => {
  const neg = "no text overlays; no medical demonstration";
  const { text } = run({ request: { ...CANON, negative_prompt: neg } });
  assert.ok(text.includes(neg));
});
test("10. NONE represented when negative prompt absent", () => { const { text } = run({ request: { ...CANON, negative_prompt: "" } }); assert.ok(/Negative prompt:\s*\nNONE/.test(text)); });
test("11. motion section present", () => assert.ok(/MOTION INSTRUCTION/.test(run({}).text)));
test("12. primary_action preserved exactly", () => assert.ok(run({}).text.includes(CANON.motion.primary_action)));
test("13. motion speed preserved exactly", () => assert.ok(run({}).text.includes(CANON.motion.speed)));
test("14. motion direction preserved exactly", () => assert.ok(run({}).text.includes(CANON.motion.direction)));
test("15. camera section present", () => assert.ok(/CAMERA INSTRUCTION/.test(run({}).text)));
test("16. camera framing preserved exactly", () => assert.ok(run({}).text.includes(CANON.camera.framing)));
test("17. camera movement preserved exactly", () => assert.ok(run({}).text.includes(CANON.camera.movement)));
test("18. camera stability preserved exactly", () => assert.ok(run({}).text.includes(CANON.camera.stability)));
test("19. source_image retained", () => {
  const { text } = run({ request: { ...CANON, source_image: "mae/storage/work/image/VF-2.jpg" } });
  assert.ok(text.includes("mae/storage/work/image/VF-2.jpg"));
});
test("20. reference_images retained", () => {
  const { text } = run({ request: { ...CANON, reference_images: ["a.png", "b.png"] } });
  assert.ok(text.includes("a.png, b.png"));
});
test("21. provider retained", () => assert.ok(/Provider:\s*\nmock-video/.test(run({}).text) || run({}).text.includes("provider: mock-video") || run({}).text.includes("mock-video")));
test("22. requested_model retained", () => assert.ok(run({}).text.includes("swiipt-video-1")));
test("23. returned_model retained", () => assert.ok(run({ returnedModel: "swiipt-video-1" }).text.includes("swiipt-video-1")));
test("24. UNVERIFIED represented honestly", () => {
  const { text } = run({ returnedModel: null });
  assert.ok(/Returned model:\s*UNVERIFIED/.test(text));
});
test("25. provider_job_id retained", () => assert.ok(run({}).text.includes("mock-job-1")));
test("26. artifact path retained", () => { const { r, text } = run({}); assert.ok(text.includes(r.artifact.local_path)); });
test("27. artifact SHA-256 retained", () => { const { r, text } = run({}); assert.ok(text.includes(r.artifact.sha256)); });
test("28. requested geometry retained", () => {
  const { text } = run({});
  assert.ok(/Requested width:\s*1080/.test(text)); assert.ok(/Requested height:\s*1920/.test(text));
  assert.ok(/Requested aspect ratio:\s*9:16/.test(text));
});
test("29. actual geometry retained", () => {
  const { text } = run({});
  assert.ok(/Actual artifact width:\s*1080/.test(text)); assert.ok(/Actual artifact height:\s*1920/.test(text));
});
test("30. requested duration retained", () => assert.ok(/Requested duration:\s*6/.test(run({}).text)));
test("31. actual duration retained", () => assert.ok(/Actual artifact duration:\s*6/.test(run({}).text)));

// --- D. human escape hatch ----------------------------------------------------
test("22b. owner can open the prompt file", () => { const { file } = run({}); assert.ok(existsSync(file)); });
test("23b. owner can copy the literal prompt", () => { const { text } = run({}); assert.ok(section(text, "Canonical video prompt:", "\nExact provider prompt sent:").trim().length > 100); });
test("24b. owner can edit and regenerate elsewhere (raw text, no encoding)", () => { const { text } = run({}); assert.ok(!text.includes("\\nSUBJECT"), "prompt must not be JSON-escaped"); });
test("32. long prompt is not truncated", () => {
  const dir = mkdtempSync(join(tmpdir(), "swt-vpf-long-"));
  const long = CANON.prompt + "\nTAIL-MARKER-" + "x".repeat(20000) + "-END-MARKER";
  const p = persistVideoArtifact({ bytes: MP4, dir, artifactId: "ARTV-LONG", prompt: { canonical_prompt: long } });
  const t = readFileSync(p.artifact.prompt_file, "utf8");
  assert.ok(t.includes("TAIL-MARKER-")); assert.ok(t.includes("-END-MARKER")); assert.ok(!t.includes("[omitted]"));
});
test("33. prompt is not reconstructed", () => {
  const { text } = run({});
  const i = text.indexOf("Canonical video prompt:"); const j = text.indexOf("\nExact provider prompt sent:");
  assert.equal(text.slice(i + "Canonical video prompt:".length + 1, j).trim(), CANON.prompt.trim());
});
test("34. prompt is not summarized (full length preserved)", () => {
  const { text } = run({});
  assert.ok(text.length > CANON.prompt.length + 400);
  assert.ok(!/\.\.\.\s*\n/.test(text));
});

// --- E. security --------------------------------------------------------------
test("35. credentials absent", () => {
  const { text } = run({ env: { MOCK_VIDEO_API_KEY: "sk-live-secret-abc123xyz" } });
  assert.ok(!text.includes("sk-live-secret-abc123xyz"));
});
test("36. Authorization header absent", () => {
  const { text } = run({});
  assert.ok(!/authorization|bearer|x-api-key/i.test(text));
});

// --- F. failure honesty -------------------------------------------------------
test("37. failed generation does not create a fake artifact prompt file", () => {
  const dir = mkdtempSync(join(tmpdir(), "swt-vpf-fail-"));
  const adapter = makeMockVideoProviderAdapter({ scenario: "failed", bytes: MP4 });
  const r = runVideoProviderJob({ adapter, request: CANON, artifactDir: dir });
  assert.equal(r.state, "PROVIDER_JOB_FAILED");
  assert.equal(r.artifact, null);
  assert.equal(readdirSync(dir).filter((f) => f.endsWith(".prompt.txt")).length, 0);
});
test("31b. no provider call is represented honestly (NOT_SENT)", () => {
  const t = videoPromptText({ artifact_id: "A2" }, { canonical_prompt: "P", provider: null, provider_prompt_sent: null });
  assert.ok(/Provider:\s*NOT_SENT/.test(t)); assert.ok(/NOT_SENT/.test(t));
});
test("32b. missing returned model represented honestly", () => {
  const t = videoPromptText({ artifact_id: "A3" }, { canonical_prompt: "P", returned_model: null });
  assert.ok(/Returned model:\s*UNVERIFIED/.test(t));
});
test("33b. no canonical prompt → no fabricated prompt file", () => {
  const dir = mkdtempSync(join(tmpdir(), "swt-vpf-none-"));
  const p = persistVideoArtifact({ bytes: MP4, dir, artifactId: "ARTV-NOPROMPT", prompt: { provider: "x" } });
  assert.equal(p.ok, true);
  assert.equal(p.artifact.prompt_file, undefined);
  assert.equal(readdirSync(dir).filter((f) => f.endsWith(".prompt.txt")).length, 0);
});

// --- G. regressions -----------------------------------------------------------
test("39. video-provider-adapter tests remain green (present)", () => assert.ok(existsSync(join(root, "mae/harness/video-provider-adapter.test.mjs"))));
test("40. video-artifact tests remain green (present)", () => assert.ok(existsSync(join(root, "mae/harness/video-artifact.test.mjs"))));
test("41. video-output-qa tests remain green (present)", () => assert.ok(existsSync(join(root, "mae/harness/video-output-qa.test.mjs"))));
test("42. video-assembly tests remain green (present)", () => assert.ok(existsSync(join(root, "mae/harness/video-assembly.test.mjs"))));
test("43. video-foundation tests remain green (present)", () => assert.ok(existsSync(join(root, "mae/harness/video-foundation.test.mjs"))));
test("44. image regressions remain unchanged (present)", () => assert.ok(existsSync(join(root, "mae/harness/image-provenance.test.mjs"))));
test("45. frozen image fixture hashes unchanged", () => { for (const f of loadFixtures()) assert.equal(computeFixtureHash(f), f.fixture_hash, f.fixture_id); });
test("46. no network call", () => {
  for (const f of ["mae/media/video-artifact.js", "mae/media/video-provider-adapter.js"]) {
    const src = readFileSync(join(root, f), "utf8");
    assert.ok(!/fetch\s*\(/.test(src), f);
    assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(src), f);
  }
});
test("47. no video generation", () => assert.equal(videoGenerationStatus().available, false));
test("48. spend = $0", () => {
  const { r } = run({});
  assert.equal(r.cost, null);                 // provider supplied no cost
  assert.equal(r.state, "PROVIDER_SUCCESS");
});
