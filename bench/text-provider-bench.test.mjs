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
    { model: "critic-x", model_identity: "OK", f1: 1, precision: 1, recall: 1, severity_accuracy: 1, false_positives: 0, false_negatives: 0, schema_reliability: 1, provider_reliability: 1, avg_latency_ms: 400, case_failure_rate: 0 },
  ];
  const cmp = compare(genRank, critRank);
  assert.equal(cmp.recommended_generator, "good");
  assert.equal(cmp.secondary_generator, "weak");
  assert.equal(cmp.recommended_critic, "critic-x");
  assert.equal(cmp.structurally_failed_generators[0].model, "dead");
  const conflict = compare([{ ...genRank[0], model: "critic-x" }], critRank);
  assert.equal(conflict.self_judge_conflict, true);
  assert.equal(conflict.recommended_critic, null, "self-judging critic must not be recommended");
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

// ---------- Correction 1: Customer Truth grounding scorer ----------
import { scoreCustomerTruth, CUSTOMER_ANCHOR_TARGET } from "./text-provider-bench.mjs";
import { chatCompletion } from "../lib/provider-client.mjs";

const faithfulR1 = "At 3 AM the baby is finally asleep, and she has to get up from the bed. The incision pulls and burns, so she braces against the bed frame and waits for the pain to pass.";
const record3Text = "Everyone's advice was written for a normal delivery and none of it fit a C-section body, so she tried it anyway and it only made things worse.";

test("24. faithful paraphrase grounded in multiple CRF facts scores high (full-CRF coverage)", () => {
  const fx = loadBenchFixture();
  const r = scoreCustomerTruth(fx, faithfulR1);
  assert.ok(r.score >= 0.8, `expected high coverage, got ${r.score}`);
  assert.equal(r.pass, true);
  assert.ok(r.diagnostics.matched_anchors >= 3, "multiple independent anchors must contribute");
  assert.equal(r.diagnostics.best_record, "CRF-CSEC-014");
});

test("25. single-token gaming ('scared') cannot produce a high Customer Truth score", () => {
  const fx = loadBenchFixture();
  const game = scoreCustomerTruth(fx, "scared. scared. scared. scared.");
  const real = scoreCustomerTruth(fx, faithfulR1);
  assert.ok(game.score < 0.3, `gaming score should be low, got ${game.score}`);
  assert.equal(game.pass, false);
  assert.ok(real.score > game.score, "a single repeated token must score below a grounded paraphrase");
  assert.ok((game.diagnostics.matched_anchors || 0) <= 1);
});

test("26. generic copy with weak grounding scores low and fails", () => {
  const fx = loadBenchFixture();
  const r = scoreCustomerTruth(fx, "You are not alone. Take it one step at a time. You are stronger than you know.");
  assert.ok(r.score < 0.3, `generic should be low, got ${r.score}`);
  assert.equal(r.pass, false);
});

test("27. invented customer detail is detected and protected against", () => {
  const fx = loadBenchFixture();
  const invented = faithfulR1 + ' \u201cI cried myself to sleep and nobody helped me,\u201d she said.';
  const r = scoreCustomerTruth(fx, invented);
  assert.ok(r.invention_flags.length >= 1, "fabricated quote must be flagged");
  assert.ok(r.score <= 0.2, "invented detail must heavily cap the score");
  assert.equal(r.pass, false);
  const geo = evaluateGeneratorOutput(fx, { angle_id: fx.angle.id, platform: "whatsapp", headline: "At 3 AM she has to stand up.", body: invented, cta: "Reply YES", mechanism: "Module 2 - The 3-Position Recovery Method", situation: "Day 6 after a C-section.", evidence_note: "Educational content.", risk_flags: [] }, { parseOk: true, schemaValid: true });
  assert.ok(geo.blocking.includes("customer_truth_invention"), "invention must enter blocking");
  assert.equal(geo.usable_without_rewrite, false);
});

test("28. grounding in CRF record 2/3 is recognised (not only record 1)", () => {
  const fx = loadBenchFixture();
  const r = scoreCustomerTruth(fx, record3Text);
  assert.equal(r.diagnostics.best_record, "CRF-CSEC-033");
  assert.ok(r.score >= 0.8, `record-3 grounding should score high, got ${r.score}`);
  assert.equal(r.pass, true);
});

test("29. valid-control regression: goodBenchAsset still scores high with no invention", () => {
  const fx = loadBenchFixture();
  const out = goodBenchAsset(fx);
  const r = scoreCustomerTruth(fx, [out.headline, out.body, out.situation, out.mechanism, out.cta, out.evidence_note].join("\n"));
  assert.ok(r.score >= 0.8, `control must remain grounded, got ${r.score}`);
  assert.equal(r.pass, true);
  assert.equal(r.invention_flags.length, 0);
});

test("30. Customer Truth score is graded (more grounding scores strictly higher)", () => {
  const fx = loadBenchFixture();
  const thin = scoreCustomerTruth(fx, "At 3 AM the baby is asleep and she has to stand up.");
  const rich = scoreCustomerTruth(fx, faithfulR1);
  assert.ok(rich.score > thin.score, `graded: rich ${rich.score} must exceed thin ${thin.score}`);
  assert.ok(thin.score > 0 && thin.score < 1, "thin grounding should be partial, not 0");
  assert.equal(typeof CUSTOMER_ANCHOR_TARGET, "number");
});

// ---------- Correction 2: structured-output contract ----------
test("31. json_schema request construction is correct", async () => {
  const calls = [];
  const schema = { type: "object", properties: { a: { type: "string" } }, required: ["a"], additionalProperties: false };
  const fetchImpl = async (url, opts) => { calls.push(JSON.parse(opts.body)); return { ok: true, status: 200, json: async () => ({ model: "m", choices: [{ message: { content: JSON.stringify({ a: "x" }) } }] }) }; };
  const r = await chatCompletion({ messages: [], model: "m", jsonSchema: schema, schemaName: "bench_asset", env: { OPENAI_API_KEY: "testkey-x" }, fetchImpl });
  assert.equal(calls[0].response_format.type, "json_schema");
  assert.equal(calls[0].response_format.json_schema.name, "bench_asset");
  assert.equal(calls[0].response_format.json_schema.strict, true);
  assert.deepEqual(calls[0].response_format.json_schema.schema, schema);
  assert.equal(r.structured_output_mode, "json_schema");
  assert.equal(r.schema_enforcement_requested, true);
});

test("32. legacy json_object behavior is preserved", async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push(JSON.parse(opts.body)); return { ok: true, status: 200, json: async () => ({ model: "m", choices: [{ message: { content: JSON.stringify({ a: 1 }) } }] }) }; };
  const r = await chatCompletion({ messages: [], model: "m", jsonMode: true, env: { OPENAI_API_KEY: "testkey-x" }, fetchImpl });
  assert.equal(calls[0].response_format.type, "json_object");
  assert.equal(r.structured_output_mode, "json_object");
  assert.equal(r.schema_enforcement_requested, false);
});

test("33. provider rejection of json_schema remains explicit and attributable", async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push(JSON.parse(opts.body)); return { ok: false, status: 400, json: async () => ({ error: { message: "response_format not supported" } }) }; };
  const r = await chatCompletion({ messages: [], model: "m", jsonSchema: { type: "object" }, schemaName: "bench_asset", env: { OPENAI_API_KEY: "testkey-x" }, fetchImpl });
  assert.equal(r.ok, false);
  assert.equal(r.status, "PROVIDER_ATTEMPT_FAILED");
  assert.equal(r.http_status, 400);
  assert.equal(r.structured_output_mode, "json_schema");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].response_format.type, "json_schema");
});

test("34. no silent downgrade: repeated attempts keep json_schema", async () => {
  const fx = loadBenchFixture();
  const task = buildGenerationTask(fx);
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push(JSON.parse(opts.body)); return { ok: false, status: 400, json: async () => ({}) }; };
  const g = await runGenerator("model-a", { task, fixture: fx, env: { OPENAI_API_KEY: "testkey-x" }, fetchImpl, structuredMode: "json_schema", retries: 2 });
  assert.equal(calls.length, 3, "retries must not switch modes");
  assert.ok(calls.every((c) => c.response_format.type === "json_schema"));
  assert.equal(g.provider_status, "PROVIDER_ATTEMPT_FAILED");
  assert.equal(g.requested_structured_output_mode, "json_schema");
  assert.equal(g.structured_output_provider_response, "rejected");
});

test("35. local AJV remains authoritative over provider-side mode", async () => {
  const fx = loadBenchFixture();
  const task = buildGenerationTask(fx);
  const env = { OPENAI_API_KEY: "testkey-x" };
  // schema-valid but content-poor
  const poor = { angle_id: fx.angle.id, platform: "whatsapp", headline: "ok", body: "ok", cta: "Reply YES", mechanism: "generic", situation: "generic", evidence_note: "generic", risk_flags: [] };
  const gp = await runGenerator("model-a", { task, fixture: fx, env, structuredMode: "json_schema", fetchImpl: genFetch(poor) });
  assert.equal(gp.schema_valid, true);
  assert.equal(gp.structural_reliability, "PASS");
  assert.ok(gp.content_quality_score < 0.9, "provider-side mode must not boost content quality");
  // high-quality but schema-invalid
  const bad = { ...goodBenchAsset(fx), risk_flags: "none" };
  const gb = await runGenerator("model-a", { task, fixture: fx, env, structuredMode: "json_schema", fetchImpl: genFetch(bad) });
  assert.equal(gb.parse_ok, true);
  assert.equal(gb.schema_valid, false);
  assert.equal(gb.structural_reliability, "FAIL");
  assert.equal(gb.recommendation_eligible, false);
  assert.ok(gb.schema_errors.length >= 1);
});

test("36. schema-invalid candidate remains recommendation-ineligible (runGenerator + compare)", () => {
  const fx = loadBenchFixture();
  const invalid = { provider: "p", model: "invalid", parse_ok: true, schema_valid: false, structural_reliability: "FAIL", content_quality_score: 0.95, usable_without_rewrite: false, blocking: ["structural_reliability"], latency_ms: 10, provider_status: "PROVIDER_SUCCESS", model_identity: "OK" };
  const valid = { provider: "p", model: "valid", parse_ok: true, schema_valid: true, structural_reliability: "PASS", content_quality_score: 0.5, usable_without_rewrite: true, blocking: [], latency_ms: 20, provider_status: "PROVIDER_SUCCESS", model_identity: "OK" };
  const cmp = compare([invalid, valid], []);
  assert.equal(cmp.recommended_generator, "valid");
  assert.ok(cmp.recommendation_blocked.some((b) => b.model === "invalid"));
});

test("37. credentials are never exposed in structured-output failures", async () => {
  const fx = loadBenchFixture();
  const task = buildGenerationTask(fx);
  const key = "testkey-SECRETSTRUCT-123456";
  const g = await runGenerator("model-a", { task, fixture: fx, env: { OPENAI_API_KEY: key }, structuredMode: "json_schema", fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({}) }) });
  assert.equal(JSON.stringify(g).includes(key), false);
});

test("38. backward compatibility: no structured mode requested when neither is set", async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push(JSON.parse(opts.body)); return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "hi" } }] }) }; };
  const r = await chatCompletion({ messages: [], model: "m", env: { OPENAI_API_KEY: "testkey-x" }, fetchImpl });
  assert.equal(calls[0].response_format, undefined);
  assert.equal(r.structured_output_mode, "none");
  assert.equal(r.schema_enforcement_requested, false);
});

// ---------- Critic eligibility + failure metrics ----------
import { criticEligibility, CRITIC_ELIGIBILITY } from "./text-provider-bench.mjs";

const eligibleCritic = (over = {}) => ({
  provider: "p", model: "c", model_identity: "OK",
  provider_reliability: 1, schema_reliability: 1, precision: 1, recall: 1, f1: 1, severity_accuracy: 1,
  false_positives: 0, false_negatives: 0, avg_latency_ms: 100, case_failure_rate: 0,
  cases: Array.from({ length: 9 }, () => ({ provider_status: "PROVIDER_SUCCESS" })),
  ...over,
});
const eligibleGen = (over = {}) => ({
  provider: "p", model: "g", model_identity: "OK",
  parse_ok: true, schema_valid: true, structural_reliability: "PASS", structural_reliability_score: 1,
  content_quality_score: 0.9, usable_without_rewrite: true, blocking: [], latency_ms: 100,
  provider_status: "PROVIDER_SUCCESS", provider_reliability: 1,
  ...over,
});
function blockedReasons(critic) {
  const cmp = compare([eligibleGen({ model: "g1" })], [critic]);
  return { cmp, reasons: (cmp.critic_recommendation_blocked || []).flatMap((b) => b.reasons) };
}

test("39. strong eligible critic is recommended", () => {
  const cmp = compare([eligibleGen({ model: "g1" })], [eligibleCritic({ model: "c1" })]);
  assert.equal(cmp.recommended_critic, "c1");
  assert.equal(cmp.top_ranked_critic, "c1");
  assert.equal(cmp.critic_recommendation_blocked.length, 0);
});

test("40. highest-ranked but below-threshold critic is NOT recommended", () => {
  const high = eligibleCritic({ model: "c-high", f1: 0.95, recall: 0.5 });
  const good = eligibleCritic({ model: "c-good", f1: 0.85 });
  const cmp = compare([eligibleGen({ model: "g1" })], [high, good]);
  assert.equal(cmp.top_ranked_critic, "c-high");
  assert.equal(cmp.recommended_critic, "c-good");
});

test("41. no eligible critic => recommended_critic null (Nemotron-shaped case)", () => {
  const nemotronLike = eligibleCritic({ model: "nemotron", provider_reliability: 0.7777777778, schema_reliability: 0.7777777778, precision: 1, recall: 0.5, f1: 0.667, severity_accuracy: 0.5 });
  const cmp = compare([eligibleGen({ model: "g1" })], [nemotronLike]);
  assert.equal(cmp.top_ranked_critic, "nemotron");
  assert.equal(cmp.recommended_critic, null);
  assert.equal(cmp.secondary_critic, null);
  assert.equal(cmp.critic_recommendation_blocked.length, 1);
});

test("42. secondary critic selected only from eligible critics", () => {
  const a = eligibleCritic({ model: "c-a", f1: 0.95, recall: 0.5 });
  const b = eligibleCritic({ model: "c-b", f1: 0.9 });
  const c = eligibleCritic({ model: "c-c", f1: 0.85 });
  const cmp = compare([eligibleGen({ model: "g1" })], [a, b, c]);
  assert.equal(cmp.recommended_critic, "c-b");
  assert.equal(cmp.secondary_critic, "c-c");
});

test("43. missing eligibility metric is blocked with an explicit reason", () => {
  const m = eligibleCritic({ model: "c-m" });
  delete m.severity_accuracy;
  const { cmp, reasons } = blockedReasons(m);
  assert.equal(cmp.recommended_critic, null);
  assert.ok(reasons.some((r) => /missing severity_accuracy/.test(r)), JSON.stringify(reasons));
});

test("44. provider_reliability below 1 is blocked", () => { assert.ok(blockedReasons(eligibleCritic({ provider_reliability: 0.9 })).reasons.some((r) => /provider_reliability/.test(r))); });
test("45. schema_reliability below 1 is blocked", () => { assert.ok(blockedReasons(eligibleCritic({ schema_reliability: 0.9 })).reasons.some((r) => /schema_reliability/.test(r))); });
test("46. precision below 1 is blocked", () => { assert.ok(blockedReasons(eligibleCritic({ precision: 0.99 })).reasons.some((r) => /precision/.test(r))); });
test("47. recall below 0.8 is blocked", () => { assert.ok(blockedReasons(eligibleCritic({ recall: 0.79 })).reasons.some((r) => /recall/.test(r))); });
test("48. F1 below 0.8 is blocked", () => { assert.ok(blockedReasons(eligibleCritic({ f1: 0.79 })).reasons.some((r) => /f1/.test(r))); });
test("49. severity accuracy below 0.8 is blocked", () => { assert.ok(blockedReasons(eligibleCritic({ severity_accuracy: 0.79 })).reasons.some((r) => /severity_accuracy/.test(r))); });

test("50. MODEL_ID_MISMATCH is blocked", () => {
  const { cmp, reasons } = blockedReasons(eligibleCritic({ model: "c-mm", model_identity: "MODEL_ID_MISMATCH" }));
  assert.equal(cmp.recommended_critic, null);
  assert.ok(reasons.some((r) => /MODEL_ID_MISMATCH/.test(r)));
});

test("51. self-judge conflict is a recommendation blocker (still appears in ranking)", () => {
  const cmp = compare([eligibleGen({ model: "g1" })], [eligibleCritic({ model: "g1" })]);
  assert.equal(cmp.recommended_critic, null);
  assert.ok((cmp.critic_recommendation_blocked || []).some((b) => b.reasons.some((r) => /self-judge/.test(r))));
  assert.ok((cmp.critic_ranking || []).some((c) => c.model === "g1"));
});

test("52. ineligible critic still appears in comparative ranking", () => {
  const cmp = compare([eligibleGen({ model: "g1" })], [eligibleCritic({ model: "c1", recall: 0.5 })]);
  const row = (cmp.critic_ranking || []).find((c) => c.model === "c1");
  assert.ok(row);
  assert.equal(row.eligible, false);
  assert.ok(row.eligibility_reasons.some((r) => /recall/.test(r)));
});

test("53. case_failure_rate is the case-level fraction (2/9)", async () => {
  const fx = loadBenchFixture();
  let n = 0;
  const fetchImpl = async () => {
    n++;
    if (n === 3 || n === 7) throw new Error("boom");
    return { ok: true, status: 200, json: async () => ({ model: "c", choices: [{ message: { content: JSON.stringify({ findings: [] }) } }] }) };
  };
  const c = await runCritic("critic-x", { cases: buildCriticCases(fx), env: { OPENAI_API_KEY: "testkey-x" }, fetchImpl });
  assert.equal(c.cases_total, 9);
  assert.equal(c.cases_failed, 2);
  assert.ok(Math.abs(c.case_failure_rate - 2 / 9) < 1e-9);
});

test("54. candidate-with-any-failure counts candidates with >=1 failed case", () => {
  const ok = eligibleCritic({ model: "c-ok" });
  const flaky = eligibleCritic({ model: "c-flaky", cases: Array.from({ length: 9 }, (_, i) => ({ provider_status: i < 2 ? "PROVIDER_ATTEMPT_FAILED" : "PROVIDER_SUCCESS" })) });
  const cmp = compare([eligibleGen({ model: "g1" })], [ok, flaky]);
  assert.equal(cmp.failure_metrics.critics.candidates_total, 2);
  assert.equal(cmp.failure_metrics.critics.candidates_with_any_failure, 1);
  assert.equal(cmp.failure_metrics.critics.candidates_with_any_failure_rate, 0.5);
});

test("55. aggregate critic case failure rate is weighted by cases (3/13)", () => {
  const a = eligibleCritic({ model: "c-a", cases: Array.from({ length: 9 }, (_, i) => ({ provider_status: i < 2 ? "PROVIDER_ATTEMPT_FAILED" : "PROVIDER_SUCCESS" })) });
  const b = eligibleCritic({ model: "c-b", cases: Array.from({ length: 4 }, (_, i) => ({ provider_status: i < 1 ? "PROVIDER_ATTEMPT_FAILED" : "PROVIDER_SUCCESS" })) });
  const cmp = compare([eligibleGen({ model: "g1" })], [a, b]);
  assert.equal(cmp.failure_metrics.critics.cases_attempted, 13);
  assert.equal(cmp.failure_metrics.critics.cases_failed, 3);
  assert.ok(Math.abs(cmp.failure_metrics.critics.case_failure_rate - 3 / 13) < 1e-9);
});

test("56. generator aggregate uses explicit candidate/case semantics", () => {
  const g1 = eligibleGen({ model: "g1" });
  const g2 = eligibleGen({ model: "g2", provider_status: "PROVIDER_ATTEMPT_FAILED", provider_reliability: 0, parse_ok: false, schema_valid: false, structural_reliability: "FAIL" });
  const cmp = compare([g1, g2], []);
  assert.equal(cmp.failure_metrics.generators.candidates_total, 2);
  assert.equal(cmp.failure_metrics.generators.candidates_with_any_failure, 1);
  assert.equal(cmp.failure_metrics.generators.candidates_with_any_failure_rate, 0.5);
  assert.equal(cmp.failure_metrics.generators.case_failure_rate, 0.5);
  assert.equal(cmp.failure_metrics.generators.provider_reliability_mean, 0.5);
});

test("57. Markdown distinguishes TOP-RANKED vs RECOMMENDED and shows blocked reasons", async () => {
  const fx = loadBenchFixture();
  const fetchImpl = async (url, opts) => {
    const body = JSON.parse(opts.body);
    const sys = body.messages?.[0]?.content || "";
    if (/Writing Critic/.test(sys)) throw new Error("critic down");
    return { ok: true, status: 200, json: async () => ({ model: "m", choices: [{ message: { content: JSON.stringify(goodBenchAsset(fx)) } }] }) };
  };
  const result = await runBenchmark({ generators: ["model-a"], critics: ["critic-x"], env: { OPENAI_API_KEY: "testkey-x" }, fetchImpl });
  assert.equal(result.comparison.recommended_critic, null);
  assert.equal(result.comparison.top_ranked_critic, "critic-x");
  const md = renderMarkdown(result);
  assert.match(md, /## TOP-RANKED CRITIC/);
  assert.match(md, /None — qualification requirements not met\./);
  assert.match(md, /## CRITIC RECOMMENDATION BLOCKED/);
  assert.doesNotMatch(md, /## RECOMMENDED CRITIC\n\*\*critic-x\*\*/);
});

test("58. backward compatibility: ambiguous failure_rate removed; explicit metrics present", async () => {
  const fx = loadBenchFixture();
  const cmp = compare([eligibleGen({ model: "g1" })], [eligibleCritic({ model: "c1" })]);
  assert.equal(cmp.failure_rate, undefined);
  assert.ok(cmp.failure_metrics && cmp.failure_metrics.critics && cmp.failure_metrics.generators);
  const c = await runCritic("critic-x", { cases: buildCriticCases(fx), env: { OPENAI_API_KEY: "testkey-x" }, fetchImpl: combinedFetch(goodBenchAsset(fx)) });
  assert.equal(typeof c.case_failure_rate, "number");
  assert.equal(c.failure_rate, undefined);
  assert.equal(typeof CRITIC_ELIGIBILITY.recall, "number");
  assert.equal(typeof criticEligibility(eligibleCritic()).eligible, "boolean");
});

// ---------- Task-hash determinism (task identity, not execution identity) ----------
import { canonicalTaskHashInput, benchmarkTaskHash } from "./text-provider-bench.mjs";

const mutateUser = (task, fn) => { const u = JSON.parse(task.user); fn(u); return { ...task, user: JSON.stringify(u) }; };
const HEX64 = /^[0-9a-f]{64}$/;

test("59. same task at different wall-clock times => identical task_hash", async () => {
  const t1 = buildGenerationTask(loadBenchFixture());
  await new Promise((r) => setTimeout(r, 5));
  const t2 = buildGenerationTask(loadBenchFixture());
  assert.equal(benchmarkTaskHash(t1), benchmarkTaskHash(t2));
});

test("60. volatile angle lifecycle timestamps do not change the hash (and are not mutated)", () => {
  const t = buildGenerationTask(loadBenchFixture());
  const before = JSON.parse(t.user).angle.created_at;
  const base = benchmarkTaskHash(t);
  const modified = mutateUser(t, (u) => {
    u.angle.created_at = "2099-01-01T00:00:00Z";
    u.angle.updated_at = "2099-01-01T00:00:00Z";
    u.angle.state_history = [{ at: "2099-01-01T00:00:00Z" }];
  });
  assert.equal(benchmarkTaskHash(modified), base);
  assert.equal(JSON.parse(t.user).angle.created_at, before, "the runtime task.user angle must not be mutated");
});

test("61. substantive Product Truth change changes the hash", () => {
  const t = buildGenerationTask(loadBenchFixture());
  const modified = mutateUser(t, (u) => { u.product_truth.promise = u.product_truth.promise + " CHANGED"; });
  assert.notEqual(benchmarkTaskHash(modified), benchmarkTaskHash(t));
});

test("62. substantive Customer Truth change changes the hash", () => {
  const t = buildGenerationTask(loadBenchFixture());
  const modified = mutateUser(t, (u) => { u.customer_truth[0].exact_language = u.customer_truth[0].exact_language + " CHANGED"; });
  assert.notEqual(benchmarkTaskHash(modified), benchmarkTaskHash(t));
});

test("63. substantive Angle change changes the hash", () => {
  const t = buildGenerationTask(loadBenchFixture());
  const modified = mutateUser(t, (u) => { u.angle.tier2.angle = u.angle.tier2.angle + " CHANGED"; });
  assert.notEqual(benchmarkTaskHash(modified), benchmarkTaskHash(t));
});

test("64. output schema change changes the hash", () => {
  const t = buildGenerationTask(loadBenchFixture());
  const modified = { ...t, schema: { ...t.schema, required: [...t.schema.required, "extra_field"] } };
  assert.notEqual(benchmarkTaskHash(modified), benchmarkTaskHash(t));
});

test("65. system prompt change changes the hash", () => {
  const t = buildGenerationTask(loadBenchFixture());
  const modified = { ...t, system: t.system + " CHANGED" };
  assert.notEqual(benchmarkTaskHash(modified), benchmarkTaskHash(t));
});

test("66. model/provider metadata is not part of the task hash", () => {
  const t = buildGenerationTask(loadBenchFixture());
  const base = benchmarkTaskHash(t);
  const withMeta = { ...t, provider: "nvidia", model: "some/model-id", candidateModel: "some/model-id", critic: "x" };
  assert.equal(benchmarkTaskHash(withMeta), base);
});

test("67. task hash format is SHA-256 (64 lowercase hex)", () => {
  const h = benchmarkTaskHash(buildGenerationTask(loadBenchFixture()));
  assert.equal(h.length, 64);
  assert.match(h, HEX64);
  assert.equal(typeof canonicalTaskHashInput(buildGenerationTask(loadBenchFixture())), "string");
});
