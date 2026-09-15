// MAE Social Design — Wave S-D multi-panel (carousel + story sequence) tests.
// No providers, no network, no raster. SD-* fixtures are SYNTHETIC test data.
// Run: node mae/harness/social-carousel.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assembleMultiPanel, buildSlideSpecification, continuityChecks, SOCIAL_ASSEMBLER_VERSION, MULTI_PANEL_TYPES } from "../media/social-carousel.js";
import { composeSocialStatic, COMPOSITOR_STATUS } from "../media/social-compositor.js";
import { socialTokens } from "../services/social-design-tokens.js";
import { PROFILE_STATUS, PLATFORM_PROFILES, adaptDesignSpecification } from "../services/social-platforms.js";
import { validateSocialDesignSpec, ASSET_TYPES } from "../services/social-design-spec.js";
import { svgVisibleText } from "../media/layout.js";
import { DAY6_SPEC, DAY6_HEADLINE, syntheticFixture } from "./social-sd-fixtures.mjs";
import { loadFixtures, computeFixtureHash } from "../services/visual-qualification.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const T = socialTokens();
const clone = (o) => JSON.parse(JSON.stringify(o));
const CAR = () => syntheticFixture("SD-2");
const STORY = () => syntheticFixture("SD-3");
const asm = (spec) => assembleMultiPanel(spec, T);
const ok = (spec) => { const r = asm(spec); assert.equal(r.status, COMPOSITOR_STATUS.READY, `${r.status}: ${JSON.stringify(r.diagnostics)}`); return r; };
const CAROUSEL_ROLES = ["COVER", "CONTEXT", "IDENTIFY", "DEEPEN", "EXPLAIN", "REFRAME", "TEACH", "PROVE", "HELP", "RESOLVE", "ACT"];

// ---------- E. MULTI-PANEL CORE ---------------------------------------------
test("1. carousel assembles into per-panel complete SVGs (READY)", () => {
  const r = ok(CAR());
  assert.equal(r.asset_type, "SOCIAL_CAROUSEL");
  assert.equal(r.panel_count, 3);
  assert.equal(r.panels.length, 3);
  for (const p of r.panels) { assert.ok(p.svg.startsWith("<svg") && p.svg.endsWith("</svg>")); assert.equal(p.status, COMPOSITOR_STATUS.READY); }
});
test("2. story sequence assembles into frames using the same slide contract", () => {
  const r = ok(STORY());
  assert.equal(r.asset_type, "SOCIAL_STORY_SEQUENCE");
  assert.equal(r.panel_count, 2);
  assert.deepEqual(r.panels.map((p) => p.sequence_role), ["COVER", "ACT"]);
});
test("3. panel order is preserved (1-based ascending) and roles are honoured", () => {
  const r = ok(CAR());
  assert.deepEqual(r.panels.map((p) => p.slide_index), [1, 2, 3]);
  assert.deepEqual(r.panels.map((p) => p.sequence_role), ["COVER", "EXPLAIN", "ACT"]);
  assert.ok(r.checks.find((c) => c.check === "panel_order_preserved").pass);
});
test("4. the S-A slide contract is reused (no second frame schema)", () => {
  const src = readFileSync(join(root, "mae/media/social-carousel.js"), "utf8");
  assert.ok(!/StoryFrame|CarouselSlide\b|frameSchema/.test(src));
  const r = ok(CAR());
  assert.equal(r.panels[0].layout_plan.design_id, "SD-2-P1");
});
test("5. no rendering logic is reimplemented in the assembler", () => {
  const src = readFileSync(join(root, "mae/media/social-carousel.js"), "utf8");
  assert.ok(/import \{ composeSocialStatic/.test(src));
  assert.ok(!/<tspan|font-size=|renderComponent\(/.test(src));
});
test("6. panel copy is preserved exactly (no rewrite, no ellipsis)", () => {
  const r = ok(CAR());
  assert.ok(svgVisibleText(r.panels[0].svg).includes(DAY6_HEADLINE));
  assert.ok(r.panels[1].visible_text.includes("Synthetic middle panel copy."));
  assert.equal(/…|\.\.\./.test(r.panels[0].visible_text), false);
});
test("7. carousel pagination is deterministic and does not alter source copy", () => {
  const r = ok(CAR());
  const texts = r.panels.map((p) => p.visible_text);
  assert.ok(texts[0].includes("1 / 3"));
  assert.ok(texts[1].includes("2 / 3"));
  assert.ok(texts[2].includes("3 / 3"));
  assert.ok(texts[0].includes(DAY6_HEADLINE));           // pagination is additive design metadata
  const copy = CAR().slides[0].copy_blocks[0].text;
  assert.equal(r.panels[0].visible_text.includes(copy), true);
});
test("8. story frames are not paginated (carousel-only metadata)", () => {
  const r = ok(STORY());
  assert.equal(/\d+ \/ \d+/.test(r.panels[0].visible_text), false);
});
test("9. continuity checks pass across panels (tokens/profile/canvas/order)", () => {
  const r = ok(CAR());
  const checks = r.checks.map((c) => c.check);
  for (const c of ["same_brand_token_version", "same_profile", "same_profile_version", "same_canvas", "panel_order_preserved"]) assert.ok(checks.includes(c), c);
  assert.equal(r.checks.every((c) => c.pass), true, JSON.stringify(r.checks.filter((c) => !c.pass)));
});
test("10. brand token version and profile version are consistent across panels", () => {
  const r = ok(CAR());
  for (const p of r.panels) {
    assert.equal(p.provenance.brand_tokens_version, T.brand_tokens_version);
    assert.equal(p.provenance.profile_id, "instagram.carousel");
    assert.equal(p.provenance.profile_version, PLATFORM_PROFILES["instagram|carousel"].profile_version);
  }
});
test("11. the platform profile is resolved and recorded on the asset", () => {
  const r = ok(CAR());
  assert.deepEqual(r.platform_profile, { profile_id: "instagram.carousel", profile_version: "1.0" });
  assert.equal(r.provenance.platform_profile.profile_id, "instagram.carousel");
});

// ---------- F. MANIFEST ------------------------------------------------------
test("12. carousel manifest is complete and deterministic", () => {
  const a = ok(CAR()); const b = ok(CAR());
  assert.equal(JSON.stringify(a.manifest), JSON.stringify(b.manifest));
  for (const k of ["design_id", "continuity_group", "asset_type", "platform", "placement", "platform_format", "panel_count", "panel_ids", "sequence_roles", "layout_families", "copy_refs", "source_media_refs", "brand_tokens_version", "token_version", "profile_id", "profile_version", "assembler_version", "provenance"]) assert.ok(k in a.manifest, k);
  assert.equal(a.manifest.panel_count, 3);
  assert.deepEqual(a.manifest.sequence_roles, ["COVER", "EXPLAIN", "ACT"]);
  assert.equal(a.manifest.profile_id, "instagram.carousel");
  assert.equal(a.manifest.assembler_version, SOCIAL_ASSEMBLER_VERSION);
});
test("13. story manifest is deterministic", () => {
  const a = ok(STORY()); const b = ok(STORY());
  assert.equal(JSON.stringify(a.manifest), JSON.stringify(b.manifest));
  assert.equal(a.manifest.platform_format, "STORY_VERTICAL");
});
test("14. the manifest does not duplicate marketing truth", () => {
  const m = ok(CAR()).manifest;
  const blob = JSON.stringify(m);
  for (const banned of ["claim", "price", "testimonial", "statistic", "customer_pain", "angle_statement", "headline_text"]) assert.ok(!blob.includes(banned), banned);
});
test("15. panel SVGs and plans are byte-identical across repeated assembly", () => {
  const a = ok(CAR()); const b = ok(CAR());
  assert.equal(a.panels.map((p) => p.svg).join(""), b.panels.map((p) => p.svg).join(""));
  assert.equal(JSON.stringify(a.panels.map((p) => p.layout_plan)), JSON.stringify(b.panels.map((p) => p.layout_plan)));
});

// ---------- G. PANEL FAILURE -------------------------------------------------
test("16. a failing panel propagates and is NOT silently dropped (overflow)", () => {
  const s = CAR();
  s.slides[1].copy_blocks = [{ copy_id: "long", role: "body", text: "word ".repeat(200).trim() }];
  const r = asm(s);
  assert.notEqual(r.status, COMPOSITOR_STATUS.READY);
  assert.ok([COMPOSITOR_STATUS.TEXT_OVERFLOW, COMPOSITOR_STATUS.LAYOUT_OVERFLOW].includes(r.status));
  assert.equal(r.panels.length, 3);                                   // failed panel retained
  assert.notEqual(r.panels[1].status, COMPOSITOR_STATUS.READY);
  assert.ok(r.diagnostics.some((d) => d.panel === 2));
});
test("17. missing required source media on one panel propagates SOURCE_REQUIRED", () => {
  const s = CAR();
  s.slides[1].visual_slots = [{ slot_id: "s2", media_type: "photo", required: true, fallback: "SOURCE_REQUIRED" }];
  const r = asm(s);
  assert.equal(r.status, COMPOSITOR_STATUS.SOURCE_REQUIRED);
  assert.equal(r.panels.length, 3);
  assert.equal(r.panels[1].status, COMPOSITOR_STATUS.SOURCE_REQUIRED);
});

// ---------- NEGATIVE BATTERY (27–45) ----------------------------------------
test("18. carousel with fewer than 2 slides rejects (negative 27)", () => {
  const s = CAR(); s.slide_count = 1; s.slides = s.slides.slice(0, 1);
  assert.equal(asm(s).status, COMPOSITOR_STATUS.INVALID_SPEC);
});
test("19. carousel with more than 10 slides rejects (negative 28)", () => {
  const s = CAR(); s.slide_count = 11;
  s.slides = Array.from({ length: 11 }, (_, i) => ({ ...CAR().slides[0], slide_index: i + 1, sequence_role: i === 0 ? "COVER" : i === 10 ? "ACT" : "EXPLAIN" }));
  assert.equal(asm(s).status, COMPOSITOR_STATUS.INVALID_SPEC);
});
test("20. story with more than 6 frames rejects (negative 29)", () => {
  const s = STORY(); s.slide_count = 7;
  s.slides = Array.from({ length: 7 }, (_, i) => ({ ...STORY().slides[0], slide_index: i + 1, sequence_role: i === 0 ? "COVER" : i === 6 ? "ACT" : "CONTEXT" }));
  assert.equal(asm(s).status, COMPOSITOR_STATUS.INVALID_SPEC);
});
test("21. missing continuity_group rejects (negative 30)", () => { const s = CAR(); s.continuity_group = null; assert.equal(asm(s).status, COMPOSITOR_STATUS.INVALID_SPEC); });
test("22. slides.length mismatch rejects (negative 31)", () => { const s = CAR(); s.slide_count = 4; assert.equal(asm(s).status, COMPOSITOR_STATUS.INVALID_SPEC); });
test("23. duplicate slide indexes reject (negative 32)", () => { const s = CAR(); s.slides[1].slide_index = 1; assert.equal(asm(s).status, COMPOSITOR_STATUS.INVALID_SPEC); });
test("24. index gap rejects (negative 33)", () => { const s = CAR(); s.slides[1].slide_index = 9; assert.equal(asm(s).status, COMPOSITOR_STATUS.INVALID_SPEC); });
test("25. missing COVER rejects (negative 34)", () => { const s = CAR(); s.slides[0].sequence_role = "CONTEXT"; assert.equal(asm(s).status, COMPOSITOR_STATUS.INVALID_SPEC); });
test("26. missing ACT rejects (negative 35)", () => { const s = CAR(); s.slides[2].sequence_role = "RESOLVE"; assert.equal(asm(s).status, COMPOSITOR_STATUS.INVALID_SPEC); });
test("27. a static specification is rejected by the multi-panel assembler (negative: not multi-panel)", () => {
  assert.equal(asm(DAY6_SPEC).status, COMPOSITOR_STATUS.INVALID_SPEC);
});
test("28. an unsupported platform/placement on a carousel rejects honestly", () => {
  const s = CAR(); s.platform = "myspace"; s.placement = "carousel";
  assert.equal(asm(s).status, PROFILE_STATUS.UNSUPPORTED_PLATFORM_PLACEMENT);
});
test("29. carousel with a format the profile rejects rejects honestly", () => {
  const s = CAR(); s.platform_format = "STORY_VERTICAL";
  assert.equal(asm(s).status, PROFILE_STATUS.PLATFORM_PROFILE_MISMATCH);
});
test("30. assembler only accepts the two multi-panel asset types", () => {
  assert.deepEqual([...MULTI_PANEL_TYPES], ["SOCIAL_CAROUSEL", "SOCIAL_STORY_SEQUENCE"]);
  for (const t of ASSET_TYPES) assert.equal(MULTI_PANEL_TYPES.includes(t), t !== "SOCIAL_STATIC");
});

// ---------- LAYOUT FALLBACK IN PANELS ---------------------------------------
test("31. a panel whose layout family is disallowed uses the approved fallback and records it", () => {
  const s = CAR();
  s.slides[1].layout_family = "DATA_FOCUS";                       // prohibited by... instagram.carousel allows it -> use a thumbnail profile instead
  const youtube = { ...s, platform: "youtube", placement: "video_thumbnail", platform_format: "THUMBNAIL", canvas: { ...PLATFORM_PROFILES["youtube|video_thumbnail"].canvas }, safe_zones: { ...PLATFORM_PROFILES["youtube|video_thumbnail"].safe_zones } };
  const r = asm(youtube);
  assert.equal(r.status, COMPOSITOR_STATUS.READY, JSON.stringify(r.diagnostics));
  const p2 = r.panels[1];
  assert.notEqual(p2.provenance.layout_family, "DATA_FOCUS");
  assert.ok(PLATFORM_PROFILES["youtube|video_thumbnail"].layout_policy.allowed_layout_families.includes(p2.provenance.layout_family));
  assert.ok(p2.provenance.layout_fallback);
  assert.ok(r.diagnostics.some((d) => d.issue === "LAYOUT_FALLBACK"));
});

// ---------- H. DAY-6 CROSS-PLACEMENT ----------------------------------------
test("32. Day-6 adapts across Instagram feed / YouTube thumbnail / WhatsApp share card", () => {
  const targets = [["instagram", "feed", "FEED_PORTRAIT", 1080, 1350], ["youtube", "video_thumbnail", "THUMBNAIL", 1280, 720], ["whatsapp", "share_card", "SHARE_CARD", 1200, 630]];
  const seen = [];
  for (const [platform, placement, format, w, h] of targets) {
    const a = adaptDesignSpecification({ spec: DAY6_SPEC, platform, placement, platform_format: format });
    assert.equal(a.status, PROFILE_STATUS.RESOLVED, a.errors.join("; "));
    const r = composeSocialStatic(a.design_specification, T);
    assert.equal(r.status, COMPOSITOR_STATUS.READY, `${placement}: ${JSON.stringify(r.diagnostics)}`);
    assert.deepEqual([r.provenance.canvas.width, r.provenance.canvas.height], [w, h]);
    assert.ok(svgVisibleText(r.svg).includes(DAY6_HEADLINE), placement);
    seen.push(a.design_specification.copy_blocks[0].text);
  }
  assert.equal(new Set(seen).size, 1, "copy is byte-equivalent across placements");
});
test("33. Day-6 YouTube thumbnail is 1280x720, type-only, image-free, CTA-free", () => {
  const a = adaptDesignSpecification({ spec: DAY6_SPEC, platform: "youtube", placement: "video_thumbnail", platform_format: "THUMBNAIL" });
  const r = composeSocialStatic(a.design_specification, T);
  assert.deepEqual([r.provenance.canvas.width, r.provenance.canvas.height], [1280, 720]);
  assert.equal(r.status, COMPOSITOR_STATUS.READY);
  assert.equal(/<image/.test(r.svg), false);
  assert.equal(/cta/i.test(r.visible_text), false);
  assert.equal(/\bprice\b|testimonial|statistic/i.test(r.visible_text), false);
});
test("34. Day-6 invents no clinical mechanism and no supporting copy in any placement", () => {
  for (const [platform, placement, format] of [["instagram", "feed", "FEED_PORTRAIT"], ["youtube", "video_thumbnail", "THUMBNAIL"], ["whatsapp", "share_card", "SHARE_CARD"]]) {
    const a = adaptDesignSpecification({ spec: DAY6_SPEC, platform, placement, platform_format: format });
    const r = composeSocialStatic(a.design_specification, T);
    for (const banned of ["how to", "exercise", "stretch", "reps", "technique", "instructions"]) assert.ok(!r.visible_text.toLowerCase().includes(banned), banned);
    assert.equal(/Swiipt/.test(r.svg), true);   // brand wordmark preserved
  }
});
test("35. replaced/adapted specs keep the exact same approved copy object", () => {
  const a = adaptDesignSpecification({ spec: DAY6_SPEC, platform: "youtube", placement: "video_thumbnail", platform_format: "THUMBNAIL" });
  assert.equal(JSON.stringify(a.design_specification.copy_blocks), JSON.stringify(DAY6_SPEC.copy_blocks));
});

// ---------- HONESTY / BOUNDARY ----------------------------------------------
test("36. no arbitrary colours or fonts enter multi-panel output", () => {
  const r = ok(CAR());
  const allowed = [...Object.values(T.colors), ...Object.values(T.color_extras)].map((c) => String(c).toLowerCase());
  for (const p of r.panels) {
    for (const m of p.svg.matchAll(/#[0-9A-Fa-f]{6}/g)) assert.ok(allowed.includes(m[0].toLowerCase()), m[0]);
    for (const f of [...p.svg.matchAll(/font-family="([^"]+)"/g)].map((x) => x[1])) assert.ok(/DM Serif Display|Inter/.test(f), f);
  }
});
test("37. no raster output is produced", () => {
  for (const p of ok(CAR()).panels) assert.equal(/image\/png|image\/jpeg|image\/webp|base64/.test(p.svg), false);
});
test("38. no evidence authorization, no CTR prediction, no random variation in S-D modules", () => {
  const src = readFileSync(join(root, "mae/media/social-carousel.js"), "utf8") + readFileSync(join(root, "mae/services/social-platforms.js"), "utf8");
  for (const banned of ["evidence_gate", "authorizeClaim", "clickability", "virality", "Math.random", "randomUUID"]) assert.ok(!src.includes(banned), banned);
  assert.ok(!/Date\.now/.test(src));
});
test("39. no SocialGraphicQA module exists", () => assert.equal(existsSync(join(root, "mae/services/social-graphic-qa.js")), false));
test("40. buildSlideSpecification preserves copy and never mutates the source spec", () => {
  const s = CAR();
  const before = JSON.stringify(s);
  const slideSpec = buildSlideSpecification(s, s.slides[0], PLATFORM_PROFILES["instagram|carousel"], 1, T);
  assert.equal(JSON.stringify(s), before);
  assert.equal(slideSpec.copy_blocks[0].text, DAY6_HEADLINE);
  assert.equal(slideSpec.asset_type, "SOCIAL_STATIC");
  assert.equal(slideSpec.canvas.width, 1080);
});
test("41. continuityChecks detects an inconsistent panel set", () => {
  const r = ok(CAR());
  const broken = clone(r.panels); broken[1].provenance.profile_version = "0.0";
  const checks = continuityChecks(broken, PLATFORM_PROFILES["instagram|carousel"], T);
  assert.equal(checks.find((c) => c.check === "same_profile_version").pass, false);
});
test("42. story vertical profile is honoured (9:16 canvas, no pagination)", () => {
  const r = ok(STORY());
  assert.equal(r.panels[0].layout_plan.canvas.aspect_ratio, "9:16");
  assert.deepEqual([r.panels[0].layout_plan.canvas.width, r.panels[0].layout_plan.canvas.height], [1080, 1920]);
});
test("43. carousel slide canvases match the resolved carousel profile", () => {
  const r = ok(CAR());
  for (const p of r.panels) assert.deepEqual([p.layout_plan.canvas.width, p.layout_plan.canvas.height], [1080, 1350]);
});
test("44. qualification fixtures are synthetic and never leak ids into rendered copy", () => {
  for (const id of ["SD-2", "SD-3"]) assert.equal(syntheticFixture(id)._fixture_origin, "synthetic");
  const r = ok(CAR());
  assert.equal(/SYN-|_fixture_origin/.test(r.panels.map((p) => p.visible_text).join(" ")), false);
});
test("45. a multi-panel spec is still a valid S-A specification", () => {
  for (const id of ["SD-2", "SD-3"]) assert.equal(validateSocialDesignSpec(syntheticFixture(id)).valid, true, id);
});
test("frozen image fixture hashes unchanged", () => { for (const f of loadFixtures()) assert.equal(computeFixtureHash(f), f.fixture_hash, f.fixture_id); });
test("no provider capability was enabled", async () => {
  const vp = await import("../media/video-provider.js");
  assert.equal(vp.videoGenerationStatus().available, false);
});
test("assembler and profiles declare their versions", () => {
  assert.equal(SOCIAL_ASSEMBLER_VERSION, "1.0");
  assert.equal(PLATFORM_PROFILES["instagram|carousel"].profile_version, "1.0");
});
