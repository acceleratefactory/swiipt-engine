// MAE · VisualGroundingService (S5/Media). Builds a VisualGroundingBlock from an APPROVED angle BEFORE
// any provider runs. The image model is never the creative director: grounding is derived from Truth.
//
// Two evidence classes are preserved (schema `detail_classes`):
//   source_grounded      — traceable to Customer/Product/Brand Truth
//   production_instruction — a rendering interpretation of grounded facts (e.g. 3 AM -> low-key light)
// A production instruction is never represented as Customer Truth, and no unsupported customer fact is
// introduced. No provider is called here.
import { save, all, MAE_DIR } from "../lib/store.js";
import { validate } from "../lib/schema.js";
import { makeId, existingIds } from "../lib/ids.js";
import { join } from "node:path";
import { fail, CODES } from "../lib/errors.js";
import { BrandTruthService } from "./brand.js";
import { CustomerRealityService } from "./crf.js";

const VG_DIR = join(MAE_DIR, "data", "visual-groundings");
export const REQUIRED_SCENE_FIELDS = ["scene", "environment", "gesture_posture", "props", "lighting", "composition", "exclusions"];

const lower = (s) => String(s || "").toLowerCase();
const has = (hay, needle) => lower(hay).includes(needle);
const uniq = (a) => [...new Set(a.filter(Boolean))];

export const VisualGroundingService = {
  nextId(scope, existing = existingIds(VG_DIR)) { return makeId("visualGrounding", scope, existing); },

  /** Deterministically derive a grounding block. `angle` is the approved Marketing Angle Record. */
  build(angle, opts = {}) {
    if (!angle) fail(CODES.MISSING_FIELD, "VisualGroundingService.build requires an Angle Record");

    const refs = angle.tier3?.source_evidence || [];
    const customerTruth = opts.customerTruth || (refs[0]?.ref_id ? CustomerRealityService.get(refs[0].ref_id) : null);
    const productTruth = opts.productTruth || (angle.tier3?.product_truth_ref ? (all("product-truth").find((r) => r.id === angle.tier3.product_truth_ref) || null) : null);
    const brand = opts.brandTruth || BrandTruthService.loadBrand();

    const t1 = angle.tier1 || {};
    const crf = customerTruth || {};

    // ---- SOURCE-GROUNDED detail (Customer Truth first, then the angle which mirrors it) ----
    const scene = crf.situation || t1.scene;
    const environment = crf.context || t1.scene;
    const subject = crf.person || t1.customer;
    const behaviour = Array.isArray(crf.behaviour) ? crf.behaviour : [];
    const gesture = behaviour.length
      ? `Rising from bed; ${behaviour.join("; ")}`
      : (t1.pain || t1.failed_attempt);
    const cultural = uniq([...(crf.cultural_context || []), ...(has(subject, "nigerian") ? ["Nigerian"] : [])]);
    const emotionalTone = crf.emotional_stake || t1.emotional_stake?.text || null;

    // Props are only claimed when the Truth text names them (no invented set dressing).
    const props = [];
    if (behaviour.some((b) => has(b, "bed frame")) || has(t1.pain, "bed frame")) props.push("bed frame");
    if (behaviour.some((b) => has(b, "dresser"))) props.push("dresser");

    // ---- PRODUCTION INSTRUCTIONS (interpretations, never Customer Truth) ----
    const isNight = has(scene, "3 am") || has(scene, "night");
    const lighting = isNight
      ? "Soft low-key practical night lighting (implied by the 3 AM scene)"
      : "Natural, restrained lighting consistent with the scene";
    const composition = "Single subject, intimate framing, deliberate negative space reserved for deterministic text overlay";

    if (!scene || !environment || !gesture) {
      fail(CODES.MISSING_FIELD, "VisualGroundingService: scene/environment/gesture are required and must be truth-supported", { angle: angle.id });
    }

    // ---- Exclusions: derived from Brand Truth + Product Truth (never generic AI folklore) ----
    const imageryRules = brand.visual_language?.imagery_rules || [];
    const antiPatterns = brand.visual_language?.anti_patterns || [];
    // Grounding exclusions come from Brand Truth + the product's safety scope. Product Truth
    // prohibited CLAIMS are compiled separately by the prompt compiler (category product_truth) so a
    // claim boundary is never mislabelled as a grounding exclusion.
    const exclusions = uniq([
      ...imageryRules.filter((r) => /^no\b/i.test(r)),
      ...antiPatterns.map((p) => `no ${p}`),
      ...(productTruth?.safety?.scope_boundary ? [productTruth.safety.scope_boundary] : []),
    ]);
    if (!exclusions.length) fail(CODES.MISSING_FIELD, "VisualGroundingService: at least one exclusion is required");

    const block = {
      id: opts.id || this.nextId((angle.id.replace(/^ANG-/, "").split("-")[0] || "GEN")),
      class: "visual_grounding",
      scene,
      environment,
      subject,
      gesture_posture: gesture,
      props,
      wardrobe: null,
      lighting,
      cultural_markers: cultural,
      emotional_tone: emotionalTone,
      composition,
      exclusions,
      detail_classes: {
        scene: "source_grounded",
        environment: "source_grounded",
        subject: "source_grounded",
        gesture_posture: "source_grounded",
        props: "source_grounded",
        lighting: "production_instruction",
        cultural_markers: "source_grounded",
        emotional_tone: "source_grounded",
        composition: "production_instruction",
        exclusions: "source_grounded",
      },
      provenance: {
        angle_id: angle.id,
        customer_truth_refs: uniq([...(refs.map((e) => e.ref_id)), customerTruth?.id]),
        product_truth_refs: uniq([angle.tier3?.product_truth_ref, productTruth?.id]),
        brand_truth_version: brand.version ?? null,
        platform: opts.platform ?? null,
        asset_purpose: opts.assetPurpose ?? angle.tier2?.asset_purpose ?? null,
        derivation: "deterministic:VisualGroundingService@1.0",
      },
    };

    validate("visual-grounding.schema.json", block, block.id);
    return block;
  },

  save(block, { scope = "production" } = {}) { return save("visual-groundings", block, { scope }); },
  get(id) { return all("visual-groundings").find((x) => x.id === id) || null; },
};
