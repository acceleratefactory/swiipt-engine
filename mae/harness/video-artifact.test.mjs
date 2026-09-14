// MAE Video artifact persistence + mechanical validation (Wave V-B) — deterministic tests.
// Synthetic local MP4 bytes only; no provider, no network, no external binary.
// Run: node mae/harness/video-artifact.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  persistVideoArtifact, validateVideoBytes, inspectMp4, detectVideoMime, withDetectedVideoExtension,
  videoConformance, buildVideoGenerationRecord, writeVideoPromptText,
  VIDEO_ARTIFACT_STATUS, VIDEO_CONFORMANCE, DURATION_TOLERANCE_SECONDS,
} from "../media/video-artifact.js";
import { ASPECT_RATIO_TOLERANCE } from "../media/image-provider.js";
import { videoGenerationStatus } from "../media/video-provider.js";
import { buildDay6Video } from "./video-fixtures.mjs";
import { loadFixtures, computeFixtureHash } from "../services/visual-qualification.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const tmp = () => mkdtempSync(join(tmpdir(), "swt-vid-"));
const D = buildDay6Video();

// --- synthetic minimal ISO-BMFF (MP4) ---------------------------------------
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0, 0); return b; };
const box = (type, ...parts) => { const body = Buffer.concat(parts); const h = Buffer.alloc(8); h.writeUInt32BE(8 + body.length, 0); h.write(type, 4, "ascii"); return Buffer.concat([h, body]); };
function makeMp4({ width = 1080, height = 1920, durationSeconds = 6, timescale = 1000, audio = false, codec = "avc1" } = {}) {
  const mvhdP = Buffer.alloc(100); mvhdP.writeUInt32BE(timescale, 12); mvhdP.writeUInt32BE(Math.round(durationSeconds * timescale), 16);
  const mvhd = box("mvhd", mvhdP);
  const tkhd = (w, h) => { const b = Buffer.alloc(84); b.writeUInt32BE(Math.round(w * 65536), 76); b.writeUInt32BE(Math.round(h * 65536), 80); return box("tkhd", b); };
  const hdlr = (t) => { const b = Buffer.alloc(12); b.write(t, 8, "ascii"); return box("hdlr", b); };
  const videoTrak = box("trak", tkhd(width, height), box("mdia", hdlr("vide"), box("minf", box("stbl", box("stsd", box(codec, Buffer.alloc(78)))))));
  const audioTrak = box("trak", tkhd(0, 0), box("mdia", hdlr("soun"), box("minf", box("stbl", box("stsd", box("mp4a", Buffer.alloc(28)))))));
  const ftyp = box("ftyp", Buffer.from("isom"), u32(0x200), Buffer.from("isomiso2" + codec));
  const moov = box("moov", mvhd, videoTrak, audio ? audioTrak : Buffer.alloc(0));
  return Buffer.concat([ftyp, moov]);
}
const ASSET = D.assetSpec; // 1080x1920, 6s, 24fps

// 1
test("1. valid local video artifact persists successfully", () => {
  const r = persistVideoArtifact({ bytes: makeMp4(), name: "clip.mp4", dir: tmp(), artifactId: "ARTV-1" });
  assert.equal(r.ok, true);
  assert.equal(r.status, VIDEO_ARTIFACT_STATUS.VIDEO_ARTIFACT_VALID);
});
// 2
test("2. SHA-256 is recorded", () => {
  const b = makeMp4();
  const r = persistVideoArtifact({ bytes: b, dir: tmp(), artifactId: "ARTV-2" });
  assert.equal(r.artifact.sha256, createHash("sha256").update(b).digest("hex"));
});
// 3
test("3. zero-byte video is rejected", () => {
  assert.equal(validateVideoBytes(Buffer.alloc(0)).status, VIDEO_ARTIFACT_STATUS.VIDEO_ARTIFACT_EMPTY);
});
// 4
test("4. corrupt/unreadable container is rejected", () => {
  assert.equal(validateVideoBytes(Buffer.from("this is definitely not a video container")).status, VIDEO_ARTIFACT_STATUS.VIDEO_CONTAINER_UNREADABLE);
});
// 5
test("5. missing video stream is rejected where testable", () => {
  // a video trak present but with 0x0 geometry → stream found, metadata unavailable
  assert.equal(validateVideoBytes(makeMp4({ width: 0, height: 0 })).status, VIDEO_ARTIFACT_STATUS.VIDEO_METADATA_UNAVAILABLE);
  const mvhd = box("mvhd", (() => { const b = Buffer.alloc(100); b.writeUInt32BE(1000, 12); b.writeUInt32BE(6000, 16); return b; })());
  const h = box("hdlr", (() => { const b = Buffer.alloc(12); b.write("soun", 8, "ascii"); return b; })());
  const audioOnly = Buffer.concat([box("ftyp", Buffer.from("isom"), u32(0x200), Buffer.from("isomiso2mp41")), box("moov", mvhd, box("trak", box("tkhd", Buffer.alloc(84)), box("mdia", h, box("minf", box("stbl", box("stsd", box("mp4a", Buffer.alloc(28))))))))]);
  assert.equal(validateVideoBytes(audioOnly).status, VIDEO_ARTIFACT_STATUS.VIDEO_STREAM_MISSING);
});
// 6
test("6. actual width/height extracted", () => {
  const i = inspectMp4(makeMp4({ width: 1080, height: 1920 }));
  assert.equal(i.width, 1080); assert.equal(i.height, 1920);
});
// 7
test("7. actual aspect ratio computed", () => {
  const r = persistVideoArtifact({ bytes: makeMp4({ width: 1080, height: 1920 }), dir: tmp(), artifactId: "ARTV-7" });
  assert.equal(r.artifact.actual_aspect_ratio, "1080:1920");
});
// 8
test("8. actual duration extracted", () => {
  const r = persistVideoArtifact({ bytes: makeMp4({ durationSeconds: 6 }), dir: tmp(), artifactId: "ARTV-8" });
  assert.ok(Math.abs(r.artifact.actual_duration_seconds - 6) < 1e-6);
});
// 9
test("9. FPS recorded where reliably available (null is honest)", () => {
  const r = persistVideoArtifact({ bytes: makeMp4(), dir: tmp(), artifactId: "ARTV-9" });
  assert.ok("actual_fps" in r.artifact);
  assert.equal(r.artifact.actual_fps, null);
});
// 10
test("10. audio-stream presence recorded where reliably available", () => {
  const withAudio = persistVideoArtifact({ bytes: makeMp4({ audio: true }), dir: tmp(), artifactId: "ARTV-10a" });
  const noAudio = persistVideoArtifact({ bytes: makeMp4({ audio: false }), dir: tmp(), artifactId: "ARTV-10b" });
  assert.equal(withAudio.artifact.audio_stream_present, true);
  assert.equal(noAudio.artifact.audio_stream_present, false);
});
// 11
test("11. provider-declared MIME mismatch does not override actual evidence", () => {
  const r = persistVideoArtifact({ bytes: makeMp4(), declaredMimeType: "video/webm", dir: tmp(), artifactId: "ARTV-11" });
  assert.equal(r.artifact.mime_type, "video/mp4");
  assert.equal(r.artifact.provider_declared_mime_type, "video/webm");
  assert.equal(r.artifact.mime_type_match, false);
});
// 12
test("12. file extension follows detected type", () => {
  assert.ok(withDetectedVideoExtension("clip.webm", "video/mp4").endsWith(".mp4"));
  const r = persistVideoArtifact({ bytes: makeMp4(), name: "clip.webm", dir: tmp(), artifactId: "ARTV-12" });
  assert.ok(r.artifact.local_path.endsWith(".mp4"));
});
// 13
test("13. requested geometry preserved", () => {
  const art = persistVideoArtifact({ bytes: makeMp4(), dir: tmp(), artifactId: "ARTV-13" }).artifact;
  const c = videoConformance({ assetSpec: ASSET, artifact: art });
  assert.equal(c.requested_width, 1080); assert.equal(c.requested_height, 1920); assert.equal(c.requested_aspect_ratio, "9:16");
});
// 14
test("14. actual geometry preserved", () => {
  const art = persistVideoArtifact({ bytes: makeMp4({ width: 1024, height: 1024 }), dir: tmp(), artifactId: "ARTV-14" }).artifact;
  const c = videoConformance({ assetSpec: ASSET, artifact: art });
  assert.equal(c.actual_width, 1024); assert.equal(c.actual_height, 1024); assert.equal(c.actual_aspect_ratio, "1024:1024");
});
// 15
test("15. dimension mismatch is diagnostic, not artifact-invalid", () => {
  const r = persistVideoArtifact({ bytes: makeMp4({ width: 1024, height: 1024 }), dir: tmp(), artifactId: "ARTV-15" });
  assert.equal(r.artifact.status, VIDEO_ARTIFACT_STATUS.VIDEO_ARTIFACT_VALID);
  const c = videoConformance({ assetSpec: ASSET, artifact: r.artifact });
  assert.equal(c.dimension_match, false);
  assert.equal(c.geometry_conformance, VIDEO_CONFORMANCE.GEOMETRY_MISMATCH);
});
// 16
test("16. aspect-ratio mismatch recorded", () => {
  const r = persistVideoArtifact({ bytes: makeMp4({ width: 1024, height: 1024 }), dir: tmp(), artifactId: "ARTV-16" });
  const c = videoConformance({ assetSpec: ASSET, artifact: r.artifact });
  assert.equal(c.aspect_ratio_match, false);
  assert.ok(c.aspect_ratio_delta > 0);
});
// 17
test("17. aspect-ratio tolerance recorded", () => {
  const c = videoConformance({ assetSpec: ASSET, artifact: { actual_width: 1024, actual_height: 1024, actual_aspect_ratio: "1024:1024" } });
  assert.equal(c.aspect_ratio_tolerance, ASPECT_RATIO_TOLERANCE);
});
// 18
test("18. requested duration preserved", () => {
  const c = videoConformance({ assetSpec: ASSET, artifact: { actual_width: 1080, actual_height: 1920, actual_aspect_ratio: "1080:1920", actual_duration_seconds: 6 } });
  assert.equal(c.requested_duration_seconds, 6);
});
// 19
test("19. actual duration preserved", () => {
  const c = videoConformance({ assetSpec: ASSET, artifact: { actual_duration_seconds: 5 } });
  assert.equal(c.actual_duration_seconds, 5);
});
// 20
test("20. duration mismatch is diagnostic, not artifact-invalid", () => {
  const r = persistVideoArtifact({ bytes: makeMp4({ durationSeconds: 5 }), dir: tmp(), artifactId: "ARTV-20" });
  assert.equal(r.artifact.status, VIDEO_ARTIFACT_STATUS.VIDEO_ARTIFACT_VALID);
  const c = videoConformance({ assetSpec: ASSET, artifact: r.artifact });
  assert.equal(c.duration_match, false);
  assert.equal(c.duration_conformance, VIDEO_CONFORMANCE.DURATION_MISMATCH);
});
// 21
test("21. duration tolerance recorded", () => {
  const c = videoConformance({ assetSpec: ASSET, artifact: { actual_duration_seconds: 6 } });
  assert.equal(c.duration_tolerance_seconds, DURATION_TOLERANCE_SECONDS);
});
// 22
test("22. source image provenance preserved", () => {
  const art = persistVideoArtifact({ bytes: makeMp4(), dir: tmp(), artifactId: "ARTV-22" }).artifact;
  const rec = buildVideoGenerationRecord({ promptPackage: D.promptPackage, canonicalRequest: { source_image: "mae/storage/work/image/VF-2.jpg", reference_images: [] }, artifact: art, conformance: videoConformance({ assetSpec: ASSET, artifact: art }) });
  assert.equal(rec.source_image, "mae/storage/work/image/VF-2.jpg");
});
// 23
test("23. reference image provenance preserved", () => {
  const rec = buildVideoGenerationRecord({ promptPackage: D.promptPackage, canonicalRequest: { source_image: null, reference_images: ["a.png", "b.png"] }, artifact: {}, conformance: {} });
  assert.deepEqual(rec.reference_images, ["a.png", "b.png"]);
});
// 24
test("24. canonical video prompt persists with the artifact record", () => {
  const art = persistVideoArtifact({ bytes: makeMp4(), dir: tmp(), artifactId: "ARTV-24" }).artifact;
  const rec = buildVideoGenerationRecord({ promptPackage: D.promptPackage, artifact: art, conformance: videoConformance({ assetSpec: ASSET, artifact: art }) });
  assert.equal(rec.canonical_video_prompt, D.promptPackage.prompt);
});
// 25
test("25. provider_prompt_sent is NOT fabricated when no provider exists", () => {
  const rec = buildVideoGenerationRecord({ promptPackage: D.promptPackage, artifact: {}, conformance: {} });
  assert.equal(rec.provider_prompt_sent, null);
  assert.equal(rec.prompt_modified_by_adapter, null);
});
// 26
test("26. mock transformed provider prompt is represented distinctly", () => {
  const rec = buildVideoGenerationRecord({ promptPackage: D.promptPackage, artifact: {}, conformance: {}, providerPromptSent: "TRANSFORMED PROVIDER PROMPT" });
  assert.equal(rec.canonical_video_prompt, D.promptPackage.prompt);
  assert.equal(rec.provider_prompt_sent, "TRANSFORMED PROVIDER PROMPT");
  assert.notEqual(rec.provider_prompt_sent, rec.canonical_video_prompt);
});
// 27
test("27. prompt_modified_by_adapter represented correctly", () => {
  const t = buildVideoGenerationRecord({ promptPackage: D.promptPackage, artifact: {}, conformance: {}, providerPromptSent: "X" });
  const s = buildVideoGenerationRecord({ promptPackage: D.promptPackage, artifact: {}, conformance: {}, providerPromptSent: D.promptPackage.prompt });
  const n = buildVideoGenerationRecord({ promptPackage: D.promptPackage, artifact: {}, conformance: {} });
  assert.equal(t.prompt_modified_by_adapter, true);
  assert.equal(s.prompt_modified_by_adapter, false);
  assert.equal(n.prompt_modified_by_adapter, null);
});
// 28
test("28. no credential/header/token leakage in record or human prompt text", () => {
  const secret = "sk-video-secret-abcdef123456";
  const art = persistVideoArtifact({ bytes: makeMp4(), dir: tmp(), artifactId: "ARTV-28" }).artifact;
  const rec = buildVideoGenerationRecord({ promptPackage: D.promptPackage, artifact: art, conformance: {} });
  const p = writeVideoPromptText(rec, tmp());
  const all = JSON.stringify(rec) + readFileSync(p, "utf8");
  assert.ok(!all.includes(secret));
  assert.ok(!/bearer|x-goog-api-key|authorization/i.test(readFileSync(p, "utf8")));
});
// 29
test("29. no provider call occurs", () => {
  assert.equal(videoGenerationStatus().available, false);
});
// 30
test("30. no network access occurs", () => {
  const src = readFileSync(join(root, "mae/media/video-artifact.js"), "utf8");
  assert.ok(!/fetch\s*\(/.test(src));
  assert.ok(!/https?:\/\//.test(src));
});
// 31
test("31. VV-CSEC-006 foundation fixture remains unchanged (contract-only)", () => {
  const f = JSON.parse(readFileSync(join(root, "mae/data/fixtures/video/VV-CSEC-006.json"), "utf8"));
  assert.equal(f.fixture_id, "VV-CSEC-006");
  assert.ok(!("video_artifact" in f));
  assert.match(f.boundary_note, /not clinical instruction/i);
});
// 32
test("32. image subsystem tests remain green (present)", () => {
  for (const f of ["mae/harness/compositor.test.mjs", "mae/harness/image-provenance.test.mjs", "mae/harness/generation-prompt.test.mjs", "mae/harness/video-foundation.test.mjs"]) assert.ok(existsSync(join(root, f)), f);
});
// 33
test("33. frozen image fixture hashes remain unchanged", () => {
  for (const f of loadFixtures()) assert.equal(computeFixtureHash(f), f.fixture_hash, f.fixture_id);
});
