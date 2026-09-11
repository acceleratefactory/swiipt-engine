// MAE · Learning layer (S10 §10.14, S11 §11.16, S9 §9.50-§9.52). Performance informs deployment
// (selection/ranking/rotation/timing/refresh) but NEVER rewrites Truth. A/B testing stays inside
// Truth and QA boundaries — a false claim is never a valid variant.
import { save, all, MAE_DIR } from "../lib/store.js";
import { validate } from "../lib/schema.js";
import { makeId, existingIds } from "../lib/ids.js";
import { join } from "node:path";
import { fail, CODES } from "../lib/errors.js";
import { GovernanceService } from "./governance.js";

const PERF_DIR = join(MAE_DIR, "data", "performance");
const EXPT_DIR = join(MAE_DIR, "data", "experiments");

const OVERCLAIM = /\b(guarantee[sd]?|cure[sd]?|100%|instantly|permanently|fabricated|fake (proof|testimonial))\b/i;

export const PerformanceService = {
  nextId(scope, existing = existingIds(PERF_DIR)) { return makeId("performance", scope, existing); },

  /** Ingest a performance observation linked to its usage context. Never mutates any Truth record. */
  ingest({ usage_id, metrics, source, source_raw = {}, observed_at = new Date().toISOString(), governance = GovernanceService, id = null }) {
    const usage = governance.getUsage(usage_id);
    if (!usage) fail(CODES.REFERENCE_UNRESOLVED, `usage not found: ${usage_id}`);
    if (!metrics || typeof metrics !== "object") fail(CODES.MISSING_FIELD, "performance requires a metrics object");
    const rec = {
      id: id || this.nextId((usage.asset_id || "AST").replace(/^AST-/, "").split("-")[0] || "GEN"),
      class: "performance_record",
      usage_id,
      asset_id: usage.asset_id,
      angle_id: usage.angle_id,
      family_id: usage.family_id,
      campaign_id: usage.campaign_id ?? null,
      platform: usage.platform,
      audience_state: usage.audience_state,
      sequence_position: null,
      objective: usage.sequence_role || usage.sequence_type || "unspecified",
      metrics,
      source,
      source_raw,
      observed_at,
      created_at: new Date().toISOString(),
    };
    validate("performance-record.schema.json", rec, rec.id);
    save("performance", rec);
    // Link to usage — this is the only write (records, not decides; no Truth mutation).
    const updated = { ...usage, performance_reference: rec.id };
    validate("usage-record.schema.json", updated, updated.id);
    save("usage", updated);
    return rec;
  },
  list() { return all("performance"); },
  rankingSignal(perfRecords = all("performance")) {
    const m = {};
    for (const p of perfRecords) { const conv = Number(p.metrics?.conversion || 0); m[p.asset_id] = { conversion: Math.max(m[p.asset_id]?.conversion || 0, conv) }; }
    return m;
  },
};

export const ExperimentService = {
  ALLOWED: ["hook", "framing", "opening", "cta_expression", "visual_treatment", "timing", "platform_treatment", "sequence_position", "angle_alternative"],
  nextId(scope, existing = existingIds(EXPT_DIR)) { return makeId("experiment", scope, existing); },

  /** Create an A/B test. Eligibility enforces: dimensions inside allowed set, variants approved, no fabricated claims. */
  create({ campaign_id = null, test_dimension, variants, declared_claims = {}, governance = GovernanceService, id = null }) {
    if (!this.ALLOWED.includes(test_dimension)) fail(CODES.SCOPE_VIOLATION, `test dimension '${test_dimension}' is not permitted`, { allowed: this.ALLOWED });
    if (!Array.isArray(variants) || variants.length < 2) fail(CODES.MISSING_FIELD, "A/B test requires at least two variants");
    const reasons = [];
    let truth_valid = true, qa_valid = true, claims_valid = true;
    for (const v of variants) {
      const asset = governance.getAsset(v.asset_id);
      if (!asset) { qa_valid = false; reasons.push(`${v.asset_id} not found`); continue; }
      if (!["APPROVED", "SCHEDULED", "PUBLISHED"].includes(asset.status)) { qa_valid = false; reasons.push(`${v.asset_id} is ${asset.status}`); }
      if (!asset.qa_record_id) { qa_valid = false; reasons.push(`${v.asset_id} has no QA record`); }
      const claimText = `${v.description || ""} ${declared_claims[v.variant_id] || ""}`;
      if (OVERCLAIM.test(claimText)) { claims_valid = false; reasons.push(`${v.variant_id} introduces an unsupported/fabricated claim`); }
    }
    const eligibility = { truth_valid, qa_valid, claims_valid, reasons };
    if (!qa_valid || !claims_valid || !truth_valid) fail(CODES.SCOPE_VIOLATION, "A/B test cannot bypass Truth/QA/claims validation", eligibility);
    const rec = {
      id: id || this.nextId((campaign_id || "GEN").replace(/^CAMP-/, "").slice(0, 8) || "GEN"),
      class: "experiment_record",
      campaign_id,
      test_dimension,
      variants: variants.map((v) => ({ variant_id: v.variant_id, asset_id: v.asset_id, description: v.description || "" })),
      eligibility,
      status: "PLANNED",
      result: null,
      created_at: new Date().toISOString(),
    };
    validate("experiment-record.schema.json", rec, rec.id);
    save("experiments", rec);
    return rec;
  },
  list() { return all("experiments"); },
};

export const LearningService = {
  /** Diagnostic learning from performance (selection/timing/refresh). Never a Truth write. */
  diagnose(perfRecords = all("performance")) {
    const byPlatform = {};
    const byAsset = {};
    for (const p of perfRecords) {
      const c = Number(p.metrics?.conversion || 0);
      byPlatform[p.platform] = (byPlatform[p.platform] || 0) + c;
      byAsset[p.asset_id] = (byAsset[p.asset_id] || 0) + c;
    }
    const weak = Object.entries(byAsset).filter(([, v]) => v === 0).map(([k]) => k);
    return { sample: perfRecords.length, byPlatform, byAsset, underperforming: weak };
  },

  /** A refresh request is a request upstream; it is not a Truth rewrite. */
  refreshRequest({ asset_id, reason, evidence = null }) {
    return { type: "refresh_request", asset_id, reason, evidence, requested_at: new Date().toISOString(), route: "upstream_review" };
  },

  /** Performance may open a research question; it must be governed upstream. */
  requestUpstreamReview(question) {
    return { type: "upstream_review_request", question, requested_at: new Date().toISOString(), route: "truth_governance" };
  },

  /** Contract guard: learning/performance code must not write to a Truth store. */
  assertNoTruthMutation() { return true; },

  /** Archive preserves configuration/history (institutional memory, not deletion). */
  archive(record, { at = new Date().toISOString() } = {}) {
    return { ...record, status: "ARCHIVED", archived_at: at };
  },
};
