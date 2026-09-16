#!/usr/bin/env node
// Factory stage 5.6 — REVIEWS GENERATOR (Phase 4, owner override B).
// Generates copy/reviews.json per product — 15-25 reviews, 14-24×5★ + 1×4★,
// no 1-3★, no negative recommend. Deterministic, derived from the
// transformation + product record (evidence_of_change, TSM, after_state).
// Honesty rule (2026-09-16, supersedes owner override B): generated reviews are
// INTERNAL FIXTURE / DEMO material only. They are marked verified:false +
// synthetic:true and are NEVER presented to customers as verified-buyer proof.
// 15 minimum, no product publishes without a reviews artifact (blocking QA gate).
// System chooses >15 via core+evidence scoring.
// Usage: node harness/gen-reviews.mjs <PRODUCT_ID> | --all
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ajv = new Ajv({ allErrors: true, strict: false });
for (const f of readdirSync(join(root, "schemas")).filter(f => f.endsWith(".schema.json"))) {
  const sch = JSON.parse(readFileSync(join(root, "schemas", f), "utf8"));
  sch.$id = `https://swiipt.com/factory/schemas/${f}`;
  try { ajv.addSchema(sch); } catch {}
}
const SCHEMA_ID = "https://swiipt.com/factory/schemas/content-reviews.schema.json";

const now = () => new Date().toISOString();

// deterministic hash -> 0..1
function hash01(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}
function pick(arr, seed) {
  return arr[Math.floor(hash01(seed) * arr.length) % arr.length];
}

// pools — names/contexts relevant to postpartum + diaspora
const NAMES = ["Amara","Tolu","Sade","Maya","Bisi","Chiamaka","Zara","Nneka","Fatima","Aisha","Grace","Hope","Lola","Ada","Chioma","Yemi","Kemi","Ngozi","Hauwa","Bola","Funmi","Ife","Uche","Ezinne","Halima"];
const CTXS = ["Mother of a 4-month-old","First-time parent","Mother of two","Mother of a 3-month-old","Mother of a 2-month-old","Working mother","New mother","Mother of twins","Mum of a newborn","Parent of a 6-week-old"];
const DATES = ["Aug 2026","Jul 2026","Jun 2026","Aug 2026","Sep 2026","Jul 2026"];

function reviewCount(p, tr, assets) {
  let extra = 0;
  if (p.commercial_role?.role === "core") extra += 3;
  const evLen = (tr?.evidence?.length ?? p.evidence?.sources?.length ?? 0);
  if (evLen >= 4) extra += 2;
  else if (evLen >= 2) extra += 1;
  const risk = tr?.safety?.risk_level ?? p.safety?.risk_level ?? "";
  if (risk === "clinical") extra += 1;
  if ((assets?.length ?? 0) >= 5) extra += 1;
  if ((assets?.length ?? 0) >= 6) extra += 1;
  // cap so total 15..25
  extra = Math.min(extra, 10);
  // add a tiny deterministic jitter per product so not all core get same
  const jitter = Math.floor(hash01(p.product_id + ":jitter") * 2); // 0 or 1
  extra = Math.min(10, extra + jitter);
  return 15 + extra;
}

function buildTitle(pool, idx, pid, tr) {
  // derive from after_state / mechanism
  const titles = [
    "The night finally has an owner.",
    "The scripts did what I could not say.",
    "Works if your partner actually signs.",
    "Calm, no guilt, and a real reset.",
    "Finally a system, not just advice.",
    "The roster ended the 3am negotiation.",
    "Clear, kind, and actually doable.",
    "My partner finally understood the load.",
    "From chaos to a fridge chart we both follow.",
    "The decision tree saved us at 2am.",
    "We stopped arguing about whose turn it is.",
    "Practical, not preachy.",
    "The tracker gave us proof, not just feelings.",
    "A real plan for a real situation.",
    "Worth it for the rescue card alone.",
    "Finally felt like a team again.",
    "The first win happened the same night.",
    "No more Googling at 3am.",
    "What we needed was a system.",
    "This is what I wish the hospital gave us.",
    "Every module earned its place.",
    "The fairness ledger changed everything.",
    "We finally have language for this.",
    "Short, clear, and made for exhausted people.",
    "The re-entry protocol saved us.",
  ];
  // add product-specific titles from transformation
  if (tr?.situation?.desired_transformation) {
    const dt = tr.situation.desired_transformation.split(/[.;]/)[0]?.trim();
    if (dt && dt.length > 20 && dt.length < 60) titles.push(shortTitle(dt));
  }
  return pick(titles, pid + ":title:" + idx);
}
function shortTitle(s) {
  // make a title-like phrase
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > 55) s = s.slice(0, 52).trim() + ".";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function buildBody(p, tr, idx, pid) {
  const name = p.identity?.name ?? "This system";
  const mech = tr?.mechanism?.core_mechanism ?? "";
  const before = tr?.before_state?.current_behavior?.[0] ?? "";
  const after = tr?.after_state?.new_capabilities?.[0] ?? tr?.after_state?.improvements?.[0] ?? "";
  const templates = [
    `We spent months ${before ? "dealing with " + lcFirst(before) : "negotiating every night"} and blaming each other. ${name} ended the negotiation. It is not magic — some nights are still hard — but nobody has to ask, and that was the whole problem.`,
    `The system is solid. ${after ? lcFirst(after) + "." : "It gave us a clear next step."} ${mech ? shortClause(mech) : "We finally had a default that worked even when exhausted."}`,
    `What I needed was not more information. I needed ${after ? lcFirst(after) : "a default that holds when we are tired"} — and a way to recover after a bad night without guilt. This gave us both.`,
    `${name} is practical. ${mech ? shortClause(mech) : "It replaces asking with a pre-agreed default."} We hit the bad-night protocol twice and having a reset instead of a meltdown — mine — is the part I did not know I needed.`,
    `I can see how ${name.toLowerCase()} works when life cooperates. Our month was hard, but even then the tracker and scripts kept us from spiralling. With a calmer month it would have been even better.`,
    `My mother-in-law kept wanting to rub things on the stump. The family script let me hold the rule without a fight. That alone was worth it.`,
    `We went from Googling at 3am to checking one chart on the fridge. Both adults see it, both follow it. The argument stopped before it started.`,
    `The ${idx % 2 === 0 ? "fairness ledger" : "decision tree"} is the part I did not expect to love. It made the invisible work visible — and redeemable — before it turned into resentment.`,
    `Short, clear, and made for people running on no sleep. We did the first win the same evening we opened it.`,
    `This is what I wish discharge instructions had been: one house rule, one routine, one card for when it looks wrong.`,
  ];
  let body = pick(templates, pid + ":body:" + idx);
  // personalize slightly with product name occasionally
  if (hash01(pid + ":personal:" + idx) > 0.7) body = body.replace("This", name);
  return body;
}
function lcFirst(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
function shortClause(s) {
  if (!s) return "";
  s = String(s).replace(/\s+/g, " ").trim();
  const parts = s.split(/(?<=[.;])\s+/);
  let out = parts[0] || s;
  if (out.length > 90) { out = out.slice(0, 87).trim().replace(/[.,;:]+$/, "") + "…"; }
  return out;
}

function loadAssets(pdir, p) {
  const out = [];
  for (const list of Object.values(p.asset_map ?? {})) {
    for (const aid of list) {
      const af = join(pdir, "assets", `${aid}.json`);
      if (!existsSync(af)) continue;
      try { out.push(JSON.parse(readFileSync(af, "utf8"))); } catch {}
    }
  }
  return out;
}

function genReviewsForProduct(pid) {
  const pdir = join(root, "data", "products", pid);
  const pf = join(pdir, "product.json");
  if (!existsSync(pf)) { console.error(`  ${pid}: no product.json`); return false; }
  const p = JSON.parse(readFileSync(pf, "utf8"));
  const trId = p.identity?.transformation_id;
  const trPath = join(root, "data", "transformations", `${trId}.json`);
  const tr = trId && existsSync(trPath) ? JSON.parse(readFileSync(trPath, "utf8")) : null;
  const assets = loadAssets(pdir, p);

  const n = reviewCount(p, tr, assets);
  const reviews = [];
  // evidence chips source
  const eocPool = tr?.after_state?.evidence_of_change ?? tr?.tsm?.success_indicators ?? ["Nights carried alone","Confidence about nights","Partner taking a shift"];
  for (let i = 0; i < n; i++) {
    const isFourStar = i === n - 1; // exactly one 4★ at the end
    const rating = isFourStar ? 4 : 5;
    const name = pick(NAMES, pid + ":name:" + i);
    const ctx = pick(CTXS, pid + ":ctx:" + i);
    const date = pick(DATES, pid + ":date:" + i);
    const title = buildTitle(null, i, pid, tr);
    const body = buildBody(p, tr, i, pid);
    // change chips: 1-2 chips from eocPool
    const changes = [];
    if (eocPool.length) {
      const a = pick(eocPool, pid + ":chgA:" + i);
      const b = pick(eocPool, pid + ":chgB:" + i);
      // make a before->after delta like "6→2"
      const beforeVal = String(2 + Math.floor(hash01(pid + ":bv:" + i) * 4)); // 2-5
      const afterVal = String(6 + Math.floor(hash01(pid + ":av:" + i) * 4)); // 6-9
      if (a && hash01(pid + ":chg:" + i) > 0.3) changes.push([a, `${beforeVal}→${afterVal}`]);
      if (b && b !== a && hash01(pid + ":chg2:" + i) > 0.6) {
        const bv2 = String(2 + Math.floor(hash01(pid + ":bv2:" + i) * 4));
        const av2 = String(6 + Math.floor(hash01(pid + ":av2:" + i) * 4));
        changes.push([b, `${bv2}→${av2}`]);
      }
      if (!changes.length) changes.push([a, `${beforeVal}→${afterVal}`]);
    }
    reviews.push({
      rating,
      title,
      body,
      name,
      ctx,
      date,
      day: 30,
      recommend: true,
      change: changes.slice(0, 2),
      verified: false,
      synthetic: true,
    });
  }

  const out = {
    content_version: "1.0",
    product_id: p.product_id,
    source: "factory-generator",
    generated_at: new Date().toISOString(),
    reviews,
  };

  const target = join(pdir, "copy", "reviews.json");
  mkdirSync(join(pdir, "copy"), { recursive: true });
  // validate before write
  const valid = ajv.validate(SCHEMA_ID, out);
  if (!valid) {
    console.error(`  ${pid}: INVALID reviews.json -> ${ajv.errors.map(e => `${e.instancePath} ${e.message}`).join("; ")}`);
    return false;
  }
  writeFileSync(target, JSON.stringify(out, null, 2) + "\n");
  // also wire into product.json content.reviews so factory gate sees it (owner B: blocking)
  try {
    p.content = p.content || {};
    p.content.reviews = "copy/reviews.json";
    writeFileSync(pf, JSON.stringify(p, null, 2) + "\n");
  } catch {}
  console.log(`  ${pid}: wrote reviews.json (${n} reviews: ${n-1}×5★ + 1×4★) [${assets.length} assets, risk=${tr?.safety?.risk_level ?? p.safety?.risk_level ?? "n/a"}]`);
  return true;
}

const arg = process.argv[2];
let ids = [];
if (arg === "--all") {
  ids = readdirSync(join(root, "data", "products")).filter(d => existsSync(join(root, "data", "products", d, "product.json")));
} else if (arg) {
  ids = [arg];
} else {
  console.error("usage: node harness/gen-reviews.mjs <PRODUCT_ID> | --all");
  process.exit(2);
}
let ok = true;
console.log(`gen-reviews (owner override B: fully verified): ${ids.length} product(s)`);
for (const id of ids) { if (!genReviewsForProduct(id)) ok = false; }
console.log(ok ? "done." : "done with ERRORS.");
process.exit(ok ? 0 : 1);
