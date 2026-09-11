const ICON_PATHS = {"moon-star": "<path d=\"M18 5h4\" />\n  <path d=\"M20 3v4\" />\n  <path d=\"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401\" />", "settings": "<path d=\"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915\" />\n  <circle cx=\"12\" cy=\"12\" r=\"3\" />", "house": "<path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\" />\n  <path d=\"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\" />", "compass": "<circle cx=\"12\" cy=\"12\" r=\"10\" />\n  <path d=\"m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z\" />", "clipboard-list": "<rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\" />\n  <path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\" />\n  <path d=\"M12 11h4\" />\n  <path d=\"M12 16h4\" />\n  <path d=\"M8 11h.01\" />\n  <path d=\"M8 16h.01\" />", "message-square-text": "<path d=\"M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z\" />\n  <path d=\"M7 11h10\" />\n  <path d=\"M7 15h6\" />\n  <path d=\"M7 7h8\" />", "siren": "<path d=\"M7 18v-6a5 5 0 1 1 10 0v6\" />\n  <path d=\"M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z\" />\n  <path d=\"M21 12h1\" />\n  <path d=\"M18.5 4.5 18 5\" />\n  <path d=\"M2 12h1\" />\n  <path d=\"M12 2v1\" />\n  <path d=\"m4.929 4.929.707.707\" />\n  <path d=\"M12 12v6\" />", "x": "<path d=\"M18 6 6 18\" />\n  <path d=\"m6 6 12 12\" />", "chevron-right": "<path d=\"m9 18 6-6-6-6\" />", "chevron-left": "<path d=\"m15 18-6-6 6-6\" />", "plus": "<path d=\"M5 12h14\" />\n  <path d=\"M12 5v14\" />", "check": "<path d=\"M20 6 9 17l-5-5\" />", "arrow-left": "<path d=\"m12 19-7-7 7-7\" />\n  <path d=\"M19 12H5\" />", "copy": "<rect width=\"14\" height=\"14\" x=\"8\" y=\"8\" rx=\"2\" ry=\"2\" />\n  <path d=\"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2\" />", "share-2": "<circle cx=\"18\" cy=\"5\" r=\"3\" />\n  <circle cx=\"6\" cy=\"12\" r=\"3\" />\n  <circle cx=\"18\" cy=\"19\" r=\"3\" />\n  <line x1=\"8.59\" x2=\"15.42\" y1=\"13.51\" y2=\"17.49\" />\n  <line x1=\"15.41\" x2=\"8.59\" y1=\"6.51\" y2=\"10.49\" />", "volume-2": "<path d=\"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z\" />\n  <path d=\"M16 9a5 5 0 0 1 0 6\" />\n  <path d=\"M19.364 18.364a9 9 0 0 0 0-12.728\" />", "phone": "<path d=\"M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384\" />", "shield-alert": "<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\" />\n  <path d=\"M12 8v4\" />\n  <path d=\"M12 16h.01\" />", "triangle-alert": "<path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\" />\n  <path d=\"M12 9v4\" />\n  <path d=\"M12 17h.01\" />", "circle-check-big": "<path d=\"M21.801 10A10 10 0 1 1 17 3.335\" />\n  <path d=\"m9 11 3 3L22 4\" />", "alarm-clock": "<circle cx=\"12\" cy=\"13\" r=\"8\" />\n  <path d=\"M12 9v4l2 2\" />\n  <path d=\"M5 3 2 6\" />\n  <path d=\"m22 6-3-3\" />\n  <path d=\"M6.38 18.7 4 21\" />\n  <path d=\"M17.64 18.67 20 21\" />", "calendar-clock": "<path d=\"M16 14v2.2l1.6 1\" />\n  <path d=\"M16 2v3\" />\n  <path d=\"M21 7.338V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h2.338\" />\n  <path d=\"M3 9h5.859\" />\n  <path d=\"M8 2v3\" />\n  <circle cx=\"16\" cy=\"16\" r=\"6\" />", "refresh-ccw": "<path d=\"M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\" />\n  <path d=\"M3 3v5h5\" />\n  <path d=\"M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16\" />\n  <path d=\"M16 16h5v5\" />", "users": "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\" />\n  <path d=\"M16 3.128a4 4 0 0 1 0 7.744\" />\n  <path d=\"M22 21v-2a4 4 0 0 0-3-3.87\" />\n  <circle cx=\"9\" cy=\"7\" r=\"4\" />", "heart-handshake": "<path d=\"M19.414 14.414C21 12.828 22 11.5 22 9.5a5.5 5.5 0 0 0-9.591-3.676.6.6 0 0 1-.818.001A5.5 5.5 0 0 0 2 9.5c0 2.3 1.5 4 3 5.5l5.535 5.362a2 2 0 0 0 2.879.052 2.12 2.12 0 0 0-.004-3 2.124 2.124 0 1 0 3-3 2.124 2.124 0 0 0 3.004 0 2 2 0 0 0 0-2.828l-1.881-1.882a2.41 2.41 0 0 0-3.409 0l-1.71 1.71a2 2 0 0 1-2.828 0 2 2 0 0 1 0-2.828l2.823-2.762\" />", "hand-heart": "<path d=\"M11 14h2a2 2 0 0 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16\" />\n  <path d=\"m14.45 13.39 5.05-4.694C20.196 8 21 6.85 21 5.75a2.75 2.75 0 0 0-4.797-1.837.276.276 0 0 1-.406 0A2.75 2.75 0 0 0 11 5.75c0 1.2.802 2.248 1.5 2.946L16 11.95\" />\n  <path d=\"m2 15 6 6\" />\n  <path d=\"m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a1 1 0 0 0-2.75-2.91\" />", "sunrise": "<path d=\"M12 2v8\" />\n  <path d=\"m4.93 10.93 1.41 1.41\" />\n  <path d=\"M2 18h2\" />\n  <path d=\"M20 18h2\" />\n  <path d=\"m19.07 10.93-1.41 1.41\" />\n  <path d=\"M22 22H2\" />\n  <path d=\"m8 6 4-4 4 4\" />\n  <path d=\"M16 18a4 4 0 0 0-8 0\" />", "sunset": "<path d=\"M12 10V2\" />\n  <path d=\"m4.93 10.93 1.41 1.41\" />\n  <path d=\"M2 18h2\" />\n  <path d=\"M20 18h2\" />\n  <path d=\"m19.07 10.93-1.41 1.41\" />\n  <path d=\"M22 22H2\" />\n  <path d=\"m16 6-4 4-4-4\" />\n  <path d=\"M16 18a4 4 0 0 0-8 0\" />", "bed-double": "<path d=\"M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8\" />\n  <path d=\"M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4\" />\n  <path d=\"M12 4v6\" />\n  <path d=\"M2 18h20\" />", "list-checks": "<path d=\"M13 5h8\" />\n  <path d=\"M13 12h8\" />\n  <path d=\"M13 19h8\" />\n  <path d=\"m3 17 2 2 4-4\" />\n  <path d=\"m3 7 2 2 4-4\" />", "activity": "<path d=\"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2\" />", "target": "<circle cx=\"12\" cy=\"12\" r=\"10\" />\n  <circle cx=\"12\" cy=\"12\" r=\"6\" />\n  <circle cx=\"12\" cy=\"12\" r=\"2\" />", "scale": "<path d=\"M12 3v18\" />\n  <path d=\"m19 8 3 8a5 5 0 0 1-6 0zV7\" />\n  <path d=\"M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1\" />\n  <path d=\"m5 8 3 8a5 5 0 0 1-6 0zV7\" />\n  <path d=\"M7 21h10\" />", "life-buoy": "<circle cx=\"12\" cy=\"12\" r=\"10\" />\n  <path d=\"m4.93 4.93 4.24 4.24\" />\n  <path d=\"m14.83 9.17 4.24-4.24\" />\n  <path d=\"m14.83 14.83 4.24 4.24\" />\n  <path d=\"m9.17 14.83-4.24 4.24\" />\n  <circle cx=\"12\" cy=\"12\" r=\"4\" />", "book-open": "<path d=\"M12 5v16\" />\n  <path d=\"M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z\" />", "flame": "<path d=\"M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4\" />", "printer": "<path d=\"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2\" />\n  <path d=\"M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6\" />\n  <rect x=\"6\" y=\"14\" width=\"12\" height=\"8\" rx=\"1\" />"};
/* ============================================================================
   SWIIPT TRANSFORMATION INTERACTIVE ENGINE — client reference implementation
   Reference product: "Every Night, Just Me" (postpartum night-shift OS)

   Architecture note (see build spec):
   - PRODUCT_CONFIG is the versioned, product-owned schema (content + rules).
     It contains every string, decision node, script, and rescue step.
   - ENGINE.* is generic rendering/traversal logic that knows nothing about
     night shifts, babies, or postpartum recovery. It only knows how to run
     a Checklist, a DecisionTree, a Tracker, a RescueFlow, a ScriptCard,
     and a TSM measurement, given *some* config.
   - A second product swaps PRODUCT_CONFIG and changes zero engine code
     (Spec §27, §32). This file keeps that boundary explicit and commented.
   ============================================================================ */

/* ---------------------------------------------------------------------------
   ICON HELPER
--------------------------------------------------------------------------- */
function icon(name, size, color){
  size = size || 16; color = color || 'currentColor';
  const inner = ICON_PATHS[name] || '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

/* ---------------------------------------------------------------------------
   PRODUCT CONFIGURATION  (Spec §13, §27 — content/code separation)
   Everything product-specific for "Every Night, Just Me" lives here.
   Nothing below this block should ever be hard-coded again elsewhere.
--------------------------------------------------------------------------- */
const PRODUCT_CONFIG = {
  productId: "every-night-just-me-v06",
  version: "1.0.0",
  contentVersion: "V06 · 2026-08",
  title: "Every Night, Just Me",

  interactive: { today:true, check:true, tracker:true, rescue:true, scripts:true, progress:true, milestones:true, tsm:true },

  rosters: {
    A: { label:"A", name:"Breastfeeding Split Shift",
         shift1:{ owner:"Partner", defaultStart:"21:00", defaultEnd:"02:00" },
         shift2:{ owner:"Mother",  defaultStart:"02:00", defaultEnd:"07:00" },
         needsPrep:false },
    B: { label:"B", name:"Alternating Bottle-Fed Shift",
         shift1:{ owner:"Partner", defaultStart:"22:00", defaultEnd:"03:00" },
         shift2:{ owner:"Mother",  defaultStart:"03:00", defaultEnd:"08:00" },
         needsPrep:true },
    C: { label:"C", name:"Support-Web Roster",
         shift1:{ owner:"Helper",  defaultStart:"23:00", defaultEnd:"04:00" },
         shift2:{ owner:"Mother",  defaultStart:"04:00", defaultEnd:"—" },
         needsPrep:true },
  },

  // Spec §3 — TODAY: the daily checklist. `rosters:null` = always shown.
  dailyChecklist: [
    { id:"confirmed", label:"Roster confirmed for tonight", rosters:null },
    { id:"prepped",   label:"Bottles / supplies pre-measured", rosters:["B","C"] },
    { id:"chart",     label:"Fridge chart updated with tonight's times", rosters:null },
    { id:"briefed",   label:"Both sides briefed on the handoff time", rosters:null },
  ],

  // Spec §4 — CHECK / decision engine. Generic node graph, no hard-coded logic.
  decisionTree: {
    root: "q_main",
    nodes: {
      q_main: { type:"question", title:"What's happening right now?", options:[
        { label:"I haven't picked a roster yet", next:"q_partner_avail" },
        { label:"Baby won't settle — rough night", next:"q_tried_soothing" },
        { label:"We're arguing about whose turn it is", next:"q_first_time" },
        { label:"Partner is pushing back on tonight", next:"out_script_2" },
        { label:"Partner says \u201cyou're just better at it\u201d", next:"out_script_3" },
        { label:"Extended family is criticizing the roster", next:"out_script_7" },
        { label:"It's time to review or adjust the roster", next:"out_script_5" },
        { label:"I'm beyond exhausted — worried about myself", next:"q_safety_gate" },
      ]},
      q_partner_avail: { type:"question", title:"Is your partner available at night?", options:[
        { label:"Yes, home most nights", next:"q_feeding_method" },
        { label:"No — works nights, travels, or not in the home", next:"out_roster_c" },
      ]},
      q_feeding_method: { type:"question", title:"How is baby fed overnight?", options:[
        { label:"Breastfeeding only (direct latch)", next:"out_roster_a" },
        { label:"Bottle, formula, or expressed milk", next:"out_roster_b" },
      ]},
      out_roster_a: { type:"outcome", outcomeType:"roster", roster:"A",
        title:"Roster A fits your household",
        body:"Partner manages all non-feeding duties through the night and brings baby to you only for feeds. He owns the full evening block; you own the early-morning block." },
      out_roster_b: { type:"outcome", outcomeType:"roster", roster:"B",
        title:"Roster B fits your household",
        body:"A true alternating shift — bottles mean either adult can fully cover a block while the other sleeps uninterrupted." },
      out_roster_c: { type:"outcome", outcomeType:"roster", roster:"C",
        title:"Roster C fits your household",
        body:"A scheduled support-web roster built around a helper or family member, protecting fixed sleep windows for you." },

      q_tried_soothing: { type:"question", title:"Have you already tried a diaper check, a feed, and soothing?", options:[
        { label:"Not yet", next:"out_try_first" },
        { label:"Yes — still struggling", next:"out_script_4" },
      ]},
      out_try_first: { type:"outcome", outcomeType:"guidance",
        title:"Try these first",
        body:"Diaper check → feed if one is due → soothe for a few minutes in a dim, quiet space. If baby is still unsettled after that, come back here.",
        next:"out_script_4", nextLabel:"Still not settled — I need a handoff" },

      q_first_time: { type:"question", title:"Has the roster conversation happened before?", options:[
        { label:"No — this is the first time", next:"out_script_1" },
        { label:"Yes, but it broke down this week", next:"out_script_6" },
      ]},

      out_script_1: { type:"outcome", outcomeType:"script", scriptId:1 },
      out_script_2: { type:"outcome", outcomeType:"script", scriptId:2 },
      out_script_3: { type:"outcome", outcomeType:"script", scriptId:3 },
      out_script_4: { type:"outcome", outcomeType:"script", scriptId:4, severity:"high" },
      out_script_5: { type:"outcome", outcomeType:"script", scriptId:5 },
      out_script_6: { type:"outcome", outcomeType:"script", scriptId:6 },
      out_script_7: { type:"outcome", outcomeType:"script", scriptId:7 },

      // Spec §22 — high-stakes pathway: content-owned, never invented by the engine.
      q_safety_gate: { type:"safety_check", title:"In the last two weeks, have you had any of the following?",
        items:[
          "Thoughts of harming yourself or your baby, even fleeting",
          "Persistent hopelessness, worthlessness, or rage",
          "Inability to sleep even when covered by a shift-partner",
          "Panic attacks, racing thoughts, or a sense of unreality",
          "Physical symptoms that concern you",
        ],
        ifAnyChecked:"out_safety_flag", ifNoneChecked:"out_safety_clear" },
      out_safety_flag: { type:"outcome", outcomeType:"crisis",
        title:"Please reach out today",
        body:"This is a clinical situation, not a scheduling one. Contact your doctor, midwife, or a crisis line today — the same day. This is not a personal failing, and a shift chart can't fix it alone." },
      out_safety_clear: { type:"outcome", outcomeType:"reassurance",
        title:"No red flags right now",
        body:"Good — keep watching for these. For tonight, the Rescue flow and your roster are the right tools. Be honest with yourself again tomorrow." },
    }
  },

  // Spec §8 — RESCUE engine. Steps are typed and content-owned.
  rescueFlow: {
    title: "Bad Night Protocol",
    steps: [
      { type:"immediate", title:"Put baby down safely", body:"Place baby on their back, in the crib or bassinet, on a firm flat surface — even mid-cry. A crying baby in a safe crib is safer than an exhausted adult holding them." },
      { type:"avoid", title:"What not to do", body:"Don't hold baby on a sofa, armchair, or bed if there's any risk you might fall asleep. Don't wear earplugs while you're the active manager." },
      { type:"reset", title:"Step back & reset — 60 seconds", body:"Leave the room if needed. Breathe. You are not failing — you are protecting your baby by stepping back before you reach zero capacity." },
      { type:"next", title:"Call for the handoff", body:"Wake your partner or helper. This is the system working exactly as designed.", phrase:"I need a handoff. Now." },
      { type:"escalation", title:"If you or the baby may be unsafe", body:"Skip everything else and use the crisis directory below.", crisis:true },
      { type:"script_ref", scriptId:4 },
      { type:"restart", title:"Log it and move on", body:"Mark tonight as a rough night in the tracker. Tomorrow is a new cycle — see the Re-entry approach under Check-in." },
    ],
    crisisDirectory: [
      { country:"USA", name:"988 Suicide & Crisis Lifeline", number:"988", tel:"988" },
      { country:"UK", name:"NHS non-emergency", number:"111", tel:"111" },
      { country:"Nigeria", name:"National Emergency Number", number:"112", tel:"112" },
    ]
  },

  // Spec §9 — SCRIPT CARD engine. Content-owned, verbatim from the source guide.
  scripts: [
    { id:1, icon:"message-square-text", title:"Initiating the Shift Conversation", when:"During the day — never at night — when the baby is calm.",
      text:"I love how hard we are both working to take care of the baby. But my current exhaustion isn't sustainable — I am hitting a wall. I want us to look at this night-shift contract together. It's not about fault, it's about a roster so we both get a guaranteed sleep block. Can we look at it for 5 minutes after lunch?" },
    { id:2, icon:"clipboard-list", title:"Defusing \u201cI Have Work Tomorrow\u201d", when:"When your partner objects that he needs sleep for his job.",
      text:"I hear you, and your job is crucial. But caring for a newborn all day is also a full-time, high-stakes job. If I collapse or my health fails, our household goes down. We both need a minimum safety block to do our jobs safely. Let's look at the template that protects your sleep for the second half of the night." },
    { id:3, icon:"heart-handshake", title:"Handling \u201cYou Do It Better\u201d", when:"When he claims the baby only calms for you, to avoid night duty.",
      text:"The baby only prefers me because I've had more practice. You are just as capable of learning. If I step in every time, you will never get that practice, and I will never get sleep. I'm putting on my white noise machine. I trust you to find your rhythm. I'm going to sleep now." },
    { id:4, icon:"alarm-clock", title:"The Emergency Handoff", when:"When the active manager has reached their limit and safety is at risk.",
      text:"I have reached my limit. I am holding the baby safely but I am too exhausted to continue safely. I need to activate the emergency handoff. I'm putting the baby safely in the crib now and I need you to take over. I'll be back in 30 minutes." },
    { id:5, icon:"calendar-clock", title:"The 5-Minute Sunday Roster Review", when:"Every Sunday afternoon, to adjust the coming week's roster.",
      text:"Let's do our 5-minute night review. How did last week's shifts feel? Did you get your sleep blocks? Baby is waking at different times now — do we need to adjust our transition time? Let's write the updated hours on the chart." },
    { id:6, icon:"refresh-ccw", title:"The No-Blame Reset", when:"The morning after a night the roster collapsed or someone slept through.",
      text:"Last night was rough and we both lost our tempers. Let's not blame each other — exhaustion does that. The roster didn't work because [specific reason]. Let's adjust: tonight we will [specific fix]. We reset today with a clean slate." },
    { id:7, icon:"users", title:"Defusing Extended Family Critique", when:"When relatives say night duty \u201cisn't a man's job.\u201d",
      text:"Thank you for your care and concern. This is how we protect our marriage and our baby's safety. Sharing night shifts helps him bond with the baby from the beginning, and lets me heal physically. This system works for our household, and we are committed to it." },
  ],

  // Spec §24 — TSM (Transformation Success Measurement). Never invented by the engine.
  tsm: { id:"roster_confidence", label:"Confidence the roster will hold", scale:{min:1,max:10},
         checkpoints:[ {dayOffset:0,label:"Baseline"}, {dayOffset:7,label:"Day 7"}, {dayOffset:14,label:"Day 14"} ] },

  // Spec §14/§15 — milestones as product content
  milestones: [
    { id:"first_night_logged", label:"Logged your first night" },
    { id:"first_handoff", label:"Used your first emergency handoff — the system worked" },
    { id:"day7_review", label:"Completed the Day 7 review" },
    { id:"day14_review", label:"Completed the Day 14 review" },
  ],
};

/* ---------------------------------------------------------------------------
   VALIDATION ENGINE (Spec §29) — runs once at boot, before render.
--------------------------------------------------------------------------- */
function validateProductConfig(cfg){
  const errors = [];
  const dt = cfg.decisionTree;
  if (!dt || !dt.nodes[dt.root]) errors.push("decisionTree: root node missing");
  Object.entries(dt.nodes).forEach(([id, node]) => {
    if (node.type === "question") {
      if (!node.options || !node.options.length) errors.push(`node ${id}: question has no options`);
      (node.options||[]).forEach(o => { if (!dt.nodes[o.next]) errors.push(`node ${id}: option "${o.label}" points to missing node "${o.next}"`); });
    } else if (node.type === "safety_check") {
      if (!dt.nodes[node.ifAnyChecked]) errors.push(`node ${id}: ifAnyChecked -> missing node`);
      if (!dt.nodes[node.ifNoneChecked]) errors.push(`node ${id}: ifNoneChecked -> missing node`);
    } else if (node.type === "outcome") {
      if (node.outcomeType === "script" && !cfg.scripts.find(s => s.id === node.scriptId)) errors.push(`node ${id}: references missing script ${node.scriptId}`);
      if (node.next && !dt.nodes[node.next]) errors.push(`node ${id}: next -> missing node "${node.next}"`);
    } else {
      errors.push(`node ${id}: unknown type "${node.type}"`);
    }
  });
  cfg.rescueFlow.steps.forEach((s,i) => { if (s.type === "script_ref" && !cfg.scripts.find(x=>x.id===s.scriptId)) errors.push(`rescueFlow step ${i}: missing script ${s.scriptId}`); });
  if (errors.length) console.warn("[Engine] product config validation issues:", errors);
  return { valid: errors.length === 0, errors };
}

/* ---------------------------------------------------------------------------
   STATE MODEL (Spec §11, §20) — distinct concepts, distinct storage keys.
   Never collapsed into one blob.
--------------------------------------------------------------------------- */
const NS = "enjm_v06"; // namespace, scoped per productId in a real multi-product build
const Storage = {
  get(key, fallback){ try{ const v = localStorage.getItem(`${NS}.${key}`); return v ? JSON.parse(v) : fallback; }catch(e){ return fallback; } },
  set(key, val){ try{ localStorage.setItem(`${NS}.${key}`, JSON.stringify(val)); }catch(e){ /* storage unavailable: fail soft */ } },
};

const StateModel = {
  // "User state" — what this customer has configured / done (Spec §20)
  user: Storage.get("user", { onboarded:false, birthDate:null, roster:null, shiftTimes:{} }),
  // "Today" ephemeral daily state, resets each calendar day
  today: Storage.get("today", { date:null, checklist:{}, everythingNormal:null }),
  // Tracker — nights log + recovery-bank ledger
  tracker: Storage.get("tracker", { nights:[], ledger:[] }),
  // Event history (Spec §23 analytics vocabulary; stored locally, backend would ingest this)
  events: Storage.get("events", []),
  // TSM measurements (Spec §24)
  tsm: Storage.get("tsm", { measurements:{} }), // {0: 4, 7: 6, 14: 8}
  // Milestones completed (Spec §14)
  milestones: Storage.get("milestones", { completed:[] }),
  // Journey/product-level state (Spec §12)
  journey: Storage.get("journey", { stage:"active" }),

  persist(){
    Storage.set("user", this.user);
    Storage.set("today", this.today);
    Storage.set("tracker", this.tracker);
    Storage.set("events", this.events);
    Storage.set("tsm", this.tsm);
    Storage.set("milestones", this.milestones);
    Storage.set("journey", this.journey);
  }
};

/* Analytics (Spec §23) — no vanity metrics, just the defined event vocabulary */
function logEvent(name, payload){
  StateModel.events.push({ name, payload: payload||{}, ts: Date.now() });
  if (StateModel.events.length > 300) StateModel.events = StateModel.events.slice(-300);
  Storage.set("events", StateModel.events);
}

function todayStr(){ const d = new Date(); return d.toISOString().slice(0,10); }
function dayNumber(){
  if (!StateModel.user.birthDate) return null;
  const start = new Date(StateModel.user.birthDate + "T00:00:00");
  const now = new Date(todayStr() + "T00:00:00");
  return Math.floor((now - start) / 86400000) + 1;
}
function completeMilestone(id){
  if (!StateModel.milestones.completed.includes(id)){
    StateModel.milestones.completed.push(id);
    logEvent("milestone_completed", {id});
    StateModel.persist();
    toast("Milestone: " + (PRODUCT_CONFIG.milestones.find(m=>m.id===id)||{}).label);
  }
}
function toast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=>t.classList.remove("show"), 2200);
}
/* ============================================================================
   COMPONENT REGISTRY (Spec §14) — generic renderers.
   Each function takes config + state; none of them contain product prose
   beyond what PRODUCT_CONFIG hands them.
   ============================================================================ */
const cfg = PRODUCT_CONFIG;
let activeTab = "today";
let checkNav = { stack: [], current: cfg.decisionTree.root, safety: {} };
let activeScriptId = null;
let showNightForm = false;
let speaking = null;

/* ---------------- shared bits ---------------- */
function crisisDirectoryHTML(list){
  return `<div class="rowlist">` + list.map(c => `
    <a class="tap-row tel-btn" href="tel:${c.tel}">
      <div class="ic">${icon("phone",16,"#0B1F33")}</div>
      <div class="tx"><div class="tt">${c.name}</div><div class="td">${c.country}</div></div>
      <div class="chev" style="font-weight:800;color:#0B1F33;">${c.number}</div>
    </a>`).join("") + `</div>`;
}

function scriptDetailHTML(id, embedded){
  const s = cfg.scripts.find(x=>x.id===id);
  if(!s) return "";
  return `
  <div class="script-detail" style="${embedded?'margin-top:10px;':''}">
    <span class="stag">Script Card ${s.id}</span>
    <div class="stitle">${s.title}</div>
    <div class="swhen">${s.when}</div>
    <div class="squote">&ldquo;${s.text}&rdquo;</div>
    <div class="btn-row">
      <button class="btn btn-ghost btn-sm" data-act="copy-script" data-id="${s.id}">${icon("copy",14)} Copy</button>
      <button class="btn btn-ghost btn-sm" data-act="share-script" data-id="${s.id}">${icon("share-2",14)} Share</button>
      <button class="btn btn-ghost btn-sm" data-act="speak-script" data-id="${s.id}">${icon("volume-2",14)} Listen</button>
    </div>
  </div>`;
}

function schedBarHTML(roster, times){
  const r = cfg.rosters[roster];
  const s1 = times.start || r.shift1.defaultStart, mid = times.mid || r.shift1.defaultEnd, s2 = times.end || r.shift2.defaultEnd;
  return `
  <div class="sched-bar">
    <div class="sched-seg a" style="flex:1;">${r.shift1.owner} &middot; ${s1}&ndash;${mid}</div>
    <div class="sched-seg t">HANDOFF</div>
    <div class="sched-seg b" style="flex:1;">${r.shift2.owner} &middot; ${mid}&ndash;${s2}</div>
  </div>
  <div class="sched-labels"><span>${s1}</span><span>${mid}</span><span>${s2}</span></div>`;
}

/* ============================================================================
   TAB: TODAY  (component: TodayPlan + Checklist + Progress)  — Spec §3
   ============================================================================ */
function ensureTodayFresh(){
  const t = todayStr();
  if (StateModel.today.date !== t){
    StateModel.today = { date:t, checklist:{}, everythingNormal:null };
    StateModel.persist();
    logEvent("today_started", { day: dayNumber() });
  }
}

function renderToday(){
  ensureTodayFresh();
  const u = StateModel.user;
  if (!u.roster){
    return `
    <div class="card">
      <div class="section-label">${icon("compass",13)} GET STARTED</div>
      <div class="card-title">Which roster are you running?</div>
      <div class="card-sub">Pick one directly, or answer two quick questions and we'll pick it for you.</div>
      <div class="btn-row mt8">
        <button class="btn btn-purple btn-sm" data-act="goto-checkin" data-node="q_partner_avail">${icon("compass",14)} Help me decide</button>
      </div>
      <div class="rowlist mt12">
        ${Object.entries(cfg.rosters).map(([k,r])=>`
          <button class="tap-row" data-act="set-roster" data-roster="${k}">
            <div class="ic" style="background:#0B1F33;color:#fff;font-family:'DM Serif Display',serif;">${k}</div>
            <div class="tx"><div class="tt">Roster ${k}</div><div class="td">${r.name}</div></div>
            <div class="chev">${icon("chevron-right",16)}</div>
          </button>`).join("")}
      </div>
    </div>`;
  }

  const roster = cfg.rosters[u.roster];
  const items = cfg.dailyChecklist.filter(i => !i.rosters || i.rosters.includes(u.roster));
  const doneCount = items.filter(i => StateModel.today.checklist[i.id]).length;
  const allDone = doneCount === items.length;

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0,10);
  const hasYesterday = StateModel.tracker.nights.some(n => n.date === yesterday);

  return `
    <div class="card">
      <div class="section-label">${icon("sunset",13)} TONIGHT'S PLAN &middot; ROSTER ${u.roster}</div>
      ${schedBarHTML(u.roster, u.shiftTimes||{})}
    </div>

    <div class="card">
      <div class="card-title">Tonight's checklist</div>
      <div class="card-sub">${doneCount} / ${items.length} complete</div>
      <div>
        ${items.map(i => `
          <div class="check-item ${StateModel.today.checklist[i.id]?'done':''}" data-act="toggle-check" data-id="${i.id}">
            <div class="cb">${StateModel.today.checklist[i.id]?icon("check",13,"#fff"):""}</div>
            <div class="lbl">${i.label}</div>
          </div>`).join("")}
      </div>
    </div>

    <div class="card">
      <div class="card-title">Everything normal?</div>
      <div class="card-sub">${allDone ? "Checklist complete — log how tonight goes." : "Finish the checklist above, or tell us if something's already off."}</div>
      <div class="btn-row">
        <button class="btn btn-success" data-act="normal-yes">${icon("circle-check-big",15)} Yes</button>
        <button class="btn btn-danger" data-act="normal-no">${icon("triangle-alert",15)} Something changed</button>
      </div>
    </div>

    ${!hasYesterday ? `
    <div class="card">
      <div class="card-title">Log last night</div>
      <div class="card-sub">No entry yet for ${yesterday}. Takes 20 seconds and keeps your tracker accurate.</div>
      <button class="btn btn-ghost" data-act="open-night-form" data-date="${yesterday}">${icon("plus",14)} Log last night</button>
    </div>` : ``}
  `;
}

/* ============================================================================
   TAB: CHECK  (component: DecisionTree)  — Spec §4
   ============================================================================ */
function renderCheck(){
  const node = cfg.decisionTree.nodes[checkNav.current];
  const isRoot = checkNav.stack.length === 0;
  if (isRoot && checkNav.current === cfg.decisionTree.root) logEvent("decision_started", {});

  let inner = "";

  if (node.type === "question"){
    inner = `
      <div class="qtitle">${node.title}</div>
      <div class="rowlist">
        ${node.options.map(o => `
          <button class="tap-row" data-act="dt-choose" data-next="${o.next}">
            <div class="tx"><div class="tt">${o.label}</div></div>
            <div class="chev">${icon("chevron-right",16)}</div>
          </button>`).join("")}
      </div>`;
  } else if (node.type === "safety_check"){
    inner = `
      <div class="qtitle">${node.title}</div>
      <div class="card" style="padding:6px 14px;">
        ${node.items.map((it,idx) => `
          <div class="check-item ${checkNav.safety[idx]?'done':''}" data-act="dt-safety-toggle" data-idx="${idx}">
            <div class="cb">${checkNav.safety[idx]?icon("check",13,"#fff"):""}</div>
            <div class="lbl">${it}</div>
          </div>`).join("")}
      </div>
      <button class="btn btn-navy mt12" data-act="dt-safety-continue" data-any="${node.ifAnyChecked}" data-none="${node.ifNoneChecked}">Continue</button>`;
  } else if (node.type === "outcome"){
    logEvent("decision_completed", { outcomeType: node.outcomeType });
    if (node.outcomeType === "roster"){
      inner = `
        <div class="callout good">
          <div class="ic">${icon("circle-check-big",14)}</div>
          <div><span class="lbl">Recommended</span><div class="tx"><strong>${node.title}.</strong> ${node.body}</div></div>
        </div>
        <button class="btn btn-purple" data-act="dt-set-roster" data-roster="${node.roster}">Set as my roster</button>`;
    } else if (node.outcomeType === "guidance"){
      inner = `
        <div class="callout info">
          <div class="ic">${icon("compass",14)}</div>
          <div><span class="lbl">${node.title}</span><div class="tx">${node.body}</div></div>
        </div>
        ${node.next ? `<button class="btn btn-danger" data-act="dt-choose" data-next="${node.next}">${node.nextLabel}</button>` : ``}`;
    } else if (node.outcomeType === "script"){
      inner = `
        ${node.severity==="high" ? `<div class="callout safety"><div class="ic">${icon("shield-alert",14)}</div><div><span class="lbl">Use this now</span><div class="tx">This script is built for the moment you're in.</div></div></div>` : ``}
        ${scriptDetailHTML(node.scriptId, true)}
        ${node.severity==="high" ? `<button class="btn btn-ghost mt12" data-act="log-bad-night">${icon("plus",14)} Log this as a rough night</button>` : ``}`;
    } else if (node.outcomeType === "crisis"){
      inner = `
        <div class="callout safety">
          <div class="ic">${icon("shield-alert",14)}</div>
          <div><span class="lbl">${node.title}</span><div class="tx">${node.body}</div></div>
        </div>
        <div class="card"><div class="card-title" style="font-size:12.5px;">Crisis &amp; support directory</div>${crisisDirectoryHTML(cfg.rescueFlow.crisisDirectory)}</div>`;
    } else if (node.outcomeType === "reassurance"){
      inner = `
        <div class="callout good">
          <div class="ic">${icon("circle-check-big",14)}</div>
          <div><span class="lbl">${node.title}</span><div class="tx">${node.body}</div></div>
        </div>
        <button class="btn btn-danger" data-act="open-rescue">${icon("siren",14)} Open Rescue for tonight</button>`;
    }
  }

  return `
    ${!isRoot ? `<div class="breadcrumb" data-act="dt-back">${icon("chevron-left",13)} Back</div>` : ``}
    ${inner}
    ${!isRoot ? `<button class="btn btn-ghost mt12" data-act="dt-restart">${icon("refresh-ccw",14)} Start over</button>` : ``}
  `;
}

/* ============================================================================
   TAB: TRACKER  (components: Tracker + DailyLog + Progress + TSM)  — Spec §5,§10,§24
   ============================================================================ */
function nscBalance(){
  const earned = StateModel.tracker.ledger.length;
  const redeemed = StateModel.tracker.ledger.filter(l=>l.redeemed).length;
  const expired = StateModel.tracker.ledger.filter(l => !l.redeemed && daysLeft(l.date) <= 0).length;
  return earned - redeemed - expired;
}
function daysLeft(dateStr){
  const earned = new Date(dateStr+"T00:00:00");
  const now = new Date(todayStr()+"T00:00:00");
  const elapsed = Math.floor((now-earned)/86400000);
  return 7 - elapsed;
}
function avgSleep(){
  const withSleep = StateModel.tracker.nights.filter(n=>typeof n.sleepHours === "number");
  if (!withSleep.length) return "—";
  return (withSleep.reduce((a,n)=>a+n.sleepHours,0)/withSleep.length).toFixed(1);
}
function nightsSinceRough(){
  const nights = [...StateModel.tracker.nights].sort((a,b)=>a.date<b.date?1:-1);
  let c = 0;
  for (const n of nights){ if (n.badNight) break; c++; }
  return c;
}

function tsmCard(){
  const day = dayNumber();
  if (day === null) return "";
  const cps = cfg.tsm.checkpoints;
  const due = cps.find(c => day >= c.dayOffset && StateModel.tsm.measurements[c.dayOffset] === undefined && (c.dayOffset===0 || day <= c.dayOffset+3));
  const recorded = Object.entries(StateModel.tsm.measurements);
  return `
    <div class="card">
      <div class="card-title">${cfg.tsm.label}</div>
      ${recorded.length ? `<div class="btn-row" style="flex-wrap:wrap;gap:6px;">${recorded.map(([off,val])=>`<span class="pill exp-ok">${cps.find(c=>String(c.dayOffset)===off)?.label||('Day '+off)}: ${val}/10</span>`).join("")}</div>` : `<div class="card-sub mb0">Not recorded yet.</div>`}
      ${due ? `
      <div class="mt12">
        <div class="card-sub" style="margin-bottom:6px;">${due.label} check-in — how confident are you the roster will hold? (1&ndash;10)</div>
        <div class="btn-row">
          <input type="number" min="1" max="10" id="tsmInput" style="width:60px; padding:9px; border-radius:10px; border:1px solid var(--border); text-align:center;" />
          <button class="btn btn-purple btn-sm" data-act="record-tsm" data-offset="${due.dayOffset}">Save</button>
        </div>
      </div>` : ``}
    </div>`;
}

function ledgerRowHTML(l, idx){
  let pill;
  if (l.redeemed) pill = `<span class="pill redeemed">Redeemed</span>`;
  else { const d = daysLeft(l.date); pill = d<=0 ? `<span class="pill expired">Expired</span>` : d<=2 ? `<span class="pill exp-soon">${d}d left</span>` : `<span class="pill exp-ok">${d}d left</span>`; }
  return `
    <div class="ledger-row">
      <div><div class="lt">${l.parent} &middot; ${l.activity}</div><div class="ld">Earned ${l.date}</div></div>
      <div style="display:flex; align-items:center; gap:6px;">
        ${pill}
        ${(!l.redeemed && daysLeft(l.date)>0) ? `<button class="btn btn-ghost btn-sm" data-act="redeem-nsc" data-idx="${idx}">Redeem</button>` : ``}
      </div>
    </div>`;
}

function renderTracker(){
  const nights = [...StateModel.tracker.nights].sort((a,b)=> a.date<b.date?1:-1);
  return `
    <div class="stat-grid">
      <div class="stat-box"><div class="sv">${nights.length}</div><div class="sl">Nights logged</div></div>
      <div class="stat-box"><div class="sv">${avgSleep()}</div><div class="sl">Avg. sleep (hrs)</div></div>
      <div class="stat-box"><div class="sv">${nscBalance()}</div><div class="sl">NSC balance</div></div>
      <div class="stat-box"><div class="sv">${nightsSinceRough()}</div><div class="sl">Nights since rough one</div></div>
    </div>

    ${tsmCard()}

    <div class="card">
      <div class="card-title">Recovery Bank ledger</div>
      ${StateModel.tracker.ledger.length ? StateModel.tracker.ledger.map(ledgerRowHTML).join("") : `<div class="card-sub mb0">No credits yet — they're logged automatically when you use an emergency handoff.</div>`}
    </div>

    <div class="card">
      <div class="card-title" style="display:flex; justify-content:space-between; align-items:center;">
        <span>Night log</span>
        <button class="btn btn-purple btn-sm" data-act="open-night-form" data-date="${todayStr()}">${icon("plus",13)} Log a night</button>
      </div>
      ${showNightForm ? nightFormHTML() : ``}
      ${nights.length ? nights.map(n => `
        <div class="night-row">
          <div class="nh"><span class="nd">${n.date} &middot; Roster ${n.roster||"—"}</span><span class="nb ${n.badNight?'bad':'ok'}">${n.badNight?"Rough":"OK"}</span></div>
          <div class="nm">${n.shift1Manager||"—"} / ${n.shift2Manager||"—"} &middot; ${typeof n.sleepHours==='number'?n.sleepHours+"h sleep":"no sleep logged"}${n.handoff?" &middot; handoff used":""}</div>
          ${n.notes?`<div class="nm" style="margin-top:3px;font-style:italic;">${n.notes}</div>`:``}
        </div>`).join("") : `<div class="center-empty">${icon("clipboard-list",30,"#8593A1")}<div>No nights logged yet.</div></div>`}
    </div>

    <button class="btn btn-ghost" data-act="export-summary">${icon("copy",14)} Copy shareable summary</button>
  `;
}

function nightFormHTML(){
  const u = StateModel.user;
  return `
  <div class="card" style="background:var(--soft); box-shadow:none; margin:10px 0;">
    <div class="field"><label>Date</label><input type="text" id="nfDate" value="${todayStr()}" placeholder="YYYY-MM-DD"/></div>
    <div class="field"><label>Roster used</label>
      <div class="roster-pick">
        ${Object.keys(cfg.rosters).map(k=>`<div class="rp ${u.roster===k?'sel':''}" data-pick-roster="${k}"><div class="rl">${k}</div></div>`).join("")}
      </div>
    </div>
    <div class="field"><label>Shift 1 manager</label><input type="text" id="nfS1" placeholder="e.g. Partner"/></div>
    <div class="field"><label>Shift 2 manager</label><input type="text" id="nfS2" placeholder="e.g. Mother"/></div>
    <div class="field"><label>Mother's sleep (hours)</label><input type="number" id="nfSleep" step="0.5" min="0" max="14"/></div>
    <div class="check-item" id="nfHandoff" data-toggle="handoff"><div class="cb"></div><div class="lbl">Emergency handoff used</div></div>
    <div class="check-item" id="nfBad" data-toggle="bad"><div class="cb"></div><div class="lbl">This was a rough night</div></div>
    <div class="field mt8"><label>Notes (optional)</label><input type="text" id="nfNotes" placeholder="Anything worth remembering"/></div>
    <div class="btn-row">
      <button class="btn btn-ghost" data-act="cancel-night-form">Cancel</button>
      <button class="btn btn-purple" data-act="save-night-form">Save</button>
    </div>
  </div>`;
}

/* ============================================================================
   TAB: SCRIPTS  (component: ScriptCard)  — Spec §9
   ============================================================================ */
function renderScripts(){
  if (activeScriptId){
    const s = cfg.scripts.find(x=>x.id===activeScriptId);
    return `
      <div class="breadcrumb" data-act="scripts-back">${icon("chevron-left",13)} All situations</div>
      ${scriptDetailHTML(s.id, false)}
    `;
  }
  return `
    <div class="section-label">${icon("message-square-text",13)} WHAT HAPPENED?</div>
    <div class="rowlist">
      ${cfg.scripts.map(s => `
        <button class="tap-row" data-act="open-script" data-id="${s.id}">
          <div class="ic">${icon(s.icon,16,"#0B1F33")}</div>
          <div class="tx"><div class="tt">${s.title}</div><div class="td">${s.when}</div></div>
          <div class="chev">${icon("chevron-right",16)}</div>
        </button>`).join("")}
    </div>`;
}

/* ============================================================================
   RESCUE OVERLAY  (component: RescueFlow)  — Spec §8
   ============================================================================ */
function renderRescueBody(){
  const stepHTML = (s) => {
    if (s.type === "immediate") return `<div class="callout info"><div class="ic">${icon("target",14)}</div><div><span class="lbl">${s.title}</span><div class="tx">${s.body}</div></div></div>`;
    if (s.type === "avoid") return `<div class="callout warn"><div class="ic">${icon("triangle-alert",14)}</div><div><span class="lbl">${s.title}</span><div class="tx">${s.body}</div></div></div>`;
    if (s.type === "reset") return `<div class="callout human"><div class="ic">${icon("hand-heart",14)}</div><div><span class="lbl">${s.title}</span><div class="tx">${s.body}</div></div></div>`;
    if (s.type === "next") return `
      <div class="callout good"><div class="ic">${icon("circle-check-big",14)}</div><div><span class="lbl">${s.title}</span><div class="tx">${s.body}</div></div></div>
      <div class="script-detail" style="text-align:center; margin-bottom:12px;">
        <div class="squote" style="margin-bottom:8px;">&ldquo;${s.phrase}&rdquo;</div>
        <button class="btn btn-navy btn-sm" data-act="copy-phrase" data-text="${s.phrase}">${icon("copy",13)} Copy phrase</button>
      </div>`;
    if (s.type === "escalation") return `<div class="callout safety"><div class="ic">${icon("shield-alert",14)}</div><div><span class="lbl">${s.title}</span><div class="tx">${s.body}</div></div></div><div class="card">${crisisDirectoryHTML(cfg.rescueFlow.crisisDirectory)}</div>`;
    if (s.type === "script_ref") return scriptDetailHTML(s.scriptId, true);
    if (s.type === "restart") return `
      <div class="callout good"><div class="ic">${icon("refresh-ccw",14)}</div><div><span class="lbl">${s.title}</span><div class="tx">${s.body}</div></div></div>
      <button class="btn btn-navy" data-act="rescue-complete">Mark tonight as rough &amp; close</button>`;
    return "";
  };
  return cfg.rescueFlow.steps.map(stepHTML).join("");
}

/* ============================================================================
   SETTINGS OVERLAY
   ============================================================================ */
function renderSettings(){
  const u = StateModel.user;
  return `
    <div class="card">
      <div class="card-title">Baby's birth date</div>
      <div class="field"><input type="date" id="setBirth" value="${u.birthDate||''}"/></div>
      <div class="card-title">Roster</div>
      <div class="roster-pick mt8">
        ${Object.keys(cfg.rosters).map(k=>`<div class="rp ${u.roster===k?'sel':''}" data-set-roster="${k}"><div class="rl">${k}</div></div>`).join("")}
      </div>
      <button class="btn btn-purple mt12" data-act="save-settings">Save</button>
    </div>
    <div class="card">
      <div class="card-title">Your data</div>
      <div class="card-sub">${StateModel.tracker.nights.length} nights logged &middot; ${StateModel.events.length} events recorded locally.</div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" data-act="export-data">${icon("copy",13)} Export JSON</button>
        <button class="btn btn-danger btn-sm" data-act="reset-data">Reset all data</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title" style="font-size:12px;">Content version</div>
      <div class="card-sub mb0">${cfg.contentVersion} &middot; product ${cfg.productId}</div>
    </div>
  `;
}

/* ============================================================================
   ONBOARDING MODAL
   ============================================================================ */
let onboardRoster = null;
function renderOnboarding(){
  return `
    <div class="mtitle">Welcome</div>
    <div class="msub">Two quick things so today's plan is right for your household.</div>
    <div class="field"><label>Baby's birth date</label><input type="date" id="obBirth"/></div>
    <div class="field"><label>Which roster?</label>
      <div class="roster-pick">
        ${Object.keys(cfg.rosters).map(k=>`<div class="rp" data-ob-roster="${k}"><div class="rl">${k}</div><div class="rd">${cfg.rosters[k].name}</div></div>`).join("")}
      </div>
    </div>
    <button class="btn btn-ghost mt8" data-act="ob-undecided">Not sure — help me decide</button>
    <button class="btn btn-purple mt8" data-act="ob-save">Start</button>
  `;
}

/* ============================================================================
   TAB BAR + ROUTER
   ============================================================================ */
const TABS = [
  { id:"today", label:"Tonight", icon:"sunset" },
  { id:"check", label:"Check-in", icon:"compass" },
  { id:"tracker", label:"Tracker", icon:"clipboard-list" },
  { id:"scripts", label:"Scripts", icon:"message-square-text" },
];
function renderTabBar(){
  document.getElementById("tabbar").innerHTML = TABS.map(t => `
    <button class="tab ${activeTab===t.id?'active':''}" data-tab="${t.id}">
      ${icon(t.icon, 19)}
      <span class="tlabel">${t.label}</span>
    </button>`).join("");
}

function renderHeader(){
  document.getElementById("markSlot").innerHTML = `
    <svg width="22" height="22" viewBox="0 0 100 100"><rect x="10" y="46" width="40" height="40" rx="10" transform="rotate(45 30 66)" fill="#FFFFFF"/><rect x="50" y="6" width="40" height="40" rx="10" transform="rotate(45 70 26)" fill="#D9A52E"/><path d="M42 54 L58 38" stroke="#D9A52E" stroke-width="5" stroke-linecap="round" opacity="0.9"/></svg>
    <b>Every Night, Just Me</b>`;
  document.getElementById("btnSettings").innerHTML = icon("settings",15,"#fff");
  document.getElementById("btnRescue").innerHTML = icon("siren",24,"#fff");
  document.getElementById("closeRescue").innerHTML = icon("x",15,"#fff");
  document.getElementById("closeSettings").innerHTML = icon("x",15,"#0B1F33");
  const d = dayNumber();
  document.getElementById("dayVal").textContent = d===null ? "Day —" : "Day " + d;
  document.getElementById("chipRoster").textContent = "Roster " + (StateModel.user.roster || "—");
  document.getElementById("chipNsc").innerHTML = `<span class="g">${nscBalance()}</span>&nbsp;NSC`;
}

function renderMain(){
  const main = document.getElementById("main");
  if (activeTab==="today") main.innerHTML = renderToday();
  else if (activeTab==="check") main.innerHTML = renderCheck();
  else if (activeTab==="tracker") main.innerHTML = renderTracker();
  else if (activeTab==="scripts") main.innerHTML = renderScripts();
  main.scrollTop = 0;
}

function renderAll(){ renderHeader(); renderTabBar(); renderMain(); }

/* ============================================================================
   EVENT DELEGATION — one listener, dispatches on data-act
   ============================================================================ */
document.addEventListener("click", (e) => {
  const tabBtn = e.target.closest("[data-tab]");
  if (tabBtn){ activeTab = tabBtn.dataset.tab; showNightForm=false; renderAll(); return; }

  const el = e.target.closest("[data-act]");
  if (!el) {
    // roster-pick taps inside forms (no data-act on the row itself in night form)
    const rp = e.target.closest("[data-pick-roster]");
    if (rp){ document.querySelectorAll("[data-pick-roster]").forEach(x=>x.classList.remove("sel")); rp.classList.add("sel"); rp.dataset.selected="1"; return; }
    const obr = e.target.closest("[data-ob-roster]");
    if (obr){ document.querySelectorAll("[data-ob-roster]").forEach(x=>x.classList.remove("sel")); obr.classList.add("sel"); onboardRoster = obr.dataset.obRoster; return; }
    const sr = e.target.closest("[data-set-roster]");
    if (sr){ document.querySelectorAll("[data-set-roster]").forEach(x=>x.classList.remove("sel")); sr.classList.add("sel"); sr.dataset.selected="1"; return; }
    const nfToggle = e.target.closest("[data-toggle]");
    if (nfToggle){ nfToggle.classList.toggle("done"); const cb = nfToggle.querySelector(".cb"); cb.innerHTML = nfToggle.classList.contains("done") ? icon("check",13,"#fff") : ""; return; }
    if (e.target.id === "btnSettings" || e.target.closest("#btnSettings")){ document.getElementById("settingsBody").innerHTML = renderSettings(); document.getElementById("overlaySettings").classList.add("open"); return; }
    if (e.target.id === "btnRescue" || e.target.closest("#btnRescue")){ logEvent("rescue_started",{}); document.getElementById("rescueBody").innerHTML = renderRescueBody(); document.getElementById("overlayRescue").classList.add("open"); return; }
    if (e.target.id === "closeRescue" || e.target.closest("#closeRescue")){ document.getElementById("overlayRescue").classList.remove("open"); return; }
    if (e.target.id === "closeSettings" || e.target.closest("#closeSettings")){ document.getElementById("overlaySettings").classList.remove("open"); return; }
    return;
  }

  const act = el.dataset.act;

  if (act==="toggle-check"){
    const id = el.dataset.id;
    StateModel.today.checklist[id] = !StateModel.today.checklist[id];
    StateModel.persist();
    const items = cfg.dailyChecklist.filter(i => !i.rosters || i.rosters.includes(StateModel.user.roster));
    if (items.every(i=>StateModel.today.checklist[i.id])) logEvent("checklist_completed", {});
    renderMain(); renderHeader();
  }
  else if (act==="set-roster"){ StateModel.user.roster = el.dataset.roster; StateModel.persist(); toast("Roster " + el.dataset.roster + " set."); renderAll(); }
  else if (act==="goto-checkin"){ activeTab="check"; checkNav={stack:[],current:el.dataset.node,safety:{}}; renderAll(); }
  else if (act==="normal-yes"){ StateModel.today.everythingNormal=true; StateModel.persist(); toast("Logged. Sleep well."); }
  else if (act==="normal-no"){ activeTab="check"; checkNav={stack:[],current:cfg.decisionTree.root,safety:{}}; renderAll(); }
  else if (act==="open-night-form"){ showNightForm=true; renderMain(); document.getElementById("nfDate").value = el.dataset.date; }
  else if (act==="cancel-night-form"){ showNightForm=false; renderMain(); }
  else if (act==="save-night-form"){ saveNightForm(); }
  else if (act==="redeem-nsc"){ StateModel.tracker.ledger[el.dataset.idx].redeemed=true; StateModel.tracker.ledger[el.dataset.idx].redeemedDate=todayStr(); StateModel.persist(); renderMain(); renderHeader(); toast("Redeemed."); }
  else if (act==="export-summary"){ exportSummary(); }
  else if (act==="export-data"){ exportData(); }
  else if (act==="reset-data"){ if(confirm("Erase all locally saved data on this device?")){ localStorage.clear(); location.reload(); } }
  else if (act==="save-settings"){
    const birth = document.getElementById("setBirth").value;
    const chosen = document.querySelector("[data-set-roster].sel");
    if (birth) StateModel.user.birthDate = birth;
    if (chosen) StateModel.user.roster = chosen.dataset.setRoster;
    StateModel.persist();
    document.getElementById("overlaySettings").classList.remove("open");
    renderAll(); toast("Saved.");
  }
  else if (act==="ob-save"){
    const birth = document.getElementById("obBirth").value;
    if (!birth){ toast("Add a birth date to continue."); return; }
    StateModel.user.birthDate = birth;
    StateModel.user.roster = onboardRoster;
    StateModel.user.onboarded = true;
    StateModel.persist();
    document.getElementById("onboardModal").classList.remove("open");
    renderAll();
  }
  else if (act==="ob-undecided"){
    const birth = document.getElementById("obBirth").value;
    StateModel.user.birthDate = birth || todayStr();
    StateModel.user.onboarded = true;
    StateModel.persist();
    document.getElementById("onboardModal").classList.remove("open");
    activeTab="check"; checkNav={stack:[],current:"q_partner_avail",safety:{}};
    renderAll();
  }
  // Decision tree
  else if (act==="dt-choose"){ checkNav.stack.push(checkNav.current); checkNav.current = el.dataset.next; renderMain(); }
  else if (act==="dt-back"){ checkNav.current = checkNav.stack.pop(); renderMain(); }
  else if (act==="dt-restart"){ checkNav = {stack:[],current:cfg.decisionTree.root,safety:{}}; renderMain(); }
  else if (act==="dt-safety-toggle"){ const i=el.dataset.idx; checkNav.safety[i]=!checkNav.safety[i]; renderMain(); }
  else if (act==="dt-safety-continue"){
    const any = Object.values(checkNav.safety).some(Boolean);
    checkNav.stack.push(checkNav.current);
    checkNav.current = any ? el.dataset.any : el.dataset.none;
    renderMain();
  }
  else if (act==="dt-set-roster"){ StateModel.user.roster = el.dataset.roster; StateModel.persist(); toast("Roster "+el.dataset.roster+" set."); activeTab="today"; checkNav={stack:[],current:cfg.decisionTree.root,safety:{}}; renderAll(); }
  else if (act==="open-rescue"){ document.getElementById("btnRescue").click(); }
  else if (act==="log-bad-night"){ quickLogBadNight(); toast("Logged as a rough night."); }
  // Scripts
  else if (act==="open-script"){ activeScriptId = parseInt(el.dataset.id); renderMain(); }
  else if (act==="scripts-back"){ activeScriptId = null; renderMain(); }
  else if (act==="copy-script"){ const s=cfg.scripts.find(x=>x.id==el.dataset.id); copyText(s.text); logEvent("script_copied",{id:s.id}); toast("Copied to clipboard."); }
  else if (act==="share-script"){ const s=cfg.scripts.find(x=>x.id==el.dataset.id); shareText(s.text, s.title); logEvent("script_shared",{id:s.id}); }
  else if (act==="speak-script"){ const s=cfg.scripts.find(x=>x.id==el.dataset.id); speak(s.text); }
  else if (act==="copy-phrase"){ copyText(el.dataset.text); toast("Copied."); }
  else if (act==="rescue-complete"){ quickLogBadNight(); logEvent("rescue_completed",{}); document.getElementById("overlayRescue").classList.remove("open"); toast("Logged. Be gentle with yourself tomorrow."); renderMain(); renderHeader(); }
  // TSM
  else if (act==="record-tsm"){
    const val = parseInt(document.getElementById("tsmInput").value);
    if (!val || val<1 || val>10){ toast("Enter a number 1–10."); return; }
    StateModel.tsm.measurements[el.dataset.offset] = val;
    StateModel.persist();
    logEvent("tsm_measurement_recorded", {offset:el.dataset.offset, val});
    if (el.dataset.offset==="7") completeMilestone("day7_review");
    if (el.dataset.offset==="14") completeMilestone("day14_review");
    renderMain();
  }
});

function saveNightForm(){
  const sel = document.querySelector("[data-pick-roster].sel") || document.querySelector("[data-pick-roster][data-selected]");
  const entry = {
    date: document.getElementById("nfDate").value || todayStr(),
    roster: sel ? sel.dataset.pickRoster : StateModel.user.roster,
    shift1Manager: document.getElementById("nfS1").value,
    shift2Manager: document.getElementById("nfS2").value,
    sleepHours: parseFloat(document.getElementById("nfSleep").value) || undefined,
    handoff: document.getElementById("nfHandoff").classList.contains("done"),
    badNight: document.getElementById("nfBad").classList.contains("done"),
    notes: document.getElementById("nfNotes").value,
  };
  StateModel.tracker.nights = StateModel.tracker.nights.filter(n=>n.date!==entry.date);
  StateModel.tracker.nights.push(entry);
  if (entry.handoff){
    StateModel.tracker.ledger.push({ date: entry.date, parent: entry.shift1Manager||"Partner", activity:"Emergency handoff", redeemed:false });
    completeMilestone("first_handoff");
  }
  if (StateModel.tracker.nights.length === 1) completeMilestone("first_night_logged");
  StateModel.persist();
  logEvent("tracker_entry_created", { date: entry.date });
  showNightForm = false;
  renderMain(); renderHeader();
  toast("Night logged.");
}

function quickLogBadNight(){
  const d = todayStr();
  let n = StateModel.tracker.nights.find(x=>x.date===d);
  if (!n){ n = {date:d, roster:StateModel.user.roster}; StateModel.tracker.nights.push(n); }
  n.badNight = true;
  StateModel.persist();
  logEvent("tracker_entry_created", {date:d, badNight:true});
}

function exportSummary(){
  const nights = StateModel.tracker.nights;
  const lines = [
    `Every Night, Just Me — Shift Summary`,
    `Roster: ${StateModel.user.roster||"—"}  ·  Day ${dayNumber()||"—"}`,
    `Nights logged: ${nights.length}  ·  Avg sleep: ${avgSleep()}h  ·  NSC balance: ${nscBalance()}`,
    ``,
    ...nights.sort((a,b)=>a.date<b.date?-1:1).map(n=>`${n.date} — Roster ${n.roster||"—"} — ${n.shift1Manager||"—"}/${n.shift2Manager||"—"} — ${typeof n.sleepHours==='number'?n.sleepHours+"h":"?"}${n.badNight?" — ROUGH":""}${n.notes?" — "+n.notes:""}`)
  ];
  copyText(lines.join("\n"));
  toast("Summary copied — paste it anywhere.");
}
function exportData(){
  const blob = new Blob([JSON.stringify({ user:StateModel.user, tracker:StateModel.tracker, tsm:StateModel.tsm, milestones:StateModel.milestones, events:StateModel.events }, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "every-night-just-me-data.json"; a.click();
  URL.revokeObjectURL(url);
}
function copyText(t){ if (navigator.clipboard) navigator.clipboard.writeText(t); }
function shareText(text, title){
  if (navigator.share) navigator.share({title, text}).catch(()=>{});
  else { copyText(text); toast("Sharing unavailable — copied instead."); }
}
function speak(text){
  if (!("speechSynthesis" in window)) { toast("Read aloud not supported here."); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.98;
  window.speechSynthesis.speak(u);
}

/* ============================================================================
   BOOT
   ============================================================================ */
(function boot(){
  const v = validateProductConfig(cfg);
  if (!v.valid) console.warn("Product config has issues — see above.");
  logEvent("interactive_opened", {});
  ensureTodayFresh();
  renderAll();
  if (!StateModel.user.onboarded){
    document.getElementById("onboardModalInner").innerHTML = renderOnboarding();
    document.getElementById("onboardModal").classList.add("open");
  }
})();
