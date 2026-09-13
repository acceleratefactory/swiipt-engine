// MAE · write the frozen Day-6 video fixture (VV-CSEC-006) to disk (deterministic, idempotent).
// Run: node mae/harness/build-video-fixture.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MAE_DIR } from "../lib/store.js";
import { buildDay6Video } from "./video-fixtures.mjs";

const dir = join(MAE_DIR, "data", "fixtures", "video");
mkdirSync(dir, { recursive: true });
const { fixture_id, grounding, shot, assetSpec, promptPackage } = buildDay6Video();
const record = {
  fixture_id,
  class: "video_foundation_fixture",
  synthetic: true,
  provenance: "synthetic_fixture",
  angle_id: "ANG-CSEC-006",
  video_grounding: grounding,
  shot_specification: shot,
  video_asset_specification: assetSpec,
  video_prompt_package: promptPackage,
  boundary_note: "Depiction of a recovery moment, NOT clinical instruction and NOT the Product Truth mechanism.",
};
const path = join(dir, `${fixture_id}.json`);
writeFileSync(path, JSON.stringify(record, null, 2) + "\n");
console.log(`wrote ${path}`);
