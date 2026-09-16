#!/usr/bin/env node
// Writing / Generation Control Layer — DETERMINISTIC WRITING CONTROLS (Passes 4-6 support).
//
// (Swiipt_Writing_Generation_Control_Layer_v1.md §6, §21-§25, §30 Passes 5-6; governing prompt SIXTH/NINTH.)
// These are GENERATION CONTROLS, not acceptance tests. Acceptance Tests (qa-checks + AI A-R) and
// Publishing Gates stay authoritative. Severity (owner-locked):
//   NEVER / SCOPE_DRIFT / UNSUPPORTED / SAFETY_ISSUE  -> BLOCKER
//   density / heading / bullet / repetition / filler   -> WARNING (WRITING_QUALITY_ISSUE)
//
// Usage: node harness/writing-checks.mjs <PRODUCT_ID>
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(join(root, "config", "writing-control.v1.json"), "utf8"));

const F = (code, status, detail, where) => ({
  code, status, detail, where,
  severity: cfg.severity.blockers.includes(status) ? "BLOCKER" : "WARNING",
});

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

/** Collect every string in a nested JSON structure. */
function collectStrings(obj, path = "", out = []) {
  if (typeof obj === "string") { out.push({ path, text: obj }); return out; }
  if (Array.isArray(obj)) { obj.forEach((v, i) => collectStrings(v, `${path}[${i}]`, out)); return out; }
  if (obj && typeof obj === "object") { for (const [k, v] of Object.entries(obj)) collectStrings(v, path ? `${path}.${k}` : k, out); }
  return out;
}

/** Prose controls: forbidden phrases (BLOCKER), filler + repetition (WARNING). */
export function analyzeProse(text, where) {
  const findings = [];
  if (!text || typeof text !== "string") return findings;
  const lower = text.toLowerCase();
  for (const phrase of cfg.constitution.forbidden_phrases) {
    if (lower.includes(phrase.toLowerCase())) {
      findings.push(F("NEVER_phrase", "NEVER", `forbidden phrase: "${phrase}"`, where));
    }
  }
  for (const pat of cfg.quality_controls?.filler_patterns ?? []) {
    const re = new RegExp(`\\b${escRe(pat)}\\b`, "i");
    if (re.test(text)) findings.push(F("filler", "WRITING_QUALITY_ISSUE", `filler pattern: "${pat}"`, where));
  }
  // repeated sentences (normalised), only over reasonably long sentences
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.replace(/\s+/g, " ").trim()).filter((s) => s.length >= 40);
  const seen = new Map();
  for (const s of sentences) {
    const key = s.toLowerCase().replace(/[^a-z0-9 ]/g, "");
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const repeats = [...seen.entries()].filter(([, n]) => n > 1);
  for (const [key] of repeats) {
    findings.push(F("repetition", "WRITING_QUALITY_ISSUE", `repeated sentence: "${key.slice(0, 70)}"`, where));
  }
  return findings;
}

/** Markdown structure controls: heading density + bullet ratio (WARNING). */
export function analyzeMarkdown(text, where) {
  const findings = [];
  if (!text || typeof text !== "string") return findings;
  const lines = text.split(/\r?\n/);
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  const words = text.split(/\s+/).filter(Boolean).length || 1;
  const headings = lines.filter((l) => /^#{1,6}\s/.test(l.trim())).length;
  const bullets = lines.filter((l) => /^\s*([-*+]|\d+\.)\s/.test(l)).length;
  const hMax = cfg.quality_controls?.max_heading_density_per_1000_words ?? 14;
  const bMax = cfg.quality_controls?.max_bullet_line_ratio ?? 0.4;
  const hDensity = (headings / words) * 1000;
  if (hDensity > hMax) findings.push(F("heading_excess", "WRITING_QUALITY_ISSUE", `heading density ${hDensity.toFixed(1)}/1000w > ${hMax}`, where));
  if (nonEmpty.length >= 8 && bullets / nonEmpty.length > bMax) {
    findings.push(F("bullet_excess", "WRITING_QUALITY_ISSUE", `bullet ratio ${(bullets / nonEmpty.length).toFixed(2)} > ${bMax}`, where));
  }
  return findings;
}

/** Light voice control: monotonous rhythm + missing second person (WARNING). */
export function analyzeVoice(text, voice, where) {
  const findings = [];
  if (!text || typeof text !== "string") return findings;
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 0);
  if (sentences.length >= 6) {
    const lens = sentences.map((s) => s.split(/\s+/).length);
    const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
    const varr = lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length;
    if (Math.sqrt(varr) < 1.6) findings.push(F("voice_monotony", "WRITING_QUALITY_ISSUE", `low sentence-length variance (sd=${Math.sqrt(varr).toFixed(2)}); vary rhythm`, where));
  }
  if ((voice?.person || voice?.first_second_person) && /\bsecond\b|you/.test(String(voice.person || voice.first_second_person)) && !/\byou(r)?\b/i.test(text)) {
    findings.push(F("voice_person", "WRITING_QUALITY_ISSUE", "product voice requires second person but text never addresses 'you'", where));
  }
  return findings;
}

/** Asset content structural control (no raw HTML; widget blocks balanced). */
export function checkAssetStructure(content, where) {
  const findings = [];
  if (!content) return findings;
  const rawHtml = content.match(/<\/?(div|table|style|script|span|section|button|iframe)\b[^>]*>/i);
  if (rawHtml) findings.push(F("asset_raw_html", "UNSUPPORTED", `raw HTML in authored source: ${rawHtml[0]}`, where));
  for (const tag of ["DECISION", "RESCUE", "SCRIPTS"]) {
    const opens = (content.match(new RegExp("\\[\\[" + tag + "\\]\\]", "g")) || []).length;
    const closes = (content.match(new RegExp("\\[\\[/" + tag + "\\]\\]", "g")) || []).length;
    if (opens !== closes) findings.push(F("asset_widget_unbalanced", "UNSUPPORTED", `${tag}: ${opens} open / ${closes} close`, where));
  }
  return findings;
}

// ---- per-product run ----
function readIf(p) { return existsSync(p) ? readFileSync(p, "utf8") : null; }

export function runWritingChecks(productId, { root: dataRoot = root } = {}) {
  const pdir = join(dataRoot, "data", "products", productId);
  const p = JSON.parse(readFileSync(join(pdir, "product.json"), "utf8"));
  const voice = p.generation?.voice ?? {};
  const findings = [];

  // 1) generated copy artifacts (Pass 3 output)
  for (const rel of ["copy/landing-page.json", "copy/product-page.json", "copy/faq.json"]) {
    const raw = readIf(join(pdir, rel));
    if (!raw) continue;
    let obj; try { obj = JSON.parse(raw); } catch { continue; }
    for (const { path, text } of collectStrings(obj, rel)) {
      findings.push(...analyzeProse(text, `${rel}:${path}`));
      findings.push(...analyzeVoice(text, voice, `${rel}:${path}`));
    }
  }

  // 2) asset source content (Pass 4)
  for (const [job, list] of Object.entries(p.asset_map ?? {})) {
    for (const aid of list) {
      const af = join(pdir, "assets", `${aid}.json`);
      if (!existsSync(af)) continue;
      const a = JSON.parse(readFileSync(af, "utf8"));
      if (!a.source_path) continue;
      const base = join(pdir, a.source_path.split("#")[0]);
      const content = readIf(base);
      if (!content) continue;
      findings.push(...checkAssetStructure(content, `${aid}:${a.source_path}`));
      findings.push(...analyzeProse(content, `${aid}`));
      findings.push(...analyzeMarkdown(content, `${aid}`));
    }
  }

  const blockers = findings.filter((f) => f.severity === "BLOCKER").length;
  const warnings = findings.length - blockers;
  return { product_id: productId, findings, blockers, warnings, status: blockers ? "FAIL" : (warnings ? "WARNING" : "PASS") };
}

if (process.argv[1] && process.argv[1].endsWith("writing-checks.mjs")) {
  const id = process.argv[2];
  if (!id) { console.error("usage: node harness/writing-checks.mjs <PRODUCT_ID>"); process.exit(2); }
  const r = runWritingChecks(id);
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.blockers ? 1 : 0);
}
