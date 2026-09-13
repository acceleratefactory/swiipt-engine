// MAE · build the six frozen visual qualification fixtures (deterministic, idempotent).
// Run: node mae/harness/build-visual-fixtures.mjs
// Freezes Truth/grounding/spec/image-render-spec/prompt-package + expected structural constraints.
// Provider/model never affect fixture identity (see computeFixtureHash).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FIX_DIR, computeFixtureHash } from "../services/visual-qualification.js";
import { VISUAL_QA_DIMENSIONS, DIMENSION_CLASS } from "../services/visual-output-qa.js";
import { csecVisualFoundation } from "./fixtures.mjs";

const DIMS = VISUAL_QA_DIMENSIONS.map((d) => d.id);
const JUDGMENT = VISUAL_QA_DIMENSIONS.filter((d) => d.class !== DIMENSION_CLASS.DETERMINISTIC).map((d) => d.id);
const EXCL = ["no symmetrical AI-face", "no gradient blobs", "no clinical staging or staged pain expression", "no embedded text or lettering"];

function wrap(f) {
  f.qualification_dimensions = DIMS;
  f.expected.judgment_dimensions = JUDGMENT;
  f.fixture_hash = computeFixtureHash(f);
  return f;
}
const deterministic = (canvas, fit, overlay) => ({
  canvas_dimensions: `${canvas.width}x${canvas.height}`,
  aspect_ratio: `${canvas.width}:${canvas.height}`,
  image_slot_role: "BACKGROUND",
  fit,
  overlay_type: overlay,
  text_safe_zones_present: true,
  locked_copy_required: true,
});

const grounding = (id, over = {}) => ({
  id, class: "visual_grounding",
  scene: "", environment: "", subject: "", gesture_posture: "", props: [], wardrobe: null, lighting: "", cultural_markers: [], emotional_tone: null, composition: "", exclusions: EXCL,
  detail_classes: { scene: "source_grounded", environment: "source_grounded", subject: "source_grounded", gesture_posture: "source_grounded", props: "source_grounded", lighting: "production_instruction", composition: "production_instruction", exclusions: "source_grounded" },
  provenance: { angle_id: null, customer_truth_refs: [], product_truth_refs: [], brand_truth_version: "1.0", platform: null, asset_purpose: null, derivation: "deterministic:VisualGroundingService@1.0" },
  ...over,
});

const fixtures = [];

// VF-1 HUMAN_LIFESTYLE_SCENE
{
  const canvas = { width: 1080, height: 1350 };
  const order = { type: "gradient", color: "#0B1F33", opacity: 0.45, direction: "bottom" };
  fixtures.push(wrap({
    fixture_id: "VF-1", version: "1.0", job_type: "HUMAN_LIFESTYLE_SCENE", is_fixture: true, provenance: "synthetic_fixture",
    source_ref: { angle_id: null, product_id: "PROD-VQ1", transformation_id: null },
    visual_grounding: grounding("VG-VQ1-001", { scene: "A parent moving through an ordinary evening at home", environment: "Ordinary home interior, evening", subject: "Adult, everyday clothing, no glamour styling", gesture_posture: "Natural standing or walking posture, unposed", props: ["furniture"], lighting: "Soft natural interior light", emotional_tone: "Calm, unremarkable", composition: "Single subject, room for text negative space", exclusions: EXCL }),
    visual_asset_spec: { id: "VAS-VQ1-001", class: "visual_asset_spec", production_mode: "GENERATED_SCENE", compound: true, aspect_ratio: "1080:1350", canvas, overlay: order },
    image_render_spec: { spec_type: "ImageRenderSpec", scene: "A parent moving through an ordinary evening at home", aspect_ratio: "1080:1350", negative_constraints: EXCL, text_overlay_allowed: false },
    prompt_package: { id: "IPP-VQ1-001", prompt: "Scene: A parent moving through an ordinary evening at home. Natural posture, realistic domestic environment, no staged emotion.", negative_prompt: EXCL.join("; "), negative_constraints: EXCL.map((t) => ({ text: t, category: "brand_rule", reason: "brand" })) },
    expected: { production_mode: "GENERATED_SCENE", compound: true, aspect_ratio: "1080:1350", canvas, text_safe_zones: [{ edge: "top", min_px: 96 }, { edge: "left", min_px: 96 }, { edge: "right", min_px: 96 }, { edge: "bottom", min_px: 180 }], deterministic_overlays: [{ kind: "headline" }, { kind: "body" }, { kind: "cta" }, { kind: "logo" }], structural_requirements: ["single human subject", "natural unposed posture", "realistic home environment", "no staged pain or melodrama"], required_negative_categories: ["grounding_exclusion", "brand_anti_pattern", "brand_rule", "platform"] },
    truth_references: { angle_id: null, customer_truth_refs: [], product_truth_refs: [], brand_truth_version: "1.0" },
    brand_truth_version: "1.0",
    deterministic_expected_checks: deterministic(canvas, "cover", "gradient"),
  }));
}

// VF-2 CULTURALLY_SPECIFIC_SCENE (canonical Day-6, references real records)
{
  const f = csecVisualFoundation();
  const cats = [...new Set((f.promptPackage.negative_constraints || []).map((c) => c.category))];
  fixtures.push(wrap({
    fixture_id: "VF-2", version: "1.0", job_type: "CULTURALLY_SPECIFIC_SCENE", is_fixture: true, provenance: "canonical_fixture",
    source_ref: { angle_id: "ANG-CSEC-006", product_id: "PROD-CSEC", transformation_id: "TR-CSEC" },
    visual_grounding: f.grounding,
    visual_asset_spec: f.spec,
    image_render_spec: f.imageRenderSpec,
    prompt_package: f.promptPackage,
    expected: { production_mode: f.spec.production_mode, compound: f.spec.compound, aspect_ratio: f.spec.aspect_ratio, canvas: f.spec.canvas, text_safe_zones: f.spec.text_safe_zones, deterministic_overlays: f.spec.deterministic_overlays, structural_requirements: ["Nigerian first-time mother, day 6 after C-section", "3 AM night scene implied by Truth", "rising from bed; braces against the bed frame / holds the dresser", "props limited to bed frame + dresser (truth-named only)", "no clinical staging or staged pain expression"], required_negative_categories: cats },
    truth_references: { angle_id: "ANG-CSEC-006", customer_truth_refs: f.grounding.provenance.customer_truth_refs, product_truth_refs: f.grounding.provenance.product_truth_refs, brand_truth_version: "1.0" },
    brand_truth_version: "1.0",
    deterministic_expected_checks: deterministic(f.spec.canvas, "cover", "gradient"),
    grounding_classification: f.grounding.detail_classes,
  }));
}

// VF-3 PRODUCT_OBJECT_VISUAL
{
  const canvas = { width: 1200, height: 1600 };
  const ex = [...EXCL, "no fabricated product UI or tools"];
  fixtures.push(wrap({
    fixture_id: "VF-3", version: "1.0", job_type: "PRODUCT_OBJECT_VISUAL", is_fixture: true, provenance: "synthetic_fixture",
    source_ref: { angle_id: null, product_id: "PROD-VQ3", transformation_id: null },
    visual_grounding: grounding("VG-VQ3-001", { scene: "The product object presented on a neutral surface", environment: "Neutral studio surface", subject: "The product (object)", gesture_posture: "Not applicable (no person)", props: ["the product object"], lighting: "Even, soft studio light", emotional_tone: null, composition: "Centred object, clean background", exclusions: ex }),
    visual_asset_spec: { id: "VAS-VQ3-001", class: "visual_asset_spec", production_mode: "GENERATED_SCENE", compound: false, aspect_ratio: "1200:1600", canvas, overlay: { type: "none" } },
    image_render_spec: { spec_type: "ImageRenderSpec", scene: "The product object presented on a neutral surface", aspect_ratio: "1200:1600", negative_constraints: ex, text_overlay_allowed: false },
    prompt_package: { id: "IPP-VQ3-001", prompt: "Scene: The product object on a neutral studio surface. Even soft light, clean background.", negative_prompt: ex.join("; "), negative_constraints: ex.map((t) => ({ text: t, category: "brand_rule", reason: "brand" })) },
    expected: { production_mode: "GENERATED_SCENE", compound: false, aspect_ratio: "1200:1600", canvas, text_safe_zones: [], deterministic_overlays: [], structural_requirements: ["single product object", "clean neutral background", "no fabricated product UI or tools", "even lighting"], required_negative_categories: ["grounding_exclusion", "brand_anti_pattern", "brand_rule", "platform"] },
    truth_references: { angle_id: null, customer_truth_refs: [], product_truth_refs: [], brand_truth_version: "1.0" },
    brand_truth_version: "1.0",
    deterministic_expected_checks: deterministic(canvas, "cover", "none"),
  }));
}

// VF-4 LANDING_PAGE_HERO
{
  const canvas = { width: 1200, height: 630 };
  fixtures.push(wrap({
    fixture_id: "VF-4", version: "1.0", job_type: "LANDING_PAGE_HERO", is_fixture: true, provenance: "synthetic_fixture",
    source_ref: { angle_id: null, product_id: "PROD-VQ4", transformation_id: null },
    visual_grounding: grounding("VG-VQ4-001", { scene: "A wide daylight interior with a clear area of negative space on the left", environment: "Wide interior, daylight", subject: "Scene only (no required person)", gesture_posture: "Not applicable", props: ["furniture"], lighting: "Bright daylight", emotional_tone: "Calm", composition: "Subject on the right third; large negative space on the left for headline", exclusions: EXCL }),
    visual_asset_spec: { id: "VAS-VQ4-001", class: "visual_asset_spec", production_mode: "LANDING_PAGE_MEDIA", compound: true, aspect_ratio: "1200:630", canvas, overlay: { type: "gradient", color: "#0B1F33", opacity: 0.35, direction: "left" } },
    image_render_spec: { spec_type: "ImageRenderSpec", scene: "A wide daylight interior with negative space on the left", aspect_ratio: "1200:630", negative_constraints: EXCL, text_overlay_allowed: false },
    prompt_package: { id: "IPP-VQ4-001", prompt: "Scene: Wide daylight interior. Leave the left third clear as negative space for the headline.", negative_prompt: EXCL.join("; "), negative_constraints: EXCL.map((t) => ({ text: t, category: "brand_rule", reason: "brand" })) },
    expected: { production_mode: "LANDING_PAGE_MEDIA", compound: true, aspect_ratio: "1200:630", canvas, text_safe_zones: [{ edge: "left", min_px: 96 }], deterministic_overlays: [{ kind: "headline" }, { kind: "cta" }, { kind: "logo" }], structural_requirements: ["wide composition", "clear negative space for headline", "no text embedded in the image", "crop-safe subject placement"], required_negative_categories: ["grounding_exclusion", "brand_anti_pattern", "brand_rule", "platform"] },
    truth_references: { angle_id: null, customer_truth_refs: [], product_truth_refs: [], brand_truth_version: "1.0" },
    brand_truth_version: "1.0",
    deterministic_expected_checks: deterministic(canvas, "cover", "gradient"),
  }));
}

// VF-5 EDUCATIONAL_ILLUSTRATION
{
  const canvas = { width: 1080, height: 1080 };
  fixtures.push(wrap({
    fixture_id: "VF-5", version: "1.0", job_type: "EDUCATIONAL_ILLUSTRATION", is_fixture: true, provenance: "synthetic_fixture",
    source_ref: { angle_id: null, product_id: "PROD-VQ5", transformation_id: null },
    visual_grounding: grounding("VG-VQ5-001", { scene: "A non-photographic diagram of a three-step physical sequence", environment: "Flat illustrative background", subject: "Abstract figure performing a 3-step sequence", gesture_posture: "Three sequential positions", props: ["sequence markers"], lighting: "Flat illustrative lighting (no photorealism)", emotional_tone: null, composition: "Even, instructional layout with clear step separation", exclusions: [...EXCL, "no photorealism", "no embedded labels"] }),
    visual_asset_spec: { id: "VAS-VQ5-001", class: "visual_asset_spec", production_mode: "GENERATED_SCENE", compound: false, aspect_ratio: "1080:1080", canvas, overlay: { type: "none" } },
    image_render_spec: { spec_type: "ImageRenderSpec", scene: "Non-photographic diagram of a three-step sequence", aspect_ratio: "1080:1080", negative_constraints: [...EXCL, "no photorealism", "no embedded labels"], text_overlay_allowed: false },
    prompt_package: { id: "IPP-VQ5-001", prompt: "Scene: A non-photographic diagram of a three-step physical sequence. Clear step separation; no embedded labels.", negative_prompt: [...EXCL, "no photorealism", "no embedded labels"].join("; "), negative_constraints: EXCL.map((t) => ({ text: t, category: "brand_rule", reason: "brand" })) },
    expected: { production_mode: "GENERATED_SCENE", compound: false, aspect_ratio: "1080:1080", canvas, text_safe_zones: [], deterministic_overlays: [], structural_requirements: ["non-photographic illustrative style", "clear 3-step structure", "no embedded text (labels applied deterministically)"], required_negative_categories: ["grounding_exclusion", "brand_anti_pattern", "brand_rule", "platform"] },
    truth_references: { angle_id: null, customer_truth_refs: [], product_truth_refs: [], brand_truth_version: "1.0" },
    brand_truth_version: "1.0",
    deterministic_expected_checks: deterministic(canvas, "contain", "none"),
  }));
}

// VF-6 SOCIAL_CAROUSEL_VISUAL
{
  const canvas = { width: 1080, height: 1350 };
  fixtures.push(wrap({
    fixture_id: "VF-6", version: "1.0", job_type: "SOCIAL_CAROUSEL_VISUAL", is_fixture: true, provenance: "synthetic_fixture",
    source_ref: { angle_id: null, product_id: "PROD-VQ6", transformation_id: null },
    visual_grounding: grounding("VG-VQ6-001", { scene: "A single social panel image with a protected text region", environment: "Simple contextual background", subject: "Optional single subject", gesture_posture: "Natural", props: [], lighting: "Soft", emotional_tone: "Calm", composition: "Panel composition with a reserved text-safe area", exclusions: EXCL }),
    visual_asset_spec: { id: "VAS-VQ6-001", class: "visual_asset_spec", production_mode: "CAROUSEL", compound: true, aspect_ratio: "1080:1350", canvas, overlay: { type: "gradient", color: "#0B1F33", opacity: 0.4, direction: "bottom" } },
    image_render_spec: { spec_type: "ImageRenderSpec", scene: "A single social panel image with a protected text region", aspect_ratio: "1080:1350", negative_constraints: EXCL, text_overlay_allowed: false },
    prompt_package: { id: "IPP-VQ6-001", prompt: "Scene: A single social panel image; reserve a clear text-safe area for deterministic type.", negative_prompt: EXCL.join("; "), negative_constraints: EXCL.map((t) => ({ text: t, category: "brand_rule", reason: "brand" })) },
    expected: { production_mode: "CAROUSEL", compound: true, aspect_ratio: "1080:1350", canvas, text_safe_zones: [{ edge: "top", min_px: 96 }, { edge: "bottom", min_px: 180 }], deterministic_overlays: [{ kind: "headline" }, { kind: "cta" }, { kind: "logo" }], structural_requirements: ["panel composition", "text-safe area preserved", "consistent with asset family", "no embedded text"], required_negative_categories: ["grounding_exclusion", "brand_anti_pattern", "brand_rule", "platform"] },
    truth_references: { angle_id: null, customer_truth_refs: [], product_truth_refs: [], brand_truth_version: "1.0" },
    brand_truth_version: "1.0",
    deterministic_expected_checks: deterministic(canvas, "cover", "gradient"),
  }));
}

mkdirSync(FIX_DIR, { recursive: true });
for (const f of fixtures) {
  writeFileSync(join(FIX_DIR, `${f.fixture_id}.json`), JSON.stringify(f, null, 2) + "\n");
}
console.log(`wrote ${fixtures.length} fixtures -> ${FIX_DIR}`);
for (const f of fixtures) console.log(`${f.fixture_id} ${f.job_type} hash=${f.fixture_hash.slice(0, 16)}…`);
