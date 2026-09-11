// MAE · Day-6 C-section reference fixture (synthetic). Builds ANG-CSEC-006 + its validation.
// Used by Wave B/C/D tests and acceptance scenarios. Never production Truth.
import { AngleService } from "../services/angle.js";
import { AngleValidationService } from "../services/validation.js";
import { AssetArchitectureService } from "../services/architecture.js";
import { GenerationService } from "../services/generation.js";
import { QAOrchestrator } from "../services/qa.js";
import { GovernanceService } from "../services/governance.js";
import { AssetFamilyService } from "../services/family.js";

export function csecAngleInput() {
  return {
    scope: "CSEC",
    product_id: "PROD-CSEC",
    transformation_id: "TR-CSEC",
    is_fixture: true,
    tags: ["csection", "health"],
    tier1: {
      customer: "Nigerian first-time mother, day 6 after C-section, minimal overnight support.",
      scene: "3 AM. Baby finally asleep. She needs to stand up.",
      pain: "Burning/pulling sensation around the incision when attempting to rise from bed.",
      failed_attempt: "Hospital discharge pamphlet advised only 'avoid strain and rest as needed' — no specific technique provided.",
      emotional_stake: {
        text: "Afraid something may be wrong internally, but reluctant to seek further medical contact over something she fears may be dismissed as normal",
        evidence_status: "strongly_evidenced",
      },
    },
    tier2: {
      insight: { text: "She does not need more general recovery information. General advice already failed her twice. What she needs is a specific, actionable response to THIS exact moment." },
      mechanism: { text: "Module 2 — The 3-Position Recovery Method", product_truth_ref: "PTR-CSEC-001" },
      desired_change: "To move — stand, sit, rise — without bracing in anticipatory fear of pain.",
      angle: "Nobody tells you what standing up feels like on day 6.",
      asset_purpose: "stop_scroll_identification",
    },
    tier3: {
      source_evidence: [
        { ref_id: "CRF-CSEC-014", role: "primary", observed_frequency: "14/40", evidence_weight: "high" },
        { ref_id: "CRF-CSEC-033", role: "corroborating", observed_frequency: "11/40", evidence_weight: "medium_high" },
      ],
      market_truth_support: [{ ref_id: "MIF-CSEC-011" }, { ref_id: "MIF-CSEC-017" }],
      counter_evidence_acknowledged: "6 of 40 participants reported no nighttime standing difficulty by day 6; framing must say 'many mothers', never 'every mother'.",
      product_truth_ref: "PTR-CSEC-001",
      brand_truth_compliance: "Passes the four-part Voice DNA structural test; no banned registers present.",
      truth_conflict_log: [],
    },
  };
}

export function buildCsecAngle(id = "ANG-CSEC-006") {
  const angle = AngleService.build({ ...csecAngleInput(), id });
  return AngleService.linkEvidence(angle);
}

export function validateCsecAngle(angle, opts = {}) {
  return AngleValidationService.evaluate(angle, {
    platform_fitness: "narrow_fit",
    scope_note: "Prioritise WhatsApp, Instagram feed+Stories, TikTok/Reels, quote cards. De-prioritise LinkedIn.",
    approved_platforms: ["whatsapp", "instagram", "tiktok", "facebook", "x", "email"],
    excluded_platforms: ["linkedin"],
    reviewer: "system-fixture",
    persist: true,
    id: "VAL-CSEC-006",
    ...opts,
  });
}

// Convenience: build + validate in one call.
export function csecAngleWithValidation(opts = {}) {
  const angle = buildCsecAngle();
  const validation = validateCsecAngle(angle, opts);
  return { angle, validation };
}

// ---------------------------------------------------------------------------
// Wave D fixtures — approved assets, family and locked phrase set.
// Deterministic IDs so repeat runs overwrite rather than accumulate.
// All synthetic; sensitive domain => legitimate human review is exercised.
// ---------------------------------------------------------------------------

// asset_type chosen from the Truth Weighting matrix so grounding foregrounds customer fields.
// `template` forces a scene/quote-bearing structural template where the purpose default would
// omit the load-bearing specifics (test fixture only — role still derives from purpose).
export const CSEC_ASSET_SPECS = [
  { id: "AST-CSEC-1", platform: "whatsapp", asset_type: "WhatsApp broadcast", asset_purpose: "stop_scroll_identification" },
  { id: "AST-CSEC-2", platform: "instagram", asset_type: "Problem-led social post", asset_purpose: "problem" },
  { id: "AST-CSEC-3", platform: "tiktok", asset_type: "Story/emotional post", asset_purpose: "story" },
  { id: "AST-CSEC-4", platform: "facebook", asset_type: "Situation-led social post", asset_purpose: "education", template: "Problem-Led Post" },
  { id: "AST-CSEC-5", platform: "email", asset_type: "Problem-led social post", asset_purpose: "objection", template: "Problem-Led Post" },
  { id: "AST-CSEC-6", platform: "x", asset_type: "Transformation-led social post", asset_purpose: "conversion", template: "Problem-Led Post" },
];

/** Build an Asset Brief + generated draft + QA + AssetRecord for one spec. See module comment. */
export function csecApprove(spec, { angle, validation, human_review, sensitive_domain = true, content = null, artifacts = [], context = {} } = {}) {
  if (!angle) { const v = csecAngleWithValidation(); angle = v.angle; validation = v.validation; }
  const n = String(spec.id).replace(/^AST-CSEC-/, "");
  const brief = AssetArchitectureService.buildBrief(angle, validation, { platform: spec.platform, asset_type: spec.asset_type, asset_purpose: spec.asset_purpose, structural_template: spec.template, id: `BRIEF-CSEC-${n}` });
  AssetArchitectureService.save(brief);
  const gen = GenerationService.generate(brief, { id: `GEN-CSEC-${n}` });
  GenerationService.save(gen);
  const draft = content != null ? content : (gen.selected ? GenerationService.selectedContent(gen) : "");
  const descriptor = { asset_id: spec.id, asset_type: brief.asset_type, platform: brief.platform, asset_purpose: spec.asset_purpose, product_id: angle.product_id, angle_id: angle.id, brief_id: brief.id };
  const { record: qa } = QAOrchestrator.run({
    id: `QA-CSEC-${n}`,
    asset: descriptor, angle, validation, brief, generated: gen, content: draft, artifacts,
    context: { human_review: human_review || { decision: "APPROVED", reviewer: "system-fixture" }, sensitive_domain, ...context },
  });
  QAOrchestrator.save(qa);
  const asset = GovernanceService.registerAsset({ qa, candidate: { ...descriptor, content: draft }, angle, validation, brief, generated: gen, media: artifacts });
  return { brief, gen, qa, asset };
}

/** Full approved family for ANG-CSEC-006. */
export function csecApprovedFamily({ withMedia = false } = {}) {
  const { angle, validation } = csecAngleWithValidation();
  AngleService.save(angle);
  const built = CSEC_ASSET_SPECS.map((spec) => {
    const artifacts = withMedia && spec.id === "AST-CSEC-1"
      ? [{ id: "ART-CSEC-1", mime_type: "image/svg+xml", storage_uri: "work/csec/AST-CSEC-1/AST-CSEC-1.svg" }]
      : [];
    return csecApprove(spec, { angle, validation, artifacts });
  });
  const assets = built.map((b) => b.asset);
  const { family, pset, redundancy } = AssetFamilyService.assemble({ angle, validation, assets, id: "FAM-CSEC-006", psetId: "PSET-CSEC-006" });
  for (const a of assets) { a.family_id = family.id; a.locked_phrase_set_id = pset.id; GovernanceService.saveAsset(a); }
  return { angle, validation, built, assets, family, pset, redundancy };
}
