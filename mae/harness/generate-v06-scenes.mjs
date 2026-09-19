// V06 VISUAL PRODUCTION — step 1: generate raw visual scenes for every approved prompt.
// $0 route only (9Router ag/gemini-3.1-flash-image). Provider failure is recorded exactly,
// never faked; the asset then stays PRODUCTION_PACKAGE_READY for that visual.
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  OUT, loadJson, ensureDir, writeJson, generateImage, scenePrompt, DES_FOR_ASSET,
} from "./visual-lib.mjs";

const PLATDIR = { facebook: "Facebook", instagram: "Instagram", whatsapp: "WhatsApp" };
const scriptOf = (label, prompt) => `# ${label}\n\nPrompt (verbatim, approved Visual Grounding Block):\n\n${prompt}\n`;

function assetDir(a, sub = "") {
  const base = a.asset_type === "SOCIAL_REEL" ? join(OUT, "Reels", a.id) : join(OUT, PLATDIR[a.platform] || "Instagram", a.id);
  return sub ? join(base, sub) : base;
}

function jobs() {
  const out = [];
  const ASSETS = [...Array.from({ length: 16 }, (_, i) => "AST-NS-" + String(i + 1).padStart(3, "0")),
    "AST-NS-STOP-001", "AST-NS-PROB-001", "AST-NS-MYTH-001", "AST-NS-STORY-001", "AST-NS-OBJ-001"];
  for (const id of ASSETS) {
    const a = loadJson(`mae/data/assets/${id}.json`);
    const prompt = scenePrompt(a);
    if (a.asset_type === "SOCIAL_CAROUSEL") {
      const des = loadJson(`mae/data/design-specs/${DES_FOR_ASSET[id]}.json`);
      const slides = [...new Set(Object.values(des.copy_blocks || {}).map((v) => v.slide).filter((n) => n != null))].sort((x, y) => x - y);
      for (const n of slides) out.push({ id, a, key: `slide-${n}`, file: `scene-slide-${n}.jpg`, label: `${id} slide ${n}`, prompt });
    } else if (a.asset_type === "SOCIAL_REEL") {
      out.push({ id, a, key: "cover", file: "cover.jpg", label: `${id} reel cover`, prompt });
    } else {
      out.push({ id, a, key: "scene", file: "scene.jpg", label: `${id} scene`, prompt });
    }
  }
  return out;
}

export async function generateAll({ only = null } = {}) {
  const ledger = [];
  const list = jobs().filter((j) => !only || j.id === only);
  console.log("scene jobs:", list.length);
  for (const j of list) {
    const dir = assetDir(j.a, "raw-generated");
    ensureDir(dir);
    const outPath = join(dir, j.file);
    if (existsSync(outPath)) {
      ledger.push({ id: j.id, key: j.key, status: "CACHED", file: outPath });
      console.log(j.id, j.key, "-> CACHED");
      continue;
    }
    const r = await generateImage(j.prompt);
    if (r.ok) {
      writeFileSync(outPath, r.bytes);
      writeFileSync(outPath.replace(/\.jpg$/, ".prompt.txt"), scriptOf(j.label, j.prompt), "utf8");
      ledger.push({ id: j.id, key: j.key, status: "PROVIDER_SUCCESS", file: outPath, mime: r.mime, bytes: r.bytes.length, ms: r.ms, model: r.model });
      console.log(j.id, j.key, "-> OK", Math.round(r.bytes.length / 1024) + "KB", r.ms + "ms");
    } else {
      ledger.push({ id: j.id, key: j.key, status: "PRODUCTION_PACKAGE_READY", provider_failure: r.status, error: r.error, ms: r.ms });
      console.log(j.id, j.key, "-> FAIL", r.status, String(r.error || "").slice(0, 80));
    }
  }
  writeJson(join(OUT, "_scenes-gen.json"), {
    model: "ag/gemini-3.1-flash-image", route: "9Router /v1/images/generations (existing qualified/free route)",
    provider_spend_usd: 0, generated: new Date().toISOString(), scenes: ledger,
  });
  const ok = ledger.filter((l) => l.status === "PROVIDER_SUCCESS" || l.status === "CACHED").length;
  console.log(`scenes: ${ok}/${ledger.length} visual material present`);
  return ledger;
}

const invoked = process.argv[1] && process.argv[1].endsWith("generate-v06-scenes.mjs");
if (invoked) {
  const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
  await generateAll({ only });
}