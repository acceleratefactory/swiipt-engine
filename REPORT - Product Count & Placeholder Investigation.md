# Product Count Report — Why We Built Only 5 (+ Placeholder-Asset Investigation)

_Date: 2026-08-25 · Scope: Postpartum & New Life (m01) documents → Product Factory queue_

---

## 1. How many products are in the Postpartum documents?

All 21 Postpartum Library territory reports + your validated V-products + PP set were parsed
(backfill v1 + v1b). Result: **589 catalogued opportunities**, every one retained with a role
(nothing discarded). Role breakdown:

| Role | Count | Meaning |
|---|---|---|
| STANDALONE_TRANSFORMATION | **383** | true sellable products |
| MODULE | 140 | attach inside bigger systems |
| MARKETING_ANGLE | 24 | positioning variants — not products |
| LEAD_MAGNET | 12 | free entry items |
| FUTURE_RESEARCH | 20 | not buildable yet |
| ENTRY_PRODUCT / BUNDLE_COMPONENT / UPSELL | 10 | structural pieces |

**Realistic catalogue target ≈ 383 standalone products** (plus the 140 modules folded into them).

## 2. What we have built: 5 live m01 products

| # | Product | Score | Built via | WP IDs (trans/system/product) |
|---|---|---|---|---|
| 1 | Every Night, Just Me (V06) | 98 | Manual build (2026-08-19) | 84 / 85 / 86 |
| 2 | Cord Care That Won't Land You in A&E (V14) | 86 | Factory Wave 1a | 1897 / 1898 / 1899 |
| 3 | Omugwo on Your Terms (V12) | 83 | Factory Wave 1b | 1903 / 1904 / 1905 |
| 4 | The No-Village C-Section (V05) | 80 | Factory Wave 1b | 1900 / 1901 / 1902 |
| 5 | Beyond the Restroom: Return-to-Work OS (V19) | 79 | Factory Wave 1b | 1906 / 1907 / 1908 |

### Why only these 5?

1. **They are YOUR validated flagships.** Every one scored ≥79 in the validation matrix YOU
   authored in `MEMORY.md` during the naming/selection audit. They were the highest-confidence
   builds before any mass production.
2. **Wave discipline.** The factory chain (TR record → authored assets → manifest → publisher
   bridge → live + SEO) had to be proven end-to-end first. Waves 1a+1b did exactly that.
   V03 (score ~79+) was deliberately consolidated into PP-01 instead of being built separately.
3. **Quality over volume.** Each wave product required real authored content (guides, checklists,
   decision cards, scripts, rescue cards) with sourced evidence — WHO/AAP/Mayo/CDC/PUMP Act etc.
   That authoring is the bottleneck by design; it is what makes these real products and not
   the placeholder problem described below.
4. The top item of the whole queue — NIGHTSHIFT (98) — already existed as V06.

## 3. What remains in the queue?

Selection engine (`harness/select.mjs`, runs on all 589):

| Band | Count | Notes |
|---|---|---|
| Built | 5 | listed above |
| **P1** | **14 remaining** | Body-Recovery niches (65 pts each): C-section shelf, diastasis, apron belly, end-of-day bloat, breasts-after-weaning, stretch marks, snap-back event pressure, bladder leak, prolapse ("something is falling out"), leak-when-exercising, painful intimacy after tear, can't-lift-toddler, "nothing feels like me", postpartum wardrobe rebuild |
| P2 | 89 | second wave candidates |
| P3 | 321 | third wave |
| QUEUE | 164 | parked indefinitely |

**≈ 584 unbuilt opportunities remain** (589 − 5 built).

---

## 4. Investigation: why the 4 new products looked messy vs V06

You observed: the 4 factory products carried ~24–30 downloadable files full of placeholder
content, while V06 has a neat 12 files. **Your observation was correct.** Here is exactly what happened:

### Root cause

`delivery.php` line 85 hooks WordPress `save_post`: whenever a new Transformation System post is
published with **zero** assets, it auto-creates **4 placeholder assets** (one per format:
Read/Do/Decide/Communicate) containing the literal string *"Placeholder content for …"*.

- The **factory** inserts each new system EMPTY first (title/meta only), so the hook fired and
  dropped in 4 placeholders. The manifest's real authored assets were attached AFTER →
  each system ended up with 8–10 assets: **half of them junk**.
- Every asset generates 5 instance files (HTML/PDF/SVG/TXT/magazine), and ALL instances got
  attached to the Woo product as downloadable files → 24–30 files per product, many reading
  "Placeholder content…".
- **V06 escaped** because it was assembled manually with its 4 real assets already present when
  the system was saved, so the zero-asset condition never triggered.

### Audit before fix (live DB)

| System | Assets total | Placeholders | Real/authored | Instances | Downloads on product |
|---|---|---|---|---|---|
| V06 (#85) | 4 | **0** | 4 | 20 | **12** ✅ |
| CordCare (#1898) | 10 | 4 ❌ | 6 | 50 | 30 ❌ |
| CSection (#1901) | 9 | 4 ❌ | 5 | 45 | 27 ❌ |
| Omugwo (#1904) | 8 | 4 ❌ | 4 | 40 | 24 ❌ |
| RTWork (#1907) | 8 | 4 ❌ | 4 | 40 | 24 ❌ |

### Fixes applied (2026-08-25) — second pass, same day (owner integrity review)

After the placeholder cleanup, the owner asked the deeper question: *were the file counts derived
from each product's own transformation, or copied from V06's 12?* Full investigation found:

1. **The counts were never copied from V06.** Each product's download count = its OWN number of
   authored assets × 3 formats (html/pdf/txt). Evidence: CordCare = 6 assets → 18 files,
   CSection = 5 → 15. Omugwo/RTWork have 4 assets → 12, which coincidentally matches V06's
   4 asset families. V06 itself is 13 source documents decomposed into those same 4 families
   (roadmap/situation-finder/safety live inside as card components + interactive tools).
2. **REAL GAP FOUND: RTWork was missing its Rescue Card.** Its ledger plans 5 assets
   (`AS-RTW-RESCUE-001`) but only 4 were published — a publishing omission, not a design choice.
   Every other product has its dedicated bad-day/rescue card. **Fixed:** authored the
   "Bad-Day Rescue Card (Minimum Mode)" (supply crash, pump-break denial escalation, childcare
   collapse, mastitis red flags, night-before disaster, mood guardrail, 24/7 numbers), attached
   as asset #80 on TS #1907, instances generated. RTWork is now 5 assets → 15 files, matching
   its own spec.
3. **Download naming upgraded for ALL five products** (incl. V06): `swt_commerce_attach_downloads`
   previously named every file "System asset N" (generic — this was true for V06 too). New namer
   produces e.g. *"Omugwo on Your Terms - The Omugwo Agreement Kit (PDF)"* — system title +
   asset title + format label, HTML-decoded and deduped.

### Final state of all 5 m01 products

| Product | Assets | Downloads | Naming |
|---|---|---|---|
| V06 Every Night, Just Me | 4 families (13 docs inside) | 12 | titled per family |
| Cord Care | 6 | 18 | titled per asset |
| No-Village C-Section | 5 | 15 | titled per asset |
| Omugwo on Your Terms | 4 | 12 | titled per asset |
| Return-to-Work OS | 5 (rescue card restored) | 15 | titled per asset |

Every file on all 5 products is real authored content with meaningful names.

### Note on remaining placeholders in the DB

36 older placeholder asset rows still exist in the database — they belong to the **demo seed
systems** (#42 Postpartum Baseline, #44 Debt Paralysis, etc.) that you decided to keep PUBLIC
(decision #4, 2026-08-19). They are already tracked as a pre-launch cleanup item in AGENTS.md;
they are unrelated to the 4 factory products.

## 5. Recommended next step

Start **Wave 2**: the 14 P1 body-recovery products (PBR-A1…H1). With the placeholder bug fixed,
every future product ships V06-clean from day one. Pricing on all current products remains
placeholder ($29 / ₦45,000 / €27 / GH₵450) pending your market decisions, and Gate O clinical
sign-off is still required before launch marketing.
