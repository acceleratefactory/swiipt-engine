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
    retryable: raw.retryable ?? null,
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

// Deterministic MIME detection from bytes. Bytes are authoritative; provider metadata is secondary.
export function detectImageMime(bytes) {
  if (!bytes || bytes.length < 8) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes.length > 12 && bytes.slice(8, 12).toString("ascii") === "WEBP") return "image/webp";
  const head = bytes.slice(0, 64).toString("utf8").trim().toLowerCase();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) return "image/svg+xml";
  return null;
}
export function extensionForMime(mime) {
  return mime === "image/jpeg" ? ".jpg" : mime === "image/png" ? ".png" : mime === "image/webp" ? ".webp" : mime === "image/svg+xml" ? ".svg" : ".bin";
}
/** Force the file extension to match the detected bytes (deterministic; new artifacts only). */
export function withDetectedExtension(name, mime) {
  const s = String(name || "image");
  const dot = s.lastIndexOf(".");
  const stem = dot > 0 ? s.slice(0, dot) : s;
  return stem + extensionForMime(mime);
}

/** Deterministic aspect-ratio comparison. Absolute tolerance on the width/height ratio. */
export const ASPECT_RATIO_TOLERANCE = 0.02;
export function ratioOf(ar) { const [a, b] = String(ar == null ? "" : ar).split(":").map(Number); return a && b ? a / b : null; }
export function compareAspectRatio(requested, actual, tolerance = ASPECT_RATIO_TOLERANCE) {
  const r1 = ratioOf(requested); const r2 = ratioOf(actual);
  if (r1 == null || r2 == null) return { match: null, delta: null, tolerance };
  const delta = Math.round(Math.abs(r1 - r2) * 1e6) / 1e6;
  return { match: delta <= tolerance, delta, tolerance };
}

/** Persist image bytes locally with checksum + byte-authoritative mime/dimensions. */
export function persistImageBytes(bytes, { mime = null, dir = IMAGE_DIR, name = "image.png" } = {}) {
  if (!isLikelyImage(bytes, mime)) return { ok: false, status: IMAGE_PROVIDER_STATUS.IMAGE_ARTIFACT_INVALID, reason: "payload is not a valid image (likely HTML/error payload)" };
  const detected = detectImageMime(bytes);
  const providerDeclared = mime ? String(mime).toLowerCase() : null;
  const finalMime = detected || providerDeclared || "image/png"; // bytes > provider metadata > fallback
  mkdirSync(dir, { recursive: true });
  const finalName = withDetectedExtension(name, finalMime);
  const path = join(dir, finalName);
  writeFileSync(path, bytes);
  const dims = readImageDimensions(bytes, finalMime);
  return {
    ok: true, local_path: path, mime_type: finalMime,
    provider_declared_mime_type: providerDeclared, detected_mime_type: detected,
    mime_type_match: providerDeclared == null ? null : (providerDeclared === finalMime),
    checksum: createHash("sha256").update(bytes).digest("hex"),
    width: dims.width, height: dims.height, byte_length: bytes.length,
  };
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

// ---- Google Gemini image adapter -------------------------------------------
export const GEMINI_DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
// Documented Gemini image aspect ratios. The fixture aspect ratio is mapped deterministically to the
// nearest supported value (never silently dropped); the mapping is recorded in raw_metadata_reference.
export const GEMINI_SUPPORTED_ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
const ratioValue = (s) => { const [a, b] = String(s).split(":").map(Number); return a && b ? a / b : null; };
export function mapGeminiAspectRatio(ar) {
  const s = String(ar || "").trim();
  if (GEMINI_SUPPORTED_ASPECT_RATIOS.includes(s)) return s;
  const target = ratioValue(s);
  if (!target) return "1:1";
  let best = GEMINI_SUPPORTED_ASPECT_RATIOS[0], bestD = Infinity;
  for (const c of GEMINI_SUPPORTED_ASPECT_RATIOS) { const d = Math.abs(Math.log(ratioValue(c) / target)); if (d < bestD - 1e-12) { bestD = d; best = c; } }
  return best;
}
export function mapGeminiImageSize(width, height) {
  const m = Math.max(Number(width) || 0, Number(height) || 0);
  if (m <= 1024) return "1K";
  if (m <= 2048) return "2K";
  return "4K";
}

/** Transport for the documented Gemini content-generation image path. */
export async function geminiImageTransport(request, { baseUrl = GEMINI_DEFAULT_BASE_URL, apiKey, fetchImpl = null, timeoutMs = 60000 } = {}) {
  const doFetch = fetchImpl || globalThis.fetch;
  const base = String(baseUrl || GEMINI_DEFAULT_BASE_URL).replace(/\/+$/, "");
  const url = `${base}/v1beta/models/${request.model}:generateContent`;
  const aspectSent = mapGeminiAspectRatio(request.aspect_ratio);
  const sizeSent = mapGeminiImageSize(request.width, request.height);
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await doFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: request.prompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: aspectSent, imageSize: sizeSent } },
      }),
      signal: controller ? controller.signal : undefined,
    });
    if (timer) clearTimeout(timer);
    if (!res || res.ok === false) {
      let detail = null; try { detail = await res.json(); } catch { /* ignore */ }
      const status = res && res.status;
      const blob = detail ? JSON.stringify(detail) : "";
      const safety = status === 400 && /safety|blocked|prohibited|policy|recitation/i.test(blob);
      return {
        error_code: safety ? "SAFETY_BLOCKED" : `HTTP_${status}`,
        error_message: (detail && detail.error && detail.error.message) || (safety ? "request blocked by provider safety policy" : "provider HTTP error"),
        retryable: safety ? false : (status === 429 || (status >= 500 && status <= 599)),
      };
    }
    let j; try { j = await res.json(); } catch { return { error_code: "INVALID_JSON", error_message: "provider response was not JSON", retryable: true }; }
    const cand = j && Array.isArray(j.candidates) ? j.candidates[0] : null;
    const parts = cand && cand.content && Array.isArray(cand.content.parts) ? cand.content.parts : [];
    const inline = parts.find((p) => p && p.inlineData && p.inlineData.data);
    if (!inline) {
      const finish = cand ? String(cand.finishReason || "") : "";
      const safety = /SAFETY|PROHIBITED|BLOCKLIST|RECITATION/i.test(finish);
      if (safety) return { error_code: "SAFETY_BLOCKED", error_message: "request blocked by provider safety policy", retryable: false };
      return {}; // malformed/empty → normalized as PROVIDER_RESPONSE_INVALID downstream (no fake image)
    }
    return {
      output_base64: inline.inlineData.data,
      mime_type: inline.inlineData.mimeType || "image/png",
      model: j.modelVersion ?? null,
      raw_metadata_reference: { aspect_ratio_requested: request.aspect_ratio, aspect_ratio_sent: aspectSent, image_size_sent: sizeSent },
    };
  } catch (e) {
    if (timer) clearTimeout(timer);
    if (e && e.name === "AbortError") throw Object.assign(new Error("provider timeout"), { name: "AbortError", retryable: true });
    throw e;
  }
}

/** Adapter object for Google Gemini image generation (dormant until keyed). */
export function makeGeminiImageAdapter({ name = "google-gemini", baseUrl = null, baseUrlEnv = "GEMINI_IMAGE_BASE_URL", apiKeyEnv = "GEMINI_IMAGE_API_KEY", capabilities = {} } = {}) {
  return {
    name,
    capabilities: { image_generation: true, reference_image: false, image_edit: false, seed: false, style_reference: false, negative_prompt: false, ...capabilities },
    configured(env = process.env) { return !!env[apiKeyEnv]; },
    async generate(request, { env = process.env, fetchImpl = null, timeoutMs = 60000 } = {}) {
      const key = env[apiKeyEnv];
      const base = baseUrl || env[baseUrlEnv] || GEMINI_DEFAULT_BASE_URL;
      return geminiImageTransport(request, { baseUrl: base, apiKey: key, fetchImpl, timeoutMs });
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
    // Respect the transport's retryable classification; default to retryable for unknown transport faults.
    return { ...canonical, status: IMAGE_PROVIDER_STATUS.PROVIDER_ATTEMPT_FAILED, local: null, retryable: canonical.retryable === false ? false : true };
  }

  const local = await persistImageResult(canonical, { dir, name, fetchImpl, timeoutMs });
  if (!local.ok) return { ...canonical, status: local.status, local: null, error_message: redactSecrets(local.reason, env), retryable: true };

  // Exact prompt capture: canonical prompt is what the pipeline built; provider_prompt_sent is what the
  // adapter actually sent (identical unless an adapter explicitly transforms it).
  const canonical_prompt = request.prompt ?? null;
  const provider_prompt_sent = (raw && typeof raw.provider_prompt === "string") ? raw.provider_prompt : canonical_prompt;

  const model_identity = canonical.returned_model ? (canonical.returned_model === model ? "OK" : "MODEL_ID_MISMATCH") : "OK_UNVERIFIED";
  const status = model_identity === "MODEL_ID_MISMATCH" ? IMAGE_PROVIDER_STATUS.MODEL_ID_MISMATCH : IMAGE_PROVIDER_STATUS.PROVIDER_SUCCESS;

  // Truthful requested-vs-actual provenance (no guessed provider size mapping).
  const requestedW = Number.isFinite(request.width) ? request.width : null;
  const requestedH = Number.isFinite(request.height) ? request.height : null;
  const actualW = local.width ?? null;
  const actualH = local.height ?? null;
  const requestedAR = request.aspect_ratio ?? (requestedW && requestedH ? `${requestedW}:${requestedH}` : null);
  const actualAR = actualW && actualH ? `${actualW}:${actualH}` : null;
  const cmp = compareAspectRatio(requestedAR, actualAR);
  const dimension_match = (requestedW != null && requestedH != null && actualW != null && actualH != null) ? (requestedW === actualW && requestedH === actualH) : null;

  return {
    ...canonical,
    mime_type: local.mime_type,
    provider_declared_mime_type: local.provider_declared_mime_type,
    detected_mime_type: local.detected_mime_type,
    mime_type_match: local.mime_type_match,
    prompt: provider_prompt_sent,
    canonical_prompt,
    provider_prompt_sent,
    prompt_modified_by_adapter: provider_prompt_sent !== canonical_prompt,
    negative_prompt: request.negative_prompt ?? null,
    requested_width: requestedW,
    requested_height: requestedH,
    requested_aspect_ratio: requestedAR,
    actual_width: actualW,
    actual_height: actualH,
    actual_aspect_ratio: actualAR,
    dimension_match,
    aspect_ratio_match: cmp.match,
    aspect_ratio_delta: cmp.delta,
    aspect_ratio_tolerance: cmp.tolerance,
    status, model_identity, model_unverified: model_identity === "OK_UNVERIFIED", local,
  };
}
