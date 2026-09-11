// MAE · TraceabilityService / GovernanceService (S9). The system of record. Identity, lineage,
// versions, dependencies, usage, retirement and change propagation. Section 9 records; Section 10 decides.
import { save, all, MAE_DIR } from "../lib/store.js";
import { validate } from "../lib/schema.js";
import { makeId, existingIds } from "../lib/ids.js";
import { createHash } from "node:crypto";
import { fail, CODES } from "../lib/errors.js";
import { join } from "node:path";
import { AngleService } from "./angle.js";
import { AssetFamilyService } from "./family.js";
import { BrandTruthService } from "./brand.js";

const ASSET_DIR = join(MAE_DIR, "data", "assets");
const USAGE_DIR = join(MAE_DIR, "data", "usage");
const AUDIT_DIR = join(MAE_DIR, "data", "audit");

const ROLE_BY_PURPOSE = {
  stop_scroll_identification: "IDENTIFICATION", problem: "PROBLEM", story: "STORY", education: "EDUCATION",
  mechanism: "MECHANISM", myth_reframe: "MYTH_REFRAME", objection: "OBJECTION", proof: "PROOF",
  transformation: "TRANSFORMATION", conversion: "CONVERSION", reinforcement: "REINFORCEMENT", identity_reinforcement: "DECLARATION",
};
const INTENSITY_BY_PURPOSE = {
  stop_scroll_identification: "high", problem: "high", story: "medium", objection: "medium",
  education: "low", mechanism: "low", myth_reframe: "low", reinforcement: "low", identity_reinforcement: "low",
  transformation: "conversion", conversion: "conversion", proof: "medium",
};
const CTA_BY_PURPOSE = {
  stop_scroll_identification: "SOFT_CTA", problem: "NO_CTA", story: "SOFT_CTA", education: "LEARN_MORE_CTA",
  mechanism: "LEARN_MORE_CTA", myth_reframe: "LEARN_MORE_CTA", objection: "LEARN_MORE_CTA", proof: "LEARN_MORE_CTA",
  transformation: "PRODUCT_CTA", conversion: "DIRECT_CONVERSION_CTA", reinforcement: "SOFT_CTA", identity_reinforcement: "SAVE_SHARE_CTA",
};

function hash(s) { return createHash("sha256").update(String(s)).digest("hex"); }

export const GovernanceService = {
  nextAssetId(scope, existing = existingIds(ASSET_DIR)) { return makeId("asset", scope, existing); },
  nextUsageId(scope, existing = existingIds(USAGE_DIR)) { return makeId("usage", scope, existing); },

  /** Create the governed AssetRecord for a QA-approved candidate. */
  registerAsset({ qa, candidate, angle, validation, brief, generated, media = [], family_id = null }) {
    if (!qa) fail(CODES.MISSING_FIELD, "an asset requires a QA record");
    if (!["APPROVED", "HUMAN_REVIEW_PENDING"].includes(qa.qa_status)) {
      fail(CODES.SCOPE_VIOLATION, "only a QA-approved candidate becomes an AssetRecord", { qa_status: qa.qa_status });
    }
    if (qa.qa_status === "HUMAN_REVIEW_PENDING" && qa.human_review?.decision !== "APPROVED" && qa.human_review?.decision !== "APPROVED_WITH_MINOR_EDIT") {
      fail(CODES.MISSING_FIELD, "asset requires the human review decision before registration");
    }
    const purpose = candidate.asset_purpose || brief.asset_purpose;
    const timeBound = /\bday\s*\d+\b/i.test(candidate.content || "") || /\b(expires|deadline|limited time|this week only)\b/i.test(candidate.content || "");
    const asset = {
      id: candidate.asset_id || this.nextAssetId((angle.id.replace(/^ANG-/, "").split("-")[0] || "GEN")),
      class: "asset_record",
      asset_version: 1,
      product_id: angle.product_id,
      transformation_id: angle.transformation_id ?? null,
      family_id,
      angle_id: angle.id,
      angle_verdict: validation.verdict,
      angle_version: 1,
      asset_type: candidate.asset_type || brief.asset_type,
      asset_role: ROLE_BY_PURPOSE[purpose] || "PROBLEM",
      platform: candidate.platform || brief.platform,
      platform_format: candidate.platform_format || brief.platform,
      asset_purpose: purpose,
      weighting_profile: { ...(brief.truth_weighting || {}), profile_id: brief.asset_type },
      asset_brief_id: brief.id,
      visual_grounding_block_id: brief.visual_grounding ? `${brief.id}-VG` : null,
      template_version: brief.structural_template || null,
      locked_phrase_set_id: brief.locked_phrase_set_ref || null,
      generation_record_id: generated?.id || null,
      qa_record_id: qa.id,
      human_review_record_id: qa.human_review?.required ? `${qa.id}-HR` : null,
      manual_override_record_id: qa.manual_override ? `${qa.id}-OVR` : null,
      media_artifact_ids: media.map((m) => m.id),
      content: candidate.content,
      content_hash: hash(candidate.content),
      source_truth_refs: {
        product: [angle.tier3.product_truth_ref].filter(Boolean),
        customer: (angle.tier3.source_evidence || []).map((e) => e.ref_id),
        market: (angle.tier3.market_truth_support || []).map((m) => m.ref_id),
        brand_truth_version: (() => { try { return BrandTruthService.version(); } catch { return null; } })(),
      },
      family_role: ROLE_BY_PURPOSE[purpose] || "PROBLEM",
      emotional_intensity: INTENSITY_BY_PURPOSE[purpose] || "medium",
      cta_level: CTA_BY_PURPOSE[purpose] || "SOFT_CTA",
      proof_requirement: brief.proof_requirements || null,
      sequence_eligibility: [],
      evergreen_eligibility: !timeBound && purpose !== "conversion",
      status: "APPROVED",
      created_at: new Date().toISOString(),
      approved_at: new Date().toISOString(),
      retired_at: null,
      usage_ids: [],
      dependency_refs: [{ kind: "angle", ref: angle.id }, { kind: "brief", ref: brief.id }],
      performance_refs: [],
      retirement_reason: null,
      re_verification_status: null,
    };
    validate("asset-record.schema.json", asset, asset.id);
    save("assets", asset);
    return asset;
  },

  /** Full lineage resolution (S9 §9.2). Reports TRACEABILITY_COMPLETE / INCOMPLETE. */
  resolveLineage(asset_id) {
    const asset = this.getAsset(asset_id);
    if (!asset) fail(CODES.REFERENCE_UNRESOLVED, `asset not found: ${asset_id}`);
    const qa = all("qa").find((q) => q.id === asset.qa_record_id) || null;
    const brief = all("briefs").find((b) => b.id === asset.asset_brief_id) || null;
    const angle = AngleService.get(asset.angle_id);
    const validation = all("validations").filter((v) => v.angle_id === asset.angle_id).pop() || null;
    const generation = all("generated").find((g) => g.id === asset.generation_record_id) || null;
    const family = asset.family_id ? AssetFamilyService.get(asset.family_id) : null;
    const truth = asset.source_truth_refs || {};
    const missing = [];
    if (!qa) missing.push("qa_record");
    if (!brief) missing.push("asset_brief");
    if (!angle) missing.push("angle");
    if (!validation) missing.push("validation");
    if (!generation) missing.push("generation");
    if (!(truth.customer || []).length && !(truth.product || []).length) missing.push("truth_sources");
    return {
      status: missing.length ? "TRACEABILITY_INCOMPLETE" : "TRACEABILITY_COMPLETE",
      missing,
      chain: { asset, qa, brief, angle, validation, generation, family, truth_sources: truth },
    };
  },

  /** Create a usage event (S9 §9.19/§9.20). Multiple usages per asset are expected. */
  createUsage(input) {
    const usage = {
      id: input.id || this.nextUsageId((input.asset_id || "AST").replace(/^AST-/, "").split("-")[0] || "GEN"),
      class: "usage_record",
      asset_id: input.asset_id,
      asset_version: input.asset_version || 1,
      family_id: input.family_id,
      angle_id: input.angle_id,
      campaign_id: input.campaign_id ?? null,
      sequence_id: input.sequence_id ?? null,
      sequence_type: input.sequence_type,
      audience_state: input.audience_state,
      sequence_role: input.sequence_role ?? null,
      platform: input.platform,
      scheduled_at: input.scheduled_at ?? null,
      published_at: input.published_at ?? null,
      cta_level: input.cta_level,
      emotional_intensity: input.emotional_intensity,
      status: input.status || (input.published_at ? "PUBLISHED" : "SCHEDULED"),
      published_reference: input.published_reference ?? null,
      performance_reference: input.performance_reference ?? null,
      publication_difference: input.publication_difference ?? null,
      notes: input.notes ?? null,
      overridden_by: input.overridden_by ?? null,
      created_at: new Date().toISOString(),
    };
    validate("usage-record.schema.json", usage, usage.id);
    save("usage", usage);
    // Link back to the asset (usage is tracked separately from asset identity).
    const asset = this.getAsset(usage.asset_id);
    if (asset) { asset.usage_ids = [...new Set([...(asset.usage_ids || []), usage.id])]; asset.dependency_refs = [...(asset.dependency_refs || []), { kind: "usage", ref: usage.id }]; save("assets", asset); }
    this.audit("usage_created", { usage_id: usage.id, asset_id: usage.asset_id, sequence_type: usage.sequence_type });
    return usage;
  },

  recordPublication(usage_id, { published_reference, published_at = new Date().toISOString(), final_text = null }) {
    const usage = all("usage").find((u) => u.id === usage_id);
    if (!usage) fail(CODES.REFERENCE_UNRESOLVED, `usage not found: ${usage_id}`);
    const asset = this.getAsset(usage.asset_id);
    const difference = final_text && asset && final_text !== asset.content ? "published version differs from approved version" : null;
    const updated = { ...usage, status: "PUBLISHED", published_at, published_reference: published_reference ?? null, publication_difference: difference };
    validate("usage-record.schema.json", updated, updated.id);
    save("usage", updated);
    if (asset && ["APPROVED", "SCHEDULED"].includes(asset.status)) { asset.status = "PUBLISHED"; save("assets", asset); }
    const fam = usage.family_id ? AssetFamilyService.get(usage.family_id) : null;
    if (fam) { fam.last_used_at = published_at; fam.usage_summary = { ...(fam.usage_summary || {}), count: (fam.usage_summary?.count || 0) + 1, last_used_at: published_at }; save("families", fam); }
    this.audit("published", { usage_id, asset_id: usage.asset_id, difference });
    return updated;
  },

  /** Forward dependency: which customer-facing objects depend on this source? (S9 §9.34) */
  affectedBy(source_kind, source_id) {
    const angles = all("angles").filter((a) => {
      if (source_kind === "product") return a.tier3.product_truth_ref === source_id;
      if (source_kind === "customer") return (a.tier3.source_evidence || []).some((e) => e.ref_id === source_id);
      if (source_kind === "market") return (a.tier3.market_truth_support || []).some((m) => m.ref_id === source_id);
      if (source_kind === "brand") return true; // all angles governed by the brand version
      return false;
    });
    const angleIds = angles.map((a) => a.id);
    const families = all("families").filter((f) => angleIds.includes(f.source_angle_id));
    const familyIds = families.map((f) => f.id);
    const assets = all("assets").filter((x) => angleIds.includes(x.angle_id) || familyIds.includes(x.family_id));
    const usages = all("usage").filter((u) => assets.some((x) => x.id === u.asset_id));
    return { source: { kind: source_kind, id: source_id }, angles: angleIds, families: familyIds, assets: assets.map((x) => x.id), usages: usages.map((u) => u.id) };
  },

  /** Change propagation: mark dependents RE_VERIFICATION_REQUIRED / FLAGGED. (S9 §9.33) */
  markReVerification(source_kind, source_id, { impact = "requires_review" } = {}) {
    const affected = this.affectedBy(source_kind, source_id);
    for (const id of affected.angles) { const a = AngleService.get(id); if (a && !["RETIRED", "RED"].includes(a.status)) save("angles", { ...a, status: "FLAGGED_FOR_RE_VERIFICATION", updated_at: new Date().toISOString() }); }
    for (const id of affected.families) { const f = AssetFamilyService.get(id); if (f) save("families", { ...f, family_status: "RE_VERIFICATION_REQUIRED", re_verification_status: impact, updated_at: new Date().toISOString() }); }
    for (const id of affected.assets) { const x = this.getAsset(id); if (x && x.status !== "RETIRED") save("assets", { ...x, status: "RE_VERIFICATION_REQUIRED", re_verification_status: impact }); }
    this.audit("re_verification", { source: affected.source, impact, affected });
    return { ...affected, impact, status: affected.angles.length || affected.families.length || affected.assets.length ? "RE-VERIFICATION REQUIRED" : "NO IMPACT" };
  },

  /** Retire an asset — never delete. Preserve everything. (S9 §9.40) */
  retireAsset(asset_id, { reason, replacement = null, at = new Date().toISOString() } = {}) {
    const x = this.getAsset(asset_id);
    if (!x) fail(CODES.REFERENCE_UNRESOLVED, `asset not found: ${asset_id}`);
    const retired = { ...x, status: "RETIRED", retired_at: at, retirement_reason: reason || "unspecified", dependency_refs: replacement ? [...x.dependency_refs, { kind: "replacement", ref: replacement }] : x.dependency_refs };
    validate("asset-record.schema.json", retired, retired.id);
    save("assets", retired);
    for (const u of all("usage").filter((u) => u.asset_id === asset_id && ["SCHEDULED"].includes(u.status))) save("usage", { ...u, status: "REPLACED", notes: "asset retired" });
    this.audit("asset_retired", { asset_id, reason, replacement });
    return retired;
  },

  /**
   * A creative change creates a new version; approval does NOT inherit (S9 §9.35/§9.36).
   * Returns the new version in RE_VERIFICATION_REQUIRED state — it must pass QA again before use.
   */
  newVersion(asset_id, { content, requires_qa = true, qa_record_id = null } = {}) {
    const x = this.getAsset(asset_id);
    if (!x) fail(CODES.REFERENCE_UNRESOLVED, `asset not found: ${asset_id}`);
    const requiresQa = requires_qa || content != null;
    const v = {
      ...x,
      asset_version: (x.asset_version || 1) + 1,
      content: content ?? x.content,
      content_hash: hash(content ?? x.content),
      qa_record_id: qa_record_id || x.qa_record_id,
      status: requiresQa ? "RE_VERIFICATION_REQUIRED" : x.status,
      re_verification_status: requiresQa ? "material creative change requires QA" : null,
      approved_at: requiresQa ? null : x.approved_at,
      created_at: new Date().toISOString(),
    };
    validate("asset-record.schema.json", v, `${v.id}#v${v.asset_version}`);
    save("assets", v);
    this.audit("asset_new_version", { asset_id, version: v.asset_version, requires_qa: requiresQa });
    return v;
  },

  saveAsset(asset) { return save("assets", asset); },
  getAsset(id) { return all("assets").find((a) => a.id === id) || null; },
  getUsage(id) { return all("usage").find((u) => u.id === id) || null; },
  listAssets() { return all("assets"); },
  listUsage() { return all("usage"); },

  audit(event, detail = {}) {
    const rec = { id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1e4)}`, at: new Date().toISOString(), event, detail };
    save("audit", rec);
    return rec;
  },
};
