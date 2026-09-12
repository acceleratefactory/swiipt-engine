#!/usr/bin/env node
// Swiipt · TEXT PROVIDER BENCHMARK HARNESS
//
// Compares multiple generator and critic models against the SAME Swiipt-controlled synthetic inputs,
// using the existing OpenAI-compatible provider client (lib/provider-client.mjs). It measures
// Swiipt-specific suitability (truth adherence, anti-slop, interchangeability, mechanism fidelity,
// instruction following, structured-output reliability) — not generic AI quality.
//
// Provider evaluation only: it never sets production env vars, never falls back to another model,
// never writes API keys, and recommends (does not activate) a generator + critic.
//
// Usage:
//   node bench/text-provider-bench.mjs --generators "modelA,modelB" --critics "criticA,criticB" [options]
//   node bench/text-provider-bench.mjs --candidates bench/candidates.json [options]
//
// Options: --retries N  --timeout MS  --base-url URL  --out FILE  --report FILE  --no-judge
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import Ajv from "ajv/dist/2020.js";
import { chatCompletion, normalizeBaseUrl, chatEndpoint, STATUS } from "../lib/provider-client.mjs";
import { analyzeProse } from "../harness/writing-checks.mjs";
import { anchorCount } from "../mae/services/qa.js";
import { loadBenchFixture, buildGenerationTask, buildCriticCases, goodBenchAsset, BENCH_ASSET_SCHEMA, REQUIRED_FIELDS } from "./fixtures.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lc = (s) => String(s == null ? "" : s).toLowerCase();
const uniq = (a) => [...new Set(a.filter(Boolean))];
const containsAny = (text, list) => uniq((list || []).map((x) => lc(x))).filter((x) => x && text.includes(x));
const words = (s) => String(s || "").trim().split(/\s+/).filter(Boolean);

const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addSchema(BENCH_ASSET_SCHEMA);
const ASSET_SCHEMA_ID = BENCH_ASSET_SCHEMA.$id;

const OVERCLAIM = /\b(guarantee[sd]?|cure[sd]?|heal(?:s|ed)? in \d+ (days?|weeks?)|instantly|100%|permanently|never feel pain again|proven|study (?:of|shows?|proves?)|clinically proven)\b/i;
const ABSOLUTE_ABSENCE = /\bnobody else\b|\bno one else\b|\bthe only\b/i;
const EMOTION_LEX = ["scared", "terrified", "devastated", "hopeless", "panic", "trauma", "traumatised", "traumatized", "broken", "worthless", "ashamed", "humiliated", "desperate"];

const CRITIC_SYSTEM = "You are the Swiipt Writing Critic. Evaluate the CONTENT against the APPROVED CONTRACT and return JSON {\"findings\":[{\"status\":one of PASS|FAIL|WARNING|MISSING|UNSUPPORTED|SCOPE_DRIFT|TRANSFORMATION_WEAKNESS|WRITING_QUALITY_ISSUE|SAFETY_ISSUE,\"severity\":one of BLOCKER|WARNING|none,\"detail\":string,\"where\":string}]}. Fail only on NEVER/SCOPE_DRIFT/UNSUPPORTED/SAFETY_ISSUE. Never invent facts.";

function collectText(output) {
  if (output == null) return "";
  if (typeof output === "string") return output;
  if (typeof output !== "object") return String(output);
  const parts = [];
  for (const v of Object.values(output)) {
    if (typeof v === "string") parts.push(v);
    else if (Array.isArray(v)) parts.push(v.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
  }
  return parts.join("\n");
}

function truthCorpus(fx) {
  return [
    JSON.stringify(fx.product_truth), JSON.stringify(fx.customer_truth), JSON.stringify(fx.market_truth),
    JSON.stringify(fx.brand_truth), JSON.stringify(fx.angle), JSON.stringify(fx.writing_constitution),
  ].join("\n");
}

/**
 * Deterministic Swiipt-suitability evaluation (dimensions A–P). Judgment is NOT done here.
 * @returns {{dimensions:Array,deterministic_score:number,usable_without_rewrite:boolean,blocking:string[]}}
 */
export function evaluateGeneratorOutput(fx, output, { parseOk = true, schemaValid = true } = {}) {
  const text = lc(collectText(output));
  const ptr = fx.product_truth;
  const crf = fx.axes || fx.customer_truth[0];
  const brand = fx.brand_truth;
  const wc = fx.writing_constitution;
  const truth = lc(truthCorpus(fx));
  const dims = [];
  const add = (key, label, score, pass, detail, method = "deterministic") => dims.push({ key, label, method, score: Number(score.toFixed(3)), pass: !!pass, detail });

  if (!parseOk || !schemaValid) {
    for (const [k, l] of [["product_truth_adherence", "Product Truth adherence"], ["customer_truth_adherence", "Customer Truth adherence"], ["market_truth_adherence", "Market Truth adherence"], ["brand_truth_adherence", "Brand Truth adherence"], ["writing_constitution_compliance", "Writing Constitution compliance"], ["anti_slop_compliance", "Anti-Slop compliance"], ["interchangeability", "Interchangeability"], ["hallucination_incidence", "No unsupported claims / hallucination"], ["transformation_specificity", "Transformation specificity"], ["mechanism_fidelity", "Mechanism fidelity"], ["instruction_following", "Instruction following"], ["required_field_completeness", "Required-field completeness"], ["cultural_context_integrity", "Cultural / context integrity"], ["emotional_invention", "No unnecessary emotional invention"]]) add(k, l, 0, false, "output not structurally valid — not evaluated");
    return { dimensions: dims, deterministic_score: 0, usable_without_rewrite: false, blocking: ["structural_invalid"] };
  }

  // A — Product Truth adherence (prohibited claims / overclaim absent; mechanism referenced)
  const prohibited = containsAny(text, ptr.prohibited_claims);
  const over = text.match(OVERCLAIM);
  add("product_truth_adherence", "Product Truth adherence", (prohibited.length || over) ? 0 : 1, !(prohibited.length || over), prohibited.length ? `prohibited claim: ${prohibited.join("; ")}` : (over ? `overclaim: ${over[0]}` : "no prohibited/overclaim language"));

  // B — Customer Truth adherence (uses real customer language)
  const langTokens = uniq([...words(crf.exact_language).slice(0, 4), ...words(crf.situation).slice(0, 3)]).map(lc);
  const langHits = langTokens.filter((t) => t.length >= 4 && text.includes(t));
  add("customer_truth_adherence", "Customer Truth adherence", langHits.length ? 1 : 0, langHits.length >= 1, `customer-language tokens matched: ${langHits.length}`);

  // C — Market Truth adherence (absence claims hedged)
  const abs = text.match(ABSOLUTE_ABSENCE);
  const marketOk = !abs || fx.market_truth.some((m) => m.category === "unclaimed_angle" && /complete|exhaustive/i.test(m.scan_coverage_note || ""));
  add("market_truth_adherence", "Market Truth adherence", marketOk ? 1 : 0, marketOk, abs ? `absolute absence claim without coverage: ${abs[0]}` : "no unhedged absence claim");

  // D — Brand Truth adherence (banned vocabulary / boundaries / prohibited behaviours)
  const brandHits = uniq([...containsAny(text, brand.vocabulary?.banned || []), ...containsAny(text, brand.prohibited_behaviours || []), ...containsAny(text, wc.forbidden_phrases || [])]);
  add("brand_truth_adherence", "Brand Truth adherence", brandHits.length ? 0 : 1, !brandHits.length, brandHits.length ? `banned brand language: ${brandHits.join("; ")}` : "brand vocabulary/boundaries respected");

  // E — Writing Constitution compliance
  const constHits = uniq([...containsAny(text, wc.forbidden_phrases || []), ...containsAny(text, wc.forbidden_behaviours || [])]);
  add("writing_constitution_compliance", "Writing Constitution compliance", constHits.length ? 0 : 1, !constHits.length, constHits.length ? `constitution violation: ${constHits.join("; ")}` : "constitution respected");

  // F — Anti-Slop compliance (deterministic analyzeProse; BLOCKER = fail)
  let slopBlockers = [];
  try { slopBlockers = analyzeProse(collectText(output), "bench").filter((f) => f.severity === "BLOCKER"); } catch { /* ignore */ }
  add("anti_slop_compliance", "Anti-Slop compliance", slopBlockers.length ? 0 : 1, !slopBlockers.length, slopBlockers.length ? `anti-slop: ${slopBlockers.map((f) => f.code).join(", ")}` : "no anti-slop blockers");

  // G — Interchangeability (load-bearing specifics present)
  let anchors = 0;
  try { anchors = anchorCount(collectText(output), fx.angle, null); } catch { anchors = 0; }
  add("interchangeability", "Interchangeability", Math.min(1, anchors / 3), anchors >= 3, `load-bearing anchors: ${anchors} (need >=3)`);

  // H — Hallucination / unsupported claims (ungrounded numbers or claim words)
  const groundedNums = new Set((truth.match(/\b\d[\d,.]*\b/g) || []));
  const outNums = uniq((text.match(/\b\d[\d,.]*\b/g) || []));
  const ungrounded = outNums.filter((n) => !groundedNums.has(n));
  const hal = [...ungrounded, ...(over ? [over[0]] : [])];
  add("hallucination_incidence", "No unsupported claims / hallucination", hal.length ? 0 : 1, !hal.length, hal.length ? `ungrounded: ${hal.join(", ")}` : "all facts traceable to provided truth");

  // I — Transformation specificity (desired change / situation language)
  const dcTokens = words(fx.angle.tier2.desired_change).map(lc).filter((w) => w.length >= 4);
  const dcHits = dcTokens.filter((t) => text.includes(t));
  add("transformation_specificity", "Transformation specificity", Math.min(1, dcHits.length / 3), dcHits.length >= 1, `desired-change tokens matched: ${dcHits.length}`);

  // J — Mechanism fidelity
  const mech = lc(fx.angle.tier2.mechanism.text);
  const mechTokens = uniq([...mech.match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) || []]).filter((t) => t.length >= 5 && !["position", "technique"].includes(t));
  const mechHits = mechTokens.filter((t) => text.includes(t));
  const mechNamed = text.includes("3-position") || text.includes("position and rise") || mechHits.length >= 3;
  add("mechanism_fidelity", "Mechanism fidelity", mechNamed ? 1 : 0, mechNamed, mechNamed ? "approved mechanism referenced" : "approved mechanism missing/wrong");

  // K — Instruction following
  const isPopulated = (v) => v !== undefined && v !== null && (Array.isArray(v) || typeof v === "object" || String(v).trim().length > 0);
  const fieldsPresent = REQUIRED_FIELDS.filter((k) => isPopulated(output[k])).length / REQUIRED_FIELDS.length;
  const bodyWords = words(output.body).length;
  const lenOk = bodyWords > 0 && bodyWords <= 120;
  const noFences = !/```/.test(collectText(output));
  const noHash = !/#\w/.test(collectText(output));
  const ctaOk = !/click (the link|here)/i.test(String(output.cta || ""));
  const instrScore = [fieldsPresent >= 0.99, lenOk, noFences, noHash, ctaOk].filter(Boolean).length / 5;
  add("instruction_following", "Instruction following", instrScore, instrScore >= 0.8, `fields ${(fieldsPresent * 100).toFixed(0)}% · body ${bodyWords}w · fences:${!noFences} · hashtags:${!noHash} · cta:${ctaOk}`);

  // L — Required-field completeness
  add("required_field_completeness", "Required-field completeness", fieldsPresent, fieldsPresent >= 0.99, `${Math.round(fieldsPresent * REQUIRED_FIELDS.length)}/${REQUIRED_FIELDS.length} required fields populated`);

  // N — Cultural / context integrity
  const ctxTokens = ["3 am", "day 6", "incision", "night", "dresser"];
  const ctxHits = ctxTokens.filter((t) => text.includes(t));
  add("cultural_context_integrity", "Cultural / context integrity", ctxHits.length >= 1 ? 1 : 0, ctxHits.length >= 1, `context tokens present: ${ctxHits.join(", ") || "none"}`);

  // O — Unnecessary emotional invention
  const srcEmotion = new Set(EMOTION_LEX.filter((w) => lc(JSON.stringify([crf.fear, crf.emotional_stake, crf.thought, crf.exact_language])).includes(w)));
  const invented = EMOTION_LEX.filter((w) => text.includes(w) && !srcEmotion.has(w));
  add("emotional_invention", "No unnecessary emotional invention", invented.length <= 1 ? 1 : 0, invented.length <= 1, invented.length ? `invented emotional language: ${invented.join(", ")}` : "emotional language stays within source");

  const deterministic_score = dims.reduce((s, d) => s + d.score, 0) / dims.length;
  const byKey = Object.fromEntries(dims.map((d) => [d.key, d]));
  const blocking = dims.filter((d) => !d.pass && ["product_truth_adherence", "brand_truth_adherence", "writing_constitution_compliance", "anti_slop_compliance", "hallucination_incidence", "mechanism_fidelity", "required_field_completeness"].includes(d.key)).map((d) => d.key);
  const usable = blocking.length === 0 && byKey.interchangeability.score >= 0.66 && byKey.transformation_specificity.pass;
  return { dimensions: dims, deterministic_score, usable_without_rewrite: usable, blocking };
}

async function callWithRetries({ worker, model, messages, jsonMode = true, env, fetchImpl, retries = 0, timeoutMs }) {
  let attempts = 0;
  let res = null;
  for (let i = 0; i <= retries; i++) {
    attempts++;
    res = await chatCompletion({ worker, model, messages, jsonMode, env, fetchImpl, timeoutMs });
    if (res.ok) break;
    if (i < retries) continue;
  }
  return { res, retries_used: attempts - 1, attempts };
}

/** Run one generator candidate against the fixed task. */
export async function runGenerator(model, { task, fixture, env, fetchImpl = null, retries = 0, timeoutMs, judge = null } = {}) {
  const t0 = Date.now();
  const { res, retries_used } = await callWithRetries({
    worker: "copywriter", model, env, fetchImpl, retries, timeoutMs,
    messages: [{ role: "system", content: task.system }, { role: "user", content: task.user }],
  });
  const latency_ms = Date.now() - t0;
  const parse_ok = !!(res.ok && res.json && typeof res.json === "object" && !Array.isArray(res.json));
  let schema_valid = false;
  if (parse_ok) { try { schema_valid = ajv.validate(ASSET_SCHEMA_ID, res.json); } catch { schema_valid = false; } }
  const evaluation = evaluateGeneratorOutput(fixture, res.json, { parseOk: parse_ok, schemaValid: schema_valid });

  let judgment = { status: "NOT_RUN", reason: "no independent critic supplied", model: null };
  if (judge && judge.model && judge.model !== model) {
    const j = await callWithRetries({
      worker: "writing-critic", model: judge.model, env, fetchImpl: judge.fetchImpl || fetchImpl, retries, timeoutMs,
      messages: [{ role: "system", content: CRITIC_SYSTEM }, { role: "user", content: JSON.stringify({ asset: res.json, context: { product_truth: fixture.product_truth, customer_truth: fixture.customer_truth, angle: fixture.angle, required_fields: REQUIRED_FIELDS } }).slice(0, 120000) }],
    });
    const findings = Array.isArray(j.res.json?.findings) ? j.res.json.findings : [];
    judgment = { status: j.res.ok ? "RAN" : "NOT_RUN", model: judge.model, provider_status: j.res.status, verdict: findings.some((f) => f.severity === "BLOCKER") ? "FAIL" : (findings.length ? "WARNING" : "PASS"), findings_count: findings.length };
  } else if (judge && judge.model === model) {
    judgment = { status: "NOT_RUN", reason: "self-judging excluded from official comparison", model: null };
  }

  return {
    model,
    provider: "openai-compatible",
    requested_provider: "openai-compatible",
    timestamp: new Date(t0).toISOString(),
    latency_ms,
    provider_status: res.status,
    http_status: res.http_status ?? null,
    endpoint_host: res.endpoint_host ?? null,
    parse_ok,
    schema_valid,
    retries: retries_used,
    usage: res.usage ?? null,
    generation_status: res.status,
    actual_generator: res.ok ? "provider" : "none (no silent substitution)",
    error: res.error ?? null,
    output: res.json ?? null,
    dimensions: evaluation.dimensions,
    deterministic_score: evaluation.deterministic_score,
    usable_without_rewrite: evaluation.usable_without_rewrite,
    blocking: evaluation.blocking,
    judgment,
  };
}

/** Run one critic candidate against the controlled defect cases. */
export async function runCritic(model, { cases, env, fetchImpl = null, retries = 0, timeoutMs } = {}) {
  const results = [];
  for (const c of cases) {
    const t0 = Date.now();
    const { res, retries_used } = await callWithRetries({
      worker: "writing-critic", model, env, fetchImpl, retries, timeoutMs,
      messages: [{ role: "system", content: CRITIC_SYSTEM }, { role: "user", content: JSON.stringify(c.payload).slice(0, 120000) }],
    });
    const latency_ms = Date.now() - t0;
    const findings = Array.isArray(res.json?.findings) ? res.json.findings : null;
    const parse_ok = !!findings;
    const detected = parse_ok && findings.some((f) => f.severity === "BLOCKER" || f.status === "FAIL" || f.status === "NEVER" || f.status === "UNSUPPORTED" || f.status === "SCOPE_DRIFT" || f.status === "SAFETY_ISSUE");
    results.push({ id: c.id, defect_type: c.defect_type, expect_defect: c.expect_defect, detected, severity: detected ? "BLOCKER" : "none", parse_ok, provider_status: res.status, latency_ms, retries: retries_used });
  }
  const defects = results.filter((r) => r.expect_defect);
  const controls = results.filter((r) => !r.expect_defect);
  const true_detections = defects.filter((r) => r.detected).length;
  const false_negatives = defects.filter((r) => !r.detected).length;
  const false_positives = controls.filter((r) => r.detected).length;
  const schema_ok = results.filter((r) => r.parse_ok).length;
  const precision = true_detections + false_positives ? true_detections / (true_detections + false_positives) : 0;
  const recall = true_detections + false_negatives ? true_detections / (true_detections + false_negatives) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return {
    model,
    cases: results,
    true_detections,
    false_positives,
    false_negatives,
    defect_count: defects.length,
    severity_accuracy: defects.length ? true_detections / defects.length : 0,
    schema_reliability: results.length ? schema_ok / results.length : 0,
    failure_rate: results.filter((r) => r.provider_status !== STATUS.PROVIDER_SUCCESS).length / (results.length || 1),
    precision, recall, f1,
    avg_latency_ms: Math.round(results.reduce((s, r) => s + r.latency_ms, 0) / (results.length || 1)),
  };
}

/** Rank and recommend. Never lets a model be its own judge. */
export function compare(genResults, criticResults) {
  const okGens = genResults.filter((g) => g.parse_ok && g.schema_valid);
  const genRank = [...okGens].sort((a, b) => (b.deterministic_score - a.deterministic_score) || (b.usable_without_rewrite - a.usable_without_rewrite) || (a.latency_ms - b.latency_ms));
  const genFailRank = genResults.filter((g) => !(g.parse_ok && g.schema_valid));
  const okCrit = criticResults.filter((c) => c.schema_reliability >= 0.5);
  const critRank = [...okCrit].sort((a, b) => (b.f1 - a.f1) || (a.false_positives - b.false_positives) || (a.avg_latency_ms - b.avg_latency_ms));

  const recommended_generator = genRank[0]?.model ?? null;
  const secondary_generator = genRank[1]?.model ?? null;
  const recommended_critic = critRank[0]?.model ?? null;
  const secondary_critic = critRank[1]?.model ?? null;
  const selfJudgeConflict = !!(recommended_generator && recommended_critic && recommended_generator === recommended_critic);

  const mean = (arr, f) => arr.length ? arr.reduce((s, x) => s + f(x), 0) / arr.length : 0;
  const dimScore = (g, k) => { const d = (g.dimensions || []).find((x) => x.key === k); return d ? d.score : 0; };
  return {
    generator_ranking: genRank.map((g) => ({ model: g.model, deterministic_score: g.deterministic_score, usable_without_rewrite: g.usable_without_rewrite, latency_ms: g.latency_ms, provider_status: g.provider_status })),
    structurally_failed_generators: genFailRank.map((g) => ({ model: g.model, provider_status: g.provider_status, parse_ok: g.parse_ok, schema_valid: g.schema_valid })),
    critic_ranking: critRank.map((c) => ({ model: c.model, f1: Number(c.f1.toFixed(3)), precision: Number(c.precision.toFixed(3)), recall: Number(c.recall.toFixed(3)), false_positives: c.false_positives, false_negatives: c.false_negatives, schema_reliability: c.schema_reliability, avg_latency_ms: c.avg_latency_ms })),
    recommended_generator, secondary_generator, recommended_critic, secondary_critic, self_judge_conflict: selfJudgeConflict,
    structured_output_reliability: { generators: genResults.map((g) => ({ model: g.model, parse_ok: g.parse_ok, schema_valid: g.schema_valid })), critics: criticResults.map((c) => ({ model: c.model, schema_reliability: c.schema_reliability })) },
    truth_adherence: { mean_product_truth: Number(mean(genResults, (g) => dimScore(g, "product_truth_adherence")).toFixed(3)), mean_customer_truth: Number(mean(genResults, (g) => dimScore(g, "customer_truth_adherence")).toFixed(3)), mean_hallucination_free: Number(mean(genResults, (g) => dimScore(g, "hallucination_incidence")).toFixed(3)) },
    writing_quality: { mean_anti_slop: Number(mean(genResults, (g) => dimScore(g, "anti_slop_compliance")).toFixed(3)), mean_constitution: Number(mean(genResults, (g) => dimScore(g, "writing_constitution_compliance")).toFixed(3)), mean_interchangeability: Number(mean(genResults, (g) => dimScore(g, "interchangeability")).toFixed(3)) },
    latency: { generators_avg_ms: Math.round(mean(genResults, (g) => g.latency_ms)), critics_avg_ms: Math.round(mean(criticResults, (c) => c.avg_latency_ms)) },
    usage_cost: { note: "Token usage is reported when the endpoint returns it; cost depends on the chosen provider's pricing.", generator_usage: genResults.map((g) => ({ model: g.model, usage: g.usage })) },
    failure_rate: { generators: genResults.length ? genResults.filter((g) => g.provider_status !== STATUS.PROVIDER_SUCCESS).length / genResults.length : 0, critics: criticResults.length ? criticResults.filter((c) => c.failure_rate > 0).length / criticResults.length : 0 },
  };
}

/** Run the full candidate matrix. */
export async function runBenchmark({ generators, critics, env = process.env, fetchImpl = null, retries = 0, timeoutMs, judge = true } = {}) {
  if (!generators?.length) throw new Error("no generator candidates supplied");
  const fixture = loadBenchFixture();
  const task = buildGenerationTask(fixture);
  const cases = buildCriticCases(fixture);
  const task_hash = createHash("sha256").update(task.system + task.user + JSON.stringify(task.schema)).digest("hex");

  const genResults = [];
  for (const model of generators) {
    const judgeModel = judge ? (critics || []).find((c) => c !== model) : null;
    genResults.push(await runGenerator(model, { task, fixture, env, fetchImpl, retries, timeoutMs, judge: judgeModel ? { model: judgeModel, fetchImpl } : null }));
  }
  const criticResults = [];
  for (const model of (critics || [])) criticResults.push(await runCritic(model, { cases, env, fetchImpl, retries, timeoutMs }));

  let base_host = null;
  try { base_host = new URL(chatEndpoint(env.OPENAI_BASE_URL, env)).host; } catch { /* ignore */ }

  return {
    meta: { tool: "swiipt-text-provider-bench", version: "1.0", generated_at: new Date().toISOString(), base_url_host: base_host, generators, critics: critics || [], retries, timeout_ms: timeoutMs || null, judge_enabled: !!judge },
    fixture: { id: fixture.id, synthetic: true },
    task_hash,
    generators: genResults,
    critics: criticResults,
    comparison: compare(genResults, criticResults),
  };
}

function renderMarkdown(result) {
  const L = [];
  L.push(`# Swiipt Text Provider Benchmark`);
  L.push("");
  L.push(`- Generated: ${result.meta.generated_at}`);
  L.push(`- Endpoint host: ${result.meta.base_url_host || "(unset)"}`);
  L.push(`- Generators: ${result.meta.generators.join(", ") || "none"}`);
  L.push(`- Critics: ${result.meta.critics.join(", ") || "none"}`);
  L.push(`- Fixture: ${result.fixture.id} (synthetic) · task ${result.task_hash.slice(0, 12)}`);
  L.push("");
  L.push(`## GENERATOR COMPARISON`);
  L.push(`| Model | Det. score | Usable w/o rewrite | Latency ms | Provider status | Actual generator |`);
  L.push(`|---|---|---|---|---|---|`);
  for (const g of result.generators) L.push(`| ${g.model} | ${g.deterministic_score.toFixed(3)} | ${g.usable_without_rewrite} | ${g.latency_ms} | ${g.provider_status} | ${g.actual_generator} |`);
  L.push("");
  L.push(`## CRITIC COMPARISON`);
  L.push(`| Model | F1 | Precision | Recall | FP | FN | Severity acc | Schema reliab. | Avg latency |`);
  L.push(`|---|---|---|---|---|---|---|---|---|`);
  for (const c of result.critics) L.push(`| ${c.model} | ${c.f1.toFixed(3)} | ${c.precision.toFixed(3)} | ${c.recall.toFixed(3)} | ${c.false_positives} | ${c.false_negatives} | ${c.severity_accuracy.toFixed(2)} | ${c.schema_reliability.toFixed(2)} | ${c.avg_latency_ms} |`);
  L.push("");
  L.push(`## STRUCTURED OUTPUT RELIABILITY`);
  for (const g of result.comparison.structured_output_reliability.generators) L.push(`- Generator ${g.model}: parse=${g.parse_ok} schema=${g.schema_valid}`);
  for (const c of result.comparison.structured_output_reliability.critics) L.push(`- Critic ${c.model}: schema reliability=${c.schema_reliability}`);
  L.push("");
  L.push(`## TRUTH-ADHERENCE RESULTS`);
  L.push(JSON.stringify(result.comparison.truth_adherence, null, 2));
  L.push("");
  L.push(`## WRITING QUALITY RESULTS`);
  L.push(JSON.stringify(result.comparison.writing_quality, null, 2));
  L.push("");
  L.push(`## LATENCY`);
  L.push(JSON.stringify(result.comparison.latency, null, 2));
  L.push("");
  L.push(`## USAGE / COST METADATA`);
  L.push(result.comparison.usage_cost.note);
  L.push("```json");
  L.push(JSON.stringify(result.comparison.usage_cost.generator_usage, null, 2));
  L.push("```");
  L.push("");
  L.push(`## FAILURE RATE`);
  L.push(JSON.stringify(result.comparison.failure_rate));
  L.push("");
  L.push(`## RECOMMENDED GENERATOR`);
  L.push(`**${result.comparison.recommended_generator || "none"}** (secondary fallback: ${result.comparison.secondary_generator || "none"})`);
  L.push("");
  L.push(`## RECOMMENDED CRITIC`);
  L.push(`**${result.comparison.recommended_critic || "none"}** (secondary fallback: ${result.comparison.secondary_critic || "none"})`);
  if (result.comparison.self_judge_conflict) L.push(`\n> ⚠️ recommended generator and critic are the same model — choose distinct models for independent review.`);
  const failed = result.comparison.structurally_failed_generators;
  if (failed.length) { L.push(""); L.push("## STRUCTURALLY FAILED GENERATORS"); for (const f of failed) L.push(`- ${f.model}: status ${f.provider_status} (parse=${f.parse_ok})`); }
  return L.join("\n") + "\n";
}

// -------------------- CLI --------------------
function parseArgs(argv) {
  const a = { retries: 0, judge: true };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--generators") a.generators = argv[++i];
    else if (k === "--critics") a.critics = argv[++i];
    else if (k === "--candidates") a.candidates = argv[++i];
    else if (k === "--retries") a.retries = parseInt(argv[++i], 10) || 0;
    else if (k === "--timeout") a.timeout = parseInt(argv[++i], 10) || undefined;
    else if (k === "--base-url") a.baseUrl = argv[++i];
    else if (k === "--out") a.out = argv[++i];
    else if (k === "--report") a.report = argv[++i];
    else if (k === "--no-judge") a.judge = false;
  }
  return a;
}
const list = (s) => (s || "").split(",").map((x) => x.trim()).filter(Boolean);

if (process.argv[1] && process.argv[1].endsWith("text-provider-bench.mjs")) {
  const args = parseArgs(process.argv.slice(2));
  let gens = list(args.generators);
  let crits = list(args.critics);
  if (args.candidates) {
    const cfg = JSON.parse(readFileSync(args.candidates, "utf8"));
    gens = cfg.generators || gens;
    crits = cfg.critics || crits;
  }
  if (!gens.length) { console.error("No generator candidates. Use --generators \"m1,m2\" or --candidates bench/candidates.json (see bench/candidates.example.json)."); process.exit(2); }
  const env = { ...process.env, ...(args.baseUrl ? { OPENAI_BASE_URL: args.baseUrl } : {}) };
  if (!env.OPENAI_API_KEY) {
    console.error(JSON.stringify({ status: STATUS.PROVIDER_NOT_CONFIGURED, detail: "OPENAI_API_KEY not set — benchmark not run (no silent substitution)." }));
    process.exit(3);
  }
  runBenchmark({ generators: gens, critics: crits, env, retries: args.retries, timeoutMs: args.timeout, judge: args.judge }).then((result) => {
    const outDir = join(root, "bench", "results");
    mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const out = args.out || join(outDir, `${stamp}-results.json`);
    const report = args.report || join(outDir, `${stamp}-report.md`);
    writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
    writeFileSync(report, renderMarkdown(result));
    console.log(`results: ${out}`);
    console.log(`report:  ${report}`);
    console.log(`recommended generator: ${result.comparison.recommended_generator || "none"}`);
    console.log(`recommended critic:    ${result.comparison.recommended_critic || "none"}`);
    console.log(`(recommendation only — no production env was modified)`);
    process.exit(0);
  }).catch((e) => { console.error(e && e.stack ? e.stack : String(e)); process.exit(1); });
}

export { renderMarkdown, collectText };
