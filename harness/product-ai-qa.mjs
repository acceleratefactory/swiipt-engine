#!/usr/bin/env node
// CANONICAL PRODUCT-LEVEL INDEPENDENT AI-QA EXECUTION PATH (gate g7)
//
// Closes ONE factory-level execution gap: `product.qa.ai_tests` had no canonical producer, so g7 could
// only ever be NOT_RUN/FAIL. This module is the producer. It does NOT own the gate: it writes the
// EXISTING `product.qa.ai_tests` contract and `harness/product-qa-gate-runner.mjs` recomputes g7.
//
//   EXISTING PRODUCT ACCEPTANCE CONTRACT (standards/qa-standard.md sections 3-5)
//   -> EXISTING QUALIFIED CRITIC (evidence in bench/results, resolved by qualification guard)
//   -> CANONICAL INVOCATION (lib/provider-client.mjs, structured output)
//   -> SCHEMA-VALID RESULT (schemas/product-ai-qa-result.schema.json)
//   -> product.qa.ai_tests
//   -> EXISTING g7 (harness/product-qa-gate-runner.mjs)
//   -> HONEST PASS / FAIL / HUMAN_REVIEW
//
// Deliberately NOT: another QA framework, another critic architecture, another acceptance-test system,
// another provider abstraction. It reuses the existing provider client, the existing qualification
// thresholds, the existing schemas and the existing gate runner.
//
// Authority separation is preserved: this reviewer evaluates PRODUCT acceptance only. Evidence (K),
// clinical/safety (L), human journey (O) and deterministic ecosystem (P) results are surfaced as
// `authority_flags` for their owning gates - never as AI PASS rows. A g7 PASS never resolves
// g4/g5/g9/g10.
//
// Usage:
//   node harness/product-ai-qa.mjs <PRODUCT_ID> [--live] [--write] [--replace] [--report <file>] [--root <dir>]
//
// Default is a DRY-RUN: guards + input assembly + (if --live) the provider call, but NOTHING is
// written. `--write` persists `product.qa.ai_tests` + the execution audit record. `--replace` is
// required to supersede a PRIOR INDEPENDENT review (never a silent overwrite).
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import Ajv from "ajv/dist/2020.js";
import { chatCompletion, redact, STATUS as PROVIDER_STATUS } from "../lib/provider-client.mjs";
import { CRITIC_ELIGIBILITY, criticEligibility, resolveProvider } from "../bench/text-provider-bench.mjs";

const MODULE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ------------------------------------------------------------------------------------------------
// Canonical contract constants
// ------------------------------------------------------------------------------------------------
export const AI_QA_VERSION = "1.0";
export const AI_QA_REVIEW_TYPE = "product_acceptance_ai_qa";
export const AI_QA_REVIEW_VERSION = "1.0";
export const AI_QA_PROMPT_VERSION = "product-ai-qa-review-v1";
export const AI_QA_JUDGE_WORKER = "product-ai-qa";
export const QUALIFICATION_ARTIFACT_DIR = join("bench", "results");
export const MAX_ARTIFACT_CHARS = 40000;

/** Execution outcome vocabulary (honest, never a fake success). */
export const AI_QA_STATUS = Object.freeze({
  DRY_RUN: "DRY_RUN",
  EXECUTED: "EXECUTED",
  QUALIFICATION_REQUIRED: "QUALIFICATION_REQUIRED",
  INDEPENDENCE_REQUIRED: "INDEPENDENCE_REQUIRED",
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  OUTPUT_INVALID: "OUTPUT_INVALID",
  CONTRACT_INVALID: "CONTRACT_INVALID",
  INPUT_INVALID: "INPUT_INVALID",
  NOT_RUN: "NOT_RUN",
});

/**
 * Ownership classification of the existing A-R acceptance tests (qa-standard section 3).
 * g7 executes ONLY the Product-QA responsibilities assigned to the independent AI critic.
 * The other four belong to other authorities and are NEVER resolved by this reviewer.
 */
export const TEST_OWNERSHIP = Object.freeze({
  A_situation_integrity: "AI_JUDGMENT",
  B_scope_integrity: "AI_JUDGMENT",
  C_transformation_integrity: "AI_JUDGMENT",
  D_mechanism_integrity: "AI_JUDGMENT",
  E_action_integrity: "AI_JUDGMENT",
  F_sequence_integrity: "AI_JUDGMENT",
  G_first_win_integrity: "AI_JUDGMENT",
  H_failure_integrity: "AI_JUDGMENT",
  I_rescue_integrity: "AI_JUDGMENT",
  J_tsm_integrity: "AI_JUDGMENT",
  K_evidence_integrity: "EVIDENCE_AUTHORITY",
  L_safety_integrity: "CLINICAL_AUTHORITY",
  M_format_integrity: "AI_JUDGMENT",
  N_emotional_integrity: "AI_JUDGMENT",
  O_journey_integrity: "HUMAN_AUTHORITY",
  P_ecosystem_integrity: "DETERMINISTIC",
  Q_copy_integrity: "AI_JUDGMENT",
  R_drift_integrity: "AI_JUDGMENT",
});

export const AI_OWNED_TESTS = Object.freeze(Object.keys(TEST_OWNERSHIP).filter((t) => TEST_OWNERSHIP[t] === "AI_JUDGMENT"));
export const NON_AI_OWNED_TESTS = Object.freeze(Object.keys(TEST_OWNERSHIP).filter((t) => TEST_OWNERSHIP[t] !== "AI_JUDGMENT"));
export const MANDATORY_AI_TEST = "R_drift_integrity";

/** Reviewer statuses allowed BY THE CRITIC (richer than the ledger enum). */
export const CRITIC_TEST_STATUSES = Object.freeze(["PASS", "FAIL", "REVISION_REQUIRED", "SOURCE_REQUIRED", "HUMAN_REVIEW"]);
export const SEVERITIES = Object.freeze(["none", "BLOCKER", "MAJOR", "MINOR", "OBSERVATION"]);

/** Projection: critic status -> the EXISTING product.qa.ai_tests status enum (schema-valid). */
export const LEDGER_STATUS_PROJECTION = Object.freeze({
  PASS: "PASS",
  FAIL: "FAIL",
  REVISION_REQUIRED: "REVISION_REQUIRED",
  SOURCE_REQUIRED: "REVISION_REQUIRED",
  HUMAN_REVIEW: "REVISION_REQUIRED",
});

export const TEST_DESCRIPTIONS = Object.freeze({
  A_situation_integrity: "The product still addresses the approved situation (person, trigger, problem, desired change).",
  B_scope_integrity: "The product stays inside its declared scope; it does not absorb a neighbouring problem.",
  C_transformation_integrity: "The promise matches the approved transformation; no stronger or weaker promise.",
  D_mechanism_integrity: "The mechanism explains how the change happens and is consistent with the transformation.",
  E_action_integrity: "The actions/tools are sufficient, usable and relevant to the mechanism.",
  F_sequence_integrity: "The implementation sequence is coherent and completable.",
  G_first_win_integrity: "A first win is achievable early and is real, not cosmetic.",
  H_failure_integrity: "Declared failure points are acknowledged.",
  I_rescue_integrity: "A rescue path exists for the declared failure points.",
  J_tsm_integrity: "The TSM measures the transformation (before baseline, success criteria, measurement method, check-in days).",
  M_format_integrity: "Deliverable formats suit the job each one serves.",
  N_emotional_integrity: "The tone respects the emotional reality of the situation without manipulation.",
  Q_copy_integrity: "Copy is honest, concrete and free of fabricated claims.",
  R_drift_integrity: "MANDATORY EVERY ROUND: remove the title, compare contents against the approved situation - did the product change its situation definition while keeping its name?",
});

// ------------------------------------------------------------------------------------------------
// Small utilities
// ------------------------------------------------------------------------------------------------
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const isStr = (v) => typeof v === "string" && v.trim().length > 0;

/** Stable stringify (sorted keys) so input hashes are reproducible. */
export function stableStringify(value) {
  const seen = new WeakSet();
  const walk = (v) => {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v)) return "[circular]";
    seen.add(v);
    if (Array.isArray(v)) return v.map(walk);
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = walk(v[k]);
    return out;
  };
  return JSON.stringify(walk(value));
}

export function sha256(text) {
  return createHash("sha256").update(String(text), "utf8").digest("hex");
}

/** Normalize a model id to its canonical identity segment (drops provider prefixes/labels). */
export function normalizeModelId(model, provider = null) {
  let s = String(model == null ? "" : model).trim().toLowerCase();
  const segs = s.split("/").filter(Boolean);
  if (segs.length > 1 && provider && segs[0] === String(provider).toLowerCase()) segs.shift();
  if (segs.length > 1) return segs[segs.length - 1];
  return segs[0] || s;
}

/** Redact every credential we can know about. Never log a key. */
export function redactAll(text, env = {}, extraSecrets = []) {
  let s = redact(text, env);
  for (const k of extraSecrets) {
    if (k && String(k).length >= 6) s = s.split(String(k)).join("[redacted]");
  }
  for (const k of Object.keys(env)) {
    if (/_(API_KEY|TOKEN|SECRET)$/i.test(k) && isStr(env[k]) && String(env[k]).length >= 8) {
      s = s.split(String(env[k])).join("[redacted]");
    }
  }
  s = s.replace(/(nvapi|sk|xai|gsk)-[A-Za-z0-9_\-]{8,}/g, "[redacted]");
  return s;
}

// ------------------------------------------------------------------------------------------------
// Configuration + canonical qualification evidence (the recurrence guard's source of truth)
// ------------------------------------------------------------------------------------------------
export function loadTextIntelligenceConfig(root = MODULE_ROOT) {
  const p = join(root, "config", "text-intelligence.v1.json");
  if (!existsSync(p)) return null;
  return readJson(p);
}

export function configuredCritic(root = MODULE_ROOT) {
  const cfg = loadTextIntelligenceConfig(root);
  const c = cfg?.primary_critic;
  if (!c) return { provider: null, model: null, status: null, known_limitation: null, present: false };
  return { provider: c.provider || null, model: c.model || null, status: c.status || null, known_limitation: c.known_limitation || null, present: true };
}

export function generationIncumbent(root = MODULE_ROOT) {
  const cfg = loadTextIntelligenceConfig(root);
  const g = cfg?.generator;
  return { provider: g?.provider || null, model: g?.model || null, status: g?.status || null };
}

/**
 * Scan the repository's canonical qualification artifacts and return every ELIGIBLE critic identity.
 * Eligibility uses the SAME frozen thresholds the benchmark used (CRITIC_ELIGIBILITY), applied to the
 * artifact's own recorded metrics. Nothing is inferred, nothing is averaged, no artifact is rewritten.
 */
export function canonicalQualification(root = MODULE_ROOT, { thresholds = CRITIC_ELIGIBILITY } = {}) {
  const dir = join(root, QUALIFICATION_ARTIFACT_DIR);
  const eligible = [];
  const considered = [];
  if (!existsSync(dir)) return { ok: false, candidates: [], considered, reason: "no qualification artifact directory" };
  for (const f of readdirSync(dir).filter((x) => x.endsWith("-results.json")).sort()) {
    let doc;
    try { doc = readJson(join(dir, f)); } catch { continue; }
    const recommendedGenerator = doc?.comparison?.recommended_generator || null;
    for (const c of doc?.critics || []) {
      if (!c || !isStr(c.provider) || !isStr(c.model)) continue;
      const metrics = {
        provider_reliability: num(c.provider_reliability),
        schema_reliability: num(c.schema_reliability),
        precision: num(c.precision),
        recall: num(c.recall),
        f1: num(c.f1),
        severity_accuracy: num(c.severity_accuracy),
      };
      const probe = { ...metrics, model_identity: c.model_identity ?? null, model: c.model };
      const verdict = criticEligibility(probe, { recommendedGenerator });
      const record = {
        artifact: f, provider: c.provider, model: c.requested_model || c.model,
        artifact_model: c.model,
        requested_model: c.requested_model ?? null, returned_model: c.returned_model ?? null,
        model_identity: c.model_identity ?? null, endpoint_host: c.endpoint_host ?? null,
        metrics, thresholds: { ...thresholds },
        false_positives: Number.isFinite(c.false_positives) ? c.false_positives : null,
        false_negatives: Number.isFinite(c.false_negatives) ? c.false_negatives : null,
        task_hash: doc?.task_hash ?? null,
        eligible: verdict.eligible, reasons: verdict.reasons,
      };
      considered.push(record);
      if (verdict.eligible && c.model_identity === "OK") eligible.push(record);
    }
  }
  const identities = new Map();
  for (const r of eligible) {
    const key = `${r.provider}::${normalizeModelId(r.model, r.provider)}`;
    if (!identities.has(key)) identities.set(key, { provider: r.provider, model: r.model, artifacts: [], record: r });
    identities.get(key).artifacts.push(r.artifact);
  }
  const candidates = [...identities.values()];
  if (!candidates.length) {
    return { ok: false, candidates: [], considered, reason: considered.length ? "no critic met the canonical qualification thresholds" : "no critic record found in qualification artifacts" };
  }
  const top = candidates.length === 1 ? candidates[0] : candidates.sort((a, b) => (b.record.metrics.f1 ?? 0) - (a.record.metrics.f1 ?? 0))[0];
  const fn = top.record.false_negatives;
  return {
    ok: true,
    ambiguous: candidates.length > 1,
    candidate_count: candidates.length,
    provider: top.provider,
    model: top.model,
    artifacts: top.artifacts,
    task_hash: top.record.task_hash,
    metrics: top.record.metrics,
    thresholds: { ...thresholds },
    endpoint_host: top.record.endpoint_host,
    known_limitation: fn && fn > 0
      ? `missed ${fn} qualifying case(s) during qualification (false negatives)`
      : (Number.isFinite(fn) ? null : "false-negative count not recorded in the qualification artifact"),
    candidates: candidates.map((c) => ({ provider: c.provider, model: c.model, artifacts: c.artifacts, f1: c.record.metrics.f1 ?? null })),
    considered,
  };
}
const num = (v) => (typeof v === "number" && !Number.isNaN(v) ? v : null);

/**
 * QUALIFICATION GUARD (task section 18). Live execution is refused unless the CONFIGURED critic is
 * the model the repository's own qualification evidence qualifies.
 */
export function qualificationGuard(root = MODULE_ROOT, opts = {}) {
  const cfg = configuredCritic(root);
  const qual = opts.qualification || canonicalQualification(root);
  if (!cfg.present) return { ok: false, status: AI_QA_STATUS.QUALIFICATION_REQUIRED, reason: "no primary_critic configured in config/text-intelligence.v1.json", configured: cfg, qualification: qual };
  if (!qual.ok) return { ok: false, status: AI_QA_STATUS.QUALIFICATION_REQUIRED, reason: `critic qualification is not established in-repo: ${qual.reason}`, configured: cfg, qualification: qual };
  if (qual.ambiguous) return { ok: false, status: AI_QA_STATUS.QUALIFICATION_REQUIRED, reason: `critic qualification is AMBIGUOUS: ${qual.candidate_count} equally-qualified critic identities in canonical artifacts (${qual.candidates.map((c) => c.model).join(", ")})`, configured: cfg, qualification: qual };
  if (String(cfg.status) !== "QUALIFIED_PRIMARY_CRITIC") return { ok: false, status: AI_QA_STATUS.QUALIFICATION_REQUIRED, reason: `configured critic status is '${cfg.status}', not QUALIFIED_PRIMARY_CRITIC`, configured: cfg, qualification: qual };
  const cfgId = normalizeModelId(cfg.model, cfg.provider);
  const qualId = normalizeModelId(qual.model, qual.provider);
  if (normalizeModelId(cfg.provider) !== normalizeModelId(qual.provider) || cfgId !== qualId) {
    return { ok: false, status: AI_QA_STATUS.QUALIFICATION_REQUIRED, reason: `configured critic (provider '${cfg.provider}', model '${cfg.model}') does not match the qualified critic evidenced by ${qual.artifacts.join(", ")} (provider '${qual.provider}', model '${qual.model}')`, configured: cfg, qualification: qual };
  }
  return { ok: true, status: "QUALIFIED", configured: cfg, qualification: qual };
}

/**
 * INDEPENDENCE GUARD (task section 19). The critic must not be the generator that produced the work.
 * Model identity - not provider naming - decides.
 */
export function independenceGuard(critic, generator) {
  if (!critic?.model || !generator?.model) return { ok: false, reasons: ["critic or generator identity unknown"] };
  const c = normalizeModelId(critic.model, critic.provider);
  const g = normalizeModelId(generator.model, generator.provider);
  if (c && c === g) return { ok: false, reasons: [`critic and generator are the same model ('${critic.model}') - self-review is prohibited`] };
  return { ok: true, reasons: [] };
}

// ------------------------------------------------------------------------------------------------
// Input assembly (task section 13 + 14) - minimum authoritative Product context only
// ------------------------------------------------------------------------------------------------
function loadArtifact(p, budget = MAX_ARTIFACT_CHARS) {
  if (!existsSync(p)) return { exists: false, ref: null, content: null, truncated: false, bytes: 0 };
  const raw = readFileSync(p, "utf8");
  const truncated = raw.length > budget;
  return { exists: true, ref: p, content: truncated ? `${raw.slice(0, budget)}\n[TRUNCATED ${raw.length - budget} chars]` : raw, truncated, bytes: raw.length };
}

/**
 * Assemble the minimum authoritative Product context for acceptance QA. Deliberately EXCLUDES
 * Customer Truth, Market Truth, marketing angles/campaign and MAE assets: Product QA is not Marketing QA.
 */
export function assembleProductAiQaInput(productId, { root = MODULE_ROOT } = {}) {
  const pdir = join(root, "data", "products", productId);
  const productPath = join(pdir, "product.json");
  if (!existsSync(productPath)) return { ok: false, status: AI_QA_STATUS.INPUT_INVALID, errors: [`product not found: ${productPath}`] };
  const product = readJson(productPath);
  const trId = product?.identity?.transformation_id || null;
  const trPath = trId ? join(root, "data", "transformations", `${trId}.json`) : null;
  const transformation = trPath && existsSync(trPath) ? readJson(trPath) : null;

  const contentKeys = ["landing_page", "product_page", "faq"];
  const content = {};
  const truncations = [];
  for (const k of contentKeys) {
    // canonical shape is a plain relative path string; { ref } is also accepted
    const entry = product?.content?.[k];
    const ref = isStr(entry) ? entry : (isStr(entry?.ref) ? entry.ref : null);
    if (!isStr(ref)) { content[k] = { exists: false, ref: null }; continue; }
    const abs = join(pdir, ref);
    const art = loadArtifact(abs);
    content[k] = { exists: art.exists, ref, bytes: art.bytes, truncated: art.truncated };
    if (art.truncated) truncations.push(`${k} truncated to ${MAX_ARTIFACT_CHARS} chars (source ${art.bytes})`);
    content[k].body = art.content;
  }
  // reviews are customer/social proof, governed by the reviews gate - NOT part of Product acceptance
  // (standards/qa-standard.md section 3 + task section 13). Recorded as metadata only.
  const reviewEntry = product?.content?.reviews;
  const reviewRef = isStr(reviewEntry) ? reviewEntry : (isStr(reviewEntry?.ref) ? reviewEntry.ref : null);
  content.reviews = reviewRef
    ? { exists: existsSync(join(pdir, reviewRef)), ref: reviewRef, bytes: existsSync(join(pdir, reviewRef)) ? readFileSync(join(pdir, reviewRef), "utf8").length : 0, included: false, note: "excluded from Product acceptance input (governed by the reviews gate)" }
    : { exists: false, ref: null };
  const genManifest = loadArtifact(join(pdir, "copy", "generation-manifest.json"));

  const input = {
    reviewer_contract: { review_type: AI_QA_REVIEW_TYPE, review_version: AI_QA_REVIEW_VERSION, prompt_version: AI_QA_PROMPT_VERSION },
    product_id: product.product_id,
    product_version: product.version ?? null,
    commercial_role: product.commercial_role ?? null,
    identity: product.identity ?? null,
    customer: product.customer ?? null,
    transformation: product.transformation ?? null,
    tsm: product.tsm ?? null,
    asset_map: product.asset_map ?? null,
    design: product.design ?? null,
    evidence: product.evidence ?? null,
    safety: product.safety ?? null,
    deterministic_qa: product.qa?.deterministic_tests ?? [],
    content_manifest: content,
    writing_control_handoff: genManifest.exists ? { ref: genManifest.ref, body: genManifest.content, truncated: genManifest.truncated } : null,
    transformation_record: transformation
      ? {
        transformation_id: transformation.transformation_id ?? trId,
        status: transformation.status ?? null,
        situation: transformation.situation ?? null,
        before_state: transformation.before_state ?? null,
        after_state: transformation.after_state ?? null,
        mechanism: transformation.mechanism ?? null,
        transformation_path: transformation.transformation_path ?? null,
        first_win: transformation.first_win ?? null,
        tsm: transformation.tsm ?? null,
        failure_point_map: transformation.failure_point_map ?? null,
        maintenance: transformation.maintenance ?? null,
        next_transformation: transformation.next_transformation ?? null,
        evidence: transformation.evidence ?? null,
        safety: transformation.safety ?? null,
        research_disposition: transformation.research_disposition ?? null,
        applicability: transformation.applicability ?? null,
      }
      : null,
  };

  const errors = [];
  if (!isStr(product.product_id)) errors.push("product.product_id missing");
  if (!isStr(trId)) errors.push("product.identity.transformation_id missing");
  if (!transformation) errors.push(`transformation record not found for '${trId ?? "(none)"}'`);
  const promiseAvailable = isStr(product?.transformation?.after_state?.summary)
    || isStr(transformation?.situation?.desired_transformation)
    || isStr(transformation?.after_state?.summary);
  if (!promiseAvailable) errors.push("no approved transformation statement available (product.transformation.after_state.summary / transformation.situation.desired_transformation)");
  if (!Array.isArray(product?.safety?.red_flags)) errors.push("product.safety.red_flags missing (safety boundaries are a required input)");
  if (!(product.qa?.deterministic_tests || []).length) errors.push("product.qa.deterministic_tests is empty (deterministic QA must run before independent AI QA)");

  const input_hash = sha256(stableStringify(input));
  return {
    ok: errors.length === 0,
    status: errors.length ? AI_QA_STATUS.INPUT_INVALID : "OK",
    errors,
    truncations,
    product, transformation, input, input_hash,
    product_path: productPath, transformation_path: trPath,
  };
}

// ------------------------------------------------------------------------------------------------
// Prompt + provider-facing schema
// ------------------------------------------------------------------------------------------------
export function buildCriticMessages(input) {
  const tests = AI_OWNED_TESTS.map((t) => `- ${t}: ${TEST_DESCRIPTIONS[t]}`).join("\n");
  const nonOwned = NON_AI_OWNED_TESTS.map((t) => `- ${t} (${TEST_OWNERSHIP[t]})`).join("\n");
  const system = [
    "You are the Swiipt INDEPENDENT Product acceptance reviewer (publishing gate g7). You did not build this product.",
    "",
    "TRUTH BOUNDARY:",
    "- Evaluate ONLY the supplied canonical material. Do not invent facts, evidence, customer claims, statistics, citations or medical guidance.",
    "- If required information is absent, say so in missing_information or return SOURCE_REQUIRED for that test. Never fill a gap yourself.",
    "- Distinguish a DEFECT (the material contradicts the test) from UNCERTAINTY (you cannot tell from the supplied material).",
    "- You do NOT approve clinical or medical correctness, you do NOT validate evidence, and you do NOT authorise publication.",
    "",
    "Return one result for EACH of these 14 AI-owned Product acceptance tests:",
    tests,
    "",
    `Test ${MANDATORY_AI_TEST} is MANDATORY on every review round: remove the title, compare the contents against the approved situation, and decide whether the product changed its situation definition while keeping its name.`,
    "",
    "Per-test status vocabulary:",
    "- PASS: the supplied material satisfies the test.",
    "- FAIL: the material contradicts the test.",
    "- REVISION_REQUIRED: the material is insufficient or wrong in a way that must be corrected before publish.",
    "- SOURCE_REQUIRED: a required input/evidence artefact is absent from the supplied material.",
    "- HUMAN_REVIEW: a genuine human judgement is required and cannot be settled from the supplied material.",
    "",
    "Severity model, verbatim: BLOCKER | MAJOR | MINOR | OBSERVATION | none.",
    "BLOCKER means: unsafe clinical claim, missing transformation/TSM, broken purchase/access, incorrect boundary, missing required asset, evidence failure, or major scope drift.",
    "",
    "These four tests are NOT yours to decide. Do not return a status for them. If you observe something concerning, add an authority_flag entry so the owning gate receives it:",
    nonOwned,
    "Authority flag vocabulary: EVIDENCE_AUTHORITY | CLINICAL_AUTHORITY | HUMAN_AUTHORITY | DETERMINISTIC.",
    'Each authority_flags item has EXACTLY these four keys: "authority", "test", "severity", "finding". Do not add other keys.',
    "",
    "overall_status is PASS only when every test you return is PASS.",
    "Reply with JSON only, matching this EXACT shape (all 14 tests present; empty arrays where there is nothing to report):",
    '{"review_type":"product_acceptance_ai_qa","review_version":"1.0","overall_status":"PASS|FAIL|REVISION_REQUIRED","tests":[{"test":"<one of the 14 ids above>","status":"PASS|FAIL|REVISION_REQUIRED|SOURCE_REQUIRED|HUMAN_REVIEW","severity":"none|BLOCKER|MAJOR|MINOR|OBSERVATION","finding":"what you observed","evidence_location":"where it is anchored","recommended_action":"required correction, or empty string when PASS"}],"authority_flags":[{"authority":"EVIDENCE_AUTHORITY|CLINICAL_AUTHORITY|HUMAN_AUTHORITY|DETERMINISTIC","test":"K_evidence_integrity|L_safety_integrity|O_journey_integrity|P_ecosystem_integrity","severity":"none|BLOCKER|MAJOR|MINOR|OBSERVATION","finding":"what the owning authority must look at"}],"blocking_issues":[],"non_blocking_issues":[],"scope_drift":false,"safety_issues":[],"required_changes":[],"missing_information":[]}',
  ].join("\n");
  const user = [
    "Evaluate this product against the acceptance contract.",
    "The following is the complete authoritative material available to you:",
    JSON.stringify(input, null, 2),
  ].join("\n\n");
  return { system, user };
}

const STRIP_KEYS = new Set(["minLength", "maxLength", "description", "format", "pattern", "$id", "$schema", "title"]);
/** Derive a provider-safe (strict-mode friendly) subset of a JSON schema. Local validation still uses the full schema. */
export function providerSchema(full) {
  const walk = (n) => {
    if (Array.isArray(n)) return n.map(walk);
    if (!n || typeof n !== "object") return n;
    const out = {};
    for (const k of Object.keys(n)) {
      if (STRIP_KEYS.has(k)) continue;
      out[k] = walk(n[k]);
    }
    if (out.type === "object" && out.properties) {
      out.additionalProperties = false;
      out.required = Object.keys(out.properties);
    }
    return out;
  };
  return walk(full);
}

// ------------------------------------------------------------------------------------------------
// Result validation + projection into the EXISTING product.qa.ai_tests contract
// ------------------------------------------------------------------------------------------------
function buildAjv(root) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  ajv.addFormat("date-time", /^\d{4}-\d{2}-\d{2}T/);
  ajv.addFormat("date", /^\d{4}-\d{2}-\d{2}$/);
  for (const f of readdirSync(join(root, "schemas")).filter((x) => x.endsWith(".schema.json"))) {
    const sch = readJson(join(root, "schemas", f));
    sch.$id = `https://swiipt.com/factory/schemas/${f}`;
    try { ajv.addSchema(sch); } catch { /* already added */ }
  }
  return ajv;
}

export function resultSchema(root = MODULE_ROOT) {
  return readJson(join(root, "schemas", "product-ai-qa-result.schema.json"));
}

/** Strict contract checks the JSON schema cannot express. */
export function validateCriticResultShape(json) {
  const errors = [];
  if (!json || typeof json !== "object") return { ok: false, errors: ["result is not an object"] };
  const seen = new Set();
  for (const t of json.tests || []) {
    if (seen.has(t.test)) errors.push(`duplicate test result: ${t.test}`);
    seen.add(t.test);
    if (TEST_OWNERSHIP[t.test] !== "AI_JUDGMENT") errors.push(`test '${t.test}' is not AI-owned (${TEST_OWNERSHIP[t.test] || "unknown"}) - the reviewer must not decide it`);
    if (t.status !== "PASS" && !isStr(t.recommended_action)) errors.push(`test '${t.test}' is '${t.status}' but has no recommended_action`);
    if (t.status === "PASS" && t.severity !== "none" && t.severity !== "OBSERVATION") errors.push(`test '${t.test}' is PASS with severity ${t.severity}`);
  }
  for (const t of AI_OWNED_TESTS) if (!seen.has(t)) errors.push(`missing AI-owned test result: ${t}`);
  for (const t of json.tests || []) if (!AI_OWNED_TESTS.includes(t.test)) errors.push(`unknown or non-AI test in tests[]: ${t.test}`);
  for (const f of json.authority_flags || []) {
    if (TEST_OWNERSHIP[f.test] === "AI_JUDGMENT") errors.push(`authority_flag for AI-owned test '${f.test}' - use tests[] instead`);
    if (TEST_OWNERSHIP[f.test] && TEST_OWNERSHIP[f.test] !== f.authority) errors.push(`authority_flag '${f.test}' declares '${f.authority}' but ownership is '${TEST_OWNERSHIP[f.test]}'`);
  }
  const nonPass = (json.tests || []).filter((t) => t.status !== "PASS");
  if (nonPass.length && json.overall_status === "PASS") errors.push("overall_status PASS with non-PASS tests");
  if (!nonPass.length && json.overall_status !== "PASS") errors.push(`overall_status ${json.overall_status} with every test PASS`);
  return { ok: errors.length === 0, errors };
}

/** Map the critic's AI-owned rows into the EXISTING ledger contract (schema-valid). */
export function projectAiTests(criticTests, { auditRef = null } = {}) {
  return criticTests.map((t) => {
    const status = LEDGER_STATUS_PROJECTION[t.status] || "REVISION_REQUIRED";
    const reason = t.status === "PASS" || t.status === "FAIL" || t.status === "REVISION_REQUIRED"
      ? t.finding
      : `[${t.status}] ${t.finding}`;
    const evidence = [];
    if (isStr(t.evidence_location)) evidence.push(t.evidence_location);
    if (auditRef) evidence.push(auditRef);
    const row = { test: t.test, status, severity: t.severity, reason };
    if (evidence.length) row.evidence = evidence;
    return row;
  });
}

/** Authority escalations: a BLOCKER/MAJOR flag on a non-AI-owned test must stop a g7 PASS. */
export function authorityEscalations(flags = []) {
  return flags
    .filter((f) => f.severity === "BLOCKER" || f.severity === "MAJOR")
    .map((f) => ({ authority: f.authority, test: f.test, severity: f.severity, finding: f.finding }));
}

// ------------------------------------------------------------------------------------------------
// Write plan (task sections 22-23) - never a silent overwrite
// ------------------------------------------------------------------------------------------------
export function auditRecordPath(root, productId) {
  return join(root, "data", "products", productId, "qa", "ai-qa-execution.json");
}

export function planAiQaWrite({ product, rows, priorExecution, replace = false, auditRef = null }) {
  const conflicts = [];
  if (priorExecution && !replace) {
    conflicts.push(`a prior INDEPENDENT AI-QA review exists (${priorExecution.executed_at || "unknown time"}) - pass --replace to supersede it (governance history is preserved in the audit record)`);
  }
  return {
    ok: conflicts.length === 0,
    conflicts,
    changes: [{ path: "qa.ai_tests", from: product?.qa?.ai_tests ?? [], to: rows }],
    audit_ref: auditRef,
  };
}

export function loadPriorExecution(root, productId) {
  const p = auditRecordPath(root, productId);
  if (!existsSync(p)) return null;
  try {
    const doc = readJson(p);
    return doc?.latest || null;
  } catch { return null; }
}

// ------------------------------------------------------------------------------------------------
// Orchestrator
// ------------------------------------------------------------------------------------------------
/**
 * Run the canonical Product-level independent AI-QA review.
 * Dry-run by default. Deterministic fixtures inject `fetchImpl`/`env` - no live spend in tests.
 */
export async function runProductAiQa(productId, opts = {}) {
  const root = opts.root ? resolve(opts.root) : MODULE_ROOT;
  const env = opts.env || process.env;
  const executed_at = opts.now || new Date().toISOString();
  const write = !!opts.write;
  const replace = !!opts.replace;
  const live = !!opts.live;

  const base = {
    ai_qa_version: AI_QA_VERSION,
    prompt_version: AI_QA_PROMPT_VERSION,
    product_id: productId,
    transformation_id: null,
    review_type: AI_QA_REVIEW_TYPE,
    review_version: AI_QA_REVIEW_VERSION,
    provider: null, model: null,
    qualification: null, independence: null,
    input_hash: null, task_hash: null, output_hash: null,
    schema_valid: null, retry_count: 0,
    output_rejected: null,
    provider_status: null, endpoint_host: null, cost: null,
    executed_at, status: AI_QA_STATUS.NOT_RUN, reason: null,
    ai_tests: null, authority_flags: [], escalations: [], escalations_recorded: false,
    written: false, results: null,
  };

  // 1. Qualification guard (before anything else - never let an unqualified critic near a live call)
  const guard = qualificationGuard(root, opts);
  base.qualification = {
    ok: guard.ok,
    status: guard.status,
    reason: guard.reason || null,
    configured: guard.configured,
    qualified: guard.qualification?.ok ? {
      provider: guard.qualification.provider,
      model: guard.qualification.model,
      artifacts: guard.qualification.artifacts,
      task_hash: guard.qualification.task_hash,
      metrics: guard.qualification.metrics,
      thresholds: guard.qualification.thresholds,
      ambiguous: !!guard.qualification.ambiguous,
      known_limitation: guard.qualification.known_limitation,
    } : null,
  };
  if (!guard.ok) {
    return { ...base, status: guard.status, reason: guard.reason };
  }
  base.provider = guard.qualification.provider;
  base.model = guard.qualification.model;

  // 2. Independence guard
  const gen = generationIncumbent(root);
  const indep = independenceGuard({ provider: base.provider, model: base.model }, gen);
  base.independence = { ok: indep.ok, reasons: indep.reasons, generator: gen };
  if (!indep.ok) return { ...base, status: AI_QA_STATUS.INDEPENDENCE_REQUIRED, reason: indep.reasons.join("; ") };

  // 3. Input assembly
  const asm = assembleProductAiQaInput(productId, { root });
  if (!asm.ok) return { ...base, status: AI_QA_STATUS.INPUT_INVALID, reason: asm.errors.join("; "), input_hash: asm.input_hash, transformation_id: asm.product?.identity?.transformation_id ?? null };
  base.transformation_id = asm.product?.identity?.transformation_id ?? null;
  base.input_hash = asm.input_hash;

  const { system, user } = buildCriticMessages(asm.input);
  base.task_hash = sha256(stableStringify({ system, user, schema: AI_QA_REVIEW_VERSION, prompt_version: AI_QA_PROMPT_VERSION }));

  // 4. Provider path
  const profiles = opts.profiles || loadProviderProfiles(root);
  const prov = resolveProvider(profiles, base.provider, env);
  if (!prov.ok) {
    return { ...base, status: AI_QA_STATUS.PROVIDER_UNAVAILABLE, reason: `qualified provider '${base.provider}' is not configured: ${prov.error}`, provider_status: PROVIDER_STATUS.PROVIDER_NOT_CONFIGURED };
  }
  if (!live && !opts.fetchImpl) {
    return {
      ...base,
      status: AI_QA_STATUS.DRY_RUN,
      reason: "dry-run: guards passed and input assembled; pass --live to call the qualified critic",
      provider_status: null,
      prompt: { system, user },
      write_plan: write ? planAiQaWrite({ product: asm.product, rows: [], priorExecution: loadPriorExecution(root, productId), replace, auditRef: auditRecordPath(root, productId) }) : null,
    };
  }

  // 5. Call the qualified critic (structured output)
  const full = resultSchema(root);
  // The proven structured-output mode for this provider class is json_object (see
  // bench/text-provider-bench.mjs::runCritic). Strict json_schema is opt-in (`structuredMode`) because
  // the endpoint does not reliably honour it. Local ajv validation stays authoritative either way.
  const structuredMode = opts.structuredMode || "json_object";
  const res = await chatCompletion({
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    model: base.model,
    worker: AI_QA_JUDGE_WORKER,
    jsonMode: structuredMode === "json_object",
    jsonSchema: structuredMode === "json_schema" ? providerSchema(full) : null,
    schemaName: "product_ai_qa_result",
    strict: true,
    baseUrl: prov.baseUrl,
    apiKey: prov.apiKey,
    env,
    fetchImpl: opts.fetchImpl || null,
    timeoutMs: opts.timeoutMs || env.OPENAI_TIMEOUT_MS || 120000,
  });
  base.provider_status = res.status;
  base.endpoint_host = res.endpoint_host || null;
  base.retry_count = res.retry_count ?? 0;
  if (res.usage) base.cost = { usage: res.usage };

  if (!res.ok) {
    const status = res.status === PROVIDER_STATUS.PROVIDER_NOT_CONFIGURED ? AI_QA_STATUS.PROVIDER_UNAVAILABLE : AI_QA_STATUS.NOT_RUN;
    return { ...base, status, reason: `provider call did not succeed (${res.status}): ${redactAll(res.error || "", env, [prov.apiKey])}` };
  }

  // 6. Schema + contract validation
  const ajv = buildAjv(root);
  const schemaOk = ajv.validate("https://swiipt.com/factory/schemas/product-ai-qa-result.schema.json", res.json);
  const schemaErrors = schemaOk ? [] : ajv.errors.map((e) => `${e.instancePath || "(root)"} ${e.message}`);
  const shape = validateCriticResultShape(res.json);
  base.schema_valid = schemaOk && shape.ok;
  base.output_hash = sha256(stableStringify(res.json));
  // Forensic: a rejected output is preserved (bounded + redacted) so a contract mismatch is auditable
  // without spending another provider call. Nothing here is ever treated as a result.
  base.output_rejected = base.schema_valid ? null : {
    errors: [...schemaErrors, ...shape.errors].slice(0, 20),
    raw: redactAll(JSON.stringify(res.json).slice(0, 20000), env, [prov.apiKey]),
  };
  if (!base.schema_valid) {
    const status = schemaOk ? AI_QA_STATUS.CONTRACT_INVALID : AI_QA_STATUS.OUTPUT_INVALID;
    return { ...base, status, reason: `critic output rejected: ${[...schemaErrors, ...shape.errors].slice(0, 6).join("; ")}` };
  }

  // 7. Project into the EXISTING ledger + surface authority escalations
  const auditRef = auditRecordPath(root, productId);
  const rows = projectAiTests(res.json.tests, { auditRef: `ai-qa-execution.json#${base.task_hash.slice(0, 12)}` });
  const escalations = authorityEscalations(res.json.authority_flags);
  base.ai_tests = rows;
  base.authority_flags = res.json.authority_flags || [];
  base.escalations = escalations;
  base.results = {
    overall_status: res.json.overall_status,
    tests: res.json.tests.map((t) => ({ test: t.test, status: t.status, severity: t.severity })),
    blocking_issues: res.json.blocking_issues || [],
    non_blocking_issues: res.json.non_blocking_issues || [],
    scope_drift: !!res.json.scope_drift,
    safety_issues: res.json.safety_issues || [],
    required_changes: res.json.required_changes || [],
    missing_information: res.json.missing_information || [],
  };
  base.status = AI_QA_STATUS.EXECUTED;
  base.escalations_recorded = escalations.length > 0;
  base.reason = res.json.overall_status === "PASS" ? "canonical independent review completed (all AI-owned tests PASS)" : `canonical independent review completed: ${res.json.overall_status}`;

  // 8. Write-back (refuses only on a prior un-replaced review)
  //
  // Authority escalations (K/L/O/P) do NOT block the write of the AI-owned ledger. They are advisory to
  // authorities whose gates enforce themselves: g4/g5/g9 do not read qa.ai_tests, so a g7 PASS can never
  // resolve them, and publication stays blocked by the gate conjunction. Blocking here would make an
  // all-PASS review unable to satisfy g7 at all, which contradicts the gate's own contract
  // (standards/qa-standard.md section 8-9; task sections 8 and 30-31).
  const prior = loadPriorExecution(root, productId);
  const plan = planAiQaWrite({ product: asm.product, rows, priorExecution: prior, replace, auditRef });
  if (write) {
    if (!plan.ok) {
      base.written = false;
      base.write_plan = plan;
      base.status = AI_QA_STATUS.EXECUTED;
      base.reason = `${base.reason}; write refused: ${plan.conflicts.join("; ")}`;
      return base;
    }
    writeAiQaResult({ root, productId, product: asm.product, rows, execution: base, prior });
    base.written = true;
    base.write_plan = plan;
  } else {
    base.write_plan = plan;
  }
  return base;
}

const loadProviderProfiles = (root) => {
  // candidates.json is operator config (git-ignored); candidates.example.json is the tracked template
  // that carries the same provider -> env-var-NAME mapping, so a clean checkout can still resolve a
  // provider profile without any secret being present in the repository.
  for (const f of ["candidates.json", "candidates.example.json"]) {
    const p = join(root, "bench", f);
    if (!existsSync(p)) continue;
    try {
      const profiles = readJson(p)?.providers || {};
      if (Object.keys(profiles).length) return profiles;
    } catch { /* try next */ }
  }
  return {};
};

/**
 * Materialise an ALREADY-EXECUTED review from its saved report. No provider call, no new judgement:
 * it re-checks that the report's input_hash still matches the current canonical input (so a stale
 * result can never be written against changed content), then writes the ledger + audit record.
 * This is the auditable, zero-cost write path for a review that has already run.
 */
export function writeExecutionFromReport(reportPath, { root = MODULE_ROOT, replace = false } = {}) {
  const execution = readJson(resolve(reportPath));
  const productId = execution?.product_id;
  if (!productId) return { ok: false, status: AI_QA_STATUS.INPUT_INVALID, reason: "report has no product_id" };
  if (execution.status !== AI_QA_STATUS.EXECUTED) return { ok: false, status: execution.status || AI_QA_STATUS.NOT_RUN, reason: `report is not an EXECUTED review (status ${execution.status}); nothing written` };

  const revisit = { ...execution };
  const asm = assembleProductAiQaInput(productId, { root });
  if (!asm.ok) return { ok: false, status: AI_QA_STATUS.INPUT_INVALID, reason: `current input is invalid: ${asm.errors.join("; ")}` };
  if (asm.input_hash !== execution.input_hash) {
    return { ok: false, status: AI_QA_STATUS.INPUT_INVALID, reason: `report input_hash ${execution.input_hash} does not match the current canonical input ${asm.input_hash} - re-run the review instead of materialising a stale result` };
  }
  const guard = qualificationGuard(root);
  if (!guard.ok) return { ok: false, status: guard.status, reason: guard.reason };

  const prior = loadPriorExecution(root, productId);
  const rows = execution.ai_tests || [];
  const plan = planAiQaWrite({ product: asm.product, rows, priorExecution: prior, replace, auditRef: auditRecordPath(root, productId) });
  if (!plan.ok) return { ...revisit, ok: false, status: AI_QA_STATUS.EXECUTED, written: false, write_plan: plan, reason: `write refused: ${plan.conflicts.join("; ")}` };
  writeAiQaResult({ root, productId, product: asm.product, rows, execution: revisit, prior });
  return { ...revisit, ok: true, written: true, write_plan: plan };
}

/** Persist the ledger + the execution audit record. Governance history is never lost. */
export function writeAiQaResult({ root, productId, product, rows, execution, prior }) {
  const productPath = join(root, "data", "products", productId, "product.json");
  const next = JSON.parse(JSON.stringify(product));
  const superseded = next.qa?.ai_tests ?? [];
  next.qa.ai_tests = rows;
  writeFileSync(productPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");

  const dir = join(root, "data", "products", productId, "qa");
  mkdirSync(dir, { recursive: true });
  const apath = auditRecordPath(root, productId);
  let doc = { record_type: "AI_QA_EXECUTION", product_id: productId, latest: null, history: [] };
  if (existsSync(apath)) { try { doc = readJson(apath); } catch { /* rebuild */ } }
  const record = {
    record_type: "AI_QA_EXECUTION",
    product_id: productId,
    transformation_id: execution.transformation_id,
    gate: "g7_product_qa",
    status: execution.status,
    reason: execution.reason,
    executed_at: execution.executed_at,
    review_type: execution.review_type,
    review_version: execution.review_version,
    prompt_version: execution.prompt_version,
    provider: execution.provider,
    model: execution.model,
    endpoint_host: execution.endpoint_host,
    qualification: execution.qualification,
    independence: execution.independence,
    task_hash: execution.task_hash,
    input_hash: execution.input_hash,
    output_hash: execution.output_hash,
    schema_valid: execution.schema_valid,
    retry_count: execution.retry_count,
    provider_status: execution.provider_status,
    cost: execution.cost,
    authority_flags: execution.authority_flags,
    escalations: execution.escalations,
    results: execution.results,
    ledger_written: rows.length,
    superseded_by: null,
  };
  if (prior) record.supersedes = { executed_at: prior.executed_at, task_hash: prior.task_hash, model: prior.model };
  doc.latest = record;
  doc.history = Array.isArray(doc.history) ? doc.history.slice(-19) : [];
  if (prior) doc.history.push({ executed_at: prior.executed_at, task_hash: prior.task_hash, model: prior.model, overall_status: prior?.results?.overall_status ?? null, ledger: prior.ai_tests ?? null, superseded_at: execution.executed_at });
  if (!prior && superseded.length) doc.history.push({ executed_at: null, task_hash: null, model: null, overall_status: null, ledger: superseded, superseded_at: execution.executed_at, note: "ledger replaced by the first canonical independent review (previous rows were not produced by this harness)" });
  writeFileSync(apath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  return { product_path: productPath, audit_path: apath };
}

// ------------------------------------------------------------------------------------------------
// CLI
// ------------------------------------------------------------------------------------------------
const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const get = (flag) => { const i = args.indexOf(flag); return i > -1 ? args[i + 1] : null; };
  const pid = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--report" && args[args.indexOf(a) - 1] !== "--root" && args[args.indexOf(a) - 1] !== "--fixture" && args[args.indexOf(a) - 1] !== "--from-report");
  if (args.includes("--from-report")) {
    const rep = get("--from-report");
    if (!rep) { console.error("--from-report requires a report file path"); process.exit(2); }
    const rootArg = get("--root");
    const out = writeExecutionFromReport(rep, { root: rootArg ? resolve(rootArg) : undefined, replace: args.includes("--replace") });
    console.log(JSON.stringify({ status: out.status, written: !!out.written, reason: out.reason, product_id: out.product_id, ai_tests: out.ai_tests ? out.ai_tests.map((t) => `${t.test}:${t.status}`) : null, conflicts: out.write_plan?.conflicts ?? [] }, null, 2));
    process.exit(out.written ? 0 : 3);
  }
  if (!pid) {
    console.error("usage: node harness/product-ai-qa.mjs <PRODUCT_ID> [--live] [--write] [--replace] [--fixture <file>] [--from-report <file>] [--schema-mode] [--report <file>] [--root <dir>]");
    process.exit(2);
  }
  const fixture = get("--fixture");
  let fetchImpl = null;
  if (fixture) {
    const body = readFileSync(resolve(fixture), "utf8");
    fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ model: "fixture", choices: [{ message: { content: body } }] }) });
  }
  const rootArg = get("--root");
  runProductAiQa(pid, {
    root: rootArg ? resolve(rootArg) : undefined,
    live: args.includes("--live"),
    write: args.includes("--write"),
    replace: args.includes("--replace"),
    fetchImpl,
  }).then((r) => {
    const out = {
      ai_qa_version: r.ai_qa_version, status: r.status, reason: r.reason,
      product_id: r.product_id, transformation_id: r.transformation_id,
      provider: r.provider, model: r.model,
      qualified_artifact: r.qualification?.qualified?.artifacts ?? null,
      input_hash: r.input_hash, task_hash: r.task_hash, output_hash: r.output_hash,
      schema_valid: r.schema_valid, provider_status: r.provider_status,
      escalations: r.escalations, written: r.written,
      ai_tests: r.ai_tests ? r.ai_tests.map((t) => `${t.test}:${t.status}`) : null,
      conflicts: r.write_plan?.conflicts ?? [],
    };
    if (get("--report")) writeFileSync(resolve(get("--report")), `${JSON.stringify(r, null, 2)}\n`, "utf8");
    console.log(JSON.stringify(out, null, 2));
    process.exit(r.status === AI_QA_STATUS.EXECUTED || r.status === AI_QA_STATUS.DRY_RUN ? 0 : 3);
  }).catch((e) => { console.error(redactAll(e?.stack || String(e), process.env)); process.exit(1); });
}
