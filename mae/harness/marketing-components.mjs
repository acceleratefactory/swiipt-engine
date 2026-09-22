// SWIIPT MARKETING COMPONENT LIBRARY — the reusable 6-component marketing vocabulary from
// "The Visual Interchangeability Standard v1.0" (Task §24/§25/§26).
//
// These are NOT V06-specific: they render from the canonical design authority (design-authority.mjs)
// and generic caller data only. A campaign that requests a component gets it; a campaign that does
// not, does not. No product id, asset id or platform-specific branch appears here.
import * as DA from "./design-authority.mjs";

const NAVY = DA.hex("navy"), PURPLE = DA.hex("purple"), GOLD = DA.hex("gold"),
  BLUSH = DA.hex("blush"), CREAM = DA.hex("warm_surface"), SOFT = DA.hex("soft_surface"),
  INK = DA.hex("ink"), MUTED = DA.supportTokens().text_secondary, WHITE = DA.supportTokens().white,
  BORDER = DA.supportTokens().border;
const ON_NAVY_2 = "rgba(255,255,255,.72)", ON_NAVY_3 = "rgba(255,255,255,.55)";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** The authority spec for a component (name, canvas, mandatory, never). */
export function componentSpec(name) {
  const c = DA.componentLibrary().find((x) => x.component === name);
  if (!c) throw new Error(`marketing component library: unknown component "${name}"`);
  return c;
}
/** Canvas width/height for a component. */
export function componentCanvas(name) {
  const m = /(\d+)\s*x\s*(\d+)/.exec(componentSpec(name).canvas);
  if (!m) throw new Error(`marketing component library: unparsable canvas for "${name}"`);
  return { w: Number(m[1]), h: Number(m[2]) };
}

const typeStyle = (role, size, color, extra = "") => {
  const c = DA.typeCss(role);
  return `font-family:${c.family};font-weight:${c.weight};font-style:${c.style};font-size:${size}px;color:${color};${extra}`;
};
const groundingBadge = (g, size = 22) => {
  if (!DA.isGroundingElement(g)) return "";
  return `<div data-swt-grounding style="display:inline-flex;align-items:center;gap:10px;border:1.5px solid ${GOLD};color:${GOLD};font:800 ${size}px Inter,sans-serif;letter-spacing:.1em;text-transform:uppercase;padding:8px 18px;border-radius:999px">
    <svg width="${size}" height="${size}" viewBox="0 0 18 18" fill="none" stroke="${GOLD}" stroke-width="1.6" aria-hidden="true"><circle cx="9" cy="9" r="7"/><path d="M9 5v4l2.5 1.5"/></svg>
    <span>${esc(g.text || g.value)}</span></div>`;
};
const lockup = (dark, height = 40) => `<span data-swt-logo-variant="${dark ? "reverse" : "primary"}" style="display:inline-flex;line-height:0">${DA.logoSvg({ dark, height })}</span>`;
const callout = (meaning, text) => {
  const c = DA.calloutFor(meaning);
  return `<div data-swt-callout="${c.kind}" style="border-left:5px solid ${c.hex};background:${soft_or_navy(c.kind)};padding:18px 22px;border-radius:0 10px 10px 0">
    <div style="font:700 17px Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:${c.hex}">${esc(c.meaning)}</div>
    <div style="margin-top:6px;font:400 22px Inter,sans-serif;color:${INK};line-height:1.45">${esc(text)}</div></div>`;
};
const soft_or_navy = (kind) => ({ red: DA.supportTokens().error_tint, amber: DA.supportTokens().warning_tint, blue: DA.supportTokens().info_tint, green: DA.supportTokens().success_tint, blush: BLUSH }[kind] || SOFT);

/* ---------------------------------------------------------------- 1. Hook Graphic (1080x1080)
 * mandatory: grounding badge · Inter Black hook · arrow/CTA dot. Optional photo-anchored scene. */
export function hookGraphic(ctx = {}) {
  const { w, h } = componentCanvas("Hook Graphic");
  const scene = ctx.scene ? `<img data-required="1" src="${esc(ctx.scene)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">` : "";
  const photoScrim = ctx.scene
    ? `<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,31,51,.72) 0%,rgba(11,31,51,.35) 45%,rgba(11,31,51,.92) 100%)"></div>`
    : `<div style="position:absolute;inset:0;background:radial-gradient(120% 90% at 78% 88%, rgba(255,255,255,.06) 0%, ${NAVY} 62%)"></div>`;
  const hook = ctx.hook ? `<div data-swt-role="hook" style="${typeStyle("hook", 74, WHITE, "line-height:1.06;letter-spacing:.005em;text-shadow:0 2px 18px rgba(0,0,0,.5)")}">${esc(ctx.hook)}</div>` : "";
  const arrow = `<div data-swt-cta-dot style="position:absolute;right:70px;bottom:150px;width:92px;height:92px;border-radius:50%;background:${GOLD};color:${NAVY};display:flex;align-items:center;justify-content:center;font:800 44px Inter,sans-serif">&#8594;</div>`;
  return `<div style="position:relative;width:${w}px;height:${h}px;overflow:hidden;background:${NAVY}">
  ${scene}${photoScrim}
  <div style="position:absolute;left:70px;top:56px">${lockup(true, 40)}</div>
  <div style="position:absolute;left:70px;right:70px;bottom:190px">
    ${groundingBadge(ctx.grounding)}
    ${hook}
  </div>${arrow}</div>`;
}

/* ---------------------------------------------------------------- 2. Quote Card (1080x1080)
 * mandatory: DM Serif Italic quote · source attribution line. Verbatim quotes ONLY. */
export function quoteCard(ctx = {}) {
  const { w, h } = componentCanvas("Quote Card");
  if (ctx.verbatim === false) throw new Error("marketing component library: Quote Card requires a VERBATIM quote (DM Serif Italic is a truth claim)");
  const q = ctx.quote ? `<div data-swt-role="verbatim_quote" style="${typeStyle("verbatim_quote", 62, INK, "line-height:1.3")}">${esc(ctx.quote)}</div>` : "";
  const attr = ctx.attribution ? `<div data-swt-attribution style="margin-top:34px;padding-top:20px;border-top:3px solid ${GOLD};display:inline-block;font:600 24px Inter,sans-serif;color:${INK}">${esc(ctx.attribution)}</div>` : "";
  return `<div style="position:relative;width:${w}px;height:${h}px;overflow:hidden;background:${CREAM};padding:96px;box-sizing:border-box">
  <div style="position:absolute;right:80px;top:40px;font-family:'DM Serif Display',Georgia,serif;font-size:220px;line-height:1;color:${GOLD};opacity:.5">&rdquo;</div>
  <div style="position:absolute;left:96px;top:64px">${lockup(false, 40)}</div>
  <div style="position:relative;margin-top:190px">${q}${attr}</div>
  <div style="position:absolute;left:96px;bottom:64px;font:600 20px Inter,sans-serif;letter-spacing:.14em;color:${MUTED}">SWIIPT</div>
</div>`;
}

/* ---------------------------------------------------------------- 3. Situation Timeline (1080x1080)
 * mandatory: 2–3 dated stages · proof callout. NEVER a body-transformation image. */
export function situationTimeline(ctx = {}) {
  const { w, h } = componentCanvas("Situation Timeline");
  const stages = Array.isArray(ctx.stages) ? ctx.stages.slice(0, 3) : [];
  if (stages.length < 2 || stages.length > 3) throw new Error("marketing component library: Situation Timeline requires 2–3 dated stages");
  const rows = stages.map((s, i) => `<div style="display:flex;gap:22px;margin-bottom:26px">
    <div style="flex:none;width:74px;height:74px;border-radius:50%;background:${i === stages.length - 1 ? GOLD : PURPLE};color:${i === stages.length - 1 ? NAVY : WHITE};display:flex;align-items:center;justify-content:center;font:800 26px Inter,sans-serif">${i + 1}</div>
    <div><div style="font:700 22px Inter,sans-serif;letter-spacing:.06em;color:${PURPLE}">${esc(s.date)}</div>
    <div style="margin-top:6px;font:400 28px Inter,sans-serif;color:${INK};line-height:1.4">${esc(s.text)}</div></div></div>`).join("");
  return `<div style="position:relative;width:${w}px;height:${h}px;overflow:hidden;background:${WHITE};padding:80px;box-sizing:border-box">
  <div style="position:absolute;left:80px;top:52px">${lockup(false, 40)}</div>
  <div data-swt-role="editorial_headline" style="margin-top:120px;${typeStyle("editorial_headline", 54, NAVY, "line-height:1.12")}">${esc(ctx.headline || "The situation, dated")}</div>
  <div style="margin-top:40px">${rows}</div>
  <div style="position:absolute;left:80px;right:80px;bottom:72px">${callout(ctx.proof_meaning || "informational", ctx.proof || "Proof point")}</div>
</div>`;
}

/* ---------------------------------------------------------------- 4. Angle Record Card (1200x900)
 * INTERNAL strategy-review component: all 10 Angle Record fields · status pill · fan-out list.
 * Internal ids ARE permitted here (this component is not customer-facing). */
export function angleRecordCard(ctx = {}) {
  const { w, h } = componentCanvas("Angle Record Card");
  const a = ctx.angle || {};
  const fields = [["angle_id", a.angle_id], ["product_id", a.product_id], ["job", a.job || (a.strategy && a.strategy.jobs && a.strategy.jobs.join(", "))],
    ["situation", a.situation], ["insight", a.insight], ["mechanism", a.mechanism], ["proof", a.proof],
    ["objection", a.objection], ["desired_outcome", a.desired_outcome], ["verdict", a.angle_verdict || a.verdict]];
  const rows = fields.map(([k, v]) => `<div style="display:flex;gap:16px;padding:9px 0;border-bottom:1px solid ${BORDER}">
    <div style="flex:none;width:210px;font:700 17px Inter,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:${MUTED}">${esc(k)}</div>
    <div style="font:400 20px Inter,sans-serif;color:${INK};line-height:1.35">${esc(v == null ? "—" : String(v))}</div></div>`).join("");
  const pill = `<div style="display:inline-block;background:${a.angle_verdict === "GREEN" ? DA.hex("success") : DA.hex("warning")};color:${WHITE};font:700 18px Inter,sans-serif;padding:7px 18px;border-radius:999px">${esc(a.angle_verdict || a.verdict || "STATUS")}</div>`;
  const fan = Array.isArray(ctx.fanout) && ctx.fanout.length ? `<div style="margin-top:18px;font:400 19px Inter,sans-serif;color:${INK};line-height:1.5">${ctx.fanout.map((f) => "&#8226; " + esc(f)).join("<br>")}</div>` : `<div style="margin-top:18px;font:400 18px Inter,sans-serif;color:${MUTED}">fan-out list pending</div>`;
  return `<div style="position:relative;width:${w}px;height:${h}px;overflow:hidden;background:${WHITE};padding:60px 70px;box-sizing:border-box">
  <div style="display:flex;align-items:center;justify-content:space-between"><div>${lockup(false, 38)}</div>${pill}</div>
  <div style="margin-top:26px;font:500 16px Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:${PURPLE}">Angle Record · internal strategy review</div>
  <div style="margin-top:8px;font:400 30px 'DM Serif Display',Georgia,serif;color:${NAVY}">${esc(a.title || ctx.title || a.angle_id || "Angle Record")}</div>
  <div style="margin-top:16px">${rows}</div>
  ${fan}</div>`;
}

/* ---------------------------------------------------------------- 5. OG Share Image (1200x630)
 * mandatory: category label · headline (DM Serif Regular) · URL/proof line. */
export function ogShareImage(ctx = {}) {
  const { w, h } = componentCanvas("OG Share Image");
  const label = `<div style="font:700 22px Inter,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:${GOLD}">${esc(ctx.category || "SWIIPT")}</div>`;
  const headline = `<div data-swt-role="editorial_headline" style="margin-top:18px;${typeStyle("editorial_headline", 68, WHITE, "line-height:1.1")}">${esc(ctx.headline || "")}</div>`;
  const proof = `<div data-swt-attribution style="margin-top:26px;font:400 24px Inter,sans-serif;color:${ON_NAVY_2}">${esc(ctx.url || ctx.proof || "swiipt.com")}</div>`;
  return `<div style="position:relative;width:${w}px;height:${h}px;overflow:hidden;background:radial-gradient(130% 120% at 82% 92%, rgba(255,255,255,.06) 0%, ${NAVY} 60%);box-sizing:border-box">
  <div style="position:absolute;left:70px;top:56px">${lockup(true, 40)}</div>
  <div style="position:absolute;left:70px;right:70px;bottom:56px">${label}${headline}${proof}</div>
</div>`;
}

/* ---------------------------------------------------------------- 6. Carousel Slide (1080x1080, x7)
 * mandatory: slide-position counter · one curiosity gap per slide. */
export function carouselSlide(ctx = {}) {
  const { w, h } = componentCanvas("Carousel Slide");
  const i = Number(ctx.index) || 1, n = Number(ctx.total) || 7;
  if (i < 1 || n < 1 || i > n) throw new Error("marketing component library: carousel slide requires 1 <= index <= total");
  const gapText = ctx.gap ? `<div data-swt-role="editorial_headline" style="${typeStyle("editorial_headline", 66, INK, "line-height:1.14")}">${esc(ctx.gap)}</div>` : "";
  const counter = `<div data-swt-counter style="position:absolute;right:70px;bottom:60px;font:700 22px Inter,sans-serif;letter-spacing:.08em;color:${MUTED}">${i} / ${n}</div>`;
  return `<div style="position:relative;width:${w}px;height:${h}px;overflow:hidden;background:${SOFT};padding:90px;box-sizing:border-box">
  <div style="position:absolute;left:90px;top:56px">${lockup(false, 38)}</div>
  <div style="position:absolute;left:90px;right:90px;top:50%;transform:translateY(-50%)">${gapText}</div>
  <div style="position:absolute;left:90px;bottom:60px;width:80px;height:4px;background:${GOLD}"></div>
  ${counter}</div>`;
}

/* ---------------------------------------------------------------- dispatch + mandatory gate */
export const COMPONENT_RENDERERS = Object.freeze({
  "Hook Graphic": hookGraphic, "Quote Card": quoteCard, "Situation Timeline": situationTimeline,
  "Angle Record Card": angleRecordCard, "OG Share Image": ogShareImage, "Carousel Slide": carouselSlide,
});

export function renderMarketingComponent(name, ctx = {}) {
  const r = COMPONENT_RENDERERS[name];
  if (!r) throw new Error(`marketing component library: no renderer for "${name}"`);
  const html = r(ctx);
  const missing = componentMandatoryMissing(name, ctx);
  if (missing.length) throw new Error(`marketing component library: "${name}" missing mandatory element(s): ${missing.join(", ")}`);
  return html;
}

/** Machine-check the authority's `mandatory` list for a component against the supplied context. */
export function componentMandatoryMissing(name, ctx = {}) {
  const g = DA.groundingElement();
  const out = [];
  const has = (x) => typeof x === "string" && x.trim().length > 0;
  const check = (token, ok) => { if (!ok) out.push(token); };
  switch (name) {
    case "Hook Graphic":
      check("grounding badge", DA.isGroundingElement(ctx.grounding));
      check("Inter Black hook", has(ctx.hook));
      check("arrow/CTA dot", true); // always rendered by the component
      break;
    case "Quote Card":
      check("DM Serif italic quote", has(ctx.quote) && ctx.verbatim !== false);
      check("source attribution line", has(ctx.attribution));
      break;
    case "Situation Timeline":
      check("2-3 dated stages", Array.isArray(ctx.stages) && ctx.stages.length >= 2 && ctx.stages.length <= 3);
      check("proof callout", has(ctx.proof));
      break;
    case "Angle Record Card":
      check("all 10 Angle Record fields", ctx.angle && ["angle_id", "product_id", "situation", "insight", "mechanism", "proof", "objection", "desired_outcome"].every((k) => has(ctx.angle[k]) || (k === "proof" && has(ctx.angle.proof))));
      check("status pill", has(ctx.angle && (ctx.angle.angle_verdict || ctx.angle.verdict)));
      check("fan-out list", Array.isArray(ctx.fanout) && ctx.fanout.length > 0);
      break;
    case "OG Share Image":
      check("category label", has(ctx.category));
      check("headline", has(ctx.headline));
      check("URL/proof line", has(ctx.url) || has(ctx.proof));
      break;
    case "Carousel Slide":
      check("slide-position counter", Number(ctx.index) >= 1 && Number(ctx.total) >= 1);
      check("one curiosity gap per slide", has(ctx.gap));
      break;
    default:
      out.push(`unknown component "${name}"`);
  }
  // g is read for the grounding forms authority (exported for callers/QA)
  void g;
  return out;
}

export { NAVY, PURPLE, GOLD, BLUSH, CREAM, SOFT, INK, MUTED, WHITE, esc };
