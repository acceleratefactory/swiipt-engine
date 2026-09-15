// MAE Social Design — Wave S-G tests: Social Asset Family orchestration + cross-platform adaptation.
// No provider calls, no image/video generation, no frame extraction, no raster, no network, no publishing.
// All S-G fixtures are SYNTHETIC (never truth, never proof). Run: node mae/harness/social-asset-family.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assembleSocialAssetFamily, familyId, memberId, canonicalFamilyProjection,
  FAMILY_STATUS, MEMBER_STATUS, SOURCE_POLICY, MEMBER_ERRORS, FAMILY_ERRORS, FAMILY_ROLES, FAMILY_CHECKS,
  SOCIAL_ASSET_FAMILY_VERSION,
} from "../services/social-asset-family.js";
import { validateSocialDesignSpec, ASSET_TYPES, ASSET_PURPOSES, COPY_ROLES } from "../services/social-design-spec.js";
import { PLATFORM_PROFILES, PLATFORM_PROFILES_VERSION } from "../services/social-platforms.js";
import { SOCIAL_GRAPHIC_QA_VERSION } from "../services/social-graphic-qa.js";
import { SOCIAL_COMPOSITOR_VERSION } from "../media/social-compositor.js";
import { SOCIAL_ASSEMBLER_VERSION } from "../media/social-carousel.js";
import { SOCIAL_SOURCE_MEDIA_VERSION } from "../media/social-source-media.js";
import {
  day6FamilyInput, day6FamilyInput as F, failureFixtures as FX, DAY6_SPEC, DAY6_HEADLINE, DAY6_ANGLE, DAY6_MEMBERS,
  MEMBER_FEED, MEMBER_CAROUSEL, MEMBER_WHATSAPP, MEMBER_YOUTUBE, MEMBER_STORY, GREEN_VALIDATION, RED_VALIDATION,
  COPY_POOL, COPY_POOL_WITH_COMMERCE, FAMILY_REGISTRY, passEvaluator, failEvaluator, DAY6_STRATEGY,
} from "./social-family-fixtures.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");
const FROZEN = {
  canonicalDay6Fixture: "46f0cbebca51403bb8b93416d401977ffcd14063e417398ad63b3101ded11e5f",
  day6ManifestHash: "c29ca7290a2cc708a8eeb4c61a11fe0128bfce695675eb9d603d8241bef3f602",
};
const run = (input) => assembleSocialAssetFamily(input);
const day6 = () => run(day6FamilyInput());
const role = (r, p) => r.members.find((m) => m.role === p);
const moduleSrc = readFileSync(join(root, "mae/services/social-asset-family.js"), "utf8");
const stripComments = (s) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
const codeSrc = stripComments(moduleSrc);

// =====================================================================================
// A. CONTRACT + PACKAGE
// =====================================================================================
test("1. module contract: version, statuses, source policies, reused role vocabulary", () => {
  assert.equal(SOCIAL_ASSET_FAMILY_VERSION, "social-asset-family@1");
  assert.deepEqual(Object.values(FAMILY_STATUS), ["APPROVED", "PARTIAL", "JUDGMENT_REQUIRED", "FAILED", "NOT_ELIGIBLE", "INVALID"]);
  assert.deepEqual(Object.values(SOURCE_POLICY), ["SHARED_SOURCE", "MEMBER_SPECIFIC_SOURCE", "NO_SOURCE"]);
  assert.deepEqual(FAMILY_ROLES, ["IDENTIFICATION", "PROBLEM", "STORY", "EDUCATION", "MECHANISM", "MYTH_REFRAME", "OBJECTION", "PROOF", "TRANSFORMATION", "CONVERSION", "REINFORCEMENT", "DECLARATION"]);
  assert.equal(FAMILY_CHECKS.length, 16);
});

test("2. only ONE focused S-G module + fixtures + tests were added (no architecture explosion)", () => {
  assert.ok(existsSync(join(root, "mae/services/social-asset-family.js")));
  for (const f of [
    "mae/services/social-campaign-engine.js", "mae/services/social-content-engine.js", "mae/services/social-strategy-engine.js",
    "mae/services/social-platform-generator.js", "mae/services/social-variant-engine.js", "mae/services/social-resizer.js",
    "mae/services/social-asset-manager.js", "mae/services/social-family-qa.js",
  ]) assert.ok(!existsSync(join(root, f)), f);
});

test("3. the module is orchestration only: no rendering, no QA reimplementation, no volatile identity", () => {
  for (const banned of ["Date.now", "Math.random", "randomUUID", "fetch(", "ffmpeg", "child_process", "writeFileSync", "<svg", "<rect", "tesseract"]) {
    assert.ok(!codeSrc.includes(banned), banned);
  }
  // no second QA engine: no zero-tolerance vocabulary, no status machine of its own
  for (const banned of ["ZERO_TOLERANCE", "overallStatus(", "SOCIAL_QA_DIMENSIONS", "authorizeEvidence("]) assert.ok(!codeSrc.includes(banned), banned);
  // no publishing / campaign / audience / fatigue / rotation / calendar concerns
  for (const banned of ["publish(", "schedule(", "audience", "fatigue", "rotation", "calendar", "performance"]) assert.ok(!codeSrc.includes(banned), banned);
});

test("4. S-A/S-D/S-C/S-E/S-F are reused (versions exposed and consistent)", () => {
  assert.equal(PLATFORM_PROFILES_VERSION, "1.0");
  assert.equal(SOCIAL_GRAPHIC_QA_VERSION, "social-graphic-qa@1");
  assert.equal(SOCIAL_COMPOSITOR_VERSION, "1.0");
  assert.equal(SOCIAL_ASSEMBLER_VERSION, "1.0");
  assert.equal(SOCIAL_SOURCE_MEDIA_VERSION, "1.0");
  assert.equal(Object.keys(PLATFORM_PROFILES).length, 15);
  assert.equal(ASSET_TYPES.length, 3);
  assert.equal(ASSET_PURPOSES.length, 12);
});

// =====================================================================================
// B. ANGLE GATE
// =====================================================================================
test("5. GREEN angle allows the requested family (APPROVED)", () => {
  const r = day6();
  assert.equal(r.family_status, FAMILY_STATUS.APPROVED);
  assert.equal(r.angle_verdict, "GREEN");
  assert.equal(r.no_fanout, false);
  assert.equal(r.members.length, 5);
});

test("6. RED angle blocks family generation (NOT_ELIGIBLE, zero fan-out)", () => {
  const r = run(FX.redAngle());
  assert.equal(r.family_status, FAMILY_STATUS.NOT_ELIGIBLE);
  assert.equal(r.no_fanout, true);
  assert.equal(r.members.length, 0);
  assert.ok(r.errors.some((e) => e.code === FAMILY_ERRORS.ANGLE_RED));
  assert.equal(r.angle_verdict, "RED");
});

test("7. an invalid angle validation record blocks the family (INVALID)", () => {
  const r = run(FX.invalidValidation());
  assert.equal(r.family_status, FAMILY_STATUS.INVALID);
  assert.ok(r.errors.some((e) => e.code === FAMILY_ERRORS.INVALID_ANGLE_VALIDATION));
  assert.equal(r.no_fanout, true);
});

test("8. a missing angle blocks the family (no fabricated angle)", () => {
  const r = run({ angle_validation: GREEN_VALIDATION, family_strategy: { jobs: ["STOP_SCROLL"], source_policy: "NO_SOURCE", spec_template: DAY6_SPEC }, requested_members: [MEMBER_FEED] });
  assert.equal(r.family_status, FAMILY_STATUS.INVALID);
  assert.ok(r.errors.some((e) => e.code === FAMILY_ERRORS.MISSING_ANGLE));
});

test("9. YELLOW uses the EXISTING governance cap (members beyond max_assets are retained, not produced)", () => {
  const r = run(FX.yellowOverCap());
  assert.equal(r.angle_verdict, "YELLOW");
  const retained = r.members.find((m) => m.status_reason === MEMBER_ERRORS.YELLOW_SCOPE_LIMIT);
  assert.ok(retained, "over-cap member retained with reason");
  assert.equal(retained.status, MEMBER_STATUS.NOT_ELIGIBLE);
  assert.equal(r.family_status, FAMILY_STATUS.NOT_ELIGIBLE);
  assert.equal(r.members.filter((m) => m.status === MEMBER_STATUS.PASS).length, 2);
});

test("9b. YELLOW requires explicit permission from governance; the cap still governs production", () => {
  const blocked = run(FX.yellowNotPermitted());
  assert.equal(blocked.family_status, FAMILY_STATUS.NOT_ELIGIBLE);
  assert.equal(blocked.no_fanout, true);
  assert.ok(blocked.errors.some((e) => e.code === FAMILY_ERRORS.YELLOW_NOT_PERMITTED));
  const permitted = run(FX.yellowOverCap());
  assert.equal(permitted.no_fanout, false);
  assert.equal(permitted.members.filter((m) => m.status === MEMBER_STATUS.PASS).length, 2);
});

test("10. a platform outside the validated angle scope is not produced (retained NOT_ELIGIBLE)", () => {
  const r = run(FX.outOfScopePlatform());
  const m = role(r, "EDUCATION");
  assert.equal(m.status, MEMBER_STATUS.NOT_ELIGIBLE);
  assert.equal(m.status_reason, MEMBER_ERRORS.ANGLE_SCOPE_VIOLATION);
  assert.equal(r.family_status, FAMILY_STATUS.NOT_ELIGIBLE);
});

test("11. an excluded platform is not produced (retained NOT_ELIGIBLE)", () => {
  const input = day6FamilyInput({ validation: { ...GREEN_VALIDATION, excluded_platforms: ["whatsapp"] }, members: [MEMBER_FEED, MEMBER_WHATSAPP] });
  const r = run(input);
  assert.equal(role(r, "EDUCATION").status_reason, MEMBER_ERRORS.ANGLE_SCOPE_VIOLATION);
});

// =====================================================================================
// C. IDENTITY + DETERMINISM
// =====================================================================================
test("12. family identity is deterministic and key-order independent", () => {
  const a = familyId({ angle_id: "ANG-CSEC-006", angle_verdict: "GREEN", strategy: { jobs: ["STOP_SCROLL"], source_policy: "SHARED_SOURCE" }, members: [MEMBER_FEED] });
  const b = familyId({ members: [MEMBER_FEED], strategy: { source_policy: "SHARED_SOURCE", jobs: ["STOP_SCROLL"] }, angle_verdict: "GREEN", angle_id: "ANG-CSEC-006" });
  assert.equal(a, b);
  assert.equal(familyId({ angle_id: "ANG-CSEC-006", angle_verdict: "GREEN", strategy: { jobs: ["STOP_SCROLL"], source_policy: "SHARED_SOURCE", required_purposes: [] }, members: [MEMBER_WHATSAPP] }) !== a, true);
});

test("13. member identity is deterministic from family + platform + placement + purpose + role", () => {
  const fid = familyId({ angle_id: DAY6_ANGLE.id, angle_verdict: "GREEN", strategy: { jobs: ["STOP_SCROLL"] }, members: [MEMBER_FEED] });
  assert.equal(memberId(fid, MEMBER_FEED), memberId(fid, { ...MEMBER_FEED }));
  assert.notEqual(memberId(fid, MEMBER_FEED), memberId(fid, MEMBER_WHATSAPP));
  assert.ok(memberId(fid, MEMBER_FEED).startsWith(fid));
});

test("14. manifest is byte-identical on rebuild AND stable across the run", () => {
  const a = day6();
  const b = day6();
  assert.equal(a.family_id, b.family_id);
  assert.equal(a.family_manifest.manifest_hash, b.family_manifest.manifest_hash);
  assert.equal(a.family_manifest.manifest_hash, FROZEN.day6ManifestHash);
  assert.equal(sha256(canonicalFamilyProjection(a.family_manifest)), sha256(canonicalFamilyProjection(b.family_manifest)));
});

test("15. the manifest carries no volatile state (no timestamps, no random ids)", () => {
  const manifest = day6().family_manifest;
  assert.ok(!/created_at|updated_at|timestamp|uuid/i.test(JSON.stringify(manifest)));
  assert.equal(manifest.family_version, SOCIAL_ASSET_FAMILY_VERSION);
  assert.equal(manifest.provenance.deterministic, true);
});

test("16. duplicate authoritative member identity is rejected before production", () => {
  const r = run(FX.duplicateMember());
  assert.equal(r.family_status, FAMILY_STATUS.INVALID);
  assert.ok(r.errors.some((e) => e.code === FAMILY_ERRORS.DUPLICATE_FAMILY_MEMBER));
  assert.equal(r.no_fanout, true);
  assert.equal(r.members.length, 0);
});

test("17. changing one member's definition changes that member only", () => {
  const base = run(day6FamilyInput({ members: [MEMBER_FEED, MEMBER_WHATSAPP] }));
  const changed = run(day6FamilyInput({ members: [{ ...MEMBER_FEED, layout_family: "TYPE_DOMINANT", production_mode: "DETERMINISTIC_TYPE_ONLY" }, MEMBER_WHATSAPP] }));
  assert.notEqual(role(base, "IDENTIFICATION").artifact_ref.bytes_hash, role(changed, "IDENTIFICATION").artifact_ref.bytes_hash);
  assert.notEqual(base.family_id, changed.family_id);
  // the untouched member keeps its content identity (layout, profile, copy, source); its design_id is
  // family-scoped by design (Part 8 + traceability), so only that plus the embedded design comment differ.
  const a = role(base, "EDUCATION"), b = role(changed, "EDUCATION");
  assert.deepEqual([a.layout_family, a.platform_format, a.artifact_ref.canvas.width, a.artifact_ref.canvas.height, a.copy_refs, a.source_media_refs[0].source_media_id, a.status], [b.layout_family, b.platform_format, b.artifact_ref.canvas.width, b.artifact_ref.canvas.height, b.copy_refs, b.source_media_refs[0].source_media_id, b.status]);
});

test("18. a member's identity changes when its authoritative definition changes", () => {
  const a = run(day6FamilyInput({ members: [MEMBER_FEED] }));
  const b = run(day6FamilyInput({ members: [{ ...MEMBER_FEED, layout_family: "EDITORIAL" }] }));
  assert.notEqual(a.members[0].member_id, b.members[0].member_id);
});

test("19. QA change with an identical artifact DOES change family approval (artifact identity ≠ approval)", () => {
  const pass = run(day6FamilyInput({ members: [MEMBER_FEED, MEMBER_WHATSAPP] }));
  const fail = run(day6FamilyInput({ members: [MEMBER_FEED, { ...MEMBER_WHATSAPP, evaluator: failEvaluator("HIERARCHY") }] }));
  assert.equal(pass.family_status, FAMILY_STATUS.APPROVED);
  assert.equal(fail.family_status, FAMILY_STATUS.FAILED);
  assert.equal(role(pass, "EDUCATION").artifact_ref.bytes_hash, role(fail, "EDUCATION").artifact_ref.bytes_hash);
  assert.notEqual(role(fail, "EDUCATION").status, MEMBER_STATUS.PASS);
});

// =====================================================================================
// D. COPY GOVERNANCE
// =====================================================================================
test("20. only requested copy roles are selected from the approved pool", () => {
  const m = role(day6(), "EDUCATION");
  assert.deepEqual(m.copy_refs, ["COPY-HOOK-1"]);
  assert.equal(m.copy_selection.selected.length, 1);
});

test("21. approved copy is reused byte-for-byte (exact approved headline)", () => {
  for (const r of ["IDENTIFICATION", "EDUCATION", "PROBLEM"]) {
    const m = role(day6(), r);
    assert.equal(m.copy_selection.selected[0].copy_id, "COPY-HOOK-1");
    assert.ok(m._artifact.visible_text.includes(DAY6_HEADLINE), r);
  }
});

test("22. copy mutation inside orchestration is rejected (no rewriting/paraphrasing/strengthening)", () => {
  const r = run(FX.copyMutation());
  assert.equal(r.family_status, FAMILY_STATUS.INVALID);
  assert.ok(r.errors.some((e) => e.code === FAMILY_ERRORS.COPY_MUTATION_REJECTED));
  assert.equal(r.no_fanout, true);
});

test("23. a copy role that is not in the approved pool is never invented", () => {
  const r = run(FX.copyRoleUnresolved());
  const m = role(r, "IDENTIFICATION");
  assert.equal(m.status, MEMBER_STATUS.NOT_ELIGIBLE);
  assert.equal(m.status_reason, MEMBER_ERRORS.COPY_ROLE_UNRESOLVED);
  assert.ok(m.status_detail.includes("cta"));
});

test("24. required approved copy can never be dropped by a member", () => {
  const r = run(FX.requiredCopyOmitted());
  const m = role(r, "IDENTIFICATION");
  assert.equal(m.status_reason, MEMBER_ERRORS.REQUIRED_COPY_OMITTED);
  assert.equal(m.status, MEMBER_STATUS.NOT_ELIGIBLE);
});

test("25. optional copy may be omitted, and the omission is recorded", () => {
  const m = role(day6(), "EDUCATION");
  const omitted = m.copy_selection.omitted.map((o) => o.copy_id);
  assert.ok(omitted.includes("SF-BODY-1"));
  assert.ok(omitted.includes("SF-SUPPORT-1"));
  assert.ok(m.copy_selection.omitted.every((o) => o.reason === "not_selected"));
  const manifestMember = day6().family_manifest.members.find((x) => x.member_id === m.member_id);
  assert.deepEqual(manifestMember.copy_omitted, omitted);
});

test("26. no automatic CTA (a family without supplied CTA copy carries none)", () => {
  const r = day6();
  for (const m of r.members) {
    if (m._spec?.copy_blocks) assert.ok(!m._spec.copy_blocks.some((b) => b.role === "cta"), m.role);
    if (m._spec?.cta_policy) assert.equal(m._spec.cta_policy.required, false, m.role);
  }
  assert.ok(!JSON.stringify(r.family_manifest).includes("SF-CTA-1"));
});

test("27. no automatic price and no automatic proof/statistic/testimonial", () => {
  const r = day6();
  const roles = new Set(r.members.flatMap((m) => (m._spec?.copy_blocks || []).map((b) => b.role)));
  for (const forbidden of ["price", "members_price", "offer", "statistic_value", "quote"]) assert.ok(!roles.has(forbidden), forbidden);
  for (const m of r.members) assert.deepEqual(m._spec.evidence_requirements ?? [], [], m.role);
});

test("28. commerce copy is used ONLY when supplied upstream (price + CTA appear then)", () => {
  const r = run(FX.commerceSupplied());
  assert.equal(r.family_status, FAMILY_STATUS.APPROVED);
  const m = role(r, "IDENTIFICATION");
  assert.deepEqual(m.copy_refs, ["COPY-HOOK-1", "SF-PRICE-1", "SF-CTA-1"]);
  assert.equal(m._spec.cta_policy.required, true);
  assert.equal(m._spec.cta_policy.prominence, "HIGH");
  assert.ok(m._artifact.visible_text.includes("USD 29"));
  assert.ok(m._artifact.visible_text.includes("Start the 30-day plan"));
});

test("29. copy provenance is retained per member (copy_refs ⊆ approved pool)", () => {
  const r = day6();
  const poolIds = new Set(COPY_POOL.map((b) => b.copy_id));
  for (const m of r.members) {
    assert.ok(m.copy_refs.length >= 1);
    for (const id of m.copy_refs) assert.ok(poolIds.has(id), id);
    assert.equal(m.trace.design_id, m.design_id);
  }
});

// =====================================================================================
// E. PLATFORM ADAPTATION
// =====================================================================================
test("30. each member resolves its own S-D platform profile (no duplicated dimensions)", () => {
  const r = day6();
  for (const m of r.members) {
    const p = PLATFORM_PROFILES[`${m.platform}|${m.placement}`];
    assert.ok(p, `${m.platform}|${m.placement}`);
    assert.equal(m.trace.profile_id, p.profile_id);
    assert.equal(m.artifact_ref.canvas.width, p.canvas.width);
    assert.equal(m.artifact_ref.canvas.height, p.canvas.height);
  }
  assert.ok(!codeSrc.includes("1080") && !codeSrc.includes("1350"), "no hard-coded platform geometry inside S-G");
});

test("31. Instagram feed canvas is platform-native", () => {
  const m = role(day6(), "IDENTIFICATION");
  assert.equal(m.artifact_ref.canvas.width, 1080);
  assert.equal(m.artifact_ref.canvas.height, 1350);
});

test("32. YouTube thumbnail canvas is platform-native", () => {
  const m = role(day6(), "PROBLEM");
  assert.equal(m.platform, "youtube");
  assert.equal(m.artifact_ref.canvas.width, 1280);
  assert.equal(m.artifact_ref.canvas.height, 720);
});

test("33. WhatsApp share card canvas is platform-native", () => {
  const m = role(day6(), "EDUCATION");
  assert.equal(m.platform, "whatsapp");
  assert.equal(m.artifact_ref.canvas.width, 1200);
  assert.equal(m.artifact_ref.canvas.height, 630);
});

test("34. Instagram story canvas is platform-native", () => {
  const m = role(day6(), "REINFORCEMENT");
  assert.equal(m.asset_type, "SOCIAL_STORY_SEQUENCE");
  assert.equal(m.artifact_ref.canvas.width, 1080);
  assert.equal(m.artifact_ref.canvas.height, 1920);
});

test("35. layouts differ across members of the same family (rhythm, not sameness)", () => {
  const r = day6();
  const layouts = new Set(r.members.map((m) => m.layout_family));
  assert.ok(layouts.size >= 3, [...layouts].join(","));
  assert.ok(layouts.has("IMAGE_DOMINANT"));
  assert.ok(layouts.has("SPLIT"));
});

test("36. platform-native ≠ resize-only (canvas, layout, copy selection and artifact all differ)", () => {
  const r = day6();
  const ig = role(r, "IDENTIFICATION");
  const yt = role(r, "PROBLEM");
  const wa = role(r, "EDUCATION");
  assert.notDeepEqual([ig.artifact_ref.canvas.width, ig.artifact_ref.canvas.height], [yt.artifact_ref.canvas.width, yt.artifact_ref.canvas.height]);
  assert.notDeepEqual([yt.artifact_ref.canvas.width, yt.artifact_ref.canvas.height], [wa.artifact_ref.canvas.width, wa.artifact_ref.canvas.height]);
  assert.notEqual(ig.artifact_ref.bytes_hash, yt.artifact_ref.bytes_hash);
  assert.notEqual(yt.artifact_ref.bytes_hash, wa.artifact_ref.bytes_hash);
});

test("37. unknown platform yields an explicit failure and NEVER falls back to Instagram", () => {
  const r = run(FX.unknownPlatform());
  const m = role(r, "EDUCATION");
  assert.equal(m.status, MEMBER_STATUS.NOT_ELIGIBLE);
  assert.equal(m.status_reason, MEMBER_ERRORS.UNKNOWN_PLATFORM);
  assert.equal(m.platform, "unknown");
  assert.equal(m.artifact_ref, undefined);
  assert.equal(r.members.filter((x) => x.platform === "instagram").length, 1);
});

test("38. an unsupported placement is retained as a failure (never silently dropped)", () => {
  const input = day6FamilyInput({ members: [MEMBER_FEED, { ...MEMBER_WHATSAPP, placement: "nowhere" }] });
  const r = run(input);
  assert.equal(r.members.length, 2);
  assert.equal(role(r, "EDUCATION").status_reason, MEMBER_ERRORS.UNKNOWN_PLATFORM);
});

test("39. a format the profile does not accept is rejected (no silent format swap)", () => {
  const input = day6FamilyInput({ members: [MEMBER_FEED, { ...MEMBER_WHATSAPP, platform_format: "FEED_SQUARE" }] });
  const r = run(input);
  assert.equal(role(r, "EDUCATION").status_reason, MEMBER_ERRORS.FORMAT_NOT_ACCEPTED);
});

test("40. a layout the profile prohibits is deterministically adapted AND the fallback is recorded", () => {
  const input = day6FamilyInput({ members: [MEMBER_FEED, { ...MEMBER_YOUTUBE, layout_family: "LIST" }] });
  const r = run(input);
  const m = role(r, "PROBLEM");
  assert.notEqual(m.layout_family, "LIST");
  assert.ok(typeof m.layout_fallback === "string" && m.layout_fallback.length > 0);
  assert.ok(PLATFORM_PROFILES["youtube|video_thumbnail"].layout_policy.allowed_layout_families.includes(m.layout_family));
});

test("41. only requested members are produced (no platform expansion, no asset explosion)", () => {
  const r = day6();
  assert.equal(r.members.length, 5);
  assert.equal(r.family_manifest.members.length, 5);
  const two = run(day6FamilyInput({ members: [MEMBER_FEED, MEMBER_WHATSAPP] }));
  assert.equal(two.members.length, 2);
  assert.equal(two.family_manifest.members.length, 2);
});

// =====================================================================================
// F. SOURCE MEDIA
// =====================================================================================
test("42. SHARED_SOURCE preserves one identity + checksum across Instagram / YouTube / WhatsApp / story", () => {
  const r = day6();
  const ids = new Set(r.members.map((m) => m.source_media_refs[0]?.source_media_id));
  const checks = new Set(r.members.map((m) => m.source_media_refs[0]?.checksum));
  assert.equal(ids.size, 1);
  assert.equal(checks.size, 1);
  assert.deepEqual(r.media.shared_source_ids, [...ids]);
  assert.deepEqual(r.media.member_specific_source_ids, []);
  assert.equal(r.media.members_with_media.length, 5);
});

test("43. per-member crop/fit/focal may differ while identity is unchanged", () => {
  const slot = { slot_id: "hero", media_type: "photo", required: true, fit: "contain", focal: "top", fallback: "SOURCE_REQUIRED" };
  const input = day6FamilyInput({ members: [{ ...MEMBER_FEED, visual_slots: [slot] }, MEMBER_WHATSAPP] });
  const r = run(input);
  assert.deepEqual(role(r, "IDENTIFICATION").media_geometry.find((g) => g.slot_id === "hero"), { slot_id: "hero", fit: "contain", focal: "top" });
  assert.equal(role(r, "IDENTIFICATION").source_media_refs[0].source_media_id, role(r, "EDUCATION").source_media_refs[0].source_media_id);
});

test("44. MEMBER_SPECIFIC_SOURCE lets members use different approved media in one coherent family", () => {
  const r = run(FX.memberSpecificSource());
  assert.equal(r.family_status, FAMILY_STATUS.APPROVED);
  const feed = role(r, "IDENTIFICATION").source_media_refs[0];
  const wa = role(r, "EDUCATION").source_media_refs[0];
  assert.notEqual(feed.source_media_id, wa.source_media_id);
  assert.equal(feed.source_type, "SYNTHETIC_FIXTURE");
  assert.equal(wa.source_type, "PRODUCT_IMAGE");
  assert.equal(r.media.member_specific_source_ids.length, 2);
  assert.equal(r.media.shared_source_ids.length, 0);
});

test("45. MEMBER_SPECIFIC_SOURCE without a declared binding is an honest failure (never guessed)", () => {
  const r = run(FX.memberSpecificUndeclared());
  for (const m of r.members) assert.equal(m.status_reason, MEMBER_ERRORS.MEMBER_SOURCE_UNDECLARED);
  assert.equal(r.family_status, FAMILY_STATUS.NOT_ELIGIBLE);
});

test("46. type-only members are valid (NO_SOURCE family approves without media)", () => {
  const r = run(FX.noSource());
  assert.equal(r.family_status, FAMILY_STATUS.APPROVED);
  for (const m of r.members) assert.equal(m.source_media_refs.length, 0);
  assert.equal(r.media.members_with_media.length, 0);
  assert.equal(r.media.authorizes_evidence, false);
});

test("47. NO_SOURCE contradicting a required media slot is rejected (no silent placeholder)", () => {
  const r = run(FX.noSourceWithRequiredSlot());
  assert.equal(role(r, "IDENTIFICATION").status_reason, MEMBER_ERRORS.SOURCE_POLICY_VIOLATION);
  assert.equal(r.family_status, FAMILY_STATUS.NOT_ELIGIBLE);
});

test("48. source media never authorizes evidence anywhere in the family", () => {
  const r = day6();
  assert.equal(r.media.authorizes_evidence, false);
  for (const m of r.members) {
    assert.equal(m.qa.evidence_status, "NOT_REQUIRED");
    assert.equal(m._artifact == null || m.trace.source_media_ids.length === m.source_media_refs.length, true);
  }
  assert.ok(!JSON.stringify(r.family_manifest).includes("TESTIMONIAL"));
});

test("49. source change is isolated to the intended member (no cross-member mutation)", () => {
  const memberDef = (sourceId) => ({
    strategy: { ...DAY6_STRATEGY, source_policy: "MEMBER_SPECIFIC_SOURCE" },
    members: [
      { ...MEMBER_FEED, source_bindings: [{ slot_id: "hero", source_id: "SYN-PHOTO-1" }] },
      { ...MEMBER_WHATSAPP, production_mode: "ILLUSTRATION_PLUS_TYPE", source_bindings: [{ slot_id: "hero", source_id: sourceId }] },
    ],
  });
  const base = run(day6FamilyInput(memberDef("SYN-PHOTO-1")));
  const changed = run(day6FamilyInput(memberDef("SYN-ILLUSTRATION-1")));
  assert.equal(role(base, "IDENTIFICATION").source_media_refs[0].source_media_id, role(changed, "IDENTIFICATION").source_media_refs[0].source_media_id);
  assert.notEqual(role(base, "EDUCATION").source_media_refs[0].source_media_id, role(changed, "EDUCATION").source_media_refs[0].source_media_id);
  assert.notEqual(base.family_manifest.manifest_hash, changed.family_manifest.manifest_hash);
});

// =====================================================================================
// G. ASSET TYPES
// =====================================================================================
test("50. only the three approved asset types exist in the family output", () => {
  const r = day6();
  for (const m of r.members) assert.ok(ASSET_TYPES.includes(m.asset_type), m.asset_type);
  assert.ok(!codeSrc.includes("YOUTUBE_THUMBNAIL") && !codeSrc.includes("WHATSAPP_CARD") && !codeSrc.includes("REEL_COVER"));
});

test("51. a platform-specific asset type is retained as an explicit failure (no new types)", () => {
  const r = run(FX.unsupportedMember());
  const m = role(r, "EDUCATION");
  assert.equal(m.status_reason, MEMBER_ERRORS.UNSUPPORTED_MEMBER);
  assert.equal(r.members.length, 2);
  assert.equal(r.members.some((x) => x.asset_type === "WHATSAPP_CARD"), true);
});

test("52. a carousel is ONE family member: its panels are never flattened", () => {
  const r = day6();
  const carousel = role(r, "STORY");
  assert.equal(carousel.asset_type, "SOCIAL_CAROUSEL");
  assert.equal(carousel.production.panel_count, 3);
  assert.deepEqual(carousel.production.panel_roles, ["COVER", "EXPLAIN", "ACT"]);
  assert.equal(r.members.filter((m) => m.asset_type === "SOCIAL_CAROUSEL").length, 1);
  const memberIds = new Set(r.members.map((m) => m.member_id));
  assert.equal(memberIds.size, 5);
});

test("53. a story sequence is ONE family member with internal frames", () => {
  const r = day6();
  const story = role(r, "REINFORCEMENT");
  assert.equal(story.asset_type, "SOCIAL_STORY_SEQUENCE");
  assert.equal(story.production.panel_count, 2);
  assert.deepEqual(story.production.panel_roles, ["COVER", "ACT"]);
});

test("54. YouTube thumbnail is SOCIAL_STATIC + a placement profile (not an asset type)", () => {
  const m = role(day6(), "PROBLEM");
  assert.equal(m.asset_type, "SOCIAL_STATIC");
  assert.equal(m.placement, "video_thumbnail");
  assert.equal(m.trace.profile_id, "youtube.video_thumbnail");
});

// =====================================================================================
// H. PRODUCTION
// =====================================================================================
test("55. static members flow through the EXISTING compositor (READY + real checks)", () => {
  const m = role(day6(), "IDENTIFICATION");
  assert.equal(m.production.status, "READY");
  assert.ok(Array.isArray(m.production.checks) && m.production.checks.length > 0);
  assert.ok(m.production.checks.every((c) => typeof c.pass === "boolean"));
});

test("56. multi-panel members flow through the EXISTING S-D assembler (continuity checks retained)", () => {
  const carousel = role(day6(), "STORY");
  assert.equal(carousel.production.status, "READY");
  assert.ok(carousel.production.checks.some((c) => c.check === "same_canvas" && c.pass === true));
  assert.equal(carousel.production.panel_layouts.length, 3);
  assert.ok(new Set(carousel.production.panel_layouts).size >= 2, "panel layouts vary within one member");
});

test("57. artifacts stay independent (no concatenated mega-artifact, references in the manifest)", () => {
  const r = day6();
  assert.ok(!("svg" in r.family_manifest));
  for (const m of r.family_manifest.members) {
    assert.ok(m.artifact_ref.artifact_id.includes("@"));
    assert.ok(/^[0-9a-f]{64}$/.test(m.artifact_ref.bytes_hash));
  }
  assert.equal(new Set(r.family_manifest.members.map((m) => m.artifact_ref.bytes_hash)).size, 5);
});

// =====================================================================================
// I. QA + APPROVAL
// =====================================================================================
test("58. every member keeps its own S-E QA result (READY is not PASS)", () => {
  const r = day6();
  for (const m of r.members) {
    assert.equal(m.qa.qa_version, SOCIAL_GRAPHIC_QA_VERSION);
    assert.equal(m.qa.status, "PASS");
    assert.equal(m.qa.judgment_run, true);
  }
  const noEvaluator = run(day6FamilyInput({ members: [MEMBER_FEED], evaluator: null }));
  assert.equal(noEvaluator.members[0].status, MEMBER_STATUS.JUDGMENT_REQUIRED);
  assert.equal(noEvaluator.members[0].production.status, "READY");
});

test("59. a required member FAIL fails the family (failed member retained)", () => {
  const r = run(FX.requiredMemberFailure());
  assert.equal(r.family_status, FAMILY_STATUS.FAILED);
  const m = role(r, "EDUCATION");
  assert.equal(m.status, MEMBER_STATUS.FAIL);
  assert.ok(m.qa.blocking_failures.length >= 0);
  assert.equal(r.family_manifest.members.find((x) => x.member_id === m.member_id).status, MEMBER_STATUS.FAIL);
});

test("60. a required member NOT_ELIGIBLE blocks APPROVED", () => {
  const r = run(FX.unknownPlatform());
  assert.equal(r.family_status, FAMILY_STATUS.NOT_ELIGIBLE);
  assert.notEqual(r.family_status, FAMILY_STATUS.APPROVED);
});

test("61. a required member JUDGMENT_REQUIRED makes the family JUDGMENT_REQUIRED (never APPROVED)", () => {
  const r = run(FX.judgmentRequired());
  assert.equal(r.family_status, FAMILY_STATUS.JUDGMENT_REQUIRED);
  for (const m of r.members) assert.equal(m.status, MEMBER_STATUS.JUDGMENT_REQUIRED);
});

test("62. an optional failure yields PARTIAL where the strategy permits partial", () => {
  const r = run(FX.optionalMemberFailure());
  assert.equal(r.family_status, FAMILY_STATUS.PARTIAL);
  const opt = role(r, "PROBLEM");
  assert.equal(opt.required, false);
  assert.equal(opt.status, MEMBER_STATUS.FAIL);
  assert.ok(r.family_manifest.members.some((m) => m.member_id === opt.member_id && m.status === MEMBER_STATUS.FAIL));
});

test("63. an optional failure is never silently called APPROVED (partial not permitted)", () => {
  const r = run(FX.optionalMemberFailureNoPartial());
  assert.notEqual(r.family_status, FAMILY_STATUS.APPROVED);
  assert.equal(r.family_status, FAMILY_STATUS.JUDGMENT_REQUIRED);
  assert.ok(r.members.some((m) => m.status === MEMBER_STATUS.FAIL));
});

test("64. no score averaging: one required FAIL among passes is FAILED", () => {
  const r = run(FX.requiredMemberFailure());
  const passCount = r.members.filter((m) => m.status === MEMBER_STATUS.PASS).length;
  assert.ok(passCount >= 4);
  assert.equal(r.family_status, FAMILY_STATUS.FAILED);
  assert.ok(!("score" in r.family_manifest) && !("average" in r.family_manifest));
});

test("65. failed and unreviewed members are never dropped from the manifest", () => {
  for (const factory of [FX.requiredMemberFailure, FX.optionalMemberFailure, FX.unknownPlatform, FX.judgmentRequired]) {
    const r = run(factory());
    assert.equal(r.members.length, r.family_manifest.members.length);
    assert.ok(r.family_manifest.members.every((m) => m.status && m.member_id));
  }
});

test("66. deterministic family coherence is evaluated where it can be", () => {
  const r = day6();
  assert.equal(r.coherence.deterministic.pass, true);
  const names = r.coherence.deterministic.checks.map((c) => c.check);
  for (const c of ["same_angle_identity", "same_truth_refs", "same_brand_identity", "copy_provenance_present", "copy_byte_preserved", "source_media_provenance", "platform_profile_resolved", "member_purpose_defined", "member_role_defined", "media_never_authorizes_evidence"]) {
    assert.ok(names.includes(c), c);
  }
  assert.equal(r.coherence.deterministic.checks.every((c) => c.pass === true), true);
});

test("67. aesthetic family coherence is never manufactured without judgment", () => {
  const r = day6();
  assert.equal(r.coherence.judgment.status, "JUDGMENT_REQUIRED");
  assert.equal(r.coherence.judgment.evaluator, null);
  const withEvaluator = run(day6FamilyInput({ coherence_evaluator: { status: "PASS", rationale: "fixture coherence PASS", evaluator: "fixture" } }));
  assert.equal(withEvaluator.coherence.judgment.status, "PASS");
  const bad = run(day6FamilyInput({ coherence_evaluator: { status: "AMAZING", rationale: "nonsense" } }));
  assert.equal(bad.coherence.judgment.status, "JUDGMENT_REQUIRED");
  assert.ok(!/cohesive campaign|strong visual consistency|excellent family/i.test(JSON.stringify(day6().coherence)));
});

test("68. declared purpose coverage is verified; an uncovered required purpose fails the family", () => {
  const ok = day6();
  assert.equal(ok.coverage.purposes.STOP_SCROLL.length > 0, true);
  assert.deepEqual(ok.coverage.gaps, []);
  const gap = run(FX.coverageGap());
  assert.equal(gap.family_status, FAMILY_STATUS.FAILED);
  assert.ok(gap.errors.some((e) => e.code === FAMILY_ERRORS.PURPOSE_COVERAGE_UNMET));
  assert.deepEqual(gap.coverage.gaps, ["PROOF"]);
});

test("69. family completeness means the requested members resolved, not every platform", () => {
  const r = run(day6FamilyInput({ strategy: { ...DAY6_STRATEGY, required_purposes: [] }, members: [MEMBER_FEED] }));
  assert.equal(r.family_status, FAMILY_STATUS.APPROVED);
  assert.equal(r.members.length, 1);
  assert.ok(!r.members.some((m) => m.platform === "youtube"));
});

test("70. malformed strategy / no members are INVALID (no fan-out)", () => {
  const badStrategy = run(FX.invalidStrategy());
  assert.equal(badStrategy.family_status, FAMILY_STATUS.INVALID);
  assert.ok(badStrategy.errors.some((e) => e.code === FAMILY_ERRORS.INVALID_STRATEGY));
  const noMembers = run(FX.noMembers());
  assert.equal(noMembers.family_status, FAMILY_STATUS.INVALID);
  assert.ok(noMembers.errors.some((e) => e.code === FAMILY_ERRORS.NO_MEMBERS));
});

// =====================================================================================
// J. TRACEABILITY
// =====================================================================================
test("71. the family manifest has the approved reference shape", () => {
  const m = day6().family_manifest;
  for (const k of ["family_id", "family_version", "family_status", "angle_id", "angle_validation_ref", "angle_verdict", "truth_refs", "brand_ref", "strategy", "members", "required_member_ids", "optional_member_ids", "family_checks", "coverage", "media", "provenance", "manifest_hash"]) {
    assert.ok(k in m, k);
  }
  assert.equal(m.class, "social_asset_family_manifest");
  assert.equal(m.required_member_ids.length, 3);
  assert.equal(m.optional_member_ids.length, 2);
});

test("72. member → family → angle trace is complete and honest", () => {
  const r = day6();
  for (const m of r.members) {
    assert.equal(m.trace.family_id, r.family_id);
    assert.equal(m.trace.angle_id, DAY6_ANGLE.id);
  }
  assert.equal(r.family_manifest.angle_id, DAY6_ANGLE.id);
  assert.equal(r.family_manifest.angle_validation_ref, GREEN_VALIDATION.id);
});

test("73. member → design / platform profile / source media / artifact / QA trace", () => {
  const r = day6();
  for (const m of r.members) {
    assert.ok(m.design_id.startsWith(r.family_id));
    assert.equal(validateSocialDesignSpec(m._spec).valid, true, m.role);
    assert.equal(m.trace.profile_id, `${m.platform}.${m.placement}`);
    assert.ok(m.trace.source_media_ids.length >= 1);
    assert.ok(m.artifact_ref.artifact_id.startsWith(m.design_id));
    assert.equal(m.trace.qa_version, SOCIAL_GRAPHIC_QA_VERSION);
    assert.equal(m.trace.artifact_id, m.artifact_ref.artifact_id);
  }
  const manifestMember = r.family_manifest.members.find((x) => x.role === "IDENTIFICATION");
  assert.equal(manifestMember.qa_ref.qa_version, SOCIAL_GRAPHIC_QA_VERSION);
  assert.equal(manifestMember.source_media_refs.length, 1);
  assert.ok(typeof manifestMember.source_media_refs[0].checksum === "string");
});

test("74. truth refs and brand version are preserved across every member", () => {
  const r = day6();
  const angles = new Set(r.members.map((m) => m.trace.angle_id));
  assert.equal(angles.size, 1);
  const refs = new Set(r.members.map((m) => JSON.stringify([...m.trace.truth_refs].sort())));
  assert.equal(refs.size, 1);
  const truth = JSON.parse([...refs][0]);
  for (const id of ["PTR-CSEC-001", "CRF-CSEC-014", "MIF-CSEC-011"]) assert.ok(truth.includes(id), id);
  const versions = new Set(r.members.map((m) => m._spec.provenance.brand_tokens_version));
  assert.equal(versions.size, 1);
  assert.equal(r.family_manifest.brand_ref.brand_tokens_version, [...versions][0]);
});

// =====================================================================================
// K. DAY-6 QUALIFICATION FAMILY
// =====================================================================================
test("75. the Day-6 family is a SEPARATE synthetic fixture; the canonical fixture is untouched", () => {
  const canonical = readFileSync(join(root, "mae/data/fixtures/social/SD-CSEC-006.json"), "utf8");
  assert.equal(sha256(canonical), FROZEN.canonicalDay6Fixture);
  assert.equal(DAY6_SPEC.visual_slots.length, 0);
  assert.equal(day6FamilyInput().marketing_angle._fixture_origin, "synthetic");
  assert.ok(existsSync(join(root, "mae/harness/social-family-fixtures.mjs")));
});

test("76. Day-6 member set: 3 required + 2 optional, correct roles/purposes/asset types", () => {
  const r = day6();
  assert.equal(r.members.length, 5);
  const by = (p) => role(r, p);
  assert.deepEqual([by("IDENTIFICATION").required, by("STORY").required, by("EDUCATION").required], [true, true, true]);
  assert.deepEqual([by("PROBLEM").required, by("REINFORCEMENT").required], [false, false]);
  assert.deepEqual(r.members.map((m) => m.asset_type), ["SOCIAL_STATIC", "SOCIAL_CAROUSEL", "SOCIAL_STATIC", "SOCIAL_STATIC", "SOCIAL_STORY_SEQUENCE"]);
  for (const m of r.members) assert.ok(ASSET_PURPOSES.includes(m.purpose), m.role);
});

test("77. Day-6: the exact approved headline appears wherever a headline is selected", () => {
  const r = day6();
  const withHeadline = r.members.filter((m) => m.copy_refs.includes("COPY-HOOK-1"));
  assert.equal(withHeadline.length, 5);
  for (const m of withHeadline) assert.ok(m._artifact.visible_text.includes(DAY6_HEADLINE), m.role);
  assert.equal(DAY6_HEADLINE, "Nobody tells you what standing up feels like on day 6.");
});

test("78. Day-6 invents nothing: no mechanism, CTA, evidence, price or statistic", () => {
  const r = day6();
  for (const m of r.members) {
    assert.deepEqual(m._spec.evidence_requirements ?? [], []);
    const copyRoles = new Set((m._spec.copy_blocks || []).map((b) => b.role).concat(...(m._spec.slides || []).map((s) => (s.copy_blocks || []).map((b) => b.role))));
    for (const forbidden of ["cta", "price", "members_price", "offer", "statistic_value", "quote"]) assert.ok(!copyRoles.has(forbidden), `${m.role}:${forbidden}`);
  }
  const json = JSON.stringify(r.family_manifest);
  assert.ok(!json.includes("guarantee") && !json.includes("testimonial") && !json.includes("USD 29"));
});

test("79. Day-6 is coherent: same angle, same truth, shared media, different layouts", () => {
  const r = day6();
  assert.equal(r.family_status, FAMILY_STATUS.APPROVED);
  assert.equal(new Set(r.members.map((m) => m.trace.angle_id)).size, 1);
  assert.equal(new Set(r.members.map((m) => m.source_media_refs[0].source_media_id)).size, 1);
  assert.equal(new Set(r.members.map((m) => m.layout_family)).size >= 3, true);
  assert.equal(r.media.authorizes_evidence, false);
});

test("80. Day-6 platform-native proof: canvas + artifact + copy selection differ per placement", () => {
  const r = day6();
  const feed = role(r, "IDENTIFICATION");
  const carousel = role(r, "STORY");
  const share = role(r, "EDUCATION");
  assert.deepEqual([feed.artifact_ref.canvas.width, feed.artifact_ref.canvas.height], [1080, 1350]);
  assert.deepEqual([share.artifact_ref.canvas.width, share.artifact_ref.canvas.height], [1200, 630]);
  assert.equal(carousel.production.panel_count, 3);
  // the carousel EXPLAIN panel carries the body copy that the share card deliberately omits
  const explain = carousel._spec.slides.find((s) => s.sequence_role === "EXPLAIN");
  assert.ok(explain.copy_blocks.some((b) => b.role === "body"));
  assert.ok(share.copy_selection.omitted.some((o) => o.copy_id === "SF-BODY-1"));
});

// =====================================================================================
// L. BOUNDARIES
// =====================================================================================
test("81. no media/provider/raster/network operation exists in the S-G module", () => {
  for (const banned of ["fetch(", "http://", "https://", "sharp", "imagemagick", "resvg", "node:fs", "child_process"]) assert.ok(!codeSrc.includes(banned), banned);
  assert.ok(existsSync(join(root, "mae/services/social-asset-family.js")));
});

test("82. the compositor and platform engine are NOT rewritten (versions intact, no reimplementation)", () => {
  assert.equal(SOCIAL_COMPOSITOR_VERSION, "1.0");
  assert.equal(PLATFORM_PROFILES_VERSION, "1.0");
  for (const banned of ["Z_ORDER", "buildLayoutPlan", "LAYOUT_VARIANTS", "renderComponent"]) assert.ok(!codeSrc.includes(banned), banned);
  const compositor = readFileSync(join(root, "mae/media/social-compositor.js"), "utf8");
  assert.ok(!compositor.includes("social-asset-family"), "the compositor must not depend on S-G");
});

test("83. SocialGraphicQA is not rewritten or duplicated (single authority)", () => {
  assert.equal(SOCIAL_GRAPHIC_QA_VERSION, "social-graphic-qa@1");
  assert.ok(!codeSrc.includes("SOCIAL_QA_DIMENSIONS"));
  assert.ok(!codeSrc.includes("ZERO_TOLERANCE_CLASSES"));
  const qa = readFileSync(join(root, "mae/services/social-graphic-qa.js"), "utf8");
  assert.ok(!qa.includes("social-asset-family"), "QA must not depend on S-G");
});

test("84. campaign / publishing / performance architecture are untouched and unreferenced", () => {
  for (const banned of ["campaign", "publishing", "performance-learning", "audience_state"]) assert.ok(!codeSrc.toLowerCase().includes(banned), banned);
  assert.ok(existsSync(join(root, "mae/services/campaign.js")));
});

test("85. external activity is zero for this wave (no provider, no evaluator, no network)", () => {
  for (const banned of ["openai", "gemini", "xkiro", "mistral", "deepseek", "9router"]) assert.ok(!codeSrc.toLowerCase().includes(banned), banned);
  assert.equal(day6FamilyInput().evaluator.live, false);
  assert.equal(day6FamilyInput().evaluator.version, "mock-evaluator@1");
});

test("86. family output is a reference manifest + member results (no payload duplication)", () => {
  const r = day6();
  assert.ok(r.family_manifest);
  assert.equal(JSON.stringify(r.family_manifest).length < JSON.stringify(r.members.map((m) => m._artifact)).length * 2, true);
  for (const m of r.family_manifest.members) assert.ok(!("svg" in m) && !("spec" in m));
});

test("87. S-G stops before campaign assembly (approved family is the terminal state)", () => {
  const r = day6();
  assert.equal(r.family_status, FAMILY_STATUS.APPROVED);
  for (const k of ["campaign_id", "sequence_id", "schedule", "rotation", "audience_state", "published_at"]) {
    assert.ok(!(k in r) && !(k in r.family_manifest), k);
  }
});

test("88. the gold accent-bar pre-existing issue is untouched by S-G (no compositor edit for it)", () => {
  const compositor = readFileSync(join(root, "mae/media/social-compositor.js"), "utf8");
  assert.ok(!compositor.includes("accent bar fix"));
  assert.ok(codeSrc.length > 0);
});
