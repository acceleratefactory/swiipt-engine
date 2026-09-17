#!/usr/bin/env node
// SWIIPT CANONICAL RESEARCH DOCUMENT INGESTION (research-to-transformation pipeline V1, Phase A).
//
// DETERMINISTIC SHELL + REPLACEABLE SEMANTIC EXTRACTOR (task §5.3):
//   - the shell reads/preserves/validates/persists; it never invents research;
//   - semantic extraction is either deterministic (a governed `swiipt-research` block / structured
//     JSON record) or supplied by an injected/configured extractor;
//   - with no block and no extractor the honest state is EXTRACTION_REQUIRED — never fabricated records.
//
// Supported inputs: .md, .txt, .json (a structured record). PDF/OCR is explicitly out of scope.
// The original source is preserved byte-for-byte and the record links
// SOURCE DOCUMENT -> EXTRACTED RECORD(S) -> (opportunity records) -> downstream transformation.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import Ajv from "ajv/dist/2020.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const SOURCE_DIR = join(ROOT, "data", "research-sources");
export const OPP_DIR = join(ROOT, "data", "opportunities");
export const SOURCE_SCHEMA_ID = "https://swiipt.com/factory/schemas/research-source.schema.json";

export const EXTRACTION_STATUS = Object.freeze({
  EXTRACTED: "EXTRACTED",
  EXTRACTION_REQUIRED: "EXTRACTION_REQUIRED",
  NO_FINDINGS: "NO_FINDINGS",
});

const slug = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
const isStr = (v) => typeof v === "string" && v.trim().length > 0;

let AJV = null;
function ajv() {
  if (AJV) return AJV;
  const a = new Ajv({ allErrors: true, strict: false });
  a.addFormat("date", /^\d{4}-\d{2}-\d{2}$/);
  a.addFormat("date-time", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  for (const f of ["opportunity.schema.json", "research-source.schema.json"]) {
    const sch = JSON.parse(readFileSync(join(ROOT, "schemas", f), "utf8"));
    sch.$id = sch.$id || `https://swiipt.com/factory/schemas/${f}`;
    a.addSchema(sch);
  }
  AJV = a;
  return a;
}

/** Extract a governed ```swiipt-research fenced JSON block, if present (deterministic extraction contract). */
export function extractResearchBlock(text) {
  const m = String(text ?? "").match(/```swiipt-research[^\n]*\n([\s\S]*?)```/i);
  if (!m) return null;
  try { return { ok: true, payload: JSON.parse(m[1]) }; }
  catch (e) { return { ok: false, error: `swiipt-research block is not valid JSON: ${e.message}` }; }
}

function normalizeFindings(payload) {
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.findings)) return payload.findings;
  if (payload.finding) return [payload];
  if (payload.opportunity_id) return [payload];
  return [];
}

const FINDING_KEYS = Object.freeze(["headline", "problem", "recurring_situation", "person", "trigger", "failed_attempt", "emotional_stake", "desired_outcome", "evidence_quotes", "mechanism_hypotheses", "competition_notes"]);

/** Build one opportunity record from a finding payload + document context. Never fabricates fields. */
export function buildOpportunity(finding = {}, ctx = {}, index = 1, unresolved = []) {
  const f = {};
  if (finding.finding && typeof finding.finding === "object") Object.assign(f, finding.finding);
  else for (const k of FINDING_KEYS) if (finding[k] !== undefined) f[k] = finding[k];
  const lifeArea = finding.life_area || ctx.life_area || null;
  const opportunityId = finding.opportunity_id || ctx.opportunity_id || `OPP-ING-${slug(ctx.source_id)}-${String(index).padStart(3, "0")}`;
  const sourceProvidedDate = ctx.source_provided_date ?? null;
  const collectedAt = finding.collected_at || sourceProvidedDate || ctx.ingested_date;
  if (!finding.collected_at && !sourceProvidedDate) unresolved.push(`${opportunityId}: source-provided date unknown; collected_at set to the ingestion date (not fabricated from the document)`);
  return {
    opportunity_id: opportunityId,
    source: finding.source || ctx.source_label || `ingest:${ctx.source_id}`,
    source_references: finding.source_references || ctx.source_references || [ctx.original_path],
    life_area: lifeArea,
    focus_market: finding.focus_market || ctx.focus_market || null,
    submarket: finding.submarket || ctx.submarket || null,
    collected_at: collectedAt,
    finding: f,
    ...(finding.survival_pain_test ? { survival_pain_test: finding.survival_pain_test } : {}),
    ...(finding.disposition ? { disposition: finding.disposition } : {}),
    status: finding.status || (finding.disposition ? "dispositioned" : "open"),
    ...(finding.provenance || ctx.provenance ? { provenance: finding.provenance || ctx.provenance } : {}),
    ...(finding.applicability ? { applicability: finding.applicability } : {}),
  };
}

function readSourceFile(file) {
  const buf = readFileSync(file);
  const text = buf.toString("utf8");
  const ext = extname(file).toLowerCase();
  const sourceType = ext === ".md" ? "markdown" : ext === ".txt" ? "text" : ext === ".json" ? "structured_record" : null;
  return { buf, text, ext, sourceType };
}

export function nextSourceId(base, { dir = SOURCE_DIR } = {}) {
  const stem = `SRC-${slug(base) || "DOCUMENT"}`;
  let n = 1;
  while (existsSync(join(dir, `${stem}-${String(n).padStart(3, "0")}`))) n += 1;
  return `${stem}-${String(n).padStart(3, "0")}`;
}

/**
 * Load the optional semantic extractor. Dormant by default; activates only with an explicit
 * configuration, and uses the repository's provider abstraction (never a hard-coded model).
 */
export async function loadProviderExtractor(env = process.env) {
  if (env.SWIIPT_EXTRACTOR_ENABLED !== "1" || !env.OPENAI_API_KEY) return null;
  const mod = await import("../lib/provider-client.mjs");
  return async ({ text, source }) => {
    const sys = "Extract structured research findings as strict JSON {life_area,focus_market,submarket,provenance,findings:[{opportunity_id,finding,survival_pain_test,disposition}]}. Never invent fields; omit what the document does not state.";
    const res = await mod.chatCompletion({ messages: [{ role: "system", content: sys }, { role: "user", content: text }] });
    const content = res?.content ?? res?.choices?.[0]?.message?.content ?? "";
    return JSON.parse(content);
  };
}

/**
 * Ingest one research document. Deterministic shell; optional extractor.
 * @returns {{ ok, code, source, created, retained, extraction }}
 */
export async function ingestResearch({ file, source_id = null, write = true, now = null, extractor = null, dir = SOURCE_DIR, oppDir = OPP_DIR } = {}) {
  if (!file || !existsSync(file)) return { ok: false, code: "REFERENCE_UNRESOLVED", message: `no file at ${file}` };
  const { buf, text, sourceType } = readSourceFile(file);
  if (!sourceType) return { ok: false, code: "UNSUPPORTED_INPUT", message: `unsupported extension ${extname(file)} (supported: .md, .txt, .json)` };

  const ingestedAt = now || new Date().toISOString();
  const ingestedDate = ingestedAt.slice(0, 10);
  const sourceId = source_id || nextSourceId(basename(file, extname(file)), { dir });
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const preservedName = `source${extname(file).toLowerCase()}`;
  const preservedPath = relative(ROOT, join(dir, sourceId, preservedName)).split(sep).join("/");

  // ---- extract ----
  const unresolved = [];
  let payload = null;
  let extractorInfo = { provider: null, deterministic: true };
  let extractionError = null;
  if (sourceType === "structured_record") {
    try { payload = JSON.parse(text); } catch (e) { extractionError = `structured record is not valid JSON: ${e.message}`; }
  } else {
    const block = extractResearchBlock(text);
    if (block && block.ok) payload = block.payload;
    else if (block && !block.ok) extractionError = block.error;
  }
  if (!payload && extractor) {
    payload = await extractor({ text, source: { source_id: sourceId, original_path: file } });
    extractorInfo = { provider: "configured-extractor", deterministic: false };
  }

  const findings = normalizeFindings(payload);
  const ctx = {
    source_id: sourceId,
    source_label: payload?.provenance?.source_label || basename(file),
    source_references: [relative(ROOT, file).split(sep).join("/")],
    life_area: payload?.life_area ?? null,
    focus_market: payload?.focus_market ?? null,
    submarket: payload?.submarket ?? null,
    provenance: payload?.provenance ?? null,
    source_provided_date: payload?.provenance?.source_date ?? null,
    original_path: relative(ROOT, file).split(sep).join("/"),
    ingested_date: ingestedDate,
  };

  const created = [];
  const retained = [];
  for (let i = 0; i < findings.length; i += 1) {
    const opp = buildOpportunity(findings[i], ctx, i + 1, unresolved);
    if (!isStr(opp.life_area) || !isStr(opp.focus_market) || !isStr(opp.submarket)) {
      unresolved.push(`finding ${i + 1} (${opp.opportunity_id}): missing life_area/focus_market/submarket — retained unresolved in the preserved source, not silently discarded`);
      retained.push(opp.opportunity_id);
      continue;
    }
    const valid = ajv().validate("https://swiipt.com/factory/schemas/opportunity.schema.json", opp);
    if (!valid) {
      unresolved.push(`finding ${i + 1} (${opp.opportunity_id}) fails the opportunity contract: ${ajv().errors.map((e) => `${e.instancePath || "/"} ${e.message}`).join("; ")}`);
      retained.push(opp.opportunity_id);
      continue;
    }
    if (write) {
      const p = join(oppDir, `${opp.opportunity_id}.json`);
      if (existsSync(p)) { unresolved.push(`${opp.opportunity_id} already exists and was not overwritten`); retained.push(opp.opportunity_id); continue; }
      mkdirSync(oppDir, { recursive: true });
      writeFileSync(p, `${JSON.stringify(opp, null, 2)}\n`, "utf8");
    }
    created.push(opp.opportunity_id);
  }

  const extractionStatus = payload === null
    ? EXTRACTION_STATUS.EXTRACTION_REQUIRED
    : findings.length === 0 ? EXTRACTION_STATUS.NO_FINDINGS : EXTRACTION_STATUS.EXTRACTED;
  if (payload === null) unresolved.push(extractionError || "no governed swiipt-research block and no extractor configured; semantic extraction is required before records can be created");
  if (extractionStatus === EXTRACTION_STATUS.EXTRACTED && unresolved.length && unresolved.every((u) => /already exists/.test(u))) { /* informational */ }

  const provenance = {
    source_label: payload?.provenance?.source_label ?? basename(file),
    population: payload?.provenance?.population ?? null,
    geography: payload?.provenance?.geography ?? null,
    jurisdiction: payload?.provenance?.jurisdiction ?? null,
    cultural_context: payload?.provenance?.cultural_context ?? [],
    limitations: payload?.provenance?.limitations ?? [],
    evidence_status: payload?.provenance?.evidence_status ?? null,
  };

  const record = {
    source_id: sourceId,
    class: "research_source",
    source_type: sourceType,
    original_path: relative(ROOT, file).split(sep).join("/"),
    preserved_path: preservedPath,
    content_sha256: sha256,
    bytes: buf.length,
    ingested_at: ingestedAt,
    source_provided_date: ctx.source_provided_date,
    provenance,
    extraction: {
      status: extractionStatus,
      extractor: extractorInfo,
      findings_total: findings.length,
      records_created: created,
      records_retained: retained,
      unresolved_questions: [...new Set(unresolved)],
    },
    status: extractionStatus === EXTRACTION_STATUS.EXTRACTED ? "EXTRACTED" : extractionStatus === EXTRACTION_STATUS.EXTRACTION_REQUIRED ? "EXTRACTION_REQUIRED" : "INGESTED",
    notes: null,
  };

  const valid = ajv().validate(SOURCE_SCHEMA_ID, record);
  if (!valid) return { ok: false, code: "SCHEMA_INVALID", errors: ajv().errors.map((e) => `${e.instancePath || "/"} ${e.message}`) };

  if (write) {
    const dirPath = join(dir, sourceId);
    mkdirSync(dirPath, { recursive: true });
    writeFileSync(join(dirPath, preservedName), buf);
    writeFileSync(join(dirPath, "record.json"), `${JSON.stringify(record, null, 2)}\n`, "utf8");
  }
  return { ok: true, code: record.status, source: record, created, retained, extraction: record.extraction };
}

// ------------------------------------------------------------------------------------------------
// CLI
// ------------------------------------------------------------------------------------------------
const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const get = (flag) => { const i = args.indexOf(flag); return i > -1 ? args[i + 1] : null; };
  const file = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--id");
  if (!file) {
    console.error("usage: node harness/ingest-research.mjs <file.md|file.txt|file.json> [--id SRC-...] [--dry-run]");
    process.exit(2);
  }
  const extractor = await loadProviderExtractor();
  const r = await ingestResearch({ file: resolve(file), source_id: get("--id"), write: !args.includes("--dry-run"), extractor });
  console.log(JSON.stringify({ status: r.code, ok: r.ok, source_id: r.source?.source_id ?? null, created: r.created ?? [], retained: r.retained ?? [], unresolved: r.extraction?.unresolved_questions ?? [] }, null, 2));
  process.exit(r.ok ? 0 : 1);
}
