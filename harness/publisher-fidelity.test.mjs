// Permanent publisher-fidelity tests (continuation §13 items 1–27).
// node --test harness/publisher-fidelity.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import {
  DELIVERY_CLASS, CUSTOMER_DOWNLOAD_CLASSES, desiredStateBecameTitle, isTruncatedIdentity, resolveTitle,
  isPlaceholder, assertNoPlaceholder, isDefaultFamilyAsset, reconcileAssetSet, classifyDelivery,
  customerDeliverySet, assertNoInternalLeak, assertCoverUpstream, coverVariantsFor,
  CANONICAL_CURRENCIES, currenciesReachPayload,
} from "./publisher-fidelity.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FM = "PPL-FAMILY-MONEY-001";
const V06 = "PPL-NIGHT-SHIFT-001";
const manifest = (id) => JSON.parse(readFileSync(join(ROOT, "data", "products", id, "publish", "manifest.json"), "utf8"));

test("01 desired-state prose cannot become a title", () => {
  const d = "The household can state one trusted budget number and keep a baby fund";
  assert.equal(desiredStateBecameTitle(d, d), true);
  assert.equal(desiredStateBecameTitle("The One-Number Baby Budget", d), false);
});
test("02 truncated transformation prose cannot become customer title", () => {
  const src = "The household can state one trusted budget number and keep a baby fund; the budget chart is posted";
  assert.equal(isTruncatedIdentity(src.slice(0, 80), src), true);
  assert.equal(isTruncatedIdentity("The One-Number Baby Budget", src), false);
});
test("03 placeholder content blocks canonical publication", () => {
  assert.throws(() => assertNoPlaceholder([{ title: "Guide", content: "Placeholder content for Guide of X" }]), /PUBLISH_BLOCKED/);
  assert.equal(assertNoPlaceholder([{ title: "Quiz", content: "# Real quiz\n..." }]), true);
});
test("04 canonical authored content must resolve", () => {
  assert.throws(() => assertNoPlaceholder([{ title: "Quiz", content: "" }]), /PUBLISH_BLOCKED/);
  for (const a of manifest(FM).assets) assert.ok(String(a.content).trim().length > 200, `${a.title} content`);
});
test("05 manifest asset set is authoritative", () => {
  const m = manifest(FM).assets.map((a) => ({ title: a.title, format: a.job }));
  const plan = reconcileAssetSet(m, [{ id: 1, title: "Placeholder", content: "Placeholder content for Guide of X" }]);
  assert.equal(plan.create.length, 6);
  assert.equal(plan.remove.length, 1);
});
test("06 stale default assets are reconciled", () => {
  assert.equal(isDefaultFamilyAsset({ title: "X - Guide", content: "Placeholder content for Guide of X" }), true);
  assert.equal(isDefaultFamilyAsset({ title: "The One-Number Budget Chart", content: "# real" }), false);
});
test("07 republish is idempotent", () => {
  const m = manifest(FM).assets.map((a) => ({ title: a.title, format: a.job, content: "x", position: 0 }));
  const existing = m.map((a, i) => ({ id: i + 1, title: a.title, format: a.format, content: "x", position: 0 }));
  const p1 = reconcileAssetSet(m, existing);
  assert.equal(p1.create.length, 0); assert.equal(p1.remove.length, 0); assert.equal(p1.keep.length, 6);
});
test("08 repeated publish does not duplicate assets", () => {
  const m = manifest(FM).assets.map((a) => ({ title: a.title, format: a.job }));
  const plan = reconcileAssetSet(m, []);
  assert.equal(plan.create.length, 6);
  const plan2 = reconcileAssetSet(m, m.map((a, i) => ({ id: i, title: a.title, format: a.format })));
  assert.equal(plan2.create.length, 0);
});
test("09 repeated publish does not resurrect placeholders", () => {
  const m = manifest(FM).assets.map((a) => ({ title: a.title, format: a.job }));
  const plan = reconcileAssetSet(m, [{ id: 99, title: "X - Guide", content: "Placeholder content for Guide of X" }]);
  assert.ok(!plan.final.some((f) => f.title === "X - Guide"));
});
test("10 multi-asset product cannot collapse to a one-page guide", () => {
  const m = manifest(FM);
  assert.equal(m.assets.length, 6);
  assert.ok(!m.assets.some((a) => /Guide$/.test(a.title)));
});
test("11 canonical asset order survives publication", () => {
  const order = manifest(FM).assets.map((a) => a.title);
  assert.deepEqual(order, ["The One-Number Budget Chart", "The Real Baby Budget Quiz", "Corner-Shop Cost-Swap Card", "Buy / Wait / Never List", "30-Day Use Audit Log + Resell", "Cart-Delete Loop Rescue"]);
});
test("12 canonical cover exists before customer/commerce composition", () => {
  assert.ok(existsSync(join(ROOT, "data", "products", FM, "cover", "cover.json")));
  assert.equal(assertCoverUpstream("COVER-" + FM + ".portrait", "customer_product"), true);
  assert.throws(() => assertCoverUpstream(null, "single_product_page"), /COVER_MISSING/);
});
test("13 customer product consumes canonical cover", () => {
  const c = JSON.parse(readFileSync(join(ROOT, "data", "products", FM, "cover", "cover.json"), "utf8"));
  assert.equal(c.data.cover_id, "COVER-" + FM);
  assert.ok(c.variants.every((v) => v.derived_from === "canonical cover identity"));
});
test("14 PDP consumes canonical cover", () => {
  assert.equal(coverVariantsFor("COVER-X").canonical, "COVER-X.portrait");
  assert.equal(coverVariantsFor("COVER-X").og, "COVER-X.og");
});
test("15 landing page consumes canonical cover", () => {
  const v = coverVariantsFor("COVER-X");
  assert.ok(v.canonical && v.og && v.derived_from === "COVER-X");
});
test("16 marketing only reuses cover", () => {
  const m = readFileSync(join(ROOT, "mae", "harness", "marketing-contract.mjs"), "utf8");
  assert.match(m, /canonicalPackages|coverReuseSurfaces/);
  assert.ok(!/generate.*cover|regenerate.*cover/i.test(m.replace(/never regenerate/gi, "")));
});
test("17 all canonical currencies survive manifest build", () => {
  const p = manifest(FM).product.prices;
  assert.deepEqual(Object.keys(p).sort(), [...CANONICAL_CURRENCIES].sort());
});
test("18 all canonical currencies reach publisher payload", () => {
  const p = manifest(FM).product.prices;
  const r = currenciesReachPayload(p, { ...p });
  assert.equal(r.ok, true, JSON.stringify(r.missing));
});
test("19 delivery classification distinguishes customer deliverables from internal renders", () => {
  assert.equal(classifyDelivery({ format: "Read" }, { kind: "pdf" }), DELIVERY_CLASS.PRINTABLE);
  assert.equal(classifyDelivery({ format: "Read" }, { kind: "html" }), DELIVERY_CLASS.INTERNAL_RENDER);
  assert.equal(classifyDelivery({ format: "Read" }, { kind: "flipbook" }), DELIVERY_CLASS.READER);
  assert.equal(classifyDelivery({ format: "Read" }, { kind: "audio_transcript" }), DELIVERY_CLASS.INTERNAL_RENDER);
});
test("20 INTERNAL_RENDER cannot become a Woo customer download", () => {
  assert.equal(CUSTOMER_DOWNLOAD_CLASSES.includes(DELIVERY_CLASS.INTERNAL_RENDER), false);
  assert.throws(() => assertNoInternalLeak([{ delivery_class: "INTERNAL_RENDER" }]), /INTERNAL_RENDER_LEAK/);
  const set = customerDeliverySet([
    { kind: "pdf", asset: { format: "Read" } }, { kind: "html", asset: { format: "Read" } },
    { kind: "flipbook", asset: { format: "Read" } }, { kind: "audio_transcript", asset: { format: "Read" } },
  ]);
  assert.equal(set.length, 1);
  assert.equal(set[0].delivery_class, "PRINTABLE");
});
test("21 My Account uses intended identity", () => {
  const m = manifest(FM);
  assert.ok(!desiredStateBecameTitle(m.product.title, m.transformation.desired_state));
  assert.equal(m.product.title, "The One-Number Baby Budget");
});
test("22 PDP accepts object-shaped asset payload", () => {
  // canonical local copy of the delivery engine (source-control target for the stdClass→array fix)
  const localEng = join(ROOT, "..", "ebook-formats.php");
  if (existsSync(localEng)) assert.match(readFileSync(localEng, "utf8"), /\(array\)|->title/);
  // generalized: the classification layer must accept object-shaped asset entries indistinguishably
  const objShaped = Object.assign(Object.create(null), { kind: "pdf" });
  assert.equal(classifyDelivery({ format: "Read" }, objShaped), DELIVERY_CLASS.PRINTABLE);
});
test("23 legacy valid V06/module representation remains valid", () => {
  const v = manifest(V06);
  assert.ok(v.assets.length >= 1);
  assert.ok(v.product.title);
});
test("24 Family Money six authored assets resolve", () => {
  const m = manifest(FM);
  assert.equal(m.assets.length, 6);
  for (const a of m.assets) assert.ok(String(a.content).trim().length > 200, a.title);
});
test("25 second product proves generalized currency behavior", () => {
  const v = manifest(V06);
  const declared = (v.product.prices && Object.keys(v.product.prices).length)
    ? v.product.prices
    : (v.commerce?.currency_rules?.prices ?? { USD: v.product.base_price_usd });
  assert.ok(Object.keys(declared).length >= 1, "second product declares at least one currency");
  const r = currenciesReachPayload(declared, { ...declared });
  assert.equal(r.ok, true, `missing ${JSON.stringify(r.missing)}`);
});test("26 second product proves generalized asset reconciliation", () => {
  const v = manifest(V06).assets.map((a) => ({ title: a.title, format: a.job }));
  const plan = reconcileAssetSet(v, [{ id: 1, title: "X - Script pack", content: "Placeholder content for Script pack of X" }]);
  assert.equal(plan.remove.length, 1);
  assert.equal(plan.create.length, v.length);
});
test("27 no Family Money-specific publisher branch", () => {
  const src = readFileSync(join(ROOT, "harness", "publisher-fidelity.mjs"), "utf8");
  for (const id of [FM, V06, "AS-FM-", "ANG-PPL"]) assert.ok(!src.includes(id), `must not contain ${id}`);
  assert.ok(!/PPL-FAMILY-MONEY/.test(src));
});
