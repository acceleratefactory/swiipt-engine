// Authority-document pixel analysis (substitute for human visual inspection):
// verifies the EXACT colours actually drawn on the rendered PDF pages, their bounding
// boxes (layout), and the presence/arrangement of the Transformation Mark variants.
import fs from "node:fs";
import { join } from "node:path";
import { decodePng } from "./png-decode.mjs";

const DIR = "C:/Users/HPM6/Desktop/Transformation/Task/authority-pages";

const TOKENS = {
  "Navy #0B1F33": [11, 31, 51],
  "Purple #6F35B5": [111, 53, 181],
  "Gold #D9A52E": [217, 165, 46],
  "Blush #F3C7D2": [243, 199, 210],
  "Warm #F8F4EC": [248, 244, 236],
  "Soft #F4F6F8": [244, 246, 248],
  "Success #18794E": [24, 121, 78],
  "Warning #A15C00": [161, 92, 0],
  "Error #B42318": [180, 35, 24],
  "Info #1769AA": [23, 105, 170],
  "Ink #17212B": [23, 33, 43],
  "Muted #7B8794": [123, 135, 148],
};
const TOL = 6; // tight: we are testing EXACT drawn values

function analyse(file) {
  const { w, h, ch, data } = decodePng(file);
  const N = w * h;
  // exact-match counts + bounding boxes per token
  const hits = {};
  for (const k of Object.keys(TOKENS)) hits[k] = { n: 0, x0: 1e9, y0: 1e9, x1: -1, y1: -1 };
  const hist = new Map();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * ch;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      hist.set(key, (hist.get(key) || 0) + 1);
      for (const [k, t] of Object.entries(TOKENS)) {
        if (Math.abs(r - t[0]) <= TOL && Math.abs(g - t[1]) <= TOL && Math.abs(b - t[2]) <= TOL) {
          const o = hits[k];
          o.n++;
          if (x < o.x0) o.x0 = x; if (y < o.y0) o.y0 = y;
          if (x > o.x1) o.x1 = x; if (y > o.y1) o.y1 = y;
        }
      }
    }
  }
  const top = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => {
    const r = ((k >> 10) & 31) << 3, g = ((k >> 5) & 31) << 3, b = (k & 31) << 3;
    return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")} ${(100 * n / N).toFixed(1)}%`;
  });
  console.log(`\n--- ${file.split("/").pop()}  ${w}x${h} ---`);
  console.log("  dominant: " + top.join(" | "));
  for (const [k, o] of Object.entries(hits)) {
    if (o.n === 0) { console.log(`  ${k.padEnd(16)} ABSENT`); continue; }
    const pct = (100 * o.n / N).toFixed(3);
    console.log(`  ${k.padEnd(16)} n=${String(o.n).padStart(7)} ${String(pct).padStart(7)}%  bbox x[${o.x0}-${o.x1}] y[${o.y0}-${o.y1}]`);
  }
  return { w, h, hits };
}

const files = process.argv.slice(2);
for (const f of files) analyse(join(DIR, f));
