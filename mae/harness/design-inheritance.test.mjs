// GLOBAL DESIGN INHERITANCE — acceptance tests (Task §35/§61/§62/§63/§64).
// Runs the machine-checkable design-authority compliance, the brand continuity QA, the synthetic
// non-V06 fixture and the zero-V06 / product-id audit. No providers are called.
import test from "node:test";
import assert from "node:assert/strict";
import * as DA from "./design-authority.mjs";
import * as MC from "./marketing-components.mjs";
import * as Q from "./brand-continuity-qa.mjs";
import { zeroV06Audit } from "./zero-v06-audit.mjs";
import { runDesignInheritanceFixture } from "./design-inheritance-fixture.mjs";

test("1. §63 design-authority compliance: every locked rule PASS, none UNKNOWN", () => {
  const r = Q.designAuthorityCompliance();
  if (!r.pass) console.log(r.rows.filter((x) => x.status !== "PASS"));
  assert.equal(r.unknown.length, 0, "no rule may be UNKNOWN");
  assert.equal(r.failed.length, 0, "no rule may FAIL");
  assert.ok(r.pass);
});

test("2. §7/§8 canonical 12 tokens incl. Blush/Soft/Muted", () => {
  const toks = DA.colourTokens();
  assert.equal(toks.length, 12);
  assert.equal(DA.hex("blush"), "#F3C7D2");
  assert.equal(DA.hex("soft_surface"), "#F4F6F8");
  assert.equal(DA.hex("muted"), "#7B8794");
  for (const t of ["success", "warning", "error", "info"]) assert.ok(DA.isBrandColour(DA.hex(t)), t);
});

test("3. §9/§10 semantic typography: Inter Black hook, DM Serif Italic verbatim-only", () => {
  const h = DA.typeCss("hook"), q = DA.typeCss("verbatim_quote"), e = DA.typeCss("editorial_headline");
  assert.equal(h.weight, 800); assert.match(h.family, /Inter/);
  assert.match(q.family, /DM Serif Display/); assert.equal(q.style, "italic");
  assert.match(e.family, /DM Serif Display/); assert.equal(e.style, "normal");
  assert.ok(DA.fontFiles()["Inter-Black"]);
});

test("4. §11/§12 official Transformation Mark used (never a CSS approximation)", () => {
  for (const v of ["primary", "reverse", "mono-navy", "mono-white"]) {
    const svg = DA.markSvg(v);
    assert.match(svg, /M42 54 L58 38/, v + " gold bridge");
  }
  // a composed creative must not use the old CSS single-square mark
  const hook = MC.renderMarketingComponent("Hook Graphic", { hook: "x", grounding: { form: "day/time badge", text: "DAY 1" } });
  assert.doesNotMatch(hook, /border-radius:\s*8px[^"]*rotate\(45deg\)/);
  assert.match(hook, /data-swt-logo-variant="reverse"/);
});

test("5. §14 iconography: Lucide stroke-only, never emoji/flags", () => {
  const i = DA.iconography();
  assert.equal(i.style, "stroke-only");
  assert.ok(i.never.includes("filled icons") && i.never.includes("emoji as UI icons") && i.never.includes("flags as substitute UI icons"));
});

test("6. §18 callout semantics by meaning (no decorative colour)", () => {
  assert.equal(DA.calloutFor("safety / non-negotiable").kind, "red");
  assert.equal(DA.calloutFor("warning").kind, "amber");
  assert.equal(DA.calloutFor("informational").kind, "blue");
  assert.equal(DA.calloutFor("resolution").kind, "green");
  assert.equal(DA.calloutFor("human / emotional").kind, "blush");
  assert.throws(() => DA.calloutFor("random"));
});

test("7. §19 two visual modes preserved (typographic default + photo_anchored enhancement)", () => {
  const m = DA.visualModes();
  assert.equal(m.typographic.status, "default");
  assert.equal(m.photo_anchored.status, "enhancement");
});

test("8. §21 Grounding Element Rule is machine-checkable and distinct", () => {
  const g = DA.groundingElement();
  assert.ok(g.forms.length >= 1 && typeof g.test === "string");
  assert.match(g.distinct_from, /visual_grounding/);
  assert.equal(DA.isGroundingElement({ form: "day/time badge", text: "DAY 6" }), true);
  assert.equal(DA.isGroundingElement({ form: "day/time badge", text: "" }), false);
  assert.equal(DA.isGroundingElement(null), false);
});

test("9. §22/§23 intensity mapping resolves from angle type (not product)", () => {
  assert.equal(DA.intensityForAngleType("fear"), "high");
  assert.equal(DA.intensityForAngleType("problem"), "medium");
  assert.equal(DA.intensityForAngleType("mechanism"), "low");
  assert.equal(DA.intensityForAngleType("transformation"), "conversion");
});

test("10. §24/§25/§26 component library = six incl. OG Share Image with exact canvases", () => {
  const lib = DA.componentLibrary();
  assert.equal(lib.length, 6);
  const names = lib.map((c) => c.component);
  for (const n of ["Hook Graphic", "Quote Card", "Situation Timeline", "Angle Record Card", "OG Share Image", "Carousel Slide"]) assert.ok(names.includes(n), n);
  assert.deepEqual(MC.componentCanvas("Angle Record Card"), { w: 1200, h: 900 });
  assert.deepEqual(MC.componentCanvas("OG Share Image"), { w: 1200, h: 630 });
});

test("11. §21/§24 mandatory-element gate rejects an incomplete component", () => {
  assert.throws(() => MC.renderMarketingComponent("Hook Graphic", { hook: "x" }), /grounding badge/);
  assert.throws(() => MC.renderMarketingComponent("OG Share Image", { headline: "x" }), /category label/);
  assert.throws(() => MC.renderMarketingComponent("Quote Card", { quote: "x", attribution: "y", verbatim: false }), /verbatim/i);
});

test("12. §27/§28/§29 platform safe zones, text-size, contrast are authority-exact", () => {
  assert.deepEqual(DA.safeZone("1080x1920"), { top: 250, bottom: 350, left: 0, right: 0 });
  assert.equal(DA.safeZone("1080x1080").bottom, 130);
  assert.equal(DA.minTextPx(1080), 60);
  assert.equal(DA.minTextPx(1200), 67);
  assert.equal(DA.contrastMin(), 4.5);
});

test("13. §13 favicon / app icon / OG assets resolve through the canonical brand kit", () => {
  const p = DA.brandAssets().present;
  assert.ok(p.favicon_ico && p.app_icon && p.app_icon_square && p.apple_touch_icon && p.og_share_image);
});

test("14. §35 brand continuity QA: compose → static audit passes for every component", () => {
  const audit = (html, opts) => Q.staticBrandAudit(html, opts);
  assert.ok(audit(MC.renderMarketingComponent("Hook Graphic", { hook: "Six nights. One plan.", grounding: { form: "day/time badge", text: "DAY 6" } }), { requireGrounding: true }).pass);
  assert.ok(audit(MC.renderMarketingComponent("Quote Card", { quote: "I stopped keeping score at 3am.", attribution: "Day 8 mum - Lagos - verbatim" })).pass);
  assert.ok(audit(MC.renderMarketingComponent("OG Share Image", { category: "Postpartum", headline: "The night shift, solved", url: "swiipt.com" })).pass);
  // a CSS-approximated mark must FAIL the audit
  const bad = `<div data-swt-logo style="width:30px;height:30px;background:#6F35B5;border-radius:8px;transform:rotate(45deg)"></div>`;
  assert.equal(audit(bad).pass, false);
});

test("15. §29 contrast / §28 text size / platform safe zone measured in a real browser", () => {
  const hook = MC.renderMarketingComponent("Hook Graphic", { hook: "Six nights. One plan.", grounding: { form: "day/time badge", text: "DAY 6" } });
  const ba = Q.browserAudit(hook, 1080, 1080);
  if (!ba.ok) return; // browser unavailable — static checks still cover the rest
  assert.ok(ba.pass, JSON.stringify(ba.checks));
});

test("16. §61 zero-V06-dependency on the generic path", () => {
  const r = zeroV06Audit();
  if (r.illegitimate.length) console.log(r.illegitimate);
  assert.equal(r.illegitimate.length, 0, "no illegitimate V06 assumptions on the generic path");
  assert.ok(r.scanned.length >= 15);
});

test("17. §62 zero product-id production branches", () => {
  const r = zeroV06Audit();
  assert.equal(r.branches.length, 0, JSON.stringify(r.branches));
});

test("18. §64 synthetic non-V06 fixture: full generic path, 0 provider calls, marker present", () => {
  const r = runDesignInheritanceFixture();
  if (!r.pass) console.log(r.failed);
  assert.equal(r.marker, "TEST FIXTURE — NOT FOR PUBLICATION");
  assert.equal(r.provider_calls, 0);
  assert.ok(r.rendered.length >= 8, "rendered " + r.rendered.length);
  assert.equal(r.failed.length, 0, JSON.stringify(r.failed));
  assert.ok(r.pass);
});

test("19. §66 the frozen compositor keeps its A–F architecture", async () => {
  const mod = await import("./creative-compositor.mjs");
  for (const k of ["EMOTIONAL_HOOK", "PRODUCT_PROOF", "EDITORIAL_QUOTE", "EDUCATIONAL_CAROUSEL", "OUTCOME", "PRODUCT_CTA"]) assert.ok(mod.TREATMENT[k], k);
  assert.equal(mod.PHOTOGRAPHY_POLICY.id, "NO_GENERIC_STOCK_PHOTO");
  assert.equal(typeof mod.selectTreatment, "function");
  assert.equal(typeof mod.slideTreatment, "function");
});
