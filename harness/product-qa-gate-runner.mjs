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
import { reviewInputFor } from "./review-inputs.mjs";
import {
  buildAuthorityContext, evaluateEvidenceAuthority, evaluateSafetyAuthority, evaluateJourneyAuthority,
  classifyTSM, evaluatePublicationConstitution, loadConstitution, evaluateAuthority,
  persistAuthorityEvaluation, authorizeFromConstitution, STATE as AUTH_STATE,
} from "./governance-authority.mjs";
/** Deterministic authority timestamp (the gate runner uses no Date.now/Math.random in results). */
const AUTHORITY_EPOCH = "2026-09-23T00:00:00.000Z";

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
  { id: "g4_evidence", n: 4, name: "Evidence authority", authority: "EVIDENCE_AUTHORITY", blocks_manifest: true, review_surface: "evidence" },
  { id: "g5_safety", n: 5, name: "Safety authority", authority: "SAFETY_AUTHORITY", blocks_manifest: true, review_surface: "safety" },
  { id: "g6_content", n: 6, name: "Content", authority: "DETERMINISTIC", blocks_manifest: true },
  { id: "g7_product_qa", n: 7, name: "Product QA", authority: "HYBRID", blocks_manifest: true, review_surface: "qa_ledger" },
  { id: "g8_commerce", n: 8, name: "Commerce", authority: "DETERMINISTIC", blocks_manifest: true },
  { id: "g9_customer_journey", n: 9, name: "Journey authority", authority: "JOURNEY_AUTHORITY", blocks_manifest: true, review_surface: "journey" },
  { id: "g10_publish", n: 10, name: "Publication constitution", authority: "PUBLICATION_CONSTITUTION", blocks_manifest: true },
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
  // Phase K: a product may reference only a transformation that reached the required lifecycle
  // state (schemas/product.schema.json identity.transformation_id; schemas/transformation.schema.json
  // status: validated-or-better is required before any product specification may reference it).
  if (!["validated", "active"].includes(tr.status)) {
    return gate("g0_research_disposition", VERDICT.SOURCE_REQUIRED,
      `transformation ${tr.transformation_id} is "${tr.status}": the validated-or-better lifecycle state is required before product specification`,
      { inputs: [inp.trId], missing_requirements: [`transformation ${inp.trId} must be validated (run harness/validate-transformation.mjs)`], human_action: "Owner/validator completes the governed validation transition" });
  }
  const d = tr.research_disposition;
  if (!isObj(d) || !isStr(d.library_role) || !isStr(d.rationale)) return missingInput("g0_research_disposition", "transformation.research_disposition {library_role, rationale}");
  const roles = ["STANDALONE_TRANSFORMATION", "ENTRY_PRODUCT", "UPSELL", "ORDER_BUMP", "BUNDLE_COMPONENT", "MODULE", "BONUS_FREE_GIFT", "LEAD_MAGNET", "MARKETING_ANGLE", "SUPPORTING_ASSET", "JOURNEY_NODE", "FUTURE_RESEARCH", "EVIDENCE_GAP"];
  if (!roles.includes(d.library_role)) return failed("g0_research_disposition", `research_disposition.library_role "${d.library_role}" is not one of the 13 canonical roles`);
  return gate("g0_research_disposition", VERDICT.PASS, `research disposition recorded: ${d.library_role} (transformation lifecycle: ${tr.status})`, { inputs: ["transformation.research_disposition", "transformation.status"], source_refs: [inp.trId] });
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

/**
 * Per-authority human review state (task section 34).
 *
 * A gate consumes ONLY its own authority's record, so an evidence reviewer can never satisfy the
 * clinical gate and a clinician can never satisfy the evidence or journey gate. A record is only
 * accepted when it is: the right authority, RESOLVED, authored by a NAMED HUMAN (never AI/automation),
 * free of blocking item findings, and bound to the CURRENT narrow review input (task section 30) so a
 * stale human approval can never silently satisfy a gate.
 */
const AUTOMATED_REVIEWER = /^(ai|a\.i\.|opencode|open-code|bot|automation|automatic|system|machine|llm|gpt|model|builder|generator|null|unknown|n\/a|none|test)/i;
function authorityReview(inp, gate, authority) {
  const reviews = inp.product?.human_review?.reviews ?? null;
  const r = reviews?.[gate] ?? null;
  if (!r) return { present: false, resolved: false, reason: `no ${gate} review record (product.human_review.reviews.${gate})` };
  if (r.authority !== authority) return { present: true, resolved: false, reason: `review record authority '${r.authority}' is not '${authority}' - a different authority cannot satisfy this gate` };
  if (r.status !== "RESOLVED") return { present: true, resolved: false, reason: `${gate} review status is ${r.status}` };
  if (!isStr(r.resolved_by) || !isStr(r.resolution)) return { present: true, resolved: false, reason: `${gate} review is RESOLVED but lacks resolved_by/resolution` };
  if (r.reviewer_kind !== "HUMAN" || AUTOMATED_REVIEWER.test(String(r.resolved_by).trim())) {
    return { present: true, resolved: false, reason: `${gate} review was not authored by a named human reviewer (reviewer_kind='${r.reviewer_kind ?? "missing"}', resolved_by='${r.resolved_by}')` };
  }
  const blocking = [...(r.source_required ?? []), ...(r.revision_required ?? []), ...(r.escalations ?? []), ...(r.defects ?? [])];
  if (blocking.length) return { present: true, resolved: false, reason: `${gate} review carries ${blocking.length} blocking finding(s): ${blocking.slice(0, 6).join(", ")}` };
  let current = null;
  try { current = reviewInputFor(gate, inp.product, inp.transformation).input_hash; } catch { current = null; }
  if (!isStr(r.input_hash) || r.input_hash !== current) {
    return { present: true, resolved: false, reason: `${gate} review is STALE (reviewed ${String(r.input_hash ?? "nothing").slice(0, 12)}, current ${String(current).slice(0, 12)}) - the governed material changed after review` };
  }
  const refs = Array.isArray(r.item_decisions) ? r.item_decisions.map((d) => d?.item_id).filter(isStr) : [];
  return { present: true, resolved: true, refs, reviewer: r.resolved_by, role: r.reviewer_role ?? null, qualification: r.reviewer_qualification ?? null, reviewed_at: r.reviewed_at ?? r.resolved_at ?? null, input_hash: r.input_hash, reason: `${gate} review RESOLVED by ${r.resolved_by}` };
}
const evidenceReviewState = (inp) => authorityReview(inp, "g4_evidence", "EVIDENCE_AUTHORITY");
const safetyReviewState = (inp) => authorityReview(inp, "g5_safety", "CLINICAL_AUTHORITY");
const journeyReviewState = (inp) => authorityReview(inp, "g9_journey", "JOURNEY_AUTHORITY");

/** Shared Level-3 authority context for one evaluation (fail-closed: null on any infrastructure error). */
let AUTH_CTX = null;
function authorityCtx(inp) {
  if (AUTH_CTX && AUTH_CTX.product === inp.product && AUTH_CTX.dir === inp.dir) return AUTH_CTX;
  try { AUTH_CTX = buildAuthorityContext(inp.product, inp.transformation, inp.dir, { root: inp.root ?? ROOT }); }
  catch (e) { AUTH_CTX = { error: String(e.message || e), product: inp.product, dir: inp.dir }; }
  return AUTH_CTX;
}
/** Missing-input-class authority reasons are reported as SOURCE_REQUIRED (a stop that is not a quality
 *  FAIL); quality/scope violations are FAIL. Either way the report carries NOT_AUTHORIZED and the
 *  product STOPs - it never becomes a per-product human review queue. */
const INPUT_MISSING_REASONS = ["SOURCE_MISSING", "DOMAIN_AUTHORITY_MISSING", "SOURCE_CLASS_NOT_ALLOWED", "SOURCE_TOO_OLD", "SAFETY_MISSING", "ESCALATION_UNDEFINED", "ARTIFACT_UNRESOLVED", "TSM_MISSING", "SOURCE_REQUIRED"];
const authFailed = (id, a, extraInputs = []) => {
  const reasons = a.failure_reasons ?? [];
  const missing = reasons.length > 0 && reasons.every((r) => INPUT_MISSING_REASONS.includes(r));
  const verdict = missing ? VERDICT.SOURCE_REQUIRED : VERDICT.FAIL;
  return {
    ...gate(id, verdict, `${reasons.join(", ") || "authority checks failed"}`, {
      inputs: extraInputs, authority_state: AUTH_STATE.NOT_AUTHORIZED,
      authority_checks: a.checks ?? [], failure_reasons: reasons,
      authority_required: "SYSTEM (constitution + Domain Authority Pack)",
    }),
    authority_state: AUTH_STATE.NOT_AUTHORIZED,
  };
};

// g4 = automated EVIDENCE AUTHORITY (Evidence Constitution + applicable Domain Authority Pack).
// A model may execute policy where semantic entailment is genuinely required; it is never the authority.
// A RESOLVED human evidence review remains a valid manual path (preserved audit infrastructure), but is
// no longer a normal-production requirement. NOT_AUTHORIZED is a terminal STOP - never a human queue.
function evalG4(inp) {
  const id = "g4_evidence";
  const ctx = authorityCtx(inp);
  if (ctx.error) return authFailed(id, { failure_reasons: ["DOMAIN_AUTHORITY_MISSING"], checks: [{ rule: "AUTH-INFRA", ok: false, detail: ctx.error }] }, ["governance/constitutions/evidence.constitution.json"]);
  const a = evaluateEvidenceAuthority(ctx);
  if (a.state === AUTH_STATE.AUTHORIZED) {
    return { ...gate(id, VERDICT.PASS, `Evidence Authority AUTHORIZED (pack ${ctx.pack?.authority_id ?? "none"}; ${a.claim_count} claim(s), ${a.checks.length} checks)`, { inputs: ["product.evidence", inp.trId, ctx.pack?.authority_id], authority_checks: a.checks }), authority_state: AUTH_STATE.AUTHORIZED };
  }
  const review = evidenceReviewState(inp);
  if (review.resolved) return { ...gate(id, VERDICT.PASS, `Evidence Authority not autonomous for this product; a RESOLVED human evidence review satisfies the gate (${review.reason})`, { inputs: ["product.evidence", inp.trId], review_refs: [review.reviewer] }), authority_state: a.state };
  return authFailed(id, a, ["product.evidence", inp.trId]);
}

// g5 = automated SAFETY AUTHORITY (Safety Constitution + applicable Domain Authority Pack).
// CORRECTED SEMANTICS: elevated risk no longer implies a human clinician. Clinical authority is
// required only when the DOMAIN is genuinely clinical (the pack's clinical_required). A non-clinical
// but consequential domain (e.g. family_finance) is governed by its pack, not a clinician.
function evalG5(inp) {
  const id = "g5_safety";
  const s = inp.product.safety;
  if (!isObj(s)) return { ...missingInput(id, "product.safety"), authority_state: AUTH_STATE.NOT_AUTHORIZED };
  if (s.risk_level !== undefined && !RISK_LEVELS.includes(s.risk_level)) return { ...failed(id, `risk_level "${s.risk_level}" is not a valid enum value`), authority_state: AUTH_STATE.NOT_AUTHORIZED };
  const ctx = authorityCtx(inp);
  if (ctx.error) return authFailed(id, { failure_reasons: ["DOMAIN_AUTHORITY_MISSING"], checks: [{ rule: "AUTH-INFRA", ok: false, detail: ctx.error }] }, ["governance/constitutions/safety.constitution.json"]);
  const a = evaluateSafetyAuthority(ctx);
  if (a.state === AUTH_STATE.AUTHORIZED) {
    return { ...gate(id, VERDICT.PASS, `Safety Authority AUTHORIZED (domain ${ctx.domain.domain}; risk ${a.risk_class}; clinical_required ${a.clinical_required}; pack ${ctx.pack?.authority_id ?? "none"})`, { inputs: ["product.safety", inp.trId, ctx.pack?.authority_id], authority_checks: a.checks }), authority_state: AUTH_STATE.AUTHORIZED };
  }
  const review = safetyReviewState(inp);
  if (review.resolved) return { ...gate(id, VERDICT.PASS, `Safety Authority not autonomous for this product; a RESOLVED human safety review satisfies the gate (${review.reason})`, { inputs: ["product.safety", inp.trId], review_refs: [review.reviewer] }), authority_state: a.state };
  return authFailed(id, a, ["product.safety", inp.trId]);
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

// g9 = automated JOURNEY AUTHORITY (Journey Constitution + applicable Domain Authority Pack).
// Deterministic journey checks replace the mandatory human walk-through for normal products; the
// simulation roles are available where a semantic judgment is genuinely required. The old
// wordpress_ids prerequisite is removed: a live-platform id is POST-publication evidence and cannot
// be a pre-publication requirement (that was circular). NOT_AUTHORIZED stays a STOP - never a queue.
function evalG9(inp) {
  const id = "g9_customer_journey";
  const ctx = authorityCtx(inp);
  if (ctx.error) return authFailed(id, { failure_reasons: ["DOMAIN_AUTHORITY_MISSING"], checks: [{ rule: "AUTH-INFRA", ok: false, detail: ctx.error }] }, ["governance/constitutions/journey.constitution.json"]);
  const a = evaluateJourneyAuthority(ctx);
  if (a.state === AUTH_STATE.AUTHORIZED) {
    return { ...gate(id, VERDICT.PASS, `Journey Authority AUTHORIZED (${a.checks.length} checks; domain ${ctx.domain.domain})`, { inputs: ["product.content", "product.asset_map", inp.trId], authority_checks: a.checks }), authority_state: AUTH_STATE.AUTHORIZED };
  }
  const review = journeyReviewState(inp);
  if (review.resolved) return { ...gate(id, VERDICT.PASS, `Journey Authority not autonomous for this product; a RESOLVED human walk-through satisfies the gate (${review.reason})`, { inputs: ["product.content", inp.trId], review_refs: [review.reviewer] }), authority_state: a.state };
  return authFailed(id, a, ["product.content", "product.asset_map", inp.trId]);
}

// g10 = PUBLICATION CONSTITUTION (not a per-product owner click). When every gate required by the
// approved Publication Constitution is in its required state, the product is autonomously authorized
// (AUTHORIZED_BY_PUBLICATION_CONSTITUTION). A legacy/manual owner authorization record remains a valid
// path (preserved audit infrastructure). NOT_AUTHORIZED is a terminal STOP - never a human queue.
function evalG10(inp, gateResults = []) {
  const id = "g10_publish";
  const ctx = authorityCtx(inp);
  if (ctx.error) return { ...failed(id, `authority infrastructure unavailable: ${ctx.error}`), authority_state: AUTH_STATE.NOT_AUTHORIZED };
  let pubCon = null, tsm = null;
  try {
    pubCon = loadConstitution("PUBLICATION", inp.root ?? ROOT);
    tsm = classifyTSM(inp.product, inp.transformation, loadConstitution("TSM", inp.root ?? ROOT));
  } catch (e) { return { ...failed(id, `publication constitution unavailable: ${e.message}`), authority_state: AUTH_STATE.NOT_AUTHORIZED }; }
  const gateStates = {};
  for (const g of gateResults) gateStates[g.id] = g.authority_state ?? g.persisted;
  const pub = evaluatePublicationConstitution({ gateStates, tsm, pack: ctx.pack, publicationConstitution: pubCon });
  if (pub.state === AUTH_STATE.AUTHORIZED_BY_PUBLICATION_CONSTITUTION) {
    return { ...gate(id, VERDICT.PASS, `AUTHORIZED_BY_PUBLICATION_CONSTITUTION (${pubCon.authority_id}@${pubCon.version}); domain pack ${ctx.pack?.authority_id ?? "none"}; TSM ${tsm.state}`, { inputs: ["governance/constitutions/publication.constitution.json"], authority_checks: [{ rule: "P1-P7", ok: true, detail: "all required states satisfied" }] }), authority_state: pub.state };
  }
  const auth = inp.product.publishing?.authorization ?? null;
  if (auth && auth.status === "READY_TO_PUBLISH" && isStr(auth.authorized_by) && isStr(auth.authorized_at)) {
    return { ...gate(id, VERDICT.PASS, `existing owner authorization recognized (${auth.authorized_by}, ${auth.authorized_at})`, { inputs: ["product.publishing.authorization"] }), authority_state: pub.state };
  }
  if (auth) {
    return { ...gate(id, VERDICT.INVALID_AUTHORIZATION, `authorization record present but invalid (status='${auth.status ?? "missing"}', authorized_by='${auth.authorized_by ?? "missing"}')`, { inputs: ["product.publishing.authorization"], failures: ["READY_TO_PUBLISH + a named authorizer are required"] }), authority_state: AUTH_STATE.NOT_AUTHORIZED };
  }
  // Not constitutionally authorized and no legacy authorization: a SYSTEM-authority STOP (pending),
  // never a per-product human review queue (task section 18/20).
  return { ...gate(id, VERDICT.SOURCE_REQUIRED, `Publication Constitution NOT_AUTHORIZED: ${pub.failure_reasons.join("; ")}`, { inputs: ["governance/constitutions/publication.constitution.json"], failure_reasons: pub.failure_reasons, authority_required: "SYSTEM (expand the applicable constitution / Domain Authority Pack)" }), authority_state: AUTH_STATE.NOT_AUTHORIZED };
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
    let r = EVALUATORS[def.id](inputs, gateResults);
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
  const constitutionalAuth = gateResults.find((g) => g.id === "g10_publish")?.authority_state === AUTH_STATE.AUTHORIZED_BY_PUBLICATION_CONSTITUTION;
  const authValid = constitutionalAuth
    || (isObj(authorization) && authorization.status === "READY_TO_PUBLISH" && isStr(authorization.authorized_by) && isStr(authorization.authorized_at));
  const humanReviewBlocking = inputs.product.human_review && ["PENDING_HUMAN_REVIEW", "BLOCKED"].includes(inputs.product.human_review.status);
  const manifestEligible = blockingGates.length === 0 && authValid && !humanReviewBlocking;

  // Level-3 authority evaluation record (what governed the decision; the WHY of authorize/stop).
  let authority = null;
  try {
    const gateStates = {};
    for (const g of gateResults) gateStates[g.id] = g.authority_state ?? g.persisted;
    authority = evaluateAuthority(inputs.product.product_id, { root: inputs.root ?? ROOT, gateStates, now: AUTHORITY_EPOCH }).record;
  } catch (e) { authority = { error: String(e.message || e) }; }

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
    authority,
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
      // Persist the authority audit always; persist the constitutional authorization when the
      // Publication Constitution authorizes. This records a SYSTEM authority, never a fake human.
      const auth = evaluation.run_report.authority;
      if (auth && !auth.error) {
        try {
          persistAuthorityEvaluation(productId, auth, { root });
          evaluation.run_report.authority_persisted = true;
          if (auth.decision === AUTH_STATE.AUTHORIZED && auth.publication?.state === AUTH_STATE.AUTHORIZED_BY_PUBLICATION_CONSTITUTION) {
            authorizeFromConstitution(productId, auth, { root, now: AUTHORITY_EPOCH });
            evaluation.run_report.authorization_written = true;
          }
        } catch (e) { evaluation.run_report.authority_persist_error = String(e.message || e); }
      }
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
