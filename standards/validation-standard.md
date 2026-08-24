# VALIDATION STANDARD
*Factory standards file · derived from pipeline.md §7, Standard v1 §6 (validation rule) and §19 Gates 1–2, MEMORY.md scoping discipline, naming principle.*

## 1 · What validation IS and IS NOT

Validation is a **portfolio-quality gate**, never MVP test-and-kill.

> VALIDATED does NOT mean "we tested an MVP and it won."
> It means: this situation has sufficient evidence, transformation clarity, customer significance,
> mechanism credibility, journey relevance and product opportunity to justify adding it to our
> permanent library. (pipeline.md §7)

## 2 · The thirteen checks (pipeline.md §7 — all must PASS)

| # | Check |
|---|---|
| 1 | SITUATION SPECIFICITY |
| 2 | CUSTOMER CLARITY |
| 3 | TRIGGER CLARITY |
| 4 | FAILED ATTEMPT |
| 5 | CONSTRAINT |
| 6 | EMOTIONAL STAKE |
| 7 | TRANSFORMATION CLARITY |
| 8 | MECHANISM |
| 9 | EVIDENCE |
| 10 | TSM |
| 11 | PRODUCT-FORM FIT |
| 12 | JOURNEY FIT |
| 13 | ECOSYSTEM VALUE |
| — | SAFETY (Gate 5 pre-check; a safety FAIL overrides everything) |

## 3 · Verdicts

- `VALIDATION_STATUS = APPROVED` → enters the validated queue
- `VALIDATION_STATUS = REVISION_REQUIRED` → named fixes required, stays in queue
- `VALIDATION_STATUS = REJECTED` → only for findings failing safety or honesty rules.
  A weak commercial finding is NOT rejected — it receives a lesser library role (§22).

## 4 · Pre-conditions (Standard v1 §6)

A transformation requires ALL ten: specific situation · specific customer · clear trigger/life
moment · meaningful before-state · meaningful after-state · credible mechanism · implementable
path · observable evidence of change · appropriate safety boundary · clear relationship to the
customer journey. Any critical field missing = **candidate only, no product build** (Gate 2 FAIL).

## 5 · Scoping discipline (mandatory tests)

**The title-removal test:** remove the product title. Can we still name the exact woman, exact
situation, exact moment, problem, failed attempt, why it failed, fear, and want? If NO → not a
transformation yet (Gate 1 FAIL = no transformation build).

**The six-question pre-acceptance test** (MEMORY): specific person · timeframe · trigger · failed
attempt/constraint · emotional stake · desired outcome — all answerable without the title.

**Situation + catchy phrase ✅ / Topic + catchy phrase ❌.** A catchy name can enhance a strong
niche; it can never rescue a broad one.

## 6 · Selection is separate and non-destructive

After APPROVED, the Discovery Engine scores portfolio fit (journey adjacency · ATU reuse · format
potential · overlap) into BUILD_PRIORITY (P1…). **Selection never destroys the queue** — unselected
validated opportunities remain in the library permanently.

## 7 · Duplicate / overlap rule

Two products cannot own the same situation nucleus. Compare situation → trigger → customer →
desired transformation → mechanism → journey position, then classify: merge / module / marketing
angle / upsell / bundle / distinct product. Titles differing is irrelevant.
