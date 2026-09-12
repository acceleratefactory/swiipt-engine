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

// ---------- multi-provider candidate resolution ----------
export const DEFAULT_OPENAI_PROFILE = { base_url_env: "OPENAI_BASE_URL", api_key_env: "OPENAI_API_KEY", default_base: true };

/** A candidate is either a legacy model string (provider "openai") or { provider, model }. */
export function normalizeCandidate(c) {
  if (typeof c === "string" && c.trim()) return { provider: "openai", model: c.trim() };
  if (c && typeof c === "object" && typeof c.model === "string" && c.model.trim()) return { provider: String(c.provider || "openai"), model: c.model.trim() };
  throw new Error(`invalid candidate (expected "model" or { provider, model }): ${JSON.stringify(c)}`);
}

/**
 * Resolve a named provider profile to runtime base URL + API key via the referenced env vars.
 * A profile defines ONLY { base_url_env, api_key_env }. Missing credentials fail THAT candidate —
 * never another provider. No profile value is ever a secret.
 */
export function resolveProvider(profiles, providerId, env = process.env) {
  const profile = (profiles && profiles[providerId]) || (providerId === "openai" ? DEFAULT_OPENAI_PROFILE : null);
  if (!profile) return { provider: providerId, ok: false, missing: ["provider_profile"], error: `unknown provider profile '${providerId}'`, base_url_env: null, api_key_env: null, baseUrl: null, apiKey: null };
  const base_url_env = profile.base_url_env || (providerId === "openai" ? "OPENAI_BASE_URL" : null);
  const api_key_env = profile.api_key_env || (providerId === "openai" ? "OPENAI_API_KEY" : null);
  const rawBase = base_url_env ? env[base_url_env] : undefined;
  const apiKey = api_key_env ? env[api_key_env] : undefined;
  const allowDefaultBase = profile.default_base === true || providerId === "openai";
  const missing = [];
  if (!apiKey) missing.push(api_key_env || "api_key");
  if (!rawBase && !allowDefaultBase) missing.push(base_url_env || "base_url");
  if (missing.length) return { provider: providerId, ok: false, missing, error: `provider '${providerId}' not configured: missing ${missing.join(", ")}`, base_url_env, api_key_env, baseUrl: null, apiKey: null };
  return { provider: providerId, ok: true, missing: [], base_url_env, api_key_env, baseUrl: rawBase || null, apiKey };
}

function providerRefusal(cand, prov, reason) {
  return {
    provider: cand.provider, model: cand.model, requested_model: cand.model, returned_model: null,
    provider_status: STATUS.PROVIDER_NOT_CONFIGURED, http_status: null, endpoint_host: null,
    base_url_env: prov.base_url_env, api_key_env: prov.api_key_env, missing_env: prov.missing,
    error: prov.error || reason, model_identity: "NOT_RUN",
  };
}


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

async function callWithRetries({ worker, model, messages, jsonMode = true, env, fetchImpl, retries = 0, timeoutMs, baseUrl = null, apiKey = null }) {
  let attempts = 0;
  let res = null;
  for (let i = 0; i <= retries; i++) {
    attempts++;
    res = await chatCompletion({ worker, model, messages, jsonMode, env, fetchImpl, timeoutMs, baseUrl, apiKey });
    if (res.ok) break;
    if (i < retries) continue;
  }
  return { res, retries_used: attempts - 1, attempts };
}

/** Run one generator candidate (string model or { provider, model }) against the fixed task. */
export async function runGenerator(candidate, { task, fixture, env = process.env, profiles = null, fetchImpl = null, retries = 0, timeoutMs, judge = null } = {}) {
  const cand = normalizeCandidate(candidate);
  const model = cand.model;
  const prov = resolveProvider(profiles, cand.provider, env);

  if (!prov.ok) {
    const evald = evaluateGeneratorOutput(fixture, null, { parseOk: false, schemaValid: false });
    return { ...providerRefusal(cand, prov), timestamp: new Date().toISOString(), latency_ms: 0, parse_ok: false, schema_valid: false, retries: 0, usage: null, generation_status: STATUS.PROVIDER_NOT_CONFIGURED, actual_generator: "none (provider not configured)", output: null, dimensions: evald.dimensions, deterministic_score: 0, usable_without_rewrite: false, blocking: ["provider_not_configured"], judgment: { status: "NOT_RUN", reason: "provider not configured", model: null } };
  }

  const t0 = Date.now();
  const { res, retries_used } = await callWithRetries({
    worker: "copywriter", model, env, fetchImpl, retries, timeoutMs, baseUrl: prov.baseUrl, apiKey: prov.apiKey,
    messages: [{ role: "system", content: task.system }, { role: "user", content: task.user }],
  });
  const latency_ms = Date.now() - t0;
  const parse_ok = !!(res.ok && res.json && typeof res.json === "object" && !Array.isArray(res.json));
  let schema_valid = false;
  if (parse_ok) { try { schema_valid = ajv.validate(ASSET_SCHEMA_ID, res.json); } catch { schema_valid = false; } }
  const evaluation = evaluateGeneratorOutput(fixture, res.json, { parseOk: parse_ok, schemaValid: schema_valid });
  const returned_model = res.response_model || null;
  const model_identity = !res.ok ? "NOT_RUN" : (returned_model ? (returned_model === model ? "OK" : "MODEL_ID_MISMATCH") : "OK_UNVERIFIED");

  let judgment = { status: "NOT_RUN", reason: "no independent critic supplied", model: null };
  if (judge) {
    const jCand = normalizeCandidate(judge);
    if (jCand.provider === cand.provider && jCand.model === model) {
      judgment = { status: "NOT_RUN", reason: "self-judging excluded from official comparison", model: null };
    } else {
      const jProv = resolveProvider(profiles, jCand.provider, env);
      if (!jProv.ok) {
        judgment = { status: "NOT_RUN", reason: `judge provider not configured (${jProv.error})`, model: null };
      } else {
        const j = await callWithRetries({
          worker: "writing-critic", model: jCand.model, env, fetchImpl: judge.fetchImpl || fetchImpl, retries, timeoutMs, baseUrl: jProv.baseUrl, apiKey: jProv.apiKey,
          messages: [{ role: "system", content: CRITIC_SYSTEM }, { role: "user", content: JSON.stringify({ asset: res.json, context: { product_truth: fixture.product_truth, customer_truth: fixture.customer_truth, angle: fixture.angle, required_fields: REQUIRED_FIELDS } }).slice(0, 120000) }],
        });
        const findings = Array.isArray(j.res.json?.findings) ? j.res.json.findings : [];
        judgment = { status: j.res.ok ? "RAN" : "NOT_RUN", provider: jCand.provider, model: jCand.model, provider_status: j.res.status, verdict: findings.some((f) => f.severity === "BLOCKER") ? "FAIL" : (findings.length ? "WARNING" : "PASS"), findings_count: findings.length };
      }
    }
  }

  return {
    provider: cand.provider,
    model,
    requested_model: model,
    returned_model,
    model_identity,
    base_url_env: prov.base_url_env,
    api_key_env: prov.api_key_env,
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

/** Run one critic candidate (string model or { provider, model }) against the controlled cases. */
export async function runCritic(candidate, { cases, env = process.env, profiles = null, fetchImpl = null, retries = 0, timeoutMs } = {}) {
  const cand = normalizeCandidate(candidate);
  const model = cand.model;
  const prov = resolveProvider(profiles, cand.provider, env);
  if (!prov.ok) {
    return { provider: cand.provider, model, requested_model: model, returned_model: null, model_identity: "NOT_RUN", endpoint_host: null, base_url_env: prov.base_url_env, api_key_env: prov.api_key_env, error: prov.error, cases: [], true_detections: 0, false_positives: 0, false_negatives: cases.length, defect_count: cases.filter((c) => c.expect_defect).length, severity_accuracy: 0, schema_reliability: 0, failure_rate: 1, precision: 0, recall: 0, f1: 0, avg_latency_ms: 0, provider_status: STATUS.PROVIDER_NOT_CONFIGURED };
  }

  const results = [];
  let returned_model = null;
  for (const c of cases) {
    const t0 = Date.now();
    const { res, retries_used } = await callWithRetries({
      worker: "writing-critic", model, env, fetchImpl, retries, timeoutMs, baseUrl: prov.baseUrl, apiKey: prov.apiKey,
      messages: [{ role: "system", content: CRITIC_SYSTEM }, { role: "user", content: JSON.stringify(c.payload).slice(0, 120000) }],
    });
    const latency_ms = Date.now() - t0;
    if (res.response_model) returned_model = res.response_model;
    const findings = Array.isArray(res.json?.findings) ? res.json.findings : null;
    const parse_ok = !!findings;
    const detected = parse_ok && findings.some((f) => f.severity === "BLOCKER" || ["FAIL", "NEVER", "UNSUPPORTED", "SCOPE_DRIFT", "SAFETY_ISSUE"].includes(f.status));
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
  const model_identity = returned_model ? (returned_model === model ? "OK" : "MODEL_ID_MISMATCH") : "OK_UNVERIFIED";
  return {
    provider: cand.provider,
    model,
    requested_model: model,
    returned_model,
    model_identity,
    base_url_env: prov.base_url_env,
    api_key_env: prov.api_key_env,
    endpoint_host: results.length ? (prov.baseUrl ? safeHostname(prov.baseUrl) : "api.openai.com") : null,
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

function safeHostname(url) { try { return new URL(String(url)).host; } catch { return null; } }

/** Rank and recommend. Never lets a model be its own judge; never silently accepts model substitution. */
export function compare(genResults, criticResults) {
  const isMismatch = (r) => r.model_identity === "MODEL_ID_MISMATCH";
  const usableGens = genResults.filter((g) => g.parse_ok && g.schema_valid && !isMismatch(g));
  const genRank = [...usableGens].sort((a, b) => (b.deterministic_score - a.deterministic_score) || (b.usable_without_rewrite - a.usable_without_rewrite) || (a.latency_ms - b.latency_ms));
  const genFailRank = genResults.filter((g) => !(g.parse_ok && g.schema_valid));
  const mismatchGens = genResults.filter(isMismatch);

  const usableCrit = criticResults.filter((c) => c.schema_reliability >= 0.5 && !isMismatch(c));
  const critRank = [...usableCrit].sort((a, b) => (b.f1 - a.f1) || (a.false_positives - b.false_positives) || (a.avg_latency_ms - b.avg_latency_ms));
  const mismatchCrit = criticResults.filter(isMismatch);

  const ref = (r) => (r ? { provider: r.provider || "openai", model: r.model, endpoint_host: r.endpoint_host || null } : null);
  const recommended_generator = genRank[0]?.model ?? null;
  const secondary_generator = genRank[1]?.model ?? null;
  const recommended_critic = critRank[0]?.model ?? null;
  const secondary_critic = critRank[1]?.model ?? null;
  const selfJudgeConflict = !!(recommended_generator && recommended_critic && recommended_generator === recommended_critic);

  const mean = (arr, f) => arr.length ? arr.reduce((s, x) => s + f(x), 0) / arr.length : 0;
  const dimScore = (g, k) => { const d = (g.dimensions || []).find((x) => x.key === k); return d ? d.score : 0; };
  return {
    generator_ranking: genRank.map((g) => ({ provider: g.provider || "openai", model: g.model, endpoint_host: g.endpoint_host || null, deterministic_score: g.deterministic_score, usable_without_rewrite: g.usable_without_rewrite, latency_ms: g.latency_ms, provider_status: g.provider_status })),
    structurally_failed_generators: genFailRank.map((g) => ({ provider: g.provider || "openai", model: g.model, provider_status: g.provider_status, parse_ok: g.parse_ok, schema_valid: g.schema_valid })),
    model_mismatch_candidates: [...mismatchGens.map((g) => ({ role: "generator", provider: g.provider, requested_model: g.requested_model, returned_model: g.returned_model })), ...mismatchCrit.map((c) => ({ role: "critic", provider: c.provider, requested_model: c.requested_model, returned_model: c.returned_model }))],
    critic_ranking: critRank.map((c) => ({ provider: c.provider || "openai", model: c.model, endpoint_host: c.endpoint_host || null, f1: Number(c.f1.toFixed(3)), precision: Number(c.precision.toFixed(3)), recall: Number(c.recall.toFixed(3)), false_positives: c.false_positives, false_negatives: c.false_negatives, schema_reliability: c.schema_reliability, avg_latency_ms: c.avg_latency_ms })),
    recommended_generator, secondary_generator, recommended_critic, secondary_critic,
    recommended_generator_ref: ref(genRank[0]), recommended_critic_ref: ref(critRank[0]),
    self_judge_conflict: selfJudgeConflict,
    structured_output_reliability: { generators: genResults.map((g) => ({ provider: g.provider || "openai", model: g.model, parse_ok: g.parse_ok, schema_valid: g.schema_valid, model_identity: g.model_identity || null })), critics: criticResults.map((c) => ({ provider: c.provider || "openai", model: c.model, schema_reliability: c.schema_reliability })) },
    truth_adherence: { mean_product_truth: Number(mean(genResults, (g) => dimScore(g, "product_truth_adherence")).toFixed(3)), mean_customer_truth: Number(mean(genResults, (g) => dimScore(g, "customer_truth_adherence")).toFixed(3)), mean_hallucination_free: Number(mean(genResults, (g) => dimScore(g, "hallucination_incidence")).toFixed(3)) },
    writing_quality: { mean_anti_slop: Number(mean(genResults, (g) => dimScore(g, "anti_slop_compliance")).toFixed(3)), mean_constitution: Number(mean(genResults, (g) => dimScore(g, "writing_constitution_compliance")).toFixed(3)), mean_interchangeability: Number(mean(genResults, (g) => dimScore(g, "interchangeability")).toFixed(3)) },
    latency: { generators_avg_ms: Math.round(mean(genResults, (g) => g.latency_ms)), critics_avg_ms: Math.round(mean(criticResults, (c) => c.avg_latency_ms)) },
    usage_cost: { note: "Token usage is reported when the endpoint returns it; cost depends on the chosen provider's pricing.", generator_usage: genResults.map((g) => ({ provider: g.provider || "openai", model: g.model, usage: g.usage })) },
    failure_rate: { generators: genResults.length ? genResults.filter((g) => g.provider_status !== STATUS.PROVIDER_SUCCESS).length / genResults.length : 0, critics: criticResults.length ? criticResults.filter((c) => c.failure_rate > 0).length / criticResults.length : 0 },
  };
}

/** Run the full candidate matrix (candidates may target different named providers). */
export async function runBenchmark({ generators, critics, profiles = null, env = process.env, fetchImpl = null, retries = 0, timeoutMs, judge = true } = {}) {
  if (!generators?.length) throw new Error("no generator candidates supplied");
  const gens = generators.map(normalizeCandidate);
  const crits = (critics || []).map(normalizeCandidate);
  const fixture = loadBenchFixture();
  const task = buildGenerationTask(fixture);
  const cases = buildCriticCases(fixture);
  const task_hash = createHash("sha256").update(task.system + task.user + JSON.stringify(task.schema)).digest("hex");

  const genResults = [];
  for (const cand of gens) {
    let judgeRef = null;
    if (judge) {
      const jc = crits.find((c) => !(c.provider === cand.provider && c.model === cand.model));
      if (jc) judgeRef = { provider: jc.provider, model: jc.model, fetchImpl };
    }
    genResults.push(await runGenerator(cand, { task, fixture, env, profiles, fetchImpl, retries, timeoutMs, judge: judgeRef }));
  }
  const criticResults = [];
  for (const cand of crits) criticResults.push(await runCritic(cand, { cases, env, profiles, fetchImpl, retries, timeoutMs }));

  let base_host = null;
  try { base_host = new URL(chatEndpoint(env.OPENAI_BASE_URL, env)).host; } catch { /* ignore */ }
  const providerIds = [...new Set([...gens, ...crits].map((c) => c.provider))];

  return {
    meta: { tool: "swiipt-text-provider-bench", version: "1.1", generated_at: new Date().toISOString(), default_endpoint_host: base_host, providers: providerIds, generators: gens, critics: crits, retries, timeout_ms: timeoutMs || null, judge_enabled: !!judge },
    fixture: { id: fixture.id, synthetic: true },
    task_hash,
    generators: genResults,
    critics: criticResults,
    comparison: compare(genResults, criticResults),
  };
}

function renderMarkdown(result) {
  const ref = (c) => `${c.provider}/${c.model}`;
  const L = [];
  L.push(`# Swiipt Text Provider Benchmark`);
  L.push("");
  L.push(`- Generated: ${result.meta.generated_at}`);
  L.push(`- Default endpoint host: ${result.meta.default_endpoint_host || "(unset)"}`);
  L.push(`- Providers: ${(result.meta.providers || []).join(", ") || "none"}`);
  L.push(`- Generators: ${(result.meta.generators || []).map(ref).join(", ") || "none"}`);
  L.push(`- Critics: ${(result.meta.critics || []).map(ref).join(", ") || "none"}`);
  L.push(`- Fixture: ${result.fixture.id} (synthetic) · task ${result.task_hash.slice(0, 12)}`);
  L.push("");
  L.push(`## GENERATOR COMPARISON`);
  L.push(`| Provider | Model (requested) | Returned | Identity | Det. score | Usable | Latency ms | Provider status |`);
  L.push(`|---|---|---|---|---|---|---|---|`);
  for (const g of result.generators) L.push(`| ${g.provider} | ${g.requested_model || g.model} | ${g.returned_model || "—"} | ${g.model_identity || "—"} | ${g.deterministic_score.toFixed(3)} | ${g.usable_without_rewrite} | ${g.latency_ms} | ${g.provider_status} |`);
  L.push("");
  L.push(`## CRITIC COMPARISON`);
  L.push(`| Provider | Model | Identity | F1 | Precision | Recall | FP | FN | Severity acc | Schema reliab. | Avg latency |`);
  L.push(`|---|---|---|---|---|---|---|---|---|---|---|`);
  for (const c of result.critics) L.push(`| ${c.provider} | ${c.model} | ${c.model_identity || "—"} | ${c.f1.toFixed(3)} | ${c.precision.toFixed(3)} | ${c.recall.toFixed(3)} | ${c.false_positives} | ${c.false_negatives} | ${c.severity_accuracy.toFixed(2)} | ${c.schema_reliability.toFixed(2)} | ${c.avg_latency_ms} |`);
  L.push("");
  L.push(`## STRUCTURED OUTPUT RELIABILITY`);
  for (const g of result.comparison.structured_output_reliability.generators) L.push(`- Generator ${g.provider}/${g.model}: parse=${g.parse_ok} schema=${g.schema_valid} identity=${g.model_identity || "—"}`);
  for (const c of result.comparison.structured_output_reliability.critics) L.push(`- Critic ${c.provider}/${c.model}: schema reliability=${c.schema_reliability}`);
  L.push("");
  L.push(`## MODEL IDENTITY / MODEL_ID_MISMATCH`);
  const mm = result.comparison.model_mismatch_candidates || [];
  if (!mm.length) L.push("- none (all matched or unverified)");
  else for (const m of mm) L.push(`- ${m.role} ${m.provider}: requested ${m.requested_model} → returned ${m.returned_model} (MODEL_ID_MISMATCH, excluded from recommendation)`);
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
  if (result.comparison.self_judge_conflict) L.push(`\n> recommended generator and critic are the same model — choose distinct models for independent review.`);
  const failed = result.comparison.structurally_failed_generators;
  if (failed.length) { L.push(""); L.push("## STRUCTURALLY FAILED GENERATORS"); for (const f of failed) L.push(`- ${f.provider}/${f.model}: status ${f.provider_status} (parse=${f.parse_ok})`); }
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
  let profiles = null;
  if (args.candidates) {
    const cfg = JSON.parse(readFileSync(args.candidates, "utf8"));
    if (cfg.generators) gens = cfg.generators;
    if (cfg.critics) crits = cfg.critics;
    if (cfg.providers) profiles = cfg.providers;
  }
  if (!gens.length) { console.error("No generator candidates. Use --generators \"m1,m2\" or --candidates bench/candidates.json (see bench/candidates.example.json)."); process.exit(2); }

  const env = { ...process.env, ...(args.baseUrl ? { OPENAI_BASE_URL: args.baseUrl } : {}) };
  const allCands = [...gens, ...crits].map((c) => { try { return normalizeCandidate(c); } catch { return null; } }).filter(Boolean);
  const configured = allCands.filter((c) => resolveProvider(profiles, c.provider, env).ok);
  if (!configured.length) {
    console.error(JSON.stringify({ status: STATUS.PROVIDER_NOT_CONFIGURED, detail: "no candidate provider is configured (check base_url_env / api_key_env) — benchmark not run (no silent substitution).", providers: [...new Set(allCands.map((c) => c.provider))] }));
    process.exit(3);
  }

  runBenchmark({ generators: gens, critics: crits, profiles, env, retries: args.retries, timeoutMs: args.timeout, judge: args.judge }).then((result) => {
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
    if ((result.comparison.model_mismatch_candidates || []).length) console.log(`MODEL_ID_MISMATCH candidates: ${result.comparison.model_mismatch_candidates.length} (excluded from recommendation)`);
    console.log(`(recommendation only — no production env was modified)`);
    process.exit(0);
  }).catch((e) => { console.error(e && e.stack ? e.stack : String(e)); process.exit(1); });
}

export { renderMarkdown, collectText };
