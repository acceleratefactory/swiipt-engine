#!/usr/bin/env node
// SWIIPT APPLICABILITY + CANONICALIZATION ENGINE (research-to-transformation pipeline V1).
//
// Separates DESCRIPTIVE provenance from ANALYTICAL applicability (task §6.1):
//   - provenance (source/population/geography/limitations) lives on the research record;
//   - applicability (UNIVERSAL_CORE / CONTEXT_VARIABLE / CONTEXT_INTRINSIC) is the factory's
//     analytical determination of whether the Transformation contract materially depends on
//     geography/culture/jurisdiction.
//
// Deterministic. No provider, no network, no time, no randomness. Detection lexicons are
// NOT a privileged country list: the geography vocabulary lives in globality.mjs and the
// classification logic never names a country.
import { GEOGRAPHY_TOKENS, extractGeographyTokens, nucleusSimilarity } from "./globality.mjs";

export const APPLICABILITY = Object.freeze({
  UNIVERSAL_CORE: "UNIVERSAL_CORE",
  CONTEXT_VARIABLE: "CONTEXT_VARIABLE",
  CONTEXT_INTRINSIC: "CONTEXT_INTRINSIC",
});

/** Semantic catalogue-comparison outcomes (task §9.1 — existing states reused where possible). */
export const APPLICABILITY_OUTCOMES = Object.freeze({
  NEW_TRANSFORMATION: "NEW_TRANSFORMATION",
  EXISTING_TRANSFORMATION_MATCH: "EXISTING_TRANSFORMATION_MATCH",
  POSSIBLE_DUPLICATE_REVIEW_REQUIRED: "POSSIBLE_DUPLICATE_REVIEW_REQUIRED",
  CONTEXT_VARIANT_OF_EXISTING: "CONTEXT_VARIANT_OF_EXISTING",
  CONTEXT_INTRINSIC_DISTINCT: "CONTEXT_INTRINSIC_DISTINCT",
});

/** Similarity floor for "possible duplicate -> review" (calibrated: live catalogue max 0.151). */
export const POSSIBLE_DUPLICATE_FLOOR = 0.6;

const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const words = (s) => norm(s).split(/\s+/).filter(Boolean);

// Materiality signal: a geography token adjacent to one of these is jurisdictionally material
// ("Nigerian statutory maternity entitlement") and must never be treated as incidental context.
const MATERIAL_NOUNS = /\b(statut\w*|legislat\w*|(?<!-)\blaws?\b|legal|regulat\w*|entitle\w*|maternity (?:leave|pay|entitlement|allowance)|paternity leave|parental leave|labour act|labor act|minimum wage|tax|taxation|visa|immigration|citizenship|nhs|medicare|medicaid|healthcare system|insurance mandate|court|jurisdiction|licens\w*|certification|curriculum|school system|welfare)\b/i;

// Culture lexicon — detection-only, deliberately small and clearly extensible. Culture is
// never geography; these terms mark a materially cultural mechanism that must be preserved.
const CULTURE_LEXICON = Object.freeze([
  "omugwo", "outdooring", "naming ceremony", "lying-in", "sitting month", "confinement",
  "postpartum confinement", "zuoyuezi", "la cuarentena", "ayurvedic", "aso-ebi", "owambe",
  "matrilineal", "patrilineal", "bride price", "dowry", "native doctor", "traditional healer",
  "mother-in-law", "eldest daughter", "ancestral", "ceremony", "rite",
]);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Context-variable signal: currency/prices/services/units/law-adjacent items that vary by
// context but do not by themselves redefine the Transformation contract.
const CONTEXT_SIGNALS = /\b(currency|currencies|money|costs?|fees?|salary|salaries|income|wage|wages|earnings|exchange rate|bank|banking|payment|budget|services?|hospital|clinic|healthcare|insurance|school|childcare|cr[eè]che|nursery|transport|public transport|market|availability|unit|units|metric|imperial|language|household structure)\b/i;

/** The analytical nucleus of a canonical situation (person + situation + trigger + problem + desired change). */
export function situationNucleus(situation) {
  if (!situation || typeof situation !== "object") return "";
  return [
    situation.person, situation.specific_situation, situation.trigger, situation.problem, situation.desired_transformation,
  ].filter((s) => typeof s === "string" && s.trim()).join(" ");
}

/** True when any occurrence of a geography token sits within a short window of a material noun. */
function materialGeography(text, geoToken) {
  const t = norm(text);
  const re = new RegExp(`\\b${escapeRe(geoToken)}\\b`, "gi");
  let m;
  while ((m = re.exec(t)) !== null) {
    const start = Math.max(0, m.index - 60);
    const end = Math.min(t.length, m.index + geoToken.length + 60);
    if (MATERIAL_NOUNS.test(t.slice(start, end))) return true;
  }
  return false;
}

/**
 * Derive the analytical applicability classification.
 * A declared classification on the record is authoritative and is preserved verbatim.
 */
export function deriveApplicability({ nucleusText = "", culturalContext = [], supplied = null, evidenceRefs = [], sourceContext = null, provenanceContext = null } = {}) {
  const text = norm(nucleusText);
  const descriptive = provenanceContext && typeof provenanceContext === "object"
    ? [provenanceContext.source_label, provenanceContext.geography, provenanceContext.jurisdiction, provenanceContext.population, ...(Array.isArray(provenanceContext.cultural_context) ? provenanceContext.cultural_context : [])].filter((s) => typeof s === "string" && s.trim()).join(" | ")
    : "";
  const src = sourceContext == null ? (descriptive ? `${text} | ${descriptive}` : text) : norm(sourceContext);
  if (supplied && APPLICABILITY[supplied.classification]) {
    return {
      classification: supplied.classification,
      basis: norm(supplied.basis) || "declared on the research record",
      intrinsic_dimensions: Array.isArray(supplied.intrinsic_dimensions) ? supplied.intrinsic_dimensions : [],
      context_variables: Array.isArray(supplied.context_variables) ? supplied.context_variables : [],
      evidence_refs: Array.isArray(supplied.evidence_refs) ? supplied.evidence_refs : [],
      uncertainty: norm(supplied.uncertainty) || "declared",
      unresolved_questions: Array.isArray(supplied.unresolved_questions) ? supplied.unresolved_questions : [],
      classification_source: "declared",
      source_context: src,
    };
  }

  const geoTokens = extractGeographyTokens(text);
  const jurisdictionHits = [...new Set((text.match(new RegExp(MATERIAL_NOUNS.source, "gi")) || []).map((s) => s.toLowerCase()))];
  const cultureHits = CULTURE_LEXICON.filter((c) => new RegExp(`\\b${escapeRe(c)}\\b`, "i").test(text));
  const contextHits = [...new Set((text.match(new RegExp(CONTEXT_SIGNALS.source, "gi")) || []).map((s) => s.toLowerCase()))];
  const hardJurisdiction = geoTokens.some((g) => materialGeography(text, g));

  const base = {
    intrinsic_dimensions: [], context_variables: [], evidence_refs: evidenceRefs,
    classification_source: "derived", source_context: src,
  };

  if (cultureHits.length) {
    return {
      ...base,
      classification: APPLICABILITY.CONTEXT_INTRINSIC,
      basis: `material culture detected: ${cultureHits.join(", ")}`,
      intrinsic_dimensions: cultureHits.map((c) => `culture:${c}`),
      uncertainty: "low",
      unresolved_questions: [],
    };
  }
  if (hardJurisdiction || jurisdictionHits.length) {
    const dims = [...new Set([...(geoTokens.length ? geoTokens.map((g) => `jurisdiction:${g}`) : []), ...jurisdictionHits.map((j) => `jurisdiction:${j}`)])];
    return {
      ...base,
      classification: APPLICABILITY.CONTEXT_INTRINSIC,
      basis: `jurisdictional dependency detected: ${jurisdictionHits.join(", ") || geoTokens.join(", ")}`,
      intrinsic_dimensions: dims,
      uncertainty: geoTokens.length ? "medium" : "low",
      unresolved_questions: geoTokens.length
        ? [`confirm the applicable jurisdiction(s) for ${geoTokens.join(", ")} before product use`]
        : [],
    };
  }
  if (geoTokens.length && culturalContext.length) {
    return {
      ...base,
      classification: APPLICABILITY.CONTEXT_VARIABLE,
      basis: `source context recorded (${geoTokens.join(", ")}) with declared cultural context; no material mechanism dependency detected`,
      context_variables: contextHits,
      uncertainty: "medium",
      unresolved_questions: [`confirm whether ${geoTokens.join(", ")} is incidental or materially defines the transformation`],
    };
  }
  if (contextHits.length) {
    return {
      ...base,
      classification: APPLICABILITY.CONTEXT_VARIABLE,
      basis: `context-variable factors detected (${contextHits.join(", ")}); one canonical transformation with context-aware delivery`,
      context_variables: contextHits,
      uncertainty: geoTokens.length ? "medium" : "low",
      unresolved_questions: geoTokens.length ? [`confirm whether ${geoTokens.join(", ")} is incidental or material`] : [],
    };
  }
  if (geoTokens.length) {
    return {
      ...base,
      classification: APPLICABILITY.CONTEXT_VARIABLE,
      basis: `source geography appears in the nucleus (${geoTokens.join(", ")}) with no material mechanism dependency detected`,
      context_variables: [],
      uncertainty: "medium",
      unresolved_questions: [`confirm whether ${geoTokens.join(", ")} is incidental or materially defines the transformation`],
    };
  }
  return {
    ...base,
    classification: APPLICABILITY.UNIVERSAL_CORE,
    basis: "no identified material dependency on geography, culture or jurisdiction in the current evidence",
    uncertainty: "low",
    unresolved_questions: [],
  };
}

const DANGLING = /^(?:in|at|from|to|within|across|based|of|in the|from the|or|and|or the|and the)$/i;
// Artifacts that mean a removal left a broken fragment: never persist such a field.
const CORRUPT = /(\s\/|\/\s|,\s*,|\bor the\b|\band the\b|\bin \/|\b(in|at|from|to|of|within|across|or|and)[\s,.;:]*$)/i;
function decontextualizeField(text, geoTokens) {
  if (!geoTokens.length) return { value: text, changed: false };
  let out = norm(text);
  for (const g of geoTokens) out = out.replace(new RegExp(`\\b${escapeRe(g)}\\b`, "gi"), " ");
  out = norm(out).replace(/\s+([.,;:])/g, "$1").replace(/\s*\/\s*/g, " / ").replace(/\s+/g, " ").trim();
  // if the removal left a dangling locative tail, drop that tail rather than persist a fragment
  const tail = out.split(/[.,;:]/).pop().trim();
  if (tail && DANGLING.test(tail)) out = norm(out.slice(0, out.length - tail.length)).replace(/\s+([.,;:])/g, "$1");
  out = norm(out);
  if (!out || words(out).length < 3) return { value: text, changed: false, gutted: true };
  if (CORRUPT.test(out)) return { value: text, changed: false, gutted: true };   // broken fragment -> never store
  return { value: out, changed: out !== norm(text) };
}

/**
 * Canonicalize the situation nucleus for an applicability classification.
 * - CONTEXT_INTRINSIC: never decontextualized (culture/jurisdiction materially defines it).
 * - UNIVERSAL_CORE / CONTEXT_VARIABLE: incidental source geography is removed from the
 *   canonical identity fields while the original wording is preserved in applicability.source_context.
 * NEVER deletes blindly: only geography tokens are removed, and only when the field survives intact.
 */
export function canonicalizeSituation(situation, applicability) {
  const out = { ...situation };
  const changedFields = [];
  const unresolved = Array.isArray(applicability?.unresolved_questions) ? [...applicability.unresolved_questions] : [];
  if (!applicability || applicability.classification === APPLICABILITY.CONTEXT_INTRINSIC) {
    return { situation: out, changed: false, changed_fields: [], unresolved_questions: unresolved };
  }
  const fields = ["person", "specific_situation", "trigger", "problem", "desired_transformation"];
  for (const f of fields) {
    const raw = out[f];
    if (typeof raw !== "string" || !raw.trim()) continue;
    const geo = extractGeographyTokens(raw);
    if (!geo.length) continue;
    const res = decontextualizeField(raw, geo);
    if (res.changed) { out[f] = res.value; changedFields.push(f); }
    else if (res.gutted) unresolved.push(`cannot safely decontextualize ${f}: geography (${geo.join(", ")}) appears materially embedded; manual review required`);
  }
  return { situation: out, changed: changedFields.length > 0, changed_fields: changedFields, unresolved_questions: [...new Set(unresolved)] };
}

/**
 * Compare a candidate nucleus against existing canonical transformations.
 * Pure; never mutates or merges. Returns the best matches and the governed outcome.
 */
export function decideCatalogueOutcome({ nucleusText, existing = [], selfId = null, classification = null }) {
  const matches = [];
  for (const tr of Array.isArray(existing) ? existing : []) {
    if (!tr || !tr.transformation_id || tr.transformation_id === selfId) continue;
    const sim = nucleusSimilarity(nucleusText, situationNucleus(tr.situation));
    if (sim > 0) matches.push({ transformation_id: tr.transformation_id, similarity: Number(sim.toFixed(4)) });
  }
  const bySim = matches.filter((m) => m.similarity >= POSSIBLE_DUPLICATE_FLOOR).sort((a, b) => b.similarity - a.similarity);
  const best = bySim[0] ?? null;
  if (!best) return { outcome: APPLICABILITY_OUTCOMES.NEW_TRANSFORMATION, best: null, candidates: [] };
  if (best.similarity >= 0.85) {
    const intrinsic = classification === APPLICABILITY.CONTEXT_INTRINSIC;
    return {
      outcome: intrinsic ? APPLICABILITY_OUTCOMES.CONTEXT_INTRINSIC_DISTINCT : APPLICABILITY_OUTCOMES.CONTEXT_VARIANT_OF_EXISTING,
      best, candidates: bySim,
    };
  }
  return { outcome: APPLICABILITY_OUTCOMES.POSSIBLE_DUPLICATE_REVIEW_REQUIRED, best, candidates: bySim };
}
