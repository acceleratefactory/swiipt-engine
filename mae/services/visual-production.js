// MAE · VisualProductionService — composes the provider-INDEPENDENT visual production request:
//   Angle -> VisualGroundingBlock -> VisualAssetSpec -> production mode -> ImageRenderSpec
//         -> deterministic prompt + negative prompt -> pre-generation QA
// It does NOT call a provider. The resulting request is handed to the existing media pipeline, which
// terminates honestly (PROVIDER_UNAVAILABLE / PRODUCTION_BLOCKED) until an image provider is activated.
import { BrandTruthService } from "./brand.js";
import { VisualGroundingService } from "./visual-grounding.js";
import { VisualAssetSpecService, ProductionModeService } from "./visual-asset-spec.js";
import { VisualPromptService, buildImageRenderSpec } from "../media/prompt-compiler.js";
import { VisualQA } from "./visual-qa.js";

export const VisualProductionService = {
  plan({ angle, brief = null, platform, assetPurpose = null, customerTruth = null, productTruth = null, brand = null, groundingId = null, specId = null, promptId = null, requiresVisual = true } = {}) {
    const brandTruth = brand || BrandTruthService.loadBrand();

    const grounding = VisualGroundingService.build(angle, { customerTruth, productTruth, brandTruth, platform, assetPurpose, id: groundingId });

    const mode = ProductionModeService.decide({ brief, grounding, assetPurpose, platform });

    const safetyConstraints = productTruth?.safety?.scope_boundary ? [productTruth.safety.scope_boundary] : [];
    const spec = VisualAssetSpecService.build({ angle, brief, grounding, platform, assetPurpose, productionMode: mode.mode, safetyConstraints, id: specId });

    const imageRenderSpec = buildImageRenderSpec(grounding, spec, brandTruth);
    const { record: promptPackage } = VisualPromptService.build({ angle, grounding, spec, brand: brandTruth, productTruth, platform, id: promptId });

    const qa = VisualQA.preGeneration({ angle, grounding, spec, promptPackage, requiresVisual });

    return { grounding, spec, mode, imageRenderSpec, promptPackage, qa };
  },
};
