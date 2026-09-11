// MAE media · Export subsystem (Media-05, package-03 §4). Human-readable Master Pack +
// machine-readable Asset Manifest + an approved-only export ZIP. The governed records are the
// source of truth; the file tree is the export surface.
import { mkdirSync, writeFileSync, existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { MAE_DIR } from "../lib/store.js";
import { validate } from "../lib/schema.js";
import { fail, CODES } from "../lib/errors.js";
import { createZip } from "./zip.js";

const EXPORT_ROOT = join(MAE_DIR, "storage", "exports");

const APPROVED_STATUSES = ["APPROVED", "SCHEDULED", "PUBLISHED"];
const BANNED_STATUSES = ["REJECTED", "RETIRED", "RE_VERIFICATION_REQUIRED"];

function slug(s) { return String(s || "product").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product"; }
function ext(mime) { return { "image/svg+xml": "svg", "image/png": "png", "image/jpeg": "jpg", "application/pdf": "pdf", "text/plain": "txt", "text/markdown": "md", "application/json": "json" }[mime] || "bin"; }
function csvCell(v) { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }

export const ManifestService = {
  /** Build the AssetManifest from governed records (approved assets only). */
  build({ product_id, assets, families = [], artifacts = [] }) {
    const entries = [];
    for (const a of assets) {
      const fam = families.find((f) => f.id === a.family_id) || null;
      const arts = artifacts.filter((x) => x.asset_id === a.id);
      entries.push({
        asset_id: a.id,
        product_id: a.product_id,
        angle_id: a.angle_id,
        family_id: a.family_id || null,
        asset_type: a.asset_type,
        platform: a.platform,
        family_role: a.family_role,
        status: a.status,
        evergreen_eligible: !!a.evergreen_eligibility,
        files: arts.map((x) => ({ artifact_id: x.id, role: x.artifact_role, path: x.storage_uri, mime_type: x.mime_type, checksum: x.checksum })),
        qa_record_id: a.qa_record_id,
        asset_brief_id: a.asset_brief_id,
        source_truth_ids: [...(a.source_truth_refs?.product || []), ...(a.source_truth_refs?.customer || []), ...(a.source_truth_refs?.market || [])],
        usage_eligibility: fam?.sequence_eligibility || a.sequence_eligibility || [],
        restrictions: fam?.restrictions || [],
        version: a.asset_version,
      });
    }
    const manifest = { id: `MAN-${slug(product_id).toUpperCase().slice(0, 12)}-${Date.now().toString(36).toUpperCase()}`, class: "asset_manifest", product_id, generated_at: new Date().toISOString(), entries };
    validate("asset-manifest.schema.json", manifest, manifest.id);
    return manifest;
  },

  toCsv(manifest) {
    const head = ["asset_id", "product_id", "angle_id", "family_id", "asset_type", "platform", "family_role", "status", "evergreen_eligible", "qa_record_id", "asset_brief_id", "file_path", "mime_type", "checksum", "version"];
    const rows = [head.join(",")];
    for (const e of manifest.entries) {
      if (!e.files.length) { rows.push([e.asset_id, e.product_id, e.angle_id, e.family_id, e.asset_type, e.platform, e.family_role, e.status, e.evergreen_eligible, e.qa_record_id, e.asset_brief_id, "", "", "", e.version].map(csvCell).join(",")); continue; }
      for (const f of e.files) rows.push([e.asset_id, e.product_id, e.angle_id, e.family_id, e.asset_type, e.platform, e.family_role, e.status, e.evergreen_eligible, e.qa_record_id, e.asset_brief_id, f.path, f.mime_type, f.checksum, e.version].map(csvCell).join(","));
    }
    return rows.join("\n") + "\n";
  },

  write(manifest, dir) {
    mkdirSync(dir, { recursive: true });
    const json = join(dir, "asset-manifest.json");
    const csv = join(dir, "asset-manifest.csv");
    writeFileSync(json, JSON.stringify(manifest, null, 2) + "\n");
    writeFileSync(csv, this.toCsv(manifest));
    return { json, csv };
  },
};

export const MasterPackService = {
  /** Human-readable Master Marketing Pack (Media-05 §3). Generated from governed records. */
  build({ product, angle, validation, family, assets, qa = [], campaign = null }) {
    const L = [];
    L.push(`# Marketing Master Pack — ${product?.title || product?.product_id || family?.product_id || "Product"}`);
    L.push("");
    L.push("> Generated from governed records. This file is not an independent source of truth.");
    L.push("");
    L.push("## 1. Product Snapshot");
    L.push(`- Product ID: ${family?.product_id || product?.product_id || angle?.product_id || "—"}`);
    if (angle) {
      L.push(`- Customer: ${angle.tier1.customer}`);
      L.push(`- Transformation: ${angle.tier2.desired_change}`);
      L.push(`- Mechanism: ${angle.tier2.mechanism.text}`);
      L.push(`- Product Truth ref: ${angle.tier3.product_truth_ref}`);
    }
    L.push("");
    L.push("## 2. Approved Marketing Angles");
    if (angle) {
      L.push(`### ${angle.id} — ${angle.tier2.angle}`);
      L.push(`- Status: ${angle.status}`);
      L.push(`- Scene: ${angle.tier1.scene}`);
      L.push(`- Pain: ${angle.tier1.pain}`);
      L.push(`- Failed attempt: ${angle.tier1.failed_attempt}`);
      L.push(`- Emotional stake: ${angle.tier1.emotional_stake.text}`);
      L.push(`- Insight (Strategic Synthesis): ${angle.tier2.insight.text}`);
      L.push(`- Desired change: ${angle.tier2.desired_change}`);
      L.push(`- Counter-evidence: ${angle.tier3.counter_evidence_acknowledged}`);
      if (validation) L.push(`- Verdict: ${validation.verdict} — ${validation.scope_note || ""}`);
    }
    L.push("");
    L.push("## 3. Asset Family");
    if (family) {
      L.push(`- Family: ${family.id}`);
      L.push(`- Source Angle: ${family.source_angle_id}`);
      L.push(`- Anchor: ${family.anchor_asset_id}`);
      L.push(`- Locked Phrase Set: ${family.locked_phrase_set_id}`);
      L.push(`- Evergreen eligible: ${family.evergreen_eligible}`);
      L.push(`- Sequence eligibility: ${(family.sequence_eligibility || []).join(", ")}`);
      L.push(`- Restrictions: ${(family.restrictions || []).join("; ") || "none"}`);
    }
    L.push("");
    L.push("## 4. Assets");
    for (const a of assets) {
      L.push(`### ${a.id} — ${a.asset_type} (${a.platform})`);
      L.push(`- Role: ${a.family_role} · intensity: ${a.emotional_intensity} · CTA: ${a.cta_level}`);
      L.push(`- QA: ${a.qa_record_id} · Brief: ${a.asset_brief_id} · Version: v${a.asset_version}`);
      L.push(`- Evergreen: ${a.evergreen_eligibility}`);
      L.push("");
      L.push(a.content);
      L.push("");
    }
    L.push("## 5. QA Summary");
    for (const q of qa) L.push(`- ${q.asset_id}: ${q.overall} (${q.qa_status})${q.human_review?.required ? " · human reviewed" : ""}`);
    L.push("");
    L.push("## 6. Campaigns");
    L.push(campaign ? `- ${campaign.id} (${campaign.status}) — sequences: ${(campaign.sequence_ids || []).join(", ")}` : "- none in this export");
    L.push("");
    L.push("## 7. Asset Index");
    for (const a of assets) L.push(`| ${a.id} | ${a.asset_type} | ${a.platform} | ${a.family_role} | ${a.status} | v${a.asset_version} |`);
    L.push("");
    return L.join("\n");
  },
};

export const ExportService = {
  /** Export QA (Media-06 §9). Reject unapproved/retired/failed content. */
  qaCheck({ assets, manifest, files }) {
    const checks = [];
    const push = (name, pass, detail) => checks.push({ check: name, pass, detail });
    push("only_approved", assets.every((a) => APPROVED_STATUSES.includes(a.status)), "every asset approved");
    push("no_retired", assets.every((a) => !BANNED_STATUSES.includes(a.status)), "no retired/rejected/re-verify assets");
    push("manifest_generated", !!manifest && manifest.entries.length === assets.length, "manifest covers the inventory");
    push("paths_resolve", (files || []).every((f) => existsSync(f.src)), "every file path resolves on disk");
    push("no_secrets", (files || []).every((f) => !/api[_-]?key|secret|\.env/i.test(f.name)), "no secrets in the package");
    const pass = checks.every((c) => c.pass);
    return { pass, checks, failed: checks.filter((c) => !c.pass) };
  },

  /**
   * Export a product (or campaign) as an approved-only ZIP + on-disk package.
   * `artifacts` are MediaArtifact records with absolute `storage_uri`.
   */
  exportProduct({ product_id, assets, families = [], artifacts = [], qa = [], angle = null, validation = null, product = null, campaign = null, baseDir = null }) {
    if (!assets?.length) fail(CODES.MISSING_FIELD, "export requires at least one asset");
    const disallowed = assets.filter((a) => BANNED_STATUSES.includes(a.status) || !APPROVED_STATUSES.includes(a.status));
    if (disallowed.length) fail(CODES.SCOPE_VIOLATION, "export contains unapproved/retired/failed content", { ids: disallowed.map((a) => a.id) });

    const manifest = ManifestService.build({ product_id, assets, families, artifacts });
    const dir = join(baseDir || EXPORT_ROOT, slug(product_id));
    mkdirSync(join(dir, "governance", "qa"), { recursive: true });

    const files = [];
    for (const a of assets) {
      const arts = artifacts.filter((x) => x.asset_id === a.id);
      for (const art of arts) {
        if (!art.storage_uri || !existsSync(art.storage_uri)) fail(CODES.REAL_FILE_REQUIRED, "artifact file missing on disk", { artifact: art.id, uri: art.storage_uri });
        const rel = `${slug(a.platform)}/${a.id}__${art.artifact_role}__v${art.version}.${ext(art.mime_type)}`;
        files.push({ name: rel, src: art.storage_uri, data: readFileSync(art.storage_uri), mime_type: art.mime_type, checksum: art.checksum, size: statSync(art.storage_uri).size });
      }
      const q = qa.find((x) => x.id === a.qa_record_id);
      if (q) { const qpath = join(dir, "governance", "qa", `${q.id}.json`); writeFileSync(qpath, JSON.stringify(q, null, 2) + "\n"); files.push({ name: `governance/qa/${q.id}.json`, src: qpath, data: readFileSync(qpath), mime_type: "application/json" }); }
    }
    const masterPack = MasterPackService.build({ product, angle, validation, family: families[0], assets, qa, campaign });
    const { json: manifestJson } = ManifestService.write(manifest, dir);
    writeFileSync(join(dir, "01-marketing-master-pack.md"), masterPack);

    const manifestBuf = readFileSync(manifestJson);
    const csvBuf = Buffer.from(ManifestService.toCsv(manifest), "utf8");
    const packBuf = Buffer.from(masterPack, "utf8");

    const exportQA = this.qaCheck({ assets, manifest, files: [{ src: manifestJson, name: "asset-manifest.json" }, ...files] });
    if (!exportQA.pass) fail(CODES.VALIDATION_FAILED, "export QA failed", { failed: exportQA.failed });

    const zipEntries = [
      { name: "asset-manifest.json", data: manifestBuf },
      { name: "asset-manifest.csv", data: csvBuf },
      { name: "01-marketing-master-pack.md", data: packBuf },
      ...files.map((f) => ({ name: f.name, data: f.data })),
    ];
    const zip = createZip(zipEntries);
    const zipPath = join(dir, `${slug(product_id)}-export.zip`);
    writeFileSync(zipPath, zip);

    const pkgId = `EXP-${slug(product_id).toUpperCase().slice(0, 12)}-${Date.now().toString(36).toUpperCase()}`;
    const pkg = {
      id: pkgId,
      class: "export_package",
      product_id,
      campaign_id: campaign?.id || null,
      package_type: campaign ? "CAMPAIGN" : "PRODUCT",
      asset_ids: assets.map((a) => a.id),
      artifact_ids: artifacts.filter((x) => assets.some((a) => a.id === x.asset_id)).map((x) => x.id),
      manifest_id: manifest.id,
      master_pack_id: `${pkgId}-PACK`,
      export_dir: dir,
      files: zipEntries.map((e) => ({ name: e.name, bytes: e.data.length })),
      qa_summary: { pass: exportQA.pass, checks: exportQA.checks },
      status: "READY",
      created_at: new Date().toISOString(),
    };
    validate("export-package.schema.json", pkg, pkg.id);
    return { package: pkg, manifest, masterPack, zipPath, zipBytes: zip.length, dir, files };
  },
};
