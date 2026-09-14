// MAE media · Deterministic MOCK video provider (Wave V-E tests). No network, no credentials needed
// beyond a literal env stub, no spend. Simulates sync/async/failed/timeout/malformed/mismatch paths.
import { makeVideoProviderAdapter } from "./video-provider-adapter.js";

export const MOCK_FULL_CAPABILITIES = Object.freeze({
  video_generation: true, image_to_video: true, reference_image: true, multiple_reference_images: true,
  audio_generation: true, duration_control: true, aspect_ratio_control: true, resolution_control: true,
  fps_control: true, seed: true, loop: true, camera_control: true, motion_control: true,
});

export const MOCK_MINIMAL_CAPABILITIES = Object.freeze({ video_generation: true, aspect_ratio_control: true });

const PROCESSING = () => ({ provider_status: "processing" });

/**
 * Deterministic mock transport. Scenarios exercise every V-E branch.
 * `bytes` is the fake media payload returned by download() (use a real synthetic MP4 for success).
 */
export function makeMockVideoTransport({ scenario = "immediate_success", bytes = null, providerJobId = "mock-job-1", returnedModel = null, declaredMimeType = "video/mp4", mediaUrl = "https://mock.invalid/video/1.mp4", transformedPrompt = null, usage = null, cost = null, seed = null, retryAfterMs = null } = {}) {
  const media = { url: mediaUrl, mime_type: declaredMimeType, usage, cost, seed };
  const completed = { provider_status: "completed", media, returned_model: returnedModel, usage, cost, seed };
  const submitRaw = () => {
    switch (scenario) {
      case "malformed": return "this is not a job object";
      case "missing_job_id": return { provider_status: "processing", returned_model: returnedModel };
      case "submit_fail": return { provider_status: "failed", provider_job_id: providerJobId, error: "provider rejected the request", retryable: true };
      case "immediate_success": return { provider_job_id: providerJobId, provider_status: "completed", returned_model: returnedModel, media, usage, cost, seed };
      case "failed": return { provider_job_id: providerJobId, provider_status: "processing" };
      case "timeout": return { provider_job_id: providerJobId, provider_status: "submitted" };
      default: return { provider_job_id: providerJobId, provider_status: "processing", retry_after_ms: retryAfterMs };
    }
  };
  const pollRaw = (attempt) => {
    switch (scenario) {
      case "failed": return { provider_status: "failed", error: "render failed at provider", retryable: true, returned_model: returnedModel };
      case "timeout": return PROCESSING();
      case "completed_without_media": return { provider_status: "completed", media: null, provider_job_id: providerJobId };
      case "malformed_url": return { provider_status: "completed", media: { url: "file:///etc/passwd" }, provider_job_id: providerJobId };
      case "download_fail": return { provider_status: "completed", media: { url: "https://mock.invalid/video/gone.mp4" }, provider_job_id: providerJobId };
      case "invalid_video": return { provider_status: "completed", media: { url: "https://mock.invalid/video/bad.mp4", mime_type: "video/mp4" }, provider_job_id: providerJobId };
      case "model_mismatch": return { provider_status: "completed", media, returned_model: "some-other-model-9", provider_job_id: providerJobId };
      case "no_returned_model": return { provider_status: "completed", media, returned_model: null, provider_job_id: providerJobId };
      case "poll_malformed": return ["not", "an", "object"];
      case "processing_then_completed": return attempt < 2 ? PROCESSING() : { provider_status: "completed", media, returned_model: returnedModel, provider_job_id: providerJobId };
      default: return { provider_status: "completed", media, returned_model: returnedModel, provider_job_id: providerJobId }; // async_success
    }
  };
  return {
    buildRequest(request = {}) {
      const sent = transformedPrompt != null ? transformedPrompt : request.prompt;
      return {
        native: {
          prompt: sent, output_name: "mock-video.mp4", artifact_id: `VID-MOCK-${providerJobId}`,
          duration: request.duration_seconds ?? null, aspect_ratio: request.aspect_ratio ?? null,
          source_image: request.source_image ?? null, reference_images: request.reference_images ?? [],
        },
        provider_prompt_sent: sent,
        provider_prompt_modified: transformedPrompt != null,
        negative_prompt: request.negative_prompt ?? null,
        provider_declared_mime_type: declaredMimeType,
      };
    },
    submit() { return submitRaw(); },
    poll(jobId, attempt) { return pollRaw(attempt); },
    download() {
      if (scenario === "download_fail") return null;
      if (scenario === "invalid_video") return Buffer.from("this is not an mp4 container at all");
      return bytes;
    },
  };
}

/** Mock adapter (provider-neutral foundation under test). */
export function makeMockVideoProviderAdapter({ scenario = "immediate_success", capabilities = MOCK_FULL_CAPABILITIES, bytes = null, requiredEnv = ["MOCK_VIDEO_API_KEY"], env = { MOCK_VIDEO_API_KEY: "test-only-key" }, transformedPrompt = null, returnedModel = null, allowedMediaHosts = ["mock.invalid"], ...rest } = {}) {
  const transport = makeMockVideoTransport({ scenario, bytes, returnedModel, transformedPrompt, ...rest });
  return makeVideoProviderAdapter({ name: "mock-video", capabilities, requiredEnv, env, transport, allowedMediaHosts });
}
