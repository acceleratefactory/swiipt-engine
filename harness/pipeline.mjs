#!/usr/bin/env node
// SWIIPT PIPELINE GOVERNED HANDOFF (research-to-transformation pipeline V1, Phase L).
//
// The minimum governed handoff: it answers CURRENT STATE / NEXT ALLOWED STATE / BLOCKING GAPS /
// NEXT REQUIRED ACTION from canonical records + gap state. It is NOT an autonomous orchestrator —
// a human/operator still runs the commands, but the repository refuses undocumented invalid order
// and reports exactly what is required next.
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildTransformationRecord } from "./transformation-architect.mjs";
import { persistGapsFromReport, listGaps, resolveGap, reEvaluateGap, blockingGapsForStage } from "./research-gaps.mjs";
import { validateTransformationRecord } from "./validate-transformation.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TR_DIR = join(ROOT, "data", "transformations");
const OPP_DIR = join(ROOT, "data", "opportunities");
const PROD_DIR = join(ROOT, "data", "products");
const SRC_DIR = join(ROOT, "data", "research-sources");

export const NEXT_ACTION = Object.freeze({
  SOURCE: "ingest the research document (harness/ingest-research.mjs) and complete semantic extraction",
  OPPORTUNITY: "author a transformation candidate from the opportunity (harness/pipeline.mjs author)",
  TRANSFORMATION_CANDIDATE: "run the governed validation transition (harness/validate-transformation.mjs)",
  TRANSFORMATION_VALIDATED: "author the Product Specification against this validated transformation",
  PRODUCT_SPECIFICATION: "build the product from the specification",
  PRODUCT_BUILD: "run Product QA (harness/product-qa-gate-runner.mjs)",
  PRODUCT_QA: "record publishing authorization (Gate 10)",
  PUBLICATION: "no further factory action",
});

export const STAGE_TRANSITIONS = Object.freeze({
  SOURCE: ["OPPORTUNITY"],
  OPPORTUNITY: ["TRANSFORMATION_CANDIDATE"],
  TRANSFORMATION_CANDIDATE: ["TRANSFORMATION_VALIDATED"],
  TRANSFORMATION_VALIDATED: ["PRODUCT_SPECIFICATION"],
  PRODUCT_SPECIFICATION: ["PRODUCT_BUILD"],
  PRODUCT_BUILD: ["PRODUCT_QA"],
  PRODUCT_QA: ["PUBLICATION"],
  PUBLICATION: [],
});

function readJson(p) { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } }

function opportunityStage(o) {
  if (!o) return null;
  return o.status === "promoted_to_candidate" ? "OPPORTUNITY" : "OPPORTUNITY";
}
function transformationStage(tr) {
  if (!tr) return null;
  if (tr.status === "candidate") return "TRANSFORMATION_CANDIDATE";
  if (tr.status === "validated" || tr.status === "active") return "TRANSFORMATION_VALIDATED";
  return "OPPORTUNITY";
}
function productStage(p) {
  if (!p) return null;
  switch (p.status) {
    case "spec": return "PRODUCT_SPECIFICATION";
    case "building": return "PRODUCT_BUILD";
    case "qa": case "ready": return "PRODUCT_QA";
    case "published": return "PUBLICATION";
    default: return "PRODUCT_SPECIFICATION";
  }
}

/**
 * Report the governed pipeline state for one entity.
 * @param {{kind:"source"|"opportunity"|"transformation"|"product", id:string}} target
 */
export function pipelineState({ kind, id }, { dir = TR_DIR, gapDir = undefined } = {}) {
  let record = null, stage = null;
  if (kind === "source") {
    const rec = readJson(join(SRC_DIR, id, "record.json"));
    record = rec;
    stage = rec ? (rec.status === "EXTRACTED" ? "OPPORTUNITY" : "SOURCE") : null;
  } else if (kind === "opportunity") {
    record = readJson(join(OPP_DIR, `${id}.json`));
    stage = opportunityStage(record);
  } else if (kind === "transformation") {
    record = readJson(join(dir, `${id}.json`));
    stage = transformationStage(record);
  } else if (kind === "product") {
    record = readJson(join(PROD_DIR, id, "product.json"));
    stage = productStage(record);
  } else {
    return { ok: false, error: `unknown kind ${kind}` };
  }
  if (!record || !stage) return { ok: false, error: `no canonical record for ${kind} ${id}` };

  const next = STAGE_TRANSITIONS[stage] || [];
  const nextStage = next[0] ?? null;
  const gaps = nextStage
    ? blockingGapsForStage(nextStage, gapDir ? { dir: gapDir } : {}).filter((g) =>
      g.transformation_id === id || g.product_id === id || g.opportunity_id === id ||
      (g.transformation_id === null && g.product_id === null && g.opportunity_id === null))
    : [];
  return {
    ok: true,
    kind, id,
    current_state: stage,
    next_allowed_state: nextStage,
    blocking_gaps: gaps.map((g) => ({ gap_id: g.gap_id, domain: g.domain, severity: g.severity, description: g.description })),
    next_required_action: gaps.length
      ? `resolve blocking gap(s): ${gaps.map((g) => g.gap_id).join(", ")}`
      : NEXT_ACTION[nextStage] ?? "no further factory action",
    record_ref: kind === "product" ? `data/products/${id}/product.json` : null,
  };
}

/** Governed authoring orchestration: architect + gap persistence (keeps the architect pure). */
export function authorTransformation({ opportunity, existing_transformations = [], write = false, now = null, gapDir = undefined, options = {} } = {}) {
  const result = buildTransformationRecord({ opportunity, existing_transformations, mode: write ? "write" : "dry-run", ...options });
  let persistedGaps = [];
  if (result.report && Array.isArray(result.report.gaps) && result.report.gaps.length) {
    persistedGaps = persistGapsFromReport(result.report, { now, context: { opportunity_id: opportunity?.opportunity_id ?? null }, ...(gapDir ? { dir: gapDir } : {}) });
  }
  return { ...result, persisted_gaps: persistedGaps.map((g) => g.gap_id) };
}

export function loadCatalogue({ dir = TR_DIR } = {}) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /^TR-.*\.json$/.test(f)).map((f) => readJson(join(dir, f))).filter(Boolean);
}

// ------------------------------------------------------------------------------------------------
// CLI
// ------------------------------------------------------------------------------------------------
const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const [cmd, ...rest] = process.argv.slice(2);
  const get = (flag) => { const i = rest.indexOf(flag); return i > -1 ? rest[i + 1] : null; };
  const positional = rest.filter((a, i) => !a.startsWith("--") && rest[i - 1] !== "--by" && rest[i - 1] !== "--rationale" && rest[i - 1] !== "--evidence" && rest[i - 1] !== "--source");
  if (cmd === "state") {
    const r = pipelineState({ kind: positional[0], id: positional[1] });
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.ok ? 0 : 1);
  } else if (cmd === "author") {
    const file = positional[0];
    if (!file || !existsSync(resolve(file))) { console.error("author: no opportunity file"); process.exit(2); }
    const opportunity = JSON.parse(readFileSync(resolve(file), "utf8"));
    const r = authorTransformation({ opportunity, existing_transformations: loadCatalogue(), write: rest.includes("--write") });
    console.log(JSON.stringify({ status: r.status, transformation_id: r.transformation_id, persisted: r.persisted, applicability: r.report?.applicability?.classification ?? null, dedupe: r.report?.dedupe?.outcome ?? null, gaps: (r.report?.gaps ?? []).map((g) => `${g.domain}:${g.description}`), persisted_gaps: r.persisted_gaps, missing_inputs: r.report?.missing_inputs ?? [] }, null, 2));
    process.exit(r.status === "CANDIDATE_READY" || r.status === "SOURCE_REQUIRED" ? 0 : 1);
  } else if (cmd === "gaps") {
    let gaps = listGaps();
    if (rest.includes("--open")) gaps = gaps.filter((g) => g.status === "OPEN");
    console.log(JSON.stringify(gaps.map((g) => ({ gap_id: g.gap_id, domain: g.domain, stage: g.blocking_stage, severity: g.severity, status: g.status, blocks: g.blocks_progression })), null, 2));
    process.exit(0);
  } else if (cmd === "resolve") {
    const gapId = positional[0];
    const refs = (get("--evidence") ?? "").split(",").filter(Boolean);
    const r = resolveGap(gapId, { resolution_source: get("--source"), resolution_evidence_refs: refs, resolution_notes: get("--notes") }, {});
    if (r.ok && rest.includes("--write")) { /* resolveGap already persists */ }
    console.log(JSON.stringify({ status: r.code, gap: r.gap?.gap_id ?? null, detail: r.reason ?? null }, null, 2));
    process.exit(r.ok ? 0 : 1);
  } else if (cmd === "reevaluate") {
    const r = reEvaluateGap(positional[0], {});
    console.log(JSON.stringify({ status: r.code, gap: r.gap?.gap_id ?? null }, null, 2));
    process.exit(r.ok ? 0 : 1);
  } else if (cmd === "validate") {
    const r = validateTransformationRecord(positional[0], { authorized_by: get("--by"), rationale: get("--rationale"), write: rest.includes("--write") });
    console.log(JSON.stringify({ status: r.code, blockers: r.blockers, validation: r.validation ?? null }, null, 2));
    process.exit(r.ok ? 0 : 1);
  } else {
    console.error("usage: node harness/pipeline.mjs <state <kind> <id> | author <opportunity.json> [--write] | gaps [--open] | resolve <gapId> --source <s> --evidence a,b | reevaluate <gapId> | validate <TR_ID> --by <name> [--write]>");
    process.exit(2);
  }
}
