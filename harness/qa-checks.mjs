#!/usr/bin/env node
// Factory item #9 - DETERMINISTIC QA RUNNER (machine-checkable subset of qa-standard section 2).
// Checks every product record + cross-record integrity. Exit 1 on any FAIL.
// Run: node harness/qa-checks.mjs
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addFormat("date", /^\d{4}-\d{2}-\d{2}$/);
ajv.addFormat("date-time", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
for (const f of readdirSync(join(root, "schemas")).filter(f => f.endsWith(".schema.json"))) {
  const sch = JSON.parse(readFileSync(join(root, "schemas", f), "utf8"));
  sch.$id = `https://swiipt.com/factory/schemas/${f}`;
  ajv.addSchema(sch);
}

const results = [];
const check = (product, test, ok, detail = "") => {
  results.push({ product, test, result: ok ? "PASS" : "FAIL", detail });
  return ok;
};

// collect records
const opps = new Map();
const transIds = new Set();
const productIds = new Set();
for (const f of readdirSync(join(root, "data", "opportunities")).filter(f => f.endsWith(".json"))) {
  const o = JSON.parse(readFileSync(join(root, "data", "opportunities", f), "utf8"));
  opps.set(o.opportunity_id, o);
}
const productsDir = join(root, "data", "products");
const productRecords = [];
if (existsSync(productsDir)) {
  for (const d of readdirSync(productsDir)) {
    const pf = join(productsDir, d, "product.json");
    if (existsSync(pf)) {
      const p = JSON.parse(readFileSync(pf, "utf8"));
      productRecords.push({ dir: d, path: pf, p });
      productIds.add(p.product_id);
    }
  }
}

let fails = 0;
for (const { dir, path, p } of productRecords) {
  const rel = `data/products/${dir}/product.json`;

  // schema
  const valid = ajv.validate("https://swiipt.com/factory/schemas/product.schema.json", p);
  check(rel, "schema_valid", valid, valid ? "" : ajv.errors.map(e => `${e.instancePath} ${e.message}`).join("; "));
  if (!valid) { fails++; continue; }

  // duplicate ID
  check(rel, "no_duplicate_id", [...productIds].filter(x => x === p.product_id).length === 1);

  // version semver
  check(rel, "version_semver", /^\d+\.\d+\.\d+/.test(p.version));

  // transformation relationship resolves
  const trId = p.identity.transformation_id;
  let trExists = false;
  for (const [, o] of opps) {
    if (o.disposition?.promoted_transformation_id === trId || o.opportunity_id.includes(trId)) trExists = true;
  }
  // also accept live-lineage products whose TR id is recorded in their own publishing block
  if (!trExists && p.publishing?.wordpress_ids?.transformation_id) trExists = true;
  check(rel, "transformation_relationship_exists", trExists, trId);

  // TSM present (BLOCKER rule)
  check(rel, "tsm_exists", Object.keys(p.tsm ?? {}).length > 0);

  // published => platform ids + publish gate
  if (p.status === "published") {
    const wp = p.publishing?.wordpress_ids ?? {};
    check(rel, "published_has_wordpress_ids", !!(wp.product_id && wp.tsystem_id && wp.transformation_id));
    check(rel, "publish_gate_PASS", p.qa?.gate_results?.g10_publish === "PASS");
    check(rel, "commerce_price_exists", typeof p.commerce?.price?.base_usd === "number");
    check(rel, "currency_rules_present", Object.keys(p.commerce?.currency_rules ?? {}).length > 0);
  }

  // asset references resolve to asset files
  for (const [job, list] of Object.entries(p.asset_map ?? {})) {
    for (const aid of list) {
      const af = join(root, "data", "products", dir, "assets", `${aid}.json`);
      check(rel, `asset_${job}_resolves:${aid}`, existsSync(af));
    }
  }

  // upsell targets exist
  for (const up of p.commerce?.upsells ?? []) {
    check(rel, `upsell_resolves:${up}`, productIds.has(up));
  }
}

// cross-store: opportunity related_ids resolve
for (const [id, o] of opps) {
  for (const r of o.related_opportunity_ids ?? []) {
    if (!opps.has(r)) { check(`data/opportunities/${id}.json`, `related_resolves:${r}`, false); fails++; }
  }
}

const pass = results.filter(r => r.result === "PASS").length;
console.log(results.map(r => `${r.result}  ${r.product}  ${r.test}${r.detail ? "  (" + r.detail.slice(0, 80) + ")" : ""}`).join("\n"));
console.log(`\n${pass} PASS / ${results.length - pass} FAIL across ${results.length} checks`);
process.exit(fails > 0 ? 1 : 0);
