// MAE Social Design — Wave S-D SYNTHETIC qualification fixtures (SD-1 … SD-12).
// These are TEST DATA ONLY: every fixture carries `_fixture_origin: "synthetic"`. They are NOT Customer
// Truth, Product Truth, Market Truth, testimonials or proof, and must never enter production records.
// All copy is synthetic except the Day-6 angle hook, which is the existing approved copy.
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PLATFORM_PROFILES } from "../services/social-platforms.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DAY6_SPEC = JSON.parse(readFileSync(join(root, "mae/data/fixtures/social/SD-CSEC-006.json"), "utf8"));
export const DAY6_HEADLINE = "Nobody tells you what standing up feels like on day 6.";
export const SYNTHETIC = Object.freeze({ _fixture_origin: "synthetic", fixture_note: "Synthetic test fixture — not truth, not proof, never a production record." });

const clone = (o) => JSON.parse(JSON.stringify(o));
const canvasOf = (profile) => ({ ...PLATFORM_PROFILES[profile].canvas });
const meta = (profile) => { const p = PLATFORM_PROFILES[profile]; return { platform: p.platform, placement: p.placement, platform_format: p.platform_format, canvas: canvasOf(profile), safe_zones: { ...p.safe_zones } }; };

/** Static placement fixture derived from the Day-6 angle (copy preserved verbatim). */
function staticFrom(profileKey, { design_id, layout_family = "TYPE_DOMINANT", copy_blocks = null, visual_slots = [], production_mode = "DETERMINISTIC_TYPE_ONLY", extra = {} } = {}) {
  const p = PLATFORM_PROFILES[profileKey];
  return {
    ...clone(DAY6_SPEC),
    ...meta(profileKey),
    design_id, asset_type: "SOCIAL_STATIC", layout_family, visual_slots, production_mode,
    required_elements: ["headline"],
    copy_blocks: copy_blocks ?? [{ copy_id: `${design_id}-headline`, role: "headline", text: DAY6_HEADLINE, required: true }],
    accessibility: { ...DAY6_SPEC.accessibility },
    provenance: { ...DAY6_SPEC.provenance, profile_id: p.profile_id, profile_version: p.profile_version },
    ...SYNTHETIC, ...extra,
  };
}

const slide = (i, role, purpose, pattern, layout, blocks) => ({ slide_index: i, sequence_role: role, asset_purpose: purpose, content_pattern: pattern, layout_family: layout, copy_blocks: blocks });

export const SD_FIXTURES = Object.freeze({
  // SD-1 Instagram feed static (type-only)
  "SD-1": staticFrom("instagram|feed", { design_id: "SD-1" }),
  // SD-4 WhatsApp status (type-only, vertical)
  "SD-4": staticFrom("whatsapp|status", { design_id: "SD-4" }),
  // SD-5 WhatsApp share card (split with supplied body copy)
  "SD-5": staticFrom("whatsapp|share_card", {
    design_id: "SD-5", layout_family: "SPLIT", production_mode: "DETERMINISTIC_GRAPHIC",
    copy_blocks: [{ copy_id: "SD-5-headline", role: "headline", text: DAY6_HEADLINE, required: true }, { copy_id: "SD-5-body", role: "body", text: "Synthetic supporting line for share-card geometry." }],
  }),
  // SD-6 YouTube thumbnail type-only (1280×720)
  "SD-6": staticFrom("youtube|video_thumbnail", { design_id: "SD-6", extra: { platform: "youtube", placement: "video_thumbnail", platform_format: "THUMBNAIL" } }),
  // SD-7 YouTube thumbnail with an already-resolved synthetic source reference (no provider, no frame extraction)
  "SD-7": staticFrom("youtube|video_thumbnail", {
    design_id: "SD-7", layout_family: "IMAGE_DOMINANT", production_mode: "PHOTO_PLUS_TYPE",
    visual_slots: [{ slot_id: "subject", media_type: "photo", required: true, fit: "cover", focal: "center", fallback: "TYPE_ONLY", source: { artifact_id: "SYN-THUMB-SRC-1" } }],
  }),
  // SD-8 Instagram Reel cover
  "SD-8": staticFrom("instagram|reel_cover", { design_id: "SD-8" }),
  // SD-9 Facebook video cover
  "SD-9": staticFrom("facebook|video_cover", { design_id: "SD-9" }),
  // SD-10 TikTok video cover
  "SD-10": staticFrom("tiktok|video_cover", { design_id: "SD-10" }),
  // SD-11 Website video poster
  "SD-11": staticFrom("website|video_poster", { design_id: "SD-11" }),
  // SD-2 Instagram carousel (3 panels: COVER → EXPLAIN → ACT)
  "SD-2": {
    ...clone(DAY6_SPEC), ...meta("instagram|carousel"), design_id: "SD-2", asset_type: "SOCIAL_CAROUSEL", slide_count: 3, continuity_group: "CG-SD-2",
    layout_family: "TYPE_DOMINANT", production_mode: "DETERMINISTIC_GRAPHIC",
    copy_blocks: [{ copy_id: "SD-2-headline", role: "headline", text: DAY6_HEADLINE, required: true }, { copy_id: "SD-2-cta", role: "cta", text: "Synthetic CTA copy." }],
    slides: [
      slide(1, "COVER", "STOP_SCROLL", "TYPOGRAPHIC_HOOK", "TYPE_DOMINANT", [{ copy_id: "SD-2-s1", role: "headline", text: DAY6_HEADLINE }]),
      slide(2, "EXPLAIN", "EDUCATION", "STEPS", "LIST", [{ copy_id: "SD-2-s2", role: "body", text: "Synthetic middle panel copy." }, { copy_id: "SD-2-s2b", role: "list_item", text: "Synthetic step one." }, { copy_id: "SD-2-s2c", role: "list_item", text: "Synthetic step two." }]),
      slide(3, "ACT", "PRODUCT_CONVERSION", "FEATURE_BENEFIT", "PRODUCT_HERO", [{ copy_id: "SD-2-s3", role: "product_name", text: "Synthetic Product" }, { copy_id: "SD-2-s3b", role: "cta", text: "Synthetic CTA copy." }]),
    ],
    cta_policy: { required: true, copy_role: "cta", placement: "LAST_PANEL", prominence: "HIGH" },
    provenance: { ...DAY6_SPEC.provenance, truth_refs: ["SYN-PTR-1"] },
    ...SYNTHETIC,
  },
  // SD-3 Instagram story sequence (2 frames: COVER → ACT)
  "SD-3": {
    ...clone(DAY6_SPEC), ...meta("instagram|story"), design_id: "SD-3", asset_type: "SOCIAL_STORY_SEQUENCE", slide_count: 2, continuity_group: "CG-SD-3",
    layout_family: "TYPE_DOMINANT", production_mode: "DETERMINISTIC_TYPE_ONLY",
    copy_blocks: [{ copy_id: "SD-3-headline", role: "headline", text: DAY6_HEADLINE, required: true }, { copy_id: "SD-3-cta", role: "cta", text: "Synthetic CTA copy." }],
    slides: [
      slide(1, "COVER", "STOP_SCROLL", "TYPOGRAPHIC_HOOK", "TYPE_DOMINANT", [{ copy_id: "SD-3-s1", role: "headline", text: DAY6_HEADLINE }]),
      slide(2, "ACT", "PRODUCT_CONVERSION", "FEATURE_BENEFIT", "PRODUCT_HERO", [{ copy_id: "SD-3-s2", role: "product_name", text: "Synthetic Product" }, { copy_id: "SD-3-s2b", role: "cta", text: "Synthetic CTA copy." }]),
    ],
    cta_policy: { required: true, copy_role: "cta", placement: "LAST_PANEL", prominence: "HIGH" },
    provenance: { ...DAY6_SPEC.provenance, truth_refs: ["SYN-PTR-1"] },
    ...SYNTHETIC,
  },
});

export function syntheticFixture(id) { return clone(SD_FIXTURES[id]); }
