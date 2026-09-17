#!/usr/bin/env node
// SWIIPT RESEARCH / EVIDENCE GAP SERVICE (research-to-transformation pipeline V1, Phases F/G/H).
//
// Persists the runner's ephemeral findings (missing_inputs / missing_evidence / clinical_review_items /
// applicability unresolved questions) as canonical gap records with blocking + resolution semantics.
//
// Deliberately SEPARATE from the MAE campaign-inventory GapRequestService: campaign gaps are
// non-blocking marketing-inventory shortages (campaign_id/audience_state/missing_role shape), while a
// research gap carries provenance/applicability/blocking semantics and a governed resolution loop.
// Reusing the campaign primitive would corrupt both semantics, so this is the minimum compatible
// canonical research-gap record (task §4.2).
//
// Provider-independent: a gap is resolvable by human research, an approved agent, a future provider,
// a connected source or manual source addition. The pipeline owns WHAT is missing / WHY / WHAT blocks /
// WHAT evidence would resolve it / WHETHER it is resolved — never HOW it is obtained.
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const GAP_DIR = join(ROOT, "data", "research-gaps");
export const GAP_SCHEMA_ID = "https://swiipt.com/factory/schemas/research-gap.schema.json";

/** Pipeline stages a gap can block, in order. */
export const PIPELINE_STAGES = Object.freeze([
  "SOURCE", "OPPORTUNITY", "TRANSFORMATION_CANDIDATE", "TRANSFORMATION_VALIDATED",
  "PRODUCT_SPECIFICATION", "PRODUCT_BUILD", "PRODUCT_QA", "PUBLICATION",
]);

export const GAP_DOMAINS = Object.freeze([
  "SOURCE", "CUSTOMER_TRUTH", "MARKET_TRUTH", "APPLICABILITY", "MECHANISM", "SAFETY",
  "CLINICAL", "JURISDICTION", "IMPLEMENTATION", "MEASUREMENT", "OTHER",
]);

let AJV = null;
function ajv() {
  if (AJV) return AJV;
  const a = new Ajv({ allErrors: true, strict: false });
  a.addFormat("date-time", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  a.addFormat("date", /^\d{4}-\d{2}-\d{2}$/);
  for (const f of readdirSync(join(ROOT, "schemas")).filter((x) => x.endsWith(".schema.json"))) {
    const sch = JSON.parse(readFileSync(join(ROOT, "schemas", f), "utf8"));
    sch.$id = sch.$id || `https://swiipt.com/factory/schemas/${f}`;
    try { a.addSchema(sch); } catch { /* already added */ }
  }
  AJV = a;
  return a;
}
export function validateGap(gap) {
  const a = ajv();
  const ok = a.validate(GAP_SCHEMA_ID, gap);
  return { valid: ok, errors: ok ? [] : a.errors.map((e) => `${e.instancePath || "/"} ${e.message}`) };
}

const slug = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
const isStr = (v) => typeof v === "string" && v.trim().length > 0;

export function listGaps({ dir = GAP_DIR } = {}) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /^GAP-RES-.*\.json$/.test(f))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
}

/** Deterministic next id for a seed, e.g. GAP-RES-OPP-PPL-MONEYPOST-001-001. */
export function nextGapId(seed, { dir = GAP_DIR } = {}) {
  const base = `GAP-RES-${slug(seed) || "GENERAL"}`;
  const used = new Set(listGaps({ dir }).map((g) => g.gap_id));
  let n = 1;
  while (used.has(`${base}-${String(n).padStart(3, "0")}`)) n += 1;
  return `${base}-${String(n).padStart(3, "0")}`;
}

/** Create + persist one gap. Deterministic given (input, now). */
export function createGap(input = {}, { dir = GAP_DIR, now = null } = {}) {
  const seed = input.gap_id ? input.gap_id.replace(/-?\d{3}$/, "") : (input.opportunity_id || input.transformation_id || input.source_ref || "GENERAL");
  const gap = {
    gap_id: input.gap_id || nextGapId(seed, { dir }),
    class: "research_gap",
    domain: input.domain,
    source_ref: input.source_ref ?? null,
    opportunity_id: input.opportunity_id ?? null,
    transformation_id: input.transformation_id ?? null,
    product_id: input.product_id ?? null,
    description: isStr(input.description) ? input.description : "",
    why_it_matters: isStr(input.why_it_matters) ? input.why_it_matters : "",
    required_evidence: isStr(input.required_evidence) ? input.required_evidence : "",
    evidence_refs: Array.isArray(input.evidence_refs) ? input.evidence_refs : [],
    blocking_stage: input.blocking_stage,
    severity: input.severity,
    blocks_progression: input.blocks_progression !== false,
    status: input.status || "OPEN",
    created_at: input.created_at || now || new Date().toISOString(),
    resolved_at: input.resolved_at ?? null,
    resolution_source: input.resolution_source ?? null,
    resolution_evidence_refs: Array.isArray(input.resolution_evidence_refs) ? input.resolution_evidence_refs : [],
    resolution_notes: input.resolution_notes ?? null,
    re_evaluation_required: input.re_evaluation_required === true,
    resolution_criteria: input.resolution_criteria && typeof input.resolution_criteria === "object"
      ? { requires_evidence: input.resolution_criteria.requires_evidence !== false, evaluator: input.resolution_criteria.evaluator ?? null }
      : { requires_evidence: true, evaluator: null },
  };
  const v = validateGap(gap);
  if (!v.valid) return { ok: false, errors: v.errors, gap: null };
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${gap.gap_id}.json`), `${JSON.stringify(gap, null, 2)}\n`, "utf8");
  return { ok: true, errors: [], gap };
}

/** Persist every draft the architect produced. Returns the created gaps. */
export function persistGapsFromReport(report = {}, { dir = GAP_DIR, now = null, context = {} } = {}) {
  const created = [];
  const drafts = Array.isArray(report.gaps) ? report.gaps : [];
  for (const d of drafts) {
    const res = createGap({ ...d, ...context }, { dir, now });
    if (res.ok) created.push(res.gap);
  }
  return created;
}

const stageIndex = (s) => PIPELINE_STAGES.indexOf(s);

/** OPEN gaps that block the given stage (only their own stage; never globally blocking). */
export function blockingGapsForStage(stage, { dir = GAP_DIR } = {}) {
  return listGaps({ dir }).filter((g) => g.status === "OPEN" && g.blocks_progression !== false && g.blocking_stage === stage);
}

/** Blocking gaps tied to a transformation or product, at any stage. */
export function blockingGapsForEntity({ transformation_id = null, product_id = null }, { dir = GAP_DIR } = {}) {
  return listGaps({ dir }).filter((g) =>
    g.status === "OPEN" && g.blocks_progression !== false &&
    ((transformation_id && g.transformation_id === transformation_id) || (product_id && g.product_id === product_id)));
}

function loadGap(gapId, dir) {
  const p = join(dir, `${gapId}.json`);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}
function saveGap(gap, dir) {
  const v = validateGap(gap);
  if (!v.valid) return { ok: false, errors: v.errors };
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${gap.gap_id}.json`), `${JSON.stringify(gap, null, 2)}\n`, "utf8");
  return { ok: true, errors: [] };
}

/**
 * Record a resolution. Refuses when the criteria require evidence and none is supplied —
 * `status = RESOLVED` with no resolution evidence is never allowed.
 */
export function resolveGap(gapId, { resolution_source = null, resolution_evidence_refs = [], resolution_notes = null, resolved_at = null } = {}, { dir = GAP_DIR } = {}) {
  const gap = loadGap(gapId, dir);
  if (!gap) return { ok: false, code: "NOT_FOUND", gap: null };
  if (gap.status !== "OPEN") return { ok: false, code: "NOT_OPEN", gap };
  const requires = gap.resolution_criteria?.requires_evidence !== false;
  const refs = Array.isArray(resolution_evidence_refs) ? resolution_evidence_refs.filter(isStr) : [];
  if (requires && (!isStr(resolution_source) || refs.length === 0)) {
    return { ok: false, code: "EVIDENCE_REQUIRED", reason: "resolution criteria require evidence; gap remains OPEN", gap };
  }
  gap.status = "RESOLVED";
  gap.resolved_at = resolved_at || new Date().toISOString();
  gap.resolution_source = isStr(resolution_source) ? resolution_source : null;
  gap.resolution_evidence_refs = refs;
  gap.resolution_notes = isStr(resolution_notes) ? resolution_notes : null;
  gap.re_evaluation_required = true;
  const saved = saveGap(gap, dir);
  return saved.ok ? { ok: true, code: "RESOLVED_PENDING_RE_EVALUATION", gap } : { ok: false, code: "SCHEMA_INVALID", errors: saved.errors, gap };
}

/** Domain-specific deterministic re-evaluation — does the new evidence actually close the gap? */
export function defaultEvaluator(gap) {
  const refs = gap.resolution_evidence_refs || [];
  switch (gap.domain) {
    case "CUSTOMER_TRUTH":
      return { resolved: refs.some((r) => /^CRF-/.test(r) || /customer-reality/i.test(r)), reason: "requires a Customer Reality record reference" };
    case "MARKET_TRUTH":
      return { resolved: refs.some((r) => /^MIF-/.test(r) || /market-intelligence/i.test(r)), reason: "requires a Market Intelligence record reference" };
    case "APPLICABILITY":
      return { resolved: refs.length > 0 && isStr(gap.resolution_notes), reason: "requires an applicability determination plus a note" };
    default:
      return { resolved: refs.length > 0, reason: "requires at least one evidence reference" };
  }
}

/** Re-run the affected check; close only if the criteria are actually met, else reopen. */
export function reEvaluateGap(gapId, { evaluator = defaultEvaluator } = {}, { dir = GAP_DIR } = {}) {
  const gap = loadGap(gapId, dir);
  if (!gap) return { ok: false, code: "NOT_FOUND", gap: null };
  if (gap.status !== "RESOLVED") return { ok: false, code: "NOT_RESOLVED", gap };
  const verdict = evaluator(gap) || { resolved: false };
  if (verdict.resolved) {
    gap.re_evaluation_required = false;
    gap.resolution_notes = [gap.resolution_notes, `re-evaluation passed: ${verdict.reason || "criteria met"}`].filter(Boolean).join(" | ");
    const saved = saveGap(gap, dir);
    return saved.ok ? { ok: true, code: "CLOSED", gap } : { ok: false, code: "SCHEMA_INVALID", errors: saved.errors, gap };
  }
  gap.status = "OPEN";
  gap.resolved_at = null;
  gap.re_evaluation_required = true;
  gap.resolution_notes = [gap.resolution_notes, `re-evaluation failed: ${verdict.reason || "criteria not met"}`].filter(Boolean).join(" | ");
  const saved = saveGap(gap, dir);
  return saved.ok ? { ok: false, code: "REOPENED", gap } : { ok: false, code: "SCHEMA_INVALID", errors: saved.errors, gap };
}

export function waiveGap(gapId, { reason = null, waived_at = null } = {}, { dir = GAP_DIR } = {}) {
  const gap = loadGap(gapId, dir);
  if (!gap) return { ok: false, code: "NOT_FOUND", gap: null };
  gap.status = "WAIVED";
  gap.resolved_at = waived_at || new Date().toISOString();
  gap.resolution_notes = isStr(reason) ? reason : "waived";
  return saveGap(gap, dir).ok ? { ok: true, gap } : { ok: false, code: "SCHEMA_INVALID", gap };
}
