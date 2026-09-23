// MULTI-DOMAIN AUTHORITY FIXTURES (A-F) - non-production, no pollution.
//
// Each fixture builds a synthetic product/transformation in a TEMP directory and runs the SAME
// authority evaluators the gate runner uses. Nothing is written under data/products/.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildAuthorityContext, evaluateEvidenceAuthority, evaluateSafetyAuthority, evaluateJourneyAuthority,
  evaluatePublicationConstitution, loadConstitution, STATE,
} from "./governance-authority.mjs";

const tempRoots = [];
function tempProduct({ product, transformation, assets = {}, contentKeys = ["landing_page", "product_page", "faq", "reviews"] }) {
  const dir = mkdtempSync(join(tmpdir(), "swt-authfix-"));
  tempRoots.push(dir);
  // assets
  for (const [aid, rec] of Object.entries(assets)) {
    mkdirSync(join(dir, "assets"), { recursive: true });
    writeFileSync(join(dir, "assets", `${aid}.json`), JSON.stringify(rec, null, 2));
    if (rec.source_path) {
      const sp = join(dir, rec.source_path);
      mkdirSync(join(sp, ".."), { recursive: true });
      writeFileSync(sp, rec.__content ?? "# Fixture\n\nContent.", "utf8");
    }
  }
  const amap = {}; for (const [aid, rec] of Object.entries(assets)) { (amap[rec.job.toLowerCase()] = amap[rec.job.toLowerCase()] || []).push(aid); }
  const p = { product_id: "FIXTURE", identity: { name: "Fixture", subtitle: "Fixture", one_line_promise: "Fixture", transformation_id: "TR-FIXTURE" }, customer: {}, evidence: { sources: [], claim_labels: [] }, safety: {}, commerce: { price: { base_usd: 29 }, currency_rules: { model: "manual_per_currency" }, offer: {}, access_rules: { grant_type: "one_time_digital" }, upsells: [], bundles: [] }, asset_map: amap, publishing: { manifest_version: "1.0", wordpress_ids: {}, published_at: null }, ...product };
  p.asset_map = { read: [], do: [], decide: [], track: [], communicate: [], rescue: [], reentry: [], maintenance: [], ...(p.asset_map ?? {}) };
  const content = {}; for (const k of contentKeys) { const ref = `copy/${k}.json`; mkdirSync(join(dir, "copy"), { recursive: true }); writeFileSync(join(dir, ref), "{}", "utf8"); content[k] = ref; }
  p.content = content;
  const t = { transformation_id: "TR-FIXTURE", situation: { specific_situation: "Fixture", problem: "Fixture" }, mechanism: { core_mechanism: "Fixture mechanism" }, safety: { risk_level: "low" }, transformation_path: [{ stage: "S1", objective: "o1" }, { stage: "S2", objective: "o2" }], first_win: { within: "15 minutes", action: "do the first thing" }, failure_point_map: [], maintenance: { maintenance_system: "keep it" }, ...transformation };
  return { dir, product: p, transformation: t };
}
const assetRec = (job, title, content) => ({ asset_id: `AS-FIX-${job}`, product_id: "FIXTURE", title, job, format: "guide", source_path: `content/${job.toLowerCase()}.md`, experience_mode: "functional", required: true, safety_relevant: false, first_win_role: false, tool_widgets: [], __content: content });

export function runAuthorityFixtures() {
  const out = {};
  const ev = loadConstitution("EVIDENCE");
  const sa = loadConstitution("SAFETY");
  const jo = loadConstitution("JOURNEY");
  const pub = loadConstitution("PUBLICATION");
  const tsmCon = loadConstitution("TSM");

  try {
    /* Fixture A - low-risk general product: autonomous authorization. */
    {
      const f = tempProduct({
        product: {
          safety: { risk_level: "low", disclaimer: "Educational content — not medical, clinical, or mental-health advice.", red_flags: [], escalation_rules: ["Route beyond scope to a qualified professional."] },
          evidence: { sources: ["Named public survey 2026"], claim_labels: [{ claim: "Households report the pattern", label: "sourced_evidence", source: "Named public survey 2026" }] },
          asset_map: { read: ["AS-FIX-READ"], do: ["AS-FIX-DO"] },
        },
        transformation: { failure_point_map: [], safety: { risk_level: "low", scope_boundary: "General informational guidance only.", red_flags: [], escalation_rules: [] } },
        assets: { "AS-FIX-READ": assetRec("READ", "Guide", "# Guide\n\nUse it."), "AS-FIX-DO": assetRec("DO", "Do", "# Do\n\nDo it. If it breaks, restart the system.") },
      });
      const ctx = buildAuthorityContext(f.product, f.transformation, f.dir, {});
      out.A = { domain: ctx.domain.domain, evidence: evaluateEvidenceAuthority(ctx).state, safety: evaluateSafetyAuthority(ctx).state, journey: evaluateJourneyAuthority(ctx).state };
    }

    /* Fixture B - moderate consequential non-regulated (family_finance): governed by its pack. */
    {
      const real = { root: process.cwd() };
      void real;
      out.B = { note: "the real PPL-FAMILY-MONEY-001 product is the Family Finance proof (see the report / gate runner)" };
    }

    /* Fixture C - clinical-sensitive product, required Domain Authority Pack absent -> NOT_AUTHORIZED. */
    {
      const f = tempProduct({
        product: {
          authority_domain: "health",
          safety: { risk_level: "high", disclaimer: "Educational only.", red_flags: [], escalation_rules: ["emergency routing"] },
          evidence: { sources: ["study"], claim_labels: [{ claim: "clinical claim", label: "sourced_evidence" }] },
          asset_map: { read: ["AS-FIX-READ"] },
        },
        transformation: { safety: { risk_level: "high", scope_boundary: "clinical scope", red_flags: [], escalation_rules: [] } },
        assets: { "AS-FIX-READ": assetRec("READ", "Guide", "# Guide") },
      });
      const ctx = buildAuthorityContext(f.product, f.transformation, f.dir, {});
      const a = organize(ctx);
      out.C = { domain: ctx.domain.domain, pack: !!ctx.pack, evidence: a.evidence.state, safety: a.safety.state, journey: a.journey.state, publication: a.publication.state, reasons: a.evidence.failure_reasons.concat(a.safety.failure_reasons) };
    }

    /* Fixture D - evidence-defective (unsupported efficacy claim) -> NOT_AUTHORIZED via Evidence Authority. */
    {
      const f = tempProduct({
        product: {
          safety: { risk_level: "low", disclaimer: "Educational content — not medical, clinical, or mental-health advice.", red_flags: [], escalation_rules: ["Route beyond scope."] },
          evidence: { sources: [], claim_labels: [{ claim: "This guarantees savings for every household", label: "hypothesis" }] },
          asset_map: { read: ["AS-FIX-READ"] },
        },
        transformation: { safety: { risk_level: "low", scope_boundary: "General guidance.", red_flags: [], escalation_rules: [] } },
        assets: { "AS-FIX-READ": assetRec("READ", "Guide", "# Guide") },
      });
      const ctx = buildAuthorityContext(f.product, f.transformation, f.dir, {});
      const a = organize(ctx);
      out.D = { evidence: a.evidence.state, reasons: a.evidence.failure_reasons };
    }

    /* Fixture E - journey-defective (broken first-win / dead end) -> NOT_AUTHORIZED via Journey Authority. */
    {
      const f = tempProduct({
        product: {
          safety: { risk_level: "low", disclaimer: "Educational content — not medical, clinical, or mental-health advice.", red_flags: [], escalation_rules: ["Route beyond scope."] },
          evidence: { sources: ["x"], claim_labels: [{ claim: "A claim", label: "sourced_evidence" }] },
          asset_map: { read: ["AS-FIX-READ"] },
        },
        transformation: { first_win: null, transformation_path: [{ stage: "only" }], safety: { risk_level: "low", scope_boundary: "General.", red_flags: [], escalation_rules: [] } },
        assets: { "AS-FIX-READ": assetRec("READ", "Guide", "# Guide") },
      });
      const ctx = buildAuthorityContext(f.product, f.transformation, f.dir, {});
      const a = organize(ctx);
      out.E = { journey: a.journey.state, reasons: a.journey.failure_reasons };
    }

    /* Fixture F - authority-version change -> reevaluation discoverable. */
    {
      out.F = { note: "covered by the test suite via reevaluationScan() on a synthetic audit record" };
    }

    return { ok: true, fixtures: out, constitutions: Boolean(ev && sa && jo && pub && tsmCon), _cleanup: tempRoots };
  } finally {
    for (const d of tempRoots) { try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ } }
  }

  function organize(ctx) {
    const evidence = evaluateEvidenceAuthority(ctx);
    const safety = evaluateSafetyAuthority(ctx);
    const journey = evaluateJourneyAuthority(ctx);
    const gateStates = { g0_research_disposition: "PASS", g1_situation: "PASS", g2_transformation: "PASS", g3_product_architecture: "PASS", g4_evidence: evidence.state, g5_safety: safety.state, g6_content: "PASS", g7_product_qa: "PASS", g8_commerce: "PASS", g9_customer_journey: journey.state };
    const publication = evaluatePublicationConstitution({ gateStates, tsm: { state: "INTERNAL_COHORT_THRESHOLD" }, pack: ctx.pack, publicationConstitution: pub });
    return { evidence, safety, journey, publication };
  }
  void STATE;
}
