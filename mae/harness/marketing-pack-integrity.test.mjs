// MAE — Marketing Pack integrity closure tests (V06 remediation).
// Deterministic. No network, no providers, no filesystem writes outside tmp.
// Proves the five defect classes cannot PASS for an ARBITRARY future product (neutral TEST ids).
// Run: node --test mae/harness/marketing-pack-integrity.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const MAE = join(dirname(fileURLToPath(import.meta.url)), "..");
const { buildMarketingPack, validateMarketingPack, buildQaAggregate, PACK_CODES } = await import(pathToFileURL(join(MAE, "services/marketing-pack.js")).href);
const { contentCompleteness, isContentComplete } = await import(pathToFileURL(join(MAE, "lib/content-contract.js")).href);
const { BrandTruthService } = await import(pathToFileURL(join(MAE, "services/brand.js")).href);

const clone = (o) => JSON.parse(JSON.stringify(o));

const STATIC = (id, extra = {}) => ({
  id, class: "asset_record", product_id: "PROD-TEST", transformation_id: "TR-TEST",
  angle_id: "ANG-TEST-001", angle_verdict: "GREEN", asset_type: "SOCIAL_STATIC", asset_role: "IDENTIFICATION",
  platform: "instagram", platform_format: "feed_square", asset_purpose: "stop_scroll_identification",
  asset_brief_id: `BRIEF-TEST-${id}`, generation_record_id: `GEN-${id}`, qa_record_id: `QA-${id}`,
  family_id: "FAM-TEST-001", locked_phrase_set_id: "PSET-TEST-001",
  content: { hook_text: "A real hook", problem_text: "A real problem", bold_line: "A real line" },
  status: "DRAFT", ...extra,
});

/** A neutral, fully-reconciled future-product fixture. */
function fixture() {
  const angle = {
    id: "ANG-TEST-001", class: "marketing_angle_record",
    tier1: { customer: "Test customer", scene: "Test scene", pain: "Test pain", failed_attempt: "Test attempt", emotional_stake: { text: "Test stake", evidence_status: "strongly_evidenced" } },
    tier2: { insight: { text: "Test insight", label: "Strategic Synthesis" }, mechanism: { text: "Test mechanism" }, desired_change: "Test change", angle: "Test angle", asset_purpose: "stop_scroll_identification" },
    tier3: { product_truth_ref: "TR-TEST", source_evidence: [] },
  };
  const family = {
    id: "FAM-TEST-001", class: "asset_family_record", family_version: 1, product_id: "PROD-TEST",
    source_angle_id: "ANG-TEST-001", angle_verdict: "GREEN", platform_scope: ["instagram"],
    anchor_asset_id: "AST-TEST-A", approved_asset_ids: ["AST-TEST-A", "AST-TEST-1"],
    role_map: { "AST-TEST-A": "anchor_concept", "AST-TEST-1": "instagram_feed_static" },
    locked_phrase_set_id: "PSET-TEST-001", sequence_eligibility: ["launch_sequence"],
    evergreen_eligible: true, emotional_intensity_profile: { high: 0, medium: 1, low: 0, conversion: 0 },
    coverage: {}, family_status: "BUILDING", created_at: "2026-01-01T00:00:00Z",
  };
  const ast1 = STATIC("AST-TEST-1");
  const anchor = STATIC("AST-TEST-A", { family_role: "IDENTIFICATION" });
  const gen1 = { id: "GEN-AST-TEST-1", class: "generated_asset_record", angle_id: "ANG-TEST-001", brief_id: "BRIEF-TEST-AST-TEST-1", product_id: "PROD-TEST", asset_type: "SOCIAL_STATIC", platform: "instagram", candidates: [{ id: "cand-1", content: { hook_text: "A real hook", problem_text: "A real problem", bold_line: "A real line" } }], selected: "cand-1", generation_version: "1.0", prompt_version: "1.0", provider: "deterministic", model: null, status: "GENERATED", created_at: "2026-01-01T00:00:00Z" };
  const genA = { ...clone(gen1), id: "GEN-AST-TEST-A", brief_id: "BRIEF-TEST-AST-TEST-A" };
  const qaGates = ["GATE_1_ANTI_SLOP", "GATE_2_INTERCHANGEABILITY", "GATE_3_PLATFORM_FITNESS", "GATE_4_BRAND_CULTURAL", "GATE_5_TRUTH_COMPLIANCE", "GATE_6_CONSISTENCY_LOCK"].map((g) => ({ gate: g, input_ref: "AST-TEST-1", result: "PASS" }));
  const qa1 = { id: "QA-AST-TEST-1", class: "qa_record", asset_id: "AST-TEST-1", angle_id: "ANG-TEST-001", brief_id: "BRIEF-TEST-AST-TEST-1", gates: [...qaGates, { gate: "GATE_7_HUMAN_REVIEW", input_ref: "AST-TEST-1", result: "NOT_TRIGGERED" }], overall: "PASS", qa_status: "QA_PENDING", created_at: "2026-01-01T00:00:00Z" };
  const qaA = { ...clone(qa1), id: "QA-AST-TEST-A", asset_id: "AST-TEST-A", brief_id: "BRIEF-TEST-AST-TEST-A" };
  const pset = { id: "PSET-TEST-001", class: "locked_phrase_set", angle_id: "ANG-TEST-001", family_id: "FAM-TEST-001", phrases: ["A phrase."], established_by_asset_id: "AST-TEST-A", version: 1, status: "ACTIVE", date_established: "2026-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z" };
  const design = { design_id: "DES-TEST-001", design_version: "1.0", angle_id: "ANG-TEST-001", asset_brief_id: "BRIEF-TEST-AST-TEST-1", product_id: "PROD-TEST", asset_type: "SOCIAL_STATIC", layout_family: "TYPE_DOMINANT", platform: "instagram", placement: "feed", platform_format: "FEED_SQUARE", background_policy: { style: "solid_color", color: "#0B1F33" }, typography_roles: { primary_headline: { color: "#FFFFFF" }, body_text: { color: "#F8F4EC" } }, cta_policy: { color: "#D9A52E" } };
  return {
    meta: { id: "MP-TEST-001", product_id: "PROD-TEST", transformation_id: "TR-TEST", library_id: "m01", created_at: "2026-01-01T00:00:00Z" },
    records: { angles: [angle], families: [family], assets: [ast1, anchor], generated: [gen1, genA], qa: [qa1, qaA], design_specs: [design], visual_groundings: [], psets: [pset], campaign: null, sequence: null },
  };
}
const buildFor = (records) => buildMarketingPack({ ...fixture().meta, ...records });
const validate = (records, packOverride = null, persistedIds = null) => {
  const pack = packOverride || buildFor(records);
  return validateMarketingPack({ pack, records, persistedIds });
};

// ---------------------------------------------------------------- baseline
test("K · fully reconciled canonical pack PASSES", () => {
  const { records } = fixture();
  const v = validate(records);
  assert.equal(v.pass, true, JSON.stringify(v.failures));
});

// ---------------------------------------------------------------- A. missing artifact
test("A · a reference to a nonexistent canonical asset FAILS (artifact closure)", () => {
  const { records } = fixture();
  records.families[0].approved_asset_ids.push("AST-TEST-MISSING");
  const v = validate(records);
  assert.equal(v.pass, false);
  assert.ok(v.failures.some((f) => f.code === PACK_CODES.REFERENCE_UNRESOLVED));
});

test("A2 · a reference that exists on disk but is not in the persisted set FAILS", () => {
  const { records } = fixture();
  const v = validate(records, null, ["ANG-TEST-001", "FAM-TEST-001", "AST-TEST-A"]); // AST-TEST-1 not persisted
  assert.equal(v.pass, false);
  assert.ok(v.failures.some((f) => f.code === PACK_CODES.REFERENCE_NOT_PERSISTED));
});

// ---------------------------------------------------------------- B. placeholder
test("B · a placeholder id in canonical traceability FAILS", () => {
  const { records } = fixture();
  records.families[0].approved_asset_ids.push("AST-TEST-017-placeholder");
  const v = validate(records);
  assert.equal(v.pass, false);
  assert.ok(v.failures.some((f) => f.code === PACK_CODES.PLACEHOLDER_REFERENCE));
});

test("B2 · placeholder detection is limited to reference/id fields", () => {
  const { records } = fixture();
  records.assets[0].content.bold_line = "This is a temporary feeling, not a placeholder for TBD effort.";
  const v = validate(records);
  assert.equal(v.pass, true, "free copy containing the words must not be treated as a reference");
});

// ---------------------------------------------------------------- C. counts
test("C · a stored summary that disagrees with canonical records FAILS", () => {
  const { records } = fixture();
  const pack = buildFor(records);
  pack.asset_manifest.by_platform.instagram += 1;
  const v = validate(records, pack);
  assert.equal(v.pass, false);
  assert.ok(v.failures.some((f) => f.code === PACK_CODES.COUNT_MISMATCH));
});

test("C2 · counts are derived (no competing manual source)", () => {
  const { records } = fixture();
  const pack = buildFor(records);
  assert.equal(pack.asset_manifest.total_assets, records.assets.length);
  assert.equal(pack.asset_families.relationships["FAM-TEST-001"].asset_count, records.assets.filter((a) => a.family_id === "FAM-TEST-001").length);
});

// ---------------------------------------------------------------- D/E/F/G/H content
test("D · empty SOCIAL_STATIC content is NOT complete and cannot be a success state", () => {
  const r = contentCompleteness("SOCIAL_STATIC", { hook_text: "", problem_text: "  ", bold_line: "" });
  assert.equal(r.complete, false);
  const { records } = fixture();
  records.generated[0].candidates[0].content = { hook_text: "", problem_text: "", bold_line: "" };
  records.assets[0].content = { hook_text: "", problem_text: "", bold_line: "" };
  const v = validate(records);
  assert.equal(v.pass, false);
  assert.ok(v.failures.some((f) => f.code === PACK_CODES.CONTENT_INCOMPLETE));
});

test("E · a carousel with an empty required slide is NOT complete", () => {
  const r = contentCompleteness("SOCIAL_CAROUSEL", { slides: [{ text: "a" }, { text: "" }, { text: "c" }] });
  assert.equal(r.complete, false);
  assert.ok(r.failures.some((f) => f.code === "CONTENT_ITEM_EMPTY"));
});

test("F · story frames must all be materially populated", () => {
  const r = contentCompleteness("SOCIAL_STORY_SEQUENCE", { sequence: [{ text: "a" }, { text: "" }, { text: "c" }, { text: "d" }] });
  assert.equal(r.complete, false);
});

test("G · an empty ANCHOR record is NOT complete", () => {
  const { records } = fixture();
  records.assets[1].content = { hook_text: "", problem_text: "", bold_line: "" };
  const v = validate(records);
  assert.equal(v.pass, false);
  assert.ok(v.failures.some((f) => f.code === PACK_CODES.CONTENT_INCOMPLETE));
});

test("G2 · a PASS QA record over an incomplete asset is caught by QA defense", () => {
  const { records } = fixture();
  records.assets[0].content = { hook_text: "", problem_text: "", bold_line: "" };
  const v = validate(records); // qa record still says PASS
  assert.equal(v.pass, false);
  assert.ok(v.failures.find((f) => f.code === PACK_CODES.CONTENT_INCOMPLETE).detail.includes("PASS on incomplete asset"));
});

test("H · a populated anchor PASSES the content contract", () => {
  assert.equal(isContentComplete("SOCIAL_STATIC", { hook_text: "h", problem_text: "p", bold_line: "b" }), true);
});

// ---------------------------------------------------------------- I/J brand
test("I · an unauthorized design-spec colour is a BRAND NON-PASS", () => {
  const { records } = fixture();
  records.design_specs[0].background_policy.color = "#1A1A2E";
  const direct = BrandTruthService.checkDesignSpecColors(records.design_specs[0]);
  assert.equal(direct.pass, false);
  const v = validate(records);
  assert.equal(v.pass, false);
  assert.ok(v.failures.some((f) => f.code === PACK_CODES.BRAND_TOKEN_UNAUTHORIZED));
});

test("J · authorized brand tokens PASS", () => {
  const { records } = fixture();
  assert.equal(BrandTruthService.checkDesignSpecColors(records.design_specs[0]).pass, true);
  assert.equal(validate(records).pass, true);
});

// ---------------------------------------------------------------- L persistence
test("L · every reference resolves from the persisted (tracked) set alone", () => {
  const { records } = fixture();
  const persisted = [
    ...records.angles, ...records.families, ...records.assets, ...records.generated,
    ...records.qa, ...records.psets, ...records.design_specs,
  ].map((r) => r.id ?? r.design_id);
  const v = validate(records, null, persisted);
  assert.equal(v.pass, true, JSON.stringify(v.failures));
});

// ---------------------------------------------------------------- QA aggregate derivation
test("QA aggregate counts are a derivation of the records", () => {
  const { records } = fixture();
  const agg = buildQaAggregate({ product_id: "PROD-TEST", transformation_id: "TR-TEST", qa: records.qa, assets: records.assets, families: records.families });
  assert.equal(agg.total_qa_records, records.qa.length);
  assert.equal(agg.asset_family_coherence.total_assets, records.assets.length);
  assert.deepEqual(agg.asset_family_coherence.platform_distribution.instagram, records.assets.filter((a) => a.platform === "instagram").length);
});
