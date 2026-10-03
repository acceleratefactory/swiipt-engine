// SWIIPT Experience Recipe — deterministic validator (Node mirror of swt_xp_validate).
// Fail-closed: any error => pass:false. Warnings never block.
// Product-agnostic. See schemas/experience-recipe.schema.json.

export const ARCHETYPES = [
  'GUIDED_JOURNEY', 'COMMAND_CENTER', 'WORKSPACE', 'TIMELINE', 'DECISION_ROOM',
  'PLANNER', 'TRACKER', 'GUIDED_SESSION', 'HYBRID',
];

export const NAV_MODES = [
  'sidebar', 'top', 'journey', 'stepper', 'timeline', 'workspace',
  'tabs', 'minimal', 'contextual', 'hybrid',
];

export const LAYOUTS = [
  'hero-result', 'focused-task', 'split-context-action', 'progressive-question',
  'full-width-workspace', 'metric-cluster', 'timeline-section', 'comparison-stage',
  'reveal-moment', 'document-stage', 'completion-stage', 'rescue-stage', 'review-stage',
];

export const STATES = [
  'first_visit', 'setup', 'active', 'returning', 'review_due', 'blocked', 'rescue', 'completed',
];

export const VIZ = [
  'range', 'distribution', 'progress', 'milestone', 'status', 'comparison', 'timeline', 'completion', 'trend',
];

export const MOTIONS = ['none', 'subtle', 'standard', 'expressive'];
export const DENSITIES = ['compact', 'comfortable', 'spacious'];

export const COMPONENTS = {
  GuidedAssessment: ['immersive', 'conversational', 'wizard', 'compact', 'split'],
  DecisionFlow: ['immersive', 'cards', 'conversational', 'rapid', 'comparison', 'compact'],
  ResultCard: ['hero', 'reveal', 'verdict', 'metric', 'readiness', 'status', 'compact'],
  Tracker: ['timeline', 'ledger', 'calendar', 'journey', 'milestone', 'activity'],
  ProgressJourney: ['horizontal', 'vertical', 'milestone', 'path', 'compact', 'hidden'],
  DynamicListBuilder: ['cards', 'rows', 'ledger', 'compact', 'visual-list'],
  ComparisonTool: ['split', 'table', 'cards', 'before-after', 'scenario'],
  ActionPlan: ['timeline', 'checklist', 'board', 'sequence', 'today-next-later'],
  AuditLoop: ['ledger', 'timeline', 'review-cycle', 'status-board'],
  RescueFlow: ['focused', 'emergency', 'minimal', 'step-by-step'],
  DocumentGenerator: ['document-library', 'single-output', 'contextual-action', 'completion-output'],
  HistoryTimeline: ['timeline', 'ledger', 'compact'],
  ShareSummary: ['card', 'inline', 'compact'],
  CompletionMoment: ['celebration', 'quiet', 'metric', 'document'],
  Countdown: ['large', 'inline', 'compact'],
  ResponsibilityAllocator: ['board', 'rows', 'compact'],
  EvidenceVault: ['grid', 'list', 'timeline'],
  PaymentMilestoneTracker: ['ledger', 'timeline', 'board'],
  ConversationBuilder: ['cards', 'conversational', 'script'],
  ScenarioPlanner: ['cards', 'comparison', 'timeline'],
  InventoryRegister: ['table', 'ledger', 'cards'],
  Handoff: ['card', 'checklist', 'timeline'],
  QuestionBuilder: ['list', 'cards', 'wizard'],
  RiskIssueLog: ['table', 'board', 'timeline'],
};

export const FORBIDDEN_TERMS = [
  'STEP_FLOW', 'REPEATER', 'DECISION_TREE', 'BLOCKS THIS MODULE', 'BLOCK ID',
  '_swiipt_ix_blocks', '_swiipt_experience_recipe', 'TRANSFORMATION COMPONENT',
  'EXPERIENCE RECIPE', 'COMPONENT CATALOGUE', 'DEVELOPER PREVIEW',
];

const asArray = (v) => (Array.isArray(v) ? v : []);

export function validateExperienceRecipe(recipe) {
  const errors = [];
  const warnings = [];
  if (!recipe || typeof recipe !== 'object') {
    return { pass: false, errors: ['recipe is not an object'], warnings: [] };
  }
  if (!recipe.archetype || !ARCHETYPES.includes(recipe.archetype)) errors.push('invalid or missing archetype');
  const nav = recipe.navigation && typeof recipe.navigation === 'object' ? recipe.navigation : null;
  if (!nav || !nav.mode || !NAV_MODES.includes(nav.mode)) errors.push('invalid or missing navigation.mode');
  asArray(recipe.archetypes).forEach((a) => { if (!ARCHETYPES.includes(a)) errors.push(`unknown archetype: ${a}`); });

  Object.entries(recipe.component_variants || {}).forEach(([comp, variant]) => {
    if (!COMPONENTS[comp]) { errors.push(`unknown component: ${comp}`); return; }
    if (!COMPONENTS[comp].includes(variant)) errors.push(`unsupported variant "${variant}" for ${comp}`);
  });

  const navViews = {};
  asArray(nav && nav.items).forEach((it) => { if (it && (it.view || it.id)) navViews[it.view || it.id] = true; });
  const entry = recipe.entry && typeof recipe.entry === 'object' ? recipe.entry : {};
  const reach = { ...navViews };
  ['initial', 'first_visit', 'returning'].forEach((k) => { if (entry[k]) reach[entry[k]] = true; });
  asArray(recipe.journey).forEach((j) => { if (j && j.view) reach[j.view] = true; });

  const screens = recipe.screens && typeof recipe.screens === 'object' ? recipe.screens : {};
  Object.entries(screens).forEach(([sid, sc]) => {
    if (!sc || typeof sc !== 'object') return;
    if (sc.layout && !LAYOUTS.includes(sc.layout)) errors.push(`unsupported layout "${sc.layout}" on screen ${sid}`);
    if (sc.component) {
      if (!COMPONENTS[sc.component]) errors.push(`unknown component "${sc.component}" on screen ${sid}`);
      else if (sc.variant && !COMPONENTS[sc.component].includes(sc.variant)) errors.push(`unsupported variant "${sc.variant}" on screen ${sid}`);
    }
    if (sc.primary_action && !sc.component && !sc.action) errors.push(`screen ${sid} requires a primary action but defines none`);
    if (sc.disclosure && typeof sc.disclosure === 'object') {
      Object.keys(sc.disclosure).forEach((st) => { if (!STATES.includes(st)) errors.push(`screen ${sid} references unknown state "${st}"`); });
    }
    if (sc.required && !reach[sid]) errors.push(`required screen "${sid}" is unreachable`);
  });
  Object.keys(screens).forEach((sid) => { if (!reach[sid]) warnings.push(`orphaned screen: ${sid}`); });

  Object.keys(recipe.states || {}).forEach((name) => { if (!STATES.includes(name)) errors.push(`unknown experience state: ${name}`); });
  asArray(recipe.data_visualization).forEach((v) => { if (!VIZ.includes(v)) errors.push(`unsupported visualization: ${v}`); });
  if (recipe.motion && !MOTIONS.includes(recipe.motion)) errors.push(`unsupported motion: ${recipe.motion}`);
  if (recipe.density && !DENSITIES.includes(recipe.density)) errors.push(`unsupported density: ${recipe.density}`);

  const flat = JSON.stringify(recipe).toUpperCase();
  FORBIDDEN_TERMS.forEach((t) => { if (flat.includes(t)) errors.push(`internal terminology leak: ${t}`); });

  ['initial', 'first_visit', 'returning'].forEach((k) => {
    if (entry[k] && Object.keys(navViews).length && !navViews[entry[k]] && !screens[entry[k]]) {
      errors.push(`entry.${k} references unknown view: ${entry[k]}`);
    }
  });

  if (nav && ['sidebar', 'workspace', 'hybrid'].includes(nav.mode) && !recipe.mobile_behavior) {
    warnings.push(`navigation "${nav.mode}" should declare mobile_behavior`);
  }

  return { pass: errors.length === 0, errors, warnings };
}

export default validateExperienceRecipe;
