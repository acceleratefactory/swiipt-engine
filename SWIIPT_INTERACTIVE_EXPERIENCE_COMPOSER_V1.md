# SWIIPT INTERACTIVE EXPERIENCE COMPOSER — V1

The permanent factory architecture for turning one engine into many *distinct-feeling* product experiences.

**Core law:** SWIIPT does not manufacture 100,000 apps. It manufactures 100,000 product experiences from one runtime + one design authority + one transformation-component system + many product truths + many Experience Recipes + one Experience Composer.

- Transformation Components determine **what the customer can do**.
- Product Truth determines **what is true**.
- Experience Recipe determines **what this particular transformation needs**.
- Experience Composer determines **how the transformation unfolds**.
- Design Authority determines **what is allowed to look and feel like SWIIPT**.

---

## 1. Final architecture

```
PRODUCT FACTORY
  → Interactive Specification
  → Experience Recipe            (per product, data, in the repo + product meta)
  → Transformation Components + Product Content + Product Rules + State
  → EXPERIENCE COMPOSER          (generic engine)
  → SWIIPT DESIGN AUTHORITY
  → SHARED RUNTIME
  → UNIQUE-FEELING PRODUCT APPLICATION
```

Live layers (WordPress mu-plugin `swiipt-core`):
- `includes/interactive-experience.php` — the Experience Composer (this feature).
- `includes/interactive-blocks.php` — shared state engine, block registry, REST `swt/v1/saas`, recompute, caps.
- `includes/interactive-app2.php` — shared app shell + boot + standalone route + fail-closed gate.
- `js/swt-app2.js`, `css/swt-app2.css` — shared runtime + design authority.
- `interactive-recipe-<product>.php` + `_swiipt_experience_recipe` meta + `_swiipt_ix_blocks` composition.

## 2. UI primitives
Buttons, inputs, cards, modals, drawers, progress, date picker, currency fields, tabs, tooltip, toast. Implementation details, defined once in the design authority (`swt-app2.css`). Never product-specific.

## 3. Transformation Components
Behavioural capability, rendered by the composer with variants. 24 registered (`swt_xp_components()`): GuidedAssessment, DecisionFlow, ResultCard, Tracker, ProgressJourney, DynamicListBuilder, ComparisonTool, ActionPlan, AuditLoop, RescueFlow, DocumentGenerator, HistoryTimeline, ShareSummary, CompletionMoment, Countdown, ResponsibilityAllocator, EvidenceVault, PaymentMilestoneTracker, ConversationBuilder, ScenarioPlanner, InventoryRegister, Handoff, QuestionBuilder, RiskIssueLog.

## 4. Experience Recipe
A product-agnostic, machine-readable config (`schemas/experience-recipe.schema.json`). Stored as `_swiipt_experience_recipe` product/TS meta (write via `swt_xp_save_recipe()`), authored in the repo at `data/products/<id>/experience.json`. Fields: `archetype`, `archetypes`, `navigation`, `entry`, `journey`, `screens`, `component_variants`, `density`, `progressive_disclosure`, `states`, `visual_expression`, `data_visualization`, `motion`, `mobile_behavior`, `completion`, `rescue`, `empty_states`.

## 5. Experience Composer
`swt_xp_compose($ts_id)` reads the recipe, validates it, resolves experience state + per-view screens + tokens, and (for generic products) renders each screen from the product's own composition (`swt_xp_render_screen()`). Emits: `archetype`, `navigation`, `entry`, `screens_resolved`, `component_variants`, `experience_state`, `has_state`, `visual_expression`, `tokens`, `motion`, `data_visualization`, `completion_resolved`, `render` (`product` | `generic`), `screens_html`, `explicit`, `validation`. No product branches.

## 6. Archetypes (`swt_xp_archetypes()`)
GUIDED_JOURNEY · COMMAND_CENTER · WORKSPACE · TIMELINE · DECISION_ROOM · PLANNER · TRACKER · GUIDED_SESSION · HYBRID. These are architecture, not templates — the recipe still controls composition.

## 7. Navigation modes (`swt_xp_nav_modes()`)
sidebar · top · journey · stepper · timeline · workspace · tabs · minimal · contextual · hybrid. Product selects via recipe; the runtime renders nav from `navigation.items`.

## 8. Component variants
Each component exposes controlled variants (`swt_xp_components()`), e.g. DecisionFlow → immersive/cards/conversational/rapid/comparison/compact; Tracker → timeline/ledger/calendar/journey/milestone/activity; ResultCard → hero/reveal/verdict/metric/readiness/status/compact. Same behaviour, different expression.

## 9. Screen composition (`swt_xp_layouts()`)
hero-result · focused-task · split-context-action · progressive-question · full-width-workspace · metric-cluster · timeline-section · comparison-stage · reveal-moment · document-stage · completion-stage · rescue-stage · review-stage. Applied as `.xp-layout-*` on the screen wrapper.

## 10. Experience states (`swt_xp_states()`)
first_visit · setup · active · returning · review_due · blocked · rescue · completed. `swt_xp_state()` resolves the current state from recipe `states.*.when` rules evaluated against canonical signals — never product-specific.

## 11. Progressive disclosure
Recipe `progressive_disclosure[view]` + `screens[view].disclosure[state]` resolve a per-state disclosure list (`swt_xp_screen()`). CSS hooks: `[data-xp-state] .xp-first-visit-only` / `.xp-returning-only`.

## 12. Visual expression
Recipe `visual_expression` (accent gold/purple/rust/navy, temperature, shape, density) maps through `swt_xp_tokens()` to a finite set of CSS custom properties (`--xp-accent`, `--xp-density`, `--xp-radius`, `--xp-ink`). **No separate stylesheets per product, no new brand.**

## 13. Motion (`swt_xp_motions()`)
none · subtle · standard · expressive. Runtime applies `xp-motion-*` to `<body>`; `prefers-reduced-motion` always honoured; motion never blocks completion.

## 14. Visualization (`swt_xp_viz_grammar()`)
range · distribution · progress · milestone · status · comparison · timeline · completion · trend. `swt_xp_viz($type,$data)` renders generic markup from **canonical values only** and returns `''` when data is missing — never fabricates.

## 15. Mobile composition
First-class, not shrunk desktop. Off-canvas drawer nav (`nav-toggle` + `nav-scrim` inside the shell's stacking context), compact header, reduced persistent chrome, single-column layouts, internal horizontal scroll for wide tables, ≥44px targets. Breakpoint ≤860px.

## 16. Design authority
`swt-tokens.css` + `swt-app2.css` own typography (DM Serif Display + Inter), palette, spacing, radii, shadows, focus states, motion rules, breakpoints. The recipe may only express **within** this authority.

## 17. Persistence
Unchanged and canonical: `swt_interactive_state` (user_id + ts_id + state_json `{blocks, computed, history, committed}`), REST `swt/v1/saas`. Client storage is cache/optimistic only. Refresh / logout-login retain state.

## 18. Validation
`swt_xp_validate()` (server) + `harness/experience-recipe.mjs` (Node mirror) + `schemas/experience-recipe.schema.json`. **Fail-closed:** any error ⇒ the runtime refuses to render (503), admins see the errors, and it is audited. Warnings never block.

## 19. Factory integration
The factory emits the Experience Recipe as a canonical artifact (`experience.json`), validates it, and writes it with `swt_xp_save_recipe()`; then assembly (`swt_xp_compose`) and runtime are automatic. Humans govern the system; the system governs the products.

## 20. How a new product becomes an app
1. Author the composition `_swiipt_ix_blocks` (modules → blocks) and an `experience.json` recipe.
2. Push the recipe (meta) and set `_swiipt_app_shell=saas2` (+ `_swiipt_app2_recipe` if you also ship a PHP `interactive-recipe-<id>.php` for brand copy).
3. The composer resolves archetype/nav/screens/variants/tokens and renders. No new app, no per-product engine code.

## 21. How to add a new Transformation Component
Add the type to `swt_xp_components()` with its allowed variants, add a renderer (server block renderer or a client render unit), and reference it from recipes' `screens`/`component_variants`. Existing products keep working.

## 22. When a new component is justified
Only when the **behaviour** is genuinely new (a capability, not a look). If it is a different *presentation* of existing behaviour, add a **variant** instead. This prevents duplication and template collapse.

## 23. How to avoid product-specific code
Never branch on product id/name in engine files. All product difference is data: composition + recipe. Enforced by the F9 globality scan (`harness/anti-template.test.mjs` checks 6 & 16).

## 24. Anti-template rules
Different archetypes, different nav models, optional dashboard, optional sidebar, variant-selected component expression, first_visit ≠ returning, mobile ≠ desktop — all from data. **No random design generation** — the same recipe + state + design-authority version yields a deterministic structure.
