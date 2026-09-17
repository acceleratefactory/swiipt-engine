#!/usr/bin/env node
// SWIIPT TRANSFORMATION VALIDATION GOVERNANCE (research-to-transformation pipeline V1, Phase J).
//
// Candidate -> validated is a GOVERNED transition, not a file edit. The transition:
//   - requires the canonical validation conditions (Gate-1 nucleus + transformation blocks present);
//   - requires an explicit deterministic authorization marker (a named authorizer — no identity
//     infrastructure exists in the repo, so a string marker consistent with the publishing
//     authorization pattern is used);
//   - records who/what authorized, when, the source/target state, the authority and a rationale;
//   - explicitly states what validation does NOT imply (clinical / evidence / safety / publication).
//
// It never approves its own output, never fabricates an authorizer and never implies clinical or
// publication approval. Provider-free and deterministic (time is injected).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const VALIDATION_AUTHORITY = "OWNER_BOUNDARY_VALIDATION";
export const VALIDATED_STATE = "validated";
export const NOT_IMPLYING = Object.freeze([
  "clinical approval", "scientific proof", "evidence approval", "safety review", "publication approval",
]);
export const TRANSFORMATION_BLOCKS = Object.freeze([
  "before_state", "after_state", "mechanism", "transformation_path", "failure_point_map", "first_win",
  "tsm", "maintenance", "safety",
]);
const GATE1_KEYS = Object.freeze(["person", "specific_situation", "trigger", "problem", "failed_attempt", "emotional_stake", "desired_transformation"]);

const isObj = (v) => v != null && typeof v === "object" && !Array.isArray(v);
const isStr = (v) => typeof v === "string" && v.trim().length > 0;

let AJV = null;
function ajv() {
  if (AJV) return AJV;
  const a = new Ajv({ allErrors: true, strict: false });
  a.addFormat("date-time", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  a.addFormat("date", /^\d{4}-\d{2}-\d{2}$/);
  for (const f of ["transformation.schema.json"]) {
    const sch = JSON.parse(readFileSync(join(ROOT, "schemas", f), "utf8"));
    sch.$id = sch.$id || `https://swiipt.com/factory/schemas/${f}`;
    a.addSchema(sch);
  }
  AJV = a;
  return a;
}
export function validateRecordShape(tr) {
  const ok = ajv().validate("https://swiipt.com/factory/schemas/transformation.schema.json", tr);
  return { valid: ok, errors: ok ? [] : ajv().errors.map((e) => `${e.instancePath || "/"} ${e.message}`) };
}

/** Which canonical validation conditions are unmet (deterministic; no invented authority). */
export function validationBlockers(tr) {
  const blockers = [];
  if (!isObj(tr)) return ["transformation record missing or not an object"];
  const sit = tr.situation ?? {};
  const blankSituation = GATE1_KEYS.filter((k) => !isStr(sit[k]));
  if (blankSituation.length) blockers.push(`situation.${blankSituation.join(", situation.")}`);
  for (const k of TRANSFORMATION_BLOCKS) {
    const v = tr[k];
    if (!v || (Array.isArray(v) ? v.length === 0 : isObj(v) ? Object.keys(v).length === 0 : !isStr(v))) blockers.push(k);
  }
  if (!Array.isArray(tr.after_state?.evidence_of_change) || tr.after_state.evidence_of_change.length === 0) blockers.push("after_state.evidence_of_change");
  if (!isStr(tr.safety?.scope_boundary)) blockers.push("safety.scope_boundary");
  return blockers;
}

/**
 * Governed candidate -> validated transition.
 * @returns {ok, code, record, blockers, validation}
 */
export function validateTransformationRecord(trId, { authorized_by = null, rationale = null, write = false, now = null, dir = join(ROOT, "data", "transformations") } = {}) {
  const path = join(dir, `${trId}.json`);
  if (!existsSync(path)) return { ok: false, code: "NOT_FOUND", record: null, blockers: [`no record at ${path}`] };
  const tr = JSON.parse(readFileSync(path, "utf8"));
  if (tr.status === VALIDATED_STATE || tr.status === "active") {
    return { ok: true, code: "ALREADY_VALIDATED", record: tr, blockers: [], validation: tr.validation ?? null, unchanged: true };
  }
  if (tr.status !== "candidate") return { ok: false, code: "NOT_CANDIDATE", record: tr, blockers: [`status "${tr.status}" is not candidate`] };

  const blockers = validationBlockers(tr);
  if (blockers.length) return { ok: false, code: "BLOCKED", record: tr, blockers };
  if (!isStr(authorized_by)) return { ok: false, code: "AUTHORIZATION_REQUIRED", record: tr, blockers: ["an explicit named authorizer is required"] };

  const validation = {
    status: VALIDATED_STATE,
    validated_by: authorized_by,
    validated_at: now || new Date().toISOString(),
    source_state: tr.status,
    target_state: VALIDATED_STATE,
    authority: VALIDATION_AUTHORITY,
    rationale: isStr(rationale) ? rationale : "owner boundary validation",
    not_implying: [...NOT_IMPLYING],
  };
  const next = { ...tr, status: VALIDATED_STATE, validation };
  const shape = validateRecordShape(next);
  if (!shape.valid) return { ok: false, code: "SCHEMA_INVALID", record: tr, blockers: shape.errors };
  if (!write) return { ok: true, code: "READY_TO_VALIDATE", record: tr, planned: next, blockers: [], validation };
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return { ok: true, code: "VALIDATED", record: next, blockers: [], validation, persisted: true };
}

// ------------------------------------------------------------------------------------------------
// CLI
// ------------------------------------------------------------------------------------------------
const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const get = (flag) => { const i = args.indexOf(flag); return i > -1 ? args[i + 1] : null; };
  const trId = args.find((a) => !a.startsWith("--") && !["--by", "--rationale"].includes(args[args.indexOf(a) - 1]));
  if (!trId) {
    console.error('usage: node harness/validate-transformation.mjs <TR_ID> --by "<authorizer>" [--rationale "..."] [--write]');
    process.exit(2);
  }
  const r = validateTransformationRecord(trId, {
    authorized_by: get("--by"),
    rationale: get("--rationale"),
    write: args.includes("--write"),
  });
  console.log(JSON.stringify({ status: r.code, ok: r.ok, blockers: r.blockers, validation: r.validation ?? null }, null, 2));
  process.exit(r.ok ? 0 : 1);
}
