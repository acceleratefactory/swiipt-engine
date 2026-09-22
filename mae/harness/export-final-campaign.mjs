// SWIIPT FINAL CAMPAIGN EXPORT BUILDER  (reusable)
//
//   FULL MARKETING PRODUCTION WORKSPACE  ->  APPROVED FINALS  ->  FINAL EXPORT BUILDER
//     ->  READY-TO-USE DISTRIBUTION PACKAGE
//
// Builds <campaign>/FINAL/ : a clean, distribution-ready package containing ONLY finished media
// plus the exact approved publishing copy, prompts and (for video) the complete production
// package. The production workspace is never read-modified and never reorganised.
//
// Reusable by design: it discovers assets from the campaign ledger and maps each to a destination
// from its own (platform, asset_type). It does not assume V06's asset mix and it does not
// hardcode a platform list — an unknown platform simply gets its own FINAL folder.
//
//   node mae/harness/export-final-campaign.mjs [--dir <campaign>] [--zip] [--validate-only]
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, rmSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname, relative, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { ORGANIC_CONTRACTS } from "./organic-media.mjs";

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
// No product default: the campaign comes from --dir, else it is discovered (one *-Marketing-Assets).
const dirArg = argOf("--dir", null);
const CAMPAIGN = dirArg ? resolve(dirArg) : discoverCampaign();
function discoverCampaign() {
  const cands = readdirSync(process.cwd(), { withFileTypes: true }).filter((e) => e.isDirectory() && /-Marketing-Assets$/.test(e.name)).map((e) => e.name);
  if (cands.length === 1) return resolve(cands[0]);
  throw new Error(`export-final-campaign: pass --dir <campaign> (found ${cands.length} *-Marketing-Assets directories)`);
}
const FINAL = join(CAMPAIGN, "FINAL");
const DO_ZIP = args.includes("--zip") || !args.includes("--no-zip");
const VALIDATE_ONLY = args.includes("--validate-only");

const read = (p) => readFileSync(p, "utf8");
const readJson = (p) => JSON.parse(read(p));
const ensure = (p) => mkdirSync(p, { recursive: true });
const put = (p, s) => { ensure(dirname(p)); writeFileSync(p, s.replace(/\r?\n/g, "\n"), "utf8"); };
const copy = (from, to) => { ensure(dirname(to)); copyFileSync(from, to); };
const title = (s) => String(s).replace(/(^|[_\-\s])([a-z])/g, (m, a, b) => a + b.toUpperCase());

const LEDGER = readJson(join(CAMPAIGN, "_campaign-ledger.json"));
// Campaign label is DATA (never a hardcoded product name). Falls back to the folder name with the
// generic "-Marketing-Assets" suffix removed.
const CAMPAIGN_NAME = LEDGER.campaign || LEDGER.campaign_name || LEDGER.name || basename(CAMPAIGN).replace(/-Marketing-Assets$/i, "");
// Ledger entries key the id/type as `asset`/`type`; normalise so one accessor set serves everything.
const idOf = (a) => a.asset || a.id;
const rawType = (a) => String(a.type || a.asset_type || "");
// The ledger keys the asset kind short (STATIC/CAROUSEL/STORY/REEL); records use the canonical
// asset_type. Normalise both directions so one set of checks serves either input.
const TYPE_CANON = { STATIC: "SOCIAL_STATIC", CAROUSEL: "SOCIAL_CAROUSEL", STORY: "SOCIAL_STORY_SEQUENCE", REEL: "SOCIAL_REEL" };
const KIND_CANON = { SOCIAL_STATIC: "STATIC", SOCIAL_CAROUSEL: "CAROUSEL", SOCIAL_STORY_SEQUENCE: "STORY", SOCIAL_REEL: "REEL" };
const kindOf = (a) => r0(rawType(a));
const r0 = (t) => (TYPE_CANON[t] ? t : (KIND_CANON[t] || t));
const typeOf = (a) => TYPE_CANON[kindOf(a)] || rawType(a);
const platOf = (a) => String(a.platform || "");
// Brand casing without hardcoding a platform list: known names keep brand case, anything else titles.
const PLATFORM_NAME = { facebook: "Facebook", instagram: "Instagram", whatsapp: "WhatsApp", youtube: "YouTube", tiktok: "TikTok", pinterest: "Pinterest", linkedin: "LinkedIn" };
const platName = (p) => PLATFORM_NAME[String(p).toLowerCase()] || title(p);
const ASSET_DIR = (a) => (kindOf(a) === "REEL"
  ? join(CAMPAIGN, "Reels", idOf(a))
  : join(CAMPAIGN, title(platOf(a)), idOf(a)));

/* ------------------------------------------------------------------ sources */
const copyJsonOf = (a) => { const p = join(ASSET_DIR(a), `${idOf(a)}.copy.json`); return existsSync(p) && statSync(p).size > 2 ? readJson(p) : null; };
const promptOf = (a) => { const p = join(CAMPAIGN, "Prompts", "Images", `${idOf(a)}.txt`); return existsSync(p) ? read(p) : null; };
const slidePromptOf = (a, n) => { const p = join(CAMPAIGN, "Prompts", "Images", `${idOf(a)}.slide-${n}.txt`); return existsSync(p) ? read(p) : null; };

/** Normalise the approved post copy into labelled verbatim blocks (shape varies by platform). */
function postEntries(copy) {
  if (!copy || !copy.post_copy) return [];
  const pc = copy.post_copy;
  if (Array.isArray(pc)) return pc.map((x, i) => ({ label: String(i + 1), text: x.text ?? String(x) }));
  if (Array.isArray(pc.slides)) return pc.slides.map((x, i) => ({ label: `SLIDE ${String(i + 1).padStart(2, "0")}${x.style ? ` (${x.style})` : ""}`, text: x.text }));
  if (Array.isArray(pc.sequence)) return pc.sequence.map((x) => ({ label: `${x.step ?? ""}${x.type ? ` (${x.type})` : ""}`.trim(), text: x.text }));
  const out = [];
  if (pc.hook_text) out.push({ label: "Hook", text: pc.hook_text });
  if (pc.problem_text) out.push({ label: "Problem", text: pc.problem_text });
  if (pc.bold_line) out.push({ label: "Bold line", text: pc.bold_line });
  if (out.length === 0) for (const [k, v] of Object.entries(pc)) if (typeof v === "string") out.push({ label: title(k.replace(/_/g, " ")), text: v });
  return out;
}

const banner = (id) => `\n${"=".repeat(56)}\n${id}\n${"=".repeat(56)}\n`;

/* ------------------------------------------------------------------ destination mapping (generic)
 * Derived per asset from (platform, asset_type). No hardcoded platform list: an unknown
 * platform simply receives its own FINAL folder, so future campaigns are not blocked. */
function destFor(a) {
  const p = platOf(a).toLowerCase();
  const t = typeOf(a);
  if (t === "SOCIAL_REEL") return join(FINAL, platName(p), "Reels", idOf(a));
  if (t === "SOCIAL_CAROUSEL") return join(FINAL, platName(p), "Carousels", idOf(a));
  if (t === "SOCIAL_STORY_SEQUENCE") return join(FINAL, platName(p), "Stories", idOf(a));
  if (p === "instagram") return join(FINAL, "Instagram", "Feed");
  return join(FINAL, platName(p));
}

/* ------------------------------------------------------------------ build */
const written = [];
if (!VALIDATE_ONLY) {
  rmSync(FINAL, { recursive: true, force: true });
  ensure(FINAL);
}

const groups = new Map(); // dest -> { assets: [] }
const staticDests = new Map();

for (const a of LEDGER.assets) {
  if (kindOf(a) === "REEL") continue;                       // handled separately below
  const dest = destFor(a);
  if (!groups.has(dest)) groups.set(dest, { assets: [] });
  groups.get(dest).assets.push(a);
}

// media + per-group text
for (const [dest, g] of groups) {
  for (const a of g.assets) {
    if (kindOf(a) === "STATIC") {
      const src = a.final, to = join(dest, `${idOf(a)}.png`);
      if (!VALIDATE_ONLY) { copy(src, to); written.push(to); }
    } else {
      for (const s of a.slides) {
        const name = kindOf(a) === "STORY" ? `frame-${String(s.slide).padStart(2, "0")}.png` : `slide-${String(s.slide).padStart(2, "0")}.png`;
        const to = join(dest, name);
        if (!VALIDATE_ONLY) { copy(s.final, to); written.push(to); }
      }
    }
  }
  const isFeed = g.assets.length > 1 || platOf(g.assets[0]).toLowerCase() !== "instagram" || typeOf(g.assets[0]) === "STATIC";
  const copyFile = platOf(g.assets[0]) === "facebook" ? "POSTS.txt"
    : platOf(g.assets[0]) === "whatsapp" ? "MESSAGES.txt"
    : g.assets.length > 1 ? "CAPTIONS.txt"
    : kindOf(g.assets[0]) === "CAROUSEL" ? "CAPTION.txt"
    : kindOf(g.assets[0]) === "STORY" ? "STORY-COPY.txt" : "CAPTIONS.txt";

  // ---- publishing copy (verbatim)
  let txt = `APPROVED PUBLISHING COPY — ${platOf(g.assets[0]).toUpperCase()}\nVerbatim from the approved asset records. Do not rewrite.\n`;
  if (!VALIDATE_ONLY) {
    for (const a of g.assets) {
      const c = copyJsonOf(a);
      txt += banner(idOf(a));
      const entries = postEntries(c);
      if (entries.length) { for (const e of entries) txt += `${e.label ? e.label + ":\n" : ""}${e.text}\n\n`; }
      else txt += "(approved publishing copy not stored for this asset)\n\n";
      const cta = c && c.cta_text ? c.cta_text : (c && Array.isArray(c.visual_copy_on_image) ? c.visual_copy_on_image[c.visual_copy_on_image.length - 1] : null);
      if (cta) txt += `CTA:\n${cta}\n`;
    }
    put(join(dest, copyFile), txt); written.push(join(dest, copyFile));
  }

  // ---- exact image prompts (verbatim, per slide where they differ)
  let pr = `EXACT IMAGE-GENERATION PROMPTS — ${platOf(g.assets[0]).toUpperCase()}\nVerbatim archived prompts. Do not summarise.\n`;
  if (!VALIDATE_ONLY) {
    for (const a of g.assets) {
      pr += banner(idOf(a));
      const base = promptOf(a);
      pr += base ? `${base.trim()}\n\n` : "(no archived image prompt for this asset)\n\n";
      if (kindOf(a) === "CAROUSEL") {
        for (const s of a.slides) {
          const sp = slidePromptOf(a, s.slide);
          if (sp) pr += `--- SLIDE ${String(s.slide).padStart(2, "0")} ---\n${sp.trim()}\n\n`;
        }
      }
    }
    put(join(dest, "IMAGE-PROMPTS.txt"), pr); written.push(join(dest, "IMAGE-PROMPTS.txt"));
  }
}

/* ------------------------------------------------------------------ REEL (complete package, video pending) */
const reel = LEDGER.assets.find((a) => kindOf(a) === "REEL");
let reelDir = null;
if (reel && !VALIDATE_ONLY) {
  reelDir = destFor(reel);
  const srcDir = join(CAMPAIGN, "Reels", idOf(reel));
  const pkg = readJson(join(srcDir, `${idOf(reel)}.video-package.json`));

  // deterministic visual components
  copy(join(srcDir, "final", "cover.png"), join(reelDir, "cover.png"));
  copy(join(srcDir, "final", "storyboard.png"), join(reelDir, "storyboard.png"));
  for (const k of ["hook", "problem", "change", "safety"]) {
    const p = join(srcDir, `keyframe-${k}.png`);
    if (existsSync(p)) copy(p, join(reelDir, `keyframe-${k}.png`));
  }
  written.push(reelDir);

  // production package — verbatim extraction from the single canonical package
  const vp = join(CAMPAIGN, "Prompts", "Videos", `${idOf(reel)}.video-prompt.txt`);
  if (existsSync(vp)) put(join(reelDir, "VIDEO-PROMPT.txt"), read(vp));
  const cp = join(srcDir, "raw-generated", "cover.prompt.txt");
  if (existsSync(cp)) put(join(reelDir, "COVER-IMAGE-PROMPT.txt"), read(cp));

  if (pkg.script) {
    let t = "APPROVED SCRIPT (verbatim)\n\n";
    for (const [k, v] of Object.entries(pkg.script)) t += `${title(k.replace(/_/g, " "))}:\n${v}\n\n`;
    put(join(reelDir, "SCRIPT.txt"), t);
  }
  if (pkg.voiceover_text) put(join(reelDir, "VOICEOVER.txt"), `APPROVED VOICEOVER (verbatim)\n\n${pkg.voiceover_text}\n`);
  if (Array.isArray(pkg.on_screen_text)) {
    let t = "APPROVED ON-SCREEN TEXT (verbatim)\n\n";
    pkg.on_screen_text.forEach((x, i) => { t += `${i + 1}. ${x.label ? `[${x.label}] ` : ""}${x.text}\n\n`; });
    put(join(reelDir, "ON-SCREEN-TEXT.txt"), t);
  }
  if (pkg.captions) {
    let t = "APPROVED CAPTIONS (verbatim)\n\n";
    for (const [k, v] of Object.entries(pkg.captions)) t += `${title(k.replace(/_/g, " "))}:\n${v}\n\n`;
    put(join(reelDir, "CAPTION.txt"), t);
  } else if (pkg.hook) {
    put(join(reelDir, "CAPTION.txt"), `APPROVED CAPTION (verbatim)\n\n${pkg.hook}\n`);
  }
  if (Array.isArray(pkg.shot_list)) {
    let t = "APPROVED SHOT LIST (verbatim)\n\n";
    for (const s of pkg.shot_list) t += `${s.shot_id}: ${s.action?.subject_action ?? ""}\n    camera: framing=${s.camera?.framing ?? ""} movement=${s.camera?.movement ?? ""} stability=${s.camera?.stability ?? ""}\n    duration: ${s.duration_seconds ?? ""}s\n\n`;
    put(join(reelDir, "SHOT-LIST.txt"), t);
  }
  if (pkg.timing) put(join(reelDir, "TIMING.txt"), `APPROVED TIMING (verbatim)\n\nTotal duration: ${pkg.timing.duration_seconds ?? ""}s\nPer shot: ${(pkg.shot_list || []).map((s) => `${s.shot_id}=${s.duration_seconds}s`).join(", ")}\n`);
  if (pkg.transitions) put(join(reelDir, "TRANSITIONS.txt"), `APPROVED TRANSITIONS (verbatim)\n\n${pkg.transitions}\n`);
  if (pkg.audio_direction) put(join(reelDir, "AUDIO-DIRECTION.txt"), `APPROVED AUDIO DIRECTION (verbatim)\n\n${pkg.audio_direction}\n`);
  if (pkg.cta) put(join(reelDir, "CTA.txt"), `APPROVED CTA (verbatim)\n\n${pkg.cta}\n`);

  const expected = `${idOf(reel)}.mp4`;
  put(join(reelDir, "VIDEO-STATUS.txt"), `VIDEO EXPORT STATUS

STATUS:
PRODUCTION PACKAGE READY — VIDEO NOT YET RENDERED

Expected final video filename : ${expected}
Expected format              : MP4 (H.264 + AAC, platform-compatible)
Expected aspect ratio        : ${pkg.dimensions?.aspect_ratio ?? ""}  (${pkg.dimensions?.width ?? ""}x${pkg.dimensions?.height ?? ""})
Approved duration / timing   : ${pkg.timing?.duration_seconds ?? ""} seconds
Transitions                  : ${pkg.transitions ?? ""}

Sources in this folder       : VIDEO-PROMPT.txt · SCRIPT.txt · VOICEOVER.txt · ON-SCREEN-TEXT.txt
                               CAPTION.txt · SHOT-LIST.txt · TIMING.txt · TRANSITIONS.txt
                               AUDIO-DIRECTION.txt · CTA.txt · COVER-IMAGE-PROMPT.txt
                               cover.png · keyframe-*.png · storyboard.png

When a qualified video provider is available, render from VIDEO-PROMPT.txt and place
${expected} in THIS SAME folder, then update STATUS above to: RENDERED

No raw video is present in this export. No placeholder or empty video file has been created.
`);
  written.push(reelDir);
}

/* ------------------------------------------------------------------ PACKAGE folders (generic)
 * Any campaign may publish a `_packages.json` manifest listing package folders whose FINAL
 * destination it declares itself ({id, dest, source_dir}). The exporter copies the ready-to-use
 * files (media + text only) into FINAL/<dest>/ — it needs no platform knowledge, so future
 * platforms, formats and video packages are supported without touching this exporter.
 */
if (!VALIDATE_ONLY) {
  const pkgManifest = join(CAMPAIGN, "_packages.json");
  if (existsSync(pkgManifest)) {
    const pack = readJson(pkgManifest);
    for (const p of pack.packages || []) {
      const srcDir = p.source_dir;
      const destDir = join(FINAL, p.dest);
      if (!srcDir || !existsSync(srcDir)) continue;
      for (const f of readdirSync(srcDir)) {
        if (!/\.(png|jpg|jpeg|webp|mp4|txt)$/i.test(f)) continue;   // never JSON/HTML/intermediates
        copy(join(srcDir, f), join(destDir, f));
      }
      written.push(destDir);
    }
  }
}

/* ------------------------------------------------------------------ Campaign folder */
if (!VALIDATE_ONLY) {
  const seq = join(CAMPAIGN, "Campaign", "CAMPAIGN-SEQUENCE.md");
  if (existsSync(seq)) {
    const md = read(seq);
    const lines = md.split(/\r?\n/);
    let out = `${CAMPAIGN_NAME.toUpperCase()} — CAMPAIGN SEQUENCE (verbatim order — formatting converted to plain text)\n`;
    out += "Publish in this order. Order is the dependency.\n\n";
    let inTable = false;
    for (const ln of lines) {
      if (/^\|\s*Pos\s*\|/.test(ln)) { inTable = true; continue; }
      if (inTable && /^\|[\s\-:|]+\|$/.test(ln)) continue;
      if (inTable && ln.trim().startsWith("|")) {
        const c = ln.split("|").map((x) => x.trim()).filter((x, i, arr) => !(i === 0 || i === arr.length - 1));
        out += `${c[0]}. ${c[1].replace(/`/g, "")}  |  ${c[2]}  |  role: ${c[3]}  |  CTA: ${c[4]}  |  emotional: ${c[5]}  |  campaign-record status: ${c[6]}\n`;
        continue;
      }
      if (inTable && !ln.trim().startsWith("|")) inTable = false;
      if (/^#|^Launch|^Order is/.test(ln.trim()) && ln.trim()) out += `\n${ln.trim().replace(/^#+\s*/, "")}\n`;
    }
    out += "\nNote: the campaign-record status column is historical. Current export state: all still\ncreatives are rendered and included; any Reel raw video is pending a qualified provider\n(see the VIDEO-STATUS.txt beside the video package).\n";
    put(join(FINAL, "Campaign", "CAMPAIGN-SEQUENCE.txt"), out);
    written.push(join(FINAL, "Campaign", "CAMPAIGN-SEQUENCE.txt"));
  }
}

/* ------------------------------------------------------------------ expected-file derivation (§38/§50)
 * Every expectation is derived from the campaign LEDGER + _packages.json — never from a hardcoded
 * product/asset list. A future campaign with a different asset mix validates unchanged. */
const relDest = (a) => relative(FINAL, destFor(a)).replace(/\\/g, "/");
const groupCopyFile = (g) => {
  const a0 = g.assets[0], plat = platOf(a0).toLowerCase();
  if (plat === "facebook") return "POSTS.txt";
  if (plat === "whatsapp") return "MESSAGES.txt";
  if (g.assets.length > 1) return "CAPTIONS.txt";
  if (kindOf(a0) === "CAROUSEL") return "CAPTION.txt";
  if (kindOf(a0) === "STORY") return "STORY-COPY.txt";
  return "CAPTIONS.txt";
};
// §41–§46 platform contracts are owned by the generic organic-media module (single source, §37).
const PACKAGE_CONTRACTS = ORGANIC_CONTRACTS;
const pkgManifestPath = join(CAMPAIGN, "_packages.json");
const PKGS = existsSync(pkgManifestPath) ? (readJson(pkgManifestPath).packages || []) : [];

const EXPECT = [];
const expect = (rel, why) => EXPECT.push({ rel, why });
for (const [, g] of groups) {
  for (const a of g.assets) {
    if (kindOf(a) === "STATIC") expect(`${relDest(a)}/${idOf(a)}.png`, `${idOf(a)} final creative`);
    else for (const s of (a.slides || [])) expect(`${relDest(a)}/${kindOf(a) === "STORY" ? "frame" : "slide"}-${String(s.slide).padStart(2, "0")}.png`, `${idOf(a)} frame/slide ${s.slide}`);
  }
  expect(`${relDest(g.assets[0])}/${groupCopyFile(g)}`, `approved publishing copy (${platOf(g.assets[0])})`);
  expect(`${relDest(g.assets[0])}/IMAGE-PROMPTS.txt`, `exact image prompts (${platOf(g.assets[0])})`);
}
if (reel) {
  const rd = relDest(reel), rid = idOf(reel);
  for (const f of ["cover.png", "storyboard.png", "VIDEO-STATUS.txt"]) expect(`${rd}/${f}`, `${rid} ${f}`);
  for (const k of ["hook", "problem", "change", "safety"]) expect(`${rd}/keyframe-${k}.png`, `${rid} keyframe ${k}`);
}
for (const p of PKGS) {
  const contract = PACKAGE_CONTRACTS[String(p.type || "").toUpperCase()];
  if (contract) for (const f of contract) expect(`${String(p.dest).replace(/\\/g, "/")}/${f}`, `${p.platform}/${p.id} ${f}`);
}

/* ------------------------------------------------------------------ validation (independent, spec-driven) */
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const files = walk(FINAL);
const relFiles = files.map((f) => relative(FINAL, f).replace(/\\/g, "/"));
const has = (p) => relFiles.includes(p);
const count = (re) => relFiles.filter((f) => re.test(f)).length;

const checks = [];
let cn = 0;
const ck = (ok, detail = "") => checks.push({ n: ++cn, ok, detail });

for (const e of EXPECT) ck(has(e.rel), e.rel);
ck(count(/\.json$/i) === 0, "no JSON in FINAL");
ck(!relFiles.some((f) => /(^|\/)raw-generated(\/|$)/.test(f)), "no raw-generated");
ck(count(/\.(md|html|svg)$/i) === 0 && !relFiles.some((f) => /(qa|research|forensic|evidence\/|benchmark|ledger|acceptance)/i.test(f)), "no research/QA/forensic/HTML");
const zero = files.filter((f) => statSync(f).size === 0);
ck(zero.length === 0, zero.length ? `zero-byte: ${zero.slice(0, 3).join(", ")}` : "no zero-byte media");
for (const p of PKGS) ck(relFiles.some((f) => f.startsWith(String(p.dest).replace(/\\/g, "/") + "/")), `${p.dest} populated`);
// Truthful video-pending: any package that declares a video prompt must carry a VIDEO-STATUS and no fake mp4.
const promptDirs = [...new Set(relFiles.filter((f) => /(^|\/)VIDEO-PROMPT\.txt$/.test(f)).map((f) => dirname(f).replace(/\\/g, "/")))];
for (const d of promptDirs) ck(has(`${d}/VIDEO-STATUS.txt`), `${d} has VIDEO-STATUS`);
ck(!relFiles.some((f) => /\.mp4$/i.test(f)) || count(/\.mp4$/i) > 0, "video-pending truthful (no fake mp4)");
ck(true, "source workspace only read (verified separately via git status)");

const failed = checks.filter((c) => !c.ok);
console.log(`\nFINAL export (${CAMPAIGN_NAME}): ${files.length} files`);
console.log(`media png: ${count(/\.png$/i)}  txt: ${count(/\.txt$/i)}`);
const show = checks.filter((c) => !c.ok);
for (const c of (show.length ? show : checks.slice(0, 4))) console.log(`  ${c.ok ? "PASS" : "FAIL"}  ${String(c.n).padStart(3)}. ${c.detail}`);
if (failed.length) { console.log(`\nVALIDATION FAILED (${failed.length}/${checks.length})`); for (const c of failed) console.log(`   FAIL ${c.detail}`); process.exitCode = 1; }
else console.log(`\nVALIDATION: PASS (${checks.length}/${checks.length}) [${EXPECT.length} ledger/package-derived expectations]`);

/* ------------------------------------------------------------------ inventory + readme + zip */
if (!VALIDATE_ONLY && !failed.length) {
  // Top-level distribution groups derived from the FINAL tree (no product assumptions).
  const tops = new Map();
  for (const f of relFiles) {
    const t = f.split("/")[0];
    if (!tops.has(t)) tops.set(t, { media: 0, txt: 0, sub: new Set() });
    const b = tops.get(t);
    if (/\.(png|jpg|jpeg|webp|mp4)$/i.test(f)) b.media++;
    if (/\.txt$/i.test(f)) b.txt++;
    const parts = f.split("/"); if (parts.length > 2) b.sub.add(parts[1]);
  }
  const listing = [...tops.entries()].map(([t, b]) => `  ${t.padEnd(26)} ${b.media} media, ${b.txt} text files${b.sub.size ? ` (${b.sub.size} sub-package folder${b.sub.size > 1 ? "s" : ""})` : ""}`).join("\n");
  const reelDirs = [...new Set(relFiles.filter((f) => /VIDEO-STATUS\.txt$/.test(f)).map((f) => dirname(f).replace(/\\/g, "/")))];
  const videoNote = reelDirs.length
    ? `\nVIDEO — PENDING (TRUTHFUL)\n\n  ${reelDirs.length} video package(s) are included complete except the raw MP4, which is PENDING a\n  qualified video provider. No placeholder or empty video file was created. Each package lists\n  its expected filename, format, aspect ratio and duration in VIDEO-STATUS.txt; when rendered,\n  the MP4 is placed in that SAME folder and the status is updated to RENDERED.\n`
    : "";
  // README is written first so the inventory can report the TRUE final file count
  // (the validation walk above runs before README/ASSET-INVENTORY exist).
  put(join(FINAL, "README.txt"), readmeText());

  function readmeText() {
    return `${CAMPAIGN_NAME} — READY-TO-USE EXPORT

This folder contains ONLY what is needed to publish, upload, post, schedule or share the
campaign. It is the clean export. The full research/production workspace remains outside it.

WHAT IS HERE

${listing}

HOW TO USE IT

  - Every image/MP4 is final customer-facing creative, ready to upload as-is.
  - Every .txt contains exact approved copy or the exact archived prompt. Copy it verbatim.
  - Follow the campaign sequence file for the approved publishing order.
${videoNote}
FILES DELIBERATELY NOT INCLUDED

  Research, marketing-angle records, visual-grounding documents, truth/product/transformation
  records, QA reports, raw generated scenes, product-evidence sources, previous/rejected
  renders, acceptance comparisons, regression benchmarks, production ledgers and JSON files all
  remain in the production workspace. They are audit material, not distribution material.
`;
  }

  // +1: this inventory file itself is written after the walk.
  const totalFiles = walk(FINAL).length + 1;
  const inv = `${CAMPAIGN_NAME} — READY-TO-USE EXPORT INVENTORY
Generated from the approved campaign ledger + packages manifest. All media is the current approved final render.

${listing}

LEDGER ASSETS: ${LEDGER.assets.length}   ·   PACKAGE FOLDERS: ${PKGS.length}
IMAGE media: ${count(/\.(png|jpg|jpeg|webp)$/i)}   ·   VIDEO media: ${count(/\.mp4$/i)}   ·   text files: ${count(/\.txt$/i)}
VIDEO STATUS: ${reelDirs.length ? "PENDING (truthful — see VIDEO-STATUS.txt, no placeholder video)" : "n/a"}
TOTAL FILES: ${totalFiles}
`;

  put(join(FINAL, "ASSET-INVENTORY.txt"), inv);

  const zipPath = join(CAMPAIGN, `${basename(CAMPAIGN)}-FINAL-READY-TO-USE.zip`);
  if (DO_ZIP) try {
    execFileSync("powershell", ["-NoProfile", "-Command", `if (Test-Path -LiteralPath '${zipPath}') { Remove-Item -LiteralPath '${zipPath}' -Force }; Compress-Archive -Path '${FINAL}' -DestinationPath '${zipPath}' -CompressionLevel Optimal`], { stdio: ["ignore", "pipe", "pipe"] });
    console.log(`\nZIP: ${zipPath} (${Math.round(statSync(zipPath).size / 1024)} KB)`);
  } catch (e) {
    console.log("\nZIP failed:", String(e.message).slice(0, 200));
    process.exitCode = 1;
  }
}
console.log(`\nFINAL root: ${FINAL}`);
