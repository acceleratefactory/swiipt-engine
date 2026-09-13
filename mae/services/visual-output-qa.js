// MAE · Visual OUTPUT QA contract (for generated imagery). Provider-agnostic. NOT a model benchmark and
// NOT aesthetic taste scoring: it defines what a generated image must satisfy before it can become a
// finished asset. Judgment dimensions are NEVER auto-PASSed — with no vision model they stay
// JUDGMENT_REQUIRED. No provider/vision/text model is called here.

export const QA_STATUS = Object.freeze({
  PASS: "PASS",
  FAIL: "FAIL",
  BLOCK: "BLOCK",
  NOT_RUN: "NOT_RUN",
  JUDGMENT_REQUIRED: "JUDGMENT_REQUIRED",
  HUMAN_REVIEW: "HUMAN_REVIEW",
  SOURCE_REQUIRED: "SOURCE_REQUIRED",
});

export const DIMENSION_CLASS = Object.freeze({
  DETERMINISTIC: "DETERMINISTIC",
  JUDGMENT_REQUIRED: "JUDGMENT_REQUIRED",
  HYBRID: "HYBRID",
});

// 15 canonical dimensions. `class` states honestly whether a dimension can be decided deterministically.
export const VISUAL_QA_DIMENSIONS = Object.freeze([
  { id: "ANGLE_FIDELITY", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Does the visual support the approved Marketing Angle?" },
  { id: "CUSTOMER_TRUTH_FIDELITY", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Does the visible person/situation contradict Customer Truth?" },
  { id: "PRODUCT_TRUTH_FIDELITY", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Does the image imply an unsupported product result/capability/claim?", zero_tolerance: "PRODUCT_TRUTH_VIOLATION" },
  { id: "VISUAL_GROUNDING_FIDELITY", class: DIMENSION_CLASS.HYBRID, question: "Does the output match the approved VisualGroundingBlock?" },
  { id: "SCENE_FIDELITY", class: DIMENSION_CLASS.HYBRID, question: "Environment, subject, posture, props and scene relationships." },
  { id: "CULTURAL_INTEGRITY", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Are grounded cultural markers respected without invention or stereotyping?", zero_tolerance: "SEVERE_CULTURAL_MISREPRESENTATION" },
  { id: "EMOTIONAL_INTEGRITY", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Does the image stay within the approved emotional tone?" },
  { id: "BRAND_FIT", class: DIMENSION_CLASS.HYBRID, question: "Does the output fit Swiipt's visual language and brand constraints?" },
  { id: "INTERCHANGEABILITY", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Could this visual advertise almost any generic wellness product?" },
  { id: "AI_ARTIFACTS", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Malformed anatomy, duplicated/nonsensical objects, incoherent geometry." },
  { id: "ANATOMICAL_PLAUSIBILITY", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Where people appear, is body structure/posture physically plausible?" },
  { id: "COMPOSITION", class: DIMENSION_CLASS.HYBRID, question: "Framing, focal placement, safe zones and negative-space requirements." },
  { id: "TEXT_SAFETY", class: DIMENSION_CLASS.HYBRID, question: "No unintended embedded text where deterministic type is required." },
  { id: "PLATFORM_FIT", class: DIMENSION_CLASS.DETERMINISTIC, question: "Does the output work for the intended dimensions and crop behaviour?" },
  { id: "UNSUPPORTED_VISUAL_CLAIM", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Does the visual imply evidence/results not supported by Truth?", zero_tolerance: "UNSUPPORTED_VISUAL_CLAIM" },
]);

export const VISUAL_ZERO_TOLERANCE_CLASSES = Object.freeze([
  "PRODUCT_TRUTH_VIOLATION",
  "SAFETY_VIOLATION",
  "UNSUPPORTED_VISUAL_CLAIM",
  "SEVERE_CULTURAL_MISREPRESENTATION",
]);

const byId = (id) => VISUAL_QA_DIMENSIONS.find((d) => d.id === id);

/** Deterministic sub-checks derivable from a frozen fixture + optional compositor QA. */
function deterministicFor(dimId, fixture, compositorQA) {
  if (dimId === "PLATFORM_FIT") {
    const exp = fixture?.expected?.canvas;
    const ok = !!exp && Number.isFinite(exp.width) && Number.isFinite(exp.height) && !!fixture.expected.aspect_ratio;
    return { status: ok ? QA_STATUS.PASS : QA_STATUS.NOT_RUN, reason: ok ? `expected canvas ${exp.width}x${exp.height}` : "no expected canvas" };
  }
  // HYBRID deterministic fractions can be evidenced by the compositor QA (geometry/safe zones/locked text).
  if (dimId === "COMPOSITION" && compositorQA) {
    const c = (compositorQA.checks || []).filter((x) => ["safe_zones_respected", "no_text_overflow", "canvas_dimensions_correct"].includes(x.check));
    if (c.length) return { status: c.every((x) => x.pass) ? QA_STATUS.PASS : QA_STATUS.FAIL, reason: "compositor geometry/safe-zone checks" };
  }
  if (dimId === "TEXT_SAFETY" && compositorQA) {
    const c = (compositorQA.checks || []).find((x) => x.check === "locked_copy_unchanged");
    if (c) return { status: c.pass ? QA_STATUS.PASS : QA_STATUS.FAIL, reason: "compositor locked-copy check (unintended embedded text remains a judgment item)" };
  }
  if ((dimId === "VISUAL_GROUNDING_FIDELITY" || dimId === "SCENE_FIDELITY") && fixture?.visual_grounding) {
    const g = fixture.visual_grounding;
    const ok = !!(g.scene && g.environment && g.gesture_posture && Array.isArray(g.exclusions) && g.exclusions.length);
    return { status: ok ? QA_STATUS.PASS : QA_STATUS.FAIL, reason: "grounding fields present (image match remains judgment)" };
  }
  if (dimId === "BRAND_FIT" && fixture?.truth_references?.brand_truth_version) {
    return { status: QA_STATUS.PASS, reason: `brand version ${fixture.truth_references.brand_truth_version} referenced` };
  }
  return { status: QA_STATUS.NOT_RUN, reason: "no deterministic evidence" };
}

export const VisualOutputQA = {
  /** Evaluate the 15 dimensions. Never invents a vision judgment. */
  evaluate({ fixture, compositorQA = null, judgment = {}, deterministic = {} } = {}) {
    const dims = VISUAL_QA_DIMENSIONS.map((d) => {
      let status, reason;
      if (d.class === DIMENSION_CLASS.JUDGMENT_REQUIRED) {
        if (judgment[d.id]) { status = judgment[d.id].status; reason = judgment[d.id].reason || "judgment result"; }
        else { status = QA_STATUS.JUDGMENT_REQUIRED; reason = "requires a vision model (not run)"; }
      } else if (d.class === DIMENSION_CLASS.DETERMINISTIC) {
        const r = deterministic[d.id] || deterministicFor(d.id, fixture, compositorQA);
        status = r.status; reason = r.reason;
      } else {
        // HYBRID: deterministic part first; judgment part stays explicit.
        const det = deterministic[d.id] || deterministicFor(d.id, fixture, compositorQA);
        if (det.status === QA_STATUS.FAIL) { status = QA_STATUS.FAIL; reason = `deterministic: ${det.reason}`; }
        else if (judgment[d.id]) { status = judgment[d.id].status; reason = judgment[d.id].reason || "judgment result"; }
        else { status = QA_STATUS.JUDGMENT_REQUIRED; reason = `deterministic part: ${det.reason}; image match requires a vision model`; }
      }
      return { id: d.id, class: d.class, status, reason, zero_tolerance: d.zero_tolerance || null };
    });

    const blocking_failures = [];
    let hasFail = false;
    let judgmentPending = false;
    let human = false;
    for (const dim of dims) {
      if (dim.status === QA_STATUS.FAIL || dim.status === QA_STATUS.BLOCK) {
        hasFail = true;
        if (dim.zero_tolerance) blocking_failures.push(dim.zero_tolerance);
      }
      if (dim.status === QA_STATUS.JUDGMENT_REQUIRED) judgmentPending = true;
      if (dim.status === QA_STATUS.HUMAN_REVIEW) human = true;
    }
    const safetyViolation = judgment.safety_violation === true;
    if (safetyViolation) blocking_failures.push("SAFETY_VIOLATION");

    let overall_status;
    if (blocking_failures.length) overall_status = QA_STATUS.BLOCK;
    else if (hasFail) overall_status = QA_STATUS.FAIL;
    else if (human) overall_status = QA_STATUS.HUMAN_REVIEW;
    else if (judgmentPending) overall_status = QA_STATUS.JUDGMENT_REQUIRED;
    else overall_status = QA_STATUS.PASS;

    return {
      overall_status,
      dimensions: dims,
      blocking_failures: [...new Set(blocking_failures)],
      human_review_required: judgmentPending || human || blocking_failures.length > 0,
      judgment_run: Object.keys(judgment).length > 0,
      vision_model: judgment.vision_model_id ?? null,
    };
  },

  dimension(id) { return byId(id) || null; },
};
