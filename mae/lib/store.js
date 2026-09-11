// MAE lib · JSON record store. Records are the source of truth; the filesystem is the export surface.
// Production records live under mae/data/<collection>/. Synthetic fixtures live under
// mae/data/fixtures/<collection>/ and are only read in an explicit test/fixture scope.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const MAE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DATA_DIR = join(MAE_DIR, "data");
const FIXTURE_DIR = join(DATA_DIR, "fixtures");

export function collectionDir(collection, { scope = "production" } = {}) {
  return scope === "test" ? join(FIXTURE_DIR, collection) : join(DATA_DIR, collection);
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJson(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(obj, null, 2) + "\n");
  return path;
}

export function listFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
}

export function list(collection, opts = {}) {
  const dir = collectionDir(collection, opts);
  return listFiles(dir).map((f) => readJson(join(dir, f)));
}

export function findById(collection, id, opts = {}) {
  const p = join(collectionDir(collection, opts), `${id}.json`);
  return existsSync(p) ? readJson(p) : null;
}

export function save(collection, record, opts = {}) {
  if (!record || !record.id) throw new Error(`store.save: record needs an id (collection=${collection})`);
  return writeJson(join(collectionDir(collection, opts), `${record.id}.json`), record);
}

/** Load a collection across production + fixtures (dedup by id). Used by read-only services. */
export function all(collection, { includeFixtures = true } = {}) {
  const map = new Map();
  for (const r of list(collection, { scope: "production" })) map.set(r.id, r);
  if (includeFixtures) for (const r of list(collection, { scope: "test" })) if (!map.has(r.id)) map.set(r.id, r);
  return [...map.values()];
}
