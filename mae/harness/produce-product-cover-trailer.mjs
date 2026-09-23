#!/usr/bin/env node
// Generic runner: produce the canonical PRODUCT COVER + PRODUCT TRAILER for any product.
//   node mae/harness/produce-product-cover-trailer.mjs <PRODUCT_ID> [--no-render]
// Product-agnostic; writes data/products/<ID>/cover/ and data/products/<ID>/trailer/.
import { produceProductCover } from "./product-cover.mjs";
import { produceProductTrailer } from "./product-trailer.mjs";

const id = process.argv[2];
if (!id) { console.error("usage: node produce-product-cover-trailer.mjs <PRODUCT_ID> [--no-render]"); process.exit(2); }
const render = !process.argv.includes("--no-render");

const cover = produceProductCover(id, { render });
const trailer = produceProductTrailer(id, { render });

console.log(JSON.stringify({
  product_id: id,
  cover: { asset_type: cover.asset_type, canonical_identity: cover.canonical_identity, canonical_status: cover.canonical_status, provider_status: cover.provider.status, variants: cover.variants.map((v) => `${v.name}:${v.render ?? "SPEC_ONLY"}`) },
  trailer: { asset_type: trailer.asset_type, angle_ref: trailer.angle_ref, validation_verdict: trailer.validation_verdict, scenes: trailer.scenes.length, on_screen_text: trailer.on_screen_text.length, poster_render: trailer.poster_render, video_status: trailer.video_status },
}, null, 2));
