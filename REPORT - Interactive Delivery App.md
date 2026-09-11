# Report — Interactive "App" Delivery Format

**Date:** 2026-08-26
**Author:** opencode (for owner review)
**Context:** Swiipt currently ships each asset in 5 consumption formats — *Read as magazine* (flipbook), *Read* (plain), *PDF*, *Image*, *Read aloud* (TTS). The owner observes most buyers will not print; they want the trackers, checklists, decision trees, rescue cards and script packs to behave like an **in-app interactive experience** rather than a document. This report investigates feasibility, proposes an architecture, and scopes the work.

---

## 1. Verdict

**Yes — fully feasible, and recommended.** The interactive behaviour is almost entirely a *client-side state + persistence* problem layered on top of the widget content we already author (`[[TOOL:]]`, `[[DECISION]]`, `[[RESCUE]]`, `[[SCRIPTS]]` blocks rendered by `swt_tool_render` / `swt_w_decision` / `swt_w_rescue` / `swt_w_scripts` in `delivery.php`). We do **not** need to re-author content; we need to (a) make the rendered widgets *stateful* and (b) persist that state so it survives reloads, devices, and logout.

Two design decisions drive the build:

1. **Persistence target: server-side, not just the browser.** For a paid membership product, browser-only storage (`localStorage`/`IndexedDB`) is fragile (device switch, clear-cache, "lost my checklist"). We already own the right tables — `swiipt_progress_records`, `swiipt_checkins`, `swiipt_customer_profiles` — and the access gate `swt_commerce_user_has_access`. Interactive state should be a thin extension of that model, with `localStorage` only as an offline *write buffer*.
2. **Stack: vanilla JS, no framework.** The existing reader (`swt_delivery_reader`) and theme already ship dependency-free vanilla JS. Adding React/Vue would bloat the bundle and break the "self-contained, no CDN" rule (lesson #22). 2026 research confirms vanilla + a tiny reactive store (Proxy) + optional IndexedDB is sufficient and is the dominant "no-framework" pattern for exactly this class of app.

---

## 2. What we have today (grounding)

From `delivery.php` (verified live 2026-08-26):

| Capability | Status | Interactive gap |
|---|---|---|
| `swt_delivery_markdown` → real `<input type=checkbox>`, `<table class="swt-table">` | ✅ renders | checkboxes are **not** saved; reload resets them |
| `swt_w_decision` → route cards (emergency/urgent/ok) | ✅ renders | static; no "choose a path → see next step → back" navigation |
| `swt_w_rescue` → rescue frame + tap-to-call `tel:` | ✅ renders | no "I used this / timestamp" |
| `swt_w_scripts` → numbered script cards | ✅ renders | no "mark practised / copy" state |
| `swt_delivery_reader` (self-contained vanilla JS flipbook) | ✅ | proves we can ship standalone JS with zero CDN |

The authoring taxonomy `swiipt_asset_format` = **Read / Do / Decide / Communicate** maps cleanly onto the four interactive behaviours below. The 5 *consumption* formats are a separate axis; **Interactive** becomes a 6th consumption format that *consumes* the existing widget content.

---

## 3. Proposed new format: "Interactive"

Add **Interactive** to the delivery format list (beside Read as magazine / Read / PDF / Image / Read aloud). It is gated by the same `swt_commerce_user_has_access` check as the other formats, and it reuses the asset's already-authored widget blocks.

| Asset family (authoring role) | Interactive behaviour |
|---|---|
| **Action Toolkit (Do)** | Checklists + trackers become **live, autosaving** task lists with a progress % that feeds the same progress bar as `swiipt_progress_records`. |
| **Decision Aid (Decide)** | Decision tree becomes **navigable**: tap a route → reveals next step / sub-decision → Back/Restart. No scrolling wall of cards. |
| **Rescue Card (Decide/Communicate)** | "I used this" timestamp + one-tap `tel:` kept; surfaces crisis lines prominently. |
| **Script Pack (Communicate)** | Tap-to-copy a script; "mark practised" state; optional spaced-practice reminder. |
| **Guide (Read)** | Optional: highlight/notes, "mark section done". Lower priority. |

---

## 4. Architecture proposal

### 4.1 Persistence model (server-side, authoritative)
- New table `swiipt_interactive_state` (or extend `swiipt_progress_records` with an `asset_instance_id` + `blob` column):
  `id, user_id, asset_instance_id, state_json, updated_at`.
- New REST endpoint (login required, ownership-enforced like `/checkin`):
  - `GET  /swiipt/v1/interactive/{asset_instance_id}` → returns saved `state_json`
  - `POST /swiipt/v1/interactive/{asset_instance_id}` → validates ownership, writes `state_json` (debounced from client)
- This makes progress **survive device switch + logout** and lets the Account OS "My Library / Check-ins" panels show real interactive completion alongside check-ins. It also keeps a single source of truth (no client/server merge conflicts).
- `localStorage` is used **only** as an offline write-buffer: if the POST fails (offline), queue and flush on reconnect. (Pattern: "outbox" in IndexedDB per Cursa PWA guide.)

### 4.2 Rendering
- New `kind='interactive'` asset instance (mirrors existing `html/pdf/image/audio_transcript`) OR a dedicated render path in `delivery.php` `swt_delivery_markdown` that, when the request context is "interactive mode", emits `<div class="swt-ia" data-asset="ID" data-state="…">` wrappers around each widget instead of static markup.
- A single vanilla JS module `swt-interactive.js` (enqueued on the system/library/account pages) binds to `.swt-ia`:
  - checkbox change → update in-memory state → debounced POST to REST
  - decision-tree taps → push/pop a navigation stack (no page reload)
  - progress % computed client-side and POSTed; reflected in the existing progress UI
- No build step, no framework. Roughly the same surface as `swt_delivery_reader` (~a few KB).

### 4.3 Optional PWA shell (gated by existing `pwa_shell` flag)
To deliver the genuine "App" feel the owner wants, wrap the interactive surfaces in an installable PWA:
- `manifest.json` (name "Swiipt", icons, `display: standalone`) + `sw.js` service worker that cache-first serves the interactive JS/CSS/app shell (per Google PWA codelab + the offline-first health-PWA pattern used by Amanak/VITA/Kit-AI).
- This gives "Add to Home Screen", offline opening, and background sync of the outbox.
- **Honesty/guardrail:** crisis lines and rescue `tel:` must always work even offline (bundle them in the precache). Medical disclaimers rendered inline. No fabricated progress.

> Note: a full PWA is optional phase 2. The stateful interactive format (4.1–4.2) delivers 90% of the user value with zero service-worker complexity and can ship first.

---

## 5. Effort & phasing

- **Phase 1 — Stateful interactive format (no PWA):** table + REST + `swt-interactive.js` + render wrappers in `delivery.php` + access gate. Reuses existing widgets. ~est. small-to-medium.
- **Phase 2 — PWA shell:** manifest + service worker + offline outbox + install prompt, gated by `pwa_shell`. ~est. medium.
- **Phase 3 — Account OS integration:** surface interactive completion in My Library / Check-ins progress; optional spaced-practice nudges via existing notification pipeline.

---

## 6. Open questions for owner

1. **Scope of "Interactive"** — all four widget families at once, or start with the highest-value **Action Toolkit (trackers/checklists)** + **Decision trees** and add scripts/rescue later?
2. **Persistence** — confirm server-side (recommended) vs browser-only. Server-side implies a new table + REST (Phase 1 above).
3. **PWA now or later** — ship stateful format first, add installable offline app after?
4. **Progress semantics** — should an interactive checklist completion count toward the system's overall progress % (same as check-ins), or be a separate "in-app activity" indicator?

---

## 7. Research references (2026)

- Client-side storage 2026: MDN Client-side storage; Cursa "Data Storage Choices: IndexedDB, Cache Storage, localStorage"; rxdb browser-storage comparison; ShiftAsia localStorage-vs-IndexedDB.
- Local-first / offline-first health PWAs: Smashing Magazine "Architecture of Local-First Web Development" (2026-05); CrisisCore "Offline-first without a backend" (2026-06); Amanak, VITA, Kit-AI — offline-first first-aid PWAs; Google PWA "Going Offline" codelab.
- Interactive decision-tree PWA: `guillaumefe/tree` (offline-capable decision-tree PWA, vanilla JS + service worker).
- Vanilla state management 2026: Pilecode "State Management 2026"; Dev.to "You Might Not Need a Framework" (Proxy-based reactive store); Vibidsoft "State Management in Vanilla JS: 2026 Trends".
- PWA recovery/UX: Dev.to "Building a High-Performance PWA Without React" (service worker as router, escape hatch, offline UX > technology).

---

*This is an investigation/report only. No code was written. Awaiting owner go-ahead on the open questions before implementation.*
