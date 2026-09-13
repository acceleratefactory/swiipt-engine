// MAE media · ImageRenderSpec compiler + deterministic prompt compiler.
// Consumes the EXISTING RenderSpecs.imageRender() shape. This is NOT an LLM call: the same canonical
// input produces the same canonical provider-neutral prompt package. It describes WHAT MUST BE
// RENDERED and never invents angle, emotion, culture, claims or Product Truth.
import { save, all, MAE_DIR } from "../lib/store.js";
import { validate } from "../lib/schema.js";
import { makeId, existingIds } from "../lib/ids.js";
import { join } from "node:path";
import { RenderSpecs } from "./render-specs.js";

const IPP_DIR = join(MAE_DIR, "data", "image-prompt-packages");

/** Grounding + spec -> existing ImageRenderSpec shape. */
export function buildImageRenderSpec(grounding, spec, brand = {}) {
  return RenderSpecs.imageRender({
    scene: grounding.scene,
    environment: grounding.environment,
    subjects: [grounding.subject].filter(Boolean),
    gesture_posture: grounding.gesture_posture,
    props: grounding.props,
    wardrobe: grounding.wardrobe || "",
    lighting: grounding.lighting,
    composition: grounding.composition,
    cultural_markers: grounding.cultural_markers,
    text_overlay_allowed: false, // typography is deterministic downstream, never by the provider
    negative_constraints: spec.exclusions,
    aspect_ratio: spec.aspect_ratio,
    pixel_dimensions: { width: spec.canvas.width, height: spec.canvas.height },
    brand_constraints: brand.visual_language?.imagery_rules || [],
  });
}

/** Deterministic negative constraints. Every exclusion carries a category + reason (no prompt folklore). */
export function buildNegativeConstraints({ grounding = {}, spec = {}, brand = {}, productTruth = null } = {}) {
  const out = [];
  for (const x of grounding.exclusions || []) out.push({ text: x, category: "grounding_exclusion", reason: "Visual Grounding exclusion" });
  for (const p of brand.visual_language?.anti_patterns || []) out.push({ text: `no ${p}`, category: "brand_anti_pattern", reason: "Brand Truth anti-pattern" });
  for (const r of (brand.visual_language?.imagery_rules || []).filter((r) => /^no\b/i.test(r))) out.push({ text: r, category: "brand_rule", reason: "Brand Truth imagery rule" });
  for (const c of productTruth?.prohibited_claims || []) out.push({ text: `no visual implying "${c}"`, category: "product_truth", reason: "Product Truth prohibited claim" });
  if (productTruth?.safety?.scope_boundary) out.push({ text: productTruth.safety.scope_boundary, category: "safety", reason: "Product Truth safety scope boundary" });
  out.push({ text: "no embedded text or lettering", category: "platform", reason: "typography/CTA are applied deterministically by the layout engine" });
  // stable dedupe by category+text (keeps each category's constraint), preserving first-seen order
  return out.filter((v, i, arr) => arr.findIndex((x) => x.category === v.category && x.text === v.text) === i);
}

/**
 * Pure compiler: grounding + spec + brand + productTruth -> provider-neutral prompt package content.
 * Deterministic and free of timestamps/ids so identical inputs produce identical output.
 */
export function compilePromptPackage({ grounding, spec, imageRenderSpec = null, brand = {}, productTruth = null, platform = null } = {}) {
  const neg = buildNegativeConstraints({ grounding, spec, brand, productTruth });
  const lines = [];
  lines.push(`Scene: ${grounding.scene}`);
  lines.push(`Environment: ${grounding.environment}`);
  if (grounding.subject) lines.push(`Subject: ${grounding.subject}`);
  lines.push(`Pose: ${grounding.gesture_posture}`);
  if (grounding.props?.length) lines.push(`Props: ${grounding.props.join(", ")}`);
  lines.push(`Lighting: ${grounding.lighting}`);
  lines.push(`Composition: ${grounding.composition}`);
  if (grounding.cultural_markers?.length) lines.push(`Cultural context: ${grounding.cultural_markers.join(", ")}`);
  if (grounding.emotional_tone) lines.push(`Emotional tone (as documented): ${grounding.emotional_tone}`);
  const positiveBrand = (brand.visual_language?.imagery_rules || []).filter((r) => !/^no\b/i.test(r));
  if (positiveBrand.length) lines.push(`Representation: ${positiveBrand.join("; ")}`);
  lines.push(`Aspect ratio: ${spec.aspect_ratio} (${spec.canvas.width}x${spec.canvas.height})`);
  lines.push(`Text-safe zones (keep clear for deterministic typography): ${spec.text_safe_zones.map((z) => `${z.edge}>=${z.min_px}px`).join(", ")}`);
  if (spec.deterministic_overlays?.length) lines.push(`Deterministic overlays applied AFTER production: ${spec.deterministic_overlays.map((o) => o.kind).join(", ")}`);
  lines.push("Render only what is described above. Do not add text, symbols, extra people, or claims not listed.");

  const composition_requirements = [
    grounding.composition,
    `keep ${spec.text_safe_zones.map((z) => z.edge).join("/")} clear for deterministic typography`,
  ];

  return {
    prompt: lines.join("\n"),
    negative_prompt: neg.map((c) => c.text).join("; "),
    negative_constraints: neg,
    aspect_ratio: spec.aspect_ratio,
    production_mode: spec.production_mode,
    compound: !!spec.compound,
    composition_requirements,
    text_safe_zones: spec.text_safe_zones,
    grounding_refs: {
      angle_id: grounding.provenance?.angle_id || null,
      visual_grounding_id: grounding.id,
      customer_truth_refs: grounding.provenance?.customer_truth_refs || [],
      product_truth_refs: grounding.provenance?.product_truth_refs || [],
    },
    spec_refs: {
      visual_asset_spec_id: spec.id,
      image_render_spec_type: imageRenderSpec?.spec_type || "ImageRenderSpec",
    },
    prompt_version: "1.0",
    spec_version: spec.version || "1.0",
  };
}

export const VisualPromptService = {
  nextId(scope, existing = existingIds(IPP_DIR)) { return makeId("imagePromptPackage", scope, existing); },

  /** Compile + persist as a validated ImagePromptPackage record. */
  build({ angle, grounding, spec, brand = {}, productTruth = null, platform = null, id = null } = {}) {
    const imageRenderSpec = buildImageRenderSpec(grounding, spec, brand);
    const content = compilePromptPackage({ grounding, spec, imageRenderSpec, brand, productTruth, platform });
    const record = { id: id || this.nextId((angle?.id || "GEN").replace(/^ANG-/, "").split("-")[0] || "GEN"), class: "image_prompt_package", ...content, created_at: new Date().toISOString() };
    validate("image-prompt-package.schema.json", record, record.id);
    return { record, imageRenderSpec };
  },

  save(record, { scope = "production" } = {}) { return save("image-prompt-packages", record, { scope }); },
  get(id) { return all("image-prompt-packages").find((x) => x.id === id) || null; },
};
