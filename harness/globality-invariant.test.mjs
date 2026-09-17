#!/usr/bin/env node
// Globality invariant regression suite (TEST A–I + first regression case).
//
// Permanent rule under test: SWIIPT is GLOBAL BY DEFAULT. Source geography must
// never automatically become Transformation/product geography; one canonical
// product serves all contexts unless the Transformation contract itself changes.
//
// The suite is deliberately country-agnostic: every geography-sensitive test is
// parameterized over many unrelated geographies (proving uniformity, never a
// privileged few), and the PASS/FAIL logic never names a country.
//
// Conventions locked here:
// - transformation-architect.mjs exports the pure helpers under test;
// - qa-checks.mjs enforces no_country_clone across live products;
// - marketing applicability rides the existing validation `scope_note` field
//   (narrow fit + defined scope = green-eligible; narrow fit without scope = Yellow).
// Run: node --test harness/globality-invariant.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildTransformationRecord,
  resolveEvidence,
  extractGeographyTokens,
  stripGeographyTokens,
  nucleusSimilarity,
  sameNucleusModuloContext,
  COUNTRY_CLONE_THRESHOLD,
  RUN_STATUS,
} from "./transformation-architect.mjs";
import { AngleValidationService } from "../mae/services/validation.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const clone = (o) => JSON.parse(JSON.stringify(o));
const NIGHTSHIFT_OPP = readJson("data/opportunities/OPP-PPL-NIGHTSHIFT-001.json");

// Geographies are TEST INPUTS ONLY (arbitrary, cross-continental, never privileged).
// The invariant holds identically for each — that uniformity IS the assertion.
const GEOS = [
  { doc: "Product Pipeline/research/LAGOS-NIGERIA-FIELD-NOTES.md", tokens: ["lagos", "nigeria", "nigerian"] },
  { doc: "Product Pipeline/research/ACCRA-GHANA-SURVEY.md", tokens: ["accra", "ghana", "ghanaian"] },
  { doc: "Product Pipeline/research/LONDON-UK-COHORT.md", tokens: ["london", "uk", "british"] },
  { doc: "Product Pipeline/research/TEXAS-US-PANEL.md", tokens: ["texas", "american", "usa"] },
  { doc: "Product Pipeline/research/TORONTO-CANADA-INTERVIEWS.md", tokens: ["toronto", "canada", "canadian"] },
  { doc: "Product Pipeline/research/HANOI-VIETNAM-STUDY.md", tokens: ["hanoi", "vietnam", "vietnamese"] },
  { doc: "Product Pipeline/research/LIMA-PERU-SAMPLE.md", tokens: ["peru", "peruvian"] },
  { doc: "Product Pipeline/research/OSLO-NORWAY-COHORT.md", tokens: ["oslo", "norway", "norwegian"] },
];

const runWithSources = (docs) =>
  buildTransformationRecord({
    opportunity: { ...clone(NIGHTSHIFT_OPP), source_references: docs },
  });
const derivedNucleus = (record) =>
  [record.situation?.person, record.situation?.specific_situation, record.situation?.trigger, record.situation?.problem, record.situation?.desired_transformation]
    .filter(Boolean).join(" ");
const findingGeoTokens = (opp) =>
  extractGeographyTokens(
    [opp.finding?.person, opp.finding?.recurring_situation, opp.finding?.trigger, opp.finding?.desired_outcome].filter(Boolean).join(" ")
  );

// =============================================================================================
// 0 · helpers behave (unit level)
// =============================================================================================
test("lexicon extracts geography tokens and ignores ordinary words", () => {
  assert.deepEqual(extractGeographyTokens("Mother in Lagos managing naira budgets"), ["lagos", "naira"]);
  assert.deepEqual(extractGeographyTokens("She states that rest helps recovery"), []);
  assert.deepEqual(extractGeographyTokens(""), []);
});

test("strip removes geography for comparison but never for storage", () => {
  const stripped = stripGeographyTokens("Nigerian mother in Lagos keeps a budget chart");
  assert.ok(!/\bnigerian\b|\blagos\b/.test(stripped));
  assert.ok(/\bmother\b|\bbudget\b|\bchart\b/.test(stripped));
});

test("similarity is 0 on empty sides and 1 on identical text", () => {
  assert.equal(nucleusSimilarity("", ""), 0);
  assert.equal(nucleusSimilarity("budget chart posted", ""), 0);
  assert.equal(nucleusSimilarity("budget chart posted", "budget chart posted"), 1);
  assert.equal(sameNucleusModuloContext("budget chart posted", "budget chart posted"), true);
});

test("threshold constant is calibrated far above genuine related-product similarity", () => {
  assert.equal(COUNTRY_CLONE_THRESHOLD, 0.85);
});

// =============================================================================================
// TEST A — single-geography source bias (first arbitrary geography set)
// =============================================================================================
for (const g of GEOS.slice(0, 3)) {
  test(`TEST A — single-geography sources (${g.doc}) do not leak into identity or nucleus`, () => {
    const opp = { ...clone(NIGHTSHIFT_OPP), source_references: [g.doc] };
    const r = buildTransformationRecord({ opportunity: opp });
    assert.equal(r.status, RUN_STATUS.CANDIDATE_READY);
    // identity derives from opportunity tokens only — never from source geography
    assert.deepEqual(extractGeographyTokens(r.transformation_id), []);
    // nucleus may only contain geography the authored finding already contained
    const derived = derivedNucleus(r.record);
    const leaked = extractGeographyTokens(derived).filter((t) => !findingGeoTokens(opp).includes(t));
    assert.deepEqual(leaked, [], `inherited geography in nucleus: ${leaked}`);
    // ...while provenance keeps the source geography (firewall half 2)
    assert.ok(JSON.stringify(r.record.evidence).includes(g.doc));
  });
}

// =============================================================================================
// TEST B — different source geography, same principle (second arbitrary set)
// =============================================================================================
for (const g of GEOS.slice(3, 6)) {
  test(`TEST B — different source geography (${g.doc}) yields the same unbiased result`, () => {
    const opp = { ...clone(NIGHTSHIFT_OPP), source_references: [g.doc] };
    const r = buildTransformationRecord({ opportunity: opp });
    assert.equal(r.status, RUN_STATUS.CANDIDATE_READY);
    assert.deepEqual(extractGeographyTokens(r.transformation_id), []);
    const derived = derivedNucleus(r.record);
    const leaked = extractGeographyTokens(derived).filter((t) => !findingGeoTokens(opp).includes(t));
    assert.deepEqual(leaked, [], `inherited geography in nucleus: ${leaked}`);
  });
}

// =============================================================================================
// TEST C — transformation invariance across geographies (no fork)
// =============================================================================================
test("TEST C — same nucleus under different source geographies derives one identical transformation", () => {
  const runs = GEOS.map((g) =>
    buildTransformationRecord({ opportunity: { ...clone(NIGHTSHIFT_OPP), source_references: [g.doc] } })
  );
  for (const r of runs) assert.equal(r.status, RUN_STATUS.CANDIDATE_READY);
  const deprov = (rec) => {
    const c = clone(rec);
    delete c.evidence;
    if (c.mechanism) delete c.mechanism.evidence_basis;
    return c;
  };
  const first = runs[0];
  for (const r of runs.slice(1)) {
    assert.equal(r.transformation_id, first.transformation_id);
    assert.deepEqual(deprov(r.record).situation, deprov(first.record).situation);
    assert.deepEqual(deprov(r.record).mechanism, deprov(first.record).mechanism);
  }
  for (let i = 0; i < runs.length; i++) {
    const ev = JSON.stringify(runs[i].record.evidence);
    assert.ok(ev.includes(GEOS[i].doc), `run ${i} provenance must retain its source geography`);
  }
});

test("TEST C — no two canonical transformation records are country-clones of each other", () => {
  const trs = readdirSync(join(ROOT, "data", "transformations"))
    .filter((f) => /^TR-.*\.json$/.test(f))
    .map((f) => ({ id: f, r: readJson(`data/transformations/${f}`) }));
  assert.ok(trs.length >= 11, `expected the canonical library, found ${trs.length}`);
  let max = 0;
  for (let i = 0; i < trs.length; i++) {
    for (let j = i + 1; j < trs.length; j++) {
      const a = derivedNucleus(trs[i].r), b = derivedNucleus(trs[j].r);
      assert.equal(sameNucleusModuloContext(a, b), false, `country-clone pair: ${trs[i].id} vs ${trs[j].id}`);
      max = Math.max(max, nucleusSimilarity(a, b));
    }
  }
  assert.ok(max < COUNTRY_CLONE_THRESHOLD, `max genuine similarity ${max}`);
});

// =============================================================================================
// TEST D — context variable (currency/price inputs differ, contract invariant)
// =============================================================================================
test("TEST D — differing currency/price inputs do not fork the transformation", () => {
  const variants = [
    "Typical figures mentioned: ₦45,000 for the cot and naira outlay each market week.",
    "Typical figures mentioned: $29 for the cot and dollar outlay each market week.",
    "Typical figures mentioned: GH₵450 for the cot and cedi outlay each market week.",
  ];
  const runs = variants.map((v) =>
    buildTransformationRecord({
      opportunity: { ...clone(NIGHTSHIFT_OPP), finding: { ...clone(NIGHTSHIFT_OPP.finding), problem: `${clone(NIGHTSHIFT_OPP.finding).problem} ${v}` } },
    })
  );
  for (const r of runs) assert.equal(r.status, RUN_STATUS.CANDIDATE_READY);
  const ids = new Set(runs.map((r) => r.transformation_id));
  assert.equal(ids.size, 1, "currency variants must not fork identities");
  const sits = runs.map((r) => derivedNucleus(r.record));
  for (let i = 1; i < sits.length; i++) assert.equal(sameNucleusModuloContext(sits[0], sits[i]), true);
  assert.ok(sits[0] !== sits[1], "raw texts still differ (context preserved, not erased)");
});

// =============================================================================================
// TEST E — culture intrinsic (cultural spans preserved, never stripped)
// =============================================================================================
test("TEST E — cultural specificity in the authored nucleus is preserved verbatim", () => {
  const opp = {
    ...clone(NIGHTSHIFT_OPP),
    finding: {
      ...clone(NIGHTSHIFT_OPP.finding),
      person: `${clone(NIGHTSHIFT_OPP).finding.person} Observing omugwo customs while her mother-in-law stays in the house.`,
    },
  };
  const r = buildTransformationRecord({ opportunity: opp });
  assert.equal(r.status, RUN_STATUS.CANDIDATE_READY);
  assert.ok(r.record.situation.person.includes("omugwo"), "cultural span preserved in person");
  assert.ok(r.record.situation.person.includes("mother-in-law"), "family span preserved in person");
  assert.ok(!extractGeographyTokens("omugwo mother-in-law wrapper").includes("omugwo"), "culture is not geography");
});

// =============================================================================================
// TEST F — jurisdiction intrinsic (material contract change is detectable)
// =============================================================================================
test("TEST F — materially different contracts are not conflated", () => {
  assert.equal(
    sameNucleusModuloContext("night roster both adults follow for protected sleep", "screening checklist routes to professional care"),
    false
  );
  assert.equal(
    sameNucleusModuloContext(
      "First-time mother 0-12 weeks postpartum doing 100% of night care while partner sleeps",
      "First-time mother 0-12 weeks postpartum doing 100% of night care while partner sleeps"
    ),
    true
  );
  const night = readJson("data/transformations/TR-PPL-NIGHT-SHIFT-001.json");
  const triage = readJson("data/transformations/TR-PPL-MENTAL-TRIAGE-001.json");
  assert.equal(sameNucleusModuloContext(derivedNucleus(night), derivedNucleus(triage)), false);
});

// =============================================================================================
// TEST G — regional evidence limitation (provenance keeps its qualifiers)
// =============================================================================================
test("TEST G — sourced claims retain exact source strings including qualifiers", () => {
  const opp = clone(NIGHTSHIFT_OPP);
  const src = "WHO guideline 2022 (Lagos cohort, n=400)";
  const out = resolveEvidence({
    opportunity: { ...opp, source_references: [...opp.source_references, src] },
    research_evidence: [{ claim: "Room-sharing without bed-sharing is advised", status: "sourced_evidence", source: src }],
  });
  assert.equal(out.rejected.length, 0);
  assert.equal(out.entries[0].source, src, "source string preserved verbatim with qualifiers");
});

test("TEST G — sources outside the allowlist are rejected, never silently downgraded", () => {
  const out = resolveEvidence({
    opportunity: clone(NIGHTSHIFT_OPP),
    research_evidence: [{ claim: "X works everywhere", status: "sourced_evidence", source: "Mystery Study 2025 (nowhere cohort)" }],
  });
  assert.equal(out.entries.length, 0);
  assert.ok(out.rejected.length > 0);
});

// =============================================================================================
// TEST H — regional CRF marketing (scope_note mechanics, no universalization)
// =============================================================================================
const minimalAngle = (angleText) => ({
  id: "ANG-TEST-GLOBALITY-001",
  tier1: { emotional_stake: { evidence_status: "directly_stated" } },
  tier2: {
    angle: angleText,
    insight: { text: "Parents improvise at night without a plan." },
    mechanism: { text: "A written roster both adults follow.", product_truth_ref: "PTR-TEST-001" },
  },
  tier3: {
    source_evidence: [],
    product_truth_ref: "PTR-TEST-001",
    counter_evidence_acknowledged: "Regional sample only.",
    brand_truth_compliance: "verified",
    truth_conflict_log: [],
  },
  tags: [],
});
const STRONG = {
  customer_resonance: "strong",
  proof_availability: "strong",
  market_differentiation: "strong",
  brand_alignment: "pass",
  platform_fitness: "broad_fit",
};

test("TEST H — narrow fit WITH a defined scope stays green-eligible", () => {
  const rec = AngleValidationService.evaluate(minimalAngle("A calm written plan for restless nights."), {
    persist: false,
    platform_fitness: "narrow_fit",
    scope_note: "Regional scope: West African urban households; applicability beyond that population is unproven.",
    criteria: { ...STRONG, platform_fitness: "narrow_fit" },
  });
  assert.equal(rec.verdict, "GREEN");
  assert.equal(
    rec.scope_note,
    "Regional scope: West African urban households; applicability beyond that population is unproven."
  );
});

test("TEST H — narrow fit WITHOUT a defined scope restricts fan-out", () => {
  const rec = AngleValidationService.evaluate(minimalAngle("A calm written plan for restless nights."), {
    persist: false,
    platform_fitness: "narrow_fit",
    criteria: { ...STRONG, platform_fitness: "narrow_fit" },
  });
  assert.equal(rec.verdict, "YELLOW");
  assert.ok((rec.yellow_reason || "").includes("narrow platform fit"));
  assert.equal(rec.scope_note, null);
});

test("TEST H — universal-quantifier copy trips differentiation even with regional support", () => {
  const rec = AngleValidationService.evaluate(minimalAngle("Everyone experiences calm nights within days."), {
    persist: false,
  });
  assert.equal(rec.criteria.market_differentiation, "weak");
});

// =============================================================================================
// TEST I — country removal (arbitrary geography swap leaves identity unchanged)
// =============================================================================================
test("TEST I — replacing source geography with an arbitrary different one changes nothing canonical", () => {
  const a = buildTransformationRecord({
    opportunity: { ...clone(NIGHTSHIFT_OPP), source_references: ["Product Pipeline/research/KANO-NIGERIA-ARCHIVE.md"] },
  });
  const b = buildTransformationRecord({
    opportunity: { ...clone(NIGHTSHIFT_OPP), source_references: ["Product Pipeline/research/CUSCO-PERU-ARCHIVE.md"] },
  });
  assert.equal(a.status, RUN_STATUS.CANDIDATE_READY);
  assert.equal(b.status, RUN_STATUS.CANDIDATE_READY);
  assert.equal(a.transformation_id, b.transformation_id);
  assert.deepEqual(a.record.situation, b.record.situation);
  assert.deepEqual(extractGeographyTokens(a.transformation_id), []);
});

// =============================================================================================
// FIRST REGRESSION CASE — PPL-FAMILY-MONEY-001 proves the architecture
// =============================================================================================
test("FAMILY-MONEY person carries no country lock", () => {
  const p = readJson("data/products/PPL-FAMILY-MONEY-001/product.json");
  assert.deepEqual(extractGeographyTokens(p.customer.target_person), []);
});

test("FAMILY-MONEY evidence retains provenance (nothing relabelled global)", () => {
  const p = readJson("data/products/PPL-FAMILY-MONEY-001/product.json");
  assert.ok(p.evidence.sources.length > 0);
  for (const c of p.evidence.claim_labels) {
    if (["sourced_evidence", "expert_reviewed"].includes(c.label)) {
      assert.ok(typeof c.source === "string" && c.source.length > 0, `sourced claim without source: ${c.claim}`);
      assert.ok(p.evidence.sources.includes(c.source), `claim source not in declared sources: ${c.source}`);
    }
  }
});

test("FAMILY-MONEY has no country-cloned sibling among live products", () => {
  const dirs = ["PPL-NIGHT-SHIFT-001", "PPL-FAMILY-MONEY-001"];
  const nuc = (d) => {
    const p = readJson(`data/products/${d}/product.json`);
    return [p.customer?.target_person, p.customer?.situation, p.customer?.trigger].filter(Boolean).join(" ");
  };
  const texts = dirs.map(nuc);
  assert.equal(sameNucleusModuloContext(texts[0], texts[1]), false);
});

test("V06 person is unaffected and geography-free", () => {
  const p = readJson("data/products/PPL-NIGHT-SHIFT-001/product.json");
  assert.deepEqual(extractGeographyTokens(p.customer.target_person), []);
});
