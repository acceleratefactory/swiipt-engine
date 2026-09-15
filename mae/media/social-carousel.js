// MAE · Social Design Production — multi-panel assembly (Wave S-D).
// Orchestrates carousel (2–10 slides) and story-sequence (1–6 frames) assembly by turning each S-A
// slide into a slide-level static specification and composing it with the EXISTING S-C compositor.
// It never re-implements rendering, never rewrites copy and never drops a failed panel.
// No provider calls, no raster, no SocialGraphicQA, no network.
import { composeSocialStatic, COMPOSITOR_STATUS } from "./social-compositor.js";
import { validateSocialDesignSpec, ASSET_TYPE_LIMITS } from "../services/social-design-spec.js";
import { socialTokens } from "../services/social-design-tokens.js";
import { resolvePlatformPlacementProfile, resolveLayoutFamily, effectiveSafeZones, PROFILE_STATUS } from "../services/social-platforms.js";

export const SOCIAL_ASSEMBLER_VERSION = "1.0";
export const MULTI_PANEL_TYPES = Object.freeze(["SOCIAL_CAROUSEL", "SOCIAL_STORY_SEQUENCE"]);

// Deterministic aggregate severity ordering (higher wins).
const SEVERITY = Object.freeze({
  [COMPOSITOR_STATUS.INVALID_SPEC]: 6,
  [COMPOSITOR_STATUS.LAYOUT_OVERFLOW]: 5,
  [COMPOSITOR_STATUS.TEXT_OVERFLOW]: 4,
  [COMPOSITOR_STATUS.SOURCE_REQUIRED]: 3,
  [COMPOSITOR_STATUS.UNSUPPORTED_ASSET_TYPE]: 2,
  [COMPOSITOR_STATUS.MULTI_PANEL_ASSEMBLY_NOT_IMPLEMENTED]: 2,
  [COMPOSITOR_STATUS.READY]: 0,
});

/** Build the per-slide static specification from a slide + profile (copy preserved verbatim). */
export function buildSlideSpecification(spec, slide, profile, index, tokens) {
  const layout = resolveLayoutFamily(profile, slide.layout_family ?? spec.layout_family);
  const copy_blocks = [...(slide.copy_blocks || [])];
  if (spec.asset_type === "SOCIAL_CAROUSEL") copy_blocks.push({ copy_id: `${spec.design_id}-p${index}-pagination`, role: "pagination", text: `${index} / ${spec.slide_count}` });
  // CTA policy is derived per panel: a CTA is required only on the panel that actually carries the
  // approved CTA copy (never invented, never required of panels that have none).
  const hasCta = copy_blocks.some((b) => b.role === "cta");
  const cta_policy = hasCta
    ? { required: true, copy_role: "cta", placement: spec.cta_policy?.placement ?? "LAST_PANEL", prominence: spec.cta_policy?.prominence ?? "HIGH" }
    : { required: false, copy_role: null, placement: null, prominence: "NONE" };
  return {
    ...spec,
    design_id: `${spec.design_id}-P${index}`,
    asset_type: "SOCIAL_STATIC",
    asset_purpose: slide.asset_purpose ?? spec.asset_purpose,
    content_pattern: slide.content_pattern ?? spec.content_pattern,
    layout_family: layout.layout_family,
    platform: profile.platform,
    placement: profile.placement,
    platform_format: profile.platform_format,
    canvas: { ...profile.canvas },
    safe_zones: effectiveSafeZones(spec, profile),
    density: slide.density ?? spec.density,
    copy_blocks,
    cta_policy,
    visual_slots: slide.visual_slots ?? [],
    slides: undefined,
    slide_count: undefined,
    continuity_group: undefined,
    provenance: {
      ...(spec.provenance || {}),
      profile_id: profile.profile_id,
      profile_version: profile.profile_version,
      panel_index: index,
      sequence_role: slide.sequence_role ?? null,
      source_layout_family: slide.layout_family ?? spec.layout_family,
      layout_fallback: layout.fallback ? layout.fallback_reason : null,
    },
    _layout_fallback: layout.fallback ? layout : null,
  };
}

/** Deterministic continuity checks across panels (design continuity only — never copy/meaning). */
export function continuityChecks(panels, profile, tokens) {
  const checks = [];
  const push = (check, pass, detail = "") => checks.push({ check, pass, detail });
  push("same_brand_token_version", panels.every((p) => p.provenance?.brand_tokens_version === tokens.brand_tokens_version), tokens.brand_tokens_version);
  push("same_profile", panels.every((p) => p.provenance?.profile_id === profile.profile_id), profile.profile_id);
  push("same_profile_version", panels.every((p) => p.provenance?.profile_version === profile.profile_version), profile.profile_version);
  push("same_canvas", new Set(panels.map((p) => `${p.layout_plan?.canvas?.width}x${p.layout_plan?.canvas?.height}`)).size === 1, "canvas constant across panels");
  push("panel_order_preserved", panels.map((p) => p.slide_index).every((v, i) => v === i + 1), "1-based ascending");
  return checks;
}

/**
 * Assemble a carousel or story sequence into per-panel deterministic SVGs + a deterministic manifest.
 * Panel failures propagate: a failed required panel means the asset is NOT READY.
 */
export function assembleMultiPanel(rawSpec, tokens = socialTokens(), options = {}) {
  const v = validateSocialDesignSpec(rawSpec);
  const base = { design_id: rawSpec?.design_id ?? null, asset_type: rawSpec?.asset_type ?? null, continuity_group: rawSpec?.continuity_group ?? null, platform_profile: null, panel_count: 0, panels: [], manifest: null, checks: [], status: COMPOSITOR_STATUS.INVALID_SPEC, warnings: [], diagnostics: [], provenance: null };
  if (!v.valid) return { ...base, warnings: v.errors, diagnostics: v.errors.map((e) => ({ panel: null, issue: "INVALID_SPEC", detail: [e] })) };

  const spec = v.normalized;
  if (!MULTI_PANEL_TYPES.includes(spec.asset_type)) return { ...base, status: COMPOSITOR_STATUS.INVALID_SPEC, warnings: [`${spec.asset_type} is not a multi-panel asset type`] };

  const res = resolvePlatformPlacementProfile({ platform: spec.platform, placement: spec.placement, platform_format: spec.platform_format });
  if (!res.ok) return { ...base, status: res.status, warnings: [res.error] };
  const profile = res.profile;
  const profileRef = { profile_id: profile.profile_id, profile_version: profile.profile_version };

  const panels = [];
  const diagnostics = [];
  for (const slide of spec.slides) {
    const index = slide.slide_index;
    const slideSpec = buildSlideSpecification(spec, slide, profile, index, tokens);
    const fallback = slideSpec._layout_fallback;
    if (fallback) diagnostics.push({ panel: index, issue: "LAYOUT_FALLBACK", detail: [fallback.fallback_reason] });
    // panel-scoped media: source resolution is supplied by the caller (S-G) — never resolved here
    const panelOptions = (options.panel_sources && options.panel_sources[index]) || options;
    const composed = composeSocialStatic(slideSpec, tokens, panelOptions);
    const provenance = {
      design_id: spec.design_id, angle_id: spec.angle_id, asset_brief_id: spec.asset_brief_id,
      panel_index: index, sequence_role: slide.sequence_role ?? null,
      profile_id: profile.profile_id, profile_version: profile.profile_version,
      layout_family: composed.layout_plan?.layout_family ?? slideSpec.layout_family,
      layout_variant: composed.layout_plan?.layout_variant ?? null,
      source_layout_family: slide.layout_family ?? spec.layout_family,
      layout_fallback: fallback ? fallback.fallback_reason : null,
      brand_tokens_version: tokens.brand_tokens_version, token_version: tokens.token_version,
      compositor_version: composed.provenance?.compositor_version ?? null,
      canvas: composed.provenance?.canvas ?? { ...profile.canvas },
    };
    panels.push({
      slide_index: index, sequence_role: slide.sequence_role ?? null,
      layout_plan: composed.layout_plan, svg: composed.svg, visible_text: composed.visible_text,
      status: composed.status, warnings: composed.warnings, diagnostics: composed.diagnostics,
      checks: composed.checks, provenance,
    });
    for (const d of composed.diagnostics) diagnostics.push({ ...d, panel: index });
  }

  const checks = continuityChecks(panels, profile, tokens);
  const panelStatuses = panels.map((p) => p.status);
  let status = COMPOSITOR_STATUS.READY;
  for (const s of panelStatuses) if ((SEVERITY[s] ?? 1) > (SEVERITY[status] ?? 0)) status = s;
  if (!checks.every((c) => c.pass)) status = status === COMPOSITOR_STATUS.READY ? COMPOSITOR_STATUS.LAYOUT_OVERFLOW : status;

  const manifest = {
    design_id: spec.design_id, continuity_group: spec.continuity_group, asset_type: spec.asset_type,
    platform: profile.platform, placement: profile.placement, platform_format: profile.platform_format,
    panel_count: panels.length,
    panel_ids: panels.map((p) => p.provenance.design_id + `-P${p.slide_index}`),
    sequence_roles: panels.map((p) => p.sequence_role),
    layout_families: panels.map((p) => p.provenance.layout_family),
    copy_refs: panels.map((p) => `${spec.design_id}-P${p.slide_index}`),
    source_media_refs: [].concat(...(spec.slides || []).map((s) => (s.visual_slots || []).map((x) => x.source?.artifact_id).filter(Boolean))),
    brand_tokens_version: tokens.brand_tokens_version, token_version: tokens.token_version,
    profile_id: profile.profile_id, profile_version: profile.profile_version,
    assembler_version: SOCIAL_ASSEMBLER_VERSION,
    provenance: { angle_id: spec.angle_id, asset_brief_id: spec.asset_brief_id, design_version: spec.design_version },
  };

  return {
    ...base,
    platform_profile: profileRef, panel_count: panels.length, panels, manifest, checks, status,
    warnings: [...v.warnings], diagnostics,
    provenance: { design_id: spec.design_id, asset_type: spec.asset_type, angle_id: spec.angle_id, asset_brief_id: spec.asset_brief_id, continuity_group: spec.continuity_group, platform_profile: profileRef, brand_tokens_version: tokens.brand_tokens_version, token_version: tokens.token_version, assembler_version: SOCIAL_ASSEMBLER_VERSION },
  };
}
