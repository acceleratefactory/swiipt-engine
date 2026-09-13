// MAE image provenance — MIME sniffing + requested-vs-actual dimension fidelity. No provider calls.
// Run: node mae/harness/image-provenance.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  detectImageMime, extensionForMime, withDetectedExtension, compareAspectRatio, ASPECT_RATIO_TOLERANCE,
  persistImageBytes, invokeImageProvider, canonicalImageRequest, makeOpenAICompatibleImageAdapter,
  makeResponseAdapter, makeGeminiImageAdapter, IMAGE_PROVIDER_STATUS, TINY_PNG_BASE64,
} from "../media/image-provider.js";
import { renderSvg } from "../media/layout.js";
import { RenderSpecs } from "../media/render-specs.js";
import { loadFixtures, computeFixtureHash } from "../services/visual-qualification.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const tmp = () => mkdtempSync(join(tmpdir(), "swt-prov-"));
const jpegBytes = () => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00]);
const webpBytes = () => Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBP"), Buffer.from([0, 0, 0, 0])]);
function pngBytes(w, h) { const b = Buffer.alloc(32); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0); b.writeUInt32BE(13, 8); b.write("IHDR", 12, "ascii"); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; }
const jpegB64 = () => jpegBytes().toString("base64");
const REQ = (ar, w, h) => ({ ...canonicalImageRequest({ promptPackage: { prompt: "p" }, spec: { aspect_ratio: ar, canvas: { width: w, height: h } } }), model: "m" });

// 1
test("1. JPEG bytes + no MIME -> image/jpeg", () => {
  const r = persistImageBytes(jpegBytes(), { dir: tmp(), name: "x.png" });
  assert.equal(r.ok, true); assert.equal(r.mime_type, "image/jpeg");
});
// 2
test("2. JPEG bytes + provider image/png -> image/jpeg (bytes win)", () => {
  const r = persistImageBytes(jpegBytes(), { mime: "image/png", dir: tmp(), name: "x.png" });
  assert.equal(r.mime_type, "image/jpeg");
  assert.equal(r.provider_declared_mime_type, "image/png");
  assert.equal(r.detected_mime_type, "image/jpeg");
});
// 3
test("3. PNG bytes + no MIME -> image/png", () => {
  assert.equal(persistImageBytes(Buffer.from(TINY_PNG_BASE64, "base64"), { dir: tmp(), name: "x" }).mime_type, "image/png");
});
// 4
test("4. WEBP bytes + no MIME -> image/webp", () => {
  assert.equal(persistImageBytes(webpBytes(), { dir: tmp(), name: "x" }).mime_type, "image/webp");
});
// 5
test("5. detected MIME retained in canonical result", async () => {
  const a = makeResponseAdapter({ name: "x", generate: async () => ({ output_base64: jpegB64() }) });
  const r = await invokeImageProvider({ adapter: a, request: REQ("1080:1350", 1080, 1350), model: "m", env: {}, dir: tmp() });
  assert.equal(r.mime_type, "image/jpeg");
  assert.equal(r.detected_mime_type, "image/jpeg");
});
// 6
test("6. provider-declared MIME retained separately", async () => {
  const a = makeResponseAdapter({ name: "x", generate: async () => ({ output_base64: jpegB64(), mime_type: "image/png" }) });
  const r = await invokeImageProvider({ adapter: a, request: REQ("1080:1350", 1080, 1350), model: "m", env: {}, dir: tmp() });
  assert.equal(r.provider_declared_mime_type, "image/png");
  assert.equal(r.mime_type, "image/jpeg");
});
// 7
test("7. MIME mismatch is recorded", async () => {
  const a = makeResponseAdapter({ name: "x", generate: async () => ({ output_base64: jpegB64(), mime_type: "image/png" }) });
  const r = await invokeImageProvider({ adapter: a, request: REQ("1080:1350", 1080, 1350), model: "m", env: {}, dir: tmp() });
  assert.equal(r.mime_type_match, false);
});
// 8
test("8. new persisted JPEG artifact gets .jpg extension", () => {
  const r = persistImageBytes(jpegBytes(), { dir: tmp(), name: "VF-2.png" });
  assert.ok(r.local_path.endsWith(".jpg"), r.local_path);
});
// 9
test("9. PNG artifact keeps .png", () => {
  const r = persistImageBytes(Buffer.from(TINY_PNG_BASE64, "base64"), { dir: tmp(), name: "VF-2.png" });
  assert.ok(r.local_path.endsWith(".png"), r.local_path);
});
// 10
test("10. checksum unchanged by MIME detection", () => {
  const b = jpegBytes();
  const r = persistImageBytes(b, { dir: tmp(), name: "x.png" });
  assert.equal(r.checksum, createHash("sha256").update(b).digest("hex"));
});
// 11
test("11. width/height still extracted correctly", () => {
  const r = persistImageBytes(pngBytes(640, 480), { dir: tmp(), name: "x.png" });
  assert.equal(r.width, 640); assert.equal(r.height, 480);
});
// 12
test("12. requested dimensions retained", async () => {
  const a = makeResponseAdapter({ name: "x", generate: async () => ({ output_base64: pngBytes(1024, 1024).toString("base64") }) });
  const r = await invokeImageProvider({ adapter: a, request: REQ("1080:1350", 1080, 1350), model: "m", env: {}, dir: tmp() });
  assert.equal(r.requested_width, 1080); assert.equal(r.requested_height, 1350); assert.equal(r.requested_aspect_ratio, "1080:1350");
});
// 13
test("13. actual dimensions retained", async () => {
  const a = makeResponseAdapter({ name: "x", generate: async () => ({ output_base64: pngBytes(1024, 1024).toString("base64") }) });
  const r = await invokeImageProvider({ adapter: a, request: REQ("1080:1350", 1080, 1350), model: "m", env: {}, dir: tmp() });
  assert.equal(r.actual_width, 1024); assert.equal(r.actual_height, 1024); assert.equal(r.actual_aspect_ratio, "1024:1024");
});
// 14
test("14. exact dimension match = true", async () => {
  const a = makeResponseAdapter({ name: "x", generate: async () => ({ output_base64: pngBytes(64, 64).toString("base64") }) });
  const r = await invokeImageProvider({ adapter: a, request: REQ("1:1", 64, 64), model: "m", env: {}, dir: tmp() });
  assert.equal(r.dimension_match, true); assert.equal(r.aspect_ratio_match, true);
});
// 15
test("15. exact dimension mismatch = false", async () => {
  const a = makeResponseAdapter({ name: "x", generate: async () => ({ output_base64: pngBytes(1024, 1024).toString("base64") }) });
  const r = await invokeImageProvider({ adapter: a, request: REQ("1080:1350", 1080, 1350), model: "m", env: {}, dir: tmp() });
  assert.equal(r.dimension_match, false);
});
// 16
test("16. equivalent aspect ratio at different resolution = match true", () => {
  assert.equal(compareAspectRatio("4:5", "800:1000").match, true);
});
// 17
test("17. materially different aspect ratio = false", () => {
  assert.equal(compareAspectRatio("4:5", "1:1").match, false);
});
// 18
test("18. VF-2 1080x1350 vs 1024x1024 = aspect mismatch", () => {
  const c = compareAspectRatio("1080:1350", "1024:1024");
  assert.equal(c.match, false);
  assert.ok(Math.abs(c.delta - 0.2) < 1e-6, String(c.delta));
  assert.equal(c.tolerance, ASPECT_RATIO_TOLERANCE);
});
// 19
test("19. valid mismatched artifact is NOT IMAGE_ARTIFACT_INVALID", async () => {
  const a = makeResponseAdapter({ name: "x", generate: async () => ({ output_base64: pngBytes(1024, 1024).toString("base64") }) });
  const r = await invokeImageProvider({ adapter: a, request: REQ("1080:1350", 1080, 1350), model: "m", env: {}, dir: tmp() });
  assert.equal(r.status, IMAGE_PROVIDER_STATUS.PROVIDER_SUCCESS);
  assert.equal(r.local.ok, true);
});
// 20
test("20. compositor still accepts a mismatched-but-valid source", async () => {
  const a = makeResponseAdapter({ name: "x", generate: async () => ({ output_base64: pngBytes(1024, 1024).toString("base64") }) });
  const r = await invokeImageProvider({ adapter: a, request: REQ("1080:1350", 1080, 1350), model: "m", env: {}, dir: tmp() });
  const out = renderSvg(RenderSpecs.layoutRender({ canvas: "instagram_feed", headline: "Day 6", image_slots: [{ slot_id: "bg", role: "BACKGROUND", source: { uri: r.local.local_path, mime: r.local.mime_type, width: r.actual_width, height: r.actual_height }, fit: "cover" }] }), { filename: "prov-consumable.svg" });
  assert.equal(out.has_background_image, true);
});
// 21
test("21. existing OpenAI-compatible provider remains green", async () => {
  const oa = makeOpenAICompatibleImageAdapter({ name: "openai", baseUrl: "https://api.openai.com/v1", apiKeyEnv: "OPENAI_IMAGE_API_KEY" });
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ data: [{ b64_json: TINY_PNG_BASE64 }], model: "m" }) });
  const r = await invokeImageProvider({ adapter: oa, request: REQ("1:1", 64, 64), model: "m", env: { OPENAI_IMAGE_API_KEY: "k" }, fetchImpl, dir: tmp() });
  assert.equal(r.status, IMAGE_PROVIDER_STATUS.PROVIDER_SUCCESS);
});
// 22
test("22. Gemini adapter remains green", async () => {
  const ga = makeGeminiImageAdapter();
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: TINY_PNG_BASE64 } }] } }], modelVersion: "gemini-3-pro-image" }) });
  const r = await invokeImageProvider({ adapter: ga, request: REQ("4:5", 1080, 1350), model: "gemini-3-pro-image", env: { GEMINI_IMAGE_API_KEY: "k" }, fetchImpl, dir: tmp() });
  assert.equal(r.status, IMAGE_PROVIDER_STATUS.PROVIDER_SUCCESS);
});
// 23
test("23. qualification runner remains present", () => { assert.ok(existsSync(join(root, "mae/services/visual-qualification-runner.js"))); });
// 24
test("24. live caller remains present", () => { assert.ok(existsSync(join(root, "mae/harness/run-live-qualification.mjs"))); });
// 25
test("25. all frozen fixture hashes unchanged", () => {
  for (const f of loadFixtures()) assert.equal(computeFixtureHash(f), f.fixture_hash, f.fixture_id);
});
