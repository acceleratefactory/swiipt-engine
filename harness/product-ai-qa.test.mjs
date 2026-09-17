// CANONICAL PRODUCT-LEVEL INDEPENDENT AI-QA EXECUTION PATH - DETERMINISTIC QUALIFICATION SUITE
//
// Proves the g7 execution path against the canonical contracts WITHOUT any live provider call:
//   standards/qa-standard.md sections 3-5 (A-R acceptance tests, severity, reviewer output)
//   schemas/product.schema.json (qa.ai_tests ledger shape - the EXISTING contract)
//   schemas/product-ai-qa-result.schema.json (reviewer structured output)
//   harness/product-qa-gate-runner.mjs (the EXISTING, authoritative gate evaluator)
//   config/text-intelligence.v1.json + bench/results/* (qualification evidence)
//
// Every provider response is a deterministic mock. No network, no spend, no real key.
// Run: node --test harness/product-ai-qa.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, cpSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import Ajv from "ajv/dist/2020.js";
import {
  runProductAiQa, assembleProductAiQaInput, qualificationGuard, independenceGuard,
  canonicalQualification, projectAiTests, auditRecordPath, loadPriorExecution,
  AI_QA_STATUS, AI_OWNED_TESTS, NON_AI_OWNED_TESTS, TEST_OWNERSHIP, MANDATORY_AI_TEST,
} from "./product-ai-qa.mjs";
import { runProductQaGates, AI_TEST_STATUSES } from "./product-qa-gate-runner.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(os.tmpdir(), "swiipt-product-ai-qa");
const FIXTURES = join(ROOT, "harness", "fixtures", "factory");
const CID = "FIXTURE-PRODUCT-001";        // synthetic fixture product (NOT V06) - the neutral subject
const CID2 = "FIXTURE-PRODUCT-003";       // second synthetic product - future-product proof
const SENTINEL = "sk-sentinel-DO-NOT-LEAK-1234567890";
const ENV = { NVIDIA_BASE_URL: "https://nv.example.invalid/v1", NVIDIA_API_KEY: SENTINEL };
const LEDGER = { checks: [], summary: null };   // isolate g7 from unrelated canonical checks
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const writeJson = (p, o) => writeFileSync(p, `${JSON.stringify(o, null, 2)}\n`, "utf8");
const productPath = (root, id = CID) => join(root, "data", "products", id, "product.json");
const cfgPath = (root) => join(root, "config", "text-intelligence.v1.json");
const patchConfig = (root, fn) => { const c = readJson(cfgPath(root)); fn(c); writeJson(cfgPath(root), c); return c; };
const patchProduct = (root, id, fn) => { const p = readJson(productPath(root, id)); fn(p); writeJson(productPath(root, id), p); return p; };

/** Build an isolated temp repository root seeded from the canonical fixtures. */
function makeRoot(name, mutate = null) {
  const root = join(TMP, name);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(root, "harness"), { recursive: true });
  mkdirSync(join(root, "data", "products"), { recursive: true });
  mkdirSync(join(root, "data", "transformations"), { recursive: true });
  mkdirSync(join(root, "config"), { recursive: true });
  mkdirSync(join(root, "bench", "results"), { recursive: true });
  mkdirSync(join(root, "lib"), { recursive: true });
  cpSync(join(ROOT, "schemas"), join(root, "schemas"), { recursive: true });
  cpSync(join(ROOT, "config"), join(root, "config"), { recursive: true });
  for (const f of ["product-ai-qa.mjs", "product-qa-gate-runner.mjs", "qa-checks.mjs", "build-manifest.mjs", "writing-control.mjs", "transformation-architect.mjs", "globality.mjs", "applicability.mjs"]) {
    cpSync(join(ROOT, "harness", f), join(root, "harness", f));
  }
  cpSync(join(ROOT, "lib", "provider-client.mjs"), join(root, "lib", "provider-client.mjs"));
  cpSync(join(ROOT, "bench", "text-provider-bench.mjs"), join(root, "bench", "text-provider-bench.mjs"));
  cpSync(join(ROOT, "bench", "candidates.example.json"), join(root, "bench", "candidates.example.json"));
  for (const f of readdirSync(join(ROOT, "bench", "results")).filter((x) => x.endsWith("-results.json"))) {
    cpSync(join(ROOT, "bench", "results", f), join(root, "bench", "results", f));
  }
  for (const id of [CID, CID2]) {
    cpSync(join(FIXTURES, "data", "products", id), join(root, "data", "products", id), { recursive: true });
  }
  for (const f of readdirSync(join(FIXTURES, "data", "transformations"))) {
    cpSync(join(FIXTURES, "data", "transformations", f), join(root, "data", "transformations", f));
  }
  if (mutate) mutate(root);
  return root;
}

// ------------------------------------------------------------------------------------------------
// Deterministic mock provider
// ------------------------------------------------------------------------------------------------
function criticResult(overrides = {}) {
  const tests = AI_OWNED_TESTS.map((t) => ({
    test: t, status: "PASS", severity: "none",
    finding: `fixture: ${t} satisfied by the supplied canonical material`,
    evidence_location: "product.transformation.after_state.summary",
    recommended_action: "",
  }));
  return {
    review_type: "product_acceptance_ai_qa", review_version: "1.0", overall_status: "PASS",
    tests, authority_flags: [], blocking_issues: [], non_blocking_issues: [], scope_drift: false,
    safety_issues: [], required_changes: [], missing_information: [],
    ...overrides,
  };
}
/** Patch one AI-owned test and recompute the verdict the way an honest reviewer would. */
function withTest(res, testId, patch) {
  const r = JSON.parse(JSON.stringify(res));
  const t = r.tests.find((x) => x.test === testId);
  assert.ok(t, `fixture must contain ${testId}`);
  Object.assign(t, patch);
  const nonPass = r.tests.filter((x) => x.status !== "PASS");
  r.overall_status = nonPass.length === 0 ? "PASS" : (nonPass.some((x) => x.status === "FAIL") ? "FAIL" : "REVISION_REQUIRED");
  return r;
}
const mockFetch = (payload) => async () => ({
  ok: true, status: 200,
  json: async () => ({ model: "nvidia/nemotron-3-super-120b-a12b", choices: [{ message: { content: typeof payload === "string" ? payload : JSON.stringify(payload) } }], usage: { total_tokens: 100 } }),
});
const failingFetch = (status = 503) => async () => ({ ok: false, status, json: async () => ({ error: "unavailable" }) });
const throwingFetch = (msg) => async () => { throw new Error(msg); };
const run = (root, opts = {}) => runProductAiQa(CID, { root, env: ENV, ...opts });

// ------------------------------------------------------------------------------------------------
// TEST A - qualified critic: execution eligible
// ------------------------------------------------------------------------------------------------
test("TEST A - qualified critic is eligible and executes", async () => {
  const root = makeRoot("a");
  const r = await run(root, { fetchImpl: mockFetch(criticResult()) });
  assert.equal(r.status, AI_QA_STATUS.EXECUTED, r.reason);
  assert.equal(r.qualification.ok, true);
  assert.equal(r.qualification.qualified.provider, "nvidia");
  assert.equal(r.qualification.qualified.model, "nvidia/nemotron-3-super-120b-a12b");
  assert.equal(r.independence.ok, true);
  assert.equal(r.schema_valid, true);
  assert.equal(r.ai_tests.length, 14, "all 14 AI-owned acceptance tests projected");
  assert.ok(r.ai_tests.every((t) => t.status === "PASS"));
  assert.ok(r.ai_tests.some((t) => t.test === MANDATORY_AI_TEST));
  assert.equal(r.written, false, "dry-run default never writes");
});

// ------------------------------------------------------------------------------------------------
// TEST B - unqualified critic: REFUSE
// ------------------------------------------------------------------------------------------------
test("TEST B - unqualified critic refuses execution", async () => {
  const root = makeRoot("b", (r0) => patchConfig(r0, (c) => { c.primary_critic.status = "UNQUALIFIED"; }));
  const r = await run(root, { fetchImpl: mockFetch(criticResult()), write: true });
  assert.equal(r.status, AI_QA_STATUS.QUALIFICATION_REQUIRED);
  assert.match(r.reason, /QUALIFIED_PRIMARY_CRITIC/);
  assert.equal(r.ai_tests, null);
  const p = readJson(productPath(root));
  assert.equal(p.qa.ai_tests.length, 3, "ledger untouched on refusal");
});

// --------------------------------------------------------------------------------------------
// TEST C - qualification mismatch (config model differs from qualification evidence): REFUSE
// --------------------------------------------------------------------------------------------
test("TEST C - config/evidence mismatch refuses execution", async () => {
  const root = makeRoot("c", (r0) => patchConfig(r0, (c) => { c.primary_critic.model = "nvidia/nemotron-3.5-lightning-30b-a3b"; }));
  const r = await run(root, { fetchImpl: mockFetch(criticResult()) });
  assert.equal(r.status, AI_QA_STATUS.QUALIFICATION_REQUIRED);
  assert.match(r.reason, /does not match the qualified critic/);
  assert.equal(r.qualification.qualified.model, "nvidia/nemotron-3-super-120b-a12b");
});

// ------------------------------------------------------------------------------------------------
// TEST D - critic == prohibited generator: REFUSE
// ------------------------------------------------------------------------------------------------
test("TEST D - critic identical to the generator refuses execution", async () => {
  const root = makeRoot("d", (r0) => patchConfig(r0, (c) => {
    c.generator.provider = "nvidia";
    c.generator.model = "nvidia/nemotron-3-super-120b-a12b";
  }));
  const r = await run(root, { fetchImpl: mockFetch(criticResult()) });
  assert.equal(r.status, AI_QA_STATUS.INDEPENDENCE_REQUIRED);
  assert.match(r.reason, /self-review is prohibited/);
  const g = independenceGuard({ provider: "nvidia", model: "nvidia/nemotron-3-super-120b-a12b" }, { provider: "nvidia", model: "deepseek-ai/deepseek-v4-flash-0731" });
  assert.equal(g.ok, true, "different model on the same provider is still independent");
});

// ------------------------------------------------------------------------------------------------
// TEST E - provider unavailable: NOT_RUN / PROVIDER_UNAVAILABLE
// ------------------------------------------------------------------------------------------------
test("TEST E - provider failure is reported honestly, never a substitute model", async () => {
  const root = makeRoot("e");
  const down = await run(root, { fetchImpl: failingFetch(503) });
  assert.equal(down.status, AI_QA_STATUS.NOT_RUN);
  assert.equal(down.provider_status, "PROVIDER_ATTEMPT_FAILED");
  assert.equal(down.ai_tests, null);
  assert.equal(down.model, "nvidia/nemotron-3-super-120b-a12b", "no model substitution on failure");
  const boom = await run(root, { fetchImpl: throwingFetch("socket hang up") });
  assert.equal(boom.status, AI_QA_STATUS.NOT_RUN);
});

// ------------------------------------------------------------------------------------------------
// TEST F - malformed critic JSON: non-PASS after canonical retry behaviour
// ------------------------------------------------------------------------------------------------
test("TEST F - malformed output can never satisfy g7", async () => {
  const root = makeRoot("f");
  const unparseable = await run(root, { fetchImpl: mockFetch("this is not json at all") });
  assert.equal(unparseable.status, AI_QA_STATUS.NOT_RUN);
  assert.equal(unparseable.provider_status, "PROVIDER_RESPONSE_INVALID");
  assert.equal(unparseable.ai_tests, null);
  assert.ok(unparseable.retry_count <= 1, "no trial-and-error spend loop");

  const schemaBad = await run(root, { fetchImpl: mockFetch({ review_type: "product_acceptance_ai_qa" }) });
  assert.equal(schemaBad.status, AI_QA_STATUS.OUTPUT_INVALID);
  assert.equal(schemaBad.schema_valid, false);
  assert.equal(schemaBad.ai_tests, null);

  const missingTests = await run(root, { fetchImpl: mockFetch(criticResult({ tests: criticResult().tests.slice(0, 5) })) });
  assert.equal(missingTests.status, AI_QA_STATUS.OUTPUT_INVALID);
  assert.match(missingTests.reason, /missing AI-owned test result/);
});

// ------------------------------------------------------------------------------------------------
// TEST G - valid all-PASS result writes the schema-valid EXISTING ledger
// ------------------------------------------------------------------------------------------------
test("TEST G - all-PASS review writes a schema-valid product.qa.ai_tests", async () => {
  const root = makeRoot("g");
  const r = await run(root, { fetchImpl: mockFetch(criticResult()), write: true });
  assert.equal(r.status, AI_QA_STATUS.EXECUTED);
  assert.equal(r.written, true);
  const p = readJson(productPath(root));
  assert.equal(p.qa.ai_tests.length, 14);
  assert.ok(p.qa.ai_tests.every((t) => AI_TEST_STATUSES.includes(t.status)));
  assert.ok(p.qa.ai_tests.some((t) => t.test === MANDATORY_AI_TEST));
  assert.ok(existsSync(auditRecordPath(root, CID)));
});

// ------------------------------------------------------------------------------------------------
// TEST H - one acceptance FAIL keeps g7 non-PASS
// ------------------------------------------------------------------------------------------------
test("TEST H - a failing acceptance test keeps g7 non-PASS", async () => {
  const root = makeRoot("h");
  const bad = withTest(criticResult(), "A_situation_integrity", { status: "FAIL", severity: "MAJOR", finding: "situation drifted", recommended_action: "restore the approved situation" });
  const r = await run(root, { fetchImpl: mockFetch(bad), write: true });
  assert.equal(r.results.overall_status, "FAIL");
  const g7 = runProductQaGates(CID, { root, qaLedger: LEDGER }).gate_results.g7_product_qa;
  assert.notEqual(g7, "PASS");
});

// ------------------------------------------------------------------------------------------------
// TEST I - HUMAN_REVIEW must not become an unconditional PASS
// ------------------------------------------------------------------------------------------------
test("TEST I - HUMAN_REVIEW cannot be laundered into a g7 PASS", async () => {
  const root = makeRoot("i");
  const human = withTest(criticResult(), "M_format_integrity", { status: "HUMAN_REVIEW", severity: "OBSERVATION", finding: "format adequacy needs a human call", recommended_action: "human review of deliverable formats" });
  const r = await run(root, { fetchImpl: mockFetch(human), write: true });
  const row = r.ai_tests.find((t) => t.test === "M_format_integrity");
  assert.equal(row.status, "REVISION_REQUIRED");
  assert.match(row.reason, /^\[HUMAN_REVIEW\]/);
  assert.notEqual(runProductQaGates(CID, { root, qaLedger: LEDGER }).gate_results.g7_product_qa, "PASS");
});

// ------------------------------------------------------------------------------------------------
// TEST J - SOURCE_REQUIRED keeps g7 non-PASS and invents no evidence
// ------------------------------------------------------------------------------------------------
test("TEST J - SOURCE_REQUIRED stays non-PASS and never fabricates evidence", async () => {
  const root = makeRoot("j");
  const src = withTest(criticResult(), "J_tsm_integrity", { status: "SOURCE_REQUIRED", severity: "MAJOR", finding: "no TSM measurement method supplied", recommended_action: "supply the TSM measurement method" });
  const r = await run(root, { fetchImpl: mockFetch(src), write: true });
  const row = r.ai_tests.find((t) => t.test === "J_tsm_integrity");
  assert.equal(row.status, "REVISION_REQUIRED");
  assert.match(row.reason, /^\[SOURCE_REQUIRED\]/);
  assert.ok(row.evidence.every((e) => /ai-qa-execution|product\./.test(e)), `no invented evidence refs: ${JSON.stringify(row.evidence)}`);
  assert.notEqual(runProductQaGates(CID, { root, qaLedger: LEDGER }).gate_results.g7_product_qa, "PASS");
});

// ------------------------------------------------------------------------------------------------
// TEST K - no API key: provider unavailable, no fallback
// ------------------------------------------------------------------------------------------------
test("TEST K - a missing key is PROVIDER_UNAVAILABLE with no fallback", async () => {
  const root = makeRoot("k");
  const r = await run(root, { env: { NVIDIA_BASE_URL: "https://nv.example.invalid/v1" }, fetchImpl: mockFetch(criticResult()) });
  assert.equal(r.status, AI_QA_STATUS.PROVIDER_UNAVAILABLE);
  assert.equal(r.provider_status, "PROVIDER_NOT_CONFIGURED");
  assert.equal(r.ai_tests, null);
  assert.equal(r.written, false);
});

// ------------------------------------------------------------------------------------------------
// TEST L - write-back keeps the product record schema-valid
// ------------------------------------------------------------------------------------------------
test("TEST L - the written product record stays schema-valid", async () => {
  const root = makeRoot("l");
  await run(root, { fetchImpl: mockFetch(criticResult()), write: true });
  const ajv = new Ajv({ allErrors: true, strict: false });
  ajv.addFormat("date-time", /^\d{4}-\d{2}-\d{2}T/);
  ajv.addFormat("date", /^\d{4}-\d{2}-\d{2}$/);
  const schema = readJson(join(root, "schemas", "product.schema.json"));
  const ok = ajv.validate(schema, readJson(productPath(root)));
  assert.ok(ok, `product must validate: ${ok ? "" : ajv.errors.map((e) => `${e.instancePath} ${e.message}`).join("; ")}`);
});

// ------------------------------------------------------------------------------------------------
// TEST M - the EXISTING gate runner recomputes g7 from the written ledger
// ------------------------------------------------------------------------------------------------
test("TEST M - gate runner computes g7 PASS from valid deterministic + valid AI results", async () => {
  const root = makeRoot("m");
  await run(root, { fetchImpl: mockFetch(criticResult()), write: true });
  const res = runProductQaGates(CID, { root, qaLedger: LEDGER });
  assert.equal(res.gate_results.g7_product_qa, "PASS");
  const g7 = res.gate_matrix.find((g) => g.gate === "g7_product_qa");
  assert.match(g7.reason, /deterministic \(3\) \+ AI \(14\)/);
});

// ------------------------------------------------------------------------------------------------
// TESTS N/O/P/Q - g7 PASS promotes NO other authority
// ------------------------------------------------------------------------------------------------
test("TEST N - g7 PASS does not resolve g4 (evidence)", async () => {
  const root = makeRoot("n");
  await run(root, { fetchImpl: mockFetch(criticResult()), write: true });
  const res = runProductQaGates(CID, { root, qaLedger: LEDGER });
  assert.equal(res.gate_results.g7_product_qa, "PASS");
  assert.notEqual(res.gate_results.g4_evidence, "PASS");
});

test("TEST O - g7 PASS does not resolve g5 (clinical/safety)", async () => {
  const root = makeRoot("o");
  await run(root, { fetchImpl: mockFetch(criticResult()), write: true });
  const res = runProductQaGates(CID, { root, qaLedger: LEDGER });
  assert.equal(res.gate_results.g7_product_qa, "PASS");
  assert.notEqual(res.gate_results.g5_safety, "PASS");
});

test("TEST P - g7 PASS does not resolve g9 (human journey)", async () => {
  const root = makeRoot("p");
  await run(root, { fetchImpl: mockFetch(criticResult()), write: true });
  const res = runProductQaGates(CID, { root, qaLedger: LEDGER });
  assert.equal(res.gate_results.g7_product_qa, "PASS");
  assert.notEqual(res.gate_results.g9_customer_journey, "PASS");
});

test("TEST Q - g7 PASS cannot authorize publication", async () => {
  const root = makeRoot("q");
  await run(root, { fetchImpl: mockFetch(criticResult()), write: true });
  const res = runProductQaGates(CID, { root, qaLedger: LEDGER });
  assert.equal(res.gate_results.g7_product_qa, "PASS");
  assert.notEqual(res.gate_results.g10_publish, "PASS");
  assert.equal(res.manifest_eligible, false);
});

// ------------------------------------------------------------------------------------------------
// TEST R - secret hygiene
// ------------------------------------------------------------------------------------------------
test("TEST R - no provider secret reaches output, ledger or audit record", async () => {
  const root = makeRoot("r");
  const ok = await run(root, { fetchImpl: mockFetch(criticResult()), write: true });
  assert.ok(!JSON.stringify(ok).includes(SENTINEL), "result must not contain the key");
  const audit = readFileSync(auditRecordPath(root, CID), "utf8");
  assert.ok(!audit.includes(SENTINEL), "audit record must not contain the key");
  assert.ok(!readFileSync(productPath(root), "utf8").includes(SENTINEL), "ledger must not contain the key");
  // failure path: an exception carrying the key must be redacted
  const leaky = await run(root, { fetchImpl: throwingFetch(`auth failed for key ${SENTINEL}`), replace: true, write: true });
  assert.ok(!JSON.stringify(leaky).includes(SENTINEL), `failure path leaked the key: ${leaky.reason}`);
  assert.match(leaky.reason, /\[redacted\]/);
  // the audit record stores env-var NAMES only, never values
  assert.ok(!/nvapi-|sk-[A-Za-z0-9]{8}/.test(audit), "no credential-shaped strings in the audit record");
});

// ------------------------------------------------------------------------------------------------
// Ownership separation + write safety (contract invariants)
// ------------------------------------------------------------------------------------------------
test("ownership - non-AI authorities are never resolved by this reviewer", () => {
  for (const t of ["K_evidence_integrity", "L_safety_integrity", "O_journey_integrity", "P_ecosystem_integrity"]) {
    assert.ok(NON_AI_OWNED_TESTS.includes(t));
    assert.notEqual(TEST_OWNERSHIP[t], "AI_JUDGMENT");
  }
  assert.equal(AI_OWNED_TESTS.length, 14);
});

test("authority escalation is surfaced, settles nothing, and never fabricates a PASS for K/L/O/P", async () => {
  const root = makeRoot("esc");
  const flagged = criticResult({
    authority_flags: [{ authority: "CLINICAL_AUTHORITY", test: "L_safety_integrity", severity: "BLOCKER", finding: "the exhaustion escalation boundary needs clinical sign-off" }],
  });
  const r = await run(root, { fetchImpl: mockFetch(flagged), write: true });
  assert.equal(r.status, AI_QA_STATUS.EXECUTED);
  assert.equal(r.escalations_recorded, true);
  assert.equal(r.escalations.length, 1);
  assert.equal(r.escalations[0].authority, "CLINICAL_AUTHORITY");
  // the reviewer never returns a result for a non-owned test
  assert.ok(!r.ai_tests.some((t) => ["K_evidence_integrity", "L_safety_integrity", "O_journey_integrity", "P_ecosystem_integrity"].includes(t.test)));
  // the escalation is recorded in the audit record, and the owning gate still blocks publication
  const doc = readJson(auditRecordPath(root, CID));
  assert.equal(doc.latest.escalations.length, 1);
  const res = runProductQaGates(CID, { root, qaLedger: LEDGER });
  assert.equal(res.gate_results.g7_product_qa, "PASS");
  assert.notEqual(res.gate_results.g5_safety, "PASS", "an escalation must not resolve the owning gate");
  assert.equal(res.manifest_eligible, false, "publication stays blocked by the gate conjunction");
});

test("write safety - a second run refuses to silently overwrite a prior independent review", async () => {
  const root = makeRoot("ws");
  const first = await run(root, { fetchImpl: mockFetch(criticResult()), write: true });
  assert.equal(first.written, true);
  const prior = loadPriorExecution(root, CID);
  assert.ok(prior, "first execution recorded");
  const second = await run(root, { fetchImpl: mockFetch(withTest(criticResult(), "B_scope_integrity", { status: "REVISION_REQUIRED", severity: "MINOR", finding: "scope wording", recommended_action: "tighten scope" })), write: true });
  assert.equal(second.written, false);
  assert.match(second.write_plan.conflicts.join(" "), /--replace/);
  const third = await run(root, { replace: true, write: true, fetchImpl: mockFetch(criticResult()) });
  assert.equal(third.written, true, third.reason);
  const doc = readJson(auditRecordPath(root, CID));
  assert.ok(doc.history.length >= 1, "superseded governance history is preserved, never lost");
  assert.ok(doc.history.some((h) => h.superseded_at), "supersede is recorded");
});

// ------------------------------------------------------------------------------------------------
// 42. FUTURE-PRODUCT PROOF - the same path, a different product, zero product-specific branching
// ------------------------------------------------------------------------------------------------
test("future product - the same execution path works on a different synthetic product", async () => {
  const root = makeRoot("future", (r0) => {
    // complete the fixture product the way a real product reaches this stage: deterministic QA has run,
    // and the g3/g6 prerequisites the gate runner requires are satisfied. No V06/Night-Shift specifics.
    patchProduct(r0, CID2, (p) => {
      p.qa.deterministic_tests = [
        { test: "schema_valid", result: "PASS", detail: "fixture" },
        { test: "asset_refs_resolve", result: "PASS", detail: "fixture" },
        { test: "platform_relationships", result: "PASS", detail: "fixture" },
      ];
      p.qa.ai_tests = [];
      p.transformation.path = [{ stage: "Diagnose (Day 1)", objective: "Map the current situation" }, { stage: "Run it (Days 2-12)", objective: "Operate the system" }];
      p.transformation.failure_map = { see: "FIXTURE-TR-003 failure_point_map" };
      p.transformation.rescue_protocols = { card: "AS-FIX3-RESCUE-001" };
      p.asset_map.track = ["AS-FIX3-TRACK-001"];
    });
    // the declared TRACK asset must resolve (asset_refs_resolve) - construct it from the fixture bundle
    const src = readJson(join(r0, "data", "products", CID2, "assets", "AS-FIX3-DO-001.json"));
    writeJson(join(r0, "data", "products", CID2, "assets", "AS-FIX3-TRACK-001.json"), {
      ...src, asset_id: "AS-FIX3-TRACK-001", title: "The Fixture Tracker", job: "TRACK", format: "tracker",
    });
  });
  const r = await runProductAiQa(CID2, { root, env: ENV, fetchImpl: mockFetch(criticResult()), write: true });
  assert.equal(r.status, AI_QA_STATUS.EXECUTED, r.reason);
  assert.equal(r.transformation_id, "FIXTURE-TR-003");
  assert.equal(r.ai_tests.length, 14);
  const g7 = runProductQaGates(CID2, { root, qaLedger: LEDGER }).gate_results.g7_product_qa;
  assert.equal(g7, "PASS");
  // no product-specific branching in the canonical module
  const src = readFileSync(join(ROOT, "harness", "product-ai-qa.mjs"), "utf8");
  for (const banned of ["PPL-NIGHT-SHIFT", "Every Night", "postpartum", "night shift", "cord care", "Cord Care"]) {
    assert.ok(!src.includes(banned), `canonical harness must not contain product-specific string '${banned}'`);
  }
});

test("input assembly excludes marketing/customer/market truth (Product QA is not Marketing QA)", () => {
  const root = makeRoot("ia");
  const a = assembleProductAiQaInput(CID, { root });
  assert.equal(a.ok, true, a.errors.join("; "));
  const keys = Object.keys(a.input);
  for (const k of ["customer_truth", "market_truth", "marketing_angle", "campaign", "mae", "angles"]) {
    assert.ok(!keys.includes(k), `input must not carry ${k}`);
  }
  assert.equal(a.input.content_manifest.landing_page.exists, true, "declared landing-page content is included");
  assert.equal(a.input.content_manifest.reviews.exists, true, "declared reviews content is included");
});
