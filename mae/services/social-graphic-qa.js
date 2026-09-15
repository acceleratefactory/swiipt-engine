// MAE · Social Design Production — Evidence Authorization Gate + SocialGraphicQA (Wave S-E).
// The APPROVAL LAYER for finished social design assets. Two separate questions:
//   1. EVIDENCE / TRUTH AUTHORIZATION — was this design ALLOWED to make the claims/proof/price it shows?
//   2. SOCIAL GRAPHIC QUALITY        — is the finished graphic acceptable as a Swiipt marketing asset?
// Structural/deterministic production validation stays upstream (S-A…S-D) and is NOT re-judged here.
//
// Reuses: lib/errors fail, visual-output-qa vocabulary (QA_STATUS/DIMENSION_CLASS), the S-A contract
// (taxonomies + evidence_requirements), S-D platform profiles, S-D assembler continuity checks.
// No live evaluator, no image/video calls, no raster, no publishing, no copy rewriting, no network.
import { fail } from "../lib/errors.js";
import { QA_STATUS as VISUAL_QA_STATUS, DIMENSION_CLASS } from "./visual-output-qa.js";
import { validateSocialDesignSpec, CONTENT_PATTERNS, ASSET_TYPES, EVIDENCE_TYPES } from "./social-design-spec.js";
import { PLATFORM_PROFILES } from "./social-platforms.js";

export const SOCIAL_GRAPHIC_QA_VERSION = "social-graphic-qa@1";
export { DIMENSION_CLASS };

export const QA_STATUS = Object.freeze({
  ...VISUAL_QA_STATUS,
  NOT_APPLICABLE: "NOT_APPLICABLE",   // dimension not applicable to this artifact (e.g. imagery for type-only)
  NOT_ELIGIBLE: "NOT_ELIGIBLE",       // unresolved production failure — QA must not judge
  REVIEW_REQUIRED: "REVIEW_REQUIRED", // authorized human-review condition (not a pass, not a failure)
  EVALUATOR_INVALID: "EVALUATOR_INVALID",
});
export const OVERALL_STATUS = Object.freeze({ PASS: "PASS", FAIL: "FAIL", REVIEW_REQUIRED: "REVIEW_REQUIRED", JUDGMENT_REQUIRED: "JUDGMENT_REQUIRED", NOT_ELIGIBLE: "NOT_ELIGIBLE" });
export const EVIDENCE_STATUS = Object.freeze({ PASS: "PASS", FAIL: "FAIL", NOT_REQUIRED: "NOT_REQUIRED", REVIEW_REQUIRED: "REVIEW_REQUIRED" });

// PART 7 — explicit authorization classes.
export const AUTHORIZATION_CLASS = Object.freeze({
  NO_SPECIAL_EVIDENCE_REQUIRED: "NO_SPECIAL_EVIDENCE_REQUIRED",
  PRODUCT_TRUTH_REQUIRED: "PRODUCT_TRUTH_REQUIRED",
  EVIDENCE_SOURCE_REQUIRED: "EVIDENCE_SOURCE_REQUIRED",
  CUSTOMER_PROOF_REQUIRED: "CUSTOMER_PROOF_REQUIRED",
  COMPARISON_SUPPORT_REQUIRED: "COMPARISON_SUPPORT_REQUIRED",
  BEFORE_AFTER_SUPPORT_REQUIRED: "BEFORE_AFTER_SUPPORT_REQUIRED",
  COMMERCE_TRUTH_REQUIRED: "COMMERCE_TRUTH_REQUIRED",
  SAFETY_REVIEW_REQUIRED: "SAFETY_REVIEW_REQUIRED",
});

// PART 6 — which content patterns carry which authorization burden.
export const PATTERN_AUTHORIZATION = Object.freeze({
  STATEMENT: AUTHORIZATION_CLASS.NO_SPECIAL_EVIDENCE_REQUIRED,
  TYPOGRAPHIC_HOOK: AUTHORIZATION_CLASS.NO_SPECIAL_EVIDENCE_REQUIRED,
  QUESTION: AUTHORIZATION_CLASS.NO_SPECIAL_EVIDENCE_REQUIRED,
  QUOTE: AUTHORIZATION_CLASS.CUSTOMER_PROOF_REQUIRED,
  IDENTIFICATION: AUTHORIZATION_CLASS.NO_SPECIAL_EVIDENCE_REQUIRED,
  REASSURANCE: AUTHORIZATION_CLASS.NO_SPECIAL_EVIDENCE_REQUIRED,
  PROBLEM_INSIGHT: AUTHORIZATION_CLASS.NO_SPECIAL_EVIDENCE_REQUIRED,
  MYTH_REALITY: AUTHORIZATION_CLASS.NO_SPECIAL_EVIDENCE_REQUIRED,
  MISTAKE_CORRECTION: AUTHORIZATION_CLASS.NO_SPECIAL_EVIDENCE_REQUIRED,
  CHECKLIST: AUTHORIZATION_CLASS.NO_SPECIAL_EVIDENCE_REQUIRED,
  STEPS: AUTHORIZATION_CLASS.NO_SPECIAL_EVIDENCE_REQUIRED,
  STATISTIC: AUTHORIZATION_CLASS.EVIDENCE_SOURCE_REQUIRED,
  DATA: AUTHORIZATION_CLASS.EVIDENCE_SOURCE_REQUIRED,
  TESTIMONIAL: AUTHORIZATION_CLASS.CUSTOMER_PROOF_REQUIRED,
  PROOF: AUTHORIZATION_CLASS.CUSTOMER_PROOF_REQUIRED,
  BEFORE_AFTER: AUTHORIZATION_CLASS.BEFORE_AFTER_SUPPORT_REQUIRED,
  COMPARISON: AUTHORIZATION_CLASS.COMPARISON_SUPPORT_REQUIRED,
  PRICE: AUTHORIZATION_CLASS.COMMERCE_TRUTH_REQUIRED,
  OFFER: AUTHORIZATION_CLASS.COMMERCE_TRUTH_REQUIRED,
  FEATURE: AUTHORIZATION_CLASS.PRODUCT_TRUTH_REQUIRED,
  FEATURE_BENEFIT: AUTHORIZATION_CLASS.PRODUCT_TRUTH_REQUIRED,
  BENEFIT_STACK: AUTHORIZATION_CLASS.PRODUCT_TRUTH_REQUIRED,
});

// PART 38 — zero-tolerance classes (only genuinely necessary additions).
export const ZERO_TOLERANCE_CLASSES = Object.freeze([
  "PRODUCT_TRUTH_VIOLATION", "SAFETY_VIOLATION", "UNSUPPORTED_VISUAL_CLAIM", "FAKE_TESTIMONIAL",
  "FABRICATED_PROOF", "FABRICATED_STATISTIC", "MISLEADING_BEFORE_AFTER", "WRONG_PRICE", "WRONG_MEMBER_PRICE",
  "FALSE_FEATURE", "SEVERE_CULTURAL_MISREPRESENTATION", "FABRICATED_SCARCITY",
]);

// PART 68 — machine-readable revision diagnostics (no autonomous regeneration).
export const DIAGNOSTICS = Object.freeze({
  ANGLE_WEAKENED: "ANGLE_WEAKENED", GENERIC_TEMPLATE: "GENERIC_TEMPLATE", HIERARCHY_WEAK: "HIERARCHY_WEAK",
  LEGIBILITY_POOR: "LEGIBILITY_POOR", EVIDENCE_MISSING: "EVIDENCE_MISSING", PRICE_MISMATCH: "PRICE_MISMATCH",
  UNSUPPORTED_VISUAL_CLAIM: "UNSUPPORTED_VISUAL_CLAIM", CULTURAL_MISREPRESENTATION: "CULTURAL_MISREPRESENTATION",
  EMOTIONAL_EXAGGERATION: "EMOTIONAL_EXAGGERATION", PLATFORM_MISFIT: "PLATFORM_MISFIT",
});

// PART 20 — the 18 approved dimensions.
export const SOCIAL_QA_DIMENSIONS = Object.freeze([
  { id: "ANGLE_FIDELITY", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Does the graphic communicate the validated Marketing Angle?" },
  { id: "CUSTOMER_TRUTH_FIDELITY", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Does the design stay grounded in Customer Truth?" },
  { id: "PRODUCT_TRUTH_FIDELITY", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Does the design avoid implying unsupported product capabilities?", zero_tolerance: "PRODUCT_TRUTH_VIOLATION" },
  { id: "VISUAL_GROUNDING_FIDELITY", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Where imagery exists, does it match the approved Visual Grounding?", requires_media: true },
  { id: "BRAND_FIT", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Does the graphic read as Swiipt (voice/visual coherence/restraint/specificity)?" },
  { id: "INTERCHANGEABILITY", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Could another brand's logo replace Swiipt's with the graphic essentially unchanged?", primary_anti_generic: true },
  { id: "CULTURAL_INTEGRITY", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Is the cultural depiction grounded, accurate and free of stereotyping?", zero_tolerance: "SEVERE_CULTURAL_MISREPRESENTATION" },
  { id: "EMOTIONAL_INTEGRITY", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Does the emotional presentation stay within grounded Customer Truth?" },
  { id: "COMPOSITION", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Balance, focal point, whitespace, visual flow and text/media relationship." },
  { id: "HIERARCHY", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Is the intended hierarchy perceptually clear?" },
  { id: "LEGIBILITY", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Is the designed result legible at mobile viewing size?" },
  { id: "PLATFORM_FIT", class: DIMENSION_CLASS.DETERMINISTIC, question: "Does the artifact match the resolved platform/placement profile?" },
  { id: "COPY_INTEGRITY", class: DIMENSION_CLASS.DETERMINISTIC, question: "Is approved copy present, exact, and visually undeformed?" },
  { id: "EVIDENCE_INTEGRITY", class: DIMENSION_CLASS.DETERMINISTIC, question: "Are the claims/proof/price in this design authorized by evidence/truth?" },
  { id: "UNSUPPORTED_VISUAL_CLAIM", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Does the visual itself imply an unsupported claim?", zero_tolerance: "UNSUPPORTED_VISUAL_CLAIM" },
  { id: "AI_ARTIFACTS", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Visible generative artifacts in source media?", requires_generated_media: true },
  { id: "ANATOMICAL_PLAUSIBILITY", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Plausible people/body structure in source media?", requires_generated_media: true },
  { id: "SAFETY_INTEGRITY", class: DIMENSION_CLASS.DETERMINISTIC, question: "Does marketing respect the product's authorized safety/claim boundary?", zero_tolerance: "SAFETY_VIOLATION" },
]);
const DIM = (id) => SOCIAL_QA_DIMENSIONS.find((d) => d.id === id);
const DIM_DIAGNOSTIC = Object.freeze({
  ANGLE_FIDELITY: DIAGNOSTICS.ANGLE_WEAKENED, INTERCHANGEABILITY: DIAGNOSTICS.GENERIC_TEMPLATE,
  HIERARCHY: DIAGNOSTICS.HIERARCHY_WEAK, LEGIBILITY: DIAGNOSTICS.LEGIBILITY_POOR,
  CULTURAL_INTEGRITY: DIAGNOSTICS.CULTURAL_MISREPRESENTATION, EMOTIONAL_INTEGRITY: DIAGNOSTICS.EMOTIONAL_EXAGGERATION,
  UNSUPPORTED_VISUAL_CLAIM: DIAGNOSTICS.UNSUPPORTED_VISUAL_CLAIM, PLATFORM_FIT: DIAGNOSTICS.PLATFORM_MISFIT,
  EVIDENCE_INTEGRITY: DIAGNOSTICS.EVIDENCE_MISSING,
});

const isObj = (v) => v != null && typeof v === "object" && !Array.isArray(v);
const nonEmpty = (v) => typeof v === "string" && v.length > 0;
const uniq = (a) => new Set(a).size === a.length;
const SCARCITY = /limited time|ends tonight|only \d+ left|last chance|today only|hurry|before it'?s gone/i;
const CLINICAL_CLAIM = /\b(cures?|treats?|heals?|reverses?|prevents?|diagnos(e|es|is))\b/i;
const GENERIC_ANGLE = /tips|hacks?|routine|essentials|guide to|how to/i;

const allCopyBlocks = (spec) => [...(spec?.copy_blocks || []), ...((spec?.slides || []).flatMap((s) => s.copy_blocks || []))];
const allPatterns = (spec) => [...new Set([spec?.content_pattern, ...((spec?.slides || []).map((s) => s.content_pattern))].filter(Boolean))];
const allCopyText = (spec) => allCopyBlocks(spec).map((b) => b.text).join("\n");

const isSynthetic = (ref) => {
  if (ref == null) return false;
  if (typeof ref === "string") return /^SYN[-_]|synthetic/i.test(ref);
  return ref.synthetic === true || ref._fixture_origin === "synthetic" || /^SYN[-_]|synthetic/i.test(String(ref.evidence_id ?? ref.id ?? ""));
};

/** PART 19 — evidence authorization result. Deterministic; never fetches, never searches. */
export function authorizeEvidence({ design_spec = {}, evidence_context = {}, truth_context = {} } = {}) {
  const requirements = [];
  const checks = [];
  const failures = [];
  const warnings = [];
  const evidence_refs = [];
  const truth_refs = [];
  const add = (requirement, ok, detail, opts = {}) => {
    checks.push({ requirement, pass: ok === true, detail, class: AUTHORIZATION_CLASS[requirement] ?? null, ...(opts.zero_tolerance ? { zero_tolerance: opts.zero_tolerance } : {}) });
    if (ok !== true) failures.push({ requirement, detail, zero_tolerance: opts.zero_tolerance ?? null, diagnostic: opts.diagnostic ?? DIAGNOSTICS.EVIDENCE_MISSING });
  };

  const patterns = allPatterns(design_spec);
  const records = Array.isArray(evidence_context.records) ? evidence_context.records : [];
  const declared = (design_spec.evidence_requirements || []).map((e) => e.evidence_id).filter(Boolean);
  const product = truth_context.product || {};
  const commerce = truth_context.commerce || {};
  const copy = allCopyText(design_spec);
  const roles = allCopyBlocks(design_spec).map((b) => b.role);

  for (const pattern of patterns) {
    const cls = PATTERN_AUTHORIZATION[pattern];
    if (!cls) continue;
    requirements.push({ pattern, authorization: cls });
    if (cls === AUTHORIZATION_CLASS.NO_SPECIAL_EVIDENCE_REQUIRED) { add("NO_SPECIAL_EVIDENCE_REQUIRED", true, `${pattern} needs no external evidence`); continue; }

    // a declared reference authorizes only when an actual matching record resolves to it
    const unresolved = declared.filter((id) => !records.some((r) => (r.evidence_id ?? r.id) === id));
    const refs = declared.map((id) => records.find((r) => (r.evidence_id ?? r.id) === id)).filter(Boolean);
    const authorized = refs.filter((r) => !isSynthetic(r) && r.authorized !== false);
    if (unresolved.length) warnings.push(`unresolved evidence reference(s): ${unresolved.join(", ")}`);

    if (cls === AUTHORIZATION_CLASS.EVIDENCE_SOURCE_REQUIRED) {
      const ok = authorized.length > 0;
      add("EVIDENCE_SOURCE_REQUIRED", ok, ok ? `${pattern} backed by ${authorized.map((r) => r.evidence_id ?? r.id).join(", ")}` : `${pattern} has no non-synthetic evidence reference`, { zero_tolerance: "FABRICATED_STATISTIC" });
      if (declared.length && !authorized.length) warnings.push("declared evidence is synthetic or unauthorized and cannot authorize a statistic");
    } else if (cls === AUTHORIZATION_CLASS.CUSTOMER_PROOF_REQUIRED) {
      const ok = authorized.length > 0;
      const zt = pattern === "TESTIMONIAL" ? "FAKE_TESTIMONIAL" : "FABRICATED_PROOF";
      add("CUSTOMER_PROOF_REQUIRED", ok, ok ? `${pattern} traceable to customer proof` : `${pattern} has no authorized customer-proof record`, { zero_tolerance: zt });
    } else if (cls === AUTHORIZATION_CLASS.BEFORE_AFTER_SUPPORT_REQUIRED) {
      const pair = evidence_context.before_after;
      const ok = (authorized.length > 0) && !!(pair && pair.before_ref && pair.after_ref && pair.relationship) && isObj(pair) && pair.misleading !== true;
      add("BEFORE_AFTER_SUPPORT_REQUIRED", ok, ok ? "before/after states and relationship supported" : "before/after requires supported before state, after state and relationship", { zero_tolerance: "MISLEADING_BEFORE_AFTER" });
    } else if (cls === AUTHORIZATION_CLASS.COMPARISON_SUPPORT_REQUIRED) {
      const internal = design_spec.comparison_basis === "INTERNAL_PRICE";
      const ok = internal ? truth_refs.length > 0 || commerce.approved_price_text != null : (authorized.length > 0 || isObj(evidence_context.comparison) && evidence_context.comparison.supported === true);
      add("COMPARISON_SUPPORT_REQUIRED", ok, ok ? "comparison traceable to supplied support" : "comparison (better/faster/cheaper) requires supplied support", { zero_tolerance: ok ? null : "UNSUPPORTED_VISUAL_CLAIM" });
    } else if (cls === AUTHORIZATION_CLASS.COMMERCE_TRUTH_REQUIRED) {
      if (pattern === "PRICE" || roles.includes("price")) {
        const shown = allCopyBlocks(design_spec).find((b) => b.role === "price")?.text;
        if (shown != null) {
          const ok = nonEmpty(commerce.approved_price_text) && shown === commerce.approved_price_text;
          add("COMMERCE_TRUTH_REQUIRED", ok, ok ? `price matches approved value (${shown})` : `displayed price "${shown}" does not match approved price "${commerce.approved_price_text ?? "(none supplied)"}"`, { zero_tolerance: "WRONG_PRICE", diagnostic: DIAGNOSTICS.PRICE_MISMATCH });
          if (ok) truth_refs.push(`commerce.price:${shown}`);
        }
      }
      if (pattern === "OFFER" || roles.includes("offer")) {
        const offerText = allCopyBlocks(design_spec).find((b) => b.role === "offer")?.text ?? "";
        const scarcity = SCARCITY.test(`${offerText}\n${copy}`);
        const ok = isObj(commerce.offer) && commerce.offer.authorized === true && (!scarcity || commerce.offer.scarcity_authorized === true);
        add("COMMERCE_TRUTH_REQUIRED", ok, ok ? "offer traceable to commerce truth" : (scarcity ? "scarcity language present without authorized scarcity truth" : "offer requires authorized commerce truth"), { zero_tolerance: ok ? null : "FABRICATED_SCARCITY" });
      }
    } else if (cls === AUTHORIZATION_CLASS.PRODUCT_TRUTH_REQUIRED) {
      const approved = Array.isArray(product.features) ? product.features : [];
      const featureCopy = allCopyBlocks(design_spec).filter((b) => ["list_item", "label", "badge", "body"].includes(b.role)).map((b) => b.text);
      const bad = featureCopy.filter((t) => !approved.includes(t));
      const ok = approved.length > 0 && bad.length === 0;
      add("PRODUCT_TRUTH_REQUIRED", ok, ok ? "feature/benefit copy matches approved Product Truth features" : `feature copy not in approved Product Truth: ${bad.slice(0, 2).join(" | ") || "(no approved features supplied)"}`, { zero_tolerance: ok ? null : "FALSE_FEATURE" });
      if (ok) truth_refs.push("product.features");
    }
  }

  // member price (Part 14) — checked whenever the design carries a members_price value
  const memberShown = allCopyBlocks(design_spec).find((b) => b.role === "members_price")?.text;
  if (memberShown != null) {
    requirements.push({ pattern: "MEMBERS_PRICE", authorization: AUTHORIZATION_CLASS.COMMERCE_TRUTH_REQUIRED });
    const ok = nonEmpty(commerce.approved_member_price_text) && memberShown === commerce.approved_member_price_text;
    add("COMMERCE_TRUTH_REQUIRED", ok, ok ? `member price matches approved value (${memberShown})` : `displayed member price "${memberShown}" does not match approved member price "${commerce.approved_member_price_text ?? "(none supplied)"}"`, { zero_tolerance: "WRONG_MEMBER_PRICE", diagnostic: DIAGNOSTICS.PRICE_MISMATCH });
    if (ok) truth_refs.push(`commerce.member_price:${memberShown}`);
  }

  // safety-sensitive marketing (Part 17) — marketing may not exceed the product's authorized boundary
  if (product.safety_sensitive === true) {
    requirements.push({ pattern: "SAFETY", authorization: AUTHORIZATION_CLASS.SAFETY_REVIEW_REQUIRED });
    const reviewOk = product.safety_review_status === "approved";
    const clinical = CLINICAL_CLAIM.test(copy);
    if (clinical && !reviewOk) add("SAFETY_REVIEW_REQUIRED", false, "clinical-adjacent claim without approved safety review", { zero_tolerance: "SAFETY_VIOLATION" });
    else checks.push({ requirement: "SAFETY_REVIEW_REQUIRED", pass: reviewOk, detail: reviewOk ? "product safety review approved" : "safety review not yet approved — human review required", class: AUTHORIZATION_CLASS.SAFETY_REVIEW_REQUIRED, review: !reviewOk });
    if (!reviewOk && !clinical) warnings.push("safety-sensitive product: marketing requires human safety review before publication");
  }

  evidence_refs.push(...declared);
  const hardFailures = failures.filter((f) => f.zero_tolerance);
  const reviewOnly = failures.length === 0 && checks.some((c) => c.review === true);
  const status = failures.length === 0 ? (reviewOnly ? EVIDENCE_STATUS.REVIEW_REQUIRED : requirements.every((r) => r.authorization === AUTHORIZATION_CLASS.NO_SPECIAL_EVIDENCE_REQUIRED) ? EVIDENCE_STATUS.NOT_REQUIRED : EVIDENCE_STATUS.PASS) : EVIDENCE_STATUS.FAIL;
  return {
    status, requirements, checks, evidence_refs: [...new Set(evidence_refs)], truth_refs: [...new Set(truth_refs)],
    failures, warnings, zero_tolerance: [...new Set(hardFailures.map((f) => f.zero_tolerance))],
    provenance: { design_id: design_spec.design_id ?? null, angle_id: design_spec.angle_id ?? null, qa_version: SOCIAL_GRAPHIC_QA_VERSION, evidence_context_refs: records.length, synthetic_refs: declared.filter((id) => isSynthetic(records.find((r) => (r.evidence_id ?? r.id) === id) ?? { evidence_id: id })).length },
  };
}

// ---- evaluator contract (replaceable; no provider is bound) -------------------
export const JUDGMENT_STATUSES = Object.freeze([QA_STATUS.PASS, QA_STATUS.FAIL, QA_STATUS.HUMAN_REVIEW]);

/** Validate a structured evaluator payload. Unstructured prose is never authoritative QA state. */
export function validateEvaluatorResult(payload = {}) {
  const errors = [];
  if (!isObj(payload)) return { valid: false, errors: ["evaluator payload must be an object"] };
  if (!isObj(payload.results)) errors.push("evaluator payload requires results{}");
  if (payload.provider != null && typeof payload.provider !== "string") errors.push("provider must be a string");
  if (payload.model != null && typeof payload.model !== "string") errors.push("model must be a string");
  for (const [id, r] of Object.entries(payload.results || {})) {
    if (!DIM(id)) { errors.push(`unknown dimension "${id}"`); continue; }
    if (!isObj(r)) { errors.push(`${id}: result must be an object`); continue; }
    if (!JUDGMENT_STATUSES.includes(r.status)) errors.push(`${id}: unknown status "${r.status}"`);
    if ("score" in r && r.score != null && typeof r.score !== "number") errors.push(`${id}: score must be a number`);
    if ("severity" in r && r.severity != null && !["LOW", "MEDIUM", "HIGH"].includes(r.severity)) errors.push(`${id}: severity must be LOW|MEDIUM|HIGH`);
    if ("rationale" in r && r.rationale != null && typeof r.rationale !== "string") errors.push(`${id}: rationale must be a string`);
    if ("failure_class" in r && r.failure_class != null && !ZERO_TOLERANCE_CLASSES.includes(r.failure_class)) errors.push(`${id}: unknown zero-tolerance class "${r.failure_class}"`);
  }
  return { valid: errors.length === 0, errors };
}

/** Deterministic mock/frozen evaluator (qualification only; never presented as a real model run). */
export function createMockEvaluator({ results = {}, provider = "fixture", model = "fixture", live = false, version = "mock-evaluator@1" } = {}) {
  const v = validateEvaluatorResult({ results, provider, model });
  if (!v.valid) fail("EVALUATOR_INVALID", "mock evaluator payload is invalid", { errors: v.errors });
  return { provider, model, live: live === true, version, results };
}

const PRODUCTION_FAILURES = Object.freeze([
  QA_STATUS.SOURCE_REQUIRED, "INVALID_SPEC", "TEXT_OVERFLOW", "LAYOUT_OVERFLOW", "PLATFORM_PROFILE_MISMATCH",
  "MULTI_PANEL_ASSEMBLY_NOT_IMPLEMENTED", "UNSUPPORTED_PLATFORM_PLACEMENT", "UNSUPPORTED_ASSET_TYPE", "ARTIFACT_VALIDATION_FAILED", "EVALUATOR_INVALID",
]);

function productionPreconditions({ rendered_artifact, deterministic_checks } = {}) {
  const reasons = [];
  const st = rendered_artifact?.status;
  if (PRODUCTION_FAILURES.includes(st)) reasons.push(`production status ${st}`);
  for (const c of deterministic_checks || []) {
    if (c && c.pass === false && /canvas|safe_zone|collision|bounds|copy_exactness|required_copy|overflow|profile|deterministic/.test(String(c.check))) reasons.push(`failed deterministic check ${c.check}`);
  }
  return reasons;
}

function hasMedia(spec, rendered_artifact) {
  if ((spec?.visual_slots || []).length > 0) return true;
  const refs = rendered_artifact?.source_media_refs;
  return Array.isArray(refs) && refs.length > 0;
}
function hasGeneratedMedia(rendered_artifact) { return rendered_artifact?.generated_media === true; }

/** PART 46 — overall state machine (explicit; no averaging). */
export function overallStatus({ eligible, evidenceStatus, blocking, review, judgmentPending, anyDimFail = false }) {
  if (!eligible) return OVERALL_STATUS.NOT_ELIGIBLE;
  if (blocking.length || evidenceStatus === EVIDENCE_STATUS.FAIL || anyDimFail) return OVERALL_STATUS.FAIL;
  if (review) return OVERALL_STATUS.REVIEW_REQUIRED;
  if (judgmentPending) return OVERALL_STATUS.JUDGMENT_REQUIRED;
  return OVERALL_STATUS.PASS;
}

/**
 * Evaluate ONE finished social design artifact (static, or one panel of a multi-panel asset).
 * Deterministic checks + evidence authorization + judgment dimensions from a replaceable evaluator.
 */
export function evaluateSocialGraphic(input = {}) {
  const { design_spec = {}, rendered_artifact = {}, deterministic_checks = [], evidence_context = {}, truth_context = {}, evaluator = null, layout_plan = null, panel_index = null } = input;
  const preconditions = productionPreconditions({ rendered_artifact, deterministic_checks });
  const evidence = authorizeEvidence({ design_spec, evidence_context, truth_context });

  const dims = [];
  const blocking = [];
  const diagnostics = [];
  const add = (id, { status, detail = "", score = null, severity = null, failure_class = null, source = "deterministic" }) => {
    const def = DIM(id);
    if (failure_class) {
      if (!ZERO_TOLERANCE_CLASSES.includes(failure_class)) { dims.push({ id, class: def.class, status: QA_STATUS.EVALUATOR_INVALID, detail: `unknown zero-tolerance class ${failure_class}` }); return; }
      blocking.push(failure_class);
    }
    if (def.zero_tolerance && status === QA_STATUS.FAIL) blocking.push(def.zero_tolerance);
    dims.push({ id, class: def.class, status, detail, score, severity, failure_class: failure_class ?? (def.zero_tolerance && status === QA_STATUS.FAIL ? def.zero_tolerance : null), source });
  };

  if (preconditions.length) {
    return {
      status: OVERALL_STATUS.NOT_ELIGIBLE, eligible: false, not_eligible_reasons: preconditions,
      dimensions: SOCIAL_QA_DIMENSIONS.map((d) => ({ id: d.id, class: d.class, status: QA_STATUS.NOT_RUN, detail: "artifact not eligible for QA (unresolved production failure)" })),
      evidence_authorization: evidence, blocking_failures: [], diagnostics: [], human_review_required: false,
      judgment_run: false, evaluator: null, panel_index,
      provenance: makeProvenance({ design_spec, rendered_artifact, layout_plan, evaluator: null, evidence }),
    };
  }

  const ev = evaluator ? validateEvaluatorResult(evaluator) : null;
  const evaluatorInvalid = evaluator != null && !ev.valid;
  if (evaluatorInvalid) diagnostics.push({ diagnostic: QA_STATUS.EVALUATOR_INVALID, detail: ev.errors });
  const results = evaluatorInvalid ? {} : (evaluator?.results || {});
  const media = hasMedia(design_spec, rendered_artifact);
  const generated = hasGeneratedMedia(rendered_artifact);

  // deterministic dimensions
  const profile = PLATFORM_PROFILES[`${design_spec.platform}|${design_spec.placement}`] ?? null;
  const platformOk = !!profile && profile.accepted_formats.includes(design_spec.platform_format) && (profile.asset_type_hint === design_spec.asset_type || design_spec.asset_type === "SOCIAL_STATIC");
  add("PLATFORM_FIT", { status: platformOk ? QA_STATUS.PASS : QA_STATUS.FAIL, detail: platformOk ? `${profile.platform}.${profile.placement} (${design_spec.platform_format})` : "artifact does not match its resolved platform profile" });
  if (!platformOk) diagnostics.push({ diagnostic: DIAGNOSTICS.PLATFORM_MISFIT, detail: design_spec.platform_format });

  const copyBlocks = allCopyBlocks(design_spec);
  const copyOk = copyBlocks.length > 0 && copyBlocks.every((b) => nonEmpty(b.text));
  add("COPY_INTEGRITY", { status: copyOk ? QA_STATUS.PASS : QA_STATUS.FAIL, detail: copyOk ? `${copyBlocks.length} approved copy block(s) intact` : "missing/empty approved copy block" });

  add("EVIDENCE_INTEGRITY", { status: evidence.status === EVIDENCE_STATUS.FAIL ? QA_STATUS.FAIL : evidence.status === EVIDENCE_STATUS.REVIEW_REQUIRED ? QA_STATUS.HUMAN_REVIEW : QA_STATUS.PASS, detail: `evidence authorization ${evidence.status}` });
  for (const f of evidence.failures) diagnostics.push({ diagnostic: f.diagnostic ?? DIAGNOSTICS.EVIDENCE_MISSING, detail: `${f.requirement}: ${f.detail}` });

  const safetyReviewOk = !(truth_context.product?.safety_sensitive === true) || truth_context.product?.safety_review_status === "approved";
  add("SAFETY_INTEGRITY", { status: safetyReviewOk ? QA_STATUS.PASS : QA_STATUS.HUMAN_REVIEW, detail: safetyReviewOk ? "safety boundary respected" : "safety review pending — marketing may not publish yet" });
  if (!safetyReviewOk) diagnostics.push({ diagnostic: "SAFETY_REVIEW_REQUIRED", detail: "human safety review required" });

  // judgment dimensions (evaluator results, else JUDGMENT_REQUIRED; N/A where imagery is not involved)
  let judgmentPending = false;
  for (const d of SOCIAL_QA_DIMENSIONS.filter((x) => x.class === DIMENSION_CLASS.JUDGMENT_REQUIRED)) {
    if (d.requires_media && !media) { dims.push({ id: d.id, class: d.class, status: QA_STATUS.NOT_APPLICABLE, detail: "no source media in this artifact" }); continue; }
    if (d.requires_generated_media && !generated) { dims.push({ id: d.id, class: d.class, status: QA_STATUS.NOT_APPLICABLE, detail: "no generated source media in this artifact" }); continue; }
    const r = results[d.id];
    if (evaluatorInvalid) { dims.push({ id: d.id, class: d.class, status: QA_STATUS.EVALUATOR_INVALID, detail: "evaluator result invalid" }); continue; }
    if (!r) {
      judgmentPending = true;
      dims.push({ id: d.id, class: d.class, status: QA_STATUS.JUDGMENT_REQUIRED, detail: "requires a design evaluator (not run)" });
      continue;
    }
    if (r.status === QA_STATUS.FAIL) diagnostics.push({ diagnostic: DIM_DIAGNOSTIC[d.id] ?? "JUDGMENT_FAIL", detail: r.rationale ?? "" });
    add(d.id, { status: r.status, detail: r.rationale ?? "evaluator result", score: r.score ?? null, severity: r.severity ?? null, failure_class: r.failure_class ?? null, source: "judgment" });
  }

  for (const zt of evidence.zero_tolerance) blocking.push(zt);   // evidence zero-tolerance classes are blocking
  const review = evaluatorInvalid || dims.some((d) => d.status === QA_STATUS.HUMAN_REVIEW) || !safetyReviewOk;
  const anyDimFail = dims.some((d) => d.status === QA_STATUS.FAIL);
  const status = overallStatus({ eligible: true, evidenceStatus: evidence.status, blocking: [...new Set(blocking)], review, judgmentPending, anyDimFail });

  const provenance = makeProvenance({ design_spec, rendered_artifact, layout_plan, evaluator, evidence });
  provenance.panel_index = panel_index;
  provenance.evaluator = evaluator ? { provider: evaluator.provider ?? "unknown", model: evaluator.model ?? "unknown", live: evaluator.live === true, version: evaluator.version ?? null } : null;

  return {
    status, eligible: true, not_eligible_reasons: [],
    dimensions: dims,
    evidence_authorization: evidence,
    blocking_failures: [...new Set(blocking)],
    diagnostics,
    human_review_required: status === OVERALL_STATUS.REVIEW_REQUIRED,
    judgment_run: Object.keys(results).length > 0 && !evaluatorInvalid,
    evaluator: provenance.evaluator,
    panel_index,
    provenance,
  };
}

function makeProvenance({ design_spec, rendered_artifact, layout_plan, evaluator, evidence }) {
  return {
    qa_version: SOCIAL_GRAPHIC_QA_VERSION,
    design_id: design_spec?.design_id ?? null,
    angle_id: design_spec?.angle_id ?? null,
    asset_brief_id: design_spec?.asset_brief_id ?? null,
    product_id: design_spec?.product_id ?? null,
    truth_refs: [...new Set([...(design_spec?.provenance?.truth_refs || []), ...(evidence?.truth_refs || [])])],
    evidence_refs: [...new Set(evidence?.evidence_refs || [])],
    visual_grounding_ref: design_spec?.provenance?.visual_grounding_id ?? design_spec?.visual_grounding_id ?? null,
    platform_profile: rendered_artifact?.platform_profile ?? (design_spec?.provenance?.profile_id ? { profile_id: design_spec.provenance.profile_id, profile_version: design_spec.provenance.profile_version } : null),
    layout_plan_id: layout_plan?.layout_plan_id ?? null,
    artifact: { asset_type: rendered_artifact?.asset_type ?? design_spec?.asset_type ?? null, platform_format: design_spec?.platform_format ?? null },
    evaluator: evaluator ? { provider: evaluator.provider ?? "unknown", model: evaluator.model ?? "unknown", live: evaluator.live === true, version: evaluator.version ?? null } : null,
  };
}

/**
 * Evaluate a whole multi-panel asset: per-panel QA + sequence-level checks. A failed panel is never
 * dropped, a zero-tolerance panel failure fails the whole asset.
 */
export function evaluateSocialGraphicAsset(input = {}) {
  const { design_spec = {}, rendered_artifact = {}, panel_results = [], evaluator = null, evidence_context = {}, truth_context = {}, deterministic_checks = [] } = input;
  const assetType = rendered_artifact.asset_type ?? design_spec.asset_type;
  const isMulti = assetType === "SOCIAL_CAROUSEL" || assetType === "SOCIAL_STORY_SEQUENCE";

  if (!isMulti) {
    const single = evaluateSocialGraphic({ ...input, rendered_artifact: { ...rendered_artifact, asset_type: "SOCIAL_STATIC" } });
    return { ...single, asset_type: "SOCIAL_STATIC", panels: [], sequence_checks: [] };
  }

  const slides = design_spec.slides || [];
  const panels = (panel_results.length ? panel_results : slides).map((p, i) => {
    const slide = slides[i] ?? {};
    const panelSpec = {
      ...design_spec,
      asset_type: "SOCIAL_STATIC",
      content_pattern: slide.content_pattern ?? design_spec.content_pattern,
      layout_family: slide.layout_family ?? design_spec.layout_family,
      copy_blocks: slide.copy_blocks ?? design_spec.copy_blocks,
      visual_slots: slide.visual_slots ?? [],
      evidence_requirements: design_spec.evidence_requirements ?? [],
      // a panel is evaluated as a single-panel design: the parent's slides must not leak other
      // panels' content patterns / evidence burdens into this panel's authorization
      slides: undefined, slide_count: undefined, continuity_group: undefined,
    };
    const pr = evaluateSocialGraphic({
      design_spec: panelSpec, rendered_artifact: { ...(p.rendered_artifact ?? rendered_artifact), asset_type: "SOCIAL_STATIC" },
      deterministic_checks: p.deterministic_checks ?? [], evidence_context, truth_context,
      evaluator: p.evaluator ?? evaluator, layout_plan: p.layout_plan ?? null, panel_index: i + 1,
    });
    return { ...pr, slide_index: slide.slide_index ?? i + 1, sequence_role: slide.sequence_role ?? null };
  });

  const sequence_checks = [
    { check: "panels_present", pass: panels.length === slides.length, detail: `${panels.length}/${slides.length}` },
    { check: "cover_present", pass: slides.some((s) => s.sequence_role === "COVER"), detail: "COVER panel" },
    { check: "act_present", pass: slides.some((s) => s.sequence_role === "ACT"), detail: "ACT panel" },
    { check: "panel_order_preserved", pass: panels.every((p, i) => p.slide_index === i + 1), detail: "1-based ascending" },
    { check: "brand_continuity", pass: new Set(panels.map((p) => p.provenance.qa_version)).size === 1, detail: "single QA version" },
    { check: "evidence_authorized_per_panel", pass: panels.every((p) => p.evidence_authorization.status !== EVIDENCE_STATUS.FAIL), detail: "no panel evidence failure" },
  ];

  const blocking = [...new Set(panels.flatMap((p) => p.blocking_failures))];
  const anyEvidenceFail = panels.some((p) => p.evidence_authorization.status === EVIDENCE_STATUS.FAIL);
  const anyNotEligible = panels.some((p) => p.status === OVERALL_STATUS.NOT_ELIGIBLE);
  const judgmentPending = panels.some((p) => p.status === OVERALL_STATUS.JUDGMENT_REQUIRED);
  const review = panels.some((p) => p.status === OVERALL_STATUS.REVIEW_REQUIRED) || !sequence_checks.every((c) => c.pass);
  const status = anyNotEligible ? OVERALL_STATUS.NOT_ELIGIBLE
    : (blocking.length || anyEvidenceFail || panels.some((p) => p.status === OVERALL_STATUS.FAIL)) ? OVERALL_STATUS.FAIL
      : review ? OVERALL_STATUS.REVIEW_REQUIRED
        : judgmentPending ? OVERALL_STATUS.JUDGMENT_REQUIRED : OVERALL_STATUS.PASS;

  return {
    status, eligible: !anyNotEligible, asset_type: assetType,
    panel_count: panels.length, panels, sequence_checks,
    blocking_failures: blocking,
    diagnostics: panels.flatMap((p) => p.diagnostics).concat(sequence_checks.filter((c) => !c.pass).map((c) => ({ diagnostic: "SEQUENCE_CHECK_FAILED", detail: c.check }))),
    evidence_authorization: { status: anyEvidenceFail ? EVIDENCE_STATUS.FAIL : panels.every((p) => p.evidence_authorization.status === EVIDENCE_STATUS.NOT_REQUIRED) ? EVIDENCE_STATUS.NOT_REQUIRED : EVIDENCE_STATUS.PASS },
    human_review_required: status === OVERALL_STATUS.REVIEW_REQUIRED,
    judgment_run: panels.some((p) => p.judgment_run),
    dimensions: [],
    provenance: { ...panels[0].provenance, qa_version: SOCIAL_GRAPHIC_QA_VERSION, panel_count: panels.length },
  };
}
