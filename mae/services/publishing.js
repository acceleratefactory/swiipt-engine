// MAE · Publishing boundary (S11 §11.15, S9 §9.26). Publishing consumes approved governed records,
// records usage/state, and NEVER silently rewrites copy, claims, proof or CTA meaning.
import { fail, CODES } from "../lib/errors.js";

export const PublishingService = {
  /** Publish a governed usage. A platform-edit difference is recorded, never applied. */
  publish(usage_id, { governance, reference, final_text = null, at = new Date().toISOString() }) {
    const usage = governance.getUsage(usage_id);
    if (!usage) fail(CODES.REFERENCE_UNRESOLVED, `usage not found: ${usage_id}`);
    const asset = governance.getAsset(usage.asset_id);
    if (!asset) fail(CODES.REFERENCE_UNRESOLVED, `asset not found: ${usage.asset_id}`);
    if (!["APPROVED", "SCHEDULED"].includes(asset.status)) fail(CODES.SCOPE_VIOLATION, "only an approved/scheduled asset may be published", { status: asset.status });
    return governance.recordPublication(usage_id, { published_reference: reference, published_at: at, final_text });
  },

  /** Convenience: publish all scheduled usages of a sequence. */
  publishSequence(sequence_id, { governance, referenceFor }) {
    const usages = governance.listUsage().filter((u) => u.sequence_id === sequence_id && u.status === "SCHEDULED");
    const out = [];
    for (const u of usages) out.push(this.publish(u.id, { governance, reference: typeof referenceFor === "function" ? referenceFor(u) : `${sequence_id}:${u.asset_id}` }));
    return out;
  },
};
