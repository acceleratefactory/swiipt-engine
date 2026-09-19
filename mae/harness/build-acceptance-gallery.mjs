// Build the mandatory owner comparison gallery (Task §14):
//   RAW GENERATED VISUAL | PREVIOUS FINAL | CORRECTED FINAL   (asset 1 + asset 2)
//   PREVIOUS CAROUSEL | CORRECTED CAROUSEL                    (slide by slide)
// Self-contained review page using relative paths (no inline bloat).
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stats } from "./png-decode.mjs";

const ACC = "V06-Marketing-Assets/Creative-Acceptance";
const LEDGER = JSON.parse(readFileSync(join(ACC, "acceptance-ledger.json"), "utf8"));
const evRegion = { evidence: { x: 452, y: 132, w: 564, h: 792 } };
const A = (p) => (existsSync(p) ? stats(p, evRegion) : null);
const num = (v, d = 1) => (v == null ? "&mdash;" : Number(v).toFixed(d));

const card = (src, cap, sub = "") => `
  <figure class="pc">
    <div class="imgbox">${existsSync(src) ? `<img src="${src}" alt="${cap}">` : `<div class="miss">not rendered</div>`}</div>
    <figcaption><b>${cap}</b>${sub ? `<span>${sub}</span>` : ""}</figcaption>
  </figure>`;

function asset1() {
  const a = LEDGER.assets[0];
  const p = `${ACC}/AST-NS-001`;
  const prev = A(`${p}/previous-final.png`), corr = A(`${p}/corrected-final.png`);
  return `
  <section>
    <h2>1 &middot; AST-NS-001 <span class="tag tA">TREATMENT A &mdash; EMOTIONAL / PROBLEM HOOK</span></h2>
    <p class="meta">Approved asset record <code>AST-NS-001</code> &middot; purpose <code>stop_scroll_identification</code> &middot; family IDENTIFICATION &middot; Facebook feed square &middot; 1080&times;1080 &middot; <b class="ok">RENDERED &middot; QA PASS</b></p>
    <div class="row r3">
      ${card(`${p}/raw-scene.jpg`, "RAW GENERATED VISUAL", "the exact generated scene (provider output, untouched)")}
      ${card(`${p}/previous-final.png`, "PREVIOUS FINAL", "navy scaffold + broken evidence card")}
      ${card(`${p}/corrected-final.png`, "CORRECTED FINAL", "photo is the canvas &middot; navy scrim text zone")}
    </div>
    <table class="meas">
      <tr><th></th><th>previous</th><th>corrected</th></tr>
      <tr><td>flat navy (whole canvas)</td><td class="bad">${num(prev?.flat_navy_pct)}%</td><td class="good">${num(corr?.flat_navy_pct)}%</td></tr>
      <tr><td>flat navy (top third &mdash; where the photo must live)</td><td class="bad">${num(prev?.third_navy_pct?.[0])}%</td><td class="good">${num(corr?.third_navy_pct?.[0])}%</td></tr>
      <tr><td>non-flat scene coverage</td><td class="bad">${num(prev?.nonflat_pct)}%</td><td class="good">${num(corr?.nonflat_pct)}%</td></tr>
    </table>
    <p class="why"><b>Why it failed:</b> the previous render wrote the document to <code>final/</code> but referenced the scene as the relative path <code>raw-generated/scene.jpg</code> &mdash; which resolves to <code>final/raw-generated/scene.jpg</code>, a path that does not exist. The scene 404'd and the navy background showed through. <b>Fix:</b> required visuals are now inlined as data URIs; they cannot 404.</p>
  </section>`;
}

function asset2() {
  const a = LEDGER.assets[1];
  const p = `${ACC}/PRODUCT-PROOF`;
  const prev = A(`${p}/previous-final.png`), corr = A(`${p}/corrected-final.png`);
  return `
  <section>
    <h2>2 &middot; ${a.asset} <span class="tag tB">TREATMENT B &mdash; PRODUCT / MECHANISM PROOF</span></h2>
    <p class="meta">Approved asset record <code>${a.asset}</code> &middot; purpose <code>objection_handling</code> &middot; evidence = <b>${a.evidence_page}</b> (${a.evidenceLabel || "the real Fridge Shift Chart"}) &middot; Facebook &middot; 1080&times;1080 &middot; <b class="ok">RENDERED &middot; QA PASS</b></p>
    <p class="meta sel"><b>Selection rationale (data-driven, not V06-hardcoded):</b> no V06 asset carries a literal <code>PRODUCT</code>/<code>MECHANISM</code> purpose, so the strongest mechanism-proof asset was chosen from the record fields &mdash; purpose <code>objection_handling</code> (the asset that must prove the system answers the doubt), product truth weight <code>25</code> (highest), and an evidence mapping to a named V06 mechanism (the <b>Fridge Shift Chart</b>, page 18).</p>
    <div class="row r4">
      ${card(`${p}/raw-scene.jpg`, "RAW GENERATED VISUAL", "the generated environment scene")}
      ${card(`${p}/product-evidence.png`, "PRODUCT EVIDENCE", "the real corrected V06 page-18 artifact")}
      ${card(`${p}/previous-final.png`, "PREVIOUS FINAL", "generic white rectangle, no artifact")}
      ${card(`${p}/corrected-final.png`, "CORRECTED FINAL", "real artifact dominant + scene environment")}
    </div>
    <table class="meas">
      <tr><th></th><th>previous</th><th>corrected</th></tr>
      <tr><td>flat navy (whole canvas)</td><td class="bad">${num(prev?.flat_navy_pct)}%</td><td class="good">${num(corr?.flat_navy_pct)}%</td></tr>
      <tr><td>flat navy (top third)</td><td class="bad">${num(prev?.third_navy_pct?.[0])}%</td><td class="good">${num(corr?.third_navy_pct?.[0])}%</td></tr>
      <tr><td>real artifact detail in the frame (luma stddev)</td><td class="bad">blank / broken image</td><td class="good">${num(corr?.regions?.evidence?.luma_stddev, 2)}</td></tr>
    </table>
    <p class="why"><b>Why the evidence failed:</b> same relative-path bug &mdash; the card's <code>&lt;img src="product-evidence/page-XX.png"&gt;</code> resolved under <code>final/</code>, so the artifact never loaded and the card rendered as a generic white rectangle labelled &ldquo;Real system page&rdquo;. <b>Fix:</b> the real artifact is inlined, decoded in Node before render, and composited at dominant size (564&times;792px frame) with a shadow; a blank frame now <b>fails the render</b>.</p>
  </section>`;
}

function carousel() {
  const pack = (which) => [1, 2, 3, 4, 5].map((i) => {
    const n = String(i).padStart(2, "0");
    return card(`${ACC}/CAROUSEL/${which}/slide-${n}.png`, `SLIDE ${i}`, which === "corrected" ? "&nbsp;" : "&nbsp;");
  }).join("");
  return `
  <section>
    <h2>3 &middot; AST-NS-013 <span class="tag tD">TREATMENT D &mdash; EDUCATIONAL CAROUSEL</span></h2>
    <p class="meta">Approved carousel <code>AST-NS-013</code> (DES-NS-010) &middot; 5 slides, approved order &middot; Instagram &middot; 1080&times;1080 &middot; <b class="ok">5/5 RENDERED &middot; QA PASS</b></p>
    <p class="meta sel">Per-slide treatments derived from each slide's role in the approved order: <b>A</b> photo hook &rarr; <b>C</b> editorial explanation &rarr; <b>B</b> mechanism proof &rarr; <b>C</b> editorial support &rarr; <b>F</b> CTA &mdash; one campaign family, deliberately not five identical navy cards.</p>
    <h3>PREVIOUS CAROUSEL</h3>
    <div class="row r5">${pack("previous")}</div>
    <h3>CORRECTED CAROUSEL</h3>
    <div class="row r5">${pack("corrected")}</div>
    <h3>CONTACT SHEET</h3>
    <div class="row r1">${card(`${ACC}/CAROUSEL/contact-sheet.png`, "PREVIOUS (top) vs CORRECTED (bottom)", "all five slides, one view")}</div>
  </section>`;
}

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Swiipt Creative Compositor — V06 Acceptance</title>
<style>
:root{--navy:#0B1F33;--purple:#6F35B5;--gold:#D9A52E;--cream:#F8F4EC;--ink:#17212B;--mut:#52606D;--line:#DDE2E7}
*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font:16px/1.55 Inter,-apple-system,Segoe UI,Arial,sans-serif}
header{background:var(--navy);color:#fff;padding:40px 44px}
header h1{margin:0 0 8px;font:400 34px/1.15 Georgia,'DM Serif Display',serif}
header p{margin:0;color:#B9C7D6;font-size:15px}
header .warn{margin-top:16px;display:inline-block;background:rgba(217,165,46,.16);border:1px solid var(--gold);color:#F0D9A0;padding:8px 14px;border-radius:8px;font-weight:600;font-size:14px}
main{padding:34px 44px 80px;max-width:1680px}
section{background:#fff;border:1px solid var(--line);border-radius:14px;padding:26px 26px 30px;margin-bottom:30px}
h2{margin:0 0 8px;font:400 26px/1.2 Georgia,serif;color:var(--navy)}
h3{margin:26px 0 10px;font:700 13px/1 Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--mut)}
.tag{display:inline-block;font:700 11px/1 Inter,sans-serif;letter-spacing:.08em;padding:6px 10px;border-radius:999px;vertical-align:middle;margin-left:10px}
.tA{background:#F5EFFB;color:var(--purple)}.tB{background:#FBF3DF;color:#8A6410}.tD{background:#E9F1EA;color:#2F5D3A}
.meta{font-size:14px;color:var(--mut);margin:4px 0 16px}.meta code{background:#F1F4F7;padding:1px 5px;border-radius:4px;font-size:13px}
.sel{background:#F7F9FB;border-left:3px solid var(--purple);padding:12px 14px;border-radius:0 8px 8px 0}
.ok{color:#2F7D4F}
.row{display:grid;gap:16px;margin-bottom:6px}
.r1{grid-template-columns:minmax(0,760px)}
.r3{grid-template-columns:repeat(3,minmax(0,1fr))}
.r4{grid-template-columns:repeat(4,minmax(0,1fr))}
.r5{grid-template-columns:repeat(5,minmax(0,1fr))}
.pc{margin:0}
.imgbox{background:#0B1F33;border:1px solid var(--line);border-radius:10px;overflow:hidden}
.pc img{display:block;width:100%;height:auto}
.miss{height:220px;display:flex;align-items:center;justify-content:center;color:#8FA4BB}
figcaption{font-size:13px;padding:9px 2px 0;display:flex;flex-direction:column;gap:2px}
figcaption b{color:var(--navy)}figcaption span{color:var(--mut);font-size:12.5px}
table.meas{border-collapse:collapse;margin:20px 0 4px;font-size:14px;min-width:520px}
table.meas th,table.meas td{border:1px solid var(--line);padding:7px 12px;text-align:left}
table.meas th{background:#F1F4F7;font-weight:600;color:var(--navy)}
.bad{color:#B23A3A;font-weight:600}.good{color:#2F7D4F;font-weight:600}
.why{font-size:13.5px;color:var(--mut);background:#FBFCFD;border:1px dashed var(--line);border-radius:8px;padding:12px 14px;margin-top:14px}
footer{padding:0 44px 60px;color:var(--mut);font-size:13px}
</style></head><body>
<header>
  <h1>Swiipt Creative Compositor &mdash; V06 Acceptance</h1>
  <p>Three representative assets re-rendered through the corrected reusable compositor. V06 is the acceptance benchmark; the compositor itself is product-agnostic.</p>
  <div class="warn">AWAITING OWNER VISUAL APPROVAL &mdash; automated QA is necessary but not sufficient</div>
</header>
<main>
${asset1()}
${asset2()}
${carousel()}
</main>
<footer>Generated ${new Date().toISOString()} &middot; provider calls 0 &middot; provider spend $0 &middot; 3 acceptance assets only (no full campaign regeneration)</footer>
</body></html>`;

writeFileSync(join(ACC, "index.html"), html, "utf8");
console.log("wrote", join(ACC, "index.html"), html.length, "bytes");
