# SWIIPT — IMPLEMENT THE WRITING / GENERATION CONTROL LAYER

You are working on the Swiipt Transformation Product Factory.

I am giving you the document:

**Swiipt Writing / Generation Control Layer V1**

Treat that document as the authoritative specification for the layer you are about to implement.

## YOUR JOB

Implement the Writing / Generation Control Layer described in the document.

Do NOT redesign the Swiipt product factory.

Do NOT create a new product-creation methodology.

Do NOT rewrite or replace the existing:

- Transformation Product Factory Standard V1
- Transformation Specification
- Product Schema
- Design System
- Acceptance Tests
- Publishing Gates

The Writing / Generation Control Layer is an **execution layer inside the existing factory**.

Its purpose is to control how an LLM turns an already-approved transformation/product specification into the actual product.

---

# FIRST: INSPECT BEFORE CHANGING ANYTHING

Before writing or modifying code, inspect the existing repository thoroughly.

Find and understand:

1. Transformation Specification
2. Product Schema
3. Product Factory workflow
4. Product-generation prompts/templates
5. Product validation system
6. Acceptance Tests
7. Publishing Gates
8. Design System
9. Product metadata/schema
10. Existing model integrations
11. Existing research/knowledge inputs
12. Existing interactive-product system
13. Existing delivery-format system
14. Existing WordPress publishing pipeline
15. Existing versioning/configuration system

Create an internal map of:

```text
EXISTING SYSTEM
        ↓
WHERE WRITING CONTROL FITS
        ↓
WHAT ALREADY EXISTS
        ↓
WHAT THIS LAYER NEEDS TO ADD

Do not duplicate functionality that already exists.

SECOND: READ THE WRITING CONTROL DOCUMENT AS AN EXECUTION SPECIFICATION

The document is not merely documentation.

Extract from it the actual rules the generation system must enforce.

You must implement the following concepts where applicable:

Swiipt Writing Constitution
NEVER rules
ALWAYS rules
Customer-Situation Lock
Transformation Lock
Scope-Drift Protection
Architecture Before Prose
Module Job requirement
Action-over-information rule
First-Win rule
Failure-Point Writing
Rescue Protocol Standard
Product-Specific Voice Specification
Evidence Preservation
Anti-Hallucination rules
Repetition Control
Heading Control
Bullet Control
Content Density
Multi-Format Consistency
Interactive Content generation
Controlled Generation Passes
Generator/Critic separation
Targeted Revision
Change Control
Generation Manifest
Versioning
Stop Conditions
Final Generator Self-Check

Do not simply create a large prompt containing these words.

Where the existing architecture supports structured configuration, validation or schemas, implement these as structured controls.

THIRD: THE MOST IMPORTANT ARCHITECTURAL RULE

The flow must become:

APPROVED PRODUCT
↓
TRANSFORMATION SPECIFICATION
↓
PRODUCT SCHEMA
↓
PRODUCT ARCHITECTURE
↓
WRITING / GENERATION CONTROL
↓
GENERATION
↓
GENERATOR SELF-CHECK
↓
TRANSFORMATION QA
↓
ACCEPTANCE TESTS
↓
PUBLISHING GATES

The Writing / Generation Control Layer must NOT become another validation system competing with Acceptance Tests.

It controls generation.

Acceptance Tests remain the authoritative quality gate.

Publishing Gates remain the authoritative publishing gate.

FOURTH: GENERATION MUST BE CONTRACT-DRIVEN

The generator must never receive only:

"Write a product about X."

It should receive a structured generation context containing the approved information available from the existing factory.

At minimum, where applicable:

Transformation Specification
Product Schema
Approved Research / Knowledge
Product Architecture
Required Assets
Evidence Requirements
Safety Requirements
Delivery Formats
Swiipt Writing Constitution
Product-Specific Voice Specification
Anti-AI Rules

The generator must execute these inputs rather than inventing missing decisions.

FIFTH: DO NOT LET THE MODEL GUESS

If required information is missing, conflicting or unsafe, the generation system must flag it.

Use structured statuses such as:

MISSING
FLAG
SOURCE_REQUIRED
HUMAN_REVIEW
SCOPE_DRIFT
UPSTREAM_CONTRACT_CHANGE_REQUIRED

Do not silently invent:

statistics
research
citations
testimonials
customer stories
experts
medical claims
financial claims
legal claims
transformation results
guarantees
product benefits
SIXTH: CONTROLLED GENERATION

Implement the generation process as controlled passes rather than one unrestricted generation request.

The intended sequence is:

PASS 1

Contract ingestion

PASS 2

Architecture check

PASS 3

Content generation

PASS 4

Implementation-asset generation

PASS 5

Voice pass

PASS 6

Anti-AI pass

PASS 7

Transformation QA handoff

The exact implementation should follow the existing architecture rather than blindly creating seven separate systems if the repository already has equivalent capabilities.

SEVENTH: GENERATOR AND CRITIC MUST BE SEPARATE

Where the current infrastructure allows it:

GENERATOR

Creates/revises the product.

CRITIC

Attempts to find problems.

The critic should be able to identify:

PASS
FAIL
WARNING
MISSING
UNSUPPORTED
SCOPE_DRIFT
TRANSFORMATION_WEAKNESS
WRITING_QUALITY_ISSUE
SAFETY_ISSUE

The generator then performs targeted revision.

Do not make the generator simply declare:

"The product is good."

EIGHTH: PROTECT THE TRANSFORMATION

The system must never allow a writing revision to silently change:

customer
situation
before-state
desired state
mechanism
TSM
product role
evidence position
safety boundary

If a change would affect any of these, flag it as an upstream change.

NINTH: PROTECT SWIIPT'S WRITING IDENTITY

The purpose is not merely to prevent bad grammar.

The system must prevent the factory from producing thousands of generic AI-looking products.

The output should consistently feel:

intelligent
practical
specific
direct
warm
emotionally aware
realistic
useful
human

The model must avoid generic AI/self-help language, filler, fake empathy, excessive headings, excessive bullet lists, repetitive summaries and manufactured emotion as defined in the supplied document.

TENTH: DO NOT OVER-ENGINEER

Do not create:

another CMS
another product factory
another Product Schema
another acceptance framework
another publishing system
unnecessary microservices
unnecessary infrastructure
unnecessary databases
unnecessary abstractions

Reuse the existing Swiipt architecture wherever possible.

ELEVENTH: IMPLEMENTATION PROCESS

Work in this order:

STEP 1

Inspect the repository.

STEP 2

Map the existing architecture.

STEP 3

Identify exactly where the Writing / Generation Control Layer belongs.

STEP 4

Identify existing functionality that can be reused.

STEP 5

Identify the genuinely missing implementation pieces.

STEP 6

Implement those pieces.

STEP 7

Integrate them into the existing product factory.

STEP 8

Create/update only the necessary configuration, schemas, prompts, services and UI.

STEP 9

Run the existing tests.

STEP 10

Create tests specifically for the Writing / Generation Control Layer.

STEP 11

Run a real sample product through the complete generation flow.

STEP 12

Show me exactly what was generated, what controls were applied, and what QA detected.

TWELFTH: DO NOT CLAIM SUCCESS PREMATURELY

Do not tell me:

"The Writing / Generation Control Layer is implemented"

until you have actually:

inspected the existing system;
integrated the layer;
executed the generation flow;
tested it;
verified that the existing factory still works;
demonstrated that the generated product respects the controls.

If something cannot be implemented because the existing architecture is missing a dependency, tell me exactly what is missing.

Do not work around it by inventing a parallel architecture.

FINAL PRINCIPLE

The purpose of this work is to make the Swiipt factory capable of producing:

100 products
→ 1,000 products
→ 10,000 products
→ 100,000+ products

without the quality degrading into:

AI writes ebook
→ grammar check
→ PDF
→ publish

The factory must instead produce:

APPROVED TRANSFORMATION
        ↓
APPROVED PRODUCT CONTRACT
        ↓
CONTROLLED GENERATION
        ↓
REAL IMPLEMENTATION ASSETS
        ↓
TRANSFORMATION-AWARE QA
        ↓
ACCEPTANCE TESTS
        ↓
PUBLISHING GATES
        ↓
SWIIPT PRODUCT

Now inspect the existing Swiipt repository and implement the Writing / Generation Control Layer V1.
Do not ask me to redesign the architecture before you inspect what already exists.
Do not create a second factory.


**That is the prompt I would use.** The important part is that it tells the LLM **the document is an execution execution specification, where it sits, what it is forbidden to change, and that it must inspect your existing factory before implementing anything.**