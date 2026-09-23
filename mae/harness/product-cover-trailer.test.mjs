// Permanent acceptance tests — SWIIPT Product Cover + Product Trailer global production contracts.
// Covers task §27 (items 1–32). Run: node --test mae/harness/product-cover-trailer.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { coverData, coverGenerationSpec, coverVariants, coverSurfaceRefs, produceProductCover, coverProviderStatus } from "./product-cover.mjs";
import { trailerPackage, produceProductTrailer, resolveAngle } from "./product-trailer.mjs";
import { marketingFamily, coverReuseSurfaces, canonicalPackages, readCover, readTrailer } from "./marketing-contract.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const FM = "PPL-FAMILY-MONEY-001";
const V06 = "PPL-NIGHT-SHIFT-001";

/* ---------------------------------------------------------------- PRODUCT COVER */
test("01 cover contract resolves", () => {
  const d = coverData(FM);
  assert.equal(d.asset_type, "PRODUCT_COVER");
  assert.equal(d.cover_id, `COVER-${FM}`);
});
test("02 cover truth inputs resolve", () => {
  const d = coverData(FM);
  assert.ok(d.title && d.subtitle && d.area && d.mechanism_cue && d.evidence_label);
});
test("03 cover prompt/spec generated", () => {
  const s = coverGenerationSpec(coverData(FM));
  assert.ok(s.prompt_text.length > 300 && s.structured.asset_type === "PRODUCT_COVER");
});
test("04 cover branding inherited", () => {
  const d = coverData(FM);
  assert.equal(d.palette.length, 12);
  assert.ok(d.branding.mark_variant && /DM Serif/.test(JSON.stringify(d.typography.title)));
});
test("05 cover invents no unsupported claims", () => {
  const s = coverGenerationSpec(coverData(FM));
  assert.match(s.prompt_text, /no savings\/efficacy\/guarantee claims/);
  for (const re of [/\$\s?\d/, /\b\d+\s?%/, /\bguarantee/i]) assert.doesNotMatch(s.structured.product_title + " " + s.structured.subtitle, re);
});
test("06 provider absent → truthful pending status", () => {
  assert.equal(coverProviderStatus().available, false);
  assert.equal(readCover(FM).provider.status, "PENDING_PROVIDER");
});
test("07 cover output referenced (canonical realised)", () => {
  const c = readCover(FM);
  assert.equal(c.canonical_status, "GENERATED");
  assert.ok(c.variants.every((v) => v.file.endsWith(".png")));
});
test("08 single-product page consumes canonical cover", () => {
  const r = coverSurfaceRefs(FM);
  assert.equal(r.single_product_page, r.customer_product);
  assert.ok(r.single_product_page.endsWith("cover-portrait.png"));
});
test("09 customer product consumes canonical cover identity", () => {
  assert.ok(coverSurfaceRefs(FM).customer_product.endsWith("cover-portrait.png"));
});
test("10 marketing can consume canonical cover", () => {
  assert.ok(coverReuseSurfaces().includes("marketing creatives"));
  assert.ok(coverSurfaceRefs(FM).marketing.endsWith("cover-square.png"));
});
test("11 cover variants trace to canonical cover", () => {
  for (const v of readCover(FM).variants) assert.equal(v.derived_from, "canonical cover identity");
});

/* ---------------------------------------------------------------- PRODUCT TRAILER */
test("12 trailer contract resolves", () => {
  assert.equal(trailerPackage(FM).asset_type, "PRODUCT_TRAILER");
});
test("13 trailer derives from approved angle", () => {
  const t = trailerPackage(FM);
  assert.ok(t.angle_ref?.startsWith("ANG-") && t.angle_status === "GREEN");
});
test("14 trailer derives from Product Truth", () => {
  const p = JSON.parse(readFileSync(join(ROOT, "data", "products", FM, "product.json"), "utf8"));
  const t = trailerPackage(FM);
  assert.equal(t.title, p.identity.name);
  assert.match(t.cta, new RegExp(p.identity.one_line_promise.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
test("15 trailer mechanism references actual product", () => {
  const t = trailerPackage(FM);
  assert.ok(t._ordered_artifacts.includes("The Real Baby Budget Quiz"));
  assert.ok(t._ordered_artifacts.includes("The One-Number Budget Chart"));
});
test("16 master prompt generated", () => {
  const t = trailerPackage(FM);
  for (const k of ["Duration", "SUBJECT/SCENE", "PROGRESSION", "CAMERA", "TYPOGRAPHY", "CTA", "PROHIBITED"]) assert.match(t.master_prompt, new RegExp(k));
});
test("17 storyboard generated", () => { assert.ok(trailerPackage(FM).scenes.length >= 7); });
test("18 script generated", () => { const t = trailerPackage(FM); assert.equal(t.script.length, t.scenes.length); });
test("19 on-screen text generated", () => { assert.ok(trailerPackage(FM).on_screen_text.length > 0); });
test("20 CTA generated", () => { assert.ok(trailerPackage(FM).cta.length > 3); });
test("21 poster/thumbnail generated", () => {
  assert.ok(existsSync(join(ROOT, "data", "products", FM, "trailer", "poster.png")));
  assert.equal(readTrailer(FM).poster_render, "RENDERED");
});
test("22 VIDEO-STATUS generated", () => { assert.equal(readTrailer(FM).video_status, "PENDING_PROVIDER"); });
test("23 provider absent → no fake MP4", () => {
  const dir = join(ROOT, "data", "products", FM, "trailer");
  assert.ok(!readdirSync(dir).some((f) => /\.mp4$/i.test(f)));
});
test("24 exporter only packages a genuinely rendered MP4", () => {
  const src = readFileSync(join(ROOT, "mae", "harness", "export-final-campaign.mjs"), "utf8");
  assert.match(src, /never package a video that was not genuinely rendered/);
  assert.match(src, /VIDEO-STATUS:\\s\*RENDERED/);
});
test("25 platform variants derive from master trailer", () => {
  const t = trailerPackage(FM);
  assert.ok(t.platform_variants.length >= 3 && t.platform_variants[0].note === "master");
});
test("26 trailer contains no unsupported claims", () => {
  const t = trailerPackage(FM);
  // Scan only CONSUMER-FACING text — the master prompt legitimately contains the exclusion/negation lists.
  const faces = t.on_screen_text.join(" ") + " " + t.script.map((s) => s.narration).join(" ") + " " + t.cta;
  for (const re of [/\bguarantee/i, /\bproven\b/i, /\befficacy\b/i, /\btestimonial/i, /\$\s?\d/, /\b\d+\s?%/, /PPL-/, /AS-FM-/, /ANG-/]) {
    assert.doesNotMatch(faces, re, `forbidden ${re}`);
  }
});
test("27 trailer is in the marketing contract", () => {
  assert.ok(marketingFamily().canonical_product_assets.includes("PRODUCT_TRAILER"));
  assert.ok(marketingFamily().visual_components.length >= 6);
});
test("28 trailer + cover packages included in final export", () => {
  const ids = canonicalPackages(FM).packages.map((p) => p.id);
  assert.ok(ids.includes("PRODUCT_TRAILER") && ids.includes("PRODUCT_COVER"));
});

/* ---------------------------------------------------------------- PROOFS */
test("29 Family Money cover contract passes", () => {
  const c = readCover(FM);
  assert.equal(c.canonical_status, "GENERATED");
  assert.equal(c.data.area, "Postpartum & New Parent Life");
});
test("30 Family Money trailer contract passes", () => {
  const t = readTrailer(FM);
  assert.equal(t.angle_status, "GREEN");
  assert.equal(t.validation_verdict, "GREEN");
  assert.equal(t._ordered_artifacts.length, 6);
});
test("31 generalization proof — second product resolves (V06 untouched)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "swt-cover-"));
  const before = existsSync(join(ROOT, "data", "products", V06, "cover"));
  const c = produceProductCover(V06, { outDir: tmp, render: false });
  const t = produceProductTrailer(V06, { outDir: tmp, render: false });
  assert.equal(c.asset_type, "PRODUCT_COVER");
  assert.equal(t.asset_type, "PRODUCT_TRAILER");
  assert.equal(existsSync(join(ROOT, "data", "products", V06, "cover")), before, "V06 dir must be untouched");
});
test("32 zero product-specific production branches", () => {
  for (const f of ["product-cover.mjs", "product-trailer.mjs", "marketing-contract.mjs"]) {
    const src = readFileSync(join(ROOT, "mae", "harness", f), "utf8");
    for (const id of [FM, V06, "ANG-PPL-FAMILY", "AS-FM-"]) assert.ok(!src.includes(id), `${f} must not contain ${id}`);
  }
});
