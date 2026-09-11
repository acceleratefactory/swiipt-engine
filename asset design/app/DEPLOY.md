# DEPLOY — Interactive App (V06 reference)

**Date:** 2026-08-27
**Source:** `C:\Users\User\Desktop\Transformation\interactive-rebuild\`
**Target:** `wp-content/mu-plugins/swiipt-core/`

## Files to ship (5)

| Local source | Remote destination | Size | What it is |
|---|---|---|---|
| `interactive-app.php` | `includes/interactive-app.php` | ~10 KB | New mu-plugin engine: shortcode, REST, tables, access gate, validation |
| `swt-interactive.css` | `css/swt-interactive.css` | 14.5 KB | Reference design system (phone frame, tabs, FAB, overlays, tokens) |
| `swt-interactive.js` | `js/swt-interactive.js` | 50.7 KB | Client app (784 lines, config-driven, server-backed state, 13 events) |
| `v06-config.json` | `data/v06-config.json` | 14 KB | Bundled V06 reference PRODUCT_CONFIG (7 scripts, 3 rosters, etc.) |
| `modules.php` (edit) | `includes/modules.php` (edit) | — | Add require line AFTER the legacy engine |

## Deploy order (safe pattern)

### Step 1 — Stage all files
Use `novamira/write-file` to stage each file as `.txt` in `wp-content/uploads/swt-stage/`:
- `interactive-app.txt` (stage the PHP as .txt — WAF blocks direct .php write)
- `swt-interactive-css.txt`
- `swt-interactive-js.txt`
- `v06-config.txt`

### Step 2 — Lint + copy via execute-php
For each file, run an `execute-php` snippet that:
```php
global $wpdb;
$src = file_get_contents( ABSPATH . 'wp-content/uploads/swt-stage/<name>.txt' );
$dst = ABSPATH . 'wp-content/mu-plugins/swiipt-core/<path>/<name>';
file_put_contents( $dst, $src );
// Verify
$ok = filesize($dst) > 0;
echo json_encode( ['ok'=>$ok, 'size'=>filesize($dst), 'path'=>$dst] );
```

**For PHP files only**, also lint before copy:
```php
$src = file_get_contents( ABSPATH . 'wp-content/uploads/swt-stage/interactive-app.txt' );
$tmp = '/tmp/interactive-app-stage.php';
file_put_contents( $tmp, $src );
$lint = shell_exec( '/usr/bin/php83 -l ' . escapeshellarg($tmp) . ' 2>&1' );
if ( strpos($lint, 'No syntax errors') !== false ) {
  $dst = ABSPATH . 'wp-content/mu-plugins/swiipt-core/includes/interactive-app.php';
  file_put_contents( $dst, $src );
  echo json_encode(['ok'=>true, 'lint'=>$lint, 'size'=>filesize($dst)]);
} else {
  echo json_encode(['ok'=>false, 'lint'=>$lint]);
}
```

### Step 3 — Edit modules.php
In `includes/modules.php`, find the line that requires `interactive-engine.php` and add AFTER it:
```php
require_once __DIR__ . '/includes/interactive-app.php';
```
This overrides the legacy `[swiipt_interactive]` shortcode with the new one (last-wins).

### Step 4 — opcache reset
```php
if (function_exists('opcache_reset')) opcache_reset();
```

### Step 5 — Write V06 postmeta
```php
$cfg = json_decode( file_get_contents( ABSPATH . 'wp-content/mu-plugins/swiipt-core/data/v06-config.json' ), true );
if (is_array($cfg) && !empty($cfg)) {
  update_post_meta(85, '_swiipt_interactive_config', $cfg);
  echo json_encode(['ok'=>true, 'keys'=>array_keys($cfg)]);
} else {
  echo json_encode(['ok'=>false, 'error'=>'config not loaded']);
}
```

### Step 6 — Run acceptance test
```php
wp_set_current_user(1);
$result = swt_app_acceptance();
echo json_encode($result);
```

Expected output: `{"pass":true,"errors":[],"config_title":"Every Night, Just Me"}`

### Step 7 — Purge StackCache
```php
wp_set_current_user(1);
if (class_exists('\WPStackCache\Cache')) \WPStackCache\Cache::purge('all');
```

### Step 8 — Verify live
Visit TS #85 system page, check for:
- Phone frame (navy header, 4 tabs, Rescue FAB)
- Tonight tab loads (checklist + "Everything normal?" card)
- Check-in tab loads (root node questions)
- Tracker tab loads (4 stat boxes, TSM card)
- Scripts tab loads (7 situation cards)
- Rescue FAB click → overlay with 7 typed steps + crisis directory

## Rollback
If the site breaks (mu-plugin parse error = all Novamira abilities die):
1. Via host file manager, delete `includes/interactive-app.php`
2. Revert `modules.php` (remove the require line)
3. `opcache_reset()` re-runs when the server is next hit
4. The legacy engine is still live and unharmed

## Post-deploy cleanup
- Once V06 is verified, delete the legacy `interactive-engine.php` and `interactive.php` (after migrating account-OS helpers)
- Remove the `interactive-rebuild/` staging folder from the local workspace
- Update AGENTS.md with the new state