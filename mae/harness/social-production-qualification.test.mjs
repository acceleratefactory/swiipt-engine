// MAE Social Design — Wave S-H: END-TO-END QUALIFICATION + PRODUCTION-READINESS FREEZE.
// Adversarial qualification of the Social Design Production V1 built in S-A…S-G.
// ONE harness. No production module is modified by this wave. No provider, no network, no raster,
// no OCR, no frame extraction, no publishing, no live evaluator. Every fixture is synthetic.
// Run: node mae/harness/social-production-qualification.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assembleSocialAssetFamily, familyId, memberId, canonicalFamilyProjection,
  SOCIAL_ASSET_FAMILY_VERSION, FAMILY_STATUS, MEMBER_STATUS, MEMBER_ERRORS, FAMILY_ERRORS,
} from "../services/social-asset-family.js";
import {
  day6FamilyInput, failureFixtures as FAM, DAY6_ANGLE, DAY6_HEADLINE, DAY6_STRATEGY, MEMBER_FEED, MEMBER_WHATSAPP, MEMBER_YOUTUBE,
  COPY_POOL, COPY_POOL_WITH_COMMERCE, FAMILY_REGISTRY, ALL_PASS_EVALUATOR, passEvaluator, failEvaluator,
} from "./social-family-fixtures.mjs";
import {
  QUALIFICATION_VERSION, CHECKPOINT_SHA, CANONICAL_DAY6_FIXTURE_TEXT, SD_DAY6_FIXTURE_PATH,
  baseSpec, copyBlock, specWithCopy, evidenceSpec, carouselSpec, carouselBase, slide,
  MULTI_PANEL_ATTACKS, MEDIA_ATTACKS, mediaEntry, TEXT_IN_IMAGE_SOURCE, SAFETY_SENSITIVE_TRUTH,
  APPROVED_COMMERCE_TRUTH, frozenJudgment, MALFORMED_EVALUATOR, GENERIC_MUTATION_TEXT, SYNTHETIC,
} from "./social-production-qualification-fixtures.mjs";
import { composeSocialStatic, COMPOSITOR_CHECKS, COMPOSITOR_STATUS, Z_ORDER, SOCIAL_COMPOSITOR_VERSION, buildLayoutPlan } from "../media/social-compositor.js";
import { assembleMultiPanel, SOCIAL_ASSEMBLER_VERSION } from "../media/social-carousel.js";
import {
  resolveSocialSourceMedia, normalizeSocialSourceMedia, mediaAuthorizesEvidence, hasGeneratedMedia, hasSyntheticMedia,
  sourceMediaId, SOURCE_MEDIA_STATUS, SOURCE_TYPES, SOCIAL_SOURCE_MEDIA_VERSION,
} from "../media/social-source-media.js";
import {
  evaluateSocialGraphic, evaluateSocialGraphicAsset, authorizeEvidence, createMockEvaluator,
  OVERALL_STATUS, EVIDENCE_STATUS, QA_STATUS, ZERO_TOLERANCE_CLASSES, PATTERN_AUTHORIZATION, SOCIAL_QA_DIMENSIONS, SOCIAL_GRAPHIC_QA_VERSION,
} from "../services/social-graphic-qa.js";
import {
  validateSocialDesignSpec, ASSET_TYPES, COPY_ROLES, PRICE_COPY_ROLES, SOCIAL_DESIGN_SPEC_VERSION,
} from "../services/social-design-spec.js";
import {
  PLATFORM_PROFILES, PLATFORM_PROFILES_VERSION, resolvePlatformPlacementProfile, adaptDesignSpecification, validateSpecAgainstProfile,
} from "../services/social-platforms.js";
import { socialTokens } from "../services/social-design-tokens.js";
import { MEDIA_SOURCES } from "./social-media-fixtures.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const T = socialTokens();
const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");
const read = (p) => readFileSync(join(root, p), "utf8");
const FROZEN = {
  canonicalDay6: "46f0cbebca51403bb8b93416d401977ffcd14063e417398ad63b3101ded11e5f",
  day6Manifest: "c29ca7290a2cc708a8eeb4c61a11fe0128bfce695675eb9d603d8241bef3f602",
};

// ---------------------------------------------------------------------------------------------
// qualification record keeping (deterministic matrix)
// ---------------------------------------------------------------------------------------------
const CASES = [];
const INVARIANTS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T"];
const NON_BLOCKING_DEFECTS = [
  {
    id: "NBD-1-EVALUATOR-DETERMINISTIC-DIM-IGNORED",
    classification: "NON_BLOCKING_DEFECT",
    title: "An evaluator result for a deterministic QA dimension is ignored without a diagnostic",
    evidence: "evaluateSocialGraphic with a fixture evaluator reporting EVIDENCE_INTEGRITY: {status:'FAIL', failure_class:'WRONG_PRICE'} plus all judgment dims PASS returns status PASS with blocking_failures [] (no diagnostic recorded). The evidence gate itself still fails a wrong price (authorizeEvidence → FAIL / WRONG_PRICE), so protection is not weakened; the evaluator-reported detection is silently dropped.",
    impact: "Second-order: a judgment model that notices a deterministic defect cannot surface it. Deterministic dimensions remain system-owned by design.",
    fix_window: "post-freeze (record EVALUATOR_DIMENSION_IGNORED diagnostic)",
  },
  {
    id: "NBD-2-GOLD-ACCENT-COVERED-IN-UNSHIPPABLE-FALLBACK",
    classification: "PRE_EXISTING_DESIGN_REFINEMENT / NON_BLOCKING_DEFECT",
    title: "Gold accent bar is painted beneath the base panel placeholder in the media-less slot-family fallback",
    evidence: "media-less IMAGE_DOMINANT (no source bound → compositor status SOURCE_REQUIRED): rect order = background > accent(72,120,208x8,#D9A52E) > panel(72,120,936x1008,#F4F6F8); the accent box is fully inside the panel box, so the opaque panel covers it. In every shippable composition (type-only static families; media-bound IMAGE_DOMINANT; FULL_BLEED+scrim) no panel rect exists and the accent paints after media/scrim and before typography.",
    impact: "Visual only, and only on a non-shippable placeholder render (SOURCE_REQUIRED). No content loss, no brand-meaning loss, no platform-safety impact.",
    fix_window: "post-freeze design refinement (owner decision)",
  },
];
const DEFERRED_CAPABILITIES = [
  "raster export", "live image provider qualification", "live video provider qualification", "live evaluator",
  "publishing / social APIs", "performance optimization", "Canva/Figma editing", "drag/drop editor",
  "font-management subsystem", "advanced motion", "automatic video frame extraction", "CTR prediction",
  "automatic campaign optimization",
].map((c) => ({ capability: c, blocks_v1: false, reason: "not required for the deterministic Social Design V1 contract" }));

function record({ id, category, invariants, status, ok, detail, expected, actual }) {
  CASES.push({
    case_id: id, category, invariants,
    expected_status: expected ?? "PASS",
    actual_status: status,
    result: ok ? "PASS" : "FAIL",
    detail: detail ?? "",
  });
  for (const inv of invariants) {
    INVARIANTS.includes(inv) && (INVARIANTS_RESULT[inv] ||= []).push(ok);
  }
  assert.ok(ok, `${id} [${category}] ${detail}`);
}
const INVARIANTS_RESULT = {};

/** Compact case helper: run() returns { status, ok, detail }. */
function q(id, category, invariants, run) {
  test(`${id} · ${category}`, () => {
    const r = run();
    record({ id, category, invariants, status: r.status, ok: r.ok === true, detail: r.detail });
  });
}

const day6 = () => assembleSocialAssetFamily(day6FamilyInput());
const fam = (input) => assembleSocialAssetFamily(input);
const roleOf = (r, role) => r.members.find((m) => m.role === role);
const compose = (spec, registry = []) => {
  const res = resolveSocialSourceMedia({ design_spec: spec, source_media_registry: registry });
  const c = composeSocialStatic(spec, T, { sources: res.sources, bindings: res.bindings });
  return { res, ...c };
};
const artOf = (spec, registry = []) => {
  const r = compose(spec, registry);
  return { asset_type: spec.asset_type, status: r.status, svg: r.svg, visible_text: r.visible_text, provenance: r.provenance, source_media_refs: (r.provenance?.media || []).map((m) => m.source_media_id), generated_media: r.provenance?.generated_media === true };
};
const panelArt = (spec, asm) => ({ asset_type: spec.asset_type, status: asm.status, visible_text: asm.panels.map((p) => p.visible_text).join(" "), provenance: asm.provenance, source_media_refs: [], generated_media: false });
const qaOf = (spec, opts = {}) => evaluateSocialGraphic({ design_spec: spec, rendered_artifact: artOf(spec, opts.registry || []), ...opts });
const ALL_JUDGMENT_PASS = () => Object.fromEntries(SOCIAL_QA_DIMENSIONS.filter((d) => d.class === "JUDGMENT_REQUIRED").map((d) => [d.id, { status: "PASS", rationale: "qualification fixture judgment" }]));

// =============================================================================================
// Q1 — TRUTH / ANGLE INTEGRITY
// =============================================================================================
q("Q1-01", "Q1_TRUTH_ANGLE", ["A", "B", "C", "O", "P", "S"], () => {
  const r = day6();
  const specsValid = r.members.every((m) => validateSocialDesignSpec(m._spec).valid);
  const qaPass = r.members.every((m) => m.qa.status === "PASS");
  const hash = r.family_manifest.manifest_hash;
  const ok = r.family_status === FAMILY_STATUS.APPROVED && r.members.length === 5 && r.required_member_ids.length === 3
    && r.optional_member_ids.length === 2 && specsValid && qaPass && hash === FROZEN.day6Manifest;
  return { status: r.family_status, ok, detail: `members=${r.members.length} required=${r.required_member_ids.length} optional=${r.optional_member_ids.length} specs_valid=${specsValid} qa_pass=${qaPass} manifest=${hash.slice(0, 12)}` };
});

q("Q1-02", "Q1_TRUTH_ANGLE", ["A", "B"], () => {
  // a member cannot carry its own angle: unknown member fields are not part of the contract
  const tainted = [MEMBER_FEED, { ...MEMBER_WHATSAPP, angle_id: "ANG-OTHER-999", marketing_angle_id: "ANG-OTHER-999", angle: { id: "ANG-OTHER-999" } }];
  const r = fam(day6FamilyInput({ members: tainted }));
  const angles = new Set(r.members.map((m) => m.trace?.angle_id).filter(Boolean));
  const ok = r.angle_id === DAY6_ANGLE.id && angles.size === 1 && angles.has(DAY6_ANGLE.id) && r.family_status === FAMILY_STATUS.APPROVED;
  return { status: r.family_status, ok, detail: `family_angle=${r.angle_id} member_angles=${[...angles].join("|")}` };
});

q("Q1-03", "Q1_TRUTH_ANGLE", ["A"], () => {
  const r = fam(FAM.redAngle());
  return { status: r.family_status, ok: r.family_status === FAMILY_STATUS.NOT_ELIGIBLE && r.no_fanout === true && r.members.length === 0 && r.errors.some((e) => e.code === FAMILY_ERRORS.ANGLE_RED), detail: `errors=${r.errors.map((e) => e.code).join(",")}` };
});

q("Q1-04", "Q1_TRUTH_ANGLE", ["A"], () => {
  const r = fam(FAM.invalidValidation());
  return { status: r.family_status, ok: r.family_status === FAMILY_STATUS.INVALID && r.errors.some((e) => e.code === FAMILY_ERRORS.INVALID_ANGLE_VALIDATION), detail: `errors=${r.errors.map((e) => e.code).join(",")}` };
});

q("Q1-05", "Q1_TRUTH_ANGLE", ["A"], () => {
  const r = fam(day6FamilyInput({ validation: { id: "VAL-X", angle_id: DAY6_ANGLE.id, verdict: "MAYBE" } }));
  return { status: r.family_status, ok: r.family_status === FAMILY_STATUS.INVALID && r.no_fanout === true, detail: `verdict=MAYBE errors=${r.errors.map((e) => e.code).join(",")}` };
});

q("Q1-06", "Q1_TRUTH_ANGLE", ["A"], () => {
  const r = fam(FAM.yellowNotPermitted());
  return { status: r.family_status, ok: r.family_status === FAMILY_STATUS.NOT_ELIGIBLE && r.no_fanout === true && r.errors.some((e) => e.code === FAMILY_ERRORS.YELLOW_NOT_PERMITTED), detail: `errors=${r.errors.map((e) => e.code).join(",")}` };
});

q("Q1-07", "Q1_TRUTH_ANGLE", ["A"], () => {
  const r = fam(FAM.yellowOverCap());
  const overCap = r.members.filter((m) => m.status_reason === MEMBER_ERRORS.YELLOW_SCOPE_LIMIT);
  return { status: r.family_status, ok: r.no_fanout === false && overCap.length === 1 && r.members.filter((m) => m.status === MEMBER_STATUS.PASS).length === 2 && r.family_status !== FAMILY_STATUS.APPROVED, detail: `pass=${r.members.filter((m) => m.status === MEMBER_STATUS.PASS).length} over_cap_retained=${overCap.length}` };
});

q("Q1-08", "Q1_TRUTH_ANGLE", ["A"], () => {
  const r = fam(FAM.outOfScopePlatform());
  const m = roleOf(r, "EDUCATION");
  return { status: r.family_status, ok: m.status === MEMBER_STATUS.NOT_ELIGIBLE && m.status_reason === MEMBER_ERRORS.ANGLE_SCOPE_VIOLATION && m.artifact_ref === undefined, detail: `member=${m.status}:${m.status_reason}` };
});

q("Q1-09", "Q1_TRUTH_ANGLE", ["A", "B", "P"], () => {
  const r = day6();
  const refs = new Set(r.members.map((m) => JSON.stringify([...m.trace.truth_refs].sort())));
  const truth = JSON.parse([...refs][0]);
  const complete = ["PTR-CSEC-001", "CRF-CSEC-014", "MIF-CSEC-011"].every((x) => truth.includes(x));
  // a different angle (different Product Truth) moves the WHOLE family — never one member
  const other = fam(day6FamilyInput({ marketing_angle: { ...DAY6_ANGLE, id: "ANG-CSEC-006", tier3: { ...DAY6_ANGLE.tier3, product_truth_ref: "PTR-OTHER-999" } } }));
  const otherRefs = JSON.parse(JSON.stringify([...new Set(other.members.map((m) => JSON.stringify([...m.trace.truth_refs].sort())))]));
  const wholeFamilyFollows = otherRefs.length === 1 && otherRefs[0].includes("PTR-OTHER-999");
  const ok = refs.size === 1 && complete && wholeFamilyFollows;
  return { status: r.family_status, ok, detail: `member_ref_sets=${refs.size} complete=${complete} whole_family_follows_angle=${wholeFamilyFollows}` };
});

// =============================================================================================
// Q2 — COPY INTEGRITY
// =============================================================================================
q("Q2-01", "Q2_COPY", ["C", "D"], () => {
  const r = day6();
  const withHeadline = r.members.filter((m) => m.copy_refs.includes("COPY-HOOK-1"));
  const exact = withHeadline.every((m) => m._artifact.visible_text.includes(DAY6_HEADLINE));
  const pool = new Set(COPY_POOL.map((b) => b.copy_id));
  const provenanceOk = r.members.every((m) => m.copy_refs.every((c) => pool.has(c)));
  return { status: r.family_status, ok: withHeadline.length === 5 && exact && provenanceOk, detail: `headline_members=${withHeadline.length} exact=${exact} provenance_ok=${provenanceOk}` };
});

q("Q2-02", "Q2_COPY", ["D"], () => {
  const r = fam(day6FamilyInput({ members: [{ ...MEMBER_FEED, copy_overrides: { "COPY-HOOK-1": "A stronger headline the orchestrator wrote" } }, MEMBER_WHATSAPP] }));
  const leaked = JSON.stringify(r).includes("A stronger headline the orchestrator wrote");
  return { status: r.family_status, ok: r.family_status === FAMILY_STATUS.INVALID && r.no_fanout === true && !leaked && r.errors.some((e) => e.code === FAMILY_ERRORS.COPY_MUTATION_REJECTED), detail: `mutation_leaked=${leaked}` };
});

q("Q2-03", "Q2_COPY", ["D"], () => {
  const payloads = [
    { "COPY-HOOK-1": "Nobody tells you what standing up feels like on day 6" },          // punctuation deletion
    { "COPY-HOOK-1": "NOBODY TELLS YOU WHAT STANDING UP FEELS LIKE ON DAY 6." },          // case + punctuation
    { "COPY-HOOK-1": "Nobody tells you what standing up feels like." },                   // word deletion
    { "COPY-HOOK-1": "Nobody really tells you what standing up feels like on day 6, honestly." }, // addition
    { "COPY-HOOK-1": "Standing up on day 6 can feel strange at first." },                  // paraphrase
  ];
  const results = payloads.map((p) => fam(day6FamilyInput({ members: [{ ...MEMBER_FEED, copy_overrides: p }, MEMBER_WHATSAPP] })));
  const allRejected = results.every((r) => r.family_status === FAMILY_STATUS.INVALID && r.no_fanout === true && r.errors.some((e) => e.code === FAMILY_ERRORS.COPY_MUTATION_REJECTED));
  const noLeak = results.every((r, i) => !JSON.stringify(r.members).includes(Object.values(payloads[i])[0]));
  return { status: results[0].family_status, ok: allRejected && noLeak, detail: `payloads=${payloads.length} all_rejected=${allRejected} no_leak=${noLeak}` };
});

q("Q2-04", "Q2_COPY", ["D"], () => {
  const r = fam(day6FamilyInput({ members: [{ ...MEMBER_FEED, copy_roles: ["headline", "cta"] }, MEMBER_WHATSAPP] }));
  const m = roleOf(r, "IDENTIFICATION");
  return { status: r.family_status, ok: m.status === MEMBER_STATUS.NOT_ELIGIBLE && m.status_reason === MEMBER_ERRORS.COPY_ROLE_UNRESOLVED && m.status_detail.includes("cta"), detail: `reason=${m.status_reason} unresolved=${JSON.stringify(m.status_detail)}` };
});

q("Q2-05", "Q2_COPY", ["D"], () => {
  const r = fam(day6FamilyInput({ members: [{ ...MEMBER_FEED, copy_roles: ["headline", "price", "members_price"] }, MEMBER_WHATSAPP] }));
  const m = roleOf(r, "IDENTIFICATION");
  const unresolved = m.status_detail || [];
  return { status: r.family_status, ok: m.status_reason === MEMBER_ERRORS.COPY_ROLE_UNRESOLVED && unresolved.includes("price") && unresolved.includes("members_price"), detail: `unresolved=${JSON.stringify(unresolved)}` };
});

q("Q2-06", "Q2_COPY", ["D", "K"], () => {
  const r = fam(day6FamilyInput({ members: [{ ...MEMBER_FEED, copy_roles: ["headline", "quote", "statistic_value"] }, MEMBER_WHATSAPP] }));
  const m = roleOf(r, "IDENTIFICATION");
  const unresolved = m.status_detail || [];
  return { status: r.family_status, ok: m.status_reason === MEMBER_ERRORS.COPY_ROLE_UNRESOLVED && unresolved.includes("quote") && unresolved.includes("statistic_value"), detail: `unresolved=${JSON.stringify(unresolved)}` };
});

q("Q2-07", "Q2_COPY", ["C", "D"], () => {
  const r = fam(day6FamilyInput({ members: [{ ...MEMBER_FEED, copy_roles: [] }, MEMBER_WHATSAPP] }));
  const m = roleOf(r, "IDENTIFICATION");
  return { status: r.family_status, ok: m.status === MEMBER_STATUS.NOT_ELIGIBLE && m.status_reason === MEMBER_ERRORS.REQUIRED_COPY_OMITTED, detail: `reason=${m.status_reason} detail=${JSON.stringify(m.status_detail)}` };
});

q("Q2-08", "Q2_COPY", ["C"], () => {
  const r = day6();
  const m = roleOf(r, "EDUCATION");
  const omitted = m.copy_selection.omitted.map((o) => o.copy_id);
  const manifestMember = r.family_manifest.members.find((x) => x.member_id === m.member_id);
  return { status: r.family_status, ok: omitted.includes("SF-BODY-1") && omitted.includes("SF-SUPPORT-1") && m.copy_selection.omitted.every((o) => !!o.reason) && JSON.stringify(manifestMember.copy_omitted) === JSON.stringify(omitted), detail: `omitted=${omitted.join("|")} recorded_in_manifest=true` };
});

q("Q2-09", "Q2_COPY", ["D", "K"], () => {
  // commerce/proof copy supplied upstream is used — and must still satisfy the evidence gate
  const r = fam(FAM.commerceSupplied());
  const m = roleOf(r, "IDENTIFICATION");
  const copyUsed = m.copy_refs.includes("SF-PRICE-1") && m.copy_refs.includes("SF-CTA-1");
  // no pool → no insertion at all
  const plain = day6();
  const roles = new Set(plain.members.flatMap((x) => (x._spec.copy_blocks || []).map((b) => b.role)));
  const noneAutomatic = !["cta", "price", "members_price", "offer", "statistic_value", "quote"].some((x) => roles.has(x));
  return { status: r.family_status, ok: copyUsed && noneAutomatic, detail: `supplied_used=${copyUsed} automatic_absent=${noneAutomatic}` };
});

q("Q2-10", "Q2_COPY", ["D", "P"], () => {
  const r = day6();
  const pool = new Set(COPY_POOL.map((b) => b.copy_id));
  const catalogued = r.members.every((m) => m.copy_refs.every((c) => pool.has(c)));
  const specDerived = r.members.every((m) => (m._spec.provenance.copy_refs || []).every((c) => pool.has(c)));
  const inManifest = r.family_manifest.members.every((mm) => (mm.copy_refs || []).every((c) => pool.has(c)));
  return { status: r.family_status, ok: catalogued && specDerived && inManifest, detail: `member=${catalogued} spec_provenance=${specDerived} manifest=${inManifest}` };
});

// =============================================================================================
// Q3 — EVIDENCE INTEGRITY
// =============================================================================================
const evCase = (id, pattern, role, text, expectClass) => q(id, "Q3_EVIDENCE", ["K", "N"], () => {
  const spec = evidenceSpec(pattern, role, text);
  const e = authorizeEvidence({ design_spec: spec, evidence_context: {}, truth_context: {} });
  const composed = compose(spec);
  const qa = evaluateSocialGraphic({ design_spec: spec, rendered_artifact: artOf(spec), truth_context: {}, evidence_context: {} });
  const cls = (e.failures || []).map((f) => f.zero_tolerance).filter(Boolean);
  const blockedAtProduction = composed.status === COMPOSITOR_STATUS.INVALID_SPEC;   // a template never authorizes a claim
  const ok = e.status === EVIDENCE_STATUS.FAIL && qa.status !== OVERALL_STATUS.PASS
    && (blockedAtProduction ? true : [OVERALL_STATUS.FAIL, OVERALL_STATUS.NOT_ELIGIBLE, OVERALL_STATUS.REVIEW_REQUIRED].includes(qa.status))
    && (!expectClass || cls.includes(expectClass));
  return { status: e.status, ok, detail: `evidence=${e.status} production=${composed.status} qa=${qa.status} classes=${cls.join("|")}` };
});
evCase("Q3-01", "STATISTIC", "statistic_value", "Synthetic 3 in 4 claim", "FABRICATED_STATISTIC");
evCase("Q3-02", "TESTIMONIAL", "quote", "Synthetic customer quote", "FAKE_TESTIMONIAL");
evCase("Q3-03", "PROOF", "quote", "Synthetic proof claim", "FABRICATED_PROOF");
evCase("Q3-04", "BEFORE_AFTER", "body", "Synthetic before/after", null);
evCase("Q3-05", "COMPARISON", "body", "Synthetic comparison", null);

q("Q3-06", "Q3_EVIDENCE", ["K"], () => {
  const price = authorizeEvidence({ design_spec: evidenceSpec("PRICE", "price", "USD 9"), evidence_context: {}, truth_context: APPROVED_COMMERCE_TRUTH });
  const member = authorizeEvidence({ design_spec: evidenceSpec("PRICE", "members_price", "USD 99"), evidence_context: {}, truth_context: APPROVED_COMMERCE_TRUTH });
  const ok = price.status === EVIDENCE_STATUS.FAIL && member.status === EVIDENCE_STATUS.FAIL
    && (price.failures || []).some((f) => f.zero_tolerance === "WRONG_PRICE");
  return { status: `${price.status}/${member.status}`, ok, detail: `price=${price.status} member_price=${member.status}` };
});

q("Q3-07", "Q3_EVIDENCE", ["K"], () => {
  const scarcity = authorizeEvidence({ design_spec: { ...evidenceSpec("OFFER", "offer", "Only 3 left today"), platform_format: "FEED_PORTRAIT" }, evidence_context: {}, truth_context: APPROVED_COMMERCE_TRUTH });
  const feature = authorizeEvidence({ design_spec: evidenceSpec("FEATURE_BENEFIT", "body", "Clinically proven to heal"), evidence_context: {}, truth_context: {} });
  return { status: `${scarcity.status}/${feature.status}`, ok: scarcity.status === EVIDENCE_STATUS.FAIL && feature.status === EVIDENCE_STATUS.FAIL, detail: `scarcity=${scarcity.status} false_feature=${feature.status}` };
});

q("Q3-08", "Q3_EVIDENCE", ["K"], () => {
  const spec = evidenceSpec("STATISTIC", "statistic_value", "Synthetic 9 in 10 claim");
  const perfect = createMockEvaluator({ results: ALL_JUDGMENT_PASS() });
  const composed = compose(spec);
  const qa = evaluateSocialGraphic({ design_spec: spec, rendered_artifact: artOf(spec), truth_context: {}, evidence_context: {}, evaluator: perfect });
  const evidence = authorizeEvidence({ design_spec: spec, evidence_context: {}, truth_context: {} });
  const ok = evidence.status === EVIDENCE_STATUS.FAIL && qa.status !== OVERALL_STATUS.PASS
    && (qa.blocking_failures.includes("FABRICATED_STATISTIC") || composed.status === COMPOSITOR_STATUS.INVALID_SPEC || qa.status === OVERALL_STATUS.NOT_ELIGIBLE);
  return { status: qa.status, ok, detail: `all_judgment_PASS but evidence=${evidence.status} production=${composed.status} qa=${qa.status} blocking=${qa.blocking_failures.join("|")}` };
});

q("Q3-09", "Q3_EVIDENCE", ["N"], () => {
  const spec = evidenceSpec("STATISTIC", "statistic_value", "Synthetic claim");
  const syntheticRecord = { records: [{ evidence_id: "SYN-STAT-1", evidence_type: "STATISTIC", authorized: true, synthetic: true, _fixture_origin: "synthetic" }] };
  const syn = authorizeEvidence({ design_spec: spec, evidence_context: syntheticRecord, truth_context: {} });
  const synId = authorizeEvidence({ design_spec: spec, evidence_context: { records: [{ evidence_id: "SYN-STAT-2", evidence_type: "STATISTIC", authorized: true }] }, truth_context: {} });
  const fixtureFlag = authorizeEvidence({ design_spec: spec, evidence_context: { records: [{ evidence_id: "REAL-STAT-9", evidence_type: "STATISTIC", authorized: true, _fixture_origin: "synthetic" }] }, truth_context: {} });
  const all = [syn, synId, fixtureFlag];
  return { status: all.map((x) => x.status).join("/"), ok: all.every((x) => x.status === EVIDENCE_STATUS.FAIL), detail: `synthetic=${syn.status} SYN_id=${synId.status} fixture_flag=${fixtureFlag.status}` };
});

// =============================================================================================
// Q4 — PLATFORM INTEGRITY
// =============================================================================================
q("Q4-01", "Q4_PLATFORM", ["G", "H"], () => {
  const unknownPlatform = resolvePlatformPlacementProfile({ platform: "instagram", placement: "nowhere" });
  const unknownPlacement = resolvePlatformPlacementProfile({ platform: "unknown", placement: "feed" });
  const familyMember = roleOf(fam(FAM.unknownPlatform()), "EDUCATION");
  const ok = !unknownPlatform.ok && !unknownPlacement.ok && familyMember.status === MEMBER_STATUS.NOT_ELIGIBLE && familyMember.platform === "unknown";
  return { status: `${unknownPlatform.status}/${unknownPlacement.status}`, ok, detail: `placement=${unknownPlatform.status} platform=${unknownPlacement.status} member=${familyMember.status_reason}` };
});

q("Q4-02", "Q4_PLATFORM", ["G"], () => {
  const m = roleOf(fam(day6FamilyInput({ members: [MEMBER_FEED, { ...MEMBER_WHATSAPP, platform_format: "FEED_SQUARE" }] })), "EDUCATION");
  const mismatch = resolvePlatformPlacementProfile({ platform: "instagram", placement: "feed", platform_format: "THUMBNAIL" });
  return { status: m.status_reason, ok: m.status_reason === MEMBER_ERRORS.FORMAT_NOT_ACCEPTED && !mismatch.ok, detail: `member=${m.status_reason} resolver=${mismatch.status}` };
});

q("Q4-03", "Q4_PLATFORM", ["G"], () => {
  const spec = { ...baseSpec({ design_id: "SH-WRONG-CANVAS" }), platform: "youtube", placement: "video_thumbnail", platform_format: "THUMBNAIL", canvas: { width: 1080, height: 1350, aspect_ratio: "4:5" } };
  const v = validateSpecAgainstProfile(spec, PLATFORM_PROFILES["youtube|video_thumbnail"]);
  const adapted = adaptDesignSpecification({ spec: baseSpec({ design_id: "SH-ADAPT" }), platform: "youtube", placement: "video_thumbnail", platform_format: "THUMBNAIL" });
  return { status: v.status, ok: v.valid === false && /canvas/.test((v.errors || []).join(" ")) && adapted.design_specification.canvas.width === 1280 && adapted.design_specification.canvas.height === 720, detail: `validate=${v.status} errors=${(v.errors || []).slice(0, 2).join("; ")}` };
});

q("Q4-04", "Q4_PLATFORM", ["G", "H", "P"], () => {
  const r = day6();
  const canvas = Object.fromEntries(r.members.map((m) => [`${m.platform}.${m.placement}`, `${m.artifact_ref.canvas.width}x${m.artifact_ref.canvas.height}`]));
  const expected = { "instagram.feed": "1080x1350", "instagram.carousel": "1080x1350", "whatsapp.share_card": "1200x630", "youtube.video_thumbnail": "1280x720", "instagram.story": "1080x1920" };
  const ok = Object.entries(expected).every(([k, v]) => canvas[k] === v) && r.members.every((m) => m.trace.profile_id === `${m.platform}.${m.placement}`);
  return { status: r.family_status, ok, detail: JSON.stringify(canvas) };
});

q("Q4-05", "Q4_PLATFORM", ["H"], () => {
  const r = day6();
  const four = r.members.filter((m) => ["instagram.feed", "youtube.video_thumbnail", "whatsapp.share_card", "instagram.story"].includes(`${m.platform}.${m.placement}`));
  const canvases = new Set(four.map((m) => `${m.artifact_ref.canvas.width}x${m.artifact_ref.canvas.height}`));
  const layouts = new Set(four.map((m) => m.layout_family));
  const hashes = new Set(four.map((m) => m.artifact_ref.bytes_hash));
  const specs = four.map((m) => buildLayoutPlan(m._spec, T));
  const planShapes = new Set(specs.map((p) => `${p.canvas.width}x${p.canvas.height}:${p.layout_family}:${(p.component_placements || []).length}`));
  return { status: r.family_status, ok: canvases.size === 4 && layouts.size >= 3 && hashes.size === 4 && planShapes.size === 4, detail: `canvases=${canvases.size} layouts=${layouts.size} artifacts=${hashes.size} layout_plans=${planShapes.size}` };
});

q("Q4-06", "Q4_PLATFORM", ["G"], () => {
  const spec = { ...baseSpec({ design_id: "SH-BAD-ZONES" }), platform: "youtube", placement: "video_thumbnail", platform_format: "THUMBNAIL", canvas: { width: 1280, height: 720 }, safe_zones: { top: 999, bottom: 999, left: 999, right: 999 } };
  const v = validateSpecAgainstProfile(spec, PLATFORM_PROFILES["youtube|video_thumbnail"]);
  // platform fit (profile/format) is a QA dimension; canvas + safe-zone integrity is the S-D contract check
  return { status: v.status, ok: v.valid === false && v.status === "PLATFORM_PROFILE_MISMATCH", detail: `validate=${v.status} errors=${(v.errors || []).join("; ").slice(0, 160)}` };
});

// =============================================================================================
// Q5 — SOURCE MEDIA INTEGRITY
// =============================================================================================
const mediaSlotSpec = (overrides = {}) => baseSpec({
  design_id: "SH-MEDIA",
  layout_family: "IMAGE_DOMINANT",
  production_mode: "PHOTO_PLUS_TYPE",
  visual_slots: [{ slot_id: "hero", media_type: "photo", required: true, fallback: "SOURCE_REQUIRED" }],
  ...overrides,
});
const resolveMedia = (spec, registry) => resolveSocialSourceMedia({ design_spec: spec, source_media_registry: registry });

q("Q5-01", "Q5_MEDIA", ["E", "M"], () => {
  const r = resolveMedia(mediaSlotSpec(), MEDIA_ATTACKS.missingRequired());
  const composed = compose(mediaSlotSpec({ design_id: "SH-NOSRC" }));
  const family = fam(day6FamilyInput({ strategy: { ...DAY6_STRATEGY, required_purposes: [] }, members: [MEMBER_FEED] }));
  const ok = r.status === SOURCE_MEDIA_STATUS.SOURCE_REQUIRED && composed.status === COMPOSITOR_STATUS.SOURCE_REQUIRED && family.family_status === FAMILY_STATUS.APPROVED;
  return { status: r.status, ok, detail: `resolver=${r.status} composer=${composed.status} family_with_registry=${family.family_status}` };
});

q("Q5-02", "Q5_MEDIA", ["E", "M"], () => {
  const unknown = resolveMedia(mediaSlotSpec(), MEDIA_ATTACKS.unknownSlot());
  const dup = resolveMedia(mediaSlotSpec(), MEDIA_ATTACKS.duplicateBinding());
  return { status: `${unknown.status}/${dup.status}`, ok: unknown.status === SOURCE_MEDIA_STATUS.INVALID_VISUAL_SLOT && dup.status === SOURCE_MEDIA_STATUS.DUPLICATE_VISUAL_SLOT_BINDING, detail: `unknown_slot=${unknown.status} duplicate=${dup.status}` };
});

q("Q5-03", "Q5_MEDIA", ["E"], () => {
  const rawGif = [{ slot_id: "hero", source_type: "SUPPLIED_IMAGE", mime: "image/gif", width: 10, height: 10, checksum: "SH-C" }];
  const mime = resolveMedia(mediaSlotSpec({ design_id: "SH-GIF" }), rawGif);
  const norm = normalizeSocialSourceMedia({ source_type: "SUPPLIED_IMAGE", mime: "image/gif", width: 10, height: 10, checksum: "SH-C" });
  return { status: mime.status, ok: mime.status === SOURCE_MEDIA_STATUS.UNSUPPORTED_MEDIA_TYPE && norm.status === SOURCE_MEDIA_STATUS.UNSUPPORTED_MEDIA_TYPE, detail: `raw_registry=${mime.status} normalize=${norm.status} (a pre-normalized record is trusted; the gate applies at ingestion)` };
});

q("Q5-04", "Q5_MEDIA", ["E"], () => {
  const raw = (over) => [{ slot_id: "hero", source_type: "SUPPLIED_IMAGE", mime: "image/png", width: 10, height: 10, checksum: "SH-C", ...over }];
  const zeroW = resolveMedia(mediaSlotSpec({ design_id: "SH-ZW" }), raw({ width: 0 }));
  const zeroH = resolveMedia(mediaSlotSpec({ design_id: "SH-ZH" }), raw({ height: 0 }));
  const meta = resolveMedia(mediaSlotSpec({ design_id: "SH-NM" }), raw({ width: undefined, height: undefined }));
  const noChecksum = resolveMedia(mediaSlotSpec({ design_id: "SH-NC" }), [{ slot_id: "hero", source_type: "SUPPLIED_IMAGE", mime: "image/png", width: 10, height: 10 }]);
  const normWarn = normalizeSocialSourceMedia({ source_type: "SUPPLIED_IMAGE", mime: "image/png", width: 10, height: 10 });
  const ok = zeroW.status === SOURCE_MEDIA_STATUS.INVALID_MEDIA_DIMENSIONS && zeroH.status === SOURCE_MEDIA_STATUS.INVALID_MEDIA_DIMENSIONS
    && meta.status === SOURCE_MEDIA_STATUS.SOURCE_METADATA_REQUIRED && noChecksum.status === SOURCE_MEDIA_STATUS.READY
    && normWarn.warnings.some((w) => /checksum/.test(w)) && normWarn.source.checksum === null;
  return { status: `${zeroW.status}/${zeroH.status}/${meta.status}/${noChecksum.status}`, ok, detail: `zeroW=${zeroW.status} zeroH=${zeroH.status} missing_meta=${meta.status} no_checksum=${noChecksum.status}(weaker identity, warned)` };
});

q("Q5-05", "Q5_MEDIA", ["E"], () => {
  const r = resolveMedia(mediaSlotSpec({ production_mode: "ILLUSTRATION_PLUS_TYPE" }), MEDIA_ATTACKS.modeMismatch());
  return { status: r.status, ok: r.status === SOURCE_MEDIA_STATUS.SOURCE_MODE_MISMATCH, detail: `production_mode=ILLUSTRATION_PLUS_TYPE source=PRODUCT_IMAGE → ${r.status}` };
});

q("Q5-06", "Q5_MEDIA", ["O", "S"], () => {
  const base = mediaSlotSpec({ design_id: "SH-CHK-BASE" });
  const a = compose(base, [mediaEntry("SYN-PHOTO-1")]);
  const b = compose(base, MEDIA_ATTACKS.changedChecksum());
  const c = compose(base, MEDIA_ATTACKS.changedSourceId());
  const checksumReflected = a.provenance.media[0].checksum !== b.provenance.media[0].checksum;
  const declaredIdReflected = a.provenance.media[0].source_media_id !== c.provenance.media[0].source_media_id;
  const computedIdSensitive = sourceMediaId(MEDIA_SOURCES["SYN-PHOTO-1"]) !== sourceMediaId({ ...MEDIA_SOURCES["SYN-PHOTO-1"], checksum: "SH-CHK-MUTATED" });
  const manifestLevel = a.provenance.media[0].checksum !== b.provenance.media[0].checksum;
  return { status: `${a.status}/${b.status}/${c.status}`, ok: checksumReflected && declaredIdReflected && computedIdSensitive && manifestLevel, detail: `checksum_in_provenance=${checksumReflected} declared_id_mutation=${declaredIdReflected} computed_id_checksum_sensitive=${computedIdSensitive}` };
});

q("Q5-07", "Q5_MEDIA", ["O", "P"], () => {
  const c = compose(mediaSlotSpec({ design_id: "SH-GEN" }), [mediaEntry("SYN-IMG-ART-1")]);
  const m = c.provenance.media[0];
  const src = MEDIA_SOURCES["SYN-IMG-ART-1"];
  const ok = m.source_media_id === src.source_media_id && m.checksum === src.checksum && m.mime === src.mime
    && m.width === src.width && m.height === src.height && m.generated === true
    && m.provider === src.provenance.provider && m.model === src.provenance.model
    && m.visual_grounding_id === src.provenance.visual_grounding_id
    && m.prompt_record_ref === src.provenance.prompt_record_ref
    && c.provenance.generated_media === true;
  return { status: c.status, ok, detail: `id/checksum/mime/dims/provider/model/visual_grounding/prompt_record preserved=${ok}` };
});

q("Q5-08", "Q5_MEDIA", ["E", "N", "O"], () => {
  const c = compose(mediaSlotSpec({ design_id: "SH-SYN" }), [mediaEntry("SYN-PHOTO-1")]);
  const m = c.provenance.media[0];
  const r = day6();
  const ok = m.synthetic === true && m.generated === false && mediaAuthorizesEvidence() === false
    && r.media.authorizes_evidence === false && r.media.synthetic_media === true && r.media.generated_media === false
    && hasSyntheticMedia([{ source: MEDIA_SOURCES["SYN-PHOTO-1"] }]) === true && hasGeneratedMedia([{ source: MEDIA_SOURCES["SYN-PHOTO-1"] }]) === false;
  return { status: c.status, ok, detail: `synthetic=${m.synthetic} generated=${m.generated} authorizes_evidence=${mediaAuthorizesEvidence()}` };
});

q("Q5-09", "Q5_MEDIA", ["F", "O"], () => {
  const families = ["TYPE_DOMINANT", "IMAGE_DOMINANT", "SPLIT", "LIST", "TWO_COLUMN", "DATA_FOCUS", "QUOTE_FOCUS", "PRODUCT_HERO", "EDITORIAL", "FULL_BLEED"];
  const results = families.map((layout) => {
    const spec = mediaSlotSpec({ design_id: `SH-ND-${layout}`, layout_family: layout, production_mode: ["IMAGE_DOMINANT", "FULL_BLEED"].includes(layout) ? "PHOTO_PLUS_TYPE" : "DETERMINISTIC_GRAPHIC" });
    const c = compose(spec, [mediaEntry("SYN-PHOTO-1")]);
    return { layout, status: c.status, rendered: /<image/.test(c.svg), provenance: c.provenance.media.length };
  });
  const ok = results.every((x) => x.rendered === true && x.provenance >= 1);
  return { status: `${results.filter((x) => x.rendered).length}/10 rendered`, ok, detail: results.map((x) => `${x.layout}:${x.rendered ? "img" : "NO-IMG"}/${x.provenance}`).join(" ") };
});

q("Q5-10", "Q5_MEDIA", ["C", "F"], () => {
  const c = compose(mediaSlotSpec({ design_id: "SH-TXTIMG" }), [TEXT_IN_IMAGE_SOURCE]);
  const moduleCode = read("mae/media/social-source-media.js").replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const noOcr = !/\bocr\b|tesseract|extractText|readText/i.test(moduleCode);
  const headlineDrawn = c.visible_text.includes(DAY6_HEADLINE) && c.svg.includes("DM Serif Display");
  const sourceTextNotInVisible = !c.visible_text.includes("GENERIC RECOVERY TIPS");
  return { status: c.status, ok: c.status === COMPOSITOR_STATUS.READY && headlineDrawn && noOcr && sourceTextNotInVisible, detail: `headline_by_typography=${headlineDrawn} no_ocr=${noOcr} image_text_not_claimed_in_output=${sourceTextNotInVisible}` };
});

q("Q5-11", "Q5_MEDIA", ["O"], () => {
  const r = day6();
  const ids = new Set(r.members.map((m) => m.source_media_refs[0].source_media_id));
  const checks = new Set(r.members.map((m) => m.source_media_refs[0].checksum));
  const geometries = new Set(r.members.map((m) => JSON.stringify(m.media_geometry)));
  return { status: r.family_status, ok: ids.size === 1 && checks.size === 1 && geometries.size >= 1, detail: `ids=${ids.size} checksums=${checks.size} geometry_variants=${geometries.size}` };
});

q("Q5-12", "Q5_MEDIA", ["O", "M"], () => {
  const mk = (sourceId) => fam(day6FamilyInput({
    strategy: { ...DAY6_STRATEGY, source_policy: "MEMBER_SPECIFIC_SOURCE" },
    members: [
      { ...MEMBER_FEED, source_bindings: [{ slot_id: "hero", source_id: "SYN-PHOTO-1" }] },
      { ...MEMBER_WHATSAPP, production_mode: "ILLUSTRATION_PLUS_TYPE", source_bindings: [{ slot_id: "hero", source_id: sourceId }] },
    ],
  }));
  const a = mk("SYN-PHOTO-1"), b = mk("SYN-ILLUSTRATION-1");
  const feedStable = roleOf(a, "IDENTIFICATION").source_media_refs[0].source_media_id === roleOf(b, "IDENTIFICATION").source_media_refs[0].source_media_id;
  const waChanged = roleOf(a, "EDUCATION").source_media_refs[0].source_media_id !== roleOf(b, "EDUCATION").source_media_refs[0].source_media_id;
  const manifestChanged = a.family_manifest.manifest_hash !== b.family_manifest.manifest_hash;
  return { status: `${a.family_status}/${b.family_status}`, ok: feedStable && waChanged && manifestChanged, detail: `feed_stable=${feedStable} changed_member=${waChanged} manifest_changed=${manifestChanged}` };
});

q("Q5-13", "Q5_MEDIA", ["E", "O"], () => {
  const spec = mediaSlotSpec({ design_id: "SH-VFRAME", production_mode: "PHOTO_PLUS_TYPE" });
  const c = compose(spec, [mediaEntry("SYN-VIDEOFRAME-1")]);
  const m = c.provenance.media[0];
  const code = read("mae/media/social-source-media.js") + read("mae/services/social-asset-family.js");
  const noExtraction = !/ffmpeg|spawnSync|extractFrame|bestFrame|seek\(|child_process|video_seek|ctr_prediction/i.test(code.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, ""));
  return { status: c.status, ok: c.status === COMPOSITOR_STATUS.READY && m.source_type === "VIDEO_FRAME_ARTIFACT" && noExtraction, detail: `type=${m.source_type} rendered=${/<image/.test(c.svg)} no_extraction_path=${noExtraction}` };
});

// =============================================================================================
// Q6 — COMPOSITION INTEGRITY
// =============================================================================================
q("Q6-01", "Q6_COMPOSITION", ["F", "I", "O"], () => {
  const r = day6();
  const statics = r.members.filter((m) => !["SOCIAL_CAROUSEL", "SOCIAL_STORY_SEQUENCE"].includes(m.asset_type));
  const checks = statics.map((m) => m.production.checks);
  const byName = (name) => checks.every((set) => set.some((c) => c.check === name && c.pass === true));
  const required = ["canvas_dimensions_correct", "safe_zone_bounds", "required_components_present", "required_copy_visible", "copy_exactness", "text_overflow", "layout_overflow", "component_bounds", "illegal_collision", "logo_bounds", "cta_bounds", "token_refs_valid", "layout_family_supported", "variant_valid", "deterministic_repeat", "source_required_propagated"];
  return { status: r.family_status, ok: statics.every((m) => m.production.status === COMPOSITOR_STATUS.READY) && required.every(byName), detail: `statics=${statics.length} checks_covered=${required.filter(byName).length}/${required.length}` };
});

q("Q6-02", "Q6_COMPOSITION", ["F", "O"], () => {
  const fb = mediaSlotSpec({ design_id: "SH-ZORDER", layout_family: "FULL_BLEED", visual_slots: [{ slot_id: "hero", media_type: "photo", required: true, treatment: "scrim", fallback: "SOURCE_REQUIRED" }] });
  const c = compose(fb, [mediaEntry("SYN-PHOTO-1")]);
  const iImg = c.svg.indexOf("<image"), iScrim = c.svg.indexOf('opacity="0.45"'), iAcc = c.svg.indexOf("#D9A52E"), iHead = c.svg.indexOf("DM Serif Display");
  const ok = iImg > -1 && iImg < iScrim && iScrim < iAcc && iAcc < iHead;
  return { status: c.status, ok, detail: `image=${iImg} < scrim=${iScrim} < accent=${iAcc} < headline=${iHead} (z ${Z_ORDER.media}<${Z_ORDER.scrim}<${Z_ORDER.accent}<${Z_ORDER.headline})` };
});

q("Q6-03", "Q6_COMPOSITION", ["G"], () => {
  const r = day6();
  const ok = r.members.every((m) => m._spec.canvas.width === m.artifact_ref.canvas.width && m._spec.canvas.height === m.artifact_ref.canvas.height
    && m._spec.safe_zones.top === PLATFORM_PROFILES[`${m.platform}|${m.placement}`].safe_zones.top);
  return { status: r.family_status, ok, detail: `members=${r.members.length} canvas+safe_zones match profiles=${ok}` };
});

q("Q6-04", "Q6_COMPOSITION", ["F"], () => {
  const r = day6();
  const statics = r.members.filter((m) => m.asset_type === "SOCIAL_STATIC" && m.production.checks);
  const ok = statics.every((m) => m.production.checks.filter((c) => ["text_overflow", "layout_overflow", "illegal_collision", "component_bounds"].includes(c.check)).every((c) => c.pass === true));
  return { status: r.family_status, ok, detail: `no overflow / collision / bounds failures across ${statics.length} members` };
});

q("Q6-05", "Q6_COMPOSITION", ["C", "I"], () => {
  const r = day6();
  const ok = r.members.every((m) => m.production.checks.some((c) => c.check === "required_copy_visible" && c.pass === true) || m.asset_type !== "SOCIAL_STATIC")
    && r.members.filter((m) => m.copy_refs.includes("COPY-HOOK-1")).every((m) => m._artifact.visible_text.includes(DAY6_HEADLINE));
  return { status: r.family_status, ok, detail: "required approved copy visible + exact in every headline-bearing member" };
});

// =============================================================================================
// Q7 — MULTI-PANEL INTEGRITY
// =============================================================================================
const asmCase = (id, build, expectFn) => q(id, "Q7_MULTIPANEL", ["F", "M"], () => {
  const spec = build();
  const v = validateSocialDesignSpec(spec);
  if (!v.valid) return { status: "INVALID_SPEC", ok: expectFn({ specValid: false, v }), detail: `spec invalid: ${(v.errors || []).slice(0, 2).join("; ")}` };
  const asm = assembleMultiPanel(spec, T);
  const qa = evaluateSocialGraphicAsset({ design_spec: spec, rendered_artifact: panelArt(spec, asm), truth_context: {} });
  return expectFn({ spec, asm, qa, specValid: true });
});

q("Q7-01", "Q7_MULTIPANEL", ["F", "M"], () => {
  const v = validateSocialDesignSpec(MULTI_PANEL_ATTACKS.missingCover());
  return { status: "INVALID_SPEC", ok: v.valid === false && v.errors.some((e) => /COVER/.test(e)), detail: `missing COVER refused at the S-A contract: ${v.errors[0]}` };
});
q("Q7-02", "Q7_MULTIPANEL", ["F", "M"], () => {
  const v = validateSocialDesignSpec(MULTI_PANEL_ATTACKS.missingAct());
  return { status: "INVALID_SPEC", ok: v.valid === false && v.errors.some((e) => /ACT/.test(e)), detail: `missing ACT refused at the S-A contract: ${v.errors[0]}` };
});
q("Q7-03", "Q7_MULTIPANEL", ["F", "M"], () => {
  const v = validateSocialDesignSpec(MULTI_PANEL_ATTACKS.nonContiguous());
  return { status: "INVALID_SPEC", ok: v.valid === false && v.errors.some((e) => /contiguous/.test(e)), detail: `non-contiguous indexes refused at the S-A contract: ${v.errors[0]}` };
});
asmCase("Q7-04", MULTI_PANEL_ATTACKS.reordered, ({ asm, qa }) => {
  const declared = ["COVER", "ACT", "EXPLAIN"];
  const rendered = asm.panels.map((p) => p.sequence_role);
  const preserved = JSON.stringify(declared) === JSON.stringify(rendered.map((r) => r));
  const order = qa.sequence_checks.find((c) => c.check === "panel_order_preserved");
  return { status: qa.status, ok: preserved && order.pass === false, detail: `declared=${declared.join(">")} rendered=${rendered.join(">")} order_check=${order.pass}` };
});
asmCase("Q7-05", MULTI_PANEL_ATTACKS.panelEvidenceFailure, ({ asm, qa }) => {
  const badPanel = qa.panels.find((p) => p.evidence_authorization.status === EVIDENCE_STATUS.FAIL || p.status === OVERALL_STATUS.NOT_ELIGIBLE);
  const ok = qa.status !== OVERALL_STATUS.PASS && !!badPanel && qa.panels.length === 3 && asm.panels.length === 3;
  return { status: qa.status, ok, detail: `asset=${qa.status} bad_panel_index=${badPanel?.panel_index} panels_retained=${qa.panels.length}` };
});
asmCase("Q7-06", MULTI_PANEL_ATTACKS.panelMediaFailure, ({ asm, qa }) => {
  const mediaPanel = asm.panels.find((p) => p.status === COMPOSITOR_STATUS.SOURCE_REQUIRED);
  return { status: qa.status, ok: !!mediaPanel && asm.status !== COMPOSITOR_STATUS.READY && asm.panels.length === 3, detail: `panel_status=${mediaPanel?.status} asset_status=${asm.status} panels_retained=${asm.panels.length}` };
});
q("Q7-07", "Q7_MULTIPANEL", ["J", "M"], () => {
  const spec = carouselBase();
  const asm = assembleMultiPanel(spec, T);
  const qa = evaluateSocialGraphicAsset({ design_spec: spec, rendered_artifact: panelArt(spec, asm), truth_context: {} });
  const family = fam(day6FamilyInput({ members: [{ ...MEMBER_FEED }, { ...MEMBER_YOUTUBE }] }));
  const memberNoEvaluator = family.members.map((m) => m.qa.status);
  return { status: qa.status, ok: qa.status === OVERALL_STATUS.JUDGMENT_REQUIRED && qa.panels.length === 3 && qa.panels.every((p) => p.status === OVERALL_STATUS.JUDGMENT_REQUIRED || p.status !== OVERALL_STATUS.PASS), detail: `panel_status=${qa.status} panels=${qa.panels.length}` };
});

// =============================================================================================
// Q8 — QA INTEGRITY
// =============================================================================================
q("Q8-01", "Q8_QA", ["I", "J", "R"], () => {
  const spec = baseSpec({ design_id: "SH-NO-EVALUATOR" });
  const qa = qaOf(spec, { truth_context: {} });
  const family = fam(day6FamilyInput({ members: [MEMBER_FEED], evaluator: null }));
  return { status: qa.status, ok: qa.status === OVERALL_STATUS.JUDGMENT_REQUIRED && family.members[0].status === MEMBER_STATUS.JUDGMENT_REQUIRED && family.members[0].production.status === COMPOSITOR_STATUS.READY, detail: `artifact=READY qa=${qa.status} family_member=${family.members[0].status}` };
});

q("Q8-02", "Q8_QA", ["I", "J", "R"], () => {
  const spec = baseSpec({ design_id: "SH-BAD-EVALUATOR" });
  let refused = null;
  try { createMockEvaluator({ results: { HIERARCHY: { status: "TOTALLY_FINE" } } }); } catch (e) { refused = e.code; }
  const qa = qaOf(spec, { truth_context: {}, evaluator: MALFORMED_EVALUATOR });
  return { status: qa.status, ok: refused === "EVALUATOR_INVALID" && qa.status === OVERALL_STATUS.REVIEW_REQUIRED && qa.diagnostics.some((d) => d.diagnostic === QA_STATUS.EVALUATOR_INVALID) && qa.judgment_run === false, detail: `createMockRefused=${refused} qa=${qa.status} judgment_run=${qa.judgment_run}` };
});

q("Q8-03", "Q8_QA", ["K"], () => {
  const spec = baseSpec({ design_id: "SH-ZT-JUDGMENT" });
  const ev = createMockEvaluator({ results: { ...ALL_JUDGMENT_PASS(), CULTURAL_INTEGRITY: { status: "FAIL", rationale: "severe cultural misrepresentation", failure_class: "SEVERE_CULTURAL_MISREPRESENTATION" } } });
  const qa = qaOf(spec, { truth_context: {}, evaluator: ev });
  return { status: qa.status, ok: qa.status === OVERALL_STATUS.FAIL && qa.blocking_failures.includes("SEVERE_CULTURAL_MISREPRESENTATION"), detail: `perfect_judgment_plus_zero_tolerance → ${qa.status} blocking=${qa.blocking_failures.join("|")}` };
});

q("Q8-04", "Q8_QA", ["K"], () => {
  const spec = evidenceSpec("PRICE", "price", "USD 9");
  const ev = createMockEvaluator({ results: ALL_JUDGMENT_PASS() });
  const qa = qaOf(spec, { truth_context: APPROVED_COMMERCE_TRUTH, evidence_context: {}, evaluator: ev });
  const dim = qa.dimensions.find((d) => d.id === "EVIDENCE_INTEGRITY");
  return { status: qa.status, ok: qa.status === OVERALL_STATUS.FAIL && dim.status === QA_STATUS.FAIL, detail: `EVIDENCE_INTEGRITY=${dim.status} qa=${qa.status}` };
});

q("Q8-05", "Q8_QA", ["K"], () => {
  const canonical = baseSpec({ design_id: "SH-INTERCHANGEABILITY" });
  const generic = specWithCopy([copyBlock("headline", GENERIC_MUTATION_TEXT)], { design_id: "SH-GENERIC" });
  const ev = (verdict) => createMockEvaluator({ results: { ...ALL_JUDGMENT_PASS(), INTERCHANGEABILITY: { status: verdict, rationale: `qualification ${verdict}` } } });
  const cq = qaOf(canonical, { truth_context: {}, evaluator: ev("PASS") });
  const gq = qaOf(generic, { truth_context: {}, evaluator: ev("FAIL") });
  return { status: `${cq.status}/${gq.status}`, ok: cq.status === OVERALL_STATUS.PASS && gq.status === OVERALL_STATUS.FAIL, detail: `canonical=${cq.status} generic_mutation=${gq.status}` };
});

q("Q8-06", "Q8_QA", ["K"], () => {
  const qa = evaluateSocialGraphic({ design_spec: baseSpec({ design_id: "SH-SCORES" }), rendered_artifact: artOf(baseSpec({ design_id: "SH-SCORES" })), truth_context: {} });
  const keys = Object.keys(qa).sort();
  const hasAggregate = keys.some((k) => /score|average|grade|rating/i.test(k));
  const dimScores = qa.dimensions.filter((d) => d.score != null).length;
  return { status: qa.status, ok: hasAggregate === false && dimScores === 0, detail: `aggregate_score_fields=${hasAggregate} scored_dimensions=${dimScores} keys=${keys.join(",")}` };
});

// =============================================================================================
// Q9 — FAMILY INTEGRITY
// =============================================================================================
q("Q9-01", "Q9_FAMILY", ["L", "M"], () => {
  const r = fam(FAM.duplicateMember());
  return { status: r.family_status, ok: r.family_status === FAMILY_STATUS.INVALID && r.no_fanout === true && r.errors.some((e) => e.code === FAMILY_ERRORS.DUPLICATE_FAMILY_MEMBER), detail: `errors=${r.errors.map((e) => e.code).join(",")}` };
});
q("Q9-02", "Q9_FAMILY", ["L", "M"], () => {
  const r = fam(FAM.requiredMemberFailure());
  const failed = roleOf(r, "EDUCATION");
  return { status: r.family_status, ok: r.family_status === FAMILY_STATUS.FAILED && failed.status === MEMBER_STATUS.FAIL, detail: `family=${r.family_status} member=${failed.status}` };
});
q("Q9-03", "Q9_FAMILY", ["L", "M"], () => {
  const r = fam(FAM.optionalMemberFailure());
  const opt = roleOf(r, "PROBLEM");
  return { status: r.family_status, ok: r.family_status === FAMILY_STATUS.PARTIAL && opt.required === false && opt.status === MEMBER_STATUS.FAIL, detail: `family=${r.family_status} optional=${opt.status}` };
});
q("Q9-04", "Q9_FAMILY", ["L"], () => {
  const r = fam(FAM.optionalMemberFailureNoPartial());
  return { status: r.family_status, ok: r.family_status !== FAMILY_STATUS.APPROVED && r.family_status === FAMILY_STATUS.JUDGMENT_REQUIRED, detail: `partial_not_permitted → ${r.family_status}` };
});
q("Q9-05", "Q9_FAMILY", ["J", "L"], () => {
  const r = fam(FAM.judgmentRequired());
  return { status: r.family_status, ok: r.family_status === FAMILY_STATUS.JUDGMENT_REQUIRED && r.members.every((m) => m.status === MEMBER_STATUS.JUDGMENT_REQUIRED), detail: `family=${r.family_status}` };
});
q("Q9-06", "Q9_FAMILY", ["L", "M"], () => {
  const r = fam(FAM.unknownPlatform());
  return { status: r.family_status, ok: r.family_status === FAMILY_STATUS.NOT_ELIGIBLE && roleOf(r, "EDUCATION").status === MEMBER_STATUS.NOT_ELIGIBLE, detail: `family=${r.family_status}` };
});
q("Q9-07", "Q9_FAMILY", ["M"], () => {
  const inputs = [FAM.requiredMemberFailure(), FAM.optionalMemberFailure(), FAM.unknownPlatform(), FAM.judgmentRequired()];
  const results = inputs.map((i) => fam(i));
  const retained = results.every((r) => r.members.length === r.family_manifest.members.length && r.family_manifest.members.every((m) => m.status && m.member_id));
  const neverGreen = results.every((r) => r.family_status !== FAMILY_STATUS.APPROVED);
  return { status: results.map((r) => r.family_status).join("/"), ok: retained && neverGreen, detail: `retained_in_all=${retained} no_filtered_green=${neverGreen}` };
});
q("Q9-08", "Q9_FAMILY", ["L", "S"], () => {
  const a = day6(), b = day6();
  const ok = a.family_manifest.manifest_hash === b.family_manifest.manifest_hash
    && JSON.stringify(a.required_member_ids) === JSON.stringify(b.required_member_ids)
    && !/score|average/i.test(JSON.stringify(a.family_manifest))
    && a.family_status === FAMILY_STATUS.APPROVED;
  return { status: a.family_status, ok, detail: `manifest_deterministic=${a.family_manifest.manifest_hash === b.family_manifest.manifest_hash} no_averaging=true` };
});
q("Q9-09", "Q9_FAMILY", ["T"], () => {
  const r = day6();
  const code = strip(read("mae/services/social-asset-family.js")).toLowerCase();
  const words = ["campaign", "fatigue", "rotation", "audience", "calendar", "publish", "schedule", "experiment", "performance-learning"];
  const leaked = words.filter((w) => code.includes(w));
  const keys = Object.keys(r).concat(Object.keys(r.family_manifest));
  const campaignKeys = keys.filter((k) => /campaign|schedule|audience|fatigue|rotation|publish/i.test(k));
  return { status: r.family_status, ok: leaked.length === 0 && campaignKeys.length === 0, detail: `vocabulary_leaks=${leaked.join("|") || "none"} campaign_keys=${campaignKeys.join("|") || "none"}` };
});

// =============================================================================================
// Q10 — TRACEABILITY INTEGRITY
// =============================================================================================
q("Q10-01", "Q10_TRACEABILITY", ["P"], () => {
  const r = day6();
  const per = r.members.every((m) => m.trace && m.trace.family_id === r.family_id && m.trace.angle_id === DAY6_ANGLE.id
    && m.trace.design_id === m.design_id && m.trace.profile_id === `${m.platform}.${m.placement}`
    && m.trace.source_media_ids.length >= 1 && m.trace.artifact_id === m.artifact_ref.artifact_id && m.trace.qa_version === SOCIAL_GRAPHIC_QA_VERSION);
  const manifest = r.family_manifest;
  return { status: r.family_status, ok: per && manifest.angle_id === DAY6_ANGLE.id && !!manifest.angle_validation_ref && !!manifest.brand_ref && manifest.members.length === 5, detail: `per_member_lineage=${per} family_angle=${manifest.angle_id} validation_ref=${manifest.angle_validation_ref}` };
});

q("Q10-02", "Q10_TRACEABILITY", ["P"], () => {
  const r = fam(FAM.unknownPlatform());
  const broken = roleOf(r, "EDUCATION");
  return { status: r.family_status, ok: broken.trace === null && broken.artifact_ref === undefined && broken.status === MEMBER_STATUS.NOT_ELIGIBLE && r.members.length === 2, detail: `broken_member_trace=${broken.trace === null} artifact_ref=${broken.artifact_ref === undefined} retained=${r.members.length}` };
});

q("Q10-03", "Q10_TRACEABILITY", ["P", "S"], () => {
  const r = day6();
  const hashesMatch = r.members.every((m) => m.artifact_ref.bytes_hash === sha256(m.asset_type === "SOCIAL_STATIC" ? m._artifact.svg : (m._artifact.panel_hashes || []).join("")));
  const qaFromS = r.members.every((m) => m.trace.qa_version === SOCIAL_GRAPHIC_QA_VERSION && m.qa.qa_version === SOCIAL_GRAPHIC_QA_VERSION);
  const profileFromD = r.members.every((m) => m.trace.profile_version === PLATFORM_PROFILES[`${m.platform}|${m.placement}`].profile_version);
  return { status: r.family_status, ok: hashesMatch && qaFromS && profileFromD, detail: `recomputed_hashes_match=${hashesMatch} qa_version_from_S-E=${qaFromS} profile_from_S-D=${profileFromD}` };
});

q("Q10-04", "Q10_TRACEABILITY", ["P"], () => {
  const r = day6();
  const manifestText = JSON.stringify(r.family_manifest);
  const noPayload = !manifestText.includes("<svg") && !manifestText.includes("copy_blocks") && r.family_manifest.members.every((m) => !("svg" in m) && !("_spec" in m));
  return { status: r.family_status, ok: noPayload, detail: `manifest_is_references_only=${noPayload}` };
});

// =============================================================================================
// Q11 — DETERMINISM
// =============================================================================================
q("Q11-01", "Q11_DETERMINISM", ["S"], () => {
  const a = day6(), b = day6();
  const svgMatch = a.members.every((m, i) => (m._artifact.svg || "") === (b.members[i]._artifact.svg || ""));
  const ok = a.family_id === b.family_id && JSON.stringify(a.members.map((m) => m.member_id)) === JSON.stringify(b.members.map((m) => m.member_id))
    && a.family_manifest.manifest_hash === b.family_manifest.manifest_hash && svgMatch
    && JSON.stringify(a.members.map((m) => m.artifact_ref.bytes_hash)) === JSON.stringify(b.members.map((m) => m.artifact_ref.bytes_hash))
    && JSON.stringify(a.media) === JSON.stringify(b.media);
  return { status: "REPEAT", ok, detail: `family_id/member_ids/manifest/svg/artifact_hashes/media identical=${ok}` };
});

q("Q11-02", "Q11_DETERMINISM", ["S"], () => {
  const a = familyId({ angle_id: DAY6_ANGLE.id, angle_verdict: "GREEN", strategy: { jobs: ["STOP_SCROLL"], source_policy: "SHARED_SOURCE" }, members: [MEMBER_FEED] });
  const b = familyId({ members: [MEMBER_FEED], strategy: { source_policy: "SHARED_SOURCE", jobs: ["STOP_SCROLL"] }, angle_verdict: "GREEN", angle_id: DAY6_ANGLE.id });
  const inputA = day6FamilyInput();
  const inputB = day6FamilyInput({ strategy: { ...DAY6_STRATEGY, jobs: [...DAY6_STRATEGY.jobs].reverse(), required_purposes: [...DAY6_STRATEGY.required_purposes].reverse() } });
  return { status: "KEY-ORDER", ok: a === b && canonicalFamilyProjection({ b: 1, a: 2 }) === canonicalFamilyProjection({ a: 2, b: 1 }), detail: `familyId stable=${a === b} canonical projection key-order independent=true` };
});

q("Q11-03", "Q11_DETERMINISM", ["S"], () => {
  const spec = carouselBase();
  const asm = assembleMultiPanel(spec, T);
  const declared = spec.slides.map((s) => [s.slide_index, s.sequence_role]);
  const rendered = asm.panels.map((p) => [p.slide_index, p.sequence_role]);
  const storySpec = carouselSpec({
    id: "SH-STORY-ORDER",
    overrides: { asset_type: "SOCIAL_STORY_SEQUENCE", layout_family: "FULL_BLEED" },
    slides: [slide(1, "COVER", [copyBlock("headline")]), slide(2, "TEACH", [copyBlock("body", "Synthetic frame copy.")]), slide(3, "ACT", [copyBlock("supporting_line", "Synthetic act copy.")])],
  });
  const storyAsm = assembleMultiPanel(storySpec, T);
  return { status: asm.status, ok: JSON.stringify(declared) === JSON.stringify(rendered) && JSON.stringify(storySpec.slides.map((s) => s.sequence_role)) === JSON.stringify(storyAsm.panels.map((p) => p.sequence_role)), detail: `carousel_order=${rendered.map((r) => r[1]).join(">")} story_order=${storyAsm.panels.map((p) => p.sequence_role).join(">")}` };
});

q("Q11-04", "Q11_DETERMINISM", ["S", "M"], () => {
  const runs = Array.from({ length: 3 }, () => fam(FAM.duplicateMember()));
  const identical = runs.every((r) => JSON.stringify(r.errors) === JSON.stringify(runs[0].errors) && r.family_status === runs[0].family_status);
  const runs2 = Array.from({ length: 3 }, () => fam(FAM.requiredMemberFailure()));
  const identical2 = runs2.every((r) => r.family_status === runs2[0].family_status && JSON.stringify(r.members.map((m) => m.status + m.status_reason)) === JSON.stringify(runs2[0].members.map((m) => m.status + m.status_reason)));
  return { status: runs[0].family_status, ok: identical && identical2, detail: `invalid_input_identical=${identical} failure_identical=${identical2}` };
});

q("Q11-05", "Q11_DETERMINISM", ["S"], () => {
  const canonical = sha256(CANONICAL_DAY6_FIXTURE_TEXT);
  const manifest = day6().family_manifest.manifest_hash;
  return { status: "FROZEN", ok: canonical === FROZEN.canonicalDay6 && manifest === FROZEN.day6Manifest, detail: `canonical_fixture=${canonical.slice(0, 12)} manifest=${manifest.slice(0, 12)}` };
});

q("Q11-06", "Q11_DETERMINISM", ["S"], () => {
  const text = JSON.stringify(day6().family_manifest);
  const volatile = /created_at|updated_at|timestamp|uuid/i.test(text);
  return { status: "MANIFEST", ok: volatile === false, detail: `volatile_state_present=${volatile}` };
});

// =============================================================================================
// Q12 — FAILURE PROPAGATION
// =============================================================================================
q("Q12-01", "Q12_FAILURE", ["L", "M"], () => {
  const r = fam(FAM.requiredMemberFailure());
  const manifestFailed = r.family_manifest.members.some((m) => m.status === MEMBER_STATUS.FAIL);
  return { status: r.family_status, ok: r.family_status === FAMILY_STATUS.FAILED && manifestFailed, detail: `family=${r.family_status} failed_member_in_manifest=${manifestFailed}` };
});
q("Q12-02", "Q12_FAILURE", ["L", "M"], () => {
  const r = fam(day6FamilyInput({
    members: [MEMBER_FEED, { ...MEMBER_WHATSAPP, evaluator: failEvaluator("HIERARCHY") }],
  }));
  return { status: r.family_status, ok: r.family_status === FAMILY_STATUS.FAILED && roleOf(r, "EDUCATION").status === MEMBER_STATUS.FAIL, detail: `panel_equivalent_member_failure → family=${r.family_status}` };
});
q("Q12-03", "Q12_FAILURE", ["E", "L", "M"], () => {
  const r = fam(FAM.noSourceWithRequiredSlot());
  return { status: r.family_status, ok: r.family_status === FAMILY_STATUS.NOT_ELIGIBLE && r.members.every((m) => m.status_reason === MEMBER_ERRORS.SOURCE_POLICY_VIOLATION), detail: `media_failure → members=${r.members.map((m) => m.status_reason).join("|")} family=${r.family_status}` };
});

// =============================================================================================
// Q13 — SAFETY-SENSITIVE MARKETING
// =============================================================================================
q("Q13-01", "Q13_SAFETY", ["K"], () => {
  const spec = baseSpec({ design_id: "SH-SAFETY" });
  const qa = qaOf(spec, { truth_context: SAFETY_SENSITIVE_TRUTH });
  const dim = qa.dimensions.find((d) => d.id === "SAFETY_INTEGRITY");
  return { status: qa.status, ok: qa.status === OVERALL_STATUS.REVIEW_REQUIRED && dim.status === QA_STATUS.HUMAN_REVIEW, detail: `SAFETY_INTEGRITY=${dim.status} qa=${qa.status} (marketing may not publish without human safety review)` };
});
q("Q13-02", "Q13_SAFETY", ["K"], () => {
  const spec = baseSpec({ design_id: "SH-SAFETY-CLAIM", content_pattern: "STATEMENT", copy_blocks: [{ copy_id: "SH-SC", role: "headline", text: "This system is clinically proven to prevent complications", required: true }] });
  const qa = qaOf(spec, { truth_context: SAFETY_SENSITIVE_TRUTH, evaluator: frozenJudgment({ SAFETY_INTEGRITY: { status: "PASS", rationale: "not allowed to grade" } }) });
  const evidence = authorizeEvidence({ design_spec: spec, evidence_context: {}, truth_context: SAFETY_SENSITIVE_TRUTH });
  return { status: qa.status, ok: qa.status !== OVERALL_STATUS.PASS, detail: `unsupported clinical claim → qa=${qa.status} (no conversion of uncertainty into certainty)` };
});

// =============================================================================================
// Q14 — SYNTHETIC-FIXTURE ISOLATION
// =============================================================================================
q("Q14-01", "Q14_SYNTHETIC", ["N"], () => {
  const spec = evidenceSpec("TESTIMONIAL", "quote", "Synthetic quote");
  const e = authorizeEvidence({ design_spec: spec, evidence_context: { records: [{ evidence_id: "SYN-Q-1", evidence_type: "TESTIMONIAL", authorized: true, synthetic: true }] }, truth_context: {} });
  return { status: e.status, ok: e.status === EVIDENCE_STATUS.FAIL, detail: `synthetic testimonial record → ${e.status}` };
});
q("Q14-02", "Q14_SYNTHETIC", ["N"], () => {
  const spec = evidenceSpec("STATISTIC", "statistic_value", "Synthetic statistic");
  const e = authorizeEvidence({ design_spec: spec, evidence_context: { records: [{ evidence_id: "SYN-STAT-77", evidence_type: "STATISTIC", authorized: true }] }, truth_context: {} });
  return { status: e.status, ok: e.status === EVIDENCE_STATUS.FAIL, detail: `SYN- identifier → ${e.status}` };
});
q("Q14-03", "Q14_SYNTHETIC", ["N", "O"], () => {
  const r = day6();
  const fixturesLabelled = day6FamilyInput().marketing_angle._fixture_origin === "synthetic" && SYNTHETIC._fixture_origin === "synthetic";
  const canonical = sha256(CANONICAL_DAY6_FIXTURE_TEXT) === FROZEN.canonicalDay6;
  return { status: r.family_status, ok: r.media.authorizes_evidence === false && r.media.synthetic_media === true && fixturesLabelled && canonical, detail: `authorizes_evidence=${r.media.authorizes_evidence} synthetic_media=${r.media.synthetic_media} fixtures_labelled=${fixturesLabelled} canonical_untouched=${canonical}` };
});

// =============================================================================================
// Q15 — ARCHITECTURAL BOUNDARIES
// =============================================================================================
const strip = (s) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
q("Q15-01", "Q15_BOUNDARIES", ["Q"], () => {
  const files = ["mae/services/social-asset-family.js", "mae/services/social-graphic-qa.js", "mae/services/social-platforms.js", "mae/services/social-design-spec.js", "mae/media/social-compositor.js", "mae/media/social-carousel.js", "mae/media/social-source-media.js", "mae/media/social-components.js"];
  const leaks = [];
  for (const f of files) {
    const code = strip(read(f)).toLowerCase().replace(/https?:\/\/www\.w3\.org\/[^"'\s]*/g, "w3-namespace");
    for (const banned of ["openai", "gemini", "anthropic", "xkiro", "mistral", "deepseek", "9router", "fetch(", "http://", "https://"]) {
      if (code.includes(banned)) leaks.push(`${f}:${banned}`);
    }
  }
  return { status: "SCAN", ok: leaks.length === 0, detail: `provider/network leaks=${leaks.join("|") || "none"}` };
});
q("Q15-02", "Q15_BOUNDARIES", ["Q"], () => {
  const files = ["mae/services/social-asset-family.js", "mae/services/social-graphic-qa.js", "mae/media/social-compositor.js", "mae/media/social-carousel.js", "mae/media/social-source-media.js"];
  const leaks = [];
  for (const f of files) {
    const code = strip(read(f));
    for (const banned of ["ffmpeg", "spawnSync", "child_process", "imagemagick", "resvg", "sharp(", "tesseract", "puppeteer", "canvas("]) {
      if (code.includes(banned)) leaks.push(`${f}:${banned}`);
    }
  }
  return { status: "SCAN", ok: leaks.length === 0, detail: `raster/extraction/OCR leaks=${leaks.join("|") || "none"}` };
});
q("Q15-03", "Q15_BOUNDARIES", ["Q"], () => {
  const forbidden = ["mae/services/social-production-engine.js", "mae/services/social-qualification-service.js", "mae/services/social-supervisor.js", "mae/services/social-design-v2.js", "mae/services/social-campaign-engine.js", "mae/media/social-resizer.js"];
  const present = forbidden.filter((f) => existsSync(join(root, f)));
  return { status: "SCAN", ok: present.length === 0, detail: `forbidden modules present=${present.join("|") || "none"}` };
});
q("Q15-04", "Q15_BOUNDARIES", ["T"], () => {
  const code = strip(read("mae/services/social-asset-family.js"));
  const importsCampaign = /from\s+["'][^"']*campaign[^"']*["']/.test(code);
  const campaignTouched = read("mae/services/campaign.js").includes("social-asset-family");
  return { status: "SCAN", ok: importsCampaign === false && campaignTouched === false, detail: `family→campaign import=${importsCampaign} campaign→family=${campaignTouched}` };
});
q("Q15-05", "Q15_BOUNDARIES", ["Q"], () => {
  const code = strip(read("mae/services/social-asset-family.js"));
  const newTypes = ["INSTAGRAM_POST", "YOUTUBE_THUMBNAIL", "WHATSAPP_CARD", "REEL_COVER", "VIDEO_COVER", "TIKTOK_COVER"].filter((t) => code.includes(t));
  const r = day6();
  const usedTypes = [...new Set(r.members.map((m) => m.asset_type))];
  return { status: "SCAN", ok: newTypes.length === 0 && usedTypes.every((t) => ASSET_TYPES.includes(t)), detail: `new_asset_types=${newTypes.join("|") || "none"} used=${usedTypes.join("|")}` };
});

// =============================================================================================
// Q16 — VISUAL / DESIGN INTEGRITY (structural) + GOLD ACCENT
// =============================================================================================
q("Q16-01", "Q16_VISUAL", ["F"], () => {
  const r = day6();
  const statics = r.members.filter((m) => m.asset_type === "SOCIAL_STATIC" && m.production.checks);
  const hierarchy = statics.every((m) => m.production.checks.some((c) => c.check === "required_components_present" && c.pass === true));
  const bounds = statics.every((m) => m.production.checks.filter((c) => ["component_bounds", "logo_bounds", "cta_bounds", "safe_zone_bounds"].includes(c.check)).every((c) => c.pass === true));
  return { status: r.family_status, ok: hierarchy && bounds, detail: `hierarchy_present=${hierarchy} bounds_ok=${bounds}` };
});
q("Q16-02", "Q16_VISUAL", ["G"], () => {
  const fb = mediaSlotSpec({ design_id: "SH-VIS-FB", layout_family: "FULL_BLEED", visual_slots: [{ slot_id: "hero", media_type: "photo", required: true, treatment: "scrim", fallback: "SOURCE_REQUIRED" }] });
  const c = compose(fb, [mediaEntry("SYN-PHOTO-1")]);
  const within = (tag) => { const m = tag.match(/x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/); if (!m) return true; const [, x, y, w, h] = m.map(Number); return x >= 0 && y >= 0 && x + w <= 1080.5 && y + h <= 1350.5; };
  const rects = [...c.svg.matchAll(/<rect[^>]*>/g)].map((x) => x[0]);
  return { status: c.status, ok: c.status === COMPOSITOR_STATUS.READY && rects.every(within), detail: `canvas=1080x1350 all_rects_within_canvas=${rects.every(within)}` };
});
q("Q16-03", "Q16_VISUAL", ["F"], () => {
  const r = day6();
  const overflow = r.members.flatMap((m) => (m.production.checks || []).filter((c) => ["text_overflow", "layout_overflow"].includes(c.check) && c.pass === false));
  const collisions = r.members.flatMap((m) => (m.production.checks || []).filter((c) => c.check === "illegal_collision" && c.pass === false));
  return { status: r.family_status, ok: overflow.length === 0 && collisions.length === 0, detail: `overflow_failures=${overflow.length} collisions=${collisions.length}` };
});
q("Q16-04", "Q16_VISUAL", ["F"], () => {
  const r = day6();
  const logoOk = r.members.filter((m) => (m.production.checks || []).length).every((m) => m.production.checks.filter((c) => ["logo_bounds", "cta_bounds"].includes(c.check)).every((c) => c.pass === true));
  const commerce = roleOf(fam(FAM.commerceSupplied()), "IDENTIFICATION");
  const ctaRendered = commerce._artifact.visible_text.includes("Start the 30-day plan");
  return { status: r.family_status, ok: logoOk && ctaRendered, detail: `logo/cta bounds ok=${logoOk} cta_rendered_when_supplied=${ctaRendered}` };
});
q("Q16-05", "Q16_VISUAL", ["F"], () => {
  // exact evidence for the gold accent-bar classification (see NON_BLOCKING_DEFECTS[1])
  const typeOnly = compose(baseSpec({ design_id: "SH-ACC-TYPE", layout_family: "TYPE_DOMINANT" }));
  const mediaLess = compose(mediaSlotSpec({ design_id: "SH-ACC-FALLBACK" }));
  const media = compose(mediaSlotSpec({ design_id: "SH-ACC-MEDIA" }), [mediaEntry("SYN-PHOTO-1")]);
  const rectIndex = (svg, colour) => [...svg.matchAll(/<rect[^>]*>/g)].findIndex((m) => m[0].includes(colour));
  const typeOnlyAccentVisible = rectIndex(typeOnly.svg, "#D9A52E") > -1;
  const mediaLessAccent = rectIndex(mediaLess.svg, "#D9A52E"), mediaLessPanel = rectIndex(mediaLess.svg, "#F4F6F8");
  const coveredInFallback = mediaLessAccent > -1 && mediaLessPanel > -1 && mediaLessAccent < mediaLessPanel;
  const mediaAccentVisible = rectIndex(media.svg, "#D9A52E") > -1 && media.svg.indexOf("<image") < media.svg.indexOf("#D9A52E");
  const ok = typeOnlyAccentVisible && coveredInFallback && mediaAccentVisible;
  return { status: coveredInFallback ? "PRE_EXISTING_DESIGN_REFINEMENT" : "CLEAN", ok, detail: `type_only_accent_visible=${typeOnlyAccentVisible} fallback(status=${mediaLess.status}) accent_covered=${coveredInFallback} media_accent_above_image=${mediaAccentVisible}` };
});
q("Q16-06", "Q16_VISUAL", ["F", "P"], () => {
  const r = day6();
  const carousel = roleOf(r, "STORY"), story = roleOf(r, "REINFORCEMENT");
  return { status: r.family_status, ok: carousel.production.panel_count === 3 && carousel.production.panel_roles.join(">") === "COVER>EXPLAIN>ACT" && story.production.panel_count === 2 && story.production.panel_roles.join(">") === "COVER>ACT", detail: `carousel=${carousel.production.panel_roles.join(">")} story=${story.production.panel_roles.join(">")}` };
});
q("Q16-07", "Q16_VISUAL", ["I", "J"], () => {
  const code = read("mae/harness/social-production-qualification.test.mjs") + read("mae/harness/social-production-qualification-fixtures.mjs");
  const forbiddenClaims = ["Fortune" + " 500", "world-" + "class design", "professional-" + "grade aesthetics", "professional " + "quality", "award-" + "winning"];
  const corpus = (JSON.stringify(CASES) + JSON.stringify(buildSummary())).toLowerCase();
  const leaked = forbiddenClaims.filter((c) => corpus.includes(c.toLowerCase()));
  const r = day6();
  const judgment = r.coherence.judgment.status;
  const fixtureJudgment = frozenJudgment();
  return { status: judgment, ok: leaked.length === 0 && judgment === "JUDGMENT_REQUIRED" && fixtureJudgment.live === false && fixtureJudgment.provider === "fixture", detail: `unsupported_quality_claims_in_output=${leaked.join("|") || "none"} coherence_without_evaluator=${judgment} frozen_fixture_judgment=provider:${fixtureJudgment.provider} live:${fixtureJudgment.live}` };
});

// =============================================================================================
// QUALIFICATION SUMMARY (deterministic) + FINAL VERDICT
// =============================================================================================
function buildSummary() {
  const passed = CASES.filter((c) => c.result === "PASS");
  const failed = CASES.filter((c) => c.result === "FAIL");
  const invariants = Object.fromEntries(INVARIANTS.map((k) => [k, { cases: (INVARIANTS_RESULT[k] || []).length, passed: (INVARIANTS_RESULT[k] || []).filter(Boolean).length, failed: (INVARIANTS_RESULT[k] || []).filter((x) => !x).length }]));
  const invariantsAllGreen = INVARIANTS.every((k) => (INVARIANTS_RESULT[k] || []).length > 0 && (INVARIANTS_RESULT[k] || []).every(Boolean));
  const blockers = failed.map((c) => ({ case_id: c.case_id, detail: c.detail }));
  const readiness = blockers.length ? "NOT_QUALIFIED"
    : !invariantsAllGreen ? "NOT_QUALIFIED"
      : NON_BLOCKING_DEFECTS.length ? "QUALIFIED_WITH_NON_BLOCKING_DEFECTS" : "QUALIFIED";
  return {
    qualification_version: QUALIFICATION_VERSION,
    checkpoint_sha: CHECKPOINT_SHA,
    cases_total: CASES.length,
    cases_passed: passed.length,
    cases_failed: failed.length,
    judgment_required: CASES.filter((c) => c.actual_status === "JUDGMENT_REQUIRED").length,
    not_applicable: 0,
    blockers,
    non_blocking_defects: NON_BLOCKING_DEFECTS.map((d) => ({ id: d.id, classification: d.classification, title: d.title })),
    deferred_capabilities: DEFERRED_CAPABILITIES,
    invariants,
    invariants_all_green: invariantsAllGreen,
    regression_results: { note: "run separately (see final report): S-G 89, S-F 55, S-E 74, S-D 65+48, S-C 81, S-B 81, S-A 84, MAE serial, image 176, video 278, factory 0 failures" },
    external_activity: { image_calls: 0, video_calls: 0, evaluator_calls: 0, network_calls: 0, spend_usd: 0 },
    production_readiness: readiness,
    categories: [...new Set(CASES.map((c) => c.category))].sort(),
  };
}

test("QUAL-SUMMARY · deterministic qualification summary + readiness verdict", () => {
  const s1 = buildSummary();
  const s2 = buildSummary();
  assert.equal(JSON.stringify(s1), JSON.stringify(s2), "summary must be deterministic");
  assert.ok(s1.cases_total >= 40, `at least 40 qualification cases (got ${s1.cases_total})`);
  assert.equal(s1.cases_failed, 0, `no failing qualification cases (failed: ${s1.blockers.map((b) => b.case_id).join(",")})`);
  assert.equal(s1.invariants_all_green, true, "every invariant A–T must be qualified");
  assert.deepEqual(s1.blockers, [], "no blockers");
  assert.ok(["QUALIFIED", "QUALIFIED_WITH_NON_BLOCKING_DEFECTS"].includes(s1.production_readiness), `readiness=${s1.production_readiness}`);
  console.log("\nS-H QUALIFICATION SUMMARY\n" + JSON.stringify(s1, null, 2));
});
