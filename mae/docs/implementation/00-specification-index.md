# MAE-00 · Specification Index

*Implementation aid (not a replacement for the source specification). Marketing Asset Engine V1 — built as a Node subsystem inside `Product Pipeline/mae/`, downstream of the Product Factory.*

Authority: Sections 2–10 govern behaviour; Section 11 governs build order; the Master Instruction and the Media Production package (00–07) are normative. Where Section 11 conflicts with 2–10, **2–10 win**.

| # | Canonical file | Primary responsibility | Major inputs | Major outputs | Upstream deps | Downstream consumers | Owns state | Deterministic rules | Judgment rules | Cross-refs |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 | section-1 | Purpose, system boundary, philosophy | Product Factory outputs | Architecture entry point | — | all | — | — | — | all |
| S2 | Section-2 Four Truths | Grounding layer; four sources | Factory Product Truth, research, brand | ProductTruthRef, CRF, MIF, BrandTruth | Factory | S3 | Truth records | evidence-state enums, conflict hierarchy, weighting validity | — | S3,S9 |
| S3 | Section-3 Angle Record (+3.10) | Atomic strategic unit; identity-reinforcement grounding | 4 truths | MarketingAngleRecord; AffirmationGroundingBlock | S2 | S4,S5 | Angle record | required fields, citations present, evidence-status carry-through | Insight synthesis labelling | S4,S6 |
| S4 | Section-4 Angle Validation | Hard strategic gate before fan-out | AngleRecord | AngleValidationRecord (GREEN/YELLOW/RED) | S3 | S5,S8 | Validation verdict/scope | verdict logic; C2/C4 = hard blockers; Red cannot fan out | C1/C3/C5 nuance | S5,S8 |
| S5 | Section-5 Asset Architecture | Truth weighting + platform-native rules → Asset Brief | Angle + Validation | AssetBrief(s); ContentGroundingBlock; VisualGroundingBlock | S4 | S6 | Brief | weighting profile lookup, platform constraints, scope enforcement | template mapping | S6 |
| S6 | Section-6 Generation | Constrained execution → draft assets | AssetBrief | GeneratedAssetRecord(s) | S5 | Media + S7 | Generation record | prompt order, negative instruction, locked text, candidate/regeneration counts | prose quality | S7 |
| Media | Media Production 00–07 | Render governance→real artifacts + export | GeneratedAsset/Brief | MediaArtifact(s); ExportPackage; AssetManifest | S6 | S7 | ProductionJob/Artifact | real-file rule, locked text, dimensions, provider states | visual judgment | S7,S8,S10 |
| S7 | Section-7 QA Pipeline | Seven gates → approved asset | Draft + MediaArtifact | QARecord; ApprovedAsset | S6+Media | S8 | QA record | G1/G3/G5/G6 deterministic checks | G2/G4 judgment; G7 human | S8,S9 |
| S8 | Section-8 Asset Family | What belongs together | Approved assets | AssetFamilyRecord | S7 | S9,S10 | Family record | one family per angle, scope inheritance, 13≠quota, entry criteria | redundancy/coverage | S9,S10 |
| S9 | Section-9 Traceability | System of record | all objects | lineage, versions, usage, dependencies | all | S10 | identity/history | ID uniqueness, no-approval-by-association, dependency mapping | — | S10 |
| S10 | Section-10 Campaign | Temporal orchestration | Eligible inventory | Sequence/Campaign/Calendar + QA | S8,S9 | publish | campaign/usage + records | hard exclusions, yellow/red scope, audience-state | rotation/fatigue/intensity | S9 |
| S11 | Section-11 Implementation | Build order, gates, completion | Sections 2–10 | Waves A–F, integration gates, acceptance | — | — | — | dependency order | — | all |

## Truths (S2)
- **Product Truth** — inherited (never shadowed); controls factual/claim/safety boundary.
- **Customer Truth** — structured Customer Reality File (CRF); evidence-grounded.
- **Market Truth** — Market Intelligence File (MIF); differentiation/context only.
- **Brand Truth** — global config; controls expression. **Writing register reuses the Writing Control layer** (`../config/writing-control.v1.json`, `../standards/writing-standard.md`) — one canonical owner per rule.
- Conflict hierarchy: **Product → Customer → Brand → Market**. Weighting = emphasis, never authority.

## Reuse map (do not fork)
- ajv + `../schemas/*` schema pattern; `../data/` record-store conventions.
- Writing Constitution / Anti-Slop phrases → Writing Control config+standard.
- Design tokens (`swt-tokens.css`, `swt-components.css`) for Typographic/Core render specs.
- Publish boundary → `../harness/build-manifest.mjs` + `swiipt-core/includes/publisher.php`.
- Product Truth → factory transformation/product records.

## Non-canonical (absent — nothing to quarantine)
Old 170-subsection Section 10, older 8/9/10/11 drafts, Section-3.10-research, Proposed-Document-Structure, 8/10-overlap-resolution — none present in the folder; the canonical finals are used.
