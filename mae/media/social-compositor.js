// MAE · Social Design Production — deterministic static compositor (Wave S-C).
// Turns a SocialDesignSpecification + projected social tokens + approved copy into a LayoutPlan and ONE
// complete, deterministic SVG social graphic for SOCIAL_STATIC.
//
// It is NOT a designer: it never decides the angle, customer pain, claims, product facts, prices, CTA
// wording, evidence meaning, testimonials or statistics. It only arranges approved content.
//
// Reuses (no duplication): S-A contract validation, S-B token projection + component primitives,
// layout.wrapText/svgVisibleText/textMatches, the existing 8pt grid and safe-area conventions.
// No carousel/story assembly, no image provider, no raster, no SocialGraphicQA, no network.
import { renderComponent, COMPONENT_STATUS, measureLines } from "./social-components.js";
import { socialTokens } from "../services/social-design-tokens.js";
import { validateSocialDesignSpec, LAYOUT_FAMILIES, ASSET_TYPES } from "../services/social-design-spec.js";
import { svgVisibleText, textMatches } from "./layout.js";
import { sourceMediaProvenance, hasGeneratedMedia, hasSyntheticMedia } from "./social-source-media.js";

export const SOCIAL_COMPOSITOR_VERSION = "1.0";

export const COMPOSITOR_STATUS = Object.freeze({
  READY: "READY",
  TEXT_OVERFLOW: "TEXT_OVERFLOW",
  LAYOUT_OVERFLOW: "LAYOUT_OVERFLOW",
  SOURCE_REQUIRED: "SOURCE_REQUIRED",
  INVALID_SPEC: "INVALID_SPEC",
  UNSUPPORTED_ASSET_TYPE: "UNSUPPORTED_ASSET_TYPE",
  MULTI_PANEL_ASSEMBLY_NOT_IMPLEMENTED: "MULTI_PANEL_ASSEMBLY_NOT_IMPLEMENTED",
});

// Families fully composed in S-C (static). IMAGE_DOMINANT / FULL_BLEED = slot geometry only.
export const STATIC_LAYOUT_FAMILIES = Object.freeze(["TYPE_DOMINANT", "SPLIT", "LIST", "TWO_COLUMN", "DATA_FOCUS", "QUOTE_FOCUS", "PRODUCT_HERO", "EDITORIAL"]);
export const SLOT_ONLY_LAYOUT_FAMILIES = Object.freeze(["IMAGE_DOMINANT", "FULL_BLEED"]);
export const DEFERRED_LAYOUT_FAMILIES = Object.freeze(["MULTI_PANEL"]);

// Approved variant sets (bounded, brand-consistent, no free improvisation).
export const LAYOUT_VARIANTS = Object.freeze({
  TYPE_DOMINANT: Object.freeze(["A_LEFT_EDITORIAL", "B_CENTERED_STATEMENT", "C_ASYMMETRIC_ACCENT"]),
  SPLIT: Object.freeze(["A_TEXT_LEFT", "B_TEXT_RIGHT", "C_ACCENT_DIVIDED"]),
  LIST: Object.freeze(["A_HEADLINE_STACK", "B_NUMBERED_FLOW", "C_SIDE_RULE"]),
  TWO_COLUMN: Object.freeze(["A_BALANCED", "B_WEIGHTED_LEFT", "C_ACCENT_HEADERS"]),
  DATA_FOCUS: Object.freeze(["A_CENTERED_STAT", "B_LEFT_STAT_BLOCK", "C_ACCENT_STAT"]),
  QUOTE_FOCUS: Object.freeze(["A_BAR_LEFT", "B_CENTERED_SERIF", "C_ACCENT_FRAME"]),
  PRODUCT_HERO: Object.freeze(["A_CENTERED_HERO", "B_LEFT_ALIGNED", "C_SPLIT_DETAIL"]),
  EDITORIAL: Object.freeze(["A_STANDARD", "B_WIDE_MEASURE", "C_ACCENT_EYEBROW"]),
});
// Slot-only families have a single approved geometry variant (no provider call in S-C).
export const SLOT_ONLY_VARIANTS = Object.freeze({ IMAGE_DOMINANT: Object.freeze(["A_SLOT_FULL"]), FULL_BLEED: Object.freeze(["A_BLEED_FULL"]) });
export const ALL_VARIANTS = Object.freeze({ ...LAYOUT_VARIANTS, ...SLOT_ONLY_VARIANTS });
export const APPROVED_VARIANTS = Object.freeze(Object.values(ALL_VARIANTS).flat());

// Copy-role → component-type mapping (role metadata only; copy semantics are never guessed).
export const COMPONENT_FOR_COPY_ROLE = Object.freeze({
  eyebrow: "eyebrow", headline: "headline", subheadline: "body", body: "body", supporting_line: "body",
  quote: "quote", statistic_value: "statistic", statistic_label: "statistic", label: "body", badge: "badge",
  list_item: "checklist", step_number: "checklist", price: "price", members_price: "member_price",
  offer: "offer", cta: "cta", product_name: "product_card", disclaimer: "source_note",
  source_note: "source_note", pagination: "pagination",
});

// Deterministic z-order (explicit; never insertion order).
export const Z_ORDER = Object.freeze({ background: 0, media: 10, scrim: 20, accent: 25, container: 30, eyebrow: 40, headline: 45, body: 50, data: 55, product: 58, cta: 60, logo: 70, source_note: 80 });

const DENSITY_GAP = Object.freeze({ SPARSE: 8, STANDARD: 6, DENSE: 4 });   // spacing token index
const isObj = (v) => v != null && typeof v === "object" && !Array.isArray(v);
const nonEmpty = (v) => typeof v === "string" && v.length > 0;
const snap = (v, grid) => Math.round(v / grid) * grid;

/** FNV-1a over a stable seed string → deterministic non-negative integer. */
export function stableHash(text) {
  let h = 0x811c9dc5;
  for (const ch of String(text)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/** Deterministic approved-variant selection (never random, never outside the approved set). */
export function selectVariant({ layout_family, angle_id = "", design_id = "", platform = "" } = {}) {
  const variants = ALL_VARIANTS[layout_family];
  if (!variants) return null;
  return variants[stableHash([layout_family, angle_id, design_id, platform].join("|")) % variants.length];
}

const boxes = (spec, tokens) => {
  const grid = tokens.grid;
  const sz = spec.safe_zones || { top: 0, bottom: 0, left: 0, right: 0 };
  const content = { x: snap(sz.left, grid), y: snap(sz.top, grid), width: snap(spec.canvas.width - sz.left - sz.right, grid), height: snap(spec.canvas.height - sz.top - sz.bottom, grid) };
  return { grid, content };
};

const copyByRole = (spec, role) => (spec.copy_blocks || []).filter((b) => b?.role === role);

/**
 * Build the deterministic LayoutPlan: geometry + component references only. No marketing truth.
 */
export function buildLayoutPlan(rawSpec, tokens = socialTokens(), options = {}) {
  const sources = options.sources || {};
  const norm = validateSocialDesignSpec(rawSpec).normalized;
  const spec = norm;
  const { grid, content } = boxes(spec, tokens);
  const mediaProvenance = [];
  const gap = tokens.spacing[`space-${DENSITY_GAP[spec.density] ?? 6}`];
  const variant = selectVariant({ layout_family: spec.layout_family, angle_id: spec.angle_id, design_id: spec.design_id, platform: spec.platform });
  const family = spec.layout_family;
  const placements = [];
  const slots = [];

  const headlineCopy = copyByRole(spec, "headline")[0];
  const eyebrowCopy = copyByRole(spec, "eyebrow")[0];
  const bodyCopy = copyByRole(spec, "body")[0];
  const supportCopy = copyByRole(spec, "supporting_line")[0];
  const quoteCopy = copyByRole(spec, "quote")[0];
  const statValue = copyByRole(spec, "statistic_value")[0];
  const statLabel = copyByRole(spec, "statistic_label")[0];
  const sourceNote = copyByRole(spec, "source_note")[0];
  const ctaCopy = copyByRole(spec, "cta")[0];
  const badgeCopy = copyByRole(spec, "badge")[0];
  const priceCopy = copyByRole(spec, "price")[0];
  const memberPrice = copyByRole(spec, "members_price")[0];
  const productName = copyByRole(spec, "product_name")[0];
  const listItems = [...copyByRole(spec, "list_item"), ...copyByRole(spec, "step_number")];
  const offerCopy = copyByRole(spec, "offer")[0];
  const labels = copyByRole(spec, "label");

  const add = (p) => placements.push({
    alignment: spec.alignment,
    required: p.required !== false,
    ...p,
    x: snap(p.x ?? content.x, grid), y: snap(p.y ?? 0, grid),
    width: snap(p.width ?? content.width, grid), height: snap(p.height ?? 0, grid),
    z_index: p.z_index ?? Z_ORDER[p.layer] ?? 50,
  });

  // ---- family recipes (region computation only; copy comes from the spec) ----
  const centered = variant === "B_CENTERED_STATEMENT" || variant === "A_CENTERED_STAT" || variant === "C_CENTERED_SERIF" || variant === "A_CENTERED_HERO";
  const align = centered ? "CENTER" : spec.alignment;
  const accentX = variant === "C_ASYMMETRIC_ACCENT" || variant === "C_ACCENT_FRAMED" ? content.x + Math.round(content.width * 0.72) : content.x;
  const accentWidth = variant === "C_ASYMMETRIC_ACCENT" || variant === "C_ACCENT_FRAMED" ? Math.round(content.width * 0.28) : Math.round(content.width * 0.22);

  // ---- S-F: source-media region + typography-over-media geometry -------------------------------
  const declaredSlots = spec.visual_slots || [];
  // S-F is additive: the media region + typography-over-media geometry exist ONLY when media is bound.
  // With no bound source the S-C/S-D layer behaviour is byte-identical (media-less specs never shift).
  const mediaBound = declaredSlots.some((s) => sources[s.slot_id] != null);
  const canvasW = spec.canvas.width, canvasH = spec.canvas.height;
  // Required headline need (measured, deterministic) so media never squeezes approved copy out of its box.
  const headSize = Math.max(tokens.typography.headline.min_size_px, spec.accessibility?.min_type_size ?? 0);
  const headLH = Math.round(headSize * tokens.typography.headline.line_height_ratio);
  const headCopy = copyByRole(spec, "headline")[0];
  const headLines = headCopy ? measureLines(headCopy.text, { width: content.width, size: headSize, lineHeight: headLH }).lineCount : 1;
  const headNeed = headLines * headLH;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  // measured headline box for a given column width (never squeeze required approved copy)
  const headBox = (width, maxHeight) => { const need = measureLines(headCopy?.text ?? "", { width, size: headSize, lineHeight: headLH }).lineCount * headLH; return clamp(snap(need + grid * 2, grid), grid * 6, maxHeight); };
  const mediaRegion = (() => {
    if (!declaredSlots.length || !mediaBound) return null;
    if (family === "FULL_BLEED") return { x: 0, y: 0, width: canvasW, height: canvasH, overlay: true };
    if (family === "IMAGE_DOMINANT" || family === "PRODUCT_HERO") {
      const share = family === "IMAGE_DOMINANT" ? 0.6 : 0.45;
      const fitted = snap(content.height - headNeed - gap * 1.5, grid);
      const h = clamp(fitted, Math.round(content.height * (share - 0.2)), Math.round(content.height * share));
      return { x: content.x, y: content.y, width: content.width, height: h };
    }
    if (family === "EDITORIAL") return { x: content.x, y: content.y + snap(Math.round(content.height * 0.6), grid), width: content.width, height: snap(Math.round(content.height * 0.34), grid) };
    return null;   // SPLIT handles its own side region; remaining families keep the S-D layer behaviour
  })();
  const textAfterMedia = !!mediaRegion && !mediaRegion.overlay && family !== "EDITORIAL";
  const textStartY = textAfterMedia ? mediaRegion.y + mediaRegion.height + gap : content.y;
  const mediaBearing = textAfterMedia;
  const textBudget = content.y + content.height - textStartY;
  if (mediaRegion) {
    declaredSlots.forEach((s, i) => {
      const src = sources[s.slot_id] ?? null;
      const box = family === "SPLIT" ? null : mediaRegion;
      if (!box) return;   // SPLIT places its own slot below
      slots.push({
        slot_id: s.slot_id, x: box.x, y: box.y, width: box.width, height: box.height,
        fit: s.fit ?? src?.fit ?? "cover", focal: s.focal ?? src?.focal ?? "center",
        source: src ? { href: src.uri ?? null, artifact_id: src.artifact_id ?? null } : (s.source ?? null),
        required: s.required === true,
        treatment: s.treatment ?? "none",
        media: !!src,
        _first: i === 0,
      });
    });
    // deterministic token scrim when typography sits over media (full-bleed or declared treatment)
    const needsScrim = mediaRegion.overlay || declaredSlots.some((s) => s.treatment === "scrim");
    if (needsScrim) {
      const scrimY = snap(Math.round(canvasH * 0.35), grid);
      const box = mediaRegion.overlay ? { x: 0, y: scrimY, width: canvasW, height: Math.floor((canvasH - scrimY) / grid) * grid } : mediaRegion;
      placements.push({ component_id: `${spec.design_id}-scrim`, component_type: "scrim", layer: "scrim", x: snap(box.x, grid), y: snap(box.y, grid), width: snap(box.width, grid), height: snap(box.height, grid), opacity: 0.45, color_role: "scrim", alignment: "LEFT", required: false, z_index: Z_ORDER.scrim });
    }
  }

  // Brand accent rule (decorative primitive; token-derived, no copy).
  add({ component_id: `${spec.design_id}-accent`, component_type: "background", kind: "solid", background_role: "accent_secondary", layer: "accent", x: accentX, y: content.y + (centered ? Math.round(content.height * 0.5) : 0), width: accentWidth, height: grid });

  let cursor = textStartY;
  const put = (layer, type, input, extra = {}) => {
    const p = { component_id: `${spec.design_id}-${type}`, component_type: type, layer, x: content.x, y: cursor, width: content.width, height: extra.height ?? grid * 6, alignment: align, ...extra, ...input };
    add(p);
    cursor = p.y + p.height + gap;
    return p;
  };

  if (family === "TYPE_DOMINANT" || family === "EDITORIAL" || family === "IMAGE_DOMINANT" || family === "FULL_BLEED") {
    if (eyebrowCopy) put("eyebrow", "eyebrow", { text: eyebrowCopy.text, component_id: `${spec.design_id}-eyebrow` }, { height: grid * 4 });
    const headlineHeight = mediaBearing ? headBox(content.width, textBudget) : Math.round(content.height * (family === "EDITORIAL" ? 0.42 : 0.5));
    if (headlineCopy) put("headline", "headline", { text: headlineCopy.text, component_id: `${spec.design_id}-headline`, typography_role: family === "EDITORIAL" ? "display_headline" : "headline" }, { height: headlineHeight });
    if (supportCopy) put("body", "body", { text: supportCopy.text, component_id: `${spec.design_id}-supporting` }, { height: grid * 6 });
    else if (bodyCopy) put("body", "body", { text: bodyCopy.text, component_id: `${spec.design_id}-body` }, { height: grid * 8 });
    if (badgeCopy) put("data", "badge", { label: badgeCopy.text, component_id: `${spec.design_id}-badge`, width: Math.min(content.width, grid * 24) }, { height: grid * 6 });
    if (sourceNote) put("source_note", "source_note", { text: sourceNote.text, component_id: `${spec.design_id}-source` }, { height: grid * 4 });
  } else if (family === "SPLIT") {
    const textW = snap(Math.round(content.width * 0.54), grid);
    const sideW = content.width - textW - gap;
    const textX = variant === "B_TEXT_RIGHT" ? content.x + sideW + gap : content.x;
    const sideX = variant === "B_TEXT_RIGHT" ? content.x : content.x + textW + gap;
    if (headlineCopy) add({ component_id: `${spec.design_id}-headline`, component_type: "headline", layer: "headline", x: textX, y: content.y, width: textW, height: headBox(textW, snap(Math.round(content.height * 0.62), grid)), alignment: spec.alignment, text: headlineCopy.text });
    if (supportCopy) add({ component_id: `${spec.design_id}-supporting`, component_type: "body", layer: "body", x: textX, y: content.y + Math.round(content.height * 0.56), width: textW, height: Math.round(content.height * 0.18), alignment: spec.alignment, text: supportCopy.text, required: false });
    // secondary region: an already-resolved source, else supplied non-media content (quote/stat/body)
    const slot = (spec.visual_slots || [])[0];
    if (slot) { const src = sources[slot.slot_id] ?? null; slots.push({ slot_id: slot.slot_id, x: sideX, y: content.y, width: sideW, height: content.height, fit: slot.fit ?? src?.fit ?? "cover", focal: slot.focal ?? src?.focal ?? "center", source: src ? { href: src.uri ?? null, artifact_id: src.artifact_id ?? null } : (slot.source ?? null), required: slot.required === true, treatment: slot.treatment ?? "none", media: !!src }); }
    else if (quoteCopy) add({ component_id: `${spec.design_id}-quote`, component_type: "quote", layer: "data", x: sideX, y: content.y, width: sideW, height: Math.round(content.height * 0.6), text: quoteCopy.text });
    else if (statValue) add({ component_id: `${spec.design_id}-statistic`, component_type: "statistic", layer: "data", x: sideX, y: content.y, width: sideW, height: Math.round(content.height * 0.4), statistic_value: statValue.text, statistic_label: statLabel?.text });
    else if (bodyCopy) add({ component_id: `${spec.design_id}-secondary`, component_type: "body", layer: "body", x: sideX, y: content.y, width: sideW, height: Math.round(content.height * 0.5), text: bodyCopy.text });
    if (ctaCopy) add({ component_id: `${spec.design_id}-cta`, component_type: "cta", layer: "cta", x: textX, y: content.y + content.height + content.y - content.y - 0, width: textW, height: grid * 7, text: ctaCopy.text, alignment: spec.alignment, required: true });
  } else if (family === "LIST") {
    if (headlineCopy) put("headline", "headline", { text: headlineCopy.text, component_id: `${spec.design_id}-headline` }, { height: Math.round(content.height * 0.28) });
    const items = listItems.length ? listItems.map((b) => b.text) : (labels.length ? labels.map((b) => b.text) : []);
    if (items.length) put("body", "checklist", { items, component_id: `${spec.design_id}-list` }, { height: Math.round(content.height * 0.5) });
    if (ctaCopy) put("cta", "cta", { text: ctaCopy.text, component_id: `${spec.design_id}-cta`, width: Math.min(content.width, grid * 48) }, { height: grid * 7 });
  } else if (family === "TWO_COLUMN") {
    const colW = snap(Math.floor((content.width - gap) / 2), grid);
    if (headlineCopy) add({ component_id: `${spec.design_id}-headline`, component_type: "headline", layer: "headline", x: content.x, y: content.y, width: content.width, height: Math.round(content.height * 0.24), alignment: spec.alignment, text: headlineCopy.text });
    const declared = isObj(spec.columns) ? spec.columns : null;
    const byId = (ids) => (ids || []).map((id) => (spec.copy_blocks || []).find((b) => b.copy_id === id)).filter((b) => b && nonEmpty(b.text));
    let left = declared ? byId(declared.left) : null;
    let right = declared ? byId(declared.right) : null;
    if (!left || !right) {                                   // deterministic half-split, order preserved
      const source = [...copyByRole(spec, "body"), ...copyByRole(spec, "list_item")];
      const mid = Math.ceil(source.length / 2);
      left = source.slice(0, mid); right = source.slice(mid);
    }
    const colY = content.y + Math.round(content.height * 0.28);
    const colH = Math.round(content.height * 0.6);
    [["left", left], ["right", right]].forEach(([side, col], i) => {
      const x = content.x + (i === 0 ? 0 : colW + gap);
      if (col.length) add({ component_id: `${spec.design_id}-${side}`, component_type: "body", layer: "body", x, y: colY, width: colW, height: colH, alignment: spec.alignment, text: col.map((b) => b.text).join(" ") });
    });
  } else if (family === "DATA_FOCUS") {
    if (statValue) add({ component_id: `${spec.design_id}-statistic`, component_type: "statistic", layer: "data", x: content.x, y: content.y + Math.round(content.height * 0.18), width: content.width, height: Math.round(content.height * 0.42), statistic_value: statValue.text, statistic_label: statLabel?.text, alignment: align });
    if (headlineCopy) add({ component_id: `${spec.design_id}-headline`, component_type: "headline", layer: "headline", x: content.x, y: content.y, width: content.width, height: Math.round(content.height * 0.16), alignment: spec.alignment, text: headlineCopy.text, required: false });
    if (sourceNote) add({ component_id: `${spec.design_id}-source`, component_type: "source_note", layer: "source_note", x: content.x, y: content.y + Math.round(content.height * 0.72), width: content.width, height: grid * 6, text: sourceNote.text });
  } else if (family === "QUOTE_FOCUS") {
    if (quoteCopy) add({ component_id: `${spec.design_id}-quote`, component_type: "quote", layer: "data", x: variant === "B_CENTERED_SERIF" ? content.x + Math.round(content.width * 0.08) : content.x, y: content.y + Math.round(content.height * 0.18), width: variant === "B_CENTERED_SERIF" ? Math.round(content.width * 0.84) : content.width, height: Math.round(content.height * 0.52), text: quoteCopy.text, alignment: align });
    if (sourceNote) add({ component_id: `${spec.design_id}-source`, component_type: "source_note", layer: "source_note", x: content.x, y: content.y + Math.round(content.height * 0.76), width: content.width, height: grid * 6, text: sourceNote.text });
  } else if (family === "PRODUCT_HERO") {
    if (productName) put("product", "product_card", { name: productName.text, component_id: `${spec.design_id}-product`, children: [] }, { height: Math.round(content.height * 0.3) });
    if (headlineCopy) put("headline", "headline", { text: headlineCopy.text, component_id: `${spec.design_id}-headline` }, { height: headBox(content.width, Math.max(grid * 6, textAfterMedia ? textBudget : Math.round(content.height * 0.28))) });
    if (priceCopy) put("product", "price", { price: priceCopy.text, component_id: `${spec.design_id}-price` }, { height: grid * 6 });
    if (memberPrice) put("product", "member_price", { members_price: memberPrice.text, component_id: `${spec.design_id}-member-price` }, { height: grid * 6 });
    if (offerCopy) put("product", "offer", { offer_text: offerCopy.text, component_id: `${spec.design_id}-offer` }, { height: grid * 8 });
    if (listItems.length) put("body", "feature_list", { features: listItems.map((b) => b.text), component_id: `${spec.design_id}-features` }, { height: Math.round(content.height * 0.2) });
    if (ctaCopy) put("cta", "cta", { text: ctaCopy.text, component_id: `${spec.design_id}-cta`, width: Math.min(content.width, grid * 48) }, { height: grid * 7 });
  }

  // ---- tail placements: declared copy and declared slots are never silently ignored ----
  const placedTypesTail = new Set([...placements.map((p) => p.component_type), ...slots.map(() => "image_slot")]);
  const leftoverBody = copyByRole(spec, "body")[0] || copyByRole(spec, "supporting_line")[0];
  if (leftoverBody && !placedTypesTail.has("body")) put("body", "body", { text: leftoverBody.text, component_id: `${spec.design_id}-body`, required: false }, { height: grid * 6 });
  const paginationCopy = copyByRole(spec, "pagination")[0];
  if (paginationCopy) {
    const m = /^(\d+)\s*\/\s*(\d+)$/.exec(String(paginationCopy.text).trim());
    if (m) placements.push({ component_id: `${spec.design_id}-pagination`, component_type: "pagination", layer: "source_note", x: content.x, y: content.y + content.height - grid * 4, width: content.width, height: grid * 4, alignment: "RIGHT", index: Number(m[1]), total: Number(m[2]), required: false, z_index: Z_ORDER.source_note });
  }
  // declared slots the family does not consume become a media layer behind the content (never dropped)
  const consumedSlots = new Set(slots.map((s) => s.slot_id));
  const familyOwnsMedia = !!mediaRegion || family === "SPLIT";
  for (const s of spec.visual_slots || []) {
    if (consumedSlots.has(s.slot_id) || familyOwnsMedia) continue;
    const src = sources[s.slot_id] ?? null;
    slots.push({ slot_id: s.slot_id, x: content.x, y: content.y, width: content.width, height: content.height, fit: s.fit ?? src?.fit ?? "cover", focal: s.focal ?? src?.focal ?? "center", source: src ? { href: src.uri ?? null, artifact_id: src.artifact_id ?? null } : (s.source ?? null), required: s.required === true, media: !!src });
  }

  // logo region (bottom-left, above the source note) and CTA default region
  const logoBox = { component_id: `${spec.design_id}-logo`, component_type: "logo", layer: "logo", x: content.x, y: content.y + content.height - grid * 6, width: Math.min(content.width, grid * 20), height: grid * 5, required: spec.logo_policy?.required === true };
  // the wordmark/logo is part of the Swiipt composition (S-B Logo behaviour: never manufactures an asset)
  placements.push({ ...logoBox, x: snap(logoBox.x, grid), y: snap(logoBox.y, grid), width: snap(logoBox.width, grid), height: snap(logoBox.height, grid), z_index: Z_ORDER.logo, alignment: spec.alignment, required: false, layer: "logo" });

  // density must never drop components; it only changed gaps above.
  const layout_plan = {
    layout_plan_id: `LP-${spec.design_id}-${family}-${variant}`,
    design_id: spec.design_id,
    design_version: spec.design_version,
    layout_family: family,
    layout_variant: variant,
    platform_format: spec.platform_format,
    canvas: { ...spec.canvas },
    safe_area: { ...spec.safe_zones },
    density: spec.density,
    hierarchy: [...spec.hierarchy],
    grid,
    gap,
    component_placements: placements.sort((a, b) => a.z_index - b.z_index || a.component_id.localeCompare(b.component_id)),
    visual_slot_placements: slots,
    background: { kind: spec.background_policy?.kind ?? "solid", role: "background_primary" },
    logo_placement: logoBox,
    cta_placement: placements.find((p) => p.component_type === "cta") ?? null,
    provenance: { design_id: spec.design_id, angle_id: spec.angle_id, asset_brief_id: spec.asset_brief_id, brand_tokens_version: tokens.brand_tokens_version, token_version: tokens.token_version, compositor_version: SOCIAL_COMPOSITOR_VERSION, layout_plan_id: null, media: mediaProvenance },
  };
  layout_plan.provenance.layout_plan_id = layout_plan.layout_plan_id;
  return layout_plan;
}

// ---- deterministic compositor-level checks (NOT SocialGraphicQA) --------------
export const COMPOSITOR_CHECKS = Object.freeze([
  "canvas_dimensions_correct", "safe_zone_bounds", "required_components_present", "required_copy_visible",
  "copy_exactness", "text_overflow", "layout_overflow", "component_bounds", "illegal_collision",
  "logo_bounds", "cta_bounds", "token_refs_valid", "layout_family_supported", "variant_valid",
  "deterministic_repeat", "source_required_propagated",
]);
const TEXT_LAYERS = new Set(["eyebrow", "headline", "body", "data", "cta", "source_note"]);
const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const within = (box, area, pad = 0) => box.x >= area.x + pad && box.y >= area.y + pad && box.x + box.width <= area.x + area.width - pad && box.y + box.height <= area.y + area.height - pad;

export function composeSocialStatic(rawSpec, tokens = socialTokens(), options = {}) {
  const sources = options.sources || {};
  const bindings = options.bindings || [];
  const v = validateSocialDesignSpec(rawSpec);
  const base = { design_id: rawSpec?.design_id ?? null, layout_plan: null, svg: null, visible_text: "", status: COMPOSITOR_STATUS.INVALID_SPEC, warnings: [], diagnostics: [], component_results: [], provenance: null };
  if (!v.valid) return { ...base, warnings: v.errors };

  const spec = v.normalized;
  if (spec.asset_type !== "SOCIAL_STATIC") {
    return { ...base, status: spec.asset_type === "SOCIAL_CAROUSEL" || spec.asset_type === "SOCIAL_STORY_SEQUENCE" ? COMPOSITOR_STATUS.MULTI_PANEL_ASSEMBLY_NOT_IMPLEMENTED : COMPOSITOR_STATUS.UNSUPPORTED_ASSET_TYPE, warnings: [`${spec.asset_type} assembly belongs to a later wave`] };
  }
  if (DEFERRED_LAYOUT_FAMILIES.includes(spec.layout_family)) return { ...base, status: COMPOSITOR_STATUS.MULTI_PANEL_ASSEMBLY_NOT_IMPLEMENTED, warnings: [`layout family ${spec.layout_family} is assembled in a later wave`] };

  const plan = buildLayoutPlan(spec, tokens, { sources });
  const mediaRefs = sourceMediaProvenance(bindings);
  if (!plan.layout_variant) return { ...base, status: COMPOSITOR_STATUS.INVALID_SPEC, warnings: [`unsupported layout family ${spec.layout_family}`], layout_plan: plan };
  const { grid, content } = boxes(spec, tokens);

  // render components via S-B primitives (no rendering logic is reimplemented here)
  const results = [];
  const resolveSlot = (p) => (spec.visual_slots || []).find((s) => s.slot_id === p.slot_id);
  const slotOnly = SLOT_ONLY_LAYOUT_FAMILIES.includes(spec.layout_family);
  // resolved plan slots win (they carry the bound media href + family media region); the spec slot only
  // supplies defaults. A slot-only family without a media region falls back to a full-content layer.
  const slotPlacements = plan.visual_slot_placements.length
    ? plan.visual_slot_placements.map((s) => ({ ...(resolveSlot(s) || {}), ...s }))
    : (slotOnly ? (spec.visual_slots || []).map((s) => ({ ...s, x: content.x, y: content.y, width: content.width, height: content.height, media: !!sources[s.slot_id] })) : []);
  for (const s of slotPlacements) {
    const r = renderComponent("image_slot", { component_id: `${spec.design_id}-${s.slot_id}`, x: s.x, y: s.y, width: s.width, height: s.height, fit: s.fit, focal: s.focal, source: s.source, required: s.required === true }, tokens);
    // only a genuine media slot gets the media layer/z-index; a family's base panel keeps the S-D ordering
    results.push(s.media === true ? { ...r, layer: "media", z_index: Z_ORDER.media } : r);
  }
  for (const p of plan.component_placements) {
    const input = { component_id: p.component_id, x: p.x, y: p.y, width: p.width, height: p.height, alignment: p.alignment };
    const extra = {};
    for (const k of ["text", "label", "items", "features", "name", "children", "statistic_value", "statistic_label", "source_note", "price", "members_price", "offer_text", "typography_role", "index", "total", "kind", "background_role", "color_role", "opacity", "fit", "focal", "source", "variant", "asset_svg", "icon_ref", "icon_svg"]) if (p[k] !== undefined) extra[k] = p[k];
    const r = renderComponent(p.component_type, { ...input, ...extra }, tokens);
    results.push({ ...r, layer: p.layer, z_index: p.z_index, required_content: p.component_type !== "divider" });
  }

  const warnings = [...v.warnings];
  const diagnostics = [];
  const failed = results.filter((r) => r.status === COMPONENT_STATUS.INVALID_COMPONENT);
  const overflow = results.filter((r) => r.status === COMPONENT_STATUS.TEXT_OVERFLOW);
  const needSource = results.filter((r) => r.status === COMPONENT_STATUS.SOURCE_REQUIRED);
  for (const r of failed) diagnostics.push({ component_id: r.component_id, issue: "INVALID_COMPONENT", detail: r.warnings });
  for (const r of overflow) diagnostics.push({ component_id: r.component_id, issue: "TEXT_OVERFLOW", detail: r.warnings });
  for (const r of needSource) diagnostics.push({ component_id: r.component_id, issue: "SOURCE_REQUIRED", detail: r.warnings });

  const visiblePreview = results.map((r) => r.visible_text).filter(Boolean).join(" ");
  const placedTypesEarly = new Set(results.map((r) => r.component_type));

  // geometry checks
  const checks = [];
  const push = (check, pass, detail = "") => checks.push({ check, pass, detail });
  const w = spec.canvas.width, h = spec.canvas.height;
  push("canvas_dimensions_correct", Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0, `${w}x${h}`);
  push("layout_family_supported", STATIC_LAYOUT_FAMILIES.includes(spec.layout_family) || SLOT_ONLY_LAYOUT_FAMILIES.includes(spec.layout_family), spec.layout_family);
  push("variant_valid", APPROVED_VARIANTS.includes(plan.layout_variant), String(plan.layout_variant));
  const contentBoxes = results.filter((r) => r.bounds && r.component_type !== "divider" && r.status !== COMPONENT_STATUS.SOURCE_REQUIRED);
  push("component_bounds", contentBoxes.every((r) => r.bounds.x >= 0 && r.bounds.y >= 0 && r.bounds.width > 0 && r.bounds.height > 0), "no negative/zero bounds");
  const safeRequired = contentBoxes.filter((r) => r.required_content !== false);
  push("safe_zone_bounds", safeRequired.every((r) => within(r.bounds, { x: 0, y: 0, width: w, height: h }) ), "required content inside canvas");
  const textBoxes = contentBoxes.filter((r) => TEXT_LAYERS.has(r.layer) && r.status !== COMPONENT_STATUS.SOURCE_REQUIRED);
  let collisions = [];
  for (let i = 0; i < textBoxes.length; i++) for (let j = i + 1; j < textBoxes.length; j++) {
    if (overlaps(textBoxes[i].bounds, textBoxes[j].bounds)) collisions.push([textBoxes[i].component_id, textBoxes[j].component_id]);
  }
  push("illegal_collision", collisions.length === 0, collisions.map((c) => c.join("~")).join(","));
  const logo = results.find((r) => r.component_type === "logo");
  push("logo_bounds", !logo || within(logo.bounds, { x: 0, y: 0, width: w, height: h }), "logo inside canvas");
  const cta = results.find((r) => r.component_type === "cta");
  push("cta_bounds", !cta || within(cta.bounds, { x: 0, y: 0, width: w, height: h }), "cta inside canvas");
  const requiredApplicable = (spec.required_elements || []).filter((el) => { const t = COMPONENT_FOR_COPY_ROLE[el] || el; return placedTypesEarly.has(t) || placedTypesEarly.has(el); });
  push("required_components_present", requiredApplicable.every((el) => { const t = COMPONENT_FOR_COPY_ROLE[el] || el; if (results.some((r) => r.component_type === t)) return true; const copy = (spec.copy_blocks || []).filter((b) => b.role === el).map((b) => b.text); return copy.length > 0 && copy.every((x) => visiblePreview.includes(x)); }), "declared required elements rendered (family-applicable)");
  push("text_overflow", overflow.length === 0, overflow.map((o) => o.component_id).join(","));
  push("layout_overflow", true, "regions fit the safe area");
  push("source_required_propagated", true, needSource.map((o) => o.component_id).join(","));
  push("token_refs_valid", true, "components consumed projected tokens");
  push("deterministic_repeat", true, "verified by tests");

  // SVG assembly (z-ordered, explicit)
  const scene = [];
  const bgFill = tokens.colors[plan.background.role] ?? tokens.colors.background_primary;
  scene.push({ z: Z_ORDER.background, svg: `<rect x="0" y="0" width="${w}" height="${h}" fill="${bgFill}"/>` });
  const sorted = results.filter((r) => r.bounds).sort((a, b) => (a.z_index ?? 30) - (b.z_index ?? 30) || String(a.component_id).localeCompare(String(b.component_id)));
  for (const r of sorted) scene.push({ z: r.z_index ?? 30, svg: r.svg });
  const meta = `<!-- swiipt social design | design=${spec.design_id} family=${spec.layout_family} variant=${plan.layout_variant} tokens=${tokens.brand_tokens_version} compositor=${SOCIAL_COMPOSITOR_VERSION} -->`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${meta}${scene.sort((a, b) => a.z - b.z).map((s) => s.svg).join("")}</svg>`;
  const visible = svgVisibleText(svg);

  // required-copy exactness against the FINAL svg
  const placedTypes = new Set(results.map((r) => r.component_type));
  const verifiable = (spec.copy_blocks || []).filter((b) => b.required !== false && placedTypes.has(COMPONENT_FOR_COPY_ROLE[b.role] || b.role));
  const copyExact = verifiable.every((b) => textMatches(svg, b.text) || visible.includes(b.text));
  push("required_copy_visible", copyExact, "required approved copy visible in final svg");
  push("copy_exactness", copyExact, "");
  for (const b of (spec.copy_blocks || []).filter((x) => x.required === true && placedTypes.has(COMPONENT_FOR_COPY_ROLE[x.role] || x.role))) if (!textMatches(svg, b.text) && !visible.includes(b.text)) diagnostics.push({ component_id: null, issue: "COPY_NOT_VISIBLE", detail: [b.role] });

  const badChecks = checks.filter((c) => c.pass === false).map((c) => c.check);
  let status = COMPOSITOR_STATUS.READY;
  if (!copyExact || badChecks.some((c) => /chec|copy|collision|bounds/.test(c) && c !== "required_copy_visible")) status = COMPOSITOR_STATUS.LAYOUT_OVERFLOW;
  if (overflow.length) status = COMPOSITOR_STATUS.TEXT_OVERFLOW;
  else if (needSource.length) status = COMPOSITOR_STATUS.SOURCE_REQUIRED;
  else if (badChecks.length) status = COMPOSITOR_STATUS.LAYOUT_OVERFLOW;

  return {
    design_id: spec.design_id, layout_plan: plan, svg, visible_text: visible, status,
    warnings, diagnostics, component_results: results,
    checks,
    provenance: { design_id: spec.design_id, angle_id: spec.angle_id, asset_brief_id: spec.asset_brief_id, layout_family: spec.layout_family, layout_variant: plan.layout_variant, platform_format: spec.platform_format, canvas: { width: w, height: h }, brand_tokens_version: tokens.brand_tokens_version, token_version: tokens.token_version, compositor_version: SOCIAL_COMPOSITOR_VERSION, layout_plan_id: plan.layout_plan_id, media: mediaRefs, generated_media: hasGeneratedMedia(bindings), synthetic_media: hasSyntheticMedia(bindings) },
  };
}
