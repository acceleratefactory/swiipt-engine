# DATA RECORD STORE — CONVENTIONS (LOCKED)

*Factory build item #4 · layout per pipeline.md §23; single-source-of-truth rule per §23/§24 ("do NOT make the LLM the database"; Git is the ledger).*

This folder is the **canonical source of truth** for every research finding, situation,
transformation and product. Chat windows, md reports and WordPress are NOT sources of truth —
WordPress is the publishing destination only.

## Layout

```
data/
  libraries/{mXX}.json              one record per active life-area library (m01–m24)
  situations/{SIT-id}.json          shared situation entities
  opportunities/{OPP-id}.json       research findings (research agent output)
  transformations/{TR-id}.json      canonical transformation records
  journeys/{JRN-id}.json            journey edges / sequences
  products/{PRD-ID}/                ONE DIRECTORY PER PRODUCT (build workspace + records)
      product.json                  canonical product record
      assets/*.json                 asset records (source_path points into this dir)
      content/                      copywriter artifacts (landing-page.json, faq.json, ...)
      build/                        builder output (deliverables, downloads)
      qa/                           QA reports
      publish/product.manifest.json immutable publish manifest (only at READY_TO_PUBLISH)
```

Products are directory-per-product because they bundle generated artifacts. All other entities
are single JSON files cross-linked by id. A fact lives in exactly ONE record; other records
reference it by id — never copy fields across records.

## ID conventions (locked)

Format: uppercase, hyphen-separated, sequence zero-padded to 3.

| Entity | Pattern | Example |
|---|---|---|
| Master product ID (= directory name) | `{LIB}-{THEME}-{NAME}-{NNN}` | `PPL-BODY-OWAMBE-001` |
| Opportunity | `OPP-{LIB}-{THEME}-{NNN}` | `OPP-PPL-BODYCONF-001` |
| Opportunity (from library-report niches) | `OPP-{LIB}-{REPORT3}-{NICHECODE}` | `OPP-PPL-SLP-A1`, `OPP-PPL-GFB-G12` |
| Transformation | `TR-{LIB}-{THEME}-{NAME}-{NNN}` | `TR-PPL-NIGHT-SHIFT-001` |
| Situation | `SIT-{LIB}-{NNN}` (+ human slug field) | `SIT-PPL-014` |
| Asset | `AS-{NAME}-{JOB}-{NNN}` | `AS-OWAMBE-DO-001` |
| Journey | `JRN-{LIB}-{NNN}` | `JRN-PPL-001` |
| Library | platform area slug `m01`–`m24` | `m01` |

- `{LIB}` = library code table (below). `{THEME}`/`{NAME}` = short upper-snake words from the
  situation (A–Z only).
- One product lineage keeps ONE master ID across its opportunity → transformation → product
  records where they represent the same unit; typed prefixes (`OPP-`, `TR-`) are used when
  records stand alone.
- **IDs are immutable once a manifest is published.** Renaming creates a redirect entry in the
  record (`reclassification_history` / notes), never a silent change.

## Library code table

| Code | Area | Slug |
|---|---|---|
| PPL | Postpartum & New Parent Life | m01 |

New codes are added when an area's first product enters the factory — unique, 2–4 chars,
derived from the area name (e.g. FIN for m09 Financial Distress). Owner confirms each new code.

## Ledger rules

1. Every change to this folder is a git commit with a meaningful message — auditability,
   rollback, version history (pipeline.md §24). Product versions ride git tags:
   `v0.1 research · v0.2 validation · v0.3 transformation · v0.4 spec · v1.0 published`.
2. JSON must validate against `../schemas/*.schema.json` before commit.
3. Agents read/write ONLY their scoped slices (see ../agents/*.md tool scopes).
4. Nothing here is deleted; superseded content is superseded, not erased.
