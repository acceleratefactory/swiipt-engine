// Swiipt · Deterministic evidence / provenance checker.
//
// Core rule (Part E): THE EXISTENCE OF EVIDENCE IS A SYSTEM PROPERTY, NOT AN LLM CONFIDENCE JUDGMENT.
//
// The qualified Mistral critic has a known invented-evidence miss. The mitigation is NOT another LLM —
// it is this deterministic chain, which is authoritative over any critic/supervisor inference:
//
//   CLAIM -> requires evidence? -> source reference exists? -> source supports claim?
//         -> evidence classification valid? -> safety boundary respected? -> OK
//
// Failure -> SOURCE_REQUIRED (or BLOCK/HUMAN_REVIEW for safety). Missing evidence can never become PASS.
// No model is called here; no provider client is imported.
export const EVIDENCE_RESULTS = Object.freeze({
  OK: "OK",
  SOURCE_REQUIRED: "SOURCE_REQUIRED",
  BLOCK: "BLOCK",
  HUMAN_REVIEW: "HUMAN_REVIEW",
});

// Evidence classifications accepted by the factory evidence model (safety-relevant classes listed apart).
export const VALID_EVIDENCE_CLASSES = Object.freeze([
  "research-backed",
  "clinically-reviewed",
  "community-reported",
  "anecdotal",
  "expert-reviewed",
  "source-backed",
]);

// Classes strong enough to support a safety/clinical-adjacent claim.
export const SAFETY_SUPPORTING_CLASSES = Object.freeze(["clinically-reviewed", "research-backed", "expert-reviewed"]);

/**
 * Evaluate ONE claim against deterministic sources.
 * @param {object} claim { id, requires_evidence, source_ref, safety_relevant, critic_confidence? }
 * @param {object} sources map: source_id -> { classification, supports?: [claim_id], exists?: boolean }
 */
export function evaluateClaim(claim = {}, sources = {}) {
  const id = claim.id ?? "(unnamed)";

  // Not every claim requires evidence. But if it does, the chain is mandatory.
  if (claim.requires_evidence !== true) {
    return { claim_id: id, result: EVIDENCE_RESULTS.OK, reason: "claim does not require evidence" };
  }

  const ref = claim.source_ref;
  if (!ref) {
    return { claim_id: id, result: EVIDENCE_RESULTS.SOURCE_REQUIRED, reason: "claim requires evidence but declares no source reference" };
  }

  const src = sources[ref];
  if (!src || src.exists === false) {
    // Critic confidence is deliberately ignored here: plausibility/confidence is not evidence.
    return { claim_id: id, result: EVIDENCE_RESULTS.SOURCE_REQUIRED, reason: `source '${ref}' does not exist in the approved source set` };
  }

  if (!src.classification || !VALID_EVIDENCE_CLASSES.includes(src.classification)) {
    return { claim_id: id, result: EVIDENCE_RESULTS.SOURCE_REQUIRED, reason: `source '${ref}' has no valid evidence classification` };
  }

  const supports = Array.isArray(src.supports) ? src.supports : null;
  if (supports && !supports.includes(id) && !supports.includes(ref)) {
    return { claim_id: id, result: EVIDENCE_RESULTS.SOURCE_REQUIRED, reason: `source '${ref}' does not declare support for claim '${id}'` };
  }

  if (claim.safety_relevant === true && !SAFETY_SUPPORTING_CLASSES.includes(src.classification)) {
    return { claim_id: id, result: EVIDENCE_RESULTS.BLOCK, reason: `safety-relevant claim supported only by '${src.classification}' evidence — not a safety-supporting class` };
  }

  return { claim_id: id, result: EVIDENCE_RESULTS.OK, reason: `traceable to '${ref}' (${src.classification})` };
}

/** Evaluate a set of claims. Overall = BLOCK > SOURCE_REQUIRED > HUMAN_REVIEW > OK. */
export function evaluateClaims(claims = [], sources = {}) {
  const results = claims.map((c) => evaluateClaim(c, sources));
  const rank = { [EVIDENCE_RESULTS.BLOCK]: 3, [EVIDENCE_RESULTS.SOURCE_REQUIRED]: 2, [EVIDENCE_RESULTS.HUMAN_REVIEW]: 1, [EVIDENCE_RESULTS.OK]: 0 };
  let overall = EVIDENCE_RESULTS.OK;
  for (const r of results) if (rank[r.result] > rank[overall]) overall = r.result;
  return { overall, results, pass: overall === EVIDENCE_RESULTS.OK, publish_allowed: overall === EVIDENCE_RESULTS.OK };
}

/**
 * Guard demonstrating the principle: a critic/supervisor confidence signal (or claim of support) is not
 * evidence and cannot manufacture provenance. Always returns false unless a real source reference exists.
 */
export function criticConfidenceIsNotEvidence({ claim = {}, sources = {} } = {}) {
  const confident = Number(claim.critic_confidence ?? 0) >= 0.5 || claim.critic_says_supported === true;
  if (!confident) return false;
  const ref = claim.source_ref;
  const src = ref ? sources[ref] : null;
  const realSource = !!(src && src.exists !== false && VALID_EVIDENCE_CLASSES.includes(src.classification));
  return realSource; // false when only model confidence exists
}
