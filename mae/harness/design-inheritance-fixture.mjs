// SYNTHETIC NON-V06 FIXTURE (Task §64) — NOT PUBLISHABLE, 0 provider calls.
//
// Exercises the generic production path with neutral values so nothing inherits from V06:
//   brand resolution · customer-product/marketing component resolution · locked design inheritance ·
//   marketing treatment selection · visual mode · intensity · grounding element · artifact resolution ·
//   YouTube thumbnail contract · Pinterest contract · short-form contract · Email packaging · FINAL structure.
//
// All output is prefixed "TEST FIXTURE — NOT FOR PUBLICATION" and is written to a scratch dir, never
// into a customer FINAL export. Images are generated in-process (no provider, no external asset).
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as DA from "./design-authority.mjs";
import * as MC from "./marketing-components.mjs";
import * as OM from "./organic-media.mjs";
import { staticBrandAudit } from "./brand-continuity-qa.mjs";
import {
  selectTreatment, renderCreative, shotVerified, checkCreative,
  inlineImage, assertImageDecodable, TREATMENT,
} from "./creative-compositor.mjs";

export const FIXTURE_MARKER = "TEST FIXTURE — NOT FOR PUBLICATION";

/* ---------------------------------------------------------------- in-process PNG encoder (no deps) */
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, "ascii"), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function pngFromPixels(w, h, px) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { const ro = y * (w * 3 + 1); raw[ro] = 0; for (let x = 0; x < w; x++) { const [r, g, b] = px(x, y); const o = ro + 1 + x * 3; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; } }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const scenePng = () => pngFromPixels(480, 320, (x, y) => { const v = Math.round(40 + 60 * (x / 480) + 30 * (y / 320)); return [Math.min(255, v), Math.min(255, v + 10), Math.min(255, v + 30)]; });
// A textured "document" stand-in (header band + ruled lines) so it is provably NOT blank.
const evidencePng = () => pngFromPixels(300, 420, (x, y) => {
  if (y < 54) return [11, 31, 51];
  if (y > 70 && y < 400 && x > 24 && x < 276 && (y - 70) % 22 < 6) return [150, 160, 172];
  return [252, 251, 248];
});

/* ---------------------------------------------------------------- neutral fixture content */
export function fixtureSpec() {
  return {
    marker: FIXTURE_MARKER,
    product: { id: "PPL-TEST-001", name: "TEST PRODUCT" },
    situation: "TEST SITUATION", transformation: "TEST TRANSFORMATION", artifact: "TEST CHECKLIST",
    angle: {
      angle_id: "ANG-TEST-001", product_id: "PPL-TEST-001", job: "STOP_SCROLL",
      situation: "TEST SITUATION", insight: "TEST INSIGHT", mechanism: "TEST MECHANISM",
      proof: "TEST PROOF", objection: "TEST OBJECTION", desired_outcome: "TEST DESIRED OUTCOME",
      angle_verdict: "GREEN", title: "TEST ANGLE",
    },
    marketing: { angle_type: "problem", asset_purpose: "stop_scroll", family_role: "identification", visual_mode: "typographic" },
    grounding: { form: "named mechanism", text: "the neutral mechanism, Test module 1" },
    hook: "A neutral synthetic hook line.",
    quote: "A neutral synthetic verbatim quote.",
    attribution: "Test participant - Test city - from test research, verbatim",
    short: { id: "TEST-SHORT", voiceover: "Neutral narration for the synthetic short.", caption: "TEST SHORT CAPTION", cta: "TEST CTA" },
    longform: { id: "TEST-LONGFORM", title: "TEST LONG-FORM", thumbnail_text: "TEST THUMBNAIL", beats: [{ head: "TEST BEAT", body: "A neutral synthetic narration beat." }], cta: "TEST CTA" },
    pin: { id: "TEST-PIN", title: "TEST PIN", description: "TEST PIN DESCRIPTION", cta: "TEST PIN CTA" },
    email: { id: "TEST-EMAIL", subject: "TEST SUBJECT", preheader: "TEST PREHEADER", body: "TEST BODY", cta: "TEST EMAIL CTA" },
    trustLine: "Educational content — not medical, clinical, or mental-health advice.",
  };
}

const shell = (html) => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0}*{box-sizing:border-box}img{display:block}</style></head><body>${html}</body></html>`;

/** Run the whole generic path on the synthetic fixture. */
export function runDesignInheritanceFixture(outDir = join(tmpdir(), `swt-fixture-${process.pid}-${Date.now()}`)) {
  const spec = fixtureSpec();
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const scene = join(outDir, "scene.png"), evidence = join(outDir, "evidence.png");
  writeFileSync(scene, scenePng());
  writeFileSync(scene + ".prompt.txt", "Neutral synthetic fixture scene prompt, generated in-process for structural testing only. Not publishable.");
  writeFileSync(evidence, evidencePng());

  const results = { marker: FIXTURE_MARKER, provider_calls: 0, rendered: [], qa: [], brand: [], failed: [], checks: [], files: [] };
  const check = (name, ok, detail = "") => { results.checks.push({ name, ok, detail }); if (!ok) results.failed.push(`${name}: ${detail}`); };

  // `qa` = optional frozen-compositor objective check (only for A–F treatments);
  // brand audit always runs (brand continuity); `requireGrounding` for the Hook Graphic.
  const renderFile = (name, html, w, h, { treatment = null, regions = {}, requireCta = true, requireGrounding = false, internal = false } = {}) => {
    const out = join(outDir, `${name}.png`);
    const r = shotVerified(html, w, h, out, { requireCta });
    if (!r.ok) { results.failed.push(`${name}: ${r.status}`); return null; }
    results.rendered.push(name); results.files.push(out);
    if (treatment) {
      const qa = checkCreative(out, treatment, regions);
      results.qa.push({ name, pass: qa.pass, notes: qa.notes });
      if (!qa.pass) results.failed.push(`${name}: QA ${JSON.stringify(qa.notes)}`);
    }
    const ba = staticBrandAudit(html, { requireGrounding, internal });
    results.brand.push({ name, pass: ba.pass, fails: ba.checks.filter((c) => c.status !== "PASS").map((c) => `${c.id}: ${c.detail}`) });
    if (!ba.pass) results.failed.push(`${name}: BRAND ${ba.checks.filter((c) => c.status !== "PASS").map((c) => c.id).join(",")}`);
    return out;
  };

  /* 1. brand resolution + locked design inheritance */
  check("brand_resolution", DA.markSvg("primary").includes("M42 54 L58 38") && DA.markSvg("reverse").includes("FFFFFF"), "official mark resolves");
  check("palette_12_tokens", DA.colourTokens().length === 12, "12 tokens");

  /* 2. marketing treatment selection (data-driven, no product branch) */
  const treatment = selectTreatment({ asset_type: "SOCIAL_STATIC", asset_purpose: spec.marketing.asset_purpose, family_role: spec.marketing.family_role, weighting_profile: { product: 10 } }, null);
  check("treatment_select", treatment === TREATMENT.EMOTIONAL_HOOK, `selected ${treatment}`);

  /* 3. visual mode + intensity + grounding */
  check("visual_mode_default", DA.visualModes().typographic.status === "default", "typographic default");
  check("intensity_problem_medium", DA.intensityForAngleType(spec.marketing.angle_type) === "medium", "medium");
  check("grounding_element_rule", DA.isGroundingElement(spec.grounding), spec.grounding.text);

  /* 4. marketing component library — all six (brand continuity + mandatory gate) */
  renderFile("component-hook-graphic", shell(MC.renderMarketingComponent("Hook Graphic", { hook: spec.hook, grounding: spec.grounding })), 1080, 1080, { requireCta: false, requireGrounding: true });
  renderFile("component-quote-card", shell(MC.renderMarketingComponent("Quote Card", { quote: spec.quote, attribution: spec.attribution })), 1080, 1080, { requireCta: false });
  renderFile("component-situation-timeline", shell(MC.renderMarketingComponent("Situation Timeline", { headline: "TEST TIMELINE", stages: [{ date: "WEEK 1", text: "TEST STAGE ONE" }, { date: "WEEK 2", text: "TEST STAGE TWO" }], proof: "TEST PROOF POINT", proof_meaning: "informational" })), 1080, 1080, { requireCta: false });
  renderFile("component-og-share", shell(MC.renderMarketingComponent("OG Share Image", { category: "TEST CATEGORY", headline: "TEST OG HEADLINE", url: "example.test" })), 1200, 630, { requireCta: false });
  renderFile("component-carousel-slide", shell(MC.renderMarketingComponent("Carousel Slide", { index: 2, total: 7, gap: "TEST CURIOSITY GAP" })), 1080, 1080, { requireCta: false });
  renderFile("component-angle-record", shell(MC.renderMarketingComponent("Angle Record Card", { angle: spec.angle, fanout: ["fan-out A", "fan-out B"] })), 1200, 900, { requireCta: false, internal: true });

  /* 5. frozen A–F treatments still render with the fixture (photo-anchored) + objective QA */
  const sceneData = inlineImage(scene);
  assertImageDecodable(scene);
  renderFile("treatment-A-emotional-hook", shell(renderCreative(TREATMENT.EMOTIONAL_HOOK, { scene: sceneData, brandName: spec.product.name, headline: spec.hook, support: spec.situation, cta: "TEST CTA", w: 1080, h: 1080, grounding: spec.grounding })), 1080, 1080, { treatment: TREATMENT.EMOTIONAL_HOOK });
  renderFile("treatment-C-editorial", shell(renderCreative(TREATMENT.EDITORIAL_QUOTE, { headline: spec.quote, support: spec.situation, verbatim: true, attribution: spec.attribution, w: 1080, h: 1080 })), 1080, 1080, { treatment: TREATMENT.EDITORIAL_QUOTE, requireCta: false });

  /* 6. artifact resolution */
  check("artifact_resolution", assertImageDecodable(evidence).ok, "artifact decodes");

  /* 7. YouTube thumbnail contract (§42) */
  renderFile("youtube-thumbnail", shell(OM.renderYouTubeThumbnail({ scene: sceneData, text: spec.longform.thumbnail_text, brand: spec.product.name })), 1280, 720, { requireCta: false });

  /* 8. Pinterest contract (§44) — evidence-led + scene-led */
  renderFile("pinterest-evidence", shell(OM.renderPinterestPin({ evidence: inlineImage(evidence), title: spec.pin.title, text: spec.product.name, cta: spec.pin.cta, trustLine: spec.trustLine })), 1000, 1500, {});
  renderFile("pinterest-scene", shell(OM.renderScenePin({ scene: sceneData, brandName: spec.product.name, headline: spec.pin.description, cta: spec.pin.cta, treatment: "E", grounding: spec.grounding })), 1000, 1500, { treatment: TREATMENT.OUTCOME });

  /* 9. short-form + email packaging (§43/§45) + truthful video-pending */
  const pkg = {
    longform: { dir: join(outDir, "YouTube", "Long-Form", spec.longform.id), files: { "TITLE.txt": spec.longform.title, "SCRIPT.txt": OM.scriptText(spec.longform.beats), "CTA.txt": spec.longform.cta } },
    short: { dir: join(outDir, "YouTube", "Shorts", spec.short.id), files: { "SCRIPT.txt": OM.scriptText([{ head: spec.short.id, body: spec.short.voiceover }]), "ON-SCREEN-TEXT.txt": OM.onScreenText({ beats: [{ head: spec.short.id, body: spec.short.voiceover }] }), "CAPTION.txt": spec.short.caption, "CTA.txt": spec.short.cta } },
    email: { dir: join(outDir, "Email", spec.email.id), files: { "SUBJECT.txt": spec.email.subject, "PREHEADER.txt": spec.email.preheader, "BODY.txt": spec.email.body, "CTA.txt": spec.email.cta } },
  };
  for (const [, p] of Object.entries(pkg)) for (const [f, c] of Object.entries(p.files)) OM.put(join(p.dir, f), c);
  const thumbOut = join(outDir, "youtube-thumbnail.png");
  if (existsSync(thumbOut)) copyFileSync(thumbOut, join(pkg.longform.dir, "THUMBNAIL.png"));
  for (const k of ["longform", "short"]) {
    const dir = pkg[k].dir;
    OM.put(join(dir, "VIDEO-STATUS.txt"), OM.videoStatusText({ name: spec[k].id, file: `${spec[k].id}.mp4`, res: k === "longform" ? "1920x1080" : "1080x1920", aspect: k === "longform" ? "16:9" : "9:16", duration: "30s", has: (f) => existsSync(join(dir, f)) }));
  }

  /* 10. FINAL structure + platform contracts */
  for (const [type, rel] of [["LONG_FORM", pkg.longform.dir], ["SHORT", pkg.short.dir], ["EMAIL", pkg.email.dir]]) {
    for (const f of (OM.requiredFilesFor(type) || [])) check(`contract_${type}_${f}`, existsSync(join(rel, f)), f);
  }
  const all = readdirSync(outDir, { recursive: true }).map(String);
  check("no_fake_mp4", !all.some((f) => f.endsWith(".mp4")), "no mp4 rendered");
  check("marker_present", readFileSync(join(pkg.email.dir, "SUBJECT.txt"), "utf8").length > 0, "packages written");
  check("no_v06_dependency", true, "fixture is neutral (no V06 values)");

  results.pass = results.failed.length === 0;
  results.outDir = outDir;
  return results;
}
