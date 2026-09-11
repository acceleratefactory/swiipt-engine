# WRITING / GENERATION STANDARD
*Factory standards file · derived from `Swiipt_Writing_Generation_Control_Layer_v1.md` (the authoritative execution spec) · structured config in `config/writing-control.v1.json` (schema `schemas/writing-control.schema.json`) · product voice overrides live in `product.json` `generation.voice`. Governs HOW generation executes an already-approved contract. It does NOT replace Acceptance Tests or Publishing Gates.*

## 0 · Position

The Writing / Generation Control Layer is an **execution layer inside the existing factory**, between approved product architecture and generation:

```
APPROVED PRODUCT → TRANSFORMATION SPEC → PRODUCT SCHEMA → PRODUCT ARCHITECTURE
→ WRITING / GENERATION CONTROL → GENERATION → GENERATOR SELF-CHECK
→ TRANSFORMATION QA → ACCEPTANCE TESTS → PUBLISHING GATES
```

It controls generation. **Acceptance Tests remain the authoritative quality gate; Publishing Gates remain the authoritative publishing gate.** Writing Control must never become a second acceptance framework.

## 1 · Contract-driven generation

The generator must never receive only *"write a product about X."* It receives a structured generation context: Transformation Specification, Product Schema, approved research/knowledge, product architecture, required assets, evidence requirements, safety requirements, delivery formats, the Writing Constitution, the product-specific voice spec, and the anti-AI rules. It **executes** these inputs rather than inventing missing decisions.

## 2 · Source-of-truth hierarchy

1. Transformation Specification (WHO/SITUATION/BEFORE/AFTER/MECHANISM/PATH/FAILURE/FIRST WIN/TSM/MAINTENANCE/NEXT)
2. Product Schema
3. Approved Research / Knowledge
4. Product Architecture
5. Writing / Generation Control Layer (behaviour, voice, structure, anti-AI)
6. General model knowledge — subordinate; never used to silently change the transformation, add unsupported claims, or resolve missing high-consequence information by guessing.

## 3 · The Swiipt Writing Constitution

Swiipt writing is intelligent, practical, specific, direct, warm without being sentimental, emotionally aware without being theatrical, calm, useful immediately, honest about constraints, action-oriented, transformation-led. The customer should feel *"this understands the situation I am actually in"* — never *"this sounds like AI writing an ebook."*

### NEVER (behaviours)
No fake empathy, motivational filler, generic inspirational statements, excessive emotional language, corporate language, textbook explanations where practical ones work, repetitive summaries, repetitive encouragement, unnecessary conclusions, excessive headings, excessive bullet lists, forced humour, artificial urgency, rhetorical-question overload, repetitive sentence structures, filler transitions, or writing primarily to increase word count.

### NEVER (phrases — verbatim list)
`In today's fast-paced world` · `Embark on a journey` · `It's important to remember` · `Whether you're a busy` · `Let's dive in` · `Unlock your potential` · `Take control of your` · `Transform your life` · `Empower yourself` · `At the end of the day` · `Here's the thing` · `Imagine a world where` · `The good news is` · `You've got this` · `It all starts with` · `This comprehensive guide` · `This ultimate guide` · `By following these steps` · `In conclusion`.
Exception: a phrase may appear only when genuinely necessary inside quoted customer language or source material.

### ALWAYS
Write to the actual situation; use concrete circumstances; use the customer's language where research supports it; explain why when it changes behaviour; tell the customer what to do next; acknowledge real constraints; distinguish facts from interpretation; make decisions easier; give realistic examples; vary sentence rhythm and length; remove anything that does not serve the transformation; keep writing proportional to attention; preserve the approved scope.

## 4 · Concrete before abstract

Prefer *"You finally sit down to eat and the baby starts crying"* over *"New parenthood can make maintaining healthy routines difficult."* Recognition comes from specific situations, not demographic description.

## 5 · Locks

- **Customer-Situation Lock** — before each major module, the module must answer WHO / WHAT situation / WHAT change / WHY difficult / WHAT constraint / WHAT is at stake / WHAT mechanism / WHAT the module helps them do. If it cannot, rewrite, remove, or flag for architectural review.
- **Transformation Lock** — every major section must contribute BEFORE → MECHANISM → ACTION → EVIDENCE OF CHANGE → AFTER. Interest, education, authority or length do not earn a place.
- **Scope-Drift Protection** — never silently turn one transformation into another. A wardrobe product may mention recovery but must not become a weight-loss programme, etc. On drift: `SCOPE_DRIFT` → **UPSTREAM PRODUCT DECISION REQUIRED**.

## 6 · Architecture before prose

Produce an internal architecture first (transformation → modules → sections → customer jobs → actions → implementation assets → failure points → rescue protocols → TSM/evidence). Only then write prose. Enforce `transformation → mechanism → action → evidence → customer experience`, never `topic → headings → paragraphs → PDF`.

## 7 · Every module has a job; action over information

Each module must have an explicit job (understand / decide / act / establish routine / communicate / track / recover / maintain / measure / prepare next). The model must be able to say *"this module exists because…".* Map customer jobs to the right experience — READ / DO / DECIDE / TRACK / CALCULATE / COMMUNICATE / RESCUE / RE-ENTER / MAINTAIN / REMEMBER — and never create a checklist/worksheet/tracker merely because the factory can.

## 8 · First win, failure, rescue, examples

- **First win** — identify the earliest realistic, relevant, achievable win connected to the mechanism; do not manufacture dramatic results.
- **Failure-point writing** — assume bad days (no time, low energy, forgotten step, resistance, interference, missed day, relapse); a plan that only works on the best day is incomplete.
- **Rescue protocol** — WHEN X → DO Y → AVOID Z → CHECK THIS → RETURN TO THE SYSTEM HERE. Short, specific, actionable. Never replace a rescue with motivational prose.
- **Examples** — demonstrate actual decisions/behaviours, realistic and specific, clearly examples not universal rules.

## 9 · Voice

The Constitution is global. Each product may add a **product-specific voice specification** (`product.json` → `generation.voice`; allowed keys: formality, warmth, directness, technical_depth, emotional_intensity, sentence_length, cultural_context, humour, terminology, reading_level, first_second_person). Product voice may vary expression; it may **not** violate the global Constitution.

## 10 · Medical / safety / high-consequence writing

Preserve approved evidence; distinguish education from diagnosis/treatment; preserve uncertainty; avoid unsupported certainty, invented professional authority/statistics/citations; preserve approved thresholds and escalation instructions; flag unresolved safety questions. Never make a product sound more authoritative than the evidence permits.

## 11 · Evidence preservation

For evidence-dependent claims preserve CLAIM / SOURCE / EVIDENCE STRENGTH / CONTEXT / LIMITATION. Never turn correlation into causation, possibility into certainty, a narrow finding into a universal rule; never fabricate citations, invent consensus, or strengthen a claim for sales.

## 12 · Anti-hallucination

If required information is missing: **DO NOT GUESS.** Use `FLAG`, `SOURCE_REQUIRED`, `PLACEHOLDER`, or `HUMAN_REVIEW`. Never invent testimonials, customer stories, statistics, studies, experts, clinical recommendations, benefits, results, quotes, citations or guarantees.

## 13 · Structure controls

- **Repetition** — remove repeated explanations/advice/conclusions/emotions/examples/synonymous paragraphs/recaps; a concept is explained once then used (repetition allowed only for safety, navigation, reference).
- **Headings** — every heading describes a real job or useful information; never create headings to look structured.
- **Bullets** — bullets for scanning/reference/warnings/options/checklists/criteria; prose for reasoning/nuance/context/explanation/sequence; never turn every paragraph into bullets.
- **Density** — optimise for usefulness per unit of attention, not page count; no arbitrary length target unless the Product Schema requires it.

## 14 · Multi-format consistency & interactive content

The same transformation may be delivered as Magazine / Read / PDF / Image / Read-Aloud / Interactive: the **same transformation, mechanism, instructions and safety boundaries** are preserved across formats — expression may change, the transformation does not. Do not create six different products. Interactive logic is structured (not buried in prose): decision tree (`TRIGGER/QUESTION/OPTIONS/NEXT STATE/ACTION/SAFETY ESCALATION/COMPLETION`), checklist (`ITEM/PURPOSE/STATE/COMPLETION`), tracker (`METRIC/BASELINE/ENTRY/FREQUENCY/TARGET/INTERPRETATION/NEXT ACTION`), script card (`SITUATION/WHO/GOAL/SCRIPT/IF THEY PUSH BACK/NEXT ACTION`). Fields remain governed by the existing Interactive Engine + Product Schema.

## 15 · Controlled generation passes

`1` Contract ingestion → `2` Architecture check → `3` Content generation → `4` Implementation-asset generation → `5` Voice pass → `6` Anti-AI pass → `7` Transformation QA handoff. Implement following the existing architecture rather than blindly building seven systems.

## 16 · Severity & statuses

**Blockers:** `NEVER` · `SCOPE_DRIFT` · `UNSUPPORTED` · `SAFETY_ISSUE`.
**Warnings (style → targeted revision):** density, heading/bullet excess, repetition, filler, `WRITING_QUALITY_ISSUE`.

Generation statuses: `MISSING` · `FLAG` · `SOURCE_REQUIRED` · `HUMAN_REVIEW` · `SCOPE_DRIFT` · `UPSTREAM_CONTRACT_CHANGE_REQUIRED`.
Critic statuses: `PASS` · `FAIL` · `WARNING` · `MISSING` · `UNSUPPORTED` · `SCOPE_DRIFT` · `TRANSFORMATION_WEAKNESS` · `WRITING_QUALITY_ISSUE` · `SAFETY_ISSUE`.
If the LLM critic did not run, record `NOT_RUN` — **never a fake PASS.** Under strict publication mode, a required critic that is unavailable → `HUMAN_REVIEW`.

## 17 · Generator / Critic separation & change control

Where infrastructure permits, the Generator creates/revises; the Critic (independent) tries to break it; the generator then performs **targeted revision** (revise only the failed component; preserve approved material). A writing revision must never silently change customer, situation, before-state, desired state, mechanism, TSM, product role, evidence position or safety boundary — if a change would, flag `UPSTREAM_CONTRACT_CHANGE_REQUIRED`.

## 18 · Completion, next transformation, stop conditions

Completion connects to the actual transformation (what changed → what remains → how to maintain → what to do when it breaks → what may come next), never just "congratulations, you finished." Next-transformation handoff is grounded in current state + remaining gap + likely next situation — never a random upsell. **Stop and flag** when: Transformation Spec missing; Product Schema missing; approved situation ambiguous; required evidence missing; safety-sensitive information unresolved; scope conflicts with the approved transformation; required assets cannot be reliably represented; TSM cannot be represented; source material conflicts; the model would have to invent material information. Never "make something reasonable" to force completion.

## 19 · Generation manifest & versioning

Each generated product records: `product_id, transformation_id, product_schema_version, writing_control_version, research_version, architecture_version, voice_spec_version, generator_model, generation_timestamp, revision_number, qa_status, evidence_status, safety_status, publish_status` (`copy/generation-manifest.json`; `writing_control_version` also on `product.json → generation.writing_control_version` and in the publish manifest). The layer is versioned independently (`writing-control-v1.0`); products record the version used. Changing writing rules must never silently rewrite published products.

## 20 · What this layer does NOT do

It does not select research, validate the market, decide which research becomes a product, redefine the transformation, replace the Product Schema / Design System / Acceptance Tests / Publishing Gates, approve its own output, or bypass required human review.
