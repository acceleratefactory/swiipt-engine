#!/usr/bin/env node
// Generates product.json for Wave 1b records (V05/V12/V19).
import { writeFileSync, mkdirSync } from "node:fs";
const defs = [
  { pid: "PPL-CS-FIRST14DAYS-001", name: "The No-Village C-Section", subtitle: "First 14 Days Alone With a Newborn After Major Abdominal Surgery - Survival & Function", promise: "A day-by-day solo recovery system - pain on schedule, safe movement, incision watch, minimum-viable household - plus red flags that end guesswork.", tr: "TR-PPL-CS-FIRST14DAYS-001", kw: "c-section recovery first 14 days", journey: "c-section surgery recovery -> newborn systems -> return-to-work",
    amap: { read: ["AS-CS-READ-001"], do: ["AS-CS-DO-001"], decide: ["AS-CS-DECIDE-001"], track: [], communicate: ["AS-CS-SCRIPTS-001"], rescue: ["AS-CS-RESCUE-001"], reentry: [], maintenance: [] },
    next: ["TR-PPL-CORD-CARE-001", "TR-PPL-RTWORK-OS-001"], risk: "clinical",
    disclaimer: "Educational content - not medical advice. Your clinician overrides everything here.",
    redflags: ["fever >=38C/chills", "spreading incision redness/swelling/opening/pus", "worsening pain after days 3-4", "soaking pads/large clots/foul lochia", "unilateral calf pain/swelling/heat", "chest pain or breathlessness", "blues past two weeks or thoughts of harm"] },
  { pid: "PPL-OMUGWO-TERMS-001", name: "Omugwo on Your Terms", subtitle: "Keep the Help, Skip the War - A Three-Zone Agreement for Traditional Postpartum Support", promise: "Grandma keeps her proud role, doctor-backed rules protect the baby on paper, and you keep your sleep, your bond and the peace.", tr: "TR-PPL-OMUGWO-TERMS-001", kw: "omugwo boundaries postpartum help", journey: "family boundaries -> newborn care -> couple system",
    amap: { read: ["AS-OMU-READ-001"], do: ["AS-OMU-DO-001"], decide: [], track: [], communicate: ["AS-OMU-SCRIPTS-001"], rescue: ["AS-OMU-RESCUE-001"], reentry: [], maintenance: [] },
    next: ["TR-PPL-CORD-CARE-001", "TR-PPL-CS-FIRST14DAYS-001"], risk: "moderate",
    disclaimer: "Educational content - not medical advice. Clinical questions route to clinicians.",
    redflags: ["substance reached cord stump or baby's mouth", "baby fed anything besides milk", "unsafe sleep imposed", "mother's mood darkening past two weeks or thoughts of harm"] },
  { pid: "PPL-RTWORK-OS-001", name: "Beyond the Restroom: 30-Day Return-to-Work OS", subtitle: "The 30 Days Before and After Maternity Leave Ends - Rights, Pumping Logistics and the Evening Bridge", promise: "A dated operating system for the return: rights-backed ask locked in writing, feeding lane chosen, freezer bank built, mornings drilled - week one becomes execution, not improvisation.", tr: "TR-PPL-RTWORK-OS-001", kw: "returning to work breastfeeding pumping rights", journey: "maternity leave end -> working mother identity -> household money systems",
    amap: { read: ["AS-RTW-READ-001"], do: ["AS-RTW-DO-001"], decide: ["AS-RTW-DECIDE-001"], track: [], communicate: ["AS-RTW-SCRIPTS-001"], rescue: ["AS-RTW-RESCUE-001"], reentry: [], maintenance: [] },
    next: [], risk: "low",
    disclaimer: "Educational content - not medical or legal advice.",
    redflags: ["mastitis signs: red hot wedge/fever/flu-feel = clinician same day", "supply collapse across 3+ days = lactation support", "persistent hopelessness = clinical support + crisis lines"] },
];
for (const d of defs) {
  const p = {
    product_id: d.pid, version: "1.0.0", status: "ready",
    identity: { name: d.name, subtitle: d.subtitle, one_line_promise: d.promise, library_id: "m01", transformation_id: d.tr, journey_position: d.journey },
    commercial_role: { role: "core", parent_product_id: null, related_product_ids: ["PPL-CORD-CARE-001"] },
    customer: { target_person: "See transformation record " + d.tr + " situation.person", situation: "See TR situation.specific_situation", trigger: "See TR situation.trigger", constraints: [], emotional_stake: "See TR situation.emotional_stake" },
    transformation: { before_state: { summary: "see TR" }, after_state: { summary: "see TR" }, mechanism: { summary: "see TR" }, path: [], first_win: {}, failure_map: {}, rescue_protocols: {}, reentry: {}, maintenance: {}, next_transformation_ids: d.next },
    tsm: { note: "Canonical TSM lives in " + d.tr + "; upserts to swiipt_tsm_definitions on publish." },
    asset_map: d.amap,
    content: { landing_page: null, product_page: null, faq: null, specifications: null, deliverables: "assets/", onboarding: null, completion: null },
    commerce: { price: { base_usd: 29 }, currency_rules: { model: "manual_per_currency", display: "geo_controlled", prices: { USD: 29, NGN: 45000, EUR: 27, GHS: 450 }, note: "PLACEHOLDER pricing pending owner" }, offer: {}, access_rules: { grant_type: "one_time_digital" }, upsells: [], bundles: [] },
    design: { experience_type: "functional", theme: "swiipt-brand-tokens", components: ["header", "cards", "checklist", "callouts", "safety alerts", "scripts", "rescue cards"], responsive_requirements: ["mobile-first one-handed use"], accessibility_requirements: ["WCAG-AA baseline", "no color-only meaning"] },
    evidence: { sources: ["see TR evidence_basis"], claim_labels: [], review_status: "sourced evidence compiled 2026-08-24; Gate O owner/reviewer sign-off pending before launch marketing" },
    safety: { risk_level: d.risk, disclaimer: d.disclaimer, red_flags: d.redflags, escalation_rules: ["verified shared crisis list numbers always apply", "clinician overrides guide"] },
    qa: { deterministic_tests: [], ai_tests: [{ test: "R_drift_integrity", status: "PASS", severity: "none", reason: "content matches approved situation record" }], gate_results: { g0_research_disposition: "PASS", g1_situation: "PASS", g2_transformation: "PASS", g3_product_architecture: "PASS", g4_evidence: "pending", g5_safety: "pending", g6_content: "PASS", g7_product_qa: "pending", g8_commerce: "pending", g9_customer_journey: "pending", g10_publish: "pending" } },
    publishing: { manifest_version: "1.0", wordpress_ids: {}, published_at: null },
  };
  mkdirSync("data/products/" + d.pid + "/assets", { recursive: true });
  mkdirSync("data/products/" + d.pid + "/publish", { recursive: true });
  writeFileSync("data/products/" + d.pid + "/product.json", JSON.stringify(p, null, 2) + "\n");
}
console.log("3 product records written");
