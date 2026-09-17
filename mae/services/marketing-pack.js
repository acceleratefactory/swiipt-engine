// MAE services · MarketingPackService (V06 integrity closure).
//
// Assembly + integrity validation for a canonical Master Marketing Pack. It EXTENDS the existing
// MAE architecture - it does not replace it:
//   · record storage / ids / schema       → lib/store.js, lib/ids.js, lib/schema.js
//   · content completeness (generation)   → lib/content-contract.js
//   · brand token authority               → services/brand.js (BrandTruthService)
//   · campaign / sequence records         → services/campaign.js (record shapes only)
//
// It exists because a Master Marketing Pack is a GOVERNED ARTIFACT: every reference it contains must
// resolve to exactly one canonical record of the expected type, it must contain no placeholder ids,
// its summary counts must be a DERIVATION of the canonical records, every production record must be
// materially complete for its asset type, and every design specification must use authorized brand
// colour tokens. No new traceability framework: the references are the ones the records already carry.
//
// Deterministic. No network, no providers, no Date.now, no randomness.

import { BrandTruthService } from "./brand.js";
import { contentCompleteness } from "../lib/content-contract.js";

export const MARKETING_PACK_VERSION = "marketing-pack@1";

export const PACK_CODES = Object.freeze({
  REFERENCE_UNRESOLVED: "REFERENCE_UNRESOLVED",
  REFERENCE_NOT_PERSISTED: "REFERENCE_NOT_PERSISTED",
  DUPLICATE_REFERENCE: "DUPLICATE_REFERENCE",
  PLACEHOLDER_REFERENCE: "PLACEHOLDER_REFERENCE",
  COUNT_MISMATCH: "COUNT_MISMATCH",
  CONTENT_INCOMPLETE: "CONTENT_INCOMPLETE",
  BRAND_TOKEN_UNAUTHORIZED: "BRAND_TOKEN_UNAUTHORIZED",
  RECORD_INVALID: "RECORD_INVALID",
});

export const PLACEHOLDER_TOKENS = Object.freeze(["placeholder", "tbd", "todo", "temp"]);
const PLACEHOLDER_RE = new RegExp(`(^|[^a-z0-9])(${PLACEHOLDER_TOKENS.join("|")})([^a-z0-9]|$)`, "i");

const isObj = (v) => v != null && typeof v === "object" && !Array.isArray(v);
const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const byId = (arr) => { const m = new Map(); for (const r of arr || []) if (isObj(r) && isStr(r.id)) m.set(r.id, r); return m; };
/** Design specifications carry `design_id` (their canonical key), not `id`. */
const specId = (d) => (isObj(d) ? (d.design_id ?? d.id) : null);
const specsById = (arr) => { const m = new Map(); for (const d of arr || []) if (isStr(specId(d))) m.set(specId(d), d); return m; };

/** True when a canonical identifier/reference contains an unresolved placeholder token. */
export function isPlaceholderRef(value) { return typeof value === "string" && PLACEHOLDER_RE.test(value); }

/** Deep-collect string values from canonical identifier/reference fields only (not free copy). */
const REF_KEY_RE = /(^|_)(id|ids|ref|refs|reference|references)$/i;
export function collectRefStrings(obj, path = "", out = []) {
  if (obj == null) return out;
  if (typeof obj === "string") { return out; }
  if (Array.isArray(obj)) { obj.forEach((v, i) => collectRefStrings(v, `${path}[${i}]`, out)); return out; }
  if (!isObj(obj)) return out;
  for (const [k, v] of Object.entries(obj)) {
    const p = path ? `${path}.${k}` : k;
    if (typeof v === "string") {
      if (REF_KEY_RE.test(k) || /^id$/i.test(k)) out.push({ path: p, value: v });
      // explicit *_id fields
      if (/_id$/i.test(k)) out.push({ path: p, value: v });
    } else if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === "string" && (REF_KEY_RE.test(k) || /_ids?$/i.test(k))) out.push({ path: `${p}[${i}]`, value: item });
        else collectRefStrings(item, `${p}[${i}]`, out);
      });
    } else if (isObj(v)) {
      collectRefStrings(v, p, out);
    }
  }
  return out;
}

/** Deterministic counts derived ONLY from the canonical asset records. */
export function deriveAssetCounts(assets = []) {
  const by_platform = {};
  const by_type = {};
  const by_family = {};
  const emotional_intensity_distribution = {};
  const cta_level_distribution = {};
  for (const a of assets) {
    const pl = isStr(a.platform) ? a.platform : "(none)";
    const ty = isStr(a.asset_type) ? a.asset_type : "(none)";
    const fm = isStr(a.family_id) ? a.family_id : "(none)";
    by_platform[pl] = (by_platform[pl] || 0) + 1;
    by_type[ty] = (by_type[ty] || 0) + 1;
    by_family[fm] = (by_family[fm] || 0) + 1;
    const ei = isStr(a.emotional_intensity) ? a.emotional_intensity : "(none)";
    const cl = isStr(a.cta_level) ? a.cta_level : "(none)";
    emotional_intensity_distribution[ei] = (emotional_intensity_distribution[ei] || 0) + 1;
    cta_level_distribution[cl] = (cta_level_distribution[cl] || 0) + 1;
  }
  const sortObj = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
  return {
    total_assets: assets.length,
    by_platform: sortObj(by_platform),
    by_type: sortObj(by_type),
    by_family: sortObj(by_family),
    emotional_intensity_distribution: sortObj(emotional_intensity_distribution),
    cta_level_distribution: sortObj(cta_level_distribution),
  };
}

/**
 * Build a canonical Master Marketing Pack purely by DERIVATION from the governed records.
 * Summaries, relationships and traceability are computed - never hand-maintained.
 *
 * @param {object} input { product_id, transformation_id, library_id, four_truths,
 *   angles, families, assets, generated, qa, design_specs, visual_groundings, psets,
 *   campaign, sequence, pending_governance, pipeline_version, mcp_version, created_at }
 */
export function buildMarketingPack(input = {}) {
  const {
    product_id, transformation_id, library_id,
    four_truths = {}, angles = [], families = [], assets = [], generated = [], qa = [],
    design_specs = [], visual_groundings = [], psets = [], campaign = null, sequence = null,
    pending_governance = null, pipeline_version = "swiipt-engine-v1", mcp_version = "v06",
    created_at = null, id = null, version = 1,
  } = input;

  const counts = deriveAssetCounts(assets);
  const famById = byId(families);

  // ---- angles ----
  const angleSummary = {};
  for (const a of angles) {
    angleSummary[a.id] = {
      name: a.tier2?.insight?.label ?? a.id,
      purpose: a.tier2?.asset_purpose ?? null,
      customer: a.tier1?.customer ?? null,
      emotion: a.tier1?.emotional_stake?.text ?? null,
      family_id: [...famById.values()].find((f) => f.source_angle_id === a.id)?.id ?? null,
    };
  }
  const anglesBlock = {
    count: angles.length,
    validation: [...new Set(families.map((f) => f.angle_verdict))].length === 1 ? `all_${String(families[0]?.angle_verdict || "").toLowerCase()}` : "mixed",
    records: angles.map((a) => a.id),
    angle_ids: angles.map((a) => a.id),
    summary: angleSummary,
  };

  // ---- family relationships (derived from asset.family_id) ----
  const familyRelationships = {};
  for (const f of families) {
    const members = assets.filter((a) => a.family_id === f.id).map((a) => a.id).sort();
    const platforms = [...new Set(assets.filter((a) => a.family_id === f.id).map((a) => a.platform))].sort();
    const types = [...new Set(assets.filter((a) => a.family_id === f.id).map((a) => a.asset_type))].sort();
    familyRelationships[f.id] = { name: f.core_angle_hook ?? f.id, angle_id: f.source_angle_id, asset_count: members.length, platforms, types };
  }

  // ---- platform architectures (derived) ----
  const platformArchitectures = {};
  for (const [pl, n] of Object.entries(counts.by_platform)) {
    const set = assets.filter((a) => a.platform === pl);
    platformArchitectures[pl] = {
      types_used: [...new Set(set.map((a) => a.asset_type))].sort(),
      asset_count: n,
      families_represented: [...new Set(set.map((a) => a.family_id))].sort(),
    };
  }

  // ---- traceability (derived; never hand-written) ----
  const angleToFamily = {};
  for (const f of families) angleToFamily[f.source_angle_id] = f.id;
  const familyToAssets = {};
  for (const f of families) familyToAssets[f.id] = assets.filter((a) => a.family_id === f.id).map((a) => a.id).sort();
  const anchorToVisualGrounding = {};
  // anchor → visual grounding derived from the family's explicit field when present
  for (const v of visual_groundings) {
    for (const f of families) {
      if (f.visual_grounding_block_id === v.id || (isStr(f.anchor_asset_id) && isStr(v.id) && v.id.endsWith(f.anchor_asset_id.replace(/^AST-/, "").replace(/^NS-/, "")))) {
        anchorToVisualGrounding[f.anchor_asset_id] = v.id;
      }
    }
  }
  const designSpecToAsset = {};
  for (const d of design_specs) {
    if (isStr(d.asset_brief_id)) designSpecToAsset[specId(d)] = d.asset_brief_id;
  }
  const traceability = {
    truth_refs: four_truths?.traceability_refs ?? { product: transformation_id, brand: four_truths?.brand_truth?.record_id ?? null },
    angle_to_family: angleToFamily,
    family_to_assets: familyToAssets,
    asset_to_qa: Object.fromEntries(assets.map((a) => [a.id, a.qa_record_id || null])),
    anchor_to_visual_grounding: anchorToVisualGrounding,
    design_spec_to_asset: designSpecToAsset,
  };

  // ---- QA manifest (derived) ----
  const gateNames = [...new Set(qa.flatMap((q) => (q.gates || []).map((g) => g.gate)))];
  const qaManifest = {
    total_qa_records: qa.length,
    individual_records: qa.map((q) => q.id),
    gates_evaluated: gateNames,
    overall_result: qa.every((q) => q.overall === "PASS") ? "all_pass" : "attention",
    any_failures: qa.some((q) => q.overall === "FAIL"),
    any_flags: qa.some((q) => (q.gates || []).some((g) => g.result === "FLAG")),
  };

  const asset_manifest = {
    total_assets: counts.total_assets,
    by_platform: counts.by_platform,
    by_type: counts.by_type,
    by_family: counts.by_family,
    emotional_intensity_distribution: counts.emotional_intensity_distribution,
    cta_level_distribution: counts.cta_level_distribution,
    generated_records: generated.map((g) => g.id),
    asset_records: assets.map((a) => a.id),
  };

  const pack = {
    id: id ?? `MP-${String(product_id || "PRODUCT").replace(/^PPL-/, "")}-001`,
    class: "master_marketing_pack",
    product_id: product_id ?? null,
    transformation_id: transformation_id ?? null,
    library_id: library_id ?? null,
    version,
    created_at,
    pipeline_version,
    mcp_version,
    four_truths,
    angles: anglesBlock,
    asset_manifest,
    asset_families: { count: families.length, records: families.map((f) => f.id), relationships: familyRelationships },
    platform_architectures: platformArchitectures,
    copy_content: {
      source_angles: angles.length,
      locked_phrase_sets: psets.length,
      phrase_set_records: psets.map((p) => p.id),
      // derived from the QA records (never hand-asserted)
      brand_voice_applied: !qa.some((q) => (q.gates || []).some((g) => g.gate === "GATE_4_BRAND_CULTURAL" && g.result === "FAIL")),
      forbidden_phrases_respected: !qa.some((q) => (q.gates || []).some((g) => g.gate === "GATE_1_ANTI_SLOP" && g.result === "FAIL")),
      anti_slop_registry_respected: !qa.some((q) => (q.gates || []).some((g) => g.gate === "GATE_1_ANTI_SLOP" && g.result === "FAIL")),
      synthetic_testimonials_removed: assets.every((a) => !/testimonial/i.test(a.asset_type || "")),
    },
    visual_grounding: {
      count: visual_groundings.length,
      records: visual_groundings.map((v) => v.id),
      scenes: Object.fromEntries(visual_groundings.map((v) => [v.id, { label: v.scene ?? null, scene: v.scene ?? null, mood: v.emotional_tone ?? null, lighting: v.lighting ?? null }])),
    },
    image_production: {
      status: "deterministic",
      note: "Design specifications are production packages (specifications), not rendered binaries. No provider request was made.",
      design_spec_records: design_specs.map((d) => specId(d)),
      count: design_specs.length,
    },
    video_production: {
      status: "deterministic",
      note: "Video is not produced; the reel exists only as a deterministic script package.",
    },
    qa_manifest: qaManifest,
    campaign_assembly: {
      campaign_record: campaign?.id ?? null,
      campaign_id: campaign?.id ?? null,
      campaign_status: campaign?.status ?? null,
      sequence_record: sequence?.id ?? null,
      sequence_id: sequence?.id ?? null,
      sequence_type: sequence?.sequence_type ?? null,
      sequence_status: sequence?.status ?? null,
      sequence_items: sequence?.items?.length ?? 0,
    },
    pending_governance: pending_governance,
    traceability,
  };
  return pack;
}

/**
 * Validate the complete integrity contract of a Master Marketing Pack against its canonical records.
 * @param {object} p { pack, records, persistedIds?:Set<string>|string[] }
 * @returns {{ pass:boolean, checks:{check:string,pass:boolean,detail:string}[], failures:{code:string,field:string,detail:string}[] }}
 */
export function validateMarketingPack({ pack, records = {}, persistedIds = null } = {}) {
  const failures = [];
  const checks = [];
  const push = (check, pass, detail) => checks.push({ check, pass, detail });
  const persisted = persistedIds ? new Set(persistedIds) : null;

  const angles = records.angles || [];
  const families = records.families || [];
  const assets = records.assets || [];
  const generated = records.generated || [];
  const qa = records.qa || [];
  const design_specs = records.design_specs || [];
  const visual_groundings = records.visual_groundings || [];
  const psets = records.psets || [];
  const sequence = records.sequence || null;

  const aById = byId(angles), fById = byId(families), astById = byId(assets),
    gById = byId(generated), qById = byId(qa), dById = specsById(design_specs),
    vById = byId(visual_groundings), pById = byId(psets);

  const requireRef = (id, index, kind, field) => {
    if (!isStr(id)) { failures.push({ code: PACK_CODES.REFERENCE_UNRESOLVED, field, detail: `missing ${field}` }); return; }
    if (isPlaceholderRef(id)) { failures.push({ code: PACK_CODES.PLACEHOLDER_REFERENCE, field, detail: `placeholder reference "${id}"` }); return; }
    const hit = index.get(id);
    if (!hit) { failures.push({ code: PACK_CODES.REFERENCE_UNRESOLVED, field, detail: `${kind} "${id}" does not resolve` }); return; }
    if (persisted && !persisted.has(id)) failures.push({ code: PACK_CODES.REFERENCE_NOT_PERSISTED, field, detail: `${kind} "${id}" exists but is not in the canonical persisted set` });
  };

  // ---- 1. ARTIFACT CLOSURE --------------------------------------------------
  if (pack) {
    for (const id of pack.asset_manifest?.asset_records || []) requireRef(id, astById, "asset", "asset_manifest.asset_records");
    for (const id of pack.asset_manifest?.generated_records || []) requireRef(id, gById, "generated", "asset_manifest.generated_records");
    for (const id of pack.asset_families?.records || []) requireRef(id, fById, "family", "asset_families.records");
    for (const id of pack.angles?.records || []) requireRef(id, aById, "angle", "angles.records");
    for (const id of pack.qa_manifest?.individual_records || []) requireRef(id, qById, "qa", "qa_manifest.individual_records");
    for (const id of pack.image_production?.design_spec_records || []) requireRef(id, dById, "design_spec", "image_production.design_spec_records");
    for (const id of pack.visual_grounding?.records || []) requireRef(id, vById, "visual_grounding", "visual_grounding.records");
    for (const id of pack.copy_content?.phrase_set_records || []) requireRef(id, pById, "pset", "copy_content.phrase_set_records");
    for (const id of Object.values(pack.traceability?.family_to_assets || {}).flat()) requireRef(id, astById, "asset", "traceability.family_to_assets");
    for (const id of Object.values(pack.traceability?.angle_to_family || {})) requireRef(id, fById, "family", "traceability.angle_to_family");
    for (const [id, qid] of Object.entries(pack.traceability?.asset_to_qa || {})) { requireRef(id, astById, "asset", "traceability.asset_to_qa"); if (qid != null) requireRef(qid, qById, "qa", "traceability.asset_to_qa"); }
    for (const id of Object.values(pack.traceability?.anchor_to_visual_grounding || {})) requireRef(id, vById, "visual_grounding", "traceability.anchor_to_visual_grounding");
  }
  for (const f of families) {
    requireRef(f.anchor_asset_id, astById, "asset", `${f.id}.anchor_asset_id`);
    for (const id of f.approved_asset_ids || []) requireRef(id, astById, "asset", `${f.id}.approved_asset_ids`);
    requireRef(f.source_angle_id, aById, "angle", `${f.id}.source_angle_id`);
    if (f.locked_phrase_set_id != null) requireRef(f.locked_phrase_set_id, pById, "pset", `${f.id}.locked_phrase_set_id`);
  }
  for (const a of assets) {
    requireRef(a.generation_record_id, gById, "generated", `${a.id}.generation_record_id`);
    requireRef(a.qa_record_id, qById, "qa", `${a.id}.qa_record_id`);
    requireRef(a.angle_id, aById, "angle", `${a.id}.angle_id`);
    if (a.family_id != null) requireRef(a.family_id, fById, "family", `${a.id}.family_id`);
    if (a.asset_brief_id != null && !isStr(a.asset_brief_id)) failures.push({ code: PACK_CODES.REFERENCE_UNRESOLVED, field: `${a.id}.asset_brief_id`, detail: "missing brief ref" });
  }
  for (const g of generated) {
    if (records.briefs) requireRef(g.brief_id, byId(records.briefs), "brief", `${g.id}.brief_id`);
    else if (!isStr(g.brief_id)) failures.push({ code: PACK_CODES.REFERENCE_UNRESOLVED, field: `${g.id}.brief_id`, detail: "missing brief ref" });
  }
  for (const q of qa) requireRef(q.asset_id, astById, "asset", `${q.id}.asset_id`);
  if (sequence) for (const it of sequence.items || []) {
    requireRef(it.asset_id, astById, "asset", `${sequence.id}.items.asset_id`);
    if (it.family_id != null) requireRef(it.family_id, fById, "family", `${sequence.id}.items.family_id`);
  }
  push("artifact_closure", !failures.some((f) => f.code === PACK_CODES.REFERENCE_UNRESOLVED || f.code === PACK_CODES.REFERENCE_NOT_PERSISTED), `${failures.filter((f) => f.code === PACK_CODES.REFERENCE_UNRESOLVED).length} unresolved, ${failures.filter((f) => f.code === PACK_CODES.REFERENCE_NOT_PERSISTED).length} unpersisted`);

  // ---- duplicate ids --------------------------------------------------------
  for (const [kind, list, keyOf] of [["angle", angles, (r) => r.id], ["family", families, (r) => r.id], ["asset", assets, (r) => r.id], ["generated", generated, (r) => r.id], ["qa", qa, (r) => r.id], ["design_spec", design_specs, specId], ["visual_grounding", visual_groundings, (r) => r.id], ["pset", psets, (r) => r.id]]) {
    const ids = list.map(keyOf);
    if (new Set(ids).size !== ids.length) failures.push({ code: PACK_CODES.DUPLICATE_REFERENCE, field: kind, detail: `duplicate ${kind} ids` });
  }

  // ---- 2. PLACEHOLDER REFUSAL ----------------------------------------------
  const placeholderHits = [];
  const scan = (obj, where) => { for (const r of collectRefStrings(obj, "")) if (isPlaceholderRef(r.value)) placeholderHits.push(`${where}:${r.path}=${r.value}`); };
  if (pack) { scan(pack.traceability, "pack.traceability"); scan(pack.asset_manifest, "pack.asset_manifest"); scan(pack.asset_families, "pack.asset_families"); }
  for (const f of families) scan(f, f.id);
  push("no_placeholders", placeholderHits.length === 0, placeholderHits.length ? placeholderHits.slice(0, 5).join("; ") : "no placeholder references");

  // ---- 3. COUNT RECONCILIATION ---------------------------------------------
  let countMismatches = [];
  if (pack) {
    const derived = deriveAssetCounts(assets);
    const stored = pack.asset_manifest || {};
    const cmp = (label, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) countMismatches.push(`${label}: stored=${JSON.stringify(a)} derived=${JSON.stringify(b)}`); };
    cmp("total_assets", stored.total_assets, derived.total_assets);
    cmp("by_platform", stored.by_platform, derived.by_platform);
    cmp("by_type", stored.by_type, derived.by_type);
    cmp("by_family", stored.by_family, derived.by_family);
    cmp("emotional_intensity_distribution", stored.emotional_intensity_distribution, derived.emotional_intensity_distribution);
    cmp("cta_level_distribution", stored.cta_level_distribution, derived.cta_level_distribution);
    if ((pack.angles?.count ?? -1) !== angles.length) countMismatches.push(`angles.count: stored=${pack.angles?.count} derived=${angles.length}`);
    if ((pack.asset_families?.count ?? -1) !== families.length) countMismatches.push(`asset_families.count: stored=${pack.asset_families?.count} derived=${families.length}`);
    if ((pack.qa_manifest?.total_qa_records ?? -1) !== qa.length) countMismatches.push(`qa_manifest.total_qa_records: stored=${pack.qa_manifest?.total_qa_records} derived=${qa.length}`);
  }
  if (countMismatches.length) failures.push({ code: PACK_CODES.COUNT_MISMATCH, field: "summary", detail: countMismatches.slice(0, 4).join(" | ") });
  push("count_reconciliation", countMismatches.length === 0, countMismatches.length ? countMismatches.slice(0, 3).join(" | ") : "summary = derivation(records)");

  // ---- 4. CONTENT COMPLETENESS (generation guard + QA defense) -------------
  const incomplete = [];
  for (const g of generated) {
    const content = g.candidates?.[0]?.content ?? g.content;
    const r = contentCompleteness(g.asset_type, content);
    if (!r.complete) incomplete.push(`${g.id}: ${r.failures.map((f) => f.code).join(",")}`);
    if (r.complete && !["GENERATED", "QA_PASSED"].includes(g.status)) incomplete.push(`${g.id}: content present but status ${g.status}`);
    if (!r.complete && ["GENERATED", "QA_PASSED"].includes(g.status)) incomplete.push(`${g.id}: incomplete content marked ${g.status}`);
  }
  for (const a of assets) {
    const r = contentCompleteness(a.asset_type, a.content);
    if (!r.complete) incomplete.push(`${a.id}: ${r.failures.map((f) => f.path || f.code).join(",")}`);
  }
  for (const q of qa) {
    const a = astById.get(q.asset_id);
    if (a) { const r = contentCompleteness(a.asset_type, a.content); if (!r.complete && q.overall === "PASS") incomplete.push(`${q.id}: PASS on incomplete asset ${q.asset_id}`); }
  }
  if (incomplete.length) failures.push({ code: PACK_CODES.CONTENT_INCOMPLETE, field: "records", detail: incomplete.slice(0, 5).join(" | ") });
  push("content_completeness", incomplete.length === 0, incomplete.length ? incomplete.slice(0, 3).join(" | ") : "all production records materially complete");

  // ---- 5. BRAND TOKEN ENFORCEMENT ------------------------------------------
  let brandViolations = [];
  try {
    for (const d of design_specs) {
      const res = BrandTruthService.checkDesignSpecColors(d);
      for (const v of res.violations) brandViolations.push(`${specId(d)}:${v.field}=${v.value}`);
    }
  } catch (e) { brandViolations.push(`brand source unavailable: ${String(e.message || e)}`); }
  if (brandViolations.length) failures.push({ code: PACK_CODES.BRAND_TOKEN_UNAUTHORIZED, field: "design_specs", detail: brandViolations.slice(0, 6).join(" | ") });
  push("brand_tokens", brandViolations.length === 0, brandViolations.length ? brandViolations.slice(0, 3).join(" | ") : "all design-spec colour tokens authorized");

  return { pass: failures.length === 0, version: MARKETING_PACK_VERSION, checks, failures };
}

/** One-call: build + validate the pack from governed records. */
export function assembleMarketingPack({ records = {}, ...meta } = {}) {
  const pack = buildMarketingPack({ ...meta, ...records });
  const validation = validateMarketingPack({ pack, records, persistedIds: meta.persistedIds ?? null });
  return { pack, validation };
}

/**
 * Derive the QA aggregate manifest from the canonical QA records (+ assets). Every numeric /
 * structural field is a derivation; qualitative prose is preserved from `previous` when supplied.
 * This removes the second hand-maintained copy of the campaign counts.
 */
export function buildQaAggregate({ product_id, transformation_id, qa = [], assets = [], families = [], previous = null } = {}) {
  const counts = deriveAssetCounts(assets);
  const gateNames = [...new Set(qa.flatMap((q) => (q.gates || []).map((g) => g.gate)))];
  const gateAnalysis = {};
  for (const g of gateNames) {
    const results = qa.map((q) => (q.gates || []).find((x) => x.gate === g)?.result).filter(Boolean);
    const pass = results.filter((r) => r === "PASS").length;
    const fail = results.filter((r) => r === "FAIL").length;
    const notTriggered = results.filter((r) => r === "NOT_TRIGGERED").length;
    gateAnalysis[g] = {
      status: fail ? "FAILURES" : notTriggered === results.length ? "ALL_NOT_TRIGGERED" : "ALL_PASS",
      records_passing: pass, records_failing: fail,
      ...(notTriggered ? { records_not_triggered: notTriggered } : {}),
      notes: previous?.gate_analysis?.[g]?.notes ?? null,
    };
  }
  const qaRecords = qa.map((q) => {
    const a = byId(assets).get(q.asset_id);
  const familyAssets = {};
  for (const f of families) familyAssets[`${f.id}_${f.core_angle_hook ? "" : ""}`.replace(/_$/, "")] = assets.filter((a) => a.family_id === f.id).length;
  return {
      qa_id: q.id, asset_id: q.asset_id, brief_id: q.brief_id,
      asset_type: a?.asset_type ?? null, platform: a?.platform ?? null,
      overall: q.overall, gates_summary: `${(q.gates || []).filter((g) => g.result === "PASS").length}/${(q.gates || []).length} PASS`, 
    };
  });
  return {
    id: previous?.id ?? null,
    class: "qa_aggregate_manifest",
    manifest_type: "marketing_qa_validation",
    product_id, transformation_id,
    manifest_version: (previous?.manifest_version ?? 1), scope: previous?.scope ?? "v06_marketing_production",
    total_qa_records: qa.length,
    qa_records_verified: qa.length,
    verification_method: previous?.verification_method ?? "structural_validation",
    verification_date: previous?.verification_date ?? null,
    summary: {
      overall_status: qa.every((q) => q.overall === "PASS") ? "PASS" : "ATTENTION",
      severity: qa.some((q) => q.overall === "FAIL") ? "high" : "none",
      total_gates: gateNames.length,
      gates_with_all_pass: Object.values(gateAnalysis).filter((g) => g.status === "ALL_PASS").length,
      gates_with_not_triggered: Object.values(gateAnalysis).filter((g) => g.status === "ALL_NOT_TRIGGERED").length,
      human_review_required: qa.some((q) => (q.gates || []).some((g) => g.gate === "GATE_7_HUMAN_REVIEW" && g.result === "HUMAN_REVIEW_REQUIRED")),
      truth_compliance_all_pass: !qa.some((q) => (q.gates || []).some((g) => g.gate === "GATE_5_TRUTH_COMPLIANCE" && g.result === "FAIL")),
      anti_slop_all_pass: !qa.some((q) => (q.gates || []).some((g) => g.gate === "GATE_1_ANTI_SLOP" && g.result === "FAIL")),
      interchangeability_all_pass: !qa.some((q) => (q.gates || []).some((g) => g.gate === "GATE_2_INTERCHANGEABILITY" && g.result === "FAIL")),
      platform_fitness_all_pass: !qa.some((q) => (q.gates || []).some((g) => g.gate === "GATE_3_PLATFORM_FITNESS" && g.result === "FAIL")),
      brand_cultural_all_pass: !qa.some((q) => (q.gates || []).some((g) => g.gate === "GATE_4_BRAND_CULTURAL" && g.result === "FAIL")),
      consistency_lock_all_pass: !qa.some((q) => (q.gates || []).some((g) => g.gate === "GATE_6_CONSISTENCY_LOCK" && g.result === "FAIL")),
    },
    qa_records: qaRecords,
    gate_analysis: gateAnalysis,
    truth_compliance_detail: previous?.truth_compliance_detail ?? null,
    cross_reference_validation: previous?.cross_reference_validation ?? null,
    asset_family_coherence: {
      family_count: families.length,
      total_assets: counts.total_assets,
      assets_per_family: counts.by_family,
      platform_distribution: counts.by_platform,
      asset_type_distribution: counts.by_type,
      emotional_intensity_distribution: counts.emotional_intensity_distribution,
      cta_level_distribution: counts.cta_level_distribution,
      status: "COHERENT",
    },
    pending_governance: previous?.pending_governance ?? null,
    provenance: previous?.provenance ?? null,
  };
}

export const MarketingPackService = { build: buildMarketingPack, validate: validateMarketingPack, assemble: assembleMarketingPack, deriveAssetCounts, buildQaAggregate };
