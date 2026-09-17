// Pre-Revenue Text Intelligence Operating Mode — deterministic tests. No network, no live calls.
// Run: node harness/text-intelligence.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020.js";
import {
  TEXT_INTELLIGENCE_MODES, ROUTING_ACTIONS, HUMAN_REVIEW_STATES, DEFERRED_REASON,
  loadTextIntelligenceConfig, supervisorOperatingStatus, routeEscalation, resolveEscalation,
  makeHumanReview, humanReviewBlocksPublication, publicationAllowed,
} from "../lib/text-intelligence.mjs";
import { EVIDENCE_RESULTS, evaluateClaim, evaluateClaims, criticConfidenceIsNotEvidence } from "./evidence-provenance.mjs";
import {
  buildSupervisorCases, classifyEscalation, SUPERVISOR_QUALIFICATION, ZERO_TOLERANCE_CLASSES,
} from "../bench/supervisor-bench.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = loadTextIntelligenceConfig();
const PRE = TEXT_INTELLIGENCE_MODES.PRE_REVENUE;
const route = (c, o = {}) => routeEscalation(c, { mode: PRE, ...o });

// 1
test("1. PRE_REVENUE + NO_ESCALATION -> CONTINUE", () => {
  const r = route("NO_ESCALATION");
  assert.equal(r.action, ROUTING_ACTIONS.CONTINUE);
  assert.equal(r.publish_allowed, true);
});

// 2
test("2. PRE_REVENUE + DETERMINISTIC_BLOCK -> BLOCK", () => {
  const r = route("DETERMINISTIC_BLOCK");
  assert.equal(r.action, ROUTING_ACTIONS.BLOCK);
  assert.equal(r.publish_allowed, false);
});

// 3
test("3. PRE_REVENUE + HUMAN_REVIEW_REQUIRED -> HUMAN_REVIEW", () => {
  const r = route("HUMAN_REVIEW_REQUIRED");
  assert.equal(r.action, ROUTING_ACTIONS.HUMAN_REVIEW);
  assert.equal(r.human_review_required, true);
});

// 4
test("4. PRE_REVENUE + SUPERVISOR_REQUIRED -> HUMAN_REVIEW (deferred reason)", () => {
  const r = route("SUPERVISOR_REQUIRED");
  assert.equal(r.action, ROUTING_ACTIONS.HUMAN_REVIEW);
  assert.equal(r.reason, DEFERRED_REASON);
  assert.equal(r.human_review_required, true);
});

// 5
test("5. SUPERVISOR_REQUIRED never becomes PASS/CONTINUE", () => {
  const r = route("SUPERVISOR_REQUIRED");
  assert.notEqual(r.action, ROUTING_ACTIONS.CONTINUE);
  assert.notEqual(r.action, ROUTING_ACTIONS.SUPERVISOR);
  assert.equal(r.publish_allowed, false);
});

// 6
test("6. no supervisor result is fabricated in PRE_REVENUE", () => {
  for (const c of ["NO_ESCALATION", "DETERMINISTIC_BLOCK", "HUMAN_REVIEW_REQUIRED", "SUPERVISOR_OPTIONAL", "SUPERVISOR_REQUIRED"]) {
    const r = route(c);
    assert.equal(r.supervisor_result, null, c);
    assert.equal(r.supervisor_invoked, false, c);
  }
});

// 7
test("7. supervisor status remains DEFERRED_UNTIL_REVENUE + config validates against its schema", () => {
  const s = supervisorOperatingStatus(cfg);
  assert.equal(s.status, "DEFERRED_UNTIL_REVENUE");
  assert.equal(s.architectural_role, "PERMANENT");
  assert.equal(s.fallback, "HUMAN_REVIEW");
  const ajv = new Ajv({ allErrors: true, strict: false });
  for (const f of readdirSync(join(root, "schemas")).filter((x) => x.endsWith(".schema.json"))) {
    const sch = JSON.parse(readFileSync(join(root, "schemas", f), "utf8"));
    sch.$id = `https://swiipt.com/factory/schemas/${f}`;
    try { ajv.addSchema(sch); } catch (e) { /* already */ }
  }
  const ok = ajv.validate("https://swiipt.com/factory/schemas/text-intelligence.schema.json", cfg);
  assert.equal(ok, true, JSON.stringify(ajv.errors));
});

// 8
test("8. supervisor framework files remain available (intact)", () => {
  for (const f of ["bench/supervisor-bench.mjs", "bench/supervisor-bench.test.mjs", "bench/schemas/supervisor-decision.schema.json", "bench/SUPERVISOR.md"]) {
    assert.ok(existsSync(join(root, f)), `missing ${f}`);
  }
});

// 9
test("9. unresolved human review blocks publication", () => {
  const hr = makeHumanReview({ reason: "invented evidence", escalation_class: "SUPERVISOR_REQUIRED" });
  assert.equal(hr.status, "PENDING_HUMAN_REVIEW");
  assert.equal(humanReviewBlocksPublication(hr), true);
  const r = publicationAllowed({ human_review: hr, routing: route("SUPERVISOR_REQUIRED"), qa_all_pass: true, authorization: { status: "READY_TO_PUBLISH", authorized_by: "Owner" } });
  assert.equal(r.allowed, false);
  assert.ok(r.blockers.includes("human_review_PENDING_HUMAN_REVIEW"));
});

// 10
test("10. resolved review can only continue through normal downstream gates", () => {
  const resolved = makeHumanReview({ status: "RESOLVED", reason: "fixed", escalation_class: "SUPERVISOR_REQUIRED", resolution: "removed unsupported claim" });
  assert.equal(humanReviewBlocksPublication(resolved), false);
  // resolved but downstream gates not pass -> still blocked
  assert.equal(publicationAllowed({ human_review: resolved, routing: route("SUPERVISOR_REQUIRED"), qa_all_pass: false, authorization: { status: "READY_TO_PUBLISH", authorized_by: "Owner" } }).allowed, false);
  // resolved + all gates + explicit authorization -> allowed
  assert.equal(publicationAllowed({ human_review: resolved, routing: route("SUPERVISOR_REQUIRED"), qa_all_pass: true, authorization: { status: "READY_TO_PUBLISH", authorized_by: "Owner" } }).allowed, true);
});

// 11
test("11. missing required evidence returns SOURCE_REQUIRED", () => {
  const r = evaluateClaim({ id: "c1", requires_evidence: true, source_ref: "SRC-X" }, {});
  assert.equal(r.result, EVIDENCE_RESULTS.SOURCE_REQUIRED);
});

// 12
test("12. critic confidence cannot manufacture evidence provenance", () => {
  const claim = { id: "c1", requires_evidence: true, critic_confidence: 0.99, critic_says_supported: true };
  assert.equal(evaluateClaim(claim, {}).result, EVIDENCE_RESULTS.SOURCE_REQUIRED);
  assert.equal(criticConfidenceIsNotEvidence({ claim, sources: {} }), false);
});

// 13
test("13. source-backed deterministic evidence is authoritative over critic inference", () => {
  const sources = { "SRC-1": { exists: true, classification: "research-backed", supports: ["c1"] } };
  // valid source -> OK even though the critic claims it is unsupported
  assert.equal(evaluateClaim({ id: "c1", requires_evidence: true, source_ref: "SRC-1", critic_says_supported: false }, sources).result, EVIDENCE_RESULTS.OK);
  // no source -> SOURCE_REQUIRED even though the critic claims support
  assert.equal(evaluateClaim({ id: "c2", requires_evidence: true, critic_says_supported: true }, sources).result, EVIDENCE_RESULTS.SOURCE_REQUIRED);
});

// 14
test("14. deterministic safety block cannot be overridden by critic", () => {
  const sources = { "SRC-WEAK": { exists: true, classification: "community-reported", supports: ["c1"] } };
  const r = evaluateClaim({ id: "c1", requires_evidence: true, source_ref: "SRC-WEAK", safety_relevant: true, critic_confidence: 0.99 }, sources);
  assert.equal(r.result, EVIDENCE_RESULTS.BLOCK);
  // routing: deterministic block stays block regardless of any critic view
  assert.equal(routeEscalation("DETERMINISTIC_BLOCK", { mode: PRE, supervisor_qualified: true }).action, ROUTING_ACTIONS.BLOCK);
});

// 15
test("15. generator remains ACTIVE_INCUMBENT", () => {
  assert.equal(cfg.generator.provider, "nvidia");
  assert.equal(cfg.generator.model, "deepseek-ai/deepseek-v4-flash-0731");
  assert.equal(cfg.generator.status, "ACTIVE_INCUMBENT");
});

// 16
test("16. the canonical primary critic is the model the repository's own qualification evidence qualifies", () => {
  assert.equal(cfg.primary_critic.provider, "nvidia");
  assert.equal(cfg.primary_critic.model, "nvidia/nemotron-3-super-120b-a12b");
  assert.equal(cfg.primary_critic.status, "QUALIFIED_PRIMARY_CRITIC");
  assert.ok(cfg.primary_critic.known_limitation, "known limitation must stay documented");
  // Recurrence guard (task section 33): the config must point at the immutable artifact that
  // qualifies THIS critic, and that artifact must actually record this critic as eligible.
  const ref = cfg.primary_critic.qualification_reference;
  assert.ok(ref && ref.artifact, "qualification_reference.artifact is required so config can never drift from evidence");
  const artifactPath = join(root, ref.artifact);
  assert.ok(existsSync(artifactPath), `qualification artifact must exist: ${ref.artifact}`);
  const doc = JSON.parse(readFileSync(artifactPath, "utf8"));
  const rec = (doc.critics || []).find((c) => String(c.model).endsWith("nemotron-3-super-120b-a12b"));
  assert.ok(rec, "the referenced qualification artifact must contain the configured critic");
  assert.equal(rec.model, cfg.primary_critic.model, "configured critic must equal the critic recorded in the qualification artifact");
  assert.equal(rec.model_identity, "OK", "qualified critic must have verified model identity");
  assert.equal(doc.comparison.recommended_critic, cfg.primary_critic.model, "artifact must actually recommend the configured critic");
  assert.equal(doc.task_hash, ref.task_hash, "documented task_hash must match the immutable artifact");
  for (const [m, v] of Object.entries(ref.thresholds)) assert.ok(Number(rec[m]) >= v, `${m} must meet its frozen threshold`);
});

// 17
test("17. no supervisor call occurs in PRE_REVENUE for ANY classification", () => {
  const classes = ["NO_ESCALATION", "DETERMINISTIC_BLOCK", "SUPERVISOR_OPTIONAL", "SUPERVISOR_REQUIRED", "HUMAN_REVIEW_REQUIRED"];
  for (const c of classes) {
    const r = route(c, { supervisor_qualified: true, risk_sensitive: true, unresolved: true });
    assert.notEqual(r.action, ROUTING_ACTIONS.SUPERVISOR, c);
    assert.equal(r.supervisor_invoked, false, c);
  }
});

// 18
test("18. no provider fallback silently invokes another LLM", () => {
  const src = readFileSync(join(root, "lib", "text-intelligence.mjs"), "utf8");
  assert.ok(!/provider-client/.test(src), "must not import provider client");
  assert.ok(!/chatCompletion/.test(src), "must not call chatCompletion");
  assert.ok(!/fetch\s*\(/.test(src), "must not perform network calls");
  const ev = readFileSync(join(root, "harness", "evidence-provenance.mjs"), "utf8");
  assert.ok(!/provider-client|chatCompletion|fetch\s*\(/.test(ev), "evidence checker must be deterministic only");
});

// 19
test("19. existing supervisor A-L benchmark remains unchanged", () => {
  const cases = buildSupervisorCases();
  assert.equal(cases.length, 12);
  const ids = cases.map((c) => c.id).sort();
  const expected = "ABCDEFGHIJKL".split("").map((l) => "SUPV-" + l).sort();
  assert.deepEqual(ids, expected);
  for (const c of cases) assert.equal(classifyEscalation(c.signals).class, c.expected_class, c.id);
});

// 20
test("20. existing supervisor thresholds + zero-tolerance classes remain unchanged", () => {
  assert.deepEqual(SUPERVISOR_QUALIFICATION, {
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
  assert.deepEqual([...ZERO_TOLERANCE_CLASSES], ["unsupported_evidence", "truth_hierarchy", "safety_boundary"]);
});
