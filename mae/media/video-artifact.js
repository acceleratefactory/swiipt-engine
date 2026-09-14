// MAE media · VIDEO artifact persistence + mechanical validation (Wave V-B).
// The persisted artifact is authoritative; provider metadata is useful but not trusted blindly.
// Pure-JS ISO-BMFF (MP4) inspection — no provider, no network, no external binary required.
// (ffprobe exists locally but is deliberately NOT wired here to keep extraction deterministic and
// portable; it can be added later as an optional enrichment.)
//
// This wave is MECHANICAL only: no motion/identity/camera/emotional/cultural judgment (Wave V-C).
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { MAE_DIR } from "../lib/store.js";
import { compareAspectRatio, ASPECT_RATIO_TOLERANCE } from "./image-provider.js";

export const VIDEO_ARTIFACT_STATUS = Object.freeze({
  VIDEO_ARTIFACT_VALID: "VIDEO_ARTIFACT_VALID",
  VIDEO_ARTIFACT_INVALID: "VIDEO_ARTIFACT_INVALID",
  VIDEO_ARTIFACT_MISSING: "VIDEO_ARTIFACT_MISSING",
  VIDEO_ARTIFACT_EMPTY: "VIDEO_ARTIFACT_EMPTY",
  VIDEO_CONTAINER_UNREADABLE: "VIDEO_CONTAINER_UNREADABLE",
  VIDEO_STREAM_MISSING: "VIDEO_STREAM_MISSING",
  VIDEO_METADATA_UNAVAILABLE: "VIDEO_METADATA_UNAVAILABLE",
  VIDEO_PERSISTENCE_FAILED: "VIDEO_PERSISTENCE_FAILED",
});

export const VIDEO_CONFORMANCE = Object.freeze({
  GEOMETRY_MATCH: "GEOMETRY_MATCH",
  GEOMETRY_MISMATCH: "GEOMETRY_MISMATCH",
  DURATION_MATCH: "DURATION_MATCH",
  DURATION_MISMATCH: "DURATION_MISMATCH",
});

export const DURATION_TOLERANCE_SECONDS = 0.5;
export const VIDEO_ARTIFACT_DIR = join(MAE_DIR, "storage", "work", "video");

// ---------- byte / container detection ---------------------------------------
export function detectVideoMime(bytes) {
  if (!bytes || bytes.length < 12) return null;
  if (bytes.slice(4, 8).toString("ascii") === "ftyp") return "video/mp4";
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "video/webm";
  return null;
}
export function extensionForVideoMime(mime) {
  return mime === "video/mp4" ? ".mp4" : mime === "video/webm" ? ".webm" : ".bin";
}
export function withDetectedVideoExtension(name, mime) {
  const s = String(name || "video");
  const dot = s.lastIndexOf(".");
  return (dot > 0 ? s.slice(0, dot) : s) + extensionForVideoMime(mime);
}

// ---------- minimal ISO-BMFF walker ------------------------------------------
function walkBoxes(buf, start, end, visit) {
  let off = start;
  while (off + 8 <= end) {
    let size = buf.readUInt32BE(off);
    const type = buf.slice(off + 4, off + 8).toString("ascii");
    let header = 8;
    if (size === 1) { if (off + 16 > end) return false; size = Number(buf.readBigUInt64BE(off + 8)); header = 16; }
    else if (size === 0) size = end - off;
    if (size < header || off + size > end) return false; // inconsistent box → unreadable
    visit(type, off + header, off + size, size - header);
    off += size;
  }
  return off === end || off <= end;
}

/**
 * Inspect MP4 bytes. Returns { readable, container_format, width, height, duration_seconds,
 * audio_stream_present, video_stream_present, codec } with honest nulls where unavailable.
 */
export function inspectMp4(bytes) {
  const out = { readable: false, container_format: null, width: null, height: null, duration_seconds: null, audio_stream_present: false, video_stream_present: false, codec: null, major_brand: null };
  if (!bytes || bytes.length < 16) return out;
  if (bytes.slice(4, 8).toString("ascii") !== "ftyp") return out;
  const brand = bytes.slice(8, 12).toString("ascii");
  out.major_brand = brand || null;

  let mvhdTimescale = null, mvhdDuration = null;
  const ok = walkBoxes(bytes, 0, bytes.length, (type, ps, pe) => {
    if (type !== "moov") return;
    walkBoxes(bytes, ps, pe, (t2, s2, e2) => {
      if (t2 === "mvhd") {
        // v0 payload: fullbox(4) creation(4) mod(4) timescale(4)@12 duration(4)@16
        if (e2 - s2 >= 20) { mvhdTimescale = bytes.readUInt32BE(s2 + 12); mvhdDuration = bytes.readUInt32BE(s2 + 16); }
      } else if (t2 === "trak") {
        let handler = null; let trackW = null, trackH = null;
        walkBoxes(bytes, s2, e2, (t3, s3, e3) => {
          if (t3 === "tkhd") {
            if (e3 - s3 >= 8) { trackW = bytes.readUInt32BE(e3 - 8) / 65536; trackH = bytes.readUInt32BE(e3 - 4) / 65536; }
          } else if (t3 === "mdia") {
            walkBoxes(bytes, s3, e3, (t4, s4, e4) => {
              if (t4 === "hdlr" && e4 - s4 >= 12) handler = bytes.slice(s4 + 8, s4 + 12).toString("ascii");
            });
          }
        });
        if (handler === "vide") {
          out.video_stream_present = true;
          if (trackW && trackH) { out.width = Math.round(trackW); out.height = Math.round(trackH); }
        } else if (handler === "soun") out.audio_stream_present = true;
      }
    });
  });
  if (!ok) return { ...out, readable: false };
  out.readable = true;
  out.container_format = "mp4";
  if (mvhdTimescale && mvhdDuration != null) out.duration_seconds = mvhdDuration / mvhdTimescale;
  for (const c of ["avc1", "hvc1", "hev1", "vp09", "av01"]) if (bytes.includes(Buffer.from(c))) { out.codec = c; break; }
  return out;
}

/** Validate bytes. Status is honest and precise; never claims validity from an extension alone. */
export function validateVideoBytes(bytes) {
  if (bytes == null) return { status: VIDEO_ARTIFACT_STATUS.VIDEO_ARTIFACT_MISSING, inspection: null };
  if (bytes.length === 0) return { status: VIDEO_ARTIFACT_STATUS.VIDEO_ARTIFACT_EMPTY, inspection: null };
  const mime = detectVideoMime(bytes);
  if (mime !== "video/mp4") return { status: VIDEO_ARTIFACT_STATUS.VIDEO_CONTAINER_UNREADABLE, inspection: null };
  const insp = inspectMp4(bytes);
  if (!insp.readable) return { status: VIDEO_ARTIFACT_STATUS.VIDEO_CONTAINER_UNREADABLE, inspection: insp };
  if (!insp.video_stream_present) return { status: VIDEO_ARTIFACT_STATUS.VIDEO_STREAM_MISSING, inspection: insp };
  if (!insp.width || !insp.height || insp.duration_seconds == null) return { status: VIDEO_ARTIFACT_STATUS.VIDEO_METADATA_UNAVAILABLE, inspection: insp };
  return { status: VIDEO_ARTIFACT_STATUS.VIDEO_ARTIFACT_VALID, inspection: insp };
}

// ---------- persistence -------------------------------------------------------
export function persistVideoArtifact({ bytes = null, name = "video.mp4", declaredMimeType = null, dir = VIDEO_ARTIFACT_DIR, artifactId = null, videoAssetId = null, fixtureId = null, provider = null, requestedModel = null, returnedModel = null, sourceUrl = null } = {}) {
  const v = validateVideoBytes(bytes);
  const base = { artifact_id: artifactId, video_asset_id: videoAssetId, fixture_id: fixtureId, provider, requested_model: requestedModel, returned_model: returnedModel, source_url: sourceUrl, provider_declared_mime_type: declaredMimeType ? String(declaredMimeType).toLowerCase() : null };
  if (v.status !== VIDEO_ARTIFACT_STATUS.VIDEO_ARTIFACT_VALID) return { ok: false, status: v.status, inspection: v.inspection, artifact: null, ...base };

  const detected = detectVideoMime(bytes);
  const mime = detected || (declaredMimeType ? String(declaredMimeType).toLowerCase() : "video/mp4");
  const finalName = withDetectedVideoExtension(name, mime);
  mkdirSync(dir, { recursive: true });
  const localPath = join(dir, finalName);
  try { writeFileSync(localPath, bytes); } catch { return { ok: false, status: VIDEO_ARTIFACT_STATUS.VIDEO_PERSISTENCE_FAILED, inspection: v.inspection, artifact: null, ...base }; }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const artifact = {
    ...base,
    local_path: localPath,
    mime_type: mime,
    detected_mime_type: detected,
    mime_type_match: base.provider_declared_mime_type == null ? null : (base.provider_declared_mime_type === mime),
    file_extension: extensionForVideoMime(mime),
    file_size_bytes: bytes.length,
    sha256,
    actual_width: v.inspection.width,
    actual_height: v.inspection.height,
    actual_aspect_ratio: v.inspection.width && v.inspection.height ? `${v.inspection.width}:${v.inspection.height}` : null,
    actual_duration_seconds: v.inspection.duration_seconds,
    actual_fps: null, // not reliably available from a minimal container walk
    audio_stream_present: v.inspection.audio_stream_present,
    video_stream_present: v.inspection.video_stream_present,
    container_format: v.inspection.container_format,
    codec_name: v.inspection.codec,
    status: VIDEO_ARTIFACT_STATUS.VIDEO_ARTIFACT_VALID,
  };
  const recordPath = join(dir, `${artifactId || "video"}.json`);
  writeFileSync(recordPath, JSON.stringify(artifact, null, 2) + "\n");
  return { ok: true, status: VIDEO_ARTIFACT_STATUS.VIDEO_ARTIFACT_VALID, inspection: v.inspection, artifact, record_path: recordPath, ...base };
}

// ---------- requested vs actual conformance (diagnostic; never invalidates) ---
export function videoConformance({ assetSpec = {}, artifact = {} } = {}) {
  const reqW = assetSpec.width ?? null, reqH = assetSpec.height ?? null;
  const reqAR = assetSpec.aspect_ratio ?? (reqW && reqH ? `${reqW}:${reqH}` : null);
  const actW = artifact.actual_width ?? null, actH = artifact.actual_height ?? null;
  const actAR = artifact.actual_aspect_ratio ?? (actW && actH ? `${actW}:${actH}` : null);
  const dimMatch = (reqW != null && reqH != null && actW != null && actH != null) ? (reqW === actW && reqH === actH) : null;
  const aspect = compareAspectRatio(reqAR, actAR);

  const reqD = assetSpec.duration_seconds ?? null;
  const actD = artifact.actual_duration_seconds ?? null;
  const dDelta = (reqD != null && actD != null) ? Math.round(Math.abs(reqD - actD) * 1e6) / 1e6 : null;
  const dMatch = dDelta == null ? null : dDelta <= DURATION_TOLERANCE_SECONDS;

  return {
    requested_width: reqW, requested_height: reqH, requested_aspect_ratio: reqAR,
    actual_width: actW, actual_height: actH, actual_aspect_ratio: actAR,
    dimension_match: dimMatch,
    aspect_ratio_match: aspect.match, aspect_ratio_delta: aspect.delta, aspect_ratio_tolerance: ASPECT_RATIO_TOLERANCE,
    requested_duration_seconds: reqD, actual_duration_seconds: actD,
    duration_match: dMatch, duration_delta_seconds: dDelta, duration_tolerance_seconds: DURATION_TOLERANCE_SECONDS,
    requested_fps: assetSpec.fps ?? null, actual_fps: artifact.actual_fps ?? null,
    fps_match: (assetSpec.fps != null && artifact.actual_fps != null) ? assetSpec.fps === artifact.actual_fps : null,
    geometry_conformance: aspect.match === false || dimMatch === false ? VIDEO_CONFORMANCE.GEOMETRY_MISMATCH : VIDEO_CONFORMANCE.GEOMETRY_MATCH,
    duration_conformance: dMatch === false ? VIDEO_CONFORMANCE.DURATION_MISMATCH : VIDEO_CONFORMANCE.DURATION_MATCH,
  };
}

// ---------- generation record (prompt + provenance hooks) ---------------------
export function buildVideoGenerationRecord({ promptPackage, canonicalRequest = null, artifact, conformance, provider = null, requestedModel = null, returnedModel = null, providerPromptSent = null, promptModifiedByAdapter = null } = {}) {
  const canonical = promptPackage?.prompt ?? null;
  const modified = promptModifiedByAdapter != null ? !!promptModifiedByAdapter : (providerPromptSent != null ? providerPromptSent !== canonical : null);
  return {
    video_asset_id: artifact?.video_asset_id ?? null,
    fixture_id: artifact?.fixture_id ?? null,
    artifact_id: artifact?.artifact_id ?? null,
    provider,
    requested_model: requestedModel,
    returned_model: returnedModel,
    canonical_video_prompt: canonical,
    // NOT fabricated: stays null until a real provider (or a mock) returns the exact text it sent.
    provider_prompt_sent: providerPromptSent,
    prompt_modified_by_adapter: modified,
    source_image: canonicalRequest?.source_image ?? null,
    reference_images: canonicalRequest?.reference_images ?? [],
    artifact,
    conformance,
    human_review_required: true,
  };
}

/** Human-readable prompt output (mirrors images). Never mislabels canonical text as provider-sent. */
export function writeVideoPromptText(record, dir = VIDEO_ARTIFACT_DIR) {
  mkdirSync(dir, { recursive: true });
  const lines = [
    "VIDEO GENERATION PROMPT",
    record.canonical_video_prompt || "(none)",
    "",
    "SOURCE IMAGE:",
    record.source_image || "(none)",
    "",
    "REFERENCE IMAGES:",
    (record.reference_images && record.reference_images.length) ? record.reference_images.join(", ") : "(none)",
    "",
    "PROVIDER PROMPT SENT:",
    record.provider_prompt_sent != null ? record.provider_prompt_sent : "(none — no provider in Wave V-B)",
    "",
  ];
  const path = join(dir, `${record.artifact_id || "video"}-prompt.txt`);
  writeFileSync(path, lines.join("\n"));
  return path;
}
