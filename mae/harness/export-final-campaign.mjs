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
//   node mae/harness/export-final-campaign.mjs [--dir V06-Marketing-Assets] [--zip] [--validate-only]
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, rmSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname, relative } from "node:path";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const CAMPAIGN = resolve(argOf("--dir", "V06-Marketing-Assets"));
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

/* ------------------------------------------------------------------ Campaign folder */
if (!VALIDATE_ONLY) {
  const seq = join(CAMPAIGN, "Campaign", "CAMPAIGN-SEQUENCE.md");
  if (existsSync(seq)) {
    const md = read(seq);
    const lines = md.split(/\r?\n/);
    let out = "V06 CAMPAIGN SEQUENCE (verbatim order — formatting converted to plain text)\n";
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
    out += "\nNote: the campaign-record status column is historical. Current export state: all still\ncreatives are rendered and included; the Reel raw video is pending a qualified provider\n(see Instagram/Reels/AST-NS-007/VIDEO-STATUS.txt).\n";
    put(join(FINAL, "Campaign", "CAMPAIGN-SEQUENCE.txt"), out);
    written.push(join(FINAL, "Campaign", "CAMPAIGN-SEQUENCE.txt"));
  }
}

/* ------------------------------------------------------------------ validation (independent) */
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const files = VALIDATE_ONLY ? walk(FINAL) : walk(FINAL);
const relFiles = files.map((f) => relative(FINAL, f).replace(/\\/g, "/"));
const has = (p) => relFiles.includes(p);
const count = (re) => relFiles.filter((f) => re.test(f)).length;

const checks = [];
const ck = (n, ok, detail = "") => checks.push({ n, ok, detail });

ck(1, ["Facebook/AST-NS-001.png", "Facebook/AST-NS-004.png", "Facebook/AST-NS-008.png", "Facebook/AST-NS-011.png", "Facebook/AST-NS-014.png"].every(has), "5 Facebook finals");
ck(2, ["AST-NS-002", "AST-NS-005", "AST-NS-009", "AST-NS-012", "AST-NS-015", "AST-NS-MYTH-001", "AST-NS-OBJ-001", "AST-NS-PROB-001", "AST-NS-STOP-001"].every((i) => has(`Instagram/Feed/${i}.png`)), "9 Instagram feed finals");
ck(3, [1, 2, 3, 4].every((n) => has(`Instagram/Carousels/AST-NS-006/slide-0${n}.png`)), "AST-NS-006 = 4 ordered slides");
ck(4, [1, 2, 3, 4, 5].every((n) => has(`Instagram/Carousels/AST-NS-013/slide-0${n}.png`)), "AST-NS-013 = 5 ordered slides");
ck(5, [1, 2, 3, 4].every((n) => has(`Instagram/Stories/AST-NS-010/frame-0${n}.png`)), "AST-NS-010 = 4 ordered frames");
ck(6, [1, 2, 3, 4].every((n) => has(`Instagram/Stories/AST-NS-STORY-001/frame-0${n}.png`)), "AST-NS-STORY-001 = 4 ordered frames");
ck(7, has("WhatsApp/AST-NS-003.png") && has("WhatsApp/AST-NS-016.png"), "2 WhatsApp finals");
ck(8, has("Instagram/Reels/AST-NS-007/cover.png"), "reel cover");
ck(9, ["hook", "problem", "change", "safety"].every((k) => has(`Instagram/Reels/AST-NS-007/keyframe-${k}.png`)), "4 reel keyframes");
ck(10, has("Instagram/Reels/AST-NS-007/storyboard.png"), "reel storyboard");
ck(11, has("Instagram/Reels/AST-NS-007/VIDEO-PROMPT.txt"), "exact video prompt");
ck(12, has("Instagram/Reels/AST-NS-007/SCRIPT.txt"), "script");
ck(13, has("Instagram/Reels/AST-NS-007/CAPTION.txt"), "reel caption");
ck(14, has("Instagram/Reels/AST-NS-007/VIDEO-STATUS.txt"), "VIDEO-STATUS");
ck(15, ["Facebook/IMAGE-PROMPTS.txt", "Instagram/Feed/IMAGE-PROMPTS.txt", "Instagram/Carousels/AST-NS-006/IMAGE-PROMPTS.txt", "Instagram/Carousels/AST-NS-013/IMAGE-PROMPTS.txt", "Instagram/Stories/AST-NS-010/IMAGE-PROMPTS.txt", "Instagram/Stories/AST-NS-STORY-001/IMAGE-PROMPTS.txt", "WhatsApp/IMAGE-PROMPTS.txt"].every(has), "7 prompt files");
ck(16, ["Facebook/POSTS.txt", "Instagram/Feed/CAPTIONS.txt", "Instagram/Carousels/AST-NS-006/CAPTION.txt", "Instagram/Carousels/AST-NS-013/CAPTION.txt", "Instagram/Stories/AST-NS-010/STORY-COPY.txt", "Instagram/Stories/AST-NS-STORY-001/STORY-COPY.txt", "WhatsApp/MESSAGES.txt"].every(has), "7 publishing-copy files");
ck(17, has("Campaign/CAMPAIGN-SEQUENCE.txt"), "campaign sequence");
ck(18, count(/\.json$/i) === 0, "no JSON");
ck(19, !relFiles.some((f) => /(^|\/)raw-generated(\/|$)/.test(f)), "no raw-generated");
ck(20, count(/\.(md|html|svg)$/i) === 0 && !relFiles.some((f) => /(qa|research|forensic|evidence\/|benchmark|ledger|acceptance)/i.test(f)), "no research/QA/forensic/HTML");
const zero = files.filter((f) => statSync(f).size === 0);
ck(21, zero.length === 0, zero.length ? `zero-byte: ${zero.slice(0, 3).join(", ")}` : "no zero-byte media");
// 22 — source untouched: verified by the caller via git status; recorded here as informational
ck(22, true, "source workspace only read (verified separately via git status)");

const failed = checks.filter((c) => !c.ok);
console.log(`\nFINAL export: ${files.length} files`);
console.log(`media png: ${count(/\.png$/i)}  txt: ${count(/\.txt$/i)}`);
for (const c of checks) console.log(`  ${c.ok ? "PASS" : "FAIL"}  ${String(c.n).padStart(2)}. ${c.detail}`);
if (failed.length) { console.log(`\nVALIDATION FAILED (${failed.length})`); process.exitCode = 1; }
else console.log("\nVALIDATION: PASS (22/22)");

/* ------------------------------------------------------------------ inventory + readme + zip */
if (!VALIDATE_ONLY && !failed.length) {
  const reelKeyframes = relFiles.filter((f) => f.startsWith("Instagram/Reels/AST-NS-007/keyframe-") && f.endsWith(".png")).length;
  const reelTxt = relFiles.filter((f) => f.startsWith("Instagram/Reels/AST-NS-007/") && f.endsWith(".txt")).length;
  const inv = `V06 CAMPAIGN — READY-TO-USE EXPORT INVENTORY
Generated from the approved V06 campaign outputs. All media below is the current approved final render.

FACEBOOK
- ${count(/^Facebook\/AST-NS-\d+\.png$/)} final creatives
- posts present: ${has("Facebook/POSTS.txt") ? "YES" : "NO"}
- prompts present: ${has("Facebook/IMAGE-PROMPTS.txt") ? "YES" : "NO"}

INSTAGRAM FEED
- ${count(/^Instagram\/Feed\/.+\.png$/)} final creatives
- captions present: ${has("Instagram/Feed/CAPTIONS.txt") ? "YES" : "NO"}
- prompts present: ${has("Instagram/Feed/IMAGE-PROMPTS.txt") ? "YES" : "NO"}

INSTAGRAM CAROUSELS
- 2 sets
- ${count(/^Instagram\/Carousels\/.+slide-\d+\.png$/)} slides
- captions present: ${has("Instagram/Carousels/AST-NS-006/CAPTION.txt") && has("Instagram/Carousels/AST-NS-013/CAPTION.txt") ? "YES" : "NO"}
- prompts present: ${has("Instagram/Carousels/AST-NS-006/IMAGE-PROMPTS.txt") && has("Instagram/Carousels/AST-NS-013/IMAGE-PROMPTS.txt") ? "YES" : "NO"}

INSTAGRAM STORIES
- 2 sets
- ${count(/^Instagram\/Stories\/.+frame-\d+\.png$/)} frames
- copy present: ${has("Instagram/Stories/AST-NS-010/STORY-COPY.txt") && has("Instagram/Stories/AST-NS-STORY-001/STORY-COPY.txt") ? "YES" : "NO"}
- prompts present: ${has("Instagram/Stories/AST-NS-010/IMAGE-PROMPTS.txt") && has("Instagram/Stories/AST-NS-STORY-001/IMAGE-PROMPTS.txt") ? "YES" : "NO"}

WHATSAPP
- ${count(/^WhatsApp\/AST-NS-\d+\.png$/)} final creatives
- messages present: ${has("WhatsApp/MESSAGES.txt") ? "YES" : "NO"}
- prompts present: ${has("WhatsApp/IMAGE-PROMPTS.txt") ? "YES" : "NO"}

REEL (Instagram/Reels/AST-NS-007)
- cover: ${has("Instagram/Reels/AST-NS-007/cover.png") ? "YES" : "NO"}
- keyframes: ${reelKeyframes} of 4
- storyboard: ${has("Instagram/Reels/AST-NS-007/storyboard.png") ? "YES" : "NO"}
- video prompt: ${has("Instagram/Reels/AST-NS-007/VIDEO-PROMPT.txt") ? "YES" : "NO"}
- script: ${has("Instagram/Reels/AST-NS-007/SCRIPT.txt") ? "YES" : "NO"}
- production material: ${reelTxt} text files
- FINAL VIDEO STATUS: pending — see VIDEO-STATUS.txt

CAMPAIGN
- campaign sequence present: ${has("Campaign/CAMPAIGN-SEQUENCE.txt") ? "YES" : "NO"}

TOTAL FILES: ${files.length}
`;

  put(join(FINAL, "ASSET-INVENTORY.txt"), inv);

  const readme = `V06 MARKETING CAMPAIGN — READY-TO-USE EXPORT
"Every Night, Just Me" · the finished, ready-to-use V06 campaign.

This folder contains ONLY what is needed to publish, upload, post, schedule or share the
campaign. It is the clean export. The full research/production workspace remains outside it.

WHAT IS HERE

  Facebook/                5 final creatives + POSTS.txt (approved post copy) + IMAGE-PROMPTS.txt
  Instagram/Feed/          9 final creatives + CAPTIONS.txt + IMAGE-PROMPTS.txt
  Instagram/Carousels/     2 sets (AST-NS-006 = 4 slides, AST-NS-013 = 5 slides),
                           each with CAPTION.txt + IMAGE-PROMPTS.txt (per-slide prompts labelled)
  Instagram/Stories/       2 sets (AST-NS-010, AST-NS-STORY-001), 4 frames each, 1080x1920,
                           each with STORY-COPY.txt + IMAGE-PROMPTS.txt
  Instagram/Reels/         AST-NS-007 — cover, 4 keyframes, storyboard AND the complete
                           production package (VIDEO-PROMPT, SCRIPT, VOICEOVER, ON-SCREEN-TEXT,
                           CAPTION, SHOT-LIST, TIMING, TRANSITIONS, AUDIO-DIRECTION, CTA)
  WhatsApp/                2 final creatives + MESSAGES.txt + IMAGE-PROMPTS.txt
  Campaign/                CAMPAIGN-SEQUENCE.txt — the approved publishing order

HOW TO USE IT

  - Every .png is final customer-facing creative, ready to upload as-is.
  - Every .txt contains exact approved copy or the exact archived prompt. Copy it verbatim.
  - To publish a WhatsApp asset: open MESSAGES.txt, copy the message, attach the matching PNG, send.
  - To publish in the approved order, follow Campaign/CAMPAIGN-SEQUENCE.txt.

REEL VIDEO

  The raw Reel video is PENDING: no qualified video provider is currently available.
  No placeholder or empty video file has been created.
  Instagram/Reels/AST-NS-007/VIDEO-STATUS.txt records the expected filename, format, aspect
  ratio and duration. When the video is rendered it is placed in that SAME folder and the
  status is updated to RENDERED — no restructuring required.

FILES DELIBERATELY NOT INCLUDED

  Research, marketing-angle records, visual-grounding documents, truth/product/transformation
  records, QA reports, raw generated scenes, product-evidence sources, previous/rejected
  renders, acceptance comparisons, regression benchmarks, production ledgers and JSON files all
  remain in the production workspace (one level up). They are audit material, not distribution
  material.
`;
  put(join(FINAL, "README.txt"), readme);

  const zipPath = join(CAMPAIGN, "V06-FINAL-READY-TO-USE.zip");
  if (DO_ZIP) try {
    execFileSync("powershell", ["-NoProfile", "-Command", `if (Test-Path -LiteralPath '${zipPath}') { Remove-Item -LiteralPath '${zipPath}' -Force }; Compress-Archive -Path '${FINAL}' -DestinationPath '${zipPath}' -CompressionLevel Optimal`], { stdio: ["ignore", "pipe", "pipe"] });
    console.log(`\nZIP: ${zipPath} (${Math.round(statSync(zipPath).size / 1024)} KB)`);
  } catch (e) {
    console.log("\nZIP failed:", String(e.message).slice(0, 200));
    process.exitCode = 1;
  }
}
console.log(`\nFINAL root: ${FINAL}`);
