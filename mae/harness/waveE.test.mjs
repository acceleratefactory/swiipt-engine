// MAE Wave E — Campaign Orchestration (Gate E: Campaign Integrity).
import { test } from "node:test";
import assert from "node:assert/strict";
import { AudienceStateService, SequenceService, CampaignService, RotationService, FatigueService, CalendarService, GapRequestService, SEQUENCE_TYPES, SEQUENCE_PROGRESSIONS } from "../services/campaign.js";
import { GovernanceService } from "../services/governance.js";
import { csecApprovedFamily } from "./fixtures.mjs";

function inventory() {
  const f = csecApprovedFamily();
  const eligible = f.family.approved_asset_ids.map((id) => ({ asset: GovernanceService.getAsset(id), family: f.family }));
  return { ...f, eligible };
}
const fam = (id, over = {}) => ({ id, angle_verdict: "GREEN", family_status: "APPROVED", sequence_eligibility: ["LAUNCH", "NURTURE", "RETARGETING", "RE_ENGAGEMENT"], role_map: {}, evergreen_eligible: true, ...over });
const ast = (id, role, over = {}) => ({ id, status: "APPROVED", family_role: role, platform: "whatsapp", cta_level: "SOFT_CTA", emotional_intensity: "medium", ...over });

test("audience state is required before asset selection", () => {
  assert.throws(() => RotationService.select({ sequence_type: "LAUNCH", objective: "recognition", required_roles: ["PROBLEM"], eligible: [] }), /audience state/);
});

test("objective is required before asset selection", () => {
  assert.throws(() => RotationService.select({ sequence_type: "LAUNCH", audience_state: "problem_aware", required_roles: ["PROBLEM"], eligible: [] }), /objective/);
});

test("hard exclusions remove Red families and retired assets", () => {
  const r = RotationService.select({
    sequence_type: "LAUNCH", audience_state: "problem_aware", objective: "recognition", required_roles: ["PROBLEM"],
    eligible: [
      { asset: ast("AST-A", "PROBLEM"), family: fam("FAM-RED", { angle_verdict: "RED", role_map: { "AST-A": "PROBLEM" } }) },
      { asset: ast("AST-B", "PROBLEM", { status: "RETIRED" }), family: fam("FAM-B", { role_map: { "AST-B": "PROBLEM" } }) },
    ],
  });
  assert.equal(r.selected, null);
  assert.ok(r.excluded.some((e) => /Red Angle/.test(e.reason)));
  assert.ok(r.excluded.some((e) => /RETIRED/.test(e.reason)));
});

test("all four sequence types assemble from eligible inventory", () => {
  const { eligible } = inventory();
  for (const type of SEQUENCE_TYPES) {
    const { sequence } = SequenceService.assemble({ campaign_id: "CAMP-CSEC-1", sequence_type: type, audience_state: "problem_aware", eligible, persist: false });
    assert.ok(sequence.items.length >= 1, `${type} produced no items`);
    assert.equal(sequence.status, "QA_PENDING");
  }
  assert.equal(SEQUENCE_TYPES.length, 4);
});

test("rotation is a decision, not a round-robin (fatigue shifts selection)", () => {
  const eligible = [
    { asset: ast("AST-A", "PROBLEM"), family: fam("FAM-A", { role_map: { "AST-A": "PROBLEM" } }) },
    { asset: ast("AST-B", "PROBLEM"), family: fam("FAM-B", { role_map: { "AST-B": "PROBLEM" } }) },
  ];
  const fresh = RotationService.select({ sequence_type: "LAUNCH", audience_state: "problem_aware", objective: "recognition", required_roles: ["PROBLEM"], eligible });
  const withExposure = RotationService.select({ sequence_type: "LAUNCH", audience_state: "problem_aware", objective: "recognition", required_roles: ["PROBLEM"], eligible, exposure: { asset: { "AST-A": 5 }, family: {}, cta: {} } });
  assert.ok(fresh.selected);
  assert.equal(withExposure.selected.asset.id, "AST-B");
});

test("campaign QA fails on emotional density even when individual assets pass", () => {
  const seq = { id: "SEQ-X", campaign_id: "CAMP-X", items: [
    { position: 1, asset_id: "AST-1", family_id: "FAM-1", role: "PROBLEM", cta_level: "NO_CTA", emotional_intensity: "high", proof_type: null },
    { position: 2, asset_id: "AST-2", family_id: "FAM-1", role: "IDENTIFICATION", cta_level: "NO_CTA", emotional_intensity: "high", proof_type: null },
    { position: 3, asset_id: "AST-3", family_id: "FAM-2", role: "STORY", cta_level: "NO_CTA", emotional_intensity: "high", proof_type: null },
    { position: 4, asset_id: "AST-4", family_id: "FAM-2", role: "OBJECTION", cta_level: "NO_CTA", emotional_intensity: "high", proof_type: null },
  ] };
  const qa = SequenceService.sequenceQA(seq, { assets: [] });
  assert.equal(qa.pass, false);
  assert.ok(qa.checks.some((c) => c.check === "emotional_balance" && !c.pass));
});

test("CTA progression prevents clustered hard conversion asks", () => {
  const seq = { id: "SEQ-Y", campaign_id: "CAMP-Y", audience_state: "problem_aware", items: [
    { position: 1, asset_id: "AST-1", family_id: "FAM-1", role: "CONVERSION", cta_level: "DIRECT_CONVERSION_CTA", emotional_intensity: "conversion", proof_type: null },
    { position: 2, asset_id: "AST-2", family_id: "FAM-1", role: "TRANSFORMATION", cta_level: "DIRECT_CONVERSION_CTA", emotional_intensity: "conversion", proof_type: null },
  ] };
  const qa = SequenceService.sequenceQA(seq, {});
  assert.ok(qa.checks.some((c) => c.check === "cta_progression" && !c.pass));
});

test("missing inventory raises a gap request rather than freehand generation", () => {
  const { eligible } = inventory();
  const { sequence, gaps } = SequenceService.assemble({ campaign_id: "CAMP-CSEC-GAP", sequence_type: "LAUNCH", audience_state: "problem_aware", eligible, persist: false });
  assert.ok(gaps.length >= 1, "expected at least one gap (no MECHANISM/PROOF/OBJECTION inventory)");
  assert.ok(sequence.gap_request_ids.length === gaps.length);
  assert.equal(gaps[0].status, "OPEN");
});

test("sequence QA can fail even though every asset passed asset QA", () => {
  const qa = SequenceService.sequenceQA({ id: "SEQ-EMPTY", campaign_id: "CAMP-E", items: [], audience_state: "problem_aware" }, {});
  assert.equal(qa.pass, false);
});

test("conversion suppresses acquisition sequences", () => {
  const converted = AudienceStateService.convert("segment-1", { product_id: "PROD-CSEC" });
  assert.equal(converted.suppression, true);
  const r = RotationService.select({
    sequence_type: "LAUNCH", audience_state: "recently_converted", objective: "recognition", required_roles: ["PROBLEM"],
    eligible: [{ asset: ast("AST-A", "PROBLEM"), family: fam("FAM-A", { role_map: { "AST-A": "PROBLEM" } }) }],
  });
  assert.equal(r.selected, null);
  assert.ok(r.excluded.some((e) => /acquisition sequence suppressed/.test(e.reason)));
});

test("a Yellow family is restricted but still eligible within scope", () => {
  const f = fam("FAM-YELLOW", { family_status: "RESTRICTED", angle_verdict: "YELLOW", role_map: { "AST-Y": "PROBLEM" } });
  const r = RotationService.select({ sequence_type: "LAUNCH", audience_state: "problem_aware", objective: "recognition", required_roles: ["PROBLEM"], eligible: [{ asset: ast("AST-Y", "PROBLEM"), family: f }] });
  assert.ok(r.selected);
});

test("a campaign cannot schedule a retired asset", () => {
  const f = fam("FAM-R", { role_map: { "AST-R": "PROBLEM" } });
  const r = RotationService.select({ sequence_type: "LAUNCH", audience_state: "problem_aware", objective: "recognition", required_roles: ["PROBLEM"], eligible: [{ asset: ast("AST-R", "PROBLEM", { status: "RETIRED" }), family: f }] });
  assert.equal(r.selected, null);
});

test("a READY campaign assembles, passes campaign QA and schedules usage through Section 9", () => {
  const { eligible } = inventory();
  const converted = AudienceStateService.record({ segment: "csection-new-mothers", state: "problem_aware" });
  const { campaign, sequences: builtSeqs, gaps } = CampaignService.assemble({
    product_id: "PROD-CSEC", objective: "launch recognition to conversion", audience_states: ["problem_aware"],
    kpi_set: ["recognition", "conversion"],
    sequence_specs: [{ sequence_type: "LAUNCH", audience_state: "problem_aware", platform: null, total_slots: 3 }],
    eligible, persist: false,
  });
  const seq = builtSeqs[0];
  const qa = SequenceService.sequenceQA(seq, {}); // may pass
  const campaignQA = CampaignService.campaignQA({ ...campaign, gap_request_ids: [] }, [seq]);
  assert.ok(Array.isArray(campaignQA.checks));
  const ready = { ...seq, status: "READY" };
  const { usages } = CalendarService.schedule(ready, { governance: GovernanceService, start: "2026-09-20T09:00:00Z", cadenceDays: 1 });
  assert.equal(usages.length, ready.items.length);
  assert.ok(usages.every((u) => u.id.startsWith("USE-")));
  assert.ok(converted.id.startsWith("AUD-"));
});
