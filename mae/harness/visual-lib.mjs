// V06 VISUAL PRODUCTION — image route client + deterministic compositor.
//
// Uses ONLY the existing qualified/free image-production route (9Router → antigravity
// `ag/gemini-3.1-flash-image`) at $0. No provider architecture changes, no paid APIs.
// Final creative = generated scene + real corrected V06 product evidence + deterministic
// approved typography + SWIIPT brand composition (rendered via headless Edge).
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, "../..");
export const OUT = join(ROOT, "V06-Marketing-Assets");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const FONTS = join(ROOT, "specs/V06/pdf design fix/swiipt-ebook-design-skill/swiipt-ebook-design/reference/fonts").replace(/\\/g, "/");

export const IMAGE_BASE = "http://127.0.0.1:20128";
export const IMAGE_MODEL = "ag/gemini-3.1-flash-image";
export const SOURCE_PAGES = "C:\\Users\\HPM6\\AppData\\Local\\Temp\\opencode\\v06-pages";

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
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
export const FAMILY_VGB = {
  "FAM-NS-001": "VG-NS-STOP-001", "FAM-NS-002": "VG-NS-PROB-001", "FAM-NS-003": "VG-NS-MYTH-001",
  "FAM-NS-004": "VG-NS-STORY-001", "FAM-NS-005": "VG-NS-OBJ-001",
};
// Real corrected V06 product page chosen as evidence, per asset (from the 8 real page renders).
export const EVIDENCE_PAGE = {
  "AST-NS-001": "page-08.png", "AST-NS-002": "page-08.png", "AST-NS-003": "page-19.png", "AST-NS-004": "page-06.png",
  "AST-NS-005": "page-06.png", "AST-NS-006": "page-12.png", "AST-NS-008": "page-08.png", "AST-NS-009": "page-08.png",
  "AST-NS-010": "page-12.png", "AST-NS-011": "page-19.png", "AST-NS-012": "page-19.png", "AST-NS-013": "page-12.png",
  "AST-NS-014": "page-18.png", "AST-NS-015": "page-18.png", "AST-NS-016": "page-18.png",
  "AST-NS-STOP-001": "page-03.png", "AST-NS-PROB-001": "page-06.png", "AST-NS-MYTH-001": "page-08.png",
  "AST-NS-STORY-001": "page-12.png", "AST-NS-OBJ-001": "page-19.png", "AST-NS-007": "page-12.png",
};
export const EVIDENCE_LABEL = {
  "page-03.png": "The complete Contents — 12 modules, one system",
  "page-06.png": "The Read — why unstructured nights break down",
  "page-08.png": "The Decision Tree — route to your roster",
  "page-12.png": "Roster C — support-web shift agreement",
  "page-14.png": "The Script Cards — exact words for hard moments",
  "page-18.png": "The Fridge Shift Chart — tonight's wall plan",
  "page-19.png": "The 14-Day Shift Tracker — log real performance",
  "page-20.png": "The Rescue Card — bad-night protocol",
};

// ---- the ONE free image route -------------------------------------------------
export async function generateImage(prompt, { timeoutMs = 180000, key = process.env.NINEROUTER_API_KEY } = {}) {
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${IMAGE_BASE}/v1/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: IMAGE_MODEL, prompt, n: 1, size: "1024x1024" }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const txt = await res.text();
    if (res.status !== 200) return { ok: false, status: `HTTP_${res.status}`, error: txt.slice(0, 300), ms: Date.now() - t0 };
    const j = JSON.parse(txt);
    const b64 = j?.data?.[0]?.b64_json;
    if (!b64) return { ok: false, status: "NO_IMAGE_IN_RESPONSE", error: txt.slice(0, 200), ms: Date.now() - t0 };
    const bytes = Buffer.from(b64, "base64");
    const mime = bytes[0] === 0xff && bytes[1] === 0xd8 ? "image/jpeg" : bytes.slice(0, 8).toString("hex") === "89504e470d0a1a0a" ? "image/png" : "unknown";
    return { ok: true, status: "PROVIDER_SUCCESS", bytes, mime, ms: Date.now() - t0, model: IMAGE_MODEL };
  } catch (e) {
    return { ok: false, status: "PROVIDER_ATTEMPT_FAILED", error: String(e.message || e).slice(0, 200), ms: Date.now() - t0 };
  }
}

/** Build the exact scene prompt for an asset from its approved Visual Grounding Block
 *  (the same content archived in Prompts/Images/<asset>.txt — no new angle, no invented claim). */
export function scenePrompt(a) {
  const vgb = loadJson(`mae/data/visual-groundings/${FAMILY_VGB[a.family_id]}.json`);
  const parts = [];
  parts.push(vgb.subject);
  if (vgb.wardrobe) parts.push(`Wardrobe: ${vgb.wardrobe}.`);
  if (vgb.gesture_posture) parts.push(`Posture: ${vgb.gesture_posture}.`);
  parts.push(vgb.environment);
  if (vgb.props?.length) parts.push(`Props: ${vgb.props.join("; ")}.`);
  parts.push(`Lighting: ${vgb.lighting}.`);
  parts.push(`Composition: ${vgb.composition}.`);
  if (vgb.cultural_markers?.length) parts.push(`Cultural context: ${vgb.cultural_markers.join("; ")}.`);
  if (vgb.emotional_tone) parts.push(`Mood: ${vgb.emotional_tone}.`);
  parts.push("Documentary-style editorial photography, natural realistic skin texture, unposed, candid, shallow depth of field, no text, no logos, no watermarks, no user interface.");
  const neg = (vgb.exclusions || []).join("; ");
  if (neg) parts.push(`Avoid: ${neg}.`);
  return parts.join(" ");
}

export function pngDims(p) {
  const b = readFileSync(p);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG: " + p);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), bytes: b.length };
}

const FONT_FACE = `
@font-face{font-family:'Inter';font-weight:400;src:url('file:///${FONTS}/Inter-Regular.ttf');}
@font-face{font-family:'Inter';font-weight:500;src:url('file:///${FONTS}/Inter-Medium.ttf');}
@font-face{font-family:'Inter';font-weight:600;src:url('file:///${FONTS}/Inter-SemiBold.ttf');}
@font-face{font-family:'Inter';font-weight:700;src:url('file:///${FONTS}/Inter-Bold.ttf');}
@font-face{font-family:'DM Serif Display';font-weight:400;src:url('file:///${FONTS}/DMSerifDisplay-Regular.ttf');}`;

export function shot(html, w, h, outPng) {
  const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${FONT_FACE}html,body{margin:0;padding:0}*{box-sizing:border-box}</style></head><body>${html}</body></html>`;
  const hp = outPng.replace(/\.png$/, ".src.html");
  writeText(hp, doc);
  execFileSync(EDGE, ["--headless", "--disable-gpu", "--hide-scrollbars", `--screenshot=${outPng}`, `--window-size=${w},${h}`, hp], { timeout: 120000 });
  return pngDims(outPng);
}

export { readJson };
