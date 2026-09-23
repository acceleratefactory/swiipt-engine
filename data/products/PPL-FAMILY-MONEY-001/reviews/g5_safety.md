# g5 - Clinical / Safety Review

- Product: **The One-Number Baby Budget** (PPL-FAMILY-MONEY-001)
- Transformation: TR-PPL-FAMILY-MONEY-001
- Review job: `RJ-PPL-FAMILY-MONEY-001-g5_safety` (revision 1)
- Required authority: **CLINICAL_AUTHORITY** (clinical)
- Reviewer requirement: Qualified clinical / safety reviewer - Perinatal / paediatric / mental-health clinical qualification as appropriate to the item's risk domain
- Independence: Never the builder/author of the product or transformation
- Status: PENDING | Items: 3
- Input hash: `67c64e95f46a5c331a05de9e70fc3dbe19cd65300ae65130ba3f6d3e963604f4` (bind the review to this exact material)

## Items (3)

### S-01

**Content:** Educational content — not medical, clinical, or mental-health advice. Money guidance is general education, not regulated personal financial advice; it never guarantees savings, affordability, debt outcomes, income growth, or investment returns.
- Where used: product.safety.disclaimer
- Risk domain: scope/disclaimer
- Review question: Is this scope/disclaimer item correct, complete and safe as written?
- Required expertise: clinical + product safety
- Decision: [ACCEPTABLE] [REVISION_REQUIRED] [SOURCE_REQUIRED] [CLINICAL_ESCALATION_REQUIRED]
- Notes: —

### S-02

**Content:** Route per the verified shared crisis/escalation list (RED = emergency now, AMBER = urgent today, GREEN = supported this week) - safety-standard 3; no numbers are invented here
- Where used: product.safety.escalation_rules + transformation.safety.escalation_rules
- Risk domain: escalation
- Review question: Is this escalation item correct, complete and safe as written?
- Required expertise: clinical (perinatal / paediatrics / mental health as applicable)
- Decision: [ACCEPTABLE] [REVISION_REQUIRED] [SOURCE_REQUIRED] [CLINICAL_ESCALATION_REQUIRED]
- Notes: —

### S-03

**Content:** This transformation coordinates MONEY A. First-year household money - one number and a baby fund only. It does not diagnose, treat, or replace professional care, and it does not cover adjacent situations outside its recorded nucleus.
- Where used: TR-PPL-FAMILY-MONEY-001.safety.scope_boundary
- Risk domain: scope boundary
- Review question: Is this scope boundary item correct, complete and safe as written?
- Required expertise: clinical (perinatal / paediatrics / mental health as applicable)
- Decision: [ACCEPTABLE] [REVISION_REQUIRED] [SOURCE_REQUIRED] [CLINICAL_ESCALATION_REQUIRED]
- Notes: —

---

This Markdown is an EXPORT for offline/external review. The canonical state is the structured
review job and the human decision written back to `product.human_review.reviews.g5_safety`.