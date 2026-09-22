// FAMILY MONEY STRUCTURAL DRY RUN (Task §68) — NON-GENERATING, 0 provider calls.
//
// Inspects whether an approved product specification can populate the GENERALIZED production
// contracts. It reads records only: no PDF, no content, no campaign, no imagery, no thumbnails,
// no Pinterest, no YouTube, no email, no provider call. Not special-cased to Family Money: the
// same logic runs for any product id.
//
//   node mae/harness/family-money-structural-dryrun.mjs [--product PPL-FAMILY-MONEY-001] [--json]
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as DA from "./design-authority.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OK = "OK", MISSING = "MISSING", PENDING = "PENDING_OWNER_INPUT", PRODUCTION = "PENDING_PRODUCTION";
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const nonEmptyArr = (a) => Array.isArray(a) && a.length > 0;
const hasText = (s) => typeof s === "string" && s.trim().length > 0;

/** Structural readiness of one product's records against the generalized contracts. */
export function structuralDryRun(productId = "PPL-FAMILY-MONEY-001") {
  const pdir = join(ROOT, "data", "products", productId);
  const contracts = [];
  const add = (name, status, detail, fix = "") => contracts.push({ name, status, detail, fix });
  const missing = [];

  const productPath = join(pdir, "product.json");
  if (!existsSync(productPath)) { add("records", MISSING, `no product.json at ${productPath}`); return finish(productId, contracts); }
  const p = readJson(productPath);
  const tid = (p.identity && p.identity.transformation_id) || (p.transformation && p.transformation.id) || null;
  const trPath = tid ? join(ROOT, "data", "transformations", `${tid}.json`) : null;
  const tr = trPath && existsSync(trPath) ? readJson(trPath) : null;
  add("records", tr ? OK : MISSING, tr ? `${productId} + ${tid}` : "transformation record not found");

  // 1. Transformation identity + status
  add("transformation", tid && tr && tr.transformation_id === tid ? OK : MISSING, tid ? `${tid} (${tr ? tr.status : "no record"})` : "no transformation id");

  // 2. Before / 3. After / 4. Mechanism / 5. first win — resolved from the product's transformation block (or the TR)
  const t = p.transformation || {};
  add("before", hasText(t.before_state && t.before_state.summary) || !!(tr && tr.before_state) ? OK : MISSING, "before-state summary");
  add("after", hasText(t.after_state && t.after_state.summary) || !!(tr && tr.after_state) ? OK : MISSING, "after-state summary");
  add("mechanism", hasText(t.mechanism && t.mechanism.core) || !!(tr && tr.mechanism) ? OK : MISSING, "core mechanism");
  add("first_win", (t.first_win && hasText(t.first_win.action)) || !!(tr && tr.first_win) ? OK : MISSING, "first win action");

  // 6. customer-product components (design vocabulary)
  add("customer_product_components", nonEmptyArr(p.design && p.design.components) ? OK : MISSING, `${(p.design && p.design.components || []).length} components declared`);

  // 7. product artifacts (the asset architecture: artifact → built file)
  const am = p.asset_map || {};
  const artifactCount = Object.values(am).reduce((n, a) => n + (Array.isArray(a) ? a.length : 0), 0);
  const mechanismArtifacts = (tr && tr.mechanism && tr.mechanism.mechanisms ? tr.mechanism.mechanisms.length : 0);
  add("product_artifacts", artifactCount > 0 ? OK : MISSING, artifactCount > 0 ? `${artifactCount} artifacts mapped` : `asset_map empty (mechanism names ${mechanismArtifacts} candidate artifacts)` , artifactCount > 0 ? "" : "author the artifact architecture (asset_map: read/do/decide/track/communicate/rescue)");

  // 8. safety
  const safety = p.safety || {};
  add("safety", hasText(safety.disclaimer) && hasText(safety.risk_level) ? OK : MISSING, hasText(safety.risk_level) ? `risk_level=${safety.risk_level}` : "no risk level");

  // 9. pricing (where relevant — required by the commerce/CTA contract)
  const price = p.commerce && p.commerce.price;
  const priced = price && (price.usd || price.base_price_usd || price.amount || Object.keys(price).some((k) => typeof price[k] === "number"));
  add("pricing", priced ? OK : PENDING, priced ? "price set" : "no price figure (owner business call)", priced ? "" : "owner sets per-currency prices");

  // 10. marketing (an approved Marketing Angle Record is the marketing contract input)
  const angleDirs = [join(ROOT, "data", "angles", productId), join(ROOT, "data", "products", productId, "angles"), join(ROOT, "data", "marketing", productId)];
  const hasAngles = angleDirs.some((d) => existsSync(d));
  add("marketing", hasAngles ? OK : MISSING, hasAngles ? "angle record present" : "no approved Marketing Angle Record", hasAngles ? "" : "author + validate the Marketing Angle Record(s)");

  // 11. Visual Grounding compatibility (needs the situation + an approved angle)
  const canGround = hasText(p.customer && p.customer.target_person) && hasText(p.customer && p.customer.situation);
  add("visual_grounding", canGround && hasAngles ? OK : (canGround ? PRODUCTION : MISSING), canGround ? (hasAngles ? "situation + angle inputs present" : "situation present; angle missing") : "no customer person/situation");

  // 12. organic media + 13. FINAL export — downstream of marketing + rendered finals
  add("organic_media", hasAngles ? PRODUCTION : MISSING, hasAngles ? "ready to package once assets/marketing exist" : "blocked on marketing angle");
  add("final_export", artifactCount > 0 && hasAngles ? PRODUCTION : MISSING, "requires rendered finals + a campaign ledger");

  // generation performed? must be NO. provider calls? must be 0.
  add("generation_performed", OK, "NO (records inspected only)");
  add("provider_calls", OK, "0");

  return finish(productId, contracts);
  function finish(id, list) {
    for (const c of list) if (c.status !== OK && c.fix) missing.push(`${c.name}: ${c.fix}`);
    const ready = list.every((c) => c.status === OK || c.status === PRODUCTION);
    return { product_id: id, ready, verdict: ready ? "READY" : "NOT_READY", contracts: list, missing };
  }
}

if (process.argv[1] && process.argv[1].endsWith("family-money-structural-dryrun.mjs")) {
  const i = process.argv.indexOf("--product");
  const id = i >= 0 ? process.argv[i + 1] : "PPL-FAMILY-MONEY-001";
  const r = structuralDryRun(id);
  if (process.argv.includes("--json")) console.log(JSON.stringify(r, null, 2));
  else {
    console.log(`FAMILY MONEY STRUCTURAL DRY RUN — ${r.product_id}`);
    console.log(`design authority: ${DA.assertAuthorityIntegrity().ok ? "resolved" : "MISSING"}`);
    for (const c of r.contracts) console.log(`  ${c.status.padEnd(18)} ${c.name.padEnd(28)} ${c.detail}`);
    console.log(`\nRESULT: ${r.verdict}`);
    if (r.missing.length) { console.log("MISSING UPSTREAM DATA/CONTRACTS:"); for (const m of r.missing) console.log("  - " + m); }
  }
  if (!r.ready) process.exitCode = 2;
}
