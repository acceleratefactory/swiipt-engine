// MAE · BrandTruthService (S2 §8). Versioned global brand config. The writing register REUSES the
// Writing Control layer (config/writing-control.v1.json + standards/writing-standard.md) — referenced, not forked.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MAE_DIR } from "../lib/store.js";
import { fail, CODES } from "../lib/errors.js";
import { socialTokens } from "./social-design-tokens.js";

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

  /**
   * The canonical allowed colour set for production design specifications.
   * Derived from Brand Truth visual_language.palette PLUS the projected design-system token role
   * values (asset design/style.css via social-design-tokens.js). No new colours are invented here:
   * a colour is allowed only if it already exists in an authoritative source.
   * @returns {{palette:string[], roles:Record<string,string>, allowed:Set<string>}}
   */
  allowedColors() {
    const brand = this.loadBrand();
    const palette = (brand.visual_language?.palette || []).map((c) => String(c).toUpperCase());
    let tokens = null;
    try { tokens = socialTokens(); } catch { tokens = null; }
    const roles = {};
    const allowed = new Set(palette.map((c) => c.toUpperCase()));
    if (tokens) {
      for (const [role, val] of Object.entries(tokens.colors || {})) { roles[role] = normHex(val); allowed.add(normHex(val)); }
      for (const [role, val] of Object.entries(tokens.color_extras || {})) { roles[`extra_${role}`] = normHex(val); allowed.add(normHex(val)); }
    }
    return { palette, roles, allowed };
  },

  /**
   * Extract every colour token declared by a Social Design Specification, with its semantic role.
   * Roles follow the existing design-system model (background / text / accent / cta / border).
   */
  designSpecColorTokens(spec = {}) {
    const out = [];
    const push = (role, path, value) => { if (value != null && String(value).trim() !== "") out.push({ role, path, value: String(value).trim() }); };
    push("background", "background_policy.color", spec.background_policy?.color);
    for (const [role, def] of Object.entries(spec.typography_roles || {})) push(`text:${role}`, `typography_roles.${role}.color`, def?.color);
    push("accent:cta", "cta_policy.color", spec.cta_policy?.color);
    push("border", "border.color", spec.border?.color);
    // nested slide typography (multi-panel specs)
    (spec.slides || []).forEach((s, i) => {
      for (const [role, def] of Object.entries(s.typography_roles || {})) push(`text:${role}`, `slides[${i}].typography_roles.${role}.color`, def?.color);
    });
    return out;
  },

  /**
   * Deterministic Brand QA: every declared colour token must be permitted by the active
   * Brand Truth / design system. Returns { pass, violations[] }.
   */
  checkDesignSpecColors(spec = {}) {
    const { allowed, roles, palette } = this.allowedColors();
    const tokens = this.designSpecColorTokens(spec);
    const violations = [];
    for (const t of tokens) {
      const hex = normHex(t.value);
      if (!HEX_RE.test(hex)) continue;                 // non-hex (e.g. var()) is not colour-matched here
      if (!allowed.has(hex)) violations.push({ field: t.path, role: t.role, value: t.value, normalized: hex });
    }
    return { pass: violations.length === 0, violations, checked: tokens.length, palette, role_count: Object.keys(roles).length };
  },
};

const HEX_RE = /^#[0-9A-F]{6}$/i;
function normHex(v) { return String(v || "").trim().toUpperCase(); }
