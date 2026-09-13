// MAE Google Gemini image adapter — deterministic tests. Injected mock fetch only; NO network.
// Run: node mae/harness/gemini-image-adapter.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  makeGeminiImageAdapter, geminiImageTransport, mapGeminiAspectRatio, mapGeminiImageSize,
  GEMINI_SUPPORTED_ASPECT_RATIOS, canonicalImageRequest, invokeImageProvider,
  makeOpenAICompatibleImageAdapter, IMAGE_PROVIDER_STATUS, TINY_PNG_BASE64,
} from "../media/image-provider.js";
import { renderSvg } from "../media/layout.js";
import { RenderSpecs } from "../media/render-specs.js";
import { loadFixtures, computeFixtureHash } from "../services/visual-qualification.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MODEL = "gemini-3-pro-image";
const REQ = (over = {}) => ({ ...canonicalImageRequest({ promptPackage: { prompt: "render the scene", negative_prompt: "none" }, spec: { aspect_ratio: "4:5", canvas: { width: 1080, height: 1350 } } }), model: MODEL, ...over });
const adapter = (caps = {}) => makeGeminiImageAdapter({ capabilities: caps });

const okRes = (model = MODEL, data = TINY_PNG_BASE64, mime = "image/png") => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: mime, data } }] } }], modelVersion: model }) });
const noModelRes = () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: TINY_PNG_BASE64 } }] } }] }) });
const malformedRes = () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: "no image here" }] } }] }) });
const httpErr = (status, message) => ({ ok: false, status, json: async () => ({ error: { code: status, message } }) });

// 1
test("1. no Gemini key -> PROVIDER_UNAVAILABLE", async () => {
  const r = await invokeImageProvider({ adapter: adapter(), request: REQ(), model: MODEL, env: {} });
  assert.equal(r.status, IMAGE_PROVIDER_STATUS.PROVIDER_UNAVAILABLE);
});
// 2
test("2. zero network call when unconfigured", async () => {
  let called = 0;
  const fetchImpl = async () => { called++; return okRes(); };
  await invokeImageProvider({ adapter: adapter(), request: REQ(), model: MODEL, env: {}, fetchImpl });
  assert.equal(called, 0);
});
// 3
test("3. correct model path is used", async () => {
  let url = null; const fetchImpl = async (u) => { url = u; return okRes(); };
  await invokeImageProvider({ adapter: adapter(), request: REQ(), model: MODEL, env: { GEMINI_IMAGE_API_KEY: "k" }, fetchImpl });
  assert.ok(url.endsWith(`/v1beta/models/${MODEL}:generateContent`), url);
});
// 4
test("4. prompt is translated correctly", async () => {
  let body = null; const fetchImpl = async (u, init) => { body = JSON.parse(init.body); return okRes(); };
  await invokeImageProvider({ adapter: adapter(), request: REQ(), model: MODEL, env: { GEMINI_IMAGE_API_KEY: "k" }, fetchImpl });
  assert.equal(body.contents[0].parts[0].text, "render the scene");
});
// 5
test("5. aspect ratio is translated correctly", async () => {
  let body = null; const fetchImpl = async (u, init) => { body = JSON.parse(init.body); return okRes(); };
  await invokeImageProvider({ adapter: adapter(), request: REQ(), model: MODEL, env: { GEMINI_IMAGE_API_KEY: "k" }, fetchImpl });
  assert.equal(body.generationConfig.imageConfig.aspectRatio, "4:5");
});
// 6
test("6. image-size + aspect mapping is deterministic", () => {
  assert.equal(mapGeminiImageSize(1080, 1350), "2K");
  assert.equal(mapGeminiImageSize(1200, 630), "2K");
  assert.equal(mapGeminiImageSize(512, 512), "1K");
  assert.equal(mapGeminiImageSize(3000, 3000), "4K");
  assert.equal(mapGeminiAspectRatio("4:5"), "4:5");
  assert.equal(mapGeminiAspectRatio("1:1"), "1:1");
  const a = mapGeminiAspectRatio("1200:630"); const b = mapGeminiAspectRatio("1200:630");
  assert.equal(a, b);
  assert.ok(GEMINI_SUPPORTED_ASPECT_RATIOS.includes(a));
});
// 7
test("7. unsupported canonical capabilities are explicit", () => {
  const c = adapter().capabilities;
  assert.equal(c.image_generation, true);
  for (const k of ["negative_prompt", "seed", "reference_image", "image_edit", "style_reference"]) assert.equal(c[k], false, k);
});
// 8
test("8. successful inline base64 image is normalized", async () => {
  const r = await invokeImageProvider({ adapter: adapter(), request: REQ(), model: MODEL, env: { GEMINI_IMAGE_API_KEY: "k" }, fetchImpl: async () => okRes() });
  assert.equal(r.status, IMAGE_PROVIDER_STATUS.PROVIDER_SUCCESS);
  assert.ok(r.output_base64 && r.output_base64.length > 0);
});
// 9
test("9. mime type is retained", async () => {
  const r = await invokeImageProvider({ adapter: adapter(), request: REQ(), model: MODEL, env: { GEMINI_IMAGE_API_KEY: "k" }, fetchImpl: async () => okRes() });
  assert.equal(r.local.mime_type, "image/png");
});
// 10
test("10. local persistence works", async () => {
  const r = await invokeImageProvider({ adapter: adapter(), request: REQ(), model: MODEL, env: { GEMINI_IMAGE_API_KEY: "k" }, fetchImpl: async () => okRes() });
  assert.equal(r.local.ok, true);
  assert.ok(existsSync(r.local.local_path));
});
// 11
test("11. checksum is produced", async () => {
  const r = await invokeImageProvider({ adapter: adapter(), request: REQ(), model: MODEL, env: { GEMINI_IMAGE_API_KEY: "k" }, fetchImpl: async () => okRes() });
  assert.equal(r.local.checksum.length, 64);
});
// 12
test("12. Gemini output is consumable by the compositor", async () => {
  const r = await invokeImageProvider({ adapter: adapter(), request: REQ(), model: MODEL, env: { GEMINI_IMAGE_API_KEY: "k" }, fetchImpl: async () => okRes() });
  const out = renderSvg(RenderSpecs.layoutRender({ canvas: "instagram_feed", headline: "Day 6", image_slots: [{ slot_id: "bg", role: "BACKGROUND", source: { uri: r.local.local_path, mime: r.local.mime_type, width: 1080, height: 1350 }, fit: "cover" }] }), { filename: "gemini-consumable.svg" });
  assert.equal(out.has_background_image, true);
});
// 13
test("13. returned model is recorded when available", async () => {
  const r = await invokeImageProvider({ adapter: adapter(), request: REQ(), model: MODEL, env: { GEMINI_IMAGE_API_KEY: "k" }, fetchImpl: async () => okRes("gemini-3-pro-image-001") });
  assert.equal(r.returned_model, "gemini-3-pro-image-001");
});
// 14
test("14. missing returned model remains null (unverifiable)", async () => {
  const r = await invokeImageProvider({ adapter: adapter(), request: REQ(), model: MODEL, env: { GEMINI_IMAGE_API_KEY: "k" }, fetchImpl: async () => noModelRes() });
  assert.equal(r.returned_model, null);
  assert.equal(r.model_identity, "OK_UNVERIFIED");
});
// 15
test("15. malformed response -> PROVIDER_RESPONSE_INVALID", async () => {
  const r = await invokeImageProvider({ adapter: adapter(), request: REQ(), model: MODEL, env: { GEMINI_IMAGE_API_KEY: "k" }, fetchImpl: async () => malformedRes() });
  assert.equal(r.status, IMAGE_PROVIDER_STATUS.PROVIDER_RESPONSE_INVALID);
  assert.equal(r.local, null);
});
// 16
test("16. invalid image bytes are rejected", async () => {
  const r = await invokeImageProvider({ adapter: adapter(), request: REQ(), model: MODEL, env: { GEMINI_IMAGE_API_KEY: "k" }, fetchImpl: async () => okRes("m", "!!!not-an-image!!!") });
  assert.equal(r.status, IMAGE_PROVIDER_STATUS.IMAGE_ARTIFACT_INVALID);
  assert.equal(r.local, null);
});
// 17
test("17. HTTP error mapped honestly", async () => {
  const r = await invokeImageProvider({ adapter: adapter(), request: REQ(), model: MODEL, env: { GEMINI_IMAGE_API_KEY: "k" }, fetchImpl: async () => httpErr(500, "server error") });
  assert.equal(r.status, IMAGE_PROVIDER_STATUS.PROVIDER_ATTEMPT_FAILED);
  assert.equal(r.error_code, "HTTP_500");
});
// 18
test("18. timeout mapped honestly", async () => {
  const r = await invokeImageProvider({ adapter: adapter(), request: REQ(), model: MODEL, env: { GEMINI_IMAGE_API_KEY: "k" }, fetchImpl: async () => { throw Object.assign(new Error("t"), { name: "AbortError" }); } });
  assert.equal(r.status, IMAGE_PROVIDER_STATUS.PROVIDER_ATTEMPT_FAILED);
  assert.equal(r.error_code, "TIMEOUT");
});
// 19
test("19. retryable infrastructure error is marked retryable", async () => {
  const r = await invokeImageProvider({ adapter: adapter(), request: REQ(), model: MODEL, env: { GEMINI_IMAGE_API_KEY: "k" }, fetchImpl: async () => httpErr(429, "quota exceeded") });
  assert.equal(r.retryable, true);
});
// 20
test("20. safety rejection is NOT retryable", async () => {
  const r = await invokeImageProvider({ adapter: adapter(), request: REQ(), model: MODEL, env: { GEMINI_IMAGE_API_KEY: "k" }, fetchImpl: async () => httpErr(400, "Request was blocked due to safety policy") });
  assert.equal(r.error_code, "SAFETY_BLOCKED");
  assert.equal(r.retryable, false);
});
// 21
test("21. secret never appears in output/error/result", async () => {
  const secret = "gemini-secret-abcdef123456";
  const echo = { ok: false, status: 500, json: async () => ({ error: { message: `auth failed for ${secret}` } }) };
  const r = await invokeImageProvider({ adapter: adapter(), request: REQ(), model: MODEL, env: { GEMINI_IMAGE_API_KEY: secret }, fetchImpl: async () => echo });
  assert.ok(!JSON.stringify(r).includes(secret));
});
// 22
test("22. no provider-specific fields leak into the canonical request", async () => {
  let seen = null;
  const a = adapter(); const orig = a.generate; a.generate = (req, o) => { seen = req; return orig(req, o); };
  await invokeImageProvider({ adapter: a, request: REQ(), model: MODEL, env: { GEMINI_IMAGE_API_KEY: "k" }, fetchImpl: async () => okRes() });
  const keys = new Set(Object.keys(seen));
  for (const forbidden of ["contents", "generationConfig", "imageConfig", "inlineData", "candidates"]) assert.ok(!keys.has(forbidden), forbidden);
  for (const k of ["prompt", "negative_prompt", "aspect_ratio", "width", "height"]) assert.ok(keys.has(k), k);
});
// 23
test("23. VF fixture hashes are unchanged", () => {
  for (const f of loadFixtures()) assert.equal(computeFixtureHash(f), f.fixture_hash, f.fixture_id);
});
// 24
test("24. existing OpenAI adapter remains green", async () => {
  const oa = makeOpenAICompatibleImageAdapter({ name: "openai", baseUrl: "https://api.openai.com/v1", apiKeyEnv: "OPENAI_IMAGE_API_KEY" });
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ data: [{ b64_json: TINY_PNG_BASE64 }], model: "gpt-image-2.5-sunburst-2026-09-08" }) });
  const r = await invokeImageProvider({ adapter: oa, request: REQ(), model: "gpt-image-2.5-sunburst-2026-09-08", env: { OPENAI_IMAGE_API_KEY: "k" }, fetchImpl });
  assert.equal(r.status, IMAGE_PROVIDER_STATUS.PROVIDER_SUCCESS);
});
// 25
test("25. qualification runner remains present", () => {
  assert.ok(existsSync(join(root, "mae/services/visual-qualification-runner.js")));
});
// 26
test("26. live caller remains present", () => {
  assert.ok(existsSync(join(root, "mae/harness/run-live-qualification.mjs")));
});
