// MAE media · Provider-neutral VIDEO capability contract (Wave V-A). Reuses the EXISTING media-provider
// design (mae/media/providers.js): capability values describe provider ability; nothing is inferred and
// no provider is registered in this wave. There is no routing, fallback, or model registry here.
import { PROVIDER_STATE } from "./providers.js";

export const VIDEO_CAPABILITIES = Object.freeze([
  "video_generation", "image_to_video", "reference_image", "multiple_reference_images", "audio_generation",
  "duration_control", "aspect_ratio_control", "resolution_control", "fps_control", "seed", "loop",
  "camera_control", "motion_control",
]);

// Honest states for the (currently absent) video-provider boundary.
export const VIDEO_PROVIDER_STATE = Object.freeze({
  PROVIDER_NOT_CONFIGURED: "PROVIDER_NOT_CONFIGURED",
  PROVIDER_UNAVAILABLE: PROVIDER_STATE.PROVIDER_UNAVAILABLE,
  PROVIDER_ATTEMPT_FAILED: "PROVIDER_ATTEMPT_FAILED",
  PROVIDER_RESPONSE_INVALID: "PROVIDER_RESPONSE_INVALID",
  PROVIDER_SUCCESS: "PROVIDER_SUCCESS",
});

// No video provider exists in Wave V-A. Registrations will declare a subset of VIDEO_CAPABILITIES.
export const VIDEO_PROVIDER_REGISTRY = Object.freeze({});

export function videoProviderFor(capability) {
  return Object.values(VIDEO_PROVIDER_REGISTRY).find((p) => (p.capabilities || []).includes(capability)) || null;
}

/** Honest current availability of video generation via the existing provider boundary. */
export function videoGenerationStatus() {
  return { available: false, state: VIDEO_PROVIDER_STATE.PROVIDER_NOT_CONFIGURED, provider: null, reason: "no video provider configured (Wave V-A is contracts only)" };
}
