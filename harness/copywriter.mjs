#!/usr/bin/env node
// Factory stage 5.5 Phase 3 - NARRATIVE SLOT ENRICHMENT (@lfe-copywriter runner).
//
// The Phase 1 generator (gen-content.mjs) produces thin-but-valid, mechanically
// templated prose (e.g. "Right now you are X. It feels like Y."). This module
// enriches the prose-heavy "narrative slots" into flowing, empathetic copy that
// reads crafted - while staying 100% derived from record fields. It NEVER invents
// claims, testimonials, or outcomes (honesty rule, copy-standard.md §4).
//
// Provider model (owner-approved 2026-08-26):
//   - deterministic (DEFAULT, always works, no network/key): composes prose from
//     transformation.before_state / after_state / mechanism / situation +
//     product.customer.* using natural connectors + the next-transformation
//     record for "why this is next" reasoning.
//   - openai (OPT-IN, dormant without OPENAI_API_KEY): calls the LLM to rewrite
//     the narrative slots only; on ANY failure it transparently falls back to
//     deterministic so the pipeline never breaks.
//
// Usage: imported by gen-content.mjs. Exports enrichContent(file, base, p, tr, assets, pdir).
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { chatCompletion, resolveModel, STATUS } from "../lib/provider-client.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const lcFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const ucFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
function joinList(arr) {
  if (!arr || !arr.length) return "";
  const items = arr.map(lcFirst);
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
function provider(env = process.env) {
  return (env.COPYWRITER_PROVIDER || "deterministic").toLowerCase();
}
const isBackfill = (s) => /^backfilled/i.test(s || "");

// -------- deterministic enrichment --------
function deterministicEnrich(file, L, p, tr, assets, pdir) {
  const sit = tr?.situation ?? {};
  const cust = p.customer ?? {};
  const name = p.identity.name;
  const promise = p.identity.one_line_promise;
  const as = tr?.after_state ?? {};
  const bs = tr?.before_state ?? {};

  if (file === "landing-page.json") {
    // hero.body: situation lead + problem framing + the one-line promise
    const lead = (sit.specific_situation && !isBackfill(sit.specific_situation)) ? sit.specific_situation
      : (!isBackfill(cust.situation) ? cust.situation : (sit.problem || ""));
    const heroParts = [];
    if (lead) heroParts.push(ucFirst(lead.replace(/\.$/, "")) + ".");
    if (sit.problem && sit.problem !== lead) heroParts.push(ucFirst(sit.problem.replace(/\.$/, "")) + ".");
    heroParts.push(promise);
    L.hero.body = heroParts.join(" ");

    // before_state: behaviour + people tension, then conditions, then emotion + stake, then cost
    const paras = [];
    const behavior = (bs.current_behavior ?? []).filter(Boolean);
    const conditions = (bs.current_conditions ?? []).filter(Boolean);
    if (behavior.length) {
      let s = "Right now " + joinList(behavior);
      if (bs.people_involved?.length) s += ` - and the people who matter most (${joinList(bs.people_involved)}) are all pulling in different directions`;
      s += ".";
      paras.push(s);
    }
    if (conditions.length) paras.push("On top of that, " + joinList(conditions) + ".");
    const emoS = [];
    if (bs.emotional_state?.length) emoS.push("It feels like " + joinList(bs.emotional_state) + ".");
    if (!isBackfill(cust.emotional_stake)) emoS.push(ucFirst(cust.emotional_stake) + ".");
    if (emoS.length) paras.push(...emoS);
    if (bs.practical_consequences?.length) paras.push("The cost: " + joinList(bs.practical_consequences) + ".");
    if (paras.length) {
      L.before_state = L.before_state || {};
      L.before_state.paragraphs = paras;
      if (tr?.mechanism?.core_mechanism) L.before_state.punch = `This is not a personal failing. It is a system gap - and ${name} closes it.`;
    }

    // promise.we_do_not -> one flowing sentence (limits never omitted)
    const limits = as.remaining_limits ?? [];
    L.promise.we_do_not = limits.length
      ? `We do not promise: ${joinList(limits)}. This is an educational system, not medical, clinical, or mental-health care.`
      : `We do not promise a guaranteed outcome. This is an educational system, not medical, clinical, or mental-health care.`;

    // final_cta.body: promise + desired transformation (no fabricated capability claim)
    const ctaParts = [promise];
    if (sit.desired_transformation) ctaParts.push(ucFirst(sit.desired_transformation.replace(/\.$/, "")) + ".");
    L.final_cta.body = ctaParts.filter(Boolean).join(" ");

    // next.items[].reason: honest "why this is next on the journey" from the linked record
    if (L.next?.items?.length) {
      for (const it of L.next.items) {
        const tid = it.transformation_id;
        if (!tid) continue;
        const trf = join(root, "data", "transformations", `${tid}.json`);
        if (existsSync(trf)) {
          try {
            const t = JSON.parse(readFileSync(trf, "utf8"));
            it.reason = t?.situation?.desired_transformation || t?.situation?.specific_situation || "";
          } catch (e) { /* leave reason empty */ }
        }
      }
    }
    return L;
  }

  if (file === "product-page.json") {
    if (sit.specific_situation && !isBackfill(sit.specific_situation)) {
      L.situation_block = L.situation_block || {};
      L.situation_block.body = ucFirst(sit.specific_situation.replace(/\.$/, "")) + "." +
        (sit.problem ? " " + ucFirst(sit.problem.replace(/\.$/, "")) + "." : "");
    }
    return L;
  }

  if (file === "faq.json") {
    const inc = L.items.find((i) => /^what is included/i.test(i.q));
    if (inc && as.new_capabilities?.length) {
      inc.a = `You get ${assets.length} components: ${assets.map((a) => a.title).join("; ")}. Together they let you ${lcFirst(as.new_capabilities[0])}` +
        (as.new_capabilities[1] ? ` and ${lcFirst(as.new_capabilities[1])}` : "") + ".";
    }
    if (tr?.mechanism?.why_it_should_work && !L.items.some((i) => /why (this|does it work)/i.test(i.q))) {
      L.items.push({ q: "Why does this approach work?", a: tr.mechanism.why_it_should_work });
    }
    return L;
  }

  return L;
}

// -------- openai-compatible provider (opt-in, dormant without OPENAI_API_KEY) --------
// Provider status is ALWAYS recorded. A deterministic fallback after a provider failure is
// labelled as a fallback — it is never represented as successful LLM generation.
async function enrichWithLLM(file, base, p, tr, { env = process.env, fetchImpl = null } = {}) {
  const model = resolveModel("copywriter", env);
  const sys = "You are the Swiipt copywriter. Rewrite ONLY the narrative prose slots of the given content to read like crafted, empathetic marketing copy. Use ONLY the facts present in the provided records. Never invent claims, testimonials, ratings, or outcomes. Keep all trust lines, evidence labels, who-for / not-for, red-flag and safety content intact. Return the FULL JSON with the same structure, with only narrative fields improved.";
  const rec = JSON.stringify({ product: p, transformation: tr });
  const res = await chatCompletion({
    worker: "copywriter",
    model,
    temperature: 0.4,
    jsonMode: true,
    env,
    fetchImpl,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: `RECORDS:\n${rec}\n\nCONTENT TO ENRICH:\n${JSON.stringify(base)}` },
    ],
  });
  if (!res.ok) return { ok: false, status: res.status, model: res.model, endpoint_host: res.endpoint_host, error: res.error };
  const parsed = res.json;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, status: STATUS.PROVIDER_RESPONSE_INVALID, model: res.model, endpoint_host: res.endpoint_host, error: "response was not a JSON object" };
  }
  return { ok: true, status: STATUS.PROVIDER_SUCCESS, model: res.model, endpoint_host: res.endpoint_host, error: null, content: Object.assign({}, base, parsed) };
}

// -------- public entry --------
/**
 * Enrich one content artifact.
 * @returns {{content:object, meta:{requested_provider:string,provider_attempt_status:string,fallback_used:boolean,actual_generator:string,model:string|null,endpoint_host:string|null,error:string|null}}}
 */
export async function enrichContent(file, base, p, tr, assets, pdir, opts = {}) {
  const env = opts.env || process.env;
  const deterministic = () => deterministicEnrich(file, base, p, tr, assets, pdir);

  if (provider(env) !== "openai") {
    return { content: deterministic(), meta: { requested_provider: "deterministic", provider_attempt_status: STATUS.DETERMINISTIC_GENERATION, fallback_used: false, actual_generator: "deterministic", model: null, endpoint_host: null, error: null } };
  }

  const r = await enrichWithLLM(file, base, p, tr, { env, fetchImpl: opts.fetchImpl });
  if (r.ok) {
    return { content: r.content, meta: { requested_provider: "openai", provider_attempt_status: STATUS.PROVIDER_SUCCESS, fallback_used: false, actual_generator: "openai", model: r.model, endpoint_host: r.endpoint_host, error: null } };
  }
  return { content: deterministic(), meta: { requested_provider: "openai", provider_attempt_status: r.status, fallback_used: true, actual_generator: "deterministic", model: r.model, endpoint_host: r.endpoint_host, error: r.error } };
}

export { provider };
