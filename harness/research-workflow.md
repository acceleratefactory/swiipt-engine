# RESEARCH HARNESS — @lfe-researcher operating procedure
*Factory build item #5 · wraps `prompt.md` (6-stage framework), `followup.md` (run rules) and the Life Area Market-Breakdown Method into a runnable workflow whose PRIMARY OUTPUT is schema-valid opportunity records. The prose report is a by-product, never the source of truth.*

## Scope

One invocation = ONE focus market (followup rule 1). Every submarket under it, no caps (rule 2).
The agent works autonomously except at the two STOP points inherited from prompt.md.

## Stage map (prompt.md stages → harness actions)

| prompt.md stage | Harness action | Output |
|---|---|---|
| 0 Setup | Load life-area breakdown + seed submarkets; check existing records to avoid re-discovering owned situation nuclei | run plan |
| 1 Niche generation + Survival-Level Pain Test | Drill per Market-Breakdown Method (8-question test, D1–D7, Tuesday Test). For each candidate: score the FIVE verbatim criteria (urgency / embarrassment / failed attempts / identity threat / immediate spend), pass at 3-of-5, record observed signals for every YES flag | candidate list |
| 2 Reachability validation | search volume · ad-targeting viability · competitor presence (existing competitors = good; differentiation is mechanism + cultural coding + safety rigor) · local+diaspora appeal · low-ticket impulse threshold → STRONG / VIABLE / WEAK; keep STRONG+VIABLE ranked | shortlist |
| **STOP 1** | Present ranked shortlist; owner picks ONE niche to proceed with | owner decision |
| 3 Buyer avatar | Named avatar, pain in her own words, failed attempts, perfect outcome, purchase fears | folded into finding |
| 4 Product concept | Core promise, format-by-job (never PDF-by-default), transformation arc, quick win, tools, credibility mechanism | folded into finding |
| 5 Title generation | ≥2 ancestral/cultural + ≥2 scientific/clinical options per copy-standard §2 | title options |
| **STOP 2** | Owner picks/blends title | owner decision |
| 6 Launch summary | Final consolidated summary | summary |

## Record protocol (what makes this a factory, not a chat)

1. **Persist before proceeding** (followup rule 4): every finding that passes Stage 1 is written as
   `data/opportunities/{OPP-id}.json` BEFORE moving to the next submarket.
2. ID: `OPP-{LIB}-{THEME}-{NNN}` per `data/README.md`. Status starts `open`.
3. Validate with `node harness/validate-opportunity.mjs {file}` — must print PASS.
   Invalid records are fixed immediately, never committed broken.
4. Commit per submarket batch: `research({LIB}): {submarket} — N opportunities`.
5. Disposition (`library_role`, rationale) is assigned during the run using the 13 roles;
   status becomes `dispositioned`. Gate 0 satisfied — nothing unclassified proceeds.
6. Prose report generated LAST from the records, saved alongside as `{OPP-group}-report.md`.

## Evidence honesty (Addendum C — enforced)

- Internal ideation is tagged `[MODEL INFERENCE]` / `[HYPOTHESIS]` inside the finding fields.
- Never invent statistics, quotes, or search volume; source_references carry URLs/citations.
- Archetypal details used to build an avatar are `[HYPOTHESIS]` unless research-derived.

## Depth discipline (Market-Breakdown Method — non-negotiable)

- Person = life context visualizable as one real day (E2/E3 Tuesday Test).
- Failed attempt/constraint MANDATORY per micro-situation; mark unknown if no evidence — never invent.
- Emotional stake = meaning, not just feeling.
- Hierarchy integrity (D4): classify discoveries at their true level.
- Do not define problems by solutions (D5); drill past the first micro-situation when the failure
  chain reveals a materially different opportunity (D6); stop drilling when the 8 questions have
  defensible answers (D7/E9).
- Transformation stated as changed life-state BEFORE any mechanism (E4).
- End of each focus market: ranked Tier 1/2/3 deeper-research queue.

## Library-role reframe (followup rule 3)

Never ask "does this deserve its own niche?" Ask "what library role does this situation play?"
Minimum five outcomes considered (standalone / marketing angle / module / bonus / bundle),
formalized as the 13 roles in the schema enum. A failed survival-pain test informs the role —
it NEVER discards the finding.
