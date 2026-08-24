# Product Factory — Holistic Understanding Report

*Prepared by Claude (OpenCode) · 2026-08-24 · After reading: AGENT_REACH_SETUP_GUIDE.md,
prompt.md, followup.md, MEMORY.md, pipeline.md, Swiipt_Transformation_Product_Factory_Standard_v1.md,
Life Area Market-Breakdown Method.md, sample Postpartum Library reports, specs tree.*

---

## 1 · THE OLD MANUAL PROCESS (as I understand it — correct me where wrong)

```
STEP 1  Life Area Market-Breakdown (the method file)
        Broad area → submarkets → specific situations → person → trigger
        → failed attempt/constraint → emotional stake → desired transformation
        Output: one breakdown doc per life area   (Product Pipeline/Life areas/*.md — 27 areas + method)

STEP 2  Per-submarket research run (prompt.md + followup.md)
        prompt.md  = 6-stage framework: niche generation → survival-pain test
                     (urgency/embarrassment/failed attempts/budget/repeat pain, 3-of-5 to pass)
                     → validation → transformation definition → product outline → ad angles
        followup.md = run instructions: one focus market at a time, EVERY submarket under it,
                     NO caps on niches, library-role reframe (5 outcomes), save ONE REPORT FILE
                     PER SUBMARKET before moving to the next focus market
        Output: Product Pipeline/Postpartum Library/*.md — 21 territory reports
                (SLEEP DEPRIVATION.md alone holds ~17 niches across 4 submarkets,
                 each with research base/citations gathered via Agent Reach/websearch/Reddit)

STEP 3  Manual move to Claude Code → product files (V01–V21)

STEP 4  Naming audit + validation scoring (MEMORY.md record)
        Naming principle LOCKED: `Situation + catchy phrase` ✅ NOT `Topic + catchy phrase` ❌
        Test: remove the title — can you still name the exact woman/moment/problem/
              failed attempt/fear/want? If no → not scoped.
        Verdicts: 7 pass, 8 fail→renamed, 4 repackage; scores 57–88; flagships ≥80 = V06/V14/V03/V12/V05/V19
        Drift corrections caught: PP-01 door redefinition, PP-02B name theft, PP-02 M3 leak, PP-03 B1-C loss

STEP 5  Specs (specs/) → 11-section standard (Identity…Before…After…Mechanism…Path…
        Assets…Failure map…First win ≤15 min…TSM…Re-entry…Next transformation)
        V06 = fully built reference product (13 parts, locked v6.2, safety decisions locked)

STEP 6  Publication gate: Specified → Drafted → Clinically reviewed → Consistency-checked
        → Rendered → Customer-journey tested → Publish-ready
        Gate N (evidence labels) + Gate O (clinical review) — owner-only clears
        Evidence rules: crisis list real numbers only, never invented clinical thresholds,
        MODEL INFERENCE labels, no fabricated testimonials

STEP 7  Manual ingestion to WordPress (OpenCode + Novamira execute-php)
        trans → tsystem → Woo product → assets generated → access verified
        Live today: PP-01/02/02B/03 (#71/#74/#77/#80), V06 (#86)
```

**The pain you identified:** every arrow between steps is a manual copy/move/reformat.
Research lives in chat windows and md reports; products live in Claude folders; WordPress gets
rebuilt by hand. That fragmentation is what the factory eliminates.

---

## 2 · THE TARGET FACTORY (pipeline.md + Standard v1 — synthesized)

### Core design decision
**One canonical structured Product Record** is the single source of truth — never the LLM
conversation ("do NOT make the LLM the database"), never loose md reports. Git is the ledger.

### The five formalized systems (Standard v1)
| System | What it locks |
|---|---|
| 1 · Transformation Specification | Canonical JSON: situation hierarchy → before/after/mechanism/path/failure-map/first-win/TSM/maintenance/next |
| 2 · Product Schema | Canonical JSON: identity/commercial_role/customer/transformation/tsm/asset_map/content/commerce/design/evidence/safety/qa/publishing |
| 3 · Design System | Brand tokens (already live in swt-tokens.css!) + 5 experience modes (Editorial/Functional/Interactive/Sensitive/Utility) + canonical components + non-negotiables |
| 4 · Acceptance Tests | Deterministic (schema/content/assets/build/UX/a11y/commerce/platform) + AI tests A–R (incl. mandatory R = drift test) + severity model (BLOCKER/MAJOR/MINOR/OBSERVATION) + reviewer ≠ builder |
| 5 · Publishing Gates | State machine (RESEARCH→…→MONITORED, can move backward) + Gates 0–10 + immutable publish manifest; publisher refuses incomplete |

### Key philosophy locks
- **No-research-wasted rule:** 13 library roles (standalone → lead magnet → journey node →
  evidence gap). Terminal state is RETAINED + ASSIGNED ROLE, never discard. This kills MVP thinking.
- **Transformation quality ≠ commercial role.**
- **Human authority retained:** boundary decisions, medical approval, claims, pricing, publish override.
- **Agent Reach = research capability inside the Research Agent**, never the pipeline itself.
- **n8n never becomes the brain.**

### Orchestration shape
```
OpenCode (orchestrator, @lfe-* agents)
   ├─ researcher     → Agent Reach + web → opportunity.json
   ├─ validator      → gates 0–2       → VALIDATION_STATUS
   ├─ selector       → portfolio score → BUILD_PRIORITY (selection never destroys the queue)
   ├─ transformation-architect → transformation.json
   ├─ product-architect/asset engine → format by customer job (READ/DO/DECIDE/TRACK/CALCULATE/COMMUNICATE/RESCUE/RE-ENTER/MAINTAIN/REMEMBER)
   ├─ copywriter     → generated FROM the record (landing/product/faq/specs/deliverables/seo.json)
   ├─ builder        → builds into /products/<ID>/ (Ox Alpha primary, Claude optional fallback)
   ├─ qa             → deterministic + AI tests
   └─ publisher      → LFE Publisher MCP → WordPress bridge → LIVE
```

---

## 3 · WHAT ALREADY EXISTS ON THE LIVE PLATFORM (reusable for the factory)

Much of the "LFE Publisher" destination layer is ALREADY BUILT in swiipt-core:

| Factory need | Already exists on swiipt.com |
|---|---|
| Knowledge containers | CPTs `swiipt_trans`, `swiipt_tsystem`, `swiipt_ckd`, `swiipt_atu`; tables `ckd_versions`, `transformation_atus`, `atu_ckd_sources` |
| Discovery queue | `swiipt_discovery_candidates` (scored, verdicts diagnostic/content/product; hidden-market candidates ingested) |
| Situation graph | `swiipt_situation` posts (1605) + `swiipt_situation_transformations` + edges + libraries taxonomy (24 areas × territories) |
| Asset engine | delivery.php: content → html/pdf/svg/txt/flipbook instances + interactive tool widgets (`[[TOOL:*]]`) — format-by-job already operational |
| Commerce/publish | product↔TS link table, order→access grants, downloads attach, `_swiipt_prices` multi-currency |
| QA/gates | knowledge.php expert-reviewer workflow (`in_review→clinical_review→approved`), evidence-label enforcement, rescue/failure-point metaboxes, review queue + audit logs |
| Content factory seed | evidence.php flag-gated trans→TS auto-build + review queueing |
| Authenticated write path | Novamira abilities (execute-php etc.) — the practical precursor to Publisher-MCP tools |

**Conclusion: the factory does not face an empty platform. It faces a platform whose
destination half is built. What's missing is the SOURCE half** (§32 of Standard v1):
`schemas/`, `standards/`, `agents/` definition files, the `/data/` product-record store,
and the research-agent harness that turns prompt.md+followup.md+Agent Reach runs into
structured opportunity records instead of prose reports.

---

## 4 · GAPS → CONCRETE NEXT ARTIFACTS (proposed build order)

1. **Schemas first** (machine-checkable): `transformation.schema.json`,
   `product.schema.json`, `opportunity.schema.json`, `asset.schema.json`,
   `publish-manifest.schema.json` — derived strictly from Standard v1 §5/§7/§20.
2. **Standards files**: extract from MEMORY.md + guideline into
   `standards/{research,validation,transformation,product,copy,design,qa,safety}-standard.md`.
3. **Agents**: define `@lfe-researcher/validator/selector/transformation-architect/product-architect/copywriter/builder/qa/publisher` contracts (tools-scoped).
4. **Record store**: `/data/libraries|situations|transformations|products/<ID>/product.manifest.json`
   + git init as the product ledger.
5. **Research harness**: wrap prompt.md (6-stage) + followup.md (per-submarket, uncapped,
   library-role reframe) + Market-Breakdown Method into the @lfe-researcher agent spec so its
   OUTPUT is `opportunity.json` (+ the human-readable report as a by-product, not the source of truth).
6. **Publisher bridge**: register high-level WP abilities (validate_manifest / create_product /
   create_transformation / attach_assets / publish_product) — thin wrappers over existing
   swiipt-core functions; reuse Novamira auth.
7. **Backfill**: convert existing validated IP (21 V-products + PP portfolio + 59-entry extraction)
   into product/opportunity records so nothing starts from zero.

---

## 5 · HOUSEKEEPING NOTES (flagged during this read)

- **Duplication:** `Products/` and `Product Pipeline/` overlap heavily — V06 parts exist in BOTH
  `Products/V06/` and `Product Pipeline/V06/` AND `Products/specs/V06/`; specs exist in both
  `Products/specs/` and `Pipeline/specs/` (with drift risk: Pipeline/specs has V22.md + V06-fix.md
  which root copies lack); extraction + product2 also duplicated. Consolidation decision pending
  with owner — recommend `Product Pipeline/` becomes the canonical home (it matches the factory),
  root `Products/` folds in, single source per document, drift-risk copies diffed then merged.
- **MEMORY.md path references** point to the old working folder
  (`C:\Users\User\Desktop\transformation products\`) — update after consolidation.
- **Naming/version discipline** already proven valuable (drift corrections PP-01/02B/02/03) —
  Standard test R makes it enforceable.

---

## 6 · CONFIRMATION OF UNDERSTANDING (one paragraph)

Swiipt is a library-building machine, not an MVP shop. Research is never discarded — every finding
gets one of 13 roles. Products are assembled only from validated transformations whose situations
survive the strictest scoping discipline (person/timeframe/trigger/failed-attempt/stake — provable
with the title removed), named as `situation + catchy phrase`, gated by TSM-before-publication,
evidence honesty, and clinical-safety boundaries. The old process ran this discipline manually across
three disconnected environments; the factory turns the same discipline into structured records +
state machine + deterministic/AI gates + specialized agents, with OpenCode orchestrating, Ox Alpha
building, and WordPress consuming immutable publish manifests. The platform's destination layer
(transformation/system/asset/commerce/review infrastructure) is already live; the work now is the
source layer: schemas, standards, agents, record store, and the research harness.
