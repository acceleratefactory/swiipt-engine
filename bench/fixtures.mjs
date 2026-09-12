// Swiipt · benchmark fixtures + task builder (synthetic only — never production Truth).
// Reuses the MAE synthetic fixtures and the Writing Constitution. Builds:
//   · one fixed generation task (system + user + JSON schema + constraints)
//   · a fixed set of controlled critic cases with known defects.
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCsecAngle } from "../mae/harness/fixtures.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => JSON.parse(readFileSync(join(root, ...p), "utf8"));

export const BENCH_ASSET_SCHEMA = read("bench", "schemas", "bench-asset.schema.json");
export const REQUIRED_FIELDS = BENCH_ASSET_SCHEMA.required;

/** Load the fixed synthetic benchmark fixture set. */
export function loadBenchFixture() {
  return {
    id: "BENCH-CSEC-001",
    synthetic: true,
    note: "Synthetic fixtures only — never production Truth.",
    product_truth: read("mae", "data", "fixtures", "product-truth", "PTR-CSEC-001.json"),
    customer_truth: [
      read("mae", "data", "fixtures", "customer-reality", "CRF-CSEC-014.json"),
      read("mae", "data", "fixtures", "customer-reality", "CRF-CSEC-021.json"),
      read("mae", "data", "fixtures", "customer-reality", "CRF-CSEC-033.json"),
    ],
    market_truth: [
      read("mae", "data", "fixtures", "market-intelligence", "MIF-CSEC-011.json"),
      read("mae", "data", "fixtures", "market-intelligence", "MIF-CSEC-017.json"),
    ],
    brand_truth: read("mae", "data", "brand-truth.json"),
    writing_constitution: read("config", "writing-control.v1.json").constitution,
    angle: buildCsecAngle(),
  };
}

const GENERATION_SYSTEM = [
  "You are the Swiipt marketing generator operating under the Swiipt Writing Constitution.",
  "Produce ONE customer-facing marketing asset as a single JSON object.",
  "Use ONLY the facts present in the provided truth. Never invent claims, statistics, testimonials, experts, studies, timelines or outcomes.",
  "Never claim more than Product Truth supports; respect prohibited_claims and safety boundaries.",
  "Stay specific to THIS customer situation, scene, mechanism and desired change (do not write generic copy).",
  "Follow the Writing Constitution: no banned phrases, no motivational filler, no fake empathy, plain direct sentences.",
  "Return JSON ONLY (no markdown fences) matching the required fields exactly.",
].join(" ");

/** Build the fixed generation task (same input for every candidate). */
export function buildGenerationTask(fx) {
  const ptr = fx.product_truth;
  const brand = fx.brand_truth;
  const user = JSON.stringify({
    task: "Write one WhatsApp broadcast asset for the given validated Angle Record.",
    product_truth: {
      situation: ptr.situation, promise: ptr.promise, mechanism: ptr.mechanism,
      permitted_claims: ptr.permitted_claims, prohibited_claims: ptr.prohibited_claims,
      safety: ptr.safety, evidence: ptr.evidence,
    },
    customer_truth: fx.customer_truth.map((c) => ({ id: c.id, person: c.person, situation: c.situation, trigger: c.trigger, exact_language: c.exact_language, fear: c.fear, emotional_stake: c.emotional_stake, desired_change: c.desired_change, evidence_status: c.evidence_status })),
    market_truth: fx.market_truth.map((m) => ({ id: m.id, category: m.category, statement: m.statement, evidence_status: m.evidence_status, scan_coverage_note: m.scan_coverage_note })),
    brand_truth: { voice_dna: brand.voice_dna, boundaries: brand.boundaries, vocabulary: brand.vocabulary, trust_safety: brand.trust_safety },
    writing_constitution: fx.writing_constitution,
    angle: fx.angle,
    required_fields: REQUIRED_FIELDS,
    output_contract: BENCH_ASSET_SCHEMA,
    constraints: { audience: "WhatsApp (concise, one thought per line)", max_body_words: 120, cta_style: "Reply YES (no \u201cclick the link\u201d)", no_hashtags: true, json_only: true },
  });
  return { system: GENERATION_SYSTEM, user, schema: BENCH_ASSET_SCHEMA, required_fields: REQUIRED_FIELDS, max_body_words: 120 };
}

/**
 * Controlled critic cases with KNOWN defects. One valid control. Synthetic only.
 * expect_defect: whether a competent critic MUST flag it. expect_severity: "BLOCKER" for hard defects.
 */
export function buildCriticCases(fx) {
  const base = { angle_id: fx.angle.id, platform: "whatsapp", situation: "Day 6 after a C-section, standing at 3 AM.", evidence_note: "Educational content - not medical advice.", risk_flags: [] };
  const ctx = { product_truth: fx.product_truth, customer_truth: fx.customer_truth, market_truth: fx.market_truth, angle: fx.angle, required_fields: REQUIRED_FIELDS };
  const asset = (over) => ({ ...base, headline: "", body: "", cta: "Reply YES", mechanism: "Module 2 - The 3-Position Recovery Method", ...over });
  return [
    { id: "valid-control", defect_type: "none", expect_defect: false, expect_severity: "none",
      payload: { asset: asset({ headline: "Nobody tells you what standing up feels like on day 6.", body: "At 3 AM, with the baby finally asleep, she has to stand up. Module 2 - the 3-Position Recovery Method - helps her position and rise without straining the incision. \u201cI was scared to even stand up,\u201d one mother told us. Reply YES and I'll send you the details." }), context: ctx } },
    { id: "generic-interchangeable", defect_type: "interchangeable_copy", expect_defect: true, expect_severity: "BLOCKER",
      payload: { asset: asset({ headline: "You are not alone.", body: "Take it one step at a time. You are stronger than you know, and you will get through this.", mechanism: "self-care" }), context: ctx } },
    { id: "invented-evidence", defect_type: "invented_evidence", expect_defect: true, expect_severity: "BLOCKER",
      payload: { asset: asset({ headline: "Day 6, and 1,200 mothers agree.", body: "A 2024 Lagos study of 1,200 mothers proved that this positioning method heals incisions faster. Daily practice guarantees results within 48 hours." }), context: ctx } },
    { id: "unsupported-emotional-claim", defect_type: "unsupported_emotional_claim", expect_defect: true, expect_severity: "BLOCKER",
      payload: { asset: asset({ headline: "You will feel calm by tomorrow.", body: "Every mother feels exactly this fear. You will definitely feel calm and confident by day 2." }), context: ctx } },
    { id: "product-truth-contradiction", defect_type: "product_truth_contradiction", expect_defect: true, expect_severity: "BLOCKER",
      payload: { asset: asset({ headline: "This treats infection.", body: "This heals your incision and treats infection. You will heal faster than with standard care." }), context: ctx } },
    { id: "wrong-mechanism", defect_type: "wrong_mechanism", expect_defect: true, expect_severity: "BLOCKER",
      payload: { asset: asset({ headline: "Try the 5-position breathing method.", body: "Use the Module 7 five-position breathing method to push through the pain at day 6.", mechanism: "Module 7 - five-position breathing" }), context: ctx } },
    { id: "anti-slop-phrase", defect_type: "anti_slop_phrase", expect_defect: true, expect_severity: "BLOCKER",
      payload: { asset: asset({ headline: "Unlock your potential.", body: "In today's fast-paced world, embark on a journey and transform your life. You've got this." }), context: ctx } },
    { id: "platform-mismatch", defect_type: "platform_mismatch", expect_defect: true, expect_severity: "BLOCKER",
      payload: { asset: asset({ headline: "A long-form email pasted into WhatsApp.", body: "## Introduction\n\nDear reader, " + "please read the full article below and click the link. ".repeat(12) + "\n\n#postpartum #csection #recovery #motherhood", cta: "Click here to read more" }), context: ctx } },
    { id: "missing-required-fields", defect_type: "missing_required_fields", expect_defect: true, expect_severity: "BLOCKER",
      payload: { asset: { angle_id: fx.angle.id, platform: "whatsapp", headline: "Day 6", body: "", cta: "", mechanism: "", situation: "", evidence_note: "", risk_flags: [] }, context: ctx } },
  ];
}

/** A deliberately strong, fully-grounded output for deterministic-evaluator tests. */
export function goodBenchAsset(fx) {
  return {
    angle_id: fx.angle.id,
    platform: "whatsapp",
    headline: "Nobody tells you what standing up feels like on day 6.",
    body: "At 3 AM, with the baby finally asleep, she has to stand up.\nModule 2 - the 3-Position Recovery Method - helps her position and rise without straining the incision.\n\u201cI was scared to even stand up,\u201d one mother said. She held the dresser and waited.\nThis is a system gap, not a personal failing.\nReply YES and I'll send you the details.",
    cta: "Reply YES and I'll send you the details.",
    mechanism: "Module 2 - The 3-Position Recovery Method",
    situation: "Day 6 after a C-section: standing up from bed at 3 AM pulls and burns at the incision.",
    evidence_note: "Educational content - not medical, clinical, or mental-health advice.",
    risk_flags: [],
  };
}
