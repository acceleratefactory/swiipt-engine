// §30 — V06 VISUAL REGRESSION BENCHMARK.
//
// Purpose: FUTURE COMPOSITOR CHANGE -> RUN V06 VISUAL REGRESSION -> DETECT BROKEN
// SCENE / EVIDENCE / LAYOUT BEHAVIOUR.
//
// It benchmarks PRODUCTION INTEGRITY and TREATMENT BEHAVIOUR — never identical creative
// appearance. It does not do pixel-perfect matching and does not require future products to
// look like V06. Thresholds are deliberately loose bands so legitimate creative evolution
// passes while a broken scene, a missing artifact, a navy fallback or a wrong treatment fails.
//
//   node mae/harness/v06-visual-regression.mjs --record    (write/refresh the benchmark)
//   node mae/harness/v06-visual-regression.mjs             (verify current campaign)
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { stats } from "./png-decode.mjs";

const OUT = resolve("V06-Marketing-Assets");
const LEDGER = join(OUT, "_campaign-ledger.json");
const BENCH = join(OUT, "_visual-regression-benchmark.json");
const RECORD = process.argv.includes("--record");

// Region of the real product artifact inside each product-proof/CTA layout (must match the compositor).
const evRegion = (t, dims) => {
  const [w, h] = dims.split("x").map(Number);
  const tall = h > w * 1.25;
  if (t === "B") return { evidence: tall ? { x: 230, y: 500, w: 620, h: 877 } : { x: 468, y: 120, w: 564, h: 798 } };
  if (t === "F") return { evidence: tall ? { x: 260, y: 653, w: 560, h: 792 } : { x: 670, y: 248, w: 330, h: 467 } };
  return {};
};

function probe(final, treatment, dims) {
  const s = stats(final, evRegion(treatment, dims));
  const r = {
    nonflat: s.nonflat_pct, navy: s.flat_navy_pct, white: s.white_pct, cream: s.cream_pct,
    third_navy: s.third_navy_pct[0], third_nonflat: s.third_nonflat_pct[0], rich: s.rich_pct,
  };
  if (s.regions.evidence) r.evidence_stddev = s.regions.evidence.luma_stddev;
  return r;
}

/** Scaffold-integrity profile for an organic creative: the centre must carry real content
 *  (photo detail or the real product artifact), never a flat navy/blank field. */
function organicProbe(p) {
  const s0 = stats(p);
  const region = { center: { x: Math.round(s0.w * 0.25), y: Math.round(s0.h * 0.25), w: Math.round(s0.w * 0.5), h: Math.round(s0.h * 0.5) } };
  const s = stats(p, region);
  return { w: s.w, h: s.h, navy: s.flat_navy_pct, nonflat: s.nonflat_pct, white: s.white_pct, cream: s.cream_pct, center_stddev: s.regions.center.luma_stddev };
}

const ledger = JSON.parse(readFileSync(LEDGER, "utf8"));
const rows = [];

// ---- organic media cluster images (ledger-independent: discovered from disk) -----------------
// Probes a scaffold-integrity profile for every rendered organic creative. Both layout families
// (photo-led and artifact-led) must carry real content in the centre, never a flat navy/blank field.
const ORGANIC = join(OUT, "Organic-Media");
function organicWalk(d, out = []) {
  if (!existsSync(d)) return out;
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) organicWalk(p, out);
    else if (p.toLowerCase().endsWith(".png")) out.push(p);
  }
  return out;
}
const organicRows = organicWalk(ORGANIC).map((p) => ({
  id: relative(OUT, p).replace(/\\/g, "/"),
  kind: "ORGANIC",
  treatment: "n/a",
  dims: "",
  final: p,
}));
for (const a of ledger.assets) {
  if (a.type === "STATIC") rows.push({ id: a.asset, kind: "STATIC", treatment: a.treatment, dims: a.dims, final: a.final });
  else if (a.type === "CAROUSEL" || a.type === "STORY") for (const s of a.slides) rows.push({ id: `${a.asset}#${s.slide}`, kind: a.type, treatment: s.treatment, dims: a.dims, final: s.final });
  else if (a.type === "REEL") {
    rows.push({ id: `${a.asset}#cover`, kind: "REEL", treatment: "E", dims: "1080x1920", final: a.cover.final });
    for (const k of a.keyframes) rows.push({ id: `${a.asset}#kf${k.index}`, kind: "REEL", treatment: "C", dims: "1080x1920", final: k.final });
  }
}

// ---- record -------------------------------------------------------------------------------
if (RECORD) {
  const bench = { benchmark: "V06 visual regression", purpose: "production integrity + treatment behaviour (not identical appearance)", recorded: new Date().toISOString(), compositor: "creative-compositor.mjs", tolerance: { nonflat: 14, navy: 14, third_navy: 16, evidence_stddev: 8 }, assets: {} };
  for (const r of rows) {
    if (!existsSync(r.final)) { console.log("MISSING", r.id); continue; }
    bench.assets[r.id] = { kind: r.kind, treatment: r.treatment, dims: r.dims, metrics: probe(r.final, r.treatment, r.dims) };
  }
  bench.organic = {};
  for (const r of organicRows) {
    if (!existsSync(r.final)) continue;
    bench.organic[r.id] = organicProbe(r.final);
  }
  writeFileSync(BENCH, JSON.stringify(bench, null, 2) + "\n", "utf8");
  console.log(`recorded ${Object.keys(bench.assets).length} social + ${Object.keys(bench.organic).length} organic benchmark entries -> ${BENCH}`);
  process.exit(0);
}

// ---- verify -------------------------------------------------------------------------------
if (!existsSync(BENCH)) { console.log("no benchmark recorded yet — run with --record"); process.exit(1); }
const bench = JSON.parse(readFileSync(BENCH, "utf8"));
const T = bench.tolerance;
const IMAGE_LED = new Set(["A", "E", "F"]);
const failures = [];
let checked = 0, missing = 0;

for (const [id, exp] of Object.entries(bench.assets)) {
  const row = rows.find((r) => r.id === id);
  if (!row) { failures.push(`${id}: asset no longer present in the campaign`); continue; }
  if (!existsSync(row.final)) { missing++; failures.push(`${id}: final missing (${row.final})`); continue; }
  checked++;
  if (row.treatment !== exp.treatment) failures.push(`${id}: treatment changed ${exp.treatment} -> ${row.treatment}`);
  if (row.dims !== exp.dims) failures.push(`${id}: dims changed ${exp.dims} -> ${row.dims}`);
  const m = probe(row.final, row.treatment, row.dims);
  // integrity invariants (absolute, not "looks the same")
  if (IMAGE_LED.has(exp.treatment) && m.navy > 45) failures.push(`${id}: navy scaffold — flat navy ${m.navy}% (>45)`);
  if (exp.treatment === "B" && m.evidence_stddev != null && m.evidence_stddev < 12) failures.push(`${id}: product artifact blank/placeholder — stddev ${m.evidence_stddev} (<12)`);
  if (exp.treatment === "C") {
    // Treatment C is typography-led: a dominant navy OR cream surface is correct and the
    // surface must carry real ink (contrasting body text + gold rule) — not be a blank scaffold.
    const navySurface = m.navy >= 55, creamSurface = m.white + m.cream >= 55;
    if (!navySurface && !creamSurface) failures.push(`${id}: editorial surface not dominant (navy ${m.navy}% / cream ${(m.white + m.cream).toFixed(1)}%)`);
    const ink = m.nonflat + (navySurface ? m.white : m.navy);
    if (ink < 1.5) failures.push(`${id}: editorial ink ${ink.toFixed(1)}% (<1.5) — blank scaffold`);
  }
  // drift bands (loose — headline rewording or a new scene must not fail the benchmark)
  const E = exp.metrics;
  if (m.nonflat < E.nonflat - T.nonflat) failures.push(`${id}: scene coverage collapsed ${E.nonflat}% -> ${m.nonflat}%`);
  if (IMAGE_LED.has(exp.treatment) && m.third_navy > E.third_navy + T.third_navy) failures.push(`${id}: text zone swallowed the scene (top-third navy ${E.third_navy}% -> ${m.third_navy}%)`);
  if (exp.treatment === "B" && m.evidence_stddev != null && E.evidence_stddev != null && m.evidence_stddev < E.evidence_stddev - T.evidence_stddev) failures.push(`${id}: artifact detail degraded ${E.evidence_stddev} -> ${m.evidence_stddev}`);
}

// ---- organic media cluster ----
let organicChecked = 0;
if (bench.organic) {
  for (const r of organicRows) {
    const exp = bench.organic[r.id];
    if (!existsSync(r.final)) { failures.push(`${r.id}: organic creative missing`); continue; }
    if (!exp) { failures.push(`${r.id}: new organic creative not in benchmark (re-run --record)`); continue; }
    organicChecked++;
    const m = organicProbe(r.final);
    if (m.navy > 55) failures.push(`${r.id}: navy scaffold — flat navy ${m.navy}% (>55)`);
    if (m.center_stddev < 10) failures.push(`${r.id}: blank centre — stddev ${m.center_stddev} (<10)`);
    if (exp.center_stddev != null && m.center_stddev < exp.center_stddev - 12) failures.push(`${r.id}: centre detail collapsed ${exp.center_stddev} -> ${m.center_stddev}`);
    if (m.nonflat + m.white + m.cream < 30) failures.push(`${r.id}: almost no content (nonflat+white+cream ${(m.nonflat + m.white + m.cream).toFixed(1)}%)`);
  }
}
checked += organicChecked;

console.log(`V06 visual regression: checked ${checked} creatives (${organicChecked} organic), ${missing} missing, ${failures.length} failures`);
if (failures.length) { for (const f of failures.slice(0, 40)) console.log("  FAIL", f); process.exitCode = 1; }
else console.log("RESULT: PASS — production integrity and treatment behaviour intact");
