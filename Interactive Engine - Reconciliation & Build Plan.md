# Swiipt Transformation Interactive Engine — Reconciliation & Build Plan

> Companion to `interactive app guideline.md` and `Swiipt_Transformation_Interactive_Engine_Build_Spec_v1.md`.
> Purpose: decide how the previous interactive prototype is reconciled with the v1 Build Spec, and lay out
> the pre-coding implementation plan the spec requires (§40.1–§40.7).

---

## 1. Verdict

The previous "interactive" build is a **throwaway prototype** that does not meet the v1 Build Spec on
any substantive axis. It must be **superseded, not extended**.

We do **not** delete "everything." We keep the reusable Swiipt platform infrastructure and replace only
the interactive prototype's mechanism with a proper, schema-driven Interactive Engine.

---

## 2. What the spec actually demands (confirmed understanding)

The Interactive layer is the 6th delivery format (Magazine / Read / PDF / Image / Read-Aloud / Interactive).
Its job is **DO / DECIDE / TRACK / RESCUE / COMMUNICATE** — work inherently better performed by software.

Architectural essentials from the spec:

- **§13 / §14 / §15 — Schema-driven + Component Registry.** Each product declares the components it needs
  (TodayPlan, Checklist, DecisionTree, Tracker, DailyLog, Timeline, PhotoLog, Milestone, Progress,
  RescueFlow, ScriptCard, QuickCard, Reflection, TSMMeasurement, ResourceLink, ShareAction, ExportAction).
  A second product must compose a different set **without changing core engine code** (§32, §40.13).
- **§4 — Real Decision engine:** branching, conditional paths, severity, outcome states, action instructions,
  content references, emergency/urgent notices, **event logging, restart, back, answer review**. Every
  terminal node has a defined outcome.
- **§5 / §7 — Tracker & Daily Plan engines:** date/time, checkboxes, numeric, selections, notes, photos,
  events, milestones, incidents, completion; timestamped entries; edit-with-history/audit; relative days,
  missed days, catch-up, rescue/restart. A missed day is **not** automatic failure.
- **§8 — Rescue engine:** a persistent entry ("I'm stuck" / "Something went wrong") → a flow (immediate
  action → what NOT to do → reset → next → escalation → relevant script → restart point).
- **§9 — Script Card engine:** situation → recommended script + shorter version → Copy / Share / Read Aloud.
- **§10 / §24 — Progress & TSM engines:** measure adherence, milestone completion, decision competence,
  rescue completion, behavior change, confidence, TSM — not vanity metrics.
- **§11 / §20 — State model:** structured customer state, **not one unstructured JSON blob**. Keep separate:
  product definition, user state, event history, content version, TSM measurements, journey state.
- **§22 / §27 / §29 — Safety & separation:** engine never generates medical recommendations; clinical rules
  come from approved, versioned, reviewed product config; validation gates block unsafe/incomplete products.
- **§33 / §35 — Platform & design:** one coherent product on existing Swiipt design tokens.
- **§37 — Build Order:** Foundation → Core → Transformation → Communication → Advanced → Factory.
- **§40 — Final instruction:** inspect existing architecture, map a plan to it, identify schema/API changes
  **before** coding; build Cord Care as reference; prove a 2nd product reuses the engine.

---

## 3. Conflict analysis — previous build vs spec

| Spec | Previous build | Verdict |
|---|---|---|
| §11 / §20 state model | Single `swt_interactive_state.state_json` blob | **Violates** — must be structured |
| §13 / §14 / §15 config + registry | No product config, no component registry; re-renders markdown assets | **Missing** |
| §4 decision engine | Static `[[DECISION]]` card, click-toggle only; no branching/logging/restart/back | **Missing** |
| §5 / §7 tracker & daily plan | Persisted `<input>` values in the blob; no timestamps, history, photos, days | **Missing** |
| §8 rescue | Single "I used this" button | **Missing** (not a flow) |
| §9 script cards | Scripts rendered + Copy/Mark; not situation-driven config | **Partial / wrong model** |
| §10 / §24 progress & TSM | Checkbox % only | **Wrong metric** |
| §23 analytics | None | **Missing** |
| §29 validation | None | **Missing** |
| §33 / §35 platform & design | Separate `?ia=` page + own `swt-interactive.css` | **Wrong integration** |
| §27 content/code separation | No product-specific hard-coding (acceptable) but no config ownership either | **Needs config layer** |

Conclusion: the prototype answers none of the spec's defining requirements. It is a markdown dump with
light JS — exactly what the guideline rejected.

---

## 4. Reconciliation — keep / replace / new

### 4.1 KEEP (reuse per spec §40.1–§40.7 — do not duplicate)

- **Access gating:** `swt_commerce_user_has_access($user_id, $ts_id)` — engine renders only what the
  customer owns.
- **Asset storage:** `swiipt_asset_instances` (id, asset_id, instance_type, file_url, generated_at, kind)
  and `swiipt_transformation_system_assets` (id, ts_id, asset_type, format, title, content, position…).
  These remain the content substrate; the engine reads product config + component data from new tables.
- **Transformation model:** `swiipt_trans` / `swiipt_tsystem` / Woo `product` linkage (product↔TS via
  `swt_link_product_transformation`). The Interactive Engine is another delivery layer of the same product.
- **Customer / TSM / check-in foundations:** `swiipt_customer_profiles`, `swiipt_life_state_history`,
  `swiipt_checkins`, `swiipt_tsm_definitions` — seeds for the spec's State, Progress, and TSM engines.
- **Design tokens:** `swt-tokens.css` (canonical tokens) — engine UI consumes them, no new aesthetic.
- **REST / auth patterns:** existing `swiipt/v1/*` registration, `permission_callback`, nonce handling.

### 4.2 RETIRE / REPLACE (the prototype itself)

- `includes/interactive.php` — the `state_json` blob approach, the `[swiipt_interactive]` shortcode, the
  `?ia=` markdown dump, and the account "Interactive practice" indicator. Replaced by the engine.
- `js/swt-interactive.js` + `css/swt-interactive.css` — replaced by component renderers + engine JS/CSS
  built on Swiipt tokens.
- Account "interactive indicator" — re-derived from the new structured Progress/TSM data, not the blob.

### 4.3 NEW (per §20 data model — separate concepts)

- **Product interactive configuration** — where each TS declares its components and their config
  (recommend: `swiipt_interactive_config` table keyed by `ts_id`, storing a validated JSON *config* that
  references content/decision/tracker definitions; this is product config, not runtime state).
- **Customer interactive state** — `swiipt_interactive_state` redefined as structured columns
  (product_id, customer_id, start_date, current_stage, current_day, milestones_completed, active_risks,
  open_rescue_states, last_activity) instead of one blob.
- **Event history** — `swiipt_interactive_events` (id, user_id, ts_id, event, payload, created_at) for the
  §23 analytics events (interactive_opened, today_started, checklist_completed, decision_*, rescue_*,
  tracker_entry_created, script_copied?, milestone_completed, tsm_measurement_recorded, product_completed).
- **Tracker entries** — `swiipt_interactive_tracker_entries` (id, user_id, ts_id, tracker_id, fields JSON,
  created_at, edited_at, note, photo refs) with history/audit.
- **Decision state** — `swiipt_interactive_decisions` (user_id, ts_id, tree_id, path, outcome, created_at)
  for branching traversal + event logging.
- **Milestones / Rescue state** — columns or small tables as the config requires.

---

## 5. Proposed implementation plan (mapped to existing architecture)

> This is the §40 pre-coding plan. No engine code is written until this is approved and schema/API changes
> are identified.

### Phase 1 — Foundation (§37.1)
- Define `swiipt_interactive_config` schema + validation (JSON Schema for product interactive config:
  components array, each with type + config; references to decision trees / trackers / scripts / TSM).
- Define structured state/event/tracker/decision tables (§4.3).
- Build **Component Registry** in a new `includes/interactive_engine.php`: a map of
  `component_type → renderer + state-handler + validator` (TodayPlan, Checklist, DecisionTree, Tracker,
  DailyLog, Timeline, PhotoLog, Milestone, Progress, RescueFlow, ScriptCard, QuickCard, Reflection,
  TSMMeasurement, ResourceLink, ShareAction, ExportAction).
- Responsive shell + rendering architecture on Swiipt tokens; validation engine (§29).
- **Reuse** existing REST/auth + `swt_commerce_user_has_access` for gating.

### Phase 2 — Core (§37.2): Today / Checklist / Tracker / DecisionTree
- **TodayPlan:** reads customer state (start_date → current_day) + daily checklist + normal/changed gate;
  completion auto-updates tracker (§3).
- **Checklist:** structured completion (not blob) feeding Progress.
- **Tracker engine:** §5 fields, timestamps, edit-with-history, numeric/selections/notes.
- **DecisionTree engine:** §4 branching with conditional paths, severity, outcomes, event logging,
  restart/back/answer-review; product config owns nodes (§27).

### Phase 3 — Transformation (§37.3): DailyPlan / Milestones / Rescue / TSM
- **DailyPlan:** relative days, missed-day (not failure), catch-up, rescue/restart (§7).
- **Milestones** + **RescueFlow** (§8 flow: immediate → what-not-to-do → reset → next → escalation →
  script → restart).
- **TSM engine:** baseline capture, scheduled measurement, storage, display, completion (§24) — wired to
  existing `swiipt_tsm_definitions`.

### Phase 4 — Communication (§37.4): ScriptCards / Copy-Share / Read-Aloud
- **ScriptCard engine:** situation → script + shorter version → Copy / Share / Read Aloud (§9), reusing the
  existing Read-Aloud (TTS) pathway.

### Phase 5 — Advanced (§37.5): PhotoLog / Offline-Sync / Exports / Notifications
- PhotoLog (§6), offline queue/sync (§19), doctor-ready **Export** (§25, observations vs interpretation),
  product-configurable notifications (§26) reusing `notify.php` preferences.

### Phase 6 — Factory integration (§37.6)
- Product authoring/configuration API; automated validation (§29); publishing gates (§31) that block
  incomplete/unsafe products; WordPress/platform integration.

### Reference implementation & reusability proof
- **Cord Care (TS #1898 / product #1899)** is the reference (§2, §15, §32): compose Today + Checklist +
  DecisionTree + Tracker + DailyLog + IncidentLog + PhotoLog + SeparationTimeline + RescueFlow + ScriptCards
  + Milestones + TSM **purely from its Product Interactive Config**.
- Then prove a **second** product (e.g. V06 "Every Night, Just Me", TS #85) composes a different component
  set from config **without core-code changes** (§32, §40.13).

---

## 6. Immediate next step

Per §40, before any engine code: produce the detailed schema/API change list (exact table DDL, config JSON
Schema, REST routes) and the Cord Care component-config draft. That document becomes the build contract.

**Nothing in the engine is built until you approve the plan in §5 and the schema in §4.3 / §6.**
