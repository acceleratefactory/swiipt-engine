// MAE lib · state-machine guard (MAE-03). No silent gate skipping; illegal transitions throw.
import { fail, CODES } from "./errors.js";

export const MACHINES = {
  angle: {
    DRAFT: ["EVIDENCE_LINKED", "RETIRED"],
    EVIDENCE_LINKED: ["VALIDATION_PENDING", "DRAFT", "RETIRED"],
    VALIDATION_PENDING: ["GREEN", "YELLOW", "RED"],
    GREEN: ["ARCHITECTED", "FLAGGED_FOR_RE_VERIFICATION", "RETIRED"],
    YELLOW: ["ARCHITECTED", "FLAGGED_FOR_RE_VERIFICATION", "RETIRED"],
    RED: ["EVIDENCE_LINKED", "RETIRED"], // Red retained; may be reworked
    ARCHITECTED: ["ACTIVE", "FLAGGED_FOR_RE_VERIFICATION", "RETIRED"],
    ACTIVE: ["RETIRED", "FLAGGED_FOR_RE_VERIFICATION"],
    FLAGGED_FOR_RE_VERIFICATION: ["VALIDATION_PENDING", "RETIRED"],
    RETIRED: [],
  },
  asset: {
    BRIEFED: ["GENERATED"],
    GENERATED: ["QA_PENDING", "BRIEF_REVIEW_REQUIRED"],
    QA_PENDING: ["REVISION_REQUIRED", "QA_PASSED", "REJECTED"],
    REVISION_REQUIRED: ["GENERATED"],
    BRIEF_REVIEW_REQUIRED: ["BRIEFED"],
    REJECTED: ["BRIEFED"],
    QA_PASSED: ["HUMAN_REVIEW", "APPROVED"],
    HUMAN_REVIEW: ["APPROVED", "REVISION_REQUIRED"],
    APPROVED: ["SCHEDULED", "RE_VERIFICATION_REQUIRED", "RETIRED"],
    SCHEDULED: ["PUBLISHED", "APPROVED"],
    PUBLISHED: ["RETIRED", "RE_VERIFICATION_REQUIRED"],
    RE_VERIFICATION_REQUIRED: ["QA_PENDING", "RETIRED"],
    RETIRED: [],
  },
  production: {
    QUEUED: ["PREPARING"],
    PREPARING: ["GENERATING", "PRODUCTION_BLOCKED"],
    GENERATING: ["RENDERED", "PRODUCTION_BLOCKED", "RENDER_PENDING_EXTERNAL_PROVIDER"],
    RENDERED: ["MEDIA_QA_PENDING"],
    RENDER_PENDING_EXTERNAL_PROVIDER: ["GENERATING", "ARCHIVED"],
    PRODUCTION_BLOCKED: ["PREPARING", "ARCHIVED"],
    MEDIA_QA_PENDING: ["REVISION_REQUIRED", "QA_PASSED"],
    REVISION_REQUIRED: ["GENERATING"],
    QA_PASSED: ["SECTION_7_QA_PENDING"],
    SECTION_7_QA_PENDING: ["APPROVED", "REVISION_REQUIRED"],
    APPROVED: ["EXPORTED", "ARCHIVED"],
    EXPORTED: ["PUBLISHED", "ARCHIVED"],
    PUBLISHED: ["ARCHIVED"],
    ARCHIVED: [],
  },
  family: {
    BUILDING: ["APPROVED", "RESTRICTED"],
    APPROVED: ["ACTIVE", "PAUSED", "RE_VERIFICATION_REQUIRED", "RETIRED"],
    RESTRICTED: ["ACTIVE", "PAUSED", "RE_VERIFICATION_REQUIRED", "RETIRED"],
    ACTIVE: ["PAUSED", "RETIRED", "RE_VERIFICATION_REQUIRED"],
    PAUSED: ["ACTIVE", "RETIRED"],
    RE_VERIFICATION_REQUIRED: ["BUILDING", "RETIRED"],
    RETIRED: [],
  },
  sequence: {
    DRAFT: ["QA_PENDING"],
    QA_PENDING: ["READY", "DRAFT"],
    READY: ["ACTIVE", "DRAFT"],
    ACTIVE: ["PAUSED", "COMPLETED"],
    PAUSED: ["ACTIVE", "COMPLETED"],
    COMPLETED: ["ARCHIVED"],
    ARCHIVED: [],
  },
  campaign: {
    PLANNING: ["ASSEMBLED"],
    ASSEMBLED: ["QA_PENDING"],
    QA_PENDING: ["READY", "ASSEMBLED"],
    READY: ["ACTIVE", "ASSEMBLED"],
    ACTIVE: ["PAUSED", "COMPLETED"],
    PAUSED: ["ACTIVE", "COMPLETED"],
    COMPLETED: ["ARCHIVED"],
    ARCHIVED: [],
  },
  gap: { OPEN: ["UPSTREAM_ACTION", "RESOLVED", "WAIVED"], UPSTREAM_ACTION: ["RESOLVED", "WAIVED"], RESOLVED: [], WAIVED: [] },
};

/** Return true if `from → to` is legal for the machine. */
export function canTransition(machine, from, to) {
  const m = MACHINES[machine];
  if (!m) return false;
  return (m[from] || []).includes(to);
}

/** Apply a transition on a record (mutates a copy, returns it); throws ILLEGAL_TRANSITION otherwise. */
export function transition(machine, record, to, { at = new Date().toISOString(), reason = null } = {}) {
  const from = record.status;
  if (!canTransition(machine, from, to)) {
    fail(CODES.ILLEGAL_TRANSITION, `illegal ${machine} transition ${from} → ${to}`, { from, to });
  }
  const history = Array.isArray(record.state_history) ? record.state_history.slice() : [];
  history.push({ from, to, at, reason });
  return { ...record, status: to, updated_at: at, state_history: history };
}
