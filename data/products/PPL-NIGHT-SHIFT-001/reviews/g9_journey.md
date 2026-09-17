# g9 - Customer Journey Review

- Product: **Every Night, Just Me** (PPL-NIGHT-SHIFT-001)
- Transformation: TR-PPL-NIGHT-SHIFT-001
- Review job: `RJ-PPL-NIGHT-SHIFT-001-g9_journey` (revision 1)
- Required authority: **JOURNEY_AUTHORITY**
- Reviewer requirement: Authorised human journey reviewer / operator - Access to the live platform surfaces (owner or delegated operator)
- Independence: Never an AI simulation or a marketing review
- Status: PENDING | Items: 20
- Input hash: `a197bebb86149572bc012a7d3fcfa2ce8153aab195b3bb046c3d61ff79afc7be` (bind the review to this exact material)

## Items (20)

### J-01

**Question:** Can the intended person recognize this is for her?
- Artifacts: identity.name, identity.subtitle, identity.one_line_promise, customer.person
- Decision: [WORKS] [DEFECT] [UNVERIFIED]
- Notes: —

### J-02

**Question:** Is the promise clear?
- Artifacts: transformation.before_state.summary, transformation.after_state.summary, identity.one_line_promise
- Decision: [WORKS] [DEFECT] [UNVERIFIED]
- Notes: —

### J-03

**Question:** Does she know what to do first?
- Artifacts: transformation.first_win.action, asset_map.read, asset_map.do
- Decision: [WORKS] [DEFECT] [UNVERIFIED]
- Notes: —

### J-04

**Question:** Can the first win happen in the intended timeframe?
- Artifacts: transformation.first_win.within
- Decision: [WORKS] [DEFECT] [UNVERIFIED]
- Notes: —

### J-05

**Question:** Does each step lead naturally to the next?
- Artifacts: transformation.path
- Decision: [WORKS] [DEFECT] [UNVERIFIED]
- Notes: —

### J-06

**Question:** Are instructions executable under the real conditions of the situation?
- Artifacts: asset_map.do, asset_map.read
- Decision: [WORKS] [DEFECT] [UNVERIFIED]
- Notes: —

### J-07

**Question:** Are the decision tools understandable?
- Artifacts: asset_map.decide
- Decision: [WORKS] [DEFECT] [UNVERIFIED]
- Notes: —

### J-08

**Question:** Are the scripts/customer words usable?
- Artifacts: asset_map.communicate
- Decision: [WORKS] [DEFECT] [UNVERIFIED]
- Notes: —

### J-09

**Question:** Does the mechanism remain coherent throughout?
- Artifacts: transformation.mechanism.core
- Decision: [WORKS] [DEFECT] [UNVERIFIED]
- Notes: —

### J-10

**Question:** Are failure points anticipated?
- Artifacts: transformation.failure_map, failure_point_map
- Decision: [WORKS] [DEFECT] [UNVERIFIED]
- Notes: —

### J-11

**Question:** Can the customer recover after missing a day/night?
- Artifacts: asset_map.reentry, transformation.reentry
- Decision: [WORKS] [DEFECT] [UNVERIFIED]
- Notes: —

### J-12

**Question:** Is there an obvious re-entry path?
- Artifacts: asset_map.reentry
- Decision: [WORKS] [DEFECT] [UNVERIFIED]
- Notes: —

### J-13

**Question:** Are unsafe situations routed away from self-management?
- Artifacts: safety.red_flags, safety.escalation_rules, asset_map.rescue
- Decision: [WORKS] [DEFECT] [UNVERIFIED]
- Notes: —

### J-14

**Question:** Can the customer recognize progress?
- Artifacts: tsm, asset_map.track
- Decision: [WORKS] [DEFECT] [UNVERIFIED]
- Notes: —

### J-15

**Question:** Can the customer recognize completion/success?
- Artifacts: tsm.success_criteria, tsm.measurement_days
- Decision: [WORKS] [DEFECT] [UNVERIFIED]
- Notes: —

### J-16

**Question:** Does maintenance exist?
- Artifacts: maintenance, transformation.maintenance
- Decision: [WORKS] [DEFECT] [UNVERIFIED]
- Notes: —

### J-17

**Question:** Is the next Transformation clear without manipulative upselling?
- Artifacts: transformation.next_transformation_ids
- Decision: [WORKS] [DEFECT] [UNVERIFIED]
- Notes: —

### J-18

**Question:** Are any parts redundant or conflicting?
- Artifacts: asset_map
- Decision: [WORKS] [DEFECT] [UNVERIFIED]
- Notes: —

### J-19

**Question:** Is anything materially missing?
- Artifacts: asset_map, transformation.path
- Decision: [WORKS] [DEFECT] [UNVERIFIED]
- Notes: —

### J-20

**Question:** Would the complete journey plausibly deliver the specified transformation?
- Artifacts: content, publishing.wordpress_ids
- Decision: [WORKS] [DEFECT] [UNVERIFIED]
- Notes: —

---

This Markdown is an EXPORT for offline/external review. The canonical state is the structured
review job and the human decision written back to `product.human_review.reviews.g9_journey`.