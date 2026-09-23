#!/usr/bin/env node
// SWIIPT AUTONOMOUS GOVERNANCE AUTHORITY ENGINE V1
//
// HUMANS GOVERN THE SYSTEM. THE SYSTEM GOVERNS THE PRODUCTS.
//
// LEVEL 1  constitutions (governance/constitutions/*.json)          - system-wide rules
// LEVEL 2  Domain Authority Packs (governance/domain-packs/*.json)  - domain machine authority
// LEVEL 3  product authority evaluation                             - AUTHORIZED / NOT_AUTHORIZED
//
// It implements the automated Evidence (g4) / Safety (g5) / Journey (g9) authorities, the TSM
// derivation policy and the Publication Constitution (g10). A model may act as a POLICY EXECUTOR
// (semantic judgment only where a deterministic check cannot decide); the AUTHORITY is always the
// versioned constitution + domain pack. It never fabricates a human, never self-authorizes from
// generation, and fails closed.
//
// Deterministic-first: the current corpus is fully decidable deterministically, so no model call is
// required for authorization. `model_assist` is available and off by default (a qualified route is
// configured but not invoked in this run; $0).
//
// Usage:
//   node harness/governance-authority.mjs evaluate <PRODUCT_ID> [--write] [--json]
//   node harness/governance-authority.mjs status   <PRODUCT_ID>
//   node harness/governance-authority.mjs reevaluate [--json]
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const AUTHORITY_ENGINE_VERSION = "governance-authority@1";
export const STATE = Object.freeze({
  AUTHORIZED: "AUTHORIZED",
  NOT_AUTHORIZED: "NOT_AUTHORIZED",
  AUTHORIZED_BY_PUBLICATION_CONSTITUTION: "AUTHORIZED_BY_PUBLICATION_CONSTITUTION",
});
export const CONSTITUTION_KINDS = Object.freeze(["EVIDENCE", "SAFETY", "JOURNEY", "TSM", "PUBLICATION"]);

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const isObj = (v) => v != null && typeof v === "object" && !Array.isArray(v);
const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const sha256 = (s) => createHash("sha256").update(String(s), "utf8").digest("hex");
const stable = (v) => (Array.isArray(v) ? `[${v.map(stable).join(",")}]`
  : isObj(v) ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`
    : JSON.stringify(v === undefined ? null : v));

/* ------------------------------------------------------------------ load authority (fail closed) */
export function loadRegistry(root = ROOT) {
  const p = join(root, "governance", "registry.json");
  if (!existsSync(p)) throw new Error(`authority: registry missing at ${p}`);
  return readJson(p);
}
export function loadConstitution(kind, root = ROOT) {
  const reg = loadRegistry(root);
  const entry = reg.constitutions.find((c) => c.kind === kind && c.status === "ACTIVE");
  if (!entry) throw new Error(`authority: no ACTIVE ${kind} constitution`);
  const p = join(root, entry.file);
  if (!existsSync(p)) throw new Error(`authority: constitution file missing ${p}`);
  return readJson(p);
}
export function loadPack(domain, root = ROOT) {
  const reg = loadRegistry(root);
  const entry = reg.domain_packs.find((d) => d.domain === domain && d.status === "ACTIVE");
  if (!entry) return null;
  const p = join(root, entry.file);
  if (!existsSync(p)) return null;
  return readJson(p);
}
export function authorityVersionMap(root = ROOT) {
  const reg = loadRegistry(root);
  const out = {};
  for (const c of reg.constitutions) out[`${c.kind.toLowerCase()}_constitution`] = `${c.authority_id}@${c.version}`;
  for (const d of reg.domain_packs) out[`pack_${d.domain}`] = `${d.authority_id}@${d.version}`;
  return out;
}

/* ------------------------------------------------------------------ risk + domain classification */
export function classifyRisk(product, transformation) {
  const reg = loadRegistry();   // system authority is global
  const level = product?.safety?.risk_level ?? transformation?.safety?.risk_level ?? null;
  if (!isStr(level)) return { risk_class: null, risk_level: null, trace: { source: "missing risk_level" } };
  const risk_class = reg.risk_class_by_risk_level[level] ?? null;
  return {
    risk_class,
    risk_level: level,
    trace: { source: "product.safety.risk_level | transformation.safety.risk_level", risk_level: level, mapping: "registry.risk_class_by_risk_level" },
  };
}

export function domainText(product, transformation) {
  return [
    product?.identity?.name, product?.identity?.subtitle, product?.identity?.one_line_promise,
    product?.customer?.target_person, product?.customer?.situation, product?.customer?.trigger,
    product?.transformation?.mechanism?.core,
    transformation?.submarket_id, transformation?.situation?.specific_situation,
    transformation?.situation?.problem, transformation?.mechanism?.core_mechanism,
  ].filter(isStr).join(" \n ").toLowerCase();
}

export function classifyDomain(product, transformation) {
  const reg = loadRegistry();
  // explicit override wins (data-driven, no per-product code)
  const explicit = product?.authority_domain ?? transformation?.authority_domain ?? null;
  if (isStr(explicit)) return { domain: explicit, scores: { [explicit]: 1 }, trace: { source: "explicit authority_domain", explicit } };
  const text = domainText(product, transformation);
  const scores = {};
  for (const d of reg.domain_classification.domains) {
    let n = 0;
    for (const kw of d.keywords) if (text.includes(kw)) n += 1;
    scores[d.domain] = n;
  }
  const max = Math.max(0, ...Object.values(scores));
  if (max === 0) return { domain: reg.domain_classification.default_domain, scores, trace: { source: "default (no domain signal)" } };
  // tie-break fail-closed: the earliest-listed (most specific/regulated) domain with the max score wins
  const winner = reg.domain_classification.domains.find((d) => scores[d.domain] === max).domain;
  return { domain: winner, scores, trace: { source: "scored keyword over canonical text", winner, scores } };
}

export function resolvePack(domain, riskClass) {
  const pack = loadPack(domain);
  if (!pack) return { pack: null, covers: false, reason: `no ACTIVE Domain Authority Pack for domain '${domain}'` };
  const covers = Array.isArray(pack.risk_classes) && pack.risk_classes.includes(riskClass);
  return { pack, covers, reason: covers ? null : `pack '${pack.authority_id}' does not cover risk class '${riskClass}'` };
}

/* ------------------------------------------------------------------ deterministic helpers */
const CLAIM_LABELS = ["sourced_evidence", "expert_reviewed", "lived_experience", "model_inference", "hypothesis"];
const ABSOLUTE_RE = /\b(guarantee[sd]?|proven|100%|never fails?|risk-?free|will (save|guarantee)|cures?|guaranteed)\b/i;
const EFFICACY_RE = /\b(guarantee[sd]?|proven (to )?sav|saves? (you )?(money|\d)|debt[- ]?free|financially secure|guaranteed savings|will save)\b/i;
const PERCENT_RE = /\b\d+(?:\.\d+)?\s*%|\b\d+(?:\.\d+)?\s*percent\b/i;
const NUMERIC_RE = /[$₦€£]\s?\d|\b\d[\d,]{2,}\b/;
const GOVERNANCE_TERMS_RE = /\b(PPL-|TR-|AS-FM-|ANG-|g[0-9]_|human_review|gate_|SOURCE_REQUIRED|NOT_AUTHORIZED|AUTHORIZED|fact-table|_swiipt_|manifest|wordpress_ids)\b/;
const PLACEHOLDER_ESCALATION_RE = /local crisis line|your local|placeholder|XXXX|\b000\b|999-style/i;

/** Prohibited-claim assertion patterns (the phrase must be ASSERTED, not denied). */
const PROHIBITED_PATTERNS = {
  guaranteed_savings: /\bguarantee[sd]?\s+savings?\b|\bwill save you\b|\bsaves? you (money|\d)/i,
  percentage_savings: /\bsave (up to )?\d+(\.\d+)?\s?%|\b\d+(\.\d+)?\s?% (savings|less|cheaper)\b/i,
  exact_monetary_savings: /\bsave (₦|\$|€|£)\s?\d|\bsaves? \d[\d,]{2,}/i,
  debt_reduction_claim: /\bdebt[- ]?free\b|\bclear your debt\b|\breduce your debt\b/i,
  financial_security_claim: /\bfinancially secure\b|\bfinancial security\b|\bsecurity for your family\b/i,
  investment_advice: /\binvest(ment)? in (stocks|shares|funds)\b|\bstock market\b|\bsecurities\b/i,
  securities_advice: /\bsecurities advice\b/i,
  credit_advice: /\bcredit (score|advice|repair)\b/i,
  regulated_financial_planning: /\bregulated financial planning\b|\bwe are (a )?financial adviser\b/i,
  guaranteed_savings_alt: /\bguaranteed (money|returns?)\b/i,
  income_growth_claim: /\b(grow|increase|double) your income\b/i,
  investment_return_claim: /\b\d+(\.\d+)?\s?% (returns?|yield)\b/i,
  proven_efficacy: /\bclinically proven\b|\bproven to (save|work|reduce)\b/i,
  therapy: /\b(offer|provide|we do) therapy\b|\btherapy sessions?\b/i,
  relationship_counselling: /\brelationship counsel(l?ing)? (session|programme|program)\b/i,
  emergency_financial_assistance: /\bwe (provide|offer) emergency financial\b/i,
};
const NEGATION_RE = /\b(never|not|no|without|does not|doesn't|isn't|aren't|avoid|cannot|can't)\b[^.]{0,40}$/i;
/** Certainty markers that make an ABSOLUTE assertion when not negated (specific, not bare "proven"). */
const CERTAINTY_PATTERNS = [
  /\bguarantee[sd]?\b/i, /\b100%\b/i, /\bwill (save|work|guarantee|help you save)\b/i,
  /\bcures?[sd]?\b/i, /\bnever fails\b/i, /\balways works\b/i,
  /\bproven to (save|work|reduce|help)\b/i, /\bproven (savings|results?|efficacy|effective|safe)\b/i, /\bclinically proven\b/i,
];
// The PRODUCT asserting a prohibited behaviour (not clinical vocabulary like "only if prescribed",
// "never a diagnosis" — those are negations or guidance). Pack-scoped (task section 12).
const SAFETY_DRIFT_PATTERNS = [
  /\bwe (advise|recommend) you (invest|borrow|take out a loan)\b/i,
  /\b(guaranteed|proven) (savings|returns?|results?)\b/i,
  /\b(we|this (system|guide|product|plan)) diagnos(e|es)\b/i,
  /\b(we|this (system|guide|product|plan)) prescrib(e|es)\b/i,
  /\byou (should|must) take \d/i,
  /\b(cures?|cured)\b/i,
  /\bdebt[- ]?free\b/i,
  /\bfinancially secure\b/i,
];
const certaintyAsserted = (text, boundaries = []) => scanAssertions(CERTAINTY_PATTERNS, text, boundaries);
/** True when the phrase already appears inside a canonical boundary/disclaimer statement (a prohibition, not an assertion). */
function inBoundary(phrase, boundaries) {
  const p = String(phrase).toLowerCase();
  return boundaries.some((b) => String(b).toLowerCase().includes(p));
}
/** Scan a set of assertion patterns, skipping negated matches and matches that live inside a declared boundary. */
function scanAssertions(patterns, corpus, boundaries = []) {
  for (const pat of patterns) {
    const hit = assertionHit(pat, corpus);
    if (hit && !inBoundary(hit, boundaries)) return hit;
  }
  return null;
}
/** True when a prohibited pattern is ASSERTED (matched and not negated just before it). */
function assertionHit(pattern, corpus) {
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
  let m;
  while ((m = re.exec(corpus)) !== null) {
    const before = corpus.slice(Math.max(0, m.index - 46), m.index);
    if (!NEGATION_RE.test(before)) return m[0];
  }
  return null;
}
function anyProhibitedHit(corpus, classes, boundaries = []) {
  const hits = [];
  for (const cls of classes) {
    const pat = PROHIBITED_PATTERNS[cls];
    if (!pat) continue;
    const hit = assertionHit(pat, corpus);
    if (hit && !inBoundary(hit, boundaries)) hits.push(`${cls}:"${hit}"`);
  }
  return hits;
}
/** The canonical boundary/disclaimer statements that already PROHIBIT these things (never assertions). */
function boundaryStatements(product, transformation, pack) {
  return [
    product?.safety?.disclaimer,
    transformation?.safety?.scope_boundary,
    product?.transformation?.before_state?.summary,
    ...(pack?.safety_rules?.scope_boundaries ?? []),
    ...(pack?.safety_rules?.required_disclosures ?? []),
  ].filter(isStr);
}

function assetContent(product, dir) {
  const out = [];
  for (const [job, list] of Object.entries(product?.asset_map ?? {})) {
    for (const aid of (Array.isArray(list) ? list : [])) {
      const af = join(dir, "assets", `${aid}.json`);
      if (!existsSync(af)) { out.push({ job, aid, exists: false }); continue; }
      let rec = null; try { rec = readJson(af); } catch { /* parse error */ }
      let content = null;
      if (rec?.source_path) {
        const sp = join(dir, rec.source_path.split("#")[0]);
        if (existsSync(sp)) content = readFileSync(sp, "utf8");
      }
      out.push({ job, aid, exists: true, record: rec, content });
    }
  }
  return out;
}
function claimInventory(product, transformation) {
  const out = [];
  let n = 0;
  const push = (claim, label, location, source, declared) => { if (!isStr(claim)) return; n += 1; out.push({ claim_id: `C-${String(n).padStart(2, "0")}`, claim: String(claim).trim(), label: label ?? null, location, source: source ?? null, declared }); };
  for (const c of product?.evidence?.claim_labels ?? []) push(c?.claim, c?.label, "product.evidence.claim_labels", c?.source, true);
  for (const c of transformation?.evidence ?? []) push(c?.claim, c?.status, "transformation.evidence", c?.source, false);
  for (const c of transformation?.mechanism?.evidence_basis ?? []) push(c?.claim, c?.status, "transformation.mechanism.evidence_basis", c?.source, false);
  return out;
}
const check = (rule, ok, detail) => ({ rule, ok: !!ok, detail: detail ?? "" });

/* ------------------------------------------------------------------ EVIDENCE AUTHORITY (g4) */
export function evaluateEvidenceAuthority({ product, transformation, dir, pack }) {
  const checks = [];
  const reasons = new Set();
  const claims = claimInventory(product, transformation);
  const declared = new Set((product?.evidence?.sources ?? []).map(String));

  checks.push(check("E1", claims.length > 0, `${claims.length} claim(s)`));
  if (!claims.length) reasons.add("SOURCE_MISSING");

  const badLabels = claims.filter((c) => !CLAIM_LABELS.includes(c.label));
  checks.push(check("E3", badLabels.length === 0, badLabels.map((c) => c.label).join(",") || "all labels canonical"));
  if (badLabels.length) reasons.add("CLAIM_CLASS_NOT_AUTHORIZED");

  const sourced = claims.filter((c) => ["sourced_evidence", "expert_reviewed"].includes(c.label));
  const unsourced = sourced.filter((c) => !isStr(c.source) || (c.declared && !declared.has(String(c.source))));
  checks.push(check("E4", unsourced.length === 0, unsourced.length ? `unsourced: ${unsourced.map((c) => c.claim_id).join(",")}` : `${sourced.length} sourced/expert claim(s) carry a resolving source`));
  if (unsourced.length) reasons.add("SOURCE_MISSING");

  // E5/E6/E7: absolute/hypothesis-as-fact, numeric support, efficacy not asserted beyond evidence
  const absOnNonSourced = claims.filter((c) => !["sourced_evidence", "expert_reviewed"].includes(c.label) && certaintyAsserted(c.claim));
  checks.push(check("E6", absOnNonSourced.length === 0, absOnNonSourced.map((c) => c.claim.slice(0, 40)).join(" | ") || "no hypothesis-as-fact"));
  if (absOnNonSourced.length) reasons.add("HYPOTHESIS_PRESENTED_AS_FACT");

  // E7: a numeric claim may be stated as FACT only with sourced/expert support. A number carried by
  // an honestly-labelled model_inference/hypothesis/lived_experience claim is acceptable (it is not
  // presented as established fact); a numeric claim with no label, or carrying absolute certainty, is not.
  const numericUnsupported = claims.filter((c) => {
    const hasNum = PERCENT_RE.test(c.claim) || NUMERIC_RE.test(c.claim);
    if (!hasNum) return false;
    const sourced = ["sourced_evidence", "expert_reviewed"].includes(c.label);
    if (sourced) return false;                                   // a sourced number is supported
    const honest = ["model_inference", "hypothesis", "lived_experience"].includes(c.label);
    if (honest) return ABSOLUTE_RE.test(c.claim);                // inference numbers OK unless asserted as fact
    return true;                                                 // unlabelled numeric claim
  });
  checks.push(check("E7", numericUnsupported.length === 0, `${numericUnsupported.length} unsupported numeric claim(s)`));
  if (numericUnsupported.length) reasons.add("UNSUPPORTED_NUMERIC_CLAIM");

  const efficacyAllowed = pack?.evidence_rules?.efficacy_claims_allowed === true;
  const efficacyClaims = claims.filter((c) => EFFICACY_RE.test(c.claim));
  checks.push(check("E8", efficacyAllowed || efficacyClaims.length === 0, efficacyClaims.map((c) => c.claim.slice(0, 40)).join(" | ") || "no efficacy claim"));
  if (!efficacyAllowed && efficacyClaims.length) reasons.add("UNSUPPORTED_EFFICACY_CLAIM");

  // E9/E14: pack-driven prohibited claim classes, scanned in the product + asset content text
  const contentText = assetContent(product, dir).map((a) => a.content ?? "").join("\n").toLowerCase();
  const productText = [product?.identity?.name, product?.identity?.subtitle, product?.identity?.one_line_promise, product?.customer?.situation, product?.transformation?.after_state?.summary].filter(isStr).join(" ").toLowerCase();
  const corpus = `${productText}\n${contentText}`;
  const prohibited = pack?.claim_classes?.prohibited ?? [];
  const hits = anyProhibitedHit(corpus, prohibited, boundaryStatements(product, transformation, pack));
  checks.push(check("E14", hits.length === 0, hits.join(",") || "no prohibited claim class asserted"));
  if (hits.length) reasons.add("CLAIM_CLASS_NOT_AUTHORIZED");

  // E10: dated baseline for market-sensitive examples where the pack requires it
  const datedRequired = pack?.dated_baseline_rules?.required === true;
  const hasDate = /\b(january|february|march|april|may|june|july|august|september|october|november|december|20\d\d|checked on|reviewed on|dated)\b/i.test(contentText);
  checks.push(check("E10", !datedRequired || hasDate, datedRequired ? (hasDate ? "dated baseline present" : "no date found") : "not required"));
  if (datedRequired && !hasDate) reasons.add("SOURCE_TOO_OLD");

  // E14 (pack present)
  checks.push(check("E2", !!pack, pack ? pack.authority_id : "no pack"));
  if (!pack) reasons.add("DOMAIN_AUTHORITY_MISSING");

  void declared;
  const state = reasons.size === 0 && checks.every((c) => c.ok) ? STATE.AUTHORIZED : STATE.NOT_AUTHORIZED;
  return { state, checks, failure_reasons: [...reasons], claim_count: claims.length };
}

/* ------------------------------------------------------------------ SAFETY AUTHORITY (g5) */
export function evaluateSafetyAuthority({ product, transformation, dir, pack, risk }) {
  const checks = [];
  const reasons = new Set();
  const s = product?.safety ?? {};
  const clinical = pack?.safety_rules?.clinical_required === true;
  const highRisk = risk?.risk_class === "high_risk_regulated";

  checks.push(check("S1", isStr(s.risk_level), s.risk_level ?? "missing"));
  if (!isStr(s.risk_level)) reasons.add("SAFETY_MISSING");

  checks.push(check("S2", !!pack && pack.risk_classes.includes(risk?.risk_class), pack ? `pack covers ${risk?.risk_class}` : "no pack"));
  if (!pack || !pack.risk_classes.includes(risk?.risk_class)) reasons.add("DOMAIN_AUTHORITY_MISSING");

  const scope = transformation?.safety?.scope_boundary;
  checks.push(check("S3", isStr(scope), isStr(scope) ? "scope boundary present" : "missing"));
  if (!isStr(scope)) reasons.add("SAFETY_MISSING");

  const disclosure = s.disclaimer;
  checks.push(check("S4", isStr(disclosure), isStr(disclosure) ? "disclosure present" : "missing"));
  if (!isStr(disclosure)) reasons.add("SAFETY_MISSING");

  const esc = Array.isArray(s.escalation_rules) ? s.escalation_rules : [];
  const placeholder = esc.find((r) => PLACEHOLDER_ESCALATION_RE.test(String(r)));
  checks.push(check("S5", esc.length > 0 && !placeholder, placeholder ? `invented route: ${placeholder}` : `${esc.length} escalation rule(s)`));
  if (!esc.length || placeholder) reasons.add(placeholder ? "ESCALATION_UNDEFINED" : "ESCALATION_UNDEFINED");

  // S6: prohibited behaviour drift (pack-driven) over the pack's prohibited behaviours + corpus
  const corpus = [product?.identity?.name, product?.identity?.subtitle, product?.identity?.one_line_promise,
    ...(assetContent(product, dir).map((a) => a.content ?? ""))].filter(isStr).join("\n").toLowerCase();
  // Safety Constitution + applicable Domain Authority Pack govern safety: without a resolving pack
  // there is no governing safety authority (reported separately as DOMAIN_AUTHORITY_MISSING).
  const driftHit = pack ? scanAssertions(SAFETY_DRIFT_PATTERNS, corpus, boundaryStatements(product, transformation, pack)) : null;
  checks.push(check("S6", !driftHit, driftHit ? `prohibited behaviour text: ${driftHit}` : "no prohibited behaviour"));
  if (driftHit) reasons.add("PROHIBITED_SAFETY_BEHAVIOR");

  // S7/S8: red flags required ONLY for a genuinely clinical domain or high-risk regulated class —
  // NOT mechanically for a non-clinical moderate product (this corrects the legacy clinical_required mapping).
  const redFlagsRequired = clinical || highRisk;
  const redFlags = Array.isArray(s.red_flags) ? s.red_flags : [];
  checks.push(check("S8", !redFlagsRequired || redFlags.length > 0, redFlagsRequired ? `${redFlags.length} red flag(s)` : "not required (non-clinical domain)"));
  if (redFlagsRequired && redFlags.length === 0) reasons.add("SOURCE_REQUIRED");

  // S9: misleading certainty (deterministic proxy)
  const cert = certaintyAsserted(corpus, boundaryStatements(product, transformation, pack));
  checks.push(check("S9", !cert, cert ? `certainty text: ${cert}` : "no misleading certainty"));
  if (cert) reasons.add("MISLEADING_CERTAINTY");

  // S10: rescue behaviour present where failure points exist
  const hasFailure = Array.isArray(transformation?.failure_point_map) && transformation.failure_point_map.length > 0;
  const rescueAsset = (product?.asset_map?.rescue ?? []).length > 0;
  const rescueContent = assetContent(product, dir).filter((a) => /rescue|reentry|re-entry/i.test(a.job ?? "")).map((a) => a.content ?? "").join(" ");
  const rescueOk = !hasFailure || (rescueAsset && /restart|re-?post|re-?open|rescue|minimum mode|re-?enter/i.test(rescueContent));
  checks.push(check("S10", rescueOk, rescueOk ? "rescue routes back" : "rescue inadequate"));
  if (!rescueOk) reasons.add("RESCUE_INADEQUATE");

  const state = reasons.size === 0 && checks.every((c) => c.ok) ? STATE.AUTHORIZED : STATE.NOT_AUTHORIZED;
  return { state, checks, failure_reasons: [...reasons], clinical_required: clinical, risk_class: risk?.risk_class ?? null };
}

/* ------------------------------------------------------------------ JOURNEY AUTHORITY (g9) */
export function evaluateJourneyAuthority({ product, transformation, dir, inputs, pack, content = null }) {
  const checks = [];
  const reasons = new Set();
  const assets = assetContent(product, dir);
  content = content ?? inputs?.content ?? {};
  const path = transformation?.transformation_path ?? product?.transformation?.path ?? [];
  const firstWin = transformation?.first_win ?? product?.transformation?.first_win ?? null;

  checks.push(check("J0", ["landing_page", "product_page", "faq", "reviews"].every((k) => content[k]?.exists), "customer content artifacts present"));
  if (!["landing_page", "product_page", "faq", "reviews"].every((k) => content[k]?.exists)) reasons.add("ARTIFACT_UNRESOLVED");

  checks.push(check("J1", !!(firstWin && (firstWin.action || firstWin.within) && path.length > 0), `${path.length} stage(s); first win ${firstWin ? "present" : "missing"}`));
  if (!firstWin || path.length === 0) reasons.add("FIRST_WIN_BROKEN");

  const unresolved = assets.filter((a) => !a.exists || !isStr(a.content));
  checks.push(check("J2", unresolved.length === 0, unresolved.length ? `unresolved: ${unresolved.map((a) => a.aid).join(",")}` : `${assets.length} artifact(s) resolve`));
  if (unresolved.length) reasons.add("ARTIFACT_UNRESOLVED");

  const hasFailure = Array.isArray(transformation?.failure_point_map) && transformation.failure_point_map.length > 0;
  const rescueAsset = (product?.asset_map?.rescue ?? []).length > 0;
  checks.push(check("J3", !hasFailure || rescueAsset, hasFailure ? (rescueAsset ? "rescue asset present" : "no rescue asset") : "no failure points declared"));
  if (hasFailure && !rescueAsset) reasons.add("RESCUE_PATH_MISSING");

  // J6: no internal terminology in customer-facing text
  const customerText = [
    product?.identity?.name, product?.identity?.subtitle, product?.identity?.one_line_promise,
    ...Object.values(content).map((c) => (c?.exists ? JSON.stringify(c.data) : "")),
    ...assets.map((a) => a.content ?? ""),
  ].filter(isStr).join("\n");
  const leak = GOVERNANCE_TERMS_RE.exec(customerText);
  checks.push(check("J6", !leak, leak ? `internal term: ${leak[0]}` : "clean"));
  if (leak) reasons.add("INTERNAL_TERMINOLOGY_EXPOSED");

  checks.push(check("J8", !!(transformation?.maintenance || product?.transformation?.maintenance), "next-state/maintenance present"));

  // J4/J5: deterministic structural proxies (no dead end: every stage has an objective)
  const stageOk = path.every((s) => isStr(s?.objective || s?.stage)) && path.length >= 2;
  checks.push(check("J4", stageOk, stageOk ? "no dead-end stage" : "stage without objective"));
  if (!stageOk) reasons.add("DEAD_END");

  // J7: mechanism delivered, not merely explained (operational artifact present)
  const operational = assets.some((a) => ["DO", "TRACK", "DECIDE"].includes(String(a.record?.job ?? a.job ?? "").toUpperCase()) && isStr(a.content));
  checks.push(check("J7", operational, operational ? "operational artifact present" : "mechanism only explained"));
  if (!operational) reasons.add("MECHANISM_NOT_DELIVERED");

  // pack coverage (J0 already covers artifacts)
  checks.push(check("J9", !!pack, pack ? pack.authority_id : "no pack"));
  if (!pack) reasons.add("DOMAIN_AUTHORITY_MISSING");

  void inputs;
  const state = reasons.size === 0 && checks.every((c) => c.ok) ? STATE.AUTHORIZED : STATE.NOT_AUTHORIZED;
  return { state, checks, failure_reasons: [...reasons] };
}

/* ------------------------------------------------------------------ TSM CONSTITUTION */
export function classifyTSM(product, transformation, constitution) {
  const tr = transformation ?? {};
  const p = product ?? {};
  const metrics = p.tsm?.individual_progress_metrics ?? tr.tsm?.success_indicators ?? [];
  const days = tr.tsm?.measurement_days ?? p.tsm?.measurement_days ?? [];
  const method = tr.tsm?.measurement_method ?? p.tsm?.measurement_method ?? null;
  const failures = [];
  if (!Array.isArray(metrics) || metrics.length === 0) failures.push("TSM_MISSING");
  if (!Array.isArray(days) || days.length === 0) failures.push("TSM_MISSING");
  const engagement = metrics.some((m) => /\b(pages? read|engagement|clicks?|quiz score|logged in)\b/i.test(String(m)));
  if (engagement) failures.push("TSM_METRIC_INVALID");
  const m = metrics.length, X = Array.isArray(days) && days.length ? Math.max(...days) : null;
  const derivable = m >= 2 && X !== null;
  const threshold = derivable ? `${constitution.policy.threshold_derivation.defaults.P}%+ of completers meet >=${constitution.policy.threshold_derivation.defaults.N} of ${m} indicators at Day ${X} review` : null;
  const state = failures.length ? "NOT_AUTHORIZED"
    : (derivable ? "INTERNAL_COHORT_THRESHOLD" : "HYPOTHESIS_LEARNING_BASELINE");
  return {
    state,
    derived_threshold: threshold,
    metric_count: m,
    observation_days: days,
    measurement_method: method,
    efficacy_validated: false,
    external_presentation: "self_check_target_only",
    note: "Publication eligibility is independent of validated efficacy; the threshold is an internal cohort / learning baseline, never published as proven efficacy.",
    failure_reasons: failures,
    trace: { source: "product.tsm + transformation.tsm", derivation: constitution.policy.threshold_derivation.rule ?? "policy pattern" },
  };
}

/* ------------------------------------------------------------------ PUBLICATION CONSTITUTION (g10) */
export function evaluatePublicationConstitution({ gateStates, tsm, pack, publicationConstitution, designOk }) {
  const reasons = [];
  const req = publicationConstitution.required_states;
  for (const [gate, want] of Object.entries(req)) {
    if (gate === "tsm_classification") continue;
    const have = gateStates[gate];
    if (have !== want) reasons.push(`${gate}: expected ${want}, got ${have ?? "missing"}`);
  }
  if (!pack) reasons.push("DOMAIN_AUTHORITY_MISSING");
  if (!tsm || !["INTERNAL_COHORT_THRESHOLD", "HYPOTHESIS_LEARNING_BASELINE", "EFFICACY_SUPPORTED"].includes(tsm.state)) reasons.push("TSM_UNAUTHORIZED");
  if (designOk === false) reasons.push("DESIGN_AUTHORITY_UNSATISFIED");
  const unique = [...new Set(reasons)];
  const hard = unique.filter((r) => !/^g\d: expected/.test(r) || /NOT_AUTHORIZED|missing/.test(r));
  const state = unique.length === 0 ? STATE.AUTHORIZED_BY_PUBLICATION_CONSTITUTION : STATE.NOT_AUTHORIZED;
  return { state, failure_reasons: unique, hard_blockers: hard };
}

/* ------------------------------------------------------------------ shared context + full evaluation */
/** Build the authority evaluation context (risk class, domain, resolved pack, content presence). */
export function buildAuthorityContext(product, transformation, dir, { root = ROOT, inputs = null } = {}) {
  const risk = classifyRisk(product, transformation, root);
  const domain = classifyDomain(product, transformation, root);
  const resolved = resolvePack(domain.domain, risk.risk_class, root);
  // A pack that does not COVER the product's risk class does not govern it -> treated as absent.
  const pack = resolved.covers ? resolved.pack : null;
  const content = {};
  for (const [key, ref] of Object.entries(product?.content ?? {})) content[key] = { key, ref, exists: isStr(ref) && existsSync(join(dir, ref)) };
  return { product, transformation, dir, risk, domain, resolved, pack, content, inputs, root };
}

export function evaluateGates(productId, { root = ROOT, inputs = null } = {}) {
  const reg = loadRegistry();   // global system authority
  const pdir = join(root, "data", "products", productId);
  const productPath = join(pdir, "product.json");
  if (!existsSync(productPath)) throw new Error(`authority: no product.json at ${productPath}`);
  const product = readJson(productPath);
  const trId = product?.identity?.transformation_id ?? null;
  const trPath = trId ? join(root, "data", "transformations", `${trId}.json`) : null;
  const transformation = trPath && existsSync(trPath) ? readJson(trPath) : null;

  const evidenceConstitution = loadConstitution("EVIDENCE");
  const safetyConstitution = loadConstitution("SAFETY");
  const journeyConstitution = loadConstitution("JOURNEY");
  const tsmConstitution = loadConstitution("TSM");
  const publicationConstitution = loadConstitution("PUBLICATION");

  const { risk, domain, resolved, pack, content } = buildAuthorityContext(product, transformation, pdir, { root });
  const ctx = { product, transformation, dir: pdir, pack, risk, inputs, root, content };
  const evidence = evaluateEvidenceAuthority(ctx);
  const safety = evaluateSafetyAuthority(ctx);
  const journey = evaluateJourneyAuthority(ctx);
  const tsm = classifyTSM(product, transformation, tsmConstitution);

  const gateStates = {
    g0_research_disposition: null, g1_situation: null, g2_transformation: null, g3_product_architecture: null,
    g4_evidence: evidence.state, g5_safety: safety.state, g6_content: null, g7_product_qa: null,
    g8_commerce: null, g9_customer_journey: journey.state,
  };
  const versions = authorityVersionMap();
  const input_hash = sha256(stable({ product, transformation, versions, domain: domain.domain, risk: risk.risk_class }));

  return {
    product_id: productId, transformation_id: trId,
    domain: domain.domain, domain_trace: domain.trace,
    risk_class: risk.risk_class, risk_trace: risk.trace,
    pack: resolved.pack ? { authority_id: resolved.pack.authority_id, version: resolved.pack.version, domain: resolved.pack.domain } : null,
    pack_reason: resolved.reason,
    authority_versions: versions,
    evidence, safety, journey, tsm,
    gateStates,
    publicationConstitution,
    input_hash,
    registry: reg,
  };
}

export function evaluateAuthority(productId, { root = ROOT, inputs = null, now = null, gateStates = null } = {}) {
  const g = evaluateGates(productId, { root, inputs });
  // Merge upstream gate states: persisted qa.gate_results (deterministic gates) + this engine's own
  // authority states (g4/g5/g9) + any explicit override. Never nulls over real values.
  const persisted = {};
  try {
    const pp = join(root, "data", "products", productId, "product.json");
    if (existsSync(pp)) { const pr = JSON.parse(readFileSync(pp, "utf8")); for (const [k, v] of Object.entries(pr.qa?.gate_results ?? {})) persisted[k] = v; }
  } catch { /* ignore */ }
  const engineStates = {};
  for (const [k, v] of Object.entries(g.gateStates)) if (v) engineStates[k] = v;
  const states = { ...persisted, ...engineStates, ...(gateStates || {}) };
  const publication = evaluatePublicationConstitution({
    gateStates: states, tsm: g.tsm, pack: g.pack ? loadPack(g.domain) : null, publicationConstitution: g.publicationConstitution,
  });
  const decision = (g.evidence.state === STATE.AUTHORIZED && g.safety.state === STATE.AUTHORIZED && g.journey.state === STATE.AUTHORIZED)
    ? STATE.AUTHORIZED : STATE.NOT_AUTHORIZED;
  const missing = new Set();
  for (const r of [...g.evidence.failure_reasons, ...g.safety.failure_reasons, ...g.journey.failure_reasons]) {
    if (r === "DOMAIN_AUTHORITY_MISSING") missing.add(`domain_pack:${g.domain}`);
  }
  const record = {
    evaluation_id: `AUTH-${productId}-${g.input_hash.slice(0, 12)}`,
    product_id: productId,
    transformation_id: g.transformation_id,
    evaluated_at: now ?? null,
    evaluator: { kind: "DETERMINISTIC", engine: AUTHORITY_ENGINE_VERSION, model_id: null, independent_from_generation: true },
    authority_versions: g.authority_versions,
    risk_class: g.risk_class,
    domain: g.domain,
    domain_pack: g.pack,
    gates: {
      g4_evidence: { state: g.evidence.state, checks: g.evidence.checks, failure_reasons: g.evidence.failure_reasons },
      g5_safety: { state: g.safety.state, checks: g.safety.checks, failure_reasons: g.safety.failure_reasons },
      g9_customer_journey: { state: g.journey.state, checks: g.journey.checks, failure_reasons: g.journey.failure_reasons },
    },
    tsm_classification: g.tsm,
    publication: { state: publication.state, failure_reasons: publication.failure_reasons },
    missing_authority: [...missing],
    decision,
    failure_reasons: [...new Set([...g.evidence.failure_reasons, ...g.safety.failure_reasons, ...g.journey.failure_reasons, ...publication.failure_reasons])],
    input_hash: g.input_hash,
  };
  return { record, gates: g };
}

/* ------------------------------------------------------------------ persist + audit */
export function authorityAuditPath(productId, root = ROOT) {
  return join(root, "data", "products", productId, "qa", "authority-evaluation.json");
}
export function persistAuthorityEvaluation(productId, record, { root = ROOT } = {}) {
  const p = authorityAuditPath(productId, root);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(record, null, 2) + "\n", "utf8");
  return p;
}
/** Write the schema-valid, constitution-based publication authorization (never a fake human). */
export function authorizeFromConstitution(productId, record, { root = ROOT, now } = {}) {
  const pdir = join(root, "data", "products", productId);
  const productPath = join(pdir, "product.json");
  const product = readJson(productPath);
  const pc = record.authority_versions.publication_constitution;
  product.publishing = product.publishing ?? { manifest_version: "1.0", wordpress_ids: {}, published_at: null };
  product.publishing.authorization = {
    status: "READY_TO_PUBLISH",
    authorized_by: pc,
    authorized_at: now ?? new Date(0).toISOString().replace("1970-01-01", "2026-09-23"),
    notes: `Authorized under the SWIIPT Publication Constitution (${pc}); basis AUTHORIZED_BY_PUBLICATION_CONSTITUTION; see qa/authority-evaluation.json (${record.evaluation_id}).`,
  };
  writeFileSync(productPath, JSON.stringify(product, null, 2) + "\n", "utf8");
  return product.publishing.authorization;
}

/* ------------------------------------------------------------------ reevaluation (drift) */
export function reevaluationScan({ root = ROOT } = {}) {
  const reg = loadRegistry();   // the registry is SYSTEM authority (global), not per product root
  const dir = join(root, "data", "products");
  const out = [];
  for (const pid of readdirSync(dir)) {
    const audit = authorityAuditPath(pid, root);
    if (!existsSync(audit)) continue;
    let rec = null; try { rec = readJson(audit); } catch { continue; }
    const stale = [];
    for (const [k, v] of Object.entries(rec.authority_versions ?? {})) {
      const current = reg.constitutions.find((c) => `${c.kind.toLowerCase()}_constitution` === k);
      const cur = current ? `${current.authority_id}@${current.version}` : null;
      if (cur && cur !== v) stale.push(`${k}: ${v} -> ${cur}`);
    }
    if (stale.length) out.push({ product_id: pid, status: "AUTHORITY_REEVALUATION_REQUIRED", stale });
  }
  return out;
}

/* ------------------------------------------------------------------ CLI */
const invoked = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invoked) {
  const [cmd, arg] = process.argv.slice(2);
  const json = process.argv.includes("--json");
  // NOTE: the canonical ENTRY for a product is the gate runner
  // (`node harness/product-qa-gate-runner.mjs <PRODUCT_ID> --write`), which drives this engine and,
  // when the Publication Constitution authorizes, persists the audit + the constitutional authorization.
  if (cmd === "evaluate" && arg) {
    const { record, gates } = evaluateAuthority(arg, { now: new Date(0).toISOString().replace("1970-01-01", "2026-09-23") });
    if (json) console.log(JSON.stringify(record, null, 2));
    else {
      console.log(`AUTHORITY ${record.product_id}: decision=${record.decision} (upstream gates are evaluated by the gate runner)`);
      console.log(`  domain=${record.domain} risk=${record.risk_class} pack=${record.domain_pack ? record.domain_pack.authority_id : "(none)"}`);
      console.log(`  g4=${record.gates.g4_evidence.state} g5=${record.gates.g5_safety.state} g9=${record.gates.g9_customer_journey.state} tsm=${record.tsm_classification.state}`);
      console.log(`  g4 failures: ${record.gates.g4_evidence.failure_reasons.join(",") || "-"} | g5 failures: ${record.gates.g5_safety.failure_reasons.join(",") || "-"} | g9 failures: ${record.gates.g9_customer_journey.failure_reasons.join(",") || "-"}`);
      void gates;
    }
    process.exit(0);
  }
  if (cmd === "status" && arg) {
    const p = authorityAuditPath(arg);
    console.log(existsSync(p) ? readFileSync(p, "utf8") : `no authority evaluation for ${arg}`);
    process.exit(0);
  }
  if (cmd === "reevaluate") {
    const r = reevaluationScan({});
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  }
  console.error("usage: node harness/governance-authority.mjs evaluate <PRODUCT_ID> [--write] [--json] | status <PRODUCT_ID> | reevaluate");
  process.exit(2);
}
