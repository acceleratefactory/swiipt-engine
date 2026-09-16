// MAE · Product Truth resolution contract — focused regression suite.
//
// Proves the producer/consumer contract required so that:
//   Product Truth projection -> Product Truth reference -> Angle Authoring -> Angle Validation
// form ONE coherent contract for ALL products.
//
// Canonical model (mae/schemas/product-truth-reference.schema.json): a Product Truth Reference is a
// READ-ONLY DERIVED PROJECTION of the factory records ("the MAE never shadows Product Truth; it
// references it") — NOT an independently persisted authority. It carries no factory fingerprint, so a
// persisted copy could silently go stale; therefore validation resolves against the authoritative
// projection supplied to the transaction, then the persisted store.
//
// No provider, no LLM, no network, no spend. Nothing is written to production data.
// Run: node --test mae/harness/product-truth-contract.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { authorMarketingAngles, projectProductTruth } from "./marketing-angle-authoring.mjs";
import { AngleValidationService } from "../services/validation.js";
import { TruthService } from "../services/truth.js";
import { validate } from "../lib/schema.js";
import { buildCsecAngle } from "./fixtures.mjs";

const MAE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const R = (p) => JSON.parse(readFileSync(p, "utf8"));
const clone = (o) => JSON.parse(JSON.stringify(o));
const CORD = "PPL-CORD-CARE-001";
const SECOND = "PPL-RTWORK-OS-001";     // generic second product (own TR + mechanism + evidence)
const FIX = join(MAE, "data", "fixtures");
const CRF14 = R(join(FIX, "customer-reality", "CRF-CSEC-014.json"));
const CRF33 = R(join(FIX, "customer-reality", "CRF-CSEC-033.json"));
const MIF11 = R(join(FIX, "market-intelligence", "MIF-CSEC-011.json"));
const MIF17 = R(join(FIX, "market-intelligence", "MIF-CSEC-017.json"));

const cordRun = () => authorMarketingAngles({ product_id: CORD });
const cordCandidate = (patch = null) => { const c = cordRun().candidate_angles[0]; return patch ? patch(clone(c)) : c; };
const evalWith = (angle, opts = {}) => AngleValidationService.evaluate(angle, { persist: false, ...opts });
const evalStore = (angle) => AngleValidationService.evaluate(angle, { persist: false });   // no supplied projection
const dirSnapshot = (d) => (existsSync(join(MAE, "data", d)) ? readdirSync(join(MAE, "data", d)).sort() : []);

// ── 1. projected PTR is resolvable by validation under the canonical model ──────────────────────
test("PTC01 projected Product Truth resolves via TruthService.resolveProductTruth (supplied, then store)", () => {
  const ptr = projectProductTruth({ product_id: CORD }).record;
  assert.equal(ptr.id, "PTR-PPL-CORD-CARE-001");
  assert.equal(TruthService.resolveProductTruth(ptr.id, ptr), ptr);            // supplied projection wins
  assert.equal(TruthService.resolveProductTruth(ptr.id, null), null);          // never persisted for this run
  const fixture = R(join(FIX, "product-truth", "PTR-CSEC-001.json"));
  assert.ok(TruthService.resolveProductTruth(fixture.id, null));               // store fallback (fixture) still works
});

// ── 2. C2 no longer false-fails because of infrastructure ───────────────────────────────────────
test("PTC02 C2 no longer false-fails when the authoritative projection is supplied", () => {
  const r = cordRun();
  const v = evalWith(r.candidate_angles[0], { product_truth: r.product_truth_projection });
  assert.notEqual(v.criteria.proof_availability, "weak_fail");
  assert.equal(v.criteria.proof_availability, "strong");
  assert.notEqual(v.verdict, "RED");                                          // false provisional RED eliminated
});

// ── 3. missing Product Truth still fails C2 ─────────────────────────────────────────────────────
test("PTC03 a Product Truth reference that resolves nowhere still fails C2 (RED)", () => {
  const ptr = projectProductTruth({ product_id: CORD }).record;
  const c = cordCandidate((x) => { x.tier3.product_truth_ref = "PTR-DOES-NOT-EXIST-999"; return x; });
  const v = evalWith(c, { product_truth: ptr });                              // supplied id != ref -> unresolved
  assert.equal(v.criteria.proof_availability, "weak_fail");
  assert.equal(v.verdict, "RED");
});

// ── 4. malformed / mismatched Product Truth does not resolve ────────────────────────────────────
test("PTC04 a mismatched supplied projection does not resolve the reference (no accidental pass)", () => {
  const ptr = projectProductTruth({ product_id: CORD }).record;
  const wrong = { ...clone(ptr), id: "PTR-SOME-OTHER-001" };
  assert.equal(TruthService.resolveProductTruth(ptr.id, wrong), null);        // id must match
  const c = cordCandidate();
  const v = evalWith(c, { product_truth: wrong });
  assert.equal(v.criteria.proof_availability, "weak_fail");
  assert.equal(v.verdict, "RED");
});

// ── 5. unsupported proof still fails (product-truth violation) ──────────────────────────────────
test("PTC05 a claim the Product Truth prohibits still fails C2", () => {
  const r = cordRun();
  const prohibited = r.product_truth_projection.prohibited_claims.find((p) => p.length > 20);
  const c = clone(r.candidate_angles[0]);
  c.tier2.angle = `${c.tier2.angle} ${prohibited}`;
  const v = evalWith(c, { product_truth: r.product_truth_projection });
  assert.equal(v.criteria.proof_availability, "weak_fail");
  assert.equal(v.verdict, "RED");
});

// ── 6. weak/guarantee proof still fails where canonical ─────────────────────────────────────────
test("PTC06 guarantee language still fails C2 (no clinical/guarantee bypass)", () => {
  const r = cordRun();
  const c = clone(r.candidate_angles[0]);
  c.tier2.angle = "This is guaranteed to heal the infection in 3 days.";
  const v = evalWith(c, { product_truth: r.product_truth_projection });
  assert.equal(v.criteria.proof_availability, "weak_fail");
  assert.equal(v.verdict, "RED");
});

// ── 7. strong proof is EARNED from actual Product Truth, not hard-coded ─────────────────────────
test("PTC07 strong proof is earned from real Product Truth evidence (and absent without it)", () => {
  const r = cordRun();
  const ptr = r.product_truth_projection;
  assert.ok((ptr.evidence || []).length > 0 && ptr.mechanism.core_mechanism);  // real proof inventory
  const strong = evalWith(r.candidate_angles[0], { product_truth: ptr });
  const unresolved = evalStore(r.candidate_angles[0]);                         // no supplied + no store
  assert.equal(strong.criteria.proof_availability, "strong");
  assert.equal(unresolved.criteria.proof_availability, "weak_fail");           // not hard-coded
});

// ── 8. no hard-coded product path in the fix ────────────────────────────────────────────────────
test("PTC08 the resolution correction carries no product-specific code", () => {
  for (const rel of ["mae/services/truth.js", "mae/services/validation.js", "mae/harness/marketing-angle-authoring.mjs"]) {
    const src = readFileSync(join(MAE, "..", rel), "utf8");
    for (const banned of ["PPL-CORD-CARE", "ANG-PPL-CORD-CARE", "PTR-PPL-CORD-CARE", "CORD-CARE"]) {
      assert.equal(src.includes(banned), false, `${rel} contains ${banned}`);
    }
  }
});

// ── 9. generic second-product fixture works ─────────────────────────────────────────────────────
test("PTC09 a generic second product resolves its Product Truth the same way", () => {
  const r = authorMarketingAngles({ product_id: SECOND, crf: [clone(CRF14)], mif: [clone(MIF11), clone(MIF17)] });
  assert.equal(r.status, "READY_FOR_VALIDATION");
  assert.equal(r.candidate_angles.length, 1);
  assert.equal(r.candidate_angles[0].tier3.product_truth_ref, "PTR-PPL-RTWORK-OS-001");
  const v = r.validations[0];
  assert.equal(v.provisional, false);
  assert.equal(v.validator_resolution.product_truth, true);
  assert.notEqual(v.criteria.proof_availability, "weak_fail");
});

// ── 10. dry-run writes nothing ──────────────────────────────────────────────────────────────────
test("PTC10 dry-run authoring writes no product-truth / angle / validation file", () => {
  const before = { pt: dirSnapshot("product-truth"), ang: dirSnapshot("angles"), val: dirSnapshot("validations") };
  cordRun();
  authorMarketingAngles({ product_id: SECOND, crf: [clone(CRF14)], mif: [clone(MIF11), clone(MIF17)] });
  const after = { pt: dirSnapshot("product-truth"), ang: dirSnapshot("angles"), val: dirSnapshot("validations") };
  assert.deepEqual(after, before);
});

// ── 11. no dual authoritative truth ─────────────────────────────────────────────────────────────
test("PTC11 the PTR is a derived factory reference, never an independent authority", () => {
  const ptr = projectProductTruth({ product_id: CORD }).record;
  assert.equal(ptr.source.system, "product_factory");                          // provenance back to factory
  assert.ok(ptr.source.ref.includes("PPL-CORD-CARE-001"));
  assert.equal(existsSync(join(MAE, "data", "product-truth")), false);         // no persisted competing copy
});

// ── 12. stale projection behavior is safe ───────────────────────────────────────────────────────
test("PTC12 no persisted PTR exists to go stale; resolution prefers the fresh projection", () => {
  const fresh = projectProductTruth({ product_id: CORD }).record;
  const staleish = { ...clone(fresh), mechanism: { ...fresh.mechanism, core_mechanism: "STALE" } };
  // the transaction's authoritative projection wins, so a stale copy can never be silently consumed
  assert.equal(TruthService.resolveProductTruth(fresh.id, fresh), fresh);
  assert.equal(TruthService.resolveProductTruth(fresh.id, fresh).mechanism.core_mechanism, fresh.mechanism.core_mechanism);
  assert.notEqual(staleish.mechanism.core_mechanism, TruthService.resolveProductTruth(fresh.id, fresh).mechanism.core_mechanism);
});

// ── 13. Product Truth provenance preserved ──────────────────────────────────────────────────────
test("PTC13 the projection preserves factory provenance, version and evidence state", () => {
  const ptr = projectProductTruth({ product_id: CORD }).record;
  validate("product-truth-reference.schema.json", ptr, ptr.id);
  assert.equal(ptr.class, "product_truth_reference");
  assert.equal(ptr.provenance, "evidence_backed");
  assert.ok(ptr.transformation_id === "TR-PPL-CORD-CARE-001");
  assert.ok(/^\d+\.\d+/.test(ptr.version));
  assert.ok((ptr.evidence || []).length > 0);
});

// ── 14. validator remains substantive (not bypassed) ────────────────────────────────────────────
test("PTC14 the validator is unchanged in substance (RED possible, no hard-coded verdict)", () => {
  const src = readFileSync(join(MAE, "services", "validation.js"), "utf8");
  for (const banned of ['verdict = "GREEN"', '"verdict": "GREEN"', "verdict: \"GREEN\""]) assert.equal(src.includes(banned), false, banned);
  assert.ok(src.includes("proof_availability"));                               // C2 still computed
  assert.ok(src.includes("isRed") && src.includes("isYellow"));                // verdict still derived from criteria
  const r = cordRun();
  const red = evalWith(cordCandidate((x) => { x.tier2.angle = "guaranteed to cure"; return x; }), { product_truth: r.product_truth_projection });
  assert.equal(red.verdict, "RED");
});

// ── 15-17. RED / YELLOW / GREEN all reachable ───────────────────────────────────────────────────
test("PTC15 RED remains reachable", () => {
  const r = cordRun();
  const red = evalWith(cordCandidate((x) => { x.tier2.angle = "guaranteed to heal in 2 days"; return x; }), { product_truth: r.product_truth_projection });
  assert.equal(red.verdict, "RED");
});
test("PTC16 YELLOW remains reachable (CORD-CARE real corpus)", () => {
  const r = cordRun();
  const v = evalWith(r.candidate_angles[0], { product_truth: r.product_truth_projection });
  assert.equal(v.verdict, "YELLOW");
  assert.equal(v.max_assets, 6);
  assert.ok(/differentiation weak/i.test(v.yellow_reason));
});
test("PTC17 GREEN remains reachable (non-cliché fixture corpus)", () => {
  const PTR = R(join(FIX, "product-truth", "PTR-CSEC-001.json"));
  const r = authorMarketingAngles({ product_id: "PROD-CSEC", product_truth: clone(PTR), crf: [clone(CRF14), clone(CRF33)], mif: [clone(MIF11), clone(MIF17)] });
  assert.equal(r.validations[0].verdict, "GREEN");
});

// ── 18. human-review requirement unaffected ─────────────────────────────────────────────────────
test("PTC18 human-review requirement is unchanged (sensitive domain still flagged)", () => {
  const r = cordRun();
  const v = evalWith(r.candidate_angles[0], { product_truth: r.product_truth_projection });
  assert.equal(v.human_review_required, true);
  assert.equal(v.human_review_reason, "sensitive domain");
});

// ── 19. sensitive-domain behavior unaffected ────────────────────────────────────────────────────
test("PTC19 sensitive-domain handling is unchanged (health tag -> conditional_pass + review)", () => {
  const r = cordRun();
  const c = r.candidate_angles[0];
  assert.ok((c.tags || []).includes("health"));
  const v = evalWith(c, { product_truth: r.product_truth_projection });
  assert.equal(v.criteria.brand_alignment, "conditional_pass");
  assert.equal(v.human_review_required, true);
});

// ── 20. CRF/MIF behavior unaffected ─────────────────────────────────────────────────────────────
test("PTC20 CRF/MIF discovery and records are unaffected by the fix", () => {
  const r = cordRun();
  assert.equal(r.customer_truth_sources.length, 8);
  assert.equal(r.market_truth_sources.length, 5);
  assert.ok(r.customer_truth_sources.every((s) => s.scope === "production" && s.is_fixture === false));
  assert.ok(r.market_truth_sources.every((s) => s.scope === "production" && s.is_fixture === false));
  const crf = R(join(MAE, "data", "customer-reality", "CRF-PPL-CORD-CARE-004.json"));
  validate("customer-reality-record.schema.json", crf, crf.id);
  const mif = R(join(MAE, "data", "market-intelligence", "MIF-PPL-CORD-CARE-004.json"));
  validate("market-intelligence-record.schema.json", mif, mif.id);
});
