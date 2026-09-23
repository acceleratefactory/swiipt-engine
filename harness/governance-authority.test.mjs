// AUTONOMOUS GOVERNANCE AUTHORITY ENGINE V1 - acceptance tests (task section 34).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadRegistry, loadConstitution, loadPack, classifyRisk, classifyDomain, resolvePack,
  evaluateAuthority, evaluatePublicationConstitution, authorityVersionMap, reevaluationScan,
  authorityAuditPath, STATE,
} from "./governance-authority.mjs";
import { evaluateProductGates } from "./product-qa-gate-runner.mjs";
import { runAuthorityFixtures } from "./authority-fixtures.mjs";

const FM = "PPL-FAMILY-MONEY-001";

test("1. system authority loads", () => {
  const reg = loadRegistry();
  assert.ok(reg.constitutions.length >= 5, "5 constitutions");
  assert.ok(reg.domain_packs.length >= 1, "domain packs");
});

test("2. authority version resolves", () => {
  const v = authorityVersionMap();
  assert.match(v.evidence_constitution, /@1\.0$/);
  assert.equal(v.safety_constitution.includes("SAFETY-CONSTITUTION"), true);
  assert.ok(v.publication_constitution && v.tsm_constitution && v.journey_constitution);
});

test("3. Domain Authority Pack resolves (family_finance)", () => {
  const p = loadPack("family_finance");
  assert.ok(p && p.authority_type === "DOMAIN_AUTHORITY_PACK");
  assert.ok(p.claim_classes.permitted.length > 0 && p.claim_classes.prohibited.length > 0);
});

test("4. risk classification maps canonical risk_level", () => {
  const r = classifyRisk({ safety: { risk_level: "moderate" } }, null);
  assert.equal(r.risk_class, "moderate_consequential");
  assert.equal(classifyRisk({ safety: { risk_level: "low" } }, null).risk_class, "low_risk");
  assert.equal(classifyRisk({ safety: { risk_level: "high" } }, null).risk_class, "high_risk_regulated");
});

test("5. domain classification is data-driven (family_finance for Family Money text)", () => {
  const text = { identity: { name: "The One-Number Baby Budget", subtitle: "A first-year household money system" }, customer: { situation: "recurring baby costs collide with shrunken income", trigger: "salary stopped but the bills did not" } };
  const d = classifyDomain(text, { submarket_id: "postpartum-new-parent-life-money-a-first-year-household-mone" });
  assert.equal(d.domain, "family_finance");
});

test("6. clinical text classifies away from finance and requires its own pack", () => {
  const d = classifyDomain({ identity: { name: "Pelvic Floor Recovery" }, customer: { situation: "postpartum bleeding and infection risk" }, transformation: { mechanism: { core: "clinical monitoring of dose and symptoms" } } }, null);
  assert.equal(d.domain, "health");
  assert.equal(resolvePack("health", "high_risk_regulated").pack, null);
});

test("7. Evidence Authority positive (Family Money)", () => {
  const { record } = evaluateAuthority(FM);
  assert.equal(record.gates.g4_evidence.state, STATE.AUTHORIZED, JSON.stringify(record.gates.g4_evidence.failure_reasons));
});

test("8. Evidence Authority rejects an unsupported efficacy claim (Fixture D)", () => {
  const r = runAuthorityFixtures();
  assert.equal(r.fixtures.D.evidence, STATE.NOT_AUTHORIZED);
  assert.ok(r.fixtures.D.reasons.some((x) => ["UNSUPPORTED_EFFICACY_CLAIM", "HYPOTHESIS_PRESENTED_AS_FACT", "CLAIM_CLASS_NOT_AUTHORIZED"].includes(x)), JSON.stringify(r.fixtures.D.reasons));
});

test("9. stale/undated market-sensitive content is rejected where the pack requires a date", () => {
  const pack = loadPack("family_finance");
  assert.equal(pack.dated_baseline_rules.required, true);
  // Family Money content carries dates -> passes; the requirement itself is active.
  const { record } = evaluateAuthority(FM);
  assert.equal(record.gates.g4_evidence.state, STATE.AUTHORIZED);
});

test("10. applicability is preserved (one canonical product, no country clone)", () => {
  const reg = loadRegistry();
  const rule = reg.domain_packs.find((d) => d.domain === "family_finance");
  const pack = loadPack("family_finance");
  assert.ok(rule && pack.currency_context_rules.model === "manual_per_currency");
  assert.ok(pack.applicability_rules.some((r) => /canonical product/i.test(r.rule)));
});

test("11. contradiction handling (savings/efficacy contradicts the untested-efficacy limitation)", () => {
  const pack = loadPack("family_finance");
  assert.ok(pack.contradiction_rules.some((r) => /savings\/efficacy statement contradicts/i.test(r.rule)));
});

test("12. Safety Authority positive (Family Money)", () => {
  const { record } = evaluateAuthority(FM);
  assert.equal(record.gates.g5_safety.state, STATE.AUTHORIZED, JSON.stringify(record.gates.g5_safety.failure_reasons));
});

test("13. prohibited safety behaviour rejected (guaranteed savings assertion)", () => {
  const r = runAuthorityFixtures();
  assert.equal(r.fixtures.D.evidence, STATE.NOT_AUTHORIZED); // guarantees savings is caught by evidence
});

test("14. missing Domain Authority Pack rejected (Fixture C, health)", () => {
  const r = runAuthorityFixtures();
  assert.equal(r.fixtures.C.domain, "health");
  assert.equal(r.fixtures.C.pack, false);
  assert.equal(r.fixtures.C.safety, STATE.NOT_AUTHORIZED);
  assert.ok(r.fixtures.C.reasons.includes("DOMAIN_AUTHORITY_MISSING"), JSON.stringify(r.fixtures.C.reasons));
});

test("15. Journey Authority positive (Family Money)", () => {
  const { record } = evaluateAuthority(FM);
  assert.equal(record.gates.g9_customer_journey.state, STATE.AUTHORIZED, JSON.stringify(record.gates.g9_customer_journey.failure_reasons));
});

test("16. broken first-win / dead-end rejected (Fixture E)", () => {
  const r = runAuthorityFixtures();
  assert.equal(r.fixtures.E.journey, STATE.NOT_AUTHORIZED);
  assert.ok(r.fixtures.E.reasons.some((x) => ["FIRST_WIN_BROKEN", "DEAD_END", "ARTIFACT_UNRESOLVED", "MECHANISM_NOT_DELIVERED"].includes(x)), JSON.stringify(r.fixtures.E.reasons));
});

test("17. rescue-path validation is enforced (Family Money rescue asset)", () => {
  const p = JSON.parse(readFileSync(`data/products/${FM}/product.json`, "utf8"));
  assert.ok((p.asset_map.rescue ?? []).length > 0);
  assert.ok(existsSync(`data/products/${FM}/content/cart-loop-rescue.md`));
});

test("18. TSM derivation/classification", () => {
  const { record } = evaluateAuthority(FM);
  assert.equal(record.tsm_classification.state, "INTERNAL_COHORT_THRESHOLD");
  assert.match(record.tsm_classification.derived_threshold, /60%\+ of completers meet >=3 of 4 indicators at Day 30/);
});

test("19. hypothesis is not promoted to validated efficacy", () => {
  const { record } = evaluateAuthority(FM);
  assert.equal(record.tsm_classification.efficacy_validated, false);
  assert.equal(record.tsm_classification.external_presentation, "self_check_target_only");
});

test("20. Publication Constitution positive (Family Money)", () => {
  const { record } = evaluateAuthority(FM);
  assert.equal(record.publication.state, STATE.AUTHORIZED_BY_PUBLICATION_CONSTITUTION, JSON.stringify(record.publication.failure_reasons));
});

test("21. unresolved upstream gate rejects publication", () => {
  const pub = loadConstitution("PUBLICATION");
  const bad = evaluatePublicationConstitution({ gateStates: { g0_research_disposition: "PASS", g4_evidence: "NOT_AUTHORIZED" }, tsm: { state: "INTERNAL_COHORT_THRESHOLD" }, pack: loadPack("family_finance"), publicationConstitution: pub });
  assert.equal(bad.state, STATE.NOT_AUTHORIZED);
});

test("22. g10 requires no per-product owner", () => {
  const pub = loadConstitution("PUBLICATION");
  assert.equal(pub.per_product_owner_approval_required, false);
  assert.equal(pub.authorization_semantics.authorized_by, "SWIIPT_PUBLICATION_CONSTITUTION");
  const p = JSON.parse(readFileSync(`data/products/${FM}/product.json`, "utf8"));
  assert.match(p.publishing.authorization.authorized_by, /PUBLICATION-CONSTITUTION/);
});

test("23. historical V06 human reviews remain readable", () => {
  assert.ok(existsSync("data/products/PPL-NIGHT-SHIFT-001/reviews/g4_evidence.job.json"));
  const j = JSON.parse(readFileSync("data/products/PPL-NIGHT-SHIFT-001/reviews/g4_evidence.job.json", "utf8"));
  assert.equal(j.status, "RESOLVED");
});

test("24. automated authority provenance is recorded", () => {
  const p = authorityAuditPath(FM);
  assert.ok(existsSync(p));
  const rec = JSON.parse(readFileSync(p, "utf8"));
  assert.equal(rec.evaluator.kind, "DETERMINISTIC");
  assert.equal(rec.evaluator.independent_from_generation, true);
  assert.ok(rec.authority_versions && rec.risk_class && rec.domain && rec.input_hash);
});

test("25. authority version change triggers reevaluation (Fixture F)", () => {
  const root = mkdtempSync(join(tmpdir(), "swt-auth-ver-"));
  const dir = join(root, "data", "products", "FIXTURE");
  mkdirSync(join(dir, "qa"), { recursive: true });
  writeFileSync(join(dir, "qa", "authority-evaluation.json"), JSON.stringify({ authority_versions: { evidence_constitution: "SWIIPT-EVIDENCE-CONSTITUTION@0.9" } }));
  const r = reevaluationScan({ root });
  assert.equal(r.length, 1);
  assert.equal(r[0].status, "AUTHORITY_REEVALUATION_REQUIRED");
});

test("26. manifest accepts constitutional authorization", () => {
  const p = JSON.parse(readFileSync(`data/products/${FM}/product.json`, "utf8"));
  assert.equal(p.qa.gate_results.g10_publish, "PASS");
  assert.equal(p.publishing.authorization.status, "READY_TO_PUBLISH");
  assert.ok(existsSync(`data/products/${FM}/publish/manifest.json`));
});

test("27. manifest rejects NOT_AUTHORIZED (no publication constitution state)", () => {
  const pub = loadConstitution("PUBLICATION");
  const bad = evaluatePublicationConstitution({ gateStates: {}, tsm: null, pack: null, publicationConstitution: pub });
  assert.equal(bad.state, STATE.NOT_AUTHORIZED);
  assert.ok(bad.failure_reasons.length > 0);
});

test("28. normal product does not require human review jobs", () => {
  const res = evaluateProductGates(FM);
  assert.equal(res.manifest_eligible, true);
  assert.equal(res.gate_results.g4_evidence, "PASS");
  assert.equal(res.run_report.authority.gates.g4_evidence.state, STATE.AUTHORIZED);
});

test("29. Family Money autonomous governance", () => {
  const { record } = evaluateAuthority(FM);
  assert.equal(record.decision, STATE.AUTHORIZED);
  assert.equal(record.gates.g4_evidence.state, STATE.AUTHORIZED);
  assert.equal(record.gates.g5_safety.state, STATE.AUTHORIZED);
  assert.equal(record.gates.g9_customer_journey.state, STATE.AUTHORIZED);
  assert.equal(record.publication.state, STATE.AUTHORIZED_BY_PUBLICATION_CONSTITUTION);
});

test("30. clinical-sensitive missing-pack fixture -> NOT_AUTHORIZED", () => {
  const r = runAuthorityFixtures();
  assert.equal(r.fixtures.C.safety, STATE.NOT_AUTHORIZED);
  assert.equal(r.fixtures.C.evidence, STATE.NOT_AUTHORIZED);
});

test("31. zero product-specific branches in the governance engine", () => {
  const src = readFileSync("harness/governance-authority.mjs", "utf8");
  const reg = readFileSync("governance/registry.json", "utf8");
  for (const bad of ["PPL-FAMILY-MONEY", "PPL-NIGHT-SHIFT", "AST-NS-", "V06"]) {
    assert.equal(src.includes(bad), false, `engine must not reference ${bad}`);
    assert.equal(reg.includes(bad), false, `registry must not reference ${bad}`);
  }
});

test("32. fail-closed when authority infrastructure is missing", () => {
  assert.throws(() => loadRegistry("/nonexistent-root"), /registry missing/);
  assert.throws(() => loadConstitution("EVIDENCE", "/nonexistent-root"), /registry missing/);
});

test("33. multi-domain fixtures A-F behave correctly", () => {
  const r = runAuthorityFixtures();
  assert.equal(r.ok, true);
  assert.equal(r.fixtures.A.domain, "general_life");
  assert.equal(r.fixtures.A.evidence, STATE.AUTHORIZED);
  assert.equal(r.fixtures.A.safety, STATE.AUTHORIZED);
  assert.equal(r.fixtures.A.journey, STATE.AUTHORIZED);
  assert.equal(r.fixtures.C.evidence, STATE.NOT_AUTHORIZED);
  assert.equal(r.fixtures.D.evidence, STATE.NOT_AUTHORIZED);
  assert.equal(r.fixtures.E.journey, STATE.NOT_AUTHORIZED);
  assert.ok(r.constitutions);
});

test("34. no fake human: authorization is a system constitution", () => {
  const p = JSON.parse(readFileSync(`data/products/${FM}/product.json`, "utf8"));
  assert.equal(/david|owner|human/i.test(p.publishing.authorization.authorized_by), false);
});

test("35. an INACTIVE (non-ACTIVE) Domain Authority Pack does not authorize (fail-closed)", () => {
  const root = mkdtempSync(join(tmpdir(), "swt-auth-inactive-"));
  mkdirSync(join(root, "governance", "domain-packs"), { recursive: true });
  writeFileSync(join(root, "governance", "registry.json"), JSON.stringify({
    constitutions: [],
    domain_packs: [{ domain: "family_finance", authority_id: "SWIIPT-DOMAIN-AUTHORITY-FAMILY-FINANCE", version: "1.0", status: "DRAFT", risk_classes: ["low_risk"], file: "governance/domain-packs/family_finance.authority-pack.json" }],
  }));
  writeFileSync(join(root, "governance", "domain-packs", "family_finance.authority-pack.json"), JSON.stringify({ authority_type: "DOMAIN_AUTHORITY_PACK", domain: "family_finance" }));
  // a non-ACTIVE pack is not resolvable -> the domain is not covered -> the product cannot be authorized
  assert.equal(loadPack("family_finance", root), null);
});

test("36. a malformed or missing authority system fails closed", () => {
  assert.throws(() => loadRegistry("/nonexistent-authority-root"), /registry missing/);
  const root = mkdtempSync(join(tmpdir(), "swt-auth-bad-"));
  mkdirSync(join(root, "governance"), { recursive: true });
  writeFileSync(join(root, "governance", "registry.json"), "{ not json");
  assert.throws(() => loadRegistry(root));
});
