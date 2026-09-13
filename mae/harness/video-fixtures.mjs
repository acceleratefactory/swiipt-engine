// MAE · Day-6 C-section VIDEO fixture (VV-CSEC-006) — synthetic architecture fixture for Wave V-A tests.
// It DEPICTS a recovery moment; it does NOT teach the Product Truth mechanism and is not clinical
// instruction. No frozen image fixture is touched.
import { VideoGroundingService, ShotSpecificationService, VideoAssetSpecService, textPolicy } from "../services/video-grounding.js";
import { VideoPromptService } from "../media/video-prompt-compiler.js";

export const DAY6_VIDEO_ID = "VV-CSEC-006";

export function buildDay6Video() {
  const grounding = VideoGroundingService.build({
    video_grounding_id: "VG-VID-CSEC-006",
    angle_id: "ANG-CSEC-006",
    visual_grounding_id: "VG-CSEC-006",
    asset_purpose: "stop-scroll / identification",
    video_type: "SCENE_VIDEO",
    subject: {
      description: "Nigerian first-time mother, day 6 after C-section, seated on the edge of a bed",
      identity_continuity_requirements: ["same woman across shots", "stable facial identity", "consistent day-6 postpartum context"],
      wardrobe: "simple nightclothes",
      posture: "seated, leaning slightly forward",
      expression: "guarded, cautious",
      permitted_actions: ["slowly shift weight forward", "begin to rise carefully"],
      prohibited_actions: ["collapse", "fall", "exaggerated writhing"],
    },
    environment: {
      location: "bedroom",
      time_of_day: "approximately 3 AM (night)",
      lighting: "warm bedside lamp",
      props: ["bed", "bedside lamp"],
      cultural_markers: ["Nigerian"],
      background_requirements: ["quiet, dim domestic bedroom"],
    },
    start_state: {
      visual_state: "seated on the edge of the bed",
      subject_position: "edge of the bed",
      camera_position: "static medium-wide, side-on",
      emotional_state: "guarded discomfort",
      visible_objects: ["bed", "bedside lamp"],
    },
    motion: {
      primary_action: "She slowly shifts her weight forward in preparation to rise.",
      secondary_actions: [],
      speed: "slow, cautious",
      direction: "forward / upward",
      physical_constraints: ["no abrupt movement", "no weight loaded onto the wound"],
      gestures: ["hands ready to steady herself"],
      prohibited_motion: ["falling", "collapsing", "fast or jerky motion"],
    },
    camera: {
      framing: "medium-wide",
      position: "static, side-on to the bed edge",
      movement: "none (locked-off)",
      focus_behavior: "subject stays in focus",
      stability: "fully stable / locked",
    },
    timing: {
      total_duration_seconds: 6,
      action_timing: ["0-2s: hesitation", "2-5s: slow forward weight shift", "5-6s: partial rise hold"],
      hold_timing: ["5-6s: hold the careful position"],
      transition_timing: [],
    },
    end_state: {
      visual_state: "careful partially upright / standing-lean position",
      subject_position: "at the edge of the bed, partially risen",
      emotional_state: "cautious, controlled discomfort (not agony)",
      intended_meaning: "the unspoken difficulty of a simple movement is real and ordinary",
    },
    continuity: {
      identity: "consistent subject identity",
      wardrobe: "unchanged",
      objects: "bed and lamp consistent",
      environment: "same bedroom, same lighting",
      body_anatomy: "believable human anatomy",
    },
    audio_intent: { mode: "NONE", notes: null },
    text_policy: textPolicy(),
    exclusions: {
      visual: ["no text rendered inside the scene"],
      motion: ["no staged fall", "no dramatic collapsing"],
      cultural: ["no stereotyping", "no invented cultural markers"],
      safety: ["no unsafe physical demonstration framed as clinical instruction"],
      artifact: ["no medical-device invention", "no malformed anatomy"],
    },
    source_classification: {
      source_grounded: ["day 6 after C-section", "3 AM", "baby asleep", "needs to stand", "burning/pulling around the wound"],
      production_instruction: ["locked camera", "6-second duration", "warm bedside lamp", "slow, cautious pace", "no dramatic camera move"],
    },
  });

  const shot = ShotSpecificationService.build({
    shot_id: "SHOT-CSEC-006-1",
    purpose: "identification / stop-scroll: the ordinary difficulty of standing on day 6",
    duration_seconds: 6,
    start_frame: {
      subject: "the seated mother",
      subject_position: "edge of the bed",
      environment: "dim bedroom, warm bedside lamp",
      camera: "static medium-wide, side-on",
      visible_objects: ["bed", "bedside lamp"],
    },
    action: {
      subject_action: "She slowly shifts her weight forward in preparation to rise.",
      secondary_action: null,
      movement_speed: "slow, cautious",
      prohibited_motion: ["falling", "collapsing", "fast or jerky motion"],
    },
    camera: { framing: "medium-wide", movement: "none", focus: "subject in focus", stability: "locked" },
    end_frame: {
      subject: "the mother, partially risen",
      subject_position: "at the edge of the bed, partially upright",
      environment: "dim bedroom, warm bedside lamp",
      emotional_state: "cautious, controlled discomfort",
    },
    audio: { mode: "NONE", notes: null },
    transition: { type: "none", notes: null },
    text_safe_regions: [{ edge: "top", min_px: 120 }, { edge: "bottom", min_px: 220 }],
    continuity_references: ["bed", "bedside lamp", "night lighting"],
    source_classification: {
      source_grounded: ["day 6 after C-section", "3 AM", "needs to stand"],
      production_instruction: ["locked camera", "6-second single shot"],
    },
  });

  const assetSpec = VideoAssetSpecService.build({
    video_asset_id: "VID-CSEC-006",
    angle_id: "ANG-CSEC-006",
    video_grounding_id: grounding.video_grounding_id,
    video_type: "SCENE_VIDEO",
    platform: "instagram",
    placement: "social_short",
    aspect_ratio: "9:16",
    width: 1080,
    height: 1920,
    duration_seconds: 6,
    fps: 24,
    loop: false,
    audio_policy: "NONE",
    caption_policy: "DETERMINISTIC",
    text_overlay_policy: "DETERMINISTIC",
    logo_policy: "DETERMINISTIC",
    shot_count: 1,
    shots: [shot],
    safe_zones: [{ edge: "top", min_px: 120 }, { edge: "bottom", min_px: 220 }],
    delivery_format: "mp4",
    production_mode: "GENERATED_SCENE",
    reference_assets: [],
    status: "READY",
  });

  const promptPackage = VideoPromptService.build({ grounding, assetSpec, id: "VPP-CSEC-006" });
  return { fixture_id: DAY6_VIDEO_ID, grounding, shot, assetSpec, promptPackage };
}
