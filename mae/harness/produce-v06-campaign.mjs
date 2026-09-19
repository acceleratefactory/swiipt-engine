// V06 COMPLETE MARKETING CAMPAIGN PRODUCTION DRIVER — production use of approved MAE contracts.
//
// SOURCE RULE (binding): visuals render the paired DES copy_blocks verbatim (layout-fitted approved
// visual copy with max_chars); post packages carry the asset record's own hook/problem/script/slides/
// sequence verbatim (approved post copy). Both sources stay byte-identical. Nothing is invented.
// Statuses: RENDERED (deterministic output via qualified path) / PRODUCTION_PACKAGE_READY (complete
// manual package, no provider output) / BLOCKED (with explicit reason, never silent).
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { validateSocialDesignSpec } from "../services/social-design-spec.js";
import { socialTokens } from "../services/social-design-tokens.js";
import { composeSocialStatic } from "../media/social-compositor.js";
import { assembleMultiPanel } from "../media/social-carousel.js";
import {
  OUT, ROOT, ASSETS, PURPOSE_MAP, PATTERN_MAP, COPY_ROLE_MAP, FAMILY_PROFILE, FAMILY_VGB,
  FORMAT_MAP, STYLE_ROLE, STORY_ROLE, baseSpec, normSpec, desCopyBlocks, ctaOf,
  rasterSvg, pngDims, copyExactInSvg, noPlaceholders,
} from "./campaign-lib.mjs";

export const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
export const loadJson = (rel) => readJson(join(ROOT, rel));
export const ensureDir = (p) => mkdirSync(p, { recursive: true });
export const writeJson = (p, o) => { ensureDir(dirname(p)); writeFileSync(p, JSON.stringify(o, null, 2) + "\n", "utf8"); };
export const writeText = (p, s) => { ensureDir(dirname(p)); writeFileSync(p, s, "utf8"); };

export const DES_FOR_ASSET = {
  "AST-NS-001": "DES-NS-001", "AST-NS-002": "DES-NS-001", "AST-NS-003": "DES-NS-001",
  "AST-NS-004": "DES-NS-002", "AST-NS-005": "DES-NS-003", "AST-NS-006": "DES-NS-004",
  "AST-NS-007": null, "AST-NS-008": "DES-NS-005", "AST-NS-009": "DES-NS-006",
  "AST-NS-010": "DES-NS-007", "AST-NS-011": "DES-NS-008", "AST-NS-012": "DES-NS-009",
  "AST-NS-013": "DES-NS-010", "AST-NS-014": "DES-NS-011", "AST-NS-015": "DES-NS-011",
  "AST-NS-016": "DES-NS-011", "AST-NS-STOP-001": "DES-NS-001", "AST-NS-PROB-001": "DES-NS-003",
  "AST-NS-MYTH-001": "DES-NS-003", "AST-NS-STORY-001": "DES-NS-007", "AST-NS-OBJ-001": "DES-NS-011",
};

const asset = (id) => loadJson(`mae/data/assets/${id}.json`);
const desOf = (id) => loadJson(`mae/data/design-specs/${DES_FOR_ASSET[id]}.json`);
const briefOf = (a) => loadJson(`mae/data/briefs/${a.asset_brief_id}.json`);
const angleOf = (a) => loadJson(`mae/data/marketing-angles/${a.angle_id}.json`);
const vgbOf = (a) => loadJson(`mae/data/visual-groundings/${FAMILY_VGB[a.family_id]}.json`);

let TOKENS = null;const tokens = () => (TOKENS = TOKENS || socialTokens());
const ledger = [];
const record = (r) => { ledger.push(r); return r; };
export const ledgerOf = () => ledger.slice();

// ---- legacy DES -> S-A normalization (records untouched; all mappings documented) ----
function normTypo(des) {
  const t = des.typography_roles;
  if (Array.isArray(t)) {
    return t.map((r) => ({ role: r.role, scale: r.scale, weight: r.weight, line_height: r.line_height, alignment: (r.alignment || "LEFT").toUpperCase(), max_width: r.max_width }));
  }
  const out = [];
  const rm = { primary_headline: "headline", body_text: "supporting_line", call_to_action: "cta" };
  for (const [k, v] of Object.entries(t || {})) {
    out.push({ role: rm[k] || "supporting_line", scale: v.font_size_px, weight: Number(v.font_weight), line_height: v.line_height, alignment: "LEFT", max_width: 800 });
  }
  return out;
}

// normSpec lives in ./campaign-lib.mjs (single canonical normalizer; imported above).

// ---- per-asset static production -----------------------------------------------
export function produceStatic(assetId, opts = {}) {
  const a = asset(assetId);
  const des = desOf(assetId);
  const dir = join(OUT, opts.dir || `${a.platform === "facebook" ? "Facebook" : a.platform === "whatsapp" ? "WhatsApp" : "Instagram"}/${assetId}`);
  const fail = (reason) => record({ asset: assetId, status: "BLOCKED", reason });
  try {
    const platform = a.platform === "whatsapp" ? "whatsapp" : des.platform;
    const spec = normSpec(des, a, { platform: a.platform === "whatsapp" ? "whatsapp" : undefined });
    if (a.platform === "whatsapp") { spec.placement = "feed"; }
    const v = validateSocialDesignSpec(spec);
    if (!v.valid) return fail("INVALID_SPEC: " + v.errors.slice(0, 3).join(" | "));
    const r = composeSocialStatic(spec, tokens());
    const svgPath = join(dir, `${assetId}.svg`);
    ensureDir(dir);
    if (r.svg) writeFileSync(svgPath, r.svg, "utf8");
    const texts = spec.copy_blocks.filter((c) => c.role !== "cta").map((c) => c.text);
    const missing = r.svg ? copyExactInSvg(r.visible_text || "", texts) : texts.map((t) => String(t).slice(0, 60));
    const ph = r.svg ? noPlaceholders(r.svg) : ["no-svg"];
    const ctaText = spec.copy_blocks.find((c) => c.role === "cta")?.text || null;
    const ctaVisible = !ctaText || (r.visible_text || "").includes(ctaText);
    const warnings = [];
    if (ctaText && !ctaVisible) warnings.push("CTA ships in copy package; picked approved variant places no CTA component");
    if (r.status !== "READY") {
      // Honest terminal state: the qualified path cannot fit approved copy in the approved
      // layout. Complete manual package is produced; nothing is hidden or faked.
      return record({
        asset: assetId, status: "PRODUCTION_PACKAGE_READY",
        reason: `compositor reported ${r.status}; manual finalization required. ` + JSON.stringify(r.warnings || []).slice(0, 200),
        svg: r.svg ? svgPath : null, png: null, dims: { width: spec.canvas.width, height: spec.canvas.height },
        variant: r.layout_plan?.layout_variant || null, warnings,
        manual_package: manualPackage(a, des, spec, r),
      });
    }
    const pngPath = join(dir, `${assetId}.png`);
    const dims = rasterSvg(r.svg, spec.canvas.width, spec.canvas.height, pngPath);
    const dimOk = dims.width === spec.canvas.width && dims.height === spec.canvas.height;
    if (!dimOk || missing.length || ph.length) {
      return record({ asset: assetId, status: "PRODUCTION_PACKAGE_READY", svg: svgPath, png: null,
        reason: JSON.stringify({ dimOk, missing, ph }).slice(0, 300), warnings,
        manual_package: manualPackage(a, des, spec, r) });
    }
    return record({
      asset: assetId, status: "RENDERED", reason: warnings.length ? warnings.join(" | ") : null,
      svg: svgPath, png: pngPath, dims, variant: r.layout_plan?.layout_variant || null,
      visible_chars: (r.visible_text || "").length, warnings,
    });
  } catch (e) {
    return record({ asset: assetId, status: "BLOCKED", reason: "EXCEPTION: " + String(e.message || e).slice(0, 200) });
  }
}

// Complete manual production package for assets the qualified path cannot finalize.
// Everything a designer needs to finish by hand; zero invented content.
function manualPackage(a, des, spec, r) {
  return {
    spec_id: des.design_id, canvas: spec.canvas, layout_family: spec.layout_family,
    variant_attempted: r.layout_plan?.layout_variant || null,
    compositor_status: r.status, compositor_warnings: r.warnings || [],
    copy_blocks: spec.copy_blocks, typography_roles: spec.typography_roles,
    safe_zones: spec.safe_zones, background: spec.background_policy,
    cta: ctaOf(des), layout_plan_id: r.layout_plan?.layout_plan_id || null,
    note: "Finalize manually (adjust layout/leading within brand rules) or await design-system fix for navy-surface text contrast. Do not alter approved copy.",
  };
}

// ---- multi-panel (carousel / story) production ------------------------------------
const SLIDE_SEQ_ROLE = { hook: "IDENTIFY", spiral: "DEEPEN", repeat: "DEEPEN", reality: "DEEPEN", roster: "EXPLAIN", support: "HELP", outcome: "RESOLVE", shift: "RESOLVE", mechanism: "EXPLAIN", desired: "RESOLVE", problem: "DEEPEN", cta: "ACT" };
function seqRoleFor(key, idx, total) {
  if (idx === 0) return "COVER";
  if (idx === total - 1) return "ACT";
  const k = String(key || "").toLowerCase();
  for (const [sub, role] of Object.entries(SLIDE_SEQ_ROLE)) if (k.includes(sub)) return role;
  return "DEEPEN";
}

function desSlides(des) {
  const cb = des.copy_blocks || {};
  const groups = new Map();
  for (const [k, v] of Object.entries(cb)) {
    if (v.slide == null) continue;
    if (!groups.has(v.slide)) groups.set(v.slide, []);
    groups.get(v.slide).push({ key: k, role: v.role, text: v.text });
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([n, items]) => ({ n, items }));
}

export function produceMultiPanel(assetId, opts = {}) {
  const a = asset(assetId);
  const des = desOf(assetId);
  const isStory = a.asset_type === "SOCIAL_STORY_SEQUENCE";
  const dir = join(OUT, opts.dir || `Instagram/${assetId}`);
  const fail = (reason) => record({ asset: assetId, status: "BLOCKED", reason });
  try {
    const groups = desSlides(des);
    if (!groups.length) return fail("no slide/frame groups in paired DES " + (DES_FOR_ASSET[assetId] || "(none)"));
    const total = groups.length;
    const slides = groups.map(({ n, items }, idx) => ({
      slide_index: idx + 1,
      sequence_role: seqRoleFor(items[0]?.key, idx, total),
      asset_purpose: "EDUCATION",
      content_pattern: "STATEMENT",
      layout_family: "TYPE_DOMINANT",
      density: "STANDARD",
      copy_blocks: items.map((it) => ({ role: COPY_ROLE_MAP[it.role] || "supporting_line", text: it.text })),
    }));
    const spec = normSpec(des, a, { asset_type: a.asset_type, layout_family: "TYPE_DOMINANT" });
    spec.asset_purpose = "EDUCATION"; spec.content_pattern = "STATEMENT";
    // The assembler sets cta_policy per panel (required only where that panel carries cta copy),
    // so the container spec must not demand a top-level cta block.
    spec.cta_policy = { required: false, copy_role: null, placement: null, prominence: "NONE" };
    spec.slide_count = total; spec.continuity_group = `${assetId}-seq`;
    spec.slides = slides;
    spec.copy_blocks = slides[0].copy_blocks;
    spec.platform_format = isStory ? "STORY_VERTICAL" : "CAROUSEL_SLIDE";
    spec.placement = isStory ? "story" : "carousel";
    spec.canvas = isStory ? { width: 1080, height: 1920, aspect_ratio: "9:16" } : { width: 1080, height: 1080, aspect_ratio: "1:1" };
    const v = validateSocialDesignSpec(spec);
    if (!v.valid) return fail("INVALID_SPEC: " + v.errors.slice(0, 3).join(" | "));
    const r = assembleMultiPanel(spec, tokens());
    ensureDir(dir);
    const panels = r.panels || [];
    const bad = panels.filter((p) => p.status !== "READY");
    const files = [];
    for (const p of panels) {
      if (!p.svg) continue;
      const sp = join(dir, `slide-${String(p.slide_index).padStart(2, "0")}.svg`);
      writeFileSync(sp, p.svg, "utf8");
      const pp = join(dir, `slide-${String(p.slide_index).padStart(2, "0")}.png`);
      const dims = rasterSvg(p.svg, spec.canvas.width, spec.canvas.height, pp);
      files.push({ slide: p.slide_index, role: p.sequence_role, svg: sp, png: pp, dims, status: p.status });
    }
    const ok = bad.length === 0 && files.length === total && files.every((f) => f.dims.width === spec.canvas.width && f.dims.height === spec.canvas.height);
    return record({
      asset: assetId, status: ok ? "RENDERED" : "PRODUCTION_PACKAGE_READY",
      reason: ok ? null : `panel issues: bad=[${bad.map((p) => p.slide_index + ":" + p.status).join(",")}] files=${files.length}/${total} dims=${files.map((f) => f.dims.width + "x" + f.dims.height).join("|")} want=${spec.canvas.width}x${spec.canvas.height}`,
      files, panel_count: total, slide_roles: panels.map((p) => p.sequence_role),
      manual_package: ok ? null : { spec_id: des.design_id, canvas: spec.canvas, slides: slides.map((s) => ({ n: s.slide_index, role: s.sequence_role, copy: s.copy_blocks })) },
    });
  } catch (e) {
    if (process.env.SWIIPT_DEBUG) console.error("MULTI STACK:", (e.stack || String(e)).split("\n").slice(0, 8).join("\n"));
    return record({ asset: assetId, status: "BLOCKED", reason: "EXCEPTION: " + String(e.message || e).slice(0, 200) });
  }
}

// ---- CLI ----------------------------------------------------------------------
const invoked = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invoked) {
  const args = process.argv.slice(2);
  const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
  const statics = ASSETS.filter((id) => {
    const a = asset(id);
    return (a.asset_type === "SOCIAL_STATIC" || (a.asset_type === "GENERIC" && a.platform === "whatsapp")) && (!only || id === only);
  });
  console.log("STATIC JOBS:", statics.join(","));
  for (const id of statics) {
    const r = produceStatic(id);
    console.log(id, "->", r.status, r.reason || `${r.dims?.width}x${r.dims?.height} ${r.variant || ""}`);
  }
  const multis = ASSETS.filter((id) => {
    const a = asset(id);
    return (a.asset_type === "SOCIAL_CAROUSEL" || a.asset_type === "SOCIAL_STORY_SEQUENCE") && (!only || id === only);
  });
  if (multis.length) console.log("MULTI JOBS:", multis.join(","));
  for (const id of multis) {
    const r = produceMultiPanel(id);
    console.log(id, "->", r.status, r.reason || `${r.panel_count} panels`);
  }
  writeJson(join(OUT, "_ledger.json"), ledger);
  const rend = ledger.filter((r) => r.status === "RENDERED").length;
  const pp = ledger.filter((r) => r.status === "PRODUCTION_PACKAGE_READY").length;
  console.log(`ledger: ${rend} RENDERED, ${pp} PRODUCTION_PACKAGE_READY, ${ledger.length - rend - pp} BLOCKED of ${ledger.length}`);
}
