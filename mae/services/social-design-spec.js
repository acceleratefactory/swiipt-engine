// MAE · Social Design Production — CONTRACTS ONLY (Wave S-A).
// Social Design is a production capability INSIDE the existing MAE Generation stage. This module
// freezes the machine-readable contract for a SocialDesignSpecification. It renders NOTHING:
// no SVG, no raster, no compositor, no provider, no QA execution.
//
// Reuses (no duplication): layout IMAGE_FITS/IMAGE_FOCALS, image-provider compareAspectRatio,
// truth WEIGHTING_MATRIX profile identifiers, the existing source_classification convention and the
// existing GREEN/YELLOW/RED angle-verdict vocabulary (RED is refused, per architecture.js).
import { IMAGE_FITS, IMAGE_FOCALS } from "../media/layout.js";
import { compareAspectRatio } from "../media/image-provider.js";
import { WEIGHTING_MATRIX } from "./truth.js";

export const SOCIAL_DESIGN_SPEC_VERSION = "1.0";

// --- Part 1 · asset types (arity only) ---------------------------------------
export const ASSET_TYPES = Object.freeze(["SOCIAL_STATIC", "SOCIAL_CAROUSEL", "SOCIAL_STORY_SEQUENCE"]);
export const ASSET_TYPE_LIMITS = Object.freeze({
  SOCIAL_STATIC: { min: 1, max: 1 },
  SOCIAL_CAROUSEL: { min: 2, max: 10 },
  SOCIAL_STORY_SEQUENCE: { min: 1, max: 6 },
});

// --- Part 2 · purposes (canonical V1 — no generic CONVERSION) ----------------
export const ASSET_PURPOSES = Object.freeze([
  "STOP_SCROLL", "IDENTIFICATION", "REASSURANCE", "EDUCATION", "CLARIFICATION", "DECISION_SUPPORT",
  "PROOF", "PRODUCT_CONVERSION", "MEMBERSHIP_CONVERSION", "ANNOUNCEMENT", "REMINDER", "RETENTION",
]);

// --- Part 3 · content patterns ------------------------------------------------
export const CONTENT_PATTERNS = Object.freeze([
  "STATEMENT", "TYPOGRAPHIC_HOOK", "QUESTION", "QUOTE", "IDENTIFICATION", "REASSURANCE",
  "PROBLEM_INSIGHT", "MYTH_REALITY", "MISTAKE_CORRECTION", "CHECKLIST", "STEPS", "COMPARISON",
  "STATISTIC", "DATA", "TESTIMONIAL", "PROOF", "FEATURE_BENEFIT", "BENEFIT_STACK", "BEFORE_AFTER",
  "OFFER", "PRICE", "FEATURE",
]);

// --- Part 4 · layout families -------------------------------------------------
export const LAYOUT_FAMILIES = Object.freeze([
  "TYPE_DOMINANT", "IMAGE_DOMINANT", "SPLIT", "LIST", "TWO_COLUMN", "DATA_FOCUS", "QUOTE_FOCUS",
  "PRODUCT_HERO", "FULL_BLEED", "EDITORIAL", "MULTI_PANEL",
]);

// --- Part 5 · platform formats (identifiers only; no platform dimensions) -----
export const PLATFORM_FORMATS = Object.freeze([
  "FEED_SQUARE", "FEED_PORTRAIT", "FEED_LANDSCAPE", "STORY_VERTICAL", "CAROUSEL_SLIDE",
  "AD_SQUARE", "AD_PORTRAIT", "THUMBNAIL", "COVER_PORTRAIT", "SHARE_CARD",
]);

// --- Part 6 · production modes (HYBRID is derived, never selectable) ----------
export const PRODUCTION_MODES = Object.freeze([
  "DETERMINISTIC_TYPE_ONLY", "DETERMINISTIC_GRAPHIC", "PHOTO_PLUS_TYPE",
  "ILLUSTRATION_PLUS_TYPE", "PRODUCT_VISUAL_PLUS_LAYOUT", "DATA_VISUAL",
]);
export const DERIVED_DESCRIPTORS = Object.freeze(["HYBRID"]);

// --- Part 29 · sequence roles → 32 · status → 33 · zero-tolerance -------------
export const SEQUENCE_ROLES = Object.freeze([
  "COVER", "CONTEXT", "IDENTIFY", "DEEPEN", "EXPLAIN", "REFRAME", "TEACH", "PROVE", "HELP", "RESOLVE", "ACT",
]);
export const SOCIAL_STATUS = Object.freeze({ SPECIFIED: "SPECIFIED", SOURCE_REQUIRED: "SOURCE_REQUIRED", INVALID_SPEC: "INVALID_SPEC" });
export const ZERO_TOLERANCE_FAILURES = Object.freeze([
  "PRODUCT_TRUTH_VIOLATION", "UNSUPPORTED_CLAIM", "FAKE_TESTIMONIAL", "FABRICATED_PROOF", "FABRICATED_STATISTIC",
  "MISLEADING_BEFORE_AFTER", "SAFETY_VIOLATION", "SEVERE_CULTURAL_MISREPRESENTATION", "WRONG_PRICE",
  "WRONG_PRODUCT_FEATURE", "BRAND_LOGO_MISUSE",
]);

// --- Part 13 · copy roles -----------------------------------------------------
export const COPY_ROLES = Object.freeze([
  "eyebrow", "headline", "subheadline", "body", "supporting_line", "quote", "statistic_value",
  "statistic_label", "label", "badge", "list_item", "step_number", "price", "members_price", "offer",
  "cta", "product_name", "disclaimer", "source_note", "pagination",
]);
export const REPEATABLE_COPY_ROLES = Object.freeze(["list_item", "step_number", "label", "badge", "source_note"]);

// --- Part 14 · visual slots ---------------------------------------------------
export const VISUAL_MEDIA_TYPES = Object.freeze(["photo", "illustration", "product_image", "none"]);
export const SLOT_FALLBACKS = Object.freeze(["TYPE_ONLY", "SOURCE_REQUIRED", "PLACEHOLDER_FORBIDDEN"]);
export const SLOT_TREATMENTS = Object.freeze(["none", "scrim", "tint", "duotone"]);
export const FITS = IMAGE_FITS;
export const FOCALS = IMAGE_FOCALS;
export const SLOT_SOURCE_KEYS = Object.freeze(["artifact_id", "generated_request"]);

// --- Part 19 / 24 / 25 / 26 ---------------------------------------------------
export const BACKGROUND_KINDS = Object.freeze(["solid", "tint", "gradient", "scrim", "none"]);
export const ALIGNMENTS = Object.freeze(["LEFT", "CENTER", "RIGHT"]);
export const DENSITIES = Object.freeze(["SPARSE", "STANDARD", "DENSE"]);
export const SPACING_CLASSES = Object.freeze(["TIGHT", "STANDARD", "LOOSE"]);
export const EXPORT_FORMATS = Object.freeze(["svg", "png", "webp", "jpg"]);
export const ANGLE_VERDICTS = Object.freeze(["GREEN", "YELLOW"]);   // RED refused (architecture.js rule)
export const EVIDENCE_TYPES = Object.freeze(["TESTIMONIAL", "STATISTIC", "PROOF", "BEFORE_AFTER", "COMPARISON", "SOURCE_NOTE", "PRODUCT_TRUTH", "PRICE"]);
export const WEIGHTING_PROFILES = Object.freeze(Object.keys(WEIGHTING_MATRIX));

// --- Part 34 · evidence-sensitive patterns ------------------------------------
export const EVIDENCE_SENSITIVE_PATTERNS = Object.freeze(["TESTIMONIAL", "STATISTIC", "DATA", "PROOF", "BEFORE_AFTER", "COMPARISON"]);
export const PRICE_COPY_ROLES = Object.freeze(["price", "members_price", "offer"]);

const isObj = (v) => v != null && typeof v === "object" && !Array.isArray(v);
const num = (v) => typeof v === "number" && Number.isFinite(v);
const positive = (v) => num(v) && v > 0;
const nonEmptyStr = (v) => typeof v === "string" && v.trim().length > 0;
const uniq = (a) => new Set(a).size === a.length;

// --- Part 7 · normalization ---------------------------------------------------
export function normalizeSocialDesignSpec(spec = {}) {
  return {
    ...spec,
    design_version: spec.design_version ?? SOCIAL_DESIGN_SPEC_VERSION,
    canvas: isObj(spec.canvas) ? { width: spec.canvas.width, height: spec.canvas.height, aspect_ratio: spec.canvas.aspect_ratio ?? null, px_density: spec.canvas.px_density ?? null } : spec.canvas,
    safe_zones: isObj(spec.safe_zones) ? spec.safe_zones : spec.safe_zones,
    copy_blocks: Array.isArray(spec.copy_blocks) ? spec.copy_blocks : [],
    hierarchy: Array.isArray(spec.hierarchy) ? spec.hierarchy : [],
    export_format: Array.isArray(spec.export_format) ? spec.export_format : [],
    required_elements: Array.isArray(spec.required_elements) ? spec.required_elements : [],
    prohibited_elements: Array.isArray(spec.prohibited_elements) ? spec.prohibited_elements : [],
    evidence_requirements: Array.isArray(spec.evidence_requirements) ? spec.evidence_requirements : [],
    visual_slots: Array.isArray(spec.visual_slots) ? spec.visual_slots : [],
    slides: Array.isArray(spec.slides) ? spec.slides : undefined,
  };
}

const REQUIRED_FIELDS = Object.freeze([
  "design_id", "design_version", "angle_id", "angle_verdict", "asset_brief_id", "product_id",
  "transformation_id", "asset_type", "asset_purpose", "content_pattern", "layout_family",
  "platform", "placement", "platform_format", "canvas", "safe_zones", "copy_blocks",
  "typography_roles", "brand_tokens_version", "logo_policy", "cta_policy", "background_policy",
  "truth_requirements", "hierarchy", "alignment", "spacing", "density", "accessibility",
  "export_format", "production_mode", "source_classification", "prohibited_elements",
  "required_elements", "provenance",
]);

function validateCanvas(canvas, errors) {
  if (!isObj(canvas)) { errors.push("canvas must be an object"); return; }
  if (!positive(canvas.width)) errors.push("canvas.width must be a positive number");
  if (!positive(canvas.height)) errors.push("canvas.height must be a positive number");
  if (!nonEmptyStr(canvas.aspect_ratio)) errors.push("canvas.aspect_ratio is required");
  if (canvas.px_density != null && !positive(canvas.px_density)) errors.push("canvas.px_density must be a positive number");
  if (positive(canvas.width) && positive(canvas.height) && nonEmptyStr(canvas.aspect_ratio)) {
    const derived = `${canvas.width}:${canvas.height}`;
    const c = compareAspectRatio(canvas.aspect_ratio, derived);
    if (c.match === false) errors.push(`canvas.aspect_ratio inconsistent with width:height (delta ${c.delta})`);
  }
}

function validateSafeZones(z, canvas, errors) {
  if (!isObj(z)) { errors.push("safe_zones must be an object"); return; }
  for (const edge of ["top", "bottom", "left", "right"]) {
    if (z[edge] == null) { errors.push(`safe_zones.${edge} is required`); continue; }
    if (!num(z[edge]) || z[edge] < 0) errors.push(`safe_zones.${edge} must be a number >= 0`);
  }
  if (num(z.top) && num(z.bottom) && positive(canvas?.height) && z.top + z.bottom >= canvas.height) errors.push("safe_zones top+bottom leave no drawable height");
  if (num(z.left) && num(z.right) && positive(canvas?.width) && z.left + z.right >= canvas.width) errors.push("safe_zones left+right leave no drawable width");
}

function validateCopyBlocks(blocks, errors) {
  if (!Array.isArray(blocks) || blocks.length === 0) { errors.push("copy_blocks must be a non-empty array"); return; }
  const seen = {};
  blocks.forEach((b, i) => {
    const at = `copy_blocks[${i}]`;
    if (!isObj(b)) { errors.push(`${at} must be an object`); return; }
    if (!COPY_ROLES.includes(b.role)) { errors.push(`${at}.role unknown copy role "${b.role}"`); return; }
    if (!nonEmptyStr(b.text)) errors.push(`${at}.text must be a non-empty string (approved copy is never empty)`);
    seen[b.role] = (seen[b.role] || 0) + 1;
  });
  for (const [role, n] of Object.entries(seen)) {
    if (n > 1 && !REPEATABLE_COPY_ROLES.includes(role)) errors.push(`copy role "${role}" may not repeat (${n}x)`);
  }
}

function validateVisualSlots(slots, errors) {
  if (!Array.isArray(slots)) { errors.push("visual_slots must be an array"); return; }
  const ids = [];
  slots.forEach((s, i) => {
    const at = `visual_slots[${i}]`;
    if (!isObj(s)) { errors.push(`${at} must be an object`); return; }
    if (!nonEmptyStr(s.slot_id)) errors.push(`${at}.slot_id is required`);
    else if (ids.includes(s.slot_id)) errors.push(`${at}.slot_id duplicate "${s.slot_id}"`);
    else ids.push(s.slot_id);
    if (!VISUAL_MEDIA_TYPES.includes(s.media_type)) errors.push(`${at}.media_type unknown "${s.media_type}"`);
    if (s.fit != null && !FITS.includes(s.fit)) errors.push(`${at}.fit unknown "${s.fit}"`);
    if (s.focal != null && !FOCALS.includes(s.focal)) errors.push(`${at}.focal unknown "${s.focal}"`);
    if (s.treatment != null && !SLOT_TREATMENTS.includes(s.treatment)) errors.push(`${at}.treatment unknown "${s.treatment}"`);
    if (s.fallback != null && !SLOT_FALLBACKS.includes(s.fallback)) errors.push(`${at}.fallback unknown "${s.fallback}"`);
    if (isObj(s.geometry) && s.geometry.aspect_ratio != null && !nonEmptyStr(s.geometry.aspect_ratio)) errors.push(`${at}.geometry.aspect_ratio must be a string`);
    if (isObj(s.source)) { for (const k of Object.keys(s.source)) if (!SLOT_SOURCE_KEYS.includes(k)) errors.push(`${at}.source unknown key "${k}"`); }
    const hasSource = isObj(s.source) && (nonEmptyStr(s.source.artifact_id) || isObj(s.source.generated_request));
    if (s.required === true && s.media_type !== "none") {
      if (!hasSource && s.fallback == null) errors.push(`${at} is required without a source and without a fallback — declare fallback TYPE_ONLY or SOURCE_REQUIRED`);
      if (s.fallback === "PLACEHOLDER_FORBIDDEN" && !hasSource) errors.push(`${at} forbids placeholders but has no source and no fallback`);
    }
  });
}

function validateTypographyRoles(roles, errors) {
  if (!Array.isArray(roles) || roles.length === 0) { errors.push("typography_roles must be a non-empty array"); return; }
  roles.forEach((r, i) => {
    const at = `typography_roles[${i}]`;
    if (!isObj(r)) { errors.push(`${at} must be an object`); return; }
    if (!COPY_ROLES.includes(r.role)) errors.push(`${at}.role unknown "${r.role}"`);
    if (r.alignment != null && !ALIGNMENTS.includes(r.alignment)) errors.push(`${at}.alignment unknown "${r.alignment}"`);
    for (const k of ["scale", "weight", "line_height", "max_width"]) if (r[k] != null && !positive(r[k])) errors.push(`${at}.${k} must be a positive number`);
  });
}

function validateSourceClassification(sc, errors) {
  if (!isObj(sc)) { errors.push("source_classification must be an object"); return; }
  for (const k of ["source_grounded", "production_instruction"]) {
    if (!Array.isArray(sc[k])) { errors.push(`source_classification.${k} must be an array`); continue; }
    if (!uniq(sc[k])) errors.push(`source_classification.${k} has duplicate entries`);
    if (sc[k].some((x) => !nonEmptyStr(x))) errors.push(`source_classification.${k} entries must be non-empty strings`);
  }
  if (Array.isArray(sc.source_grounded) && Array.isArray(sc.production_instruction)) {
    for (const x of sc.source_grounded) if (sc.production_instruction.includes(x)) errors.push(`source_classification overlap: "${x}" appears in both sets (facts may not be classified as production instruction)`);
  }
}

function validateProvenance(p, brandVersion, errors) {
  if (!isObj(p)) { errors.push("provenance must be an object"); return; }
  for (const k of ["angle_id", "asset_brief_id"]) if (!nonEmptyStr(p[k])) errors.push(`provenance.${k} is required`);
  for (const k of ["truth_refs", "copy_refs", "evidence_refs", "source_media_refs"]) {
    if (!Array.isArray(p[k])) errors.push(`provenance.${k} must be an array`);
    else if (!uniq(p[k])) errors.push(`provenance.${k} has duplicate entries`);
  }
  if (!nonEmptyStr(p.brand_tokens_version)) errors.push("provenance.brand_tokens_version is required");
  else if (nonEmptyStr(brandVersion) && p.brand_tokens_version !== brandVersion) errors.push(`provenance.brand_tokens_version "${p.brand_tokens_version}" must match brand_tokens_version "${brandVersion}"`);
}

function deriveStatus(spec, errors) {
  if (errors.length) return SOCIAL_STATUS.INVALID_SPEC;
  const needsSource = (spec.visual_slots || []).some((s) => s?.required === true && s?.media_type !== "none" && s?.fallback === "SOURCE_REQUIRED" && !(isObj(s.source) && (nonEmptyStr(s.source.artifact_id) || isObj(s.source.generated_request))));
  return needsSource ? SOCIAL_STATUS.SOURCE_REQUIRED : SOCIAL_STATUS.SPECIFIED;
}

/** Full deterministic contract validation. Never renders, never fetches, never calls a provider. */
export function validateSocialDesignSpec(rawSpec = {}) {
  const spec = normalizeSocialDesignSpec(rawSpec);
  const errors = [];
  const warnings = [];

  for (const f of REQUIRED_FIELDS) if (spec[f] == null) errors.push(`missing required field: ${f}`);
  if (!nonEmptyStr(spec.design_id)) errors.push("design_id must be a non-empty stable string (not timestamp-derived)");
  if (!nonEmptyStr(spec.design_version)) errors.push("design_version must be a non-empty string");
  if (typeof spec.design_id === "string" && /^\d{10,}$/.test(spec.design_id)) errors.push("design_id must not be timestamp-derived");
  if (!ANGLE_VERDICTS.includes(spec.angle_verdict)) errors.push(`angle_verdict "${spec.angle_verdict}" is not an approved/usable state (GREEN or YELLOW; RED is refused)`);
  for (const k of ["angle_id", "asset_brief_id", "product_id", "transformation_id", "platform", "placement", "brand_tokens_version"]) if (spec[k] != null && !nonEmptyStr(spec[k])) errors.push(`${k} must be a non-empty string`);
  if (!ASSET_TYPES.includes(spec.asset_type)) errors.push(`unknown asset_type "${spec.asset_type}"`);
  if (!ASSET_PURPOSES.includes(spec.asset_purpose)) errors.push(`unknown asset_purpose "${spec.asset_purpose}"`);
  if (!CONTENT_PATTERNS.includes(spec.content_pattern)) errors.push(`unknown content_pattern "${spec.content_pattern}"`);
  if (!LAYOUT_FAMILIES.includes(spec.layout_family)) errors.push(`unknown layout_family "${spec.layout_family}"`);
  if (!PLATFORM_FORMATS.includes(spec.platform_format)) errors.push(`unknown platform_format "${spec.platform_format}"`);
  if (DERIVED_DESCRIPTORS.includes(spec.production_mode)) errors.push(`production_mode "${spec.production_mode}" is a derived descriptor and is not selectable`);
  else if (!PRODUCTION_MODES.includes(spec.production_mode)) errors.push(`unknown production_mode "${spec.production_mode}"`);
  if (!ALIGNMENTS.includes(spec.alignment)) errors.push(`unknown alignment "${spec.alignment}"`);
  if (!DENSITIES.includes(spec.density)) errors.push(`unknown density "${spec.density}"`);

  validateCanvas(spec.canvas, errors);
  validateSafeZones(spec.safe_zones, spec.canvas, errors);
  validateCopyBlocks(spec.copy_blocks, errors);
  validateVisualSlots(spec.visual_slots, errors);
  validateTypographyRoles(spec.typography_roles, errors);
  validateSourceClassification(spec.source_classification, errors);
  validateProvenance(spec.provenance, spec.brand_tokens_version, errors);

  // hierarchy (Part 23)
  if (!Array.isArray(spec.hierarchy) || spec.hierarchy.length === 0) errors.push("hierarchy must be a non-empty ordered array");
  else {
    if (spec.hierarchy.some((h) => !nonEmptyStr(h))) errors.push("hierarchy entries must be non-empty strings");
    if (!uniq(spec.hierarchy)) errors.push("hierarchy references must be unique");
  }
  // spacing (Part 24)
  if (!isObj(spec.spacing)) errors.push("spacing must be an object");
  else if (!(nonEmptyStr(spec.spacing.scale_token) || SPACING_CLASSES.includes(spec.spacing.class))) errors.push("spacing requires a token reference (scale_token) or a constrained class (TIGHT|STANDARD|LOOSE)");
  // accessibility (Part 25)
  if (!isObj(spec.accessibility)) errors.push("accessibility must be an object");
  else {
    if (!positive(spec.accessibility.min_type_size)) errors.push("accessibility.min_type_size must be a positive number");
    if (!positive(spec.accessibility.contrast_floor)) errors.push("accessibility.contrast_floor must be a positive number");
    if (!nonEmptyStr(spec.accessibility.alt_text)) errors.push("accessibility.alt_text is required");
  }
  // export formats (Part 26)
  if (!Array.isArray(spec.export_format) || spec.export_format.length === 0) errors.push("export_format must be a non-empty array");
  else for (const f of spec.export_format) if (!EXPORT_FORMATS.includes(f)) errors.push(`export_format unknown value "${f}"`);
  // element inclusion/exclusion (Part 27)
  for (const k of ["required_elements", "prohibited_elements"]) {
    if (!Array.isArray(spec[k])) { errors.push(`${k} must be an array`); continue; }
    if (!uniq(spec[k])) errors.push(`${k} must have unique entries`);
    if (spec[k].some((x) => !nonEmptyStr(x))) errors.push(`${k} entries must be non-empty strings`);
  }
  for (const x of spec.required_elements) if (spec.prohibited_elements.includes(x)) errors.push(`element "${x}" is both required and prohibited`);
  // policies
  if (!isObj(spec.logo_policy)) errors.push("logo_policy must be an object");
  if (!isObj(spec.cta_policy)) errors.push("cta_policy must be an object");
  else {
    if (typeof spec.cta_policy.required !== "boolean") errors.push("cta_policy.required must be a boolean");
    if (spec.cta_policy.copy_role != null && !COPY_ROLES.includes(spec.cta_policy.copy_role)) errors.push(`cta_policy.copy_role unknown "${spec.cta_policy.copy_role}"`);
    if (spec.cta_policy.required === true) {
      const hasCtaCopy = (spec.copy_blocks || []).some((b) => b?.role === "cta");
      const roleOk = spec.cta_policy.copy_role === "cta" && hasCtaCopy;
      if (!roleOk) errors.push("cta_policy.required=true requires an existing 'cta' copy block referenced by copy_role (CTA text is never invented here)");
    }
  }
  if (!isObj(spec.background_policy)) errors.push("background_policy must be an object");
  else if (!BACKGROUND_KINDS.includes(spec.background_policy.kind)) errors.push(`background_policy.kind unknown "${spec.background_policy.kind}"`);
  // truth requirements (Part 20)
  if (!isObj(spec.truth_requirements)) errors.push("truth_requirements must be an object");
  else {
    if (!WEIGHTING_PROFILES.includes(spec.truth_requirements.weighting_profile)) errors.push(`truth_requirements.weighting_profile "${spec.truth_requirements.weighting_profile}" is not an existing weighting profile`);
    if (spec.truth_requirements.truth_refs != null && !Array.isArray(spec.truth_requirements.truth_refs)) errors.push("truth_requirements.truth_refs must be an array");
  }
  // evidence requirements (Part 21 / 34)
  if (!Array.isArray(spec.evidence_requirements)) errors.push("evidence_requirements must be an array");
  else spec.evidence_requirements.forEach((e, i) => {
    if (!isObj(e)) { errors.push(`evidence_requirements[${i}] must be an object`); return; }
    if (!nonEmptyStr(e.evidence_id)) errors.push(`evidence_requirements[${i}].evidence_id is required`);
    if (e.evidence_type != null && !EVIDENCE_TYPES.includes(e.evidence_type)) errors.push(`evidence_requirements[${i}].evidence_type unknown "${e.evidence_type}"`);
  });
  if (EVIDENCE_SENSITIVE_PATTERNS.includes(spec.content_pattern)) {
    const needs = spec.content_pattern !== "COMPARISON" || spec.comparison_basis !== "INTERNAL_PRICE";
    if (needs && (spec.evidence_requirements || []).length === 0) errors.push(`${spec.content_pattern} requires a non-empty evidence_requirements reference (a template never authorizes a claim)`);
  }
  // price/membership structural rule (Part 35)
  const hasPriceCopy = (spec.copy_blocks || []).some((b) => PRICE_COPY_ROLES.includes(b?.role));
  if (hasPriceCopy && !(Array.isArray(spec.provenance?.truth_refs) && spec.provenance.truth_refs.length)) errors.push("price/members_price/offer copy requires a Product-Truth reference in provenance.truth_refs (prices are never invented or defaulted)");

  // multi-panel structure (Parts 29–31)
  const limits = ASSET_TYPE_LIMITS[spec.asset_type];
  const slides = spec.slides;
  const panelCount = limits && spec.asset_type === "SOCIAL_STATIC" ? 1 : spec.slide_count;
  if (spec.asset_type === "SOCIAL_STATIC") {
    if (slides !== undefined) errors.push("SOCIAL_STATIC must not declare slides[] (single panel)");
    if (spec.slide_count != null && spec.slide_count !== 1) errors.push("SOCIAL_STATIC must not declare slide_count > 1");
  } else if (limits) {
    if (typeof spec.slide_count !== "number") errors.push(`${spec.asset_type} requires slide_count`);
    else if (spec.slide_count < limits.min || spec.slide_count > limits.max) errors.push(`${spec.asset_type} slide_count must be between ${limits.min} and ${limits.max}`);
    if (!nonEmptyStr(spec.continuity_group)) errors.push(`${spec.asset_type} requires continuity_group (multi-panel continuity)`);
    if (!Array.isArray(slides) || slides.length === 0) errors.push(`${spec.asset_type} requires slides[]`);
    else {
      if (typeof spec.slide_count === "number" && slides.length !== spec.slide_count) errors.push(`slides.length (${slides.length}) must equal slide_count (${spec.slide_count})`);
      const idx = slides.map((s) => s?.slide_index);
      if (idx.some((i) => !num(i) || !Number.isInteger(i) || i < 1)) errors.push("slide_index must be 1-based integers");
      if (!uniq(idx)) errors.push("slide_index values must be unique");
      const sorted = [...idx].sort((a, b) => a - b);
      if (sorted.some((v, i) => v !== i + 1)) errors.push("slide_index values must be contiguous starting at 1");
      slides.forEach((s, i) => {
        const at = `slides[${i}]`;
        if (!isObj(s)) { errors.push(`${at} must be an object`); return; }
        if (!SEQUENCE_ROLES.includes(s.sequence_role)) errors.push(`${at}.sequence_role unknown "${s.sequence_role}"`);
        if (!ASSET_PURPOSES.includes(s.asset_purpose)) errors.push(`${at}.asset_purpose unknown "${s.asset_purpose}"`);
        if (!CONTENT_PATTERNS.includes(s.content_pattern)) errors.push(`${at}.content_pattern unknown "${s.content_pattern}"`);
        if (!LAYOUT_FAMILIES.includes(s.layout_family)) errors.push(`${at}.layout_family unknown "${s.layout_family}"`);
        if (s.density != null && !DENSITIES.includes(s.density)) errors.push(`${at}.density unknown "${s.density}"`);
        if (!Array.isArray(s.copy_blocks) || s.copy_blocks.length === 0) errors.push(`${at}.copy_blocks must be a non-empty array`);
        else validateCopyBlocks(s.copy_blocks, errors);
        if (s.visual_slots != null) validateVisualSlots(s.visual_slots, errors);
      });
      const roles = slides.map((s) => s?.sequence_role);
      if (!roles.includes("COVER")) errors.push(`${spec.asset_type} requires a COVER slide`);
      if (!roles.includes("ACT")) errors.push(`${spec.asset_type} requires an ACT (resolution/CTA) slide`);
    }
  }
  if (panelCount != null && limits && (panelCount < limits.min || panelCount > limits.max)) errors.push(`panel count ${panelCount} outside ${spec.asset_type} limits (${limits.min}-${limits.max})`);

  const status = deriveStatus(spec, errors);
  return { valid: errors.length === 0, errors, warnings, status, normalized: spec };
}

/** Lifecycle states for this layer only — no RENDERED/APPROVED/PUBLISHED exist in S-A. */
export function socialDesignStatus(spec) { return validateSocialDesignSpec(spec).status; }
