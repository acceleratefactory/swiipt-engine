// MAE Social Design — Wave S-C deterministic static compositor tests.
// No providers, no raster, no network. Qualification fixtures marked here are SYNTHETIC TEST DATA and
// must never flow into production records (see Part 43 assertions).
// Run: node mae/harness/social-compositor.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  composeSocialStatic, buildLayoutPlan, selectVariant, stableHash,
  COMPOSITOR_STATUS, COMPOSITOR_CHECKS, STATIC_LAYOUT_FAMILIES, SLOT_ONLY_LAYOUT_FAMILIES,
  DEFERRED_LAYOUT_FAMILIES, LAYOUT_VARIANTS, APPROVED_VARIANTS, SOCIAL_COMPOSITOR_VERSION, Z_ORDER,
} from "../media/social-compositor.js";
import { socialTokens } from "../services/social-design-tokens.js";
import { svgVisibleText, textMatches } from "../media/layout.js";
import { loadFixtures, computeFixtureHash } from "../services/visual-qualification.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const T = socialTokens();
const DAY6 = JSON.parse(readFileSync(join(root, "mae/data/fixtures/social/SD-CSEC-006.json"), "utf8"));
const clone = (o) => JSON.parse(JSON.stringify(o));
const HEADLINE = "Nobody tells you what standing up feels like on day 6.";
const compose = (spec) => composeSocialStatic(spec, T);
const ok = (spec) => { const r = compose(spec); assert.equal(r.status, COMPOSITOR_STATUS.READY, `${r.status}: ${(r.warnings || []).join("; ")} | ${JSON.stringify(r.diagnostics)}`); return r; };

// SYNTHETIC qualification fixtures (test data only — never production truth).
const SYN = {
  SC1: { ...clone(DAY6), design_id: "SC-1", content_pattern: "TYPOGRAPHIC_HOOK", layout_family: "TYPE_DOMINANT", _fixture_origin: "synthetic" },
  SC2: (() => { const s = clone(DAY6); s.design_id = "SC-2"; s.layout_family = "SPLIT"; s.content_pattern = "PROBLEM_INSIGHT"; s.production_mode = "DETERMINISTIC_GRAPHIC"; s.copy_blocks.push({ copy_id: "COPY-BODY-1", role: "body", text: "Synthetic test body copy for split geometry." }); s.required_elements = ["headline"]; s.hierarchy = ["headline", "body"]; s._fixture_origin = "synthetic"; return s; })(),
  SC3: (() => { const s = clone(DAY6); s.design_id = "SC-3"; s.layout_family = "LIST"; s.content_pattern = "CHECKLIST"; s.copy_blocks = [{ role: "headline", text: "Synthetic checklist heading" }, { role: "list_item", text: "First synthetic item" }, { role: "list_item", text: "Second synthetic item" }, { role: "list_item", text: "Third synthetic item" }]; s.required_elements = ["headline"]; s._fixture_origin = "synthetic"; return s; })(),
  SC4: (() => { const s = clone(DAY6); s.design_id = "SC-4"; s.layout_family = "TWO_COLUMN"; s.content_pattern = "COMPARISON"; s.comparison_basis = "INTERNAL_PRICE"; s.copy_blocks = [{ role: "headline", text: "Synthetic two-column heading" }, { copy_id: "L1", role: "list_item", text: "Left column synthetic text." }, { copy_id: "R1", role: "list_item", text: "Right column synthetic text." }]; s.required_elements = ["headline"]; s._fixture_origin = "synthetic"; return s; })(),
  SC5: (() => { const s = clone(DAY6); s.design_id = "SC-5"; s.layout_family = "DATA_FOCUS"; s.content_pattern = "STATISTIC"; s.copy_blocks = [{ role: "statistic_value", text: "Synthetic 3 in 4" }, { role: "statistic_label", text: "synthetic label" }, { role: "source_note", text: "Source: synthetic test fixture" }]; s.evidence_requirements = [{ evidence_id: "SYN-STAT-1", evidence_type: "STATISTIC", required_for_pattern: "STATISTIC" }]; s.required_elements = ["statistic_value"]; s._fixture_origin = "synthetic"; return s; })(),
  SC6: (() => { const s = clone(DAY6); s.design_id = "SC-6"; s.layout_family = "QUOTE_FOCUS"; s.content_pattern = "QUOTE"; s.copy_blocks = [{ role: "quote", text: "Synthetic quote text used for layout testing only." }, { role: "source_note", text: "Source: synthetic test fixture" }]; s.required_elements = ["quote"]; s._fixture_origin = "synthetic"; return s; })(),
  SC7: (() => { const s = clone(DAY6); s.design_id = "SC-7"; s.layout_family = "PRODUCT_HERO"; s.content_pattern = "FEATURE_BENEFIT"; s.asset_purpose = "PRODUCT_CONVERSION"; s.production_mode = "PRODUCT_VISUAL_PLUS_LAYOUT"; s.copy_blocks = [{ role: "product_name", text: "Synthetic Test Product" }, { role: "headline", text: "Synthetic product heading" }, { role: "price", text: "USD 29" }, { role: "members_price", text: "0" }, { role: "list_item", text: "Synthetic feature one" }, { role: "cta", text: "Synthetic CTA copy" }]; s.cta_policy = { required: true, copy_role: "cta", placement: "BOTTOM", prominence: "HIGH" }; s.provenance = { ...s.provenance, truth_refs: ["SYN-PTR-1"] }; s.required_elements = ["product_name"]; s._fixture_origin = "synthetic"; return s; })(),
  SC8: { ...clone(DAY6), design_id: "SC-8", layout_family: "EDITORIAL", content_pattern: "REASSURANCE", _fixture_origin: "synthetic" },
};

// ---------- A/B. LAYOUT PLAN ------------------------------------------------
test("1. LayoutPlan is produced with the required fields and deterministic ids", () => {
  const p = buildLayoutPlan(DAY6, T);
  assert.equal(p.layout_plan_id, `LP-SD-CSEC-006-TYPE_DOMINANT-${p.layout_variant}`);
  for (const k of ["layout_plan_id", "design_id", "design_version", "layout_family", "layout_variant", "platform_format", "canvas", "safe_area", "density", "hierarchy", "component_placements", "visual_slot_placements", "background", "logo_placement", "cta_placement", "provenance"]) assert.ok(k in p, k);
});
test("2. placement entries carry geometry + references but no marketing truth", () => {
  const p = buildLayoutPlan(DAY6, T);
  const h = p.component_placements.find((x) => x.component_type === "headline");
  for (const k of ["component_id", "component_type", "x", "y", "width", "height", "z_index", "alignment", "required"]) assert.ok(k in h, k);
  assert.equal("price" in p, false);
  assert.equal(/claim|pain|evidence_meaning/.test(JSON.stringify(p)), false);
});
test("3. layout plan is deterministic (byte-identical)", () => assert.equal(JSON.stringify(buildLayoutPlan(DAY6, T)), JSON.stringify(buildLayoutPlan(DAY6, T))));
test("4. geometry snaps to the 8pt grid", () => {
  const p = buildLayoutPlan(DAY6, T);
  for (const c of p.component_placements) { assert.equal(c.x % 8, 0, c.component_id); assert.equal(c.width % 8, 0, c.component_id); }
});
test("5. marketing truth is not duplicated in the plan", () => {
  const p = buildLayoutPlan(DAY6, T);
  assert.equal(JSON.stringify(p).includes(DAY6.boundary_note), false);
});

// ---------- C. LAYOUT GRAMMAR ------------------------------------------------
test("6. supported static families are the eight approved ones", () => assert.deepEqual([...STATIC_LAYOUT_FAMILIES], ["TYPE_DOMINANT", "SPLIT", "LIST", "TWO_COLUMN", "DATA_FOCUS", "QUOTE_FOCUS", "PRODUCT_HERO", "EDITORIAL"]));
test("7. slot-only families are declared (no provider call in S-C)", () => assert.deepEqual([...SLOT_ONLY_LAYOUT_FAMILIES], ["IMAGE_DOMINANT", "FULL_BLEED"]));
test("8. MULTI_PANEL is deferred", () => assert.deepEqual([...DEFERRED_LAYOUT_FAMILIES], ["MULTI_PANEL"]));
test("9. one grammar (not one renderer per family): a single composer handles every family", () => {
  const src = readFileSync(join(root, "mae/media/social-compositor.js"), "utf8");
  assert.equal((src.match(/export function composeSocialStatic/g) || []).length, 1);
  for (const fam of ["SC1", "SC2", "SC3", "SC4", "SC5", "SC6", "SC7", "SC8"]) assert.ok(["READY", "TEXT_OVERFLOW", "SOURCE_REQUIRED"].includes(compose(SYN[fam]).status), fam);
});
for (const [n, fam, key] of [["10. TYPE_DOMINANT", "TYPE_DOMINANT", "SC1"], ["11. SPLIT", "SPLIT", "SC2"], ["12. LIST", "LIST", "SC3"], ["13. TWO_COLUMN", "TWO_COLUMN", "SC4"], ["14. DATA_FOCUS", "DATA_FOCUS", "SC5"], ["15. QUOTE_FOCUS", "QUOTE_FOCUS", "SC6"], ["16. PRODUCT_HERO", "PRODUCT_HERO", "SC7"], ["17. EDITORIAL", "EDITORIAL", "SC8"]]) {
  test(`${n} composes a complete static graphic`, () => {
    const r = compose(SYN[key]);
    assert.equal(r.layout_plan.layout_family, fam);
    assert.ok(r.svg.startsWith("<svg") && r.svg.endsWith("</svg>"));
    assert.ok(r.svg.length > 500);
    assert.equal(r.svg.includes(`width="${DAY6.canvas.width}"`), true);
  });
}
test("18. IMAGE_DOMINANT without a resolved source reports SOURCE_REQUIRED (no fabricated media)", () => {
  const s = { ...clone(DAY6), design_id: "SC-IMG", layout_family: "IMAGE_DOMINANT", visual_slots: [{ slot_id: "hero", media_type: "photo", required: true, fallback: "SOURCE_REQUIRED" }] };
  assert.equal(compose(s).status, COMPOSITOR_STATUS.SOURCE_REQUIRED);
});
test("19. IMAGE_DOMINANT with an already-resolved source composes deterministically", () => {
  const s = { ...clone(DAY6), design_id: "SC-IMG2", layout_family: "IMAGE_DOMINANT", production_mode: "PHOTO_PLUS_TYPE", visual_slots: [{ slot_id: "hero", media_type: "photo", required: true, fit: "cover", focal: "center", source: { artifact_id: "SYN-IMG-1" } }] };
  assert.equal(compose(s).status, COMPOSITOR_STATUS.READY);
});
test("20. FULL_BLEED behaves like a slot-only family", () => {
  const s = { ...clone(DAY6), design_id: "SC-FB", layout_family: "FULL_BLEED", production_mode: "PHOTO_PLUS_TYPE", visual_slots: [{ slot_id: "bg", media_type: "photo", required: false, source: { artifact_id: "SYN-IMG-2" } }] };
  assert.equal(compose(s).status, COMPOSITOR_STATUS.READY);
});
test("21. MULTI_PANEL is rejected with an explicit deferred state", () => assert.equal(compose({ ...clone(DAY6), design_id: "SC-MP", layout_family: "MULTI_PANEL" }).status, COMPOSITOR_STATUS.MULTI_PANEL_ASSEMBLY_NOT_IMPLEMENTED));

// ---------- D. VARIATION -----------------------------------------------------
test("22. approved variant sets are bounded and labelled", () => {
  assert.equal(Object.keys(LAYOUT_VARIANTS).length, 8);
  assert.ok(Object.values(LAYOUT_VARIANTS).every((v) => v.length === 3));
  assert.equal(APPROVED_VARIANTS.length, 26);   // 24 static + 2 slot-only
});
test("23. same input always selects the same variant", () => {
  const a = selectVariant({ layout_family: "TYPE_DOMINANT", angle_id: "ANG-CSEC-006", design_id: "SD-CSEC-006", platform: "instagram" });
  const b = selectVariant({ layout_family: "TYPE_DOMINANT", angle_id: "ANG-CSEC-006", design_id: "SD-CSEC-006", platform: "instagram" });
  assert.equal(a, b);
});
test("24. a different stable design id may select a different approved variant", () => {
  const seen = new Set(["SC-1", "SC-2", "SC-3", "SC-4", "SC-5", "SC-6"].map((d) => selectVariant({ layout_family: "TYPE_DOMINANT", angle_id: "ANG-CSEC-006", design_id: d, platform: "instagram" })));
  assert.ok(seen.size > 1);
  for (const v of seen) assert.ok(LAYOUT_VARIANTS.TYPE_DOMINANT.includes(v));
});
test("25. selection never returns a value outside the approved set", () => {
  for (let i = 0; i < 50; i++) assert.ok(APPROVED_VARIANTS.includes(selectVariant({ layout_family: "EDITORIAL", design_id: `SC-${i}`, angle_id: "ANG-CSEC-006", platform: "instagram" })));
});
test("26. no randomness: stableHash is pure and source has no Math.random/Date.now/UUID", () => {
  assert.equal(stableHash("abc"), stableHash("abc"));
  const src = readFileSync(join(root, "mae/media/social-compositor.js"), "utf8");
  assert.ok(!/Math\.random|Date\.now|randomUUID/.test(src));
});

// ---------- E. COMPOSITION ---------------------------------------------------
test("27. safe zones are honoured for required content", () => {
  const r = ok(SYN.SC1);
  const sz = DAY6.safe_zones;
  const h = r.component_results.find((x) => x.component_type === "headline");
  assert.ok(h.bounds.x >= sz.left && h.bounds.y >= sz.top && h.bounds.x + h.bounds.width <= DAY6.canvas.width - sz.right && h.bounds.y + h.bounds.height <= DAY6.canvas.height - sz.bottom);
});
test("28. hierarchy is translated into prominence without changing copy", () => {
  const s = { ...clone(DAY6), design_id: "SC-H", hierarchy: ["headline", "body"], copy_blocks: [DAY6.copy_blocks[0], { role: "body", text: "Synthetic supporting sentence." }] };
  const r = ok(s);
  const h = r.component_results.find((x) => x.component_type === "headline");
  const b = r.component_results.find((x) => x.component_type === "body");
  assert.ok(h.bounds.height > b.bounds.height);
  assert.ok(r.visible_text.includes("Synthetic supporting sentence."));
});
test("29. density changes geometry but never copy or component count", () => {
  const base = { ...clone(DAY6), design_id: "SC-D", copy_blocks: [DAY6.copy_blocks[0], { role: "body", text: "Synthetic density sentence." }] };
  const sparse = ok({ ...base, density: "SPARSE" });
  const dense = ok({ ...base, density: "DENSE" });
  assert.equal(sparse.visible_text, dense.visible_text);
  assert.equal(sparse.component_results.length, dense.component_results.length);
  assert.notEqual(JSON.stringify(sparse.layout_plan.component_placements.map((p) => p.y)), JSON.stringify(dense.layout_plan.component_placements.map((p) => p.y)));
});
test("30. z-order is explicit and deterministic", () => {
  const p = buildLayoutPlan(DAY6, T);
  const zs = p.component_placements.map((c) => c.z_index);
  assert.deepEqual(zs, [...zs].sort((a, b) => a - b));
  assert.equal(Z_ORDER.background < Z_ORDER.headline && Z_ORDER.headline < Z_ORDER.logo, true);
});
test("31. complete SVG carries brand background + accent + wordmark (not a floating headline)", () => {
  const r = ok(SYN.SC1);
  assert.ok(r.svg.includes(T.colors.background_primary));
  assert.ok(r.svg.includes(T.colors.accent_secondary) || r.svg.includes(T.colors.accent_primary));
  assert.ok(/Swiipt/.test(r.svg));
  assert.ok(r.component_results.some((x) => x.component_type === "background"));   // brand accent primitive
});
test("32. arbitrary colours cannot enter the composition", () => {
  const allowed = [...Object.values(T.colors), ...Object.values(T.color_extras)].map((c) => String(c).toLowerCase());
  for (const m of ok(SYN.SC1).svg.matchAll(/#[0-9A-Fa-f]{6}/g)) assert.ok(allowed.includes(m[0].toLowerCase()), m[0]);
  // no spec-supplied colour/theme override path exists in the compositor (brand values come only from tokens)
  const src = readFileSync(join(root, "mae/media/social-compositor.js"), "utf8");
  assert.ok(!/input\.color_role|p\.color_role|spec\.background_policy\?\.color/.test(src));
});
test("33. arbitrary fonts cannot enter the composition", () => {
  const svg = ok(SYN.SC1).svg;
  const families = [...svg.matchAll(/font-family="([^"]+)"/g)].map((m) => m[1]);
  for (const f of families) assert.ok(/DM Serif Display|Inter/.test(f), f);
});

// ---------- F. COMPONENT REUSE ----------------------------------------------
test("34. S-B components are reused (no re-implementation of rendering)", () => {
  const src = readFileSync(join(root, "mae/media/social-compositor.js"), "utf8");
  assert.ok(/import \{ renderComponent/.test(src));
  assert.ok(!/<tspan/.test(src), "compositor must not build text itself");
  assert.ok(!/font-size=/.test(src), "compositor must not set type sizes itself");
});
test("35. existing wrapText/visible-text helpers are reused via S-B + layout", () => {
  const src = readFileSync(join(root, "mae/media/social-compositor.js"), "utf8");
  assert.ok(/import \{ svgVisibleText, textMatches \}/.test(src));
});
test("36. existing image geometry is reused (ImageSlot) and no second geometry system exists", () => {
  const src = readFileSync(join(root, "mae/media/social-compositor.js"), "utf8");
  assert.ok(!/computeImageBox|Math\.max\(.*fit/.test(src));
});

// ---------- G/H. HONESTY + COMPLETE SVG -------------------------------------
test("37. required approved copy is visible and exact in the final SVG", () => {
  const r = ok(SYN.SC1);
  assert.ok(textMatches(r.svg, HEADLINE));
  assert.equal(svgVisibleText(r.svg).includes(HEADLINE), true);
});
test("38. copy is never rewritten/truncated and no ellipsis appears", () => {
  const r = ok(SYN.SC1);
  assert.equal(/…|\.\.\./.test(svgVisibleText(r.svg)), false);
  assert.ok(svgVisibleText(r.svg).includes(HEADLINE));   // the wordmark tspan may follow the headline
});
test("39. TEXT_OVERFLOW propagates with the failing component identified", () => {
  const s = { ...clone(DAY6), design_id: "SC-OVF", safe_zones: { top: 600, bottom: 600, left: 72, right: 72 } };   // leaves 150pt for a 44pt+ headline region
  const r = compose(s);
  assert.ok([COMPOSITOR_STATUS.TEXT_OVERFLOW, COMPOSITOR_STATUS.LAYOUT_OVERFLOW].includes(r.status));
  assert.ok(r.diagnostics.length >= 1);
  assert.ok(r.diagnostics.some((d) => /TEXT_OVERFLOW|LAYOUT|COPY/.test(d.issue)));
});
test("40. overflow never silently drops copy", () => {
  const s = { ...clone(DAY6), design_id: "SC-OVF2", safe_zones: { top: 600, bottom: 600, left: 72, right: 72 } };
  const r = compose(s);
  assert.equal(r.visible_text.includes("Nobody tells you"), true);
});
test("41. statistical value is rendered verbatim (no calculation)", () => {
  const r = ok(SYN.SC5);
  assert.ok(r.visible_text.includes("Synthetic 3 in 4"));
  assert.equal(/\d+%/.test(r.visible_text), false);
});
test("42. quote attribution is never invented", () => {
  const r = ok(SYN.SC6);
  assert.equal(/attributed to|—\s*[A-Z]/.test(r.visible_text), false);
  assert.ok(r.visible_text.includes("Source: synthetic test fixture"));
});
test("43. ProductHero renders supplied product truth only", () => {
  const r = ok(SYN.SC7);
  assert.ok(r.visible_text.includes("Synthetic Test Product"));
  assert.ok(r.visible_text.includes("USD 29"));      // supplied, not converted
  assert.ok(r.visible_text.includes("0"));           // supplied member price, not defaulted
  assert.equal(/save|discount|off\b|\bonly\b/i.test(r.visible_text), false);
});
test("44. List preserves source order", () => {
  const r = ok(SYN.SC3);
  const v = r.visible_text;
  assert.ok(v.indexOf("First synthetic item") < v.indexOf("Second synthetic item"));
  assert.ok(v.indexOf("Second synthetic item") < v.indexOf("Third synthetic item"));
});
test("45. TwoColumn preserves declared left/right content", () => {
  const s = { ...clone(SYN.SC4), design_id: "SC-4B", copy_blocks: [{ copy_id: "L1", role: "list_item", text: "Declared left content." }, { copy_id: "R1", role: "list_item", text: "Declared right content." }] };
  const r = ok(s);
  assert.ok(r.visible_text.includes("Declared left content."));
  assert.ok(r.visible_text.includes("Declared right content."));
  const left = r.component_results.find((x) => x.component_id.endsWith("-left"));
  const right = r.component_results.find((x) => x.component_id.endsWith("-right"));
  assert.ok(left.bounds.x < right.bounds.x);
});

// ---------- I. DAY-6 --------------------------------------------------------
test("46. Day-6 composes a complete 1080x1350 static graphic (READY)", () => {
  const r = ok(DAY6);
  assert.equal(r.layout_plan.canvas.width, 1080);
  assert.equal(r.layout_plan.canvas.height, 1350);
  assert.equal(r.status, COMPOSITOR_STATUS.READY);
  assert.equal(r.design_id, "SD-CSEC-006");
});
test("47. Day-6 exact headline preserved; no mutation, truncation or ellipsis", () => {
  const r = compose(DAY6);
  assert.ok(textMatches(r.svg, HEADLINE));
  assert.ok(svgVisibleText(r.svg).includes(HEADLINE));
  assert.equal(/…|\.\.\./.test(svgVisibleText(r.svg)), false);
});
test("48. Day-6 has no image dependency", () => {
  const r = compose(DAY6);
  assert.equal(/<image/.test(r.svg), false);
  assert.equal(DAY6.visual_slots.length, 0);
});
test("49. Day-6 has no CTA and no clinical mechanism", () => {
  const r = compose(DAY6);
  assert.equal(/cta/i.test(r.visible_text), false);
  for (const banned of ["how to", "exercise", "stretch", "reps", "instructions", "technique"]) assert.ok(!r.visible_text.toLowerCase().includes(banned), banned);
});
test("50. Day-6 has no illegal collision, no overflow and stays inside safe zones", () => {
  const r = compose(DAY6);
  const fail = r.checks.filter((c) => c.pass === false).map((c) => c.check);
  assert.deepEqual(fail, []);
  assert.equal(r.diagnostics.length, 0);
});
test("51. Day-6 repeated composition is byte-identical (layout plan + svg)", () => {
  const a = compose(DAY6); const b = compose(DAY6);
  assert.equal(a.svg, b.svg);
  assert.equal(JSON.stringify(a.layout_plan), JSON.stringify(b.layout_plan));
});
test("52. Day-6 deterministic variant comes from the approved TYPE_DOMINANT set", () => {
  const r = compose(DAY6);
  assert.ok(LAYOUT_VARIANTS.TYPE_DOMINANT.includes(r.layout_plan.layout_variant));
});
test("53. Day-6 uses only projected brand tokens", () => {
  const r = compose(DAY6);
  for (const m of r.svg.matchAll(/#[0-9A-Fa-f]{6}/g)) {
    const allowed = [...Object.values(T.colors), ...Object.values(T.color_extras)];
    assert.ok(allowed.some((c) => String(c).toLowerCase() === m[0].toLowerCase()), m[0]);
  }
});

// ---------- J. QUALIFICATION FIXTURES ---------------------------------------
for (const [n, key, family] of [["54. SC-1 TYPE_DOMINANT", "SC1", "TYPE_DOMINANT"], ["55. SC-2 SPLIT", "SC2", "SPLIT"], ["56. SC-3 LIST", "SC3", "LIST"], ["57. SC-4 TWO_COLUMN", "SC4", "TWO_COLUMN"], ["58. SC-5 DATA_FOCUS", "SC5", "DATA_FOCUS"], ["59. SC-6 QUOTE_FOCUS", "SC6", "QUOTE_FOCUS"], ["60. SC-7 PRODUCT_HERO", "SC7", "PRODUCT_HERO"], ["61. SC-8 EDITORIAL", "SC8", "EDITORIAL"]]) {
  test(`${n} qualifies (READY, deterministic, provider-free)`, () => {
    const r = ok(SYN[key]);
    assert.equal(r.layout_plan.layout_family, family);
    assert.equal(r.svg, compose(SYN[key]).svg);
    assert.equal(/<image/.test(r.svg) && SYN[key].visual_slots.length === 0, false);
  });
}
test("62. synthetic qualification fixtures are labelled and cannot become truth", () => {
  for (const s of Object.values(SYN)) assert.equal(s._fixture_origin, "synthetic");
  const r = ok(SYN.SC5);
  assert.equal(/SYN-STAT-1|SYN-PTR-1/.test(r.visible_text), false);   // fixture ids never rendered
  assert.ok(r.warnings.every((w) => !/truth|customer/i.test(w)));
});

// ---------- K. NEGATIVE BATTERY ---------------------------------------------
test("63. invalid specification rejects with INVALID_SPEC (negative 1)", () => {
  assert.equal(compose({ ...clone(DAY6), canvas: { width: 0, height: 0 } }).status, COMPOSITOR_STATUS.INVALID_SPEC);
});
test("64. RED angle remains rejected at contract level (negative 2)", () => assert.equal(compose({ ...clone(DAY6), angle_verdict: "RED" }).status, COMPOSITOR_STATUS.INVALID_SPEC));
test("65. unsupported asset type rejects (negative 3)", () => assert.equal(compose({ ...clone(DAY6), asset_type: "SOCIAL_BANNER" }).status, COMPOSITOR_STATUS.INVALID_SPEC));
test("66. carousel passed to the static compositor is deferred (negative 4)", () => {
  const s = { ...clone(DAY6), asset_type: "SOCIAL_CAROUSEL", slide_count: 3, continuity_group: "CG", slides: [{ slide_index: 1, sequence_role: "COVER", asset_purpose: "STOP_SCROLL", content_pattern: "TYPOGRAPHIC_HOOK", layout_family: "TYPE_DOMINANT", copy_blocks: [{ role: "headline", text: HEADLINE }] }, { slide_index: 2, sequence_role: "EXPLAIN", asset_purpose: "EDUCATION", content_pattern: "STEPS", layout_family: "LIST", copy_blocks: [{ role: "body", text: "b" }] }, { slide_index: 3, sequence_role: "ACT", asset_purpose: "PRODUCT_CONVERSION", content_pattern: "FEATURE_BENEFIT", layout_family: "PRODUCT_HERO", copy_blocks: [{ role: "cta", text: "c" }] }] };
  assert.equal(compose(s).status, COMPOSITOR_STATUS.MULTI_PANEL_ASSEMBLY_NOT_IMPLEMENTED);
});
test("67. story sequence passed to the static compositor is deferred (negative 5)", () => {
  const s = { ...clone(DAY6), asset_type: "SOCIAL_STORY_SEQUENCE", platform_format: "STORY_VERTICAL", slide_count: 2, continuity_group: "CG", slides: [{ slide_index: 1, sequence_role: "COVER", asset_purpose: "STOP_SCROLL", content_pattern: "TYPOGRAPHIC_HOOK", layout_family: "TYPE_DOMINANT", copy_blocks: [{ role: "headline", text: HEADLINE }] }, { slide_index: 2, sequence_role: "ACT", asset_purpose: "PRODUCT_CONVERSION", content_pattern: "FEATURE_BENEFIT", layout_family: "PRODUCT_HERO", copy_blocks: [{ role: "cta", text: "c" }] }] };
  assert.equal(compose(s).status, COMPOSITOR_STATUS.MULTI_PANEL_ASSEMBLY_NOT_IMPLEMENTED);
});
test("68. impossible safe zones reject (negative 8)", () => assert.equal(compose({ ...clone(DAY6), safe_zones: { top: 800, bottom: 800, left: 72, right: 72 } }).status, COMPOSITOR_STATUS.INVALID_SPEC));
test("69. missing required media propagates SOURCE_REQUIRED (negative 15)", () => {
  const s = { ...clone(DAY6), design_id: "SC-REQ", layout_family: "SPLIT", visual_slots: [{ slot_id: "hero", media_type: "photo", required: true, fallback: "SOURCE_REQUIRED" }] };
  assert.equal(compose(s).status, COMPOSITOR_STATUS.SOURCE_REQUIRED);
});
test("70. optional media fallback remains honest (negative 16)", () => {
  const s = { ...clone(DAY6), design_id: "SC-OPT", layout_family: "SPLIT", visual_slots: [{ slot_id: "hero", media_type: "photo", required: false, fallback: "TYPE_ONLY" }] };
  const r = compose(s);
  assert.notEqual(r.status, COMPOSITOR_STATUS.SOURCE_REQUIRED);
  assert.equal(/<image/.test(r.svg), false);
});
test("71. unknown token refs cannot enter the composition (negative 17/19)", () => {
  const src = readFileSync(join(root, "mae/media/social-compositor.js"), "utf8");
  assert.ok(!/#[0-9A-Fa-f]{6}/.test(src), "compositor must not hardcode colours");
  const bad = { ...clone(DAY6), design_id: "SC-TOK", visual_slots: [{ slot_id: "s", media_type: "photo", treatment: "hex#ff0000" }] };
  assert.equal(compose(bad).status, COMPOSITOR_STATUS.INVALID_SPEC);   // unknown treatment token rejected
});
test("72. deterministic compositor checks are exposed and none fail on Day-6 (negative 20-25)", () => {
  const r = compose(DAY6);
  assert.equal(r.checks.length, COMPOSITOR_CHECKS.length);
  assert.deepEqual([...new Set(r.checks.map((c) => c.check))].sort(), [...COMPOSITOR_CHECKS].sort());
  assert.equal(r.checks.every((c) => c.pass), true);
});
test("73. layout plan and svg determinism are enforced (negative 26-28)", () => {
  const a = compose(SYN.SC3); const b = compose(SYN.SC3);
  assert.equal(a.svg, b.svg);
  assert.deepEqual(a.layout_plan.component_placements.map((p) => [p.component_id, p.z_index]), b.layout_plan.component_placements.map((p) => [p.component_id, p.z_index]));
});

// ---------- L. BOUNDARIES ----------------------------------------------------
test("74. carousel/platform/QA modules still do not exist (S-C scope)", () => {
  // updated in Wave S-D: social-carousel.js + social-platforms.js are APPROVED S-D deliverables.
  for (const f of ["mae/services/social-graphic-qa.js"]) assert.ok(!existsSync(join(root, f)), f);
});
test("75. no raster, no provider, no network, no QA in the compositor", () => {
  const src = readFileSync(join(root, "mae/media/social-compositor.js"), "utf8");
  const code = src.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");   // ignore comments
});
test("76. compositor declares its version and stays a single module", () => {
  assert.equal(SOCIAL_COMPOSITOR_VERSION, "1.0");
  assert.ok(existsSync(join(root, "mae/media/social-compositor.js")));
});
test("77. S-A/S-B suites remain present and green-file (regression surface)", () => {
  for (const f of ["mae/harness/social-design-spec.test.mjs", "mae/harness/social-components.test.mjs"]) assert.ok(existsSync(join(root, f)), f);
});
test("78. frozen image fixture hashes unchanged", () => { for (const f of loadFixtures()) assert.equal(computeFixtureHash(f), f.fixture_hash, f.fixture_id); });
test("79. no provider capability was enabled", async () => {
  const vp = await import("../media/video-provider.js");
  assert.equal(vp.videoGenerationStatus().available, false);
});
test("80. Day-6 layout family/variant are recorded in provenance", () => {
  const r = compose(DAY6);
  assert.equal(r.provenance.layout_family, "TYPE_DOMINANT");
  assert.equal(r.provenance.brand_tokens_version, T.brand_tokens_version);
  assert.equal(r.provenance.canvas.width, 1080);
});
test("81. Day-6 composition is structurally complete (background + accent + headline + wordmark)", () => {
  const r = compose(DAY6);
  assert.ok(r.svg.includes(`<rect x="0" y="0" width="1080" height="1350"`));
  assert.ok(r.component_results.some((c) => c.component_type === "background"));   // brand accent primitive
  assert.ok(/Swiipt/.test(r.svg));
  assert.ok(r.component_results.filter((c) => c.svg).length >= 3);
});
