// V06 COMPLETE MARKETING CAMPAIGN PRODUCTION — full builder.
// Production only: consumes approved MAE records; never invents angle/copy/truth; no provider spend.
// Static + multi-panel visuals use the qualified deterministic compositor. Where approved copy cannot
// fit the approved layout, the asset receives a complete PRODUCTION_PACKAGE_READY manual package.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync, statSync } from "node:fs";
import { join, dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { compileVideoPromptPackage, canonicalVideoRequest } from "../media/video-prompt-compiler.js";
import {
  produceStatic, produceMultiPanel, ledgerOf, loadJson, ensureDir, writeJson, writeText, DES_FOR_ASSET,
} from "./produce-v06-campaign.mjs";
import {
  OUT, ROOT, ASSETS, rasterSvg, pngDims, noPlaceholders, FAMILY_VGB, FAMILY_PROFILE,
} from "./campaign-lib.mjs";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const TEMP = "C:\\Users\\HPM6\\AppData\\Local\\Temp\\opencode";
const PRODUCT_PDF = join(TEMP, "v06-corrected.pdf");
const STATIC_DIRS = { facebook: "Facebook", instagram: "Instagram", whatsapp: "WhatsApp" };

// ---------------------------------------------------------------- helpers
const copyOf = (a) => a.content || {};
const desIdFor = (id) => DES_FOR_ASSET[id];
const dirFor = (a) => join(OUT, STATIC_DIRS[a.platform] || "Instagram", a.id);

function writeCopyPackage(a) {
  const c = copyOf(a);
  const des = desIdFor(a.id) ? loadJson(`mae/data/design-specs/${desIdFor(a.id)}.json`) : null;
  const cta = des && des.copy_blocks ? (des.copy_blocks.cta ? des.copy_blocks.cta.text : null) : null;
  const pkg = {
    asset_id: a.id, platform: a.platform, asset_type: a.asset_type, format: a.platform_format,
    angle_id: a.angle_id, family_id: a.family_id, purpose: a.asset_purpose, cta_level: a.cta_level,
    locked_phrase_set_id: a.locked_phrase_set_id || null, evidence_label: a.angle_verdict || null,
    family_visual_grounding: FAMILY_VGB[a.family_id] || null,
    weighting_profile: FAMILY_PROFILE[a.family_id] || null,
    visual_copy_on_image: des ? (des.copy_blocks ? Object.values(des.copy_blocks).map((v) => v.text) : []) : [],
    cta_text: cta,
    post_copy: c,
    source: a.id + " (approved asset record; byte-identical)",
  };
  writeJson(join(dirFor(a), `${a.id}.copy.json`), pkg);
  const lines = [`# ${a.id} — social copy`, "", `- platform: ${a.platform}`, `- type: ${a.asset_type} (${a.platform_format})`,
    `- angle: ${a.angle_id}`, `- family: ${a.family_id}`, `- CTA level: ${a.cta_level}`, `- CTA text: ${cta || "(none)"}`,
    `- locked phrase set: ${a.locked_phrase_set_id || "(none)"}`, "", "## Visual copy (on image, verbatim from paired design spec)", ""];
  for (const t of pkg.visual_copy_on_image) lines.push(`> ${t}`, "");
  lines.push("## Post copy (verbatim from asset record)", "");
  if (c.hook_text) lines.push(`**Hook:** ${c.hook_text}`, "");
  if (c.problem_text) lines.push(`**Problem:** ${c.problem_text}`, "");
  if (c.bold_line) lines.push(`**Bold line:** ${c.bold_line}`, "");
  if (c.script) { lines.push("**Reel script (verbatim):**", ""); for (const [k, v] of Object.entries(c.script)) lines.push(`- ${k}: ${v}`); lines.push(""); }
  if (c.slides) { lines.push("**Carousel post copy (verbatim):**", ""); c.slides.forEach((s, i) => lines.push(`${i + 1}. (${s.style}) ${s.text}`)); lines.push(""); }
  if (c.sequence) { lines.push("**Story copy (verbatim):**", ""); c.sequence.forEach((s) => lines.push(`${s.step}. (${s.type}) ${s.text}`)); lines.push(""); }
  writeText(join(dirFor(a), `${a.id}.copy.md`), lines.join("\n"));
  return pkg;
}

// Standalone, complete image-generation prompt. No hidden SWIIPT context needed.
function imagePrompt(a, extra = {}) {
  const vgb = FAMILY_VGB[a.family_id] ? loadJson(`mae/data/visual-groundings/${FAMILY_VGB[a.family_id]}.json`) : null;
  const des = desIdFor(a.id) ? loadJson(`mae/data/design-specs/${desIdFor(a.id)}.json`) : null;
  const w = des?.canvas?.width || (a.platform_format === "story_vertical" ? 1080 : 1080);
  const h = des?.canvas?.height || (a.platform_format === "story_vertical" ? 1920 : 1080);
  const lines = [];
  lines.push(`IMAGE GENERATION PROMPT — ${a.id}`);
  lines.push(`Asset: ${a.id} · ${a.platform} · ${a.asset_type} (${a.platform_format}) · angle ${a.angle_id}`);
  lines.push(`Intended dimensions: ${w}×${h} px ${extra.slide ? `· slide ${extra.slide}` : ""}`);
  lines.push("");
  lines.push("SUBJECT:");
  lines.push(vgb ? `  ${vgb.subject}` : "  (no visual grounding block for this family)");
  if (vgb?.wardrobe) lines.push(`  Wardrobe: ${vgb.wardrobe}`);
  if (vgb?.gesture_posture) lines.push(`  Posture/gesture: ${vgb.gesture_posture}`);
  lines.push("ENVIRONMENT:");
  lines.push(vgb ? `  ${vgb.environment}` : "  (none specified)");
  if (vgb?.props?.length) lines.push(`  Props: ${vgb.props.join("; ")}`);
  lines.push("LIGHTING:");
  lines.push(vgb ? `  ${vgb.lighting}` : "  (none specified)");
  lines.push("COMPOSITION / FRAMING:");
  lines.push(vgb ? `  ${vgb.composition}` : "  (none specified)");
  if (vgb?.cultural_markers?.length) lines.push(`  Cultural markers (must be respected): ${vgb.cultural_markers.join("; ")}`);
  if (vgb?.emotional_tone) lines.push(`  Emotional tone: ${vgb.emotional_tone}`);
  lines.push("");
  lines.push("PRODUCT PLACEMENT:");
  lines.push("  Render NO text, logos, buttons or UI in the image. Reserved space for typography is provided");
  lines.push("  by the deterministic overlay below (important customer-facing text is never model-rendered).");
  lines.push("");
  lines.push("NEGATIVE / AVOID:");
  const neg = [...(vgb?.exclusions || [])];
  neg.push("no text, no letters, no words, no watermark, no logo, no user interface", "no gradient blobs", "no stock-photo perfection");
  for (const n of neg) lines.push(`  - ${n}`);
  lines.push("");
  lines.push("DETERMINISTIC TEXT OVERLAY (applied after generation, exact approved copy):");
  const blocks = des?.copy_blocks ? (Array.isArray(des.copy_blocks) ? des.copy_blocks.map((c) => `${c.role}: ${c.text}`) : Object.entries(des.copy_blocks).map(([k, v]) => `${k} (${v.role}): ${v.text}`))
    : [`hook: ${copyOf(a).hook_text || ""}`];
  for (const b of blocks) lines.push(`  - ${b}`);
  lines.push("");
  lines.push("BRAND:");
  lines.push("  SWIIPT system — navy #0B1F33, purple #6F35B5, gold #D9A52E, warm cream #F8F4EC; Inter + DM Serif Display only.");
  lines.push(`SOURCE: ${a.angle_id} / ${a.asset_brief_id} / ${a.id} — approved marketing records (no invented angle, claim or statistic).`);
  return lines.join("\n");
}

// ---------------------------------------------------------------- product mockups (real corrected V06)
function buildMockups() {
  const dir = join(OUT, "Product-Mockups");
  ensureDir(dir);
  const pages = ["page-03.png", "page-06.png", "page-08.png", "page-12.png", "page-14.png", "page-18.png", "page-19.png", "page-20.png"];
  const src = join(TEMP, "v06-pages");
  const copied = [];
  for (const p of pages) {
    const from = join(src, p);
    if (!existsSync(from)) continue;
    copyFileSync(from, join(dir, `V06-${p}`));
    copied.push(`V06-${p}`);
  }
  // phone mockup composition using the REAL corrected pages (Roster C + Rescue Card)
  const phone = (pagePng, outName, caption) => {
    const rel = "./" + pagePng;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;padding:0;background:#F8F4EC;font-family:Inter,sans-serif}
      .wrap{width:1080px;height:1080px;display:flex;align-items:center;justify-content:center;gap:40px}
      .phone{width:380px;height:780px;border-radius:52px;background:#0B1F33;padding:14px;box-shadow:0 30px 60px rgba(11,31,51,.35);position:relative}
      .screen{width:100%;height:100%;border-radius:40px;overflow:hidden;background:#fff;position:relative}
      .screen img{width:100%;display:block;margin-top:-120px}
      .notch{position:absolute;top:26px;left:50%;transform:translateX(-50%);width:120px;height:22px;border-radius:12px;background:#0B1F33;z-index:2}
      .cap{position:absolute;bottom:-60px;left:0;right:0;text-align:center;color:#0B1F33;font-size:22px;font-weight:600}
    </style></head><body><div class="wrap"><div class="phone"><div class="notch"></div><div class="screen"><img src="${rel}"></div><div class="cap">${caption}</div></div></div></body></html>`;
    const hp = join(dir, outName + ".html");
    writeText(hp, html);
    execFileSync(EDGE, ["--headless", "--disable-gpu", `--screenshot=${join(dir, outName + ".png")}`, "--window-size=1080,1080", hp], { timeout: 120000 });
    const d = pngDims(join(dir, outName + ".png"));
    return { file: join(dir, outName + ".png"), dims: d, source_page: pagePng };
  };
  const mocks = [];
  if (existsSync(join(src, "page-12.png"))) mocks.push(phone("V06-page-12.png", "mockup-phone-roster-c", "Roster C on screen (real corrected page)"));
  if (existsSync(join(src, "page-20.png"))) mocks.push(phone("V06-page-20.png", "mockup-phone-rescue-card", "Rescue Card on screen (real corrected page)"));
  writeJson(join(dir, "_mockups.json"), { source_pdf: basename(PRODUCT_PDF), pages_copied: copied, mockups: mocks });
  return { dir, copied, mocks };
}

// ---------------------------------------------------------------- reel video production package
function buildReel(a) {
  const dir = join(OUT, "Reels", a.id);
  ensureDir(dir);
  const vgb = loadJson(`mae/data/visual-groundings/${FAMILY_VGB[a.family_id]}.json`);
  const brief = loadJson(`mae/data/briefs/${a.asset_brief_id}.json`);
  const sc = copyOf(a).script || {};
  const duration = parseInt(String(brief.duration || "20").replace(/\D.*/, ""), 10) || 20;
  const grounding = {
    id: "VG-REEL-" + a.id, class: "video_grounding", angle_id: a.angle_id, product_id: a.product_id,
    subject: { description: vgb.subject, posture: vgb.gesture_posture, expression: vgb.emotional_tone, wardrobe: vgb.wardrobe, identity_continuity_requirements: ["same subject across all shots"], permitted_actions: ["domestic night-time tasks"], prohibited_actions: ["no clinical procedure", "no infant distress staging"] },
    environment: { location: vgb.environment, time_of_day: "night", lighting: vgb.lighting, props: vgb.props, cultural_markers: vgb.cultural_markers, background_requirements: ["relatable domestic interior"] },
    start_state: "Exhausted parent alone with the baby at night",
    motion: { primary_action: "slow hand-held push-in on the subject", secondary_actions: ["subtle head turn", "phone screen light"], gestures: ["rubbing eyes"], speed: "slow", direction: "toward camera", physical_constraints: ["no fast cuts"], prohibited_motion: ["no jump cuts", "no whip pan"] },
    camera: { framing: "medium close-up", position: "eye level", movement: "slow dolly in", focus_behavior: "shallow depth of field", stability: "handheld with mild sway" },
    timing: { total_duration_seconds: duration, action_timing: "continuous", hold_timing: "1s on the hook frame", transition_timing: "0.4s cross dissolves" },
    end_state: "Subject looks up with resolve, roster page visible on the table",
    continuity: "Same subject, wardrobe and room across every shot; phone as the only light source variation.",
    audio_intent: { mode: "NONE", notes: "silent render; music direction only if platform permits (see audio direction)" },
    text_policy: { generated_text_allowed: false, deterministic_overlay_text: true, captions: true, cta: true, logo: true },
    exclusions: { visual: vgb.exclusions || [], motion: ["no fast zooms"], cultural: ["no stereotyped imagery"], safety: ["no unsafe sleep depiction"], artifact: ["no text artifacts"] },
  };
  const shots = [
    { shot_id: "S1", action: { subject_action: "subject alone at night, exhausted" }, camera: { framing: "medium", movement: "static", stability: "locked" }, duration_seconds: Math.round(duration * 0.25) },
    { shot_id: "S2", action: { subject_action: "partner asleep, untouched night feed" }, camera: { framing: "wide", movement: "slow pan", stability: "handheld" }, duration_seconds: Math.round(duration * 0.25) },
    { shot_id: "S3", action: { subject_action: "roster page being filled at the table" }, camera: { framing: "insert", movement: "push in", stability: "handheld" }, duration_seconds: Math.round(duration * 0.25) },
    { shot_id: "S4", action: { subject_action: "resolve: named shift written, partner takes over" }, camera: { framing: "medium close-up", movement: "static", stability: "locked" }, duration_seconds: Math.round(duration * 0.25) },
  ];
  const assetSpec = {
    video_asset_id: "VID-" + a.id, angle_id: a.angle_id, video_grounding_id: grounding.id,
    video_type: "SOCIAL_REEL", production_mode: "VIDEO_PACKAGE", duration_seconds: duration,
    aspect_ratio: "9:16", width: 1080, height: 1920, fps: 30, audio_policy: "NONE", loop: true, shots,
  };
  const pkg = compileVideoPromptPackage({ grounding, assetSpec });
  const req = canonicalVideoRequest({ promptPackage: pkg, assetSpec, grounding });
  // deterministic cover + keyframe text frames from the approved script (no provider needed)
  const frames = [];
  const frameText = [["HOOK", sc.opening_hook], ["PROBLEM", sc.problem_narrative], ["CHANGE", sc.desired_change], ["SAFETY", sc.safety_line]];
  for (const [label, text] of frameText) {
    if (!text) continue;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920"><rect width="1080" height="1920" fill="#0B1F33"/>` +
      `<text x="72" y="200" font-family="Inter, sans-serif" font-size="30" font-weight="600" fill="#D9A52E" letter-spacing="2">${label}</text>` +
      `<foreignObject x="72" y="260" width="936" height="1400"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Inter,sans-serif;color:#FFFFFF;font-size:46px;line-height:1.35;font-weight:600">${String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div></foreignObject></svg>`;
    const f = join(dir, `keyframe-${label.toLowerCase()}.png`);
    writeText(f.replace(/\.png$/, ".svg"), svg);
    rasterSvg(svg, 1080, 1920, f);
    frames.push({ label, text, file: f });
  }
  writeJson(join(dir, `${a.id}.video-package.json`), { asset_id: a.id, angle_id: a.angle_id, concept: pkg.metadata, hook: sc.opening_hook, script: sc, voiceover_text: sc.opening_hook, shot_list: shots, storyboard: shots, on_screen_text: frameText.map(([l, t]) => ({ label: l, text: t })), captions: sc, timing: { duration_seconds: duration }, transitions: "0.4s cross dissolve", camera_instructions: grounding.camera, product_evidence: ["Roster sheet (real corrected V06 page 12)", "Fridge Shift Chart (page 18)"], b_roll: ["night-time hands, crib, paused kettle"], cta: "See the system that ends the argument", audio_direction: "platform-permitted music only; no invented claims", dimensions: { width: 1080, height: 1920, aspect_ratio: "9:16" }, thumbnail: frames[0]?.file || null, video_generation_prompt: req.prompt, negative_prompt: req.negative_prompt, still_prompts: [{ shot_id: "S1", prompt: imagePrompt(a) }], manual_instructions: "Assemble the 4 shots, overlay the approved on-screen text verbatim, burn captions, keep the navy/gold system. No text may be model-generated." });
  writeText(join(dir, `${a.id}.video-prompt.txt`), `VIDEO GENERATION PROMPT — ${a.id}\n\n${req.prompt}\n\nNEGATIVE PROMPT:\n${req.negative_prompt}\n`);
  return { asset: a.id, dir, frames, duration, prompt_chars: req.prompt.length };
}

// ---------------------------------------------------------------- build everything
export function buildCampaign() {
  ensureDir(OUT);
  const out = { statics: [], multis: [], copies: [], image_prompts: 0, mockups: null, reel: null };
  for (const id of ASSETS) {
    const a = loadJson(`mae/data/assets/${id}.json`);
    if (a.asset_type === "SOCIAL_STATIC" || (a.asset_type === "GENERIC" && a.platform === "whatsapp")) {
      out.statics.push(produceStatic(id));
    } else if (a.asset_type === "SOCIAL_CAROUSEL" || a.asset_type === "SOCIAL_STORY_SEQUENCE") {
      out.multis.push(produceMultiPanel(id));
    }
    out.copies.push(writeCopyPackage(a));
    if (a.asset_type !== "SOCIAL_REEL") {
      writeText(join(OUT, "Prompts", "Images", `${id}.txt`), imagePrompt(a));
      if (a.asset_type === "SOCIAL_CAROUSEL") {
        const des = loadJson(`mae/data/design-specs/${desIdFor(id)}.json`);
        let n = 1;
        for (const [k, v] of Object.entries(des.copy_blocks || {})) {
          if (v.slide == null) continue;
          writeText(join(OUT, "Prompts", "Images", `${id}.slide-${v.slide}.txt`), imagePrompt(a, { slide: v.slide }));
          n++;
        }
      }
      out.image_prompts++;
    }
  }
  const reelAsset = loadJson("mae/data/assets/AST-NS-007.json");
  out.reel = buildReel(reelAsset);
  out.mockups = buildMockups();
  writeJson(join(OUT, "_build.json"), { built_at: new Date().toISOString(), statics: out.statics.map((r) => ({ asset: r.asset, status: r.status })), multis: out.multis.map((r) => ({ asset: r.asset, status: r.status, panels: r.panel_count })), mockups: out.mockups.mocks.length, reel: out.reel.asset });
  return out;
}

const invoked = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invoked) {
  const r = buildCampaign();
  const led = ledgerOf();
  const rend = led.filter((x) => x.status === "RENDERED").length;
  const pp = led.filter((x) => x.status === "PRODUCTION_PACKAGE_READY").length;
  console.log("statics:", r.statics.length, "| multis:", r.multis.length, "| copies:", r.copies.length, "| image prompts:", r.image_prompts);
  console.log("mockups:", r.mockups.copied.length, "pages +", r.mockups.mocks.length, "phone mockups | reel frames:", r.reel.frames.length);
  console.log("ledger:", rend, "RENDERED /", pp, "PRODUCTION_PACKAGE_READY /", led.length, "total");
}
