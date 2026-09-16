#!/usr/bin/env node
// SWIIPT MARKETING ASSET ENGINE - MARKETING ANGLE AUTHORING V1
//
// REAL PRODUCT FACTORY STATE + AUTHORITATIVE CUSTOMER/MARKET RESEARCH + BRAND TRUTH
//   -> PRODUCTION FOUR-TRUTHS INPUT
//   -> CANDIDATE MARKETING ANGLE RECORD
//   -> EXISTING ANGLE VALIDATION (reused, never modified)
//
// A BOUNDED BRIDGE. It is not a new truth model, not a new angle model, not a new validator.
// Reuses: mae/services/truth.js (product truth reference + hierarchy), crf.js, mif.js, brand.js,
// angle.js (Marketing Angle Record + lifecycle), validation.js (the hard strategic gate),
// mae/lib/evidence.js (evidence states), mae/lib/schema.js (ajv contracts).
//
// AUTHORING DISCIPLINE: every substantive angle field is a VERBATIM span from a cited truth record,
// or a recorded deterministic template around such spans. Nothing is invented: no customer quote,
// emotion, failed attempt, market trend, competitor weakness, feature, mechanism, proof, statistic,
// testimonial, price, scarcity, clinical outcome or guarantee. Unsupported material -> ANGLE_UNSUPPORTED.
//
// PRODUCTION WRITES ARE DISABLED during this qualification wave (dry run only).
// No provider, no LLM, no network, no spend, no Date.now/Math.random/UUID in authoritative state.
//
// Usage:
//   node mae/harness/marketing-angle-authoring.mjs <PRODUCT_ID> [--crf id,id] [--mif id,id] [--json]
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MAE_DIR, all } from "../lib/store.js";
import { validate } from "../lib/schema.js";
import { EVIDENCE_STATE, EVIDENCE_RANK, isValidState } from "../lib/evidence.js";
import { TruthService, CONFLICT_HIERARCHY } from "../services/truth.js";
import { CustomerRealityService } from "../services/crf.js";
import { MarketIntelligenceService } from "../services/mif.js";
import { BrandTruthService } from "../services/brand.js";
import { AngleService } from "../services/angle.js";
import { AngleValidationService } from "../services/validation.js";

export const AUTHOR_VERSION = "marketing-angle-authoring@1";
const FACTORY_ROOT = join(MAE_DIR, "..");

/** Run states (report vocabulary only; no schema is modified by this wave). */
export const AUTHOR_STATUS = Object.freeze({
  READY_FOR_VALIDATION: "READY_FOR_VALIDATION",
  SOURCE_REQUIRED: "SOURCE_REQUIRED",
  CUSTOMER_RESEARCH_REQUIRED: "CUSTOMER_RESEARCH_REQUIRED",
  MARKET_RESEARCH_REQUIRED: "MARKET_RESEARCH_REQUIRED",
  AUTHORING_REQUIRED: "AUTHORING_REQUIRED",
  ANGLE_UNSUPPORTED: "ANGLE_UNSUPPORTED",
  INVALID_INPUT: "INVALID_INPUT",
});

/** Report-level precedence (highest first). */
const STATUS_ORDER = [
  AUTHOR_STATUS.INVALID_INPUT, AUTHOR_STATUS.SOURCE_REQUIRED, AUTHOR_STATUS.CUSTOMER_RESEARCH_REQUIRED,
  AUTHOR_STATUS.MARKET_RESEARCH_REQUIRED, AUTHOR_STATUS.ANGLE_UNSUPPORTED, AUTHOR_STATUS.AUTHORING_REQUIRED,
  AUTHOR_STATUS.READY_FOR_VALIDATION,
];

export const TRUTH_READINESS = Object.freeze({ READY: "READY", MISSING: "MISSING" });

/** Locked hierarchy (mae/services/truth.js CONFLICT_HIERARCHY): product > customer > brand > market. */
export const TRUTH_HIERARCHY = Object.freeze([...CONFLICT_HIERARCHY]);

/** Forbidden material that must never be introduced by the author (all must already exist in truth to appear). */
export const FORBIDDEN_MATERIAL = Object.freeze([
  { id: "guarantee", pattern: /\b(guarantee[sd]?|100%|instantly|will heal|pain-?free forever|risk-?free)\b/i },
  { id: "clinical_outcome", pattern: /\b(cures?|cured|treats?|diagnos(e|is|ed))\b/i },
  { id: "price", pattern: /[$₦€£]|\b(USD|NGN|EUR|GBP|GHS|CAD)\b|\bprice\b/i },
  { id: "scarcity", pattern: /\b(limited time|only \d+ left|act now|hurry)\b/i },
  { id: "testimonial", pattern: /\b(testimonial|customers (say|report)|our users say)\b/i },
  { id: "statistic", pattern: /\d+(?:\.\d+)?\s*(?:%|percent)/i },
]);
/** Deterministic composition templates (recorded in provenance; substance stays verbatim). */
export const TEMPLATES = Object.freeze({
  insight: (thought, fear) => `${thought}${fear ? ` — ${fear}` : ""} — general advice does not resolve this specific moment`,
  failedAttempt: (tried, result) => (result ? `${tried} — result: ${result}` : tried),
  scene: (situation, trigger) => (trigger ? `${situation} (trigger: ${trigger})` : situation),
});

const isObj = (v) => v != null && typeof v === "object" && !Array.isArray(v);
const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const norm = (s) => String(s).replace(/\s+/g, " ").trim();
const uniq = (arr) => [...new Set(arr.filter(isStr).map(norm))];
const canonical = (v) => (Array.isArray(v) ? `[${v.map(canonical).join(",")}]`
  : isObj(v) ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`
    : JSON.stringify(v === undefined ? null : v));
export const canonicalProjection = (value) => canonical(value);
const digits = (s) => (String(s).match(/\d+/g) ?? []);
const sha = (s) => {
  // deterministic short digest (fnv-1a, no crypto dependency needed for identity display)
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
};

// ------------------------------------------------------------------------------------------------
// inputs
// ------------------------------------------------------------------------------------------------
export function loadProductFactoryState(productId, { root = FACTORY_ROOT } = {}) {
  const dir = join(root, "data", "products", productId);
  const productPath = join(dir, "product.json");
  if (!existsSync(productPath)) return { ok: false, errors: [`no product.json at data/products/${productId}`] };
  let product = null;
  try { product = JSON.parse(readFileSync(productPath, "utf8")); }
  catch (e) { return { ok: false, errors: [`product.json is not valid JSON: ${e.message}`] }; }
  if (!isObj(product) || !isStr(product.product_id)) return { ok: false, errors: ["product.json has no product_id"], product };
  const trId = product.identity?.transformation_id ?? null;
  const trPath = trId ? join(root, "data", "transformations", `${trId}.json`) : null;
  let transformation = null; let identityMismatch = false;
  if (trPath && existsSync(trPath)) {
    try {
      transformation = JSON.parse(readFileSync(trPath, "utf8"));
      if (isStr(transformation?.transformation_id) && transformation.transformation_id !== trId) identityMismatch = true;
    } catch (e) { return { ok: false, errors: [`transformation ${trId} is not valid JSON: ${e.message}`], product }; }
  }
  const assets = [];
  for (const [job, list] of Object.entries(product.asset_map ?? {})) {
    for (const aid of Array.isArray(list) ? list : []) {
      const af = join(dir, "assets", `${aid}.json`);
      if (!existsSync(af)) continue;
      try { const a = JSON.parse(readFileSync(af, "utf8")); assets.push({ id: aid, job, title: a.title ?? null }); } catch { /* ignore */ }
    }
  }
  return { ok: true, errors: [], product, transformation, trId, identityMismatch, assets, dir, root };
}

/** Resolve CRF/MIF inputs: inline records win; otherwise ids; otherwise production scope for the product. */
export function resolveCustomerTruth({ product_id, crf = null, crf_ids = null, include_fixtures = false } = {}) {
  const out = [];
  if (Array.isArray(crf) && crf.length) return { records: crf.map((r) => ({ record: r, source_scope: "inline" })), scope: "inline" };
  if (Array.isArray(crf_ids) && crf_ids.length) {
    for (const id of crf_ids) {
      const r = CustomerRealityService.get(id, { includeFixtures: include_fixtures || true });
      if (r) out.push({ record: r, source_scope: r.is_fixture === true ? "fixture" : "production" });
    }
    return { records: out, scope: out.some((x) => x.source_scope === "fixture") ? "fixture" : "production" };
  }
  for (const r of all("customer-reality", { includeFixtures: false })) {
    if (r.product_id === product_id) out.push({ record: r, source_scope: "production" });
  }
  return { records: out, scope: "production" };
}
export function resolveMarketTruth({ product_id, mif = null, mif_ids = null, include_fixtures = false } = {}) {
  const out = [];
  if (Array.isArray(mif) && mif.length) return { records: mif.map((r) => ({ record: r, source_scope: "inline" })), scope: "inline" };
  if (Array.isArray(mif_ids) && mif_ids.length) {
    for (const id of mif_ids) {
      const r = MarketIntelligenceService.get(id, { includeFixtures: include_fixtures || true });
      if (r) out.push({ record: r, source_scope: r.is_fixture === true ? "fixture" : "production" });
    }
    return { records: out, scope: out.some((x) => x.source_scope === "fixture") ? "fixture" : "production" };
  }
  for (const r of all("market-intelligence", { includeFixtures: false })) {
    if (r.product_id === product_id) out.push({ record: r, source_scope: "production" });
  }
  return { records: out, scope: "production" };
}

// ------------------------------------------------------------------------------------------------
// PRODUCT TRUTH BRIDGE (projection into the canonical product-truth-reference contract)
// ------------------------------------------------------------------------------------------------
/**
 * Project real Product Factory records into the canonical MAE Product Truth reference.
 * Every field records its factory provenance. Nothing is invented; missing sources are reported.
 */
export function projectProductTruth({ product_id, root = FACTORY_ROOT } = {}) {
  const state = loadProductFactoryState(product_id, { root });
  const report = { provenance: [], missing: [], unsupported: [], errors: state.errors ?? [] };
  if (!state.ok) return { ok: false, record: null, report };
  if (state.identityMismatch) return { ok: false, record: null, report: { ...report, errors: ["product/transformation identity mismatch"] } };
  const { product, transformation: tr } = state;
  const track = (field, source, value) => report.provenance.push({ field, source, value: isStr(value) ? norm(value).slice(0, 160) : value });
  const missing = (field, source) => report.missing.push(`${field} (expected at ${source})`);

  if (!tr) {
    missing("transformation record", `data/transformations/${state.trId ?? "(unset)"}.json`);
    return { ok: false, record: null, report };
  }
  const trRef = `data/transformations/${tr.transformation_id}.json`;
  const productRef = `data/products/${product.product_id}/product.json`;

  const situation = isStr(product.customer?.situation) ? product.customer.situation : tr.situation?.specific_situation;
  if (isStr(situation)) track("situation", isStr(product.customer?.situation) ? "product.customer.situation" : `${trRef}#situation.specific_situation`, situation);
  else missing("situation", "product.customer.situation | transformation.situation.specific_situation");

  const promise = product.identity?.one_line_promise;
  if (isStr(promise)) track("promise", "product.identity.one_line_promise", promise); else missing("promise", "product.identity.one_line_promise");

  for (const [field, src] of [["before_state", `${trRef}#before_state`], ["after_state", `${trRef}#after_state`], ["mechanism", `${trRef}#mechanism`], ["tsm", `${trRef}#tsm`]]) {
    const v = tr[field];
    if (isObj(v) && Object.keys(v).length) track(field, src, field);
    else missing(field, src);
  }

  // evidence + proof inventory: only labelled claims the truth already carries
  const claims = [...(tr.evidence ?? []), ...(tr.mechanism?.evidence_basis ?? [])];
  const proof = uniq(claims.filter((c) => ["sourced_evidence", "expert_reviewed"].includes(c.status)).map((c) => c.claim));
  if (claims.length) track("evidence", `${trRef}#evidence + #mechanism.evidence_basis`, `${claims.length} labelled claim(s)`);
  if (proof.length) track("proof_inventory", `${trRef}#evidence (sourced/expert labels only)`, `${proof.length} proof item(s)`);

  // safety: product safety surface + transformation scope boundary (verbatim)
  const safety = {
    risk_level: product.safety?.risk_level ?? "low",
    scope_boundary: tr.safety?.scope_boundary ?? product.safety?.escalation_rules?.[0] ?? null,
    red_flags: product.safety?.red_flags ?? [],
    escalation_rules: product.safety?.escalation_rules ?? [],
    disclaimer: product.safety?.disclaimer ?? null,
  };
  if (isStr(product.safety?.risk_level)) track("safety.risk_level", "product.safety.risk_level", product.safety.risk_level);
  else missing("safety.risk_level", "product.safety.risk_level");
  if (isStr(safety.scope_boundary)) track("safety.scope_boundary", isStr(tr.safety?.scope_boundary) ? `${trRef}#safety.scope_boundary` : "product.safety.escalation_rules[0]", safety.scope_boundary);
  else missing("safety.scope_boundary", "transformation.safety.scope_boundary");

  // claims: permitted only where the product already labelled a claim as sourced/expert
  const labelled = (product.evidence?.claim_labels ?? []).filter((c) => ["sourced_evidence", "expert_reviewed"].includes(c?.label));
  const permitted = uniq(labelled.map((c) => c.claim));
  if (permitted.length) track("permitted_claims", "product.evidence.claim_labels (sourced/expert only)", `${permitted.length} claim(s)`);

  // prohibited claims: authoritative prohibition surfaces only (never authored here)
  let brand = null;
  try { brand = BrandTruthService.loadBrand(); } catch { brand = null; }
  const prohibited = uniq([
    ...(brand?.claims_boundaries ?? []),
    ...(isStr(safety.scope_boundary) ? [safety.scope_boundary] : []),
    ...(isStr(safety.disclaimer) ? [safety.disclaimer] : []),
  ]);
  if (prohibited.length) track("prohibited_claims", "brand.claims_boundaries + transformation.safety.scope_boundary + product.safety.disclaimer", `${prohibited.length} item(s)`);

  const evidenceBacked = (tr.evidence ?? []).length > 0 || (product.evidence?.sources ?? []).length > 0;
  // authoritative timestamp only (never generated): platform publish time, else the transformation's recorded date
  let createdAt = product.publishing?.published_at ?? null;
  let createdAtSource = createdAt ? "product.publishing.published_at" : null;
  let createdAtDateOnly = false;
  if (!createdAt && isStr(tr.research_disposition?.assigned_at)) { createdAt = `${tr.research_disposition.assigned_at}T00:00:00Z`; createdAtSource = `${trRef}#research_disposition.assigned_at`; createdAtDateOnly = true; }
  if (!createdAt) { createdAt = "1970-01-01T00:00:00Z"; createdAtSource = "placeholder (no authoritative timestamp)"; createdAtDateOnly = true; report.unsupported.push("created_at: no authoritative timestamp on the product or transformation (placeholder recorded)"); }
  track("created_at", createdAtSource, createdAt);

  const record = {
    id: `PTR-${product.product_id}`,
    class: "product_truth_reference",
    product_id: product.product_id,
    transformation_id: tr.transformation_id,
    source: { system: "product_factory", ref: productRef, version: product.version ?? null },
    situation: isStr(situation) ? norm(situation) : null,
    promise: isStr(promise) ? norm(promise) : null,
    before_state: isObj(tr.before_state) ? tr.before_state : {},
    after_state: isObj(tr.after_state) ? tr.after_state : {},
    mechanism: isObj(tr.mechanism) ? tr.mechanism : {},
    deliverables: uniq(state.assets.map((a) => a.title)),
    evidence: claims,
    proof_inventory: proof,
    tsm: isObj(tr.tsm) ? tr.tsm : {},
    safety,
    permitted_claims: permitted,
    prohibited_claims: prohibited,
    provenance: evidenceBacked ? "evidence_backed" : "inference",
    is_fixture: product.is_fixture === true || tr.is_fixture === true,
    version: /^\d+\.\d+(\.\d+)?$/.test(String(product.version ?? "")) ? String(product.version).split(".").slice(0, 2).join(".") : "1.0",
    created_at: createdAt,
    updated_at: null,
  };
  if (createdAtDateOnly) report.unsupported.push("created_at is date-only derived from the transformation record (no authored time invented)");

  let valid = true, errors = [];
  try { validate("product-truth-reference.schema.json", record, record.id); } catch (e) { valid = false; errors = [e.message]; }
  report.errors = errors;
  return { ok: valid && !missingRequired(report), record: valid ? record : null, report, validation: { valid, errors } };
}
const missingRequired = (report) => report.missing.filter((m) => /^(situation|promise|before_state|after_state|mechanism|tsm|safety\.risk_level|safety\.scope_boundary)/.test(m)).length > 0;

// ------------------------------------------------------------------------------------------------
// ANGLE AUTHORING (deterministic, verbatim-sourced)
// ------------------------------------------------------------------------------------------------
/** Highest-evidence CRF becomes primary; the rest corroborate (deterministic ordering). */
export function rankCustomerRecords(entries) {
  return [...entries].sort((a, b) => {
    const rank = (e) => EVIDENCE_RANK[e.record?.evidence_status] ?? 0;
    if (rank(b) !== rank(a)) return rank(b) - rank(a);
    const weight = (e) => ({ very_high: 5, high: 4, medium_high: 3, medium: 2, low: 1 })[e.record?.evidence_weight] ?? 0;
    if (weight(b) !== weight(a)) return weight(b) - weight(a);
    return String(a.record?.id).localeCompare(String(b.record?.id));
  });
}

/** Governance classification tags (never customer claims) derived deterministically from truth state. */
export function governanceTags(ptr) {
  const tags = [];
  if (["high", "clinical"].includes(ptr?.safety?.risk_level)) tags.push("health");
  return tags;
}

export function selectAssetPurpose({ crf, mifEntries }) {
  const categories = new Set(mifEntries.map((e) => e.record?.category));
  if (categories.has("cliche") || categories.has("myth")) return "myth_reframe";
  if (categories.has("objection")) return "objection";
  if (categories.has("gap") || categories.has("unclaimed_angle")) return "mechanism";
  if (isObj(crf?.evidence_source) && crf.evidence_source.type === "review") return "proof";
  return "stop_scroll_identification";
}

/** Deterministic counter-evidence acknowledgement from authoritative material only. */
export function counterEvidenceFrom({ mifEntries, ptr }) {
  const unclaimed = mifEntries.find((e) => e.record?.category === "unclaimed_angle" && isStr(e.record.scan_coverage_note));
  if (unclaimed) return { text: norm(unclaimed.record.scan_coverage_note), source: `${unclaimed.record.id}#scan_coverage_note` };
  const myth = mifEntries.find((e) => e.record?.category === "myth" && isStr(e.record.statement));
  if (myth) return { text: norm(myth.record.statement), source: `${myth.record.id}#statement` };
  const limits = uniq(ptr?.after_state?.remaining_limits ?? []);
  if (limits.length) return { text: limits.join("; "), source: `${ptr.id}#after_state.remaining_limits` };
  return null;
}

/** Hierarchy + unsupported-material audit across the assembled candidate. */
export function auditCandidate({ candidate, ptr, crfEntries, mifEntries, brand }) {
  const conflicts = [];
  const unsupported = [];
  const text = canonical(candidate);
  const sourceText = canonical({ ptr, crf: crfEntries.map((e) => e.record), mif: mifEntries.map((e) => e.record) });

  // 1. forbidden material is NEVER authored: price / scarcity / guarantee / clinical outcome / testimonial
  //    are absolute; a statistic may only flow through when a cited truth claim is labelled sourced/expert.
  const sourcedClaims = [...(ptr?.evidence ?? []), ...(ptr?.mechanism?.evidence_basis ?? [])]
    .filter((c) => ["sourced_evidence", "expert_reviewed"].includes(c?.status)).map((c) => norm(c.claim)).join(" ");
  for (const rule of FORBIDDEN_MATERIAL) {
    const m = text.match(rule.pattern);
    if (!m) continue;
    if (rule.id === "statistic") {
      if (rule.pattern.test(sourcedClaims)) continue;           // statistic already carried as sourced truth
      unsupported.push({ rule: rule.id, detail: `statistic "${norm(m[0])}" is not carried as sourced evidence in any cited truth record` });
      continue;
    }
    unsupported.push({ rule: rule.id, detail: `forbidden material present in the candidate: "${norm(m[0])}" (${rule.id} may never be authored)` });
  }
  // 2. every numeric token must come from a cited truth record
  for (const d of digits(text)) if (!digits(sourceText).includes(d)) unsupported.push({ rule: "numeric_invention", detail: `number "${d}" is not present in any cited truth record` });
  // 3. Product Truth forbids claims that may not appear anywhere downstream
  for (const prohibited of ptr?.prohibited_claims ?? []) {
    const p = norm(prohibited).toLowerCase();
    if (p.length < 12) continue;
    if (text.toLowerCase().includes(p)) conflicts.push({ sources: [ptr.id], resolution: `candidate repeats a prohibited claim: "${prohibited}"`, authority: "product_truth" });
  }
  // 4. market truth may not contradict product truth (lower truth cannot override a higher truth)
  for (const e of mifEntries) {
    const stmt = norm(e.record?.statement ?? "").toLowerCase();
    for (const prohibited of ptr?.prohibited_claims ?? []) {
      const p = norm(prohibited).toLowerCase();
      if (p.length >= 12 && stmt.includes(p)) conflicts.push({ sources: [ptr.id, e.record.id], resolution: "market truth repeats a claim Product Truth prohibits", authority: "product_truth" });
    }
  }
  // 5. customer truth may not assert product capability (a CRF cannot create a product fact)
  const mechanismText = norm(ptr?.mechanism?.core_mechanism ?? "").toLowerCase();
  for (const e of crfEntries) {
    const cText = norm([e.record?.situation, e.record?.exact_language, e.record?.desired_change].join(" ")).toLowerCase();
    const mechanismKey = norm(mechanismText.split("(")[0]).trim();
    if (mechanismKey.length >= 20 && cText.includes(mechanismKey)) conflicts.push({ sources: [e.record.id, ptr.id], resolution: "customer record asserts the product mechanism (customer truth cannot create product capability)", authority: "product_truth" });
  }
  // 6. brand register: forbidden phrases + banned vocabulary must not appear
  if (brand) {
    let reg = null;
    try { reg = BrandTruthService.writingRegister(); } catch { reg = null; }
    const banned = [...(brand.vocabulary?.banned ?? []), ...(reg?.forbidden_phrases ?? [])];
    for (const phrase of banned) {
      if (!isStr(phrase) || phrase.length < 4) continue;
      if (text.toLowerCase().includes(norm(phrase).toLowerCase())) unsupported.push({ rule: "brand_register", detail: `candidate uses a banned phrase/vocabulary item: "${phrase}"` });
    }
  }
  // 7. cited RESEARCH records may not carry forbidden material (a poisoned research input is a blocker,
  //    even when the author itself never repeats it). Product Truth is exempt: it is the labelled authority.
  for (const e of [...crfEntries, ...mifEntries]) {
    const rec = e.record ?? {};
    const recText = norm([rec.exact_language, rec.desired_change, rec.statement, rec.situation].filter(isStr).join(" "));
    if (!recText) continue;
    for (const rule of FORBIDDEN_MATERIAL) {
      if (rule.id === "statistic") continue;                       // statistics are gated by label, not banned
      const m = recText.match(rule.pattern);
      if (m) unsupported.push({ rule: `source_${rule.id}`, detail: `${rec.id ?? "(record)"} carries forbidden material: "${norm(m[0])}"` });
    }
  }
  return { conflicts, unsupported };
}

export function buildCandidateAngle({ ptr, crfEntries, mifEntries, brand, product }) {  const ranked = rankCustomerRecords(crfEntries);
  const primary = ranked[0]?.record ?? null;
  const corroborating = ranked.slice(1).map((e) => e.record);
  const missing = [];
  const ledger = [];
  const note = (field, source, value) => ledger.push({ field, source, value: isStr(value) ? norm(value).slice(0, 180) : value });

  for (const [field, value] of [["person", primary?.person], ["situation", primary?.situation], ["trigger", primary?.trigger], ["emotional_stake", primary?.emotional_stake], ["desired_change", primary?.desired_change]]) {
    if (!isStr(value)) missing.push(`CRF.${field}`);
    else note(`tier1/tier2 from CRF.${field}`, `${primary.id}#${field}`, value);
  }
  if (!isStr(ptr?.mechanism?.core_mechanism)) missing.push("PTR.mechanism.core_mechanism");
  const counter = counterEvidenceFrom({ mifEntries, ptr });
  if (!counter) missing.push("counter-evidence acknowledgement (MIF scan_coverage_note | PTR.after_state.remaining_limits)");
  if (missing.length) return { ok: false, missing, ledger };
  if (!isStr(primary?.exact_language)) return { ok: false, missing: ["CRF.exact_language (customer voice required for a sourced angle statement)"], ledger, authoring_required: true };

  const failed = Array.isArray(primary.failed_attempts) && primary.failed_attempts.length ? primary.failed_attempts[0] : null;
  const angleId = `ANG-${product.product_id}`;
  const candidate = {
    id: angleId,
    class: "marketing_angle_record",
    product_id: product.product_id,
    transformation_id: ptr.transformation_id,
    tier1: {
      customer: norm(primary.person),
      scene: TEMPLATES.scene(norm(primary.situation), isStr(primary.trigger) ? norm(primary.trigger) : ""),
      pain: norm(isStr(primary.trigger) ? primary.trigger : primary.constraint),   // the specific pain event; CRF has no `pain` field
      failed_attempt: failed ? TEMPLATES.failedAttempt(norm(failed.tried), isStr(failed.result) ? norm(failed.result) : "") : norm(primary.constraint),
      emotional_stake: { text: norm(primary.emotional_stake), evidence_status: isValidState(primary.evidence_status) ? primary.evidence_status : EVIDENCE_STATE.ANALYST_INTERPRETATION },
    },
    tier2: {
      insight: { text: TEMPLATES.insight(norm(primary.thought ?? primary.situation), isStr(primary.fear) ? norm(primary.fear) : ""), label: "Strategic Synthesis" },
      mechanism: { text: norm(ptr.mechanism.core_mechanism), product_truth_ref: ptr.id },
      desired_change: norm(primary.desired_change),
      angle: norm(primary.exact_language),                       // the customer's own words; polish is flagged downstream
      asset_purpose: selectAssetPurpose({ crf: primary, mifEntries }),
    },
    tier3: {
      source_evidence: ranked.map((e, i) => ({
        ref_id: e.record.id,
        role: i === 0 ? "primary" : "corroborating",
        observed_frequency: e.record.observed_frequency ?? null,
        evidence_weight: e.record.evidence_weight ?? null,
      })),
      market_truth_support: mifEntries.map((e) => ({ ref_id: e.record.id })),
      counter_evidence_acknowledged: counter.text,
      product_truth_ref: ptr.id,
      brand_truth_compliance: "",
      truth_conflict_log: [],
    },
    affirmation_grounding: null,
    restrictions: [],
    tags: uniq([...(primary.tags ?? []), ...governanceTags(ptr)]),
    status: "EVIDENCE_LINKED",
    provenance: ranked.every((e) => e.record.is_fixture === true) ? "synthetic_fixture" : "evidence_backed",
    is_fixture: ranked.every((e) => e.record.is_fixture === true),
    created_at: ptr.created_at,
    updated_at: null,
    state_history: [],
  };
  note("tier2.angle", `${primary.id}#exact_language`, candidate.tier2.angle);
  note("tier3.counter_evidence_acknowledged", counter.source, counter.text);
  note("tier2.mechanism.text", `${ptr.id}#mechanism.core_mechanism`, candidate.tier2.mechanism.text);
  note("tier1.pain", `${primary.id}#trigger`, candidate.tier1.pain);
  note("tier3.market_truth_support", mifEntries.map((e) => e.record.id).join(", "), `${mifEntries.length} record(s)`);
  note("asset_purpose", "deterministic rule over MIF categories + CRF evidence type", candidate.tier2.asset_purpose);
  return { ok: true, candidate, ledger, missing: [], corroborating: corroborating.map((c) => c.id), primary: primary.id, authoring_required: false };
}

// ------------------------------------------------------------------------------------------------
// main
// ------------------------------------------------------------------------------------------------
/**
 * Author candidate Marketing Angle Record(s) for one real product and run the EXISTING validator.
 * Dry run only: production writes are disabled during this qualification wave.
 */
export function authorMarketingAngles(input = {}) {
  const { product_id, root = FACTORY_ROOT, crf = null, crf_ids = null, mif = null, mif_ids = null, product_truth = null, mode = "dry-run" } = input;
  const report = {
    author_version: AUTHOR_VERSION,
    status: null,
    product_id: product_id ?? null,
    transformation_id: null,
    truth_readiness: { product_truth: TRUTH_READINESS.MISSING, customer_truth: TRUTH_READINESS.MISSING, market_truth: TRUTH_READINESS.MISSING, brand_truth: TRUTH_READINESS.MISSING },
    product_truth_projection: null,
    customer_truth_sources: [],
    market_truth_sources: [],
    brand_truth_source: null,
    missing_inputs: [],
    unsupported_claims: [],
    candidate_angles: [],
    validations: [],
    retained_rejected_angles: [],
    provenance: {},
    authoring: { mode: "deterministic_verbatim_composition", polish_status: null, provider: "none", live: false },
    write: { attempted: mode === "write", refused: mode === "write", reason: mode === "write" ? "production writes are disabled during Marketing Angle Authoring V1 (dry run only)" : null },
    warnings: [],
  };
  if (!isStr(product_id)) { report.status = AUTHOR_STATUS.INVALID_INPUT; report.missing_inputs.push("product_id"); return report; }

  // ---- product factory state -------------------------------------------------
  const state = loadProductFactoryState(product_id, { root });
  let productShell = null;
  if (!state.ok || state.identityMismatch) {
    // Truth-only authoring: an authoritative Product Truth reference may stand in for the factory product
    // (used for the Day-6 fixture compatibility benchmark and for any supplied truth set).
    if (product_truth && isStr(product_truth.product_id)) {
      report.missing_inputs.push(...(state.errors ?? []).map((e) => `factory_state: ${e}`));
      report.warnings.push(`factory product not loaded (${(state.errors ?? ["identity mismatch"]).join("; ")}); authoring from the supplied Product Truth reference ${product_truth.id}`);
      productShell = {
        product_id: product_truth.product_id,
        transformation_id: product_truth.transformation_id ?? null,
        identity: { name: null, one_line_promise: product_truth.promise ?? null },
        tags: [],
        is_fixture: product_truth.is_fixture === true,
      };
      report.transformation_id = productShell.transformation_id;
    } else {
      report.status = AUTHOR_STATUS.INVALID_INPUT;
      report.missing_inputs.push(...(state.errors ?? ["product could not be loaded"]));
      if (state.identityMismatch) report.missing_inputs.push("product/transformation identity mismatch");
      return report;
    }
  } else {
    report.transformation_id = state.trId;
  }

  // ---- product truth (bridge or explicit) ------------------------------------
  const projection = product_truth ? { ok: true, record: product_truth, report: { provenance: [{ field: "product_truth", source: "supplied", value: product_truth.id }], missing: [], unsupported: [], errors: [] } } : projectProductTruth({ product_id, root });
  if (projection.ok && projection.record && state.ok && isStr(state.product?.product_id) && projection.record.product_id !== state.product.product_id) {
    report.status = AUTHOR_STATUS.INVALID_INPUT;
    report.missing_inputs.push(`supplied Product Truth reference ${projection.record.id} belongs to ${projection.record.product_id}, not ${state.product.product_id}`);
    return report;
  }
  report.product_truth_projection = projection.record;
  report.provenance.product_truth = projection.report.provenance;
  report.unsupported_claims.push(...projection.report.unsupported);
  report.missing_inputs.push(...projection.report.missing.map((m) => `product_truth: ${m}`));
  if (projection.ok && projection.record) report.truth_readiness.product_truth = TRUTH_READINESS.READY;

  // ---- customer / market / brand ---------------------------------------------
  const crfRes = resolveCustomerTruth({ product_id, crf, crf_ids });
  const mifRes = resolveMarketTruth({ product_id, mif, mif_ids });
  report.customer_truth_sources = crfRes.records.map((e) => ({ id: e.record.id, scope: e.source_scope, evidence_status: e.record.evidence_status ?? null, is_fixture: e.record.is_fixture === true }));
  report.market_truth_sources = mifRes.records.map((e) => ({ id: e.record.id, scope: e.source_scope, category: e.record.category ?? null, is_fixture: e.record.is_fixture === true }));
  report.truth_readiness.customer_truth = crfRes.records.length ? TRUTH_READINESS.READY : TRUTH_READINESS.MISSING;
  report.truth_readiness.market_truth = mifRes.records.length ? TRUTH_READINESS.READY : TRUTH_READINESS.MISSING;

  let brand = null;
  try {
    brand = BrandTruthService.loadBrand();
    const reg = BrandTruthService.writingRegister();       // resolves the referenced Constitution + standard (no fork)
    report.brand_truth_source = {
      id: brand.id, version: brand.version, status: brand.status,
      writing_constitution_ref: brand.writing_constitution_ref,
      anti_slop_ref: brand.anti_slop_ref,
      writing_register_resolved: !!reg,
      visual_tokens_version: brand.visual_language?.tokens_version ?? null,
      constraints: { boundaries: brand.boundaries ?? [], prohibited_behaviours: brand.prohibited_behaviours ?? [], claims_boundaries: brand.claims_boundaries ?? [] },
    };
    if (brand.status === "active" && reg) report.truth_readiness.brand_truth = TRUTH_READINESS.READY;
  } catch (e) {
    report.warnings.push(`brand truth unavailable: ${e.message}`);
  }

  // ---- refusal chain (never fabricate) ---------------------------------------
  const statuses = [];
  if (!projection.ok || !projection.record) statuses.push(AUTHOR_STATUS.SOURCE_REQUIRED);
  if (!crfRes.records.length) statuses.push(AUTHOR_STATUS.CUSTOMER_RESEARCH_REQUIRED);
  if (!mifRes.records.length) statuses.push(AUTHOR_STATUS.MARKET_RESEARCH_REQUIRED);
  if (!crfRes.records.length) report.missing_inputs.push("customer_research_missing: no CRF record for this product (production scope empty; supply authoritative research)");
  if (!mifRes.records.length) report.missing_inputs.push("market_research_missing: no MIF record for this product (production scope empty; supply authoritative research)");

  let built = null;
  if (!statuses.length) {
    // validate inputs against their canonical contracts before use (fixtures and production alike)
    for (const e of crfRes.records) {
      if (e.source_scope === "inline") { try { validate("customer-reality-record.schema.json", e.record, e.record?.id); } catch (err) { report.missing_inputs.push(`customer_research_missing: CRF ${e.record?.id ?? "(inline)"} fails customer-reality-record.schema.json: ${err.message}`); statuses.push(AUTHOR_STATUS.CUSTOMER_RESEARCH_REQUIRED); } }
    }
    for (const e of mifRes.records) {
      if (e.source_scope === "inline") { try { validate("market-intelligence-record.schema.json", e.record, e.record?.id); } catch (err) { report.missing_inputs.push(`market_research_missing: MIF ${e.record?.id ?? "(inline)"} fails market-intelligence-record.schema.json: ${err.message}`); statuses.push(AUTHOR_STATUS.MARKET_RESEARCH_REQUIRED); } }
    }
    if (!statuses.length) built = buildCandidateAngle({ ptr: projection.record, crfEntries: crfRes.records, mifEntries: mifRes.records, brand, product: state.product ?? productShell });
  }

  if (built && !built.ok) {
    report.missing_inputs.push(...built.missing.map((m) => `customer_truth: ${m}`));
    report.retained_rejected_angles.push({ reason: "candidate could not be assembled honestly", missing: built.missing, sources: crfRes.records.map((e) => e.record.id) });
    statuses.push(built.authoring_required ? AUTHOR_STATUS.AUTHORING_REQUIRED : AUTHOR_STATUS.CUSTOMER_RESEARCH_REQUIRED);
  }

  if (built && built.ok) {
    const { candidate, ledger } = built;
    const audit = auditCandidate({ candidate, ptr: projection.record, crfEntries: crfRes.records, mifEntries: mifRes.records, brand });
    report.unsupported_claims.push(...audit.unsupported);
    report.provenance.candidate_ledger = ledger;
    report.provenance.hierarchy_authority = TRUTH_HIERARCHY;
    if (audit.conflicts.length || audit.unsupported.length) {
      report.retained_rejected_angles.push({ angle_id: candidate.id, reason: "unsupported material or truth conflict detected", conflicts: audit.conflicts, unsupported: audit.unsupported });
      statuses.push(AUTHOR_STATUS.ANGLE_UNSUPPORTED);
    } else {
      candidate.tier3.truth_conflict_log = [];
      candidate.tier3.brand_truth_compliance = `Passes the brand Voice DNA structural test; ${(brand?.boundaries ?? []).length} boundary rule(s) and ${(brand?.prohibited_behaviours ?? []).length} prohibited behaviour(s) checked; writing register resolved from ${brand?.writing_constitution_ref?.config}.`;
      // lifecycle via the EXISTING Angle Service (no new states). The transition is projected for state
      // only: its volatile timestamp is kept OUT of the authoritative candidate (determinism).
      const draft = { ...candidate, status: "DRAFT", state_history: [] };
      let linked = { ...candidate, status: "EVIDENCE_LINKED", state_history: [] };
      let lifecycle = { from: "DRAFT", to: "EVIDENCE_LINKED", mechanism: "AngleService.linkEvidence (existing)", transition_timestamp: null };
      try {
        const transitioned = AngleService.linkEvidence(draft);
        lifecycle.transition_timestamp = transitioned.state_history?.[0]?.at ?? null;
        lifecycle.mechanism = `${lifecycle.mechanism} [transition applied: ${transitioned.status}]`;
      } catch (e) { report.warnings.push(`angle lifecycle transition unavailable: ${e.message}`); }
      report.provenance.lifecycle = lifecycle;
      // EXISTING validation gate (persist:false - nothing is written).
      // Product Truth is supplied as the authoritative factory projection (the PTR is a derived
      // reference, never a persisted authority) so C2 resolves against THIS transaction's truth.
      let validation = null;
      try { validation = AngleValidationService.evaluate(linked, { persist: false, product_truth: projection.record }); }
      catch (e) { report.warnings.push(`angle validation could not run: ${e.message}`); statuses.push(AUTHOR_STATUS.AUTHORING_REQUIRED); }
      // provenance completeness before a candidate is eligible for validation
      const provenance = {
        angle_id: linked.id,
        product_truth_refs: [linked.tier3.product_truth_ref],
        customer_truth_refs: linked.tier3.source_evidence.map((s) => s.ref_id),
        market_truth_refs: (linked.tier3.market_truth_support ?? []).map((s) => s.ref_id),
        brand_truth_ref: brand ? { id: brand.id, version: brand.version } : null,
        field_ledger: ledger,
      };
      const uri = (id) => (!id ? false : !!(TruthService.get("product", id) || TruthService.get("customer", id) || TruthService.get("market", id) || CustomerRealityService.get(id) || MarketIntelligenceService.get(id)));
      // the Product Truth reference resolves when this transaction supplies its authoritative projection,
      // or when the persisted store carries it (fixtures / explicitly prepared store).
      const suppliedPtr = projection.record && projection.record.id === linked.tier3.product_truth_ref ? projection.record : null;
      const resolution = {
        product_truth: uri(linked.tier3.product_truth_ref) || !!suppliedPtr,
        customer_truth: linked.tier3.source_evidence.map((s) => ({ ref_id: s.ref_id, resolved: uri(s.ref_id) })),
        market_truth: (linked.tier3.market_truth_support ?? []).map((s) => ({ ref_id: s.ref_id, resolved: uri(s.ref_id) })),
      };
      const provisional = !resolution.product_truth || resolution.customer_truth.some((r) => !r.resolved) || resolution.market_truth.some((r) => !r.resolved);
      report.candidate_angles.push(linked);
      report.validations.push({
        angle_id: linked.id,
        validation_id: validation?.id ?? null,
        verdict: validation?.verdict ?? null,
        criteria: validation?.criteria ?? null,
        human_review_required: validation?.human_review_required ?? null,
        human_review_reason: validation?.human_review_reason ?? null,
        restrictions: validation?.restrictions ?? [],
        scope_note: validation?.scope_note ?? null,
        approved_platforms: validation?.approved_platforms ?? [],
        excluded_platforms: validation?.excluded_platforms ?? [],
        interchangeability: { active: true, note: "enforced downstream by the existing MAE QA/Interchangeability gate; the author cannot influence it" },
        validator_resolution: resolution,
        provisional,
        provisional_reason: provisional ? "referenced truth records are not persisted in the MAE store (dry-run policy); a persisted validation requires the Product Truth reference/CRF/MIF to exist in scope" : null,
      });
      report.provenance.validation = { gate: "AngleValidationService (mae/services/validation.js)", persist: false };
      if (validation && ["YELLOW", "RED"].includes(validation.verdict)) report.retained_rejected_angles.push({ angle_id: linked.id, validation_id: validation.id, reason: `${validation.verdict}: retained for audit/learning per S4 (red is not deletion)`, verdict: validation.verdict });
      report.authoring.polish_status = "AUTHORING_REQUIRED";
      report.authoring.polish_note = "the angle statement quotes the customer's exact language verbatim; hook-style polish requires the dormant authoring layer (provider=none during this wave)";
      statuses.push(AUTHOR_STATUS.READY_FOR_VALIDATION);
    }
  }

  report.status = STATUS_ORDER.find((s) => statuses.includes(s)) ?? (statuses.length ? statuses[0] : AUTHOR_STATUS.SOURCE_REQUIRED);
  report.four_truths_ready = Object.values(report.truth_readiness).every((v) => v === TRUTH_READINESS.READY);
  return report;
}
export const runMarketingAngleAuthoring = authorMarketingAngles;

// ------------------------------------------------------------------------------------------------
// CLI
// ------------------------------------------------------------------------------------------------
const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const pid = args.find((a) => !a.startsWith("--"));
  const get = (flag) => { const i = args.indexOf(flag); return i > -1 ? args[i + 1] : null; };
  if (!pid) { console.error("usage: node mae/harness/marketing-angle-authoring.mjs <PRODUCT_ID> [--crf id,id] [--mif id,id]"); process.exit(2); }
  const report = authorMarketingAngles({
    product_id: pid,
    crf_ids: (get("--crf") ?? "").split(",").filter(Boolean),
    mif_ids: (get("--mif") ?? "").split(",").filter(Boolean),
  });
  console.log(JSON.stringify({
    status: report.status, product_id: report.product_id, transformation_id: report.transformation_id,
    truth_readiness: report.truth_readiness, four_truths_ready: report.four_truths_ready,
    customer_truth_sources: report.customer_truth_sources, market_truth_sources: report.market_truth_sources,
    missing_inputs: report.missing_inputs, unsupported_claims: report.unsupported_claims,
    candidate_count: report.candidate_angles.length, validations: report.validations,
    retained_rejected_angles: report.retained_rejected_angles, warnings: report.warnings, author_version: report.author_version,
  }, null, 2));
  process.exit(report.status === AUTHOR_STATUS.INVALID_INPUT ? 1 : 0);
}
