<?php
/**
 * SWIIPT App v2 ΓÇö clean rebuild on the reference architecture (part 1: helpers).
 *
 * New files only; the v1 engine is untouched and stays live for any product
 * whose _swiipt_app_shell is not 'saas2'. Revert = set the flag back to 'saas'.
 * State shape, REST state/event endpoints, caps, validators, documents and
 * entitlement are shared with v1 ΓÇö v2 is a new presentation + runtime only.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
/**
 * Required app layers (anti-thin-app gate). Every product app must surface a
 * measurement/result layer, keep a register for captured entries, give every
 * printable real content, and carry full (non-truncated) content.
 * Call from the factory/gate BEFORE publishing.
 */
function swt_app_layers_check( $ts_id ) {
	$b = get_post_meta( (int) $ts_id, '_swiipt_ix_blocks', true );
	$mods = (array) ( $b['modules'] ?? array() ); $blocks = array();
	foreach ( $mods as $m ) { foreach ( (array) $m as $blk ) { if ( is_array( $blk ) ) { $blocks[] = $blk; } } }
	$types = array_map( function ( $x ) { return strtoupper( (string) ( $x['type'] ?? '' ) ); }, $blocks );
	$errors = array();
	if ( ! array_intersect( $types, array( 'RESULT', 'PROGRESS', 'STATS', 'DASHBOARD' ) ) ) { $errors[] = 'no measurement layer (add a RESULT/PROGRESS/STATS/DASHBOARD reading the product TSM)'; }
	if ( ! array_intersect( $types, array( 'LOG', 'REPEATER', 'TRACKER' ) ) ) { $errors[] = 'no register (LOG/REPEATER/TRACKER) for captured entries'; }
	$docs = (array) ( $b['documents'] ?? array() );
	foreach ( $blocks as $blk ) { if ( 'GENERATE_DOCUMENT' === strtoupper( (string) ( $blk['type'] ?? '' ) ) ) { $did = (string) ( $blk['doc_id'] ?? '' ); $d = (array) ( $docs[ $did ] ?? array() ); if ( empty( $d['rows'] ) && empty( $d['tables'] ) ) { $errors[] = 'printable "' . $did . '" has no rows/tables (empty print)'; } } }
	foreach ( $blocks as $blk ) { $t = (string) ( $blk['text'] ?? '' ); if ( '' !== $t && preg_match( '/\.\.\.\s*$/', $t ) ) { $errors[] = 'block "' . ( $blk['id'] ?? '?' ) . '" content looks truncated (ends in ...)'; } }
	return array( 'pass' => empty( $errors ), 'errors' => $errors );
}

/* Return the customer to the app after a branded login (redirect_to, same-host only). */
add_filter( 'woocommerce_login_redirect', function ( $redirect, $user ) {
	$to = ! empty( $_REQUEST['redirect_to'] ) ? esc_url_raw( wp_unslash( $_REQUEST['redirect_to'] ) ) : '';
	if ( '' === $to ) { $ref = wp_get_referer(); if ( $ref && false !== strpos( $ref, 'redirect_to=' ) ) { $q = array(); parse_str( (string) wp_parse_url( $ref, PHP_URL_QUERY ), $q ); if ( ! empty( $q['redirect_to'] ) ) { $to = esc_url_raw( rawurldecode( $q['redirect_to'] ) ); } } }
	if ( '' !== $to && 0 === strpos( $to, home_url() ) ) { return $to; }
	return $redirect;
}, 10, 2 );


define( 'SWT_APP2_CSS_VER', '1.0.15' );
define( 'SWT_APP2_JS_VER',  '1.3.7' );

/** v2 serves a TS only when it explicitly opts in. */
function swt_app2_enabled( $ts_id ) {
	return 'saas2' === (string) get_post_meta( (int) $ts_id, '_swiipt_app_shell', true );
}

/** Recipe id per TS (default fm); unknown recipes disable v2 for that TS. */
function swt_app2_recipe_id( $ts_id ) {
	$r = (string) get_post_meta( (int) $ts_id, '_swiipt_app2_recipe', true );
	return (string) $r;
}

function swt_app2_recipe( $ts_id ) {
	$rid = swt_app2_recipe_id( $ts_id );
	$fn  = 'swt_app2_recipe_' . preg_replace( '/[^a-z0-9_]/', '', strtolower( $rid ) );
	if ( function_exists( $fn ) ) { return call_user_func( $fn ); }
	return null;
}

/** First DECISION_TREE block across modules (generic; v2 decide view walks it). */
function swt_app2_find_dt( $ts_id ) {
	$b = get_post_meta( (int) $ts_id, '_swiipt_ix_blocks', true );
	$mods = ( is_array( $b ) && isset( $b['modules'] ) ) ? $b['modules'] : array();
	$walk = function ( $blocks ) use ( &$walk ) {
		foreach ( (array) $blocks as $blk ) {
			if ( ! is_array( $blk ) ) { continue; }
			if ( 'DECISION_TREE' === ( $blk['type'] ?? '' ) ) { return $blk; }
			if ( 'STEP_FLOW' === ( $blk['type'] ?? '' ) && ! empty( $blk['steps'] ) ) {
				foreach ( (array) $blk['steps'] as $stp ) {
					$f = $walk( $stp['blocks'] ?? array() );
					if ( $f ) { return $f; }
				}
			}
		}
		return null;
	};
	foreach ( (array) $mods as $blocks ) {
		$f = $walk( $blocks );
		if ( $f ) { return $f; }
	}
	return null;
}

/** LOG block by id across modules. */
function swt_app2_find_log( $ts_id, $id ) {
	$b = get_post_meta( (int) $ts_id, '_swiipt_ix_blocks', true );
	$mods = ( is_array( $b ) && isset( $b['modules'] ) ) ? $b['modules'] : array();
	foreach ( (array) $mods as $blocks ) {
		foreach ( (array) $blocks as $blk ) {
			if ( is_array( $blk ) && 'LOG' === ( $blk['type'] ?? '' ) && $id === ( $blk['id'] ?? '' ) ) { return $blk; }
		}
	}
	return null;
}
/* SWIIPT App v2 ΓÇö part 2: product context, standalone route, reset endpoint. */
/** Product context for the shell (name/area/code from live records). */
function swt_app2_product( $ts_id ) {
	global $wpdb;
	$link = $wpdb->get_row( $wpdb->prepare(
		'SELECT product_id, transformation_system_id FROM ' . $wpdb->prefix . 'swiipt_product_transformations WHERE transformation_system_id=%d LIMIT 1',
		(int) $ts_id
	) );
	$name = '';
	$pid  = 0;
	if ( $link && ! empty( $link->product_id ) ) {
		$pid  = (int) $link->product_id;
		$name = get_the_title( $pid );
	}
	if ( '' === $name ) { $name = get_the_title( (int) $ts_id ); }
	$area = '';
	$code = '';
	$tid = (int) get_post_meta( (int) $ts_id, 'swt_transformation_id', true );
	if ( $tid ) {
		$terms = wp_get_post_terms( $tid, 'life_area', array( 'fields' => 'names' ) );
		if ( ! is_wp_error( $terms ) && $terms ) { $area = (string) $terms[0]; }
		$code = (string) get_post_meta( $tid, '_swiipt_manifest_pid', true );
	}
	if ( '' === $code && $pid ) { $code = (string) get_post_meta( $pid, '_swiipt_manifest_pid', true ); }
	$read = $pid ? (string) get_post_meta( $pid, '_swt_ebook_read_url', true ) : ''; if ( '' === $read ) { $read = (string) get_permalink( (int) $ts_id ); }
	return array( 'name' => (string) $name, 'area' => (string) $area, 'code' => (string) $code, 'product_id' => $pid, 'read_url' => $read );
}

/** Standalone app document (reference index.html shape, boot data injected). */
function swt_app2_standalone() {
	if ( ! isset( $_GET['swiipt_app'] ) ) { return; }
	$ts = (int) $_GET['swiipt_app'];
	if ( ! $ts || ! swt_app2_enabled( $ts ) ) { return; }
	$boot = swt_app2_boot( $ts );
	if ( ! $boot ) { return; }
	$xp = isset( $boot['copy']['experience'] ) ? $boot['copy']['experience'] : null;
	if ( is_array( $xp ) && ! empty( $xp['explicit'] ) && empty( $xp['validation']['pass'] ) ) {
		if ( function_exists( 'swt_audit' ) ) { swt_audit( 'experience_recipe_invalid', array( 'ts' => $ts, 'errors' => $xp['validation']['errors'] ), get_current_user_id() ); }
		if ( current_user_can( 'manage_options' ) ) { wp_die( 'Experience Recipe invalid (TS ' . (int) $ts . '): ' . esc_html( implode( '; ', (array) ( $xp['validation']['errors'] ?? array() ) ) ) ); }
		wp_die( 'This interactive experience is temporarily unavailable.', 'Unavailable', array( 'response' => 503 ) );
	}

	$view = isset( $_GET['v'] ) ? preg_replace( '/[^a-z0-9_\-]/', '', (string) $_GET['v'] ) : 'dashboard';
	$gate = function_exists( 'swt_app_can_access' ) ? swt_app_can_access( $ts ) : is_user_logged_in();
	nocache_headers();
	header( 'Content-Type: text/html; charset=' . get_bloginfo( 'charset' ) );
	echo '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>'
		. '<meta name="viewport" content="width=device-width, initial-scale=1"/>'
		. '<meta name="robots" content="noindex,nofollow"/>'
		. '<title>' . esc_html( $boot['copy']['title'] . ' ΓÇö App' ) . '</title>';
	$base = content_url( 'mu-plugins/swiipt-core' );
	echo '<link rel="stylesheet" href="' . esc_url( $base . '/css/swt-app2.css?ver=' . SWT_APP2_CSS_VER ) . '"/>';
	echo '<link rel="stylesheet" href="' . esc_url( $base . '/css/swt-app2-blocks.css?ver=' . SWT_APP2_CSS_VER ) . '"/>';
	echo '</head><body class="swt-app2-body">';
	echo '<div class="bg-aurora"></div><div class="bg-noise"></div>';
	echo '<div class="app-shell"><div class="sidebar"><div class="brand-mark" id="brandMark"></div>'
		. '<div class="nav-section-label">Modules</div><div id="sidebarNav"></div>'
		. '<div class="sidebar-foot">' . esc_html( $boot['copy']['title'] ) . '<br/>' . esc_html( $boot['copy']['area'] ) . '</div></div>';
	echo '<div class="nav-scrim" id="navScrim"></div>';
	$swt_book_svg = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';
	echo '<div class="main-col"><div class="topbar"><button class="icon-btn nav-toggle" id="navToggle" aria-label="Menu"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg></button><div class="topbar-title" id="topbarTitle">Dashboard</div>'
		. '<div class="topbar-right"><div class="budget-pill"><span class="bl">' . esc_html( isset( $boot['copy']['experience']['completion']['label'] ) ? $boot['copy']['experience']['completion']['label'] : 'Overview' ) . '</span> '
		. '<span class="bv" id="budgetNumberVal">Not set yet</span></div> '
		. '<span id="savePill" class="save-pill" data-tone=""></span> '
		. '<a class="icon-btn" id="btnRead" href="' . esc_url( $boot['copy']['product']['read_url'] ) . '" target="_blank" rel="noopener" aria-label="Read" title="Read">' . $swt_book_svg . '</a> '
		. '<button class="btn btn-danger btn-sm" id="btnRescue" data-act="open-rescue"></button> '
		. '<button class="icon-btn" id="btnSettings" data-act="open-settings" aria-label="Settings"></button>'
		. '</div></div><div class="main" id="main"></div></div></div>';
	echo '<div class="overlay-wrap" id="overlayRescue"><div class="overlay-panel">'
		. '<div class="overlay-head red"><b>' . esc_html( $boot['copy']['rescue']['title'] ) . '</b>'
		. '<button class="overlay-close" data-act="close-rescue">&times;</button></div>'
		. '<div class="overlay-body" id="rescueBody"></div></div></div>';
	echo '<div class="overlay-wrap" id="overlaySettings"><div class="overlay-panel">'
		. '<div class="overlay-head"><b>Scope &amp; Settings</b>'
		. '<button class="overlay-close" data-act="close-settings">&times;</button></div>'
		. '<div class="overlay-body" id="settingsBody"></div></div></div>';
	echo '<div class="toast" id="toast"></div>';
	if ( ! $gate ) {
		$login = add_query_arg( 'redirect_to', rawurlencode( home_url( '/?swiipt_app=' . $ts . '&v=' . $view ) ), home_url( '/my-account/' ) );
		echo '<div class="app2-gate"><div class="card"><div class="card-title">'
			. esc_html( $boot['copy']['title'] ) . '</div><div class="card-sub">'
			. 'This interactive app opens with your purchase. Please sign in to continue.</div>'
			. '<a class="btn btn-purple" href="' . esc_url( $login ) . '">Sign in</a></div></div>';
	}
	$boot['view'] = $view;
	echo '<script>window.SWIIPT_APP2 = ' . wp_json_encode( $boot ) . ';</script>';
	echo '<script src="' . esc_url( $base . '/js/swt-app2-icons.js?ver=' . SWT_APP2_JS_VER ) . '"></script>';
	echo '<script src="' . esc_url( $base . '/js/swt-app2.js?ver=' . SWT_APP2_JS_VER ) . '"></script>';
	echo '<script src="' . esc_url( $base . '/js/swt-app2-blocks.js?ver=' . SWT_APP2_JS_VER ) . '"></script>';
	echo '</body></html>';
	exit;
}
add_action( 'template_redirect', 'swt_app2_standalone', 3 );

/** Reset endpoint: delete this viewer's state row (generic, gated, audited). */
function swt_app2_reset_route() {
	register_rest_route( 'swt/v1/saas', '/reset', array(
		'methods'             => 'POST',
		'permission_callback' => function ( $req ) {
			return is_user_logged_in() && function_exists( 'swt_app_can_access' ) && swt_app_can_access( (int) $req['ts'] );
		},
		'callback'            => function ( $req ) {
			global $wpdb;
			$ts  = (int) $req['ts'];
			$uid = get_current_user_id();
			$wpdb->delete( $wpdb->prefix . 'swt_interactive_state', array( 'user_id' => $uid, 'ts_id' => $ts ), array( '%d', '%d' ) );
			if ( function_exists( 'swt_audit' ) ) { swt_audit( 'ix_state_reset', array( 'ts' => $ts ), $uid ); }
			return array( 'ok' => true );
		},
	) );
}
add_action( 'rest_api_init', 'swt_app2_reset_route' );
/** Fresh server HTML for one view (generic screens go stale after client edits). */
function swt_app2_screen_route() {
	register_rest_route( 'swt/v1/saas', '/screen', array(
		'methods'             => 'GET',
		'permission_callback' => function ( $req ) {
			return is_user_logged_in() && function_exists( 'swt_app_can_access' ) && swt_app_can_access( (int) $req['ts'] );
		},
		'callback'            => function ( $req ) {
			$ts   = (int) $req['ts'];
			$view = preg_replace( '/[^a-z0-9_\-]/', '', (string) $req['view'] );
			if ( ! function_exists( 'swt_xp_render_screen' ) ) { return array( 'html' => '' ); }
			$recipe = swt_xp_recipe( $ts );
			$sig    = swt_xp_signals( $ts );
			$state  = swt_xp_state( $ts, $recipe, $sig );
			$raw    = isset( $sig['state'] ) ? $sig['state'] : array();
			return array( 'html' => swt_xp_render_screen( $ts, $view, $recipe, $state, $raw ) );
		},
	) );
}
add_action( 'rest_api_init', 'swt_app2_screen_route' );
/* SWIIPT App v2 ΓÇö boot payload + documents (part of interactive-app2.php). */
/** Printable documents from the composition (generic; titles or ids). */
function swt_app2_docs( $ts_id ) {
	$b = get_post_meta( (int) $ts_id, '_swiipt_ix_blocks', true );
	$docs = ( is_array( $b ) && isset( $b['documents'] ) && is_array( $b['documents'] ) ) ? $b['documents'] : array();
	$out = array();
	foreach ( $docs as $id => $d ) {
		$title = is_array( $d ) ? ( $d['title'] ?? $d['label'] ?? (string) $id ) : (string) $id;
		$out[] = array(
			'id'    => (string) $id,
			'title' => (string) $title,
			'url'   => home_url( '/?swt_doc=' . rawurlencode( (string) $id ) . '&swt_ts=' . (int) $ts_id ),
		);
	}
	return $out;
}

/** Rescue for the overlay: live config when it carries steps, else recipe fallback. */
function swt_app2_rescue( $ts_id, $recipe ) {
	$cfg = get_post_meta( (int) $ts_id, '_swiipt_interactive_config', true );
	$flow = ( is_array( $cfg ) && isset( $cfg['rescueFlow'] ) && is_array( $cfg['rescueFlow'] ) ) ? $cfg['rescueFlow'] : null;
	$steps = array();
	if ( $flow && ! empty( $flow['steps'] ) && is_array( $flow['steps'] ) ) {
		foreach ( (array) $flow['steps'] as $s ) {
			if ( is_string( $s ) ) { $steps[] = array( 'tone' => 'info', 'title' => '', 'body' => $s ); continue; }
			if ( ! is_array( $s ) ) { continue; }
			$tone = (string) ( $s['tone'] ?? $s['type'] ?? 'info' );
			if ( ! in_array( $tone, array( 'info', 'warning', 'success', 'protocol', 'safety' ), true ) ) { $tone = 'info'; }
			$steps[] = array(
				'tone'  => $tone,
				'title' => (string) ( $s['title'] ?? '' ),
				'body'  => (string) ( $s['body'] ?? $s['text'] ?? '' ),
			);
		}
	}
	$fb = ( isset( $recipe['rescueFallback'] ) && is_array( $recipe['rescueFallback'] ) ) ? $recipe['rescueFallback'] : array();
	$fb += array( 'title' => '', 'phrase' => '', 'steps' => array() );
	if ( ! $steps ) {
		return array(
			'title'  => (string) $fb['title'],
			'phrase' => (string) $fb['phrase'],
			'steps'  => $fb['steps'],
		);
	}
	return array(
		'title'  => ( $flow && ! empty( $flow['title'] ) ) ? (string) $flow['title'] : (string) $fb['title'],
		'phrase' => (string) $fb['phrase'],
		'steps'  => $steps,
	);
}

/** Full boot payload for the v2 runtime (records first, recipe fallback). */
function swt_app2_boot( $ts_id ) {
	$ts_id  = (int) $ts_id;
	$recipe = swt_app2_recipe( $ts_id );
		if ( ! $recipe ) {
		$xpmeta = get_post_meta( (int) $ts_id, '_swiipt_experience_recipe', true );
		if ( ! ( is_string( $xpmeta ) && '' !== trim( $xpmeta ) ) ) { return null; }
	}
	$prod = swt_app2_product( $ts_id );
	$copy = is_array( $recipe ) ? $recipe : array();
	if ( empty( $copy['title'] ) ) { $copy['title'] = $prod['name']; }
	if ( empty( $copy['area'] ) ) { $copy['area'] = $prod['area']; }
	/* LOG records: live titles/notes/empties/labels win over recipe. */
	foreach ( array( 'decisions', 'swaps', 'audit' ) as $lid ) {
		$log = swt_app2_find_log( $ts_id, $lid );
		if ( ! $log ) { continue; }
		$pick = array( 'title', 'note', 'empty', 'add_label', 'date_label', 'verdict_label' );
		foreach ( $pick as $k ) {
			if ( isset( $log[ $k ] ) && '' !== trim( (string) $log[ $k ] ) ) {
				$ck = ( 'decisions' === $lid ? 'decide' : ( 'swaps' === $lid ? 'swap' : 'audit' ) );
				$map = array(
					'title' => 'regTitle', 'note' => 'regNote', 'empty' => 'regEmpty',
					'add_label' => 'addBtn', 'date_label' => 'dateLabel', 'verdict_label' => 'verdictLabel',
				);
				$copy[ $ck ][ $map[ $k ] ] = (string) $log[ $k ];
			}
		}
		if ( 'swaps' === $lid && ! empty( $log['max_where'] ) && is_array( $log['max_where'] ) ) {
			$copy['swap']['capMax'] = (int) ( $log['max_where']['max'] ?? 3 );
			$copy['swap']['capEq']  = (string) ( $log['max_where']['eq'] ?? 'testing' );
		}
	}
	/* Decision tree: live spec (nodes/outcomes/record) or nothing. */
	$dt = swt_app2_find_dt( $ts_id );
	$copy['dt'] = $dt ? array(
		'start'         => (string) ( $dt['start'] ?? '' ),
		'nodes'         => $dt['nodes'] ?? array(),
		'outcomes'      => $dt['outcomes'] ?? array(),
		'record_to'     => (string) ( $dt['record_to'] ?? '' ),
		'record_fields' => $dt['record_fields'] ?? array(),
	) : null;
	$copy['rescue']    = swt_app2_rescue( $ts_id, $recipe );
	$copy['documents'] = swt_app2_docs( $ts_id );
	swt_app2_merge_live( $ts_id, $copy );
	/* Generic settings + toast copy: a product that ships no scope copy still
	   renders a working Scope & Settings panel (and reset). Content may override. */
	$copy['scope'] = is_array( $copy['scope'] ?? null ) ? $copy['scope'] : array();
	$copy['scope'] += array(
		'whatTitle'   => 'What this app is',
		'whatText'    => 'A working space that keeps your own numbers and decisions in one place.',
		'notTitle'    => 'What it is not',
		'notText'     => 'It is not medical, legal or financial advice, and it does not decide for you.',
		'scopeTitle'  => 'Scope',
		'scopeText'   => 'It reflects only what you enter. Anything you leave blank stays blank.',
		'safetyTitle' => 'If things are serious',
		'safetyText'  => 'If you are in danger or dealing with a crisis, contact a qualified professional or your local emergency service.',
		'dataTitle'   => 'Your data',
		'exportBtn'   => 'Export my data',
		'resetBtn'    => 'Reset this app',
		'resetAsk'    => 'Reset this app? This deletes everything you have entered and cannot be undone.',
	);
	$copy['toasts'] = is_array( $copy['toasts'] ?? null ) ? $copy['toasts'] : array();
	$copy['toasts'] += array(
		'saved'         => 'Saved',
		'added'         => 'Added',
		'needName'      => 'Add a name first.',
		'savedDecision' => 'Saved - ',
		'copied'        => 'Copied',
		'full'          => 'That is more than the mechanism allows.',
	);
	$copy['experience'] = function_exists( 'swt_xp_compose' ) ? swt_xp_compose( $ts_id ) : null;
	$copy['product']   = $prod;
	global $wpdb;
	$row = $wpdb->get_var( $wpdb->prepare(
		'SELECT state_json FROM ' . $wpdb->prefix . 'swt_interactive_state WHERE user_id=%d AND ts_id=%d',
		get_current_user_id(), $ts_id
	) );
	$state = $row ? json_decode( (string) $row, true ) : array();
	if ( ! is_array( $state ) ) { $state = array(); }
	if ( ! isset( $state['blocks'] ) || ! is_array( $state['blocks'] ) ) { $state['blocks'] = array(); }
	$seed = array();
	foreach ( (array) swt_app2_blocks( $ts_id ) as $mblocks ) { swt_app2_walk_blocks( $mblocks, function ( $blk ) use ( &$seed ) {
		if ( ! empty( $blk['id'] ) ) { $seed[ $blk['id'] ] = (string) ( $blk['type'] ?? '' ); }
	} );
	}
	foreach ( $seed as $bid => $btype ) {
		if ( ! isset( $state['blocks'][ $bid ] ) ) {
			if ( 'REPEATER' === $btype ) { $state['blocks'][ $bid ] = array( 'rows' => array() ); }
			elseif ( 'LOG' === $btype || 'COLLECTION' === $btype ) { $state['blocks'][ $bid ] = array( 'entries' => array() ); }
			else { $state['blocks'][ $bid ] = array(); }
		}
	}
	if ( function_exists( 'swt_blocks_recompute_state' ) ) { $state = swt_blocks_recompute_state( $ts_id, $state ); }
	$computed = isset( $state['computed'] ) && is_array( $state['computed'] ) ? $state['computed'] : array();
	$display  = function_exists( 'swt_blocks_display_map' ) ? swt_blocks_display_map( $ts_id, $computed ) : array();
	return array(
		'ts'       => $ts_id,
		'view'     => 'dashboard',
		'copy'     => $copy,
		'symbol'   => function_exists( 'get_woocommerce_currency_symbol' ) ? html_entity_decode( (string) get_woocommerce_currency_symbol(), ENT_QUOTES | ENT_HTML5 ) : '',
		'state'    => $state,
		'computed' => $computed,
		'display'  => $display,
		'restBase' => esc_url_raw( rest_url( 'swt/v1/saas' ) ),
		'nonce'    => wp_create_nonce( 'wp_rest' ),
	);
}
/* SWIIPT App v2 ΓÇö live merge: structure/copy the composition already carries
   (LOG/REPEATER fields, purchase form, verdict options, caps, decision tree)
   flows into boot.copy so the runtime renders records, never hardcoded copy. */
function swt_app2_blocks( $ts_id ) {
	$b = get_post_meta( (int) $ts_id, '_swiipt_ix_blocks', true );
	return ( is_array( $b ) && isset( $b['modules'] ) && is_array( $b['modules'] ) ) ? $b['modules'] : array();
}

function swt_app2_walk_blocks( $blocks, $cb ) {
	foreach ( (array) $blocks as $blk ) {
		if ( ! is_array( $blk ) ) { continue; }
		call_user_func( $cb, $blk );
		if ( 'STEP_FLOW' === ( $blk['type'] ?? '' ) && ! empty( $blk['steps'] ) ) {
			foreach ( (array) $blk['steps'] as $stp ) {
				swt_app2_walk_blocks( $stp['blocks'] ?? array(), $cb );
			}
		}
	}
}

function swt_app2_merge_live( $ts_id, &$copy ) {
	$mods = swt_app2_blocks( $ts_id );
	$logs = array();
	$reps = array();
	$forms = array();
	foreach ( (array) $mods as $blocks ) {
		swt_app2_walk_blocks( $blocks, function ( $blk ) use ( &$logs, &$reps, &$forms ) {
			if ( 'LOG' === ( $blk['type'] ?? '' ) && isset( $blk['id'] ) ) { $logs[ $blk['id'] ] = $blk; }
			if ( 'REPEATER' === ( $blk['type'] ?? '' ) && isset( $blk['id'] ) ) { $reps[ $blk['id'] ] = $blk; }
			if ( 'FORM' === ( $blk['type'] ?? '' ) && isset( $blk['id'] ) ) { $forms[ $blk['id'] ] = $blk; }
		} );
	}
	if ( ! isset( $copy['fields'] ) ) { $copy['fields'] = array(); }
	foreach ( array( 'decisions', 'swaps', 'audit' ) as $lid ) {
		if ( isset( $logs[ $lid ]['fields'] ) ) { $copy['fields'][ $lid ] = array_values( $logs[ $lid ]['fields'] ); }
	}
	if ( isset( $reps['rec']['columns'] ) ) { $copy['quiz']['addFields']['rec'] = array_values( $reps['rec']['columns'] ); }
	if ( isset( $reps['occ']['columns'] ) ) { $copy['quiz']['addFields']['occ'] = array_values( $reps['occ']['columns'] ); }
	$purchase = null;
	foreach ( (array) $mods as $blocks ) {
		foreach ( (array) $blocks as $blk ) {
			if ( ! is_array( $blk ) || 'STEP_FLOW' !== ( $blk['type'] ?? '' ) || empty( $blk['steps'] ) ) { continue; }
			$has_dt = false;
			$first_form = null;
			foreach ( (array) $blk['steps'] as $stp ) {
				foreach ( (array) ($stp['blocks'] ?? array()) as $sb ) {
					if ( ! is_array( $sb ) ) { continue; }
					if ( 'DECISION_TREE' === ( $sb['type'] ?? '' ) ) { $has_dt = true; }
					if ( 'FORM' === ( $sb['type'] ?? '' ) && null === $first_form ) { $first_form = $sb; }
				}
			}
			if ( $has_dt && $first_form && isset( $first_form['fields'] ) ) { $purchase = $first_form; break 2; }
		}
	}
	if ( $purchase && isset( $purchase['fields'] ) ) { $copy['decide']['formFields'] = array_values( $purchase['fields'] ); }
	foreach ( array( 'swaps' => 'swap', 'audit' => 'audit' ) as $lid => $ck ) {
		if ( ! isset( $logs[ $lid ] ) ) { continue; }
		$lg = $logs[ $lid ];
		if ( isset( $lg['verdict_options'] ) ) { $copy[ $ck ]['verdictOptions'] = $lg['verdict_options']; }
		$fields = isset( $lg['fields'] ) ? array_values( $lg['fields'] ) : array();
		$allow = ( isset( $lg['add_fields'] ) && is_array( $lg['add_fields'] ) ) ? $lg['add_fields'] : null;
		$add = array();
		foreach ( $fields as $fl ) {
			if ( ! is_array( $fl ) || ! isset( $fl['id'] ) ) { continue; }
			if ( in_array( $fl['type'] ?? '', array( 'computed', 'date_derived' ), true ) ) { continue; }
			if ( is_array( $allow ) && ! in_array( $fl['id'], $allow, true ) ) { continue; }
			$add[] = $fl;
		}
		if ( $add ) { $copy[ $ck ]['addFields'] = $add; }
		if ( isset( $lg['add_label'] ) && '' !== trim( (string) $lg['add_label'] ) ) { $copy[ $ck ]['addBtn'] = (string) $lg['add_label']; }
	}
	if ( isset( $logs['swaps']['max_where']['max'] ) ) { $copy['swap']['capMax'] = (int) $logs['swaps']['max_where']['max']; }
	if ( isset( $logs['swaps']['max_where']['eq'] ) ) { $copy['swap']['capEq'] = (string) $logs['swaps']['max_where']['eq']; }
}
