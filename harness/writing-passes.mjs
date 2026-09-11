#!/usr/bin/env node
// Writing / Generation Control Layer — CONTROLLED GENERATION PASSES (§30).
//
// (gverning prompt SIXTH; Swiipt_Writing_Generation_Control_Layer_v1.md §30/§43.)
// Orchestrates: 1 Contract ingestion · 2 Architecture check · 3 Content generation ·
// 4 Implementation-asset generation · 5 Voice pass · 6 Anti-AI pass · 7 Transformation QA handoff.
// Reuses the existing generation path (harness/gen-content.mjs) rather than building a second one.
//
// Generation control — NOT an acceptance test. Acceptance Tests + Publishing Gates stay authoritative.
//
// Usage: node harness/writing-passes.mjs <PRODUCT_ID> [--no-generate]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { buildGenerationBrief, loadConfig } from "./writing-control.mjs";
import { runWritingChecks } from "./writing-checks.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Pass 2 — architecture check (deterministic, no prose).
function checkArchitecture(brief) {
  const findings = [];
  const need = (cond, code, status, detail) => { if (!cond) findings.push({ code, status, severity: "BLOCKER", detail }); };
  need(!!brief.situation?.specific_situation, "arch_situation", "SOURCE_REQUIRED", "no approved situation");
  need((brief.path ?? []).length >= 1, "arch_path", "SOURCE_REQUIRED", "no transformation path / module sequence");
  need((brief.assets ?? []).length >= 1, "arch_assets", "MISSING", "no required assets declared");
  need((brief.assets ?? []).length === 0 || brief.assets.every((a) => a.job && a.source_exists), "arch_asset_jobs", "MISSING", "an asset is missing its job or source content");
  need(Object.keys(brief.mechanism ?? {}).length > 0, "arch_mechanism", "SOURCE_REQUIRED", "no mechanism");
  need((brief.failure_map ? Object.keys(brief.failure_map).length : 0) >= 1 || (Array.isArray(brief.failure_map) && brief.failure_map.length >= 1), "arch_failure", "SOURCE_REQUIRED", "no failure-point map");
  need(![undefined, null].includes(brief.tsm) && Object.keys(brief.tsm ?? {}).length > 0, "arch_tsm", "SOURCE_REQUIRED", "no TSM");
  need((brief.assets ?? []).length >= 1, "arch_formats", "MISSING", "no delivery formats derivable");
  return findings;
}

const PASS4 = new Set(["asset_raw_html", "asset_widget_unbalanced"]);
const PASS5 = new Set(["voice_monotony", "voice_person"]);
const PASS6 = new Set(["NEVER_phrase", "filler", "repetition", "heading_excess", "bullet_excess"]);

export function runPasses(productId, { generate = true } = {}) {
  const cfg = loadConfig();
  const passes = [];

  // ---- Pass 1: contract ingestion ----
  const briefRes = buildGenerationBrief(productId);
  passes.push({ id: 1, name: "contract_ingestion", status: briefRes.ok ? "PASS" : briefRes.status, findings: briefRes.findings });
  if (!briefRes.ok) {
    return { product_id: productId, writing_control_version: cfg.writing_control_version, status: briefRes.status,
      passes, blockers: briefRes.findings.length, warnings: 0, handoff: null };
  }
  const brief = briefRes.brief;

  // ---- Pass 2: architecture check ----
  const arch = checkArchitecture(brief);
  passes.push({ id: 2, name: "architecture_check", status: arch.length ? arch[0].status : "PASS", findings: arch });
  if (arch.length) {
    return { product_id: productId, writing_control_version: cfg.writing_control_version, status: arch[0].status,
      passes, blockers: arch.length, warnings: 0, handoff: null };
  }

  // ---- Pass 3: content generation (existing path) ----
  let genOk = true, genMsg = "skipped (--no-generate)";
  if (generate) {
    try {
      genMsg = execFileSync(process.execPath, [join(root, "harness", "gen-content.mjs"), productId], { cwd: root, encoding: "utf8" }).trim();
    } catch (e) { genOk = false; genMsg = (e.stdout || e.message || "").toString().slice(0, 300); }
  }
  passes.push({ id: 3, name: "content_generation", status: genOk ? "PASS" : "FAIL", findings: genOk ? [] : [{ code: "content_generation_failed", status: "FAIL", severity: "BLOCKER", detail: genMsg }] });
  if (!genOk) {
    return { product_id: productId, writing_control_version: cfg.writing_control_version, status: "FAIL",
      passes, blockers: 1, warnings: 0, handoff: null };
  }

  // ---- Passes 4-6: deterministic writing controls ----
  const wc = runWritingChecks(productId);
  const p4 = wc.findings.filter((f) => PASS4.has(f.code));
  const p5 = wc.findings.filter((f) => PASS5.has(f.code));
  const p6 = wc.findings.filter((f) => PASS6.has(f.code));
  passes.push({ id: 4, name: "implementation_asset_generation", status: p4.some((f) => f.severity === "BLOCKER") ? "FAIL" : (p4.length ? "WARNING" : "PASS"), findings: p4 });
  passes.push({ id: 5, name: "voice_pass", status: p5.length ? "WARNING" : "PASS", findings: p5 });
  passes.push({ id: 6, name: "anti_ai_pass", status: p6.some((f) => f.severity === "BLOCKER") ? "FAIL" : (p6.length ? "WARNING" : "PASS"), findings: p6 });

  // ---- Pass 7: transformation QA handoff (§30.7) ----
  const handoff = {
    target_customer: brief.situation?.person || brief.customer?.target_person || "",
    approved_situation: brief.situation?.specific_situation || "",
    before_state: brief.before_state,
    desired_after_state: brief.after_state,
    mechanism: brief.mechanism?.core_mechanism || "",
    key_actions: (brief.path ?? []).map((s) => s.objective || s.stage || ""),
    first_win: brief.first_win,
    failure_points: brief.failure_map,
    rescue_system: brief.failure_map,
    tsm: brief.tsm,
    maintenance: brief.maintenance,
    next_situation: brief.next_transformation_ids,
  };
  const missingHandoff = Object.entries(handoff).filter(([, v]) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0)).map(([k]) => k);
  passes.push({ id: 7, name: "transformation_qa_handoff", status: missingHandoff.length ? "WARNING" : "PASS", findings: missingHandoff.map((k) => ({ code: "handoff_missing", status: "MISSING", severity: "WARNING", detail: `handoff field empty: ${k}` })) });

  const blockers = passes.flatMap((p) => p.findings).filter((f) => f.severity === "BLOCKER").length;
  const warnings = passes.flatMap((p) => p.findings).filter((f) => f.severity === "WARNING").length;
  const status = blockers ? "FAIL" : (warnings ? "WARNING" : "PASS");
  return { product_id: productId, writing_control_version: cfg.writing_control_version, status, passes, blockers, warnings, handoff };
}

if (process.argv[1] && process.argv[1].endsWith("writing-passes.mjs")) {
  const id = process.argv[2];
  const generate = !process.argv.includes("--no-generate");
  if (!id) { console.error("usage: node harness/writing-passes.mjs <PRODUCT_ID> [--no-generate]"); process.exit(2); }
  const r = runPasses(id, { generate });
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.blockers ? 1 : 0);
}
