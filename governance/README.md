# SWIIPT Authority System

**HUMANS GOVERN THE SYSTEM. THE SYSTEM GOVERNS THE PRODUCTS.**

- **Level 1 — Constitutions** (`constitutions/`): permanent system-wide rules (Evidence, Safety, Journey, TSM, Publication). Humans author/approve them.
- **Level 2 — Domain Authority Packs** (`domain-packs/`): the machine-readable authority for a domain class (claim classes, source/evidence expectations, safety boundaries, escalation, dated-baseline/applicability rules). The **absence** of an adequate pack means the domain is not yet autonomously publishable → `NOT_AUTHORIZED`.
- **Level 3 — Product evaluation** (`harness/governance-authority.mjs`): each product is classified (risk class + domain from canonical data), the pack is resolved, and the automated Evidence (g4) / Safety (g5) / Journey (g9) authorities + the Publication Constitution (g10) return **AUTHORIZED** or **NOT_AUTHORIZED** with structured failure reasons. A model may act as a *policy executor*; it is never the authority.

`registry.json` is the index (authority ids/versions/status/domains + the data-driven risk/domain classifier signals).

Run a product through the authority system (the canonical entry is the gate runner):

```
node harness/product-qa-gate-runner.mjs <PRODUCT_ID> --write   # evaluates + persists the audit + the constitutional authorization
node harness/governance-authority.mjs evaluate <PRODUCT_ID>    # engine view (g4/g5/g9/tsm)
node harness/governance-authority.mjs status <PRODUCT_ID>      # the persisted authority evaluation
node harness/governance-authority.mjs reevaluate               # products whose governing authority changed
```

`NOT_AUTHORIZED` is a terminal **STOP**, never a per-product human review queue: the resolution is system-level (expand a constitution or a Domain Authority Pack), then affected products are reevaluated automatically.
