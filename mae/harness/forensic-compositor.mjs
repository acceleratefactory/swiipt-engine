// FORENSIC: decode PNGs and measure how much of the final canvas is flat navy vs photograph.
// Objective proof (or refutation) of the owner's "navy template suppresses the scene" finding.
import { readFileSync, existsSync } from "node:fs";
import zlib from "node:zlib";
import { join } from "node:path";

const OUT = "C:/Users/HPM6/Desktop/Transformation/Product Pipeline/V06-Marketing-Assets";

export function decodePng(path) {
  const b = readFileSync(path);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error("not png");
  let off = 8, w = 0, h = 0, bitDepth = 8, colorType = 6, idat = [];
  while (off < b.length) {
    const len = b.readUInt32BE(off);
    const type = b.toString("ascii", off + 4, off + 8);
    const data = b.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 4;
  const bpp = ch * (bitDepth / 8);
  const stride = w * bpp;
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
      else if (ft === 4) { const p = a + bb - c, pa = Math.abs(p - a), pb = Math.abs(p - bb), pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? bb : c); }
      cur[x] = v & 0xff;
    }
  }
  return { w, h, ch, data: out };
}

const NAVY = [11, 31, 51];
function analyse(path) {
  const { w, h, ch, data } = decodePng(path);
  let flatNavy = 0, photo = 0, white = 0;
  const thirds = [{ n: 0, photo: 0, navy: 0 }, { n: 0, photo: 0, navy: 0 }, { n: 0, photo: 0, navy: 0 }];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * ch;
      const r = data[i], g = data[i + 1], bl = data[i + 2];
      const isNavy = Math.abs(r - NAVY[0]) < 16 && Math.abs(g - NAVY[1]) < 16 && Math.abs(bl - NAVY[2]) < 16;
      const isWhite = r > 236 && g > 236 && bl > 236;
      const sat = Math.max(r, g, bl) - Math.min(r, g, bl);
      const isPhoto = !isNavy && !isWhite && (sat > 30 || r - bl > 22);
      const t = y < h / 3 ? 0 : y < (2 * h) / 3 ? 1 : 2;
      thirds[t].n++;
      if (isNavy) { flatNavy++; thirds[t].navy++; }
      if (isPhoto) { photo++; thirds[t].photo++; }
      if (isWhite) white++;
    }
  }
  const N = w * h;
  return {
    file: path.split(/[\\/]/).slice(-2).join("/"), w, h,
    flat_navy_pct: +(100 * flatNavy / N).toFixed(1),
    photo_pct: +(100 * photo / N).toFixed(1),
    white_card_pct: +(100 * white / N).toFixed(1),
    thirds_photo_pct: thirds.map((t) => +(100 * t.photo / t.n).toFixed(1)),
    thirds_navy_pct: thirds.map((t) => +(100 * t.navy / t.n).toFixed(1)),
  };
}

const targets = process.argv.slice(2);
const list = targets.length ? targets : [
  join(OUT, "Instagram/AST-NS-001/raw-generated/scene.jpg"),
  join(OUT, "Instagram/AST-NS-001/final/AST-NS-001.png"),
  join(OUT, "Instagram/AST-NS-MYTH-001/final/AST-NS-MYTH-001.png"),
  join(OUT, "Instagram/AST-NS-013/final/slide-01.png"),
];
for (const t of list) {
  if (!existsSync(t)) { console.log("missing:", t); continue; }
  const ext = t.toLowerCase();
  if (ext.endsWith(".jpg")) {
    // JPEG: report size only (decode via PNG analysis not applicable)
    console.log(`${t.split(/[\\/]/).slice(-2).join("/")}  [jpeg]  ${Math.round(readFileSync(t).length / 1024)}KB`);
    continue;
  }
  console.log(JSON.stringify(analyse(t)));
}
