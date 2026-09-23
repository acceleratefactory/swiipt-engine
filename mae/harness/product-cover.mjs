// SWIIPT CANONICAL PRODUCT COVER — generalized production-contract module.
//
// Every applicable product derives ONE canonical cover identity from existing truths + the locked
// SWIIPT design authority. The cover generator NEVER invents outcomes/statistics/testimonials/
// savings/efficacy/promises/mechanisms/situations (task §3). It always produces a provider-ready
// generation specification; provider execution is optional and truthful when absent (§8).
//
// Product-agnostic: no product id / asset id / angle id appears here. Callers supply records.
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as DA from "./design-authority.mjs";
import { shotVerified } from "./creative-compositor.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export const COVER_ASSET_TYPE = "PRODUCT_COVER";
export const COVER_STATUS = Object.freeze({ GENERATED: "GENERATED", PENDING_PROVIDER: "PENDING_PROVIDER", RENDER_FAILED: "RENDER_FAILED" });
/** The provider-executed (photo-anchored) cover image needs a qualified image provider ($0 policy). */
export function coverProviderStatus() {
  try {
    const p = join(ROOT, "mae", "media", "image-provider.js");
    if (!existsSync(p)) return { available: false, reason: "no image provider module" };
    return { available: false, reason: "no qualified image provider configured (pre-revenue $0)" };
  } catch { return { available: false, reason: "provider status unavailable" }; }
}

/** Canonical cover truth inputs, derived from the product/transformation/brand records. */
export function coverData(productId, { root = ROOT } = {}) {
  const pdir = join(root, "data", "products", productId);
  const productPath = join(pdir, "product.json");
  if (!existsSync(productPath)) throw new Error(`product-cover: no product.json for ${productId}`);
  const p = readJson(productPath);
  const trId = p?.identity?.transformation_id ?? null;
  const tr = trId && existsSync(join(root, "data", "transformations", `${trId}.json`)) ? readJson(join(root, "data", "transformations", `${trId}.json`)) : null;

  const libId = p?.identity?.library_id ?? null;
  const libPath = libId ? join(root, "data", "libraries", `${libId}.json`) : null;
  const area = libPath && existsSync(libPath) ? (readJson(libPath).name ?? libId) : libId;

  const mechanism = p?.transformation?.mechanism?.core ?? tr?.mechanism?.core_mechanism ?? "";
  const mechanismCue = isStr(mechanism) ? String(mechanism).split(/[.;]/)[0].trim() : "";
  const labels = (p?.evidence?.claim_labels ?? []).map((c) => c?.label).filter(isStr);
  const evidenceLabel = labels.find((l) => ["sourced_evidence", "expert_reviewed"].includes(l)) ?? labels[0] ?? "model_inference";
  const assetTitles = Object.values(p?.asset_map ?? {}).flatMap((list) => (Array.isArray(list) ? list : [])).map((aid) => {
    const af = join(pdir, "assets", `${aid}.json`);
    return existsSync(af) ? readJson(af).title : null;
  }).filter(isStr);

  // Visual mode: photo-anchored only when an approved Visual Grounding Block / scene genuinely exists.
  const visualMode = isStr(p?.cover?.scene) ? "photo_anchored" : "typographic";

  return {
    cover_id: `COVER-${productId}`,
    asset_type: COVER_ASSET_TYPE,
    product_id: productId,
    transformation_id: trId,
    title: p?.identity?.name ?? null,
    subtitle: p?.identity?.subtitle ?? null,
    promise: p?.identity?.one_line_promise ?? null,
    area,
    evidence_label: evidenceLabel,
    mechanism_cue: mechanismCue,
    artifact_cues: assetTitles.slice(0, 6),
    visual_mode: visualMode,
    scene: p?.cover?.scene ?? null,
    palette: DA.PALETTE(),
    typography: { title: DA.typeCss("editorial_headline"), body: DA.typeCss("body"), label: DA.typeCss("label"), hook: DA.typeCss("hook") },
    branding: { mark_variant: DA.markVariantFor({ dark: true }), logo: { light: "lockup-horizontal-primary", dark: "lockup-horizontal-reverse" } },
    exclusions: [
      "no generic finance imagery", "no money piles", "no floating currency", "no fake banking dashboards",
      "no luxury-family clichés", "no generic smiling stock", "no pink wash",
      "no savings/efficacy/guarantee claims", "no statistics/testimonials", "no internal ids",
    ],
    truth_constraints: [tr?.safety?.scope_boundary, p?.safety?.disclaimer].filter(isStr),
    crop_safe: "keep title, subtitle, mark and area label inside 8% margins; safe across 2:3, 1:1 and 1200x630 crops",
    accessibility: { min_contrast_ratio: DA.contrastMin(), note: "white/gold on navy; never colour-only meaning" },
    has_vgb: visualMode === "photo_anchored",
  };
}

/** Provider-ready cover generation specification (structured + prompt text). */
export function coverGenerationSpec(data) {
  const structured = {
    asset_type: COVER_ASSET_TYPE,
    asset_purpose: "individual product visual identity (customer-product cover, single-product page, catalogue card, marketing mockup, OG)",
    aspect_ratio: "2:3 portrait (primary); 1:1 and 1200x630 derived",
    visual_mode: data.visual_mode,
    scene: data.scene ?? "expecting / new-parent household planning and baby-purchase decisions (ground only if a Visual Grounding Block is approved)",
    subjects: "one parent (or both parents) in a real domestic planning moment, unposed, not smiling-for-camera",
    environment: "ordinary family home; a table/phone with a list or a fridge/chart surface; grounded objects only",
    composition: "editorial; product title dominant; mark top-left; area label; restrained lower-third cue",
    product_title: data.title,
    subtitle: data.subtitle,
    typography_intent: "DM Serif Display title; Inter subtitle/labels; Inter Black only for a hook, never for quotes",
    palette: data.palette,
    branding: data.branding,
    artifact_product_cues: data.artifact_cues,
    exclusions: data.exclusions,
    truth_constraints: data.truth_constraints,
    crop_safe_rules: data.crop_safe,
    accessibility: data.accessibility,
  };
  const lines = [
    `SWIIPT PRODUCT COVER — GENERATION SPECIFICATION`,
    `Asset: ${structured.asset_type}  |  Product: ${data.title}`,
    `Aspect: ${structured.aspect_ratio}  |  Mode: ${structured.visual_mode}`,
    ``,
    `SCENE: ${structured.scene}`,
    `SUBJECTS: ${structured.subjects}`,
    `ENVIRONMENT: ${structured.environment}`,
    `COMPOSITION: ${structured.composition}`,
    `TITLE (overlay, deterministic): ${data.title}`,
    `SUBTITLE (overlay): ${data.subtitle}`,
    `MECHANISM CUE: ${data.mechanism_cue}`,
    `TYPOGRAPHY: ${structured.typography_intent}`,
    `PALETTE: ${data.palette.join(", ")}`,
    `BRANDING: official SWIIPT lockup (${data.branding.mark_variant} on dark)`,
    `ARTIFACT/PRODUCT CUES: ${data.artifact_cues.join(" | ") || "(none)"}`,
    ``,
    `EXCLUSIONS: ${data.exclusions.join("; ")}`,
    `TRUTH CONSTRAINTS: ${data.truth_constraints.join("; ") || "(none)"}`,
    `CROP-SAFE: ${data.crop_safe}`,
    `ACCESSIBILITY: min contrast ${data.accessibility.min_contrast_ratio}:1; ${data.accessibility.note}`,
  ];
  return { structured, prompt_text: lines.join("\n") };
}

/** Canonical variants, derived deterministically from the ONE cover identity. */
export function coverVariants() {
  return [
    { name: "portrait", width: 1000, height: 1500, aspect: "2:3", use: "customer-product cover + single-product-page primary" },
    { name: "square", width: 1080, height: 1080, aspect: "1:1", use: "catalogue card + social crop" },
    { name: "og", width: 1200, height: 630, aspect: "1200x630", use: "OG/share" },
  ];
}

/** Deterministic typographic cover (real, on-brand; no AI provider required). */
export function coverHtml(data, v) {
  const logoSvg = DA.logoSvg({ dark: true, height: v.name === "og" ? 38 : 46 });
  const titleSize = v.name === "og" ? 66 : v.name === "square" ? 62 : 92;
  const pad = v.name === "og" ? 56 : v.name === "square" ? 72 : 84;
  const NAVY = DA.hex("navy"), GOLD = DA.hex("gold"), WHITE = DA.supportTokens().white, CREAM = DA.hex("warm_surface");
  const gold = `<div style="width:${v.name === "og" ? 70 : 90}px;height:4px;background:${GOLD};margin:${v.name === "og" ? 14 : 22}px 0"></div>`;
  const area = data.area ? `<div style="margin-top:${v.name === "og" ? 10 : 18}px;font:600 ${v.name === "og" ? 17 : 20}px Inter,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:${GOLD}">${esc(data.area)}</div>` : "";
  return `
<div style="position:relative;width:${v.width}px;height:${v.height}px;overflow:hidden;background:radial-gradient(120% 90% at 80% 90%, rgba(255,255,255,.06) 0%, ${NAVY} 60%);font-family:Inter,sans-serif">
  <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,31,51,0) 40%,rgba(11,31,51,.86) 100%)"></div>
  <div style="position:absolute;left:${pad}px;top:${pad}px;display:inline-flex;line-height:0">${logoSvg}</div>
  <div style="position:absolute;left:${pad}px;right:${pad}px;bottom:${pad}px">
    <div style="font-family:'DM Serif Display',Georgia,serif;font-weight:400;font-size:${titleSize}px;line-height:1.06;color:${WHITE};text-shadow:0 2px 18px rgba(0,0,0,.5)">${esc(data.title)}</div>
    ${gold}
    <div style="font:400 ${v.name === "og" ? 22 : 26}px/1.4 Inter,sans-serif;color:rgba(255,255,255,.86);max-width:92%">${esc(data.subtitle ?? "")}</div>
    ${area}
    <div style="margin-top:${v.name === "og" ? 16 : 26}px;display:inline-block;border:1.5px solid ${GOLD};color:${GOLD};font:700 ${v.name === "og" ? 15 : 17}px Inter,sans-serif;letter-spacing:.1em;text-transform:uppercase;padding:7px 15px;border-radius:999px">${esc(data.mechanism_cue)}</div>
    <div style="margin-top:${v.name === "og" ? 14 : 22}px;font:400 ${v.name === "og" ? 14 : 16}px Inter,sans-serif;color:rgba(255,255,255,.62)">Educational content — not medical, clinical, or mental-health advice.</div>
  </div>
</div>`;
}

/**
 * Produce the canonical cover for a product: always persist the generation specification; render the
 * deterministic typographic variants; mark the provider (photo) variant truthfully.
 */
export function produceProductCover(productId, { root = ROOT, outDir = null, render = true } = {}) {
  const data = coverData(productId, { root });
  const spec = coverGenerationSpec(data);
  const variants = coverVariants();
  const dir = outDir ?? join(root, "data", "products", productId, "cover");
  mkdirSync(dir, { recursive: true });

  const provider = coverProviderStatus();
  const record = {
    asset_type: COVER_ASSET_TYPE,
    cover_id: data.cover_id,
    product_id: productId,
    canonical_identity: `${data.cover_id}.portrait`,
    data,
    generation_spec: spec.structured,
    generation_prompt: spec.prompt_text,
    variants: variants.map((v) => ({ ...v, file: `cover-${v.name}.png`, derived_from: "canonical cover identity" })),
    provider: { ...provider, status: provider.available ? COVER_STATUS.GENERATED : COVER_STATUS.PENDING_PROVIDER },
    canonical_status: COVER_STATUS.GENERATED,   // the typographic cover identity IS realised (deterministic)
    render_kind: "typographic_deterministic",
    provenance: { generated_by: "mae/harness/product-cover.mjs", authority: "SWIIPT customer-product design authority + Brand Truth" },
  };

  writeFileSync(join(dir, "cover.json"), JSON.stringify(record, null, 2) + "\n", "utf8");
  writeFileSync(join(dir, "generation-spec.txt"), spec.prompt_text + "\n", "utf8");

  if (render) {
    for (const v of variants) {
      const out = join(dir, `cover-${v.name}.png`);
      try {
        const r = shotVerified(coverHtml(data, v), v.width, v.height, out, { requireCta: false });
        v.render = r.ok ? "RENDERED" : r.status;
      } catch (e) { v.render = "RENDER_FAILED"; }
      record.variants.find((x) => x.name === v.name).render = v.render;
    }
    writeFileSync(join(dir, "cover.json"), JSON.stringify(record, null, 2) + "\n", "utf8");
  }
  record.dir = dir;
  return record;
}

/** Surface bindings: every consumer references the ONE canonical cover identity (never a re-invented cover). */
export function coverSurfaceRefs(productId, { root = ROOT } = {}) {
  const dir = join(root, "data", "products", productId, "cover");
  const id = `COVER-${productId}`;
  const v = (n) => join(dir, `cover-${n}.png`);
  return {
    canonical_identity: `${id}.portrait`,
    single_product_page: v("portrait"),
    customer_product: v("portrait"),
    catalogue_card: v("square"),
    og_share: v("og"),
    marketing: v("square"),
    trailer_reveal: v("portrait"),
    spec: join(dir, "generation-spec.txt"),
    record: join(dir, "cover.json"),
  };
}
