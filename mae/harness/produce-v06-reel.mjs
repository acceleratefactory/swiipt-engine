// V06 VISUAL PRODUCTION — step 3: reel deterministic components (cover + storyboard contact sheet).
// The reel stays PRODUCTION_PACKAGE_READY (no qualified video provider) but every deterministic
// component possible is produced: cover, storyboard frames, product evidence, prompt, shot list.
import { readFileSync, writeFileSync, existsSync, copyFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { OUT, loadJson, ensureDir, writeText, shot, EVIDENCE_PAGE, EVIDENCE_LABEL, SOURCE_PAGES } from "./visual-lib.mjs";
import { creativeHtml } from "./produce-v06-visuals.mjs";

const a = loadJson("mae/data/assets/AST-NS-007.json");
const REEL = join(OUT, "Reels", a.id);
const FONT = "file:///C:/Users/HPM6/Desktop/Transformation/Product%20Pipeline/specs/V06/pdf%20design%20fix/swiipt-ebook-design-skill/swiipt-ebook-design/reference/fonts";
ensureDir(join(REEL, "final")); ensureDir(join(REEL, "product-evidence"));

// product evidence for the reel (real corrected page)
const page = EVIDENCE_PAGE[a.id] || "page-12.png";
if (existsSync(join(SOURCE_PAGES, page))) copyFileSync(join(SOURCE_PAGES, page), join(REEL, "product-evidence", page));

const sc = a.content.script || {};
const sceneOk = existsSync(join(REEL, "raw-generated", "cover.jpg"));
const W = 1080, H = 1920;

// 1. cover creative (scene + hook + CTA + product evidence + brand)
if (sceneOk) {
  const html = creativeHtml({
    sceneSrc: "raw-generated/cover.jpg",
    evidence: { src: `product-evidence/${page}`, label: EVIDENCE_LABEL[page] || "Real system page" },
    eyebrow: "Instagram Reel · Every Night, Just Me",
    headline: sc.opening_hook || "",
    support: sc.desired_change || "",
    cta: "See the system",
    width: W, height: H,
    frameBadge: "REEL COVER",
  });
  const d = shot(html, W, H, join(REEL, "final", "cover.png"));
  writeText(join(REEL, "final", "cover.html"), html);
  console.log("reel cover:", d.width + "x" + d.height);
}

// 2. storyboard contact sheet (4 keyframes in order + shot list + exact prompt reference)
const keys = readdirSync(join(REEL)).filter((f) => /^keyframe-.*\.png$/.test(f)).sort();
const board = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Inter';font-weight:400;src:url('${FONT}/Inter-Regular.ttf');}
@font-face{font-family:'Inter';font-weight:600;src:url('${FONT}/Inter-SemiBold.ttf');}
@font-face{font-family:'DM Serif Display';font-weight:400;src:url('${FONT}/DMSerifDisplay-Regular.ttf');}
html,body{margin:0;padding:0;background:#0B1F33;font-family:Inter,sans-serif}
.wrap{width:1920px;padding:56px}
h1{color:#fff;font-family:'DM Serif Display',serif;font-size:52px;margin:0 0 6px}
.sub{color:#9FB0C2;font-size:22px;margin:0 0 34px}
.row{display:flex;gap:26px}
.cell{width:430px}.cell img{width:430px;border-radius:14px;border:1px solid #24405C;display:block}
.cap{color:#EAF0F6;font-size:19px;margin-top:12px;line-height:1.4}
.tag{display:inline-block;background:#D9A52E;color:#0B1F33;font-weight:700;font-size:16px;padding:4px 12px;border-radius:999px;margin-bottom:10px}
.foot{color:#9FB0C2;font-size:18px;margin-top:30px}
</style></head><body><div class="wrap">
<h1>Every Night, Just Me — Reel Storyboard</h1>
<p class="sub">${a.angle_id} · 20s · 9:16 · PRODUCTION PACKAGE READY — VIDEO NOT YET RENDERED</p>
<div class="row">
${keys.map((k, i) => `<div class="cell"><span class="tag">SHOT ${i + 1}</span><img src="${k}"><div class="cap">${k.replace(/keyframe-|\.png/g, "").toUpperCase()} frame — authored on-screen text (verbatim script)</div></div>`).join("")}
</div>
<p class="foot">Cover scene: raw-generated/cover.jpg · Real product evidence: product-evidence/${page} · Exact video-generation prompt: ${a.id}.video-prompt.txt · Shot list, timing, transitions and captions: ${a.id}.video-package.json</p>
</div></body></html>`;
writeText(join(REEL, "final", "storyboard.html"), board);
const bd = shot(board, 1920, 1080, join(REEL, "final", "storyboard.png"));
console.log("storyboard:", bd.width + "x" + bd.height, "| keyframes:", keys.length);
console.log("scene present:", sceneOk);
