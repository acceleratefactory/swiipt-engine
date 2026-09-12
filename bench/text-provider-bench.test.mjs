// Text-provider benchmark tests — deterministic, injected fetch, no network, no keys.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadBenchFixture, buildGenerationTask, buildCriticCases, goodBenchAsset, REQUIRED_FIELDS } from "./fixtures.mjs";
import { evaluateGeneratorOutput, runGenerator, runCritic, compare, runBenchmark, renderMarkdown, resolveProvider, normalizeCandidate } from "./text-provider-bench.mjs";

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

// ---------- multi-provider support ----------

test("11. two candidates can use different provider base URLs", async () => {
  const fx = loadBenchFixture();
  const task = buildGenerationTask(fx);
  const env = { P1_BASE_URL: "https://p1.example/v1", P1_API_KEY: "testkey-p1-aaaaaaaa", P2_BASE_URL: "https://p2.example/v1", P2_API_KEY: "testkey-p2-bbbbbbbb" };
  const profiles = { p1: { base_url_env: "P1_BASE_URL", api_key_env: "P1_API_KEY" }, p2: { base_url_env: "P2_BASE_URL", api_key_env: "P2_API_KEY" } };
  const hits = [];
  const fetchImpl = async (url, opts) => { hits.push({ url, auth: opts.headers.Authorization }); return { ok: true, status: 200, json: async () => ({ model: "m", choices: [{ message: { content: JSON.stringify(goodBenchAsset(fx)) } }], usage }) }; };
  const g1 = await runGenerator({ provider: "p1", model: "m1" }, { task, fixture: fx, env, profiles, fetchImpl });
  const g2 = await runGenerator({ provider: "p2", model: "m2" }, { task, fixture: fx, env, profiles, fetchImpl });
  assert.equal(hits[0].url, "https://p1.example/v1/chat/completions");
  assert.equal(hits[1].url, "https://p2.example/v1/chat/completions");
  assert.equal(g1.provider, "p1");
  assert.equal(g2.provider, "p2");
});

test("12. two candidates can use different API keys without exposing them", async () => {
  const fx = loadBenchFixture();
  const task = buildGenerationTask(fx);
  const k1 = "testkey-p1-aaaaaaaa", k2 = "testkey-p2-bbbbbbbb";
  const env = { P1_BASE_URL: "https://p1.example/v1", P1_API_KEY: k1, P2_BASE_URL: "https://p2.example/v1", P2_API_KEY: k2 };
  const profiles = { p1: { base_url_env: "P1_BASE_URL", api_key_env: "P1_API_KEY" }, p2: { base_url_env: "P2_BASE_URL", api_key_env: "P2_API_KEY" } };
  const hits = [];
  const fetchImpl = async (url, opts) => { hits.push({ url, auth: opts.headers.Authorization }); return { ok: true, status: 200, json: async () => ({ model: "m", choices: [{ message: { content: JSON.stringify(goodBenchAsset(fx)) } }], usage }) }; };
  const g1 = await runGenerator({ provider: "p1", model: "m1" }, { task, fixture: fx, env, profiles, fetchImpl });
  const g2 = await runGenerator({ provider: "p2", model: "m2" }, { task, fixture: fx, env, profiles, fetchImpl });
  assert.equal(hits[0].auth, `Bearer ${k1}`);
  assert.equal(hits[1].auth, `Bearer ${k2}`);
  assert.notEqual(hits[0].auth, hits[1].auth);
  const all = JSON.stringify({ g1, g2 });
  assert.equal(all.includes(k1), false);
  assert.equal(all.includes(k2), false);
});

test("13. provider identity and endpoint host are recorded; unknown/missing profiles fail honestly", async () => {
  const fx = loadBenchFixture();
  const task = buildGenerationTask(fx);
  const env = { P1_BASE_URL: "https://p1.example/v1", P1_API_KEY: "testkey-p1-aaaaaaaa" };
  const profiles = { p1: { base_url_env: "P1_BASE_URL", api_key_env: "P1_API_KEY" } };
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ model: "m1", choices: [{ message: { content: JSON.stringify(goodBenchAsset(fx)) } }] }) });
  const g = await runGenerator({ provider: "p1", model: "m1" }, { task, fixture: fx, env, profiles, fetchImpl });
  assert.equal(g.provider, "p1");
  assert.equal(g.endpoint_host, "p1.example");
  assert.equal(resolveProvider({}, "xkiro", {}).ok, false);
  assert.match(resolveProvider({}, "xkiro", {}).error, /unknown provider profile/);
  assert.deepEqual(normalizeCandidate({ provider: "deepseek", model: "x" }), { provider: "deepseek", model: "x" });
});

test("14. returned-model mismatch is surfaced as MODEL_ID_MISMATCH", async () => {
  const fx = loadBenchFixture();
  const task = buildGenerationTask(fx);
  const env = { P1_BASE_URL: "https://p1.example/v1", P1_API_KEY: "testkey-p1-aaaaaaaa" };
  const profiles = { p1: { base_url_env: "P1_BASE_URL", api_key_env: "P1_API_KEY" } };
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ model: "substituted-model-x", choices: [{ message: { content: JSON.stringify(goodBenchAsset(fx)) } }] }) });
  const g = await runGenerator({ provider: "p1", model: "requested-model-y" }, { task, fixture: fx, env, profiles, fetchImpl });
  assert.equal(g.requested_model, "requested-model-y");
  assert.equal(g.returned_model, "substituted-model-x");
  assert.equal(g.model_identity, "MODEL_ID_MISMATCH");
});

test("15. one provider failure does not substitute another provider or key", async () => {
  const fx = loadBenchFixture();
  const task = buildGenerationTask(fx);
  const env = { P1_BASE_URL: "https://p1.example/v1", P1_API_KEY: "testkey-p1-aaaaaaaa", P2_BASE_URL: "https://p2.example/v1", P2_API_KEY: "testkey-p2-bbbbbbbb" };
  const profiles = { p1: { base_url_env: "P1_BASE_URL", api_key_env: "P1_API_KEY" }, p2: { base_url_env: "P2_BASE_URL", api_key_env: "P2_API_KEY" } };
  const hits = [];
  const fetchImpl = async (url, opts) => { hits.push({ url, auth: opts.headers.Authorization }); if (url.includes("p1.example")) throw new Error("p1 down"); return { ok: true, status: 200, json: async () => ({ model: "m2", choices: [{ message: { content: JSON.stringify(goodBenchAsset(fx)) } }] }) }; };
  const g1 = await runGenerator({ provider: "p1", model: "m1" }, { task, fixture: fx, env, profiles, fetchImpl });
  const g2 = await runGenerator({ provider: "p2", model: "m2" }, { task, fixture: fx, env, profiles, fetchImpl });
  assert.equal(g1.provider_status, "PROVIDER_ATTEMPT_FAILED");
  assert.equal(g1.provider, "p1");
  assert.equal(g2.provider_status, "PROVIDER_SUCCESS");
  assert.equal(g2.provider, "p2");
  assert.ok(hits.filter((h) => h.url.includes("p1.example")).every((h) => h.auth === "Bearer testkey-p1-aaaaaaaa"));
  assert.ok(hits.filter((h) => h.url.includes("p2.example")).every((h) => h.auth === "Bearer testkey-p2-bbbbbbbb"));
});

test("15b. a candidate whose own provider env is missing never falls back to OPENAI_*", async () => {
  const fx = loadBenchFixture();
  const task = buildGenerationTask(fx);
  const env = { OPENAI_API_KEY: "testkey-should-not-be-used", OPENAI_BASE_URL: "https://openai.example/v1" };
  const profiles = { p3: { base_url_env: "P3_BASE_URL", api_key_env: "P3_API_KEY" } };
  let called = 0;
  const fetchImpl = async () => { called++; return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "{}" } }] }) }; };
  const g = await runGenerator({ provider: "p3", model: "m" }, { task, fixture: fx, env, profiles, fetchImpl });
  assert.equal(g.provider_status, "PROVIDER_NOT_CONFIGURED");
  assert.equal(called, 0);
  assert.match(g.error, /not configured/);
});

test("16. mismatched-model candidates are excluded from the recommendation", () => {
  const cmp = compare([
    { provider: "p1", model: "m1", model_identity: "MODEL_ID_MISMATCH", parse_ok: true, schema_valid: true, deterministic_score: 0.99, usable_without_rewrite: true, latency_ms: 100, provider_status: "PROVIDER_SUCCESS" },
    { provider: "p2", model: "m2", model_identity: "OK", parse_ok: true, schema_valid: true, deterministic_score: 0.6, usable_without_rewrite: true, latency_ms: 200, provider_status: "PROVIDER_SUCCESS" },
  ], []);
  assert.equal(cmp.recommended_generator, "m2");
  assert.equal(cmp.model_mismatch_candidates.length, 1);
  assert.equal(cmp.recommended_generator_ref.provider, "p2");
});

test("17. credentials never enter JSON or Markdown results across providers", async () => {
  const fx = loadBenchFixture();
  const k1 = "testkey-p1-aaaaaaaa", k2 = "testkey-p2-bbbbbbbb";
  const env = { P1_BASE_URL: "https://p1.example/v1", P1_API_KEY: k1, P2_BASE_URL: "https://p2.example/v1", P2_API_KEY: k2 };
  const profiles = { p1: { base_url_env: "P1_BASE_URL", api_key_env: "P1_API_KEY" }, p2: { base_url_env: "P2_BASE_URL", api_key_env: "P2_API_KEY" } };
  const result = await runBenchmark({ generators: [{ provider: "p1", model: "m1" }, { provider: "p2", model: "m2" }], critics: [{ provider: "p2", model: "c1" }], profiles, env, fetchImpl: combinedFetch(goodBenchAsset(fx)) });
  const json = JSON.stringify(result), md = renderMarkdown(result);
  for (const k of [k1, k2]) { assert.equal(json.includes(k), false); assert.equal(md.includes(k), false); }
  assert.ok(result.generators.every((g) => g.provider && g.endpoint_host));
  assert.ok(result.comparison.recommended_generator);
});

// ---------- strict schema gate + NOT_EVALUATED + progress ----------

test("18. JSON parses but schema fails: content evaluated, structural FAIL, recommendation blocked", async () => {
  const fx = loadBenchFixture();
  const task = buildGenerationTask(fx);
  const partial = { angle_id: fx.angle.id, platform: "whatsapp", headline: "At 3 AM she has to stand up.", body: "Module 2 - the 3-Position Recovery Method helps her rise without straining the incision. Reply YES.", cta: "Reply YES and I'll send you the details.", risk_flags: [] };
  const env = { OPENAI_API_KEY: "testkey-abcdefghijklmnop" };
  const g = await runGenerator("model-a", { task, fixture: fx, env, fetchImpl: genFetch(partial) });
  assert.equal(g.parse_ok, true);
  assert.equal(g.schema_valid, false);
  assert.ok(g.schema_errors.length >= 1, "schema errors must be recorded");
  assert.equal(g.structural_reliability, "FAIL");
  assert.equal(g.structural_reliability_score, 0.5);
  assert.notEqual(g.content_quality_score, null, "content dimensions must still be evaluated");
  assert.equal(g.usable_without_rewrite, false);
  assert.equal(g.recommendation_eligible, false);
  assert.match(g.recommendation_blocked_reason, /schema/i);
  assert.ok(g.dimensions.some((d) => d.status === "evaluated"));
});

test("19. unparseable output is NOT_EVALUATED (never converted to a genuine score of 0)", () => {
  const fx = loadBenchFixture();
  const r = evaluateGeneratorOutput(fx, null, { parseOk: false, schemaValid: false });
  assert.ok(r.dimensions.every((d) => d.status === "NOT_EVALUATED" && d.score === null));
  assert.equal(r.content_quality_score, null);
  assert.equal(r.deterministic_score, null);
  assert.equal(r.structural_reliability, "FAIL");
  assert.equal(r.structural_reliability_score, 0);
  assert.equal(r.usable_without_rewrite, false);
});

test("20. a schema-failing candidate is never production-recommended over a valid one", () => {
  const cmp = compare([
    { provider: "p", model: "schema-fail", parse_ok: true, schema_valid: false, structural_reliability: "FAIL", content_quality_score: 0.99, usable_without_rewrite: false, blocking: ["structural_reliability"], latency_ms: 50, provider_status: "PROVIDER_SUCCESS", model_identity: "OK", schema_errors: [{ path: "/mechanism", message: "required" }] },
    { provider: "p", model: "valid", parse_ok: true, schema_valid: true, structural_reliability: "PASS", content_quality_score: 0.6, usable_without_rewrite: true, blocking: [], latency_ms: 200, provider_status: "PROVIDER_SUCCESS", model_identity: "OK", schema_errors: [] },
  ], []);
  assert.equal(cmp.recommended_generator, "valid");
  assert.equal(cmp.schema_failed_generators.length, 1);
  assert.ok(cmp.recommendation_blocked.some((b) => b.model === "schema-fail"));
});

test("21. live progress reports START/end with JSON/SCHEMA status for generator and critic", async () => {
  const fx = loadBenchFixture();
  const lines = [];
  await runBenchmark({
    generators: ["model-a", "model-b"], critics: ["critic-x"],
    env: { OPENAI_API_KEY: "testkey-abcdefghijklmnop" },
    fetchImpl: combinedFetch(goodBenchAsset(fx)),
    progress: (m) => lines.push(m),
  });
  assert.ok(lines.some((l) => /^\[GEN 1\/2\] .* START$/.test(l)), "generator START line");
  assert.ok(lines.some((l) => /^\[GEN 1\/2\] (SUCCESS|FAIL) \d+(\.\d+)?s — JSON (PASS|FAIL) \/ SCHEMA (PASS|FAIL)/.test(l)), "generator end line");
  assert.ok(lines.some((l) => /^\[CRITIC 1\/9\] /.test(l)), "critic progress line");
});

test("22. schema errors are recorded in the JSON result and the Markdown report", async () => {
  const fx = loadBenchFixture();
  const partial = { angle_id: fx.angle.id, platform: "whatsapp", headline: "Missing most required fields." };
  const fetchImpl = async (url, opts) => {
    const body = JSON.parse(opts.body);
    const sys = body.messages?.[0]?.content || "";
    if (/Writing Critic/.test(sys)) return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({ findings: [] }) } }] }) };
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(partial) } }] }) };
  };
  const result = await runBenchmark({ generators: ["model-a"], critics: ["critic-x"], env: { OPENAI_API_KEY: "testkey-abcdefghijklmnop" }, fetchImpl });
  assert.ok(result.generators[0].schema_errors.length >= 1);
  assert.equal(result.comparison.schema_failed_generators.length, 1);
  const md = renderMarkdown(result);
  assert.match(md, /## SCHEMA ERRORS/);
  assert.match(md, /schema validation failed|\[required\]|required/);
  assert.equal(result.comparison.recommended_generator, null);
});
