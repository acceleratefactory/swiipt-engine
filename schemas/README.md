# Factory Schemas

Build item #1 of the Product Factory (`FACTORY-UNDERSTANDING-REPORT.md` §4).
Derived **strictly** from `Swiipt_Transformation_Product_Factory_Standard_v1.md`.
JSON Schema draft 2020-12. Validate any record with a 2020-12-compatible validator, e.g.:

```
npx ajv-cli@5 validate -s schemas/product.schema.json -r "schemas/*.schema.json" -d "data/products/**/*.product.json"
```

## Files → source sections

| File | Derived from |
|---|---|
| `transformation.schema.json` | §4.2 situation hierarchy · §5 canonical record · §6 validation rule · Gate 1/2/4 · §26 TSM (all 7 elements) · §3 library roles |
| `product.schema.json` | §7.3 canonical record · §8 content contract (11 sections) · §10.2 experience modes · §11 Layer-3 components · Gates 3–10 keys in `qa.gate_results` · §15 tests A–R as enum · §17 severity model |
| `asset.schema.json` | §9 asset-engine job table (10 jobs incl. CALCULATE & REMEMBER) + its format column · §10.2 modes |
| `opportunity.schema.json` | §2A research-finding definition · §3 no-research-wasted (13 roles) · Gate 0 · `prompt.md` survival-pain test (3-of-5) |
| `publish-manifest.schema.json` | §20 verbatim shape · all five QA verdicts `const "PASS"` · `publish_authorization.status` const `READY_TO_PUBLISH` + human-authorizer fields per §21 |

## Design decisions (deliberate)

1. **Structure here, depth in the validator agent.** Schemas enforce presence/enums/non-empty
   where a *gate* demands it (Gate 1 situation fields, TSM's seven elements). Array contents in
   before/after states are presence-checked but not depth-checked — that judgment belongs to AI
   tests A–R and `/standards/`, not regex.
2. **TSM extended beyond §5.** §5's tsm block omits two of §26's seven mandatory elements;
   both are included as required fields (`incomplete_progress_interpretation`,
   `next_action_on_miss`). §26 wins.
3. **Asset jobs: 10 vs 8.** `product.asset_map` keeps §7.3's 8 keys; `asset.job` uses the full
   §9 vocabulary (adds CALCULATE, REMEMBER).
4. **Claim-status model** (`sourced_evidence / expert_reviewed / lived_experience /
   model_inference / hypothesis`) comes from Gate 4 and is reused in transformation.evidence,
   mechanism.evidence_basis, and product evidence labels. `source` is conditionally required for
   sourced/reviewed claims.
5. **No ID conventions invented.** All ids are plain non-empty strings; naming patterns get fixed
   with build item #4 (record store) to avoid guessing now.
6. **Manifest is maximally strict on purpose:** five `const "PASS"` verdicts, const manifest
   version/target, named human authorizer — the publisher refuses anything else (§20/§21).

## Open items for owner (non-blocking)

- ID naming conventions (`tr-*`, `pr-*`, `as-*`, `op-*`?) — decide at item #4.
- Whether `seo.schema_types` should ever allow `AggregateRating` (currently excluded — fabricated
  ratings are banned; real TSM aggregates might earn it later).
