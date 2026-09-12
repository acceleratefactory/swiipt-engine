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
// ---------- Customer Truth grounding scorer (deterministic; benchmark-local) ----------
// Scores grounded coverage of the customer's documented reality across ALL CRF records using
// content tokens + distinctive 2-word phrases. Graded 0–1 (never binary), repetition-proof
// (set-based), with an explicit invented-customer-detail guard. No semantic AI judging.
const CUSTOMER_NARRATIVE_FIELDS = ["situation", "trigger", "context", "constraint", "thought", "fear", "emotional_stake", "desired_change", "exact_language"];
const CUSTOMER_STOPWORDS = new Set([
  "the", "and", "but", "if", "then", "than", "because", "of", "to", "in", "on", "at", "by", "for", "with", "without", "from", "into", "about", "between",
  "is", "are", "was", "were", "be", "been", "being", "do", "does", "did", "have", "has", "had",
  "it", "its", "this", "that", "these", "those", "she", "her", "hers", "he", "him", "his", "they", "them", "their", "you", "your", "yours", "i", "we", "us", "our", "ours", "me", "my",
  "not", "no", "yes", "just", "only", "also", "very", "too", "more", "most", "some", "any", "all", "every", "each", "both", "few", "many", "much", "other", "another", "such", "same", "own",
  "can", "could", "may", "might", "must", "should", "would", "will", "shall", "get", "got", "go", "goes", "went", "make", "makes", "made", "say", "says", "said", "tell", "told", "keep", "keeps", "kept",
  "what", "which", "who", "whom", "when", "where", "why", "how", "there", "here", "up", "down", "out", "off", "over", "under", "again", "once", "now", "still", "even", "ever", "never", "always",
  "one", "two", "three", "thing", "things", "something", "anything", "nothing", "everything", "everyone", "someone", "anyone", "nobody", "need", "needs", "needed", "want", "wants", "wanted", "like", "likes", "liked", "feel", "feels", "felt", "seems", "seem", "made", "way",
]);
const CUSTOMER_QUOTE_RE = /["\u201C\u201D]([^"\u201C\u201D]{10,})["\u201C\u201D]/g;

function normalizeCustomerText(s) {
  return lc(String(s == null ? "" : s)).replace(/[^a-z0-9\s']/g, " ").replace(/'/g, "").replace(/\s+/g, " ").trim();
}
function stemToken(t) {
  let s = t;
  if (s.length > 5 && s.endsWith("ing")) s = s.slice(0, -3);
  else if (s.length > 4 && s.endsWith("ed")) s = s.slice(0, -2);
  if (s.length > 4 && s.endsWith("es")) s = s.slice(0, -2);
  else if (s.length > 3 && s.endsWith("s")) s = s.slice(0, -1);
  return s;
}
function customerTokens(s) {
  return normalizeCustomerText(s).split(" ").filter(Boolean).filter((w) => !CUSTOMER_STOPWORDS.has(w) && w.length >= 3).map(stemToken).filter((t) => t.length >= 4);
}
function crfSegments(rec) {
  const segs = [];
  for (const f of CUSTOMER_NARRATIVE_FIELDS) if (typeof rec[f] === "string" && rec[f].trim()) segs.push(rec[f]);
  for (const b of rec.behaviour || []) if (typeof b === "string" && b.trim()) segs.push(b);
  for (const fa of rec.failed_attempts || []) {
    if (typeof fa === "string") { if (fa.trim()) segs.push(fa); continue; }
    for (const k of ["tried", "why", "result"]) if (typeof fa?.[k] === "string" && fa[k].trim()) segs.push(fa[k]);
  }
  return segs;
}
function anchorsForSegments(segments) {
  const tokenSet = new Set();
  const phraseSet = new Set();
  for (const seg of segments) {
    const toks = customerTokens(seg);
    for (const t of toks) tokenSet.add(t);
    for (let i = 0; i + 1 < toks.length; i++) {
      const a = toks[i], b = toks[i + 1];
      if (a.length >= 5 || b.length >= 5) phraseSet.add(`${a} ${b}`);
    }
  }
  const tokens = [...tokenSet].sort((a, b) => (b.length - a.length) || a.localeCompare(b));
  const phrases = [...phraseSet].sort((a, b) => (b.length - a.length) || a.localeCompare(b)).slice(0, 40);
  return { tokens, phrases };
}
function detectInventedCustomerQuotes(outputText, records) {
  const raw = String(outputText || "");
  const segsNormalized = records.flatMap((r) => crfSegments(r)).map(normalizeCustomerText);
  const segTokenSets = segsNormalized.map((s) => new Set(customerTokens(s)));
  const flags = [];
  let m;
  CUSTOMER_QUOTE_RE.lastIndex = 0;
  while ((m = CUSTOMER_QUOTE_RE.exec(raw)) !== null) {
    const q = normalizeCustomerText(m[1]);
    if (q.length < 10) continue;
    const grounded = segsNormalized.some((s) => s.includes(q)) || segTokenSets.some((set) => {
      const qt = customerTokens(q);
      if (!qt.length) return false;
      return qt.filter((t) => set.has(t)).length / qt.length >= 0.8;
    });
    if (!grounded) flags.push(m[1].trim().slice(0, 120));
  }
  return flags;
}
/** Deterministic Customer Truth grounding coverage over ALL CRF records + invention guard. */
export const CUSTOMER_ANCHOR_TARGET = 8; // distinct matched anchors for full coverage (graded below)
export function scoreCustomerTruth(fx, outputText) {
  const records = (fx.customer_truth || []).filter(Boolean);
  const outTokens = new Set(customerTokens(outputText));
  const outStem = customerTokens(outputText).join(" ");
  const perRecord = records.map((rec) => {
    const { tokens, phrases } = anchorsForSegments(crfSegments(rec));
    const matchedTokens = tokens.filter((t) => outTokens.has(t));
    const matchedPhrases = phrases.filter((p) => outStem.includes(p));
    const total = tokens.length + phrases.length;
    const matched = matchedTokens.length + matchedPhrases.length;
    return { id: rec.id, coverage: Number(Math.min(1, matched / CUSTOMER_ANCHOR_TARGET).toFixed(3)), raw_ratio: total ? Number((matched / total).toFixed(3)) : 0, matched, total, matchedTokens, matchedPhrases, tokens };
  });
  const best = perRecord.reduce((a, b) => (b.coverage > (a?.coverage ?? -1) ? b : a), null);
  const invention_flags = detectInventedCustomerQuotes(outputText, records);
  let score = best ? best.coverage : 0;
  const pass = !!best && score >= 0.3 && best.matched >= 2 && invention_flags.length === 0;
  if (invention_flags.length) score = Math.min(score, 0.2);
  const diagnostics = {
    records_available: records.map((r) => r.id),
    records_represented: perRecord.filter((r) => r.coverage > 0).map((r) => r.id),
    best_record: best ? best.id : null,
    coverage: score,
    available_anchors: best ? best.total : 0,
    matched_anchors: best ? best.matched : 0,
    unmatched_anchors: best ? best.total - best.matched : 0,
    matched_anchor_samples: best ? [...best.matchedTokens, ...best.matchedPhrases].slice(0, 20) : [],
    unmatched_anchor_samples: best ? best.tokens.filter((t) => !best.matchedTokens.includes(t)).slice(0, 20) : [],
    per_record_coverage: perRecord.map((r) => ({ id: r.id, coverage: r.coverage, matched: r.matched, available: r.total })),
    invention_flags,
  };
  const detail = best
    ? `customer-language coverage ${(score * 100).toFixed(0)}% on ${best.id} (matched ${best.matched}/${best.total} anchors)` + (invention_flags.length ? `; INVENTED customer detail: ${invention_flags.length} ungrounded quote(s)` : "")
    : "no CRF evidence available";
  return { score, pass, detail, diagnostics, invention_flags };
}

export const CONTENT_DIMENSIONS = [
  ["product_truth_adherence", "Product Truth adherence"],
  ["customer_truth_adherence", "Customer Truth adherence"],
  ["market_truth_adherence", "Market Truth adherence"],
  ["brand_truth_adherence", "Brand Truth adherence"],
  ["writing_constitution_compliance", "Writing Constitution compliance"],
  ["anti_slop_compliance", "Anti-Slop compliance"],
  ["interchangeability", "Interchangeability"],
  ["hallucination_incidence", "No unsupported claims / hallucination"],
  ["transformation_specificity", "Transformation specificity"],
  ["mechanism_fidelity", "Mechanism fidelity"],
  ["instruction_following", "Instruction following"],
  ["required_field_completeness", "Required-field completeness"],
  ["cultural_context_integrity", "Cultural / context integrity"],
  ["emotional_invention", "No unnecessary emotional invention"],
];
export const HARD_DIMENSIONS = ["product_truth_adherence", "brand_truth_adherence", "writing_constitution_compliance", "anti_slop_compliance", "hallucination_incidence", "mechanism_fidelity", "required_field_completeness"];

export function evaluateGeneratorOutput(fx, output, { parseOk = true, schemaValid = true, schemaErrors = [] } = {}) {
  const isObj = !!output && typeof output === "object" && !Array.isArray(output);
  const evaluable = parseOk && isObj;
  const text = evaluable ? lc(collectText(output)) : "";
  const ptr = fx.product_truth;
  const crf = fx.axes || fx.customer_truth[0];
  const brand = fx.brand_truth;
  const wc = fx.writing_constitution;
  const truth = lc(truthCorpus(fx));
  const dims = [];
  const add = (key, label, score, pass, detail) => dims.push({ key, label, method: "deterministic", status: "evaluated", score: Number(score.toFixed(3)), pass: !!pass, detail });
  const ne = (key, label, detail) => dims.push({ key, label, method: "deterministic", status: "NOT_EVALUATED", score: null, pass: false, detail });

  if (!evaluable) {
    for (const [k, l] of CONTENT_DIMENSIONS) ne(k, l, "not evaluated: no parsed JSON object to evaluate");
    return { dimensions: dims, content_quality_score: null, deterministic_score: null, structural_reliability: "FAIL", structural_reliability_score: parseOk ? 0.5 : 0, usable_without_rewrite: false, blocking: ["structural_reliability"], schema_errors: schemaErrors };
  }

  // A — Product Truth adherence (prohibited claims / overclaim absent; mechanism referenced)
  const prohibited = containsAny(text, ptr.prohibited_claims);
  const over = text.match(OVERCLAIM);
  add("product_truth_adherence", "Product Truth adherence", (prohibited.length || over) ? 0 : 1, !(prohibited.length || over), prohibited.length ? `prohibited claim: ${prohibited.join("; ")}` : (over ? `overclaim: ${over[0]}` : "no prohibited/overclaim language"));

  // B — Customer Truth adherence (grounded coverage over ALL CRF records; graded; invention-guarded)
  const ct = scoreCustomerTruth(fx, collectText(output));
  dims.push({ key: "customer_truth_adherence", label: "Customer Truth adherence", method: "deterministic", status: "evaluated", score: ct.score, pass: ct.pass, detail: ct.detail, diagnostics: ct.diagnostics });

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

  const evaluated = dims.filter((d) => d.status === "evaluated");
  const content_quality_score = evaluated.length ? Number((evaluated.reduce((s, d) => s + d.score, 0) / evaluated.length).toFixed(3)) : null;
  const structural_reliability = (parseOk && schemaValid) ? "PASS" : "FAIL";
  const structural_reliability_score = (parseOk && schemaValid) ? 1 : (parseOk ? 0.5 : 0);
  const byKey = Object.fromEntries(dims.map((d) => [d.key, d]));
  const blocking = dims.filter((d) => d.status === "evaluated" && !d.pass && HARD_DIMENSIONS.includes(d.key)).map((d) => d.key);
  if (structural_reliability === "FAIL") blocking.push("structural_reliability");
  if (ct.invention_flags.length) blocking.push("customer_truth_invention");
  const usable = structural_reliability === "PASS" && blocking.length === 0 && byKey.interchangeability.score >= 0.66 && byKey.transformation_specificity.pass;
  return { dimensions: dims, content_quality_score, deterministic_score: content_quality_score, structural_reliability, structural_reliability_score, usable_without_rewrite: usable, blocking, schema_errors: schemaErrors };
}

async function callWithRetries({ worker, model, messages, jsonMode = true, env, fetchImpl, retries = 0, timeoutMs, baseUrl = null, apiKey = null, structuredMode = null, jsonSchema = null, schemaName = "response" }) {
  const mode = structuredMode || (jsonMode === false ? "none" : "json_object");
  let attempts = 0;
  let res = null;
  for (let i = 0; i <= retries; i++) {
    attempts++;
    res = await chatCompletion({
      worker, model, messages, env, fetchImpl, timeoutMs, baseUrl, apiKey,
      jsonMode: mode === "json_object",
      jsonSchema: mode === "json_schema" ? jsonSchema : null,
      schemaName,
    });
    if (res.ok) break;
    if (i < retries) continue;
  }
  return { res, retries_used: attempts - 1, attempts };
}

/** Run one generator candidate (string model or { provider, model }) against the fixed task. */
export async function runGenerator(candidate, { task, fixture, env = process.env, profiles = null, fetchImpl = null, retries = 0, timeoutMs, judge = null, label = null, progress = null, index = null, total = null, structuredMode = "json_schema" } = {}) {
  const cand = normalizeCandidate(candidate);
  const model = cand.model;
  const displayLabel = label || `${cand.provider}/${model}`;
  const prov = resolveProvider(profiles, cand.provider, env);

  if (!prov.ok) {
    if (progress) progress(`[GEN ${index}/${total}] ${displayLabel} FAIL 0.0s — PROVIDER_NOT_CONFIGURED`);
    const evald = evaluateGeneratorOutput(fixture, null, { parseOk: false, schemaValid: false, schemaErrors: [{ path: "/", keyword: "provider", message: `provider not configured: ${prov.error}` }] });
    return { ...providerRefusal(cand, prov), label: displayLabel, timestamp: new Date().toISOString(), latency_ms: 0, parse_ok: false, schema_valid: false, structural_reliability: "FAIL", structural_reliability_score: 0, content_quality_score: null, provider_reliability: 0, retries: 0, usage: null, generation_status: STATUS.PROVIDER_NOT_CONFIGURED, actual_generator: "none (provider not configured)", output: null, dimensions: evald.dimensions, deterministic_score: null, usable_without_rewrite: false, blocking: ["provider_not_configured", "structural_reliability"], schema_errors: evald.schema_errors, recommendation_eligible: false, recommendation_blocked_reason: "provider not configured", requested_structured_output_mode: structuredMode, schema_enforcement_requested: false, structured_output_provider_response: "not_requested", judgment: { status: "NOT_RUN", reason: "provider not configured", model: null } };
  }

  if (progress) progress(`[GEN ${index}/${total}] ${displayLabel} START`);
  const t0 = Date.now();
  const { res, retries_used } = await callWithRetries({
    worker: "copywriter", model, env, fetchImpl, retries, timeoutMs, baseUrl: prov.baseUrl, apiKey: prov.apiKey,
    structuredMode, jsonSchema: task.schema, schemaName: "bench_asset",
    messages: [{ role: "system", content: task.system }, { role: "user", content: task.user }],
  });
  const latency_ms = Date.now() - t0;
  const parse_ok = !!(res.ok && res.json && typeof res.json === "object" && !Array.isArray(res.json));
  let schema_valid = false;
  let schema_errors = [];
  if (parse_ok) {
    try {
      schema_valid = ajv.validate(ASSET_SCHEMA_ID, res.json);
      if (!schema_valid) schema_errors = (ajv.errors || []).map((e) => ({ path: e.instancePath || "/", keyword: e.keyword || null, message: e.message || "" }));
    } catch { schema_valid = false; }
  }
  const evaluation = evaluateGeneratorOutput(fixture, res.json, { parseOk: parse_ok, schemaValid: schema_valid, schemaErrors: schema_errors });
  const returned_model = res.response_model || null;
  const model_identity = !res.ok ? "NOT_RUN" : (returned_model ? (returned_model === model ? "OK" : "MODEL_ID_MISMATCH") : "OK_UNVERIFIED");
  if (progress) progress(`[GEN ${index}/${total}] ${res.ok ? "SUCCESS" : "FAIL"} ${(latency_ms / 1000).toFixed(1)}s — JSON ${parse_ok ? "PASS" : "FAIL"} / SCHEMA ${schema_valid ? "PASS" : "FAIL"}${model_identity === "MODEL_ID_MISMATCH" ? " / MODEL_ID_MISMATCH" : ""}`);

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

  let recommendation_blocked_reason = null;
  if (res.status !== STATUS.PROVIDER_SUCCESS) recommendation_blocked_reason = `provider ${res.status}`;
  else if (!parse_ok) recommendation_blocked_reason = "JSON parse failed";
  else if (!schema_valid) recommendation_blocked_reason = `schema validation failed (${schema_errors.length} error(s))`;
  else if (model_identity === "MODEL_ID_MISMATCH") recommendation_blocked_reason = "MODEL_ID_MISMATCH";
  else if ((evaluation.blocking || []).length) recommendation_blocked_reason = `blocking dimensions: ${evaluation.blocking.join(", ")}`;
  else if (evaluation.content_quality_score == null) recommendation_blocked_reason = "content not evaluated";

  return {
    provider: cand.provider,
    model,
    label: displayLabel,
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
    requested_structured_output_mode: structuredMode,
    schema_enforcement_requested: structuredMode === "json_schema" && !!task.schema,
    structured_output_provider_response: structuredMode === "none" ? "not_requested" : (res.ok ? "accepted" : "rejected"),
    parse_ok,
    schema_valid,
    structural_reliability: evaluation.structural_reliability,
    structural_reliability_score: evaluation.structural_reliability_score,
    content_quality_score: evaluation.content_quality_score,
    provider_reliability: res.ok ? 1 : 0,
    schema_errors,
    recommendation_eligible: recommendation_blocked_reason === null,
    recommendation_blocked_reason,
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
export async function runCritic(candidate, { cases, env = process.env, profiles = null, fetchImpl = null, retries = 0, timeoutMs, label = null, progress = null, counter = null } = {}) {
  const cand = normalizeCandidate(candidate);
  const model = cand.model;
  const displayLabel = label || `${cand.provider}/${model}`;
  const prov = resolveProvider(profiles, cand.provider, env);
  if (!prov.ok) {
    return { provider: cand.provider, model, label: displayLabel, requested_model: model, returned_model: null, model_identity: "NOT_RUN", endpoint_host: null, base_url_env: prov.base_url_env, api_key_env: prov.api_key_env, error: prov.error, cases: [], schema_errors: [{ path: "/", keyword: "provider", message: `provider not configured: ${prov.error}` }], provider_reliability: 0, true_detections: 0, false_positives: 0, false_negatives: cases.length, defect_count: cases.filter((c) => c.expect_defect).length, severity_accuracy: 0, schema_reliability: 0, case_failure_rate: 1, cases_total: cases.length, cases_failed: cases.length, precision: 0, recall: 0, f1: 0, avg_latency_ms: 0, provider_status: STATUS.PROVIDER_NOT_CONFIGURED };
  }

  const results = [];
  const schema_errors = [];
  let returned_model = null;
  for (const c of cases) {
    if (counter) counter.i++;
    if (progress && counter) progress(`[CRITIC ${counter.i}/${counter.total}] ${displayLabel} case=${c.id} START`);
    const t0 = Date.now();
    const { res, retries_used } = await callWithRetries({
      worker: "writing-critic", model, env, fetchImpl, retries, timeoutMs, baseUrl: prov.baseUrl, apiKey: prov.apiKey,
      messages: [{ role: "system", content: CRITIC_SYSTEM }, { role: "user", content: JSON.stringify(c.payload).slice(0, 120000) }],
    });
    const latency_ms = Date.now() - t0;
    if (res.response_model) returned_model = res.response_model;
    const findings = Array.isArray(res.json?.findings) ? res.json.findings : null;
    const parse_ok = !!findings;
    if (!parse_ok && res.ok) schema_errors.push({ case_id: c.id, path: "/findings", keyword: "schema", message: "response did not contain a findings array" });
    const detected = parse_ok && findings.some((f) => f.severity === "BLOCKER" || ["FAIL", "NEVER", "UNSUPPORTED", "SCOPE_DRIFT", "SAFETY_ISSUE"].includes(f.status));
    if (progress && counter) progress(`[CRITIC ${counter.i}/${counter.total}] ${displayLabel} case=${c.id} ${res.ok ? "SUCCESS" : "FAIL"} ${(latency_ms / 1000).toFixed(1)}s — SCHEMA ${parse_ok ? "PASS" : "FAIL"}`);
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
    label: displayLabel,
    requested_model: model,
    returned_model,
    model_identity,
    base_url_env: prov.base_url_env,
    api_key_env: prov.api_key_env,
    endpoint_host: results.length ? (prov.baseUrl ? safeHostname(prov.baseUrl) : "api.openai.com") : null,
    provider_reliability: results.length ? results.filter((r) => r.provider_status === STATUS.PROVIDER_SUCCESS).length / results.length : 0,
    cases: results,
    schema_errors,
    true_detections,
    false_positives,
    false_negatives,
    defect_count: defects.length,
    severity_accuracy: defects.length ? true_detections / defects.length : 0,
    schema_reliability: results.length ? schema_ok / results.length : 0,
    case_failure_rate: results.length ? results.filter((r) => r.provider_status !== STATUS.PROVIDER_SUCCESS).length / results.length : 0,
    cases_total: results.length,
    cases_failed: results.filter((r) => r.provider_status !== STATUS.PROVIDER_SUCCESS).length,
    precision, recall, f1,
    avg_latency_ms: Math.round(results.reduce((s, r) => s + r.latency_ms, 0) / (results.length || 1)),
  };
}

function safeHostname(url) { try { return new URL(String(url)).host; } catch { return null; } }

// ---------- Critic recommendation eligibility (controlled-suite qualification thresholds) ----------
// Eligibility (hard qualification) is deliberately SEPARATE from ranking (comparative ordering).
export const CRITIC_ELIGIBILITY = Object.freeze({
  provider_reliability: 1.0,
  schema_reliability: 1.0,
  precision: 1.0,
  recall: 0.8,
  f1: 0.8,
  severity_accuracy: 0.8,
});
const ELIGIBILITY_METRICS = ["provider_reliability", "schema_reliability", "precision", "recall", "f1", "severity_accuracy"];
const round3 = (v) => Number(Number(v).toFixed(3));

/**
 * Critic recommendation eligibility. Missing metrics NEVER silently pass. MODEL_ID_MISMATCH always
 * blocks. Self-judging is a real blocker for the given recommended generator (it may still appear in
 * comparative ranking).
 * @returns {{eligible:boolean, reasons:string[]}}
 */
export function criticEligibility(c, { recommendedGenerator = null } = {}) {
  const reasons = [];
  for (const m of ELIGIBILITY_METRICS) {
    const v = c[m];
    if (typeof v !== "number" || Number.isNaN(v)) { reasons.push(`missing ${m} (required >= ${CRITIC_ELIGIBILITY[m]})`); continue; }
    if (v < CRITIC_ELIGIBILITY[m]) reasons.push(`${m} ${round3(v)} < required ${CRITIC_ELIGIBILITY[m]}`);
  }
  if (c.model_identity == null) reasons.push("missing model_identity");
  else if (c.model_identity === "MODEL_ID_MISMATCH") reasons.push("model_identity MODEL_ID_MISMATCH");
  if (recommendedGenerator && c.model === recommendedGenerator) reasons.push(`self-judge conflict with recommended generator '${recommendedGenerator}'`);
  return { eligible: reasons.length === 0, reasons };
}

/** Rank and recommend. Never lets a model be its own judge; never silently accepts model substitution.
 *  Strict schema gate: only structurally-valid candidates are eligible for production recommendation. */
export function compare(genResults, criticResults) {
  const isMismatch = (r) => r.model_identity === "MODEL_ID_MISMATCH";
  const structuralPass = (g) => (g.structural_reliability ? g.structural_reliability === "PASS" : (g.parse_ok && g.schema_valid));
  const qscore = (g) => (g.content_quality_score != null ? g.content_quality_score : (g.deterministic_score != null ? g.deterministic_score : null));
  const recommendable = (g) => structuralPass(g) && !isMismatch(g) && !(g.blocking || []).length && qscore(g) != null;

  const usableGens = genResults.filter(recommendable);
  const genRank = [...usableGens].sort((a, b) => (qscore(b) - qscore(a)) || (Number(b.usable_without_rewrite) - Number(a.usable_without_rewrite)) || (a.latency_ms - b.latency_ms));
  const genFailRank = genResults.filter((g) => !(g.parse_ok && g.schema_valid));
  const schemaFailedGens = genResults.filter((g) => g.parse_ok && !g.schema_valid);
  const blockedGens = genResults.filter((g) => !recommendable(g));
  const mismatchGens = genResults.filter(isMismatch);

  const ref = (r) => (r ? { provider: r.provider || "openai", model: r.model, endpoint_host: r.endpoint_host || null } : null);
  const recommended_generator = genRank[0]?.model ?? null;
  const secondary_generator = genRank[1]?.model ?? null;

  // Critic RANKING (all candidates, comparative) is separate from RECOMMENDATION ELIGIBILITY (hard qualification).
  const critRank = [...criticResults].sort((a, b) => (b.f1 - a.f1) || (a.false_positives - b.false_positives) || (a.avg_latency_ms - b.avg_latency_ms));
  const critEval = critRank.map((c) => ({ c, ...criticEligibility(c, { recommendedGenerator: recommended_generator }) }));
  const eligibleCrit = critEval.filter((x) => x.eligible).map((x) => x.c);
  const recommended_critic = eligibleCrit[0]?.model ?? null;
  const secondary_critic = eligibleCrit[1]?.model ?? null;
  const top_ranked_critic = critRank[0]?.model ?? null;
  const critic_recommendation_blocked = critEval.filter((x) => !x.eligible).map((x) => ({ provider: x.c.provider || "openai", model: x.c.model, reasons: x.reasons }));
  const mismatchCrit = criticResults.filter(isMismatch);
  const selfJudgeConflict = !!(recommended_generator && critRank.some((c) => c.model === recommended_generator));

  // Failure metrics — explicitly named candidate-level vs case-level (never the ambiguous "failure_rate").
  const genFailed = genResults.filter((g) => g.provider_status !== STATUS.PROVIDER_SUCCESS).length;
  const criticCasesAttempted = criticResults.reduce((s, c) => s + ((c.cases || []).length), 0);
  const criticCasesFailed = criticResults.reduce((s, c) => s + ((c.cases || []).filter((r) => r.provider_status !== STATUS.PROVIDER_SUCCESS).length), 0);
  const criticWithAnyFailure = criticResults.filter((c) => (c.cases || []).some((r) => r.provider_status !== STATUS.PROVIDER_SUCCESS) || c.provider_reliability === 0).length;
  const meanOf = (arr, key) => (arr.length ? arr.reduce((s, x) => s + (typeof x[key] === "number" ? x[key] : 0), 0) / arr.length : null);

  const mean = (arr, f) => { const vals = arr.map(f).filter((v) => typeof v === "number" && !Number.isNaN(v)); return vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : null; };
  const dimScore = (g, k) => { const d = (g.dimensions || []).find((x) => x.key === k); return d && d.status !== "NOT_EVALUATED" && typeof d.score === "number" ? d.score : null; };
  const r3 = (v) => (v == null ? null : Number(v.toFixed(3)));
  return {
    generator_ranking: genRank.map((g) => ({ provider: g.provider || "openai", model: g.model, endpoint_host: g.endpoint_host || null, content_quality_score: qscore(g), structural_reliability: g.structural_reliability || (g.schema_valid ? "PASS" : "FAIL"), structural_reliability_score: g.structural_reliability_score ?? null, provider_reliability: g.provider_reliability ?? null, usable_without_rewrite: g.usable_without_rewrite, latency_ms: g.latency_ms, provider_status: g.provider_status })),
    recommendation_blocked: blockedGens.map((g) => ({ provider: g.provider || "openai", model: g.model, reason: g.recommendation_blocked_reason || (isMismatch(g) ? "MODEL_ID_MISMATCH" : (g.blocking || []).join(", ") || "not recommendable") })),
    structurally_failed_generators: genFailRank.map((g) => ({ provider: g.provider || "openai", model: g.model, provider_status: g.provider_status, parse_ok: g.parse_ok, schema_valid: g.schema_valid })),
    schema_failed_generators: schemaFailedGens.map((g) => ({ provider: g.provider || "openai", model: g.model, schema_errors: g.schema_errors || [] })),
    model_mismatch_candidates: [...mismatchGens.map((g) => ({ role: "generator", provider: g.provider, requested_model: g.requested_model, returned_model: g.returned_model })), ...mismatchCrit.map((c) => ({ role: "critic", provider: c.provider, requested_model: c.requested_model, returned_model: c.returned_model }))],
    critic_ranking: critRank.map((c) => { const ev = critEval.find((x) => x.c === c); return { provider: c.provider || "openai", model: c.model, endpoint_host: c.endpoint_host || null, eligible: ev ? ev.eligible : false, eligibility_reasons: ev ? ev.reasons : [], f1: Number((c.f1 || 0).toFixed(3)), precision: Number((c.precision || 0).toFixed(3)), recall: Number((c.recall || 0).toFixed(3)), severity_accuracy: Number((c.severity_accuracy || 0).toFixed(3)), false_positives: c.false_positives, false_negatives: c.false_negatives, schema_reliability: c.schema_reliability, provider_reliability: c.provider_reliability ?? null, case_failure_rate: c.case_failure_rate ?? null, avg_latency_ms: c.avg_latency_ms }; }),
    recommended_generator, secondary_generator, recommended_critic, secondary_critic,
    top_ranked_critic,
    critic_recommendation_blocked,
    recommended_generator_ref: ref(genRank[0]), recommended_critic_ref: ref(eligibleCrit[0]),
    self_judge_conflict: selfJudgeConflict,
    structured_output_reliability: { generators: genResults.map((g) => ({ provider: g.provider || "openai", model: g.model, parse_ok: g.parse_ok, schema_valid: g.schema_valid, structural_reliability: g.structural_reliability || null, model_identity: g.model_identity || null, requested_structured_output_mode: g.requested_structured_output_mode || null, schema_enforcement_requested: g.schema_enforcement_requested ?? null, structured_output_provider_response: g.structured_output_provider_response || null, schema_errors: g.schema_errors || [] })), critics: criticResults.map((c) => ({ provider: c.provider || "openai", model: c.model, schema_reliability: c.schema_reliability, schema_errors: c.schema_errors || [] })) },
    provider_reliability: { generators: genResults.map((g) => ({ provider: g.provider || "openai", model: g.model, provider_reliability: g.provider_reliability ?? null })), critics: criticResults.map((c) => ({ provider: c.provider || "openai", model: c.model, provider_reliability: c.provider_reliability ?? null })) },
    truth_adherence: { mean_product_truth: r3(mean(genResults, (g) => dimScore(g, "product_truth_adherence"))), mean_customer_truth: r3(mean(genResults, (g) => dimScore(g, "customer_truth_adherence"))), mean_hallucination_free: r3(mean(genResults, (g) => dimScore(g, "hallucination_incidence"))) },
    writing_quality: { mean_anti_slop: r3(mean(genResults, (g) => dimScore(g, "anti_slop_compliance"))), mean_constitution: r3(mean(genResults, (g) => dimScore(g, "writing_constitution_compliance"))), mean_interchangeability: r3(mean(genResults, (g) => dimScore(g, "interchangeability"))) },
    latency: { generators_avg_ms: Math.round(mean(genResults, (g) => g.latency_ms) ?? 0), critics_avg_ms: Math.round(mean(criticResults, (c) => c.avg_latency_ms) ?? 0) },
    usage_cost: { note: "Token usage is reported when the endpoint returns it; cost depends on the chosen provider's pricing.", generator_usage: genResults.map((g) => ({ provider: g.provider || "openai", model: g.model, usage: g.usage })) },
    failure_metrics: {
      _note: "candidates_with_any_failure* = candidate-level; case_failure_rate = failed attempts / attempted attempts (weighted across candidates); provider_reliability is a separate transport metric.",
      generators: {
        candidates_total: genResults.length,
        candidates_with_any_failure: genFailed,
        candidates_with_any_failure_rate: genResults.length ? genFailed / genResults.length : 0,
        case_failure_rate: genResults.length ? genFailed / genResults.length : 0,
        provider_reliability_mean: meanOf(genResults, "provider_reliability"),
      },
      critics: {
        candidates_total: criticResults.length,
        candidates_with_any_failure: criticWithAnyFailure,
        candidates_with_any_failure_rate: criticResults.length ? criticWithAnyFailure / criticResults.length : 0,
        case_failure_rate: criticCasesAttempted ? criticCasesFailed / criticCasesAttempted : 0,
        cases_attempted: criticCasesAttempted,
        cases_failed: criticCasesFailed,
        provider_reliability_mean: meanOf(criticResults, "provider_reliability"),
      },
    },
  };
}

/** Run the full candidate matrix (candidates may target different named providers). */
export async function runBenchmark({ generators, critics, profiles = null, env = process.env, fetchImpl = null, retries = 0, timeoutMs, judge = true, progress = null, structuredMode = "json_schema" } = {}) {
  if (!generators?.length) throw new Error("no generator candidates supplied");
  const gens = generators.map(normalizeCandidate);
  const crits = (critics || []).map(normalizeCandidate);
  const fixture = loadBenchFixture();
  const task = buildGenerationTask(fixture);
  const cases = buildCriticCases(fixture);
  const task_hash = createHash("sha256").update(task.system + task.user + JSON.stringify(task.schema)).digest("hex");

  const genResults = [];
  let gi = 0;
  for (const cand of gens) {
    gi++;
    let judgeRef = null;
    if (judge) {
      const jc = crits.find((c) => !(c.provider === cand.provider && c.model === cand.model));
      if (jc) judgeRef = { provider: jc.provider, model: jc.model, fetchImpl };
    }
    genResults.push(await runGenerator(cand, { task, fixture, env, profiles, fetchImpl, retries, timeoutMs, judge: judgeRef, label: cand.label || null, progress, index: gi, total: gens.length, structuredMode }));
  }
  const criticResults = [];
  const counter = { i: 0, total: crits.length * cases.length };
  for (const cand of crits) criticResults.push(await runCritic(cand, { cases, env, profiles, fetchImpl, retries, timeoutMs, label: cand.label || null, progress, counter }));

  let base_host = null;
  try { base_host = new URL(chatEndpoint(env.OPENAI_BASE_URL, env)).host; } catch { /* ignore */ }
  const providerIds = [...new Set([...gens, ...crits].map((c) => c.provider))];

  return {
    meta: { tool: "swiipt-text-provider-bench", version: "1.2", generated_at: new Date().toISOString(), default_endpoint_host: base_host, providers: providerIds, generators: gens, critics: crits, retries, timeout_ms: timeoutMs || null, judge_enabled: !!judge, structured_output_mode: structuredMode },
    fixture: { id: fixture.id, synthetic: true },
    task_hash,
    generators: genResults,
    critics: criticResults,
    comparison: compare(genResults, criticResults),
  };
}

function renderMarkdown(result) {
  const ref = (c) => `${c.provider}/${c.model}`;
  const fmt = (v) => (v == null ? "—" : v);
  const L = [];
  L.push(`# Swiipt Text Provider Benchmark`);
  L.push("");
  L.push(`- Generated: ${result.meta.generated_at}`);
  L.push(`- Default endpoint host: ${result.meta.default_endpoint_host || "(unset)"}`);
  L.push(`- Providers: ${(result.meta.providers || []).join(", ") || "none"}`);
  L.push(`- Generators: ${(result.meta.generators || []).map(ref).join(", ") || "none"}`);
  L.push(`- Critics: ${(result.meta.critics || []).map(ref).join(", ") || "none"}`);
  L.push(`- Fixture: ${result.fixture.id} (synthetic) · task ${result.task_hash.slice(0, 12)}`);
  L.push(`- Scores are separated: content_quality_score · structural_reliability_score · provider_reliability. \`NOT_EVALUATED\` means no score was possible (never treated as 0).`);
  L.push("");
  L.push(`## GENERATOR COMPARISON`);
  L.push(`| Provider | Model (requested) | Returned | Identity | Content quality | Structural | Struct. score | Provider reliab. | Usable | Latency ms | Provider status |`);
  L.push(`|---|---|---|---|---|---|---|---|---|---|---|`);
  for (const g of result.generators) L.push(`| ${g.provider} | ${g.requested_model || g.model} | ${fmt(g.returned_model)} | ${fmt(g.model_identity)} | ${fmt(g.content_quality_score)} | ${fmt(g.structural_reliability)} | ${fmt(g.structural_reliability_score)} | ${fmt(g.provider_reliability)} | ${g.usable_without_rewrite} | ${g.latency_ms} | ${g.provider_status} |`);
  L.push("");
  L.push(`## CRITIC COMPARISON`);
  L.push(`| Eligible | Provider | Model | Identity | F1 | Precision | Recall | Severity acc | Schema reliab. | Provider reliab. | Case fail rate | Avg latency |`);
  L.push(`|---|---|---|---|---|---|---|---|---|---|---|---|`);
  for (const c of result.comparison.critic_ranking || []) L.push(`| ${c.eligible ? "yes" : "no"} | ${c.provider} | ${c.model} | ${fmt(c.model_identity)} | ${c.f1.toFixed(3)} | ${c.precision.toFixed(3)} | ${c.recall.toFixed(3)} | ${c.severity_accuracy.toFixed(2)} | ${fmt(c.schema_reliability)} | ${fmt(c.provider_reliability)} | ${fmt(c.case_failure_rate)} | ${c.avg_latency_ms} |`);
  L.push("");
  L.push(`## STRUCTURED OUTPUT RELIABILITY`);
  for (const g of result.comparison.structured_output_reliability.generators) L.push(`- Generator ${g.provider}/${g.model}: parse=${g.parse_ok} schema=${g.schema_valid} structural=${fmt(g.structural_reliability)} identity=${fmt(g.model_identity)}`);
  for (const c of result.comparison.structured_output_reliability.critics) L.push(`- Critic ${c.provider}/${c.model}: schema reliability=${c.schema_reliability}${(c.schema_errors || []).length ? ` (${c.schema_errors.length} schema error(s))` : ""}`);
  L.push("");
  L.push(`## STRUCTURED OUTPUT MODE`);
  L.push(`- Requested mode: ${result.meta.structured_output_mode || "none"} (json_schema | json_object | none; schema mode is never silently downgraded)`);
  for (const g of result.generators) L.push(`- ${g.provider}/${g.model}: requested=${fmt(g.requested_structured_output_mode)} enforcement_requested=${g.schema_enforcement_requested} provider_response=${fmt(g.structured_output_provider_response)} parse=${g.parse_ok} local_schema=${g.schema_valid}`);
  L.push("");
  L.push(`## SCHEMA ERRORS`);
  const sf = result.comparison.schema_failed_generators || [];
  if (!sf.length) L.push("- none");
  else for (const g of sf) { L.push(`- ${g.provider}/${g.model}: ${g.schema_errors.length} error(s)`); for (const e of g.schema_errors.slice(0, 20)) L.push(`  - ${e.path} [${e.keyword || "schema"}] ${e.message}`); }
  L.push("");
  L.push(`## MODEL IDENTITY / MODEL_ID_MISMATCH`);
  const mm = result.comparison.model_mismatch_candidates || [];
  if (!mm.length) L.push("- none (all matched or unverified)");
  else for (const m of mm) L.push(`- ${m.role} ${m.provider}: requested ${m.requested_model} → returned ${m.returned_model} (MODEL_ID_MISMATCH, excluded from recommendation)`);
  L.push("");
  L.push(`## RECOMMENDATION BLOCKED`);
  const rb = result.comparison.recommendation_blocked || [];
  if (!rb.length) L.push("- none (all evaluated candidates structurally valid)");
  else for (const b of rb) L.push(`- ${b.provider}/${b.model}: ${b.reason}`);
  L.push("");
  L.push(`## PROVIDER RELIABILITY`);
  L.push(JSON.stringify(result.comparison.provider_reliability, null, 2));
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
  L.push(`## FAILURE METRICS (candidate-level and case-level)`);
  L.push("```json");
  L.push(JSON.stringify(result.comparison.failure_metrics, null, 2));
  L.push("```");
  L.push("");
  L.push(`## RECOMMENDED GENERATOR`);
  L.push(`**${result.comparison.recommended_generator || "none"}** (secondary fallback: ${result.comparison.secondary_generator || "none"})`);
  L.push("");
  L.push(`## TOP-RANKED CRITIC`);
  L.push(`**${result.comparison.top_ranked_critic || "none"}** (highest comparative rank; ranking is not recommendation)`);
  L.push("");
  L.push(`## RECOMMENDED CRITIC`);
  L.push(result.comparison.recommended_critic ? `**${result.comparison.recommended_critic}** (secondary fallback: ${result.comparison.secondary_critic || "none"})` : `**None — qualification requirements not met.**`);
  L.push("");
  L.push(`## CRITIC RECOMMENDATION BLOCKED`);
  const cblocked = result.comparison.critic_recommendation_blocked || [];
  if (!cblocked.length) L.push("- none (all evaluated critics qualified)");
  else for (const b of cblocked) L.push(`- ${b.provider}/${b.model}: ${b.reasons.join("; ")}`);
  if (result.comparison.self_judge_conflict) L.push(`\n> a critic candidate is the same model as the recommended generator; self-judging is excluded from recommendation.`);
  const failed = result.comparison.structurally_failed_generators;
  if (failed.length) { L.push(""); L.push("## STRUCTURALLY FAILED GENERATORS"); for (const f of failed) L.push(`- ${f.provider}/${f.model}: status ${f.provider_status} (parse=${f.parse_ok})`); }
  return L.join("\n") + "\n";
}

// -------------------- CLI --------------------
function parseArgs(argv) {
  const a = { retries: 0, judge: true, structuredMode: "json_schema" };
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
    else if (k === "--structured-output") a.structuredMode = argv[++i];
    else if (k === "--no-judge") a.judge = false;
    else if (k === "--quiet") a.quiet = true;
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
  if (!["json_schema", "json_object", "none"].includes(args.structuredMode)) { console.error(`--structured-output must be json_schema | json_object | none (got '${args.structuredMode}').`); process.exit(2); }

  const env = { ...process.env, ...(args.baseUrl ? { OPENAI_BASE_URL: args.baseUrl } : {}) };
  const allCands = [...gens, ...crits].map((c) => { try { return normalizeCandidate(c); } catch { return null; } }).filter(Boolean);
  const configured = allCands.filter((c) => resolveProvider(profiles, c.provider, env).ok);
  if (!configured.length) {
    console.error(JSON.stringify({ status: STATUS.PROVIDER_NOT_CONFIGURED, detail: "no candidate provider is configured (check base_url_env / api_key_env) — benchmark not run (no silent substitution).", providers: [...new Set(allCands.map((c) => c.provider))] }));
    process.exit(3);
  }

  runBenchmark({ generators: gens, critics: crits, profiles, env, retries: args.retries, timeoutMs: args.timeout, judge: args.judge, progress: args.quiet ? null : (m) => console.log(m), structuredMode: args.structuredMode }).then((result) => {
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
    console.log(`top-ranked critic:     ${result.comparison.top_ranked_critic || "none"}`);
    console.log(`recommended critic:    ${result.comparison.recommended_critic || "none (qualification requirements not met)"}`);
    if ((result.comparison.model_mismatch_candidates || []).length) console.log(`MODEL_ID_MISMATCH candidates: ${result.comparison.model_mismatch_candidates.length} (excluded from recommendation)`);
    console.log(`(recommendation only — no production env was modified)`);
    process.exit(0);
  }).catch((e) => { console.error(e && e.stack ? e.stack : String(e)); process.exit(1); });
}

export { renderMarkdown, collectText };
