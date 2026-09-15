// MAE Social Design — Wave S-F SYNTHETIC source-media fixtures.
// TEST DATA ONLY: every entry carries `synthetic: true` / `_fixture_origin: "synthetic"`.
// Synthetic media is NOT customer proof, NOT product proof, NOT evidence.
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeSocialSourceMedia } from "../media/social-source-media.js";
import { adaptDesignSpecification, PLATFORM_PROFILES } from "../services/social-platforms.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DAY6_SPEC = JSON.parse(readFileSync(join(root, "mae/data/fixtures/social/SD-CSEC-006.json"), "utf8"));
export const DAY6_HEADLINE = "Nobody tells you what standing up feels like on day 6.";
export const SYNTHETIC = Object.freeze({ _fixture_origin: "synthetic", fixture_note: "Synthetic test fixture — never production truth, proof or evidence." });

const clone = (o) => JSON.parse(JSON.stringify(o));
const svgBytes = (w, h) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#1B2A3A"/></svg>`);
const dataUri = (w, h) => `data:image/svg+xml;base64,${svgBytes(w, h).toString("base64")}`;

/** Already-resolved synthetic source media (registry). */
export const MEDIA_SOURCES = Object.freeze({
  "SYN-PHOTO-1": normalizeSocialSourceMedia({ source_type: "SYNTHETIC_FIXTURE", mime: "image/svg+xml", width: 1080, height: 1350, checksum: "SYN-CHK-PHOTO-1", uri: dataUri(1080, 1350), focal: "center", fit: "cover", synthetic: true, provenance: { source_classification: "synthetic_fixture", synthetic: true } }).source,
  "SYN-IMG-ART-1": normalizeSocialSourceMedia({ source_type: "IMAGE_ARTIFACT", mime: "image/png", width: 1024, height: 1024, checksum: "SYN-CHK-IMGART-1", uri: "artifact://SYN-IMG-ART-1", artist: null, provenance: { generated: true, source_classification: "generated", provider: "fixture-provider", model: "fixture-model", artifact_id: "SYN-IMG-ART-1", visual_grounding_id: "VG-CSEC-006", prompt_record_ref: "SYN-IMG-PROMPT-1" } }).source,
  "SYN-PRODUCT-1": normalizeSocialSourceMedia({ source_type: "PRODUCT_IMAGE", mime: "image/png", width: 1200, height: 1200, checksum: "SYN-CHK-PRODUCT-1", uri: "artifact://SYN-PRODUCT-1", provenance: { source_classification: "supplied" } }).source,
  "SYN-ILLUSTRATION-1": normalizeSocialSourceMedia({ source_type: "ILLUSTRATION", mime: "image/svg+xml", width: 1600, height: 1200, checksum: "SYN-CHK-ILLUS-1", uri: dataUri(1600, 1200), provenance: { source_classification: "internal_illustration" } }).source,
  "SYN-VIDEOFRAME-1": normalizeSocialSourceMedia({ source_type: "VIDEO_FRAME_ARTIFACT", mime: "image/jpeg", width: 1920, height: 1080, checksum: "SYN-CHK-VFRAME-1", uri: "artifact://SYN-VIDEOFRAME-1", video_artifact_id: "SYN-VID-ART-1", frame_timestamp: 3.5, derived_frame_artifact_id: "SYN-VID-FRAME-1", provenance: { source_classification: "video_frame" } }).source,
});

const profileOf = (key) => PLATFORM_PROFILES[key];

/** Adapt the Day-6 angle to a placement with a bound synthetic source slot. */
export function day6MediaSpec(profileKey, { design_id, layout_family = "IMAGE_DOMINANT", source_id = "SYN-PHOTO-1", slot_id = "hero", mode = "PHOTO_PLUS_TYPE", treatment = "none" } = {}) {
  const adapted = adaptDesignSpecification({ spec: DAY6_SPEC, platform: profileOf(profileKey).platform, placement: profileOf(profileKey).placement, platform_format: profileOf(profileKey).platform_format }).design_specification;
  return {
    ...adapted,
    design_id,
    layout_family,
    production_mode: mode,
    visual_slots: [{ slot_id, media_type: "photo", required: true, fit: "cover", focal: "center", fallback: "TYPE_ONLY", treatment, source: { artifact_id: source_id } }],
    required_elements: ["headline"],
    ...SYNTHETIC,
  };
}

/** Synthetic product hero (no product facts inferred from the image). */
export function productHeroSpec(profileKey = "instagram|feed") {
  const p = profileOf(profileKey);
  const adapted = adaptDesignSpecification({ spec: DAY6_SPEC, platform: p.platform, placement: p.placement, platform_format: p.platform_format }).design_specification;
  return {
    ...adapted,
    design_id: "SF-PRODUCT-HERO",
    asset_purpose: "PRODUCT_CONVERSION",
    content_pattern: "FEATURE_BENEFIT",
    layout_family: "PRODUCT_HERO",
    production_mode: "PRODUCT_VISUAL_PLUS_LAYOUT",
    visual_slots: [{ slot_id: "product", media_type: "product_image", required: true, fit: "contain", focal: "center", fallback: "SOURCE_REQUIRED", source: { artifact_id: "SYN-PRODUCT-1" } }],
    copy_blocks: [
      { copy_id: "SF-PH-name", role: "product_name", text: "Synthetic Product" },
      { copy_id: "SF-PH-headline", role: "headline", text: "Synthetic product heading" },
      { copy_id: "SF-PH-price", role: "price", text: "USD 29" },
    ],
    required_elements: ["product_name"],
    provenance: { ...adapted.provenance, truth_refs: ["SYN-PTR-1"] },
    ...SYNTHETIC,
  };
}

/** Synthetic illustration composition. */
export function illustrationSpec(profileKey = "instagram|feed") {
  const p = profileOf(profileKey);
  const adapted = adaptDesignSpecification({ spec: DAY6_SPEC, platform: p.platform, placement: p.placement, platform_format: p.platform_format }).design_specification;
  return {
    ...adapted,
    design_id: "SF-ILLUSTRATION",
    layout_family: "SPLIT",
    production_mode: "ILLUSTRATION_PLUS_TYPE",
    visual_slots: [{ slot_id: "art", media_type: "illustration", required: true, fit: "contain", focal: "top", fallback: "SOURCE_REQUIRED", source: { artifact_id: "SYN-ILLUSTRATION-1" } }],
    copy_blocks: [{ copy_id: "SF-IL-headline", role: "headline", text: "Synthetic illustration headline" }],
    required_elements: ["headline"],
    ...SYNTHETIC,
  };
}

/** Synthetic already-resolved video frame used for a video cover (no extraction). */
export function videoCoverSpec(profileKey = "youtube|video_thumbnail") {
  const p = profileOf(profileKey);
  const adapted = adaptDesignSpecification({ spec: DAY6_SPEC, platform: p.platform, placement: p.placement, platform_format: p.platform_format }).design_specification;
  return {
    ...adapted,
    design_id: "SF-VIDEO-COVER",
    layout_family: "FULL_BLEED",
    production_mode: "PHOTO_PLUS_TYPE",
    visual_slots: [{ slot_id: "frame", media_type: "photo", required: true, fit: "cover", focal: "center", fallback: "TYPE_ONLY", treatment: "scrim", source: { artifact_id: "SYN-VIDEOFRAME-1" } }],
    copy_blocks: [{ copy_id: "SF-VC-headline", role: "headline", text: "Synthetic video cover headline" }],
    required_elements: ["headline"],
    ...SYNTHETIC,
  };
}

/** Mixed-media carousel: COVER image + headline · EXPLAIN type-only · ACT product image + approved CTA. */
export function mixedMediaCarousel() {
  const p = profileOf("instagram|carousel");
  const adapted = adaptDesignSpecification({ spec: DAY6_SPEC, platform: p.platform, placement: p.placement, platform_format: p.platform_format }).design_specification;
  const slide = (i, role, purpose, pattern, layout, blocks, slots = []) => ({ slide_index: i, sequence_role: role, asset_purpose: purpose, content_pattern: pattern, layout_family: layout, copy_blocks: blocks, visual_slots: slots });
  return {
    ...adapted,
    design_id: "SF-MIXED-CAROUSEL",
    asset_type: "SOCIAL_CAROUSEL",
    slide_count: 3,
    continuity_group: "CG-SF-MIXED",
    layout_family: "TYPE_DOMINANT",
    production_mode: "PHOTO_PLUS_TYPE",
    copy_blocks: [{ copy_id: "SF-MC-headline", role: "headline", text: DAY6_HEADLINE, required: true }, { copy_id: "SF-MC-cta", role: "cta", text: "Synthetic CTA copy." }],
    slides: [
      slide(1, "COVER", "STOP_SCROLL", "TYPOGRAPHIC_HOOK", "IMAGE_DOMINANT", [{ copy_id: "SF-MC-s1", role: "headline", text: DAY6_HEADLINE }], [{ slot_id: "cover-image", media_type: "photo", required: true, fit: "cover", focal: "center", fallback: "SOURCE_REQUIRED", source: { artifact_id: "SYN-PHOTO-1" } }]),
      slide(2, "EXPLAIN", "EDUCATION", "STEPS", "LIST", [{ copy_id: "SF-MC-s2", role: "body", text: "Synthetic type-only panel copy." }, { copy_id: "SF-MC-s2b", role: "list_item", text: "Synthetic item one." }, { copy_id: "SF-MC-s2c", role: "list_item", text: "Synthetic item two." }]),
      slide(3, "ACT", "PRODUCT_CONVERSION", "FEATURE_BENEFIT", "PRODUCT_HERO", [{ copy_id: "SF-MC-s3", role: "product_name", text: "Synthetic Product" }, { copy_id: "SF-MC-s3b", role: "cta", text: "Synthetic CTA copy." }], [{ slot_id: "act-product", media_type: "product_image", required: true, fit: "contain", focal: "center", fallback: "SOURCE_REQUIRED", source: { artifact_id: "SYN-PRODUCT-1" } }]),
    ],
    cta_policy: { required: true, copy_role: "cta", placement: "LAST_PANEL", prominence: "HIGH" },
    provenance: { ...adapted.provenance, truth_refs: ["SYN-PTR-1"] },
    ...SYNTHETIC,
  };
}
