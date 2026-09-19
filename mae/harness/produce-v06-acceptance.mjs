// ACCEPTANCE GATE — render ONLY the three representative V06 assets through the corrected
// reusable compositor. No other asset is regenerated (Task §12/§18).
//
//   AST-NS-001  -> Treatment A  EMOTIONAL / PROBLEM HOOK        (photo dominant)
//   AST-NS-014  -> Treatment B  PRODUCT / MECHANISM PROOF       (real Fridge Shift Chart dominant)
//   AST-NS-013  -> Treatment D  EDUCATIONAL CAROUSEL            (per-slide A/C/B/C/F variation)
//
// Writes V06-Marketing-Assets/Creative-Acceptance/ with raw-scene | previous-final | corrected-final.
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import {
  OUT, ROOT, loadJson, ensureDir, writeJson, writeText,
  DES_FOR_ASSET, EVIDENCE_PAGE, EVIDENCE_LABEL, SOURCE_PAGES,
} from "./visual-lib.mjs";
import {
  TREATMENT, selectTreatment, slideTreatment, renderCreative, shotVerified, checkCreative,
  fileUrl, inlineImage, assertImageDecodable, esc,
} from "./creative-compositor.mjs";

// Required visual inputs are decoded in Node BEFORE any render (Task §9): a missing or
// undecodable scene / product artifact is a RENDER FAILURE, never a silent placeholder.
const decodeGate = (label, p) => {
  const r = assertImageDecodable(p);
  console.log(`   decoded ${label}: ${r.mime} ${r.dims.width}x${r.dims.height} ${Math.round(r.bytes / 1024)}KB`);
  return r;
};

const ACC = join(OUT, "Creative-Acceptance");
const PLATDIR = { facebook: "Facebook", instagram: "Instagram", whatsapp: "WhatsApp" };
const assetDir = (a, sub = "") => {
  const base = join(OUT, PLATDIR[a.platform] || "Instagram", a.id);
  return sub ? join(base, sub) : base;
};

const ROLE_NORM = { primary_headline: "headline", secondary_headline: "subheadline", body_text: "supporting_line", call_to_action: "cta" };
function desCopy(id) {
  const des = DES_FOR_ASSET[id];
  if (!des) return [];
  const d = loadJson(`mae/data/design-specs/${des}.json`);
  const cb = d.copy_blocks || {};
  return Object.entries(cb).map(([k, v]) => ({ key: k, slide: v.slide, role: ROLE_NORM[v.role] || v.role, text: v.text }));
}
const pick = (b, roles) => b.find((x) => roles.includes(x.role));
const productLabel = (a) => {
  try { return loadJson(`data/products/${a.product_id}/product.json`).title || a.product_id; }
  catch { return "Every Night, Just Me"; }
};
const platformName = (a) => (a.platform === "facebook" ? "Facebook" : a.platform === "whatsapp" ? "WhatsApp" : "Instagram");

const ledger = { generated: new Date().toISOString(), provider_calls: 0, provider_spend_usd: 0, videos: [], assets: [] };

/* ------------------------------------------------------------------ 1. AST-NS-001 (Treatment A) */
async function acceptance1() {
  const a = loadJson("mae/data/assets/AST-NS-001.json");
  const des = loadJson(`mae/data/design-specs/${DES_FOR_ASSET[a.id]}.json`);
  const t = selectTreatment(a, des);
  const f = assetDir(a);
  const scene = join(f, "raw-generated", "scene.jpg");
  if (!existsSync(scene)) throw new Error("missing scene " + scene);
  decodeGate("scene", scene);
  const blocks = desCopy(a.id);
  const dir = join(ACC, a.id);
  ensureDir(dir);
  const ctx = {
    scene: inlineImage(scene), evidence: null,
    eyebrow: `${platformName(a)} · ${productLabel(a)}`,
    headline: (pick(blocks, ["headline"]) || {}).text || "",
    support: (pick(blocks, ["supporting_line"]) || {}).text || "",
    cta: (pick(blocks, ["cta"]) || {}).text || "",
    width: 1080, height: 1080,
  };
  const out = join(dir, "corrected-final.png");
  const r = shotVerified(renderCreative(t, ctx), 1080, 1080, out);
  copyFileSync(scene, join(dir, "raw-scene.jpg"));
  copyFileSync(join(f, "final", `${a.id}.png`), join(dir, "previous-final.png"));
  const qa = r.ok ? checkCreative(out, t) : { pass: false, notes: [r.status] };
  return { asset: a.id, treatment: t, treatment_name: "EMOTIONAL_HOOK", ...r, qa, out, headline: ctx.headline, support: ctx.support, cta: ctx.cta };
}

/* ------------------------------------------------------------------ 2. AST-NS-014 (Treatment B) */
async function acceptance2() {
  const a = loadJson("mae/data/assets/AST-NS-014.json");
  const des = loadJson(`mae/data/design-specs/${DES_FOR_ASSET[a.id]}.json`);
  const t = selectTreatment(a, des);
  const f = assetDir(a);
  const scene = join(f, "raw-generated", "scene.jpg");
  const page = EVIDENCE_PAGE[a.id];
  const evidence = join(SOURCE_PAGES, page);
  if (!existsSync(scene)) throw new Error("missing scene " + scene);
  if (!existsSync(evidence)) throw new Error("missing evidence " + evidence);
  decodeGate("scene", scene);
  decodeGate("product evidence " + page, evidence);
  const blocks = desCopy(a.id);
  const dir = join(ACC, "PRODUCT-PROOF");
  ensureDir(dir);
  const ctx = {
    scene: inlineImage(scene), evidence: inlineImage(evidence), evidenceLabel: EVIDENCE_LABEL[page],
    eyebrow: `${platformName(a)} · ${productLabel(a)}`,
    headline: (pick(blocks, ["headline"]) || {}).text || "",
    support: (pick(blocks, ["supporting_line"]) || {}).text || "",
    cta: (pick(blocks, ["cta"]) || {}).text || "",
    width: 1080, height: 1080,
  };
  const out = join(dir, "corrected-final.png");
  const r = shotVerified(renderCreative(t, ctx), 1080, 1080, out);
  copyFileSync(scene, join(dir, "raw-scene.jpg"));
  copyFileSync(evidence, join(dir, "product-evidence.png"));
  copyFileSync(join(f, "final", `${a.id}.png`), join(dir, "previous-final.png"));
  const qa = r.ok ? checkCreative(out, t, { evidence: { x: 452, y: 132, w: 564, h: 792 } }) : { pass: false, notes: [r.status] };
  return { asset: a.id, treatment: t, treatment_name: "PRODUCT_PROOF", evidence_page: page, ...r, qa, out, headline: ctx.headline, support: ctx.support, cta: ctx.cta };
}

/* ------------------------------------------------------------------ 3. AST-NS-013 (Treatment D) */
async function acceptance3() {
  const a = loadJson("mae/data/assets/AST-NS-013.json");
  const des = loadJson(`mae/data/design-specs/${DES_FOR_ASSET[a.id]}.json`);
  const f = assetDir(a);
  const page = EVIDENCE_PAGE[a.id];
  const evidence = join(SOURCE_PAGES, page);
  const blocks = desCopy(a.id);
  const total = des.carousel_config?.total_slides || 5;
  const dir = join(ACC, "CAROUSEL");
  ensureDir(join(dir, "previous")); ensureDir(join(dir, "corrected"));
  const slides = [];
  for (let i = 1; i <= total; i++) {
    const items = blocks.filter((b) => b.slide === i);
    const t = slideTreatment(a, des, i, total);
    const scene = join(f, "raw-generated", `scene-slide-${i}.jpg`);
    if (!existsSync(scene)) throw new Error("missing scene " + scene);
    const head = (pick(items, ["headline", "subheadline"]) || items[0] || {}).text || "";
    const sup = (pick(items, ["supporting_line"]) || {}).text || "";
    const cta = (pick(items, ["cta"]) || {}).text || "";
    const needEvidence = t === TREATMENT.PRODUCT_PROOF || t === TREATMENT.PRODUCT_CTA;
    decodeGate(`slide ${i} scene`, scene);
    if (needEvidence) decodeGate(`slide ${i} product evidence ${page}`, evidence);
    const ctx = {
      scene: inlineImage(scene),
      evidence: needEvidence ? inlineImage(evidence) : null,
      evidenceLabel: needEvidence ? EVIDENCE_LABEL[page] : null,
      eyebrow: `${platformName(a)} Carousel · ${productLabel(a)}`,
      headline: head, support: sup, cta,
      width: 1080, height: 1080,
      counter: { i, n: total },
      variant: i % 2 === 0 ? "cream" : "navy",
    };
    const out = join(dir, "corrected", `slide-${String(i).padStart(2, "0")}.png`);
    // CTA is only required on the carousel's conversion slide — not on hook/editorial/proof slides.
    const r = shotVerified(renderCreative(t, ctx), 1080, 1080, out, { requireCta: t === TREATMENT.PRODUCT_CTA });
    const prev = join(f, "final", `slide-${String(i).padStart(2, "0")}.png`);
    if (existsSync(prev)) copyFileSync(prev, join(dir, "previous", `slide-${String(i).padStart(2, "0")}.png`));
    copyFileSync(scene, join(dir, "corrected", `slide-${String(i).padStart(2, "0")}.raw-scene.jpg`));
    const qa = r.ok ? checkCreative(out, t, needEvidence ? { evidence: { x: 452, y: 132, w: 564, h: 792 } } : {}) : { pass: false, notes: [r.status] };
    slides.push({ slide: i, treatment: t, ...r, qa, out, headline: head, support: sup, cta });
  }
  return { asset: a.id, treatment: TREATMENT.EDUCATIONAL_CAROUSEL, treatment_name: "EDUCATIONAL_CAROUSEL", slide_count: total, slides };
}

/* ------------------------------------------------------------------ contact sheet */
function contactSheet() {
  const dir = join(ACC, "CAROUSEL");
  const cell = (which, i) => {
    const p = join(dir, which, `slide-${String(i).padStart(2, "0")}.png`);
    const src = existsSync(p) ? inlineImage(p) : "";
    return `<div class="cell"><div class="lab">${which === "corrected" ? "CORRECTED" : "PREVIOUS"} · SLIDE ${i}</div>${src ? `<img src="${src}">` : `<div class="missing">not rendered</div>`}</div>`;
  };
  const rows = [1, 2, 3, 4, 5];
  const html = `<div class="wrap"><div class="row">${rows.map((i) => cell("previous", i)).join("")}</div><div class="row">${rows.map((i) => cell("corrected", i)).join("")}</div></div>`;
  const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#0B1F33;font-family:Inter,Arial,sans-serif;padding:20px}
.wrap{width:1580px}.row{display:flex;gap:16px;margin-bottom:18px}
.cell{width:300px}.lab{color:#D9A52E;font-size:13px;font-weight:700;letter-spacing:.08em;margin-bottom:6px}
.cell img{width:300px;height:300px;object-fit:contain;background:#000;border:1px solid #33475e}
.missing{width:300px;height:300px;display:flex;align-items:center;justify-content:center;color:#8FA4BB;border:1px dashed #33475e}
</style></head><body>${html}</body></html>`;
  const out = join(dir, "contact-sheet.png");
  // Slides are already independently verified; this is a review sheet, so dims-only.
  const r = shotVerified(html, 1620, 700, out, { verify: false });
  return { ok: r.ok, status: r.status, out, dims: r.dims || null };
}

/* ------------------------------------------------------------------ main */
const a1 = await acceptance1();
console.log("1.", a1.asset, a1.treatment, a1.status, a1.dims ? `${a1.dims.width}x${a1.dims.height}` : "", a1.qa.pass ? "QA PASS" : "QA " + JSON.stringify(a1.qa.notes));
const a2 = await acceptance2();
console.log("2.", a2.asset, a2.treatment, a2.status, a2.dims ? `${a2.dims.width}x${a2.dims.height}` : "", a2.qa.pass ? "QA PASS" : "QA " + JSON.stringify(a2.qa.notes));
const a3 = await acceptance3();
console.log("3.", a3.asset, a3.treatment, `${a3.slides.filter((s) => s.status === "RENDERED").length}/${a3.slide_count} slides rendered`, a3.slides.every((s) => s.qa.pass) ? "QA PASS" : "QA " + JSON.stringify(a3.slides.map((s) => s.qa.notes)));
const cs = contactSheet();
console.log("contact sheet:", cs.status);

ledger.assets = [a1, a2, a3];
ledger.contact_sheet = cs;
writeJson(join(ACC, "acceptance-ledger.json"), ledger);
