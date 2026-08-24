#!/usr/bin/env node
// Factory item #8 - SELECTION ENGINE (deterministic scorer).
// Scores every opportunity record into a ranked build queue -> data/queue.json.
// Rules (validation-standard.md section 6 / pipeline.md section 8):
//  - selection NEVER destroys the queue: records are read-only here;
//  - transformation quality is separate from commercial role;
//  - every score carries explicit reasons (no vibes).
// Re-run any time: node harness/select.mjs
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OPP = join(root, "data", "opportunities");

const ROLE_WEIGHT = {
  STANDALONE_TRANSFORMATION: 30,
  ENTRY_PRODUCT: 22,
  UPSELL: 22,
  BUNDLE_COMPONENT: 16,
  MODULE: 12,
  MARKETING_ANGLE: 8,
  LEAD_MAGNET: 6,
  SUPPORTING_ASSET: 4,
  JOURNEY_NODE: 2,
  FUTURE_RESEARCH: 0,
  EVIDENCE_GAP: 0,
};

function score(o) {
  const reasons = [];
  let s = 0;

  // 1) commercial potential of the assigned role (max 30)
  const rw = ROLE_WEIGHT[o.disposition?.library_role] ?? 0;
  s += rw;
  reasons.push(`role ${o.disposition.library_role} (+${rw})`);

  // 2) survival-pain evidence strength (max 25): 5 pts per YES flag with observed signals
  const t = o.survival_pain_test ?? {};
  const flags = ["urgency", "embarrassment", "failed_attempts", "identity_threat", "immediate_spend"];
  const yes = flags.filter(f => t[f]);
  if (yes.length && !yes.every(() => false)) {
    const backfillOnly = (t.signals_observed ?? []).every(x => /\[BACKFILL\]/i.test(x));
    if (!backfillOnly) {
      s += yes.length * 5;
      reasons.push(`survival-pain ${yes.length}/5 with signals (+${yes.length * 5})`);
    } else {
      reasons.push(`survival-pain flags are [BACKFILL] neutral (+0)`);
    }
  }

  // 3) situation completeness (max 20): person/trigger/failed_attempt/emotional_stake/desired_outcome
  const f = o.finding ?? {};
  const sitFields = ["person", "trigger", "failed_attempt", "emotional_stake", "desired_outcome"];
  const filled = sitFields.filter(k => (f[k] ?? "").trim().length > 15);
  s += filled.length * 4;
  if (filled.length) reasons.push(`situation fields ${filled.length}/5 (+${filled.length * 4})`);

  // 4) evidence depth (max 15): source references + evidence quotes
  const refs = (o.source_references ?? []).length;
  const quotes = (f.evidence_quotes ?? []).length;
  const ev = Math.min(10, refs * 3) + Math.min(5, quotes * 2);
  s += ev;
  if (ev) reasons.push(`evidence refs=${refs} quotes=${quotes} (+${ev})`);

  // 5) ecosystem linkage (max 10): related ids = journey adjacency signal
  const rel = (o.related_opportunity_ids ?? []).length;
  const rp = Math.min(10, rel * 2);
  s += rp;
  if (rp) reasons.push(`${rel} ecosystem links (+${rp})`);

  // 6) promotion bonus (already has a transformation lineage)
  if (o.status === "promoted_to_candidate") { s += 15; reasons.push("promoted lineage (+15)"); }
  else if (o.status === "open") { s -= 10; reasons.push("undispositioned (-10)"); }

  return { total: s, reasons };
}

const records = [];
for (const file of readdirSync(OPP)) {
  if (!file.endsWith(".json")) continue;
  const o = JSON.parse(readFileSync(join(OPP, file), "utf8"));
  const { total, reasons } = score(o);
  records.push({
    id: o.opportunity_id,
    title: o.finding.headline,
    focus_market: o.focus_market,
    role: o.disposition.library_role,
    status: o.status,
    score: total,
    priority: null,
    reasons,
  });
}
records.sort((a, b) => b.score - a.score);

// priority bands - selection never destroys the unselected rest
records.forEach((r, i) => {
  r.priority = i < 15 ? "P1" : r.score >= 45 ? "P2" : r.score >= 25 ? "P3" : "QUEUE";
});

const out = {
  generated_at: new Date().toISOString(),
  note: "Generated ranking - never mutates opportunity records. Unselected records remain in the queue permanently.",
  counts: {
    total: records.length,
    P1: records.filter(r => r.priority === "P1").length,
    P2: records.filter(r => r.priority === "P2").length,
    P3: records.filter(r => r.priority === "P3").length,
    QUEUE: records.filter(r => r.priority === "QUEUE").length,
  },
  queue: records,
};
writeFileSync(join(root, "data", "queue.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`scored ${records.length} opportunities -> data/queue.json`);
console.log(JSON.stringify(out.counts));
console.log("\nTop 15:");
for (const r of records.slice(0, 15)) console.log(` ${r.priority} ${String(r.score).padStart(3)} ${r.id}  ${r.title.slice(0, 60)}`);
