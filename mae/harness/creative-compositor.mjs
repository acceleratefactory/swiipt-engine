// SWIIPT REUSABLE CREATIVE COMPOSITOR (frozen)
//
// Permanent flow (Task §3):
//   ASSET PURPOSE + ASSET ARCHITECTURE + VISUAL GROUNDING + PLATFORM/FORMAT +
//   TRUTH WEIGHTING + CONTENT ROLE
//     -> CREATIVE TREATMENT -> GENERATED VISUAL (where required) + REAL PRODUCT EVIDENCE
//        (where required) + DETERMINISTIC TYPOGRAPHY + SWIIPT BRAND COMPOSITION -> FINAL CREATIVE
//
// Reusable treatment model: A EMOTIONAL_HOOK · B PRODUCT_PROOF · C EDITORIAL_QUOTE
//                           D EDUCATIONAL_CAROUSEL · E OUTCOME · F PRODUCT_CTA
//
// This module contains NO product-specific rendering branch: no product id, asset id,
// angle id or design-spec id appears here (Task §32). Callers supply records; treatment
// selection reads only generic record fields.
//
// Owner corrections applied (Task §4/§5):
//  1. Consumer creative shows SWIIPT branding + approved copy ONLY. No platform labels and
//     no internal identifiers (PPL-/AST-/ANG-/DES-/TR-) are ever rendered.
//  2. Photography rule is ratified as NO_GENERIC_STOCK_PHOTO — context-grounded generated
//     scenes ARE allowed when traceable to the approved Visual Grounding Block; generic,
//     interchangeable or decorative stock imagery is prohibited. Visual Grounding is NOT weakened.
import { writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { stats, decodePng } from "./png-decode.mjs";
// Canonical design authority (Task §30/§31): the compositor resolves brand values from the ONE
// authority record instead of restating them. Fixes the proven defect "incorrect canonical
// palette source" — navy/purple/gold/blush/warm/soft/ink/muted now all resolve from the record.
import * as DA from "./design-authority.mjs";

let seq = 0;
// Repo-relative, host-independent font location (mae/assets/fonts).
const ROOT_MAE = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
// Shared brand typography (self-hosted design-system fonts — a brand asset, not a product input).
// Lives at a neutral shared location so this module has no product- or package-specific path.
const R = join(ROOT_MAE, "assets/fonts");

// Brand colours resolved from the canonical design authority (never hardcoded here).
const NAVY = DA.hex("navy"), PURPLE = DA.hex("purple"), GOLD = DA.hex("gold"),
  BLUSH = DA.hex("blush"), CREAM = DA.hex("warm_surface"), SOFT = DA.hex("soft_surface"),
  INK = DA.hex("ink"), MUTED = DA.supportTokens().text_secondary, WHITE = DA.supportTokens().white;
// Secondary/meta text on a navy surface = the white token at reduced alpha (on-sheet; the previous
// off-sheet blue-greys #C9D6E4/#8FA4BB/#EAF0F6/#DCE6F0 were a proven palette-source defect).
const ON_NAVY_2 = "rgba(255,255,255,.72)";   // secondary text on navy
const ON_NAVY_BODY = "rgba(255,255,255,.82)"; // long-form body on navy
const ON_NAVY_3 = "rgba(255,255,255,.55)";   // meta / counter on navy

export const TREATMENT = {
  EMOTIONAL_HOOK: "A", PRODUCT_PROOF: "B", EDITORIAL_QUOTE: "C",
  EDUCATIONAL_CAROUSEL: "D", OUTCOME: "E", PRODUCT_CTA: "F",
};

/* ------------------------------------------------------------------ ratified photography rule (Task §5)
 * The design specs' literal `no_stock_photo: true` is interpreted as NO_GENERIC_STOCK_PHOTO:
 * context-grounded generated imagery is allowed where the approved Visual Grounding Block and
 * asset purpose require human/environmental storytelling. It is NOT a ban on photography.
 */
export const PHOTOGRAPHY_POLICY = {
  id: "NO_GENERIC_STOCK_PHOTO",
  prohibited: [
    "random smiling people",
    "generic motherhood photography",
    "decorative lifestyle imagery unrelated to the specific situation",
    "interchangeable stock scenes",
    "culturally irrelevant stock scenes",
    "imagery added merely to make a design look attractive",
    "scenes unsupported by Visual Grounding",
  ],
  allowed: [
    "context-grounded generated scenes",
    "situation-specific lifestyle scenes",
    "human/environmental storytelling required by Treatment A or E",
    "generated environments supporting Treatment B/F",
    "imagery directly traceable to the approved Visual Grounding Block",
  ],
  /** Enforcement: a scene may be used only when its exact prompt (built from the approved VGB)
   *  is archived beside it, proving traceability. Missing/empty prompt => RENDER FAILURE. */
  requiresGroundedPrompt: true,
};

/** Deterministic enforcement of the ratified rule — every generated scene must carry its exact
 *  archived prompt (proving it derives from the approved Visual Grounding Block). */
export function assertSceneGrounded(scenePath) {
  const promptPath = scenePath.replace(/\.(jpg|jpeg|png)$/i, ".prompt.txt");
  if (!existsSync(promptPath)) throw new Error(`NO_GENERIC_STOCK_PHOTO: scene has no archived Visual-Grounding prompt: ${scenePath}`);
  const txt = readFileSync(promptPath, "utf8").trim();
  if (txt.length < 40) throw new Error(`NO_GENERIC_STOCK_PHOTO: scene prompt is empty/placeholder: ${promptPath}`);
  return { ok: true, prompt_chars: txt.length };
}

/* ---------------------------------------------------------------- treatment selection (generic) */
export function selectTreatment(asset, des) {
  const type = String(asset.asset_type || "");
  if (type === "SOCIAL_CAROUSEL" || type === "SOCIAL_STORY_SEQUENCE") return TREATMENT.EDUCATIONAL_CAROUSEL;
  if (type === "SOCIAL_REEL") return TREATMENT.OUTCOME;

  const purpose = String((des && des.asset_purpose) || asset.asset_purpose || "").toLowerCase();
  const family = String(asset.family_role || "").toLowerCase();
  const layout = String((des && des.layout_family) || "").toUpperCase();
  const productWeight = asset.weighting_profile ? Number(asset.weighting_profile.product || 0) : 0;

  if (/conversion|product|offer|commerce|purchase|cta/.test(purpose + " " + family)) return TREATMENT.PRODUCT_CTA;
  // an objection is answered by showing the real mechanism (owner-approved: product/mechanism proof)
  if (/objection/.test(purpose + " " + family) && productWeight >= 20) return TREATMENT.PRODUCT_PROOF;
  if (/mechanism|proof|education|decision|clarif|how_it_works/.test(purpose + " " + family)) return TREATMENT.PRODUCT_PROOF;
  // a myth-reframe / insight reframe is an editorial argument at heart
  if (/myth|reframe|quote|editorial|insight|voice|comment/.test(purpose + " " + family)) return TREATMENT.EDITORIAL_QUOTE;
  if (/outcome|success|after|transformation_result/.test(purpose + " " + family)) return TREATMENT.OUTCOME;
  if (/stop_scroll|identification|problem|story|reassurance|awareness/.test(purpose + " " + family)) return TREATMENT.EMOTIONAL_HOOK;
  if (layout === "PHOTO_LED" || layout === "IMAGE_DOMINANT") return TREATMENT.EMOTIONAL_HOOK;
  return TREATMENT.EMOTIONAL_HOOK;
}

/** Sequence progression for carousels / stories: HOOK -> EXPLANATION -> MECHANISM -> SUPPORT -> CTA. */
export function slideTreatment(asset, des, index, total) {
  const purpose = String((des && des.asset_purpose) || asset.asset_purpose || "").toLowerCase();
  if (index === total) return TREATMENT.PRODUCT_CTA;
  const seq5 = [TREATMENT.EMOTIONAL_HOOK, TREATMENT.EDITORIAL_QUOTE, TREATMENT.PRODUCT_PROOF, TREATMENT.EDITORIAL_QUOTE, TREATMENT.OUTCOME];
  const seq4 = [TREATMENT.EMOTIONAL_HOOK, TREATMENT.EDITORIAL_QUOTE, TREATMENT.PRODUCT_PROOF, TREATMENT.PRODUCT_CTA];
  if (total >= 5) return seq5[index - 1] || TREATMENT.EDITORIAL_QUOTE;
  if (purpose === "problem") return [TREATMENT.EMOTIONAL_HOOK, TREATMENT.EMOTIONAL_HOOK, TREATMENT.EDITORIAL_QUOTE, TREATMENT.PRODUCT_CTA][index - 1] || TREATMENT.EDITORIAL_QUOTE;
  return seq4[index - 1] || TREATMENT.EDITORIAL_QUOTE;
}

/* ---------------------------------------------------------------- helpers */
export const fileUrl = (p) => pathToFileURL(p).href;

/** Inline a required visual as a data: URI — removes every path/resolve/load race. */
export function inlineImage(p) {
  const b = readFileSync(p);
  const mime = b[0] === 0xff && b[1] === 0xd8 ? "image/jpeg"
    : b.subarray(0, 8).toString("hex") === "89504e470d0a1a0a" ? "image/png" : null;
  if (!mime) throw new Error("required visual is not a decodable JPEG/PNG: " + p);
  return `data:${mime};base64,${b.toString("base64")}`;
}

/** Node-side decode gate run BEFORE the render (Task §13/§14). Fatal on an undecodable input. */
export function assertImageDecodable(p) {
  const b = readFileSync(p);
  if (b[0] === 0xff && b[1] === 0xd8 && b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9) {
    let off = 2, dims = null;
    while (off < b.length - 1) {
      if (b[off] !== 0xff) { off++; continue; }
      const mk = b[off + 1];
      if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) { dims = { height: b.readUInt16BE(off + 5), width: b.readUInt16BE(off + 7) }; break; }
      if (mk === 0xd8 || mk === 0xd9) { off += 2; continue; }
      off += 2 + b.readUInt16BE(off + 2);
    }
    if (!dims) throw new Error("JPEG has no SOF frame header: " + p);
    return { ok: true, mime: "image/jpeg", dims, bytes: b.length };
  }
  const d = decodePng(p);
  return { ok: true, mime: "image/png", dims: { width: d.w, height: d.h }, bytes: b.length };
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export { esc };

// Canonical brand font kit (Task §9/§35): Inter Black (800) is the hook face; DM Serif Display
// Italic is the verbatim-quote face. Resolved once in the design authority (no duplication).
const fontFace = () => DA.fontFaceCss();

const DEF_SAFE = { top: 120, bottom: 120, left: 80, right: 80 };
const safeOf = (ctx) => Object.assign({}, DEF_SAFE, ctx.safe || {});
const isTall = (ctx) => ctx.h > ctx.w * 1.25;

/** Brand row: the OFFICIAL SWIIPT lockup (mark + wordmark, correct light/dark variant) — never a
 *  CSS approximation (Task §11/§12). Plus an optional customer-facing brand name. NO platform label,
 *  NO internal identifier (Task §4). */
const brandRow = (ctx, onLight = false) => {
  const s = safeOf(ctx);
  const h = isTall(ctx) ? 34 : 32;
  const variant = DA.markVariantFor({ dark: !onLight });
  const logo = DA.logoSvg({ dark: onLight, height: h });
  const name = ctx.brandName ? `<span style="color:${onLight ? MUTED : ON_NAVY_2};font-weight:600;letter-spacing:.14em;font-size:${isTall(ctx) ? 17 : 16}px;text-transform:uppercase;margin-left:16px">${esc(ctx.brandName)}</span>` : "";
  return `
<div data-swt-text style="position:absolute;left:${s.left}px;right:${s.right}px;top:${Math.max(34, s.top * 0.36)}px;display:flex;align-items:center;z-index:5">
  <span data-swt-logo data-swt-logo-variant="${variant}" style="display:inline-flex;align-items:center;line-height:0">${logo}</span>${name}
</div>`;
};

const trustLine = (ctx, onLight = false) => ctx.trustLine
  ? `<span style="color:${onLight ? MUTED : ON_NAVY_2};font-size:${isTall(ctx) ? 15 : 14}px">${esc(ctx.trustLine)}</span>` : "";

const ctaPill = (ctx, onLight = false) => ctx.cta ? `
<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:${isTall(ctx) ? 30 : 26}px">
  <span data-swt-cta style="background:${PURPLE};color:${WHITE};font-weight:700;font-size:${isTall(ctx) ? 24 : 21}px;padding:${isTall(ctx) ? "18px 34px" : "15px 28px"};border-radius:999px;display:inline-block">${esc(ctx.cta)}</span>
  ${trustLine(ctx, onLight)}
</div>` : "";

/** SEMANTIC typography (Task §10). role ∈ hook (Inter Black 800) · editorial_headline (DM Serif
 *  Regular) · verbatim_quote (DM Serif Italic — real quotes ONLY). No product branch. */
const headline = (ctx, t, size, color = WHITE, role = "hook") => {
  if (!t) return "";
  const c = DA.typeCss(role);
  const ls = role === "hook" ? ".005em" : "-.01em";
  const lh = role === "hook" ? 1.08 : 1.12;
  return `<div data-swt-text data-swt-role="${role}" style="font-family:${c.family};font-weight:${c.weight};font-style:${c.style};font-size:${size}px;line-height:${lh};letter-spacing:${ls};color:${color};text-shadow:0 2px 18px rgba(0,0,0,.45)">${esc(t)}</div>`;
};
const support = (ctx, t, size, color = ON_NAVY_BODY) => t
  ? `<div data-swt-text style="margin-top:${isTall(ctx) ? 22 : 18}px;font-size:${size}px;line-height:1.44;color:${color};max-width:96%">${esc(t)}</div>` : "";
const slideCounter = (ctx) => ctx.counter
  ? `<span style="position:absolute;right:${safeOf(ctx).right}px;bottom:${Math.max(30, safeOf(ctx).bottom * 0.32)}px;color:${ON_NAVY_3};font-weight:600;font-size:15px;letter-spacing:.08em;z-index:6">${ctx.counter.i} / ${ctx.counter.n}</span>` : "";

/* Grounding Element Rule (MVS) — a visible, specific factual design piece (gold-outlined pill per the
 * approved Hook Graphic sample). Distinct from Visual Grounding. Never fabricated here: only rendered
 * when the caller supplies a real grounding element. Machine-checkable via data-swt-grounding. */
const GROUNDING_ICON = {
  "day/time badge": `<circle cx="9" cy="9" r="7"/><path d="M9 5v4l2.5 1.5"/>`,
  "verbatim attribution": `<path d="M9 6c-2.2 0-3.5 1.6-3.5 3.6 0 1.7 1.2 2.9 2.7 2.9.5 0 1-.1 1.3-.3-.2 1.4-1.3 2.5-2.8 3.1"/><path d="M16 6c-2.2 0-3.5 1.6-3.5 3.6 0 1.7 1.2 2.9 2.7 2.9.5 0 1-.1 1.3-.3-.2 1.4-1.3 2.5-2.8 3.1"/>`,
  "named mechanism": `<path d="M3.5 9h11"/><path d="M9 3.5v11"/><circle cx="9" cy="9" r="7"/>`,
  "real number": `<path d="M4 6h10M4 12h10"/><path d="M7 3.5 6 14.5M12 3.5 11 14.5"/>`,
};
const groundingBadge = (ctx) => {
  if (!ctx.grounding || !DA.isGroundingElement(ctx.grounding)) return "";
  const form = String(ctx.grounding.form || ctx.grounding.kind || "").toLowerCase();
  const icon = GROUNDING_ICON[form] || GROUNDING_ICON["named mechanism"];
  return `<div data-swt-grounding data-swt-grounding-form="${esc(form)}" style="display:inline-flex;align-items:center;gap:9px;border:1.5px solid ${GOLD};color:${GOLD};font-weight:700;font-size:${isTall(ctx) ? 17 : 16}px;letter-spacing:.1em;text-transform:uppercase;padding:7px 15px;border-radius:999px;margin-bottom:20px;background:rgba(11,31,51,.35)">
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="${GOLD}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>
  <span>${esc(ctx.grounding.text || ctx.grounding.value)}</span></div>`;
};

const HS = (ctx) => (isTall(ctx) ? (ctx.h > 1500 ? 66 : 60) : 60);
const SS = (ctx) => (isTall(ctx) ? 27 : 28);

/* ---------------------------------------------------------------- TREATMENT A — EMOTIONAL / PROBLEM HOOK
 * The generated photograph IS the canvas. Navy is only a scrim / text-safe region.
 */
export function renderEmotionalHook(ctx) {
  const s = safeOf(ctx), { w: W, h: H } = ctx;
  return `
<div style="position:relative;width:${W}px;height:${H}px;overflow:hidden;background:${NAVY};font-family:Inter,sans-serif">
  <img data-required="1" src="${esc(ctx.scene)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center ${isTall(ctx) ? "38%" : "32%"}">
  <div style="position:absolute;left:0;right:0;top:0;height:26%;background:linear-gradient(180deg,rgba(11,31,51,.80) 0%,rgba(11,31,51,.30) 55%,rgba(11,31,51,0) 100%)"></div>
  <div style="position:absolute;left:0;right:0;bottom:0;height:${isTall(ctx) ? 52 : 60}%;background:linear-gradient(180deg,rgba(11,31,51,0) 0%,rgba(11,31,51,.30) 30%,rgba(11,31,51,.74) 58%,rgba(11,31,51,.93) 100%)"></div>
  ${brandRow(ctx)}
  <div data-swt-text style="position:absolute;left:${s.left}px;right:${s.right}px;bottom:${Math.max(40, s.bottom * 0.42)}px;z-index:5">
    ${groundingBadge(ctx)}${headline(ctx, ctx.headline, HS(ctx), WHITE, "hook")}${support(ctx, ctx.support, SS(ctx))}${ctaPill(ctx)}
  </div>
  ${slideCounter(ctx)}
</div>`;
}

/* ---------------------------------------------------------------- TREATMENT B — PRODUCT / MECHANISM PROOF
 * The REAL product artifact dominates. The generated scene is the environment behind it.
 */
export function renderProductProof(ctx) {
  const s = safeOf(ctx), { w: W, h: H } = ctx;
  const tall = isTall(ctx);
  const artW = tall ? 620 : 564, artH = Math.round(artW / 0.707);
  const art = `
  <div style="position:absolute;left:${tall ? "50%" : (s.left + 388) + "px"};top:${tall ? (s.top + 300) + "px" : s.top + "px"};${tall ? "transform:translateX(-50%);" : ""}width:${artW}px;z-index:4">
    <div style="width:${artW}px;height:${artH}px;background:#fff;border-radius:12px;box-shadow:0 28px 64px rgba(0,0,0,.55);overflow:hidden;border:1px solid rgba(255,255,255,.5)">
      <img data-required="1" src="${esc(ctx.evidence)}" style="width:100%;height:100%;object-fit:cover;object-position:top">
    </div>
    <div data-swt-text style="margin-top:14px;color:${ON_NAVY_2};font-size:${tall ? 17 : 17}px;line-height:1.35">${esc(ctx.evidenceLabel)}</div>
  </div>`;
  const copy = tall
    ? `<div data-swt-text style="position:absolute;left:${s.left}px;right:${s.right}px;top:${s.top + 60}px;z-index:5">
        ${badge(ctx)}${groundingBadge(ctx)}${headline(ctx, ctx.headline, 46, WHITE, "hook")}${support(ctx, ctx.support, 22)}
       </div>
       <div style="position:absolute;left:${s.left}px;right:${s.right}px;bottom:${Math.max(40, s.bottom * 0.42)}px;z-index:5">${ctaPill(ctx)}</div>`
    : `<div data-swt-text style="position:absolute;left:${s.left}px;top:${s.top + 30}px;width:344px;z-index:5">
        ${badge(ctx)}${groundingBadge(ctx)}${headline(ctx, ctx.headline, 38, WHITE, "hook")}${support(ctx, ctx.support, 20)}
       </div>
       <div style="position:absolute;left:${s.left}px;bottom:${Math.max(40, s.bottom * 0.5)}px;width:344px;z-index:5">${ctaPill(ctx)}</div>`;
  return `
<div style="position:relative;width:${W}px;height:${H}px;overflow:hidden;background:${NAVY};font-family:Inter,sans-serif">
  <img data-required="1" src="${esc(ctx.scene)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 40%;filter:brightness(.58) saturate(.95)">
  <div style="position:absolute;inset:0;background:linear-gradient(105deg,rgba(11,31,51,.90) 0%,rgba(11,31,51,.66) 46%,rgba(11,31,51,.34) 100%)"></div>
  ${brandRow(ctx)}
  ${copy}
  ${art}
</div>`;
}

const badge = (ctx) => ctx.badge
  ? `<div style="display:inline-block;background:${GOLD};color:${NAVY};font-weight:700;font-size:14px;letter-spacing:.12em;padding:6px 13px;border-radius:999px;margin-bottom:18px">${esc(ctx.badge)}</div>` : "";

/* ---------------------------------------------------------------- TREATMENT C — EDITORIAL / QUOTE
 * Typography-led is legitimate when the asset purpose calls for it. No photo required.
 */
export function renderEditorialQuote(ctx) {
  const s = safeOf(ctx), { w: W, h: H } = ctx;
  const dark = ctx.variant === "navy";
  const bg = dark ? NAVY : CREAM;
  const fg = dark ? WHITE : INK;
  const body = dark ? ON_NAVY_BODY : MUTED;
  // DM Serif Italic is reserved for VERBATIM quotes; a non-quote editorial line uses DM Serif Regular.
  const headRole = ctx.verbatim ? "verbatim_quote" : "editorial_headline";
  const qSize = isTall(ctx) ? 118 : 104;
  const hSize = isTall(ctx) ? 58 : 50;
  return `
<div style="position:relative;width:${W}px;height:${H}px;overflow:hidden;background:${bg};font-family:Inter,sans-serif">
  <div style="position:absolute;left:0;top:0;width:100%;height:7px;background:${GOLD}"></div>
  ${brandRow(ctx, !dark)}
  <div data-swt-text style="position:absolute;left:${s.left}px;right:${s.right}px;top:50%;transform:translateY(-50%);z-index:5">
    <div style="font-family:'DM Serif Display',Georgia,serif;font-size:${qSize}px;line-height:.6;color:${GOLD};margin-bottom:22px">&ldquo;</div>
    ${headline(ctx, ctx.headline, hSize, fg, headRole)}
    ${ctx.support ? `<div style="margin-top:26px;font-size:${isTall(ctx) ? 26 : 23}px;line-height:1.5;color:${body};max-width:94%">${esc(ctx.support)}</div>` : ""}
    <div style="width:62px;height:3px;background:${GOLD};margin:34px 0 18px"></div>
    <div data-swt-attribution style="font-size:15px;letter-spacing:.14em;text-transform:uppercase;color:${dark ? ON_NAVY_3 : MUTED};font-weight:600">${esc(ctx.attribution || "SWIIPT")}</div>
  </div>
  ${ctx.cta ? `<div style="position:absolute;left:${s.left}px;right:${s.right}px;bottom:${Math.max(40, s.bottom * 0.5)}px;z-index:5">${ctaPill(ctx, !dark)}</div>` : ""}
  ${slideCounter(ctx)}
</div>`;
}

/* ---------------------------------------------------------------- TREATMENT E — TRANSFORMATION / OUTCOME */
export function renderOutcome(ctx) {
  const s = safeOf(ctx), { w: W, h: H } = ctx;
  return `
<div style="position:relative;width:${W}px;height:${H}px;overflow:hidden;background:${NAVY};font-family:Inter,sans-serif">
  <img data-required="1" src="${esc(ctx.scene)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center ${isTall(ctx) ? "42%" : "40%"}">
  <div style="position:absolute;left:0;right:0;bottom:0;height:${isTall(ctx) ? 46 : 52}%;background:linear-gradient(180deg,rgba(11,31,51,0) 0%,rgba(11,31,51,.62) 48%,rgba(11,31,51,.94) 100%)"></div>
  <div style="position:absolute;left:0;right:0;top:0;height:20%;background:linear-gradient(180deg,rgba(11,31,51,.74) 0%,rgba(11,31,51,0) 100%)"></div>
  ${brandRow(ctx)}
  <div data-swt-text style="position:absolute;left:${s.left}px;right:${s.right}px;bottom:${Math.max(40, s.bottom * 0.42)}px;z-index:5">${groundingBadge(ctx)}${headline(ctx, ctx.headline, HS(ctx) - 6, WHITE, "hook")}${support(ctx, ctx.support, SS(ctx) - 2)}${ctaPill(ctx)}</div>
</div>`;
}

/* ---------------------------------------------------------------- TREATMENT F — PRODUCT / CTA
 * Real product evidence + approved promise + strong CTA.
 */
export function renderProductCTA(ctx) {
  const s = safeOf(ctx), { w: W, h: H } = ctx;
  const tall = isTall(ctx);
  const artW = tall ? 560 : 330, artH = Math.round(artW / 0.707);
  const art = `
  <div style="position:absolute;${tall
    ? `left:50%;transform:translateX(-50%);top:${Math.round(H * 0.34)}px;`
    : `right:${s.right}px;top:${Math.round(H * 0.23)}px;`}width:${artW}px;z-index:4">
    <div style="width:${artW}px;height:${artH}px;background:#fff;border-radius:11px;box-shadow:0 26px 60px rgba(0,0,0,.55);overflow:hidden">
      <img data-required="1" src="${esc(ctx.evidence)}" style="width:100%;height:100%;object-fit:cover;object-position:top">
    </div>
    <div data-swt-text style="margin-top:12px;color:${ON_NAVY_2};font-size:${tall ? 16 : 15}px;line-height:1.35">${esc(ctx.evidenceLabel)}</div>
  </div>`;
  const copy = tall
    ? `<div data-swt-text style="position:absolute;left:${s.left}px;right:${s.right}px;top:${s.top + 50}px;z-index:5">
        ${headline(ctx, ctx.headline, 50, WHITE, "hook")}${support(ctx, ctx.support, 24)}
       </div>
       <div style="position:absolute;left:${s.left}px;right:${s.right}px;bottom:${Math.max(40, s.bottom * 0.42)}px;z-index:5">${ctaPill(ctx)}</div>`
    : `<div style="position:absolute;left:${s.left}px;top:${Math.round(H * 0.2)}px;width:${W - s.left - s.right - artW - 40}px;z-index:5">
        ${headline(ctx, ctx.headline, 50, WHITE, "hook")}${support(ctx, ctx.support, 24)}${ctaPill(ctx)}
       </div>`;
  return `
<div style="position:relative;width:${W}px;height:${H}px;overflow:hidden;background:${NAVY};font-family:Inter,sans-serif">
  <img data-required="1" src="${esc(ctx.scene)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 36%;filter:brightness(.82) saturate(1.02)">
  <div style="position:absolute;inset:0;background:linear-gradient(105deg,rgba(11,31,51,.90) 0%,rgba(11,31,51,.62) 42%,rgba(11,31,51,.22) 100%)"></div>
  ${brandRow(ctx)}
  ${copy}
  ${art}
  ${slideCounter(ctx)}
</div>`;
}

/** Dispatch by treatment category (reusable; no product-specific renderer). */
export function renderCreative(treatment, ctx) {
  switch (treatment) {
    case TREATMENT.PRODUCT_PROOF: return renderProductProof(ctx);
    case TREATMENT.EDITORIAL_QUOTE: return renderEditorialQuote(ctx);
    case TREATMENT.OUTCOME: return renderOutcome(ctx);
    case TREATMENT.PRODUCT_CTA: return renderProductCTA(ctx);
    case TREATMENT.EMOTIONAL_HOOK:
    default: return renderEmotionalHook(ctx);
  }
}

/* ---------------------------------------------------------------- render + VERIFY */
function buildDoc(html, w, h, requireCta = true) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${fontFace()}
html,body{margin:0;padding:0;width:${w}px;height:${h}px;overflow:hidden}*{box-sizing:border-box}
img{display:block}</style></head><body>${html}
<script>
(function(){
  var W=${w},H=${h},REQ_CTA=${requireCta ? "true" : "false"};
  function run(){
    var res={img_ok:true,img_bad:[],text_ok:true,text_bad:[],cta:!!document.querySelector('[data-swt-cta]'),logo:!!document.querySelector('[data-swt-logo]')};
    document.querySelectorAll('img[data-required="1"]').forEach(function(i){
      if(!i.complete||i.naturalWidth===0){res.img_ok=false;res.img_bad.push(i.getAttribute('src'));}
    });
    document.querySelectorAll('[data-swt-text]').forEach(function(el){
      var r=el.getBoundingClientRect();
      if(r.width>0&&r.height>0&&(r.left<-1||r.top<-1||r.right>W+1||r.bottom>H+1)){
        res.text_ok=false;res.text_bad.push(Math.round(r.left)+','+Math.round(r.top)+','+Math.round(r.right)+','+Math.round(r.bottom));
      }
    });
    if(REQ_CTA&&!res.cta)res.text_ok=false;
    var st=(res.img_ok&&res.text_ok)?'ok':'fail';
    document.documentElement.setAttribute('data-swt-check',st+'|'+JSON.stringify(res));
  }
  Promise.all(Array.prototype.slice.call(document.images).map(function(i){return i.decode?i.decode().catch(function(){}):Promise.resolve();}))
    .then(function(){setTimeout(run,250);});
})();
</script></body></html>`;
}

/**
 * Render creative HTML and VERIFY every required visual decoded before declaring success.
 * Returns { ok, status, dims?, check? } — ok:false is a RENDER FAILURE (Task §13/§14/§9).
 */
export function shotVerified(html, w, h, outPng, { keepDoc = true, requireCta = true, verify = true } = {}) {
  const doc = buildDoc(html, w, h, requireCta);
  const hp = outPng.replace(/\.png$/, ".src.html");
  writeFileSync(hp, doc, "utf8");
  const udd = join(tmpdir(), `swt-edge-${process.pid}-${(seq++)}`);
  const base = ["--headless", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files", "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-background-networking", `--user-data-dir=${udd}`, `--window-size=${w},${h}`, "--virtual-time-budget=15000"];
  const cleanup = () => { try { rmSync(udd, { recursive: true, force: true }); } catch { /* ignore */ } };

  if (verify) {
    let check = null, attempts = 0;
    while (attempts < 2) {
      attempts++;
      let dom = "";
      try { dom = execFileSync(EDGE, [...base, "--dump-dom", fileUrl(hp)], { timeout: 120000, encoding: "utf8", maxBuffer: 96 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }); } catch { dom = ""; }
      const m = /data-swt-check="([^"]*)"/.exec(dom);
      if (m) {
        const raw = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
        const [verdict, jsonPart] = raw.split("|");
        try { check = JSON.parse(jsonPart); } catch { check = {}; }
        check.verdict = verdict;
        break;
      }
    }
    if (!check) { cleanup(); return { ok: false, status: "VERIFY_MARKER_ABSENT" }; }
    if (check.verdict !== "ok") { cleanup(); return { ok: false, status: "IMAGE_OR_TEXT_VERIFY_FAILED", check }; }
  }
  try {
    execFileSync(EDGE, [...base, `--screenshot=${outPng}`, fileUrl(hp)], { timeout: 120000, stdio: ["ignore", "pipe", "ignore"] });
  } catch (e) {
    cleanup(); return { ok: false, status: "SCREENSHOT_FAILED", error: String(e.message || e).slice(0, 300) };
  }
  cleanup();
  const b = readFileSync(outPng);
  if (b.readUInt32BE(0) !== 0x89504e47) return { ok: false, status: "OUTPUT_NOT_PNG" };
  const dims = { width: b.readUInt32BE(16), height: b.readUInt32BE(20), bytes: b.length };
  if (dims.width !== w || dims.height !== h) return { ok: false, status: `DIMS_MISMATCH ${dims.width}x${dims.height}`, dims };
  return { ok: true, status: "RENDERED", dims };
}

/** Objective compositor-boundary checks (Task §25). RENDERED means the required visual
 *  communication actually reached the final image. */
export function checkCreative(pngPath, treatment, regions = {}) {
  const s = stats(pngPath, regions);
  const notes = [];
  const imageLed = treatment === TREATMENT.EMOTIONAL_HOOK || treatment === TREATMENT.OUTCOME || treatment === TREATMENT.PRODUCT_CTA;
  if (imageLed) {
    // a photograph must actually occupy the canvas (the demonstrated defect was 83-99% flat navy)
    if (s.flat_navy_pct > 45) notes.push(`flat navy ${s.flat_navy_pct}% (>45) — navy scaffold, not finished creative`);
    if (s.nonflat_pct < 55) notes.push(`scene coverage ${s.nonflat_pct}% (<55) — generated scene suppressed`);
    if (s.third_nonflat_pct[0] < 55) notes.push(`top-third scene coverage ${s.third_nonflat_pct[0]}% (<55) — text zone swallowed the scene`);
    if (s.third_navy_pct[0] > 40) notes.push(`top-third still navy ${s.third_navy_pct[0]}% (>40) — scene not rendered at top`);
  }
  if (treatment === TREATMENT.PRODUCT_PROOF) {
    if (s.flat_navy_pct > 62) notes.push(`flat navy ${s.flat_navy_pct}% (>62) — navy scaffold`);
    const ev = s.regions.evidence;
    if (!ev) notes.push("no evidence region measured");
    else {
      if (ev.luma_stddev < 12) notes.push(`evidence region luma stddev ${ev.luma_stddev} (<12) — artifact frame blank/placeholder`);
      if (ev.navy_pct > 60) notes.push(`evidence region navy ${ev.navy_pct}% — artifact failed to render`);
    }
  }
  if (treatment === TREATMENT.EDITORIAL_QUOTE) {
    // Treatment C is legitimately typography-led: a dominant navy OR cream surface is correct.
    // But it must not be a blank scaffold, so the surface must dominate AND carry real ink
    // (body text in the contrasting colour, plus the gold rule).
    const navySurface = s.flat_navy_pct >= 55;
    const creamSurface = s.white_pct + s.cream_pct >= 55;
    if (!navySurface && !creamSurface) notes.push(`editorial surface not dominant (navy ${s.flat_navy_pct}% / cream ${(s.white_pct + s.cream_pct).toFixed(1)}%)`);
    const ink = s.nonflat_pct + (navySurface ? s.white_pct : s.flat_navy_pct);
    if (ink < 1.5) notes.push(`editorial ink ${ink.toFixed(1)}% (<1.5) — surface rendered but no text/rule (scaffold)`);
  }
  return { pass: notes.length === 0, notes, stats: s };
}

export { stats, NAVY, PURPLE, GOLD, BLUSH, CREAM, SOFT, INK, MUTED, WHITE, EDGE, DEF_SAFE, groundingBadge, DA };
