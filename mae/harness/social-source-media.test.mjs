// MAE Social Design — Wave S-F tests: source-media integration + typography-over-media.
// No image generation, no video generation, no frame extraction, no network, no raster.
// All SYN-* media below is SYNTHETIC test data (never truth, proof or evidence).
// Run: node mae/harness/social-source-media.test.mjs
import { test } from "node:test";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeSocialSourceMedia, validateSourceMedia, resolveSocialSourceMedia, sourceMediaPlacement,
  sourceMediaProvenance, isModeSourceCompatible, mediaAuthorizesEvidence, sourceMediaId,
  hasGeneratedMedia, hasSyntheticMedia,
  SOURCE_TYPES, SOURCE_MEDIA_STATUS, SUPPORTED_MEDIA_TYPES, FITS, FOCALS, SOCIAL_SOURCE_MEDIA_VERSION,
} from "../media/social-source-media.js";
import { composeSocialStatic, COMPOSITOR_STATUS, STATIC_LAYOUT_FAMILIES, SLOT_ONLY_LAYOUT_FAMILIES } from "../media/social-compositor.js";
import { assembleMultiPanel } from "../media/social-carousel.js";
import { socialTokens } from "../services/social-design-tokens.js";
import { evaluateSocialGraphic } from "../services/social-graphic-qa.js";
import { adaptDesignSpecification, PLATFORM_PROFILES } from "../services/social-platforms.js";
import { validateSocialDesignSpec, ASSET_TYPES } from "../services/social-design-spec.js";
import { svgVisibleText } from "../media/layout.js";
import { DAY6_SPEC, DAY6_HEADLINE, MEDIA_SOURCES, day6MediaSpec, productHeroSpec, illustrationSpec, videoCoverSpec, mixedMediaCarousel } from "./social-media-fixtures.mjs";
import { loadFixtures, computeFixtureHash } from "../services/visual-qualification.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const T = socialTokens();
const SRC = (id) => MEDIA_SOURCES[id];
const composeWith = (spec, registry, slotMap = {}) => {
  const r = resolveSocialSourceMedia({ design_spec: spec, source_media_registry: registry });
  const sources = { ...r.sources };
  for (const [slot, id] of Object.entries(slotMap)) sources[slot] = SRC(id);
  const bindings = [...r.bindings, ...Object.entries(slotMap).map(([slot_id, id]) => ({ slot_id, source: SRC(id), fit: "cover", focal: "center", opacity: 1, required: true }))];
  return { resolved: r, out: composeSocialStatic(spec, T, { sources, bindings }) };
};
const HEAD = (out) => out.visible_text.includes("Nobody tells you what standing up");

// ---------- B. CONTRACT -------------------------------------------------------
test("1. module contract exists with types, statuses and version", () => {
  assert.equal(SOCIAL_SOURCE_MEDIA_VERSION, "1.0");
  assert.deepEqual([...SOURCE_TYPES], ["IMAGE_ARTIFACT", "SUPPLIED_IMAGE", "PRODUCT_IMAGE", "ILLUSTRATION", "VIDEO_FRAME_ARTIFACT", "SYNTHETIC_FIXTURE"]);
  assert.deepEqual(Object.values(SOURCE_MEDIA_STATUS).sort(), ["DUPLICATE_VISUAL_SLOT_BINDING", "INVALID_MEDIA_DIMENSIONS", "INVALID_VISUAL_SLOT", "READY", "SOURCE_METADATA_REQUIRED", "SOURCE_MODE_MISMATCH", "SOURCE_REQUIRED", "UNSUPPORTED_MEDIA_TYPE"]);
  assert.deepEqual([...SUPPORTED_MEDIA_TYPES], ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
});
test("2. normalization is deterministic and ids are stable (no time/random)", () => {
  const input = { source_type: "SUPPLIED_IMAGE", mime: "image/png", width: 1200, height: 800, checksum: "CHK-A" };
  const a = normalizeSocialSourceMedia(input).source;
  const b = normalizeSocialSourceMedia(input).source;
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(a.source_media_id, b.source_media_id);
  const src = readFileSync(join(root, "mae/media/social-source-media.js"), "utf8").replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const banned of ["Date.now", "Math.random", "randomUUID", "fetch(", "ffmpeg", "child_process"]) assert.ok(!src.includes(banned), banned);
});
test("3. bytes are authoritative for mime/dimensions/checksum when supplied", () => {
  const bytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="9" height="7"></svg>');
  const s = normalizeSocialSourceMedia({ source_type: "SUPPLIED_IMAGE", bytes, mime: "image/png", width: 999, height: 999, checksum: "WRONG" }).source;
  assert.equal(s.mime, "image/svg+xml");          // detected beats declared
  assert.notEqual(s.checksum, "WRONG");            // computed from bytes
  assert.ok(s.provenance.metadata_source === "bytes");
});
test("4. fit/focal vocabularies are the existing ones", () => {
  assert.deepEqual([...FITS], ["cover", "contain"]);
  assert.deepEqual([...FOCALS], ["center", "top", "bottom", "left", "right"]);
});

// ---------- C/D. NEGATIVE + TYPE MATRIX --------------------------------------
test("5. unsupported MIME rejects (negative 5)", () => {
  const r = normalizeSocialSourceMedia({ source_type: "SUPPLIED_IMAGE", mime: "image/gif", width: 100, height: 100, checksum: "C" });
  assert.equal(r.ok, false); assert.equal(r.status, SOURCE_MEDIA_STATUS.UNSUPPORTED_MEDIA_TYPE);
});
test("6-7. zero width / zero height reject (negatives 6,7)", () => {
  assert.equal(normalizeSocialSourceMedia({ source_type: "SUPPLIED_IMAGE", mime: "image/png", width: 0, height: 100, checksum: "C" }).status, SOURCE_MEDIA_STATUS.INVALID_MEDIA_DIMENSIONS);
  assert.equal(normalizeSocialSourceMedia({ source_type: "SUPPLIED_IMAGE", mime: "image/png", width: 100, height: 0, checksum: "C" }).status, SOURCE_MEDIA_STATUS.INVALID_MEDIA_DIMENSIONS);
});
test("8-9. missing metadata rejected and dimensions are never guessed (negatives 8,9)", () => {
  assert.equal(normalizeSocialSourceMedia({ source_type: "SUPPLIED_IMAGE", mime: "image/png", checksum: "C" }).status, SOURCE_MEDIA_STATUS.SOURCE_METADATA_REQUIRED);
  const s = normalizeSocialSourceMedia({ source_type: "SUPPLIED_IMAGE", mime: "image/png", width: 1080, height: 1080, checksum: "C", uri: "https://example.com/hero-1920x1080.png" }).source;
  assert.deepEqual([s.width, s.height], [1080, 1080]);   // filename never parsed for dimensions
});
test("10. checksum is never fabricated (declared or computed only)", () => {
  const none = normalizeSocialSourceMedia({ source_type: "SUPPLIED_IMAGE", mime: "image/png", width: 10, height: 10 }).source;
  assert.equal(none.checksum, null);
  assert.ok(normalizeSocialSourceMedia({ source_type: "SUPPLIED_IMAGE", mime: "image/png", width: 10, height: 10 }).warnings.some((w) => /checksum/.test(w)));
  const bytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"></svg>');
  assert.equal(normalizeSocialSourceMedia({ source_type: "SUPPLIED_IMAGE", bytes, width: 4, height: 4 }).source.checksum.length, 64);
});
test("11-14. classification/synthetic/generated provenance preserved; generated never inferred", () => {
  const supplied = normalizeSocialSourceMedia({ source_type: "SUPPLIED_IMAGE", mime: "image/png", width: 10, height: 10, checksum: "C", uri: "photo-generated-by-gemini-model.png" }).source;
  assert.equal(supplied.generated, false);       // filename claiming "generated" is ignored
  assert.equal(supplied.source_classification, "supplied");
  const gen = SRC("SYN-IMG-ART-1");
  assert.equal(gen.generated, true); assert.equal(gen.source_type, "IMAGE_ARTIFACT");
  assert.equal(gen.provenance.visual_grounding_id, "VG-CSEC-006");
  assert.equal(SRC("SYN-PHOTO-1").synthetic, true);
  assert.equal(SRC("SYN-PHOTO-1").generated, false);
});
test("15-16. exact prompt record reference preserved, never reconstructed", () => {
  assert.equal(SRC("SYN-IMG-ART-1").provenance.prompt_record_ref, "SYN-IMG-PROMPT-1");
  const src = readFileSync(join(root, "mae/media/social-source-media.js"), "utf8");
  assert.ok(!/canonicalImageRequest|compilePrompt|buildPrompt/.test(src));
});
test("17-19. resolved video frame accepted; no extraction, no ffmpeg, no best-frame selection", () => {
  const vf = SRC("SYN-VIDEOFRAME-1");
  assert.equal(vf.source_type, "VIDEO_FRAME_ARTIFACT");
  assert.equal(vf.provenance.video_artifact_id, "SYN-VID-ART-1");
  assert.equal(vf.provenance.frame_timestamp, 3.5);
  assert.equal(vf.provenance.derived_frame_artifact_id, "SYN-VID-FRAME-1");
  const src = readFileSync(join(root, "mae/media/social-source-media.js"), "utf8").replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const banned of ["ffmpeg", "extractFrame", "bestFrame", "seek(", "spawnSync"]) assert.ok(!src.includes(banned), banned);
});
test("20. no remote fetching", () => {
  const src = readFileSync(join(root, "mae/media/social-source-media.js"), "utf8");
  assert.ok(!/fetch\(/.test(src));
});
test("21-24. media classification never authorizes evidence or product facts", () => {
  assert.equal(mediaAuthorizesEvidence(), false);
  const src = readFileSync(join(root, "mae/media/social-source-media.js"), "utf8");
  assert.ok(!/authorizeEvidence|evidence_authorization/i.test(src));
  assert.ok(!/\bocr\b|tesseract|readText/i.test(src.replace(/^\s*\/\/.*$/gm, "")));
  const illus = SRC("SYN-ILLUSTRATION-1");
  assert.equal(illus.source_classification, "internal_illustration");
  assert.equal(illus.source_type === "ILLUSTRATION", true);
  const prod = SRC("SYN-PRODUCT-1");
  assert.equal(prod.source_type, "PRODUCT_IMAGE");
  assert.ok(!/sku|variant|feature|price/.test(JSON.stringify(prod.provenance)));
});

// ---------- E. SLOT BINDING ---------------------------------------------------
test("25-26. required source missing → SOURCE_REQUIRED; optional missing proceeds (negatives 1,2)", () => {
  const spec = day6MediaSpec("instagram|feed", { design_id: "SF-REQ" });
  const r = resolveSocialSourceMedia({ design_spec: spec, source_media_registry: [] });
  assert.equal(r.status, SOURCE_MEDIA_STATUS.SOURCE_REQUIRED);
  const optional = { ...spec, visual_slots: [{ ...spec.visual_slots[0], required: false, fallback: "TYPE_ONLY" }] };
  const r2 = resolveSocialSourceMedia({ design_spec: optional, source_media_registry: [] });
  assert.equal(r2.status, SOURCE_MEDIA_STATUS.READY);
  assert.equal(r2.warnings.some((w) => /optional/.test(w)), true);
});
test("27. unknown slot rejected (negative 3)", () => {
  const spec = day6MediaSpec("instagram|feed", { design_id: "SF-UNK" });
  const r = resolveSocialSourceMedia({ design_spec: spec, source_media_registry: [{ slot_id: "not-a-slot", ...SRC("SYN-PHOTO-1") }] });
  assert.equal(r.status, SOURCE_MEDIA_STATUS.INVALID_VISUAL_SLOT);
});
test("28. duplicate slot binding rejected (negative 4)", () => {
  const spec = day6MediaSpec("instagram|feed", { design_id: "SF-DUP" });
  const r = resolveSocialSourceMedia({ design_spec: spec, source_media_registry: [{ slot_id: "hero", ...SRC("SYN-PHOTO-1") }, { slot_id: "hero", ...SRC("SYN-PRODUCT-1") }] });
  assert.equal(r.status, SOURCE_MEDIA_STATUS.DUPLICATE_VISUAL_SLOT_BINDING);
});
test("29. binding is explicit — never by array order (negatives 3/4)", () => {
  const spec = day6MediaSpec("instagram|feed", { design_id: "SF-ORD", source_id: "SYN-PRODUCT-1" });
  const r = resolveSocialSourceMedia({ design_spec: spec, source_media_registry: [SRC("SYN-PHOTO-1")] });   // unrelated source in registry
  assert.equal(r.status, SOURCE_MEDIA_STATUS.SOURCE_REQUIRED);
  assert.equal(r.bindings.length, 0);
});
test("30. mode/source compatibility enforced (negative: SOURCE_MODE_MISMATCH)", () => {
  assert.equal(isModeSourceCompatible("PRODUCT_VISUAL_PLUS_LAYOUT", "PRODUCT_IMAGE"), true);
  assert.equal(isModeSourceCompatible("ILLUSTRATION_PLUS_TYPE", "ILLUSTRATION"), true);
  assert.equal(isModeSourceCompatible("ILLUSTRATION_PLUS_TYPE", "PRODUCT_IMAGE"), false);
  assert.equal(isModeSourceCompatible("DETERMINISTIC_TYPE_ONLY", "SUPPLIED_IMAGE"), true);   // no media burden
  const spec = day6MediaSpec("instagram|feed", { design_id: "SF-MODE", mode: "ILLUSTRATION_PLUS_TYPE", source_id: "SYN-PRODUCT-1" });
  const r = resolveSocialSourceMedia({ design_spec: spec, source_media_registry: [{ slot_id: "hero", ...SRC("SYN-PRODUCT-1") }] });
  assert.equal(r.status, SOURCE_MEDIA_STATUS.SOURCE_MODE_MISMATCH);
});
test("31. placement geometry is deterministic and reuses cover/contain × focal", () => {
  const box = { x: 0, y: 0, width: 600, height: 400 };
  const cover = sourceMediaPlacement({ source: SRC("SYN-PHOTO-1"), box, fit: "cover", focal: "top" });
  const contain = sourceMediaPlacement({ source: SRC("SYN-PHOTO-1"), box, fit: "contain", focal: "bottom" });
  assert.equal(cover.ok, true); assert.equal(contain.ok, true);
  assert.deepEqual(cover, sourceMediaPlacement({ source: SRC("SYN-PHOTO-1"), box, fit: "cover", focal: "top" }));
  assert.notDeepEqual(cover.placement, contain.placement);
  for (const focal of FOCALS) assert.equal(sourceMediaPlacement({ source: SRC("SYN-PHOTO-1"), box, fit: "cover", focal }).ok, true, focal);
});
test("32. invalid source placement rejected (no guessed dimensions)", () => {
  assert.equal(sourceMediaPlacement({ source: { width: 0, height: 10 }, box: { x: 0, y: 0, width: 5, height: 5 } }).status, SOURCE_MEDIA_STATUS.INVALID_MEDIA_DIMENSIONS);
});

// ---------- F. MEDIA-BEARING COMPOSITION -------------------------------------
const FAMILIES = [["IMAGE_DOMINANT", "instagram|feed"], ["FULL_BLEED", "instagram|feed"], ["SPLIT", "instagram|feed"], ["PRODUCT_HERO", "instagram|feed"], ["EDITORIAL", "instagram|feed"]];
for (const [family, profile] of FAMILIES) {
  test(`33-37. ${family} composes resolved media + typography (no silent drop)`, () => {
    const spec = day6MediaSpec(profile, { design_id: `SF-${family}`, layout_family: family });
    const { resolved, out } = composeWith(spec, [{ slot_id: "hero", ...SRC("SYN-PHOTO-1") }]);
    assert.equal(resolved.status, SOURCE_MEDIA_STATUS.READY);
    assert.equal(out.status, COMPOSITOR_STATUS.READY, JSON.stringify(out.checks.filter((c) => !c.pass)));
    assert.equal(/<image/.test(out.svg), true, "media embedded");
    assert.equal(HEAD(out), true, "approved headline still rendered");
    assert.ok(out.component_results.some((c) => c.component_type === "image_slot"));
    assert.ok(out.component_results.some((c) => c.component_type === "headline"));
  });
}
test("38. TYPE_DOMINANT remains fully functional without media (negative 30)", () => {
  const out = composeSocialStatic(DAY6_SPEC, T);
  assert.equal(out.status, COMPOSITOR_STATUS.READY);
  assert.equal(/<image/.test(out.svg), false);
  assert.equal(HEAD(out), true);
});
test("39. explicit z-order: media below scrim below typography (negative 37)", () => {
  const spec = day6MediaSpec("instagram|feed", { design_id: "SF-Z", layout_family: "FULL_BLEED", treatment: "scrim" });
  const { out } = composeWith(spec, [{ slot_id: "hero", ...SRC("SYN-PHOTO-1") }]);
  const z = (t) => out.component_results.find((c) => c.component_type === t)?.z_index;
  assert.ok(z("image_slot") < z("scrim"));
  assert.ok(z("scrim") < z("headline"));
  assert.ok(z("headline") < z("logo"));
});
test("40-41. scrim is token-controlled; no arbitrary colours/fonts (negatives 38-40)", () => {
  const spec = day6MediaSpec("instagram:feed".replace(":", "|"), { design_id: "SF-SCRIM", layout_family: "FULL_BLEED", treatment: "scrim" });
  const { out } = composeWith(spec, [{ slot_id: "hero", ...SRC("SYN-PHOTO-1") }]);
  const scrim = out.component_results.find((c) => c.component_type === "scrim");
  assert.ok(scrim && scrim.svg.includes(T.colors.scrim));
  const allowed = [...Object.values(T.colors), ...Object.values(T.color_extras)].map((c) => String(c).toLowerCase());
  for (const m of out.svg.matchAll(/#[0-9A-Fa-f]{6}/g)) assert.ok(allowed.includes(m[0].toLowerCase()), m[0]);
  for (const f of [...out.svg.matchAll(/font-family="([^"]+)"/g)].map((x) => x[1])) assert.ok(/DM Serif Display|Inter/.test(f), f);
});
test("42. required headline is never sourced from the image (negative 31)", () => {
  const spec = day6MediaSpec("instagram|feed", { design_id: "SF-TXT", layout_family: "IMAGE_DOMINANT" });
  const { out } = composeWith(spec, [{ slot_id: "hero", ...SRC("SYN-PHOTO-1") }]);
  const imageComponent = out.component_results.find((c) => c.component_type === "image_slot");
  assert.ok(!(imageComponent.visible_text || "").includes(DAY6_HEADLINE));
  assert.equal(svgVisibleText(out.svg).includes(DAY6_HEADLINE), true);   // deterministic typography provides it
  assert.equal(/\bocr\b|tesseract/i.test(readFileSync(join(root, "mae/media/social-source-media.js"), "utf8").replace(/^\s*\/\/.*$/gm, "")), false);
});
test("43. copy stays exact — no rewrite, no ellipsis (negatives 33,34)", () => {
  const spec = day6MediaSpec("instagram|feed", { design_id: "SF-COPY" });
  const { out } = composeWith(spec, [{ slot_id: "hero", ...SRC("SYN-PHOTO-1") }]);
  assert.ok(svgVisibleText(out.svg).includes(DAY6_HEADLINE));
  assert.equal(/…|\.\.\./.test(out.visible_text), false);
  assert.equal(spec.copy_blocks[0].text, DAY6_HEADLINE);
});

// ---------- G/H. PACKAGING + CROSS-PLACEMENT ---------------------------------
test("44. media-rich YouTube thumbnail is a complete SOCIAL_STATIC composition (negatives 50,54-56)", () => {
  const spec = day6MediaSpec("youtube|video_thumbnail", { design_id: "SF-YT", layout_family: "IMAGE_DOMINANT" });
  const { out } = composeWith(spec, [{ slot_id: "hero", ...SRC("SYN-PHOTO-1") }]);
  assert.equal(out.status, COMPOSITOR_STATUS.READY);
  assert.deepEqual([out.provenance.canvas.width, out.provenance.canvas.height], [1280, 720]);
  assert.equal(spec.asset_type, "SOCIAL_STATIC");
  assert.deepEqual([...ASSET_TYPES].filter((a) => /THUMBNAIL|VIDEO_COVER|REEL/.test(a)), []);
  const code = readFileSync(join(root, "mae/media/social-source-media.js"), "utf8").replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
});
test("45. same source across Instagram / YouTube / WhatsApp: same id + checksum, platform geometry (negatives 48-51,63,64)", () => {
  const targets = [["instagram", "feed", "FEED_PORTRAIT", 1080, 1350], ["youtube", "video_thumbnail", "THUMBNAIL", 1280, 720], ["whatsapp", "share_card", "SHARE_CARD", 1200, 630]];
  const ids = new Set(), sums = new Set(), canvases = new Set();
  for (const [platform, placement, format, w, h] of targets) {
    const adapted = adaptDesignSpecification({ spec: DAY6_SPEC, platform, placement, platform_format: format }).design_specification;
    const spec = { ...adapted, design_id: `SF-X-${platform}`, layout_family: "IMAGE_DOMINANT", production_mode: "PHOTO_PLUS_TYPE", visual_slots: [{ slot_id: "hero", media_type: "photo", required: true, fit: "cover", focal: "center", fallback: "TYPE_ONLY", source: { artifact_id: "SYN-PHOTO-1" } }] };
    const { out } = composeWith(spec, [{ slot_id: "hero", ...SRC("SYN-PHOTO-1") }]);
    assert.equal(out.status, COMPOSITOR_STATUS.READY, platform);
    assert.ok(HEAD(out), platform);
    assert.deepEqual([out.provenance.canvas.width, out.provenance.canvas.height], [w, h]);
    assert.equal(out.provenance.media[0].source_media_id, SRC("SYN-PHOTO-1").source_media_id);
    assert.equal(out.provenance.media[0].checksum, "SYN-CHK-PHOTO-1");
    ids.add(out.provenance.media[0].source_media_id); sums.add(out.provenance.media[0].checksum); canvases.add(`${w}x${h}`);
  }
  assert.equal(ids.size, 1); assert.equal(sums.size, 1); assert.equal(canvases.size, 3);
});
test("46. cover/contain/focal produce deterministic, differing crops (negatives 41-47)", () => {
  const box = { x: 0, y: 0, width: 600, height: 600 };
  const results = new Set();
  for (const fit of FITS) for (const focal of FOCALS) results.add(JSON.stringify(sourceMediaPlacement({ source: SRC("SYN-PHOTO-1"), box, fit, focal }).placement));
  assert.equal(results.size, FITS.length * FOCALS.length);
});
test("47. a changed source changes the composition's media provenance (negative 52)", () => {
  const spec = day6MediaSpec("instagram|feed", { design_id: "SF-CHG" });
  const a = composeWith(spec, [{ slot_id: "hero", ...SRC("SYN-PHOTO-1") }]).out;
  const b = composeWith(spec, [], { hero: "SYN-PRODUCT-1" }).out;
  assert.notEqual(a.provenance.media[0].checksum, b.provenance.media[0].checksum);
  assert.notEqual(a.provenance.media[0].source_media_id, b.provenance.media[0].source_media_id);
});
test("48. byte-identical repeats for the same inputs (negative 53)", () => {
  const spec = day6MediaSpec("instagram|feed", { design_id: "SF-BYTES" });
  const a = composeWith(spec, [{ slot_id: "hero", ...SRC("SYN-PHOTO-1") }]).out;
  const b = composeWith(spec, [{ slot_id: "hero", ...SRC("SYN-PHOTO-1") }]).out;
  assert.equal(a.svg, b.svg);
  assert.equal(JSON.stringify(a.provenance), JSON.stringify(b.provenance));
});
test("49. generated media flag derives from authoritative provenance only (negative 14)", () => {
  const gen = [{ slot_id: "hero", ...SRC("SYN-IMG-ART-1") }];
  const spec = day6MediaSpec("instagram|feed", { design_id: "SF-GEN", source_id: "SYN-IMG-ART-1" });
  const { out } = composeWith(spec, gen);
  assert.equal(out.provenance.generated_media, true);
  assert.equal(hasGeneratedMedia([{ source: SRC("SYN-IMG-ART-1") }]), true);
  assert.equal(hasSyntheticMedia([{ source: SRC("SYN-PHOTO-1") }]), true);
});

// ---------- I. MULTI-PANEL ---------------------------------------------------
test("50-53. mixed-media carousel: media + type-only panels coexist with independent refs (negatives 59-61)", () => {
  const spec = mixedMediaCarousel();
  assert.equal(validateSocialDesignSpec(spec).valid, true, JSON.stringify(validateSocialDesignSpec(spec).errors.slice(0, 3)));
  const a = assembleMultiPanel(spec, T);
  assert.equal(a.panel_count, 3);
  // per-panel specs mirror the assembler's derived CTA policy (a CTA belongs only to the ACT panel)
  const panelSpec = (i, id) => ({ ...spec, design_id: id, asset_type: "SOCIAL_STATIC", slides: undefined, slide_count: undefined, continuity_group: undefined, layout_family: spec.slides[i].layout_family, copy_blocks: spec.slides[i].copy_blocks, visual_slots: spec.slides[i].visual_slots ?? [], cta_policy: spec.slides[i].copy_blocks.some((b) => b.role === "cta") ? { required: true, copy_role: "cta", placement: "LAST_PANEL", prominence: "HIGH" } : { required: false, copy_role: null, placement: null, prominence: "NONE" } });
  const cover = composeWith(panelSpec(0, "SF-MC-P1"), [{ slot_id: "cover-image", ...SRC("SYN-PHOTO-1") }]).out;
  assert.equal(/<image/.test(cover.svg), true);
  const explain = composeWith(panelSpec(1, "SF-MC-P2"), []).out;
  assert.equal(explain.status, COMPOSITOR_STATUS.READY);
  assert.equal(/<image/.test(explain.svg), false);
  assert.equal(a.panels.length, 3);
  assert.deepEqual([...new Set(a.panels.map((p) => p.sequence_role))], ["COVER", "EXPLAIN", "ACT"]);
});
test("54. a failed media panel propagates (no silent drop) (negatives 62,74)", () => {
  const spec = mixedMediaCarousel();
  const a = assembleMultiPanel(spec, T);
  const panels = a.panels.map((p, i) => ({ rendered_artifact: { asset_type: "SOCIAL_STATIC", status: p.status, visible_text: p.visible_text, provenance: p.provenance }, layout_plan: p.layout_plan }));
  panels[0] = { rendered_artifact: { asset_type: "SOCIAL_STATIC", status: "SOURCE_REQUIRED" }, layout_plan: null };
  const r = evaluateSocialGraphic({ design_spec: spec, rendered_artifact: panels[0].rendered_artifact, truth_context: {} });
  assert.equal(r.status, "NOT_ELIGIBLE");
  assert.equal(a.panels.length, 3);
});

// ---------- J. QA INTEGRATION ------------------------------------------------
test("55. S-E activates imagery dimensions for generated media (negatives 63,64)", () => {
  const spec = day6MediaSpec("instagram|feed", { design_id: "SF-QA-GEN", source_id: "SYN-IMG-ART-1", layout_family: "IMAGE_DOMINANT" });
  const { out } = composeWith(spec, [{ slot_id: "hero", ...SRC("SYN-IMG-ART-1") }]);
  const qa = evaluateSocialGraphic({ design_spec: spec, rendered_artifact: { ...out, status: out.status, generated_media: out.provenance.generated_media, source_media_refs: out.provenance.media.map((m) => m.source_media_id) }, truth_context: { product: { safety_sensitive: false }, commerce: {} } });
  for (const id of ["VISUAL_GROUNDING_FIDELITY", "AI_ARTIFACTS", "ANATOMICAL_PLAUSIBILITY"]) assert.notEqual(qa.dimensions.find((d) => d.id === id).status, "NOT_APPLICABLE", id);
});
test("56. S-E still marks imagery dimensions N/A for type-only (negative 65)", () => {
  const out = composeSocialStatic(DAY6_SPEC, T);
  const qa = evaluateSocialGraphic({ design_spec: DAY6_SPEC, rendered_artifact: out });
  for (const id of ["VISUAL_GROUNDING_FIDELITY", "AI_ARTIFACTS", "ANATOMICAL_PLAUSIBILITY"]) assert.equal(qa.dimensions.find((d) => d.id === id).status, "NOT_APPLICABLE", id);
});
test("57. media never authorizes evidence in QA (negatives 21,22)", () => {
  const spec = { ...day6MediaSpec("instagram|feed", { design_id: "SF-EV" }), content_pattern: "TESTIMONIAL", evidence_requirements: [{ evidence_id: "SYN-MEDIA-1" }], copy_blocks: [{ role: "quote", text: "Synthetic quote" }] };
  const { out } = composeWith(spec, [{ slot_id: "hero", ...SRC("SYN-PHOTO-1") }]);
  const qa = evaluateSocialGraphic({ design_spec: spec, rendered_artifact: { ...out, source_media_refs: out.provenance.media.map((m) => m.source_media_id) }, evidence_context: { records: [{ evidence_id: "SYN-MEDIA-1", _fixture_origin: "synthetic" }] }, truth_context: {} });
  assert.equal(qa.evidence_authorization.status, "FAIL");
  assert.equal(qa.status, "FAIL");
});
test("58. unsupported visual claim remains S-E's responsibility (negative 66)", () => {
  const src = readFileSync(join(root, "mae/media/social-source-media.js"), "utf8");
  assert.ok(!/unsupported_visual_claim|UNSUPPORTED_VISUAL_CLAIM/.test(src));
});

// ---------- K. DAY-6 + OTHER FIXTURES ---------------------------------------
test("59-62. separate Day-6 media fixture; canonical type-only fixture untouched (negatives 83-85)", () => {
  const mediaSpec = day6MediaSpec("instagram|feed", { design_id: "SF-DAY6-MEDIA" });
  assert.equal(mediaSpec._fixture_origin, "synthetic");
  assert.equal(mediaSpec.copy_blocks[0].text, DAY6_HEADLINE);
  assert.equal(DAY6_SPEC.copy_blocks[0].text, DAY6_HEADLINE);
  assert.equal(DAY6_SPEC.visual_slots.length, 0);
  const { out } = composeWith(mediaSpec, [{ slot_id: "hero", ...SRC("SYN-PHOTO-1") }]);
  assert.equal(out.status, COMPOSITOR_STATUS.READY);
  assert.equal(HEAD(out), true);
  assert.equal(/statistic|testimonial|price/i.test(out.visible_text), false);
  assert.equal(/how to|exercise|stretch|technique/i.test(out.visible_text), false);
});
test("63. synthetic product fixture consumes PRODUCT_IMAGE with no inferred facts (negatives 23,94)", () => {
  const spec = productHeroSpec();
  const { out } = composeWith(spec, [{ slot_id: "product", ...SRC("SYN-PRODUCT-1") }]);
  assert.equal(out.status, COMPOSITOR_STATUS.READY, JSON.stringify(out.checks.filter((c) => !c.pass)));
  assert.ok(out.visible_text.includes("Synthetic Product"));
  assert.ok(out.visible_text.includes("USD 29"));       // supplied, not derived from the image
  assert.equal(out.provenance.media[0].source_type, "PRODUCT_IMAGE");
});
test("64. synthetic illustration fixture keeps classification and is not proof (negatives 24,95)", () => {
  const spec = illustrationSpec();
  const { out, resolved } = composeWith(spec, [{ slot_id: "art", ...SRC("SYN-ILLUSTRATION-1") }]);
  assert.equal(resolved.status, SOURCE_MEDIA_STATUS.READY);
  assert.equal(out.status, COMPOSITOR_STATUS.READY);
  assert.equal(out.provenance.media[0].source_type, "ILLUSTRATION");
  assert.equal(out.provenance.media[0].source_classification, "internal_illustration");
  assert.equal(out.provenance.media[0].generated, false);
});
test("65. resolved video-frame fixture composes a cover with no extraction (negatives 96,18,19)", () => {
  const spec = videoCoverSpec();
  const { out } = composeWith(spec, [{ slot_id: "frame", ...SRC("SYN-VIDEOFRAME-1") }]);
  assert.equal(out.status, COMPOSITOR_STATUS.READY, JSON.stringify(out.checks.filter((c) => !c.pass)));
  assert.equal(/<image/.test(out.svg), true);
  assert.equal(out.provenance.media[0].video_artifact_id, "SYN-VID-ART-1");
  assert.equal(out.provenance.media[0].frame_timestamp, 3.5);
});
test("66. mixed-media carousel manifest + panel refs are deterministic (negatives 97,71,72)", () => {
  const spec = mixedMediaCarousel();
  const a = assembleMultiPanel(spec, T);
  const b = assembleMultiPanel(spec, T);
  assert.equal(JSON.stringify(a.manifest), JSON.stringify(b.manifest));
  assert.deepEqual(a.panels.map((p) => p.slide_index), [1, 2, 3]);
  assert.equal(a.checks.every((c) => c.pass), true);
});
test("67. synthetic labels preserved everywhere (negative 98)", () => {
  assert.equal(SRC("SYN-PHOTO-1").synthetic, true);
  assert.equal(day6MediaSpec("instagram|feed", { design_id: "X" })._fixture_origin, "synthetic");
  assert.equal(productHeroSpec()._fixture_origin, "synthetic");
  assert.equal(illustrationSpec()._fixture_origin, "synthetic");
  assert.equal(videoCoverSpec()._fixture_origin, "synthetic");
  assert.equal(mixedMediaCarousel()._fixture_origin, "synthetic");
});
test("68. no provider/generation/raster calls anywhere in S-F (negatives 67-70)", () => {
  const strip = (s) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const src = strip(readFileSync(join(root, "mae/media/social-source-media.js"), "utf8"));
  for (const banned of ["openai", "gemini", "9router", "generateimage", "fetch(", "ffmpeg", "writefilesync"]) assert.ok(!src.toLowerCase().includes(banned), banned);
  const comp = strip(readFileSync(join(root, "mae/media/social-compositor.js"), "utf8"));
  for (const banned of ["ffmpeg", "generateImage", "fetch("]) assert.ok(!comp.includes(banned), banned);
});
test("69. social-source-media module is the only new S-F module (no engine explosion)", () => {
  assert.ok(existsSync(join(root, "mae/media/social-source-media.js")));
  for (const f of ["mae/media/social-image-engine.js", "mae/media/social-video-engine.js", "mae/media/social-media-database.js", "mae/services/social-asset-manager.js", "mae/media/thumbnail-image-engine.js"]) assert.ok(!existsSync(join(root, f)), f);
});
test("70. frozen image fixture hashes unchanged + no provider capability enabled", async () => {
  for (const f of loadFixtures()) assert.equal(computeFixtureHash(f), f.fixture_hash, f.fixture_id);
  const vp = await import("../media/video-provider.js");
  assert.equal(vp.videoGenerationStatus().available, false);
});

// ---- S-F regression pins: additive-only proof + the two traps found during the build ------------
const FROZEN_NO_MEDIA_STATIC = Object.freeze({
  TYPE_DOMINANT: "de8f353abd4de8e8f1325ecac9615efc30919f9b1c18318e6f5e60679cfd969d",
  SPLIT: "eb36001f49d15403d46974f3c6c33ae2cd742af4d211e33b0242537a5919348c",
  LIST: "433aa57e6cb39e82131ddbc68760aab2faade8ba79ea526752be7a4d2bb1294f",
  TWO_COLUMN: "31a2b2890c6fbfd28a4ad93b204aa436da107aad497d525761005033d9738af6",
  DATA_FOCUS: "51856cfcaaed511f7f1dc2c605577e54d46d80e406988ef53730391080c62e13",
  QUOTE_FOCUS: "da455e4d872cd5343cdc8c4ed07feb0a984b42658b0ff5298f20b8c5acc21b2f",
  PRODUCT_HERO: "63a9ce263419a16d227064f86a84613ea9bf1de7b6814c28dcd0b79aa2d07e3d",
  EDITORIAL: "045049b28b08c80847e43aa6a0bce2109908481ce8c4c7af775e85f8d4773da5",
});
const sha = (s) => createHash("sha256").update(s).digest("hex");

test("71. additive-only: every no-media static composition is byte-identical to the S-C/S-E behaviour", () => {
  for (const [fam, frozen] of Object.entries(FROZEN_NO_MEDIA_STATIC)) {
    const spec = day6MediaSpec("instagram|feed", { design_id: "FZ-" + fam, layout_family: fam });
    const out = composeSocialStatic(spec, T, { sources: [], bindings: [] });
    assert.equal(out.status, COMPOSITOR_STATUS.READY, fam);
    assert.equal(sha(out.svg), frozen, fam);
    assert.equal(out.provenance.media.length, 0, fam);
    assert.equal(out.provenance.generated_media, false, fam);
    assert.equal(out.provenance.synthetic_media, false, fam);
  }
});

test("72. media-less slot-only families draw the required headline instead of silently dropping it", () => {
  // HEAD (S-E) dropped required approved copy for IMAGE_DOMINANT / FULL_BLEED with no media bound.
  // S-F is additive here in the honest direction: required copy is never dropped; no media is invented.
  for (const fam of ["IMAGE_DOMINANT", "FULL_BLEED"]) {
    const spec = day6MediaSpec("instagram|feed", { design_id: "FZ-" + fam, layout_family: fam });
    const out = composeSocialStatic(spec, T, { sources: [], bindings: [] });
    assert.equal(/<image/.test(out.svg), false, fam);                       // no media invented
    assert.equal(out.provenance.media.length, 0, fam);
    assert.equal(svgVisibleText(out.svg).includes(DAY6_HEADLINE), true, fam); // required copy present
  }
});

test("73. media layer sits beneath scrim and typography (z-order), never above it", () => {
  for (const fam of ["IMAGE_DOMINANT", "FULL_BLEED"]) {
    const spec = day6MediaSpec("instagram|feed", { design_id: "ZO-" + fam, layout_family: fam, treatment: "scrim" });
    const r = resolveSocialSourceMedia({ design_spec: spec, source_media_registry: [{ slot_id: "hero", ...SRC("SYN-PHOTO-1") }] });
    const out = composeSocialStatic(spec, T, { sources: r.sources, bindings: r.bindings });
    assert.equal(out.status, COMPOSITOR_STATUS.READY, fam);
    const iImage = out.svg.indexOf("<image"), iHead = out.svg.indexOf("DM Serif Display");
    assert.ok(iImage > -1 && iHead > -1 && iImage < iHead, fam);
    const scrim = out.component_results.find((c) => c.component_type === "scrim");
    assert.ok(scrim && scrim.z_index > out.component_results.find((c) => c.component_type === "image_slot").z_index, fam);
  }
});

test("74. a bound source is never silently dropped in any family (no-region media becomes a back layer)", () => {
  for (const fam of [...STATIC_LAYOUT_FAMILIES, ...SLOT_ONLY_LAYOUT_FAMILIES]) {
    const spec = day6MediaSpec("instagram|feed", { design_id: "ND-" + fam, layout_family: fam });
    const r = resolveSocialSourceMedia({ design_spec: spec, source_media_registry: [{ slot_id: "hero", ...SRC("SYN-PHOTO-1") }] });
    const out = composeSocialStatic(spec, T, { sources: r.sources, bindings: r.bindings });
    assert.equal(out.provenance.media.length, 1, fam);
    assert.equal(/<image/.test(out.svg), true, fam);                      // provenance and artifact agree
    assert.equal(out.provenance.generated_media, false, fam);             // a synthetic fixture is not "generated"
    assert.equal(out.provenance.synthetic_media, true, fam);
  }
});