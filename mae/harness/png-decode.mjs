// Reusable PNG decode + region statistics for objective compositor checks.
// Pure JS (zlib inflate + PNG unfilter). No new QA architecture — a pixel reader the
// compositor boundary uses to prove a required visual actually made it into the output.
import { readFileSync } from "node:fs";
import zlib from "node:zlib";

export const NAVY = [11, 31, 51];

export function decodePng(path) {
  const b = readFileSync(path);
  const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!b.subarray(0, 8).equals(SIG)) throw new Error("not a PNG: " + path);
  let off = 8, w = 0, h = 0, bitDepth = 8, colorType = 6;
  const idat = [];
  while (off < b.length) {
    const len = b.readUInt32BE(off);
    const type = b.toString("ascii", off + 4, off + 8);
    const data = b.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 4;
  const bpp = ch * (bitDepth / 8);
  const stride = w * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(h * stride);
  let pos = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[pos++];
    const line = raw.subarray(pos, pos + stride); pos += stride;
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const bb = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (ft === 1) v += a;
      else if (ft === 2) v += bb;
      else if (ft === 3) v += (a + bb) >> 1;
      else if (ft === 4) {
        const p = a + bb - c, pa = Math.abs(p - a), pb = Math.abs(p - bb), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? bb : c);
      }
      cur[x] = v & 0xff;
    }
  }
  return { w, h, ch, data: out };
}

const isNavy = (r, g, b) => Math.abs(r - NAVY[0]) < 16 && Math.abs(g - NAVY[1]) < 16 && Math.abs(b - NAVY[2]) < 16;
const isWhite = (r, g, b) => r > 236 && g > 236 && b > 236;
const isCream = (r, g, b) => r > 236 && g > 230 && b > 216 && r - b < 32;
// "rich" = saturated colour (warm/photo light). MUST exclude the navy brand field, which is
// itself a saturated blue (sat 40) and would otherwise be miscounted as photographic colour.
const isRich = (r, g, b) => !isNavy(r, g, b) && !isWhite(r, g, b) && !isCream(r, g, b) && (r - b > 22 || Math.max(r, g, b) - Math.min(r, g, b) > 30);
// "non-flat" = anything that is neither the navy brand field nor a near-white/cream panel.
// This is the robust signal that a photograph (even a very dark one) occupies the region.
const isNonFlat = (r, g, b) => !isNavy(r, g, b) && !isWhite(r, g, b) && !isCream(r, g, b);

/** Whole-canvas + optional region statistics. All values are percentages (0-100) or raw. */
export function stats(path, regions = {}) {
  const { w, h, ch, data } = decodePng(path);
  const N = w * h;
  let navy = 0, white = 0, cream = 0, rich = 0, nonflat = 0;
  const band = [{ n: 0, rich: 0, navy: 0, nf: 0 }, { n: 0, rich: 0, navy: 0, nf: 0 }, { n: 0, rich: 0, navy: 0, nf: 0 }];
  const reg = {};
  for (const [k, r] of Object.entries(regions)) reg[k] = { n: 0, rich: 0, navy: 0, nf: 0, sum: 0, sum2: 0 };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * ch;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const nav = isNavy(r, g, b);
      const wh = isWhite(r, g, b);
      const cr = isCream(r, g, b);
      const rc = isRich(r, g, b);
      const nf = isNonFlat(r, g, b);
      if (nav) navy++;
      if (wh) white++;
      if (cr) cream++;
      if (rc) rich++;
      if (nf) nonflat++;
      const t = y < h / 3 ? 0 : y < (2 * h) / 3 ? 1 : 2;
      band[t].n++;
      if (rc) band[t].rich++;
      if (nav) band[t].navy++;
      if (nf) band[t].nf++;
      for (const [k, rr] of Object.entries(regions)) {
        if (x >= rr.x && x < rr.x + rr.w && y >= rr.y && y < rr.y + rr.h) {
          const s = reg[k];
          s.n++;
          if (rc) s.rich++;
          if (nav) s.navy++;
          if (nf) s.nf++;
          const luma = 0.299 * r + 0.587 * g + 0.114 * b;
          s.sum += luma; s.sum2 += luma * luma;
        }
      }
    }
  }
  const pct = (n, d) => +(100 * n / (d || 1)).toFixed(1);
  const out = {
    w, h,
    flat_navy_pct: pct(navy, N),
    white_pct: pct(white, N),
    cream_pct: pct(cream, N),
    rich_pct: pct(rich, N),
    nonflat_pct: pct(nonflat, N),
    third_rich_pct: band.map((t) => pct(t.rich, t.n)),
    third_navy_pct: band.map((t) => pct(t.navy, t.n)),
    third_nonflat_pct: band.map((t) => pct(t.nf, t.n)),
  };
  out.regions = {};
  for (const [k, s] of Object.entries(reg)) {
    const mean = s.n ? s.sum / s.n : 0;
    const varc = s.n ? Math.max(0, s.sum2 / s.n - mean * mean) : 0;
    out.regions[k] = {
      rich_pct: pct(s.rich, s.n),
      navy_pct: pct(s.navy, s.n),
      nonflat_pct: pct(s.nf, s.n),
      luma_stddev: +Math.sqrt(varc).toFixed(2),
    };
  }
  return out;
}
