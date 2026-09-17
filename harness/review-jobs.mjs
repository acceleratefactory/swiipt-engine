#!/usr/bin/env node
// CANONICAL HUMAN GOVERNANCE REVIEW WORKFLOW (g4 evidence / g5 clinical-safety / g9 journey)
//
// Closes the OPERATING gap: governance requirements existed, but turning them into assignable human
// work, collecting a structured decision, writing it into the canonical record and re-running the
// gates all required a developer. This module does those operations from canonical Product data.
//
//   PRODUCT
//   -> deriveReviewRequirements()    (canonical governance -> required human gates + items)
//   -> ensureRequiredHumanReviews()  (idempotent review jobs)
//   -> renderConsole()               (human-readable reviewer surface, never raw JSON)
//   -> validateSubmission()          (schema-validated, authority-checked, human-only)
//   -> submitReview()                (writes product.human_review.reviews[gate])
//   -> reevaluate()                  (EXISTING harness/product-qa-gate-runner.mjs)
//   -> updated g4/g5/g9              (g10 stays owner-only)
//
// It does NOT replace any governance: no second gate runner, no parallel approval store, no new
// g0-g10 system. AI may assemble, format and route; only a HUMAN may decide.
//
// Usage:
//   node harness/review-jobs.mjs ensure  <PRODUCT_ID> [--write] [--root <dir>]
//   node harness/review-jobs.mjs list    [--status <s>] [--gate <g>] [--root <dir>]
//   node harness/review-jobs.mjs render  <PRODUCT_ID> [--write] [--root <dir>]     (console + exports)
//   node harness/review-jobs.mjs export  <PRODUCT_ID> <GATE> [--root <dir>]
//   node harness/review-jobs.mjs submit  <PRODUCT_ID> <GATE> --file <submission.json> [--write] [--root <dir>]
//   node harness/review-jobs.mjs status  <PRODUCT_ID> [--root <dir>]
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020.js";
import {
  AUTHORITIES, REVIEW_INPUT_VERSION, reviewInputFor, claimInventory, safetyInventory,
  JOURNEY_CHECKLIST, hashInput, sha256,
} from "./review-inputs.mjs";
import { evaluateProductGates, VERDICT } from "./product-qa-gate-runner.mjs";

const MODULE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const REVIEW_JOB_VERSION = "1.0";
export const REVIEW_WORKFLOW_VERSION = "1.0";

export const GATE_AUTHORITY = Object.freeze({
  g4_evidence: "EVIDENCE_AUTHORITY",
  g5_safety: "CLINICAL_AUTHORITY",
  g9_journey: "JOURNEY_AUTHORITY",
});
export const GATE_REVIEW_TYPE = Object.freeze({
  g4_evidence: "EVIDENCE_REVIEW",
  g5_safety: "CLINICAL_SAFETY_REVIEW",
  g9_journey: "JOURNEY_REVIEW",
});
export const GATE_LABEL = Object.freeze({
  g4_evidence: "g4 - Evidence Review",
  g5_safety: "g5 - Clinical / Safety Review",
  g9_journey: "g9 - Customer Journey Review",
});
export const HUMAN_REVIEW_GATES = Object.freeze(Object.keys(GATE_AUTHORITY));

/** Canonical item dispositions. The existing architecture has no review-disposition enum, so this is
 *  the minimum vocabulary grounded in qa-standard section 4/5 semantics + the claim-label model. */
export const DISPOSITIONS = Object.freeze({
  g4_evidence: ["SUPPORTED", "SUPPORTED_WITH_LIMITATION", "SOURCE_REQUIRED", "REVISION_REQUIRED", "NON_EVIDENCE_CLAIM"],
  g5_safety: ["ACCEPTABLE", "REVISION_REQUIRED", "SOURCE_REQUIRED", "CLINICAL_ESCALATION_REQUIRED"],
  g9_journey: ["WORKS", "DEFECT", "UNVERIFIED"],
});
/** Dispositions that do NOT block the gate. */
export const PASSING_DISPOSITIONS = Object.freeze({
  g4_evidence: ["SUPPORTED", "SUPPORTED_WITH_LIMITATION", "NON_EVIDENCE_CLAIM"],
  g5_safety: ["ACCEPTABLE"],
  g9_journey: ["WORKS"],
});
export const REVIEWER_REQUIREMENTS = Object.freeze({
  g4_evidence: { role: "Independent evidence reviewer", qualification: "Evidence appraisal (sourcing, population/applicability, limitations)", independence: "Never the builder/author of the product or transformation" },
  g5_safety: { role: "Qualified clinical / safety reviewer", qualification: "Perinatal / paediatric / mental-health clinical qualification as appropriate to the item's risk domain", independence: "Never the builder/author of the product or transformation" },
  g9_journey: { role: "Authorised human journey reviewer / operator", qualification: "Access to the live platform surfaces (owner or delegated operator)", independence: "Never an AI simulation or a marketing review" },
});

/** Marker taxonomy for content-level safety guardrails, grounded in standards/safety-standard.md sections 3-4. */
export const GUARDRAIL_MARKERS = Object.freeze([
  { concept: "infant-safe-sleep", risk_domain: "infant safe-sleep", re: /safe[- ]sleep|on their back|firm, flat|blankets, pillows|bumper|co-?sleep/i, source: "safety-standard section 4 (safe sleep)" },
  { concept: "shift-vigilance-awake", risk_domain: "vigilance", re: /stays? fully awake|risk of falling asleep|never hold the baby in a bed/i, source: "safety-standard section 4 (vigilance)" },
  { concept: "shift-vigilance-no-sedation", risk_domain: "vigilance", re: /earplugs|sleep aids|sleep-inducing/i, source: "safety-standard section 4 (no sedation on shift)" },
  { concept: "baby-first-assessment", risk_domain: "baby-first assessment", re: /check the baby first|baby comes first|overrides the roster|roster never takes priority/i, source: "safety-standard section 4 (baby-first)" },
]);

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const now = () => new Date().toISOString();
const normText = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,;:]+$/, "");
const uniqText = (arr) => { const seen = new Set(); const out = []; for (const x of arr ?? []) { const k = normText(x); if (!k || seen.has(k)) continue; seen.add(k); out.push(String(x).trim()); } return out; };
const firstSentence = (line) => { const m = String(line).replace(/^[-*\d.\s]+/, "").replace(/\*\*/g, "").split(/(?<=[.!?])\s+/)[0]; return m.trim(); };

// ------------------------------------------------------------------------------------------------
// Item derivation (canonical data -> reviewable items, canonical IDs preserved)
// ------------------------------------------------------------------------------------------------
/** Content-level safety guardrails found in the product's own safety-relevant asset content. */
export function safetyGuardrailItems(product, root = MODULE_ROOT) {
  const pdir = join(root, "data", "products", product?.product_id ?? "");
  const assetIds = Object.values(product?.asset_map ?? {}).flatMap((v) => (Array.isArray(v) ? v : []));
  const files = [];
  for (const aid of assetIds) {
    const p = join(pdir, "assets", `${aid}.json`);
    if (!existsSync(p)) continue;
    const a = readJson(p);
    // an asset is safety-relevant when the product or the record says so (canonical, not hardcoded per product)
    const relevant = a.safety_relevant === true || ["DO", "RESCUE"].includes(String(a.job ?? "").toUpperCase());
    if (!relevant || !isStr(a.source_path)) continue;
    files.push(String(a.source_path).split("#")[0]);
  }
  const found = new Map();
  for (const rel of files) {
    const abs = join(pdir, rel.replace(/^\.?\//, ""));
    if (!existsSync(abs)) continue;
    const lines = readFileSync(abs, "utf8").split(/\r?\n/);
    for (const m of GUARDRAIL_MARKERS) {
      if (found.has(m.concept)) continue;
      const hit = lines.find((l) => m.re.test(l) && l.trim().length > 20);
      if (hit) found.set(m.concept, { concept: m.concept, risk_domain: m.risk_domain, guardrail_source: m.source, content: firstSentence(hit), location: rel });
    }
  }
  return [...found.values()];
}

/** Derive the reviewable item list for a gate from canonical records only. */
export function deriveItems(gate, product, transformation, root = MODULE_ROOT) {
  if (gate === "g4_evidence") {
    const declared = product?.evidence?.sources ?? [];
    return claimInventory(product, transformation).map((c) => ({
      item_id: c.claim_id,
      claim: c.claim,
      category: c.category,
      location: c.location,
      evidence_requirement: c.label,
      declared_source_pool: declared,
      claims_inventory_summary: `${c.category} claim derived from ${c.location}`,
      dispositions_allowed: DISPOSITIONS.g4_evidence,
      reviewer_disposition: "",
      reviewer_notes: "",
    }));
  }
  if (gate === "g5_safety") {
    const s = product?.safety ?? {};
    const t = transformation?.safety ?? {};
    const items = [];
    let n = 0;
    const push = (content, risk_domain, location, extra = {}) => {
      if (!isStr(content)) return;
      n += 1;
      items.push({
        item_id: `S-${String(n).padStart(2, "0")}`, content: String(content).trim(), risk_domain, location,
        review_question: extra.review_question ?? `Is this ${risk_domain} item correct, complete and safe as written?`,
        required_reviewer_expertise: extra.expertise ?? "clinical (perinatal / paediatrics / mental health as applicable)",
        dispositions_allowed: DISPOSITIONS.g5_safety, reviewer_disposition: "", reviewer_notes: "",
        ...extra,
      });
    };
    push(s.disclaimer, "scope/disclaimer", "product.safety.disclaimer", { expertise: "clinical + product safety" });
    for (const f of uniqText([...(s.red_flags ?? []), ...(t.red_flags ?? [])])) push(f, "maternal mental-health / safety", "product.safety.red_flags + transformation.safety.red_flags");
    for (const r of uniqText([...(s.escalation_rules ?? []), ...(t.escalation_rules ?? [])])) push(r, "escalation", "product.safety.escalation_rules + transformation.safety.escalation_rules");
    push(t.scope_boundary, "scope boundary", `${transformation?.transformation_id ?? "transformation"}.safety.scope_boundary`);
    for (const g of safetyGuardrailItems(product, root)) push(g.content, g.risk_domain, g.location, { guardrail_source: g.guardrail_source, source: "asset content" });
    return items;
  }
  if (gate === "g9_journey") {
    const wp = product?.publishing?.wordpress_ids ?? {};
    return JOURNEY_CHECKLIST.map((c) => ({
      item_id: `J-${String(c.n).padStart(2, "0")}`,
      n: c.n,
      question: c.question,
      exact_artifacts: c.artifacts,
      runtime_refs: { wordpress_ids: wp, tsm_measurement_days: transformation?.tsm?.measurement_days ?? null },
      dispositions_allowed: DISPOSITIONS.g9_journey, reviewer_disposition: "", reviewer_notes: "",
    }));
  }
  return [];
}

/** Derive the required human reviews for a product from canonical governance. */
export function deriveReviewRequirements(productId, { root = MODULE_ROOT } = {}) {
  const pdir = join(root, "data", "products", productId);
  const ppath = join(pdir, "product.json");
  if (!existsSync(ppath)) return { ok: false, error: `no product.json at data/products/${productId}`, requirements: [] };
  const product = readJson(ppath);
  const trId = product?.identity?.transformation_id ?? null;
  const tpath = trId ? join(root, "data", "transformations", `${trId}.json`) : null;
  const transformation = tpath && existsSync(tpath) ? readJson(tpath) : null;
  if (!transformation) return { ok: false, error: `transformation '${trId}' not found`, requirements: [] };

  const requirements = [];
  for (const gate of HUMAN_REVIEW_GATES) {
    const items = deriveItems(gate, product, transformation, root);
    const { input, input_hash } = reviewInputFor(gate, product, transformation);
    let required = items.length > 0;
    let reason = `${items.length} canonical ${gate === "g4_evidence" ? "evidence claim(s)" : gate === "g5_safety" ? "safety item(s)" : "journey check(s)"} require this authority`;
    if (gate === "g5_safety" && required) {
      // Any product carrying a safety surface requires a human safety review (low risk -> human safety
      // reviewer, moderate/high/clinical -> CLINICAL authority). A product with no safety items at all
      // cannot be reviewed here - its g5 state is SOURCE_REQUIRED, so no job is manufactured.
      reason = `${items.length} safety item(s); risk_level='${product?.safety?.risk_level ?? "unknown"}'`;
    }
    if (!required) continue;
    const risk = product?.safety?.risk_level ?? null;
    const clinical_required = gate === "g5_safety" && ["moderate", "high", "clinical"].includes(risk);
    requirements.push({
      gate,
      review_type: GATE_REVIEW_TYPE[gate],
      required_authority: GATE_AUTHORITY[gate],
      clinical_required,
      risk_level: risk,
      required: true,
      reason,
      reviewer_requirement: REVIEWER_REQUIREMENTS[gate],
      items,
      item_count: items.length,
      input_refs: {
        g4_evidence: ["product.evidence", `${trId}.evidence`, `${trId}.mechanism.evidence_basis`],
        g5_safety: ["product.safety", `${trId}.safety`, "asset content safety guardrails"],
        g9_journey: ["product.content", "product.publishing.wordpress_ids", `${trId}.tsm.measurement_days`, "product.transformation.next_transformation_ids"],
      }[gate],
      input_hash,
      input_version: REVIEW_INPUT_VERSION,
      product, transformation,
    });
  }
  return { ok: true, product, transformation, transformation_id: trId, requirements, input_hashes: Object.fromEntries(requirements.map((r) => [r.gate, r.input_hash])) };
}

// ------------------------------------------------------------------------------------------------
// Job store (canonical, per-product, deterministic ids - never random)
// ------------------------------------------------------------------------------------------------
export const reviewsDir = (root, productId) => join(root, "data", "products", productId, "reviews");
export const jobId = (productId, gate) => `RJ-${productId}-${gate}`;
export const jobPath = (root, productId, gate) => join(reviewsDir(root, productId), `${gate}.job.json`);
export const submissionPath = (root, productId, gate) => join(reviewsDir(root, productId), `${gate}.submission.json`) ;
export const exportPath = (root, productId, gate) => join(reviewsDir(root, productId), `${gate}.md`);
export const consolePath = (root, productId) => join(reviewsDir(root, productId), "console.html");

export function buildJob(requirement, { existing = null } = {}) {
  const productId = requirement.product.product_id;
  const gate = requirement.gate;
  const base = {
    review_job_id: jobId(productId, gate),
    product_id: productId,
    transformation_id: requirement.product?.identity?.transformation_id ?? null,
    gate,
    review_type: requirement.review_type,
    required_authority: requirement.required_authority,
    clinical_required: !!requirement.clinical_required,
    risk_level: requirement.risk_level,
    status: "PENDING",
    reviewer_requirement: requirement.reviewer_requirement,
    assigned_reviewer: null,
    input_refs: requirement.input_refs,
    input_hash: requirement.input_hash,
    input_version: requirement.input_version,
    items: requirement.items,
    item_count: requirement.items.length,
    created_at: now(),
    updated_at: now(),
    started_at: null,
    submitted_at: null,
    saved_progress_at: null,
    decision: null,
    canonical_record_ref: `product.human_review.reviews.${gate}`,
    revision: 1,
    superseded_at: null,
    superseded_reason: null,
  };
  if (!existing) return base;

  // Idempotent reuse: same material -> keep the job (and any partial progress / valid decision).
  const sameInput = existing.input_hash === requirement.input_hash;
  const merged = { ...existing, item_count: base.item_count, input_refs: base.input_refs, reviewer_requirement: base.reviewer_requirement, clinical_required: base.clinical_required, risk_level: base.risk_level, updated_at: now() };
  if (sameInput) {
    // preserve reviewer dispositions by item_id; keep only items that still exist (canonical ids stable)
    const prior = new Map((existing.items ?? []).map((i) => [i.item_id, i]));
    merged.items = base.items.map((i) => {
      const old = prior.get(i.item_id);
      if (!old) return i;
      const d = old.reviewer_disposition;
      if (!isStr(d) || !i.dispositions_allowed.includes(d)) return i;
      return { ...i, reviewer_disposition: d, reviewer_notes: old.reviewer_notes ?? "" };
    });
    const saved = merged.items.filter((i) => isStr(i.reviewer_disposition)).length;
    if (merged.decision) merged.status = existing.status;
    else if (saved === 0) merged.status = existing.status === "ASSIGNED" ? "ASSIGNED" : "PENDING";
    else merged.status = "IN_REVIEW";
    return merged;
  }
  // Material change: the previous decision (if any) no longer corresponds to the reviewed material.
  if (existing.decision) {
    merged.superseded_at = now();
    merged.superseded_reason = `governed input changed (input hash ${existing.input_hash.slice(0, 12)} -> ${base.input_hash.slice(0, 12)})`;
    merged.decision = null;
  }
  merged.revision = (existing.revision ?? 1) + 1;
  merged.status = "STALE";
  return merged;
}

/** Derive + persist review jobs. Idempotent: repeated runs never duplicate and never drop valid work. */
export function ensureRequiredHumanReviews(productId, { root = MODULE_ROOT, write = false } = {}) {
  const derived = deriveReviewRequirements(productId, { root });
  if (!derived.ok) return { ok: false, error: derived.error, jobs: [], created: [], reused: [], stale: [], actions: [] };
  const jobs = [], created = [], reused = [], stale = [], actions = [];
  for (const req of derived.requirements) {
    const p = jobPath(root, productId, req.gate);
    const existing = existsSync(p) ? readJson(p) : null;
    const job = buildJob(req, { existing });
    jobs.push(job);
    if (!existing) { created.push(req.gate); actions.push({ gate: req.gate, action: "CREATE", status: job.status }); }
    else if (job.status === "STALE") { stale.push(req.gate); actions.push({ gate: req.gate, action: "REOPEN_STALE", status: job.status, superseded: job.superseded_reason }); }
    else { reused.push(req.gate); actions.push({ gate: req.gate, action: "REUSE", status: job.status }); }
    if (write) {
      mkdirSync(reviewsDir(root, productId), { recursive: true });
      writeFileSync(p, `${JSON.stringify(job, null, 2)}\n`, "utf8");
    }
  }
  return { ok: true, product: derived.product, transformation: derived.transformation, transformation_id: derived.transformation_id, requirements: derived.requirements, jobs, created, reused, stale, actions, written: !!write };
}

export function loadJob(root, productId, gate) {
  const p = jobPath(root, productId, gate);
  return existsSync(p) ? readJson(p) : null;
}

export function listJobFiles(root = MODULE_ROOT) {
  const out = [];
  const base = join(root, "data", "products");
  if (!existsSync(base)) return out;
  for (const pid of readdirSync(base)) {
    const dir = join(base, pid, "reviews");
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".job.json"))) out.push({ product_id: pid, path: join(dir, f), job: readJson(join(dir, f)) });
  }
  return out;
}

// ------------------------------------------------------------------------------------------------
// Submission validation (structured, authority-checked, human-only)
// ------------------------------------------------------------------------------------------------
const AI_IDENTITY = /^(ai|a\.i\.|opencode|open-code|bot|automation|automatic|system|machine|llm|gpt|model|builder|generator|null|unknown|n\/a|none|test)/i;

export function validateSubmission(job, submission, { root = MODULE_ROOT } = {}) {
  const errors = [];
  if (!job) return { ok: false, errors: ["no review job found - run ensure first"] };
  if (!submission || typeof submission !== "object") return { ok: false, errors: ["submission is not an object"] };
  if (submission.review_job_id !== job.review_job_id) errors.push(`review_job_id mismatch (job ${job.review_job_id}, submission ${submission.review_job_id ?? "missing"})`);
  if (submission.gate !== job.gate) errors.push(`gate mismatch (job ${job.gate}, submission ${submission.gate ?? "missing"})`);
  if (submission.authority !== job.required_authority) errors.push(`authority mismatch: this job requires ${job.required_authority} (got ${submission.authority ?? "missing"}) - a different authority cannot satisfy this gate`);
  if (submission.reviewer_kind !== "HUMAN") errors.push(`reviewer_kind must be "HUMAN" (got ${JSON.stringify(submission.reviewer_kind ?? null)}) - AI/automation cannot authorise`);
  if (!isStr(submission.reviewer)) errors.push("reviewer identity is required (no anonymous approval)");
  else if (AI_IDENTITY.test(String(submission.reviewer).trim())) errors.push(`reviewer "${submission.reviewer}" looks like an automated/AI identity - a named human is required`);
  if (submission.input_hash !== job.input_hash) errors.push(`stale submission: input hash ${String(submission.input_hash).slice(0, 12)} does not match the current review input ${job.input_hash.slice(0, 12)}`);
  if (job.required_authority === "CLINICAL_AUTHORITY" && job.clinical_required && !isStr(submission.reviewer_role)) errors.push("clinical review requires reviewer_role");
  if (job.required_authority === "EVIDENCE_AUTHORITY" && submission.independent_from_builder !== true && submission.independent_from_builder !== false) errors.push("evidence review must declare independent_from_builder (true/false)");

  const decisionsIn = Array.isArray(submission.items) ? submission.items : [];
  const byId = new Map(decisionsIn.map((d) => [d?.item_id, d]));
  const missing = [], bad = [];
  for (const item of job.items ?? []) {
    const d = byId.get(item.item_id);
    if (!d || !isStr(d.disposition)) { missing.push(item.item_id); continue; }
    if (!item.dispositions_allowed.includes(d.disposition)) bad.push(`${item.item_id}:${d.disposition}`);
  }
  const unknown = decisionsIn.filter((d) => !(job.items ?? []).some((i) => i.item_id === d?.item_id)).map((d) => d?.item_id ?? "(none)");
  if (unknown.length) errors.push(`decisions reference unknown item ids: ${unknown.join(", ")}`);
  if (bad.length) errors.push(`invalid disposition(s) for ${job.gate}: ${bad.join(", ")} (allowed: ${DISPOSITIONS[job.gate].join(", ")})`);
  if (missing.length) errors.push(`${missing.length} item(s) have no decision (partial submissions never resolve a gate): ${missing.slice(0, 12).join(", ")}${missing.length > 12 ? "…" : ""}`);

  const overall = errors.length ? null : (
    decisionsIn.some((d) => d.disposition === "SOURCE_REQUIRED") ? "SOURCE_REQUIRED"
      : decisionsIn.some((d) => d.disposition === "REVISION_REQUIRED" || d.disposition === "DEFECT" || d.disposition === "CLINICAL_ESCALATION_REQUIRED" || d.disposition === "UNVERIFIED") ? "REVISION_REQUIRED"
        : "RESOLVED");
  return {
    ok: errors.length === 0,
    errors,
    overall,
    item_decisions: (job.items ?? []).map((i) => ({ item_id: i.item_id, disposition: byId.get(i.item_id)?.disposition ?? null, notes: byId.get(i.item_id)?.notes ?? "" })),
    source_required: (job.items ?? []).filter((i) => byId.get(i.item_id)?.disposition === "SOURCE_REQUIRED").map((i) => i.item_id),
    revision_required: (job.items ?? []).filter((i) => ["REVISION_REQUIRED", "DEFECT"].includes(byId.get(i.item_id)?.disposition)).map((i) => i.item_id),
    escalations: (job.items ?? []).filter((i) => byId.get(i.item_id)?.disposition === "CLINICAL_ESCALATION_REQUIRED").map((i) => i.item_id),
    defects: (job.items ?? []).filter((i) => byId.get(i.item_id)?.disposition === "DEFECT").map((i) => i.item_id),
  };
}

// ------------------------------------------------------------------------------------------------
// Canonical write-back + gate re-evaluation
// ------------------------------------------------------------------------------------------------
export function submitReview(productId, gate, submission, { root = MODULE_ROOT, write = false } = {}) {
  const job = loadJob(root, productId, gate);
  if (!job) return { ok: false, status: VERDICT.REVIEW_REQUIRED, errors: [`no review job for ${productId}/${gate} - run ensure first`] };
  const v = validateSubmission(job, submission, { root });
  if (!v.ok) return { ok: false, job, errors: v.errors, validation: v };

  const resolved_at = submission.reviewed_at || now();
  const record = {
    authority: job.required_authority,
    status: v.overall,
    review_job_id: job.review_job_id,
    review_type: job.review_type,
    input_hash: job.input_hash,
    input_version: job.input_version,
    reviewed_at: resolved_at,
    resolved_at: v.overall === "RESOLVED" ? resolved_at : null,
    resolved_by: String(submission.reviewer).trim(),
    reviewer_kind: "HUMAN",
    reviewer_role: submission.reviewer_role ?? job.reviewer_requirement.role,
    reviewer_qualification: submission.reviewer_qualification ?? job.reviewer_requirement.qualification ?? null,
    independent_from_builder: submission.independent_from_builder ?? null,
    resolution: submission.notes ?? (
      v.overall === "RESOLVED" ? `${job.review_type} completed: all ${job.item_count} item(s) dispositioned with no blocking finding`
        : `${job.review_type} returned ${v.overall} (${v.source_required.length} source-required, ${v.revision_required.length} revision-required, ${v.escalations.length} clinical escalations, ${v.defects.length} journey defects)`
    ),
    item_count: job.item_count,
    item_decisions: v.item_decisions,
    source_required: v.source_required,
    revision_required: v.revision_required,
    escalations: v.escalations,
    defects: v.defects,
    notes: submission.notes ?? null,
  };

  const pdir = join(root, "data", "products", productId);
  const result = { ok: true, job, record, validation: v, written: false, gate_results: null };
  if (!write) return result;

  // 1. canonical write-back into the EXISTING product record (per-authority)
  const ppath = join(pdir, "product.json");
  const product = readJson(ppath);
  product.human_review = product.human_review && typeof product.human_review === "object" ? product.human_review : { status: "PENDING_HUMAN_REVIEW", reason: "human governance reviews tracked per authority", created_at: now() };
  product.human_review.reviews = product.human_review.reviews && typeof product.human_review.reviews === "object" ? product.human_review.reviews : {};
  product.human_review.reviews[gate] = record;
  // legacy top-level status mirrors the aggregate (never gate authority by itself)
  const gates = Object.values(product.human_review.reviews);
  const anyRevision = gates.some((g) => ["REVISION_REQUIRED", "SOURCE_REQUIRED", "BLOCKED"].includes(g.status));
  const allRequired = HUMAN_REVIEW_GATES.every((g) => product.human_review.reviews[g] && product.human_review.reviews[g].status === "RESOLVED");
  product.human_review.status = anyRevision ? "BLOCKED" : (allRequired ? "RESOLVED" : "PENDING_HUMAN_REVIEW");
  product.human_review.reason = `${gates.filter((g) => g.status === "RESOLVED").length}/${HUMAN_REVIEW_GATES.length} required human reviews resolved`;
  writeFileSync(ppath, `${JSON.stringify(product, null, 2)}\n`, "utf8");

  // 2. persist the job (decision + item dispositions)
  const updated = { ...job, status: v.overall, submitted_at: resolved_at, updated_at: now(), decision: {
    overall: v.overall, resolved_by: record.resolved_by, reviewer_kind: "HUMAN", reviewer_role: record.reviewer_role,
    reviewer_qualification: record.reviewer_qualification, independent_from_builder: record.independent_from_builder,
    authority: record.authority, resolved_at, input_hash_reviewed: job.input_hash, item_decisions: v.item_decisions,
    source_required: v.source_required, revision_required: v.revision_required, escalations: v.escalations, defects: v.defects, notes: record.notes,
  } };
  updated.items = (job.items ?? []).map((i) => {
    const d = v.item_decisions.find((x) => x.item_id === i.item_id);
    return { ...i, reviewer_disposition: d?.disposition ?? "", reviewer_notes: d?.notes ?? "" };
  });
  writeFileSync(jobPath(root, productId, gate), `${JSON.stringify(updated, null, 2)}\n`, "utf8");

  // 3. audit trail (append-only)
  mkdirSync(reviewsDir(root, productId), { recursive: true });
  const audit = join(reviewsDir(root, productId), "audit-log.json");
  const log = existsSync(audit) ? readJson(audit) : { record_type: "REVIEW_AUDIT_LOG", product_id: productId, entries: [] };
  log.entries.push({ at: now(), gate, review_job_id: job.review_job_id, action: "SUBMIT", reviewer: record.resolved_by, reviewer_kind: "HUMAN", authority: record.authority, reviewer_role: record.reviewer_role, qualification: record.reviewer_qualification, independent_from_builder: record.independent_from_builder, input_hash: job.input_hash, item_count: job.item_count, overall: v.overall, source_required: v.source_required, revision_required: v.revision_required, escalations: v.escalations, defects: v.defects, canonical_record_ref: `product.human_review.reviews.${gate}` });
  writeFileSync(audit, `${JSON.stringify(log, null, 2)}\n`, "utf8");

  result.written = true;
  result.job = updated;
  result.gate_results = reevaluate(productId, { root }).gate_results;
  return result;
}

/** Canonical re-evaluation - the EXISTING gate runner, never a second evaluator. */
export function reevaluate(productId, { root = MODULE_ROOT } = {}) {
  const evaluation = evaluateProductGates(productId, { root });
  return { status: evaluation.status, gate_results: evaluation.gate_results, gate_matrix: evaluation.gate_matrix, manifest_eligible: evaluation.manifest_eligible, blocking_gates: evaluation.blocking_gates };
}

// ------------------------------------------------------------------------------------------------
// Reviewer surface (human-readable; JSON remains the machine contract)
// ------------------------------------------------------------------------------------------------
export function exportJobMarkdown(job, { product = null } = {}) {
  const L = [];
  L.push(`# ${GATE_LABEL[job.gate]}`);
  L.push("");
  L.push(`- Product: **${product?.identity?.name ?? job.product_id}** (${job.product_id})`);
  L.push(`- Transformation: ${job.transformation_id ?? "-"}`);
  L.push(`- Review job: \`${job.review_job_id}\` (revision ${job.revision})`);
  L.push(`- Required authority: **${job.required_authority}**${job.clinical_required ? " (clinical)" : ""}`);
  L.push(`- Reviewer requirement: ${job.reviewer_requirement.role} - ${job.reviewer_requirement.qualification ?? ""}`);
  L.push(`- Independence: ${job.reviewer_requirement.independence}`);
  L.push(`- Status: ${job.status} | Items: ${job.item_count}`);
  L.push(`- Input hash: \`${job.input_hash}\` (bind the review to this exact material)`);
  L.push("");
  L.push(`## Items (${job.item_count})`);
  L.push("");
  for (const it of job.items ?? []) {
    L.push(`### ${it.item_id}`);
    L.push("");
    if (it.claim) L.push(`**Claim:** ${it.claim}`);
    if (it.content) L.push(`**Content:** ${it.content}`);
    if (it.question) L.push(`**Question:** ${it.question}`);
    if (it.location) L.push(`- Where used: ${it.location}`);
    if (it.evidence_requirement) L.push(`- Evidence requirement: ${it.evidence_requirement}`);
    if (it.risk_domain) L.push(`- Risk domain: ${it.risk_domain}`);
    if (it.exact_artifacts) L.push(`- Artifacts: ${(it.exact_artifacts ?? []).join(", ")}`);
    if (it.review_question && it.review_question !== it.question) L.push(`- Review question: ${it.review_question}`);
    if (it.required_reviewer_expertise) L.push(`- Required expertise: ${it.required_reviewer_expertise}`);
    L.push(`- Decision: [${(it.dispositions_allowed ?? []).join("] [")}]`);
    L.push(`- Notes: ${it.reviewer_notes || "—"}`);
    L.push("");
  }
  L.push("---");
  L.push("");
  L.push("This Markdown is an EXPORT for offline/external review. The canonical state is the structured");
  L.push(`review job and the human decision written back to \`product.human_review.reviews.${job.gate}\`.`);
  return L.join("\n");
}

/** Deterministic static reviewer console: queue + per-job readable item views + submission builder. */
export function renderConsole(root, { productId = null, write = false } = {}) {
  const jobs = listJobFiles(root).filter((j) => !productId || j.product_id === productId);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const cards = jobs.map(({ job, product_id }) => {
    const items = (job.items ?? []).map((it) => {
      const opts = (it.dispositions_allowed ?? []).map((d) => `<label class="opt"><input type="radio" name="${esc(job.gate)}:${esc(it.item_id)}" value="${esc(d)}" data-job="${esc(job.review_job_id)}" data-item="${esc(it.item_id)}"> ${esc(d.replace(/_/g, " "))}</label>`).join("");
      const body = it.claim ? `<p class="body">${esc(it.claim)}</p>` : it.content ? `<p class="body">${esc(it.content)}</p>` : "";
      const q = it.question ? `<p class="q">${esc(it.question)}</p>` : (it.review_question ? `<p class="q">${esc(it.review_question)}</p>` : "");
      const meta = [it.location && `Where used: ${esc(it.location)}`, it.evidence_requirement && `Evidence requirement: ${esc(it.evidence_requirement)}`, it.risk_domain && `Risk domain: ${esc(it.risk_domain)}`, it.exact_artifacts && `Artifacts: ${esc((it.exact_artifacts ?? []).join(", "))}`, it.required_reviewer_expertise && `Expertise: ${esc(it.required_reviewer_expertise)}`].filter(Boolean).map((m) => `<li>${m}</li>`).join("");
      return `<div class="item"><div class="iid">${esc(it.item_id)}</div>${body}${q}<ul class="meta">${meta}</ul><div class="opts">${opts}</div><textarea class="notes" data-job="${esc(job.review_job_id)}" data-item="${esc(it.item_id)}" placeholder="Notes (optional)"></textarea></div>`;
    }).join("");
    return `<section class="job" data-job="${esc(job.review_job_id)}" data-gate="${esc(job.gate)}" data-input-hash="${esc(job.input_hash)}" data-authority="${esc(job.required_authority)}">
  <header><h2>${esc(GATE_LABEL[job.gate])} <span class="pill ${esc(job.status.toLowerCase())}">${esc(job.status)}</span></h2>
  <p class="sub">${esc(product_id)} · <code>${esc(job.review_job_id)}</code> · ${job.item_count} items · authority <strong>${esc(job.required_authority)}</strong>${job.clinical_required ? " (clinical)" : ""} · revision ${job.revision}</p>
  <p class="req">${esc(job.reviewer_requirement.role)} — ${esc(job.reviewer_requirement.qualification ?? "")}<br><span class="ind">${esc(job.reviewer_requirement.independence)}</span></p>
  <p class="sub">Input hash <code>${esc(job.input_hash)}</code> (the review is bound to this exact material)</p></header>
  <div class="items">${items}</div>
  <div class="submitter"><input class="who" placeholder="Your full name (the named human reviewer)" data-job="${esc(job.review_job_id)}">
  <input class="role" placeholder="Your role / qualification" data-job="${esc(job.review_job_id)}">
  <button class="build" data-job="${esc(job.review_job_id)}">Build submission JSON</button>
  <pre class="out" data-job="${esc(job.review_job_id)}"></pre></div></section>`;
  }).join("\n");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Swiipt Review Console</title><style>
:root{--navy:#0B1F33;--purple:#6F35B5;--gold:#D9A52E;--cream:#F8F4EC;--line:#DDE2E7;--ink:#17212B}
*{box-sizing:border-box}body{margin:0;font:15px/1.6 Inter,system-ui,sans-serif;background:var(--cream);color:var(--ink)}
header.top{background:var(--navy);color:#fff;padding:22px 26px}header.top h1{margin:0;font-size:20px}
main{max-width:1000px;margin:0 auto;padding:26px}
.job{background:#fff;border:1px solid var(--line);border-radius:14px;padding:22px;margin-bottom:22px}
.job h2{margin:0 0 4px;font-size:17px;color:var(--navy)}
.pill{font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px;background:#EEF1F5;color:#3B4A5A;vertical-align:middle}
.pill.pending{background:#FFF4E0;color:#8A5B00}.pill.resolved{background:#E7F6EC;color:#166534}.pill.stale,.pill.revision_required,.pill.source_required{background:#FDE8E8;color:#991B1B}
.sub,.req{color:#4A5A6A;font-size:13px;margin:2px 0}.ind{color:#7A8794;font-style:italic}
.item{border-top:1px solid var(--line);padding:14px 0}
.iid{font:700 12px ui-monospace,monospace;color:var(--purple);letter-spacing:.04em}
.body{margin:6px 0;font-size:15px}.q{margin:6px 0;font-weight:600;color:var(--navy)}
.meta{margin:6px 0 10px;padding-left:18px;color:#5A6A7A;font-size:13px}
.opts{display:flex;flex-wrap:wrap;gap:10px 16px;margin-bottom:8px}
.opt{display:inline-flex;align-items:center;gap:6px;font-size:13px;background:#F4F6F8;border:1px solid var(--line);border-radius:8px;padding:5px 10px;cursor:pointer}
textarea.notes{width:100%;min-height:42px;border:1px solid var(--line);border-radius:8px;padding:8px;font:inherit;font-size:13px}
.submitter{margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.submitter input{flex:1;min-width:200px;border:1px solid var(--line);border-radius:8px;padding:9px}
button.build{background:var(--purple);color:#fff;border:0;border-radius:8px;padding:10px 18px;font-weight:600;cursor:pointer}
pre.out{width:100%;background:#0B1F33;color:#DCE6F2;border-radius:10px;padding:12px;font-size:12px;overflow:auto;display:none}
footer{max-width:1000px;margin:0 auto;padding:0 26px 40px;color:#6B7A8A;font-size:13px}
</style></head><body>
<header class="top"><h1>Swiipt Review Console</h1><p>Human governance reviews · g4 evidence · g5 clinical/safety · g9 journey</p></header>
<main>${cards || "<p>No review jobs found. Run <code>ensure</code> first.</p>"}</main>
<footer><p>Choose a disposition for every item, enter your name, then Build submission JSON and import it with
<code>node harness/review-jobs.mjs submit &lt;PRODUCT&gt; &lt;GATE&gt; --file &lt;file&gt; --write</code>.
Partial reviews are saved but never resolve a gate.</p></footer>
<script>
document.querySelectorAll('button.build').forEach(function(b){b.addEventListener('click',function(){
  var job=b.dataset.job, sec=document.querySelector('.job[data-job="'+job+'"]');
  var items=[]; sec.querySelectorAll('.item').forEach(function(it){
    var id=it.querySelector('.iid').textContent.trim();
    var sel=it.querySelector('input[type=radio]:checked');
    items.push({item_id:id,disposition:sel?sel.value:null,notes:(it.querySelector('textarea.notes')||{}).value||''});
  });
  var who=(sec.querySelector('input.who')||{}).value||''; var role=(sec.querySelector('input.role')||{}).value||'';
  var out={review_job_id:job,gate:sec.dataset.gate,authority:sec.dataset.authority,reviewer_kind:'HUMAN',reviewer:who,reviewer_role:role,input_hash:sec.dataset.inputHash,items:items};
  var pre=sec.querySelector('pre.out'); pre.style.display='block'; pre.textContent=JSON.stringify(out,null,2);
});});
</script></body></html>`;
  const result = { html, job_count: jobs.length, path: null, written: false };
  if (write) {
    for (const { job, product_id } of jobs) {
      const dir = reviewsDir(root, product_id);
      mkdirSync(dir, { recursive: true });
      const pdir = join(root, "data", "products", product_id);
      const product = existsSync(join(pdir, "product.json")) ? readJson(join(pdir, "product.json")) : null;
      writeFileSync(exportPath(root, product_id, job.gate), exportJobMarkdown(job, { product }));
    }
    const dir = reviewsDir(root, productId ?? jobs[0]?.product_id ?? "");
    if (dir && (productId || jobs.length)) {
      mkdirSync(dir, { recursive: true });
      const p = join(dir, productId ? "console.html" : "console-all.html");
      writeFileSync(p, html, "utf8");
      result.path = p;
    }
    result.written = true;
  }
  return result;
}

// ------------------------------------------------------------------------------------------------
// CLI
// ------------------------------------------------------------------------------------------------
const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const get = (f) => { const i = args.indexOf(f); return i > -1 ? args[i + 1] : null; };
  const root = get("--root") ? resolve(get("--root")) : MODULE_ROOT;
  const write = args.includes("--write");
  const positional = args.filter((a) => !a.startsWith("--") && ![get("--root"), get("--file"), get("--status"), get("--gate")].includes(a));
  const pid = positional[1];
  const gate = positional[2];
  const out = (o) => { console.log(JSON.stringify(o, null, 2)); process.exit(o.ok === false ? 3 : 0); };

  if (cmd === "ensure") {
    if (!pid) { console.error("usage: review-jobs.mjs ensure <PRODUCT_ID> [--write] [--root <dir>]"); process.exit(2); }
    const r = ensureRequiredHumanReviews(pid, { root, write });
    out({ ok: r.ok, error: r.error, product_id: pid, transformation_id: r.transformation_id, written: r.written, created: r.created, reused: r.reused, stale: r.stale, actions: r.actions, jobs: (r.jobs ?? []).map((j) => ({ gate: j.gate, review_job_id: j.review_job_id, required_authority: j.required_authority, clinical_required: j.clinical_required, status: j.status, items: j.item_count, input_hash: j.input_hash.slice(0, 16) })) });
  } else if (cmd === "list") {
    const status = get("--status"), g = get("--gate");
    const jobs = listJobFiles(root).map((x) => x.job).filter((j) => (!status || j.status === status) && (!g || j.gate === g));
    out({ ok: true, count: jobs.length, jobs: jobs.map((j) => ({ review_job_id: j.review_job_id, product_id: j.product_id, gate: j.gate, status: j.status, authority: j.required_authority, items: j.item_count, assigned: j.assigned_reviewer?.name ?? null })) });
  } else if (cmd === "render") {
    if (!pid) { console.error("usage: review-jobs.mjs render <PRODUCT_ID> [--write]"); process.exit(2); }
    const r = renderConsole(root, { productId: pid, write });
    out({ ok: true, console: r.path, written: r.written, jobs: r.job_count });
  } else if (cmd === "export") {
    const job = loadJob(root, pid, gate);
    if (!job) { console.error(`no job ${pid}/${gate}`); process.exit(3); }
    const pdir = join(root, "data", "products", pid);
    const product = existsSync(join(pdir, "product.json")) ? readJson(join(pdir, "product.json")) : null;
    const md = exportJobMarkdown(job, { product });
    const p = exportPath(root, pid, gate);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, md, "utf8");
    console.log(p);
    process.exit(0);
  } else if (cmd === "submit") {
    const file = get("--file");
    if (!pid || !gate || !file) { console.error("usage: review-jobs.mjs submit <PRODUCT_ID> <GATE> --file <submission.json> [--write]"); process.exit(2); }
    const submission = readJson(resolve(file));
    const r = submitReview(pid, gate, submission, { root, write });
    out({ ok: r.ok, written: r.written, errors: r.errors, overall: r.record?.overall ?? null, resolved_by: r.record?.resolved_by ?? null, authority: r.record?.authority ?? null, gate_results: r.gate_results ?? null });
  } else if (cmd === "status") {
    if (!pid) { console.error("usage: review-jobs.mjs status <PRODUCT_ID>"); process.exit(2); }
    const jobs = listJobFiles(root).filter((x) => x.product_id === pid).map((x) => x.job);
    const re = jobs.length ? reevaluate(pid, { root }) : null;
    out({ ok: true, product_id: pid, jobs: jobs.map((j) => ({ gate: j.gate, status: j.status, items: j.item_count, revision: j.revision })), gate_results: re?.gate_results ?? null, manifest_eligible: re?.manifest_eligible ?? null, blocking: re?.blocking_gates ?? null });
  } else {
    console.error("commands: ensure | list | render | export | submit | status");
    process.exit(2);
  }
}
