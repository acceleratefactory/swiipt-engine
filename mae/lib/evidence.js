// MAE lib · evidence state (S2 §6, §13). Observed / inferred / hypothesised are NOT equivalent.
// Promotion is one-directional and must be explicit + sourced. A downstream object must never
// assert more certainty than its source.

export const EVIDENCE_STATE = {
  DIRECTLY_STATED: "directly_stated",
  STRONGLY_EVIDENCED: "strongly_evidenced",
  ANALYST_INTERPRETATION: "analyst_interpretation",
  HYPOTHESIS: "hypothesis",
};

export const EVIDENCE_RANK = {
  hypothesis: 1,
  analyst_interpretation: 2,
  strongly_evidenced: 3,
  directly_stated: 4,
};

export const isObserved = (s) => s === EVIDENCE_STATE.DIRECTLY_STATED || s === EVIDENCE_STATE.STRONGLY_EVIDENCED;
export const isValidState = (s) => Object.prototype.hasOwnProperty.call(EVIDENCE_RANK, s);

/**
 * Assert a downstream claim does not exceed its source's evidence strength.
 * Promoting (source weaker than claim) requires `promotionSource` (a stronger cited record).
 * @returns {{ok:boolean, promoted:boolean, reason:string}}
 */
export function assertNoUnsupportedCertainty(sourceState, claimState, promotionSource = null) {
  if (!isValidState(sourceState) || !isValidState(claimState)) {
    return { ok: false, promoted: false, reason: "unknown evidence state" };
  }
  if (EVIDENCE_RANK[claimState] <= EVIDENCE_RANK[sourceState]) return { ok: true, promoted: false, reason: "at or below source certainty" };
  const promoted = !!promotionSource;
  return {
    ok: promoted,
    promoted,
    reason: promoted ? `explicit promotion citing ${promotionSource}` : `claim (${claimState}) exceeds source (${sourceState}) without a promotion source`,
  };
}

/** A promotion is only legitimate if the promotion source is itself at least as strong as the claim. */
export function validPromotion(promotionSourceState, claimState) {
  return isValidState(promotionSourceState) && EVIDENCE_RANK[promotionSourceState] >= EVIDENCE_RANK[claimState];
}
