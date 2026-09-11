// MAE · BrandTruthService (S2 §8). Versioned global brand config. The writing register REUSES the
// Writing Control layer (config/writing-control.v1.json + standards/writing-standard.md) — referenced, not forked.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MAE_DIR } from "../lib/store.js";
import { fail, CODES } from "../lib/errors.js";

const FACTORY_ROOT = join(MAE_DIR, "..");
const BRAND_FILE = join(MAE_DIR, "data", "brand-truth.json");

export const BrandTruthService = {
  loadBrand() {
    return JSON.parse(readFileSync(BRAND_FILE, "utf8"));
  },
  version() { return this.loadBrand().version; },
  /** Resolve the referenced canonical Writing Control artifacts (reuse/no-fork guard). */
  writingRegister() {
    const b = this.loadBrand();
    const cfg = join(FACTORY_ROOT, b.writing_constitution_ref.config);
    const std = join(FACTORY_ROOT, b.writing_constitution_ref.standard);
    if (!existsSync(cfg) || !existsSync(std)) {
      fail(CODES.REFERENCE_UNRESOLVED, "Brand Truth references the Writing Control layer but it was not found", { cfg, std });
    }
    const config = JSON.parse(readFileSync(cfg, "utf8"));
    return { config, standardPath: std, forbidden_phrases: config.constitution.forbidden_phrases };
  },
  /** Faith-register gate (S3 §3.10.7): allowed only if brand-level approved AND product has CRF faith evidence. */
  faithRegisterAllowed(product_id, crfHasFaithEvidence = false) {
    const b = this.loadBrand();
    const brandOk = b.faith_register?.allowed === true && (b.faith_register.approved_products || []).includes(product_id);
    return brandOk && crfHasFaithEvidence === true;
  },
  /** Visual tokens version for render specs (Typographic/Core). */
  visualTokensVersion() { return this.loadBrand().visual_language.tokens_version; },
  prohibitedBehaviours() { return this.loadBrand().prohibited_behaviours; },
};
