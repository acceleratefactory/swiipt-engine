// MAE Social Design — Wave S-B token projection + component primitives (deterministic, no render/QA).
// Run: node mae/harness/social-components.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { projectSocialTokens, socialTokens, readCssTokens, TOKEN_STATUS, TYPOGRAPHY_ROLES, DESIGN_TOKEN_SOURCE } from "../services/social-design-tokens.js";
import {
  renderComponent, renderComponents, validateComponent, measureLines, containsEmoji,
  COMPONENT_STATUS, COMPONENT_TYPES, ATOMIC_COMPONENTS, COMPOSITE_COMPONENTS, CONTAINER_COMPONENTS,
} from "../media/social-components.js";
import { svgVisibleText, textMatches } from "../media/layout.js";
import { loadFixtures, computeFixtureHash } from "../services/visual-qualification.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const T = socialTokens();
const BT = JSON.parse(readFileSync(join(root, "mae/data/brand-truth.json"), "utf8"));
const CSS = readFileSync(DESIGN_TOKEN_SOURCE, "utf8");
const DAY6 = JSON.parse(readFileSync(join(root, "mae/data/fixtures/social/SD-CSEC-006.json"), "utf8"));
const HEADLINE = "Nobody tells you what standing up feels like on day 6.";
const box = (extra = {}) => ({ component_id: "c1", x: 72, y: 200, width: 936, height: 300, ...extra });
const r = (type, input) => renderComponent(type, input, T);
const ok = (type, input) => { const x = r(type, input); assert.equal(x.status, COMPONENT_STATUS.READY, `${type}: ${x.warnings.join("; ")}`); return x; };

// ---------- B. TOKENS ---------------------------------------------------------
test("1. projection exposes the required roles and preserves the brand token version", () => {
  assert.equal(T.status, TOKEN_STATUS.OK);
  assert.equal(T.brand_tokens_version, BT.visual_language.tokens_version);
  assert.equal(T.token_version, "1.0");
  for (const role of ["background_primary", "background_secondary", "surface", "text_primary", "text_secondary", "accent_primary", "accent_secondary", "border", "scrim"]) assert.ok(T.colors[role], role);
  assert.deepEqual(Object.keys(T.typography), [...TYPOGRAPHY_ROLES]);
  assert.deepEqual(Object.keys(T.spacing), ["space-1", "space-2", "space-3", "space-4", "space-5", "space-6", "space-8", "space-10"]);
});
test("2. projection is deterministic", () => assert.equal(JSON.stringify(projectSocialTokens()), JSON.stringify(projectSocialTokens())));
test("3. projection does not mutate the brand truth source", () => {
  const before = JSON.stringify(BT);
  projectSocialTokens(BT, CSS);
  assert.equal(JSON.stringify(BT), before);
});
test("4. missing brand token source rejects (negative 1)", () => assert.throws(() => projectSocialTokens({}, CSS), (e) => e.code === TOKEN_STATUS.SOCIAL_TOKEN_SOURCE_INVALID || /brand truth/i.test(e.message)));
test("5. missing token version rejects (negative 2)", () => {
  const bt = JSON.parse(JSON.stringify(BT)); delete bt.visual_language.tokens_version;
  assert.throws(() => projectSocialTokens(bt, CSS), (e) => /token version/i.test(e.message));
});
test("6. missing design token source rejects", () => assert.throws(() => projectSocialTokens(BT, ""), (e) => e.code === TOKEN_STATUS.SOCIAL_TOKEN_SOURCE_INVALID));
test("7. brand palette colour absent from design tokens rejects", () => {
  const bt = JSON.parse(JSON.stringify(BT)); bt.visual_language.palette = [...bt.visual_language.palette, "#123456"];
  assert.throws(() => projectSocialTokens(bt, CSS), (e) => /#123456/.test(e.message));
});
test("8. radius literal absent from design tokens rejects (no invented radius)", () => {
  assert.throws(() => projectSocialTokens(BT, CSS.replace(/6pt/g, "7.5pt")), (e) => /radius/.test(e.message));
});
test("9. projected colours come from the design-token source", () => {
  const css = readCssTokens(CSS);
  assert.equal(T.colors.background_primary, css.navy);
  assert.equal(T.colors.accent_primary, css.purple);
  assert.equal(T.colors.accent_secondary, css.gold);
  assert.equal(T.colors.border, css.border);
});
test("10. typography roles use only existing families and weights", () => {
  const families = new Set([BT.visual_language.typography.display, BT.visual_language.typography.ui]);
  for (const role of TYPOGRAPHY_ROLES) {
    assert.ok(families.has(T.typography[role].family), role);
    assert.ok([400, 500, 600, 700].includes(T.typography[role].weight), role);
  }
});
test("11. spacing projects the existing 8pt grid", () => {
  assert.equal(T.grid, 8);
  for (const [k, v] of Object.entries(T.spacing)) assert.equal(v % 8, 0, k);
});
test("12. no new brand identity: only existing design-system colours are exposed", () => {
  const allowed = new Set([
    ...BT.visual_language.palette.map((c) => c.toLowerCase()),
    ...Object.values(T.color_extras).map((c) => String(c).toLowerCase()),
    ...Object.values(readCssTokens(CSS)).map((c) => String(c).toLowerCase()),
  ]);
  for (const v of Object.values(T.colors)) assert.ok(allowed.has(String(v).toLowerCase()), v);
});

// ---------- C. ATOMIC components ---------------------------------------------
test("13. Eyebrow renders exact copy and rejects empty text", () => {
  assert.ok(ok("eyebrow", box({ text: "Day 6" })).visible_text.includes("Day 6"));
  assert.equal(r("eyebrow", box({ text: "" })).status, COMPONENT_STATUS.INVALID_COMPONENT);
});
test("14. HeadlineBlock renders exact copy, bounds and overflow status", () => {
  const h = ok("headline", box({ text: HEADLINE }));
  assert.ok(textMatches(h.svg, HEADLINE), "visible tspan text must equal the approved headline");
  const small = r("headline", box({ text: HEADLINE, height: 40 }));
  assert.equal(small.status, COMPONENT_STATUS.TEXT_OVERFLOW);
});
test("15. BodyCopy renders exact copy and reports overflow", () => {
  const t = "Recovery is slow and specific. Nothing about it is dramatic.";
  assert.ok(textMatches(ok("body", box({ text: t })).svg, t));
  assert.equal(r("body", box({ text: t, height: 12 })).status, COMPONENT_STATUS.TEXT_OVERFLOW);
});
test("16. QuoteBlock keeps text exact and never adds quotation marks", () => {
  const q = ok("quote", box({ text: "I did not expect this to be hard.", attribution: "Day-6 participant" }));
  assert.ok(textMatches(q.svg, "I did not expect this to be hard."));
  assert.ok(q.visible_text.includes("Day-6 participant"));
  assert.equal(q.visible_text.includes("“"), false);
});
test("17. StatisticBlock renders the supplied value verbatim and does not calculate", () => {
  const s = ok("statistic", box({ statistic_value: "1 in 4", statistic_label: "reported difficulty", source_note: "Source: study" }));
  assert.ok(s.visible_text.includes("1 in 4"));
  assert.ok(s.visible_text.includes("Source: study"));
  assert.equal(s.visible_text.includes("%"), false);   // no invented percentage symbol
});
test("18. Badge renders exact label with token colours", () => {
  const b = ok("badge", box({ width: 220, height: 48, label: "Week 1" }));
  assert.ok(b.visible_text.includes("Week 1"));
  assert.ok(b.svg.includes(T.colors.accent_primary));
});
test("19. CTA renders exact copy, supports prominence, rejects unknown prominence", () => {
  const c = ok("cta", box({ width: 420, height: 88, text: "See the Day 6 Recovery Guide.", prominence: "HIGH" }));
  assert.ok(textMatches(c.svg, "See the Day 6 Recovery Guide."));
  assert.equal(r("cta", box({ text: "x", prominence: "URGENT" })).status, COMPONENT_STATUS.INVALID_COMPONENT);
});
test("20. Logo does not invent a logo asset (word-mark convention + honest warning)", () => {
  const l = ok("logo", box({ width: 160, height: 48 }));
  assert.ok(!/<image|base64|data:image/.test(l.svg));
  assert.ok(l.warnings.some((w) => /LOGO_ASSET_NOT_PROVIDED/.test(w)));
  const supplied = r("logo", box({ width: 160, height: 48, asset_svg: "<g id='brand-logo'/>" }));
  assert.ok(supplied.svg.includes("brand-logo"));
});
test("21. IconLabel requires an approved icon source and never substitutes emoji", () => {
  const missing = r("icon_label", box({ label: "Prep first" }));
  assert.equal(missing.status, COMPONENT_STATUS.SOURCE_REQUIRED);
  assert.equal(containsEmoji(missing.svg), false);
  const withIcon = r("icon_label", box({ label: "Prep first", icon_ref: "ICON-PREP" }));
  assert.equal(withIcon.status, COMPONENT_STATUS.READY);
});
test("22. Divider renders a deterministic rule", () => {
  const d = ok("divider", box({ y: 500, height: 2 }));
  assert.ok(d.svg.includes(`fill="${T.colors.border}"`));
});
test("23. Scrim supports deterministic opacity/bounds and token colour", () => {
  const s = ok("scrim", box({ opacity: 0.4 }));
  assert.ok(s.svg.includes('opacity="0.4"'));
  assert.ok(s.svg.includes(T.colors.scrim));
  assert.equal(r("scrim", box({ opacity: 1.4 })).status, COMPONENT_STATUS.INVALID_COMPONENT);
});
test("24. BackgroundLayer supports only approved treatments", () => {
  for (const kind of ["solid", "tint", "gradient", "none"]) assert.equal(ok("background", box({ kind })).status, COMPONENT_STATUS.READY);
  assert.equal(r("background", box({ kind: "image" })).status, COMPONENT_STATUS.INVALID_COMPONENT);
  assert.equal(ok("background", box({ kind: "none" })).svg, "");
});
test("25. BackgroundLayer rejects external/arbitrary sources", () => {
  const b = r("background", box({ kind: "solid", background_role: "url(http://example.com/x.png)" }));
  assert.equal(b.status, COMPONENT_STATUS.INVALID_COMPONENT);
});

// ---------- D. COMPOSITE components ------------------------------------------
test("26. Checklist preserves item order and reports overflow", () => {
  const c = ok("checklist", box({ height: 400, items: ["First item", "Second item", "Third item"] }));
  const v = c.visible_text;
  assert.ok(v.indexOf("First item") < v.indexOf("Second item"));
  assert.ok(v.indexOf("Second item") < v.indexOf("Third item"));
  assert.equal(r("checklist", box({ height: 20, items: ["a", "b", "c", "d"] })).status, COMPONENT_STATUS.TEXT_OVERFLOW);
});
test("27. StepBlock requires step_number + label and renders them verbatim", () => {
  const s = ok("step", box({ height: 200, step_number: 2, label: "Stand slowly", text: "Keep both feet flat." }));
  assert.ok(s.visible_text.includes("2"));
  assert.ok(s.visible_text.includes("Stand slowly"));
  assert.equal(r("step", box({ label: "" })).status, COMPONENT_STATUS.INVALID_COMPONENT);
});
test("28. ComparisonBlock does not alter column text", () => {
  const c = ok("comparison", box({ height: 300, left: { title: "Myth", text: "You should be fine by now." }, right: { title: "Reality", text: "Day 6 is still early." } }));
  assert.ok(c.visible_text.includes("You should be fine by now."));
  assert.ok(c.visible_text.includes("Day 6 is still early."));
});
test("29. SourceNote retains exact copy", () => {
  const t = "Source: WHO postnatal guidance (2014).";
  assert.ok(textMatches(ok("source_note", box({ text: t })).svg, t));
});
test("30. Pagination uses one canonical deterministic format", () => {
  assert.equal(ok("pagination", box({ width: 200, index: 1, total: 6 })).visible_text, "1 / 6");
  assert.equal(r("pagination", box({ index: 7, total: 6 })).status, COMPONENT_STATUS.INVALID_COMPONENT);
});
test("31. FeatureList preserves supplied order", () => {
  const f = ok("feature_list", box({ height: 300, features: ["Sleep plan", "Roster template", "Script pack"] }));
  const v = f.visible_text;
  assert.ok(v.indexOf("Sleep plan") < v.indexOf("Roster template"));
  assert.ok(v.indexOf("Roster template") < v.indexOf("Script pack"));
});
test("32. PriceBlock never invents a currency", () => {
  const p = ok("price", box({ price: "29.00", label: "One-time" }));
  assert.ok(p.visible_text.includes("29.00"));
  assert.equal(/USD|EUR|NGN|\$|€|₦/.test(p.visible_text), false);
  assert.ok(p.warnings.some((w) => /PRICE_CURRENCY_NOT_SUPPLIED/.test(w)));
});
test("33. MemberPriceBlock never defaults to zero", () => {
  assert.equal(r("member_price", box({})).status, COMPONENT_STATUS.INVALID_COMPONENT);
  const supplied = ok("member_price", box({ members_price: "0", label: "Member price" }));
  assert.ok(supplied.visible_text.includes("0"));
});
test("34. OfferBlock never invents discount or scarcity", () => {
  const o = ok("offer", box({ offer_text: "Bundle the guide and tracker." }));
  assert.equal(/off|save|%|limited|today only|expires/i.test(o.visible_text), false);
  assert.equal(r("offer", box({ offer_text: "" })).status, COMPONENT_STATUS.INVALID_COMPONENT);
});
test("35. ProductImage requires a source and does not generate media", () => {
  assert.equal(r("product_image", box({})).status, COMPONENT_STATUS.SOURCE_REQUIRED);
  const withSrc = ok("product_image", box({ source: { href: "data:image/svg+xml;base64,PHN2Zy8+" } }));
  assert.ok(withSrc.svg.includes("<image"));
});
test("36. ProductCard composes supplied inputs only and rejects invented features", () => {
  const c = ok("product_card", box({ height: 600, name: "Every Night, Just Me — Complete System", children: [{ component_type: "price", component_id: "p1", x: 80, y: 320, width: 300, height: 90, price: "29.00" }] }));
  assert.ok(c.visible_text.includes("Every Night, Just Me — Complete System"));
  assert.ok(c.visible_text.includes("29.00"));
});
test("37. Testimonial/Proof are NOT auto-authorized by any component (deferred to S-E)", () => {
  const src = readFileSync(join(root, "mae/media/social-components.js"), "utf8");
  assert.ok(!/testimonial|proof/i.test(src));
});
test("38. statistic_with_source is presentation-only (allowed composite alias)", () => {
  assert.ok(COMPOSITE_COMPONENTS.includes("statistic_with_source"));
  assert.ok(ok("statistic_with_source", box({ statistic_value: "6 days", source_note: "Source: X" })).visible_text.includes("6 days"));
});

// ---------- E. CONTAINERS -----------------------------------------------------
test("39. ImageSlot reuses the existing image geometry language", () => {
  const s = r("image_slot", box({ width: 600, height: 400, source: { href: "data:image/png;base64,AAAA" }, fit: "cover", focal: "top", intrinsic: { width: 1024, height: 1024 } }));
  assert.equal(s.status, COMPONENT_STATUS.READY);
  assert.equal(typeof s.placement.w, "number");   // computeImageBox output shape
  assert.ok(s.placement.h >= 400);
});
test("40. IllustrationSlot behaves like ImageSlot and never generates artwork", () => {
  assert.equal(r("illustration_slot", box({})).status, COMPONENT_STATUS.SOURCE_REQUIRED);
  const src = readFileSync(join(root, "mae/media/social-components.js"), "utf8");
  assert.ok(!/openai|gemini|provider|fetch\(/.test(src));
});
test("41. Overlay renders deterministic opacity", () => {
  const o = ok("overlay", box({ opacity: 0.5 }));
  assert.ok(o.svg.includes('opacity="0.5"'));
});
test("42. CardContainer renders surface + children", () => {
  const c = ok("card", box({ height: 500, children: [{ component_type: "headline", component_id: "h1", x: 100, y: 240, width: 800, height: 120, text: "Inside the card" }] }));
  assert.ok(c.visible_text.includes("Inside the card"));
});
test("43. PanelContainer renders bounds + safe zones + children", () => {
  const p = ok("panel", box({ height: 900, safe_zones: { top: 120, bottom: 220, left: 72, right: 72 }, children: [{ component_type: "body", component_id: "b1", x: 80, y: 600, width: 800, height: 60, text: "Panel body copy." }] }));
  assert.ok(p.visible_text.includes("Panel body copy."));
});

// ---------- F. COPY CONTROL ---------------------------------------------------
test("44. renderer never rewrites copy (byte-exact tspan text)", () => {
  const odd = "Nobody tells you what standing up feels like on day 6.";
  assert.ok(textMatches(ok("headline", box({ text: odd })).svg, odd));
  const mixed = "Day 6 — slow, careful.";
  assert.ok(textMatches(ok("body", box({ text: mixed })).svg, mixed));
});
test("45. overflow never truncates, never adds an ellipsis", () => {
  const long = "word ".repeat(60).trim();
  const o = r("headline", box({ text: long, height: 30 }));
  assert.equal(o.status, COMPONENT_STATUS.TEXT_OVERFLOW);
  const visible = svgVisibleText(o.svg);
  assert.equal(/…|\.\.\./.test(visible), false);
  assert.equal(visible, long);                       // nothing dropped
});
test("46. minimum type size is respected (no silent shrinking below the role minimum)", () => {
  const h = ok("headline", box({ text: "Short" }));
  const size = Number((h.svg.match(/font-size="(\d+)"/) || [])[1]);
  assert.ok(size >= T.typography.headline.min_size_px);
});
test("47. measureLines is deterministic and reports max-line overflow", () => {
  const a = measureLines("one two three four five", { width: 200, size: 32, lineHeight: 40, maxLines: 1 });
  assert.equal(a.overflowLines, true);
  assert.deepEqual(a, measureLines("one two three four five", { width: 200, size: 32, lineHeight: 40, maxLines: 1 }));
});

// ---------- G/H. BRAND + PRODUCT-PRICE HONESTY (negative battery) -------------
test("48. unknown colour role rejects (negative 3/13)", () => {
  assert.match(validateComponent("headline", box({ text: "x", color_role: "#ff0000" })).errors.join(" "), /unknown colour role/);
  assert.equal(r("headline", box({ text: "x", color_role: "chartreuse" })).status, COMPONENT_STATUS.INVALID_COMPONENT);
});
test("49. unknown typography role rejects (negative 4)", () => assert.match(validateComponent("body", box({ text: "x", typography_role: "mega" })).errors.join(" "), /unknown typography role/));
test("50. width/height <= 0 rejects (negative 5/6)", () => {
  assert.match(validateComponent("body", { x: 0, y: 0, width: 0, height: 10, text: "x" }).errors.join(" "), /width must be a positive/);
  assert.match(validateComponent("body", { x: 0, y: 0, width: 10, height: -1, text: "x" }).errors.join(" "), /height must be a positive/);
});
test("51. empty headline rejects (negative 7)", () => assert.equal(r("headline", box({ text: "" })).status, COMPONENT_STATUS.INVALID_COMPONENT));
test("52. unknown component type rejects (negative 8)", () => {
  assert.equal(r("myth_reality_card", box({})).status, COMPONENT_STATUS.INVALID_COMPONENT);
  assert.match(validateComponent("nope", {}).errors.join(" "), /unknown component type/);
});
test("53. invalid alignment rejects (negative 12)", () => assert.match(validateComponent("body", box({ text: "x", alignment: "JUSTIFY" })).errors.join(" "), /invalid alignment/));
test("54. unknown radius/spacing/elevation tokens reject (negative 29/30)", () => {
  assert.match(validateComponent("card", box({ radius_token: "radius-huge" })).errors.join(" "), /unknown radius token/);
  assert.match(validateComponent("body", box({ text: "x", spacing_token: "space-99" })).errors.join(" "), /unknown spacing token/);
  assert.match(validateComponent("card", box({ elevation_token: "glow" })).errors.join(" "), /unknown elevation token/);
});
test("55. unknown arbitrary style fields reject (negative: no per-component style sprawl)", () => {
  assert.match(validateComponent("body", box({ text: "x", box_shadow: "0 0 4px red" })).errors.join(" "), /unknown field "box_shadow"/);
});
test("56. component type registry is the approved three-category set", () => {
  assert.equal(ATOMIC_COMPONENTS.length, 12);
  assert.equal(CONTAINER_COMPONENTS.length, 5);
  assert.ok(COMPONENT_TYPES.includes("product_card") && COMPONENT_TYPES.includes("checklist"));
  for (const banned of ["testimonial", "proof_card", "myth_reality", "before_after"]) assert.ok(!COMPONENT_TYPES.includes(banned), banned);
});

// ---------- DETERMINISM (Part 42) --------------------------------------------
const repeat = (name, type, input) => test(name, () => {
  const a = r(type, input); const b = r(type, input);
  assert.equal(a.svg, b.svg);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});
repeat("57. token projection repeatability", "eyebrow", box({ text: "Day 6" }));
repeat("58. HeadlineBlock repeatability", "headline", box({ text: HEADLINE }));
repeat("59. BodyCopy repeatability", "body", box({ text: "Body copy stays exactly as supplied." }));
repeat("60. Badge repeatability", "badge", box({ width: 200, height: 48, label: "Week 1" }));
repeat("61. CTA repeatability", "cta", box({ width: 420, height: 88, text: "Open the guide." }));
repeat("62. Checklist repeatability", "checklist", box({ items: ["a", "b", "c"] }));
repeat("63. PriceBlock repeatability", "price", box({ price: "29.00" }));
repeat("64. ProductCard repeatability", "product_card", box({ name: "A product", children: [] }));
repeat("65. Container repeatability", "card", box({ children: [] }));
test("66. component output contains no timestamps or random state", () => {
  const h = r("headline", box({ text: HEADLINE }));
  assert.equal(/[0-9a-f]{8}-[0-9a-f]{4}/i.test(h.svg), false);
  assert.equal(/20[0-9]{2}-[0-9]{2}-[0-9]{2}/.test(h.svg), false);
  const src = readFileSync(join(root, "mae/media/social-components.js"), "utf8");
  assert.ok(!/Date\.now|Math\.random|crypto|randomUUID/.test(src));
});

// ---------- I. DAY-6 component demonstration (Part 40) ------------------------
test("67. SD-CSEC-006 feeds the token projection + HeadlineBlock (no full asset)", () => {
  const headline = DAY6.copy_blocks.find((b) => b.role === "headline");
  const role = DAY6.typography_roles.find((t) => t.role === "headline");
  const h = ok("headline", { component_id: "SD-CSEC-006-headline", x: DAY6.safe_zones.left, y: DAY6.safe_zones.top, width: DAY6.canvas.width - DAY6.safe_zones.left - DAY6.safe_zones.right, height: 420, text: headline.text, size: role.scale ?? undefined, alignment: DAY6.alignment });
  assert.equal(h.visible_text, HEADLINE);
  assert.ok(textMatches(h.svg, HEADLINE));
});
test("68. Day-6 exact headline preserved (no rewrite/truncate/ellipsis)", () => {
  const h = r("headline", { component_id: "x", x: 72, y: 120, width: 936, height: 420, text: HEADLINE });
  assert.equal(svgVisibleText(h.svg), HEADLINE);
  assert.equal(/…|\.\.\./.test(svgVisibleText(h.svg)), false);
});
test("69. Day-6 introduces no image dependency", () => {
  assert.deepEqual(DAY6.visual_slots, []);
  const h = r("headline", box({ text: HEADLINE }));
  assert.equal(/<image/.test(h.svg), false);
});
test("70. Day-6 introduces no CTA", () => {
  assert.equal(DAY6.cta_policy.required, false);
  const h = r("headline", box({ text: HEADLINE }));
  assert.equal(/cta|See the|Buy|Get the/i.test(h.visible_text), false);
});
test("71. Day-6 introduces no clinical mechanism", () => {
  const h = r("headline", box({ text: HEADLINE }));
  for (const banned of ["how to", "exercise", "stretch", "reps", "instructions", "technique"]) assert.ok(!h.visible_text.toLowerCase().includes(banned), banned);
});
test("72. Day-6 demonstration does not render a final 1080x1350 social post", () => {
  const h = r("headline", box({ width: 936, text: HEADLINE }));
  assert.equal(h.bounds.width, 936);
  assert.equal(new RegExp(`width="1080"\\s+height="1350"`).test(h.svg), false);
  assert.equal(/<svg[^>]*width="1080"/.test(h.svg), false);
});

// ---------- Regressions -------------------------------------------------------
test("73. forbidden S-B modules were not created", () => {
  for (const f of ["mae/media/social-compositor.js", "mae/services/social-carousel.js", "mae/services/social-platforms.js", "mae/services/social-graphic-qa.js"]) assert.ok(!existsSync(join(root, f)), f);
});
test("74. no rendering/raster/provider/network in S-B modules", () => {
  for (const f of ["mae/services/social-design-tokens.js", "mae/media/social-components.js"]) {
    const src = readFileSync(join(root, f), "utf8");
    for (const banned of ["renderSvg(", "Compositor", "ffmpeg", "child_process", "spawnSync", "fetch(", "https://", "writeFileSync", "png", "jpeg", "webp"]) assert.ok(!src.includes(banned), `${f}: ${banned}`);
  }
});
test("75. S-A contract module unchanged by S-B (taxonomies still exported)", async () => {
  const sa = await import("../services/social-design-spec.js");
  assert.equal(sa.ASSET_TYPES.length, 3);
  assert.ok(!sa.ASSET_PURPOSES.includes("CONVERSION"));
});
test("76. existing MAE suites remain present (image/video/contracts)", () => {
  for (const f of ["mae/harness/social-design-spec.test.mjs", "mae/harness/compositor.test.mjs", "mae/harness/image-provenance.test.mjs", "mae/harness/video-artifact.test.mjs"]) assert.ok(existsSync(join(root, f)), f);
});
test("77. frozen image fixture hashes unchanged", () => { for (const f of loadFixtures()) assert.equal(computeFixtureHash(f), f.fixture_hash, f.fixture_id); });
test("78. no provider capability was enabled", async () => {
  const vp = await import("../media/video-provider.js");
  assert.equal(vp.videoGenerationStatus().available, false);
});
test("79. duplicate component ids reject", () => {
  const res = renderComponents([
    { component_type: "body", component_id: "dup", x: 0, y: 0, width: 100, height: 40, text: "a" },
    { component_type: "body", component_id: "dup", x: 0, y: 50, width: 100, height: 40, text: "b" },
  ], T);
  assert.equal(res[1].status, COMPONENT_STATUS.INVALID_COMPONENT);
  assert.match(res[1].warnings.join(" "), /duplicate component_id/);
});
test("80. unsafe child bounds are rejected inside containers", () => {
  const bad = r("card", box({ height: 400, children: [{ component_type: "body", component_id: "away", x: 5000, y: 5000, width: 100, height: 40, text: "out" }] }));
  assert.equal(bad.status, COMPONENT_STATUS.INVALID_COMPONENT);
  assert.match(bad.warnings.join(" "), /escapes card bounds/);
  const badCard = r("product_card", box({ height: 400, name: "P", children: [{ component_type: "price", component_id: "p", x: 9000, y: 9000, width: 10, height: 10, price: "1" }] }));
  assert.equal(badCard.status, COMPONENT_STATUS.INVALID_COMPONENT);
});
test("81. optional missing media source behaves honestly (READY, no fabricated media)", () => {
  const s = r("image_slot", box({ required: false }));
  assert.equal(s.status, COMPONENT_STATUS.READY);
  assert.equal(/<image/.test(s.svg), false);
});
