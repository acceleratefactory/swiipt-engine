// MAE media · Video prompt compiler + canonical video request (Wave V-A). Deterministic; NOT an LLM.
// Consumes Video Grounding + Shot Specification(s) + Video Asset Specification. It may never invent
// customer truth or extra shots. Prompt is sectioned and preserved exactly for future capture/persist/
// expose (same invariant as images).
import { validate } from "../lib/schema.js";

export const VIDEO_PROMPT_VERSION = "1.0";

// Production rule encoded here and documented: use the minimum motion necessary to communicate the
// validated angle. Do not default to cinematic/dramatic/gratuitous motion unless the spec requires it.
export const MINIMUM_MOTION_PRINCIPLE = "Use the minimum motion necessary to communicate the validated angle. No cinematic sweeping cameras, dramatic body movement, exaggerated emotional performance, constant background movement, or gratuitous transitions unless explicitly required by the spec.";

const j = (arr, sep = ", ") => (Array.isArray(arr) ? arr.filter(Boolean).join(sep) : "");
const line = (label, v) => `${label}: ${v == null || v === "" ? "(none)" : v}`;

/** Build the sectioned, human-readable prompt sections from grounding + asset spec (shots are given). */
export function compileVideoPromptSections({ grounding, assetSpec }) {
  const shots = assetSpec.shots || [];
  const subj = grounding.subject || {};
  const env = grounding.environment || {};
  const ss = grounding.start_state || {};
  const mo = grounding.motion || {};
  const cam = grounding.camera || {};
  const tm = grounding.timing || {};
  const es = grounding.end_state || {};
  const co = grounding.continuity || {};
  const au = grounding.audio_intent || {};
  const tp = grounding.text_policy || {};
  const ex = grounding.exclusions || {};

  const sections = {
    subject: [
      line("Subject", subj.description),
      line("Posture", subj.posture),
      line("Expression", subj.expression),
      subj.wardrobe ? line("Wardrobe", subj.wardrobe) : null,
      subj.identity_continuity_requirements && subj.identity_continuity_requirements.length ? line("Identity continuity", j(subj.identity_continuity_requirements, "; ")) : null,
      subj.permitted_actions && subj.permitted_actions.length ? line("Permitted actions", j(subj.permitted_actions, "; ")) : null,
    ].filter(Boolean).join("\n"),
    environment: [
      line("Location", env.location),
      line("Time of day", env.time_of_day),
      line("Lighting", env.lighting),
      env.props && env.props.length ? line("Props", j(env.props)) : null,
      env.cultural_markers && env.cultural_markers.length ? line("Cultural markers", j(env.cultural_markers)) : null,
      env.background_requirements && env.background_requirements.length ? line("Background", j(env.background_requirements, "; ")) : null,
    ].filter(Boolean).join("\n"),
    start_state: [
      line("Visual state", ss.visual_state),
      line("Subject position", ss.subject_position),
      line("Camera position", ss.camera_position),
      line("Emotional state", ss.emotional_state),
      ss.visible_objects && ss.visible_objects.length ? line("Visible objects", j(ss.visible_objects)) : null,
    ].filter(Boolean).join("\n"),
    action: [
      line("Primary action", mo.primary_action),
      mo.secondary_actions && mo.secondary_actions.length ? line("Secondary actions", j(mo.secondary_actions, "; ")) : null,
      mo.gestures && mo.gestures.length ? line("Gestures", j(mo.gestures, "; ")) : null,
      shots.length ? line("Shot actions", shots.map((s) => `${s.shot_id}: ${s.action ? s.action.subject_action : ""}`).join(" | ")) : null,
    ].filter(Boolean).join("\n"),
    camera: [
      line("Framing", cam.framing),
      line("Position", cam.position),
      line("Movement", cam.movement),
      line("Focus", cam.focus_behavior),
      line("Stability", cam.stability),
      shots.length ? line("Shot camera", shots.map((s) => `${s.shot_id}: ${s.camera ? `${s.camera.framing}, ${s.camera.movement}, ${s.camera.stability}` : ""}`).join(" | ")) : null,
    ].filter(Boolean).join("\n"),
    motion: [
      line("Speed", mo.speed),
      line("Direction", mo.direction),
      mo.physical_constraints && mo.physical_constraints.length ? line("Physical constraints", j(mo.physical_constraints, "; ")) : null,
      line("Principle", MINIMUM_MOTION_PRINCIPLE),
    ].filter(Boolean).join("\n"),
    timing: [
      line("Total duration (s)", tm.total_duration_seconds),
      shots.length ? line("Shot durations", shots.map((s) => `${s.shot_id}=${s.duration_seconds}s`).join(" | ")) : null,
      tm.action_timing && tm.action_timing.length ? line("Action timing", j(tm.action_timing, "; ")) : null,
      tm.hold_timing && tm.hold_timing.length ? line("Hold timing", j(tm.hold_timing, "; ")) : null,
      tm.transition_timing && tm.transition_timing.length ? line("Transition timing", j(tm.transition_timing, "; ")) : null,
    ].filter(Boolean).join("\n"),
    end_state: [
      line("Visual state", es.visual_state),
      line("Subject position", es.subject_position),
      line("Emotional state", es.emotional_state),
      line("Intended meaning", es.intended_meaning),
    ].filter(Boolean).join("\n"),
    continuity: [
      line("Identity", co.identity),
      line("Wardrobe", co.wardrobe),
      line("Objects", co.objects),
      line("Environment", co.environment),
      line("Body anatomy", co.body_anatomy),
    ].filter(Boolean).join("\n"),
    audio: [line("Mode", au.mode), au.notes ? line("Notes", au.notes) : null].filter(Boolean).join("\n"),
    text_policy: [
      line("Generated text allowed", String(!!tp.generated_text_allowed)),
      line("Deterministic overlay text", tp.deterministic_overlay_text && tp.deterministic_overlay_text.length ? j(tp.deterministic_overlay_text, "; ") : "(applied deterministically downstream)"),
      line("Captions", String(!!tp.captions)),
      line("CTA", String(!!tp.cta)),
      line("Logo", String(!!tp.logo)),
    ].join("\n"),
    do_not_show: (() => {
      const items = [
        ...(subj.prohibited_actions || []),
        ...(mo.prohibited_motion || []),
        ...(ex.visual || []), ...(ex.motion || []), ...(ex.cultural || []), ...(ex.safety || []), ...(ex.artifact || []),
      ].filter(Boolean);
      return [...new Set(items)].join("; ");
    })(),
  };
  return sections;
}

const SECTION_ORDER = ["subject", "environment", "start_state", "action", "camera", "motion", "timing", "end_state", "continuity", "audio", "text_policy", "do_not_show"];
const SECTION_LABEL = { subject: "SUBJECT", environment: "ENVIRONMENT", start_state: "START STATE", action: "ACTION", camera: "CAMERA", motion: "MOTION", timing: "TIMING", end_state: "END STATE", continuity: "CONTINUITY", audio: "AUDIO", text_policy: "TEXT POLICY", do_not_show: "DO NOT SHOW" };

/** Pure deterministic prompt-package content (no id/created_at) — same input ⇒ same output. */
export function compileVideoPromptPackage({ grounding, assetSpec }) {
  const sections = compileVideoPromptSections({ grounding, assetSpec });
  const prompt = SECTION_ORDER.map((k) => `${SECTION_LABEL[k]}:\n${sections[k] || "(none)"}`).join("\n\n");
  const negItems = [...new Set([...(grounding.exclusions?.visual || []), ...(grounding.exclusions?.motion || []), ...(grounding.exclusions?.cultural || []), ...(grounding.exclusions?.safety || []), ...(grounding.exclusions?.artifact || []), ...(grounding.subject?.prohibited_actions || []), ...(grounding.motion?.prohibited_motion || [])].filter(Boolean))];
  const shots = assetSpec.shots || [];
  return {
    prompt,
    negative_prompt: negItems.join("; "),
    sections,
    video_type: assetSpec.video_type,
    production_mode: assetSpec.production_mode,
    duration_seconds: assetSpec.duration_seconds,
    aspect_ratio: assetSpec.aspect_ratio,
    shot_ids: shots.map((s) => s.shot_id),
    metadata: { video_asset_id: assetSpec.video_asset_id, angle_id: assetSpec.angle_id, video_grounding_id: assetSpec.video_grounding_id },
    prompt_version: VIDEO_PROMPT_VERSION,
    spec_version: "1.0",
  };
}

/** Provider-neutral canonical video request (equivalent role to canonicalImageRequest). */
export function canonicalVideoRequest({ promptPackage, assetSpec, grounding } = {}) {
  if (!promptPackage || !promptPackage.prompt) throw new Error("canonicalVideoRequest requires a video prompt package");
  if (!assetSpec) throw new Error("canonicalVideoRequest requires a video asset specification");
  const mo = grounding?.motion || {};
  const cam = grounding?.camera || {};
  return {
    prompt: promptPackage.prompt,
    negative_prompt: promptPackage.negative_prompt || "",
    width: assetSpec.width,
    height: assetSpec.height,
    aspect_ratio: assetSpec.aspect_ratio,
    duration_seconds: assetSpec.duration_seconds,
    fps: assetSpec.fps,
    source_image: null,
    reference_images: [],
    motion: { primary_action: mo.primary_action ?? null, speed: mo.speed ?? null, direction: mo.direction ?? null },
    camera: { framing: cam.framing ?? null, movement: cam.movement ?? null, stability: cam.stability ?? null },
    audio: { mode: assetSpec.audio_policy },
    seed: null,
    loop: !!assetSpec.loop,
    video_type: assetSpec.video_type,
    production_mode: assetSpec.production_mode,
    metadata: { video_asset_id: assetSpec.video_asset_id, angle_id: assetSpec.angle_id, video_grounding_id: assetSpec.video_grounding_id, shot_ids: (assetSpec.shots || []).map((s) => s.shot_id) },
  };
}

export const VideoPromptService = {
  /** Validate + return a persisted-shape video prompt package record (id + created_at added). */
  build({ grounding, assetSpec, id }) {
    const content = compileVideoPromptPackage({ grounding, assetSpec });
    const record = { id: id || `VPP-${assetSpec.video_asset_id.replace(/^VID-/, "")}`, class: "video_prompt_package", ...content, created_at: new Date().toISOString() };
    validate("video-prompt-package.schema.json", record, record.id);
    return record;
  },
};
