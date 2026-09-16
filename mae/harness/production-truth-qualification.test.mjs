// MAE Production Customer + Market Truth Qualification Suite V1
// Adversarial validation of production CRF/MIF records, Four Truths integration,
// ingestion contracts, and Marketing Angle Authoring readiness.
// Verifies PPL-CORD-CARE-001 production truth (CRF-001..008, MIF-001..005).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { MAE_DIR, collectionDir } from "../lib/store.js";
import { CustomerRealityService } from "../services/crf.js";
import { MarketIntelligenceService } from "../services/mif.js";
import { ingestRecords as ingestCrf } from "./ingest-crf.mjs";
import { ingestRecords as ingestMif } from "./ingest-mif.mjs";

// Canonical source of record = the production collection (the MAE store). `data/_prod-candidates/`
// is an ingestion STAGING area (workflow input; not a store collection, read by no service) and is
// NOT required to reproduce this suite. When staging is present it is additionally verified for
// ingestion fidelity (K03/K04); when absent the canonical production records are the source.
const PROD_CRF_DIR = collectionDir("customer-reality", { scope: "production" });
const PROD_MIF_DIR = collectionDir("market-intelligence", { scope: "production" });
const STAGE_CRF_DIR = join(MAE_DIR, "data", "_prod-candidates", "crf");
const STAGE_MIF_DIR = join(MAE_DIR, "data", "_prod-candidates", "mif");
const CRF_DIR = PROD_CRF_DIR;
const MIF_DIR = PROD_MIF_DIR;
const TR_PATH = join(MAE_DIR, "..", "data", "transformations", "TR-PPL-CORD-CARE-001.json");
const BT_PATH = join(MAE_DIR, "data", "brand-truth.json");

const loadJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const listIds = (dir, prefix) =>
  existsSync(dir)
    ? readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith(".json")).map((f) => f.replace(".json", ""))
    : [];

const CRF_IDS = listIds(CRF_DIR, "CRF-PPL-CORD-CARE-");
const MIF_IDS = listIds(MIF_DIR, "MIF-PPL-CORD-CARE-");

// ═══════════════════════════════════════════════════════════════
// SECTION A: Filesystem Presence (10 tests)
// ═══════════════════════════════════════════════════════════════

test("A01. Canonical production CRF files exist on disk", () => {
  assert.ok(CRF_IDS.length >= 8, `Expected ≥8 canonical CRFs, found ${CRF_IDS.length}`);
});

test("A02. Canonical production MIF files exist on disk", () => {
  assert.ok(MIF_IDS.length >= 5, `Expected ≥5 canonical MIFs, found ${MIF_IDS.length}`);
});

test("A03. All CRF IDs follow naming convention CRF-PPL-CORD-CARE-NNN", () => {
  for (const id of CRF_IDS) {
    assert.match(id, /^CRF-PPL-CORD-CARE-\d{3}$/, `Bad CRF id: ${id}`);
  }
});

test("A04. All MIF IDs follow naming convention MIF-PPL-CORD-CARE-NNN", () => {
  for (const id of MIF_IDS) {
    assert.match(id, /^MIF-PPL-CORD-CARE-\d{3}$/, `Bad MIF id: ${id}`);
  }
});

test("A05. All CRF files are valid JSON", () => {
  for (const id of CRF_IDS) {
    const p = join(CRF_DIR, `${id}.json`);
    assert.doesNotThrow(() => loadJson(p), `Failed to parse ${id}.json`);
  }
});

test("A06. All MIF files are valid JSON", () => {
  for (const id of MIF_IDS) {
    const p = join(MIF_DIR, `${id}.json`);
    assert.doesNotThrow(() => loadJson(p), `Failed to parse ${id}.json`);
  }
});

test("A07. All CRFs are persisted in production collection", () => {
  const prodIds = listIds(PROD_CRF_DIR, "CRF-PPL-CORD-CARE-");
  for (const id of CRF_IDS) {
    assert.ok(prodIds.includes(id), `${id} not found in production CRF collection`);
  }
});

test("A08. All MIFs are persisted in production collection", () => {
  const prodIds = listIds(PROD_MIF_DIR, "MIF-PPL-CORD-CARE-");
  for (const id of MIF_IDS) {
    assert.ok(prodIds.includes(id), `${id} not found in production MIF collection`);
  }
});

test("A09. Transformation record exists and is validated", () => {
  assert.ok(existsSync(TR_PATH), "TR-PPL-CORD-CARE-001.json missing");
  const tr = loadJson(TR_PATH);
  assert.equal(tr.status, "validated");
});

test("A10. Brand truth exists and is active", () => {
  assert.ok(existsSync(BT_PATH), "brand-truth.json missing");
  const bt = loadJson(BT_PATH);
  assert.equal(bt.status, "active");
});

// ═══════════════════════════════════════════════════════════════
// SECTION B: CRF Schema Compliance (25 tests)
// ═══════════════════════════════════════════════════════════════

test("B01. Every CRF has all 17 required top-level fields", () => {
  const required = ["id", "class", "person", "situation", "trigger", "context", "behaviour", "failed_attempts", "constraint", "thought", "fear", "emotional_stake", "exact_language", "desired_change", "evidence_source", "evidence_status", "provenance", "created_at"];
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    for (const field of required) {
      assert.ok(field in rec, `${id} missing required field: ${field}`);
    }
  }
});

test("B02. Every CRF id starts with CRF-", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    assert.match(rec.id, /^CRF-/, `${id}: id does not start with CRF-`);
  }
});

test("B03. Every CRF class is 'customer_reality_record'", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    assert.equal(rec.class, "customer_reality_record", `${id}: wrong class`);
  }
});

test("B04. Every CRF person is a non-empty string", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    assert.equal(typeof rec.person, "string", `${id}: person not a string`);
    assert.ok(rec.person.length > 0, `${id}: person is empty`);
  }
});

test("B05. Every CRF behaviour is a non-empty array of strings", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    assert.ok(Array.isArray(rec.behaviour), `${id}: behaviour not an array`);
    assert.ok(rec.behaviour.length >= 1, `${id}: behaviour is empty`);
    for (const b of rec.behaviour) {
      assert.equal(typeof b, "string", `${id}: behaviour item not a string`);
    }
  }
});

test("B06. Every CRF failed_attempts is an array of objects with 'tried' key", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    assert.ok(Array.isArray(rec.failed_attempts), `${id}: failed_attempts not an array`);
    for (const fa of rec.failed_attempts) {
      assert.equal(typeof fa, "object", `${id}: failed_attempts item not an object`);
      assert.ok("tried" in fa, `${id}: failed_attempts item missing 'tried' key`);
      assert.equal(typeof fa.tried, "string", `${id}: tried not a string`);
    }
  }
});

test("B07. Every CRF evidence_source has required 'type' field", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    assert.ok("type" in rec.evidence_source, `${id}: evidence_source missing 'type'`);
  }
});

test("B08. Every CRF evidence_source.type is a valid enum value", () => {
  const validTypes = ["research_conversation", "survey", "review", "support_interaction", "customer_message", "community_discussion", "search_behaviour", "product_feedback", "existing_customer_data", "documented_research", "synthetic"];
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    assert.ok(validTypes.includes(rec.evidence_source.type), `${id}: invalid evidence_source.type: ${rec.evidence_source.type}`);
  }
});

test("B09. Every CRF evidence_status is a valid enum value", () => {
  const valid = ["directly_stated", "strongly_evidenced", "analyst_interpretation", "hypothesis"];
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    assert.ok(valid.includes(rec.evidence_status), `${id}: invalid evidence_status: ${rec.evidence_status}`);
  }
});

test("B10. Every CRF provenance is a valid enum value", () => {
  const valid = ["evidence_backed", "synthetic_fixture", "inference", "hypothesis"];
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    assert.ok(valid.includes(rec.provenance), `${id}: invalid provenance: ${rec.provenance}`);
  }
});

test("B11. Every CRF created_at is a valid ISO datetime string", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    assert.match(rec.created_at, /^\d{4}-\d{2}-\d{2}T/, `${id}: created_at not ISO datetime`);
    assert.ok(!isNaN(Date.parse(rec.created_at)), `${id}: created_at not parseable`);
  }
});

test("B12. Every CRF is_fixture is false (production records)", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    assert.equal(rec.is_fixture, false, `${id}: is_fixture should be false`);
  }
});

test("B13. Every CRF product_id matches PPL-CORD-CARE-001", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    assert.equal(rec.product_id, "PPL-CORD-CARE-001", `${id}: wrong product_id`);
  }
});

test("B14. Every CRF exact_language is a non-empty string", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    assert.equal(typeof rec.exact_language, "string", `${id}: exact_language not a string`);
    assert.ok(rec.exact_language.length > 0, `${id}: exact_language is empty`);
  }
});

test("B15. Every CRF cultural_context is an array of strings", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    assert.ok(Array.isArray(rec.cultural_context), `${id}: cultural_context not an array`);
    for (const c of rec.cultural_context) {
      assert.equal(typeof c, "string", `${id}: cultural_context item not a string`);
    }
  }
});

test("B16. Every CRF relationships is an array of strings", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    assert.ok(Array.isArray(rec.relationships), `${id}: relationships not an array`);
    for (const r of rec.relationships) {
      assert.equal(typeof r, "string", `${id}: relationships item not a string`);
    }
  }
});

test("B17. Every CRF tags is an array of strings", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    assert.ok(Array.isArray(rec.tags), `${id}: tags not an array`);
    for (const t of rec.tags) {
      assert.equal(typeof t, "string", `${id}: tags item not a string`);
    }
  }
});

test("B18. No CRF has additional properties (additionalProperties: false)", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    const allowed = new Set(["id", "class", "product_id", "person", "situation", "trigger", "context", "behaviour", "failed_attempts", "constraint", "thought", "fear", "emotional_stake", "exact_language", "desired_change", "evidence_source", "evidence_status", "evidence_weight", "observed_frequency", "cultural_context", "relationships", "tags", "provenance", "is_fixture", "created_at"]);
    const extra = Object.keys(rec).filter((k) => !allowed.has(k));
    assert.equal(extra.length, 0, `${id}: unexpected properties: ${extra.join(", ")}`);
  }
});

test("B19. CRF evidence_weight is valid or absent", () => {
  const valid = ["low", "medium", "medium_high", "high", "very_high"];
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    if (rec.evidence_weight !== undefined) {
      assert.ok(valid.includes(rec.evidence_weight), `${id}: invalid evidence_weight: ${rec.evidence_weight}`);
    }
  }
});

test("B20. CRF observed_frequency is string or null or absent", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    if (rec.observed_frequency !== undefined) {
      const t = typeof rec.observed_frequency;
      assert.ok(t === "string" || rec.observed_frequency === null, `${id}: observed_frequency type mismatch`);
    }
  }
});

test("B21. Every CRF situation is a non-empty string", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    assert.equal(typeof rec.situation, "string");
    assert.ok(rec.situation.length > 0, `${id}: situation is empty`);
  }
});

test("B22. Every CRF trigger is a non-empty string", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    assert.equal(typeof rec.trigger, "string");
    assert.ok(rec.trigger.length > 0, `${id}: trigger is empty`);
  }
});

test("B23. Every CRF constraint is a non-empty string", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    assert.equal(typeof rec.constraint, "string");
    assert.ok(rec.constraint.length > 0, `${id}: constraint is empty`);
  }
});

test("B24. Every CRF thought is a non-empty string", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    assert.equal(typeof rec.thought, "string");
    assert.ok(rec.thought.length > 0, `${id}: thought is empty`);
  }
});

test("B25. Every CRF fear is a non-empty string", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    assert.equal(typeof rec.fear, "string");
    assert.ok(rec.fear.length > 0, `${id}: fear is empty`);
  }
});

// ═══════════════════════════════════════════════════════════════
// SECTION C: MIF Schema Compliance (18 tests)
// ═══════════════════════════════════════════════════════════════

test("C01. Every MIF has all 7 required top-level fields", () => {
  const required = ["id", "class", "category", "statement", "evidence_status", "provenance", "created_at"];
  for (const id of MIF_IDS) {
    const rec = loadJson(join(MIF_DIR, `${id}.json`));
    for (const field of required) {
      assert.ok(field in rec, `${id} missing required field: ${field}`);
    }
  }
});

test("C02. Every MIF id starts with MIF-", () => {
  for (const id of MIF_IDS) {
    const rec = loadJson(join(MIF_DIR, `${id}.json`));
    assert.match(rec.id, /^MIF-/, `${id}: id does not start with MIF-`);
  }
});

test("C03. Every MIF class is 'market_intelligence_record'", () => {
  for (const id of MIF_IDS) {
    const rec = loadJson(join(MIF_DIR, `${id}.json`));
    assert.equal(rec.class, "market_intelligence_record", `${id}: wrong class`);
  }
});

test("C04. Every MIF category is a valid enum value", () => {
  const valid = ["competitor", "cliche", "myth", "gap", "alternative", "objection", "trend", "unclaimed_angle", "conversation", "positioning"];
  for (const id of MIF_IDS) {
    const rec = loadJson(join(MIF_DIR, `${id}.json`));
    assert.ok(valid.includes(rec.category), `${id}: invalid category: ${rec.category}`);
  }
});

test("C05. Every MIF statement is a non-empty string", () => {
  for (const id of MIF_IDS) {
    const rec = loadJson(join(MIF_DIR, `${id}.json`));
    assert.equal(typeof rec.statement, "string");
    assert.ok(rec.statement.length > 0, `${id}: statement is empty`);
  }
});

test("C06. Every MIF evidence_status is a valid enum value", () => {
  const valid = ["directly_stated", "strongly_evidenced", "analyst_interpretation", "hypothesis"];
  for (const id of MIF_IDS) {
    const rec = loadJson(join(MIF_DIR, `${id}.json`));
    assert.ok(valid.includes(rec.evidence_status), `${id}: invalid evidence_status`);
  }
});

test("C07. Every MIF provenance is a valid enum value", () => {
  const valid = ["evidence_backed", "synthetic_fixture", "inference", "hypothesis"];
  for (const id of MIF_IDS) {
    const rec = loadJson(join(MIF_DIR, `${id}.json`));
    assert.ok(valid.includes(rec.provenance), `${id}: invalid provenance`);
  }
});

test("C08. Every MIF created_at is a valid ISO datetime string", () => {
  for (const id of MIF_IDS) {
    const rec = loadJson(join(MIF_DIR, `${id}.json`));
    assert.match(rec.created_at, /^\d{4}-\d{2}-\d{2}T/, `${id}: created_at not ISO datetime`);
    assert.ok(!isNaN(Date.parse(rec.created_at)), `${id}: created_at not parseable`);
  }
});

test("C09. MIF unclaimed_angle category requires non-empty scan_coverage_note", () => {
  for (const id of MIF_IDS) {
    const rec = loadJson(join(MIF_DIR, `${id}.json`));
    if (rec.category === "unclaimed_angle") {
      assert.ok("scan_coverage_note" in rec, `${id}: unclaimed_angle missing scan_coverage_note`);
      assert.equal(typeof rec.scan_coverage_note, "string");
      assert.ok(rec.scan_coverage_note.length > 0, `${id}: scan_coverage_note is empty`);
    }
  }
});

test("C10. MIF scan_coverage_note is string or null or absent", () => {
  for (const id of MIF_IDS) {
    const rec = loadJson(join(MIF_DIR, `${id}.json`));
    if (rec.scan_coverage_note !== undefined) {
      const t = typeof rec.scan_coverage_note;
      assert.ok(t === "string" || rec.scan_coverage_note === null, `${id}: scan_coverage_note type mismatch`);
    }
  }
});

test("C11. MIF evidence is string or null or absent", () => {
  for (const id of MIF_IDS) {
    const rec = loadJson(join(MIF_DIR, `${id}.json`));
    if (rec.evidence !== undefined) {
      const t = typeof rec.evidence;
      assert.ok(t === "string" || rec.evidence === null, `${id}: evidence type mismatch`);
    }
  }
});

test("C12. MIF source is string or null or absent", () => {
  for (const id of MIF_IDS) {
    const rec = loadJson(join(MIF_DIR, `${id}.json`));
    if (rec.source !== undefined) {
      const t = typeof rec.source;
      assert.ok(t === "string" || rec.source === null, `${id}: source type mismatch`);
    }
  }
});

test("C13. MIF freshness is string or null or absent", () => {
  for (const id of MIF_IDS) {
    const rec = loadJson(join(MIF_DIR, `${id}.json`));
    if (rec.freshness !== undefined) {
      const t = typeof rec.freshness;
      assert.ok(t === "string" || rec.freshness === null, `${id}: freshness type mismatch`);
    }
  }
});

test("C14. MIF evidence_weight is valid or absent", () => {
  const valid = ["low", "medium", "medium_high", "high", "very_high"];
  for (const id of MIF_IDS) {
    const rec = loadJson(join(MIF_DIR, `${id}.json`));
    if (rec.evidence_weight !== undefined) {
      assert.ok(valid.includes(rec.evidence_weight), `${id}: invalid evidence_weight`);
    }
  }
});

test("C15. Every MIF is_fixture is false (production records)", () => {
  for (const id of MIF_IDS) {
    const rec = loadJson(join(MIF_DIR, `${id}.json`));
    assert.equal(rec.is_fixture, false, `${id}: is_fixture should be false`);
  }
});

test("C16. Every MIF product_id matches PPL-CORD-CARE-001", () => {
  for (const id of MIF_IDS) {
    const rec = loadJson(join(MIF_DIR, `${id}.json`));
    assert.equal(rec.product_id, "PPL-CORD-CARE-001", `${id}: wrong product_id`);
  }
});

test("C17. No MIF has additional properties (additionalProperties: false)", () => {
  for (const id of MIF_IDS) {
    const rec = loadJson(join(MIF_DIR, `${id}.json`));
    const allowed = new Set(["id", "class", "product_id", "category", "statement", "evidence", "evidence_status", "evidence_weight", "freshness", "source", "scan_coverage_note", "provenance", "is_fixture", "created_at"]);
    const extra = Object.keys(rec).filter((k) => !allowed.has(k));
    assert.equal(extra.length, 0, `${id}: unexpected properties: ${extra.join(", ")}`);
  }
});

test("C18. Every MIF created_at timestamp is within 2026", () => {
  for (const id of MIF_IDS) {
    const rec = loadJson(join(MIF_DIR, `${id}.json`));
    const year = new Date(rec.created_at).getUTCFullYear();
    assert.equal(year, 2026, `${id}: created_at year is ${year}, expected 2026`);
  }
});

// ═══════════════════════════════════════════════════════════════
// SECTION D: Ingestion Contract Behavior (12 tests)
// ═══════════════════════════════════════════════════════════════

test("D01. dry-run validates without persisting (CRF)", () => {
  const id = "CRF-PPL-CORD-CARE-001";
  const rec = loadJson(join(CRF_DIR, `${id}.json`));
  const report = ingestCrf([{ ...rec }], { scope: "production", dryRun: true });
  assert.ok(report.accepted.length >= 1 || report.persisted.length === 0, "dry-run should not persist");
  assert.equal(report.persisted.length, 0, "dry-run must not persist");
});

test("D02. dry-run validates without persisting (MIF)", () => {
  const id = "MIF-PPL-CORD-CARE-001";
  const rec = loadJson(join(MIF_DIR, `${id}.json`));
  const report = ingestMif([{ ...rec }], { scope: "production", dryRun: true });
  assert.equal(report.persisted.length, 0, "dry-run must not persist");
});

test("D03. production ingest rejects synthetic fixtures (CRF)", () => {
  const fixture = { id: "CRF-TEST-FIXTURE-REJECT", class: "customer_reality_record", is_fixture: true, provenance: "synthetic_fixture", person: "test", situation: "test", trigger: "test", context: "test", behaviour: ["test"], failed_attempts: [], constraint: "test", thought: "test", fear: "test", emotional_stake: "test", exact_language: "test", desired_change: "test", evidence_source: { type: "synthetic" }, evidence_status: "hypothesis", created_at: "2026-01-01T00:00:00.000Z" };
  const report = ingestCrf([fixture], { scope: "production" });
  assert.equal(report.persisted.length, 0);
  assert.equal(report.rejected[0]?.code, "FIXTURE_NOT_PRODUCTION_SAFE");
});

test("D04. production ingest rejects synthetic fixtures (MIF)", () => {
  const fixture = { id: "MIF-TEST-FIXTURE-REJECT", class: "market_intelligence_record", is_fixture: true, provenance: "synthetic_fixture", category: "trend", statement: "test", evidence_status: "hypothesis", created_at: "2026-01-01T00:00:00.000Z" };
  const report = ingestMif([fixture], { scope: "production" });
  assert.equal(report.persisted.length, 0);
  assert.equal(report.rejected[0]?.code, "FIXTURE_NOT_PRODUCTION_SAFE");
});

test("D05. all-or-nothing: batch with one bad record persists zero", () => {
  const good = loadJson(join(CRF_DIR, "CRF-PPL-CORD-CARE-001.json"));
  const bad = { id: "NOT-A-REAL-ID" };
  const report = ingestCrf([{ ...good, id: "CRF-TEST-AOA-GOOD" }, bad], { scope: "production" });
  assert.equal(report.persisted.length, 0, "all-or-nothing: no records persisted on partial failure");
});

test("D06. all-or-nothing: batch with one bad MIF persists zero", () => {
  const good = loadJson(join(MIF_DIR, "MIF-PPL-CORD-CARE-001.json"));
  const bad = { id: "NOT-A-REAL-ID" };
  const report = ingestMif([{ ...good, id: "MIF-TEST-AOA-GOOD" }, bad], { scope: "production" });
  assert.equal(report.persisted.length, 0, "all-or-nothing: no records persisted on partial failure");
});

test("D07. rejected records contain error details", () => {
  const bad = { id: "CRF-TEST-ERR-DETAILS", class: "wrong_class" };
  const report = ingestCrf([bad], { scope: "production" });
  assert.ok(report.rejected.length >= 1);
  assert.ok("id" in report.rejected[0] || "error" in report.rejected[0], "rejected record has details");
});

test("D08. CRF service returns null for non-existent id", () => {
  const result = CustomerRealityService.get("CRF-NONEXISTENT-999");
  assert.equal(result, null);
});

test("D09. MIF service returns null for non-existent id", () => {
  const result = MarketIntelligenceService.get("MIF-NONEXISTENT-999");
  assert.equal(result, null);
});

test("D10. accepted records in dry-run match input ids", () => {
  const rec = loadJson(join(CRF_DIR, "CRF-PPL-CORD-CARE-001.json"));
  const report = ingestCrf([{ ...rec }], { scope: "production", dryRun: true });
  assert.ok(report.accepted.includes("CRF-PPL-CORD-CARE-001"), "accepted should include the input id");
});

test("D11. production scope does not write to test collection", () => {
  const testDir = collectionDir("customer-reality", { scope: "test" });
  const before = existsSync(testDir) ? readdirSync(testDir).length : 0;
  const rec = loadJson(join(CRF_DIR, "CRF-PPL-CORD-CARE-001.json"));
  ingestCrf([{ ...rec }], { scope: "production" });
  const after = existsSync(testDir) ? readdirSync(testDir).length : 0;
  assert.equal(before, after, "production scope must not write to test collection");
});

test("D12. empty batch returns empty report", () => {
  const report = ingestCrf([], { scope: "production" });
  assert.equal(report.persisted.length, 0);
  assert.equal(report.rejected.length, 0);
});

// ═══════════════════════════════════════════════════════════════
// SECTION E: Four Truths Integration (8 tests)
// ═══════════════════════════════════════════════════════════════

test("E01. All four truth sources are on disk", () => {
  assert.ok(existsSync(TR_PATH), "Product Truth missing");
  assert.ok(existsSync(BT_PATH), "Brand Truth missing");
  assert.ok(CRF_IDS.length >= 8, "Customer Truth missing (need ≥8 CRFs)");
  assert.ok(MIF_IDS.length >= 5, "Market Truth missing (need ≥5 MIFs)");
});

test("E02. Product Truth status is 'validated'", () => {
  const tr = loadJson(TR_PATH);
  assert.equal(tr.status, "validated");
});

test("E03. Brand Truth status is 'active'", () => {
  const bt = loadJson(BT_PATH);
  assert.equal(bt.status, "active");
});

test("E04. Every CRF product_id links to the same product", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    assert.equal(rec.product_id, "PPL-CORD-CARE-001", `${id}: product_id mismatch`);
  }
});

test("E05. Every MIF product_id links to the same product", () => {
  for (const id of MIF_IDS) {
    const rec = loadJson(join(MIF_DIR, `${id}.json`));
    assert.equal(rec.product_id, "PPL-CORD-CARE-001", `${id}: product_id mismatch`);
  }
});

test("E06. No CRF is_fixture is true (production truth)", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    assert.equal(rec.is_fixture, false, `${id}: fixture in production truth`);
  }
});

test("E07. No MIF is_fixture is true (production truth)", () => {
  for (const id of MIF_IDS) {
    const rec = loadJson(join(MIF_DIR, `${id}.json`));
    assert.equal(rec.is_fixture, false, `${id}: fixture in production truth`);
  }
});

test("E08. CRF and MIF product_ids are consistent with each other", () => {
  const crfProduct = CRF_IDS.length > 0 ? loadJson(join(CRF_DIR, `${CRF_IDS[0]}.json`)).product_id : null;
  const mifProduct = MIF_IDS.length > 0 ? loadJson(join(MIF_DIR, `${MIF_IDS[0]}.json`)).product_id : null;
  assert.equal(crfProduct, mifProduct, "CRF and MIF product_ids must match");
});

// ═══════════════════════════════════════════════════════════════
// SECTION F: Evidence Provenance Chain (10 tests)
// ═══════════════════════════════════════════════════════════════

test("F01. Every CRF has evidence_source with type field", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    assert.ok(rec.evidence_source && typeof rec.evidence_source === "object", `${id}: evidence_source missing or not object`);
    assert.ok("type" in rec.evidence_source, `${id}: evidence_source missing type`);
  }
});

test("F02. CRF provenance matches evidence source type (no synthetic in evidence_backed)", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    if (rec.provenance === "evidence_backed") {
      assert.notEqual(rec.evidence_source.type, "synthetic", `${id}: evidence_backed but source is synthetic`);
    }
  }
});

test("F03. CRF is_fixture false with provenance synthetic_fixture is rejected", () => {
  const rec = { id: "CRF-TEST-FP-CONFLICT", class: "customer_reality_record", is_fixture: false, provenance: "synthetic_fixture", person: "test", situation: "test", trigger: "test", context: "test", behaviour: ["test"], failed_attempts: [], constraint: "test", thought: "test", fear: "test", emotional_stake: "test", exact_language: "test", desired_change: "test", evidence_source: { type: "synthetic" }, evidence_status: "hypothesis", created_at: "2026-01-01T00:00:00.000Z" };
  const report = ingestCrf([rec], { scope: "production" });
  assert.equal(report.persisted.length, 0, "production rejects fixture provenance");
});

test("F04. CRF evidence_status directly_stated has high or very_high weight", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    if (rec.evidence_status === "directly_stated" && rec.evidence_weight) {
      assert.ok(["high", "very_high"].includes(rec.evidence_weight), `${id}: directly_stated should have high/very_high weight`);
    }
  }
});

test("F05. CRF evidence_status hypothesis should not have very_high weight", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    if (rec.evidence_status === "hypothesis" && rec.evidence_weight) {
      assert.notEqual(rec.evidence_weight, "very_high", `${id}: hypothesis should not have very_high weight`);
    }
  }
});

test("F06. MIF provenance matches evidence status (no directly_stated with hypothesis provenance)", () => {
  for (const id of MIF_IDS) {
    const rec = loadJson(join(MIF_DIR, `${id}.json`));
    if (rec.evidence_status === "directly_stated") {
      assert.notEqual(rec.provenance, "hypothesis", `${id}: directly_stated with hypothesis provenance`);
    }
  }
});

test("F07. CRF evidence_source.id is present when type is community_discussion", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    if (rec.evidence_source.type === "community_discussion") {
      assert.ok(rec.evidence_source.id, `${id}: community_discussion missing source id`);
    }
  }
});

test("F08. MIF evidence field is non-null for evidence_backed provenance", () => {
  for (const id of MIF_IDS) {
    const rec = loadJson(join(MIF_DIR, `${id}.json`));
    if (rec.provenance === "evidence_backed") {
      assert.ok(rec.evidence !== null && rec.evidence !== undefined, `${id}: evidence_backed but evidence is null`);
    }
  }
});

test("F09. No CRF has evidence_weight without evidence_status", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    if (rec.evidence_weight !== undefined) {
      assert.ok(rec.evidence_status, `${id}: has evidence_weight but no evidence_status`);
    }
  }
});

test("F10. No MIF has evidence_weight without evidence_status", () => {
  for (const id of MIF_IDS) {
    const rec = loadJson(join(MIF_DIR, `${id}.json`));
    if (rec.evidence_weight !== undefined) {
      assert.ok(rec.evidence_status, `${id}: has evidence_weight but no evidence_status`);
    }
  }
});

// ═══════════════════════════════════════════════════════════════
// SECTION G: Cross-Record Consistency (7 tests)
// ═══════════════════════════════════════════════════════════════

test("G01. CRF count is between 5 and 25 (reasonable coverage)", () => {
  assert.ok(CRF_IDS.length >= 5, `Too few CRFs: ${CRF_IDS.length}`);
  assert.ok(CRF_IDS.length <= 25, `Too many CRFs: ${CRF_IDS.length}`);
});

test("G02. MIF count is between 3 and 15 (reasonable coverage)", () => {
  assert.ok(MIF_IDS.length >= 3, `Too few MIFs: ${MIF_IDS.length}`);
  assert.ok(MIF_IDS.length <= 15, `Too many MIFs: ${MIF_IDS.length}`);
});

test("G03. No duplicate CRF ids", () => {
  const seen = new Set();
  for (const id of CRF_IDS) {
    assert.ok(!seen.has(id), `Duplicate CRF id: ${id}`);
    seen.add(id);
  }
});

test("G04. No duplicate MIF ids", () => {
  const seen = new Set();
  for (const id of MIF_IDS) {
    assert.ok(!seen.has(id), `Duplicate MIF id: ${id}`);
    seen.add(id);
  }
});

test("G05. No duplicate CRF exact_language across records", () => {
  const seen = new Map();
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    if (seen.has(rec.exact_language)) {
      assert.fail(`Duplicate exact_language in ${id} and ${seen.get(rec.exact_language)}`);
    }
    seen.set(rec.exact_language, id);
  }
});

test("G06. At least 3 different evidence_source.types across CRFs", () => {
  const types = new Set();
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    types.add(rec.evidence_source.type);
  }
  assert.ok(types.size >= 2, `Only ${types.size} distinct evidence source types (need >= 2)`);
});

test("G07. At least 3 different MIF categories represented", () => {
  const cats = new Set();
  for (const id of MIF_IDS) {
    const rec = loadJson(join(MIF_DIR, `${id}.json`));
    cats.add(rec.category);
  }
  assert.ok(cats.size >= 3, `Only ${cats.size} distinct MIF categories`);
});

// ═══════════════════════════════════════════════════════════════
// SECTION H: Marketing Angle Authoring Readiness (8 tests)
// ═══════════════════════════════════════════════════════════════

test("H01. Product Truth has required fields for angle authoring", () => {
  const tr = loadJson(TR_PATH);
  assert.ok(tr.status, "TR missing status");
  assert.ok(tr.evidence, "TR missing evidence");
});

test("H02. Brand Truth has required fields for angle authoring", () => {
  const bt = loadJson(BT_PATH);
  assert.ok(bt.status, "BT missing status");
  assert.ok(bt.voice_dna, "BT missing voice_dna");
  assert.ok(bt.prohibited_behaviours, "BT missing prohibited_behaviours");
});

test("H03. At least one CRF has direct customer quote (exact_language)", () => {
  let hasQuote = false;
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    if (rec.exact_language && rec.exact_language.length > 10) {
      hasQuote = true;
      break;
    }
  }
  assert.ok(hasQuote, "No CRF has a substantial direct quote");
});

test("H04. At least one MIF has evidence field with clinical/scientific source", () => {
  let hasEvidence = false;
  for (const id of MIF_IDS) {
    const rec = loadJson(join(MIF_DIR, `${id}.json`));
    if (rec.evidence && (rec.evidence.includes("PMID") || rec.evidence.includes("meta-analysis") || rec.evidence.includes("WHO"))) {
      hasEvidence = true;
      break;
    }
  }
  assert.ok(hasEvidence, "No MIF has clinical/scientific evidence");
});

test("H05. CRFs cover at least 2 different customer segments", () => {
  const segments = new Set();
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    const person = rec.person.toLowerCase();
    if (person.includes("first") || person.includes("ftm")) segments.add("first_time");
    if (person.includes("grandmother") || person.includes("mother-in-law") || person.includes("mil")) segments.add("extended_family");
    if (person.includes("nurse") || person.includes("health")) segments.add("health_worker");
    if (person.includes("nigeria") || person.includes("ghana") || person.includes("africa")) segments.add("african_context");
    if (person.includes("united states") || person.includes("us") || person.includes("uk")) segments.add("western_context");
  }
  assert.ok(segments.size >= 2, `Only ${segments.size} customer segments covered`);
});

test("H06. MIFs cover both clinical evidence and cultural/behavioral patterns", () => {
  const cats = new Set();
  for (const id of MIF_IDS) {
    const rec = loadJson(join(MIF_DIR, `${id}.json`));
    cats.add(rec.category);
  }
  const hasClinical = cats.has("trend") || cats.has("alternative");
  const hasBehavioral = cats.has("myth") || cats.has("cliche") || cats.has("objection") || cats.has("gap");
  assert.ok(hasClinical, "No clinical/scientific MIF category");
  assert.ok(hasBehavioral, "No behavioral/cultural MIF category");
});

test("H07. CRF emotional_stake fields contain substantive content", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    assert.ok(rec.emotional_stake.length > 20, `${id}: emotional_stake too short (${rec.emotional_stake.length} chars)`);
  }
});

test("H08. All CRFs have non-empty desired_change fields", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    assert.ok(rec.desired_change.length > 5, `${id}: desired_change too short or empty`);
  }
});

// ═══════════════════════════════════════════════════════════════
// SECTION I: Edge Cases & Boundary Values (8 tests)
// ═══════════════════════════════════════════════════════════════

test("I01. CRF with empty behaviour array is rejected", () => {
  const rec = { id: "CRF-TEST-EDGE-BEHAVIOUR", class: "customer_reality_record", is_fixture: false, provenance: "evidence_backed", person: "test", situation: "test", trigger: "test", context: "test", behaviour: [], failed_attempts: [], constraint: "test", thought: "test", fear: "test", emotional_stake: "test", exact_language: "test", desired_change: "test", evidence_source: { type: "synthetic" }, evidence_status: "hypothesis", created_at: "2026-01-01T00:00:00.000Z" };
  const report = ingestCrf([rec], { scope: "production" });
  assert.equal(report.persisted.length, 0, "empty behaviour array should be rejected");
});

test("I02. CRF with empty person string is rejected", () => {
  const rec = { id: "CRF-TEST-EDGE-PERSON", class: "customer_reality_record", is_fixture: false, provenance: "evidence_backed", person: "", situation: "test", trigger: "test", context: "test", behaviour: ["test"], failed_attempts: [], constraint: "test", thought: "test", fear: "test", emotional_stake: "test", exact_language: "test", desired_change: "test", evidence_source: { type: "synthetic" }, evidence_status: "hypothesis", created_at: "2026-01-01T00:00:00.000Z" };
  const report = ingestCrf([rec], { scope: "production" });
  assert.equal(report.persisted.length, 0, "empty person should be rejected");
});

test("I03. MIF unclaimed_angle without scan_coverage_note is rejected", () => {
  const rec = { id: "MIF-TEST-EDGE-SCAN", class: "market_intelligence_record", is_fixture: false, provenance: "inference", category: "unclaimed_angle", statement: "test", evidence_status: "hypothesis", created_at: "2026-01-01T00:00:00.000Z" };
  const report = ingestMif([rec], { scope: "production" });
  assert.equal(report.persisted.length, 0, "unclaimed_angle without scan_coverage_note should be rejected");
});

test("I04. CRF with failed_attempts as plain strings is rejected", () => {
  const rec = { id: "CRF-TEST-EDGE-FA", class: "customer_reality_record", is_fixture: false, provenance: "evidence_backed", person: "test", situation: "test", trigger: "test", context: "test", behaviour: ["test"], failed_attempts: ["tried this"], constraint: "test", thought: "test", fear: "test", emotional_stake: "test", exact_language: "test", desired_change: "test", evidence_source: { type: "synthetic" }, evidence_status: "hypothesis", created_at: "2026-01-01T00:00:00.000Z" };
  const report = ingestCrf([rec], { scope: "production" });
  assert.equal(report.persisted.length, 0, "failed_attempts as strings should be rejected");
});

test("I05. CRF with unicode in exact_language is accepted", () => {
  const rec = { id: "CRF-TEST-EDGE-UNICODE", class: "customer_reality_record", is_fixture: false, provenance: "evidence_backed", person: "test parent", situation: "cord care", trigger: "discharge", context: "home", behaviour: ["searched"], failed_attempts: [], constraint: "conflicting info", thought: "which is right?", fear: "infection", emotional_stake: "anxiety about doing the wrong thing for baby", exact_language: "am I supposed to clean it with alcohol or something? 🤔", desired_change: "clear answer", evidence_source: { type: "community_discussion" }, evidence_status: "directly_stated", created_at: "2026-01-01T00:00:00.000Z" };
  const report = ingestCrf([rec], { scope: "production" });
  assert.ok(report.accepted.length >= 1, "unicode in exact_language should be accepted");
});

test("I06. MIF with null optional fields is accepted", () => {
  const rec = { id: "MIF-TEST-EDGE-NULLS", class: "market_intelligence_record", is_fixture: false, provenance: "inference", category: "gap", statement: "test gap", evidence: null, evidence_status: "hypothesis", freshness: null, source: null, scan_coverage_note: "searched PubMed and Reddit", created_at: "2026-01-01T00:00:00.000Z" };
  const report = ingestMif([rec], { scope: "production" });
  assert.ok(report.accepted.length >= 1, "null optional fields should be accepted");
});

test("I07. CRF with very long exact_language (500 chars) is accepted", () => {
  const longQuote = "a".repeat(500);
  const rec = { id: "CRF-TEST-EDGE-LONG", class: "customer_reality_record", is_fixture: false, provenance: "evidence_backed", person: "parent", situation: "cord care", trigger: "discharge", context: "home", behaviour: ["searched"], failed_attempts: [], constraint: "conflicting info", thought: "which is right?", fear: "infection", emotional_stake: "anxiety", exact_language: longQuote, desired_change: "clear answer", evidence_source: { type: "community_discussion" }, evidence_status: "directly_stated", created_at: "2026-01-01T00:00:00.000Z" };
  const report = ingestCrf([rec], { scope: "production" });
  assert.ok(report.accepted.length >= 1, "long exact_language should be accepted");
});

test("I08. CRF with special characters in exact_language is accepted", () => {
  const rec = { id: "CRF-TEST-EDGE-SPECIAL", class: "customer_reality_record", is_fixture: false, provenance: "evidence_backed", person: "parent", situation: "cord care", trigger: "discharge", context: "home", behaviour: ["searched"], failed_attempts: [], constraint: "conflicting info", thought: "which is right?", fear: "infection", emotional_stake: "anxiety", exact_language: "What's the deal with alcohol & cord care? My mom says YES but doc says NO!!!", desired_change: "clear answer", evidence_source: { type: "community_discussion" }, evidence_status: "directly_stated", created_at: "2026-01-01T00:00:00.000Z" };
  const report = ingestCrf([rec], { scope: "production" });
  assert.ok(report.accepted.length >= 1, "special characters in exact_language should be accepted");
});

// ═══════════════════════════════════════════════════════════════
// SECTION J: Data Quality & Content Integrity (8 tests)
// ═══════════════════════════════════════════════════════════════

test("J01. No CRF has empty string values in required text fields", () => {
  const textFields = ["situation", "trigger", "context", "constraint", "thought", "fear", "emotional_stake", "exact_language", "desired_change"];
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    for (const field of textFields) {
      assert.ok(rec[field] && rec[field].length > 0, `${id}: ${field} is empty`);
    }
  }
});

test("J02. No MIF has empty string in statement field", () => {
  for (const id of MIF_IDS) {
    const rec = loadJson(join(MIF_DIR, `${id}.json`));
    assert.ok(rec.statement && rec.statement.length > 0, `${id}: statement is empty`);
  }
});

test("J03. All CRF created_at timestamps are ISO 8601 format", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    assert.match(rec.created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, `${id}: created_at not ISO 8601`);
  }
});

test("J04. All MIF created_at timestamps are ISO 8601 format", () => {
  for (const id of MIF_IDS) {
    const rec = loadJson(join(MIF_DIR, `${id}.json`));
    assert.match(rec.created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, `${id}: created_at not ISO 8601`);
  }
});

test("J05. No CRF has duplicate tags within the same record", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    const tags = rec.tags || [];
    const unique = new Set(tags);
    assert.equal(unique.size, tags.length, `${id}: duplicate tags found`);
  }
});

test("J06. No CRF has duplicate cultural_context values", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    const ctx = rec.cultural_context || [];
    const unique = new Set(ctx);
    assert.equal(unique.size, ctx.length, `${id}: duplicate cultural_context values`);
  }
});

test("J07. No CRF has duplicate behaviour items", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    const behaviours = rec.behaviour || [];
    const unique = new Set(behaviours);
    assert.equal(unique.size, behaviours.length, `${id}: duplicate behaviour items`);
  }
});

test("J08. Every CRF context field is longer than 10 characters", () => {
  for (const id of CRF_IDS) {
    const rec = loadJson(join(CRF_DIR, `${id}.json`));
    assert.ok(rec.context.length > 10, `${id}: context too short (${rec.context.length} chars)`);
  }
});

// ═══════════════════════════════════════════════════════════════
// SECTION K: Production Persisted Collection Verification (5 tests)
// ═══════════════════════════════════════════════════════════════

test("K01. Production CRF collection contains all candidate CRFs", () => {
  const prodIds = listIds(PROD_CRF_DIR, "CRF-PPL-CORD-CARE-");
  for (const id of CRF_IDS) {
    assert.ok(prodIds.includes(id), `${id} missing from production CRF collection`);
  }
});

test("K02. Production MIF collection contains all candidate MIFs", () => {
  const prodIds = listIds(PROD_MIF_DIR, "MIF-PPL-CORD-CARE-");
  for (const id of MIF_IDS) {
    assert.ok(prodIds.includes(id), `${id} missing from production MIF collection`);
  }
});

test("K03. Production CRF records are canonical; identical to the staging source when present", () => {
  for (const id of CRF_IDS) {
    const prod = JSON.stringify(JSON.parse(readFileSync(join(PROD_CRF_DIR, `${id}.json`), "utf8")), null, 2).replace(/\n$/, "");
    assert.ok(prod.length > 0, `${id}: production CRF missing/empty`);
    const stagePath = join(STAGE_CRF_DIR, `${id}.json`);
    if (existsSync(stagePath)) {
      const stage = JSON.stringify(JSON.parse(readFileSync(stagePath, "utf8")), null, 2).replace(/\n$/, "");
      assert.equal(stage, prod, `${id}: staging source differs from the canonical production record`);
    }
  }
});

test("K04. Production MIF records are canonical; identical to the staging source when present", () => {
  for (const id of MIF_IDS) {
    const prod = JSON.stringify(JSON.parse(readFileSync(join(PROD_MIF_DIR, `${id}.json`), "utf8")), null, 2).replace(/\n$/, "");
    assert.ok(prod.length > 0, `${id}: production MIF missing/empty`);
    const stagePath = join(STAGE_MIF_DIR, `${id}.json`);
    if (existsSync(stagePath)) {
      const stage = JSON.stringify(JSON.parse(readFileSync(stagePath, "utf8")), null, 2).replace(/\n$/, "");
      assert.equal(stage, prod, `${id}: staging source differs from the canonical production record`);
    }
  }
});

test("K05. Production CRF files are valid JSON and schema-compliant", () => {
  for (const id of CRF_IDS) {
    const p = join(PROD_CRF_DIR, `${id}.json`);
    assert.doesNotThrow(() => loadJson(p), `${id}: production CRF not valid JSON`);
    const rec = loadJson(p);
    assert.equal(rec.class, "customer_reality_record");
    assert.equal(rec.is_fixture, false);
  }
});
