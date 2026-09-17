// HUMAN GOVERNANCE REVIEW WORKFLOW - DETERMINISTIC QUALIFICATION SUITE
//
// Proves the operating layer against the canonical governance contracts:
//   standards/publishing-gates-standard.md (gates 4/5/9 + human authority)
//   standards/qa-standard.md (severity, reviewer independence)
//   schemas/product.schema.json (per-authority human_review.reviews + gate enum)
//   schemas/review-job.schema.json (the review-job contract)
//   harness/product-qa-gate-runner.mjs (the ONLY gate authority)
//
// Fixtures only. No live provider, no network, no real human, no fabricated V06 approval.
// Run: node --test harness/review-jobs.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, cpSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import Ajv from "ajv/dist/2020.js";
import {
  ensureRequiredHumanReviews, deriveReviewRequirements, loadJob, listJobFiles, validateSubmission,
  submitReview, reevaluate, exportJobMarkdown, renderConsole, jobPath, reviewsDir,
  GATE_AUTHORITY, DISPOSITIONS, PASSING_DISPOSITIONS, HUMAN_REVIEW_GATES, REVIEW_JOB_VERSION,
} from "./review-jobs.mjs";
import { reviewInputFor } from "./review-inputs.mjs";
import { VERDICT } from "./product-qa-gate-runner.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(os.tmpdir(), "swiipt-review-jobs");
const FIXTURES = join(ROOT, "harness", "fixtures", "factory");
const NEUTRAL = "FIXTURE-PRODUCT-001";   // synthetic cord-care fixture (NOT V06)
const SECOND = "FIXTURE-PRODUCT-003";    // second synthetic product (future-product proof)
const THIN = "FIXTURE-PRODUCT-002";      // thin product (no safety surface)
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const writeJson = (p, o) => writeFileSync(p, `${JSON.stringify(o, null, 2)}\n`, "utf8");
const pPath = (root, id) => join(root, "data", "products", id, "product.json");

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
  cpSync(join(ROOT, "lib"), join(root, "lib"), { recursive: true });
  for (const f of ["review-inputs.mjs", "review-jobs.mjs", "product-qa-gate-runner.mjs", "qa-checks.mjs", "build-manifest.mjs", "writing-control.mjs", "transformation-architect.mjs", "globality.mjs", "applicability.mjs"]) {
    cpSync(join(ROOT, "harness", f), join(root, "harness", f));
  }
  for (const id of [NEUTRAL, SECOND, THIN]) {
    const src = join(FIXTURES, "data", "products", id);
    if (existsSync(src)) cpSync(src, join(root, "data", "products", id), { recursive: true });
  }
  for (const f of readdirSync(join(FIXTURES, "data", "transformations"))) {
    cpSync(join(FIXTURES, "data", "transformations", f), join(root, "data", "transformations", f));
  }
  if (mutate) mutate(root);
  return root;
}
const patchProduct = (root, id, fn) => { const p = readJson(pPath(root, id)); fn(p); writeJson(pPath(root, id), p); return p; };

/** Build a submission covering every item with the given disposition (or per-item function). */
function submission(job, disposition, { reviewer = "Dr Ada Reviewer", role = "Independent evidence reviewer", kind = "HUMAN", qualification = "PhD evidence appraisal", independent = true, inputHash = null, omit = [] } = {}) {
  return {
    review_job_id: job.review_job_id,
    gate: job.gate,
    authority: job.required_authority,
    reviewer_kind: kind,
    reviewer,
    reviewer_role: role,
    reviewer_qualification: qualification,
    independent_from_builder: independent,
    input_hash: inputHash ?? job.input_hash,
    items: job.items.filter((i) => !omit.includes(i.item_id)).map((i) => ({ item_id: i.item_id, disposition: typeof disposition === "function" ? disposition(i) : disposition, notes: "" })),
  };
}
const errorsOf = (r) => (r.errors ?? []).join(" | ");

/** Review-gate id -> canonical gate-runner gate id (g9's runner id is g9_customer_journey). */
const LEDGER_ID = { g4_evidence: "g4_evidence", g5_safety: "g5_safety", g9_journey: "g9_customer_journey" };
/** gate_results viewed by REVIEW gate id (g9_journey -> g9_customer_journey). */
const gatesOf = (root, id = NEUTRAL) => {
  const raw = reevaluate(id, { root }).gate_results;
  return new Proxy(raw, { get: (t, k) => (typeof k === "string" && LEDGER_ID[k] ? t[LEDGER_ID[k]] : t[k]) });
};
/** The authoritative verdict for a review gate (from the gate matrix, not the persisted projection). */
const verdictOf = (root, gate, id = NEUTRAL) => {
  const m = reevaluate(id, { root }).gate_matrix.find((g) => g.gate === LEDGER_ID[gate]);
  return m ? m.current_verdict : null;
};

// =============================================================================================
// DERIVATION (sections 9-12, 43)
// =============================================================================================
test("derivation - required human reviews come from canonical governance, with canonical item ids", () => {
  const root = makeRoot("derive");
  const d = deriveReviewRequirements(NEUTRAL, { root });
  assert.equal(d.ok, true, d.error);
  assert.deepEqual(d.requirements.map((r) => r.gate), ["g4_evidence", "g5_safety", "g9_journey"]);
  for (const r of d.requirements) {
    assert.equal(r.required_authority, GATE_AUTHORITY[r.gate]);
    assert.ok(r.items.length > 0, r.gate);
    assert.ok(r.input_hash.length === 64);
    assert.ok(r.reviewer_requirement.role && r.reviewer_requirement.independence);
  }
  const g4 = d.requirements.find((r) => r.gate === "g4_evidence");
  const g5 = d.requirements.find((r) => r.gate === "g5_safety");
  const g9 = d.requirements.find((r) => r.gate === "g9_journey");
  assert.ok(g4.items.every((i) => /^C-\d\d$/.test(i.item_id)), "canonical claim ids preserved");
  assert.ok(g5.items.every((i) => /^S-\d\d$/.test(i.item_id)));
  assert.ok(g9.items.every((i) => /^J-\d\d$/.test(i.item_id)));
  assert.equal(g9.items.length, 20, "the canonical journey checklist is product-generic");
});

test("derivation - clinical authority is conditional on canonical risk_level (section 44)", () => {
  const low = makeRoot("cond-low", (r) => patchProduct(r, NEUTRAL, (p) => { p.safety.risk_level = "low"; }));
  const lowReq = deriveReviewRequirements(NEUTRAL, { root: low }).requirements.find((r) => r.gate === "g5_safety");
  assert.equal(lowReq.required, true, "canonical g5 requires a human safety review at low risk too");
  assert.equal(lowReq.clinical_required, false, "low risk must NOT demand CLINICAL authority");
  const high = makeRoot("cond-high", (r) => patchProduct(r, NEUTRAL, (p) => { p.safety.risk_level = "high"; }));
  const highReq = deriveReviewRequirements(NEUTRAL, { root: high }).requirements.find((r) => r.gate === "g5_safety");
  assert.equal(highReq.clinical_required, true);
});

test("derivation - a product with no safety surface at all does not get a g5 job", () => {
  const root = makeRoot("cond-none", (r) => {
    // remove EVERY canonical safety surface (product safety block, transformation safety block and any
    // safety-relevant asset content). Only then is there nothing for a clinical/safety reviewer to see.
    patchProduct(r, NEUTRAL, (p) => {
      p.safety = { risk_level: "low", disclaimer: "", red_flags: [], escalation_rules: [] };
      p.asset_map = { read: p.asset_map.read, do: [], decide: p.asset_map.decide, track: p.asset_map.track, communicate: p.asset_map.communicate, rescue: [], reentry: [], maintenance: [] };
    });
    const trFile = join(r, "data", "transformations", "FIXTURE-TR-001.json");
    const tr = readJson(trFile);
    tr.safety = { risk_level: "low", scope_boundary: "", red_flags: [], escalation_rules: [] };
    writeJson(trFile, tr);
  });
  const reqs = deriveReviewRequirements(NEUTRAL, { root }).requirements;
  assert.equal(reqs.find((r) => r.gate === "g5_safety"), undefined, "no canonical safety items -> no clinical/safety review job is manufactured");
  // ...while the evidence and journey reviews are unaffected
  assert.ok(reqs.some((r) => r.gate === "g4_evidence"));
  assert.ok(reqs.some((r) => r.gate === "g9_journey"));
});

// =============================================================================================
// IDEMPOTENCY + DUPLICATES (section 45)
// =============================================================================================
test("idempotency - repeated ensure creates no duplicates and preserves partial progress", () => {
  const root = makeRoot("idem");
  const first = ensureRequiredHumanReviews(NEUTRAL, { root, write: true });
  assert.equal(first.created.length, 3);
  assert.equal(first.reused.length, 0);
  const second = ensureRequiredHumanReviews(NEUTRAL, { root, write: true });
  assert.equal(second.created.length, 0, "no duplicates on re-run");
  assert.deepEqual(second.reused, ["g4_evidence", "g5_safety", "g9_journey"]);
  assert.equal(listJobFiles(root).length, 3, "exactly one job per gate");
  // partial progress is preserved across re-runs
  const job = loadJob(root, NEUTRAL, "g4_evidence");
  job.items[0].reviewer_disposition = "SUPPORTED";
  writeJson(jobPath(root, NEUTRAL, "g4_evidence"), job);
  const third = ensureRequiredHumanReviews(NEUTRAL, { root, write: true });
  assert.deepEqual(third.created, []);
  const after = loadJob(root, NEUTRAL, "g4_evidence");
  assert.equal(after.items[0].reviewer_disposition, "SUPPORTED", "partial progress survives");
  assert.equal(after.status, "IN_REVIEW");
});

test("idempotency - a completed review is reused while the governed material is unchanged", () => {
  const root = makeRoot("idem-done");
  ensureRequiredHumanReviews(NEUTRAL, { root, write: true });
  const job = loadJob(root, NEUTRAL, "g4_evidence");
  const r = submitReview(NEUTRAL, "g4_evidence", submission(job, "SUPPORTED"), { root, write: true });
  assert.equal(r.ok, true, errorsOf(r));
  assert.equal(verdictOf(root, "g4_evidence"), VERDICT.PASS);
  const again = ensureRequiredHumanReviews(NEUTRAL, { root, write: true });
  assert.deepEqual(again.created, []);
  assert.deepEqual(again.stale, [], "an unchanged product never invalidates its review");
  const kept = loadJob(root, NEUTRAL, "g4_evidence");
  assert.equal(kept.status, "RESOLVED");
  assert.equal(gatesOf(root).g4_evidence, VERDICT.PASS);
});

// =============================================================================================
// STALENESS (section 46)
// =============================================================================================
test("staleness - a material change to the reviewed material invalidates the approval", () => {
  const root = makeRoot("stale");
  ensureRequiredHumanReviews(NEUTRAL, { root, write: true });
  const job = loadJob(root, NEUTRAL, "g4_evidence");
  submitReview(NEUTRAL, "g4_evidence", submission(job, "SUPPORTED"), { root, write: true });
  assert.equal(gatesOf(root).g4_evidence, VERDICT.PASS);
  // change an OWNED input (an evidence claim)
  patchProduct(root, NEUTRAL, (p) => { p.evidence.claim_labels[0].claim = "A materially different claim about cord care"; });
  assert.equal(verdictOf(root, "g4_evidence"), VERDICT.REVIEW_REQUIRED, "a stale approval must not satisfy g4");
  const reopened = ensureRequiredHumanReviews(NEUTRAL, { root, write: true });
  assert.deepEqual(reopened.stale, ["g4_evidence"]);
  const j = loadJob(root, NEUTRAL, "g4_evidence");
  assert.equal(j.status, "STALE");
  assert.equal(j.decision, null, "the superseded decision is cleared, not silently reused");
  assert.equal(j.superseded_reason.includes("governed input changed"), true);
});

test("staleness - an unrelated change does not invalidate a review", () => {
  const root = makeRoot("unrelated");
  ensureRequiredHumanReviews(NEUTRAL, { root, write: true });
  submitReview(NEUTRAL, "g5_safety", submission(loadJob(root, NEUTRAL, "g5_safety"), "ACCEPTABLE", { reviewer: "Dr Clinical", role: "Consultant paediatrician" }), { root, write: true });
  assert.equal(gatesOf(root).g5_safety, VERDICT.PASS);
  // unrelated: commercial metadata + a non-safety asset
  patchProduct(root, NEUTRAL, (p) => { p.commercial_role = "core"; p.design = { ...(p.design ?? {}), notes: "layout tweak" }; });
  assert.equal(gatesOf(root).g5_safety, VERDICT.PASS, "unrelated changes must not invalidate a clinical approval");
});

// =============================================================================================
// AUTHORITY SEPARATION (section 47 A-H)
// =============================================================================================
test("authority separation A/B - an evidence reviewer cannot satisfy g5 or g9", () => {
  const root = makeRoot("auth-ab");
  ensureRequiredHumanReviews(NEUTRAL, { root, write: true });
  const g5 = loadJob(root, NEUTRAL, "g5_safety");
  const g9 = loadJob(root, NEUTRAL, "g9_journey");
  const wrong = { authority: "EVIDENCE_AUTHORITY", reviewer: "Dr Ada Reviewer", reviewer_kind: "HUMAN" };
  for (const job of [g5, g9]) {
    const s = { ...submission(job, job.gate === "g5_safety" ? "ACCEPTABLE" : "WORKS"), authority: wrong.authority };
    const v = validateSubmission(job, s, { root });
    assert.equal(v.ok, false, job.gate);
    assert.match(errorsOf(v), /authority mismatch/);
    const r = submitReview(NEUTRAL, job.gate, s, { root, write: true });
    assert.equal(r.ok, false);
    assert.notEqual(gatesOf(root)[job.gate], VERDICT.PASS);
  }
});

test("authority separation C/D - a clinician cannot satisfy g4 or g9", () => {
  const root = makeRoot("auth-cd");
  ensureRequiredHumanReviews(NEUTRAL, { root, write: true });
  for (const gate of ["g4_evidence", "g9_journey"]) {
    const job = loadJob(root, NEUTRAL, gate);
    const s = { ...submission(job, gate === "g4_evidence" ? "SUPPORTED" : "WORKS", { reviewer: "Dr Clinical", role: "Consultant" }), authority: "CLINICAL_AUTHORITY" };
    const r = submitReview(NEUTRAL, gate, s, { root, write: true });
    assert.equal(r.ok, false, gate);
    assert.match(errorsOf(r), /authority mismatch/);
    assert.notEqual(gatesOf(root)[gate], VERDICT.PASS);
  }
});

test("authority separation E/F - a journey reviewer cannot satisfy g4 or g5", () => {
  const root = makeRoot("auth-ef");
  ensureRequiredHumanReviews(NEUTRAL, { root, write: true });
  for (const gate of ["g4_evidence", "g5_safety"]) {
    const job = loadJob(root, NEUTRAL, gate);
    const s = { ...submission(job, gate === "g4_evidence" ? "SUPPORTED" : "ACCEPTABLE", { reviewer: "Operator Jane", role: "Journey reviewer" }), authority: "JOURNEY_AUTHORITY" };
    const r = submitReview(NEUTRAL, gate, s, { root, write: true });
    assert.equal(r.ok, false, gate);
    assert.notEqual(gatesOf(root)[gate], VERDICT.PASS);
  }
});

test("authority separation G - no reviewer can satisfy g10 (owner only)", () => {
  const root = makeRoot("auth-g");
  ensureRequiredHumanReviews(NEUTRAL, { root, write: true });
  const sub = { g4_evidence: "SUPPORTED", g5_safety: "ACCEPTABLE", g9_journey: "WORKS" };
  const who = { g4_evidence: ["Dr Ada Reviewer", "Independent evidence reviewer"], g5_safety: ["Dr Clinical", "Consultant paediatrician"], g9_journey: ["Operator Jane", "Journey reviewer"] };
  for (const gate of HUMAN_REVIEW_GATES) {
    const job = loadJob(root, NEUTRAL, gate);
    const r = submitReview(NEUTRAL, gate, submission(job, sub[gate], { reviewer: who[gate][0], role: who[gate][1] }), { root, write: true });
    assert.equal(r.ok, true, `${gate}: ${errorsOf(r)}`);
  }
  const re = reevaluate(NEUTRAL, { root });
  assert.equal(verdictOf(root, "g4_evidence"), VERDICT.PASS);
  assert.equal(verdictOf(root, "g5_safety"), VERDICT.PASS);
  assert.equal(verdictOf(root, "g9_journey"), VERDICT.PASS);
  assert.notEqual(re.gate_results.g10_publish, VERDICT.PASS, "review completion is never publication authorization");
  assert.equal(re.manifest_eligible, false);
});

test("authority separation H - AI / automation / builder cannot masquerade as a human reviewer", () => {
  const root = makeRoot("auth-h");
  ensureRequiredHumanReviews(NEUTRAL, { root, write: true });
  const job = loadJob(root, NEUTRAL, "g4_evidence");
  for (const [reviewer, kind] of [["OpenCode", "HUMAN"], ["AI", "HUMAN"], ["automation", "HUMAN"], ["builder", "HUMAN"], ["Dr Ada Reviewer", "AI"]]) {
    const s = submission(job, "SUPPORTED", { reviewer, kind });
    const v = validateSubmission(job, s, { root });
    assert.equal(v.ok, false, `${reviewer}/${kind}`);
    const r = submitReview(NEUTRAL, "g4_evidence", s, { root, write: true });
    assert.equal(r.ok, false);
    assert.ok(!existsSync(join(root, "data", "products", NEUTRAL, "reviews", "audit-log.json")) || !readJson(join(root, "data", "products", NEUTRAL, "reviews", "audit-log.json")).entries.some((e) => e.action === "SUBMIT"), "no audit entry for a refused submission");
  }
  assert.notEqual(gatesOf(root).g4_evidence, VERDICT.PASS);
  // and an anonymous submission is refused
  assert.match(errorsOf(validateSubmission(job, submission(job, "SUPPORTED", { reviewer: "" }), { root })), /reviewer identity|looks like an automated/);
});

// =============================================================================================
// COMPLETENESS (section 48)
// =============================================================================================
test("completeness g4 - partial / SOURCE_REQUIRED / REVISION_REQUIRED never PASS; full approval does", () => {
  const root = makeRoot("comp-g4");
  ensureRequiredHumanReviews(NEUTRAL, { root, write: true });
  const job = loadJob(root, NEUTRAL, "g4_evidence");
  // partial
  const partial = submission(job, "SUPPORTED", { omit: [job.items[3].item_id, job.items[4].item_id] });
  assert.match(errorsOf(validateSubmission(job, partial, { root })), /have no decision/);
  assert.equal(submitReview(NEUTRAL, "g4_evidence", partial, { root, write: true }).ok, false);
  assert.notEqual(gatesOf(root).g4_evidence, VERDICT.PASS);
  // one SOURCE_REQUIRED
  const src = submission(job, (i) => (i.item_id === job.items[2].item_id ? "SOURCE_REQUIRED" : "SUPPORTED"));
  const r1 = submitReview(NEUTRAL, "g4_evidence", src, { root, write: true });
  assert.equal(r1.ok, true, errorsOf(r1));
  assert.equal(r1.record.status, "SOURCE_REQUIRED");
  assert.notEqual(gatesOf(root).g4_evidence, VERDICT.PASS);
  // one REVISION_REQUIRED (and no invented source)
  const rev = submission(job, (i) => (i.item_id === job.items[5].item_id ? "REVISION_REQUIRED" : "SUPPORTED"));
  const r2 = submitReview(NEUTRAL, "g4_evidence", rev, { root, write: true });
  assert.equal(r2.record.status, "REVISION_REQUIRED");
  assert.notEqual(gatesOf(root).g4_evidence, VERDICT.PASS);
  // full legitimate approval
  const ok = submitReview(NEUTRAL, "g4_evidence", submission(job, "SUPPORTED"), { root, write: true });
  assert.equal(ok.ok, true, errorsOf(ok));
  assert.equal(ok.record.status, "RESOLVED");
  assert.equal(gatesOf(root).g4_evidence, VERDICT.PASS);
});

test("completeness g5 - partial and clinical escalation never PASS; complete approval does", () => {
  const root = makeRoot("comp-g5");
  ensureRequiredHumanReviews(NEUTRAL, { root, write: true });
  const job = loadJob(root, NEUTRAL, "g5_safety");
  assert.equal(submitReview(NEUTRAL, "g5_safety", submission(job, "ACCEPTABLE", { omit: [job.items[0].item_id] }), { root, write: true }).ok, false);
  assert.notEqual(gatesOf(root).g5_safety, VERDICT.PASS);
  const esc = submission(job, (i) => (i.item_id === job.items[1].item_id ? "CLINICAL_ESCALATION_REQUIRED" : "ACCEPTABLE"), { reviewer: "Dr Clinical", role: "Consultant paediatrician" });
  const r = submitReview(NEUTRAL, "g5_safety", esc, { root, write: true });
  assert.equal(r.record.status, "REVISION_REQUIRED");
  assert.deepEqual(r.record.escalations, [job.items[1].item_id]);
  assert.notEqual(gatesOf(root).g5_safety, VERDICT.PASS);
  const ok = submitReview(NEUTRAL, "g5_safety", submission(job, "ACCEPTABLE", { reviewer: "Dr Clinical", role: "Consultant paediatrician" }), { root, write: true });
  assert.equal(ok.ok, true, errorsOf(ok));
  assert.equal(gatesOf(root).g5_safety, VERDICT.PASS);
});

test("completeness g9 - partial and a journey defect never PASS; a complete walk-through does", () => {
  const root = makeRoot("comp-g9");
  ensureRequiredHumanReviews(NEUTRAL, { root, write: true });
  const job = loadJob(root, NEUTRAL, "g9_journey");
  assert.equal(submitReview(NEUTRAL, "g9_journey", submission(job, "WORKS", { omit: [job.items[0].item_id, job.items[1].item_id] }), { root, write: true }).ok, false);
  assert.notEqual(gatesOf(root).g9_journey, VERDICT.PASS);
  const defect = submission(job, (i) => (i.item_id === job.items[12].item_id ? "DEFECT" : "WORKS"), { reviewer: "Operator Jane", role: "Journey reviewer" });
  const r = submitReview(NEUTRAL, "g9_journey", defect, { root, write: true });
  assert.equal(r.record.status, "REVISION_REQUIRED");
  assert.deepEqual(r.record.defects, [job.items[12].item_id]);
  assert.notEqual(gatesOf(root).g9_journey, VERDICT.PASS);
  const ok = submitReview(NEUTRAL, "g9_journey", submission(job, "WORKS", { reviewer: "Operator Jane", role: "Journey reviewer" }), { root, write: true });
  assert.equal(ok.ok, true, errorsOf(ok));
  assert.equal(gatesOf(root).g9_journey, VERDICT.PASS);
});

// =============================================================================================
// SCHEMA + AUDIT + SURFACE
// =============================================================================================
test("write-back - the product record stays schema-valid and the audit trail is complete", () => {
  const root = makeRoot("schema");
  ensureRequiredHumanReviews(NEUTRAL, { root, write: true });
  const job = loadJob(root, NEUTRAL, "g4_evidence");
  submitReview(NEUTRAL, "g4_evidence", submission(job, "SUPPORTED"), { root, write: true });
  const ajv = new Ajv({ allErrors: true, strict: false });
  ajv.addFormat("date-time", /^\d{4}-\d{2}-\d{2}T/);
  ajv.addFormat("date", /^\d{4}-\d{2}-\d{2}$/);
  for (const f of readdirSync(join(root, "schemas")).filter((x) => x.endsWith(".schema.json"))) {
    const s = readJson(join(root, "schemas", f)); s.$id = `https://swiipt.com/factory/schemas/${f}`;
    try { ajv.addSchema(s); } catch { /* dup */ }
  }
  const ok = ajv.validate("https://swiipt.com/factory/schemas/product.schema.json", readJson(pPath(root, NEUTRAL)));
  assert.ok(ok, ok ? "" : ajv.errors.map((e) => `${e.instancePath} ${e.message}`).join("; "));
  const audit = readJson(join(reviewsDir(root, NEUTRAL), "audit-log.json"));
  const e = audit.entries.at(-1);
  for (const k of ["at", "gate", "review_job_id", "reviewer", "authority", "reviewer_role", "qualification", "input_hash", "item_count", "overall", "canonical_record_ref"]) assert.ok(k in e, k);
  assert.equal(e.reviewer_kind, "HUMAN");
  assert.ok(!/api[_-]?key|secret|token/i.test(readFileSync(join(reviewsDir(root, NEUTRAL), "audit-log.json"), "utf8")));
});

test("surface - the console is human-readable and the Markdown export carries canonical ids", () => {
  const root = makeRoot("surface");
  ensureRequiredHumanReviews(NEUTRAL, { root, write: true });
  const p = readJson(pPath(root, NEUTRAL));
  const r = renderConsole(root, { productId: NEUTRAL, write: true });
  assert.equal(r.written, true);
  const html = readFileSync(r.path, "utf8");
  assert.ok(/Swiipt Review Console/.test(html));
  assert.ok(/g4 - Evidence Review/.test(html));
  assert.ok(/Required authority|authority/.test(html));
  assert.ok(/C-0\d/.test(html), "canonical item ids appear in the readable surface");
  assert.ok(!/reviewer_disposition/.test(html), "internal json keys are not the interface");
  const md = readFileSync(join(reviewsDir(root, NEUTRAL), "g4_evidence.md"), "utf8");
  assert.ok(/^# g4 - Evidence Review/m.test(md));
  assert.ok(md.includes("C-01"));
  assert.ok(/SUPPORTED/.test(md));
  for (const gate of HUMAN_REVIEW_GATES) assert.ok(existsSync(join(reviewsDir(root, NEUTRAL), `${gate}.md`)), `${gate}.md`);
});

// =============================================================================================
// FUTURE-PRODUCT PROOF (section 61)
// =============================================================================================
test("future product - a different product runs the whole workflow with no per-product code", () => {
  const root = makeRoot("future", (r) => {
    // give the second fixture the ordinary preconditions (deterministic QA + g3/g6 inputs),
    // exactly as production would; no V06/Night-Shift specifics.
    patchProduct(r, SECOND, (p) => {
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
    const src = readJson(join(r, "data", "products", SECOND, "assets", "AS-FIX3-DO-001.json"));
    writeJson(join(r, "data", "products", SECOND, "assets", "AS-FIX3-TRACK-001.json"), { ...src, asset_id: "AS-FIX3-TRACK-001", title: "The Fixture Tracker", job: "TRACK", format: "tracker" });
  });
  const ens = ensureRequiredHumanReviews(SECOND, { root, write: true });
  assert.equal(ens.ok, true, ens.error);
  assert.ok(ens.created.length >= 2, `expected derived reviews, got ${JSON.stringify(ens.created)}`);
  const map = { g4_evidence: ["SUPPORTED", "Dr Ada Reviewer", "Independent evidence reviewer"], g5_safety: ["ACCEPTABLE", "Dr Clinical", "Consultant"], g9_journey: ["WORKS", "Operator Jane", "Journey reviewer"] };
  for (const gate of ens.created) {
    const job = loadJob(root, SECOND, gate);
    const [disp, who, role] = map[gate];
    const r = submitReview(SECOND, gate, submission(job, disp, { reviewer: who, role }), { root, write: true });
    assert.equal(r.ok, true, `${gate}: ${errorsOf(r)}`);
  }
  const re = reevaluate(SECOND, { root });
  for (const gate of ens.created) assert.equal(gatesOf(root, SECOND)[gate], VERDICT.PASS, gate);
  assert.notEqual(re.gate_results.g10_publish, VERDICT.PASS);
  // no product-specific branching anywhere in the canonical module
  const src = readFileSync(join(ROOT, "harness", "review-jobs.mjs"), "utf8");
  for (const banned of ["PPL-NIGHT-SHIFT", "Every Night", "postpartum", "cord care", "Cord Care"]) {
    assert.ok(!src.includes(banned), `canonical workflow must not contain '${banned}'`);
  }
});
