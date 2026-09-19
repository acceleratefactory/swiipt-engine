// §28 + §29 — rebuild the full V06 Gallery on the NEW corrected campaign, and produce the
// full-campaign + per-platform contact sheets.
//
// Gallery = internal review surface: asset IDs, platform, format, treatment, headline and render
// status ARE allowed here (and only here). The consumer creative itself carries none of them.
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileUrl } from "./creative-compositor.mjs";

// Absolute paths are required: headless Edge does not write a RELATIVE --screenshot path.
const OUT = resolve("V06-Marketing-Assets");
const GAL = join(OUT, "Gallery");
const LED = JSON.parse(readFileSync(join(OUT, "_campaign-ledger.json"), "utf8"));

const rel = (p) => relative(GAL, p).replace(/\\/g, "/");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const TNAME = { A: "A · Emotional Hook", B: "B · Product/Mechanism Proof", C: "C · Editorial/Insight", D: "D · Educational Carousel", E: "E · Transformation/Outcome", F: "F · Product/CTA" };
const fmtOf = (r) => (r.type === "STATIC" ? (r.platform === "whatsapp" ? "WhatsApp broadcast" : "Feed square") : r.type === "STORY" ? "Story 9:16" : r.type === "CAROUSEL" ? "Carousel 1:1" : "Reel 9:16");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
function sheet(cells, cols, outPath) {
  const CW = 300, BOX = 340;
  const rows = Math.ceil(cells.length / cols);
  const w = cols * CW + 40, h = rows * (BOX + 56) + 40;
  const grid = cells.map((c) => `<div class="cell"><div class="box">${c.src ? `<img src="${fileUrl(c.src)}">` : ""}</div><div class="cap"><b>${esc(c.a)}</b><span>${esc(c.s)}</span></div></div>`).join("");
  const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#0B1F33;font-family:Inter,Arial,sans-serif;padding:20px}
.grid{display:grid;grid-template-columns:repeat(${cols},${CW}px);gap:16px}
.cell{width:${CW}px}.box{width:${CW}px;height:${BOX}px;background:#000;border:1px solid #2b3d52;border-radius:8px;overflow:hidden;display:flex;align-items:center;justify-content:center}
.box img{max-width:100%;max-height:100%;object-fit:contain;display:block}
.cap{font-size:12px;color:#C9D6E4;padding-top:6px;display:flex;flex-direction:column;gap:2px}
.cap b{color:#D9A52E}.cap span{color:#8FA4BB}
</style></head><body><div class="grid">${grid}</div></body></html>`;
  const hp = outPath.replace(/\.png$/, ".src.html");
  writeFileSync(hp, doc, "utf8");
  execFileSync(EDGE, ["--headless", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files", "--no-first-run", `--window-size=${w},${h}`, "--virtual-time-budget=20000", `--screenshot=${outPath}`, fileUrl(hp)], { timeout: 180000, stdio: ["ignore", "pipe", "ignore"] });
  const b = readFileSync(outPath);
  return { out: outPath, w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

/* ---------------------------------------------------------------- collect finals by group */
const groups = { FACEBOOK: [], "INSTAGRAM FEED": [], WHATSAPP: [], CAROUSELS: [], STORIES: [], REELS: [] };
const allCells = [];
for (const r of LED.assets) {
  if (r.type === "STATIC") {
    const g = r.platform === "facebook" ? "FACEBOOK" : r.platform === "whatsapp" ? "WHATSAPP" : "INSTAGRAM FEED";
    const cell = { a: r.asset, s: `${fmtOf(r)} · ${TNAME[r.treatment]} · ${r.qa?.pass ? "RENDERED · QA PASS" : "FAILED"}`, src: r.final };
    groups[g].push({ ...r, cell });
    allCells.push(cell);
  } else if (r.type === "CAROUSEL" || r.type === "STORY") {
    const g = r.type === "CAROUSEL" ? "CAROUSELS" : "STORIES";
    const cells = r.slides.map((s) => ({ a: `${r.asset} · panel ${s.slide}`, s: `${TNAME[s.treatment]} · ${s.status}${s.qa?.pass ? " · QA PASS" : ""}`, src: s.final }));
    groups[g].push({ ...r, cells });
    allCells.push(...cells);
  } else if (r.type === "REEL") {
    const cells = [{ a: r.asset, s: "Cover (9:16)", src: r.cover.final }]
      .concat(r.keyframes.map((k) => ({ a: `${r.asset} · ${k.label}`, s: `Keyframe ${k.index} · ${k.status}`, src: k.final })))
      .concat([{ a: `${r.asset} · storyboard`, s: `Review sheet · ${r.storyboard.status}`, src: r.storyboard.final }]);
    groups.REELS.push({ ...r, cells });
    allCells.push(...cells);
  }
}

/* ---------------------------------------------------------------- contact sheets */
const sheets = {};
sheets["V06-FULL-CAMPAIGN-CONTACT-SHEET.png"] = sheet(allCells, 6, join(GAL, "V06-FULL-CAMPAIGN-CONTACT-SHEET.png"));
sheets["V06-CONTACT-FACEBOOK.png"] = sheet(groups.FACEBOOK.map((g) => g.cell), 5, join(GAL, "V06-CONTACT-FACEBOOK.png"));
sheets["V06-CONTACT-INSTAGRAM-FEED.png"] = sheet(groups["INSTAGRAM FEED"].map((g) => g.cell), 5, join(GAL, "V06-CONTACT-INSTAGRAM-FEED.png"));
sheets["V06-CONTACT-WHATSAPP.png"] = sheet(groups.WHATSAPP.map((g) => g.cell), 2, join(GAL, "V06-CONTACT-WHATSAPP.png"));
sheets["V06-CONTACT-CAROUSELS.png"] = sheet(groups.CAROUSELS.flatMap((g) => g.cells), 5, join(GAL, "V06-CONTACT-CAROUSELS.png"));
sheets["V06-CONTACT-STORIES.png"] = sheet(groups.STORIES.flatMap((g) => g.cells), 4, join(GAL, "V06-CONTACT-STORIES.png"));
sheets["V06-CONTACT-REEL.png"] = sheet(groups.REELS.flatMap((g) => g.cells), 6, join(GAL, "V06-CONTACT-REEL.png"));

/* ---------------------------------------------------------------- gallery html */
function card(c) {
  return `<figure class="pc"><div class="imgbox"><img src="${rel(c.src)}" alt="${esc(c.a)}"></div>
  <figcaption><b>${esc(c.a)}</b><span>${esc(c.s)}</span></figcaption></figure>`;
}
function section(title, items, render) {
  if (!items.length) return "";
  return `<section><h2>${title}</h2><div class="row">${items.map(render).join("")}</div></section>`;
}
const stat = LED.totals;
const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>V06 Full Campaign — Every Night, Just Me</title>
<style>
:root{--navy:#0B1F33;--gold:#D9A52E;--cream:#F8F4EC;--ink:#17212B;--mut:#52606D;--line:#DDE2E7}
*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font:15px/1.55 Inter,-apple-system,Segoe UI,Arial,sans-serif}
header{background:var(--navy);color:#fff;padding:38px 42px}
header h1{margin:0 0 8px;font:400 32px/1.15 Georgia,serif}
header p{margin:0;color:#B9C7D6;font-size:14.5px}
header .banner{margin-top:16px;display:inline-block;background:rgba(217,165,46,.16);border:1px solid var(--gold);color:#F0D9A0;padding:8px 14px;border-radius:8px;font-weight:600;font-size:13.5px}
main{padding:30px 42px 70px;max-width:1720px}
section{background:#fff;border:1px solid var(--line);border-radius:14px;padding:22px;margin-bottom:26px}
h2{margin:0 0 16px;font:400 24px/1.2 Georgia,serif;color:var(--navy)}
.row{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}
.pc{margin:0}.imgbox{background:var(--navy);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.pc img{display:block;width:100%;height:auto}
figcaption{font-size:12.5px;padding:8px 2px 0;display:flex;flex-direction:column;gap:2px}
figcaption b{color:var(--navy)}figcaption span{color:var(--mut);font-size:12px}
table{border-collapse:collapse;font-size:13.5px;margin-top:6px}
td,th{border:1px solid var(--line);padding:6px 11px;text-align:left}th{background:#F1F4F7;color:var(--navy)}
.foot{color:var(--mut);font-size:13px;padding:0 42px 50px}
</style></head><body>
<header>
  <h1>V06 — Every Night, Just Me · Full Visual Campaign</h1>
  <p>21 approved marketing assets · rendered by the frozen SWIIPT reusable compositor (treatments A–F) · generated scenes + real product evidence + deterministic typography</p>
  <div class="banner">Reel: PRODUCTION PACKAGE READY — VIDEO NOT YET RENDERED</div>
</header>
<main>
  <section><h2>Campaign summary</h2>
  <table><tr><th>Approved records</th><th>Statics</th><th>Carousels</th><th>Carousel slides</th><th>Stories</th><th>Story frames</th><th>Reels</th></tr>
  <tr><td>${stat.approved_records}</td><td>${stat.statics}</td><td>${stat.carousel_sets}</td><td>${stat.carousel_slides}</td><td>${stat.story_sets}</td><td>${stat.story_frames}</td><td>${stat.reels}</td></tr></table>
  <p style="font-size:13px;color:var(--mut);margin:14px 0 0">Contact sheets: <a href="V06-FULL-CAMPAIGN-CONTACT-SHEET.png">full campaign</a> · <a href="V06-CONTACT-FACEBOOK.png">Facebook</a> · <a href="V06-CONTACT-INSTAGRAM-FEED.png">Instagram feed</a> · <a href="V06-CONTACT-WHATSAPP.png">WhatsApp</a> · <a href="V06-CONTACT-CAROUSELS.png">carousels</a> · <a href="V06-CONTACT-STORIES.png">stories</a> · <a href="V06-CONTACT-REEL.png">reel</a></p>
  </section>
  ${section("FACEBOOK", groups.FACEBOOK, (g) => card(g.cell))}
  ${section("INSTAGRAM FEED", groups["INSTAGRAM FEED"], (g) => card(g.cell))}
  ${section("WHATSAPP", groups.WHATSAPP, (g) => card(g.cell))}
  ${section("CAROUSELS", groups.CAROUSELS, (g) => g.cells.map(card).join(""))}
  ${section("STORIES", groups.STORIES, (g) => g.cells.map(card).join(""))}
  ${section("REELS", groups.REELS, (g) => g.cells.map(card).join(""))}
</main>
<div class="foot">Asset IDs appear here as internal Gallery metadata only. The consumer creative itself contains SWIIPT branding and approved copy — no platform labels and no internal identifiers. Generated ${new Date().toISOString()}.</div>
</body></html>`;
writeFileSync(join(GAL, "index.html"), html, "utf8");
console.log("Gallery/index.html written:", html.length, "bytes");
for (const [k, v] of Object.entries(sheets)) console.log(`sheet ${k}: ${v.w}x${v.h}`);
console.log(`total final creatives in gallery: ${allCells.length}`);
