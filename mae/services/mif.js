// MAE · MarketIntelligenceService (S2 §7). Ingest + query MIF; enforces the Absence-Claim Safeguard.
import { save, all } from "../lib/store.js";
import { validate } from "../lib/schema.js";
import { fail, CODES } from "../lib/errors.js";

export const MarketIntelligenceService = {
  ingest(record, { scope = "production" } = {}) {
    validate("market-intelligence-record.schema.json", record, record.id);
    if (record.category === "unclaimed_angle" && !record.scan_coverage_note) {
      fail(CODES.MISSING_FIELD, "unclaimed_angle requires a scan_coverage_note (Absence-Claim Safeguard)", { id: record.id });
    }
    if (scope === "test") { record.is_fixture = true; if (record.provenance !== "synthetic_fixture") record.provenance = "synthetic_fixture"; }
    if (record.is_fixture && scope === "production") fail(CODES.FIXTURE_NOT_PRODUCTION_SAFE, "fixture MIF cannot be saved to production scope", { id: record.id });
    save("market-intelligence", record, { scope });
    return record;
  },
  query(filter = {}, { includeFixtures = true } = {}) {
    return all("market-intelligence", { includeFixtures }).filter((r) =>
      Object.entries(filter).every(([k, v]) => (Array.isArray(v) ? v.includes(r[k]) : r[k] === v)));
  },
  get(id, { includeFixtures = true } = {}) {
    return all("market-intelligence", { includeFixtures }).find((r) => r.id === id) || null;
  },
  /** Whether a gap/absence claim may be stated as an absolute claim (must be hedged unless coverage is complete). */
  absenceClaimPermitsAbsolute(record) {
    return record.category === "unclaimed_angle" && record.evidence_status === "directly_stated" &&
      /complete|exhaustive/i.test(record.scan_coverage_note || "");
  },
};
