// MAE lib · stable identifiers (S11 §64, MAE-02). Immutable, human-independent.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export const ID_PREFIX = {
  product: "PROD", transformation: "TR", productTruth: "PTR",
  crf: "CRF", mif: "MIF", brand: "BRAND",
  angle: "ANG", validation: "VAL", brief: "BRIEF",
  contentGrounding: "CG", visualGrounding: "VG", affirmationGrounding: "AG",
  visualAssetSpec: "VAS", imagePromptPackage: "IPP",
  generated: "GEN", productionJob: "PJ", artifact: "ART", qa: "QA",
  asset: "AST", family: "FAM", lockedPhraseSet: "PSET", usage: "USE",
  sequence: "SEQ", campaign: "CAMP", audienceState: "AUD", performance: "PERF",
  gap: "GAP", override: "OVR", exportPackage: "EXP", manifest: "MAN", experiment: "EXPT",
};

const pad = (n, w = 3) => String(n).padStart(w, "0");

/** Build a deterministic, unique id: PREFIX-[SCOPE]-[NNN]. NNN advances past existing ids. */
export function makeId(type, scope, existing = []) {
  const prefix = ID_PREFIX[type] || "ID";
  const safeScope = String(scope || "GEN").replace(/[^A-Za-z0-9-]/g, "-").toUpperCase();
  const re = new RegExp(`^${prefix}-${safeScope}-(\\d{3,})$`);
  let max = 0;
  for (const id of existing) {
    const m = re.exec(String(id));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${safeScope}-${pad(max + 1)}`;
}

/** Read `id` fields from a directory of JSON records (best-effort, non-throwing). */
export function existingIds(dir) {
  if (!existsSync(dir)) return [];
  let files = [];
  try { files = readdirSync(dir); } catch { return []; }
  const out = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try { const r = JSON.parse(readFileSync(join(dir, f), "utf8")); if (r && r.id) out.push(r.id); } catch { /* ignore */ }
  }
  return out;
}
