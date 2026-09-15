// MAE Social Design — Wave S-D platform/placement profile tests.
// No providers, no network, no raster. SD-* fixtures are SYNTHETIC test data (see social-sd-fixtures.mjs).
// Run: node mae/harness/social-platforms.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PLATFORM_PROFILES, PROFILE_KEYS, PLATFORM_PROFILES_VERSION, PROFILE_STATUS, SOURCE_CLASS, MEDIA_POLICY,
  resolvePlatformPlacementProfile, validateSpecAgainstProfile, effectiveSafeZones, resolveLayoutFamily,
  adaptDesignSpecification, packagingCapabilities, listPlatformProfiles,
} from "../services/social-platforms.js";
import { composeSocialStatic, COMPOSITOR_STATUS } from "../media/social-compositor.js";
import { socialTokens } from "../services/social-design-tokens.js";
import { LAYOUT_FAMILIES, PLATFORM_FORMATS, ASSET_TYPES } from "../services/social-design-spec.js";
import { svgVisibleText } from "../media/layout.js";
import { DAY6_SPEC, DAY6_HEADLINE, SD_FIXTURES, syntheticFixture } from "./social-sd-fixtures.mjs";
import { loadFixtures, computeFixtureHash } from "../services/visual-qualification.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const T = socialTokens();
const prof = (p, pl, f = null) => resolvePlatformPlacementProfile({ platform: p, placement: pl, platform_format: f });

// ---------- B. PROFILE CONTRACT ---------------------------------------------
test("1. PlatformPlacementProfile contract is implemented with the approved fields", () => {
  for (const k of PROFILE_KEYS) {
    const p = PLATFORM_PROFILES[k];
    for (const f of ["profile_id", "profile_version", "platform", "placement", "platform_format", "asset_type_hint", "canvas", "safe_zones", "content_constraints", "layout_policy", "logo_policy", "cta_policy", "source_media_policy", "crop_policy", "packaging_policy", "field_sources"]) assert.ok(f in p, `${k}.${f}`);
    assert.equal(p.profile_version, PLATFORM_PROFILES_VERSION);
    for (const f of ["width", "height", "aspect_ratio"]) assert.ok(f in p.canvas, `${k}.canvas.${f}`);
    for (const f of ["top", "bottom", "left", "right"]) assert.ok(f in p.safe_zones, `${k}.safe_zones.${f}`);
    assert.ok(PLATFORM_FORMATS.includes(p.platform_format), `${k} format`);
    assert.ok(ASSET_TYPES.includes(p.asset_type_hint), `${k} hint`);
  }
});
test("2. profile version is retained and set-versioned", () => {
  assert.equal(PLATFORM_PROFILES_VERSION, "1.0");
  assert.match(PLATFORM_PROFILES["youtube|video_thumbnail"].profile_version, /^1\./);
});
test("3. resolution is deterministic (byte-identical for the same input)", () => {
  const a= prof("youtube", "video_thumbnail", "THUMBNAIL");
  const b = prof("youtube", "video_thumbnail", "THUMBNAIL");
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(a.profile.profile_id, b.profile.profile_id);
});
test("4. platform constraints are separated from Swiipt design policy", () => {
  const p = PLATFORM_PROFILES["youtube|video_thumbnail"];
  assert.equal(p.field_sources.canvas, SOURCE_CLASS.PLATFORM_CONSTRAINT);
  assert.equal(p.field_sources.safe_zones, SOURCE_CLASS.SWIIPT_DESIGN_POLICY);
  assert.equal(p.field_sources.layout_policy, SOURCE_CLASS.SWIIPT_DESIGN_POLICY);
});
test("5. marketing truth is not duplicated into any profile", () => {
  const blob = JSON.stringify(PLATFORM_PROFILES);
  for (const banned of ["angle_id", "product_id", "customer", "claim", "price", "testimonial", "statistic", "offer_text", "cta_text"]) assert.ok(!blob.includes(banned), banned);
});

// ---------- C. CORE PROFILES (11–22) ----------------------------------------
const EXPECTED = [
  ["instagram", "feed", "FEED_PORTRAIT", 1080, 1350, "SOCIAL_STATIC"],
  ["instagram", "carousel", "CAROUSEL_SLIDE", 1080, 1350, "SOCIAL_CAROUSEL"],
  ["instagram", "story", "STORY_VERTICAL", 1080, 1920, "SOCIAL_STORY_SEQUENCE"],
  ["instagram", "reel_cover", "COVER_PORTRAIT", 1080, 1920, "SOCIAL_STATIC"],
  ["facebook", "feed", "FEED_LANDSCAPE", 1200, 630, "SOCIAL_STATIC"],
  ["facebook", "video_cover", "FEED_LANDSCAPE", 1200, 630, "SOCIAL_STATIC"],
  ["whatsapp", "status", "STORY_VERTICAL", 1080, 1920, "SOCIAL_STATIC"],
  ["whatsapp", "share_card", "SHARE_CARD", 1200, 630, "SOCIAL_STATIC"],
  ["youtube", "video_thumbnail", "THUMBNAIL", 1280, 720, "SOCIAL_STATIC"],
  ["tiktok", "video_cover", "COVER_PORTRAIT", 1080, 1920, "SOCIAL_STATIC"],
  ["website", "video_poster", "THUMBNAIL", 1280, 720, "SOCIAL_STATIC"],
  ["course", "lesson_thumbnail", "THUMBNAIL", 1280, 720, "SOCIAL_STATIC"],
  ["product_demo", "video_cover", "THUMBNAIL", 1280, 720, "SOCIAL_STATIC"],
  ["webinar", "event_cover", "FEED_LANDSCAPE", 1200, 630, "SOCIAL_STATIC"],
  ["podcast", "video_episode_cover", "THUMBNAIL", 1280, 720, "SOCIAL_STATIC"],
];
EXPECTED.forEach(([platform, placement, format, w, h, type], i) => {
  test(`${11 + i}. ${platform}.${placement} profile resolves (${format} ${w}x${h})`, () => {
    const r = prof(platform, placement, format);
    assert.equal(r.ok, true, r.error || "");
    assert.equal(r.profile.platform, platform);
    assert.equal(r.profile.placement, placement);
    assert.equal(r.profile.platform_format, format);
    assert.deepEqual([r.profile.canvas.width, r.profile.canvas.height], [w, h]);
    assert.equal(r.profile.asset_type_hint, type);
  });
});
test("22. internal media-packaging namespaces are minimal and reuse existing formats", () => {
  const internal = PROFILE_KEYS.filter((k) => /^(course|product_demo|webinar|podcast)\|/.test(k));
  assert.equal(internal.length, 4);
  for (const k of internal) assert.ok(PLATFORM_FORMATS.includes(PLATFORM_PROFILES[k].platform_format), k);
});

// ---------- D. MEDIA PACKAGING ----------------------------------------------
test("23. media packaging remains SOCIAL_STATIC", () => {
  for (const k of ["youtube|video_thumbnail", "instagram|reel_cover", "facebook|video_cover", "tiktok|video_cover", "website|video_poster", "course|lesson_thumbnail", "product_demo|video_cover", "webinar|event_cover", "podcast|video_episode_cover"]) assert.equal(PLATFORM_PROFILES[k].asset_type_hint, "SOCIAL_STATIC", k);
});
test("24. no thumbnail-specific asset type exists", () => {
  for (const banned of ["YOUTUBE_THUMBNAIL", "VIDEO_THUMBNAIL", "REEL_COVER", "TIKTOK_COVER", "VIDEO_POSTER", "COURSE_THUMBNAIL"]) {
    assert.deepEqual([...ASSET_TYPES].filter((a) => a === banned), []);
    assert.equal(JSON.stringify(PLATFORM_PROFILES).includes(banned), false);
  }
});
test("25. the existing THUMBNAIL platform_format is reused", () => {
  assert.ok([...PLATFORM_FORMATS].includes("THUMBNAIL"));
  assert.equal(PLATFORM_PROFILES["youtube|video_thumbnail"].platform_format, "THUMBNAIL");
  assert.equal(PLATFORM_PROFILES["course|lesson_thumbnail"].platform_format, "THUMBNAIL");
});
test("26. YouTube video thumbnail is 1280x720 with a 16:9 aspect ratio", () => {
  const p = PLATFORM_PROFILES["youtube|video_thumbnail"];
  assert.deepEqual([p.canvas.width, p.canvas.height, p.canvas.aspect_ratio], [1280, 720, "16:9"]);
});
test("27. source-media policy is explicit per profile", () => {
  for (const k of PROFILE_KEYS) assert.ok(Object.values(MEDIA_POLICY).includes(PLATFORM_PROFILES[k].source_media_policy.mode), k);
});
test("28. type-only thumbnails are permitted where the profile allows it", () => {
  const caps = packagingCapabilities(PLATFORM_PROFILES["youtube|video_thumbnail"]);
  assert.equal(caps.allows_type_only, true);
  assert.equal(caps.allows_generated_image, true);   // capability only — nothing is generated in S-D
  assert.equal(caps.requires_high_legibility, true);
});
test("29. resolved-media thumbnails use existing slot geometry only", () => {
  const r = composeSocialStatic(SD_FIXTURES["SD-7"], T);
  assert.equal(r.status, COMPOSITOR_STATUS.READY, JSON.stringify(r.diagnostics));
  assert.equal(/<image/.test(r.svg), false);                 // artifact reference, not an embedded/derived frame
  assert.ok(r.component_results.some((c) => c.component_type === "image_slot"));
});
test("30. no image generation exists in S-D modules", () => {
  for (const f of ["mae/services/social-platforms.js", "mae/media/social-carousel.js"]) {
    const src = readFileSync(join(root, f), "utf8");
    assert.ok(!/makeGeminiImageAdapter|makeOpenAICompatibleImageAdapter|generateImage|imageGen|fetch\(/i.test(src.replace(/^\s*\/\/.*$/gm, "")), f);
  }
});
test("31. no frame extraction exists in S-D modules", () => {
  for (const f of ["mae/services/social-platforms.js", "mae/media/social-carousel.js"]) {
    assert.ok(!/ffmpeg|frame_timestamp|extractFrame|child_process/i.test(readFileSync(join(root, f), "utf8")), f);
  }
});
test("32. no automatic video-title copy: thumbnails use supplied copy only", () => {
  const r = composeSocialStatic(SD_FIXTURES["SD-6"], T);
  assert.equal(svgVisibleText(r.svg).includes(DAY6_HEADLINE), true);
  assert.equal(/video title|watch now|new video/i.test(r.visible_text), false);
});
test("33. no clickbait generation", () => {
  for (const f of ["mae/services/social-platforms.js", "mae/media/social-carousel.js"]) {
    assert.ok(!/clickbait|must see|you won'?t believe|shocking/i.test(readFileSync(join(root, f), "utf8")), f);
  }
});
test("34. no CTR prediction or best-thumbnail scoring", () => {
  for (const f of ["mae/services/social-platforms.js", "mae/media/social-carousel.js"]) {
    assert.ok(!/\bctr\b|clickability|virality|best_thumbnail|scoreThumbnail/i.test(readFileSync(join(root, f), "utf8")), f);
  }
});

// ---------- E/F. ADAPTATION --------------------------------------------------
test("35. adaptation contract produces a derived specification without touching copy", () => {
  const a = adaptDesignSpecification({ spec: DAY6_SPEC, platform: "youtube", placement: "video_thumbnail", platform_format: "THUMBNAIL" });
  assert.equal(a.status, PROFILE_STATUS.RESOLVED, a.errors.join("; "));
  const derived = a.design_specification;
  assert.deepEqual(derived.copy_blocks, DAY6_SPEC.copy_blocks);
  assert.equal(derived.angle_id, DAY6_SPEC.angle_id);
  assert.equal(derived.angle_verdict, DAY6_SPEC.angle_verdict);
  assert.equal(derived.asset_brief_id, DAY6_SPEC.asset_brief_id);
  assert.deepEqual(derived.provenance.truth_refs, DAY6_SPEC.provenance.truth_refs);
  assert.deepEqual([derived.canvas.width, derived.canvas.height], [1280, 720]);
  assert.ok(a.changes.includes("platform/placement"));
  assert.ok(a.changes.includes("canvas"));
});
test("36. adaptation never changes angle/truth/product references", () => {
  const a = adaptDesignSpecification({ spec: DAY6_SPEC, platform: "whatsapp", placement: "share_card", platform_format: "SHARE_CARD" });
  const d = a.design_specification;
  for (const k of ["angle_id", "angle_verdict", "asset_brief_id", "product_id", "transformation_id", "content_pattern", "asset_purpose", "source_classification"]) assert.deepEqual(d[k], DAY6_SPEC[k], k);
});
test("37. disallowed layout family resolves to an approved fallback and records the reason", () => {
  const listSpec = { ...DAY6_SPEC, layout_family: "LIST" };
  const a = adaptDesignSpecification({ spec: listSpec, platform: "youtube", placement: "video_thumbnail", platform_format: "THUMBNAIL" });
  assert.equal(a.fallback.fallback, true);
  assert.equal(a.fallback.source_layout_family, undefined);   // shape check below
  assert.equal(a.fallback.layout_family !== "LIST", true);
  assert.ok(PLATFORM_PROFILES["youtube|video_thumbnail"].layout_policy.allowed_layout_families.includes(a.fallback.layout_family));
  assert.ok(a.fallback.fallback_reason.includes("LIST"));
  assert.equal(a.design_specification.provenance.source_layout_family, "LIST");
  assert.ok(a.warnings.some((w) => /fallback/.test(w)));
});
test("38. resolveLayoutFamily only ever returns allowed families", () => {
  const profile = PLATFORM_PROFILES["youtube|video_thumbnail"];
  for (const fam of LAYOUT_FAMILIES) {
    const r = resolveLayoutFamily(profile, fam);
    assert.ok(profile.layout_policy.allowed_layout_families.includes(r.layout_family), fam);
    assert.equal(r.fallback, !profile.layout_policy.allowed_layout_families.includes(fam));
  }
});
test("39. adaptation is deterministic", () => {
  const a = adaptDesignSpecification({ spec: DAY6_SPEC, platform: "youtube", placement: "video_thumbnail", platform_format: "THUMBNAIL" });
  const b = adaptDesignSpecification({ spec: DAY6_SPEC, platform: "youtube", placement: "video_thumbnail", platform_format: "THUMBNAIL" });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});
test("40. adaptation never rewrites copy (byte-equivalent, incl. overflow case)", () => {
  const long = { ...DAY6_SPEC, copy_blocks: [{ role: "headline", text: "word ".repeat(80).trim(), required: true }] };
  const a = adaptDesignSpecification({ spec: long, platform: "youtube", placement: "video_thumbnail", platform_format: "THUMBNAIL" });
  assert.equal(a.design_specification.copy_blocks[0].text, long.copy_blocks[0].text);
  assert.equal(/…|\.\.\./.test(a.design_specification.copy_blocks[0].text), false);
});

// ---------- NEGATIVE BATTERY (1–9) ------------------------------------------
test("41. unknown platform rejects (negative 1)", () => {
  const r= prof("myspace", "feed", "FEED_SQUARE");
  assert.equal(r.ok, false); assert.equal(r.status, PROFILE_STATUS.UNSUPPORTED_PLATFORM_PLACEMENT);
});
test("42. unknown placement rejects (negative 2)", () => {
  const r= prof("instagram", "billboard", "FEED_SQUARE");
  assert.equal(r.ok, false); assert.equal(r.status, PROFILE_STATUS.UNSUPPORTED_PLATFORM_PLACEMENT);
});
test("43. unsupported platform+placement combination rejects (negative 3)", () => {
  const r= prof("youtube", "story", "STORY_VERTICAL");
  assert.equal(r.ok, false); assert.equal(r.status, PROFILE_STATUS.UNSUPPORTED_PLATFORM_PLACEMENT);
});
test("44. unsupported format for a profile rejects (negative 4)", () => {
  const r= prof("youtube", "video_thumbnail", "STORY_VERTICAL");
  assert.equal(r.ok, false); assert.equal(r.status, PROFILE_STATUS.PLATFORM_PROFILE_MISMATCH);
  assert.match(r.error, /not accepted/);
});
test("45. resolution never silently falls back to Instagram (negative 3)", () => {
  for (const [p, pl] of [["myspace", "feed"], ["instagram", "nope"], ["youtube", "story"]]) {
    const r = prof(p, pl, null);
    assert.equal(r.profile, null);
    assert.equal(r.ok, false);
  }
});
test("46. spec canvas/profile mismatch rejects — no silent resizing (negative 5)", () => {
  const spec = { ...SD_FIXTURES["SD-6"], canvas: { width: 1080, height: 1350, aspect_ratio: "4:5" } };
  const v = validateSpecAgainstProfile(spec, PLATFORM_PROFILES["youtube|video_thumbnail"]);
  assert.equal(v.valid, false);
  assert.match(v.errors.join(" "), /canvas/);
});
test("47. aspect-ratio mismatch rejects (negative 6)", () => {
  const spec = { ...SD_FIXTURES["SD-6"], canvas: { width: 1920, height: 1080, aspect_ratio: "16:9" } };
  const v = validateSpecAgainstProfile(spec, PLATFORM_PROFILES["youtube|video_thumbnail"]);
  assert.equal(v.valid, false);
  assert.match(v.errors.join(" "), /canvas/);
});
test("48. safe-zone incompatibility rejects (negative 7)", () => {
  const spec = { ...SD_FIXTURES["SD-6"], safe_zones: { top: 400, bottom: 400, left: 700, right: 700 } };
  const v = validateSpecAgainstProfile(spec, PLATFORM_PROFILES["youtube|video_thumbnail"]);
  assert.equal(v.valid, false);
  assert.match(v.errors.join(" "), /safe zones/);
});
test("49. a profile never weakens an explicit stricter spec safe zone", () => {
  const tighter = { top: 200, bottom: 300, left: 200, right: 200 };
  const eff = effectiveSafeZones({ safe_zones: tighter }, PLATFORM_PROFILES["youtube|video_thumbnail"]);
  assert.deepEqual(eff, tighter);
  const looser = { top: 4, bottom: 4, left: 4, right: 4 };
  const eff2 = effectiveSafeZones({ safe_zones: looser }, PLATFORM_PROFILES["youtube|video_thumbnail"]);
  assert.deepEqual(eff2, PLATFORM_PROFILES["youtube|video_thumbnail"].safe_zones);
});
test("50. asset-type/profile-hint mismatch rejects (carousel on a static profile)", () => {
  const carousel = { ...SD_FIXTURES["SD-2"], platform: "instagram", placement: "feed", platform_format: "FEED_PORTRAIT" };
  const v = validateSpecAgainstProfile(carousel, PLATFORM_PROFILES["instagram|feed"]);
  assert.equal(v.valid, false);
  assert.match(v.errors.join(" "), /asset_type/);
});

// ---------- QUALIFICATION SD-1 … SD-12 (75–86) -------------------------------
const STATIC_QUAL = [["SD-1", 1080, 1350], ["SD-4", 1080, 1920], ["SD-5", 1200, 630], ["SD-6", 1280, 720], ["SD-7", 1280, 720], ["SD-8", 1080, 1920], ["SD-9", 1200, 630], ["SD-10", 1080, 1920], ["SD-11", 1280, 720]];
STATIC_QUAL.forEach(([id, w, h]) => {
  test(`${id} qualifies as a complete deterministic static placement (${w}x${h})`, () => {
    const r = composeSocialStatic(SD_FIXTURES[id], T);
    assert.equal(r.status, COMPOSITOR_STATUS.READY, `${id}: ${JSON.stringify(r.diagnostics)}`);
    assert.equal(r.layout_plan.canvas.width, w);
    assert.equal(r.layout_plan.canvas.height, h);
    assert.equal(r.svg, composeSocialStatic(SD_FIXTURES[id], T).svg);
    assert.equal(r.checks.every((c) => c.pass), true, JSON.stringify(r.checks.filter((c) => !c.pass)));
  });
});
test("SD-12 cross-placement adaptation qualifies (feed → YouTube → WhatsApp, copy byte-equivalent)", () => {
  const targets = [["instagram", "feed", "FEED_PORTRAIT"], ["youtube", "video_thumbnail", "THUMBNAIL"], ["whatsapp", "share_card", "SHARE_CARD"]];
  const texts = new Set();
  for (const [platform, placement, format] of targets) {
    const a = adaptDesignSpecification({ spec: DAY6_SPEC, platform, placement, platform_format: format });
    assert.equal(a.status, PROFILE_STATUS.RESOLVED, a.errors.join("; "));
    const r = composeSocialStatic(a.design_specification, T);
    assert.equal(r.status, COMPOSITOR_STATUS.READY, `${placement}: ${JSON.stringify(r.diagnostics)}`);
    assert.ok(svgVisibleText(r.svg).includes(DAY6_HEADLINE), placement);
    assert.equal(a.design_specification.copy_blocks[0].text, DAY6_HEADLINE);
    texts.add(a.design_specification.copy_blocks[0].text);
  }
  assert.equal(texts.size, 1);   // byte-equivalent copy across placements
});
test("synthetic fixtures are labelled and cannot become truth", () => {
  for (const [id, s] of Object.entries(SD_FIXTURES)) assert.equal(s._fixture_origin, "synthetic", id);
  const r = composeSocialStatic(SD_FIXTURES["SD-6"], T);
  assert.equal(/SYN-|synthetic product/i.test(r.visible_text), false);
});
test("Day-6 YouTube packaging fixture (SD-CSEC-006 adapted) renders 1280x720 with the exact headline", () => {
  const a = adaptDesignSpecification({ spec: DAY6_SPEC, platform: "youtube", placement: "video_thumbnail", platform_format: "THUMBNAIL" });
  const r = composeSocialStatic(a.design_specification, T);
  assert.equal(r.status, COMPOSITOR_STATUS.READY);
  assert.equal(r.layout_plan.canvas.width, 1280);
  assert.equal(r.layout_plan.canvas.height, 720);
  assert.ok(svgVisibleText(r.svg).includes(DAY6_HEADLINE));
  assert.equal(/<image/.test(r.svg), false);
});
test("no arbitrary colours/fonts and no raster in adapted outputs", () => {
  const a = adaptDesignSpecification({ spec: DAY6_SPEC, platform: "tiktok", placement: "video_cover", platform_format: "COVER_PORTRAIT" });
  const r = composeSocialStatic(a.design_specification, T);
  const allowed = [...Object.values(T.colors), ...Object.values(T.color_extras)].map((c) => String(c).toLowerCase());
  for (const m of r.svg.matchAll(/#[0-9A-Fa-f]{6}/g)) assert.ok(allowed.includes(m[0].toLowerCase()), m[0]);
  for (const f of [...r.svg.matchAll(/font-family="([^"]+)"/g)].map((x) => x[1])) assert.ok(/DM Serif Display|Inter/.test(f), f);
  assert.ok(!/image\/png|image\/jpeg|image\/webp/.test(r.svg));
});
test("profile listing is deterministic and complete", () => {
  const a = listPlatformProfiles();
  assert.equal(a.length, PROFILE_KEYS.length);
  assert.equal(JSON.stringify(a), JSON.stringify(listPlatformProfiles()));
});
test("frozen image fixture hashes unchanged", () => { for (const f of loadFixtures()) assert.equal(computeFixtureHash(f), f.fixture_hash, f.fixture_id); });
test("no SocialGraphicQA module exists yet", () => assert.equal(existsSync(join(root, "mae/services/social-graphic-qa.js")), false));
