// Master-assembly acceptance tests (task §18 items 1–22).
// node --test harness/master-assembly.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import {
  DESIGN_AUTHORITY_ID, DESIGN_AUTHORITY_VERSION, MASTER_KIND, MASTER_EBOOK_META,
  resolveDesignAuthority, designAuthorityResolved, buildMasterTree, masterSectionPlan,
  assertMasterReady, legacyCanSatisfyMaster, masterDeliverySet, assemblyLineage,
  needsRerenderForDesignAuthority, orderAssets, MASTER_READY_ERRORS,
  CANONICAL_MODE_ORDER, MODE_COMPONENT, componentForMode, canonicalModeOrder,
  stripWidgetMarkers, assertConsumerClean,
} from "./master-assembly.mjs";
import { DELIVERY_CLASS, CUSTOMER_DOWNLOAD_CLASSES, reconcileAssetSet, classifyDelivery } from "./publisher-fidelity.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const manifest = (id) => JSON.parse(readFileSync(join(ROOT, "data", "products", id, "publish", "manifest.json"), "utf8"));
const FM = "PPL-FAMILY-MONEY-001";
const V06 = "PPL-NIGHT-SHIFT-001";
const DA = resolveDesignAuthority();
const cover = (pid) => `COVER-${pid}.portrait`;
const fmTree = () => { const m = manifest(FM); return buildMasterTree({ product: { product_id: FM, identity: { name: m.product.title, subtitle: m.product.description, one_line_promise: m.product.short_description } }, transformation: { situation: m.transformation.desired_state, mechanism: { core: "Quiz → one number → chart" }, first_win: "15 minutes" }, assets: m.assets.map((a, i) => ({ title: a.title, format: a.job, content: a.content, position: i })), coverRef: cover(FM) }); };

test("01 multi-asset product creates MASTER_PRODUCT", () => {
  assert.equal(fmTree().kind, MASTER_KIND);
  assert.equal(MASTER_KIND, "master_product");
});
test("02 MASTER_PRODUCT contains every required ordered asset", () => {
  const t = fmTree();
  assert.equal(t.assets.length, 6);
  assert.deepEqual(t.assets.map((a) => a.title), manifest(FM).assets.map((a) => a.title));
});
test("03 standalone asset cannot become product identity", () => {
  const m = manifest(FM);
  const t = fmTree();
  assert.equal(t.title, m.product.title);
  assert.ok(!m.assets.some((a) => a.title === t.title));
});
test("04 asset title cannot replace product title", () => {
  const r = assertMasterReady({ master: { kind: MASTER_KIND }, identity: "The Real Baby Budget Quiz", coverRef: cover(FM), designAuthority: DA, assets: [{ content: "x" }], pdfRef: "p.pdf", assetTitles: ["The Real Baby Budget Quiz"] });
  assert.ok(!r.ok); assert.ok(r.errors.includes(MASTER_READY_ERRORS.STANDALONE_SUBSTITUTED));
});
test("05 canonical cover required", () => {
  const r = assertMasterReady({ master: {}, identity: "X", coverRef: "", designAuthority: DA, assets: [{ content: "x" }], pdfRef: "p" });
  assert.ok(r.errors.includes(MASTER_READY_ERRORS.MISSING_COVER));
});
test("06 current Customer Product Design Authority required", () => {
  assert.ok(designAuthorityResolved(DA));
  const r = assertMasterReady({ master: {}, identity: "X", coverRef: "C", designAuthority: null, assets: [{ content: "x" }], pdfRef: "p" });
  assert.ok(r.errors.includes(MASTER_READY_ERRORS.MISSING_DESIGN_AUTHORITY));
});
test("07 MASTER_PRODUCT + standalone tools coexist", () => {
  const fm = manifest(FM);
  const set = masterDeliverySet({ kind: "master", file: "master.pdf" }, fm.assets.map((a, i) => ({ kind: "pdf", asset: { format: a.job }, title: a.title, i })));
  assert.equal(set.filter((d) => d.delivery_class === DELIVERY_CLASS.MASTER_PRODUCT).length, 1);
  assert.equal(set.filter((d) => d.delivery_class === DELIVERY_CLASS.PRINTABLE).length, 6);
});
test("08 MASTER_PRODUCT is first-class customer deliverable", () => {
  assert.ok(CUSTOMER_DOWNLOAD_CLASSES.includes(DELIVERY_CLASS.MASTER_PRODUCT));
});
test("09 INTERNAL_RENDER excluded", () => {
  assert.ok(!CUSTOMER_DOWNLOAD_CLASSES.includes(DELIVERY_CLASS.INTERNAL_RENDER));
  assert.equal(classifyDelivery({ format: "Read" }, { kind: "html" }), DELIVERY_CLASS.INTERNAL_RENDER);
});
test("10 legacy generic styling cannot satisfy master acceptance", () => {
  assert.equal(legacyCanSatisfyMaster(), false);
  const r = assertMasterReady({ master: null, identity: "X", coverRef: "C", designAuthority: DA, assets: [{ content: "x" }], pdfRef: "p" });
  assert.ok(!r.ok);
});
test("11 no V06-specific production dependency", () => {
  const src = readFileSync(join(ROOT, "harness", "master-assembly.mjs"), "utf8");
  for (const id of ["PPL-NIGHT-SHIFT", "v06", "V06", "swt_eb2"]) assert.ok(!src.includes(id), `must not contain ${id}`);
});
test("12 no Family Money-specific production dependency", () => {
  const src = readFileSync(join(ROOT, "harness", "master-assembly.mjs"), "utf8");
  for (const id of [FM, "PPL-FAMILY", "One-Number", "Baby Budget"]) assert.ok(!src.includes(id), `must not contain ${id}`);
});
test("13 second/synthetic product proves generalized assembly", () => {
  const synth = buildMasterTree({ product: { product_id: "SYNTH-TEST-001", identity: { name: "Synthetic System" } }, transformation: { situation: "s", mechanism: { core: "m" } }, assets: [{ title: "A", format: "Read", content: "aa", position: 0 }, { title: "B", format: "Decide", content: "bb", position: 1 }, { title: "C", format: "Do", content: "cc", position: 2 }, { title: "D", format: "Communicate", content: "dd", position: 3 }], coverRef: "COVER-SYNTH-TEST-001.portrait" });
  assert.equal(synth.kind, MASTER_KIND);
  assert.equal(synth.assets.length, 4);
  assert.deepEqual(synth.assets.map((a) => a.role), ["READ", "DECIDE", "DO", "COMMUNICATE"]);
  assert.ok(assertMasterReady({ master: synth, identity: synth.title, coverRef: "COVER-SYNTH-TEST-001.portrait", designAuthority: DA, assets: synth.assets, pdfRef: "s.pdf" }).ok);
});
test("14 republish remains idempotent", () => {
  const m = manifest(FM).assets.map((a, i) => ({ title: a.title, format: a.job, position: i }));
  const plan = reconcileAssetSet(m, m.map((a, i) => ({ id: i, title: a.title, format: a.format, position: a.position })));
  assert.equal(plan.create.length, 0); assert.equal(plan.remove.length, 0);
});
test("15 missing design authority → fail closed", () => {
  const r = assertMasterReady({ master: {}, identity: "X", coverRef: "C", designAuthority: { id: "wrong" }, assets: [{ content: "x" }], pdfRef: "p" });
  assert.ok(r.errors.includes(MASTER_READY_ERRORS.MISSING_DESIGN_AUTHORITY));
});
test("16 missing canonical cover → fail closed", () => {
  const r = assertMasterReady({ master: {}, identity: "X", coverRef: null, designAuthority: DA, assets: [{ content: "x" }], pdfRef: "p" });
  assert.ok(r.errors.includes(MASTER_READY_ERRORS.MISSING_COVER));
});
test("17 missing required asset → fail closed", () => {
  const r = assertMasterReady({ master: {}, identity: "X", coverRef: "C", designAuthority: DA, assets: [{ title: "A", content: "" }], pdfRef: "p" });
  assert.ok(r.errors.includes(MASTER_READY_ERRORS.MISSING_ASSETS));
});
test("18 failed master PDF render → publication not eligible", () => {
  const r = assertMasterReady({ master: {}, identity: "X", coverRef: "C", designAuthority: DA, assets: [{ content: "x" }], renderOk: false, pdfBytes: 0, pdfRef: "" });
  assert.ok(!r.ok); assert.ok(r.errors.includes(MASTER_READY_ERRORS.RENDER_FAILED));
});
test("19 _swt_ebook_pdf_url required after successful production", () => {
  assert.equal(MASTER_EBOOK_META.pdf, "_swt_ebook_pdf_url");
  const r = assertMasterReady({ master: {}, identity: "X", coverRef: "C", designAuthority: DA, assets: [{ content: "x" }], pdfRef: "" });
  assert.ok(r.errors.includes(MASTER_READY_ERRORS.EMPTY_PDF));
});
test("20 master design-authority lineage persisted", () => {
  const lin = assemblyLineage({ productId: FM, designAuthority: DA, coverRef: cover(FM), tree: fmTree(), pdfRef: "m.pdf" });
  assert.equal(lin.design_authority_id, DESIGN_AUTHORITY_ID);
  assert.equal(lin.design_authority_version, DESIGN_AUTHORITY_VERSION);
  assert.equal(lin.canonical_cover, cover(FM));
  assert.ok(lin.assets.length === 6);
});
test("21 standalone PDF cannot satisfy master-product requirement", () => {
  const r = assertMasterReady({ master: null, identity: "The Real Baby Budget Quiz", coverRef: cover(FM), designAuthority: DA, assets: [{ content: "x" }], pdfRef: "asset-98.pdf" });
  assert.ok(!r.ok);
  assert.ok(r.errors.includes(MASTER_READY_ERRORS.MISSING_MASTER));
});
test("22 design-authority version change triggers rerender/revalidation", () => {
  const lin = assemblyLineage({ productId: FM, designAuthority: DA, coverRef: cover(FM), tree: fmTree(), pdfRef: "m.pdf" });
  assert.equal(needsRerenderForDesignAuthority(lin, DESIGN_AUTHORITY_VERSION), false);
  assert.equal(needsRerenderForDesignAuthority(lin, "2.0"), true);
  assert.equal(needsRerenderForDesignAuthority(null), true);
});

/* ---------------------------------------------- semantic composition (task §23–§33) */

const MODULES = [
  { mode: "RESCUE", title: "Cart-Delete Loop Rescue" },
  { mode: "TRACK", title: "30-Day Use Audit Log" },
  { mode: "DECIDE", title: "Buy / Wait / Never List" },
  { mode: "READ", title: "The One-Number Budget Chart" },
  { mode: "DO", title: "The Real Baby Budget Quiz" },
];

test("23 canonical mode order is product-agnostic (no product references)", () => {
  const blob = JSON.stringify(CANONICAL_MODE_ORDER);
  for (const banned of ["V06", "FAMILY", "NIGHT", "CORD"]) assert.ok(!blob.includes(banned));
  assert.ok(CANONICAL_MODE_ORDER.includes("READ") && CANONICAL_MODE_ORDER.includes("RESCUE"));
});
test("24 every canonical mode resolves to a component", () => {
  for (const m of CANONICAL_MODE_ORDER) {
    assert.equal(typeof MODE_COMPONENT[m], "string");
    assert.ok(MODE_COMPONENT[m].length > 0);
  }
});
test("25 mode maps to the right functional component", () => {
  assert.equal(componentForMode("DO"), "worksheet");
  assert.equal(componentForMode("DECIDE"), "decision-interface");
  assert.equal(componentForMode("RESCUE"), "rescue-card");
  assert.equal(componentForMode("TRACK"), "tracker");
  assert.equal(componentForMode("READ"), "editorial");
  assert.equal(componentForMode("COMMUNICATE"), "script-card");
});
test("26 unknown mode degrades to editorial (never a fabricated component)", () => {
  assert.equal(componentForMode("NONSENSE"), "editorial");
  assert.equal(componentForMode(undefined), "editorial");
});
test("27 mode->component map contains no product-specific branching", () => {
  const blob = JSON.stringify(MODE_COMPONENT);
  for (const banned of ["V06", "FAMILY", "NIGHT", "CORD", "PPL-"]) assert.ok(!blob.includes(banned));
});
test("28 canonical order sequences understand -> decide -> act -> track -> recover", () => {
  const ordered = canonicalModeOrder(MODULES).map((m) => m.mode);
  assert.deepEqual(ordered, ["READ", "DECIDE", "DO", "TRACK", "RESCUE"]);
});
test("29 canonical order is stable and keeps unknown modes last", () => {
  const input = [{ mode: "ZZZ" }, { mode: "DO" }, { mode: "READ" }, { mode: "YYY" }];
  const ordered = canonicalModeOrder(input).map((m) => m.mode);
  assert.deepEqual(ordered, ["READ", "DO", "ZZZ", "YYY"]);
});
test("30 canonical order does not mutate its input", () => {
  const input = MODULES.map((m) => ({ ...m }));
  const before = JSON.stringify(input);
  canonicalModeOrder(input);
  assert.equal(JSON.stringify(input), before);
});
test("31 stripWidgetMarkers removes open, close and mid-line markers", () => {
  assert.equal(stripWidgetMarkers("[[RESCUE]]"), "");
  assert.equal(stripWidgetMarkers("[[/RESCUE]]"), "");
  assert.equal(stripWidgetMarkers("[[RESCUE]] TITLE: Cut the loop"), "TITLE: Cut the loop");
  assert.equal(stripWidgetMarkers("one Wait at a time. [[/RESCUE]]"), "one Wait at a time.");
});
test("32 assertConsumerClean passes clean master HTML", () => {
  const html = "<div class='eb-h2'>The One-Number Budget Chart</div><p>One number, one household.</p>";
  assert.deepEqual(assertConsumerClean(html), []);
});
test("33 assertConsumerClean catches markers, raw markdown, raw checkboxes and foreign content", () => {
  assert.ok(assertConsumerClean("<p>[[/RESCUE]]</p>").includes("WIDGET_MARKER_LEAKED"));
  assert.ok(assertConsumerClean("<p>## The rule of three</p>").includes("RAW_MARKDOWN_HEADING"));
  assert.ok(assertConsumerClean("<li>[ ] Buy nappies</li>").includes("RAW_CHECKBOX"));
  const r = assertConsumerClean("<p>Every Night, Just Me</p>", { forbidden: ["Every Night, Just Me"] });
  assert.ok(r.some((e) => e.startsWith("FOREIGN_CONTENT")));
});

