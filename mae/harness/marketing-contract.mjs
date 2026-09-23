// SWIIPT CANONICAL MARKETING OUTPUT CONTRACT — generalized.
//
// Extends the marketing family to include the two canonical product-derived outputs WITHOUT removing
// or redesigning the existing six-component Marketing Visual System (task §20). Marketing consumes the
// ONE canonical PRODUCT COVER (§21) — it never regenerates fake covers.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { componentLibrary } from "./design-authority.mjs";
import { COVER_ASSET_TYPE } from "./product-cover.mjs";
import { TRAILER_ASSET_TYPE } from "./product-trailer.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

/** The canonical marketing family: the six MVS components + the two product-derived outputs. */
export function marketingFamily() {
  const mvs = componentLibrary();                                     // the locked six (untouched)
  return {
    visual_components: mvs.map((c) => (typeof c === "string" ? c : c.name ?? c.component ?? c.id)),
    canonical_product_assets: [COVER_ASSET_TYPE, TRAILER_ASSET_TYPE],
    note: "six-component visual family preserved + PRODUCT_COVER + PRODUCT_TRAILER",
  };
}

/** Surfaces that must consume the ONE canonical cover (never a re-invented cover). */
export function coverReuseSurfaces() {
  return [
    "customer-product cover page", "single-product page", "catalogue/card", "product mockups",
    "checkout/cart where applicable", "membership/bundle surfaces", "marketing creatives",
    "OG/share", "trailer product reveal", "final campaign export",
  ];
}

/** Canonical-asset packages for a product, in the exporter's generic `_packages.json` shape (§22). */
export function canonicalPackages(productId, { root = ROOT } = {}) {
  const base = join(root, "data", "products", productId);
  const pk = [];
  if (existsSync(join(base, "cover"))) pk.push({ id: COVER_ASSET_TYPE, dest: `Product-Cover/${productId}`, source_dir: join(base, "cover") });
  if (existsSync(join(base, "trailer"))) pk.push({ id: TRAILER_ASSET_TYPE, dest: `Product-Trailer/${productId}`, source_dir: join(base, "trailer") });
  return { packages: pk };
}

export function readCover(productId, { root = ROOT } = {}) {
  const f = join(root, "data", "products", productId, "cover", "cover.json");
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
}
export function readTrailer(productId, { root = ROOT } = {}) {
  const f = join(root, "data", "products", productId, "trailer", "trailer.json");
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
}
