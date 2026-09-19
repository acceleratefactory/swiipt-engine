import { stats } from "./png-decode.mjs";
const ACC = "V06-Marketing-Assets/Creative-Acceptance";
const rows = [
  ["AST-NS-001 (A hook)", `${ACC}/AST-NS-001/previous-final.png`, `${ACC}/AST-NS-001/corrected-final.png`],
  ["AST-NS-014 (B proof)", `${ACC}/PRODUCT-PROOF/previous-final.png`, `${ACC}/PRODUCT-PROOF/corrected-final.png`],
];
for (let i = 1; i <= 5; i++) {
  const n = String(i).padStart(2, "0");
  rows.push([`carousel slide ${i}`, `${ACC}/CAROUSEL/previous/slide-${n}.png`, `${ACC}/CAROUSEL/corrected/slide-${n}.png`]);
}
const region = { evidence: { x: 452, y: 132, w: 564, h: 792 } };
console.log("asset".padEnd(24), "| prev navy% | corr navy% | prev top3 navy% | corr top3 navy% | prev ev stddev | corr ev stddev");
for (const [name, prev, corr] of rows) {
  const a = stats(prev, region), b = stats(corr, region);
  const evA = a.regions.evidence ? a.regions.evidence.luma_stddev : "-";
  const evB = b.regions.evidence ? b.regions.evidence.luma_stddev : "-";
  console.log(
    name.padEnd(24), "|", String(a.flat_navy_pct).padStart(10), "|", String(b.flat_navy_pct).padStart(10), "|",
    String(a.third_navy_pct[0]).padStart(15), "|", String(b.third_navy_pct[0]).padStart(15), "|",
    String(evA).padStart(14), "|", String(evB).padStart(14),
  );
}
