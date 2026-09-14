// MAE · Video OUTPUT QA contract (for generated video). The temporal sibling of VisualOutputQA —
// same vocabulary, same honesty rule. Mechanical validity is NOT marketing validity: a 20-dimension
// review of angle/customer/product/grounding/scene/culture/emotion/brand/interchangeability/artifacts/
// anatomy/motion/continuity/camera/composition/text/audio/platform/claims.
//
// NO video/vision/audio evaluator is connected here. Judgment dimensions are NEVER auto-PASSed —
// with no judgment input they stay JUDGMENT_REQUIRED. No OCR, no frame extraction, no provider.
import { VIDEO_ARTIFACT_STATUS } from "../media/video-artifact.js";

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
  HYBRID: "HYBRID",
  JUDGMENT_REQUIRED: "JUDGMENT_REQUIRED",
});

// 20 canonical dimensions. `class` states honestly how far a dimension can be decided without judgment.
export const VIDEO_QA_DIMENSIONS = Object.freeze([
  { id: "ANGLE_FIDELITY", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Does the finished video communicate the validated Marketing Angle?" },
  { id: "CUSTOMER_TRUTH_FIDELITY", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Does the depicted person/situation/behavior remain faithful to Customer Truth rather than generic invention?" },
  { id: "PRODUCT_TRUTH_FIDELITY", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Does the video avoid contradicting or fabricating Product Truth, mechanisms, features, outcomes or safety claims?", zero_tolerance: "PRODUCT_TRUTH_VIOLATION" },
  { id: "VIDEO_GROUNDING_FIDELITY", class: DIMENSION_CLASS.HYBRID, question: "Does the actual video conform to the approved Video Grounding (subject, environment, start state, motion, camera, timing, end state, continuity, text policy, audio intent, exclusions)?" },
  { id: "SCENE_FIDELITY", class: DIMENSION_CLASS.HYBRID, question: "Does the actual depicted scene match the required setting, props, time, subject positioning and scenario?" },
  { id: "CULTURAL_INTEGRITY", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Is the cultural depiction accurate, respectful and contextually appropriate, free from severe stereotype/misrepresentation?", zero_tolerance: "SEVERE_CULTURAL_MISREPRESENTATION" },
  { id: "EMOTIONAL_INTEGRITY", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Does the emotional performance match the approved stake/tone without melodrama, trivialization, exaggeration or emotional invention?" },
  { id: "BRAND_FIT", class: DIMENSION_CLASS.HYBRID, question: "Does the finished video fit the approved Brand Truth / visual language / production style?" },
  { id: "INTERCHANGEABILITY", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Could this video be swapped into an unrelated brand/category with little or no change?" },
  { id: "AI_ARTIFACTS", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Are there visible temporal/generative artifacts (face warping, morphing, flicker, phantom objects, unstable hands, background mutation)?" },
  { id: "ANATOMICAL_PLAUSIBILITY", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Are body proportions, limbs, hands, posture and physical states plausible over time?", zero_tolerance: "SEVERE_ANATOMICAL_DEFECT" },
  { id: "MOTION_PLAUSIBILITY", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Does movement obey plausible physical/body motion (no sliding feet, teleporting, impossible weight shift, unrealistic object physics)?", zero_tolerance: "SEVERE_MOTION_DEFECT" },
  { id: "CONTINUITY", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Does identity and scene continuity remain stable across time (face, hair, wardrobe, body, props, environment, object position, lighting)?" },
  { id: "CAMERA_CONTROL", class: DIMENSION_CLASS.HYBRID, question: "Did the output respect required camera behavior (locked stays locked, required movement occurs, no unwanted zoom/cuts, usable framing)?" },
  { id: "COMPOSITION", class: DIMENSION_CLASS.HYBRID, question: "Is the subject framed correctly and are required safe regions / negative-space requirements preserved?" },
  { id: "TEXT_SAFETY", class: DIMENSION_CLASS.HYBRID, question: "Does the video avoid prohibited generated text and preserve required text-safe areas?" },
  { id: "AUDIO_INTEGRITY", class: DIMENSION_CLASS.HYBRID, question: "Does audio obey the approved audio policy and avoid unwanted or fabricated speech/sound?" },
  { id: "PLATFORM_FIT", class: DIMENSION_CLASS.DETERMINISTIC, question: "Does the artifact satisfy the deterministic platform/video asset requirements (geometry, aspect, duration, loop policy, delivery format)?" },
  { id: "UNSUPPORTED_VISUAL_CLAIM", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Does the video visually imply a product/medical result, transformation, feature, comparison or endorsement unsupported by the truth records?", zero_tolerance: "UNSUPPORTED_VISUAL_CLAIM" },
  { id: "UNSUPPORTED_AUDIO_CLAIM", class: DIMENSION_CLASS.JUDGMENT_REQUIRED, question: "Does speech/voice/audio introduce a claim unsupported by Product Truth, Customer Truth or approved copy?", zero_tolerance: "UNSUPPORTED_AUDIO_CLAIM" },
]);

export const VIDEO_ZERO_TOLERANCE_CLASSES = Object.freeze([
  "PRODUCT_TRUTH_VIOLATION",
  "SAFETY_VIOLATION",
  "UNSUPPORTED_VISUAL_CLAIM",
  "UNSUPPORTED_AUDIO_CLAIM",
  "SEVERE_CULTURAL_MISREPRESENTATION",
  "SEVERE_ANATOMICAL_DEFECT",
  "SEVERE_MOTION_DEFECT",
]);

// Judgment may only assert finite, controlled outcomes. Never "ASSUMED_PASS"/"SKIPPED_SUCCESSFULLY".
export const JUDGMENT_ALLOWED_STATUSES = Object.freeze(["PASS", "FAIL", "BLOCK", "HUMAN_REVIEW"]);
const RESERVED_JUDGMENT_KEYS = Object.freeze(["vision_model_id", "safety_violation"]);
const byId = (id) => VIDEO_QA_DIMENSIONS.find((d) => d.id === id);

/** Validate a provider-neutral judgment payload. Returns { valid, errors, meta }. Never throws. */
export function validateJudgment(payload = {}) {
  const errors = [];
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) return { valid: false, errors: ["judgment payload must be an object"], meta: { vision_model_id: null, safety_violation: false } };
  if ("vision_model_id" in payload && payload.vision_model_id != null && typeof payload.vision_model_id !== "string") errors.push("vision_model_id must be a string");
  if ("safety_violation" in payload && typeof payload.safety_violation !== "boolean") errors.push("safety_violation must be a boolean");
  for (const [key, val] of Object.entries(payload)) {
    if (RESERVED_JUDGMENT_KEYS.includes(key)) continue;
    if (!byId(key)) { errors.push(`unknown dimension: ${key}`); continue; }
    if (val == null || typeof val !== "object" || Array.isArray(val)) { errors.push(`${key}: entry must be an object`); continue; }
    if (!JUDGMENT_ALLOWED_STATUSES.includes(val.status)) errors.push(`${key}: unknown status "${val.status}"`);
    if ("failure_class" in val && val.failure_class != null && !VIDEO_ZERO_TOLERANCE_CLASSES.includes(val.failure_class)) errors.push(`${key}: unknown zero-tolerance class "${val.failure_class}"`);
    if ("evidence" in val && val.evidence != null && !Array.isArray(val.evidence)) errors.push(`${key}: evidence must be an array`);
    if ("reason" in val && val.reason != null && typeof val.reason !== "string") errors.push(`${key}: reason must be a string`);
    if ("confidence" in val && val.confidence != null && typeof val.confidence !== "number") errors.push(`${key}: confidence must be a number`);
  }
  return { valid: errors.length === 0, errors, meta: { vision_model_id: typeof payload.vision_model_id === "string" ? payload.vision_model_id : null, safety_violation: payload.safety_violation === true } };
}

export class VideoJudgmentError extends Error {
  constructor(errors) { super(`malformed video judgment payload: ${errors.join("; ")}`); this.name = "VideoJudgmentError"; this.code = "MALFORMED_JUDGMENT"; this.errors = errors; }
}

/** Deterministic evidence for a dimension, from the Wave V-B artifact + conformance diagnostics. */
function deterministicFor(dimId, { artifact, conformance, assetSpec }) {
  if (dimId === "PLATFORM_FIT") {
    if (!artifact || artifact.status !== VIDEO_ARTIFACT_STATUS.VIDEO_ARTIFACT_VALID) return { status: QA_STATUS.SOURCE_REQUIRED, reason: "no mechanically valid artifact" };
    const c = conformance || {};
    const flags = [["dimension_match", c.dimension_match], ["aspect_ratio_match", c.aspect_ratio_match], ["duration_match", c.duration_match]];
    const failed = flags.filter(([, v]) => v === false).map(([k]) => k);
    if (failed.length) return { status: QA_STATUS.FAIL, reason: `platform mismatch: ${failed.join(", ")}` };
    if (flags.every(([, v]) => v === true)) return { status: QA_STATUS.PASS, reason: "geometry, aspect ratio and duration match the asset spec" };
    return { status: QA_STATUS.NOT_RUN, reason: "insufficient deterministic platform evidence" };
  }
  if (dimId === "AUDIO_INTEGRITY") {
    const policy = assetSpec?.audio_policy ?? null;
    const present = artifact?.audio_stream_present ?? null;
    if (policy === "NONE" && present === true) return { status: QA_STATUS.FAIL, reason: "audio policy is NONE but the artifact contains an audio stream" };
    if (policy === "NONE" && present === false) return { status: QA_STATUS.NOT_RUN, reason: "no audio stream present (deterministic evidence only; semantic audio not judged)" };
    if (present == null) return { status: QA_STATUS.NOT_RUN, reason: "audio stream presence unknown" };
    return { status: QA_STATUS.NOT_RUN, reason: `audio policy ${policy || "unspecified"}: semantic correctness requires judgment` };
  }
  if (dimId === "VIDEO_GROUNDING_FIDELITY") {
    const c = conformance || {};
    const failed = [["duration_match", c.duration_match], ["aspect_ratio_match", c.aspect_ratio_match]].filter(([, v]) => v === false).map(([k]) => k);
    if (failed.length) return { status: QA_STATUS.FAIL, reason: `metadata mismatch vs grounding: ${failed.join(", ")}` };
    return { status: QA_STATUS.NOT_RUN, reason: "metadata matches; subject/motion/environment/camera conformity requires judgment" };
  }
  return { status: QA_STATUS.NOT_RUN, reason: "no deterministic evidence" };
}

export const VideoOutputQA = {
  /** Evaluate the 20 dimensions. Never invents a video judgment. Throws VideoJudgmentError on malformed judgment. */
  evaluate({ artifact = null, conformance = null, assetSpec = null, judgment = {}, deterministic = {}, evaluated_at = null } = {}) {
    const v = validateJudgment(judgment);
    if (!v.valid) throw new VideoJudgmentError(v.errors);
    const judge = judgment || {};

    const artifactValid = artifact?.status === VIDEO_ARTIFACT_STATUS.VIDEO_ARTIFACT_VALID;
    const ctx = { artifact, conformance, assetSpec };

    const dims = VIDEO_QA_DIMENSIONS.map((d) => {
      if (!artifactValid) {
        return { id: d.id, class: d.class, status: artMissingStatus(artifact), reason: `artifact ${artifact ? artifact.status : "missing"} — no meaningful video QA can run`, zero_tolerance: d.zero_tolerance || null };
      }
      let status, reason;
      if (d.class === DIMENSION_CLASS.JUDGMENT_REQUIRED) {
        if (judge[d.id]) { status = judge[d.id].status; reason = judge[d.id].reason || "judgment result"; }
        else { status = QA_STATUS.JUDGMENT_REQUIRED; reason = "requires a video evaluator (not run)"; }
      } else if (d.class === DIMENSION_CLASS.DETERMINISTIC) {
        const r = deterministic[d.id] || deterministicFor(d.id, ctx);
        status = r.status; reason = r.reason;
      } else {
        const det = deterministic[d.id] || deterministicFor(d.id, ctx);
        if (det.status === QA_STATUS.FAIL) { status = QA_STATUS.FAIL; reason = `deterministic: ${det.reason}`; }
        else if (judge[d.id]) { status = judge[d.id].status; reason = judge[d.id].reason || "judgment result"; }
        else { status = QA_STATUS.JUDGMENT_REQUIRED; reason = `deterministic part: ${det.reason}; video match requires an evaluator`; }
      }
      return { id: d.id, class: d.class, status, reason, zero_tolerance: d.zero_tolerance || null };
    });

    const blocking = [];
    let hasFail = false, judgmentPending = false, human = false;
    for (const dim of dims) {
      if (dim.status === QA_STATUS.FAIL || dim.status === QA_STATUS.BLOCK) {
        hasFail = true;
        if (dim.zero_tolerance) blocking.push(dim.zero_tolerance);
        const fc = (artifactValid && judge[dim.id]?.failure_class) || null;
        if (fc && VIDEO_ZERO_TOLERANCE_CLASSES.includes(fc)) blocking.push(fc);
      }
      if (dim.status === QA_STATUS.JUDGMENT_REQUIRED) judgmentPending = true;
      if (dim.status === QA_STATUS.HUMAN_REVIEW) human = true;
    }
    if (artifactValid && v.meta.safety_violation) blocking.push("SAFETY_VIOLATION");
    const blocking_failures = [...new Set(blocking)];

    let overall_status;
    if (!artifactValid) overall_status = artMissingStatus(artifact);
    else if (blocking_failures.length) overall_status = QA_STATUS.BLOCK;
    else if (hasFail) overall_status = QA_STATUS.FAIL;
    else if (human) overall_status = QA_STATUS.HUMAN_REVIEW;
    else if (judgmentPending) overall_status = QA_STATUS.JUDGMENT_REQUIRED;
    else overall_status = QA_STATUS.PASS;

    const judged = dims.filter((d) => artifactValid && judge[d.id]).length;
    const pending = dims.filter((d) => d.status === QA_STATUS.JUDGMENT_REQUIRED).length;

    return {
      overall_status,
      dimensions: dims,
      blocking_failures,
      human_review_required: overall_status !== QA_STATUS.PASS,
      judgment_run: artifactValid && Object.keys(judge).some((k) => !RESERVED_JUDGMENT_KEYS.includes(k)),
      vision_model: v.meta.vision_model_id,
      artifact_id: artifact?.artifact_id ?? null,
      video_asset_id: artifact?.video_asset_id ?? assetSpec?.video_asset_id ?? null,
      video_grounding_id: assetSpec?.video_grounding_id ?? null,
      angle_id: assetSpec?.angle_id ?? null,
      artifact_status: artifact?.status ?? null,
      deterministic_summary: {
        artifact_status: artifact?.status ?? null,
        pass: dims.filter((d) => d.status === QA_STATUS.PASS).length,
        fail: dims.filter((d) => d.status === QA_STATUS.FAIL).length,
        not_run: dims.filter((d) => d.status === QA_STATUS.NOT_RUN || d.status === QA_STATUS.SOURCE_REQUIRED).length,
      },
      judgment_summary: { evaluated: judged, judgment_required: pending, vision_model: v.meta.vision_model_id },
      evaluated_at,
    };
  },

  dimension(id) { return byId(id) || null; },
};

// Missing artifact → SOURCE_REQUIRED; a present-but-invalid artifact → FAIL. Both are non-approval
// states, and neither can be turned into PASS by a judgment payload.
function artMissingStatus(artifact) {
  return artifact ? QA_STATUS.FAIL : QA_STATUS.SOURCE_REQUIRED;
}
