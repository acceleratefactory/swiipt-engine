// MAE Social Design Production — Wave S-A contract tests (no rendering, no provider, no network).
// Run: node mae/harness/social-design-spec.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateSocialDesignSpec, normalizeSocialDesignSpec, socialDesignStatus,
  ASSET_TYPES, ASSET_TYPE_LIMITS, ASSET_PURPOSES, CONTENT_PATTERNS, LAYOUT_FAMILIES, PLATFORM_FORMATS,
  PRODUCTION_MODES, DERIVED_DESCRIPTORS, SEQUENCE_ROLES, COPY_ROLES, REPEATABLE_COPY_ROLES,
  VISUAL_MEDIA_TYPES, SLOT_FALLBACKS, FITS, FOCALS, BACKGROUND_KINDS, ALIGNMENTS, DENSITIES,
  EXPORT_FORMATS, ANGLE_VERDICTS, EVIDENCE_SENSITIVE_PATTERNS, ZERO_TOLERANCE_FAILURES,
  WEIGHTING_PROFILES, SOCIAL_STATUS, SOCIAL_DESIGN_SPEC_VERSION,
} from "../services/social-design-spec.js";
import { validate as validateSchema } from "../lib/schema.js";
import { loadFixtures, computeFixtureHash } from "../services/visual-qualification.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DAY6 = JSON.parse(readFileSync(join(root, "mae/data/fixtures/social/SD-CSEC-006.json"), "utf8"));
const clone = (o) => JSON.parse(JSON.stringify(o));
const v = (spec) => validateSocialDesignSpec(spec);
const errs = (spec) => v(spec).errors.join(" | ");
const carousel = () => ({
  ...clone(DAY6), asset_type: "SOCIAL_CAROUSEL", platform_format: "CAROUSEL_SLIDE", slide_count: 3, continuity_group: "CG-CSEC-006",
  slides: [
    { slide_index: 1, sequence_role: "COVER", asset_purpose: "STOP_SCROLL", content_pattern: "TYPOGRAPHIC_HOOK", layout_family: "TYPE_DOMINANT", copy_blocks: [{ role: "headline", text: "Nobody tells you what standing up feels like on day 6." }] },
    { slide_index: 2, sequence_role: "EXPLAIN", asset_purpose: "EDUCATION", content_pattern: "STEPS", layout_family: "LIST", copy_blocks: [{ role: "body", text: "Move slowly. Steady yourself first." }] },
    { slide_index: 3, sequence_role: "ACT", asset_purpose: "PRODUCT_CONVERSION", content_pattern: "FEATURE_BENEFIT", layout_family: "PRODUCT_HERO", copy_blocks: [{ role: "cta", text: "See the Day 6 Recovery Guide." }] },
  ],
});

// --- B. taxonomy --------------------------------------------------------------
test("1. canonical asset types are exactly the three arities", () => assert.deepEqual([...ASSET_TYPES], ["SOCIAL_STATIC", "SOCIAL_CAROUSEL", "SOCIAL_STORY_SEQUENCE"]));
test("2. asset-type panel limits", () => {
  assert.deepEqual(ASSET_TYPE_LIMITS.SOCIAL_STATIC, { min: 1, max: 1 });
  assert.deepEqual(ASSET_TYPE_LIMITS.SOCIAL_CAROUSEL, { min: 2, max: 10 });
  assert.deepEqual(ASSET_TYPE_LIMITS.SOCIAL_STORY_SEQUENCE, { min: 1, max: 6 });
});
test("3. purposes include PRODUCT_CONVERSION and MEMBERSHIP_CONVERSION but never generic CONVERSION", () => {
  assert.ok(ASSET_PURPOSES.includes("PRODUCT_CONVERSION"));
  assert.ok(ASSET_PURPOSES.includes("MEMBERSHIP_CONVERSION"));
  assert.ok(!ASSET_PURPOSES.includes("CONVERSION"));
});
test("4. taxonomy vocabularies match the approved architecture", () => {
  assert.equal(ASSET_PURPOSES.length, 12); assert.equal(CONTENT_PATTERNS.length, 22);
  assert.equal(LAYOUT_FAMILIES.length, 11); assert.equal(PLATFORM_FORMATS.length, 10);
  assert.equal(PRODUCTION_MODES.length, 6); assert.equal(SEQUENCE_ROLES.length, 11);
  assert.equal(COPY_ROLES.length, 20); assert.equal(ZERO_TOLERANCE_FAILURES.length, 11);
});
test("5. HYBRID is a derived descriptor, not a selectable production mode", () => {
  assert.ok(!PRODUCTION_MODES.includes("HYBRID"));
  assert.ok(DERIVED_DESCRIPTORS.includes("HYBRID"));
});
test("6. reused vocabularies are the existing ones", () => {
  assert.deepEqual([...FITS], ["cover", "contain"]);
  assert.deepEqual([...FOCALS], ["center", "top", "bottom", "left", "right"]);
  assert.deepEqual([...ANGLE_VERDICTS], ["GREEN", "YELLOW"]);   // RED refused
  assert.ok(WEIGHTING_PROFILES.includes("Situation-led social post"));
  assert.ok(WEIGHTING_PROFILES.includes("Carousel"));
});

// --- C. spec validation -------------------------------------------------------
test("7. Day-6 canonical fixture validates (42)", () => {
  const r = v(DAY6);
  assert.equal(r.valid, true, r.errors.join(" | "));
  assert.equal(r.status, SOCIAL_STATUS.SPECIFIED);
});
test("8. schema file validates the canonical fixture", () => {
  // lib/schema validate() returns the object on success and throws SCHEMA_INVALID on failure.
  assert.doesNotThrow(() => validateSchema("social-design-spec.schema.json", DAY6, "SD-CSEC-006"));
  assert.throws(() => validateSchema("social-design-spec.schema.json", { ...DAY6, asset_purpose: "CONVERSION" }, "SD-neg"));
});
test("9. missing brand_tokens_version rejects (36)", () => { const s = clone(DAY6); delete s.brand_tokens_version; assert.match(errs(s), /brand_tokens_version/); });
test("10. missing provenance rejects (37)", () => { const s = clone(DAY6); delete s.provenance; assert.match(errs(s), /provenance/); });
test("11. unknown asset_type rejects (2)", () => assert.match(errs({ ...DAY6, asset_type: "STORY_CARD" }), /unknown asset_type/));
test("12. unknown asset_purpose rejects (3)", () => assert.match(errs({ ...DAY6, asset_purpose: "AWARENESS" }), /unknown asset_purpose/));
test("13. generic CONVERSION rejects (4)", () => assert.match(errs({ ...DAY6, asset_purpose: "CONVERSION" }), /unknown asset_purpose/));
test("14. PRODUCT_CONVERSION accepts (5)", () => assert.equal(v({ ...DAY6, asset_purpose: "PRODUCT_CONVERSION" }).errors.join(" ").includes("unknown asset_purpose"), false));
test("15. MEMBERSHIP_CONVERSION accepts (6)", () => assert.equal(v({ ...DAY6, asset_purpose: "MEMBERSHIP_CONVERSION" }).errors.join(" ").includes("unknown asset_purpose"), false));
test("16. unknown content_pattern rejects (7)", () => assert.match(errs({ ...DAY6, content_pattern: "MEME" }), /unknown content_pattern/));
test("17. unknown layout_family rejects (8)", () => assert.match(errs({ ...DAY6, layout_family: "MASONRY" }), /unknown layout_family/));
test("18. unknown platform_format rejects (9)", () => assert.match(errs({ ...DAY6, platform_format: "REEL" }), /unknown platform_format/));
test("19. HYBRID production mode rejects (10)", () => assert.match(errs({ ...DAY6, production_mode: "HYBRID" }), /derived descriptor and is not selectable/));
test("20. invalid canvas width rejects (19)", () => assert.match(errs({ ...DAY6, canvas: { width: 0, height: 1350, aspect_ratio: "4:5" } }), /canvas\.width/));
test("21. invalid canvas height rejects (20)", () => assert.match(errs({ ...DAY6, canvas: { width: 1080, height: -5, aspect_ratio: "4:5" } }), /canvas\.height/));
test("22. inconsistent aspect ratio rejects (canvas consistency)", () => assert.match(errs({ ...DAY6, canvas: { width: 1080, height: 1350, aspect_ratio: "1:1" } }), /aspect_ratio inconsistent/));
test("23. malformed safe zones reject (21)", () => {
  assert.match(errs({ ...DAY6, safe_zones: { top: -1, bottom: 220, left: 72, right: 72 } }), /safe_zones\.top/);
  assert.match(errs({ ...DAY6, safe_zones: { top: 900, bottom: 700, left: 72, right: 72 } }), /no drawable height/);
  assert.match(errs({ ...DAY6, safe_zones: { top: 120, bottom: 220 } }), /safe_zones\.left/);
});
test("24. unknown copy role rejects (22)", () => assert.match(errs({ ...DAY6, copy_blocks: [{ role: "tagline", text: "x" }] }), /unknown copy role/));
test("25. empty copy text rejects (23)", () => assert.match(errs({ ...DAY6, copy_blocks: [{ role: "headline", text: "" }] }), /non-empty string/));
test("26. repeated permitted list_item accepts (24)", () => {
  const s = { ...DAY6, content_pattern: "CHECKLIST", evidence_requirements: [], copy_blocks: [{ role: "headline", text: "H" }, { role: "list_item", text: "one" }, { role: "list_item", text: "two" }] };
  assert.equal(v(s).errors.some((e) => /may not repeat/.test(e)), false);
});
test("27. repeated non-permitted role rejects", () => assert.match(errs({ ...DAY6, copy_blocks: [{ role: "headline", text: "a" }, { role: "headline", text: "b" }] }), /may not repeat/));
test("28. visual slot unknown fit rejects (25)", () => assert.match(errs({ ...DAY6, visual_slots: [{ slot_id: "s1", media_type: "photo", fit: "stretch" }] }), /fit unknown/));
test("29. visual slot unknown focal rejects (26)", () => assert.match(errs({ ...DAY6, visual_slots: [{ slot_id: "s1", media_type: "photo", focal: "middle" }] }), /focal unknown/));
test("30. visual slot unknown fallback rejects (27)", () => assert.match(errs({ ...DAY6, visual_slots: [{ slot_id: "s1", media_type: "photo", fallback: "SKIP" }] }), /fallback unknown/));
test("31. required visual slot without source or fallback rejects (28)", () => assert.match(errs({ ...DAY6, visual_slots: [{ slot_id: "s1", media_type: "photo", required: true }] }), /without a source and without a fallback/));
test("32. required slot with SOURCE_REQUIRED fallback derives SOURCE_REQUIRED status", () => {
  const s = { ...DAY6, production_mode: "PHOTO_PLUS_TYPE", visual_slots: [{ slot_id: "s1", media_type: "photo", required: true, fit: "cover", focal: "center", fallback: "SOURCE_REQUIRED" }] };
  const r = v(s); assert.equal(r.valid, true, r.errors.join(" | ")); assert.equal(r.status, SOCIAL_STATUS.SOURCE_REQUIRED);
});
test("33. source_grounded / production_instruction overlap rejects (29)", () => {
  const s = clone(DAY6); s.source_classification.production_instruction = [...s.source_classification.production_instruction, "angle hook"];
  assert.match(errs(s), /overlap/);
});
test("34. required/prohibited element overlap rejects (30)", () => {
  const s = clone(DAY6); s.prohibited_elements = [...s.prohibited_elements, "headline"];
  assert.match(errs(s), /both required and prohibited/);
});
test("35. duplicate hierarchy refs reject (38)", () => assert.match(errs({ ...DAY6, hierarchy: ["headline", "headline"] }), /unique/));
test("36. invalid density rejects (39)", () => assert.match(errs({ ...DAY6, density: "TIGHT" }), /unknown density/));
test("37. invalid alignment rejects (40)", () => assert.match(errs({ ...DAY6, alignment: "JUSTIFY" }), /unknown alignment/));
test("38. export_format invalid value rejects (41)", () => assert.match(errs({ ...DAY6, export_format: ["pdf"] }), /export_format unknown/));
test("39. spacing without token or class rejects", () => assert.match(errs({ ...DAY6, spacing: { arbitrary: 13 } }), /spacing requires/));
test("40. accessibility requires min_type_size/contrast_floor/alt_text", () => {
  assert.match(errs({ ...DAY6, accessibility: { min_type_size: 0, contrast_floor: 4.5, alt_text: "x" } }), /min_type_size/);
  assert.match(errs({ ...DAY6, accessibility: { min_type_size: 44, contrast_floor: 0, alt_text: "x" } }), /contrast_floor/);
  assert.match(errs({ ...DAY6, accessibility: { min_type_size: 44, contrast_floor: 4.5, alt_text: "" } }), /alt_text/);
});
test("41. truth weighting profile must be an existing MAE profile", () => assert.match(errs({ ...DAY6, truth_requirements: { weighting_profile: "Made-up profile" } }), /not an existing weighting profile/));
test("42. RED or unvalidated angle verdict rejects", () => {
  assert.match(errs({ ...DAY6, angle_verdict: "RED" }), /not an approved\/usable state/);
  assert.match(errs({ ...DAY6, angle_verdict: "PENDING" }), /not an approved\/usable state/);
});
test("43. timestamp-derived design_id rejects", () => assert.match(errs({ ...DAY6, design_id: "1757890123456" }), /timestamp-derived/));
test("44. CTA required without an exact cta copy block rejects", () => assert.match(errs({ ...DAY6, cta_policy: { required: true, copy_role: "cta" } }), /never invented here/));
test("45. CTA required with an exact cta copy block accepts", () => {
  const s = { ...DAY6, copy_blocks: [...DAY6.copy_blocks, { role: "cta", text: "See the Day 6 Recovery Guide." }], cta_policy: { required: true, copy_role: "cta", placement: "BOTTOM", prominence: "HIGH" } };
  assert.equal(v(s).valid, true, errs(s));
});

// --- D. multi-panel -----------------------------------------------------------
test("46. valid carousel accepts", () => { const r = v(carousel()); assert.equal(r.valid, true, r.errors.join(" | ")); });
test("47. static with multi-slide structure rejects (11)", () => assert.match(errs({ ...DAY6, slides: carousel().slides }), /must not declare slides/));
test("48. static with slide_count > 1 rejects", () => assert.match(errs({ ...DAY6, slide_count: 3 }), /must not declare slide_count/));
test("49. carousel with <2 slides rejects (12)", () => {
  const s = carousel(); s.slide_count = 1; s.slides = s.slides.slice(0, 1);
  assert.match(errs(s), /slide_count must be between 2 and 10/);
});
test("50. carousel with >10 slides rejects (13)", () => {
  const s = carousel(); s.slide_count = 11;
  s.slides = Array.from({ length: 11 }, (_, i) => ({ ...carousel().slides[0], slide_index: i + 1, sequence_role: i === 0 ? "COVER" : i === 10 ? "ACT" : "EXPLAIN" }));
  assert.match(errs(s), /slide_count must be between 2 and 10/);
});
test("51. story with >6 frames rejects (14)", () => {
  const s = { ...carousel(), asset_type: "SOCIAL_STORY_SEQUENCE", platform_format: "STORY_VERTICAL", slide_count: 7 };
  s.slides = Array.from({ length: 7 }, (_, i) => ({ ...carousel().slides[0], slide_index: i + 1, sequence_role: i === 0 ? "COVER" : i === 6 ? "ACT" : "CONTEXT" }));
  assert.match(errs(s), /slide_count must be between 1 and 6/);
});
test("52. story with 1–6 frames accepts", () => {
  const s = { ...carousel(), asset_type: "SOCIAL_STORY_SEQUENCE", platform_format: "STORY_VERTICAL", slide_count: 2 };
  s.slides = [s.slides[0], { ...s.slides[2], slide_index: 2 }];
  const r = v(s); assert.equal(r.valid, true, r.errors.join(" | "));
});
test("53. carousel slide_count mismatch rejects (15)", () => { const s = carousel(); s.slide_count = 4; assert.match(errs(s), /must equal slide_count/); });
test("54. duplicate slide indexes reject (16)", () => { const s = carousel(); s.slides[1].slide_index = 1; assert.match(errs(s), /unique/); });
test("55. non-contiguous slide indexes reject", () => { const s = carousel(); s.slides[1].slide_index = 9; assert.match(errs(s), /contiguous/); });
test("56. missing COVER rejects (17)", () => { const s = carousel(); s.slides[0].sequence_role = "CONTEXT"; assert.match(errs(s), /requires a COVER slide/); });
test("57. missing ACT rejects (18)", () => { const s = carousel(); s.slides[2].sequence_role = "RESOLVE"; assert.match(errs(s), /requires an ACT/); });
test("58. carousel requires continuity_group", () => { const s = carousel(); s.continuity_group = null; assert.match(errs(s), /continuity_group/); });
test("59. carousel slide copy_blocks must be non-empty", () => { const s = carousel(); s.slides[1].copy_blocks = []; assert.match(errs(s), /copy_blocks must be a non-empty array/); });

// --- E. evidence structure ----------------------------------------------------
for (const [n, pattern] of [["60. TESTIMONIAL requires evidence (31,34)", "TESTIMONIAL"], ["61. STATISTIC requires evidence (33)", "STATISTIC"], ["62. DATA requires evidence", "DATA"], ["63. PROOF requires evidence (34)", "PROOF"], ["64. BEFORE_AFTER requires evidence (35)", "BEFORE_AFTER"]]) {
  test(n, () => assert.match(errs({ ...DAY6, content_pattern: pattern }), /requires a non-empty evidence_requirements/));
}
test("65. TESTIMONIAL with an evidence reference accepts structurally (32)", () => {
  const s = { ...DAY6, content_pattern: "TESTIMONIAL", evidence_requirements: [{ evidence_id: "CRF-CSEC-014#quote-1", evidence_type: "TESTIMONIAL", required_for_pattern: "TESTIMONIAL" }] };
  const r = v(s); assert.equal(r.valid, true, r.errors.join(" | "));
});
test("66. COMPARISON requires evidence unless the basis is internal pricing", () => {
  assert.match(errs({ ...DAY6, content_pattern: "COMPARISON" }), /requires a non-empty evidence_requirements/);
  const s = { ...DAY6, content_pattern: "COMPARISON", comparison_basis: "INTERNAL_PRICE", copy_blocks: [{ role: "price", text: "USD 29" }, { role: "members_price", text: "Member price 0" }], provenance: { ...DAY6.provenance, truth_refs: ["PTR-CSEC-001"] } };
  assert.equal(v(s).errors.some((e) => /evidence_requirements/.test(e)), false);
});
test("67. price/members_price copy requires a Product-Truth provenance reference", () => {
  const s = { ...DAY6, copy_blocks: [{ role: "headline", text: "H" }, { role: "members_price", text: "Member price" }], provenance: { ...DAY6.provenance, truth_refs: [] } };
  assert.match(errs(s), /requires a Product-Truth reference/);
});
test("68. members_price is never defaulted or invented by the contract", () => {
  const s = { ...DAY6, copy_blocks: [{ role: "members_price", text: "0" }], provenance: { ...DAY6.provenance, truth_refs: ["PTR-CSEC-001"] } };
  const r = v(s); assert.equal(r.errors.some((e) => /INVENT|DEFAULT/.test(e)), false);
  assert.equal(r.normalized.copy_blocks[0].text, "0");   // preserved exactly, not rewritten
});
test("69. zero-tolerance vocabulary is exposed but not executed", () => {
  const src = readFileSync(join(root, "mae/services/social-design-spec.js"), "utf8");
  assert.ok(!/detectZeroTolerance|runSocialGraphicQA|gates/i.test(src));
  assert.ok(ZERO_TOLERANCE_FAILURES.includes("WRONG_PRICE"));
});

// --- F. Day-6 -----------------------------------------------------------------
test("70. Day-6 identity + taxonomy fields (40–47)", () => {
  assert.equal(DAY6.design_id, "SD-CSEC-006");
  assert.equal(DAY6.angle_id, "ANG-CSEC-006");
  assert.equal(DAY6.asset_type, "SOCIAL_STATIC");
  assert.equal(DAY6.asset_purpose, "STOP_SCROLL");
  assert.equal(DAY6.content_pattern, "TYPOGRAPHIC_HOOK");
  assert.equal(DAY6.layout_family, "TYPE_DOMINANT");
  assert.equal(DAY6.platform_format, "FEED_PORTRAIT");
  assert.equal(DAY6.production_mode, "DETERMINISTIC_TYPE_ONLY");
});
test("71. Day-6 headline is the exact approved angle hook (48)", () => {
  const headline = DAY6.copy_blocks.find((b) => b.role === "headline");
  assert.equal(headline.text, "Nobody tells you what standing up feels like on day 6.");
});
test("72. Day-6 invents no clinical mechanism (49)", () => {
  const blob = JSON.stringify(DAY6).toLowerCase();
  for (const banned of ["how to", "exercise", "stretch", "reps", "instructions", "technique", "treatment"]) assert.ok(!blob.includes(banned), banned);
  assert.match(DAY6.boundary_note, /not clinical instruction/i);
});
test("73. Day-6 has no image dependency (50)", () => {
  assert.deepEqual(DAY6.visual_slots, []);
  assert.equal(DAY6.production_mode, "DETERMINISTIC_TYPE_ONLY");
});
test("74. Day-6 has no evidence-heavy unsupported pattern (51)", () => {
  assert.ok(!EVIDENCE_SENSITIVE_PATTERNS.includes(DAY6.content_pattern));
  assert.deepEqual(DAY6.evidence_requirements, []);
  const claimRoles = ["price", "members_price", "offer", "statistic_value", "statistic_label", "quote"];
  assert.equal(DAY6.copy_blocks.some((b) => claimRoles.includes(b.role)), false);
});
test("75. Day-6 source classification separates facts from layout choices (37)", () => {
  assert.deepEqual(DAY6.source_classification.source_grounded, ["angle hook", "customer situation"]);
  for (const x of ["layout family: TYPE_DOMINANT", "platform format: FEED_PORTRAIT", "production mode: DETERMINISTIC_TYPE_ONLY", "alignment: LEFT", "density: SPARSE", "safe zones"]) {
    assert.ok(DAY6.source_classification.production_instruction.includes(x), x);
  }
});
test("76. Day-6 boundary note keeps depiction, not instruction", () => assert.match(DAY6.boundary_note, /depiction/i));

// --- G. determinism / no-rendering guarantees ---------------------------------
test("77. validation is deterministic and non-mutating", () => {
  const a = v(DAY6); const b = v(DAY6);
  assert.deepEqual(a.errors, b.errors); assert.deepEqual(a, b);
  assert.equal(DAY6.copy_blocks[0].text, "Nobody tells you what standing up feels like on day 6.");
});
test("78. normalize preserves design_version default without altering copy", () => {
  const n = normalizeSocialDesignSpec({ copy_blocks: [{ role: "headline", text: "  exact  spacing  " }] });
  assert.equal(n.design_version, SOCIAL_DESIGN_SPEC_VERSION);
  assert.equal(n.copy_blocks[0].text, "  exact  spacing  ");   // whitespace never normalized
});
test("79. socialDesignStatus reports lifecycle-only states", () => {
  assert.equal(socialDesignStatus(DAY6), SOCIAL_STATUS.SPECIFIED);
  assert.equal(socialDesignStatus({ ...DAY6, canvas: {} }), SOCIAL_STATUS.INVALID_SPEC);
  assert.deepEqual(Object.values(SOCIAL_STATUS).sort(), ["INVALID_SPEC", "SOURCE_REQUIRED", "SPECIFIED"]);
});
test("80. contract module performs no rendering / no provider / no network (42)", () => {
  const src = readFileSync(join(root, "mae/services/social-design-spec.js"), "utf8");
  for (const banned of ["renderSvg", "Compositor", "writeFileSync", "child_process", "spawnSync", "ffmpeg", "fetch(", "https://"]) assert.ok(!src.includes(banned), banned);
});
test("81. later-wave modules now exist (approved deliverables)", () => {
  // S-B social-components.js · S-C social-compositor.js · S-D social-carousel.js + social-platforms.js
  // · S-E social-graphic-qa.js. No future-wave module remains forbidden.
  for (const f of ["mae/media/social-components.js", "mae/media/social-compositor.js", "mae/media/social-carousel.js", "mae/services/social-platforms.js", "mae/services/social-graphic-qa.js"]) assert.ok(existsSync(join(root, f)), f);
});

// --- H. regressions -----------------------------------------------------------
test("82. existing subsystem suites remain present (image/video/MAE)", () => {
  for (const f of ["mae/harness/compositor.test.mjs", "mae/harness/image-provenance.test.mjs", "mae/harness/video-artifact.test.mjs", "mae/harness/video-output-qa.test.mjs", "mae/harness/ingest.test.mjs", "mae/harness/waveA.test.mjs"]) assert.ok(existsSync(join(root, f)), f);
});
test("83. frozen image fixture hashes unchanged", () => { for (const f of loadFixtures()) assert.equal(computeFixtureHash(f), f.fixture_hash, f.fixture_id); });
test("84. no provider/video capability was enabled", async () => {
  const vp = await import("../media/video-provider.js");
  assert.equal(vp.videoGenerationStatus().available, false);
});
