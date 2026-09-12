// Premium Supervisor qualification framework — deterministic tests (no network, no live calls).
import { test } from "node:test";
import assert from "node:assert/strict";
import { STATUS } from "../lib/provider-client.mjs";
import {
  buildSupervisorCases, classifyEscalation, supervisorCallPolicy, validateSupervisorDecision,
  evaluateSupervisorResult, qualifySupervisor, evaluateAll, supervisorConfig,
  runSupervisorCase, SUPERVISOR_QUALIFICATION, ZERO_TOLERANCE_CLASSES, SUPERVISOR_DECISIONS,
  SUPERVISOR_AUTHORITY, MAX_REVISIONS,
} from "./supervisor-bench.mjs";

const CASES = buildSupervisorCases();
const byId = (id) => CASES.find((c) => c.id === id);

function decisionFor(caseDef, over = {}) {
  const e = caseDef.expected;
  return {
    case_id: caseDef.id,
    decision: caseDef.expected_decision,
    primary_critic_finding_valid: true,
    grounding_status: e.grounding_status,
    truth_sources_used: ["PTR-SUPV-001"],
    unsupported_claims: e.grounding_status === "unsupported" ? ["synthetic unsupported claim"] : [],
    evidence_gap: e.grounding_status === "insufficient_source" ? "missing synthetic source" : null,
    conflict_type: e.conflict_type,
    severity: e.severity,
    revision_possible: caseDef.expected_decision === "REVISE",
    revision_instructions: caseDef.expected_decision === "REVISE" ? ["remove/reframe the claim"] : [],
    escalation_required: true,
    human_review_required: e.human_review_required,
    publication_recommendation: e.publication_recommendation,
    reasoning_summary: "Synthetic decision used for harness qualification tests.",
    ...over,
  };
}
const perfectResults = () => {
  const map = {};
  for (const c of CASES) if (c.expected_decision !== null) map[c.id] = { status: STATUS.PROVIDER_SUCCESS, decision_valid: true, model_identity: "OK_UNVERIFIED", decision: decisionFor(c), usage: { total_tokens: 10 } };
  return map;
};

test("1. all 12 supervisor cases have the expected escalation classification", () => {
  for (const c of CASES) assert.equal(classifyEscalation(c.signals).class, c.expected_class, c.id);
});

test("2. escalation classes cover all five categories", () => {
  const classes = new Set(CASES.map((c) => c.expected_class));
  for (const r of ["SUPERVISOR_REQUIRED", "HUMAN_REVIEW_REQUIRED"]) assert.ok(classes.has(r));
  assert.ok(classifyEscalation({}).class === "NO_ESCALATION");
  assert.ok(classifyEscalation({ deterministic_block: true }).class === "DETERMINISTIC_BLOCK");
  assert.ok(classifyEscalation({ low_confidence: true }).class === "SUPERVISOR_OPTIONAL");
});

test("3. cost control: policy never calls premium for non-required classes", () => {
  assert.equal(supervisorCallPolicy("SUPERVISOR_REQUIRED").call, true);
  for (const c of ["HUMAN_REVIEW_REQUIRED", "DETERMINISTIC_BLOCK", "NO_ESCALATION"]) assert.equal(supervisorCallPolicy(c).call, false);
  assert.equal(supervisorCallPolicy("SUPERVISOR_OPTIONAL").call, false, "optional escalations disabled by default (cost control)");
});

test("4. output schema validates a well-formed decision and rejects malformed ones", () => {
  const good = decisionFor(byId("SUPV-A"));
  assert.equal(validateSupervisorDecision(good).valid, true);
  const badDecision = { ...good, decision: "REWRITE_TRUTH" };
  assert.equal(validateSupervisorDecision(badDecision).valid, false);
  const missing = { ...good }; delete missing.reasoning_summary;
  assert.equal(validateSupervisorDecision(missing).valid, false);
  assert.ok(SUPERVISOR_DECISIONS.length === 6);
});

test("5. zero-tolerance classes are declared and mapped to cases", () => {
  assert.deepEqual([...ZERO_TOLERANCE_CLASSES], ["unsupported_evidence", "truth_hierarchy", "safety_boundary"]);
  const zt = CASES.filter((c) => c.zero_tolerance).map((c) => c.id).sort();
  assert.deepEqual(zt, ["SUPV-A", "SUPV-B", "SUPV-D"]);
});

test("6. a perfect candidate qualifies (all thresholds met, no blockers)", () => {
  const results = evaluateAll(CASES, perfectResults());
  const q = qualifySupervisor(results);
  assert.equal(q.eligible, true, JSON.stringify(q.blockers));
  assert.equal(q.metrics.decision_accuracy, 1);
  assert.equal(q.metrics.false_positive_rate, 0);
  assert.equal(q.metrics.truth_hierarchy_accuracy, 1);
  assert.equal(q.metrics.safety_boundary_accuracy, 1);
});

test("7. a ZERO-TOLERANCE miss disqualifies regardless of aggregate accuracy", () => {
  const map = perfectResults();
  map["SUPV-A"] = { status: STATUS.PROVIDER_SUCCESS, decision_valid: true, model_identity: "OK_UNVERIFIED", decision: decisionFor(byId("SUPV-A"), { decision: "REVISE" }) };
  const q = qualifySupervisor(evaluateAll(CASES, map));
  assert.equal(q.eligible, false);
  assert.ok(q.blockers.some((b) => /ZERO-TOLERANCE miss on SUPV-A/.test(b)), JSON.stringify(q.blockers));
  assert.ok(q.zero_tolerance_misses.includes("SUPV-A"));
});

test("8. false positive on the valid control fails qualification", () => {
  const map = perfectResults();
  map["SUPV-J"] = { status: STATUS.PROVIDER_SUCCESS, decision_valid: true, model_identity: "OK_UNVERIFIED", decision: decisionFor(byId("SUPV-J"), { decision: "BLOCK" }) };
  const q = qualifySupervisor(evaluateAll(CASES, map));
  assert.equal(q.eligible, false);
  assert.ok(q.blockers.some((b) => /false_positive_rate/.test(b)), JSON.stringify(q.blockers));
});

test("9. missing metrics never silently pass", () => {
  const q = qualifySupervisor([]); // no results at all
  assert.equal(q.eligible, false);
  assert.ok(q.blockers.some((b) => /missing metric provider_reliability/.test(b)));
  assert.ok(q.blockers.some((b) => /missing metric decision_accuracy/.test(b)));
});

test("10. provider failure on an invoked case is reflected and blocks", () => {
  const map = perfectResults();
  map["SUPV-E"] = { status: STATUS.PROVIDER_ATTEMPT_FAILED, decision_valid: false, model_identity: "NOT_RUN", decision: null };
  const q = qualifySupervisor(evaluateAll(CASES, map));
  assert.equal(q.eligible, false);
  assert.ok(q.metrics.provider_reliability < 1);
  assert.ok(q.blockers.some((b) => /provider_reliability/.test(b)));
});

test("11. model identity mismatch blocks", () => {
  const map = perfectResults();
  map["SUPV-G"] = { status: STATUS.PROVIDER_SUCCESS, decision_valid: true, model_identity: "MODEL_ID_MISMATCH", decision: decisionFor(byId("SUPV-G")) };
  const q = qualifySupervisor(evaluateAll(CASES, map));
  assert.equal(q.eligible, false);
  assert.ok(q.blockers.some((b) => /MODEL_ID_MISMATCH/.test(b)));
});

test("12. NOT_RUN is treated as failure, not a passing decision", () => {
  const r = evaluateSupervisorResult(byId("SUPV-A"), { status: STATUS.PROVIDER_NOT_CONFIGURED, decision_valid: false, model_identity: "NOT_RUN", decision: null });
  assert.equal(r.provider_ok, false);
  assert.equal(r.correct, false);
  assert.equal(r.zero_tolerance_miss, true);
});

test("13. human-review routing accuracy covers invoked and non-invoked cases", () => {
  assert.equal(byId("SUPV-H").expected_decision, "HUMAN_REVIEW");
  assert.equal(byId("SUPV-I").expected_class, "HUMAN_REVIEW_REQUIRED");
  assert.equal(byId("SUPV-L").expected_class, "HUMAN_REVIEW_REQUIRED");
  const q = qualifySupervisor(evaluateAll(CASES, perfectResults()));
  assert.equal(q.metrics.human_review_routing_accuracy, 1);
  assert.equal(q.metrics.evidence_gap_recognition, 1);
});

test("14. cost/usage provenance is recorded per case and reuses provider usage", async () => {
  const fx = byId("SUPV-A");
  const okFetch = async () => ({ ok: true, status: 200, json: async () => ({ model: "m", choices: [{ message: { content: JSON.stringify(decisionFor(fx)) } }], usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 } }) });
  const r = await runSupervisorCase(fx, { provider: "p1", model: "m", env: { P1_BASE: "https://p1.example/v1", P1_KEY: "testkey-x" }, profiles: { p1: { base_url_env: "P1_BASE", api_key_env: "P1_KEY" } }, fetchImpl: okFetch });
  assert.equal(r.usage.total_tokens, 10);
  assert.equal(r.decision_valid, true);
  assert.equal(r.model_identity, "OK");
});

test("15. runSupervisorCase: provider failure and invalid decision are explicit", async () => {
  const fx = byId("SUPV-A");
  const boom = async () => { throw new Error("down"); };
  const r1 = await runSupervisorCase(fx, { provider: "p1", model: "m", env: { P1_BASE: "https://p1.example/v1", P1_KEY: "testkey-x" }, profiles: { p1: { base_url_env: "P1_BASE", api_key_env: "P1_KEY" } }, fetchImpl: boom });
  assert.equal(r1.status, STATUS.PROVIDER_ATTEMPT_FAILED);
  assert.equal(r1.decision_valid, false);
  const badJson = async () => ({ ok: true, status: 200, json: async () => ({ model: "m", choices: [{ message: { content: JSON.stringify({ decision: "NOPE" }) } }] }) });
  const r2 = await runSupervisorCase(fx, { provider: "p1", model: "m", env: { P1_BASE: "https://p1.example/v1", P1_KEY: "testkey-x" }, profiles: { p1: { base_url_env: "P1_BASE", api_key_env: "P1_KEY" } }, fetchImpl: badJson });
  assert.equal(r2.ok, true);
  assert.equal(r2.decision_valid, false);
  assert.ok(r2.schema_errors.length >= 1);
});

test("16. supervisorConfig resolves provider/model and reports missing explicitly", () => {
  const cfg = supervisorConfig({ xkiro: { base_url_env: "XK_BASE", api_key_env: "XK_KEY" } }, { SUPERVISOR_PROVIDER: "xkiro", SUPERVISOR_MODEL: "mistralai/mistral-large-2512", XK_BASE: "https://api.xkiro.com/v1", XK_KEY: "testkey-x" });
  assert.equal(cfg.provider, "xkiro");
  assert.equal(cfg.model, "mistralai/mistral-large-2512");
  assert.equal(cfg.ok, true);
  const missing = supervisorConfig({ xkiro: { base_url_env: "XK_BASE", api_key_env: "XK_KEY" } }, { SUPERVISOR_PROVIDER: "xkiro" });
  assert.equal(missing.ok, false);
  assert.ok(missing.missing.some((m) => /SUPERVISOR_MODEL/.test(m)));
});

test("17. synthetic fixtures are isolated and carry provenance markers", () => {
  for (const c of CASES) {
    assert.equal(c.synthetic, true);
    assert.equal(c.is_fixture, true);
    assert.equal(c.provenance, "synthetic_fixture");
    assert.ok(c.truth_sources_available.every((t) => /SUPV/.test(t)), c.id);
    assert.equal(JSON.stringify(c).includes("CRF-CSEC"), false, "must not reference production Truth fixtures");
  }
});

test("18. authority boundaries forbid truth rewrites and manufacturing PASS", () => {
  assert.ok(SUPERVISOR_AUTHORITY.may_not.includes("rewrite Product Truth"));
  assert.ok(SUPERVISOR_AUTHORITY.may_not.includes("invent evidence"));
  assert.ok(SUPERVISOR_AUTHORITY.may_not.includes("manufacture PASS"));
  assert.ok(SUPERVISOR_AUTHORITY.may_not.includes("automatically publish"));
  assert.ok(!SUPERVISOR_DECISIONS.includes("PASS"));
  assert.equal(typeof SUPERVISOR_QUALIFICATION.decision_accuracy, "number");
  assert.equal(MAX_REVISIONS, 2);
});
