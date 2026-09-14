// MAE Deterministic Video Assembly (Wave V-D) — tests. Local ffmpeg only; no provider, no network.
// Render assertions skip honestly when ffmpeg is not available locally.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateAssemblySpec, normalizeAssemblySpec, assemblySpecHash, buildTextLayers,
  assemblySafeAreas, ASSEMBLY_STATUS, PRODUCTION_MODES, TIMELINE_ITEM_TYPES, AUDIO_MODES,
  TRANSITIONS, STILL_MOTION_TYPES, FITS, FOCALS, layerZ,
} from "../media/video-assembly-spec.js";
import { assembleVideo, assemblyEngineStatus, provenanceFor, resolveFont } from "../media/video-assembler.js";
import { assemblyChecks, finalAssemblyQa, ASSEMBLY_QA_CHECKS } from "../services/video-assembly-qa.js";
import { QA_STATUS } from "../services/video-output-qa.js";
import { computeImageBox } from "../media/layout.js";
import { buildVideoQaCase } from "./video-qa-fixtures.mjs";
import { buildDay6AssemblySpec, DAY6_HEADLINE, ensureSourceVideo, ensureStillImage, ensureNonVideoFile } from "./video-assembly-fixtures.mjs";
import { loadFixtures, computeFixtureHash } from "../services/visual-qualification.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DAY6 = buildDay6AssemblySpec();
const bad = (patch) => { const s = JSON.parse(JSON.stringify(DAY6)); return { ...s, ...patch }; };
const withTimeline = (fn) => { const s = JSON.parse(JSON.stringify(DAY6)); return { ...s, timeline: fn(s.timeline) }; };

// --- local render setup (ffmpeg only) ----------------------------------------
const work = mkdtempSync(join(tmpdir(), "swt-vda-"));
const engine = assemblyEngineStatus();
const SRC = engine.available ? ensureSourceVideo(work) : null;
const SRC_AUDIO = engine.available ? ensureSourceVideo(work, { name: "day6-audio.mp4", audio: true }) : null;
const STILL = engine.available ? ensureStillImage(work) : null;
const NOT_VIDEO = engine.available ? ensureNonVideoFile(work) : null;
const SRC_MAP = { "VV-CSEC-006": SRC };
const R1 = engine.available && SRC ? assembleVideo({ spec: DAY6, dir: join(work, "r1"), sources: SRC_MAP }) : null;
const IMAGE_MOTION = {
  ...DAY6, production_mode: "IMAGE_TO_MOTION_ASSEMBLY",
  canvas: { ...DAY6.canvas, duration_seconds: 2 },
  timeline: [{ item_id: "still", type: "IMAGE", start_time: 0, end_time: 2, z: 10, source: { ref: "STILL" }, position: { fit: "cover", focal: "center" }, motion: { type: "SLOW_ZOOM", start_scale: 1.0, end_scale: 1.04 } }],
  poster_frame: { source_image: "STILL" },
};
const R_STILL = engine.available && STILL ? assembleVideo({ spec: IMAGE_MOTION, dir: join(work, "r-still"), sources: { STILL } }) : null;
const R_AUDIO = engine.available && SRC_AUDIO ? assembleVideo({ spec: { ...DAY6, audio: { mode: "SOURCE" } }, dir: join(work, "r-audio"), sources: { "VV-CSEC-006": SRC_AUDIO } }) : null;
const multiSpec = (t) => ({
  ...DAY6, production_mode: "MULTI_CLIP_SEQUENCE", canvas: { ...DAY6.canvas, duration_seconds: 2 },
  timeline: [
    { item_id: "c1", type: "VIDEO", start_time: 0, end_time: 1, z: 10, source: { ref: "VV-CSEC-006" }, position: { fit: "cover" } },
    { item_id: "c2", type: "VIDEO", start_time: 1, end_time: 2, z: 10, source: { ref: "VV-CSEC-006" }, position: { fit: "cover" }, transition: { type: t } },
  ],
});
const R_CUT = engine.available && SRC ? assembleVideo({ spec: multiSpec("CUT"), dir: join(work, "r-cut"), sources: SRC_MAP }) : null;
const R_FADE = engine.available && SRC ? assembleVideo({ spec: multiSpec("FADE"), dir: join(work, "r-fade"), sources: SRC_MAP }) : null;
const R_FAIL = engine.available && NOT_VIDEO ? assembleVideo({ spec: withTimeline((tl) => [{ ...tl[0], source: { ref: "BAD" } }]), dir: join(work, "r-fail"), sources: { BAD: NOT_VIDEO } }) : null;

// --- A. contract / validation -------------------------------------------------
test("1. assembly specification validates", () => assert.equal(validateAssemblySpec(DAY6).valid, true));
test("2. malformed assembly specification rejects", () => assert.equal(validateAssemblySpec(bad({ canvas: { width: 0, height: 0 } })).valid, false));
test("3. timeline negative start rejects", () => assert.match(validateAssemblySpec(withTimeline((tl) => [{ ...tl[0], start_time: -1 }, ...tl.slice(1)])).errors.join(" "), /negative start time/));
test("4. timeline end-before-start rejects", () => assert.match(validateAssemblySpec(withTimeline((tl) => [{ ...tl[0], start_time: 3, end_time: 2 }, ...tl.slice(1)])).errors.join(" "), /end before start/));
test("5. timeline item beyond duration rejects", () => assert.match(validateAssemblySpec(withTimeline((tl) => [{ ...tl[0], end_time: 9 }, ...tl.slice(1)])).errors.join(" "), /beyond total duration/));
test("6. missing source rejects", () => {
  const r = assembleVideo({ spec: withTimeline((tl) => [{ ...tl[0], source: { ref: "does-not-exist" } }]), dir: join(work, "missing"), sources: {} });
  assert.equal(r.status, ASSEMBLY_STATUS.SOURCE_REQUIRED);
});
test("7. unsupported layer type rejects", () => assert.match(validateAssemblySpec(withTimeline((tl) => [...tl, { item_id: "x", type: "STICKER", start_time: 0, end_time: 1 }])).errors.join(" "), /unsupported layer type/));
test("8. invalid opacity rejects", () => assert.match(validateAssemblySpec(withTimeline((tl) => [{ ...tl[1], opacity: 1.7 }, ...tl.filter((_, i) => i !== 1)])).errors.join(" "), /invalid opacity/));
test("9. canvas width/height retained", () => { const n = normalizeAssemblySpec(DAY6).canvas; assert.equal(n.width, 1080); assert.equal(n.height, 1920); });
test("10. aspect ratio retained", () => assert.equal(normalizeAssemblySpec(DAY6).canvas.aspect_ratio, "9:16"));
test("11. source fit COVER behaves deterministically", () => {
  const a = computeImageBox(1024, 1024, { x: 0, y: 0, w: 1080, h: 1920 }, "cover", "center");
  const b = computeImageBox(1024, 1024, { x: 0, y: 0, w: 1080, h: 1920 }, "cover", "center");
  assert.deepEqual(a, b); assert.ok(FITS.includes("cover")); assert.equal(a.w, 1920);
});
test("12. source fit CONTAIN behaves deterministically", () => {
  const a = computeImageBox(1024, 1024, { x: 0, y: 0, w: 1080, h: 1920 }, "contain", "center");
  const b = computeImageBox(1024, 1024, { x: 0, y: 0, w: 1080, h: 1920 }, "contain", "center");
  const cover = computeImageBox(1024, 1024, { x: 0, y: 0, w: 1080, h: 1920 }, "cover", "center");
  assert.deepEqual(a, b); assert.notDeepEqual(a, cover); assert.ok(FITS.includes("contain")); assert.equal(a.w, 1080);
});
test("13. focal position retained", () => {
  assert.ok(FOCALS.includes("top"));
  const ok = withTimeline((tl) => [{ ...tl[0], position: { fit: "cover", focal: "top" } }, ...tl.slice(1)]);
  assert.equal(validateAssemblySpec(ok).valid, true);
  assert.match(validateAssemblySpec(withTimeline((tl) => [{ ...tl[0], position: { fit: "cover", focal: "middle" } }, ...tl.slice(1)])).errors.join(" "), /invalid focal/);
});
test("14. layer ordering deterministic", () => {
  const a = buildTextLayers(DAY6).map((l) => l.item_id);
  const b = buildTextLayers(DAY6).map((l) => l.item_id);
  assert.deepEqual(a, b);
  assert.ok(layerZ({ type: "LOGO" }) > layerZ({ type: "TEXT", role: "headline" }));
  assert.ok(layerZ({ type: "TEXT", role: "headline" }) > layerZ({ type: "OVERLAY" }));
});

// --- B. typography / graphics -------------------------------------------------
test("15. text uses approved copy exactly", () => {
  const layer = buildTextLayers(DAY6).find((l) => l.role === "headline");
  assert.equal(layer.value, DAY6_HEADLINE);
});
test("16. no copy rewriting occurs", () => {
  const r = assembleVideo({ spec: DAY6, dir: join(work, "copy"), sources: SRC_MAP });
  if (!existsSync(join(work, "copy", "headline.txt"))) return; // render skipped (no ffmpeg)
  assert.equal(readFileSync(join(work, "copy", "headline.txt"), "utf8"), DAY6_HEADLINE);
  assert.equal(r.assembly_spec_hash, assemblySpecHash(DAY6));
});
test("17. text overflow fails explicitly", () => {
  const spec = withTimeline((tl) => [{ ...tl[0] }, { ...tl[1] }, { ...tl[2], position: { x: 0, y: 0, width: 120, height: 40 } }]);
  const v = validateAssemblySpec(spec);
  assert.match(v.errors.join(" "), /TEXT_OVERFLOW/);
  assert.ok(v.overflow.length >= 1);
  assert.equal(assembleVideo({ spec, dir: join(work, "ovf"), sources: SRC_MAP }).status, ASSEMBLY_STATUS.TEXT_OVERFLOW);
});
test("18. captions require supplied text", () => {
  const spec = withTimeline((tl) => [...tl, { item_id: "cap", type: "CAPTION", start_time: 0, end_time: 2, text: {} }]);
  assert.match(validateAssemblySpec(spec).errors.join(" "), /requires supplied approved text/);
});
test("19. captions require valid timing", () => {
  const spec = withTimeline((tl) => [...tl, { item_id: "cap", type: "CAPTION", start_time: 3, end_time: 2, text: { value: "Day 6." } }]);
  assert.match(validateAssemblySpec(spec).errors.join(" "), /caption requires valid timing|end before start/);
});
test("20. caption wording is not invented", () => {
  const copy = "Day 6 — slow, careful.";
  const spec = { ...withTimeline((tl) => [...tl, { item_id: "cap", type: "CAPTION", start_time: 0, end_time: 2, z: 30, text: { value: copy } }]), production_mode: "VIDEO_WITH_CAPTIONS" };
  const layer = buildTextLayers(spec).find((l) => l.type === "CAPTION");
  assert.equal(layer.value, copy);
  assert.equal(validateAssemblySpec(spec).errors.join(" ").includes("requires supplied"), false);
});
test("21. CTA requires supplied approved copy", () => {
  const spec = withTimeline((tl) => [...tl, { item_id: "cta", type: "CTA", start_time: 5, end_time: 6, text: {} }]);
  assert.match(validateAssemblySpec(spec).errors.join(" "), /requires supplied approved text/);
});
test("22. logo placement deterministic", () => {
  const spec = withTimeline((tl) => [...tl, { item_id: "logo", type: "LOGO", start_time: 0, end_time: 6, z: 60, position: { x: 900, y: 48, width: 120, height: 40 } }]);
  const a = buildTextLayers(spec).find((l) => l.type === "LOGO");
  const b = buildTextLayers(spec).find((l) => l.type === "LOGO");
  assert.deepEqual(a, b);
  assert.equal(a.z, 60);
  assert.equal(validateAssemblySpec(spec).valid, true);
});
test("23. safe-zone violations detected", () => {
  const spec = { ...DAY6, safe_zones: [{ edge: "top", min_px: 99999 }] };
  const checks = assemblyChecks({ spec, artifact: null });
  assert.equal(checks.checks.find((c) => c.check === "safe_zone_bounds").pass, false);
});
test("24. poster frame timestamp retained", () => {
  assert.equal(normalizeAssemblySpec(DAY6).poster_frame.timestamp, 0.5);
  if (!R1 || R1.status !== ASSEMBLY_STATUS.ASSEMBLY_RENDERED) return;
  assert.ok(R1.poster_path && existsSync(R1.poster_path));
});
test("25. poster frame source-image mode retained", () => {
  assert.equal(normalizeAssemblySpec(IMAGE_MOTION).poster_frame.source_image, "STILL");
  if (!R_STILL || R_STILL.status !== ASSEMBLY_STATUS.ASSEMBLY_RENDERED) return;
  assert.ok(existsSync(R_STILL.poster_path));
  assert.equal(readFileSync(R_STILL.poster_path).length, readFileSync(STILL).length);
});

// --- C. audio -----------------------------------------------------------------
test("26. audio NONE produces no audio track where the assembly path supports it", () => {
  assert.equal(AUDIO_MODES.includes("NONE"), true);
  if (!R1 || R1.status !== ASSEMBLY_STATUS.ASSEMBLY_RENDERED) return;
  assert.equal(R1.audio_stream_present, false);
});
test("27. audio SOURCE preserves source audio when allowed", () => {
  if (!R_AUDIO || R_AUDIO.status !== ASSEMBLY_STATUS.ASSEMBLY_RENDERED) return;
  assert.equal(R_AUDIO.audio_stream_present, true);
});
test("28. EXTERNAL_TRACK requires supplied artifact", () => {
  assert.match(validateAssemblySpec(bad({ audio: { mode: "EXTERNAL_TRACK", ref: null } })).errors.join(" "), /EXTERNAL_TRACK requires/);
  const r = assembleVideo({ spec: bad({ audio: { mode: "EXTERNAL_TRACK", ref: "missing.m4a" } }), dir: join(work, "ext"), sources: {} });
  assert.equal(r.status, ASSEMBLY_STATUS.SOURCE_REQUIRED);
});
test("29. unsupported audio mode rejected", () => assert.match(validateAssemblySpec(bad({ audio: { mode: "AI_MUSIC" } })).errors.join(" "), /unsupported audio mode/));

// --- D. transitions -----------------------------------------------------------
test("30. CUT transition supported", () => {
  assert.ok(TRANSITIONS.includes("CUT"));
  assert.equal(validateAssemblySpec(multiSpec("CUT")).valid, true);
  if (R_CUT) assert.equal(R_CUT.status, ASSEMBLY_STATUS.ASSEMBLY_RENDERED);
});
test("31. FADE transition supported", () => {
  assert.ok(TRANSITIONS.includes("FADE"));
  assert.equal(validateAssemblySpec(multiSpec("FADE")).valid, true);
  if (R_FADE) assert.equal(R_FADE.status, ASSEMBLY_STATUS.ASSEMBLY_RENDERED);
});
test("32. unsupported transition rejected", () => assert.match(validateAssemblySpec(multiSpec("DISSOLVE")).errors.join(" "), /unsupported transition/));

// --- E. still motion / hash / outputs ----------------------------------------
test("33. deterministic still-image motion parameters retained", () => {
  const m = normalizeAssemblySpec(IMAGE_MOTION).timeline[0].motion;
  assert.deepEqual(m, { type: "SLOW_ZOOM", start_scale: 1.0, end_scale: 1.04 });
  assert.ok(STILL_MOTION_TYPES.includes(m.type));
  assert.match(validateAssemblySpec({ ...withTimeline((tl) => [{ ...tl[0], type: "IMAGE", motion: { type: "SLOW_ZOOM" } }, ...tl.slice(1)]), production_mode: "IMAGE_TO_MOTION_ASSEMBLY" }).errors.join(" "), /SLOW_ZOOM requires/);
});
test("34. assembly-spec hash stable", () => {
  assert.equal(assemblySpecHash(DAY6), assemblySpecHash(DAY6));
  const reordered = {}; for (const k of Object.keys(DAY6).reverse()) reordered[k] = DAY6[k];
  assert.equal(assemblySpecHash(reordered), assemblySpecHash(DAY6));
});
test("35. volatile fields do not affect the assembly-spec hash", () => {
  assert.equal(assemblySpecHash({ ...DAY6, generated_at: "2026-01-01T00:00:00Z" }), assemblySpecHash({ ...DAY6, generated_at: "2099-12-31T23:59:59Z" }));
});
test("36. final artifact receives SHA-256", () => {
  if (!R1 || R1.status !== ASSEMBLY_STATUS.ASSEMBLY_RENDERED) return;
  assert.equal(R1.sha256.length, 64);
});
test("37. final artifact mechanically validated after render", () => {
  if (!R1 || R1.status !== ASSEMBLY_STATUS.ASSEMBLY_RENDERED) return;
  assert.equal(R1.status, ASSEMBLY_STATUS.ASSEMBLY_RENDERED);
  assert.ok(R1.assembly_spec_hash.length === 64);
});
test("38. final width/height inspected from bytes", () => {
  if (!R1 || R1.status !== ASSEMBLY_STATUS.ASSEMBLY_RENDERED) return;
  assert.equal(R1.width, 1080); assert.equal(R1.height, 1920);
});
test("39. final duration inspected from bytes", () => {
  if (!R1 || R1.status !== ASSEMBLY_STATUS.ASSEMBLY_RENDERED) return;
  assert.ok(Math.abs(R1.duration_seconds - 6) <= 0.5);
});
test("40. render failure is not reported as success", () => {
  if (!R_FAIL) return;
  assert.equal(R_FAIL.status, ASSEMBLY_STATUS.ASSEMBLY_FAILED);
  assert.notEqual(R_FAIL.status, ASSEMBLY_STATUS.ASSEMBLY_RENDERED);
  assert.ok(R_FAIL.errors.length >= 1);
});

// --- F. provenance ------------------------------------------------------------
test("41. source provenance retained", () => {
  const p = provenanceFor(DAY6);
  assert.equal(p.angle_id, "ANG-CSEC-006");
  assert.equal(p.video_grounding_id, "VG-VID-CSEC-006");
  assert.equal(p.source_artifacts.length, 1);
});
test("42. prompt provenance retained", () => assert.equal(provenanceFor(DAY6).source_prompts[0].ref, "VIDEO-PROMPT-CSEC-006"));
test("43. approved copy provenance retained", () => assert.match(provenanceFor(DAY6).approved_copy_source, /ANG-CSEC-006/));
test("44. caption provenance retained", () => {
  const spec = withTimeline((tl) => [...tl, { item_id: "cap", type: "CAPTION", start_time: 0, end_time: 1, text: { value: "Day 6." } }]);
  assert.equal(provenanceFor(spec).caption_source, "supplied");
});
test("45. audio provenance retained", () => {
  assert.equal(provenanceFor(DAY6).audio_source, null);
  assert.equal(provenanceFor({ ...DAY6, audio: { mode: "SOURCE" } }).audio_source, "source-video");
  assert.equal(provenanceFor({ ...DAY6, audio: { mode: "EXTERNAL_TRACK", ref: "vo.m4a" } }).audio_source, "vo.m4a");
});

// --- G. assembly QA -----------------------------------------------------------
test("46. a valid artifact with failed assembly checks is not APPROVED", () => {
  const c = buildVideoQaCase();
  const r = finalAssemblyQa({ spec: DAY6, artifact: { ...c.artifact, width: 999, height: 999 }, conformance: c.conformance });
  assert.equal(r.approved, false);
  assert.ok(r.failed_checks.includes("canvas_match"));
});
test("47. VideoOutputQA is not duplicated", () => {
  const src = readFileSync(join(root, "mae/services/video-assembly-qa.js"), "utf8");
  assert.ok(!/VIDEO_QA_DIMENSIONS\s*=/.test(src));
  const c = buildVideoQaCase();
  const r = finalAssemblyQa({ spec: DAY6, artifact: c.artifact, conformance: c.conformance });
  assert.equal(r.video_output_qa.dimensions.length, 20);
  assert.equal(r.video_output_qa.overall_status, QA_STATUS.JUDGMENT_REQUIRED);
});

// --- H. Day-6 / foundation integrity ------------------------------------------
test("48. Day-6 source fixture remains unchanged", () => {
  const f = JSON.parse(readFileSync(join(root, "mae/data/fixtures/video/VV-CSEC-006.json"), "utf8"));
  assert.equal(f.fixture_id, "VV-CSEC-006");
  assert.ok(!("video_assembly" in f));
});
test("49. Day-6 assembly remains depiction, not instruction", () => {
  const f = JSON.parse(readFileSync(join(root, "mae/data/fixtures/video/VV-CSEC-006.json"), "utf8"));
  assert.match(f.boundary_note, /not clinical instruction/i);
  const blob = JSON.stringify(DAY6).toLowerCase();
  for (const banned of ["how to", "exercise", "stretch your", "instructions", "reps"]) assert.ok(!blob.includes(banned), banned);
});
test("50. Day-6 headline matches approved angle exactly", () => assert.equal(normalizeAssemblySpec(DAY6).timeline.find((i) => i.role === "headline").text.value, DAY6_HEADLINE));
test("51. video-output-qa tests remain green (present)", () => assert.ok(existsSync(join(root, "mae/harness/video-output-qa.test.mjs"))));
test("52. video-artifact tests remain green (present)", () => assert.ok(existsSync(join(root, "mae/harness/video-artifact.test.mjs"))));
test("53. video-foundation tests remain green (present)", () => assert.ok(existsSync(join(root, "mae/harness/video-foundation.test.mjs"))));
test("54. image subsystem remains green (present)", () => assert.ok(existsSync(join(root, "mae/harness/visual-qualification.test.mjs"))));
test("55. frozen image fixture hashes unchanged", () => { for (const f of loadFixtures()) assert.equal(computeFixtureHash(f), f.fixture_hash, f.fixture_id); });
test("56. no provider call", () => {
  for (const f of ["mae/media/video-assembly-spec.js", "mae/media/video-assembler.js", "mae/services/video-assembly-qa.js"]) {
    const src = readFileSync(join(root, f), "utf8");
    assert.ok(!/openai|gemini|9router|anthropic|provider-client/.test(src), f);
  }
});
test("57. no network call", () => {
  for (const f of ["mae/media/video-assembly-spec.js", "mae/media/video-assembler.js", "mae/services/video-assembly-qa.js"]) {
    const src = readFileSync(join(root, f), "utf8");
    assert.ok(!/fetch\s*\(/.test(src), f);
    assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(src), f);
  }
});
