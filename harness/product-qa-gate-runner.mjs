#!/usr/bin/env node
// SWIIPT PRODUCT FACTORY - PRODUCT QA GATE RUNNER V1
//
// PRODUCT + TRANSFORMATION + FACTORY EVIDENCE
//   -> AUTHORITATIVE QA GATE STATE (g0..g10)
//   -> PUBLISH-MANIFEST ELIGIBILITY (derived)
//
// A RUNNER over the existing architecture - not a new QA framework.
// Reuses: harness/qa-checks.mjs (canonical deterministic checks), harness/writing-control.mjs
// (Gate-1 key list semantics), harness/evidence-provenance.mjs (claim/classification vocabulary),
// schemas/product.schema.json (gate enum + review + authorization shapes),
// standards/publishing-gates-standard.md (gate meanings + conjunction rule), and the
// harness/build-manifest.mjs contract (never weakened, never modified).
//
// Permanent separation:
//   1. DETERMINISTIC EVALUATION   (the runner may compute and PASS itself)
//   2. HUMAN / CLINICAL / OWNER REVIEW  (only an existing authoritative record may PASS these)
//   3. PUBLISH AUTHORIZATION      (only an actual owner authorization record may satisfy g10)
// "all deterministic tests passed" is NEVER converted into "all publishing gates passed".
//
// Dry-run is the default; write mode is explicit and writes ONLY qa.gate_results, never a manifest.
// No provider, no LLM, no network, no spend, no Date.now/Math.random/UUID in authoritative results.
//
// Usage:
//   node harness/product-qa-gate-runner.mjs <PRODUCT_ID> [--write] [--report <file>] [--json]
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import Ajv from "ajv/dist/2020.js";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const GATE_RUNNER_VERSION = "product-qa-gate-runner@1";

/** Persisted gate vocabulary is the product schema's enum: pending | PASS | FAIL (no new enums). */
export const PERSISTED = Object.freeze({ PASS: "PASS", FAIL: "FAIL", PENDING: "pending" });

/** Rich verdict vocabulary lives in the RUN REPORT only (never persisted). */
export const VERDICT = Object.freeze({
  PASS: "PASS",
  FAIL: "FAIL",
  SOURCE_REQUIRED: "SOURCE_REQUIRED",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  CLINICAL_REVIEW_REQUIRED: "CLINICAL_REVIEW_REQUIRED",
  OWNER_ACTION_REQUIRED: "OWNER_ACTION_REQUIRED",
  INVALID_AUTHORIZATION: "INVALID_AUTHORIZATION",
  BLOCKED_BY_PREREQUISITE: "BLOCKED_BY_PREREQUISITE",
});

/** Report-level status precedence (highest first). */
export const RUN_STATUS = Object.freeze({
  INVALID_INPUT: "INVALID_INPUT",
  CONFLICT: "CONFLICT",
  BLOCKED: "BLOCKED",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  CLINICAL_REVIEW_REQUIRED: "CLINICAL_REVIEW_REQUIRED",
  SOURCE_REQUIRED: "SOURCE_REQUIRED",
  OWNER_ACTION_REQUIRED: "OWNER_ACTION_REQUIRED",
  MANIFEST_ELIGIBLE: "MANIFEST_ELIGIBLE",
});

/**
 * Canonical gate model. Authority classification discovered from standards/publishing-gates-standard.md
 * 2 (gates 0-10) and 4 (human authority):
 *   DETERMINISTIC      -> verdict computable from repository state (structure/validity/presence).
 *   HYBRID             -> deterministic prerequisites + an independent review record required for PASS.
 *   CLINICAL_REVIEW    -> deterministic prerequisites + clinical review required for PASS.
 *   AUTHORIZATION      -> only an existing owner authorization record may PASS.
 */
export const GATES = Object.freeze([
  { id: "g0_research_disposition", n: 0, name: "Research disposition", authority: "DETERMINISTIC", blocks_manifest: true },
  { id: "g1_situation", n: 1, name: "Situation", authority: "DETERMINISTIC", blocks_manifest: true },
  { id: "g2_transformation", n: 2, name: "Transformation", authority: "DETERMINISTIC", blocks_manifest: true },
  { id: "g3_product_architecture", n: 3, name: "Product architecture", authority: "DETERMINISTIC", blocks_manifest: true },
  { id: "g4_evidence", n: 4, name: "Evidence", authority: "HYBRID", blocks_manifest: true, review_surface: "evidence" },
  { id: "g5_safety", n: 5, name: "Safety", authority: "CLINICAL_REVIEW", blocks_manifest: true, review_surface: "safety" },
  { id: "g6_content", n: 6, name: "Content", authority: "DETERMINISTIC", blocks_manifest: true },
  { id: "g7_product_qa", n: 7, name: "Product QA", authority: "HYBRID", blocks_manifest: true, review_surface: "qa_ledger" },
  { id: "g8_commerce", n: 8, name: "Commerce", authority: "DETERMINISTIC", blocks_manifest: true },
  { id: "g9_customer_journey", n: 9, name: "Customer journey", authority: "HYBRID", blocks_manifest: true, review_surface: "journey" },
  { id: "g10_publish", n: 10, name: "Publish", authority: "AUTHORIZATION", blocks_manifest: true },
]);

/** Conjunctive dependencies derived from the standard's state machine (18) + gate order (19). */
export const GATE_DEPENDENCIES = Object.freeze({
  g0_research_disposition: [],
  g1_situation: ["g0_research_disposition"],
  g2_transformation: ["g1_situation"],
  g3_product_architecture: ["g1_situation", "g2_transformation"],
  g4_evidence: ["g2_transformation"],
  g5_safety: ["g2_transformation"],
  g6_content: ["g2_transformation", "g3_product_architecture"],
  g7_product_qa: ["g1_situation", "g2_transformation", "g3_product_architecture", "g6_content"],
  g8_commerce: ["g3_product_architecture"],
  g9_customer_journey: ["g3_product_architecture", "g6_content", "g8_commerce"],
  g10_publish: ["g4_evidence", "g5_safety", "g6_content", "g7_product_qa", "g8_commerce", "g9_customer_journey"],
});

/** Gate-1 key list per the writing-control contract (reused, not redefined). */
export const GATE1_KEYS = Object.freeze(["person", "specific_situation", "trigger", "problem", "failed_attempt", "emotional_stake", "desired_transformation"]);
export const TRANSFORMATION_BLOCKS = Object.freeze(["before_state", "after_state", "mechanism", "transformation_path", "failure_point_map", "first_win", "tsm", "maintenance", "safety"]);
export const TSM_ELEMENTS = Object.freeze(["before_baseline", "success_indicators", "measurement_days", "success_threshold", "measurement_method", "incomplete_progress_interpretation", "next_action_on_miss"]);
export const CLAIM_LABELS = Object.freeze(["sourced_evidence", "expert_reviewed", "lived_experience", "model_inference", "hypothesis"]);
export const RISK_LEVELS = Object.freeze(["low", "moderate", "high", "clinical"]);
export const AI_TEST_STATUSES = Object.freeze(["PASS", "FAIL", "REVISION_REQUIRED"]);
export const CONTENT_SCHEMAS = Object.freeze({
  landing_page: "content-landing.schema.json",
  product_page: "content-product-page.schema.json",
  faq: "content-faq.schema.json",
  reviews: "content-reviews.schema.json",
});
/** The manifest contract requires exactly these five QA verdicts (see build-manifest.mjs). */
export const MANIFEST_VERDICTS = Object.freeze(["deterministic", "ai", "safety", "commerce", "journey"]);

const isObj = (v) => v != null && typeof v === "object" && !Array.isArray(v);
const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const canonical = (v) => (Array.isArray(v) ? `[${v.map(canonical).join(",")}]`
  : isObj(v) ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`
    : JSON.stringify(v === undefined ? null : v));
export const canonicalProjection = (value) => canonical(value);

// ------------------------------------------------------------------------------------------------
// canonical deterministic QA reuse (harness/qa-checks.mjs, unmodified)
// ------------------------------------------------------------------------------------------------
/**
 * Run the repository's canonical deterministic QA runner and parse its ledger.
 * Reuse over reimplementation: the runner never re-writes qa-checks' rules.
 */
export function runCanonicalQaChecks({ root = ROOT } = {}) {
  let stdout = "";
  try {
    stdout = execFileSync(process.execPath, [join(root, "harness", "qa-checks.mjs")], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    stdout = String(e.stdout ?? "");        // qa-checks exits 1 when any check FAILs; the ledger is still printed
  }
  const checks = [];
  for (const line of stdout.split(/\r?\n/)) {
    const m = line.match(/^(PASS|FAIL)\s+(\S+)\s+([^\s(]+)(?:\s+\((.*)\))?\s*$/);
    if (m) checks.push({ result: m[1], record: m[2], test: m[3], detail: m[4] ?? "" });
  }
  const summary = stdout.match(/(\d+)\s+PASS\s*\/\s*(\d+)\s+FAIL\s+across\s+(\d+)\s+checks/);
  return {
    checks,
    summary: summary ? { pass: Number(summary[1]), fail: Number(summary[2]), total: Number(summary[3]) } : null,
  };
}
export function checksFor(ledger, productRelativePath) {
  return ledger.checks.filter((c) => c.record === productRelativePath);
}

// ------------------------------------------------------------------------------------------------
// input loading
// ------------------------------------------------------------------------------------------------
export function loadProductInputs(productId, { qaLedger = null, root = ROOT } = {}) {
  const dir = join(root, "data", "products", productId);
  const productPath = join(dir, "product.json");
  const errors = [];
  if (!existsSync(productPath)) return { ok: false, errors: [`no product.json at data/products/${productId}`], product: null, dir };
  let product = null;
  try { product = JSON.parse(readFileSync(productPath, "utf8")); }
  catch (e) { return { ok: false, errors: [`product.json is not valid JSON: ${e.message}`], product: null, dir }; }
  if (!isObj(product) || !isStr(product.product_id)) return { ok: false, errors: ["product.json has no product_id"], product, dir };

  const trId = product.identity?.transformation_id ?? null;
  const trPath = trId ? join(root, "data", "transformations", `${trId}.json`) : null;
  let transformation = null;
  let identityMismatch = false;
  if (trPath && existsSync(trPath)) {
    try {
      transformation = JSON.parse(readFileSync(trPath, "utf8"));
      if (isStr(transformation?.transformation_id) && transformation.transformation_id !== trId) {
        identityMismatch = true;
        errors.push(`product/transformation identity mismatch: product references ${trId} but the record is ${transformation.transformation_id}`);
      }
    } catch (e) { errors.push(`transformation record ${trId} is not valid JSON: ${e.message}`); }
  }

  const assets = {};
  for (const [job, list] of Object.entries(product.asset_map ?? {})) {
    for (const aid of Array.isArray(list) ? list : []) {
      const af = join(dir, "assets", `${aid}.json`);
      if (!existsSync(af)) { assets[aid] = { id: aid, job, exists: false }; continue; }
      try { assets[aid] = { id: aid, job, exists: true, record: JSON.parse(readFileSync(af, "utf8")) }; }
      catch (e) { assets[aid] = { id: aid, job, exists: true, parse_error: e.message }; }
    }
  }

  const content = {};
  for (const [key, ref] of Object.entries(product.content ?? {})) {
    if (!isStr(ref)) { content[key] = { key, ref, exists: false }; continue; }
    const cp = join(dir, ref);
    const entry = { key, ref, exists: existsSync(cp), path: cp };
    if (entry.exists) {
      try {
        entry.data = JSON.parse(readFileSync(cp, "utf8"));
        const schemaFile = CONTENT_SCHEMAS[key];
        if (schemaFile) {
          const ok = schemaAjv().validate(`https://swiipt.com/factory/schemas/${schemaFile}`, entry.data);
          entry.schema_valid = ok;
          if (!ok) entry.schema_errors = schemaAjv().errors.map((e) => `${e.instancePath || "/"} ${e.message}`).slice(0, 4);
        }
      } catch (e) { entry.parse_error = e.message; }
    }
    content[key] = entry;
  }

  const generationManifestPath = join(dir, "copy", "generation-manifest.json");
  let generationManifest = null;
  if (existsSync(generationManifestPath)) { try { generationManifest = JSON.parse(readFileSync(generationManifestPath, "utf8")); } catch { generationManifest = null; } }

  const manifestPath = join(dir, "publish", "manifest.json");
  let manifest = null;
  if (existsSync(manifestPath)) { try { manifest = JSON.parse(readFileSync(manifestPath, "utf8")); } catch { manifest = null; } }

  const ledger = qaLedger ?? runCanonicalQaChecks({ root });
  return {
    ok: true, errors, dir, productPath, product, transformation, trId, identityMismatch, root,
    assets, content, generationManifest, manifest, qaLedger: ledger,
    checks: checksFor(ledger, `data/products/${productId}/product.json`),
  };
}

// Content-spec validation reuses the repository schemas (same pool convention as qa-checks.mjs);
// the checks themselves are not re-invented, the schema is the contract.
let SCHEMA_AJV = null;
function schemaAjv() {
  if (SCHEMA_AJV) return SCHEMA_AJV;
  const a = new Ajv({ allErrors: true, strict: false });
  a.addFormat("date", /^\d{4}-\d{2}-\d{2}$/);
  a.addFormat("date-time", /^\d{4}-\d{2}-\d{2}T/);
  for (const f of readdirSync(join(ROOT, "schemas")).filter((x) => x.endsWith(".schema.json"))) {
    const sch = JSON.parse(readFileSync(join(ROOT, "schemas", f), "utf8"));
    sch.$id = `https://swiipt.com/factory/schemas/${f}`;
    try { a.addSchema(sch); } catch { /* already added */ }
  }
  SCHEMA_AJV = a;
  return a;
}

// ------------------------------------------------------------------------------------------------
// gate evaluators
// ------------------------------------------------------------------------------------------------
const gate = (id, verdict, reason, extra = {}) => ({ id, verdict, reason, ...extra });
const missingInput = (id, what) => gate(id, VERDICT.SOURCE_REQUIRED, `required authoritative input missing: ${what}`, { missing_requirements: [what] });
const failed = (id, what) => gate(id, VERDICT.FAIL, `quality failure: ${what}`, { failures: [what] });

function evalG0(inp) {
  const tr = inp.transformation;
  if (!tr) return missingInput("g0_research_disposition", `transformation record ${inp.trId ?? "(unset)"} (research disposition source)`);
  const d = tr.research_disposition;
  if (!isObj(d) || !isStr(d.library_role) || !isStr(d.rationale)) return missingInput("g0_research_disposition", "transformation.research_disposition {library_role, rationale}");
  const roles = ["STANDALONE_TRANSFORMATION", "ENTRY_PRODUCT", "UPSELL", "ORDER_BUMP", "BUNDLE_COMPONENT", "MODULE", "BONUS_FREE_GIFT", "LEAD_MAGNET", "MARKETING_ANGLE", "SUPPORTING_ASSET", "JOURNEY_NODE", "FUTURE_RESEARCH", "EVIDENCE_GAP"];
  if (!roles.includes(d.library_role)) return failed("g0_research_disposition", `research_disposition.library_role "${d.library_role}" is not one of the 13 canonical roles`);
  return gate("g0_research_disposition", VERDICT.PASS, `research disposition recorded: ${d.library_role} (rationale present)`, { inputs: ["transformation.research_disposition"], source_refs: [inp.trId] });
}

function evalG1(inp) {
  const tr = inp.transformation, p = inp.product;
  if (inp.identityMismatch) return failed("g1_situation", "product/transformation identity mismatch (product references a different transformation id)");
  if (!tr) return missingInput("g1_situation", `transformation record ${inp.trId ?? "(unset)"} (situation nucleus)`);
  const sit = tr.situation ?? {};
  const blank = GATE1_KEYS.filter((k) => !isStr(sit[k]));
  if (blank.length) return { ...missingInput("g1_situation", `situation.${blank.join(", situation.")}`), inputs: [`${inp.trId}.situation`] };
  // customer-facing restatement must exist (integrity only; content is judged upstream)
  const c = p.customer ?? {};
  const cblank = ["target_person", "situation", "trigger", "emotional_stake"].filter((k) => !isStr(c[k]));
  if (cblank.length) return { ...missingInput("g1_situation", `product.customer.${cblank.join(", product.customer.")}`), inputs: ["product.customer", `${inp.trId}.situation`] };
  return gate("g1_situation", VERDICT.PASS, "Gate-1 situation nucleus complete (7 fields) + customer restatement present", { inputs: [`${inp.trId}.situation`, "product.customer"], source_refs: [inp.trId] });
}

function evalG2(inp) {
  const tr = inp.transformation;
  if (!tr) return missingInput("g2_transformation", `transformation record ${inp.trId ?? "(unset)"}`);
  const missing = [];
  for (const k of TRANSFORMATION_BLOCKS) if (!tr[k] || (Array.isArray(tr[k]) ? tr[k].length === 0 : Object.keys(tr[k]).length === 0)) missing.push(`transformation.${k}`);
  if (!tr.after_state?.evidence_of_change?.length) missing.push("transformation.after_state.evidence_of_change");
  if (!tr.safety?.scope_boundary) missing.push("transformation.safety.scope_boundary");
  if (missing.length) return { ...missingInput("g2_transformation", missing.join(", ")), inputs: [inp.trId] };
  return gate("g2_transformation", VERDICT.PASS, "before/after/mechanism/path/first-win/failure-map/TSM/maintenance/safety + evidence_of_change present", { inputs: [inp.trId], source_refs: [inp.trId] });
}

function evalG3(inp) {
  const p = inp.product, tr = inp.transformation;
  const missing = [];
  if (!isStr(p.commercial_role?.role)) missing.push("product.commercial_role.role");
  if (!isObj(p.asset_map)) missing.push("product.asset_map");
  if (Object.keys(p.tsm ?? {}).length === 0) missing.push("product.tsm (BLOCKER rule: TSM required)");
  const t = p.transformation ?? {};
  for (const k of ["before_state", "after_state", "mechanism", "path", "first_win", "failure_map", "rescue_protocols", "reentry", "maintenance", "next_transformation_ids"]) {
    if (!(k in t)) missing.push(`product.transformation.${k}`);
  }
  if (Array.isArray(t.path) && t.path.length === 0) missing.push("product.transformation.path (empty)");
  if (!isObj(t.failure_map) || Object.keys(t.failure_map).length === 0) missing.push("product.transformation.failure_map (empty)");
  if (!isObj(t.rescue_protocols) || Object.keys(t.rescue_protocols).length === 0) missing.push("product.transformation.rescue_protocols (empty)");
  const unparseable = Object.entries(inp.assets).filter(([, a]) => a.parse_error).map(([id]) => id);
  if (unparseable.length) return { ...failed("g3_product_architecture", `asset records are not valid JSON: ${unparseable.join(", ")}`), inputs: ["product.asset_map"] };
  const unresolved = Object.entries(inp.assets).filter(([, a]) => !a.exists).map(([id]) => id);
  if (unresolved.length) missing.push(`unresolved asset records: ${unresolved.join(", ")}`);
  if (missing.length) return { ...missingInput("g3_product_architecture", missing.join(", ")), inputs: ["product.asset_map", "product.transformation", "product.tsm"] };
  if (tr && !tr.transformation_path?.length) return failed("g3_product_architecture", "canonical transformation path is empty");
  return gate("g3_product_architecture", VERDICT.PASS, "role + asset map/resolution + embedded transformation blocks + TSM present", { inputs: ["product.asset_map", "product.transformation", "product.tsm", ...(tr ? [inp.trId] : [])] });
}

function evidenceReviewState(inp) {
  const hr = inp.product.human_review ?? null;
  if (!hr) return { present: false, resolved: false, reason: "no canonical human review record (product.human_review) present" };
  if (hr.status !== "RESOLVED") return { present: true, resolved: false, reason: `human review status is ${hr.status}` };
  if (!isStr(hr.resolved_by) || !isStr(hr.resolution)) return { present: true, resolved: false, reason: "human review is RESOLVED but lacks resolved_by/resolution" };
  const refs = Array.isArray(hr.evidence_references) ? hr.evidence_references : [];
  return { present: true, resolved: true, refs, reviewer: hr.resolved_by, reason: "human review RESOLVED" };
}
function safetyReviewState(inp) {
  const hr = inp.product.human_review ?? null;
  if (!hr) return { present: false, resolved: false, reason: "no canonical human/clinical review record (product.human_review) present" };
  if (hr.status !== "RESOLVED") return { present: true, resolved: false, reason: `human/clinical review status is ${hr.status}` };
  if (!isStr(hr.resolved_by)) return { present: true, resolved: false, reason: "review is RESOLVED but has no resolved_by" };
  const refs = Array.isArray(hr.safety_references) ? hr.safety_references : [];
  return { present: true, resolved: true, refs, reviewer: hr.resolved_by, reason: "clinical/human review RESOLVED" };
}

function evalG4(inp) {
  const id = "g4_evidence";
  const e = inp.product.evidence;
  const missing = [];
  if (!isObj(e)) missing.push("product.evidence");
  else {
    if (!Array.isArray(e.sources) || e.sources.length === 0) missing.push("product.evidence.sources");
    if (!isObj(e) || !isStr(e.review_status)) missing.push("product.evidence.review_status");
  }
  const tr = inp.transformation;
  const trClaims = [...(tr?.evidence ?? []), ...(tr?.mechanism?.evidence_basis ?? [])];
  const unlabelled = trClaims.filter((c) => !CLAIM_LABELS.includes(c?.status)).length;
  const unsourced = trClaims.filter((c) => ["sourced_evidence", "expert_reviewed"].includes(c?.status) && !isStr(c.source)).length;
  if (missing.length) return { ...missingInput(id, missing.join(", ")), inputs: ["product.evidence", inp.trId] };
  const declared = new Set((e.sources ?? []).map((s) => String(s)));
  const badProductLabels = (e.claim_labels ?? []).filter((c) => !CLAIM_LABELS.includes(c?.label));
  const productUnsourced = (e.claim_labels ?? []).filter((c) => ["sourced_evidence", "expert_reviewed"].includes(c?.label) && !isStr(c?.source));
  const unresolvedSource = (e.claim_labels ?? []).filter((c) => ["sourced_evidence", "expert_reviewed"].includes(c.label) && isStr(c.source) && !declared.has(String(c.source)));
  if (badProductLabels.length) return failed(id, `${badProductLabels.length} product claim label(s) are not in the canonical enum (${badProductLabels.map((c) => c?.label).join(", ")})`);
  if (productUnsourced.length) return failed(id, `${productUnsourced.length} product claim(s) labelled sourced/expert without a source`);
  if (unlabelled || unsourced) return { ...failed(id, `${unlabelled} claim(s) with invalid labels, ${unsourced} sourced claim(s) without a source`), inputs: ["product.evidence", inp.trId] };
  if (unresolvedSource.length) return { ...failed(id, `${unresolvedSource.length} claim(s) reference a source that is not in product.evidence.sources`), inputs: ["product.evidence", inp.trId] };
  const review = evidenceReviewState(inp);
  if (!review.resolved) return gate(id, VERDICT.REVIEW_REQUIRED, `deterministic prerequisites satisfied; independent evidence review outstanding (${review.reason})`, { inputs: ["product.evidence", inp.trId], missing_requirements: ["independent evidence review record (product.human_review RESOLVED with evidence_references)"], human_action: "Evidence reviewer confirms claim labels + sources", review });
  return gate(id, VERDICT.PASS, "deterministic prerequisites satisfied and independent review resolved", { inputs: ["product.evidence", inp.trId], review_refs: [review.reviewer], review });
}

function evalG5(inp) {
  const id = "g5_safety";
  const s = inp.product.safety;
  const missing = [];
  if (!isObj(s)) missing.push("product.safety");
  else {
    if (s.risk_level !== undefined && !RISK_LEVELS.includes(s.risk_level)) return failed(id, `risk_level "${s.risk_level}" is not a valid enum value`);
    if (!isStr(s.risk_level)) missing.push("product.safety.risk_level");
    if (!isStr(s.disclaimer)) missing.push("product.safety.disclaimer");
    if (!Array.isArray(s.escalation_rules)) missing.push("product.safety.escalation_rules");
  }
  if (missing.length) return { ...missingInput(id, missing.join(", ")), inputs: ["product.safety", inp.trId] };
  if (!isStr(inp.transformation?.safety?.scope_boundary)) missing.push("transformation.safety.scope_boundary");
  const elevated = ["moderate", "high", "clinical"].includes(s.risk_level);
  // Missing red-flag criteria for elevated risk is MISSING AUTHORITATIVE INPUT (literature-sourced),
  // never an invented value and not a quality FAIL.
  if (elevated && (!Array.isArray(s.red_flags) || s.red_flags.length === 0)) missing.push("product.safety.red_flags (required at elevated risk; must come from authoritative literature)");
  if (elevated && s.escalation_rules.length === 0) missing.push("product.safety.escalation_rules (required at elevated risk)");
  if (missing.length) return { ...missingInput(id, missing.join(", ")), inputs: ["product.safety", inp.trId] };
  if (!elevated && !Array.isArray(s.red_flags)) missing.push("product.safety.red_flags");
  if (missing.length) return { ...missingInput(id, missing.join(", ")), inputs: ["product.safety", inp.trId] };
  const placeholder = s.escalation_rules.find((r) => /local crisis line|your local|placeholder|XXXX|\b000\b|999-style/i.test(String(r)));
  if (placeholder) return failed(id, `escalation rule uses a placeholder/invented route: "${placeholder}"`);
  if (elevated && !s.escalation_rules.some((r) => /verified shared crisis|verified.*list|RED|AMBER|GREEN/i.test(String(r)))) {
    return failed(id, "escalation routes do not reference the verified shared crisis/escalation list");
  }
  const review = safetyReviewState(inp);
  const clinical = ["high", "clinical"].includes(s.risk_level) || s.risk_level === "moderate";
  const required = clinical ? VERDICT.CLINICAL_REVIEW_REQUIRED : VERDICT.REVIEW_REQUIRED;
  if (!review.resolved) return gate(id, required, `deterministic safety prerequisites satisfied; ${clinical ? "clinical" : "human"} safety review outstanding (${review.reason})`, {
    inputs: ["product.safety", inp.trId],
    missing_requirements: [`${clinical ? "clinical/human" : "human"} safety review record (product.human_review RESOLVED with safety_references)`],
    human_action: clinical ? "Gate O clinical reviewer confirms red flags + escalation routes" : "Safety reviewer confirms disclaimer, red flags and escalation routes",
    review,
  });
  return gate(id, VERDICT.PASS, "deterministic safety prerequisites satisfied and review resolved", { inputs: ["product.safety", inp.trId], review_refs: [review.reviewer], review });
}

function evalG6(inp) {
  const id = "g6_content";
  const missing = [];
  const c = inp.product.content ?? {};
  const broken = [];
  for (const key of ["landing_page", "product_page", "faq", "reviews"]) {
    const entry = inp.content[key];
    if (!entry) continue;
    if (entry.parse_error) broken.push(`product.content.${key} is not valid JSON`);
    else if (entry.exists && entry.schema_valid === false) broken.push(`product.content.${key} fails ${CONTENT_SCHEMAS[key]}`);
  }
  if (broken.length) return { ...failed(id, broken.join("; ")), inputs: ["product.content"] };
  for (const key of ["landing_page", "product_page", "faq"]) {
    const entry = inp.content[key];
    if (!entry || !isStr(entry.ref)) missing.push(`product.content.${key}`);
    else if (!entry.exists) missing.push(`product.content.${key} file missing (${entry.ref})`);
  }
  const reviews = inp.content.reviews;
  if (!reviews || !isStr(reviews.ref)) missing.push("product.content.reviews (15-25 review gate)");
  const jobs = Object.entries(inp.product.asset_map ?? {}).filter(([, v]) => Array.isArray(v) && v.length);
  if (jobs.length === 0) missing.push("product.asset_map (no customer jobs declared)");
  const tr = inp.transformation;
  const hasRescue = jobs.some(([job]) => /rescue/i.test(job));
  if (tr && tr.failure_point_map?.length && !hasRescue) missing.push("asset_map.rescue (transformation declares failure points)");
  const hasTrack = jobs.some(([job]) => /track/i.test(job));
  if (tr && tr.tsm?.measurement_days?.length && !hasTrack) missing.push("asset_map.track (TSM check-ins declared)");
  if (missing.length) return { ...missingInput(id, missing.join(", ")), inputs: ["product.content", "product.asset_map"] };
  return gate(id, VERDICT.PASS, `declared customer jobs covered (${jobs.map(([j, v]) => `${j}:${v.length}`).join(", ")}) + required content artifacts present`, { inputs: ["product.content", "product.asset_map", inp.trId] });
}

function evalG7(inp) {
  const id = "g7_product_qa";
  const det = inp.product.qa?.deterministic_tests ?? [];
  const ai = inp.product.qa?.ai_tests ?? [];
  const missing = [];
  if (!det.length) missing.push("product.qa.deterministic_tests");
  if (!ai.length) missing.push("product.qa.ai_tests");
  if (!ai.some((t) => t.test === "R_drift_integrity")) missing.push("product.qa.ai_tests R_drift_integrity (mandatory every review round)");
  if (missing.length) return { ...missingInput(id, missing.join(", ")), inputs: ["product.qa.deterministic_tests", "product.qa.ai_tests"] };
  const detFail = det.filter((t) => t.result === "FAIL");
  const detNonPass = det.filter((t) => t.result !== "PASS");
  const aiFail = ai.filter((t) => t.status === "FAIL");
  const aiRevision = ai.filter((t) => t.status === "REVISION_REQUIRED");
  const invalid = ai.filter((t) => !AI_TEST_STATUSES.includes(t.status));
  if (invalid.length) return failed(id, `${invalid.length} ai_test(s) with invalid status (${invalid.map((t) => `${t.test}:${t.status}`).join(", ")})`);
  if (detFail.length || aiFail.length || aiRevision.length) {
    const parts = [];
    if (detFail.length) parts.push(`deterministic FAIL: ${detFail.map((t) => t.test).join(", ")}`);
    if (aiFail.length) parts.push(`ai FAIL: ${aiFail.map((t) => t.test).join(", ")}`);
    if (aiRevision.length) parts.push(`ai REVISION_REQUIRED: ${aiRevision.map((t) => `${t.test}${t.severity ? ` (${t.severity})` : ""}`).join(", ")}`);
    return { ...failed(id, parts.join("; ")), reason_code: aiRevision.length && !detFail.length && !aiFail.length ? "REVISION_REQUIRED" : "QA_FAIL", inputs: ["product.qa.deterministic_tests", "product.qa.ai_tests"] };
  }
  if (detNonPass.length) return missingInput(id, `deterministic_tests not evaluated: ${detNonPass.map((t) => t.test).join(", ")}`);
  const canonical = inp.checks.filter((c) => /schema_valid|asset_|content_|transformation_relationship_exists|tsm_exists/.test(c.test));
  const canonicalFail = canonical.filter((c) => c.result === "FAIL");
  if (canonicalFail.length) return failed(id, `canonical qa-checks FAIL: ${canonicalFail.map((c) => c.test).join(", ")}`);
  return gate(id, VERDICT.PASS, `deterministic (${det.length}) + AI (${ai.length}) acceptance ledger all PASS incl. R_drift_integrity; canonical qa-checks green (${canonical.length} checks)`, { inputs: ["product.qa.deterministic_tests", "product.qa.ai_tests", "harness/qa-checks.mjs"], evidence_refs: canonical.slice(0, 12).map((c) => `${c.test}=${c.result}`) });
}

function evalG8(inp) {
  const id = "g8_commerce";
  const c = inp.product.commerce;
  const missing = [];
  if (!isObj(c)) missing.push("product.commerce");
  else {
    if (!isObj(c.price) || typeof c.price.base_usd !== "number") missing.push("product.commerce.price.base_usd (numeric, USD base)");
    if (!isObj(c.currency_rules) || Object.keys(c.currency_rules).length === 0) missing.push("product.commerce.currency_rules (manual per-currency model)");
    if (!isObj(c.access_rules) || !isStr(c.access_rules.grant_type)) missing.push("product.commerce.access_rules.grant_type");
    if (!Array.isArray(c.upsells)) missing.push("product.commerce.upsells");
    if (!Array.isArray(c.bundles)) missing.push("product.commerce.bundles");
    if (!isObj(c.offer)) missing.push("product.commerce.offer");
  }
  if (missing.length) return { ...missingInput(id, missing.join(", ")), inputs: ["product.commerce"] };
  const known = new Set(readdirSync(join(ROOT, "data", "products")));
  const unresolved = [...c.upsells, ...c.bundles].filter((x) => isStr(x) && !known.has(x));
  if (unresolved.length) return failed(id, `upsell/bundle targets do not resolve: ${unresolved.join(", ")}`);
  const zeroPrice = c.price.base_usd <= 0;
  if (zeroPrice) return failed(id, "price.base_usd must be greater than zero");
  return gate(id, VERDICT.PASS, `price ${c.price.base_usd} USD + currency rules (${Object.keys(c.currency_rules).join(", ")}) + access ${c.access_rules.grant_type} + no unresolved upsell/bundle`, { inputs: ["product.commerce"], notes: "payment + delivery runtime is verified by the Gate-9 customer-journey walk-through (standard gate 9)" });
}

function evalG9(inp) {
  const id = "g9_customer_journey";
  const missing = [];
  const c = inp.content;
  for (const key of ["landing_page", "product_page", "faq", "reviews"]) if (!c[key] || !c[key].exists) missing.push(`customer-journey artifact: product.content.${key}`);
  const tr = inp.transformation;
  if (!tr?.tsm?.measurement_days?.length) missing.push(`${inp.trId ?? "transformation"}.tsm.measurement_days (TSM check-in loop)`);
  if (!Array.isArray(inp.product.transformation?.next_transformation_ids)) missing.push("product.transformation.next_transformation_ids");
  const wp = inp.product.publishing?.wordpress_ids ?? {};
  if (!wp.transformation_id || !wp.tsystem_id || !wp.product_id) missing.push("product.publishing.wordpress_ids (platform walk-through requires real platform ids)");
  if (missing.length) return { ...missingInput(id, missing.join(", ")), inputs: ["product.content", "product.publishing.wordpress_ids", inp.trId] };
  const hr = inp.product.human_review ?? null;
  if (!hr || hr.status !== "RESOLVED" || !isStr(hr.resolved_by)) {
    return gate(id, VERDICT.REVIEW_REQUIRED, "technical journey prerequisites present; real walk-through (discover -> purchase -> access -> onboarding -> first win -> path -> completion -> TSM check-in -> next transformation) requires a recorded human/platform test", {
      inputs: ["product.content", "product.publishing.wordpress_ids"],
      missing_requirements: ["recorded journey walk-through (product.human_review RESOLVED with resolved_by/resolution)"],
      human_action: "Operator runs the live journey walk-through and records the outcome",
      architectural_gap: "no dedicated journey-test record exists in the product schema; the canonical review surface (product.human_review) is reused",
    });
  }
  return gate(id, VERDICT.PASS, "technical prerequisites present and a resolved human/platform walk-through is recorded", { inputs: ["product.content", "product.publishing.wordpress_ids"], review_refs: [hr.resolved_by] });
}

function evalG10(inp) {
  const id = "g10_publish";
  const auth = inp.product.publishing?.authorization ?? null;
  if (!auth) return gate(id, VERDICT.OWNER_ACTION_REQUIRED, "publishing authorization absent - only an actual owner/human authorization may satisfy Gate 10", {
    inputs: ["product.publishing.authorization"],
    missing_requirements: ["product.publishing.authorization {status:'READY_TO_PUBLISH', authorized_by, authorized_at}"],
    human_action: "Owner records explicit publication authorization",
  });
  const problems = [];
  if (auth.status !== "READY_TO_PUBLISH") problems.push(`status "${auth.status}" is not READY_TO_PUBLISH`);
  if (!isStr(auth.authorized_by)) problems.push("authorized_by missing");
  if (!isStr(auth.authorized_at) || !/^\d{4}-\d{2}-\d{2}T/.test(auth.authorized_at)) problems.push("authorized_at missing/invalid");
  if (problems.length) return gate(id, VERDICT.INVALID_AUTHORIZATION, `authorization record present but invalid: ${problems.join("; ")}`, { inputs: ["product.publishing.authorization"], failures: problems });
  return gate(id, VERDICT.PASS, `existing owner authorization recognized (${auth.authorized_by}, ${auth.authorized_at})`, { inputs: ["product.publishing.authorization"], authorization_refs: [`${auth.authorized_by}@${auth.authorized_at}`] });
}

// ------------------------------------------------------------------------------------------------
// historical / legacy authority detection (never trusted as current authority)
// ------------------------------------------------------------------------------------------------
export function historicalArtifacts(inp) {
  const out = [];
  const p = inp.product;
  if (p.status === "published") out.push({ artifact: "product.status", value: "published", classification: "HISTORICAL", reason: "product status is not gate authority (standard 18: no transition may be inferred from files/state alone)" });
  const wp = p.publishing?.wordpress_ids ?? {};
  if (wp.product_id) out.push({ artifact: "product.publishing.wordpress_ids", value: wp, classification: "HISTORICAL", reason: "a live platform product does not retroactively manufacture factory QA evidence" });
  const legacyGates = Object.entries(p.qa?.gate_results ?? {}).filter(([, v]) => v === "PASS").map(([k]) => k);
  if (legacyGates.length) out.push({ artifact: "product.qa.gate_results (stored PASS values)", value: legacyGates, classification: "HISTORICAL_UNVERIFIED", reason: "stored gate values are claims; only the runner's current evaluation (or an existing review/authorization record) establishes authority" });
  if (inp.manifest) {
    out.push({
      artifact: "publish/manifest.json",
      value: { qa: inp.manifest.qa ?? null, publish_authorization: inp.manifest.publish_authorization ?? null },
      classification: "HISTORICAL_UNVERIFIED",
      reason: "manifest predates the strict gate runner and has no matching current authority (no product.publishing.authorization record)",
    });
  }
  return out;
}

// ------------------------------------------------------------------------------------------------
// review packets
// ------------------------------------------------------------------------------------------------
function evidencePacket(inp) {
  const e = inp.product.evidence ?? {};
  const tr = inp.transformation;
  const claims = [...(tr?.evidence ?? []), ...(tr?.mechanism?.evidence_basis ?? [])];
  return {
    packet_type: "EVIDENCE_REVIEW_PACKET",
    product_id: inp.product.product_id,
    transformation_id: inp.trId,
    authoritative_sources: Array.isArray(e.sources) ? e.sources : [],
    recorded_review_narrative: isStr(e.review_status) ? e.review_status : null,
    labelled_claims: claims.map((c) => ({ claim: c.claim, label: c.status, source: c.source ?? null })),
    unresolved_questions: [
      ...(Array.isArray(e.claim_labels) && e.claim_labels.length === 0 ? ["product.evidence.claim_labels is empty at product level; labels verified only on the canonical transformation record"] : []),
      "Independent evidence review has not been recorded (no RESOLVED product.human_review with evidence_references)",
    ],
    authority_required: "independent evidence reviewer (never the builder)",
    note: "no new evidence is created here; this packet contains only existing authoritative material",
  };
}
function safetyPacket(inp) {
  const s = inp.product.safety ?? {};
  const tr = inp.transformation;
  return {
    packet_type: "SAFETY_REVIEW_PACKET",
    product_id: inp.product.product_id,
    transformation_id: inp.trId,
    risk_level: s.risk_level ?? null,
    disclaimer: s.disclaimer ?? null,
    red_flags: Array.isArray(s.red_flags) ? s.red_flags : [],
    escalation_rules: Array.isArray(s.escalation_rules) ? s.escalation_rules : [],
    transformation_scope_boundary: tr?.safety?.scope_boundary ?? null,
    unresolved_review_items: [
      "Clinical/human safety review has not been recorded (no RESOLVED product.human_review with safety_references)",
      ...(Array.isArray(s.red_flags) && s.red_flags.length === 0 ? ["red-flag criteria absent - must come from authoritative literature, never invented by the runner"] : []),
    ],
    authority_required: "clinical reviewer (Gate O) - the runner never invents clinical judgment, thresholds or reviewers",
    note: "no new medical advice is produced here",
  };
}
function ownerPacket(inp, gateResults) {
  const blocking = gateResults.filter((g) => g.blocks_manifest && g.verdict !== VERDICT.PASS).map((g) => `${g.id}: ${g.verdict}`);
  return {
    packet_type: "OWNER_ACTION_PACKET",
    product_id: inp.product.product_id,
    product_title: inp.product.identity?.name ?? null,
    transformation_id: inp.trId,
    being_authorized: "publication of this product to the live platform (publish manifest -> WordPress publisher bridge)",
    prerequisite_gates_unresolved: blocking,
    required_record: "product.publishing.authorization { status: 'READY_TO_PUBLISH', authorized_by: <named human>, authorized_at: <ISO date-time> }",
    automatic_approval: false,
    note: "the runner cannot authorize, cannot invent an owner, and never treats 'everything else passed' as authorization",
  };
}

// ------------------------------------------------------------------------------------------------
// evaluation
// ------------------------------------------------------------------------------------------------
const EVALUATORS = {
  g0_research_disposition: evalG0, g1_situation: evalG1, g2_transformation: evalG2, g3_product_architecture: evalG3,
  g4_evidence: evalG4, g5_safety: evalG5, g6_content: evalG6, g7_product_qa: evalG7, g8_commerce: evalG8,
  g9_customer_journey: evalG9, g10_publish: evalG10,
};

function persistedFor(verdict) {
  if (verdict === VERDICT.PASS) return PERSISTED.PASS;
  if (verdict === VERDICT.FAIL || verdict === VERDICT.INVALID_AUTHORIZATION) return PERSISTED.FAIL;
  if (verdict === VERDICT.BLOCKED_BY_PREREQUISITE) return PERSISTED.PENDING;
  return PERSISTED.PENDING;   // SOURCE_REQUIRED / REVIEW_REQUIRED / CLINICAL_REVIEW_REQUIRED / OWNER_ACTION_REQUIRED
}

/** Evaluate the canonical gate state for one product. Pure over its inputs + the canonical QA ledger. */
export function evaluateProductGates(productId, { qaLedger = null, root = ROOT } = {}) {
  const inputs = loadProductInputs(productId, { qaLedger, root });
  if (!inputs.ok) {
    return {
      status: RUN_STATUS.INVALID_INPUT,
      product_id: productId,
      transformation_id: null,
      errors: inputs.errors,
      gate_results: {},
      gate_matrix: [],
      blocking_gates: [],
      manifest_eligible: false,
      run_report: { runner_version: GATE_RUNNER_VERSION, status: RUN_STATUS.INVALID_INPUT, product_id: productId, errors: inputs.errors },
    };
  }
  const gateResults = [];
  for (const def of GATES) {
    let r = EVALUATORS[def.id](inputs);
    // conjunctive dependencies: a gate can never PASS while an authoritative prerequisite is not PASS
    if (r.verdict === VERDICT.PASS) {
      const bad = GATE_DEPENDENCIES[def.id].filter((dep) => {
        const prior = gateResults.find((g) => g.id === dep);
        return prior && prior.verdict !== VERDICT.PASS;
      });
      if (bad.length) r = gate(def.id, VERDICT.BLOCKED_BY_PREREQUISITE, `cannot PASS while prerequisite gate(s) are unresolved: ${bad.join(", ")}`, { blocked_by: bad, inputs: r.inputs, missing_requirements: bad });
    }
    gateResults.push({ ...def, ...r, persisted: persistedFor(r.verdict) });
  }

  const blockingGates = gateResults.filter((g) => g.blocks_manifest && g.persisted !== PERSISTED.PASS).map((g) => g.id);
  const authorization = inputs.product.publishing?.authorization ?? null;
  const authValid = isObj(authorization) && authorization.status === "READY_TO_PUBLISH" && isStr(authorization.authorized_by) && isStr(authorization.authorized_at);
  const humanReviewBlocking = inputs.product.human_review && ["PENDING_HUMAN_REVIEW", "BLOCKED"].includes(inputs.product.human_review.status);
  const manifestEligible = blockingGates.length === 0 && authValid && !humanReviewBlocking;

  const verdicts = gateResults.map((g) => g.verdict);
  // Precedence: quality failure, then missing upstream input, then reviews, then owner action.
  // Missing authoritative input must be fixed before review questions can be answered.
  let status = RUN_STATUS.MANIFEST_ELIGIBLE;
  if (verdicts.some((v) => v === VERDICT.FAIL || v === VERDICT.INVALID_AUTHORIZATION)) status = RUN_STATUS.BLOCKED;
  else if (verdicts.some((v) => v === VERDICT.SOURCE_REQUIRED || v === VERDICT.BLOCKED_BY_PREREQUISITE)) status = RUN_STATUS.SOURCE_REQUIRED;
  else if (verdicts.some((v) => v === VERDICT.CLINICAL_REVIEW_REQUIRED)) status = RUN_STATUS.CLINICAL_REVIEW_REQUIRED;
  else if (verdicts.some((v) => v === VERDICT.REVIEW_REQUIRED)) status = RUN_STATUS.REVIEW_REQUIRED;
  else if (verdicts.some((v) => v === VERDICT.OWNER_ACTION_REQUIRED)) status = RUN_STATUS.OWNER_ACTION_REQUIRED;

  // manifest verdict projection (exactly what build-manifest.mjs reads, never weakened)
  const det = inputs.product.qa?.deterministic_tests ?? [];
  const ai = inputs.product.qa?.ai_tests ?? [];
  const allPass = (arr, key) => Array.isArray(arr) && arr.length > 0 && arr.every((t) => t[key] === "PASS");
  const g7 = gateResults.find((g) => g.id === "g7_product_qa");
  const byId = Object.fromEntries(gateResults.map((g) => [g.id, g]));
  const manifestVerdicts = {
    deterministic: g7.persisted === PERSISTED.PASS && allPass(det, "result") ? "PASS" : "FAIL",
    ai: g7.persisted === PERSISTED.PASS && allPass(ai, "status") ? "PASS" : "FAIL",
    safety: byId.g5_safety.persisted === PERSISTED.PASS ? "PASS" : "FAIL",
    commerce: byId.g8_commerce.persisted === PERSISTED.PASS ? "PASS" : "FAIL",
    journey: byId.g9_customer_journey.persisted === PERSISTED.PASS ? "PASS" : "FAIL",
  };

  const unresolvedRequirements = gateResults.filter((g) => g.missing_requirements?.length).flatMap((g) => g.missing_requirements.map((m) => `${g.id}: ${m}`));
  const failures = gateResults.filter((g) => g.failures?.length).flatMap((g) => g.failures.map((f) => `${g.id}: ${f}`));

  const report = {
    runner_version: GATE_RUNNER_VERSION,
    status,
    product_id: inputs.product.product_id,
    transformation_id: inputs.trId,
    gate_results: Object.fromEntries(gateResults.map((g) => [g.id, g.persisted])),
    gate_matrix: gateResults.map((g) => ({
      gate: g.id, number: g.n, name: g.name, authority: g.authority,
      inputs: g.inputs ?? [], deterministic_checks: (g.evidence_refs ?? []).slice(0, 12),
      current_verdict: g.verdict, persisted: g.persisted, reason: g.reason,
      missing_requirements: g.missing_requirements ?? [], failures: g.failures ?? [], notes: g.notes ?? null,
      reason_code: g.reason_code ?? null, architectural_gap: g.architectural_gap ?? null, human_action: g.human_action ?? null,
      review_refs: g.review_refs ?? [], authorization_refs: g.authorization_refs ?? [], blocked_by: g.blocked_by ?? [], blocks_manifest: g.blocks_manifest,
    })),
    deterministic_checks: {
      canonical_runner: "harness/qa-checks.mjs",
      summary: inputs.qaLedger.summary,
      product_checks: inputs.checks.map((c) => ({ test: c.test, result: c.result, detail: c.detail })),
    },
    manifest_verdicts: manifestVerdicts,
    manifest_verdicts_basis: "computed gate state - exactly what harness/build-manifest.mjs will derive once this state is present in product.qa.gate_results",
    builder_verdicts_on_stored_record: (() => {
      const stored = inputs.product.qa?.gate_results ?? {};
      return {
        deterministic: stored.g7_product_qa === PERSISTED.PASS && allPass(det, "result") ? "PASS" : "FAIL",
        ai: stored.g7_product_qa === PERSISTED.PASS && allPass(ai, "status") ? "PASS" : "FAIL",
        safety: stored.g5_safety === PERSISTED.PASS ? "PASS" : "FAIL",
        commerce: stored.g8_commerce === PERSISTED.PASS ? "PASS" : "FAIL",
        journey: stored.g9_customer_journey === PERSISTED.PASS ? "PASS" : "FAIL",
      };
    })(),
    evidence_review: evidencePacket(inputs),
    safety_review: safetyPacket(inputs),
    owner_action: ownerPacket(inputs, gateResults),
    unresolved_requirements: unresolvedRequirements,
    failures,
    blocking_gates: blockingGates,
    manifest_eligible: manifestEligible,
    historical_artifacts: historicalArtifacts(inputs),
    warnings: [
      ...(inputs.checks.length === 0 ? ["no canonical qa-checks ledger entries were found for this product"] : []),
      ...(inputs.product.human_review ? [] : ["no canonical review record (product.human_review) exists for this product"]),
    ],
    evaluated_inputs: {
      product: `data/products/${productId}/product.json`,
      transformation: inputs.trId ? `data/transformations/${inputs.trId}.json` : null,
      transformation_present: !!inputs.transformation,
      assets: Object.values(inputs.assets).filter((a) => a.exists).length,
      content_artifacts: Object.values(inputs.content).filter((c) => c.exists).length,
      qa_ledger_checks: inputs.checks.length,
      manifest_present: !!inputs.manifest,
      authorization_present: !!authorization,
      human_review_present: !!inputs.product.human_review,
    },
  };
  return { status, product_id: inputs.product.product_id, transformation_id: inputs.trId, gate_results: report.gate_results, gate_matrix: report.gate_matrix, blocking_gates: blockingGates, manifest_eligible: manifestEligible, run_report: report, inputs };
}

// ------------------------------------------------------------------------------------------------
// write policy (explicit; never manufactures or downgrades authority)
// ------------------------------------------------------------------------------------------------
/**
 * Compute the minimal, authority-preserving gate_results write.
 * Rules:
 *  - a computed non-PASS never overwrites a stored PASS  -> CONFLICT (human/prior authority preserved)
 *  - a computed PASS is written only when its authority is established by an existing record
 *    (deterministic evaluation, a RESOLVED review record, or a valid authorization record)
 *  - stored values are otherwise reconciled to the computed persisted value (upgrade/downgrade logged)
 */
export function planGateWrite(evaluation) {
  const stored = evaluation.inputs?.product?.qa?.gate_results ?? {};
  const changes = [], conflicts = [];
  const next = { ...stored };
  for (const g of evaluation.gate_matrix) {
    const before = stored[g.gate] ?? null;
    const after = g.persisted;
    if (before === after) continue;
    if (before === PERSISTED.PASS && after !== PERSISTED.PASS) { conflicts.push({ gate: g.gate, stored: before, computed: after, reason: "stored PASS is not overwritten by a computed non-PASS (conflict)" }); continue; }
    changes.push({ gate: g.gate, from: before, to: after, authority: g.authority, reason: g.reason });
    next[g.gate] = after;
  }
  return { gate_results: next, changes, conflicts, has_conflicts: conflicts.length > 0 };
}

/** Apply the plan to product.json (write mode only). Writes ONLY qa.gate_results. */
export function applyGateWrite(productPath, plan) {
  const product = JSON.parse(readFileSync(productPath, "utf8"));
  product.qa = { ...(product.qa ?? {}), gate_results: plan.gate_results };
  writeFileSync(productPath, `${JSON.stringify(product, null, 2)}\n`, "utf8");
  return product;
}

/**
 * Full run. mode "dry-run" (default) never mutates anything; mode "write" persists only gate_results
 * when there are no authority conflicts.
 */
export function runProductQaGates(productId, { mode = "dry-run", qaLedger = null, report_path = null, applyWrite = applyGateWrite, root = ROOT } = {}) {
  const evaluation = evaluateProductGates(productId, { qaLedger, root });
  const plan = evaluation.inputs ? planGateWrite(evaluation) : { gate_results: {}, changes: [], conflicts: [], has_conflicts: false };

  let persisted = false, productPath = null;
  if (mode === "write" && evaluation.inputs && evaluation.status !== RUN_STATUS.INVALID_INPUT) {
    productPath = evaluation.inputs.productPath;
    if (plan.has_conflicts) {
      evaluation.status = RUN_STATUS.CONFLICT;
      evaluation.run_report.status = RUN_STATUS.CONFLICT;
      evaluation.run_report.conflicts = plan.conflicts;
      evaluation.run_report.warnings = [...evaluation.run_report.warnings, "write refused: stored PASS values conflict with current evaluation authority"];
    } else {
      applyWrite(productPath, plan);
      persisted = true;
      evaluation.run_report.gate_results = plan.gate_results;
      evaluation.gate_results = plan.gate_results;
    }
  }
  if (report_path) writeFileSync(resolve(report_path), `${JSON.stringify(evaluation.run_report, null, 2)}\n`, "utf8");

  return { ...evaluation, mode, persisted, product_path: productPath, planned_changes: plan.changes, conflicts: plan.conflicts };
}

// ------------------------------------------------------------------------------------------------
// CLI
// ------------------------------------------------------------------------------------------------
const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const get = (flag) => { const i = args.indexOf(flag); return i > -1 ? args[i + 1] : null; };
  const pid = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--report" && args[args.indexOf(a) - 1] !== "--root");
  if (!pid) {
    console.error("usage: node harness/product-qa-gate-runner.mjs <PRODUCT_ID> [--write] [--report <file.json>] [--root <dir>]");
    process.exit(2);
  }
  const rootArg = get("--root");
  const result = runProductQaGates(pid, {
    mode: args.includes("--write") ? "write" : "dry-run",
    report_path: get("--report"),
    ...(rootArg ? { root: resolve(rootArg) } : {}),
  });
  const out = {
    runner_version: result.run_report.runner_version,
    status: result.status,
    product_id: result.product_id,
    transformation_id: result.transformation_id,
    gate_results: result.gate_results,
    manifest_verdicts: result.run_report.manifest_verdicts,
    blocking_gates: result.blocking_gates,
    manifest_eligible: result.manifest_eligible,
    persisted: result.persisted,
    changes: result.planned_changes,
    conflicts: result.conflicts,
    unresolved_requirements: result.run_report.unresolved_requirements,
    failures: result.run_report.failures,
  };
  console.log(JSON.stringify(out, null, 2));
  process.exit(result.status === RUN_STATUS.INVALID_INPUT ? 1 : 0);
}
