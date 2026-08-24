# DESIGN STANDARD
*Factory standards file · derived from Standard v1 §10–§12; brand tokens already live on the platform in `swt-tokens.css` (canonical layer).*

## 1 · Philosophy

**One brand system + controlled product experience modes.** The product experience must match the
transformation. Visual polish is subordinate to customer usability when the subject demands
privacy, warmth, or clinical seriousness. Precedent: PP-01/PP-02 use editorial flipbooks;
PP-03 deliberately uses functional-first delivery — a beautiful magazine about bladder leaks is
the wrong tone.

## 2 · Experience modes (product spec chooses exactly one primary)

| Mode | Character |
|---|---|
| EDITORIAL | magazine/flipbook · narrative · visual · emotional · discovery-oriented |
| FUNCTIONAL | task-first · high scanability · minimal decoration · decision/action oriented |
| INTERACTIVE | tool · calculator · quiz · planner · tracker · decision engine |
| SENSITIVE | private · warm · restrained · non-performative · safety-forward |
| UTILITY | printable · quick reference · scripts · cards · checklists |

## 3 · Enforceable layers

1. **Brand tokens** — colors, semantic colors, typography, spacing, radii, shadows, borders,
   iconography, imagery rules, motion rules. Source of truth: the live `swt-tokens.css`
   canonical layer (self-hosted fonts: Inter + DM Serif Display). Never invent a palette here.
2. **Product tokens** — may vary: accent color, imagery, editorial tone, illustration treatment,
   density. May NOT vary: core typography hierarchy, accessibility requirements, spacing logic,
   interaction conventions, buttons, forms, alerts, navigation behavior, status semantics.
3. **Component library** — canonical components reused everywhere: header, progress indicator,
   cards, buttons, inputs, checkboxes, trackers, quiz questions, decision nodes, callouts,
   safety alerts, scripts, rescue cards, completion check, next-transformation card.
   No product-specific UI reinvented when a system component exists.
4. **Experience rules** — every screen has one primary job, one primary action, obvious
   progress/context, readable hierarchy, mobile-first layout, accessible interaction,
   appropriate emotional tone.

## 4 · Non-negotiables

1. No arbitrary colors. 2. No arbitrary fonts. 3. No decorative interaction that slows the task.
4. No dense wall-of-text when structured interaction is better. 5. No playful visual treatment on
medical/sensitive products that trivializes the situation. 6. No interactive element without
keyboard/accessibility consideration. 7. No critical information communicated only by color.
8. No mobile experience requiring desktop assumptions. 9. No reinvented UI when a component exists.
10. No visual design contradicting the customer's emotional situation.
