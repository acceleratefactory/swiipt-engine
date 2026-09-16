// MAE · TruthService (S2). Distinct truth stores; evidence state; conflict hierarchy; Truth Weighting.
// Retrieval is by tag/filter (V1) — no vector DB (S11 §71/§72).
import { all, list, findById } from "../lib/store.js";
import { EVIDENCE_RANK, isValidState, assertNoUnsupportedCertainty } from "../lib/evidence.js";
import { fail, CODES } from "../lib/errors.js";
import { BrandTruthService } from "./brand.js";

// Canonical conflict hierarchy (S2 §12 / S3 §3.4): higher index is LOWER authority.
export const CONFLICT_HIERARCHY = ["product", "customer", "brand", "market"];
export const TRUTH_COLLECTIONS = {
  product: "product-truth",
  customer: "customer-reality",
  market: "market-intelligence",
  brand: "brand-truth",
};

// Asset-specific Truth Weighting matrix (S5 §5.2.1). Emphasis only — never authority.
export const WEIGHTING_MATRIX = {
  "Product page (full)": { product: 40, customer: 25, market: 15, brand: 20 },
  "Landing page hero": { product: 30, customer: 30, market: 15, brand: 25 },
  "Problem-led social post": { product: 10, customer: 50, market: 20, brand: 20 },
  "Situation-led social post": { product: 15, customer: 50, market: 15, brand: 20 },
  "Transformation-led social post": { product: 25, customer: 35, market: 15, brand: 25 },
  "Objection-led social post": { product: 20, customer: 30, market: 25, brand: 25 },
  "Educational post": { product: 25, customer: 15, market: 35, brand: 25 },
  "Myth-busting post": { product: 15, customer: 15, market: 45, brand: 25 },
  "Story/emotional post": { product: 5, customer: 55, market: 10, brand: 30 },
  "Email — announcement": { product: 35, customer: 25, market: 15, brand: 25 },
  "Email — problem-deepening": { product: 15, customer: 45, market: 15, brand: 25 },
  "Email — objection-handling": { product: 20, customer: 30, market: 25, brand: 25 },
  "WhatsApp broadcast": { product: 10, customer: 45, market: 10, brand: 35 },
  "WhatsApp Status": { product: 5, customer: 50, market: 10, brand: 35 },
  "Affirmation/Declaration": { product: 5, customer: 60, market: 5, brand: 30 },
  "Video script — 15 sec": { product: 10, customer: 45, market: 15, brand: 30 },
  "Video script — 30 sec": { product: 15, customer: 40, market: 15, brand: 30 },
  "Video script — 60 sec": { product: 25, customer: 35, market: 15, brand: 25 },
  Carousel: { product: 15, customer: 30, market: 25, brand: 30 },
  "Quote/Statistic card": { product: 5, customer: 65, market: 5, brand: 25 },
  "SEO title/meta description": { product: 45, customer: 20, market: 25, brand: 10 },
  "Open Graph image caption": { product: 30, customer: 25, market: 20, brand: 25 },
};

export const TruthService = {
  /** Load truth collections (dedup production+fixtures). */
  loadAll({ includeFixtures = true } = {}) {
    return {
      product: all(TRUTH_COLLECTIONS.product, { includeFixtures }),
      customer: all(TRUTH_COLLECTIONS.customer, { includeFixtures }),
      market: all(TRUTH_COLLECTIONS.market, { includeFixtures }),
      brand: [BrandTruthService.loadBrand()],
    };
  },
  get(truth, id, { includeFixtures = true } = {}) {
    const c = TRUTH_COLLECTIONS[truth];
    if (!c) fail(CODES.REFERENCE_UNRESOLVED, `unknown truth source: ${truth}`);
    return findById(c, id, { scope: "production" }) || (includeFixtures ? findById(c, id, { scope: "test" }) : null);
  },
  /**
   * Resolve a Product Truth reference for a validation/authoring transaction.
   * Canonical model (product-truth-reference.schema.json): a PTR is a READ-ONLY DERIVED PROJECTION of the
   * factory records ("the MAE never shadows Product Truth; it references it") — not an independently
   * persisted authority. It carries no factory fingerprint, so a persisted copy could silently go stale;
   * therefore resolution prefers the AUTHORITATIVE projection supplied to the transaction (a fresh
   * deterministic projection of factory Product Truth) and only then the persisted truth store.
   * Returns null when neither resolves — callers must fail downstream, never fabricate.
   */
  resolveProductTruth(ref_id, supplied = null) {
    if (!ref_id) return null;
    if (supplied && supplied.id === ref_id) return supplied;
    return this.get("product", ref_id);
  },
  /** Query CRF/MIF by tag/filter (S2 §9 — simple tagging/normalisation, no vector DB). */
  query(truth, filter = {}, { includeFixtures = true } = {}) {
    const c = TRUTH_COLLECTIONS[truth];
    return all(c, { includeFixtures }).filter((r) =>
      Object.entries(filter).every(([k, v]) => Array.isArray(v) ? (Array.isArray(r[k]) && v.some((x) => r[k].includes(x))) : r[k] === v));
  },
  /** Refuse synthetic fixtures where production truth is required (owner decision #3). */
  assertProductionSafe(records) {
    const bad = records.filter((r) => r && (r.is_fixture === true || r.provenance === "synthetic_fixture"));
    if (bad.length) fail(CODES.FIXTURE_NOT_PRODUCTION_SAFE, "synthetic fixtures cannot be used as production Truth", { ids: bad.map((r) => r.id) });
    return true;
  },
  /** Resolve a conflict between two truths by authority (S2 §12/§13). Product > Customer > Brand > Market. */
  resolveConflict(a, b) {
    const ia = CONFLICT_HIERARCHY.indexOf(a.source);
    const ib = CONFLICT_HIERARCHY.indexOf(b.source);
    if (ia === -1 || ib === -1) fail(CODES.TRUTH_CONFLICT, "unknown truth source in conflict", { a, b });
    const winner = ia <= ib ? a : b;
    const loser = winner === a ? b : a;
    return { winner, loser, authority: CONFLICT_HIERARCHY[Math.min(ia, ib)],
      resolution: `${winner.source} wins the ${winner.claim_kind || "claim"}` };
  },
  /** Weighting profile for an asset type (S5 §5.2.1); default balanced if unknown. */
  weightingProfile(assetType) {
    return WEIGHTING_MATRIX[assetType] || { product: 25, customer: 25, market: 25, brand: 25 };
  },
  /** Validate a weighting profile: emphasis only, brand rules always at 100%, non-negative. */
  validateWeighting(profile) {
    if (!profile || typeof profile !== "object") fail(CODES.MISSING_FIELD, "weighting profile required");
    const keys = ["product", "customer", "market", "brand"];
    for (const k of keys) {
      if (typeof profile[k] !== "number" || profile[k] < 0 || profile[k] > 100) {
        fail(CODES.VALIDATION_FAILED, `weighting.${k} must be 0–100`, { profile });
      }
    }
    return profile;
  },
  /** Evidence-state guard (a claim must not exceed its source's strength). */
  checkCertainty(sourceState, claimState, promotionSource = null) {
    return assertNoUnsupportedCertainty(sourceState, claimState, promotionSource);
  },
  atLeast(state, min) {
    return isValidState(state) && isValidState(min) && EVIDENCE_RANK[state] >= EVIDENCE_RANK[min];
  },
  /** Promotion history helper (log explicit promotions). */
  promotion(field, from, to, sourceId) {
    return { field, from, to, source: sourceId, at: new Date().toISOString() };
  },
};
