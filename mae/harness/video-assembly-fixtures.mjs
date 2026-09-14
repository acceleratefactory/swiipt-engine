// Deterministic Wave V-D assembly fixtures. Local ffmpeg only (lavfi sources) — no provider, no network.
// The Day-6 assembly derives from VV-CSEC-006; it never changes that fixture and never adds instruction.
import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildDay6Video } from "./video-fixtures.mjs";

export const DAY6_HEADLINE = "Nobody tells you what standing up feels like on day 6.";
export const DAY6_ASSEMBLY_ID = "ASM-CSEC-006";

const ff = (args) => spawnSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", ...args], { encoding: "utf8" });

/** Deterministic local source video (lavfi color). Returns a path, or null when ffmpeg is unavailable. */
export function ensureSourceVideo(dir, { name = "day6.mp4", seconds = 6, audio = false, w = 1080, h = 1920, fps = 24 } = {}) {
  mkdirSync(dir, { recursive: true });
  const out = join(dir, name);
  if (existsSync(out)) return out;
  const args = ["-y", "-f", "lavfi", "-i", `color=c=0x14212E:s=${w}x${h}:r=${fps}:d=${seconds}`];
  if (audio) args.push("-f", "lavfi", "-i", `sine=frequency=220:duration=${seconds}`, "-shortest", "-c:a", "aac");
  else args.push("-an");
  args.push("-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", out);
  const r = ff(args);
  return r.status === 0 && existsSync(out) ? out : null;
}

/** Deterministic still image (PNG) for IMAGE_TO_MOTION_ASSEMBLY. */
export function ensureStillImage(dir, { name = "still.png", w = 1080, h = 1920 } = {}) {
  mkdirSync(dir, { recursive: true });
  const out = join(dir, name);
  if (existsSync(out)) return out;
  const r = ff(["-y", "-f", "lavfi", "-i", `color=c=0x1B2A3A:s=${w}x${h}`, "-frames:v", "1", out]);
  return r.status === 0 && existsSync(out) ? out : null;
}

/** A local file that is NOT a video — used to prove render failure is reported honestly. */
export function ensureNonVideoFile(dir, { name = "not-video.txt" } = {}) {
  mkdirSync(dir, { recursive: true });
  const out = join(dir, name);
  writeFileSync(out, "this is not a video\n");
  return out;
}

export const DAY6_SAFE_ZONES = [{ edge: "top", min_px: 120 }, { edge: "bottom", min_px: 220 }];

/** The Day-6 assembly: approved-day-6 source + deterministic scrim + exact approved headline. */
export function buildDay6AssemblySpec(overrides = {}) {
  const D = buildDay6Video();
  const spec = {
    assembly_id: DAY6_ASSEMBLY_ID,
    video_asset_id: D.assetSpec.video_asset_id,
    production_mode: "VIDEO_WITH_OVERLAYS",
    platform: D.assetSpec.platform,
    placement: D.assetSpec.placement,
    source_artifacts: [{ ref: D.fixture_id, kind: "video", video_asset_id: D.assetSpec.video_asset_id }],
    canvas: { width: 1080, height: 1920, aspect_ratio: "9:16", fps: 24, duration_seconds: 6 },
    background: { mode: "SOLID", color: "#0B1F33" },
    timeline: [
      { item_id: "base", type: "VIDEO", start_time: 0, end_time: 6, z: 10, source: { ref: D.fixture_id }, position: { fit: "cover", focal: "center" } },
      { item_id: "scrim", type: "OVERLAY", role: "scrim", start_time: 0, end_time: 6, z: 20, opacity: 0.35 },
      { item_id: "headline", type: "TEXT", role: "headline", start_time: 0.2, end_time: 5.8, z: 40, position: { x: 76, y: 300, width: 900, height: 420 }, text: { value: DAY6_HEADLINE, font: "dm-serif-display", size: 52, line_height: 66, align: "left", color: "#F8F4EC" } },
    ],
    audio: { mode: "NONE", volume: null, ref: null },
    captions: [],
    logo: { text: "Swiipt", placement: "top-right", padding_px: 48 },
    safe_zones: DAY6_SAFE_ZONES,
    poster_frame: { timestamp: 0.5 },
    output: { format: "mp4" },
    brand_rules: { default_fit: "cover", fade: false },
    source_provenance: {
      angle_id: D.assetSpec.angle_id,
      video_grounding_id: D.assetSpec.video_grounding_id,
      video_asset_spec_id: D.assetSpec.video_asset_id,
      source_prompts: [{ ref: "VIDEO-PROMPT-CSEC-006", canonical: D.promptPackage.prompt }],
      approved_copy_source: "marketing-angle-record:ANG-CSEC-006",
      caption_source: null,
    },
  };
  return { ...spec, ...overrides };
}
