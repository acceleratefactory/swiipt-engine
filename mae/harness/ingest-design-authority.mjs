// Ingest the verified SWIIPT design authorities into the EXISTING canonical Brand Truth record.
// (§37: extend the existing canonical source — do not create a second brand system.)
//
// Sources (both recovered by CMap extraction AND gs txtwrite, cross-checked, and verified
// against the rendered pages by pixel analysis):
//   A. asset design/swiipt-brand-assets/04-brand-guide/swiipt-brand-quick-reference.pdf  (BRAND authority)
//   B. Swiipt-Marketing-Visual-System.pdf                                                (MARKETING VISUAL authority)
//
// Nothing here is inferred. Values are either stated in the documents or measured on the
// rendered pages (swatch hexes ±6, mark geometry, embedded font names).
import fs from "node:fs";
import { join } from "node:path";

const P = "mae/data/brand-truth.json";
const bt = JSON.parse(fs.readFileSync(P, "utf8"));
const vl = bt.visual_language || (bt.visual_language = {});

/* ---- A. BRAND QUICK REFERENCE — 12 colour tokens (verified as drawn swatches, exact hex) ---- */
vl.colour_tokens = [
  { token: "navy", hex: "#0B1F33", role: "primary" },
  { token: "purple", hex: "#6F35B5", role: "accent" },
  { token: "gold", hex: "#D9A52E", role: "accent" },
  { token: "blush", hex: "#F3C7D2", role: "human/emotional" },
  { token: "warm_surface", hex: "#F8F4EC", role: "surface" },
  { token: "soft_surface", hex: "#F4F6F8", role: "surface" },
  { token: "success", hex: "#18794E", role: "state" },
  { token: "warning", hex: "#A15C00", role: "state" },
  { token: "error", hex: "#B42318", role: "state" },
  { token: "info", hex: "#1769AA", role: "state" },
  { token: "ink", hex: "#17212B", role: "body text" },
  { token: "muted", hex: "#7B8794", role: "muted text" },
];
// keep the legacy flat array valid for existing consumers, now complete
vl.palette = ["#0B1F33", "#6F35B5", "#D9A52E", "#F3C7D2", "#F8F4EC", "#F4F6F8", "#18794E", "#A15C00", "#B42318", "#1769AA", "#17212B", "#7B8794"];

/* ---- A. TRANSFORMATION MARK (geometry verified on the rendered page) ---- */
vl.transformation_mark = {
  name: "The Transformation Mark",
  construction: "Two rotated rounded squares (before / after) joined by a short diagonal bridge (transition).",
  verified_geometry: {
    navy_square: "lower-left, rotated 45deg, rounded corners",
    purple_square: "upper-right, rotated 45deg, rounded corners",
    bridge: "gold diagonal stroke between them (verified on the rendered page: ~29x30px stroke running upper-right to lower-left)",
    measured_offset_between_squares: "+56,-57 px at 150dpi",
  },
  variants: ["primary (light bg)", "reverse (dark bg)", "monochrome navy"],
  clear_space: "half the mark's own height on every side",
  min_display_size: { digital: "24px", print: "10mm" },
  prohibited: ["stretch", "recolor outside the variants", "skew", "drop shadows", "bevels"],
};

/* ---- A. TYPOGRAPHY ---- */
vl.typography = {
  display: "DM Serif Display",
  ui: "Inter",
  roles: {
    hook: { family: "Inter", weight: 800, note: "the pattern-interrupt line — big, blunt, sans-serif" },
    editorial_headline: { family: "DM Serif Display", style: "Regular", note: "section titles, situation-timeline headlines, product cover titles" },
    verbatim_quote: { family: "DM Serif Display", style: "Italic", note: "VERBATIM Customer Voice Bank language ONLY" },
    body: { family: "Inter", weights: "Regular–SemiBold", note: "everything else" },
  },
  rules: [
    "DM Serif Display Italic is for verbatim quotes ONLY — never for a paraphrase or marketing copy dressed as a testimonial (the typeface is a truth claim).",
    "Never use DM Serif Display for paragraphs.",
    "Hook lines use Inter Black (800), never DM Serif Display.",
  ],
  /** ASSET GAP surfaced by the authority audit — see known_gaps. */
  hook_weight_asset: "Inter Black (800) is required by the marketing authority; the canonical font kit does NOT contain it (MVS embeds a subset named Inter-Ultra-Bold).",
};

/* ---- A. ICONOGRAPHY ---- */
vl.iconography = {
  library: "Lucide",
  style: "stroke-only",
  never: ["filled icons", "emoji as UI icons", "flags as substitute UI icons"],
};

/* ---- A. COMPONENT LANGUAGE — callouts carry meaning by colour ---- */
vl.callout_semantics = {
  red: "safety / non-negotiable",
  amber: "warning",
  blue: "informational",
  green: "resolution",
  blush: "human / emotional",
};

/* ---- A. NEVER DO THIS (brand sheet) ---- */
vl.prohibited_brand_treatments = [
  "Use any colour outside the sheet, or a third font family.",
  "Render a decision flow or diagram as ASCII art or a nested bullet list.",
  "Use filled icons, emoji, or flags.",
  "Add gamification — badges, XP bars, streak flames, confetti.",
  "Stack a full-bleed page's content only at the top, leaving the bottom blank.",
  "Duplicate a component — every card/callout/section renders exactly once.",
];

/* ---- B. MARKETING VISUAL SYSTEM — two modes ---- */
vl.marketing_visual_modes = {
  typographic: {
    status: "default",
    when: "every asset the engine generates automatically, with no photography supplied",
    looks: "bold type, the brand's navy/gold/purple/blush palette, the Transformation Mark — built entirely from the ebook design system",
  },
  photo_anchored: {
    status: "enhancement",
    when: "only when the product team supplies a REAL photo",
    looks: "the same typographic system laid over the real photo",
  },
  note: "owner decision (locked): context-grounded AI/generated lifestyle imagery is retained where the approved campaign architecture calls for it; generic decorative stock remains prohibited (NO_GENERIC_STOCK_PHOTO).",
};

/* ---- B. GROUNDING ELEMENT RULE (distinct from Visual Grounding) ---- */
vl.grounding_element = {
  rule: "Every generated visual must contain at least one grounding element — a small, specific, factual detail rendered as a visible design piece (badge, pill, caption line), not buried in body copy.",
  forms: ["day/time badge", "verbatim attribution", "named mechanism", "real number"],
  examples: ["DAY 6 · AFTER A C-SECTION (gold pill on the Hook Graphic)", "Day 8 mum · Lagos · from Swiipt research, verbatim", "The pillow-positioning technique, Module 2", "n=41 respondents"],
  test: "Cover the grounding element with your thumb. If the graphic could now be selling a different product, the element was decoration — add a real one or kill the asset.",
  distinct_from: "visual_grounding (scene/person/environment truth for generated imagery)",
};

/* ---- B. INTENSITY → COLOUR ---- */
vl.intensity_mapping = {
  high: { angle_types: ["fear", "frustration", "trigger"], background: "navy, near-black", treatment: "dark, quiet, restrained; white text; gold only on the grounding badge" },
  medium: { angle_types: ["problem", "situation", "failed attempt", "objection"], background: "white or warm surface", treatment: "clean, editorial, calm; navy text" },
  low: { angle_types: ["education", "myth", "mechanism", "story"], background: "soft surface / white", treatment: "diagram-forward, unhurried; purple for mechanism moments" },
  conversion: { angle_types: ["transformation", "desired outcome", "product"], background: "navy, gold-forward", treatment: "gold gets the most visual weight" },
  note: "controls visual behaviour — must not collapse into four rigid layouts.",
};

/* ---- B. MARKETING COMPONENT LIBRARY (6) ---- */
vl.marketing_component_library = [
  { component: "Hook Graphic", canvas: "1080x1080", mandatory: ["grounding badge", "Inter Black hook", "arrow/CTA dot"] },
  { component: "Quote Card", canvas: "1080x1080", mandatory: ["DM Serif italic quote", "source attribution line"] },
  { component: "Situation Timeline", canvas: "1080x1080", mandatory: ["2-3 dated stages", "proof callout"], never: ["body-transformation image"] },
  { component: "Angle Record Card", canvas: "1200x900", mandatory: ["all 10 Angle Record fields", "status pill", "fan-out list"], audience: "internal strategy review" },
  { component: "OG Share Image", canvas: "1200x630", mandatory: ["category label", "headline", "URL/proof line"] },
  { component: "Carousel Slide", canvas: "1080x1080 x7", mandatory: ["slide-position counter", "one curiosity gap per slide"] },
];

/* ---- B. PLATFORM CONSTRAINTS ---- */
vl.platform_constraints = {
  instagram_feed_square: { canvas: "1080x1080", safe_zone: "keep text out of the bottom 12%" },
  vertical_reels_tiktok: { canvas: "1080x1920", safe_zone: "top 250px and bottom 350px are UI-occluded; hook and CTA inside the middle 1320px" },
  whatsapp_status: { canvas: "1080x1920", safe_zone: "same vertical safe zone as Reels; readable at 3 seconds" },
  facebook_link_image: { canvas: "1200x630", note: "link in the first comment, not the caption; must work with zero caption" },
  open_graph_share: { canvas: "1200x630", note: "standalone preview; must NOT be the same file as the product cover" },
  carousel: { canvas: "1080x1080 x 7-10", note: "first slide works with zero swipe context; last slide is always the CTA" },
  email_header: { canvas: "1200x400", note: "never put the hook only in the image (clients block images)" },
  nigerian_outdoor_viewing: { min_text_px: 60, min_text_reference_canvas: "1080px", min_contrast_ratio: "4.5:1", note: "never small text over a busy photo without a solid or gradient scrim" },
};

/* ---- B. VISUAL QA GATE (8) ---- */
vl.visual_qa_gate = [
  { gate: 1, check: "grounding element present", type: "automated", fails_if: "no badge/pill/attribution/number visible" },
  { gate: 2, check: "visual substitution test", type: "semi-automated" },
  { gate: 3, check: "typeface convention", type: "automated", fails_if: "DM Serif italic on non-verbatim text, or Inter Black on a real quote" },
  { gate: 4, check: "colour/intensity match", type: "automated" },
  { gate: 5, check: "platform fitness", type: "automated" },
  { gate: 6, check: "no fabricated photography", type: "automated", fails_if: "any asset attempts to render a photorealistic person" },
  { gate: 7, check: "brand mark present & correct", type: "automated", fails_if: "wrong mark variant for the background" },
  { gate: 8, check: "human cultural check", type: "manual" },
];

/* ---- provenance + known gaps ---- */
vl.authority = {
  brand: { doc: "asset design/swiipt-brand-assets/04-brand-guide/swiipt-brand-quick-reference.pdf", title: "SWIIPT Brand Quick Reference — Quiet Intelligence" },
  marketing_visual: { doc: "Swiipt-Marketing-Visual-System.pdf", title: "The Visual Interchangeability Standard v1.0" },
  recovered_by: ["CMap/ToUnicode extraction", "Ghostscript txtwrite"],
  cross_checked: "extracted text vs rendered pages (colour swatches at exact hex, mark geometry, embedded font names)",
  customer_product_design_authority: "Doctor Visit Brief reference + approved product design assets (LOCKED — not to be redesigned)",
  tokens_ingest: "swt-tokens.css@1.x extended with brand-quick-reference.pdf v1.0 (12-token authority ingested)",
  machine_readable_contract: "mae/harness/design-authority.mjs (projection consumed by the generic marketing compositor; does NOT create a second brand system)",
};
vl.known_gaps = [
  "Inter Black (800) — required for hook lines by the marketing visual authority; NOT present in the brand font kit (7 fonts: Inter Regular/Medium/SemiBold/Bold/Italic + DM Serif Regular/Italic). The MVS PDF embeds a subset named Inter-Ultra-Bold. Full weight must be added to the canonical font set, or the owner must approve a documented substitute.",
  "Before this ingest the canonical record listed only 5 palette colours (navy, purple, gold, warm, white) — 8 of the 12 authoritative tokens were absent (blush, soft, success, warning, error, info, ink, muted).",
];

// tokens_version is STABLE (consumer fixtures pin it); the ingest is recorded under authority.*.
bt.version = (parseFloat(bt.version || "1.0") + 0.1).toFixed(1);

fs.writeFileSync(P, JSON.stringify(bt, null, 2) + "\n", "utf8");
console.log("extended", P);
console.log("visual_language keys:", Object.keys(vl).join(", "));
console.log("colour tokens:", vl.colour_tokens.length, "| component library:", vl.marketing_component_library.length, "| QA gates:", vl.visual_qa_gate.length);
