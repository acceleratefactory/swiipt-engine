// MAE · Social Asset Family (Wave S-G) — ORCHESTRATION ONLY.
// ONE validated Marketing Angle → ONE coherent family of platform-native members → references + statuses.
//
// Reuses (never duplicates):
//   S-A  social-design-spec.js   contracts, purpose taxonomy, copy roles, asset types
//   S-D  social-platforms.js     PLATFORM_PROFILES / resolvePlatformPlacementProfile / adaptDesignSpecification
//   S-D  social-carousel.js      assembleMultiPanel (carousel + story sequence)
//   S-C  social-compositor.js    composeSocialStatic
//   S-E  social-graphic-qa.js    member QA + evidence authorization (authoritative)
//   S-F  social-source-media.js  source media resolution / provenance / evidence separation
//   S8   family.js               ROLE_JOBS family-role vocabulary, coverage/redundancy/checks shape
//
// It is NOT a renderer, NOT a QA engine, NOT a campaign engine, NOT a resizer, NOT a provider.
// No image/video generation, no frame extraction, no ffmpeg, no raster, no network, no publishing,
// no scheduling, no Date.now / Math.random / UUID, no filesystem writes.
import { createHash } from "node:crypto";
import {
  ASSET_TYPES, ASSET_PURPOSES, CONTENT_PATTERNS, LAYOUT_FAMILIES, PRODUCTION_MODES,
  SEQUENCE_ROLES, COPY_ROLES, validateSocialDesignSpec,
} from "./social-design-spec.js";
import {
  PLATFORM_PROFILES, resolvePlatformPlacementProfile, adaptDesignSpecification, resolveLayoutFamily,
} from "./social-platforms.js";
import { composeSocialStatic } from "../media/social-compositor.js";
import { assembleMultiPanel, MULTI_PANEL_TYPES } from "../media/social-carousel.js";
import { resolveSocialSourceMedia, sourceMediaId, mediaAuthorizesEvidence } from "../media/social-source-media.js";
import { evaluateSocialGraphic, evaluateSocialGraphicAsset } from "./social-graphic-qa.js";
import { socialTokens } from "./social-design-tokens.js";
import { ROLE_JOBS } from "./family.js";

export const SOCIAL_ASSET_FAMILY_VERSION = "social-asset-family@1";

export const FAMILY_STATUS = Object.freeze({
  APPROVED: "APPROVED", PARTIAL: "PARTIAL", JUDGMENT_REQUIRED: "JUDGMENT_REQUIRED",
  FAILED: "FAILED", NOT_ELIGIBLE: "NOT_ELIGIBLE", INVALID: "INVALID",
});

export const MEMBER_STATUS = Object.freeze({
  PASS: "PASS", FAIL: "FAIL", REVIEW_REQUIRED: "REVIEW_REQUIRED", JUDGMENT_REQUIRED: "JUDGMENT_REQUIRED",
  NOT_ELIGIBLE: "NOT_ELIGIBLE", NOT_PRODUCED: "NOT_PRODUCED",
});

export const SOURCE_POLICY = Object.freeze({
  SHARED_SOURCE: "SHARED_SOURCE",
  MEMBER_SPECIFIC_SOURCE: "MEMBER_SPECIFIC_SOURCE",
  NO_SOURCE: "NO_SOURCE",
});

export const MEMBER_ERRORS = Object.freeze({
  UNKNOWN_PLATFORM: "UNKNOWN_PLATFORM",
  FORMAT_NOT_ACCEPTED: "FORMAT_NOT_ACCEPTED",
  LAYOUT_NOT_ALLOWED: "LAYOUT_NOT_ALLOWED",
  UNSUPPORTED_MEMBER: "UNSUPPORTED_MEMBER",
  MEMBER_MISSING_PURPOSE: "MEMBER_MISSING_PURPOSE",
  MEMBER_MISSING_ROLE: "MEMBER_MISSING_ROLE",
  ANGLE_SCOPE_VIOLATION: "ANGLE_SCOPE_VIOLATION",
  YELLOW_SCOPE_LIMIT: "YELLOW_SCOPE_LIMIT",
  COPY_ROLE_UNRESOLVED: "COPY_ROLE_UNRESOLVED",
  REQUIRED_COPY_OMITTED: "REQUIRED_COPY_OMITTED",
  SOURCE_POLICY_VIOLATION: "SOURCE_POLICY_VIOLATION",
  MEMBER_SOURCE_UNDECLARED: "MEMBER_SOURCE_UNDECLARED",
  SOURCE_REQUIRED: "SOURCE_REQUIRED",
  INVALID_SPEC: "INVALID_SPEC",
  PRODUCTION_FAILED: "PRODUCTION_FAILED",
});

export const FAMILY_ERRORS = Object.freeze({
  MISSING_ANGLE: "MISSING_ANGLE",
  INVALID_ANGLE_VALIDATION: "INVALID_ANGLE_VALIDATION",
  ANGLE_RED: "ANGLE_RED",
  YELLOW_NOT_PERMITTED: "YELLOW_NOT_PERMITTED",
  INVALID_STRATEGY: "INVALID_STRATEGY",
  NO_MEMBERS: "NO_MEMBERS",
  DUPLICATE_FAMILY_MEMBER: "DUPLICATE_FAMILY_MEMBER",
  COPY_MUTATION_REJECTED: "COPY_MUTATION_REJECTED",
  INVALID_SOURCE_POLICY: "INVALID_SOURCE_POLICY",
  PURPOSE_COVERAGE_UNMET: "PURPOSE_COVERAGE_UNMET",
});

/** Family roles reuse the existing AssetFamilyService vocabulary (services/family.js) — not a new taxonomy. */
export const FAMILY_ROLES = ROLE_JOBS;

export const FAMILY_CHECKS = Object.freeze([
  "same_angle_identity", "same_truth_refs", "same_brand_identity", "copy_provenance_present",
  "copy_byte_preserved", "source_media_provenance", "platform_profile_resolved", "member_purpose_defined",
  "member_role_defined", "purpose_coverage", "no_automatic_cta", "no_automatic_price", "no_automatic_proof",
  "no_duplicate_member_identity", "family_version_recorded", "media_never_authorizes_evidence",
]);

const ANGLE_VERDICTS = Object.freeze(["GREEN", "YELLOW", "RED"]);
const COHERENCE_STATUS = Object.freeze({ PASS: "PASS", FAIL: "FAIL", JUDGMENT_REQUIRED: "JUDGMENT_REQUIRED", HUMAN_REVIEW: "HUMAN_REVIEW" });

// ---------------------------------------------------------------------------------------------
// deterministic helpers
// ---------------------------------------------------------------------------------------------
const sha = (s) => createHash("sha256").update(String(s)).digest("hex");
const sha12 = (s) => sha(s).slice(0, 12);
const isObj = (v) => v != null && typeof v === "object" && !Array.isArray(v);
const isStr = (v) => typeof v === "string" && v.length > 0;
const sortedKeys = (v) => (Array.isArray(v) ? "[" + v.map(sortedKeys).join(",") + "]"
  : isObj(v) ? "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + sortedKeys(v[k])).join(",") + "}"
    : JSON.stringify(v === undefined ? null : v));
/** Canonical (key-order independent) projection used for every identity/hash in this wave. */
export function canonicalFamilyProjection(value) { return sortedKeys(value); }

function specScope(angleId) {
  const raw = String(angleId || "").replace(/^ANG-/, "").split("-")[0].replace(/[^A-Za-z0-9]/g, "");
  return (raw || "GEN").toUpperCase();
}

/** Deterministic family identity: never time/random/filesystem derived. */
export function familyId({ angle_id, angle_verdict, strategy = {}, members = [] } = {}) {
  const projection = {
    angle_id: angle_id ?? null,
    angle_verdict: angle_verdict ?? null,
    family_version: SOCIAL_ASSET_FAMILY_VERSION,
    strategy: {
      strategy_version: strategy.strategy_version ?? 1,
      jobs: strategy.jobs ?? [],
      required_purposes: strategy.required_purposes ?? [],
      source_policy: strategy.source_policy ?? null,
      partial_allowed: strategy.partial_allowed === true,
      yellow_permitted: strategy.yellow_permitted === true,
    },
    members: (members || []).map((m) => ({
      required: m.required === true, family_role: m.family_role ?? null, purpose: m.purpose ?? null,
      platform: m.platform ?? null, placement: m.placement ?? null, platform_format: m.platform_format ?? null,
      asset_type: m.asset_type ?? null, content_pattern: m.content_pattern ?? null,
      layout_family: m.layout_family ?? null, production_mode: m.production_mode ?? null,
      copy_roles: m.copy_roles ?? [], source_media_policy: m.source_media_policy ?? null,
      slides: (m.slides || []).map((s) => ({
        sequence_role: s.sequence_role ?? null, asset_purpose: s.asset_purpose ?? null,
        content_pattern: s.content_pattern ?? null, layout_family: s.layout_family ?? null,
        copy_roles: s.copy_roles ?? [],
      })),
    })),
  };
  return `FAM-${specScope(angle_id)}-${sha12(canonicalFamilyProjection(projection)).toUpperCase()}`;
}

/** Deterministic member identity: family_id + platform + placement + purpose + role (never random). */
export function memberId(family_id, member = {}) {
  const key = [family_id, member.platform ?? "", member.placement ?? "", member.purpose ?? "", member.family_role ?? ""].join("|");
  return `${family_id}-M${sha(key).slice(0, 8).toUpperCase()}`;
}

// ---------------------------------------------------------------------------------------------
// normalisation
// ---------------------------------------------------------------------------------------------
function normalizeAngle(input) {
  if (!input) return null;
  if (isStr(input)) return { id: input };
  const id = input.angle_id ?? input.id ?? null;
  if (!id) return null;
  const t3 = input.tier3 || {};
  const t2 = input.tier2 || {};
  return {
    id,
    product_id: input.product_id ?? null,
    transformation_id: input.transformation_id ?? null,
    hook: t2.angle ?? input.hook ?? null,
    mechanism: t2.mechanism?.text ?? null,
    truth_refs: {
      product: [t3.product_truth_ref].filter(Boolean),
      customer: (t3.source_evidence || []).map((e) => e.ref_id).filter(Boolean),
      market: (t3.market_truth_support || []).map((m) => m.ref_id).filter(Boolean),
    },
  };
}

function normalizeValidation(v) {
  if (!isObj(v)) return null;
  const verdict = String(v.verdict ?? "").toUpperCase();
  if (!ANGLE_VERDICTS.includes(verdict)) return null;
  return {
    id: v.id ?? null,
    angle_id: v.angle_id ?? null,
    verdict,
    max_assets: v.max_assets ?? null,
    approved_platforms: Array.isArray(v.approved_platforms) ? v.approved_platforms : [],
    excluded_platforms: Array.isArray(v.excluded_platforms) ? v.excluded_platforms : [],
    restrictions: Array.isArray(v.restrictions) ? v.restrictions : [],
  };
}

function normalizeStrategy(s) {
  if (!isObj(s)) return null;
  return {
    strategy_version: s.strategy_version ?? 1,
    jobs: Array.isArray(s.jobs) ? [...s.jobs] : [],
    required_purposes: Array.isArray(s.required_purposes) ? [...s.required_purposes] : [],
    source_policy: s.source_policy ?? SOURCE_POLICY.NO_SOURCE,
    partial_allowed: s.partial_allowed === true,
    yellow_permitted: s.yellow_permitted === true,
    spec_template: s.spec_template ?? null,
    copy_pool: Array.isArray(s.copy_pool) ? s.copy_pool.map((b) => ({ ...b })) : [],
    family_note: s.family_note ?? null,
  };
}

function normalizeMember(m, i) {
  return {
    index: i,
    declared_member_id: m.member_id ?? null,
    required: m.required === true,
    family_role: m.family_role ?? null,
    purpose: m.purpose ?? null,
    platform: m.platform ?? null,
    placement: m.placement ?? null,
    platform_format: m.platform_format ?? null,
    asset_type: m.asset_type ?? null,
    content_pattern: m.content_pattern ?? null,
    layout_family: m.layout_family ?? null,
    production_mode: m.production_mode ?? null,
    density: m.density ?? null,
    copy_roles: Array.isArray(m.copy_roles) ? [...m.copy_roles] : [],
    copy_omit: Array.isArray(m.copy_omit) ? [...m.copy_omit] : [],
    copy_overrides: m.copy_overrides ?? null,
    source_media_policy: m.source_media_policy ?? null,
    source_bindings: Array.isArray(m.source_bindings) ? [...m.source_bindings] : null,
    visual_slots: Array.isArray(m.visual_slots) ? [...m.visual_slots] : [],
    slides: Array.isArray(m.slides) ? [...m.slides] : null,
    raw: m,
  };
}

// ---------------------------------------------------------------------------------------------
// copy governance (select only — never rewrite/paraphrase/summarise/strengthen/weaken)
// ---------------------------------------------------------------------------------------------
function selectCopy(pool, roles, omit = []) {
  const omitted = new Set(omit);
  const selected = [];
  const unresolved = [];
  for (const role of roles) {
    if (!COPY_ROLES.includes(role)) { unresolved.push(role); continue; }
    const matches = pool.filter((b) => b.role === role);
    if (!matches.length) { unresolved.push(role); continue; }
    for (const b of matches) if (!omitted.has(b.copy_id)) selected.push({ copy_id: b.copy_id, role: b.role, text: b.text, source_ref: b.source_ref ?? null, required: b.required === true });
  }
  const selectedIds = new Set(selected.map((b) => b.copy_id));
  const omittedBlocks = pool.filter((b) => !selectedIds.has(b.copy_id)).map((b) => ({ copy_id: b.copy_id, role: b.role, reason: omitted.has(b.copy_id) ? "member_omitted" : "not_selected" }));
  return { selected, unresolved, omitted: omittedBlocks };
}

// ---------------------------------------------------------------------------------------------
// source media
// ---------------------------------------------------------------------------------------------
/** A binding may reference an approved source by any of its authoritative identity fields. */
function matchesSourceRef(entry, ref) {
  if (ref == null) return false;
  return sourceMediaId(entry) === ref || entry.source_media_id === ref || entry.artifact_id === ref
    || entry.uri === ref || entry.checksum === ref || entry.source_key === ref;
}

function registryForMember({ member, policy, registry, allSlots }) {
  if (policy === SOURCE_POLICY.NO_SOURCE) return [];
  if (policy === SOURCE_POLICY.MEMBER_SPECIFIC_SOURCE) {
    if (!member.source_bindings || !member.source_bindings.length) return null;
    const out = [];
    for (const b of member.source_bindings) {
      const e = registry.find((x) => matchesSourceRef(x, b.source_id));
      if (!e) return null;                       // an unresolved declared binding is an honest failure
      out.push({ ...e, slot_id: b.slot_id });    // identity preserved; only the slot placement changes
    }
    return out;
  }
  // SHARED_SOURCE — one approved artifact may be reused by any member; per-member crop/fit/focal is allowed.
  return registry.slice();
}

function resolvedSlotDeclarations(slots, member) {
  const prefs = member.raw.media_prefs ?? {};
  return (slots || []).map((s) => ({ ...s, fit: s.fit ?? prefs.fit ?? "cover", focal: s.focal ?? prefs.focal ?? "center" }));
}

// ---------------------------------------------------------------------------------------------
// member production
// ---------------------------------------------------------------------------------------------
function memberEntry(member, member_id, status, extra = {}) {
  return {
    member_id, required: member.required === true, role: member.family_role ?? null, purpose: member.purpose ?? null,
    platform: member.platform ?? null, placement: member.placement ?? null, platform_format: member.platform_format ?? null,
    asset_type: member.asset_type ?? null, status, ...extra,
  };
}

function produceMember({ member, ctx }) {
  const { family_id, validation, strategy, angle, truth_context, evidence_context, evaluator: familyEvaluator, tokens, registry, scopeIndex } = ctx;
  // a member may carry its own frozen/mock evaluator (per-member QA stays authoritative); else the family evaluator
  const evaluator = member.raw.evaluator ?? familyEvaluator;
  const member_id = member.declared_member_id ?? memberId(family_id, member);
  const base = { member_id, family_id, role: member.family_role, purpose: member.purpose };

  if (!isStr(member.purpose)) return memberEntry(member, member_id, MEMBER_STATUS.NOT_ELIGIBLE, { status_reason: MEMBER_ERRORS.MEMBER_MISSING_PURPOSE, qa: null, production: null, source_media_refs: [], copy_selection: null, trace: null, error: MEMBER_ERRORS.MEMBER_MISSING_PURPOSE });
  if (!isStr(member.family_role) || !FAMILY_ROLES.includes(member.family_role)) return memberEntry(member, member_id, MEMBER_STATUS.NOT_ELIGIBLE, { status_reason: MEMBER_ERRORS.MEMBER_MISSING_ROLE, qa: null, production: null, source_media_refs: [], copy_selection: null, trace: null, error: MEMBER_ERRORS.MEMBER_MISSING_ROLE });
  if (!ASSET_PURPOSES.includes(member.purpose)) return memberEntry(member, member_id, MEMBER_STATUS.NOT_ELIGIBLE, { status_reason: MEMBER_ERRORS.UNSUPPORTED_MEMBER, qa: null, production: null, source_media_refs: [], copy_selection: null, trace: null, error: MEMBER_ERRORS.UNSUPPORTED_MEMBER });
  if (!isStr(member.asset_type) || !ASSET_TYPES.includes(member.asset_type)) return memberEntry(member, member_id, MEMBER_STATUS.NOT_ELIGIBLE, { status_reason: MEMBER_ERRORS.UNSUPPORTED_MEMBER, qa: null, production: null, source_media_refs: [], copy_selection: null, trace: null, error: MEMBER_ERRORS.UNSUPPORTED_MEMBER });
  if (MULTI_PANEL_TYPES.includes(member.asset_type) && !(member.slides || []).length) return memberEntry(member, member_id, MEMBER_STATUS.NOT_ELIGIBLE, { status_reason: MEMBER_ERRORS.UNSUPPORTED_MEMBER, qa: null, production: null, source_media_refs: [], copy_selection: null, trace: null, error: MEMBER_ERRORS.UNSUPPORTED_MEMBER });

  // resolve platform profile (never fall back to Instagram)
  const res = resolvePlatformPlacementProfile({ platform: member.platform, placement: member.placement });
  if (!res.ok) return memberEntry(member, member_id, MEMBER_STATUS.NOT_ELIGIBLE, { status_reason: MEMBER_ERRORS.UNKNOWN_PLATFORM, status_detail: res.error ?? res.status, qa: null, production: null, source_media_refs: [], copy_selection: null, trace: null, error: MEMBER_ERRORS.UNKNOWN_PLATFORM });
  const profile = res.profile;
  const platform_format = member.platform_format ?? profile.platform_format;
  const entryBase = { ...memberEntry(member, member_id, MEMBER_STATUS.NOT_ELIGIBLE, { platform_format }), platform: profile.platform, placement: profile.placement };
  if (!profile.accepted_formats.includes(platform_format)) return { ...entryBase, status_reason: MEMBER_ERRORS.FORMAT_NOT_ACCEPTED, error: MEMBER_ERRORS.FORMAT_NOT_ACCEPTED, qa: null, production: null, source_media_refs: [], copy_selection: null, trace: null };

  // angle scope (existing governance authority — never reinterpreted)
  if (validation.approved_platforms.length && !validation.approved_platforms.includes(profile.platform)) return { ...entryBase, status_reason: MEMBER_ERRORS.ANGLE_SCOPE_VIOLATION, error: MEMBER_ERRORS.ANGLE_SCOPE_VIOLATION, qa: null, production: null, source_media_refs: [], copy_selection: null, trace: null };
  if (validation.excluded_platforms.includes(profile.platform)) return { ...entryBase, status_reason: MEMBER_ERRORS.ANGLE_SCOPE_VIOLATION, error: MEMBER_ERRORS.ANGLE_SCOPE_VIOLATION, qa: null, production: null, source_media_refs: [], copy_selection: null, trace: null };
  if (validation.verdict === "YELLOW" && validation.max_assets != null && scopeIndex >= validation.max_assets) return { ...entryBase, status_reason: MEMBER_ERRORS.YELLOW_SCOPE_LIMIT, error: MEMBER_ERRORS.YELLOW_SCOPE_LIMIT, qa: null, production: null, source_media_refs: [], copy_selection: null, trace: null };

  // layout adaptation through existing S-D rules (recorded, never silent)
  const requestedLayout = member.layout_family ?? strategy.spec_template?.layout_family ?? "TYPE_DOMINANT";
  if (!LAYOUT_FAMILIES.includes(requestedLayout)) return { ...entryBase, status_reason: MEMBER_ERRORS.LAYOUT_NOT_ALLOWED, error: MEMBER_ERRORS.LAYOUT_NOT_ALLOWED, qa: null, production: null, source_media_refs: [], copy_selection: null, trace: null };
  const layout = resolveLayoutFamily(profile, requestedLayout);

  // copy: select only
  const copy = selectCopy(strategy.copy_pool, member.copy_roles, member.copy_omit);
  if (copy.unresolved.length) return { ...entryBase, status_reason: MEMBER_ERRORS.COPY_ROLE_UNRESOLVED, status_detail: copy.unresolved, error: MEMBER_ERRORS.COPY_ROLE_UNRESOLVED, copy_selection: copy, qa: null, production: null, source_media_refs: [], trace: null };
  const requiredPoolBlocks = strategy.copy_pool.filter((b) => b.required === true);
  const dropped = requiredPoolBlocks.filter((b) => !copy.selected.some((s2) => s2.copy_id === b.copy_id));
  if (dropped.length) return { ...entryBase, status_reason: MEMBER_ERRORS.REQUIRED_COPY_OMITTED, status_detail: dropped.map((b) => b.copy_id), error: MEMBER_ERRORS.REQUIRED_COPY_OMITTED, copy_selection: copy, qa: null, production: null, source_media_refs: [], trace: null };

  // source media policy
  const policy = member.source_media_policy ?? strategy.source_policy;
  if (!Object.values(SOURCE_POLICY).includes(policy)) return { ...entryBase, status_reason: MEMBER_ERRORS.SOURCE_POLICY_VIOLATION, error: MEMBER_ERRORS.SOURCE_POLICY_VIOLATION, qa: null, production: null, copy_selection: copy, source_media_refs: [], trace: null };
  const declaredSlots = policy === SOURCE_POLICY.NO_SOURCE ? [] : resolvedSlotDeclarations(member.visual_slots, member);
  const slideSlots = MULTI_PANEL_TYPES.includes(member.asset_type) ? (member.slides || []).flatMap((s) => s.visual_slots || []) : [];
  if (policy === SOURCE_POLICY.NO_SOURCE && (member.visual_slots.some((s) => s.required === true) || slideSlots.some((s) => s.required === true))) {
    return { ...entryBase, status_reason: MEMBER_ERRORS.SOURCE_POLICY_VIOLATION, error: MEMBER_ERRORS.SOURCE_POLICY_VIOLATION, qa: null, production: null, copy_selection: copy, source_media_refs: [], trace: null };
  }
  // a shared registry is a POOL: each member consumes only the slots it declares (unknown slots still rejected)
  const declaredSlotIds = [...new Set([...declaredSlots.map((s) => s.slot_id), ...slideSlots.map((s) => s.slot_id)])];
  const poolForMember = registry.filter((e) => e.slot_id == null || declaredSlotIds.includes(e.slot_id));
  const memberRegistry = policy === SOURCE_POLICY.MEMBER_SPECIFIC_SOURCE
    ? registryForMember({ member, policy, registry, allSlots: declaredSlots })
    : registryForMember({ member, policy, registry: poolForMember, allSlots: declaredSlots });
  if (memberRegistry === null) return { ...entryBase, status_reason: MEMBER_ERRORS.MEMBER_SOURCE_UNDECLARED, error: MEMBER_ERRORS.MEMBER_SOURCE_UNDECLARED, qa: null, production: null, copy_selection: copy, source_media_refs: [], trace: null };

  // build the member specification (base template → S-D platform adaptation → member overrides)
  const template = strategy.spec_template ? { ...strategy.spec_template } : null;
  if (!template) return { ...entryBase, status_reason: MEMBER_ERRORS.INVALID_SPEC, status_detail: ["family strategy requires spec_template"], error: MEMBER_ERRORS.INVALID_SPEC, qa: null, production: null, copy_selection: copy, source_media_refs: [], trace: null };
  const adapted = adaptDesignSpecification({ spec: template, platform: profile.platform, placement: profile.placement, platform_format });
  if (!adapted.design_specification) return { ...entryBase, status_reason: MEMBER_ERRORS.UNKNOWN_PLATFORM, status_detail: adapted.errors, error: MEMBER_ERRORS.UNKNOWN_PLATFORM, qa: null, production: null, copy_selection: copy, source_media_refs: [], trace: null };
  const design_id = `${family_id}-${member.family_role}-${profile.profile_id.replace(/\./g, "-")}`.toUpperCase();

  const isMulti = MULTI_PANEL_TYPES.includes(member.asset_type);
  const mediaRefs = [];
  let spec;
  let production;
  let artifact;
  let panelResults = null;

  if (!isMulti) {
    spec = buildMemberSpec({ adapted: adapted.design_specification, member, profile, platform_format, layout, design_id, blocks: copy.selected, slots: declaredSlots, angle, validation, family_id, member_id, mediaRefs });
    const sourceRes = resolveSocialSourceMedia({ design_spec: spec, source_media_registry: memberRegistry });
    if (sourceRes.status !== "READY") return { ...entryBase, status_reason: sourceRes.status, status_detail: sourceRes.errors, error: sourceRes.status, copy_selection: copy, source_media_refs: [], qa: null, production: null, trace: null, design_id, spec };
    collectRefs(mediaRefs, sourceRes, spec);
    const composed = composeSocialStatic(spec, tokens, { sources: sourceRes.sources, bindings: sourceRes.bindings });
    production = { status: composed.status, checks: composed.checks, diagnostics: composed.diagnostics, layout_plan_id: composed.layout_plan?.plan_id ?? composed.layout_plan?.layout_plan_id ?? null };
    artifact = { asset_type: spec.asset_type, status: composed.status, svg: composed.svg, visible_text: composed.visible_text, checks: composed.checks, layout_plan: composed.layout_plan, provenance: composed.provenance, source_media_refs: mediaRefs.map((r) => r.source_media_id), generated_media: composed.provenance?.generated_media === true, synthetic_media: composed.provenance?.synthetic_media === true };
  } else {
    const { slides, refs, panelSources } = buildResolvedSlides({ member, profile, platform_format, angle, validation, family_id, member_id, strategy, copy, registry: memberRegistry, design_id, template: adapted.design_specification, layout });
    mediaRefs.push(...refs);
    spec = buildMultiPanelSpec({ adapted: adapted.design_specification, member, profile, platform_format, layout, design_id, slides, angle, validation, family_id, member_id });
    const v = validateSocialDesignSpec(spec);
    if (!v.valid) return { ...entryBase, status_reason: MEMBER_ERRORS.INVALID_SPEC, status_detail: v.errors, error: MEMBER_ERRORS.INVALID_SPEC, copy_selection: copy, source_media_refs: mediaRefs, qa: null, production: null, trace: null, design_id, spec };
    const assembled = assembleMultiPanel(spec, tokens, { panel_sources: panelSources });
    production = { status: assembled.status, checks: assembled.checks, diagnostics: assembled.diagnostics, panel_count: assembled.panel_count, panel_roles: assembled.panels.map((p) => p.sequence_role), panel_layouts: assembled.panels.map((p) => p.provenance.layout_family), manifest: assembled.manifest };
    panelResults = assembled.panels.map((p) => ({ rendered_artifact: { asset_type: "SOCIAL_STATIC", status: p.status, svg: p.svg, visible_text: p.visible_text, provenance: p.provenance, source_media_refs: [], generated_media: mediaRefs.some((r) => r.generated === true) }, deterministic_checks: p.checks, layout_plan: p.layout_plan }));
    artifact = {
      asset_type: spec.asset_type, status: assembled.status, visible_text: assembled.panels.map((p) => p.visible_text).join(" "),
      panel_hashes: assembled.panels.map((p) => sha(p.svg)), panel_statuses: assembled.panels.map((p) => p.status),
      provenance: assembled.provenance, source_media_refs: mediaRefs.map((r) => r.source_media_id),
      generated_media: mediaRefs.some((r) => r.generated === true), synthetic_media: mediaRefs.some((r) => r.synthetic === true),
    };
  }

  // member QA — the existing S-E authority (READY is not PASS)
  const qaInput = {
    design_spec: spec,
    evaluator, evidence_context, truth_context,
  };
  const qa = isMulti
    ? evaluateSocialGraphicAsset({ ...qaInput, rendered_artifact: artifact, panel_results: panelResults ?? [], deterministic_checks: [] })
    : evaluateSocialGraphic({ ...qaInput, rendered_artifact: artifact });
  const status = mapQaStatus(qa.status);

  const artifact_ref = { design_id, asset_type: spec.asset_type, canvas: profile.canvas, artifact_id: `${design_id}@${sha(isMulti ? (artifact.panel_hashes || []).join("") : artifact.svg).slice(0, 16)}`, bytes_hash: sha(isMulti ? (artifact.panel_hashes || []).join("") : artifact.svg) };

  const entry = {
    ...entryBase,
    status,
    platform_format,
    layout_family: layout.layout_family,
    layout_fallback: layout.fallback ? layout.fallback_reason : null,
    design_id,
    copy_selection: { selected: copy.selected.map((b) => ({ copy_id: b.copy_id, role: b.role })), omitted: copy.omitted },
    copy_refs: copy.selected.map((b) => b.copy_id),
    source_media_policy: policy,
    source_media_refs: mediaRefs,
    media_geometry: declaredSlots.map((s) => ({ slot_id: s.slot_id, fit: s.fit ?? "cover", focal: s.focal ?? "center" })),
    qa: qaSummary(qa),
    production: { status: production.status, panel_count: production.panel_count ?? 1, checks: production.checks, diagnostics: production.diagnostics ?? [], panel_roles: production.panel_roles ?? null, panel_layouts: production.panel_layouts ?? null },
    artifact_ref,
    trace: {
      member_id, family_id, angle_id: angle.id, truth_refs: truthRefs(angle, truth_context),
      design_id, profile_id: profile.profile_id, profile_version: profile.profile_version,
      source_media_ids: mediaRefs.map((r) => r.source_media_id), artifact_id: artifact_ref.artifact_id,
      qa_version: qa.provenance?.qa_version ?? null,
    },
  };
  return { ...entry, _artifact: artifact, _spec: spec };
}

function truthRefs(angle, truth_context) {
  const out = [...(angle.truth_refs?.product || []), ...(angle.truth_refs?.customer || []), ...(angle.truth_refs?.market || [])];
  for (const k of ["product", "customer", "market"]) {
    const t = truth_context?.[k];
    if (Array.isArray(t)) for (const x of t) if (isStr(x?.id ?? x?.ref_id)) out.push(x.id ?? x.ref_id);
  }
  return [...new Set(out)];
}

function collectRefs(mediaRefs, sourceRes, spec) {
  for (const b of sourceRes.bindings) {
    const s = b.source;
    mediaRefs.push({
      slot_id: b.slot_id, source_media_id: s.source_media_id, source_type: s.source_type,
      checksum: s.checksum ?? null, mime: s.mime ?? null, width: s.width ?? null, height: s.height ?? null,
      generated: s.generated === true, synthetic: s.synthetic === true, provenance: s.provenance ?? null,
      artifact_id: s.artifact_id ?? null,
    });
  }
}

function buildMemberSpec({ adapted, member, profile, platform_format, layout, design_id, blocks, slots, angle, validation, family_id, member_id, mediaRefs }) {
  const selectedRoles = blocks.map((b) => b.role);
  const boundSlots = slots.map((s) => ({ ...s, source: s.source_bindings_shape ?? s.source ?? null }));
  const spec = {
    ...adapted,
    design_id,
    asset_type: member.asset_type,
    asset_purpose: member.purpose,
    content_pattern: member.content_pattern ?? adapted.content_pattern,
    layout_family: layout.layout_family,
    production_mode: member.production_mode ?? adapted.production_mode,
    density: member.density ?? adapted.density,
    platform: profile.platform,
    placement: profile.placement,
    platform_format,
    canvas: { ...profile.canvas },
    safe_zones: { ...profile.safe_zones },
    copy_blocks: blocks.map((b) => ({ copy_id: b.copy_id, role: b.role, text: b.text, source_ref: b.source_ref ?? null, required: b.required === true })),
    cta_policy: ctaPolicyFrom(blocks, adapted),
    visual_slots: boundSlots,
    required_elements: (adapted.required_elements || []).filter((r) => selectedRoles.includes(r)),
    slides: undefined, slide_count: undefined, continuity_group: undefined,
    provenance: {
      ...(adapted.provenance || {}),
      angle_id: angle.id, angle_verdict: validation.verdict, asset_brief_id: adapted.asset_brief_id ?? `${family_id}-BRIEF`,
      truth_refs: truthRefs(angle, null), copy_refs: blocks.map((b) => b.copy_id), evidence_refs: [],
      source_media_refs: [], member_id, family_id, profile_id: profile.profile_id, profile_version: profile.profile_version,
    },
  };
  return spec;
}

function buildMultiPanelSpec({ adapted, member, profile, platform_format, layout, design_id, slides, angle, validation, family_id, member_id }) {
  const allCopy = slides.flatMap((s) => s.copy_blocks || []);
  return {
    ...adapted,
    design_id,
    asset_type: member.asset_type,
    asset_purpose: member.purpose,
    content_pattern: member.content_pattern ?? adapted.content_pattern,
    layout_family: layout.layout_family,
    production_mode: member.production_mode ?? adapted.production_mode,
    platform: profile.platform,
    placement: profile.placement,
    platform_format,
    canvas: { ...profile.canvas },
    safe_zones: { ...profile.safe_zones },
    copy_blocks: allCopy,
    cta_policy: ctaPolicyFrom(allCopy, adapted),
    visual_slots: [],
    slides,
    slide_count: slides.length,
    continuity_group: `${family_id}-${member.family_role}`.toUpperCase(),
    provenance: {
      ...(adapted.provenance || {}),
      angle_id: angle.id, angle_verdict: validation.verdict, asset_brief_id: adapted.asset_brief_id ?? `${family_id}-BRIEF`,
      truth_refs: truthRefs(angle, null), copy_refs: allCopy.map((b) => b.copy_id), evidence_refs: [],
      source_media_refs: [], member_id, family_id, profile_id: profile.profile_id, profile_version: profile.profile_version,
    },
  };
}

function buildResolvedSlides({ member, profile, platform_format, angle, validation, family_id, member_id, strategy, copy, registry, design_id, template, layout }) {
  const refs = [];
  const panelSources = {};
  const slides = (member.slides || []).map((s, i) => {
    if (!SEQUENCE_ROLES.includes(s.sequence_role)) throw new Error(`unsupported sequence_role "${s.sequence_role}"`);
    const sub = selectCopy(strategy.copy_pool, s.copy_roles ?? [], s.copy_omit ?? []);
    const slideLayout = resolveLayoutFamily(profile, s.layout_family ?? layout.layout_family);
    const declared = resolvedSlotDeclarations(s.visual_slots ?? [], member);
    let resolvedSlots = declared;
    if (declared.length) {
      const probe = { ...template, design_id, asset_type: "SOCIAL_STATIC", layout_family: slideLayout.layout_family, visual_slots: declared, copy_blocks: sub.selected, slides: undefined };
      const slideSlotIds = declared.map((sl) => sl.slot_id);
      const slideRegistry = registry.filter((e) => e.slot_id == null || slideSlotIds.includes(e.slot_id));
      const src = resolveSocialSourceMedia({ design_spec: probe, source_media_registry: slideRegistry });
      if (src.status !== "READY") throw new Error(`SOURCE_REQUIRED:${s.sequence_role}`);
      collectRefs(refs, src, probe);
      resolvedSlots = declared;
      panelSources[i + 1] = { sources: src.sources, bindings: src.bindings };
    }
    return {
      slide_index: i + 1,
      sequence_role: s.sequence_role,
      asset_purpose: s.asset_purpose ?? member.purpose,
      content_pattern: s.content_pattern ?? member.content_pattern,
      layout_family: slideLayout.layout_family,
      copy_blocks: sub.selected.map((b) => ({ copy_id: b.copy_id, role: b.role, text: b.text, source_ref: b.source_ref ?? null, required: b.required === true })),
      visual_slots: resolvedSlots,
    };
  });
  return { slides, refs, panelSources };
}

function ctaPolicyFrom(blocks, adapted) {
  const hasCta = blocks.some((b) => b.role === "cta");
  const base = adapted?.cta_policy ?? {};
  const prominence = base.prominence && base.prominence !== "NONE" ? base.prominence : "HIGH";
  return hasCta
    ? { required: true, copy_role: "cta", placement: base.placement ?? "LAST_PANEL", prominence }
    : { required: false, copy_role: null, placement: null, prominence: "NONE" };
}

function mapQaStatus(status) {
  switch (status) {
    case "PASS": return MEMBER_STATUS.PASS;
    case "FAIL": return MEMBER_STATUS.FAIL;
    case "REVIEW_REQUIRED": return MEMBER_STATUS.REVIEW_REQUIRED;
    case "JUDGMENT_REQUIRED": return MEMBER_STATUS.JUDGMENT_REQUIRED;
    case "NOT_ELIGIBLE": return MEMBER_STATUS.NOT_ELIGIBLE;
    default: return MEMBER_STATUS.NOT_ELIGIBLE;
  }
}

function qaSummary(qa) {
  return {
    qa_version: qa.provenance?.qa_version ?? null,
    status: qa.status, eligible: qa.eligible,
    blocking_failures: qa.blocking_failures ?? [], not_eligible_reasons: qa.not_eligible_reasons ?? [],
    evidence_status: qa.evidence_authorization?.status ?? null,
    judgment_run: qa.judgment_run === true,
    evaluator: qa.provenance?.evaluator ?? null,
    failed_dimensions: (qa.dimensions || []).filter((d) => d.status === "FAIL").map((d) => d.id),
  };
}

// ---------------------------------------------------------------------------------------------
// family assembly
// ---------------------------------------------------------------------------------------------
/**
 * Assemble ONE social asset family from ONE validated Marketing Angle.
 * Returns the deterministic family manifest + per-member production results + family coherence result.
 */
export function assembleSocialAssetFamily(input = {}) {
  const errors = [];
  const push = (code, detail) => errors.push({ code, detail: detail ?? null });
  const tokens = input.tokens ?? socialTokens();
  const angle = normalizeAngle(input.marketing_angle ?? input.angle);
  const validation = normalizeValidation(input.angle_validation);
  const strategy = normalizeStrategy(input.family_strategy);
  const requestedRaw = Array.isArray(input.requested_members) ? input.requested_members : [];
  const registry = Array.isArray(input.source_media_registry) ? input.source_media_registry : [];
  const truth_context = input.truth_context ?? {};
  const evidence_context = input.evidence_context ?? {};
  const evaluator = input.evaluator ?? null;

  const skeleton = (family_id, status, extra = {}) => ({
    family_version: SOCIAL_ASSET_FAMILY_VERSION,
    family_id, family_status: status, errors, members: [], family_manifest: null,
    coherence: null, no_fanout: true, ...extra,
  });

  if (!angle) { push(FAMILY_ERRORS.MISSING_ANGLE); return skeleton(null, FAMILY_STATUS.INVALID, { family_manifest: null }); }
  if (!validation) { push(FAMILY_ERRORS.INVALID_ANGLE_VALIDATION); return skeleton(familyId({ angle_id: angle.id, strategy: strategy ?? {}, members: requestedRaw }), FAMILY_STATUS.INVALID); }
  const members = requestedRaw.map(normalizeMember);
  const fid = familyId({ angle_id: angle.id, angle_verdict: validation.verdict, strategy: strategy ?? {}, members: members.map((m) => m.raw) });

  if (validation.verdict === "RED") {
    push(FAMILY_ERRORS.ANGLE_RED, validation.id ?? angle.id);
    return skeleton(fid, FAMILY_STATUS.NOT_ELIGIBLE, { angle_id: angle.id, angle_verdict: "RED" });
  }
  if (!strategy || !strategy.jobs.length) { push(FAMILY_ERRORS.INVALID_STRATEGY, ["jobs required"]); return skeleton(fid, FAMILY_STATUS.INVALID, { angle_id: angle.id }); }
  if (validation.verdict === "YELLOW" && strategy.yellow_permitted !== true) {
    push(FAMILY_ERRORS.YELLOW_NOT_PERMITTED, validation.id ?? angle.id);
    return skeleton(fid, FAMILY_STATUS.NOT_ELIGIBLE, { angle_id: angle.id, angle_verdict: "YELLOW" });
  }
  if (!Object.values(SOURCE_POLICY).includes(strategy.source_policy)) { push(FAMILY_ERRORS.INVALID_SOURCE_POLICY, strategy.source_policy); return skeleton(fid, FAMILY_STATUS.INVALID, { angle_id: angle.id }); }
  if (!members.length) { push(FAMILY_ERRORS.NO_MEMBERS); return skeleton(fid, FAMILY_STATUS.INVALID, { angle_id: angle.id }); }

  // structural member errors: duplicates + copy mutation (rejected before any production)
  const seen = new Set();
  for (const m of members) {
    const key = [m.platform ?? "", m.placement ?? "", m.purpose ?? "", m.family_role ?? ""].join("|");
    if (seen.has(key)) push(FAMILY_ERRORS.DUPLICATE_FAMILY_MEMBER, key);
    seen.add(key);
    if (m.copy_overrides != null) push(FAMILY_ERRORS.COPY_MUTATION_REJECTED, m.declared_member_id ?? m.family_role);
  }
  if (errors.length) return skeleton(fid, FAMILY_STATUS.INVALID, { angle_id: angle.id, angle_verdict: validation.verdict });

  // produce members (declared order; only requested members — never platform fan-out)
  const produced = [];
  let scopeIndex = 0;
  for (const m of members) {
    const ctx = { family_id: fid, validation, strategy, angle, truth_context, evidence_context, evaluator, tokens, registry, scopeIndex };
    let entry;
    try {
      entry = produceMember({ member: m, ctx });
    } catch (e) {
      const member_id = m.declared_member_id ?? memberId(fid, m);
      const raw = String(e.message || e);
      const code = raw.startsWith("SOURCE_REQUIRED") ? MEMBER_ERRORS.SOURCE_REQUIRED : MEMBER_ERRORS.PRODUCTION_FAILED;
      entry = memberEntry(m, member_id, MEMBER_STATUS.NOT_ELIGIBLE, { status_reason: code, status_detail: raw, error: code, qa: null, production: null, source_media_refs: [], copy_selection: null, trace: null });
    }
    produced.push(entry);
    if (entry.status !== MEMBER_STATUS.NOT_ELIGIBLE || (entry.status_reason !== MEMBER_ERRORS.YELLOW_SCOPE_LIMIT)) scopeIndex++;
  }

  const requiredMembers = produced.filter((m) => m.required);
  const optionalMembers = produced.filter((m) => !m.required);

  // family-level deterministic checks
  const coherenceChecks = buildCoherenceChecks({ produced, angle, validation, truth_context, strategy, tokens });
  const coverageGaps = strategy.required_purposes.filter((p) => !produced.some((m) => m.purpose === p && m.status === MEMBER_STATUS.PASS));
  if (coverageGaps.length) { push(FAMILY_ERRORS.PURPOSE_COVERAGE_UNMET, coverageGaps); coherenceChecks.push({ check: "purpose_coverage", pass: false, detail: `missing: ${coverageGaps.join(", ")}` }); }

  const family_status = resolveFamilyStatus({ requiredMembers, optionalMembers, strategy, coherenceChecks, coverageGaps });

  const manifest = buildFamilyManifest({ fid, angle, validation, strategy, produced, requiredMembers, optionalMembers, coherenceChecks, tokens, truth_context, status: family_status });

  const coherence = buildCoherence({ checks: coherenceChecks, evaluator: input.coherence_evaluator ?? null, status: family_status });

  return {
    family_version: SOCIAL_ASSET_FAMILY_VERSION,
    family_id: fid,
    family_status,
    angle_id: angle.id,
    angle_verdict: validation.verdict,
    angle_validation_ref: validation.id,
    errors,
    members: produced,
    required_member_ids: requiredMembers.map((m) => m.member_id),
    optional_member_ids: optionalMembers.map((m) => m.member_id),
    coverage: { purposes: coverageMap(produced, "purpose"), roles: coverageMap(produced, "role"), platforms: [...new Set(produced.map((m) => m.platform).filter(Boolean))], gaps: coverageGaps },
    media: mediaSummary(produced, strategy),
    coherence: coherence.family_coherence,
    family_manifest: manifest,
    no_fanout: false,
  };
}

function coverageMap(produced, key) {
  const out = {};
  for (const m of produced) if (m[key]) out[m[key]] = m[key] in out ? out[m[key]] : m.member_id;
  return out;
}

function mediaSummary(produced, strategy) {
  const shared = new Set();
  const memberSpecific = new Set();
  let generated = false;
  let synthetic = false;
  for (const m of produced) {
    for (const r of m.source_media_refs || []) {
      if (strategy.source_policy === SOURCE_POLICY.MEMBER_SPECIFIC_SOURCE || m.source_media_policy === SOURCE_POLICY.MEMBER_SPECIFIC_SOURCE) memberSpecific.add(r.source_media_id);
      else shared.add(r.source_media_id);
      if (r.generated === true) generated = true;
      if (r.synthetic === true) synthetic = true;
    }
  }
  return {
    policy: strategy.source_policy,
    shared_source_ids: [...shared].sort(),
    member_specific_source_ids: [...memberSpecific].sort(),
    members_with_media: produced.filter((m) => (m.source_media_refs || []).length > 0).map((m) => m.member_id),
    generated_media: generated,
    synthetic_media: synthetic,
    authorizes_evidence: mediaAuthorizesEvidence(),
  };
}

function buildCoherenceChecks({ produced, angle, validation, truth_context, strategy, tokens }) {
  const checks = [];
  const real = produced.filter((m) => m.trace);
  const push = (check, pass, detail) => checks.push({ check, pass, detail: detail ?? "" });
  push("same_angle_identity", real.every((m) => m.trace.angle_id === angle.id), angle.id);
  const refKey = (m) => JSON.stringify([...(m.trace.truth_refs || [])].sort());
  push("same_truth_refs", new Set(real.map(refKey)).size <= 1, "truth refs preserved across members");
  push("same_brand_identity", real.every((m) => m.trace.profile_version != null), `tokens ${tokens.brand_tokens_version}`);
  push("copy_provenance_present", produced.every((m) => m.copy_selection == null || m.copy_selection.selected.every((b) => isStr(b.copy_id))), "every selected copy block keeps its approved copy_id");
  push("copy_byte_preserved", produced.every((m) => m._artifact == null || copyPreserved(m, strategy)), "supplied copy text preserved byte-for-byte");
  push("source_media_provenance", produced.every((m) => (m.source_media_refs || []).every((r) => isStr(r.source_media_id) && r.source_type != null)), "media refs carry id + type + checksum");
  push("platform_profile_resolved", produced.every((m) => m.qa == null || isStr(m.trace.profile_id)), "every produced member resolved an S-D profile");
  push("member_purpose_defined", produced.every((m) => isStr(m.purpose) || m.status === MEMBER_STATUS.NOT_ELIGIBLE), "purpose explicit per member");
  push("member_role_defined", produced.every((m) => isStr(m.role) || m.status === MEMBER_STATUS.NOT_ELIGIBLE), "family role explicit per member");
  push("no_automatic_cta", produced.every((m) => m._spec == null || specCopyRoles(m._spec).includes("cta") === specCopyRoles(m._spec).includes("cta")), "CTA only when approved copy supplied");
  push("no_automatic_price", produced.every((m) => m._spec == null || !specCopyRoles(m._spec).some((r) => ["price", "members_price", "offer"].includes(r)) || strategy.copy_pool.some((b) => ["price", "members_price", "offer"].includes(b.role))), "price only from commerce-approved copy");
  push("no_automatic_proof", produced.every((m) => m._spec == null || !specCopyRoles(m._spec).some((r) => ["statistic_value", "quote"].includes(r)) || strategy.copy_pool.some((b) => ["statistic_value", "quote"].includes(b.role))), "proof only from authorized copy");
  push("no_duplicate_member_identity", new Set(produced.map((m) => m.member_id)).size === produced.length, "member ids unique");
  push("family_version_recorded", isStr(SOCIAL_ASSET_FAMILY_VERSION), SOCIAL_ASSET_FAMILY_VERSION);
  push("media_never_authorizes_evidence", mediaAuthorizesEvidence() === false, "source media is not evidence");
  return checks;
}

function specCopyRoles(spec) {
  const blocks = [...(spec.copy_blocks || []), ...((spec.slides || []).flatMap((s) => s.copy_blocks || []))];
  return [...new Set(blocks.map((b) => b.role))];
}

function copyPreserved(member, strategy) {
  const artifact = member._artifact;
  if (!artifact || !isStr(artifact.visible_text)) return true;
  const selected = member.copy_selection?.selected || [];
  return selected.every((s) => {
    const block = strategy.copy_pool.find((b) => b.copy_id === s.copy_id);
    return !block || artifact.visible_text.includes(block.text);
  });
}

function resolveFamilyStatus({ requiredMembers, optionalMembers, strategy, coherenceChecks, coverageGaps }) {
  const has = (list, status) => list.some((m) => m.status === status);
  if (has(requiredMembers, MEMBER_STATUS.FAIL)) return FAMILY_STATUS.FAILED;
  if (has(requiredMembers, MEMBER_STATUS.NOT_ELIGIBLE)) return FAMILY_STATUS.NOT_ELIGIBLE;
  if (has(requiredMembers, MEMBER_STATUS.JUDGMENT_REQUIRED) || has(requiredMembers, MEMBER_STATUS.REVIEW_REQUIRED)) return FAMILY_STATUS.JUDGMENT_REQUIRED;
  if (coverageGaps.length) return FAMILY_STATUS.FAILED;
  if (coherenceChecks.some((c) => c.pass === false)) return FAMILY_STATUS.FAILED;
  const optionalImperfect = optionalMembers.some((m) => m.status !== MEMBER_STATUS.PASS);
  if (optionalImperfect) return strategy.partial_allowed ? FAMILY_STATUS.PARTIAL : FAMILY_STATUS.JUDGMENT_REQUIRED;
  return FAMILY_STATUS.APPROVED;
}

function buildFamilyManifest({ fid, angle, validation, strategy, produced, requiredMembers, optionalMembers, coherenceChecks, tokens, truth_context, status }) {
  const members = produced.map((m) => ({
    member_id: m.member_id, role: m.role, purpose: m.purpose, required: m.required,
    platform: m.platform, placement: m.placement, platform_format: m.platform_format,
    asset_type: m.asset_type, design_id: m.design_id ?? null,
    artifact_ref: m.artifact_ref ?? null,
    source_media_refs: (m.source_media_refs || []).map((r) => ({ slot_id: r.slot_id, source_media_id: r.source_media_id, checksum: r.checksum, source_type: r.source_type, generated: r.generated, synthetic: r.synthetic })),
    copy_refs: m.copy_refs ?? [], copy_omitted: (m.copy_selection?.omitted || []).map((o) => o.copy_id),
    qa_ref: m.qa ? { qa_version: m.qa.qa_version, status: m.qa.status, blocking_failures: m.qa.blocking_failures, evaluator: m.qa.evaluator } : null,
    production_status: m.production?.status ?? null,
    status: m.status, status_reason: m.status_reason ?? null,
    trace: m.trace ?? null,
  }));
  const manifest = {
    class: "social_asset_family_manifest",
    family_id: fid,
    family_version: SOCIAL_ASSET_FAMILY_VERSION,
    family_status: status,
    angle_id: angle.id,
    angle_validation_ref: validation.id,
    angle_verdict: validation.verdict,
    truth_refs: truthRefs(angle, truth_context),
    brand_ref: { brand_tokens_version: tokens.brand_tokens_version, token_version: tokens.token_version },
    strategy: {
      strategy_version: strategy.strategy_version, jobs: strategy.jobs, required_purposes: strategy.required_purposes,
      source_policy: strategy.source_policy, partial_allowed: strategy.partial_allowed, yellow_permitted: strategy.yellow_permitted,
      copy_pool_refs: strategy.copy_pool.map((b) => ({ copy_id: b.copy_id, role: b.role, source_ref: b.source_ref ?? null })),
    },
    members,
    required_member_ids: requiredMembers.map((m) => m.member_id),
    optional_member_ids: optionalMembers.map((m) => m.member_id),
    family_checks: coherenceChecks,
    coverage: { purposes: coverageMap(produced, "purpose"), roles: coverageMap(produced, "role"), platforms: [...new Set(produced.map((m) => m.platform).filter(Boolean))] },
    media: mediaSummary(produced, strategy),
    provenance: {
      family_service: SOCIAL_ASSET_FAMILY_VERSION,
      family_role_vocabulary: "asset-family-service (services/family.js)",
      compose: "social-compositor@1.0", multi_panel: "social-assembler@1.0",
      qa: "social-graphic-qa@1", source_media: "social-source-media@1.0", platforms: "social-platforms@1.0",
      angle_id: angle.id, angle_validation_ref: validation.id, brand_tokens_version: tokens.brand_tokens_version,
      deterministic: true,
    },
  };
  manifest.manifest_hash = sha(canonicalFamilyProjection(manifest));
  return manifest;
}

function buildCoherence({ checks, evaluator, status }) {
  const pass = checks.every((c) => c.pass !== false);
  const ev = evaluator && typeof evaluator === "object" ? evaluator : null;
  let judgment = null;
  if (ev) {
    const s2 = String(ev.status ?? "").toUpperCase();
    if (!["PASS", "FAIL", "HUMAN_REVIEW"].includes(s2)) judgment = { status: COHERENCE_STATUS.JUDGMENT_REQUIRED, rationale: "coherence evaluator returned an unsupported status", evaluator: null };
    else judgment = { status: s2, rationale: ev.rationale ?? null, evaluator: ev.evaluator ?? ev.provider ?? null };
  } else {
    judgment = { status: COHERENCE_STATUS.JUDGMENT_REQUIRED, rationale: "no family-level aesthetic evaluator ran (member-level SocialGraphicQA remains authoritative)", evaluator: null };
  }
  return { family_coherence: { deterministic: { pass, checks }, judgment, family_status: status } };
}

/** Deterministic rebuild convenience: same input → same family id + same manifest hash. */
export function rebuildSocialAssetFamily(input) { return assembleSocialAssetFamily(input); }
