#!/usr/bin/env node
// Factory tool - builds a publish-manifest from a product directory.
// Usage: node harness/build-manifest.mjs <PRODUCT_ID> [outFile]
// Reads data/products/<ID>/product.json + assets/*.json (+ their source_path content files),
// inlines asset content, and records the ACTUAL authoritative QA/gate results + the explicit
// upstream publication authorization. It never manufactures PASS or authorization: if a required
// gate result or the authorization record does not exist, manifest construction stops (exit 3).
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// --- schema pool: the built manifest MUST validate before it is written, so this drift cannot recur ---
const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addFormat("date-time", /^\d{4}-\d{2}-\d{2}T/);
ajv.addFormat("date", /^\d{4}-\d{2}-\d{2}$/);
for (const f of readdirSync(join(root, "schemas")).filter((x) => x.endsWith(".schema.json"))) {
  const sch = JSON.parse(readFileSync(join(root, "schemas", f), "utf8"));
  sch.$id = `https://swiipt.com/factory/schemas/${f}`;
  try { ajv.addSchema(sch); } catch (e) { /* already added */ }
}
const MANIFEST_SCHEMA = "https://swiipt.com/factory/schemas/publish-manifest.schema.json";
const argv = process.argv.slice(2);
const dataRootIx = argv.indexOf("--data-root");
const dataRootArg = dataRootIx >= 0 ? argv[dataRootIx + 1] : null;
const dataRoot = dataRootArg ? resolve(dataRootArg) : root;
const positional = argv.filter((a, i) => !a.startsWith("--") && !(dataRootIx >= 0 && i === dataRootIx + 1));
const pid = positional[0];
const outArg = positional[1] ?? `data/products/${pid}/publish/manifest.json`;
if (!pid) { console.error("usage: build-manifest.mjs <PRODUCT_ID> [out] [--data-root <dir>]"); process.exit(2); }

const pdir = join(dataRoot, "data", "products", pid);
const p = JSON.parse(readFileSync(join(pdir, "product.json"), "utf8"));
const trId = p.identity.transformation_id;
let tr = null;
const trPath = join(dataRoot, "data", "transformations", `${trId}.json`);
if (existsSync(trPath)) tr = JSON.parse(readFileSync(trPath, "utf8"));

// Phase K (defense in depth): a product may reference only a validated-or-better transformation.
if (tr && !["validated", "active"].includes(tr.status)) {
  console.error(`FAIL ${pid}: transformation ${trId} is "${tr.status}" - only a validated-or-better transformation may be published. Run harness/validate-transformation.mjs.`);
  process.exit(3);
}

// Phase G (defense in depth): open blocking research/evidence gaps stop manifest construction.
const gapDir = join(dataRoot, "data", "research-gaps");
if (existsSync(gapDir)) {
  const openGaps = readdirSync(gapDir).filter((f) => f.endsWith(".json"))
    .map((f) => { try { return JSON.parse(readFileSync(join(gapDir, f), "utf8")); } catch { return null; } })
    .filter(Boolean)
    .filter((g) => g.status === "OPEN" && g.blocks_progression !== false &&
      (g.transformation_id === trId || g.product_id === pid || (g.transformation_id === null && g.product_id === null && !g.opportunity_id)));
  if (openGaps.length) {
    console.error(`FAIL ${pid}: ${openGaps.length} open blocking research gap(s): ${openGaps.map((g) => g.gap_id).join(", ")}. Resolve or waive them (harness/pipeline.mjs) before publication.`);
    process.exit(3);
  }
}

const jobMap = {
  READ: "READ", DO: "DO", DECIDE: "DECIDE", TRACK: "TRACK", CALCULATE: "CALCULATE",
  COMMUNICATE: "COMMUNICATE", RESCUE: "RESCUE", RE_ENTER: "RE_ENTER",
  MAINTAIN: "MAINTAIN", REMEMBER: "REMEMBER",
};

// Resolve a source_path that may be a whole file ("content/x.md") or a bundle
// section ("content/bundle.md#section.md" -> the =====FILE section.md===== block).
function readSource(pdir, sourcePath) {
  let filePart = sourcePath;
  let section = null;
  const ix = sourcePath.indexOf("#");
  if (ix >= 0) { filePart = sourcePath.slice(0, ix); section = sourcePath.slice(ix + 1); }
  const raw = readFileSync(join(pdir, filePart), "utf8");
  if (!section) return raw;
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lines = raw.split(/\r?\n/);
  const startRe = new RegExp("^=====FILE\\s+" + esc(section) + "\\s*=====$");
  let start = -1;
  for (let i = 0; i < lines.length; i++) { if (startRe.test(lines[i].trim())) { start = i; break; } }
  if (start < 0) throw new Error(`section "${section}" not found in ${filePart}`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) { if (/^=====FILE\s+.*=====$/.test(lines[i].trim())) { end = i; break; } }
  return lines.slice(start + 1, end).join("\n").replace(/^\s+/, "").replace(/\s+$/, "") + "\n";
}

const assets = [];
for (const list of Object.values(p.asset_map)) {
  for (const aid of list) {
    const af = join(pdir, "assets", `${aid}.json`);
    if (!existsSync(af)) throw new Error(`missing asset record ${aid}`);
    const a = JSON.parse(readFileSync(af, "utf8"));
    let content = "";
    if (a.source_path) {
      content = readSource(pdir, a.source_path);
    }
    assets.push({ job: jobMap[a.job] ?? a.job, title: a.title, content });
  }
}

// Canonical per-currency prices live on commerce.currency_rules.prices (manual-first, geo-displayed).
// NEVER rate-convert and NEVER silently drop currencies: every declared price reaches the manifest.
const prices = {};
for (const [k, v] of Object.entries(p.commerce?.currency_rules?.prices ?? p.commerce?.price?.currency_rules?.prices ?? {})) prices[k] = v;

// --- commerce + access (Standard v1 §20; schema-required) ---
// Source is the product record's commerce block. The publisher does not currently consume these
// blocks, but they are part of the publishing contract. Never fabricate: if the source is missing,
// the build fails structurally instead of emitting an incomplete manifest.
const commerce = p.commerce ?? null;
if (!commerce || !commerce.price || typeof commerce.price.base_usd !== "number" || !commerce.currency_rules || typeof commerce.currency_rules !== "object" || Object.keys(commerce.currency_rules).length === 0) {
  console.error(`FAIL ${pid}: commerce source missing - product.commerce.price.base_usd + commerce.currency_rules are required for the publish manifest. Reconcile the product record (Product Architect) first.`);
  process.exit(3);
}
const accessRules = commerce.access_rules ?? {};
if (!accessRules.grant_type) {
  console.error(`FAIL ${pid}: access source missing - product.commerce.access_rules.grant_type is required for the publish manifest. Reconcile the product record (Product Architect) first.`);
  process.exit(3);
}
const access = { grant_type: accessRules.grant_type };
if (accessRules.expiry_days !== undefined) access.expiry_days = accessRules.expiry_days;
if (accessRules.download_formats !== undefined) access.download_formats = accessRules.download_formats;

// --- QA verdicts (Standard v1 §19/§20) from the AUTHORITATIVE product record - never manufactured ---
// deterministic <- Gate 7 + all qa.deterministic_tests PASS ; ai <- Gate 7 + all qa.ai_tests PASS ;
// safety <- Gate 5 ; commerce <- Gate 8 ; journey <- Gate 9. A pending/FAIL/absent result is NOT PASS.
const gates = p.qa?.gate_results ?? {};
const detTests = p.qa?.deterministic_tests ?? [];
const aiTests = p.qa?.ai_tests ?? [];
const allPass = (arr, key) => Array.isArray(arr) && arr.length > 0 && arr.every((t) => t[key] === "PASS");
const qaVerdicts = {
  deterministic: gates.g7_product_qa === "PASS" && allPass(detTests, "result") ? "PASS" : "FAIL",
  ai: gates.g7_product_qa === "PASS" && allPass(aiTests, "status") ? "PASS" : "FAIL",
  safety: gates.g5_safety === "PASS" ? "PASS" : "FAIL",
  commerce: gates.g8_commerce === "PASS" ? "PASS" : "FAIL",
  journey: gates.g9_customer_journey === "PASS" ? "PASS" : "FAIL",
};
const unmetGates = Object.entries(qaVerdicts).filter(([, v]) => v !== "PASS").map(([k]) => k);
if (unmetGates.length) {
  console.error(`FAIL ${pid}: QA gate(s) not PASS - ${unmetGates.join(", ")}. Manifest construction stopped.`);
  console.error(`  Record the authoritative outcomes upstream in product.qa.gate_results (g5_safety, g7_product_qa, g8_commerce, g9_customer_journey) and qa.deterministic_tests/qa.ai_tests (QA agent / qa-checks). Missing results are never defaulted to PASS.`);
  process.exit(3);
}

// --- publication authorization (Gate 10 / §21 human authority) from an explicit upstream record ---
const auth = p.publishing?.authorization ?? null;
if (!auth || auth.status !== "READY_TO_PUBLISH" || !auth.authorized_by) {
  console.error(`FAIL ${pid}: publish_authorization missing. Manifest construction stopped.`);
  console.error(`  Record an explicit human authorization at product.publishing.authorization { status: "READY_TO_PUBLISH", authorized_by, authorized_at }. The builder never manufactures authorization.`);
  process.exit(3);
}

// --- PRE_REVENUE human-review gate (text intelligence operating mode) ---
// The Premium Supervisor is DEFERRED in PRE_REVENUE mode; cases that would need it, plus explicit
// HUMAN_REVIEW_REQUIRED cases, route to a HUMAN_REVIEW record. That record is a BLOCKING state: while it
// is PENDING_HUMAN_REVIEW or BLOCKED no publish manifest may be built. This never manufactures
// authorization and never converts an unresolved review into PASS.
const humanReview = p.human_review ?? null;
if (humanReview && (humanReview.status === "PENDING_HUMAN_REVIEW" || humanReview.status === "BLOCKED")) {
  console.error(`FAIL ${pid}: publication blocked - human review is ${humanReview.status}${humanReview.reason ? ` (${humanReview.reason})` : ""}. Resolve it explicitly before building a publish manifest.`);
  process.exit(3);
}

// Inline generated product content (landing page / product page / faq) from copy/ artifacts,
// so the live publisher receives self-contained content (no factory-repo filesystem at publish time).
function readCopy(rel) {
  const fp = join(pdir, rel);
  if (!existsSync(fp)) return null;
  try { return JSON.parse(readFileSync(fp, "utf8")); } catch { return null; }
}
const content = {};
for (const key of ["landing_page", "product_page", "faq", "reviews"]) {
  const ptr = p.content?.[key];
  if (ptr) {
    const data = readCopy(ptr);
    if (data) content[key] = data;
  }
}

const manifest = {
  manifest_version: "1.0",
  product_id: p.product_id,
  publish_target: "wordpress",
  transformation: {
    // Identity contract: the transformation may carry an explicit NAME. The desired-state/after_state
    // prose is NEVER a title and is NEVER truncated into one. Absent an explicit name, fall back to the
    // canonical product name — never to transformation prose.
    title: tr?.name ?? tr?.transformation_name ?? tr?.title ?? p.identity.name,
    desired_state: tr?.situation?.desired_transformation ?? tr?.after_state ?? null,
    area: p.identity.library_id,
    summary: p.identity.one_line_promise,
    evidence_label: "research-backed",
    tsm: tr ? {
      before_baseline: tr.tsm.before_baseline,
      success_indicators: tr.tsm.success_indicators,
      measurement_method: tr.tsm.measurement_method,
      measurement_days: tr.tsm.measurement_days,
      success_threshold: tr.tsm.success_threshold,
    } : {},
  },
  product: {
    title: p.identity.name,
    description: p.identity.subtitle,
    short_description: p.identity.one_line_promise,
    base_price_usd: p.commerce.price.base_usd,
    prices,
  },
  assets,
  content,
  commerce,
  relationships: {
    next_transformation_ids: p.transformation.next_transformation_ids ?? [],
  },
  access,
  seo: {
    title: `${p.identity.name} | Swiipt`,
    description: p.identity.one_line_promise.slice(0, 160),
    focus_keyword: p.identity.name.toLowerCase(),
  },
  // Writing / Generation Control (decision #5): propagate the version + execution-record ref.
  ...(p.generation?.writing_control_version ? {
    generation: (() => {
      const gmPath = join(pdir, "copy", "generation-manifest.json");
      let status = null;
      if (existsSync(gmPath)) { try { status = JSON.parse(readFileSync(gmPath, "utf8")).status ?? null; } catch (e) { /* ignore */ } }
      return { writing_control_version: p.generation.writing_control_version, manifest: "copy/generation-manifest.json", status };
    })(),
  } : {}),
  qa: qaVerdicts,
  publish_authorization: {
    status: auth.status,
    authorized_by: auth.authorized_by,
    authorized_at: auth.authorized_at,
    ...(auth.notes ? { notes: auth.notes } : {}),
  },
};

// Validate before writing: a manifest that violates the contract must never be produced.
if (!ajv.validate(MANIFEST_SCHEMA, manifest)) {
  console.error(`FAIL ${pid}: built manifest does not validate against publish-manifest.schema.json:`);
  for (const e of ajv.errors) console.error(`  ${e.instancePath || "(root)"} ${e.message}`);
  process.exit(1);
}
writeFileSync(resolve(dataRoot, outArg), JSON.stringify(manifest, null, 2) + "\n");
console.log(`manifest -> ${outArg} (${assets.length} assets, ${(JSON.stringify(manifest).length / 1024).toFixed(1)} KB, schema-valid)`);
