#!/usr/bin/env node
// Factory record validator — validates JSON records against ../schemas/*.schema.json.
// Usage:
//   node harness/validate-opportunity.mjs <file.json>          single record
//   node harness/validate-opportunity.mjs --all                all records in data/
// Exit code 0 = all PASS, 1 = failures (blocks commit per data/README.md ledger rule 2).
import Ajv from "ajv/dist/2020.js";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addFormat("date", /^\d{4}-\d{2}-\d{2}$/);
ajv.addFormat("date-time", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

const schemas = {};
for (const f of readdirSync(join(root, "schemas"))) {
  if (!f.endsWith(".schema.json")) continue;
  const id = `https://swiipt.com/factory/schemas/${f}`;
  const sch = JSON.parse(readFileSync(join(root, "schemas", f), "utf8"));
  schemas[id] = sch;
}
for (const [id, sch] of Object.entries(schemas)) {
  // inline $defs are self-contained; refs to sibling files resolved by shared $id pool
  try { ajv.addSchema(sch, id); } catch (e) { console.error(`schema load fail ${id}: ${e.message}`); process.exit(2); }
}

const TARGETS = {
  opportunity: "https://swiipt.com/factory/schemas/opportunity.schema.json",
  transformation: "https://swiipt.com/factory/schemas/transformation.schema.json",
  product: "https://swiipt.com/factory/schemas/product.schema.json",
  asset: "https://swiipt.com/factory/schemas/asset.schema.json",
  research_gap: "https://swiipt.com/factory/schemas/research-gap.schema.json",
  research_source: "https://swiipt.com/factory/schemas/research-source.schema.json",
};

function detectSchema(obj) {
  if (obj.class === "research_gap" || "gap_id" in obj) return TARGETS.research_gap;
  if (obj.class === "research_source" || "source_id" in obj) return TARGETS.research_source;
  if ("opportunity_id" in obj) return TARGETS.opportunity;
  if ("transformation_id" in obj) return TARGETS.transformation;
  if ("product_id" in obj && "identity" in obj) return TARGETS.product;
  if ("asset_id" in obj) return TARGETS.asset;
  return null;
}

function validateFile(path) {
  let obj;
  try { obj = JSON.parse(readFileSync(path, "utf8")); }
  catch (e) { return { path, ok: false, errors: [`invalid JSON: ${e.message}`] }; }
  const sid = detectSchema(obj);
  if (!sid) return { path, ok: false, errors: ["cannot detect record type (no known id field)"] };
  const ok = ajv.validate(sid, obj);
  return { path, ok, errors: ok ? [] : ajv.errors.map(e => `${e.instancePath || "/"} ${e.message}`) };
}

function collect(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== "node_modules" && !e.startsWith(".")) collect(p, out); }
    else if (e.endsWith(".json")) out.push(p);
  }
  return out;
}

const arg = process.argv[2];
let files;
if (arg === "--all") {
  const d = join(root, "data");
  // product dirs validate via product.json only; queue.json is a selection-engine build artifact, not a record
  files = collect(d).filter(f =>
    (!f.includes(`${join("data", "products")}${sep()}`) || basename(f) === "product.json")
    && basename(f) !== "queue.json"
  );
} else if (arg) {
  files = [resolve(arg)];
} else {
  console.error("usage: node harness/validate-opportunity.mjs <file.json> | --all");
  process.exit(2);
}
function sep() { return process.platform === "win32" ? "\\" : "/"; }
function basename(p) { return p.split(/[\\/]/).pop(); }

let fail = 0;
for (const f of files) {
  const r = validateFile(f);
  const rel = f.replace(root, "");
  if (r.errors.length === 1 && r.errors[0].startsWith("cannot detect record type") && rel.includes(`${sep()}libraries${sep()}`)) {
    console.log(`SKIP ${rel} (no library schema defined - Standard v1 section 32)`); continue;
  }
  if (r.ok) console.log(`PASS ${rel}`);
  else { fail++; console.error(`FAIL ${rel}`); for (const e of r.errors) console.error(`   - ${e}`); }
}
console.log(fail === 0 ? `\n${files.length} file(s), all valid` : `\n${fail}/${files.length} file(s) INVALID`);
process.exit(fail === 0 ? 0 : 1);
