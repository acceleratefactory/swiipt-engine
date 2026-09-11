# F3-F — Wire the Flipbook Instance (final step)

**Date:** 2026-08-28
**Status:** Ready to run once Novamira MCP is back (server timeouts currently)

## What's done (F3-A → F3-E)

| Item | Status |
|---|---|
| **F3-A** rasterize | ✅ 24 page JPGs at `uploads/swiipt-assets/v06-ebook/pages/page-01..24.jpg` (135 DPI) |
| **F3-B** page-flip JS | ✅ vendored to `swiipt-core/assets/js/page-flip.browser.js` (44,058 bytes, byte-exact) |
| **F3-C** flipbook shell | ✅ `uploads/swiipt-assets/v06-ebook/index.html` (page-flip reader: TOC, zoom-ready, progress, Fullscreen, Download PDF cross-links) — all 25 assets HTTP 200 |
| **F3-D** read shell | ✅ `uploads/swiipt-assets/v06-ebook/read.html` (responsive cards, 24 sec-anchors, style-read.css) |
| **F3-E** read-aloud | ✅ TTS "Read aloud" button + speechSynthesis in read.html |

**New engine file:** `wp-content/mu-plugins/swiipt-core/includes/ebook-formats.php` (25,307 bytes) with:
- `swt_delivery_flipbook_rasterize($pdf, $out_dir, $dpi, $base_url)`
- `swt_delivery_flipbook_shell($title, $subtitle, $page_urls, $toc, $pdf_url, $read_url, $app_url)`
- `swt_delivery_read_shell(...)` + `swt_fmt_wrap_pages()`
- `swt_fmt_tts_script()` + `swt_fmt_mark_svg()` + `swt_fmt_flipbook_css()`

**CSS:** `swt-style-read.css` ported (4,898 bytes) at `swiipt-core/assets/css/`
**Modules.php:** requires added for ebook-weasyprint.php / ebook-remote.php / ebook-formats.php

---

## F3-F — the one remaining step

The flipbook instance in the DB must point at the new shell, and the delivery shortcode / My Library must open the flipbook reader for the ebook entry.

Run this via Novamira `execute-php` when MCP is back:

```php
global $wpdb;

// 1. Point the V06 ebook's flipbook instance at the new shell.
//    (V06 TS = 85. For the combined ebook we use a dedicated instance.)
//    The new flipbook shell is at:
//    uploads/swiipt-assets/v06-ebook/index.html

$flip_url = content_url('uploads/swiipt-assets/v06-ebook/index.html?v=' . time());

// If there's an existing "flipbook" instance for the V06 ebook, update it;
// otherwise insert one. (asset_id = the V06 ebook asset.)
// For V06 the ebook is asset-based; the exact asset_id is looked up below:
$asset = $wpdb->get_row($wpdb->prepare(
    "SELECT id FROM {$wpdb->prefix}swiipt_transformation_system_assets
     WHERE ts_id=%d AND format='Read' ORDER BY id LIMIT 1", 85));
if ($asset) {
    $exists = $wpdb->get_var($wpdb->prepare(
        "SELECT id FROM {$wpdb->prefix}swiipt_asset_instances
         WHERE asset_id=%d AND kind='flipbook'", $asset->id));
    if ($exists) {
        $wpdb->update(
            $wpdb->prefix.'swiipt_asset_instances',
            array('file_url'=>$flip_url, 'generated_at'=>current_time('mysql')),
            array('id'=>$exists), array('%s','%s'), array('%d'));
    } else {
        $wpdb->insert(
            $wpdb->prefix.'swiipt_asset_instances',
            array('asset_id'=>$asset->id,'kind'=>'flipbook','file_url'=>$flip_url,'generated_at'=>current_time('mysql')),
            array('%d','%s','%s','%s'));
    }
    echo 'flipbook instance updated for asset #'.$asset->id."\n";
} else {
    echo 'no V06 ebook asset found (ts 85 format Read)'."\n";
}

// 2. Verify
$rows = $wpdb->get_results($wpdb->prepare(
    "SELECT id, kind, file_url FROM {$wpdb->prefix}swiipt_asset_instances WHERE asset_id=%d",
    $asset ? $asset->id : 0));
foreach ($rows as $r) echo '  inst '.$r->id.' kind='.$r->kind.' url='.$r->file_url."\n";
```

## After F3-F

- The My Library / System page "Read as magazine" link opens `index.html` (the page-flip reader hub)
- The "Read" link opens `read.html` (responsive cards with TTS)
- The "Download PDF" button inside both downloads the WeasyPrint ebook (`v06-ebook-from-vps.pdf`)
- Next: verify visually against `reference/flipbook/index.html` + `reference/read.html`
