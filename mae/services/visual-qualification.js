// MAE · Visual qualification harness contracts (provider-agnostic, pre-activation).
// Freezes the six qualification fixtures, a stable fixture hash (provider/model independent), the
// provider call budget, the eligibility policy and a machine-readable qualification result.
// No provider/vision/text model is called here.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { MAE_DIR } from "../lib/store.js";
import { validate } from "../lib/schema.js";
import { VISUAL_QA_DIMENSIONS, VISUAL_ZERO_TOLERANCE_CLASSES } from "./visual-output-qa.js";

export const FIX_DIR = join(MAE_DIR, "data", "fixtures", "visual-qualification");

export const FIXTURE_JOB_TYPES = Object.freeze({
  "VF-1": "HUMAN_LIFESTYLE_SCENE",
  "VF-2": "CULTURALLY_SPECIFIC_SCENE",
  "VF-3": "PRODUCT_OBJECT_VISUAL",
  "VF-4": "LANDING_PAGE_HERO",
  "VF-5": "EDUCATIONAL_ILLUSTRATION",
  "VF-6": "SOCIAL_CAROUSEL_VISUAL",
});
export const FIXTURE_IDS = Object.freeze(Object.keys(FIXTURE_JOB_TYPES));

// Provider/model identity must NEVER affect fixture identity.
const HASH_EXCLUDE_KEYS = new Set(["fixture_hash", "provider", "model", "returned_model", "requested_model", "seed_if_available", "created_at", "generated_at", "provider_job_id", "latency_ms", "cost"]);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value).sort()) {
      if (HASH_EXCLUDE_KEYS.has(k)) continue;
      out[k] = canonical(value[k]);
    }
    return out;
  }
  return value;
}

/** Stable canonical fixture hash. Provider/model/seed/timestamps are excluded by construction. */
export function computeFixtureHash(fixture) {
  const clone = JSON.parse(JSON.stringify(fixture || {}));
  return createHash("sha256").update(JSON.stringify(canonical(clone))).digest("hex");
}

export function loadFixture(id) {
  const p = join(FIX_DIR, `${id}.json`);
  if (!existsSync(p)) throw new Error(`fixture not found: ${p}`);
  return JSON.parse(readFileSync(p, "utf8"));
}
export function loadFixtures() {
  if (!existsSync(FIX_DIR)) return [];
  return readdirSync(FIX_DIR).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(readFileSync(join(FIX_DIR, f), "utf8")));
}
export function validateFixture(fixture) { return validate("visual-qualification-fixture.schema.json", fixture, fixture.fixture_id); }

// ---- provider call budget (design only) -------------------------------------
export const QUALIFICATION_BUDGET = Object.freeze({
  providers_max: 4,
  fixtures: 6,
  calls_base: 6,                       // 6 fixtures x 1 generation
  controlled_retries_max_per_fixture: 1,
  calls_max_per_provider: 12,          // 6 base + up to 6 controlled retries
  larger_repeat_runs_only_if: "reliability variance requires it (not a default)",
});

// ---- eligibility policy (frozen before any model is tested) ------------------
export const ELIGIBILITY_POLICY = Object.freeze({
  zero_tolerance_classes: VISUAL_ZERO_TOLERANCE_CLASSES,
  not_eligible_if: [
    "provider reliability is poor (repeated transport/generation failure)",
    "returned model identity mismatches the request",
    "output violates Product Truth",
    "output violates safety",
    "output repeatedly invents unsupported scene details",
    "severe anatomical defects occur",
    "severe cultural misrepresentation occurs",
    "required composition / negative-space control fails",
    "unintended text contamination occurs where text must be deterministic",
  ],
  zero_tolerance_rationale: "PRODUCT_TRUTH_VIOLATION / SAFETY_VIOLATION / UNSUPPORTED_VISUAL_CLAIM / SEVERE_CULTURAL_MISREPRESENTATION are trust-breaking and cannot be averaged away by strong scores elsewhere; they block regardless of aggregate performance (mirrors the Premium Supervisor zero-tolerance principle).",
  no_arbitrary_numeric_thresholds: "Numeric thresholds for scalar dimensions (e.g. interchangeability rate, artifact rate) are NOT frozen until the first controlled qualification run provides empirical spread.",
});

export const METRICS_REQUIRING_CALIBRATION = Object.freeze([
  "interchangeability_rate",
  "artifact_rate",
  "anatomical_defect_rate",
  "cultural_fidelity_rate",
  "grounding_adherence_rate",
  "composition_control_rate",
  "provider_reliability_rate",
  "latency_p50/p95",
  "cost_per_asset",
]);

/** Machine-readable qualification result. Never fabricates provider/model/cost values. */
export function buildQualificationResult(partial = {}) {
  const result = {
    provider: partial.provider ?? null,
    requested_model: partial.requested_model ?? null,
    returned_model: partial.returned_model ?? null,
    fixture_id: partial.fixture_id ?? null,
    fixture_hash: partial.fixture_hash ?? null,
    generation_status: partial.generation_status ?? "NOT_RUN",
    artifact_id: partial.artifact_id ?? null,
    latency_ms: partial.latency_ms ?? null,
    cost: partial.cost ?? null,
    seed_if_available: partial.seed_if_available ?? null,
    provider_job_id: partial.provider_job_id ?? null,
    deterministic_checks: partial.deterministic_checks ?? [],
    judgment_checks: partial.judgment_checks ?? [],
    overall_status: partial.overall_status ?? "NOT_RUN",
    blocking_failures: partial.blocking_failures ?? [],
    human_review_required: partial.human_review_required ?? true,
    notes: partial.notes ?? null,
  };
  validate("visual-qualification-result.schema.json", result, `${result.provider || "unset"}/${result.fixture_id || "unset"}`);
  return result;
}

// ---- Development-only image provider capability record (empirical) -----------
// Two controlled real experiments (VF-2, VF-4) via 9Router -> Antigravity at $0. Recorded inside the
// existing qualification system so future routing/qualification does not rediscover it. This is NOT a
// production qualification and does NOT encode permanent pricing or an absolute geometry rule.
export const DEVELOPMENT_IMAGE_PROVIDERS = Object.freeze([
  Object.freeze({
    id: "9router/ag/gemini-3.1-flash-image",
    router: "9router",
    downstream: "antigravity",
    model: "ag/gemini-3.1-flash-image",
    integration_status: "REAL_PROVIDER_INTEGRATION_PROVEN",
    qualification_status: "NOT_PRODUCTION_QUALIFIED",
    provider_role: "DEVELOPMENT_ONLY",
    geometry_control: "GEOMETRY_UNRELIABLE",
    geometry_evidence_count: 2,
    observed_output_pattern: "1024x1024", // observed pattern only, NOT an absolute capability rule
    mime_observed: "image/jpeg",
    returned_model_identity: "UNVERIFIED",
    cost_observation: "OWNER_SPEND_ZERO_IN_TESTS", // observed in tests only
    cost_caveat: "provider pricing/quota metadata was not returned — this is NOT a permanent free-price claim",
    geometry_caveat: "both observed real generations returned 1024x1024 despite materially different requested aspect ratios (1080:1350 and 1200:630) — not an absolute capability rule",
    approved_uses: [
      "real_provider_development", "pipeline_integration_testing", "artifact_persistence_testing",
      "compositor_testing", "cover_croppable_source_imagery", "background_beneath_deterministic_typography",
      "non_geometry_critical_experimentation",
    ],
    not_approved_for: [
      "geometry_sensitive_hero_generation", "deliberate_negative_space_composition",
      "exact_aspect_ratio_generation", "production_qualification", "provider_native_layout_sensitive_assets",
    ],
    evidence: [
      { fixture_id: "VF-2", requested: { width: 1080, height: 1350, aspect_ratio: "1080:1350" }, actual: { width: 1024, height: 1024, aspect_ratio: "1024:1024" }, classification: "GEOMETRY_IGNORED", result_ref: "mae/storage/exports/qualification/9router/smoke-vf2-2026-09-13T20-42-54-175Z/qualification-results.json" },
      { fixture_id: "VF-4", requested: { width: 1200, height: 630, aspect_ratio: "1200:630" }, actual: { width: 1024, height: 1024, aspect_ratio: "1024:1024" }, classification: "GEOMETRY_IGNORED", result_ref: "mae/storage/exports/qualification/9router/exp2-vf4-2026-09-13T21-07-59-354Z/qualification-results.json" },
    ],
  }),
]);

/** Look up a development-provider record by id or model. */
export function developmentProviderRecord(id) {
  return DEVELOPMENT_IMAGE_PROVIDERS.find((p) => p.id === id || p.model === id) || null;
}
/** True only when a provider is actually production-qualified (this record is NOT). */
export function isProductionQualified(id) {
  const r = developmentProviderRecord(id);
  return !!r && r.qualification_status === "PRODUCTION_QUALIFIED";
}
/** Geometry-sensitive routing is allowed only for a production-qualified, geometry-reliable provider. */
export function geometrySensitiveRoutingAllowed(id) {
  const r = developmentProviderRecord(id);
  if (!r) return true; // unknown providers: unchanged default
  return r.qualification_status === "PRODUCTION_QUALIFIED" && r.geometry_control !== "GEOMETRY_UNRELIABLE";
}

export { VISUAL_QA_DIMENSIONS };
