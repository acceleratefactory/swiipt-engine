// V06 FULL VISUAL CAMPAIGN REGENERATION through the frozen reusable compositor (Task §17-§23).
//
// Every one of the 21 approved V06 marketing asset records is rendered from:
//   approved DES copy_blocks (verbatim) + real corrected V06 product evidence (where the
//   treatment requires it) + the existing Visual-Grounding-derived generated scene.
// No copy is written here. No provider is called. No asset id appears in the compositor.
import { existsSync, copyFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { OUT, loadJson, ensureDir, writeJson, DES_FOR_ASSET, EVIDENCE_PAGE, EVIDENCE_LABEL, SOURCE_PAGES } from "./visual-lib.mjs";
import {
  TREATMENT, selectTreatment, slideTreatment, renderCreative, shotVerified, checkCreative,
  inlineImage, assertImageDecodable, assertSceneGrounded, esc, stats,
} from "./creative-compositor.mjs";

const PLATDIR = { facebook: "Facebook", instagram: "Instagram", whatsapp: "WhatsApp" };
const ROLE_NORM = { primary_headline: "headline", secondary_headline: "subheadline", body_text: "supporting_line", call_to_action: "cta" };
const SQUARE = { w: 1080, h: 1080, safe: { top: 120, bottom: 120, left: 80, right: 80 } };
const TALL = { w: 1080, h: 1920, safe: { top: 200, bottom: 280, left: 60, right: 60 } };

const esc_ = esc;
// Reels keep their own top-level convention (Reels/<id>); everything else is <Platform>/<id>.
const assetDir = (a) => (a.asset_type === "SOCIAL_REEL" ? join(OUT, "Reels", a.id) : join(OUT, PLATDIR[a.platform] || "Instagram", a.id));
const asset = (id) => loadJson(`mae/data/assets/${id}.json`);
const desOf = (a) => (DES_FOR_ASSET[a.id] ? loadJson(`mae/data/design-specs/${DES_FOR_ASSET[a.id]}.json`) : null);

// Approved customer-facing brand/product name (identity.name) — never an internal id (Task §4).
const product = loadJson("data/products/PPL-NIGHT-SHIFT-001/product.json");
const BRAND_NAME = product.identity?.name || "";
const TRUST = (product.safety?.disclaimer || "").split(/(?<=\.)\s/)[0] || "Educational content - not medical advice.";

function desCopy(id) {
  const des = DES_FOR_ASSET[id];
  if (!des) return [];
  const d = loadJson(`mae/data/design-specs/${des}.json`);
  const cb = d.copy_blocks || {};
  return Object.entries(cb).map(([k, v]) => ({ key: k, slide: v.slide, role: ROLE_NORM[v.role] || v.role, text: v.text }));
}
const pick = (b, roles) => b.find((x) => roles.includes(x.role));

function evidenceFor(a) {
  const page = EVIDENCE_PAGE[a.id];
  if (!page) return null;
  const p = join(SOURCE_PAGES, page);
  return existsSync(p) ? { page, path: p, label: EVIDENCE_LABEL[page] || "" } : null;
}

function decodeGates(a, scenePaths, ev) {
  scenePaths.forEach((p) => {
    if (!existsSync(p)) throw new Error(`missing required generated scene: ${p}`);
    assertSceneGrounded(p);            // ratified NO_GENERIC_STOCK_PHOTO traceability
    assertImageDecodable(p);           // fatal if it cannot decode
  });
  if (ev) assertImageDecodable(ev.path);
}

const regionFor = (treatment, dims) => {
  const tall = dims.h > dims.w * 1.25;
  if (treatment === TREATMENT.PRODUCT_PROOF) {
    return tall ? { evidence: { x: 230, y: 500, w: 620, h: 877 } } : { evidence: { x: 468, y: 120, w: 564, h: 798 } };
  }
  if (treatment === TREATMENT.PRODUCT_CTA) {
    return tall ? { evidence: { x: 260, y: 653, w: 560, h: 792 } } : { evidence: { x: 670, y: 248, w: 330, h: 467 } };
  }
  return {};
};

const ledger = { generated: new Date().toISOString(), compositor: "creative-compositor.mjs", provider_calls: 0, provider_spend_usd: 0, photography_policy: "NO_GENERIC_STOCK_PHOTO", assets: [] };

/* ------------------------------------------------------------------ statics (FB / IG feed / WhatsApp) */
function produceStatic(a) {
  const des = desOf(a);
  const t = selectTreatment(a, des);
  const f = assetDir(a);
  ensureDir(join(f, "final"));
  const scene = join(f, "raw-generated", "scene.jpg");
  const ev = (t === TREATMENT.PRODUCT_PROOF || t === TREATMENT.PRODUCT_CTA) ? evidenceFor(a) : null;
  decodeGates(a, [scene], ev);
  const blocks = desCopy(a.id);
  const ctx = {
    scene: inlineImage(scene), evidence: ev ? inlineImage(ev.path) : null, evidenceLabel: ev?.label || null,
    brandName: BRAND_NAME, trustLine: TRUST,
    headline: (pick(blocks, ["headline"]) || {}).text || "",
    support: (pick(blocks, ["supporting_line"]) || {}).text || "",
    cta: (pick(blocks, ["cta"]) || {}).text || "",
    w: SQUARE.w, h: SQUARE.h, safe: SQUARE.safe,
  };
  const out = join(f, "final", `${a.id}.png`);
  const r = shotVerified(renderCreative(t, ctx), SQUARE.w, SQUARE.h, out);
  const qa = r.ok ? checkCreative(out, t, regionFor(t, SQUARE)) : { pass: false, notes: [r.status] };
  return { asset: a.id, platform: a.platform, type: "STATIC", treatment: t, ...r, qa, final: out, headline: ctx.headline, evidence_page: ev?.page || null, dims: `${SQUARE.w}x${SQUARE.h}` };
}

/* ------------------------------------------------------------------ carousels / stories */
function produceMulti(a) {
  const des = desOf(a);
  const isStory = a.asset_type === "SOCIAL_STORY_SEQUENCE";
  const dims = isStory ? TALL : SQUARE;
  const f = assetDir(a);
  ensureDir(join(f, "final"));
  const ev = evidenceFor(a);
  const blocks = desCopy(a.id).filter((b) => b.slide != null || b.key?.match(/frame_(\d+)/) || b.key?.match(/slide_(\d+)/));
  const groups = new Map();
  for (const b of blocks) {
    const k = b.slide ?? b.key?.match(/frame_(\d+)/)?.[1] ?? b.key?.match(/slide_(\d+)/)?.[1];
    if (k == null) continue;
    if (!groups.has(Number(k))) groups.set(Number(k), []);
    groups.get(Number(k)).push(b);
  }
  const ordered = [...groups.entries()].sort((x, y) => x[0] - y[0]);
  // Approved sequences put their CTA on the final panel; when the CTA block carries no explicit
  // slide/frame key (story frame sets), attach it to the last panel rather than dropping it.
  const orphanCta = desCopy(a.id).filter((b) => b.role === "cta" && b.slide == null && !/frame_(\d+)/.test(b.key));
  if (orphanCta.length && ordered.length) ordered[ordered.length - 1][1].push(...orphanCta);
  const total = ordered.length;
  const slides = [];
  for (let idx = 0; idx < total; idx++) {
    const [n, items] = ordered[idx];
    const i = idx + 1;
    const t = slideTreatment(a, des, i, total);
    const scene = isStory ? join(f, "raw-generated", "scene.jpg") : join(f, "raw-generated", `scene-slide-${n}.jpg`);
    const needEv = t === TREATMENT.PRODUCT_PROOF || t === TREATMENT.PRODUCT_CTA;
    decodeGates(a, [scene], needEv ? ev : null);
    const ctx = {
      scene: inlineImage(scene), evidence: needEv ? inlineImage(ev.path) : null, evidenceLabel: needEv ? ev.label : null,
      brandName: BRAND_NAME, trustLine: TRUST,
      headline: (pick(items, ["headline", "subheadline"]) || items[0] || {}).text || "",
      support: (pick(items, ["supporting_line"]) || {}).text || "",
      cta: (pick(items, ["cta"]) || {}).text || "",
      w: dims.w, h: dims.h, safe: dims.safe,
      counter: { i, n: total },
      variant: i % 2 === 0 ? "cream" : "navy",
    };
    const out = join(f, "final", isStory ? `frame-${String(i).padStart(2, "0")}.png` : `slide-${String(i).padStart(2, "0")}.png`);
    const r = shotVerified(renderCreative(t, ctx), dims.w, dims.h, out, { requireCta: t === TREATMENT.PRODUCT_CTA });
    const qa = r.ok ? checkCreative(out, t, regionFor(t, dims)) : { pass: false, notes: [r.status] };
    slides.push({ slide: i, treatment: t, status: r.status, qa, final: out, headline: ctx.headline });
  }
  return { asset: a.id, platform: a.platform, type: isStory ? "STORY" : "CAROUSEL", treatment: TREATMENT.EDUCATIONAL_CAROUSEL, count: total, dims: `${dims.w}x${dims.h}`, slides };
}

/* ------------------------------------------------------------------ reel (deterministic components only) */
function produceReel(a) {
  const f = assetDir(a);
  const pkg = loadJson(`V06-Marketing-Assets/Reels/${a.id}/${a.id}.video-package.json`);
  const cover = join(f, "raw-generated", "cover.jpg");
  const ev = { page: "page-12.png", path: join(SOURCE_PAGES, "page-12.png"), label: EVIDENCE_LABEL["page-12.png"] };
  if (!existsSync(cover)) throw new Error("missing reel cover scene");
  decodeGates(a, [cover], null);   // cover is the only generated visual required for the still components
  ensureDir(join(f, "final"));

  // cover — Treatment E (outcome), 9:16
  const coverOut = join(f, "final", "cover.png");
  const coverCtx = {
    scene: inlineImage(cover), evidence: null, brandName: BRAND_NAME, trustLine: TRUST,
    headline: pkg.hook || "", support: "", cta: pkg.cta || "",
    w: TALL.w, h: TALL.h, safe: TALL.safe,
  };
  const coverRes = shotVerified(renderCreative(TREATMENT.OUTCOME, coverCtx), TALL.w, TALL.h, coverOut, { requireCta: true });

  // keyframes — Treatment C (editorial), on-screen text VERBATIM from the approved video package
  const keyframes = [];
  const texts = Array.isArray(pkg.on_screen_text) ? pkg.on_screen_text : [];
  texts.forEach((t, i) => {
    // existing convention: keyframe-<label>.png at the reel root
    const out = join(f, `keyframe-${String(t.label || i + 1).toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`);
    const ctx = {
      scene: null, evidence: null, brandName: BRAND_NAME, trustLine: TRUST,
      headline: t.text, support: "", cta: i === texts.length - 1 ? (pkg.cta || "") : "",
      w: TALL.w, h: TALL.h, safe: TALL.safe, variant: i % 2 === 0 ? "navy" : "cream",
    };
    const r = shotVerified(renderCreative(TREATMENT.EDITORIAL_QUOTE, ctx), TALL.w, TALL.h, out, { requireCta: i === texts.length - 1 });
    keyframes.push({ index: i + 1, label: t.label, status: r.status, final: out });
  });

  // storyboard — internal review artifact (cover + keyframes + real product evidence)
  const cell = (p, cap) => `<div class="cell"><div class="lab">${esc_(cap)}</div><img src="${existsSync(p) ? inlineImage(p) : ""}"></div>`;
  const sbCells = [cell(coverOut, "COVER")].concat(keyframes.map((k) => cell(k.final, `KEYFRAME ${k.index} — ${k.label}`)))
    .concat([cell(ev.path, "PRODUCT EVIDENCE — Roster")]).join("");
  const sbHtml = `<div class="wrap"><div class="row">${sbCells}</div></div>`;
  const sbOut = join(f, "final", "storyboard.png");
  const sb = shotVerified(sbHtml, 1740, 1080, sbOut, { verify: false, requireCta: false });

  return {
    asset: a.id, platform: a.platform, type: "REEL", treatment: TREATMENT.OUTCOME,
    status: "PRODUCTION_PACKAGE_READY_VIDEO_NOT_RENDERED",
    video_note: "PRODUCTION_PACKAGE_READY — VIDEO NOT YET RENDERED (no qualified video provider)",
    cover: { status: coverRes.status, final: coverOut, qa: coverRes.ok ? checkCreative(coverOut, TREATMENT.OUTCOME) : { pass: false, notes: [coverRes.status] } },
    keyframes, storyboard: { status: sb.status, final: sbOut },
    preserved: { video_prompt: `${a.id}.video-prompt.txt`, package: `${a.id}.video-package.json` },
  };
}

/* ------------------------------------------------------------------ run all 21 approved records */
const IDS = [...Array.from({ length: 16 }, (_, i) => "AST-NS-" + String(i + 1).padStart(3, "0")),
  "AST-NS-STOP-001", "AST-NS-PROB-001", "AST-NS-MYTH-001", "AST-NS-STORY-001", "AST-NS-OBJ-001"];

const results = [];
for (const id of IDS) {
  const a = asset(id);
  let r;
  if (a.asset_type === "SOCIAL_REEL") r = produceReel(a);
  else if (a.asset_type === "SOCIAL_CAROUSEL" || a.asset_type === "SOCIAL_STORY_SEQUENCE") r = produceMulti(a);
  else r = produceStatic(a);
  results.push(r);
  const label = r.type === "CAROUSEL" || r.type === "STORY"
    ? `${r.slides.filter((s) => s.status === "RENDERED").length}/${r.count} panels`
    : r.type === "REEL" ? "cover+keyframes+storyboard"
    : `${r.dims} ${r.qa?.pass ? "QA PASS" : "QA " + JSON.stringify(r.qa?.notes)}`;
  console.log(`${id.padEnd(16)} ${String(r.type).padEnd(9)} ${String(r.treatment).padEnd(2)} ${label}`);
}

ledger.assets = results;
ledger.totals = {
  approved_records: results.length,
  statics: results.filter((r) => r.type === "STATIC").length,
  carousel_sets: results.filter((r) => r.type === "CAROUSEL").length,
  carousel_slides: results.filter((r) => r.type === "CAROUSEL").reduce((n, r) => n + r.count, 0),
  story_sets: results.filter((r) => r.type === "STORY").length,
  story_frames: results.filter((r) => r.type === "STORY").reduce((n, r) => n + r.count, 0),
  reels: results.filter((r) => r.type === "REEL").length,
};
writeJson(join(OUT, "_campaign-ledger.json"), ledger);

const allSlides = results.flatMap((r) => r.slides || []);
const failedQs = allSlides.filter((s) => s.status !== "RENDERED" || !s.qa?.pass);
const staticFail = results.filter((r) => r.type === "STATIC" && (!r.ok || !r.qa?.pass));
console.log(`\nstatics RENDERED+QA: ${results.filter((r) => r.type === "STATIC" && r.ok && r.qa?.pass).length}/${results.filter((r) => r.type === "STATIC").length}`);
console.log(`panels RENDERED+QA: ${allSlides.filter((s) => s.status === "RENDERED" && s.qa?.pass).length}/${allSlides.length}`);
if (failedQs.length || staticFail.length) { console.log("FAILURES:", JSON.stringify([...staticFail, ...failedQs].map((x) => ({ a: x.asset || x.final, n: x.qa?.notes })), null, 1)); process.exitCode = 1; }
