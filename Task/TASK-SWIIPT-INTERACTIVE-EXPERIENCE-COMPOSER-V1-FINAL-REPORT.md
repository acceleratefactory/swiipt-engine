# TASK — SWIIPT INTERACTIVE EXPERIENCE COMPOSER V1 — FINAL REPORT

**Status:** implementation complete, live-verified. Source-control commit/tag = F12 (pending at time of writing).
**Reference product:** PPL-FAMILY-MONEY-001 (TS 1999). **Mode:** permanent factory architecture.

## Origin
The engine solved *functional* reuse (one runtime, blocks, per-product recipe) but not *experiential* variation: every product inherited the same dashboard/sidebar/six-module shell and would have felt like a reskin. V1 adds the missing **Experience Composer** layer so screen architecture, navigation, component variants, hierarchy, motion and composition are **generated from each product's Experience Recipe**, while runtime, components, persistence, a11y, documents and design authority stay shared.

## Files inspected (Phase 0)
`interactive-app2.php`, `swt-app2.js`, `swt-app2.css`, `interactive-blocks.php`, `interactive-recipe-fm.php`, `interactive-app.php`, `interactive-saas.php`, `interactive-spec.php`, `interactive-engine.php`, `interactive-fm.php`; FM composition `_swiipt_ix_blocks`, shared state `swt_interactive_state`, REST `swt/v1/saas`, boot/standalone routing, mobile breakpoint.

## Files changed / added
- **Added (live mu-plugin):** `includes/interactive-experience.php` (Experience Composer). Required from `modules.php`.
- **Changed:** `includes/interactive-app2.php` (boot carries `copy.experience`; recipe-source aware boot; fail-closed gate; recipe-driven primary-result pill; generic-render support; default recipe id removed), `js/swt-app2.js` (recipe-driven nav/entry, archetype class, tokens, motion class, state mapping, generic screen branch), `css/swt-app2.css` (layout/viz/motion primitives).
- **Added (repo):** `schemas/experience-recipe.schema.json`; `harness/experience-recipe.mjs`; `harness/experience-recipe.test.mjs`; `harness/anti-template.test.mjs`; `harness/fixtures/experience/{fm,contractor,timeline}.json`; `engine/` mirror (interactive-experience.php, interactive-app2.php, swt-app2.js, swt-app2.css); `data/products/PPL-FAMILY-MONEY-001/experience.json`; this report + `SWIIPT_INTERACTIVE_EXPERIENCE_COMPOSER_V1.md`.
- **Meta:** FM TS 1999 `_swiipt_experience_recipe` + `_swiipt_app2_recipe='fm'`; fixtures TS 2009 (contractor) + TS 2010 (timeline).

## Architecture before → after
- **Before:** shared runtime → blocks → composition → recipe → app, with a single fixed shell (dashboard + 6-module sidebar) and FM-shaped screen renderers.
- **After:** the same runtime + blocks + composition, plus an **Experience Composer** between the recipe and the design authority that decides archetype, navigation, screen composition, component variants, density, hierarchy, disclosure, experience state, visual expression, motion and visualization. FM remains on its `product`-render path; generic products render from their own composition.

## Experience Recipe implementation
JSON contract (schema + Node validator + server validator), stored in `_swiipt_experience_recipe`, written via `swt_xp_save_recipe()` (`JSON_UNESCAPED_UNICODE` + `wp_slash`). Resolved by `swt_xp_recipe()`: meta → PHP `experience` key → safe default.

## Composer implementation
`swt_xp_compose()` — recipe load, `swt_xp_validate()` (fail-closed), experience-state resolution, per-view screens, tokens, completion; generic `screens_html` via `swt_xp_render_screen()` when the product opts in (`generic: true`).

## Archetypes
9 (`GUIDED_JOURNEY…HYBRID`) — enum + neutral rendering.

## Navigation
10 modes; runtime renders nav from `navigation.items`; sidebar optional; deep links (`?v=<module>`) preserved.

## Variants
24 components × controlled variant sets; validated; same behaviour, different presentation.

## Visual-expression system
`swt_xp_tokens()` → finite token map (accent/density/radius/ink) under the shared design authority; **no per-product CSS files**.

## Family Money migration
Recipe `data/products/PPL-FAMILY-MONEY-001/experience.json`: `COMMAND_CENTER + GUIDED_JOURNEY`, sidebar, `first_visit=quiz`/`returning=dashboard`, screens (GuidedAssessment·wizard, DecisionFlow·cards, Tracker·ledger, AuditLoop·ledger, ResultCard·hero), gold/instrumental, completion = Household Baby Budget Number. Verified live: returning user → `xp-command_center`, Dashboard, hero intact, no regression. **No FM branches in the engine.**

## Second-product proof (contractor)
Fixture TS 2009 `DECISION_ROOM + WORKSPACE`, nav Project/Contractor/Evidence/Milestones/Payment Readiness/Issues, own composition, documentary/rust. Live: `xp-decision_room`, generic screens, no dashboard, own pill/footer.

## Third-archetype proof (timeline)
Fixture TS 2010 `TIMELINE + GUIDED_SESSION`, nav Now/Today/Next 24 Hours/Documents/People to Contact/Next 7 Days, quiet/navy/motion:none. Live: `xp-timeline`, generic screens, no dashboard.

## Mobile proof
Off-canvas drawer (hamburger + scrim inside the shell stacking context), compact two-row header with book/Rescue/Settings visible, reduced hero type, internal table scroll. Verified at 390px: `scrollWidth==clientWidth`, sidebar hidden until opened, all icons within viewport.

## Persistence proof
Server-canonical `swt_interactive_state` + `swt/v1/saas`; refresh/edit-save/return all retain state. Cross-view saves carry all composition blocks (no collapse).

## Accessibility proof
Focus-visible, semantic controls, labels, reduced-motion honoured, touch targets; inherited by every variant (`swt-app2.css`).

## Anti-template proof
`harness/anti-template.test.mjs` — 16/16 pass: different archetypes; different nav models; same component different variants; dashboard optional; sidebar optional; composition without new code; visual expression controlled; first_visit ≠ returning; mobile ≠ desktop; zero terminology leak; shared behaviour/persistence/recompute/a11y/documents; zero product branches.

## Test results
- `harness/experience-recipe.test.mjs` — 16/16 pass.
- `harness/anti-template.test.mjs` — 16/16 pass.
- Server: validator fail-closed (broken recipe → 503, recovered → 200); compose PASS for all three recipes.

## Live URLs
- FM: `https://swiipt.com/?swiipt_app=1999`
- Contractor fixture: `https://swiipt.com/?swiipt_app=2009`
- Timeline fixture: `https://swiipt.com/?swiipt_app=2010`
- Internal catalogue: WP Admin → Tools → **Swiipt Interactive Design System**

## Screenshots / evidence
`C:\Users\HPM6\AppData\Local\Temp\opencode\v2\shots\` — `mob-dash.png`, `mob-drawer4.png`, `hdr-mobile.png`, `f7-fixture2.png`, `f8-timeline.png`.

## Known limitations
- Generic products render server-side via the shared block renderers; the FM-shaped interactive screens (quiz/chart/decide/swap/audit) remain the `product`-render path (kept to avoid regressing FM).
- Not every listed variant has a bespoke renderer yet; variants resolve and validate, and generic screens compose from the block vocabulary.
- Fixtures 2009/2010 are internal architectural proofs (not commercial), reachable by admins.
- `?v=blocks` lab is admin-only; the new catalogue is admin-only.

## Source-control state
Engine mirrored to `Product Pipeline/engine/` (4 files). F9 tests green. Working tree also contains pre-existing unrelated changes/deletion (preserved, not staged). Commit/push + annotated tag `swiipt-engine-v1-interactive-experience-composer-ready` = F12.
