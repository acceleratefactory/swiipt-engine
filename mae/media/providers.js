// MAE media · provider adapters (Media-02). Dormant by default; replaceable; no vendor code in
// business rules. Deterministic layout rendering is internal. Absence of a key never removes the architecture.
export const CAPABILITIES = [
  "text_generation", "evaluation", "visual_reasoning",
  "image_generation", "video_generation", "tts", "layout_render", "document_render",
];

export const PROVIDER_STATE = {
  OK: "OK",
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  PRODUCTION_BLOCKED: "PRODUCTION_BLOCKED",
  RENDER_PENDING: "RENDER_PENDING_EXTERNAL_PROVIDER",
};

// Internal deterministic renderer — always available for layout/text (no external provider).
// NOTE: document_render (true PDF) is NOT internal — it needs a real PDF engine, so it stays dormant.
const internalLayout = {
  name: "internal-layout",
  capabilities: ["layout_render", "text_generation"],
  dormant: false,
};

// External adapters — dormant until configured via env (keys never hard-coded).
function external(name, capabilities, envKey) {
  return {
    name,
    capabilities,
    dormant: !process.env[envKey],
    envKey,
    run() { return { ran: false, state: PROVIDER_STATE.PROVIDER_UNAVAILABLE, reason: `${name}: ${envKey} not configured` }; },
  };
}

export const PROVIDER_REGISTRY = {
  layout: internalLayout,
  copy: external("openai-copy", ["text_generation"], "OPENAI_API_KEY"),
  critic: external("openai-critic", ["evaluation", "visual_reasoning"], "OPENAI_API_KEY"),
  image: external("image-provider", ["image_generation"], "MAE_IMAGE_API_KEY"),
  video: external("video-provider", ["video_generation"], "MAE_VIDEO_API_KEY"),
  tts: external("tts-provider", ["tts"], "MAE_TTS_API_KEY"),
};

export function getProviderByCapability(capability) {
  for (const p of Object.values(PROVIDER_REGISTRY)) {
    if (p.capabilities.includes(capability) && !p.dormant) return p;
  }
  return null;
}

export function providerListDebug() {
  return Object.values(PROVIDER_REGISTRY).map((p) => ({ name: p.name, capabilities: p.capabilities, dormant: !!p.dormant }));
}
