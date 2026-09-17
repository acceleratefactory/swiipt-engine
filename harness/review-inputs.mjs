// NARROW REVIEW INPUTS — the exact canonical material each human review authority owns.
//
// Why this module is separate: both the REVIEW WORKFLOW (job derivation, staleness) and the GATE
// RUNNER (authority + freshness checks) must compute the SAME input hash. Putting it in a pure module
// keeps the gate runner authoritative without a circular dependency.
//
// Narrow by design (task section 31): a review is bound only to the material its authority owns.
//   g4 evidence : the evidence-dependent claims and their sources
//   g5 safety   : safety boundaries, red flags, escalation routes, safety guardrails
//   g9 journey  : the customer journey surfaces actually walked
// A marketing/asset/README change must NOT invalidate a clinical review.
import { createHash } from "node:crypto";

export const REVIEW_INPUT_VERSION = "1.0";

export const AUTHORITIES = Object.freeze({
  g4_evidence: "EVIDENCE_AUTHORITY",
  g5_safety: "CLINICAL_AUTHORITY",
  g9_journey: "JOURNEY_AUTHORITY",
});

export function stableStringify(value) {
  const seen = new WeakSet();
  const walk = (v) => {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v)) return "[circular]";
    seen.add(v);
    if (Array.isArray(v)) return v.map(walk);
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = walk(v[k]);
    return out;
  };
  return JSON.stringify(walk(value));
}

export const sha256 = (text) => createHash("sha256").update(String(text), "utf8").digest("hex");
export const hashInput = (obj) => sha256(stableStringify(obj));

/** The claim inventory the evidence authority reviews (canonical order, canonical IDs). */
export function claimInventory(product, transformation) {
  const out = [];
  let n = 0;
  const push = (claim, label, location, category) => {
    if (!claim || typeof claim !== "string" || !claim.trim()) return;
    n += 1;
    out.push({ claim_id: `C-${String(n).padStart(2, "0")}`, claim: claim.trim(), label: label ?? null, location, category });
  };
  for (const c of product?.evidence?.claim_labels ?? []) push(c?.claim, c?.label, "product.evidence.claim_labels", "product");
  for (const c of transformation?.evidence ?? []) push(c?.claim, c?.status, `${transformation?.transformation_id ?? "transformation"}.evidence`, "transformation");
  for (const c of transformation?.mechanism?.evidence_basis ?? []) push(c?.claim, c?.status, `${transformation?.transformation_id ?? "transformation"}.mechanism.evidence_basis`, "mechanism");
  for (const c of transformation?.safety?.red_flags ?? []) push(`Red flag: ${c}`, "clinical_fact", `${transformation?.transformation_id ?? "transformation"}.safety.red_flags`, "safety");
  for (const c of transformation?.safety?.escalation_rules ?? []) push(`Escalation rule: ${c}`, "clinical_fact", `${transformation?.transformation_id ?? "transformation"}.safety.escalation_rules`, "safety");
  return out;
}

/** The safety item inventory the clinical authority reviews. */
export function safetyInventory(product, transformation) {
  const out = [];
  let n = 0;
  const push = (content, risk_domain, location, extra = {}) => {
    if (!content || typeof content !== "string" || !content.trim()) return;
    n += 1;
    out.push({ item_id: `S-${String(n).padStart(2, "0")}`, content: content.trim(), risk_domain, location, ...extra });
  };
  const s = product?.safety ?? {};
  push(s.disclaimer, "scope/disclaimer", "product.safety.disclaimer");
  for (const f of s.red_flags ?? []) push(f, "maternal mental-health / safety", "product.safety.red_flags");
  for (const r of s.escalation_rules ?? []) push(r, "escalation", "product.safety.escalation_rules");
  push(transformation?.safety?.scope_boundary, "scope boundary", `${transformation?.transformation_id ?? "transformation"}.safety.scope_boundary`);
  for (const r of transformation?.safety?.escalation_rules ?? []) push(r, "threshold", `${transformation?.transformation_id ?? "transformation"}.safety.escalation_rules`);
  return out;
}

/**
 * The 20-question journey checklist is canonical governance (publishing-gates-standard section 2 gate 9
 * + the discover→…→next-transformation flow). It is versioned here once; every product binds the SAME
 * questions to its OWN canonical artifacts - no per-product checklist.
 */
export const JOURNEY_REVIEW_CHECKLIST_VERSION = "1.0";
export const JOURNEY_CHECKLIST = Object.freeze([
  { n: 1, question: "Can the intended person recognize this is for her?", artifacts: ["identity.name", "identity.subtitle", "identity.one_line_promise", "customer.person"] },
  { n: 2, question: "Is the promise clear?", artifacts: ["transformation.before_state.summary", "transformation.after_state.summary", "identity.one_line_promise"] },
  { n: 3, question: "Does she know what to do first?", artifacts: ["transformation.first_win.action", "asset_map.read", "asset_map.do"] },
  { n: 4, question: "Can the first win happen in the intended timeframe?", artifacts: ["transformation.first_win.within"] },
  { n: 5, question: "Does each step lead naturally to the next?", artifacts: ["transformation.path"] },
  { n: 6, question: "Are instructions executable under the real conditions of the situation?", artifacts: ["asset_map.do", "asset_map.read"] },
  { n: 7, question: "Are the decision tools understandable?", artifacts: ["asset_map.decide"] },
  { n: 8, question: "Are the scripts/customer words usable?", artifacts: ["asset_map.communicate"] },
  { n: 9, question: "Does the mechanism remain coherent throughout?", artifacts: ["transformation.mechanism.core"] },
  { n: 10, question: "Are failure points anticipated?", artifacts: ["transformation.failure_map", "failure_point_map"] },
  { n: 11, question: "Can the customer recover after missing a day/night?", artifacts: ["asset_map.reentry", "transformation.reentry"] },
  { n: 12, question: "Is there an obvious re-entry path?", artifacts: ["asset_map.reentry"] },
  { n: 13, question: "Are unsafe situations routed away from self-management?", artifacts: ["safety.red_flags", "safety.escalation_rules", "asset_map.rescue"] },
  { n: 14, question: "Can the customer recognize progress?", artifacts: ["tsm", "asset_map.track"] },
  { n: 15, question: "Can the customer recognize completion/success?", artifacts: ["tsm.success_criteria", "tsm.measurement_days"] },
  { n: 16, question: "Does maintenance exist?", artifacts: ["maintenance", "transformation.maintenance"] },
  { n: 17, question: "Is the next Transformation clear without manipulative upselling?", artifacts: ["transformation.next_transformation_ids"] },
  { n: 18, question: "Are any parts redundant or conflicting?", artifacts: ["asset_map"] },
  { n: 19, question: "Is anything materially missing?", artifacts: ["asset_map", "transformation.path"] },
  { n: 20, question: "Would the complete journey plausibly deliver the specified transformation?", artifacts: ["content", "publishing.wordpress_ids"] },
]);

/** NARROW g4 projection: the claims + their sources only. */
export function evidenceReviewInput(product, transformation) {
  return {
    review_input_version: REVIEW_INPUT_VERSION,
    product_id: product?.product_id ?? null,
    transformation_id: transformation?.transformation_id ?? product?.identity?.transformation_id ?? null,
    claim_inventory: claimInventory(product, transformation),
    declared_sources: product?.evidence?.sources ?? [],
    evidence_review_status: product?.evidence?.review_status ?? null,
  };
}

/** NARROW g5 projection: safety inputs only. */
export function safetyReviewInput(product, transformation) {
  return {
    review_input_version: REVIEW_INPUT_VERSION,
    product_id: product?.product_id ?? null,
    transformation_id: transformation?.transformation_id ?? product?.identity?.transformation_id ?? null,
    risk_level: product?.safety?.risk_level ?? null,
    safety_items: safetyInventory(product, transformation),
    product_safety: {
      disclaimer: product?.safety?.disclaimer ?? null,
      red_flags: product?.safety?.red_flags ?? [],
      escalation_rules: product?.safety?.escalation_rules ?? [],
    },
    transformation_safety: {
      risk_level: transformation?.safety?.risk_level ?? null,
      scope_boundary: transformation?.safety?.scope_boundary ?? null,
      red_flags: transformation?.safety?.red_flags ?? [],
      escalation_rules: transformation?.safety?.escalation_rules ?? [],
    },
  };
}

/** NARROW g9 projection: the journey surfaces actually walked. */
export function journeyReviewInput(product, transformation) {
  return {
    review_input_version: REVIEW_INPUT_VERSION,
    checklist_version: JOURNEY_REVIEW_CHECKLIST_VERSION,
    product_id: product?.product_id ?? null,
    transformation_id: transformation?.transformation_id ?? product?.identity?.transformation_id ?? null,
    checklist: JOURNEY_CHECKLIST.map((c) => ({ n: c.n, question: c.question })),
    content_refs: product?.content ?? null,
    wordpress_ids: product?.publishing?.wordpress_ids ?? null,
    tsm_measurement_days: transformation?.tsm?.measurement_days ?? product?.tsm?.checkin_days ?? null,
    next_transformation_ids: product?.transformation?.next_transformation_ids ?? [],
    asset_map: product?.asset_map ?? null,
    identity: { name: product?.identity?.name ?? null, one_line_promise: product?.identity?.one_line_promise ?? null },
    first_win: transformation?.first_win ?? product?.transformation?.first_win ?? null,
    path: transformation?.transformation_path ?? product?.transformation?.path ?? null,
  };
}

export const AUTHORITY_INPUT_BUILDERS = Object.freeze({
  g4_evidence: evidenceReviewInput,
  g5_safety: safetyReviewInput,
  g9_journey: journeyReviewInput,
});

/** Compute {input, input_hash} for a gate's authority. */
export function reviewInputFor(gate, product, transformation) {
  const build = AUTHORITY_INPUT_BUILDERS[gate];
  if (!build) return { input: null, input_hash: null };
  const input = build(product, transformation);
  return { input, input_hash: hashInput(input) };
}
