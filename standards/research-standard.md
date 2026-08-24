# RESEARCH STANDARD
*Factory standards file · derived from `prompt.md`, `followup.md`, `Life areas/Life Area Market-Breakdown Method.md` (incl. Addenda A–E), Standard v1 §0–§3, Gate 0.*

## 1 · Purpose

The research agent converts life areas into structured **opportunity records**
(`opportunity.schema.json`). Prose reports are a by-product, never the source of truth.
The agent does not decide that a finding is worthless — there is no DISCARD (Standard v1 §3).

## 2 · The situation hierarchy (mandatory drill)

**Broad Life Area → Submarket → Specific Life Situation → Specific Person → Trigger → Failed Attempt / Constraint → Emotional Stake → Desired Transformation**

A topic is too broad until it names a real moment:
- ❌ Bad: "Postpartum"
- ✅ Good: "Woman six weeks after C-section who wants to regain strength but is afraid of damaging her core and does not know what progression is safe"

## 3 · Discovery discipline (Market-Breakdown Method + Addenda)

- **Seed-submarket rule:** supplied submarkets are a starting point, never the ceiling.
  Enumerate the FULL landscape of hidden submarkets before drilling the strongest (Addendum A).
- **Market positioning:** global platform built from Africa for a global audience. Research basis =
  global/Western lived experience; African/Nigerian angles are preserved strategic differentiators,
  not enrichment (Addendum A).
- **D1 Person = life context, not demographics.** Strong enough to visualize one real person's day.
- **D2 Failed attempt/constraint is MANDATORY** in every micro-situation. If evidence is missing,
  mark unknown — never invent one to fill the framework.
- **D3 Emotional stake reveals MEANING**, not just feeling ("money guilt" is weak; why it matters
  to *this* person is strong).
- **D4 Hierarchy integrity:** classify every discovery at its correct level (submarket / situation /
  trigger / coping behavior / cross-link / product opportunity). Never auto-promote.
- **D5 Do not define the problem by the solution.** Seed labels are solution-shaped; find the life problem underneath.
- **D6 Drill past the first micro-situation** when the failure chain reveals a materially different opportunity.
- **D7 The 8-question test** on every candidate; if any answer is generic, keep drilling. Do not over-drill (E9).
- **E1 Archetypal details are not evidence** — tag `[HYPOTHESIS]`.
- **E3 The Tuesday Test:** can you describe this person's specific Tuesday without the words "busy",
  "stressful", "overwhelmed"? If no, drill deeper.
- **E4 Transformation describes the changed life-state BEFORE the mechanism.** Mechanism named after.
- **E5 Tier rankings name human opportunities**, not prematurely chosen products.
- **E8 No marketing prose.** observable situation → causal mechanism → emotional meaning → transformation.
- **Evidence honesty (Addendum C):** internal ideation is labeled `[MODEL INFERENCE]` or `[HYPOTHESIS]`.
  Never invent statistics, quotes, or search volume.

## 4 · Survival-Level Pain Test (Stage 1 — verbatim criteria)

A niche passes ONLY at **3 of 5 YES**:

| Criterion | Question |
|---|---|
| URGENCY | Must this be solved now, not later? |
| EMBARRASSMENT | Is this too shameful to discuss openly? |
| FAILED ATTEMPTS | Have people already tried other fixes that didn't work? |
| IDENTITY THREAT | Does it threaten who they are (as a man, mother, provider, professional)? |
| IMMEDIATE SPEND | Would the entry price feel like a no-brainer for this pain? |

Every YES flag must carry observed signals — evidence, not vibes (enforced by schema).

## 5 · Reachability validation (Stage 2)

For each passing niche: search volume · ad-targeting viability · competitor presence
(competitors existing is GOOD — differentiation is mechanism + cultural coding + safety rigor,
never "no competition") · local + diaspora appeal · low-ticket impulse threshold.
Verdicts STRONG / VIABLE / WEAK; keep STRONG and VIABLE only, ranked.

## 6 · Run rules (followup.md)

1. One focus market at a time; EVERY submarket under it.
2. **NO caps on niches** — enumerate everything found.
3. Reframe: do not ask "does this deserve its own niche?" (MVP thinking). Ask
   **"what library role does this situation play?"** — minimum five outcomes
   (standalone / marketing angle / module / bonus / bundle component), formalized as the
   13 roles of Standard v1 §3.
4. Persist every finding as an opportunity record **before** moving to the next focus market.

## 7 · Output contract

Per finding: `opportunity.json` valid against `schemas/opportunity.schema.json`
(finding + survival-pain test with signals + disposition). Human-readable report optional,
generated after, from the record.

## 8 · Hidden-market selection lens

Prioritize the intersection of: **specific person + specific life situation + urgent pain +
clear desired outcome + existing spending/solutions + easy-to-understand promise.**
Not automatically the biggest market. Output a ranked Tier 1/2/3 deeper-research queue
(specificity, recurrence, friction, stakes, clarity of before→after).
