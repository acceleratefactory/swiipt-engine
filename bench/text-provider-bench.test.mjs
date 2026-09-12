// Text-provider benchmark tests — deterministic, injected fetch, no network, no keys.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadBenchFixture, buildGenerationTask, buildCriticCases, goodBenchAsset, REQUIRED_FIELDS } from "./fixtures.mjs";
import { evaluateGeneratorOutput, runGenerator, runCritic, compare, runBenchmark, renderMarkdown } from "./text-provider-bench.mjs";

const usage = { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 };
const genFetch = (obj, sink = []) => async (url, opts) => { sink.push(JSON.parse(opts.body)); return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(obj) } }], usage }) }; };
const combinedFetch = (genObj) => async (url, opts) => {
  const body = JSON.parse(opts.body);
  const sys = body.messages?.[0]?.content || "";
  if (/Writing Critic/.test(sys)) {
    let a = {};
    try { a = JSON.parse(body.messages[1].content).asset || {}; } catch { /* ignore */ }
    const isControl = String(a.headline || "").includes("Nobody tells you what standing up feels like on day 6") && String(a.mechanism || "").includes("3-Position Recovery Method");
    const content = isControl ? JSON.stringify({ findings: [] }) : JSON.stringify({ findings: [{ status: "FAIL", severity: "BLOCKER", detail: "defect", where: "asset" }] });
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }], usage }) };
  }
  return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(genObj) } }], usage }) };
};

test("1. fixture + generation task are fixed and complete", () => {
  const fx = loadBenchFixture();
  assert.equal(fx.synthetic, true);
  assert.ok(fx.product_truth && fx.customer_truth.length >= 1 && fx.market_truth.length >= 1 && fx.brand_truth && fx.writing_constitution && fx.angle);
  const task = buildGenerationTask(fx);
  assert.match(task.system, /Writing Constitution/);
  assert.ok(task.user.includes("product_truth") && task.user.includes("customer_truth") && task.user.includes("required_fields"));
  assert.deepEqual(task.required_fields, REQUIRED_FIELDS);
});

test("2. a fully-grounded output passes the key deterministic dimensions", () => {
  const fx = loadBenchFixture();
  const r = evaluateGeneratorOutput(fx, goodBenchAsset(fx), { parseOk: true, schemaValid: true });
  const byKey = Object.fromEntries(r.dimensions.map((d) => [d.key, d]));
  assert.equal(byKey.product_truth_adherence.pass, true);
  assert.equal(byKey.anti_slop_compliance.pass, true);
  assert.equal(byKey.interchangeability.pass, true);
  assert.equal(byKey.mechanism_fidelity.pass, true);
  assert.equal(byKey.required_field_completeness.pass, true);
  assert.equal(r.usable_without_rewrite, true, JSON.stringify(r.blocking));
});

test("3. a generic / anti-slop / prohibited output fails the right dimensions", () => {
  const fx = loadBenchFixture();
  const bad = { angle_id: fx.angle.id, platform: "whatsapp", headline: "Unlock your potential.", body: "You are not alone. Take it one step at a time. You've got this.", cta: "Learn more", mechanism: "", situation: "", evidence_note: "", risk_flags: [] };
  const r = evaluateGeneratorOutput(fx, bad, { parseOk: true, schemaValid: true });
  const byKey = Object.fromEntries(r.dimensions.map((d) => [d.key, d]));
  assert.equal(byKey.anti_slop_compliance.pass, false);
  assert.equal(byKey.interchangeability.pass, false);
  assert.equal(byKey.mechanism_fidelity.pass, false);
  assert.equal(r.usable_without_rewrite, false);
});

test("4. runGenerator records provider metadata, schema validity and usage", async () => {
  const fx = loadBenchFixture();
  const task = buildGenerationTask(fx);
  const env = { OPENAI_API_KEY: "testkey-abcdefghijklmnop", OPENAI_BASE_URL: "https://gw.example/v1" };
  const g = await runGenerator("model-a", { task, fixture: fx, env, fetchImpl: genFetch(goodBenchAsset(fx)) });
  assert.equal(g.provider_status, "PROVIDER_SUCCESS");
  assert.equal(g.parse_ok, true);
  assert.equal(g.schema_valid, true);
  assert.equal(g.actual_generator, "provider");
  assert.equal(g.usage.total_tokens, 150);
  assert.ok(g.latency_ms >= 0);
  assert.ok(g.dimensions.length >= 14);
});

test("5. a failed provider call is explicit — no fake success, no substitution", async () => {
  const fx = loadBenchFixture();
  const task = buildGenerationTask(fx);
  const boom = async () => { throw new Error("network down"); };
  const g = await runGenerator("model-b", { task, fixture: fx, env: { OPENAI_API_KEY: "testkey-abcdefghijklmnop" }, fetchImpl: boom });
  assert.equal(g.provider_status, "PROVIDER_ATTEMPT_FAILED");
  assert.equal(g.parse_ok, false);
  assert.equal(g.schema_valid, false);
  assert.match(g.actual_generator, /none/);
  assert.equal(g.usable_without_rewrite, false);
});

test("6. generator is not allowed to judge itself", async () => {
  const fx = loadBenchFixture();
  const task = buildGenerationTask(fx);
  const env = { OPENAI_API_KEY: "testkey-abcdefghijklmnop" };
  const self = await runGenerator("model-a", { task, fixture: fx, env, fetchImpl: combinedFetch(goodBenchAsset(fx)), judge: { model: "model-a", fetchImpl: combinedFetch(goodBenchAsset(fx)) } });
  assert.equal(self.judgment.status, "NOT_RUN");
  assert.match(self.judgment.reason, /self-judging/);
  const other = await runGenerator("model-a", { task, fixture: fx, env, fetchImpl: combinedFetch(goodBenchAsset(fx)), judge: { model: "critic-x", fetchImpl: combinedFetch(goodBenchAsset(fx)) } });
  assert.equal(other.judgment.status, "RAN");
  assert.equal(other.judgment.model, "critic-x");
});

test("7. critic benchmark measures detection, false positives and reliability", async () => {
  const fx = loadBenchFixture();
  const cases = buildCriticCases(fx);
  const c = await runCritic("critic-x", { cases, env: { OPENAI_API_KEY: "testkey-abcdefghijklmnop" }, fetchImpl: combinedFetch(goodBenchAsset(fx)) });
  assert.equal(c.defect_count, cases.filter((x) => x.expect_defect).length);
  assert.equal(c.true_detections, c.defect_count);
  assert.equal(c.false_negatives, 0);
  assert.equal(c.false_positives, 0);            // valid control not flagged
  assert.equal(c.schema_reliability, 1);
  assert.equal(c.f1, 1);
});

test("8. compare recommends and flags self-judge conflict", () => {
  const genRank = [
    { model: "good", parse_ok: true, schema_valid: true, deterministic_score: 0.9, usable_without_rewrite: true, latency_ms: 500, provider_status: "PROVIDER_SUCCESS" },
    { model: "weak", parse_ok: true, schema_valid: true, deterministic_score: 0.4, usable_without_rewrite: false, latency_ms: 300, provider_status: "PROVIDER_SUCCESS" },
    { model: "dead", parse_ok: false, schema_valid: false, deterministic_score: 0, usable_without_rewrite: false, latency_ms: 100, provider_status: "PROVIDER_ATTEMPT_FAILED" },
  ];
  const critRank = [
    { model: "critic-x", f1: 1, precision: 1, recall: 1, false_positives: 0, false_negatives: 0, schema_reliability: 1, avg_latency_ms: 400, failure_rate: 0 },
  ];
  const cmp = compare(genRank, critRank);
  assert.equal(cmp.recommended_generator, "good");
  assert.equal(cmp.secondary_generator, "weak");
  assert.equal(cmp.recommended_critic, "critic-x");
  assert.equal(cmp.structurally_failed_generators[0].model, "dead");
  const conflict = compare([{ ...genRank[0], model: "critic-x" }], critRank);
  assert.equal(conflict.self_judge_conflict, true);
});

test("9. full benchmark run produces a machine-readable result with no credential", async () => {
  const fx = loadBenchFixture();
  const key = "testkey-SECRET-1234567890abcdef";
  const env = { OPENAI_API_KEY: key, OPENAI_BASE_URL: "https://gw.example/v1" };
  const result = await runBenchmark({ generators: ["model-a", "model-b"], critics: ["critic-x"], env, fetchImpl: combinedFetch(goodBenchAsset(fx)) });
  assert.ok(result.comparison.recommended_generator);
  assert.ok(result.comparison.recommended_critic);
  assert.equal(JSON.stringify(result).includes(key), false);
  assert.match(renderMarkdown(result), /RECOMMENDED GENERATOR/);
  assert.match(renderMarkdown(result), /CRITIC COMPARISON/);
});

test("10. no candidates -> explicit failure (never a silent default)", async () => {
  await assert.rejects(() => runBenchmark({ generators: [], critics: [], env: { OPENAI_API_KEY: "x" } }), /no generator candidates/);
});
