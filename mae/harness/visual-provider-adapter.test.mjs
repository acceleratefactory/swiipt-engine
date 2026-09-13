// MAE image provider adapter + deterministic MOCK provider — tests. No network, no real provider.
// Run: node mae/harness/visual-provider-adapter.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  canonicalImageRequest, normalizeImageResponse, invokeImageProvider, makeOpenAICompatibleImageAdapter,
  IMAGE_PROVIDER_STATUS, TINY_PNG_BASE64, isLikelyImage,
} from "../media/image-provider.js";
import { makeMockImageAdapter, mockFetchPng, mockFetchHtml } from "../media/image-provider-mock.js";
import { renderSvg } from "../media/layout.js";
import { RenderSpecs } from "../media/render-specs.js";

const REQ = () => canonicalImageRequest({ promptPackage: { prompt: "render the scene", negative_prompt: "no clichés" }, spec: { aspect_ratio: "4:5", canvas: { width: 1080, height: 1350 } } });

// 1
test("1. unkeyed provider = PROVIDER_UNAVAILABLE (no call)", async () => {
  const adapter = makeOpenAICompatibleImageAdapter({ name: "openai-img", baseUrlEnv: "IMG_BASE_URL", apiKeyEnv: "IMG_API_KEY" });
  const r = await invokeImageProvider({ adapter, request: REQ(), model: "gpt-image-1", env: {} });
  assert.equal(r.status, IMAGE_PROVIDER_STATUS.PROVIDER_UNAVAILABLE);
  assert.equal(r.local, null);
});
// 2
test("2. provider request maps the prompt correctly", () => {
  assert.equal(REQ().prompt, "render the scene");
});
// 3
test("3. negative prompt mapped correctly when supported", () => {
  assert.equal(REQ().negative_prompt, "no clichés");
});
// 4
test("4. aspect ratio mapped correctly", () => {
  assert.equal(REQ().aspect_ratio, "4:5");
});
// 5
test("5. dimensions mapped correctly from the spec canvas", () => {
  const r = REQ();
  assert.equal(r.width, 1080); assert.equal(r.height, 1350);
});
// 6
test("6. unsupported optional capability is explicit", () => {
  const caps = makeOpenAICompatibleImageAdapter({ name: "x", baseUrl: "https://x", apiKeyEnv: "K" }).capabilities;
  for (const k of ["image_generation", "reference_image", "image_edit", "seed", "style_reference"]) assert.equal(typeof caps[k], "boolean", k);
  assert.equal(caps.image_generation, true);
  assert.equal(caps.image_edit, false);
});
// 7
test("7. provider response normalizes correctly", () => {
  const n = normalizeImageResponse({ b64_json: "AAA", model: "m-1", seed: 7, usage: { a: 1 } }, { provider: "p", requestedModel: "m-1" });
  assert.equal(n.output_base64, "AAA");
  assert.equal(n.output_type, "base64");
  assert.equal(n.returned_model, "m-1");
  assert.equal(n.seed, 7);
});
// 8
test("8. returned model identity is recorded", async () => {
  const adapter = makeMockImageAdapter({ behavior: "success_base64", model: "m-1" });
  const r = await invokeImageProvider({ adapter, request: REQ(), model: "m-1", env: {} });
  assert.equal(r.returned_model, "m-1");
  assert.equal(r.model_identity, "OK");
});
// 9
test("9. model mismatch is detected (no silent substitution)", async () => {
  const adapter = makeMockImageAdapter({ behavior: "mismatch" });
  const r = await invokeImageProvider({ adapter, request: REQ(), model: "m-1", env: {} });
  assert.equal(r.status, IMAGE_PROVIDER_STATUS.MODEL_ID_MISMATCH);
  assert.equal(r.model_identity, "MODEL_ID_MISMATCH");
});
// 10
test("10. missing returned model remains null (unverifiable)", async () => {
  const adapter = makeMockImageAdapter({ behavior: "missing_model" });
  const r = await invokeImageProvider({ adapter, request: REQ(), model: "m-1", env: {} });
  assert.equal(r.returned_model, null);
  assert.equal(r.model_identity, "OK_UNVERIFIED");
  assert.equal(r.status, IMAGE_PROVIDER_STATUS.PROVIDER_SUCCESS);
});
// 11
test("11. URL image is persisted locally", async () => {
  const adapter = makeMockImageAdapter({ behavior: "success_url", model: "m" });
  const r = await invokeImageProvider({ adapter, request: REQ(), model: "m", env: {}, fetchImpl: mockFetchPng() });
  assert.equal(r.status, IMAGE_PROVIDER_STATUS.PROVIDER_SUCCESS);
  assert.equal(r.local.ok, true);
  assert.ok(existsSync(r.local.local_path));
});
// 12
test("12. base64 image is persisted locally", async () => {
  const adapter = makeMockImageAdapter({ behavior: "success_base64" });
  const r = await invokeImageProvider({ adapter, request: REQ(), model: "m", env: {} });
  assert.equal(r.local.ok, true);
  assert.ok(existsSync(r.local.local_path));
});
// 13a
test("13. invalid base64 image fails honestly", async () => {
  const adapter = makeMockImageAdapter({ behavior: "invalid_base64" });
  const r = await invokeImageProvider({ adapter, request: REQ(), model: "m", env: {} });
  assert.equal(r.status, IMAGE_PROVIDER_STATUS.IMAGE_ARTIFACT_INVALID);
  assert.equal(r.local, null);
});
// 13b
test("13b. HTML payload returned as an image is rejected", async () => {
  const adapter = makeMockImageAdapter({ behavior: "success_url" });
  const r = await invokeImageProvider({ adapter, request: REQ(), model: "m", env: {}, fetchImpl: mockFetchHtml() });
  assert.equal(r.status, IMAGE_PROVIDER_STATUS.IMAGE_ARTIFACT_INVALID);
  assert.equal(r.local, null);
  assert.equal(isLikelyImage(Buffer.from("<!doctype html>"), "text/html"), false);
});
// 14
test("14. provider error fails honestly", async () => {
  const adapter = makeMockImageAdapter({ behavior: "http_error" });
  const r = await invokeImageProvider({ adapter, request: REQ(), model: "m", env: {} });
  assert.equal(r.status, IMAGE_PROVIDER_STATUS.PROVIDER_ATTEMPT_FAILED);
  assert.equal(r.error_code, "HTTP_500");
});
// 15
test("15. provider timeout fails honestly", async () => {
  const adapter = makeMockImageAdapter({ behavior: "timeout" });
  const r = await invokeImageProvider({ adapter, request: REQ(), model: "m", env: {} });
  assert.equal(r.status, IMAGE_PROVIDER_STATUS.PROVIDER_ATTEMPT_FAILED);
  assert.equal(r.error_code, "TIMEOUT");
  assert.equal(r.retryable, true);
});
// 16
test("16. no fake artifact on failure", async () => {
  for (const behavior of ["http_error", "timeout", "invalid_base64", "invalid_url_payload", "no_image"]) {
    const adapter = makeMockImageAdapter({ behavior });
    const r = await invokeImageProvider({ adapter, request: REQ(), model: "m", env: {}, fetchImpl: behavior === "invalid_url_payload" ? mockFetchHtml() : null });
    assert.notEqual(r.status, IMAGE_PROVIDER_STATUS.PROVIDER_SUCCESS, behavior);
    assert.equal(r.local, null, behavior);
  }
});
// 17
test("17. checksum generated for persisted image", async () => {
  const adapter = makeMockImageAdapter({ behavior: "success_base64" });
  const r = await invokeImageProvider({ adapter, request: REQ(), model: "m", env: {} });
  assert.equal(r.local.checksum.length, 64);
});
// 18
test("18. local artifact is consumable by the compositor", async () => {
  const adapter = makeMockImageAdapter({ behavior: "success_base64" });
  const r = await invokeImageProvider({ adapter, request: REQ(), model: "m", env: {} });
  const out = renderSvg(RenderSpecs.layoutRender({
    canvas: "instagram_feed", headline: "Day 6",
    image_slots: [{ slot_id: "bg", role: "BACKGROUND", source: { uri: r.local.local_path, mime: r.local.mime_type, width: 1080, height: 1350 }, fit: "cover" }],
  }), { filename: "provider-consumable.svg" });
  assert.equal(out.has_background_image, true);
  assert.ok(out.svg.includes("data:image/png;base64,"));
});
// 30 (adapter-side) credentials never appear in results/logs
test("30. credentials never appear in results", async () => {
  const secret = "sk-supersecret-abcdef1234567890";
  const adapter = makeMockImageAdapter({ behavior: "success_base64" });
  const r = await invokeImageProvider({ adapter, request: REQ(), model: "m", env: { MOCK_IMAGE_API_KEY: secret } });
  assert.ok(!JSON.stringify(r).includes(secret));
  assert.equal(TINY_PNG_BASE64.length > 0, true);
});
