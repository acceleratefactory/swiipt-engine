// MAE · Video production foundation (Wave V-A). Contracts + deterministic builders only.
// No provider, no rendering, no compositor, no artifact handling.
// Video EXTENDS the existing media production subsystem and receives an already-validated Angle;
// it never invents Customer/Product Truth. Grounding keeps source_grounded facts distinct from
// production_instruction choices.
import { validate } from "../lib/schema.js";
import { fail, CODES } from "../lib/errors.js";

export const VIDEO_TYPES = Object.freeze([
  "SCENE_VIDEO", "PRODUCT_DEMO", "EDUCATIONAL_MOTION", "UI_DEMO", "TESTIMONIAL_STYLE",
  "KINETIC_TYPOGRAPHY", "SOCIAL_SHORT", "LANDING_PAGE_HERO_VIDEO", "BROLL", "VIDEO_AD", "EXPLAINER_SEQUENCE",
]);
export const VIDEO_PRODUCTION_MODES = Object.freeze(["GENERATED_SCENE", "IMAGE_TO_VIDEO", "DETERMINISTIC_MOTION", "HYBRID"]);
export const AUDIO_MODES = Object.freeze(["NONE", "AMBIENCE", "MUSIC", "VOICEOVER", "DIALOGUE"]);
export const SOURCE_CLASSES = Object.freeze(["source_grounded", "production_instruction"]);

// Default policies: marketing text/logo/captions are applied DETERMINISTICALLY downstream, never by a
// generative model; audio defaults to NONE for early scene video.
export const DEFAULT_TEXT_POLICY = Object.freeze({ generated_text_allowed: false, deterministic_overlay_text: [], captions: true, cta: true, logo: true });
export const DEFAULT_AUDIO_POLICY = "NONE";

/** Compose a text policy, defaulting generated_text_allowed to false. */
export function textPolicy(over = {}) { return { ...DEFAULT_TEXT_POLICY, ...over }; }

export const VideoGroundingService = {
  build(grounding) {
    validate("video-grounding.schema.json", grounding, grounding && grounding.video_grounding_id);
    return grounding;
  },
};

export const ShotSpecificationService = {
  build(shot) {
    validate("shot-spec.schema.json", shot, shot && shot.shot_id);
    return shot;
  },
};

export const VideoAssetSpecService = {
  build(spec) {
    const shots = Array.isArray(spec.shots) ? spec.shots : [];
    if (!shots.length) fail(CODES.MISSING_FIELD, "VideoAssetSpecification requires at least one shot");
    for (const s of shots) ShotSpecificationService.build(s);
    const asset = { ...spec, shot_count: shots.length };
    if (asset.shot_count !== shots.length) fail(CODES.VALIDATION_FAILED, "shot_count must match shots.length");
    const sum = shots.reduce((n, s) => n + (Number(s.duration_seconds) || 0), 0);
    if (sum > Number(asset.duration_seconds) + 0.001) {
      fail(CODES.VALIDATION_FAILED, `shot durations (${sum}s) exceed total duration (${asset.duration_seconds}s)`, { sum, total: asset.duration_seconds });
    }
    if (!VIDEO_PRODUCTION_MODES.includes(asset.production_mode)) fail(CODES.VALIDATION_FAILED, `unknown production_mode '${asset.production_mode}'`);
    if (!VIDEO_TYPES.includes(asset.video_type)) fail(CODES.VALIDATION_FAILED, `unknown video_type '${asset.video_type}'`);
    validate("video-asset-spec.schema.json", asset, asset.video_asset_id);
    return asset;
  },
};
