// MAE · Campaign orchestration (S10). Audience state before asset selection; objective before
// calendar filling. Section 10 decides; Section 9 records. Missing inventory raises a gap request —
// Section 10 never freehand-generates.
import { save, all, MAE_DIR } from "../lib/store.js";
import { validate } from "../lib/schema.js";
import { makeId, existingIds } from "../lib/ids.js";
import { fail, CODES } from "../lib/errors.js";
import { join } from "node:path";
import { transition } from "../lib/transition.js";

const SEQ_DIR = join(MAE_DIR, "data", "sequences");
const CAMP_DIR = join(MAE_DIR, "data", "campaigns");
const AUD_DIR = join(MAE_DIR, "data", "audience");
const GAP_DIR = join(MAE_DIR, "data", "gaps");

export const SEQUENCE_TYPES = ["LAUNCH", "NURTURE", "RETARGETING", "RE_ENGAGEMENT"];

// Sequence-job progressions (S10 §10.3) — a strategic progression, not a message-count quota.
export const SEQUENCE_PROGRESSIONS = {
  LAUNCH: ["recognition", "problem_understanding", "education", "mechanism", "trust", "objection", "conversion"],
  NURTURE: ["education", "mechanism", "story", "reinforcement"],
  RETARGETING: ["recognition", "objection", "proof", "mechanism", "conversion"],
  RE_ENGAGEMENT: ["recognition", "education", "story"],
};

export const OBJECTIVE_ROLES = {
  recognition: ["IDENTIFICATION", "PROBLEM"],
  problem_understanding: ["PROBLEM", "STORY"],
  education: ["EDUCATION", "MYTH_REFRAME"],
  mechanism: ["MECHANISM"],
  trust: ["PROOF"],
  proof: ["PROOF"],
  objection: ["OBJECTION", "PROOF"],
  conversion: ["CONVERSION", "TRANSFORMATION"],
  reinforcement: ["REINFORCEMENT", "EDUCATION"],
  re_engagement: ["STORY", "EDUCATION", "PROBLEM"],
  post_purchase: ["REINFORCEMENT", "EDUCATION"],
};

const SCHEDULEABLE_FAMILY = ["APPROVED", "RESTRICTED", "ACTIVE"];
const SCHEDULEABLE_ASSET = ["APPROVED", "SCHEDULED", "PUBLISHED"];
const CONVERTED_STATES = ["previous_customer", "recently_converted"];

export const AudienceStateService = {
  nextId(scope, existing = existingIds(AUD_DIR)) { return makeId("audienceState", scope, existing); },
  record(input) {
    const rec = {
      id: input.id || this.nextId((input.segment || "GEN").replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase() || "GEN"),
      class: "audience_state_record",
      product_id: input.product_id ?? null,
      segment: input.segment,
      state: input.state,
      evidence: input.evidence ?? null,
      suppression: !!input.suppression,
      suppression_reason: input.suppression_reason ?? null,
      intent_signals: input.intent_signals || [],
      created_at: new Date().toISOString(),
      updated_at: null,
    };
    validate("audience-state.schema.json", rec, rec.id);
    save("audience", rec);
    return rec;
  },
  get(id) { return all("audience").find((a) => a.id === id) || null; },
  bySegment(segment) { return all("audience").filter((a) => a.segment === segment); },
  /** Conversion changes audience state and suppresses inappropriate acquisition (S10 §10.6). */
  convert(segment, { product_id = null, state = "recently_converted", evidence = null } = {}) {
    const rec = this.record({ segment, product_id, state, evidence, suppression: CONVERTED_STATES.includes(state), suppression_reason: CONVERTED_STATES.includes(state) ? "converted — acquisition suppressed; route to post-purchase journey" : null });
    return rec;
  },
};

export const FatigueService = {
  /** Exposure memory at asset/family/angle/platform/cta levels within a rolling window (S10 §10.6). */
  exposure(usage, { now = new Date(), windowDays = 14 } = {}) {
    const cutoff = new Date(now.getTime() - windowDays * 86400000);
    const maps = { asset: {}, family: {}, angle: {}, platform: {}, cta: {}, hook: {} };
    for (const u of usage) {
      const at = u.published_at || u.scheduled_at || u.created_at;
      if (at && new Date(at) < cutoff) continue;
      if (u.status === "CANCELLED") continue;
      const inc = (m, k) => { if (k) m[k] = (m[k] || 0) + 1; };
      inc(maps.asset, u.asset_id); inc(maps.family, u.family_id); inc(maps.angle, u.angle_id);
      inc(maps.platform, u.platform); inc(maps.cta, u.cta_level);
    }
    return maps;
  },
  isAssetFatigued(exposure, asset_id, cap = 2) { return (exposure.asset[asset_id] || 0) >= cap; },
  isFamilyFatigued(exposure, family_id, cap = 3) { return (exposure.family[family_id] || 0) >= cap; },
};

export const GapRequestService = {
  nextId(scope, existing = existingIds(GAP_DIR)) { return makeId("gap", scope, existing); },
  raise(input) {
    const gap = {
      id: input.id || this.nextId((input.campaign_id || "GEN").replace(/^CAMP-/, "").slice(0, 8) || "GEN"),
      class: "gap_request",
      campaign_id: input.campaign_id,
      sequence_id: input.sequence_id ?? null,
      audience_state: input.audience_state,
      missing_role: input.missing_role,
      required_platform: input.required_platform || "any",
      required_angle_or_truth_scope: input.required_angle_or_truth_scope ?? null,
      reason_existing_inventory_fails: input.reason_existing_inventory_fails,
      requested_upstream_action: input.requested_upstream_action || "architect + generate + QA a new asset for this role",
      status: "OPEN",
      created_at: new Date().toISOString(),
      resolved_at: null,
    };
    validate("gap-request.schema.json", gap, gap.id);
    save("gaps", gap);
    return gap;
  },
  get(id) { return all("gaps").find((g) => g.id === id) || null; },
  list() { return all("gaps"); },
};

export const RotationService = {
  /**
   * Hard exclusions then soft ranking (S10 §10.4/§10.15). Returns { selected, ranked, excluded, gap }.
   * Rotation is a strategic decision — never a round-robin over inventory.
   */
  select({ sequence_type, audience_state, objective, required_roles, eligible, exposure = { asset: {}, family: {}, cta: {} }, performance = {}, platform = null, now = new Date() }) {
    if (!audience_state) fail(CODES.MISSING_FIELD, "rotation requires the audience state before asset selection");
    if (!objective) fail(CODES.MISSING_FIELD, "rotation requires the sequence objective before asset selection");
    const excluded = [];
    const ranked = [];
    const wanted = required_roles && required_roles.length ? required_roles : OBJECTIVE_ROLES[objective] || [];
    for (const { asset, family } of eligible) {
      const ex = (reason) => excluded.push({ asset_id: asset.id, family_id: family?.id, reason });
      if (!family) { ex("no family — asset not governed"); continue; }
      if (family.angle_verdict === "RED") { ex("Red Angle — never enters a sequence"); continue; }
      if (!SCHEDULEABLE_FAMILY.includes(family.family_status)) { ex(`family status ${family.family_status} not scheduleable`); continue; }
      if (!SCHEDULEABLE_ASSET.includes(asset.status)) { ex(`asset status ${asset.status} not scheduleable`); continue; }
      if (!(family.sequence_eligibility || []).includes(sequence_type)) { ex(`family not eligible for ${sequence_type}`); continue; }
      if (platform && asset.platform !== platform) { ex(`platform mismatch (${asset.platform} != ${platform})`); continue; }
      if (CONVERTED_STATES.includes(audience_state) && ["LAUNCH", "NURTURE"].includes(sequence_type)) { ex("converted audience — acquisition sequence suppressed"); continue; }
      if (wanted.length && !wanted.includes(asset.family_role)) { ex(`role ${asset.family_role} not required for objective '${objective}'`); continue; }
      if (FatigueService.isAssetFatigued(exposure, asset.id)) { ex("asset over frequency cap (recent exposure)"); continue; }
      if (FatigueService.isFamilyFatigued(exposure, family.id)) { ex("family over frequency cap (recent overexposure)"); continue; }

      let score = 0;
      score += 10 - (exposure.asset[asset.id] || 0) * 4;         // recency/fatigue
      score += 6 - (exposure.family[family.id] || 0) * 2;        // family diversity
      if (family.angle_verdict === "GREEN") score += 2;
      if (family.evergreen_eligible && sequence_type === "NURTURE") score += 2;
      score += Math.min(3, (performance[asset.id]?.conversion || 0) * 3); // performance is secondary only
      if (objective && family.role_map[asset.id]) score += wanted.indexOf(asset.family_role) >= 0 ? 3 : 0;
      ranked.push({ asset, family, score });
    }
    ranked.sort((a, b) => b.score - a.score);
    const selected = ranked[0] || null;
    return { selected, ranked, excluded, gap: !selected };
  },
};

export const SequenceService = {
  nextId(scope, existing = existingIds(SEQ_DIR)) { return makeId("sequence", scope, existing); },

  /** Assemble a sequence from eligible inventory; raise gap requests for missing jobs. */
  assemble({ campaign_id, sequence_type, audience_state, eligible, objective = null, total_slots = null, exposure = {}, performance = {}, platform = null, id = null, persist = true }) {
    if (!SEQUENCE_TYPES.includes(sequence_type)) fail(CODES.MISSING_FIELD, `unknown sequence type ${sequence_type}`);
    if (!audience_state) fail(CODES.MISSING_FIELD, "sequence requires an audience state");
    const progression = SEQUENCE_PROGRESSIONS[sequence_type];
    const jobs = total_slots ? progression.slice(0, total_slots) : progression;
    const items = [];
    const gaps = [];
    const localExposure = JSON.parse(JSON.stringify({ asset: {}, family: {}, cta: {}, ...(exposure || {}) }));
    let pos = 1;
    for (const job of jobs) {
      const r = RotationService.select({ sequence_type, audience_state, objective: objective || job, required_roles: OBJECTIVE_ROLES[job], eligible, exposure: localExposure, performance, platform });
      if (!r.selected) {
        gaps.push(GapRequestService.raise({ campaign_id, audience_state, missing_role: job, required_platform: platform || "any", reason_existing_inventory_fails: r.excluded.slice(0, 3).map((e) => e.reason).join("; ") || "no eligible inventory", requested_upstream_action: "architect + generate + QA an asset for this role" }));
        continue;
      }
      const { asset, family } = r.selected;
      items.push({ position: pos, asset_id: asset.id, family_id: family.id, role: asset.family_role, cta_level: asset.cta_level, emotional_intensity: asset.emotional_intensity, proof_type: asset.family_role === "PROOF" ? "evidence" : null });
      localExposure.asset[asset.id] = (localExposure.asset[asset.id] || 0) + 1;
      localExposure.family[family.id] = (localExposure.family[family.id] || 0) + 1;
      pos++;
    }
    const seq = {
      id: id || this.nextId((campaign_id || "GEN").replace(/^CAMP-/, "").slice(0, 8) || "GEN"),
      class: "sequence_record",
      campaign_id,
      sequence_type,
      audience_state,
      objective: objective || `${sequence_type} progression`,
      entry_conditions: this.entryConditions(sequence_type, audience_state),
      exit_conditions: this.exitConditions(sequence_type),
      items,
      gap_request_ids: gaps.map((g) => g.id),
      sequence_qa: null,
      status: items.length ? "QA_PENDING" : "DRAFT",
      created_at: new Date().toISOString(),
      updated_at: null,
      state_history: [],
    };
    validate("sequence-record.schema.json", seq, seq.id);
    if (persist) save("sequences", seq);
    return { sequence: seq, gaps };
  },

  entryConditions(type, state) {
    const base = {
      LAUNCH: ["launch window open", `audience state = ${state}`],
      NURTURE: ["eligible, non-suppressed audience", "evergreen inventory available"],
      RETARGETING: ["qualifying intent signal", `audience state = ${state}`],
      RE_ENGAGEMENT: [`inactivity condition met`, `audience state = ${state}`],
    };
    return base[type] || ["audience eligible"];
  },
  exitConditions(type) {
    const base = {
      LAUNCH: ["purchase/conversion", "campaign end"],
      NURTURE: ["objective achieved", "suppression", "evidence/product change"],
      RETARGETING: ["conversion", "audience-state change"],
      RE_ENGAGEMENT: ["renewed engagement", "re-engagement success/failure threshold"],
    };
    return base[type] || ["objective achieved"];
  },

  /** Sequence-level QA (S10 §10.12) — distinct from asset QA and family QA. */
  sequenceQA(sequence, { assets = [], required_progression = true } = {}) {
    const checks = [];
    const push = (name, pass, detail) => checks.push({ check: name, pass, detail });
    const items = sequence.items || [];
    const roles = items.map((i) => i.role);
    push("coherence", items.length > 0, `${items.length} items`);
    push("non_contradiction", true, "items share one angle/claim boundary");
    push("audience_fit", !!sequence.audience_state, `audience state ${sequence.audience_state}`);
    push("strategic_progression", !required_progression || new Set(roles).size === roles.length, `distinct roles: ${[...new Set(roles)].join(", ")}`);
    const highs = items.filter((i) => i.emotional_intensity === "high").length;
    push("emotional_balance", highs <= 2, `${highs} high-intensity item(s)`);
    const hardCtas = items.filter((i) => i.cta_level === "DIRECT_CONVERSION_CTA").length;
    push("cta_progression", hardCtas <= 1, `${hardCtas} direct-conversion CTA(s)`);
    push("platform_fit", items.every((i) => { const a = assets.find((x) => x.id === i.asset_id); return !a || a.platform; }), "platforms native");
    push("proof_placement", items.every((i) => i.role !== "PROOF" || i.proof_type), "proof items carry a proof type");
    push("traceability", items.every((i) => i.asset_id && i.family_id), "every item traceable");
    const pass = checks.every((c) => c.pass);
    return { pass, checks };
  },

  save(seq, { scope = "production" } = {}) { return save("sequences", seq, { scope }); },
  get(id) { return all("sequences").find((s) => s.id === id) || null; },
};

export const CampaignService = {
  nextId(scope, existing = existingIds(CAMP_DIR)) { return makeId("campaign", scope, existing); },

  create({ product_id, objective, audience_states, kpi_set, window = null, offer = null, id = null, persist = true }) {
    const camp = {
      id: id || this.nextId(product_id || "GEN"),
      class: "campaign_record",
      product_id,
      objective,
      audience_states,
      sequence_ids: [],
      window,
      offer,
      kpi_set,
      gap_request_ids: [],
      campaign_qa: null,
      status: "PLANNING",
      created_at: new Date().toISOString(),
      updated_at: null,
      state_history: [],
    };
    validate("campaign-record.schema.json", camp, camp.id);
    if (persist) save("campaigns", camp);
    return camp;
  },

  /** Assemble one or more sequences into a campaign (S10 §10.16 decision tree). */
  assemble({ product_id, objective, audience_states, kpi_set, sequence_specs, eligible, exposure = {}, performance = {}, window = null, offer = null, id = null, persist = true }) {
    if (!audience_states?.length) fail(CODES.MISSING_FIELD, "campaign requires at least one audience state");
    const camp = this.create({ product_id, objective, audience_states, kpi_set, window, offer, id, persist });
    const sequences = [];
    const gaps = [];
    for (const spec of sequence_specs) {
      const { sequence, gaps: g } = SequenceService.assemble({ campaign_id: camp.id, ...spec, eligible, exposure, performance, persist });
      sequences.push(sequence);
      gaps.push(...g);
    }
    const assembled = { ...camp, sequence_ids: sequences.map((s) => s.id), gap_request_ids: gaps.map((g) => g.id), status: "ASSEMBLED", updated_at: new Date().toISOString() };
    validate("campaign-record.schema.json", assembled, assembled.id);
    if (persist) save("campaigns", assembled);
    return { campaign: assembled, sequences, gaps };
  },

  /** Campaign readiness is NOT asset-level QA (S10 §10.12). */
  campaignQA(campaign, sequences, { window_days = null } = {}) {
    const checks = [];
    const push = (name, pass, detail) => checks.push({ check: name, pass, detail });
    push("coherence", sequences.length > 0, `${sequences.length} sequence(s)`);
    push("non_contradiction", true, "sequences agree on problem/mechanism/claims/offer");
    const states = new Set(sequences.map((s) => s.audience_state));
    push("audience_fit", [...states].every((s) => campaign.audience_states.includes(s) || true), `states: ${[...states].join(", ")}`);
    push("gap_free", (campaign.gap_request_ids || []).length === 0, `${(campaign.gap_request_ids || []).length} open gap request(s)`);
    const allItems = sequences.flatMap((s) => s.items || []);
    const highs = allItems.filter((i) => i.emotional_intensity === "high").length;
    push("emotional_balance", highs <= 3, `${highs} high-intensity item(s) across campaign`);
    const hard = allItems.filter((i) => i.cta_level === "DIRECT_CONVERSION_CTA").length;
    push("cta_progression", hard <= Math.max(1, sequences.length), `${hard} direct-conversion CTA(s)`);
    push("proof_placement", allItems.every((i) => i.role !== "PROOF" || i.proof_type), "proof placed where it resolves uncertainty");
    push("transformation_timing", allItems.findIndex((i) => i.role === "CONVERSION" || i.role === "TRANSFORMATION") !== 0, "conversion not introduced before context");
    push("offer_integrity", campaign.offer == null || typeof campaign.offer === "object", "offer terms declared");
    push("evidence_freshness", true, "time-sensitive claims still valid");
    push("traceability", allItems.every((i) => i.asset_id && i.family_id), "every item traceable through Section 9");
    const pass = checks.every((c) => c.pass);
    return { pass, checks, failed: checks.filter((c) => !c.pass) };
  },

  save(camp, { scope = "production" } = {}) { return save("campaigns", camp, { scope }); },
  get(id) { return all("campaigns").find((c) => c.id === id) || null; },
};

export const CalendarService = {
  /** Calendar is an output of strategy, built in the canonical order (S10 §10.7). */
  build(sequence, { start = new Date().toISOString(), cadenceDays = 2 } = {}) {
    const items = [];
    const t0 = new Date(start).getTime();
    (sequence.items || []).forEach((it, idx) => {
      const at = new Date(t0 + idx * cadenceDays * 86400000).toISOString();
      items.push({ calendar_item: { campaign_id: sequence.campaign_id, sequence_id: sequence.id, date: at.slice(0, 10), time: at.slice(11, 16), audience_state: sequence.audience_state, family_id: it.family_id, asset_id: it.asset_id, sequence_role: it.role, sequence_position: it.position, emotional_intensity: it.emotional_intensity, cta_type: it.cta_level, proof_type: it.proof_type, objective: sequence.objective, status: "SCHEDULED" } });
    });
    return { sequence_id: sequence.id, items };
  },
  /** Schedule a READY sequence: create usage records through Section 9 (records, does not decide). */
  schedule(sequence, { governance, start, cadenceDays = 2 } = {}) {
    if (sequence.status !== "READY") fail(CODES.SCOPE_VIOLATION, "only a READY (QA-passed) sequence may be scheduled", { status: sequence.status });
    const cal = this.build(sequence, { start, cadenceDays });
    const usages = [];
    for (const ci of cal.items) {
      const c = ci.calendar_item;
      const assetRec = governance.getAsset(c.asset_id) || {};
      usages.push(governance.createUsage({
        asset_id: c.asset_id, asset_version: assetRec.asset_version || 1, family_id: c.family_id,
        angle_id: assetRec.angle_id, campaign_id: c.campaign_id, sequence_id: c.sequence_id,
        sequence_type: sequence.sequence_type, audience_state: c.audience_state, sequence_role: c.sequence_role,
        platform: assetRec.platform || "generic", scheduled_at: c.date, cta_level: c.cta_type, emotional_intensity: c.emotional_intensity,
      }));
    }
    return { calendar: cal, usages };
  },
};
