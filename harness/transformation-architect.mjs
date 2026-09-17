#!/usr/bin/env node
// SWIIPT PRODUCT FACTORY - TRANSFORMATION ARCHITECT RUNNER V1
//
// OPPORTUNITY + AUTHORITATIVE RESEARCH/EVIDENCE + LIBRARY CONTEXT + ADJACENT TRANSFORMATION CONTEXT
//   -> CANDIDATE TRANSFORMATION RECORD (status: candidate)
//
// Deterministic core. No provider, no LLM, no network, no spend, no Date.now/Math.random/UUID.
//
// Owns exactly: the candidate Transformation Record.
// Does NOT own: discovery, product creation, product/marketing copy, Marketing Angles, social/image/
// video production, rendering, publishing, commerce, campaigns, distribution.
//
// Contracts (authority, not redefined here):
//   schemas/transformation.schema.json      output contract
//   schemas/opportunity.schema.json         input contract
//   standards/transformation-standard.md    eleven blocks + TSM + lifecycle + drift/ecosystem rules
//   standards/safety-standard.md            evidence rules, escalation routing, human authority
//   agents/transformation-architect.md      responsibility boundary + hard rules
//
// Honesty rule: every substantive statement in the output is a VERBATIM span from the authoritative
// input, or a claim-status-labelled inference/hypothesis, or a deterministic template scaffold that is
// recorded in report.derivation_notes. Anything unsupportable -> SOURCE_REQUIRED with the exact list.
//
// Usage:
//   node harness/transformation-architect.mjs --opportunity data/opportunities/OPP-PPL-NIGHTSHIFT-001.json
//   node harness/transformation-architect.mjs --opportunity <file> --write [--out-dir <dir>] [--routes a,b]
import Ajv from "ajv/dist/2020.js";
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GEOGRAPHY_TOKENS, extractGeographyTokens, stripGeographyTokens, nucleusSimilarity,
  COUNTRY_CLONE_THRESHOLD, sameNucleusModuloContext,
} from "./globality.mjs";
import {
  APPLICABILITY, APPLICABILITY_OUTCOMES, POSSIBLE_DUPLICATE_FLOOR,
  deriveApplicability, canonicalizeSituation, situationNucleus, decideCatalogueOutcome,
} from "./applicability.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const ARCHITECT_VERSION = "transformation-architect@1";

/** Run outcomes. SOURCE_REQUIRED is honesty success, not failure. */
export const RUN_STATUS = Object.freeze({
  CANDIDATE_READY: "CANDIDATE_READY",
  SOURCE_REQUIRED: "SOURCE_REQUIRED",
  INVALID_INPUT: "INVALID_INPUT",
  NOT_TRANSFORMATION_ELIGIBLE: "NOT_TRANSFORMATION_ELIGIBLE",
  SCHEMA_INVALID: "SCHEMA_INVALID",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  CONFLICT: "CONFLICT",
  // Semantic catalogue comparison (Phase E) — a candidate is never written automatically when an
  // equivalent or ambiguous existing canonical transformation is found.
  EXISTING_TRANSFORMATION_MATCH: "EXISTING_TRANSFORMATION_MATCH",
  CONTEXT_VARIANT_OF_EXISTING: "CONTEXT_VARIANT_OF_EXISTING",
  POSSIBLE_DUPLICATE_REVIEW_REQUIRED: "POSSIBLE_DUPLICATE_REVIEW_REQUIRED",
});

/** Disposition roles that can carry a transformation nucleus (the other roles are non-transformation). */
export const TRANSFORMATION_ELIGIBLE_ROLES = Object.freeze([
  "STANDALONE_TRANSFORMATION", "ENTRY_PRODUCT", "UPSELL", "ORDER_BUMP", "BUNDLE_COMPONENT",
  "MODULE", "BONUS_FREE_GIFT", "LEAD_MAGNET", "JOURNEY_NODE",
]);

/** Claim statuses are the transformation schema's enum (no parallel vocabulary). */
export const CLAIM_STATUS = Object.freeze({
  SOURCED: "sourced_evidence",
  EXPERT: "expert_reviewed",
  LIVED: "lived_experience",
  INFERENCE: "model_inference",
  HYPOTHESIS: "hypothesis",
});

export const RISK_LEVELS = Object.freeze(["low", "moderate", "high", "clinical"]);
/** Conservative area-risk defaults (a governance default may only raise review, never lower it). */
export const AREA_RISK_DEFAULTS = Object.freeze({ m01: "moderate" });
export const RISK_ESCALATION_LEXICON = Object.freeze([
  { pattern: /\b(emergency|suicid|self[- ]harm|crisis|sepsis|haemorrhage|hemorrhage|bleeding heavily)\b/i, level: "clinical" },
  { pattern: /\b(diagnos|treatment|medication|prescription|dose|clinical|infection|fever|depression|anxiety disorder|ptsd|mastitis)\b/i, score: 1 },
  { pattern: /\b(pain|symptom|medical|doctor|hospital|clinician|therapist|psychiatr)\b/i, score: 1 },
]);

/** Generic rescues the standard forbids unless operationalized. */
export const GENERIC_RESCUE = /\b(stay motivated|try again|be consistent|stay consistent|don'?t give up|just keep going|believe in yourself)\b/i;

/** Schema defaults (not inventions: the schema declares them). */
export const FIRST_WIN_DEFAULT_MINUTES = 15;
export const DEFAULT_MEASUREMENT_DAYS = Object.freeze([0, 7, 14, 30]);
/** Repository wording for a business decision the runner must never make. */
export const THRESHOLD_PENDING_PREFIX = "PENDING OWNER APPROVAL: ";

const ESCALATION_REFERENCE = "Route per the verified shared crisis/escalation list (RED = emergency now, AMBER = urgent today, GREEN = supported this week) - safety-standard 3; no numbers are invented here";

const ROLE_LEXICON = Object.freeze(["mother", "father", "partner", "husband", "wife", "baby", "newborn", "infant", "toddler", "child", "children", "grandmother", "grandfather", "aunty", "uncle", "in-law", "in-laws", "helper", "nanny", "parents", "family", "adults", "employer", "colleague", "midwife", "nurse", "doctor"]);
const ARTEFACT_NOUNS = /\b(roster|plan|chart|log|ledger|contract|schedule|calendar|tracker|card|checklist|script|system|bank|kit|list|template|routine)\b/i;
const OBSERVABLE_MARKERS = /\b(zero|no longer|stops?|stops? (?:happening|being)|can (?:now|name|state|list)|exists|posted|agreed|followed|completed|taken|protected|without)\b/i;

// ------------------------------------------------------------------------------------------------
// deterministic helpers (no time, no randomness)
// ------------------------------------------------------------------------------------------------
const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const norm = (s) => String(s).replace(/\s+/g, " ").trim();
export const slug = (s) => norm(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const uniq = (arr) => [...new Set(arr.map(norm).filter(Boolean))];
const sentences = (text) => norm(text).split(/(?<=[.!?])\s+/).map(norm).filter(Boolean);
const clauses = (text) => sentences(text).flatMap((s) => s.split(/;| — | – | - /).map(norm).filter(Boolean));
const hasWord = (text, re) => re.test(String(text));
const lower = (s) => norm(s).toLowerCase();
const stripMarker = (s) => norm(String(s).replace(/^\[(HYPOTHESIS|MODEL INFERENCE|BACKFILL|FACT|SUPPORTED INFERENCE)\]\s*/i, ""));
const markerOf = (s) => (String(s).match(/^\[([A-Z ]+)\]/) || [null, null])[1];
const canonical = (v) => (Array.isArray(v) ? `[${v.map(canonical).join(",")}]`
  : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`
    : JSON.stringify(v === undefined ? null : v));
export const canonicalProjection = (value) => canonical(value);

/** Verbatim spans from the authoritative input that read as constraints.
 *  Phase I fix: a constraint is never clipped mid-sentence / mid-word. The extractor returns the
 *  complete clause (or the complete matched span extended to a word boundary) — the original
 *  70-character clip silently corrupted canonical meaning. Never drops the last word either. */
export function extractConstraints(text) {
  const PATTERNS = [
    /\bno (?:overnight|family|help|support|one|space|time|energy|money|childcare|paid|practical) [a-z' ]{2,40}/i,
    /\bwithout [^.;]{3,50}/i,
    /\b(?:cannot|can't|unable to) [^.;]{3,50}/i,
    /\bworks? (?:weekdays|nights|shifts|away)[^.;]{0,40}/i,
    /\b(?:feels like|isn't possible|not an option|no one to) [^.;]{3,50}/i,
    /\bre-?raising [^.;]{0,50}/i,
  ];
  const out = [];
  for (const c of clauses(text)) {
    if (/^(?:so|because|therefore|then)\b/i.test(c)) continue;            // consequences are not constraints
    const clause = norm(c);
    for (const re of PATTERNS) {
      const m = clause.match(re);
      if (!m) continue;
      // Phase I: return the COMPLETE clause — a constraint is never a mid-sentence fragment.
      const raw = norm(m[0]);
      let value = clause.replace(/[.,;:]+$/, "");
      if (!value || value.split(/\s+/).filter(Boolean).length < 2) value = raw.replace(/[.,;:]+$/, "");
      if (value) out.push(value);
      break;
    }
  }
  return uniq(out);
}
/** Verbatim timeframe span, or null when the source does not state one. */
export function extractTimeframe(text) {
  const patterns = [
    /\b\d+\s*(?:-|–|to)\s*\d+\s*(?:weeks?|months?|days?)\b[^.;,]{0,24}/i,
    /\b(?:first|second|third|final)\s+\d+\s*(?:weeks?|months?|days?)\b[^.;,]{0,24}/i,
    /\b(?:day|week|month)\s*\d+[^.;,]{0,24}/i,
    /\b\d+\s*(?:weeks?|months?|days?)\s+(?:postpartum|after birth|after delivery|before|after|back)\b/i,
    /\bbirth to [^.;,]{1,40}/i,
    /\b\d+\s*days?\s+(?:before|after)\b[^.;,]{0,24}/i,
  ];
  for (const re of patterns) {
    const m = norm(text).match(re);
    if (m) return norm(m[0]).replace(/[.,;]$/, "");
  }
  return null;
}
/** Role nouns actually present in the source text (verbatim tokens, title-cased). */
export function extractRoles(text) {
  const t = lower(text);
  return uniq(ROLE_LEXICON.filter((r) => new RegExp(`\\b${r.replace("-", "[- ]")}\\b`, "i").test(t)).map((r) => r[0].toUpperCase() + r.slice(1)));
}
/** Deterministic short stage label from a mechanism statement. */
export function stageLabel(statement, index) {
  const m = norm(statement).match(ARTEFACT_NOUNS);
  if (m) return `Stage ${index}: ${m[0].toLowerCase()} mechanism`;
  return `Stage ${index}: ${norm(statement).split(" ").slice(0, 5).join(" ")}`;
}
/** Deterministic customer action derived from the mechanism statement's own nouns/verbs. */
export function actionFor(statement) {
  const s = lower(statement);
  if (/\b(roster|plan|chart|log|ledger|contract|schedule|calendar|tracker|card|checklist|list|template|kit)\b/.test(s)) return "Produce and post the named artefact; then follow the routine it sets";
  if (/\b(refram|conversation|words|ask|communi|script|expectation)\b/.test(s)) return "Have the pre-agreed conversation the mechanism describes";
  if (/\b(schedul|timing|hand-?off|block|shift|window|turn)\b/.test(s)) return "Schedule the protected block and hand over as the plan states";
  if (/\b(visib|track|count|trade|measur|score)\b/.test(s)) return "Record the tracked measure so it is visible and reviewable";
  return "Apply this mechanism as stated (verbatim in the stage objective)";
}

// ------------------------------------------------------------------------------------------------
// schema loading (ajv conventions reused from harness/validate-opportunity.mjs)
// ------------------------------------------------------------------------------------------------
function buildAjv() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  ajv.addFormat("date", /^\d{4}-\d{2}-\d{2}$/);
  ajv.addFormat("date-time", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  for (const f of readdirSync(join(ROOT, "schemas"))) {
    if (!f.endsWith(".schema.json")) continue;
    const sch = JSON.parse(readFileSync(join(ROOT, "schemas", f), "utf8"));
    ajv.addSchema(sch, `https://swiipt.com/factory/schemas/${f}`);
  }
  return ajv;
}
const OPP_SCHEMA = "https://swiipt.com/factory/schemas/opportunity.schema.json";
const TR_SCHEMA = "https://swiipt.com/factory/schemas/transformation.schema.json";
let AJV = null;
const ajv = () => (AJV ??= buildAjv());

export function validateOpportunity(opportunity) {
  const a = ajv();
  const ok = a.validate(OPP_SCHEMA, opportunity);
  return { valid: ok, errors: ok ? [] : a.errors.map((e) => `${e.instancePath || "/"} ${e.message}`) };
}
export function validateTransformation(record) {
  const a = ajv();
  const ok = a.validate(TR_SCHEMA, record);
  return { valid: ok, errors: ok ? [] : a.errors.map((e) => `${e.instancePath || "/"} ${e.message}`) };
}

// ------------------------------------------------------------------------------------------------
// identity
// ------------------------------------------------------------------------------------------------
/**
 * Identity convention (from data/README.md + existing records `TR-PPL-<SLUG>-001`):
 *  1. A declared `disposition.promoted_transformation_id` is authoritative (repository precedent).
 *  2. Otherwise derive deterministically from the opportunity id tokens: OPP-<LIB>-<THEME>-<NNN>
 *     -> TR-<LIB>-<THEME>-<NNN>.
 * Collision behavior is explicit in the write step (write refuses; ALREADY_EXISTS).
 */
export function deriveTransformationId(opportunity) {
  if (!opportunity || typeof opportunity !== "object") return null;
  const declared = opportunity?.disposition?.promoted_transformation_id;
  if (isStr(declared)) return norm(declared);
  const id = String(opportunity.opportunity_id ?? "");
  const parts = id.split("-").filter(Boolean);      // ["OPP","PPL","NIGHTSHIFT","001"]
  if (parts.length >= 3 && parts[0] === "OPP") return ["TR", ...parts.slice(1)].join("-");
  return null;
}

// ------------------------------------------------------------------------------------------------
// evidence resolution (traceability gate: a declared source must exist in the input context)
// ------------------------------------------------------------------------------------------------
/**
 * Resolve evidence entries. Rule: the runner may ONLY reference evidence present in its input context.
 * A `research_evidence` entry claiming sourced/expert status must name a source that appears in the
 * opportunity's own `source_references` (or in `research_evidence[].source_allowlist`); otherwise it is
 * rejected and recorded - never silently downgraded into the record.
 */
export function resolveEvidence({ opportunity, research_evidence = [], source_allowlist = [] }) {
  const allowed = new Set([...(opportunity?.source_references ?? []), ...source_allowlist].map(norm));
  const entries = [];
  const rejected = [];
  for (const e of Array.isArray(research_evidence) ? research_evidence : []) {
    const claim = norm(e?.claim ?? "");
    const status = e?.status;
    const source = e?.source ? norm(e.source) : null;
    if (!claim) { rejected.push({ claim, status, source, reason: "claim text missing" }); continue; }
    if (!Object.values(CLAIM_STATUS).includes(status)) { rejected.push({ claim, status, source, reason: "unknown claim status (schema enum only)" }); continue; }
    if ([CLAIM_STATUS.SOURCED, CLAIM_STATUS.EXPERT].includes(status)) {
      if (!source) { rejected.push({ claim, status, source, reason: "status requires a source" }); continue; }
      if (!allowed.has(source)) { rejected.push({ claim, status, source, reason: "source is not present in the authoritative input context (fabricated source refused)" }); continue; }
    }
    entries.push(source ? { claim, status, source } : { claim, status });
  }
  return { entries, rejected, allowlist_size: allowed.size };
}

// ------------------------------------------------------------------------------------------------
// block builders (verbatim spans + recorded derivations)
// ------------------------------------------------------------------------------------------------
function buildSituation(opportunity, library) {
  const finding = opportunity.finding ?? {};
  const missing = [];
  const submarket = norm(opportunity.submarket ?? "");
  const clause = submarket.replace(/^[A-Z0-9]+[.)]\s*/, "").split(/ — | – | - /)[0];
  const lifeState = slug(clause || opportunity.focus_market || library?.name || "");
  const timeframe = extractTimeframe([finding.person, finding.recurring_situation, finding.problem, finding.trigger].filter(Boolean).join(" "));
  const constraints = extractConstraints([finding.recurring_situation, finding.problem, finding.failed_attempt, finding.emotional_stake, finding.person].filter(Boolean).join(" "));
  const situation = {
    life_state: lifeState,
    person: norm(finding.person ?? ""),
    specific_situation: norm(finding.recurring_situation || finding.problem || ""),
    timeframe: timeframe ?? "",
    trigger: norm(finding.trigger ?? ""),
    problem: norm(finding.problem ?? ""),
    failed_attempt: norm(finding.failed_attempt ?? ""),
    constraints,
    emotional_stake: norm(finding.emotional_stake ?? ""),
    desired_transformation: norm(finding.desired_outcome ?? ""),
  };
  for (const k of ["life_state", "person", "specific_situation", "timeframe", "trigger", "problem", "failed_attempt", "emotional_stake", "desired_transformation"]) {
    if (!isStr(situation[k])) missing.push(`situation.${k}`);
  }
  if (!situation.constraints.length) missing.push("situation.constraints");
 return { situation, missing, derived: { life_state: "slug(submarket clause) [deterministic]", timeframe: timeframe ? "extracted verbatim span" : "not stated in source", constraints: constraints.length ? "verbatim constraint clauses" : "none found" } };
}

function buildBeforeState(opportunity, situation) {
  const finding = opportunity.finding ?? {};
  const text = [finding.problem, finding.recurring_situation, finding.failed_attempt, finding.emotional_stake, finding.person].filter(Boolean).join(" ");
  const behavior = clauses(finding.recurring_situation ?? "");
  const conditions = clauses(finding.problem ?? "");
  const emotional = clauses(finding.emotional_stake ?? "");
  const failed = clauses(finding.failed_attempt ?? "");
  const consequences = clauses(text).filter((c) => /\b(so|because|therefore|builds|leads to|ends? (?:up|with)|becomes|renegotiat|resentment|exhaust)\b/i.test(c));
  const people = extractRoles([finding.person, finding.recurring_situation, finding.emotional_stake, finding.problem].filter(Boolean).join(" "));
  const before = {
    current_behavior: uniq(behavior),
    current_conditions: uniq(conditions),
    emotional_state: uniq(emotional),
    practical_consequences: uniq(consequences),
    failed_attempts: uniq(failed),
    environmental_constraints: uniq(situation.constraints),
    people_involved: people,
  };
  const empty = Object.entries(before).filter(([, v]) => v.length === 0).map(([k]) => `before_state.${k}`);
  return { before_state: before, empty };
}

function buildAfterState(opportunity, situation) {
  const finding = opportunity.finding ?? {};
  const hypotheses = (finding.mechanism_hypotheses ?? []).map(norm).filter(Boolean);
  const desired = clauses(situation.desired_transformation);
  const systems = uniq([...desired, ...hypotheses].map((s) => norm(s)).filter((s) => hasWord(s, ARTEFACT_NOUNS)));
  const evidenceOfChange = uniq([...desired, ...hypotheses].filter((s) => hasWord(s, OBSERVABLE_MARKERS) || hasWord(s, ARTEFACT_NOUNS)));
  const capabilities = uniq(desired.filter((s) => /\b(gets?|can|able|confident|knows?|never has to|does not have to|no longer)\b/i.test(s)));
  const improvements = uniq(desired.filter((s) => !capabilities.includes(s)));
  const remaining = [];
  if (isStr(opportunity.finding?.competition_notes)) remaining.push(`Not covered by this transformation: ${norm(opportunity.finding.competition_notes)}`);
  return { after_state: { new_capabilities: capabilities, improvements, systems_created: systems, remaining_limits: remaining, evidence_of_change: evidenceOfChange }, hypotheses };
}

function buildMechanism(opportunity, resolvedEvidence) {
  const hypotheses = (opportunity.finding?.mechanism_hypotheses ?? []).map(norm).filter(Boolean);
  const quotes = (opportunity.finding?.evidence_quotes ?? []).map(norm).filter(Boolean);
  const evidenceBasis = [];
  for (const h of hypotheses) evidenceBasis.push({ claim: stripMarker(h), status: CLAIM_STATUS.HYPOTHESIS });
  for (const q of quotes) {
    const m = markerOf(q);
    evidenceBasis.push({ claim: stripMarker(q), status: m === "HYPOTHESIS" ? CLAIM_STATUS.HYPOTHESIS : CLAIM_STATUS.INFERENCE });
  }
  for (const e of resolvedEvidence) evidenceBasis.push(e);
  const provenance = (opportunity.source_references ?? []).map(norm).filter(Boolean)
    .map((doc) => ({ claim: `Research basis document for this transformation: ${doc}`, status: CLAIM_STATUS.SOURCED, source: doc }));
  const quoteEvidence = quotes.map((q) => ({ claim: stripMarker(q), status: CLAIM_STATUS.INFERENCE, source: opportunity.opportunity_id }));
  for (const e of provenance) evidenceBasis.push(e);
  return {
    mechanism: {
      core_mechanism: hypotheses[0] ?? "",
      mechanisms: hypotheses,
      why_it_should_work: hypotheses.join("; "),
      evidence_basis: evidenceBasis,
    },
    hypotheses,
    quoteCount: quotes.length,
    provenanceEvidence: [...provenance, ...quoteEvidence],
  };
}

function buildPath(hypotheses) {
  const seen = new Set();
  const stages = [];
  const duplicates = [];
  hypotheses.forEach((h, i) => {
    const key = slug(stripMarker(h));
    if (seen.has(key)) { duplicates.push(h); return; }
    seen.add(key);
    stages.push({
      stage: stageLabel(stripMarker(h), stages.length + 1),
      objective: stripMarker(h),
      customer_action: [actionFor(stripMarker(h))],
      required_assets: [],
    });
  });
  return { path: stages, duplicates };
}

function buildFailureMap(opportunity, situation, hypotheses) {
  const finding = opportunity.finding ?? {};
  const signals = [];
  for (const c of clauses(finding.failed_attempt ?? "")) signals.push({ type: "documented failed attempt", scenario: c });
  for (const c of situation.constraints) signals.push({ type: "constraint pressure", scenario: c });
  const rescueFor = (scenario) => {
    const s = lower(scenario);
    let best = null; let bestScore = -1;
    for (const h of hypotheses) {
      const words = lower(stripMarker(h)).split(/[^a-z]+/).filter((w) => w.length > 4);
      const score = words.reduce((n, w) => n + (s.includes(w) ? 1 : 0), 0);
      if (score > bestScore) { best = h; bestScore = score; }
    }
    const chosen = best ?? hypotheses[0] ?? null;
    if (!chosen) return null;
    return `${actionFor(stripMarker(chosen))} (source mechanism, verbatim: ${stripMarker(chosen)})`;
  };
  const map = [];
  for (const sig of signals) {
    const rescue = rescueFor(sig.scenario);
    if (!rescue) continue;
    if (GENERIC_RESCUE.test(rescue)) continue;   // generic rescues are refused, never emitted
    map.push({ failure_type: sig.type, scenario: sig.scenario, rescue_protocol: rescue });
  }
  const seen = new Set();
  const deduped = map.filter((m) => { const k = slug(m.scenario); if (seen.has(k)) return false; seen.add(k); return true; });
  return { failure_map: deduped, signal_count: signals.length };
}

function buildFirstWin(hypotheses, afterState, path) {
  const artefactHyp = hypotheses.find((h) => hasWord(h, ARTEFACT_NOUNS));
  const action = artefactHyp ? actionFor(stripMarker(artefactHyp)) : (path[0]?.customer_action?.[0] ?? null);
  const observable = afterState.evidence_of_change[0] ?? afterState.systems_created[0] ?? null;
  if (!action || !observable) return { first_win: null, reason: "no early artefact action and/or observable change supported by the source" };
  return { first_win: { time_limit_minutes: FIRST_WIN_DEFAULT_MINUTES, action, observable_change: observable } };
}

function buildTsm({ opportunity, situation, beforeState, afterState, failureMap, maintenanceSeed, systems, measurementDays = null }) {
  const text = [situation.problem, opportunity.finding?.recurring_situation, opportunity.finding?.failed_attempt].filter(Boolean).join(" ");
  const baselines = uniq(clauses(text).filter((c) => /\b(nobody|no one|no |every|never|not |without|renegotiat|invisible|alone|keeps? score)\b/i.test(c)));
  const indicators = uniq([...afterState.new_capabilities, ...afterState.improvements, ...afterState.evidence_of_change]).slice(0, 6);
  const threshold = `${THRESHOLD_PENDING_PREFIX}business call per transformation-standard 4 / safety-standard 5 - the runner must not decide the success threshold; owner approves`;
  const artefact = systems[0] ?? "the tracked plan";
  return {
    tsm: {
      before_baseline: baselines,
      success_indicators: indicators,
      measurement_days: measurementDays && measurementDays.length ? [...measurementDays] : [...DEFAULT_MEASUREMENT_DAYS],
      success_threshold: threshold,
      measurement_method: "Self-reported log of the stage-1 artefact plus a structured check-in against the Day-0 baseline at the scheduled check-ins",
      incomplete_progress_interpretation: `Partial adherence is expected; the recorded failure modes (${uniq(failureMap.map((f) => f.failure_type)).join(", ")}) are handled by their rescue protocols rather than treated as transformation failure`,
      next_action_on_miss: failureMap[0]?.rescue_protocol ?? maintenanceSeed.reentry_protocol,
    },
    baselines,
  };
}

function buildMaintenance({ failureMap, path, systems }) {
  const artefact = systems[0] ?? "the standing plan";
  return {
    maintenance_system: `Keep ${artefact.toLowerCase().slice(0, 120)} as the standing default after the measurement window`,
    relapse_protocol: failureMap[0]?.rescue_protocol ?? "",
    reentry_protocol: `Re-enter at ${path[0]?.stage ?? "the first stage"} without a guilt reset`,
  };
}

function resolveRiskLevel({ opportunity, research_evidence = [] }) {
  const explicit = research_evidence.find((e) => RISK_LEVELS.includes(e?.risk_level))?.risk_level;
  if (explicit) return { risk_level: explicit, source: "declared in research_evidence" };
  const areaDefault = AREA_RISK_DEFAULTS[opportunity.life_area] ?? "low";
  let level = areaDefault;
  let source = areaDefault === "low" ? "area default (low)" : `area default (${opportunity.life_area})`;
  const text = canonical(opportunity.finding ?? {});
  const clinical = RISK_ESCALATION_LEXICON.find((r) => r.level && r.pattern.test(text));
  if (clinical && RISK_LEVELS.indexOf(clinical.level) > RISK_LEVELS.indexOf(level)) { level = clinical.level; source = "lexicon escalation"; }
  else {
    const score = RISK_ESCALATION_LEXICON.reduce((n, r) => n + (r.score && r.pattern.test(text) ? r.score : 0), 0);
    if (score > 0 && RISK_LEVELS.indexOf(level) < RISK_LEVELS.indexOf("moderate")) { level = "moderate"; source = "lexicon escalation"; }
  }
  return { risk_level: level, source };
}

function buildSafety({ opportunity, resolvedEvidence, risk }) {
  const clinicalReview = [];
  const redFlags = [];
  if (risk.risk_level !== "low") clinicalReview.push("safety.red_flags (must come from authoritative literature - not supplied by this runner)");
  const escalation = risk.risk_level === "low" ? [] : [ESCALATION_REFERENCE];
  if (risk.risk_level !== "low") clinicalReview.push("safety.escalation_rules (verified shared crisis list must be confirmed)");
  const rawTopic = norm(opportunity.submarket ?? opportunity.focus_market ?? "the stated situation").replace(/^[A-Z0-9]+[.)]\s*/, "");
  const scope = `This transformation coordinates ${rawTopic.slice(0, 120)} only. It does not diagnose, treat, or replace professional care, and it does not cover adjacent situations outside its recorded nucleus.`;
  return {
    safety: { risk_level: risk.risk_level, scope_boundary: scope, red_flags: redFlags, escalation_rules: escalation },
    clinical_review_items: clinicalReview,
  };
}

function buildRouting({ next_transformation = [], adjacent_transformations = [], opportunity, selfId }) {
  const known = new Map();
  for (const tr of Array.isArray(adjacent_transformations) ? adjacent_transformations : []) {
    if (tr?.transformation_id) known.set(tr.transformation_id, tr);
  }
  const next = [];
  const unresolved = [];
  for (const id of Array.isArray(next_transformation) ? next_transformation : []) {
    const ref = norm(id);
    if (!ref) continue;
    if (ref === selfId) { unresolved.push({ id: ref, reason: "self-route rejected" }); continue; }
    if (known.has(ref)) next.push(ref);
    else unresolved.push({ id: ref, reason: "no authoritative adjacent transformation record in the input context (id not invented, not emitted)" });
  }
  const journeyGap = !uniq(next).length;
  if (journeyGap) unresolved.push({ id: null, reason: "journey routing gap: no authoritative next-transformation id was supplied for this situation (recorded, never invented)" });
  return { next_transformation: uniq(next), routing: { next: uniq(next), unresolved, known_adjacent: [...known.keys()], journey_gap: journeyGap } };
}

// ------------------------------------------------------------------------------------------------
// research/evidence gap drafts (Phases F/G) — structured, persisted by harness/research-gaps.mjs
// ------------------------------------------------------------------------------------------------
/**
 * Turn the runner's ephemeral findings into structured gap DRAFTS (no id/timestamp — the gap
 * service owns the persisted record and stamps identity/time). Nothing is fabricated: each draft
 * restates a finding the runner already produced.
 */
export function collectGapDrafts({ opportunity, transformationId = null, missingInputs = [], missingEvidence = [], clinicalItems = [], applicability = null, routing = null }) {
  const drafts = [];
  const add = ({ domain, description, why, required, stage, severity, blocks = true, criteria = {}, evidence_refs = [] }) => drafts.push({
    domain,
    source_ref: norm(opportunity?.source ?? "") || null,
    opportunity_id: opportunity?.opportunity_id ?? null,
    transformation_id: transformationId ?? null,
    description: norm(description),
    why_it_matters: norm(why),
    required_evidence: norm(required),
    evidence_refs,
    blocking_stage: stage,
    severity,
    status: "OPEN",
    blocks_progression: blocks,
    resolution_criteria: criteria,
  });
  const domainFor = (m) => (/^situation\./.test(m) ? "CUSTOMER_TRUTH" : /research_evidence/.test(m) ? "SOURCE" : "MECHANISM");
  for (const m of missingInputs) {
    add({ domain: domainFor(m), description: m, why: "the canonical transformation nucleus cannot be completed without this", required: `authoritative research supplying ${m}`, stage: "TRANSFORMATION_CANDIDATE", severity: "high" });
  }
  for (const m of missingEvidence) {
    add({ domain: "MECHANISM", description: m, why: "without an observable change the record cannot progress beyond candidate", required: `sourced evidence of change for ${m}`, stage: "TRANSFORMATION_CANDIDATE", severity: "high" });
  }
  for (const c of clinicalItems) {
    add({ domain: "CLINICAL", description: c, why: "clinical/safety review is a human authority and cannot be self-approved", required: `authoritative literature satisfying ${c}`, stage: "PRODUCT_SPECIFICATION", severity: "high" });
  }
  for (const q of (applicability?.unresolved_questions ?? [])) {
    add({ domain: "APPLICABILITY", description: q, why: "unresolved applicability can cause inappropriate universalization", required: `applicability evidence resolving: ${q}`, stage: "PRODUCT_SPECIFICATION", severity: "medium", criteria: { requires_evidence: true } });
  }
  if (routing?.journey_gap) {
    add({ domain: "IMPLEMENTATION", description: "journey routing gap: no authoritative next transformation supplied", why: "journey integrity is required before product handoff", required: "authoritative adjacent transformation id(s)", stage: "PRODUCT_SPECIFICATION", severity: "low", blocks: false, criteria: { requires_evidence: false } });
  }
  return drafts;
}

// ------------------------------------------------------------------------------------------------
// main
// ------------------------------------------------------------------------------------------------
function reportBase(input) {
  return {
    architect_version: ARCHITECT_VERSION,
    status: null,
    transformation_id: null,
    schema_valid: false,
    missing_inputs: [],
    missing_evidence: [],
    unresolved_questions: [],
    owner_decisions: [],
    clinical_review_items: [],
    evidence_refs: [],
    routing: { next: [], unresolved: [], known_adjacent: [] },
    retained_findings: [],
    derivation_notes: [],
    warnings: [],
    would_collide: false,
    risk_level: null,
    risk_level_source: null,
    source: {
      opportunity_id: input?.opportunity?.opportunity_id ?? null,
      life_area: input?.opportunity?.life_area ?? null,
      submarket: input?.opportunity?.submarket ?? null,
      library_role: input?.opportunity?.disposition?.library_role ?? null,
    },
  };
}

function refused(status, report, extra = {}) {
  report.status = status;
  return { status, transformation_id: report.transformation_id, record: null, report, schema_valid: false, persisted: false, path: null, ...extra };
}

/**
 * Build a candidate Transformation Record from an eligible opportunity.
 * mode "dry-run" (default) never writes; mode "write" persists only a schema-valid candidate and never
 * overwrites an existing record (ALREADY_EXISTS).
 */
export function buildTransformationRecord(input = {}) {
  const report = reportBase(input);
  const { opportunity, research_evidence = [], library_map = null, adjacent_transformations = [], source_allowlist = [], next_transformation = [], owner_approved_threshold = null, sibling_opportunities = [], product_context = null } = input;
  const mode = input.mode === "write" ? "write" : "dry-run";
  const outDir = input.out_dir ? resolve(input.out_dir) : join(ROOT, "data", "transformations");

  // ---- input gate -------------------------------------------------------------------
  if (!opportunity || typeof opportunity !== "object") {
    report.missing_inputs.push("opportunity");
    return refused(RUN_STATUS.INVALID_INPUT, report);
  }
  const ov = validateOpportunity(opportunity);
  if (!ov.valid) {
    report.missing_inputs.push("opportunity (fails schemas/opportunity.schema.json)");
    report.unresolved_questions.push(...ov.errors);
    return refused(RUN_STATUS.INVALID_INPUT, report);
  }
  const role = opportunity.disposition?.library_role;
  if (!TRANSFORMATION_ELIGIBLE_ROLES.includes(role)) {
    report.missing_inputs.push(`disposition.library_role "${role ?? "(unset)"}" is not a transformation-eligible role`);
    return refused(RUN_STATUS.NOT_TRANSFORMATION_ELIGIBLE, report);
  }

  // ---- identity --------------------------------------------------------------------
  const transformationId = deriveTransformationId(opportunity);
  report.transformation_id = transformationId;
  if (!transformationId) {
    report.missing_inputs.push("transformation_id (no disposition.promoted_transformation_id and no derivable OPP-<LIB>-<THEME>-<NNN> id)");
    return refused(RUN_STATUS.INVALID_INPUT, report);
  }
  const targetPath = join(outDir, `${transformationId}.json`);
  report.would_collide = existsSync(targetPath);

  // ---- blocks ----------------------------------------------------------------------
  const situationRes = buildSituation(opportunity, library_map);
  const evidenceRes = resolveEvidence({ opportunity, research_evidence, source_allowlist });
  report.missing_inputs.push(...situationRes.missing, ...evidenceRes.rejected.map((r) => `research_evidence rejected: ${r.reason}`));

  // ---- applicability + globality (Phases C/D) ---------------------------------------
  // DESCRIPTIVE provenance (opportunity.provenance) never defines applicability; the analytical
  // classification is derived here (or taken from a declared record). Source geography is removed
  // from canonical identity ONLY when the transformation is not context-intrinsic.
  const applicabilityRes = deriveApplicability({
    nucleusText: situationNucleus(situationRes.situation),
    culturalContext: Array.isArray(opportunity.provenance?.cultural_context) ? opportunity.provenance.cultural_context : [],
    supplied: opportunity.applicability ?? null,
    evidenceRefs: uniq(opportunity.source_references ?? []),
    provenanceContext: opportunity.provenance ?? null,
  });
  const canonRes = canonicalizeSituation(situationRes.situation, applicabilityRes);
  const situation = canonRes.situation;
  if (canonRes.unresolved_questions.length) {
    applicabilityRes.unresolved_questions = [...new Set([...(applicabilityRes.unresolved_questions ?? []), ...canonRes.unresolved_questions])];
  }
  report.applicability = applicabilityRes;

  const beforeRes = buildBeforeState(opportunity, situation);
  report.missing_inputs.push(...beforeRes.empty);
  const afterRes = buildAfterState(opportunity, situation);
  const mechRes = buildMechanism(opportunity, evidenceRes.entries);
  if (!isStr(mechRes.mechanism.core_mechanism) || !mechRes.hypotheses.length) report.missing_inputs.push("mechanism (no mechanism_hypotheses in the opportunity record)");
  const pathRes = buildPath(mechRes.hypotheses);
  if (!pathRes.path.length) report.missing_inputs.push("transformation_path");
  if (pathRes.duplicates.length) report.warnings.push(`duplicate path stages removed: ${pathRes.duplicates.length}`);
  const failRes = buildFailureMap(opportunity, situation, mechRes.hypotheses);
  if (!failRes.failure_map.length) report.missing_inputs.push("failure_point_map (no documented failure signal with a non-generic rescue)");
  const firstWinRes = buildFirstWin(mechRes.hypotheses, afterRes.after_state, pathRes.path);
  if (!firstWinRes.first_win) report.missing_inputs.push(`first_win (${firstWinRes.reason})`);
  if (!afterRes.after_state.evidence_of_change.length) report.missing_evidence.push("after_state.evidence_of_change (validation rule 8: without it the record stays candidate-only)");

  const risk = resolveRiskLevel({ opportunity, research_evidence });
  report.risk_level = risk.risk_level;
  report.risk_level_source = risk.source;

  // ---- honest refusal (before any assembly that would look complete) ----------------
  if (report.missing_inputs.length) {
    report.unresolved_questions.push("The opportunity record does not support the mandatory Gate-1 transformation nucleus; return upstream for research rather than filling it in.");
    report.gaps = collectGapDrafts({ opportunity, transformationId, missingInputs: report.missing_inputs, missingEvidence: report.missing_evidence, applicability: applicabilityRes });
    return refused(RUN_STATUS.SOURCE_REQUIRED, report);
  }

  const safetyRes = buildSafety({ opportunity, resolvedEvidence: evidenceRes.entries, risk });
  report.clinical_review_items.push(...safetyRes.clinical_review_items);
  const routingRes = buildRouting({ next_transformation, adjacent_transformations, opportunity, selfId: transformationId });

  const maintenanceSeed = { reentry_protocol: `Re-enter at ${pathRes.path[0].stage} without a guilt reset` };
  const measurementDays = Array.isArray(input.measurement_days) && input.measurement_days.length && input.measurement_days.every((d) => Number.isInteger(d) && d >= 0)
    ? input.measurement_days
    : null;
  const tsmRes = buildTsm({
    opportunity, situation, beforeState: beforeRes.before_state,
    afterState: afterRes.after_state, failureMap: failRes.failure_map, maintenanceSeed,
    systems: afterRes.after_state.systems_created, measurementDays,
  });
  const maintenance = buildMaintenance({ failureMap: failRes.failure_map, path: pathRes.path, systems: afterRes.after_state.systems_created });
  const threshold = isStr(owner_approved_threshold)
    ? norm(owner_approved_threshold)
    : tsmRes.tsm.success_threshold;
  report.owner_decisions.push(isStr(owner_approved_threshold)
    ? `success_threshold supplied as owner-approved: ${norm(owner_approved_threshold)}`
    : "success_threshold left PENDING OWNER APPROVAL (business call, never auto-approved by this runner)");

  const record = {
    transformation_id: transformationId,
    library_id: opportunity.life_area,
    submarket_id: slug(`${opportunity.focus_market}-${situation.life_state}`),
    status: "candidate",
    situation,
    applicability: applicabilityRes,
    before_state: beforeRes.before_state,
    after_state: afterRes.after_state,
    mechanism: mechRes.mechanism,
    transformation_path: pathRes.path,
    failure_point_map: failRes.failure_map,
    first_win: firstWinRes.first_win,
    tsm: { ...tsmRes.tsm, success_threshold: threshold },
    maintenance,
    next_transformation: routingRes.next_transformation,
    evidence: [...evidenceRes.entries, ...mechRes.provenanceEvidence],
    safety: safetyRes.safety,
    research_disposition: {
      library_role: role,
      rationale: [
        norm(opportunity.disposition?.rationale ?? `Derived from ${opportunity.opportunity_id} (${role}).`),
        routingRes.next_transformation.length ? null : "Journey routing pending: no authoritative adjacent transformation id was supplied for this situation (recorded as a routing gap, not invented).",
        "Candidate generated by transformation-architect@1 from the opportunity record; promotion to validated is owner/validator authority.",
      ].filter(Boolean).join(" "),
      ...(opportunity.disposition?.assigned_at ? { assigned_at: opportunity.disposition.assigned_at } : {}),
      reclassification_history: [],
    },
  };

  // ---- schema validation (never write invalid output) -------------------------------
  const tv = validateTransformation(record);
  report.schema_valid = tv.valid;
  if (!tv.valid) {
    report.unresolved_questions.push(...tv.errors);
    return refused(RUN_STATUS.SCHEMA_INVALID, report);
  }

  // ---- evidence + finding retention bookkeeping -------------------------------------
  report.evidence_refs = uniq(record.evidence.map((e) => e.source).filter(Boolean).concat(norm(opportunity.source ?? "")));
  report.retained_findings = (Array.isArray(sibling_opportunities) ? sibling_opportunities : [])
    .filter((s) => s?.opportunity_id && s.opportunity_id !== opportunity.opportunity_id)
    .map((s) => ({
      opportunity_id: s.opportunity_id,
      library_role: s.disposition?.library_role ?? s.role ?? null,
      status: s.status ?? null,
      note: "retained in the opportunity store (no research is discarded); not part of this transformation nucleus",
    }));
  report.routing = routingRes.routing;
  if (!routingRes.routing.next.length) report.unresolved_questions.push("journey routing: no next transformation resolved from the supplied context");
  if (product_context && typeof product_context === "object") {
    const linked = product_context.identity?.transformation_id ?? null;
    if (linked === transformationId) report.warnings.push(`an existing product record already references ${transformationId} (informational only; the runner never mutates product records)`);
    else report.warnings.push("product_context supplied but not linked to this transformation (context only, never mutated)");
  }
  report.derivation_notes.push(
    "life_state derived deterministically from the submarket clause (slug).",
    "timeframe/constraints/people_involved extracted as verbatim spans from the opportunity text.",
    `first_win.time_limit_minutes = ${FIRST_WIN_DEFAULT_MINUTES} (schema default; owner/validator may adjust).`,
    measurementDays ? `tsm.measurement_days = [${measurementDays.join(", ")}] (supplied timing preserved).` : `tsm.measurement_days = [${DEFAULT_MEASUREMENT_DAYS.join(", ")}] (schema default).`,
    "mechanism/path/failure rescues are composed from the opportunity's own mechanism_hypotheses (verbatim); no mechanism was invented.",
    `risk_level ${risk.risk_level} from ${risk.source} (may only raise review, never lower it).`,
    `applicability ${applicabilityRes.classification} (${applicabilityRes.classification_source}); canonical nucleus ${canonRes.changed ? `decontextualized: ${canonRes.changed_fields.join(", ")}` : "unchanged"}.`,
  );

  // ---- semantic catalogue comparison (Phase E) --------------------------------------
  // Pure over the supplied catalogue: never merges, never deletes. An equivalent or ambiguous
  // nucleus is refused, so the factory never creates a second canonical transformation automatically.
  const catalogue = Array.isArray(input.existing_transformations) ? input.existing_transformations : [];
  const dedupe = decideCatalogueOutcome({
    nucleusText: situationNucleus(record.situation),
    existing: catalogue,
    selfId: transformationId,
    classification: applicabilityRes.classification,
  });
  report.dedupe = dedupe;
  if (dedupe.best && dedupe.best.similarity >= COUNTRY_CLONE_THRESHOLD) {
    report.warnings.push(`existing canonical transformation ${dedupe.best.transformation_id} already carries this nucleus (similarity ${dedupe.best.similarity}); no new record created`);
    report.gaps = collectGapDrafts({ opportunity, transformationId, missingEvidence: report.missing_evidence, clinicalItems: report.clinical_review_items, applicability: applicabilityRes, routing: routingRes.routing });
    return refused(RUN_STATUS.EXISTING_TRANSFORMATION_MATCH, report, { schema_valid: true, matched: dedupe.best });
  }
  if (dedupe.outcome === APPLICABILITY_OUTCOMES.POSSIBLE_DUPLICATE_REVIEW_REQUIRED) {
    report.unresolved_questions.push(`possible duplicate of ${dedupe.best.transformation_id} (similarity ${dedupe.best.similarity}); review required before creating a new canonical transformation`);
    report.gaps = collectGapDrafts({ opportunity, transformationId, missingEvidence: report.missing_evidence, clinicalItems: report.clinical_review_items, applicability: applicabilityRes, routing: routingRes.routing });
    return refused(RUN_STATUS.POSSIBLE_DUPLICATE_REVIEW_REQUIRED, report, { schema_valid: true, matched: dedupe.best });
  }

  // ---- research/evidence gap drafts (Phases F/G) ------------------------------------
  report.gaps = collectGapDrafts({ opportunity, transformationId, missingEvidence: report.missing_evidence, clinicalItems: report.clinical_review_items, applicability: applicabilityRes, routing: routingRes.routing });

  // ---- persistence ----------------------------------------------------------------
  let persisted = false;
  if (mode === "write") {
    if (report.would_collide) {
      report.warnings.push(`refused to overwrite existing record at ${targetPath}`);
      return { status: RUN_STATUS.ALREADY_EXISTS, transformation_id: transformationId, record: null, report, schema_valid: true, persisted: false, path: targetPath };
    }
    mkdirSync(outDir, { recursive: true });
    writeFileSync(targetPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    persisted = true;
  }

  report.status = RUN_STATUS.CANDIDATE_READY;
  return { status: RUN_STATUS.CANDIDATE_READY, transformation_id: transformationId, record, report, schema_valid: true, persisted, path: persisted ? targetPath : null };
}

/** Convenience alias used by the CLI and harness. */
export const runTransformationArchitect = buildTransformationRecord;

// ------------------------------------------------------------------------------------------------
// globality invariant (global-by-default factory rule — deterministic helpers only)
// ------------------------------------------------------------------------------------------------
// The geography primitives live in harness/globality.mjs (shared with the applicability engine)
// and are re-exported here so the existing public surface is unchanged.
export { GEOGRAPHY_TOKENS, extractGeographyTokens, stripGeographyTokens, nucleusSimilarity, COUNTRY_CLONE_THRESHOLD, sameNucleusModuloContext };

// ------------------------------------------------------------------------------------------------
// CLI
// ------------------------------------------------------------------------------------------------
const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const get = (flag) => { const i = args.indexOf(flag); return i > -1 ? args[i + 1] : null; };
  const oppPath = get("--opportunity");
  if (!oppPath) {
    console.error("usage: node harness/transformation-architect.mjs --opportunity <record.json> [--write] [--out-dir <dir>] [--routes A,B] [--adjacent a.json,b.json]");
    process.exit(2);
  }
  const readJson = (p) => JSON.parse(readFileSync(resolve(p), "utf8"));
  const opportunity = readJson(oppPath);
  const adjacent = (get("--adjacent") ?? "").split(",").filter(Boolean).map(readJson);
  const libPath = get("--library");
  const result = buildTransformationRecord({
    opportunity,
    library_map: libPath ? readJson(libPath) : null,
    adjacent_transformations: adjacent,
    next_transformation: (get("--routes") ?? "").split(",").filter(Boolean),
    mode: args.includes("--write") ? "write" : "dry-run",
    out_dir: get("--out-dir") ?? undefined,
    sibling_opportunities: (get("--siblings") ?? "").split(",").filter(Boolean).map(readJson),
  });
  const summary = {
    status: result.status,
    transformation_id: result.transformation_id,
    schema_valid: result.schema_valid,
    persisted: result.persisted,
    missing_inputs: result.report.missing_inputs,
    missing_evidence: result.report.missing_evidence,
    owner_decisions: result.report.owner_decisions,
    clinical_review_items: result.report.clinical_review_items,
    evidence_refs: result.report.evidence_refs,
    routing: result.report.routing,
    warnings: result.report.warnings,
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exit(result.status === RUN_STATUS.CANDIDATE_READY || result.status === RUN_STATUS.SOURCE_REQUIRED ? 0 : 1);
}
