// SWIIPT CANONICAL PRODUCT TRAILER — generalized production-contract module.
//
// The trailer is the canonical short COMMERCIAL introduction to an individual SWIIPT transformation/
// product (NOT YouTube long-form, NOT TikTok organic, NOT testimonial, NOT a course video). Every
// applicable product produces the complete 20-item trailer production package even when MP4
// generation is unavailable (task §15/§17) — no fake MP4 is ever created, VIDEO-STATUS stays truthful.
//
// Product-agnostic: no product id / asset id / angle id is hard-coded here.
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as DA from "./design-authority.mjs";
import { shotVerified } from "./creative-compositor.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export const TRAILER_ASSET_TYPE = "PRODUCT_TRAILER";
export const TRAILER_STATUS = Object.freeze({ PENDING_PROVIDER: "PENDING_PROVIDER", RENDERED: "RENDERED", FAILED: "FAILED" });
/** Canonical artefact→mechanism order (by asset TYPE — generic, not per product). */
const TYPE_RANK = { quiz: 1, quick_reference_card: 2, checklist: 3, log: 4, templates: 5, script: 6, emergency_card: 7 };
export function trailerProviderStatus() { return { available: false, reason: "no qualified video provider configured (pre-revenue $0)" }; }

/** Locate the producing product's approved angle + its validation record (product-agnostic). */
export function resolveAngle(productId, { root = ROOT } = {}) {
  const p = readJson(join(root, "data", "products", productId, "product.json"));
  const explicit = p?.angle_id ?? p?.marketing?.angle_id ?? null;
  const dir = join(root, "mae", "data", "angles");
  let angle = null;
  if (explicit && existsSync(join(dir, `${explicit}.json`))) angle = readJson(join(dir, `${explicit}.json`));
  else if (existsSync(join(dir, `ANG-${productId}.json`))) angle = readJson(join(dir, `ANG-${productId}.json`));
  else if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
      const a = readJson(join(dir, f));
      if (a?.product_id === productId) { angle = a; break; }
    }
  }
  let validation = null;
  const vdir = join(root, "mae", "data", "validations");
  if (angle && existsSync(vdir)) for (const f of readdirSync(vdir).filter((x) => x.endsWith(".json"))) {
    const v = readJson(join(vdir, f));
    if (v?.angle_id === angle.id) { validation = v; break; }
  }
  return { angle, validation };
}

/** The canonical product-trailer package (20 items, §15). */
export function trailerPackage(productId, { root = ROOT } = {}) {
  const pdir = join(root, "data", "products", productId);
  const p = readJson(join(pdir, "product.json"));
  const trId = p?.identity?.transformation_id ?? null;
  const tr = trId && existsSync(join(root, "data", "transformations", `${trId}.json`)) ? readJson(join(root, "data", "transformations", `${trId}.json`)) : null;
  const { angle, validation } = resolveAngle(productId, { root });

  const assets = Object.values(p?.asset_map ?? {}).flatMap((l) => (Array.isArray(l) ? l : [])).map((aid) => {
    const f = join(pdir, "assets", `${aid}.json`);
    return existsSync(f) ? { id: aid, ...readJson(f) } : null;
  }).filter(Boolean);
  const ordered = [...assets].sort((a, b) => (TYPE_RANK[a.asset_type] ?? 99) - (TYPE_RANK[b.asset_type] ?? 99));

  const title = p?.identity?.name ?? "";
  const promise = p?.identity?.one_line_promise ?? "";
  const mechanism = p?.transformation?.mechanism?.core ?? "";
  const t1 = angle?.tier1 ?? {}, t2 = angle?.tier2 ?? {}, t3 = angle?.tier3 ?? {};
  const claimBoundary = t3?.counter_evidence_acknowledged ?? "no efficacy or savings claims";
  const exclusions = [
    "no guaranteed savings", "no efficacy claims", "no statistics/results/testimonials",
    "no generic finance imagery", "no money piles", "no floating currency", "no fake dashboards",
    "no internal ids", "no medical/clinical claims",
  ];
  const prohib = ["promising a specific money amount saved", "presenting Buy/Wait/Never or the audit as proven", "showing invented product interfaces"];

  const toolReveal = ordered.map((a) => a.title);
  const scenes = [
    { n: 1, beat: "SITUATION", duration_s: 4, visual: t1.scene ?? "", on_screen_text: t1.customer ? "New baby. Real budget." : "" },
    { n: 2, beat: "TENSION / STAKE", duration_s: 5, visual: t1.pain ?? "", on_screen_text: t1.emotional_stake?.text ?? "" },
    { n: 3, beat: "WHAT DO I DO NOW?", duration_s: 4, visual: `stuck on: ${t1.failed_attempt ?? "guessing"}`, on_screen_text: "Every list you try makes it worse." },
    { n: 4, beat: "SWIIPT MECHANISM", duration_s: 6, visual: t2.mechanism?.text ?? mechanism, on_screen_text: "One number. One rule." },
    { n: 5, beat: "ACTUAL PRODUCT / TOOLS", duration_s: 7, visual: toolReveal.join(" → "), on_screen_text: toolReveal.slice(0, 3).join(" · "), artifact_reveal: true },
    { n: 6, beat: "IMMEDIATE TRANSFORMATION", duration_s: 5, visual: t2.desired_change ?? promise, on_screen_text: "A plan you can both see." },
    { n: 7, beat: "CTA", duration_s: 4, visual: `cover reveal + product name + CTA`, on_screen_text: title, cover_reveal: true, cta: true },
  ];
  const total = scenes.reduce((s, x) => s + x.duration_s, 0);

  const shot_list = [
    { shot: "S1 establishing", framing: "medium, handheld, shallow", subject: "parent at home table", move: "slow push-in", lens: "35mm", lighting: "window daylight" },
    { shot: "S2 tension", framing: "close on phone notes + face", subject: "person scrolling a list", move: "static", lens: "50mm", lighting: "mixed warm" },
    { shot: "S3 stall", framing: "top-down table", subject: "lists, calculator, receipts", move: "tilt down", lens: "35mm", lighting: "daylight" },
    { shot: "S4 mechanism", framing: "flat-lay of the real chart", subject: "one-number budget chart", move: "overhead drift", lens: "50mm", lighting: "soft even" },
    { shot: "S5 tools", framing: "sequential cut-downs of real artifacts", subject: toolReveal.join(", "), move: "match-cut cuts", lens: "50mm", lighting: "consistent" },
    { shot: "S6 change", framing: "two-shot, fridge chart in frame", subject: "both partners", move: "slow arc", lens: "35mm", lighting: "warm daylight" },
    { shot: "S7 CTA", framing: "cover card", subject: "canonical product cover", move: "locked", lens: "n/a", lighting: "n/a" },
  ];
  const on_screen_text = scenes.map((s) => s.on_screen_text).filter(isStr);
  const transitions = ["cut", "cut", "whip-pan cut", "match cut", "match cut", "dissolve", "fade to cover"];
  const captions = scenes.map((s, i) => ({ t_in: scenes.slice(0, i).reduce((a, x) => a + x.duration_s, 0), t_out: scenes.slice(0, i + 1).reduce((a, x) => a + x.duration_s, 0), text: s.on_screen_text }));

  const brief = [
    `PRODUCT TRAILER BRIEF — ${title}`,
    `Canonical short commercial introduction (not long-form, not organic social, not a testimonial).`,
    `Audience: ${t1.customer ?? ""}`,
    `Angle: ${angle?.id ?? "(unresolved)"} (${angle?.status ?? "?"}) — validation ${validation?.id ?? "(unresolved)"} (${validation?.verdict ?? "?"})`,
    `Stake: ${t1.emotional_stake?.text ?? ""}`,
    `Mechanism: ${t2.mechanism?.text ?? mechanism}`,
    `Desired change: ${t2.desired_change ?? promise}`,
    `Boundary: ${claimBoundary}`,
  ].join("\n");

  const master_prompt = [
    `SWIIPT PRODUCT TRAILER — MASTER VIDEO-GENERATION PROMPT (provider-ready)`,
    `Duration: ${total}s  (7 shots)   Aspect: 16:9 master (9:16 + 1:1 derived)   Style: restrained documentary-editorial, real textures`,
    ``,
    `SUBJECT/SCENE: ${t1.scene ?? ""}. Subjects: ${t1.customer ?? ""}. Environment: ordinary home; grounded objects only (real chart, lists, phone).`,
    `PROGRESSION: ${scenes.map((s) => `${s.n}) ${s.beat} — ${s.visual}`).join(" | ")}`,
    `CAMERA: handheld→static→overhead flat-lay→match-cuts→locked cover. Lens 35–50mm. No drone, no whip-zoom tricks.`,
    `LIGHTING: natural window daylight; consistent grade; no stylised neon.`,
    `PRODUCT APPEARANCE: show the ACTUAL rendered artifacts — ${toolReveal.join(" → ")} — never invented interfaces.`,
    `TYPOGRAPHY/ON-SCREEN TEXT (deterministic, Swiipt design authority): ${on_screen_text.join(" · ")}`,
    `TRANSITIONS: ${transitions.join(", ")}.`,
    `PACING: ${scenes.map((s) => `${s.duration_s}s`).join("/")}.`,
    `EMOTIONAL PROGRESSION: uncertainty → shame-bound tension → relief-by-structure → confidence.`,
    `CTA: ${title} — ${promise}`,
    `PROHIBITED IMAGERY: ${exclusions.join("; ")}`,
    `PROHIBITED CLAIMS: ${prohib.join("; ")}`,
    `CONTINUITY: same palette, mark and product cover identity throughout; product artifacts must match the customer product exactly.`,
  ].join("\n");

  return {
    asset_type: TRAILER_ASSET_TYPE,
    trailer_id: `TRAILER-${productId}`,
    product_id: productId,
    transformation_id: trId,
    title,
    angle_ref: angle?.id ?? null,
    angle_status: angle?.status ?? null,
    validation_ref: validation?.id ?? null,
    validation_verdict: validation?.verdict ?? null,
    brief,
    master_prompt,
    scenes,
    shot_list,
    timing: { total_s: total, per_beat: scenes.map((s) => ({ beat: s.beat, s: s.duration_s })) },
    script: scenes.map((s) => ({ n: s.n, beat: s.beat, narration: s.on_screen_text || s.visual })),
    on_screen_text,
    transitions,
    product_reveal: `Cut to the real artifacts in order: ${toolReveal.join(" → ")}.`,
    cover_reveal: "Final beat reveals the canonical PRODUCT COVER (same identity as the store + customer product).",
    cta: `${title} — ${promise}`,
    audio: "Warm, low-key instrumental; no corporate uplift cliché; no voice unless a real VO is produced.",
    sound_design: "Room tone + soft UI ticks only; no whooshes, no stings, no cash/coin SFX.",
    vgb_refs: [],
    exclusions,
    prohibited_claims: prohib,
    captions,
    platform_variants: [
      { platform: "product-page", aspect: "16:9", note: "master" },
      { platform: "youtube/presentation", aspect: "16:9", note: "master" },
      { platform: "reels/tiktok/shorts", aspect: "9:16", note: "center-safe crop of master" },
      { platform: "feed", aspect: "1:1", note: "derived crop" },
    ],
    poster: "poster.png",
    video_status: TRAILER_STATUS.PENDING_PROVIDER,
    provider_provenance: null,
    _ordered_artifacts: toolReveal,
  };
}

/** Deterministic trailer poster (typographic; no provider needed). */
export function posterHtml(pkg, { w = 1080, h = 1920 } = {}) {
  const NAVY = DA.hex("navy"), GOLD = DA.hex("gold"), WHITE = DA.supportTokens().white;
  return `<div style="position:relative;width:${w}px;height:${h}px;overflow:hidden;background:${NAVY};font-family:Inter,sans-serif">
  <div style="position:absolute;left:72px;top:72px;line-height:0">${DA.logoSvg({ dark: true, height:44 })}</div>
  <div style="position:absolute;left:72px;right:72px;bottom:120px">
    <div style="font:600 20px Inter,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:${GOLD}">Product trailer</div>
    <div style="width:90px;height:4px;background:${GOLD};margin:20px 0 26px"></div>
    <div style="font-family:'DM Serif Display',Georgia,serif;font-size:86px;line-height:1.06;color:${WHITE}">${esc(pkg.title)}</div>
    <div style="margin-top:26px;font:400 30px/1.4 Inter,sans-serif;color:rgba(255,255,255,.86)">${esc(pkg.cta.split("—").slice(1).join("—").trim())}</div>
    <div style="margin-top:34px;display:inline-block;border:1.5px solid ${GOLD};color:${GOLD};font:700 20px Inter,sans-serif;letter-spacing:.1em;text-transform:uppercase;padding:10px 20px;border-radius:999px">Watch the transformation</div>
  </div></div>`;
}

/** Produce the full trailer package + deterministic poster. Never writes an MP4. */
export function produceProductTrailer(productId, { root = ROOT, outDir = null, render = true } = {}) {
  const pkg = trailerPackage(productId, { root });
  const dir = outDir ?? join(root, "data", "products", productId, "trailer");
  mkdirSync(dir, { recursive: true });
  const provider = trailerProviderStatus();
  pkg.provider = { ...provider, status: pkg.video_status };

  writeFileSync(join(dir, "trailer.json"), JSON.stringify(pkg, null, 2) + "\n", "utf8");
  writeFileSync(join(dir, "master-prompt.txt"), pkg.master_prompt + "\n", "utf8");
  writeFileSync(join(dir, "script.txt"), pkg.script.map((s) => `[${s.n}] ${s.beat}: ${s.narration}`).join("\n") + "\n", "utf8");
  writeFileSync(join(dir, "storyboard.txt"), pkg.scenes.map((s) => `${String(s.n).padStart(2, "0")}  ${s.beat}  (${s.duration_s}s)  ${s.visual}`).join("\n") + "\n", "utf8");
  writeFileSync(join(dir, "shot-list.txt"), pkg.shot_list.map((s) => `${s.shot}: ${s.framing} — ${s.subject} — ${s.move} — ${s.lens} — ${s.lighting}`).join("\n") + "\n", "utf8");
  writeFileSync(join(dir, "on-screen-text.txt"), pkg.on_screen_text.join("\n") + "\n", "utf8");
  writeFileSync(join(dir, "captions.srt"), pkg.captions.map((c, i) => `${i + 1}\n${srt(c.t_in)} --> ${srt(c.t_out)}\n${c.text}\n`).join("\n"), "utf8");
  writeFileSync(join(dir, "VIDEO-STATUS.txt"), `VIDEO-STATUS: ${pkg.video_status}\nreason: ${provider.reason}\nno MP4 produced (truthful — no provider execution)\n`, "utf8");
  pkg.poster_render = "SKIPPED";
  if (render) {
    try { const r = shotVerified(posterHtml(pkg), 1080, 1920, join(dir, "poster.png"), { requireCta: false }); pkg.poster_render = r.ok ? "RENDERED" : r.status; }
    catch { pkg.poster_render = "RENDER_FAILED"; }
    writeFileSync(join(dir, "trailer.json"), JSON.stringify(pkg, null, 2) + "\n", "utf8");
  }
  pkg.dir = dir;
  return pkg;
}

function srt(s) { const h = String(Math.floor(s / 3600)).padStart(2, "0"), m = String(Math.floor((s % 3600) / 60)).padStart(2, "0"), sec = String(Math.floor(s % 60)).padStart(2, "0"); return `${h}:${m}:${sec},000`; }
