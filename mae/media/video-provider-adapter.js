// MAE media · Provider-neutral VIDEO provider adapter foundation (Wave V-E).
// The provider's responsibility ends at SOURCE MEDIA. Final typography/CTA/captions/logo/safe
// zones/marketing composition stay owned by the deterministic assembler (Wave V-D).
//
// Chain: canonicalVideoRequest() → adapter → provider-native request → provider job → normalized
// result → EXISTING V-B artifact persistence/validation. No second pipeline, no duplicated
// validation/provenance/QA. Async job lifecycle is explicit and polling is bounded.
// Credentials are env/config only and are never persisted or logged.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { VIDEO_CAPABILITIES } from "./video-provider.js";
import { redactSecrets } from "./image-provider.js";
import { persistVideoArtifact, videoConformance } from "./video-artifact.js";
import { VIDEO_ARTIFACT_DIR } from "./video-artifact.js";

export const PROVIDER_STATE = Object.freeze({
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  PROVIDER_ATTEMPT_FAILED: "PROVIDER_ATTEMPT_FAILED",
  PROVIDER_RESPONSE_INVALID: "PROVIDER_RESPONSE_INVALID",
  MODEL_ID_MISMATCH: "MODEL_ID_MISMATCH",
  PROVIDER_JOB_FAILED: "PROVIDER_JOB_FAILED",
  PROVIDER_JOB_TIMEOUT: "PROVIDER_JOB_TIMEOUT",
  VIDEO_DOWNLOAD_FAILED: "VIDEO_DOWNLOAD_FAILED",
  VIDEO_ARTIFACT_INVALID: "VIDEO_ARTIFACT_INVALID",
  PROVIDER_SUCCESS: "PROVIDER_SUCCESS",
});

export const JOB_STATUS = Object.freeze({
  PROVIDER_JOB_SUBMITTED: "PROVIDER_JOB_SUBMITTED",
  PROVIDER_JOB_PENDING: "PROVIDER_JOB_PENDING",
  PROVIDER_JOB_PROCESSING: "PROVIDER_JOB_PROCESSING",
  PROVIDER_JOB_COMPLETED: "PROVIDER_JOB_COMPLETED",
  PROVIDER_JOB_FAILED: "PROVIDER_JOB_FAILED",
  PROVIDER_JOB_CANCELLED: "PROVIDER_JOB_CANCELLED",
  PROVIDER_JOB_TIMEOUT: "PROVIDER_JOB_TIMEOUT",
});

export const MODEL_IDENTITY = Object.freeze({ MATCH: "MATCH", MISMATCH: "MISMATCH", UNVERIFIED: "UNVERIFIED" });

export const DEFAULT_POLL = Object.freeze({ poll_interval_ms: 15000, max_poll_attempts: 60, timeout_ms: 900000 });
export const MAX_RETRY_AFTER_MS = 60000;      // sanity clamp for provider Retry-After
export const MEDIA_PROTOCOLS = Object.freeze(["https:", "http:"]);

// Canonical controls → capability name. Anything not advertised is recorded as unsupported.
export const CAPABILITY_FOR_CONTROL = Object.freeze({
  source_image: "image_to_video",
  reference_images: "reference_image",
  multiple_reference_images: "multiple_reference_images",
  audio: "audio_generation",
  duration_seconds: "duration_control",
  aspect_ratio: "aspect_ratio_control",
  resolution: "resolution_control",
  fps: "fps_control",
  seed: "seed",
  loop: "loop",
  camera: "camera_control",
  motion: "motion_control",
});

/** Controls the canonical request actually asks for (explicit only — never inferred). */
export function requestedCapabilities(request = {}) {
  const out = ["video_generation"];
  if (request.source_image) out.push("image_to_video");
  const refs = Array.isArray(request.reference_images) ? request.reference_images : [];
  if (refs.length === 1) out.push("reference_image");
  if (refs.length > 1) { out.push("reference_image", "multiple_reference_images"); }
  if (request.audio && request.audio.mode && request.audio.mode !== "NONE") out.push("audio_generation");
  if (request.duration_seconds != null) out.push("duration_control");
  if (request.aspect_ratio != null) out.push("aspect_ratio_control");
  if (request.width != null || request.height != null) out.push("resolution_control");
  if (request.fps != null) out.push("fps_control");
  if (request.seed != null) out.push("seed");
  if (request.loop === true) out.push("loop");
  if (request.camera && Object.values(request.camera).some((v) => v != null)) out.push("camera_control");
  if (request.motion && Object.values(request.motion).some((v) => v != null)) out.push("motion_control");
  return [...new Set(out)];
}

/** Required capabilities block the request; optional ones are recorded but not transmitted. */
export function requiredCapabilities(request = {}) {
  const req = ["video_generation"];
  if (request.source_image) req.push("image_to_video");
  const refs = Array.isArray(request.reference_images) ? request.reference_images : [];
  if (refs.length) req.push("reference_image");
  if (refs.length > 1) req.push("multiple_reference_images");
  if (request.audio && request.audio.mode && request.audio.mode !== "NONE") req.push("audio_generation");
  return req;
}

/** Explicit capability report — never infers support. */
export function capabilityReport(adapter, request = {}) {
  const asked = requestedCapabilities(request);
  if (request.negative_prompt) asked.push("negative_prompt");
  const required = new Set(requiredCapabilities(request));
  return asked.map((cap) => {
    const supported = adapter.capabilities[cap] === true;
    return {
      requested_capability: cap, supported,
      sent_to_provider: supported,
      required: required.has(cap),
      reason: supported ? "advertised by provider" : "not advertised by provider — not transmitted",
    };
  });
}

export function normalizeJob(raw = {}, { provider = null, requested_model = null } = {}) {
  const map = {
    submitted: JOB_STATUS.PROVIDER_JOB_SUBMITTED, queued: JOB_STATUS.PROVIDER_JOB_PENDING, pending: JOB_STATUS.PROVIDER_JOB_PENDING,
    processing: JOB_STATUS.PROVIDER_JOB_PROCESSING, running: JOB_STATUS.PROVIDER_JOB_PROCESSING,
    completed: JOB_STATUS.PROVIDER_JOB_COMPLETED, succeeded: JOB_STATUS.PROVIDER_JOB_COMPLETED, success: JOB_STATUS.PROVIDER_JOB_COMPLETED,
    failed: JOB_STATUS.PROVIDER_JOB_FAILED, error: JOB_STATUS.PROVIDER_JOB_FAILED,
    cancelled: JOB_STATUS.PROVIDER_JOB_CANCELLED, canceled: JOB_STATUS.PROVIDER_JOB_CANCELLED,
  };
  const providerStatus = raw.provider_status ?? raw.status ?? null;
  const status = JOB_STATUS[String(providerStatus || "").toUpperCase()] || map[String(providerStatus || "").toLowerCase()] || null;
  const returned = raw.returned_model ?? null;
  return {
    provider,
    requested_model: requested_model ?? raw.requested_model ?? null,
    returned_model: returned,
    model_identity: returned == null ? MODEL_IDENTITY.UNVERIFIED : (returned === (requested_model ?? raw.requested_model) ? MODEL_IDENTITY.MATCH : MODEL_IDENTITY.MISMATCH),
    provider_job_id: raw.provider_job_id ?? raw.job_id ?? null,
    status,
    provider_status: providerStatus,
    progress: raw.progress ?? null,
    retry_after_ms: raw.retry_after_ms ?? null,
    error: raw.error ?? null,
    retryable: raw.retryable ?? null,
    media: raw.media ?? null,
  };
}

/** URL safety: ordinary http(s) transport only; never file://, data:, or local paths. */
export function isSafeMediaUrl(url, allowedHosts = []) {
  let u;
  try { u = new URL(String(url)); } catch { return false; }
  if (!MEDIA_PROTOCOLS.includes(u.protocol)) return false;
  if (typeof url === "string" && /^(file:|data:|\\\\|\/|[A-Za-z]:)/.test(url)) return false;
  if (allowedHosts.length && !allowedHosts.includes(u.hostname)) return false;
  return true;
}

const isObj = (v) => v != null && typeof v === "object" && !Array.isArray(v);

export function makeVideoProviderAdapter({ name, capabilities = {}, requiredEnv = [], env = process.env, transport = null, allowedMediaHosts = [] } = {}) {
  if (!name) throw new Error("video provider adapter requires a name");
  const caps = {};
  for (const c of Object.keys(capabilities)) { if (!VIDEO_CAPABILITIES.includes(c)) continue; caps[c] = capabilities[c] === true; }
  const adapter = {
    name,
    capabilities: Object.freeze(caps),
    requiredEnv: [...requiredEnv],
    env,
    transport,
    allowedMediaHosts,
    /** configured(env) — presence check only; values are never returned. */
    configured(e = adapter.env) {
      const missing = adapter.requiredEnv.filter((k) => !e?.[k]);
      return { configured: missing.length === 0, missing, source: "env" };
    },
    /** Names only — never values. */
    credentialFieldNames() { return [...adapter.requiredEnv]; },
    submit(request, options = {}) {
      const conf = adapter.configured();
      if (!conf.configured) return { state: PROVIDER_STATE.PROVIDER_UNAVAILABLE, missing_env: conf.missing, unsupported: [] };
      const report = capabilityReport(adapter, request);
      const unsupported = report.filter((c) => !c.supported);
      const blocked = unsupported.filter((c) => c.required).map((c) => c.requested_capability);
      if (blocked.length) return { state: PROVIDER_STATE.PROVIDER_ATTEMPT_FAILED, unsupported, unsupported_required: blocked, error: `unsupported required capability: ${blocked.join(", ")}` };
      return { state: null, report, unsupported, options };
    },
    normalize(result) { return normalizeVideoProviderResult(result, { provider: adapter.name }); },
    /** Normalized job lookup (delegates the provider-native poll to the transport). */
    getJob(jobId, options = {}) {
      const raw = adapter.transport.poll(jobId, options.attempt ?? 0, options);
      if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return normalizeJob({ provider_job_id: jobId, provider_status: null }, { provider: adapter.name, requested_model: options.requested_model ?? null });
      return normalizeJob({ ...raw, provider_job_id: raw.provider_job_id ?? jobId }, { provider: adapter.name, requested_model: options.requested_model ?? null });
    },
  };
  return adapter;
}

export function normalizeVideoProviderResult(raw = {}, { provider = null, request = {}, artifact = null, conformance = null, provider_prompt_sent = null, prompt_modified_by_adapter = null } = {}) {
  const job = raw.job || normalizeJob(raw, { provider });
  return {
    state: raw.state ?? null,
    provider,
    requested_model: job.requested_model,
    returned_model: job.returned_model,
    model_identity: job.model_identity,
    provider_job_id: job.provider_job_id,
    provider_status: job.provider_status,
    video_url: raw.video_url ?? null,
    video_base64: raw.video_base64 ? "(present)" : null,   // never persist the payload itself
    local_path: artifact?.local_path ?? null,
    provider_declared_mime_type: raw.provider_declared_mime_type ?? null,
    requested_width: request.width ?? null,
    requested_height: request.height ?? null,
    requested_aspect_ratio: request.aspect_ratio ?? null,
    requested_duration_seconds: request.duration_seconds ?? null,
    requested_fps: request.fps ?? null,
    provider_prompt_sent,
    prompt_modified_by_adapter,
    negative_prompt: raw.negative_prompt ?? request.negative_prompt ?? null,
    source_image: request.source_image ?? null,
    reference_images: Array.isArray(request.reference_images) ? request.reference_images : [],
    seed: raw.seed ?? null,
    usage: raw.usage ?? null,
    cost: raw.cost ?? null,
    latency_ms: raw.latency_ms ?? null,
    error: raw.error ?? null,
    retryable: raw.retryable ?? null,
    raw_metadata_ref: raw.raw_metadata_ref ?? (job.provider_job_id ? `provider:job:${job.provider_job_id}` : null),
    unsupported_controls: raw.unsupported_controls ?? [],
    artifact,
    conformance,
  };
}

/**
 * Run a provider job end-to-end (submit → bounded poll → download → EXISTING V-B persistence).
 * Deterministic: no timers; elapsed time is modelled from the configured poll interval.
 */
export function runVideoProviderJob({ adapter, request = {}, poll = {}, artifactDir = VIDEO_ARTIFACT_DIR, sources = {} } = {}) {
  const conf = adapter.configured();
  const result0 = {
    provider: adapter.name, requested_model: request.model ?? null, returned_model: null,
    model_identity: MODEL_IDENTITY.UNVERIFIED, provider_job_id: null, provider_status: null,
    attempts_polled: 0, unsupported_controls: [], artifact: null, conformance: null,
    provider_prompt_sent: null, prompt_modified_by_adapter: null,
  };
  if (!conf.configured) return { ...result0, state: PROVIDER_STATE.PROVIDER_UNAVAILABLE, missing_env: conf.missing, error: "provider not configured" };

  const report = capabilityReport(adapter, request);
  const unsupported = report.filter((c) => !c.supported);
  const blocked = unsupported.filter((c) => c.required).map((c) => c.requested_capability);
  if (blocked.length) return { ...result0, state: PROVIDER_STATE.PROVIDER_ATTEMPT_FAILED, unsupported_controls: unsupported, error: `unsupported required capability: ${blocked.join(", ")}` };

  const t = adapter.transport;
  const built = t.buildRequest(request, adapter.capabilities);
  const provider_prompt_sent = built.provider_prompt_sent ?? request.prompt ?? null;
  const prompt_modified_by_adapter = built.provider_prompt_modified != null ? !!built.provider_prompt_modified : provider_prompt_sent !== (request.prompt ?? null);
  const common = { ...result0, unsupported_controls: unsupported, provider_prompt_sent, prompt_modified_by_adapter, negative_prompt: built.negative_prompt ?? request.negative_prompt ?? null };

  // submit
  let raw;
  try { raw = t.submit(built.native, { request }); } catch (e) { return { ...common, state: PROVIDER_STATE.PROVIDER_ATTEMPT_FAILED, error: redactSecrets(String(e?.message || e)) }; }
  if (!isObj(raw)) return { ...common, state: PROVIDER_STATE.PROVIDER_RESPONSE_INVALID, error: "malformed submit response" };
  let job = normalizeJob(raw, { provider: adapter.name, requested_model: request.model ?? null });
  if (!job.provider_job_id && !(job.status === JOB_STATUS.PROVIDER_JOB_COMPLETED && job.media)) {
    return { ...common, state: PROVIDER_STATE.PROVIDER_RESPONSE_INVALID, error: "async job response missing provider_job_id", provider_status: job.provider_status };
  }

  const finish = (j) => finalizeCompleted({ adapter, request, job: j, built, common, artifactDir });
  const fail = (state, j) => ({ ...common, state, provider_job_id: j.provider_job_id, provider_status: j.provider_status, returned_model: j.returned_model, model_identity: j.model_identity, error: j.error ?? null, retryable: j.retryable ?? null });

  if (job.status === JOB_STATUS.PROVIDER_JOB_COMPLETED) return finish(job);      // sync-capable provider: no fake polling
  if (job.status === JOB_STATUS.PROVIDER_JOB_FAILED) return fail(PROVIDER_STATE.PROVIDER_JOB_FAILED, job);
  if (job.status === JOB_STATUS.PROVIDER_JOB_CANCELLED) return fail(PROVIDER_STATE.PROVIDER_JOB_FAILED, job);
  if (!job.status) return { ...common, state: PROVIDER_STATE.PROVIDER_RESPONSE_INVALID, error: `unknown provider status "${job.provider_status}"` };

  // bounded polling
  const maxAttempts = poll.max_poll_attempts ?? DEFAULT_POLL.max_poll_attempts;
  const timeout = poll.timeout_ms ?? DEFAULT_POLL.timeout_ms;
  let interval = poll.poll_interval_ms ?? DEFAULT_POLL.poll_interval_ms;
  let elapsed = 0, attempts = 0;
  while (attempts < maxAttempts && elapsed < timeout) {
    let r;
    try { r = t.poll(job.provider_job_id, attempts, { request }); } catch (e) { return { ...fail(PROVIDER_STATE.PROVIDER_ATTEMPT_FAILED, job), error: redactSecrets(String(e?.message || e)) }; }
    attempts++; elapsed += interval;
    if (!isObj(r)) return { ...common, state: PROVIDER_STATE.PROVIDER_RESPONSE_INVALID, error: "malformed poll response", attempts_polled: attempts, provider_job_id: job.provider_job_id };
    if (r.retry_after_ms != null) interval = Math.min(r.retry_after_ms, MAX_RETRY_AFTER_MS);
    const nj = normalizeJob({ ...r, provider_job_id: job.provider_job_id, requested_model: request.model ?? null }, { provider: adapter.name, requested_model: request.model ?? null });
    if (nj.status === JOB_STATUS.PROVIDER_JOB_COMPLETED) return { ...finish(nj), attempts_polled: attempts };
    if (nj.status === JOB_STATUS.PROVIDER_JOB_FAILED || nj.status === JOB_STATUS.PROVIDER_JOB_CANCELLED) return { ...fail(PROVIDER_STATE.PROVIDER_JOB_FAILED, nj), attempts_polled: attempts, job };
    job = nj;
  }
  return { ...common, state: PROVIDER_STATE.PROVIDER_JOB_TIMEOUT, provider_job_id: job.provider_job_id, provider_status: job.provider_status, attempts_polled: attempts, elapsed_ms: elapsed, status: JOB_STATUS.PROVIDER_JOB_TIMEOUT };
}

/** Download → EXISTING V-B validate/persist/conform. Bytes are authoritative. */
function finalizeCompleted({ adapter, request, job, built, common, artifactDir }) {
  const media = job.media || {};
  let bytes = null;
  let video_url = null;
  if (media.video_base64) bytes = Buffer.from(String(media.video_base64), "base64");
  else if (media.url) {
    video_url = media.url;
    if (!isSafeMediaUrl(media.url, adapter.allowedMediaHosts)) return { ...common, state: PROVIDER_STATE.PROVIDER_RESPONSE_INVALID, error: "unsafe or malformed media URL", provider_job_id: job.provider_job_id };
    const got = adapter.transport.download(media.url, { request });
    if (!got) return { ...common, state: PROVIDER_STATE.VIDEO_DOWNLOAD_FAILED, error: "media download failed", video_url, provider_job_id: job.provider_job_id };
    bytes = Buffer.isBuffer(got) ? got : (got.bytes ?? null);
  } else {
    return { ...common, state: PROVIDER_STATE.PROVIDER_RESPONSE_INVALID, error: "COMPLETED without a media reference", provider_job_id: job.provider_job_id };
  }

  const persisted = persistVideoArtifact({
    bytes, name: built.native?.output_name || `${adapter.name}-${job.provider_job_id || "sync"}.mp4`,
    declaredMimeType: built.provider_declared_mime_type ?? media.mime_type ?? null,
    dir: artifactDir,
    artifactId: built.native?.artifact_id ?? `VID-${adapter.name}-${job.provider_job_id || "sync"}`,
    videoAssetId: request.metadata?.video_asset_id ?? null,
    fixtureId: request.metadata?.fixture_id ?? null,
    provider: adapter.name, requestedModel: request.model ?? null, returnedModel: job.returned_model ?? null,
    sourceUrl: video_url,
  });
  if (!persisted.ok) return { ...common, state: PROVIDER_STATE.VIDEO_ARTIFACT_INVALID, error: `artifact invalid: ${persisted.status}`, provider_job_id: job.provider_job_id, video_url };
  const conformance = videoConformance({ assetSpec: { width: request.width, height: request.height, aspect_ratio: request.aspect_ratio, duration_seconds: request.duration_seconds, fps: request.fps }, artifact: persisted.artifact });
  const out = normalizeVideoProviderResult(
    {
      state: PROVIDER_STATE.PROVIDER_SUCCESS, job, video_url,
      provider_declared_mime_type: built.provider_declared_mime_type ?? media.mime_type ?? null,
      negative_prompt: built.negative_prompt ?? request.negative_prompt ?? null,
      seed: media.seed ?? null, usage: media.usage ?? null, cost: media.cost ?? null, latency_ms: media.latency_ms ?? null,
      raw_metadata_ref: media.raw_metadata_ref ?? (job.provider_job_id ? `provider:job:${job.provider_job_id}` : null),
      unsupported_controls: common.unsupported_controls,
    },
    { provider: adapter.name, request, artifact: persisted.artifact, conformance, provider_prompt_sent: common.provider_prompt_sent, prompt_modified_by_adapter: common.prompt_modified_by_adapter },
  );
  return { ...common, ...out, state: PROVIDER_STATE.PROVIDER_SUCCESS, provider_job_id: job.provider_job_id, provider_status: job.provider_status, returned_model: job.returned_model, model_identity: job.model_identity, artifact: persisted.artifact, conformance, media: undefined };
}

/** Human-readable run record (no credentials, no headers). */
export function writeVideoProviderRunText(record = {}, dir = VIDEO_ARTIFACT_DIR) {
  mkdirSync(dir, { recursive: true });
  const a = record.artifact || {};
  const lines = [
    "VIDEO PROVIDER GENERATION RECORD", "",
    `provider: ${record.provider ?? "(none)"}`,
    `requested model: ${record.requested_model ?? "(none)"}`,
    `returned model: ${record.returned_model ?? "(none)"}`,
    `model identity: ${record.model_identity ?? "UNVERIFIED"}`,
    `provider job id: ${record.provider_job_id ?? "(none)"}`,
    `state: ${record.state ?? "(none)"}`, `provider status: ${record.provider_status ?? "(none)"}`, "",
    "CANONICAL PROMPT:", record.canonical_prompt ?? "(not recorded here)", "",
    "PROVIDER PROMPT SENT:", record.provider_prompt_sent ?? "(none)",
    `prompt modified by adapter: ${record.prompt_modified_by_adapter === null ? "(unknown)" : record.prompt_modified_by_adapter}`,
    `negative prompt: ${record.negative_prompt || "(none)"}`, "",
    `source image: ${record.source_image ?? "(none)"}`,
    `reference images: ${(record.reference_images && record.reference_images.length) ? record.reference_images.join(", ") : "(none)"}`, "",
    `requested geometry: ${a ? `${record.requested_width}x${record.requested_height} (${record.requested_aspect_ratio})` : "(none)"}`,
    `requested duration: ${record.requested_duration_seconds ?? "(none)"}`,
    `actual artifact geometry: ${a.actual_width ? `${a.actual_width}x${a.actual_height}` : "(none)"}`,
    `actual artifact duration: ${a.actual_duration_seconds ?? "(none)"}`, "",
    `artifact path: ${a.local_path ?? "(none)"}`,
    `artifact checksum: ${a.sha256 ?? "(none)"}`,
    `cost: ${record.cost == null ? "(not supplied by provider)" : JSON.stringify(record.cost)}`,
    "",
  ];
  const text = redactSecrets(lines.join("\n"));
  const path = join(dir, `${record.provider_job_id || record.artifact?.artifact_id || "provider-run"}-run.txt`);
  writeFileSync(path, text);
  return path;
}
