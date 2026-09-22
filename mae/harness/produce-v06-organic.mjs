// V06 ORGANIC MEDIA CLUSTER PRODUCER
//
// Produces the complete organic cluster from the grounded content definition:
//   6 YouTube long-form packages · 10 Shorts · 10 TikTok · 10 Pinterest assets ·
//   5 emails · media-cluster sequence · cross-platform reuse map · first-win.
//
// Rendering rules (Task §5): the frozen compositor core is NOT modified. Scene-led Pinterest
// assets render through the frozen treatments A/C/E. Two formats the core does not cover get the
// MINIMUM deterministic adapter below: a 16:9 YouTube thumbnail and an artifact-led 2:3 Pin.
// Both still render through the frozen verified pipeline (shotVerified + checkCreative), so the
// image-decode gate, no-placeholder rule and objective pixel QA are unchanged.
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import {
  TREATMENT, renderCreative, inlineImage, esc,
} from "./creative-compositor.mjs";
// Generic organic-media production (contracts + renderers + packaging primitives) — NOT V06 code.
import {
  rule, bullets, scriptText, voiceoverText, onScreenText, decodeGate, renderTo, put, ensure,
  renderYouTubeThumbnail as renderThumbnail, renderPinterestPin as renderArtifactPin,
  videoStatusText as videoStatus, ORGANIC_CONTRACTS,
} from "./organic-media.mjs";
import { CLUSTER, SAFETY, EVIDENCE, FLAGSHIP, SUPPORTING } from "../data/organic/v06-organic-cluster.mjs";
import { SHORTS, TIKTOK, PINS, EMAILS, SEQUENCE, REUSE, FIRST_WIN } from "../data/organic/v06-organic-cluster-2.mjs";

const OUT = resolve("V06-Marketing-Assets/Organic-Media");
const PRODUCT = resolve("V06-Marketing-Assets");
const PAGES = join(process.env.LOCALAPPDATA || "", "Temp/opencode/v06-pages");

const rel = (p) => relative(OUT, p).replace(/\\/g, "/");
void ORGANIC_CONTRACTS;

/* ---------------------------------------------------------------- scene lookup */
function sceneIndex() {
  const idx = new Map();
  for (const plat of ["Facebook", "Instagram", "WhatsApp"]) {
    const base = join(PRODUCT, plat);
    if (!existsSync(base)) continue;
    for (const id of readdirSync(base)) {
      for (const cand of ["scene.jpg", "scene-slide-1.jpg"]) {
        const p = join(base, id, "raw-generated", cand);
        if (existsSync(p)) idx.set(id, p);
      }
    }
  }
  return idx;
}
const SCENES = sceneIndex();
const sceneOf = (id) => (id && SCENES.get(id)) || null;

/* YouTube thumbnail + Pinterest Pin renderers, the TXT helpers and the truthful VIDEO-STATUS text
 * now live in the generic organic-media module (Task §39/§40) and are imported above. */

/* ---------------------------------------------------------------- render helpers */
const results = { finals: [], qa: [], rendered: 0, failed: [] };
function render(pngPath, html, w, h, treatment, regions, label, requireCta = true) {
  const r = renderTo(results, pngPath, html, w, h, treatment, regions, label, requireCta);
  if (r.ok) results.finals.push(rel(pngPath));
  return r;
}

/* ================================================================ 1. YOUTUBE LONG-FORM */
function longform(unit, isFlagship) {
  const dir = join(OUT, "YouTube", "Long-Form", unit.id);
  const thumb = join(dir, "THUMBNAIL.png");
  const sceneId = unit.thumbnail_scene;
  const scene = sceneOf(sceneId);
  const ev = EVIDENCE[unit.thumbnail_evidence];

  // ---- thumbnail (REQUIRED finished asset)
  if (!scene || !existsSync(scene)) { results.failed.push(`${unit.id}: thumbnail scene missing (${sceneId})`); }
  else {
    decodeGate("thumbnail scene " + sceneId, scene, true);
    // A thumbnail carries no CTA, so the CTA check does not apply to it.
    render(thumb, renderThumbnail({ scene: inlineImage(scene), text: unit.thumbnail_text, brand: CLUSTER.product_name }), 1280, 720, TREATMENT.EMOTIONAL_HOOK, {}, `${unit.id} THUMBNAIL`, false);
  }
  const pw = join(dir, "THUMBNAIL-PROMPT.txt");
  put(pw, `${rule("THUMBNAIL IMAGE-GENERATION PROMPT (exact, archived)")}

Source scene: ${sceneId} — generated from the approved V06 Visual Grounding Block.
Text overlay (deterministic, rendered last): "${unit.thumbnail_text}"
Format: 1280x720 PNG, 16:9.

${rule("EXACT ARCHIVED SCENE PROMPT")}

${scene ? readFileSync(scene.replace(/\.jpg$/, ".prompt.txt"), "utf8").trim() : "(no archived scene prompt)"}
`);

  put(join(dir, "TITLE.txt"), `${unit.title}\n\nCandidate titles evaluated (see PINNED-COMMENT-free rationale in PUBLISHING-NOTES.txt):\n${bullets(unit.title_candidates)}\n\nSelected because: ${unit.title_rationale}\n`);
  put(join(dir, "SCRIPT.txt"), `TITLE: ${unit.title}\nSERIES: ${CLUSTER.editorial_series}\nFORMAT: YouTube long-form${isFlagship ? " (flagship)" : " (supporting)"}\nTARGET: ${unit.duration_target}\n\n${scriptText(unit.beats)}\n\n${rule("CTA")}\n\n${unit.cta}\n\n${rule("SAFETY")}\n\n${SAFETY.trust_line}\n${SAFETY.boundary}\n`);
  put(join(dir, "VOICEOVER.txt"), `NARRATION (verbatim - no AI voice assumed, no invented claims)\nDeliver calmly, at a normal pace. No hype, no urgency, no advertisement tone.\n\n${voiceoverText(unit.beats)}\n`);
  put(join(dir, "ON-SCREEN-TEXT.txt"), `ON-SCREEN TEXT (deterministic; short lines only)\n\n${onScreenText(unit)}\n`);
  if (isFlagship) {
    put(join(dir, "CHAPTERS.txt"), `CHAPTERS\n\n${unit.chapters.map(([t, h, d]) => `${t}  ${h}  - ${d}`).join("\n")}\n`);
  }
  put(join(dir, "SCENE-PLAN.txt"), `SCENE PLAN (context-grounded; reuses existing V06 generated scenes where the situation matches)\n\n${bullets(unit.scene_plan || unit.beats.map((b) => b.head))}\n\nVisual language: documentary/editorial, unposed, real postpartum domestic settings. No generic stock, no staged pain, no styled interiors.\n`);
  put(join(dir, "SHOT-LIST.txt"), `SHOT LIST (deterministic plan; numbered shots, not a rendered edit)\n\n${(unit.chapters || []).map((c, i) => `SHOT ${String(i + 1).padStart(2, "0")}  ${c[0]}  ${c[1]}\n    visual: ${(unit.scene_plan && unit.scene_plan[i]) ? unit.scene_plan[i] : c[1]}\n    on-screen: deterministic caption for this beat`).join("\n")}\n`);
  put(join(dir, "IMAGE-PROMPTS.txt"), `IMAGE-GENERATION PROMPTS (exact archived prompts for every visual referenced)\n\n${(unit.evidence_pages || []).map((p) => `${p}: real corrected V06 product page - used as product evidence, never model-generated.`).join("\n")}\n\n${rule("SCENE PROMPTS (from the approved V06 Visual Grounding Blocks)")}\n\n${[unit.thumbnail_scene].filter(Boolean).map((id) => `--- ${id} ---\n${sceneOf(id) ? readFileSync(sceneOf(id).replace(/\.jpg$/, ".prompt.txt"), "utf8").trim() : "(missing)"}`).join("\n\n")}\n`);
  put(join(dir, "VIDEO-PROMPT.txt"), `${rule("VIDEO GENERATION PROMPT")}

Produce a ${unit.duration_target} long-form YouTube episode, ${"16:9"} 1920x1080.

DISCIPLINE
  Documentary/editorial treatment. Real postpartum domestic settings, unposed subjects,
  available light. Cut on the narration beats - not on a music drop. No stock library
  footage, no AI-generated faces, no staged pain expression, no hospital imagery.
  Product evidence is composited deterministically from the real V06 pages, never generated.

STRUCTURE
${(unit.chapters || []).map((c) => `  ${c[0]}  ${c[1]} - ${c[2]}`).join("\n")}

TEXT POLICY
  Burned-in text only from ON-SCREEN-TEXT.txt. Never model-generate on-screen words.

AUDIO
  Narration from VOICEOVER.txt. No invented claims. Platform-permitted music only.

PRODUCT EVIDENCE
  Display the real V06 pages listed in PRODUCT-EVIDENCE-PLAN.txt as the implementation
  mechanism at the narration moments indicated. Never render an imitation.
`);
  put(join(dir, "PRODUCT-EVIDENCE-PLAN.txt"), `PRODUCT EVIDENCE PLAN (real corrected V06 pages - deterministic composition, never model-generated)\n\n${(unit.evidence_pages || []).map((p) => { const e = Object.values(EVIDENCE).find((x) => x.page === p); return `${p}  ${e ? e.label : ""}\n    displayed as the implementation mechanism at the matching narration moment; framed as a real artifact, not a sales slide.`; }).join("\n\n")}\n`);
  put(join(dir, "DESCRIPTION.txt"), buildDescription(unit, isFlagship));
  put(join(dir, "CTA.txt"), `${unit.cta}\n\n${SAFETY.trust_line}\n`);
  if (isFlagship) put(join(dir, "PINNED-COMMENT.txt"), unit.pinned_comment + "\n");
  put(join(dir, "PUBLISHING-NOTES.txt"), `PUBLISHING NOTES\n\nSeries     : ${CLUSTER.editorial_series}\nTagline    : ${CLUSTER.tagline}\nTitle test : ${unit.title_candidates.length} candidates evaluated against truthfulness, situation specificity, search intent, curiosity, non-clickbait integrity and product relevance.\nSelected   : ${unit.title}\nRationale  : ${unit.title_rationale}\nTruth      : every claim traces to ${CLUSTER.transformation_id} (situation, mechanism, failure points, safety boundaries).\nSafety     : reviewed V06 language used verbatim for safe sleep, on-shift alertness, and escalation. No diagnosis, no medical advice, no fear clickbait.\nThumbnail  : finished 1280x720 asset; complements the title rather than repeating it.\n`);
  const has = (f) => existsSync(join(dir, f));
  put(join(dir, "VIDEO-STATUS.txt"), videoStatus({ name: `${unit.id} (YouTube long-form)`, file: `${unit.id}.mp4`, res: "1920x1080", aspect: "16:9", duration: unit.duration_target, has }));
  return dir;
}

function buildDescription(unit, isFlagship) {
  const chapters = (unit.chapters || []).map(([t, h, d]) => `${t} ${h} - ${d}`).join("\n");
  return `${CLUSTER.situation}

This ${isFlagship ? "episode" : "video"} explains the operating system used instead: an owner, a roster, a scheduled hand-off, a sleep banker, and a rule that the baby always overrides the plan.

WHAT IS IN THIS ${isFlagship ? "EPISODE" : "VIDEO"}
${bullets(unit.beats.slice(1).map((b) => b.head))}

${chapters ? `CHAPTERS\n${chapters}\n\n` : ""}SOURCES
Built from the approved Every Night, Just Me transformation record: the situation, the mechanism, the failure points and the reviewed safety boundaries. No new research and no new claims.

SAFETY
${SAFETY.trust_line}
${SAFETY.boundary}
Night-care coordination is educational support. It is not baby sleep training and not a substitute for paediatric or mental-health care.

IF EXHAUSTION IS MORE THAN TIREDNESS
${SAFETY.escalation}
${SAFETY.crisis.map((c) => `- ${c}`).join("\n")}

${unit.cta}
`;
}

/* ================================================================ 2. SHORTS */
function shortUnit(s) {
  const dir = join(OUT, "YouTube", "Shorts", s.id);
  const scene = sceneOf(s.scene);
  if (!scene) { results.failed.push(`${s.id}: scene missing (${s.scene})`); }
  else {
    decodeGate(s.id + " scene " + s.scene, scene, true);
    const ev = s.evidence ? EVIDENCE[Object.keys(EVIDENCE).find((k) => EVIDENCE[k].page === s.evidence)] : null;
    if (s.treatment === "B" && ev && existsSync(join(PAGES, ev.page))) {
      decodeGate(s.id + " evidence", join(PAGES, ev.page));
      render(join(dir, "COVER.png"),
        renderCreative(TREATMENT.PRODUCT_PROOF, { scene: inlineImage(scene), evidence: inlineImage(join(PAGES, ev.page)), evidenceLabel: ev.label, brandName: CLUSTER.product_name, trustLine: SAFETY.trust_line, headline: s.title, support: "", cta: s.cta, w: 1080, h: 1920, safe: { top: 200, bottom: 280, left: 60, right: 60 } }),
        1080, 1920, TREATMENT.PRODUCT_PROOF, { evidence: { x: 230, y: 500, w: 620, h: 877 } }, `${s.id} COVER`);
    } else {
      render(join(dir, "COVER.png"),
        renderCreative(TREATMENT.EMOTIONAL_HOOK, { scene: inlineImage(scene), brandName: CLUSTER.product_name, headline: s.title, support: "", cta: "", w: 1080, h: 1920, safe: { top: 200, bottom: 280, left: 60, right: 60 } }),
        1080, 1920, TREATMENT.EMOTIONAL_HOOK, {}, `${s.id} COVER`, false);
    }
  }
  put(join(dir, "SCRIPT.txt"), `TITLE: ${s.title}\nSITUATION: ${s.situation}\nFORMAT: YouTube Short (vertical 9:16), 20-60s\n\n${rule("NARRATION")}\n\n${s.voiceover}\n\n${rule("CTA")}\n\n${s.cta}\n\n${rule("SAFETY")}\n\n${SAFETY.trust_line}\n`);
  put(join(dir, "VOICEOVER.txt"), `NARRATION (verbatim)\n\n${s.voiceover}\n`);
  put(join(dir, "ON-SCREEN-TEXT.txt"), `ON-SCREEN TEXT (deterministic, in order)\n\n${s.on_screen.map((t, i) => `${String(i + 1).padStart(2, "0")}  ${t}`).join("\n")}\n`);
  put(join(dir, "SHOT-LIST.txt"), `SHOT LIST\n\n${s.shots.map((x, i) => `SHOT ${String(i + 1).padStart(2, "0")}  ${x}`).join("\n")}\n`);
  put(join(dir, "VIDEO-PROMPT.txt"), `${rule("VIDEO GENERATION PROMPT")}\n\nProduce a 20-60s vertical 9:16 (1080x1920) explainer.\n\nNARRATION\n${s.voiceover}\n\nVISUAL\n${bullets(s.shots)}\n\nTEXT POLICY\n  Burned-in text only from ON-SCREEN-TEXT.txt: ${s.on_screen.join(" | ")}\n\nPRODUCT EVIDENCE\n  ${s.evidence ? `Display the real V06 page ${s.evidence} as the implementation mechanism. Never model-generate it.` : "No product page in this unit; keep the visual on the grounded human scene."}\n\nDISCIPLINE\n  Documentary/editorial, real domestic setting, no stock footage, no AI faces, no staged pain.\n`);
  put(join(dir, "CAPTION.txt"), `${s.caption}\n\n${SAFETY.trust_line}\n`);
  put(join(dir, "CTA.txt"), `${s.cta}\n\n${SAFETY.trust_line}\n`);
  const has = (f) => existsSync(join(dir, f));
  put(join(dir, "VIDEO-STATUS.txt"), videoStatus({ name: `${s.id} (YouTube Short)`, file: `${s.id}.mp4`, res: "1080x1920", aspect: "9:16", duration: "20-60s", has }));
  return dir;
}

/* ================================================================ 3. TIKTOK */
function tiktokUnit(t, short) {
  const dir = join(OUT, "TikTok", t.id);
  put(join(dir, "SCRIPT.txt"), `TITLE: ${t.title}\nFORMAT: TikTok (vertical 9:16), 20-60s\nMASTER: ${t.master} (same underlying Truth and master vertical unit)\n\n${rule("NARRATION")}\n\n${short.voiceover}\n\n${rule("CAPTION")}\n\n${t.caption}\n\n${rule("CTA")}\n\n${t.cta}\n\n${rule("SAFETY")}\n\n${SAFETY.trust_line}\n`);
  put(join(dir, "ON-SCREEN-TEXT.txt"), `ON-SCREEN TEXT (deterministic, in order)\n\n${short.on_screen.map((x, i) => `${String(i + 1).padStart(2, "0")}  ${x}`).join("\n")}\n`);
  put(join(dir, "CAPTION.txt"), `${t.caption}\n\n${SAFETY.trust_line}\n`);
  put(join(dir, "VIDEO-PROMPT.txt"), `${rule("VIDEO GENERATION PROMPT (TikTok)")}\n\nMASTER: reuse the ${t.master} vertical master. Do not render a duplicate 9:16 master - one qualified 9:16 master serves YouTube Shorts, TikTok, and future IG/FB Reels, with platform-specific copy preserved in CAPTION.txt.\n\nNARRATION\n${short.voiceover}\n\nTEXT POLICY\n  Burned-in text only from ON-SCREEN-TEXT.txt.\n\nDISCIPLINE\n  Documentary/editorial, real domestic setting, no stock footage, no AI faces, no staged pain, no sensationalised exhaustion.\n`);
  put(join(dir, "CTA.txt"), `${t.cta}\n\n${SAFETY.trust_line}\n`);
  const has = (f) => existsSync(join(dir, f));
  put(join(dir, "VIDEO-STATUS.txt"), videoStatus({ name: `${t.id} (TikTok, master ${t.master})`, file: `${t.id}.mp4`, res: "1080x1920", aspect: "9:16", duration: "20-60s", has }));
  return dir;
}

/* ================================================================ 4. PINTEREST */
function pinUnit(p) {
  const dir = join(OUT, "Pinterest", p.id);
  // p.evidence is an EVIDENCE key (e.g. "decision"); also accept a raw page filename.
  const ev = p.evidence
    ? (EVIDENCE[p.evidence] || Object.values(EVIDENCE).find((e) => e.page === p.evidence || e.label === p.evidence) || null)
    : null;
  const page = ev ? join(PAGES, ev.page) : (p.evidence && existsSync(join(PAGES, p.evidence)) ? join(PAGES, p.evidence) : null);
  let usedScene = false;
  if (page && existsSync(page)) {
    decodeGate(p.id + " product evidence", page);
    // Eyebrow = the approved product name (customer-facing), never an internal label.
    render(join(dir, "PIN.png"), renderArtifactPin({ evidence: inlineImage(page), title: p.title, text: CLUSTER.product_name, cta: p.cta }), 1000, 1500, TREATMENT.PRODUCT_PROOF, { evidence: { x: 140, y: 330, w: 720, h: 1018 } }, `${p.id} PIN`);
  } else {
    const scene = sceneOf(p.scene);
    if (!scene) { results.failed.push(`${p.id}: neither evidence nor scene available`); }
    else {
      decodeGate(p.id + " scene " + p.scene, scene, true);
      usedScene = true;
      const t = p.treatment === "E" ? TREATMENT.OUTCOME : p.treatment === "C" ? TREATMENT.EDITORIAL_QUOTE : TREATMENT.EMOTIONAL_HOOK;
      render(join(dir, "PIN.png"), renderCreative(t, { scene: inlineImage(scene), brandName: CLUSTER.product_name, trustLine: SAFETY.trust_line, headline: p.text_overlay, support: "", cta: p.cta, w: 1000, h: 1500, safe: { top: 90, bottom: 90, left: 64, right: 64 } }), 1000, 1500, t, {}, `${p.id} PIN`);
    }
  }
  put(join(dir, "TITLE.txt"), `${p.title}\n`);
  put(join(dir, "DESCRIPTION.txt"), `${p.description}\n\n${SAFETY.trust_line}\n`);
  put(join(dir, "CTA.txt"), `${p.cta}\n`);
  if (usedScene) {
    const scene = sceneOf(p.scene);
    put(join(dir, "IMAGE-PROMPT.txt"), `${rule("IMAGE-GENERATION PROMPT (exact archived)")}\n\n${readFileSync(scene.replace(/\.jpg$/, ".prompt.txt"), "utf8").trim()}\n`);
  } else {
    put(join(dir, "IMAGE-PROMPT.txt"), `No image-generation prompt applies: this Pin is entirely deterministic product-evidence based (real corrected V06 page, composited). No scene was generated, so none is fabricated here.\n`);
  }
  return dir;
}

/* ================================================================ 5. EMAIL */
function emailUnit(e) {
  const dir = join(OUT, "Email", e.id);
  put(join(dir, "SUBJECT.txt"), `${e.subject}\n`);
  put(join(dir, "PREHEADER.txt"), `${e.preheader}\n`);
  put(join(dir, "BODY.txt"), `${e.body}\n\n${rule("SAFETY")}\n\n${SAFETY.trust_line}\n${SAFETY.boundary}\n`);
  put(join(dir, "CTA.txt"), `${e.cta}\n`);
  return dir;
}

/* ---------------------------------------------------------------- run */
console.log("— YouTube long-form —");
longform(FLAGSHIP, true);
console.log("  flagship:", FLAGSHIP.id);
for (const s of SUPPORTING) { longform(s, false); console.log(" ", s.id, "->", s.title); }
console.log("— Shorts —");
SHORTS.forEach((s) => { shortUnit(s); console.log(" ", s.id); });
console.log("— TikTok —");
TIKTOK.forEach((t) => { tiktokUnit(t, SHORTS.find((s) => s.id === t.master)); console.log(" ", t.id); });
console.log("— Pinterest —");
PINS.forEach((p) => { pinUnit(p); console.log(" ", p.id, p.kind); });
console.log("— Email —");
EMAILS.forEach((e) => { emailUnit(e); console.log(" ", e.id, e.stage); });

/* ---------------------------------------------------------------- sequence + reuse + first win */
ensure(join(OUT, "Media-Cluster-Sequence"));
put(join(OUT, "Media-Cluster-Sequence", "ORGANIC-MEDIA-SEQUENCE.txt"), `${rule("V06 ORGANIC MEDIA SEQUENCE — publishing operations")}

Series : ${CLUSTER.editorial_series}
Tagline: ${CLUSTER.tagline}
Product: ${CLUSTER.product_name} (${CLUSTER.product_id})
Question this answers: what do we publish first, second, third — and why.

ORDER
${SEQUENCE.map(([n, what, why, note]) => `${n}. ${what}\n   why : ${why}\n   note: ${note}`).join("\n\n")}

OPERATING NOTES
- The flagship is the only asset that assumes no prior context; everything else assumes the flagships or shorts.
- Shorts and TikTok share one 9:16 master per unit - publish the same master, keep platform-specific captions.
- Pinterest is the long-shelf-life, search-driven surface; publish continuously rather than as a burst.
- Email is the owned surface: it sequences the same progression without depending on an algorithm.
- WhatsApp is the primary peer distribution surface for the shareable artifacts (existing approved assets).
- The product is never the opener. Situation first, mechanism second, product last.
`);
put(join(OUT, "Media-Cluster-Sequence", "CROSS-PLATFORM-REUSE.txt"), `${rule("CROSS-PLATFORM REUSE MAP")}

One qualified 9:16 master serves multiple platforms. Platform-specific COPY is preserved
separately (each platform folder carries its own CAPTION/CAPTION.txt).

${"MASTER".padEnd(12)} ${"PLATFORMS".padEnd(60)}
${REUSE.map(([m, a, b, c, d]) => `${m.padEnd(12)} ${[a, b, c, d].join(" -> ")}`).join("\n")}

IMAGES
- YouTube long-form thumbnails (6) are 16:9 and platform-specific: they do not reuse short masters.
- Pinterest Pins (10) are 2:3 and platform-specific: product-evidence Pins are deterministic (no scene),
  scene Pins reuse the existing approved V06 generated scenes.
- No duplicate raw video should be rendered where the same master truthfully serves two platforms.

COPY
- TikTok captions differ from YouTube Short captions on purpose; the underlying Truth does not.
`);
put(join(OUT, "First-Win", "FIRST-WIN.txt"), `${rule("FREE FIRST-WIN ASSET")}

Status : ${FIRST_WIN.status}
Name   : ${FIRST_WIN.name}
Source : ${FIRST_WIN.source}

APPROVED FIRST WIN (verbatim from the transformation record)
${FIRST_WIN.approved_first_win}

GROUP-CHAT VERSION (restated for WhatsApp distribution)
${FIRST_WIN.whatsapp_first_win}

NOTE
${FIRST_WIN.note}

No new Transformation, product or claim was created. This packages an existing approved mechanism.
`);

/* ---------------------------------------------------------------- ledger for the existing exporter */
const ledger = {
  generated: new Date().toISOString(),
  cluster: `${CLUSTER.product_id} organic media cluster`,
  provider_calls: 0, image_provider_spend_usd: 0, video_provider_calls: 0, video_provider_spend_usd: 0,
  rendered_images: results.rendered,
  packages: [],
};
function pkg(id, platform, type, dir, dest, files) {
  ledger.packages.push({ id, platform, type, source_dir: dir, dest, files });
}
pkg("Flagship", "youtube", "LONG_FORM", join(OUT, "YouTube/Long-Form/Flagship"), "YouTube/Long-Form/Flagship", null);
for (const s of SUPPORTING) pkg(s.id, "youtube", "LONG_FORM", join(OUT, "YouTube/Long-Form", s.id), `YouTube/Long-Form/${s.id}`, null);
for (const s of SHORTS) pkg(s.id, "youtube", "SHORT", join(OUT, "YouTube/Shorts", s.id), `YouTube/Shorts/${s.id}`, null);
for (const t of TIKTOK) pkg(t.id, "tiktok", "SHORT_VERTICAL", join(OUT, "TikTok", t.id), `TikTok/${t.id}`, null);
for (const p of PINS) pkg(p.id, "pinterest", "PIN", join(OUT, "Pinterest", p.id), `Pinterest/${p.id}`, null);
for (const e of EMAILS) pkg(e.id, "email", "EMAIL", join(OUT, "Email", e.id), `Email/${e.id}`, null);
pkg("Organic-Media-Sequence", "organic", "SEQUENCE", join(OUT, "Media-Cluster-Sequence"), "Organic-Media-Sequence", null);
writeFileSync(join(OUT, "_organic-ledger.json"), JSON.stringify(ledger, null, 2) + "\n", "utf8");

// Generic package manifest consumed by the EXISTING exporter. Each entry declares its own FINAL
// destination, so the exporter needs no platform knowledge and future platforms are not blocked.
writeFileSync(join(PRODUCT, "_packages.json"), JSON.stringify({
  generated: new Date().toISOString(),
  note: "Package folders copied verbatim into FINAL/<dest>/ by mae/harness/export-final-campaign.mjs. The ledger declares the destination; the exporter hardcodes no platform.",
  packages: ledger.packages.map((p) => ({ id: p.id, platform: p.platform, type: p.type, source_dir: p.source_dir, dest: p.dest })),
}, null, 2) + "\n", "utf8");

/* ---------------------------------------------------------------- QA summary */
console.log(`\nrendered images: ${results.rendered}`);
console.log(`QA checks: ${results.qa.filter((q) => q.pass).length}/${results.qa.length} PASS`);
if (results.failed.length) { console.log("FAILURES:"); results.failed.forEach((f) => console.log("  -", f)); process.exitCode = 1; }
else console.log("ALL RENDERS + QA PASS");
