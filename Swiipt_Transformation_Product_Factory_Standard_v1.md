# SWIIPT --- Transformation Product Factory Standard

## Rigorous Five-Part Product Creation, QA & Publishing System

### Version 1.0 --- 24 August 2026

------------------------------------------------------------------------

## 0. PURPOSE

This document is the single canonical standard for turning research into
products inside the Swiipt Life Transformation Engine.

It formalizes five things that previously existed only partly across the
product guideline, product specs, memory, V06 build, and engineering
notes:

1.  Transformation Specification
2.  Product Schema
3.  Design System
4.  Acceptance Tests
5.  Publishing Gates

It also locks one foundational rule:

> **No research is discarded.**

A research finding does not need to become a standalone transformation
product to have value. It must be assigned the correct role inside the
permanent product ecosystem.

The company is not a find → test → kill → repeat MVP shop.

The operating model is:

**Research → Knowledge → Transformation → Evidence → Products → Customer
Outcome → Journey Intelligence → Next Transformation**

------------------------------------------------------------------------

# 1. WHAT WE ALREADY HAD VS WHAT THIS DOCUMENT FORMALIZES

## Already established

The existing files already contain the core intellectual standard:

-   9-layer Transformation Engine architecture
-   Situation-first product scoping
-   Broad topic → specific recurring situation → transformation →
    mechanism → product
-   Before → Mechanism → Action → Evidence of Change → After
-   11-section transformation/product template
-   TSM / Transformation Success Model
-   transformation path
-   implementation assets
-   failure-point map
-   rescue protocols
-   first-win requirement
-   READ / DO / DECIDE / COMMUNICATE / TRACK / RECOVER format logic
-   re-entry and maintenance
-   next-transformation routing
-   A--O product quality gate
-   evidence and safety requirements
-   deliberate use of products, modules, lead magnets, upsells and
    bundles
-   customer-journey and ecosystem connections
-   WordPress delivery/publishing architecture

These are not being replaced.

## What was missing

The existing material was strong conceptually but was distributed across
several documents and was not yet one enforceable factory contract.

This document therefore turns those principles into:

**canonical records + required fields + states + machine checks + AI
checks + gates + publishing rules.**

------------------------------------------------------------------------

# 2. THE MOST IMPORTANT DISTINCTION

The factory has four different objects:

### A. Research Finding

Something discovered during research.

It may be:

-   a problem
-   a recurring situation
-   a failed attempt
-   a mechanism
-   a customer fear
-   an emotional trigger
-   a supporting tool opportunity
-   a marketing insight
-   a journey transition
-   an evidence gap

A research finding is NOT automatically a product.

### B. Transformation

A validated, specific situation in which a meaningful before-state can
be moved toward a defined after-state through a credible mechanism.

### C. Product

The customer-facing experience assembled to deliver that transformation.

### D. Asset

A component used to help the customer READ, DO, DECIDE, TRACK,
COMMUNICATE, RESCUE, RE-ENTER or MAINTAIN.

The hierarchy is:

**Research Finding → Transformation → Product → Assets**

but not every research finding reaches the Transformation layer.

------------------------------------------------------------------------

# 3. NO-RESEARCH-WASTED RULE

Every research finding must receive a disposition.

## Allowed library roles

  -----------------------------------------------------------------------
  Role                                Meaning
  ----------------------------------- -----------------------------------
  STANDALONE_TRANSFORMATION           Distinct situation + distinct
                                      meaningful transformation

  ENTRY_PRODUCT                       Smaller transformation that
                                      introduces the customer to the
                                      ecosystem

  UPSELL                              Natural adjacent need after another
                                      product

  ORDER_BUMP                          Small, tightly related add-on that
                                      improves the primary transformation

  BUNDLE_COMPONENT                    Part of a larger connected
                                      transformation system

  MODULE                              Specialized mechanism or subproblem
                                      inside another transformation

  BONUS_FREE_GIFT                     Valuable supporting tool that
                                      increases implementation

  LEAD_MAGNET                         Useful low-friction entry asset

  MARKETING_ANGLE                     Same underlying transformation,
                                      different pain/trigger/language

  SUPPORTING_ASSET                    Tool, script, checklist,
                                      calculator, tracker, etc.

  JOURNEY_NODE                        Important life situation that may
                                      not yet justify a product

  FUTURE_RESEARCH                     Evidence is promising but
                                      transformation/product definition
                                      is incomplete

  EVIDENCE_GAP                        Valuable opportunity requiring
                                      further research before
                                      classification
  -----------------------------------------------------------------------

### There is no DISCARD status for valuable research.

The only terminal state for research is:

**RETAINED + ASSIGNED ROLE**

A finding can be reclassified later as new evidence arrives.

This protects the library from the destructive MVP habit of throwing
away ideas that do not win as standalone products.

------------------------------------------------------------------------

# 4. TRANSFORMATION SPECIFICATION

## 4.1 Definition

The Transformation Specification is the canonical contract that defines
what transformation exists, for whom, in what situation, what changes,
why it should change, how change is implemented, how failure is handled,
and how success is evidenced.

A transformation cannot become a product merely because the topic is
popular.

------------------------------------------------------------------------

## 4.2 Mandatory situation hierarchy

The factory must preserve this hierarchy:

**Broad topic** → **Submarket** → **Specific recurring situation** →
**Specific person** → **Trigger** → **Failed attempt / constraint** →
**Emotional stake** → **Desired transformation**

The product title must not be allowed to hide an insufficiently scoped
situation.

### Mandatory pre-acceptance question

> If the product title is removed, can we still describe the exact
> person, exact situation, exact moment in life, problem, failed
> attempt, constraint, emotional stake and desired outcome?

If NO:

**NOT A TRANSFORMATION YET.**

------------------------------------------------------------------------

# 5. TRANSFORMATION SPEC --- CANONICAL RECORD

``` json
{
  "transformation_id": "string",
  "library_id": "string",
  "submarket_id": "string",
  "status": "research|candidate|validated|active|retired",

  "situation": {
    "life_state": "string",
    "person": "string",
    "specific_situation": "string",
    "timeframe": "string",
    "trigger": "string",
    "problem": "string",
    "failed_attempt": "string",
    "constraints": [],
    "emotional_stake": "string",
    "desired_transformation": "string"
  },

  "before_state": {
    "current_behavior": [],
    "current_conditions": [],
    "emotional_state": [],
    "practical_consequences": [],
    "failed_attempts": [],
    "environmental_constraints": [],
    "people_involved": []
  },

  "after_state": {
    "new_capabilities": [],
    "improvements": [],
    "systems_created": [],
    "remaining_limits": [],
    "evidence_of_change": []
  },

  "mechanism": {
    "core_mechanism": "string",
    "mechanisms": [],
    "why_it_should_work": "string",
    "evidence_basis": []
  },

  "transformation_path": [
    {
      "stage": "string",
      "objective": "string",
      "customer_action": [],
      "required_assets": []
    }
  ],

  "failure_point_map": [
    {
      "failure_type": "string",
      "scenario": "string",
      "rescue_protocol": "string"
    }
  ],

  "first_win": {
    "time_limit_minutes": 15,
    "action": "string",
    "observable_change": "string"
  },

  "tsm": {
    "before_baseline": [],
    "success_indicators": [],
    "measurement_days": [0, 7, 14, 30],
    "success_threshold": "string",
    "measurement_method": "string"
  },

  "maintenance": {
    "maintenance_system": "string",
    "relapse_protocol": "string",
    "reentry_protocol": "string"
  },

  "next_transformation": [],
  "evidence": [],
  "safety": {},
  "research_disposition": {}
}
```

This is the transformation-level contract.

------------------------------------------------------------------------

# 6. TRANSFORMATION VALIDATION RULE

A transformation requires all of these:

1.  Specific situation
2.  Specific customer
3.  Clear trigger/life moment
4.  Meaningful before-state
5.  Meaningful after-state
6.  Credible mechanism
7.  Implementable path
8.  Observable evidence of change
9.  Appropriate safety boundary
10. Clear relationship to the customer journey

If any critical field is missing:

**candidate only --- no product build.**

------------------------------------------------------------------------

# 7. PRODUCT SCHEMA

## 7.1 Definition

The Product Schema is the canonical contract for the customer-facing
thing assembled from one or more transformation/asset records.

A product is not the transformation itself.

It is the delivery system for the transformation.

------------------------------------------------------------------------

## 7.2 Product hierarchy

``` text
Library
  ↓
Situation
  ↓
Transformation
  ↓
Product
  ↓
Asset Map
  ↓
Customer Experience
  ↓
Outcome Evidence
```

------------------------------------------------------------------------

## 7.3 Canonical Product Record

``` json
{
  "product_id": "string",
  "version": "semver",
  "status": "spec|building|qa|ready|published|retired",

  "identity": {
    "name": "string",
    "subtitle": "string",
    "one_line_promise": "string",
    "library_id": "string",
    "transformation_id": "string",
    "journey_position": "string"
  },

  "commercial_role": {
    "role": "core|entry|upsell|order_bump|bundle|lead_magnet|bonus|module",
    "parent_product_id": null,
    "related_product_ids": []
  },

  "customer": {
    "target_person": "string",
    "situation": "string",
    "trigger": "string",
    "constraints": [],
    "emotional_stake": "string"
  },

  "transformation": {
    "before_state": {},
    "after_state": {},
    "mechanism": {},
    "path": [],
    "first_win": {},
    "failure_map": {},
    "rescue_protocols": {},
    "reentry": {},
    "maintenance": {},
    "next_transformation_ids": []
  },

  "tsm": {},

  "asset_map": {
    "read": [],
    "do": [],
    "decide": [],
    "track": [],
    "communicate": [],
    "rescue": [],
    "reentry": [],
    "maintenance": []
  },

  "content": {
    "landing_page": {},
    "product_page": {},
    "faq": {},
    "specifications": {},
    "deliverables": {},
    "onboarding": {},
    "completion": {}
  },

  "commerce": {
    "price": {},
    "currency_rules": {},
    "offer": {},
    "access_rules": {},
    "upsells": [],
    "bundles": []
  },

  "design": {
    "experience_type": "string",
    "theme": "string",
    "components": [],
    "responsive_requirements": [],
    "accessibility_requirements": []
  },

  "evidence": {
    "sources": [],
    "claim_labels": [],
    "review_status": "string"
  },

  "safety": {
    "risk_level": "low|moderate|high|clinical",
    "disclaimer": "string",
    "red_flags": [],
    "escalation_rules": []
  },

  "qa": {
    "deterministic_tests": [],
    "ai_tests": [],
    "gate_results": {}
  },

  "publishing": {
    "manifest_version": "string",
    "wordpress_ids": {},
    "published_at": null
  }
}
```

------------------------------------------------------------------------

# 8. PRODUCT CONTENT CONTRACT

Every product must define:

### 01 Identity

What it is and who it serves.

### 02 Before

The customer's actual starting condition.

### 03 After

The legitimate intended change.

### 04 Mechanism

Why the change should occur.

### 05 Path

What the customer actually does.

### 06 Assets

What helps them complete each job.

### 07 Failure system

What happens when real life interferes.

### 08 First win

Immediate value within approximately 5--15 minutes.

### 09 TSM

How actual change is measured.

### 10 Re-entry / maintenance

How the customer restarts and preserves gains.

### 11 Next transformation

What logically comes next in the journey.

This preserves the existing 11-section product discipline.

------------------------------------------------------------------------

# 9. ASSET ENGINE CONTRACT

The Asset Engine chooses formats according to customer jobs.

It must never start from:

> "Let's make a PDF."

It starts from:

**What must the customer do?**

  Job           Possible format
  ------------- ---------------------------------------
  READ          magazine, guide, article, audio
  DO            workbook, interactive flow, checklist
  DECIDE        decision tree, quiz, rules engine
  TRACK         tracker, dashboard, log
  CALCULATE     calculator
  COMMUNICATE   scripts, templates
  RESCUE        emergency card, protocol
  RE-ENTER      restart protocol
  MAINTAIN      maintenance system
  REMEMBER      quick-reference card

One transformation can contain multiple formats.

The formats collectively form the product experience.

------------------------------------------------------------------------

# 10. DESIGN SYSTEM

## 10.1 What is already locked

The current product work establishes an important design philosophy:

-   the product experience must match the transformation
-   PP-01 / PP-02 use beautiful, scannable flipbook-style experiences
-   PP-03 deliberately uses functional-first delivery because sensitive
    clinical content should not be made artificially decorative
-   functional assets can be PDF, HTML, SVG, text, interactive tools or
    other appropriate formats
-   the delivery engine converts source assets into supported customer
    formats
-   visual polish is subordinate to customer usability when the subject
    demands privacy, warmth or clinical seriousness

## 10.2 What this standard now locks

The design system is not "make everything look the same."

It is:

**One brand system + controlled product experience modes.**

### Product experience modes

1.  **Editorial**
    -   magazine/flipbook
    -   narrative
    -   visual
    -   emotional
    -   discovery-oriented
2.  **Functional**
    -   task-first
    -   high scanability
    -   minimal decoration
    -   decision/action oriented
3.  **Interactive**
    -   tool
    -   calculator
    -   quiz
    -   planner
    -   tracker
    -   decision engine
4.  **Sensitive**
    -   private
    -   warm
    -   restrained
    -   non-performative
    -   safety-forward
5.  **Utility**
    -   printable
    -   quick reference
    -   scripts
    -   cards
    -   checklists

The product specification chooses the mode.

------------------------------------------------------------------------

# 11. DESIGN SYSTEM --- ENFORCEABLE LAYERS

The design system must eventually exist as tokens, not vague
instructions.

## Layer 1 --- Brand tokens

-   brand colors
-   semantic colors
-   typography
-   spacing
-   radii
-   shadows
-   borders
-   iconography
-   imagery rules
-   motion rules

## Layer 2 --- Product tokens

Product-specific expression may vary within the brand boundaries.

It may change:

-   accent color
-   imagery
-   editorial tone
-   illustration treatment
-   density

It may NOT change:

-   core typography hierarchy
-   accessibility requirements
-   spacing logic
-   interaction conventions
-   buttons
-   forms
-   alerts
-   navigation behavior
-   status semantics

## Layer 3 --- Component library

Every product should reuse canonical components:

-   header
-   progress indicator
-   cards
-   buttons
-   input fields
-   checkboxes
-   trackers
-   quiz questions
-   decision nodes
-   callouts
-   safety alerts
-   scripts
-   rescue cards
-   completion check
-   next-transformation card

## Layer 4 --- Experience rules

Every screen/page must have:

-   one primary job
-   one primary action
-   obvious progress/context
-   readable hierarchy
-   mobile-first layout
-   accessible interaction
-   appropriate emotional tone

------------------------------------------------------------------------

# 12. DESIGN NON-NEGOTIABLES

1.  No arbitrary colors.
2.  No arbitrary fonts.
3.  No decorative interaction that slows the task.
4.  No dense wall-of-text when a structured interaction is better.
5.  No medical/sensitive product using playful visual treatment that
    trivializes the situation.
6.  No interactive element without keyboard/accessibility consideration.
7.  No critical information communicated only by color.
8.  No mobile experience that requires desktop assumptions.
9.  No product-specific UI reinvented when a system component already
    exists.
10. No visual design that contradicts the customer's emotional
    situation.

The final visual tokens should be extracted from the authoritative
Swiipt brand/theme specification before implementation. This document
defines the enforcement architecture; it does not invent a brand palette
that is not present in the supplied product files.

------------------------------------------------------------------------

# 13. ACCEPTANCE TESTS

Acceptance testing has two fundamentally different classes.

## A. Deterministic tests

A machine can check these.

## B. AI judgment tests

A model evaluates these against the canonical standards.

Neither replaces the other.

------------------------------------------------------------------------

# 14. DETERMINISTIC ACCEPTANCE TESTS

## Schema

-   product.json valid
-   transformation.json valid
-   manifest valid
-   no missing required fields
-   no duplicate IDs
-   no invalid relationships
-   version valid

## Content

-   landing page exists
-   product page exists
-   specs exist
-   deliverables exist
-   FAQ exists where required
-   onboarding exists
-   completion exists
-   next transformation exists or explicit "none yet" reason

## Assets

-   every declared asset exists
-   no orphan critical assets
-   all links resolve
-   downloads resolve
-   media references exist

## Build

-   application builds
-   tests pass
-   lint passes
-   type checks pass
-   no blocking console errors
-   no broken routes

## UX

-   responsive layouts pass defined breakpoints
-   keyboard navigation works
-   form validation works
-   error states exist
-   loading states exist
-   empty states exist

## Accessibility

-   semantic headings
-   labels for inputs
-   keyboard operation
-   sufficient contrast
-   focus visibility
-   alt text where required
-   no color-only meaning
-   appropriate ARIA where necessary

## Commerce

-   price exists
-   currency mapping exists
-   product is correctly linked
-   access entitlement works
-   purchase flow works
-   customer receives correct product
-   upsell/bundle relationship is correct

## Platform

-   transformation relationship exists
-   situation relationship exists
-   journey relationship exists
-   next-transformation relationship resolves

------------------------------------------------------------------------

# 15. AI ACCEPTANCE TESTS

The AI reviewer must evaluate the product independently from the
builder.

### Test A --- Situation integrity

Does the product serve the exact approved situation?

### Test B --- Scope integrity

Has the product silently absorbed a neighboring problem?

### Test C --- Transformation integrity

Is the promised change actually different from the starting state?

### Test D --- Mechanism integrity

Does the product explain and operationalize a credible mechanism?

### Test E --- Action integrity

Can the customer actually execute the transformation?

### Test F --- Sequence integrity

Is there a progression rather than an information pile?

### Test G --- First-win integrity

Can the customer experience useful progress rapidly?

### Test H --- Failure integrity

Does the system work when the customer has a bad day?

### Test I --- Rescue integrity

Does each major failure point have a concrete rescue?

### Test J --- TSM integrity

Can actual change be measured?

### Test K --- Evidence integrity

Are claims distinguished between evidence, inference, lived experience
and hypothesis?

### Test L --- Safety integrity

Does the product stay inside its competence boundary?

### Test M --- Format integrity

Does each format serve an actual customer job?

### Test N --- Emotional integrity

Does the product understand the customer's actual emotional stake
without manipulation?

### Test O --- Journey integrity

Does it connect naturally to the next situation?

### Test P --- Ecosystem integrity

Does it have the correct commercial role and relationship to other
products?

### Test Q --- Copy integrity

Does the title communicate the recognizable situation without pretending
to explain the mechanism?

### Test R --- Drift integrity

Has the product changed its situation definition while retaining its
original name?

This last test is mandatory because previous product-spec reviews caught
exactly this failure.

------------------------------------------------------------------------

# 16. AI REVIEW OUTPUT

The reviewer must return structured results:

``` json
{
  "product_id": "string",
  "overall_status": "PASS|FAIL|REVISION_REQUIRED",
  "tests": {
    "A": {
      "status": "PASS",
      "severity": "none",
      "reason": "string",
      "evidence": []
    }
  },
  "blocking_issues": [],
  "non_blocking_issues": [],
  "scope_drift": [],
  "safety_issues": [],
  "required_changes": []
}
```

The builder does not get to self-approve.

------------------------------------------------------------------------

# 17. SEVERITY MODEL

### BLOCKER

Cannot publish.

Examples:

-   unsafe clinical claim
-   missing transformation
-   missing TSM
-   broken purchase/access
-   incorrect product boundary
-   missing required asset
-   invalid manifest
-   evidence failure
-   major scope drift

### MAJOR

Must be corrected before publish.

### MINOR

Can be queued for post-launch improvement if it does not affect
transformation, safety, commerce or trust.

### OBSERVATION

No correction required.

------------------------------------------------------------------------

# 18. PUBLISHING STATE MACHINE

The product must move through explicit states.

``` text
RESEARCH
  ↓
CANDIDATE
  ↓
TRANSFORMATION_VALIDATED
  ↓
PRODUCT_SELECTED
  ↓
SPECIFIED
  ↓
CONTENT_READY
  ↓
BUILT
  ↓
DETERMINISTIC_QA
  ↓
AI_QA
  ↓
SAFETY_EVIDENCE_REVIEW
  ↓
COMMERCE_QA
  ↓
CUSTOMER_JOURNEY_TEST
  ↓
READY_TO_PUBLISH
  ↓
PUBLISHED
  ↓
MONITORED
```

A product may move backward.

Example:

**AI_QA → SPECIFIED**

if scope drift is discovered.

No state transition should be inferred from the existence of files
alone.

------------------------------------------------------------------------

# 19. PUBLISHING GATES

## GATE 0 --- Research disposition

Question:

> What role does this research finding play?

Must be assigned:

-   standalone
-   entry
-   upsell
-   order bump
-   bundle
-   module
-   bonus
-   lead magnet
-   marketing angle
-   supporting asset
-   journey node
-   future research
-   evidence gap

No unclassified research proceeds.

------------------------------------------------------------------------

## GATE 1 --- Situation gate

Must have:

-   exact person
-   exact situation
-   timeframe/life state
-   trigger
-   problem
-   failed attempt or constraint
-   emotional stake
-   desired transformation

FAIL = no transformation build.

------------------------------------------------------------------------

## GATE 2 --- Transformation gate

Must have:

-   before
-   after
-   mechanism
-   action path
-   evidence of change
-   safety boundary

FAIL = no product specification.

------------------------------------------------------------------------

## GATE 3 --- Product architecture gate

Must have:

-   product role
-   asset map
-   customer path
-   first win
-   failure map
-   rescue system
-   TSM
-   re-entry
-   maintenance
-   next transformation

FAIL = no build.

------------------------------------------------------------------------

## GATE 4 --- Evidence gate

Claims must have appropriate status:

-   sourced evidence
-   expert-reviewed
-   lived experience
-   model inference
-   hypothesis

Clinical facts and thresholds cannot be invented.

FAIL = no publish.

------------------------------------------------------------------------

## GATE 5 --- Safety gate

Required according to risk level.

Must verify:

-   scope boundaries
-   disclaimers
-   red flags
-   escalation routes
-   no diagnosis
-   no unsupported medical promises

FAIL = no publish.

------------------------------------------------------------------------

## GATE 6 --- Content gate

Required customer-facing content exists:

-   READ
-   DO
-   DECIDE
-   TRACK
-   COMMUNICATE
-   RESCUE
-   RE-ENTRY
-   MAINTENANCE

Only the formats actually required by the transformation need to exist,
but the customer jobs must be covered.

FAIL = revision.

------------------------------------------------------------------------

## GATE 7 --- Product QA gate

All deterministic and AI acceptance tests pass.

FAIL = revision.

------------------------------------------------------------------------

## GATE 8 --- Commerce gate

Verify:

-   price
-   product record
-   access entitlement
-   payment
-   delivery
-   downloads/tools
-   upsells
-   bundle relationships

FAIL = no publish.

------------------------------------------------------------------------

## GATE 9 --- Customer journey gate

Perform a real customer journey:

**discover → landing page → purchase → access → onboarding → first win →
transformation path → completion → TSM check-in → next transformation**

This is not an MVP validation experiment.

It is a technical/customer-experience integrity test.

FAIL = no publish.

------------------------------------------------------------------------

## GATE 10 --- Publish gate

Only a product with all required gates passed can receive:

**READY_TO_PUBLISH**

The publisher then consumes the immutable publish manifest.

------------------------------------------------------------------------

# 20. PUBLISH MANIFEST

The publisher should never infer missing product information.

It receives:

``` json
{
  "manifest_version": "1.0",
  "product_id": "string",
  "publish_target": "wordpress",
  "product": {},
  "transformation": {},
  "assets": [],
  "commerce": {},
  "relationships": {},
  "seo": {},
  "access": {},
  "qa": {
    "deterministic": "PASS",
    "ai": "PASS",
    "safety": "PASS",
    "commerce": "PASS",
    "journey": "PASS"
  },
  "publish_authorization": {
    "status": "READY_TO_PUBLISH"
  }
}
```

If any required gate is not PASS:

**Publisher refuses publication.**

------------------------------------------------------------------------

# 21. HUMAN AUTHORITY

Automation must eliminate manual labour, not human governance.

Humans retain authority over:

-   transformation boundary
-   high-risk medical/safety approval
-   major claims
-   pricing strategy
-   brand-level exceptions
-   publication override in exceptional cases

The AI cannot override a safety gate.

The builder cannot approve its own work.

The publisher cannot repair an incomplete product.

The research agent cannot decide that a finding is worthless.

------------------------------------------------------------------------

# 22. PRODUCT ROLE AND COMMERCIAL ROUTING

The factory must separate:

**Transformation quality** from **commercial role**.

A strong transformation can be:

-   core product
-   entry product
-   upsell
-   order bump
-   bundle
-   module

A useful research finding can be:

-   lead magnet
-   marketing angle
-   bonus
-   supporting tool
-   future product seed

Therefore:

> **"Not a standalone product" never means "discarded."**

This is a foundational rule of the Swiipt ecosystem.

------------------------------------------------------------------------

# 23. ECOSYSTEM RULE

Every product must answer:

### What situation does this solve?

### What transformation does it deliver?

### What situation is likely next?

### What existing transformation can naturally lead into it?

### What products should NOT be attached because they solve the same situation?

This prevents artificial upselling.

The customer journey creates the commercial relationship.

------------------------------------------------------------------------

# 24. DUPLICATE / OVERLAP TEST

Two products cannot own the same situation nucleus.

If two concepts appear to overlap:

1.  compare situation
2.  compare trigger
3.  compare customer
4.  compare desired transformation
5.  compare mechanism
6.  compare journey position

Then classify:

-   merge
-   module
-   marketing angle
-   upsell
-   bundle
-   distinct product

Do not create duplicate products simply because the titles differ.

------------------------------------------------------------------------

# 25. SCOPE-DRIFT TEST

Before every publish:

> Remove the product title.

Then compare the actual contents against the approved situation record.

If the content now solves a different problem, the product has drifted.

Example:

A wardrobe product may reference physical recovery, but it must not
silently become a recovery product.

A sleep-coordination product may discuss exhaustion, but it must not
silently become a mental-health treatment.

A C-section product may discuss scar confidence, but it must not
silently become a surgical rehabilitation program.

The product owns its approved transformation.

------------------------------------------------------------------------

# 26. TSM STANDARD

TSM is not engagement.

Not:

-   pages read
-   videos watched
-   completion percentage
-   downloads
-   quiz score

Those are usage signals.

TSM measures the customer's actual before → after movement.

Every TSM must define:

1.  baseline
2.  measurable indicators
3.  check-in schedule
4.  success threshold
5.  measurement method
6.  interpretation of incomplete progress
7.  next action

Default check-ins may be:

**Day 0 → Day 7 → Day 14 → Day 30**

but the transformation may require another schedule.

------------------------------------------------------------------------

# 27. PRODUCT COMPLETION STANDARD

A customer does not "complete" a product merely because they reached the
final page.

Completion means:

-   intended actions attempted
-   system implemented
-   TSM measured
-   remaining gap identified
-   maintenance plan activated
-   next situation identified

The final experience should answer:

> **Did your situation actually change?**

------------------------------------------------------------------------

# 28. THE FACTORY'S CANONICAL FLOW

``` text
RESEARCH
   ↓
RESEARCH FINDING
   ↓
DISPOSITION
   ├── Marketing angle
   ├── Module
   ├── Bonus
   ├── Lead magnet
   ├── Upsell
   ├── Bundle
   ├── Entry product
   ├── Supporting asset
   ├── Future research
   └── Transformation candidate
             ↓
      SITUATION GATE
             ↓
     TRANSFORMATION SPEC
             ↓
       TRANSFORMATION GATE
             ↓
       PRODUCT SCHEMA
             ↓
       ASSET ENGINE
             ↓
         PRODUCT BUILD
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
       PUBLISH MANIFEST
             ↓
          WORDPRESS
             ↓
        LIVE PRODUCT
             ↓
        TSM EVIDENCE
             ↓
      JOURNEY INTELLIGENCE
             ↓
       NEXT SITUATION
```

------------------------------------------------------------------------

# 29. WHAT THIS STANDARD PREVENTS

It prevents:

-   PDF-first creation
-   broad-topic products
-   catchy-name masking
-   duplicate products
-   product scope drift
-   unsupported claims
-   products without measurable transformation
-   products that collapse on bad days
-   beautiful products with no implementation
-   products that have no next step
-   orphaned research
-   random upsells
-   disconnected product catalogues
-   builder self-approval
-   manual WordPress reconstruction
-   publishing incomplete products

------------------------------------------------------------------------

# 30. THE FIVE SYSTEMS --- FINAL DEFINITION

## 1. TRANSFORMATION SPECIFICATION

Defines:

**WHO + SITUATION + BEFORE + AFTER + MECHANISM + PATH + FAILURE + FIRST
WIN + TSM + MAINTENANCE + NEXT**

It answers:

> **What transformation are we actually delivering?**

------------------------------------------------------------------------

## 2. PRODUCT SCHEMA

Defines:

**PRODUCT IDENTITY + ROLE + TRANSFORMATION + ASSET MAP + CONTENT +
COMMERCE + DESIGN + EVIDENCE + SAFETY + QA + PUBLISHING**

It answers:

> **What exactly are we building for the customer?**

------------------------------------------------------------------------

## 3. DESIGN SYSTEM

Defines:

**BRAND TOKENS + EXPERIENCE MODES + COMPONENTS + RESPONSIVE RULES +
ACCESSIBILITY + PRODUCT-SPECIFIC EXPRESSION**

It answers:

> **How should the experience look and behave without every product
> becoming a new design project?**

------------------------------------------------------------------------

## 4. ACCEPTANCE TESTS

Defines:

**DETERMINISTIC TESTS + AI JUDGMENT TESTS + SEVERITY + REQUIRED OUTPUT**

It answers:

> **Is this actually good enough?**

------------------------------------------------------------------------

## 5. PUBLISHING GATES

Defines:

**STATE MACHINE + BLOCKING CONDITIONS + HUMAN AUTHORITY + PUBLISH
MANIFEST**

It answers:

> **Is this allowed to go live?**

------------------------------------------------------------------------

# 31. THE CO-FOUNDER RULE

The factory should be ruthless about one thing:

> **We do not manufacture products because we found an interesting
> topic.**

We manufacture a customer experience because we found a meaningful
transformation.

And we do not throw away research because it failed to become that
transformation.

We ask:

> **Where does this knowledge create the most value inside the
> ecosystem?**

That is the difference between a digital-product shop and the **Life
Transformation Engine**.

------------------------------------------------------------------------

# 32. IMPLEMENTATION STATUS

This document formalizes the five systems at the architectural level.

It does NOT claim that every implementation artifact already exists.

The next implementation step is to convert these contracts into actual
files:

``` text
/schemas/
  transformation.schema.json
  product.schema.json
  asset.schema.json
  publish-manifest.schema.json

/standards/
  transformation-standard.md
  product-standard.md
  design-system.md
  acceptance-tests.md
  publishing-gates.md

/agents/
  researcher.md
  validator.md
  transformation-architect.md
  product-architect.md
  builder.md
  qa.md
  publisher.md
```

Those should be generated only after the existing
platform/theme/engineering files are reconciled against this canonical
standard.

**This document is the source-of-truth design.**
