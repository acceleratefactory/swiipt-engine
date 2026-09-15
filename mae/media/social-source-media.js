// MAE media · Social Design Production — SOURCE MEDIA integration (Wave S-F).
// Connects APPROVED source media (existing Image Production artifacts, supplied photos, product images,
// illustrations, already-resolved video-frame artifacts, synthetic fixtures) to deterministic social
// design compositions.
//
// This is NOT an image-generation engine, NOT a frame-extraction engine, NOT a DAM.
// Source media owns imagery; Social Design owns typography/layout/brand. Media NEVER authorizes evidence.
// Reuses: image-provider MIME/dimension detection + ratio helpers, layout.computeImageBox fit/focal
// geometry, <image> SVG embedding (existing S-B ImageSlot behaviour). No fetching, no ffmpeg, no OCR.
import { createHash } from "node:crypto";
import { detectImageMime, readImageDimensions, isLikelyImage, compareAspectRatio } from "./image-provider.js";
import { computeImageBox, IMAGE_FITS, IMAGE_FOCALS } from "./layout.js";

export const SOCIAL_SOURCE_MEDIA_VERSION = "1.0";
export const SOURCE_TYPES = Object.freeze(["IMAGE_ARTIFACT", "SUPPLIED_IMAGE", "PRODUCT_IMAGE", "ILLUSTRATION", "VIDEO_FRAME_ARTIFACT", "SYNTHETIC_FIXTURE"]);
export const SOURCE_MEDIA_STATUS = Object.freeze({
  READY: "READY",
  SOURCE_REQUIRED: "SOURCE_REQUIRED",
  INVALID_VISUAL_SLOT: "INVALID_VISUAL_SLOT",
  DUPLICATE_VISUAL_SLOT_BINDING: "DUPLICATE_VISUAL_SLOT_BINDING",
  UNSUPPORTED_MEDIA_TYPE: "UNSUPPORTED_MEDIA_TYPE",
  INVALID_MEDIA_DIMENSIONS: "INVALID_MEDIA_DIMENSIONS",
  SOURCE_METADATA_REQUIRED: "SOURCE_METADATA_REQUIRED",
  SOURCE_MODE_MISMATCH: "SOURCE_MODE_MISMATCH",
});
// MIME policy is the existing image subsystem's policy (PNG/JPEG/WEBP/SVG) — not a new policy.
export const SUPPORTED_MEDIA_TYPES = Object.freeze(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
export const FITS = IMAGE_FITS;
export const FOCALS = IMAGE_FOCALS;

// PART 37 — production mode ↔ source-type compatibility.
export const MODE_SOURCE_COMPATIBILITY = Object.freeze({
  DETERMINISTIC_TYPE_ONLY: Object.freeze([]),                                  // media not required (and not expected)
  DETERMINISTIC_GRAPHIC: Object.freeze([]),
  PHOTO_PLUS_TYPE: Object.freeze(["IMAGE_ARTIFACT", "SUPPLIED_IMAGE", "SYNTHETIC_FIXTURE", "VIDEO_FRAME_ARTIFACT"]),
  ILLUSTRATION_PLUS_TYPE: Object.freeze(["ILLUSTRATION", "SYNTHETIC_FIXTURE"]),
  PRODUCT_VISUAL_PLUS_LAYOUT: Object.freeze(["PRODUCT_IMAGE", "SYNTHETIC_FIXTURE"]),
  DATA_VISUAL: Object.freeze([]),
});

const isObj = (v) => v != null && typeof v === "object" && !Array.isArray(v);
const nonEmpty = (v) => typeof v === "string" && v.length > 0;
const positive = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** Stable deterministic id (never time/random based). */
export function sourceMediaId({ source_type, artifact_id = null, checksum = null, uri = null, video_artifact_id = null, frame_timestamp = null } = {}) {
  const seed = [source_type, artifact_id ?? "", checksum ?? "", uri ?? "", video_artifact_id ?? "", frame_timestamp ?? ""].join("|");
  return `SM-${source_type}-${sha256(Buffer.from(seed)).slice(0, 12)}`;
}

/** PART 6/7 — deterministic normalization + validation. Bytes (when supplied) are authoritative. */
export function normalizeSocialSourceMedia(input = {}) {
  const errors = [];
  const warnings = [];
  const source_type = input.source_type ?? (isObj(input.provenance) && input.provenance.source_classification) ?? null;
  if (!SOURCE_TYPES.includes(source_type)) return { ok: false, status: SOURCE_MEDIA_STATUS.SOURCE_METADATA_REQUIRED, source: null, errors: [`unknown source_type "${source_type}"`], warnings };

  let mime = input.mime ?? null;
  let width = input.width ?? null;
  let height = input.height ?? null;
  let checksum = input.checksum ?? null;
  let bytes = Buffer.isBuffer(input.bytes) ? input.bytes : null;
  let uri = input.uri ?? input.data_uri ?? input.path ?? null;

  if (bytes) {
    const detected = detectImageMime(bytes);
    if (!detected) errors.push("bytes are not a recognisable image");
    else if (!isLikelyImage(bytes, detected)) errors.push(`bytes do not look like ${detected}`);
    mime = detected ?? mime;                                    // bytes > declared metadata
    const dims = readImageDimensions(bytes, mime);
    if (dims && positive(dims.width) && positive(dims.height)) { width = dims.width; height = dims.height; }
    checksum = sha256(bytes);
    if (!uri) uri = `data:${mime};base64,${bytes.toString("base64")}`;
  }

  const provenance = { ...(isObj(input.provenance) ? input.provenance : {}) };
  const synthetic = input.synthetic === true || provenance.synthetic === true || provenance._fixture_origin === "synthetic" || source_type === "SYNTHETIC_FIXTURE";
  // generated status comes only from authoritative provenance — never inferred from names/models
  const generated = provenance.generated === true;

  if (synthetic) provenance.synthetic = true;
  if (generated) provenance.generated = true;

  if (!MODE_SOURCE_COMPATIBILITY) errors.push("unreachable");
  if (mime == null) errors.push("mime is required (supply bytes or authoritative metadata)");
  else if (!SUPPORTED_MEDIA_TYPES.includes(mime)) return { ok: false, status: SOURCE_MEDIA_STATUS.UNSUPPORTED_MEDIA_TYPE, source: null, errors: [`unsupported media type "${mime}"`], warnings };
  if (width == null || height == null) return { ok: false, status: SOURCE_MEDIA_STATUS.SOURCE_METADATA_REQUIRED, source: null, errors: [...errors, "width and height are required (never guessed from filename/request/platform)"], warnings };
  if (!positive(width) || !positive(height)) return { ok: false, status: SOURCE_MEDIA_STATUS.INVALID_MEDIA_DIMENSIONS, source: null, errors: [`invalid media dimensions ${width}x${height}`], warnings };
  if (errors.length) return { ok: false, status: SOURCE_MEDIA_STATUS.SOURCE_METADATA_REQUIRED, source: null, errors, warnings };
  if (checksum == null) warnings.push("no checksum supplied — source identity will be weaker (metadata-only reference)");

  const artifact_id = input.artifact_id ?? input.artifact_ref ?? provenance.artifact_id ?? null;
  const source = Object.freeze({
    source_media_id: input.source_media_id ?? sourceMediaId({ source_type, artifact_id, checksum, uri, video_artifact_id: input.video_artifact_id ?? null, frame_timestamp: input.frame_timestamp ?? null }),
    source_type,
    artifact_ref: artifact_id,
    artifact_id,
    uri,
    mime,
    width,
    height,
    aspect_ratio: `${width}:${height}`,
    checksum,
    focal: input.focal ?? provenance.focal ?? "center",
    fit: input.fit ?? "cover",
    generated,
    synthetic,
    source_classification: input.source_classification ?? provenance.source_classification ?? (generated ? "generated" : "supplied"),
    provenance: Object.freeze({
      ...provenance,
      provider: provenance.provider ?? null,
      model: provenance.model ?? null,
      artifact_id,
      visual_grounding_id: provenance.visual_grounding_id ?? null,
      prompt_record_ref: provenance.prompt_record_ref ?? null,
      video_artifact_id: input.video_artifact_id ?? provenance.video_artifact_id ?? null,
      frame_timestamp: input.frame_timestamp ?? provenance.frame_timestamp ?? null,
      derived_frame_artifact_id: input.derived_frame_artifact_id ?? provenance.derived_frame_artifact_id ?? null,
      synthetic,
      generated,
      metadata_source: bytes ? "bytes" : "declared",
    }),
  });
  return { ok: true, status: SOURCE_MEDIA_STATUS.READY, source, errors, warnings };
}

/** PART 7 — validate a normalized/declared source record. */
export function validateSourceMedia(source = {}) {
  const errors = [];
  if (!isObj(source)) return { valid: false, status: SOURCE_MEDIA_STATUS.SOURCE_METADATA_REQUIRED, errors: ["source must be an object"] };
  if (!SOURCE_TYPES.includes(source.source_type)) errors.push(`unknown source_type "${source.source_type}"`);
  if (!SUPPORTED_MEDIA_TYPES.includes(source.mime)) errors.push(`unsupported media type "${source.mime}"`);
  if (!positive(source.width) || !positive(source.height)) errors.push("invalid media dimensions");
  if (source.aspect_ratio && source.width && source.height) {
    const c = compareAspectRatio(source.aspect_ratio, `${source.width}:${source.height}`);
    if (c.match === false) errors.push("aspect_ratio inconsistent with width:height");
  }
  if (source.fit != null && !FITS.includes(source.fit)) errors.push(`unknown fit "${source.fit}"`);
  if (source.focal != null && !FOCALS.includes(source.focal)) errors.push(`unknown focal "${source.focal}"`);
  return { valid: errors.length === 0, status: errors.length ? SOURCE_MEDIA_STATUS.SOURCE_METADATA_REQUIRED : SOURCE_MEDIA_STATUS.READY, errors };
}

/** PART 37 — mode/source compatibility. */
export function isModeSourceCompatible(production_mode, source_type) {
  const allowed = MODE_SOURCE_COMPATIBILITY[production_mode];
  if (allowed == null) return false;
  if (allowed.length === 0) return true;                 // type-only / graphic / data modes accept no media burden
  return allowed.includes(source_type);
}

/**
 * PART 17/19/20 — deterministic slot → source resolution from already-known artifacts.
 * Binding is EXPLICIT (registry `slot_id`, or the slot's own `source` ref) — never array order.
 */
export function resolveSocialSourceMedia({ design_spec = {}, source_media_registry = [], mode = null } = {}) {
  const production_mode = mode ?? design_spec.production_mode ?? null;
  const slots = design_spec.visual_slots || [];
  const slotIds = slots.map((s) => s.slot_id);
  const errors = [];
  const warnings = [];
  const bindings = [];
  const sources = {};

  // normalize the registry (accepts raw inputs or normalized sources)
  const entries = (Array.isArray(source_media_registry) ? source_media_registry : []).map((e) => {
    const n = e && e.source_media_id && e.mime ? { ok: true, source: e } : normalizeSocialSourceMedia(e);
    return { slot_id: e?.slot_id ?? null, ref: e?.artifact_id ?? e?.source_media_id ?? null, result: n };
  });
  for (const e of entries) if (!e.result.ok && e.result.status !== SOURCE_MEDIA_STATUS.SOURCE_METADATA_REQUIRED) {
    errors.push({ status: e.result.status, detail: e.result.errors });
  }

  for (const slot of slots) {
    if (!nonEmpty(slot.slot_id)) { errors.push({ status: SOURCE_MEDIA_STATUS.INVALID_VISUAL_SLOT, detail: ["slot_id required"] }); continue; }
    const declaredRef = slot.source?.artifact_id ?? slot.source?.source_media_id ?? null;
    const chosen = entries.filter((e) => (e.slot_id != null && e.slot_id === slot.slot_id) || (e.slot_id == null && declaredRef != null && e.ref === declaredRef));
    if (chosen.length > 1) { errors.push({ status: SOURCE_MEDIA_STATUS.DUPLICATE_VISUAL_SLOT_BINDING, detail: [slot.slot_id] }); continue; }
    const entry = chosen[0] ?? null;
    const required = slot.required === true;
    if (!entry) {
      if (required) errors.push({ status: SOURCE_MEDIA_STATUS.SOURCE_REQUIRED, detail: [slot.slot_id] });
      else warnings.push(`optional slot "${slot.slot_id}" has no source (composition proceeds without media)`);
      continue;
    }
    if (!entry.result.ok) {
      errors.push({ status: entry.result.status === SOURCE_MEDIA_STATUS.READY ? SOURCE_MEDIA_STATUS.SOURCE_METADATA_REQUIRED : entry.result.status, detail: [slot.slot_id, ...entry.result.errors] });
      continue;
    }
    const source = entry.result.source;
    if (production_mode && !isModeSourceCompatible(production_mode, source.source_type)) {
      errors.push({ status: SOURCE_MEDIA_STATUS.SOURCE_MODE_MISMATCH, detail: [slot.slot_id, `${source.source_type} not allowed by ${production_mode}`] });
      continue;
    }
    const binding = Object.freeze({
      slot_id: slot.slot_id,
      source_media_id: source.source_media_id,
      source,
      fit: slot.fit ?? source.fit ?? "cover",
      focal: slot.focal ?? source.focal ?? "center",
      opacity: isObj(slot) && typeof slot.opacity === "number" ? slot.opacity : 1,
      crop: slot.crop ?? null,
      required,
      treatment: slot.treatment ?? "none",
    });
    bindings.push(binding);
    sources[slot.slot_id] = source;
  }

  // declared-but-unknown slot references are rejected (never silently bound by order)
  for (const e of entries) if (e.slot_id != null && !slotIds.includes(e.slot_id)) errors.push({ status: SOURCE_MEDIA_STATUS.INVALID_VISUAL_SLOT, detail: [e.slot_id] });

  const PRECEDENCE = [SOURCE_MEDIA_STATUS.DUPLICATE_VISUAL_SLOT_BINDING, SOURCE_MEDIA_STATUS.INVALID_VISUAL_SLOT, SOURCE_MEDIA_STATUS.UNSUPPORTED_MEDIA_TYPE, SOURCE_MEDIA_STATUS.INVALID_MEDIA_DIMENSIONS, SOURCE_MEDIA_STATUS.SOURCE_METADATA_REQUIRED, SOURCE_MEDIA_STATUS.SOURCE_MODE_MISMATCH, SOURCE_MEDIA_STATUS.SOURCE_REQUIRED];
  const status = errors.length ? (PRECEDENCE.find((s) => errors.some((e) => e.status === s)) ?? errors[0].status) : SOURCE_MEDIA_STATUS.READY;
  return { status, bindings: Object.freeze(bindings), sources: Object.freeze(sources), errors, warnings };
}

/** PART 21/22/23 — deterministic placement geometry (reuses the existing fit/focal mathematics). */
export function sourceMediaPlacement({ source = {}, box = {}, fit = null, focal = null } = {}) {
  const f = fit ?? source.fit ?? "cover";
  const fo = focal ?? source.focal ?? "center";
  if (!positive(source.width) || !positive(source.height)) return { ok: false, status: SOURCE_MEDIA_STATUS.INVALID_MEDIA_DIMENSIONS, placement: null };
  if (!FITS.includes(f) || !FOCALS.includes(fo)) return { ok: false, status: SOURCE_MEDIA_STATUS.SOURCE_METADATA_REQUIRED, placement: null };
  const placement = computeImageBox(source.width, source.height, { x: box.x ?? 0, y: box.y ?? 0, w: box.width, h: box.height }, f, fo);
  return { ok: true, status: SOURCE_MEDIA_STATUS.READY, placement: { ...placement, fit: f, focal: fo } };
}

/** PART 45 — traceable media provenance for the composition (refs only, no payload duplication). */
export function sourceMediaProvenance(bindings = []) {
  return bindings.map((b) => ({
    slot_id: b.slot_id,
    source_media_id: b.source.source_media_id,
    source_type: b.source.source_type,
    artifact_id: b.source.artifact_id,
    checksum: b.source.checksum,
    mime: b.source.mime,
    width: b.source.width,
    height: b.source.height,
    generated: b.source.generated === true,
    synthetic: b.source.synthetic === true,
    source_classification: b.source.source_classification,
    visual_grounding_id: b.source.provenance.visual_grounding_id ?? null,
    prompt_record_ref: b.source.provenance.prompt_record_ref ?? null,
    video_artifact_id: b.source.provenance.video_artifact_id ?? null,
    frame_timestamp: b.source.provenance.frame_timestamp ?? null,
    provider: b.source.provenance.provider ?? null,
    model: b.source.provenance.model ?? null,
  }));
}

/** Which source media types can carry generated imagery (used by S-E to activate imagery dimensions). */
export function hasGeneratedMedia(bindings = []) { return bindings.some((b) => b.source.generated === true); }
export function hasSyntheticMedia(bindings = []) { return bindings.some((b) => b.source.synthetic === true); }

/**
 * PART 50 — PERMANENT RULE: a media artifact used for design is NOT evidence.
 * customer-looking photo ≠ testimonial proof · product image ≠ outcome proof · generated before/after ≠ evidence.
 */
export function mediaAuthorizesEvidence() { return false; }
