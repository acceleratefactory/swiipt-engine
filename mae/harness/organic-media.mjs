// SWIIPT ORGANIC MEDIA — generic reusable production module (Task §39/§40/§41–§46).
//
// The proven V06 organic-media path, GENERALIZED: the platform contracts, the two non-core
// renderers (16:9 YouTube thumbnail, artifact-led 2:3 Pinterest Pin) and the packaging
// primitives are generic and data-driven. The product-specific PROSE and unit data stay in the
// product driver — this module contains no product id, no product name and no situation text.
//
// Rendering rules (Task §5/§78): the frozen compositor core is NOT modified. Scene-led assets
// render through the frozen treatments A/C/E; the two formats the core does not cover render
// here, still through the frozen verified pipeline (shotVerified + checkCreative), so the
// image-decode gate, no-placeholder rule and objective pixel QA are unchanged.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import {
  TREATMENT, renderCreative, shotVerified, checkCreative, inlineImage, assertImageDecodable,
  assertSceneGrounded, esc,
} from "./creative-compositor.mjs";
import * as DA from "./design-authority.mjs";

const NAVY = DA.hex("navy"), GOLD = DA.hex("gold"), CREAM = DA.hex("warm_surface"),
  INK = DA.hex("ink"), MUTED = DA.supportTokens().text_secondary, WHITE = DA.supportTokens().white;

/* ---------------------------------------------------------------- §41–§46 platform contracts
 * Required files per package TYPE (no product, no platform-count assumption). */
export const ORGANIC_CONTRACTS = Object.freeze({
  LONG_FORM: ["TITLE.txt", "SCRIPT.txt", "THUMBNAIL.png"],
  SHORT: ["SCRIPT.txt"],
  SHORT_VERTICAL: ["CAPTION.txt", "SCRIPT.txt"],
  TIKTOK: ["CAPTION.txt", "SCRIPT.txt"],
  PIN: ["PIN.png", "TITLE.txt", "DESCRIPTION.txt", "CTA.txt"],
  PINTEREST: ["PIN.png", "TITLE.txt", "DESCRIPTION.txt", "CTA.txt"],
  EMAIL: ["SUBJECT.txt", "PREHEADER.txt", "BODY.txt", "CTA.txt"],
});
export const requiredFilesFor = (type) => ORGANIC_CONTRACTS[String(type || "").toUpperCase()] || null;

/* ---------------------------------------------------------------- helpers */
export const rule = (t) => `${"=".repeat(60)}\n${t}\n${"=".repeat(60)}`;
export const bullets = (a) => (a || []).map((x) => `- ${x}`).join("\n");
export const ensure = (p) => mkdirSync(p, { recursive: true });
export const put = (p, s) => { ensure(dirname(p)); writeFileSync(p, String(s).replace(/\r?\n/g, "\n") + (String(s).endsWith("\n") ? "" : "\n"), "utf8"); };
export const scriptText = (beats) => (beats || []).map((b) => `${b.head.toUpperCase()}\n\n${b.body}`).join("\n\n");
export const voiceoverText = (beats) => (beats || []).map((b) => b.body).join("\n\n");
export const onScreenText = (unit) => {
  const lines = [];
  (unit.beats || []).forEach((b) => { lines.push(`[${b.head}]`); b.body.split(/(?<=[.?!])\s+/).slice(0, 2).forEach((s) => s.trim() && lines.push(`  ${s.trim()}`)); });
  return lines.join("\n");
};
export const decodeGate = (label, p, isScene = false) => {
  const r = assertImageDecodable(p);
  if (isScene) assertSceneGrounded(p);
  void label;
  return r;
};

/** Render one creative through the frozen verified pipeline; records into `results`. */
export function renderTo(results, pngPath, html, w, h, treatment, regions, label, requireCta = true) {
  ensure(dirname(pngPath));
  const r = shotVerified(html, w, h, pngPath, { requireCta });
  if (!r.ok) { results.failed.push(`${label}: ${r.status}`); return { ok: false, status: r.status }; }
  const qa = checkCreative(pngPath, treatment, regions);
  results.qa.push({ label, treatment, pass: qa.pass, notes: qa.notes });
  if (!qa.pass) results.failed.push(`${label}: QA ${JSON.stringify(qa.notes)}`);
  results.rendered++;
  return { ok: true, status: "RENDERED", qa };
}

/* ---------------------------------------------------------------- renderer: 16:9 YouTube thumbnail
 * §42: photo dominant, 2–6 words, restrained brand, NO product screenshot, no collage, no arrows,
 * no platform label, no internal id. Uses the OFFICIAL lockup and the Inter Black hook role. */
export function renderYouTubeThumbnail(ctx) {
  const { scene, text, brand } = ctx;
  const hook = DA.typeCss("hook");
  const overlay = `<span style="color:${GOLD};font-weight:700;letter-spacing:.14em;font-size:17px;text-transform:uppercase">${esc(ctx.prompt || "What do I do now?")}</span>`;
  return `
<div style="position:relative;width:1280px;height:720px;overflow:hidden;background:${NAVY};font-family:Inter,sans-serif">
  <img data-required="1" src="${esc(scene)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 34%;filter:brightness(1.12) contrast(1.03) saturate(1.04)">
  <div style="position:absolute;inset:0;background:linear-gradient(96deg,rgba(11,31,51,.90) 0%,rgba(11,31,51,.66) 28%,rgba(11,31,51,.20) 54%,rgba(11,31,51,.02) 100%)"></div>
  <div style="position:absolute;left:0;top:0;width:100%;height:104px;background:linear-gradient(180deg,rgba(11,31,51,.52) 0%,rgba(11,31,51,0) 100%)"></div>
  <div data-swt-text style="position:absolute;left:62px;top:48px;display:flex;align-items:center;gap:14px">
    <span data-swt-logo-variant="reverse" style="display:inline-flex;line-height:0">${DA.logoSvg({ dark: true, height: 40 })}</span>
    <span style="color:rgba(255,255,255,.72);font-weight:600;letter-spacing:.13em;font-size:16px;text-transform:uppercase">${esc(brand || "")}</span>
  </div>
  <div data-swt-text style="position:absolute;left:62px;right:560px;top:50%;transform:translateY(-46%);z-index:5">
    <div data-swt-role="hook" style="font-family:${hook.family};font-weight:${hook.weight};font-style:${hook.style};font-size:${String(text || "").length > 22 ? 84 : 100}px;line-height:1.04;letter-spacing:.005em;color:${WHITE};text-shadow:0 3px 26px rgba(0,0,0,.6)">${esc(text)}</div>
  </div>
  <div style="position:absolute;left:62px;bottom:40px;right:560px">${overlay}</div>
</div>`;
}

/* ---------------------------------------------------------------- renderer: artifact-led 2:3 Pin
 * §44: the REAL product page is the dominant visual on a brand surface. No generated scene is
 * required, so no prompt is fabricated (Task §21). Official lockup + on-sheet colours only. */
export function renderPinterestPin(ctx) {
  const { evidence, title, text, cta, trustLine } = ctx;
  return `
<div style="position:relative;width:1000px;height:1500px;overflow:hidden;background:${CREAM};font-family:Inter,sans-serif">
  <div style="position:absolute;left:0;top:0;width:100%;height:9px;background:${GOLD}"></div>
  <div data-swt-text style="position:absolute;left:64px;right:64px;top:52px;display:flex;align-items:center;justify-content:space-between">
    <span data-swt-logo-variant="primary" style="display:inline-flex;line-height:0">${DA.logoSvg({ dark: false, height: 36 })}</span>
    <span style="color:${MUTED};font-weight:600;letter-spacing:.12em;font-size:15px;text-transform:uppercase">${esc(text || "")}</span>
  </div>
  <div data-swt-text style="position:absolute;left:64px;right:64px;top:126px">
    <div data-swt-role="editorial_headline" style="font-family:'DM Serif Display',Georgia,serif;font-weight:400;font-size:52px;line-height:1.12;color:${INK}">${esc(title)}</div>
  </div>
  <div style="position:absolute;left:140px;top:330px;width:720px;height:1018px;background:${WHITE};border-radius:10px;box-shadow:0 20px 48px rgba(11,31,51,.22);overflow:hidden;border:1px solid #DDE2E7">
    <img data-required="1" src="${esc(evidence)}" style="width:100%;height:100%;object-fit:cover;object-position:top">
  </div>
  <div data-swt-text style="position:absolute;left:64px;right:64px;bottom:56px">
    <span data-swt-cta style="background:${DA.hex("purple")};color:${WHITE};font-weight:700;font-size:22px;padding:17px 32px;border-radius:999px;display:inline-block">${esc(cta)}</span>
    ${trustLine ? `<div style="margin-top:16px;color:${MUTED};font-size:15px">${esc(trustLine)}</div>` : ""}
  </div>
</div>`;
}

/** Scene-led 2:3 Pin — routed through the frozen treatment (A/C/E) with the official brand row. */
export function renderScenePin(ctx) {
  const t = ctx.treatment === "E" ? TREATMENT.OUTCOME : ctx.treatment === "C" ? TREATMENT.EDITORIAL_QUOTE : TREATMENT.EMOTIONAL_HOOK;
  return renderCreative(t, {
    scene: ctx.scene, brandName: ctx.brandName, trustLine: ctx.trustLine,
    headline: ctx.headline, support: "", cta: ctx.cta, w: 1000, h: 1500,
    safe: { top: 90, bottom: 90, left: 64, right: 64 },
    grounding: ctx.grounding,
  });
}

/* ---------------------------------------------------------------- truthful video-pending status */
export function videoStatusText(o) {
  const has = typeof o.has === "function" ? o.has : () => false;
  return `${rule("VIDEO EXPORT STATUS")}

STATUS:
PRODUCTION PACKAGE READY — VIDEO NOT YET RENDERED

Package            : ${o.name}
Expected filename  : ${o.file}
Expected format    : MP4 (H.264 + AAC, platform-compatible)
Resolution         : ${o.res}
Aspect ratio       : ${o.aspect}
Approximate length : ${o.duration}
Script             : SCRIPT.txt${has("VOICEOVER.txt") ? " · VOICEOVER.txt" : ""}${has("ON-SCREEN-TEXT.txt") ? " · ON-SCREEN-TEXT.txt" : ""}
Shot plan          : ${has("SHOT-LIST.txt") ? "SHOT-LIST.txt" : has("SCENE-PLAN.txt") ? "SCENE-PLAN.txt" : "-"}
Visual prompts     : ${has("IMAGE-PROMPTS.txt") ? "IMAGE-PROMPTS.txt" : "-"}${has("VIDEO-PROMPT.txt") ? " · VIDEO-PROMPT.txt" : ""}
Product evidence   : ${has("PRODUCT-EVIDENCE-PLAN.txt") ? "PRODUCT-EVIDENCE-PLAN.txt" : "-"}
Thumbnail          : ${has("THUMBNAIL.png") ? "THUMBNAIL.png" : has("COVER.png") ? "COVER.png" : "-"}
Description        : ${has("DESCRIPTION.txt") ? "DESCRIPTION.txt" : "-"}
Chapters           : ${has("CHAPTERS.txt") ? "CHAPTERS.txt" : "-"}
CTA                : ${has("CTA.txt") ? "CTA.txt" : "-"}

No raw video is present in this package. No placeholder or empty MP4 has been created.
When a qualified video provider is activated, place ${o.file} in THIS SAME folder and
update STATUS above to: RENDERED
`;
}

export { inlineImage, esc, TREATMENT, renderCreative, shotVerified, checkCreative, assertImageDecodable, assertSceneGrounded };
