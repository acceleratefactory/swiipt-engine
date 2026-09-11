// MAE · Critic adapter (S11 §69/§70, S7 §7.3). Judgment is delegated to a replaceable,
// dormant-by-default evaluator. Absence of a provider yields NOT_RUN — never a fake PASS.
export const CRITIC_STATE = {
  NOT_RUN: "NOT_RUN",
  RAN: "RAN",
  UNAVAILABLE: "PROVIDER_UNAVAILABLE",
};

const provider = () => (process.env.MAE_CRITIC_API_KEY || process.env.OPENAI_API_KEY) ? "openai-critic" : null;

export const CriticAdapter = {
  configured() { return provider() !== null; },
  /**
   * Evaluate a judgment task. Returns {run, state, verdict(boolean|null), reasons[]}.
   * Dormant: {run:false, state:NOT_RUN, verdict:null}. The caller must not treat null as PASS.
   */
  evaluate(task, payload = {}) {
    const p = provider();
    if (!p) return { run: false, state: CRITIC_STATE.NOT_RUN, verdict: null, reasons: [`critic not configured; '${task}' left to human review`], provider: null };
    // A configured provider would be called here. The architecture is complete; the call is external.
    return { run: false, state: CRITIC_STATE.UNAVAILABLE, verdict: null, reasons: [`${p} adapter not implemented in V1 runtime`], provider: p, payload_keys: Object.keys(payload) };
  },
};
