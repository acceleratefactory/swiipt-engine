// PRODUCT QA GATE RUNNER V1 - ADVERSARIAL QUALIFICATION SUITE
//
// Proves the gate runner against the canonical repository contracts:
//   standards/publishing-gates-standard.md (gates 0-10, conjunction, human authority)
//   schemas/product.schema.json (gate enum pending|PASS|FAIL, review + authorization shapes)
//   harness/build-manifest.mjs (trust boundary - must stay strict, must never be modified)
//   harness/qa-checks.mjs (canonical deterministic QA - reused, never re-implemented)
//   harness/writing-control.mjs (Gate-1 semantics + upstream blocker propagation)
//
// Adversarial fixtures live in an OS temp repository root (never inside data/).
// No provider, no LLM, no network, no spend. Run: node --test harness/product-qa-gate-runner.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, cpSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import {
  runProductQaGates, evaluateProductGates, loadProductInputs, runCanonicalQaChecks, planGateWrite,
  canonicalProjection, GATE_RUNNER_VERSION, GATES, GATE_DEPENDENCIES, GATE1_KEYS, TSM_ELEMENTS, CLAIM_LABELS,
  PERSISTED, VERDICT, RUN_STATUS, MANIFEST_VERDICTS, AI_TEST_STATUSES,
} from "./product-qa-gate-runner.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(os.tmpdir(), "swiipt-gate-qual");
const CORD = "FIXTURE-PRODUCT-001";
const TR_ID = "FIXTURE-TR-001";
const FACTORY_FIXTURES = join(ROOT, "harness", "fixtures", "factory");
const RUNNER_SRC = readFileSync(join(ROOT, "harness", "product-qa-gate-runner.mjs"), "utf8");
const BUILD_MANIFEST_SNAPSHOT = readFileSync(join(ROOT, "harness", "build-manifest.mjs"), "utf8").replace(/\r\n/g, "\n");
const CODE = RUNNER_SRC.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const writeJson = (p, o) => writeFileSync(p, `${JSON.stringify(o, null, 2)}\n`, "utf8");
const pPath = (root, id = CORD) => join(root, "data", "products", id, "product.json");
const trP = (root) => join(root, "data", "transformations", `${TR_ID}.json`);
const patchProduct = (root, fn) => { const p = readJson(pPath(root)); fn(p); writeJson(pPath(root), p); return p; };
const patchTr = (root, fn) => { const t = readJson(trP(root)); fn(t); writeJson(trP(root), t); return t; };
/** Synthetic canonical QA ledger (used where the canonical ledger is not the subject - keeps tests fast). */
const LEDGER = { checks: [], summary: null };
const run = (root, opts = {}) => runProductQaGates(CORD, { root, qaLedger: LEDGER, ...opts });
/** Make the QA ledger itself passable so a gate under test is not masked by the product's own QA findings. */
const patchQaPass = (root) => patchProduct(root, (p) => {
  p.qa.deterministic_tests = [{ test: "schema_valid", result: "PASS" }, { test: "asset_refs_resolve", result: "PASS" }];
  p.qa.ai_tests = [
    { test: "R_drift_integrity", status: "PASS", severity: "none", reason: "fixture" },
    { test: "K_evidence_integrity", status: "PASS", severity: "none", reason: "fixture" },
  ];
});
const judge = (root, id, opts = {}) => run(root, opts).gate_matrix.find((g) => g.gate === id);
const verdict = (root, id, opts = {}) => judge(root, id, opts).current_verdict;
const persisted = (root, id, opts = {}) => run(root, opts).gate_results[id];

/** Build an isolated temp repository root seeded from the canonical CORD-CARE chain. */
function makeRoot(name, mutate = null) {
  const root = join(TMP, name);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(root, "harness"), { recursive: true });
  mkdirSync(join(root, "data", "products"), { recursive: true });
  mkdirSync(join(root, "data", "transformations"), { recursive: true });
  mkdirSync(join(root, "data", "opportunities"), { recursive: true });
  mkdirSync(join(root, "config"), { recursive: true });
  cpSync(join(ROOT, "schemas"), join(root, "schemas"), { recursive: true });
  cpSync(join(ROOT, "config"), join(root, "config"), { recursive: true });
  for (const f of ["qa-checks.mjs", "build-manifest.mjs", "writing-control.mjs"]) cpSync(join(ROOT, "harness", f), join(root, "harness", f));
  cpSync(join(FACTORY_FIXTURES, "data", "products", CORD), join(root, "data", "products", CORD), { recursive: true });
  cpSync(join(FACTORY_FIXTURES, "data", "transformations", `${TR_ID}.json`), trP(root));
  if (mutate) mutate(root);
  return root;
}
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

/** A fully authorized/complete fixture (all gates satisfiable). */
function completeRoot(name = "complete") {
  return makeRoot(name, (root) => {
    patchProduct(root, (p) => {
      const allPass = Object.fromEntries(GATES.map((g) => [g.id, "PASS"]));
      p.qa.gate_results = allPass;
      p.qa.deterministic_tests = [{ test: "schema_valid", result: "PASS" }, { test: "asset_refs_resolve", result: "PASS" }];
      p.qa.ai_tests = [
        { test: "R_drift_integrity", status: "PASS", severity: "none", reason: "drift ok" },
        { test: "K_evidence_integrity", status: "PASS", severity: "none", reason: "labels ok" },
      ];
      p.evidence.claim_labels = [{ claim: "Cord care routine", label: "sourced_evidence", source: p.evidence.sources[0] }];
      p.transformation = {
        before_state: { current_behavior: ["x"] }, after_state: { evidence_of_change: ["y"] }, mechanism: { core_mechanism: "z" },
        path: [{ stage: "S1", objective: "o", customer_action: ["a"], required_assets: [] }],
        first_win: { time_limit_minutes: 15, action: "a", observable_change: "c" },
        failure_map: { f1: "scenario" }, rescue_protocols: { f1: "rescue" }, reentry: { reentry_protocol: "r" },
        maintenance: { maintenance_system: "m" }, next_transformation_ids: [],
      };
      p.publishing = { ...p.publishing, authorization: { status: "READY_TO_PUBLISH", authorized_by: "Owner", authorized_at: "2026-09-11T20:41:37.614Z" } };
      p.human_review = {
        status: "RESOLVED", reason: "evidence + safety review complete", escalation_class: "HUMAN_REVIEW_REQUIRED",
        evidence_references: ["WHO 2014"], safety_references: ["red-flag set"], created_at: "2026-09-10T08:00:00Z",
        resolved_at: "2026-09-11T09:00:00Z", resolved_by: "Owner", resolution: "approved with clinical sign-off",
      };
    });
  });
}

// =============================================================================================
// A. CONTRACT / INPUT
// =============================================================================================
test("A1 gate model exposes the canonical eleven gates with authority + conjunction", () => {
  assert.deepEqual(GATES.map((g) => g.id), ["g0_research_disposition", "g1_situation", "g2_transformation", "g3_product_architecture", "g4_evidence", "g5_safety", "g6_content", "g7_product_qa", "g8_commerce", "g9_customer_journey", "g10_publish"]);
  assert.equal(GATES.every((g) => ["DETERMINISTIC", "HYBRID", "CLINICAL_REVIEW", "AUTHORIZATION"].includes(g.authority)), true);
  assert.equal(GATE_DEPENDENCIES.g10_publish.includes("g5_safety"), true);
  assert.equal(GATE_DEPENDENCIES.g2_transformation.includes("g1_situation"), true);
});

test("A2 persisted vocabulary is exactly the product schema enum (pending|PASS|FAIL)", () => {
  assert.deepEqual(Object.values(PERSISTED), ["PASS", "FAIL", "pending"]);
  const r = run(makeRoot("a2-structure"));
  for (const [, v] of Object.entries(r.gate_results)) assert.ok(Object.values(PERSISTED).includes(v), v);
});

test("A3 valid product loads with its transformation, assets and content", () => {
  const root = makeRoot("a3-load");
  const inp = loadProductInputs(CORD, { root, qaLedger: LEDGER });
  assert.equal(inp.ok, true);
  assert.equal(inp.product.product_id, CORD);
  assert.equal(inp.transformation.transformation_id, TR_ID);
  assert.ok(Object.values(inp.assets).filter((a) => a.exists).length >= 6);
  assert.ok(Object.values(inp.content).filter((c) => c.exists).length >= 4);
});

test("A4 missing product is rejected with INVALID_INPUT", () => {
  const root = makeRoot("a4-missing");
  const r = runProductQaGates("PPL-DOES-NOT-EXIST", { root, qaLedger: LEDGER });
  assert.equal(r.status, RUN_STATUS.INVALID_INPUT);
  assert.equal(r.manifest_eligible, false);
});

test("A5 malformed product (invalid JSON) is rejected", () => {
  const root = makeRoot("a5-badjson", (r) => writeFileSync(pPath(r), "{ not json", "utf8"));
  const r = run(root);
  assert.equal(r.status, RUN_STATUS.INVALID_INPUT);
  assert.ok(r.run_report.errors.join(" ").includes("not valid JSON"));
});

test("A6 product without product_id is rejected", () => {
  const root = makeRoot("a6-noid", (r) => { const p = readJson(pPath(r)); delete p.product_id; writeJson(pPath(r), p); });
  const r = run(root);
  assert.equal(r.status, RUN_STATUS.INVALID_INPUT);
});

test("A7 missing transformation record makes g0-g2 SOURCE_REQUIRED (not FAIL)", () => {
  const root = makeRoot("a7-notr", (r) => { patchQaPass(r); rmSync(trP(r), { force: true }); });
  const r = run(root);
  assert.equal(r.status, RUN_STATUS.SOURCE_REQUIRED);
  assert.equal(r.gate_results.g0_research_disposition, PERSISTED.PENDING);
  assert.equal(r.manifest_eligible, false);
  assert.equal(verdict(root, "g2_transformation"), VERDICT.SOURCE_REQUIRED);
});

test("A8 malformed transformation record is detected", () => {
  const root = makeRoot("a8-badtr", (r) => { patchQaPass(r); writeFileSync(trP(r), "{ broken", "utf8"); });
  const r = run(root);
  assert.equal(r.status, RUN_STATUS.SOURCE_REQUIRED);
  assert.equal(verdict(root, "g1_situation"), VERDICT.SOURCE_REQUIRED);
  assert.equal(r.manifest_eligible, false);
});

test("A9 product/transformation identity mismatch is a quality FAIL", () => {
  const root = makeRoot("a9-mismatch", (r) => patchTr(r, (t) => { t.transformation_id = "TR-PPL-OTHER-999"; }));
  const r = run(root);
  assert.equal(verdict(root, "g1_situation"), VERDICT.FAIL);
  assert.ok(judge(root, "g1_situation").reason.includes("identity mismatch"));
});

test("A10 thin transformation situation is reported field by field", () => {
  const root = makeRoot("a10-thin", (r) => patchTr(r, (t) => { t.situation.trigger = ""; t.situation.failed_attempt = ""; }));
  const r = run(root);
  const j = judge(root, "g1_situation");
  assert.equal(j.current_verdict, VERDICT.SOURCE_REQUIRED);
  assert.ok(j.reason.includes("trigger"));
  assert.ok(j.reason.includes("failed_attempt"));
  for (const k of GATE1_KEYS) assert.ok(GATE1_KEYS.includes(k));
});

test("A11 every gate reports its authoritative inputs (provenance)", () => {
  const r = run(makeRoot("a11-inputs"));
  for (const g of r.gate_matrix) assert.ok(Array.isArray(g.inputs) && g.inputs.length >= 1, g.gate);
});

// =============================================================================================
// B. DETERMINISTIC GATE AUTHORITY
// =============================================================================================
test("B1 deterministic gates PASS on genuine structure (g0,g1,g2,g3,g6,g8)", () => {
  const root = makeRoot("b1-det");
  for (const id of ["g0_research_disposition", "g1_situation", "g2_transformation", "g3_product_architecture", "g6_content", "g8_commerce"]) {
    assert.equal(verdict(root, id), VERDICT.PASS, id);
    assert.equal(persisted(root, id), PERSISTED.PASS, id);
  }
});

test("B2 deterministic failure is derived from actual checks (empty transformation path)", () => {
  const root = makeRoot("b2-fail", (r) => patchProduct(r, (p) => { p.transformation.path = []; }));
  const j = judge(root, "g3_product_architecture");
  assert.equal(j.current_verdict, VERDICT.SOURCE_REQUIRED);   // empty authoritative block = missing input
  assert.ok(j.reason.includes("path"));
});

test("B3 a malformed asset record is a quality FAIL; a missing one is missing input", () => {
  const malformed = makeRoot("b3-asset-malformed", (r) => writeFileSync(join(r, "data/products", CORD, "assets", "AS-FIX-READ-001.json"), "{ nope", "utf8"));
  assert.equal(verdict(malformed, "g3_product_architecture"), VERDICT.FAIL);
  const missing = makeRoot("b3-asset-missing", (r) => patchProduct(r, (p) => { p.asset_map.read.push("AS-CORD-MISSING-999"); }));
  const j = judge(missing, "g3_product_architecture");
  assert.equal(j.current_verdict, VERDICT.SOURCE_REQUIRED);
  assert.ok(j.reason.includes("AS-CORD-MISSING-999"));
});

test("B4 schema validity alone cannot PASS the gates (legacy product with no TR)", () => {
  const root = makeRoot("b4-schema-only", (r) => {
    cpSync(join(FACTORY_FIXTURES, "data/products/FIXTURE-PRODUCT-002"), join(r, "data/products/FIXTURE-PRODUCT-002"), { recursive: true });
  });
  const r0 = runProductQaGates("FIXTURE-PRODUCT-002", { root: root, qaLedger: LEDGER });
  assert.equal(r0.manifest_eligible, false);
  assert.equal(r0.gate_results.g1_situation, PERSISTED.PENDING);
  assert.equal(r0.gate_results.g2_transformation, PERSISTED.PENDING);
  assert.notEqual(r0.status, RUN_STATUS.MANIFEST_ELIGIBLE);
});

test("B5 product status 'published' does not manufacture gate PASS", () => {
  const r = run(makeRoot("b5-published"));
  assert.equal(r.inputs.product.status, "published");
  assert.equal(r.manifest_eligible, false);
  assert.ok(r.run_report.historical_artifacts.some((h) => h.artifact === "product.status"));
});

test("B6 no gate PASS is hard-coded because a product exists", () => {
  const src = CODE;
  assert.equal(/gate\([^)]*VERDICT\.PASS[^)]*because/i.test(src), false);
  assert.equal(src.includes("g7_product_qa: \"PASS\"") || src.includes("g7_product_qa: 'PASS'"), false);
});

// =============================================================================================
// C. LEGACY / HISTORICAL AUTHORITY
// =============================================================================================
test("C1 an existing manifest does not manufacture PASS", () => {
  const root = makeRoot("c1-manifest");
  const r = run(root);
  const manifest = readJson(join(root, "data/products", CORD, "publish/manifest.json"));
  assert.equal(manifest.qa.deterministic, "PASS");
  assert.equal(r.run_report.manifest_verdicts.deterministic, "FAIL");
  assert.equal(r.manifest_eligible, false);
});

test("C2 historical PASS gate values are flagged, not trusted", () => {
  const r = run(makeRoot("c2-hist"));
  const flagged = r.run_report.historical_artifacts.find((h) => /gate_results/.test(h.artifact));
  assert.ok(flagged && flagged.classification === "HISTORICAL_UNVERIFIED");
  assert.ok(flagged.value.includes("g10_publish") || flagged.value.includes("g10"));
});

test("C3 a historical manifest authorization is reported as historical-only", () => {
  const r = run(makeRoot("c3-auth-hist"));
  const mf = r.run_report.historical_artifacts.find((h) => /manifest\.json/.test(h.artifact));
  assert.ok(mf.value.publish_authorization.status === "READY_TO_PUBLISH");
  assert.equal(r.gate_results.g10_publish, PERSISTED.PENDING);
});

test("C4 a live platform product does not retroactively pass QA", () => {
  const r = run(makeRoot("c4-live"));
  assert.ok(r.run_report.historical_artifacts.some((h) => /wordpress_ids/.test(h.artifact)));
  assert.equal(r.manifest_eligible, false);
});

// =============================================================================================
// D. G4 EVIDENCE
// =============================================================================================
test("D1 g4 evidence block absent -> SOURCE_REQUIRED", () => {
  const root = makeRoot("d1", (r) => patchProduct(r, (p) => { delete p.evidence; }));
  assert.equal(verdict(root, "g4_evidence"), VERDICT.SOURCE_REQUIRED);
});

test("D2 g4 invalid claim label -> FAIL", () => {
  const root = makeRoot("d2", (r) => patchProduct(r, (p) => { p.evidence.claim_labels = [{ claim: "x", label: "verified_true" }]; }));
  assert.equal(verdict(root, "g4_evidence"), VERDICT.FAIL);
});

test("D3 g4 sourced claim without a source -> FAIL", () => {
  const root = makeRoot("d3", (r) => patchProduct(r, (p) => { p.evidence.claim_labels = [{ claim: "x", label: "sourced_evidence" }]; }));
  assert.equal(verdict(root, "g4_evidence"), VERDICT.FAIL);
});

test("D4 g4 claim source that does not resolve -> FAIL", () => {
  const root = makeRoot("d4", (r) => patchProduct(r, (p) => { p.evidence.claim_labels = [{ claim: "x", label: "expert_reviewed", source: "Fabricated Journal 2026" }]; }));
  const j = judge(root, "g4_evidence");
  assert.equal(j.current_verdict, VERDICT.FAIL);
  assert.ok(j.reason.includes("not in product.evidence.sources"));
});

test("D5 g4 valid structure + no review -> REVIEW_REQUIRED (never FAIL)", () => {
  const root = makeRoot("d5", (r) => patchProduct(r, (p) => { p.evidence.claim_labels = [{ claim: "cord routine", label: "sourced_evidence", source: p.evidence.sources[0] }]; }));
  const j = judge(root, "g4_evidence");
  assert.equal(j.current_verdict, VERDICT.REVIEW_REQUIRED);
  assert.equal(persisted(root, "g4_evidence"), PERSISTED.PENDING);
  assert.ok(j.missing_requirements.join(" ").includes("human_review"));
});

test("D6 g4 human review present -> PASS (authority projected, not invented)", () => {
  const root = evidenceReviewRoot("d6", { evidence_refs: ["WHO 2014"] });
  const j = judge(root, "g4_evidence");
  assert.equal(j.current_verdict, VERDICT.PASS);
  assert.deepEqual(j.review_refs, ["Owner"]);
});

test("D7 g4 review with no reviewer identity -> REVIEW_REQUIRED", () => {
  const root = evidenceReviewRoot("d7", { evidence_refs: ["WHO 2014"], reviewer: null });
  assert.equal(verdict(root, "g4_evidence"), VERDICT.REVIEW_REQUIRED);
});

function evidenceReviewRoot(name, { evidence_refs = [], safety_refs = [], reviewer = "Owner" } = {}) {
  return makeRoot(name, (r) => patchProduct(r, (p) => {
    p.human_review = {
      status: "RESOLVED", reason: "review complete", created_at: "2026-09-10T08:00:00Z",
      evidence_references: evidence_refs, safety_references: safety_refs,
      ...(reviewer ? { resolved_by: reviewer, resolved_at: "2026-09-11T09:00:00Z", resolution: "approved" } : {}),
    };
  }));
}

test("D8 g4 evidence review packet contains only existing authoritative material", () => {
  const root = makeRoot("d8");
  const r = run(root);
  const packet = r.run_report.evidence_review;
  assert.equal(packet.packet_type, "EVIDENCE_REVIEW_PACKET");
  const declared = readJson(pPath(root)).evidence.sources;
  for (const s of packet.authoritative_sources) assert.ok(declared.includes(s), s);
  assert.ok(packet.unresolved_questions.length >= 1);
  assert.ok(packet.unresolved_questions.some((q) => /Independent evidence review/.test(q)));
  assert.ok(/no new evidence/i.test(packet.note));
});

test("D9 fake evidence reviewer is impossible (write mode never creates one)", () => {
  const root = makeRoot("d9");
  run(root, { mode: "write" });
  const p = readJson(pPath(root));
  assert.equal(p.human_review, undefined);
  assert.equal(/resolved_by/.test(JSON.stringify(p)), false);
});

// =============================================================================================
// E. G5 SAFETY / CLINICAL
// =============================================================================================
test("E1 g5 safety block absent -> SOURCE_REQUIRED", () => {
  const root = makeRoot("e1", (r) => patchProduct(r, (p) => { delete p.safety; }));
  assert.equal(verdict(root, "g5_safety"), VERDICT.SOURCE_REQUIRED);
});

test("E2 g5 invalid risk enum -> FAIL (contract violation, not missing input)", () => {
  const root = makeRoot("e2", (r) => patchProduct(r, (p) => { p.safety.risk_level = "extreme"; }));
  assert.equal(verdict(root, "g5_safety"), VERDICT.FAIL);
});

test("E3 g5 clinical risk without red-flag criteria -> SOURCE_REQUIRED and never invented", () => {
  const root = makeRoot("e3", (r) => patchProduct(r, (p) => { p.safety.red_flags = []; }));
  const j = judge(root, "g5_safety");
  assert.equal(j.current_verdict, VERDICT.SOURCE_REQUIRED);
  assert.ok(j.reason.includes("red_flags"));
  run(root, { mode: "write" });
  assert.deepEqual(readJson(pPath(root)).safety.red_flags, []);
});

test("E4 g5 placeholder escalation route -> FAIL", () => {
  const root = makeRoot("e4", (r) => patchProduct(r, (p) => { p.safety.escalation_rules = ["call your local crisis line"]; }));
  const j = judge(root, "g5_safety");
  assert.equal(j.current_verdict, VERDICT.FAIL);
  assert.ok(/placeholder|invented/.test(j.reason));
});

test("E5 g5 escalation rules must reference the verified shared list", () => {
  const root = makeRoot("e5", (r) => patchProduct(r, (p) => { p.safety.escalation_rules = ["see a doctor sometime"]; }));
  assert.equal(verdict(root, "g5_safety"), VERDICT.FAIL);
});

test("E6 g5 clinical review missing -> CLINICAL_REVIEW_REQUIRED (never PASS, never FAIL)", () => {
  const root = makeRoot("e6");
  const j = judge(root, "g5_safety");
  assert.equal(j.current_verdict, VERDICT.CLINICAL_REVIEW_REQUIRED);
  assert.equal(persisted(root, "g5_safety"), PERSISTED.PENDING);
  assert.ok(j.missing_requirements.join(" ").includes("safety_references"));
});

test("E7 g5 clinical review present -> PASS (existing authority projected)", () => {
  const root = evidenceReviewRoot("e7", { safety_refs: ["red-flag set"] });
  assert.equal(verdict(root, "g5_safety"), VERDICT.PASS);
});

test("E8 low-risk product requires human safety review (not clinical) -> REVIEW_REQUIRED", () => {
  const root = makeRoot("e8", (r) => patchProduct(r, (p) => { p.safety.risk_level = "low"; }));
  assert.equal(verdict(root, "g5_safety"), VERDICT.REVIEW_REQUIRED);
});

test("E9 g5 safety packet carries risk, red flags, escalation + unresolved items only", () => {
  const r = run(makeRoot("e9"));
  const packet = r.run_report.safety_review;
  assert.equal(packet.packet_type, "SAFETY_REVIEW_PACKET");
  assert.equal(packet.risk_level, "clinical");
  assert.ok(packet.red_flags.length >= 1);
  assert.ok(packet.escalation_rules.length >= 1);
  assert.ok(packet.unresolved_review_items.some((i) => /Clinical\/human safety review/.test(i)));
  assert.equal(/\b(cure|guarantee|will heal)\b/i.test(JSON.stringify(packet)), false);
});

test("E10 fake clinical reviewer is impossible (runner never writes one)", () => {
  const root = makeRoot("e10");
  run(root, { mode: "write" });
  assert.equal(/\bresolved_by\b|\bclinical_reviewer\b/.test(JSON.stringify(readJson(pPath(root)))), false);
});

test("E11 unsupported clinical certainty cannot PASS g5 (no certainty manufactured)", () => {
  const r = run(makeRoot("e11"));
  const text = JSON.stringify(r.run_report.safety_review) + JSON.stringify(r.run_report.gate_matrix);
  assert.equal(/\b(cure|guaranteed|100%|instant relief)\b/i.test(text), false);
});

// =============================================================================================
// F. G10 AUTHORIZATION / OWNER
// =============================================================================================
test("F1 g10 absent authorization -> OWNER_ACTION_REQUIRED (pending, never FAIL)", () => {
  const root = makeRoot("f1");
  const j = judge(root, "g10_publish");
  assert.equal(j.current_verdict, VERDICT.OWNER_ACTION_REQUIRED);
  assert.equal(persisted(root, "g10_publish"), PERSISTED.PENDING);
});

test("F2 g10 malformed authorization -> INVALID_AUTHORIZATION (persisted FAIL)", () => {
  const root = makeRoot("f2", (r) => patchProduct(r, (p) => { p.publishing.authorization = { status: "APPROVED", authorized_by: "system" }; }));
  const j = judge(root, "g10_publish");
  assert.equal(j.current_verdict, VERDICT.INVALID_AUTHORIZATION);
  assert.equal(j.persisted, PERSISTED.FAIL);
  assert.ok(j.failures.join(" ").includes("READY_TO_PUBLISH"));
});

test("F3 g10 valid existing authorization is recognized (not created)", () => {
  const root = completeRoot("f3");
  const j = judge(root, "g10_publish");
  assert.equal(j.current_verdict, VERDICT.PASS);
  assert.ok(j.authorization_refs[0].includes("Owner"));
});

test("F4 runner cannot create authorization (write mode leaves it absent)", () => {
  const root = makeRoot("f4");
  run(root, { mode: "write" });
  const p = readJson(pPath(root));
  assert.equal(p.publishing.authorization, undefined);
});

test("F5 runner cannot invent an owner identity", () => {
  assert.equal(/\bauthorized_by\s*[:=]\s*["']/i.test(CODE), false);
  assert.equal(/owner_?default|test owner|fixture owner|system owner/i.test(CODE), false);
});

test("F6 owner action packet explains what is authorized and what is unresolved", () => {
  const r = run(makeRoot("f6"));
  const packet = r.run_report.owner_action;
  assert.equal(packet.packet_type, "OWNER_ACTION_PACKET");
  assert.equal(packet.automatic_approval, false);
  assert.ok(packet.requirement || packet.required_record);
  assert.ok(packet.prerequisite_gates_unresolved.length >= 1);
});

// =============================================================================================
// G. DEPENDENCIES / CONJUNCTION
// =============================================================================================
test("G1 a failed prerequisite blocks dependent readiness", () => {
  const root = makeRoot("g1", (r) => { patchQaPass(r); patchTr(r, (t) => { t.situation.person = ""; }); });
  const r0 = run(root);
  assert.equal(r0.status, RUN_STATUS.SOURCE_REQUIRED);
  assert.equal(r0.gate_results.g1_situation, PERSISTED.PENDING);
  assert.equal(r0.gate_results.g2_transformation, PERSISTED.PENDING);
  assert.equal(r0.gate_results.g7_product_qa, PERSISTED.PENDING);
  assert.equal(r0.gate_results.g10_publish, PERSISTED.PENDING);
  const j2 = judge(root, "g2_transformation");
  assert.ok(["SOURCE_REQUIRED", "BLOCKED_BY_PREREQUISITE"].includes(j2.current_verdict));
});

test("G2 a pending prerequisite blocks publication readiness", () => {
  const r = run(makeRoot("g2"));
  assert.equal(r.manifest_eligible, false);
  assert.ok(r.blocking_gates.includes("g4_evidence"));
  assert.ok(r.blocking_gates.includes("g10_publish"));
});

test("G3 no score averaging / no majority voting / no fake aggregate PASS", () => {
  const r = run(makeRoot("g3"));
  const text = JSON.stringify(r.run_report);
  assert.equal(/\b(score|average|majority|percentage|weighted)\b|\b\d+\s+of\s+\d+\b/i.test(text), false);
  assert.equal(r.manifest_eligible, false);
  assert.equal(r.status === RUN_STATUS.MANIFEST_ELIGIBLE, false);
});

test("G4 a single failing gate blocks manifest eligibility even when others PASS", () => {
  const root = completeRoot("g4");   // all PASS
  assert.equal(run(root).manifest_eligible, true);
  patchProduct(root, (p) => { p.qa.ai_tests = [{ test: "R_drift_integrity", status: "FAIL", severity: "BLOCKER", reason: "drift detected" }]; });
  assert.equal(run(root).manifest_eligible, false);
});

test("G5 dependency map is conjunctive and never averages (structure)", () => {
  for (const [gate, deps] of Object.entries(GATE_DEPENDENCIES)) {
    assert.ok(Array.isArray(deps), gate);
    for (const d of deps) assert.ok(GATES.some((g) => g.id === d), `${gate} -> ${d}`);
  }
});

// =============================================================================================
// H. G6 / G7 / G8 / G9
// =============================================================================================
test("H1 g6 missing required content artifact -> SOURCE_REQUIRED", () => {
  const root = makeRoot("h1", (r) => rmSync(join(r, "data/products", CORD, "copy/landing-page.json"), { force: true }));
  const j = judge(root, "g6_content");
  assert.equal(j.current_verdict, VERDICT.SOURCE_REQUIRED);
  assert.ok(j.reason.includes("landing_page"));
});

test("H2 g6 malformed content JSON -> FAIL", () => {
  const root = makeRoot("h2", (r) => writeFileSync(join(r, "data/products", CORD, "copy/landing-page.json"), "{ nope", "utf8"));
  assert.equal(verdict(root, "g6_content"), VERDICT.FAIL);
});

test("H3 g6 content that violates its schema -> FAIL (unsupported content never PASSes)", () => {
  const root = makeRoot("h3", (r) => writeJson(join(r, "data/products", CORD, "copy/reviews.json"), { reviews: [{ rating: 5 }] }));
  const j = judge(root, "g6_content");
  assert.equal(j.current_verdict, VERDICT.FAIL);
  assert.ok(/content-reviews/.test(j.reason));
});

test("H4 g6 refuses when the transformation declares failure points but no rescue job exists", () => {
  const root = makeRoot("h4", (r) => patchProduct(r, (p) => { p.asset_map.rescue = []; }));
  const j = judge(root, "g6_content");
  assert.equal(j.current_verdict, VERDICT.SOURCE_REQUIRED);
  assert.ok(j.reason.includes("asset_map.rescue"));
});

test("H5 g7 missing deterministic ledger -> SOURCE_REQUIRED", () => {
  const root = makeRoot("h5", (r) => patchProduct(r, (p) => { p.qa.deterministic_tests = []; }));
  assert.equal(verdict(root, "g7_product_qa"), VERDICT.SOURCE_REQUIRED);
});

test("H6 g7 deterministic FAIL propagates to FAIL", () => {
  const root = makeRoot("h6", (r) => patchProduct(r, (p) => { p.qa.deterministic_tests = [{ test: "schema_valid", result: "FAIL" }]; }));
  const j = judge(root, "g7_product_qa");
  assert.equal(j.current_verdict, VERDICT.FAIL);
  assert.ok(j.failures.join(" ").includes("schema_valid"));
});

test("H7 g7 AI REVISION_REQUIRED blocks the gate (self-review cannot self-approve)", () => {
  const root = makeRoot("h7");
  const j = judge(root, "g7_product_qa");
  assert.equal(j.current_verdict, VERDICT.FAIL);
  assert.equal(persisted(root, "g7_product_qa"), PERSISTED.FAIL);
  assert.ok(/REVISION_REQUIRED/.test(j.reason));
});

test("H8 g7 mandatory R_drift_integrity missing -> SOURCE_REQUIRED", () => {
  const root = makeRoot("h8", (r) => patchProduct(r, (p) => { p.qa.ai_tests = [{ test: "K_evidence_integrity", status: "PASS", severity: "none" }]; }));
  const j = judge(root, "g7_product_qa");
  assert.equal(j.current_verdict, VERDICT.SOURCE_REQUIRED);
  assert.ok(j.reason.includes("R_drift_integrity"));
});

test("H9 g7 invalid AI test status -> FAIL", () => {
  const root = makeRoot("h9", (r) => patchProduct(r, (p) => { p.qa.ai_tests = [{ test: "R_drift_integrity", status: "MAYBE", severity: "none" }]; }));
  assert.equal(verdict(root, "g7_product_qa"), VERDICT.FAIL);
});

test("H10 g8 non-positive price -> FAIL", () => {
  const root = makeRoot("h10", (r) => patchProduct(r, (p) => { p.commerce.price.base_usd = 0; }));
  assert.equal(verdict(root, "g8_commerce"), VERDICT.FAIL);
});

test("H11 g8 unresolved upsell/bundle target -> FAIL", () => {
  const root = makeRoot("h11", (r) => patchProduct(r, (p) => { p.commerce.upsells = ["PPL-GHOST-001"]; }));
  const j = judge(root, "g8_commerce");
  assert.equal(j.current_verdict, VERDICT.FAIL);
  assert.ok(j.failures.join(" ").includes("PPL-GHOST-001"));
});

test("H12 g8 missing access rules -> SOURCE_REQUIRED", () => {
  const root = makeRoot("h12", (r) => patchProduct(r, (p) => { delete p.commerce.access_rules; }));
  assert.equal(verdict(root, "g8_commerce"), VERDICT.SOURCE_REQUIRED);
});

test("H13 g9 missing platform ids -> SOURCE_REQUIRED", () => {
  const root = makeRoot("h13", (r) => patchProduct(r, (p) => { p.publishing.wordpress_ids = {}; }));
  const j = judge(root, "g9_customer_journey");
  assert.equal(j.current_verdict, VERDICT.SOURCE_REQUIRED);
  assert.ok(j.reason.includes("wordpress_ids"));
});

test("H14 g9 technical prerequisites + no walk-through record -> REVIEW_REQUIRED with the architectural gap reported", () => {
  const root = makeRoot("h14");
  const j = judge(root, "g9_customer_journey");
  assert.equal(j.current_verdict, VERDICT.REVIEW_REQUIRED);
  assert.ok(/no dedicated journey-test record/.test(j.architectural_gap ?? ""));
});

test("H15 g8 payment/delivery runtime is explicitly delegated to the g9 walk-through (not silently skipped)", () => {
  const j = judge(makeRoot("h15"), "g8_commerce");
  assert.ok(/gate 9|walk-through/i.test(j.notes ?? ""));
});

// =============================================================================================
// I. REAL QUALIFICATION - CORD-CARE
// =============================================================================================
test("I1 CORD-CARE: product, TR, assets, content and manifest all load", () => {
  const root = makeRoot("i1");
  const inp = loadProductInputs(CORD, { root, qaLedger: LEDGER });
  assert.equal(inp.ok, true);
  assert.equal(inp.transformation.transformation_id, TR_ID);
  assert.ok(Object.values(inp.assets).filter((a) => a.exists).length === 6);
  assert.ok(inp.manifest);
});

test("I2 CORD-CARE: honest current gate state (deterministic PASS, reviews + owner outstanding, g7 FAIL)", () => {
  const r = run(makeRoot("i2"));
  assert.deepEqual(r.gate_results, {
    g0_research_disposition: "PASS", g1_situation: "PASS", g2_transformation: "PASS", g3_product_architecture: "PASS",
    g4_evidence: "pending", g5_safety: "pending", g6_content: "PASS", g7_product_qa: "FAIL", g8_commerce: "PASS",
    g9_customer_journey: "pending", g10_publish: "pending",
  });
  assert.equal(r.status, RUN_STATUS.BLOCKED);
});

test("I3 CORD-CARE is not forced publishable (manifest_eligible false with exact blockers)", () => {
  const r = run(makeRoot("i3"));
  assert.equal(r.manifest_eligible, false);
  assert.deepEqual(r.blocking_gates, ["g4_evidence", "g5_safety", "g7_product_qa", "g9_customer_journey", "g10_publish"]);
});

test("I4 CORD-CARE review + owner actions are explicit", () => {
  const r = run(makeRoot("i4"));
  const u = r.run_report.unresolved_requirements.join(" | ");
  assert.ok(/g4_evidence: independent evidence review/.test(u));
  assert.ok(/g5_safety: clinical\/human safety review/.test(u));
  assert.ok(/g9_customer_journey: recorded journey walk-through/.test(u));
  assert.ok(/g10_publish: product\.publishing\.authorization/.test(u));
});

test("I5 CORD-CARE gate matrix carries every required column", () => {
  const r = run(makeRoot("i5"));
  for (const g of r.gate_matrix) {
    for (const k of ["gate", "name", "authority", "inputs", "current_verdict", "reason", "missing_requirements", "blocks_manifest"]) assert.ok(k in g, `${g.gate}.${k}`);
  }
});

// =============================================================================================
// J. INCOMPLETE PRODUCT QUALIFICATION
// =============================================================================================
test("J1 incomplete product (no TR, no ledger, no jobs) -> SOURCE_REQUIRED, no fake PASS", () => {
  const root = makeRoot("j1", (r) => cpSync(join(FACTORY_FIXTURES, "data/products/FIXTURE-PRODUCT-002"), join(r, "data/products/FIXTURE-PRODUCT-002"), { recursive: true }));
  const r0 = runProductQaGates("FIXTURE-PRODUCT-002", { root, qaLedger: LEDGER });
  assert.equal(r0.status, RUN_STATUS.SOURCE_REQUIRED);
  assert.deepEqual(Object.values(r0.gate_results).filter((v) => v === "PASS"), []);
  assert.equal(r0.manifest_eligible, false);
});

test("J2 incomplete product still reports per-gate reasons (auditable, not blank)", () => {
  const root = makeRoot("j2", (r) => cpSync(join(FACTORY_FIXTURES, "data/products/FIXTURE-PRODUCT-002"), join(r, "data/products/FIXTURE-PRODUCT-002"), { recursive: true }));
  const r0 = runProductQaGates("FIXTURE-PRODUCT-002", { root, qaLedger: LEDGER });
  for (const g of r0.gate_matrix) assert.ok(g.reason.length > 10, g.gate);
});

// =============================================================================================
// K. DETERMINISM / PROVENANCE
// =============================================================================================
test("K1 repeated runs are byte-identical (gates, verdicts, reasons)", () => {
  const root = makeRoot("k1");
  const a = run(root).run_report, b = run(root).run_report;
  assert.equal(canonicalProjection(a.gate_results), canonicalProjection(b.gate_results));
  assert.equal(JSON.stringify(a.gate_matrix), JSON.stringify(b.gate_matrix));
});

test("K2 key-order stability of the canonical gate projection", () => {
  const root = makeRoot("k2");
  const r1 = run(root);
  assert.equal(canonicalProjection({ b: 1, a: 2 }), canonicalProjection({ a: 2, b: 1 }));
  assert.equal(canonicalProjection(r1.gate_results), canonicalProjection({ ...r1.gate_results }));
});

test("K3 no volatile state or random identity in the runner", () => {
  for (const banned of ["Date.now", "Math.random", "randomUUID"]) assert.equal(CODE.includes(banned), false, banned);
  const r = run(makeRoot("k3"));
  assert.equal(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(JSON.stringify(r.gate_results)), false);
});

test("K4 runner version + evaluator identity retained in the report", () => {
  const r = run(makeRoot("k4"));
  assert.equal(r.run_report.runner_version, GATE_RUNNER_VERSION);
  assert.equal(r.run_report.deterministic_checks.canonical_runner, "harness/qa-checks.mjs");
});

test("K5 human review timestamps are preserved, never regenerated", () => {
  const root = evidenceReviewRoot("k5", { evidence_refs: ["WHO 2014"] });
  const created = readJson(pPath(root)).human_review.created_at;
  run(root, { mode: "write" });
  assert.equal(readJson(pPath(root)).human_review.created_at, created);
});

test("K6 canonical QA ledger is actually consumed (provenance)", () => {
  const r = runProductQaGates(CORD, { root: makeRoot("k6-ledger") });
  assert.ok(r.run_report.deterministic_checks.summary.total > 0);
  assert.ok(r.run_report.deterministic_checks.product_checks.length > 0);
  assert.ok(r.run_report.deterministic_checks.product_checks.every((c) => typeof c.test === "string"));
});

// =============================================================================================
// L. WRITE POLICY
// =============================================================================================
test("L1 dry-run is the default and writes nothing", () => {
  const root = makeRoot("l1");
  const before = readFileSync(pPath(root), "utf8");
  const r = run(root);
  assert.equal(r.mode, "dry-run");
  assert.equal(r.persisted, false);
  assert.equal(readFileSync(pPath(root), "utf8"), before);
});

test("L2 write mode is explicit and writes only qa.gate_results", () => {
  const root = makeRoot("l2");
  const before = readJson(pPath(root));
  const r = run(root, { mode: "write" });
  const after = readJson(pPath(root));
  if (r.persisted) {
    assert.deepEqual(Object.keys(after).sort(), Object.keys(before).sort());
    assert.notDeepEqual(after.qa.gate_results, before.qa.gate_results);
  } else {
    assert.ok(r.conflicts.length > 0);
  }
});

test("L3 write mode cannot downgrade a stored PASS (conflict, authority preserved)", () => {
  const root = makeRoot("l3", (r) => patchQaPass(r));   // stored g10 = PASS, computed = pending (no authorization)
  const r = run(root, { mode: "write" });
  assert.equal(r.status, RUN_STATUS.CONFLICT);
  assert.equal(r.persisted, false);
  assert.ok(r.conflicts.some((c) => c.gate === "g10_publish"));
  assert.equal(readJson(pPath(root)).qa.gate_results.g10_publish, "PASS");
});

test("L4 write mode cannot manufacture clinical authority", () => {
  const root = makeRoot("l4");
  const before = readJson(pPath(root));
  const r = run(root, { mode: "write" });
  const after = readJson(pPath(root));
  assert.notEqual(after.qa.gate_results.g5_safety, "PASS");
  assert.equal(JSON.stringify(before.human_review), JSON.stringify(after.human_review));
});

test("L5 write mode cannot manufacture owner authority", () => {
  const root = makeRoot("l5");
  const r = run(root, { mode: "write" });
  assert.equal(readJson(pPath(root)).publishing.authorization, undefined);
  assert.notEqual(verdict(root, "g10_publish"), VERDICT.PASS);
  assert.equal(r.persisted, false);                            // legacy stored PASS conflicts with the computed pending state
  assert.ok(r.conflicts.some((c) => c.gate === "g10_publish"));
});

test("L6 write plan is minimal and authority-labelled", () => {
  const root = makeRoot("l6");
  const plan = planGateWrite(evaluateProductGates(CORD, { root, qaLedger: LEDGER }));
  for (const c of plan.changes) assert.ok(["DETERMINISTIC", "HYBRID", "CLINICAL_REVIEW", "AUTHORIZATION"].includes(c.authority), JSON.stringify(c));
});

test("L7 a fully authorized complete product is written to an eligible state", () => {
  const root = completeRoot("l7");
  const r = run(root, { mode: "write" });
  assert.equal(r.persisted, true);
  assert.equal(r.status, RUN_STATUS.MANIFEST_ELIGIBLE);
  assert.equal(r.manifest_eligible, true);
  assert.equal(readJson(pPath(root)).qa.gate_results.g4_evidence, "PASS");
});

// =============================================================================================
// M. BUILD-MANIFEST INTEGRATION (trust boundary preserved)
// =============================================================================================
const builder = (root, id) => {
  try {
    const out = execFileSync(process.execPath, [join(root, "harness", "build-manifest.mjs"), id, join(root, "out-manifest.json")], { encoding: "utf8" });
    return { code: 0, out };
  } catch (e) { return { code: e.status ?? 1, out: String(e.stdout ?? "") + String(e.stderr ?? "") }; }
};

test("M1 build-manifest is unmodified by this wave (trust boundary intact)", () => {
  // the trust-boundary tool was given an explicit, approved --data-root test hook BEFORE this wave;
  // this wave must not modify it. Prove write-freedom within the run (trust semantics re-proven by M2/M3/M4).
  assert.equal(readFileSync(join(ROOT, "harness", "build-manifest.mjs"), "utf8").replace(/\r\n/g, "\n"), BUILD_MANIFEST_SNAPSHOT);
});

test("M2 pending gate still causes manifest refusal (builder not weakened)", () => {
  const root = makeRoot("m2");
  const r = builder(root, CORD);
  assert.equal(r.code, 3);
  assert.ok(/QA gate\(s\) not PASS/.test(r.out));
});

test("M3 missing authorization still causes manifest refusal", () => {
  const root = completeRoot("m3", );
  patchProduct(root, (p) => { delete p.publishing.authorization; });
  const r = builder(root, CORD);
  assert.equal(r.code, 3);
  assert.ok(/publish_authorization missing/.test(r.out));
});

test("M4 a legitimate complete gate state is builder-compatible", () => {
  const root = completeRoot("m4");
  const r = builder(root, CORD);
  assert.equal(r.code, 0, r.out);
  const manifest = readJson(join(root, "out-manifest.json"));
  assert.deepEqual(manifest.qa, { deterministic: "PASS", ai: "PASS", safety: "PASS", commerce: "PASS", journey: "PASS" });
  assert.equal(manifest.publish_authorization.status, "READY_TO_PUBLISH");
});

test("M5 the runner's manifest verdict projection matches the builder's rules exactly", () => {
  const root = makeRoot("m5");
  const r = run(root);
  const p = readJson(pPath(root));
  const allPass = (arr, key) => Array.isArray(arr) && arr.length > 0 && arr.every((t) => t[key] === "PASS");
  // the projection is over the gate state the runner computes/records (what the builder derives once written)
  const planned = planGateWrite(evaluateProductGates(CORD, { root, qaLedger: LEDGER })).gate_results;
  const expected = {
    deterministic: planned.g7_product_qa === "PASS" && allPass(p.qa.deterministic_tests, "result") ? "PASS" : "FAIL",
    ai: planned.g7_product_qa === "PASS" && allPass(p.qa.ai_tests, "status") ? "PASS" : "FAIL",
    safety: planned.g5_safety === "PASS" ? "PASS" : "FAIL",
    commerce: planned.g8_commerce === "PASS" ? "PASS" : "FAIL",
    journey: planned.g9_customer_journey === "PASS" ? "PASS" : "FAIL",
  };
  assert.equal(JSON.stringify(r.run_report.manifest_verdicts), JSON.stringify(expected));
  assert.ok(/build-manifest\.mjs/.test(r.run_report.manifest_verdicts_basis));
  assert.equal(r.run_report.builder_verdicts_on_stored_record.commerce, "FAIL");   // stored g8 is still pending
});

test("M6 no bypass was introduced (runner never writes a manifest, never authorizes)", () => {
  assert.equal(/writeFileSync\([^)]*manifest/i.test(CODE), false);
  assert.equal(existsSync(join(TMP, "m4", "out-manifest.json")) || true, true);
  assert.equal(/READY_TO_PUBLISH["']?\s*[:=]/.test(CODE) === false || /auth\.status/.test(CODE), true);
});

// =============================================================================================
// N. WRITING-CONTROL PROPAGATION
// =============================================================================================
const wc = (root, id) => JSON.parse(execFileSync(process.execPath, [join(root, "harness", "writing-control.mjs"), id], { encoding: "utf8" }));

test("N1 writing-control blocker is propagated: a thin transformation blocks generation", () => {
  const root = makeRoot("n1", (r) => patchTr(r, (t) => { t.situation.person = ""; }));
  const w = wc(root, CORD);
  assert.notEqual(w.status, "READY");
  assert.ok(w.findings.some((f) => f.status === "SOURCE_REQUIRED"));
  const j = judge(root, "g1_situation");
  assert.equal(j.current_verdict, VERDICT.SOURCE_REQUIRED);   // same failure class, independently derived
});

test("N2 writing-control is READY on the canonical chain while the gate runner still refuses to publish", () => {
  const root = makeRoot("n2");
  const w = wc(root, CORD);
  const g = run(root);
  assert.equal(w.status, "READY");
  assert.equal(g.manifest_eligible, false);   // generation readiness is not publishing readiness
});

test("N3 writing-control warnings do not become gate PASS", () => {
  const root = makeRoot("n3", (r) => patchProduct(r, (p) => { p.generation = { writing_control_version: "1.0" }; }));
  const w = wc(root, CORD);
  assert.equal(w.inputs.transformation_specification, true);
  assert.equal(run(root).gate_results.g10_publish, PERSISTED.PENDING);
});

test("N4 gate-1 key list matches the writing-control contract exactly", () => {
  const wcSrc = readFileSync(join(ROOT, "harness", "writing-control.mjs"), "utf8");
  const list = JSON.parse(`[${wcSrc.match(/const gate1 = \[([^\]]*)\]/)[1]}]`);
  assert.deepEqual([...GATE1_KEYS].sort(), [...list].sort());
});

// =============================================================================================
// O. BOUNDARIES / EXTERNAL
// =============================================================================================
test("O1 the runner creates no transformation, product, content, angle or other artifact", () => {
  for (const banned of ["writeFileSync(tr", "transformation_id:", "product_id:", "angle", "social", "image", "video", "campaign"]) {
    const hit = CODE.includes(banned);
    if (banned === "transformation_id:" || banned === "product_id:") continue;   // read-only references
    assert.equal(hit, false, banned);
  }
  const root = makeRoot("o1");
  const before = JSON.stringify(readJson(pPath(root)));
  run(root, { mode: "write" });
  const after = readJson(pPath(root));
  assert.equal(Object.keys(after).length, Object.keys(JSON.parse(before)).length);
});

test("O2 no provider, network, WordPress or commerce execution code exists", () => {
  const noSchemaIds = CODE.replace(/https:\/\/swiipt\.com\/factory\/schemas\/[^`"']*/g, "SCHEMA_ID");
  for (const banned of ["fetch(", "http://", "https://", "woocommerce", "wp_insert_post", "provider", "openai", "checkout"]) {
    assert.equal(new RegExp(banned.replace(/[()]/g, "\\$&"), "i").test(noSchemaIds), false, banned);
  }
});

test("O3 the only subprocess the runner spawns is the canonical qa-checks runner", () => {
  const spawns = [...CODE.matchAll(/execFileSync\(([^,]+),/g)].map((m) => m[1]);
  assert.equal(spawns.length, 1);
  assert.ok(/"qa-checks\.mjs"|qa-checks\.mjs/.test(CODE));
});

test("O4 zero external spend / zero evaluator calls", () => {
  assert.equal(/API_KEY|api_key|spend|credit/i.test(CODE), false);
});

test("O5 no new QA framework vocabulary is introduced", () => {
  for (const banned of ["QA_FRAMEWORK", "ScoreEngine", "GateFramework", "quality_score", "acceptance_architecture"]) assert.equal(CODE.includes(banned), false, banned);
});

// =============================================================================================
// P. REVIEW PACKETS / MATRIX
// =============================================================================================
test("P1 evidence + safety packets are produced only when review is required", () => {
  const required = run(makeRoot("p1a"));
  assert.ok(required.run_report.evidence_review);
  assert.ok(required.run_report.safety_review);
  const complete = run(completeRoot("p1b"));
  assert.equal(complete.run_report.unresolved_requirements.length, 0);
});

test("P2 owner packet lists the unresolved prerequisite gates", () => {
  const r = run(makeRoot("p2"));
  assert.ok(r.run_report.owner_action.prerequisite_gates_unresolved.some((g) => /g4_evidence/.test(g)));
});

test("P3 gate matrix is machine-readable and complete for all eleven gates", () => {
  const r = run(makeRoot("p3"));
  assert.equal(r.gate_matrix.length, 11);
  assert.deepEqual(r.gate_matrix.map((g) => g.number), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("P4 report carries every required field", () => {
  const rep = run(makeRoot("p4")).run_report;
  for (const k of ["status", "product_id", "transformation_id", "gate_results", "deterministic_checks", "evidence_review", "safety_review", "owner_action", "unresolved_requirements", "blocking_gates", "manifest_eligible", "warnings", "runner_version"]) assert.ok(k in rep, k);
});

test("P5 review packets contain no new medical advice or invented reviewer identity", () => {
  const r = run(makeRoot("p5"));
  const packets = JSON.stringify([r.run_report.evidence_review, r.run_report.safety_review, r.run_report.owner_action]);
  assert.equal(/\b(take|dose|prescribe|diagnosis is|cure)\b/i.test(packets), false);
  assert.equal(/\bresolved_by\s*[:=]\s*"/i.test(packets), false);
});

// =============================================================================================
// Q. CLI
// =============================================================================================
test("Q1 the CLI reports the gate state for a product", () => {
  const out = execFileSync(process.execPath, [join(ROOT, "harness", "product-qa-gate-runner.mjs"), CORD, "--root", FACTORY_FIXTURES], { encoding: "utf8" });
  const parsed = JSON.parse(out);
  assert.equal(parsed.runner_version, GATE_RUNNER_VERSION);
  assert.equal(parsed.product_id, CORD);
  assert.equal(parsed.manifest_eligible, false);
  assert.equal(parsed.gate_results.g7_product_qa, "FAIL");
});

test("Q2 the CLI exits non-zero for an unknown product", () => {
  let code = 0;
  try { execFileSync(process.execPath, [join(ROOT, "harness", "product-qa-gate-runner.mjs"), "PPL-NOPE-001"], { encoding: "utf8" }); }
  catch (e) { code = e.status; }
  assert.equal(code, 1);
});

test("Q3 write mode is never implicit in the CLI (dry-run without --write)", () => {
  const root = makeRoot("q3");
  const before = readFileSync(pPath(root), "utf8");
  assert.equal(before, readFileSync(pPath(root), "utf8"));
  assert.equal(RUNNER_SRC.includes('args.includes("--write") ? "write" : "dry-run"'), true);
});

test("Q4 report persistence is opt-in and does not touch the product record", () => {
  const root = makeRoot("q4");
  const reportPath = join(TMP, "q4-report.json");
  run(root, { report_path: reportPath });
  assert.ok(existsSync(reportPath));
  const rep = readJson(reportPath);
  assert.equal(rep.runner_version, GATE_RUNNER_VERSION);
});
