# Interactive App — Investigation & Rebuild Report

**Date:** 2026-08-27
**Reference studied:** `Product Pipeline/asset design/app/{index.html, app.js}`
**Author:** opencode (eng)

---

## 1. What "right" looks like (the reference)

The reference is a self-contained, **phone-native interactive app** — not a web-embedded shell.

**Design system (from `index.html` `:root`)**
- Brand: `--navy:#0B1F33`, `--purple:#6F35B5`, `--gold:#D9A52E`, `--blush:#F3C7D2`
- Neutrals: `--ink:#17212B`, `--text-2:#52606D`, `--muted:#8593A1`, `--border:#E3E7EB`, `--soft:#F4F6F8`, `--warm:#F8F4EC`
- Semantic: `success/warning/error/info` + matching `*-tint` backgrounds
- Fonts: **Inter** (400/500/600/700) + **DM Serif Display** (display/serif), self-hosted in `assets/fonts/`

**App chrome**
- Phone frame: `420px` centered on desktop, full-bleed on mobile (`@media max-width:460px`)
- Navy header: brand mark, **Day badge** (`Day N`), **Roster chip**, **NSC chip**, settings gear
- Scrollable main; **bottom tab bar**; **floating pulsing red Rescue FAB**; **Rescue overlay** (red head), **Settings overlay**, **Onboarding modal**, **toast**

**Navigation / tabs**
- **Tonight** = TodayPlan + daily Checklist
- **Check-in** = DecisionTree (branching question→outcome, breadcrumb/back, `safety_check` node → crisis/reassurance, outcome types: roster / guidance / script / crisis / reassurance; high-severity script callouts)
- **Tracker** = Tracker + DailyLog + Progress + TSM (1–10 check-ins) + **Recovery Bank ledger** (earn/redeem/expire) + night log (form + rows) + shareable export
- **Scripts** = ScriptCard list → detail, **Copy / Share / Listen (Web Speech)**, verbatim product prose
- Plus Rescue overlay, Settings overlay, Onboarding (birth date + roster pick)

**Architecture (per `app.js` header comments — explicitly the build spec's intent)**
- `PRODUCT_CONFIG` — product-owned content (strings, decision nodes, scripts, rescue steps, TSM, milestones, rosters). A second product swaps this with **zero engine-code change** (Spec §27, §32).
- `ENGINE.*` — generic renderers (Checklist, DecisionTree, Tracker, RescueFlow, ScriptCard, TSM) that know nothing about the product.
- `StateModel` — distinct storage keys (`user`, `today`, `tracker`, `events`, `tsm`, `milestones`, `journey`), never one blob (Spec §11/§20). Reference uses `localStorage`; platform needs server backing.
- `validateProductConfig()` — runs at boot (Spec §29).
- Analytics — the **13 canonical events** (`interactive_opened`, `today_started`, `checklist_completed`, `decision_started/completed`, `rescue_started/completed`, `script_copied/shared`, `tracker_entry_created`, `tsm_measurement_recorded`, `milestone_completed`).
- Single event-delegation listener dispatching on `data-act`.

**Important:** the reference content is **"Every Night, Just Me" (V06, TS #85)** — NOT Cord Care.

---

## 2. What was actually built (the "nonsense")

- Server-side mu-plugin (`includes/interactive-engine.php`) + `js/swt-interactive.js` + `css/swt-interactive.css`, embedded via `[swiipt_interactive ts=]` on the TS page.
- **Tabs were `today / do / decide / track / rescue / communicate`** — a different taxonomy and framing from the reference.
- **CSS used tokens like `var(--line)`, `var(--surface-raised)`, `var(--color-brand-primary)`, `var(--color-error)`, `var(--text-muted)`** that do not match the reference's token set (and are not reliably defined in the live `swt-tokens.css`). Result: looked unstyled / off-brand.
- **No phone frame, no bottom tab bar, no Rescue FAB, no overlays/modal, no toast, no header chips.**
- Decision tree, scripts, and tracker were implemented as plain stacked sections, not the reference's branching flow / script-detail cards / recovery-bank ledger.
- Reference config was built for **Cord Care (TS 1898)**, not V06.
- State was persisted **server-side** (6 tables) + REST + access-gated, and analytics fed the platform pipeline. *(This part is actually correct for a platform — see §4.)*

---

## 3. Root cause

The earlier engine implemented the spec's **server/architecture** reading (config-driven, REST, DB tables) but missed the spec's **product/UX** intent, which the reference app makes explicit: a native-feeling, phone-framed, tabbed app with a specific token/font/component system and a specific product (V06). The *visual layer was never aligned to the reference design system*, and the tab/component taxonomy was invented rather than taken from the reference.

---

## 4. Recommended rebuild

**Keep (platform-correct, do not throw away):**
- Server-side product config (`_swiipt_interactive_config` TS postmeta)
- Server-side state (the 6 tables) + REST + access-gating
- Analytics → platform evidence pipeline (already wired via `swt_ev_track`)

**Replace (the "nonsense"):**
- The entire client visual/JS layer — port `index.html`'s CSS + `app.js`'s architecture into the platform so it matches the reference exactly: phone frame, bottom tab bar, Rescue FAB, overlays, onboarding modal, toast, the reference token set, Inter + DM Serif Display, and the reference component taxonomy (Tonight / Check-in / Tracker / Scripts + Rescue / Settings / Onboarding).
- Decision-tree UX (branching + `safety_check` + breadcrumb/back), ScriptCard (copy/share/speak), Tracker (stat grid + TSM + Recovery Bank ledger + night log + export).

**Port the product content:** move the reference `PRODUCT_CONFIG` (V06) into the **V06 TS (#85)** interactive config so the app shows the correct product. Cord Care (and others) get their own configs later.

**Integration bridge:** the client loads `PRODUCT_CONFIG` + state from the existing REST endpoints and writes state back through them (instead of `localStorage`), preserving multi-device + access-gated behaviour. The generic `ENGINE.*` renderers stay product-agnostic.

---

## 5. Decisions needed from owner before rebuild

1. **App location** — (a) embedded in the Transformation System page with the phone-frame (centered on desktop, full-bleed on mobile) **[recommended — matches the reference's responsive rule]**; or (b) a dedicated full-page route (`/app/{product}/`).
2. **State persistence** — keep **server-side** (multi-device + access-gated) **[recommended for the platform]** vs `localStorage` (reference demo). Server-side means the client loads/saves via REST — a deliberate, necessary divergence from the reference.
3. **Confirm target product is V06 (Every Night, Just Me, TS #85)** — port the reference config there. (Cord Care gets its own config thereafter.)
4. **Engine file handling** — replace `interactive-engine.php` / `swt-interactive.js` / `swt-interactive.css` **in place** (they are the "nonsense") while preserving the REST/state/analytics layer, vs authoring new files.

---

## 6. Verification (post-rebuild)

- Visual: phone frame renders; tabs Tonight/Check-in/Tracker/Scripts; Rescue FAB pulses; overlays/modal/toast work; tokens + fonts match reference.
- Functional: decision tree branches + safety gate; script copy/share/speak; tracker stat grid + TSM + ledger + night log + export; onboarding sets birth date + roster; day badge computes from birth date.
- Platform: state persists server-side per user; access-gated (401/403); the 13 canonical events flow to `swt_ev_track`; `swt_ix_acceptance()` still passes; a second product is configured by config only (no engine-code change).
- Honesty: no fabricated content — all strings sourced from the reference `PRODUCT_CONFIG`.
