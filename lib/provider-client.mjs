// Swiipt · small shared OpenAI-compatible provider client (integration utility).
//
// Purpose: remove the hard dependency on https://api.openai.com/v1/chat/completions and give the
// factory (Writing Control) and future MAE text/reasoning adapters ONE place that handles base URL,
// API key, model, request, structured response, timeout, HTTP failure and invalid responses.
//
// This is deliberately small and sits BEHIND the existing provider adapters. It is not a provider
// platform, microservice or SDK, and it holds no vendor-specific business logic.
//
// Status vocabulary (typed, honest — never a fake success):
//   PROVIDER_NOT_CONFIGURED · PROVIDER_ATTEMPT_FAILED · PROVIDER_RESPONSE_INVALID
//   PROVIDER_SUCCESS · DETERMINISTIC_GENERATION

export const DEFAULT_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_MODEL = "gpt-4o-mini";

export const STATUS = {
  PROVIDER_NOT_CONFIGURED: "PROVIDER_NOT_CONFIGURED",
  PROVIDER_ATTEMPT_FAILED: "PROVIDER_ATTEMPT_FAILED",
  PROVIDER_RESPONSE_INVALID: "PROVIDER_RESPONSE_INVALID",
  PROVIDER_SUCCESS: "PROVIDER_SUCCESS",
  DETERMINISTIC_GENERATION: "DETERMINISTIC_GENERATION",
};

// Worker → model env var. Worker-specific config takes precedence over the shared OPENAI_MODEL.
export const WORKER_MODEL_ENV = {
  copywriter: "COPYWRITER_MODEL",
  "writing-critic": "WRITING_CRITIC_MODEL",
  "mae-generation": "MAE_GENERATION_MODEL",
  "mae-critic": "MAE_CRITIC_MODEL",
};

/** Resolve the model for a worker: WORKER_MODEL → OPENAI_MODEL → default. */
export function resolveModel(worker, env = process.env) {
  const specific = WORKER_MODEL_ENV[worker];
  const model = (specific && env[specific]) || env.OPENAI_MODEL || DEFAULT_MODEL;
  return String(model).trim() || DEFAULT_MODEL;
}

/**
 * Normalize a base URL so configuration cannot create /v1/v1/... or duplicate /chat/completions.
 * - empty → official default
 * - strips a trailing /chat/completions and trailing slashes
 * - collapses repeated /v1 segments
 * - appends /v1 only when the URL has no path
 */
export function normalizeBaseUrl(raw) {
  const s = String(raw == null ? "" : raw).trim();
  if (!s) return DEFAULT_BASE_URL;
  let u = s.replace(/\/+$/, "");
  u = u.replace(/\/chat\/completions$/i, "");
  u = u.replace(/(\/v1)(?:\/v1)+/gi, "$1");
  const m = u.match(/^([a-z][a-z0-9+.-]*:\/\/[^/]+)(\/.*)?$/i);
  if (m) {
    const origin = m[1];
    let path = m[2] || "";
    if (path === "" || path === "/") path = "/v1";
    u = origin + path;
  }
  return u.replace(/\/+$/, "") || DEFAULT_BASE_URL;
}

export function chatEndpoint(rawBase, env = process.env) {
  return `${normalizeBaseUrl(rawBase == null ? env.OPENAI_BASE_URL : rawBase)}/chat/completions`;
}

function safeHost(url) {
  try { return new URL(url).host; } catch { return null; }
}

/** Remove credential material from anything that may be recorded or logged. */
export function redact(text, env = process.env) {
  let s = String(text == null ? "" : text);
  for (const k of [env.OPENAI_API_KEY, env.MAE_CRITIC_API_KEY]) {
    if (k && String(k).length >= 6) s = s.split(String(k)).join("[redacted]");
  }
  s = s.replace(/sk-[A-Za-z0-9_-]{8,}/g, "[redacted]");
  return s;
}

/**
 * Perform a Chat Completions request against an OpenAI-compatible endpoint.
 * Returns a typed result; never throws for provider/config/response problems.
 *
 * @returns {Promise<{ok:boolean,status:string,model:string,endpoint_host:string|null,http_status:number|null,content?:string|null,json?:object|null,error:string|null}>}
 */
export async function chatCompletion({
  messages, model, temperature = 0, jsonMode = false, timeoutMs,
  env = process.env, fetchImpl = null, worker = "copywriter",
} = {}) {
  const endpoint = chatEndpoint(env.OPENAI_BASE_URL, env);
  const host = safeHost(endpoint);
  const mdl = model || resolveModel(worker, env);
  const key = env.OPENAI_API_KEY;

  if (!key) {
    return { ok: false, status: STATUS.PROVIDER_NOT_CONFIGURED, model: mdl, endpoint_host: host, http_status: null, error: "OPENAI_API_KEY not set" };
  }

  const doFetch = fetchImpl || globalThis.fetch;
  if (typeof doFetch !== "function") {
    return { ok: false, status: STATUS.PROVIDER_ATTEMPT_FAILED, model: mdl, endpoint_host: host, http_status: null, error: "no fetch implementation available" };
  }

  const ms = Number(timeoutMs || env.OPENAI_TIMEOUT_MS || 60000);
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), ms) : null;

  try {
    const res = await doFetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: mdl, temperature, ...(jsonMode ? { response_format: { type: "json_object" } } : {}), messages }),
      signal: controller ? controller.signal : undefined,
    });
    if (timer) clearTimeout(timer);

    if (!res || typeof res.ok !== "boolean") {
      return { ok: false, status: STATUS.PROVIDER_ATTEMPT_FAILED, model: mdl, endpoint_host: host, http_status: null, error: "fetch returned an invalid response object" };
    }
    if (!res.ok) {
      return { ok: false, status: STATUS.PROVIDER_ATTEMPT_FAILED, model: mdl, endpoint_host: host, http_status: res.status, error: redact(`HTTP ${res.status}`, env) };
    }

    let data;
    try { data = await res.json(); } catch { return { ok: false, status: STATUS.PROVIDER_RESPONSE_INVALID, model: mdl, endpoint_host: host, http_status: res.status, error: "response body was not valid JSON" }; }

    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return { ok: false, status: STATUS.PROVIDER_RESPONSE_INVALID, model: mdl, endpoint_host: host, http_status: res.status, error: "response missing choices[0].message.content" };
    }

    if (jsonMode) {
      try {
        const parsed = JSON.parse(content);
        return { ok: true, status: STATUS.PROVIDER_SUCCESS, model: mdl, endpoint_host: host, http_status: res.status, content, json: parsed, error: null };
      } catch {
        return { ok: false, status: STATUS.PROVIDER_RESPONSE_INVALID, model: mdl, endpoint_host: host, http_status: res.status, error: "json_object response was not parseable" };
      }
    }
    return { ok: true, status: STATUS.PROVIDER_SUCCESS, model: mdl, endpoint_host: host, http_status: res.status, content, json: null, error: null };
  } catch (e) {
    if (timer) clearTimeout(timer);
    const msg = e?.name === "AbortError" ? "request timed out" : (e?.message || "fetch failed");
    return { ok: false, status: STATUS.PROVIDER_ATTEMPT_FAILED, model: mdl, endpoint_host: host, http_status: null, error: redact(msg, env) };
  }
}
