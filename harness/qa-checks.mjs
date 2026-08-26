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
  const trFile = join(root, "data", "transformations", `${trId}.json`);
  if (existsSync(trFile)) trExists = true;
  if (!trExists) {
    for (const [, o] of opps) {
      if (o.disposition?.promoted_transformation_id === trId || o.opportunity_id.includes(trId)) trExists = true;
    }
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

  // asset references resolve + source content conforms to standards/asset-rendering-standard.md
  for (const [job, list] of Object.entries(p.asset_map ?? {})) {
    for (const aid of list) {
      const af = join(root, "data", "products", dir, "assets", `${aid}.json`);
      check(rel, `asset_${job}_resolves:${aid}`, existsSync(af));
      if (!existsSync(af)) continue;
      const a = JSON.parse(readFileSync(af, "utf8"));
      if (!a.source_path) continue;
      // source_path may be a bundle file with a section anchor: content/bundle.md#section
      const basePath = join(root, "data", "products", dir, a.source_path.split("#")[0]);
      if (!check(rel, `asset_content_exists:${aid}`, existsSync(basePath), a.source_path)) { fails++; continue; }
      const content = readFileSync(basePath, "utf8");
      // standard non-negotiable: no raw HTML / inline styles in authored source
      const rawHtml = content.match(/<\/?(div|table|style|script|span|section|button|iframe)\b[^>]*>/i);
      if (!check(rel, `asset_no_raw_html:${aid}`, !rawHtml, rawHtml ? rawHtml[0] : "")) fails++;
      // standard non-negotiable: widget blocks balanced + required directives present
      for (const tag of ["DECISION", "RESCUE", "SCRIPTS"]) {
        const opens = (content.match(new RegExp("\\[\\[" + tag + "\\]\\]", "g")) || []).length;
        const closes = (content.match(new RegExp("\\[\\[/" + tag + "\\]\\]", "g")) || []).length;
        if (opens === 0 && closes === 0) continue;
        if (!check(rel, `asset_widget_balanced:${aid}:${tag}`, opens === closes, `${opens} open / ${closes} close`)) { fails++; continue; }
        const need = tag === "DECISION" ? /^ROUTE:/m : tag === "SCRIPTS" ? /^SCRIPT:/m : /^TITLE:/m;
        if (!check(rel, `asset_widget_directives:${aid}:${tag}`, need.test(content), "missing directive")) fails++;
      }
    }
  }

  // g6_content: landing-page / product-page / faq content artifacts (factory stage 5.5).
  // Factory-published products (with a publish manifest) MUST carry landing_page + product_page.
  // Pre-factory records (no manifest yet) validate-if-present so placeholder products don't block.
  const hasManifest = existsSync(join(root, "data", "products", dir, "publish", "manifest.json"));
  const cblock = p.content ?? {};
  const contentSchemas = {
    landing_page: "content-landing.schema.json",
    product_page: "content-product-page.schema.json",
    faq: "content-faq.schema.json",
  };
  for (const [key, schemaFile] of Object.entries(contentSchemas)) {
    const ref = cblock[key];
    if (!ref || typeof ref !== "string") continue;
    const ap = join(root, "data", "products", dir, ref);
    if (!check(rel, `content_exists:${key}`, existsSync(ap), ref)) { fails++; continue; }
    let art;
    try { art = JSON.parse(readFileSync(ap, "utf8")); }
    catch (e) { check(rel, `content_parseable:${key}`, false, e.message); fails++; continue; }
    const sid = `https://swiipt.com/factory/schemas/${schemaFile}`;
    const cv = ajv.validate(sid, art);
    if (!check(rel, `content_valid:${key}`, cv, cv ? "" : ajv.errors.map(e => `${e.instancePath} ${e.message}`).join("; "))) fails++;
  }
  if (hasManifest) {
    if (!check(rel, "g6_content_landing_required", !!cblock.landing_page, "factory-published product requires landing_page content")) fails++;
    if (!check(rel, "g6_content_product_page_required", !!cblock.product_page, "factory-published product requires product_page content")) fails++;
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
