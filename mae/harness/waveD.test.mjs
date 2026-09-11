// MAE Wave D — QA + Family + Governance (Gate D: QA/Governance Integrity).
import { test } from "node:test";
import assert from "node:assert/strict";
import { QAOrchestrator, GATES } from "../services/qa.js";
import { AssetFamilyService } from "../services/family.js";
import { GovernanceService } from "../services/governance.js";
import { AssetArchitectureService } from "../services/architecture.js";
import { GenerationService } from "../services/generation.js";
import { buildCsecAngle, validateCsecAngle, csecApprovedFamily, csecApprove, CSEC_ASSET_SPECS } from "./fixtures.mjs";

function ctx(over = {}) {
  const angle = over.angle || buildCsecAngle();
  const validation = over.validation || validateCsecAngle(angle);
  const brief = AssetArchitectureService.buildBrief(angle, validation, {
    platform: over.platform || "whatsapp",
    asset_type: over.asset_type || "WhatsApp broadcast",
    asset_purpose: over.asset_purpose || "stop_scroll_identification",
    ...(over.brief || {}),
  });
  const gen = GenerationService.generate(brief);
  const asset = {
    asset_id: over.asset_id || "AST-CSEC-1", asset_type: brief.asset_type, platform: brief.platform,
    asset_purpose: brief.asset_purpose, product_id: angle.product_id, angle_id: angle.id, brief_id: brief.id,
  };
  return { angle, validation, brief, gen, asset };
}
function qa(content, over = {}) {
  const c = ctx(over);
  return QAOrchestrator.run({
    id: over.id, asset: c.asset, angle: c.angle, validation: c.validation, brief: c.brief, generated: c.gen,
    content, artifacts: over.artifacts || [], lockedPhraseSet: over.lockedPhraseSet || null, context: over.context || {},
  });
}

test("seven gates run in the fixed canonical order", () => {
  const { record } = qa("Day 6 at 3 AM, Module 2 helps her stand without bracing. Reply YES.");
  assert.deepEqual(record.gates.map((g) => g.gate), GATES);
});

test("gate 1: a Tier-1 registry phrase is an automatic reject", () => {
  const { record } = qa("In today's fast-paced world, unlock your potential. You deserve more.");
  assert.equal(record.gates[0].result, "FAIL");
  assert.equal(record.overall, "FAIL");
  assert.equal(record.qa_status, "REJECTED");
});

test("gate 1: a Tier-2 contextual pattern is flagged for human review, not auto-approved", () => {
  const { record } = qa("Let's be honest, day 6 at 3 AM with Module 2 is hard. Reply YES.");
  assert.equal(record.gates[0].result, "FLAG");
  assert.ok(record.human_review?.required);
});

test("gate 2: interchangeable generic copy fails the Interchangeability Test", () => {
  const { record } = qa("You are not alone. Take it one step at a time. You are stronger than you know.");
  assert.equal(record.gates[1].result, "FAIL");
});

test("gate 2: a generated-scene visual with fewer than 3 scene-specific details fails", () => {
  const vg = { scene: "a room", environment: "home", gesture_posture: "standing", props: [], lighting: "soft", composition: "centred", exclusions: ["generic stock clichés"] };
  const { record } = qa("Day 6 at 3 AM, Module 2 helps her stand without bracing from the incision.", { brief: { visual_grounding: vg }, artifacts: [{ id: "ART-CSEC-9", mime_type: "image/png" }] });
  assert.equal(record.gates[1].result, "FAIL");
  assert.match(record.gates[1].reason, /fewer than 3|scene-specific/i);
});

test("gate 3: an over-length WhatsApp asset is auto-fixed, never silently passed", () => {
  const long = Array.from({ length: 320 }, () => "word").join(" ");
  const { record, content } = qa(long);
  assert.equal(record.gates[2].result, "AUTO_FIXED");
  assert.ok(content.split(/\s+/).length <= 300);
});

test("gate 4: generated-scene cultural representation forces human review", () => {
  const { record } = qa("Day 6 at 3 AM, Module 2 helps her stand without bracing.", { artifacts: [{ id: "ART-CSEC-9", mime_type: "image/png" }], context: { production_mode: "GENERATED_SCENE" } });
  assert.equal(record.gates[3].result, "FLAG");
  assert.ok(record.human_review?.required);
});

test("gate 4: a faith-inflected declaration without per-product approval fails", () => {
  const angle = buildCsecAngle();
  angle.affirmation_grounding = { register: "declaration", faith_inflected: true, anchor_fear_or_constraint: "fear of moving after surgery on day 6 without support" };
  const { record } = qa("Day 6, Module 2. I can move again by grace.", { angle });
  assert.equal(record.gates[3].result, "FAIL");
});

test("gate 5: a universality claim against counter-evidence fails", () => {
  const { record } = qa("Every mother feels this on day 6. Module 2 helps her stand without bracing.");
  assert.equal(record.gates[4].result, "FAIL");
  assert.match(record.gates[4].reason, /universal/i);
});

test("gate 5: an uncovered overclaim is rejected and cannot be trimmed", () => {
  const { record } = qa("Day 6, Module 2 — guaranteed pain-free movement within a few days.");
  assert.equal(record.gates[4].result, "FAIL");
  assert.equal(record.gates[4].remediation, "Automatic reject — rewrite the claim upstream (no trim fix)");
});

test("gate 5: interpretation leakage (motivation asserted as fact) fails", () => {
  const angle = buildCsecAngle();
  angle.tier1.emotional_stake.evidence_status = "analyst_interpretation";
  const { record } = qa("Day 6 at 3 AM, Module 2. She is frustrated because no one explained the positioning.", { angle });
  assert.equal(record.gates[4].result, "FAIL");
  assert.match(record.gates[4].reason, /interpretation leakage/i);
});

test("gate 5: an absolute absence claim without scan coverage fails", () => {
  const { record } = qa("Day 6, Module 2. Nobody else offers this technique. Reply YES.");
  assert.equal(record.gates[4].result, "FAIL");
  assert.match(record.gates[4].reason, /absence/i);
});

test("gate 6: contradicting the Locked Phrase Set is an automatic reject", () => {
  const pset = { id: "PSET-X", phrases: ["day 6", "3 am", "module 2"], established_by_asset_id: "AST-OTHER" };
  const { record } = qa("By day 5, Module 2 helps her stand without bracing.", { lockedPhraseSet: pset });
  assert.equal(record.gates[5].result, "FAIL");
  assert.match(record.gates[5].reason, /locked phrase/i);
});

test("gate 7: a sensitive-domain asset requires human review and reports pending, never a fake pass", () => {
  const { record } = qa("At 3 AM, with the baby finally asleep, Module 2 helps her rise without bracing. Reply YES.", { context: { sensitive_domain: true } });
  assert.equal(record.overall, "HUMAN_REVIEW_REQUIRED");
  assert.equal(record.qa_status, "HUMAN_REVIEW_PENDING");
  assert.ok(record.human_review.required);
});

test("gate 7: spot-check sampling is an explicit boolean, never a hidden pass", () => {
  const { record } = qa("At 3 AM, with the baby finally asleep, Module 2 helps her rise without bracing. Reply YES.", { context: { human_review: { decision: "APPROVED", reviewer: "r" } } });
  assert.equal(typeof record.spot_check_selected, "boolean");
});

test("a QA record is permanent and retrievable", () => {
  const { record } = qa("Day 6 at 3 AM, Module 2 helps her stand without bracing. Reply YES.", { id: "QA-CSEC-PERM", context: { human_review: { decision: "APPROVED", reviewer: "r" } } });
  QAOrchestrator.save(record);
  assert.equal(QAOrchestrator.get("QA-CSEC-PERM").id, "QA-CSEC-PERM");
});

test("a rejected candidate cannot become an AssetRecord (no approval by association)", () => {
  assert.throws(() => GovernanceService.registerAsset({
    qa: { id: "QA-X", qa_status: "REJECTED" }, candidate: { asset_id: "AST-X", content: "x" },
    angle: { id: "ANG-CSEC-006", product_id: "PROD-CSEC", tier3: {} }, validation: { verdict: "GREEN" },
    brief: { id: "BRIEF-X", asset_type: "t", platform: "whatsapp", asset_purpose: "problem", truth_weighting: {} }, generated: { id: "GEN-X" },
  }), /QA-approved|REJECTED|only a QA-approved/);
});

test("family entry requires a GREEN or YELLOW verdict", () => {
  const { angle } = csecApprovedFamily();
  const assets = GovernanceService.listAssets().filter((a) => a.angle_id === angle.id).slice(0, 1);
  assert.throws(() => AssetFamilyService.assemble({ angle, validation: { verdict: "RED", approved_platforms: [] }, assets, persist: false }), /GREEN or YELLOW/);
});

test("the Anchor establishes the Locked Phrase Set", () => {
  const { family, pset } = csecApprovedFamily();
  assert.equal(pset.established_by_asset_id, family.anchor_asset_id);
  assert.ok(pset.phrases.length >= 1);
});

test("family role is inventory, not sequence position", () => {
  const { family } = csecApprovedFamily();
  assert.equal("sequence_position" in family, false);
  assert.ok(Object.values(family.role_map).every((r) => typeof r === "string"));
});

test("family breadth is not a fixed quota — a single strong asset is valid", () => {
  const { angle, validation } = (() => { const f = csecApprovedFamily(); return f; })();
  const one = GovernanceService.getAsset("AST-CSEC-1");
  const { family } = AssetFamilyService.assemble({ angle, validation, assets: [one], id: "FAM-CSEC-ONEX", psetId: "PSET-CSEC-ONEX", persist: false });
  assert.equal(family.approved_asset_ids.length, 1);
});

test("family QA passes for a coherent, differentiated family", () => {
  const f = csecApprovedFamily();
  const r = AssetFamilyService.familyQA(f.family, { assets: f.assets });
  assert.equal(r.pass, true, JSON.stringify(r.checks.filter((c) => !c.pass)));
});

test("family redundancy detects two assets doing the same creative job", () => {
  const { angle, validation } = (() => { const x = csecApprovedFamily(); return x; })();
  const a = csecApprove({ id: "AST-CSEC-R1", platform: "instagram", asset_type: "Problem-led social post", asset_purpose: "problem" }, { angle, validation });
  const b = csecApprove({ id: "AST-CSEC-R2", platform: "instagram", asset_type: "Problem-led social post", asset_purpose: "problem" }, { angle, validation });
  const { redundancy } = AssetFamilyService.assemble({ angle, validation, assets: [a.asset, b.asset], id: "FAM-CSEC-REDX", psetId: "PSET-CSEC-REDX", persist: false });
  assert.ok(redundancy.length >= 1);
});

test("asset lineage resolves from the asset back to source truth", () => {
  const f = csecApprovedFamily();
  const lin = GovernanceService.resolveLineage("AST-CSEC-1");
  assert.equal(lin.status, "TRACEABILITY_COMPLETE", JSON.stringify(lin.missing));
  assert.equal(lin.chain.angle.id, f.angle.id);
  assert.ok(lin.chain.qa && lin.chain.brief && lin.chain.generation && lin.chain.validation);
});

test("a new creative version does not inherit approval", () => {
  const f = csecApprovedFamily();
  const v2 = GovernanceService.newVersion("AST-CSEC-1", { content: f.assets[0].content + " Changed." });
  assert.equal(v2.asset_version, 2);
  assert.equal(v2.status, "RE_VERIFICATION_REQUIRED");
});

test("retirement is not deletion — history is preserved", () => {
  const f = csecApprovedFamily();
  const retired = GovernanceService.retireAsset("AST-CSEC-1", { reason: "superseded creative" });
  assert.equal(retired.status, "RETIRED");
  assert.ok(retired.retired_at);
  assert.ok(Array.isArray(retired.dependency_refs));
});

test("a material source change identifies and flags dependents", () => {
  csecApprovedFamily();
  const affected = GovernanceService.markReVerification("product", "PTR-CSEC-001");
  assert.ok(affected.angles.includes("ANG-CSEC-006"));
  assert.equal(affected.status, "RE-VERIFICATION REQUIRED");
  const fam = AssetFamilyService.get("FAM-CSEC-006");
  assert.equal(fam.family_status, "RE_VERIFICATION_REQUIRED");
});

test("usage is tracked separately from asset identity (one asset, many usages)", () => {
  csecApprovedFamily();
  const a = GovernanceService.getAsset("AST-CSEC-2");
  const u1 = GovernanceService.createUsage({ asset_id: a.id, family_id: a.family_id, angle_id: a.angle_id, sequence_type: "LAUNCH", audience_state: "problem_aware", platform: a.platform, cta_level: a.cta_level, emotional_intensity: a.emotional_intensity });
  const u2 = GovernanceService.createUsage({ asset_id: a.id, family_id: a.family_id, angle_id: a.angle_id, sequence_type: "RETARGETING", audience_state: "product_aware", platform: a.platform, cta_level: a.cta_level, emotional_intensity: a.emotional_intensity });
  assert.notEqual(u1.id, u2.id);
  assert.equal(GovernanceService.getAsset(a.id).usage_ids.length, 2);
});
