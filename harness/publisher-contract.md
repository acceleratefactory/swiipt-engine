# PUBLISHER BRIDGE CONTRACT
*Factory build item #6 · live implementation: `wp-content/mu-plugins/swiipt-core/includes/publisher.php` on swiipt.com.*

## What it is

High-level publishing operations over existing swiipt-core capabilities. Factory agents never do
low-level WordPress surgery; they submit manifests. The bridge validates, refuses incomplete work,
never repairs, and audits every mutation (`swt_audit` events `publisher_*`).

## Endpoints (REST, namespace `/swiipt/v1`, admin `manage_options` only)

| Route | Method | Purpose |
|---|---|---|
| `/publisher/validate` | POST | Dry-run: validates manifest, returns plan + errors |
| `/publisher/publish?dry=0\|1` | POST | Execute publish (`dry=1` default — refuses real runs unless explicit) |
| `/publisher/status/{product_id}` | GET | Resolves manifest PID → platform entity ids + statuses |

Direct function calls (`swt_pb_publish($m,$dry)`) also work in bootstrap contexts.

## Manifest shape (platform layer)

Standard v1 §20 fields are validated server-side (version, target, five QA PASS verdicts,
READY_TO_PUBLISH + named human authorizer). Creation inputs ride `platform`-style keys:

```jsonc
{
  "manifest_version": "1.0",
  "product_id": "PPL-BODY-OWAMBE-001",        // becomes _swiipt_manifest_pid (idempotency key)
  "publish_target": "wordpress",
  "transformation": {
    "title": "...", "area": "m01",              // life_area slug m01-m24, required
    "content": "", "summary": "",
    "evidence_label": "community-reported",     // must exist in swiipt_evidence_label
    "tsm": {                                    // optional; upserts swiipt_tsm_definitions
      "before_baseline": [], "success_indicators": [],
      "measurement_method": "", "measurement_days": [0,7,14,30], "success_threshold": ""
    }
  },
  "product": {
    "title": "...", "description": "", "short_description": "",
    "base_price_usd": 29,                       // numeric price ALWAYS USD base (lesson #17)
    "prices": { "NGN": 45000, "EUR": 27, "GHS": 450 }   // manual per-currency display prices
  },
  "assets": [                                   // job enum → platform format auto-mapped
    { "job": "READ", "title": "...", "content": "" },
    { "job": "DO|DECIDE|TRACK|CALCULATE|COMMUNICATE|RESCUE|RE_ENTER|MAINTAIN|REMEMBER", ... }
  ],
  "relationships": { "situation_ids": [123], "weight": "1.000", "next_transformation_ids": [] },
  "seo": {                                        // optional → Rank Math postmeta on the product
    "title": "...",                               // _rank_math_title (≤100 chars)
    "description": "...",                         // _rank_math_description (≤320 chars)
    "focus_keyword": "..."                        // _rank_math_focus_keyword
  },
  "qa": { "deterministic": "PASS", "ai": "PASS", "safety": "PASS", "commerce": "PASS", "journey": "PASS" },
  "publish_authorization": { "status": "READY_TO_PUBLISH", "authorized_by": "Owner Name" }
}
```

## Guarantees

- **Idempotent:** re-publishing a PID returns the SAME entity ids (`created:false`); safe retries.
- **Refuses:** any non-PASS gate, missing authorizer, unmappable asset format, bad area slug,
  non-numeric price. Never partial-repairs a rejected manifest.
- **Correct mechanics baked in:** Woo products via `wp_insert_post`+meta (never `WC_Product->save()`,
  lesson #10) · product↔TS link table + TS `swt_product_id` meta BOTH written (lessons #16/#20) ·
  downloads attached from generated instances · instances generated synchronously (lesson #18) ·
  situation links deduped into `swiipt_situation_transformations` · **SEO: `seo` block written to
  Rank Math postmeta (`_rank_math_title/_description/_focus_keyword`) on every published product**
  (Rank Math active v1.0.276; its Product schema must stay OFF for Woo — swiipt-core owns JSON-LD).
- Full run measured at ~600 ms including instance generation for 2 assets.
