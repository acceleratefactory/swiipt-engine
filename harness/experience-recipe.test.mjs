import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validateExperienceRecipe, COMPONENTS, ARCHETYPES, NAV_MODES } from './experience-recipe.mjs';

const fm = {
  version: '1.0',
  archetype: 'COMMAND_CENTER',
  archetypes: ['COMMAND_CENTER', 'GUIDED_JOURNEY'],
  navigation: {
    mode: 'sidebar',
    mobile: 'drawer',
    items: [
      { id: 'dashboard', view: 'dashboard', label: 'Dashboard', module: '' },
      { id: 'quiz', view: 'quiz', label: 'Quiz', module: 'module-01' },
    ],
  },
  entry: { initial: 'dashboard', first_visit: 'quiz', returning: 'dashboard' },
  screens: {
    quiz: { layout: 'progressive-question', component: 'GuidedAssessment', variant: 'wizard' },
    dashboard: { layout: 'hero-result', component: 'ResultCard', variant: 'hero' },
  },
  component_variants: { GuidedAssessment: 'wizard', ResultCard: 'hero' },
  states: { first_visit: { when: { no_state: true } }, returning: { when: { has_state: true } } },
  visual_expression: { accent: 'gold', temperature: 'instrumental' },
  data_visualization: ['range', 'distribution', 'progress'],
  motion: 'standard',
  mobile_behavior: { nav: 'drawer' },
};

const contractor = {
  archetype: 'DECISION_ROOM',
  archetypes: ['DECISION_ROOM', 'WORKSPACE'],
  navigation: { mode: 'workspace', items: [{ view: 'project', label: 'Project' }, { view: 'payments', label: 'Payments' }] },
  entry: { initial: 'project' },
  screens: { project: { layout: 'full-width-workspace', component: 'EvidenceVault', variant: 'grid' } },
  component_variants: { EvidenceVault: 'grid', PaymentMilestoneTracker: 'ledger' },
  data_visualization: ['milestone', 'status'],
  motion: 'subtle',
  mobile_behavior: { nav: 'drawer' },
};

const bereavement = {
  archetype: 'TIMELINE',
  navigation: { mode: 'timeline', items: [{ view: 'now', label: 'Now' }, { view: 'today', label: 'Today' }] },
  entry: { initial: 'now' },
  screens: { now: { layout: 'timeline-section', component: 'ActionPlan', variant: 'sequence' } },
  component_variants: { ActionPlan: 'sequence' },
  motion: 'none',
};

test('Family Money recipe passes', () => {
  const r = validateExperienceRecipe(fm);
  assert.equal(r.pass, true, JSON.stringify(r.errors));
});

test('Contractor recipe passes', () => {
  const r = validateExperienceRecipe(contractor);
  assert.equal(r.pass, true, JSON.stringify(r.errors));
});

test('Bereavement recipe passes', () => {
  const r = validateExperienceRecipe(bereavement);
  assert.equal(r.pass, true, JSON.stringify(r.errors));
});

test('invalid archetype fails closed', () => {
  const r = validateExperienceRecipe({ ...fm, archetype: 'NOPE' });
  assert.equal(r.pass, false);
  assert.ok(r.errors.includes('invalid or missing archetype'));
});

test('invalid navigation mode fails', () => {
  const r = validateExperienceRecipe({ ...fm, navigation: { mode: 'bogus' } });
  assert.equal(r.pass, false);
  assert.ok(r.errors.some((e) => e.includes('navigation.mode')));
});

test('unknown component fails', () => {
  const r = validateExperienceRecipe({ ...fm, component_variants: { Nope: 'x' } });
  assert.equal(r.pass, false);
  assert.ok(r.errors.some((e) => e.includes('unknown component: Nope')));
});

test('unsupported variant fails', () => {
  const r = validateExperienceRecipe({ ...fm, component_variants: { DecisionFlow: 'not-a-variant' } });
  assert.equal(r.pass, false);
  assert.ok(r.errors.some((e) => e.includes('unsupported variant')));
});

test('unsupported layout fails', () => {
  const r = validateExperienceRecipe({ ...fm, screens: { ...fm.screens, quiz: { layout: 'nope' } } });
  assert.equal(r.pass, false);
  assert.ok(r.errors.some((e) => e.includes('unsupported layout')));
});

test('primary action without action/component fails', () => {
  const r = validateExperienceRecipe({ ...fm, screens: { ...fm.screens, quiz: { layout: 'focused-task', primary_action: true } } });
  assert.equal(r.pass, false);
  assert.ok(r.errors.some((e) => e.includes('primary action')));
});

test('unknown state reference in disclosure fails', () => {
  const r = validateExperienceRecipe({ ...fm, screens: { ...fm.screens, quiz: { layout: 'focused-task', disclosure: { weird_state: ['x'] } } } });
  assert.equal(r.pass, false);
  assert.ok(r.errors.some((e) => e.includes('unknown state')));
});

test('orphaned screen is a warning, not a failure', () => {
  const r = validateExperienceRecipe({ ...fm, screens: { ...fm.screens, nowhere: { layout: 'metric-cluster' } } });
  assert.equal(r.pass, true);
  assert.ok(r.warnings.some((w) => w.includes('orphaned screen: nowhere')));
});

test('internal terminology leak fails', () => {
  const r = validateExperienceRecipe({ ...fm, note: 'uses STEP_FLOW internally' });
  assert.equal(r.pass, false);
  assert.ok(r.errors.some((e) => e.includes('terminology leak')));
});

test('sidebar without mobile_behavior warns', () => {
  const noMobile = { ...fm };
  delete noMobile.mobile_behavior;
  const r = validateExperienceRecipe(noMobile);
  assert.equal(r.pass, true);
  assert.ok(r.warnings.some((w) => w.includes('mobile_behavior')));
});

test('deterministic: same recipe => same verdict', () => {
  const a = validateExperienceRecipe(fm);
  const b = validateExperienceRecipe(fm);
  assert.deepEqual(a, b);
});

test('schema file is valid JSON with required enums', () => {
  const p = path.resolve('schemas/experience-recipe.schema.json');
  const schema = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.deepEqual(schema.$defs.archetype.enum, ARCHETYPES);
  assert.deepEqual(schema.$defs.navMode.enum, NAV_MODES);
  assert.equal(typeof COMPONENTS.GuidedAssessment, 'object');
});

test('globality: validator contains no product names', () => {
  const src = fs.readFileSync(path.resolve('harness/experience-recipe.mjs'), 'utf8').toLowerCase();
  for (const w of ['family money', 'baby budget', 'postpartum', 'contractor protection', 'bereavement', 'night shift', 'v06']) {
    assert.equal(src.includes(w), false, `unexpected product reference: ${w}`);
  }
});
