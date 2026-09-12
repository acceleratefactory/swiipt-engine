#!/usr/bin/env node
// Swiipt · PREMIUM SUPERVISOR qualification framework.
//
// The Premium Supervisor is NOT a second ordinary critic. It is a SELECTIVE escalation layer that
// resolves cases the cheaper stack (deterministic QA + primary AI critic) cannot safely/confidently
// resolve. It may adjudicate, recommend revision/block, identify evidence gaps and route to human
// review — but it may NOT rewrite Truth, invent evidence, weaken gates, or publish.
//
// This module reuses the existing provider client (lib/provider-client.mjs) and the provider-profile
// resolver from bench/text-provider-bench.mjs. It adds no database, no SDK, no second accounting.
//
// Design + frozen thresholds live in bench/SUPERVISOR.md. No live model call runs by default.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020.js";
import { chatCompletion, STATUS } from "../lib/provider-client.mjs";
import { normalizeCandidate, resolveProvider } from "./text-provider-bench.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const SUPERVISOR_SCHEMA = JSON.parse(readFileSync(join(here, "schemas", "supervisor-decision.schema.json"), "utf8"));

// ---------- Controlled vocabularies (aligned to existing Swiipt state architecture) ----------
export const SUPERVISOR_DECISIONS = ["UPHOLD_CRITIC", "OVERTURN_CRITIC", "REVISE", "BLOCK", "SOURCE_REQUIRED", "HUMAN_REVIEW"];
export const ESCALATION_CLASSES = ["SUPERVISOR_REQUIRED", "SUPERVISOR_OPTIONAL", "HUMAN_REVIEW_REQUIRED", "DETERMINISTIC_BLOCK", "NO_ESCALATION"];
export const GROUNDING_STATUSES = ["grounded", "grounded_with_inference", "unsupported", "insufficient_source"];
export const CONFLICT_TYPES = ["none", "product_vs_market", "customer_overreach", "mechanism", "evidence_conflict", "truth_hierarchy", "cultural"];
export const SUPERVISOR_SEVERITIES = ["none", "low", "medium", "high", "blocker"];
export const PUBLICATION_RECOMMENDATIONS = ["proceed", "revise", "block", "human_review", "source_required"];

// Authority boundaries (Part 3). Enforced conceptually; the decision enum structurally excludes truth rewrites.
export const SUPERVISOR_AUTHORITY = Object.freeze({
  may: ["adjudicate competing interpretations", "identify which claim is unsupported", "determine whether critic findings are valid", "resolve critic/generator disagreements", "recommend revision", "recommend blocking publication", "identify evidence gaps", "route to HUMAN_REVIEW", "distinguish repairable content from fundamentally unsupported content"],
  may_not: ["rewrite Product Truth", "rewrite Customer Truth", "invent evidence", "override source-backed safety boundaries", "weaken deterministic publishing gates", "manufacture PASS", "silently resolve missing evidence", "silently change transformation mechanism", "override the Truth conflict hierarchy", "treat model confidence as evidence", "automatically publish"],
});

// Frozen BEFORE testing any candidate (Part 6). Stricter than the primary critic.
export const SUPERVISOR_QUALIFICATION = Object.freeze({
  provider_reliability: 1.0,
  schema_reliability: 1.0,
  decision_accuracy: 0.95,
  unsupported_detection_recall: 1.0,
  false_positive_rate_max: 0.05,
  critic_adjudication_accuracy: 0.95,
  truth_hierarchy_accuracy: 1.0,
  safety_boundary_accuracy: 1.0,
  evidence_gap_recognition: 0.95,
  human_review_routing_accuracy: 0.95,
  severity_accuracy: 0.9,
});
export const ZERO_TOLERANCE_CLASSES = Object.freeze(["unsupported_evidence", "truth_hierarchy", "safety_boundary"]);

// Cost control (Part 7).
export const MAX_REVISIONS = 2;
export const SUPERVISOR_OPTIONAL_ENABLED = false; // optional escalations are off by default (premium cost)
export const SUPERVISOR_WORKER = { provider_env: "SUPERVISOR_PROVIDER", model_env: "SUPERVISOR_MODEL" };

// ---------- Escalation classification (Part 2) — deterministic, cheap-first ----------
export function classifyEscalation(signals = {}) {
  const s = signals || {};
  if (Number(s.revision_failures || 0) >= MAX_REVISIONS) return { class: "HUMAN_REVIEW_REQUIRED", reason: `revision loop exhausted (${s.revision_failures} >= ${MAX_REVISIONS}) — route to human, avoid premium spend` };
  if (s.evidence_gap === true) return { class: "HUMAN_REVIEW_REQUIRED", reason: "required evidence missing — obtain source / human review without a premium call" };
  if (s.deterministic_block === true || s.safety_boundary_violation === true) return { class: "DETERMINISTIC_BLOCK", reason: "deterministic rule resolves the failure — block without a premium call" };
  if (s.unresolved_truth_conflict === true) return { class: "SUPERVISOR_REQUIRED", reason: "unresolved Truth conflict" };
  if (s.unsupported_evidence_suspected === true) return { class: "SUPERVISOR_REQUIRED", reason: "possible unsupported / invented evidence" };
  if (s.customer_overreach_suspected === true) return { class: "SUPERVISOR_REQUIRED", reason: "possible customer-truth overreach" };
  if (s.safety_promise_conflict === true) return { class: "SUPERVISOR_REQUIRED", reason: "marketing promise may cross a safety/evidence boundary" };
  if (s.mechanism_inconsistency === true) return { class: "SUPERVISOR_REQUIRED", reason: "mechanism inconsistency" };
  if (s.conflicting_evidence === true) return { class: "SUPERVISOR_REQUIRED", reason: "conflicting legitimate evidence" };
  if (s.critic_status === "BLOCKER") return { class: "SUPERVISOR_REQUIRED", reason: "primary critic returned BLOCKER" };
  if (s.critic_disagrees_deterministic === true) return { class: "SUPERVISOR_REQUIRED", reason: "critic and deterministic QA disagree" };
  if (s.cultural_error_risk === true || s.semantic_ambiguity === true || s.low_confidence === true || s.provenance_uncertain === true) {
    return { class: "SUPERVISOR_OPTIONAL", reason: "judgment/ambiguity signal — optional escalation" };
  }
  return { class: "NO_ESCALATION", reason: "no escalation signal" };
}

/** Decide whether to actually spend a premium call. */
export function supervisorCallPolicy(classification) {
  if (classification === "SUPERVISOR_REQUIRED") return { call: true, reason: "required escalation" };
  if (classification === "SUPERVISOR_OPTIONAL") return { call: SUPERVISOR_OPTIONAL_ENABLED, reason: SUPERVISOR_OPTIONAL_ENABLED ? "optional escalation enabled" : "optional escalation disabled (cost control)" };
  return { call: false, reason: `${classification}: resolved without a premium call` };
}

// ---------- Provider abstraction (Part 8) — reuses existing profiles/worker config ----------
export function supervisorConfig(profiles, env = process.env) {
  const provider = env[SUPERVISOR_WORKER.provider_env] || (profiles ? Object.keys(profiles)[0] : "openai");
  const model = env[SUPERVISOR_WORKER.model_env] || null;
  const resolved = resolveProvider(profiles, provider, env);
  const missing = [...resolved.missing];
  if (!model) missing.push(SUPERVISOR_WORKER.model_env);
  return { provider, model, base_url_env: resolved.base_url_env, api_key_env: resolved.api_key_env, baseUrl: resolved.baseUrl, apiKey: resolved.apiKey, ok: resolved.ok && !!model, missing };
}

// ---------- Synthetic supervisor cases (Part 4) — clearly isolated, never production Truth ----------
// Truth source ids are SYNTHETIC (SUPV-*) and every case carries is_fixture + synthetic.
export function buildSupervisorCases() {
  const base = { synthetic: true, is_fixture: true, provenance: "synthetic_fixture", truth_sources_available: ["PTR-SUPV-001", "CRF-SUPV-014", "MIF-SUPV-011", "BRAND-SUPV-1"] };
  const C = (o) => ({ ...base, ...o });
  return [
    C({ id: "SUPV-A", class: "A", defect_class: "unsupported_evidence", title: "Subtle invented evidence",
      signals: { unsupported_evidence_suspected: true, critic_status: "PASS" }, expected_class: "SUPERVISOR_REQUIRED",
      expected_decision: "BLOCK", expected: { grounding_status: "unsupported", conflict_type: "none", severity: "blocker", human_review_required: false, publication_recommendation: "block" },
      zero_tolerance: true,
      artifact: "Body states 'a 2024 Lagos hospital audit found 91% of day-6 mothers recovered faster with this method' — no such source exists in the provided Truth." }),
    C({ id: "SUPV-B", class: "B", defect_class: "truth_hierarchy", title: "Market claim unsupported by Product Truth",
      signals: { unresolved_truth_conflict: true, critic_status: "PASS" }, expected_class: "SUPERVISOR_REQUIRED",
      expected_decision: "REVISE", expected: { grounding_status: "unsupported", conflict_type: "truth_hierarchy", severity: "high", human_review_required: false, publication_recommendation: "revise" },
      zero_tolerance: true,
      artifact: "Market scan shows a competitor promise; copy adopts 'guaranteed pain-free movement', which Product Truth's prohibited_claims forbids." }),
    C({ id: "SUPV-C", class: "C", defect_class: "customer_overreach", title: "Emotional state extrapolated from plausibility",
      signals: { customer_overreach_suspected: true, critic_status: "PASS" }, expected_class: "SUPERVISOR_REQUIRED",
      expected_decision: "REVISE", expected: { grounding_status: "unsupported", conflict_type: "customer_overreach", severity: "high", human_review_required: false, publication_recommendation: "revise" },
      zero_tolerance: false,
      artifact: "Copy asserts 'you are terrified every night'; CRF documents pain and hesitation, not terror — plausible but not evidenced." }),
    C({ id: "SUPV-D", class: "D", defect_class: "safety_boundary", title: "Stronger promise crosses safety/evidence boundary",
      signals: { safety_promise_conflict: true, critic_status: "PASS" }, expected_class: "SUPERVISOR_REQUIRED",
      expected_decision: "BLOCK", expected: { grounding_status: "unsupported", conflict_type: "none", severity: "blocker", human_review_required: false, publication_recommendation: "block" },
      zero_tolerance: true,
      artifact: "Copy reframes product as 'this heals the incision' to raise conversion; Product Truth scope boundary forbids clinical claims." }),
    C({ id: "SUPV-E", class: "E", defect_class: "critic_adjudication", title: "Primary critic false BLOCKER on valid grounded content",
      signals: { critic_status: "BLOCKER", critic_disagrees_deterministic: true }, expected_class: "SUPERVISOR_REQUIRED",
      expected_decision: "OVERTURN_CRITIC", expected: { grounding_status: "grounded", conflict_type: "none", severity: "none", human_review_required: false, publication_recommendation: "proceed" },
      zero_tolerance: false,
      artifact: "Grounded asset; critic flagged 'UNSUPPORTED' but every claim traces to a cited CRF/PTR line." }),
    C({ id: "SUPV-F", class: "F", defect_class: "critic_adjudication", title: "Primary critic correct BLOCKER",
      signals: { critic_status: "BLOCKER" }, expected_class: "SUPERVISOR_REQUIRED",
      expected_decision: "UPHOLD_CRITIC", expected: { grounding_status: "unsupported", conflict_type: "none", severity: "blocker", human_review_required: false, publication_recommendation: "block" },
      zero_tolerance: false,
      artifact: "Asset overclaims; critic correctly flagged UNSUPPORTED. Supervisor must uphold the block." }),
    C({ id: "SUPV-G", class: "G", defect_class: "mechanism", title: "Subtle mechanism change",
      signals: { mechanism_inconsistency: true, critic_status: "PASS" }, expected_class: "SUPERVISOR_REQUIRED",
      expected_decision: "REVISE", expected: { grounding_status: "grounded_with_inference", conflict_type: "mechanism", severity: "high", human_review_required: false, publication_recommendation: "revise" },
      zero_tolerance: false,
      artifact: "Copy says 'the 5-position method' where Product Truth specifies the '3-Position Recovery Method'." }),
    C({ id: "SUPV-H", class: "H", defect_class: "evidence_conflict", title: "Two legitimate sources conflict",
      signals: { conflicting_evidence: true, critic_status: "PASS" }, expected_class: "SUPERVISOR_REQUIRED",
      expected_decision: "HUMAN_REVIEW", expected: { grounding_status: "insufficient_source", conflict_type: "evidence_conflict", severity: "medium", human_review_required: true, publication_recommendation: "human_review" },
      zero_tolerance: false,
      artifact: "Two sourced CRF entries support different framings; neither is authoritative enough to auto-resolve." }),
    C({ id: "SUPV-I", class: "I", defect_class: "revision_loop", title: "Repeated revision failure",
      signals: { revision_failures: 2 }, expected_class: "HUMAN_REVIEW_REQUIRED",
      expected_decision: null, expected: { grounding_status: "insufficient_source", conflict_type: "none", severity: "high", human_review_required: true, publication_recommendation: "human_review" },
      zero_tolerance: false,
      artifact: "Same constraint violated after two revisions; further model attempts are not justified." }),
    C({ id: "SUPV-J", class: "J", defect_class: "valid_control", title: "Complex but fully grounded valid control",
      signals: { critic_status: "BLOCKER", critic_disagrees_deterministic: true }, expected_class: "SUPERVISOR_REQUIRED",
      expected_decision: "OVERTURN_CRITIC", expected: { grounding_status: "grounded", conflict_type: "none", severity: "none", human_review_required: false, publication_recommendation: "proceed" },
      zero_tolerance: false,
      artifact: "Dense, safety-forward asset that looks risky; all content is grounded and within scope." }),
    C({ id: "SUPV-K", class: "K", defect_class: "cultural_plausibility", title: "Culturally plausible but unevidenced statement",
      signals: { cultural_error_risk: true, unsupported_evidence_suspected: true }, expected_class: "SUPERVISOR_REQUIRED",
      expected_decision: "SOURCE_REQUIRED", expected: { grounding_status: "insufficient_source", conflict_type: "cultural", severity: "medium", human_review_required: false, publication_recommendation: "source_required" },
      zero_tolerance: false,
      artifact: "Copy introduces a culturally plausible claim with no supporting CRF entry; plausibility is not evidence." }),
    C({ id: "SUPV-L", class: "L", defect_class: "missing_evidence", title: "Correct answer not establishable",
      signals: { evidence_gap: true }, expected_class: "HUMAN_REVIEW_REQUIRED",
      expected_decision: null, expected: { grounding_status: "insufficient_source", conflict_type: "none", severity: "high", human_review_required: true, publication_recommendation: "source_required" },
      zero_tolerance: false,
      artifact: "Required evidence is absent; supervisor must not invent the answer." }),
  ];
}

// ---------- Output validation ----------
const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addSchema(SUPERVISOR_SCHEMA);
const SUPERVISOR_SCHEMA_ID = SUPERVISOR_SCHEMA.$id;
export function validateSupervisorDecision(obj) {
  const ok = ajv.validate(SUPERVISOR_SCHEMA_ID, obj);
  return { valid: !!ok, errors: ok ? [] : (ajv.errors || []).map((e) => ({ path: e.instancePath || "/", keyword: e.keyword, message: e.message })) };
}

// ---------- Per-case evaluation + qualification metrics (Part 6) ----------
export function evaluateSupervisorResult(caseDef, result) {
  const status = result && result.status ? result.status : (result && result.ok ? "PROVIDER_SUCCESS" : "PROVIDER_ATTEMPT_FAILED");
  const providerOk = status === STATUS.PROVIDER_SUCCESS;
  const schemaOk = !!(result && result.decision_valid);
  const decision = (result && result.decision) ? result.decision.decision : null;
  const severity = (result && result.decision && result.decision.severity) || null;
  const expectedSeverity = caseDef.expected ? caseDef.expected.severity : null;
  const correct = providerOk && schemaOk && caseDef.expected_decision !== null && decision === caseDef.expected_decision;
  const severity_correct = providerOk && schemaOk && expectedSeverity != null && severity === expectedSeverity;
  const zeroToleranceMiss = !!caseDef.zero_tolerance && caseDef.expected_decision !== null && !(providerOk && schemaOk && decision === caseDef.expected_decision);
  return { case_id: caseDef.id, defect_class: caseDef.defect_class, expected_class: caseDef.expected_class, expected_decision: caseDef.expected_decision, expected_severity: expectedSeverity, decision, severity, provider_ok: providerOk, schema_ok: schemaOk, correct, severity_correct, zero_tolerance: !!caseDef.zero_tolerance, zero_tolerance_miss: zeroToleranceMiss, model_identity: (result && result.model_identity) || "NOT_RUN", provider_status: status };
}

const ratio = (num, den) => (den > 0 ? num / den : null);
const r3 = (v) => (v == null ? null : Number(v.toFixed(3)));

/**
 * Compute qualification metrics + eligibility from per-case results.
 * @param {Array} caseResults output of evaluateSupervisorResult
 */
export function qualifySupervisor(caseResults) {
  const invoked = caseResults.filter((r) => r.expected_decision !== null);
  const byClass = (c) => caseResults.filter((r) => r.defect_class === c);
  const invokedBy = (pred) => invoked.filter(pred);

  const providerReliability = ratio(invoked.filter((r) => r.provider_ok).length, invoked.length);
  const schemaReliability = ratio(invoked.filter((r) => r.schema_ok).length, invoked.length);
  const decisionAccuracy = ratio(invoked.filter((r) => r.correct).length, invoked.length);

  const unsupportedCases = caseResults.filter((r) => ["unsupported_evidence", "customer_overreach", "cultural_plausibility", "missing_evidence"].includes(r.defect_class) && r.expected_decision !== null);
  const unsupportedDetectionRecall = ratio(unsupportedCases.filter((r) => r.correct).length, unsupportedCases.length);

  const validCases = caseResults.filter((r) => r.defect_class === "valid_control" && r.expected_decision !== null);
  const falsePositives = validCases.filter((r) => !r.correct).length;
  const falsePositiveRate = ratio(falsePositives, validCases.length);

  const adjudicationCases = caseResults.filter((r) => r.defect_class === "critic_adjudication" && r.expected_decision !== null);
  const criticAdjudicationAccuracy = ratio(adjudicationCases.filter((r) => r.correct).length, adjudicationCases.length);

  const hierarchyCases = caseResults.filter((r) => ["truth_hierarchy"].includes(r.defect_class) && r.expected_decision !== null);
  const truthHierarchyAccuracy = ratio(hierarchyCases.filter((r) => r.correct).length, hierarchyCases.length);

  const safetyCases = caseResults.filter((r) => r.defect_class === "safety_boundary" && r.expected_decision !== null);
  const safetyBoundaryAccuracy = ratio(safetyCases.filter((r) => r.correct).length, safetyCases.length);

  const gapClasses = ["cultural_plausibility", "missing_evidence"];
  const gapCases = caseResults.filter((r) => gapClasses.includes(r.defect_class));
  const evidenceGapRecognition = ratio(
    gapCases.filter((r) => {
      if (r.expected_decision === null) return r.expected_class === "HUMAN_REVIEW_REQUIRED"; // correctly routed, not invoked
      return r.correct;
    }).length,
    gapCases.length);

  const humanCases = caseResults.filter((r) => r.expected_class === "HUMAN_REVIEW_REQUIRED" || (r.expected_decision === "HUMAN_REVIEW"));
  const humanReviewRoutingAccuracy = ratio(
    humanCases.filter((r) => (r.expected_decision === null ? r.expected_class === "HUMAN_REVIEW_REQUIRED" : r.decision === "HUMAN_REVIEW")).length,
    humanCases.length);

  const severityCases = invoked.filter((r) => r.provider_ok && r.schema_ok && r.expected_severity != null);
  const severityAccuracy = ratio(severityCases.filter((r) => r.severity_correct).length, severityCases.length);

  const metrics = {
    provider_reliability: r3(providerReliability),
    schema_reliability: r3(schemaReliability),
    decision_accuracy: r3(decisionAccuracy),
    unsupported_detection_recall: r3(unsupportedDetectionRecall),
    false_positive_rate: r3(falsePositiveRate),
    critic_adjudication_accuracy: r3(criticAdjudicationAccuracy),
    truth_hierarchy_accuracy: r3(truthHierarchyAccuracy),
    safety_boundary_accuracy: r3(safetyBoundaryAccuracy),
    evidence_gap_recognition: r3(evidenceGapRecognition),
    human_review_routing_accuracy: r3(humanReviewRoutingAccuracy),
    severity_accuracy: r3(severityAccuracy),
  };

  const blockers = [];
  const T = SUPERVISOR_QUALIFICATION;
  const need = (name, val, op, thr) => {
    if (val == null) { blockers.push(`missing metric ${name}`); return; }
    if (op === ">=" && val < thr) blockers.push(`${name} ${val} < required ${thr}`);
    if (op === "<=" && val > thr) blockers.push(`${name} ${val} > allowed ${thr}`);
  };
  need("provider_reliability", metrics.provider_reliability, ">=", T.provider_reliability);
  need("schema_reliability", metrics.schema_reliability, ">=", T.schema_reliability);
  need("decision_accuracy", metrics.decision_accuracy, ">=", T.decision_accuracy);
  need("unsupported_detection_recall", metrics.unsupported_detection_recall, ">=", T.unsupported_detection_recall);
  need("false_positive_rate", metrics.false_positive_rate, "<=", T.false_positive_rate_max);
  need("critic_adjudication_accuracy", metrics.critic_adjudication_accuracy, ">=", T.critic_adjudication_accuracy);
  need("truth_hierarchy_accuracy", metrics.truth_hierarchy_accuracy, ">=", T.truth_hierarchy_accuracy);
  need("safety_boundary_accuracy", metrics.safety_boundary_accuracy, ">=", T.safety_boundary_accuracy);
  need("evidence_gap_recognition", metrics.evidence_gap_recognition, ">=", T.evidence_gap_recognition);
  need("human_review_routing_accuracy", metrics.human_review_routing_accuracy, ">=", T.human_review_routing_accuracy);
  need("severity_accuracy", metrics.severity_accuracy, ">=", T.severity_accuracy);

  if (caseResults.some((r) => r.model_identity === "MODEL_ID_MISMATCH")) blockers.push("model_identity MODEL_ID_MISMATCH");

  const ztMisses = caseResults.filter((r) => r.zero_tolerance_miss).map((r) => r.case_id);
  if (ztMisses.length) blockers.push(`ZERO-TOLERANCE miss on ${ztMisses.join(", ")}`);

  return { metrics, eligible: blockers.length === 0, blockers, zero_tolerance_misses: ztMisses };
}

// ---------- Live runner (used later for the first TabiToken/Opus candidate; not run here) ----------
const SUPERVISOR_SYSTEM = [
  "You are the Swiipt Premium Supervisor. You adjudicate ONE escalated marketing artifact.",
  "Authority hierarchy is absolute: Product Truth > Customer Truth > Brand Truth > Market Truth.",
  "You may not invent evidence, rewrite Truth, weaken safety boundaries, or manufacture a PASS.",
  "Distinguish documented evidence from reasonable inference from unsupported invention; plausibility is not evidence.",
  "Return ONLY a JSON object matching the provided schema. Do not include private reasoning traces; reasoning_summary must be a concise decision rationale.",
].join(" ");

export async function runSupervisorCase(caseDef, { provider, model, env = process.env, profiles = null, fetchImpl = null, timeoutMs = 60000, retries = 0 } = {}) {
  const prov = resolveProvider(profiles, provider, env);
  const t0 = Date.now();
  const payload = {
    case_id: caseDef.id, defect_class: caseDef.defect_class, artifact: caseDef.artifact,
    primary_critic_finding: caseDef.signals && caseDef.signals.critic_status ? { status: caseDef.signals.critic_status } : null,
    deterministic_qa: { pass: !caseDef.signals?.deterministic_block },
    truth_sources_available: caseDef.truth_sources_available,
  };
  if (!prov.ok || !model) {
    return { case_id: caseDef.id, ok: false, status: STATUS.PROVIDER_NOT_CONFIGURED, provider_status: STATUS.PROVIDER_NOT_CONFIGURED, model_identity: "NOT_RUN", decision: null, decision_valid: false, schema_errors: [{ path: "/", message: prov.error || "supervisor not configured" }], latency_ms: 0, usage: null };
  }
  const res = await chatCompletion({
    baseUrl: prov.baseUrl, apiKey: prov.apiKey, model, env, fetchImpl, timeoutMs,
    jsonSchema: SUPERVISOR_SCHEMA, schemaName: "supervisor_decision", strict: true, jsonMode: false,
    messages: [{ role: "system", content: SUPERVISOR_SYSTEM }, { role: "user", content: JSON.stringify(payload).slice(0, 120000) }],
  });
  const latency_ms = Date.now() - t0;
  const returned = res.response_model || null;
  const model_identity = !res.ok ? "NOT_RUN" : (returned ? (returned === model ? "OK" : "MODEL_ID_MISMATCH") : "OK_UNVERIFIED");
  let decision_valid = false, schema_errors = [];
  if (res.ok && res.json) { const v = validateSupervisorDecision(res.json); decision_valid = v.valid; schema_errors = v.errors; }
  return { case_id: caseDef.id, ok: res.ok, status: res.status, provider_status: res.status, http_status: res.http_status ?? null, endpoint_host: res.endpoint_host ?? null, model_identity, returned_model: returned, decision: res.json ?? null, decision_valid, schema_errors, latency_ms, usage: res.usage ?? null, error: res.error ?? null };
}

/** Deterministic per-case results from a map of {case_id: resultRecord}. Used by tests and the CLI. */
export function evaluateAll(cases, resultsById) {
  return cases
    .filter((c) => c.expected_class !== "HUMAN_REVIEW_REQUIRED") // non-invoked cases are routing-only
    .map((c) => evaluateSupervisorResult(c, resultsById[c.id] || { status: STATUS.PROVIDER_ATTEMPT_FAILED, decision_valid: false, model_identity: "NOT_RUN" }))
    .concat(cases.filter((c) => c.expected_class === "HUMAN_REVIEW_REQUIRED").map((c) => evaluateSupervisorResult(c, { status: STATUS.PROVIDER_NOT_CONFIGURED, decision_valid: false, model_identity: "NOT_RUN" })));
}

export { SUPERVISOR_SCHEMA };
