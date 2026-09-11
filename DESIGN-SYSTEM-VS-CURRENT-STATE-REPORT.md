# Design System Build Spec vs Current Platform State — Investigation Report

**Date:** 2026-09-02  
**Source:** `Swiipt_Design_System_Scalable_Build_Spec_v1.md` (1691 lines, 54 sections)  
**Audited against:** Live platform (swiipt.com), AGENTS.md, Product Pipeline, theme files

---

## 1. What the Design Spec Requires

The spec defines a **component-based page assembly engine** (not a template system). The core architecture:

```
Design Tokens → Components → Section Types → Page Compositions → Product Configuration → Rendered Page
```

Key non-negotiable rules (§52):
- **Rule 3:** Landing pages have **multiple approved compositions** — not one fixed template.
- **Rule 4:** Single Product Pages use a **highly standardized** information architecture.
- **Rule 5:** **Product data** determines content and appropriate composition.
- **Rule 6:** Components are reusable and schema-driven.
- **Rule 8:** The system must scale without manual page design.

---

## 2. Current State Audit

### What exists (good foundation)

| Asset | Status | Notes |
|---|---|---|
| Design tokens (`swt-tokens.css`) | ✅ Done | Canonical tokens, aliases, self-hosted fonts |
| Component builders (`design-system.php`) | ✅ Done | 21 `swt_ds_*` component builders (callout, card, checklist, etc.) |
| Landing page template (`page-landing.php`) | ✅ Done | Data-driven, 9 sections, reads `_swiipt_landing_content` JSON meta |
| Landing content generator (`gen-content.mjs`) | ✅ Done | Deterministic, produces `landing-page.json` per product |
| Landing content schema (`content-landing.schema.json`) | ✅ Done | Schema with all 9 sections and design fields |
| Landing data helpers (`inc/landing.php`) | ✅ Done | `swt_landing_content()`, `swt_landing_product()`, `swt_landing_icon()` |
| Landing CSS (`swt-landing.css`) | ✅ Done | Scoped `.swt-landing-page` styles |
| Single product page (`woocommerce/single-product.php`) | 🟡 Partial | Has buy box + product details section, but old design; not rebuilt to `single.md` spec |
| Single product page plan (`screenshots/SINGLE_IMPLEMENTATION_PLAN.md`) | ✅ Done | Complete pixel-accurate spec (1436 lines) |
| Single product page reference design (`screenshots/single.md`) | ✅ Done | Full HTML/CSS reference |
| Publisher (`publisher.php`) | ✅ Done | Creates landing pages + products + TS from manifests |
| Content structurer (`content-structurer.php`) | ✅ Done | F1 engine — 9-step content structuring |
| WeasyPrint VPS renderer (`renderer.swiipt.com`) | ✅ Done | Remote PDF generation |
| Ebook formats (`ebook-formats.php`) | ✅ Done | Flipbook, Read, Read-aloud from the tree |
| Interactive app (`interactive-app.php`) | ✅ Done | Client-driven app, config-driven, access-gated |

### What's missing vs the spec

| Spec requirement | Current state | Gap |
|---|---|---|
| **Multiple landing compositions** (§14-16) | One fixed 9-section template (`page-landing.php`) | No composition selection; every product gets the same section order |
| **Composition engine** (§15) | No engine — `gen-content.mjs` produces flat JSON, `page-landing.php` renders all 9 sections unconditionally | No metadata-driven composition selection |
| **Section library** (not all sections always used) | All 9 sections always render (when data exists) | No way to choose Hero-B vs Hero-C, or skip Mechanism section, etc. |
| **Component library used by landing page** | `design-system.php` (21 components) exists but `page-landing.php` does NOT use it — it has its own inline HTML/CSS | Duplicated code; the landing page has its own markup, not reusing the design-system components |
| **Single Product Page standardized** (§28) | Old WooCommerce layout, not rebuilt to `single.md` | The single product page still uses the pre-redesign structure |
| **Product Page Configuration** (§30) | `landing-page.json` has a flat structure; no `page.composition` field | No way to specify composition per product |
| **Composition Selection Rules** (§16) | Not implemented | No engine that chooses sections based on product metadata |
| **Automated design validation** (§39) | Not implemented | No component-level or composition-level validation |
| **Visual quality gates** (§38) | Not implemented | No automated page layout checks |

---

## 3. The Core Problem

The current system has **one fixed composition** (the 9-section V06-inspired layout). Every product gets the same section sequence:

```
Hero → Before → Modules → Before/After → Who For → Promise → Inside → Final CTA → Next
```

The spec wants multiple compositions like:
- **Decision-heavy product:** Hero → Situation → Problem → Decision System → Interactive Demo → How It Works → Proof → CTA
- **Behavior-change product:** Hero → Before/After → Problem → Mechanism → Journey → Tools → Failure/Rescue → Proof → CTA
- **Organization product:** Hero → Situation → Problem → System → Interactive Preview → Modules → Deliverables → CTA

The current `page-landing.php` cannot express any of these — it always renders the 9 sections in a fixed order, regardless of product type.

---

## 4. Path Forward: Two Options

### Option A: Landing Page Composition Engine First

Build the composition engine + section library first, then the single product page.

**Phase 1: Composition Architecture**
- Add `page.landing.composition` field to the product schema
- Define 2-3 approved compositions (initial: "standard" = current 9-section, "decision" = shortened, "behavior_change" = before/after focus)
- Create a composition registry in `inc/landing.php` that maps composition names to section renderers
- Refactor `page-landing.php` to use the composition engine (iterate over composition sections, render each)
- Update `gen-content.mjs` to accept a composition parameter and emit only the relevant sections

**Phase 2: Component Library Integration**
- Make `page-landing.php` sections call `design-system.php` components instead of having their own HTML
- Add section types to the library (Hero, BeforeState, ModuleGrid, BeforeAfter, WhoFor, Promise, Inside, FinalCTA, Next)

**Phase 3: Composition Selection**
- Implement composition selection rules (§16) based on product metadata (transformation_type, risk_level, evidence_level, etc.)
- Auto-recommend composition; manual override in product config

**Phase 4: Single Product Page**
- Rebuild `woocommerce/single-product.php` to the `single.md` spec using the same component library
- Generate `product-page.json` content (already done — `gen-content.mjs` produces it)

### Option B: Single Product Page First

Rebuild the single product page to the `single.md` spec first, then tackle the composition engine.

**Phase 1**: Rebuild `woocommerce/single-product.php` to match the reference design (11 numbered sections + gallery + sticky buy bar)
**Phase 2**: Integrate `product-page.json` content (already generated by factory)
**Phase 3**: Build the landing composition engine
**Phase 4**: Component library integration

---

## 5. Recommendation

### Fix the landing page composition system first.

**Reasons:**

1. **The spec's core innovation is the composition engine** (§15, §52 Rule 3). This is the foundation the single product page also depends on. Without it, every new product type needs a template edit.

2. **The landing page is the primary conversion surface.** Having multiple compositions means better conversion for different product types (decision products need different sections than behavior-change products).

3. **The single product page is more standardized** (§52 Rule 4) — it uses one fixed information architecture. It's simpler to implement once the component library exists.

4. **The single product page already has a complete pixel-accurate plan** (`SINGLE_IMPLEMENTATION_PLAN.md`). It's a known quantity. The composition engine is the novel work.

5. **The component library (`design-system.php`) already exists** with 21 components — it just needs to be wired into the landing page template. This is the first step of the composition engine anyway.

---

## 6. Build Order (Recommended)

### Phase 1 — Composition Architecture (high priority)

| Step | What | Files | Effort |
|---|---|---|---|
| 1.1 | Define 2-3 approved compositions in `content-landing.schema.json` | Add `page.composition` enum field | Small |
| 1.2 | Create composition registry in `inc/landing.php` | `swt_landing_composition($name)` returns section list | Small |
| 1.3 | Refactor `page-landing.php` to iterate composition sections | Replace hardcoded 9-section order with composition loop | Medium |
| 1.4 | Refactor `gen-content.mjs` `genLanding()` to emit composition + sections | Add `page.composition` + `sections` to output | Medium |
| 1.5 | Create 2-3 composition definition files | `compositions/standard.json`, `decision.json`, `behavior-change.json` | Small |
| 1.6 | Regenerate + QA | `gen-content.mjs --all` + `qa-checks.mjs` | Small |

### Phase 2 — Component Library Integration (medium priority)

| Step | What | Files | Effort |
|---|---|---|---|
| 2.1 | Port `page-landing.php` section HTML to `design-system.php` component calls | `inc/landing.php` + `design-system.php` | Medium |
| 2.2 | Add missing section types to component library | `design-system.php` (HeroSection, BeforeStateSection, etc.) | Medium |
| 2.3 | Update `swt-landing.css` to use design-system tokens (already done) | `swt-landing.css` | Small |

### Phase 3 — Composition Selection (lower priority)

| Step | What | Files | Effort |
|---|---|---|---|
| 3.1 | Implement selection rules in `gen-content.mjs` | Add `recommendComposition(p, tr)` based on metadata | Medium |
| 3.2 | Add manual override in product config | `product.json` `page.landing.composition` | Small |

### Phase 4 — Single Product Page (sequential)

| Step | What | Files | Effort |
|---|---|---|---|
| 4.1 | Rebuild `woocommerce/single-product.php` to `single.md` spec | Theme template | Large (~600 lines) |
| 4.2 | Wire `product-page.json` data into the template | Same file | Medium |
| 4.3 | Add single-product CSS (`swt-single.css`) | `assets/css/swt-single.css` | Medium |
| 4.4 | Add product-page helpers (`inc/product-page.php`) | `inc/product-page.php` | Medium |

---

## 7. Timeline Estimate

| Phase | Effort | Dependencies |
|---|---|---|
| Phase 1: Composition Architecture | 1-2 sessions | None |
| Phase 2: Component Library | 1-2 sessions | Phase 1 |
| Phase 3: Composition Selection | 1 session | Phase 1 |
| Phase 4: Single Product Page | 2-3 sessions | Phase 2 (can start in parallel) |

The composition engine (Phase 1) is the most impactful change — it unlocks the "multiple compositions" vision with minimal code changes. The single product page (Phase 4) is the largest single file but is well-specified and doesn't block the composition work.

---

## 8. What the User Sees

After Phase 1, a product can choose between:
- **Standard** (current 9-section layout — unchanged)
- **Decision** (hero → situation → mechanism → interactive → proof → CTA)
- **Behavior-change** (hero → before/after → journey → tools → rescue → proof → CTA)

The composition is set in the product's `page.landing.composition` field. The renderer uses the same components, same tokens, same CSS. The page looks Swiipt — just different sections in different order.

After Phase 4, the single product page matches the `single.md` reference design: gallery + buy box + 11 numbered sections + sticky buy bar.