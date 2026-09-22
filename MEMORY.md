# SWIIPT — SESSION MEMORY
*Last updated: 2026-08-24*
*Working folder: `C:\Users\User\Desktop\Transformation\Product Pipeline\` (canonical home; root `Products/` folder deleted, factory record store lives in `data/`)*

---

## WHAT THIS COMPANY IS

**Swiipt** — a Life Transformation Engine for Nigerian women and the African diaspora.
Company sentence: *"We do not create products. We discover transformations, codify them into reusable knowledge, and assemble that knowledge into whatever format best helps a woman achieve the outcome she wants."*

Flow: `Research → Knowledge → Transformation → Evidence → Products`
Products are LAST, not first.

---

## THE 9-LAYER ARCHITECTURE (master Architecture.md)

1. **BRAND** — one umbrella, one promise
2. **TRANSFORMATION LIBRARIES** — 15 permanent domains (Marriage, Fertility, Pregnancy, Motherhood, Parenting Toddler/School/Teen, Nutrition, Hormones, Mental Wellbeing, Skin & Body, Confidence, Home, Faith, Midlife)
3. **DISCOVERY ENGINE** — 8 research sources + 11-field scoring matrix → ranked Transformation Queue. No transformation built from a hunch.
4. **CUSTOMER JOURNEY GRAPH** — 18 Life States + 12 Transition Triggers. Predicts what she needs next.
5. **TRANSFORMATIONS** — validated, scored, Before State / After State / Evidence / Connected Transformations
6. **ATOMIC TRANSFORMATION UNITS (ATUs)** — smallest teachable skill. Built once, reused across many products.
7. **CORE KNOWLEDGE DOMAINS (CKDs)** — research foundation ATUs draw from (renamed from Knowledge Blocks)
8. **ASSET ENGINE** — format chosen by transformation need, never by default
9. **PRODUCTS / EXPERIENCES / SERVICES / COMMUNITY** — what the customer sees

### Correct dependency flow:
`CKDs → ATUs → Transformations → Assets → Products`
(NOT the other way round)

### Moat = 5 proprietary assets working together:
1. Discovery Data | 2. Knowledge Architecture | 3. Transformation Methodology | 4. Outcome Evidence | 5. Journey Intelligence

### TSM (Transformation Success Metric)
- Defined BEFORE publication — measurable before/after
- Success threshold: 60%+ of completers meet criteria at 30 days
- Check-ins: Day 7, Day 14, Day 30
- "Read 87% of the guide" is NOT success. Life change is.

---

## PRODUCT CREATION STANDARD (Product creation guideline.md)

Every product needs, in this order:
1. **Situation statement** — "When [person] experiencing [situation], struggles with [problem] because [constraint], wants [transformation]"
2. **Before → Mechanism → After** (not just information)
3. **Day-by-day sequence** — not a pile of content
4. **Implementation assets** — worksheets, trackers, decision trees, scripts
5. **Failure-point system** — normal path, bad day, missed day, resistance, overwhelm, relapse, re-entry, escalation
6. **Rescue protocols** — "When X happens, do Y"
7. **Multi-format delivery** — READ / DO / DECIDE / TRACK / COMMUNICATE / RESCUE
8. **First win within 15 minutes**
9. **Proof of transformation at the end**
10. **Next situation recommendation**

### 10-component SWIIPT Transformation System Template:
01 Product Identity | 02 Before State | 03 After State | 04 Mechanism | 05 Transformation Path | 06 Asset Map | 07 Failure-Point Map | 08 First-Win Design | 09 TSM | 10 Re-entry/Maintenance | 11 Next Transformation

### Product Quality Gate (15 criteria): A. Situation clarity B. Before/after clarity C. Mechanism D. Implementation E. Sequence F. First win G. Failure handling H. Decision support I. Measurement J. Re-entry K. Maintenance L. Next situation M. Format fit N. Evidence O. Safety

---

## TECH STACK — WORDPRESS EDITION (implementation-plan-wordpress-v2.0.md)

**Platform:** Swiipt — built on WordPress 6.x + PHP 8.3 + MySQL 8
**Custom plugin:** `swiipt-core` (must-use, 10 modules as PHP namespaces)
**Theme:** `swiipt` (already built — handles presentation only, never engine data)
**Commerce:** WooCommerce + custom payment gateway adapters
**Payments:** Bank Transfer NGN (primary) → Paystack → Flutterwave → Stripe
**Background jobs:** Action Scheduler
**Search:** ElasticPress (BM25+vector) or SearchWP + `swiipt_embeddings` table
**AI:** AIProviderAdapter + EmbeddingProviderAdapter (swappable)
**Cache:** Redis

### 10 Engine Modules (inside swiipt-core):
FOUNDATION · KNOWLEDGE · NAVIGATION · LEARNING · DELIVERY · COMMERCE · CUSTOMER · COMMUNITY · EVIDENCE · OPERATIONS

### 5 Core Engines:
1. DISCOVERY ENGINE — Search → Situation → Graph → Transformations
2. TRANSFORMATION ENGINE — Before → Mechanism → Protocol → Tools → Failure → After
3. DELIVERY/EXECUTION ENGINE — Product → Steps → Check-ins → Progress → Rescue → Re-entry
4. LEARNING ENGINE — Usage → Outcomes → Updates knowledge
5. JOURNEY ENGINE — Situation A → Transformation → Outcome → Situation B

### Build Phases (12 phases):
0: Brand/Design [THEME ✓ done] → 1: Foundation (swiipt-core scaffold) → 2: KNOWLEDGE Module → 3: NAVIGATION (Situation Graph) → 4: DELIVERY (Asset Engine) → 5: COMMERCE (WooCommerce) → 6: Inventory Build [OWNER-GATED] → 7: CUSTOMER Module → 8: LEARNING Layer → 9: EVIDENCE/OPERATIONS → 10: Public Surfaces/AI → 11: Notifications/Community → 12: QA/Launch

### Pricing ladder:
Free (Situation Finder) → Entry $12–19 → Core $24–39 (flagship) → Bundle $49–79 → Collection $99–129

### Do-Not-Build:
Universal Life Score · Gamification · Badges/XP · Leaderboards · Second-brain notes · Wearables · Generic AI therapist/chatbot · Giant social community

---

## CURRENT PRODUCT FOCUS — POSTPARTUM NICHE (product2.md)

### Phase 1 — Build & Launch Now:

**Product 1:** *Is This Normal? Understanding Your Post-Baby Belly, Scar, Core & Recovery Timeline*
- Buyer: Woman 6 weeks–12 months postpartum, confused/afraid about belly/core/movement
- Micro-markets: A1 (C-section shelf) + A2 (diastasis/coning) + B4 (movement fear) + C5 (recovery-timeline anger)
- Transformation: Confused & afraid → informed, has safe-movement plan, knows red flags, realistic expectations

**Product 2:** *The New-Body Closet: Dressing the Shape You Have Now*
- Buyer: Woman 3–9 months postpartum, wardrobe doesn't fit changed body
- Micro-markets: D1 (everyday wardrobe) + D3 (return-to-work) + styling around A3/A5/A6
- Transformation: Stuck in leggings, decision fatigue → knows how to dress current body, feels put-together

**Phase 1.5 Upsell (attached to Product 2 only):**
*The 3-Week Notice: Look Put-Together for the Event You Can't Skip*

### Phase 2 — Build now, launch after Wave 1:
**Product 3:** *The Quiet Leak: Taking Back Control of Your Body After Baby*
- Distribution: WhatsApp/community ONLY (not Meta cold ads — documented rejection)
- Four entry doors: B1-A (startle) + B1-B (exercise) + B1-C (prayer/purity) + B1-D (normalized)

### Library Reserve (held pending real customer data):
- Future standalones: A3, A5, B5, B7, B2
- Modules: A6, C2, C3, C5, C6
- Lead magnets: C1 ("The Family Photo Problem"), D4 ("The Old Jeans Test")
- Bonus/nurture: A4, B8, B10

### Open Hypotheses to validate:
1. Does A1+A2+B4 belong in one flagship or three adjacent products?
2. Does B1 need four landing pages → one product, or four distinct products?
3. Is D1 a second build or month-2 cross-sell only?

---

## KEY RULES (never break these)

- NO product created as a PDF by default — format follows transformation need
- NO fabricated inventory, fake testimonials, placeholder "coming soon" storefronts
- NO promised outcomes — evidence labels required site-wide
- 30-day plain refund, no questions
- Every transformation needs a TSM BEFORE publication
- AI Navigator: helps identify/navigate situations — NEVER diagnoses mental illness or provides therapy
- Business logic always in swiipt-core — theme only renders
- Clinical/medical content reviewed by qualified professional, not internal review alone

---

---

## PRODUCT SCOPING DISCIPLINE (locked — applies before any product is accepted)

### The hierarchy (never skip a level):
```
Broad topic → Specific recurring situation → Transformation → Mechanism → Product
```

**A specific mechanism is NOT the same as a specific market.**
"12-week safe core progression" = mechanism. It does NOT make "Diastasis/Core Recovery" a sufficiently narrow product.

### The mandatory pre-acceptance test:

Before a product is accepted, answer ALL of these:
- Specific person (who exactly?)
- Specific timeframe (when exactly?)
- Specific trigger/situation (what is happening to her?)
- Specific failed attempt/constraint (what has she already tried that didn't work?)
- Specific emotional stake (what does she fear? what does she feel?)
- Specific desired outcome (what does she want next?)

**If you cannot answer all six without the product title, the product is not sufficiently scoped.**

### Examples — the correct distinctions:

| Level | Example |
|---|---|
| **Topic** | Diastasis recti |
| **Niche** | Postpartum mothers with unresolved abdominal separation |
| **Situation** | Mother 6 weeks–6 months postpartum still looks pregnant, has back/core weakness, tried inappropriate DIY advice (sit-ups, YouTube workouts that made it worse), afraid of causing more damage |
| **Transformation** | Safely progress from uncertainty/weakness to functional core recovery with clear escalation points |
| **Product** | The structured system that delivers that transformation |

### Naming test — ask this about every title:
"If I remove the product title, can I describe the exact woman, exact situation, exact moment in her life, exact problem, what she already tried, why it failed, what she fears, and what she wants next?"

If NO → the product is not sufficiently scoped yet.

### ❌ vs ✅ examples:

❌ Diastasis/Core Recovery — describes a health topic, not a situation
❌ From Wrapper to Strong Core — better branding, still broad
✅ The Pregnant-Looking Postpartum Belly — for a mother 6 weeks–6 months pp, still looks pregnant, tried waiting/sit-ups/YouTube, worried she's making it worse, wants a safe structured way to rebuild and know when to get professional help

### One rule about the library:
The library CAN contain multiple products from the same broad domain — but each individual product must own a **distinct situation**. Two products cannot share the same situation nucleus.

---

**The test:** Is the underlying niche scoped to a specific person + timeframe + trigger + failed attempt + emotional stake? OR is it still a broad topic wearing a catchy name?

**The rule:** `Situation + catchy phrase` ✅ NOT `Topic + catchy phrase` ❌

A catchy name can **enhance** a strong niche. It can **never rescue** a broad one.

**Bad:** "Postpartum Wardrobe Reset" | **Good:** Nigerian mother, 3–9 months pp, aso-ebi event in 4–6 weeks, fitted lace won't sit right, tried buying a size down, dreading being photographed.

**Bad:** "Postpartum Pelvic Floor Guide" | **Good:** Nigerian mother, 6 weeks–12 months pp, leaks when she laughs/sneezes/carries baby, avoiding prayer/parties/exercise, never said the word out loud.

---

## POSTPARTUM LIBRARY — ALL 21 PRODUCTS (Validation Report + Naming Audit)

### NAMING AUDIT VERDICTS

| Product | Old Title | Verdict | New Title |
|---|---|---|---|
| V06 | Shared Nights, Not "Help": The African Couple's Night-Shift Contract | ✅ PASSES | Keep |
| V14 | Cord Care That Won't Land You in A&E | ✅ PASSES | Keep |
| V12 | Omugwo on Your Terms | ✅ PASSES | Keep |
| V16 | Your Village in a PDF: The First 7 Nights | ✅ PASSES | Keep |
| V19 | Beyond the Restroom: 30-Day Return-to-Work OS | ✅ PASSES | Keep |
| V08 | The Mama's Feeding Tray | ✅ PASSES | Keep |
| V13 | Crowdsource Your Omugwo | ✅ PASSES | Keep (FREE lead magnet) |
| V21 | The Village in a Binder | ✅ PASSES | Keep |
| V07 | I Love My Baby, Why Am I Empty? | ✅ PASSES | Keep |
| V05 | No-Village CS First-14-Days OS | ❌ FAILS | The No-Village C-Section: First 14 Days, Survival & Function |
| V03 | From Wrapper to Strong Core | ❌ FAILS | Still Look Pregnant at 6 Months? The No-Situps Core Recovery System |
| V02/V01 | From Wrapper to Wardrobe | ❌ FAILS | The Owambe Countdown: Fitting Your Aso-Ebi Again in 6 Weeks |
| V15 | Fed Is Best | ❌ FAILS (name taken — legal issue) | Breast, Bottle, Both: The Judgement-Free Feeding Plan for the Nigerian Mother Who Can't Do "Exclusive" |
| V17 | The New Parent Minimalist Setup | ❌ FAILS | What Does YOUR Baby Actually Need? A 2-Minute Profile (Income, Home, Help) → Your Real List |
| V18 | Baby + Older Children | ❌ FAILS | The No-Village Second Baby: Keeping Your Toddler Steady While You're Solo With a Newborn |
| V11 | Postpartum Couple OS | ❌ FAILS | We Became Roommates: A Postpartum Reconnection Ladder |
| V09 | Postpartum Household Management | ❌ FAILS | "I Do Everything": A Fair Night-and-Day Roster for the Postpartum Home |
| V04 | Postpartum Personal Care | REPACKAGE | Free magnet: hair-shedding chapter standalone |
| V10 | Money Post-Baby | REPACKAGE | Free magnet: Nigerian Newborn List / Paid module: Maternity-Leave Money Plan |
| V20 | New Parent OS (25-chapter mega-PDF) | REPACKAGE | Bundle wrapper/architecture — NOT a standalone product |

### VALIDATION SCORES & DECISIONS (all 21)

| # | Product | Score | Decision |
|---|---|---|---|
| V06 | Night-Shift Contract | 88 | PUBLISH AFTER REVISION — #1 priority |
| V14 | Cord Care / Newborn | 86 | PUBLISH AFTER REVISION — #2 |
| V03 | Diastasis Core | 86 | PUBLISH AFTER REVISION — #3 |
| V12 | Omugwo on Your Terms | 83 | PUBLISH AFTER REVISION — #4 |
| V05 | C-Section First-14-Days OS | 80 | PUBLISH AFTER REVISION — #5 |
| V19 | Return-to-Work OS | 79 | PUBLISH AFTER REVISION — #6 |
| V15 | Combo-Feeding | 75 | PUBLISH AFTER REVISION — bundle module |
| V07 | Mood Journal | 74 | PUBLISH AFTER REVISION — after crisis list built |
| V11 | Reconnection / Couple Connection | 74 | PUBLISH AFTER REVISION — inside Couple OS |
| V02 | Clothing/Dressing | 72 | PUBLISH AFTER REVISION — absorbs V01 |
| V09 | Household Roster | 71 | PUBLISH AFTER REVISION — inside Couple OS |
| V08 | One-Handed Nutrition | 67 | PUBLISH AFTER REVISION — entry price |
| V17 | Minimalist Setup | 67 | PUBLISH AFTER REVISION — profiler rebuild needed |
| V21 | Admin Binder | 68 | PUBLISH AFTER REVISION — fact-check heavy |
| V16 | Firsts Calendar | 69 | PUBLISH AFTER REVISION — antenatal funnel |
| V18 | Sibling/Second Birth | 60 | PUBLISH AFTER REVISION — narrower niche |
| V13 | Crowdsource Omugwo | 76 | FREE LEAD MAGNET |
| V04 | Personal Care | 63 | REPACKAGE → lead magnet |
| V10 | Money/Baby List | 69 | REPACKAGE → lead magnet + module |
| V01 | Body Capsule | 70 | REPACKAGE → module of V02 |
| V20 | Mega-OS | 57 | REPACKAGE → bundle architecture only |

### PORTFOLIO STRUCTURE

**Flagships (score ≥80):** V06, V14, V03, V12, V05, V19

**Bundles:**
- **Postpartum Couple OS** = V06 (Nights) + V09 (Household/Days) + V11 (Connection) — ₦19,800 / $29
- **Newborn OS** = V15 (Feeding) + V14 (Newborn) + V16 (Firsts)
- **Second-Birth Bundle** = V05 + V14 + V18

**Entry products:** V08 (₦4,900–₦6,900), V17 (₦4,900–₦6,900), V21 (₦9,800), V18 (₦6,900–₦7,500)

**Free lead magnets:** V13, V10-list, V04-hair, V17-list, V16-calendar sample

**Launch waves:**
- Phase 1 (wks 1–6): fact-check + safety pass → ship V06 + V14 + V03 + V12 + V13 + V10-list as lead magnets
- Phase 2 (wks 7–12): V05 + V19 + V02 + Couple OS bundle + V07 (after crisis list live)
- Phase 3: entry products + remaining modules + Second-Birth bundle + New Parent OS wrapper (₦19,800/$29)

### KEY VERIFICATION CORRECTIONS (facts to fix before launch)

- NIN enrolment is FREE (NIMC official) — delete any "$50–70 NIN fee" claim
- NPC birth registration free at centres; online self-service ₦5,000
- UK Child Benefit 2026/27 = £27.05/wk ≈ £1,406.60/yr (not £1,248)
- "60% of mothers leave the workforce" = CareerLife Global's own marketing claim, not independent study — attribute it
- "6 weeks @ 50% pay" is loose — legal floor is 12 weeks @ ≥50% (Nigeria Labour Act §54(1))
- Methylated spirit on cord is NOT universally harmful (Jos RCT: non-inferior to chlorhexidine) — real dangers are hot compress/herbal
- "Omugwo decreases for subsequent births" is NOT proven by PMC10993719 — remove claim
- "Fed Is Best" is a real published book (BenBella 2023) + IBCLC movement — rename V15
- Nigeria has NO 988 crisis line — placeholders are an ethical failure; must build real verified list
- Unverified stats (52.3%, "50% undiagnosed", 29.3% BMC) must be re-verified or cut

### SHARED ASSETS TO BUILD ONCE (used across multiple products)

1. **✅ BUILT — Verified Nigerian + diaspora crisis/escalation list** — `shared-crisis-escalation-list.md` — last verified 19 Aug 2026. Re-verify every 6 months. **The V06 launch dependency is now cleared.**
2. **Fact-check ledger** — one master list of every stat/claim with source + last-verified date + status
3. **Authority/credentials standard** — clinical-adjacent products (V03/V05/V07/V14/V15) publish reviewer credentials + disclaimer
4. **Script-card library** — consistent voice: V06/V09/V12/V15/V16/V19
5. **90-day roadmap** — new artifact, spine of V20 OS bundle

### CRISIS/ESCALATION LIST — KEY NUMBERS (from shared-crisis-escalation-list.md)

**Three-tier routing (every self-check in every product must end at one of these):**
- 🔴 EMERGENCY NOW — thoughts of harm, active danger, baby medical emergency
- 🟡 URGENT TODAY — persistent distress, intrusive thoughts, but no immediate danger
- 🟢 SUPPORTED THIS WEEK — struggling but functioning and safe

**Nigeria 🇳🇬**
- Emergency: **112** (toll-free, no airtime needed) or 199
- SURPIN (24/7 suicide/mental health): **+234 806 210 6493** / nigeriasuicideprevention.com
- MANI (24/7 free confidential): **0809 111 6264** or **0811 168 0686**
- DV (Federal toll-free): **0800 72 73 2255**
- Lagos DSVRT: **0800 033 3333**
- TAMAR SARC: **0909 133 3000** or **0909 277 7000**
- ⚠️ Nigeria has NO 988-style number — never imply one exists

**UK 🇬🇧** — Emergency: 999 | Samaritans (24/7): **116 123** | DV: **0808 2000 247**
**US 🇺🇸** — Emergency: 911 | Crisis: **988** | Text HOME to 741741 | PSI: 1-800-944-4773 (NOT a crisis line — 🟢/🟡 only)
**Canada 🇨🇦** — Emergency: 911 | Crisis: **988** | Regional: 211

**Rules:** Never write "call your local crisis line" — give the actual number. Never let a screen output a self-diagnosis. PSI never used for 🔴 situations.

**Products using this list:** V06, V07, V11, V05, V14, V15 — link to shared file, do not fork separate copies.

### SAFETY RULES (non-negotiable across all products)

- No "cure/heal in N days" framing — V03/V05
- Formula: never diluted, never endorsed for dilution
- Alcohol-based galactagogues (palm wine/beer): explicit warning always
- Safe sleep: African co-sleeping handled with ISPID-style risk minimisation, NOT Western "never co-sleep" absolutism
- Mental-health products are screens + routers, NEVER diagnoses
- No fabricated testimonials — composites must be labelled
- Escalation/red-flag cards required for all clinical products

### COMPETITION REALITY (verified — NOT "no competitor")

Key Nigerian competitors found: **Omugwo Academy** (Selar — doctor-led series), **Omugwo Complete Guide** ($4.79), **Shuga Babys World** ($10 handbook), **MomcircleNG**, **Dr. Sandra Uzodimma** ($14.01), **Sisi Yemmie** "Eating for More" (₦7,000), **5StarMums** (free), **Edge Naturale** (free Afro-hair), plus free Western giants.

**Differentiation must be: mechanism + cultural coding + safety rigor — NEVER market emptiness.**

### V06 — FULLY BUILT PRODUCT (Template for all others)

**Full title (SUPERSEDED):** Shared Nights, Not "Help": The African Couple's Night-Shift Contract
**Full title (LOCKED v6.2):** Every Night, Just Me
**Subtitle (LOCKED v6.2):** A postpartum night-coordination system that replaces nightly arguing with a pre-agreed roster, a fairness ledger, and the exact words to make it stick.
**One-line promise:** A written, fair night-shift system both adults follow — so she gets a protected sleep opportunity, and nobody has to ask.

### TITLE ARCHITECTURE (locked 2026-08-19)
Every Swiipt product has three layers — title carries the situation, subtitle explains the system, one-line promise states the responsible outcome:
- **TITLE** → emotionally/situationally recognizable (buyer's language, specific moment, immediate "this is for me" recognition)
- **SUBTITLE** → explains the transformation/system
- **ONE-LINE PROMISE** → states the outcome we can responsibly promise
Do NOT make the title carry the product explanation. That is the subtitle's job.

### NAMING PRINCIPLE (locked — applies to all products)
Name the buyer's specific situation/problem in the language she recognizes, with enough specificity that she immediately understands "this is for me," while leaving the transformation mechanism to the product itself.
Rule: `Situation + catchy phrase` ✅ NOT `Topic + catchy phrase` ❌
Test: "Who's On Tonight?" — immediately places the buyer inside the 3 A.M. moment, names the actual problem (nobody knows whose responsibility it is), buyer-voice, searchable, no medical promise, broad enough for all three rosters.

**01 Identity:** New mother 0–12 weeks, doing 100% of nights, partner sleeps through | Situation: no agreed system, every night renegotiated by exhaustion | Desired: written fair night system, 4–5 hr uninterrupted block, no nightly argument

**02 Before:** 100% nights every night, hallucinating from exhaustion, asked for "help" got one-off gesture, resentment building in silence, partner doesn't know what help looks like

**03 After:** Written contract both follow, genuine 4–5 hr block, partner has named non-optional shift, weekly 5-min renegotiation ritual replaces nightly arguments

**04 Mechanism:**
1. Written roster removes emotional labour of asking (converts negotiation → pre-agreed default)
2. Reframes partner from "helper" → "co-manager" (status upgrade, not charity request)
3. Solves breastfeeding math honestly (milk hand-off scheduled so block is real)
4. Sleep banker (weekend catch-up credit) makes invisible exhaustion visible and tradeable
5. Pre-negotiates resistant partner's objections with ready scripts

**05 Sequence:** Diagnose (Day 1) → Choose Model (Day 2) → Draft Contract (Day 3) → Negotiate (Days 4–5) → Run It (Days 6–12) → Review (Day 13) → Reinforce (Days 14+)

**Three contract templates:** A = breastfeeding-compatible split shift | B = formula/expressed true alternating | C = single-parent/no-partner modified

**06 Asset Map:** READ: "The Argument That Ends the War" | DECIDE: decision tree (3 branches) | DO: 3 fillable contract templates | PRINT: shift chart (fridge/wall) | COMMUNICATE: 6 script cards | TRACK: 14-day uninterrupted-hours tracker | RESCUE: bad-night protocol card | RESTART: re-entry protocol | SAFETY: PPD-vs-exhaustion self-check → crisis list

**07 Failure-Point Map:**
- Normal night → log it
- Bad night (sick/teething) → Bad Night Protocol card, next-night compensation
- Missed shift → no-blame reset script, adjust alarm/handoff method
- Resistance → scripted response bank, "trial it one week" framing
- Overwhelm → simplify to minimum: one non-negotiable block only
- Relapse → re-entry protocol, no guilt, restart from Day 1 of run phase
- Escalation → route to crisis/escalation list, product does not attempt to handle

**08 First Win:** Within 15 minutes — "Tonight's Shift Chart": pick template A/B/C, write 2 clock times, text partner one pre-written line from script bank. By tonight there is a named written shift.

**09 TSM:**
- Before baseline: nights/week with zero 3hr+ block; exhaustion 1–10; resentment 1–10; "whose turn" arguments >3x/week
- Success at Day 30: uninterrupted ≥3hr on ≥5/7 nights; exhaustion -3pts; resentment -3pts; arguments ≤1x/week; partner initiates shift without reminder 4/7 nights
- Check-ins: Day 7, Day 14, Day 30
- Threshold: 60%+ completers meet criteria

**10 Re-entry/Maintenance:** Renegotiate every 2 weeks as baby sleep changes | Relapse: restart at Day 4 (not Day 1) | Next-level: sleep-training-compatible shifts as baby grows

**11 Next Transformations:** V09 (Household roster — daytime counterpart) → V11 (Reconnection — once sleep stabilises) → V19 (Return-to-Work — if leave ending)

**Quality Gate:** All 15 criteria ✅ EXCEPT N (evidence labelling — Nigerian cultural-norm claims need citation or MODEL INFERENCE label)

**Open dependency before publish:** Shared Nigeria + diaspora crisis/escalation list must exist for the PPD safety gate to route somewhere real. This is a shared asset — build once for V06/V07/V11.

---

## CONTENT DRIFT CORRECTIONS (critical — prevents re-absorption errors)

These errors were caught by comparing specs to the approved product2.md definitions. Drift = a spec quietly redefining its situation while keeping the original title. Same failure mode as the naming principle, one layer deeper.

### PP-01 — drift detected and corrected (v6.1 → v6.2)
v6.1 error: Doors A2/B4/C5 silently redefined — A2 became emotional volatility (V07's territory), B4 became general overwhelm (V06/V09/V16), C5 became relationship strain (V11's territory).
v6.2 correction: All 4 doors reverted to PHYSICAL RECOVERY ONLY:
- A1 = scar/shelf | A2 = diastasis/coning | B4 = movement fear | C5 = recovery-timeline anger
Added: explicit "What this product does NOT cover" section naming V07/V11 by number.
Strategic note: PP-01 consolidates V03 (diastasis, score 86) + V05 (C-section, score 80) — confirm this consolidation is what's wanted. If buyer-language shows they're two separate conversations, split back.
Launch blocker: Physiotherapist review required before Gate N clears.

### PP-02B — name/content theft detected and corrected (v6.1 → v6.2)
v6.1 error: "3-Week Notice" had been redefined as return-to-work/routine-reset — duplicating V19 (Return-to-Work OS, score 79) under a stolen name at lower fidelity.
v6.2 correction: Reverted to product2.md's actual definition — event dressing (Aso-Ebi/owambe/naming ceremony outfit fix) for a PP-02 buyer with a specific event in 3–6 weeks.
V19 keeps return-to-work. They are not the same situation.
Distribution: Order-bump on PP-02 checkout ONLY. NOT a standalone catalog product.
Engine mapping: life_area m01 wardrobe sub-theme — do NOT link to V19's work/admin triggers.

### PP-02 — movement/scar-care leak (flagged, NOT yet corrected)
Error: M3 Recover = "gentle, clearance-approved movement + scar care" — rehab content that belongs to PP-01/V03/V05, not a wardrobe product.
Fix needed in specs\PP-02.md: strip M3 out. Wardrobe product references recovery progress but does not deliver recovery content.

### PP-03 — B1-C door lost (flagged, NOT yet corrected)
Error: specs\PP-03.md has B1-C defined as "I can't get to the toilet in time" (generic urgency).
Correct definition: "prayer/purity leakage" — strategically important for mosque women's groups and high-trust community distribution. Restore this door.
Fix needed in specs\PP-03.md: restore B1-C to prayer/purity leakage.

---

## SPECS FOLDER — STATUS SUMMARY

Location: C:\Users\User\Desktop\transformation products\specs\
All 5 files read 2026-08-19.

| File | Version | Status | Key issue |
|---|---|---|---|
| specs\PP-01.md | v6.2 | ✅ FIXED | Correct doors physical-recovery only |
| specs\PP-02.md | v6.1 | ✅ FIXED | M3 Recover stripped; TSM updated; rehab note added routing to PP-01 |
| specs\PP-02B.md | v6.2 | ✅ FIXED | Event-dressing upsell; return-to-work is V19 |
| specs\PP-03.md | v6.1 | ✅ FIXED | B1-C restored to prayer/purity leakage with community-distribution note |
| specs\SPECS-REPORT.md | — | ACCURATE | Engineering blueprint; 5 open workstreams |

AUTHORITATIVE spec files:
- PP-01: specs\PP-01.md (v6.2)
- PP-02: specs\PP-02.md (v6.1)
- PP-02B: specs\PP-02B.md (v6.2)
- PP-03: specs\PP-03.md (v6.1)

### Products already live on swiipt.com (Phase 6.5 — placeholder content)
PP-01 Is This Normal? → Woo #71 / System #70 / Transformation #69
PP-02 New-Body Closet → Woo #74 / System #73 / Transformation #72
PP-02B 3-Week Notice → Woo #77 / System #76 / Transformation #75
PP-03 Quiet Leak → Woo #80 / System #79 / Transformation #78
Purchase→access link verified. Gate N (evidence label) blocks all four. Only owner clears it.

### 5 open workstreams (owner must supply — from SPECS-REPORT.md)
1. Evidence label wording per product (blocks Gate N for all 4)
2. Safety/clinical copy — PP-03 first (pelvic-floor claims, red-flag list), PP-01 second (triage card thresholds)
3. Actual asset content (§06 of each spec) — words inside each product; engine converts to formats automatically
4. TSM success criteria + check-in days (§09 of each spec)
5. Real per-currency prices (PP-01/02/03: $29/₦45,000/€27/GH₵450; PP-02B: $19/₦29,000/€18/GH₵290)

### Build/content order
1. PP-01 first (flagship, simplest safety story, unlocks library trip-check)
2. PP-02 second (with M3 stripped first)
3. PP-02B third (small upsell — fast after PP-02 patterns exist)
4. PP-03 last (heaviest clinical/safety review load)

### PP-03 design note
Deliberately functional-first — plain PDF/html, NOT a flipbook. A beautiful magazine about bladder leaks is the wrong tone. Distribution: WhatsApp/community warm-channel ONLY (not Meta cold ads).

---

## FULL SITUATION MAP — ALL 26 MICRO-MARKETS (product2.md)

26 distinct situations total (coded A1–D4). 11 have a build spec. 15 have a defined destination but no build yet. Nothing is "maybe someday" — each has a specific reason for its sequencing.

### Building now — 4 specs, 11 situations

| Spec | Situations owned | Status |
|---|---|---|
| PP-01 Is This Normal? | A1 (scar/shelf), A2 (diastasis/coning), B4 (movement fear), C5 (timeline anger) | v6.2 corrected — 4 doors, one physical-recovery situation |
| PP-02 New-Body Closet | D1 (everyday wardrobe), D3 (return-to-work wardrobe — folded into D1 as a variant, not separate) | ✅ FIXED — M3 Recover stripped |
| PP-02B The 3-Week Notice | D2 (event dressing) | v6.2 corrected — upsell to PP-02 only |
| PP-03 Quiet Leak | B1-A (laugh-leak), B1-B (exercise avoidance), B1-C (prayer/purity), B1-D (uncertainty/shame) | ✅ FIXED — B1-C restored to prayer/purity |

### Not yet built — 15 situations, each with an assigned role

| Role | Situations | Count |
|---|---|---|
| Future standalone products — sequenced later, each independently strong | A3 (apron belly/loose skin), A5 (breasts after weaning), B5 (carrying back pain), B7 (perineal/intimacy pain), B2 (prolapse — needs clinical-trust infrastructure first) | 5 |
| Modules — attach to whichever product a buyer already owns, not standalone | A6 (stretch marks/intimacy), C2 (social comparison), C3 (partner-attraction fear), C6 (multi-birth grief) | 4 |
| Lead magnets / acquisition content — pulls buyers toward PP-01/PP-02 | C1 (photo avoidance), D4 (old jeans ritual) | 2 |
| Bonus/nurture content — email/WhatsApp sequence, not standalone | A4 (evening bloat), B8 (bowel/haemorrhoids), B10 (exhaustion) | 3 |
| Resolved as folded-in — not a distinct situation; rides A2/B5 messaging | B9 (can't lift toddler) | 1 |

**Total: 26 situations. 11 built. 15 assigned but unbuilt.**

### IMPORTANT correction to product2.md's framing
product2.md says the 5 future standalone products should be "revisited once Product 1 and 2 generate real customer data." That is launch-and-see language — an MVP-trap framing. The correct version: revisit once scored against the Discovery Engine's 11-field matrix, same as the other 21 products were scored. This does NOT require waiting for sales data. product2.md line updated to reflect this.

---

## V06 PUBLICATION GATE STATUS (as of 2026-08-19)

**Status: 🟢 APPROVED — All 10 pre-publication issues resolved**

### V06 File Locations
| File | Path | Status |
|---|---|---|
| Spec sheet | `specs/V06/V6-spec.md` | ✅ v6.2 final |
| Deliverables | `specs/V06/V06-deliverables.md` | ✅ v6.2 final |
| Fix notes | `specs/V06/V06-fix.md` | Source doc (read-only) |

### V06 Intervention Kit — Asset Status
| Part | Asset | Status |
|---|---|---|
| 1 | Start Here — 10-Step Roadmap | ✅ |
| 2 | "The Argument That Ends the War" (short read) | ✅ |
| 3 | Situation Finder (3-question self-triage quiz) | ✅ |
| 4 | Decision Tree (ASCII routing diagram) | ✅ |
| 5 | Roster Safety & Boundary Rules | ✅ |
| 6 | Three Roster Templates (A/B/C) | ✅ |
| 7 | Sleep Banker / Recovery Bank Mechanics | ✅ |
| 8 | Seven Script Cards (incl. Script 7 Omugwo/family) | ✅ |
| 9 | Fridge Shift Chart (printable ASCII) | ✅ |
| 10 | 14-Day Shift Tracker (system metrics) | ✅ |
| 11 | Rescue Card (Bad Night Protocol) | ✅ |
| 12 | Re-entry Protocol | ✅ |
| 13 | Safety Gate — "When Exhaustion Needs More Than a Night Plan" | ✅ |

### V06 Key Safety Decisions — LOCKED
- ❌ No hardcoded infant crying thresholds (no "20–30 min", no "45 min")
- ❌ No side-lying position recommendations
- ❌ No earplugs for the active shift responder
- ❌ No self-diagnosis of PPD or any clinical condition
- ❌ No absolute sleep promise ("guaranteed 4–5 hour block")
- ✅ Product coordinates adults only — infant care defers to pediatric/clinical guidance

### V06 Remaining Publication Steps (Owner)
1. Safety/clinical review (Gate O confirmation)
2. Evidence label wording (Gate N — clears ⚠️ pending on Nigerian cultural-norm claims)
3. Internal consistency check (full read-through)
4. Render in final delivery format (WordPress ingestion)
5. Customer journey test (real purchase → access → complete flow)
6. Publish

---

## PUBLICATION GATE FRAMEWORK

The Swiipt publication gate (owner-defined, 2026-08-19):

> **Specified → Drafted → Clinically/safety reviewed where necessary → Internally consistency-checked → Rendered in its final delivery format → Tested as a complete customer journey → Publication-ready**

All V06 assets are at: **Drafted** (awaiting owner's safety review and render steps).

---

## PENDING TASKS (as of 2026-08-19)

Completed in last session:
- ✅ DONE — Strip M3 Recover from specs\PP-02.md
- ✅ DONE — Restore B1-C to prayer/purity leakage in specs\PP-03.md
- ✅ DONE — Confirm PP-01 consolidation of V03+V05 (formally recorded in PP-01 spec, registry, and memory)
- ✅ DONE — Draft spec sheet for **V22** (R07 / "The First Time He Sees My Body Again") in specs/V22.md
- ✅ DONE — Build V06 customer-facing deliverables (13 modular parts) in specs/V06/V06-deliverables.md
- ✅ DONE — Calibrate Gate N (Evidence Labels) and Gate O (Clinical Reviewers) for top flagships (PP-01, PP-02, PP-03, PP-02B, V22)
- ✅ DONE — Move PP-01-corrected.md → specs/PP-01.md (v6.2, overwrote old version)
- ✅ DONE — Move PP-02B-corrected.md → specs/PP-02B.md (v6.2, overwrote old version)
- ✅ DONE — Resolve all 10 V06-fix.md pre-publication issues (V6-spec.md + V06-deliverables.md)
- ✅ DONE — Remove all hardcoded infant crying thresholds from V06-deliverables.md
- ✅ DONE — Add Situation Finder (architectural upgrade: routes buyer to correct roster)
- ✅ DONE — Build all 13 standalone V06 module files (V06-part01 through V06-part13) in specs/V06/
- ✅ DONE — Lock V06 title: "Every Night, Just Me" / Subtitle: "A postpartum night-coordination system that replaces nightly arguing with a pre-agreed roster, a fairness ledger, and the exact words to make it stick."
- ✅ DONE — Title and naming architecture written to MEMORY.md and V6-spec.md

Owner decisions needed (final pre-publish steps):
- [x] Prices — placeholders confirmed as live prices (2026-08-19)
- [x] Evidence labels (Gate N) — locked and written to all 5 spec files (2026-08-19)
- [ ] **PP-01 Gate O (OPEN):** Clinical red flags for triage card (red/amber/green) must come from authoritative postpartum literature — bleeding timelines, fever thresholds, mood red-flags. Product translates sourced evidence into escalation language. Do NOT invent thresholds from memory.
- [ ] **PP-03 Gate O (OPEN — HIGHEST PRIORITY):** Pelvic-floor red-flag list (blood, pain, fever, worsening, no improvement by X weeks) must come from authoritative pelvic-health sources. Product translates into "stop and see a pelvic-health physiotherapist if X." Do NOT invent thresholds from memory.
- [ ] V06: Safety/clinical review (Gate O owner confirmation)
- [ ] V06: Render in final delivery format and test customer journey
- [ ] All products: Supply final page-level copy (READ/DO/DECIDE/TRACK/RECOVER assets)

**PRODUCTION RULE (locked 2026-08-19):**
Owner decides the promise and product boundary. Evidence decides clinical facts and safety thresholds. The product engine translates both into the customer transformation experience.
Gate sequence: Evidence label → Source-backed safety boundaries → Product content → Transformation QA → Publication.

---

## HOW TO USE THIS FILE

At the start of any new session, read this file first:
`C:\Users\User\Desktop\Transformation\Product Pipeline\MEMORY.md`

**Product Factory (built 2026-08-24):** schemas/ · standards/ · agents/ · data/ record store
(git ledger) · harness/ (research workflow + validators). Canonical contracts:
`Swiipt_Transformation_Product_Factory_Standard_v1.md`. Backfilled records live in
`data/opportunities/` + `data/products/`; live WP ids cross-referenced. Publisher bridge is live
on swiipt.com (`swiipt-core/includes/publisher.php`, contract in `harness/publisher-contract.md`).

Key files:
- `POSTPARTUM-BUILD-REGISTRY.md` — master postpartum build registry & consolidation map
- `master Architecture.md` — full 9-layer architecture (V1–V4)
- `Product creation guideline.md` — SWIIPT product creation standard + template
- `implementation-plan-wordpress-v2.0.md` — WordPress build plan, all 12 phases
- `product2.md` — Postpartum product library (current focus)
- `Postpartum Library Validation Report.md` — 21-product validation scores + corrections
- `shared-crisis-escalation-list.md` — Nigeria + diaspora crisis numbers (re-verify every 6 months)
- `specs\PP-01.md` (v6.2) — AUTHORITATIVE PP-01 spec (corrected doors)
- `specs\PP-02.md` (v6.1) — AUTHORITATIVE PP-02 spec (M3 stripped)
- `specs\PP-02B.md` (v6.2) — AUTHORITATIVE PP-02B spec (corrected event-dressing)
- `specs\PP-03.md` (v6.1) — AUTHORITATIVE PP-03 spec (B1-C restored)
- `specs\SPECS-REPORT.md` — engineering blueprint + 5 owner workstreams
- `MEMORY.md` — this file

---

## GLOBAL DESIGN + PRODUCTION INHERITANCE CLOSURE (2026-09-22)

**Task:** `Task/task.md` (SWIIPT GLOBAL DESIGN + PRODUCT + MARKETING + ORGANIC MEDIA PRODUCTION
INHERITANCE CLOSURE) · **Report:** `Task/TASK-SWIIPT-GLOBAL-DESIGN-PRODUCTION-INHERITANCE-CLOSURE-REPORT.md` ·
**Commit:** `cbd7e30` (no tag; see below) · **Providers 0 · $0.**

Authority recovery + ingest complete (brand quick-reference + marketing visual system, recovered by
2 independent methods + rendered-page inspection; 12-token palette, Transformation Mark, typography
roles, callout semantics, 2 visual modes, grounding element, intensity mapping, 6 components,
platform constraints, favicon/app-icon). Canonical machine-readable projection:
`mae/harness/design-authority.mjs` (reads `mae/data/brand-truth.json` + `asset design/style.css` +
`asset design/swiipt-brand-assets/`; NOT a second brand system).

**Compositor (Task 30 minimal corrections, A-F + photography preserved):** official Transformation
Mark/lockup replaces the CSS square; palette resolved from the authority (12 tokens incl. blush;
off-sheet greys removed); semantic typography (hook = Inter Black 800, editorial = DM Serif Regular,
verbatim = DM Serif Italic only); Grounding Element Rule (`data-swt-grounding`); new generic
`marketing-components.mjs` (the 6 components incl. OG Share Image). Missing fonts added:
`mae/assets/fonts/Inter-Black.ttf` + `DMSerifDisplay-Italic.ttf` + `Inter-Italic.ttf`.

**Generalized:** `mae/harness/organic-media.mjs` (platform contracts + thumbnail/Pin renderers +
truthful video status; the V06 driver now delegates) · `mae/harness/export-final-campaign.mjs`
validation/README/inventory now ledger+`_packages.json`-derived (V06 validate 237/237).

**New QA:** `brand-continuity-qa.mjs` (static + real-browser safe-zone/text-size/contrast),
`zero-v06-audit.mjs`, `design-inheritance-fixture.mjs` + `design-inheritance.test.mjs`,
`family-money-structural-dryrun.mjs`, `standards/product-production-inheritance-standard.md`.

**Regression:** factory harness 342/342 · qa-checks 127/127 · validate-opportunity 603/603 ·
compositor 27/27 · social 448/448 · design-inheritance 19/19 · v06-visual-regression PASS (64) ·
metadata audit PASS (65) · consumer-copy audit PASS (118) · zero-V06 audit PASS (0 illegitimate,
0 product-id branches) · design-authority compliance 23/23 · synthetic non-V06 fixture PASS
(11 renders, 0 provider calls).

**Family Money structural dry run: NOT_READY** - `asset_map` empty (artifact architecture not
authored), no approved Marketing Angle Record, no per-currency price. Per Task 80 the success block
was NOT printed and the Task 81 `swiipt-engine-v1-global-design-production-inheritance-ready` tag was
withheld. Next: owner + architecture review of the report; then supply the 3 inputs and run
`PPL-FAMILY-MONEY-001` as the first real new-product production test (Task 82).

**Dependency note:** `design-authority.mjs` resolves the official mark/lockups/favicon/app-icon at
runtime from the owner-supplied kit `asset design/swiipt-brand-assets/` (untracked). Commit it, or
ensure it is present, before running the factory in a fresh checkout.
