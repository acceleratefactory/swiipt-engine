// Development-provider capability record + provider-vs-compositor non-conflation. No provider calls.
// Run: node mae/harness/development-provider-record.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEVELOPMENT_IMAGE_PROVIDERS, developmentProviderRecord, isProductionQualified, geometrySensitiveRoutingAllowed,
  loadFixtures, computeFixtureHash,
} from "../services/visual-qualification.js";
import { runQualification } from "../services/visual-qualification-runner.js";
import { makeResponseAdapter } from "../media/image-provider.js";

const ID = "9router/ag/gemini-3.1-flash-image";
const rec = () => developmentProviderRecord(ID);
function pngBytes(w, h) { const b = Buffer.alloc(32); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0); b.writeUInt32BE(13, 8); b.write("IHDR", 12, "ascii"); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; }

// 1
test("1. DEVELOPMENT_ONLY is not production-qualified", () => {
  assert.equal(rec().provider_role, "DEVELOPMENT_ONLY");
  assert.equal(rec().qualification_status, "NOT_PRODUCTION_QUALIFIED");
  assert.equal(rec().integration_status, "REAL_PROVIDER_INTEGRATION_PROVEN");
  assert.equal(isProductionQualified(ID), false);
});
// 2
test("2. GEOMETRY_UNRELIABLE does not make the provider unavailable/blocked", () => {
  const r = rec();
  assert.equal(r.geometry_control, "GEOMETRY_UNRELIABLE");
  assert.ok(!("unavailable" in r) && !("blocked" in r) && !("disabled" in r));
  assert.ok(r.approved_uses.includes("real_provider_development"));
});
// 3
test("3. geometry-sensitive routing cannot mistake this finding for geometry support", () => {
  assert.equal(geometrySensitiveRoutingAllowed(ID), false);
  for (const u of ["geometry_sensitive_hero_generation", "exact_aspect_ratio_generation", "deliberate_negative_space_composition"]) {
    assert.ok(rec().not_approved_for.includes(u), u);
  }
});
// 4
test("4. compositor PASS cannot overwrite provider geometry failure", async () => {
  const adapter = makeResponseAdapter({ name: "mock", generate: async () => ({ output_base64: pngBytes(1024, 1024).toString("base64") }) });
  const r = await runQualification({ provider: "mock", model: "m", adapter, fixtures: [loadFixtures().find((f) => f.fixture_id === "VF-4")] });
  const res = r.results[0];
  const conf = res.deterministic_checks.find((c) => c.check === "provider_dimension_conformance");
  const comp = res.deterministic_checks.filter((c) => c.check.startsWith("compositor_"));
  assert.equal(conf.pass, false, "provider geometry conformance must be surfaced as a failure");
  assert.equal(conf.blocking, false);
  assert.ok(comp.length > 0 && comp.every((c) => c.pass === true), "compositor QC remains independently PASS");
  assert.notEqual(res.overall_status, "FAIL"); // provider misgeometry must not invalidate a valid artifact
});
// 5
test("5. observed owner spend $0 is not a permanent free-price claim", () => {
  const r = rec();
  assert.equal(r.cost_observation, "OWNER_SPEND_ZERO_IN_TESTS");
  assert.match(r.cost_caveat, /not a permanent free-price claim/i);
  assert.ok(!("free" in r) && !("price" in r) && !("pricing" in r));
});
// 6
test("6. returned_model null remains identity-unverified", () => {
  assert.equal(rec().returned_model_identity, "UNVERIFIED");
});
// 7
test("7. frozen fixtures are unchanged", () => {
  for (const f of loadFixtures()) assert.equal(computeFixtureHash(f), f.fixture_hash, f.fixture_id);
});
