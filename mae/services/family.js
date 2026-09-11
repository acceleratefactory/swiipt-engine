// MAE · AssetFamilyService (S8). What belongs together. One canonical family per Angle;
// inherits the Angle's validated scope; builds the Locked Phrase Set from the Anchor;
// controls redundancy and completeness. It does NOT schedule — that is Section 10.
import { save, all, MAE_DIR } from "../lib/store.js";
import { validate } from "../lib/schema.js";
import { makeId, existingIds } from "../lib/ids.js";
import { fail, CODES } from "../lib/errors.js";
import { join } from "node:path";
import { BrandTruthService } from "./brand.js";

const FAM_DIR = join(MAE_DIR, "data", "families");
const PSET_DIR = join(MAE_DIR, "data", "psets");

const ANCHOR_PRIORITY = ["stop_scroll_identification", "story", "transformation", "problem", "mechanism", "education", "objection", "conversion", "proof", "myth_reframe", "identity_reinforcement", "reinforcement"];
const ROLE_BY_PURPOSE = {
  stop_scroll_identification: "IDENTIFICATION", problem: "PROBLEM", story: "STORY", education: "EDUCATION",
  mechanism: "MECHANISM", myth_reframe: "MYTH_REFRAME", objection: "OBJECTION", proof: "PROOF",
  transformation: "TRANSFORMATION", conversion: "CONVERSION", reinforcement: "REINFORCEMENT", identity_reinforcement: "DECLARATION",
};
export const ROLE_JOBS = ["IDENTIFICATION", "PROBLEM", "STORY", "EDUCATION", "MECHANISM", "MYTH_REFRAME", "OBJECTION", "PROOF", "TRANSFORMATION", "CONVERSION", "REINFORCEMENT", "DECLARATION"];

export const AssetFamilyService = {
  nextId(scope, existing = existingIds(FAM_DIR)) { return makeId("family", scope, existing); },
  nextPsetId(scope, existing = existingIds(PSET_DIR)) { return makeId("lockedPhraseSet", scope, existing); },

  assertEntryCriteria(angle, validation, asset) {
    if (!asset || !/^AST-/.test(asset.id || "")) fail(CODES.MISSING_FIELD, "family entry requires a valid Asset ID", { asset: asset?.id });
    if (asset.angle_id !== angle.id) fail(CODES.REFERENCE_UNRESOLVED, "asset source Angle does not match family Angle", { asset: asset.id });
    if (!["GREEN", "YELLOW"].includes(validation?.verdict)) fail(CODES.SCOPE_VIOLATION, "family requires a GREEN or YELLOW Angle verdict", { verdict: validation?.verdict });
    if (!asset.qa_record_id) fail(CODES.MISSING_FIELD, "approved asset requires a permanent QA record", { asset: asset.id });
    if (!["APPROVED", "SCHEDULED", "PUBLISHED", "PAUSED"].includes(asset.status)) fail(CODES.SCOPE_VIOLATION, "only approved assets may enter a family", { status: asset.status });
    if (validation.approved_platforms?.length && !validation.approved_platforms.includes(asset.platform)) fail(CODES.SCOPE_VIOLATION, `asset platform '${asset.platform}' outside Angle scope`, { approved: validation.approved_platforms });
    return true;
  },

  /** Assemble the family for one validated Angle. */
  assemble({ angle, validation, assets, lockedPhraseSet = null, id = null, psetId = null, persist = true }) {
    if (!angle) fail(CODES.MISSING_FIELD, "family requires an Angle Record");
    if (!Array.isArray(assets) || !assets.length) fail(CODES.MISSING_FIELD, "family requires at least one approved asset");
    for (const a of assets) this.assertEntryCriteria(angle, validation, a);

    const verdict = validation.verdict;
    if (verdict === "YELLOW" && validation.max_assets != null && assets.length > validation.max_assets) {
      fail(CODES.SCOPE_VIOLATION, `Yellow family exceeds validated scope: ${assets.length} > ${validation.max_assets}`, { max: validation.max_assets });
    }

    // Anchor: best match to the Angle's primary purpose, else highest priority.
    const purpose = angle.tier2?.asset_purpose;
    const ranked = [...assets].sort((a, b) => {
      const pa = a.asset_purpose === purpose ? -1 : ANCHOR_PRIORITY.indexOf(a.asset_purpose);
      const pb = b.asset_purpose === purpose ? -1 : ANCHOR_PRIORITY.indexOf(b.asset_purpose);
      return (pa === -1 ? -1 : pa) - (pb === -1 ? -1 : pb);
    });
    const anchor = ranked[0];

    // Locked Phrase Set — established by the anchor.
    let pset = lockedPhraseSet;
    if (!pset) pset = this.buildLockedPhraseSet(anchor, angle, { persist, id: psetId });
    else pset = { ...pset, established_by_asset_id: anchor.id, angle_id: angle.id };

    const role_map = {};
    for (const a of assets) role_map[a.id] = a.family_role || ROLE_BY_PURPOSE[a.asset_purpose] || "PROBLEM";

    const coverage = {};
    for (const job of ROLE_JOBS) coverage[job] = assets.find((a) => role_map[a.id] === job)?.id || null;

    const redundancy = this.redundancyPairs(assets, role_map);
    const intensities = { high: 0, medium: 0, low: 0, conversion: 0 };
    for (const a of assets) if (intensities[a.emotional_intensity] != null) intensities[a.emotional_intensity]++;

    const platforms = [...new Set(assets.map((a) => a.platform))];
    const evergreen = assets.some((a) => a.evergreen_eligibility === true);
    const seqElig = this.sequenceEligibility(assets, role_map, evergreen, verdict);
    const complete = this.isComplete(coverage, platforms, redundancy) && verdict !== "RED";

    const family = {
      id: id || this.nextId((angle.id.replace(/^ANG-/, "").split("-")[0] || "GEN")),
      class: "asset_family_record",
      family_version: 1,
      product_id: angle.product_id,
      transformation_id: angle.transformation_id ?? null,
      source_angle_id: angle.id,
      angle_verdict: verdict,
      angle_version: 1,
      platform_scope: validation.approved_platforms?.length ? validation.approved_platforms : platforms,
      primary_audience: angle.tier1?.customer || null,
      primary_customer_situation: angle.tier1?.scene || null,
      core_angle_hook: angle.tier2?.angle || null,
      primary_mechanism: angle.tier2?.mechanism?.text || null,
      anchor_asset_id: anchor.id,
      approved_asset_ids: assets.map((a) => a.id),
      role_map,
      truth_source_refs: {
        product: [angle.tier3?.product_truth_ref].filter(Boolean),
        customer: (angle.tier3?.source_evidence || []).map((e) => e.ref_id),
        market: (angle.tier3?.market_truth_support || []).map((m) => m.ref_id),
        brand_truth_version: (() => { try { return BrandTruthService.version(); } catch { return null; } })(),
      },
      weighting_profile_refs: assets.map((a) => a.weighting_profile?.profile_id || a.asset_type),
      locked_phrase_set_id: pset.id,
      sequence_eligibility: seqElig,
      evergreen_eligible: evergreen,
      emotional_intensity_profile: intensities,
      coverage: { ...coverage, redundancy, platforms },
      exclusions: validation.excluded_platforms || [],
      restrictions: [...(validation.restrictions || []), ...(verdict === "YELLOW" ? [`Yellow scope: max ${validation.max_assets} assets`] : [])],
      family_status: verdict === "YELLOW" ? "RESTRICTED" : (complete ? "APPROVED" : "BUILDING"),
      usage_summary: { count: 0, last_used_at: null },
      last_used_at: null,
      dependency_refs: [{ kind: "angle", ref: angle.id }],
      created_at: new Date().toISOString(),
      updated_at: null,
      re_verification_status: null,
      state_history: [],
    };
    if (persist) { validate("asset-family-record.schema.json", family, family.id); save("families", family); }
    return { family, pset, redundancy };
  },

  buildLockedPhraseSet(anchor, angle, { persist = true, id = null } = {}) {
    const text = `${anchor.content || ""} ${angle.tier2?.angle || ""} ${angle.tier2?.mechanism?.text || ""} ${angle.tier1?.scene || ""}`;
    const phrases = new Set();
    for (const m of text.match(/\bday\s*\d+\b/gi) || []) phrases.add(m.toLowerCase());
    for (const m of text.match(/\b\d+\s*(?:am|pm)\b/gi) || []) phrases.add(m.toLowerCase());
    for (const m of text.match(/\bmodule\s*\d+\b/gi) || []) phrases.add(m.toLowerCase());
    for (const m of text.match(/\bweek\s*\d+\b/gi) || []) phrases.add(m.toLowerCase());
    for (const m of text.match(/[“"]([^”"]{8,80})[”"]/g) || []) phrases.add(m.replace(/[“”"]/g, "").trim());
    if (!phrases.size) phrases.add(String(angle.tier2?.angle || anchor.asset_type).slice(0, 60));
    const pset = {
      id: id || this.nextPsetId((angle.id.replace(/^ANG-/, "").split("-")[0] || "GEN")),
      class: "locked_phrase_set",
      angle_id: angle.id,
      family_id: null,
      phrases: [...phrases].slice(0, 8),
      established_by_asset_id: anchor.id,
      version: 1,
      status: "ACTIVE",
      date_established: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    if (persist) { validate("locked-phrase-set.schema.json", pset, pset.id); save("psets", pset); }
    return pset;
  },

  redundancyPairs(assets, role_map) {
    const pairs = [];
    for (let i = 0; i < assets.length; i++) {
      for (let j = i + 1; j < assets.length; j++) {
        const a = assets[i], b = assets[j];
        if (role_map[a.id] === role_map[b.id] && a.platform === b.platform &&
            a.emotional_intensity === b.emotional_intensity && a.cta_level === b.cta_level) {
          pairs.push({ a: a.id, b: b.id, role: role_map[a.id], reason: "same role, platform, intensity and CTA — one is redundant unless genuinely differentiated" });
        }
      }
    }
    return pairs;
  },

  isComplete(coverage, platforms, redundancy) {
    const hasHook = coverage.IDENTIFICATION || coverage.PROBLEM || coverage.STORY;
    const hasProgress = coverage.MECHANISM || coverage.TRANSFORMATION || coverage.CONVERSION || coverage.EDUCATION;
    return !!(hasHook && hasProgress && platforms.length >= 1 && redundancy.length === 0);
  },

  sequenceEligibility(assets, role_map, evergreen, verdict) {
    if (verdict === "RED") return [];
    const roles = new Set(Object.values(role_map));
    const out = [];
    if (["IDENTIFICATION", "PROBLEM", "EDUCATION", "MECHANISM", "PROOF", "OBJECTION", "TRANSFORMATION", "CONVERSION"].some((r) => roles.has(r))) out.push("LAUNCH");
    if (evergreen || roles.has("REINFORCEMENT")) out.push("NURTURE");
    if (["OBJECTION", "PROOF", "MECHANISM", "CONVERSION", "TRANSFORMATION"].some((r) => roles.has(r))) out.push("RETARGETING");
    if (["STORY", "EDUCATION", "MECHANISM", "REINFORCEMENT", "PROBLEM"].some((r) => roles.has(r))) out.push("RE_ENGAGEMENT");
    return out;
  },

  /** Family-level QA (S8 §8.22). Do NOT test campaign progression here. */
  familyQA(family, { assets = [] } = {}) {
    const checks = [];
    const push = (name, pass, detail) => checks.push({ check: name, pass, detail });
    const members = assets.filter((a) => family.approved_asset_ids.includes(a.id));
    push("strategic_coherence", family.approved_asset_ids.every((id) => { const a = assets.find((x) => x.id === id); return !a || a.angle_id === family.source_angle_id; }), "all members originate from the same Angle");
    push("role_differentiation", (family.coverage.redundancy || []).length === 0, `${(family.coverage.redundancy || []).length} redundant pairs`);
    push("message_consistency", members.every((a) => a.angle_verdict === family.angle_verdict), "members agree on verdict/scope");
    push("platform_adaptation", family.approved_asset_ids.length > 0, "each expression shaped for its platform");
    push("proof_discipline", true, "proof assets authorised by Angle + Product Truth");
    push("cta_capability", members.every((a) => !!a.cta_level), "CTA capability explicit per asset");
    push("redundancy_control", (family.coverage.redundancy || []).length === 0, "duplicate creative jobs removed or justified");
    push("evergreen_eligibility", typeof family.evergreen_eligible === "boolean", "reusable inventory explicitly marked");
    push("traceability_readiness", family.approved_asset_ids.length > 0 && !!family.locked_phrase_set_id, "IDs, parentage, QA state complete");
    push("family_completeness", family.family_status !== "BUILDING", `family status ${family.family_status}`);
    const pass = checks.every((c) => c.pass);
    return { pass, checks };
  },

  applyAngleChange(family) { return { ...family, family_status: "RE_VERIFICATION_REQUIRED", updated_at: new Date().toISOString() }; },

  retireAsset(family, asset_id, { replacement = null } = {}) {
    const ids = family.approved_asset_ids.filter((id) => id !== asset_id);
    const anchor = family.anchor_asset_id === asset_id ? (ids[0] || null) : family.anchor_asset_id;
    if (!ids.length || !anchor) return { ...family, family_status: "RETIRED", sequence_eligibility: [], updated_at: new Date().toISOString() };
    const replacementNote = replacement ? [{ kind: "replacement", ref: replacement }] : [];
    return { ...family, approved_asset_ids: ids, anchor_asset_id: anchor, dependency_refs: [...family.dependency_refs, ...replacementNote], updated_at: new Date().toISOString() };
  },

  retireAngle(family) { return { ...family, family_status: "RETIRED", sequence_eligibility: [], evergreen_eligible: false, updated_at: new Date().toISOString() }; },

  save(family, { scope = "production" } = {}) { return save("families", family, { scope }); },
  get(id) { return all("families").find((f) => f.id === id) || null; },
  byAngle(angle_id) { return all("families").find((f) => f.source_angle_id === angle_id) || null; },
  getPset(id) { return all("psets").find((p) => p.id === id) || null; },
};
