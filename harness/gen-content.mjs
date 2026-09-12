#!/usr/bin/env node
// Factory stage 5.5 - CONTENT GENERATOR (copywriter runner, deterministic Phase 1).
// Generates copy/landing-page.json + copy/product-page.json + copy/faq.json FROM the
// product + transformation + asset records - never from a blank page - per
// standards/copy-standard.md and schemas/content-*.schema.json.
//
// Deterministic vs AI split (owner-approved 2026-08-26):
//   - DETERMINISTIC (this tool): module list, before/after, who-for, promise facts,
//     evidence labels, trust line, next transformations, price/CTA, inside summary.
//   - AI (Phase 3, @lfe-copywriter): the narrative slots (hero body, before-state story,
//     promise prose) - still constrained to record fields, reviewed by QA Tests Q/N/R.
//
// Honesty rule: the generator NEVER fabricates. Every field is derived from a record
// field; where a record is thin the output is thin-but-valid (sections that cannot be
// filled honestly are omitted, never invented).
//
// Reference protection: an existing artifact whose source === "manual-port" (the V06
// reference) is never overwritten.
//
// Usage: node harness/gen-content.mjs <PRODUCT_ID> | --all
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020.js";
import { enrichContent, provider } from "./copywriter.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// --- schema pool for self-validation (never write an invalid artifact) ---
const ajv = new Ajv({ allErrors: true, strict: false });
for (const f of readdirSync(join(root, "schemas")).filter(f => f.endsWith(".schema.json"))) {
  const sch = JSON.parse(readFileSync(join(root, "schemas", f), "utf8"));
  sch.$id = `https://swiipt.com/factory/schemas/${f}`;
  try { ajv.addSchema(sch); } catch (e) { /* already added */ }
}
const SCHEMA = {
  "landing-page.json": "https://swiipt.com/factory/schemas/content-landing.schema.json",
  "product-page.json": "https://swiipt.com/factory/schemas/content-product-page.schema.json",
  "faq.json": "https://swiipt.com/factory/schemas/content-faq.schema.json",
};
const KEY = { "landing-page.json": "landing_page", "product-page.json": "product_page", "faq.json": "faq" };

// --- small helpers ---
const now = () => new Date().toISOString();
const lcFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
function joinList(arr) {
  if (!arr || !arr.length) return "";
  const items = arr.map(lcFirst);
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
// take the first clause of a sentence, capped at max chars at a word boundary (headline-safe)
function shortClause(s, max = 70) {
  if (!s) return "";
  s = String(s).replace(/\s+/g, " ").trim();
  const parts = s.split(/(?<=[.;])\s+/);
  let out = parts[0] || s;
  if (out.length > max) {
    out = out.slice(0, max);
    const sp = out.lastIndexOf(" ");
    if (sp > 30) out = out.slice(0, sp);
    out = out.replace(/[.,;:]+$/, "").trim() + "…";
  }
  return out;
}
// a short, readable situation noun for headlines. Known-map per submarket slug;
// any unknown id deterministically returns "situation" (never un-parsed slug tokens,
// so grammar is always safe at scale). Map entries MUST be singular-safe.
function situationNoun(sub) {
  const known = {
    "newborn-hygiene-cord-care": "cord care",
    "c-section-immediate-recovery": "c-section recovery",
    "grandparents-family-boundaries": "family dynamic",
    "return-to-work-transition": "return to work",
    "postpartum-night-shift": "night shift",
  };
  return known[sub] || "situation";
}
// bundle-aware source reader (whole file "content/x.md" or section "content/bundle.md#section.md")
function readSource(pdir, sourcePath) {
  let filePart = sourcePath, section = null;
  const ix = sourcePath.indexOf("#");
  if (ix >= 0) { filePart = sourcePath.slice(0, ix); section = sourcePath.slice(ix + 1); }
  const full = join(pdir, filePart);
  if (!existsSync(full)) return "";
  const raw = readFileSync(full, "utf8");
  if (!section) return raw;
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lines = raw.split(/\r?\n/);
  const startRe = new RegExp("^=====FILE\\s+" + esc(section) + "\\s*=====$");
  let start = -1;
  for (let i = 0; i < lines.length; i++) { if (startRe.test(lines[i].trim())) { start = i; break; } }
  if (start < 0) return "";
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) { if (/^=====FILE\s+.*=====$/.test(lines[i].trim())) { end = i; break; } }
  return lines.slice(start + 1, end).join("\n");
}
// honest evidence label derived from the record's actual evidence basis
function evidenceLabel(p, tr) {
  const ev = tr?.evidence ?? [];
  const sourced = ev.filter(e => e.status === "sourced_evidence").length;
  const basis = sourced > 0 ? "sourced research and clinical guidance" : "practical and lived experience";
  return `Educational content informed by ${basis}. It is not a substitute for medical, clinical, or mental-health assessment.`;
}
const trustLine = (p) => p.safety?.disclaimer || "Educational content - not medical, clinical, or mental-health advice.";
const FORMAT_KIND = {
  guide: "Guide", magazine: "Read", article: "Read", audio: "Audio", workbook: "Workbook",
  interactive_flow: "Interactive", checklist: "Checklist", decision_tree: "Decision Tree",
  quiz: "Quiz", rules_engine: "Rules", tracker: "Tracker", dashboard: "Dashboard", log: "Log",
  calculator: "Calculator", scripts: "Scripts", templates: "Templates", emergency_card: "Rescue Card",
  protocol: "Protocol", restart_protocol: "Re-entry", maintenance_system: "Maintenance",
  quick_reference_card: "Quick Reference",
};
const KIND_ICON = {
  "Guide": "roadmap", "Read": "argument", "Decision Tree": "decision", "Checklist": "checklist",
  "Tracker": "tracker", "Scripts": "scripts", "Rescue Card": "rescue", "Re-entry": "reentry",
  "Rules": "guardrails", "Templates": "rosters", "Maintenance": "reentry", "Protocol": "rescue",
  "Quick Reference": "fridge", "Interactive": "finder", "Log": "tracker", "Workbook": "rosters",
  "Quiz": "finder", "Calculator": "banker", "Audio": "scripts", "Dashboard": "tracker",
};
function kindIcon(kind) { return KIND_ICON[kind] || "check"; }
// short honest description for a module, taken from the asset's own source (first clean prose line)
function assetDescription(pdir, sourcePath) {
  if (!sourcePath) return "";
  const raw = readSource(pdir, sourcePath);
  for (const ln of raw.split(/\r?\n/)) {
    const t = ln.trim();
    if (!t) continue;
    if (/^(#|\[\[|\||>|-|\*|\d+\.)/.test(t)) continue; // heading / widget token / table / quote / list
    if (/^[A-Z_]{2,}:/.test(t)) continue;               // widget directive (TITLE:, ROUTE:, SCRIPT:, ...)
    if (/_{3,}/.test(t)) continue;                       // form-fill blanks
    if (/^[A-Z0-9 &,'.-]+$/.test(t)) continue;           // all-caps heading line
    return t.replace(/\*\*/g, "").replace(/\*/g, "").slice(0, 180);
  }
  return "";
}
function loadAssets(pdir, p) {
  const out = [];
  for (const list of Object.values(p.asset_map ?? {})) {
    for (const aid of list) {
      const af = join(pdir, "assets", `${aid}.json`);
      if (!existsSync(af)) continue;
      try { out.push(JSON.parse(readFileSync(af, "utf8"))); } catch (e) { /* skip bad record */ }
    }
  }
  return out;
}
// resolve a next-transformation id to a title (+ product id if one is published for it)
function resolveNext(tid) {
  let title = tid, pid = null;
  const trf = join(root, "data", "transformations", `${tid}.json`);
  if (existsSync(trf)) {
    try { const t = JSON.parse(readFileSync(trf, "utf8")); title = t?.situation?.desired_transformation ?? tid; } catch (e) { /* keep tid */ }
  }
  const pdirRoot = join(root, "data", "products");
  for (const d of readdirSync(pdirRoot)) {
    const pf = join(pdirRoot, d, "product.json");
    if (!existsSync(pf)) continue;
    try {
      const pp = JSON.parse(readFileSync(pf, "utf8"));
      if (pp.identity?.transformation_id === tid) { pid = pp.product_id; title = pp.identity.name; break; }
    } catch (e) { /* skip */ }
  }
  const item = { title, transformation_id: tid };
  if (pid) item.product_id = pid;
  // short code chip: second segment of product_id (e.g. "PPL-CS-FIRST14DAYS-001" -> "CS")
  if (pid) {
    const segs = pid.split("-");
    item.code = segs[1] || "";
  } else if (tid) {
    const segs = tid.replace(/^TR-?/, "").split("-");
    item.code = segs[0] || "";
  }
  return item;
}

// --- generators ---
function heroBody(p, tr) {
  const sit = tr?.situation?.specific_situation || p.customer?.situation || "";
  const clean = sit && !/^backfilled/i.test(sit) ? `${sit}. ` : "";
  return `${clean}${p.identity.one_line_promise}`;
}

// Hero artifact (Fridge Chart style data card) generated per-product from the record.
// The right column is always present; content derives from transformation.path stages
// (fallback: assets). V06's manual-port artifact is never overwritten (source check).
function generateArtifact(p, tr, assets) {
  const name = p.identity.name;
  const sub = p.identity.subtitle || p.identity.one_line_promise || "";
  const path = tr?.transformation?.path ?? tr?.situation?.path ?? p.transformation?.path ?? [];
  const firstWin = p.transformation?.first_win ?? tr?.first_win ?? null;

  let rows = [];
  if (path.length) {
    rows = path.slice(0, 6).map((s, i) => ({
      day: String(i + 1).padStart(2, "0"),
      night: { label: s.stage || "", variant: i % 2 ? "split" : "partner" },
      sleep: { label: s.objective || "", variant: i % 2 ? "you-off" : "split" },
    }));
  } else if (assets.length) {
    rows = assets.slice(0, 6).map((a, i) => ({
      day: String(i + 1).padStart(2, "0"),
      night: { label: a.title || "", variant: i % 2 ? "split" : "partner" },
      sleep: { label: FORMAT_KIND[a.format] ?? a.format, variant: i % 2 ? "you-off" : "split" },
    }));
  }

  const legend = [
    { swatch: "p", label: "Core plan" },
    { swatch: "o", label: "Do it today" },
    { swatch: "s", label: "When things shift" },
  ];

  let float_script = null;
  const scriptAsset = assets.find(a => /script/i.test(a.format || "") || /script/i.test(a.title || ""));
  if (scriptAsset) {
    float_script = { label: scriptAsset.title, text: sub };
  }

  let float_ledger = null;
  if (firstWin) {
    float_ledger = { bold: firstWin.action || "", small: `First win within ${firstWin.within || "the first step"}` };
  }

  return {
    head_label: `${rows.length} steps \u00b7 ${name}`,
    sub,
    table_label: `${name} - at a glance`,
    header: ["Your plan", "What it does"],
    rows,
    legend,
    float_script,
    float_ledger,
  };
}

// --- recommend composition (Phase 3, spec §16) ---
// Deterministic selection from product metadata. Manual override wins first.
// Returns { name, reason }.
function recommendComposition(p, tr, assets) {
  // 0) Manual override from the product record (design.landing_composition).
  const override = p?.design?.landing_composition;
  if (override && ["standard", "decision", "behavior_change"].includes(override)) {
    return { name: override, reason: `manual override (${override})` };
  }

  // 1) Collect signals from the asset map + transformation record.
  const fmts = (assets || []).map(a => String(a.format || "").toLowerCase());
  const titles = (assets || []).map(a => String(a.title || "").toLowerCase());
  const hasDecisionTree = fmts.some(f => /decision|quiz|rules/i.test(f)) || titles.some(t => /decision|quiz/i.test(t));
  const hasTracker = fmts.includes("tracker") || titles.some(t => /tracker|timeline|log/i.test(t));
  const hasChecklist = fmts.includes("checklist");
  const hasScripts = fmts.includes("scripts");
  const hasRescue = fmts.some(f => /emergency|rescue|protocol/i.test(f));
  const failureCount = tr?.failure_point_map?.length ?? 0;
  const pathLen = tr?.transformation_path?.length ?? 0;
  const risk = tr?.safety?.risk_level ?? p?.safety?.risk_level ?? "";

  // 2) Scores.
  let decision = 0;
  let behavior = 0;
  if (hasDecisionTree) decision += 2;
  if (hasTracker) behavior += 1;
  if (hasChecklist) behavior += 1;
  if (hasScripts) behavior += 1;
  if (hasRescue) behavior += 1;
  if (failureCount >= 4) behavior += 1;
  if (pathLen >= 5) behavior += 1;

  // 3) Clinical risk → safety-first: keep `standard` unless strongly decision-driven.
  if (risk === "clinical") {
    if (decision >= 3) return { name: "decision", reason: `clinical + decision-tree heavy (decision=${decision})` };
    return { name: "standard", reason: `clinical risk (${risk}) — safety-first standard` };
  }

  // 4) Otherwise pick the higher score; ties → standard (backward compatible).
  if (decision > behavior && decision >= 2) return { name: "decision", reason: `decision-tree heavy (decision=${decision}, behavior=${behavior})` };
  if (behavior > decision && behavior >= 2) return { name: "behavior_change", reason: `behavior-change toolkit (behavior=${behavior}, decision=${decision})` };
  return { name: "standard", reason: `balanced (decision=${decision}, behavior=${behavior})` };
}

function genLanding(p, tr, assets, pdir) {
  const name = p.identity.name;
  const promise = p.identity.one_line_promise;
  const trust = trustLine(p);
  const evLabel = evidenceLabel(p, tr);
  const sit = tr?.situation ?? {};
  const bs = tr?.before_state ?? {};
  const as = tr?.after_state ?? {};
  const noun = situationNoun(tr?.submarket_id);
  const rec = recommendComposition(p, tr, assets);

  const landing = {
    content_version: "1.0",
    product_id: p.product_id,
    source: "factory-generator",
    generated_at: now(),
    page: { composition: rec.name },
    hero: {
      headline: name,
      subheadline: p.identity.subtitle,
      body: heroBody(p, tr),
      cta_label: "Get the System",
      trust_line: trust,
      evidence_label: evLabel,
      artifact: generateArtifact(p, tr, assets),
    },
  };

  // SECTION 2 - before state (from transformation.before_state) + right-column timeline.
  // Right column = data-driven navy card from the record (no clock times). Headline = reframe.
  const paras = [];
  if (bs.current_behavior?.length) paras.push(`Right now you are ${joinList(bs.current_behavior)}.`);
  if (bs.emotional_state?.length) paras.push(`It feels like ${joinList(bs.emotional_state)}.`);
  if (bs.practical_consequences?.length) paras.push(`The cost: ${joinList(bs.practical_consequences)}.`);
  landing.before_state = {
    label: "Sound familiar?",
    headline: `It is not that you are failing. The ${noun} just has no system.`,
  };
  if (paras.length) {
    landing.before_state.paragraphs = paras;
    if (tr?.mechanism?.core_mechanism) {
      landing.before_state.punch = `This is not a personal failing. It is a system gap - and ${name} closes it.`;
    }
  }
  // timeline ticks from the record's own escalation: behavior -> emotion -> cost
  const ticks = [];
  for (const b of bs.current_behavior ?? []) ticks.push({ text: b, alert: false });
  for (const e of bs.emotional_state ?? []) ticks.push({ text: e, alert: true });
  for (const c of bs.practical_consequences ?? []) ticks.push({ text: c, alert: false });
  if (ticks.length) {
    landing.before_state.timeline = {
      label: `What ${noun} actually looks like`,
      ticks: ticks.slice(0, 6),
      note: "None of this is a character flaw. It is a system gap - and the system below closes it.",
    };
  }

  // SECTION 3 - modules (from asset_map -> asset records)
  if (assets.length) {
    landing.modules = {
      label: `What ${name} gives you`,
      headline: `${assets.length} modules. One written system.`,
      intro: "Work through them in order, or jump straight to what today needs. Each module stands alone - together they form one system.",
      items: assets
        .map(a => ({ title: a.title, kind: FORMAT_KIND[a.format] ?? a.format, description: assetDescription(pdir, a.source_path), icon: kindIcon(FORMAT_KIND[a.format] ?? a.format) }))
        .filter(m => m.title),
    };
  }

  // SECTION 4 - before/after (from transformation.before_state -> after_state)
  const beforeItems = [...(bs.current_behavior ?? []), ...(bs.current_conditions ?? []), ...(bs.emotional_state ?? [])].slice(0, 6);
  const afterItems = [...(as.new_capabilities ?? []), ...(as.improvements ?? []), ...(as.systems_created ?? [])].slice(0, 6);
  landing.before_after = {
    label: "What changes",
    headline: `Before the ${noun}. After the ${noun}.`,
    intro: "The change is structural. You are not trying harder - you are removing the reason it kept failing.",
    before_items: beforeItems.length ? beforeItems : [sit.problem || "The situation as it stands today."],
    after_items: afterItems.length ? afterItems : [sit.desired_transformation || promise],
  };

  // SECTION 5 - who for / not for (from situation + safety)
  const forItems = [];
  if (sit.person) forItems.push(sit.person);
  if (sit.specific_situation) forItems.push(sit.specific_situation);
  if (sit.failed_attempt) {
    const fa = sit.failed_attempt;
    forItems.push(/^tried/i.test(fa) ? fa : `You have already tried: ${lcFirst(fa)}.`);
  }
  if (!forItems.length) {
    const tp = p.customer?.target_person && !/^backfilled/i.test(p.customer.target_person) ? p.customer.target_person : "";
    forItems.push(tp || `Anyone in the situation this system is built for: ${lcFirst(p.identity.subtitle)}.`);
  }
  const notFor = [];
  if (tr?.safety?.scope_boundary) notFor.push(tr.safety.scope_boundary);
  if (tr?.safety?.red_flags?.length) {
    notFor.push(`If any red flag is present (${tr.safety.red_flags.slice(0, 3).join("; ")}), this is not a home system - seek professional care first.`);
  }
  if (!notFor.length) notFor.push("If you need clinical diagnosis or treatment, this educational system is not a substitute for professional care.");
  landing.who_for = {
    label: "Fit check",
    headline: "Read both sides before you buy.",
    intro: `This system is built for a specific situation. If that is not you, it will not help - and we would rather tell you now.`,
    for_label: "This is for you if",
    for_items: forItems.slice(0, 5),
    not_for_label: "This is NOT for you if",
    not_for_items: notFor.slice(0, 4),
    note: tr?.safety?.scope_boundary
      ? shortClause(tr.safety.scope_boundary, 200)
      : (tr?.safety?.red_flags?.length ? "If any red flag applies, this is not a home system - seek professional care first." : ""),
  };

  // SECTION 6 - the promise (from one_line_promise + desired_transformation + remaining_limits)
  const weDo = `${promise}${sit.desired_transformation ? ` ${sit.desired_transformation}.` : ""}`;
  const limits = as.remaining_limits ?? [];
  const weDoNot = `${limits.length ? `We do not promise: ${joinList(limits)}. ` : "We do not promise a guaranteed outcome. "}This is an educational system, not medical, clinical, or mental-health care.`;
  landing.promise = {
    label: "What we promise - and what we don't",
    headline: "A system. Not a guarantee.",
    we_do_label: "We promise you",
    we_do: weDo,
    we_do_not_label: "We do not promise you",
    we_do_not: weDoNot,
    evidence_label: evLabel,
  };

  // SECTION 7 - what's inside (asset titles)
  if (assets.length) {
    landing.inside = {
      label: `Inside ${name}`,
      headline: "Everything you get. Nothing padded.",
      intro: "The full kit, at a glance - for the skimmers.",
      items: assets.map(a => a.title),
    };
  }

  // SECTION 8 - bottom CTA. Short punchy headline (clause-capped) + eyebrow + evidence label.
  landing.final_cta = {
    eyebrow: `The ${noun} needs a system`,
    headline: shortClause(sit.desired_transformation || promise, 60) || "Make it a system.",
    body: promise,
    cta_label: `Get ${name}`,
    trust_line: trust,
    evidence_label: evLabel,
  };

  // SECTION 9 - next transformation (journey hook, anti-artificial-upsell)
  const nextIds = tr?.next_transformation ?? p.transformation?.next_transformation_ids ?? [];
  if (nextIds.length) {
    landing.next = {
      label: "What comes next",
      headline: `Once the ${noun} has a system, the next situations usually surface.`,
      intro: "The journey does not end here. Swiipt is built to see what tends to follow - so you are not blindsided by it.",
      note: "These are not upsells. They are the next situations on the same journey.",
      items: nextIds.map(resolveNext),
    };
  }
  return landing;
}

function genProductPage(p, tr) {
  const sitBody = tr?.situation?.specific_situation || (p.customer?.situation && !/^backfilled/i.test(p.customer.situation) ? p.customer.situation : "");
  const obj = {
    content_version: "1.0",
    product_id: p.product_id,
    source: "factory-generator",
    generated_at: now(),
    hero: {
      title: p.identity.name,
      subtitle: p.identity.subtitle,
      one_line_promise: p.identity.one_line_promise,
    },
    short_description: p.identity.one_line_promise,
    trust_line: trustLine(p),
    evidence_label: evidenceLabel(p, tr),
  };
  if (sitBody) obj.situation_block = { label: "Your situation", body: sitBody };
  return obj;
}

function genFaq(p, tr, assets) {
  const name = p.identity.name;
  const evLabel = evidenceLabel(p, tr);
  const items = [];
  items.push({ q: `What is ${name}?`, a: `${p.identity.subtitle} ${p.identity.one_line_promise}` });
  if (tr?.situation?.person) items.push({ q: "Who is this for?", a: tr.situation.person });
  if (assets.length) items.push({ q: "What is included?", a: `You get ${assets.length} components: ${assets.map(a => a.title).join("; ")}.` });
  items.push({
    q: "Is this medical advice?",
    a: `No. ${trustLine(p)} It does not replace professional assessment or care.`,
    evidence_label: evLabel,
  });
  const grant = p.commerce?.access_rules?.grant_type;
  if (grant === "one_time_digital") {
    items.push({ q: "How do I get it?", a: "Instant digital download. After checkout the system appears in your Swiipt library with read, PDF, and read-aloud formats." });
  }
  return { content_version: "1.0", product_id: p.product_id, source: "factory-generator", generated_at: now(), items };
}

// --- driver ---
async function processProduct(pid) {
  const pdir = join(root, "data", "products", pid);
  const pf = join(pdir, "product.json");
  if (!existsSync(pf)) { console.error(`  ${pid}: no product.json`); return false; }
  const p = JSON.parse(readFileSync(pf, "utf8"));
  const trId = p.identity?.transformation_id;
  const trPath = join(root, "data", "transformations", `${trId}.json`);
  const tr = trId && existsSync(trPath) ? JSON.parse(readFileSync(trPath, "utf8")) : null;
  const assets = loadAssets(pdir, p);
  mkdirSync(join(pdir, "copy"), { recursive: true });

  const gens = {
    "landing-page.json": () => genLanding(p, tr, assets, pdir),
    "product-page.json": () => genProductPage(p, tr),
    "faq.json": () => genFaq(p, tr, assets),
  };

  p.content = p.content ?? {};
  const written = [];
  const providerMeta = {};
  for (const [file, gen] of Object.entries(gens)) {
    const target = join(pdir, "copy", file);
    if (existsSync(target)) {
      try {
        const ex = JSON.parse(readFileSync(target, "utf8"));
        if (ex.source === "manual-port") { p.content[KEY[file]] = `copy/${file}`; console.log(`  ${pid}: keep ${file} (manual-port reference)`); continue; }
      } catch (e) { /* regenerate over a corrupt file */ }
    }
    let obj = gen();
    const enriched = await enrichContent(file, obj, p, tr, assets, pdir); // Phase 3 narrative enrichment
    obj = enriched.content;
    providerMeta[file] = enriched.meta;
    const valid = ajv.validate(SCHEMA[file], obj);
    if (!valid) {
      console.error(`  ${pid}: INVALID ${file} -> ${ajv.errors.map(e => `${e.instancePath} ${e.message}`).join("; ")}`);
      return false;
    }
    writeFileSync(target, JSON.stringify(obj, null, 2) + "\n");
    p.content[KEY[file]] = `copy/${file}`;
    written.push(file);
  }
  // Provider-status record (honesty): explicitly records what was requested vs what actually generated.
  const metas = Object.values(providerMeta);
  const requested = [...new Set(metas.map((m) => m.requested_provider))];
  const actuals = [...new Set(metas.map((m) => m.actual_generator).filter(Boolean))];
  const providerStatus = {
    product_id: pid,
    generated_at: now(),
    requested_provider: requested.length === 1 ? requested[0] : (requested.length ? "mixed" : "none"),
    actual_generators: actuals,
    fallback_used: metas.some((m) => m.fallback_used),
    files: providerMeta,
  };
  writeFileSync(join(pdir, "copy", "provider-status.json"), JSON.stringify(providerStatus, null, 2) + "\n");
  writeFileSync(pf, JSON.stringify(p, null, 2) + "\n");
  console.log(`  ${pid}: wrote ${written.join(", ") || "(none)"}${tr ? "" : "  [no TR record - thin output]"}  [${assets.length} assets]`);
  return true;
}

const arg = process.argv[2];
let ids = [];
if (arg === "--all") {
  ids = readdirSync(join(root, "data", "products")).filter(d => existsSync(join(root, "data", "products", d, "product.json")));
} else if (arg) {
  ids = [arg];
} else {
  console.error("usage: node harness/gen-content.mjs <PRODUCT_ID> | --all");
  process.exit(2);
}
let ok = true;
console.log(`gen-content (copywriter provider=${provider()}): ${ids.length} product(s)`);
(async () => {
  for (const id of ids) { if (!(await processProduct(id))) ok = false; }
  console.log(ok ? "done." : "done with ERRORS.");
  process.exit(ok ? 0 : 1);
})();
