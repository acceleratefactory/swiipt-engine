// MAE media · modality router (Media-02 §4/§5). Chooses a worker by capability, not by vendor name.
import { getProviderByCapability, PROVIDER_STATE } from "./providers.js";
import { fail, CODES } from "../lib/errors.js";

// production_mode → required capability.
export const MODE_CAPABILITY = {
  TEXT_DOCUMENT: "text_generation",
  STATIC_GRAPHIC: "layout_render",
  GENERATED_SCENE: "image_generation",
  CAROUSEL: "layout_render",
  PRODUCT_COVER: "layout_render",
  PRODUCT_MOCKUP: "image_generation",
  WHATSAPP_STATUS: "layout_render",
  VIDEO_PACKAGE: "text_generation",
  VIDEO_RENDER: "video_generation",
  AUDIO_VOICEOVER: "tts",
  PDF_RENDER: "document_render",
  LANDING_PAGE_MEDIA: "layout_render",
  MULTI_ASSET_EXPORT: "layout_render",
};

export const Router = {
  capabilityFor(mode) {
    const c = MODE_CAPABILITY[mode];
    if (!c) fail(CODES.UNSUPPORTED_MODALITY, `no capability mapping for production_mode ${mode}`, { mode });
    return c;
  },
  /** Resolve a provider for a mode. Returns { available, provider, capability, state, reason }. */
  route(mode) {
    const capability = this.capabilityFor(mode);
    const provider = getProviderByCapability(capability);
    if (!provider) {
      return { available: false, provider: null, capability, state: PROVIDER_STATE.PROVIDER_UNAVAILABLE,
        reason: `no configured provider for capability '${capability}' (dormant by default)` };
    }
    return { available: true, provider, capability, state: PROVIDER_STATE.OK, reason: null };
  },
};
