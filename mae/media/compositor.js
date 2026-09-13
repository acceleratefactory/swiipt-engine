// MAE media · deterministic IMAGE COMPOSITOR.
// An image generator produces imagery; THIS produces the finished Swiipt asset. Typography, copy, CTA,
// logo, spacing and safe zones stay deterministic — image models are never asked to render final text.
//
// Deterministic composition order:
//   background image slot -> overlay/scrim -> brand bar -> headline -> body -> CTA -> logo
//
// No provider, no network, no browser, no ML. Raster export is an explicit NEXT_STEP (no clean local
// dependency); SVG is the canonical deterministic output for this wave.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { RenderSpecs } from "./render-specs.js";
import { renderSvg, svgVisibleText, textMatches, IMAGE_FITS, TOKENS, WORK_DIR } from "./layout.js";
import { MAE_DIR } from "../lib/store.js";

export const COMPOSITOR_VERSION = "1.0";

const zoneValue = (zones, edge, dflt) => {
  const z = (zones || []).find((x) => x.edge === edge);
  return z && Number.isFinite(z.min_px) ? z.min_px : dflt;
};

/** Cover keyword from the VisualAssetSpec image placement. */
const coverToFit = (cover) => (cover === "contained" ? "contain" : "cover");

export const Compositor = {
  /**
   * @param {object} a
   * @param {object} a.visualAssetSpec  VAS-CSEC-006 (references grounding/spec)
   * @param {object} a.imageSource      { uri, mime, width, height, checksum, artifact_id? } (local file)
   * @param {object} a.copy             { headline, body, cta, disclaimer? } approved copy (exact)
   * @param {object} [a.template]       { id, fit, focal, overlay }
   */
  compose({ visualAssetSpec, imageSource = null, copy = {}, template = {}, outDir = WORK_DIR, filename } = {}) {
    const canvas = visualAssetSpec?.canvas || "instagram_feed";
    const safe_area = {
      top: zoneValue(visualAssetSpec?.text_safe_zones, "top", 96),
      right: zoneValue(visualAssetSpec?.text_safe_zones, "right", 96),
      bottom: zoneValue(visualAssetSpec?.text_safe_zones, "bottom", 96),
      left: zoneValue(visualAssetSpec?.text_safe_zones, "left", 96),
    };

    const image_slots = imageSource
      ? [{
          slot_id: template.slot_id || "bg",
          role: "BACKGROUND",
          source: { uri: imageSource.uri, mime: imageSource.mime, width: imageSource.width, height: imageSource.height },
          fit: template.fit || coverToFit(visualAssetSpec?.image_placement?.cover),
          focal: template.focal || visualAssetSpec?.image_placement?.focal_point || "center",
          opacity: 1,
        }]
      : [];

    // Overlay comes from the spec / template / deterministic policy — never ad-hoc renderer logic.
    const overlay = template.overlay !== undefined
      ? template.overlay
      : (visualAssetSpec?.overlay || (imageSource ? { type: "gradient", color: TOKENS.navy, opacity: 0.45, direction: "bottom" } : null));

    const renderSpec = RenderSpecs.layoutRender({
      template_id: template.id || "swt-compound-v1",
      canvas,
      safe_area,
      headline: copy.headline || "",
      body_copy: copy.body || "",
      cta: copy.cta || "",
      disclaimer: copy.disclaimer || "",
      image_slots,
      overlay,
    });

    const out = renderSvg(renderSpec, { dir: outDir, filename });

    const locked_copy_verified = textMatches(out.svg, copy.headline || "") &&
      (!copy.body || textMatches(out.svg, copy.body)) &&
      (!copy.cta || out.svg.includes(copy.cta));

    const artifactMeta = {
      artifact_role: "FINAL",
      mime_type: "image/svg+xml",
      storage_uri: out.storage_uri,
      checksum: out.checksum,
      width: out.width,
      height: out.height,
      provider: "internal-compositor",
      model: null,
      provider_job_id: null,
      latency_ms: null,
      cost: null,
      usage: null,
      generation_parameters: null,
      prompt_package_version: null, // set by caller from the IPP when available
      layout_template_id: renderSpec.template_id,
      compositor_version: COMPOSITOR_VERSION,
      locked_copy_verified,
      source_image_artifact_id: imageSource?.artifact_id || null,
      source_image_reference: imageSource?.uri || null,
      visual_grounding_id: visualAssetSpec?.visual_grounding_id || null,
      visual_asset_spec_id: visualAssetSpec?.id || null,
    };

    return { renderSpec, out, artifactMeta, imageSource };
  },
};

export const CompositorQA = {
  /** Deterministic OUTPUT QA. No aesthetics/anatomy/culture scoring (later wave). */
  check({ out, artifactMeta, expected = {}, imageSource = null, repeat = null } = {}) {
    const checks = [];
    const push = (name, pass, detail = null) => checks.push({ check: name, pass: !!pass, detail });

    const canvas = out?.width && out?.height ? { w: out.width, h: out.height } : null;
    const exp = expected.canvas || null;

    push("output_file_exists", !!out && existsSync(out.storage_uri), out?.storage_uri || null);
    push("canvas_dimensions_correct", !!canvas && (!exp || (canvas.w === exp.w && canvas.h === exp.h)), canvas ? `${canvas.w}x${canvas.h}` : null);
    push("image_layer_present_when_required", !expected.imageRequired || out?.has_background_image === true, `required=${!!expected.imageRequired}`);
    push("image_slot_matches_spec", !expected.imageRequired || (out?.image_slots?.[0]?.role === "BACKGROUND"), JSON.stringify(out?.image_slots || []));
    push("fit_mode_valid", !expected.imageRequired || IMAGE_FITS.includes(out?.image_slots?.[0]?.fit), out?.image_slots?.[0]?.fit || null);
    const overlayType = out?.overlay ? out.overlay.type : "none";
    push("overlay_matches_spec", expected.overlayType === undefined || overlayType === expected.overlayType, `got=${overlayType}`);
    push("headline_exact", out ? textMatches(out.svg, expected.headline || "") : false, expected.headline || "");
    push("body_exact", !expected.body || (out ? textMatches(out.svg, expected.body) : false), expected.body || "");
    push("cta_exact", !expected.cta || (out ? out.svg.includes(expected.cta) : false), expected.cta || "");
    push("locked_copy_unchanged", !!artifactMeta?.locked_copy_verified, "locked_copy_verified");
    push("logo_present", !!out && out.svg.includes(">Swiipt<"), "Swiipt mark");
    // text bounds must sit inside the canvas and respect each declared safe zone
    const sa = out?.safe_area || {};
    const b = out?.bounds || {};
    const withinCanvas = !!out && b.top >= 0 && b.left >= 0 && b.bottom <= out.height && b.right <= out.width;
    const respectsZones = !!out && b.left >= sa.left && b.top >= sa.top &&
      (out.width - b.right) >= sa.right && (out.height - b.bottom) >= sa.bottom - 1;
    push("no_text_overflow", withinCanvas, JSON.stringify(b));
    push("safe_zones_respected", respectsZones, JSON.stringify({ bounds: b, safe_area: sa }));
    push("spec_references_retained", !!artifactMeta?.visual_grounding_id && !!artifactMeta?.visual_asset_spec_id, `${artifactMeta?.visual_grounding_id}/${artifactMeta?.visual_asset_spec_id}`);
    push("checksum_present", !!artifactMeta?.checksum && artifactMeta.checksum.length >= 8, artifactMeta?.checksum || null);
    push("source_image_provenance_retained", !imageSource || (!!artifactMeta?.source_image_reference), artifactMeta?.source_image_reference || null);
    push("no_provider_metadata_fabricated", artifactMeta?.provider === "internal-compositor" && artifactMeta?.model === null && artifactMeta?.cost === null && artifactMeta?.latency_ms === null, `provider=${artifactMeta?.provider}; model=${artifactMeta?.model}`);
    push("deterministic_repeat", !repeat || (repeat.checksum === out?.checksum), repeat ? `${repeat.checksum} vs ${out?.checksum}` : "not requested");

    return { pass: checks.every((c) => c.pass), checks };
  },
};

/** Deterministic local fixture image loader (no network, no AI). */
export function fixtureImage(name) {
  const FIX_DIR = join(MAE_DIR, "data", "fixtures", "images");
  const meta = {
    "vf-scene-01": { uri: join(FIX_DIR, "vf-scene-01.svg"), mime: "image/svg+xml", width: 1080, height: 1350 },
    "vf-wide-02": { uri: join(FIX_DIR, "vf-wide-02.svg"), mime: "image/svg+xml", width: 1200, height: 630 },
  }[name];
  if (!meta) throw new Error(`unknown fixture image '${name}'`);
  const checksum = createHash("sha256").update(readFileSync(meta.uri)).digest("hex");
  return { ...meta, checksum, artifact_id: `FIXIMG-${name.toUpperCase()}` };
}
