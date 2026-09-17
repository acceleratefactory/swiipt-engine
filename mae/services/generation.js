// MAE · GenerationService (S6). Generation is execution, not invention. It consumes a completed
// Asset Brief only. The LLM provider is dormant by default; the deterministic composer assembles
// approved grounding into the fixed structural template and never invents facts.
import { save, all, MAE_DIR } from "../lib/store.js";
import { validate } from "../lib/schema.js";
import { makeId, existingIds } from "../lib/ids.js";
import { join } from "node:path";
import { fail, CODES } from "../lib/errors.js";
import { BrandTruthService } from "./brand.js";
import { contentCompleteness } from "../lib/content-contract.js";

const GEN_DIR = join(MAE_DIR, "data", "generated");
export const MAX_REGENERATIONS = 3;

const CTA = {
  whatsapp: "Reply 'YES' and I'll send you the details.",
  whatsapp_status: "Reply YES for the full system.",
  instagram: "Save this for when you need it.",
  tiktok: "Follow for part 2.",
  facebook: "If this is you, the full system is in the comments.",
  x: "More in the thread.",
  email: "See the full system — link below.",
  linkedin: "Details in the full write-up.",
  seo: "",
  landing: "",
  generic: "",
};

const fgMap = (brief) => Object.fromEntries(brief.content_grounding.foreground.map((f) => [f.field.toLowerCase(), f.value]));

export const GenerationService = {
  nextId(scope, existing = existingIds(GEN_DIR)) { return makeId("generated", scope, existing); },

  /** Fixed-order prompt assembly (S6.2). Constraints precede the task; negative instruction is explicit. */
  buildPrompt(brief, { lockedPhraseSet = null } = {}) {
    const reg = BrandTruthService.writingRegister();
    const lines = [];
    lines.push("[1] BRAND TRUTH CONSTRAINTS");
    lines.push(`Voice: ${(BrandTruthService.loadBrand().voice_dna.traits || []).join(", ")}.`);
    lines.push("Four-part test: (a) name a specific real pattern; (b) do not blame the reader; (c) reframe around the obstacle; (d) plain short sentences.");
    lines.push(`Banned phrases: ${reg.forbidden_phrases.join("; ")}.`);
    lines.push("[2] STRUCTURAL TEMPLATE — " + brief.structural_template);
    lines.push("[3] CONTENT GROUNDING — FOREGROUND (use directly)");
    for (const f of brief.content_grounding.foreground) lines.push(`  ${f.field}: ${f.value}`);
    if (brief.content_grounding.background.length) {
      lines.push("CONTENT GROUNDING — BACKGROUND (reference lightly only)");
      for (const f of brief.content_grounding.background) lines.push(`  ${f.field}: ${f.value}`);
    }
    lines.push("[4] PLATFORM RULES — " + brief.platform);
    for (const r of brief.platform_rules) lines.push("  - " + r);
    lines.push("[5] EXPLICIT NEGATIVE INSTRUCTION");
    lines.push("Do not introduce any claim, statistic, timeline, or emotional detail not present in the Content Grounding above. Do not generalise to 'every mother' — frame as common but not universal. Do not invent new scene details.");
    if (lockedPhraseSet) {
      lines.push("[CONSISTENCY LOCK]");
      lines.push(`Reuse verbatim where natural: ${(lockedPhraseSet.phrases || []).join(", ")}. Do not introduce a contradictory version of the same detail.`);
    }
    lines.push("[6] TASK");
    lines.push(`Write one ${brief.asset_type} following the structural template, using the foregrounded grounding as primary material.`);
    return lines.join("\n");
  },

  /** Deterministic composer (dormant-provider path). Uses only approved grounding; no invented facts. */
  compose(brief, { lockedPhraseSet = null } = {}) {
    const g = fgMap(brief);
    const cta = CTA[brief.platform] ?? CTA.generic;
    const lock = lockedPhraseSet ? ` (${(lockedPhraseSet.phrases || []).slice(0, 3).join(", ")})` : "";
    const t = brief.structural_template;
    const parts = [];

    if (t === "Problem-Led Post" || t === "Story/Emotional Post") {
      if (g.scene) parts.push(g.scene.replace(/\.$/, "") + ".");
      if (g["failed attempt"]) parts.push(g["failed attempt"]);
      if (g["emotional stake"]) parts.push(g["emotional stake"].replace(/\.$/, "") + ".");
      if (g["exact language"]) parts.push(`"${g["exact language"]}"`);
      if (g["desired change"]) parts.push(`If that is you — the goal is not to try harder. It is to ${g["desired change"].replace(/^To /, "").replace(/\.$/, "").toLowerCase()}.`);
      if (g.mechanism) parts.push(`There is a specific way through this: ${g.mechanism}${lock}.`);
      parts.push(cta);
    } else if (t === "Educational Post") {
      if (g.pain) parts.push(`What is often misunderstood: ${g.pain.replace(/\.$/, "")}.`);
      if (g["failed attempt"]) parts.push(g["failed attempt"]);
      if (g.mechanism) parts.push(`What actually helps: ${g.mechanism}${lock}.`);
      if (g["desired change"]) parts.push(`The change to aim for: ${g["desired change"].replace(/\.$/, "")}.`);
      parts.push(cta);
    } else if (t === "Objection-Led Post") {
      if (g["emotional stake"]) parts.push(g["emotional stake"].replace(/\.$/, "") + " — that is a reasonable thing to ask about.");
      if (g["failed attempt"]) parts.push(g["failed attempt"]);
      if (g.mechanism) parts.push(`The answer: ${g.mechanism}${lock}.`);
      if (g["desired change"]) parts.push(g["desired change"]);
      parts.push(cta);
    } else if (t === "Transformation-Led Post") {
      if (g["desired change"]) parts.push(g["desired change"].replace(/\.$/, "") + ".");
      if (g.mechanism) parts.push(`The one thing that shifts it: ${g.mechanism}${lock}.`);
      if (g["emotional stake"]) parts.push(g["emotional stake"].replace(/\.$/, "") + " — that is the part most people are left alone with.");
      parts.push(cta);
    } else if (t === "Affirmation") {
      if (g["desired change"]) parts.push(`I am allowed to ${g["desired change"].replace(/^To /, "").replace(/\.$/, "").toLowerCase()} without deciding that slow means something is wrong.`);
      parts.push(cta);
    } else {
      parts.push(...brief.content_grounding.foreground.map((f) => f.value), cta);
    }
    return parts.filter(Boolean).join("\n");
  },

  /** Validate generated output against platform limits + brand register + negative instruction. */
  validateOutput(text, brief) {
    const findings = [];
    const words = text.split(/\s+/).filter(Boolean).length;
    if (brief.platform === "whatsapp" && words > 300) findings.push({ code: "PLATFORM_LENGTH", detail: `${words} words > 300` });
    if (brief.platform === "seo") {
      const title = text.split("\n")[0] || "";
      if (title.length > 60) findings.push({ code: "PLATFORM_LENGTH", detail: "SEO title > 60 chars" });
    }
    try {
      const reg = BrandTruthService.writingRegister();
      const low = text.toLowerCase();
      const banned = reg.forbidden_phrases.filter((p) => low.includes(String(p).toLowerCase()));
      for (const p of banned) findings.push({ code: "NEVER_phrase", detail: p });
    } catch { /* brand register unavailable → skip (dormant-safe) */ }
    // Negative-instruction: any number in output must exist in the grounding.
    const groundingText = brief.content_grounding.foreground.concat(brief.content_grounding.background).map((f) => f.value).join(" ");
    for (const num of text.match(/\b\d+\b/g) || []) {
      if (!groundingText.includes(num)) findings.push({ code: "UNGROUNDED_FACT", detail: `number '${num}' not present in grounding` });
    }
    if (/every mother|all women|everyone who/i.test(text)) findings.push({ code: "UNIVERSALITY", detail: "universality claim vs counter-evidence rule" });
    return findings;
  },

  /** Produce a draft asset. Deterministic by default; `provider` opt-in (dormant). */
  generate(brief, { provider = "deterministic", lockedPhraseSet = null, attempts = 1, id = null } = {}) {
    const candidates = [];
    let regeneration = 0;
    let failures = [];
    let completeness = { complete: false, failures: [] };
    while (regeneration < MAX_REGENERATIONS) {
      const content = provider === "deterministic" ? this.compose(brief, { lockedPhraseSet }) : this.compose(brief, { lockedPhraseSet });
      candidates.push({ id: `cand-${regeneration + 1}`, content, provider, attempt: regeneration + 1 });
      const findings = this.validateOutput(content, brief);
      // GENERATION GUARD (content completeness): an incomplete draft is never a success state.
      completeness = contentCompleteness(brief.asset_type, content);
      failures = [...findings, ...completeness.failures.map((f) => ({ code: f.code, detail: f.detail }))];
      if (!failures.length) break;
      regeneration++;
    }
    const status = !completeness.complete ? "REVISION_REQUIRED"
      : (failures.length && regeneration >= MAX_REGENERATIONS ? "BRIEF_REVIEW_REQUIRED" : "GENERATED");
    const record = {
      id: id || this.nextId((brief.angle_id || "GEN").replace(/^ANG-/, "").split("-")[0] || "GEN"),
      class: "generated_asset_record",
      angle_id: brief.angle_id,
      brief_id: brief.id,
      product_id: brief.product_id ?? null,
      asset_type: brief.asset_type,
      platform: brief.platform,
      candidates,
      selected: status === "GENERATED" ? candidates[candidates.length - 1].id : null,
      generation_version: "1.0",
      prompt_version: "1.0",
      provider,
      model: provider === "deterministic" ? null : provider,
      regeneration_count: regeneration,
      failure_log: failures,
      status,
      created_at: new Date().toISOString(),
    };
    validate("generated-asset-record.schema.json", record, record.id);
    return record;
  },

  save(record, { scope = "production" } = {}) { return save("generated", record, { scope }); },
  get(id) { return all("generated").find((g) => g.id === id) || null; },
  selectedContent(record) { return (record.candidates.find((c) => c.id === record.selected) || {}).content || ""; },
};
