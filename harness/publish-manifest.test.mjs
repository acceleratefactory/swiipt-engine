#!/usr/bin/env node
// Publish-manifest contract — REGRESSION TESTS.
// 1) the schema describes the real platform projection; 2) build-manifest records the ACTUAL gate
// results + upstream authorization and never manufactures PASS. Negative cases prove a FAIL / missing
// gate / missing authorization cannot produce a publishable manifest.
// Run: node harness/publish-manifest.test.mjs
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import Ajv from "ajv/dist/2020.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MID = "https://swiipt.com/factory/schemas/publish-manifest.schema.json";
const FIXTURE_ROOT = join(root, "harness", "fixtures", "factory");
const PRODUCT = "FIXTURE-PRODUCT-001";
const PF = join(FIXTURE_ROOT, "data", "products", PRODUCT, "product.json");
const OUT = join(FIXTURE_ROOT, "data", "products", PRODUCT, "publish", "_test-manifest.json");
const queue = [];
const T = (name, fn) => queue.push([name, fn]);

function ajvPool() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  ajv.addFormat("date-time", /^\d{4}-\d{2}-\d{2}T/);
  ajv.addFormat("date", /^\d{4}-\d{2}-\d{2}$/);
  for (const f of readdirSync(join(root, "schemas")).filter((x) => x.endsWith(".schema.json"))) {
    const s = JSON.parse(readFileSync(join(root, "schemas", f), "utf8"));
    s.$id = "https://swiipt.com/factory/schemas/" + f;
    try { ajv.addSchema(s); } catch (e) { /* already */ }
  }
  return ajv;
}
const manifestPath = (d) => join(FIXTURE_ROOT, "data", "products", d, "publish", "manifest.json");
const manifests = () => readdirSync(join(FIXTURE_ROOT, "data", "products")).filter((d) => existsSync(manifestPath(d)));

// Inject gate/auth state into a real product record, run fn(), always restore.
function withRecord(mutate, fn) {
  const orig = readFileSync(PF, "utf8");
  try {
    const p = JSON.parse(orig);
    p.qa = p.qa || {}; p.qa.gate_results = p.qa.gate_results || {};
    p.qa.deterministic_tests = p.qa.deterministic_tests || [];
    p.qa.ai_tests = p.qa.ai_tests || [];
    p.publishing = p.publishing || {};
    mutate(p);
    writeFileSync(PF, JSON.stringify(p, null, 2) + "\n");
    return fn();
  } finally { writeFileSync(PF, orig); }
}
const allGatesPass = (p) => {
  p.qa.gate_results.g5_safety = "PASS";
  p.qa.gate_results.g7_product_qa = "PASS";
  p.qa.gate_results.g8_commerce = "PASS";
  p.qa.gate_results.g9_customer_journey = "PASS";
  p.qa.deterministic_tests = [{ test: "schema_valid", result: "PASS" }];
  p.qa.ai_tests = [{ test: "R_drift_integrity", status: "PASS", severity: "none" }];
};
const authorize = (p) => { p.publishing.authorization = { status: "READY_TO_PUBLISH", authorized_by: "Owner", authorized_at: "2026-09-11T00:00:00Z" }; };
function build() {
  try {
    execFileSync(process.execPath, [join(root, "harness", "build-manifest.mjs"), PRODUCT, OUT, "--data-root", FIXTURE_ROOT], { cwd: root, stdio: "pipe" });
    const m = JSON.parse(readFileSync(OUT, "utf8"));
    return { ok: true, manifest: m };
  } catch (e) { return { ok: false, code: e.status }; }
  finally { if (existsSync(OUT)) rmSync(OUT); }
}

// 1) schema / existing manifests
T("every existing publish manifest validates against publish-manifest.schema.json", () => {
  const ajv = ajvPool();
  const ids = manifests();
  assert.ok(ids.length >= 1, "expected at least one manifest");
  for (const d of ids) {
    const m = JSON.parse(readFileSync(manifestPath(d), "utf8"));
    assert.equal(ajv.validate(MID, m), true, d + " -> " + JSON.stringify(ajv.errors).slice(0, 400));
  }
});
T("every manifest carries commerce + access + qa + publish_authorization + relationships + content", () => {
  for (const d of manifests()) {
    const m = JSON.parse(readFileSync(manifestPath(d), "utf8"));
    for (const k of ["commerce", "access", "qa", "publish_authorization", "relationships", "content"]) assert.ok(m[k] !== undefined, `${d}: missing ${k}`);
    assert.ok(m.commerce.price && typeof m.commerce.price.base_usd === "number");
    assert.ok(m.access.grant_type);
  }
});
T("a manifest missing commerce FAILS validation (enforcement)", () => {
  const ajv = ajvPool(); const m = JSON.parse(readFileSync(manifestPath(PRODUCT), "utf8")); delete m.commerce;
  assert.equal(ajv.validate(MID, m), false);
});
T("a manifest missing access FAILS validation", () => {
  const ajv = ajvPool(); const m = JSON.parse(readFileSync(manifestPath(PRODUCT), "utf8")); delete m.access;
  assert.equal(ajv.validate(MID, m), false);
});
T("schema describes the platform projection, not the full product record", () => {
  const ajv = ajvPool(); const m = JSON.parse(readFileSync(manifestPath(PRODUCT), "utf8"));
  m.product = { product_id: "X", version: "1.0.0", status: "published", identity: {}, commercial_role: {}, customer: {}, transformation: {}, tsm: {}, asset_map: {}, content: {}, commerce: {}, design: {}, evidence: {}, safety: {}, qa: {}, publishing: {} };
  assert.equal(ajv.validate(MID, m), false);
});

// 2) builder records REAL gate results + upstream authorization (no manufacture)
T("build-manifest emits a schema-valid manifest when gates + authorization are recorded", () => {
  const r = withRecord((p) => { allGatesPass(p); authorize(p); }, build);
  assert.equal(r.ok, true, "expected a successful build");
  const ajv = ajvPool();
  assert.equal(ajv.validate(MID, r.manifest), true, JSON.stringify(ajv.errors));
  assert.deepEqual(r.manifest.qa, { deterministic: "PASS", ai: "PASS", safety: "PASS", commerce: "PASS", journey: "PASS" });
  assert.equal(r.manifest.publish_authorization.authorized_by, "Owner");
  assert.equal(r.manifest.publish_authorization.status, "READY_TO_PUBLISH");
});

// 3) NEGATIVE cases — no publishable manifest can be produced
T("build-manifest REFUSES when a gate is FAIL (no manifest written)", () => {
  const r = withRecord((p) => { allGatesPass(p); p.qa.gate_results.g5_safety = "FAIL"; authorize(p); }, build);
  assert.equal(r.ok, false, "build must fail");
  assert.notEqual(r.code, 0);
});
T("build-manifest REFUSES when a gate result is missing/pending", () => {
  const r = withRecord((p) => { allGatesPass(p); p.qa.gate_results.g8_commerce = "pending"; authorize(p); }, build);
  assert.equal(r.ok, false);
});
T("build-manifest REFUSES when a gate result is absent entirely", () => {
  const r = withRecord((p) => { allGatesPass(p); delete p.qa.gate_results.g9_customer_journey; authorize(p); }, build);
  assert.equal(r.ok, false);
});
T("build-manifest REFUSES when a QA test array is empty (never defaults to PASS)", () => {
  const r = withRecord((p) => { allGatesPass(p); p.qa.ai_tests = []; authorize(p); }, build);
  assert.equal(r.ok, false);
});
T("build-manifest REFUSES when a QA test has FAILED", () => {
  const r = withRecord((p) => { allGatesPass(p); p.qa.deterministic_tests = [{ test: "x", result: "FAIL" }]; authorize(p); }, build);
  assert.equal(r.ok, false);
});
T("build-manifest REFUSES when publish_authorization is missing", () => {
  const r = withRecord((p) => { allGatesPass(p); delete p.publishing.authorization; }, build);
  assert.equal(r.ok, false);
});
T("build-manifest REFUSES when authorization is not READY_TO_PUBLISH", () => {
  const r = withRecord((p) => { allGatesPass(p); p.publishing.authorization = { status: "PENDING", authorized_by: "Owner", authorized_at: "2026-09-11T00:00:00Z" }; }, build);
  assert.equal(r.ok, false);
});
T("build-manifest REFUSES when the authorizer is unnamed", () => {
  const r = withRecord((p) => { allGatesPass(p); p.publishing.authorization = { status: "READY_TO_PUBLISH", authorized_by: "", authorized_at: "2026-09-11T00:00:00Z" }; }, build);
  assert.equal(r.ok, false);
});

// 4) PRE_REVENUE human-review gate — a blocking review blocks publication; a resolved one does not.
T("build-manifest REFUSES while a human review is PENDING_HUMAN_REVIEW (even with gates + authorization)", () => {
  const r = withRecord((p) => {
    allGatesPass(p); authorize(p);
    p.human_review = { status: "PENDING_HUMAN_REVIEW", reason: "SUPERVISOR_REQUIRED deferred until revenue", escalation_class: "SUPERVISOR_REQUIRED", created_at: "2026-09-12T00:00:00Z" };
  }, build);
  assert.equal(r.ok, false, "a pending human review must block publication");
});
T("build-manifest REFUSES while a human review is BLOCKED", () => {
  const r = withRecord((p) => {
    allGatesPass(p); authorize(p);
    p.human_review = { status: "BLOCKED", reason: "unsupported evidence", escalation_class: "SUPERVISOR_REQUIRED", created_at: "2026-09-12T00:00:00Z" };
  }, build);
  assert.equal(r.ok, false);
});
T("build-manifest proceeds after a human review is RESOLVED (through normal gates + authorization)", () => {
  const r = withRecord((p) => {
    allGatesPass(p); authorize(p);
    p.human_review = { status: "RESOLVED", reason: "unsupported claim removed", escalation_class: "SUPERVISOR_REQUIRED", created_at: "2026-09-12T00:00:00Z", resolved_at: "2026-09-12T01:00:00Z", resolved_by: "Owner", resolution: "claim removed" };
  }, build);
  assert.equal(r.ok, true, "a resolved review must not permanently block a gated publish");
});

let pass = 0, fail = 0;
for (const [name, fn] of queue) {
  try { fn(); console.log("PASS  " + name); pass++; }
  catch (e) { console.log("FAIL  " + name + "  -> " + e.message); fail++; }
}
console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
