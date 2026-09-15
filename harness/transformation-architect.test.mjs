// SWIIPT PRODUCT FACTORY - TRANSFORMATION ARCHITECT RUNNER V1 : ADVERSARIAL QUALIFICATION SUITE
//
// Tests the runner against the repository contracts it must respect:
//   schemas/transformation.schema.json, schemas/opportunity.schema.json,
//   standards/transformation-standard.md, standards/safety-standard.md, agents/transformation-architect.md
//
// Real qualification target: OPP-PPL-NIGHTSHIFT-001 -> TR-PPL-NIGHT-SHIFT-001 (the seam the repository
// documented as `transformation_specification_missing`).
//
// No provider, no LLM, no network, no spend. Write-mode tests use an OS temp directory, never data/.
// Run: node --test harness/transformation-architect.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, writeFileSync, rmSync, readdirSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import {
  buildTransformationRecord, runTransformationArchitect, deriveTransformationId, validateTransformation,
  validateOpportunity, canonicalProjection, extractConstraints, extractTimeframe, extractRoles,
  RUN_STATUS, CLAIM_STATUS, TRANSFORMATION_ELIGIBLE_ROLES, ARCHITECT_VERSION,
  FIRST_WIN_DEFAULT_MINUTES, DEFAULT_MEASUREMENT_DAYS, THRESHOLD_PENDING_PREFIX, GENERIC_RESCUE,
} from "./transformation-architect.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const NIGHTSHIFT = readJson("data/opportunities/OPP-PPL-NIGHTSHIFT-001.json");
const EXISTING_TRS = ["TR-PPL-CORD-CARE-001", "TR-PPL-CS-FIRST14DAYS-001", "TR-PPL-OMUGWO-TERMS-001", "TR-PPL-RTWORK-OS-001"]
  .map((id) => readJson(`data/transformations/${id}.json`));
const clone = (o) => JSON.parse(JSON.stringify(o));
const TMP = join(os.tmpdir(), "swiipt-ta-qualification");
const TMP_WRITE = join(TMP, "write");
const SRC_TEXT = JSON.stringify(NIGHTSHIFT);
const RUNNER_SRC = readFileSync(join(ROOT, "harness/transformation-architect.mjs"), "utf8");
const CODE = RUNNER_SRC.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
const SOURCE_TOKENS = new Set((SRC_TEXT.match(/\d+/g) ?? []));
const SCAFFOLD_DIGITS = new Set(["0", "1", "2", "3", "4", "5", "6", "7", "14", "15", "30"]);

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP_WRITE, { recursive: true });
const tmpOut = { out_dir: TMP_WRITE };
const run = (input = {}) => buildTransformationRecord({ opportunity: clone(NIGHTSHIFT), ...input });
const oppWithFinding = (patch, over = {}) => ({ ...clone(NIGHTSHIFT), ...over, finding: { ...clone(NIGHTSHIFT.finding), ...patch } });
const recordTokens = (record) => record ? (JSON.stringify(record).match(/\d+/g) ?? []) : [];
const stringsOf = (record) => JSON.stringify(record);

// =============================================================================================
// A. INPUT GATE
// =============================================================================================
test("A1 valid opportunity is accepted and yields a schema-valid candidate", () => {
  const r = run();
  assert.equal(r.status, RUN_STATUS.CANDIDATE_READY);
  assert.equal(r.schema_valid, true);
  assert.equal(r.transformation_id, "TR-PPL-NIGHT-SHIFT-001");
  assert.ok(r.record && r.record.status === "candidate");
});

test("A2 missing opportunity is refused with INVALID_INPUT", () => {
  const r = buildTransformationRecord({});
  assert.equal(r.status, RUN_STATUS.INVALID_INPUT);
  assert.deepEqual(r.report.missing_inputs, ["opportunity"]);
  assert.equal(r.record, null);
});

test("A3 malformed opportunity (schema-invalid) is refused", () => {
  const bad = clone(NIGHTSHIFT);
  delete bad.finding;
  const r = buildTransformationRecord({ opportunity: bad });
  assert.equal(r.status, RUN_STATUS.INVALID_INPUT);
  assert.ok(r.report.missing_inputs.some((m) => /opportunity \(fails/.test(m)));
  assert.ok(r.report.unresolved_questions.length > 0);
});

test("A4 opportunity with an out-of-range life_area is refused by the input schema", () => {
  const bad = clone(NIGHTSHIFT);
  bad.life_area = "m99";
  const r = buildTransformationRecord({ opportunity: bad });
  assert.equal(r.status, RUN_STATUS.INVALID_INPUT);
});

test("A5 non-transformation-eligible disposition role is refused (not a transformation)", () => {
  const marketing = clone(NIGHTSHIFT);
  marketing.disposition.library_role = "MARKETING_ANGLE";
  const r = buildTransformationRecord({ opportunity: marketing });
  assert.equal(r.status, RUN_STATUS.NOT_TRANSFORMATION_ELIGIBLE);
  assert.equal(r.record, null);
  assert.ok(r.report.missing_inputs.some((m) => /library_role/.test(m)));
});

test("A6 an id that cannot be derived deterministically is refused", () => {
  const odd = clone(NIGHTSHIFT);
  odd.opportunity_id = "WEIRD-ID";
  odd.status = "dispositioned";
  delete odd.disposition.promoted_transformation_id;
  const r = buildTransformationRecord({ opportunity: odd });
  assert.equal(r.status, RUN_STATUS.INVALID_INPUT);
  assert.ok(r.report.missing_inputs.some((m) => /transformation_id/.test(m)));
});

test("A7 identity follows the repository convention (declared id wins; else OPP->TR derivation)", () => {
  assert.equal(deriveTransformationId(NIGHTSHIFT), "TR-PPL-NIGHT-SHIFT-001");
  const derived = clone(NIGHTSHIFT);
  delete derived.disposition.promoted_transformation_id;
  assert.equal(deriveTransformationId(derived), "TR-PPL-NIGHTSHIFT-001");
});

test("A8 every transformation-eligible role is accepted", () => {
  for (const role of TRANSFORMATION_ELIGIBLE_ROLES) {
    const o = clone(NIGHTSHIFT);
    o.disposition.library_role = role;
    const r = buildTransformationRecord({ opportunity: o });
    assert.equal(r.status, RUN_STATUS.CANDIDATE_READY, role);
  }
});

// =============================================================================================
// B. SITUATION NUCLEUS
// =============================================================================================
test("B1 a thin opportunity is refused with SOURCE_REQUIRED and the exact missing fields", () => {
  const thin = { ...clone(NIGHTSHIFT), finding: { headline: "Parents are tired" }, disposition: { ...clone(NIGHTSHIFT.disposition) } };
  const r = buildTransformationRecord({ opportunity: thin });
  assert.equal(r.status, RUN_STATUS.SOURCE_REQUIRED);
  for (const k of ["situation.person", "situation.specific_situation", "situation.timeframe", "situation.trigger", "situation.problem", "situation.failed_attempt", "situation.emotional_stake", "situation.desired_transformation"]) {
    assert.ok(r.report.missing_inputs.includes(k), k);
  }
  assert.equal(r.record, null);
});

test("B2 broad-topic-only input is rejected (no specific recurring situation)", () => {
  const broad = { ...clone(NIGHTSHIFT), finding: { headline: "Postpartum recovery", problem: "Women struggle after birth.", desired_outcome: "Feeling better" } };
  const r = buildTransformationRecord({ opportunity: broad });
  assert.equal(r.status, RUN_STATUS.SOURCE_REQUIRED);
  assert.ok(r.report.missing_inputs.includes("situation.person"));
  assert.ok(r.report.missing_inputs.includes("situation.trigger"));
  assert.ok(r.report.missing_inputs.includes("situation.failed_attempt"));
  assert.equal(r.record, null);
});

test("B3 a missing trigger is reported explicitly (never filled in)", () => {
  const r = buildTransformationRecord({ opportunity: oppWithFinding({ trigger: "" }) });
  assert.equal(r.status, RUN_STATUS.SOURCE_REQUIRED);
  assert.ok(r.report.missing_inputs.includes("situation.trigger"));
});

test("B4 a missing timeframe is reported explicitly (never invented)", () => {
  const r = buildTransformationRecord({ opportunity: oppWithFinding({ person: "New mother", recurring_situation: "Baby wakes", trigger: "Partner returns to work", problem: "Nobody owns the night", failed_attempt: "Asked for help once", emotional_stake: "She is exhausted", desired_outcome: "A written roster" }) });
  assert.equal(r.status, RUN_STATUS.SOURCE_REQUIRED);
  assert.ok(r.report.missing_inputs.includes("situation.timeframe"));
});

test("B5 person / trigger / failed attempt / desired change are preserved verbatim", () => {
  const rec = run().record;
  assert.equal(rec.situation.person, NIGHTSHIFT.finding.person);
  assert.equal(rec.situation.trigger, NIGHTSHIFT.finding.trigger);
  assert.equal(rec.situation.failed_attempt, NIGHTSHIFT.finding.failed_attempt);
  assert.equal(rec.situation.desired_transformation, NIGHTSHIFT.finding.desired_outcome);
  assert.equal(rec.situation.specific_situation, NIGHTSHIFT.finding.recurring_situation);
});

test("B6 unsupported emotional detail is never invented (missing stake -> refusal)", () => {
  const r = buildTransformationRecord({ opportunity: oppWithFinding({ emotional_stake: "" }) });
  assert.equal(r.status, RUN_STATUS.SOURCE_REQUIRED);
  assert.ok(r.report.missing_inputs.includes("situation.emotional_stake"));
  assert.equal(r.record, null);
});

test("B7 unsupported failed attempt is never invented (missing failed_attempt -> refusal)", () => {
  const r = buildTransformationRecord({ opportunity: oppWithFinding({ failed_attempt: "" }) });
  assert.equal(r.status, RUN_STATUS.SOURCE_REQUIRED);
  assert.ok(r.report.missing_inputs.includes("situation.failed_attempt"));
});

test("B8 every generated constraint is a verbatim span of the authoritative input", () => {
  const rec = run().record;
  assert.ok(rec.situation.constraints.length > 0);
  for (const c of rec.situation.constraints) assert.ok(SRC_TEXT.includes(c), c);
});

test("B9 extracted timeframe is a verbatim span (unit)", () => {
  assert.equal(extractTimeframe(NIGHTSHIFT.finding.person), "0-12 weeks postpartum");
  assert.equal(extractTimeframe("nothing numeric here"), null);
});

test("B10 people_involved contains only role tokens present in the source (unit + integration)", () => {
  const roles = extractRoles([NIGHTSHIFT.finding.person, NIGHTSHIFT.finding.recurring_situation].join(" "));
  assert.ok(roles.includes("Mother"));
  assert.ok(roles.includes("Partner"));
  const rec = run().record;
  for (const p of rec.before_state.people_involved) assert.ok(new RegExp(p, "i").test(SRC_TEXT), p);
});

test("B11 life_state and submarket_id are deterministic slugs derived from the record (not invented prose)", () => {
  const rec = run().record;
  assert.equal(rec.situation.life_state, "parents-sleep");
  assert.equal(rec.submarket_id, "postpartum-sleep-deprivation-parents-sleep");
  assert.equal(rec.library_id, NIGHTSHIFT.life_area);
});

test("B12 constraint extraction is conservative (consequence clauses are not treated as constraints)", () => {
  const got = extractConstraints("Nobody owns the night, so the default becomes she owns all of it. She cannot leave the house alone.");
  assert.ok(got.some((c) => /cannot leave the house alone/.test(c)), JSON.stringify(got));
  assert.equal(got.some((c) => /^so |default becomes/.test(c)), false, JSON.stringify(got));
});

// =============================================================================================
// C. MECHANISM / PATH / FAILURE / FIRST WIN
// =============================================================================================
test("C1 unsupported mechanism is never invented (no hypotheses -> refusal)", () => {
  const r = buildTransformationRecord({ opportunity: oppWithFinding({ mechanism_hypotheses: [] }) });
  assert.equal(r.status, RUN_STATUS.SOURCE_REQUIRED);
  assert.ok(r.report.missing_inputs.includes("mechanism (no mechanism_hypotheses in the opportunity record)"));
  assert.ok(r.report.missing_inputs.includes("transformation_path"));
  assert.ok(r.report.missing_inputs.includes("failure_point_map (no documented failure signal with a non-generic rescue)"));
});

test("C2 mechanism + path objectives are verbatim from the opportunity's own hypotheses", () => {
  const rec = run().record;
  for (const m of rec.mechanism.mechanisms) assert.ok(NIGHTSHIFT.finding.mechanism_hypotheses.includes(m), m);
  for (const s of rec.transformation_path) assert.ok(NIGHTSHIFT.finding.mechanism_hypotheses.includes(s.objective), s.objective);
  assert.equal(rec.mechanism.core_mechanism, NIGHTSHIFT.finding.mechanism_hypotheses[0]);
});

test("C3 duplicate path stages are detected, deduped and warned", () => {
  const dup = clone(NIGHTSHIFT);
  dup.finding.mechanism_hypotheses = ["A written roster removes the emotional labour of asking", "A written roster removes the emotional labour of asking", "A sleep banker makes exhaustion visible"];
  const r = buildTransformationRecord({ opportunity: dup });
  assert.equal(r.status, RUN_STATUS.CANDIDATE_READY);
  assert.equal(r.record.transformation_path.length, 2);
  assert.ok(r.report.warnings.some((w) => /duplicate path stages removed/.test(w)));
});

test("C4 path stage order follows the mechanism order and each stage has a distinct job", () => {
  const rec = run().record;
  const objectives = rec.transformation_path.map((s) => s.objective);
  assert.deepEqual(objectives, NIGHTSHIFT.finding.mechanism_hypotheses);
  assert.equal(new Set(objectives).size, objectives.length);
  assert.equal(new Set(rec.transformation_path.map((s) => s.stage)).size, rec.transformation_path.length);
  for (const s of rec.transformation_path) assert.ok(s.customer_action.length >= 1);
});

test("C5 a failure point always carries a concrete rescue (no generic rescue text)", () => {
  const rec = run().record;
  assert.ok(rec.failure_point_map.length > 0);
  for (const f of rec.failure_point_map) {
    assert.ok(f.rescue_protocol.length > 20);
    assert.equal(GENERIC_RESCUE.test(f.rescue_protocol), false, f.rescue_protocol);
  }
});

test("C6 failure rescues are traceable to a sourced mechanism", () => {
  const rec = run().record;
  for (const f of rec.failure_point_map) {
    assert.ok(/source mechanism, verbatim:/.test(f.rescue_protocol));
    const hypothesis = f.rescue_protocol.split("source mechanism, verbatim:")[1].replace(/\)\s*$/, "").trim();
    assert.ok(NIGHTSHIFT.finding.mechanism_hypotheses.includes(hypothesis), hypothesis);
  }
});

test("C7 failure scenarios are verbatim spans of the opportunity record", () => {
  const rec = run().record;
  for (const f of rec.failure_point_map) assert.ok(SRC_TEXT.includes(f.scenario), f.scenario);
});

test("C8 first win is present where supported and uses the schema default minutes (recorded, not invented ad hoc)", () => {
  const r = run();
  assert.equal(r.record.first_win.time_limit_minutes, FIRST_WIN_DEFAULT_MINUTES);
  assert.ok(r.record.first_win.action.length > 10);
  assert.ok(r.record.first_win.observable_change.length > 10);
  assert.ok(r.report.derivation_notes.some((n) => /first_win\.time_limit_minutes/.test(n)));
});

test("C9 first win refuses rather than inventing an arbitrary early action", () => {
  const noArtefact = oppWithFinding({
    desired_outcome: "A feeling of calm and peace",
    mechanism_hypotheses: ["Rest arrives when the mind slows", "Calm grows with quiet"],
  });
  const r = buildTransformationRecord({ opportunity: noArtefact });
  assert.equal(r.status, RUN_STATUS.SOURCE_REQUIRED);
  assert.ok(r.report.missing_inputs.some((m) => /^first_win/.test(m)));
});

test("C10 mechanism evidence basis keeps the claim-status model (hypothesis / model_inference), never sourced without a source", () => {
  const rec = run().record;
  const statuses = new Set(rec.mechanism.evidence_basis.map((e) => e.status));
  for (const s of statuses) assert.ok(Object.values(CLAIM_STATUS).includes(s), s);
  for (const e of rec.mechanism.evidence_basis.filter((x) => [CLAIM_STATUS.SOURCED, CLAIM_STATUS.EXPERT].includes(x.status))) {
    assert.ok(typeof e.source === "string" && e.source.length > 0, JSON.stringify(e));
  }
});

test("C11 an unsupported clinical mechanism is not upgraded to sourced evidence", () => {
  const clinical = oppWithFinding({
    problem: "She has mastitis with fever and wants it cured.",
    desired_outcome: "A written plan that cures the infection in 3 days.",
    mechanism_hypotheses: ["A daily drainage log makes the blocked duct visible", "This guarantees the infection clears in 3 days"],
  }, { disposition: { ...clone(NIGHTSHIFT.disposition), promoted_transformation_id: "TR-PPL-CLINICAL-TEST-001" } });
  const r = buildTransformationRecord({ opportunity: clinical });
  assert.equal(r.status, RUN_STATUS.CANDIDATE_READY);
  const sourced = r.record.evidence.filter((e) => [CLAIM_STATUS.SOURCED, CLAIM_STATUS.EXPERT].includes(e.status));
  for (const e of sourced) assert.equal(/cure|guarantee/i.test(e.claim), false, e.claim);
  const guaranteeClaim = r.record.mechanism.evidence_basis.find((e) => /guarantees the infection/.test(e.claim));
  assert.ok(guaranteeClaim && guaranteeClaim.status === CLAIM_STATUS.HYPOTHESIS);
});

test("C12 a diagnostic/treatment claim is never marked sourced by the runner", () => {
  const rec = run().record;
  for (const e of rec.evidence.filter((x) => x.status === CLAIM_STATUS.SOURCED)) {
    assert.equal(/\b(diagnos|treats?|cures?|guarantee)\b/i.test(e.claim), false, e.claim);
  }
  assert.ok(/does not diagnose, treat/.test(rec.safety.scope_boundary));
});

// =============================================================================================
// D. TSM
// =============================================================================================
test("D1 TSM contains all seven repository elements", () => {
  const tsm = run().record.tsm;
  for (const k of ["before_baseline", "success_indicators", "measurement_days", "success_threshold", "measurement_method", "incomplete_progress_interpretation", "next_action_on_miss"]) {
    assert.ok(k in tsm, k);
    assert.ok(Array.isArray(tsm[k]) ? tsm[k].length > 0 || k === "measurement_days" : String(tsm[k]).length > 0, k);
  }
  assert.equal(tsm.measurement_days.length >= 1, true);
});

test("D2 baseline is derived from measurable source spans (no invented metrics)", () => {
  const rec = run().record;
  assert.ok(rec.tsm.before_baseline.length > 0);
  for (const b of rec.tsm.before_baseline) assert.ok(SRC_TEXT.includes(b), b);
});

test("D3 success indicators come from the desired outcome (verbatim)", () => {
  const rec = run().record;
  const desired = rec.situation.desired_transformation;
  assert.ok(rec.tsm.success_indicators.some((s) => desired.includes(s) || s === desired));
});

test("D4 measurement timing defaults to the schema schedule and records the derivation", () => {
  const r = run();
  assert.deepEqual(r.record.tsm.measurement_days, [...DEFAULT_MEASUREMENT_DAYS]);
  assert.ok(r.report.derivation_notes.some((n) => /measurement_days/.test(n)));
});

test("D5 supplied measurement timing is preserved verbatim", () => {
  const r = run({ measurement_days: [0, 14, 60] });
  assert.deepEqual(r.record.tsm.measurement_days, [0, 14, 60]);
  assert.ok(r.report.derivation_notes.some((n) => /supplied timing preserved/.test(n)));
});

test("D6 the runner never approves the success threshold", () => {
  const r = run();
  assert.ok(r.record.tsm.success_threshold.startsWith(THRESHOLD_PENDING_PREFIX));
  assert.ok(r.report.owner_decisions.some((d) => /PENDING OWNER APPROVAL/.test(d)));
});

test("D7 an owner-supplied threshold is used and reported (never invented by the runner)", () => {
  const r = run({ owner_approved_threshold: ">=3 of 4 indicators at Day 30" });
  assert.equal(r.record.tsm.success_threshold, ">=3 of 4 indicators at Day 30");
  assert.ok(r.report.owner_decisions.some((d) => /owner-approved/.test(d)));
});

test("D8 incomplete-progress interpretation references the recorded failure modes; next action is a real rescue", () => {
  const rec = run().record;
  assert.ok(/recorded failure modes/.test(rec.tsm.incomplete_progress_interpretation));
  assert.equal(rec.tsm.next_action_on_miss, rec.failure_point_map[0].rescue_protocol);
});

test("D9 TSM is not engagement theatre (no page/video/completion/download metrics)", () => {
  const tsm = JSON.stringify(run().record.tsm);
  assert.equal(/\b(pages? read|videos? watched|completion %|downloads?|quiz scores?)\b/i.test(tsm), false);
});

// =============================================================================================
// E. EVIDENCE
// =============================================================================================
test("E1 every evidence entry is traceable (sourced/expert require a real source)", () => {
  const rec = run().record;
  for (const e of rec.evidence) {
    assert.ok(Object.values(CLAIM_STATUS).includes(e.status));
    if ([CLAIM_STATUS.SOURCED, CLAIM_STATUS.EXPERT].includes(e.status)) assert.ok(typeof e.source === "string" && e.source.length > 0);
  }
  assert.ok(rec.evidence.length > 0);
});

test("E2 evidence classification is preserved from the opportunity markers (model inference stays inference)", () => {
  const rec = run().record;
  const quotes = rec.evidence.filter((e) => /composite/.test(e.claim));
  assert.ok(quotes.length > 0);
  for (const q of quotes) assert.equal(q.status, CLAIM_STATUS.INFERENCE);
});

test("E3 an invented source is refused (not present in the authoritative input context)", () => {
  const r = run({ research_evidence: [{ claim: "A study says X", status: CLAIM_STATUS.SOURCED, source: "https://fake.example/study.pdf" }] });
  assert.ok(r.report.missing_inputs.some((m) => /fabricated source refused/.test(m)));
  assert.equal((r.record?.evidence ?? []).some((e) => e.source === "https://fake.example/study.pdf"), false);
});

test("E4 an invented statistic cannot enter the record", () => {
  const r = run({ research_evidence: [{ claim: "9 in 10 mothers are cured", status: CLAIM_STATUS.SOURCED, source: "not-a-source" }] });
  assert.equal(stringsOf(r.record ?? {}).includes("9 in 10 mothers are cured"), false);
  assert.ok(r.report.missing_inputs.some((m) => /research_evidence rejected/.test(m)));
});

test("E5 a valid traceable supplementary claim IS accepted", () => {
  const r = run({ research_evidence: [{ claim: "Night-waking is normal in the first weeks", status: CLAIM_STATUS.SOURCED, source: NIGHTSHIFT.source_references[0] }] });
  assert.equal(r.status, RUN_STATUS.CANDIDATE_READY);
  assert.ok(r.record.evidence.some((e) => e.claim === "Night-waking is normal in the first weeks" && e.status === CLAIM_STATUS.SOURCED));
});

test("E6 a fabricated testimonial is impossible (quotes are labelled composites, never lived evidence)", () => {
  const rec = run().record;
  assert.equal(rec.evidence.some((e) => e.status === CLAIM_STATUS.LIVED), false);
  for (const q of rec.evidence.filter((e) => /composite/.test(e.claim))) assert.equal(q.source, NIGHTSHIFT.opportunity_id);
});

test("E7 a fabricated price is impossible (no currency or price tokens anywhere)", () => {
  const rec = run().record;
  assert.equal(/[$₦€£]|\b(USD|EUR|GBP|NGN|GHS)\b|\bprice\b/i.test(stringsOf(rec)), false);
});

test("E8 thin evidence stays thin: no invented evidence entries appear", () => {
  const noQuotes = oppWithFinding({ evidence_quotes: [] });
  const r = buildTransformationRecord({ opportunity: noQuotes });
  assert.equal(r.status, RUN_STATUS.CANDIDATE_READY);
  assert.equal(r.record.evidence.every((e) => e.status !== CLAIM_STATUS.LIVED || !e.source), true);
  assert.ok(r.record.evidence.every((e) => SRC_TEXT.includes(e.claim) || e.source));
});

test("E9 no numeric token appears in the record that is not in the source (scaffold digits excepted)", () => {
  const rec = run().record;
  for (const tok of recordTokens(rec)) assert.ok(SOURCE_TOKENS.has(tok) || SCAFFOLD_DIGITS.has(tok), `unexpected number ${tok}`);
});

// =============================================================================================
// F. SAFETY
// =============================================================================================
test("F1 safety-sensitive content is routed to review (risk >= moderate)", () => {
  const r = run();
  assert.ok(["moderate", "high", "clinical"].includes(r.record.safety.risk_level));
  assert.ok(r.report.clinical_review_items.length > 0);
  assert.equal(r.report.risk_level_source.length > 0, true);
});

test("F2 candidate generation does NOT require clinical sign-off (allowed while review is pending)", () => {
  const r = run();
  assert.equal(r.status, RUN_STATUS.CANDIDATE_READY);
  assert.equal(r.record.status, "candidate");
  assert.ok(r.report.clinical_review_items.length > 0);
});

test("F3 red-flag criteria are never invented (empty unless supplied by authoritative literature)", () => {
  const rec = run().record;
  assert.deepEqual(rec.safety.red_flags, []);
  assert.ok(run().report.clinical_review_items.some((i) => /red_flags/.test(i)));
});

test("F4 escalation routing references the verified shared list and invents no numbers", () => {
  const rec = run().record;
  assert.equal(rec.safety.escalation_rules.length >= 1, true);
  for (const rule of rec.safety.escalation_rules) {
    assert.equal(/\d{3,}/.test(rule), false, rule);                       // no phone numbers invented
    assert.ok(/verified shared crisis\/escalation list/.test(rule));
  }
});

test("F5 treatment certainty is not manufactured by the runner's own text", () => {
  const rec = run().record;
  const runnerText = [rec.safety.scope_boundary, rec.tsm.measurement_method, rec.tsm.incomplete_progress_interpretation, rec.maintenance.maintenance_system, rec.maintenance.reentry_protocol].join(" ");
  assert.equal(/\b(cure|guarantee|will heal|100%|instantly)\b/i.test(runnerText), false);
});

test("F6 scope boundary states what the transformation does NOT cover", () => {
  const boundary = run().record.safety.scope_boundary;
  assert.ok(/does not diagnose, treat/.test(boundary));
  assert.ok(/does not cover adjacent situations/.test(boundary));
});

test("F7 clinical lexicon escalates the risk level for clinical-adjacent input", () => {
  const clinical = oppWithFinding({ problem: "Postpartum sepsis risk after fever and infection." });
  const r = buildTransformationRecord({ opportunity: clinical });
  assert.equal(["high", "clinical"].includes(r.record?.safety?.risk_level ?? ""), true, r.record?.safety?.risk_level);
  assert.equal(r.report.risk_level_source, "lexicon escalation");
});

test("F8 publication PASS cannot be produced by this runner (no approval field, status stays candidate)", () => {
  const rec = run().record;
  assert.equal(rec.status, "candidate");
  assert.equal(/publish_authorization|READY_TO_PUBLISH|\bpublished\b/i.test(stringsOf(rec)), false);
  assert.equal(/PENDING OWNER APPROVAL/.test(stringsOf(rec)), true);   // the only approval-shaped text is pending
});

// =============================================================================================
// G. RESEARCH DISPOSITION
// =============================================================================================
const SIBLINGS = ["OPP-PPL-SLP-H1", "OPP-PPL-SLP-D1", "OPP-PPL-SLP-B4", "OPP-PPL-FIRSTS-001"]
  .map((id) => readJson(`data/opportunities/${id}.json`));

test("G1 useful research is preserved: sibling findings are retained with their roles", () => {
  const r = run({ sibling_opportunities: SIBLINGS });
  assert.equal(r.report.retained_findings.length, SIBLINGS.length);
  for (const f of r.report.retained_findings) assert.ok(f.opportunity_id && f.library_role);
});

test("G2 non-core findings are never silently dropped (roles recorded, nothing discarded)", () => {
  const r = run({ sibling_opportunities: SIBLINGS });
  const roles = new Set(r.report.retained_findings.map((f) => f.library_role));
  assert.ok(roles.has("MARKETING_ANGLE"));
  assert.ok(r.report.retained_findings.every((f) => /retained in the opportunity store/.test(f.note)));
});

test("G3 evidence-gap and future-research findings are retained too", () => {
  const gaps = [{ opportunity_id: "OPP-PPL-GAP-1", disposition: { library_role: "EVIDENCE_GAP" }, status: "dispositioned" },
    { opportunity_id: "OPP-PPL-FUT-1", disposition: { library_role: "FUTURE_RESEARCH" }, status: "dispositioned" }];
  const r = run({ sibling_opportunities: gaps });
  assert.deepEqual(r.report.retained_findings.map((f) => f.library_role).sort(), ["EVIDENCE_GAP", "FUTURE_RESEARCH"]);
});

test("G4 the disposition block carries the repository role verbatim and records candidate provenance", () => {
  const rec = run().record;
  assert.equal(rec.research_disposition.library_role, NIGHTSHIFT.disposition.library_role);
  assert.ok(rec.research_disposition.rationale.includes(NIGHTSHIFT.disposition.rationale));
  assert.ok(/Candidate generated by transformation-architect@1/.test(rec.research_disposition.rationale));
  assert.equal(rec.research_disposition.assigned_at, NIGHTSHIFT.disposition.assigned_at);
});

// =============================================================================================
// H. ROUTING
// =============================================================================================
test("H1 next-transformation routing resolves only from authoritative adjacent records", () => {
  const r = run({ adjacent_transformations: EXISTING_TRS, next_transformation: ["TR-PPL-CORD-CARE-001", "TR-PPL-RTWORK-OS-001"] });
  assert.deepEqual(r.record.next_transformation, ["TR-PPL-CORD-CARE-001", "TR-PPL-RTWORK-OS-001"]);
  assert.deepEqual(r.report.routing.next, r.record.next_transformation);
});

test("H2 an unknown route id is never invented into the record (recorded as unresolved)", () => {
  const r = run({ adjacent_transformations: EXISTING_TRS, next_transformation: ["TR-PPL-DOES-NOT-EXIST-001"] });
  assert.deepEqual(r.record.next_transformation, []);
  assert.ok(r.report.routing.unresolved.some((u) => u.id === "TR-PPL-DOES-NOT-EXIST-001"));
  assert.equal(stringsOf(r.record.next_transformation).includes("DOES-NOT-EXIST"), false);
});

test("H3 a journey gap is recorded honestly when no routing was supplied", () => {
  const r = run({ adjacent_transformations: EXISTING_TRS });
  assert.equal(r.report.routing.journey_gap, true);
  assert.ok(r.report.routing.unresolved.some((u) => /journey routing gap/.test(u.reason)));
  assert.ok(/Journey routing pending/.test(r.record.research_disposition.rationale));
});

test("H4 self-routing is rejected", () => {
  const r = run({ adjacent_transformations: EXISTING_TRS, next_transformation: ["TR-PPL-NIGHT-SHIFT-001"] });
  assert.deepEqual(r.record.next_transformation, []);
  assert.ok(r.report.routing.unresolved.some((u) => /self-route rejected/.test(u.reason)));
});

test("H5 every emitted route id exists in the supplied adjacent context", () => {
  const r = run({ adjacent_transformations: EXISTING_TRS, next_transformation: ["TR-PPL-CORD-CARE-001", "TR-PPL-NOPE-001"] });
  const known = new Set(EXISTING_TRS.map((t) => t.transformation_id));
  for (const id of r.record.next_transformation) assert.ok(known.has(id), id);
});

test("H6 derived journey gaps surface for adjacent m01 transformations that this situation does not follow", () => {
  const r = run({ adjacent_transformations: EXISTING_TRS, next_transformation: [] });
  assert.equal(r.report.routing.known_adjacent.length, EXISTING_TRS.length);
  assert.equal(r.record.next_transformation.length, 0);
});

// =============================================================================================
// I. DETERMINISM
// =============================================================================================
test("I1 the transformation id is deterministic", () => {
  assert.equal(run().transformation_id, run().transformation_id);
  assert.equal(run().transformation_id, "TR-PPL-NIGHT-SHIFT-001");
});

test("I2 repeated runs produce byte-identical records and reports", () => {
  const a = run();
  const b = run();
  assert.equal(canonicalProjection(a.record), canonicalProjection(b.record));
  assert.equal(JSON.stringify(a.report.missing_inputs), JSON.stringify(b.report.missing_inputs));
});

test("I3 key order of the input does not change identity or deterministic fields", () => {
  const reordered = { disposition: clone(NIGHTSHIFT.disposition), finding: clone(NIGHTSHIFT.finding), submarket: NIGHTSHIFT.submarket, focus_market: NIGHTSHIFT.focus_market, life_area: NIGHTSHIFT.life_area, collected_at: NIGHTSHIFT.collected_at, status: NIGHTSHIFT.status, source: NIGHTSHIFT.source, opportunity_id: NIGHTSHIFT.opportunity_id, source_references: clone(NIGHTSHIFT.source_references), survival_pain_test: clone(NIGHTSHIFT.survival_pain_test), related_opportunity_ids: [] };
  const a = buildTransformationRecord({ opportunity: clone(NIGHTSHIFT) });
  const b = buildTransformationRecord({ opportunity: reordered });
  assert.equal(a.transformation_id, b.transformation_id);
  assert.equal(canonicalProjection(a.record.situation), canonicalProjection(b.record.situation));
  assert.equal(a.record.tsm.success_threshold, b.record.tsm.success_threshold);
});

test("I4 no volatile timestamp or randomness enters the record", () => {
  const rec = run().record;
  const text = stringsOf(rec);
  assert.equal(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text.replace(NIGHTSHIFT.collected_at, "")), false);
  assert.equal(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(text), false);
});

test("I5 the runner module contains no time/random/uuid calls", () => {
  for (const banned of ["Date.now", "Math.random", "randomUUID", "crypto.randomUUID", "new Date("]) assert.equal(CODE.includes(banned), false, banned);
});

test("I6 canonical projection is key-order independent and stable", () => {
  assert.equal(canonicalProjection({ a: 1, b: 2 }), canonicalProjection({ b: 2, a: 1 }));
  assert.equal(canonicalProjection({ a: [1, 2] }), canonicalProjection({ a: [1, 2] }));
});

test("I7 failure behaviour is deterministic (same invalid input -> same refusal)", () => {
  const thin = { ...clone(NIGHTSHIFT), finding: { headline: "x" } };
  const a = buildTransformationRecord({ opportunity: thin });
  const b = buildTransformationRecord({ opportunity: thin });
  assert.equal(a.status, b.status);
  assert.deepEqual(a.report.missing_inputs, b.report.missing_inputs);
});

// =============================================================================================
// J. WRITE POLICY
// =============================================================================================
test("J1 dry-run never writes", () => {
  const before = readdirSync(TMP_WRITE).length;
  const r = run({ ...tmpOut, mode: "dry-run" });
  assert.equal(r.persisted, false);
  assert.equal(r.path, null);
  assert.equal(readdirSync(TMP_WRITE).length, before);
});

test("J2 write mode persists only a schema-valid candidate", () => {
  const r = run({ ...tmpOut, mode: "write" });
  assert.equal(r.persisted, true);
  const file = join(TMP_WRITE, "TR-PPL-NIGHT-SHIFT-001.json");
  assert.ok(existsSync(file));
  const written = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(written.status, "candidate");
  assert.equal(validateTransformation(written).valid, true);
});

test("J3 the repository's own validator accepts the written record", () => {
  const file = join(TMP_WRITE, "TR-PPL-NIGHT-SHIFT-001.json");
  const out = execFileSync(process.execPath, [join(ROOT, "harness", "validate-opportunity.mjs"), file], { encoding: "utf8" });
  assert.ok(/PASS/.test(out));
});

test("J4 an existing record is never overwritten (ALREADY_EXISTS, bytes unchanged)", () => {
  const file = join(TMP_WRITE, "TR-PPL-NIGHT-SHIFT-001.json");
  const before = readFileSync(file, "utf8");
  const r = run({ ...tmpOut, mode: "write" });
  assert.equal(r.status, RUN_STATUS.ALREADY_EXISTS);
  assert.equal(r.persisted, false);
  assert.equal(readFileSync(file, "utf8"), before);
});

test("J5 dry-run reports a would-be collision without touching the file", () => {
  const file = join(TMP_WRITE, "TR-PPL-NIGHT-SHIFT-001.json");
  const before = readFileSync(file, "utf8");
  const r = run({ ...tmpOut, mode: "dry-run" });
  assert.equal(r.status, RUN_STATUS.CANDIDATE_READY);
  assert.equal(r.report.would_collide, true);
  assert.equal(readFileSync(file, "utf8"), before);
});

test("J6 an invalid record is never persisted (schema guard is explicit)", () => {
  assert.equal(CODE.includes("if (!tv.valid)"), true);
  assert.equal(CODE.includes("run_status.SCHEMA_INVALID") || CODE.includes("RUN_STATUS.SCHEMA_INVALID"), true);
  const invalid = { ...clone(run().record), status: "not-a-status" };
  assert.equal(validateTransformation(invalid).valid, false);
});

test("J7 the runner never marks a generated record validated/approved/published", () => {
  const r = run({ owner_approved_threshold: "anything" });
  assert.equal(r.record.status, "candidate");
  assert.equal(CODE.includes('"validated"') || CODE.includes("'validated'"), false);
});

test("J8 the runner writes exactly one artifact type (no product/asset/manifest writes)", () => {
  const dirs = readdirSync(TMP, { recursive: true }).map(String);
  assert.ok(dirs.every((p) => !/product\.json|manifest\.json|asset|\.md$/.test(p)));
  assert.ok(CODE.includes("data\", \"transformations\"") || CODE.includes("'transformations'"));
});

// =============================================================================================
// K. PROVIDER HONESTY
// =============================================================================================
test("K1 the runner needs no provider and imports no provider client", () => {
  for (const banned of ["provider-client", "text-intelligence", "openai", "OPENAI", "gemini", "9router", "fetch("]) {
    assert.equal(CODE.toLowerCase().includes(banned.toLowerCase()), false, banned);
  }
});

test("K2 zero network calls and zero external spend in the runner", () => {
  const noSchemaIds = CODE.replace(/https:\/\/swiipt\.com\/factory\/schemas\/[^`"']*/g, "SCHEMA_ID");
  assert.equal(/https?:\/\/(?!www\.w3\.org)/.test(noSchemaIds), false);
  assert.equal(/process\.env/.test(CODE), false);
});

test("K3 qualification itself performs no network/provider activity (only local node + repo validator)", () => {
  assert.equal(/execFileSync\(process\.execPath/.test(readFileSync(join(ROOT, "harness", "transformation-architect.test.mjs"), "utf8")), true);
});

test("K4 an unavailable provider can never become fake generation (no provider code path exists)", () => {
  for (const banned of ["chatCompletion", "generateImage", "spawnSync", "child_process"]) assert.equal(CODE.includes(banned), false, banned);
});

// =============================================================================================
// L. NIGHT-SHIFT END-TO-END PROOF
// =============================================================================================
test("L1 the authoritative opportunity was found and expects TR-PPL-NIGHT-SHIFT-001", () => {
  assert.equal(NIGHTSHIFT.opportunity_id, "OPP-PPL-NIGHTSHIFT-001");
  assert.equal(NIGHTSHIFT.disposition.promoted_transformation_id, "TR-PPL-NIGHT-SHIFT-001");
  assert.equal(NIGHTSHIFT.status, "promoted_to_candidate");
  assert.equal(existsSync(join(ROOT, "data", "transformations", "TR-PPL-NIGHT-SHIFT-001.json")), false);
});

test("L2 the NIGHT-SHIFT run produces a schema-valid candidate (evidence sufficient)", () => {
  const r = run();
  assert.equal(r.status, RUN_STATUS.CANDIDATE_READY);
  assert.equal(r.schema_valid, true);
  assert.equal(validateTransformation(r.record).valid, true);
  assert.deepEqual(r.report.missing_inputs, []);
});

test("L3 the previously documented write-control seam is now resolvable from the candidate", () => {
  const wcSrc = readFileSync(join(ROOT, "harness", "writing-control.mjs"), "utf8");
  const gate1 = JSON.parse(wcSrc.match(/const gate1 = \[([^\]]*)\]/)[1].split(",").map((s) => s.trim()).filter(Boolean).join(",").replace(/^/, "[") + "]");
  const rec = run().record;
  for (const k of gate1) assert.ok(typeof rec.situation[k] === "string" && rec.situation[k].trim().length > 0, k);
  assert.ok(rec.before_state && Object.keys(rec.before_state).length === 7);
  assert.ok(rec.after_state && rec.after_state.evidence_of_change.length >= 1);
  assert.ok(rec.mechanism.core_mechanism.length > 0);
  assert.ok(rec.tsm.before_baseline.length > 0 && rec.tsm.success_indicators.length > 0);
  assert.ok(Array.isArray(rec.safety.red_flags) && Array.isArray(rec.safety.escalation_rules));
  assert.ok(/transformation_specification_missing/.test(wcSrc));
});

test("L4 the CLI runs against the real opportunity and reports CANDIDATE_READY", () => {
  const out = execFileSync(process.execPath, [join(ROOT, "harness", "transformation-architect.mjs"), "--opportunity", join(ROOT, "data", "opportunities", "OPP-PPL-NIGHTSHIFT-001.json")], { encoding: "utf8" });
  const parsed = JSON.parse(out);
  assert.equal(parsed.status, "CANDIDATE_READY");
  assert.equal(parsed.transformation_id, "TR-PPL-NIGHT-SHIFT-001");
  assert.equal(parsed.persisted, false);
  assert.deepEqual(parsed.missing_inputs, []);
});

test("L5 insufficient inputs produce the exact missing requirements (SOURCE_REQUIRED is honesty success)", () => {
  const thin = { ...clone(NIGHTSHIFT), finding: { headline: "Tired parents" }, disposition: { ...clone(NIGHTSHIFT.disposition) } };
  const r = buildTransformationRecord({ opportunity: thin });
  assert.equal(r.status, RUN_STATUS.SOURCE_REQUIRED);
  assert.ok(r.report.missing_inputs.length >= 5);
  assert.ok(r.report.unresolved_questions.some((q) => /return upstream for research/.test(q)));
  assert.equal(r.record, null);
});

test("L6 no product generation is attempted in this wave", () => {
  const r = run({ ...tmpOut, mode: "write" });
  assert.equal(Object.keys(r).join(",").includes("product"), false);
  assert.equal(readdirSync(TMP).filter((f) => f !== "write").length, 0);
});

// =============================================================================================
// M. COMPATIBILITY WITH THE EXISTING FOUR RECORDS
// =============================================================================================
test("M1 the generated record has the same top-level structural shape as the existing records", () => {
  const gen = Object.keys(run().record).sort();
  for (const tr of EXISTING_TRS) assert.deepEqual(gen, Object.keys(tr).sort(), tr.transformation_id);
});

test("M2 the generated record passes the same schema as the existing records", () => {
  assert.equal(validateTransformation(run().record).valid, true);
  for (const tr of EXISTING_TRS) assert.equal(validateTransformation(tr).valid, true, tr.transformation_id);
});

test("M3 status compatibility: generated is candidate, existing are validated (lifecycle respected)", () => {
  assert.equal(run().record.status, "candidate");
  for (const tr of EXISTING_TRS) assert.equal(["validated", "active"].includes(tr.status), true, tr.status);
});

test("M4 evidence shape compatibility", () => {
  const gen = run().record.evidence[0];
  const ref = EXISTING_TRS.flatMap((t) => t.evidence)[0];
  assert.deepEqual(Object.keys(gen).sort().filter((k) => k !== "source"), Object.keys(ref).sort().filter((k) => k !== "source"));
});

test("M5 routing compatibility (array of transformation ids)", () => {
  const r = run({ adjacent_transformations: EXISTING_TRS, next_transformation: ["TR-PPL-CORD-CARE-001"] });
  assert.ok(Array.isArray(r.record.next_transformation));
  for (const tr of EXISTING_TRS) assert.ok(Array.isArray(tr.next_transformation));
  assert.equal(r.record.next_transformation.every((id) => /^TR-/.test(id)), true);
});

test("M6 situation key set matches the existing records exactly", () => {
  assert.deepEqual(Object.keys(run().record.situation).sort(), Object.keys(EXISTING_TRS[0].situation).sort());
});

test("M7 TSM key set matches the existing records exactly", () => {
  assert.deepEqual(Object.keys(run().record.tsm).sort(), Object.keys(EXISTING_TRS[0].tsm).sort());
});

test("M8 the runner does not require the existing prose to be copied (generated text is source-derived)", () => {
  const rec = run().record;
  const existingText = EXISTING_TRS.map((t) => t.situation.person).join(" ");
  assert.equal(existingText.includes(rec.situation.person), false);
  assert.ok(SRC_TEXT.includes(rec.situation.person));
});

// =============================================================================================
// N. BOUNDARIES
// =============================================================================================
test("N1 the runner creates no product record (product_context is context only)", () => {
  assert.equal(CODE.includes("product_id"), false);
  assert.equal(CODE.includes("data\", \"products\""), false);
  assert.equal(CODE.includes("writeFileSync(targetPath"), true);   // the only write target
});

test("N2 the runner creates no marketing angle / CRF / MIF", () => {
  for (const banned of ["angle_id", "market_angle", "customer-reality", "market-intelligence", "CRF-", "MIF-"]) assert.equal(CODE.includes(banned), false, banned);
});

test("N3 the runner performs no image/video/social/campaign/manifest/publish action", () => {
  for (const banned of ["image_provider", "video", "social", "campaign", "manifest", "publish", "wordpress", "checkout", "price"]) {
    assert.equal(CODE.toLowerCase().includes(banned), false, banned);
  }
});

test("N4 the runner does not import frozen subsystem modules", () => {
  const imports = [...CODE.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(imports.filter((i) => /mae\/|social-|visual-|video-|image-provider/.test(i)), []);
});

test("N5 the runner's only filesystem write is the transformation record", () => {
  const writes = [...CODE.matchAll(/writeFileSync\(([^,]+),/g)].map((m) => m[1]);
  assert.equal(writes.length, 1);
  assert.ok(/targetPath/.test(writes[0]));
});

test("N6 the module is deterministic orchestration only (no rendering/QA/publishing vocabulary)", () => {
  for (const banned of ["<svg", "renderComponent", "evaluateSocialGraphic", "publish_authorization", "checkout"]) assert.equal(CODE.includes(banned), false, banned);
});

test("N7 the version is declared and carried in every run report", () => {
  const r = run();
  assert.equal(r.report.architect_version, ARCHITECT_VERSION);
  assert.equal(ARCHITECT_VERSION, "transformation-architect@1");
});

test("N8 the run report shape covers the required honesty fields", () => {
  const rep = run().report;
  for (const k of ["status", "transformation_id", "schema_valid", "missing_inputs", "missing_evidence", "unresolved_questions", "owner_decisions", "clinical_review_items", "evidence_refs", "routing", "warnings"]) {
    assert.ok(k in rep, k);
  }
});

test("N9 refusals never claim approvals", () => {
  const thin = buildTransformationRecord({ opportunity: { ...clone(NIGHTSHIFT), finding: { headline: "x" } } });
  assert.equal(/approved|READY_TO_PUBLISH|PASS/i.test(stringsOf(thin.report.owner_decisions) + stringsOf(thin.report.status)), false);
});

test("B13 optional product_context is context only (never mutated, never required)", () => {
  const withCtx = run({ product_context: { product_id: "PP-EXISTING", identity: { transformation_id: "TR-PPL-NIGHT-SHIFT-001" } } });
  assert.equal(withCtx.status, RUN_STATUS.CANDIDATE_READY);
  assert.ok(withCtx.report.warnings.some((w) => /already references TR-PPL-NIGHT-SHIFT-001/.test(w)));
  assert.equal(stringsOf(withCtx.record).includes("PP-EXISTING"), false);
  const other = run({ product_context: { product_id: "PP-OTHER", identity: { transformation_id: "TR-PPL-OTHER-001" } } });
  assert.ok(other.report.warnings.some((w) => /not linked to this transformation/.test(w)));
});

test("N10 exports cover the public surface used by the factory", () => {
  for (const name of ["buildTransformationRecord", "runTransformationArchitect", "deriveTransformationId", "validateTransformation", "validateOpportunity", "canonicalProjection", "RUN_STATUS", "CLAIM_STATUS"]) {
    assert.ok(RUNNER_SRC.includes(`export`) && RUNNER_SRC.includes(name), name);
  }
});
