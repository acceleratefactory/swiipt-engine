import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validateExperienceRecipe, FORBIDDEN_TERMS, ARCHETYPES, NAV_MODES, COMPONENTS } from './experience-recipe.mjs';

const ROOT = path.resolve('.');
const fx = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, 'harness', 'fixtures', 'experience', n + '.json'), 'utf8'));
const engineFile = (n) => fs.readFileSync(path.join(ROOT, 'engine', n), 'utf8');

const fm = fx('fm');
const contractor = fx('contractor');
const timeline = fx('timeline');
const all = { fm, contractor, timeline };

const PRODUCT_TOKENS = ['family money', 'baby budget', 'postpartum', 'night shift', 'v06', 'first 72', 'contractor payment'];
const engineFiles = ['interactive-experience.php', 'interactive-app2.php', 'swt-app2.js', 'swt-app2.css'];
const engineSrc = engineFiles.map((f) => engineFile(f)).join('\n');
const engineLower = engineSrc.toLowerCase();

test('1. two products can use different archetypes', () => {
  const set = new Set([fm.archetype, contractor.archetype, timeline.archetype]);
  assert.equal(set.size, 3, [...set].join(','));
});

test('2. two products can use different navigation models', () => {
  const set = new Set([fm.navigation.mode, contractor.navigation.mode, timeline.navigation.mode]);
  assert.equal(set.size, 3, [...set].join(','));
});

test('3. same transformation component can use different variants', () => {
  // a shared component (RescueFlow) is declared with a different variant in each product
  const variants = all; // readability
  const rv = [fm.component_variants.RescueFlow, contractor.component_variants.RescueFlow, timeline.component_variants.RescueFlow];
  assert.equal(new Set(rv).size, 3, rv.join(','));
  assert.ok(COMPONENTS.RescueFlow.includes(rv[0]) && COMPONENTS.RescueFlow.includes(rv[1]) && COMPONENTS.RescueFlow.includes(rv[2]));
});

test('4. dashboard can be absent', () => {
  const hasDash = (r) => (r.navigation.items || []).some((i) => (i.view || i.id) === 'dashboard');
  assert.equal(hasDash(fm), true);
  assert.equal(hasDash(contractor), false);
  assert.equal(hasDash(timeline), false);
});

test('5. sidebar can be absent', () => {
  assert.equal(fm.navigation.mode, 'sidebar');
  assert.notEqual(contractor.navigation.mode, 'sidebar');
  assert.notEqual(timeline.navigation.mode, 'sidebar');
});

test('6. different screen composition without new app code', () => {
  const labels = (r) => (r.navigation.items || []).map((i) => i.label).join('|');
  assert.notEqual(labels(fm), labels(contractor));
  assert.notEqual(labels(contractor), labels(timeline));
  assert.notEqual(labels(fm), labels(timeline));
  // composition is data-only: the engine must not branch on a product
  assert.equal(/=== ?['"](family-?money|fm|v06)['"]/.test(engineSrc), false);
});

test('7. visual expression changes controlled tokens without a new brand identity', () => {
  const palette = ['gold', 'purple', 'rust', 'navy'];
  for (const r of Object.values(all)) assert.ok(palette.includes(r.visual_expression.accent), r.visual_expression.accent);
  // the palette lives in the engine (finite, shared)
  assert.ok(engineFile('interactive-experience.php').includes("'gold'") && engineFile('interactive-experience.php').includes("'navy'"));
  // no per-product stylesheets in the engine
  const css = fs.readdirSync(path.join(ROOT, 'engine')).filter((f) => f.endsWith('.css'));
  assert.deepEqual(css, ['swt-app2.css']);
});

test('8. first_visit can differ from returning', () => {
  assert.notEqual(fm.entry.first_visit, fm.entry.returning);
});

test('9. mobile composition can differ from desktop', () => {
  for (const r of Object.values(all)) assert.ok(r.mobile_behavior || (r.screens && true));
  const css = engineFile('swt-app2.css');
  assert.ok(css.includes('@media (max-width:860px)'));
  assert.ok(css.includes('data-xp-state'));
  assert.ok(engineFile('swt-app2.js').includes('xp-motion-'));
});

test('10. internal component terminology never leaks', () => {
  const recipeHay = JSON.stringify(all).toUpperCase();
  for (const t of FORBIDDEN_TERMS) assert.equal(recipeHay.includes(t), false, `recipe leak: ${t}`);
  // the engine enforces the guard (the forbidden list is defined exactly once, in the validator)
  assert.ok(engineFile('interactive-experience.php').includes('swt_xp_forbidden_terms'));
});

test('11. component behaviour remains shared', () => {
  const registry = Object.keys(COMPONENTS);
  assert.ok(registry.includes('GuidedAssessment') && registry.includes('RescueFlow') && registry.includes('EvidenceVault'));
  for (const r of Object.values(all)) {
    const res = validateExperienceRecipe(r);
    assert.equal(res.pass, true, JSON.stringify(res.errors));
  }
});

test('12. state persistence remains shared', () => {
  assert.ok(engineFile('swt-app2.js').includes('restBase') && engineFile('swt-app2.js').includes('/state'));
  assert.ok(engineFile('interactive-app2.php').includes('swt_interactive_state'));
});

test('13. server recomputation remains shared', () => {
  assert.ok(engineFile('interactive-app2.php').includes('swt_blocks_recompute_state'));
});

test('14. accessibility remains inherited', () => {
  const css = engineFile('swt-app2.css');
  assert.ok(css.includes('focus-visible'));
  assert.ok(css.includes('prefers-reduced-motion'));
  assert.ok(engineFile('interactive-app2.php').includes('aria-label'));
});

test('15. document generation remains inherited', () => {
  assert.ok(engineFile('interactive-app2.php').includes('swt_doc'));
  assert.ok(engineFile('swt-app2.js').includes('documents'));
});

test('16. no product-specific branch is required', () => {
  for (const t of PRODUCT_TOKENS) assert.equal(engineLower.includes(t), false, `product token in engine: ${t}`);
  assert.equal(engineSrc.includes("'fm'"), false);
  assert.equal(engineSrc.includes('"fm"'), false);
  assert.equal(engineSrc.includes("swt_app2_recipe_fm"), false);
});
