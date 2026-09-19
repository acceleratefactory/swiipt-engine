// V06 VISUAL PRODUCTION — step 4: rebuild Master Index + Gallery on FINAL creatives + visual QA.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const OUT = join(ROOT, "V06-Marketing-Assets");
const ensureDir = (p) => mkdirSync(p, { recursive: true });
const writeJson = (p, o) => { ensureDir(dirname(p)); writeFileSync(p, JSON.stringify(o, null, 2) + "\n", "utf8"); };
const writeText = (p, s) => { ensureDir(dirname(p)); writeFileSync(p, s, "utf8"); };
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ASSETS = [...Array.from({ length: 16 }, (_, i) => "AST-NS-" + String(i + 1).padStart(3, "0")),
  "AST-NS-STOP-001", "AST-NS-PROB-001", "AST-NS-MYTH-001", "AST-NS-STORY-001", "AST-NS-OBJ-001"];
const PLATDIR = { facebook: "Facebook", instagram: "Instagram", whatsapp: "WhatsApp" };
const loadAsset = (id) => readJson(join(ROOT, "mae/data/assets", id + ".json"));
const visual = readJson(join(OUT, "_visual-ledger.json"));
const vById = Object.fromEntries((visual.assets || []).map((r) => [r.asset, r]));

function finalDir(a) {
  return a.asset_type === "SOCIAL_REEL" ? join(OUT, "Reels", a.id, "final") : join(OUT, PLATDIR[a.platform] || "Instagram", a.id, "final");
}
function finals(a) {
  const d = finalDir(a);
  if (!existsSync(d)) return [];
  return readdirSync(d).filter((f) => f.endsWith(".png") && !/\.src\./.test(f)).sort();
}
function sceneOf(a) {
  const base = a.asset_type === "SOCIAL_REEL" ? join(OUT, "Reels", a.id) : join(OUT, PLATDIR[a.platform] || "Instagram", a.id);
  const f = join(base, "raw-generated");
  if (!existsSync(f)) return null;
  const s = readdirSync(f).find((x) => /\.(jpg|jpeg|png)$/.test(x));
  return s ? `${a.asset_type === "SOCIAL_REEL" ? "Reels/" + a.id : (PLATDIR[a.platform] || "Instagram") + "/" + a.id}/raw-generated/${s}` : null;
}
function evidenceOf(a) {
  const base = a.asset_type === "SOCIAL_REEL" ? join(OUT, "Reels", a.id) : join(OUT, PLATDIR[a.platform] || "Instagram", a.id);
  const f = join(base, "product-evidence");
  if (!existsSync(f)) return null;
  const s = readdirSync(f)[0];
  return s ? `${a.asset_type === "SOCIAL_REEL" ? "Reels/" + a.id : (PLATDIR[a.platform] || "Instagram") + "/" + a.id}/product-evidence/${s}` : null;
}
const headlineOf = (a) => (vById[a.id]?.headline || a.content?.hook_text || "").slice(0, 140);

// ---- PNG inspect (dims) ---------------------------------------------------------
function png(p) { const b = readFileSync(p); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), bytes: b.length }; }

// ---- Master Asset Index (new statuses) ------------------------------------------
const rows = ASSETS.map((id) => {
  const a = loadAsset(id);
  const f = finals(a);
  const platRel = a.asset_type === "SOCIAL_REEL" ? `Reels/${id}` : `${PLATDIR[a.platform] || "Instagram"}/${id}`;
  const vr = vById[id];
  const status = vr ? vr.status : (a.asset_type === "SOCIAL_REEL" ? "PRODUCTION_PACKAGE_READY" : "PRODUCTION_PACKAGE_READY");
  return {
    asset_id: id, platform: a.platform, format: a.platform_format, asset_type: a.asset_type,
    angle: a.angle_id, purpose: a.asset_purpose, status,
    final_creatives: f.map((x) => `${platRel}/final/${x}`),
    raw_generated_scene: sceneOf(a), product_evidence: evidenceOf(a),
    prompt: `Prompts/Images/${id}.txt`, copy: `${platRel}/${id}.copy.md`,
    headline: headlineOf(a),
  };
});
writeJson(join(OUT, "MASTER-ASSET-INDEX.json"), { product_id: "PPL-NIGHT-SHIFT-001", asset_count: rows.length, generated: new Date().toISOString(), assets: rows });
const md = ["# V06 Master Asset Index — Every Night, Just Me (PPL-NIGHT-SHIFT-001)", "",
  "**21 approved marketing asset records.** Static/finished creative statuses: RENDERED (finished composited advertisement exists) · PRODUCTION_PACKAGE_READY (manual package).", "",
  "| # | Asset | Platform | Format | Angle | Status | Final creatives |", "|---|---|---|---|---|---|---|"];
rows.forEach((r, i) => md.push(`| ${i + 1} | \`${r.asset_id}\` | ${r.platform} | ${r.format} (${r.asset_type}) | ${r.angle} | **${r.status}** | ${r.final_creatives.length} |`));
md.push("", "## Finished creative layers", "", "Every asset keeps three layers: `raw-generated/` (exact generated scene + its exact prompt) · `product-evidence/` (the real corrected V06 page used) · `final/` (the finished composited advertisement).");
writeText(join(OUT, "MASTER-ASSET-INDEX.md"), md.join("\n"));

// ---- Rebuild Gallery on FINAL creatives -----------------------------------------
function cards() {
  const G = { FACEBOOK: [], INSTAGRAM: [], WHATSAPP: [], CAROUSELS: [], STORIES: [], REELS: [] };
  for (const id of ASSETS) {
    const a = loadAsset(id);
    const platRel = a.asset_type === "SOCIAL_REEL" ? `Reels/${id}` : `${PLATDIR[a.platform] || "Instagram"}/${id}`;
    const f = finals(a).map((x) => `${platRel}/final/${x}`);
    const vr = vById[id] || {};
    const st = (vr.status || "PRODUCTION_PACKAGE_READY").toLowerCase();
    const head = `<div class="head"><code>${esc(id)}</code><span class="st ${st}">${esc(vr.status || "PRODUCTION_PACKAGE_READY")}</span></div>`;
    const meta = `<div class="meta"><b>${esc(a.platform)}</b> · ${esc(a.platform_format)} · ${esc(a.asset_type)}<br>${esc(headlineOf(a))}</div>`;
    const imgs = f.map((src) => `<img src="${esc(src)}">`).join("");
    if (a.asset_type === "SOCIAL_CAROUSEL") G.CAROUSELS.push(`<div class="card wide">${head}<div class="slides">${imgs}</div>${meta}</div>`);
    else if (a.asset_type === "SOCIAL_STORY_SEQUENCE") G.STORIES.push(`<div class="card">${head}<div class="slides">${imgs}</div>${meta}</div>`);
    else if (a.asset_type === "SOCIAL_REEL") {
      const reelRel = `Reels/${id}/final`;
      G.REELS.push(`<div class="card"><div class="head"><code>${esc(id)}</code><span class="st pp">PRODUCTION PACKAGE READY — VIDEO NOT YET RENDERED</span></div><div class="slides"><img src="${esc(reelRel + "/cover.png")}"><img src="${esc(reelRel + "/storyboard.png")}"></div>${meta}</div>`);
    } else {
      const key = a.platform === "facebook" ? "FACEBOOK" : a.platform === "whatsapp" ? "WHATSAPP" : "INSTAGRAM";
      G[key].push(`<div class="card">${head}${imgs}${meta}</div>`);
    }
  }
  return G;
}
const G = cards();
const sec = (t, items) => (items.length ? `<section><h2>${t} <span class="n">${items.length}</span></h2><div class="grid">${items.join("")}</div></section>` : "");
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>V06 Campaign Gallery — Finished Creative</title><style>
:root{--navy:#0B1F33;--purple:#6F35B5;--gold:#D9A52E;--cream:#F8F4EC;--ink:#17212B}
*{box-sizing:border-box}body{margin:0;font:15px/1.6 Inter,system-ui,sans-serif;background:var(--cream);color:var(--ink)}
header{background:var(--navy);color:#fff;padding:26px 30px}header h1{margin:0;font-size:20px}header p{margin:4px 0 0;opacity:.78;font-size:13px}
main{max-width:1280px;margin:0 auto;padding:26px}section{margin-bottom:38px}
h2{color:var(--navy);border-bottom:2px solid var(--gold);padding-bottom:6px;font-size:18px;display:flex;justify-content:space-between}
h2 .n{color:#7A8794;font-size:13px;font-weight:600}
.grid{display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start}
.card{background:#fff;border:1px solid #DDE2E7;border-radius:14px;padding:12px;width:300px}
.card.wide{width:640px}
.card img{width:100%;border-radius:8px;display:block;margin-bottom:0}
.card .slides{display:flex;flex-direction:row;gap:8px;overflow-x:auto}
.card .slides img{width:auto;max-height:340px;flex:none}
.head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px}
.head code{font-size:11px;color:var(--purple)}
.st{font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;white-space:nowrap}
.st.rendered{background:#E7F6EC;color:#166534}
.st.production_package_ready,.st.pp{background:#FFF4E0;color:#8A5B00}
.meta{font-size:12px;color:#52606D;margin-top:8px}
</style></head><body>
<header><h1>V06 Complete Marketing Campaign — Finished Creative</h1>
<p>Every Night, Just Me · PPL-NIGHT-SHIFT-001 · 21 approved assets · generated scene + real V06 product evidence + deterministic approved typography · owner visual review surface</p></header>
<main>
${sec("FACEBOOK", G.FACEBOOK)}
${sec("INSTAGRAM", G.INSTAGRAM)}
${sec("WHATSAPP", G.WHATSAPP)}
${sec("CAROUSELS", G.CAROUSELS)}
${sec("STORIES", G.STORIES)}
${sec("REELS / VIDEO", G.REELS)}
</main></body></html>`;
writeText(join(OUT, "Gallery", "index.html"), html);
console.log("gallery cards:", G.FACEBOOK.length + G.INSTAGRAM.length + G.WHATSAPP.length + G.CAROUSELS.length + G.STORIES.length + G.REELS.length);

// ---- Objective visual QA --------------------------------------------------------
const qa = { checked: [], failures: [], warnings: [] };
const EXPECT = { "1080x1080": [1080, 1080], "1080x1920": [1080, 1920] };
for (const id of ASSETS) {
  const a = loadAsset(id);
  const d = finalDir(a);
  const pngs = finals(a);
  const want = a.platform_format === "story_vertical" || a.asset_type === "SOCIAL_REEL" ? [1080, 1920] : [1080, 1080];
  if (!pngs.length) { qa.failures.push(`${id}: no final creative`); continue; }
  for (const p of pngs) {
    const full = join(d, p);
    const dim = png(full);
    // the reel storyboard is a landscape reference contact sheet, not a platform creative
    const isSheet = /^storyboard\.png$/.test(p);
    const okDim = isSheet ? dim.w === 1920 && dim.h === 1080 : (dim.w === want[0] && dim.h === want[1]);
    const notBlank = dim.bytes > 40000; // navy-only cards were ~25KB; photo composites are 80-750KB
    const row = { asset: id, file: p, w: dim.w, h: dim.h, kb: Math.round(dim.bytes / 1024), dim_ok: okDim, non_blank: notBlank, kind: isSheet ? "storyboard_sheet" : "platform_creative" };
    qa.checked.push(row);
    if (!okDim) qa.failures.push(`${id}/${p}: ${dim.w}x${dim.h} != expected (${isSheet ? "1920x1080 sheet" : want[0] + "x" + want[1]})`);
    if (!notBlank) qa.failures.push(`${id}/${p}: near-blank (${row.kb}KB)`);
  }
  if (!sceneOf(a)) qa.failures.push(`${id}: no raw generated scene`);
  if (!evidenceOf(a)) qa.warnings.push(`${id}: no product evidence placed`);
}
// slide/frame order + count
for (const id of ASSETS) {
  const a = loadAsset(id);
  if (a.asset_type === "SOCIAL_CAROUSEL") {
    const n = finals(a).length;
    if (n !== (id === "AST-NS-006" ? 4 : 5)) qa.failures.push(`${id}: carousel slides ${n}`);
  }
  if (a.asset_type === "SOCIAL_STORY_SEQUENCE") {
    const n = finals(a).length;
    if (n !== 4) qa.failures.push(`${id}: story frames ${n}`);
  }
}
qa.summary = { assets: ASSETS.length, final_creatives: qa.checked.length, failures: qa.failures.length, warnings: qa.warnings.length };
writeJson(join(OUT, "VISUAL-QA.json"), qa);
console.log("visual QA:", JSON.stringify(qa.summary));
if (qa.failures.length) console.log("FAILURES:", qa.failures.slice(0, 10).join(" | "));
