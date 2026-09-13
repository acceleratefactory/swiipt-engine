// MAE · VisualAssetSpec + deterministic production-mode decision.
// The spec is the contract between Visual Grounding and Media Production. It REFERENCES truth records
// (angle / grounding / brief) rather than copying them. Production mode is decided from asset
// requirements — never by an image provider. The compound case
// (GENERATED_BACKGROUND_PLUS_DETERMINISTIC_TYPE) is expressed via `compound` + deterministic_overlays,
// NOT a new production_mode enum (keeps router/pipeline/schema vocabulary stable).
import { save, all, MAE_DIR } from "../lib/store.js";
import { validate } from "../lib/schema.js";
import { makeId, existingIds } from "../lib/ids.js";
import { join } from "node:path";
import { CANVAS } from "../media/layout.js";
import { BrandTruthService } from "./brand.js";

const VAS_DIR = join(MAE_DIR, "data", "visual-asset-specs");

const CANVAS_BY_PLATFORM = {
  instagram: "instagram_feed",
  whatsapp_status: "story",
  tiktok: "story",
  facebook: "og",
  x: "og",
  email: "og",
  landing: "og",
  generic: "instagram_feed",
};

export function canvasForPlatform(platform) {
  return CANVAS[CANVAS_BY_PLATFORM[platform] || "instagram_feed"] || CANVAS.instagram_feed;
}

export const ProductionModeService = {
  /** Deterministic: asset requirements -> mode. The provider never chooses the mode. */
  decide({ brief, grounding, assetPurpose, platform, slideCount = 1 } = {}) {
    const purpose = assetPurpose || brief?.asset_purpose || null;
    if (slideCount > 1) return { mode: "CAROUSEL", compound: false, reason: "multi-panel asset (slideCount > 1)" };
    if (purpose === "product_cover") return { mode: "PRODUCT_COVER", compound: false, reason: "product cover asset" };
    if (purpose === "product_mockup") return { mode: "PRODUCT_MOCKUP", compound: false, reason: "product mockup asset (provider required)" };
    if (platform === "landing") return { mode: "LANDING_PAGE_MEDIA", compound: !!grounding, reason: "landing-page media asset" };
    if (grounding) return { mode: "GENERATED_SCENE", compound: true, reason: "visual grounding present -> photographic scene; deterministic overlays composed on top" };
    return { mode: "STATIC_GRAPHIC", compound: false, reason: "typographic-only asset (no photographic scene required)" };
  },
};

export const VisualAssetSpecService = {
  nextId(scope, existing = existingIds(VAS_DIR)) { return makeId("visualAssetSpec", scope, existing); },

  build({ angle, brief = null, grounding, platform, assetPurpose = null, productionMode = null, slideCount = 1, safetyConstraints = [], overlay = undefined, id = null } = {}) {
    if (!angle) throw new Error("VisualAssetSpecService.build requires an angle");
    if (!grounding) throw new Error("VisualAssetSpecService.build requires a visual_grounding block");
    const decided = ProductionModeService.decide({ brief, grounding, assetPurpose, platform, slideCount });
    const mode = productionMode || decided.mode;
    // compound = image/background produced AND deterministic typography composed on top.
    const compound = mode === "GENERATED_SCENE" && (productionMode ? !!grounding : decided.compound);
    const canvas = canvasForPlatform(platform);
    const spec = {
      id: id || this.nextId((angle.id.replace(/^ANG-/, "").split("-")[0] || "GEN")),
      class: "visual_asset_spec",
      version: "1.0",
      angle_id: angle.id,
      asset_brief_id: brief?.id ?? null,
      visual_grounding_id: grounding.id,
      platform,
      asset_purpose: assetPurpose ?? brief?.asset_purpose ?? null,
      production_mode: mode,
      compound,
      aspect_ratio: `${canvas.w}:${canvas.h}`,
      canvas: { width: canvas.w, height: canvas.h },
      brand_visual_tokens_version: (() => { try { return BrandTruthService.visualTokensVersion(); } catch { return null; } })(),
      image_placement: { role: "BACKGROUND", cover: "full_bleed", focal_point: null, safe_zone_for_subject: "lower two-thirds" },
      text_safe_zones: [{ edge: "top", min_px: 96 }, { edge: "left", min_px: 96 }, { edge: "right", min_px: 96 }, { edge: "bottom", min_px: 180 }],
      deterministic_overlays: [
        { kind: "headline", locked: true, copy_ref: brief?.locked_phrase_set_ref ?? null },
        { kind: "body", locked: true, copy_ref: null },
        { kind: "cta", locked: true, copy_ref: null },
        { kind: "logo", locked: true, copy_ref: null },
      ],
      overlay: overlay !== undefined
        ? overlay
        : (compound ? { type: "gradient", color: "#0B1F33", opacity: 0.45, direction: "bottom" } : { type: "none" }),
      locked_copy_refs: [brief?.locked_phrase_set_ref].filter(Boolean),
      safety_constraints: [...new Set(safetyConstraints)],
      exclusions: grounding.exclusions,
      status: "READY",
      created_at: new Date().toISOString(),
    };
    validate("visual-asset-spec.schema.json", spec, spec.id);
    return spec;
  },

  save(spec, { scope = "production" } = {}) { return save("visual-asset-specs", spec, { scope }); },
  get(id) { return all("visual-asset-specs").find((x) => x.id === id) || null; },
};
