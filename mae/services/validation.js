// MAE · AngleValidationService (S4). The hard strategic gate. Criterion 2 (Proof) and Criterion 4
// (Brand) are hard blockers; Red is retained, never deleted.
import { save, all, MAE_DIR } from "../lib/store.js";
import { validate } from "../lib/schema.js";
import { makeId, existingIds } from "../lib/ids.js";
import { join } from "node:path";
import { CustomerRealityService } from "./crf.js";
import { MarketIntelligenceService } from "./mif.js";
import { TruthService } from "./truth.js";
import { BrandTruthService } from "./brand.js";

const VAL_DIR = join(MAE_DIR, "data", "validations");
const SENSITIVE_DOMAINS = ["health", "grief", "financial_hardship", "family_conflict", "clinical", "medical"];

function deriveCriteria(angle, opts = {}) {
  const crfs = (angle.tier3.source_evidence || []).map((e) => CustomerRealityService.get(e.ref_id)).filter(Boolean);
  const esState = angle.tier1.emotional_stake.evidence_status;
  const corroborated = ["directly_stated", "strongly_evidenced"].includes(esState) ||
    crfs.some((c) => ["directly_stated", "strongly_evidenced"].includes(c.evidence_status));

  // C1 Customer Resonance
  const highFreq = (angle.tier3.source_evidence || []).some((e) => /high|very_high/i.test(e.evidence_weight || "") && !/single/i.test(e.observed_frequency || ""));
  let c1 = highFreq && corroborated ? "strong"
    : ((angle.tier3.source_evidence || []).some((e) => /medium/i.test(e.evidence_weight || "")) || crfs.length) ? "moderate" : "weak";

  // C2 Proof Availability vs Product Truth.
  // Product Truth is a DERIVED reference, not a persisted authority: prefer the authoritative factory
  // projection supplied to this transaction; fall back to the persisted truth store. A reference that
  // neither the transaction supplies nor the store carries cannot be substantiated -> weak_fail (never bypassed).
  const ptr = TruthService.resolveProductTruth(angle.tier3.product_truth_ref, opts.product_truth);
  let c2 = "weak_fail";
  if (ptr) {
    const text = `${angle.tier2.angle} ${angle.tier2.insight.text}`.toLowerCase();
    const prohibited = (ptr.prohibited_claims || []).map((p) => String(p).toLowerCase());
    const violates = prohibited.some((p) => text.includes(p)) ||
      /\b(guarantee[sd]?|cure[sd]?|heal in \d+ (days?|weeks?)|instantly|100%|permanent(ly)?)\b/.test(text);
    const hasEvidence = (ptr.evidence || []).length > 0 || (ptr.proof_inventory || []).length > 0;
    c2 = violates ? "weak_fail" : (ptr.mechanism && ptr.mechanism.core_mechanism && hasEvidence ? "strong" : "moderate");
  }

  // C3 Market Differentiation
  const mifs = (angle.tier3.market_truth_support || []).map((m) => MarketIntelligenceService.get(m.ref_id)).filter(Boolean);
  const isCliche = mifs.some((m) => m.category === "cliche") || /\b(everyone|most women|nobody talks about|in today's)\b/i.test(angle.tier2.angle);
  const twoFile = mifs.length >= 1 && crfs.length >= 1;
  const c3 = isCliche ? "weak" : (twoFile ? "strong" : "moderate");

  // C4 Brand Alignment
  let c4 = "pass";
  try {
    const reg = BrandTruthService.writingRegister();
    const text = `${angle.tier2.angle} ${angle.tier2.insight.text}`.toLowerCase();
    if (reg.forbidden_phrases.some((p) => text.includes(String(p).toLowerCase()))) c4 = "fail";
    else if ((BrandTruthService.prohibitedBehaviours() || []).some((b) => text.includes(String(b).toLowerCase()))) c4 = "fail";
    else if ((angle.tags || []).some((t) => SENSITIVE_DOMAINS.includes(t))) c4 = "conditional_pass";
  } catch { c4 = "conditional_pass"; }

  return { criteria: { customer_resonance: c1, proof_availability: c2, market_differentiation: c3, brand_alignment: c4, platform_fitness: "broad_fit" }, corroborated };
}

export const AngleValidationService = {
  nextId(scope, existing = existingIds(VAL_DIR)) { return makeId("validation", scope, existing); },

  evaluate(angle, opts = {}) {
    const derived = deriveCriteria(angle, opts);
    const criteria = opts.criteria ? { ...derived.criteria, ...opts.criteria } : derived.criteria;
    if (opts.platform_fitness) criteria.platform_fitness = opts.platform_fitness;
    const corroborated = Object.prototype.hasOwnProperty.call(opts, "corroborated") ? opts.corroborated : derived.corroborated;

    const isRed = criteria.proof_availability === "weak_fail" || criteria.brand_alignment === "fail" ||
      (criteria.customer_resonance === "weak" && !corroborated);
    // C5: Broad Fit OR (Narrow Fit WITH a defined scope) → Green-eligible. Poor Fit → Yellow.
    // Narrow Fit without a defined scope → Yellow.
    let c5Yellow = criteria.platform_fitness === "poor_fit" ||
      (criteria.platform_fitness === "narrow_fit" && !opts.scope_note);
    const isYellow = !isRed && (
      criteria.customer_resonance === "weak" || criteria.market_differentiation === "weak" || c5Yellow);
    const verdict = isRed ? "RED" : isYellow ? "YELLOW" : "GREEN";

    const sensitive = opts.sensitive_domain === true || (angle.tags || []).some((t) => SENSITIVE_DOMAINS.includes(t));
    const human_review_required = opts.faith_declaration === true || sensitive ||
      opts.crf_status === "developing" || Object.values(criteria).some((v) => v === "moderate");
    let human_reason = null;
    if (opts.faith_declaration) human_reason = "faith-inflected declaration (Section 3.10.7)";
    else if (sensitive) human_reason = "sensitive domain";
    else if (opts.crf_status === "developing") human_reason = "CRF status: developing";
    else if (Object.values(criteria).some((v) => v === "moderate")) human_reason = "criterion rated moderate";

    const record = {
      id: opts.id || this.nextId(angle.id.replace(/^ANG-/, "").split("-").slice(0, 2).join("-") || "GEN"),
      class: "angle_validation_record",
      angle_id: angle.id,
      criteria,
      verdict,
      scope_note: opts.scope_note ?? null,
      max_assets: verdict === "RED" ? 0 : verdict === "YELLOW" ? 6 : (opts.max_assets ?? null),
      approved_platforms: opts.approved_platforms || ["whatsapp", "instagram", "tiktok", "facebook", "x", "email"],
      excluded_platforms: opts.excluded_platforms || [],
      restrictions: opts.restrictions || [],
      yellow_reason: verdict === "YELLOW" ? (opts.yellow_reason || this.yellowReason(criteria)) : null,
      human_review_required,
      human_review_reason: human_reason,
      counter_evidence_restatement: opts.counter_evidence_restatement || angle.tier3.counter_evidence_acknowledged,
      rejection_reason: verdict === "RED" ? (opts.rejection_reason || this.redReason(criteria, corroborated)) : null,
      evidence_gap: verdict === "RED" ? (opts.evidence_gap || "review criteria and evidence") : null,
      reviewer: opts.reviewer || "system",
      created_at: new Date().toISOString(),
    };
    validate("angle-validation-record.schema.json", record, record.id);
    if (opts.persist !== false) save("validations", record);
    return record;
  },

  yellowReason(c) {
    const r = [];
    if (c.customer_resonance === "weak") r.push("customer resonance weak");
    if (c.market_differentiation === "weak") r.push("market differentiation weak (known cliché)");
    if (c.platform_fitness === "narrow_fit") r.push("narrow platform fit");
    if (c.platform_fitness === "poor_fit") r.push("poor platform fit (long-form only)");
    return `Restricted fan-out: ${r.join("; ")}`;
  },
  redReason(c, corroborated) {
    if (c.proof_availability === "weak_fail") return "Criterion 2: product cannot substantiate the claim as framed";
    if (c.brand_alignment === "fail") return "Criterion 4: violates a Tier 1 Brand Truth constraint";
    if (c.customer_resonance === "weak" && !corroborated) return "Criterion 1: weak resonance with no corroboration";
    return "rejected";
  },
  get(id) { return all("validations").find((v) => v.id === id) || null; },
  byAngle(angle_id) { return all("validations").filter((v) => v.angle_id === angle_id).pop() || null; },
};
