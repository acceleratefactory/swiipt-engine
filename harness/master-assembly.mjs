// SWIIPT GENERIC MASTER PRODUCT ASSEMBLER — canonical, product-agnostic contract.
//
// EVERY product → ordered transformation assets → ONE master customer Transformation System,
// rendered under the CURRENT LOCKED CUSTOMER PRODUCT DESIGN AUTHORITY, bound to the canonical
// cover, with intentionally-standalone tools delivered alongside. No product-specific code.
//
// Fail-closed: a canonical product is NOT customer-product-complete unless the master resolves.
import { colourTokens, typeRoles, componentLibrary, markRules } from "../mae/harness/design-authority.mjs";
import { DELIVERY_CLASS, classifyDelivery, CUSTOMER_DOWNLOAD_CLASSES } from "./publisher-fidelity.mjs";

/** The current locked customer-product design authority (approved premium quality, generalized). */
export const DESIGN_AUTHORITY_ID = "SWIIPT-CUSTOMER-PRODUCT-DESIGN-AUTHORITY";
export const DESIGN_AUTHORITY_VERSION = "1.0";
export const MASTER_KIND = "master_product";
/** Sections the assembler is CAPABLE of producing — rendered only when product truth supports them. */
export const MASTER_SECTION_CAPABILITY = Object.freeze([
  "cover", "identity", "contents", "roadmap", "first_win", "assets", "implementation", "tracking", "rescue", "safety", "continuation",
]);
export const ASSET_ROLE = Object.freeze({ Read: "READ", Do: "DO", Decide: "DECIDE", Track: "TRACK", Communicate: "COMMUNICATE", Rescue: "RESCUE", Retrieve: "TRACK" });
export const MASTER_EBOOK_META = Object.freeze({ pdf: "_swt_ebook_pdf_url", flipbook: "_swt_ebook_flipbook_url", read: "_swt_ebook_read_url", lineage: "_swt_master_lineage" });

/** Resolve the CURRENT design authority as a HARD dependency (not merely similar colours). */
export function resolveDesignAuthority() {
  const tokens = colourTokens().map((t) => ({ token: t.token, hex: t.hex }));
  const roles = typeRoles();
  return {
    id: DESIGN_AUTHORITY_ID,
    version: DESIGN_AUTHORITY_VERSION,
    palette: tokens,
    typography: { families: ["DM Serif Display", "Inter", "Inter Black", "DM Serif Display Italic"], roles },
    components: componentLibrary(),
    mark_rules: markRules(),
  };
}
export function designAuthorityResolved(da) {
  return !!(da && da.id === DESIGN_AUTHORITY_ID && da.version && da.palette?.length >= 6 && da.typography?.families?.length >= 2 && (da.components || []).length >= 4);
}

/** Ordered asset list — position preserved; never re-ordered by the assembler. */
export function orderAssets(assets) {
  return (assets || []).map((a, i) => ({ ...a, position: a.position ?? i })).sort((a, b) => a.position - b.position);
}
export function assetRole(asset) { return ASSET_ROLE[asset?.format] ?? "DO"; }

/**
 * Build the master content tree from canonical records. Content-driven: sections absent from the
 * product truth are omitted cleanly (no decorative/placeholder pages).
 */
export function buildMasterTree({ product, transformation, assets, coverRef, firstWin }) {
  if (!product) throw new Error("MASTER_ASSEMBLY: product identity missing");
  const ordered = orderAssets(assets);
  const tree = {
    kind: MASTER_KIND,
    product_id: product.product_id ?? product.id,
    title: product.identity?.name ?? product.title,
    subtitle: product.identity?.subtitle ?? null,
    promise: product.identity?.one_line_promise ?? null,
    cover: { identity: coverRef ?? null, is_product_cover: true },
    identity: { situation: transformation?.situation ?? null, before: transformation?.before_state ?? null, after: transformation?.after_state ?? null, scope: transformation?.safety?.scope_boundary ?? null },
    contents: ordered.map((a, i) => ({ n: i + 1, title: a.title, role: assetRole(a), position: a.position })),
    roadmap: transformation?.mechanism?.core ?? null,
    first_win: firstWin ?? transformation?.first_win ?? null,
    assets: ordered.map((a, i) => ({ n: i + 1, title: a.title, role: assetRole(a), format: a.format, content: a.content ?? "" })),
    implementation: transformation?.implementation ?? null,
    tracking: transformation?.tsm ?? null,
    rescue: ordered.filter((a) => assetRole(a) === "RESCUE").map((a) => a.title),
    safety: transformation?.safety ?? null,
    continuation: transformation?.next_transformation ?? null,
  };
  return tree;
}
/** Sections that actually render (content-driven). */
export function masterSectionPlan(tree) {
  const plan = [];
  const has = (v) => (Array.isArray(v) ? v.length > 0 : !!v && String(v).trim() !== "");
  if (tree.cover?.identity) plan.push("cover");
  if (has(tree.identity?.situation) || has(tree.identity?.after)) plan.push("identity");
  if (tree.contents?.length) plan.push("contents");
  if (has(tree.roadmap)) plan.push("roadmap");
  if (has(tree.first_win)) plan.push("first_win");
  if (tree.assets?.length) plan.push("assets");
  if (has(tree.implementation)) plan.push("implementation");
  if (has(tree.tracking)) plan.push("tracking");
  if (tree.rescue?.length) plan.push("rescue");
  if (has(tree.safety)) plan.push("safety");
  if (has(tree.continuation)) plan.push("continuation");
  return plan;
}

/* ---------------------------------------------------------------- fail-closed */

export const MASTER_READY_ERRORS = Object.freeze({
  MISSING_MASTER: "MASTER_MISSING",
  MISSING_IDENTITY: "MASTER_IDENTITY_MISSING",
  MISSING_COVER: "COVER_MISSING",
  MISSING_DESIGN_AUTHORITY: "DESIGN_AUTHORITY_MISSING",
  MISSING_ASSETS: "REQUIRED_ASSET_MISSING",
  ASSEMBLY_FAILED: "MASTER_ASSEMBLY_FAILED",
  RENDER_FAILED: "MASTER_RENDER_FAILED",
  EMPTY_PDF: "MASTER_PDF_EMPTY",
  QA_FAILED: "MASTER_QA_FAILED",
  STANDALONE_SUBSTITUTED: "STANDALONE_SUBSTITUTED_FOR_MASTER",
});
/**
 * Factory invariant. Returns { ok, errors[] }. Any failure = FAIL CLOSED (never a generic fallback).
 */
export function assertMasterReady(rec) {
  const errors = [];
  const nonEmpty = (s) => typeof s === "string" && s.trim().length > 0;
  if (!rec?.master) errors.push(MASTER_READY_ERRORS.MISSING_MASTER);
  if (!nonEmpty(rec?.identity)) errors.push(MASTER_READY_ERRORS.MISSING_IDENTITY);
  if (!nonEmpty(rec?.coverRef)) errors.push(MASTER_READY_ERRORS.MISSING_COVER);
  if (!designAuthorityResolved(rec?.designAuthority)) errors.push(MASTER_READY_ERRORS.MISSING_DESIGN_AUTHORITY);
  if (!Array.isArray(rec?.assets) || rec.assets.length === 0 || rec.assets.some((a) => !nonEmpty(a?.content))) errors.push(MASTER_READY_ERRORS.MISSING_ASSETS);
  if (rec?.assembled === false) errors.push(MASTER_READY_ERRORS.ASSEMBLY_FAILED);
  if (rec?.renderOk === false) errors.push(MASTER_READY_ERRORS.RENDER_FAILED);
  if (rec?.pdfBytes != null && rec.pdfBytes <= 0) errors.push(MASTER_READY_ERRORS.EMPTY_PDF);
  if (!nonEmpty(rec?.pdfRef)) errors.push(MASTER_READY_ERRORS.EMPTY_PDF);
  if (rec?.structuralQa === false) errors.push(MASTER_READY_ERRORS.QA_FAILED);
  if (rec?.identity && rec?.assetTitles?.includes(rec.identity)) errors.push(MASTER_READY_ERRORS.STANDALONE_SUBSTITUTED);
  return { ok: errors.length === 0, errors };
}
/** Legacy generic / per-asset render may NEVER satisfy MASTER_PRODUCT acceptance. */
export function legacyCanSatisfyMaster() { return false; }

/* ---------------------------------------------------------------- delivery + lineage */

/** MASTER_PRODUCT is first-class and always a customer deliverable; standalone tools coexist. */
export function masterDeliverySet(master, standalone) {
  const out = [];
  if (master) out.push({ ...master, delivery_class: DELIVERY_CLASS.MASTER_PRODUCT });
  for (const s of standalone || []) out.push({ ...s, delivery_class: classifyDelivery(s.asset ?? {}, s) });
  return out.filter((d) => CUSTOMER_DOWNLOAD_CLASSES.includes(d.delivery_class));
}
/** Persisted master lineage — proves which authority/version produced the master. */
export function assemblyLineage({ productId, designAuthority, coverRef, tree, pdfRef }) {
  return {
    product_id: productId,
    master_kind: MASTER_KIND,
    design_authority_id: designAuthority?.id ?? null,
    design_authority_version: designAuthority?.version ?? null,
    canonical_cover: coverRef ?? null,
    sections: masterSectionPlan(tree ?? {}),
    assets: (tree?.assets ?? []).map((a) => `${a.n}. ${a.title} [${a.role}]`),
    pdf_ref: pdfRef ?? null,
    produced_at: null, // stamper supplies the time (kept deterministic here)
  };
}
/** A design-authority version change invalidates a previously rendered master. */
export function needsRerenderForDesignAuthority(lineage, currentVersion = DESIGN_AUTHORITY_VERSION) {
  return !lineage || lineage.design_authority_version !== currentVersion;
}

/* ------------------------------------------------- semantic composition (v1) */

/**
 * Canonical functional order — content is sequenced by what the customer must DO with it,
 * never by asset id or authoring order. Product-agnostic; unchanged for every product.
 */
export const CANONICAL_MODE_ORDER = Object.freeze([
  "READ", "DECIDE", "DO", "TRACK", "COMMUNICATE", "RESCUE", "RE_ENTER", "MAINTAIN", "REMEMBER",
]);

/**
 * Functional mode -> design-system component. This is the whole semantic layer:
 * a mode declares the FUNCTION, the component declares the GRAMMAR. No product names,
 * no product branching, no asset ids.
 */
export const MODE_COMPONENT = Object.freeze({
  READ: "editorial",
  DO: "worksheet",
  DECIDE: "decision-interface",
  TRACK: "tracker",
  COMMUNICATE: "script-card",
  RESCUE: "rescue-card",
  RE_ENTER: "worksheet",
  MAINTAIN: "tracker",
  REMEMBER: "reference",
  CALCULATE: "worksheet",
});

export function componentForMode(mode) {
  return MODE_COMPONENT[String(mode ?? "").toUpperCase()] ?? "editorial";
}

/** Stable canonical ordering of whichever modes are present (unknown modes keep authoring order, last). */
export function canonicalModeOrder(modules) {
  const rank = (m) => {
    const i = CANONICAL_MODE_ORDER.indexOf(String(m ?? "").toUpperCase());
    return i === -1 ? CANONICAL_MODE_ORDER.length : i;
  };
  return [...(modules ?? [])]
    .map((m, i) => ({ m, i }))
    .sort((a, b) => rank(a.m?.mode ?? a.m?.asset_type) - rank(b.m?.mode ?? b.m?.asset_type) || a.i - b.i)
    .map(({ m }) => m);
}

/** Widget authoring markers are structural, never consumer content. */
export function stripWidgetMarkers(text) {
  return String(text ?? "").replace(/\[\[\/?[A-Z_]+\]\]/g, "").trim();
}

/**
 * Consumer-clean contract for a rendered master: no widget markers, no raw markdown syntax,
 * no foreign-product leakage. Returns [] when clean, else a list of human-readable violations.
 */
export function assertConsumerClean(html, { forbidden = [] } = {}) {
  const s = String(html ?? "");
  const errors = [];
  if (/\[\[\/?[A-Z_]+\]\]/.test(s)) errors.push("WIDGET_MARKER_LEAKED");
  if (/^#{1,6}\s/m.test(s.replace(/<[^>]*>/g, ""))) errors.push("RAW_MARKDOWN_HEADING");
  if (/\[ \]/.test(s)) errors.push("RAW_CHECKBOX");
  for (const f of forbidden) {
    if (f && s.includes(f)) errors.push(`FOREIGN_CONTENT:${f}`);
  }
  return errors;
}
