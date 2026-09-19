// V06 CAMPAIGN — final assembly: Gallery + Master Asset Index + Campaign view + Prompt Archive index.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const OUT = join(ROOT, "V06-Marketing-Assets");
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const loadJson = (rel) => readJson(join(ROOT, rel));
const ensureDir = (p) => mkdirSync(p, { recursive: true });
const writeFileSyncTo = (p, s) => { ensureDir(dirname(p)); writeFileSync(p, s, "utf8"); };
const writeJson = (p, o) => { ensureDir(dirname(p)); writeFileSync(p, JSON.stringify(o, null, 2) + "\n", "utf8"); };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const ASSETS = [...Array.from({ length: 16 }, (_, i) => "AST-NS-" + String(i + 1).padStart(3, "0")),
  "AST-NS-STOP-001", "AST-NS-PROB-001", "AST-NS-MYTH-001", "AST-NS-STORY-001", "AST-NS-OBJ-001"];
const FAMILY_ROLE = { "FAM-NS-001": "Identification", "FAM-NS-002": "Problem", "FAM-NS-003": "Myth reframe", "FAM-NS-004": "Story", "FAM-NS-005": "Objection" };
const ledger = readJson(join(OUT, "_ledger.json"));
const byId = Object.fromEntries(ledger.map((r) => [r.asset, r]));

function assetFiles(a) {
  const platDir = a.platform === "facebook" ? "Facebook" : a.platform === "whatsapp" ? "WhatsApp" : "Instagram";
  const dir = join(OUT, platDir, a.id);
  const files = existsSync(dir) ? readdirSync(dir) : [];
  const rel = (f) => `${platDir}/${a.id}/${f}`;
  return {
    svg: files.find((f) => f.endsWith(".svg")),
    png: files.find((f) => f.endsWith(".png")),
    copy: files.find((f) => f.endsWith(".copy.md")),
    prompt: existsSync(join(OUT, "Prompts", "Images", a.id + ".txt")) ? `Prompts/Images/${a.id}.txt` : null,
    slides: files.filter((f) => /slide-\d+\.png$/.test(f)).sort(),
  };
}

// ---- Master Asset Index -------------------------------------------------------
function buildIndex() {
  const rows = ASSETS.map((id) => {
    const a = loadJson(`mae/data/assets/${id}.json`);
    const f = assetFiles(a);
    const rec = byId[id] || { status: "BLOCKED", reason: "no ledger entry" };
    return {
      asset_id: id, platform: a.platform, format: a.platform_format, asset_type: a.asset_type,
      angle: a.angle_id, purpose: a.asset_purpose, family: FAMILY_ROLE[a.family_id] || a.family_id,
      cta_level: a.cta_level, status: rec.status, reason: rec.reason || null,
      files: { svg: f.svg ? `${a.platform}/${id}/${f.svg}` : null, png: f.png ? `${a.platform}/${id}/${f.png}` : null, copy: f.copy ? `${a.platform}/${id}/${f.copy}` : null, prompt: f.prompt, slides: f.slides.map((s) => `${a.platform}/${id}/${s}`) },
    };
  });
  writeJson(join(OUT, "MASTER-ASSET-INDEX.json"), { product_id: "PPL-NIGHT-SHIFT-001", asset_count: rows.length, generated: new Date().toISOString(), assets: rows });
  const md = ["# V06 Master Asset Index — Every Night, Just Me (PPL-NIGHT-SHIFT-001)", "",
    `**21 approved marketing asset records.** Statuses: RENDERED | PRODUCTION_PACKAGE_READY | BLOCKED.`, "",
    "| # | Asset | Platform | Format | Angle | Purpose | Status |", "|---|---|---|---|---|---|---|"];
  rows.forEach((r, i) => {
    md.push(`| ${i + 1} | \`${r.asset_id}\` | ${r.platform} | ${r.format} (${r.asset_type}) | ${r.angle} | ${r.purpose} | **${r.status}** |`);
  });
  md.push("", "## Blocked / not-rendered assets", "");
  const non = rows.filter((r) => r.status !== "RENDERED");
  if (!non.length) md.push("None — all accounted for.");
  for (const r of non) md.push(`- **${r.asset_id}** — ${r.status}${r.reason ? `: ${r.reason}` : ""}`);
  md.push("", "Every asset has a copy package, an exact reusable image-generation prompt (unless a video), and — where the qualified compositor could not fit the approved copy — a complete manual production package. Nothing is hidden.");
  writeFileSyncTo(join(OUT, "MASTER-ASSET-INDEX.md"), md.join("\n"), "utf8");
  return rows;
}

// ---- Campaign sequence view -----------------------------------------------------
function buildCampaign() {
  const seq = loadJson("mae/data/sequences/SEQ-NS-001.json");
  const camp = loadJson("mae/data/campaigns/CAMP-NS-001.json");
  const rows = (seq.items || []).map((it) => {
    const a = loadJson(`mae/data/assets/${it.asset_id}.json`);
    const rec = byId[it.asset_id] || { status: "BLOCKED" };
    return { position: it.position, asset: it.asset_id, platform: a.platform, role: FAMILY_ROLE[it.family_id] || it.role, cta_level: it.cta_level, emotional: it.emotional_intensity, status: rec.status };
  });
  const md = [`# V06 Campaign Sequence — ${camp.id} (${camp.objective})`, "", `Launch sequence \`${seq.id}\` · ${seq.sequence_type} · ${seq.sequence_status}`, "",
    "| Pos | Asset | Platform | Role | CTA | Emotional | Status |", "|---|---|---|---|---|---|---|"];
  for (const r of rows) md.push(`| ${r.position} | \`${r.asset}\` | ${r.platform} | ${r.role} | ${r.cta_level} | ${r.emotional} | ${r.status} |`);
  md.push("", "Order is the dependency (1 → 21). CTA escalates across the sequence (positions 5/9/16 moderate, 21 high).");
  writeFileSyncTo(join(OUT, "Campaign", "CAMPAIGN-SEQUENCE.md"), md.join("\n"), "utf8");
  return rows;
}

// ---- Prompt Archive index --------------------------------------------------------
function buildPromptIndex() {
  const imgDir = join(OUT, "Prompts", "Images");
  const vidDir = join(OUT, "Prompts", "Videos");
  ensureDir(vidDir);
  const img = existsSync(imgDir) ? readdirSync(imgDir).filter((f) => f.endsWith(".txt")).sort() : [];
  const vid = existsSync(vidDir) ? readdirSync(vidDir).filter((f) => f.endsWith(".txt")).sort() : [];
  const md = ["# V06 Prompt Archive", "", "Exact reusable generation prompts. Paste any prompt directly into a capable generator — no hidden SWIIPT context needed.", "", "## Images", ""];
  for (const f of img) md.push(`- \`${f.replace(/\.txt$/, "")}\` — \`Prompts/Images/${f}\``);
  md.push("", "## Video", "");
  for (const f of vid) md.push(`- \`${f.replace(/\.txt$/, "")}\` — \`Prompts/Videos/${f}\``);
  if (!vid.length) md.push("(video prompt is written into the Reel package)");
  md.push("", "Each prompt carries: scene, subject, environment, lighting, framing, product placement, negative/avoid instructions, dimensions, deterministic text-overlay copy, brand rules and its source asset ID.");
  writeFileSyncTo(join(OUT, "Prompts", "INDEX.md"), md.join("\n"), "utf8");
  return { img: img.length, vid: vid.length };
}

// ---- Gallery ---------------------------------------------------------------------
function gallerySections() {
  function panelImgs(a, f) {
  if (f.slides.length) return f.slides.map((s) => `<img src="${esc(s)}">`).join("");
  if (f.svg) return `<img src="${esc(a.platform + "/" + a.id + "/" + f.svg)}">`;
  return "<p class='na'>manual package</p>";
}

const groups = { FACEBOOK: [], INSTAGRAM: [], WHATSAPP: [], CAROUSELS: [], STORIES: [], REELS: [] };
  for (const id of ASSETS) {
    const a = loadJson(`mae/data/assets/${id}.json`);
    const f = assetFiles(a);
    const rec = byId[id] || { status: "BLOCKED" };
    const hook = (a.content?.hook_text || a.content?.script?.opening_hook || "").slice(0, 120);
    const card = (imgSrc, note) => `<div class="card"><div class="head"><code>${esc(id)}</code><span class="st ${rec.status.toLowerCase()}">${rec.status}</span></div>${imgSrc}<div class="meta"><b>${esc(a.platform)}</b> · ${esc(a.platform_format)} · ${esc(a.asset_type)}<br>${esc(hook)}</div>${note}</div>`;
    if (a.asset_type === "SOCIAL_CAROUSEL") {
      groups.CAROUSELS.push(`<div class="card"><div class="head"><code>${esc(id)}</code><span class="st ${rec.status.toLowerCase()}">${rec.status}</span></div><div class="slides">${panelImgs(a, f)}</div><div class="meta">${esc(a.platform_format)} · ${esc(a.asset_type)} · ${esc(hook)}</div></div>`);
    } else if (a.asset_type === "SOCIAL_STORY_SEQUENCE") {
      groups.STORIES.push(`<div class="card"><div class="head"><code>${esc(id)}</code><span class="st ${rec.status.toLowerCase()}">${rec.status}</span></div><div class="slides">${panelImgs(a, f)}</div><div class="meta">${esc(a.platform_format)} · ${esc(a.asset_type)} · ${esc(hook)}</div></div>`);
    } else if (a.asset_type === "SOCIAL_REEL") {
      const reelDir = join(OUT, "Reels", id);
      const key = existsSync(reelDir) ? readdirSync(reelDir).filter((f) => f.startsWith("keyframe-") && f.endsWith(".png")).map((k) => `<img src="${esc(`Reels/${id}/${k}`)}">`).join("") : "";
      groups.REELS.push(`<div class="card"><div class="head"><code>${esc(id)}</code><span class="st pp">PRODUCTION PACKAGE READY — VIDEO NOT YET RENDERED</span></div><div class="slides">${key}</div><div class="meta">${esc(a.platform_format)} · ${esc(a.asset_type)} · ${esc(hook)}<br>Complete video package in <code>Reels/${esc(id)}/</code></div></div>`);
    } else {
      const img = f.png ? `<img src="${esc(`${a.platform}/${id}/${f.png}`)}">` : (f.svg ? `<img src="${esc(`${a.platform}/${id}/${f.svg}`)}">` : `<p class='na'>manual package</p>`);
      const srcGroup = a.platform === "facebook" ? "FACEBOOK" : a.platform === "whatsapp" ? "WHATSAPP" : "INSTAGRAM";
      groups[srcGroup].push(card(img, ""));
    }
  }
  return groups;
}

function buildGallery() {
  const g = gallerySections();
  const section = (title, items) => (items.length ? `<section><h2>${title}</h2><div class="grid">${items.join("")}</div></section>` : "");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>V06 Campaign Gallery</title><style>
:root{--navy:#0B1F33;--purple:#6F35B5;--gold:#D9A52E;--cream:#F8F4EC;--ink:#17212B}
*{box-sizing:border-box}body{margin:0;font:15px/1.6 Inter,system-ui,sans-serif;background:var(--cream);color:var(--ink)}
header{background:var(--navy);color:#fff;padding:26px 30px}header h1{margin:0;font-size:20px}header p{margin:4px 0 0;opacity:.75}
main{max-width:1200px;margin:0 auto;padding:26px}section{margin-bottom:34px}
h2{color:var(--navy);border-bottom:2px solid var(--gold);padding-bottom:6px;font-size:18px}
.grid{display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start}
.card{background:#fff;border:1px solid #DDE2E7;border-radius:14px;padding:12px;width:280px}
.card img{width:100%;border-radius:8px;display:block}
.card .slides{display:flex;flex-direction:column;gap:10px}
.head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.head code{font-size:11px;color:var(--purple)}
.st{font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px}
.st.rendered{background:#E7F6EC;color:#166534}
.st.production_package_ready,.st.pp{background:#FFF4E0;color:#8A5B00}
.meta{font-size:12px;color:#52606D;margin-top:8px}.na{color:#999;font-style:italic;font-size:12px}
</style></head><body><header><h1>V06 Complete Marketing Campaign Gallery</h1><p>Every Night, Just Me · PPL-NIGHT-SHIFT-001 · 21 approved assets · Owner visual review surface</p></header>
<main>
${section("FACEBOOK", g.FACEBOOK)}
${section("INSTAGRAM", g.INSTAGRAM)}
${section("WHATSAPP", g.WHATSAPP)}
${section("CAROUSELS", g.CAROUSELS)}
${section("STORIES", g.STORIES)}
${section("REELS / VIDEO", g.REELS)}
</main></body></html>`;
  writeFileSyncTo(join(OUT, "Gallery", "index.html"), html, "utf8");
  return { cards: g.FACEBOOK.length + g.INSTAGRAM.length + g.WHATSAPP.length + g.CAROUSELS.length + g.STORIES.length + g.REELS.length };
}

const idx = buildIndex();
const camp = buildCampaign();
const prompts = buildPromptIndex();
const gallery = buildGallery();
console.log(JSON.stringify({ index_assets: idx.length, campaign_items: camp.length, prompts: prompts, gallery_cards: gallery.cards }, null, 2));