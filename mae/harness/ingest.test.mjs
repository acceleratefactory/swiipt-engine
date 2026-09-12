// MAE CRF/MIF ingest tests L–Q (thin harness over the existing services).
// Verifies validation-before-persistence, fixture/production separation, provenance survival,
// and no-partial-write on rejection. Uses unique ids and cleans up after itself.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { MAE_DIR, collectionDir } from "../lib/store.js";
import { CustomerRealityService } from "../services/crf.js";
import { MarketIntelligenceService } from "../services/mif.js";
import { ingestRecords as ingestCrf } from "./ingest-crf.mjs";
import { ingestRecords as ingestMif } from "./ingest-mif.mjs";

const CRF_SRC = join(MAE_DIR, "data", "fixtures", "customer-reality", "CRF-CSEC-014.json");
const MIF_SRC = join(MAE_DIR, "data", "fixtures", "market-intelligence", "MIF-CSEC-011.json");
const load = (p) => JSON.parse(readFileSync(p, "utf8"));
const rmIf = (id, collection, scope) => { const p = join(collectionDir(collection, { scope }), `${id}.json`); if (existsSync(p)) unlinkSync(p); };
const clean = (id, collection) => { rmIf(id, collection, "production"); rmIf(id, collection, "test"); };

test("L. CRF ingest validates before persistence", () => {
  const bad = { ...load(CRF_SRC), id: "NOT-A-CRF-ID" };
  const report = ingestCrf([bad], { scope: "test" });
  assert.equal(report.persisted.length, 0);
  assert.ok(report.rejected.length >= 1);
  assert.equal(CustomerRealityService.get("NOT-A-CRF-ID"), null);
  assert.equal(existsSync(join(collectionDir("customer-reality", { scope: "test" }), "NOT-A-CRF-ID.json")), false);
});

test("M. MIF ingest validates before persistence", () => {
  const bad = { ...load(MIF_SRC), id: "NOT-A-MIF-ID" };
  const report = ingestMif([bad], { scope: "test" });
  assert.equal(report.persisted.length, 0);
  assert.ok(report.rejected.length >= 1);
  assert.equal(MarketIntelligenceService.get("NOT-A-MIF-ID"), null);
  assert.equal(existsSync(join(collectionDir("market-intelligence", { scope: "test" }), "NOT-A-MIF-ID.json")), false);
});

test("N. production CRF ingestion rejects synthetic fixtures", () => {
  const id = "CRF-TEST-FIX-N";
  const rec = { ...load(CRF_SRC), id, is_fixture: true, provenance: "synthetic_fixture" };
  const report = ingestCrf([rec], { scope: "production" });
  assert.equal(report.persisted.length, 0);
  assert.equal(report.rejected[0].code, "FIXTURE_NOT_PRODUCTION_SAFE");
  assert.equal(CustomerRealityService.get(id, { includeFixtures: true }), null);
  clean(id, "customer-reality");
});

test("O. production MIF ingestion rejects synthetic fixtures", () => {
  const id = "MIF-TEST-FIX-O";
  const rec = { ...load(MIF_SRC), id, is_fixture: true, provenance: "synthetic_fixture" };
  const report = ingestMif([rec], { scope: "production" });
  assert.equal(report.persisted.length, 0);
  assert.equal(report.rejected[0].code, "FIXTURE_NOT_PRODUCTION_SAFE");
  assert.equal(MarketIntelligenceService.get(id, { includeFixtures: true }), null);
  clean(id, "market-intelligence");
});

test("P. evidence/provenance fields survive ingestion", () => {
  const cid = "CRF-TEST-OK-P";
  const mid = "MIF-TEST-OK-P";
  try {
    const crf = { ...load(CRF_SRC), id: cid, is_fixture: false, provenance: "evidence_backed", evidence_status: "directly_stated" };
    const mif = { ...load(MIF_SRC), id: mid, is_fixture: false, provenance: "evidence_backed" };
    assert.equal(ingestCrf([crf], { scope: "production" }).persisted[0], cid);
    assert.equal(ingestMif([mif], { scope: "production" }).persisted[0], mid);
    const gotC = CustomerRealityService.get(cid);
    assert.equal(gotC.provenance, "evidence_backed");
    assert.equal(gotC.evidence_status, "directly_stated");
    assert.equal(gotC.is_fixture, false);
    const gotM = MarketIntelligenceService.get(mid);
    assert.equal(gotM.provenance, "evidence_backed");
    assert.equal(gotM.evidence_status, load(MIF_SRC).evidence_status);
  } finally {
    clean(cid, "customer-reality");
    clean(mid, "market-intelligence");
  }
});

test("Q. a failed ingestion produces no partial record (all-or-nothing batch)", () => {
  const goodId = "CRF-TEST-MIX-Q";
  const badId = "NOPE-Q";
  const good = { ...load(CRF_SRC), id: goodId, is_fixture: false, provenance: "evidence_backed" };
  const bad = { ...load(CRF_SRC), id: badId };
  const report = ingestCrf([good, bad], { scope: "production" });
  assert.equal(report.persisted.length, 0, "no record may persist when the batch contains a rejected record");
  assert.equal(CustomerRealityService.get(goodId), null);
  clean(goodId, "customer-reality");
});

test("R. dry-run validates without persisting", () => {
  const id = "CRF-TEST-DRY-R";
  const rec = { ...load(CRF_SRC), id, is_fixture: false, provenance: "evidence_backed" };
  const report = ingestCrf([rec], { scope: "production", dryRun: true });
  assert.equal(report.accepted[0], id);
  assert.equal(report.persisted.length, 0);
  assert.equal(CustomerRealityService.get(id), null);
  clean(id, "customer-reality");
});
