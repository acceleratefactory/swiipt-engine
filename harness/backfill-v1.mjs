#!/usr/bin/env node
// Backfill v1 (factory item #7) — converts validated pre-factory IP into factory records.
// Sources: MEMORY.md naming-audit verdicts + validation scores (2026-08-19), product2.md build set,
// live platform IDs recorded in AGENTS.md Phase 6 sections. Survival-pain flags are deliberately
// neutral (false) with [BACKFILL] signals — those tests were never run; honesty over retrofit.
// Run:  node harness/backfill-v1.mjs   then   node harness/validate-opportunity.mjs --all
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const D = join(root, "data");
const today = "2026-08-24";
const BACKFILL_SIGNALS = [
  "[BACKFILL] survival-pain test not re-run for legacy IP",
  "[BACKFILL] validated instead via naming audit + 11-field Discovery matrix scoring",
];

function opportunity(o) {
  return {
    opportunity_id: o.id,
    source: "backfill-v1:MEMORY.md-validation-table+product2.md",
    source_references: [
      "Product Pipeline/MEMORY.md",
      "Product Pipeline/product2.md",
      ...(o.refs ?? []),
    ],
    life_area: "m01",
    focus_market: "Postpartum & New Parent Life",
    submarket: o.sub,
    collected_at: "2026-08-19",
    finding: {
      headline: o.title,
      problem: o.problem,
      recurring_situation: o.situation ?? "",
      person: o.person ?? "",
      trigger: o.trigger ?? "",
      failed_attempt: o.failed ?? "",
      emotional_stake: o.stake ?? "",
      desired_outcome: o.outcome ?? "",
      mechanism_hypotheses: o.mech ?? [],
      competition_notes: o.comp ?? "",
    },
    survival_pain_test: {
      urgency: false, embarrassment: false, failed_attempts: false,
      identity_threat: false, immediate_spend: false,
      signals_observed: BACKFILL_SIGNALS,
    },
    disposition: {
      library_role: o.role,
      rationale: o.rationale,
      assigned_at: "2026-08-19",
      promoted_transformation_id: o.tr ?? null,
      reclassification_history: [],
    },
    status: o.tr ? "promoted_to_candidate" : "dispositioned",
    related_opportunity_ids: o.rel ?? [],
  };
}

// ---- V-product lineage (naming audit + scores verbatim from MEMORY.md) ----
const vProducts = [
  { id:"OPP-PPL-CORDCARE-001", title:"V14 · Cord Care That Won't Land You in A&E (score 86)", sub:"Newborn hygiene / umbilical care", problem:"Parents fear making dangerous cord-care mistakes during sleep deprivation.", role:"STANDALONE_TRANSFORMATION", rationale:"Flagship #2 (86/100). Publish after revision. Fact-check heavy (Jos RCT on methylated spirit noted in corrections)." },
  { id:"OPP-PPL-OMUGWO-001", title:"V12 · Omugwo on Your Terms (score 83)", sub:"Grandparents/family boundaries", problem:"Traditional postpartum help arrives on the helper's terms and overwhelms the mother.", role:"STANDALONE_TRANSFORMATION", rationale:"Flagship #4 (83/100). Cultural wedge product - globally relatable core (managing uninvited help) with African ownable frame.", comp:"Omugwo Academy, Omugwo Complete Guide exist - differentiation is mechanism + boundaries system." },
  { id:"OPP-PPL-CS14DAYS-001", title:"V05 · The No-Village C-Section: First 14 Days, Survival & Function (score 80)", sub:"C-section immediate recovery", problem:"Recovering from abdominal surgery alone while caring for a newborn, without family support.", role:"STANDALONE_TRANSFORMATION", rationale:"Flagship #5 (80/100). Hidden market: 'How do I function normally again after a C-section while caring for a newborn?' Renamed per naming audit." },
  { id:"OPP-PPL-RTWORK-001", title:"V19 · Beyond the Restroom: 30-Day Return-to-Work OS (score 79)", sub:"Return to work transition", problem:"The 30 days before and after returning to work while breastfeeding and sleep-deprived.", role:"STANDALONE_TRANSFORMATION", rationale:"Flagship #6 (79/100). Narrow window = productizable. Western-first appeal strong; legal facts need verification (Nigerian Labour Act corrections logged)." },
  { id:"OPP-PPL-CORE6MO-001", title:"V03 · Still Look Pregnant at 6 Months? The No-Situps Core Recovery System (score 86)", sub:"Diastasis / core recovery", problem:"Mother months postpartum still looks pregnant, afraid sit-ups made it worse.", role:"STANDALONE_TRANSFORMATION", rationale:"Flagship #3 (86/100). NOTE: consolidated into PP-01 Is This Normal? (A2/B4 doors) - owner confirmed consolidation; split back if buyer language diverges. Physiotherapist review required before Gate O clears.", rel:["OPP-PPL-ISNORMAL-001"] },
  { id:"OPP-PPL-FEEDBOTH-001", title:"V15 · Breast, Bottle, Both: The Judgement-Free Feeding Plan (score 75)", sub:"Feeding journey - mixed feeding", problem:"Mothers who cannot or choose not to breastfeed exclusively face guilt and judgement.", role:"BUNDLE_COMPONENT", rationale:"Bundle module of Newborn OS (75/100). 'Fed Is Best' name rejected (published book/legal). Safety rules: never diluted formula." },
  { id:"OPP-PPL-MOODEMPTY-001", title:"V07 · I Love My Baby, Why Am I Empty? (score 74)", sub:"Mental & emotional life", problem:"Emotional emptiness after birth that does not match expectation of joy.", role:"STANDALONE_TRANSFORMATION", rationale:"74/100, gated on crisis list - shared verified crisis/escalation list is now BUILT, dependency cleared. Screens+routers only, never diagnosis." },
  { id:"OPP-PPL-ROOMMATES-001", title:"V11 · We Became Roommates: A Postpartum Reconnection Ladder (score 74)", sub:"Relationship strain - intimacy/connection", problem:"Couples reduced to logistics co-managers; connection lost after birth.", role:"BUNDLE_COMPONENT", rationale:"Inside Postpartum Couple OS (74/100). Western-first appeal strong." },
  { id:"OPP-PPL-OWAMBE-001", title:"V02 · The Owambe Countdown: Fitting Your Aso-Ebi Again in 6 Weeks (score 72)", sub:"Postpartum clothing/dressing - event dressing", problem:"Committed outfit for a specific event weeks away; body will not be ready by crash effort.", role:"STANDALONE_TRANSFORMATION", rationale:"72/100, absorbs V01. Pipeline.md reference product ID PPL-BODY-OWAMBE-001 belongs to this lineage. Cultural wedge (aso-ebi/owambe); globally analogous = wedding/event countdown.", rel:["OPP-PPL-CAPSULE-001"] },
  { id:"OPP-PPL-FAIRROSTER-001", title:"V09 · I Do Everything: A Fair Night-and-Day Roster for the Postpartum Home (score 71)", sub:"Household management / division of labor", problem:"One adult carries the entire household load while recovering.", role:"BUNDLE_COMPONENT", rationale:"Daytime counterpart of V06 inside Couple OS (71/100)." , rel:["OPP-PPL-NIGHTSHIFT-001"]},
  { id:"OPP-PPL-BINDER-001", title:"V21 · The Village in a Binder (score 68)", sub:"New-parent administration", problem:"Administrative overload (registrations, appointments, insurance) during sleep deprivation.", role:"ENTRY_PRODUCT", rationale:"Entry product 68/100, fact-check heavy (NIN free correction, NPC registration costs logged)." },
  { id:"OPP-PPL-FIRSTS-001", title:"V16 · Your Village in a PDF: The First 7 Nights / Firsts Calendar (score 69)", sub:"The firsts market", problem:"First-time situations (first bath, outing, night away) create repeated anxiety spikes.", role:"ENTRY_PRODUCT", rationale:"Antenatal funnel entry (69/100); calendar sample doubles as lead magnet." },
  { id:"OPP-PPL-SECONDBABY-001", title:"V18 · The No-Village Second Baby: Keeping Your Toddler Steady While You're Solo With a Newborn (score 60)", sub:"Baby + older children", problem:"Newborn arrival destabilizes the older child while parents have less capacity than the first time.", role:"STANDALONE_TRANSFORMATION", rationale:"60/100 - lowest standalone score kept (distinct situation nucleus); narrowest priority." },
  { id:"OPP-PPL-ONHAND-001", title:"V08 · The Mama's Feeding Tray - One-Handed Nutrition (score 67)", sub:"One-handed nutrition", problem:"Feeding the mother while she feeds the baby; skipped meals and cold food.", role:"ENTRY_PRODUCT", rationale:"Entry price point 67/100. Strong positioning concept: 'Feeding the mother while she's feeding the baby.'" },
  { id:"OPP-PPL-BABYLIST-001", title:"V17 · What Does YOUR Baby Actually Need? A 2-Minute Profile (score 67)", sub:"Baby-product overwhelm", problem:"Decision paralysis over what to buy for the first 12 weeks.", role:"ENTRY_PRODUCT", rationale:"Profiler rebuild needed (67/100); list version doubles as lead magnet." },
  { id:"OPP-PPL-CROWDSOURCE-001", title:"V13 · Crowdsource Your Omugwo (score 76)", sub:"Family help coordination", problem:"Help exists in the community but is unorganized and unsolicited.", role:"LEAD_MAGNET", rationale:"FREE lead magnet (76/100) - highest-scoring non-flagship repurposed as acquisition." },
  { id:"OPP-PPL-HAIRSHED-001", title:"V04 · Personal Care - Hair-Shedding Chapter (score 63)", sub:"Postpartum personal care", problem:"Postpartum hair loss and abandoned self-care identity.", role:"LEAD_MAGNET", rationale:"Repackage decision: hair-shedding chapter stands alone as free magnet (63/100)." },
  { id:"OPP-PPL-MONEYPOST-001", title:"V10 · Money Post-Baby (score 69)", sub:"Money & post-baby household management", problem:"New expenses collide with reduced income in year one.", role:"LEAD_MAGNET", rationale:"Repackage: Nigerian Newborn List free magnet + Maternity-Leave Money Plan paid module (69/100). Fact-check corrections logged (Child Benefit figures)." },
  { id:"OPP-PPL-CAPSULE-001", title:"V01 · Body Capsule (score 70)", sub:"Wardrobe capsule module", problem:"Sub-problem of wardrobe rebuild after body changes.", role:"MODULE", rationale:"Module of V02 Owambe Countdown (70/100), absorbed." , rel:["OPP-PPL-OWAMBE-001"]},
  { id:"OPP-PPL-MEGAOS-001", title:"V20 · New Parent OS 25-chapter bundle architecture (score 57)", sub:"New parent operating system", problem:"Everything-at-once parenting information does not produce change.", role:"BUNDLE_COMPONENT", rationale:"Bundle WRAPPER/architecture only, not a standalone (57/100 - lowest score; 90-day roadmap artifact is its spine)." },
];

// ---- PP portfolio (live products; validated via product2.md + specs) ----
const ppProducts = [
  { id:"OPP-PPL-ISNORMAL-001", title:"PP-01 · Is This Normal? Understanding Your Post-Baby Belly, Scar, Core & Recovery Timeline", sub:"Physical recovery - belly/scar/core/movement fear/timeline anger", problem:"Woman 6w-12m postpartum confused and afraid her belly, core or movement is abnormal; doesn't know what's safe or when a doctor is needed.", person:"Woman 6 weeks-12 months postpartum", tr:"TR-PPL-CORE-NORMAL-001", refs:["Product Pipeline/specs/PP-01.md"], role:"STANDALONE_TRANSFORMATION", rationale:"LIVE: trans #69 / tsystem #70 / Woo #71. Consolidates V03+V05 situations (4 doors A1/A2/B4/C5, physical-recovery-only per v6.2 drift fix). Gate O open: clinical red flags from authoritative literature required." , rel:["OPP-PPL-CORE6MO-001","OPP-PPL-CS14DAYS-001"]},
  { id:"OPP-PPL-CLOSET-001", title:"PP-02 · The New-Body Closet: Dressing the Shape You Have Now", sub:"Wardrobe - everyday dressing", problem:"Woman 3-9m postpartum whose old wardrobe fits but flatters nothing; daily decision fatigue; done waiting to get her body back.", person:"Woman 3-9 months postpartum", tr:"TR-PPL-BODY-CLOSET-001", refs:["Product Pipeline/specs/PP-02.md"], role:"STANDALONE_TRANSFORMATION", rationale:"LIVE: trans #72 / tsystem #73 / Woo #74. M3 rehab content stripped (v6.1 fix) - references recovery progress, delivers none." },
  { id:"OPP-PPL-NOTICE3WK-001", title:"PP-02B · The 3-Week Notice: Look Put-Together for the Event You Can't Skip", sub:"Wardrobe - event dressing (upsell)", problem:"PP-02 buyer with an event in 3-6 weeks, outfit committed, no time to change her body.", person:"PP-02 customer", tr:"TR-PPL-EVENT-NOTICE-001", refs:["Product Pipeline/specs/PP-02B.md"], role:"UPSELL", rationale:"LIVE: trans #75 / tsystem #76 / Woo #77. Order-bump on PP-02 checkout ONLY (v6.2 corrected - name/content theft from V19 reverted).", rel:["OPP-PPL-CLOSET-001","OPP-PPL-RTWORK-001"] },
  { id:"OPP-PPL-QUIETLEAK-001", title:"PP-03 · The Quiet Leak: Taking Back Control of Your Body After Baby", sub:"Pelvic floor - bladder leakage", problem:"Woman 6w-12m postpartum living around urine leakage - pads everywhere, avoiding exercise/prayer/parties, has told no one.", person:"Woman 6 weeks-12 months postpartum", tr:"TR-PPL-PELVIC-QUIET-001", refs:["Product Pipeline/specs/PP-03.md"], role:"STANDALONE_TRANSFORMATION", rationale:"LIVE: trans #78 / tsystem #79 / Woo #80. Four doors B1-A/B/C/D incl. restored prayer/purity door. Warm-channel distribution only. HIGHEST Gate O priority: pelvic-floor red flags from authoritative sources required. Functional-first design mode.", },
];

const write = (p, obj) => {
  const f = join(D, p);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, JSON.stringify(obj, null, 2) + "\n");
};

let n = 0;
// library record
write(join("libraries", "m01.json"), {
  library_id: "m01",
  name: "Postpartum & New Parent Life",
  market_positioning: "Global/Western primary; African/Nigerian cultural wedges preserved where ownable (omugwo, aso-ebi, night-shift dynamics)",
  status: "active",
  backfilled_at: today,
  notes: "Only area with validated+live inventory. 59-entry extraction + 21-product validation + PP build set all m01.",
});

for (const o of vProducts.map(opportunity)) { write(join("opportunities", `${o.opportunity_id}.json`), o); n++; }
for (const o of ppProducts.map(opportunity)) { write(join("opportunities", `${o.opportunity_id}.json`), o); n++; }

// product records for the 5 LIVE systems
const live = [
  { pid:"PPL-NIGHT-SHIFT-001", name:"Every Night, Just Me", subtitle:"A postpartum night-coordination system that replaces nightly arguing with a pre-agreed roster, a fairness ledger, and the exact words to make it stick.", promise:"A written, fair night-shift system both adults follow - so she gets a protected sleep opportunity, and nobody has to ask.", tr:"TR-PPL-NIGHT-SHIFT-001", wp:{transformation_id:84,tsystem_id:85,product_id:86}, price:{USD:29,NGN:45000,EUR:27,GHS:450}, exp:"functional", journey:"m01 newborn nights -> couple operating system" },
  { pid:"PPL-CORE-NORMAL-001", name:"Is This Normal?", subtitle:"What's Actually Happening, What's Safe to Do This Week, and When to See a Doctor", promise:"Informed, safe-movement plan, red flags known, realistic expectations for her stage of recovery.", tr:"TR-PPL-CORE-NORMAL-001", wp:{transformation_id:69,tsystem_id:70,product_id:71}, price:{USD:29,NGN:45000,EUR:27,GHS:450}, exp:"editorial", journey:"m01 physical recovery -> movement confidence" },
  { pid:"PPL-BODY-CLOSET-001", name:"The New-Body Closet", subtitle:"A Practical Wardrobe System for Postpartum Women Who Are Done Waiting to Get Their Body Back", promise:"Knows how to dress her current body, builds outfits quickly, feels put-together again.", tr:"TR-PPL-BODY-CLOSET-001", wp:{transformation_id:72,tsystem_id:73,product_id:74}, price:{USD:29,NGN:45000,EUR:27,GHS:450}, exp:"editorial", journey:"wardrobe -> body confidence -> events" },
  { pid:"PPL-EVENT-NOTICE-001", name:"The 3-Week Notice", subtitle:"Make the Outfit You Already Have Work Beautifully - No Crash Diet Required", promise:"Put-together for the event she can't skip, using what she owns.", tr:"TR-PPL-EVENT-NOTICE-001", wp:{transformation_id:75,tsystem_id:76,product_id:77}, price:{USD:19,NGN:29000,EUR:18,GHS:290}, exp:"utility", journey:"attached upsell to PPL-BODY-CLOSET-001" },
  { pid:"PPL-PELVIC-QUIET-001", name:"The Quiet Leak", subtitle:"A Private, Evidence-Based Guide to Understanding and Improving Postpartum Bladder Control", promise:"Understands it deserves attention, has a safe pelvic-floor progression, knows when to seek professional assessment.", tr:"TR-PPL-PELVIC-QUIET-001", wp:{transformation_id:78,tsystem_id:79,product_id:80}, price:{USD:29,NGN:45000,EUR:27,GHS:450}, exp:"functional", journey:"pelvic floor -> professional escalation path" },
];
for (const L of live) {
  const emptyMap = { read:[], do:[], decide:[], track:[], communicate:[], rescue:[], reentry:[], maintenance:[] };
  write(join("products", L.pid, "product.json"), {
    product_id: L.pid,
    version: "0.1.0",
    status: "published",
    identity: { name:L.name, subtitle:L.subtitle, one_line_promise:L.promise, library_id:"m01", transformation_id:L.tr, journey_position:L.journey },
    commercial_role: { role:"core", parent_product_id:null, related_product_ids: L.pid==="PPL-EVENT-NOTICE-001"?["PPL-BODY-CLOSET-001"]:[] },
    customer: { target_person:"Backfilled from spec - see opportunity record", situation:"Backfilled from spec - see opportunity record", trigger:"postpartum period", constraints:[], emotional_stake:"Backfilled from spec" },
    transformation: { before_state:{}, after_state:{}, mechanism:{}, path:[], first_win:{}, failure_map:{}, rescue_protocols:{}, reentry:{}, maintenance:{}, next_transformation_ids:[] },
    tsm: { note: "Canonical TSM lives in WordPress swiipt_tsm_definitions; full record pending F.4 approval" },
    asset_map: emptyMap,
    content: { landing_page:null, product_page:null, faq:null, specifications:null, deliverables:null, onboarding:null, completion:null },
    commerce: { price:{base_usd:L.price.USD}, currency_rules:{model:"manual_per_currency", display:"geo_controlled"}, offer:{}, access_rules:{grant_type:"one_time_digital"}, upsells: L.pid==="PPL-BODY-CLOSET-001"?["PPL-EVENT-NOTICE-001"]:[], bundles:[] },
    design: { experience_type:L.exp, theme:"swiipt-brand-tokens", components:[], responsive_requirements:["mobile-first"], accessibility_requirements:["WCAG-AA baseline"] },
    evidence: { sources:[], claim_labels:[], review_status:"pre-factory manual process; evidence labels applied in WP (Gate N)" },
    safety: { risk_level:"moderate", disclaimer:"Educational content - not medical, clinical, or mental-health advice.", red_flags:[], escalation_rules:["verified shared crisis list (see Product Pipeline/MEMORY.md)"] },
    qa: { deterministic_tests:[], ai_tests:[], gate_results:{
      g0_research_disposition:"PASS", g1_situation:"pending", g2_transformation:"pending",
      g3_product_architecture:"pending", g4_evidence:"pending", g5_safety:"pending",
      g6_content:"pending", g7_product_qa:"pending", g8_commerce:"pending",
      g9_customer_journey:"pending", g10_publish:"PASS" } },
    publishing: { manifest_version:"1.0-pre-factory", wordpress_ids:L.wp, published_at:"2026-08-19T00:00:00Z" },
  });
}
console.log(`backfill-v1: wrote ${n} opportunities + ${live.length} product records + 1 library`);
