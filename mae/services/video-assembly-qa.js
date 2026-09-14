// MAE services · Final assembly QA (Wave V-D).
// Assembly-specific DETERMINISTIC checks only. Strategic/visual judging is NOT re-implemented —
// it is delegated to the existing VideoOutputQA (Wave V-C) and surfaced under `video_output_qa`.
import { ASSEMBLY_STATUS, normalizeAssemblySpec, validateAssemblySpec, layerZ } from "../media/video-assembly-spec.js";
import { VideoOutputQA, QA_STATUS } from "./video-output-qa.js";

export const ASSEMBLY_QA_CHECKS = Object.freeze([
  "source_availability", "text_overflow", "timeline_overlaps", "caption_timing_valid",
  "safe_zone_bounds", "overlay_bounds", "logo_bounds", "canvas_match", "duration_match", "audio_policy_compliance",
]);

const inCanvas = (box, W, H) => !box || ["x", "y", "width", "height"].every((k) => box[k] == null || (box[k] >= 0 && (k === "x" ? box[k] + (box.width ?? 0) <= W : k === "y" ? box[k] + (box.height ?? 0) <= H : true)));

/** Deterministic assembly checks (no judgment, no model). */
export function assemblyChecks({ spec: rawSpec, artifact = null, sources = {} } = {}) {
  const v = validateAssemblySpec(rawSpec);
  const spec = v.normalized;
  const W = spec.canvas.width, H = spec.canvas.height;
  const checks = [];
  const add = (check, pass, detail) => checks.push({ check, pass, detail });

  add("source_availability", !/missing source/.test(v.errors.join(" ")), "explicit source refs resolve");
  add("text_overflow", v.overflow.length === 0, v.overflow.length ? `overflow: ${v.overflow.map((o) => o.item_id).join(", ")}` : "all text fits its box");
  add("timeline_overlaps", !/overlap violation/.test(v.errors.join(" ")), "same-layer time overlaps");
  add("caption_timing_valid", spec.captions.every((c) => typeof c.start_time === "number" && c.end_time > c.start_time && c.end_time <= spec.canvas.duration_seconds + 1e-6), "caption windows inside the timeline");
  add("safe_zone_bounds", spec.safe_zones.every((z) => z.min_px == null || (z.min_px >= 0 && z.min_px <= (z.edge === "top" || z.edge === "bottom" ? H : W))), "declared safe zones fit the canvas");
  add("overlay_bounds", spec.timeline.filter((i) => i.type === "OVERLAY").every((i) => inCanvas(i.position, W, H)), "overlay geometry inside the canvas");
  add("logo_bounds", spec.timeline.filter((i) => i.type === "LOGO").every((i) => inCanvas(i.position, W, H)), "logo geometry inside the canvas");
  add("canvas_match", !!artifact && artifact.width === W && artifact.height === H, artifact ? `final ${artifact.width}x${artifact.height} vs canvas ${W}x${H}` : "no rendered artifact");
  add("duration_match", !!artifact && typeof artifact.duration_seconds === "number" && Math.abs(artifact.duration_seconds - spec.canvas.duration_seconds) <= 0.5, artifact ? `final ${artifact.duration_seconds}s vs canvas ${spec.canvas.duration_seconds}s` : "no rendered artifact");
  add("audio_policy_compliance", !artifact || spec.audio?.mode !== "NONE" || artifact.audio_stream_present === false, "audio policy vs final audio stream");

  return { checks, valid: v.valid, errors: v.errors, spec };
}

/**
 * Final approval gate. Approved ONLY when every assembly check passes AND the delegated
 * VideoOutputQA is an actual PASS (a judgment-required or blocked video is never approved).
 */
export function finalAssemblyQa({ spec: rawSpec, artifact = null, conformance = null, judgment = {}, sources = {} } = {}) {
  const a = assemblyChecks({ spec: rawSpec, artifact, sources });
  const video_output_qa = VideoOutputQA.evaluate({ artifact, conformance, assetSpec: a.spec, judgment });
  const failed = a.checks.filter((c) => c.pass === false).map((c) => c.check);
  const approved = failed.length === 0 && video_output_qa.overall_status === QA_STATUS.PASS;
  const status = failed.length ? ASSEMBLY_STATUS.ASSEMBLY_FAILED : video_output_qa.overall_status;
  return {
    status,
    approved,
    assembly_checks: a.checks,
    failed_checks: failed,
    blocking_failures: video_output_qa.blocking_failures,
    human_review_required: !approved,
    video_output_qa,
  };
}
