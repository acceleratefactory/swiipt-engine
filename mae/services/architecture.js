// MAE · AssetArchitectureService (S5). Decides HOW to build before WHAT to write:
// truth weighting + platform-native rules + grounding → a completed Asset Brief. Scope from the
// Angle Validation Gate is binding (S5 §5.5).
import { save, all, MAE_DIR } from "../lib/store.js";
import { validate } from "../lib/schema.js";
import { makeId, existingIds } from "../lib/ids.js";
import { join } from "node:path";
import { fail, CODES } from "../lib/errors.js";
import { TruthService } from "./truth.js";
import { BrandTruthService } from "./brand.js";
import { CustomerRealityService } from "./crf.js";

const BRIEF_DIR = join(MAE_DIR, "data", "briefs");

// Platform-Native Rules (S5 §5.3).
export const PLATFORM_RULES = {
  whatsapp: ["max 300 words; split to a 2-part series if longer", "use *bold* for key phrases", "aggressive line breaks — one thought per line", "CTA style: \"Reply 'YES' and I'll send you the details\" not \"click the link\"", "most intimate/direct register"],
  whatsapp_status: ["3-5 slides; ≤30s per video slide", "text readable within 3 seconds"],
  instagram: ["2-3 sentences; strong first line (the 'more' button is the enemy)", "5-8 specific hashtags, never 30 generic"],
  tiktok: ["15-30s; hook visual AND verbal within the first 1 second", "large centred high-contrast text overlay", "one CTA only"],
  facebook: ["300-500 words performs well", "image posts outperform link posts"],
  x: ["threads 5-8 tweets for educational/myth-busting; single tweets ≤2 sentences", "sharper register, still within banned-register list"],
  linkedin: ["professional reframe of the same transformation — data/results over raw emotion", "usage gate: only when Platform Fitness explicitly includes LinkedIn"],
  email: ["5-7 emails minimum per launch sequence", "3 subject-line variants per email", "preview text is a second hook, not a summary", "PS line reserved for a final hook/bonus"],
  seo: ["title ≤60 chars (transformation + audience)", "meta description ≤155 chars (result + CTA)", "OG image 1200×630, legible at 400×210"],
  landing: ["use the landing component library; product-specific configuration only"],
  generic: [],
};

// Structural template by Asset Purpose (S6.3 — fixed at architecture, executed at generation).
export const TEMPLATE_BY_PURPOSE = {
  stop_scroll_identification: "Problem-Led Post",
  problem: "Problem-Led Post",
  story: "Story/Emotional Post",
  education: "Educational Post",
  mechanism: "Educational Post",
  myth_reframe: "Educational Post",
  objection: "Objection-Led Post",
  proof: "Transformation-Led Post",
  transformation: "Transformation-Led Post",
  conversion: "Transformation-Led Post",
  reinforcement: "Story/Emotional Post",
  identity_reinforcement: "Affirmation",
};

export const AssetArchitectureService = {
  nextId(scope, existing = existingIds(BRIEF_DIR)) { return makeId("brief", scope, existing); },

  /** Build a completed Asset Brief. `validation` is the Angle Validation Record (binding scope). */
  buildBrief(angle, validation, input = {}) {
    if (!angle) fail(CODES.MISSING_FIELD, "Asset Brief requires an Angle Record");
    const verdict = validation?.verdict;
    if (!verdict || verdict === "RED") fail(CODES.SCOPE_VIOLATION, "no Asset Brief may be built for a RED (or unvalidated) angle", { angle: angle.id, verdict });

    const platform = input.platform || "whatsapp";
    const approved = validation.approved_platforms || [];
    const excluded = validation.excluded_platforms || [];
    if (excluded.includes(platform)) fail(CODES.SCOPE_VIOLATION, `platform '${platform}' is excluded by the validation scope`, { platform, excluded });
    if (approved.length && !approved.includes(platform)) fail(CODES.SCOPE_VIOLATION, `platform '${platform}' is not in the approved scope`, { platform, approved });

    const assetType = input.asset_type || (platform === "whatsapp" ? "WhatsApp broadcast" : platform);
    const purpose = input.asset_purpose || angle.tier2.asset_purpose;
    const weighting = TruthService.validateWeighting(input.truth_weighting || TruthService.weightingProfile(assetType));

    const brief = {
      id: input.id || this.nextId((angle.id.replace(/^ANG-/, "").split("-")[0] || "GEN")),
      class: "asset_brief",
      angle_id: angle.id,
      product_id: angle.product_id,
      asset_type: assetType,
      platform,
      asset_purpose: purpose,
      audience: input.audience ?? null,
      truth_weighting: weighting,
      content_grounding: input.content_grounding || this.buildContentGrounding(angle, weighting),
      visual_grounding: input.visual_grounding ?? null,
      affirmation_grounding: input.affirmation_grounding ?? angle.affirmation_grounding ?? null,
      brand_constraints: this.brandConstraints(angle),
      platform_rules: PLATFORM_RULES[platform] || [],
      structural_template: input.structural_template || TEMPLATE_BY_PURPOSE[purpose] || "Problem-Led Post",
      cta_requirements: input.cta_requirements ?? null,
      proof_requirements: input.proof_requirements ?? null,
      locked_phrase_set_ref: input.locked_phrase_set_ref ?? null,
      restrictions: [...(validation.restrictions || []), ...(input.restrictions || [])],
      traceability: { angle_verdict: verdict, weighting_profile: assetType, source_truth_ids: (angle.tier3.source_evidence || []).map((e) => e.ref_id) },
      status: "READY",
      created_at: new Date().toISOString(),
    };
    validate("asset-brief.schema.json", brief, brief.id);
    return brief;
  },

  /** Content grounding: foreground the fields the weighting favours; background the rest (quoted, not summarised). */
  buildContentGrounding(angle, w) {
    const fg = [];
    const bg = [];
    const quote = (field, value, ref = null) => ({ field, value: String(value), source_ref: ref });
    const primaryCrf = angle.tier3.source_evidence?.[0]?.ref_id || null;
    const crf = primaryCrf ? CustomerRealityService.get(primaryCrf) : null;
    const exact = crf?.exact_language || "";
    if (w.customer >= 30) {
      fg.push(quote("Scene", angle.tier1.scene, primaryCrf));
      fg.push(quote("Pain", angle.tier1.pain, primaryCrf));
      fg.push(quote("Failed attempt", angle.tier1.failed_attempt, primaryCrf));
      fg.push(quote("Emotional stake", angle.tier1.emotional_stake.text, primaryCrf));
      if (exact) fg.push(quote("Exact language", exact, primaryCrf));
      fg.push(quote("Desired change", angle.tier2.desired_change, primaryCrf));
    } else {
      bg.push(quote("Scene", angle.tier1.scene, primaryCrf));
      bg.push(quote("Pain", angle.tier1.pain, primaryCrf));
      bg.push(quote("Desired change", angle.tier2.desired_change, primaryCrf));
    }
    if (w.product >= 25) fg.push(quote("Mechanism", angle.tier2.mechanism.text, angle.tier2.mechanism.product_truth_ref));
    else bg.push(quote("Mechanism", angle.tier2.mechanism.text, angle.tier2.mechanism.product_truth_ref));
    if (w.market >= 25 && (angle.tier3.market_truth_support || []).length) bg.push(quote("Market context", "referenced in traceability (differentiation only)"));
    return { foreground: fg, background: bg };
  },

  brandConstraints(angle) {
    const b = BrandTruthService.loadBrand();
    return [
      "no banned voice registers",
      ...(b.boundaries || []).slice(0, 4),
      `voice traits: ${(b.voice_dna.traits || []).join(", ")}`,
    ];
  },

  /** Yellow scope enforcement: a restricted angle may not exceed its authorised asset count. */
  assertWithinScope(validation, plannedCount) {
    if (validation.verdict === "YELLOW" && validation.max_assets != null && plannedCount > validation.max_assets) {
      fail(CODES.SCOPE_VIOLATION, `Yellow angle scope exceeded: ${plannedCount} > ${validation.max_assets}`, { max: validation.max_assets });
    }
    return true;
  },

  save(brief, { scope = "production" } = {}) { return save("briefs", brief, { scope }); },
  get(id) { return all("briefs").find((x) => x.id === id) || null; },
};
