# SWIIPT --- Writing / Generation Control Layer

## Product Factory Execution Standard

### Version 1.0

------------------------------------------------------------------------

## 0. PURPOSE

This document defines the **Writing / Generation Control Layer** inside
the existing Swiipt Transformation Product Factory.

It does **not** replace or rewrite the existing:

-   Transformation Specification
-   Product Schema
-   Design System
-   Acceptance Tests
-   Publishing Gates
-   Swiipt Transformation Product Factory Standard V1

Those remain the authoritative factory systems.

This layer answers one specific question:

> **Once a transformation and product have been approved, how must the
> LLM execute the product specification so the resulting product is
> genuinely useful, transformation-led, evidence-responsible,
> human-sounding and unmistakably Swiipt?**

The LLM is the **production executor**.

It is not the strategist, transformation validator, evidence authority
or publishing authority.

------------------------------------------------------------------------

# 1. POSITION INSIDE THE FACTORY

The existing factory flow remains unchanged:

``` text
RESEARCH
   ↓
RESEARCH FINDING
   ↓
DISPOSITION
   ↓
SITUATION GATE
   ↓
TRANSFORMATION SPECIFICATION
   ↓
TRANSFORMATION GATE
   ↓
PRODUCT SCHEMA
   ↓
ASSET / PRODUCT ARCHITECTURE
   ↓
WRITING / GENERATION CONTROL
   ↓
PRODUCT GENERATION
   ↓
DETERMINISTIC QA
   ↓
AI QA
   ↓
EVIDENCE / SAFETY
   ↓
COMMERCE QA
   ↓
CUSTOMER JOURNEY TEST
   ↓
PUBLISHING GATES
   ↓
LIVE
```

The Writing / Generation Control Layer sits **inside** the factory
between approved product architecture and product generation.

It controls execution.

It does not alter upstream decisions.

------------------------------------------------------------------------

# 2. THE CORE RULE

The model must never receive a request equivalent to:

> "Write an ebook about X."

It must receive an approved generation contract containing, as
applicable:

``` text
Transformation Specification
+
Product Schema
+
Approved Research / Knowledge
+
Product Architecture
+
Required Assets
+
Evidence / Safety Constraints
+
Delivery Formats
+
Swiipt Writing Constitution
+
Product-Specific Voice Specification
+
Anti-AI Rules
```

The model then executes that contract.

If the contract is incomplete, contradictory or unsafe, the model must
**flag the problem instead of inventing an answer**.

------------------------------------------------------------------------

# 3. SOURCE-OF-TRUTH HIERARCHY

When information conflicts, use this hierarchy:

## 1. Transformation Specification

Controls:

-   WHO
-   SITUATION
-   BEFORE
-   AFTER
-   MECHANISM
-   PATH
-   FAILURE
-   FIRST WIN
-   TSM
-   MAINTENANCE
-   NEXT SITUATION

## 2. Product Schema

Controls:

-   product identity
-   product role
-   transformation
-   required content
-   asset map
-   commerce
-   design
-   evidence
-   safety
-   QA
-   publishing

## 3. Approved Research / Knowledge

Controls:

-   researched facts
-   customer language
-   constraints
-   mechanisms
-   evidence
-   examples
-   supporting knowledge

## 4. Product Architecture

Controls:

-   modules
-   sequence
-   customer jobs
-   required assets
-   delivery structure

## 5. Writing / Generation Control Layer

Controls:

-   writing behaviour
-   voice
-   specificity
-   structure
-   explanation depth
-   anti-AI behaviour
-   generation passes

## 6. General Model Knowledge

General model knowledge is subordinate to the approved sources.

It must never be used to silently change the transformation, introduce
unsupported claims or resolve missing high-consequence information by
guessing.

------------------------------------------------------------------------

# 4. MODEL ROLE

The generator is responsible for:

1.  translating the approved specification into customer-facing content;
2.  preserving the approved transformation;
3.  building the required content architecture;
4.  creating required implementation assets;
5.  adapting content to approved delivery formats;
6.  maintaining evidence and safety boundaries;
7.  writing in the Swiipt voice;
8.  identifying missing information;
9.  producing structured output for downstream QA.

The generator is **not** responsible for:

-   deciding whether the niche is worth pursuing;
-   selecting a research finding;
-   inventing a transformation;
-   changing the customer;
-   changing the product role;
-   deciding that evidence is sufficient;
-   approving its own output;
-   bypassing acceptance tests;
-   bypassing publishing gates.

------------------------------------------------------------------------

# 5. SWIIPT WRITING CONSTITUTION

## 5.1 The standard

Swiipt writing should be:

-   intelligent
-   practical
-   specific
-   direct
-   warm without being sentimental
-   emotionally aware without being theatrical
-   calm
-   useful immediately
-   honest about constraints
-   action-oriented
-   transformation-led

The customer should feel:

> **"This understands the situation I am actually in."**

Not:

> **"This sounds like AI writing an ebook."**

------------------------------------------------------------------------

# 6. NEVER RULES

Avoid generic AI language and formulaic self-help language.

Never use phrases such as:

-   "In today's fast-paced world..."
-   "Embark on a journey..."
-   "It's important to remember..."
-   "Whether you're a busy..."
-   "Let's dive in..."
-   "Unlock your potential..."
-   "Take control of your..."
-   "Transform your life..."
-   "Empower yourself..."
-   "At the end of the day..."
-   "Here's the thing..."
-   "Imagine a world where..."
-   "The good news is..."
-   "You've got this."
-   "It all starts with..."
-   "This comprehensive guide..."
-   "This ultimate guide..."
-   "By following these steps..."
-   "In conclusion..."

Also prohibit:

-   fake empathy
-   motivational filler
-   generic inspirational statements
-   excessive emotional language
-   corporate language
-   textbook explanations when practical explanations work
-   repetitive summaries
-   repetitive encouragement
-   unnecessary conclusions
-   excessive headings
-   excessive bullet lists
-   forced humour
-   artificial urgency
-   rhetorical-question overload
-   repetitive sentence structures
-   filler transitions
-   writing primarily to increase word count

The model may use any normally forbidden phrase only when it is
genuinely necessary in quoted customer language or source material.

------------------------------------------------------------------------

# 7. ALWAYS RULES

The model should:

-   write to the actual customer situation;
-   use concrete circumstances;
-   use the customer's language where supported by research;
-   explain why when the explanation changes behaviour;
-   tell the customer what to do next;
-   acknowledge real constraints;
-   distinguish facts from interpretation;
-   make decisions easier;
-   provide realistic examples;
-   use natural sentence rhythm;
-   vary sentence length;
-   remove anything that does not serve the transformation;
-   keep the writing proportional to the customer's attention;
-   preserve the approved scope.

------------------------------------------------------------------------

# 8. CONCRETE BEFORE ABSTRACT

Prefer:

> "You finally sit down to eat and the baby starts crying."

over:

> "New parenthood can make maintaining healthy routines difficult."

Prefer:

> "You have tried going to bed earlier, but the baby wakes twice before
> midnight."

over:

> "Sleep deprivation affects new parents."

The product should create recognition through **specific situations**,
not generic descriptions of a demographic.

------------------------------------------------------------------------

# 9. CUSTOMER-SITUATION LOCK

Before generating each major module, the model must verify:

``` text
WHO is this for?
WHAT exact situation are they in?
WHAT are they trying to change?
WHY is change difficult?
WHAT constraint matters?
WHAT is emotionally at stake?
WHAT mechanism are we using?
WHAT does this module help them do?
```

If the module cannot answer those questions, it must be:

-   rewritten;
-   removed; or
-   flagged for architectural review.

------------------------------------------------------------------------

# 10. TRANSFORMATION LOCK

Every major section must contribute to:

``` text
BEFORE
   ↓
MECHANISM
   ↓
ACTION
   ↓
EVIDENCE OF CHANGE
   ↓
AFTER
```

A section does not earn its place merely because it is:

-   interesting;
-   educational;
-   related to the broad topic;
-   authoritative-sounding;
-   useful for increasing length.

It must support the approved transformation or a required product
function.

------------------------------------------------------------------------

# 11. SCOPE-DRIFT PROTECTION

The generator must not silently turn one transformation into another.

For example:

A postpartum wardrobe-confidence product may discuss body changes, but
must not become a weight-loss programme.

A newborn cord-care product may discuss family interference, but must
not become a general parenting course.

A sleep-organization product may discuss exhaustion, but must not become
a mental-health treatment.

The product owns its approved transformation.

If generation begins solving another transformation, flag:

> **SCOPE DRIFT --- UPSTREAM PRODUCT DECISION REQUIRED**

------------------------------------------------------------------------

# 12. PRODUCT ARCHITECTURE BEFORE PROSE

The model must not immediately write paragraphs.

First produce an internal architecture:

``` text
TRANSFORMATION
    ↓
MODULES
    ↓
SECTIONS
    ↓
CUSTOMER JOBS
    ↓
ACTIONS
    ↓
IMPLEMENTATION ASSETS
    ↓
FAILURE POINTS
    ↓
RESCUE PROTOCOLS
    ↓
TSM / EVIDENCE
```

Only then generate prose.

This prevents:

``` text
topic
→ headings
→ paragraphs
→ PDF
```

and enforces:

``` text
transformation
→ mechanism
→ action
→ evidence
→ customer experience
```

------------------------------------------------------------------------

# 13. EVERY MODULE NEEDS A JOB

Each module must have an explicit purpose.

Examples:

-   understand a situation;
-   make a decision;
-   perform an action;
-   establish a routine;
-   communicate with another person;
-   track change;
-   recover from failure;
-   maintain progress;
-   measure change;
-   prepare for the next situation.

The model should be able to state:

> **"This module exists because..."**

If it cannot, the module is suspect.

------------------------------------------------------------------------

# 14. ACTION OVER INFORMATION

Where the customer needs to act, information alone is insufficient.

The model should map the customer job to the appropriate experience:

``` text
READ
DO
DECIDE
TRACK
COMMUNICATE
RESCUE
RE-ENTER
MAINTAIN
```

Do not create a checklist, worksheet or tracker simply because the
factory can create one.

Every asset must have a job.

------------------------------------------------------------------------

# 15. FIRST-WIN RULE

Every transformation product must identify the earliest meaningful
customer win permitted by its Transformation Specification.

The generation contract should contain:

``` text
FIRST_WIN_ACTION
TIME_REQUIRED
EXPECTED_RESULT
WHAT_CUSTOMER_CAN_NOTICE
```

The first win should be:

-   realistic;
-   relevant;
-   achievable within the customer's actual constraints;
-   connected to the mechanism.

Do not manufacture dramatic immediate results.

------------------------------------------------------------------------

# 16. FAILURE-POINT WRITING

The product must assume that real customers will have bad days.

For each major action, consider applicable failure conditions:

-   no time;
-   low energy;
-   forgotten step;
-   unexpected event;
-   partner resistance;
-   family interference;
-   emotional resistance;
-   environmental constraint;
-   missed day;
-   incomplete implementation;
-   relapse.

The product should tell the customer what happens next.

A plan that only works on the customer's best day is incomplete.

------------------------------------------------------------------------

# 17. RESCUE PROTOCOL STANDARD

Where required by the Product Schema, rescue content should follow:

``` text
WHEN X HAPPENS
↓
DO Y
↓
AVOID Z
↓
CHECK THIS
↓
RETURN TO THE SYSTEM HERE
```

Rescue content should be:

-   short;
-   specific;
-   actionable;
-   situation-specific.

Do not replace a rescue protocol with motivational prose.

------------------------------------------------------------------------

# 18. EXAMPLE STANDARD

Examples must demonstrate actual decisions or behaviours.

Weak:

> "Communicate clearly with your family."

Strong:

> "If your mother-in-law offers something you have agreed not to use,
> use the approved script, then give her a specific task she can help
> with."

Examples should be:

-   realistic;
-   specific;
-   relevant;
-   consistent with research;
-   clearly identified as examples rather than universal rules.

------------------------------------------------------------------------

# 19. VOICE SPECIFICATION

The Swiipt Writing Constitution is global.

Each product may additionally have a **Product-Specific Voice
Specification**.

It may control:

``` text
formality
warmth
directness
technical depth
emotional intensity
sentence length
cultural context
humour
terminology
reading level
first/second person
```

The product voice may vary expression.

It may not violate the global Swiipt Writing Constitution.

------------------------------------------------------------------------

# 20. MEDICAL, SAFETY AND HIGH-CONSEQUENCE WRITING

For medical, health, financial, legal, safety or similarly
high-consequence products:

The generator must:

-   preserve approved evidence;
-   distinguish education from diagnosis/treatment where applicable;
-   preserve uncertainty;
-   avoid unsupported certainty;
-   avoid invented professional authority;
-   avoid invented statistics;
-   avoid invented citations;
-   preserve approved thresholds;
-   preserve escalation instructions;
-   flag unresolved safety questions.

The model must never make a product sound more authoritative than the
evidence permits.

------------------------------------------------------------------------

# 21. EVIDENCE PRESERVATION

For evidence-dependent claims, preserve:

``` text
CLAIM
SOURCE
EVIDENCE STRENGTH
CONTEXT
LIMITATION
```

Never:

-   turn correlation into causation;
-   turn possibility into certainty;
-   generalize a narrow finding into a universal rule;
-   fabricate citations;
-   invent expert consensus;
-   strengthen a claim merely to improve sales copy.

Persuasive writing cannot override evidence standards.

------------------------------------------------------------------------

# 22. ANTI-HALLUCINATION RULE

If required information is missing:

**DO NOT GUESS.**

Use the appropriate state:

``` text
FLAG
SOURCE_REQUIRED
PLACEHOLDER
HUMAN_REVIEW
```

Never invent:

-   testimonials;
-   customer stories;
-   statistics;
-   studies;
-   experts;
-   clinical recommendations;
-   product benefits;
-   transformation results;
-   quotes;
-   citations;
-   guarantees.

------------------------------------------------------------------------

# 23. REPETITION CONTROL

The generator must detect and remove:

-   repeated explanations;
-   duplicate advice;
-   repeated conclusions;
-   repeated emotional statements;
-   duplicate examples;
-   synonymous paragraphs;
-   unnecessary recaps.

A concept should normally be explained once and then used.

Repetition is allowed when required for safety, navigation or reference
use.

------------------------------------------------------------------------

# 24. HEADINGS CONTROL

Every heading should describe a real job or useful piece of information.

Good:

> What to do when the baby wakes again

Weak:

> Understanding Your Journey

Good:

> If your partner will not follow the plan

Weak:

> Building Better Relationships

Do not create headings merely to make the document look structured.

------------------------------------------------------------------------

# 25. BULLET-LIST CONTROL

Use bullets when they improve scanning.

Use prose when the customer needs:

-   reasoning;
-   nuance;
-   context;
-   explanation;
-   sequence.

Use bullets for:

-   quick reference;
-   warning signs;
-   options;
-   checklists;
-   criteria;
-   ingredients;
-   short lists.

Do not turn every paragraph into bullets.

------------------------------------------------------------------------

# 26. CONTENT DENSITY

Optimize for:

> **usefulness per unit of customer attention**

not:

> number of pages.

There is no arbitrary page-count target unless required by the Product
Schema.

A concise product that produces the intended change is better than a
long product full of repetition.

------------------------------------------------------------------------

# 27. MULTI-FORMAT CONSISTENCY

The same transformation may be delivered through:

-   Magazine
-   Read
-   PDF
-   Image
-   Read Aloud
-   Interactive

The Writing / Generation Control Layer must preserve the **same
underlying transformation, mechanism, instructions and safety
boundaries** across formats.

The expression may change.

The transformation does not.

Do not create six different products.

------------------------------------------------------------------------

# 28. INTERACTIVE CONTENT

When the Product Schema requires interactive delivery, generate
structured content for applicable engines such as:

-   checklist;
-   tracker;
-   decision tree;
-   rescue card;
-   script card;
-   daily plan;
-   milestone;
-   TSM;
-   photo log.

Interactive logic must be structured rather than buried inside prose.

For a decision tree, use:

``` text
TRIGGER
QUESTION
OPTIONS
NEXT STATE
ACTION
SAFETY ESCALATION
COMPLETION CONDITION
```

For a checklist:

``` text
ITEM
PURPOSE
STATE
COMPLETION CONDITION
```

For a tracker:

``` text
METRIC
BASELINE
ENTRY
FREQUENCY
TARGET / THRESHOLD
INTERPRETATION
NEXT ACTION
```

For a script card:

``` text
SITUATION
WHO
GOAL
SCRIPT
IF THEY PUSH BACK
NEXT ACTION
```

The actual fields remain governed by the existing Interactive Engine and
Product Schema.

------------------------------------------------------------------------

# 29. PRODUCT CONTENT PACKAGE

Depending on the Product Schema, generation may produce:

``` text
transformation summary
product content
module structure
implementation assets
failure-point map
rescue protocols
first-win experience
TSM implementation
maintenance instructions
next-transformation handoff
interactive configuration
delivery-format content
evidence/source map
safety notes
product metadata
```

Do not generate optional material merely to make the package larger.

------------------------------------------------------------------------

# 30. CONTROLLED GENERATION PASSES

Generation should happen in controlled passes.

## PASS 1 --- CONTRACT INGESTION

Load:

-   Transformation Specification;
-   Product Schema;
-   approved research;
-   product architecture;
-   evidence/safety requirements;
-   delivery requirements;
-   voice specification.

Produce an internal:

**Generation Brief**

containing the non-negotiable product facts.

------------------------------------------------------------------------

## PASS 2 --- ARCHITECTURE CHECK

Verify:

-   transformation is clear;
-   module sequence supports it;
-   every module has a job;
-   required assets are known;
-   failure points are represented;
-   rescue requirements are known;
-   TSM is represented;
-   delivery formats are known.

Do not write final prose yet.

------------------------------------------------------------------------

## PASS 3 --- CONTENT GENERATION

Generate the customer-facing content.

Every major section must map to:

``` text
TRANSFORMATION REQUIREMENT
→
CUSTOMER JOB
→
CONTENT / ACTION / ASSET
```

------------------------------------------------------------------------

## PASS 4 --- IMPLEMENTATION ASSETS

Generate required:

-   worksheets;
-   checklists;
-   trackers;
-   scripts;
-   decision trees;
-   rescue protocols;
-   reference cards;
-   plans;
-   other schema-defined assets.

------------------------------------------------------------------------

## PASS 5 --- VOICE PASS

Review the complete product against:

-   Swiipt Writing Constitution;
-   Product-Specific Voice Specification;
-   customer language;
-   specificity;
-   naturalness.

------------------------------------------------------------------------

## PASS 6 --- ANTI-AI PASS

Remove:

-   AI clichés;
-   filler;
-   repetitive transitions;
-   repetitive summaries;
-   unnecessary headings;
-   artificial empathy;
-   motivational filler;
-   excessive listification;
-   unnatural sentence patterns.

------------------------------------------------------------------------

## PASS 7 --- TRANSFORMATION QA HANDOFF

Produce the structured summary required by the independent QA layer:

``` text
TARGET CUSTOMER
APPROVED SITUATION
BEFORE STATE
DESIRED AFTER STATE
MECHANISM
KEY ACTIONS
FIRST WIN
FAILURE POINTS
RESCUE SYSTEM
TSM
MAINTENANCE
NEXT SITUATION
```

The generator must not declare the product transformation-valid merely
because it generated it.

------------------------------------------------------------------------

# 31. GENERATOR / CRITIC SEPARATION

Where the infrastructure permits, separate:

### GENERATOR

Creates the product.

### CRITIC / QA MODEL

Attempts to break it.

The critic must evaluate rather than silently redesign.

It should report:

``` text
PASS
FAIL
WARNING
MISSING
UNSUPPORTED
SCOPE_DRIFT
TRANSFORMATION_WEAKNESS
WRITING_QUALITY_ISSUE
SAFETY_ISSUE
```

The generator then performs targeted revisions.

------------------------------------------------------------------------

# 32. TARGETED REVISION

Do not regenerate the entire product because one section failed.

Revision should identify:

``` text
FAILED COMPONENT
REASON
REQUIRED CHANGE
UPSTREAM DEPENDENCY
```

Then revise only the affected component where possible.

Preserve already-approved material.

------------------------------------------------------------------------

# 33. CHANGE CONTROL

A writing revision must not silently change:

-   customer;
-   situation;
-   before-state;
-   after-state;
-   mechanism;
-   TSM;
-   product role;
-   evidence position;
-   safety instruction.

If a requested change affects one of these, flag:

> **UPSTREAM CONTRACT CHANGE REQUIRED**

The generator must never solve an upstream problem by quietly changing
downstream content.

------------------------------------------------------------------------

# 34. GENERATION MANIFEST

Each generated product should record:

``` text
product_id
transformation_id
product_schema_version
writing_control_version
research_version
architecture_version
voice_spec_version
generator_model
generation_timestamp
revision_number
qa_status
evidence_status
safety_status
publish_status
```

This provides reproducibility and auditability.

------------------------------------------------------------------------

# 35. VERSIONING

The Writing / Generation Control Layer is versioned independently.

Example:

``` text
writing-control-v1.0
writing-control-v1.1
writing-control-v2.0
```

Products record the version used to generate them.

Changing the writing rules must not silently rewrite previously
published products.

------------------------------------------------------------------------

# 36. PRODUCT-SPECIFIC GENERATION MEMORY

The generation context may contain:

``` text
approved terminology
customer language
known constraints
approved examples
approved evidence
forbidden claims
required assets
voice characteristics
format requirements
```

This prevents repeated rediscovery of decisions.

It does not override the Transformation Specification or Product Schema.

------------------------------------------------------------------------

# 37. CULTURAL / AUDIENCE FIT

Use cultural or regional context when it is supported by research and
improves:

-   recognition;
-   practicality;
-   decision-making;
-   communication;
-   implementation.

Do not add cultural references merely to make content appear local.

Do not stereotype.

------------------------------------------------------------------------

# 38. EMOTIONAL WRITING STANDARD

Swiipt understands emotional stakes without manufacturing emotion.

Weak:

> "You are a warrior and this incredible journey will change
> everything."

Better:

> "You may know what you should do. The difficult part is doing it when
> you are exhausted and someone else is questioning the plan."

Emotion should come from the customer's real situation.

Do not manufacture drama.

------------------------------------------------------------------------

# 39. PERSUASION BOUNDARY

The product should persuade through:

-   relevance;
-   clarity;
-   credibility;
-   specificity;
-   usefulness;
-   mechanism;
-   evidence;
-   achievable progress.

Do not use:

-   shame;
-   fear inflation;
-   fake urgency;
-   exaggerated outcomes;
-   false certainty;
-   manufactured dependency.

------------------------------------------------------------------------

# 40. COMPLETION WRITING

Do not end merely with:

> "Congratulations! You finished the guide."

Completion should connect to the actual transformation:

``` text
WHAT CHANGED
↓
WHAT REMAINS
↓
HOW TO MAINTAIN IT
↓
WHAT TO DO WHEN IT BREAKS
↓
WHAT SITUATION MAY COME NEXT
```

The existing Factory Standard remains authoritative for completion.

------------------------------------------------------------------------

# 41. NEXT-TRANSFORMATION HANDOFF

Where required, the product should prepare the customer for the next
likely situation.

This must not become a random upsell.

The recommendation should be grounded in:

``` text
CURRENT STATE
+
REMAINING GAP
+
LIKELY NEXT SITUATION
```

The Customer Journey Graph remains responsible for broader journey
logic.

------------------------------------------------------------------------

# 42. GENERATION STOP CONDITIONS

Generation must stop and flag when:

-   Transformation Specification is missing;
-   Product Schema is missing;
-   approved situation is ambiguous;
-   required evidence is missing;
-   safety-sensitive information is unresolved;
-   product scope conflicts with the approved transformation;
-   required assets cannot be reliably represented;
-   TSM cannot be represented;
-   source material conflicts;
-   the model would have to invent material information.

Do not "make something reasonable" to force completion.

------------------------------------------------------------------------

# 43. FINAL GENERATOR SELF-CHECK

Before handing output to QA:

## Transformation

-   Who is this for?
-   What exact situation are they in?
-   What is the before-state?
-   What is the desired after-state?
-   What mechanism moves them?
-   What is the first win?
-   What happens when implementation fails?
-   How is success measured?

## Product

-   Does every module have a job?
-   Are required assets present?
-   Is the sequence actionable?
-   Is the product within scope?
-   Are delivery formats supported?

## Writing

-   Does it sound human?
-   Is it specific?
-   Is it concrete?
-   Is it appropriately concise?
-   Is it emotionally intelligent without manufactured emotion?
-   Are AI clichés removed?
-   Is repetition controlled?

## Evidence

-   Are claims supported?
-   Are limitations preserved?
-   Has anything been invented?
-   Are safety boundaries intact?

## Customer

-   Can the customer identify their situation?
-   Can they tell what to do next?
-   Can they use it on a bad day?
-   Can they recognize progress?
-   Can they tell what happens next?

------------------------------------------------------------------------

# 44. WHAT THIS LAYER DOES NOT DO

It does not:

-   select research;
-   validate the market;
-   decide which research becomes a product;
-   redefine the transformation;
-   replace the Product Schema;
-   replace the Design System;
-   replace Acceptance Tests;
-   replace Publishing Gates;
-   approve its own output;
-   bypass human review required by the factory.

------------------------------------------------------------------------

# 45. MACHINE-READABLE IMPLEMENTATION

The eventual implementation should represent the writing controls as
structured configuration, while reusing existing Swiipt schemas and
infrastructure.

Conceptual structure:

``` json
{
  "writing_control_version": "1.0",
  "constitution": {
    "required_behaviours": [],
    "forbidden_behaviours": [],
    "forbidden_phrases": []
  },
  "generation": {
    "required_inputs": [],
    "passes": [],
    "revision_policy": {}
  },
  "voice": {
    "global_rules": {},
    "product_rules": {}
  },
  "evidence": {
    "claim_policy": {},
    "uncertainty_policy": {}
  },
  "scope": {
    "approved_transformation": "",
    "drift_rules": []
  },
  "assets": {
    "required": [],
    "optional": []
  },
  "qa_handoff": {
    "required_outputs": []
  }
}
```

Do not create duplicate schema systems.

Before implementation, inspect the existing repository and integrate
with the existing Product Schema, validation system and factory
architecture.

------------------------------------------------------------------------

# 46. IMPLEMENTATION INSTRUCTION TO THE LLM

You are implementing the **Swiipt Writing / Generation Control Layer**
inside the existing Transformation Product Factory.

Before writing code:

1.  Inspect the existing Swiipt repository.
2.  Locate the current Transformation Specification.
3.  Locate the Product Schema.
4.  Locate the existing product-generation workflow.
5.  Locate the Design System.
6.  Locate Acceptance Tests.
7.  Locate Publishing Gates.
8.  Locate existing model prompts, templates and validators.
9.  Locate existing versioning and product metadata.
10. Identify what already exists before creating anything new.

Do not create a parallel product-generation framework.

Do not duplicate the Product Schema.

Do not duplicate Acceptance Tests.

Do not duplicate Publishing Gates.

Do not hard-code individual products into the generation system.

Implement this document as the controlled execution layer between
approved product architecture and product generation.

The system must allow many different transformation products to be
generated while maintaining one recognizable Swiipt writing standard.

A new product should primarily require:

``` text
approved Transformation Specification
+
approved Product Schema
+
approved research
+
approved product architecture
+
product-specific voice/configuration
```

It should not require a new generation system.

------------------------------------------------------------------------

# 47. SUCCESS CRITERION

The layer is successful when the factory can generate products across
completely different Life Transformation areas without producing generic
AI content.

For example:

-   postpartum;
-   men's reinvention;
-   chronic-condition lifestyle management;
-   family food systems;
-   relationships;
-   household organization;
-   career transitions;
-   relocation;
-   other approved Life Areas.

The products may differ radically in:

-   audience;
-   situation;
-   mechanism;
-   emotional stake;
-   structure;
-   assets;
-   delivery format.

But they should still feel like products created by the same company:

> **Swiipt.**

------------------------------------------------------------------------

# 48. FINAL CO-FOUNDER RULE

The factory must never optimize for:

> **"Can the AI write a good ebook?"**

The correct question is:

> **"Can the AI faithfully execute an approved transformation into a
> genuinely useful customer experience while preserving Swiipt's
> standards?"**

The LLM is the writer and production engine.

It is **not the strategist, transformation validator, evidence authority
or publishing authority.**

That separation is what allows Swiipt to scale from hundreds to
thousands to hundreds of thousands of products without turning the
Transformation Library into generic AI-generated content.
