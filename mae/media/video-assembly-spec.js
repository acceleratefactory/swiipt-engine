// MAE media · Video Assembly Specification (Wave V-D).
// The generative video provider is NOT the final asset system: source video is media material and
// Swiipt owns message, typography, layout, CTA, logo, captions, safe zones, timing, poster frame,
// overlays, sequence and brand consistency. This module is the CONTRACT + deterministic validation
// for that assembly. It does not render (see video-assembler.js) and does not judge (see
// video-output-qa.js / video-assembly-qa.js).
//
// Reuses the image compositor's deterministic typography/layout vocabulary (layout.js): TOKENS,
// IMAGE_FITS, IMAGE_FOCALS, wrapText, resolveSafeArea.
import { createHash } from "node:crypto";
import { TOKENS, IMAGE_FITS, IMAGE_FOCALS, wrapText, resolveSafeArea } from "./layout.js";

export const ASSEMBLY_STATUS = Object.freeze({
  ASSEMBLY_READY: "ASSEMBLY_READY",
  ASSEMBLY_RENDERED: "ASSEMBLY_RENDERED",
  ASSEMBLY_FAILED: "ASSEMBLY_FAILED",
  SOURCE_REQUIRED: "SOURCE_REQUIRED",
  TEXT_OVERFLOW: "TEXT_OVERFLOW",
  INVALID_TIMELINE: "INVALID_TIMELINE",
  INVALID_LAYOUT: "INVALID_LAYOUT",
  ARTIFACT_VALIDATION_FAILED: "ARTIFACT_VALIDATION_FAILED",
});

export const PRODUCTION_MODES = Object.freeze([
  "SOURCE_VIDEO_ONLY", "VIDEO_WITH_OVERLAYS", "VIDEO_WITH_CAPTIONS",
  "IMAGE_TO_MOTION_ASSEMBLY", "MULTI_CLIP_SEQUENCE", "HYBRID",
]);

export const TIMELINE_ITEM_TYPES = Object.freeze(["VIDEO", "IMAGE", "TEXT", "LOGO", "CTA", "CAPTION", "OVERLAY"]);
export const AUDIO_MODES = Object.freeze(["NONE", "SOURCE", "EXTERNAL_TRACK"]);
export const TRANSITIONS = Object.freeze(["CUT", "FADE"]);
export const STILL_MOTION_TYPES = Object.freeze(["STATIC", "SLOW_ZOOM", "SLOW_PAN"]);
export const TEXT_ROLES = Object.freeze(["headline", "subheadline", "cta", "caption"]);

// Deterministic layer order (higher paints later). Explicit z-order is supported and validated.
export const LAYER_ORDER = Object.freeze({ background: 0, video: 10, image: 10, overlay: 20, caption: 30, headline: 40, subheadline: 41, cta: 50, logo: 60 });
export const layerZ = (item) => (typeof item.z === "number" ? item.z : (LAYER_ORDER[item.role] ?? LAYER_ORDER[String(item.type).toLowerCase()] ?? 10));
const VOLATILE = new Set(["generated_at", "created_at", "rendered_at", "evaluated_at", "timestamp"]);

const isObj = (v) => v != null && typeof v === "object" && !Array.isArray(v);
const num = (v) => typeof v === "number" && Number.isFinite(v);
const positive = (v) => num(v) && v > 0;

export const FITS = IMAGE_FITS;      // ["cover","contain"] — reused, not reinvented
export const FOCALS = IMAGE_FOCALS;  // ["center","top","bottom","left","right"]

/** Normalize: stable defaults, no invention of content. */
export function normalizeAssemblySpec(spec = {}) {
  const canvas = isObj(spec.canvas) ? spec.canvas : {};
  const width = canvas.width, height = canvas.height;
  return {
    assembly_id: spec.assembly_id ?? null,
    video_asset_id: spec.video_asset_id ?? null,
    production_mode: spec.production_mode ?? null,
    source_artifacts: Array.isArray(spec.source_artifacts) ? spec.source_artifacts : [],
    platform: spec.platform ?? null,
    placement: spec.placement ?? null,
    canvas: { width, height, aspect_ratio: canvas.aspect_ratio ?? (positive(width) && positive(height) ? `${width}:${height}` : null), fps: canvas.fps ?? null, duration_seconds: canvas.duration_seconds ?? null },
    background: spec.background ?? { mode: "SOLID", color: TOKENS.navy },
    timeline: Array.isArray(spec.timeline) ? spec.timeline : [],
    audio: spec.audio ?? { mode: "NONE", volume: null, ref: null },
    captions: Array.isArray(spec.captions) ? spec.captions : [],
    logo: spec.logo ?? null,
    safe_zones: Array.isArray(spec.safe_zones) ? spec.safe_zones : [],
    poster_frame: spec.poster_frame ?? null,
    output: spec.output ?? { format: "mp4" },
    brand_rules: spec.brand_rules ?? {},
    source_provenance: spec.source_provenance ?? {},
    forbid_overlaps: spec.forbid_overlaps !== false,
  };
}

function timelineErrors(timeline, duration) {
  const errors = [];
  const seen = new Set();
  for (const it of timeline) {
    const id = it?.item_id ?? "(no item_id)";
    if (!isObj(it)) { errors.push("timeline item must be an object"); continue; }
    if (!it.item_id) errors.push("timeline item missing item_id");
    else if (seen.has(it.item_id)) errors.push(`duplicate item_id: ${it.item_id}`);
    else seen.add(it.item_id);
    if (!TIMELINE_ITEM_TYPES.includes(it.type)) errors.push(`${id}: unsupported layer type "${it.type}"`);
    if (!num(it.start_time)) errors.push(`${id}: negative or missing start time`);
    else if (it.start_time < 0) errors.push(`${id}: negative start time`);
    if (!num(it.end_time)) errors.push(`${id}: missing end time`);
    else if (num(it.start_time) && it.end_time <= it.start_time) errors.push(`${id}: end before start`);
    if (num(it.end_time) && positive(duration) && it.end_time > duration + 1e-6) errors.push(`${id}: item beyond total duration`);
    if (it.opacity != null && (!num(it.opacity) || it.opacity < 0 || it.opacity > 1)) errors.push(`${id}: invalid opacity`);
    if (it.position && isObj(it.position)) {
      if (it.position.fit != null && !FITS.includes(it.position.fit)) errors.push(`${id}: invalid fit "${it.position.fit}"`);
      if (it.position.focal != null && !FOCALS.includes(it.position.focal)) errors.push(`${id}: invalid focal "${it.position.focal}"`);
      for (const k of ["x", "y", "width", "height"]) if (it.position[k] != null && !num(it.position[k])) errors.push(`${id}: invalid geometry ${k}`);
    }
    if ((it.type === "VIDEO" || it.type === "IMAGE") && !(it.source && typeof it.source.ref === "string" && it.source.ref)) errors.push(`${id}: missing source reference`);
    if (it.type === "TEXT" || it.type === "CTA" || it.type === "CAPTION") {
      if (!isObj(it.text) || typeof it.text.value !== "string" || !it.text.value.length) errors.push(`${id}: requires supplied approved text`);
      if (it.type === "CAPTION" && it.text && typeof it.text.value === "string") {
        if (!num(it.start_time) || !num(it.end_time) || it.end_time <= it.start_time) errors.push(`${id}: caption requires valid timing`);
      }
      if (it.text && it.text.generated === true) errors.push(`${id}: captions/text must come from approved input, not generation`);
    }
  }
  if (duration > 0) {
    for (const c of arguments[2] || []) {
      if (!num(c.start_time) || !num(c.end_time) || c.end_time <= c.start_time) errors.push(`caption ${c.caption_id || "?"}: invalid timing`);
      else if (c.end_time > duration + 1e-6) errors.push(`caption ${c.caption_id || "?"}: outside timeline`);
      if (typeof c.text !== "string" || !c.text.length) errors.push(`caption ${c.caption_id || "?"}: requires supplied text`);
    }
  }
  return errors;
}

/** Full deterministic spec validation. Never silently corrects. */
export function validateAssemblySpec(rawSpec = {}) {
  const spec = normalizeAssemblySpec(rawSpec);
  const errors = [];
  const warnings = [];
  const c = spec.canvas;

  if (!spec.assembly_id) errors.push("missing assembly_id");
  if (!PRODUCTION_MODES.includes(spec.production_mode)) errors.push(`unsupported production_mode "${spec.production_mode}"`);
  if (!positive(c.width) || !positive(c.height)) errors.push("canvas requires positive width and height");
  if (!positive(c.duration_seconds)) errors.push("canvas requires positive duration_seconds");
  if (!positive(c.fps)) errors.push("canvas requires positive fps");
  if (!spec.timeline.length) errors.push("timeline is empty");
  if (!AUDIO_MODES.includes(spec.audio?.mode)) errors.push(`unsupported audio mode "${spec.audio?.mode}"`);
  if (spec.audio?.mode === "EXTERNAL_TRACK" && !spec.audio.ref) errors.push("EXTERNAL_TRACK requires a supplied approved audio artifact reference");
  if (spec.audio?.volume != null && !(num(spec.audio.volume) && spec.audio.volume >= 0 && spec.audio.volume <= 2)) errors.push("audio volume must be between 0 and 2");
  if (spec.poster_frame) {
    if (!num(spec.poster_frame.timestamp) && !spec.poster_frame.source_image) errors.push("poster_frame requires an explicit timestamp or source image");
  }
  if (spec.production_mode === "SOURCE_VIDEO_ONLY" && spec.timeline.some((i) => ["TEXT", "CTA", "CAPTION", "LOGO"].includes(i.type))) errors.push("SOURCE_VIDEO_ONLY must not contain typography layers");
  if (spec.production_mode === "MULTI_CLIP_SEQUENCE") {
    const clips = spec.timeline.filter((i) => i.type === "VIDEO");
    if (clips.length < 2) errors.push("MULTI_CLIP_SEQUENCE requires at least 2 VIDEO clips");
    for (const it of spec.timeline) if (it.transition != null && !TRANSITIONS.includes(it.transition?.type)) errors.push(`${it.item_id}: unsupported transition "${it.transition?.type}"`);
  }
  if (spec.production_mode === "IMAGE_TO_MOTION_ASSEMBLY") {
    for (const it of spec.timeline.filter((i) => i.type === "IMAGE")) {
      const m = it.motion;
      if (m && !STILL_MOTION_TYPES.includes(m.type)) errors.push(`${it.item_id}: unsupported still motion "${m.type}"`);
      if (m && m.type === "SLOW_ZOOM" && (!num(m.start_scale) || !num(m.end_scale))) errors.push(`${it.item_id}: SLOW_ZOOM requires explicit start_scale/end_scale`);
    }
    if (!spec.timeline.some((i) => i.type === "IMAGE")) errors.push("IMAGE_TO_MOTION_ASSEMBLY requires an IMAGE item");
  }

  errors.push(...timelineErrors(spec.timeline, c.duration_seconds, spec.captions));

  // overlap policy (same z-layer, time overlap) — explicit, optional
  if (spec.forbid_overlaps) {
    const items = [...spec.timeline].sort((a, b) => layerZ(a) - layerZ(b) || a.start_time - b.start_time);
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      if (layerZ(items[i]) !== layerZ(items[j])) continue;
      if (items[i].start_time < items[j].end_time - 1e-6 && items[j].start_time < items[i].end_time - 1e-6) errors.push(`overlap violation: ${items[i].item_id} and ${items[j].item_id} share layer time`);
    }
  }

  // deterministic text overflow (no clipping, no shrinking, no rewriting)
  const overflow = [];
  for (const it of spec.timeline) {
    if (!["TEXT", "CTA", "CAPTION"].includes(it.type)) continue;
    const box = it.position || {};
    const maxWidth = positive(box.width) ? box.width : (positive(c.width) ? Math.round(c.width * 0.86) : null);
    const size = positive(it.text?.size) ? it.text.size : 44;
    const lh = positive(it.text?.line_height) ? it.text.line_height : Math.round(size * 1.28);
    if (!positive(maxWidth)) continue;
    const chars = Math.max(8, Math.floor(maxWidth / (size * 0.52)));
    const lines = wrapText(it.text.value, chars).length;
    const required = lines * lh;
    const maxHeight = positive(box.height) ? box.height : null;
    if (maxHeight && required > maxHeight) overflow.push({ item_id: it.item_id, lines, required_height: required, box_height: maxHeight });
  }
  if (overflow.length) errors.push(`TEXT_OVERFLOW: ${overflow.map((o) => o.item_id).join(", ")}`);

  if (!spec.logo && spec.timeline.some((i) => i.type === "LOGO")) warnings.push("logo layer present without logo block");
  if (!spec.safe_zones.length) warnings.push("no safe zones defined");

  return { valid: errors.length === 0, errors, warnings, normalized: spec, overflow };
}

/** Canonical, volatile-free serialization used for the assembly-spec hash. */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value).sort()) { if (VOLATILE.has(k)) continue; out[k] = canonical(value[k]); }
    return out;
  }
  return value;
}
export function assemblySpecHash(spec = {}) {
  return createHash("sha256").update(JSON.stringify(canonical(normalizeAssemblySpec(spec)))).digest("hex");
}

/** Deterministic safe-zone resolution (delegates to the image compositor's convention). */
export function assemblySafeAreas(spec) {
  const s = normalizeAssemblySpec(spec);
  return { resolved: resolveSafeArea({ safe_area: s.safe_zones }, s.canvas), zones: s.safe_zones };
}

/** Deterministic typography layer set (SVG) — Swiipt owns text; nothing is provider-rendered. */
export function buildTextLayers(spec) {
  const s = normalizeAssemblySpec(spec);
  const layers = [];
  for (const it of s.timeline.filter((i) => ["TEXT", "CTA", "CAPTION", "LOGO"].includes(i.type))) {
    const t = it.text || {};
    const value = it.type === "LOGO" ? (t.value || "Swiipt") : (t.value || "");
    layers.push({
      item_id: it.item_id, type: it.type, role: it.role ?? String(it.type).toLowerCase(), z: layerZ(it),
      value, font: t.font ?? (it.type === "LOGO" || it.role === "headline" ? "dm-serif-display" : "inter"),
      size: t.size ?? 44, weight: t.weight ?? (it.role === "headline" ? 700 : 500),
      line_height: t.line_height ?? Math.round((t.size ?? 44) * 1.28), align: t.align ?? "left",
      max_width: it.position?.width ?? null, color: t.color ?? (it.type === "CTA" ? TOKENS.white : TOKENS.cream),
      background: it.role === "cta" ? (t.background ?? TOKENS.purple) : null,
      start_time: it.start_time, end_time: it.end_time,
      svg: `<text data-role="${it.role || String(it.type).toLowerCase()}" data-font="${t.font || "inter"}" font-size="${t.size ?? 44}" fill="${t.color ?? TOKENS.cream}">${escapeXml(value)}</text>`,
    });
  }
  return layers.sort((a, b) => a.z - b.z || a.item_id.localeCompare(b.item_id));
}
const escapeXml = (s) => String(s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]));
