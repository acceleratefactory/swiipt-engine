// MAE Video OUTPUT QA (Wave V-C) — deterministic tests. Synthetic judgment payloads only.
// No provider, no evaluator, no network. Run: node mae/harness/video-output-qa.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  VideoOutputQA, validateJudgment, VideoJudgmentError,
  QA_STATUS, DIMENSION_CLASS, VIDEO_QA_DIMENSIONS, VIDEO_ZERO_TOLERANCE_CLASSES,
} from "../services/video-output-qa.js";
import { buildVideoQaCase } from "./video-qa-fixtures.mjs";
import { buildVideoGenerationRecord, VIDEO_ARTIFACT_STATUS } from "../media/video-artifact.js";
import { videoGenerationStatus } from "../media/video-provider.js";
import { buildDay6Video } from "./video-fixtures.mjs";
import { loadFixtures, computeFixtureHash } from "../services/visual-qualification.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const D = buildDay6Video();
const PASS_JUDGMENT = Object.fromEntries(VIDEO_QA_DIMENSIONS.map((d) => [d.id, { status: "PASS", reason: "synthetic evaluation" }]));
const withFail = (id, failure_class) => ({ ...PASS_JUDGMENT, [id]: { status: "FAIL", reason: "synthetic", failure_class } });
const dim = (res, id) => res.dimensions.find((d) => d.id === id);

// --- dimensions ---------------------------------------------------------------
test("1. exactly 20 VideoOutputQA dimensions exist", () => assert.equal(VIDEO_QA_DIMENSIONS.length, 20));
test("2. dimension names are stable", () => assert.deepEqual(VIDEO_QA_DIMENSIONS.map((d) => d.id), [
  "ANGLE_FIDELITY", "CUSTOMER_TRUTH_FIDELITY", "PRODUCT_TRUTH_FIDELITY", "VIDEO_GROUNDING_FIDELITY", "SCENE_FIDELITY",
  "CULTURAL_INTEGRITY", "EMOTIONAL_INTEGRITY", "BRAND_FIT", "INTERCHANGEABILITY", "AI_ARTIFACTS",
  "ANATOMICAL_PLAUSIBILITY", "MOTION_PLAUSIBILITY", "CONTINUITY", "CAMERA_CONTROL", "COMPOSITION",
  "TEXT_SAFETY", "AUDIO_INTEGRITY", "PLATFORM_FIT", "UNSUPPORTED_VISUAL_CLAIM", "UNSUPPORTED_AUDIO_CLAIM",
]));
test("3. dimension evaluation types are correct", () => {
  const cls = Object.fromEntries(VIDEO_QA_DIMENSIONS.map((d) => [d.id, d.class]));
  const J = DIMENSION_CLASS.JUDGMENT_REQUIRED, H = DIMENSION_CLASS.HYBRID, DT = DIMENSION_CLASS.DETERMINISTIC;
  assert.equal(cls.PLATFORM_FIT, DT);
  for (const id of ["VIDEO_GROUNDING_FIDELITY", "SCENE_FIDELITY", "BRAND_FIT", "CAMERA_CONTROL", "COMPOSITION", "TEXT_SAFETY", "AUDIO_INTEGRITY"]) assert.equal(cls[id], H, id);
  for (const id of ["ANGLE_FIDELITY", "PRODUCT_TRUTH_FIDELITY", "INTERCHANGEABILITY", "AI_ARTIFACTS", "ANATOMICAL_PLAUSIBILITY", "MOTION_PLAUSIBILITY", "CONTINUITY", "UNSUPPORTED_VISUAL_CLAIM", "UNSUPPORTED_AUDIO_CLAIM"]) assert.equal(cls[id], J, id);
});

// --- no judgment --------------------------------------------------------------
test("4. no judgment -> judgment dimensions remain JUDGMENT_REQUIRED", () => {
  const c = buildVideoQaCase();
  const r = VideoOutputQA.evaluate(c);
  assert.equal(dim(r, "PRODUCT_TRUTH_FIDELITY").status, QA_STATUS.JUDGMENT_REQUIRED);
  assert.equal(dim(r, "AI_ARTIFACTS").status, QA_STATUS.JUDGMENT_REQUIRED);
});
test("5. no judgment -> overall cannot PASS", () => {
  const r = VideoOutputQA.evaluate(buildVideoQaCase());
  assert.notEqual(r.overall_status, QA_STATUS.PASS);
  assert.equal(r.overall_status, QA_STATUS.JUDGMENT_REQUIRED);
});
test("6. no judgment -> human_review_required true", () => assert.equal(VideoOutputQA.evaluate(buildVideoQaCase()).human_review_required, true));
test("7. clean complete synthetic judgment can PASS", () => {
  const r = VideoOutputQA.evaluate({ ...buildVideoQaCase(), judgment: { ...PASS_JUDGMENT, vision_model_id: "synthetic-evaluator-v0" } });
  assert.equal(r.overall_status, QA_STATUS.PASS);
  assert.equal(r.human_review_required, false);
  assert.equal(r.vision_model, "synthetic-evaluator-v0");
});

// --- judgment rejection -------------------------------------------------------
test("8. unknown judgment dimension rejected", () => {
  assert.equal(validateJudgment({ NOT_A_DIMENSION: { status: "PASS" } }).valid, false);
  assert.throws(() => VideoOutputQA.evaluate({ ...buildVideoQaCase(), judgment: { NOT_A_DIMENSION: { status: "PASS" } } }), VideoJudgmentError);
});
test("9. unknown judgment status rejected", () => {
  assert.equal(validateJudgment({ AI_ARTIFACTS: { status: "ASSUMED_PASS" } }).valid, false);
  assert.equal(validateJudgment({ AI_ARTIFACTS: { status: "SKIPPED_SUCCESSFULLY" } }).valid, false);
});
test("10. unknown zero-tolerance failure class rejected", () => assert.equal(validateJudgment({ AI_ARTIFACTS: { status: "FAIL", failure_class: "MADE_UP_CLASS" } }).valid, false));

// --- zero-tolerance -----------------------------------------------------------
const ZT = [
  ["11. PRODUCT_TRUTH_VIOLATION forces BLOCK", withFail("PRODUCT_TRUTH_FIDELITY", "PRODUCT_TRUTH_VIOLATION"), "PRODUCT_TRUTH_VIOLATION"],
  ["12. SAFETY_VIOLATION forces BLOCK", { ...PASS_JUDGMENT, safety_violation: true }, "SAFETY_VIOLATION"],
  ["13. UNSUPPORTED_VISUAL_CLAIM forces BLOCK", withFail("UNSUPPORTED_VISUAL_CLAIM", "UNSUPPORTED_VISUAL_CLAIM"), "UNSUPPORTED_VISUAL_CLAIM"],
  ["14. UNSUPPORTED_AUDIO_CLAIM forces BLOCK", withFail("UNSUPPORTED_AUDIO_CLAIM", "UNSUPPORTED_AUDIO_CLAIM"), "UNSUPPORTED_AUDIO_CLAIM"],
  ["15. SEVERE_CULTURAL_MISREPRESENTATION forces BLOCK", withFail("CULTURAL_INTEGRITY", "SEVERE_CULTURAL_MISREPRESENTATION"), "SEVERE_CULTURAL_MISREPRESENTATION"],
  ["16. SEVERE_ANATOMICAL_DEFECT forces BLOCK", withFail("ANATOMICAL_PLAUSIBILITY", "SEVERE_ANATOMICAL_DEFECT"), "SEVERE_ANATOMICAL_DEFECT"],
  ["17. SEVERE_MOTION_DEFECT forces BLOCK", withFail("MOTION_PLAUSIBILITY", "SEVERE_MOTION_DEFECT"), "SEVERE_MOTION_DEFECT"],
];
for (const [name, judgment, cls] of ZT) {
  test(name, () => {
    const r = VideoOutputQA.evaluate({ ...buildVideoQaCase(), judgment });
    assert.equal(r.overall_status, QA_STATUS.BLOCK);
    assert.ok(r.blocking_failures.includes(cls), `${cls} in blocking_failures`);
  });
}
test("18. blocking failures recorded explicitly", () => {
  const r = VideoOutputQA.evaluate({ ...buildVideoQaCase(), judgment: withFail("PRODUCT_TRUTH_FIDELITY", "PRODUCT_TRUTH_VIOLATION") });
  assert.ok(Array.isArray(r.blocking_failures) && r.blocking_failures.length >= 1);
  assert.ok(VIDEO_ZERO_TOLERANCE_CLASSES.includes(r.blocking_failures[0]));
});

// --- validity vs QA -----------------------------------------------------------
test("19. mechanical artifact validity remains distinct from QA status", () => {
  const r = VideoOutputQA.evaluate(buildVideoQaCase());
  assert.equal(r.artifact_status, VIDEO_ARTIFACT_STATUS.VIDEO_ARTIFACT_VALID);
  assert.equal(r.overall_status, QA_STATUS.JUDGMENT_REQUIRED);
});
test("20. platform geometry mismatch fails PLATFORM_FIT without making the artifact invalid", () => {
  const c = buildVideoQaCase({ mp4: { width: 1024, height: 1024 } });
  const r = VideoOutputQA.evaluate({ ...c, judgment: PASS_JUDGMENT });
  assert.equal(c.artifact.status, VIDEO_ARTIFACT_STATUS.VIDEO_ARTIFACT_VALID);
  assert.equal(dim(r, "PLATFORM_FIT").status, QA_STATUS.FAIL);
  assert.equal(r.overall_status, QA_STATUS.FAIL);
});
test("21. duration mismatch can affect PLATFORM_FIT without making the artifact invalid", () => {
  const c = buildVideoQaCase({ mp4: { durationSeconds: 5 }, spec: { duration_seconds: 6 } });
  const r = VideoOutputQA.evaluate({ ...c, judgment: PASS_JUDGMENT });
  assert.equal(c.artifact.status, VIDEO_ARTIFACT_STATUS.VIDEO_ARTIFACT_VALID);
  assert.equal(dim(r, "PLATFORM_FIT").status, QA_STATUS.FAIL);
});
test("22. audio policy NONE + audio stream present fails AUDIO_INTEGRITY", () => {
  const r = VideoOutputQA.evaluate({ ...buildVideoQaCase({ audio: true }), judgment: PASS_JUDGMENT });
  assert.equal(dim(r, "AUDIO_INTEGRITY").status, QA_STATUS.FAIL);
});
test("23. audio stream absent with NONE does not fabricate semantic PASS", () => {
  const r = VideoOutputQA.evaluate(buildVideoQaCase());
  assert.notEqual(dim(r, "AUDIO_INTEGRITY").status, QA_STATUS.PASS);
  assert.equal(dim(r, "AUDIO_INTEGRITY").status, QA_STATUS.JUDGMENT_REQUIRED);
});
test("24. VIDEO_GROUNDING_FIDELITY remains JUDGMENT_REQUIRED when only metadata evidence exists", () => assert.equal(dim(VideoOutputQA.evaluate(buildVideoQaCase()), "VIDEO_GROUNDING_FIDELITY").status, QA_STATUS.JUDGMENT_REQUIRED));
test("25. CAMERA_CONTROL remains JUDGMENT_REQUIRED where camera behavior has not been judged", () => assert.equal(dim(VideoOutputQA.evaluate(buildVideoQaCase()), "CAMERA_CONTROL").status, QA_STATUS.JUDGMENT_REQUIRED));
test("26. TEXT_SAFETY remains judgment-required where text absence cannot be mechanically proven", () => assert.equal(dim(VideoOutputQA.evaluate(buildVideoQaCase()), "TEXT_SAFETY").status, QA_STATUS.JUDGMENT_REQUIRED));

// --- partial judgment ---------------------------------------------------------
test("27. partial judgment leaves unresolved dimensions JUDGMENT_REQUIRED", () => {
  const partial = { ANGLE_FIDELITY: { status: "PASS", reason: "synthetic" }, AI_ARTIFACTS: { status: "PASS", reason: "synthetic" } };
  const r = VideoOutputQA.evaluate({ ...buildVideoQaCase(), judgment: partial });
  assert.equal(dim(r, "ANGLE_FIDELITY").status, QA_STATUS.PASS);
  assert.equal(dim(r, "MOTION_PLAUSIBILITY").status, QA_STATUS.JUDGMENT_REQUIRED);
});
test("28. partial judgment cannot produce overall PASS", () => {
  const r = VideoOutputQA.evaluate({ ...buildVideoQaCase(), judgment: { ANGLE_FIDELITY: { status: "PASS" } } });
  assert.notEqual(r.overall_status, QA_STATUS.PASS);
  assert.equal(r.overall_status, QA_STATUS.JUDGMENT_REQUIRED);
});
test("29. judgment cannot override a deterministic blocking failure", () => {
  const r = VideoOutputQA.evaluate({ ...buildVideoQaCase({ audio: true }), judgment: PASS_JUDGMENT });
  assert.equal(dim(r, "AUDIO_INTEGRITY").status, QA_STATUS.FAIL);
  assert.notEqual(r.overall_status, QA_STATUS.PASS);
});
test("30. judgment cannot make an invalid/missing artifact PASS", () => {
  const invalid = VideoOutputQA.evaluate({ artifact: { status: VIDEO_ARTIFACT_STATUS.VIDEO_ARTIFACT_EMPTY }, judgment: PASS_JUDGMENT });
  assert.notEqual(invalid.overall_status, QA_STATUS.PASS);
  const missing = VideoOutputQA.evaluate({ artifact: null, judgment: PASS_JUDGMENT });
  assert.equal(missing.overall_status, QA_STATUS.SOURCE_REQUIRED);
});

// --- Day-6 --------------------------------------------------------------------
test("31. Day-6 fixture remains depiction, not instruction", () => {
  const f = JSON.parse(readFileSync(join(root, "mae/data/fixtures/video/VV-CSEC-006.json"), "utf8"));
  assert.match(f.boundary_note, /not clinical instruction/i);
  assert.match(f.boundary_note, /depiction/i);
  assert.ok(!("video_artifact" in f));
});
test("32. Day-6 valid mechanical artifact alone does not PASS VideoOutputQA", () => {
  const r = VideoOutputQA.evaluate(buildVideoQaCase());
  assert.equal(r.artifact_status, VIDEO_ARTIFACT_STATUS.VIDEO_ARTIFACT_VALID);
  assert.notEqual(r.overall_status, QA_STATUS.PASS);
});
test("33. synthetic unsupported clinical demonstration blocks the Day-6 asset", () => {
  const judgment = withFail("PRODUCT_TRUTH_FIDELITY", "PRODUCT_TRUTH_VIOLATION");
  judgment.UNSUPPORTED_VISUAL_CLAIM = { status: "FAIL", reason: "demonstrates an unsupported recovery movement as instruction", failure_class: "UNSUPPORTED_VISUAL_CLAIM" };
  const r = VideoOutputQA.evaluate({ ...buildVideoQaCase(), judgment });
  assert.equal(r.overall_status, QA_STATUS.BLOCK);
  assert.ok(r.blocking_failures.includes("PRODUCT_TRUTH_VIOLATION"));
  assert.ok(r.blocking_failures.includes("UNSUPPORTED_VISUAL_CLAIM"));
});

// --- judgment-only dimensions stay judgment-based -----------------------------
for (const [n, id] of [[34, "INTERCHANGEABILITY"], [35, "AI_ARTIFACTS"], [36, "ANATOMICAL_PLAUSIBILITY"], [37, "MOTION_PLAUSIBILITY"], [38, "CONTINUITY"]]) {
  test(`${n}. ${id} remains judgment-based`, () => {
    assert.equal(dim(VideoOutputQA.evaluate(buildVideoQaCase()), id).status, QA_STATUS.JUDGMENT_REQUIRED);
    assert.equal(VideoOutputQA.dimension(id).class, DIMENSION_CLASS.JUDGMENT_REQUIRED);
  });
}

// --- upstream integrity / regressions ----------------------------------------
test("39. exact video prompt/provenance records remain unchanged (V-B)", () => {
  const c = buildVideoQaCase();
  const rec = buildVideoGenerationRecord({ promptPackage: D.promptPackage, artifact: c.artifact, conformance: c.conformance });
  assert.equal(rec.canonical_video_prompt, D.promptPackage.prompt);
  assert.equal(rec.provider_prompt_sent, null);
});
test("40. Wave V-B video-artifact tests stay green (present)", () => assert.ok(existsSync(join(root, "mae/harness/video-artifact.test.mjs"))));
test("41. Wave V-A video-foundation tests stay green (fixture + module intact)", () => {
  assert.ok(existsSync(join(root, "mae/harness/video-foundation.test.mjs")));
  assert.equal(D.assetSpec.video_asset_id, "VID-CSEC-006");
});
test("42. image subsystem tests stay green (present)", () => {
  for (const f of ["compositor.test.mjs", "image-provenance.test.mjs", "visual-qualification.test.mjs"]) assert.ok(existsSync(join(root, "mae/harness", f)), f);
});
test("43. frozen image fixture hashes remain unchanged", () => { for (const f of loadFixtures()) assert.equal(computeFixtureHash(f), f.fixture_hash, f.fixture_id); });
test("44. no provider call occurs", () => assert.equal(videoGenerationStatus().available, false));
test("45. no network call occurs", () => {
  const src = readFileSync(join(root, "mae/services/video-output-qa.js"), "utf8");
  assert.ok(!/fetch\s*\(/.test(src));
  assert.ok(!/https?:\/\//.test(src));
});
