#!/usr/bin/env node
// Writing / Generation Control Layer — PASS 1: CONTRACT INGESTION + STOP CONDITIONS.
//
// (Swiipt_Writing_Generation_Control_Layer_v1.md §2, §30 Pass 1, §42; governing prompt FOURTH/FIFTH.)
// Assembles the structured generation contract from the records and returns a Generation Brief
// (the non-negotiable product facts) — or a structured STOP status when the upstream contract is
// incomplete. It NEVER invents missing upstream decisions.
//
// This is a generation control, not an acceptance test: Acceptance Tests + Publishing Gates remain
// authoritative. If the upstream contract is thin, this returns SOURCE_REQUIRED / MISSING and the
// product returns upstream to the Transformation Architect.
//
// Usage:
//   node harness/writing-control.mjs <PRODUCT_ID>      -> brief + stop findings as JSON
//   node harness/writing-control.mjs --all             -> status line per product
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function loadConfig() {
  return JSON.parse(readFileSync(join(root, "config", "writing-control.v1.json"), "utf8"));
}

const isBlank = (v) =>
  v === undefined || v === null || v === "" ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);
const isBackfill = (s) => typeof s === "string" && /^backfilled/i.test(s.trim());

// Order of severity for the overall status when several findings exist.
const STOP_ORDER = ["MISSING", "SOURCE_REQUIRED", "HUMAN_REVIEW", "SCOPE_DRIFT", "UPSTREAM_CONTRACT_CHANGE_REQUIRED"];

function finding(code, status, detail) {
  return { code, status, severity: "BLOCKER", detail };
}

/**
 * Assemble the generation contract for a product and decide if generation may proceed.
 * @returns {{ product_id:string, ok:boolean, status:string, findings:Array, inputs:Object, brief:Object|null }}
 */
export function buildGenerationBrief(productId) {
  const cfg = loadConfig();
  const findings = [];
  const pdir = join(root, "data", "products", productId);
  const pfile = join(pdir, "product.json");

  // MISSING: product record itself
  if (!existsSync(pfile)) {
    findings.push(finding("product_schema_missing", "MISSING", `no product.json at data/products/${productId}`));
    return finalize(productId, cfg, findings, null, null, null);
  }
  const p = JSON.parse(readFileSync(pfile, "utf8"));

  // Transformation Specification
  const trId = p.identity?.transformation_id;
  const trFile = trId ? join(root, "data", "transformations", `${trId}.json`) : null;
  const tr = trId && trFile && existsSync(trFile) ? JSON.parse(readFileSync(trFile, "utf8")) : null;
  if (!tr) {
    findings.push(finding("transformation_specification_missing", "SOURCE_REQUIRED",
      `no transformation record for ${trId || "(unset)"} — generation cannot proceed; return upstream to the Transformation Architect`));
  }

  // Situation gate (Standard v1 §4.2 / Gate 1)
  const sit = tr?.situation ?? {};
  const gate1 = ["person", "specific_situation", "trigger", "problem", "failed_attempt", "emotional_stake", "desired_transformation"];
  if (tr) {
    const missing = gate1.filter((k) => isBlank(sit[k]) || isBackfill(sit[k]));
    if (missing.length) findings.push(finding("approved_situation_ambiguous", "SOURCE_REQUIRED", `situation.${missing.join(", situation.")} missing/placeholder`));
  }

  // Transformation gate: before/after/mechanism (must not be invented by the generator)
  if (tr) {
    const need = { before_state: tr.before_state, after_state: tr.after_state, mechanism: tr.mechanism?.core_mechanism };
    const missing = Object.entries(need).filter(([, v]) => isBlank(v)).map(([k]) => k);
    if (missing.length) findings.push(finding("model_would_have_to_invent_material_information", "SOURCE_REQUIRED", `transformation.${missing.join(", ")} empty`));
  }

  // TSM (BLOCKER to publish; cannot be represented -> stop)
  const tsmOk = (tr?.tsm && !isBlank(tr.tsm.before_baseline) && !isBlank(tr.tsm.success_indicators) && !isBlank(tr.tsm.success_threshold)) ||
    (p.tsm && Object.keys(p.tsm).length > 1 && !p.tsm.note);
  if (!tsmOk) findings.push(finding("tsm_cannot_be_represented", "SOURCE_REQUIRED", "no representable TSM (before baseline + success indicators + threshold)"));

  // Required assets: each declared asset record + its source content must exist
  const assetIssues = [];
  const assets = [];
  for (const [job, list] of Object.entries(p.asset_map ?? {})) {
    for (const aid of list) {
      const af = join(pdir, "assets", `${aid}.json`);
      if (!existsSync(af)) { assetIssues.push(`${aid} (record missing)`); continue; }
      const a = JSON.parse(readFileSync(af, "utf8"));
      const srcBase = a.source_path ? join(pdir, a.source_path.split("#")[0]) : null;
      const srcOk = srcBase ? existsSync(srcBase) : false;
      if (!srcOk) assetIssues.push(`${aid} (source missing)`);
      assets.push({ id: aid, job: a.job ?? job, format: a.format ?? "", title: a.title ?? "", source_path: a.source_path ?? null, source_exists: srcOk });
    }
  }
  if (assetIssues.length) findings.push(finding("required_assets_cannot_be_reliably_represented", "MISSING", assetIssues.join("; ")));

  // Safety-sensitive: high/clinical risk needs red flags + escalation
  const safety = tr?.safety ?? p.safety ?? {};
  const risk = safety.risk_level || p.safety?.risk_level || "low";
  if (["high", "clinical"].includes(risk)) {
    const missing = [];
    if (isBlank(safety.red_flags)) missing.push("red_flags");
    if (isBlank(safety.escalation_rules)) missing.push("escalation_rules");
    if (missing.length) findings.push(finding("safety_sensitive_information_unresolved", "HUMAN_REVIEW", `${risk} risk missing ${missing.join(", ")}`));
  }

  // Evidence requirements (moderate+ risk with no evidence basis)
  const ev = tr?.evidence ?? [];
  if (["moderate", "high", "clinical"].includes(risk) && (!Array.isArray(ev) || ev.length === 0)) {
    findings.push(finding("required_evidence_missing", "SOURCE_REQUIRED", `${risk} risk with no evidence basis on the transformation record`));
  }

  return finalize(productId, cfg, findings, p, tr, assets);
}

function finalize(productId, cfg, findings, p, tr, assets) {
  const blocking = findings.find((f) => STOP_ORDER.includes(f.status));
  const status = blocking ? blocking.status : "READY";
  const inputs = {
    transformation_specification: !!(tr),
    product_schema: !!(p),
    approved_research_knowledge: !!(tr?.evidence?.length),
    product_architecture: !!((p?.asset_map && Object.values(p.asset_map).some((l) => l.length)) || tr?.transformation_path?.length),
    required_assets: !!(assets && assets.length && assets.every((a) => a.source_exists)),
    evidence_requirements: !!(p?.evidence || tr?.evidence),
    safety_requirements: !!(tr?.safety || p?.safety),
    delivery_formats: !!(assets && assets.length),
    swiipt_writing_constitution: true,
    product_specific_voice_specification: !!(p?.generation?.voice),
    anti_ai_rules: !!(cfg?.constitution?.forbidden_phrases?.length),
  };
  const brief = p ? {
    product_id: p.product_id,
    transformation_id: p.identity?.transformation_id ?? null,
    library_id: p.identity?.library_id ?? null,
    writing_control_version: cfg.writing_control_version,
    identity: p.identity ?? {},
    customer: p.customer ?? {},
    situation: tr?.situation ?? null,
    before_state: tr?.before_state ?? p.transformation?.before_state ?? {},
    after_state: tr?.after_state ?? p.transformation?.after_state ?? {},
    mechanism: tr?.mechanism ?? p.transformation?.mechanism ?? {},
    path: tr?.transformation_path ?? p.transformation?.path ?? [],
    first_win: tr?.first_win ?? p.transformation?.first_win ?? {},
    failure_map: tr?.failure_point_map ?? p.transformation?.failure_map ?? {},
    rescue_protocols: tr?.failure_point_map ?? p.transformation?.rescue_protocols ?? {},
    maintenance: tr?.maintenance ?? p.transformation?.maintenance ?? {},
    tsm: tr?.tsm ?? p.tsm ?? {},
    next_transformation_ids: tr?.next_transformation ?? p.transformation?.next_transformation_ids ?? [],
    assets: assets ?? [],
    evidence: tr?.evidence ?? [],
    safety: tr?.safety ?? p.safety ?? {},
    voice: { global: cfg.voice.global_rules, product: p.generation?.voice ?? {}, profile: p.generation?.profile ?? null },
  } : null;
  return { product_id: productId, ok: status === "READY", status, findings, inputs, brief };
}

// ---- CLI ----
if (process.argv[1] && process.argv[1].endsWith("writing-control.mjs")) {
  const arg = process.argv[2];
  if (arg === "--all") {
    const ids = readdirSync(join(root, "data", "products")).filter((d) => existsSync(join(root, "data", "products", d, "product.json")));
    for (const id of ids) {
      const r = buildGenerationBrief(id);
      const codes = r.findings.map((f) => f.code).join(",") || "-";
      console.log(`${r.status.padEnd(14)} ${id.padEnd(26)} ${codes}`);
    }
  } else if (arg) {
    const r = buildGenerationBrief(arg);
    console.log(JSON.stringify(r, null, 2));
  } else {
    console.error("usage: node harness/writing-control.mjs <PRODUCT_ID> | --all");
    process.exit(2);
  }
}
