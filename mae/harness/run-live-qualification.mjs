// MAE · LIVE qualification caller (thin entry point) + result persistence.
// It does NOT redesign anything: it builds the EXISTING adapter, calls the EXISTING runQualification,
// and persists the returned results honestly. No provider call happens without `--live`.
//
// Usage:
//   node mae/harness/run-live-qualification.mjs --provider mock --model m-1 --dry-run
//   node mae/harness/run-live-qualification.mjs --provider <p> --model <m> \
//        --base-url-env <P>_BASE_URL --api-key-env <P>_API_KEY --live
import { mkdirSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { MAE_DIR } from "../lib/store.js";
import { makeOpenAICompatibleImageAdapter, makeGeminiImageAdapter, redactSecrets } from "../media/image-provider.js";
import { runQualification } from "../services/visual-qualification-runner.js";
import { loadFixtures, computeFixtureHash, QUALIFICATION_BUDGET, ELIGIBILITY_POLICY } from "../services/visual-qualification.js";

export const RUN_STATUS = Object.freeze({
  DRY_RUN: "DRY_RUN",
  SKIPPED_REQUIRES_LIVE: "SKIPPED_REQUIRES_LIVE",
  COMPLETED: "COMPLETED",
  COMPLETED_WITH_FAILURES: "COMPLETED_WITH_FAILURES",
  ABORTED: "ABORTED",
  FAILED: "FAILED",
  INVALID_CONFIG: "INVALID_CONFIG",
});

export const POLICY_VERSION = "visual-qualification-policy@1.0";

const DEFAULT_OUT_ROOT = join(MAE_DIR, "storage", "exports", "qualification");
const DEFAULT_IMAGE_OUT = join(MAE_DIR, "storage", "work", "qualification");

export function safePathSegment(s) {
  return String(s == null ? "" : s).replace(/[^A-Za-z0-9._-]/g, "-").replace(/^-+/, "").slice(0, 80) || "unset";
}
export function defaultRunId(now) {
  return `${now().toISOString().replace(/[:.]/g, "-")}`;
}

/** Parse CLI args into a config object. */
export function parseArgs(argv = []) {
  const get = (flag, dflt = null) => {
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length && !String(argv[i + 1]).startsWith("--") ? argv[i + 1] : dflt;
  };
  const has = (flag) => argv.includes(flag);
  const provider = get("--provider");
  const model = get("--model");
  const upper = provider ? provider.toUpperCase().replace(/[^A-Z0-9]/g, "_") : null;
  const isGemini = /gemini/i.test(String(provider || ""));
  const isOpenAI = /openai/i.test(String(provider || ""));
  const defaultBaseEnv = isGemini ? "GEMINI_IMAGE_BASE_URL" : (isOpenAI ? "OPENAI_IMAGE_BASE_URL" : (upper ? `${upper}_BASE_URL` : null));
  const defaultKeyEnv = isGemini ? "GEMINI_IMAGE_API_KEY" : (isOpenAI ? "OPENAI_IMAGE_API_KEY" : (upper ? `${upper}_API_KEY` : null));
  return {
    provider,
    model,
    isGemini,
    adapterName: get("--adapter-name", provider),
    baseUrlEnv: get("--base-url-env", defaultBaseEnv),
    apiKeyEnv: get("--api-key-env", defaultKeyEnv),
    live: has("--live"),
    dryRun: has("--dry-run"),
    runId: get("--run-id", null),
    outRoot: get("--out-root", DEFAULT_OUT_ROOT),
    imageOut: get("--image-out", DEFAULT_IMAGE_OUT),
  };
}

function gitSha() { try { return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", cwd: join(MAE_DIR, "..") }).trim(); } catch { return null; } }

function writeJson(path, obj, env) {
  mkdirSync(dirname(path), { recursive: true });
  const text = redactSecrets(JSON.stringify(obj, null, 2) + "\n", env);
  writeFileSync(path, text);
  return path;
}

function pathsFor(imageOut, provider, fixtureId) {
  const dir = join(imageOut, safePathSegment(provider), safePathSegment(fixtureId));
  const images = []; const composites = [];
  if (existsSync(dir)) {
    for (const f of readdirSync(dir)) {
      if (f.toLowerCase().endsWith(".png") || /\.(jpe?g|webp)$/i.test(f)) images.push(join(dir, f));
      else if (f.toLowerCase().endsWith(".svg")) composites.push(join(dir, f));
    }
  }
  return { dir, images, composites };
}

/** Build the execution summary (execution metadata only — never invented). */
export function buildSummary({ provider, model, runId, startTime, endTime, run }) {
  const results = run.results || [];
  const gen = (s) => results.filter((r) => r.generation_status === s).length;
  const successful = gen("GENERATED");
  const failed = results.filter((r) => r.generation_status === "FAILED").length;
  const unavailable = gen("PROVIDER_UNAVAILABLE");
  const mismatches = results.filter((r) => r.returned_model && r.returned_model !== r.requested_model).length;
  const judgmentRequired = results.reduce((n, r) => n + (r.judgment_checks || []).filter((c) => c.status === "JUDGMENT_REQUIRED").length, 0);
  const blocking = [...new Set(results.flatMap((r) => r.blocking_failures || []))];
  const latencies = results.map((r) => r.latency_ms).filter((v) => typeof v === "number");
  const costs = results.map((r) => r.cost).filter((v) => typeof v === "number");
  const imagePaths = []; const compositorPaths = [];
  for (const r of results) {
    const p = pathsFor(run.imageOut, provider, r.fixture_id);
    imagePaths.push(...p.images); compositorPaths.push(...p.composites);
  }
  return {
    provider,
    requested_model: model,
    run_id: runId,
    start_time: startTime,
    end_time: endTime,
    fixture_count: results.length,
    base_calls: run.base_calls ?? null,
    retries: run.retries ?? null,
    total_calls: run.calls ?? null,
    successful_generations: successful,
    failed_generations: failed,
    model_mismatches: mismatches,
    provider_unavailable_count: unavailable,
    judgment_required_count: judgmentRequired,
    blocking_failures: blocking,
    aggregate_latency_ms: latencies.length ? latencies.reduce((a, b) => a + b, 0) : null,
    reported_cost: costs.length ? { per_fixture: results.map((r) => ({ fixture_id: r.fixture_id, cost: r.cost ?? null })), total: costs.reduce((a, b) => a + b, 0) } : null,
    image_paths: imagePaths,
    compositor_paths: compositorPaths,
    fixture_hashes: results.map((r) => ({ fixture_id: r.fixture_id, fixture_hash: r.fixture_hash })),
  };
}

/**
 * Core live caller. Programmatic + testable. Writes nothing unless it has something honest to write.
 * @returns {Promise<{status, runDir, resultsPath, summaryPath, manifestPath, calls, results}>}
 */
export async function runLiveQualification({ provider, model, adapter = null, env = {}, outRoot = DEFAULT_OUT_ROOT, imageOut = DEFAULT_IMAGE_OUT, runId = null, live = false, dryRun = false, fixtures = null, fetchImpl = null, now = () => new Date(), gitCommit = undefined, invalidReason = null } = {}) {
  const start = now();
  const rid = runId || defaultRunId(now);
  const safeProvider = safePathSegment(provider);
  const runDir = join(outRoot, safeProvider, safePathSegment(rid));
  const fset = fixtures || loadFixtures();
  const sha = gitCommit === undefined ? gitSha() : gitCommit;

  const manifestBase = {
    provider: provider ?? null,
    model: model ?? null,
    adapter: adapter ? adapter.name : null,
    fixture_ids: fset.map((f) => f.fixture_id),
    fixture_hashes: fset.map((f) => ({ fixture_id: f.fixture_id, fixture_hash: f.fixture_hash })),
    policy_version: POLICY_VERSION,
    zero_tolerance_classes: ELIGIBILITY_POLICY.zero_tolerance_classes,
    call_budget: QUALIFICATION_BUDGET,
    retry_policy: { controlled_retries_max_per_fixture: QUALIFICATION_BUDGET.controlled_retries_max_per_fixture, retryable_only: true, aesthetic_retries: false },
    storage_root: runDir,
    git_commit_sha: sha,
    start_timestamp: start.toISOString(),
    end_timestamp: null,
    status: null,
  };
  const finalizeManifest = (status) => writeJson(join(runDir, "run-manifest.json"), { ...manifestBase, end_timestamp: now().toISOString(), status }, env);
  const invalid = () => {
    const mp = finalizeManifest(RUN_STATUS.INVALID_CONFIG);
    return { status: RUN_STATUS.INVALID_CONFIG, runDir, resultsPath: null, summaryPath: null, manifestPath: mp, calls: 0, results: [] };
  };

  if (invalidReason) return invalid();
  if (!provider || !model) return invalid();

  // verify fixture hashes before any call
  for (const f of fset) if (computeFixtureHash(f) !== f.fixture_hash) {
    const mp = writeJson(join(runDir, "run-manifest.json"), { ...manifestBase, end_timestamp: now().toISOString(), status: RUN_STATUS.ABORTED, abort_reason: `fixture_hash_mismatch:${f.fixture_id}` }, env);
    return { status: RUN_STATUS.ABORTED, runDir, resultsPath: null, summaryPath: null, manifestPath: mp, calls: 0, results: [] };
  }

  if (dryRun && !live) {
    const mp = finalizeManifest(RUN_STATUS.DRY_RUN);
    return { status: RUN_STATUS.DRY_RUN, runDir, resultsPath: null, summaryPath: null, manifestPath: mp, calls: 0, results: [] };
  }
  if (!live) {
    const mp = finalizeManifest(RUN_STATUS.SKIPPED_REQUIRES_LIVE);
    return { status: RUN_STATUS.SKIPPED_REQUIRES_LIVE, runDir, resultsPath: null, summaryPath: null, manifestPath: mp, calls: 0, results: [] };
  }

  let run;
  try {
    run = await runQualification({ provider, model, adapter, env, fixtures: fset, fetchImpl, outDir: imageOut });
  } catch (e) {
    const mp = finalizeManifest(RUN_STATUS.FAILED);
    return { status: RUN_STATUS.FAILED, runDir, resultsPath: null, summaryPath: null, manifestPath: mp, calls: 0, results: [] };
  }
  run.imageOut = imageOut;

  if (run.aborted) {
    const mp = writeJson(join(runDir, "run-manifest.json"), { ...manifestBase, end_timestamp: now().toISOString(), status: RUN_STATUS.ABORTED, abort_reason: run.reason }, env);
    return { status: RUN_STATUS.ABORTED, runDir, resultsPath: null, summaryPath: null, manifestPath: mp, calls: run.calls || 0, results: [] };
  }

  const resultsPath = writeJson(join(runDir, "qualification-results.json"), run.results, env);
  const summary = buildSummary({ provider, model, runId: rid, startTime: start.toISOString(), endTime: now().toISOString(), run });
  const summaryPath = writeJson(join(runDir, "qualification-summary.json"), summary, env);
  const anyFailure = run.results.some((r) => r.generation_status !== "GENERATED" || r.overall_status === "FAIL");
  const manifestPath = finalizeManifest(anyFailure ? RUN_STATUS.COMPLETED_WITH_FAILURES : RUN_STATUS.COMPLETED);

  return { status: anyFailure ? RUN_STATUS.COMPLETED_WITH_FAILURES : RUN_STATUS.COMPLETED, runDir, resultsPath, summaryPath, manifestPath, calls: run.calls, results: run.results };
}

// ---- CLI --------------------------------------------------------------------
async function main() {
  const cfg = parseArgs(process.argv.slice(2));
  if (!cfg.provider || !cfg.model) {
    const runId = cfg.runId || defaultRunId(() => new Date());
    const runDir = join(cfg.outRoot, "_invalid", safePathSegment(runId));
    mkdirSync(runDir, { recursive: true });
    writeJson(join(runDir, "run-manifest.json"), { provider: cfg.provider ?? null, model: cfg.model ?? null, status: RUN_STATUS.INVALID_CONFIG, reason: "missing --provider or --model", start_timestamp: new Date().toISOString(), end_timestamp: new Date().toISOString() }, process.env);
    console.error("INVALID_CONFIG: --provider and --model are required. Wrote honest run-manifest.");
    process.exit(2);
  }
  const adapter = cfg.isGemini
    ? makeGeminiImageAdapter({ name: cfg.adapterName || "google-gemini", baseUrlEnv: cfg.baseUrlEnv, apiKeyEnv: cfg.apiKeyEnv })
    : makeOpenAICompatibleImageAdapter({ name: cfg.adapterName, baseUrlEnv: cfg.baseUrlEnv, apiKeyEnv: cfg.apiKeyEnv });
  const r = await runLiveQualification({ provider: cfg.provider, model: cfg.model, adapter, env: process.env, outRoot: cfg.outRoot, imageOut: cfg.imageOut, runId: cfg.runId, live: cfg.live, dryRun: cfg.dryRun });
  console.log(`status=${r.status} calls=${r.calls} run_dir=${r.runDir}`);
  if (r.summaryPath) console.log(`summary=${r.summaryPath}`);
  if (r.resultsPath) console.log(`results=${r.resultsPath}`);
  if (r.manifestPath) console.log(`manifest=${r.manifestPath}`);
  process.exit(r.status === RUN_STATUS.INVALID_CONFIG || r.status === RUN_STATUS.FAILED ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
