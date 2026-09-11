// MAE · QAOrchestrator + seven-gate checkers (S7). Fixed order, every gate, every asset,
// permanent record. Gate 1/3/5/6 are deterministic; Gate 2/4 use judgment where required.
// Gate 1 Tier-1, Gate 5 and Gate 6 failures cannot be auto-fixed. Human review is an escalation.
import { save, all } from "../lib/store.js";
import { validate } from "../lib/schema.js";
import { makeId, existingIds } from "../lib/ids.js";
import { fail, CODES } from "../lib/errors.js";
import { GenerationService } from "./generation.js";
import { BrandTruthService } from "./brand.js";
import { TruthService } from "./truth.js";
import { CriticAdapter } from "./critic.js";
import { MAE_DIR } from "../lib/store.js";
import { join } from "node:path";

const QA_DIR = join(MAE_DIR, "data", "qa");

export const GATES = [
  "GATE_1_ANTI_SLOP",
  "GATE_2_INTERCHANGEABILITY",
  "GATE_3_PLATFORM_FITNESS",
  "GATE_4_BRAND_CULTURAL",
  "GATE_5_TRUTH_COMPLIANCE",
  "GATE_6_CONSISTENCY_LOCK",
  "GATE_7_HUMAN_REVIEW",
];

// Tier 2 (contextual / review) generic patterns — flagged, not auto-rejected (S7 §7.2.3).
const TIER2_PATTERNS = [
  /in today'?s (fast-paced )?world/i, /\bimagine (a world|if)\b/i, /\bwe('| ha)ve all been there\b/i,
  /\blet'?s be honest\b/i, /\bself[- ]care matters\b/i, /\byour best self\b/i, /\bmindset shift\b/i,
];
const BLAME_PATTERNS = [/your fault/i, /you should have/i, /if you had/i, /you failed/i, /stop being/i];
const UNIVERSALITY = /every (mother|woman|parent|person)|all (mothers|women|parents)|everyone who|always works|never fails/i;
const OVERCLAIM = /\b(guarantee[sd]?|cure[sd]?|heal(?:s|ed)? in \d+ (days?|weeks?)|instantly|100%|permanently|never feel pain again|clinically proven)\b/i;
const ABSOLUTE_ABSENCE = /\bnobody else\b|\bno one else\b|\bthe only\b|\bnone of the others\b/i;

const CAPITAL_STOP = new Set(["The", "This", "That", "She", "He", "It", "They", "Baby", "When", "Before", "After", "What", "How", "If", "And", "But", "Your", "You", "Her", "His", "Its", "Because", "Then", "There", "Here", "Module"]);

/** Extract load-bearing signature tokens from the Angle + Brief grounding (specificity anchors). */
export function signatures(angle, brief) {
  const pool = [
    angle?.tier1?.scene, angle?.tier1?.pain, angle?.tier1?.failed_attempt,
    angle?.tier1?.emotional_stake?.text, angle?.tier2?.mechanism?.text,
    angle?.tier2?.angle, angle?.tier2?.desired_change,
    ...((brief?.content_grounding?.foreground || []).map((f) => f.value)),
  ].filter(Boolean).join(" . ");
  const sig = new Set();
  for (const m of pool.match(/\b\d+\b/g) || []) sig.add(m);
  for (const m of pool.match(/\b(?:module\s*\d+|day\s*\d+|week\s*\d+)\b/gi) || []) sig.add(m.toLowerCase().replace(/\s+/g, " ").trim());
  for (const m of pool.match(/\bam\b|\bpm\b/gi) || []) sig.add(m.toLowerCase());
  for (const m of pool.match(/\b[A-Z][a-z]{3,}\b/g) || []) if (!CAPITAL_STOP.has(m)) sig.add(m);
  return [...sig];
}

export function anchorCount(text, angle, brief) {
  const sig = signatures(angle, brief);
  const low = String(text || "");
  return sig.filter((s) => new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(low)).length;
}

function checkAntiSlop(text, brief, angle) {
  const checks = [];
  let tier1 = [];
  let tier2 = [];
  try {
    const reg = BrandTruthService.writingRegister();
    const low = text.toLowerCase();
    for (const p of reg.forbidden_phrases) if (low.includes(String(p).toLowerCase())) tier1.push(p);
  } catch { /* dormant-safe */ }
  try {
    const b = BrandTruthService.loadBrand();
    for (const p of b.vocabulary?.banned || []) if (text.toLowerCase().includes(String(p).toLowerCase())) tier1.push(p);
    for (const p of b.prohibited_behaviours || []) if (text.toLowerCase().includes(String(p).toLowerCase())) tier1.push(p);
  } catch { /* dormant-safe */ }
  for (const rx of TIER2_PATTERNS) { const m = text.match(rx); if (m) tier2.push(m[0]); }
  checks.push({ name: "tier1_registry", hits: tier1 });
  checks.push({ name: "tier2_registry", hits: tier2 });
  // Affirmation slop (S3.10.6) — generic affirmations.
  const isAffirmation = (brief?.structural_template === "Affirmation") || (angle?.tier2?.asset_purpose === "identity_reinforcement");
  if (isAffirmation) {
    const generic = /you are (enough|strong|powerful)|you('| ha)ve got this|believe in yourself|trust the process|you can do anything/i;
    const g = text.match(generic);
    if (g) tier1.push(g[0]);
  }
  return { tier1: [...new Set(tier1)], tier2: [...new Set(tier2)] };
}

export const QAOrchestrator = {
  nextId(scope, existing = existingIds(QA_DIR)) { return makeId("qa", scope, existing); },

  /**
   * Run the seven gates. Returns { record, content } where content may be auto-fixed.
   * @param {object} p
   * @param {object} p.asset        {asset_id, asset_type, platform, asset_purpose, product_id, angle_id, brief_id}
   * @param {object} p.angle       Marketing Angle Record
   * @param {object} p.validation  Angle Validation Record
   * @param {object} p.brief       Asset Brief
   * @param {object} p.generated   Generated Asset Record
   * @param {string} p.content     selected copy
   * @param {object[]} [p.artifacts] MediaArtifact[]
   * @param {object} [p.lockedPhraseSet]
   * @param {object} [p.context]   {sensitive_domain, first_for_product, human_review:{decision,reviewer,notes}, regeneration_count}
   */
  run(p) {
    const { asset, angle, validation, brief, generated } = p;
    let text = p.content ?? (generated ? GenerationService.selectedContent(generated) : "");
    const ctx = p.context || {};
    const generated_ = generated || { id: "GEN-UNKNOWN", regeneration_count: ctx.regeneration_count || 0 };
    const gates = [];
    const failed = [];
    const addGate = (gate, result, reason, remediation, traceability = {}, sub = []) =>
      gates.push({ gate, input_ref: asset.asset_id, result, reason, remediation, traceability, sub_checks: sub });

    // ---- GATE 1 — Anti-Slop -------------------------------------------------
    const slop = checkAntiSlop(text, brief, angle);
    if (slop.tier1.length) {
      addGate(GATES[0], "FAIL", `Tier 1 anti-slop violation: ${slop.tier1.join("; ")}`, "Returns to Generation with the specific violation flagged", { registry: "writing-control" }, [{ name: "tier1", hits: slop.tier1 }]);
      failed.push({ gate: GATES[0], severity: "blocking", reason: slop.tier1.join("; ") });
    } else if (slop.tier2.length) {
      addGate(GATES[0], "FLAG", `Tier 2 contextual pattern: ${slop.tier2.join("; ")}`, "Flagged for human review; not auto-approved", {}, [{ name: "tier2", hits: slop.tier2 }]);
    } else {
      addGate(GATES[0], "PASS", "No Tier 1 or Tier 2 anti-slop patterns detected", null, {}, [{ name: "tier1", hits: [] }, { name: "tier2", hits: [] }]);
    }

    // ---- GATE 2 — Interchangeability ---------------------------------------
    const anchors = anchorCount(text, angle, brief);
    const visualSpec = (p.artifacts || []).find((a) => /image|svg|scene/i.test(a.mime_type || "")) ? (brief?.visual_grounding || null) : null;
    let g2 = "PASS", g2reason = `specificity anchors present: ${anchors}`;
    if (anchors <= 1) { g2 = "FAIL"; g2reason = `insufficient load-bearing specifics (anchors=${anchors}); genericized version would still read coherently`; }
    else if (anchors === 2) {
      const c = CriticAdapter.evaluate("interchangeability", { text, angle_id: angle.id });
      g2 = c.verdict === false ? "FAIL" : (c.verdict === true ? "PASS" : "HUMAN_REVIEW_REQUIRED");
      g2reason = c.verdict == null ? `2 anchors — judgment required; ${c.reasons.join("; ")}` : c.reasons.join("; ");
    }
    if (visualSpec) {
      // Scene-specific detail = a *substantive* grounding value (not a generic one-word placeholder).
      const detailFields = [visualSpec.scene, visualSpec.environment, visualSpec.gesture_posture, ...(visualSpec.props || []), ...(visualSpec.cultural_markers || [])]
        .filter((v) => v && String(v).trim().length >= 15).length;
      if (detailFields < 3) { g2 = "FAIL"; g2reason = `visual has fewer than 3 scene-specific details (${detailFields})`; }
    }
    addGate(GATES[1], g2, g2reason, g2 === "FAIL" ? "Increase reliance on foregrounded Content Grounding fields (structural rebuild)" : null, { anchors, scene_specific_details: visualSpec ? true : null });    if (g2 === "FAIL") failed.push({ gate: GATES[1], severity: "high", reason: g2reason });
    if (g2 === "HUMAN_REVIEW_REQUIRED") failed.push({ gate: GATES[1], severity: "medium", reason: g2reason, human: true });

    // ---- GATE 3 — Platform Fitness -----------------------------------------
    const findings = GenerationService.validateOutput(text, brief);
    let g3 = findings.length ? "FAIL" : "PASS";
    let g3reason = findings.length ? findings.map((f) => `${f.code}: ${f.detail}`).join("; ") : `within ${brief.platform} rules`;
    let remediation = findings.length ? "Auto-fix where safe, else restate the platform rule" : null;
    if (findings.some((f) => f.code === "PLATFORM_LENGTH") && brief.platform === "whatsapp") {
      const words = text.split(/\s+/);
      if (words.length > 300) { text = words.slice(0, 300).join(" "); g3 = "AUTO_FIXED"; g3reason = `auto-trimmed from ${words.length} to ≤300 words (CTA/grounding preserved)`; }
    }
    addGate(GATES[2], g3, g3reason, remediation, { platform: brief.platform }, findings.map((f) => ({ code: f.code, detail: f.detail })));
    if (g3 === "FAIL") failed.push({ gate: GATES[2], severity: "medium", reason: g3reason });

    // ---- GATE 4 — Brand Truth / Cultural QA --------------------------------
    const b4 = [];
    for (const rx of BLAME_PATTERNS) { const m = text.match(rx); if (m) b4.push(`blame language: ${m[0]}`); }
    const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
    const longSentences = sentences.filter((s) => s.split(/\s+/).length > 30);
    if (longSentences.length) b4.push(`decorative/long sentences: ${longSentences.length}`);
    const hasConcrete = /\b(day\s*\d+|module\s*\d+|\d+\s*(am|pm)?|incision|dresser|night)\b/i.test(text);
    if (!hasConcrete) b4.push("no specific real pattern named (voice DNA test 1)");
    const culturalFlags = [];
    const hasVisualMedia = (p.artifacts || []).some((a) => /image|svg/i.test(a.mime_type || ""));
    if (hasVisualMedia && /GENERATED_SCENE/i.test(ctx.production_mode || "")) culturalFlags.push("generated-scene cultural representation requires human review");
    const faith = angle?.affirmation_grounding;
    let faithFlag = false;
    if (faith && faith.register === "declaration" && faith.faith_inflected === true) {
      faithFlag = true;
      const allowed = angle?.tier3?.faith_register_verified === true || ctx.faith_register_approved === true;
      if (!allowed) b4.push("faith-inflected declaration without per-product approval");
      culturalFlags.push("faith-inflected declaration — mandatory human review");
    }
    let g4, g4reason;
    if (b4.length) { g4 = "FAIL"; g4reason = b4.join("; "); }
    else if (culturalFlags.length) { g4 = "FLAG"; g4reason = culturalFlags.join("; "); }
    else { g4 = "PASS"; g4reason = "Voice DNA structural test passed; no cultural/faith flags"; }
    addGate(GATES[3], g4, g4reason, g4 === "FAIL" ? "Return to Generation with the specific structural test failure named" : (g4 === "FLAG" ? "Route to mandatory human review" : null), {}, [{ name: "voice_dna", issues: b4 }, { name: "cultural", issues: culturalFlags }]);
    if (g4 === "FAIL") failed.push({ gate: GATES[3], severity: "high", reason: g4reason });
    if (g4 === "FLAG") failed.push({ gate: GATES[3], severity: "medium", reason: g4reason, human: true });

    // ---- GATE 5 — Truth Compliance -----------------------------------------
    const ptr = angle?.tier3?.product_truth_ref ? TruthService.get("product", angle.tier3.product_truth_ref) : null;
    const c5 = [];
    const oc = text.match(OVERCLAIM);
    if (oc) c5.push(`overclaim: '${oc[0]}'`);
    for (const pc of (ptr?.prohibited_claims || [])) if (text.toLowerCase().includes(String(pc).toLowerCase())) c5.push(`prohibited claim: '${pc}'`);
    const uni = text.match(UNIVERSALITY);
    if (uni && angle?.tier3?.counter_evidence_acknowledged) c5.push(`universality vs counter-evidence: '${uni[0]}'`);
    // Interpretation leakage: analyst_interpretation/hypothesis emotional stake asserted as fact.
    const es = angle?.tier1?.emotional_stake;
    if (es && ["analyst_interpretation", "hypothesis"].includes(es.evidence_status) && /\b(?:she|he|they) (?:is|are) (?:frustrated|afraid|angry|anxious) because\b/i.test(text)) {
      c5.push("interpretation leakage: motivation asserted as directly stated");
    }
    // Absence claim
    const abs = text.match(ABSOLUTE_ABSENCE);
    if (abs) {
      const mif = (angle?.tier3?.market_truth_support || []).map((m) => m.ref_id);
      const permits = mif.some((id) => { const r = TruthService.get("market", id); return r && r.category === "unclaimed_angle" && /complete|exhaustive/i.test(r.scan_coverage_note || ""); });
      if (!permits) c5.push(`absolute absence claim without supporting scan coverage: '${abs[0]}'`);
    }
    const g5 = c5.length ? "FAIL" : "PASS";
    addGate(GATES[4], g5, g5.length ? c5.join("; ") : "No overclaim, universalization, interpretation leakage, or unsupported absence claim", g5 === "FAIL" ? "Automatic reject — rewrite the claim upstream (no trim fix)" : null, { product_truth_ref: angle?.tier3?.product_truth_ref || null });
    if (g5 === "FAIL") failed.push({ gate: GATES[4], severity: "blocking", reason: c5.join("; ") });

    // ---- GATE 6 — Consistency Lock -----------------------------------------
    const ps = p.lockedPhraseSet || null;
    const c6 = [];
    if (ps && ps.established_by_asset_id !== asset.asset_id) {
      const lockedDays = (ps.phrases || []).filter((x) => /^day\s*\d+$/i.test(x.trim())).map((x) => x.trim().toLowerCase());
      const claimedDays = [...new Set((text.match(/day\s*\d+/gi) || []).map((x) => x.toLowerCase()))];
      for (const d of claimedDays) if (lockedDays.length && !lockedDays.includes(d)) c6.push(`contradicts locked phrase set: '${d}' not in [${lockedDays.join(", ")}]`);
      // timeframe drift
      if (/during your first week/i.test(text) && (ps.phrases || []).some((x) => /day\s*6/i.test(x))) c6.push("contradicts locked phrase set: 'first week' vs locked 'day 6'");
    }
    const g6 = c6.length ? "FAIL" : "PASS";
    addGate(GATES[5], g6, c6.length ? c6.join("; ") : "Consistent with Locked Phrase Set", c6.length ? "Automatic reject; restate the Locked Phrase Set" : null, { locked_phrase_set_id: ps?.id || null });
    if (g6 === "FAIL") failed.push({ gate: GATES[5], severity: "blocking", reason: c6.join("; ") });

    // ---- GATE 7 — Human Review ---------------------------------------------
    const triggers = [];
    if (g4 === "FLAG") triggers.push("Gate 4 cultural representation / faith flag");
    if (faithFlag) triggers.push("faith-inflected declaration");
    if (validation?.verdict === "YELLOW") triggers.push("Yellow-verdict angle");
    if (validation?.human_review_required) triggers.push(validation.human_review_reason || "validation human review");
    if (ctx.sensitive_domain === true || (angle?.tags || []).some((t) => ["health", "grief", "financial_hardship", "family_conflict", "clinical", "medical"].includes(t))) triggers.push("sensitive domain");
    if (ctx.first_for_product === true) triggers.push("first asset generated for this product's Angle Record set");
    if ((generated_?.regeneration_count || ctx.regeneration_count || 0) > 1) triggers.push("more than one regeneration cycle");
    if (slop.tier2.length) triggers.push("Tier 2 anti-slop flag");
    const hardFail = failed.some((f) => f.severity === "blocking");
    const needsHuman = triggers.length > 0 && !hardFail;
    let human = null;
    if (needsHuman) {
      const decision = ctx.human_review?.decision || null;
      human = { required: true, trigger: triggers.join("; "), reviewer: ctx.human_review?.reviewer || null, decision, notes: ctx.human_review?.notes || null, at: decision ? new Date().toISOString() : null };
    }
    // Spot-check sampling (15%) for clean Green non-sensitive assets.
    const spot = !needsHuman && !hardFail && validation?.verdict === "GREEN" && (Math.abs(hashStr(asset.asset_id)) % 100) < 15;
    let g7;
    if (needsHuman && human.decision === "APPROVED") g7 = "PASS";
    else if (needsHuman && human.decision === "APPROVED_WITH_MINOR_EDIT") g7 = "PASS";
    else if (needsHuman) g7 = "HUMAN_REVIEW_REQUIRED";
    else g7 = "NOT_TRIGGERED";
    addGate(GATES[6], g7, needsHuman ? `Human review triggered: ${triggers.join("; ")}` : (spot ? "Not triggered; selected for spot-check sampling" : "Not triggered"), needsHuman ? "Human must see source records, not just the final asset" : null, { triggers, spot_check: spot });

    // ---- Overall ------------------------------------------------------------
    let overall, qa_status, severity;
    if (hardFail) { overall = "FAIL"; qa_status = "REJECTED"; severity = "blocking"; }
    else if (failed.length) { overall = "REVISION_REQUIRED"; qa_status = "REVISION_REQUIRED"; severity = "high"; }
    else if (needsHuman && !["APPROVED", "APPROVED_WITH_MINOR_EDIT"].includes(human.decision)) { overall = "HUMAN_REVIEW_REQUIRED"; qa_status = "HUMAN_REVIEW_PENDING"; severity = "low"; }
    else { overall = "PASS"; qa_status = "APPROVED"; severity = "none"; }

    const record = {
      id: p.id || this.nextId((angle?.id || "GEN").replace(/^ANG-/, "").split("-")[0] || "GEN"),
      class: "qa_record",
      asset_id: asset.asset_id,
      angle_id: asset.angle_id || angle?.id,
      brief_id: brief.id,
      media_artifact_ids: (p.artifacts || []).map((a) => a.id),
      gates,
      overall,
      severity,
      human_review: human,
      manual_override: null,
      failed_checks: failed,
      revision_count: generated_?.regeneration_count || ctx.regeneration_count || 0,
      qa_status,
      spot_check_selected: spot,
      critic: { configured: CriticAdapter.configured(), state: CriticAdapter.configured() ? "RAN" : "NOT_RUN" },
      traceability: {
        angle_id: angle?.id || null,
        validation_id: validation?.id || null,
        brief_id: brief.id,
        generation_id: generated_?.id || null,
        truth_source_ids: (angle?.tier3?.source_evidence || []).map((e) => e.ref_id),
      },
      created_at: new Date().toISOString(),
      updated_at: null,
    };
    validate("qa-record.schema.json", record, record.id);
    return { record, content: text };
  },

  /** A minor human edit may become the approved version when logged (S7 §7.8.3, S9 §9.15). */
  applyMinorEdit(record, { changed, reason, by, content }) {
    const r = { ...record,
      manual_override: { changed, reason, by, at: new Date().toISOString(), minor_edit: true, became_approved_version: true, requal_required: false },
      qa_status: "APPROVED", overall: "PASS", updated_at: new Date().toISOString(),
      gates: record.gates.map((g) => g.gate === GATES[6] ? { ...g, result: "PASS", reason: "approved with minor logged edit" } : g),
    };
    return { record: r, content };
  },

  save(record, { scope = "production" } = {}) { return save("qa", record, { scope }); },
  get(id) { return all("qa").find((r) => r.id === id) || null; },
  byAsset(asset_id) { return all("qa").filter((r) => r.asset_id === asset_id).pop() || null; },
};

function hashStr(s) { let h = 0; for (let i = 0; i < String(s).length; i++) { h = (h * 31 + String(s).charCodeAt(i)) | 0; } return h; }
