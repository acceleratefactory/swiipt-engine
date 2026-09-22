// SWIIPT DESIGN AUTHORITY — the single machine-readable projection consumed by the generic
// marketing/production path.
//
// Task §31/§36/§37/§60: there is ONE canonical authority record (`mae/data/brand-truth.json` →
// `visual_language`, ingested from the SWIIPT Brand Quick Reference "Quiet Intelligence" and
// "The Visual Interchangeability Standard v1.0") plus the locked customer-product design system
// (`asset design/style.css`) and the official brand-asset kit (`asset design/swiipt-brand-assets/`).
// This module does NOT create a second brand system: it RESOLVES and PROJECTS the canonical record
// so the compositor, component library and QA never restate brand values independently.
//
// Failure is explicit (never silent): a required locked rule that cannot be resolved throws.
import fs from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const BRAND_TRUTH_PATH = join(ROOT, "mae", "data", "brand-truth.json");
export const DESIGN_TOKENS_PATH = join(ROOT, "asset design", "style.css");
export const BRAND_KIT_DIR = join(ROOT, "asset design", "swiipt-brand-assets");
export const FONT_DIR = join(ROOT, "mae", "assets", "fonts");

/* ------------------------------------------------------------------ load + validate authority */
let _cache = null;
function readAuthority() {
  if (_cache) return _cache;
  if (!fs.existsSync(BRAND_TRUTH_PATH)) throw new Error(`design authority: brand truth record not found: ${BRAND_TRUTH_PATH}`);
  const bt = JSON.parse(fs.readFileSync(BRAND_TRUTH_PATH, "utf8"));
  const vl = bt.visual_language;
  if (!vl) throw new Error("design authority: brand truth has no visual_language block");
  _cache = { bt, vl };
  return _cache;
}
export const authority = () => readAuthority().vl;

/** The locked customer-product design tokens (`asset design/style.css` `:root`). */
let _cssCache = null;
function designTokens() {
  if (_cssCache) return _cssCache;
  if (!fs.existsSync(DESIGN_TOKENS_PATH)) throw new Error(`design authority: locked design system not found: ${DESIGN_TOKENS_PATH}`);
  const text = fs.readFileSync(DESIGN_TOKENS_PATH, "utf8");
  const out = {};
  for (const m of text.matchAll(/--([a-z0-9-]+)\s*:\s*([^;}]+)[;}]/gi)) out[m[1].toLowerCase()] = m[2].trim();
  if (!Object.keys(out).length) throw new Error("design authority: locked design system declares no tokens");
  _cssCache = out;
  return _cssCache;
}

/* ------------------------------------------------------------------ colour tokens (12 + neutrals) */
/** The 12 canonical brand colour tokens, resolved from the authority record. */
export function colourTokens() {
  const vl = authority();
  if (!Array.isArray(vl.colour_tokens) || vl.colour_tokens.length !== 12) {
    throw new Error(`design authority: expected the 12 canonical colour tokens, found ${Array.isArray(vl.colour_tokens) ? vl.colour_tokens.length : 0}`);
  }
  return vl.colour_tokens.map((t) => ({ token: t.token, hex: t.hex, role: t.role }));
}
export const PALETTE = () => colourTokens().map((t) => t.hex);

/** Named neutral/support tokens from the locked design system (NOT the 12 brand swatches). */
export function supportTokens() {
  const c = designTokens();
  const pick = { white: "white", text_secondary: "text-secondary", border: "border", success_tint: "success-tint", warning_tint: "warning-tint", error_tint: "error-tint", info_tint: "info-tint" };
  const out = {};
  for (const [name, key] of Object.entries(pick)) if (c[key]) out[name] = c[key];
  return out;
}

/** token name → hex (brand tokens first, then support tokens). */
export function hex(name) {
  const t = colourTokens().find((x) => x.token === name);
  if (t) return t.hex;
  const s = supportTokens();
  if (s[name]) return s[name];
  throw new Error(`design authority: unknown colour token "${name}"`);
}

/** The full set of legitimately brand colours (brand swatches + design-system neutrals). */
export function brandColourSet() {
  const set = new Set(colourTokens().map((t) => t.hex.toUpperCase()));
  for (const v of Object.values(supportTokens())) set.add(String(v).toUpperCase());
  return set;
}

/** Machine-check: is a CSS colour value one of the brand colours (optionally as an alpha tint)? */
export function isBrandColour(value) {
  if (value == null) return false;
  const v = String(value).trim().toUpperCase();
  if (v === "TRANSPARENT" || v === "NONE" || v === "INHERIT" || v === "CURRENTCOLOR") return true;
  const set = brandColourSet();
  if (set.has(v)) return true;
  const short = /^#([0-9A-F])([0-9A-F])([0-9A-F])$/.exec(v);
  if (short) return set.has(`#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`);
  // rgba(...) / rgb(...) numeric — allow a brand colour expressed with alpha
  const m = /^RGBA?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(v);
  if (m) {
    const h = "#" + [1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, "0")).join("").toUpperCase();
    return set.has(h);
  }
  return false;
}

/* ------------------------------------------------------------------ typography (semantic roles) */
// The 12-role semantic vocabulary the renderer reasons from (Task §10) — never a product branch.
export const TYPE_ROLE_NAMES = Object.freeze(["hook", "editorial_headline", "verbatim_quote", "body", "caption", "label", "cta", "data", "attribution"]);

/** Semantic role → concrete CSS font descriptor. Values come from the authority. */
export function typeRoles() {
  const vl = authority();
  const r = (vl.typography && vl.typography.roles) || {};
  if (!r.hook || !r.editorial_headline || !r.verbatim_quote || !r.body) {
    throw new Error("design authority: typography roles (hook/editorial_headline/verbatim_quote/body) incomplete");
  }
  return {
    hook: { family: r.hook.family || vl.typography.ui || "Inter", weight: Number(r.hook.weight) || 800, style: "normal" },
    editorial_headline: { family: r.editorial_headline.family || vl.typography.display || "DM Serif Display", weight: 400, style: "normal" },
    verbatim_quote: { family: r.verbatim_quote.family || vl.typography.display || "DM Serif Display", weight: 400, style: "italic" },
    body: { family: r.body.family || vl.typography.ui || "Inter", weight: 400, style: "normal" },
    caption: { family: vl.typography.ui || "Inter", weight: 400, style: "normal" },
    label: { family: vl.typography.ui || "Inter", weight: 700, style: "normal" },
    cta: { family: vl.typography.ui || "Inter", weight: 700, style: "normal" },
    data: { family: vl.typography.display || "DM Serif Display", weight: 400, style: "normal" },
    attribution: { family: vl.typography.ui || "Inter", weight: 600, style: "normal" },
  };
}

/** CSS font-family + weight + style for a semantic role. */
export function typeCss(role) {
  const t = typeRoles()[role];
  if (!t) throw new Error(`design authority: unknown typography role "${role}"`);
  const stack = t.family === "DM Serif Display" ? `'DM Serif Display', Georgia, serif` : `${t.family}, Helvetica, Arial, sans-serif`;
  return { family: stack, weight: t.weight, style: t.style };
}

/** `@font-face` CSS for the whole canonical brand font kit (Inter incl. Black 800, DM Serif + Italic). */
export function fontFaceCss() {
  const f = fontFiles();
  const u = (k) => pathToFileURL(join(FONT_DIR, f[k])).href;
  return `
@font-face{font-family:'Inter';font-weight:400;font-style:normal;src:url('${u("Inter-Regular")}');}
@font-face{font-family:'Inter';font-weight:400;font-style:italic;src:url('${u("Inter-Italic")}');}
@font-face{font-family:'Inter';font-weight:500;font-style:normal;src:url('${u("Inter-Medium")}');}
@font-face{font-family:'Inter';font-weight:600;font-style:normal;src:url('${u("Inter-SemiBold")}');}
@font-face{font-family:'Inter';font-weight:700;font-style:normal;src:url('${u("Inter-Bold")}');}
@font-face{font-family:'Inter';font-weight:800;font-style:normal;src:url('${u("Inter-Black")}');}
@font-face{font-family:'DM Serif Display';font-weight:400;font-style:normal;src:url('${u("DMSerifDisplay-Regular")}');}
@font-face{font-family:'DM Serif Display';font-weight:400;font-style:italic;src:url('${u("DMSerifDisplay-Italic")}');}`;
}

/** The canonical font files live beside the compositor. Inter Black (800) is the hook face. */
export function fontFiles() {
  return {
    "Inter-Regular": "Inter-Regular.ttf",
    "Inter-Medium": "Inter-Medium.ttf",
    "Inter-SemiBold": "Inter-SemiBold.ttf",
    "Inter-Bold": "Inter-Bold.ttf",
    "Inter-Black": "Inter-Black.ttf",
    "Inter-Italic": "Inter-Italic.ttf",
    "DMSerifDisplay-Regular": "DMSerifDisplay-Regular.ttf",
    "DMSerifDisplay-Italic": "DMSerifDisplay-Italic.ttf",
  };
}

/* ------------------------------------------------------------------ Transformation Mark */
export const MARK_VARIANTS = Object.freeze(["primary", "reverse", "mono-navy", "mono-white"]);
const MARK_FILE = { primary: "mark-primary.svg", reverse: "mark-reverse.svg", "mono-navy": "mark-mono-navy.svg", "mono-white": "mark-mono-white.svg" };

/** The official Transformation Mark SVG (locked brand asset). Never a CSS approximation. */
export function markSvg(variant = "primary", { size = null } = {}) {
  if (!MARK_VARIANTS.includes(variant)) throw new Error(`design authority: unknown mark variant "${variant}"`);
  const p = join(BRAND_KIT_DIR, "01-logo", MARK_FILE[variant]);
  if (!fs.existsSync(p)) throw new Error(`design authority: official mark asset missing: ${p}`);
  let svg = fs.readFileSync(p, "utf8").trim();
  if (size) svg = svg.replace(/width="\d+(\.\d+)?"/, `width="${size}"`).replace(/height="\d+(\.\d+)?"/, `height="${size}"`);
  return svg;
}

/** The official horizontal lockup (mark + SWIIPT wordmark) — the default logo per the brand kit. */
export function logoSvg({ dark = false, height = 32 } = {}) {
  const p = join(BRAND_KIT_DIR, "01-logo", dark ? "lockup-horizontal-reverse.svg" : "lockup-horizontal-primary.svg");
  if (!fs.existsSync(p)) throw new Error(`design authority: official lockup asset missing: ${p}`);
  const ratio = 718 / 208;
  const w = Math.round(height * ratio);
  let svg = fs.readFileSync(p, "utf8").trim();
  svg = svg.replace(/width="\d+(\.\d+)?"/, `width="${w}"`).replace(/height="\d+(\.\d+)?"/, `height="${height}"`);
  if (!/preserveAspectRatio/.test(svg)) svg = svg.replace("<svg ", `<svg preserveAspectRatio="xMinYMid meet" `);
  return svg;
}

/** Correct official variant for a surface (authority: reverse on dark, primary on light). */
export function markVariantFor({ dark = false, monochrome = false } = {}) {
  if (monochrome) return dark ? "mono-white" : "mono-navy";
  return dark ? "reverse" : "primary";
}

/** Minimum display size + clear space (authority). */
export function markRules() {
  const vl = authority();
  const m = vl.transformation_mark;
  return {
    min_digital_px: 24,
    clear_space: (m && m.clear_space) || "half the mark's own height on every side",
    prohibited: (m && m.prohibited) || ["stretch", "recolor outside the variants", "skew", "drop shadows", "bevels"],
  };
}

/* ------------------------------------------------------------------ brand asset kit (favicon/app icon/OG) */
let _assetCache = null;
export function brandAssets() {
  if (_assetCache) return _assetCache;
  const P = (...p) => join(BRAND_KIT_DIR, ...p);
  const files = {
    mark_primary: P("01-logo", "mark-primary.svg"),
    mark_reverse: P("01-logo", "mark-reverse.svg"),
    mark_mono_navy: P("01-logo", "mark-mono-navy.svg"),
    mark_mono_white: P("01-logo", "mark-mono-white.svg"),
    lockup_horizontal_primary: P("01-logo", "lockup-horizontal-primary.svg"),
    lockup_horizontal_reverse: P("01-logo", "lockup-horizontal-reverse.svg"),
    app_icon: P("02-app-icon-favicon", "app-icon-1024.png"),
    app_icon_square: P("02-app-icon-favicon", "app-icon-square-1024.png"),
    apple_touch_icon: P("02-app-icon-favicon", "apple-touch-icon-180.png"),
    android_chrome_192: P("02-app-icon-favicon", "android-chrome-192.png"),
    favicon_ico: P("02-app-icon-favicon", "favicon.ico"),
    favicon_16: P("02-app-icon-favicon", "favicon-16.png"),
    favicon_32: P("02-app-icon-favicon", "favicon-32.png"),
    favicon_512: P("02-app-icon-favicon", "favicon-512.png"),
    og_share_image: P("03-social-media", "og-share-image-1200x630.png"),
  };
  _assetCache = { kit: BRAND_KIT_DIR, files, present: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, fs.existsSync(v)])) };
  return _assetCache;
}

/* ------------------------------------------------------------------ callout semantics */
/** Meaning → colour token (authority: "callouts carry meaning by colour"). */
export function calloutSemantics() {
  const vl = authority();
  const c = vl.callout_semantics || {};
  if (!c.red || !c.amber || !c.blue || !c.green || !c.blush) throw new Error("design authority: callout semantics incomplete");
  return {
    red: { token: "error", hex: hex("error"), meaning: c.red },
    amber: { token: "warning", hex: hex("warning"), meaning: c.amber },
    blue: { token: "info", hex: hex("info"), meaning: c.blue },
    green: { token: "success", hex: hex("success"), meaning: c.green },
    blush: { token: "blush", hex: hex("blush"), meaning: c.blush },
  };
}
/** Resolve a callout colour from MEANING (never a product id). */
export function calloutFor(meaning) {
  const s = calloutSemantics();
  const m = String(meaning || "").toLowerCase();
  if (/safety|non-negotiable|danger|critical/.test(m)) return { ...s.red, kind: "red" };
  if (/warn|caution/.test(m)) return { ...s.amber, kind: "amber" };
  if (/info|context|note/.test(m)) return { ...s.blue, kind: "blue" };
  if (/resol|success|done|win/.test(m)) return { ...s.green, kind: "green" };
  if (/human|emotion|empathy|feel/.test(m)) return { ...s.blush, kind: "blush" };
  throw new Error(`design authority: no callout semantics for meaning "${meaning}"`);
}

/* ------------------------------------------------------------------ intensity mapping */
export function intensityMapping() {
  const vl = authority();
  const im = vl.intensity_mapping;
  if (!im || !im.high || !im.medium || !im.low || !im.conversion) throw new Error("design authority: intensity mapping incomplete");
  return {
    high: { background: "navy", tokens: ["navy", "white", "gold"], treatment: im.high.treatment },
    medium: { background: "warm", tokens: ["warm", "white", "navy"], treatment: im.medium.treatment },
    low: { background: "soft", tokens: ["soft", "white", "purple"], treatment: im.low.treatment },
    conversion: { background: "navy", tokens: ["navy", "gold", "white"], treatment: im.conversion.treatment },
    angle_types: { fear: "high", frustration: "high", trigger: "high", problem: "medium", situation: "medium", "failed attempt": "medium", objection: "medium", education: "low", myth: "low", mechanism: "low", story: "low", transformation: "conversion", "desired outcome": "conversion", product: "conversion" },
  };
}
/** Resolve intensity from an angle type (data-driven; never a product branch). */
export function intensityForAngleType(angleType) {
  const im = intensityMapping();
  const t = String(angleType || "").toLowerCase();
  if (im.angle_types[t]) return im.angle_types[t];
  for (const [key, val] of Object.entries(im.angle_types)) if (t.includes(key)) return val;
  return "medium";
}

/* ------------------------------------------------------------------ marketing component library (6) */
export function componentLibrary() {
  const vl = authority();
  const lib = vl.marketing_component_library;
  if (!Array.isArray(lib) || lib.length !== 6) throw new Error(`design authority: expected the 6-component marketing library, found ${Array.isArray(lib) ? lib.length : 0}`);
  if (!lib.some((c) => c.component === "OG Share Image")) throw new Error("design authority: OG Share Image must be part of the component library");
  return lib;
}

/* ------------------------------------------------------------------ platform constraints */
export function platformConstraints() {
  const vl = authority();
  const p = vl.platform_constraints;
  if (!p || !p.instagram_feed_square || !p.vertical_reels_tiktok) throw new Error("design authority: platform constraints incomplete");
  return p;
}
/** Safe zone in px for a canvas — AUTHORITY-EXACT (no invented insets):
 *  vertical (Reels/TikTok/Status 1080x1920): top 250 + bottom 350 occluded;
 *  Instagram feed square: keep text out of the bottom 12%;
 *  wide (FB link / OG 1200x630): no occlusion stated. */
export function safeZone(canvas = "1080x1080") {
  const [w, h] = String(canvas).split("x").map(Number);
  if (h > w * 1.25) return { top: 250, bottom: 350, left: 0, right: 0 };
  if (Math.abs(h - w) <= 2) return { top: 0, bottom: Math.round(h * 0.12), left: 0, right: 0 };
  return { top: 0, bottom: 0, left: 0, right: 0 };
}
/** Applicable minimum text size in px for a canvas width (authority: 60px @ 1080). */
export function minTextPx(canvasWidth = 1080) { return Math.round((60 / 1080) * canvasWidth); }
export function contrastMin() { return 4.5; }

/* ------------------------------------------------------------------ grounding element rule */
/** The Grounding Element Rule (distinct from Visual Grounding). */
export function groundingElement() {
  const vl = authority();
  const g = vl.grounding_element;
  if (!g || !Array.isArray(g.forms) || g.forms.length === 0) throw new Error("design authority: Grounding Element Rule missing");
  return g;
}
/**
 * Machine-checkable grounding test. A grounding element must be a specific factual detail rendered
 * as a visible design piece (one of the authority forms) with real content — never fabricated here.
 */
export function isGroundingElement(obj) {
  if (!obj || typeof obj !== "object") return false;
  const forms = groundingElement().forms.map((f) => f.toLowerCase());
  const kind = String(obj.form || obj.kind || "").toLowerCase();
  const text = String(obj.text || obj.value || "").trim();
  const known = forms.some((f) => kind.includes(f.split("/")[0].trim()) || f.includes(kind));
  return known && text.length > 0;
}

/* ------------------------------------------------------------------ prohibited treatments */
export function prohibitedTreatments() {
  const vl = authority();
  if (!Array.isArray(vl.prohibited_brand_treatments) || vl.prohibited_brand_treatments.length === 0) throw new Error("design authority: prohibited treatments missing");
  return vl.prohibited_brand_treatments;
}
export function iconography() {
  const vl = authority();
  const i = vl.iconography;
  if (!i || i.style !== "stroke-only") throw new Error("design authority: iconography rule (stroke-only) missing");
  return i;
}
export function visualModes() {
  const vl = authority();
  const m = vl.marketing_visual_modes;
  if (!m || !m.typographic || !m.photo_anchored) throw new Error("design authority: two marketing visual modes missing");
  return m;
}

/* ------------------------------------------------------------------ integrity gate */
/** Throws if any required locked rule family cannot be resolved (Task §35). */
export function assertAuthorityIntegrity() {
  colourTokens();
  typeRoles();
  markSvg("primary");
  markSvg("reverse");
  markRules();
  calloutSemantics();
  intensityMapping();
  componentLibrary();
  platformConstraints();
  groundingElement();
  prohibitedTreatments();
  iconography();
  visualModes();
  const fs2 = fontFiles();
  const missing = Object.entries(fs2).map(([k, f]) => [k, join(FONT_DIR, f)]).filter(([, p]) => !fs.existsSync(p));
  if (missing.length) throw new Error(`design authority: canonical font files missing: ${missing.map(([k]) => k).join(", ")}`);
  return { ok: true };
}
