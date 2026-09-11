// MAE lib · schema pool (ajv 2020-12). Reuses the factory's installed ajv.
import Ajv from "ajv/dist/2020.js";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fail, CODES } from "./errors.js";

const MAE = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SCHEMA_DIR = join(MAE, "schemas");

let _ajv = null;
export function getAjv() {
  if (_ajv) return _ajv;
  const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true });
  ajv.addFormat("date-time", /^\d{4}-\d{2}-\d{2}T/);
  ajv.addFormat("date", /^\d{4}-\d{2}-\d{2}$/);
  if (existsSync(SCHEMA_DIR)) {
    for (const f of readdirSync(SCHEMA_DIR).filter((x) => x.endsWith(".schema.json"))) {
      const s = JSON.parse(readFileSync(join(SCHEMA_DIR, f), "utf8"));
      s.$id = s.$id || `https://swiipt.com/mae/schemas/${f}`;
      try { ajv.addSchema(s); } catch { /* already added */ }
    }
  }
  _ajv = ajv;
  return ajv;
}

export function schemaId(file) {
  const s = JSON.parse(readFileSync(join(SCHEMA_DIR, file), "utf8"));
  return s.$id || `https://swiipt.com/mae/schemas/${file}`;
}

/** Validate obj against a schema file; throw SCHEMA_INVALID with details on failure. */
export function validate(file, obj, label = file) {
  const ajv = getAjv();
  const id = schemaId(file);
  const ok = ajv.validate(id, obj);
  if (!ok) {
    fail(CODES.SCHEMA_INVALID, `schema validation failed for ${label}`, {
      schema: file,
      errors: (ajv.errors || []).map((e) => ({ path: e.instancePath, message: e.message })),
    });
  }
  return obj;
}
