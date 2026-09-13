// MAE · Deterministic PRE-GENERATION visual QA. No image model, no AI judgment, no aesthetics.
// It proves the production request is complete and grounded BEFORE a provider is ever called.
// (Full image Visual QA — anatomy, artifacts, cultural visual judgment — is a later wave that needs
// actual generated outputs.)
import { getAjv, schemaId } from "../lib/schema.js";
import { REQUIRED_SCENE_FIELDS } from "./visual-grounding.js";

function schemaValid(grounding) {
  const ajv = getAjv();
  return !!ajv.validate(schemaId("visual-grounding.schema.json"), grounding);
}

export const VisualQA = {
  preGeneration({ angle, grounding = null, spec = null, promptPackage = null, requiresVisual = true } = {}) {
    const checks = [];
    const push = (name, pass, detail = null) => checks.push({ check: name, pass: !!pass, detail });

    push("grounding_exists_when_required", !requiresVisual || !!grounding, requiresVisual ? "grounding required" : "not required");
    push("grounding_schema_valid", !!grounding && schemaValid(grounding), "visual-grounding.schema.json");
    push("grounding_angle_matches", !!grounding && grounding.provenance?.angle_id === angle?.id, "provenance.angle_id");
    push(
      "required_scene_fields_present",
      !!grounding && REQUIRED_SCENE_FIELDS.every((f) => {
        const v = grounding[f];
        return Array.isArray(v) ? v.length > 0 : (v !== undefined && v !== null && String(v).trim() !== "");
      }),
      REQUIRED_SCENE_FIELDS.join(",")
    );
    push("exclusions_present", !!grounding && Array.isArray(grounding.exclusions) && grounding.exclusions.length > 0, ">=1 exclusion");

    push("spec_exists", !!spec, "VisualAssetSpec");
    push("spec_references_grounding", !!spec && !!grounding && spec.visual_grounding_id === grounding.id && spec.angle_id === angle?.id, "spec.visual_grounding_id");
    push(
      "prompt_package_references_spec",
      !!promptPackage && !!spec && promptPackage.spec_refs?.visual_asset_spec_id === spec.id && promptPackage.grounding_refs?.visual_grounding_id === grounding?.id,
      "spec_refs + grounding_refs"
    );

    // No required grounding silently invented: every visual-detail field is classified, and any field
    // classed source_grounded must have real provenance refs behind it.
    const dc = grounding?.detail_classes || {};
    const unclassified = ["scene", "environment", "gesture_posture", "props", "lighting", "composition"].filter((f) => !dc[f]);
    const sourceFields = Object.entries(dc).filter(([, v]) => v === "source_grounded").map(([k]) => k);
    const prov = grounding?.provenance || {};
    const hasTruthRef = (prov.customer_truth_refs || []).length > 0 || (prov.product_truth_refs || []).length > 0;
    push("no_invented_grounding", !!grounding && unclassified.length === 0 && (!sourceFields.length || hasTruthRef), `unclassified=${unclassified.join(",") || "none"}; source_grounded=${sourceFields.length}; truth_refs=${hasTruthRef}`);

    push(
      "generated_scene_requires_grounding",
      !spec || spec.production_mode !== "GENERATED_SCENE" || (!!grounding && !!spec),
      "GENERATED_SCENE requires grounding + spec"
    );

    return { pass: checks.every((c) => c.pass), checks };
  },
};
