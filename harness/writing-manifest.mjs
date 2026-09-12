#!/usr/bin/env node
// Writing / Generation Control Layer — GENERATION MANIFEST + VERSIONING (§34/§35).
//
// (Governing prompt decision #5.) Produces copy/generation-manifest.json (the detailed execution
// record: source versions, passes, provider/model where applicable, critic status, revisions,
// warnings, QA handoff) and stamps product.json -> generation.writing_control_version.
//
// Usage: node harness/writing-manifest.mjs <PRODUCT_ID> [--no-generate] [--strict]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./writing-control.mjs";
import { runPasses } from "./writing-passes.mjs";
import { runCritic, buildRevisionPlan } from "./writing-critic.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Honest generator identity: prefer what actually generated the copy (recorded by gen-content),
// never silently the requested external model.
function actualGeneratorFromProviderStatus(pdir) {
  const f = join(pdir, "copy", "provider-status.json");
  if (!existsSync(f)) return null;
  try { const s = JSON.parse(readFileSync(f, "utf8")); const a = s.actual_generators; return Array.isArray(a) && a.length ? a.join("+") : null; } catch { return null; }
}

export function buildGenerationManifest(productId, { passesResult, criticResult, generatorModel }) {
  const cfg = loadConfig();
  const pdir = join(root, "data", "products", productId);
  const p = JSON.parse(readFileSync(join(pdir, "product.json"), "utf8"));
  const gen = p.generation ?? {};
  const gates = p.qa?.gate_results ?? {};
  const warnings = passesResult ? passesResult.passes.flatMap((x) => x.findings).filter((f) => f.severity === "WARNING") : [];
  const revisions = criticResult ? buildRevisionPlan(criticResult) : [];
  return {
    manifest_version: "1.0",
    product_id: productId,
    transformation_id: p.identity?.transformation_id ?? null,
    product_schema_version: "1.0",
    writing_control_version: cfg.writing_control_version,
    research_version: null,
    architecture_version: "1.0",
    voice_spec_version: gen.profile || "global",
    generator_model: generatorModel || actualGeneratorFromProviderStatus(pdir) || (process.env.COPYWRITER_PROVIDER || "deterministic"),
    generation_timestamp: new Date().toISOString(),
    revision_number: 0,
    qa_status: gates.g7_product_qa ?? "pending",
    evidence_status: p.evidence?.review_status ?? "pending",
    safety_status: (p.safety?.risk_level ? `risk:${p.safety.risk_level}` : "pending") + (gates.g5_safety ? ` gate:${gates.g5_safety}` : ""),
    publish_status: p.status ?? "unknown",
    status: criticResult ? criticResult.status : null,
    passes: passesResult ? passesResult.passes.map((x) => ({ id: x.id, name: x.name, status: x.status, findings: x.findings.length })) : [],
    critic: criticResult ? { status: criticResult.critic_status, llm_status: criticResult.llm_status, llm_provider: criticResult.llm_provider, blockers: criticResult.blockers, warnings: criticResult.warnings } : null,
    warnings,
    revisions,
    handoff: passesResult ? passesResult.handoff : null,
  };
}

export async function writeGenerationArtifacts(productId, { generate = true, strict = false } = {}) {
  const cfg = loadConfig();
  const passesResult = runPasses(productId, { generate });
  const criticResult = await runCritic(productId, { strict });
  const manifest = buildGenerationManifest(productId, { passesResult, criticResult });

  const pdir = join(root, "data", "products", productId);
  writeFileSync(join(pdir, "copy", "generation-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  // Stamp product.json -> generation.writing_control_version (only when generation proceeded).
  const generated = passesResult.passes.length > 1;
  if (generated) {
    const pf = join(pdir, "product.json");
    const p = JSON.parse(readFileSync(pf, "utf8"));
    p.generation = p.generation ?? {};
    if (p.generation.writing_control_version !== cfg.writing_control_version) {
      p.generation.writing_control_version = cfg.writing_control_version;
      writeFileSync(pf, JSON.stringify(p, null, 2) + "\n");
    }
  }
  return { manifest, passesResult, criticResult, product_stamped: generated };
}

if (process.argv[1] && process.argv[1].endsWith("writing-manifest.mjs")) {
  const id = process.argv[2];
  if (!id) { console.error("usage: node harness/writing-manifest.mjs <PRODUCT_ID> [--no-generate] [--strict]"); process.exit(2); }
  writeGenerationArtifacts(id, { generate: !process.argv.includes("--no-generate"), strict: process.argv.includes("--strict") }).then((r) => {
    console.log(`generation-manifest.json -> data/products/${id}/copy/generation-manifest.json`);
    console.log(`status=${r.criticResult.status} llm=${r.criticResult.llm_status} passes=${r.passesResult.passes.length} warnings=${r.manifest.warnings.length} revisions=${r.manifest.revisions.length}`);
    process.exit(r.criticResult.blockers ? 1 : 0);
  });
}
