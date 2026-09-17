#!/usr/bin/env node
// SWIIPT RESEARCH-TO-TRANSFORMATION PIPELINE V1 — ACCEPTANCE SUITE (task §19 TEST A–R + §25/§26 forensics).
//
// Every test drives the REAL code (schemas + harnesses + gates), never agent prose. Deterministic,
// provider-free, $0, no network. Write-mode tests use OS temp directories.
// Run: node --test harness/research-pipeline.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, cpSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { createHash } from "node:crypto";
import {
  buildTransformationRecord, extractConstraints, extractGeographyTokens,
  sameNucleusModuloContext, nucleusSimilarity, RUN_STATUS,
} from "./transformation-architect.mjs";
import { APPLICABILITY, POSSIBLE_DUPLICATE_FLOOR, situationNucleus, decideCatalogueOutcome, APPLICABILITY_OUTCOMES } from "./applicability.mjs";
import { ingestResearch } from "./ingest-research.mjs";
import { createGap, resolveGap, reEvaluateGap, listGaps, blockingGapsForStage } from "./research-gaps.mjs";
import { validateTransformationRecord } from "./validate-transformation.mjs";
import { pipelineState, authorTransformation, loadCatalogue } from "./pipeline.mjs";
import { evaluateProductGates } from "./product-qa-gate-runner.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const clone = (o) => JSON.parse(JSON.stringify(o));
const NIGHTSHIFT = readJson("data/opportunities/OPP-PPL-NIGHTSHIFT-001.json");
const NIGHTSHIFT_TR = readJson("data/transformations/TR-PPL-NIGHT-SHIFT-001.json");
const TMP = join(os.tmpdir(), "swiipt-research-pipeline");
const NEW_TS = "2026-09-17T00:00:00.000Z";
const EMPTY_LEDGER = { checks: [], summary: { pass: 0, fail: 0, total: 0 } };

function fresh(name) { const d = join(TMP, name); rmSync(d, { recursive: true, force: true }); mkdirSync(d, { recursive: true }); return d; }
const oppWith = (patch) => ({ ...clone(NIGHTSHIFT), finding: { ...clone(NIGHTSHIFT.finding), ...patch } });
const researchDoc = (payload) => `# Field notes\n\nNarrative prose about the situation.\n\n\`\`\`swiipt-research\n${JSON.stringify(payload, null, 2)}\n\`\`\`\n`;
const ingestPayload = (opId, extra = {}) => ({
  life_area: "m01",
  focus_market: "Postpartum & New Parent Life",
  submarket: "Sleep deprivation - night care",
  provenance: {
    source_label: "Lagos field notes", source_date: "2026-09-17", population: "Lagos mothers",
    geography: "Nigeria", jurisdiction: null, cultural_context: ["nigerian_urban"], limitations: ["single site; snippet-grade"],
  },
  findings: [{ opportunity_id: opId, finding: clone(NIGHTSHIFT.finding), ...extra }],
});

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

// =============================================================================================
// TEST A — arbitrary single-geography research
// =============================================================================================
test("TEST A — single-geography research: provenance retained, canonical transformation does not inherit geography", () => {
  const opp = oppWith({ person: "Nigerian first-time mother 0-12 weeks postpartum doing 100% of night care while partner sleeps" });
  opp.source_references = ["research/LAGOS-NIGERIA-FIELD-NOTES.md"];
  const r = buildTransformationRecord({ opportunity: opp });
  assert.equal(r.status, RUN_STATUS.CANDIDATE_READY);
  assert.notEqual(r.record.applicability.classification, APPLICABILITY.CONTEXT_INTRINSIC);
  assert.equal(extractGeographyTokens(situationNucleus(r.record.situation)).includes("nigerian"), false);
  assert.ok(r.record.applicability.source_context.includes("Nigerian"), "source geography preserved in applicability.source_context");
  assert.ok(JSON.stringify(r.record.evidence).includes("LAGOS-NIGERIA-FIELD-NOTES"), "provenance retained in evidence");
});

// =============================================================================================
// TEST B — same situation, different source geography
// =============================================================================================
test("TEST B — different source geography yields the same nucleus and no country clone", () => {
  const a = buildTransformationRecord({ opportunity: { ...clone(NIGHTSHIFT), source_references: ["research/LAGOS-NIGERIA-FIELD-NOTES.md"] } });
  const b = buildTransformationRecord({ opportunity: { ...clone(NIGHTSHIFT), source_references: ["research/ACCRA-GHANA-SURVEY.md"] } });
  assert.equal(a.status, RUN_STATUS.CANDIDATE_READY);
  assert.equal(b.status, RUN_STATUS.CANDIDATE_READY);
  assert.equal(a.transformation_id, b.transformation_id);
  assert.deepEqual(a.record.situation, b.record.situation);
  assert.equal(sameNucleusModuloContext(situationNucleus(a.record.situation), situationNucleus(b.record.situation)), true);
});

// =============================================================================================
// TEST C — context-variable case
// =============================================================================================
test("TEST C — context-variable factors keep ONE canonical transformation with context-aware delivery", () => {
  const base = clone(NIGHTSHIFT.finding).problem;
  const variants = [
    "prices differ by market and available services vary",
    "costs differ and the local hospital options vary",
    "currency and salary differ by household",
  ];
  const runs = variants.map((v) => buildTransformationRecord({ opportunity: oppWith({ problem: `${base} Note: ${v}.` }) }));
  for (const r of runs) assert.equal(r.status, RUN_STATUS.CANDIDATE_READY);
  assert.equal(new Set(runs.map((r) => r.transformation_id)).size, 1, "context variants must not fork identities");
  for (const r of runs) assert.equal(r.record.applicability.classification, APPLICABILITY.CONTEXT_VARIABLE);
  assert.ok(runs[0].record.applicability.context_variables.length > 0, "context variables recorded");
});

// =============================================================================================
// TEST D — culturally intrinsic case
// =============================================================================================
test("TEST D — culturally intrinsic context is preserved verbatim, never globalized away", () => {
  const opp = oppWith({ person: `${clone(NIGHTSHIFT.finding).person} Observing omugwo customs while her mother-in-law stays in the house.` });
  const r = buildTransformationRecord({ opportunity: opp });
  assert.equal(r.status, RUN_STATUS.CANDIDATE_READY);
  assert.equal(r.record.applicability.classification, APPLICABILITY.CONTEXT_INTRINSIC);
  assert.ok(r.record.situation.person.includes("omugwo"));
  assert.ok(r.record.situation.person.includes("mother-in-law"));
  assert.ok(r.record.applicability.intrinsic_dimensions.some((d) => /culture:omugwo/.test(d)));
});

// =============================================================================================
// TEST E — jurisdictionally intrinsic case
// =============================================================================================
test("TEST E — jurisdictionally intrinsic context is preserved or requires governed review", () => {
  const opp = oppWith({ problem: "Nigerian statutory maternity entitlement is unclear and the employer refuses the statutory leave." });
  const r = buildTransformationRecord({ opportunity: opp });
  assert.equal(r.status, RUN_STATUS.CANDIDATE_READY);
  assert.equal(r.record.applicability.classification, APPLICABILITY.CONTEXT_INTRINSIC);
  assert.ok(r.record.situation.problem.includes("statutory"));
  assert.ok(r.record.applicability.intrinsic_dimensions.some((d) => /jurisdiction/.test(d)));
  assert.ok(r.report.gaps.some((g) => g.domain === "APPLICABILITY" || g.domain === "CLINICAL" || g.domain === "MECHANISM"), "intrinsic context surfaces unresolved items as gaps");
});

// =============================================================================================
// TEST F — regional evidence limitation
// =============================================================================================
test("TEST F — regional evidence enters a globally usable transformation with limitations intact", () => {
  const src = "WHO 2014 (Lagos cohort, n=400)";
  const opp = { ...clone(NIGHTSHIFT), source_references: [...clone(NIGHTSHIFT.source_references), src] };
  const r = buildTransformationRecord({ opportunity: opp, research_evidence: [{ claim: "Room-sharing without bed-sharing is advised", status: "sourced_evidence", source: src }] });
  assert.equal(r.status, RUN_STATUS.CANDIDATE_READY);
  const ev = r.record.evidence.find((e) => e.source === src);
  assert.ok(ev, "source with population/geographic qualifiers preserved verbatim");
  assert.equal(ev.source, src);
  for (const e of r.record.evidence) if (["sourced_evidence", "expert_reviewed"].includes(e.status)) assert.ok(typeof e.source === "string" && e.source.length > 0);
  assert.equal(/proven (?:universal|worldwide|everywhere)/i.test(r.record.applicability.basis), false, "no false universal evidence claim");
});

// =============================================================================================
// TEST G — raw Markdown ingestion
// =============================================================================================
test("TEST G — raw Markdown ingestion preserves the source and produces validated records with no silent loss", async () => {
  const base = fresh("ingest-md");
  const file = join(base, "field-notes.md");
  const text = researchDoc(ingestPayload("OPP-ING-MD-001"));
  writeFileSync(file, text);
  const original = readFileSync(file);
  const r = await ingestResearch({ file, write: true, now: NEW_TS, dir: join(base, "sources"), oppDir: join(base, "opps") });
  assert.equal(r.ok, true);
  assert.equal(r.source.extraction.status, "EXTRACTED");
  assert.equal(r.source.source_type, "markdown");
  const preserved = readFileSync(join(base, "sources", r.source.source_id, "source.md"));
  assert.deepEqual(preserved, original, "source preserved byte-for-byte");
  assert.equal(r.source.content_sha256, createHash("sha256").update(original).digest("hex"));
  assert.deepEqual(r.created, ["OPP-ING-MD-001"]);
  assert.ok(existsSync(join(base, "opps", "OPP-ING-MD-001.json")));
  const opp = JSON.parse(readFileSync(join(base, "opps", "OPP-ING-MD-001.json"), "utf8"));
  const ar = buildTransformationRecord({ opportunity: opp });
  assert.notEqual(ar.status, RUN_STATUS.INVALID_INPUT, "ingested record conforms to the opportunity contract");
  assert.equal(r.source.extraction.findings_total, 1, "no silent information disappearance");
  assert.deepEqual(r.source.provenance.limitations, ["single site; snippet-grade"]);
  assert.equal(r.source.provenance.geography, "Nigeria");
});

// =============================================================================================
// TEST H — raw TXT ingestion
// =============================================================================================
test("TEST H — raw TXT ingestion behaves identically (source preserved, contract produced)", async () => {
  const base = fresh("ingest-txt");
  const file = join(base, "field-notes.txt");
  const real = "Plain text research.\n\n```swiipt-research\n" + JSON.stringify(ingestPayload("OPP-ING-TXT-001"), null, 2) + "\n```\n";
  writeFileSync(file, real);
  const original = readFileSync(file);
  const r = await ingestResearch({ file, write: true, now: NEW_TS, dir: join(base, "sources"), oppDir: join(base, "opps") });
  assert.equal(r.ok, true);
  assert.equal(r.source.source_type, "text");
  assert.equal(r.source.extraction.status, "EXTRACTED");
  assert.deepEqual(readFileSync(join(base, "sources", r.source.source_id, "source.txt")), original);
  assert.deepEqual(r.created, ["OPP-ING-TXT-001"]);
});

// =============================================================================================
// TEST I — missing semantic extractor/provider
// =============================================================================================
test("TEST I — no governed block and no extractor yields the honest EXTRACTION_REQUIRED state", async () => {
  const base = fresh("ingest-noextract");
  const file = join(base, "prose-only.md");
  const text = "# Research\n\nA long prose report with no machine block at all.\n";
  writeFileSync(file, text);
  const original = readFileSync(file);
  const r = await ingestResearch({ file, write: true, now: NEW_TS, dir: join(base, "sources"), oppDir: join(base, "opps") });
  assert.equal(r.ok, true);
  assert.equal(r.source.extraction.status, "EXTRACTION_REQUIRED");
  assert.equal(r.source.status, "EXTRACTION_REQUIRED");
  assert.deepEqual(r.extraction.records_created, [], "no invented records");
  assert.ok(r.extraction.unresolved_questions.some((u) => /extraction/i.test(u)));
  assert.deepEqual(readFileSync(join(base, "sources", r.source.source_id, "source.md")), original, "source still preserved");
});

// =============================================================================================
// TEST J — research gap
// =============================================================================================
test("TEST J — a missing-evidence gap is persisted with a machine-readable resolution requirement", () => {
  const gapDir = join(fresh("gaps-j"), "gaps");
  const thin = { ...clone(NIGHTSHIFT), finding: { headline: "Parents are tired" }, disposition: { ...clone(NIGHTSHIFT.disposition) } };
  const a = authorTransformation({ opportunity: thin, gapDir, now: NEW_TS });
  assert.equal(a.status, RUN_STATUS.SOURCE_REQUIRED);
  assert.ok(a.report.gaps.length > 0);
  assert.ok(a.persisted_gaps.length > 0);
  const gaps = listGaps({ dir: gapDir });
  assert.ok(gaps.every((g) => g.status === "OPEN"));
  const ct = gaps.find((g) => g.domain === "CUSTOMER_TRUTH");
  assert.ok(ct, "customer-truth gap persisted");
  assert.ok(ct.required_evidence.length > 0, "machine-readable required evidence");
  assert.equal(ct.blocking_stage, "TRANSFORMATION_CANDIDATE");
  assert.ok(blockingGapsForStage("TRANSFORMATION_CANDIDATE", { dir: gapDir }).length > 0, "blocking state observable");
});

// =============================================================================================
// TEST K — gap resolution + re-evaluation
// =============================================================================================
test("TEST K — new valid evidence resolves the gap, is re-evaluated and only then closed", () => {
  const gapDir = join(fresh("gaps-k"), "gaps");
  createGap({ gap_id: "GAP-RES-TEST-K-001", domain: "CUSTOMER_TRUTH", description: "missing CRF", why_it_matters: "situation unsupported", required_evidence: "a Customer Reality record", blocking_stage: "TRANSFORMATION_CANDIDATE", severity: "high" }, { dir: gapDir, now: NEW_TS });
  const res = resolveGap("GAP-RES-TEST-K-001", { resolution_source: "human research", resolution_evidence_refs: ["CRF-PPL-TEST-001"], resolution_notes: "recorded the missing CRF", resolved_at: NEW_TS }, { dir: gapDir });
  assert.equal(res.code, "RESOLVED_PENDING_RE_EVALUATION");
  const re = reEvaluateGap("GAP-RES-TEST-K-001", {}, { dir: gapDir });
  assert.equal(re.code, "CLOSED");
  assert.equal(re.gap.re_evaluation_required, false);
  assert.equal(re.gap.resolution_source, "human research");
  assert.deepEqual(re.gap.resolution_evidence_refs, ["CRF-PPL-TEST-001"]);
  assert.equal(blockingGapsForStage("TRANSFORMATION_CANDIDATE", { dir: gapDir }).length, 0, "pipeline may continue");
});

// =============================================================================================
// TEST L — unresolved gap stays open and blocking
// =============================================================================================
test("TEST L — insufficient evidence leaves the gap open and its stage blocked", () => {
  const gapDir = join(fresh("gaps-l"), "gaps");
  createGap({ gap_id: "GAP-RES-TEST-L-001", domain: "CUSTOMER_TRUTH", description: "missing CRF", why_it_matters: "x", required_evidence: "a CRF", blocking_stage: "TRANSFORMATION_CANDIDATE", severity: "high" }, { dir: gapDir, now: NEW_TS });
  const bare = resolveGap("GAP-RES-TEST-L-001", { resolution_notes: "no evidence" }, { dir: gapDir });
  assert.equal(bare.ok, false);
  assert.equal(bare.code, "EVIDENCE_REQUIRED");
  assert.equal(listGaps({ dir: gapDir })[0].status, "OPEN");
  const weak = resolveGap("GAP-RES-TEST-L-001", { resolution_source: "web note", resolution_evidence_refs: ["random-web-page"] }, { dir: gapDir });
  assert.equal(weak.code, "RESOLVED_PENDING_RE_EVALUATION");
  const re = reEvaluateGap("GAP-RES-TEST-L-001", {}, { dir: gapDir });
  assert.equal(re.code, "REOPENED");
  assert.equal(re.gap.status, "OPEN");
  assert.ok(blockingGapsForStage("TRANSFORMATION_CANDIDATE", { dir: gapDir }).length > 0);
});

// =============================================================================================
// TEST M — semantic duplicate transformation
// =============================================================================================
test("TEST M — an equivalent nucleus never creates a second canonical transformation automatically", () => {
  const gen = buildTransformationRecord({ opportunity: clone(NIGHTSHIFT) });
  const existing = clone(gen.record);
  existing.transformation_id = "TR-PPL-NIGHT-SHIFT-EXISTING-001";
  const opp = clone(NIGHTSHIFT);
  opp.opportunity_id = "OPP-PPL-NIGHTSHIFT-002";
  opp.disposition = { ...clone(NIGHTSHIFT.disposition), promoted_transformation_id: "TR-PPL-NIGHT-SHIFT-002" };
  const r = buildTransformationRecord({ opportunity: opp, existing_transformations: [existing] });
  assert.equal(r.status, RUN_STATUS.EXISTING_TRANSFORMATION_MATCH);
  assert.equal(r.record, null);
  assert.ok(r.report.dedupe.best.similarity >= 0.85);
});

// =============================================================================================
// TEST N — ambiguous duplicate -> review, never destructive merge
// =============================================================================================
test("TEST N — an ambiguous nucleus routes to review with no destructive merge", () => {
  const base = buildTransformationRecord({ opportunity: clone(NIGHTSHIFT) });
  const full = situationNucleus(base.record.situation);
  const toks = full.split(/\s+/).filter((w) => w.length > 2);
  const partial = toks.slice(0, Math.floor(toks.length * 0.75)).join(" ");
  const sim = nucleusSimilarity(full, partial);
  assert.ok(sim >= POSSIBLE_DUPLICATE_FLOOR && sim < 0.85, `engineered similarity ${sim} must be in the ambiguous band`);
  const unit = decideCatalogueOutcome({ nucleusText: full, existing: [{ transformation_id: "TR-AMBIG-001", situation: { person: partial } }] });
  assert.equal(unit.outcome, APPLICABILITY_OUTCOMES.POSSIBLE_DUPLICATE_REVIEW_REQUIRED);
  const opp = clone(NIGHTSHIFT);
  opp.opportunity_id = "OPP-PPL-NIGHTSHIFT-003";
  opp.disposition = { ...clone(NIGHTSHIFT.disposition), promoted_transformation_id: "TR-PPL-NIGHT-SHIFT-003" };
  const r = buildTransformationRecord({ opportunity: opp, existing_transformations: [{ transformation_id: "TR-AMBIG-001", situation: { person: partial } }] });
  assert.equal(r.status, RUN_STATUS.POSSIBLE_DUPLICATE_REVIEW_REQUIRED);
  assert.equal(r.record, null, "no record written / no merge");
  assert.ok(r.report.unresolved_questions.some((q) => /possible duplicate/.test(q)));
});

// =============================================================================================
// TEST O — invalid Product handoff (candidate transformation)
// =============================================================================================
test("TEST O — a product referencing a candidate transformation is refused (non-PASS)", () => {
  const root = fresh("handoff-o");
  cpSync(join(ROOT, "harness", "fixtures", "factory", "data"), join(root, "data"), { recursive: true });
  const trPath = join(root, "data", "transformations", "FIXTURE-TR-001.json");
  const tr = JSON.parse(readFileSync(trPath, "utf8"));
  tr.status = "candidate";
  writeFileSync(trPath, JSON.stringify(tr, null, 2) + "\n");
  const r = evaluateProductGates("FIXTURE-PRODUCT-001", { root, qaLedger: EMPTY_LEDGER });
  const g0 = r.gate_matrix.find((g) => g.gate === "g0_research_disposition");
  assert.notEqual(g0.current_verdict, "PASS");
  assert.equal(g0.current_verdict, "SOURCE_REQUIRED");
});

// =============================================================================================
// TEST P — valid Product handoff (validated transformation)
// =============================================================================================
test("TEST P — a product referencing a properly validated transformation passes the handoff gate", () => {
  const root = fresh("handoff-p");
  cpSync(join(ROOT, "harness", "fixtures", "factory", "data"), join(root, "data"), { recursive: true });
  const r = evaluateProductGates("FIXTURE-PRODUCT-001", { root, qaLedger: EMPTY_LEDGER });
  const g0 = r.gate_matrix.find((g) => g.gate === "g0_research_disposition");
  assert.equal(g0.current_verdict, "PASS");
});

// =============================================================================================
// TEST Q — constraint truncation fixed
// =============================================================================================
test("TEST Q — no corrupted mid-sentence canonical constraint (the FAMILY-MONEY failure class)", () => {
  const long = "She cannot leave the house alone because every time she tries the baby wakes up and she has to start the whole routine over again before anyone can settle";
  const got = extractConstraints(long);
  assert.ok(got.length > 0);
  for (const c of got) {
    assert.ok(long.includes(c), `constraint must be a verbatim span: ${c}`);
    assert.equal(/[A-Za-z0-9]$/.test(c), true, `constraint must end on a word: ${c}`);
    assert.equal(/\s(is|than|and|the|a|to|of|for|with)$/i.test(c), false, `dangling fragment persisted: ${c}`);
  }
  assert.ok(got[0].length > 70, "a long clause is not clipped at 70 characters");
  const fm = readJson("data/transformations/TR-PPL-FAMILY-MONEY-001.json");
  assert.ok(!fm.situation.constraints.some((c) => /purchase is$/.test(c)), "old corrupted fragment gone");
  assert.ok(!fm.situation.constraints.some((c) => /rather than$/.test(c)), "old corrupted fragment gone");
  assert.deepEqual(fm.situation.constraints, fm.before_state.environmental_constraints);
});

// =============================================================================================
// TEST R — AGENTS/MEMORY independence
// =============================================================================================
test("TEST R — critical invariants are enforced by repository code, not by agent prose", () => {
  const modules = ["transformation-architect.mjs", "applicability.mjs", "globality.mjs", "research-gaps.mjs", "ingest-research.mjs", "validate-transformation.mjs", "pipeline.mjs", "qa-checks.mjs", "build-manifest.mjs", "product-qa-gate-runner.mjs"];
  for (const f of modules) {
    const src = readFileSync(join(ROOT, "harness", f), "utf8");
    assert.equal(/AGENTS\.md|MEMORY\.md/.test(src), false, `${f} must not depend on instruction files`);
  }
  // geography canonicalization executes in code
  const r = buildTransformationRecord({ opportunity: oppWith({ person: "Nigerian mother 0-12 weeks postpartum doing all night care" }) });
  assert.equal(extractGeographyTokens(situationNucleus(r.record.situation)).includes("nigerian"), false);
  // candidate->validated is governed: no authorizer, no transition
  const trDir = fresh("validate-r");
  const candidate = buildTransformationRecord({ opportunity: clone(NIGHTSHIFT) }).record;
  candidate.transformation_id = "TR-PPL-GOVERNANCE-TEST-001";
  writeFileSync(join(trDir, "TR-PPL-GOVERNANCE-TEST-001.json"), JSON.stringify(candidate, null, 2) + "\n");
  const noAuth = validateTransformationRecord("TR-PPL-GOVERNANCE-TEST-001", { authorized_by: null, dir: trDir });
  assert.equal(noAuth.ok, false);
  assert.equal(noAuth.code, "AUTHORIZATION_REQUIRED");
  const ok = validateTransformationRecord("TR-PPL-GOVERNANCE-TEST-001", { authorized_by: "Owner", rationale: "boundary approved", write: true, now: NEW_TS, dir: trDir });
  assert.equal(ok.code, "VALIDATED");
  assert.equal(ok.record.status, "validated");
  assert.equal(ok.record.validation.source_state, "candidate");
  assert.ok(Array.isArray(ok.record.validation.not_implying) && ok.record.validation.not_implying.length >= 4);
});

// =============================================================================================
// §25 FORENSIC TRACE — a single-geography document end to end
// =============================================================================================
test("FORENSIC — single-geography document traces document -> ingestion -> authoring -> validation -> handoff", async () => {
  const base = fresh("forensic");
  const trDir = join(base, "transformations");
  const gapDir = join(base, "gaps");
  mkdirSync(trDir, { recursive: true }); mkdirSync(gapDir, { recursive: true });

  // 1. document (predominantly one geography) -> ingestion
  const file = join(base, "lagos-report.md");
  writeFileSync(file, researchDoc(ingestPayload("OPP-ING-FORENSIC-001", {
    disposition: { library_role: "STANDALONE_TRANSFORMATION", rationale: "distinct recurring night-care situation", assigned_at: "2026-09-17" },
  })));
  const ing = await ingestResearch({ file, write: true, now: NEW_TS, dir: join(base, "sources"), oppDir: join(base, "opps") });
  assert.equal(ing.source.extraction.status, "EXTRACTED");
  assert.ok(existsSync(join(base, "sources", ing.source.source_id, "source.md")));

  // 2. authoring (with the live catalogue for semantic dedupe)
  const opp = JSON.parse(readFileSync(join(base, "opps", "OPP-ING-FORENSIC-001.json"), "utf8"));
  const author = authorTransformation({ opportunity: opp, existing_transformations: loadCatalogue(), gapDir, now: NEW_TS, write: true, options: { out_dir: trDir } });
  assert.equal(author.status, RUN_STATUS.CANDIDATE_READY);
  assert.notEqual(author.report.applicability.classification, APPLICABILITY.CONTEXT_INTRINSIC);
  assert.equal(extractGeographyTokens(situationNucleus(author.record.situation)).includes("nigeria"), false);
  assert.ok(author.record.applicability.source_context.includes("Nigeria"), "source geography retained as provenance only");

  // 3. persisted gap + governed resolution
  const gapDir2 = join(base, "gaps2");
  const thin = { ...clone(NIGHTSHIFT), finding: { headline: "Parents are tired" }, disposition: { ...clone(NIGHTSHIFT.disposition) } };
  const thinAuthor = authorTransformation({ opportunity: thin, gapDir: gapDir2, now: NEW_TS });
  const gapId = thinAuthor.persisted_gaps[0];
  assert.ok(gapId, "a research gap was persisted");
  resolveGap(gapId, { resolution_source: "human research", resolution_evidence_refs: ["CRF-PPL-FORENSIC-001"], resolved_at: NEW_TS }, { dir: gapDir2 });
  const closed = reEvaluateGap(gapId, {}, { dir: gapDir2 });
  assert.equal(closed.code, "CLOSED");

  // 4. governed validation transition
  const v = validateTransformationRecord(author.record.transformation_id, { authorized_by: "Owner", rationale: "owner boundary validation", write: true, now: NEW_TS, dir: trDir });
  assert.equal(v.code, "VALIDATED");

  // 5. handoff state
  const state = pipelineState({ kind: "transformation", id: author.record.transformation_id }, { dir: trDir, gapDir });
  assert.equal(state.current_state, "TRANSFORMATION_VALIDATED");
  assert.equal(state.next_allowed_state, "PRODUCT_SPECIFICATION");

  // 6. valid handoff accepted; candidate refused
  const root = fresh("forensic-handoff");
  cpSync(join(ROOT, "harness", "fixtures", "factory", "data"), join(root, "data"), { recursive: true });
  const g0valid = evaluateProductGates("FIXTURE-PRODUCT-001", { root, qaLedger: EMPTY_LEDGER }).gate_matrix.find((g) => g.gate === "g0_research_disposition");
  assert.equal(g0valid.current_verdict, "PASS");
  const trPath = join(root, "data", "transformations", "FIXTURE-TR-001.json");
  const tr = JSON.parse(readFileSync(trPath, "utf8")); tr.status = "candidate";
  writeFileSync(trPath, JSON.stringify(tr, null, 2) + "\n");
  const g0invalid = evaluateProductGates("FIXTURE-PRODUCT-001", { root, qaLedger: EMPTY_LEDGER }).gate_matrix.find((g) => g.gate === "g0_research_disposition");
  assert.equal(g0invalid.current_verdict, "SOURCE_REQUIRED");
});

// =============================================================================================
// §26 CULTURAL FORENSIC — culture materially defines the situation
// =============================================================================================
test("CULTURAL FORENSIC — omugwo keeps its cultural specificity through ingestion and authoring", async () => {
  const base = fresh("cultural");
  const file = join(base, "omugwo-notes.md");
  writeFileSync(file, researchDoc({
    life_area: "m01",
    focus_market: "Postpartum & New Parent Life",
    submarket: "Household support - omugwo confinement",
    provenance: { source_label: "omugwo field notes", source_date: "2026-09-17", population: "mothers and mothers-in-law", geography: "Nigeria", jurisdiction: null, cultural_context: ["omugwo", "extended-family"], limitations: ["small sample"] },
    findings: [{
      opportunity_id: "OPP-ING-CULTURAL-001",
      disposition: { library_role: "STANDALONE_TRANSFORMATION", rationale: "culturally intrinsic confinement support", assigned_at: "2026-09-17" },
      finding: {
        headline: "Omugwo confinement support without losing household authority",
        problem: "The mother-in-law's omugwo expectations override the mother's own recovery preferences and she cannot change the food or visitor rules without offending the family.",
        recurring_situation: "During omugwo the extended family decides the mother's food, rest and visitors while she has no say.",
        person: "First-time mother in the first 6 weeks postpartum observing omugwo customs while her mother-in-law stays in the house",
        trigger: "The mother-in-law arrives for omugwo and reorganises the household",
        failed_attempt: "The mother tried to follow every omugwo expectation, so exhaustion set in and the household routine collapsed",
        emotional_stake: "Losing authority in her own home while trying to honour her family",
        desired_outcome: "A shared omugwo agreement that keeps both her recovery and her family's involvement",
        mechanism_hypotheses: ["A written omugwo agreement assigns each household duty before the visit", "A daily check-in protects the mother's recovery window", "A shared household ledger makes the division of work visible"],
      },
    }],
  }));
  const ing = await ingestResearch({ file, write: true, now: NEW_TS, dir: join(base, "sources"), oppDir: join(base, "opps") });
  assert.equal(ing.source.extraction.status, "EXTRACTED");
  const opp = JSON.parse(readFileSync(join(base, "opps", "OPP-ING-CULTURAL-001.json"), "utf8"));
  const author = authorTransformation({ opportunity: opp, gapDir: join(base, "gaps"), now: NEW_TS });
  assert.equal(author.status, RUN_STATUS.CANDIDATE_READY);
  assert.equal(author.record.applicability.classification, APPLICABILITY.CONTEXT_INTRINSIC);
  assert.ok(author.record.situation.person.includes("omugwo"), "culture preserved");
  assert.ok(author.record.situation.person.includes("mother-in-law"), "family role preserved");
  assert.ok(author.record.situation.problem.includes("omugwo"), "cultural mechanism preserved");
});
