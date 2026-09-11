# F6 Remaining Steps — Apply when MCP is back

## F6-C: Clean delivery.php legacy refs

Replace the 3 instances of `swt_interactive_render_instance` (dead function, never exists) with just the app engine check.

**File:** `wp-content/mu-plugins/swiipt-core/includes/delivery.php`

Replace lines that contain:
```
if ( function_exists( 'swt_interactive_render_instance' ) || ( function_exists( 'swt_app_get_config' ) && swt_app_get_config( $id ) ) ) { swt_interactive_render_instance( $inst ); }
```
→ 
```
if ( function_exists( 'swt_app_get_config' ) && swt_app_get_config( $id ) ) { }
```

Replace line:
```
if ( ( function_exists('swt_ix_get_config') && swt_ix_get_config($id) ) || ( function_exists('swt_app_get_config') && swt_app_get_config($id) ) ) { echo do_shortcode('[swiipt_interactive ts="' . $id . '"]'); }
```
→
```
if ( function_exists('swt_app_get_config') && swt_app_get_config($id) ) { echo do_shortcode('[swiipt_interactive ts="' . $id . '"]'); }
```

## F6-D: Remove legacy interactive-engine.php from modules.php

**File:** `wp-content/mu-plugins/swiipt-core/modules.php`

Remove the line:
```
require_once SWT_CORE_DIR . '/includes/interactive-engine.php';
```

## F6-E: Verify

After applying:
1. Visit `[swiipt_interactive ts="85"]` → should render the app (tested, confirmed working)
2. Check `_swiipt_interactive_config` meta on TS 85 → should have the auto-generated config
3. `swt_app_ensure_config(85)` → should return true
4. No legacy `swt_interactive_render_instance` or `swt_ix_get_config` calls in codebase
5. The F5 system page → "Interactive included" chip should now show (since config exists)