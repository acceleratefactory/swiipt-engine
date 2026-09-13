// MAE media · DETERMINISTIC MOCK IMAGE PROVIDER — TEST INFRASTRUCTURE ONLY.
// Never calls the network. Simulates success / mismatch / timeout / error / invalid payload /
// missing cost / missing model identity. NOT a production provider.
import { TINY_PNG_BASE64 } from "./image-provider.js";

export const MOCK_PNG_BYTES = Buffer.from(TINY_PNG_BASE64, "base64");

export function makeMockImageAdapter({ name = "mock-image", behavior = "success_base64", model = null, modelOverride = null, cost = null, usage = null, seed = null, width = 64, height = 64 } = {}) {
  return {
    name,
    capabilities: { image_generation: true, reference_image: false, image_edit: false, seed: !!seed, style_reference: false },
    configured() { return true; },
    async generate() {
      switch (behavior) {
        case "success_base64":
          return { output_base64: TINY_PNG_BASE64, mime_type: "image/png", model: modelOverride ?? model, cost, usage, seed, width, height };
        case "success_url":
          return { output_url: "https://mock.test/image.png", mime_type: "image/png", model: modelOverride ?? model, cost };
        case "mismatch":
          return { output_base64: TINY_PNG_BASE64, mime_type: "image/png", model: "some-other-model" };
        case "missing_model":
          return { output_base64: TINY_PNG_BASE64, mime_type: "image/png" };
        case "missing_cost":
          return { output_base64: TINY_PNG_BASE64, mime_type: "image/png", model: modelOverride ?? model, cost: null };
        case "timeout":
          throw Object.assign(new Error("mock timeout"), { name: "AbortError" });
        case "http_error":
          return { error_code: "HTTP_500", error_message: "mock server error" };
        case "invalid_base64":
          return { output_base64: "!!!not-a-real-base64!!!", mime_type: "image/png", model: modelOverride ?? model };
        case "invalid_url_payload":
          return { output_url: "https://mock.test/not-an-image", mime_type: "image/png", model: modelOverride ?? model };
        case "no_image":
          return { model: modelOverride ?? model };
        default:
          return { error_code: "MOCK_UNKNOWN_BEHAVIOR", error_message: `unknown behavior ${behavior}` };
      }
    },
  };
}

/** fetch stub returning real PNG bytes (for URL/image-download paths). */
export function mockFetchPng() {
  return async () => ({ ok: true, status: 200, headers: { get: () => "image/png" }, arrayBuffer: async () => MOCK_PNG_BYTES.buffer.slice(MOCK_PNG_BYTES.byteOffset, MOCK_PNG_BYTES.byteOffset + MOCK_PNG_BYTES.byteLength) });
}
/** fetch stub returning an HTML error page (must be rejected). */
export function mockFetchHtml() {
  const html = Buffer.from("<!doctype html><html><body>error</body></html>", "utf8");
  return async () => ({ ok: true, status: 200, headers: { get: () => "text/html" }, arrayBuffer: async () => html.buffer.slice(html.byteOffset, html.byteOffset + html.byteLength) });
}
/** fetch stub returning HTTP 404. */
export function mockFetch404() {
  return async () => ({ ok: false, status: 404, headers: { get: () => "text/plain" }, arrayBuffer: async () => new ArrayBuffer(0) });
}
