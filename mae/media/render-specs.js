// MAE media · render-spec builders (Media-03 §2.2–2.8). Structured specifications; the exact fields
// the reference defines. IDs are assigned by the pipeline.
export const RenderSpecs = {
  imageRender(over = {}) {
    return {
      spec_type: "ImageRenderSpec",
      scene: over.scene || "", environment: over.environment || "", subjects: over.subjects || [],
      gesture_posture: over.gesture_posture || "", props: over.props || [], wardrobe: over.wardrobe || "",
      lighting: over.lighting || "", composition: over.composition || "", camera_language: over.camera_language || "",
      cultural_markers: over.cultural_markers || [], text_overlay_allowed: over.text_overlay_allowed ?? false,
      negative_constraints: over.negative_constraints || [], aspect_ratio: over.aspect_ratio || "4:5",
      pixel_dimensions: over.pixel_dimensions || { width: 1080, height: 1350 },
      design_system_version: over.design_system_version || "swt-tokens.css@1.x", brand_constraints: over.brand_constraints || [],
    };
  },
  layoutRender(over = {}) {
    return {
      spec_type: "LayoutRenderSpec",
      template_id: over.template_id || "quote-card",
      canvas: over.canvas || "instagram_feed",
      safe_area: over.safe_area || { top: 96, right: 96, bottom: 96, left: 96 },
      grid: over.grid || "8pt",
      headline: over.headline || "", body_copy: over.body_copy || "", cta: over.cta || "", disclaimer: over.disclaimer || "",
      logo_rule: over.logo_rule || "bottom-left", typography_tokens: over.typography_tokens || { display: "DM Serif Display", ui: "Inter" },
      color_tokens: over.color_tokens || { navy: "#0B1F33", purple: "#6F35B5", gold: "#D9A52E", cream: "#F8F4EC" },
      image_slots: over.image_slots || [], spacing_tokens: over.spacing_tokens || {}, export_formats: over.export_formats || ["svg"],
      overlay: over.overlay || null,
    };
  },
  carousel(over = {}) {
    const slides = (over.slides || []).map((s, i) => ({ slide_number: i + 1, strategic_job: s.strategic_job || "", copy: s.copy || "", visual_mode: s.visual_mode || "typographic", locked_terms: s.locked_terms || [] }));
    return { spec_type: "CarouselSpec", platform: over.platform || "instagram", slide_count: slides.length, slides, transition_logic: over.transition_logic || "linear", cta_slide: over.cta_slide ?? slides.length };
  },
  productCover(over = {}) {
    return {
      spec_type: "ProductCoverSpec", product_name: over.product_name || "", subtitle: over.subtitle || "", edition: over.edition || "v1",
      visual_concept: over.visual_concept || "", brand_system_version: over.brand_system_version || "swt-tokens.css@1.x",
      format_variants: over.format_variants || ["marketplace_thumbnail", "portrait_cover", "product_page_hero"],
    };
  },
  mockup(over = {}) {
    return { spec_type: "MockupSpec", mockup_type: over.mockup_type || "phone", source_artifact_ids: over.source_artifact_ids || [], device_or_object: over.device_or_object || "phone", camera: over.camera || "front", background: over.background || "studio", composition: over.composition || "centred", platform_usage: over.platform_usage || [] };
  },
  videoProduction(over = {}) {
    return {
      spec_type: "VideoProductionSpec", platform: over.platform || "tiktok", duration_target: over.duration_target || 30, aspect_ratio: over.aspect_ratio || "9:16",
      script_id: over.script_id || null, voiceover_id: over.voiceover_id || null,
      shots: (over.shots || []).map((s, i) => ({ shot_id: s.shot_id || `shot-${i + 1}`, start: s.start ?? i * 5, duration: s.duration ?? 5, purpose: s.purpose || "", visual_spec: s.visual_spec || null, on_screen_text: s.on_screen_text || "", voiceover_segment: s.voiceover_segment || "", transition: s.transition || "cut" })),
      captions: over.captions ?? [], music_policy: over.music_policy || "none", thumbnail_spec_id: over.thumbnail_spec_id || null, end_card: over.end_card || "Swiipt brand card", export_settings: over.export_settings || {},
    };
  },
  audioProduction(over = {}) {
    return { spec_type: "AudioProductionSpec", script_id: over.script_id || null, language: over.language || "en", voice_profile_id: over.voice_profile_id || "default", pace: over.pace || "measured", tone: over.tone || "calm", pronunciation_overrides: over.pronunciation_overrides || [], output_format: over.output_format || "mp3", normalization_profile: over.normalization_profile || "loudness-14lufs" };
  },
};
