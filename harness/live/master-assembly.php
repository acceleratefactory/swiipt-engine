<?php
/**
 * Module: GENERIC MASTER PRODUCT ASSEMBLY — the live factory path (v2: semantic composition).
 *
 * Canonical DB assets -> SEMANTIC F1 tree (each asset's canonical mode selects its component
 * class: READ=editorial, DO=checklist, DECIDE=decision-tree, TRACK=tracker, RESCUE=rescue-card,
 * COMMUNICATE=script-card) -> the V06-grade renderer (swt_ebook_render = swt_ds_* design authority)
 * -> ONE premium MASTER_PRODUCT -> WeasyPrint PDF. Product-agnostic. Fail-closed.
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

const SWT_MASTER_KIND   = 'master_product';
const SWT_MASTER_DA_ID  = 'SWIIPT-CUSTOMER-PRODUCT-DESIGN-AUTHORITY';
const SWT_MASTER_DA_VER = '1.0';
const SWT_MASTER_META   = array( 'pdf' => '_swt_ebook_pdf_url', 'flipbook' => '_swt_ebook_flipbook_url', 'read' => '_swt_ebook_read_url', 'lineage' => '_swt_master_lineage' );

/** Canonical functional mode -> V06-grade component class (semantic composition mapping). */
function swt_master_mode_class() {
    return array( 'READ' => 'editorial', 'DO' => 'checklist', 'DECIDE' => 'decision-tree', 'TRACK' => 'tracker', 'RESCUE' => 'rescue-card', 'COMMUNICATE' => 'script-card', 'BUILD' => 'checklist', 'PRINT' => 'schedule-grid' );
}
function swt_master_design_authority() {
    return array( 'id' => SWT_MASTER_DA_ID, 'version' => SWT_MASTER_DA_VER,
        'navy' => '#0B1F33', 'purple' => '#6F35B5', 'gold' => '#D9A52E', 'blush' => '#F3C7D2',
        'warm' => '#F8F4EC', 'soft' => '#F4F6F8', 'ink' => '#17212B', 'muted' => '#7B8794' );
}
function swt_master_cover_ref( $pid ) {
    $id = (string) get_post_meta( $pid, '_swiipt_cover_identity', true );
    $url = (string) get_post_meta( $pid, '_swiipt_cover_url', true );
    if ( $id !== '' && $url !== '' ) { return array( 'identity' => $id, 'url' => $url ); }
    $m = (string) get_post_meta( $pid, '_swiipt_manifest_pid', true );
    return array( 'identity' => $m !== '' ? 'COVER-' . $m . '.portrait' : '', 'url' => $url );
}

/** Build the SEMANTIC F1 tree from canonical live records. Position preserved; mode-driven. */
function swt_master_tree( $ts_id, $pid ) {
    global $wpdb;
    $pr = get_post( $pid );
    if ( ! $pr ) { return new WP_Error( 'master', 'product missing' ); }
    $rows = $wpdb->get_results( $wpdb->prepare(
        'SELECT id,title,format,asset_type,content,position FROM ' . $wpdb->prefix . 'swiipt_transformation_system_assets WHERE ts_id=%d ORDER BY position,id', $ts_id ) );
    $cm = swt_master_mode_class();
    $modules = array(); $contents = array();
    foreach ( (array) $rows as $r ) {
        $a = (array) $r;
        $c = (string) $a['content'];
        if ( trim( $c ) === '' || stripos( $c, 'Placeholder content for' ) !== false ) {
            return new WP_Error( 'master', 'asset "' . $a['title'] . '" placeholder/empty (fail closed)' );
        }
        $mode = strtoupper( (string) $a['asset_type'] );
        if ( ! isset( $cm[ $mode ] ) ) { $mode = strtoupper( (string) $a['format'] ); }
        $cls  = isset( $cm[ $mode ] ) ? $cm[ $mode ] : 'editorial';
        $blocks = function_exists( 'swt_cs_blocks' ) ? swt_cs_blocks( $c ) : array();
        $modules[]  = array( 'class' => $cls, 'title' => (string) $a['title'], 'mode' => $mode, 'blocks' => $blocks );
        $contents[] = array( 'num' => str_pad( (string) ( count( $contents ) + 1 ), 2, '0', STR_PAD_LEFT ), 'title' => (string) $a['title'], 'desc' => '', 'tag' => $mode );
    }
    if ( ! $modules ) { return new WP_Error( 'master', 'no canonical assets (fail closed)' ); }
    $tr_id = (int) get_post_meta( $ts_id, 'swt_transformation_id', true );
    $tr    = $tr_id ? get_post( $tr_id ) : null;
    $promise = (string) $pr->post_excerpt;
    return array(
        'product' => array( 'title' => (string) $pr->post_title ),
        'front_matter' => array(
            'cover' => array( 'title' => (string) $pr->post_title, 'subtitle' => $promise, 'promise' => $promise, 'kicker' => 'Swiipt Transformation System' ),
            'identity' => array( 'This system is' => $promise, 'Life area' => (string) get_post_meta( $ts_id, 'swt_transformation_area', true ), 'It is not' => 'regulated financial, debt, investment or relationship advice.' ),
            'contents' => $contents,
            'roadmap' => array_map( function ( $m ) { return array( 'title' => $m['title'], 'desc' => $m['mode'] ); }, $modules ),
            'roadmap_title' => 'How This System Works',
        ),
        'modules' => $modules,
        'appendix' => array(),
    );
}

/** Master HTML via the V06-grade renderer (design authority), not hand-rolled CSS. */
function swt_master_html( $tree, $cover ) {
    if ( function_exists( 'swt_ebook_render' ) ) { return swt_ebook_render( $tree ); }
    return '';
}

/** Assemble + render the MASTER product. Fail-closed. Product-agnostic. */
function swt_master_assemble( $ts_id, $pid ) {
    $errors = array();
    $da    = swt_master_design_authority();
    $cover = swt_master_cover_ref( $pid );
    if ( empty( $cover['identity'] ) ) { $errors[] = 'MASTER_COVER_MISSING'; }
    $tree  = swt_master_tree( $ts_id, $pid );
    if ( is_wp_error( $tree ) ) { $errors[] = 'MASTER_TREE: ' . $tree->get_error_message(); }
    if ( $errors ) { return array( 'ok' => false, 'errors' => $errors ); }
    $html = swt_master_html( $tree, $cover );
    if ( $html === '' ) { return array( 'ok' => false, 'errors' => array( 'MASTER_RENDER_MISSING' ) ); }
    if ( ! function_exists( 'swt_remote_render_html_pdf' ) ) { return array( 'ok' => false, 'errors' => array( 'MASTER_RENDERER_MISSING' ) ); }
    $pdf = swt_remote_render_html_pdf( $html );
    if ( ! is_string( $pdf ) || strlen( $pdf ) < 8000 || strpos( $pdf, '%PDF' ) !== 0 ) {
        return array( 'ok' => false, 'errors' => array( 'MASTER_RENDER_FAILED' ) );
    }
    $up   = wp_upload_dir();
    $base = $up['basedir'] . '/swiipt-assets/master-' . (int) $ts_id;
    $url  = $up['baseurl'] . '/swiipt-assets/master-' . (int) $ts_id;
    if ( ! is_dir( $base ) ) { wp_mkdir_p( $base ); }
    file_put_contents( $base . '/master.pdf', $pdf );
    file_put_contents( $base . '/master.src.html', $html );
    $pdf_url = $url . '/master.pdf?v=' . time();
    $lineage = array(
        'product_id' => $pid, 'ts_id' => (int) $ts_id,
        'master_kind' => SWT_MASTER_KIND, 'design_authority_id' => $da['id'], 'design_authority_version' => $da['version'],
        'canonical_cover' => $cover['identity'], 'renderer' => 'swt_ebook_render',
        'assets' => array_map( function ( $m ) { return $m['title'] . ' [' . $m['mode'] . '->' . $m['class'] . ']'; }, $tree['modules'] ),
        'assembler_version' => '2.0', 'pdf_ref' => $pdf_url, 'pdf_bytes' => strlen( $pdf ), 'produced_at' => current_time( 'mysql' ),
    );
    update_post_meta( $pid, SWT_MASTER_META['pdf'], $pdf_url );
    update_post_meta( $pid, SWT_MASTER_META['lineage'], $lineage );
    update_post_meta( $pid, '_swiipt_master_pdf_bytes', strlen( $pdf ) );
    return array( 'ok' => true, 'pdf' => $pdf_url, 'bytes' => strlen( $pdf ), 'lineage' => $lineage, 'sections' => array_map( function ( $m ) { return $m['mode'] . '->' . $m['class']; }, $tree['modules'] ), 'errors' => array() );
}

/** Attach MASTER_PRODUCT first + the standalone printable tools. */
function swt_master_attach_delivery( $pid, $ts_id ) {
    $pdf = (string) get_post_meta( $pid, SWT_MASTER_META['pdf'], true );
    if ( $pdf === '' ) { return false; }
    if ( function_exists( 'swt_commerce_attach_downloads' ) ) { swt_commerce_attach_downloads( $pid, $ts_id ); }
    $dl  = (array) get_post_meta( $pid, '_downloadable_files', true );
    $out = array( 'swiipt-master-' . $ts_id => array( 'id' => 'swiipt-master-' . $ts_id, 'name' => get_the_title( $pid ) . ' — Complete System (PDF)', 'file' => $pdf ) );
    foreach ( $dl as $k => $v ) { $out[ 'tool-' . $k ] = $v; }
    update_post_meta( $pid, '_downloadable_files', $out );
    update_post_meta( $pid, '_downloadable', 'yes' );
    return true;
}
