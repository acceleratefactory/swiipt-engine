// MAE · Visual qualification runner. Runs one image provider/model against the FROZEN 6-fixture set,
// enforcing the frozen call budget and honest failure states. Judgment dimensions stay
// JUDGMENT_REQUIRED — deterministic success never masquerades as a completed qualification.
// No real provider is invoked unless the owner configures credentials and calls this explicitly.
import { join } from "node:path";
import { MAE_DIR } from "../lib/store.js";
import { loadFixtures, computeFixtureHash, buildQualificationResult, QUALIFICATION_BUDGET } from "./visual-qualification.js";
import { canonicalImageRequest, invokeImageProvider, IMAGE_PROVIDER_STATUS } from "../media/image-provider.js";
import { Compositor, CompositorQA } from "../media/compositor.js";
import { VisualOutputQA } from "./visual-output-qa.js";

const GEN_STATUS = {
  [IMAGE_PROVIDER_STATUS.PROVIDER_SUCCESS]: "GENERATED",
  [IMAGE_PROVIDER_STATUS.MODEL_ID_MISMATCH]: "GENERATED",
  [IMAGE_PROVIDER_STATUS.PROVIDER_UNAVAILABLE]: "PROVIDER_UNAVAILABLE",
  [IMAGE_PROVIDER_STATUS.PROVIDER_ATTEMPT_FAILED]: "FAILED",
  [IMAGE_PROVIDER_STATUS.PROVIDER_RESPONSE_INVALID]: "FAILED",
  [IMAGE_PROVIDER_STATUS.IMAGE_DOWNLOAD_FAILED]: "FAILED",
  [IMAGE_PROVIDER_STATUS.IMAGE_ARTIFACT_INVALID]: "FAILED",
};

const defaultCopy = (fixture) => ({ headline: fixture.job_type.replace(/_/g, " "), body: "", cta: "" });

export async function runQualification({ provider = null, model = null, fixtures = null, adapter, env = {}, fetchImpl = null, timeoutMs = 60000, copyByFixture = {}, outDir = join(MAE_DIR, "storage", "work", "qualification") } = {}) {
  if (!adapter) return { aborted: true, reason: "no_adapter", calls: 0, retries: 0, results: [] };
  const fset = fixtures || loadFixtures();

  // 1) verify fixture hashes BEFORE any call
  for (const f of fset) {
    if (computeFixtureHash(f) !== f.fixture_hash) return { aborted: true, reason: "fixture_hash_mismatch", fixture_id: f.fixture_id, calls: 0, retries: 0, results: [] };
  }

  const maxCalls = QUALIFICATION_BUDGET.calls_max_per_provider;
  const baseBudget = fset.length; // 6 canonical fixtures x 1 generation
  let calls = 0;
  const retryLog = [];
  const results = [];
  const providerName = provider || adapter.name;

  for (const fixture of fset) {
    if (calls >= maxCalls) break;
    const dir = join(outDir, providerName, fixture.fixture_id);
    const request = canonicalImageRequest({ promptPackage: fixture.prompt_package, spec: fixture.visual_asset_spec });

    let attempt = 0;
    let invocation;
    // base attempt + at most ONE controlled retry, only when the failure is retryable, and only within budget
    while (true) {
      calls++;
      invocation = await invokeImageProvider({ adapter, request, model, env, fetchImpl, timeoutMs, dir, name: `${fixture.fixture_id}.png` });
      const retryable = invocation.retryable === true;
      if (invocation.status === IMAGE_PROVIDER_STATUS.PROVIDER_SUCCESS || invocation.status === IMAGE_PROVIDER_STATUS.MODEL_ID_MISMATCH) break;
      if (!retryable) break;
      if (attempt >= QUALIFICATION_BUDGET.controlled_retries_max_per_fixture) break;
      if (calls >= maxCalls) break;
      attempt++;
      retryLog.push({ fixture: fixture.fixture_id, reason: invocation.error_code || invocation.status, attempt });
    }

    // 7) deterministic checks (spec conformance + compositor QA when the asset is compound)
    const deterministic_checks = [];
    const det = fixture.deterministic_expected_checks || {};
    deterministic_checks.push({ check: "canvas_dimensions", pass: det.canvas_dimensions === `${request.width}x${request.height}`, detail: `${request.width}x${request.height}` });
    deterministic_checks.push({ check: "aspect_ratio", pass: det.aspect_ratio === request.aspect_ratio, detail: request.aspect_ratio });

    const success = invocation.status === IMAGE_PROVIDER_STATUS.PROVIDER_SUCCESS || invocation.status === IMAGE_PROVIDER_STATUS.MODEL_ID_MISMATCH;
    let compositorQA = null;
    if (success && invocation.local && invocation.local.ok && fixture.expected?.compound) {
      const imageSource = { uri: invocation.local.local_path, mime: invocation.local.mime_type, width: invocation.local.width || request.width, height: invocation.local.height || request.height, checksum: invocation.local.checksum, artifact_id: null };
      // bind the (possibly partial) fixture spec to its grounding so provenance is retained
      const vas = {
        ...fixture.visual_asset_spec,
        id: fixture.visual_asset_spec.id || `VAS-${fixture.fixture_id}`,
        visual_grounding_id: fixture.visual_asset_spec.visual_grounding_id || fixture.visual_grounding?.id || null,
      };
      const composed = Compositor.compose({ visualAssetSpec: vas, imageSource, copy: copyByFixture[fixture.fixture_id] || defaultCopy(fixture), outDir: dir });
      const c = fixture.expected.canvas || {};
      compositorQA = CompositorQA.check({ out: composed.out, artifactMeta: composed.artifactMeta, imageSource, expected: { canvas: { w: c.width, h: c.height }, imageRequired: true, overlayType: fixture.expected.deterministic_overlays && fixture.expected.deterministic_overlays.length ? undefined : "none" } });
      for (const chk of compositorQA.checks) deterministic_checks.push({ check: `compositor_${chk.check}`, pass: chk.pass, detail: chk.detail });
    }

    // 9) VisualOutputQA (judgment dimensions remain JUDGMENT_REQUIRED)
    const outputQA = VisualOutputQA.evaluate({ fixture, compositorQA, judgment: {}, deterministic: {} });
    const judgment_checks = outputQA.dimensions.filter((d) => d.status !== "PASS").map((d) => ({ dimension: d.id, class: d.class, status: d.status, reason: d.reason }));

    const detFail = deterministic_checks.some((c) => !c.pass);
    let overall_status;
    if (!success) overall_status = det.hard_fail_on_generation === false ? "FAIL" : "FAIL";
    else if (detFail) overall_status = "FAIL";
    else overall_status = outputQA.overall_status === "PASS" ? "PASS" : outputQA.overall_status;

    const result = buildQualificationResult({
      provider: providerName,
      requested_model: model,
      returned_model: invocation.returned_model ?? null,
      fixture_id: fixture.fixture_id,
      fixture_hash: fixture.fixture_hash,
      generation_status: GEN_STATUS[invocation.status] || "FAILED",
      artifact_id: null,
      latency_ms: invocation.latency_ms ?? null,
      cost: invocation.cost ?? null,
      seed_if_available: invocation.seed ?? null,
      provider_job_id: invocation.provider_job_id ?? null,
      deterministic_checks,
      judgment_checks,
      overall_status,
      blocking_failures: outputQA.blocking_failures,
      human_review_required: true,
      notes: [
        invocation.status,
        invocation.model_identity ? `model_identity=${invocation.model_identity}` : null,
        invocation.local && invocation.local.ok ? `local=${invocation.local.local_path}` : (invocation.error_message || null),
        detFail ? "deterministic_check_failed" : null,
        "judgment_dimensions_pending_human_or_vision_review",
      ].filter(Boolean).join(" | "),
    });
    results.push(result);
  }

  return { aborted: false, provider: providerName, model, fixtures_run: results.length, calls, retries: retryLog.length, retry_log: retryLog, budget: QUALIFICATION_BUDGET, max_calls: maxCalls, base_calls: baseBudget, results };
}
