// V06 COMPLETE MARKETING CAMPAIGN PRODUCTION DRIVER — production use of approved MAE contracts.
//
// Drives (never modifies): SocialDesignSpec validation, deterministic compositor/carousel assembly,
// platform profiles, brand tokens, video prompt compiler, campaign/sequence records.
// SOURCE RULE (documented): visuals render the paired DES copy_blocks verbatim (layout-fitted approved
// visual copy); post packages carry the asset record's own hook/problem/script/slides/sequence verbatim
// (approved post copy). Both sources stay byte-identical. Nothing is invented.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { validateSocialDesignSpec } from "../services/social-design-spec.js";
import { socialTokens } from "../services/social-design-tokens.js";
import { composeSocialStatic } from "../media/social-compositor.js";
import { assembleMultiPanel } from "../media/social-carousel.js";
import { compileVideoPromptPackage, canonicalVideoRequest } from "../media/video-prompt-compiler.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const OUT = join(ROOT, "V06-Marketing-Assets");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const loadJson = (rel) => readJson(join(ROOT, rel));
const ensureDir = (p) => mkdirSync(p, { recursive: true });
const writeJson = (p, o) => { ensureDir(dirname(p)); writeFileSync(p, JSON.stringify(o, null, 2) + "\n", "utf8"); };
const writeText = (p, s) => { ensureDir(dirname(p)); writeFileSync(p, s, "utf8"); };

const ASSETS = [...Array.from({ length: 16 }, (_, i) => "AST-NS-" + String(i + 1).padStart(3, "0")),
  "AST-NS-STOP-001", "AST-NS-PROB-001", "AST-NS-MYTH-001", "AST-NS-STORY-001", "AST-NS-OBJ-001"];

// DES selection: primary key = asset_brief_id match; fallback documented per asset below.
const DES_FOR_ASSET = {
  "AST-NS-001": "DES-NS-001", "AST-NS-002": "DES-NS-001", "AST-NS-003": "DES-NS-001",
  "AST-NS-004": "DES-NS-002", "AST-NS-005": "DES-NS-003", "AST-NS-006": "DES-NS-004",
  "AST-NS-007": null, "AST-NS-008": "DES-NS-005", "AST-NS-009": "DES-NS-006",
  "AST-NS-010": "DES-NS-007", "AST-NS-011": "DES-NS-008", "AST-NS-012": "DES-NS-009",
  "AST-NS-013": "DES-NS-010", "AST-NS-014": "DES-NS-011", "AST-NS-015": "DES-NS-011",
  "AST-NS-016": "DES-NS-011", "AST-NS-STOP-001": "DES-NS-001", "AST-NS-PROB-001": "DES-NS-003",
  "AST-NS-MYTH-001": "DES-NS-003", "AST-NS-STORY-001": "DES-NS-007", "AST-NS-OBJ-001": "DES-NS-011",
};
const PURPOSE_MAP = { stop_scroll_identification: "IDENTIFICATION", problem: "EDUCATION", myth_reframe: "CLARIFICATION", story: "EDUCATION", objection: "DECISION_SUPPORT", identification: "IDENTIFICATION" };
const PATTERN_MAP = { statement: "STATEMENT", reframe: "MYTH_REALITY", question: "QUESTION", quote: "QUOTE", checklist: "CHECKLIST", steps: "STEPS", comparison: "COMPARISON", proof: "PROOF" };
const COPY_ROLE_MAP = { primary_headline: "headline", body_text: "supporting_line", call_to_action: "cta", secondary_headline: "subheadline" };
const FAMILY_PROFILE = { "FAM-NS-001": "Situation-led social post", "FAM-NS-002": "Problem-led social post", "FAM-NS-003": "Myth-busting post", "FAM-NS-004": "Story/emotional post", "FAM-NS-005": "Objection-led social post" };
const FAMILY_VGB = { "FAM-NS-001": "VG-NS-STOP-001", "FAM-NS-002": "VG-NS-PROB-001", "FAM-NS-003": "VG-NS-MYTH-001", "FAM-NS-004": "VG-NS-STORY-001", "FAM-NS-005": "VG-NS-OBJ-001" };
const FORMAT_MAP = { "1080x1080": "FEED_SQUARE", "1080x1920": "STORY_VERTICAL" };
const STYLE_ROLE = { hook: "IDENTIFY", problem: "DEEPEN", mechanism: "EXPLAIN", desired: "RESOLVE", cta: "ACT" };
const STORY_ROLE = { hook: "IDENTIFY", problem: "DEEPEN", insight: "TEACH", cta: "ACT" };

let TOKENS = null;
const tokens = () => (TOKENS = TOKENS || socialTokens());
const results = [];
const record = (r) => { results.push(r); return r; };

// ---- spec builders -----------------------------------------------------------
function baseSpec(des, asset, overrides = {}) {
  const spec = JSON.parse(JSON.stringify(des));
  delete spec.slides;
  spec.asset_type = overrides.asset_type || "SOCIAL_STATIC";
  spec.platform = overrides.platform || des.platform;
  spec.placement = des.placement || "feed";
  const dims = (des.canvas?.width || 1080) + "x" + (des.canvas?.height || 1080);
  spec.platform_format = overrides.platform_format || FORMAT_MAP[dims] || "FEED_SQUARE";
  spec.canvas = { width: des.canvas?.width || 1080, height: des.canvas?.height || 1080, aspect_ratio: dims === "1080x1920" ? "9:16" : "1:1" };
  spec.asset_purpose = PURPOSE_MAP[des.asset_purpose] || "EDUCATION";
  spec.content_pattern = PATTERN_MAP[des.content_pattern] || "STATEMENT";
  spec.layout_family = overrides.layout_family || "TYPE_DOMINANT";
  spec.export_format = ["svg", "png"];
  spec.production_mode = "DETERMINISTIC_TYPE_ONLY";
  spec.source_classification = {
    source_grounded: ["asset copy (verbatim from " + asset.id + ")", "angle " + (asset.angle_id || "")],
    production_instruction: ["layout family: " + spec.layout_family, "platform format: " + spec.platform_format, "production mode: DETERMINISTIC_TYPE_ONLY"],
  };
  spec.prohibited_elements = [];
  spec.required_elements = [];
  spec.visual_slots = [];
  spec.provenance = {
    angle_id: asset.angle_id, asset_brief_id: asset.asset_brief_id,
    truth_refs: ["TR-PPL-NIGHT-SHIFT-001", "BRAND-001"], copy_refs: [asset.id + "#content"],
    evidence_refs: [], source_media_refs: [], brand_tokens_version: "BRAND-001",
  };
  spec.truth_requirements = { weighting_profile: FAMILY_PROFILE[asset.family_id] || "Situation-led social post", truth_refs: ["TRUTH-PRODUCT", "TRUTH-CUSTOMER"] };
  return spec;
}

function desCopyBlocks(des) {
  const cb = des.copy_blocks || {};
  const arr = Array.isArray(cb) ? cb.map((c) => ({ role: c.role, text: c.text })) : Object.entries(cb).map(([k, v]) => ({ role: v.role, text: v.text, _key: k }));
  return arr.map((c) => ({ role: COPY_ROLE_MAP[c.role] || c.role, text: c.text }));
}

function ctaOf(des) {
  const cb = des.copy_blocks || {};
  if (Array.isArray(cb)) { const c = cb.find((x) => x.role === "cta" || x.role === "call_to_action"); return c ? c.text : null; }
  return cb.cta ? cb.cta.text : null;
}

// ---- raster + verify ----------------------------------------------------------
const FONTS = join(ROOT, "specs/V06/pdf design fix/swiipt-ebook-design-skill/swiipt-ebook-design/reference/fonts").replace(/\\/g, "/");
const FONT_FACE = `
@font-face{font-family:'Inter';font-weight:400;src:url('file:///${FONTS}/Inter-Regular.ttf');}
@font-face{font-family:'Inter';font-weight:600;src:url('file:///${FONTS}/Inter-SemiBold.ttf');}
@font-face{font-family:'Inter';font-weight:700;src:url('file:///FONTSX');}
@font-face{font-family:'DM Serif Display';font-weight:400;src:url('file:///${FONTS}/DMSerifDisplay-Regular.ttf');}`.replace("file:///FONTSX", `file:///${FONTS}/Inter-Bold.ttf`);

// Full legacy-DES -> S-A normalization (records untouched; mappings documented in driver).
export function normSpec(des, asset, overrides = {}) {
  const spec = baseSpec(des, asset, overrides);
  spec.design_version = String(des.design_version || "1.0");
  spec.alignment = typeof des.alignment === "string" ? des.alignment.toUpperCase() : "LEFT";
  const dens = String(des.density || "standard").toLowerCase();
  spec.density = { low: "SPARSE", standard: "STANDARD", high: "DENSE", sparse: "SPARSE", dense: "DENSE" }[dens] || "STANDARD";
  spec.spacing = { class: "STANDARD" };
  spec.accessibility = { min_type_size: 18, contrast_floor: 4.5, alt_text: "Swiipt marketing visual for " + asset.id };
  spec.cta_policy = { required: !!(des.cta_policy || {}).required || !!ctaOf(des), copy_role: "cta", placement: "bottom-left", prominence: "secondary" };
  spec.background_policy = { kind: "solid", color: (des.background_policy || {}).color || "#0B1F33" };
  const lp = des.logo_policy || {};
  spec.logo_policy = { variant: "primary", placement: String(lp.position || "bottom_right").toUpperCase(), clear_space: lp.clearance_px || 40, min_size: 32, required: false };
  const t = des.typography_roles;
  if (Array.isArray(t)) {
    spec.typography_roles = t.map((r) => ({ role: r.role, scale: r.scale, weight: r.weight, line_height: r.line_height, alignment: String(r.alignment || "LEFT").toUpperCase(), max_width: r.max_width }));
  } else {
    const rm = { primary_headline: "headline", body_text: "supporting_line", call_to_action: "cta", secondary_headline: "subheadline" };
    spec.typography_roles = Object.entries(t || {}).map(([k, v]) => ({ role: rm[k] || "supporting_line", scale: v.font_size_px, weight: Number(v.font_weight), line_height: v.line_height, alignment: "LEFT", max_width: 800 }));
  }
  spec.copy_blocks = desCopyBlocks(des);
  return spec;
}

export function rasterSvg(svg, w, h, outPng) {
  const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${FONT_FACE}html,body{margin:0;padding:0;background:#fff}svg{display:block}</style></head><body>${svg}</body></html>`;
  const htmlPath = outPng.replace(/\.png$/, ".shot.html");
  writeText(htmlPath, doc);
  execFileSync(EDGE, ["--headless", "--disable-gpu", `--screenshot=${outPng}`, `--window-size=${w},${h}`, htmlPath], { timeout: 120000 });
  return pngDims(outPng);
}

export function pngDims(p) {
  const b = readFileSync(p);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG: " + p);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), bytes: b.length };
}

export function copyExactInSvg(svg, texts) {
  return texts.filter((t) => t && !svg.includes(t)).map((t) => String(t).slice(0, 60));
}
export function noPlaceholders(s) {
  return ["TODO", "lorem ipsum", "{{", "undefined", "NaN", "[object "].filter((k) => k === "{{" ? /\{\{[^}]+\}\}/.test(s) : s.includes(k));
}

export { OUT, ROOT, ASSETS, PURPOSE_MAP, PATTERN_MAP, COPY_ROLE_MAP, FAMILY_PROFILE, FAMILY_VGB, FORMAT_MAP, STYLE_ROLE, STORY_ROLE, baseSpec, desCopyBlocks, ctaOf };
