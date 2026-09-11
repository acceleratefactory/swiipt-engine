#!/usr/bin/env node
// Writing / Generation Control Layer — TEST SUITE.
// Deterministic tests for the layer itself (governing prompt STEP 10).
// Run: node harness/writing-control.test.mjs
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020.js";
import { loadConfig, buildGenerationBrief } from "./writing-control.mjs";
import { analyzeProse, analyzeMarkdown, checkAssetStructure } from "./writing-checks.mjs";
import { runCritic, buildRevisionPlan, checkChangeControl, scopeCheck } from "./writing-critic.mjs";
import { runPasses } from "./writing-passes.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const queue = [];
const T = (name, fn) => queue.push([name, fn]);

// 1. config validates against its schema
T("config valid against writing-control.schema.json", () => {
  const ajv = new Ajv({ allErrors: true, strict: false });
  for (const f of readdirSync(join(root, "schemas")).filter((x) => x.endsWith(".schema.json"))) {
    const s = JSON.parse(readFileSync(join(root, "schemas", f), "utf8"));
    s.$id = "https://swiipt.com/factory/schemas/" + f;
    try { ajv.addSchema(s); } catch (e) { /* already */ }
  }
  assert.equal(ajv.validate("https://swiipt.com/factory/schemas/writing-control.schema.json", loadConfig()), true, JSON.stringify(ajv.errors));
});

// 2. contract ingestion: READY when the TR is complete; SOURCE_REQUIRED when it is thin
T("CORD-CARE contract -> READY", () => assert.equal(buildGenerationBrief("PPL-CORD-CARE-001").status, "READY"));
T("NIGHT-SHIFT contract -> SOURCE_REQUIRED (missing TR)", () => {
  const r = buildGenerationBrief("PPL-NIGHT-SHIFT-001");
  assert.equal(r.status, "SOURCE_REQUIRED");
  assert.ok(r.findings.some((f) => f.code === "transformation_specification_missing"));
});

// 3. anti-AI controls
T("NEVER phrase is a blocker", () => {
  const f = analyzeProse("In conclusion, take control of your day.", "t");
  assert.ok(f.some((x) => x.code === "NEVER_phrase" && x.severity === "BLOCKER" && x.status === "NEVER"));
});
T("filler is a warning", () => {
  assert.ok(analyzeProse("It goes without saying that rest matters.", "t").some((x) => x.code === "filler" && x.severity === "WARNING"));
});
T("repeated sentence is a warning", () => {
  const s = "This exact sentence is repeated here for the test case.";
  assert.ok(analyzeProse(s + " " + s, "t").some((x) => x.code === "repetition" && x.severity === "WARNING"));
});

// 4. structure
T("heading excess is a warning", () => {
  const doc = Array.from({ length: 14 }, (_, i) => "## Heading " + i + "\nword").join("\n");
  assert.ok(analyzeMarkdown(doc, "t").some((x) => x.code === "heading_excess" && x.severity === "WARNING"));
});

// 5. asset structure
T("raw HTML is UNSUPPORTED blocker", () => {
  assert.ok(checkAssetStructure('<div class="x">hi</div>', "t").some((x) => x.status === "UNSUPPORTED" && x.severity === "BLOCKER"));
});
T("unbalanced widget is UNSUPPORTED blocker", () => {
  assert.ok(checkAssetStructure("[[DECISION]]\nROUTE: a | b | c | d", "t").some((x) => x.code === "asset_widget_unbalanced"));
});

// 6. scope-drift protection
T("scope drift flags when content shares no situation language", () => {
  const cord = buildGenerationBrief("PPL-CORD-CARE-001");
  const fake = { ...cord.brief, situation: { person: "quantum astrophysics", specific_situation: "rocket thermodynamics propulsion", problem: "cryptocurrency algorithmic trading" } };
  assert.ok(scopeCheck(fake, {}).some((f) => f.status === "SCOPE_DRIFT"));
});
T("no false scope drift on a real product", () => {
  const cord = buildGenerationBrief("PPL-CORD-CARE-001");
  assert.equal(scopeCheck(cord.brief, {}).length, 0);
});

// 7. change control
T("change control flags a protected-field change", () => {
  const a = { customer: { situation: "A" }, commercial_role: { role: "core" }, evidence: {}, safety: {}, tsm: {}, transformation: { before_state: {}, after_state: {}, mechanism: {} } };
  const b = JSON.parse(JSON.stringify(a)); b.customer.situation = "B";
  assert.ok(checkChangeControl(a, b).some((x) => x.status === "UPSTREAM_CONTRACT_CHANGE_REQUIRED"));
});

// 8. controlled passes
T("passes: CORD-CARE runs 1-7; NIGHT-SHIFT stops at 1", () => {
  assert.equal(runPasses("PPL-CORD-CARE-001", { generate: false }).passes.length, 7);
  const ns = runPasses("PPL-NIGHT-SHIFT-001", { generate: false });
  assert.equal(ns.status, "SOURCE_REQUIRED");
  assert.equal(ns.passes.length, 1);
});

// 9. critic behaviour (never a fake PASS)
T("critic: LLM NOT_RUN; strict -> HUMAN_REVIEW", async () => {
  const normal = await runCritic("PPL-CORD-CARE-001", { strict: false });
  assert.equal(normal.llm_status, "NOT_RUN");
  assert.notEqual(normal.status, "PASS");
  assert.equal((await runCritic("PPL-CORD-CARE-001", { strict: true })).status, "HUMAN_REVIEW");
});

// 10. targeted revision plan
T("revision plan maps a finding", async () => {
  const plan = buildRevisionPlan(await runCritic("PPL-CORD-CARE-001"));
  assert.ok(plan.length >= 1);
  assert.ok(plan[0].failed_component && plan[0].reason && plan[0].required_change);
});

// 11. generation manifest record (§34)
T("generation-manifest.json has all §34 fields", () => {
  const fp = join(root, "data", "products", "PPL-CORD-CARE-001", "copy", "generation-manifest.json");
  assert.ok(existsSync(fp), "expected the Phase-5 execution record to exist");
  const m = JSON.parse(readFileSync(fp, "utf8"));
  for (const k of loadConfig().generation_manifest.required_fields) assert.ok(k in m, "missing field " + k);
  assert.equal(m.writing_control_version, loadConfig().writing_control_version);
});

// ---- sequential runner (awaits async tests) ----
let pass = 0, fail = 0;
for (const [name, fn] of queue) {
  try { await fn(); console.log("PASS  " + name); pass++; }
  catch (e) { console.log("FAIL  " + name + "  -> " + e.message); fail++; }
}
console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
