#!/usr/bin/env node
// MAE · thin CRF ingest harness (docs/implementation/04). Wraps the EXISTING
// CustomerRealityService.ingest() — no new ingestion architecture.
//
// Guarantees:
//   · schema validation BEFORE persistence
//   · production scope rejects synthetic fixtures (never represented as real Customer Truth)
//   · provenance / evidence_state / fixture status preserved as written
//   · all-or-nothing for a batch: a rejected record persists nothing (no partial writes)
//
// Usage:
//   node mae/harness/ingest-crf.mjs <file.json|dir> [more...] [--scope production|test] [--dry-run]
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { validate } from "../lib/schema.js";
import { fail, CODES } from "../lib/errors.js";
import { CustomerRealityService } from "../services/crf.js";

export const KIND = "crf";
export const SCHEMA = "customer-reality-record.schema.json";
const isFixture = (r) => r && (r.is_fixture === true || r.provenance === "synthetic_fixture");

/** Read one or more JSON records from files/directories. */
export function loadJsonRecords(paths) {
  const out = [];
  for (const p of paths) {
    if (!existsSync(p)) fail(CODES.REFERENCE_UNRESOLVED, `path not found: ${p}`);
    const st = statSync(p);
    if (st.isDirectory()) {
      for (const f of readdirSync(p).filter((n) => n.endsWith(".json")).sort()) out.push(JSON.parse(readFileSync(join(p, f), "utf8")));
    } else {
      out.push(JSON.parse(readFileSync(p, "utf8")));
    }
  }
  return out;
}

/**
 * Validate then persist CRF records. Validates the WHOLE batch first so a rejected record
 * never causes a partial write.
 * @returns {{accepted:string[], rejected:{id,code,message}[], persisted:string[]}}
 */
export function ingestRecords(records, { scope = "production", dryRun = false } = {}) {
  const rejected = [];
  for (const r of records) {
    try {
      validate(SCHEMA, r, r && r.id);
      if (scope === "production" && isFixture(r)) {
        fail(CODES.FIXTURE_NOT_PRODUCTION_SAFE, "synthetic fixture cannot be ingested as production Customer Truth", { id: r.id });
      }
    } catch (e) {
      rejected.push({ id: r && r.id, code: e.code || "INVALID", message: e.message });
    }
  }
  if (rejected.length) return { accepted: [], rejected, persisted: [] };
  if (dryRun) return { accepted: records.map((r) => r.id), rejected: [], persisted: [] };
  const persisted = [];
  for (const r of records) { CustomerRealityService.ingest(r, { scope }); persisted.push(r.id); }
  return { accepted: persisted, rejected: [], persisted };
}

if (process.argv[1] && process.argv[1].endsWith("ingest-crf.mjs")) {
  const args = process.argv.slice(2);
  const scope = args.includes("--scope") ? args[args.indexOf("--scope") + 1] : "production";
  const dryRun = args.includes("--dry-run");
  const paths = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--scope");
  if (!paths.length) { console.error("usage: node mae/harness/ingest-crf.mjs <file|dir> [...] [--scope production|test] [--dry-run]"); process.exit(2); }
  let records;
  try { records = loadJsonRecords(paths); } catch (e) { console.error(JSON.stringify({ error: e.message })); process.exit(2); }
  const report = ingestRecords(records, { scope, dryRun });
  console.log(JSON.stringify({ kind: KIND, scope, dry_run: dryRun, ...report }, null, 2));
  process.exit(report.rejected.length ? 1 : 0);
}
