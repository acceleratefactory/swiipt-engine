// MAE media · IMAGE PROVIDER adapter boundary (capability `image_generation`).
// Consumes the EXISTING provider-neutral request (PromptPackage + VisualAssetSpec + ImageRenderSpec).
// Provider-specific translation happens HERE and never leaks into the spec/prompt/compositor contracts.
// Honest failure states; no fake artifact; no credentials logged or persisted.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { MAE_DIR } from "../lib/store.js";

export const IMAGE_PROVIDER_STATUS = Object.freeze({
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  PROVIDER_ATTEMPT_FAILED: "PROVIDER_ATTEMPT_FAILED",
  PROVIDER_RESPONSE_INVALID: "PROVIDER_RESPONSE_INVALID",
  MODEL_ID_MISMATCH: "MODEL_ID_MISMATCH",
  IMAGE_DOWNLOAD_FAILED: "IMAGE_DOWNLOAD_FAILED",
  IMAGE_ARTIFACT_INVALID: "IMAGE_ARTIFACT_INVALID",
  PROVIDER_SUCCESS: "PROVIDER_SUCCESS",
});

// A 1x1 transparent PNG — used to prove byte/validation paths without any network.
export const TINY_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const IMAGE_DIR = join(MAE_DIR, "storage", "work", "provider");

/** Remove credential material from any text that may be recorded/logged. */
export function redactSecrets(text, env = process.env) {
  let s = String(text == null ? "" : text);
  for (const [k, v] of Object.entries(env || {})) {
    if (/(KEY|TOKEN|SECRET|PASSWORD)/i.test(k) && typeof v === "string" && v.length >= 6) s = s.split(v).join("[redacted]");
  }
  return s;
}

/** Build the canonical provider-neutral image request from existing records. */
export function canonicalImageRequest({ promptPackage, spec } = {}) {
  if (!promptPackage || !promptPackage.prompt) throw new Error("canonicalImageRequest requires a prompt package");
  const ar = spec?.aspect_ratio || promptPackage?.aspect_ratio || "1:1";
  const canvas = spec?.canvas || {};
  const [aw, ah] = String(ar).split(":").map(Number);
  const width = Number.isFinite(canvas.width) ? canvas.width : (Number.isFinite(aw) ? aw : 1024);
  const height = Number.isFinite(canvas.height) ? canvas.height : (Number.isFinite(ah) ? ah : 1024);
  return {
    prompt: promptPackage.prompt,
    negative_prompt: promptPackage.negative_prompt || "",
    aspect_ratio: ar,
    width,
    height,
    reference_image: null,
    edit_source: null,
    seed: null,
    style_reference: null,
    image_reference: null,
    output_format: "png",
  };
}

/** Normalize a raw provider response into the canonical, honest result shape. */
export function normalizeImageResponse(raw = {}, { provider = null, requestedModel = null } = {}) {
  const returned_model = raw.model ?? raw.returned_model ?? null;
  return {
    status: raw.status || null,
    provider,
    requested_model: requestedModel,
    returned_model,
    provider_job_id: raw.provider_job_id ?? raw.id ?? null,
    output_type: raw.output_type || (raw.output_base64 || raw.b64_json ? "base64" : (raw.output_url || raw.url ? "url" : null)),
    output_url: raw.output_url ?? raw.url ?? null,
    output_base64: raw.output_base64 ?? raw.b64_json ?? null,
    mime_type: raw.mime_type ?? null,
    width: raw.width ?? null,
    height: raw.height ?? null,
    seed: raw.seed ?? null,
    latency_ms: raw.latency_ms ?? null,
    usage: raw.usage ?? null,
    cost: raw.cost ?? null,
    error_code: raw.error_code ?? (raw.error && (raw.error.code || raw.error.type)) ?? null,
    error_message: raw.error_message ?? (raw.error && (raw.error.message || String(raw.error))) ?? null,
    raw_metadata_reference: raw.raw_metadata_reference ?? null,
  };
}

/** Magic-byte validation — rejects HTML/error payloads masquerading as images. */
export function isLikelyImage(bytes, mime = null) {
  if (!bytes || bytes.length < 8) return false;
  const b = bytes;
  const isPng = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const isJpeg = b[0] === 0xff && b[1] === 0xd8;
  const isWebp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46;
  const head = b.slice(0, 64).toString("utf8").trim().toLowerCase();
  const isSvg = head.startsWith("<svg") || head.startsWith("<?xml");
  const looksHtml = head.startsWith("<html") || head.startsWith("<!doctype") || head.startsWith("{");
  if (looksHtml) return false;
  // Magic bytes decide — a declared mime type alone must never pass a non-image payload.
  return isPng || isJpeg || isWebp || isSvg;
}

/** Best-effort intrinsic dimensions from bytes (PNG/JPEG); null when unknown — never guessed. */
export function readImageDimensions(bytes, mime = null) {
  if (bytes && bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes && bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: bytes.readUInt16BE(i + 7), height: bytes.readUInt16BE(i + 5) };
      }
      const len = bytes.readUInt16BE(i + 2);
      i += 2 + len;
    }
  }
  return { width: null, height: null };
}

/** Persist image bytes locally with checksum + honest mime/dimensions. */
export function persistImageBytes(bytes, { mime = null, dir = IMAGE_DIR, name = "image.png" } = {}) {
  if (!isLikelyImage(bytes, mime)) return { ok: false, status: IMAGE_PROVIDER_STATUS.IMAGE_ARTIFACT_INVALID, reason: "payload is not a valid image (likely HTML/error payload)" };
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, bytes);
  const dims = readImageDimensions(bytes, mime);
  return { ok: true, local_path: path, mime_type: mime || "image/png", checksum: createHash("sha256").update(bytes).digest("hex"), width: dims.width, height: dims.height, byte_length: bytes.length };
}

/** Persist a normalized result that carries either a URL or base64. */
export async function persistImageResult(canonical, { dir = IMAGE_DIR, name = "image.png", fetchImpl = null, timeoutMs = 60000 } = {}) {
  if (canonical.output_base64) {
    try {
      const bytes = Buffer.from(String(canonical.output_base64), "base64");
      return persistImageBytes(bytes, { mime: canonical.mime_type, dir, name });
    } catch (e) {
      return { ok: false, status: IMAGE_PROVIDER_STATUS.IMAGE_ARTIFACT_INVALID, reason: "invalid base64 image" };
    }
  }
  if (canonical.output_url) {
    const doFetch = fetchImpl || globalThis.fetch;
    if (typeof doFetch !== "function") return { ok: false, status: IMAGE_PROVIDER_STATUS.IMAGE_DOWNLOAD_FAILED, reason: "no fetch implementation for image download" };
    try {
      const res = await doFetch(canonical.output_url, { method: "GET" });
      if (!res || res.ok === false) return { ok: false, status: IMAGE_PROVIDER_STATUS.IMAGE_DOWNLOAD_FAILED, reason: `image download HTTP ${res && res.status}` };
      const buf = Buffer.from(await res.arrayBuffer());
      const mime = (res.headers && res.headers.get && res.headers.get("content-type")) || canonical.mime_type || null;
      return persistImageBytes(buf, { mime, dir, name });
    } catch (e) {
      return { ok: false, status: IMAGE_PROVIDER_STATUS.IMAGE_DOWNLOAD_FAILED, reason: "image download failed" };
    }
  }
  return { ok: false, status: IMAGE_PROVIDER_STATUS.PROVIDER_RESPONSE_INVALID, reason: "provider returned no image (url or base64)" };
}

// ---- OpenAI-compatible image adapter ---------------------------------------
/** Transport for OpenAI-compatible `POST {base}/images/generations`. */
export async function openaiImageTransport(request, { baseUrl, apiKey, fetchImpl = null, timeoutMs = 60000 } = {}) {
  const doFetch = fetchImpl || globalThis.fetch;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await doFetch(`${String(baseUrl).replace(/\/+$/, "")}/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: request.model, prompt: request.prompt, size: `${request.width}x${request.height}`, n: 1, response_format: "b64_json" }),
      signal: controller ? controller.signal : undefined,
    });
    if (timer) clearTimeout(timer);
    if (!res || res.ok === false) {
      let detail = null; try { detail = await res.json(); } catch { /* ignore */ }
      return { error_code: `HTTP_${res && res.status}`, error_message: (detail && detail.error && detail.error.message) || "provider HTTP error" };
    }
    const j = await res.json();
    const item = Array.isArray(j.data) ? j.data[0] : null;
    return { output_base64: item && item.b64_json, output_url: item && item.url, model: j.model ?? null, usage: j.usage ?? null, raw_metadata_reference: null };
  } catch (e) {
    if (timer) clearTimeout(timer);
    if (e && e.name === "AbortError") throw Object.assign(new Error("provider timeout"), { name: "AbortError", retryable: true });
    throw e;
  }
}

/** Adapter object for an OpenAI-compatible image provider (dormant until keyed). */
export function makeOpenAICompatibleImageAdapter({ name, baseUrl, baseUrlEnv, apiKeyEnv, capabilities = {} } = {}) {
  return {
    name,
    capabilities: { image_generation: true, reference_image: false, image_edit: false, seed: false, style_reference: false, ...capabilities },
    configured(env = process.env) { return !!(env[apiKeyEnv] && (baseUrl || env[baseUrlEnv])); },
    async generate(request, { env = process.env, fetchImpl = null, timeoutMs = 60000 } = {}) {
      const key = env[apiKeyEnv];
      const base = baseUrl || env[baseUrlEnv];
      const raw = await openaiImageTransport({ ...request, model: request.model }, { baseUrl: base, apiKey: key, fetchImpl, timeoutMs });
      return raw;
    },
  };
}

/** Adapter object from any provider that already returns a canonical response (e.g. the mock). */
export function makeResponseAdapter({ name, capabilities = {}, generate }) {
  return { name, capabilities: { image_generation: true, reference_image: false, image_edit: false, seed: false, style_reference: false, ...capabilities }, configured() { return true; }, generate };
}

// ---- orchestration ----------------------------------------------------------
/**
 * Invoke an image provider adapter. Returns a canonical result (never throws for provider problems).
 * Unkeyed/uncapable adapters return PROVIDER_UNAVAILABLE with no network call.
 */
export async function invokeImageProvider({ adapter, request, model, env = process.env, fetchImpl = null, timeoutMs = 60000, dir = IMAGE_DIR, name = "image.png" } = {}) {
  const started = Date.now();
  if (!adapter) return { ...normalizeImageResponse({ error_code: IMAGE_PROVIDER_STATUS.PROVIDER_UNAVAILABLE, error_message: "no image provider adapter" }, { provider: null, requestedModel: model }), status: IMAGE_PROVIDER_STATUS.PROVIDER_UNAVAILABLE, local: null };
  if (!adapter.configured(env)) return { ...normalizeImageResponse({ error_code: IMAGE_PROVIDER_STATUS.PROVIDER_UNAVAILABLE, error_message: "provider not configured (no credentials)" }, { provider: adapter.name, requestedModel: model }), status: IMAGE_PROVIDER_STATUS.PROVIDER_UNAVAILABLE, local: null };

  let raw;
  try {
    raw = await adapter.generate({ ...request, model }, { env, fetchImpl, timeoutMs });
  } catch (e) {
    const timeout = e && e.name === "AbortError";
    const status = timeout ? IMAGE_PROVIDER_STATUS.PROVIDER_ATTEMPT_FAILED : IMAGE_PROVIDER_STATUS.PROVIDER_ATTEMPT_FAILED;
    return { ...normalizeImageResponse({ error_code: timeout ? "TIMEOUT" : "TRANSPORT_ERROR", error_message: redactSecrets(timeout ? "provider timeout" : "provider transport error", env), latency_ms: Date.now() - started }, { provider: adapter.name, requestedModel: model }), status, local: null, retryable: true };
  }
  const canonical = normalizeImageResponse(raw, { provider: adapter.name, requestedModel: model });
  canonical.latency_ms = canonical.latency_ms ?? (Date.now() - started);
  if (canonical.error_message) canonical.error_message = redactSecrets(canonical.error_message, env);

  if (canonical.error_code || canonical.error_message) {
    return { ...canonical, status: IMAGE_PROVIDER_STATUS.PROVIDER_ATTEMPT_FAILED, local: null, retryable: true };
  }

  const local = await persistImageResult(canonical, { dir, name, fetchImpl, timeoutMs });
  if (!local.ok) return { ...canonical, status: local.status, local: null, error_message: redactSecrets(local.reason, env), retryable: true };

  const model_identity = canonical.returned_model ? (canonical.returned_model === model ? "OK" : "MODEL_ID_MISMATCH") : "OK_UNVERIFIED";
  const status = model_identity === "MODEL_ID_MISMATCH" ? IMAGE_PROVIDER_STATUS.MODEL_ID_MISMATCH : IMAGE_PROVIDER_STATUS.PROVIDER_SUCCESS;
  return { ...canonical, status, model_identity, model_unverified: model_identity === "OK_UNVERIFIED", local };
}
