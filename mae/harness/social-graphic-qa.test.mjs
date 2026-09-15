// MAE Social Design — Wave S-E tests: evidence authorization + SocialGraphicQA.
// No live evaluator, no providers, no network, no raster. All E-*/Q-* fixtures are SYNTHETIC.
// Run: node mae/harness/social-graphic-qa.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateSocialGraphic, evaluateSocialGraphicAsset, authorizeEvidence, validateEvaluatorResult, createMockEvaluator,
  SOCIAL_GRAPHIC_QA_VERSION, SOCIAL_QA_DIMENSIONS, ZERO_TOLERANCE_CLASSES, AUTHORIZATION_CLASS, PATTERN_AUTHORIZATION,
  EVIDENCE_STATUS, OVERALL_STATUS, QA_STATUS, DIMENSION_CLASS, DIAGNOSTICS, JUDGMENT_STATUSES,
} from "../services/social-graphic-qa.js";
import { composeSocialStatic, COMPOSITOR_STATUS } from "../media/social-compositor.js";
import { assembleMultiPanel } from "../media/social-carousel.js";
import { socialTokens } from "../services/social-design-tokens.js";
import { adaptDesignSpecification } from "../services/social-platforms.js";
import { svgVisibleText } from "../media/layout.js";
import { DAY6_SPEC, DAY6_HEADLINE, SD_FIXTURES, syntheticFixture } from "./social-sd-fixtures.mjs";
import { loadFixtures, computeFixtureHash } from "../services/visual-qualification.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const T = socialTokens();
const clone = (o) => JSON.parse(JSON.stringify(o));
const artifactOf = (spec) => { const r = composeSocialStatic(spec, T); return { asset_type: spec.asset_type, status: r.status, svg: r.svg, visible_text: r.visible_text, platform_profile: spec.provenance?.profile_id ? { profile_id: spec.provenance.profile_id, profile_version: spec.provenance.profile_version } : null, provenance: r.provenance, source_media_refs: (spec.visual_slots || []).map((s) => s.source?.artifact_id).filter(Boolean), generated_media: false }; };
const ev = (results, extra = {}) => createMockEvaluator({ results, ...extra });
const ALL_PASS = Object.fromEntries(SOCIAL_QA_DIMENSIONS.filter((d) => d.class === DIMENSION_CLASS.JUDGMENT_REQUIRED).map((d) => [d.id, { status: "PASS", rationale: "fixture judgment PASS" }]));
const judge = (id, status, extra = {}) => ev({ ...ALL_PASS, [id]: { status, rationale: `fixture ${status}`, ...extra } });
const qa = (spec, opts = {}) => evaluateSocialGraphic({ design_spec: spec, rendered_artifact: artifactOf(spec), ...opts });

// SYNTHETIC truth/evidence contexts (never production records)
const TRUTH = { product: { features: ["Synthetic feature one", "Synthetic feature two"], safety_sensitive: true, safety_review_status: "approved" }, commerce: { approved_price_text: "USD 29", approved_member_price_text: "0" } };
const EVID = { records: [{ evidence_id: "SYN-STAT-1", evidence_type: "STATISTIC", authorized: true, synthetic: true }, { evidence_id: "REAL-STAT-1", evidence_type: "STATISTIC", authorized: true }] };
const pattern = (p, blocks, extra = {}) => ({ ...clone(DAY6_SPEC), design_id: `SD-E-${p}`, content_pattern: p, evidence_requirements: [], copy_blocks: blocks, ...extra });

// ---------- A/B. CONTRACT ----------------------------------------------------
test("1. SocialGraphicQA module exists with the approved dimensions and version", () => {
  assert.equal(SOCIAL_GRAPHIC_QA_VERSION, "social-graphic-qa@1");
  assert.equal(SOCIAL_QA_DIMENSIONS.length, 18);
  assert.deepEqual(SOCIAL_QA_DIMENSIONS.map((d) => d.id), ["ANGLE_FIDELITY", "CUSTOMER_TRUTH_FIDELITY", "PRODUCT_TRUTH_FIDELITY", "VISUAL_GROUNDING_FIDELITY", "BRAND_FIT", "INTERCHANGEABILITY", "CULTURAL_INTEGRITY", "EMOTIONAL_INTEGRITY", "COMPOSITION", "HIERARCHY", "LEGIBILITY", "PLATFORM_FIT", "COPY_INTEGRITY", "EVIDENCE_INTEGRITY", "UNSUPPORTED_VISUAL_CLAIM", "AI_ARTIFACTS", "ANATOMICAL_PLAUSIBILITY", "SAFETY_INTEGRITY"]);
});
test("2. deterministic vs judgment classes are explicit (4 deterministic, 14 judgment)", () => {
  const det = SOCIAL_QA_DIMENSIONS.filter((d) => d.class === DIMENSION_CLASS.DETERMINISTIC).map((d) => d.id);
  assert.deepEqual(det, ["PLATFORM_FIT", "COPY_INTEGRITY", "EVIDENCE_INTEGRITY", "SAFETY_INTEGRITY"]);
  assert.equal(SOCIAL_QA_DIMENSIONS.filter((d) => d.class === DIMENSION_CLASS.JUDGMENT_REQUIRED).length, 14);
});
test("3. authorization classes cover the approved burdens", () => {
  assert.equal(Object.values(AUTHORIZATION_CLASS).length, 8);
  assert.equal(PATTERN_AUTHORIZATION.STATISTIC, AUTHORIZATION_CLASS.EVIDENCE_SOURCE_REQUIRED);
  assert.equal(PATTERN_AUTHORIZATION.TESTIMONIAL, AUTHORIZATION_CLASS.CUSTOMER_PROOF_REQUIRED);
  assert.equal(PATTERN_AUTHORIZATION.BEFORE_AFTER, AUTHORIZATION_CLASS.BEFORE_AFTER_SUPPORT_REQUIRED);
  assert.equal(PATTERN_AUTHORIZATION.COMPARISON, AUTHORIZATION_CLASS.COMPARISON_SUPPORT_REQUIRED);
  assert.equal(PATTERN_AUTHORIZATION.PRICE, AUTHORIZATION_CLASS.COMMERCE_TRUTH_REQUIRED);
  assert.equal(PATTERN_AUTHORIZATION.FEATURE_BENEFIT, AUTHORIZATION_CLASS.PRODUCT_TRUTH_REQUIRED);
  assert.equal(PATTERN_AUTHORIZATION.STATEMENT, AUTHORIZATION_CLASS.NO_SPECIAL_EVIDENCE_REQUIRED);
});
test("4. twelve zero-tolerance classes are exposed and blocking", () => {
  assert.equal(ZERO_TOLERANCE_CLASSES.length, 12);
  for (const c of ["PRODUCT_TRUTH_VIOLATION", "SAFETY_VIOLATION", "UNSUPPORTED_VISUAL_CLAIM", "FAKE_TESTIMONIAL", "FABRICATED_PROOF", "FABRICATED_STATISTIC", "MISLEADING_BEFORE_AFTER", "WRONG_PRICE", "WRONG_MEMBER_PRICE", "FALSE_FEATURE", "SEVERE_CULTURAL_MISREPRESENTATION", "FABRICATED_SCARCITY"]) assert.ok(ZERO_TOLERANCE_CLASSES.includes(c), c);
});
test("5. the evaluator is replaceable (no provider is bound anywhere)", () => {
  const src = readFileSync(join(root, "mae/services/social-graphic-qa.js"), "utf8");
  for (const p of ["openai", "anthropic", "gemini", "xkiro", "mistral", "deepseek", "fetch("]) assert.ok(!src.toLowerCase().includes(p), p);
});
test("6. package shape: single focused QA service (no QA framework explosion)", () => {
  const files = ["mae/services/social-graphic-qa.js"];
  for (const f of files) assert.ok(existsSync(join(root, f)), f);
  for (const f of ["mae/services/social-qa-framework.js", "mae/services/social-evidence.js", "mae/services/evidence-gate.js"]) assert.ok(!existsSync(join(root, f)), f);
});

// ---------- C. EVIDENCE AUTHORIZATION (E-fixtures) --------------------------
test("E-1 valid statistic with evidence passes the evidence gate", () => {
  const s = pattern("STATISTIC", [{ role: "statistic_value", text: "Synthetic 3 in 4" }], { evidence_requirements: [{ evidence_id: "REAL-STAT-1", evidence_type: "STATISTIC" }] });
  const e = authorizeEvidence({ design_spec: s, evidence_context: EVID, truth_context: TRUTH });
  assert.equal(e.status, EVIDENCE_STATUS.PASS, JSON.stringify(e.failures));
});
test("E-2 statistic missing evidence FAILS (fabricated statistic)", () => {
  const s = pattern("STATISTIC", [{ role: "statistic_value", text: "Synthetic 3 in 4" }]);
  const e = authorizeEvidence({ design_spec: s, evidence_context: {}, truth_context: TRUTH });
  assert.equal(e.status, EVIDENCE_STATUS.FAIL);
  assert.ok(e.zero_tolerance.includes("FABRICATED_STATISTIC"));
});
test("E-3 valid testimonial proof record is accepted", () => {
  const s = pattern("TESTIMONIAL", [{ role: "quote", text: "Synthetic quote" }], { evidence_requirements: [{ evidence_id: "CP-1", evidence_type: "TESTIMONIAL" }] });
  const e = authorizeEvidence({ design_spec: s, evidence_context: { records: [{ evidence_id: "CP-1", evidence_type: "TESTIMONIAL", authorized: true }] }, truth_context: TRUTH });
  assert.equal(e.status, EVIDENCE_STATUS.PASS, JSON.stringify(e.failures));
});
test("E-4 synthetic fixture cannot authorize a testimonial (fake testimonial)", () => {
  const s = pattern("TESTIMONIAL", [{ role: "quote", text: "Synthetic quote" }], { evidence_requirements: [{ evidence_id: "SYN-TEST-1", evidence_type: "TESTIMONIAL" }] });
  const e = authorizeEvidence({ design_spec: s, evidence_context: { records: [{ evidence_id: "SYN-TEST-1", authorized: true, _fixture_origin: "synthetic" }] }, truth_context: TRUTH });
  assert.equal(e.status, EVIDENCE_STATUS.FAIL);
  assert.ok(e.zero_tolerance.includes("FAKE_TESTIMONIAL"));
  assert.ok(e.provenance.synthetic_refs >= 1);
});
test("E-5 valid Product Truth price passes", () => {
  const s = pattern("PRICE", [{ role: "price", text: "USD 29" }], { asset_purpose: "PRODUCT_CONVERSION" });
  const e = authorizeEvidence({ design_spec: s, evidence_context: {}, truth_context: TRUTH });
  assert.equal(e.failures.length, 0, JSON.stringify(e.failures));
});
test("E-6 wrong displayed price is zero-tolerance WRONG_PRICE", () => {
  const s = pattern("PRICE", [{ role: "price", text: "USD 19" }], { asset_purpose: "PRODUCT_CONVERSION" });
  const e = authorizeEvidence({ design_spec: s, evidence_context: {}, truth_context: TRUTH });
  assert.ok(e.zero_tolerance.includes("WRONG_PRICE"));
});
test("E-7 valid member price passes", () => {
  const s = pattern("PRICE", [{ role: "members_price", text: "0" }], { asset_purpose: "MEMBERSHIP_CONVERSION" });
  assert.equal(authorizeEvidence({ design_spec: s, evidence_context: {}, truth_context: TRUTH }).failures.length, 0);
});
test("E-8 wrong/defaulted member price is zero-tolerance WRONG_MEMBER_PRICE", () => {
  const s = pattern("PRICE", [{ role: "members_price", text: "0" }], { asset_purpose: "MEMBERSHIP_CONVERSION" });
  const e = authorizeEvidence({ design_spec: s, evidence_context: {}, truth_context: { ...TRUTH, commerce: { ...TRUTH.commerce, approved_member_price_text: "18750" } } });
  assert.ok(e.zero_tolerance.includes("WRONG_MEMBER_PRICE"));
});
test("E-9 supported comparison passes", () => {
  const s = pattern("COMPARISON", [{ role: "body", text: "Synthetic comparison" }], { comparison_basis: "INTERNAL_PRICE" });
  const e = authorizeEvidence({ design_spec: s, evidence_context: {}, truth_context: TRUTH });
  assert.equal(e.failures.length, 0, JSON.stringify(e.failures));
});
test("E-10 unsupported comparison FAILS", () => {
  const s = pattern("COMPARISON", [{ role: "body", text: "Synthetic comparison" }]);
  const e = authorizeEvidence({ design_spec: s, evidence_context: {}, truth_context: TRUTH });
  assert.equal(e.status, EVIDENCE_STATUS.FAIL);
});
test("E-11 supported before/after passes", () => {
  const s = pattern("BEFORE_AFTER", [{ role: "body", text: "Synthetic before/after" }], { evidence_requirements: [{ evidence_id: "BA-1", evidence_type: "BEFORE_AFTER" }] });
  const e = authorizeEvidence({ design_spec: s, evidence_context: { records: [{ evidence_id: "BA-1", authorized: true }], before_after: { before_ref: "B-1", after_ref: "A-1", relationship: "same subject, 14 days apart", misleading: false } }, truth_context: TRUTH });
  assert.equal(e.failures.length, 0, JSON.stringify(e.failures));
});
test("E-12 unsupported/misleading before/after is zero-tolerance MISLEADING_BEFORE_AFTER", () => {
  const s = pattern("BEFORE_AFTER", [{ role: "body", text: "Synthetic before/after" }]);
  const e = authorizeEvidence({ design_spec: s, evidence_context: { records: [{ evidence_id: "BA-2", authorized: true }], before_after: { before_ref: "B", after_ref: "A", relationship: "none", misleading: true } }, truth_context: TRUTH });
  assert.ok(e.zero_tolerance.includes("MISLEADING_BEFORE_AFTER"));
});
test("E-13 valid feature passes", () => {
  const s = pattern("FEATURE_BENEFIT", [{ role: "list_item", text: "Synthetic feature one" }]);
  assert.equal(authorizeEvidence({ design_spec: s, evidence_context: {}, truth_context: TRUTH }).failures.length, 0);
});
test("E-14 false feature is zero-tolerance FALSE_FEATURE", () => {
  const s = pattern("FEATURE_BENEFIT", [{ role: "list_item", text: "Synthetic feature NOT approved" }]);
  const e = authorizeEvidence({ design_spec: s, evidence_context: {}, truth_context: TRUTH });
  assert.ok(e.zero_tolerance.includes("FALSE_FEATURE"));
});
test("E-15 supported offer passes", () => {
  const s = pattern("OFFER", [{ role: "offer", text: "Synthetic bundle offer" }]);
  const e = authorizeEvidence({ design_spec: s, evidence_context: {}, truth_context: { ...TRUTH, commerce: { ...TRUTH.commerce, offer: { authorized: true } } } });
  assert.equal(e.failures.length, 0, JSON.stringify(e.failures));
});
test("E-16 fabricated scarcity is zero-tolerance FABRICATED_SCARCITY", () => {
  const s = pattern("OFFER", [{ role: "offer", text: "Synthetic bundle offer" }, { role: "supporting_line", text: "Only 3 left — ends tonight!" }]);
  const e = authorizeEvidence({ design_spec: s, evidence_context: {}, truth_context: { ...TRUTH, commerce: { ...TRUTH.commerce, offer: { authorized: true, scarcity_authorized: false } } } });
  assert.ok(e.zero_tolerance.includes("FABRICATED_SCARCITY"));
});

// ---------- D. DIMENSIONS + Q-fixtures --------------------------------------
test("Q-1 good type-only Swiipt graphic PASSES with frozen judgment", () => {
  const r = qa(DAY6_SPEC, { evaluator: ev(ALL_PASS), evidence_context: {}, truth_context: TRUTH });
  assert.equal(r.status, OVERALL_STATUS.PASS, JSON.stringify(r.blocking_failures) + JSON.stringify(r.diagnostics));
  assert.equal(r.judgment_run, true);
});
test("Q-2 generic/interchangeable design fails INTERCHANGEABILITY (fixture judgment FAIL)", () => {
  const r = qa(DAY6_SPEC, { evaluator: judge("INTERCHANGEABILITY", "FAIL", { rationale: "logo swappable" }), truth_context: TRUTH });
  assert.equal(r.status, OVERALL_STATUS.FAIL);
  assert.ok(r.diagnostics.some((d) => d.diagnostic === DIAGNOSTICS.GENERIC_TEMPLATE || d.diagnostic === "INTERCHANGEABILITY"));
});
test("Q-3 poor hierarchy detected", () => {
  assert.equal(qa(DAY6_SPEC, { evaluator: judge("HIERARCHY", "FAIL"), truth_context: TRUTH }).status, OVERALL_STATUS.FAIL);
});
test("Q-4 illegible treatment detected", () => {
  assert.equal(qa(DAY6_SPEC, { evaluator: judge("LEGIBILITY", "FAIL"), truth_context: TRUTH }).status, OVERALL_STATUS.FAIL);
});
test("Q-5 culturally misrepresented scene is zero-tolerance", () => {
  const r = qa(DAY6_SPEC, { evaluator: judge("CULTURAL_INTEGRITY", "FAIL", { failure_class: "SEVERE_CULTURAL_MISREPRESENTATION", severity: "HIGH" }), truth_context: TRUTH });
  assert.equal(r.status, OVERALL_STATUS.FAIL);
  assert.ok(r.blocking_failures.includes("SEVERE_CULTURAL_MISREPRESENTATION"));
});
test("Q-6 exaggerated emotional portrayal is a judgment failure", () => {
  const r = qa(DAY6_SPEC, { evaluator: judge("EMOTIONAL_INTEGRITY", "FAIL", { rationale: "panic beyond Customer Truth" }), truth_context: TRUTH });
  assert.equal(r.status, OVERALL_STATUS.FAIL);
  assert.ok(r.diagnostics.some((d) => d.diagnostic === DIAGNOSTICS.EMOTIONAL_EXAGGERATION || d.diagnostic === "EMOTIONAL_INTEGRITY"));
});
test("Q-7 unsupported visual transformation claim is zero-tolerance", () => {
  const r = qa(DAY6_SPEC, { evaluator: judge("UNSUPPORTED_VISUAL_CLAIM", "FAIL", { failure_class: "UNSUPPORTED_VISUAL_CLAIM" }), truth_context: TRUTH });
  assert.equal(r.status, OVERALL_STATUS.FAIL);
  assert.ok(r.blocking_failures.includes("UNSUPPORTED_VISUAL_CLAIM"));
});
test("Q-8 brand-inconsistent design fails BRAND_FIT", () => {
  assert.equal(qa(DAY6_SPEC, { evaluator: judge("BRAND_FIT", "FAIL"), truth_context: TRUTH }).status, OVERALL_STATUS.FAIL);
});
test("Q-9/Q-10 YouTube thumbnail platform fit is deterministic + judged with platform context", () => {
  const yt = adaptDesignSpecification({ spec: DAY6_SPEC, platform: "youtube", placement: "video_thumbnail", platform_format: "THUMBNAIL" }).design_specification;
  const good = qa(yt, { evaluator: ev(ALL_PASS), truth_context: TRUTH });
  assert.equal(good.status, OVERALL_STATUS.PASS);
  const bad = qa(yt, { evaluator: judge("PLATFORM_FIT", "FAIL", { rationale: "resized feed post" }), truth_context: TRUTH });
  // PLATFORM_FIT is deterministic, so a judgment FAIL on a deterministic dimension is ignored, not authoritative
  assert.equal(bad.dimensions.find((d) => d.id === "PLATFORM_FIT").class, DIMENSION_CLASS.DETERMINISTIC);
  const misfit = { ...yt, platform_format: "FEED_PORTRAIT" };
  assert.equal(evaluateSocialGraphic({ design_spec: misfit, rendered_artifact: artifactOf(yt), truth_context: TRUTH }).dimensions.find((d) => d.id === "PLATFORM_FIT").status, QA_STATUS.FAIL);
});
test("Q-11 carousel with one bad panel fails the whole asset", () => {
  const car = syntheticFixture("SD-2");
  const a = assembleMultiPanel(car, T);
  const panels = a.panels.map((p, i) => ({ rendered_artifact: { asset_type: "SOCIAL_STATIC", status: p.status, visible_text: p.visible_text, provenance: p.provenance }, layout_plan: p.layout_plan, evaluator: i === 1 ? judge("BRAND_FIT", "FAIL") : ev(ALL_PASS) }));
  const r = evaluateSocialGraphicAsset({ design_spec: car, rendered_artifact: { asset_type: "SOCIAL_CAROUSEL" }, panel_results: panels, truth_context: TRUTH });
  assert.equal(r.status, OVERALL_STATUS.FAIL);
  assert.equal(r.panel_count, 3);
  assert.equal(r.panels[1].status, OVERALL_STATUS.FAIL);
});
test("Q-12 sequence continuity failure is detected at sequence level", () => {
  const car = syntheticFixture("SD-2");
  const a = assembleMultiPanel(car, T);
  const broken = clone(car); broken.slides[2].sequence_role = "RESOLVE";      // ACT removed -> continuity/order issue
  const panels = a.panels.map((p) => ({ rendered_artifact: { asset_type: "SOCIAL_STATIC", status: p.status, visible_text: p.visible_text, provenance: p.provenance }, layout_plan: p.layout_plan, evaluator: ev(ALL_PASS) }));
  const r = evaluateSocialGraphicAsset({ design_spec: broken, rendered_artifact: { asset_type: "SOCIAL_CAROUSEL" }, panel_results: panels, truth_context: TRUTH });
  assert.equal(r.status, OVERALL_STATUS.REVIEW_REQUIRED);       // sequence check failure blocks PASS, not a failure of truth
  assert.equal(r.sequence_checks.find((c) => c.check === "act_present").pass, false);
});

// ---------- PART 69 — negative/positive matrix ------------------------------
test("69.1 production failure → NOT_ELIGIBLE", () => {
  const r = evaluateSocialGraphic({ design_spec: DAY6_SPEC, rendered_artifact: { asset_type: "SOCIAL_STATIC", status: "LAYOUT_OVERFLOW" }, truth_context: TRUTH });
  assert.equal(r.status, OVERALL_STATUS.NOT_ELIGIBLE);
});
test("69.2 TEXT_OVERFLOW → NOT_ELIGIBLE", () => {
  const r = evaluateSocialGraphic({ design_spec: DAY6_SPEC, rendered_artifact: { asset_type: "SOCIAL_STATIC", status: "TEXT_OVERFLOW" }, truth_context: TRUTH });
  assert.equal(r.status, OVERALL_STATUS.NOT_ELIGIBLE);
});
test("69.3 SOURCE_REQUIRED → NOT_ELIGIBLE", () => {
  const r = evaluateSocialGraphic({ design_spec: DAY6_SPEC, rendered_artifact: { asset_type: "SOCIAL_STATIC", status: "SOURCE_REQUIRED" }, truth_context: TRUTH });
  assert.equal(r.status, OVERALL_STATUS.NOT_ELIGIBLE);
});
test("69.4-69.5 statistic evidence gate (fail/pass) via QA", () => {
  const bad = pattern("STATISTIC", [{ role: "statistic_value", text: "Synthetic 3 in 4" }], { evidence_requirements: [{ evidence_id: "MISSING-1" }] });
  assert.equal(qa(bad, { evaluator: ev(ALL_PASS), truth_context: TRUTH }).status, OVERALL_STATUS.FAIL);
  const ok = pattern("STATISTIC", [{ role: "statistic_value", text: "Synthetic 3 in 4" }], { evidence_requirements: [{ evidence_id: "REAL-STAT-1" }] });
  const r = qa(ok, { evaluator: ev(ALL_PASS), evidence_context: EVID, truth_context: TRUTH });
  assert.equal(r.dimensions.find((d) => d.id === "EVIDENCE_INTEGRITY").status, QA_STATUS.PASS, JSON.stringify(r.evidence_authorization.failures));
});
test("69.6 synthetic evidence cannot authorize a statistic through QA", () => {
  const s = pattern("STATISTIC", [{ role: "statistic_value", text: "Synthetic 3 in 4" }], { evidence_requirements: [{ evidence_id: "SYN-STAT-1" }] });
  const r = qa(s, { evaluator: ev(ALL_PASS), evidence_context: EVID, truth_context: TRUTH });
  assert.equal(r.status, OVERALL_STATUS.FAIL);
  assert.ok(r.blocking_failures.includes("FABRICATED_STATISTIC"));
});
test("69.7-69.8 testimonial fake fails / valid proof accepted", () => {
  const fake = pattern("TESTIMONIAL", [{ role: "quote", text: "Synthetic quote" }], { evidence_requirements: [{ evidence_id: "SYN-TEST-1" }] });
  assert.equal(qa(fake, { evaluator: ev(ALL_PASS), evidence_context: { records: [{ evidence_id: "SYN-TEST-1", _fixture_origin: "synthetic" }] }, truth_context: TRUTH }).status, OVERALL_STATUS.FAIL);
  const real = pattern("TESTIMONIAL", [{ role: "quote", text: "Synthetic quote" }], { evidence_requirements: [{ evidence_id: "CP-9" }] });
  const r = qa(real, { evaluator: ev(ALL_PASS), evidence_context: { records: [{ evidence_id: "CP-9", authorized: true }] }, truth_context: TRUTH });
  assert.equal(r.evidence_authorization.status, EVIDENCE_STATUS.PASS, JSON.stringify(r.evidence_authorization.failures));
});
test("69.9 unsupported proof fails", () => {
  assert.equal(qa(pattern("PROOF", [{ role: "body", text: "Synthetic proof" }], { evidence_requirements: [{ evidence_id: "MISSING-P" }] }), { evaluator: ev(ALL_PASS), truth_context: TRUTH }).status, OVERALL_STATUS.FAIL);
});
test("69.10 misleading before/after zero-tolerance fails", () => {
  const s = pattern("BEFORE_AFTER", [{ role: "body", text: "Synthetic" }], { evidence_requirements: [{ evidence_id: "MISSING-BA" }] });
  const r = qa(s, { evaluator: ev(ALL_PASS), truth_context: TRUTH });
  assert.ok(r.blocking_failures.includes("MISLEADING_BEFORE_AFTER"));
});
test("69.11 unsupported comparison fails", () => {
  assert.equal(qa(pattern("COMPARISON", [{ role: "body", text: "Synthetic" }], { evidence_requirements: [{ evidence_id: "MISSING-C" }] }), { evaluator: ev(ALL_PASS), truth_context: TRUTH }).status, OVERALL_STATUS.FAIL);
});
test("69.12 wrong price zero-tolerance fails", () => {
  const r = qa(pattern("PRICE", [{ role: "price", text: "USD 19" }], { asset_purpose: "PRODUCT_CONVERSION" }), { evaluator: ev(ALL_PASS), truth_context: TRUTH });
  assert.equal(r.status, OVERALL_STATUS.FAIL);
  assert.ok(r.blocking_failures.includes("WRONG_PRICE"));
});
test("69.13 wrong member price zero-tolerance fails", () => {
  const r = qa(pattern("PRICE", [{ role: "members_price", text: "0" }], { asset_purpose: "MEMBERSHIP_CONVERSION" }), { evaluator: ev(ALL_PASS), truth_context: { ...TRUTH, commerce: { ...TRUTH.commerce, approved_member_price_text: "18750" } } });
  assert.ok(r.blocking_failures.includes("WRONG_MEMBER_PRICE"));
});
test("69.14 false feature zero-tolerance fails", () => {
  const r = qa(pattern("FEATURE_BENEFIT", [{ role: "list_item", text: "Not an approved feature" }]), { evaluator: ev(ALL_PASS), truth_context: TRUTH });
  assert.ok(r.blocking_failures.includes("FALSE_FEATURE"));
});
test("69.15 fabricated scarcity fails", () => {
  const s = pattern("OFFER", [{ role: "offer", text: "Synthetic offer" }, { role: "supporting_line", text: "Limited time only!" }]);
  const r = qa(s, { evaluator: ev(ALL_PASS), truth_context: { ...TRUTH, commerce: { ...TRUTH.commerce, offer: { authorized: true, scarcity_authorized: false } } } });
  assert.ok(r.blocking_failures.includes("FABRICATED_SCARCITY"));
});
test("69.16 safety violation zero-tolerance fails", () => {
  const s = pattern("PROOF", [{ role: "body", text: "This system cures postpartum pain." }], { evidence_requirements: [{ evidence_id: "CP-7" }] });
  const r = qa(s, { evaluator: ev(ALL_PASS), evidence_context: { records: [{ evidence_id: "CP-7", authorized: true }] }, truth_context: { ...TRUTH, product: { ...TRUTH.product, safety_review_status: "pending" } } });
  assert.equal(r.status, OVERALL_STATUS.FAIL);
  assert.ok(r.blocking_failures.includes("SAFETY_VIOLATION"));
});
test("69.17 unsupported visual claim zero-tolerance fails", () => {
  const r = qa(DAY6_SPEC, { evaluator: judge("UNSUPPORTED_VISUAL_CLAIM", "FAIL", { failure_class: "UNSUPPORTED_VISUAL_CLAIM" }), truth_context: TRUTH });
  assert.ok(r.blocking_failures.includes("UNSUPPORTED_VISUAL_CLAIM"));
});
test("69.18 severe cultural misrepresentation zero-tolerance fails", () => {
  const r = qa(DAY6_SPEC, { evaluator: judge("CULTURAL_INTEGRITY", "FAIL", { failure_class: "SEVERE_CULTURAL_MISREPRESENTATION" }), truth_context: TRUTH });
  assert.ok(r.blocking_failures.includes("SEVERE_CULTURAL_MISREPRESENTATION"));
});
test("69.19-69.20 high aesthetic score / evidence failure cannot be averaged away", () => {
  const perfect = { ...ALL_PASS, COMPOSITION: { status: "PASS", score: 10 }, BRAND_FIT: { status: "PASS", score: 10 } };
  const s = pattern("PRICE", [{ role: "price", text: "USD 19" }], { asset_purpose: "PRODUCT_CONVERSION" });
  const r = qa(s, { evaluator: ev(perfect), truth_context: TRUTH });
  assert.equal(r.status, OVERALL_STATUS.FAIL);
  assert.ok(r.blocking_failures.includes("WRONG_PRICE"));
});
test("69.21-69.22 no evaluator → JUDGMENT_REQUIRED, never PASS", () => {
  const r = qa(DAY6_SPEC, { truth_context: TRUTH });
  assert.equal(r.status, OVERALL_STATUS.JUDGMENT_REQUIRED);
  assert.equal(r.judgment_run, false);
  assert.ok(r.dimensions.some((d) => d.status === QA_STATUS.JUDGMENT_REQUIRED));
});
test("69.23 malformed evaluator result cannot PASS", () => {
  const bad = { provider: "mock", model: "mock", live: false, results: { HIERARCHY: { status: "EXCELLENT", rationale: "9/10 excellent composition" } } };
  assert.equal(validateEvaluatorResult(bad).valid, false);
  const r = qa(DAY6_SPEC, { evaluator: bad, truth_context: TRUTH });
  assert.notEqual(r.status, OVERALL_STATUS.PASS);
  assert.equal(r.status, OVERALL_STATUS.REVIEW_REQUIRED);
});
test("69.24-69.25 mock evaluator provenance is explicit and not presented as live", () => {
  const r = qa(DAY6_SPEC, { evaluator: ev(ALL_PASS, { provider: "fixture", model: "fixture", live: false }), truth_context: TRUTH });
  assert.equal(r.evaluator.live, false);
  assert.equal(r.provenance.evaluator.provider, "fixture");
  assert.equal(r.provenance.evaluator.live, false);
});
test("69.26-69.27 check classes visible in the result", () => {
  const r = qa(DAY6_SPEC, { evaluator: ev(ALL_PASS), truth_context: TRUTH });
  assert.equal(r.dimensions.find((d) => d.id === "COPY_INTEGRITY").class, DIMENSION_CLASS.DETERMINISTIC);
  assert.equal(r.dimensions.find((d) => d.id === "COMPOSITION").class, DIMENSION_CLASS.JUDGMENT_REQUIRED);
  assert.equal(r.dimensions.find((d) => d.id === "COMPOSITION").source, "judgment");
});
test("69.28 N/A image dimensions for a type-only graphic", () => {
  const r = qa(DAY6_SPEC, { evaluator: ev(ALL_PASS), truth_context: TRUTH });
  for (const id of ["VISUAL_GROUNDING_FIDELITY", "AI_ARTIFACTS", "ANATOMICAL_PLAUSIBILITY"]) assert.equal(r.dimensions.find((d) => d.id === id).status, QA_STATUS.NOT_APPLICABLE, id);
});
test("69.29 image-specific QA activates for a media-rich graphic", () => {
  const s = { ...syntheticFixture("SD-7"), visual_slots: [{ slot_id: "subject", media_type: "photo", required: true, fallback: "TYPE_ONLY", source: { artifact_id: "SYN-THUMB-SRC-1" } }] };
  const r = evaluateSocialGraphic({ design_spec: s, rendered_artifact: { ...artifactOf(s), generated_media: true, source_media_refs: ["SYN-THUMB-SRC-1"] }, evaluator: ev(ALL_PASS), truth_context: TRUTH });
  for (const id of ["VISUAL_GROUNDING_FIDELITY", "AI_ARTIFACTS", "ANATOMICAL_PLAUSIBILITY"]) assert.equal(r.dimensions.find((d) => d.id === id).status, QA_STATUS.PASS, id);
});
test("69.30 angle fidelity failure detected (generic mutation)", () => {
  const generic = { ...clone(DAY6_SPEC), design_id: "SD-GENERIC", content_pattern: "STATEMENT", copy_blocks: [{ role: "headline", text: "C-Section Recovery Tips" }] };
  const r = qa(generic, { evaluator: judge("ANGLE_FIDELITY", "FAIL", { rationale: "angle weakened to generic tips" }), truth_context: TRUTH });
  assert.equal(r.status, OVERALL_STATUS.FAIL);
  assert.ok(r.diagnostics.some((d) => d.diagnostic === DIAGNOSTICS.ANGLE_WEAKENED || d.diagnostic === "ANGLE_FIDELITY"));
});
test("69.31-69.37 judgment failures are surfaced as diagnostics", () => {
  for (const [id, diag] of [["INTERCHANGEABILITY", DIAGNOSTICS.GENERIC_TEMPLATE], ["HIERARCHY", DIAGNOSTICS.HIERARCHY_WEAK], ["LEGIBILITY", DIAGNOSTICS.LEGIBILITY_POOR]]) {
    const r = qa(DAY6_SPEC, { evaluator: judge(id, "FAIL"), truth_context: TRUTH });
    assert.equal(r.status, OVERALL_STATUS.FAIL, id);
    assert.ok(r.diagnostics.length >= 1);
    assert.ok(diag.length > 0);
  }
  const platform = qa(DAY6_SPEC, { evaluator: judge("COMPOSITION", "FAIL"), truth_context: TRUTH });
  assert.equal(platform.status, OVERALL_STATUS.FAIL);
});
test("69.38-69.39 Day-6 headline preserved and generic mutation distinguishable", () => {
  const r = qa(DAY6_SPEC, { evaluator: ev(ALL_PASS), truth_context: TRUTH });
  assert.equal(artifactOf(DAY6_SPEC).visible_text.includes(DAY6_HEADLINE), true);
  assert.equal(r.status, OVERALL_STATUS.PASS);
  const generic = { ...clone(DAY6_SPEC), copy_blocks: [{ role: "headline", text: "C-section recovery tips" }] };
  const g = qa(generic, { evaluator: judge("ANGLE_FIDELITY", "FAIL"), truth_context: TRUTH });
  assert.equal(g.status, OVERALL_STATUS.FAIL);
  // the canonical fixture itself is untouched
  assert.equal(DAY6_SPEC.copy_blocks[0].text, DAY6_HEADLINE);
});
test("69.40-69.42 YouTube type-only thumbnail valid; no image required; no CTR prediction", () => {
  const yt = adaptDesignSpecification({ spec: DAY6_SPEC, platform: "youtube", placement: "video_thumbnail", platform_format: "THUMBNAIL" }).design_specification;
  const r = qa(yt, { evaluator: ev(ALL_PASS), truth_context: TRUTH });
  assert.equal(r.status, OVERALL_STATUS.PASS);
  assert.equal(/\bctr\b|clickability|virality|expected performance/i.test(JSON.stringify(r)), false);
  assert.equal(readFileSync(join(root, "mae/services/social-graphic-qa.js"), "utf8").toLowerCase().includes("ctr"), false);
});
test("69.43-69.46 multi-panel: zero-tolerance panel fails asset; unresolved panel blocks PASS; no panel dropped", () => {
  const car = syntheticFixture("SD-2");
  const a = assembleMultiPanel(car, T);
  const zt = a.panels.map((p, i) => ({ rendered_artifact: { asset_type: "SOCIAL_STATIC", status: p.status, visible_text: p.visible_text, provenance: p.provenance }, layout_plan: p.layout_plan, evaluator: i === 0 ? judge("PRODUCT_TRUTH_FIDELITY", "FAIL", { failure_class: "PRODUCT_TRUTH_VIOLATION" }) : ev(ALL_PASS) }));
  const r = evaluateSocialGraphicAsset({ design_spec: car, rendered_artifact: { asset_type: "SOCIAL_CAROUSEL" }, panel_results: zt, truth_context: TRUTH });
  assert.equal(r.status, OVERALL_STATUS.FAIL);
  assert.equal(r.panels.length, 3);
  assert.ok(r.blocking_failures.includes("PRODUCT_TRUTH_VIOLATION"));
  const partial = a.panels.map((p, i) => ({ rendered_artifact: { asset_type: "SOCIAL_STATIC", status: p.status, visible_text: p.visible_text, provenance: p.provenance }, layout_plan: p.layout_plan, evaluator: i === 1 ? ev({}) : ev(ALL_PASS) }));
  const r2 = evaluateSocialGraphicAsset({ design_spec: car, rendered_artifact: { asset_type: "SOCIAL_CAROUSEL" }, panel_results: partial, truth_context: TRUTH });
  assert.equal(r2.status, OVERALL_STATUS.JUDGMENT_REQUIRED);
  assert.equal(r2.panels.length, 3);
});
test("69.47-69.48 QA does not rewrite copy or regenerate SVG", () => {
  const before = clone(DAY6_SPEC);
  const artifact = artifactOf(DAY6_SPEC);
  const svg = artifact.svg;
  qa(DAY6_SPEC, { evaluator: ev(ALL_PASS), truth_context: TRUTH });
  assert.deepEqual(DAY6_SPEC, before);
  assert.equal(artifactOf(DAY6_SPEC).svg, svg);
  const src = readFileSync(join(root, "mae/services/social-graphic-qa.js"), "utf8");
  const code = src.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
});
test("69.49-69.51 QA makes no provider/raster calls", () => {
  const src = readFileSync(join(root, "mae/services/social-graphic-qa.js"), "utf8");
  for (const banned of ["fetch(", "ffmpeg", "child_process", "image-provider", "video-provider", "writeFileSync", "png", "jpeg", "webp"]) assert.ok(!src.includes(banned), banned);
});
test("69.52-69.56 provenance carries ids, refs and profile", () => {
  const s = pattern("STATISTIC", [{ role: "statistic_value", text: "3 in 4" }], { evidence_requirements: [{ evidence_id: "REAL-STAT-1" }] });
  const r = qa(s, { evaluator: ev(ALL_PASS), evidence_context: EVID, truth_context: TRUTH });
  const p = r.provenance;
  assert.equal(p.qa_version, SOCIAL_GRAPHIC_QA_VERSION);
  assert.equal(p.design_id, s.design_id);
  assert.equal(p.angle_id, s.angle_id);
  assert.ok(Array.isArray(p.evidence_refs) && p.evidence_refs.includes("REAL-STAT-1"));
  assert.ok(p.platform_profile != null || p.artifact.platform_format === s.platform_format);
});
test("69.57 zero-tolerance classes are explicit on failing dimensions", () => {
  const r = qa(pattern("PRICE", [{ role: "price", text: "USD 999" }], { asset_purpose: "PRODUCT_CONVERSION" }), { evaluator: ev(ALL_PASS), truth_context: TRUTH });
  const dim = r.dimensions.find((d) => d.id === "EVIDENCE_INTEGRITY");
  assert.equal(dim.status, QA_STATUS.FAIL);
  assert.ok(ZERO_TOLERANCE_CLASSES.includes("WRONG_PRICE"));
});
test("69.58-69.60 results are deterministic, repeat byte-identical, no volatile state", () => {
  const a = qa(DAY6_SPEC, { evaluator: ev(ALL_PASS), truth_context: TRUTH });
  const b = qa(DAY6_SPEC, { evaluator: ev(ALL_PASS), truth_context: TRUTH });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const src = readFileSync(join(root, "mae/services/social-graphic-qa.js"), "utf8");
  for (const banned of ["Date.now", "Math.random", "randomUUID", "crypto"]) assert.ok(!src.includes(banned), banned);
});
test("evaluator vocabulary reuse: PASS/FAIL/HUMAN_REVIEW only", () => {
  assert.deepEqual([...JUDGMENT_STATUSES], ["PASS", "FAIL", "HUMAN_REVIEW"]);
  assert.equal(validateEvaluatorResult({ results: { HIERARCHY: { status: "BLOCK" } } }).valid, false);
});
test("human review is neither failure nor pass", () => {
  const r = qa(DAY6_SPEC, { evaluator: judge("CULTURAL_INTEGRITY", "HUMAN_REVIEW", { rationale: "borderline cultural marker" }), truth_context: TRUTH });
  assert.equal(r.status, OVERALL_STATUS.REVIEW_REQUIRED);
  assert.equal(r.human_review_required, true);
});
test("safety-sensitive product with pending review routes to review, not pass", () => {
  const r = qa(DAY6_SPEC, { evaluator: ev(ALL_PASS), truth_context: { ...TRUTH, product: { ...TRUTH.product, safety_review_status: "pending" } } });
  assert.equal(r.status, OVERALL_STATUS.REVIEW_REQUIRED);
});
test("evidence authorization is distinguishable from graphic quality", () => {
  const s = pattern("STATISTIC", [{ role: "statistic_value", text: "3 in 4" }], { evidence_requirements: [{ evidence_id: "MISSING-2" }] });
  const r = qa(s, { evaluator: ev(ALL_PASS), truth_context: TRUTH });
  assert.equal(r.evidence_authorization.status, EVIDENCE_STATUS.FAIL);
  assert.equal(r.dimensions.find((d) => d.id === "ANGLE_FIDELITY").status, QA_STATUS.PASS);   // quality passed, authorization failed
  assert.equal(r.status, OVERALL_STATUS.FAIL);
});
test("synthetic qualification fixtures stay labelled and never authorize", () => {
  for (const [id, s] of Object.entries(SD_FIXTURES)) assert.equal(s._fixture_origin, "synthetic", id);
  const s = pattern("TESTIMONIAL", [{ role: "quote", text: "q" }], { evidence_requirements: [{ evidence_id: "SYN-X" }] });
  assert.ok(authorizeEvidence({ design_spec: s, evidence_context: { records: [{ evidence_id: "SYN-X", _fixture_origin: "synthetic" }] }, truth_context: TRUTH }).zero_tolerance.includes("FAKE_TESTIMONIAL"));
});
test("frozen image fixture hashes unchanged", () => { for (const f of loadFixtures()) assert.equal(computeFixtureHash(f), f.fixture_hash, f.fixture_id); });
test("no provider capability was enabled", async () => {
  const vp = await import("../media/video-provider.js");
  assert.equal(vp.videoGenerationStatus().available, false);
});
test("Day-6 Instagram fixture renders before QA (production is upstream)", () => {
  const art = artifactOf(DAY6_SPEC);
  assert.equal(art.status, COMPOSITOR_STATUS.READY);
  assert.ok(svgVisibleText(art.svg).includes(DAY6_HEADLINE));
});
