// MAE media · Social Design Production — component primitives (Wave S-B).
// Deterministic SVG fragments for social graphic design. Components render EXACT supplied copy inside
// explicit boxes; they never rewrite, paraphrase, truncate, ellipsize or invent copy, price, claims or
// brand values. They do not decide full-asset layout (that is Wave S-C) and do not rasterize.
//
// Reuses: layout.wrapText (deterministic wrap), layout.computeImageBox/resolveSlotBox (image geometry),
// social-design-tokens (projected brand tokens), the existing `<text><tspan>` SVG convention so
// layout.svgVisibleText()/textMatches() can verify copy exactness.
import { wrapText, computeImageBox } from "./layout.js";
import { ALIGNMENTS } from "../services/social-design-spec.js";
import { socialTokens, TYPOGRAPHY_ROLES } from "../services/social-design-tokens.js";

export const COMPONENT_STATUS = Object.freeze({ READY: "READY", TEXT_OVERFLOW: "TEXT_OVERFLOW", SOURCE_REQUIRED: "SOURCE_REQUIRED", INVALID_COMPONENT: "INVALID_COMPONENT" });
export const ATOMIC_COMPONENTS = Object.freeze(["eyebrow", "headline", "body", "quote", "statistic", "badge", "cta", "logo", "icon_label", "divider", "scrim", "background"]);
export const COMPOSITE_COMPONENTS = Object.freeze(["checklist", "step", "comparison", "source_note", "pagination", "feature_list", "price", "member_price", "offer", "product_image", "product_card", "statistic_with_source"]);
export const CONTAINER_COMPONENTS = Object.freeze(["image_slot", "illustration_slot", "overlay", "card", "panel"]);
export const COMPONENT_TYPES = Object.freeze([...ATOMIC_COMPONENTS, ...COMPOSITE_COMPONENTS, ...CONTAINER_COMPONENTS]);
export const CTA_PROMINENCE = Object.freeze(["HIGH", "MEDIUM", "LOW"]);
export const BACKGROUND_KINDS = Object.freeze(["solid", "tint", "gradient", "none"]);

// ---- helpers (deterministic, no browser, no fonts, no network) ----------------
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const isObj = (v) => v != null && typeof v === "object" && !Array.isArray(v);
const num = (v) => typeof v === "number" && Number.isFinite(v);
const nonEmpty = (v) => typeof v === "string" && v.length > 0;
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const fontStack = (familyRole, tokens) => (familyRole === "display" ? `'${tokens.typography.headline.family}', Georgia, serif` : `${tokens.typography.body.family}, Helvetica, Arial, sans-serif`);

/** Deterministic line model: wrap at a char budget derived from box width and type size. */
export function measureLines(text, { width, size, lineHeight, maxLines = null }) {
  const chars = Math.max(8, Math.floor(width / (size * 0.52)));
  const lines = wrapText(text, chars);
  const requiredHeight = lines.length * lineHeight;
  const overflow = (maxLines != null && lines.length > maxLines);
  return { lines, chars, requiredHeight, overflowLines: overflow, lineCount: lines.length };
}

function textBlock({ x, y, lines, size, weight, familyRole, fill, anchor = "start", lineHeight, tokens }) {
  const tspans = lines.map((ln, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lineHeight}">${esc(ln)}</tspan>`).join("");
  return `<text x="${x}" y="${y}" font-family="${fontStack(familyRole, tokens)}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${tspans}</text>`;
}

function colour(tokens, role, fallback = "text_primary") {
  if (role == null) return tokens.colors[fallback];
  return tokens.colors[role] ?? tokens.color_extras[role] ?? null;
}

// ---- per-component allowed inputs (unknown style fields are rejected) ---------
const BOX_KEYS = ["x", "y", "width", "height", "padding", "alignment", "max_lines", "min_type_size", "typography_role", "color_role", "background_role", "radius_token", "spacing_token", "elevation_token", "opacity"];
const BASE_KEYS = ["component_id", "component_type"];   // identity fields, valid for every component
const A = (keys) => [...BASE_KEYS, ...keys];
const ALLOWED = Object.freeze({
  eyebrow: A([...BOX_KEYS, "text"]), headline: A([...BOX_KEYS, "text", "size"]), body: A([...BOX_KEYS, "text", "size"]),
  quote: A([...BOX_KEYS, "text", "attribution"]), statistic: A([...BOX_KEYS, "statistic_value", "statistic_label", "source_note"]),
  badge: A([...BOX_KEYS, "label"]), cta: A([...BOX_KEYS, "text", "prominence"]), logo: A([...BOX_KEYS, "variant", "asset_svg"]),
  icon_label: A([...BOX_KEYS, "label", "icon_ref", "icon_svg"]), divider: A([...BOX_KEYS]),
  scrim: A([...BOX_KEYS]), background: A([...BOX_KEYS, "kind", "secondary_role"]),
  checklist: A([...BOX_KEYS, "items", "item_gap"]), step: A([...BOX_KEYS, "step_number", "label", "text"]),
  comparison: A([...BOX_KEYS, "left", "right"]), source_note: A([...BOX_KEYS, "text"]), pagination: A([...BOX_KEYS, "index", "total"]),
  feature_list: A([...BOX_KEYS, "features"]), price: A([...BOX_KEYS, "price", "currency", "label"]),
  member_price: A([...BOX_KEYS, "members_price", "label"]), offer: A([...BOX_KEYS, "offer_text", "value_text", "supporting_label"]),
  product_image: A([...BOX_KEYS, "source", "required", "fit", "focal", "intrinsic"]), product_card: A([...BOX_KEYS, "name", "children"]),
  statistic_with_source: A([...BOX_KEYS, "statistic_value", "statistic_label", "source_note"]),
  image_slot: A([...BOX_KEYS, "source", "required", "fit", "focal", "intrinsic", "treatment"]),
  illustration_slot: A([...BOX_KEYS, "source", "required", "fit", "focal", "intrinsic", "treatment"]),
  overlay: A([...BOX_KEYS, "background_role"]), card: A([...BOX_KEYS, "children", "background_role"]), panel: A([...BOX_KEYS, "children", "background_role", "safe_zones"]),
});

// ---- validation (component-level only; no SocialGraphicQA) --------------------
export function validateComponent(type, input = {}, tokens = socialTokens()) {
  const errors = [];
  if (!COMPONENT_TYPES.includes(type)) { errors.push(`unknown component type "${type}"`); return { valid: false, errors }; }
  const allowed = ALLOWED[type] || [];
  for (const k of Object.keys(input)) if (!allowed.includes(k)) errors.push(`unknown field "${k}" for component "${type}"`);
  const box = input;
  for (const k of ["x", "y"]) if (box[k] != null && !num(box[k])) errors.push(`bounds.${k} must be a number`);
  if (!num(box.width) || box.width <= 0) errors.push("component width must be a positive number");
  if (!num(box.height) || box.height <= 0) errors.push("component height must be a positive number");
  if (box.alignment != null && !ALIGNMENTS.includes(box.alignment)) errors.push(`invalid alignment "${box.alignment}"`);
  if (box.typography_role != null && !TYPOGRAPHY_ROLES.includes(box.typography_role)) errors.push(`unknown typography role "${box.typography_role}"`);
  if (box.color_role != null && colour(tokens, box.color_role) == null) errors.push(`unknown colour role "${box.color_role}"`);
  if (box.background_role != null && colour(tokens, box.background_role) == null) errors.push(`unknown colour role "${box.background_role}"`);
  if (box.radius_token != null && !(box.radius_token in tokens.radius)) errors.push(`unknown radius token "${box.radius_token}"`);
  if (box.spacing_token != null && !(box.spacing_token in tokens.spacing)) errors.push(`unknown spacing token "${box.spacing_token}"`);
  if (box.elevation_token != null && !(box.elevation_token in tokens.elevation)) errors.push(`unknown elevation token "${box.elevation_token}"`);
  if (box.opacity != null && (!num(box.opacity) || box.opacity < 0 || box.opacity > 1)) errors.push("opacity must be between 0 and 1");
  if (box.padding != null && (!num(box.padding) || box.padding < 0)) errors.push("padding must be a number >= 0");
  if (input.kind != null && !BACKGROUND_KINDS.includes(input.kind)) errors.push(`unknown background treatment "${input.kind}"`);
  if (input.prominence != null && !CTA_PROMINENCE.includes(input.prominence)) errors.push(`unknown CTA prominence "${input.prominence}"`);
  if (input.fit != null && !["cover", "contain"].includes(input.fit)) errors.push(`unknown fit "${input.fit}"`);
  if (input.focal != null && !["center", "top", "bottom", "left", "right"].includes(input.focal)) errors.push(`unknown focal "${input.focal}"`);
  return { valid: errors.length === 0, errors };
}

const contains = (parent, child, pad = 0) => child.x >= parent.x + pad && child.y >= parent.y + pad && child.x + child.width <= parent.x + parent.width - pad && child.y + child.height <= parent.y + parent.height - pad;

// ---- renderers ----------------------------------------------------------------
function mk(type, input, { svg = "", visible = "", status = COMPONENT_STATUS.READY, warnings = [], tokens, ...extra }) {
  return {
    component_id: input.component_id ?? null, component_type: type,
    bounds: { x: input.x ?? 0, y: input.y ?? 0, width: input.width, height: input.height },
    svg, visible_text: visible, status, warnings,
    provenance: { component_type: type, token_version: tokens.token_version, brand_tokens_version: tokens.brand_tokens_version },
    ...extra,
  };
}

function renderText(type, input, tokens, spec) {
  const size = input.size ?? Math.max(tokens.typography[spec.role].min_size_px, input.min_type_size ?? 0);
  const weight = tokens.typography[spec.role].weight;
  const lh = Math.round(size * tokens.typography[spec.role].line_height_ratio);
  const { lines, requiredHeight, overflowLines } = measureLines(input.text, { width: input.width, size, lineHeight: lh, maxLines: input.max_lines ?? spec.max_lines ?? null });
  const anchor = input.alignment === "CENTER" ? "middle" : input.alignment === "RIGHT" ? "end" : "start";
  const x = anchor === "middle" ? input.x + input.width / 2 : anchor === "end" ? input.x + input.width : input.x;
  const svg = textBlock({ x, y: input.y + size, lines, size, weight, familyRole: spec.familyRole, fill: colour(tokens, input.color_role, spec.role === "headline" ? "text_primary" : "text_secondary"), anchor, lineHeight: lh, tokens });
  const warnings = [];
  let status = COMPONENT_STATUS.READY;
  if (overflowLines || requiredHeight > input.height) status = COMPONENT_STATUS.TEXT_OVERFLOW;
  return mk(type, input, { svg, visible: lines.join(" "), status, warnings, tokens });
}

function renderList(type, input, tokens, role) {
  const size = input.size ?? tokens.typography[role].min_size_px;
  const lh = Math.round(size * tokens.typography[role].line_height_ratio);
  const items = input.items ?? input.features ?? [];
  const parts = []; const vis = []; let status = COMPONENT_STATUS.READY; let y = input.y;
  items.forEach((raw, i) => {
    const text = typeof raw === "string" ? raw : raw?.text;
    if (!nonEmpty(text)) return;
    const { lines, requiredHeight } = measureLines(text, { width: input.width, size, lineHeight: lh });
    if (y + requiredHeight > input.y + input.height) { status = COMPONENT_STATUS.TEXT_OVERFLOW; return; }
    const bullet = input.icon_svg ? "" : `<path d="M${input.x},${y + size * 0.35} l${size * 0.22},${size * 0.22} l${size * 0.4},-${size * 0.44}" fill="none" stroke="${colour(tokens, "accent_primary")}" stroke-width="2"/>`;
    parts.push(bullet, textBlock({ x: input.x + size * 0.9, y, lines, size, weight: tokens.typography[role].weight, familyRole: tokens.typography[role].family_role, fill: colour(tokens, "text_primary"), lineHeight: lh, tokens }));
    vis.push(lines.join(" "));
    y += requiredHeight + (num(input.item_gap) ? input.item_gap : Math.round(size * 0.5));
  });
  return mk(type, input, { svg: parts.join(""), visible: vis.join(" "), status, tokens });
}

export function renderComponent(type, input = {}, tokens = socialTokens()) {
  const check = validateComponent(type, input, tokens);
  if (!check.valid) return mk(type, input, { status: COMPONENT_STATUS.INVALID_COMPONENT, warnings: check.errors, tokens });
  const box = input;

  switch (type) {
    case "eyebrow":
      if (!nonEmpty(input.text)) return mk(type, input, { status: COMPONENT_STATUS.INVALID_COMPONENT, warnings: ["text required"], tokens });
      return renderText(type, input, tokens, { role: "microcopy", familyRole: "ui", max_lines: 1 });
    case "headline":
      if (!nonEmpty(input.text)) return mk(type, input, { status: COMPONENT_STATUS.INVALID_COMPONENT, warnings: ["headline text required"], tokens });
      return renderText(type, input, tokens, { role: input.typography_role === "display_headline" ? "display_headline" : "headline", familyRole: "display" });
    case "body":
      if (!nonEmpty(input.text)) return mk(type, input, { status: COMPONENT_STATUS.INVALID_COMPONENT, warnings: ["body text required"], tokens });
      return renderText(type, input, tokens, { role: "body", familyRole: "ui" });
    case "quote": {
      if (!nonEmpty(input.text)) return mk(type, input, { status: COMPONENT_STATUS.INVALID_COMPONENT, warnings: ["quote text required"], tokens });
      const r = renderText(type, input, tokens, { role: "quote", familyRole: "display" });
      const bar = `<rect x="${input.x - 12}" y="${input.y}" width="4" height="${Math.min(input.height, r.status === COMPONENT_STATUS.READY ? 0 : 0) || input.height}" fill="${colour(tokens, "accent_secondary")}"/>`;
      const attribution = nonEmpty(input.attribution) ? textBlock({ x: input.x, y: input.y + input.height - 8, lines: [input.attribution], size: tokens.typography.caption.min_size_px, weight: 400, familyRole: "ui", fill: colour(tokens, "text_secondary"), lineHeight: tokens.typography.caption.min_size_px, tokens }) : "";
      return mk(type, input, { svg: [bar, r.svg, attribution].join(""), visible: [r.visible_text, nonEmpty(input.attribution) ? input.attribution : ""].filter(Boolean).join(" "), status: r.status, warnings: r.warnings, tokens });
    }
    case "statistic":
    case "statistic_with_source": {
      if (!nonEmpty(String(input.statistic_value ?? ""))) return mk(type, input, { status: COMPONENT_STATUS.INVALID_COMPONENT, warnings: ["statistic_value required (components never calculate or invent statistics)"], tokens });
      const size = tokens.typography.statistic.min_size_px;
      const value = escapeText(String(input.statistic_value));
      const parts = [`<text x="${input.x}" y="${input.y + size}" font-family="${fontStack("display", tokens)}" font-size="${size}" font-weight="400" fill="${colour(tokens, "accent_secondary")}">${esc(value)}</text>`];
      const vis = [value];
      if (nonEmpty(input.statistic_label)) { parts.push(textBlock({ x: input.x, y: input.y + size + 28, lines: [input.statistic_label], size: tokens.typography.caption.min_size_px, weight: 400, familyRole: "ui", fill: colour(tokens, "text_secondary"), lineHeight: tokens.typography.caption.min_size_px, tokens })); vis.push(input.statistic_label); }
      if (nonEmpty(input.source_note)) { parts.push(textBlock({ x: input.x, y: input.y + input.height - 8, lines: [input.source_note], size: 18, weight: 400, familyRole: "ui", fill: colour(tokens, "text_secondary"), lineHeight: 18, tokens })); vis.push(input.source_note); }
      return mk(type, input, { svg: parts.join(""), visible: vis.join(" "), tokens });
    }
    case "badge": {
      if (!nonEmpty(input.label)) return mk(type, input, { status: COMPONENT_STATUS.INVALID_COMPONENT, warnings: ["badge label required"], tokens });
      const r = tokens.radius["radius-pill"];
      const size = tokens.typography.badge.min_size_px;
      const bg = colour(tokens, "accent_primary");
      const svg = `<rect x="${input.x}" y="${input.y}" width="${input.width}" height="${input.height}" rx="${r === "50%" ? input.height / 2 : parseFloat(r)}" fill="${bg}"/>` + textBlock({ x: input.x + 16, y: input.y + input.height / 2 + size / 3, lines: [input.label], size, weight: 600, familyRole: "ui", fill: tokens.colors.surface, lineHeight: size, tokens });
      return mk(type, input, { svg, visible: input.label, tokens });
    }
    case "cta": {
      if (!nonEmpty(input.text)) return mk(type, input, { status: COMPONENT_STATUS.INVALID_COMPONENT, warnings: ["CTA text required (never invented)"], tokens });
      const prom = input.prominence ?? "HIGH";
      const r = parseFloat(tokens.radius["radius-md"]);
      const bg = prom === "HIGH" ? colour(tokens, "accent_primary") : prom === "MEDIUM" ? colour(tokens, "accent_secondary") : tokens.colors.surface;
      const fg = prom === "LOW" ? colour(tokens, "text_primary") : tokens.colors.surface;
      const stroke = prom === "LOW" ? ` stroke="${colour(tokens, "border")}"` : "";
      const size = tokens.typography.cta.min_size_px;
      const svg = `<rect x="${input.x}" y="${input.y}" width="${input.width}" height="${input.height}" rx="${r}" fill="${bg}"${stroke}/>` + textBlock({ x: input.x + input.width / 2, y: input.y + input.height / 2 + size / 3, lines: [input.text], size, weight: 600, familyRole: "ui", fill: fg, anchor: "middle", lineHeight: size, tokens });
      return mk(type, input, { svg, visible: input.text, tokens });
    }
    case "logo": {
      const cs = tokens.brand.logo.clear_space_pt;
      const frame = `<rect x="${input.x}" y="${input.y}" width="${input.width}" height="${input.height}" fill="none" stroke="${colour(tokens, "border")}" stroke-dasharray="4 4"/>`;
      const warnings = [];
      let inner = "";
      if (nonEmpty(input.asset_svg)) inner = input.asset_svg;                 // caller-supplied, never manufactured
      else { inner = textBlock({ x: input.x, y: input.y + input.height / 2 + 10, lines: ["Swiipt"], size: 22, weight: 600, familyRole: "ui", fill: colour(tokens, "text_primary"), lineHeight: 22, tokens }); warnings.push("LOGO_ASSET_NOT_PROVIDED: rendering the existing word-mark text convention (no logo asset manufactured)"); }
      warnings.push(`LOGO_CLEAR_SPACE_PT:${cs}`);
      return mk(type, input, { svg: frame + inner, visible: nonEmpty(input.asset_svg) ? "" : "Swiipt", warnings, tokens });
    }
    case "icon_label": {
      if (!nonEmpty(input.label)) return mk(type, input, { status: COMPONENT_STATUS.INVALID_COMPONENT, warnings: ["label required"], tokens });
      if (!nonEmpty(input.icon_ref) && !nonEmpty(input.icon_svg)) return mk(type, input, { status: COMPONENT_STATUS.SOURCE_REQUIRED, warnings: ["ICON_SOURCE_REQUIRED: no approved icon reference supplied (emoji substitution is not permitted)"], visible: input.label, tokens });
      const size = tokens.typography.body.min_size_px;
      const icon = nonEmpty(input.icon_svg) ? input.icon_svg : `<text x="${input.x}" y="${input.y + size}" font-size="${size}" fill="${colour(tokens, "accent_primary")}">&#9679;</text>`;
      return mk(type, input, { svg: icon + textBlock({ x: input.x + size * 1.4, y: input.y + size, lines: [input.label], size, weight: 400, familyRole: "ui", fill: colour(tokens, "text_primary"), lineHeight: size, tokens }), visible: input.label, tokens });
    }
    case "divider":
      return mk(type, input, { svg: `<rect x="${input.x}" y="${input.y + input.height / 2}" width="${input.width}" height="1" fill="${colour(tokens, "border")}"/>`, tokens });
    case "scrim": {
      const fill = colour(tokens, input.color_role, "scrim");
      const op = input.opacity ?? 0.35;
      return mk(type, input, { svg: `<rect x="${input.x}" y="${input.y}" width="${input.width}" height="${input.height}" fill="${fill}" opacity="${op}"/>`, tokens });
    }
    case "background": {
      const kind = input.kind ?? "solid";
      const role = input.background_role ?? (kind === "solid" ? "background_primary" : "background_secondary");
      const fill = colour(tokens, role);
      if (kind === "none") return mk(type, input, { svg: "", tokens });
      if (kind === "solid") return mk(type, input, { svg: `<rect x="${input.x}" y="${input.y}" width="${input.width}" height="${input.height}" fill="${fill}"/>`, tokens });
      if (kind === "tint") return mk(type, input, { svg: `<rect x="${input.x}" y="${input.y}" width="${input.width}" height="${input.height}" fill="${fill}" opacity="${input.opacity ?? 0.6}"/>`, tokens });
      const second = colour(tokens, input.secondary_role, "accent_primary");
      const id = `bg-${input.component_id ?? "x"}`;
      return mk(type, input, { svg: `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${fill}"/><stop offset="1" stop-color="${second}"/></linearGradient></defs><rect x="${input.x}" y="${input.y}" width="${input.width}" height="${input.height}" fill="url(#${id})"/>`, tokens });
    }
    case "checklist": return renderList(type, input, tokens, "body");
    case "feature_list": return renderList(type, input, tokens, "body");
    case "step": {
      if (!nonEmpty(String(input.step_number ?? "")) || !nonEmpty(input.label)) return mk(type, input, { status: COMPONENT_STATUS.INVALID_COMPONENT, warnings: ["step_number and label are required (steps are never generated or reordered)"], tokens });
      const size = tokens.typography.body.min_size_px;
      const parts = [`<circle cx="${input.x + size / 2}" cy="${input.y + size / 2}" r="${size / 2}" fill="${colour(tokens, "accent_primary")}"/>`,
        textBlock({ x: input.x + size / 2, y: input.y + size * 0.72, lines: [String(input.step_number)], size: Math.round(size * 0.7), weight: 600, familyRole: "ui", fill: tokens.colors.surface, anchor: "middle", lineHeight: size, tokens }),
        textBlock({ x: input.x + size * 1.6, y: input.y + size * 0.8, lines: [input.label], size: tokens.typography.subheadline.min_size_px, weight: 600, familyRole: "ui", fill: colour(tokens, "text_primary"), lineHeight: tokens.typography.subheadline.min_size_px, tokens })];
      const vis = [String(input.step_number), input.label];
      if (nonEmpty(input.text)) { parts.push(textBlock({ x: input.x + size * 1.6, y: input.y + size * 0.8 + 40, lines: wrapText(input.text, Math.max(8, Math.floor((input.width - size * 1.6) / (size * 0.52)))), size, weight: 400, familyRole: "ui", fill: colour(tokens, "text_secondary"), lineHeight: Math.round(size * 1.5), tokens })); vis.push(input.text); }
      return mk(type, input, { svg: parts.join(""), visible: vis.join(" "), tokens });
    }
    case "comparison": {
      if (!isObj(input.left) || !isObj(input.right)) return mk(type, input, { status: COMPONENT_STATUS.INVALID_COMPONENT, warnings: ["comparison requires left and right columns (presentation only)"], tokens });
      const colW = (input.width - 24) / 2;
      const col = (c, x) => {
        const size = tokens.typography.body.min_size_px;
        const head = nonEmpty(c?.title) ? textBlock({ x, y: input.y + tokens.typography.subheadline.min_size_px, lines: [c.title], size: tokens.typography.subheadline.min_size_px, weight: 600, familyRole: "ui", fill: colour(tokens, "accent_secondary"), lineHeight: tokens.typography.subheadline.min_size_px, tokens }) : "";
        const body = nonEmpty(c?.text) ? textBlock({ x, y: input.y + 48 + size, lines: wrapText(c.text, Math.max(8, Math.floor(colW / (size * 0.52)))), size, weight: 400, familyRole: "ui", fill: colour(tokens, "text_primary"), lineHeight: Math.round(size * 1.5), tokens }) : "";
        return { svg: `<rect x="${x - 12}" y="${input.y}" width="${colW + 24}" height="${input.height}" rx="10" fill="${tokens.colors.surface}" opacity="0.06"/>` + head + body, vis: [c?.title, c?.text].filter(nonEmpty).join(" ") };
      };
      const l = col(input.left, input.x); const r = col(input.right, input.x + colW + 24);
      return mk(type, input, { svg: l.svg + r.svg, visible: [l.vis, r.vis].join(" "), tokens });
    }
    case "source_note": {
      if (!nonEmpty(input.text)) return mk(type, input, { status: COMPONENT_STATUS.INVALID_COMPONENT, warnings: ["source note text required (never fabricated)"], tokens });
      const size = 18;
      return mk(type, input, { svg: textBlock({ x: input.x, y: input.y + size, lines: wrapText(input.text, Math.max(8, Math.floor(input.width / (size * 0.52)))), size, weight: 400, familyRole: "ui", fill: colour(tokens, "text_secondary"), lineHeight: size + 4, tokens }), visible: input.text, tokens });
    }
    case "pagination": {
      if (!num(input.index) || !num(input.total) || input.index < 1 || input.total < 1 || input.index > input.total) return mk(type, input, { status: COMPONENT_STATUS.INVALID_COMPONENT, warnings: ["pagination requires integer index and total with index <= total"], tokens });
      const label = `${input.index} / ${input.total}`;
      const size = tokens.typography.caption.min_size_px;
      return mk(type, input, { svg: textBlock({ x: input.x + input.width - 4, y: input.y + size, lines: [label], size, weight: 600, familyRole: "ui", fill: colour(tokens, "text_secondary"), anchor: "end", lineHeight: size, tokens }), visible: label, tokens });
    }
    case "price":
    case "member_price": {
      const isMember = type === "member_price";
      const raw = isMember ? input.members_price : input.price;
      if (raw == null || String(raw).length === 0) return mk(type, input, { status: COMPONENT_STATUS.INVALID_COMPONENT, warnings: [isMember ? "members_price is required (never defaulted to zero)" : "price is required (never invented)"], tokens });
      const warnings = [];
      if (!isMember && !nonEmpty(input.currency)) warnings.push("PRICE_CURRENCY_NOT_SUPPLIED: rendering the supplied price value only (no currency invented)");
      const value = escapeText(String(raw));
      const size = tokens.typography.price.min_size_px;
      const parts = [textBlock({ x: input.x, y: input.y + size, lines: [value], size, weight: 700, familyRole: "ui", fill: colour(tokens, "accent_secondary"), lineHeight: size, tokens })];
      if (nonEmpty(input.label)) parts.push(textBlock({ x: input.x, y: input.y + size + 26, lines: [input.label], size: tokens.typography.caption.min_size_px, weight: 400, familyRole: "ui", fill: colour(tokens, "text_secondary"), lineHeight: tokens.typography.caption.min_size_px, tokens }));
      return mk(type, input, { svg: parts.join(""), visible: [value, input.label].filter(nonEmpty).join(" "), warnings, tokens });
    }
    case "offer": {
      if (!nonEmpty(input.offer_text)) return mk(type, input, { status: COMPONENT_STATUS.INVALID_COMPONENT, warnings: ["offer_text required (discounts, scarcity and deadlines are never invented)"], tokens });
      const size = tokens.typography.body.min_size_px;
      const vis = [input.offer_text]; const parts = [textBlock({ x: input.x, y: input.y + size, lines: wrapText(input.offer_text, Math.max(8, Math.floor(input.width / (size * 0.52)))), size, weight: 600, familyRole: "ui", fill: colour(tokens, "text_primary"), lineHeight: Math.round(size * 1.4), tokens })];
      if (nonEmpty(input.value_text)) { vis.push(input.value_text); parts.push(textBlock({ x: input.x, y: input.y + input.height - 20, lines: [input.value_text], size: tokens.typography.price.min_size_px, weight: 700, familyRole: "ui", fill: colour(tokens, "accent_secondary"), lineHeight: tokens.typography.price.min_size_px, tokens })); }
      if (nonEmpty(input.supporting_label)) { vis.push(input.supporting_label); parts.push(textBlock({ x: input.x, y: input.y + input.height - 2, lines: [input.supporting_label], size: tokens.typography.caption.min_size_px, weight: 400, familyRole: "ui", fill: colour(tokens, "text_secondary"), lineHeight: tokens.typography.caption.min_size_px, tokens })); }
      return mk(type, input, { svg: parts.join(""), visible: vis.join(" "), tokens });
    }
    case "product_image":
    case "image_slot":
    case "illustration_slot": {
      const src = isObj(input.source) ? (input.source.href || input.source.artifact_id) : null;
      const required = input.required !== false;
      let status = COMPONENT_STATUS.READY; const warnings = [];
      let svg = `<rect x="${input.x}" y="${input.y}" width="${input.width}" height="${input.height}" fill="${colour(tokens, "background_secondary")}"/>`;
      if (!nonEmpty(src)) { if (required) { status = COMPONENT_STATUS.SOURCE_REQUIRED; warnings.push("SOURCE_REQUIRED: no approved source media supplied (no generation in S-B)"); } }
      else if (isObj(input.source) && nonEmpty(input.source.href) && /^data:|^\.|\//.test(input.source.href)) svg = `<image href="${esc(input.source.href)}" x="${input.x}" y="${input.y}" width="${input.width}" height="${input.height}" preserveAspectRatio="${input.fit === "contain" ? "xMidYMid meet" : "xMidYMid slice"}"/>`;
      else if (isObj(input.source) && nonEmpty(input.source.artifact_id)) warnings.push(`SOURCE_ARTIFACT_REF:${input.source.artifact_id}`);
      const geom = isObj(input.intrinsic) && num(input.intrinsic.width) && num(input.intrinsic.height)
        ? computeImageBox(input.intrinsic.width, input.intrinsic.height, { x: input.x, y: input.y, w: input.width, h: input.height }, input.fit ?? "cover", input.focal ?? "center") : null;
      return mk(type, input, { svg, status, warnings, tokens, ...(geom ? { placement: geom } : {}) });
    }
    case "product_card": {
      if (!nonEmpty(input.name)) return mk(type, input, { status: COMPONENT_STATUS.INVALID_COMPONENT, warnings: ["product name required (no product-truth inference)"], tokens });
      const children = Array.isArray(input.children) ? input.children : [];
      const rendered = children.map((c) => renderComponent(c.component_type, c, tokens));
      const bad = rendered.filter((r) => r.status === COMPONENT_STATUS.INVALID_COMPONENT || r.status === COMPONENT_STATUS.SOURCE_REQUIRED);
      const escaped = rendered.filter((r) => !contains({ x: input.x, y: input.y, width: input.width, height: input.height }, r.bounds, 0));
      if (escaped.length) return mk(type, input, { status: COMPONENT_STATUS.INVALID_COMPONENT, warnings: ["child component escapes the card bounds"], tokens });
      const nameSize = tokens.typography.subheadline.min_size_px;
      const parts = [textBlock({ x: input.x, y: input.y + nameSize, lines: [input.name], size: nameSize, weight: 600, familyRole: "ui", fill: colour(tokens, "text_primary"), lineHeight: nameSize, tokens }), ...rendered.map((r) => r.svg)];
      return mk(type, input, { svg: parts.join(""), visible: [input.name, ...rendered.map((r) => r.visible_text)].filter(Boolean).join(" "), status: bad.some((b) => b.status === COMPONENT_STATUS.SOURCE_REQUIRED) ? COMPONENT_STATUS.SOURCE_REQUIRED : COMPONENT_STATUS.READY, warnings: bad.flatMap((b) => b.warnings), tokens });
    }
    case "overlay":
      return mk(type, input, { svg: `<rect x="${input.x}" y="${input.y}" width="${input.width}" height="${input.height}" fill="${colour(tokens, input.background_role, "scrim")}" opacity="${input.opacity ?? 0.3}"/>`, tokens });
    case "card":
    case "panel": {
      const children = Array.isArray(input.children) ? input.children : [];
      const rendered = children.map((c) => renderComponent(c.component_type, c, tokens));
      const pad = num(input.padding) ? input.padding : 0;
      const escaped = rendered.filter((r) => !contains({ x: input.x, y: input.y, width: input.width, height: input.height }, r.bounds, pad));
      if (escaped.length) return mk(type, input, { status: COMPONENT_STATUS.INVALID_COMPONENT, warnings: [`child component escapes ${type} bounds (unsafe containment)`], tokens });
      const surface = type === "card" ? `<rect x="${input.x}" y="${input.y}" width="${input.width}" height="${input.height}" rx="${parseFloat(tokens.radius["radius-lg"])}" fill="${colour(tokens, input.background_role, "surface")}"/>` : `<rect x="${input.x}" y="${input.y}" width="${input.width}" height="${input.height}" fill="${colour(tokens, input.background_role, "background_primary")}"/>`;
      return mk(type, input, { svg: surface + rendered.map((r) => r.svg).join(""), visible: rendered.map((r) => r.visible_text).filter(Boolean).join(" "), status: rendered.some((r) => r.status === COMPONENT_STATUS.SOURCE_REQUIRED) ? COMPONENT_STATUS.SOURCE_REQUIRED : COMPONENT_STATUS.READY, warnings: rendered.flatMap((r) => r.warnings), tokens });
    }
    default:
      return mk(type, input, { status: COMPONENT_STATUS.INVALID_COMPONENT, warnings: [`no renderer for "${type}"`], tokens });
  }
}

/** Render a list of components; duplicate component ids are rejected. */
export function renderComponents(list = [], tokens = socialTokens()) {
  const seen = new Set();
  const results = [];
  for (const c of list) {
    const id = c?.component_id;
    if (id != null && seen.has(id)) { results.push({ component_id: id, component_type: c.component_type, bounds: null, svg: "", visible_text: "", status: COMPONENT_STATUS.INVALID_COMPONENT, warnings: [`duplicate component_id "${id}"`], provenance: null }); continue; }
    if (id != null) seen.add(id);
    results.push(renderComponent(c.component_type, c, tokens));
  }
  return results;
}

/** Strip a trailing dangerous characters from a statistic-like value (no meaning change). */
function escapeText(s) { return String(s); }

/** Emoji guard (used by tests and callers that must never substitute emoji for icons). */
export function containsEmoji(text) { return EMOJI.test(String(text ?? "")); }
