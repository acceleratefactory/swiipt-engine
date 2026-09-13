// Swiipt · Pre-Revenue Text Intelligence Operating Mode (routing layer).
//
// This module is an OPERATING-MODE change, not an architecture redesign:
//   generator -> deterministic QA -> primary critic -> escalation -> [premium supervisor | human review]
//
// The Premium Supervisor is NOT removed. It remains the PERMANENT adjudication layer for the difficult
// minority of cases. In PRE_REVENUE mode its invocations are replaced by HUMAN_REVIEW, because paid
// premium inference is not justified before revenue. Deferred, not deleted/disabled/mocked/marked PASS.
//
// Hard guarantees (see tests):
//   - PRE_REVENUE never invokes a supervisor and never fabricates a supervisor result.
//   - A supervisor result is never PASS (the result is null when deferred).
//   - DETERMINISTIC_BLOCK is authoritative; no LLM routes it to CONTINUE.
//   - HUMAN_REVIEW is a real blocking state; publication is blocked until a human resolves it.
//   - No provider call happens here — this module imports no provider client and calls no model.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ESCALATION_CLASSES,
  classifyEscalation,
  SUPERVISOR_OPTIONAL_ENABLED,
  MAX_REVISIONS,
} from "../bench/supervisor-bench.mjs";

const here = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CONFIG_PATH = join(here, "..", "config", "text-intelligence.v1.json");

// ---- canonical vocabularies -------------------------------------------------
export const TEXT_INTELLIGENCE_MODES = Object.freeze({
  PRE_REVENUE: "PRE_REVENUE",
  REVENUE: "REVENUE",
});

export const ROUTING_ACTIONS = Object.freeze({
  CONTINUE: "CONTINUE",
  BLOCK: "BLOCK",
  HUMAN_REVIEW: "HUMAN_REVIEW",
  SUPERVISOR: "SUPERVISOR",
});

export const HUMAN_REVIEW_STATES = Object.freeze(["PENDING_HUMAN_REVIEW", "RESOLVED", "BLOCKED"]);

export const SUPERVISOR_ARCHITECTURAL_ROLE = "PERMANENT";
export const SUPERVISOR_DEFERRED_STATUS = "DEFERRED_UNTIL_REVENUE";
export const SUPERVISOR_FALLBACK = "HUMAN_REVIEW";
export const DEFERRED_REASON = "PREMIUM_SUPERVISOR_DEFERRED_UNTIL_REVENUE";

export const OPERATING_STATUSES = Object.freeze({
  ACTIVE_INCUMBENT: "ACTIVE_INCUMBENT",
  QUALIFIED_PRIMARY_CRITIC: "QUALIFIED_PRIMARY_CRITIC",
  AUTHORITATIVE: "AUTHORITATIVE",
  DEFERRED_UNTIL_REVENUE: "DEFERRED_UNTIL_REVENUE",
});

// Honest-status guard: these are forbidden as supervisor results. A deferred supervisor produces NO
// result; a non-deferred supervisor may only produce a validated decision object, never a blanket PASS.
export const FORBIDDEN_SUPERVISOR_RESULTS = Object.freeze([
  "PASS",
  "SUPERVISOR_PASS",
  "SUPERVISOR_SKIPPED_PASS",
  "AUTO_APPROVED",
  "ASSUMED_SAFE",
  "EVIDENCE_CONFIRMED_BY_MODEL",
]);

export { ESCALATION_CLASSES, classifyEscalation, SUPERVISOR_OPTIONAL_ENABLED, MAX_REVISIONS };

// ---- config -----------------------------------------------------------------
export function loadTextIntelligenceConfig(path = DEFAULT_CONFIG_PATH) {
  const p = path || DEFAULT_CONFIG_PATH;
  if (!existsSync(p)) throw new Error(`text-intelligence config not found: ${p}`);
  return JSON.parse(readFileSync(p, "utf8"));
}

export function supervisorOperatingStatus(config = loadTextIntelligenceConfig()) {
  const s = config?.premium_supervisor ?? {};
  return {
    architectural_role: s.architectural_role ?? SUPERVISOR_ARCHITECTURAL_ROLE,
    status: s.status ?? SUPERVISOR_DEFERRED_STATUS,
    fallback: s.fallback ?? SUPERVISOR_FALLBACK,
    activation_condition: s.activation_condition ?? null,
    framework: s.framework ?? null,
  };
}

// ---- escalation routing -----------------------------------------------------
// Pure/deterministic. No model call. Returns a routing decision record.
export function routeEscalation(classification, opts = {}) {
  const mode = opts.mode ?? TEXT_INTELLIGENCE_MODES.PRE_REVENUE;
  if (!ESCALATION_CLASSES.includes(classification)) {
    return {
      classification,
      mode,
      action: ROUTING_ACTIONS.HUMAN_REVIEW,
      publish_allowed: false,
      human_review_required: true,
      supervisor_invoked: false,
      supervisor_result: null,
      reason: `unknown escalation classification '${classification}' — routed to human review (never auto-continue)`,
    };
  }

  const base = { classification, mode, supervisor_invoked: false, supervisor_result: null };

  switch (classification) {
    case "NO_ESCALATION":
      return { ...base, action: ROUTING_ACTIONS.CONTINUE, publish_allowed: true, human_review_required: false, reason: "no escalation signal" };

    case "DETERMINISTIC_BLOCK":
      // Authoritative. No LLM (critic or supervisor) can override a deterministic block.
      return { ...base, action: ROUTING_ACTIONS.BLOCK, publish_allowed: false, human_review_required: false, reason: "deterministic block is authoritative" };

    case "HUMAN_REVIEW_REQUIRED":
      return { ...base, action: ROUTING_ACTIONS.HUMAN_REVIEW, publish_allowed: false, human_review_required: true, reason: opts.reason ?? "escalation classification requires human review" };

    case "SUPERVISOR_REQUIRED": {
      const supervisorUsable = mode === TEXT_INTELLIGENCE_MODES.REVENUE && opts.supervisor_qualified === true;
      if (supervisorUsable) {
        return { classification, mode, action: ROUTING_ACTIONS.SUPERVISOR, publish_allowed: false, human_review_required: false, supervisor_invoked: true, supervisor_result: null, reason: "required escalation — premium supervisor (qualified)" };
      }
      return { ...base, action: ROUTING_ACTIONS.HUMAN_REVIEW, publish_allowed: false, human_review_required: true, reason: DEFERRED_REASON };
    }

    case "SUPERVISOR_OPTIONAL": {
      // Preserve existing semantics: optional escalations are off by default (cost control).
      if (mode === TEXT_INTELLIGENCE_MODES.REVENUE && opts.supervisor_qualified === true && SUPERVISOR_OPTIONAL_ENABLED) {
        return { classification, mode, action: ROUTING_ACTIONS.SUPERVISOR, publish_allowed: false, human_review_required: false, supervisor_invoked: true, supervisor_result: null, reason: "optional escalation enabled (revenue mode)" };
      }
      if (opts.risk_sensitive === true || opts.unresolved === true) {
        return { ...base, action: ROUTING_ACTIONS.HUMAN_REVIEW, publish_allowed: false, human_review_required: true, reason: "optional escalation unresolved/risk-sensitive — human review" };
      }
      return { ...base, action: ROUTING_ACTIONS.CONTINUE, publish_allowed: true, human_review_required: false, reason: "optional escalation resolved under existing deterministic + critic policy" };
    }

    default:
      return { ...base, action: ROUTING_ACTIONS.HUMAN_REVIEW, publish_allowed: false, human_review_required: true, reason: "unhandled classification — human review" };
  }
}

// Classify signals then route, in one deterministic step.
export function resolveEscalation(signals = {}, opts = {}) {
  const { class: classification, reason } = classifyEscalation(signals);
  const routing = routeEscalation(classification, { ...opts, reason: opts.reason ?? reason });
  return { ...routing, classification_reason: reason };
}

// ---- human review: a real, blocking state -----------------------------------
export function makeHumanReview(input = {}) {
  const status = input.status ?? "PENDING_HUMAN_REVIEW";
  if (!HUMAN_REVIEW_STATES.includes(status)) throw new Error(`invalid human-review status '${status}'`);
  const rec = {
    status,
    reason: input.reason ?? "unspecified",
    escalation_class: input.escalation_class ?? null,
    unresolved_issue: input.unresolved_issue ?? null,
    created_at: input.created_at ?? new Date().toISOString(),
  };
  for (const k of ["deterministic_findings", "critic_findings", "evidence_references", "safety_references"]) {
    if (Array.isArray(input[k])) rec[k] = input[k];
  }
  if (input.resolved_at) rec.resolved_at = input.resolved_at;
  if (input.resolved_by) rec.resolved_by = input.resolved_by;
  if (input.resolution) rec.resolution = input.resolution;
  return rec;
}

/** True when a human-review record blocks publication (no auto-resolve, no auto-approve). */
export function humanReviewBlocksPublication(record) {
  if (!record) return false;
  return record.status === "PENDING_HUMAN_REVIEW" || record.status === "BLOCKED";
}

/**
 * Publication is allowed only when: (a) no blocking human review, (b) any SUPERVISOR_REQUIRED case was
 * routed and is resolved (never silently passed), and (c) the normal downstream gates + explicit human
 * authorization are present. This function never manufactures authorization.
 */
export function publicationAllowed(state = {}) {
  const blockers = [];
  if (humanReviewBlocksPublication(state.human_review)) {
    blockers.push(`human_review_${state.human_review.status}`);
  }
  const routing = state.routing ?? null;
  if (routing && routing.classification === "SUPERVISOR_REQUIRED") {
    if (routing.supervisor_invoked !== true && !(state.human_review && state.human_review.status === "RESOLVED")) {
      blockers.push("supervisor_required_unresolved");
    }
  }
  if (routing && routing.action === ROUTING_ACTIONS.HUMAN_REVIEW && !(state.human_review && state.human_review.status === "RESOLVED")) {
    blockers.push("human_review_unresolved");
  }
  if (routing && routing.action === ROUTING_ACTIONS.BLOCK) blockers.push("deterministic_block");
  if (state.qa_all_pass !== true) blockers.push("downstream_gates_not_pass");
  if (!state.authorization || state.authorization.status !== "READY_TO_PUBLISH" || !state.authorization.authorized_by) {
    blockers.push("publication_authorization_missing");
  }
  return { allowed: blockers.length === 0, blockers };
}
