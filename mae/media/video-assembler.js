// MAE media · Deterministic video assembler (Wave V-D).
// Wraps ffmpeg as a LOCAL subprocess with argument arrays (no shell, no string concat, no network).
// Swiipt owns typography/layout/CTA/captions/logo: text is burned in from exact approved copy via
// drawtext + an explicit font file, and the same copy is emitted as a deterministic SVG layer set.
// Nothing here generates media, calls a provider, or selects content.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MAE_DIR } from "../lib/store.js";
import { validateVideoBytes } from "./video-artifact.js";
import { TOKENS } from "./layout.js";
import {
  ASSEMBLY_STATUS, normalizeAssemblySpec, validateAssemblySpec, assemblySpecHash,
  buildTextLayers, LAYER_ORDER, layerZ,
} from "./video-assembly-spec.js";

export const ASSEMBLER_VERSION = "1.0";
export const ASSEMBLY_DIR = join(MAE_DIR, "storage", "work", "assembly");
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FONT_DIRS = [join(ROOT, "asset design", "app", "assets", "fonts"), join(ROOT, "asset design", "flipbook", "assets", "fonts")];
const FONT_FILES = { "inter": "Inter-Regular.ttf", "inter-medium": "Inter-Medium.ttf", "dm-serif-display": "DMSerifDisplay-Regular.ttf" };

let _engine = null;
/** ffmpeg availability + version. Local only. */
export function assemblyEngineStatus() {
  if (_engine) return _engine;
  const r = spawnSync("ffmpeg", ["-hide_banner", "-version"], { encoding: "utf8" });
  if (r.status !== 0 || !r.stdout) { _engine = { available: false, engine: "ffmpeg", version: null, reason: "ffmpeg not available locally" }; return _engine; }
  const version = (r.stdout.split("\n")[0].match(/version\s+(\S+)/) || [])[1] || null;
  _engine = { available: true, engine: "ffmpeg", version };
  return _engine;
}
export function resolveFont(token) {
  const file = FONT_FILES[token] || FONT_FILES["inter"];
  for (const d of FONT_DIRS) { const p = join(d, file); if (existsSync(p)) return p; }
  return null;
}

const ff = (args, cwd) => spawnSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", ...args], { cwd, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });

const fitChain = (w, h, fit) => fit === "cover"
  ? `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`
  : `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=${TOKENS.navy.replace("#", "0x")}`;

/** Deterministic text/overlay assets: exact copy files + an inspectable SVG layer set. */
function writeOverlayAssets(spec, dir) {
  const layers = buildTextLayers(spec);
  const files = [];
  for (const L of layers) {
    const p = join(dir, `${L.item_id}.txt`);
    writeFileSync(p, L.value);            // exact approved copy — never rewritten
    files.push({ ...L, file: p });
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${spec.canvas.width}" height="${spec.canvas.height}">${layers.map((l) => l.svg).join("")}</svg>`;
  const svgPath = join(dir, "text-layers.svg");
  writeFileSync(svgPath, svg);
  return { files, svgPath, svg };
}

function drawtextFilters(spec, overlays) {
  const filters = [];
  const font = resolveFont("inter");
  for (const L of overlays) {
    if (L.type === "LOGO") continue;
    if (!font) continue; // honest: no font → no burn-in (recorded as warning by caller)
    const size = L.size;
    const x = L.type === "CTA" || L.align === "center" ? "(w-text_w)/2" : "w*0.07";
    const yMap = { headline: "h*0.16", subheadline: "h*0.30", cta: "h*0.80", caption: "h*0.88" };
    const y = yMap[L.role] || "h*0.5";
    const color = L.color.startsWith("#") ? L.color.replace("#", "0x") : L.color;
    const enable = `enable=between(t\\,${L.start_time}\\,${L.end_time})`;
    filters.push(`drawtext=textfile='${L.file.replace(/\\/g, "/").replace(/:/g, "\\:")}':fontfile='${font.replace(/\\/g, "/").replace(/:/g, "\\:")}':fontcolor=${color}:fontsize=${size}:x=${x}:y=${y}:${enable}`);
  }
  // deterministic scrim (brand darkening) for OVERLAY/scrim items
  for (const it of spec.timeline.filter((i) => i.type === "OVERLAY" && (i.role === "scrim" || !i.role))) {
    filters.push(`drawbox=x=0:y=ih*0.55:w=iw:h=ih*0.45:color=${TOKENS.navy.replace("#", "0x")}@0.35:t=fill:enable=between(t\\,${it.start_time}\\,${it.end_time})`);
  }
  return filters;
}

/**
 * Assemble deterministically. Never throws; returns an honest output record.
 * status: ASSEMBLY_RENDERED | ASSEMBLY_FAILED | SOURCE_REQUIRED | TEXT_OVERFLOW | INVALID_TIMELINE |
 *         INVALID_LAYOUT | ARTIFACT_VALIDATION_FAILED
 */
export function assembleVideo(input = {}) {
  const { spec: rawSpec, dir = ASSEMBLY_DIR, sources = {}, posterFrom = null } = input;
  const v = validateAssemblySpec(rawSpec);
  const spec = v.normalized;
  const errors = [...v.errors];
  const warnings = [...v.warnings];

  const base = {
    assembly_id: spec.assembly_id, video_asset_id: spec.video_asset_id,
    source_artifacts: spec.source_artifacts, output_path: null, mime_type: null,
    width: null, height: null, aspect_ratio: null, duration_seconds: null, fps: null,
    audio_stream_present: null, sha256: null, assembly_spec_hash: assemblySpecHash(rawSpec),
    render_engine: "ffmpeg", render_engine_version: assemblyEngineStatus().version,
    errors, warnings, provenance: provenanceFor(spec),
  };

  if (v.overflow.length) return { ...base, status: ASSEMBLY_STATUS.TEXT_OVERFLOW };
  if (errors.some((e) => /timeline|overlap|layer type|item beyond|end before|negative/.test(e))) return { ...base, status: ASSEMBLY_STATUS.INVALID_TIMELINE };
  if (errors.some((e) => /canvas|geometry|fit|focal|opacity|layout/.test(e))) return { ...base, status: ASSEMBLY_STATUS.INVALID_LAYOUT };
  if (errors.length) return { ...base, status: ASSEMBLY_STATUS.INVALID_LAYOUT };

  // source availability (explicit refs must resolve to real local files)
  const videoItems = spec.timeline.filter((i) => i.type === "VIDEO");
  const imageItems = spec.timeline.filter((i) => i.type === "IMAGE");
  const need = [...videoItems, ...imageItems].map((i) => i.source.ref);
  const missing = need.filter((r) => { const p = sources[r] || r; return !p || !existsSync(p); });
  if (missing.length) return { ...base, errors: [...errors, ...missing.map((m) => `missing source: ${m}`)], status: ASSEMBLY_STATUS.SOURCE_REQUIRED };
  if (spec.audio?.mode === "EXTERNAL_TRACK") {
    const t = sources[spec.audio.ref] || spec.audio.ref;
    if (!t || !existsSync(t)) return { ...base, errors: [...errors, `missing external audio artifact: ${spec.audio.ref}`], status: ASSEMBLY_STATUS.SOURCE_REQUIRED };
  }
  const eng = assemblyEngineStatus();
  if (!eng.available) return { ...base, errors: [...errors, eng.reason], status: ASSEMBLY_STATUS.ASSEMBLY_FAILED };

  mkdirSync(dir, { recursive: true });
  const W = spec.canvas.width, H = spec.canvas.height, D = spec.canvas.duration_seconds, F = spec.canvas.fps;
  const outPath = join(dir, `${spec.assembly_id}.${spec.output.format || "mp4"}`);
  const overlayDir = join(dir, `${spec.assembly_id}-overlays`);
  mkdirSync(overlayDir, { recursive: true });
  const overlay = writeOverlayAssets(spec, overlayDir);
  const missingFont = !resolveFont("inter") && overlay.files.some((l) => l.type !== "LOGO");
  if (missingFont) warnings.push("TEXT_RENDER_SKIPPED: no local font file resolved (copy preserved in the SVG layer set)");

  const fps = `fps=${F},format=yuv420p,setsar=1`;
  let args;
  const clipSrc = (ref) => sources[ref] || ref;

  if (spec.production_mode === "IMAGE_TO_MOTION_ASSEMBLY") {
    const img = imageItems[0];
    const m = img.motion || { type: "STATIC" };
    const src = clipSrc(img.source.ref);
    const frames = Math.max(1, Math.round(D * F));
    const zoom = m.type === "SLOW_ZOOM"
      ? `zoompan=z='${m.start_scale}+(${m.end_scale}-${m.start_scale})*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${F}`
      : m.type === "SLOW_PAN"
        ? `zoompan=z='${m.scale ?? 1.04}':x='(iw-iw/zoom)*on/${frames}':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${F}`
        : `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`;
    args = ["-y", "-loop", "1", "-t", String(D), "-i", src, "-vf", `${zoom},${fps}`, "-t", String(D), "-r", String(F), "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", outPath];
  } else if (spec.production_mode === "MULTI_CLIP_SEQUENCE" && videoItems.length >= 2) {
    const clips = videoItems.slice(0, 2);
    const trans = clips[1].transition?.type || "CUT";
    const i1 = ["-t", String(clips[0].end_time - clips[0].start_time), "-i", clipSrc(clips[0].source.ref)];
    const i2 = ["-t", String(clips[1].end_time - clips[1].start_time), "-i", clipSrc(clips[1].source.ref)];
    const fc = trans === "FADE"
      ? `[0:v]${fitChain(W, H, clips[0].position?.fit || "cover")},${fps},fade=t=in:st=0:d=0.3[c0];[1:v]${fitChain(W, H, clips[1].position?.fit || "cover")},${fps}[c1];[c0][c1]xfade=transition=fade:duration=0.4:offset=${Math.max(0, clips[0].end_time - clips[0].start_time - 0.4)}[v]`
      : `[0:v]${fitChain(W, H, clips[0].position?.fit || "cover")},${fps}[c0];[1:v]${fitChain(W, H, clips[1].position?.fit || "cover")},${fps}[c1];[c0][c1]concat=n=2:v=1:a=0[v]`;
    args = ["-y", ...i1, ...i2, "-filter_complex", fc, "-map", "[v]", "-t", String(D), "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", outPath];
  } else {
    // SOURCE_VIDEO_ONLY | VIDEO_WITH_OVERLAYS | VIDEO_WITH_CAPTIONS | HYBRID
    const src = clipSrc(videoItems[0].source.ref);
    const fit = videoItems[0].position?.fit || spec.brand_rules?.default_fit || "cover";
    const chain = [fitChain(W, H, fit), fps];
    if (spec.brand_rules?.fade) chain.push(`fade=t=in:st=0:d=0.4,fade=t=out:st=${Math.max(0, D - 0.4)}:d=0.4`);
    chain.push(...drawtextFilters(spec, overlay.files));
    args = ["-y", "-t", String(D), "-i", src];
    const audioArgs = [];
    if (spec.audio?.mode === "EXTERNAL_TRACK") { args.push("-i", clipSrc(spec.audio.ref)); audioArgs.push("-map", "1:a"); if (spec.audio.volume != null) audioArgs.push("-af", `volume=${spec.audio.volume}`); }
    else if (spec.audio?.mode === "SOURCE") { audioArgs.push("-map", "0:a?"); if (spec.audio.volume != null) audioArgs.push("-af", `volume=${spec.audio.volume}`); }
    else audioArgs.push("-an");
    args.push("-vf", chain.join(","), "-t", String(D), "-r", String(F), ...audioArgs, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", outPath);
  }

  const r = ff(args, dir);
  if (r.status !== 0 || !existsSync(outPath)) {
    return { ...base, errors: [...errors, `ffmpeg exited ${r.status}`, String(r.stderr || "").trim().slice(0, 400)].filter(Boolean), status: ASSEMBLY_STATUS.ASSEMBLY_FAILED, text_layers_svg: overlay.svgPath };
  }

  // Poster frame — explicit timestamp or an explicit source still. Never an aesthetic selection.
  let poster = null;
  if (spec.poster_frame) {
    const posterPath = join(dir, `${spec.assembly_id}-poster.jpg`);
    if (spec.poster_frame.source_image) {
      const p = sources[spec.poster_frame.source_image] || spec.poster_frame.source_image;
      if (existsSync(p)) { writeFileSync(posterPath, readFileSync(p)); poster = posterPath; }
      else warnings.push(`poster source image missing: ${spec.poster_frame.source_image}`);
    } else if (typeof spec.poster_frame.timestamp === "number") {
      const pr = ff(["-y", "-ss", String(spec.poster_frame.timestamp), "-i", outPath, "-frames:v", "1", "-q:v", "3", posterPath], dir);
      if (pr.status === 0 && existsSync(posterPath)) poster = posterPath; else warnings.push("poster frame extraction failed");
    }
  }

  // Mechanical revalidation of the FINAL asset (never trust the exit code alone).
  const bytes = readFileSync(outPath);
  const mv = validateVideoBytes(bytes);
  const record = {
    ...base,
    output_path: outPath,
    mime_type: "video/mp4",
    sha256: createHash("sha256").update(bytes).digest("hex"),
    poster_path: poster,
    text_layers_svg: overlay.svgPath,
    warnings,
  };
  if (mv.status !== "VIDEO_ARTIFACT_VALID") return { ...record, status: ASSEMBLY_STATUS.ARTIFACT_VALIDATION_FAILED, errors: [...errors, `final artifact invalid: ${mv.status}`] };
  return {
    ...record,
    width: mv.inspection.width, height: mv.inspection.height,
    aspect_ratio: `${mv.inspection.width}:${mv.inspection.height}`,
    duration_seconds: mv.inspection.duration_seconds, fps: null,
    audio_stream_present: mv.inspection.audio_stream_present,
    status: ASSEMBLY_STATUS.ASSEMBLY_RENDERED,
  };
}

/** Provenance carried from source media through final assembly. */
export function provenanceFor(spec) {
  const s = normalizeAssemblySpec(spec);
  const sp = s.source_provenance || {};
  return {
    angle_id: sp.angle_id ?? null,
    video_grounding_id: sp.video_grounding_id ?? null,
    video_asset_spec_id: sp.video_asset_spec_id ?? s.video_asset_id ?? null,
    source_artifacts: s.source_artifacts,
    source_prompts: sp.source_prompts ?? [],
    approved_copy_source: sp.approved_copy_source ?? null,
    caption_source: (s.captions.length || s.timeline.some((i) => i.type === "CAPTION")) ? (sp.caption_source ?? "supplied") : null,
    logo_source: s.logo?.ref ?? (s.logo?.text ? "brand-mark-text" : null),
    audio_source: s.audio?.mode === "EXTERNAL_TRACK" ? s.audio.ref : (s.audio?.mode === "SOURCE" ? "source-video" : null),
    assembly_spec_hash: assemblySpecHash(spec),
  };
}
