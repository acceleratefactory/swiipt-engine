// MAE Wave A — Truth foundation tests (Gate A: Truth Integrity).
import { test } from "node:test";
import assert from "node:assert/strict";
import { TruthService, CONFLICT_HIERARCHY, WEIGHTING_MATRIX } from "../services/truth.js";
import { CustomerRealityService } from "../services/crf.js";
import { MarketIntelligenceService } from "../services/mif.js";
import { BrandTruthService } from "../services/brand.js";
import { assertNoUnsupportedCertainty, validPromotion, EVIDENCE_STATE } from "../lib/evidence.js";
import { validate } from "../lib/schema.js";

test("truths are separate stores, never collapsed", () => {
  const t = TruthService.loadAll();
  assert.ok(Array.isArray(t.product) && Array.isArray(t.customer) && Array.isArray(t.market) && Array.isArray(t.brand));
  assert.ok(t.product.length >= 1 && t.customer.length >= 3 && t.market.length >= 2 && t.brand.length >= 1);
  assert.notEqual(t.product[0].class, t.customer[0].class);
});

test("evidence state: hypothesis cannot silently become fact", () => {
  const r = assertNoUnsupportedCertainty(EVIDENCE_STATE.HYPOTHESIS, EVIDENCE_STATE.DIRECTLY_STATED);
  assert.equal(r.ok, false);
  assert.equal(r.promoted, false);
  const ok = assertNoUnsupportedCertainty(EVIDENCE_STATE.DIRECTLY_STATED, EVIDENCE_STATE.HYPOTHESIS);
  assert.equal(ok.ok, true);
});

test("explicit promotion requires an at-least-as-strong source", () => {
  const r = assertNoUnsupportedCertainty(EVIDENCE_STATE.ANALYST_INTERPRETATION, EVIDENCE_STATE.DIRECTLY_STATED, "CRF-CSEC-014");
  assert.equal(r.ok, true);
  assert.equal(r.promoted, true);
  assert.equal(validPromotion(EVIDENCE_STATE.ANALYST_INTERPRETATION, EVIDENCE_STATE.DIRECTLY_STATED), false);
  assert.equal(validPromotion(EVIDENCE_STATE.STRONGLY_EVIDENCED, EVIDENCE_STATE.STRONGLY_EVIDENCED), true);
});

test("conflict hierarchy: Product Truth beats Market Truth", () => {
  const { winner } = TruthService.resolveConflict(
    { source: "market", claim: "aggressive promise", claim_kind: "claim" },
    { source: "product", claim: "supported promise", claim_kind: "claim" });
  assert.equal(winner.source, "product");
  assert.deepEqual(CONFLICT_HIERARCHY, ["product", "customer", "brand", "market"]);
});

test("weighting is emphasis only and validated", () => {
  assert.deepEqual(TruthService.weightingProfile("WhatsApp broadcast"), WEIGHTING_MATRIX["WhatsApp broadcast"]);
  assert.equal(TruthService.validateWeighting({ product: 10, customer: 45, market: 10, brand: 35 }).customer, 45);
  assert.throws(() => TruthService.validateWeighting({ product: -1, customer: 30, market: 30, brand: 30 }), /weighting.product/);
});

test("absence claim requires a scan coverage note", () => {
  const bad = { id: "MIF-X-1", class: "market_intelligence_record", category: "unclaimed_angle", statement: "nobody offers this",
    evidence_status: "analyst_interpretation", provenance: "inference", created_at: "2026-09-11T00:00:00Z" };
  assert.throws(() => validate("market-intelligence-record.schema.json", bad), /schema validation failed/);
  assert.throws(() => MarketIntelligenceService.ingest(bad, { scope: "test" }), /scan_coverage_note|schema validation failed/);
});

test("Product Truth reference is a reference, not a shadow product definition", () => {
  const ptr = TruthService.get("product", "PTR-CSEC-001");
  assert.equal(ptr.source.system, "product_factory");
  assert.ok(ptr.product_id && ptr.transformation_id);
  validate("product-truth-reference.schema.json", ptr);
});

test("Brand Truth references the Writing Control layer (no fork)", () => {
  const b = BrandTruthService.loadBrand();
  assert.equal(b.writing_constitution_ref.config, "config/writing-control.v1.json");
  const reg = BrandTruthService.writingRegister();
  assert.ok(Array.isArray(reg.forbidden_phrases) && reg.forbidden_phrases.length > 5);
});

test("synthetic fixtures are refused as production Truth", () => {
  const crf = CustomerRealityService.get("CRF-CSEC-014");
  assert.equal(crf.is_fixture, true);
  assert.throws(() => TruthService.assertProductionSafe([crf]), /cannot be used as production Truth/);
  assert.throws(() => CustomerRealityService.ingest({ ...crf, id: "CRF-X-1" }, { scope: "production" }), /fixture CRF cannot/);
});

test("brand truth schema validates", () => {
  validate("brand-truth-record.schema.json", BrandTruthService.loadBrand());
});

test("faith register is off by default and gated", () => {
  assert.equal(BrandTruthService.faithRegisterAllowed("PROD-CSEC", true), false);
});
