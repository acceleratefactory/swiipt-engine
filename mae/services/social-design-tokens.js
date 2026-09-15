// MAE · Social Design Production — token projection (Wave S-B).
// A CONTROLLED PROJECTION of the existing Swiipt brand/design system. No new brand identity:
// no new colours, fonts, spacing philosophy, shadows, radius language or logo behaviour.
//
// Sources (existing, reused — never duplicated into components):
//   · mae/data/brand-truth.json → visual_language (palette, typography, 8pt grid, tokens_version)
//   · "asset design/style.css"  → the existing design-token values (colours, radius literals,
//                                 elevation literals, font weights, font families)
// Failure is explicit: SOCIAL_TOKEN_SOURCE_INVALID when a required source/role is missing.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fail } from "../lib/errors.js";

export const SOCIAL_DESIGN_TOKEN_VERSION = "1.0";
export const TOKEN_STATUS = Object.freeze({ OK: "OK", SOCIAL_TOKEN_SOURCE_INVALID: "SOCIAL_TOKEN_SOURCE_INVALID", SOCIAL_TOKEN_ROLE_MISSING: "SOCIAL_TOKEN_ROLE_MISSING" });

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DESIGN_TOKEN_SOURCE = join(ROOT, "asset design", "style.css");
export const BRAND_TRUTH_SOURCE = join(ROOT, "mae", "data", "brand-truth.json");

// Roles Social Design needs (projected from existing values).
export const REQUIRED_COLOR_ROLES = Object.freeze(["background_primary", "background_secondary", "surface", "text_primary", "text_secondary", "accent_primary", "accent_secondary", "border", "scrim"]);
export const TYPOGRAPHY_ROLES = Object.freeze(["display_headline", "headline", "subheadline", "body", "microcopy", "cta", "statistic", "quote", "price", "badge", "caption"]);

// Existing stylesheet variables → social colour roles (values are read, never hardcoded here).
const COLOR_SOURCE = Object.freeze({
  background_primary: "navy", background_secondary: "soft-surface", surface: "white",
  text_primary: "ink", text_secondary: "text-secondary", accent_primary: "purple",
  accent_secondary: "gold", border: "border", scrim: "navy",
});
const COLOR_EXTRAS = Object.freeze(["warm-surface", "blush", "text-muted", "success", "success-tint", "warning", "warning-tint", "error", "error-tint", "info", "info-tint"]);

// radius token names come from the Design System spec §10; VALUES are derived from stylesheet literals.
const RADIUS_SOURCE = Object.freeze({ "radius-sm": "6pt", "radius-md": "10pt", "radius-lg": "14pt", "radius-xl": "20pt", "radius-pill": "50%" });
// elevation token names are ours (spec only says "use elevation where it communicates hierarchy"); VALUES are existing literals.
const ELEVATION_SOURCE = Object.freeze({
  none: null,
  subtle: "0 1pt 0 rgba(11,31,51,.04)",
  card: "0 10pt 26pt rgba(11,31,51,.16), 0 2pt 5pt rgba(11,31,51,.08)",
  accent: "0 2pt 5pt rgba(217,165,46,.35)",
});
// Typography: family roles + weights come from the existing system; sizes are an explicit
// mobile-first readability SCAFFOLD (never a brand claim), overridable via spec.accessibility.
const TYPOGRAPHY_SOURCE = Object.freeze({
  display_headline: { family_role: "display", weight: 400, line_height_ratio: 1.1, min_size_px: 52 },
  headline: { family_role: "display", weight: 400, line_height_ratio: 1.18, min_size_px: 44 },
  subheadline: { family_role: "ui", weight: 600, line_height_ratio: 1.28, min_size_px: 34 },
  body: { family_role: "ui", weight: 400, line_height_ratio: 1.6, min_size_px: 28 },
  microcopy: { family_role: "ui", weight: 400, line_height_ratio: 1.5, min_size_px: 24 },
  cta: { family_role: "ui", weight: 600, line_height_ratio: 1.2, min_size_px: 32 },
  statistic: { family_role: "display", weight: 400, line_height_ratio: 1.05, min_size_px: 56 },
  quote: { family_role: "display", weight: 400, line_height_ratio: 1.35, min_size_px: 32 },
  price: { family_role: "ui", weight: 700, line_height_ratio: 1.15, min_size_px: 44 },
  badge: { family_role: "ui", weight: 600, line_height_ratio: 1.2, min_size_px: 22 },
  caption: { family_role: "ui", weight: 400, line_height_ratio: 1.45, min_size_px: 24 },
});

/** Deterministic parse of `--name: value;` custom properties (no eval, no execution). */
export function readCssTokens(text, { label = "design token source" } = {}) {
  const out = {};
  for (const m of String(text || "").matchAll(/--([a-z0-9-]+)\s*:\s*([^;}]+)[;}]/gi)) out[m[1].toLowerCase()] = m[2].trim();
  if (!Object.keys(out).length) fail(TOKEN_STATUS.SOCIAL_TOKEN_SOURCE_INVALID, `${label} contains no readable tokens`, { label });
  return Object.freeze(out);
}

/** Every declared value in the stylesheet (custom properties AND normal declarations), normalized.
 *  Used to prove that projected radius/elevation/palette values genuinely exist in the design system. */
export function readCssValues(text) {
  const values = new Set();
  for (const m of String(text || "").matchAll(/[a-z-]+\s*:\s*([^;{}]+)[;}]/gi)) values.add(m[1].trim().toLowerCase());
  for (const m of String(text || "").matchAll(/--[a-z0-9-]+\s*:\s*([^;}]+)[;}]/gi)) values.add(m[1].trim().toLowerCase());
  return values;
}

const norm = (x) => String(x || "").trim().toLowerCase();

/**
 * Project the social token layer from the existing brand/design system.
 * Deterministic, non-mutating, version retained, explicit failure on missing required sources.
 */
export function projectSocialTokens(brandTruth = null, designTokensText = null, options = {}) {
  const cssText = designTokensText != null ? designTokensText : (existsSync(options.designTokenSource || DESIGN_TOKEN_SOURCE) ? readFileSync(options.designTokenSource || DESIGN_TOKEN_SOURCE, "utf8") : null);
  if (cssText == null) fail(TOKEN_STATUS.SOCIAL_TOKEN_SOURCE_INVALID, "design token source not found", { path: options.designTokenSource || DESIGN_TOKEN_SOURCE });
  const css = readCssTokens(cssText, { label: "asset design/style.css" });

  const bt = brandTruth != null ? brandTruth : (existsSync(options.brandTruthSource || BRAND_TRUTH_SOURCE) ? JSON.parse(readFileSync(options.brandTruthSource || BRAND_TRUTH_SOURCE, "utf8")) : null);
  if (!bt || !bt.visual_language) fail(TOKEN_STATUS.SOCIAL_TOKEN_SOURCE_INVALID, "brand truth with visual_language is required", { source: options.brandTruthSource || BRAND_TRUTH_SOURCE });
  const vl = bt.visual_language;
  if (!vl.tokens_version) fail(TOKEN_STATUS.SOCIAL_TOKEN_SOURCE_INVALID, "brand token version is required", {});
  if (!vl.typography || !vl.typography.display || !vl.typography.ui) fail(TOKEN_STATUS.SOCIAL_TOKEN_SOURCE_INVALID, "brand typography (display, ui) is required", {});
  if (!vl.layout_grid) fail(TOKEN_STATUS.SOCIAL_TOKEN_SOURCE_INVALID, "brand layout grid is required", {});
  if (!Array.isArray(vl.palette) || vl.palette.length === 0) fail(TOKEN_STATUS.SOCIAL_TOKEN_SOURCE_INVALID, "brand palette is required", {});

  // every brand palette colour must exist in the design-token values (projection, not invention)
  const cssValues = readCssValues(cssText);
  for (const hex of vl.palette) if (!cssValues.has(norm(hex))) fail(TOKEN_STATUS.SOCIAL_TOKEN_SOURCE_INVALID, `brand palette colour ${hex} is not present in the design token source`, { hex });

  // colours
  const colors = {};
  for (const [role, source] of Object.entries(COLOR_SOURCE)) {
    const v = css[source];
    if (!v) fail(TOKEN_STATUS.SOCIAL_TOKEN_ROLE_MISSING, `design token "--${source}" required for colour role "${role}" is missing`, { role, source });
    colors[role] = v;
  }
  const extras = {};
  for (const k of COLOR_EXTRAS) if (css[k]) extras[k] = css[k];

  // radius (values must genuinely exist in the existing stylesheet)
  const radius = {};
  for (const [name, literal] of Object.entries(RADIUS_SOURCE)) {
    if (!cssValues.has(norm(literal))) fail(TOKEN_STATUS.SOCIAL_TOKEN_SOURCE_INVALID, `radius ${name} value "${literal}" is not present in the design token source (do not invent radius values)`, { name });
    radius[name] = literal;
  }
  // elevation (same rule)
  const elevation = {};
  for (const [name, literal] of Object.entries(ELEVATION_SOURCE)) {
    if (literal == null) { elevation[name] = null; continue; }
    if (!cssValues.has(norm(literal))) fail(TOKEN_STATUS.SOCIAL_TOKEN_SOURCE_INVALID, `elevation ${name} value is not present in the design token source`, { name });
    elevation[name] = literal;
  }

  const grid = vl.layout_grid === "8pt" ? 8 : null;
  if (grid == null) fail(TOKEN_STATUS.SOCIAL_TOKEN_SOURCE_INVALID, `unsupported brand layout grid "${vl.layout_grid}"`, {});
  const spacing = {};
  for (const n of [1, 2, 3, 4, 5, 6, 8, 10]) spacing[`space-${n}`] = grid * n;

  const typography = {};
  for (const role of TYPOGRAPHY_ROLES) {
    const t = TYPOGRAPHY_SOURCE[role];
    typography[role] = Object.freeze({
      role,
      family_role: t.family_role,
      family: t.family_role === "display" ? vl.typography.display : vl.typography.ui,
      weight: t.weight,
      line_height_ratio: t.line_height_ratio,
      min_size_px: t.min_size_px,
      derived_from: ["brand-truth.visual_language.typography", "asset design/style.css (font weights 400/500/600/700)", "S-B mobile-first readability scaffold (overridable)"],
    });
  }

  const projection = {
    token_version: SOCIAL_DESIGN_TOKEN_VERSION,
    brand_tokens_version: vl.tokens_version,
    sources: Object.freeze({
      brand_truth: options.brandTruthSource || BRAND_TRUTH_SOURCE,
      design_tokens: options.designTokenSource || DESIGN_TOKEN_SOURCE,
      palette: vl.palette,
      typography: { display: vl.typography.display, ui: vl.typography.ui },
      layout_grid: vl.layout_grid,
    }),
    colors: Object.freeze(colors),
    color_extras: Object.freeze(extras),
    typography: Object.freeze(typography),
    spacing: Object.freeze(spacing),
    grid,
    radius: Object.freeze(radius),
    border: Object.freeze({ width: "1pt", style: "solid", color: colors.border }),
    elevation: Object.freeze(elevation),
    brand: Object.freeze({
      tokens_version: vl.tokens_version,
      logo: Object.freeze({ variants: Object.freeze(["primary"]), clear_space_pt: 48, min_size_pt: 32, derived_from: "social-design-spec:logo_policy defaults" }),
      safe_area_default: Object.freeze({ top: 96, right: 96, bottom: 96, left: 96 }),
    }),
    status: TOKEN_STATUS.OK,
  };
  return Object.freeze(projection);
}

/** Convenience: the canonical projected token set for the repository. */
export function socialTokens() { return projectSocialTokens(); }
