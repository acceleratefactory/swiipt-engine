# Interactive App — Independent Investigation & Live-Site Diagnosis

**Date:** 2026-08-27 (third opencode session)
**Author:** opencode (eng)
**Method:** Read both spec docs + the guideline + Claude's reference app (`index.html` 285 lines / `app.js` 928 lines) + both prior reports (`INVESTIGATION-REPORT.md`, `REBUILD-INVESTIGATION-REPORT.md`) + analyzed `format.jpeg`, then **inspected the LIVE site through the Novamira MCP** (the MCP is active this session, unlike the prior one). Every claim below about live state is verified against the running server, not memory.

---

## 0. One-paragraph answer

The rebuild **is deployed and the server side is correct** — the V06 config loads (title "Every Night, Just Me", 7 scripts, 19 decision-tree nodes, 3 rosters), the phone-frame shell renders, the client JS is the reference-ported client-driven version (reads `SWIIPT_IX.config`, no hardcoded config, no `localStorage`, server-backed state via REST), and the `/event` handler already fans out to `swt_ev_track`. **The reason it "was not good at all" is not the engine — it is how the app is surfaced on the Transformation System page.** The page currently shows **four dead "Interactive: …" ghost links** (pointing at a `?ia=` handler that no longer exists) **plus** an inline phone-frame app, while the actual clean design (`format.jpeg`) has each asset card offering a tidy row of format buttons. The interactive format was bolted on beside the assets as broken per-asset links instead of being placed as a real 6th delivery format. That is the whole problem, and it is fixable in `delivery.php` without touching the working engine.

---

## 1. What `format.jpeg` actually shows (and what it means)

The screenshot is the live **Transformation System page** for *Every Night, Just Me — Complete System*. It lists the **4 asset families** as cards, each with a **mode label chip** and a **row of 5 delivery-format buttons**:

```
┌────────────────────────────────────────────────────────────────────┐
│ [READ]  Every Night, Just Me — Complete System — Guide               │
│  ( Read as magazine )  Read   PDF   Image   Read aloud               │
├────────────────────────────────────────────────────────────────────┤
│ [DO]    Every Night, Just Me — Complete System — Action toolkit      │
│  ( Read as magazine )  Read   PDF   Image   Read aloud               │
├────────────────────────────────────────────────────────────────────┤
│ [DECIDE] Every Night, Just Me — Complete System — Decision aid       │
│  ( Read as magazine )  Read   PDF   Image   Read aloud               │
├────────────────────────────────────────────────────────────────────┤
│ [COMMUNICATE] Every Night, Just Me — Complete System — Script pack   │
│  ( Read as magazine )  Read   PDF   Image   Read aloud               │
└────────────────────────────────────────────────────────────────────┘
```

Two structural facts fall out of this and they are the crux of the placement decision:

1. **The 5 existing formats are per-asset consumption modes.** Each of the 4 asset families (Guide / Action toolkit / Decision aid / Script pack) can be *read as a magazine, read plain, downloaded as PDF, viewed as an image, or read aloud*. They are five ways to **consume the same document**.

2. **The mode labels (READ / DO / DECIDE / COMMUNICATE) already map to the Interactive App's own sub-tabs.** Spec §33 draws Interactive at the same level as the other five formats, but with sub-sections *Today / Do / Decide / Track / Rescue / Communicate*. So the asset families are literally the offline/reading twins of the interactive tabs:

| Asset card (format.jpeg) | Mode chip | Interactive App tab it corresponds to |
|---|---|---|
| Guide | READ | (reading — no interactive twin; this is the magazine/read/PDF content) |
| Action toolkit | DO | **Tonight** (Today plan + checklist) + **Tracker** |
| Decision aid | DECIDE | **Check-in** (decision tree + safety gate) + **Rescue** (FAB) |
| Script pack | COMMUNICATE | **Scripts** |

**Conclusion:** The Interactive App is **not a 6th button that belongs on every card**, because the app is a single system-level experience that *consolidates* DO+DECIDE+TRACK+RESCUE+COMMUNICATE into one stateful tool. Putting "Interactive" five times (once per card) misrepresents it as five separate things. See §5 for the recommended placement.

---

## 2. Live-site state (verified through MCP this session)

| Check | Result | Meaning |
|---|---|---|
| `includes/interactive-app.php` | **8,958 bytes present** | New client-driven engine deployed |
| `includes/interactive-engine.php` | **49,253 bytes present** | Legacy engine **still loaded** |
| `includes/interactive.php` | **MISSING** | Legacy account-OS indicator + `?ia=` render helpers gone |
| `js/swt-interactive.js` | 50,704 bytes | Reference-ported client JS |
| `css/swt-interactive.css` | 14,522 bytes | Reference token set, scoped `.swt-ia-root` |
| `data/v06-config.json` | 14,032 bytes | Bundled V06 product config |
| `modules.php` | requires **both** engines (app after legacy) | Half-migrated |
| TS #85 `_swiipt_interactive_config` | **EMPTY** | App falls back to bundled `v06-config.json` (works, but not authored on the post) |
| `swt_app_get_config(85)` | returns array, title "Every Night, Just Me", 7 scripts, 19 DT nodes, rosters A/B/C | **Config layer works** |
| `[swiipt_interactive_app ts="85"]` render | 2,046 chars, contains `.appframe` + `.swt-ia-root` | **Shell renders** |
| Client JS `SWIIPT_IX` reads | 2 refs, **no hardcoded `PRODUCT_CONFIG`**, **0 `localStorage`**, `ixLoadState`/`ixSaveState` via REST, `boot` awaits state | **Client architecture correct** |
| `/event` REST handler | calls `swt_ev_track()` when present | **Analytics fan-out already wired** |
| Tables `swt_interactive_state`, `swt_interactive_events` | both exist | State store present |
| `swt_app_acceptance()` | **does NOT exist** | The deterministic test fn from the rebuild plan was never added |
| Legacy `swt_interactive_render_instance()` | **does NOT exist** | The `?ia=` launch links are **dead** |

So: **the engine deployment is real and largely correct.** The visible mess is a surfacing/wiring problem in `delivery.php`, plus an unfinished legacy retirement.

---

## 3. The actual bug — verified in `delivery.php`

`[swiipt_transformation_system id="85"]` renders this block (exact live code):

```php
if ( function_exists('swt_interactive_render_instance')
     || ( function_exists('swt_app_get_config') && swt_app_get_config($id) ) ) {
    echo '<div class="swt-ia-launch-list">';
    foreach ( $assets as $a ) {
        echo '<a class="swt-btn swt-btn-ghost" href="'
             . esc_url( add_query_arg('ia', $a->id) ) . '">Interactive: '
             . esc_html($a->title) . '</a> ';
    }
    echo '</div>';
}
```

What this produces on the live page (verified in the rendered output):

```
Interactive: Every Night, Just Me — Complete System — Guide        → ?ia=29
Interactive: Every Night, Just Me — Complete System — Action toolkit → ?ia=30
Interactive: Every Night, Just Me — Complete System — Decision aid   → ?ia=31
Interactive: Every Night, Just Me — Complete System — Script pack    → ?ia=32
```

**Four problems in one block:**

1. **The links are dead.** They rely on a `?ia=` handler (`swt_interactive_render_instance`) that was deleted with `interactive.php`. Clicking them does nothing useful.
2. **Wrong model — per-asset, not per-system.** The new app is ONE app. Emitting one interactive link per asset family (4×) contradicts the whole "one coherent product" principle (Spec §33).
3. **Ugly, off-pattern.** They render as a separate list of long-titled ghost buttons, not aligned with the clean 5-button rows in `format.jpeg`.
4. **Duplication.** The full inline phone-frame app (`swt-ia-root`) is *also* emitted on the same page (appended by the legacy engine's hook, now overridden by the new `swiipt_interactive` shortcode). So the page shows dead links **and** a phone frame stacked in the body.

This is the "not good at all."

---

## 4. Why the prior two reports both said "good" and "bad" at once

Both earlier reports are correct within their scope, and together they explain the confusion:

- `REBUILD-INVESTIGATION-REPORT.md` graded the **engine** and found it faithful to the reference. True — I re-verified it live.
- `INVESTIGATION-REPORT.md` graded the **old visual layer** (tabs `today/do/decide/track/rescue/communicate`, `var(--line)` tokens) and found it off-brand. Also true — but that old layer has since been replaced by the reference-ported one.

Neither report caught the **surfacing bug in `delivery.php`**, because both were written before checking how the app appears *on the Transformation System page* through the real render path. That is the gap this investigation closes.

---

## 5. RECOMMENDATION — where the Interactive App goes on the format list

**Do not add a 6th button to each of the 4 asset cards.** The app is system-level. Instead:

### 5.1 Primary placement (recommended): one hero entry ABOVE the asset cards

Add a single, prominent, primary-styled entry at the **top** of the system page, above the four asset-family cards. It is the 6th delivery format, presented at the system level exactly as Spec §33 draws it.

```
┌────────────────────────────────────────────────────────────────────┐
│  ★  INTERACTIVE APP                                                   │
│     Every Night, Just Me — your operational companion                │
│     Today's plan · Check-in decisions · Tracker · Rescue · Scripts   │
│                                        [ Open the Interactive App → ] │  ← purple, primary
└────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────┐
│ [READ]  … Guide            ( Read as magazine ) Read PDF Image Aloud │
│ [DO]    … Action toolkit   ( Read as magazine ) Read PDF Image Aloud │
│ [DECIDE]… Decision aid     ( Read as magazine ) Read PDF Image Aloud │
│ [COMMUNICATE] … Script pack( Read as magazine ) Read PDF Image Aloud │
└────────────────────────────────────────────────────────────────────┘
```

Rationale:
- Honest to the architecture — one app, one entry (Spec §1, §33: "one coherent product, not six unrelated products").
- The app is the **DO** layer; it deserves visual primacy over the reading formats.
- It opens the phone-frame app in place (or a modal / dedicated route) rather than dumping the frame inline under the assets.

### 5.2 Optional secondary: deep-link buttons on the matching cards

Once 5.1 exists, you *may* add a single **"Interactive"** button to the three operational cards, each deep-linking the ONE app to the right tab (never a separate app):

| Card | 6th button | Opens app at |
|---|---|---|
| Guide (READ) | *(none)* | — reading only |
| Action toolkit (DO) | `Interactive` | Tonight / Tracker tab |
| Decision aid (DECIDE) | `Interactive` | Check-in tab |
| Script pack (COMMUNICATE) | `Interactive` | Scripts tab |

Implementation would be `#tab=today|check|scripts` hash consumed by the client router (a small addition to `swt-interactive.js`; the router already switches tabs by `activeTab`). This preserves the "row of buttons per card" symmetry the owner likes in `format.jpeg` while keeping a single app. **Recommend shipping 5.1 first, add 5.2 only if the owner wants per-card parity.**

### 5.3 Delete the dead launch-list

Remove the `swt-ia-launch-list` / `?ia=` block from `delivery.php` entirely. Replace its trigger condition with the clean primary card in 5.1, gated on `swt_app_get_config($id)` (the new engine), not on the deleted legacy function.

---

## 6. The fix list (engine untouched; surfacing + cleanup only)

Ordered, each small and reversible. All are `delivery.php` / `modules.php` edits — **no change to the working `interactive-app.php`, `swt-interactive.js`, `swt-interactive.css`, or `v06-config.json`.**

| # | Action | File | Risk |
|---|---|---|---|
| 1 | Delete the dead `swt-ia-launch-list` `?ia=` block | `delivery.php` | low |
| 2 | Add the §5.1 primary "Open the Interactive App" card above the asset grid; gate on `swt_app_get_config($id)`; button opens the app (in-page reveal, modal, or `?app=1`) | `delivery.php` | low |
| 3 | Ensure the phone-frame shell (`[swiipt_interactive_app ts=…]`) renders **only** when the app is opened, not inline-by-default under the assets | `delivery.php` | low |
| 4 | Retire the legacy engine: stop requiring `interactive-engine.php` in `modules.php` **after** confirming nothing else calls its `swt_ix_*` helpers; keep the file on disk for rollback | `modules.php` | medium — verify first |
| 5 | Author `_swiipt_interactive_config` postmeta on TS #85 from `v06-config.json` so the product owns its config (stop relying on the bundled fallback) | `execute-php` | low |
| 6 | Add `swt_app_acceptance()` deterministic test (config validates, tables exist, decision-tree refs resolve, access gate) | `interactive-app.php` | low |
| 7 | **Browser verification** (cannot be done server-side): tab switching, decision branching + Back/Restart, checklist persistence across reload, Rescue overlay + `tel:` directory, Scripts copy/share/listen, TSM save, onboarding | live | — |
| 8 | Cord Care (TS #1898) as the §32 reusability proof: author `data/cord-care-config.json` + postmeta; must render a *different* component mix (adds PhotoLog/Timeline) with **zero engine-code change** | config + `execute-php` | medium |

**Safety note (from AGENTS.md lessons #23/#42/#47):** any `delivery.php` edit must go through the temp-lint pattern (write candidate → `/usr/bin/php83 -l` → copy live only if clean), because a parse error in a mu-plugin kills the whole site and all MCP abilities. Do surgical single-anchor edits; never splice across the top-level `$swt_reader_css`/`$swt_tool_css` globals (lesson #47). Purge StackCache and `opcache_reset()` after, then verify with a `?c=rand` cache-buster.

---

## 7. What is genuinely DONE vs OUTSTANDING

**Done and verified live:**
- Client-driven engine (config from `SWIIPT_IX`, no hardcoding, server state, REST, access gate, `swt_ev_track` fan-out).
- V06 config complete (rosters, checklist, 19-node decision tree incl. safety gate, 7-step rescue, 7 scripts, TSM, milestones).
- Reference design system (navy/purple/gold/blush, Inter + DM Serif) scoped under `.swt-ia-root`.
- State + events tables.

**Outstanding (blocks "shipped"):**
1. Surfacing fix in `delivery.php` (§5, §6.1–6.3) — **the main thing that makes it "not good."**
2. Legacy engine retirement (§6.4).
3. Postmeta authoring on TS #85 (§6.5).
4. Browser acceptance run (§6.7) — cannot be verified from PHP; needs a real browser.
5. Cord Care 2nd product = the Spec §32 reusability proof (§6.8) — until this passes, "reusable engine" is asserted, not proven.

---

## 8. Bottom line for the owner

- The engine your last session shipped is good and I verified it live — don't rebuild it.
- The reason the page looks wrong is a **delivery-layer surfacing bug**: dead `?ia=` "Interactive: …" links (×4) plus an inline phone frame, instead of one clean 6th-format entry.
- On `format.jpeg`, the Interactive App belongs as **one primary "Open the Interactive App" card above the four asset cards** (Spec §33), not as a button repeated on each card. Optionally add per-card "Interactive" deep-links to the DO/DECIDE/COMMUNICATE cards later, all opening the same app.
- Fixes are small, reversible `delivery.php`/`modules.php` edits. The engine files stay untouched. Then: author the postmeta, run the browser acceptance checks, and build Cord Care as the reusability proof.

I did not change any code this session — investigation and this report only, as requested. Tell me to proceed and I'll implement §6 through the MCP with the temp-lint safety pattern.

---

## 9. Review of the owner's `new format.jpeg` — and an honest verdict vs §5.1

*(Appended 2026-08-27 after the owner shared `new format.jpeg`.)*

### 9.1 What the new design shows

The owner's `new format.jpeg` is a full redesign of the Transformation System page. It is **not** my §5.1 (one hero card above four asset cards). It is a considerably stronger model:

**Header:** navy bar — "Every Night, Just Me — Complete System · Postpartum & New-Parent Life · v1.2 · Clinically reviewed".

**Hero:** eyebrow "Complete System · V06" → serif title → description that names all six modes verbatim ("read it as a magazine, a clean document, download it, view it, listen to it, or open it as an interactive tool") → chips: **7 components · 6 delivery modes · TSM · nights become shared · Interactive included** → journey stepper **1 SEE → 2 UNDERSTAND → 3 ACT → 4 MEASURE → 5 CONTINUE**.

**"ONE SYSTEM · SIX WAYS IN" legend:** a 6-tile grid stating each mode's *job* — Read as magazine (Understand, explore, engage) · Read (Learn structured material) · PDF (Download · offline · reference) · Image (Remember quickly) · Read aloud (Consume hands-free) · **Open interactive (Act · decide · track · recover)**. This is literally Spec §1's "distinct job per delivery mode" table rendered as UI.

**"THE SYSTEM · COMPONENTS":** the caption is the whole thesis — *"The recommended mode is highlighted. Work that is better done in software opens as an interactive tool."* Then **7 component cards**, each with a mode chip, title, one-line situation description, a **"Recommended: <mode>"** line, and a button row where the recommended mode is **purple/filled and first**, followed only by the modes that actually apply to that component:

| # | Chip | Component | Recommended | Buttons shown | Interactive? |
|---|---|---|---|---|---|
| 1 | READ | Guide | Read as magazine | Read as magazine · Read · PDF · Image · Read aloud | **No** — "Interactive not required for this component" |
| 2 | DO | Action toolkit | Open interactive | **Open interactive** · Read as magazine · Read · PDF · Image · Read aloud | Yes |
| 3 | DECIDE | Decision aid | Open interactive | **Open interactive** · Read · Image · PDF | Yes |
| 4 | COMMUNICATE | Script pack | Open interactive | **Open interactive** · Read aloud · Read · PDF | Yes |
| 5 | TRACK | Shift tracker | Open interactive | **Open interactive** · PDF | Yes |
| 6 | RESCUE | Bad-night protocol | Open interactive | **Open interactive** · Image · PDF | Yes |
| 7 | PROGRESS | Progress & TSM | Open interactive | **Open interactive** | Yes |

**Footer:** "Educational, not medical advice. Content clinically reviewed · v1.2. The Interactive layer does the work that software does best — act, decide, track, recover, communicate."

### 9.2 Honest verdict: adopt the new design. It beats §5.1.

You asked me to be honest and to recommend §5.1 if it is genuinely better. It is not. **Your `new format.jpeg` is the stronger strategy — adopt it, and retire §5.1.** Reasons, measured against the spec, not politeness:

1. **It is more faithful to the spec than my §5.1.** Spec §1 says every delivery mode has a *distinct job*; §33 draws Interactive as a peer format with sub-areas Do/Decide/Track/Rescue/Communicate. My §5.1 collapsed all of that into a single opaque "Open the Interactive App" hero button. Your design surfaces the sub-areas as first-class components and gives every mode its stated job. It is the spec drawn out, not summarised.

2. **"Interactive only where it's needed" is exactly right — and my §5.1 got that half-wrong.** My §5.1 hid the fact that the Guide genuinely should *not* be interactive. Your Guide card says so out loud ("Interactive not required for this component") and shows no interactive button. That is honest product design and it teaches the customer the model in one glance.

3. **Recommended-mode-first is better UX than a generic hero.** A hero button ("Open the Interactive App") makes the customer decide *when* to use it. Your per-component "Recommended: Open interactive" (purple, first) tells them *for this piece of work, this is the right mode* — while still leaving the reading/offline modes available. That is lower cognitive load (Spec §16/§17) and it is the correct default-with-escape-hatch pattern.

4. **Promoting TRACK / RESCUE / PROGRESS to visible components is a real improvement.** In the current build these live *only* inside the app and are invisible on the system page. Your design makes them purchasable, understandable, first-class parts of the system — which also makes the value obvious before purchase and improves SEO/JSON-LD surface.

5. **It still honours the "one app, not six" rule** — provided every "Open interactive" opens the **same** app instance deep-linked to the right tab (see §9.4). The chips are components; the app is one. So you keep §5.1's core principle (one coherent product) *and* gain per-component clarity. Best of both.

The only thing §5.1 had going for it was implementation simplicity. That is not a good enough reason to ship a weaker model. **Recommendation: build the `new format.jpeg` design.**

### 9.3 Where this leaves my earlier §5 recommendation

- §5.1 (single hero card): **superseded.** Do not build.
- §5.2 (per-component deep-links into one app, opening the right tab): **this is what your new design is** — refined with the recommended-mode system and the ONE-SYSTEM-SIX-WAYS legend. Your design is the correct, fuller expression of §5.2.
- §5.3 (delete the dead `?ia=` launch list): **still required**, and the new design replaces it cleanly.

### 9.4 What the new design requires to build (so we go in eyes-open)

Not blockers — just the real work, flagged honestly:

1. **Two-axis data model: component (7) × mode (6).** Today the platform conflates them: there are only **4 asset rows** on TS #85 (Read/Do/Decide/Communicate) and the `swiipt_asset_format` taxonomy has 4 terms. The new page needs **7 components** (adds TRACK/RESCUE/PROGRESS) and each component must declare *which modes apply* + *which is recommended*. Cleanest fix: keep the 4 document assets as-is and represent TRACK/RESCUE/PROGRESS as **interactive-primary components** (config-driven, optional PDF/Image export), so we don't fabricate document assets that don't exist. The per-component "modes shown + recommended" belongs in the product config (it is product content, per Spec §13/§27), not hardcoded in `delivery.php`.

2. **Deep-link routing in `swt-interactive.js`.** The app has tabs Tonight / Check-in / Tracker / Scripts + Rescue overlay + Settings. Map every "Open interactive":
   - DO → Tonight · DECIDE → Check-in · TRACK → Tracker · COMMUNICATE → Scripts · RESCUE → open Rescue overlay · PROGRESS → Tracker (TSM card).
   The router already switches on `activeTab`; it needs to accept an initial tab (e.g. `?app=1&tab=check` or a hash) and, for RESCUE, auto-open the overlay. Small, additive JS change — no engine rearchitecture.

3. **One app instance, opened in place.** Every "Open interactive" should reveal the *same* phone-frame app (in-page reveal or modal), not navigate to six different things and not embed six frames. This is the guardrail that keeps it "one coherent product."

4. **The legend + hero + journey stepper + chips** are presentation in `delivery.php` (theme layer), fed by real data (component count, TSM presence, clinical-review status). Honesty rule from the platform holds: the "Clinically reviewed · v1.2" and "TSM · nights become shared" chips must reflect *real* review status and a *real* TSM, or be omitted — never fabricated (AGENTS.md decision #6, Spec §22/§31).

5. **Per-component "recommended mode" and "modes shown"** must be authored per product (V06 first), because it differs by component and by product. This is a small addition to the interactive/product config schema.

### 9.5 Revised build plan (replaces §6 items 1–3)

| # | Action | File | Note |
|---|---|---|---|
| A | Delete the dead `swt-ia-launch-list` `?ia=` block | `delivery.php` | as before |
| B | Rebuild the system-page render to the `new format.jpeg` layout: header → hero (title/desc/chips/stepper) → "SIX WAYS IN" legend → 7 component cards with recommended-mode-first button rows | `delivery.php` + `swt-components.css` | the main work |
| C | Extend the product/interactive config so each component declares `{ modes_shown[], recommended_mode, interactive_tab }`; author for V06 | `v06-config.json` / `_swiipt_interactive_config` | product content |
| D | Represent TRACK/RESCUE/PROGRESS as interactive-primary components (no fabricated document assets) | config + `delivery.php` | honesty |
| E | Add deep-link tab routing to the client (`tab=` / hash; RESCUE opens overlay); every "Open interactive" opens the ONE app in place | `swt-interactive.js` + `delivery.php` | additive |
| F | Keep chips truthful: real component count, real TSM, real clinical-review status or omit | `delivery.php` | Spec §22/§31 |
| G | (unchanged) postmeta authoring, `swt_app_acceptance()`, browser verification, Cord Care §32 proof | — | as in §6.5–6.8 |

Engine core (`interactive-app.php`, state/REST, access gate) stays untouched. The work is delivery-layer + config + a small additive JS router change. Same temp-lint safety discipline (§6 safety note) applies to every `delivery.php` write.

### 9.6 One-line answer to your question

**I do not recommend §5.1. Your `new format.jpeg` is better on every axis that matters — spec fidelity, honesty, UX, and pre-purchase clarity — and it still keeps the "one app" principle. Build the new design.** Show me the "more things" you mentioned and I'll fold them into this plan before we touch code.
