// MAE Visual Compositor — deterministic tests. No provider, no network, no AI image.
// Run: node mae/harness/compositor.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAjv, schemaId } from "../lib/schema.js";
import { Compositor, CompositorQA, fixtureImage, COMPOSITOR_VERSION } from "../media/compositor.js";
import { renderSvg, textMatches, svgVisibleText, computeImageBox, resolveSlotBox, IMAGE_FITS } from "../media/layout.js";
import { RenderSpecs } from "../media/render-specs.js";
import { PROVIDER_STATE } from "../media/providers.js";
import { Router } from "../media/router.js";
import { csecCompositorDryRun, csecVisualFoundation, csecApprovedFamily } from "./fixtures.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const scene = () => fixtureImage("vf-scene-01");
const wide = () => fixtureImage("vf-wide-02");

const specWithImage = (slotOver = {}) => RenderSpecs.layoutRender({
  headline: "Day 6.", body_copy: "Stand without bracing.", cta: "Reply YES",
  image_slots: [{ slot_id: "bg", role: "BACKGROUND", source: { uri: scene().uri, mime: scene().mime, width: scene().width, height: scene().height }, fit: "cover", focal: "center", ...slotOver }],
  overlay: { type: "gradient", color: "#0B1F33", opacity: 0.45, direction: "bottom" },
});

// 1
test("1. image-backed LayoutRenderSpec renders", () => {
  const out = renderSvg(specWithImage(), { filename: "cp-1.svg" });
  assert.equal(out.mime_type, "image/svg+xml");
  assert.equal(out.has_background_image, true);
});
// 2
test("2. background image is actually present in the SVG", () => {
  const out = renderSvg(specWithImage(), { filename: "cp-2.svg" });
  assert.ok(out.svg.includes("<image "));
  assert.ok(out.svg.includes("data:image/svg+xml;base64,"));
});
// 3
test("3. image slot coordinates are respected", () => {
  const out = renderSvg(specWithImage({ position: { x: 100, y: 200, width: 400, height: 300 } }), { filename: "cp-3.svg" });
  assert.ok(out.svg.includes('x="100" y="200" width="400" height="300"'), "clip rect uses the slot position");
  const box = resolveSlotBox({ position: { x: 100, y: 200, width: 400, height: 300 } }, { w: 1080, h: 1350 });
  assert.deepEqual(box, { x: 100, y: 200, w: 400, h: 300 });
});
// 4
test("4. cover fit works", () => {
  const b = computeImageBox(1080, 1350, { x: 0, y: 0, w: 1080, h: 1350 }, "cover", "center");
  assert.equal(b.w, 1080); assert.equal(b.h, 1350);
});
// 5
test("5. contain fit works", () => {
  const b = computeImageBox(1200, 630, { x: 0, y: 0, w: 1080, h: 1350 }, "contain", "center");
  assert.equal(b.w, 1080); assert.ok(b.h < 1350, "contain letterboxes");
});
// 6
test("6. deterministic crop / focal position works", () => {
  const box = { x: 0, y: 0, w: 1080, h: 608 };
  const top = computeImageBox(1080, 1350, box, "cover", "top");
  const bottom = computeImageBox(1080, 1350, box, "cover", "bottom");
  assert.notEqual(top.y, bottom.y);
  assert.deepEqual(computeImageBox(1080, 1350, box, "cover", "top"), top);
});
// 7
test("7. overlay emitted when specified", () => {
  const out = renderSvg(specWithImage(), { filename: "cp-7.svg" });
  assert.ok(out.svg.includes("swt-overlay"));
  assert.equal(out.overlay.type, "gradient");
});
// 8
test("8. overlay absent when not specified", () => {
  const out = renderSvg(RenderSpecs.layoutRender({ headline: "H", overlay: { type: "none" } }), { filename: "cp-8.svg" });
  assert.ok(!out.svg.includes("url(#swt-overlay)"));
});
// 9
test("9. headline exact", () => {
  const out = renderSvg(specWithImage(), { filename: "cp-9.svg" });
  assert.equal(textMatches(out.svg, "Day 6."), true);
});
// 10
test("10. body exact", () => {
  const out = renderSvg(specWithImage(), { filename: "cp-10.svg" });
  assert.equal(textMatches(out.svg, "Stand without bracing."), true);
});
// 11
test("11. CTA exact", () => {
  const out = renderSvg(specWithImage(), { filename: "cp-11.svg" });
  assert.ok(out.svg.includes("Reply YES"));
});
// 12
test("12. locked text verification passes", () => {
  const out = renderSvg(specWithImage(), { filename: "cp-12.svg" });
  assert.ok(svgVisibleText(out.svg).includes("Day 6."));
});
// 13
test("13. manipulated locked copy fails verification", () => {
  const out = renderSvg(specWithImage(), { filename: "cp-13.svg" });
  assert.equal(textMatches(out.svg, "Day 7."), false);
});
// 14
test("14. text overflow blocks/fails", () => {
  assert.throws(() => renderSvg(RenderSpecs.layoutRender({ headline: "word ".repeat(200) }), { filename: "cp-14.svg" }), /TEXT_OVERFLOW/);
});
// 15
test("15. safe-zone violation blocks/fails", () => {
  assert.throws(() => renderSvg(RenderSpecs.layoutRender({ headline: "Short", safe_area: { top: 1200, bottom: 96, left: 96, right: 96 } }), { filename: "cp-15.svg" }), /TEXT_OVERFLOW/);
});
// 16
test("16. correct canvas dimensions", () => {
  const out = renderSvg(specWithImage(), { filename: "cp-16.svg" });
  assert.equal(out.width, 1080); assert.equal(out.height, 1350);
  const story = renderSvg(RenderSpecs.layoutRender({ canvas: "story", headline: "H" }), { filename: "cp-16b.svg" });
  assert.equal(story.width, 1080); assert.equal(story.height, 1920);
});
// 17
test("17. checksum generated", () => {
  const out = renderSvg(specWithImage(), { filename: "cp-17.svg" });
  assert.equal(out.checksum.length, 64);
});
// 18
test("18. same input produces deterministic output (same checksum)", () => {
  const a = renderSvg(specWithImage(), { filename: "cp-18a.svg" });
  const b = renderSvg(specWithImage(), { filename: "cp-18b.svg" });
  assert.equal(a.checksum, b.checksum);
});
// 19
test("19. visual_grounding_id retained", () => {
  const f = csecCompositorDryRun();
  assert.equal(f.artifact.visual_grounding_id, "VG-CSEC-006");
});
// 20
test("20. visual_asset_spec_id retained", () => {
  const f = csecCompositorDryRun();
  assert.equal(f.artifact.visual_asset_spec_id, "VAS-CSEC-006");
});
// 21
test("21. source image reference retained", () => {
  const f = csecCompositorDryRun();
  assert.ok(f.artifact.source_image_reference && f.artifact.source_image_reference.endsWith("vf-scene-01.svg"));
  assert.equal(f.artifact.source_image_artifact_id, "FIXIMG-VF-SCENE-01");
});
// 22
test("22. provider/model/cost remain honest not-run states", () => {
  const f = csecCompositorDryRun();
  assert.equal(f.artifact.provider, "internal-compositor");
  assert.equal(f.artifact.model, null);
  assert.equal(f.artifact.cost, null);
  assert.equal(f.artifact.latency_ms, null);
  assert.equal(f.artifact.compositor_version, COMPOSITOR_VERSION);
});
// 23
test("23. existing typographic-only SVG path still passes", () => {
  const out = renderSvg(RenderSpecs.layoutRender({ headline: "At 3 AM she has to stand.", body_copy: "Module 2.", cta: "Reply YES" }), { filename: "cp-23.svg" });
  assert.equal(textMatches(out.svg, "At 3 AM she has to stand."), true);
  assert.equal(out.has_background_image, false);
  assert.ok(!out.svg.includes("<image "));
});
// 24
test("24. Day-6 compound visual dry run passes", () => {
  const f = csecCompositorDryRun();
  assert.equal(f.qa.pass, true, JSON.stringify(f.qa.checks.filter((c) => !c.pass)));
  assert.equal(f.composed.out.has_background_image, true);
  assert.equal(f.composed.out.overlay.type, "gradient");
});
// 25
test("25. Asset Family compatibility remains intact", () => {
  const fam = csecApprovedFamily();
  assert.equal(fam.family.id, "FAM-CSEC-006");
  const f = csecCompositorDryRun();
  const ajv = getAjv();
  assert.equal(ajv.validate(schemaId("media-artifact.schema.json"), f.artifact), true, JSON.stringify(ajv.errors));
  assert.ok(existsSync(f.artifact.storage_uri));
});
// 26
test("26. no external provider call occurs", () => {
  for (const rel of ["mae/media/compositor.js", "mae/media/layout.js"]) {
    const src = readFileSync(join(root, rel), "utf8");
    assert.ok(!/fetch\s*\(/.test(src), `${rel} must not call fetch`);
    assert.ok(!/href="https?:/i.test(src), `${rel} must not reference remote image URLs (data URIs only)`);
  }
});
// 27
test("27. no image-generation call occurs (provider stays dormant)", () => {
  assert.equal(Router.route("GENERATED_SCENE").available, false);
  assert.equal(Router.route("GENERATED_SCENE").state, PROVIDER_STATE.PROVIDER_UNAVAILABLE);
  assert.ok(IMAGE_FITS.includes("cover") && IMAGE_FITS.includes("contain"));
});
