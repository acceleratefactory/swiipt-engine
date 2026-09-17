// MAE — fresh-clone forensic check (V06 integrity closure, Phase B §7.1 / §19).
//
// Proves the canonical V06 marketing pack does not depend on ignored/untracked local files: it
// reconstructs the campaign from TRACKED canonical files ONLY into a temp directory, then runs the
// pack integrity contract against that reconstruction.
//
// Requirements:
//   · the canonical campaign files must be staged/tracked first (git add), otherwise this check
//     intentionally FAILS — that is the artifact-closure defect being guarded against.
//   · never disturbs the real working tree.
//
// Run: node mae/harness/fresh-clone-check.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, existsSync, rmSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const MAE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = resolve(MAE, "..");
const { validateMarketingPack } = await import(pathToFileURL(join(MAE, "services/marketing-pack.js")).href);

function git(args) { return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim(); }

const tracked = git(["ls-files", "mae/data"]).split("\n").filter(Boolean);

const tmp = mkdtempSync(join(tmpdir(), "swiipt-freshclone-"));
try {
  for (const rel of tracked) {
    const dest = join(tmp, rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(ROOT, rel), dest);
  }

  const dataDir = join(tmp, "mae", "data");
  const rd = (rel) => JSON.parse(readFileSync(join(dataDir, rel), "utf8"));

  // load only what exists in the tracked reconstruction
  const readAll = (sub, re) => readdirSync(join(dataDir, sub)).filter((f) => re.test(f)).map((f) => rd(join(sub, f)));

  const pack = rd("MASTER-MARKETING-PACK.json");
  const records = {
    angles: readAll("marketing-angles", /^ANG-NS-.*\.json$/),
    families: readAll("asset-families", /^FAM-NS-.*\.json$/),
    assets: readAll("assets", /^AST-NS-.*\.json$/),
    generated: readAll("generated", /^GEN-NS-.*\.json$/),
    qa: readAll("qa", /^QA-NS-.*\.json$/),
    design_specs: readAll("design-specs", /^DES-NS-.*\.json$/),
    visual_groundings: readAll("visual-groundings", /^VG-NS-.*\.json$/),
    psets: readAll("psets", /^LPS-NS-.*\.json$/),
    campaign: existsSync(join(dataDir, "campaigns/CAMP-NS-001.json")) ? rd("campaigns/CAMP-NS-001.json") : null,
    sequence: existsSync(join(dataDir, "sequences/SEQ-NS-001.json")) ? rd("sequences/SEQ-NS-001.json") : null,
  };

  const persisted = [
    ...records.angles, ...records.families, ...records.assets, ...records.generated,
    ...records.qa, ...records.psets, ...records.design_specs, ...records.visual_groundings,
  ].map((r) => r.id ?? r.design_id);

  const v = validateMarketingPack({ pack, records, persistedIds: persisted });
  const summary = {
    tracked_files: tracked.length,
    reconstructed_records: {
      angles: records.angles.length, families: records.families.length, assets: records.assets.length,
      generated: records.generated.length, qa: records.qa.length, design_specs: records.design_specs.length,
      visual_groundings: records.visual_groundings.length, psets: records.psets.length,
    },
    pack_checks: v.checks,
    unresolved_references: v.failures.filter((f) => f.code === "REFERENCE_UNRESOLVED").length,
    not_persisted: v.failures.filter((f) => f.code === "REFERENCE_NOT_PERSISTED").length,
    placeholders: v.failures.filter((f) => f.code === "PLACEHOLDER_REFERENCE").length,
    count_mismatch: v.failures.filter((f) => f.code === "COUNT_MISMATCH").length,
    content_incomplete: v.failures.filter((f) => f.code === "CONTENT_INCOMPLETE").length,
    brand_unauthorized: v.failures.filter((f) => f.code === "BRAND_TOKEN_UNAUTHORIZED").length,
    pass: v.pass,
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = v.pass ? 0 : 1;
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
