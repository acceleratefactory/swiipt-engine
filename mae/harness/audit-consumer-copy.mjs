import fs from "node:fs";
import { join } from "node:path";
const F = "V06-Marketing-Assets/FINAL";
function walk(d, out = []) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); e.isDirectory() ? walk(p, out) : out.push(p); } return out; }
const files = walk(F);
const PUBLIC = /(CAPTION|CAPTIONS|POSTS|MESSAGES|STORY-COPY|TITLE|DESCRIPTION|SUBJECT|PREHEADER|BODY|CTA|PINNED-COMMENT)\.txt$/;
const FORBIDDEN = [
  [/\bPPL-[A-Z0-9-]+/, "product id"], [/\bAST-[A-Z0-9-]+/, "asset id"], [/\bANG-[A-Z0-9-]+/, "angle id"],
  [/\bDES-[A-Z0-9-]+/, "design id"], [/\bTR-PPL[A-Z0-9-]*/, "transformation id"], [/\bBRIEF-[A-Z0-9-]+/, "brief id"],
  [/\bGEN-[A-Z0-9-]+/, "generation id"], [/\bQA-[A-Z0-9-]+/, "qa id"], [/\bVG-[A-Z0-9-]+/, "grounding id"],
  [/\bVID-[A-Z0-9-]+/, "video id"], [/Real system page/, "internal QA label"],
  [/\bFACEBOOK\b|\bINSTAGRAM\b|\bWHATSAPP\b|\bYOUTUBE\b|\bTIKTOK\b|\bPINTEREST\b/, "platform label in copy"],
];
// Strip production structure: banner rules, standalone asset-id labels, and "… — PLATFORM" headers.
function publishableText(s) {
  return s.split(/\r?\n/)
    .filter((ln) => !/^[=\-]{6,}$/.test(ln.trim()))
    .filter((ln) => !/^AST-[A-Z0-9-]+\s*$/.test(ln.trim()))
    .filter((ln) => !/^(APPROVED PUBLISHING COPY|EXACT IMAGE-GENERATION PROMPTS|SAFETY|CTA|TITLE|SITUATION|FORMAT|MASTER|NARRATION)\b/.test(ln.trim()))
    .join("\n");
}
const hits = []; let n = 0;
for (const f of files.filter((x) => PUBLIC.test(x))) {
  n++;
  const s = publishableText(fs.readFileSync(f, "utf8"));
  for (const [re, what] of FORBIDDEN) { const m = s.match(re); if (m) hits.push(`${f.replace(/\\/g, "/").replace("V06-Marketing-Assets/FINAL/", "")} <- ${what}: ${[...new Set(m)].slice(0, 3).join(", ")}`); }
}
console.log(`consumer-facing copy files audited: ${n}`);
console.log(hits.length ? "FAIL:\n  " + hits.join("\n  ") : "RESULT: PASS — zero internal identifiers / platform labels in the publishable copy");
if (hits.length) process.exitCode = 1;
