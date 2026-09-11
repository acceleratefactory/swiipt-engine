# Swiipt Transformation Interactive Engine
## Product & Engineering Build Specification — v1.0

### Purpose

Build the reusable interactive delivery layer of the Swiipt Transformation Engine.

This is **not** a generic checklist app, habit tracker, dashboard, or standalone SaaS product. It is a reusable product-delivery engine that turns the operational parts of Swiipt transformation products into interactive experiences.

Swiipt supports:

- Read as Magazine
- Read
- PDF
- Image
- Read Aloud
- **Interactive**

The Interactive layer exists for work that is inherently better performed by software:

**DO / DECIDE / TRACK / RESCUE / COMMUNICATE**

The engine must be reusable across many transformation products and driven by product configuration/schema rather than hard-coded for one product.

---

# 1. PRODUCT PRINCIPLE

Do **not** turn the PDF into an app.

Each delivery mode has a distinct job:

| Delivery | Primary job |
|---|---|
| Magazine | Understand, explore, emotionally engage |
| Read | Learn structured material |
| PDF | Download/offline/reference |
| Image | Remember quickly |
| Read Aloud | Consume hands-free |
| Interactive | **Act, decide, track, recover, communicate** |

The Interactive Engine should therefore answer:

> **What does the customer need to DO right now?**

It should not duplicate educational content unnecessarily.

---

# 2. REFERENCE IMPLEMENTATION: CORD CARE

The first implementation should demonstrate the architecture using the newborn cord-care transformation product.

Its interactive assets include:

- daily routine
- decision tree
- daily tracker
- timeline tracker
- house-rule card
- rescue/red-flag card
- family script cards
- milestones
- TSM/completion checks

**Do not hard-code clinical claims or rules into the engine.** Those belong to versioned product content/configuration and must be reviewable.

The engine provides the interaction mechanics.

---

# 3. PRIMARY EXPERIENCE

## TODAY

The customer opens the product and immediately sees the most relevant action for their current state.

Example:

**Day 7**

Today's routine:

- Wash hands
- Clean only if soiled
- Pat dry
- Fold nappy below stump
- Perform check

Progress: **4 / 5**

Then:

**Everything normal?**

- Yes
- Something changed

Completion updates the tracker automatically.

The customer should never need to search through the product to perform the core action.

---

# 4. CHECK / DECISION ENGINE

A real decision engine, not a static image.

Example:

**What changed?**

Q1 — Is the baby unwell?

- YES → configured urgent/emergency pathway
- NO → Q2

Q2 — Is the surrounding skin abnormal?

- YES → configured pathway
- NO → Q3

Q3 — What does the stump look like?

→ configured outcomes.

The engine must support:

- branching questions
- conditional paths
- outcome states
- severity levels
- action instructions
- content references
- emergency/urgent notices
- event logging
- restart
- back
- answer review

Every terminal node must have a defined outcome.

The product configuration owns the actual decision content.

---

# 5. TRACKER ENGINE

Trackers must be genuinely interactive.

Support:

- date/time
- checkboxes
- numeric values
- selections
- notes
- photos
- events
- milestones
- incidents
- completion states

Timestamp entries automatically.

Allow editing while preserving appropriate history/audit information.

---

# 6. PHOTO LOG

Optional product component.

Support:

- camera/upload
- timestamp
- note
- category/tag
- before/after grouping
- comparison where appropriate
- deletion
- privacy-conscious storage

Do not enable it unless the product requires it.

---

# 7. DAILY PLAN ENGINE

Products may define day-by-day sequences.

Support:

- relative day numbers
- absolute dates where needed
- missed days
- skipped actions
- catch-up rules
- rescue/restart logic
- milestones
- completion criteria

A missed day must not automatically be treated as failure.

The product defines what recovery means.

---

# 8. RESCUE ENGINE

Failure is an expected state.

Support rescue states such as:

- missed today's action
- did the wrong thing
- family member interfered
- overwhelmed
- stopped using the product
- fell behind
- situation changed

Provide a persistent entry such as:

**I'm stuck**

or

**Something went wrong**

A rescue flow can contain:

1. Immediate action
2. What NOT to do
3. Reset
4. Next action
5. Escalation criteria
6. Relevant script
7. Restart point

The product defines these rules.

---

# 9. SCRIPT CARD ENGINE

Turn communication assets into interactive cards.

Example:

**Grandma wants to apply something**

Show:

- situation
- recommended script
- shorter version
- Copy
- Share
- Read Aloud

Other possible situations:

- partner will not cooperate
- helper ignored the house rule
- someone already did something
- user needs to explain a decision
- user needs to ask for help

Scripts are product content; the engine provides presentation/actions.

---

# 10. PROGRESS ENGINE

Progress must measure meaningful transformation behavior.

Do not optimize for:

- pages opened
- time in app
- click count
- arbitrary streaks

Support metrics such as:

- adherence
- milestone completion
- decision competence
- rescue completion
- behavior change
- confidence
- TSM measurements

The product schema defines the TSM.

The engine only captures, stores and displays it.

---

# 11. CUSTOMER STATE

Maintain structured current state, for example:

```text
product_state:
  product_id
  customer_id
  start_date
  current_stage
  current_day
  milestones_completed
  active_risks
  open_rescue_states
  tracker_summary
  tsm_measurements
  last_activity
```

This state drives the Today experience.

Do not put all application state into one unstructured JSON blob.

---

# 12. JOURNEY GRAPH INTEGRATION

The Interactive Engine consumes the broader Customer Journey Graph; it does not replace it.

Example:

```text
NEWBORN_CORD_CARE_ACTIVE
        ↓
Normal daily care
        ↓
Separation
        ↓
Post-separation healing
        ↓
Completed transformation
```

A concern may create:

```text
Normal care
    ↓
Concern detected
    ↓
Decision flow
    ↓
Configured urgent pathway
```

The engine must support state transitions defined by product/journey configuration.

It must never invent clinical truth.

---

# 13. PRODUCT CONFIGURATION

The engine must be schema-driven.

Conceptual example:

```json
{
  "product_id": "cord-care-guide",
  "interactive": {
    "today": true,
    "check": true,
    "tracker": true,
    "photo_log": true,
    "rescue": true,
    "scripts": true,
    "progress": true,
    "milestones": true
  }
}
```

This is illustrative only. The final production structure must align with the canonical Product Schema.

A product must be able to declare its interactive components without modifying core application code.

---

# 14. COMPONENT REGISTRY

Minimum reusable component registry:

```text
TodayPlan
Checklist
DecisionTree
Tracker
DailyLog
Timeline
PhotoLog
Milestone
Progress
RescueFlow
ScriptCard
QuickCard
Reflection
TSMMeasurement
ResourceLink
ShareAction
ExportAction
```

Every component requires:

- stable ID
- configuration schema
- validation
- rendering
- responsive behavior
- accessibility behavior
- state handling
- error handling
- analytics events where appropriate

---

# 15. COMPONENT COMPOSITION

Example:

```text
CORD CARE
│
├── Today
│   ├── DailyChecklist
│   ├── QuickCheck
│   └── Progress
│
├── Check
│   └── CordDecisionTree
│
├── Track
│   ├── DailyLog
│   ├── IncidentLog
│   ├── PhotoLog
│   └── SeparationTimeline
│
├── Rescue
│   └── RedFlagRescueFlow
│
├── Family
│   └── ScriptCards
│
└── Progress
    ├── Milestones
    └── TSM
```

A second product must be able to compose a different set without cloning the application.

---

# 16. MOBILE-FIRST UX

Primary environment: mobile.

Design for:

- one-handed use
- large tap targets
- minimal typing
- short screens
- low cognitive load
- fast loading
- weak connectivity where possible
- accessibility

Do not build a desktop dashboard and shrink it.

Desktop is secondary.

---

# 17. UI RULES

Every operational screen should answer:

1. Where am I?
2. What do I need to do?
3. What happens if I tap this?
4. What do I do if something goes wrong?

Avoid:

- dense dashboards
- unnecessary charts
- excessive animation
- decorative UI
- unnecessary settings
- generic productivity language
- fake AI assistants
- unnecessary social features
- excessive gamification

The interface should feel calm, trustworthy and purposeful.

---

# 18. ACCESSIBILITY

Support:

- semantic HTML
- keyboard navigation
- screen readers
- sufficient contrast
- visible focus
- large touch targets
- reduced motion
- readable typography
- non-color-only states
- accessible labels
- useful error messages

Read Aloud remains a separate delivery mode but may be invoked from interactive cards.

---

# 19. OFFLINE / NETWORK

Where safe and appropriate:

- cache product configuration
- cache essential content
- allow core checklists offline
- queue non-critical writes
- sync when online
- show sync state

Never imply that cached safety-critical medical content is current if it may be outdated.

Version-sensitive content must expose its version/date.

---

# 20. DATA MODEL

Keep separate concepts:

### Product definition
What the product contains.

### User state
What this customer has done.

### Event history
What happened and when.

### Content version
Which product version was used.

### TSM measurements
Transformation measurements.

### Journey state
Where the customer is in the broader journey.

Do not collapse these into one unstructured object.

---

# 21. SECURITY / PRIVACY

Because some transformation products may contain sensitive information:

- authenticate appropriately
- authorize every protected resource
- isolate customer records
- validate server-side
- protect uploaded media
- use secure private-media URLs
- allow deletion
- minimize collected data
- log administrative changes
- avoid unnecessary third-party transmission

Health-related products require stricter data minimization and review.

---

# 22. HIGH-STAKES / MEDICAL PRODUCTS

The Cord Care example is health-related.

The engine must **never generate medical recommendations**.

Clinical rules come from approved product content.

Every medical decision flow should support:

- evidence/source metadata
- content version
- clinical review status
- reviewer information where required
- review date
- escalation language
- emergency pathway
- update/withdrawal capability

The publishing system must be able to block a medical product whose required review is incomplete.

---

# 23. ANALYTICS

Useful events include:

```text
interactive_opened
today_started
checklist_completed
decision_started
decision_completed
rescue_started
rescue_completed
tracker_entry_created
script_copied
script_shared
milestone_completed
tsm_measurement_recorded
product_completed
```

No vanity analytics.

Analytics must support:

- product improvement
- transformation measurement
- failure-point discovery
- support
- ecosystem decisions

---

# 24. TSM INTEGRATION

Provide reusable TSM measurement functionality.

Example:

```text
Baseline: Confidence 3/10
Day 7:     Confidence 6/10
Day 14:    Confidence 8/10
```

The actual metric belongs to the product.

The engine provides:

- baseline capture
- scheduled measurement
- storage
- progress display
- comparison
- completion state

Never invent a TSM.

A product without an acceptable TSM should fail the product acceptance gate.

---

# 25. EXPORTS

Where useful, support export of:

- tracker history
- timeline
- notes
- selected photos
- completion summary
- TSM results

A doctor-ready summary may be useful for health products, but must distinguish recorded observations from medical interpretation.

---

# 26. NOTIFICATIONS

Product-configurable:

- daily reminders
- milestone reminders
- TSM reminders
- rescue follow-ups

Users must control notification preferences.

Avoid notification spam.

---

# 27. CONTENT / CODE SEPARATION

Never hard-code product-specific prose or clinical logic.

Bad:

```typescript
if (cordLooksRed) {
  return "Go to hospital";
}
```

Good:

```typescript
return evaluateDecisionNode({
  nodeId: "cord_skin_redness"
});
```

The product configuration owns the node and approved outcome.

This separation is mandatory for scaling the library.

---

# 28. INTERNAL PRODUCT AUTHORING

The Product Factory must eventually be able to create interactive products through structured configuration.

The product definition should include:

- identity
- customer situation
- transformation
- journey state
- interactive components
- content references
- decision trees
- trackers
- rescue flows
- scripts
- milestones
- TSM
- version
- review status
- publishing status

The Product Factory generates the definition.

The frontend renders it.

---

# 29. VALIDATION

Before an interactive product can run, validate:

### Schema
All required fields exist.

### References
All components/content references resolve.

### Decision trees
- no broken nodes
- no unintended unreachable required nodes
- no infinite loops
- every terminal node has an outcome

### Trackers
Fields have valid types and constraints.

### TSM
Required baseline/measurement definitions exist.

### Rescue
Every declared failure point has a rescue path.

### Accessibility
Required metadata exists.

### Safety
High-stakes products have required review status.

---

# 30. ACCEPTANCE TESTS

Test at four levels.

## A. Deterministic

- schema validation
- routing
- rendering
- state persistence
- calculations
- date logic
- decision traversal
- offline queue/sync
- authorization
- exports

## B. Product

Verify:

- every transformation step has required interactive support
- every declared failure point has a rescue path
- every TSM measurement works
- every milestone works
- every component resolves

## C. UX

Verify:

- core action is immediately discoverable
- core action works without reading everything
- mobile interaction is comfortable
- errors are understandable
- recovery is obvious
- navigation is minimal

## D. AI QA

AI may inspect:

- missing transformation logic
- unclear instructions
- terminology inconsistency
- weak rescue coverage
- duplication
- contradictions
- UX copy
- edge cases

AI QA does **not** replace deterministic, editorial, specialist or clinical review.

---

# 31. PUBLISHING GATE

Rendering successfully is not publication readiness.

Required sequence:

```text
Product specification valid
        ↓
Transformation valid
        ↓
Product schema valid
        ↓
Interactive configuration valid
        ↓
Content references valid
        ↓
Decision flows validated
        ↓
Failure/rescue coverage validated
        ↓
TSM validated
        ↓
Deterministic tests pass
        ↓
AI QA pass
        ↓
Human editorial QA
        ↓
Clinical/specialist review where required
        ↓
Design/accessibility QA
        ↓
Publishing gate
```

---

# 32. REUSABILITY TEST

The first product tests the engine.

After Cord Care, a second product must be buildable by configuration rather than cloning the application.

Examples:

```text
Product A
DailyPlan + Checklist + DecisionTree + Tracker

Product B
Tracker + Milestones + Reflection + TSM

Product C
DecisionTree + RescueFlow + ScriptCards

Product D
Checklist + Timeline + PhotoLog + TSM
```

If Product B requires changing core engine code merely because it is a different product, the architecture has failed.

---

# 33. PLATFORM INTEGRATION

The Interactive Engine is another delivery layer of the existing Swiipt product.

```text
Swiipt Product
│
├── Magazine
├── Read
├── PDF
├── Image
├── Read Aloud
└── Interactive
       ├── Today
       ├── Do
       ├── Decide
       ├── Track
       ├── Rescue
       └── Communicate
```

The customer should experience one coherent product, not six unrelated products.

---

# 34. ECOSYSTEM CONNECTION

A completed transformation can expose state for the broader Transformation Engine to recommend the likely next transformation.

Example:

```text
Cord Care
   ↓
Newborn Daily Routine
   ↓
No-Village First 14 Days
   ↓
Newborn Sleep Organization
   ↓
Postpartum Household Recovery
```

The Interactive Engine does not independently choose the next product.

It exposes completion/current state to the Customer Journey Graph.

---

# 35. DESIGN DIRECTION

Use the existing Swiipt design system.

Do not invent a disconnected application aesthetic.

The Interactive experience should feel native to Swiipt.

Use:

- clear typography
- strong hierarchy
- calm interfaces
- restrained motion
- cards only where useful
- obvious primary actions
- contextual status
- appropriate safety emphasis

Do not turn every element into a card.

Do not over-gamify.

Do not use generic SaaS dashboard styling.

Formal design tokens should cover:

- typography
- spacing
- radius
- elevation
- colors
- status states
- interaction states
- breakpoints
- component dimensions

If authoritative Swiipt tokens already exist, consume them rather than duplicating them.

---

# 36. ENGINEERING DELIVERABLES

Build:

1. Interactive Engine core
2. Component registry
3. Product configuration/schema layer
4. State management
5. Decision-tree engine
6. Checklist engine
7. Tracker engine
8. Daily-plan engine
9. Rescue engine
10. Script-card engine
11. TSM engine
12. Milestone engine
13. Photo-log capability
14. Offline/sync strategy
15. Accessibility layer
16. Analytics
17. Validation engine
18. Test suite
19. Product authoring/configuration interface or API
20. Cord Care reference implementation
21. Documentation for adding new products

---

# 37. BUILD ORDER

### Phase 1 — Foundation
- schema
- state model
- component registry
- rendering architecture
- responsive shell
- validation

### Phase 2 — Core
- Today
- Checklist
- Tracker
- Decision Tree

### Phase 3 — Transformation
- Daily Plan
- Milestones
- Rescue
- TSM

### Phase 4 — Communication
- Script Cards
- Copy/share
- Read Aloud integration

### Phase 5 — Advanced
- Photo Log
- offline/sync
- exports
- notifications

### Phase 6 — Factory integration
- product authoring
- automated validation
- publishing gates
- WordPress/platform integration

---

# 38. NON-GOALS

Do NOT build:

- generic task manager
- generic habit tracker
- social network
- community forum
- generic AI chatbot
- unnecessary gamification
- generic analytics dashboard
- separate SaaS disconnected from Swiipt
- hard-coded product-specific logic

The Interactive Engine exists to deliver transformations.

---

# 39. SUCCESS CRITERION

The target pipeline is:

```text
Research
   ↓
Transformation Specification
   ↓
Product Schema
   ↓
Interactive Configuration
   ↓
Automated Validation
   ↓
Build/render
   ↓
Acceptance Tests
   ↓
Publishing Gates
   ↓
Live
```

The Product Factory generates the product definition.

The Interactive Engine renders and executes it.

Humans review what requires human judgment.

The system rejects incomplete or unsafe products rather than silently publishing them.

---

# 40. FINAL BUILD INSTRUCTION

You are not being asked to make a nice tracker UI.

You are implementing a reusable subsystem of the Swiipt Transformation Engine.

Before writing code:

1. Inspect the existing Swiipt architecture.
2. Inspect the existing Product Schema.
3. Inspect the existing design system.
4. Inspect the existing WordPress integration.
5. Inspect authentication/state/data patterns.
6. Identify what already exists.
7. Do not duplicate existing infrastructure.
8. Produce an implementation plan mapped to the existing architecture.
9. Identify schema/API changes before making them.
10. Implement incrementally.
11. Test each layer.
12. Build Cord Care as the reference implementation.
13. Prove a second hypothetical product can use the same engine without core-code changes.

Do not simplify this into a generic CRUD application.

Do not replace the transformation architecture with a conventional SaaS dashboard.

Do not invent medical logic.

Do not claim completion until acceptance tests pass.

**The goal is not one interactive Cord Care app.**

**The goal is the reusable Interactive Delivery Engine that lets the Swiipt Product Factory continuously produce transformation products across the entire library.**
