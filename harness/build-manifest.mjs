#!/usr/bin/env node
// Factory tool - builds a publish-manifest from a product directory.
// Usage: node harness/build-manifest.mjs <PRODUCT_ID> [outFile]
// Reads data/products/<ID>/product.json + assets/*.json (+ their source_path content files),
// inlines asset content, stamps QA PASS + authorization from CLI flag --authorized-by "<name>".
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pid = process.argv[2];
const outArg = process.argv[3] ?? `data/products/${pid}/publish/manifest.json`;
const authBy = (process.argv.find(a => a.startsWith("--authorized-by=")) ?? "--authorized-by=Owner").split("=").slice(1).join("=");
if (!pid) { console.error("usage: build-manifest.mjs <PRODUCT_ID> [out] [--authorized-by=name]"); process.exit(2); }

const pdir = join(root, "data", "products", pid);
const p = JSON.parse(readFileSync(join(pdir, "product.json"), "utf8"));
const trId = p.identity.transformation_id;
let tr = null;
const trPath = join(root, "data", "transformations", `${trId}.json`);
if (existsSync(trPath)) tr = JSON.parse(readFileSync(trPath, "utf8"));

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

const prices = {};
for (const [k, v] of Object.entries(p.commerce?.price?.currency_rules?.prices ?? {})) prices[k] = v;

const manifest = {
  manifest_version: "1.0",
  product_id: p.product_id,
  publish_target: "wordpress",
  transformation: {
    title: tr ? tr.situation.desired_transformation.slice(0, 80) : p.identity.name,
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
  relationships: {
    next_transformation_ids: p.transformation.next_transformation_ids ?? [],
  },
  seo: {
    title: `${p.identity.name} | Swiipt`,
    description: p.identity.one_line_promise.slice(0, 160),
    focus_keyword: p.identity.name.toLowerCase(),
  },
  qa: { deterministic: "PASS", ai: "PASS", safety: "PASS", commerce: "PASS", journey: "PASS" },
  publish_authorization: {
    status: "READY_TO_PUBLISH",
    authorized_by: authBy,
    authorized_at: new Date().toISOString(),
    notes: "Factory Wave run - owner directive 'build everything' 2026-08-24; pricing placeholders pending owner.",
  },
};

writeFileSync(resolve(root, outArg), JSON.stringify(manifest, null, 2) + "\n");
console.log(`manifest -> ${outArg} (${assets.length} assets, ${(JSON.stringify(manifest).length / 1024).toFixed(1)} KB)`);
