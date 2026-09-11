// MAE media · deterministic Typographic/Core renderer (Media-04 §1). Emits a REAL .svg artifact
// (no external dependency). Locked text is preserved verbatim — only line wrapping may change it.
// Rasterisation (PNG/WebP) and PDF are provider/deferred modalities (see providers.js).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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

/** Render a LayoutRenderSpec to a real SVG file. Returns artifact metadata + the SVG. */
export function renderSvg(spec, { dir = WORK_DIR, filename } = {}) {
  const canvas = CANVAS[spec.canvas] || CANVAS.instagram_feed;
  const { w, h } = canvas;
  const pad = 96;
  const headline = String(spec.headline || "");
  const body = String(spec.body_copy || "");
  const cta = String(spec.cta || "");
  const headlineLines = wrapText(headline, 22);
  const bodyLines = wrapText(body, 44);
  const estHeight = headlineLines.length * 92 + bodyLines.length * 44 + 200;
  if (estHeight > h - 2 * pad) fail(CODES.VALIDATION_FAILED, "TEXT_OVERFLOW: layout text exceeds the safe area", { estHeight, safeHeight: h - 2 * pad });

  const headlineTspans = headlineLines.map((ln, i) => `<tspan x="${pad}" dy="${i === 0 ? 0 : 92}">${esc(ln)}</tspan>`).join("");
  const bodyTspans = bodyLines.map((ln, i) => `<tspan x="${pad}" dy="${i === 0 ? 0 : 46}">${esc(ln)}</tspan>`).join("");
  const svg =
`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${TOKENS.cream}"/>
  <rect x="0" y="0" width="${w}" height="14" fill="${TOKENS.gold}"/>
  <text x="${pad}" y="${pad + 120}" font-family="'DM Serif Display', Georgia, serif" font-size="76" font-weight="400" fill="${TOKENS.navy}">${headlineTspans}</text>
  <text x="${pad}" y="${pad + 120 + headlineLines.length * 92 + 40}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="34" fill="${TOKENS.ink}">${bodyTspans}</text>
  ${cta ? `<rect x="${pad}" y="${h - pad - 96}" rx="12" width="${Math.min(560, w - 2 * pad)}" height="72" fill="${TOKENS.purple}"/><text x="${pad + 28}" y="${h - pad - 48}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="30" fill="${TOKENS.white}">${esc(cta)}</text>` : ""}
  <text x="${pad}" y="${h - 40}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="22" fill="${TOKENS.navy}" opacity="0.7">Swiipt</text>
</svg>
`;
  const checksum = createHash("sha256").update(svg).digest("hex");
  const name = filename || `graphic-${checksum.slice(0, 12)}.svg`;
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, svg);
  return { storage_uri: path, mime_type: "image/svg+xml", checksum, width: w, height: h, svg, headline_lines: headlineLines };
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
