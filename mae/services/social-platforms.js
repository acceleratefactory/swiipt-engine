// MAE · Social Design Production — Platform / Placement Profiles (Wave S-D).
// Resolves WHAT a declared platform/placement/format MEANS geometrically (canvas, safe zones, layout
// eligibility, media policy). It never decides angle, truth, claims, price, copy or CTA wording.
//
// Separation of concerns: S-A declares the placement/format; THIS module owns platform dimensions.
// Also provides deterministic cross-placement adaptation with approved layout fallback.
// No provider calls, no image/video generation, no raster, no SocialGraphicQA, no network.
import { compareAspectRatio } from "../media/image-provider.js";
import { LAYOUT_FAMILIES, PLATFORM_FORMATS, ASSET_TYPES } from "./social-design-spec.js";

export const PLATFORM_PROFILES_VERSION = "1.0";   // set version; platform rules can change later
export const PROFILE_STATUS = Object.freeze({
  RESOLVED: "RESOLVED",
  UNSUPPORTED_PLATFORM_PLACEMENT: "UNSUPPORTED_PLATFORM_PLACEMENT",
  PLATFORM_PROFILE_MISMATCH: "PLATFORM_PROFILE_MISMATCH",
  INVALID_PROFILE: "INVALID_PROFILE",
});
export const SOURCE_CLASS = Object.freeze({ PLATFORM_CONSTRAINT: "platform_constraint", SWIIPT_DESIGN_POLICY: "swiipt_design_policy" });
export const MEDIA_POLICY = Object.freeze({ REQUIRED: "REQUIRED", OPTIONAL: "OPTIONAL", DISALLOWED: "DISALLOWED" });

const ALL_STATIC = [...LAYOUT_FAMILIES].filter((f) => f !== "MULTI_PANEL");
const DENSE_OK = ALL_STATIC;                                             // feed/story/carousel: every static family
const PACKAGING_OK = ["TYPE_DOMINANT", "IMAGE_DOMINANT", "SPLIT", "EDITORIAL", "PRODUCT_HERO", "QUOTE_FOCUS"];
const TYPE_FIRST = ["TYPE_DOMINANT", "EDITORIAL", "SPLIT", "IMAGE_DOMINANT"];

const SAFE = (top, bottom, left, right) => ({ top, bottom, left, right });
const CANVAS = (width, height, aspect_ratio) => ({ width, height, aspect_ratio });

/**
 * V1 profile set. `field_sources` distinguishes platform constraints (canvas/aspect) from Swiipt
 * design policy (safe insets, density, logo/CTA, layout preference). Values are FROZEN V1 config —
 * they are not claims about permanently-current platform rules.
 */
export const PLATFORM_PROFILES = Object.freeze({
  // ---- Instagram -------------------------------------------------------------
  "instagram|feed": {
    profile_id: "instagram.feed", profile_version: PLATFORM_PROFILES_VERSION, platform: "instagram", placement: "feed",
    platform_format: "FEED_PORTRAIT", accepted_formats: ["FEED_PORTRAIT", "FEED_SQUARE"], asset_type_hint: "SOCIAL_STATIC",
    canvas: CANVAS(1080, 1350, "4:5"), safe_zones: SAFE(120, 220, 72, 72),
    content_constraints: { max_text_density: "STANDARD", minimum_type_size: 44, recommended_headline_lines: 3, mobile_legibility: "required" },
    layout_policy: { allowed_layout_families: DENSE_OK, preferred_layout_families: TYPE_FIRST, prohibited_layout_families: [] },
    logo_policy: { required: false, placement: "TOP_LEFT", min_size_px: 32 },
    cta_policy: { allowed: true, expected_placement: "BOTTOM" },
    source_media_policy: { mode: MEDIA_POLICY.OPTIONAL, allows_type_only: true, allows_product_image: true, allows_source_frame: false, allows_generated_image: true },
    crop_policy: { mode: "cover", focal: "center" },
    packaging_policy: { requires_high_legibility: false, supports_face_or_subject_region: false, supports_text_region: true, supports_logo: true, supports_badge: true },
    field_sources: { canvas: SOURCE_CLASS.PLATFORM_CONSTRAINT, safe_zones: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, layout_policy: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, content_constraints: SOURCE_CLASS.SWIIPT_DESIGN_POLICY },
  },
  "instagram|carousel": {
    profile_id: "instagram.carousel", profile_version: PLATFORM_PROFILES_VERSION, platform: "instagram", placement: "carousel",
    platform_format: "CAROUSEL_SLIDE", accepted_formats: ["CAROUSEL_SLIDE"], asset_type_hint: "SOCIAL_CAROUSEL",
    canvas: CANVAS(1080, 1350, "4:5"), safe_zones: SAFE(120, 220, 72, 72),
    content_constraints: { max_text_density: "STANDARD", minimum_type_size: 44, recommended_headline_lines: 3, mobile_legibility: "required" },
    layout_policy: { allowed_layout_families: DENSE_OK, preferred_layout_families: TYPE_FIRST, prohibited_layout_families: [] },
    logo_policy: { required: false, placement: "TOP_LEFT", min_size_px: 32 },
    cta_policy: { allowed: true, expected_placement: "LAST_PANEL" },
    source_media_policy: { mode: MEDIA_POLICY.OPTIONAL, allows_type_only: true, allows_product_image: true, allows_source_frame: false, allows_generated_image: true },
    crop_policy: { mode: "cover", focal: "center" },
    packaging_policy: { requires_high_legibility: false, supports_face_or_subject_region: false, supports_text_region: true, supports_logo: true, supports_badge: true },
    field_sources: { canvas: SOURCE_CLASS.PLATFORM_CONSTRAINT, safe_zones: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, layout_policy: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, content_constraints: SOURCE_CLASS.SWIIPT_DESIGN_POLICY },
  },
  "instagram|story": {
    profile_id: "instagram.story", profile_version: PLATFORM_PROFILES_VERSION, platform: "instagram", placement: "story",
    platform_format: "STORY_VERTICAL", accepted_formats: ["STORY_VERTICAL"], asset_type_hint: "SOCIAL_STORY_SEQUENCE",
    canvas: CANVAS(1080, 1920, "9:16"), safe_zones: SAFE(250, 340, 72, 72),
    content_constraints: { max_text_density: "SPARSE", minimum_type_size: 44, recommended_headline_lines: 3, mobile_legibility: "critical" },
    layout_policy: { allowed_layout_families: DENSE_OK, preferred_layout_families: ["TYPE_DOMINANT", "IMAGE_DOMINANT"], prohibited_layout_families: [] },
    logo_policy: { required: false, placement: "TOP_CENTER", min_size_px: 32 },
    cta_policy: { allowed: true, expected_placement: "LINK_ZONE" },
    source_media_policy: { mode: MEDIA_POLICY.OPTIONAL, allows_type_only: true, allows_product_image: true, allows_source_frame: true, allows_generated_image: true },
    crop_policy: { mode: "cover", focal: "center" },
    packaging_policy: { requires_high_legibility: true, supports_face_or_subject_region: true, supports_text_region: true, supports_logo: true, supports_badge: true },
    field_sources: { canvas: SOURCE_CLASS.PLATFORM_CONSTRAINT, safe_zones: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, layout_policy: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, content_constraints: SOURCE_CLASS.SWIIPT_DESIGN_POLICY },
  },
  "instagram|reel_cover": {
    profile_id: "instagram.reel_cover", profile_version: PLATFORM_PROFILES_VERSION, platform: "instagram", placement: "reel_cover",
    platform_format: "COVER_PORTRAIT", accepted_formats: ["COVER_PORTRAIT"], asset_type_hint: "SOCIAL_STATIC",
    canvas: CANVAS(1080, 1920, "9:16"), safe_zones: SAFE(320, 480, 72, 72),
    content_constraints: { max_text_density: "SPARSE", minimum_type_size: 48, recommended_headline_lines: 2, mobile_legibility: "critical" },
    layout_policy: { allowed_layout_families: PACKAGING_OK, preferred_layout_families: ["IMAGE_DOMINANT", "TYPE_DOMINANT"], prohibited_layout_families: ["LIST", "TWO_COLUMN", "DATA_FOCUS", "MULTI_PANEL"] },
    logo_policy: { required: false, placement: "TOP_LEFT", min_size_px: 32 },
    cta_policy: { allowed: false, expected_placement: null },
    source_media_policy: { mode: MEDIA_POLICY.OPTIONAL, allows_type_only: true, allows_product_image: true, allows_source_frame: true, allows_generated_image: true },
    crop_policy: { mode: "cover", focal: "center" },
    packaging_policy: { requires_high_legibility: true, supports_face_or_subject_region: true, supports_text_region: true, supports_logo: true, supports_badge: true },
    field_sources: { canvas: SOURCE_CLASS.PLATFORM_CONSTRAINT, safe_zones: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, layout_policy: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, content_constraints: SOURCE_CLASS.SWIIPT_DESIGN_POLICY },
  },
  // ---- Facebook --------------------------------------------------------------
  "facebook|feed": {
    profile_id: "facebook.feed", profile_version: PLATFORM_PROFILES_VERSION, platform: "facebook", placement: "feed",
    platform_format: "FEED_LANDSCAPE", accepted_formats: ["FEED_LANDSCAPE", "FEED_SQUARE"], asset_type_hint: "SOCIAL_STATIC",
    canvas: CANVAS(1200, 630, "40:21"), safe_zones: SAFE(64, 64, 64, 64),
    content_constraints: { max_text_density: "STANDARD", minimum_type_size: 32, recommended_headline_lines: 2, mobile_legibility: "required" },
    layout_policy: { allowed_layout_families: DENSE_OK, preferred_layout_families: ["SPLIT", "TYPE_DOMINANT"], prohibited_layout_families: [] },
    logo_policy: { required: false, placement: "BOTTOM_RIGHT", min_size_px: 28 },
    cta_policy: { allowed: true, expected_placement: "BOTTOM" },
    source_media_policy: { mode: MEDIA_POLICY.OPTIONAL, allows_type_only: true, allows_product_image: true, allows_source_frame: false, allows_generated_image: true },
    crop_policy: { mode: "cover", focal: "center" },
    packaging_policy: { requires_high_legibility: false, supports_face_or_subject_region: false, supports_text_region: true, supports_logo: true, supports_badge: true },
    field_sources: { canvas: SOURCE_CLASS.PLATFORM_CONSTRAINT, safe_zones: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, layout_policy: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, content_constraints: SOURCE_CLASS.SWIIPT_DESIGN_POLICY },
  },
  "facebook|video_cover": {
    profile_id: "facebook.video_cover", profile_version: PLATFORM_PROFILES_VERSION, platform: "facebook", placement: "video_cover",
    platform_format: "FEED_LANDSCAPE", accepted_formats: ["FEED_LANDSCAPE"], asset_type_hint: "SOCIAL_STATIC",
    canvas: CANVAS(1200, 630, "40:21"), safe_zones: SAFE(80, 80, 80, 80),
    content_constraints: { max_text_density: "SPARSE", minimum_type_size: 36, recommended_headline_lines: 2, mobile_legibility: "critical" },
    layout_policy: { allowed_layout_families: PACKAGING_OK, preferred_layout_families: ["IMAGE_DOMINANT", "TYPE_DOMINANT"], prohibited_layout_families: ["LIST", "TWO_COLUMN", "DATA_FOCUS", "MULTI_PANEL"] },
    logo_policy: { required: false, placement: "BOTTOM_RIGHT", min_size_px: 28 },
    cta_policy: { allowed: false, expected_placement: null },
    source_media_policy: { mode: MEDIA_POLICY.OPTIONAL, allows_type_only: true, allows_product_image: true, allows_source_frame: true, allows_generated_image: true },
    crop_policy: { mode: "cover", focal: "center" },
    packaging_policy: { requires_high_legibility: true, supports_face_or_subject_region: true, supports_text_region: true, supports_logo: true, supports_badge: true },
    field_sources: { canvas: SOURCE_CLASS.PLATFORM_CONSTRAINT, safe_zones: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, layout_policy: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, content_constraints: SOURCE_CLASS.SWIIPT_DESIGN_POLICY },
  },
  // ---- WhatsApp --------------------------------------------------------------
  "whatsapp|status": {
    profile_id: "whatsapp.status", profile_version: PLATFORM_PROFILES_VERSION, platform: "whatsapp", placement: "status",
    platform_format: "STORY_VERTICAL", accepted_formats: ["STORY_VERTICAL"], asset_type_hint: "SOCIAL_STATIC",
    canvas: CANVAS(1080, 1920, "9:16"), safe_zones: SAFE(260, 380, 72, 72),
    content_constraints: { max_text_density: "SPARSE", minimum_type_size: 48, recommended_headline_lines: 3, mobile_legibility: "critical" },
    layout_policy: { allowed_layout_families: PACKAGING_OK, preferred_layout_families: ["TYPE_DOMINANT", "IMAGE_DOMINANT"], prohibited_layout_families: ["LIST", "TWO_COLUMN", "DATA_FOCUS", "MULTI_PANEL"] },
    logo_policy: { required: false, placement: "TOP_CENTER", min_size_px: 32 },
    cta_policy: { allowed: true, expected_placement: "LINK_ZONE" },
    source_media_policy: { mode: MEDIA_POLICY.OPTIONAL, allows_type_only: true, allows_product_image: true, allows_source_frame: false, allows_generated_image: true },
    crop_policy: { mode: "cover", focal: "center" },
    packaging_policy: { requires_high_legibility: true, supports_face_or_subject_region: true, supports_text_region: true, supports_logo: true, supports_badge: true },
    field_sources: { canvas: SOURCE_CLASS.PLATFORM_CONSTRAINT, safe_zones: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, layout_policy: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, content_constraints: SOURCE_CLASS.SWIIPT_DESIGN_POLICY },
  },
  "whatsapp|share_card": {
    profile_id: "whatsapp.share_card", profile_version: PLATFORM_PROFILES_VERSION, platform: "whatsapp", placement: "share_card",
    platform_format: "SHARE_CARD", accepted_formats: ["SHARE_CARD"], asset_type_hint: "SOCIAL_STATIC",
    canvas: CANVAS(1200, 630, "40:21"), safe_zones: SAFE(64, 64, 64, 64),
    content_constraints: { max_text_density: "STANDARD", minimum_type_size: 32, recommended_headline_lines: 2, mobile_legibility: "required" },
    layout_policy: { allowed_layout_families: DENSE_OK, preferred_layout_families: ["SPLIT", "TYPE_DOMINANT"], prohibited_layout_families: [] },
    logo_policy: { required: false, placement: "BOTTOM_LEFT", min_size_px: 28 },
    cta_policy: { allowed: false, expected_placement: null },
    source_media_policy: { mode: MEDIA_POLICY.OPTIONAL, allows_type_only: true, allows_product_image: true, allows_source_frame: false, allows_generated_image: true },
    crop_policy: { mode: "cover", focal: "center" },
    packaging_policy: { requires_high_legibility: false, supports_face_or_subject_region: false, supports_text_region: true, supports_logo: true, supports_badge: true },
    field_sources: { canvas: SOURCE_CLASS.PLATFORM_CONSTRAINT, safe_zones: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, layout_policy: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, content_constraints: SOURCE_CLASS.SWIIPT_DESIGN_POLICY },
  },
  // ---- YouTube / TikTok / website -------------------------------------------
  "youtube|video_thumbnail": {
    profile_id: "youtube.video_thumbnail", profile_version: PLATFORM_PROFILES_VERSION, platform: "youtube", placement: "video_thumbnail",
    platform_format: "THUMBNAIL", accepted_formats: ["THUMBNAIL"], asset_type_hint: "SOCIAL_STATIC",
    canvas: CANVAS(1280, 720, "16:9"), safe_zones: SAFE(48, 96, 48, 48),
    content_constraints: { max_text_density: "SPARSE", minimum_type_size: 56, recommended_headline_lines: 2, mobile_legibility: "critical" },
    layout_policy: { allowed_layout_families: PACKAGING_OK, preferred_layout_families: ["TYPE_DOMINANT", "IMAGE_DOMINANT"], prohibited_layout_families: ["LIST", "TWO_COLUMN", "DATA_FOCUS", "MULTI_PANEL"] },
    logo_policy: { required: false, placement: "BOTTOM_LEFT", min_size_px: 36 },
    cta_policy: { allowed: false, expected_placement: null },
    source_media_policy: { mode: MEDIA_POLICY.OPTIONAL, allows_type_only: true, allows_product_image: true, allows_source_frame: true, allows_generated_image: true },
    crop_policy: { mode: "cover", focal: "center" },
    packaging_policy: { requires_high_legibility: true, supports_face_or_subject_region: true, supports_text_region: true, supports_logo: true, supports_badge: true },
    field_sources: { canvas: SOURCE_CLASS.PLATFORM_CONSTRAINT, safe_zones: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, layout_policy: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, content_constraints: SOURCE_CLASS.SWIIPT_DESIGN_POLICY },
  },
  "tiktok|video_cover": {
    profile_id: "tiktok.video_cover", profile_version: PLATFORM_PROFILES_VERSION, platform: "tiktok", placement: "video_cover",
    platform_format: "COVER_PORTRAIT", accepted_formats: ["COVER_PORTRAIT"], asset_type_hint: "SOCIAL_STATIC",
    canvas: CANVAS(1080, 1920, "9:16"), safe_zones: SAFE(320, 440, 72, 72),
    content_constraints: { max_text_density: "SPARSE", minimum_type_size: 48, recommended_headline_lines: 2, mobile_legibility: "critical" },
    layout_policy: { allowed_layout_families: PACKAGING_OK, preferred_layout_families: ["IMAGE_DOMINANT", "TYPE_DOMINANT"], prohibited_layout_families: ["LIST", "TWO_COLUMN", "DATA_FOCUS", "MULTI_PANEL"] },
    logo_policy: { required: false, placement: "BOTTOM_LEFT", min_size_px: 32 },
    cta_policy: { allowed: false, expected_placement: null },
    source_media_policy: { mode: MEDIA_POLICY.OPTIONAL, allows_type_only: true, allows_product_image: true, allows_source_frame: true, allows_generated_image: true },
    crop_policy: { mode: "cover", focal: "center" },
    packaging_policy: { requires_high_legibility: true, supports_face_or_subject_region: true, supports_text_region: true, supports_logo: true, supports_badge: true },
    field_sources: { canvas: SOURCE_CLASS.PLATFORM_CONSTRAINT, safe_zones: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, layout_policy: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, content_constraints: SOURCE_CLASS.SWIIPT_DESIGN_POLICY },
  },
  "website|video_poster": {
    profile_id: "website.video_poster", profile_version: PLATFORM_PROFILES_VERSION, platform: "website", placement: "video_poster",
    platform_format: "THUMBNAIL", accepted_formats: ["THUMBNAIL", "FEED_LANDSCAPE"], asset_type_hint: "SOCIAL_STATIC",
    canvas: CANVAS(1280, 720, "16:9"), safe_zones: SAFE(48, 64, 48, 48),
    content_constraints: { max_text_density: "SPARSE", minimum_type_size: 40, recommended_headline_lines: 2, mobile_legibility: "required" },
    layout_policy: { allowed_layout_families: PACKAGING_OK, preferred_layout_families: ["IMAGE_DOMINANT", "SPLIT"], prohibited_layout_families: ["LIST", "TWO_COLUMN", "DATA_FOCUS", "MULTI_PANEL"] },
    logo_policy: { required: false, placement: "BOTTOM_RIGHT", min_size_px: 28 },
    cta_policy: { allowed: false, expected_placement: null },
    source_media_policy: { mode: MEDIA_POLICY.OPTIONAL, allows_type_only: true, allows_product_image: true, allows_source_frame: true, allows_generated_image: true },
    crop_policy: { mode: "cover", focal: "center" },
    packaging_policy: { requires_high_legibility: true, supports_face_or_subject_region: true, supports_text_region: true, supports_logo: true, supports_badge: true },
    field_sources: { canvas: SOURCE_CLASS.PLATFORM_CONSTRAINT, safe_zones: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, layout_policy: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, content_constraints: SOURCE_CLASS.SWIIPT_DESIGN_POLICY },
  },
  // ---- Internal / media packaging namespaces ---------------------------------
  "course|lesson_thumbnail": {
    profile_id: "course.lesson_thumbnail", profile_version: PLATFORM_PROFILES_VERSION, platform: "course", placement: "lesson_thumbnail",
    platform_format: "THUMBNAIL", accepted_formats: ["THUMBNAIL"], asset_type_hint: "SOCIAL_STATIC",
    canvas: CANVAS(1280, 720, "16:9"), safe_zones: SAFE(48, 64, 48, 48),
    content_constraints: { max_text_density: "STANDARD", minimum_type_size: 40, recommended_headline_lines: 3, mobile_legibility: "required" },
    layout_policy: { allowed_layout_families: PACKAGING_OK, preferred_layout_families: ["TYPE_DOMINANT", "SPLIT"], prohibited_layout_families: ["TWO_COLUMN", "DATA_FOCUS", "MULTI_PANEL"] },
    logo_policy: { required: false, placement: "TOP_LEFT", min_size_px: 28 },
    cta_policy: { allowed: false, expected_placement: null },
    source_media_policy: { mode: MEDIA_POLICY.OPTIONAL, allows_type_only: true, allows_product_image: true, allows_source_frame: true, allows_generated_image: true },
    crop_policy: { mode: "cover", focal: "center" },
    packaging_policy: { requires_high_legibility: true, supports_face_or_subject_region: false, supports_text_region: true, supports_logo: true, supports_badge: true },
    field_sources: { canvas: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, safe_zones: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, layout_policy: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, content_constraints: SOURCE_CLASS.SWIIPT_DESIGN_POLICY },
  },
  "product_demo|video_cover": {
    profile_id: "product_demo.video_cover", profile_version: PLATFORM_PROFILES_VERSION, platform: "product_demo", placement: "video_cover",
    platform_format: "THUMBNAIL", accepted_formats: ["THUMBNAIL"], asset_type_hint: "SOCIAL_STATIC",
    canvas: CANVAS(1280, 720, "16:9"), safe_zones: SAFE(48, 64, 48, 48),
    content_constraints: { max_text_density: "SPARSE", minimum_type_size: 40, recommended_headline_lines: 2, mobile_legibility: "required" },
    layout_policy: { allowed_layout_families: PACKAGING_OK, preferred_layout_families: ["PRODUCT_HERO", "IMAGE_DOMINANT"], prohibited_layout_families: ["LIST", "TWO_COLUMN", "DATA_FOCUS", "MULTI_PANEL"] },
    logo_policy: { required: false, placement: "BOTTOM_RIGHT", min_size_px: 28 },
    cta_policy: { allowed: false, expected_placement: null },
    source_media_policy: { mode: MEDIA_POLICY.OPTIONAL, allows_type_only: true, allows_product_image: true, allows_source_frame: true, allows_generated_image: true },
    crop_policy: { mode: "cover", focal: "center" },
    packaging_policy: { requires_high_legibility: true, supports_face_or_subject_region: false, supports_text_region: true, supports_logo: true, supports_badge: true },
    field_sources: { canvas: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, safe_zones: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, layout_policy: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, content_constraints: SOURCE_CLASS.SWIIPT_DESIGN_POLICY },
  },
  "webinar|event_cover": {
    profile_id: "webinar.event_cover", profile_version: PLATFORM_PROFILES_VERSION, platform: "webinar", placement: "event_cover",
    platform_format: "FEED_LANDSCAPE", accepted_formats: ["FEED_LANDSCAPE"], asset_type_hint: "SOCIAL_STATIC",
    canvas: CANVAS(1200, 630, "40:21"), safe_zones: SAFE(64, 64, 64, 64),
    content_constraints: { max_text_density: "STANDARD", minimum_type_size: 32, recommended_headline_lines: 2, mobile_legibility: "required" },
    layout_policy: { allowed_layout_families: PACKAGING_OK, preferred_layout_families: ["SPLIT", "TYPE_DOMINANT"], prohibited_layout_families: ["LIST", "MULTI_PANEL"] },
    logo_policy: { required: false, placement: "TOP_LEFT", min_size_px: 28 },
    cta_policy: { allowed: true, expected_placement: "BOTTOM" },
    source_media_policy: { mode: MEDIA_POLICY.OPTIONAL, allows_type_only: true, allows_product_image: false, allows_source_frame: true, allows_generated_image: true },
    crop_policy: { mode: "cover", focal: "center" },
    packaging_policy: { requires_high_legibility: true, supports_face_or_subject_region: true, supports_text_region: true, supports_logo: true, supports_badge: true },
    field_sources: { canvas: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, safe_zones: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, layout_policy: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, content_constraints: SOURCE_CLASS.SWIIPT_DESIGN_POLICY },
  },
  "podcast|video_episode_cover": {
    profile_id: "podcast.video_episode_cover", profile_version: PLATFORM_PROFILES_VERSION, platform: "podcast", placement: "video_episode_cover",
    platform_format: "THUMBNAIL", accepted_formats: ["THUMBNAIL"], asset_type_hint: "SOCIAL_STATIC",
    canvas: CANVAS(1280, 720, "16:9"), safe_zones: SAFE(48, 64, 48, 48),
    content_constraints: { max_text_density: "SPARSE", minimum_type_size: 40, recommended_headline_lines: 2, mobile_legibility: "required" },
    layout_policy: { allowed_layout_families: PACKAGING_OK, preferred_layout_families: ["IMAGE_DOMINANT", "TYPE_DOMINANT"], prohibited_layout_families: ["LIST", "TWO_COLUMN", "DATA_FOCUS", "MULTI_PANEL"] },
    logo_policy: { required: false, placement: "BOTTOM_RIGHT", min_size_px: 28 },
    cta_policy: { allowed: false, expected_placement: null },
    source_media_policy: { mode: MEDIA_POLICY.OPTIONAL, allows_type_only: true, allows_product_image: false, allows_source_frame: true, allows_generated_image: true },
    crop_policy: { mode: "cover", focal: "center" },
    packaging_policy: { requires_high_legibility: true, supports_face_or_subject_region: true, supports_text_region: true, supports_logo: true, supports_badge: false },
    field_sources: { canvas: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, safe_zones: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, layout_policy: SOURCE_CLASS.SWIIPT_DESIGN_POLICY, content_constraints: SOURCE_CLASS.SWIIPT_DESIGN_POLICY },
  },
});

export const PROFILE_KEYS = Object.freeze(Object.keys(PLATFORM_PROFILES));

/** Deterministic resolution. Unknown/unsupported combinations fail explicitly (no silent fallback). */
export function resolvePlatformPlacementProfile({ platform, placement, platform_format = null } = {}) {
  if (!platform || !placement) return { ok: false, status: PROFILE_STATUS.UNSUPPORTED_PLATFORM_PLACEMENT, profile: null, error: "platform and placement are required" };
  const profile = PLATFORM_PROFILES[`${platform}|${placement}`];
  if (!profile) return { ok: false, status: PROFILE_STATUS.UNSUPPORTED_PLATFORM_PLACEMENT, profile: null, error: `unsupported platform/placement "${platform}|${placement}"` };
  if (platform_format != null) {
    if (!PLATFORM_FORMATS.includes(platform_format)) return { ok: false, status: PROFILE_STATUS.INVALID_PROFILE, profile, error: `unknown platform_format "${platform_format}"` };
    if (!profile.accepted_formats.includes(platform_format)) return { ok: false, status: PROFILE_STATUS.PLATFORM_PROFILE_MISMATCH, profile, error: `format ${platform_format} not accepted by ${profile.profile_id} (accepts ${profile.accepted_formats.join(", ")})` };
  }
  return { ok: true, status: PROFILE_STATUS.RESOLVED, profile, error: null };
}

const stricter = (a, b) => ({ top: Math.max(a.top, b.top), bottom: Math.max(a.bottom, b.bottom), left: Math.max(a.left, b.left), right: Math.max(a.right, b.right) });

/** Effective safe area = stricter of spec and profile (a profile never weakens an explicit spec inset). */
export function effectiveSafeZones(spec, profile) {
  const s = { top: spec?.safe_zones?.top ?? 0, bottom: spec?.safe_zones?.bottom ?? 0, left: spec?.safe_zones?.left ?? 0, right: spec?.safe_zones?.right ?? 0 };
  const p = profile?.safe_zones ?? { top: 0, bottom: 0, left: 0, right: 0 };
  return stricter(s, p);
}

/** Deterministic consistency check between a specification and the resolved profile. */
export function validateSpecAgainstProfile(spec = {}, profile) {
  const errors = [];
  if (!profile) return { valid: false, status: PROFILE_STATUS.INVALID_PROFILE, errors: ["no profile"] };
  if (spec.platform !== profile.platform) errors.push(`platform "${spec.platform}" does not match profile "${profile.platform}"`);
  if (spec.placement !== profile.placement) errors.push(`placement "${spec.placement}" does not match profile "${profile.placement}"`);
  if (spec.platform_format != null && !profile.accepted_formats.includes(spec.platform_format)) errors.push(`platform_format "${spec.platform_format}" not accepted by ${profile.profile_id}`);
  if (profile.asset_type_hint && ASSET_TYPES.includes(spec.asset_type) && spec.asset_type !== profile.asset_type_hint) errors.push(`asset_type "${spec.asset_type}" does not match profile hint "${profile.asset_type_hint}"`);
  const c = spec.canvas || {};
  if (Number.isFinite(c.width) && Number.isFinite(c.height)) {
    const rc = compareAspectRatio(`${c.width}:${c.height}`, `${profile.canvas.width}:${profile.canvas.height}`);
    if (c.width !== profile.canvas.width || c.height !== profile.canvas.height) {
      // canvas must match the profile exactly, or at least be aspect-compatible with it
      if (rc.match === false) errors.push(`canvas aspect ratio incompatible with profile (spec ${c.width}x${c.height} vs profile ${profile.canvas.width}x${profile.canvas.height})`);
      else errors.push(`canvas ${c.width}x${c.height} differs from profile canvas ${profile.canvas.width}x${profile.canvas.height} (no silent resizing)`);
    }
  } else errors.push("spec canvas is required for profile validation");
  const eff = effectiveSafeZones(spec, profile);
  if (c.width && eff.left + eff.right >= c.width) errors.push("effective safe zones leave no drawable width");
  if (c.height && eff.top + eff.bottom >= c.height) errors.push("effective safe zones leave no drawable height");
  return { valid: errors.length === 0, status: errors.length ? PROFILE_STATUS.PLATFORM_PROFILE_MISMATCH : PROFILE_STATUS.RESOLVED, errors };
}

/** Approved deterministic layout fallback when the target profile disallows the source family. */
export function resolveLayoutFamily(profile, sourceLayoutFamily) {
  if (!profile) return { layout_family: sourceLayoutFamily, fallback: false, fallback_reason: null };
  if (profile.layout_policy.allowed_layout_families.includes(sourceLayoutFamily)) return { layout_family: sourceLayoutFamily, fallback: false, fallback_reason: null };
  const preferred = profile.layout_policy.preferred_layout_families.filter((f) => profile.layout_policy.allowed_layout_families.includes(f));
  const fallback = preferred[0] ?? profile.layout_policy.allowed_layout_families[0] ?? null;
  return { layout_family: fallback, fallback: true, fallback_reason: `"${sourceLayoutFamily}" not allowed by ${profile.profile_id}; approved fallback "${fallback}"` };
}

/**
 * Deterministic cross-placement adaptation. Copy / angle / truth references are NEVER altered.
 * Canvas, safe zones, layout family (with recorded fallback) and placement metadata are adapted.
 */
export function adaptDesignSpecification({ spec = {}, platform, placement, platform_format = null } = {}) {
  const res = resolvePlatformPlacementProfile({ platform, placement, platform_format: platform_format ?? spec.platform_format });
  const base = { status: res.status, design_specification: null, changes: [], fallback: null, warnings: [], errors: res.error ? [res.error] : [], platform_profile: res.profile ? { profile_id: res.profile.profile_id, profile_version: res.profile.profile_version } : null };
  if (!res.ok) return base;
  const profile = res.profile;
  const layout = resolveLayoutFamily(profile, spec.layout_family);
  if (!layout.layout_family) return { ...base, status: PROFILE_STATUS.INVALID_PROFILE, errors: ["profile has no eligible layout family"] };
  const derived = {
    ...spec,
    platform: profile.platform,
    placement: profile.placement,
    platform_format: platform_format ?? profile.platform_format,
    canvas: { ...profile.canvas },
    safe_zones: effectiveSafeZones(spec, profile),
    layout_family: layout.layout_family,
    provenance: { ...(spec.provenance || {}), profile_id: profile.profile_id, profile_version: profile.profile_version, source_platform: spec.platform, source_placement: spec.placement, source_layout_family: spec.layout_family, adapted: true },
  };
  const changes = [];
  if (spec.platform !== profile.platform || spec.placement !== profile.placement) changes.push("platform/placement");
  if (spec.canvas?.width !== profile.canvas.width || spec.canvas?.height !== profile.canvas.height) changes.push("canvas");
  if (layout.fallback) changes.push("layout_family");
  const warnings = [];
  if (layout.fallback) warnings.push(layout.fallback_reason);
  return { ...base, status: PROFILE_STATUS.RESOLVED, design_specification: derived, changes, fallback: layout.fallback ? layout : null, warnings };
}

/** Media-packaging capability query (capabilities only — never decides what should appear). */
export function packagingCapabilities(profile) {
  if (!profile) return null;
  return {
    profile_id: profile.profile_id,
    requires_high_legibility: profile.packaging_policy?.requires_high_legibility === true,
    allows_source_frame: profile.source_media_policy?.allows_source_frame === true,
    allows_generated_image: profile.source_media_policy?.allows_generated_image === true,
    allows_product_image: profile.source_media_policy?.allows_product_image === true,
    allows_type_only: profile.source_media_policy?.allows_type_only === true,
    supports_face_or_subject_region: profile.packaging_policy?.supports_face_or_subject_region === true,
    supports_text_region: profile.packaging_policy?.supports_text_region === true,
    supports_logo: profile.packaging_policy?.supports_logo === true,
    supports_badge: profile.packaging_policy?.supports_badge === true,
    source_media_mode: profile.source_media_policy?.mode ?? null,
  };
}

export function listPlatformProfiles() {
  return PROFILE_KEYS.map((k) => { const p = PLATFORM_PROFILES[k]; return { key: k, profile_id: p.profile_id, platform: p.platform, placement: p.placement, platform_format: p.platform_format, asset_type_hint: p.asset_type_hint, canvas: { ...p.canvas } }; });
}
