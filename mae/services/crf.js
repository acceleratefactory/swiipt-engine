// MAE · CustomerRealityService (S2 §4/§5). Ingest + query structured customer intelligence.
import { save, all } from "../lib/store.js";
import { validate } from "../lib/schema.js";
import { isValidState } from "../lib/evidence.js";
import { fail, CODES } from "../lib/errors.js";

export const CustomerRealityService = {
  /** Ingest a CRF record. Fixtures must declare is_fixture + provenance synthetic_fixture. */
  ingest(record, { scope = "production" } = {}) {
    validate("customer-reality-record.schema.json", record, record.id);
    if (scope === "test") { record.is_fixture = true; if (record.provenance !== "synthetic_fixture") record.provenance = "synthetic_fixture"; }
    if (record.is_fixture && scope === "production") fail(CODES.FIXTURE_NOT_PRODUCTION_SAFE, "fixture CRF cannot be saved to production scope", { id: record.id });
    if (!isValidState(record.evidence_status)) fail(CODES.EVIDENCE_REQUIRED, "invalid evidence_status", { id: record.id });
    save("customer-reality", record, { scope });
    return record;
  },
  /** Query by tag/filter (simple tagging only in V1). */
  query(filter = {}, { includeFixtures = true } = {}) {
    return all("customer-reality", { includeFixtures }).filter((r) =>
      Object.entries(filter).every(([k, v]) =>
        Array.isArray(v) ? (Array.isArray(r[k]) && v.some((x) => r[k].includes(x))) : r[k] === v));
  },
  byTag(tag, opts) { return this.query({ tags: [tag] }, opts); },
  get(id, { includeFixtures = true } = {}) {
    return all("customer-reality", { includeFixtures }).find((r) => r.id === id) || null;
  },
};
