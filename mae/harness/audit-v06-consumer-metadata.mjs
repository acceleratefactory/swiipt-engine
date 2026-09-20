// §24 CUSTOMER-FACING METADATA AUDIT.
// Audits the RENDERED TEXT LAYER of every final creative (the *.src.html documents contain the
// exact text that reached the image) — not filenames, which are allowed to carry asset ids.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const OUT = "V06-Marketing-Assets";
const PLATFORMS = ["Facebook", "Instagram", "WhatsApp", "Reels", "Organic-Media"];

const FORBIDDEN = [
  { re: /\bPPL-[A-Z0-9-]+/g, what: "product id" },
  { re: /\bAST-[A-Z0-9-]+/g, what: "asset id" },
  { re: /\bANG-[A-Z0-9-]+/g, what: "angle id" },
  { re: /\bDES-[A-Z0-9-]+/g, what: "design-spec id" },
  { re: /\bTR-PPL[A-Z0-9-]*/g, what: "transformation id" },
  { re: /\bBRIEF-[A-Z0-9-]+/g, what: "brief id" },
  { re: /\bGEN-[A-Z0-9-]+/g, what: "generation id" },
  { re: /\bQA-[A-Z0-9-]+/g, what: "qa id" },
  { re: /\bLPS-[A-Z0-9-]+/g, what: "phrase-set id" },
  { re: /\bVID-[A-Z0-9-]+/g, what: "video id" },
  { re: /\bVG-[A-Z0-9-]+/g, what: "grounding id" },
  { re: /Real system page/gi, what: "internal QA label" },
  { re: /\bFACEBOOK\b|\bINSTAGRAM\b|\bWHATSAPP\b/g, what: "platform label on creative" },
];

/** Extract the visible text layer: drop script/style, drop data: URIs, strip tags, collapse. */
function textLayer(html) {
  let t = html.replace(/<script[\s\S]*?<\/script>/gi, " ");
  t = t.replace(/<style[\s\S]*?<\/style>/gi, " ");
  t = t.replace(/src="data:[^"]*"/gi, " ");
  t = t.replace(/<[^>]*>/g, " ");
  return t.replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}

const findings = [];
let audited = 0;

function audit(file) {
  if (!existsSync(file)) return;
  const html = readFileSync(file, "utf8");
  const text = textLayer(html);
  audited++;
  for (const { re, what } of FORBIDDEN) {
    const hits = text.match(re);
    if (hits) findings.push({ file: file.replace(OUT + "\\", "").replace(OUT + "/", ""), what, hits: [...new Set(hits)].slice(0, 5) });
  }
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith(".src.html")) out.push(p);
  }
  return out;
}
for (const p of PLATFORMS) {
  for (const f of walk(join(OUT, p))) audit(f);
}

console.log(`consumer creatives audited: ${audited}`);
if (findings.length === 0) console.log("RESULT: PASS — zero internal identifiers / platform labels in the rendered creative text layer");
else {
  console.log("RESULT: FAIL");
  for (const f of findings) console.log(" ", f.file, "|", f.what, "|", f.hits.join(", "));
  process.exitCode = 1;
}
