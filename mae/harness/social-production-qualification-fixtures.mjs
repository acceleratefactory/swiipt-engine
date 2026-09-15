// MAE Social Design — Wave S-H qualification fixtures.
// BOUNDED synthetic adversarial fixtures. Every object carries `_fixture_origin: "synthetic"`.
// They are TEST DATA ONLY: never truth, never proof, never evidence, never a production record.
// The only approved copy reused verbatim is the canonical Day-6 angle hook (from SD-CSEC-006.json).
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DAY6_SPEC as SD_DAY6_SPEC, DAY6_HEADLINE } from "./social-sd-fixtures.mjs";
import { MEDIA_SOURCES } from "./social-media-fixtures.mjs";
import { createMockEvaluator, SOCIAL_QA_DIMENSIONS, DIMENSION_CLASS } from "../services/social-graphic-qa.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SD_DAY6_FIXTURE_PATH = "mae/data/fixtures/social/SD-CSEC-006.json";
export const CANONICAL_DAY6_FIXTURE_TEXT = readFileSync(join(root, SD_DAY6_FIXTURE_PATH), "utf8");
export const DAY6_SPEC = SD_DAY6_SPEC;
export { DAY6_HEADLINE };

export const CHECKPOINT_SHA = "fb012753338c653a5826b0c9ad15c0dc4128f47f";
export const QUALIFICATION_VERSION = "social-production-qualification@1";

export const SYNTHETIC = Object.freeze({
  _fixture_origin: "synthetic",
  fixture_note: "Wave S-H synthetic qualification fixture — never truth, proof, evidence or a production record.",
});

const clone = (o) => JSON.parse(JSON.stringify(o));

/** Canonical Day-6 template with overrides (copy preserved verbatim unless a case attacks it). */
export function baseSpec(overrides = {}) {
  return { ...clone(DAY6_SPEC), design_id: "SH-BASE", ...SYNTHETIC, ...overrides };
}

/** A copy block with the approved headline (byte-identical) unless a case overrides the text. */
export function copyBlock(role = "headline", text = DAY6_HEADLINE, overrides = {}) {
  return { copy_id: `SH-${role.toUpperCase()}`, role, text, source_ref: "ANG-CSEC-006#hook", required: true, ...overrides };
}

export function specWithCopy(blocks, overrides = {}) {
  return baseSpec({ design_id: "SH-COPY", copy_blocks: blocks, ...overrides });
}

/** Evidence-burden spec: pattern + copy role that S-E authorizes. */
export function evidenceSpec(pattern, role, text) {
  return baseSpec({
    design_id: `SH-EV-${pattern}`,
    content_pattern: pattern,
    copy_blocks: [{ copy_id: `SH-EV-${role}`, role, text, required: true }],
    evidence_requirements: [],
  });
}

/** Valid multi-panel (carousel) spec builder — top-level copy_blocks + continuity_group are required. */
export function carouselSpec({ id = "SH-MP", slides, copy_blocks = null, continuity_group = "SH-CONT", overrides = {} } = {}) {
  const blocks = copy_blocks ?? [copyBlock("headline")];
  return baseSpec({
    design_id: id,
    asset_type: "SOCIAL_CAROUSEL",
    layout_family: "TYPE_DOMINANT",
    continuity_group,
    slide_count: slides.length,
    slides,
    copy_blocks: blocks,
    cta_policy: { required: false, copy_role: null, placement: null, prominence: "NONE" },
    visual_slots: [],
    ...overrides,
  });
}

export function slide(index, sequence_role, copy_blocks, overrides = {}) {
  return {
    slide_index: index,
    sequence_role,
    asset_purpose: "STOP_SCROLL",
    content_pattern: "TYPOGRAPHIC_HOOK",
    layout_family: "TYPE_DOMINANT",
    copy_blocks,
    ...overrides,
  };
}

/** Canonical three-panel carousel used as the multi-panel baseline. */
export function carouselBase() {
  return carouselSpec({
    id: "SH-MP-BASE",
    slides: [
      slide(1, "COVER", [copyBlock("headline")]),
      slide(2, "EXPLAIN", [copyBlock("body", "Synthetic explain copy for panel geometry.")]),
      slide(3, "ACT", [copyBlock("supporting_line", "Synthetic act copy for panel geometry.")]),
    ],
  });
}

export const MULTI_PANEL_ATTACKS = Object.freeze({
  missingCover: () => carouselSpec({ id: "SH-MP-NO-COVER", slides: [slide(1, "EXPLAIN", [copyBlock("body", "Synthetic explain copy.")]), slide(2, "ACT", [copyBlock("supporting_line", "Synthetic act copy.")])] }),
  missingAct: () => carouselSpec({ id: "SH-MP-NO-ACT", slides: [slide(1, "COVER", [copyBlock("headline")]), slide(2, "EXPLAIN", [copyBlock("body", "Synthetic explain copy.")])] }),
  nonContiguous: () => carouselSpec({ id: "SH-MP-GAP", slides: [slide(1, "COVER", [copyBlock("headline")]), slide(3, "EXPLAIN", [copyBlock("body", "Synthetic explain copy.")]), slide(4, "ACT", [copyBlock("supporting_line", "Synthetic act copy.")])] }),
  reordered: () => carouselSpec({ id: "SH-MP-ORDER", slides: [slide(1, "COVER", [copyBlock("headline")]), slide(3, "ACT", [copyBlock("supporting_line", "Synthetic act copy.")]), slide(2, "EXPLAIN", [copyBlock("body", "Synthetic explain copy.")])] }),
  panelEvidenceFailure: () => carouselSpec({
    id: "SH-MP-EVIDENCE",
    slides: [
      slide(1, "COVER", [copyBlock("headline")]),
      slide(2, "EXPLAIN", [{ copy_id: "SH-STAT", role: "statistic_value", text: "Synthetic 3 in 4 unsupported", required: true }], { content_pattern: "STATISTIC" }),
      slide(3, "ACT", [copyBlock("supporting_line", "Synthetic act copy.")]),
    ],
  }),
  panelMediaFailure: () => carouselSpec({
    id: "SH-MP-MEDIA",
    slides: [
      slide(1, "COVER", [copyBlock("headline")], { layout_family: "IMAGE_DOMINANT", visual_slots: [{ slot_id: "hero", media_type: "photo", required: true, fallback: "SOURCE_REQUIRED" }] }),
      slide(2, "EXPLAIN", [copyBlock("body", "Synthetic explain copy.")]),
      slide(3, "ACT", [copyBlock("supporting_line", "Synthetic act copy.")]),
    ],
  }),
});

/** Media registry attack entries (normalized and raw variants). */
export function mediaEntry(key = "SYN-PHOTO-1", overrides = {}, slot = "hero") {
  return { slot_id: slot, source_key: key, ...clone(MEDIA_SOURCES[key]), ...overrides };
}

export const MEDIA_ATTACKS = Object.freeze({
  missingRequired: () => [],
  unknownSlot: () => [mediaEntry("SYN-PHOTO-1", {}, "not-a-declared-slot")],
  duplicateBinding: () => [mediaEntry("SYN-PHOTO-1"), mediaEntry("SYN-IMG-ART-1")],
  unsupportedMime: () => [mediaEntry("SYN-PHOTO-1", { mime: "image/gif" })],
  zeroWidth: () => [mediaEntry("SYN-PHOTO-1", { width: 0 })],
  zeroHeight: () => [mediaEntry("SYN-PHOTO-1", { height: 0 })],
  missingMetadata: () => [{ slot_id: "hero", source_type: "SUPPLIED_IMAGE", mime: "image/png", checksum: "SH-CHK" }],
  modeMismatch: () => [mediaEntry("SYN-PRODUCT-1")],
  changedChecksum: () => [mediaEntry("SYN-PHOTO-1", { checksum: "SH-CHK-MUTATED" })],
  changedSourceId: () => [mediaEntry("SYN-PHOTO-1", { source_media_id: "SM-SYNTHETIC_FIXTURE-MUTATED" })],
  generatedFlag: () => [mediaEntry("SYN-IMG-ART-1")],
  syntheticFlagRemoved: () => [mediaEntry("SYN-PHOTO-1", { synthetic: false })],
  unsafeHref: () => [mediaEntry("SYN-PHOTO-1", { uri: 'data:image/svg+xml;base64,x" onload="alert(1)' })],
  scriptHref: () => [mediaEntry("SYN-PHOTO-1", { uri: "javascript:alert(1)" })],
});

/** A synthetic source whose *content* conceptually contains text (typography-ownership attack). */
export const TEXT_IN_IMAGE_SOURCE = Object.freeze({
  slot_id: "hero",
  _fixture_origin: "synthetic",
  source_media_id: "SM-SYNTHETIC_FIXTURE-TEXTINIMAGE",
  source_type: "SYNTHETIC_FIXTURE",
  mime: "image/svg+xml",
  width: 1080,
  height: 1350,
  aspect_ratio: "1080:1350",
  checksum: "SH-CHK-TEXTINIMAGE",
  fit: "cover",
  focal: "center",
  generated: false,
  synthetic: true,
  source_classification: "synthetic_fixture",
  uri: "data:image/svg+xml;base64," + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><text x="10" y="200">GENERIC RECOVERY TIPS</text></svg>').toString("base64"),
  provenance: { source_classification: "synthetic_fixture", synthetic: true, generated: false, metadata_source: "declared", provider: null, model: null, artifact_id: null, visual_grounding_id: null, prompt_record_ref: null, video_artifact_id: null, frame_timestamp: null, derived_frame_artifact_id: null },
});

export const SAFETY_SENSITIVE_TRUTH = Object.freeze({
  product: { safety_sensitive: true, safety_review_status: "pending" },
  features: ["Synthetic safety-sensitive feature"],
});

export const APPROVED_COMMERCE_TRUTH = Object.freeze({
  product: { safety_sensitive: false, safety_review_status: "approved" },
  commerce: { approved_price_text: "USD 29", approved_member_price_text: "0" },
});

/** Frozen fixture judgment (provider: fixture · model: fixture · live: false). Never a live evaluator. */
export const frozenJudgment = (overrides = {}) => createMockEvaluator({
  results: {
    ...Object.fromEntries(SOCIAL_QA_DIMENSIONS.filter((d) => d.class === DIMENSION_CLASS.JUDGMENT_REQUIRED).map((d) => [d.id, { status: "PASS", rationale: "frozen qualification judgment (fixture)" }])),
    ...overrides,
  },
  provider: "fixture",
  model: "fixture",
  live: false,
  version: "social-qualification-fixture@1",
});

/** Malformed evaluator payload (hand-rolled: createMockEvaluator deliberately refuses invalid payloads). */
export const MALFORMED_EVALUATOR = Object.freeze({
  provider: "fixture", model: "fixture", live: false, version: "malformed@1",
  results: { HIERARCHY: { status: "TOTALLY_FINE", rationale: "not a real status" } },
});

/** Generic (interchangeable) headline mutation of the canonical angle — must FAIL interchangeability. */
export const GENERIC_MUTATION_TEXT = "C-section recovery tips";
