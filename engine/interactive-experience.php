<?php
/**
 * SWIIPT INTERACTIVE EXPERIENCE COMPOSER â€” V1  (additive layer)
 *
 * Sits between a product's Experience Recipe and the shared SWIIPT design
 * authority + runtime. It determines HOW a given transformation unfolds
 * (archetype, navigation, screen composition, component variants, density,
 * progressive disclosure, experience states, visual expression, motion,
 * visualization) â€” WITHOUT owning product truth or state.
 *
 * Not a new app. Not a new design system. Not product-specific.
 * Behaviour, persistence, validation, documents and entitlement are inherited
 * from interactive-blocks.php + interactive-app2.php.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

define( 'SWT_XP_VERSION', '1.0' );

/* ============================================================ VOCABULARY */

function swt_xp_archetypes() {
	return array( 'GUIDED_JOURNEY', 'COMMAND_CENTER', 'WORKSPACE', 'TIMELINE', 'DECISION_ROOM', 'PLANNER', 'TRACKER', 'GUIDED_SESSION', 'HYBRID' );
}

function swt_xp_nav_modes() {
	return array( 'sidebar', 'top', 'journey', 'stepper', 'timeline', 'workspace', 'tabs', 'minimal', 'contextual', 'hybrid' );
}

function swt_xp_layouts() {
	return array( 'hero-result', 'focused-task', 'split-context-action', 'progressive-question', 'full-width-workspace', 'metric-cluster', 'timeline-section', 'comparison-stage', 'reveal-moment', 'document-stage', 'completion-stage', 'rescue-stage', 'review-stage' );
}

function swt_xp_states() {
	return array( 'first_visit', 'setup', 'active', 'returning', 'review_due', 'blocked', 'rescue', 'completed' );
}

function swt_xp_viz_grammar() {
	return array( 'range', 'distribution', 'progress', 'milestone', 'status', 'comparison', 'timeline', 'completion', 'trend' );
}

function swt_xp_motions() {
	return array( 'none', 'subtle', 'standard', 'expressive' );
}

function swt_xp_densities() {
	return array( 'compact', 'comfortable', 'spacious' );
}

/**
 * Transformation Component registry: canonical component => allowed variants.
 * Behaviour is reused; only presentation varies. (Phase 4)
 */
function swt_xp_components() {
	return array(
		'GuidedAssessment'        => array( 'immersive', 'conversational', 'wizard', 'compact', 'split' ),
		'DecisionFlow'            => array( 'immersive', 'cards', 'conversational', 'rapid', 'comparison', 'compact' ),
		'ResultCard'              => array( 'hero', 'reveal', 'verdict', 'metric', 'readiness', 'status', 'compact' ),
		'Tracker'                 => array( 'timeline', 'ledger', 'calendar', 'journey', 'milestone', 'activity' ),
		'ProgressJourney'         => array( 'horizontal', 'vertical', 'milestone', 'path', 'compact', 'hidden' ),
		'DynamicListBuilder'      => array( 'cards', 'rows', 'ledger', 'compact', 'visual-list' ),
		'ComparisonTool'          => array( 'split', 'table', 'cards', 'before-after', 'scenario' ),
		'ActionPlan'              => array( 'timeline', 'checklist', 'board', 'sequence', 'today-next-later' ),
		'AuditLoop'               => array( 'ledger', 'timeline', 'review-cycle', 'status-board' ),
		'RescueFlow'              => array( 'focused', 'emergency', 'minimal', 'step-by-step' ),
		'DocumentGenerator'       => array( 'document-library', 'single-output', 'contextual-action', 'completion-output' ),
		'HistoryTimeline'         => array( 'timeline', 'ledger', 'compact' ),
		'ShareSummary'            => array( 'card', 'inline', 'compact' ),
		'CompletionMoment'        => array( 'celebration', 'quiet', 'metric', 'document' ),
		'Countdown'               => array( 'large', 'inline', 'compact' ),
		'ResponsibilityAllocator' => array( 'board', 'rows', 'compact' ),
		'EvidenceVault'           => array( 'grid', 'list', 'timeline' ),
		'PaymentMilestoneTracker' => array( 'ledger', 'timeline', 'board' ),
		'ConversationBuilder'     => array( 'cards', 'conversational', 'script' ),
		'ScenarioPlanner'         => array( 'cards', 'comparison', 'timeline' ),
		'InventoryRegister'       => array( 'table', 'ledger', 'cards' ),
		'Handoff'                 => array( 'card', 'checklist', 'timeline' ),
		'QuestionBuilder'         => array( 'list', 'cards', 'wizard' ),
		'RiskIssueLog'            => array( 'table', 'board', 'timeline' ),
	);
}

/** Internal terminology that must never reach the customer (Phase 12). */
function swt_xp_forbidden_terms() {
	return array(
		'STEP_FLOW', 'REPEATER', 'DECISION_TREE', 'BLOCKS THIS MODULE', 'BLOCK ID',
		'_swiipt_ix_blocks', '_swiipt_experience_recipe', 'transformation component',
		'experience recipe', 'component catalogue', 'developer preview',
	);
}

/* ============================================================ RECIPE LOAD */

/** Backward-compatible default (COMMAND_CENTER + sidebar) derived from the product nav. */
function swt_xp_default_recipe( $ts_id ) {
	$nav = array();
	if ( function_exists( 'swt_app2_recipe' ) ) {
		$r = swt_app2_recipe( $ts_id );
		if ( is_array( $r ) && ! empty( $r['nav'] ) ) {
			foreach ( (array) $r['nav'] as $n ) {
				if ( ! is_array( $n ) || empty( $n['view'] ) ) { continue; }
				$nav[] = array( 'id' => (string) $n['view'], 'label' => (string) ( $n['label'] ?? $n['view'] ), 'view' => (string) $n['view'], 'icon' => (string) ( $n['icon'] ?? '' ), 'module' => (string) ( $n['module'] ?? '' ) );
			}
		}
	}
	if ( ! $nav ) { $nav = array( array( 'id' => 'dashboard', 'label' => 'Dashboard', 'view' => 'dashboard', 'icon' => '' ) ); }
	return array(
		'version'            => SWT_XP_VERSION,
		'archetype'          => 'COMMAND_CENTER',
		'archetypes'         => array( 'COMMAND_CENTER' ),
		'navigation'         => array( 'mode' => 'sidebar', 'mobile' => 'drawer', 'items' => $nav ),
		'entry'              => array( 'initial' => $nav[0]['view'], 'first_visit' => $nav[0]['view'], 'returning' => $nav[0]['view'] ),
		'journey'            => $nav,
		'screens'            => array(),
		'component_variants' => array(),
		'density'            => 'comfortable',
		'progressive_disclosure' => array(),
		'states'             => array(),
		'visual_expression'  => array(),
		'data_visualization' => array(),
		'motion'             => 'standard',
		'mobile_behavior'    => array( 'nav' => 'drawer', 'chrome' => 'reduced' ),
		'completion'         => array(),
		'rescue'             => array( 'enabled' => true, 'global' => true, 'variant' => 'focused' ),
		'empty_states'       => array(),
	);
}

/** Load the Experience Recipe: meta -> PHP recipe experience -> default. */
function swt_xp_recipe( $ts_id ) {
	$ts_id = (int) $ts_id;
	$raw = get_post_meta( $ts_id, '_swiipt_experience_recipe', true );
	if ( is_string( $raw ) && '' !== trim( $raw ) ) {
		$dec = json_decode( $raw, true );
		if ( is_array( $dec ) ) { return $dec; }
	}
	if ( function_exists( 'swt_app2_recipe' ) ) {
		$rcp = swt_app2_recipe( $ts_id );
		if ( is_array( $rcp ) && ! empty( $rcp['experience'] ) && is_array( $rcp['experience'] ) ) {
			return $rcp['experience'];
		}
	}
	return swt_xp_default_recipe( $ts_id );
}

/* ============================================================ VALIDATOR (fail-closed) */

function swt_xp_validate( $r ) {
	$errors = array(); $warnings = array();
	if ( ! is_array( $r ) ) { return array( 'pass' => false, 'errors' => array( 'recipe is not an object' ), 'warnings' => array() ); }
	if ( empty( $r['archetype'] ) || ! in_array( $r['archetype'], swt_xp_archetypes(), true ) ) { $errors[] = 'invalid or missing archetype'; }
	$nav = ( isset( $r['navigation'] ) && is_array( $r['navigation'] ) ) ? $r['navigation'] : null;
	if ( ! $nav || empty( $nav['mode'] ) || ! in_array( $nav['mode'], swt_xp_nav_modes(), true ) ) { $errors[] = 'invalid or missing navigation.mode'; }
	foreach ( (array) ( $r['archetypes'] ?? array() ) as $a ) { if ( ! in_array( $a, swt_xp_archetypes(), true ) ) { $errors[] = 'unknown archetype: ' . $a; } }
	$comps = swt_xp_components();
	foreach ( (array) ( $r['component_variants'] ?? array() ) as $comp => $variant ) {
		if ( ! isset( $comps[ $comp ] ) ) { $errors[] = 'unknown component: ' . $comp; continue; }
		if ( ! in_array( $variant, $comps[ $comp ], true ) ) { $errors[] = 'unsupported variant "' . $variant . '" for ' . $comp; }
	}
	$layouts = swt_xp_layouts(); $states = swt_xp_states();
	$nav_views = array();
	foreach ( (array) ( $nav['items'] ?? array() ) as $it ) { if ( is_array( $it ) && ( isset( $it['view'] ) || isset( $it['id'] ) ) ) { $nav_views[ (string) ( $it['view'] ?? $it['id'] ) ] = true; } }
	$entry = (array) ( $r['entry'] ?? array() );
	$reach = $nav_views;
	foreach ( array( 'initial', 'first_visit', 'returning' ) as $k ) { if ( ! empty( $entry[ $k ] ) ) { $reach[ (string) $entry[ $k ] ] = true; } }
	foreach ( (array) ( $r['journey'] ?? array() ) as $j ) { if ( is_array( $j ) && isset( $j['view'] ) ) { $reach[ (string) $j['view'] ] = true; } }
	$screens = (array) ( $r['screens'] ?? array() );
	foreach ( $screens as $sid => $sc ) {
		if ( ! is_array( $sc ) ) { continue; }
		if ( ! empty( $sc['layout'] ) && ! in_array( $sc['layout'], $layouts, true ) ) { $errors[] = 'unsupported layout "' . $sc['layout'] . '" on screen ' . $sid; }
		if ( ! empty( $sc['component'] ) ) {
			if ( ! isset( $comps[ $sc['component'] ] ) ) { $errors[] = 'unknown component "' . $sc['component'] . '" on screen ' . $sid; }
			elseif ( ! empty( $sc['variant'] ) && ! in_array( $sc['variant'], $comps[ $sc['component'] ], true ) ) { $errors[] = 'unsupported variant "' . $sc['variant'] . '" on screen ' . $sid; }
		}
		if ( ! empty( $sc['primary_action'] ) && empty( $sc['component'] ) && empty( $sc['action'] ) ) { $errors[] = 'screen ' . $sid . ' requires a primary action but defines none'; }
		if ( isset( $sc['disclosure'] ) && is_array( $sc['disclosure'] ) ) { foreach ( array_keys( $sc['disclosure'] ) as $st ) { if ( ! in_array( (string) $st, $states, true ) ) { $errors[] = 'screen ' . $sid . ' references unknown state "' . $st . '"'; } } }
		if ( ! empty( $sc['required'] ) && ! isset( $reach[ (string) $sid ] ) ) { $errors[] = 'required screen "' . $sid . '" is unreachable'; }
	}
	foreach ( $screens as $sid => $sc ) { if ( ! isset( $reach[ (string) $sid ] ) ) { $warnings[] = 'orphaned screen: ' . $sid; } }
	foreach ( (array) ( $r['states'] ?? array() ) as $name => $def ) { if ( ! in_array( (string) $name, $states, true ) ) { $errors[] = 'unknown experience state: ' . $name; } }
	foreach ( (array) ( $r['data_visualization'] ?? array() ) as $v ) { if ( ! in_array( $v, swt_xp_viz_grammar(), true ) ) { $errors[] = 'unsupported visualization: ' . $v; } }
	if ( ! empty( $r['motion'] ) && ! in_array( $r['motion'], swt_xp_motions(), true ) ) { $errors[] = 'unsupported motion: ' . $r['motion']; }
	if ( ! empty( $r['density'] ) && ! in_array( $r['density'], swt_xp_densities(), true ) ) { $errors[] = 'unsupported density: ' . $r['density']; }
	$flat = strtoupper( wp_json_encode( $r ) );
	foreach ( swt_xp_forbidden_terms() as $t ) { if ( false !== strpos( $flat, strtoupper( $t ) ) ) { $errors[] = 'internal terminology leak: ' . $t; } }
	foreach ( array( 'initial', 'first_visit', 'returning' ) as $k ) { if ( ! empty( $entry[ $k ] ) && $nav_views && ! isset( $nav_views[ $entry[ $k ] ] ) && ! isset( $screens[ $entry[ $k ] ] ) ) { $errors[] = 'entry.' . $k . ' references unknown view: ' . $entry[ $k ]; } }
	if ( $nav && in_array( (string) ( $nav['mode'] ?? '' ), array( 'sidebar', 'workspace', 'hybrid' ), true ) && empty( $r['mobile_behavior'] ) ) { $warnings[] = 'navigation "' . $nav['mode'] . '" should declare mobile_behavior'; }
	return array( 'pass' => empty( $errors ), 'errors' => $errors, 'warnings' => $warnings );
}

/* ============================================================ VISUAL EXPRESSION -> TOKENS */



/* ============================================================ COMPOSER */

function swt_xp_compose( $ts_id ) {
	$ts_id  = (int) $ts_id;
	$recipe = swt_xp_recipe( $ts_id );
	$v      = swt_xp_validate( $recipe );
	$src2   = swt_xp_recipe_source( $ts_id );
	$nav    = (array) ( $recipe['navigation'] ?? array() );
	$comp   = array(
		'version'     => SWT_XP_VERSION,
		'archetype'   => (string) ( $recipe['archetype'] ?? 'COMMAND_CENTER' ),
		'archetypes'  => (array) ( $recipe['archetypes'] ?? array( $recipe['archetype'] ?? 'COMMAND_CENTER' ) ),
		'navigation'  => array(
			'mode'   => (string) ( $nav['mode'] ?? 'sidebar' ),
			'mobile' => (string) ( $nav['mobile'] ?? 'drawer' ),
			'items'  => (array) ( $nav['items'] ?? array() ),
		),
		'entry'              => (array) ( $recipe['entry'] ?? array() ),
		'journey'            => (array) ( $recipe['journey'] ?? array() ),
		'screens'            => (array) ( $recipe['screens'] ?? array() ),
		'component_variants' => (array) ( $recipe['component_variants'] ?? array() ),
		'density'            => (string) ( $recipe['density'] ?? 'comfortable' ),
		'progressive_disclosure' => (array) ( $recipe['progressive_disclosure'] ?? array() ),
		'states'             => (array) ( $recipe['states'] ?? array() ),
		'visual_expression'  => (array) ( $recipe['visual_expression'] ?? array() ),
		'data_visualization' => (array) ( $recipe['data_visualization'] ?? array() ),
		'motion'             => (string) ( $recipe['motion'] ?? 'standard' ),
		'mobile_behavior'    => (array) ( $recipe['mobile_behavior'] ?? array() ),
		'completion'         => (array) ( $recipe['completion'] ?? array() ),
		'rescue'             => (array) ( $recipe['rescue'] ?? array() ),
		'empty_states'       => (array) ( $recipe['empty_states'] ?? array() ),
		'tokens'             => swt_xp_tokens( $recipe ),
		'validation'         => $v,
		'explicit'           => ( 'default' !== $src2 ),
	);
	$sig = swt_xp_signals( $ts_id );
	$comp['experience_state'] = swt_xp_state( $ts_id, $recipe, $sig );
	$comp['has_state'] = (bool) $sig['has_state'];
	$resolved = array();
	foreach ( (array) $comp['navigation']['items'] as $it ) { $vw = isset( $it['view'] ) ? $it['view'] : ( isset( $it['id'] ) ? $it['id'] : '' ); if ( '' !== $vw ) { $resolved[ $vw ] = swt_xp_screen( $recipe, $vw, $comp['experience_state'] ); } }
	$comp['screens_resolved'] = $resolved;
	$comp['completion_resolved'] = swt_xp_completion( $recipe, $sig );
	if ( ! empty( $recipe['generic'] ) ) {
		$comp['render'] = 'generic';
		$rawstate = isset( $sig['state'] ) ? $sig['state'] : array();
		$shtml = array();
		foreach ( (array) $comp['navigation']['items'] as $it ) { $vw = isset( $it['view'] ) ? $it['view'] : ( isset( $it['id'] ) ? $it['id'] : '' ); if ( '' === $vw ) { continue; } $shtml[ $vw ] = swt_xp_render_screen( $ts_id, $vw, $recipe, $comp['experience_state'], $rawstate ); }
		$comp['screens_html'] = $shtml;
	} else { $comp['render'] = 'product'; }
	return $comp;
}

/* ============================================================ EXPERIENCE STATE + SCREEN COMPOSITION (F3) */

/** Canonical signals from shared state â€” product-agnostic. */
function swt_xp_signals( $ts_id ) {
	global $wpdb;
	$ts_id = (int) $ts_id;
	$row = $wpdb->get_var( $wpdb->prepare( 'SELECT state_json FROM ' . $wpdb->prefix . 'swt_interactive_state WHERE user_id=%d AND ts_id=%d', get_current_user_id(), $ts_id ) );
	$state = $row ? json_decode( (string) $row, true ) : array();
	if ( ! is_array( $state ) ) { $state = array(); }
	$blocks = isset( $state['blocks'] ) && is_array( $state['blocks'] ) ? $state['blocks'] : array();
	$computed = isset( $state['computed'] ) && is_array( $state['computed'] ) ? $state['computed'] : array();
	$has = false;
	foreach ( $blocks as $b ) {
		if ( ! is_array( $b ) ) { continue; }
		foreach ( $b as $k => $v ) {
			if ( in_array( $k, array( 'rows', 'entries' ), true ) ) { if ( is_array( $v ) && count( $v ) ) { $has = true; } }
			elseif ( '' !== $v && null !== $v ) { $has = true; }
		}
	}
	return array( 'state' => $state, 'computed' => $computed, 'blocks' => $blocks, 'history' => ( isset( $state['history'] ) && is_array( $state['history'] ) ) ? $state['history'] : array(), 'has_state' => $has );
}

/** Dot-path read over a signals context ('state', 'computed' roots). */
function swt_xp_get( $ctx, $path ) {
	$p = explode( '.', (string) $path );
	$o = $ctx;
	foreach ( $p as $k ) {
		if ( 'state' === $k ) { $o = $ctx['state']; continue; }
		if ( 'computed' === $k ) { $o = $ctx['computed']; continue; }
		if ( ! is_array( $o ) || ! array_key_exists( $k, $o ) ) { return null; }
		$o = $o[ $k ];
	}
	return $o;
}

/** Declarative condition evaluation (used by recipe states / disclosure). */
function swt_xp_eval_condition( $cond, $ctx ) {
	if ( ! is_array( $cond ) ) { return false; }
	if ( array_key_exists( 'has_state', $cond ) && ( (bool) $cond['has_state'] !== (bool) $ctx['has_state'] ) ) { return false; }
	if ( array_key_exists( 'no_state', $cond ) && ( (bool) $cond['no_state'] !== ! $ctx['has_state'] ) ) { return false; }
	$val = null; $have = false;
	if ( isset( $cond['path'] ) ) { $val = swt_xp_get( $ctx, $cond['path'] ); $have = true; }
	elseif ( isset( $cond['count'] ) ) { $v = swt_xp_get( $ctx, $cond['count'] ); $val = is_array( $v ) ? count( $v ) : 0; $have = true; }
	if ( $have ) {
		if ( isset( $cond['not_null'] ) && ( ( null !== $val && '' !== $val ) !== (bool) $cond['not_null'] ) ) { return false; }
		if ( isset( $cond['is_null'] ) && ( ( null === $val || '' === $val ) !== (bool) $cond['is_null'] ) ) { return false; }
		if ( isset( $cond['eq'] ) && (string) $val !== (string) $cond['eq'] ) { return false; }
		if ( isset( $cond['neq'] ) && (string) $val === (string) $cond['neq'] ) { return false; }
		if ( isset( $cond['gt'] ) && ! ( (float) $val > (float) $cond['gt'] ) ) { return false; }
		if ( isset( $cond['gte'] ) && ! ( (float) $val >= (float) $cond['gte'] ) ) { return false; }
		if ( isset( $cond['lt'] ) && ! ( (float) $val < (float) $cond['lt'] ) ) { return false; }
		if ( isset( $cond['lte'] ) && ! ( (float) $val <= (float) $cond['lte'] ) ) { return false; }
	}
	return true;
}

/** Resolve the current experience state from recipe rules + canonical signals. */
function swt_xp_state( $ts_id, $recipe, $signals = null ) {
	$sig = $signals ? $signals : swt_xp_signals( $ts_id );
	$states = ( isset( $recipe['states'] ) && is_array( $recipe['states'] ) ) ? $recipe['states'] : array();
	foreach ( $states as $name => $def ) {
		if ( ! is_array( $def ) || empty( $def['when'] ) ) { continue; }
		$conds = ( isset( $def['when'][0] ) && is_array( $def['when'][0] ) ) ? $def['when'] : array( $def['when'] );
		$ok = true;
		foreach ( $conds as $c ) { if ( ! swt_xp_eval_condition( $c, $sig ) ) { $ok = false; break; } }
		if ( $ok ) { return (string) $name; }
	}
	return $sig['has_state'] ? 'active' : 'first_visit';
}

/** Resolve a screen descriptor (layout, component, variant, disclosure) for a view+state. */
function swt_xp_screen( $recipe, $view, $state ) {
	$screens = ( isset( $recipe['screens'] ) && is_array( $recipe['screens'] ) ) ? $recipe['screens'] : array();
	$sc = ( isset( $screens[ $view ] ) && is_array( $screens[ $view ] ) ) ? $screens[ $view ] : array();
	$pd = ( isset( $recipe['progressive_disclosure'] ) && is_array( $recipe['progressive_disclosure'] ) ) ? $recipe['progressive_disclosure'] : array();
	$disclosure = array();
	if ( isset( $pd[ $view ] ) && is_array( $pd[ $view ] ) ) { foreach ( $pd[ $view ] as $k => $v ) { if ( $v ) { $disclosure[] = (string) $k; } } }
	if ( isset( $sc['disclosure'][ $state ] ) && is_array( $sc['disclosure'][ $state ] ) ) { $disclosure = array_merge( $disclosure, (array) $sc['disclosure'][ $state ] ); }
	return array(
		'view'       => (string) $view,
		'state'      => (string) $state,
		'layout'     => (string) ( $sc['layout'] ?? '' ),
		'component'  => (string) ( $sc['component'] ?? '' ),
		'variant'    => (string) ( $sc['variant'] ?? '' ),
		'disclosure' => array_values( array_unique( $disclosure ) ),
	);
}

/** Primary persistent result / completion descriptor (recipe-driven). */
function swt_xp_completion( $recipe, $ctx ) {
	$c = ( isset( $recipe['completion'] ) && is_array( $recipe['completion'] ) ) ? $recipe['completion'] : array();
	$path = isset( $c['primary_path'] ) ? (string) $c['primary_path'] : '';
	$val = ( '' !== $path ) ? swt_xp_get( $ctx, $path ) : null;
	$when = isset( $c['complete_when'] ) ? $c['complete_when'] : null;
	return array(
		'primary_path'  => $path,
		'primary_value' => ( null === $val || '' === $val ) ? null : $val,
		'complete'      => $when ? swt_xp_eval_condition( $when, $ctx ) : false,
	);
}

function swt_xp_tokens( $r ) {
	$ve = (array) ( $r['visual_expression'] ?? array() );
	$amap = array(
		'gold'   => array( '#D9A52E', '#F0C866' ),
		'purple' => array( '#6F35B5', '#A77BE8' ),
		'rust'   => array( '#C07A4A', '#E0A06A' ),
		'navy'   => array( '#0B1F33', '#4A5F8A' ),
	);
	$accent = (string) ( $ve['accent'] ?? 'gold' );
	$pair = isset( $amap[ $accent ] ) ? $amap[ $accent ] : $amap['gold'];
	$density = (string) ( $ve['density'] ?? ( $r['density'] ?? 'comfortable' ) );
	$shape = (string) ( $ve['shape'] ?? '' );
	$temp = (string) ( $ve['temperature'] ?? '' );
	$t = array(
		'--xp-accent'    => $pair[0],
		'--xp-accent-2'  => $pair[1],
		'--xp-density'   => ( 'compact' === $density ) ? '0.9' : ( ( 'spacious' === $density ) ? '1.12' : '1' ),
		'--xp-radius'    => ( 'sharp' === $shape ) ? '8px' : ( ( 'soft' === $shape ) ? '22px' : '16px' ),
		'--xp-ink'       => ( in_array( $temp, array( 'quiet', 'calm' ), true ) ) ? '#E9EEF4' : '#FFFFFF',
	);
	return array( 'accent' => $accent, 'temperature' => $temp, 'density' => $density, 'shape' => ( '' === $shape ? 'standard' : $shape ), 'motion' => (string) ( $r['motion'] ?? 'standard' ), 'vars' => $t );
}

/** Motion level (Phase 9): none | subtle | standard | expressive. */
function swt_xp_motion( $r ) {
	$m = (string) ( $r['motion'] ?? 'standard' );
	return in_array( $m, swt_xp_motions(), true ) ? $m : 'standard';
}

/**
 * Data-visualization grammar (Phase 10). Generic renderers driven ONLY by
 * canonical values passed in. Returns '' when data is missing â€” never fabricates.
 */
function swt_xp_viz( $type, $data ) {
	$type = (string) $type;
	$d = is_array( $data ) ? $data : array();
	switch ( $type ) {
		case 'progress':
			if ( ! isset( $d['pct'] ) ) { return ''; }
			$pct = max( 0, min( 100, (float) $d['pct'] ) );
			return '<div class="xp-viz xp-viz-progress" role="progressbar" aria-valuenow="' . (int) $pct . '" aria-valuemin="0" aria-valuemax="100"><span class="xp-viz-track"><i style="width:' . (float) $pct . '%"></i></span>' . ( isset( $d['label'] ) ? '<em>' . esc_html( (string) $d['label'] ) . '</em>' : '' ) . '</div>';
		case 'status':
			$s = (string) ( $d['status'] ?? '' );
			if ( '' === $s ) { return ''; }
			return '<span class="xp-viz xp-viz-status xp-status-' . esc_attr( strtolower( $s ) ) . '">' . esc_html( (string) ( $d['label'] ?? $s ) ) . '</span>';
		case 'range':
			if ( ! isset( $d['min'] ) || ! isset( $d['max'] ) || ! isset( $d['value'] ) ) { return ''; }
			$span = ( (float) $d['max'] - (float) $d['min'] );
			if ( 0.0 === $span ) { $span = 1.0; }
			$pos = max( 0, min( 100, ( ( (float) $d['value'] - (float) $d['min'] ) / $span ) * 100 ) );
			return '<div class="xp-viz xp-viz-range"><span class="xp-viz-track"><i class="xp-viz-fill"></i><b style="left:' . (float) $pos . '%"></b></span></div>';
		case 'distribution':
			$segs = (array) ( $d['segments'] ?? array() );
			$total = 0.0;
			foreach ( $segs as $s ) { $total += (float) ( $s['value'] ?? 0 ); }
			if ( $total <= 0 ) { return ''; }
			$out = '<div class="xp-viz xp-viz-dist"><span class="xp-viz-track">';
			foreach ( $segs as $s ) { $out .= '<i class="xp-seg-' . esc_attr( strtolower( (string) ( $s['key'] ?? '' ) ) ) . '" style="width:' . ( ( (float) ( $s['value'] ?? 0 ) / $total ) * 100 ) . '%"></i>'; }
			return $out . '</span></div>';
		case 'timeline':
		case 'milestone':
			$items = (array) ( $d['items'] ?? array() );
			if ( ! $items ) { return ''; }
			$out = '<ol class="xp-viz xp-viz-' . ( ( 'timeline' === $type ) ? 'timeline' : 'milestone' ) . '">';
			foreach ( $items as $it ) { $out .= '<li class="' . ( ! empty( $it['done'] ) ? 'done' : '' ) . '">' . esc_html( (string) ( $it['label'] ?? '' ) ) . '</li>'; }
			return $out . '</ol>';
		default:
			return '';
	}
}

function swt_xp_recipe_source( $ts_id ) {
	$ts_id = (int) $ts_id;
	$raw = get_post_meta( $ts_id, '_swiipt_experience_recipe', true );
	if ( is_string( $raw ) && '' !== trim( $raw ) ) { $dec = json_decode( $raw, true ); if ( is_array( $dec ) ) { return 'meta'; } }
	if ( function_exists( 'swt_app2_recipe' ) ) { $rcp = swt_app2_recipe( $ts_id ); if ( is_array( $rcp ) && ! empty( $rcp['experience'] ) && is_array( $rcp['experience'] ) ) { return 'recipe'; } }
	return 'default';
}

function swt_xp_view_module( $recipe, $view ) {
	foreach ( (array) ( $recipe['navigation']['items'] ?? array() ) as $it ) {
		if ( ! is_array( $it ) ) { continue; }
		if ( (string) ( $it['view'] ?? $it['id'] ?? '' ) === (string) $view ) { return (string) ( $it['module'] ?? '' ); }
	}
	return '';
}

function swt_xp_view_label( $recipe, $view ) {
	foreach ( (array) ( $recipe['navigation']['items'] ?? array() ) as $it ) {
		if ( ! is_array( $it ) ) { continue; }
		if ( (string) ( $it['view'] ?? $it['id'] ?? '' ) === (string) $view ) { return (string) ( $it['label'] ?? $view ); }
	}
	return (string) $view;
}

function swt_xp_render_screen( $ts_id, $view, $recipe, $state_str, $rawstate ) {
	$b = get_post_meta( (int) $ts_id, '_swiipt_ix_blocks', true );
	$mods = ( is_array( $b ) && isset( $b['modules'] ) && is_array( $b['modules'] ) ) ? $b['modules'] : array();
	$mid = swt_xp_view_module( $recipe, $view );
	$blocks = ( '' !== $mid && isset( $mods[ $mid ] ) ) ? $mods[ $mid ] : ( isset( $mods[ $view ] ) ? $mods[ $view ] : array() );
	$sc = swt_xp_screen( $recipe, $view, $state_str );
	$cls = 'xp-screen' . ( ! empty( $sc['layout'] ) ? ' xp-layout-' . $sc['layout'] : '' );
	$label = swt_xp_view_label( $recipe, $view );
	$html = '<section class="' . esc_attr( $cls ) . '" data-xp-view="' . esc_attr( $view ) . '">';
	if ( function_exists( 'swt_blocks_render_list' ) && is_array( $blocks ) ) { $html .= swt_blocks_render_list( $blocks, $rawstate, false ); }
	return $html . '</section>';
}

function swt_xp_save_recipe( $ts_id, $recipe ) {
	if ( ! is_array( $recipe ) ) { return false; }
	$json = wp_json_encode( $recipe, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
	update_post_meta( (int) $ts_id, '_swiipt_experience_recipe', wp_slash( $json ) );
	return true;
}
