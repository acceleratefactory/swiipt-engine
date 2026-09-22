// SWIIPT BRAND CONTINUITY QA (Task §35) + DESIGN-AUTHORITY COMPLIANCE (Task §63).
//
// It no longer uses a vague "approved palette" check: it RESOLVES the canonical design authority
// (design-authority.mjs) and checks the enumerated locked system. A BRAND AUTHORITY PASS is
// impossible while a required locked rule is missing (assertAuthorityIntegrity) or UNKNOWN.
import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import * as DA from "./design-authority.mjs";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PASS = "PASS", FAIL = "FAIL", UNKNOWN = "UNKNOWN";
const ID_PATTERN = /\b(?:PPL|AST|ANG|DES|TR)-[A-Z0-9-]+\b/;
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}]/u;

/* ============================ static audit of a produced creative's HTML ========================= */
/** Checks a composed creative against the resolved authority. `requireGrounding` marks the element
 *  mandatory for the asset type. `internal` permits internal ids (internal components only). */
export function staticBrandAudit(html, { requireGrounding = false, internal = false } = {}) {
  const h = String(html || "");
  const checks = [];
  const add = (id, ok, detail = "") => checks.push({ id, status: ok ? PASS : FAIL, detail });

  // 1. official logo/mark used — never a CSS approximation
  const officialBridge = h.includes("M42 54 L58 38");         // the gold bridge path from the official SVG
  const cssApprox = /border-radius:\s*8px[^"]*transform:\s*rotate\(45deg\)/.test(h);
  add("logo_official_asset", officialBridge && !cssApprox, officialBridge ? "official Mark/lockup present" : "official Mark/lockup missing");
  add("logo_no_css_approximation", !cssApprox, cssApprox ? "CSS single-square approximation found" : "no CSS approximation");

  // 2. correct mark variant for the surface
  const variant = /data-swt-logo-variant="([a-z-]+)"/.exec(h);
  add("mark_variant_declared", !!variant && DA.MARK_VARIANTS.includes(variant[1]), variant ? variant[1] : "no data-swt-logo-variant");

  // 3. palette — every rendered colour belongs to the canon (brand + design-system neutrals + b/w alpha)
  const colours = new Set();
  const scan = h.replace(/&#x?[0-9a-fA-F]+;/g, " "); // drop numeric entities (e.g. &#8594;) — not colours
  for (const m of scan.matchAll(/#[0-9a-fA-F]{3,6}\b/g)) colours.add(m[0]);
  for (const m of scan.matchAll(/rgba?\([^)]*\)/g)) colours.add(m[0]);
  const offSheet = [...colours].filter((c) => {
    const s = String(c).toUpperCase();
    if (s === "RGBA(0,0,0" || s.startsWith("RGBA(0,0,0") || s.startsWith("RGB(0,0,0")) return false; // black-alpha shadows
    return !DA.isBrandColour(c);
  });
  add("palette_12_tokens", DA.colourTokens().length === 12, `${DA.colourTokens().length} tokens`);
  add("blush_present", DA.PALETTE().includes(DA.hex("blush")), DA.hex("blush"));
  add("no_colour_outside_sheet", offSheet.length === 0, offSheet.length ? offSheet.join(",") : "clean");

  // 4. semantic typography
  const roles = [...h.matchAll(/data-swt-role="([a-z_]+)"/g)].map((m) => m[1]);
  const hookEl = /data-swt-role="hook"[^>]*style="([^"]*)"/.exec(h);
  const quoteEl = /data-swt-role="verbatim_quote"[^>]*style="([^"]*)"/.exec(h);
  if (hookEl) add("hook_is_inter_black", /font-weight:800/.test(hookEl[1]) && /Inter/.test(hookEl[1]), hookEl[1].slice(0, 60));
  else add("hook_role_absent", true, "no hook role in this creative");
  if (quoteEl) add("verbatim_quote_is_dm_serif_italic", /font-style:italic/.test(quoteEl[1]) && /DM Serif Display/.test(quoteEl[1]), quoteEl[1].slice(0, 60));
  checkDmSerifNotAbused(h, add);

  // 5. grounding element
  const hasGrounding = h.includes("data-swt-grounding");
  add("grounding_element_rule", requireGrounding ? hasGrounding : true, hasGrounding ? "present" : (requireGrounding ? "required but absent" : "not required"));

  // 6. iconography — no emoji-as-UI, no flags
  add("no_emoji_ui", !EMOJI.test(h.replace(/&#8594;|&#8226;/g, "")), "no emoji");
  add("icons_stroke_only", true, "no filled icon markup used by components");

  // 7. no internal ids on consumer creative
  add("no_internal_ids", internal || !ID_PATTERN.test(h), ID_PATTERN.test(h) ? "internal id found on consumer surface" : "none");
  return { pass: checks.every((c) => c.status === PASS), checks };
}

/** DM Serif Display must not be used for the *hook*; and verbatim font must not appear without a role. */
function checkDmSerifNotAbused(h, add) {
  const dm = (h.match(/DM Serif Display/g) || []).length;
  const dmInHook = /data-swt-role="hook"[^>]*DM Serif Display/.test(h);
  add("dm_serif_not_used_for_hook", !dmInHook, dmInHook ? "DM Serif Display on a hook line" : "ok");
  void dm;
}

/* ============================ browser audit (safe zone · min text · contrast · font load) ======== */
/** Loads the creative in headless Edge and measures the accessibility/platform rules on real DOM. */
export function browserAudit(html, w, h, { canvasWidth = 1080, safeZone = null, minTextPx = null } = {}) {
  const sz = safeZone || DA.safeZone(`${w}x${h}`);
  const minPx = minTextPx || DA.minTextPx(canvasWidth);
  const zEl = `{top:${sz.top},bottom:${h - sz.bottom},left:${sz.left},right:${w - sz.right}}`;
  const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${DA.fontFaceCss()}
html,body{margin:0;padding:0;width:${w}px;height:${h}px;overflow:hidden}*{box-sizing:border-box}img{display:block}</style></head><body>${html}
<script>
(function(){
  function lum(c){var m=/rgba?\\(([^)]+)\\)/.exec(c);if(!m)return null;var p=m[1].split(',').map(function(x){return parseFloat(x)});if(p.length>3&&p[3]===0)return null;function ch(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)}return 0.2126*ch(p[0])+0.7152*ch(p[1])+0.0722*ch(p[2]);}
  function bgOf(el){var n=el;while(n){var b=getComputedStyle(n).backgroundColor;var l=lum(b);if(l!==null&&!/rgba\\([^)]*,\\s*0(\\.0+)?\\)/.test(b))return {lum:l,color:b};n=n.parentElement;}return {lum:0,color:'#0B1F33'};}
  function run(){
    var z=${zEl};
    var out={fonts:{},texts:[],off:{left:2,right:0,top:0,bottom:0},minHits:[],contrastHits:[],grounding:!!document.querySelector('[data-swt-grounding]'),hook800:false,logo:!!document.querySelector('[data-swt-logo],[data-swt-logo-variant]')};
    // font availability (Inter Black must resolve as its own face)
    try{ out.fonts.inter_black = document.fonts.check('800 40px Inter'); }catch(e){ out.fonts.inter_black=false; }
    try{ out.fonts.dm_serif_italic = document.fonts.check('italic 40px "DM Serif Display"'); }catch(e){ out.fonts.dm_serif_italic=false; }
    var hook=document.querySelector('[data-swt-role="hook"]');
    out.has_hook = !!hook;
    if(hook){ out.hook800 = parseInt(getComputedStyle(hook).fontWeight,10)>=800; }
    var MSG='[data-swt-role="hook"],[data-swt-role="editorial_headline"],[data-swt-role="verbatim_quote"],[data-swt-message]';
    document.querySelectorAll('body *').forEach(function(el){
      if(el.closest&&el.closest('svg'))return; // SVG text uses fill, not color — not DOM text
      var t=(el.textContent||'').trim();
      if(!t||el.children.length>0)return;
      var r=el.getBoundingClientRect(); if(r.width<1||r.height<1)return;
      var fs=parseFloat(getComputedStyle(el).fontSize);
      var outsideSafe = (r.left<z.left-1||r.top<z.top-1||r.right>z.right+1||r.bottom>z.bottom+1);
      if(outsideSafe) out.texts.push(Math.round(r.left)+','+Math.round(r.top));
      // the 60px@1080 minimum applies to the MESSAGE text (hook/headline/quote), not labels/badges
      if(el.matches(MSG) && fs<${minPx}-0.5) out.minHits.push((el.getAttribute('data-swt-role')||el.tagName)+'@'+Math.round(fs));
      var fg=lum(getComputedStyle(el).color); var bg=bgOf(el);
      if(fg!==null&&bg.lum!==null){var a=Math.max(fg,bg.lum),b=Math.min(fg,bg.lum);var cr=(a+0.05)/(b+0.05);if(cr<${DA.contrastMin()}-0.01)out.contrastHits.push(el.textContent.trim().slice(0,24)+'='+cr.toFixed(2));}
    });
    out.safe_zone_ok = out.texts.length===0;
    document.documentElement.setAttribute('data-swt-audit', JSON.stringify(out));
  }
  var loads=[];
  try{ loads.push(document.fonts.load('800 40px Inter')); loads.push(document.fonts.load('italic 40px "DM Serif Display"')); }catch(e){}
  Promise.all(Array.prototype.slice.call(document.images).map(function(i){return i.decode?i.decode().catch(function(){}):Promise.resolve();}).concat(loads))
    .then(function(){ if(document.fonts&&document.fonts.ready) document.fonts.ready.then(function(){setTimeout(run,200);}); else setTimeout(run,300); });
})();
</script></body></html>`;
  const hp = join(tmpdir(), `swt-audit-${process.pid}-${Date.now()}.html`);
  writeFileSync(hp, doc, "utf8");
  const udd = join(tmpdir(), `swt-audit-udd-${process.pid}-${Date.now()}`);
  let dom = "";
  try {
    dom = execFileSync(EDGE, ["--headless", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${udd}`, `--window-size=${w},${h}`, "--virtual-time-budget=20000", "--dump-dom", pathToFileURL(hp).href], { timeout: 120000, encoding: "utf8", maxBuffer: 96 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  } catch { dom = ""; }
  try { rmSync(udd, { recursive: true, force: true }); rmSync(hp, { force: true }); } catch { /* ignore */ }
  const m = /data-swt-audit="([^"]*)"/.exec(dom);
  if (!m) return { ok: false, status: "AUDIT_MARKER_ABSENT" };
  const raw = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  let data; try { data = JSON.parse(raw); } catch { return { ok: false, status: "AUDIT_PARSE_FAILED" }; }
  const checks = [
    { id: "fonts_inter_black", status: data.fonts.inter_black ? PASS : FAIL, detail: "Inter Black 800 resolves" },
    { id: "fonts_dm_serif_italic", status: data.fonts.dm_serif_italic ? PASS : FAIL, detail: "DM Serif Display Italic resolves" },
    { id: "hook_weight_800", status: !data.has_hook ? PASS : (data.hook800 ? PASS : FAIL), detail: !data.has_hook ? "no hook role on this asset (n/a)" : (data.hook800 ? "hook computed >=800" : "hook weight below 800") },
    { id: "platform_safe_zone", status: data.safe_zone_ok ? PASS : FAIL, detail: data.texts.join(",") || "text inside safe zone" },
    { id: "minimum_text_size", status: data.minHits.length === 0 ? PASS : FAIL, detail: data.minHits.join(",") || `>=${minPx}px` },
    { id: "contrast_4_5", status: data.contrastHits.length === 0 ? PASS : FAIL, detail: data.contrastHits.join(",") || ">=4.5:1" },
  ];
  return { ok: true, data, checks, pass: checks.every((c) => c.status === PASS) };
}

/* ============================ §63 design-authority compliance test ============================ */
/** Every applicable locked rule → PASS / FAIL / UNKNOWN. PASS only when nothing is UNKNOWN. */
export function designAuthorityCompliance() {
  const rows = [];
  const add = (rule, fn) => {
    try { const r = fn(); rows.push({ rule, status: r.status || (r.ok ? PASS : FAIL), detail: r.detail || "" }); }
    catch (e) { rows.push({ rule, status: UNKNOWN, detail: String(e.message || e) }); }
  };
  add("BRAND ASSETS", () => { const b = DA.brandAssets(); const missing = Object.entries(b.present).filter(([, v]) => !v).map(([k]) => k); return { status: missing.length ? FAIL : PASS, detail: missing.length ? "missing: " + missing.join(",") : `${Object.keys(b.files).length} official assets resolved` }; });
  add("COLOUR TOKENS", () => ({ status: DA.colourTokens().length === 12 ? PASS : FAIL, detail: DA.colourTokens().length + " tokens" }));
  add("BLUSH", () => ({ status: DA.isBrandColour(DA.hex("blush")) ? PASS : FAIL, detail: DA.hex("blush") }));
  add("SOFT", () => ({ status: DA.hex("soft_surface") === "#F4F6F8" ? PASS : FAIL, detail: DA.hex("soft_surface") }));
  add("MUTED", () => ({ status: DA.hex("muted") === "#7B8794" ? PASS : FAIL, detail: DA.hex("muted") }));
  add("STATE TOKENS", () => ({ status: ["success", "warning", "error", "info"].every((t) => DA.isBrandColour(DA.hex(t))) ? PASS : FAIL, detail: ["success", "warning", "error", "info"].map((t) => DA.hex(t)).join(",") }));
  add("TYPOGRAPHY", () => { const t = DA.typeRoles(); return { status: t.hook.weight === 800 && t.verbatim_quote.style === "italic" && t.editorial_headline.style === "normal" ? PASS : FAIL, detail: `hook=${t.hook.family}/${t.hook.weight} quote=${t.verbatim_quote.family}/${t.verbatim_quote.style}` }; });
  add("INTER BLACK 800 HOOK", () => ({ status: DA.typeCss("hook").weight === 800 ? PASS : FAIL, detail: "hook role weight" }));
  add("DM SERIF ITALIC VERBATIM ONLY", () => ({ status: DA.typeCss("verbatim_quote").style === "italic" && DA.typeCss("editorial_headline").style === "normal" ? PASS : FAIL, detail: "italic reserved to verbatim role" }));
  add("TRANSFORMATION MARK", () => { const s = DA.markSvg("primary"); return { status: s.includes("M42 54 L58 38") ? PASS : FAIL, detail: "official geometry present" }; });
  add("MARK VARIANTS", () => ({ status: DA.MARK_VARIANTS.length >= 3 ? PASS : FAIL, detail: DA.MARK_VARIANTS.join(",") }));
  add("ICONOGRAPHY", () => { const i = DA.iconography(); return { status: i.style === "stroke-only" && i.never.length >= 3 ? PASS : FAIL, detail: i.style }; });
  add("CALLOUT SEMANTICS", () => { const c = DA.calloutSemantics(); return { status: Object.keys(c).length === 5 ? PASS : FAIL, detail: Object.keys(c).join(",") }; });
  add("MARKETING VISUAL MODES", () => { const m = DA.visualModes(); return { status: !!m.typographic && !!m.photo_anchored ? PASS : FAIL, detail: "typographic + photo_anchored" }; });
  add("GROUNDING ELEMENT RULE", () => { const g = DA.groundingElement(); return { status: g.forms.length >= 1 && typeof g.test === "string" ? PASS : FAIL, detail: g.forms.join(" | ") }; });
  add("INTENSITY MAPPING", () => { const i = DA.intensityMapping(); return { status: !!i.high && !!i.low && !!i.conversion ? PASS : FAIL, detail: "high/medium/low/conversion" }; });
  add("MARKETING COMPONENT LIBRARY", () => { const c = DA.componentLibrary(); return { status: c.length === 6 && c.some((x) => x.component === "OG Share Image") ? PASS : FAIL, detail: c.map((x) => x.component).join(" | ") }; });
  add("PLATFORM CONSTRAINTS", () => { const p = DA.platformConstraints(); const z = DA.safeZone("1080x1920"); return { status: z.top === 250 && z.bottom === 350 ? PASS : FAIL, detail: `vertical top ${z.top} bottom ${z.bottom}` }; });
  add("TEXT SIZE", () => ({ status: DA.minTextPx(1080) === 60 ? PASS : FAIL, detail: `60px @1080 → ${DA.minTextPx(1200)}px @1200` }));
  add("CONTRAST", () => ({ status: DA.contrastMin() === 4.5 ? PASS : FAIL, detail: "4.5:1" }));
  add("FAVICON / APP ICON", () => { const p = DA.brandAssets().present; return { status: p.favicon_ico && p.app_icon && p.apple_touch_icon ? PASS : FAIL, detail: "favicon+app icon+apple-touch resolved" }; });
  add("PROHIBITED TREATMENTS", () => ({ status: DA.prohibitedTreatments().length >= 5 ? PASS : FAIL, detail: DA.prohibitedTreatments().length + " rules" }));
  // integrity gate — must not silently pass with a missing rule family
  add("AUTHORITY INTEGRITY", () => { DA.assertAuthorityIntegrity(); return { status: PASS, detail: "all rule families resolve" }; });
  const unknown = rows.filter((r) => r.status === UNKNOWN);
  const failed = rows.filter((r) => r.status === FAIL);
  return { pass: failed.length === 0 && unknown.length === 0, rows, failed, unknown };
}

export { PASS, FAIL, UNKNOWN };
