// MAE media · deterministic Typographic/Core renderer (Media-04 §1) + IMAGE-SLOT COMPOSITOR.
// Emits a REAL .svg (no external dependency, no browser, no provider). Locked text is preserved
// verbatim — only line wrapping may change it. Rasterisation (PNG/WebP) and PDF remain
// provider/deferred modalities (see providers.js); raster is an explicit NEXT_STEP.
//
// Composition order (deterministic):
//   background (image slot OR brand surface) -> overlay/scrim -> brand bar -> headline -> body -> CTA -> logo
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { createHash } from "node:crypto";
import { MAE_DIR } from "../lib/store.js";
import { fail, CODES } from "../lib/errors.js";

export const TOKENS = { navy: "#0B1F33", purple: "#6F35B5", gold: "#D9A52E", cream: "#F8F4EC", white: "#FFFFFF", ink: "#17212B" };
export const CANVAS = {
  instagram_feed: { w: 1080, h: 1350 },
  instagram_square: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
  og: { w: 1200, h: 630 },
  cover_portrait: { w: 1200, h: 1600 },
  cover_square: { w: 1200, h: 1200 },
};
export const WORK_DIR = join(MAE_DIR, "storage", "work");
export const APPROVED_DIR = join(MAE_DIR, "storage", "approved");

export const IMAGE_FITS = ["cover", "contain"];
export const IMAGE_FOCALS = ["center", "top", "bottom", "left", "right"];
const FOCAL_XY = { center: [0.5, 0.5], top: [0.5, 0], bottom: [0.5, 1], left: [0, 0.5], right: [1, 0.5] };

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Wrap text into lines at a max char count WITHOUT altering words (locked-text safe). */
export function wrapText(text, maxChars) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    if (!line) line = w;
    else if ((line + " " + w).length <= maxChars) line += " " + w;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}

/** Canvas may be a preset key or an explicit {width,height}. */
export function resolveCanvas(canvas) {
  if (canvas && typeof canvas === "object" && canvas.width && canvas.height) return { w: canvas.width, h: canvas.height };
  return CANVAS[canvas] || CANVAS.instagram_feed;
}

/** Safe area from spec.safe_area ({top,right,bottom,left}) with the historical 96 default. */
export function resolveSafeArea(spec, canvas) {
  const s = spec.safe_area || {};
  const pad = (v, d) => (Number.isFinite(v) ? v : d);
  return { top: pad(s.top, 96), right: pad(s.right, 96), bottom: pad(s.bottom, 96), left: pad(s.left, 96) };
}

/** Slot box within the canvas. BACKGROUND (or unpositioned) = full bleed. */
export function resolveSlotBox(slot, canvas) {
  const p = slot.position;
  if (p && [p.x, p.y, p.width, p.height].every(Number.isFinite)) return { x: p.x, y: p.y, w: p.width, h: p.height };
  return { x: 0, y: 0, w: canvas.w, h: canvas.h };
}

/** Deterministic image draw box (no ML, no smart crop): fit + focal. */
export function computeImageBox(iw, ih, box, fit = "cover", focal = "center") {
  if (!Number.isFinite(iw) || !Number.isFinite(ih) || iw <= 0 || ih <= 0) fail(CODES.MISSING_FIELD, "image slot requires intrinsic width/height", { iw, ih });
  if (!IMAGE_FITS.includes(fit)) fail(CODES.VALIDATION_FAILED, `invalid fit '${fit}'`, { fit });
  if (!IMAGE_FOCALS.includes(focal)) fail(CODES.VALIDATION_FAILED, `invalid focal '${focal}'`, { focal });
  const [fx, fy] = FOCAL_XY[focal];
  const scale = fit === "cover" ? Math.max(box.w / iw, box.h / ih) : Math.min(box.w / iw, box.h / ih);
  const dw = iw * scale, dh = ih * scale;
  const x = box.x + (fx === 0 ? 0 : fx === 1 ? box.w - dw : (box.w - dw) / 2);
  const y = box.y + (fy === 0 ? 0 : fy === 1 ? box.h - dh : (box.h - dh) / 2);
  return { x: Math.round(x), y: Math.round(y), w: Math.round(dw), h: Math.round(dh), scale };
}

/** Load an image source to a deterministic data URI (local file only). No network. */
export function loadImageDataUri(source = {}) {
  if (source.data_uri) return source.data_uri;
  const uri = source.uri || source.path;
  if (!uri) fail(CODES.MISSING_FIELD, "image slot source requires a local uri", { source });
  if (/^https?:/i.test(uri)) fail(CODES.VALIDATION_FAILED, "remote image sources are not supported by the deterministic compositor", { uri });
  if (!existsSync(uri)) fail(CODES.REFERENCE_UNRESOLVED, `image fixture not found: ${uri}`, { uri });
  const mime = source.mime || (extname(uri).toLowerCase() === ".svg" ? "image/svg+xml" : extname(uri).toLowerCase() === ".png" ? "image/png" : "application/octet-stream");
  const bytes = readFileSync(uri);
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

const overlayMarkup = (overlay, canvas) => {
  if (!overlay || overlay.type === "none" || !overlay.type) return "";
  const color = overlay.color || TOKENS.navy;
  const op = Number.isFinite(overlay.opacity) ? overlay.opacity : 0.45;
  if (overlay.type === "solid") return `  <rect x="0" y="0" width="${canvas.w}" height="${canvas.h}" fill="${color}" opacity="${op}"/>\n`;
  if (overlay.type === "gradient") {
    const dir = overlay.direction || "bottom";
    let x1 = "0", y1 = "0", x2 = "0", y2 = "1";
    if (dir === "top") { y1 = "1"; y2 = "0"; }
    else if (dir === "left") { x1 = "1"; x2 = "0"; y1 = "0.5"; y2 = "0.5"; }
    else if (dir === "right") { x1 = "0"; x2 = "1"; y1 = "0.5"; y2 = "0.5"; }
    return `  <defs><linearGradient id="swt-overlay" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${color}" stop-opacity="${op}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>\n  <rect x="0" y="0" width="${canvas.w}" height="${canvas.h}" fill="url(#swt-overlay)"/>\n`;
  }
  fail(CODES.VALIDATION_FAILED, `unknown overlay type '${overlay.type}'`, { overlay });
};

const imageLayerMarkup = (slots, canvas) => {
  let defs = "";
  let body = "";
  (slots || []).forEach((slot, i) => {
    const box = resolveSlotBox(slot, canvas);
    const src = slot.source || {};
    const iw = src.width, ih = src.height;
    const draw = computeImageBox(iw, ih, box, slot.fit || "cover", slot.focal || "center");
    const id = `swt-slot-${slot.slot_id || i}`;
    const href = loadImageDataUri(src);
    const op = Number.isFinite(slot.opacity) ? slot.opacity : 1;
    defs += `    <clipPath id="${id}"><rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"/></clipPath>\n`;
    body += `  <image clip-path="url(#${id})" x="${draw.x}" y="${draw.y}" width="${draw.w}" height="${draw.h}" opacity="${op}" preserveAspectRatio="none" href="${href}"/>\n`;
  });
  return { defs: defs ? `  <defs>\n${defs}  </defs>\n` : "", body };
};

/** Render a LayoutRenderSpec (optionally image-backed) to a real SVG file. */
export function renderSvg(spec, { dir = WORK_DIR, filename } = {}) {
  const canvas = resolveCanvas(spec.canvas);
  const { w, h } = canvas;
  const sa = resolveSafeArea(spec, canvas);
  const headline = String(spec.headline || "");
  const body = String(spec.body_copy || "");
  const cta = String(spec.cta || "");
  const headlineLines = wrapText(headline, 22);
  const bodyLines = wrapText(body, 44);
  const estHeight = headlineLines.length * 92 + bodyLines.length * 44 + 200;
  const safeHeight = h - sa.top - sa.bottom;
  if (safeHeight <= 0 || estHeight > safeHeight) fail(CODES.VALIDATION_FAILED, "TEXT_OVERFLOW: layout text exceeds the safe area", { estHeight, safeHeight });

  const slots = spec.image_slots || [];
  const hasBackground = slots.some((s) => (s.role || "BACKGROUND") === "BACKGROUND");
  const img = imageLayerMarkup(slots, canvas);
  const ov = overlayMarkup(spec.overlay, canvas);

  const left = sa.left;
  const headlineY = sa.top + 120;
  const bodyY = headlineY + headlineLines.length * 92 + 40;
  const ctaY = h - sa.bottom - 96;
  const logoY = h - sa.bottom;
  const headlineTspans = headlineLines.map((ln, i) => `<tspan x="${left}" dy="${i === 0 ? 0 : 92}">${esc(ln)}</tspan>`).join("");
  const bodyTspans = bodyLines.map((ln, i) => `<tspan x="${left}" dy="${i === 0 ? 0 : 46}">${esc(ln)}</tspan>`).join("");

  const surface = hasBackground ? "" : `  <rect width="${w}" height="${h}" fill="${TOKENS.cream}"/>\n`;
  const svg =
`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
${img.defs}${surface}${img.body}${ov}  <rect x="0" y="0" width="${w}" height="14" fill="${TOKENS.gold}"/>
  <text x="${left}" y="${headlineY}" font-family="'DM Serif Display', Georgia, serif" font-size="76" font-weight="400" fill="${TOKENS.navy}">${headlineTspans}</text>
  <text x="${left}" y="${bodyY}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="34" fill="${TOKENS.ink}">${bodyTspans}</text>
  ${cta ? `<rect x="${left}" y="${ctaY}" rx="12" width="${Math.min(560, w - left - sa.right)}" height="72" fill="${TOKENS.purple}"/><text x="${left + 28}" y="${ctaY + 48}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="30" fill="${TOKENS.white}">${esc(cta)}</text>` : ""}
  <text x="${left}" y="${logoY}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="22" fill="${TOKENS.navy}" opacity="0.7">Swiipt</text>
</svg>
`;
  const checksum = createHash("sha256").update(svg).digest("hex");
  const name = filename || `graphic-${checksum.slice(0, 12)}.svg`;
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, svg);

  const approxWidth = (lines, size) => Math.round(Math.max(0, ...lines.map((l) => l.length)) * size * 0.52);
  const bounds = {
    left,
    right: left + Math.max(approxWidth(headlineLines, 76), approxWidth(bodyLines, 34), cta ? Math.round(cta.length * 30 * 0.52) : 0),
    top: sa.top,
    bottom: logoY,
  };
  return {
    storage_uri: path, mime_type: "image/svg+xml", checksum, width: w, height: h, svg,
    headline_lines: headlineLines, body_lines: bodyLines, safe_area: sa, bounds,
    image_slots: slots.map((s) => ({ slot_id: s.slot_id || null, role: s.role || "BACKGROUND", fit: s.fit || "cover", focal: s.focal || "center" })),
    has_background_image: hasBackground,
    overlay: spec.overlay || null,
  };
}

/** Extract the visible text from an SVG produced by renderSvg (for locked-text verification). */
export function svgVisibleText(svg) {
  return [...String(svg).matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((m) => m[1]).join(" ").replace(/\s+/g, " ").trim();
}

export function textMatches(svg, approvedText) {
  const visible = svgVisibleText(svg).toLowerCase();
  const approved = String(approvedText).toLowerCase().replace(/\s+/g, " ").trim();
  return visible === approved || visible.includes(approved);
}
