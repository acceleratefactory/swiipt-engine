#!/usr/bin/env node
// Backfill v1b — Postpartum Library reports (21 territory reports).
// Converts EVERY researched niche into an opportunity record using the report's own
// survival-pain scores, verdicts and library roles. No-research-wasted rule.
// Handles all observed report formats:
//   ### A1. NICHE: "Name" (desc)          ### A1 - NICHE: "Name"
//   ### A1. NICHE IDEA: Name              ### NICHE A1: "Name"
//   ### A1 — "Name"                       ### NICHE 1 — "Name"
//   **NICHE A1: "Name" — desc**           **G1 — Name**
//   ### NICHE IDEA: N2 — "Name"
// Scores: tick-mark (✔) or numeric n/5 (>=3 = YES). Roles: appendix table or inline.
// Run: node harness/backfill-postpartum-library.mjs && node harness/validate-opportunity.mjs --all
import { writeFileSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "Postpartum Library");
const OUT = join(root, "data", "opportunities");

const THEMES = {
  "SLEEP DEPRIVATION": "SLP", "C-SECTION RECOVERY": "CSS", "DIASTASIS CORE RECOVERY": "DCR",
  "POSTPARTUM BODY RECOVERY": "PBR", "ONE-HANDED NUTRITION": "OHN",
  "POSTPARTUM HOUSEHOLD MANAGEMENT": "PHM", "RELATIONSHIP STRAIN": "RST",
  "RETURN TO WORK": "RTW", "NEWBORN ROUTINES": "NBR", "BREASTFEEDING FEEDING JOURNEY": "BFJ",
  "POSTPARTUM MENTAL EMOTIONAL LIFE": "PME", "THE FIRSTS MARKET": "FIR",
  "BABY OLDER CHILDREN": "BOC", "GRANDPARENTS FAMILY BOUNDARIES": "GFB",
  "NEW-PARENT SOCIAL LIFE": "NSL", "POSTPARTUM PERSONAL CARE": "PPC",
  "POSTPARTUM CLOTHING DRESSING": "PCD", "MONEY POST-BABY HOUSEHOLD MANAGEMENT": "MPB",
  "BABY-PRODUCT OVERWHELM": "BPO", "NEW-PARENT ADMINISTRATION MARKET": "NPA",
  "NEW PARENT OPERATING SYSTEM": "NPO",
};
const PROMOTED = { "SLP-H1": "TR-PPL-NIGHT-SHIFT-001" };
const SKIPWORDS = /(framework|research|vertical|audience|price|stage|appendix|launch|submarket|sub-market|hidden market|evidence|rule:|pain test|library role key|tally|totals)/i;

function roleMap(t) {
  const r = t.toLowerCase();
  if (r.includes("standalone")) return "STANDALONE_TRANSFORMATION";
  if (r.includes("module")) return "MODULE";
  if (r.includes("angle")) return "MARKETING_ANGLE";
  if (r.includes("magnet") || r.includes("free")) return "LEAD_MAGNET";
  if (r.includes("bundle")) return "BUNDLE_COMPONENT";
  return "FUTURE_RESEARCH";
}
function field(body, names) {
  for (const n of names) {
    const m = body.match(new RegExp(`(?:\\*\\*)?${n}\\s*:\\s*(?:\\*\\*)?([^\\n]+)`, "i"));
    if (m) return m[1].replace(/\*+/g, "").trim();
  }
  return "";
}
function parseNicheLine(rawLine, isMarker) {
  let s = rawLine.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim();
  s = s.replace(/^[-•]\s*/, "");
  const hasNiche = /niche/i.test(s);
  let m;
  // form 1: optional NICHE label + code + separator + name
  // code may be A1, N2, G12 or pure numeric (pure numeric requires a NICHE keyword or marker)
  if ((m = s.match(/^(?:niche\s*(?:idea)?\s*[.:—–·-]?\s*)?([A-Za-z]*N?\d{1,3})\s*[.:—–·-]\s*(?:(?:niche(?:\s+idea)?)\s*[.:—–·-]\s*)?(.+)$/i))) {
    const code = m[1].toUpperCase();
    const numericOnly = /^\d+$/.test(code);
    if (numericOnly && !hasNiche && !isMarker) return null;
    let rest = m[2].trim();
    let desc = "";
    const pm = rest.match(/\(([^)]+)\)\s*$/);
    if (!rest.startsWith('"') && pm && (rest.match(/\(/g) || []).length === 1) {
      desc = pm[1]; rest = rest.slice(0, pm.index).trim();
    }
    const name = rest.replace(/^"(.*)"$/, "$1").replace(/"\s*[—–·-]\s*.*$/, "").replace(/\s*[—–·]\s*HIDDEN MARKET.*$/i, "").trim();
    if (/^[a-z]/.test(name)) return null;
    if (name.split(/\s+/).length < 2 && !desc) return null;
    return { code, name: name.replace(/"/g, ""), desc };
  }
  // form 2: bare "G1 — The Name" on marker lines
  if (isMarker && (m = s.match(/^([A-Za-z]+\d{1,3})\s*[—–·-]\s*(.+)$/))) {
    return { code: m[1].toUpperCase(), name: m[2].replace(/^"|"$/g, "").trim(), desc: "" };
  }
  return null;
}

const CRITERIA = [
  ["URGENCY", /urgen/i], ["EMBARRASSMENT", /embarrass/i], ["FAILED ATTEMPTS", /fail/i],
  ["IDENTITY THREAT", /identity/i], ["IMMEDIATE SPEND", /spend/i],
];
let written = 0;
const perFile = [];

for (const file of readdirSync(SRC).sort()) {
  if (!file.endsWith(".md")) continue;
  const base = file.replace(/\.md$/, "");
  const theme = THEMES[base];
  if (!theme) { perFile.push(`${base}: NO THEME`); continue; }
  const c = readFileSync(join(SRC, file), "utf8");
  const lines = c.split("\n");

  const apRoles = {};
  const apIdx = c.toLowerCase().lastIndexOf("appendix");
  if (apIdx >= 0) {
    for (const line of c.slice(apIdx).split("\n")) {
      const cells = line.split("|").map(x => x.trim());
      if (cells.length < 4) continue;
      const cm = cells[1].match(/^([A-Za-z]+\d{1,3})\b/);
      if (cm && !cells[2].includes("---")) apRoles[cm[1].toUpperCase()] = { role: cells[2], pairs: cells[3] ?? "" };
    }
  }

  const heads = [];
  let currentSub = "unassigned";
  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li];
    if (/^#\s/.test(raw) || /^##\s/.test(raw)) {
      const sm = raw.match(/SUB-?MARKET\s+[A-Z0-9]+\s*[—–\-:]?\s*(.*)$/i);
      if (sm) currentSub = (sm[1] || `SUBMARKET ${sm[0].match(/SUB-?MARKET\s+([A-Z0-9]+)/i)[1]}`).replace(/"/g, "").trim();
      else if (/HIDDEN\s*MARKET/i.test(raw)) currentSub = raw.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim();
      continue;
    }
    const trimmed = raw.trim();
    const isMarker = /^#{2,4}\s/.test(raw) || /^\*\*.+\*\*\s*$/.test(trimmed) || /niche/i.test(trimmed);
    if (!isMarker) continue;
    if (SKIPWORDS.test(raw)) continue;
    const n = parseNicheLine(raw, isMarker);
    if (n) heads.push({ ...n, li });
  }

  let count = 0;
  for (let k = 0; k < heads.length; k++) {
    const { code, name, desc, li } = heads[k];
    const endLi = k + 1 < heads.length ? heads[k + 1].li : lines.length;
    const body = lines.slice(li + 1, endLi).join("\n");

    const person = field(body, ["TARGET PERSON", "TARGET"]);
    const pain = field(body, ["CORE PAIN", "PAIN"]);
    const scoreLine = field(body, ["SCORE"]) || body;
    const verdictM = body.match(/VERDICT:?\s*\*{0,2}\s*([^\n*]+)/i);
    const verdict = verdictM ? verdictM[1].replace(/\*+/g, "").trim() : "";
    const roleInline = (body.match(/ROLE:\s*\*{0,2}\s*([^*\n(,;]+)/i) || [])[1]?.trim() ?? "";

    const flags = {}; const notes = [];
    // windowed parse: slice scoreLine between criterion labels so marks can't bleed across
    const starts = CRITERIA.map(([, re]) => {
      const mm = scoreLine.match(new RegExp(re.source, "i"));
      return mm ? mm.index : -1;
    });
    for (let ci = 0; ci < CRITERIA.length; ci++) {
      const [label] = CRITERIA[ci];
      const from = starts[ci];
      if (from < 0) { flags[label] = false; continue; }
      const to = starts.slice(ci + 1).find(x => x > from) ?? scoreLine.length;
      const win = scoreLine.slice(from, to);
      let ok = false; let note = "";
      const tick = win.match(/[✔]/);
      const num = win.match(/(\d{1,2})\s*\/\s*5/);
      const bare = win.match(/:\s*(\d{1,2})\b/);
      if (tick) { ok = true; note = `${label} ✔`; }
      else if (num) {
        const v = parseInt(num[1], 10);
        ok = v >= 3; note = `${label} scored ${v}/5 (>=3 = YES)`;
      } else if (bare && parseInt(bare[1], 10) <= 5) {
        const v = parseInt(bare[1], 10);
        ok = v >= 3; note = `${label} scored ${v}/5 (>=3 = YES)`;
      }
      flags[label] = ok;
      if (ok) notes.push(note || label);
    }
    if (!notes.length) notes.push(verdict ? `verdict: ${verdict}` : "[BACKFILL] no machine-readable score in entry");

    const ap = apRoles[code] ?? {};
    const roleRaw = ap.role || field(body, ["LIBRARY ROLE"]) || roleInline || "";
    const role = roleRaw ? roleMap(roleRaw) : "FUTURE_RESEARCH";
    const oid = `OPP-PPL-${theme}-${code}`;
    const rel = [];
    if (ap.pairs) for (const mm of ap.pairs.matchAll(/\b([A-Z]\d{1,2})\b/g)) rel.push(`OPP-PPL-${theme}-${mm[1]}`);

    writeFileSync(join(OUT, `${oid}.json`), JSON.stringify({
      opportunity_id: oid,
      source: `library-report:${file}`,
      source_references: [`Product Pipeline/Postpartum Library/${file}`, "Product Pipeline/followup.md"],
      life_area: "m01",
      focus_market: base,
      submarket: currentSub,
      collected_at: "2026-08-19",
      finding: {
        headline: `"${name}"${desc ? ` (${desc})` : ""}`,
        problem: pain,
        recurring_situation: currentSub,
        person,
        trigger: "",
        failed_attempt: "",
        emotional_stake: "",
        desired_outcome: "",
        evidence_quotes: [],
        mechanism_hypotheses: [],
        competition_notes: "See RESEARCH BASE section of source report.",
      },
      survival_pain_test: {
        urgency: flags["URGENCY"] ?? false,
        embarrassment: flags["EMBARRASSMENT"] ?? false,
        failed_attempts: flags["FAILED ATTEMPTS"] ?? false,
        identity_threat: flags["IDENTITY THREAT"] ?? false,
        immediate_spend: flags["IMMEDIATE SPEND"] ?? false,
        signals_observed: notes,
      },
      disposition: {
        library_role: role,
        rationale: roleRaw
          ? `Report assigns: "${roleRaw}"${ap.pairs ? ` | cross-sells: ${ap.pairs}` : ""}. Verdict: ${verdict || "n/a"}.`
          : "[BACKFILL] no explicit role found in report - defaulted FUTURE_RESEARCH pending review.",
        assigned_at: "2026-08-19",
        promoted_transformation_id: PROMOTED[`${theme}-${code}`] ?? null,
        reclassification_history: [],
      },
      status: PROMOTED[`${theme}-${code}`] ? "promoted_to_candidate" : "dispositioned",
      related_opportunity_ids: [...new Set(rel)],
    }, null, 2) + "\n");
    count++;
  }
  perFile.push(`${base}: ${count}`);
  written += count;
}
console.log(perFile.join("\n"));
console.log(`TOTAL: ${written}`);
