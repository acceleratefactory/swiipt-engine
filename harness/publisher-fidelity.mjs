// SWIIPT PUBLISHER FIDELITY — canonical, generalized publisher contract.
//
// Reusable rules that make the live publisher a faithful MATERIALIZER of the canonical product:
//   • identity  — desired-state prose can never become a title; nothing is truncated into identity
//   • assets    — the manifest asset set is AUTHORITATIVE (reconcile, never append); idempotent
//   • placeholder prohibition — canonical publication fails closed rather than shipping placeholders
//   • delivery classification — customer deliverables vs internal render intermediates
//   • cover ordering — the canonical PRODUCT_COVER is resolved BEFORE customer/commerce composition
// Product-agnostic: no product id / asset id appears here.
import { createHash } from "node:crypto";

export const DELIVERY_CLASS = Object.freeze({
  MASTER_PRODUCT: "MASTER_PRODUCT",
  PRIMARY_PRODUCT: "PRIMARY_PRODUCT",
  PRINTABLE: "PRINTABLE",
  INTERACTIVE: "INTERACTIVE",
  READER: "READER",
  INTERNAL_RENDER: "INTERNAL_RENDER",
});
/** Only these classes may become customer-visible WooCommerce downloads. */
export const CUSTOMER_DOWNLOAD_CLASSES = Object.freeze([DELIVERY_CLASS.MASTER_PRODUCT, DELIVERY_CLASS.PRIMARY_PRODUCT, DELIVERY_CLASS.PRINTABLE]);

/** The legacy default-asset family that must never appear for a factory-managed product. */
export const DEFAULT_ASSET_FAMILY = Object.freeze(["Guide", "Action toolkit", "Decision aid", "Script pack"]);
export const PLACEHOLDER_RE = /(^|\s)Placeholder content for\b/i;

/* ---------------------------------------------------------------- identity */

/** Desired-state prose must never be a product/transformation title. */
export function desiredStateBecameTitle(title, desiredState) {
  if (!title) return true;
  const t = String(title).trim().toLowerCase();
  const d = String(desiredState ?? "").trim().toLowerCase();
  if (!d) return false;
  if (t === d) return true;
  // the historical defect: the desired-state sentence truncated to a fixed length
  if (d.startsWith(t) && t.length >= 40) return true;
  return false;
}
/** A truncated sentence fragment must never be persisted as identity. */
export function isTruncatedIdentity(title, source, maxLen = 80) {
  if (!title || !source) return false;
  const t = String(title).trim();
  return t.length >= maxLen - 1 && String(source).startsWith(t) && t !== String(source).trim();
}
/** Resolve a title from an explicit identity chain; never from transformation prose. */
export function resolveTitle(tr, product) {
  return (tr && (tr.name || tr.transformation_name || tr.title)) || product?.identity?.name || product?.identity?.title || null;
}

/* ---------------------------------------------------------------- placeholders */

export function isPlaceholder(content) {
  return PLACEHOLDER_RE.test(String(content ?? ""));
}
/** Canonical factory publication fails closed if authored content would not resolve. */
export function assertNoPlaceholder(assets) {
  const bad = (assets || []).filter((a) => isPlaceholder(a?.content) || !String(a?.content ?? "").trim());
  if (bad.length) {
    const e = new Error(`PUBLISH_BLOCKED: ${bad.length} asset(s) would publish placeholder/empty content: ${bad.map((a) => a?.title ?? "?").join(", ")}`);
    e.code = "PLACEHOLDER_BLOCK";
    throw e;
  }
  return true;
}
/** A factory-managed system must not carry the legacy default asset family unless declared. */
export function isDefaultFamilyAsset(asset) {
  const t = String(asset?.title ?? "");
  const c = String(asset?.content ?? "");
  if (isPlaceholder(c)) return true;
  return DEFAULT_ASSET_FAMILY.some((f) => new RegExp(`\\s[\\u2013\\u2014-]\\s${f}$`).test(t)) && !c.trim();
}

/* ---------------------------------------------------------------- asset reconciliation */

const fingerprint = (a) => createHash("sha1").update(`${a.title ?? ""}\u0000${a.format ?? ""}`).digest("hex");
/** Provenance: only assets the manifest owns (matching title+format) may be reconciled/updated. */
export function assetProvenanceRule() {
  return { owned: "manifest", removable: "publisher-generated", protect: "manual/historical (no manifest match)" };
}
/**
 * Reconcile the authoritative manifest asset set against the existing system assets.
 * Idempotent: same manifest twice yields the same plan and the same final set.
 */
export function reconcileAssetSet(manifestAssets, existingAssets) {
  const want = (manifestAssets || []).map((a, i) => ({ ...a, position: a.position ?? i }));
  const have = (existingAssets || []).map((a) => ({ ...a }));
  const create = [], update = [], remove = [], keep = [];
  const usedHave = new Set();
  for (const w of want) {
    const match = have.find((h) => !usedHave.has(h.id) && fingerprint(h) === fingerprint(w));
    if (match) { usedHave.add(match.id); (match.position === w.position && match.content === w.content) ? keep.push({ id: match.id, ...w }) : update.push({ id: match.id, ...w }); }
    else create.push(w);
  }
  for (const h of have) {
    if (usedHave.has(h.id)) continue;
    // unmatched existing asset: remove if pre-existing publisher/default; protect genuine manual/historical
    (isDefaultFamilyAsset(h) || h.source === "publisher" || h.provenance === "publisher") ? remove.push(h) : keep.push(h);
  }
  return { create, update, remove, keep, final: [...keep, ...update.map((u) => ({ id: u.id })), ...create.map((c) => ({ title: c.title, format: c.format }))] };
}

/* ---------------------------------------------------------------- delivery classification */

const FORMAT_TO_PRINTABLE = { read: true, do: true, decide: true, communicate: true, track: true, rescue: true };
/**
 * Classify an instance by CUSTOMER INTENT — never by file extension alone.
 * The pipeline may generate html/pdf/txt/svg/transcripts/flipbooks; only customer-intended
 * deliverables become WooCommerce downloads.
 */
export function classifyDelivery(asset, instance) {
  const kind = String(instance?.kind ?? "").toLowerCase();
  if (instance?.master || kind === "master" || kind === "master_product") return DELIVERY_CLASS.MASTER_PRODUCT;
  if (instance?.interactive) return DELIVERY_CLASS.INTERACTIVE;
  if (kind === "flipbook" || kind === "read" || kind === "magazine") return DELIVERY_CLASS.READER;
  if (kind === "pdf") return FORMAT_TO_PRINTABLE[String(asset?.format ?? "").toLowerCase()] ? DELIVERY_CLASS.PRINTABLE : DELIVERY_CLASS.INTERNAL_RENDER;
  if (kind === "image" || kind === "poster" || kind === "svg") return DELIVERY_CLASS.INTERNAL_RENDER;
  if (kind === "html" || kind === "audio_transcript" || kind === "txt" || kind === "source") return DELIVERY_CLASS.INTERNAL_RENDER;
  return DELIVERY_CLASS.INTERNAL_RENDER;
}
export function isCustomerDownload(cls) { return CUSTOMER_DOWNLOAD_CLASSES.includes(cls); }
/** The customer-visible delivery set: PRIMARY_PRODUCT + PRINTABLE only. */
export function customerDeliverySet(instances) {
  return (instances || [])
    .map((i) => ({ ...i, delivery_class: classifyDelivery(i.asset ?? {}, i) }))
    .filter((i) => isCustomerDownload(i.delivery_class));
}
/** Hard invariant: an INTERNAL_RENDER may never appear as a WooCommerce download. */
export function assertNoInternalLeak(downloads) {
  const leak = (downloads || []).filter((d) => d.delivery_class === DELIVERY_CLASS.INTERNAL_RENDER);
  if (leak.length) { const e = new Error(`INTERNAL_RENDER_LEAK: ${leak.length} internal render file(s) exposed as customer downloads`); e.code = "INTERNAL_LEAK"; throw e; }
  return true;
}

/* ---------------------------------------------------------------- cover ordering */

export const COVER_ORDER = Object.freeze([
  "product_truth", "product_production", "canonical_product_cover",
  "customer_product", "landing_page", "single_product_page", "marketing", "product_trailer", "organic", "final_export",
]);
/** The canonical cover must be resolved before any customer/commerce surface composes. */
export function assertCoverUpstream(coverRef, stage) {
  const i = COVER_ORDER.indexOf("canonical_product_cover");
  const s = COVER_ORDER.indexOf(stage);
  if (s > i && !coverRef) { const e = new Error(`COVER_MISSING: stage '${stage}' composed without a resolved canonical cover`); e.code = "COVER_MISSING"; throw e; }
  return true;
}
/** One canonical identity, variants derived — no surface invents its own cover. */
export function coverVariantsFor(coverId) {
  return { canonical: `${coverId}.portrait`, square: `${coverId}.square`, og: `${coverId}.og`, derived_from: coverId };
}

/* ---------------------------------------------------------------- currencies */

export const CANONICAL_CURRENCIES = Object.freeze(["USD", "NGN", "GHS", "GBP", "CAD", "EUR"]);
export function currenciesReachPayload(manifestPrices, productPrices) {
  const declared = Object.keys(manifestPrices || {});
  const emitted = Object.keys(productPrices || {});
  const missing = declared.filter((c) => !emitted.includes(c));
  return { ok: missing.length === 0, missing, declared, emitted };
}
