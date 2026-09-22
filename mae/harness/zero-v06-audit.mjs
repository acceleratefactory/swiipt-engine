// ZERO-V06-DEPENDENCY AUDIT (Task §61) + ZERO PRODUCT-ID BRANCH TEST (Task §62).
//
// Scans the GENERIC reusable production path for V06 assumptions. V06 strings are legitimate in
// V06 data/fixtures/outputs/regression-tests/reports; they must NOT be required assumptions inside
// the generic renderer / compositor / orchestrator / organic packager / exporter / brand system.
//
//   node mae/harness/zero-v06-audit.mjs [--json]
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const V06_MARKERS = ["V06", "PPL-NIGHT-SHIFT", "AST-NS", "NIGHT-SHIFT", "Fridge Shift", "Roster", "newborn", "baby"];

/** The generic, reusable production/system path a future product flows through. */
export const GENERIC_PATH = [
  "mae/harness/creative-compositor.mjs",
  "mae/harness/design-authority.mjs",
  "mae/harness/marketing-components.mjs",
  "mae/harness/brand-continuity-qa.mjs",
  "mae/harness/organic-media.mjs",
  "mae/harness/export-final-campaign.mjs",
  "mae/services/social-design-tokens.js",
  "mae/media/social-compositor.js",
  "mae/media/social-components.js",
  "mae/media/social-carousel.js",
  "mae/media/social-source-media.js",
  "mae/media/compositor.js",
  "mae/media/layout.js",
  "mae/media/render-specs.js",
  "mae/media/pipeline.js",
  "mae/media/prompt-compiler.js",
  "mae/media/providers.js",
  "mae/media/router.js",
  "mae/media/export.js",
  "mae/media/zip.js",
];

// §62 — product-specific production branching patterns.
const BRANCH_PATTERNS = [
  /(?:product_?id|productId)\s*===?\s*["'`]/i,
  /(?:asset|asset_?id)\s*===?\s*["'`](?:PPL|AST|ANG|DES|TR)-/i,
  /switch\s*\(\s*(?:product_?id|productId)/i,
  /["'`](?:PPL|AST|ANG|DES|TR)-[A-Z0-9-]+["'`]\s*===?/i,
  /(?:product_?id|productId)\s*==\s*["'`](?:PPL|AST)/i,
];

const isComment = (line) => /^\s*(\/\/|\/\*|\*)/.test(line);

/** Run the audit. Returns { pass, scanned, findings, legitimate, illegitimate, branches }. */
export function zeroV06Audit({ genericPath = GENERIC_PATH } = {}) {
  const findings = [];
  const branches = [];
  const scanned = [];
  for (const relFile of genericPath) {
    const abs = join(ROOT, relFile);
    if (!existsSync(abs)) continue;
    scanned.push(relFile);
    const lines = readFileSync(abs, "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const marker of V06_MARKERS) {
        if (line.includes(marker)) findings.push({ file: relFile, line: i + 1, marker, text: line.trim(), legitimate: isComment(line) });
      }
      for (const re of BRANCH_PATTERNS) if (re.test(line)) branches.push({ file: relFile, line: i + 1, text: line.trim() });
    });
  }
  const illegitimate = findings.filter((f) => !f.legitimate);
  const legitimate = findings.filter((f) => f.legitimate);
  return {
    pass: illegitimate.length === 0 && branches.length === 0,
    scanned,
    findings,
    legitimate,
    illegitimate,
    branches,
  };
}

if (process.argv[1] && process.argv[1].endsWith("zero-v06-audit.mjs")) {
  const r = zeroV06Audit();
  if (process.argv.includes("--json")) { console.log(JSON.stringify(r, null, 2)); }
  else {
    console.log(`ZERO-V06 AUDIT — scanned ${r.scanned.length} generic files`);
    console.log(`  V06 findings        : ${r.findings.length} (${r.legitimate.length} comment-only / reference, ${r.illegitimate.length} illegitimate)`);
    console.log(`  product-id branches : ${r.branches.length}`);
    for (const f of r.illegitimate) console.log(`  ILLEGITIMATE ${f.file}:${f.line}  ${f.marker}  ${f.text}`);
    for (const b of r.branches) console.log(`  BRANCH       ${b.file}:${b.line}  ${b.text}`);
    console.log(`\nZERO-V06-DEPENDENCY: ${r.pass ? "PASS" : "FAIL"}`);
    for (const f of r.legitimate) console.log(`  (ok, reference) ${f.file}:${f.line}  ${f.marker}`);
  }
  if (!r.pass) process.exitCode = 1;
}
