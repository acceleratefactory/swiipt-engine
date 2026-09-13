// MAE Video Production Foundation (Wave V-A) — deterministic tests. No provider, no rendering.
// Run: node mae/harness/video-foundation.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAjv, schemaId } from "../lib/schema.js";
import {
  VideoGroundingService, ShotSpecificationService, VideoAssetSpecService,
  VIDEO_TYPES, VIDEO_PRODUCTION_MODES, AUDIO_MODES,
} from "../services/video-grounding.js";
import { compileVideoPromptPackage, canonicalVideoRequest, VideoPromptService, MINIMUM_MOTION_PRINCIPLE } from "../media/video-prompt-compiler.js";
import { VIDEO_CAPABILITIES, VIDEO_PROVIDER_REGISTRY, videoGenerationStatus } from "../media/video-provider.js";
import { buildDay6Video } from "./video-fixtures.mjs";
import { loadFixtures, computeFixtureHash } from "../services/visual-qualification.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const D = buildDay6Video();

// 1
test("1. valid Video Grounding passes", () => {
  assert.equal(VideoGroundingService.build(D.grounding), D.grounding);
  const ajv = getAjv();
  assert.equal(ajv.validate(schemaId("video-grounding.schema.json"), D.grounding), true, JSON.stringify(ajv.errors));
});
// 2
test("2. missing required grounding data fails", () => {
  const bad = JSON.parse(JSON.stringify(D.grounding)); delete bad.subject;
  assert.throws(() => VideoGroundingService.build(bad));
});
// 3
test("3. source_grounded vs production_instruction distinction survives", () => {
  const g = D.grounding.source_classification;
  assert.ok(g.source_grounded.includes("3 AM"));
  assert.ok(g.production_instruction.includes("locked camera"));
  assert.equal(g.source_grounded.some((x) => g.production_instruction.includes(x)), false);
});
// 4
test("4. valid Shot Specification passes", () => {
  const ajv = getAjv();
  assert.equal(ajv.validate(schemaId("shot-spec.schema.json"), D.shot), true, JSON.stringify(ajv.errors));
});
// 5
test("5. shot_count / shots array consistency is enforced", () => {
  assert.equal(D.assetSpec.shot_count, D.assetSpec.shots.length);
  assert.throws(() => VideoAssetSpecService.build({ ...D.assetSpec, shots: [] }));
  // an explicit mismatched shot_count is normalised to the real array length
  assert.equal(VideoAssetSpecService.build({ ...D.assetSpec, shots: [D.shot], shot_count: 9 }).shot_count, 1);
});
// 6
test("6. valid Video Asset Specification passes", () => {
  const ajv = getAjv();
  assert.equal(ajv.validate(schemaId("video-asset-spec.schema.json"), D.assetSpec), true, JSON.stringify(ajv.errors));
});
// 7
test("7. invalid video type is rejected", () => {
  assert.throws(() => VideoAssetSpecService.build({ ...D.assetSpec, video_type: "NOT_A_TYPE" }));
});
// 8
test("8. invalid production mode is rejected", () => {
  assert.throws(() => VideoAssetSpecService.build({ ...D.assetSpec, production_mode: "MAGIC" }));
});
// 9
test("9. canonicalVideoRequest is provider-neutral", () => {
  const req = canonicalVideoRequest({ promptPackage: D.promptPackage, assetSpec: D.assetSpec, grounding: D.grounding });
  assert.deepEqual(Object.keys(req).sort(), ["aspect_ratio", "audio", "camera", "duration_seconds", "fps", "height", "loop", "metadata", "motion", "negative_prompt", "production_mode", "prompt", "reference_images", "seed", "source_image", "video_type", "width"].sort());
  for (const bad of ["model", "provider", "size", "provider_prompt_sent", "api_key"]) assert.ok(!(bad in req), bad);
});
// 10
test("10. canonicalVideoRequest retains the exact compiled prompt", () => {
  const req = canonicalVideoRequest({ promptPackage: D.promptPackage, assetSpec: D.assetSpec, grounding: D.grounding });
  assert.equal(req.prompt, D.promptPackage.prompt);
});
// 11
test("11. prompt compiler is deterministic", () => {
  const a = compileVideoPromptPackage({ grounding: D.grounding, assetSpec: D.assetSpec });
  const b = compileVideoPromptPackage({ grounding: D.grounding, assetSpec: D.assetSpec });
  assert.deepEqual(a, b);
});
// 12
test("12. same inputs produce the same prompt", () => {
  const a = compileVideoPromptPackage({ grounding: D.grounding, assetSpec: D.assetSpec }).prompt;
  const b = compileVideoPromptPackage({ grounding: D.grounding, assetSpec: D.assetSpec }).prompt;
  assert.equal(a, b);
});
// 13
test("13. compiler does not invent extra shots", () => {
  assert.deepEqual(D.promptPackage.shot_ids, D.assetSpec.shots.map((s) => s.shot_id));
  assert.equal(D.promptPackage.shot_ids.length, 1);
});
// 14
test("14. negative prompt derives from explicit exclusions", () => {
  assert.ok(D.promptPackage.negative_prompt.includes("no staged fall"));
  assert.ok(D.promptPackage.negative_prompt.includes("falling"));
  assert.ok(D.promptPackage.negative_prompt.includes("no unsafe physical demonstration framed as clinical instruction"));
});
// 15
test("15. generated-text default is false", () => {
  assert.equal(D.grounding.text_policy.generated_text_allowed, false);
  assert.ok(D.promptPackage.sections.text_policy.includes("Generated text allowed: false"));
});
// 16
test("16. audio mode defaults honestly", () => {
  assert.equal(D.assetSpec.audio_policy, "NONE");
  assert.equal(D.grounding.audio_intent.mode, "NONE");
  assert.deepEqual(AUDIO_MODES, ["NONE", "AMBIENCE", "MUSIC", "VOICEOVER", "DIALOGUE"]);
});
// 17
test("17. no provider is called", () => {
  const st = videoGenerationStatus();
  assert.equal(st.available, false);
  assert.equal(st.state, "PROVIDER_NOT_CONFIGURED");
  assert.deepEqual(Object.keys(VIDEO_PROVIDER_REGISTRY), []);
  for (const rel of ["mae/media/video-provider.js", "mae/media/video-prompt-compiler.js", "mae/services/video-grounding.js"]) {
    const src = readFileSync(join(root, rel), "utf8");
    assert.ok(!/fetch\s*\(/.test(src), `${rel} must not call fetch`);
    assert.ok(!/https?:\/\//.test(src), `${rel} must not reference remote URLs`);
  }
});
// 18
test("18. no artifact is manufactured", () => {
  const st = videoGenerationStatus();
  assert.ok(!("artifact" in st) && !("output" in st) && !("url" in st));
});
// 19
test("19. Day-6 fixture compiles successfully", () => {
  const V = VideoPromptService.build({ grounding: D.grounding, assetSpec: D.assetSpec, id: "VPP-CSEC-006" });
  const ajv = getAjv();
  assert.equal(ajv.validate(schemaId("video-prompt-package.schema.json"), V), true, JSON.stringify(ajv.errors));
  assert.ok(V.prompt.includes("SUBJECT:") && V.prompt.includes("DO NOT SHOW:"));
});
// 20
test("20. Day-6 fixture remains depiction, not clinical instruction", () => {
  const fixture = JSON.parse(readFileSync(join(root, "mae/data/fixtures/video/VV-CSEC-006.json"), "utf8"));
  assert.equal(fixture.fixture_id, "VV-CSEC-006");
  assert.match(fixture.boundary_note, /not clinical instruction/i);
  assert.ok(!D.promptPackage.prompt.includes("3-Position")); // mechanism is Product Truth, not depicted here
  assert.ok(D.grounding.source_classification.production_instruction.includes("locked camera"));
});
// 21
test("21. existing image subsystem tests stay green (present)", () => {
  for (const f of ["mae/harness/compositor.test.mjs", "mae/harness/image-provenance.test.mjs", "mae/harness/generation-prompt.test.mjs"]) assert.ok(existsSync(join(root, f)), f);
});
// 22
test("22. frozen image fixture hashes remain unchanged", () => {
  for (const f of loadFixtures()) assert.equal(computeFixtureHash(f), f.fixture_hash, f.fixture_id);
});
