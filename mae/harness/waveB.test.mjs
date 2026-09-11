// MAE Wave B — Angle Record + Validation Gate tests (Gate B: Angle Integrity).
import { test } from "node:test";
import assert from "node:assert/strict";
import { AngleService } from "../services/angle.js";
import { AngleValidationService } from "../services/validation.js";
import { csecAngleInput, buildCsecAngle, validateCsecAngle, csecAngleWithValidation } from "./fixtures.mjs";
import { transition } from "../lib/transition.js";

test("angle requires at least one Customer Reality citation", () => {
  const input = csecAngleInput();
  input.tier3.source_evidence = [];
  assert.throws(() => AngleService.build(input), /Customer Reality citation|schema validation failed/);
});

test("angle requires a truth conflict log (rule 3.4 logged even when empty)", () => {
  const input = csecAngleInput();
  delete input.tier3.truth_conflict_log;
  assert.throws(() => AngleService.build(input), /truth_conflict_log|schema validation failed/);
});

test("insight is labelled Strategic Synthesis, never raw fact", () => {
  const angle = buildCsecAngle();
  assert.equal(angle.tier2.insight.label, "Strategic Synthesis");
});

test("generic affirmation grounding is rejected", () => {
  assert.throws(() => AngleService.buildAffirmationGrounding({
    source_record: "ANG-CSEC-006", grounding_tier: "micro", anchor_fear_or_constraint: "You are enough",
    anchor_desired_change: "Feel better", register: "affirmation", faith_inflected: false, what_to_avoid: ["You are enough"],
  }), /specific, not thematic/);
});

test("faith register is gated (off by default)", () => {
  const angle = buildCsecAngle();
  assert.equal(AngleService.faithRegisterAllowed(angle.product_id), false);
});

test("worked-example Day-6 angle validates GREEN with a defined narrow scope", () => {
  const { validation } = csecAngleWithValidation();
  assert.equal(validation.verdict, "GREEN");
  assert.equal(validation.max_assets, null);
  assert.equal(validation.human_review_required, true); // sensitive (health) domain
  assert.ok(validation.counter_evidence_restatement.length > 0);
});

test("proof failure makes the angle RED (Criterion 2 hard blocker)", () => {
  const input = csecAngleInput();
  input.tier2.angle = "Guaranteed pain-free movement after your C-section.";
  const angle = AngleService.build(input);
  const v = AngleValidationService.evaluate(angle, { persist: false });
  assert.equal(v.verdict, "RED");
  assert.equal(v.max_assets, 0);
  assert.match(v.rejection_reason, /Criterion 2/);
});

test("brand failure makes the angle RED (Criterion 4 hard blocker)", () => {
  const input = csecAngleInput();
  input.tier2.angle = "Transform your life by standing up on day 6.";
  const angle = AngleService.build(input);
  const v = AngleValidationService.evaluate(angle, { persist: false });
  assert.equal(v.verdict, "RED");
  assert.match(v.rejection_reason, /Criterion 4/);
});

test("weak resonance with no corroboration is RED", () => {
  const angle = buildCsecAngle();
  const v = AngleValidationService.evaluate(angle, { criteria: { customer_resonance: "weak" }, corroborated: false, persist: false });
  assert.equal(v.verdict, "RED");
});

test("a weak-criterion angle is YELLOW and scope-limited to 4-6 assets", () => {
  const angle = buildCsecAngle();
  const v = AngleValidationService.evaluate(angle, { criteria: { market_differentiation: "weak" }, scope_note: "restricted", persist: false });
  assert.equal(v.verdict, "YELLOW");
  assert.equal(v.max_assets, 6);
  assert.ok(v.yellow_reason && v.yellow_reason.length > 0);
});

test("moderate criterion triggers mandatory human review", () => {
  const angle = buildCsecAngle();
  const v = AngleValidationService.evaluate(angle, { criteria: { market_differentiation: "moderate" }, persist: false });
  assert.equal(v.human_review_required, true);
  assert.ok(v.human_review_reason);
});

test("faith declaration forces mandatory human review", () => {
  const angle = buildCsecAngle();
  const v = AngleValidationService.evaluate(angle, { faith_declaration: true, persist: false });
  assert.equal(v.human_review_required, true);
  assert.match(v.human_review_reason, /faith/);
});

test("a RED angle is retained, not deleted", () => {
  const angle = buildCsecAngle();
  const v = AngleValidationService.evaluate(angle, { criteria: { brand_alignment: "fail" }, persist: false });
  assert.equal(v.verdict, "RED");
  const red = transition("angle", { ...angle, status: "VALIDATION_PENDING" }, "RED");
  assert.equal(red.status, "RED");
  assert.ok(red.state_history.length >= 1);
  assert.throws(() => transition("angle", red, "ARCHITECTED"), /illegal angle transition/);
});

test("validation record is schema-valid", () => {
  const { validation } = csecAngleWithValidation();
  assert.equal(validation.class, "angle_validation_record");
  assert.ok(validation.id.startsWith("VAL-"));
});
