// MAE · AngleService (S3). Builds and completes the Marketing Angle Record (+ 3.10 grounding).
// No asset may be generated without an Angle Record; the Insight is labelled Strategic Synthesis.
import { save, all } from "../lib/store.js";
import { validate } from "../lib/schema.js";
import { makeId, existingIds } from "../lib/ids.js";
import { transition } from "../lib/transition.js";
import { MAE_DIR } from "../lib/store.js";
import { join } from "node:path";
import { fail, CODES } from "../lib/errors.js";
import { CustomerRealityService } from "./crf.js";
import { MarketIntelligenceService } from "./mif.js";
import { TruthService } from "./truth.js";
import { BrandTruthService } from "./brand.js";

const ANGLE_DIR = join(MAE_DIR, "data", "angles");

export const AngleService = {
  nextId(scope, existing = existingIds(ANGLE_DIR)) { return makeId("angle", scope, existing); },

  /** Build an Angle Record from the four truths. Enforces citation + synthesis labelling. */
  build(input) {
    const angle = {
      id: input.id || this.nextId(input.scope || "GEN"),
      class: "marketing_angle_record",
      product_id: input.product_id,
      transformation_id: input.transformation_id ?? null,
      tier1: input.tier1,
      tier2: {
        insight: { text: input.tier2.insight.text, label: "Strategic Synthesis" },
        mechanism: { text: input.tier2.mechanism.text, product_truth_ref: input.tier2.mechanism.product_truth_ref },
        desired_change: input.tier2.desired_change,
        angle: input.tier2.angle,
        asset_purpose: input.tier2.asset_purpose,
      },
      tier3: input.tier3,
      affirmation_grounding: input.affirmation_grounding ?? null,
      restrictions: input.restrictions || [],
      tags: input.tags || [],
      status: "DRAFT",
      provenance: input.provenance || (input.is_fixture ? "synthetic_fixture" : "evidence_backed"),
      is_fixture: !!input.is_fixture,
      created_at: new Date().toISOString(),
      updated_at: null,
    };
    validate("marketing-angle-record.schema.json", angle, angle.id);
    this.assertComplete(angle);
    return angle;
  },

  /** Tier 3 completeness: ≥1 CRF citation, counter-evidence, product truth ref, brand compliance, conflict log. */
  assertComplete(angle) {
    const t3 = angle.tier3 || {};
    if (!Array.isArray(t3.source_evidence) || t3.source_evidence.length < 1) {
      fail(CODES.EVIDENCE_REQUIRED, "Angle requires at least one Customer Reality citation", { angle: angle.id });
    }
    for (const e of t3.source_evidence) {
      if (!CustomerRealityService.get(e.ref_id) && !/^CRF-/.test(e.ref_id)) {
        fail(CODES.REFERENCE_UNRESOLVED, `source_evidence ref does not resolve: ${e.ref_id}`, { angle: angle.id });
      }
    }
    if (!t3.counter_evidence_acknowledged) fail(CODES.MISSING_FIELD, "counter_evidence_acknowledged required", { angle: angle.id });
    if (!t3.product_truth_ref) fail(CODES.MISSING_FIELD, "product_truth_ref required", { angle: angle.id });
    if (!t3.brand_truth_compliance) fail(CODES.MISSING_FIELD, "brand_truth_compliance required", { angle: angle.id });
    if (!Array.isArray(t3.truth_conflict_log)) fail(CODES.MISSING_FIELD, "truth_conflict_log required (log the check even when empty)", { angle: angle.id });
    return true;
  },

  /** Mark evidence-linked → ready for validation. */
  linkEvidence(angle) { return transition("angle", angle, "EVIDENCE_LINKED"); },
  submit(angle) { return transition("angle", angle, "VALIDATION_PENDING"); },
  save(angle, { scope = "production" } = {}) { return save("angles", angle, { scope }); },
  get(id) { return all("angles").find((a) => a.id === id) || null; },

  /** Section 3.10 grounding for affirmations/declarations/motivational quotes. */
  buildAffirmationGrounding(input) {
    const g = { ...input };
    if (!g.id) g.id = null;
    validate("affirmation-grounding.schema.json", g, "affirmation-grounding");
    const GENERIC = ["you are enough", "you are strong", "trust the process", "you've got this", "believe in yourself", "one day at a time", "this too shall pass"];
    const anchor = String(g.anchor_fear_or_constraint || "").toLowerCase().trim();
    if (anchor.length < 20 || GENERIC.some((p) => anchor.includes(p))) {
      fail(CODES.MISSING_FIELD, "affirmation anchor fear/constraint must be specific, not thematic", { anchor: g.anchor_fear_or_constraint });
    }
    if (g.register === "declaration" && g.faith_inflected === true) {
      g.faith_gate = "conditional"; // enforced at generation + QA
    }
    return g;
  },

  /** Whether a source CRF contains faith-inflected language (Section 3.10.7 condition 1). */
  crfHasFaithEvidence(product_id) {
    const crfs = CustomerRealityService.query({ product_id }, { includeFixtures: true });
    return crfs.some((c) => /god|trusting god|by his grace|jesus|pray|faith/i.test(c.exact_language || ""));
  },

  faithRegisterAllowed(product_id) {
    return BrandTruthService.faithRegisterAllowed(product_id, this.crfHasFaithEvidence(product_id));
  },
};
