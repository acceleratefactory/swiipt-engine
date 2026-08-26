# REPORT — Product Content in the Factory
### How landing-page + single-product-page content becomes a built-in factory stage (not an afterthought)

*Investigation report · 2026-08-26 · scope: `Product Pipeline/` factory + live `swiipt-core` publisher + `swiipt` theme.*

---

## 0 · The owner's directive (what triggered this)

> "The content creation for products is supposed to be built into the factory system, not after we
> have created the product and are now thinking of generating the content for each product. Imagine
> doing that for 500 products. Product content has to be part of the product factory. V06 has landing
> page content although we created V06 manually… the factory should behave the same — it should be
> able to generate landing page and single product page content."

**The requirement in one line:** for every product the factory manufactures, the factory must also
manufacture its **landing page** and **single product page** content — automatically, from the
records — exactly the way it already manufactures the transformation, system, assets, and Woo
product. No per-product hand-authoring of sales content.

---

## 1 · Executive finding

**Content generation is fully DESIGNED in the factory, but NOT IMPLEMENTED.**

Every contract, schema slot, standard, and design template needed already exists on paper. What is
missing is the machinery: there is no generator, no content schemas, no manifest slot, no publisher
support, no QA gate, and no live landing surface. As a result, every published product ships with
`content.landing_page = null` and the `g6_content` gate "passes" only because the schema permits
null.

| Layer | Designed? | Implemented? |
|---|---|---|
| `product.schema.json` `content` block (7 required fields) | ✅ yes | ⚠️ slot exists, always `null` |
| `@lfe-copywriter` agent contract | ✅ yes | ❌ no runner / no tool |
| `copy-standard.md` (voice, honesty, title architecture) | ✅ yes | ❌ not enforced anywhere |
| `product-standard.md §8` ("content generated FROM the record") | ✅ yes | ❌ not done |
| V06 landing-page reference copy | ✅ yes (manual) | ❌ not in the record store |
| Platform Design templates (landing + single product page) | ✅ yes | ⚠️ single-product only, render-time |
| Content schemas (`landing-page.json` shape, etc.) | ❌ no | ❌ no |
| Content generator tool | ❌ no | ❌ no |
| Publish-manifest `content` slot | ❌ no | ❌ no |
| Publisher bridge landing-page creation | ❌ no | ❌ no (0 "landing" hits in `publisher.php`) |
| QA `g6_content` real check | ❌ no | ❌ false-PASS today |
| Live landing-page surface (template/CPT) | ❌ no | ❌ no |

**Net:** the factory can build 500 products' *delivery systems* automatically, but it currently
builds **zero** of their *sales content* automatically. That is the exact gap the owner named.

---

## 2 · How V06 did it (the reference we must industrialise)

V06 was built manually, but it already demonstrates the target. In `specs/V06/`:

- `V06-landing-page.md` — a **9-section, "WordPress Ingestion Ready"** landing page:
  1. HERO (headline / subheadline / body / CTA / trust line / evidence label)
  2. BEFORE STATE ("she recognises herself here")
  3. WHAT THIS IS (the 13-module breakdown)
  4. TRANSFORMATION (Before → After table)
  5. WHO THIS IS FOR / NOT FOR
  6. THE PROMISE ("what we can responsibly say")
  7. WHAT'S INSIDE (skimmer summary)
  8. CTA (bottom)
  9. NEXT TRANSFORMATION (journey-engine hook)
- `V06-part01…part13` — the 13 asset modules (these became the factory's asset markdown).

And in `Platform Design/` there are **two full HTML design templates**:

- `product landing page.md` (+ `2`, `3` variants) — the persuasive sales page, fully styled on the
  canonical tokens.
- `single product page.md` — the detail/spec page with the numbered section sequence.

**Key observation:** V06's landing page was written *by hand from the same information that now
lives in the product + transformation records.* Every one of its 9 sections maps to a record field
(see §5). That is the proof that this content is **derivable**, and therefore **automatable**.

---

## 3 · What the factory ALREADY has (design is done)

These exist today and are the foundation — nothing here needs inventing:

1. **`schemas/product.schema.json` → `content` block (REQUIRED).** Seven fields:
   `landing_page`, `product_page`, `faq`, `specifications`, `deliverables`, `onboarding`,
   `completion`. Each is `object | string | null` ("pointers/paths to the actual content
   artifacts; existence is checked deterministically — section 14 Content tests").
2. **`agents/copywriter.md` → `@lfe-copywriter`.** Mission: *"Generate ALL customer-facing content
   FROM the records — never from a blank-page prompt — so copy cannot drift from the actual
   transformation."* Declared outputs: `landing-page.json`, `product-page.json`, `faq.json`,
   `specs.json`, `deliverables.json`, `seo.json`, "all written into the product directory."
3. **`standards/copy-standard.md`.** Source-of-truth rule, locked 3-layer title architecture
   (TITLE = situation / SUBTITLE = system / ONE-LINE PROMISE = responsibly-promised outcome),
   voice rules (globally relatable primary voice, cultural specificity as a deliberate second
   door), honesty rules (every claim carries its evidence label, no fabricated testimonials,
   educational trust line), safety-adjacent copy rules (real crisis numbers, no diagnosis, no
   "cure in N days").
4. **`standards/product-standard.md §8`.** *"Content (landing page, product page, FAQ, specs,
   deliverables, SEO) is generated FROM the record by the copy agent, so it cannot drift from the
   actual transformation."*
5. **`@lfe-qa` Tests K/Q/N/R** already reference copy integrity (Q), emotional integrity (N),
   evidence integrity (K), and drift (R) — the review hooks for generated copy already exist.

**Conclusion:** the factory's *paperwork* already says content is a factory output. The *machinery*
was never built.

---

## 4 · What is MISSING (the implementation gap, with evidence)

Verified against the live site (`publisher.php`, theme) and the record store:

1. **No content schemas.** There is no `landing-page.schema.json` / `product-page.schema.json`
   defining the structured shape of the copy artifacts, so nothing can be validated or rendered
   deterministically.
2. **No content generator.** There is no harness tool that runs the copywriter. `@lfe-copywriter`
   is a contract with no runner. No `gen-content.mjs` (or equivalent) exists.
3. **Records carry `null`.** Every `product.json` has
   `content: { landing_page: null, product_page: null, faq: null, … }`. Confirmed in
   `PPL-CORD-CARE-001/product.json` and in the generators that stamp records
   (`harness/backfill-v1.mjs`, `harness/gen-wave1b-products.mjs` both emit all-null content).
4. **No manifest content slot.** `schemas/publish-manifest.schema.json` has
   `product / transformation / assets / commerce / relationships / seo / access / qa /
   publish_authorization` — **no `content` block.** Even if copy were generated, it would never
   reach the publisher.
5. **Publisher creates no landing page.** Live `publisher.php` (17.5 KB) has **0** occurrences of
   "landing". Its functions are: `swt_pb_create_transformation`, `swt_pb_ensure_tsystem`,
   `swt_pb_attach_asset`, `swt_pb_create_product`, `swt_pb_link_situations`, `swt_pb_apply_seo`,
   `swt_pb_publish`. `swt_pb_create_product` sets the Woo product `post_content` to only
   `wp_kses_post( $spec['description'] )`. No landing page, no rich product-page body.
6. **`g6_content` is a false-PASS.** `harness/qa-checks.mjs` checks **asset** content
   (`asset_content_exists`, widget blocks) but has **no check** for `content.landing_page` /
   `content.product_page`. The gate passes because the schema allows null, not because content
   exists.
7. **No live landing surface.** No `page-landing.php` in the theme, no landing CPT among the public
   post types, and **no** `swiipt-core` include mentions "landing". The platform has no place to
   render a landing page today.

**What IS already automated (so we don't rebuild it):**
- **Single product page ≈ 80% built.** The theme renders it **from the records at render time**:
  `woocommerce/single-product.php` (buy box) + `inc/product-details.php` (12.9 KB) assembles the
  locked-order detail sequence (Your Situation → Before/After → What's Included → Journey →
  Check-in plan → TSM → failure points → After completion → evidence note) from TSM / assets /
  journey edges. This is drift-proof by construction.
- **SEO is wired.** `swt_pb_apply_seo` writes the manifest `seo` block to `_rank_math_*` postmeta.

So the real work is: **(a)** generate + store the copy, **(b)** carry it through the manifest,
**(c)** materialise the **landing page** (new surface) and the authored product-page bits, and
**(d)** make `g6_content` a real gate.

---

## 5 · Proof the content is derivable from the records

Every V06 landing-page section maps to a field that already exists in `product.json` /
`transformation.json`. This is why the factory can generate it for 500 products with no
hand-authoring:

| Landing section (V06) | Source record field(s) | Deterministic? |
|---|---|---|
| 1 Hero headline | `identity.name` | ✅ |
| 1 Hero subheadline | `identity.subtitle` | ✅ |
| 1 Hero body (2–3 sentences) | `customer.situation` + `customer.emotional_stake` + `identity.one_line_promise` | 🟡 AI-framed from record |
| 1 CTA + price | `commerce.price` + `commerce.currency_rules` | ✅ |
| 1 Trust line | `safety.disclaimer` | ✅ |
| 1 Evidence label | `evidence.review_status` + evidence-label taxonomy | ✅ |
| 2 Before state | `transformation.before_state` + `customer.situation` | 🟡 AI-framed from record |
| 3 Module breakdown | `asset_map` (read/do/decide/track/communicate/rescue…) → asset titles | ✅ |
| 4 Before → After table | `transformation.before_state` → `transformation.after_state` | ✅ |
| 5 Who for / not for | `customer.target_person` + `customer.constraints` + `safety.red_flags` | ✅ / 🟡 |
| 6 The promise | `identity.one_line_promise` + `evidence` + `safety.disclaimer` | 🟡 AI-framed, honesty-gated |
| 7 What's inside | `asset_map` summary | ✅ |
| 8 Bottom CTA | `commerce.price` | ✅ |
| 9 Next transformation | `transformation.next_transformation_ids` | ✅ |

✅ = fully deterministic from the record. 🟡 = AI (copywriter) composes the *prose*, but only from
record fields, and it is reviewed by QA Tests Q/N/R for drift and honesty.

**The same mapping feeds the single product page** (hero copy + short description from `identity`
+ `one_line_promise`; the rest is already assembled at render time by `inc/product-details.php`).

---

## 6 · Proposed architecture — content as a first-class factory stage

Content becomes stage **#5.5** in the pipeline, sitting between asset authoring and manifest
generation, and flows through the same record → QA → manifest → publisher spine as everything else.

```
opportunity → transformation → product → assets → [CONTENT] → manifest → publisher → WordPress
                                                     │
                                    @lfe-copywriter (gen-content)
                                    deterministic skeleton from records
                                    + AI narrative (reviewed by QA Q/N/R)
```

### Component 1 — Content schemas (new files)
- `schemas/content-landing.schema.json` — structured landing page: `hero{headline,subheadline,body,
  cta,trust_line,evidence_label}`, `before_state`, `modules[]`, `before_after[]`, `who_for{for[],
  not_for[]}`, `promise{we_do,we_do_not,evidence_label}`, `inside[]`, `final_cta`, `next[]`.
- `schemas/content-product-page.schema.json` — authored product-page bits: `hero`, `short_description`,
  `situation_block` (the rest stays render-time).
- `schemas/content-faq.schema.json` — `faq[]{q,a,evidence_label}`.
- All enforce copy-standard honesty rules structurally (evidence label required on claim fields,
  trust line required, no rating/review fields).

### Component 2 — Content generator (new harness tool)
- `harness/gen-content.mjs` — the copywriter runner. For a product id it:
  1. Reads `product.json` + linked transformation record + asset records + evidence.
  2. Builds the **deterministic skeleton** (module list, before→after, who-for, price, trust line,
     next transformations) straight from record fields.
  3. Fills the **narrative slots** (hero body, before-state story, promise prose). Phase 1 uses
     record-derived templates; Phase 3 hands these slots to the `@lfe-copywriter` AI for richer
     prose, still constrained to record fields.
  4. Writes `copy/landing-page.json`, `copy/product-page.json`, `copy/faq.json` into the product
     directory and updates `product.json.content.*` to point at them.
- **New dir convention:** `data/products/<ID>/copy/` for marketing/sales copy artifacts — kept
  distinct from `content/` (which holds the *asset deliverable* markdown).

### Component 3 — Record + manifest plumbing
- `product.json.content.*` changes from `null` → path pointers (e.g. `"landing_page": "copy/landing-page.json"`).
- `schemas/publish-manifest.schema.json` gains a required **`content`** block carrying
  `landing_page` + `product_page` (+ optional faq) so the publisher receives them.
- `harness/build-manifest.mjs` inlines the copy artifacts (same pattern it already uses to inline
  asset source content).

### Component 4 — Publisher bridge (live `publisher.php`)
- New `swt_pb_create_landing_page( $manifest )` — creates the landing page in WordPress from the
  structured content (idempotent via a `_swiipt_manifest_pid`-style meta, like the rest of the
  bridge).
- Extend `swt_pb_create_product` to write the product's **hero copy + short description** from
  `content.product_page` (not just the bare description).
- Wire the landing page ↔ product relationship (landing links to product/buy; product links back).

### Component 5 — Real QA content gate
- `harness/qa-checks.mjs` gains deterministic `g6_content` checks: landing/product-page artifacts
  exist + validate against schema + required sections present + every claim field carries an
  evidence label + trust line present + no fabricated testimonial/rating fields. A product cannot
  reach `READY_TO_PUBLISH` with empty content.

### Component 6 — Live landing surface (theme)
- A landing-page render target: either a `page-landing.php` template (landing pages as WP `page`
  posts) **or** a dedicated landing CPT. It renders the structured content on the canonical
  `swt-tokens.css` layer using the `product landing page.md` design. **Owner decides the model (§9).**

---

## 7 · Deterministic vs AI split (why this scales to 500)

- **Deterministic (from records):** module list, before→after table, who-for, price, trust line,
  evidence labels, next transformations, inside-summary. → **Zero per-product manual work.**
- **AI-authored (copywriter, constrained + reviewed):** hero body, before-state narrative, promise
  prose. Generated from `customer.situation` / `emotional_stake` / `before_state`, then checked by
  QA Tests **Q** (copy integrity), **N** (emotional integrity), **R** (drift). → **Minutes per
  product, reviewable, drift-proof.**

This is exactly the factory's existing philosophy applied to copy: *"generated FROM the record —
never from a blank-page prompt — so it cannot drift."* Automation removes the labour; QA + the
evidence-label rules keep the governance.

---

## 8 · Phased build plan

**Phase 1 — Deterministic content engine (scales immediately).**
- Write the 3 content schemas.
- Build `gen-content.mjs` producing the deterministic skeleton + record-derived template prose.
- Add `copy/` artifacts + point `product.json.content.*` at them.
- Add real `g6_content` QA checks.
- *Deliverable: every product gets a valid, honest, schema-checked landing + product-page content
  block with no AI and no hand-work.*

**Phase 2 — Publish path + live surface.**
- Add `content` block to publish-manifest schema + `build-manifest.mjs` inlining.
- Add `swt_pb_create_landing_page` + product hero/short-description to `publisher.php`.
- Build the landing render target in the theme (per owner's §9 choice).
- *Deliverable: publishing a product automatically creates its live landing page + enriched product page.*

**Phase 3 — AI narrative layer (the copywriter's real job).**
- Hand the narrative slots (hero body, before-state story, promise prose) to `@lfe-copywriter`,
  constrained to record fields, reviewed by QA Q/N/R.
- *Deliverable: V06-grade persuasive copy, generated, not hand-written.*

**Phase 4 — Backfill + remaining artifacts.**
- Port V06's existing manual landing page into `copy/landing-page.json` (it becomes the golden
  reference the generator is tuned against).
- Generate content for the 4 wave products + 4 PP products.
- Add `faq` / `specs` / `onboarding` / `completion` artifacts.

---

## 9 · Decisions needed from the owner

1. **Landing-page model.** Separate WP page per product (e.g. `/go/<slug>/`) linked to the Woo
   product, OR make the landing page the product's primary public URL? *(Recommendation: separate
   landing page per product; keep the Woo product page as the detail/buy surface — matches the two
   distinct Platform Design docs.)*
2. **Deterministic-first vs AI-first.** *(Recommendation: Phase 1 deterministic skeleton first so
   all 500 can be content-complete immediately; layer AI narrative in Phase 3.)*
3. **Copy artifact location.** *(Recommendation: `data/products/<ID>/copy/`, distinct from `content/`
   asset deliverables.)*
4. **Backfill order.** *(Recommendation: V06 first — it already has a hand-written landing page to
   port and becomes the reference standard — then wave products, then PP products.)*

---

## 10 · Recommendation

Build **Phase 1 now**: the deterministic content engine + schemas + real `g6_content` gate. It is
the highest-leverage step because it makes *every current and future product* content-complete with
zero per-product labour, which is precisely the 500-product concern the owner raised. Phase 2 makes
that content go live; Phase 3 makes it sing; Phase 4 cleans up the existing catalog.

The factory already has the contracts, standards, schema slot, and design templates. It only needs
the machinery. This plan is that machinery.

---

## Appendix A — Evidence index (files inspected)

**Factory (`Product Pipeline/`):**
- `schemas/product.schema.json` — `content` block (7 required fields, all nullable).
- `schemas/publish-manifest.schema.json` — no `content` block.
- `agents/copywriter.md` — copywriter contract (outputs declared, no runner).
- `standards/copy-standard.md`, `standards/product-standard.md` (§8).
- `harness/qa-checks.mjs` — asset-content checks only, no landing/product-page checks.
- `harness/build-manifest.mjs`, `harness/backfill-v1.mjs`, `harness/gen-wave1b-products.mjs` —
  all stamp `content` as null.
- `data/products/PPL-CORD-CARE-001/` — `product.json` + `content/` (asset md) + `assets/` + `publish/`;
  `content.landing_page = null`.
- `data/products/PPL-NIGHT-SHIFT-001/` — `product.json` only (thin V06 backfill record).
- `specs/V06/V06-landing-page.md` — the 9-section manual landing page.

**Platform Design:**
- `product landing page.md` (+2, +3) — landing page HTML design.
- `single product page.md` — single product page HTML design.

**Live (`swiipt.com`):**
- `publisher.php` — 0 "landing" hits; functions listed in §4; `swt_pb_apply_seo` present;
  product `post_content` = short description only; tsystem `post_content` = system shortcode.
- Theme — `woocommerce/single-product.php` (6.1 KB) + `inc/product-details.php` (12.9 KB) present;
  `page-landing.php` MISSING; no landing CPT.
- `swiipt-core/includes/*` — no file mentions "landing".
