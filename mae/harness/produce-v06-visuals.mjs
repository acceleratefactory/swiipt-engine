// V06 VISUAL PRODUCTION — step 2: composite FINISHED creative.
// FINAL = generated scene + real corrected V06 product evidence + deterministic approved typography
// + SWIIPT brand composition. Layers kept: raw-generated/ · product-evidence/ · final/.
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import {
  OUT, ROOT, loadJson, ensureDir, writeJson, writeText, shot, pngDims, generateImage, scenePrompt,
  DES_FOR_ASSET, EVIDENCE_PAGE, EVIDENCE_LABEL, SOURCE_PAGES,
} from "./visual-lib.mjs";

const PLATDIR = { facebook: "Facebook", instagram: "Instagram", whatsapp: "WhatsApp" };
const ASSETS = [...Array.from({ length: 16 }, (_, i) => "AST-NS-" + String(i + 1).padStart(3, "0")),
  "AST-NS-STOP-001", "AST-NS-PROB-001", "AST-NS-MYTH-001", "AST-NS-STORY-001", "AST-NS-OBJ-001"];

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ROLE_NORM = { primary_headline: "headline", headline: "headline", secondary_headline: "subheadline", body_text: "supporting_line", body: "supporting_line", supporting_line: "supporting_line", call_to_action: "cta", cta: "cta" };
const desCopy = (id) => {
  if (!DES_FOR_ASSET[id]) return [];
  const d = loadJson(`mae/data/design-specs/${DES_FOR_ASSET[id]}.json`);
  const cb = d.copy_blocks || {};
  return (Array.isArray(cb) ? cb : Object.entries(cb).map(([k, v]) => ({ role: v.role, text: v.text, slide: v.slide, key: k })))
    .map((b) => ({ ...b, role: ROLE_NORM[b.role] || b.role }));
};
const pick = (blocks, roles) => blocks.find((b) => roles.includes(b.role));

function assetDir(a, sub = "") {
  const base = a.asset_type === "SOCIAL_REEL" ? join(OUT, "Reels", a.id) : join(OUT, PLATDIR[a.platform] || "Instagram", a.id);
  return sub ? join(base, sub) : base;
}

// Copy real corrected product evidence into the asset's product-evidence/ layer.
function placeEvidence(a) {
  const page = EVIDENCE_PAGE[a.id];
  if (!page) return null;
  const src = join(SOURCE_PAGES, page);
  if (!existsSync(src)) return null;
  const dir = assetDir(a, "product-evidence");
  ensureDir(dir);
  copyFileSync(src, join(dir, page));
  return { file: page, label: EVIDENCE_LABEL[page] || "Real system page" };
}

// Deterministic finished-creative HTML (scene + scrim + hierarchy + product evidence + CTA + brand).
function creativeHtml({ sceneSrc, evidence, eyebrow, headline, support, cta, width, height, frameBadge }) {
  const pad = width >= 1000 && height > width ? 84 : 76;
  const hSize = height > width ? 74 : 60;
  const sSize = height > width ? 34 : 30;
  const evSize = height > width ? 210 : 176;
  return `
<div style="position:relative;width:${width}px;height:${height}px;overflow:hidden;background:#0B1F33;font-family:Inter,sans-serif">
  <img src="${esc(sceneSrc)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
  <div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(11,31,51,.18) 0%, rgba(11,31,51,.34) 34%, rgba(11,31,51,.80) 62%, rgba(11,31,51,.96) 100%)"></div>
  <div style="position:absolute;top:${pad * 0.62}px;left:${pad}px;right:${pad}px;display:flex;justify-content:space-between;align-items:center">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="width:34px;height:34px;background:#6F35B5;border-radius:9px;transform:rotate(45deg)"></div>
      <span style="color:#fff;font-weight:700;letter-spacing:.16em;font-size:20px">SWIIPT</span>
    </div>
    <span style="color:#D9A52E;font-weight:600;letter-spacing:.1em;font-size:17px;text-transform:uppercase">${esc(eyebrow)}</span>
  </div>
  <div style="position:absolute;left:${pad}px;right:${pad}px;bottom:${pad}px">
    ${frameBadge ? `<div style="display:inline-block;background:#D9A52E;color:#0B1F33;font-weight:700;font-size:16px;letter-spacing:.12em;padding:6px 14px;border-radius:999px;margin-bottom:16px">${esc(frameBadge)}</div>` : ""}
    <h1 style="margin:0 0 16px;color:#fff;font-family:'DM Serif Display',Georgia,serif;font-size:${hSize}px;line-height:1.14;letter-spacing:-.01em;text-shadow:0 2px 18px rgba(0,0,0,.45)">${esc(headline)}</h1>
    ${support ? `<p style="margin:0 0 22px;color:#EAF0F6;font-size:${sSize}px;line-height:1.42;max-width:92%">${esc(support)}</p>` : ""}
    ${evidence ? `<div style="display:flex;align-items:center;gap:18px;background:rgba(255,255,255,.96);border-radius:16px;padding:14px 18px;margin-bottom:22px;box-shadow:0 10px 30px rgba(0,0,0,.35)">
      <img src="${esc(evidence.src)}" style="width:${evSize * 0.52}px;height:${evSize * 0.72}px;object-fit:cover;object-position:top;border-radius:8px;border:1px solid #DDE2E7;flex:none">
      <div><div style="color:#0B1F33;font-weight:700;font-size:19px;margin-bottom:4px">Real system page</div><div style="color:#52606D;font-size:16px;line-height:1.35">${esc(evidence.label)}</div></div>
    </div>` : ""}
    ${cta ? `<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <span style="background:#6F35B5;color:#fff;font-weight:700;font-size:22px;padding:16px 30px;border-radius:999px;display:inline-block">${esc(cta)}</span>
      <span style="color:#C9D6E4;font-size:15px">Educational content — not medical advice</span>
    </div>` : ""}
  </div>
</div>`;
}

export async function produceStatic(a) {
  const f = assetDir(a);
  ensureDir(join(f, "raw-generated")); ensureDir(join(f, "final"));
  const scene = join(f, "raw-generated", "scene.jpg");
  let gen = { status: "CACHED" };
  if (!existsSync(scene)) {
    const r = await generateImage(scenePrompt(a));
    gen = r.ok ? { status: "PROVIDER_SUCCESS", bytes: r.bytes.length, ms: r.ms, model: r.model } : { status: "PRODUCTION_PACKAGE_READY", provider_failure: r.status, error: r.error };
    if (r.ok) { writeFileSync(scene, r.bytes); writeText(scene.replace(/\.jpg$/, ".prompt.txt"), scenePrompt(a)); }
  }
  if (!existsSync(scene)) return { asset: a.id, status: "PRODUCTION_PACKAGE_READY", provider_failure: gen.provider_failure, error: gen.error };

  const ev = placeEvidence(a);
  const blocks = desCopy(a.id);
  const headline = (pick(blocks, ["headline"]) || {}).text || a.content?.hook_text || "";
  const support = (pick(blocks, ["supporting_line", "subheadline"]) || {}).text || "";
  const cta = (pick(blocks, ["cta"]) || {}).text || "";
  const W = 1080, H = 1080;
  const html = creativeHtml({
    sceneSrc: "raw-generated/scene.jpg",
    evidence: ev ? { src: `product-evidence/${ev.file}`, label: ev.label } : null,
    eyebrow: (a.platform === "facebook" ? "Facebook" : a.platform === "whatsapp" ? "WhatsApp" : "Instagram") + " · Every Night, Just Me",
    headline, support, cta, width: W, height: H,
  });
  const outPng = join(f, "final", `${a.id}.png`);
  const dims = shot(html, W, H, outPng);
  writeText(join(f, "final", `${a.id}.html`), html);
  return { asset: a.id, status: dims.width === W && dims.height === H ? "RENDERED" : "PRODUCTION_PACKAGE_READY", scene: gen, dims, evidence: ev?.file || null, final: outPng, headline, support, cta };
}

// ---- carousels / stories -------------------------------------------------------
export async function produceMulti(a) {
  const isStory = a.asset_type === "SOCIAL_STORY_SEQUENCE";
  const f = assetDir(a);
  ensureDir(join(f, "raw-generated")); ensureDir(join(f, "final"));
  const blocks = isStory
    ? desCopy(a.id)
    : desCopy(a.id).filter((b) => b.slide != null);
  const groups = new Map();
  for (const b of blocks) {
    const k = b.frame ?? b.slide ?? (b.key?.match(/frame_(\d+)/)?.[1] ?? b.key?.match(/slide_(\d+)/)?.[1]);
    if (k == null) continue;
    if (!groups.has(Number(k))) groups.set(Number(k), []);
    groups.get(Number(k)).push(b);
  }
  const W = isStory ? 1080 : 1080, H = isStory ? 1920 : 1080;
  const ev = placeEvidence(a);
  const results = [];
  const ordered = [...groups.entries()].sort((x, y) => x[0] - y[0]);
  let idx = 0;
  for (const [n, items] of ordered) {
    idx++;
    const scene = isStory ? join(f, "raw-generated", "scene.jpg") : join(f, "raw-generated", `scene-slide-${n}.jpg`);
    if (!existsSync(scene)) {
      const r = await generateImage(scenePrompt(a));
      if (!r.ok) { results.push({ panel: idx, slide: n, status: "PRODUCTION_PACKAGE_READY", provider_failure: r.status, error: r.error }); continue; }
      writeFileSync(scene, r.bytes);
      writeText(scene.replace(/\.jpg$/, ".prompt.txt"), scenePrompt(a));
    }
    const key = String(items[0]?.key || "");
    const head = (pick(items, ["headline", "subheadline"]) || items[0] || {}).text || "";
    const sup = (pick(items, ["supporting_line"]) || {}).text || "";
    const cta = (pick(items, ["cta"]) || {}).text || "";
    const isLast = idx === ordered.length;
    const html = creativeHtml({
      sceneSrc: `raw-generated/${isStory ? "scene" : "scene-slide-" + n}.jpg`,
      evidence: isLast && ev ? { src: `product-evidence/${ev.file}`, label: ev.label } : null,
      eyebrow: (isStory ? "Instagram Story" : "Instagram Carousel") + " · " + (a.angle_id || ""),
      headline: head, support: sup, cta, width: W, height: H,
      frameBadge: isStory ? `FRAME ${idx} / ${ordered.length}` : `SLIDE ${idx} / ${ordered.length}`,
    });
    const outPng = join(f, "final", isStory ? `frame-${String(idx).padStart(2, "0")}.png` : `slide-${String(idx).padStart(2, "0")}.png`);
    const dims = shot(html, W, H, outPng);
    writeText(outPng.replace(/\.png$/, ".html"), html);
    results.push({ panel: idx, slide: n, status: dims.width === W && dims.height === H ? "RENDERED" : "PRODUCTION_PACKAGE_READY", dims, final: outPng });
  }
  const okAll = results.length === ordered.length && results.every((r) => r.status === "RENDERED");
  return { asset: a.id, status: okAll ? "RENDERED" : "PRODUCTION_PACKAGE_READY", type: a.asset_type, panels: results, count: ordered.length };
}

export { ASSETS, assetDir, desCopy, pick, creativeHtml, placeEvidence, esc };

const invoked = process.argv[1] && process.argv[1].endsWith("produce-v06-visuals.mjs");
if (invoked) {
  const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
  const ledger = [];
  for (const id of ASSETS) {
    if (only && id !== only) continue;
    const a = loadJson(`mae/data/assets/${id}.json`);
    if (a.asset_type === "SOCIAL_CAROUSEL" || a.asset_type === "SOCIAL_STORY_SEQUENCE") ledger.push(await produceMulti(a));
    else if (a.asset_type === "SOCIAL_REEL") continue;
    else ledger.push(await produceStatic(a));
    const r = ledger[ledger.length - 1];
    console.log(r.asset, "->", r.status, r.count ? `(${r.count} panels)` : (r.dims ? `${r.dims.width}x${r.dims.height}` : ""));
  }
  writeJson(join(OUT, "_visual-ledger.json"), { generated: new Date().toISOString(), provider_spend_usd: 0, assets: ledger });
  const rend = ledger.filter((r) => r.status === "RENDERED").length;
  console.log(`FINAL creatives: ${rend}/${ledger.length} RENDERED`);
}