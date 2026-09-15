// MAE Social Design — Wave S-G SYNTHETIC family fixtures (Day-6 qualification family + failure fixtures).
// TEST DATA ONLY. Every fixture carries `_fixture_origin: "synthetic"`. Nothing here is Customer Truth,
// Product Truth, Market Truth, proof, a testimonial or a price. The only approved copy reused is the
// canonical Day-6 angle hook (byte-identical to mae/data/fixtures/social/SD-CSEC-006.json).
// No provider, no network, no raster, no live evaluator.
import { createMockEvaluator, SOCIAL_QA_DIMENSIONS, DIMENSION_CLASS } from "../services/social-graphic-qa.js";
import { day6MediaSpec, MEDIA_SOURCES } from "./social-media-fixtures.mjs";
import { DAY6_SPEC, DAY6_HEADLINE, SYNTHETIC } from "./social-sd-fixtures.mjs";

const clone = (o) => JSON.parse(JSON.stringify(o));

export { DAY6_SPEC, DAY6_HEADLINE };
export const FAMILY_FIXTURE_NOTE = "Synthetic Wave S-G qualification family — never truth, never proof, never a production record.";

/** Synthetic Marketing Angle record for ANG-CSEC-006 (identity + truth refs only; no invented mechanism). */
export const DAY6_ANGLE = Object.freeze({
  ...SYNTHETIC,
  id: "ANG-CSEC-006",
  product_id: DAY6_SPEC.product_id,
  transformation_id: DAY6_SPEC.transformation_id,
  tier1: { customer: "Synthetic customer situation (fixture)", scene: "Synthetic recovery scene (fixture)" },
  tier2: { angle: DAY6_HEADLINE, mechanism: null, insight: { text: "Synthetic fixture insight", label: "Strategic Synthesis" } },
  tier3: {
    product_truth_ref: "PTR-CSEC-001",
    source_evidence: [{ ref_id: "CRF-CSEC-014" }],
    market_truth_support: [{ ref_id: "MIF-CSEC-011" }],
    counter_evidence_acknowledged: true,
    brand_truth_compliance: true,
    truth_conflict_log: [],
  },
});

export const APPROVED_PLATFORMS = Object.freeze(["instagram", "youtube", "whatsapp"]);

export const GREEN_VALIDATION = Object.freeze({
  ...SYNTHETIC, id: "VAL-CSEC-006-GREEN", angle_id: "ANG-CSEC-006", verdict: "GREEN",
  max_assets: null, approved_platforms: [...APPROVED_PLATFORMS], excluded_platforms: [], restrictions: [],
});

/** YELLOW keeps the existing governance cap semantics (max_assets comes from the validation record). */
export const YELLOW_VALIDATION = Object.freeze({
  ...SYNTHETIC, id: "VAL-CSEC-006-YELLOW", angle_id: "ANG-CSEC-006", verdict: "YELLOW",
  max_assets: 2, approved_platforms: [...APPROVED_PLATFORMS], excluded_platforms: [], restrictions: ["Restricted fan-out: fixture"],
});

export const RED_VALIDATION = Object.freeze({
  ...SYNTHETIC, id: "VAL-CSEC-006-RED", angle_id: "ANG-CSEC-006", verdict: "RED",
  max_assets: 0, approved_platforms: [...APPROVED_PLATFORMS], excluded_platforms: [], restrictions: [],
});

/** Approved copy pool: the canonical Day-6 hook + clearly-synthetic supporting copy. NO CTA, NO PRICE. */
export const COPY_POOL = Object.freeze([
  { copy_id: "COPY-HOOK-1", role: "headline", text: DAY6_HEADLINE, source_ref: "ANG-CSEC-006#hook", required: true },
  { copy_id: "SF-BODY-1", role: "body", text: "Synthetic supporting paragraph for family geometry only.", source_ref: "SYN-FIXTURE#body" },
  { copy_id: "SF-SUPPORT-1", role: "supporting_line", text: "Synthetic supporting line for placement geometry.", source_ref: "SYN-FIXTURE#support" },
]);

/** Same pool plus commerce/CTA copy, used only to prove those roles are used when supplied upstream. */
export const COPY_POOL_WITH_COMMERCE = Object.freeze([
  ...COPY_POOL,
  { copy_id: "SF-PRICE-1", role: "price", text: "USD 29", source_ref: "SYN-FIXTURE#price" },
  { copy_id: "SF-CTA-1", role: "cta", text: "Start the 30-day plan", source_ref: "SYN-FIXTURE#cta" },
]);

const allPassResults = Object.fromEntries(
  SOCIAL_QA_DIMENSIONS.filter((d) => d.class === DIMENSION_CLASS.JUDGMENT_REQUIRED).map((d) => [d.id, { status: "PASS", rationale: "fixture judgment PASS" }]),
);
export const ALL_PASS_EVALUATOR = createMockEvaluator({ results: allPassResults });
export const passEvaluator = () => createMockEvaluator({ results: allPassResults });
export const failEvaluator = (dimension = "HIERARCHY", extra = {}) => createMockEvaluator({ results: { ...allPassResults, [dimension]: { status: "FAIL", rationale: `fixture FAIL ${dimension}`, ...extra } } });
export const judgmentEvaluator = (dimension = "EMOTIONAL_INTEGRITY") => createMockEvaluator({ results: { ...allPassResults, [dimension]: { status: "HUMAN_REVIEW", rationale: "fixture HUMAN_REVIEW" } } });

/** Shared approved source media registry (S-F records; one artifact may be reused across members). */
export const FAMILY_REGISTRY = Object.freeze([
  { slot_id: "hero", source_key: "SYN-PHOTO-1", ...MEDIA_SOURCES["SYN-PHOTO-1"] },
  { slot_id: "product", source_key: "SYN-PRODUCT-1", ...MEDIA_SOURCES["SYN-PRODUCT-1"] },
  { slot_id: "illustration", source_key: "SYN-ILLUSTRATION-1", ...MEDIA_SOURCES["SYN-ILLUSTRATION-1"] },
]);

const photoSlot = (required = true) => ({ slot_id: "hero", media_type: "photo", required, fit: "cover", focal: "center", fallback: required ? "SOURCE_REQUIRED" : "TYPE_ONLY" });

// ---- Day-6 qualification members (PART 66) -----------------------------------------------------
export const MEMBER_FEED = Object.freeze({
  required: true, family_role: "IDENTIFICATION", purpose: "STOP_SCROLL",
  platform: "instagram", placement: "feed", asset_type: "SOCIAL_STATIC",
  content_pattern: "TYPOGRAPHIC_HOOK", layout_family: "IMAGE_DOMINANT", production_mode: "PHOTO_PLUS_TYPE",
  copy_roles: ["headline"], visual_slots: [photoSlot(true)],
});

export const MEMBER_CAROUSEL = Object.freeze({
  required: true, family_role: "STORY", purpose: "EDUCATION",
  platform: "instagram", placement: "carousel", asset_type: "SOCIAL_CAROUSEL",
  content_pattern: "PROBLEM_INSIGHT", layout_family: "EDITORIAL", production_mode: "DETERMINISTIC_GRAPHIC",
  copy_roles: ["headline"],
  slides: [
    { sequence_role: "COVER", asset_purpose: "STOP_SCROLL", content_pattern: "TYPOGRAPHIC_HOOK", layout_family: "IMAGE_DOMINANT", copy_roles: ["headline"], visual_slots: [photoSlot(true)] },
    { sequence_role: "EXPLAIN", asset_purpose: "EDUCATION", content_pattern: "PROBLEM_INSIGHT", layout_family: "LIST", copy_roles: ["body"] },
    { sequence_role: "ACT", asset_purpose: "DECISION_SUPPORT", content_pattern: "STEPS", layout_family: "TYPE_DOMINANT", copy_roles: ["supporting_line"] },
  ],
});

export const MEMBER_WHATSAPP = Object.freeze({
  required: true, family_role: "EDUCATION", purpose: "CLARIFICATION",
  platform: "whatsapp", placement: "share_card", asset_type: "SOCIAL_STATIC",
  content_pattern: "MYTH_REALITY", layout_family: "SPLIT", production_mode: "PHOTO_PLUS_TYPE",
  // platform-specific copy selection: the 1200x630 share card uses fewer supplied fields than the feed
  copy_roles: ["headline"], visual_slots: [photoSlot(true)],
});

export const MEMBER_YOUTUBE = Object.freeze({
  required: false, family_role: "PROBLEM", purpose: "STOP_SCROLL",
  platform: "youtube", placement: "video_thumbnail", asset_type: "SOCIAL_STATIC",
  content_pattern: "TYPOGRAPHIC_HOOK", layout_family: "IMAGE_DOMINANT", production_mode: "PHOTO_PLUS_TYPE",
  copy_roles: ["headline"], visual_slots: [photoSlot(true)], // platform-specific selection: fewer supplied fields than the IG feed
});

export const MEMBER_STORY = Object.freeze({
  required: false, family_role: "REINFORCEMENT", purpose: "REASSURANCE",
  platform: "instagram", placement: "story", asset_type: "SOCIAL_STORY_SEQUENCE",
  content_pattern: "REASSURANCE", layout_family: "FULL_BLEED", production_mode: "PHOTO_PLUS_TYPE",
  copy_roles: ["headline"],
  slides: [
    { sequence_role: "COVER", asset_purpose: "STOP_SCROLL", content_pattern: "TYPOGRAPHIC_HOOK", layout_family: "FULL_BLEED", copy_roles: ["headline"], visual_slots: [photoSlot(true)] },
    { sequence_role: "ACT", asset_purpose: "REASSURANCE", content_pattern: "REASSURANCE", layout_family: "TYPE_DOMINANT", copy_roles: ["supporting_line"] },
  ],
});

export const DAY6_MEMBERS = Object.freeze([MEMBER_FEED, MEMBER_CAROUSEL, MEMBER_WHATSAPP, MEMBER_YOUTUBE, MEMBER_STORY]);

export const DAY6_STRATEGY = Object.freeze({
  ...SYNTHETIC,
  strategy_version: 1,
  jobs: ["STOP_SCROLL", "IDENTIFICATION", "EDUCATION", "CLARIFICATION", "REASSURANCE", "DECISION_SUPPORT"],
  required_purposes: ["STOP_SCROLL", "CLARIFICATION"],
  source_policy: "SHARED_SOURCE",
  partial_allowed: true,
  spec_template: DAY6_SPEC,
  copy_pool: [...COPY_POOL],
});

/** The full Day-6 family input (override anything per test). */
export function day6FamilyInput(overrides = {}) {
  const { members, strategy, validation, evaluator, registry, ...rest } = overrides;
  return {
    marketing_angle: clone(DAY6_ANGLE),
    angle_validation: validation ?? clone(GREEN_VALIDATION),
    truth_context: { product: [{ id: "PTR-CSEC-001" }], customer: [{ id: "CRF-CSEC-014" }], market: [{ id: "MIF-CSEC-011" }] },
    family_strategy: strategy ?? clone(DAY6_STRATEGY),
    requested_members: members ?? DAY6_MEMBERS.map(clone),
    source_media_registry: registry ?? FAMILY_REGISTRY.map(clone),
    evaluator: evaluator === undefined ? ALL_PASS_EVALUATOR : evaluator,
    ...rest,
  };
}

// ---- failure fixtures -------------------------------------------------------------------------
export const failureFixtures = Object.freeze({
  /** required WhatsApp member FAILs (evaluator FAIL on that member only) → family FAILED. */
  requiredMemberFailure: () => day6FamilyInput({
    members: DAY6_MEMBERS.map((m) => (m === MEMBER_WHATSAPP ? { ...clone(m), evaluator: failEvaluator("HIERARCHY") } : clone(m))),
  }),
  /** all required PASS, optional YouTube FAILs, strategy permits partial → PARTIAL. */
  optionalMemberFailure: () => day6FamilyInput({
    members: DAY6_MEMBERS.map((m) => (m === MEMBER_YOUTUBE ? { ...clone(m), evaluator: failEvaluator("LEGIBILITY") } : clone(m))),
  }),
  /** all required PASS, optional YouTube FAILs, strategy forbids partial → never APPROVED. */
  optionalMemberFailureNoPartial: () => day6FamilyInput({
    strategy: { ...clone(DAY6_STRATEGY), partial_allowed: false },
    members: DAY6_MEMBERS.map((m) => (m === MEMBER_YOUTUBE ? { ...clone(m), evaluator: failEvaluator("LEGIBILITY") } : clone(m))),
  }),
  /** no evaluator at all → every produced member is JUDGMENT_REQUIRED → family JUDGMENT_REQUIRED. */
  judgmentRequired: () => day6FamilyInput({ members: [clone(MEMBER_FEED), clone(MEMBER_WHATSAPP)], evaluator: null }),
  /** RED angle validation → family not eligible, zero member production. */
  redAngle: () => day6FamilyInput({ validation: clone(RED_VALIDATION) }),
  /** invalid angle validation record (no verdict) → family INVALID. */
  invalidValidation: () => day6FamilyInput({ validation: { id: "VAL-X" } }),
  /** unknown platform/placement → retained member failure, no Instagram fallback. */
  unknownPlatform: () => day6FamilyInput({
    members: [clone(MEMBER_FEED), { ...clone(MEMBER_WHATSAPP), platform: "unknown", placement: "nowhere" }],
  }),
  /** a platform outside the validated angle scope → NOT_ELIGIBLE (retained). */
  outOfScopePlatform: () => day6FamilyInput({
    validation: { ...clone(GREEN_VALIDATION), approved_platforms: ["instagram"] },
    members: [clone(MEMBER_FEED), clone(MEMBER_WHATSAPP)],
  }),
  /** YELLOW angle: members beyond the governance cap are retained as NOT_ELIGIBLE. */
  yellowOverCap: () => day6FamilyInput({
    validation: clone(YELLOW_VALIDATION),
    strategy: { ...clone(DAY6_STRATEGY), yellow_permitted: true },
    members: [clone(MEMBER_FEED), clone(MEMBER_CAROUSEL), clone(MEMBER_WHATSAPP)],
  }),
  /** YELLOW without explicit permission from governance → NOT_ELIGIBLE, zero fan-out. */
  yellowNotPermitted: () => day6FamilyInput({
    validation: clone(YELLOW_VALIDATION),
    members: [clone(MEMBER_FEED), clone(MEMBER_WHATSAPP)],
  }),
  /** duplicate authoritative member identity. */
  duplicateMember: () => day6FamilyInput({ members: [clone(MEMBER_FEED), clone(MEMBER_FEED)] }),
  /** an attempt to alter approved copy inside family orchestration. */
  copyMutation: () => day6FamilyInput({
    members: [{ ...clone(MEMBER_FEED), copy_overrides: { "COPY-HOOK-1": "A stronger headline the orchestrator invented" } }, clone(MEMBER_WHATSAPP)],
  }),
  /** a member asks for copy that is not in the approved pool. */
  copyRoleUnresolved: () => day6FamilyInput({
    members: [{ ...clone(MEMBER_FEED), copy_roles: ["headline", "cta"] }, clone(MEMBER_WHATSAPP)],
  }),
  /** required copy omitted by a member → member NOT_ELIGIBLE (never silently dropped). */
  requiredCopyOmitted: () => day6FamilyInput({
    members: [{ ...clone(MEMBER_FEED), copy_roles: [] }, clone(MEMBER_WHATSAPP)],
  }),
  /** unsupported member definition (platform-specific asset type) → retained, not removed. */
  unsupportedMember: () => day6FamilyInput({
    members: [clone(MEMBER_FEED), { ...clone(MEMBER_WHATSAPP), asset_type: "WHATSAPP_CARD" }],
  }),
  /** unknown purpose / missing role → retained as NOT_ELIGIBLE. */
  missingPurposeAndRole: () => day6FamilyInput({
    members: [clone(MEMBER_FEED), { ...clone(MEMBER_WHATSAPP), purpose: "CONVERSION", family_role: null }],
  }),
  /** NO_SOURCE family: type-only members are valid. */
  noSource: () => day6FamilyInput({
    strategy: { ...clone(DAY6_STRATEGY), source_policy: "NO_SOURCE", copy_pool: [...COPY_POOL] },
    registry: [],
    members: [
      { ...clone(MEMBER_FEED), visual_slots: [], layout_family: "TYPE_DOMINANT", production_mode: "DETERMINISTIC_TYPE_ONLY" },
      { ...clone(MEMBER_WHATSAPP), visual_slots: [], layout_family: "TYPE_DOMINANT", production_mode: "DETERMINISTIC_TYPE_ONLY" },
    ],
  }),
  /** NO_SOURCE but a member declares required media → honest SOURCE_POLICY_VIOLATION. */
  noSourceWithRequiredSlot: () => day6FamilyInput({
    strategy: { ...clone(DAY6_STRATEGY), source_policy: "NO_SOURCE" },
    registry: [],
    members: [clone(MEMBER_FEED), clone(MEMBER_WHATSAPP)],
  }),
  /** MEMBER_SPECIFIC_SOURCE: the WhatsApp member uses the product image, the feed keeps the shared scene. */
  memberSpecificSource: () => day6FamilyInput({
    strategy: { ...clone(DAY6_STRATEGY), source_policy: "MEMBER_SPECIFIC_SOURCE" },
    members: [
      { ...clone(MEMBER_FEED), source_bindings: [{ slot_id: "hero", source_id: "SYN-PHOTO-1" }] },
      { ...clone(MEMBER_WHATSAPP), production_mode: "PRODUCT_VISUAL_PLUS_LAYOUT", source_bindings: [{ slot_id: "hero", source_id: "SYN-PRODUCT-1" }] },
    ],
  }),
  /** MEMBER_SPECIFIC_SOURCE with no declared binding → NOT_ELIGIBLE (never guessed). */
  memberSpecificUndeclared: () => day6FamilyInput({
    strategy: { ...clone(DAY6_STRATEGY), source_policy: "MEMBER_SPECIFIC_SOURCE" },
    members: [clone(MEMBER_FEED), clone(MEMBER_WHATSAPP)],
  }),
  /** platform change: the same member definition resolved for a different placement. */
  platformChanged: () => day6FamilyInput({
    strategy: { ...clone(DAY6_STRATEGY), required_purposes: [] },
    members: [clone(MEMBER_FEED), { ...clone(MEMBER_YOUTUBE), platform: "whatsapp", placement: "share_card", platform_format: null }],
  }),
  /** commerce copy supplied upstream: price/CTA are used only because the pool carries them. */
  commerceSupplied: () => day6FamilyInput({
    strategy: { ...clone(DAY6_STRATEGY), copy_pool: [...COPY_POOL_WITH_COMMERCE] },
    members: [
      { ...clone(MEMBER_FEED), layout_family: "PRODUCT_HERO", production_mode: "DETERMINISTIC_TYPE_ONLY", visual_slots: [], copy_roles: ["headline", "price", "cta"] },
      clone(MEMBER_WHATSAPP),
    ],
  }),
  /** required purpose declared but not covered by any passing member. */
  coverageGap: () => day6FamilyInput({
    strategy: { ...clone(DAY6_STRATEGY), required_purposes: ["STOP_SCROLL", "PROOF"] },
    members: [clone(MEMBER_FEED), clone(MEMBER_WHATSAPP)],
  }),
  /** strategy without jobs → INVALID family. */
  invalidStrategy: () => day6FamilyInput({ strategy: { ...clone(DAY6_STRATEGY), jobs: [] } }),
  /** no members requested → INVALID family. */
  noMembers: () => day6FamilyInput({ members: [] }),
  /** a not-composited (Day-6 media-spec) helper for other tests. */
  mediaSpec: (key = "instagram|feed") => day6MediaSpec(key, { design_id: "SG-PROBE" }),
});
