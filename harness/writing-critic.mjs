#!/usr/bin/env node
// Writing / Generation Control Layer — CRITIC + TARGETED REVISION + CHANGE CONTROL (§31-§33).
//
// (Governing prompt SEVENTH/EIGHTH; Swiipt_Writing_Generation_Control_Layer_v1.md §31/§32/§33.)
// The critic is SEPARATE from the generator and attempts to break the product. Deterministic
// controls always run; the LLM critic uses a replaceable provider adapter and is DORMANT by default.
// A PASS is never recorded when the LLM critic did not run — the status is NOT_RUN, and under strict
// publication mode a required-but-unavailable critic becomes HUMAN_REVIEW.
//
// Generation control — NOT an acceptance test. Acceptance Tests + Publishing Gates stay authoritative.
//
// Usage: node harness/writing-critic.mjs <PRODUCT_ID> [--strict]
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildGenerationBrief } from "./writing-control.mjs";
import { runWritingChecks } from "./writing-checks.mjs";
import { chatCompletion, resolveModel, STATUS } from "../lib/provider-client.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const finding = (code, status, severity, detail, where) => ({ code, status, severity, detail, where });

// ---- replaceable provider adapter (activation is configuration; no hard-coded credentials) ----
export const PROVIDERS = {
  none: {
    name: "none",
    async critique() { return { ran: false, status: "NOT_RUN", provider: "none", findings: [] }; },
  },
  openai: {
    name: "openai",
    async critique(payload, env = process.env) {
      const model = resolveModel("writing-critic", env);
      const res = await chatCompletion({
        worker: "writing-critic",
        model,
        temperature: 0,
        jsonMode: true,
        env,
        fetchImpl: env.__FETCH__ || null,
        messages: [
          { role: "system", content: "You are the Swiipt Writing Critic. Evaluate the CONTENT against the APPROVED CONTRACT and return JSON {\"findings\":[{\"status\":one of PASS|FAIL|WARNING|MISSING|UNSUPPORTED|SCOPE_DRIFT|TRANSFORMATION_WEAKNESS|WRITING_QUALITY_ISSUE|SAFETY_ISSUE,\"severity\":one of BLOCKER|WARNING|none,\"detail\":string,\"where\":string}]}. Fail only on NEVER/SCOPE_DRIFT/UNSUPPORTED/SAFETY_ISSUE. Never invent facts." },
          { role: "user", content: JSON.stringify(payload).slice(0, 120000) },
        ],
      });
      if (!res.ok) {
        return { ran: false, status: "NOT_RUN", provider: "openai", reason: res.status, attempt_status: res.status, model: res.model, endpoint_host: res.endpoint_host, error: res.error, findings: [] };
      }
      const parsed = res.json || {};
      const findings = (parsed.findings || []).map((f) => finding("llm_critic", f.status || "WARNING", f.severity === "BLOCKER" ? "BLOCKER" : "WARNING", f.detail || "", f.where || ""));
      return { ran: true, status: findings.some((f) => f.severity === "BLOCKER") ? "FAIL" : (findings.length ? "WARNING" : "PASS"), provider: "openai", attempt_status: STATUS.PROVIDER_SUCCESS, model: res.model, endpoint_host: res.endpoint_host, findings };
    },
  },
};

// ---- deterministic critique helpers ----
const STOP = new Set(["NEVER", "SCOPE_DRIFT", "UNSUPPORTED", "SAFETY_ISSUE"]);
const sev = (status) => (STOP.has(status) ? "BLOCKER" : "WARNING");

/** Conservative scope-drift check: does generated content still reference the approved situation? */
export function scopeCheck(brief, p) {
  const findings = [];
  const sig = (s) => new Set(String(s || "").toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 5));
  const sitWords = new Set([...sig(brief.situation?.person), ...sig(brief.situation?.specific_situation), ...sig(brief.situation?.problem)]);
  if (!sitWords.size) return findings;
  let contentWords = new Set();
  for (const rel of ["copy/landing-page.json", "copy/product-page.json"]) {
    const fp = join(root, "data", "products", brief.product_id, rel);
    if (existsSync(fp)) { try { contentWords = new Set([...contentWords, ...sig(readFileSync(fp, "utf8"))]); } catch { /* ignore */ } }
  }
  if (!contentWords.size) return findings;
  const overlap = [...sitWords].filter((w) => contentWords.has(w)).length / sitWords.size;
  if (overlap < 0.05) findings.push(finding("scope_drift", "SCOPE_DRIFT", "BLOCKER", `generated content shares almost no situation language with the approved contract (overlap ${(overlap * 100).toFixed(1)}%)`, "copy"));
  return findings;
}

/** Transformation-weakness check: is the after-state actually different from before, with a mechanism? */
export function transformationCheck(brief) {
  const findings = [];
  const as = brief.after_state || {};
  const changed = (as.new_capabilities?.length || 0) + (as.improvements?.length || 0) + (as.systems_created?.length || 0);
  if (!changed) findings.push(finding("transformation_weakness", "TRANSFORMATION_WEAKNESS", "WARNING", "after_state has no new capabilities / improvements / systems", "transformation"));
  if (!brief.mechanism?.core_mechanism) findings.push(finding("transformation_weakness", "TRANSFORMATION_WEAKNESS", "WARNING", "no core mechanism", "transformation"));
  return findings;
}

// ---- change control (§33): a revision must not silently change protected fields ----
export const PROTECTED_FIELDS = ["customer", "situation", "before_state", "after_state", "mechanism", "tsm", "product_role", "evidence_position", "safety_boundary"];
export function checkChangeControl(prevProduct, nextProduct) {
  const changes = [];
  const pick = (p) => ({
    customer: p.customer, product_role: p.commercial_role,
    evidence_position: p.evidence, safety_boundary: p.safety, tsm: p.tsm,
    before_state: p.transformation?.before_state, after_state: p.transformation?.after_state, mechanism: p.transformation?.mechanism,
  });
  const a = pick(prevProduct), b = pick(nextProduct);
  for (const field of PROTECTED_FIELDS) {
    if (field === "situation") continue;
    if (JSON.stringify(a[field]) !== JSON.stringify(b[field])) changes.push(field);
  }
  return changes.length
    ? [finding("upstream_contract_change", "UPSTREAM_CONTRACT_CHANGE_REQUIRED", "BLOCKER", `protected field(s) changed: ${changes.join(", ")}`, "product.json")]
    : [];
}

// ---- public entry ----
export async function runCritic(productId, { strict = false, env = process.env } = {}) {
  const briefRes = buildGenerationBrief(productId);
  if (!briefRes.ok) {
    return { product_id: productId, status: briefRes.status, critic_status: briefRes.status, llm_status: "NOT_RUN", llm_provider: "none",
      findings: briefRes.findings, blockers: briefRes.findings.length, warnings: 0 };
  }
  const brief = briefRes.brief;
  const p = JSON.parse(readFileSync(join(root, "data", "products", productId, "product.json"), "utf8"));

  const deterministic = [
    ...scopeCheck(brief, p),
    ...transformationCheck(brief),
    ...runWritingChecks(productId).findings,
  ];

  const providerName = (env.WRITING_CRITIC_PROVIDER || "none").toLowerCase();
  const adapter = PROVIDERS[providerName] || PROVIDERS.none;
  const llm = await adapter.critique({ brief, product: p }, env);

  const findings = [...deterministic, ...llm.findings];
  const blockers = findings.filter((f) => f.severity === "BLOCKER").length;
  const warnings = findings.filter((f) => f.severity === "WARNING").length;
  let status = blockers ? "FAIL" : (warnings ? "WARNING" : "PASS");

  // Never a fake PASS when the LLM critic did not run.
  const llmStatus = llm.ran ? llm.status : "NOT_RUN";
  if (strict && !llm.ran) status = "HUMAN_REVIEW";

  return { product_id: productId, status, critic_status: status, llm_status: llmStatus, llm_provider: adapter.name,
    llm_model: llm.model || resolveModel("writing-critic", env), llm_attempt_status: llm.attempt_status || (llm.ran ? STATUS.PROVIDER_SUCCESS : "NOT_RUN"),
    llm_reason: llm.ran ? null : (llm.reason || null), findings, blockers, warnings };
}

/** Targeted revision plan (§32): identify failure → reason → required change → upstream dependency. */
export function buildRevisionPlan(critique) {
  return critique.findings
    .filter((f) => f.status !== "PASS")
    .map((f) => ({
      failed_component: f.where || "product",
      reason: f.detail,
      required_change: f.severity === "BLOCKER" ? "must fix before publish" : "improve (style/structure)",
      upstream_dependency: ["SOURCE_REQUIRED", "MISSING", "UPSTREAM_CONTRACT_CHANGE_REQUIRED", "SCOPE_DRIFT"].includes(f.status) ? "Transformation Architect / Product Architect" : null,
      status: f.status,
      severity: f.severity,
    }));
}

if (process.argv[1] && process.argv[1].endsWith("writing-critic.mjs")) {
  const id = process.argv[2];
  const strict = process.argv.includes("--strict");
  if (!id) { console.error("usage: node harness/writing-critic.mjs <PRODUCT_ID> [--strict]"); process.exit(2); }
  runCritic(id, { strict }).then((r) => {
    console.log(JSON.stringify({ ...r, revision_plan: buildRevisionPlan(r) }, null, 2));
    process.exit(r.blockers ? 1 : 0);
  });
}
