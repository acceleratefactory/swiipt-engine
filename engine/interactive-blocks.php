<?php
/**
 * Module: SWIIPT INTERACTIVE BLOCK LIBRARY v1 (Family Money ΓÇö Step B)
 *
 * Layer 2 (interaction blocks) + Layer 3 (transformation state) + Layer 4 (product config) of
 * Task/Mae.md. A product's interactive version is a COMPOSITION of block specs, never bespoke code.
 *
 * BLOCK SPEC
 *   { type:'FORM', id:'quiz-costs', title:'Recurring costs', intro:'ΓÇª', ...typeProps }
 *   `id` is unique within a module and is the state key.
 *
 * STATE (per user ├ù product, stored in {prefix}swt_interactive_state)
 *   state.blocks[<id>]      = { fieldsΓÇª, rows:[ΓÇª], answers:[ΓÇª], outcome, done:bool }
 *   state.computed[<path>]  = number            (server-authoritative; calculators only)
 *   state.meta[<id>]        = { updated, next_due, ΓÇª }
 *
 * Calculators are DECLARATIVE (no eval) and recomputed server-side on every save, so the client can
 * never persist a number the mechanism did not produce.
 *
 * The SaaS shell (interactive-saas.php) exposes three seams ΓÇö this file only plugs into those:
 *   filter swt_saas_views ┬╖ filter swt_saas_module_html ┬╖ action swt_saas_enqueue
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

/** Storage: the new-shape block compositions live in their own meta (never the legacy config). */
const SWT_BLOCKS_META = '_swiipt_ix_blocks';

/* =============================================================== registry */

/** The block vocabulary. `impl` = renderer available in v1. */
function swt_block_types() {
	return array(
		'INTRO'             => array( 'label' => 'Intro',              'impl' => true ),
		'CARD'              => array( 'label' => 'Card',               'impl' => true ),
		'CALLOUT'          => array( 'label' => 'Callout',             'impl' => true ),
		'STATS'            => array( 'label' => 'Stats',               'impl' => true ),
		'DASHBOARD'        => array( 'label' => 'Dashboard',           'impl' => true ),
		'STATUS'            => array( 'label' => 'Status',             'impl' => true ),
		'PROGRESS'          => array( 'label' => 'Progress',           'impl' => true ),
		'STEP_FLOW'         => array( 'label' => 'Step flow',          'impl' => true ),
		'FORM'              => array( 'label' => 'Form',               'impl' => true ),
		'REPEATER'          => array( 'label' => 'Repeater',           'impl' => true ),
		'CALCULATOR'        => array( 'label' => 'Calculator',         'impl' => true ),
		'RESULT'            => array( 'label' => 'Result',             'impl' => true ),
		'DECISION_TREE'     => array( 'label' => 'Decision tree',      'impl' => true ),
		'CHECKLIST'         => array( 'label' => 'Checklist',          'impl' => true ),
		'PLAN'              => array( 'label' => 'Plan',               'impl' => true ),
		'LOG'               => array( 'label' => 'Log',                'impl' => true ),
		'TRACKER'           => array( 'label' => 'Tracker',            'impl' => true ),
		'COMPARISON'        => array( 'label' => 'Comparison',         'impl' => true ),
		'DATE'              => array( 'label' => 'Date',               'impl' => true ),
		'REMINDER'          => array( 'label' => 'Reminder',           'impl' => true ),
		'REVIEW'            => array( 'label' => 'Review',             'impl' => true ),
		'RESCUE'            => array( 'label' => 'Rescue',             'impl' => true ),
		'GENERATE_DOCUMENT' => array( 'label' => 'Generate document',  'impl' => true ),
		'NOTE'              => array( 'label' => 'Note',               'impl' => true ),
		'SAFETY'            => array( 'label' => 'Safety',             'impl' => true ),
		'CONTINUATION'      => array( 'label' => 'Continuation',       'impl' => true ),
		'SHARE'             => array( 'label' => 'Share',              'impl' => true ),
		'HISTORY'           => array( 'label' => 'History',            'impl' => true ),
		'SCRIPT'            => array( 'label' => 'Script card',        'impl' => true ),
		/* declared, not yet implemented ΓÇö the vocabulary stays honest */
		'QUESTION'          => array( 'label' => 'Question',           'impl' => false ),
		'UPLOAD'            => array( 'label' => 'Upload',             'impl' => false ),
		'TIMELINE'          => array( 'label' => 'Timeline',           'impl' => false ),
	);
}

/* =============================================================== helpers */

/** Read a dot-path from the state ('' ΓçÆ null). */
function swt_bl_get( $state, $path ) {
	if ( ! is_string( $path ) || '' === $path ) { return null; }
	$cur = $state;
	foreach ( explode( '.', $path ) as $k ) {
		if ( is_array( $cur ) && array_key_exists( $k, $cur ) ) { $cur = $cur[ $k ]; }
		else { return null; }
	}
	return $cur;
}

/** Write a dot-path into the state (by reference). */
function swt_bl_set( &$state, $path, $value ) {
	if ( ! is_string( $path ) || '' === $path ) { return; }
	$keys = explode( '.', $path );
	$cur  =& $state;
	foreach ( $keys as $k ) {
		if ( ! isset( $cur[ $k ] ) || ! is_array( $cur[ $k ] ) ) { $cur[ $k ] = array(); }
		$cur =& $cur[ $k ];
	}
	$cur = $value;
}

/** Display money in the household's own currency (never a converted figure). */
function swt_bl_money( $n ) {
	if ( ! is_numeric( $n ) ) { return ''; }
	$sym = function_exists( 'get_woocommerce_currency_symbol' ) ? get_woocommerce_currency_symbol() : '';
	return esc_html( $sym . number_format( (float) $n, 0 ) );
}

/** Short, safe string for an attribute. */
function swt_bl_attr( $v ) { return esc_attr( is_scalar( $v ) ? (string) $v : '' ); }

/** A number field/label formatting option. */
function swt_bl_num( $v ) {
	if ( ! is_numeric( $v ) ) { return null; }
	return (float) $v;
}

/* =============================================================== calculators (server-authoritative) */

/** Write a dotted output path as real nesting so readers can use normal dot-paths. */
function swt_bl_nested_set( $arr, $path, $value ) {
	$keys = explode( '.', (string) $path );
	$cur  =& $arr;
	foreach ( $keys as $k ) {
		if ( ! isset( $cur[ $k ] ) || ! is_array( $cur[ $k ] ) ) { $cur[ $k ] = array(); }
		$cur =& $cur[ $k ];
	}
	$cur = $value;
	return $arr;
}


/** The declarative op table. No eval, no arithmetic the mechanism did not define. */
function swt_bl_ops() {
	return array( 'sum', 'subtract', 'multiply', 'divide', 'min', 'max', 'average', 'diff', 'percent_of', 'annualize', 'monthly', 'round', 'sum_mul', 'coalesce', 'count' );
}

/** Resolve an op input: a state path, or a literal in {lit: x}. */
function swt_bl_resolve_input( $in, $state ) {
	if ( is_array( $in ) && array_key_exists( 'lit', $in ) ) { return $in['lit']; }
	if ( is_array( $in ) && ! empty( $in['column'] ) ) {
		$rows = swt_bl_get( $state, (string) ( $in['path'] ?? $in['rows'] ?? '' ) );
		return swt_bl_column_sum( $rows, (string) $in['column'], (string) ( $in['where_field'] ?? '' ), (string) ( $in['where_eq'] ?? '' ), (array) ( $in['where_in'] ?? array() ) );
	}
	if ( is_numeric( $in ) ) { return (float) $in; }
	$v = swt_bl_get( $state, is_string( $in ) ? $in : '' );
	if ( is_array( $v ) ) {
		$nums = array();
		foreach ( $v as $x ) { if ( is_numeric( $x ) ) { $nums[] = (float) $x; } }
		return $nums ? array_sum( $nums ) : null;
	}
	return is_numeric( $v ) ? (float) $v : null;
}

/** Sum one numeric column across collected rows (null when nothing is entered yet). */
function swt_bl_column_sum( $rows, $col, $where_field = '', $where_eq = '', $where_in = array() ) {
	if ( ! is_array( $rows ) || '' === $col ) { return null; }
	$sum = null;
	foreach ( $rows as $r ) {
		if ( ! is_array( $r ) || ! isset( $r[ $col ] ) || ! is_numeric( $r[ $col ] ) ) { continue; }
		if ( '' !== $where_field ) {
			$have = isset( $r[ $where_field ] ) ? (string) $r[ $where_field ] : '';
			if ( is_array( $where_in ) && $where_in ) {
				$ok = false; foreach ( $where_in as $w ) { if ( (string) $w === $have ) { $ok = true; break; } }
				if ( ! $ok ) { continue; }
			} elseif ( $have !== (string) $where_eq ) { continue; }
		}
		$sum = ( null === $sum ? 0.0 : $sum ) + (float) $r[ $col ];
	}
	return $sum;
}

/** Count rows matching a filter ('' col counts all rows). */
function swt_bl_column_count( $rows, $col = '', $where_field = '', $where_eq = '', $where_in = array() ) {
	if ( ! is_array( $rows ) ) { return null; }
	$n = 0;
	foreach ( $rows as $r ) {
		if ( ! is_array( $r ) ) { continue; }
		if ( '' !== $col && ! isset( $r[ $col ] ) ) { continue; }
		if ( '' !== $where_field ) {
			$v = isset( $r[ $where_field ] ) ? (string) $r[ $where_field ] : '';
			if ( is_array( $where_in ) && $where_in ) { $ok = false; foreach ( $where_in as $w ) { if ( (string) $w === $v ) { $ok = true; break; } } if ( ! $ok ) { continue; } }
			elseif ( $v !== (string) $where_eq ) { continue; }
		}
		$n++;
	}
	return $n;
}

/** Highest / lowest value in one column across rows (null when nothing is entered). */
function swt_bl_column_stat( $rows, $col, $mode = 'max' ) {
	if ( ! is_array( $rows ) || '' === $col ) { return null; }
	$vals = array();
	foreach ( $rows as $r ) {
		if ( is_array( $r ) && isset( $r[ $col ] ) && is_numeric( $r[ $col ] ) ) { $vals[] = (float) $r[ $col ]; }
	}
	if ( ! $vals ) { return null; }
	return ( 'min' === $mode ) ? min( $vals ) : max( $vals );
}

/** Sum (column_a * column_b) across rows - e.g. amount x times_per_year. */
function swt_bl_column_sum_mul( $rows, $col, $times ) {
	if ( ! is_array( $rows ) || '' === $col || '' === $times ) { return null; }
	$sum = null;
	foreach ( $rows as $r ) {
		if ( ! is_array( $r ) ) { continue; }
		$a = $r[ $col ] ?? null; $b = $r[ $times ] ?? null;
		if ( is_numeric( $a ) && is_numeric( $b ) ) { $sum = ( null === $sum ? 0.0 : $sum ) + ( (float) $a * (float) $b ); }
	}
	return $sum;
}

/**
 * Recompute every CALCULATOR op across a module's blocks. Returns the computed map.
 * A missing input yields NULL (an honest gap) ΓÇö never 0, never a guess.
 */
function swt_blocks_compute( $blocks, $state ) {
	$computed = array();
	$ops      = array();
	$collect  = function ( $list ) use ( &$ops, &$collect ) {
		foreach ( (array) $list as $b ) {
			if ( ! is_array( $b ) ) { continue; }
			foreach ( (array) ( $b['ops'] ?? array() ) as $op ) { $ops[] = $op; }
			if ( 'STEP_FLOW' === ( $b['type'] ?? '' ) ) {
				foreach ( (array) ( $b['steps'] ?? array() ) as $stp ) { $collect( $stp['blocks'] ?? array() ); }
			}
		}
	};
	$collect( $blocks );
	/* two passes so an op may read an earlier op's output */
	for ( $pass = 0; $pass < 2; $pass++ ) {
		foreach ( $ops as $op ) {
			$name = (string) ( $op['op'] ?? '' );
			$out  = (string) ( $op['output'] ?? '' );
			if ( '' === $name || '' === $out || ! in_array( $name, swt_bl_ops(), true ) ) { continue; }
			$vals = array();
			if ( 'count' === $name && ! empty( $op['inputs'][0] ) ) {
				$sp = $op['inputs'][0];
				$rw = swt_bl_get( $state, (string) ( $sp['path'] ?? '' ) );
				$vals = array( swt_bl_column_count( $rw, (string) ( $sp['column'] ?? '' ), (string) ( $sp['where_field'] ?? '' ), (string) ( $sp['where_eq'] ?? '' ), (array) ( $sp['where_in'] ?? array() ) ) );
			} elseif ( ( 'max' === $name || 'min' === $name ) && ! empty( $op['inputs'][0]['column'] ) ) {
				$sp = $op['inputs'][0];
				$rw = swt_bl_get( $state, (string) ( $sp['path'] ?? $sp['rows'] ?? '' ) );
				$vals = array( swt_bl_column_stat( $rw, (string) $sp['column'], $name ) );
			} elseif ( 'sum_mul' === $name && ! empty( $op['inputs'][0]['column'] ) ) {
				$spec = $op['inputs'][0];
				$rows = swt_bl_get( $state, (string) ( $spec['path'] ?? $spec['rows'] ?? '' ) );
				$vals = array( swt_bl_column_sum_mul( $rows, (string) $spec['column'], (string) ( $spec['times'] ?? '' ) ) );
			} else {
			foreach ( (array) ( $op['inputs'] ?? array() ) as $in ) {

				if ( is_string( $in ) && null !== swt_bl_get( $computed, $in ) ) { $vals[] = swt_bl_get( $computed, $in ); }
				else { $vals[] = swt_bl_resolve_input( $in, $state ); }
			}
			}
			$have = array(); foreach ( $vals as $v ) { if ( is_numeric( $v ) ) { $have[] = (float) $v; } }

			$n = count( $have ); $res = null;
			switch ( $name ) {
				case 'sum':        $res = $n ? array_sum( $have ) : null; break;
				case 'subtract':   $res = ( $n >= 2 ) ? ( $have[0] - $have[1] ) : null; break;
				case 'multiply':   $res = $n ? array_product( $have ) : null; break;
				case 'divide':     $res = ( $n >= 2 && 0.0 != (float) $have[1] ) ? ( $have[0] / $have[1] ) : null; break;
				case 'min':        $res = $n ? min( $have ) : null; break;
				case 'max':        $res = $n ? max( $have ) : null; break;
				case 'average':    $res = $n ? ( array_sum( $have ) / $n ) : null; break;
				case 'diff':       $res = ( $n >= 2 ) ? abs( $have[0] - $have[1] ) : null; break;
				case 'percent_of': $res = ( $n >= 2 && 0.0 != (float) $have[1] ) ? ( ( $have[0] / $have[1] ) * 100.0 ) : null; break;
				case 'sum_mul':    $res = ( $n >= 1 ) ? (float) $have[0] : null; break;
				case 'coalesce':   $res = ( $n >= 1 ) ? (float) $have[0] : null; break;   // first value that exists
				case 'count':      $res = ( $n >= 1 ) ? (float) $have[0] : null; break;
			case 'annualize':  $res = ( $n >= 1 ) ? ( (float) $have[0] * ( is_numeric( $op['factor'] ?? null ) ? (float) $op['factor'] : 12.0 ) ) : null; break;
				case 'monthly':    $res = ( $n >= 1 && is_numeric( $op['per_year'] ?? null ) && (float) $op['per_year'] > 0 ) ? ( ( (float) $have[0] * 12.0 ) / (float) $op['per_year'] ) : null; break;
				case 'round':      $res = ( $n >= 1 ) ? round( (float) $have[0], (int) ( $op['decimals'] ?? 0 ) ) : null; break;
			}
			if ( null !== $res && 'round' !== $name && isset( $op['round'] ) && is_numeric( $op['round'] ) ) {
				$res = round( (float) $res, (int) $op['round'] );
			}
			$computed = swt_bl_nested_set( $computed, $out, $res );
		}
	}
	return $computed;
}

/** Recompute a whole product state (all modules) and fold the results back into state.computed. */
function swt_blocks_recompute_state( $ts_id, $state ) {
	$store = swt_blocks_store( $ts_id );
	/* One shared compute namespace: flatten every module's blocks so a later module can read an
	   earlier module's outputs (Module 02 reads the Module 01 profile). */
	$flat = array();
	foreach ( (array) ( $store['modules'] ?? array() ) as $slug => $blocks ) {
		foreach ( (array) $blocks as $b ) { $flat[] = $b; }
	}
	$all = swt_blocks_compute( $flat, $state );
	if ( ! is_array( $state['computed'] ?? null ) ) { $state['computed'] = array(); }
	$state['computed'] = $all;
	return $state;
}

/** Document specs (GENERATE_DOCUMENT targets) for a product. */
function swt_blocks_documents( $ts_id ) {
	$store = swt_blocks_store( $ts_id );
	return is_array( $store['documents'] ?? null ) ? $store['documents'] : array();
}

/** The stored composition for a product. */
function swt_blocks_store( $ts_id ) {
	$s = get_post_meta( (int) $ts_id, SWT_BLOCKS_META, true );
	return is_array( $s ) ? $s : array( 'modules' => array(), 'documents' => array() );
}

/* =============================================================== validation */

/** Validate one block spec. Returns a list of errors ([] = valid). */
function swt_block_validate( $spec ) {
	$e = array();
	if ( ! is_array( $spec ) ) { return array( 'block is not an object' ); }
	$type = (string) ( $spec['type'] ?? '' );
	$id   = (string) ( $spec['id'] ?? '' );
	$reg  = swt_block_types();
	if ( '' === $type || ! isset( $reg[ $type ] ) ) { return array( 'unknown block type "' . $type . '"' ); }
	if ( '' === $id ) { $e[] = 'block id is required'; }
	if ( empty( $reg[ $type ]['impl'] ) ) { $e[] = 'block type ' . $type . ' is declared but not implemented'; }
	switch ( $type ) {
		case 'STEP_FLOW':
			if ( empty( $spec['steps'] ) || ! is_array( $spec['steps'] ) ) { $e[] = 'STEP_FLOW needs steps[]'; }
			else { foreach ( $spec['steps'] as $i => $s ) { if ( empty( $s['title'] ) ) { $e[] = "steps[$i] needs a title"; } } }
			break;
		case 'FORM': case 'LOG': case 'TRACKER':
			if ( empty( $spec['fields'] ) || ! is_array( $spec['fields'] ) ) { $e[] = $type . ' needs fields[]'; }
			else { foreach ( $spec['fields'] as $i => $f ) { if ( empty( $f['id'] ) || empty( $f['label'] ) ) { $e[] = "fields[$i] needs id and label"; } } }
			break;
		case 'REPEATER':
			if ( empty( $spec['columns'] ) || ! is_array( $spec['columns'] ) ) { $e[] = 'REPEATER needs columns[]'; }
			break;
		case 'CALCULATOR':
			if ( empty( $spec['ops'] ) || ! is_array( $spec['ops'] ) ) { $e[] = 'CALCULATOR needs ops[]'; }
			else {
				foreach ( $spec['ops'] as $i => $op ) {
					if ( empty( $op['op'] ) || ! in_array( $op['op'], swt_bl_ops(), true ) ) { $e[] = "ops[$i] unknown op"; }
					if ( empty( $op['output'] ) ) { $e[] = "ops[$i] needs output"; }
				}
			}
			break;
		case 'RESULT':
			if ( empty( $spec['rows'] ) || ! is_array( $spec['rows'] ) ) { $e[] = 'RESULT needs rows[]'; }
			else { foreach ( $spec['rows'] as $i => $r ) { if ( empty( $r['label'] ) || empty( $r['path'] ) ) { $e[] = "rows[$i] needs label and path"; } } }
			break;
		case 'DECISION_TREE':
			if ( empty( $spec['start'] ) || empty( $spec['nodes'] ) || ! is_array( $spec['nodes'] ) ) { $e[] = 'DECISION_TREE needs start + nodes'; }
			else {
				if ( ! isset( $spec['nodes'][ $spec['start'] ] ) ) { $e[] = 'start node does not exist'; }
				foreach ( $spec['nodes'] as $nid => $node ) {
					foreach ( (array) ( $node['options'] ?? array() ) as $oi => $o ) {
						if ( empty( $o['label'] ) ) { $e[] = "nodes[$nid].options[$oi] needs a label"; }
						$next = $o['next'] ?? null;
						if ( $next && ! isset( $spec['nodes'][ $next ] ) && empty( $spec['outcomes'][ $next ] ) && empty( $o['outcome'] ) ) { $e[] = "nodes[$nid].options[$oi] points at unknown node/outcome \"$next\""; }
						if ( ! $next && empty( $o['outcome'] ) ) { $e[] = "nodes[$nid].options[$oi] is terminal but has no outcome"; }
					}
				}
			}
			break;
		case 'CHECKLIST': case 'PLAN':
			if ( empty( $spec['items'] ) && empty( $spec['steps'] ) ) { $e[] = $type . ' needs items[]/steps[]'; }
			break;
		case 'RESCUE':
			if ( empty( $spec['steps'] ) ) { $e[] = 'RESCUE needs steps[]'; }
			break;
		case 'GENERATE_DOCUMENT':
			if ( empty( $spec['doc_id'] ) ) { $e[] = 'GENERATE_DOCUMENT needs doc_id'; }
			break;
		case 'DATE': case 'REMINDER':
			// these key their own value off the block id, so no extra path is required
			break;
		case 'CARD': case 'STATUS': case 'RESULT': case 'REVIEW': case 'NOTE':
			break;
	}
	return $e;
}

/** Validate a list of blocks (and their nested STEP_FLOW children). */
function swt_blocks_validate( $blocks ) {
	$errors = array(); $seen = array();
	foreach ( (array) $blocks as $i => $b ) {
		foreach ( swt_block_validate( $b ) as $m ) { $errors[] = "[$i] " . $m; }
		$id = (string) ( $b['id'] ?? '' );
		if ( '' !== $id ) { if ( isset( $seen[ $id ] ) ) { $errors[] = "duplicate block id \"$id\""; } $seen[ $id ] = true; }
		if ( 'STEP_FLOW' === ( $b['type'] ?? '' ) && ! empty( $b['steps'] ) ) {
			foreach ( $b['steps'] as $si => $s ) {
				foreach ( swt_blocks_validate( $s['blocks'] ?? array() ) as $m ) { $errors[] = "[$i].steps[$si] " . $m; }
			}
		}
	}
	return $errors;
}


/* =============================================================== rendering */

/** Dispatch one block spec to its renderer. Returns '' when the type is not implemented. */
/** Re-rendered HISTORY blocks so a save updates the log without a page reload. */
function swt_blocks_history_html( $ts_id, $state ) {
	$out   = array();
	$store = swt_blocks_store( $ts_id );
	$walk  = function ( $blocks ) use ( &$out, &$walk, $state ) {
		foreach ( (array) $blocks as $b ) {
			if ( ! is_array( $b ) ) { continue; }
			$id = (string) ( $b['id'] ?? '' );
			if ( 'HISTORY' === ( $b['type'] ?? '' ) && '' !== $id ) { $out[ $id ] = swt_block_render( $b, $state, ! empty( $b['plain'] ) ); }
			if ( 'STEP_FLOW' === ( $b['type'] ?? '' ) ) { foreach ( (array) ( $b['steps'] ?? array() ) as $stp ) { $walk( $stp['blocks'] ?? array() ); } }
		}
	};
	foreach ( (array) ( $store['modules'] ?? array() ) as $bs ) { $walk( $bs ); }
	return $out;
}
function swt_block_render( $spec, $state = array(), $bare = false ) {
	if ( ! is_array( $spec ) ) { return ''; }
	$type = (string) ( $spec['type'] ?? '' );
	$id   = (string) ( $spec['id'] ?? '' );
	$fn   = 'swt_bl_' . strtolower( $type );
	if ( ! function_exists( $fn ) ) { return ''; }
	/* hidden = computed but never shown (keeps its calculators available to documents) */
	if ( ! empty( $spec['hidden'] ) ) { return ''; }
	$inner = call_user_func( $fn, $spec, $state );
	if ( '' === $inner ) { return ''; }
	if ( $bare ) { return $inner; }
	/* plain = no card wrapper (a stat-grid is its own surface) */
	if ( ! empty( $spec['plain'] ) ) { return $inner; }
	$ids = ( '' !== $id ) ? ' id="bl-' . swt_bl_attr( $id ) . '" data-swt-block-id="' . swt_bl_attr( $id ) . '"' : '';
	if ( 'STEP_FLOW' === $type ) {
		return '<section class="swt-bl-flow"' . $ids . '>' . $inner . '</section>';
	}
	$cls = 'swt-bl swt-bl-' . strtolower( str_replace( '_', '-', $type ) ) . ( ! empty( $spec['wide'] ) ? ' wide' : '' );
	if ( ! empty( $spec['plain'] ) ) { $cls .= ' swt-bl-plain'; }
	$open = '<section class="';
	$out  = $open . swt_bl_attr( $cls ) . '"' . $ids . '>';
	if ( '' !== trim( (string) ( $spec['title'] ?? '' ) ) ) { $out .= '<h3 class="swt-bl-title">' . esc_html( $spec['title'] ) . '</h3>'; }
	if ( '' !== trim( (string) ( $spec['intro'] ?? '' ) ) ) { $out .= '<p class="swt-bl-intro">' . esc_html( $spec['intro'] ) . '</p>'; }
	return $out . $inner . '</section>';
}

/** Render an ordered list of blocks. */
function swt_blocks_render_list( $blocks, $state = array(), $bare = false ) {
	$out = '';
	foreach ( (array) $blocks as $b ) { $out .= swt_block_render( $b, $state, $bare ); }
	return $out;
}

/** The block's own state slice. */
function swt_bl_state( $state, $id ) {
	$s = $state['blocks'][ $id ] ?? null;
	return is_array( $s ) ? $s : array();
}

/** One labelled input bound to the block state. */
function swt_bl_input( $f, $block_id, $value = null, $row = null ) {
	$type  = (string) ( $f['type'] ?? 'text' );
	$fid   = (string) ( $f['id'] ?? '' );
	$label = (string) ( $f['label'] ?? $fid );
	$id    = 'swt-f-' . $block_id . ( null === $row ? '' : '-r' . (int) $row ) . '-' . $fid;
	$dn    = ' data-swt-block="' . swt_bl_attr( $block_id ) . '" data-swt-field="' . swt_bl_attr( $fid ) . '"';
	if ( null !== $row ) { $dn .= ' data-swt-row="' . (int) $row . '"'; }
	if ( ! empty( $f['required'] ) ) { $dn .= ' data-swt-required="1"'; }
	$ph    = swt_bl_attr( $f['placeholder'] ?? '' );
	$val   = ( null === $value || is_array( $value ) ) ? '' : (string) $value;
	$unit  = trim( (string) ( $f['unit'] ?? '' ) );
	$out   = '<label class="swt-fld" for="' . swt_bl_attr( $id ) . '"><span class="swt-fld-l">' . esc_html( $label ) . ( ! empty( $f['required'] ) ? ' <i>*</i>' : '' ) . '</span>';
	$attr  = ' id="' . swt_bl_attr( $id ) . '"' . $dn . ' placeholder="' . $ph . '"';
	if ( 'textarea' === $type ) {
		$out .= '<textarea rows="' . (int) ( $f['rows'] ?? 3 ) . '"' . $attr . '>' . esc_textarea( $val ) . '</textarea>';
	} elseif ( 'select' === $type ) {
		$out .= '<select' . $attr . '>';
		$out .= '<option value="">' . esc_html( $f['placeholder'] ?? 'ChooseΓÇª' ) . '</option>';
		foreach ( (array) ( $f['options'] ?? array() ) as $k => $o ) {
			$ov = is_array( $o ) ? (string) ( $o['value'] ?? $k ) : (string) $k;
			$ol = is_array( $o ) ? (string) ( $o['label'] ?? $ov ) : (string) $o;
			$out .= '<option value="' . swt_bl_attr( $ov ) . '"' . ( (string) $val === $ov ? ' selected' : '' ) . '>' . esc_html( $ol ) . '</option>';
		}
		$out .= '</select>';
	} else {
		$extra = '';
		if ( 'number' === $type ) {
			$extra .= ' inputmode="decimal"';
			if ( isset( $f['min'] ) ) { $extra .= ' min="' . swt_bl_attr( $f['min'] ) . '"'; }
			if ( isset( $f['max'] ) ) { $extra .= ' max="' . swt_bl_attr( $f['max'] ) . '"'; }
			$extra .= ' step="' . swt_bl_attr( $f['step'] ?? 'any' ) . '"';
		}
		if ( 'date' === $type ) { $extra .= ' type="date"'; } else { $extra .= ' type="' . swt_bl_attr( $type ) . '"'; }
		$out .= '<input' . $attr . ' value="' . swt_bl_attr( $val ) . '"' . $extra . '/>';
	}
	if ( $unit ) { $out .= '<span class="swt-fld-u">' . esc_html( $unit ) . '</span>'; }
	if ( '' !== trim( (string) ( $f['help'] ?? '' ) ) ) { $out .= '<span class="swt-fld-h">' . esc_html( $f['help'] ) . '</span>'; }
	return $out . '</label>';
}

/* ---------------------------------------------------------------- simple blocks */

function swt_bl_intro( $s, $state ) {
	$out = '';
	if ( ! empty( $s['bullets'] ) ) {
		$out .= '<ul class="swt-bl-bullets">';
		foreach ( (array) $s['bullets'] as $b ) { $out .= '<li>' . esc_html( $b ) . '</li>'; }
		$out .= '</ul>';
	}
	if ( '' !== trim( (string) ( $s['body'] ?? '' ) ) ) { $out .= '<p>' . esc_html( $s['body'] ) . '</p>'; }
	return $out;
}

function swt_bl_card( $s, $state ) {
	$path = (string) ( $s['value_path'] ?? '' );
	$v    = $path ? swt_bl_get( $state, $path ) : null;
	if ( null === $v && isset( $s['computed'] ) ) { $v = swt_bl_get( $state, 'computed.' . $s['computed'] ); }
	$show = ( null === $v || '' === $v )
		? '<span class="swt-gap">' . esc_html( $s['when_empty'] ?? 'Not set yet' ) . '</span>'
		: ( ! empty( $s['money'] ) ? swt_bl_money( $v ) : esc_html( (string) $v ) );
	return '<div class="swt-card"><span class="swt-card-l">' . esc_html( $s['label'] ?? '' ) . '</span>'
		. '<b class="swt-card-v" data-swt-live="' . swt_bl_attr( $path ) . '">' . $show . '</b>'
		. ( '' !== trim( (string) ( $s['note'] ?? '' ) ) ? '<span class="swt-card-n">' . esc_html( $s['note'] ) . '</span>' : '' ) . '</div>';
}

function swt_bl_status( $s, $state ) {
	$path = (string) ( $s['value_path'] ?? '' );
	$v    = $path ? swt_bl_get( $state, $path ) : null;
	$tone = in_array( (string) ( $s['tone'] ?? '' ), array( 'ok', 'warn', 'bad', 'info' ), true ) ? $s['tone'] : 'info';
	$text = ( null === $v || '' === $v ) ? (string) ( $s['when_empty'] ?? 'Not set yet' ) : (string) $v;
	return '<div class="swt-status swt-' . swt_bl_attr( $tone ) . '"><span class="dot"></span><span class="t">' . esc_html( $s['label'] ?? '' ) . '</span>'
		. ( '' !== $path ? '<b data-swt-live="' . swt_bl_attr( $path ) . '">' . esc_html( $text ) . '</b>' : '' ) . '</div>';
}

function swt_bl_progress( $s, $state ) {
	$sources = (array) ( $s['done_sources'] ?? $s['items'] ?? array() );
	$total = 0; $done = 0;
	foreach ( $sources as $src ) {
		$total++;
		$key = is_array( $src ) ? (string) ( $src['path'] ?? '' ) : (string) $src;
		$v   = '' !== $key ? swt_bl_get( $state, $key ) : null;
		if ( ! empty( $v ) ) { $done++; }
	}
	$pct = $total ? (int) round( ( $done / $total ) * 100 ) : 0;
	return '<div class="swt-prog"><div class="swt-prog-t"><span>' . esc_html( $s['label'] ?? 'Progress' ) . '</span><b>' . $done . ' of ' . $total . '</b></div>'
		. '<div class="swt-prog-bar" role="progressbar" aria-valuenow="' . $pct . '" aria-valuemin="0" aria-valuemax="100"><i style="width:' . $pct . '%"></i></div>'
		. ( '' !== trim( (string) ( $s['note'] ?? '' ) ) ? '<p class="swt-bl-intro">' . esc_html( $s['note'] ) . '</p>' : '' ) . '</div>';
}

function swt_bl_note( $s, $state ) {
	$id = (string) ( $s['id'] ?? '' );
	$st = swt_bl_state( $state, $id );
	return swt_bl_input( array( 'id' => 'text', 'label' => $s['label'] ?? 'Note', 'type' => 'textarea', 'rows' => $s['rows'] ?? 3, 'placeholder' => $s['placeholder'] ?? '' ), $id, $st['text'] ?? '' );
}

function swt_bl_safety( $s, $state ) {
	$out = '<div class="swt-safety"><b>' . esc_html( $s['title'] ?? 'Scope and boundaries' ) . '</b>';
	if ( '' !== trim( (string) ( $s['body'] ?? '' ) ) ) { $out .= '<p>' . esc_html( $s['body'] ) . '</p>'; }
	if ( ! empty( $s['items'] ) ) {
		$out .= '<ul>';
		foreach ( (array) $s['items'] as $i ) { $li = is_array( $i ) ? (string) ( $i['label'] ?? $i['text'] ?? '' ) : (string) $i; if ( '' !== $li ) { $out .= '<li>' . esc_html( $li ) . '</li>'; } }
		$out .= '</ul>';
	}
	if ( ! empty( $s['crisis'] ) ) {
		$out .= '<div class="swt-crisis">';
		foreach ( (array) $s['crisis'] as $c ) {
			$lbl = esc_html( $c['label'] ?? '' );
			$val = esc_html( $c['value'] ?? '' );
			$out .= '' !== ( $c['href'] ?? '' )
				? '<a href="' . esc_url( $c['href'] ) . '"><span>' . $lbl . '</span><b>' . $val . '</b></a>'
				: '<span class="row"><span>' . $lbl . '</span><b>' . $val . '</b></span>';
		}
		$out .= '</div>';
	}
	return $out . '</div>';
}

function swt_bl_continuation( $s, $state ) {
	$href = (string) ( $s['href'] ?? '' );
	if ( '' === $href && ! empty( $s['view'] ) ) {
		$href = add_query_arg( array( 'swiipt_app' => swt_blocks_ts(), 'v' => sanitize_key( (string) $s['view'] ) ), home_url( '/' ) );
	}
	if ( '' === $href ) { return ''; }
	return '<div class="swt-cont"><div><b>' . esc_html( $s['title'] ?? 'What comes next' ) . '</b>'
		. ( '' !== trim( (string) ( $s['body'] ?? '' ) ) ? '<p>' . esc_html( $s['body'] ) . '</p>' : '' ) . '</div>'
		. '<a class="swt-btn" href="' . esc_url( $href ) . '">' . esc_html( $s['label'] ?? 'Continue' ) . '</a></div>';
}

function swt_bl_share( $s, $state ) {
	$paths = (array) ( $s['paths'] ?? array() );
	$lines = array();
	foreach ( $paths as $p ) {
		$v = swt_bl_get( $state, is_array( $p ) ? (string) ( $p['path'] ?? '' ) : (string) $p );
		if ( null === $v || '' === $v ) { continue; }
		$label = is_array( $p ) ? (string) ( $p['label'] ?? ( $p['path'] ?? '' ) ) : (string) $p;
		$lines[] = $label . ': ' . ( is_numeric( $v ) ? swt_bl_money( $v ) : (string) $v );
	}
	$txt = implode( ' | ', $lines );
	$ic  = function_exists( 'swt_ds_icon' ) ? (string) swt_ds_icon( (string) ( $s['icon'] ?? 'copy' ) ) : '';
	$btn = '<button type="button" class="swt-btn ghost" data-swt-copy="' . swt_bl_attr( $txt ) . '">'
		. ( '' !== trim( $ic ) ? $ic : '' ) . esc_html( $s['label'] ?? 'Copy summary' ) . '</button>';
	if ( ! empty( $s['plain'] ) ) { return $btn; }
	return '<div class="swt-share"><p class="swt-muted">' . esc_html( $s['note'] ?? 'Share only what you choose.' ) . '</p>'
		. $btn . ( '' === $txt ? '<span class="swt-muted sm"> Nothing to share yet.</span>' : '' ) . '</div>';
}

function swt_bl_generate_document( $s, $state ) {
	$doc  = (string) ( $s['doc_id'] ?? '' );
	$href = add_query_arg( array( 'swt_doc' => $doc, 'swt_ts' => swt_blocks_ts() ), home_url( '/' ) );
	return '<div class="swt-doc"><p class="swt-muted">' . esc_html( $s['note'] ?? 'Generated from your own recorded figures.' ) . '</p>'
		. '<a class="swt-btn" href="' . esc_url( $href ) . '" target="_blank" rel="noopener">' . esc_html( $s['label'] ?? 'Print / Save as PDF' ) . '</a></div>';
}

function swt_bl_date( $s, $state ) {
	$id = (string) ( $s['id'] ?? '' ); $st = swt_bl_state( $state, $id );
	$out = swt_bl_input( array( 'id' => 'date', 'label' => $s['label'] ?? 'Date', 'type' => 'date', 'help' => $s['help'] ?? '' ), $id, $st['date'] ?? '' );
	if ( isset( $s['offset_days'] ) ) {
		$base = $st['date'] ?? '';
		$derived = '';
		if ( $base ) { $t = strtotime( $base ); if ( $t ) { $derived = date( 'j M Y', $t + ( (int) $s['offset_days'] ) * DAY_IN_SECONDS ); } }
		$out .= '<div class="swt-derived"><span>' . esc_html( $s['derived_label'] ?? 'Derived date' ) . '</span><b>' . ( '' === $derived ? 'ΓÇö' : esc_html( $derived ) ) . '</b></div>';
	}
	return $out;
}

function swt_bl_reminder( $s, $state ) {
	$id = (string) ( $s['id'] ?? '' ); $st = swt_bl_state( $state, $id );
	$val = (string) ( $st['date'] ?? '' );
	$due = false;
	if ( $val ) { $t = strtotime( $val ); if ( $t ) { $due = $t <= ( time() + ( (int) ( $s['lead_days'] ?? 0 ) ) * DAY_IN_SECONDS ); } }
	return swt_bl_input( array( 'id' => 'date', 'label' => $s['label'] ?? 'Return date', 'type' => 'date' ), $id, $val )
		. ( $due ? '<div class="swt-status swt-warn"><span class="dot"></span><b>' . esc_html( $s['when_due_label'] ?? 'Due now' ) . '</b></div>' : '' );
}

function swt_bl_review( $s, $state ) {
	$id = (string) ( $s['id'] ?? '' ); $st = swt_bl_state( $state, $id );
	$last = (string) ( $st['last'] ?? '' );
	$cad  = (int) ( $s['cadence_days'] ?? 30 );
	$next = '';
	if ( $last ) { $t = strtotime( $last ); if ( $t ) { $next = date( 'j M Y', $t + $cad * DAY_IN_SECONDS ); } }
	return '<div class="swt-review"><p class="swt-muted">' . esc_html( $s['prompt'] ?? ( 'Review every ' . $cad . ' days.' ) ) . '</p>'
		. '<div class="swt-review-row"><span>Last review</span><b>' . ( '' === $last ? 'Not yet' : esc_html( date( 'j M Y', strtotime( $last ) ) ) ) . '</b></div>'
		. '<div class="swt-review-row"><span>Next review</span><b>' . ( '' === $next ? 'ΓÇö' : esc_html( $next ) ) . '</b></div>'
		. swt_bl_input( array( 'id' => 'last', 'label' => 'Mark reviewed on', 'type' => 'date' ), $id, $last ) . '</div>';
}

/** A read-only record of what changed, when, and why (written server-side on save). */
function swt_bl_history( $s, $state ) {
	$rows = is_array( $state['history'] ?? null ) ? $state['history'] : array();
	if ( ! $rows ) {
		$ic = function_exists( 'swt_ds_icon' ) ? (string) swt_ds_icon( 'pen-line' ) : '';
		return '<div class="swt-rep-empty">' . ( '' !== trim( $ic ) ? '<span class="swt-rep-ic">' . $ic . '</span>' : '' )
			. '<span class="swt-rep-tx">' . esc_html( $s['empty'] ?? 'No changes recorded yet. The first change you make appears here.' ) . '</span></div>';
	}
	$rows = array_slice( array_reverse( $rows ), 0, max( 1, (int) ( $s['limit'] ?? 12 ) ) );
	$out  = '<table class="data-table"><tr><th>Date</th><th>Field</th><th>Reason</th></tr>';
	foreach ( $rows as $r ) {
		$reason = trim( (string) ( $r['reason'] ?? '' ) );
		$out .= '<tr><td>' . esc_html( (string) ( $r['at'] ?? '' ) ) . '</td>'
			. '<td>' . esc_html( (string) ( $r['label'] ?? '' ) ) . '</td>'
			. '<td>' . ( '' === $reason ? '&mdash;' : esc_html( $reason ) ) . '</td></tr>';
	}
	return $out . '</table>';
}
function swt_bl_rescue( $s, $state ) {
	$np  = (string) ( $s['number_path'] ?? '' );
	$num = $np ? swt_bl_get( $state, $np ) : null;
	$out = '<div class="swt-rescue"><div class="swt-rescue-num"><span class="l">'
		. esc_html( (string) ( $s['number_label'] ?? 'Current budget number' ) ) . '</span><b>'
		. ( null === $num ? '<span class="swt-gap">' . esc_html( (string) ( $s['when_empty'] ?? 'Not set yet' ) ) . '</span>' : swt_bl_money( $num ) ) . '</b></div>';
	if ( ! empty( $s['steps'] ) ) {
		$out .= '<ol class="swt-steps">';
		foreach ( (array) $s['steps'] as $st ) {
			$out .= '<li>' . esc_html( is_array( $st ) ? ( $st['label'] ?? '' ) : (string) $st ) . '</li>';
		}
		$out .= '</ol>';
	}
	/* The minimum system: each step is a real action. */
	if ( ! empty( $s['actions'] ) ) {
		$out .= '<div class="swt-rescue-acts">';
		foreach ( (array) $s['actions'] as $a ) {
			$label = esc_html( (string) ( $a['label'] ?? '' ) );
			$note  = ( '' !== trim( (string) ( $a['note'] ?? '' ) ) ) ? '<span class="n">' . esc_html( (string) $a['note'] ) . '</span>' : '';
			if ( ! empty( $a['view'] ) ) {
				$v    = sanitize_key( (string) $a['view'] );
				$href = add_query_arg( array( 'swiipt_app' => swt_blocks_ts(), 'v' => $v ), home_url( '/' ) );
				$out .= '<a class="swt-act" href="' . esc_url( $href ) . '" data-view="' . swt_bl_attr( $v ) . '"><b>' . $label . '</b>' . $note . '</a>';
			} elseif ( ! empty( $a['href'] ) ) {
				$out .= '<a class="swt-act" href="' . esc_url( (string) $a['href'] ) . '"><b>' . $label . '</b>' . $note . '</a>';
			} elseif ( ! empty( $a['date_field'] ) ) {
				$parts = explode( '.', (string) $a['date_field'] );
				$bid   = isset( $parts[0] ) ? $parts[0] : '';
				$fld   = isset( $parts[1] ) ? $parts[1] : 'date';
				$val   = (string) swt_bl_get( $state, 'blocks.' . (string) $a['date_field'] );
				$out  .= '<div class="swt-act"><b>' . $label . '</b>' . $note . '<div class="swt-act-row">'
					. '<input type="date" value="' . swt_bl_attr( $val ) . '" data-swt-block="' . swt_bl_attr( $bid ) . '" data-swt-field="' . swt_bl_attr( $fld ) . '"/>'
					. '<button type="button" class="swt-btn ghost" data-swt-today="' . swt_bl_attr( $bid . '.' . $fld ) . '">Set to today</button>'
					. '</div></div>';
			}
		}
		$out .= '</div>';
	}
	if ( '' !== trim( (string) ( $s['note'] ?? '' ) ) ) { $out .= '<p class="swt-muted sm">' . esc_html( $s['note'] ) . '</p>'; }
	return $out . '</div>';
}


/* ---------------------------------------------------------------- data-entry blocks */

function swt_bl_form( $s, $state ) {
	$id  = (string) ( $s['id'] ?? '' );
	$st  = swt_bl_state( $state, $id );
	$out = '<div class="swt-fields' . ( ! empty( $s['cols'] ) ? ' cols-' . (int) $s['cols'] : '' ) . '">';
	foreach ( (array) ( $s['fields'] ?? array() ) as $f ) {
		/* collect() stores form fields flat (blocks.<id>.<field>); accept the nested shape too */
		$val = isset( $st[ $f['id'] ] ) ? $st[ $f['id'] ] : null;
		if ( ( null === $val || '' === $val ) && isset( $st['fields'][ $f['id'] ] ) ) { $val = $st['fields'][ $f['id'] ]; }
		/* dependency flow: the computed figure shows as a PLACEHOLDER (an empty field means
		   "no override"), exactly like the design, so nothing is re-entered by hand. */
		if ( '' === trim( (string) ( $f['placeholder'] ?? '' ) ) && ! empty( $f['prefill_from'] ) ) {
			$pv = swt_bl_get( $state, (string) $f['prefill_from'] );
			if ( is_numeric( $pv ) ) { $f['placeholder'] = ( (float) $pv == (int) $pv ) ? (string) (int) $pv : (string) round( (float) $pv, 2 ); }
		}
		if ( ! empty( $f['single'] ) && 'textarea' === ( $f['type'] ?? '' ) ) { $f['type'] = 'text'; unset( $f['rows'] ); }
		$inp  = swt_bl_input( $f, $id, $val );
		$span = (int) ( $f['span'] ?? 1 );
		$out .= ( $span > 1 ) ? '<div class="swt-span" style="grid-column:span ' . $span . '">' . $inp . '</div>' : $inp;
	}
	$out .= '</div>';
	$sub  = (string) ( $s['submit_label'] ?? '' );
	if ( '' !== trim( $sub ) ) {
		$out .= '<div class="swt-form-actions"><button type="button" class="swt-btn swt-btn-sm" data-swt-save-now="1">' . esc_html( $sub ) . '</button></div>';
	}
	return $out;
}

/** A repeatable row set (recurring costs, occasional costs, swap candidates). */
function swt_bl_repeater( $s, $state ) {
	$id   = (string) ( $s['id'] ?? '' );
	$st   = swt_bl_state( $state, $id );
	$rows = array_values( (array) ( $st['rows'] ?? array() ) );
	$cols = array_values( (array) ( $s['columns'] ?? array() ) );
	$max  = (int) ( $s['max'] ?? 0 );
	$full = ( $max && count( $rows ) >= $max );

	/* one cell: the read-only value, with the editable input revealed when the row is open */
	$cell = function ( $c, $row, $i ) use ( $id ) {
		$fid  = (string) ( $c['id'] ?? '' );
		$val  = is_array( $row ) ? ( $row[ $fid ] ?? null ) : null;
		$disp = '';
		if ( null !== $val && '' !== $val ) {
			if ( 'select' === ( $c['type'] ?? '' ) ) {
				$opts = (array) ( $c['options'] ?? array() );
				$disp = isset( $opts[ $val ] ) ? ( is_array( $opts[ $val ] ) ? ( $opts[ $val ]['label'] ?? $val ) : $opts[ $val ] ) : $val;
			} elseif ( ! empty( $c['money'] ) && is_numeric( $val ) ) {
				$disp = swt_bl_money( $val );
			} else {
				$disp = (string) $val;
			}
		}
		return '<td class="swt-cell"><span class="swt-cellv">' . esc_html( (string) $disp ) . '</span>'
			. '<span class="swt-cellf">' . swt_bl_input( $c, $id, $val, $i ) . '</span></td>';
	};

	$out = '<div class="swt-rep" data-swt-rep="' . swt_bl_attr( $id ) . '" data-swt-max="' . $max . '">';
	$out .= '<table class="data-table swt-col-table swt-rep-table"><thead><tr>';
	foreach ( $cols as $c ) { $out .= '<th>' . esc_html( $c['label'] ?? ( $c['id'] ?? '' ) ) . '</th>'; }
	$out .= '<th></th></tr></thead><tbody class="swt-rep-rows">';
	if ( ! $rows ) {
		$ic = function_exists( 'swt_ds_icon' ) ? (string) swt_ds_icon( 'repeat' ) : '';
		$out .= '<tr class="swt-rep-empty"><td colspan="' . ( count( $cols ) + 1 ) . '">'
			. ( '' !== trim( $ic ) ? '<span class="swt-rep-ic">' . $ic . '</span>' : '' )
			. '<span class="swt-rep-tx">' . esc_html( $s['empty'] ?? 'Nothing here yet - add the first one.' ) . '</span></td></tr>';
	}
	foreach ( $rows as $i => $row ) {
		$out .= '<tr class="swt-col-item swt-rep-row" data-swt-row="' . (int) $i . '">';
		foreach ( $cols as $c ) { $out .= $cell( $c, $row, $i ); }
		$out .= '<td class="swt-rowctl"><button type="button" class="swt-row-x" data-swt-row-remove="1" aria-label="Remove row">&times;</button></td>';
		$out .= '</tr>';
	}
	$out .= '</tbody></table>';
	/* inline add row: the columns plus the add control, one line */
	$plus = function_exists( 'swt_ds_icon' ) ? (string) swt_ds_icon( 'plus' ) : '';
	$out .= '<div class="swt-rep-add" data-swt-addrow="1">';
	foreach ( $cols as $c ) { $out .= swt_bl_input( $c, $id, null, 9999 ); }
	$out .= '<button type="button" class="swt-btn swt-btn-sm" data-swt-row-add="1"' . ( $full ? ' disabled' : '' ) . '>'
		. ( '' !== trim( $plus ) ? $plus : '' ) . esc_html( $s['add_label'] ?? 'Add' ) . '</button>';
	$out .= '</div>';
	if ( '' !== trim( (string) ( $s['note'] ?? '' ) ) ) { $out .= '<p class="swt-hint">' . esc_html( $s['note'] ) . '</p>'; }
	/* row prototype for the client */
	$tpl = '<tr class="swt-col-item swt-rep-row" data-swt-row="__ROW__">';
	foreach ( $cols as $c ) { $tpl .= $cell( $c, null, '__ROW__' ); }
	$tpl .= '<td class="swt-rowctl"><button type="button" class="swt-row-x" data-swt-row-remove="1" aria-label="Remove row">&times;</button></td></tr>';
	$out .= '<template data-swt-rep-tpl="' . swt_bl_attr( $id ) . '">' . $tpl . '</template>';
	return $out . '</div>';
}

/** Calculators compute; they only show output when an op carries a label. */
function swt_bl_calculator( $s, $state ) {
	$rows = array();
	foreach ( (array) ( $s['ops'] ?? array() ) as $op ) {
		$label = trim( (string) ( $op['label'] ?? '' ) );
		if ( '' === $label ) { continue; }
		$v = swt_bl_get( $state, 'computed.' . ( $op['output'] ?? '' ) );
		$rows[] = '<div class="swt-calc-row"><span>' . esc_html( $label ) . '</span><b data-swt-live="computed.' . swt_bl_attr( $op['output'] ?? '' ) . '">'
			. ( null === $v ? '<span class="swt-gap">&mdash;</span>' : ( ! empty( $op['money'] ) ? swt_bl_money( $v ) : esc_html( (string) $v ) ) ) . '</b></div>';
	}
	if ( ! $rows ) { return '<p class="swt-muted sm">Calculated automatically from your entries ΓÇö no manual arithmetic.</p>'; }
	return '<div class="swt-calc">' . implode( '', $rows ) . '<p class="swt-muted sm">Recalculated from your own figures.</p></div>';
}

/** The produced figures. Missing values stay an honest gap, never a fabricated number. */
function swt_bl_result( $s, $state ) {
	$out = '';
	if ( ! empty( $s['range'] ) && is_array( $s['range'] ) ) {
		$r = (array) $s['range'];
		$lean = swt_bl_get( $state, (string) ( $r['lean'] ?? '' ) );
		$normal = swt_bl_get( $state, (string) ( $r['normal'] ?? '' ) );
		$peak = swt_bl_get( $state, (string) ( $r['peak'] ?? '' ) );
		if ( null !== $normal && '' !== $normal ) {
			$span = ( ( (float) $peak - (float) $lean ) ?: 1 );
			$pos = min( 100, max( 0, ( ( (float) $normal - (float) $lean ) / $span ) * 100 ) );
			$out .= '<div class="range-wrap" data-lean="' . swt_bl_attr( $lean ) . '" data-peak="' . swt_bl_attr( $peak ) . '"><div class="scrub"><span></span></div>'
				. '<div class="range"><i class="range-fill"></i><b class="range-dot" style="left:' . round( $pos, 1 ) . '%"></b></div>'
				. '<div class="range-labels"><div><span>' . esc_html( $r['lean_label'] ?? 'Lean' ) . '</span><em class="rv" data-swt-live="' . swt_bl_attr( $r['lean'] ?? '' ) . '">' . swt_bl_money( $lean ) . '</em></div>'
				. '<div class="mid"><span>' . esc_html( $r['normal_label'] ?? 'Normal' ) . '</span><em class="rv" data-swt-live="' . swt_bl_attr( $r['normal'] ?? '' ) . '">' . swt_bl_money( $normal ) . '</em></div>'
				. '<div><span>' . esc_html( $r['peak_label'] ?? 'Peak' ) . '</span><em class="rv" data-swt-live="' . swt_bl_attr( $r['peak'] ?? '' ) . '">' . swt_bl_money( $peak ) . '</em></div></div></div>';
		} elseif ( ! empty( $r['empty'] ) ) {
			$out .= '<div class="range-empty">' . esc_html( $r['empty'] ) . '</div>';
		}
	}
	$out .= '<div class="swt-result">';
	foreach ( (array) ( $s['rows'] ?? array() ) as $r ) {
		$path  = (string) ( $r['path'] ?? '' );
		$v     = swt_bl_get( $state, $path );
		$empty = (string) ( $r['empty'] ?? '' );
		$show  = ( null === $v || '' === $v )
			? '<span class="swt-gap">' . ( '' !== $empty ? esc_html( $empty ) : '&mdash;' ) . '</span>'
			: ( ! empty( $r['money'] ) ? swt_bl_money( $v ) : esc_html( (string) $v ) );
		$hl    = ! empty( $r['highlight'] ) ? ' swt-hl' : '';
		$out .= '<div class="swt-result-row' . $hl . '"><span>' . esc_html( $r['label'] ?? '' ) . '</span><b data-swt-live="' . swt_bl_attr( $path ) . '">' . $show . '</b></div>';
	}
	if ( ! empty( $s['gap_note'] ) ) { $out .= '<p class="swt-hint">' . esc_html( $s['gap_note'] ) . '</p>'; }
	return $out . '</div>';
}

/** One question at a time, routing to a terminal outcome. */
function swt_bl_decision_tree( $s, $state ) {
	$id = (string) ( $s['id'] ?? '' );
	$st = swt_bl_state( $state, $id );
	$nodes = (array) ( $s['nodes'] ?? array() );
	$outcomes = (array) ( $s['outcomes'] ?? array() );
	$map = array();
	foreach ( $nodes as $nid => $n ) {
		$opts = array();
		foreach ( (array) ( $n['options'] ?? array() ) as $o ) {
			$opts[] = array( 'label' => (string) ( $o['label'] ?? '' ), 'next' => $o['next'] ?? null, 'outcome' => $o['outcome'] ?? null, 'help' => (string) ( $o['help'] ?? '' ) );
		}
		$map[ (string) $nid ] = array( 'q' => (string) ( $n['q'] ?? '' ), 'help' => (string) ( $n['help'] ?? '' ), 'note' => (string) ( $n['note'] ?? '' ), 'options' => $opts );
	}
if ( 'form' === ( $s['layout'] ?? '' ) ) { return swt_bl_decision_form( $s, $state, $map ); }
$out = '<div class="swt-dt" data-swt-dt="' . swt_bl_attr( $id ) . '" data-swt-dt-start="' . swt_bl_attr( $s['start'] ?? '' ) . '" data-swt-dt-map="' . swt_bl_attr( wp_json_encode( $map ) ) . '"'
		. ( ! empty( $s['record_to'] ) ? ' data-swt-dt-record="' . swt_bl_attr( $s['record_to'] ) . '"' : '' )
		. ( ! empty( $s['record_fields'] ) ? ' data-swt-dt-record-map="' . swt_bl_attr( wp_json_encode( $s['record_fields'] ) ) . '"' : '' ) . '>';
	$out .= '<div class="swt-dt-trail"></div><div class="swt-dt-body"></div>';
	$out .= '<div class="swt-dt-actions"><button type="button" class="swt-btn ghost" data-swt-dt-back="1" hidden>Back</button>'
		. '<button type="button" class="swt-btn ghost" data-swt-dt-restart="1">Start again</button></div>';
	$out .= '<div class="swt-dt-outcomes" hidden>';
	foreach ( $outcomes as $oid => $o ) {
		$tone = in_array( (string) ( $o['tone'] ?? '' ), array( 'ok', 'warn', 'bad', 'info' ), true ) ? $o['tone'] : 'info';
		$out .= '<div class="swt-outcome swt-' . swt_bl_attr( $tone ) . '" data-outcome="' . swt_bl_attr( $oid ) . '" hidden><b>' . esc_html( $o['label'] ?? $oid ) . '</b>'
			. ( '' !== trim( (string) ( $o['body'] ?? '' ) ) ? '<p>' . esc_html( $o['body'] ) . '</p>' : '' )
			. ( '' !== trim( (string) ( $o['next_label'] ?? '' ) ) ? '<span class="swt-muted sm">' . esc_html( $o['next_label'] ) . '</span>' : '' ) . '</div>';
	}
	$out .= '</div>';
	$out .= '<input type="hidden" data-swt-block="' . swt_bl_attr( $id ) . '" data-swt-field="answers" value="' . swt_bl_attr( wp_json_encode( $st['answers'] ?? array() ) ) . '"/>';
	$out .= '<input type="hidden" data-swt-block="' . swt_bl_attr( $id ) . '" data-swt-field="outcome" value="' . swt_bl_attr( $st['outcome'] ?? '' ) . '"/>';
	return $out . '</div>';
}

function swt_bl_checklist( $s, $state ) {
	$id = (string) ( $s['id'] ?? '' );
	$st = swt_bl_state( $state, $id );
	$done = (array) ( $st['done'] ?? array() );
	$out = '<ul class="swt-check">';
	foreach ( (array) ( $s['items'] ?? array() ) as $it ) {
		$iid = (string) ( $it['id'] ?? '' );
		$out .= '<li><label><input type="checkbox" data-swt-block="' . swt_bl_attr( $id ) . '" data-swt-field="done" data-swt-key="' . swt_bl_attr( $iid ) . '"' . ( ! empty( $done[ $iid ] ) ? ' checked' : '' ) . '/>'
			. '<span>' . esc_html( $it['label'] ?? '' ) . ( '' !== trim( (string) ( $it['help'] ?? '' ) ) ? '<em>' . esc_html( $it['help'] ) . '</em>' : '' ) . '</span></label></li>';
	}
	return $out . '</ul>';
}

function swt_bl_plan( $s, $state ) {
	$id = (string) ( $s['id'] ?? '' );
	$st = swt_bl_state( $state, $id );
	$done = (array) ( $st['done'] ?? array() );
	$out = '<ol class="swt-plan">';
	foreach ( (array) ( $s['steps'] ?? array() ) as $it ) {
		$iid = (string) ( $it['id'] ?? '' );
		$out .= '<li' . ( ! empty( $done[ $iid ] ) ? ' class="on"' : '' ) . '><label><input type="checkbox" data-swt-block="' . swt_bl_attr( $id ) . '" data-swt-field="done" data-swt-key="' . swt_bl_attr( $iid ) . '"' . ( ! empty( $done[ $iid ] ) ? ' checked' : '' ) . '/>'
			. '<span><b>' . esc_html( $it['label'] ?? '' ) . '</b>'
			. ( '' !== trim( (string) ( $it['detail'] ?? '' ) ) ? '<em>' . esc_html( $it['detail'] ) . '</em>' : '' ) . '</span></label></li>';
	}
	return $out . '</ol>';
}

/** A read-only computed cell inside a repeater/collection row (e.g. weekly difference). */
function swt_bl_computed_cell( $f, $row ) {
	$a = isset( $row[ $f['from'] ?? '' ] ) && is_numeric( $row[ $f['from'] ] ) ? (float) $row[ $f['from'] ] : null;
	$b = isset( $row[ $f['to'] ] ) && is_numeric( $row[ $f['to'] ] ) ? (float) $row[ $f['to'] ] : null;
	$op = (string) ( $f['op'] ?? 'subtract' );
	$v  = null;
	if ( null !== $a && null !== $b ) {
		if ( 'subtract' === $op ) { $v = $a - $b; } elseif ( 'add' === $op ) { $v = $a + $b; } elseif ( 'multiply' === $op ) { $v = $a * $b; } elseif ( 'divide' === $op && 0.0 !== $b ) { $v = $a / $b; }
	} elseif ( null !== $a && in_array( $op, array( 'times' ), true ) ) { $v = $a; }
	if ( null !== $v && ! empty( $f['times'] ) && is_numeric( $f['times'] ) ) { $v = $v * (float) $f['times']; }
	return '<div class="swt-fld swt-fld-ro">' . ( empty( $f['no_label'] ) ? '<span class="swt-fld-l">' . esc_html( (string) ( $f['label'] ?? '' ) ) . '</span>' : '' ) . '<b>'
		. ( null === $v ? '<span class="swt-gap">&mdash;</span>' : ( ! empty( $f['money'] ) ? swt_bl_money( $v ) : esc_html( (string) round( $v, 2 ) ) ) )
		. '</b>' . ( ! empty( $f['suffix'] ) ? '<span class="swt-fld-u">' . esc_html( (string) $f['suffix'] ) . '</span>' : '' ) . '</div>';
}

/** A read-only date derived from another column (e.g. Day-30 date). */
function swt_bl_derived_cell( $f, $row ) {
	$from = (string) ( $row[ $f['from'] ?? '' ] ?? '' );
	$t    = '' !== $from ? strtotime( $from ) : false;
	$v    = ( $t && ! empty( $f['offset_days'] ) ) ? date( 'j M Y', $t + ( (int) $f['offset_days'] ) * DAY_IN_SECONDS ) : '';
	return '<div class="swt-fld swt-fld-ro">' . ( empty( $f['no_label'] ) ? '<span class="swt-fld-l">' . esc_html( (string) ( $f['label'] ?? '' ) ) . '</span>' : '' ) . '<b>'
		. ( '' === $v ? '&mdash;' : esc_html( $v ) ) . '</b></div>';
}
/** A collection with a shared field schema: LOG (audit entries), TRACKER (observations). */
/* m345: form layout for DECISION_TREE. Every question node renders as a row
   with segmented options, a live verdict reveal and a gold save button.
   Generic over any node graph: the walk follows chosen options from start and
   off-path answers are ignored. Recording stays gated on Save
   (record_to/record_fields); the walk layout is untouched. */
function swt_bl_decision_form( $s, $state, $map ) {
	$id = (string) ( $s['id'] ?? '' );
	$st = swt_bl_state( $state, $id );
	$answers = is_array( $st['answers'] ?? null ) ? $st['answers'] : array();
	$outcomes = (array) ( $s['outcomes'] ?? array() );
	$out = '<div class="swt-dt swt-dt-form" data-swt-dt="' . swt_bl_attr( $id ) . '" data-swt-dt-start="' . swt_bl_attr( $s['start'] ?? '' ) . '" data-swt-dt-map="' . swt_bl_attr( wp_json_encode( $map ) ) . '" data-swt-dt-layout="form"'
		. ( ! empty( $s['record_to'] ) ? ' data-swt-dt-record="' . swt_bl_attr( $s['record_to'] ) . '"' : '' )
		. ( ! empty( $s['record_fields'] ) ? ' data-swt-dt-record-map="' . swt_bl_attr( wp_json_encode( $s['record_fields'] ) ) . '"' : '' )
		. ' data-swt-dt-outcomes="' . swt_bl_attr( wp_json_encode( $outcomes ) ) . '">';
	foreach ( $map as $nid => $n ) {
		if ( empty( $n['options'] ) ) { continue; }
		$many = count( (array) $n['options'] ) > 3;
		$out .= '<div class="qa-row' . ( $many ? ' qa-row-list' : '' ) . '" data-swt-dt-q="' . swt_bl_attr( $nid ) . '">';
		$out .= '<div class="qa-q">' . esc_html( $n['q'] ) . '</div>';
		if ( ! empty( $n['note'] ) ) { $out .= '<p class="swt-hint">' . esc_html( $n['note'] ) . '</p>'; }
		$out .= $many ? '<div class="qa-list">' : '<div class="seg">';
		foreach ( (array) $n['options'] as $oi => $o ) {
			$on = ( isset( $answers[ $nid ] ) && (int) $answers[ $nid ] === (int) $oi ) ? ' on' : '';
			$cls = $many ? 'qa-opt' : 'seg-btn';
			$out .= '<button type="button" class="' . $cls . $on . '" data-swt-dt-opt="' . swt_bl_attr( $nid ) . ':' . (int) $oi . '">' . esc_html( $o['label'] ) . '</button>';
		}
		$out .= '</div></div>';
	}
	$out .= '<div class="verdict-reveal" hidden><span class="verdict-badge"></span><div class="vr-text"></div></div>';
	$save_label = trim( (string) ( $s['save_label'] ?? '' ) );
	if ( '' === $save_label ) { $save_label = 'Save decision'; }
	$out .= '<div class="btn-row"><button type="button" class="btn btn-ghost btn-sm" data-swt-wiz-back="1"><span aria-hidden="true">&lsaquo;</span> Back</button><button type="button" class="btn btn-gold btn-sm" data-swt-dt-form-save="1" disabled>' . esc_html( $save_label ) . '</button></div>';
	$out .= '<input type="hidden" data-swt-block="' . swt_bl_attr( $id ) . '" data-swt-field="answers" value="' . swt_bl_attr( wp_json_encode( $answers ) ) . '"/>';
	$out .= '<input type="hidden" data-swt-block="' . swt_bl_attr( $id ) . '" data-swt-field="outcome" value="' . swt_bl_attr( $st['outcome'] ?? '' ) . '"/>';
	return $out . '</div>';
}

/* m345: verdict cell for registers driven by action buttons instead of a
   select. Renders the verdict pill plus one button per non-current option; the
   value rides a hidden input so collect() keeps working. Rows whose verdict is
   not actionable show the pill only. */
function swt_bl_verdict_cell( $s, $e, $i, $id ) {
	$val = is_array( $e ) ? (string) ( $e['_verdict'] ?? '' ) : '';
	$act = isset( $s['verdict_actionable'] ) ? (string) $s['verdict_actionable'] : '';
	if ( '' === $act && ! empty( $s['max_where']['eq'] ) ) { $act = (string) $s['max_where']['eq']; }
	$out = '<td class="swt-vcell"><input type="hidden" data-swt-block="' . swt_bl_attr( $id ) . '" data-swt-field="_verdict" data-swt-row="' . (int) $i . '" value="' . swt_bl_attr( $val ) . '"/>'
		. '<span class="status-pill status-' . swt_bl_attr( $val ) . '">' . esc_html( $val ) . '</span>';
	if ( '' === $act || $val === $act ) {
		$out .= '<span class="swt-vacts">';
		foreach ( (array) ( $s['verdict_options'] ?? array() ) as $vk => $vo ) {
			if ( (string) $vk === $val ) { continue; }
			$ol = is_array( $vo ) ? (string) ( $vo['label'] ?? $vk ) : (string) $vo;
			$kl = strtolower( (string) $vk );
			$icon = ( false !== strpos( $kl, 'reject' ) || false !== strpos( $kl, 'never' ) ) ? '&times;' : '&#10003;';
			$out .= '<button type="button" class="icon-btn-sm" data-swt-verdict-set="' . swt_bl_attr( $vk ) . '" data-swt-row="' . (int) $i . '" title="' . swt_bl_attr( $ol ) . '" aria-label="' . swt_bl_attr( $ol ) . '">' . $icon . '</button>';
		}
		$out .= '</span>';
	}
	return $out . '</td>';
}


function swt_bl_collection( $s, $state, $mode ) {
	$id = (string) ( $s['id'] ?? '' );
	$st = swt_bl_state( $state, $id );
	$entries = array_values( (array) ( $st['entries'] ?? array() ) );
	$fields  = array_values( (array) ( $s['fields'] ?? array() ) );
	$disp_fields = $fields;
	if ( ! empty( $s['display_fields'] ) && is_array( $s['display_fields'] ) ) { $want = array_map( 'strval', $s['display_fields'] ); $disp_fields = array(); foreach ( $want as $wid ) { foreach ( $fields as $f ) { if ( (string) ( $f['id'] ?? '' ) === $wid ) { $disp_fields[] = $f; } } } }
	$verdicts = ! empty( $s['verdict_options'] ) ? (array) $s['verdict_options'] : array();
	$cap = isset( $s['max_where'] ) && is_array( $s['max_where'] ) ? $s['max_where'] : array();
	$cols = 1 + count( $disp_fields );
	if ( ! isset( $s['show_date'] ) || false !== $s['show_date'] ) { $cols++; }
	if ( $verdicts ) { $cols++; }
	if ( ! isset( $s['removable'] ) || false !== $s['removable'] ) { $cols++; }
	if ( $verdicts ) { $cols++; }
	$plus = function_exists( 'swt_ds_icon' ) ? (string) swt_ds_icon( 'plus' ) : '';

	/* a cell: read-only value + the editable input revealed when the row is opened */
	$cell = function ( $f, $e, $i, $forced ) use ( $id ) {
		$fid  = (string) ( $f['id'] ?? '' );
		$val  = is_array( $e ) ? ( $e[ $fid ] ?? null ) : null;
		if ( 'computed' === ( $f['type'] ?? '' ) ) { $ff = $f; $ff['no_label'] = true; return '<td>' . swt_bl_computed_cell( $ff, is_array( $e ) ? $e : array() ) . '</td>'; }
		if ( 'date_derived' === ( $f['type'] ?? '' ) ) { $ff = $f; $ff['no_label'] = true; return '<td>' . swt_bl_derived_cell( $ff, is_array( $e ) ? $e : array() ) . '</td>'; }
		$disp = '';
		if ( null !== $val && '' !== $val ) {
			if ( 'select' === ( $f['type'] ?? '' ) ) {
				$opts = (array) ( $f['options'] ?? array() );
				$disp = esc_html( (string) ( isset( $opts[ $val ] ) ? ( is_array( $opts[ $val ] ) ? ( $opts[ $val ]['label'] ?? $val ) : $opts[ $val ] ) : $val ) );
			} elseif ( ! empty( $f['money'] ) && is_numeric( $val ) ) {
				$disp = swt_bl_money( $val );
			} else {
				$disp = esc_html( (string) $val );
			}
		}
		$in = $forced ? $f : $f;
		return '<td class="swt-cell"><span class="swt-cellv">' . $disp . '</span>'
			. '<span class="swt-cellf">' . swt_bl_input( $in, $id, $val, $i ) . '</span></td>';
	};
	$datef = array( 'id' => '_date', 'label' => $s['date_label'] ?? 'Date', 'type' => 'date' );
	$verdf = $verdicts ? array( 'id' => '_verdict', 'label' => $s['verdict_label'] ?? 'Verdict', 'type' => 'select', 'options' => $verdicts ) : null;

	$date_shown = ( ! isset( $s['show_date'] ) || false !== $s['show_date'] );
	$date_last = ! empty( $s['date_last'] );
	$render_row = function ( $i, $e, $flist = null ) use ( $cell, $datef, $fields, $verdf, $s, $id, $date_shown, $date_last ) {
		$fl = is_array( $flist ) ? $flist : $fields;
		$row = '<tr class="swt-col-item" data-swt-row="' . (int) $i . '">';
		if ( $date_shown && ! $date_last ) { $row .= $cell( $datef, $e, $i, true ); }
		foreach ( $fl as $f ) { $row .= $cell( $f, $e, $i, false ); }
		if ( $verdf ) {
			if ( ! empty( $s['verdict_actions'] ) ) { $row .= swt_bl_verdict_cell( $s, $e, $i, $id ); }
			elseif ( ! empty( $s['verdict_badge'] ) ) { $vv = is_array( $e ) ? (string) ( $e['_verdict'] ?? '' ) : ''; $row .= '<td class="swt-vcell"><input type="hidden" data-swt-block="' . swt_bl_attr( $id ) . '" data-swt-field="_verdict" data-swt-row="' . (int) $i . '" value="' . swt_bl_attr( $vv ) . '"/><span class="status-pill status-' . swt_bl_attr( $vv ) . '">' . esc_html( $vv ) . '</span></td>'; }
			else { $row .= $cell( $verdf, $e, $i, true ); }
		}
		if ( $date_shown && $date_last ) { $row .= $cell( $datef, $e, $i, true ); }
		if ( ! isset( $s['removable'] ) || false !== $s['removable'] ) { $row .= '<td class="swt-rowctl"><button type="button" class="swt-row-x" data-swt-row-remove="1" aria-label="Remove entry">&times;</button></td>'; }
		return $row . '</tr>';
	};

	$out = '<div class="swt-col" data-swt-col="' . swt_bl_attr( $id ) . '"'
		. ( ! empty( $cap['field'] ) ? ' data-swt-cap-field="' . swt_bl_attr( $cap['field'] ) . '" data-swt-cap-eq="' . swt_bl_attr( $cap['eq'] ?? '' ) . '" data-swt-cap-max="' . (int) ( $cap['max'] ?? 0 ) . '"' : '' ) . '>';
	if ( ! empty( $cap['field'] ) ) {
		$n_act = 0; foreach ( $entries as $er ) { if ( is_array( $er ) && (string) ( $er[ $cap['field'] ] ?? '' ) === (string) ( $cap['eq'] ?? '' ) ) { $n_act++; } }
		$mx = (int) ( $cap['max'] ?? 0 );
		$out .= '<p class="swt-cap" data-swt-cap-line="1">' . esc_html( $cap['label'] ?? 'Active' ) . ': <b>' . (int) $n_act . '</b> of ' . (int) $mx
			. ( $mx && $n_act > $mx ? ' &mdash; <span class="swt-over">more than the mechanism allows. Keep or reject one before adding another.</span>' : '' ) . '</p>';
	}
	$out .= '<table class="data-table swt-col-table"><thead><tr>';
	if ( $date_shown && ! $date_last ) { $out .= '<th>' . esc_html( $s['date_label'] ?? 'Date' ) . '</th>'; }
	foreach ( $disp_fields as $f ) { $out .= '<th>' . esc_html( $f['label'] ?? ( $f['id'] ?? '' ) ) . '</th>'; }
	if ( $verdicts ) { $out .= '<th>' . esc_html( $s['verdict_label'] ?? 'Verdict' ) . '</th>'; }
	if ( $date_shown && $date_last ) { $out .= '<th>' . esc_html( $s['date_label'] ?? 'Date' ) . '</th>'; }
	$out .= ''; if ( ! isset( $s['removable'] ) || false !== $s['removable'] ) { $out .= '<th></th>'; } $out .= '</tr></thead><tbody class="swt-col-list">';
	if ( ! $entries ) {
		$ic = function_exists( 'swt_ds_icon' ) ? (string) swt_ds_icon( 'clipboard-list' ) : '';
		$out .= '<tr class="swt-rep-empty"><td colspan="' . (int) $cols . '">'
			. ( '' !== trim( $ic ) ? '<span class="swt-rep-ic">' . $ic . '</span>' : '' )
			. '<span class="swt-rep-tx">' . esc_html( $s['empty'] ?? 'Nothing logged yet.' ) . '</span></td></tr>';
	}
	foreach ( $entries as $i => $e ) { $out .= $render_row( $i, $e, $disp_fields ); }
	$out .= '</tbody></table>';
	if ( ! isset( $s['add_row'] ) || false !== $s['add_row'] ) {
	$out .= '<div class="swt-col-add" data-swt-addrow="1">';
	if ( ! isset( $s['show_date'] ) || false !== $s['show_date'] ) { $out .= swt_bl_input( $datef, $id, date( 'Y-m-d' ), 9999 ); }
	foreach ( $fields as $f ) {
		if ( 'computed' === ( $f['type'] ?? '' ) ) { continue; }
		if ( 'date_derived' === ( $f['type'] ?? '' ) ) { continue; }
		if ( ! empty( $s['add_fields'] ) && is_array( $s['add_fields'] ) && ! in_array( (string) ( $f['id'] ?? '' ), array_map( 'strval', $s['add_fields'] ), true ) ) { continue; }
		$out .= swt_bl_input( $f, $id, null, 9999 );
	}
	if ( $verdf && empty( $s['verdict_actions'] ) ) { $out .= swt_bl_input( $verdf, $id, null, 9999 ); }
	$out .= '<button type="button" class="swt-btn swt-btn-sm" data-swt-row-add="1">' . ( '' !== trim( $plus ) ? $plus : '' ) . esc_html( $s['add_label'] ?? 'Add entry' ) . '</button>';
	$out .= '</div>';
	}
	if ( '' !== trim( (string) ( $s['note'] ?? '' ) ) ) { $out .= '<p class="swt-hint">' . esc_html( $s['note'] ) . '</p>'; }
	$tmpl_entry = array(); if ( ! empty( $s['verdict_actions'] ) ) { $tmpl_act = isset( $s['verdict_actionable'] ) ? (string) $s['verdict_actionable'] : ''; if ( '' === $tmpl_act && ! empty( $s['max_where']['eq'] ) ) { $tmpl_act = (string) $s['max_where']['eq']; } if ( '' !== $tmpl_act ) { $tmpl_entry['_verdict'] = $tmpl_act; } }
	$out .= '<template data-swt-col-tpl="' . swt_bl_attr( $id ) . '">' . $render_row( '__ROW__', $tmpl_entry, $fields ) . '</template>';
	return $out . '</div>';
}
function swt_bl_log( $s, $state ) { return swt_bl_collection( $s, $state, 'log' ); }
function swt_bl_tracker( $s, $state ) { return swt_bl_collection( $s, $state, 'tracker' ); }

/** A vs B with a computed difference (old cost vs new cost, current vs alternative). */
function swt_bl_comparison( $s, $state ) {
	$id = (string) ( $s['id'] ?? '' );
	$st = swt_bl_state( $state, $id );
	$out = '<div class="swt-cmp">';
	foreach ( array( 'a' => ( $s['a_label'] ?? 'Current' ), 'b' => ( $s['b_label'] ?? 'Alternative' ) ) as $side => $label ) {
		$out .= '<div class="swt-cmp-col"><span class="swt-cmp-l">' . esc_html( $label ) . '</span>';
		foreach ( (array) ( $s[ $side ]['fields'] ?? array() ) as $f ) { $out .= swt_bl_input( $f, $id, $st[ $side ][ $f['id'] ] ?? null ); }
		$out .= '</div>';
	}
	$out .= '</div>';
	foreach ( (array) ( $s['out'] ?? array() ) as $r ) {
		$v = swt_bl_get( $state, 'computed.' . ( $r['output'] ?? '' ) );
		$out .= '<div class="swt-result-row"><span>' . esc_html( $r['label'] ?? '' ) . '</span><b data-swt-live="computed.' . swt_bl_attr( $r['output'] ?? '' ) . '">'
			. ( null === $v ? '<span class="swt-gap">&mdash;</span>' : ( ! empty( $r['money'] ) ? swt_bl_money( $v ) : esc_html( (string) $v ) ) ) . '</b></div>';
	}
	return $out;
}

/** A guided sequence whose steps each carry their own blocks. */
/**
 * STATS: the design's stat-grid. Each item is either a declared stat key
 * (`stat`) or any state path (`path`). Nothing is invented - a value that has
 * not been produced yet renders as an honest dash.
 */
/**
 * CALLOUT: the design's inline notice (.callout info|warning|success|safety|protocol).
 * Copy comes from the recipe; the engine only supplies the tone and the icon.
 */
function swt_bl_callout( $s, $state ) {
	$tones = array( 'info', 'warning', 'success', 'safety', 'protocol' );
	$tone  = (string) ( $s['tone'] ?? '' );
	if ( ! in_array( $tone, $tones, true ) ) { $tone = 'info'; }
	$icons = array( 'info' => 'info', 'warning' => 'triangle-alert', 'success' => 'circle-check-big', 'safety' => 'triangle-alert', 'protocol' => 'shield-check' );
	$name  = (string) ( $s['icon'] ?? '' );
	if ( '' === $name ) { $name = isset( $icons[ $tone ] ) ? $icons[ $tone ] : 'info'; }
	$ic    = function_exists( 'swt_ds_icon' ) ? (string) swt_ds_icon( $name ) : '';
	$out   = '<div class="callout ' . esc_attr( $tone ) . '">';
	if ( '' !== trim( $ic ) ) { $out .= '<div class="ic">' . $ic . '</div>'; }
	$out .= '<div class="body">';
	$lbl  = (string) ( $s['label'] ?? '' );
	if ( '' !== trim( $lbl ) ) { $out .= '<span class="lbl">' . esc_html( $lbl ) . '</span>'; }
	$out .= '<div class="tx">' . esc_html( (string) ( $s['body'] ?? '' ) ) . '</div>';
	return $out . '</div></div>';
}

function swt_bl_stats( $s, $state ) {
	$items = array_values( (array) ( $s['items'] ?? array() ) );
	if ( ! $items ) { return ''; }
	$ts  = function_exists( 'swt_blocks_ctx' ) ? (int) swt_blocks_ctx() : 0;
	$all = ( $ts && function_exists( 'swt_blocks_stats' ) ) ? swt_blocks_stats( $ts, $state ) : array();
	$out = '<div class="stat-grid">';
	foreach ( $items as $it ) {
		if ( ! is_array( $it ) ) { continue; }
		$label = (string) ( $it['label'] ?? '' );
		$val   = null;
		$money = ! empty( $it['money'] );
		if ( '' !== (string) ( $it['stat'] ?? '' ) ) {
			$key = (string) $it['stat'];
			if ( isset( $all[ $key ] ) ) {
				$val = $all[ $key ]['value'];
				if ( ! empty( $all[ $key ]['money'] ) ) { $money = true; }
				if ( '' === $label ) { $label = (string) ( $all[ $key ]['label'] ?? $key ); }
			}
		} elseif ( '' !== (string) ( $it['path'] ?? '' ) ) {
			$val = swt_bl_get( $state, (string) $it['path'] );
		}
		if ( null === $val || '' === $val || ! is_numeric( $val ) ) {
			$disp = '&mdash;';
		} elseif ( $money ) {
			$disp = swt_bl_money( (float) $val );
		} else {
			$disp = (string) (int) $val;
		}
		$out .= '<div class="stat-card"><div class="sv">' . $disp . '</div><div class="sl">' . esc_html( $label ) . '</div></div>';
	}
	return $out . '</div>';
}

function swt_bl_step_flow( $s, $state ) {
	$id    = (string) ( $s['id'] ?? '' );
	$st    = swt_bl_state( $state, $id );
	$steps = array_values( (array) ( $s['steps'] ?? array() ) );
	$cur   = (int) ( $st['step'] ?? 0 );
	if ( $cur < 0 || $cur >= max( 1, count( $steps ) ) ) { $cur = 0; }
	$dot   = "\xc2\xb7"; /* the separator the design uses: 1 . Recurring */
	$nav   = ! ( isset( $s['nav'] ) && false === $s['nav'] );
	$out   = '<div class="swt-wiz" data-swt-wiz="' . swt_bl_attr( $id ) . '" data-swt-wiz-step="' . $cur . '">';
	if ( ! isset( $s['tabs'] ) || false !== $s['tabs'] ) {
	$out  .= '<div class="swt-wiz-steps" role="tablist">';
	foreach ( $steps as $i => $stp ) {
		$short = trim( (string) ( $stp['tab'] ?? '' ) );
		if ( '' === $short ) { $short = trim( (string) ( $stp['title'] ?? ( 'Step ' . ( $i + 1 ) ) ) ); }
		$out .= '<button type="button" role="tab" class="swt-wiz-dot' . ( $i === $cur ? ' on' : '' ) . ( $i < $cur ? ' done' : '' ) . '" data-swt-wiz-go="' . $i . '">'
			. esc_html( ( $i + 1 ) . ' ' . $dot . ' ' . $short ) . '</button>';
	}
	$out .= '</div>';
	}
	foreach ( $steps as $i => $stp ) {
		$stitle = trim( (string) ( $stp['title'] ?? '' ) );
		$out .= '<div class="swt-wiz-body" data-swt-wiz-body="' . $i . '"' . ( $i === $cur ? '' : ' hidden' ) . '>';
		$ctor = trim( (string) ( $stp['card_title'] ?? '' ) );
		if ( '' !== $ctor ) {
			$out .= '<div class="swt-bl swt-bl-step"><h3 class="swt-bl-title">' . esc_html( $ctor ) . '</h3>';
		} elseif ( empty( $s['card'] ) ) {
		$out .= '<div class="swt-bl swt-bl-step">';
		$out .= '<h3 class="swt-bl-title">' . esc_html( 'Step ' . ( $i + 1 ) . ( '' !== $stitle ? ' ' . "\xe2\x80\x94" . ' ' . $stitle : '' ) ) . '</h3>';
		} else {
			$out .= '<div class="swt-bl-step-bare">';
		}
		if ( '' !== trim( (string) ( $stp['intro'] ?? '' ) ) ) { $out .= '<p class="swt-bl-intro">' . esc_html( $stp['intro'] ) . '</p>'; }
		$out .= swt_blocks_render_list( $stp['blocks'] ?? array(), $state, true );
		if ( $nav && empty( $stp['hide_next'] ) ) {
			$out .= '<div class="swt-wiz-nav">'
				. '<button type="button" class="swt-btn ghost swt-btn-sm" data-swt-wiz-back="1"' . ( 0 === $i ? ' hidden' : '' ) . '>Back</button>'
				. ( ! empty( $stp['hide_next'] ) ? '' : '<button type="button" class="swt-btn swt-btn-sm" data-swt-wiz-next="1">' . esc_html( $s['next_label'] ?? 'Next' ) . ' <span aria-hidden="true">&rsaquo;</span></button>' )
				. '</div>';
		}
		$out .= '</div></div>';
	}
	$out .= '<input type="hidden" data-swt-block="' . swt_bl_attr( $id ) . '" data-swt-field="step" value="' . (int) $cur . '"/>';
	return $out . '</div>';
}

/* =============================================================== limits + save */

/** Enforce declared caps (a repeater's max is part of the mechanism, not a suggestion). */
function swt_blocks_sanitize_state( $ts_id, $state, $commit = false ) {
	$store = swt_blocks_store( $ts_id );
	$uid   = get_current_user_id();
	$prev  = array();
	if ( $uid ) {
		global $wpdb;
		$row = $wpdb->get_var( $wpdb->prepare( 'SELECT state_json FROM ' . $wpdb->prefix . 'swt_interactive_state WHERE user_id=%d AND ts_id=%d', $uid, (int) $ts_id ) );
		if ( $row ) { $prev = json_decode( (string) $row, true ); if ( ! is_array( $prev ) ) { $prev = array(); } }
	}
	$tracks = array();
	$walk = function ( $blocks ) use ( &$tracks, &$walk ) {
		foreach ( (array) $blocks as $b ) {
			if ( ! is_array( $b ) ) { continue; }
			foreach ( (array) ( $b['track'] ?? array() ) as $t ) { $tracks[] = $t; }
			if ( 'STEP_FLOW' === ( $b['type'] ?? '' ) ) { foreach ( (array) ( $b['steps'] ?? array() ) as $stp ) { $walk( $stp['blocks'] ?? array() ); } }
		}
	};
	foreach ( (array) ( $store['modules'] ?? array() ) as $blocks ) { $walk( $blocks ); }

	$hist = is_array( $prev['history'] ?? null ) ? $prev['history'] : array();
	/* the committed markers live on the server (the client only ever posts blocks) */
	$committed = is_array( $prev['committed'] ?? null ) ? $prev['committed'] : array();
	/* History is written ONLY on an explicit commit, so autosave can never log a half-finished change. */
	if ( $commit ) {
		foreach ( $tracks as $t ) {
			$path = (string) ( $t['path'] ?? '' );
			if ( '' === $path ) { continue; }
			$new = swt_bl_get( $state, $path );
			if ( null === $new || '' === $new ) { continue; }
			$from = (string) ( $t['from_path'] ?? '' );
			if ( array_key_exists( $path, $committed ) ) { $old = $committed[ $path ]; }
			elseif ( '' !== $from ) { $old = swt_bl_get( $prev, $from ); }
			else { $old = swt_bl_get( $prev, $path ); }
			$same = false;
			if ( is_numeric( $old ) && is_numeric( $new ) && (float) $old === (float) $new ) { $same = true; }
			if ( (string) $old === (string) $new ) { $same = true; }
			if ( $same ) { $committed[ $path ] = (string) $new; continue; }
			$reason = '';
			if ( ! empty( $t['reason_path'] ) ) { $reason = trim( (string) swt_bl_get( $state, (string) $t['reason_path'] ) ); }
			$hist[] = array(
				'path'   => $path,
				'label'  => (string) ( $t['label'] ?? $path ),
				'from'   => ( null === $old ? '' : (string) $old ),
				'to'     => (string) $new,
				'at'     => current_time( 'Y-m-d' ),
				'reason' => $reason,
			);
			$committed[ $path ] = (string) $new;
		}
		/* committed markers persisted below on every save (autosave must not wipe them) */
	}
	if ( count( $hist ) > 100 ) { $hist = array_slice( $hist, -100 ); }
	$state['history'] = $hist;
	$state['committed'] = $committed;
	if ( ! is_array( $state ) ) { $state = array(); }
	if ( ! is_array( $state['blocks'] ?? null ) ) { $state['blocks'] = array(); }
	foreach ( (array) ( $store['modules'] ?? array() ) as $blocks ) { swt_blocks_enforce_limits( $blocks, $state ); }
	return swt_blocks_recompute_state( $ts_id, $state );
}


function swt_blocks_enforce_limits( $blocks, &$state ) {
	foreach ( (array) $blocks as $b ) {
		if ( ! is_array( $b ) ) { continue; }
		$id = (string) ( $b['id'] ?? '' );
		if ( '' === $id ) { continue; }
		if ( 'REPEATER' === ( $b['type'] ?? '' ) && (int) ( $b['max'] ?? 0 ) > 0 ) {
			$rows = $state['blocks'][ $id ]['rows'] ?? null;
			if ( is_array( $rows ) && count( $rows ) > (int) $b['max'] ) {
				$state['blocks'][ $id ]['rows'] = array_slice( array_values( $rows ), 0, (int) $b['max'] );
			}
		}
		if ( ! empty( $b['max_where']['field'] ) ) {
		$sp = $b['max_where'];
		$rows = $state['blocks'][ $id ]['entries'] ?? null;
			if ( ! is_array( $rows ) ) { $rows = $state['blocks'][ $id ]['rows'] ?? array(); }
			$n = 0;
			foreach ( (array) $rows as $r ) { if ( is_array( $r ) && (string) ( $r[ $sp['field'] ] ?? '' ) === (string) ( $sp['eq'] ?? '' ) ) { $n++; } }
			if ( (int) ( $sp['max'] ?? 0 ) && $n > (int) $sp['max'] ) { $state['blocks'][ $id ]['_over_cap'] = $n; } else { unset( $state['blocks'][ $id ]['_over_cap'] ); }
		}
		if ( 'STEP_FLOW' === ( $b['type'] ?? '' ) && ! empty( $b['steps'] ) ) {
			foreach ( $b['steps'] as $stp ) { swt_blocks_enforce_limits( $stp['blocks'] ?? array(), $state ); }
		}
	}
}

/** Read ΓåÆ enforce ΓåÆ recompute. The single authority for what a saved state contains. */



/* =============================================================== context + assets */

/**
 * Server-formatted display values for every computed path, so the client never has to
 * guess currency or formatting (and an unknown value stays an honest gap).
 */
function swt_blocks_display_map( $ts_id, $computed ) {
	$map   = array();
	$store = swt_blocks_store( $ts_id );
	$walk  = function ( $blocks ) use ( &$map, $computed, &$walk ) {
		foreach ( (array) $blocks as $b ) {
			if ( ! is_array( $b ) ) { continue; }
			foreach ( (array) ( $b['ops'] ?? array() ) as $op ) {
				$p = (string) ( $op['output'] ?? '' );
				if ( '' === $p ) { continue; }
				$v = swt_bl_get( $computed, $p );
				$map[ 'computed.' . $p ] = ( null === $v )
					? '<span class="swt-gap">&mdash;</span>'
					: ( ! empty( $op['money'] ) ? swt_bl_money( $v ) : esc_html( (string) $v ) );
			}
			if ( 'STEP_FLOW' === ( $b['type'] ?? '' ) ) {
				foreach ( (array) ( $b['steps'] ?? array() ) as $stp ) { $walk( $stp['blocks'] ?? array() ); }
			}
		}
	};
	foreach ( (array) ( $store['modules'] ?? array() ) as $blocks ) { $walk( $blocks ); }
	return $map;
}

/** Render context: which product the blocks are being rendered for. */
function swt_blocks_ctx( $ts_id = null ) {
	static $cur = 0;
	if ( null !== $ts_id ) { $cur = (int) $ts_id; }
	return $cur;
}
function swt_blocks_ts() { return swt_blocks_ctx(); }

function swt_blocks_enqueue( $ts_id ) {
	$base = content_url( 'mu-plugins/swiipt-core' );
	wp_enqueue_style( 'swt-blocks', $base . '/css/swt-blocks.css', array(), '1.0.8' );
	wp_enqueue_script( 'swt-blocks', $base . '/js/swt-blocks.js', array(), '1.0.8', true );
	wp_localize_script( 'swt-blocks', 'SWT_BLOCKS', array(
		'ts'       => (int) $ts_id,
		'restBase' => esc_url_raw( rest_url( 'swt/v1/saas' ) ),
		'nonce'    => wp_create_nonce( 'wp_rest' ),
	) );
}
add_action( 'swt_saas_enqueue', 'swt_blocks_enqueue' );

/* =============================================================== REST: state */

add_action( 'rest_api_init', function () {
	$ns = 'swt/v1/saas';

	register_rest_route( $ns, '/state', array(
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => function ( $req ) { return is_user_logged_in() && function_exists( 'swt_app_can_access' ) && swt_app_can_access( (int) $req['ts'] ); },
		'callback'            => function ( $req ) {
			$ts = (int) $req['ts'];
			$uid = get_current_user_id();
			global $wpdb;
			$row = $wpdb->get_var( $wpdb->prepare(
				'SELECT state_json FROM ' . $wpdb->prefix . 'swt_interactive_state WHERE user_id=%d AND ts_id=%d', $uid, $ts ) );
			$state = $row ? json_decode( (string) $row, true ) : array();
			$c = isset( $state['computed'] ) ? $state['computed'] : array();
			return array( 'state' => is_array( $state ) ? $state : array(), 'computed' => $c, 'display' => swt_blocks_display_map( $ts, $c ) );
		},
	) );

	register_rest_route( $ns, '/state', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => function ( $req ) { return is_user_logged_in() && function_exists( 'swt_app_can_access' ) && swt_app_can_access( (int) $req['ts'] ); },
		'callback'            => function ( $req ) {
			$ts = (int) $req['ts'];
			$uid = get_current_user_id();
			$state = $req['state'];
			if ( ! is_array( $state ) ) { return new WP_Error( 'bad_state', 'state must be an object', array( 'status' => 400 ) ); }
			/* server is the authority: enforce mechanism caps, then recompute every figure */
			$state = swt_blocks_sanitize_state( $ts, $state, ! empty( $req['commit'] ) );
			global $wpdb;
			$wpdb->replace(
				$wpdb->prefix . 'swt_interactive_state',
				array( 'user_id' => $uid, 'ts_id' => $ts, 'state_json' => wp_json_encode( $state ) ),
				array( '%d', '%d', '%s' ) );
			$c = isset( $state['computed'] ) ? $state['computed'] : array();
			return array( 'ok' => true, 'computed' => $c, 'display' => swt_blocks_display_map( $ts, $c ), 'state' => $state, 'blocks_html' => swt_blocks_history_html( $ts, $state ) );
		},
	) );
} );

/* =============================================================== document artifact */

/** Build a print-ready document from live state + its document spec. */
function swt_blocks_document_html( $ts_id, $doc_id, $state, $with_actions = true ) {
	$docs = swt_blocks_documents( $ts_id );
	$doc  = $docs[ $doc_id ] ?? null;
	if ( ! is_array( $doc ) ) { return ''; }
	$rows = '';
	foreach ( (array) ( $doc['rows'] ?? array() ) as $r ) {
		$v = swt_bl_get( $state, (string) ( $r['path'] ?? '' ) );
		$rows .= '<tr><th>' . esc_html( $r['label'] ?? '' ) . '</th><td>'
			. ( ( null === $v || '' === $v ) ? '<span class="gap">?</span>' : ( ! empty( $r['money'] ) ? swt_bl_money( $v ) : esc_html( (string) $v ) ) ) . '</td></tr>';
	}
	foreach ( (array) ( $doc['tables'] ?? array() ) as $t ) {
		$col = (string) ( $t['collection'] ?? '' );
		$ent = swt_bl_get( $state, 'blocks.' . $col . '.entries' );
		if ( ! is_array( $ent ) || ! $ent ) { $ent = swt_bl_get( $state, 'blocks.' . $col . '.rows' ); }
		if ( ! is_array( $ent ) || ! $ent ) { continue; }
		/* optional filter: one printable can list only one verdict (the shopping list) */
		if ( ! empty( $t['where_field'] ) ) {
			$keep = array();
			foreach ( $ent as $rw ) {
				if ( ! is_array( $rw ) ) { continue; }
				$v = (string) ( $rw[ $t['where_field'] ] ?? '' );
				if ( '' !== (string) ( $t['where_eq'] ?? '' ) && $v !== (string) $t['where_eq'] ) { continue; }
				if ( ! empty( $t['where_in'] ) && is_array( $t['where_in'] ) ) { $ok = false; foreach ( $t['where_in'] as $w ) { if ( (string) $w === $v ) { $ok = true; break; } } if ( ! $ok ) { continue; } }
				$keep[] = $rw;
			}
			$ent = $keep;
			if ( ! $ent ) { continue; }
		}
		$cols = array(); foreach ( $ent as $e ) { foreach ( array_keys( (array) $e ) as $k ) { if ( '_' !== substr( $k, 0, 1 ) ) { $cols[ $k ] = true; } } }
		$rows .= '<tr><th colspan="' . ( count( $cols ) + 1 ) . '" class="sec">' . esc_html( $t['label'] ?? '' ) . '</th></tr>';
		$head = ''; foreach ( array_keys( $cols ) as $c ) { $head .= '<th>' . esc_html( ucfirst( str_replace( '_', ' ', $c ) ) ) . '</th>'; }
		$rows .= '<tr class="head">' . $head . '</tr>';
		foreach ( $ent as $e ) {
			$rows .= '<tr>'; foreach ( array_keys( $cols ) as $c ) { $rows .= '<td>' . esc_html( (string) ( $e[ $c ] ?? '' ) ) . '</td>'; } $rows .= '</tr>';
		}
	}
	$product = get_the_title( $ts_id );
	$actions = '';
	if ( $with_actions ) {
		$swt_pdf = add_query_arg( array( 'swt_doc' => $doc_id, 'swt_ts' => (int) $ts_id, 'format' => 'pdf' ), home_url( '/' ) );
		$actions = '<div class="doc-actions"><a class="doc-btn" href="' . esc_url( $swt_pdf ) . '">Download PDF</a>' . '<button type="button" class="doc-btn ghost" onclick="window.print()">Print / Save as PDF</button></div><!--DOC-NOTE-->';
	}
	$when    = date_i18n( 'j F Y' );
	return '<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>' . esc_html( $doc['title'] ?? $product ) . '</title>'
		. '<style>body{font:14px/1.6 Inter,system-ui,sans-serif;color:#17212B;margin:28px;}'
		. 'h1{font-size:22px;margin:0 0 2px;color:#0B1F33}h2{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6F35B5;margin:22px 0 6px}'
		. '.meta{color:#52606D;font-size:12px;margin-bottom:14px}'
		. 'table{width:100%;border-collapse:collapse;margin-top:6px}th,td{border:1px solid #DDE2E7;padding:8px 10px;text-align:left;vertical-align:top}'
		. 'th{background:#F8F4EC;font-weight:600;width:46%}tr.head th{background:#0B1F33;color:#fff;width:auto}th.sec{background:#EEF1F5;color:#0B1F33;font-weight:700}'
		. '.gap{color:#7B8794}.foot{margin-top:26px;color:#7B8794;font-size:11px}'
		. '.doc-actions{display:flex;gap:10px;margin:0 0 16px}.doc-btn{display:inline-block;background:#6F35B5;color:#fff;text-decoration:none;border:0;border-radius:8px;padding:10px 16px;font:700 13px/1 Inter,system-ui,sans-serif;cursor:pointer}.doc-btn.ghost{background:#fff;color:#6F35B5;border:1px solid #DDE2E7}.note-fallback{background:#FDF6E8;border:1px solid #EADFC6;border-radius:8px;padding:10px 12px;color:#8A5A00;font-size:12.5px}'
		. '@media print{.doc-actions{display:none}body{margin:12mm}}</style></head><body>'
		. $actions
		. '<h1>' . esc_html( $doc['title'] ?? $product ) . '</h1>'
		. '<div class="meta">' . esc_html( $product ) . ' ┬╖ generated ' . esc_html( $when ) . ' from your own recorded figures</div>'
		. ( '' !== trim( (string) ( $doc['note'] ?? '' ) ) ? '<p>' . esc_html( $doc['note'] ) . '</p>' : '' )
		. '<table>' . $rows . '</table>'
		. '<div class="foot">' . esc_html( $doc['foot'] ?? 'Educational content ΓÇö not medical, clinical or financial advice.' ) . '</div>'
		. ( $with_actions ? '<script>window.addEventListener("load",function(){window.print();});</script>' : '' )
		. '</body></html>';
}

/** ?swt_doc=<id>&swt_ts=<ts> ΓÇö the printable artifact, generated from live state. */
function swt_blocks_document_route() {
	if ( empty( $_GET['swt_doc'] ) ) { return; }
	$ts  = (int) ( $_GET['swt_ts'] ?? 0 );
	$doc = sanitize_key( wp_unslash( $_GET['swt_doc'] ) );
	if ( ! $ts || ! $doc ) { return; }
	if ( ! function_exists( 'swt_app_can_access' ) || ! swt_app_can_access( $ts ) ) {
		wp_safe_redirect( get_permalink( $ts ) );
		exit;
	}
	$state  = swt_saas_state( $ts );
	$as_pdf = ( 'pdf' === sanitize_key( (string) ( $_GET['format'] ?? '' ) ) );
	$note   = '';
	if ( $as_pdf && function_exists( 'swt_remote_render_html_pdf' ) ) {
		$pdf = swt_remote_render_html_pdf( swt_blocks_document_html( $ts, $doc, $state, false ) );
		if ( is_string( $pdf ) && strlen( $pdf ) > 800 && strpos( $pdf, '%PDF' ) === 0 ) {
			header( 'Content-Type: application/pdf' );
			header( 'Content-Disposition: attachment; filename="swiipt-' . $doc . '-' . gmdate( 'Ymd' ) . '.pdf"' );
			header( 'X-Robots-Tag: noindex, nofollow' );
			echo $pdf;
			exit;
		}
		$note = '<p class="note-fallback">The PDF service is unavailable right now - use Print / Save as PDF instead.</p>';
	}
	$html = swt_blocks_document_html( $ts, $doc, $state, true );
	if ( '' === $html ) { wp_safe_redirect( get_permalink( $ts ) ); exit; }
	if ( '' !== $note ) { $html = str_replace( '<!--DOC-NOTE-->', $note, $html ); }
	header( 'Content-Type: text/html; charset=utf-8' );
	header( 'X-Robots-Tag: noindex, nofollow' );
	echo $html;
	exit;
}
add_action( 'template_redirect', 'swt_blocks_document_route', 3 );

/* =============================================================== global rescue =============================================================== */

/** The Rescue composition (store.rescue) - rendered both as the drawer and as module-06. */
function swt_blocks_rescue_html( $ts_id, $state ) {
	$store = swt_blocks_store( $ts_id );
	$blocks = $store['rescue'] ?? null;
	if ( ! is_array( $blocks ) || ! $blocks ) { return ''; }
	swt_blocks_ctx( (int) $ts_id );
	return swt_blocks_render_list( $blocks, is_array( $state ) ? $state : array() );
}
add_filter( 'swt_saas_rescue_html', function ( $html, $ts_id, $state ) {
	$mine = swt_blocks_rescue_html( (int) $ts_id, $state );
	return '' !== trim( (string) $mine ) ? $mine : $html;
}, 10, 3 );
/* =============================================================== dashboard stats */

/** Declared stats over collections (counts, sums, due counts) - the dashboard reads these. */
function swt_blocks_stats( $ts_id, $state ) {
	$store = swt_blocks_store( $ts_id );
	$out   = array();
	foreach ( (array) ( $store['stats'] ?? array() ) as $spec ) {
		$col  = (string) ( $spec['collection'] ?? '' );
		$rows = swt_bl_get( $state, 'blocks.' . $col . '.entries' );
		if ( ! is_array( $rows ) ) { $rows = swt_bl_get( $state, 'blocks.' . $col . '.rows' ); }
		$rows  = is_array( $rows ) ? $rows : array();
		$match = array();
		foreach ( $rows as $r ) {
			if ( ! is_array( $r ) ) { continue; }
			if ( ! empty( $spec['where_field'] ) ) {
				$v = (string) ( $r[ $spec['where_field'] ] ?? '' );
				if ( isset( $spec['where_in'] ) && is_array( $spec['where_in'] ) ) {
					$ok = false; foreach ( $spec['where_in'] as $w ) { if ( (string) $w === $v ) { $ok = true; break; } }
					if ( ! $ok ) { continue; }
				} elseif ( isset( $spec['where_eq'] ) && $v !== (string) $spec['where_eq'] ) { continue; }
			}
			$match[] = $r;
		}
		$value = null;
		if ( ! empty( $spec['due_from'] ) ) {
			$today = current_time( 'Y-m-d' ); $off = (int) ( $spec['due_offset_days'] ?? 0 ); $n = 0;
			foreach ( $match as $r ) {
				$d = (string) ( $r[ $spec['due_from'] ] ?? '' );
				if ( '' === $d ) { continue; }
				$t = strtotime( $d );
				if ( $t && date( 'Y-m-d', $t + $off * DAY_IN_SECONDS ) <= $today ) { $n++; }
			}
			$value = $n;
		} elseif ( ! empty( $spec['due_field'] ) ) {
			$today = current_time( 'Y-m-d' ); $n = 0;
			foreach ( $match as $r ) { $d = (string) ( $r[ $spec['due_field'] ] ?? '' ); if ( '' !== $d && $d <= $today ) { $n++; } }
			$value = $n;
		} elseif ( ! empty( $spec['sum'] ) ) {
			$sum = null;
			foreach ( $match as $r ) {
				if ( isset( $r[ $spec['sum'] ] ) && is_numeric( $r[ $spec['sum'] ] ) ) { $sum = ( null === $sum ? 0.0 : $sum ) + (float) $r[ $spec['sum'] ]; }
			}
			$value = $sum;
		} else { $value = count( $match ); }
		$out[ (string) ( $spec['key'] ?? $col ) ] = array(
			'label' => (string) ( $spec['label'] ?? $spec['key'] ?? $col ),
			'value' => $value,
			'money' => ! empty( $spec['money'] ),
		);
	}
	return $out;
}

/** The shell's dashboard cards come from here (declared per product; honest dashes when absent). */
add_filter( 'swt_saas_dashboard_stats', function ( $stats, $ts_id, $state ) {
	return swt_blocks_stats( (int) $ts_id, is_array( $state ) ? $state : array() );
}, 10, 3 );
/* =============================================================== shell seams */

/** Render a module's stored composition (falls through to the shell's own content). */
add_filter( 'swt_saas_module_html', function ( $html, $slug, $ts_id, $state ) {
	if ( ! is_array( $state ) ) { $state = array(); }
	$store = swt_blocks_store( $ts_id );
	if ( 'blocks' === $slug ) { return swt_blocks_preview_html( (int) $ts_id ); }
	$blocks = $store['modules'][ $slug ] ?? null;
	if ( ! is_array( $blocks ) || ! $blocks ) { return $html; }
	swt_blocks_ctx( (int) $ts_id );
	$errs = swt_blocks_validate( $blocks );
	$out  = '';
	if ( $errs ) {
		$out .= '<div class="swt-note"><b>Composition problem.</b> This module is not rendering because its block spec is invalid: '
			. esc_html( implode( '; ', array_slice( $errs, 0, 4 ) ) ) . '</div>';
	}
	return $out . swt_blocks_render_list( $blocks, $state );
}, 10, 4 );

/** Admin-only block-library preview (a build tool, not product content). */
add_filter( 'swt_saas_views', function ( $views ) {
	if ( current_user_can( 'manage_options' ) ) {
		$views['blocks'] = array( 'num' => '', 'title' => 'Blocks', 'job' => 'Block library preview (admin only).', 'blocks' => array(), 'internal' => true );
	}
	return $views;
} );

/** The preview: every implemented block with sample props + validator results. */
function swt_blocks_preview_specs() {
	return array(
		array( 'type' => 'INTRO', 'id' => 'pv-intro', 'title' => 'Intro', 'body' => 'Promise, scope and orientation for the module.', 'bullets' => array( 'One task per screen', 'Nothing invented' ) ),
		array( 'type' => 'CARD', 'id' => 'pv-card', 'label' => 'Headline figure', 'value_path' => 'pv.refs', 'money' => true, 'note' => 'Quick reference' ),
		array( 'type' => 'STATUS', 'id' => 'pv-status', 'label' => 'Item status', 'value_path' => 'pv.status', 'tone' => 'warn' ),
		array( 'type' => 'PROGRESS', 'id' => 'pv-progress', 'label' => 'Modules started', 'done_sources' => array( 'pv.a', 'pv.b', 'pv.c' ) ),
		array( 'type' => 'FORM', 'id' => 'pv-form', 'fields' => array(
			array( 'id' => 'amount', 'label' => 'Amount', 'type' => 'number', 'unit' => 'per month' ),
			array( 'id' => 'when', 'label' => 'Date', 'type' => 'date' ),
			array( 'id' => 'kind', 'label' => 'Type', 'type' => 'select', 'options' => array( 'fixed', 'variable' ) ),
		) ),
		array( 'type' => 'REPEATER', 'id' => 'pv-rep', 'add_label' => 'Add cost', 'max' => 3, 'empty' => 'No rows yet.', 'columns' => array(
			array( 'id' => 'category', 'label' => 'Category' ), array( 'id' => 'amount', 'label' => 'Amount', 'type' => 'number' ),
		) ),
		array( 'type' => 'CALCULATOR', 'id' => 'pv-calc', 'ops' => array(
			array( 'op' => 'sum', 'inputs' => array( 'pv-form.amount' ), 'output' => 'pv.sum', 'label' => 'Total entered', 'money' => true ),
			array( 'op' => 'annualize', 'inputs' => array( 'pv.sum' ), 'output' => 'pv.year', 'label' => 'Annualised', 'money' => true ),
		) ),
		array( 'type' => 'RESULT', 'id' => 'pv-result', 'rows' => array(
			array( 'label' => 'Normal month', 'path' => 'computed.pv.sum', 'money' => true ),
			array( 'label' => 'Annual', 'path' => 'computed.pv.year', 'money' => true ),
		), 'gap_note' => 'Unknown figures stay an honest gap.' ),
		array( 'type' => 'DATE', 'id' => 'pv-date', 'label' => 'Bought on', 'offset_days' => 30, 'derived_label' => 'Day-30 date' ),
		array( 'type' => 'REMINDER', 'id' => 'pv-rem', 'label' => 'Review this on', 'lead_days' => 30, 'when_due_label' => 'Due now' ),
		array( 'type' => 'REVIEW', 'id' => 'pv-rev', 'cadence_days' => 30, 'prompt' => 'Read each row, mark a verdict.' ),
		array( 'type' => 'NOTE', 'id' => 'pv-note', 'label' => 'Why this decision' ),
		array( 'type' => 'CHECKLIST', 'id' => 'pv-check', 'items' => array( array( 'id' => 'a', 'label' => 'Post the chart' ), array( 'id' => 'b', 'label' => 'Name one buy' ) ) ),
		array( 'type' => 'PLAN', 'id' => 'pv-plan', 'steps' => array( array( 'id' => 's1', 'label' => 'Set the number', 'detail' => '15 minutes' ), array( 'id' => 's2', 'label' => 'Post the chart' ) ) ),
		array( 'type' => 'LOG', 'id' => 'pv-log', 'add_label' => 'Add item', 'fields' => array( array( 'id' => 'item', 'label' => 'Item' ), array( 'id' => 'uses', 'label' => 'Uses', 'type' => 'number' ) ), 'verdict_options' => array( 'keep' => 'Keep', 'review' => 'Review', 'resell' => 'Resell' ), 'verdict_label' => 'Day-30 verdict' ),
		array( 'type' => 'TRACKER', 'id' => 'pv-track', 'add_label' => 'Log a night', 'fields' => array( array( 'id' => 'score', 'label' => 'Score', 'type' => 'number', 'min' => 0, 'max' => 10 ) ) ),
		array( 'type' => 'COMPARISON', 'id' => 'pv-cmp', 'a_label' => 'Current', 'b_label' => 'Alternative',
			'a' => array( 'fields' => array( array( 'id' => 'cost', 'label' => 'Cost', 'type' => 'number' ) ) ),
			'b' => array( 'fields' => array( array( 'id' => 'cost', 'label' => 'Cost', 'type' => 'number' ) ) ),
			'out' => array( array( 'label' => 'Weekly difference', 'output' => 'pv.diff', 'money' => true ) ),
			'ops' => array(),
		),
		array( 'type' => 'DECISION_TREE', 'id' => 'pv-dt', 'start' => 'q1', 'nodes' => array(
			'q1' => array( 'q' => 'Does a need exist now?', 'options' => array( array( 'label' => 'Yes', 'next' => 'q2' ), array( 'label' => 'No', 'outcome' => 'wait' ) ) ),
			'q2' => array( 'q' => 'Does it fit the plan?', 'options' => array( array( 'label' => 'Yes', 'outcome' => 'buy' ), array( 'label' => 'Not yet', 'outcome' => 'wait' ) ) ),
		), 'outcomes' => array(
			'buy'  => array( 'label' => 'BUY', 'tone' => 'ok', 'body' => 'Need exists now and fits the plan.' ),
			'wait' => array( 'label' => 'WAIT', 'tone' => 'warn', 'body' => 'Not yet proven necessary.', 'next_label' => 'Set a review date.' ),
		) ),
		array( 'type' => 'COMPARISON', 'id' => 'pv-cmp2', 'a_label' => 'Old', 'b_label' => 'New', 'a' => array( 'fields' => array( array( 'id' => 'v', 'label' => 'Value', 'type' => 'number' ) ) ), 'b' => array( 'fields' => array( array( 'id' => 'v', 'label' => 'Value', 'type' => 'number' ) ) ), 'out' => array() ),
		array( 'type' => 'RESCUE', 'id' => 'pv-rescue', 'number_path' => 'pv.refs', 'steps' => array( 'Show the headline figure', 'Open the list', 'Run the decision flow', 'Park unresolved items', 'Restart the cycle' ) ),
		array( 'type' => 'GENERATE_DOCUMENT', 'id' => 'pv-doc', 'doc_id' => 'pv-preview', 'label' => 'Print / Save as PDF' ),
		array( 'type' => 'SAFETY', 'id' => 'pv-safety', 'title' => 'Scope', 'body' => 'General household planning, not regulated financial advice.', 'items' => array( 'If you are behind on essentials, seek qualified help.' ), 'crisis' => array( array( 'label' => 'National debtline', 'value' => '0800 000 0000', 'href' => 'tel:08000000000' ) ) ),
		array( 'type' => 'CONTINUATION', 'id' => 'pv-cont', 'title' => 'Next', 'body' => 'Continue to the chart.', 'label' => 'Continue', 'href' => '#' ),
		array( 'type' => 'SHARE', 'id' => 'pv-share', 'label' => 'Copy summary', 'paths' => array( array( 'label' => 'Normal', 'path' => 'computed.pv.sum' ) ) ),
		array( 'type' => 'STEP_FLOW', 'id' => 'pv-wiz', 'steps' => array(
			array( 'title' => 'Recurring costs', 'intro' => 'Add what repeats.', 'blocks' => array( array( 'type' => 'NOTE', 'id' => 'pv-w1', 'label' => 'Anything unusual?' ) ) ),
			array( 'title' => 'Occasional costs', 'intro' => 'Yearly or one-off.', 'blocks' => array( array( 'type' => 'NOTE', 'id' => 'pv-w2', 'label' => 'Notes' ) ) ),
		) ),
	);
}

function swt_blocks_preview_html( $ts_id = 0 ) {
	swt_blocks_ctx( (int) $ts_id );
	$specs = swt_blocks_preview_specs();
	$state = array();
	$reg   = swt_block_types();
	$missing = array();
	foreach ( $reg as $type => $info ) {
		if ( empty( $info['impl'] ) ) { continue; }
		if ( ! function_exists( 'swt_bl_' . strtolower( $type ) ) ) { $missing[] = $type; }
	}
	$errs = swt_blocks_validate( $specs );
	$out  = '<div class="swt-note"><b>Block library preview ΓÇö admin only.</b> Every block below is the real
		renderer with sample properties. Implemented: <b>' . ( count( $reg ) - 3 ) . '</b> of ' . count( $reg ) . '.'
		. ( $missing ? ' <b>Missing renderer:</b> ' . esc_html( implode( ', ', $missing ) ) : '' )
		. ( $errs ? ' <b>Validator:</b> ' . esc_html( implode( '; ', array_slice( $errs, 0, 3 ) ) ) : ' Validator: clean.' ) . '</div>';
	$out .= '<div class="swt-pv">' . swt_blocks_render_list( $specs, $state ) . '</div>';
	return $out;
}

/* ============================================================ DASHBOARD block
   The aggregate overview (hero + setup progress + verdict donut + tiles + range
   + documents + callout), rendered from canonical computed values. Copy and
   bindings come entirely from the block spec; no product words live here. */
function swt_bl_icon( $n, $s = 15, $c = 'currentColor' ) { return function_exists( 'swt_ds_icon' ) ? swt_ds_icon( $n, $s, $c ) : ''; }

function swt_bl_when( $when, $state ) {
	if ( ! is_array( $when ) || ! $when ) { return false; }
	if ( isset( $when['path'] ) ) { $v = swt_bl_get( $state, (string) $when['path'] ); return ( null !== $v && '' !== $v ); }
	if ( isset( $when['count'] ) || isset( $when['counts'] ) ) {
		$paths = isset( $when['counts'] ) ? (array) $when['counts'] : array( $when['count'] );
		$n = 0;
		foreach ( $paths as $p ) { $v = swt_bl_get( $state, (string) $p ); $n += is_array( $v ) ? count( $v ) : ( ( null === $v || '' === $v ) ? 0 : 1 ); }
		$gt = isset( $when['gt'] ) ? (int) $when['gt'] : 0;
		return $n > $gt;
	}
	if ( isset( $when['history'] ) ) { $h = isset( $state['history'] ) && is_array( $state['history'] ) ? $state['history'] : array(); return count( $h ) > (int) $when['history']; }
	return false;
}

function swt_bl_odo( $str ) {
	$k = 0; $out = '';
	$chars = preg_split( '//u', (string) $str, -1, PREG_SPLIT_NO_EMPTY );
	foreach ( (array) $chars as $ch ) {
		if ( preg_match( '/[0-9]/', $ch ) ) {
			$reel = '';
			for ( $d = 0; $d < 10; $d++ ) { $reel .= '<span>' . $d . '</span>'; }
			$out .= '<span class="od"><span class="od-r" style="--d:' . $ch . ';--k:' . ( $k++ ) . '">' . $reel . '</span></span>';
		} else {
			$out .= '<span class="od-s">' . esc_html( $ch ) . '</span>';
		}
	}
	return $out;
}

function swt_bl_dashboard( $s, $state ) {
	$ts = function_exists( 'swt_blocks_ctx' ) ? (int) swt_blocks_ctx() : 0;
	$get = function ( $p ) use ( $state ) { return ( '' === (string) $p ) ? null : swt_bl_get( $state, (string) $p ); };

	$hero    = (array) ( $s['hero'] ?? array() );
	$chips   = (array) ( $s['chips'] ?? array() );
	$setup   = (array) ( $s['setup'] ?? array() );
	$verdict = (array) ( $s['verdict'] ?? array() );
	$tiles   = (array) ( $s['tiles'] ?? array() );
	$range   = (array) ( $s['range'] ?? array() );
	$callout = (array) ( $s['callout'] ?? array() );

	$hv = $get( $hero['path'] ?? '' );
	$hasVal = ( null !== $hv && '' !== $hv );

	/* HERO */
	$out = '<div class="hero-card"><div class="hero-grid"></div><div class="sweep"></div>';
	$out .= '<div class="hero-top"><div class="hero-label">' . swt_bl_icon( 'wallet', 14, '#D9A52E' ) . ' ' . esc_html( $hero['label'] ?? '' ) . '</div>'
		. '<span class="live"><i></i>' . esc_html( date_i18n( 'D, M j' ) ) . '</span></div>';
	if ( $hasVal ) { $out .= '<div class="hero-odo">' . swt_bl_odo( html_entity_decode( swt_bl_money( $hv ), ENT_QUOTES | ENT_HTML5 ) ) . '<small>' . esc_html( $hero['unit'] ?? '' ) . '</small></div>'; }
	else { $out .= '<div class="hero-odo idle">' . esc_html( $hero['empty_title'] ?? 'Not set yet' ) . '</div>'; }
	$out .= '<div class="hero-sub">' . esc_html( $hasVal ? ( $hero['have'] ?? '' ) : ( $hero['empty'] ?? '' ) ) . '</div>';
	if ( $chips && $hasVal ) {
		$out .= '<div class="chips">';
		foreach ( $chips as $c ) {
			$cv = $get( $c['path'] ?? '' );
			$out .= '<button class="chip" data-act="goto-view" data-view="' . swt_bl_attr( $c['view'] ?? '' ) . '"><em>' . esc_html( $c['label'] ?? '' ) . '</em><b>' . ( null === $cv ? '&mdash;' : swt_bl_money( $cv ) ) . '</b></button>';
		}
		$out .= '</div>';
	}
	$out .= '<button class="btn btn-gold" data-act="goto-view" data-view="' . swt_bl_attr( $hero['cta_view'] ?? '' ) . '">' . esc_html( $hasVal ? ( $hero['cta_have'] ?? '' ) : ( $hero['cta_empty'] ?? '' ) ) . ' ' . swt_bl_icon( 'arrow-right', 15 ) . '</button></div>';

	/* SETUP */
	$steps = (array) ( $setup['steps'] ?? array() );
	if ( $steps ) {
		$doneCount = 0; $next = null;
		foreach ( $steps as $st ) { if ( swt_bl_when( $st['when'] ?? array(), $state ) ) { $doneCount++; } elseif ( null === $next ) { $next = $st; } }
		$pct = (int) round( $doneCount / max( 1, count( $steps ) ) * 100 );
		$out .= '<div class="card tile journey"><div class="tile-head"><div class="tile-ic">' . swt_bl_icon( 'sparkles', 15 ) . '</div>'
			. '<div><div class="card-title" style="margin:0">' . esc_html( $setup['title'] ?? '' ) . '</div><div class="card-sub" style="margin:2px 0 0">'
			. (int) $doneCount . ' ' . esc_html( $setup['of'] ?? '' ) . ( $next ? ' &middot; ' . esc_html( $setup['next'] ?? '' ) . ': <b style="color:var(--gold-l);font-weight:600">' . esc_html( $next['label'] ?? '' ) . '</b>' : ' &middot; ' . esc_html( $setup['done'] ?? '' ) )
			. '</div></div><div class="jpct">' . $pct . '<small>%</small></div></div>'
			. '<div class="track"><i style="width:' . $pct . '%"></i></div><div class="nodes">';
		foreach ( $steps as $st ) {
			$ok = swt_bl_when( $st['when'] ?? array(), $state );
			$isNext = ( $next && ( $next['view'] ?? '' ) === ( $st['view'] ?? '' ) );
			$out .= '<button class="node' . ( $ok ? ' done' : '' ) . ( $isNext ? ' next' : '' ) . '" data-act="goto-view" data-view="' . swt_bl_attr( $st['view'] ?? '' ) . '"><span class="nd">'
				. swt_bl_icon( $ok ? 'check' : ( $st['icon'] ?? 'circle' ), 16 ) . '</span><span class="nl">' . esc_html( $st['label'] ?? '' ) . '</span></button>';
		}
		$out .= '</div></div>';
	}

	/* BENTO */
	$out .= '<div class="bento">';
	if ( $verdict ) {
		$col = (string) ( $verdict['collection'] ?? '' );
		$field = (string) ( $verdict['field'] ?? '_verdict' );
		$options = (array) ( $verdict['options'] ?? array() );
		$entries = (array) swt_bl_get( $state, 'blocks.' . $col . '.entries' );
		$counts = array(); foreach ( $options as $k => $lbl ) { $counts[ $k ] = 0; }
		foreach ( $entries as $e ) { $v = (string) ( $e[ $field ] ?? '' ); if ( isset( $counts[ $v ] ) ) { $counts[ $v ]++; } }
		$total = array_sum( $counts );
		$nb = count( array_filter( $counts ) );
		$RC = 54; $CIRC = 2 * M_PI * $RC; $gap = $nb > 1 ? 5 : 0; $off = 0;
		$arc = function ( $k, $v ) use ( &$off, $CIRC, $total, $gap ) {
			if ( ! $v || $total <= 0 ) { return ''; }
			$len = max( $CIRC * $v / $total - $gap, 1 );
			$el = '<circle class="arc a-' . $k . '" data-k="' . $k . '" cx="70" cy="70" r="54" stroke-dasharray="' . round( $len, 2 ) . ' ' . round( $CIRC - $len, 2 ) . '" stroke-dashoffset="' . round( - $off, 2 ) . '"/>';
			$off += $CIRC * $v / $total;
			return $el;
		};
		$dp = $get( $verdict['deferred_path'] ?? '' );
		$held = $total - ( $counts['buy'] ?? 0 );
		$out .= '<div class="card tile verdict-tile" data-total="' . $total . '"><div class="tile-head"><div class="tile-ic">' . swt_bl_icon( 'scale-3d', 15 ) . '</div><div class="card-title" style="margin:0">' . esc_html( $verdict['title'] ?? '' ) . '</div></div>'
			. '<div class="vbody"><div class="dn"><svg viewBox="0 0 140 140"><circle class="dn-track" cx="70" cy="70" r="54"/><g transform="rotate(-90 70 70)">' . $arc( 'buy', $counts['buy'] ?? 0 ) . $arc( 'wait', $counts['wait'] ?? 0 ) . $arc( 'never', $counts['never'] ?? 0 ) . '</g></svg>'
			. '<div class="dn-c"><b class="dn-num">' . $total . '</b><span class="dn-lbl">' . esc_html( $verdict['word'] ?? '' ) . '</span></div></div><div class="vrows">';
		foreach ( $options as $k => $lbl ) {
			$cnt = $counts[ $k ] ?? 0;
			$w = $total ? round( $cnt / $total * 100 ) : 0;
			$out .= '<button class="vrow" data-act="goto-view" data-view="' . swt_bl_attr( $verdict['view'] ?? '' ) . '" data-k="' . swt_bl_attr( $k ) . '" data-c="' . $cnt . '" data-l="' . swt_bl_attr( $lbl ) . '"><i class="d-' . swt_bl_attr( $k ) . '"></i><span class="vl">' . esc_html( $lbl ) . '</span><span class="vbar"><u class="mix-' . swt_bl_attr( $k ) . '" style="width:' . $w . '%"></u></span><b class="vc">' . $cnt . '</b></button>';
		}
		$out .= '</div></div><button class="btn btn-ghost btn-sm vcta" data-act="goto-view" data-view="' . swt_bl_attr( $verdict['view'] ?? '' ) . '">' . esc_html( $verdict['cta'] ?? '' ) . ' ' . swt_bl_icon( 'arrow-right', 13 ) . '</button></div>';
	}
	foreach ( $tiles as $t ) {
		$kind = (string) ( $t['kind'] ?? 'money' );
		$view = (string) ( $t['view'] ?? '' );
		if ( 'money' === $kind ) {
			$v = $get( $t['path'] ?? '' ); $sub = (string) ( $t['sub'] ?? '' ); $sv = (string) ( $t['sub_path'] ?? '' );
			$n = (int) $get( $sv );
			$out .= '<div class="card tile" role="button" tabindex="0" data-act="goto-view" data-view="' . swt_bl_attr( $view ) . '"><div class="tile-head"><div class="tile-ic gold">' . swt_bl_icon( $t['icon'] ?? 'wallet', 15 ) . '</div><span class="tile-go">' . swt_bl_icon( 'arrow-right', 16 ) . '</span></div>'
				. '<div class="sv" data-swt-live="' . swt_bl_attr( $t['path'] ?? '' ) . '">' . ( null === $v ? '&mdash;' : swt_bl_money( $v ) ) . '</div><div class="sl">' . esc_html( $t['label'] ?? '' ) . '</div>'
				. '<div class="ss">' . esc_html( $sv && $n > 0 ? $sub . ' ' . $n . ( $n > 1 ? 's' : '' ) : ( $t['empty'] ?? '' ) ) . '</div></div>';
		} elseif ( 'count' === $kind ) {
			$v = $get( $t['path'] ?? '' ); $max = (int) ( $t['max'] ?? 0 ); $vn = ( null === $v ) ? 0 : (int) $v; $kept = (int) $get( $t['kept_path'] ?? '' );
			$pips = '';
			for ( $i = 0; $i < max( 1, $max ); $i++ ) { $pips .= '<i class="pip' . ( $i < $vn ? ' on' : '' ) . '"></i>'; }
			$out .= '<div class="card tile" role="button" tabindex="0" data-act="goto-view" data-view="' . swt_bl_attr( $view ) . '"><div class="tile-head"><div class="tile-ic">' . swt_bl_icon( $t['icon'] ?? 'shuffle', 15 ) . '</div><span class="tile-go">' . swt_bl_icon( 'arrow-right', 16 ) . '</span></div>'
				. '<div class="sv-row"><span class="sv">' . $vn . '</span><span class="of">' . esc_html( $t['of'] ?? '' ) . '</span></div><div class="sl">' . esc_html( $t['label'] ?? '' ) . '</div>'
				. '<div class="pips">' . $pips . '</div><div class="ss">' . $kept . ' ' . esc_html( $t['kept'] ?? '' ) . '</div></div>';
		} elseif ( 'audit' === $kind ) {
			$logged = (int) $get( $t['logged_path'] ?? '' ); $keep = (int) $get( $t['keep_path'] ?? '' ); $review = (int) $get( $t['review_path'] ?? '' ); $resell = (int) $get( $t['resell_path'] ?? '' );
			$due = 0;
			if ( ! empty( $t['due'] ) && is_array( $t['due'] ) ) { $col = (string) ( $t['due']['collection'] ?? '' ); $df = (string) ( $t['due']['date_field'] ?? '_date' ); $vf = (string) ( $t['due']['verdict_field'] ?? '_verdict' ); $days = (int) ( $t['due']['days'] ?? 30 ); $es = (array) swt_bl_get( $state, 'blocks.' . $col . '.entries' ); $today = date( 'Y-m-d' ); foreach ( $es as $e ) { $vv = (string) ( $e[ $vf ] ?? '' ); $dt = (string) ( $e[ $df ] ?? '' ); if ( '' === $vv && '' !== $dt && date( 'Y-m-d', strtotime( $dt . ' +' . $days . ' days' ) ) <= $today ) { $due++; } } }
			$out .= '<div class="card tile t-audit" role="button" tabindex="0" data-act="goto-view" data-view="' . swt_bl_attr( $view ) . '"><div class="tile-head"><div class="tile-ic blue">' . swt_bl_icon( $t['icon'] ?? 'clipboard-list', 15 ) . '</div><div class="card-title" style="margin:0">' . esc_html( $t['label'] ?? '' ) . '</div>'
				. ( $due ? '<span class="stat warn"><i></i>' . esc_html( $t['need'] ?? '' ) . '</span>' : '<span class="stat ok"><i></i>' . esc_html( $logged ? ( $t['ok'] ?? '' ) : ( $t['none'] ?? '' ) ) . '</span>' ) . '<span class="tile-go">' . swt_bl_icon( 'arrow-right', 16 ) . '</span></div>'
				. '<div class="audit-body"><div><div class="sv">' . $due . '</div><div class="sl">' . esc_html( $t['due_label'] ?? '' ) . '</div></div>'
				. '<div class="minis"><span><b>' . $keep . '</b>' . esc_html( $t['keep_label'] ?? 'Kept' ) . '</span><span><b>' . $review . '</b>' . esc_html( $t['review_label'] ?? 'Review' ) . '</span><span><b>' . $resell . '</b>' . esc_html( $t['resell_label'] ?? 'Resell' ) . '</span><span><b>' . $logged . '</b>' . esc_html( $t['logged_label'] ?? 'Logged' ) . '</span></div></div></div>';
		}
	}
	$out .= '</div>';

	/* RANGE */
	if ( $range ) {
		$lean = $get( $range['lean'] ?? '' ); $normal = $get( $range['normal'] ?? '' ); $peak = $get( $range['peak'] ?? '' );
		$out .= '<div class="card tile range-card"><div class="tile-head"><div class="tile-ic gold">' . swt_bl_icon( 'banknote', 15 ) . '</div>'
			. '<div><div class="card-title" style="margin:0">' . esc_html( $range['title'] ?? '' ) . '</div><div class="card-sub" style="margin:2px 0 0">' . esc_html( $range['sub'] ?? '' ) . '</div></div>'
			. '<button class="btn btn-ghost btn-sm" style="margin-left:auto" data-act="goto-view" data-view="' . swt_bl_attr( $range['view'] ?? '' ) . '">' . esc_html( $range['cta'] ?? '' ) . ' ' . swt_bl_icon( 'arrow-right', 13 ) . '</button></div>';
		if ( null === $normal ) {
			$out .= '<div class="range-empty">' . esc_html( $range['empty'] ?? '' ) . '</div>';
		} else {
			$span = ( (float) $peak - (float) $lean ) ?: 1;
			$pos = min( 100, max( 0, ( (float) $normal - (float) $lean ) / $span * 100 ) );
			$out .= '<div class="range-wrap" data-lean="' . swt_bl_attr( $lean ) . '" data-peak="' . swt_bl_attr( $peak ) . '"><div class="scrub"><span>' . esc_html( swt_bl_money( $normal ) ) . '</span></div>'
				. '<div class="range"><i class="range-fill"></i><b class="range-dot" style="left:' . round( $pos, 1 ) . '%"></b></div>'
				. '<div class="range-labels"><div><span>' . esc_html( $range['lean_label'] ?? 'Lean' ) . '</span><em class="rv" data-swt-live="' . swt_bl_attr( $range['lean'] ?? '' ) . '">' . esc_html( swt_bl_money( $lean ) ) . '</em></div>'
				. '<div class="mid"><span>' . esc_html( $range['normal_label'] ?? 'Normal' ) . '</span><em class="rv" data-swt-live="' . swt_bl_attr( $range['normal'] ?? '' ) . '">' . esc_html( swt_bl_money( $normal ) ) . '</em></div>'
				. '<div><span>' . esc_html( $range['peak_label'] ?? 'Peak' ) . '</span><em class="rv" data-swt-live="' . swt_bl_attr( $range['peak'] ?? '' ) . '">' . esc_html( swt_bl_money( $peak ) ) . '</em></div></div></div>';
		}
		$out .= '</div>';
	}

	/* DOCUMENTS */
	if ( ! empty( $s['documents'] ) && $ts ) {
		$store = function_exists( 'swt_blocks_store' ) ? swt_blocks_store( $ts ) : array();
		$docs = (array) ( $store['documents'] ?? array() );
		if ( $docs ) {
			$out .= '<div class="card tile"><div class="tile-head"><div class="tile-ic">' . swt_bl_icon( 'package', 15 ) . '</div><div class="card-title" style="margin:0">' . esc_html( $s['docs_title'] ?? 'Your documents' ) . '</div></div>';
			foreach ( $docs as $id => $d ) {
				$title = is_array( $d ) ? ( $d['title'] ?? $d['label'] ?? (string) $id ) : (string) $id;
				$url = home_url( '/?swt_doc=' . rawurlencode( (string) $id ) . '&swt_ts=' . (int) $ts );
				$out .= '<div class="doc-row"><span>' . esc_html( $title ) . '</span><a class="btn btn-ghost btn-sm" href="' . esc_url( $url ) . '" target="_blank" rel="noopener">' . esc_html( $s['docs_open'] ?? 'Open' ) . '</a></div>';
			}
			$out .= '</div>';
		}
	}

	/* CALLOUT */
	if ( $callout ) {
		$tone = in_array( (string) ( $callout['tone'] ?? '' ), array( 'info', 'warning', 'success', 'protocol', 'safety' ), true ) ? $callout['tone'] : 'info';
		$icm = array( 'info' => 'info', 'warning' => 'triangle-alert', 'success' => 'circle-check-big', 'protocol' => 'shield-check', 'safety' => 'triangle-alert' );
		$out .= '<div class="callout ' . swt_bl_attr( $tone ) . '"><div class="ic">' . swt_bl_icon( $icm[ $tone ] ?? 'info', 15, '#fff' ) . '</div>'
			. '<div class="body"><span class="lbl">' . esc_html( $callout['title'] ?? '' ) . '</span><div class="tx">' . esc_html( $callout['body'] ?? '' ) . '</div></div></div>';
	}

	return $out;
}


/** SCRIPT: a conversation script card (label + when + the exact words + copy). */
function swt_bl_script( $s, $state ) {
	$t = (string) ( $s['title'] ?? '' );
	$w = (string) ( $s['when'] ?? '' );
	$x = (string) ( $s['text'] ?? '' );
	$n = (string) ( $s['n'] ?? '' );
	return '<div class="swt-script-card"><div class="swt-script-head">'
		. ( '' !== $n ? '<span class="swt-script-n">' . esc_html( $n ) . '</span>' : '' )
		. '<b>' . esc_html( $t ) . '</b>'
		. ( '' !== $w ? '<em>' . esc_html( $w ) . '</em>' : '' ) . '</div>'
		. ( '' !== $x ? '<div class="swt-script-text">' . esc_html( $x ) . '</div>' : '' )
		. '<button type="button" class="swt-btn ghost swt-btn-sm" data-swt-copy="' . swt_bl_attr( $x ) . '">Copy</button></div>';
}