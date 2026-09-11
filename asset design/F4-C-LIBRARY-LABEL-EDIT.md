# F4-C — Account OS Library panel: ebook → flipbook reader

**Date:** 2026-08-28
**Status:** Ready to apply when Novamira MCP is back (server timeouts currently)

## The one remaining edit

`wp-content/themes/swiipt/inc/account.php` — the `swt_acct2_kind_label()` function:
relabel the ebook kinds so the Library panel shows the combined ebook clearly.

**From:**
```php
function swt_acct2_kind_label( $kind ) {
	if ( $kind === 'flipbook' ) { return 'Magazine view'; }
	if ( $kind === 'pdf' ) { return 'PDF'; }
	if ( $kind === 'image' ) { return 'Poster'; }
	if ( $kind === 'audio_transcript' ) { return 'Read-aloud transcript'; }
	return 'Web view';
}
```

**To:**
```php
function swt_acct2_kind_label( $kind ) {
	if ( $kind === 'flipbook' ) { return 'Ebook — Read as magazine'; }
	if ( $kind === 'read' ) { return 'Ebook — Read on screen'; }
	if ( $kind === 'pdf' ) { return 'PDF'; }
	if ( $kind === 'image' ) { return 'Poster'; }
	if ( $kind === 'audio_transcript' ) { return 'Read-aloud transcript'; }
	return 'Web view';
}
```

## Apply via execute-php when MCP is back

```php
global $wpdb;
$acc = get_stylesheet_directory().'/inc/account.php';
$c = file_get_contents($acc);
$old = "function swt_acct2_kind_label( \$kind ) {\n\tif ( \$kind === 'flipbook' ) { return 'Magazine view'; }\n\tif ( \$kind === 'pdf' ) { return 'PDF'; }\n\tif ( \$kind === 'image' ) { return 'Poster'; }\n\tif ( \$kind === 'audio_transcript' ) { return 'Read-aloud transcript'; }\n\treturn 'Web view';\n}";
$new = "function swt_acct2_kind_label( \$kind ) {\n\tif ( \$kind === 'flipbook' ) { return 'Ebook \u2014 Read as magazine'; }\n\tif ( \$kind === 'read' ) { return 'Ebook \u2014 Read on screen'; }\n\tif ( \$kind === 'pdf' ) { return 'PDF'; }\n\tif ( \$kind === 'image' ) { return 'Poster'; }\n\tif ( \$kind === 'audio_transcript' ) { return 'Read-aloud transcript'; }\n\treturn 'Web view';\n}";
if (strpos($c,$old)!==false) {
  $c2 = str_replace($old,$new,$c);
  $tmp='/tmp/acct-kind.php';
  file_put_contents($tmp,$c2);
  $lint = shell_exec('/usr/bin/php83 -l '.escapeshellarg($tmp).' 2>&1');
  echo $lint."\n";
  if (strpos($lint,'No syntax errors')!==false) { file_put_contents($acc,$c2); echo 'APPLIED'; opcache_reset(); }
} else { echo 'pattern not found'; }
```

## What's already done (F4-A, F4-B)

- ✅ `swt_delivery_printables_export()` in `ebook-formats.php` — generates 11 printable images (7 script cards + fridge + tracker + rescue + safety checklist) via ImageMagick from the rasterized pages
- ✅ All 11 printable URLs servable (HTTP 200)
- ✅ `swt_commerce_attach_one_ebook_downloads()` — product #86 now carries:
  - 1 ebook PDF (Complete System (Ebook PDF))
  - 11 printables (immediate download)
  - + post meta `_swt_ebook_flipbook_url` / `_swt_ebook_read_url` / `_swt_ebook_pdf_url` for the Account OS
- ✅ Replaced the old 12-file html/pdf/txt × 4 dump with the ONE-ebook + printables model
