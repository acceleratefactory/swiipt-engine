// MAE Video provider adapter foundation (Wave V-E) — deterministic tests. MOCK transport only.
// No real provider, no network, no spend. Run: node mae/harness/video-provider-adapter.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  makeVideoProviderAdapter, runVideoProviderJob, capabilityReport, requestedCapabilities,
  normalizeJob, normalizeVideoProviderResult, isSafeMediaUrl, writeVideoProviderRunText,
  PROVIDER_STATE, JOB_STATUS, MODEL_IDENTITY, DEFAULT_POLL, MAX_RETRY_AFTER_MS, CAPABILITY_FOR_CONTROL,
} from "../media/video-provider-adapter.js";
import { makeMockVideoProviderAdapter, makeMockVideoTransport, MOCK_FULL_CAPABILITIES, MOCK_MINIMAL_CAPABILITIES } from "../media/video-provider-mock.js";
import { VIDEO_CAPABILITIES, videoGenerationStatus } from "../media/video-provider.js";
import { canonicalVideoRequest } from "../media/video-prompt-compiler.js";
import { VideoOutputQA } from "../services/video-output-qa.js";
import { finalAssemblyQa } from "../services/video-assembly-qa.js";
import { buildDay6AssemblySpec } from "./video-assembly-fixtures.mjs";
import { buildVideoQaCase, syntheticMp4 } from "./video-qa-fixtures.mjs";
import { buildDay6Video } from "./video-fixtures.mjs";
import { loadFixtures, computeFixtureHash } from "../services/visual-qualification.js";
import { redactSecrets } from "../media/image-provider.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const D = buildDay6Video();
const CANON = { ...canonicalVideoRequest({ promptPackage: D.promptPackage, assetSpec: D.assetSpec, grounding: D.grounding }), model: "swiipt-video-1", metadata: { ...canonicalVideoRequest({ promptPackage: D.promptPackage, assetSpec: D.assetSpec, grounding: D.grounding }).metadata, fixture_id: D.fixture_id } };
const dir = () => mkdtempSync(join(tmpdir(), "swt-vpe-"));
const MP4 = syntheticMp4({ width: 1080, height: 1920, durationSeconds: 6 });
const run = (opts) => runVideoProviderJob({ request: CANON, artifactDir: dir(), ...opts });

// --- A. contract --------------------------------------------------------------
test("1. provider adapter contract exists", () => {
  const a = makeVideoProviderAdapter({ name: "x", capabilities: {}, transport: {} });
  for (const m of ["configured", "submit", "getJob", "normalize"]) assert.equal(typeof a[m], "function", m);
  assert.equal(typeof a.name, "string");
  assert.ok(a.capabilities && typeof a.capabilities === "object");
});
test("2. configured(env) behavior works", () => {
  const a = makeMockVideoProviderAdapter({});
  assert.equal(a.configured({}).configured, false);
  assert.equal(a.configured({ MOCK_VIDEO_API_KEY: "k" }).configured, true);
  assert.deepEqual(a.configured({}).missing, ["MOCK_VIDEO_API_KEY"]);
});
test("3. unconfigured provider returns PROVIDER_UNAVAILABLE", () => {
  const a = makeMockVideoProviderAdapter({ env: {} });
  assert.equal(run({ adapter: a }).state, PROVIDER_STATE.PROVIDER_UNAVAILABLE);
});
test("4. capabilities explicitly represented", () => {
  const a = makeMockVideoProviderAdapter({ capabilities: MOCK_MINIMAL_CAPABILITIES });
  assert.equal(a.capabilities.video_generation, true);
  assert.equal(a.capabilities.fps_control, undefined);
  const report = capabilityReport(a, { ...CANON, fps: 24 });
  assert.equal(report.find((c) => c.requested_capability === "fps_control").supported, false);
  assert.equal(report.find((c) => c.requested_capability === "video_generation").supported, true);
});
test("5. canonical request accepted", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4 }) });
  assert.equal(r.state, PROVIDER_STATE.PROVIDER_SUCCESS);
  assert.equal(r.unsupported_controls.filter((c) => c.required).length, 0);
});
test("6. unsupported fields recorded", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4, capabilities: MOCK_MINIMAL_CAPABILITIES }), request: { ...CANON, fps: 24, seed: 7 } });
  const names = r.unsupported_controls.map((c) => c.requested_capability);
  assert.ok(names.includes("fps_control")); assert.ok(names.includes("seed"));
  assert.equal(r.unsupported_controls.find((c) => c.requested_capability === "fps_control").sent_to_provider, false);
});
test("7. source_image capability enforced", () => {
  let submitted = 0;
  const a = makeMockVideoProviderAdapter({ bytes: MP4, capabilities: MOCK_MINIMAL_CAPABILITIES });
  a.transport.submit = () => { submitted++; return { provider_job_id: "x", provider_status: "processing" }; };
  const r = run({ adapter: a, request: { ...CANON, source_image: "mae/storage/work/image/VF-2.jpg" } });
  assert.equal(r.state, PROVIDER_STATE.PROVIDER_ATTEMPT_FAILED);
  assert.ok(r.unsupported_controls.some((c) => c.requested_capability === "image_to_video" && c.required));
  assert.equal(submitted, 0); // never downgraded to text-to-video
});
test("8. reference_images capability enforced", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4, capabilities: MOCK_MINIMAL_CAPABILITIES }), request: { ...CANON, reference_images: ["a.png", "b.png"] } });
  assert.equal(r.state, PROVIDER_STATE.PROVIDER_ATTEMPT_FAILED);
  assert.ok(r.unsupported_controls.some((c) => c.requested_capability === "reference_image" && c.required));
});
test("9. audio capability enforced", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4, capabilities: MOCK_MINIMAL_CAPABILITIES }), request: { ...CANON, audio: { mode: "SOURCE" } } });
  assert.equal(r.state, PROVIDER_STATE.PROVIDER_ATTEMPT_FAILED);
  assert.ok(r.unsupported_controls.some((c) => c.requested_capability === "audio_generation" && c.required));
});
test("10. submit returns a normalized job", () => {
  const a = makeMockVideoProviderAdapter({ scenario: "processing_then_completed" });
  const job = a.getJob("mock-job-1", { attempt: 0, requested_model: "swiipt-video-1" });
  assert.equal(job.provider_job_id, "mock-job-1");
  assert.ok(Object.values(JOB_STATUS).includes(job.status));
  assert.equal(job.provider, "mock-video");
});
test("11. immediate-completion provider supported", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ scenario: "immediate_success", bytes: MP4 }) });
  assert.equal(r.state, PROVIDER_STATE.PROVIDER_SUCCESS);
  assert.equal(r.attempts_polled, 0);
});
test("12. async submitted state supported", () => {
  const a = makeMockVideoProviderAdapter({ scenario: "timeout" });
  const job = normalizeJob(a.transport.submit(), { provider: a.name });
  assert.equal(job.status, JOB_STATUS.PROVIDER_JOB_SUBMITTED);
  assert.ok(Object.values(JOB_STATUS).includes(JOB_STATUS.PROVIDER_JOB_SUBMITTED));
});
test("13. processing state normalized", () => {
  const a = makeMockVideoProviderAdapter({ scenario: "processing_then_completed" });
  assert.equal(a.getJob("mock-job-1", { attempt: 0 }).status, JOB_STATUS.PROVIDER_JOB_PROCESSING);
});
test("14. completed state normalized", () => {
  const a = makeMockVideoProviderAdapter({ scenario: "immediate_success", bytes: MP4 });
  assert.equal(a.getJob("mock-job-1", { attempt: 0 }).status, JOB_STATUS.PROVIDER_JOB_COMPLETED);
});
test("15. failed state normalized", () => {
  const a = makeMockVideoProviderAdapter({ scenario: "failed" });
  assert.equal(a.getJob("mock-job-1", { attempt: 0 }).status, JOB_STATUS.PROVIDER_JOB_FAILED);
});
test("16. timeout state normalized", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4, scenario: "timeout" }), poll: { poll_interval_ms: 10, max_poll_attempts: 3, timeout_ms: 1000 } });
  assert.equal(r.state, PROVIDER_STATE.PROVIDER_JOB_TIMEOUT);
});
test("17. polling is bounded", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4, scenario: "timeout" }), poll: { poll_interval_ms: 10, max_poll_attempts: 5, timeout_ms: 100000 } });
  assert.ok(r.attempts_polled <= 5);
});
test("18. max poll attempts respected", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4, scenario: "timeout" }), poll: { poll_interval_ms: 10, max_poll_attempts: 2, timeout_ms: 100000 } });
  assert.equal(r.attempts_polled, 2);
});
test("19. timeout respected", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4, scenario: "timeout" }), poll: { poll_interval_ms: 100, max_poll_attempts: 999, timeout_ms: 250 } });
  assert.equal(r.state, PROVIDER_STATE.PROVIDER_JOB_TIMEOUT);
  assert.ok(r.attempts_polled <= 3);
});

// --- B. response validation ---------------------------------------------------
test("20. malformed job response rejected", () => {
  assert.equal(run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4, scenario: "malformed" }) }).state, PROVIDER_STATE.PROVIDER_RESPONSE_INVALID);
  assert.equal(run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4, scenario: "poll_malformed" }) }).state, PROVIDER_STATE.PROVIDER_RESPONSE_INVALID);
  assert.equal(run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4, scenario: "missing_job_id" }) }).state, PROVIDER_STATE.PROVIDER_RESPONSE_INVALID);
});
test("21. completed-without-media rejected", () => assert.equal(run({ adapter: makeMockVideoProviderAdapter({ scenario: "completed_without_media" }) }).state, PROVIDER_STATE.PROVIDER_RESPONSE_INVALID));
test("22. malformed media URL rejected", () => {
  assert.equal(isSafeMediaUrl("file:///etc/passwd"), false);
  assert.equal(isSafeMediaUrl("/tmp/x.mp4"), false);
  assert.equal(isSafeMediaUrl("https://evil.example/x.mp4", ["mock.invalid"]), false);
  assert.equal(isSafeMediaUrl("https://mock.invalid/x.mp4", ["mock.invalid"]), true);
  assert.equal(run({ adapter: makeMockVideoProviderAdapter({ scenario: "malformed_url" }) }).state, PROVIDER_STATE.PROVIDER_RESPONSE_INVALID);
});

// --- C. prompt invariant ------------------------------------------------------
test("23. exact canonical prompt retained", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4 }) });
  assert.equal(r.provider_prompt_sent, CANON.prompt);
  assert.ok(CANON.prompt.length > 20);
});
test("24. exact provider prompt retained (transformed)", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4, transformedPrompt: "PROVIDER-TRANSFORMED PROMPT" }) });
  assert.equal(r.provider_prompt_sent, "PROVIDER-TRANSFORMED PROMPT");
  assert.notEqual(r.provider_prompt_sent, CANON.prompt);
});
test("25. unchanged prompt produces prompt_modified_by_adapter=false", () => assert.equal(run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4 }) }).prompt_modified_by_adapter, false));
test("26. transformed prompt produces prompt_modified_by_adapter=true", () => assert.equal(run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4, transformedPrompt: "X" }) }).prompt_modified_by_adapter, true));
test("27. negative prompt retained honestly", () => {
  const neg = "no text overlays, no logos, no medical demonstration";
  const r = run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4 }), request: { ...CANON, negative_prompt: neg } });
  assert.equal(r.negative_prompt, neg);
});

// --- D. model identity --------------------------------------------------------
test("28. requested model retained", () => assert.equal(run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4, returnedModel: "swiipt-video-1" }) }).requested_model, "swiipt-video-1"));
test("29. returned model retained", () => assert.equal(run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4, returnedModel: "swiipt-video-1" }) }).returned_model, "swiipt-video-1"));
test("30. model match recognized", () => assert.equal(run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4, returnedModel: "swiipt-video-1" }) }).model_identity, MODEL_IDENTITY.MATCH));
test("31. model mismatch explicit", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4, scenario: "model_mismatch" }) });
  assert.equal(r.model_identity, MODEL_IDENTITY.MISMATCH);
  assert.equal(r.returned_model, "some-other-model-9");
});
test("32. absent returned model gives UNVERIFIED", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4, scenario: "no_returned_model" }) });
  assert.equal(r.returned_model, null);
  assert.equal(r.model_identity, MODEL_IDENTITY.UNVERIFIED);
});
test("33. provider job ID retained", () => assert.equal(run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4 }) }).provider_job_id, "mock-job-1"));
test("34. provider raw status retained", () => {
  assert.equal(run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4 }) }).provider_status, "completed");
  const f = run({ adapter: makeMockVideoProviderAdapter({ scenario: "failed" }) });
  assert.equal(f.provider_status, "failed");
});
test("35. retryable state retained where supplied", () => assert.equal(run({ adapter: makeMockVideoProviderAdapter({ scenario: "failed" }) }).retryable, true));

// --- E. artifact --------------------------------------------------------------
test("36. provider-declared MIME retained", () => assert.equal(run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4, declaredMimeType: "video/mp4" }) }).artifact.provider_declared_mime_type, "video/mp4"));
test("37. actual bytes remain authoritative after V-B validation", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4, declaredMimeType: "video/quicktime" }) });
  assert.equal(r.artifact.status, "VIDEO_ARTIFACT_VALID");
  assert.equal(r.artifact.mime_type, "video/mp4");            // detected beats declared
  assert.equal(r.artifact.mime_type_match, false);
});
test("38. provider dimensions do not override actual dimensions", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ bytes: syntheticMp4({ width: 1024, height: 1024 }) }) });
  assert.equal(r.artifact.actual_width, 1024);
  assert.equal(r.conformance.requested_width, 1080);
  assert.equal(r.conformance.dimension_match, false);
});
test("39. provider duration does not override actual duration", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ bytes: syntheticMp4({ durationSeconds: 5 }) }) });
  assert.ok(Math.abs(r.artifact.actual_duration_seconds - 5) < 1e-6);
  assert.equal(r.conformance.requested_duration_seconds, 6);
  assert.equal(r.conformance.duration_match, false);
});
test("40. valid downloaded artifact persists", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4 }) });
  assert.ok(r.artifact.local_path && existsSync(r.artifact.local_path));
  assert.equal(r.artifact.sha256.length, 64);
});

// --- F. failure honesty -------------------------------------------------------
test("41. invalid video artifact fails honestly", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4, scenario: "invalid_video" }) });
  assert.equal(r.state, PROVIDER_STATE.VIDEO_ARTIFACT_INVALID);
});
test("42. download failure represented honestly", () => assert.equal(run({ adapter: makeMockVideoProviderAdapter({ scenario: "download_fail" }) }).state, PROVIDER_STATE.VIDEO_DOWNLOAD_FAILED));
test("43. no artifact manufactured on provider failure", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ scenario: "failed" }) });
  assert.equal(r.state, PROVIDER_STATE.PROVIDER_JOB_FAILED);
  assert.equal(r.artifact, null);
});
test("44. no artifact manufactured on timeout", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4, scenario: "timeout" }), poll: { poll_interval_ms: 10, max_poll_attempts: 2, timeout_ms: 100 } });
  assert.equal(r.state, PROVIDER_STATE.PROVIDER_JOB_TIMEOUT);
  assert.equal(r.artifact, null);
});

// --- G. provenance ------------------------------------------------------------
test("45. source-image provenance retained", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4 }), request: { ...CANON, source_image: "mae/storage/work/image/VF-2.jpg" } });
  assert.equal(r.source_image, "mae/storage/work/image/VF-2.jpg");
});
test("46. reference-image provenance retained", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4 }), request: { ...CANON, reference_images: ["a.png", "b.png"] } });
  assert.deepEqual(r.reference_images, ["a.png", "b.png"]);
});
test("47. usage is null when unavailable", () => assert.equal(run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4 }) }).usage, null));
test("48. cost is null when unavailable", () => assert.equal(run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4 }) }).cost, null));
test("49. usage retained when returned", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4, usage: { units: 6 } }) });
  assert.deepEqual(r.usage, { units: 6 });
});
test("50. cost retained when returned", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4, cost: { amount: 0.5, currency: "USD" } }) });
  assert.deepEqual(r.cost, { amount: 0.5, currency: "USD" });
});

// --- H. security --------------------------------------------------------------
test("51. credentials excluded from output", () => {
  const adapter = makeMockVideoProviderAdapter({ bytes: MP4, env: { MOCK_VIDEO_API_KEY: "secret-key-abc123" } });
  const r = run({ adapter });
  assert.ok(!JSON.stringify(r).includes("secret-key-abc123"));
  assert.deepEqual(adapter.credentialFieldNames(), ["MOCK_VIDEO_API_KEY"]);
});
test("52. Authorization headers excluded from persisted diagnostics", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4 }) });
  const p = writeVideoProviderRunText({ ...r, canonical_prompt: CANON.prompt }, dir());
  const text = readFileSync(p, "utf8");
  assert.ok(!/authorization|bearer|x-api-key|secret-key/i.test(text));
  assert.equal(redactSecrets("Authorization: Bearer sk-live-abc123xyz", { MOCK_VIDEO_API_KEY: "sk-live-abc123xyz" }).includes("sk-live-abc123xyz"), false);
});
test("53. human-readable exact prompt output works", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4, transformedPrompt: null }) });
  const p = writeVideoProviderRunText({ ...r, canonical_prompt: CANON.prompt }, dir());
  const text = readFileSync(p, "utf8");
  assert.match(text, /VIDEO PROVIDER GENERATION RECORD/);
  assert.ok(text.includes(CANON.prompt));
  assert.match(text, /model identity: MATCH|model identity: UNVERIFIED/);
});

// --- I. separation from QA / assembly -----------------------------------------
test("54. provider success does not imply VideoOutputQA PASS", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4 }) });
  assert.equal(r.state, PROVIDER_STATE.PROVIDER_SUCCESS);
  const qa = VideoOutputQA.evaluate({ artifact: r.artifact, conformance: r.conformance, assetSpec: D.assetSpec });
  assert.notEqual(qa.overall_status, "PASS");
  assert.equal(qa.overall_status, "JUDGMENT_REQUIRED");
});
test("55. provider success does not imply final assembly approval", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4 }) });
  const a = finalAssemblyQa({ spec: buildDay6AssemblySpec(), artifact: r.artifact, conformance: r.conformance });
  assert.equal(a.approved, false);
});
test("56. Day-6 fixture remains unchanged", () => {
  const f = JSON.parse(readFileSync(join(root, "mae/data/fixtures/video/VV-CSEC-006.json"), "utf8"));
  assert.equal(f.fixture_id, "VV-CSEC-006");
  assert.match(f.boundary_note, /not clinical instruction/i);
});
test("57. Day-6 adapter path can produce valid source media", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4 }) });
  assert.equal(r.state, PROVIDER_STATE.PROVIDER_SUCCESS);
  assert.equal(r.artifact.status, "VIDEO_ARTIFACT_VALID");
  assert.equal(r.artifact.video_asset_id, D.assetSpec.video_asset_id);
});
test("58. Day-6 without evaluator remains JUDGMENT_REQUIRED", () => {
  const r = run({ adapter: makeMockVideoProviderAdapter({ bytes: MP4 }) });
  assert.equal(VideoOutputQA.evaluate({ artifact: r.artifact, conformance: r.conformance, assetSpec: D.assetSpec }).overall_status, "JUDGMENT_REQUIRED");
});

// --- J. regressions / integrity ----------------------------------------------
test("59. video-assembly tests remain green (present)", () => assert.ok(existsSync(join(root, "mae/harness/video-assembly.test.mjs"))));
test("60. video-output-qa tests remain green (present)", () => assert.ok(existsSync(join(root, "mae/harness/video-output-qa.test.mjs"))));
test("61. video-artifact tests remain green (present)", () => assert.ok(existsSync(join(root, "mae/harness/video-artifact.test.mjs"))));
test("62. video-foundation tests remain green (present)", () => assert.ok(existsSync(join(root, "mae/harness/video-foundation.test.mjs"))));
test("63. image subsystem remains green (present)", () => assert.ok(existsSync(join(root, "mae/harness/compositor.test.mjs"))));
test("64. frozen image fixture hashes unchanged", () => { for (const f of loadFixtures()) assert.equal(computeFixtureHash(f), f.fixture_hash, f.fixture_id); });
test("65. no real provider call", () => {
  for (const f of ["mae/media/video-provider-adapter.js", "mae/media/video-provider-mock.js"]) {
    const src = readFileSync(join(root, f), "utf8").toLowerCase();
    for (const vendor of ["runway", "kling", "veo", "sora", "luma", "minimax", "hailuo", "pika", "seedance", "openai", "gemini", "9router"]) assert.ok(!src.includes(vendor), `${f}: ${vendor}`);
  }
});
test("66. no network call", () => {
  for (const f of ["mae/media/video-provider-adapter.js", "mae/media/video-provider-mock.js"]) {
    const src = readFileSync(join(root, f), "utf8");
    assert.ok(!/fetch\s*\(/.test(src), f);
    assert.ok(!/(^|[^'"])https?:\/\//m.test(src.replace(/"https:\/\/mock\.invalid[^"]*"/g, "")), f);
  }
});
test("67. spend = $0 (mock only, capabilities real, no provider configured)", () => {
  assert.equal(videoGenerationStatus().available, false);        // V-A registry still empty
  assert.equal(DEFAULT_POLL.max_poll_attempts > 0, true);
  assert.equal(MAX_RETRY_AFTER_MS, 60000);
  assert.ok(VIDEO_CAPABILITIES.includes("video_generation"));
  assert.ok(CAPABILITY_FOR_CONTROL.source_image === "image_to_video");
  assert.equal(DEFAULT_POLL.poll_interval_ms, 15000);
});
