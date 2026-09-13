// MAE media · ProductionJob pipeline (Media-01). Routes a governed spec to a worker and produces
// real artifacts — or an explicit blocked/pending state. Never reports false completion.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { save, MAE_DIR } from "../lib/store.js";
import { validate } from "../lib/schema.js";
import { makeId, existingIds } from "../lib/ids.js";
import { transition } from "../lib/transition.js";
import { fail, CODES } from "../lib/errors.js";
import { Router } from "./router.js";
import { PROVIDER_STATE } from "./providers.js";
import { renderSvg, WORK_DIR } from "./layout.js";

const JOB_DIR = join(MAE_DIR, "data", "media-jobs");
const ART_DIR = join(MAE_DIR, "data", "media-artifacts");
const BLOCKED_MODES = new Set(["GENERATED_SCENE", "PRODUCT_MOCKUP", "VIDEO_RENDER", "AUDIO_VOICEOVER", "PDF_RENDER"]);

function writeFile(dir, name, content) {
  mkdirSync(dir, { recursive: true });
  const p = join(dir, name);
  writeFileSync(p, content);
  return { path: p, checksum: createHash("sha256").update(content).digest("hex") };
}

export const MediaPipeline = {
  nextJobId(scope, existing = existingIds(JOB_DIR)) { return makeId("productionJob", scope, existing); },
  nextArtifactId(scope, existing = existingIds(ART_DIR)) { return makeId("artifact", scope, existing); },

  createJob(input) {
    const job = {
      id: input.id || this.nextJobId((input.asset_id || "AST").replace(/^AST-/, "").split("-")[0] || "GEN"),
      class: "production_job",
      asset_id: input.asset_id,
      brief_id: input.brief_id,
      product_id: input.product_id ?? null,
      angle_id: input.angle_id ?? null,
      asset_family_id: input.asset_family_id ?? null,
      asset_type: input.asset_type,
      platform: input.platform,
      production_mode: input.production_mode,
      required_outputs: input.required_outputs,
      source_versions: input.source_versions || {},
      provider_policy: input.provider_policy || {},
      quality_profile: input.quality_profile ?? null,
      safety_profile: input.safety_profile ?? null,
      render_spec: input.render_spec ?? null,
      ...(input.visual_grounding_id ? { visual_grounding_id: input.visual_grounding_id } : {}),
      ...(input.visual_asset_spec_id ? { visual_asset_spec_id: input.visual_asset_spec_id } : {}),
      ...(input.prompt_package ? { prompt_package: input.prompt_package } : {}),
      status: "QUEUED",
      blocked_reason: null,
      created_at: new Date().toISOString(),
      updated_at: null,
    };
    validate("production-job.schema.json", job, job.id);
    return job;
  },

  /** Run a job: real file when the provider supports it, else an explicit pending/blocked state. */
  run(job, ctx = {}) {
    const route = Router.route(job.production_mode);
    const productSlug = ctx.product_slug || (job.product_id || "product").toLowerCase();
    const outDir = join(WORK_DIR, productSlug, job.asset_id);
    let j = transition("production", job, "PREPARING");
    j = transition("production", j, "GENERATING");
    const artifacts = [];

    if (!route.available) {
      const blocked = BLOCKED_MODES.has(job.production_mode);
      j = { ...j, status: blocked ? "PRODUCTION_BLOCKED" : "RENDER_PENDING_EXTERNAL_PROVIDER",
        blocked_reason: route.reason, provider: route.provider ? route.provider.name : null };
      if (job.production_mode === "VIDEO_PACKAGE" || job.production_mode === "VIDEO_RENDER") {
        artifacts.push(...this._videoPackage(j, ctx, outDir));
      }
      if (job.production_mode === "AUDIO_VOICEOVER") artifacts.push(...this._voiceoverText(j, ctx, outDir));
      save("media-jobs", j, { scope: ctx.scope || "production" });
      return { job: j, artifacts, route };
    }

    // Layout-built modes → real SVG artifact(s).
    if (["STATIC_GRAPHIC", "CAROUSEL", "PRODUCT_COVER", "WHATSAPP_STATUS", "LANDING_PAGE_MEDIA", "TEXT_DOCUMENT"].includes(job.production_mode)) {
      const spec = job.render_spec || { canvas: job.platform === "whatsapp_status" ? "story" : "instagram_feed", headline: ctx.headline || job.asset_type, body_copy: ctx.body || "", cta: ctx.cta || "" };
      const svg = renderSvg(spec, { dir: outDir, filename: `${job.asset_id}.svg` });
      artifacts.push(this._artifact(j, "FINAL", svg.mime_type, svg.storage_uri, svg.checksum, { width: svg.width, height: svg.height }, route.provider.name));
    } else if (job.production_mode === "VIDEO_PACKAGE") {
      artifacts.push(...this._videoPackage(j, ctx, outDir));
    } else {
      fail(CODES.UNSUPPORTED_MODALITY, `no producer for mode ${job.production_mode}`, { mode: job.production_mode });
    }

    for (const a of artifacts) save("media-artifacts", a, { scope: ctx.scope || "production" });
    // A complete video PACKAGE is real text output, but the final MP4 still requires a video provider.
    if (job.production_mode === "VIDEO_PACKAGE") {
      const vid = Router.route("VIDEO_RENDER");
      if (!vid.available) {
        j = { ...j, status: "RENDER_PENDING_EXTERNAL_PROVIDER", blocked_reason: "video provider unavailable; package produced, final MP4 pending", updated_at: new Date().toISOString() };
        save("media-jobs", j, { scope: ctx.scope || "production" });
        return { job: j, artifacts, route };
      }
    }
    j = transition("production", j, "RENDERED");
    j = transition("production", j, "MEDIA_QA_PENDING");
    save("media-jobs", j, { scope: ctx.scope || "production" });
    return { job: j, artifacts, route };
  },

  _artifact(job, role, mime, uri, checksum, dims, provider, status = "RENDERED") {
    const a = {
      id: this.nextArtifactId((job.asset_id || "AST").replace(/^AST-/, "").split("-")[0] || "GEN"),
      class: "media_artifact", production_job_id: job.id, asset_id: job.asset_id, artifact_role: role,
      mime_type: mime, storage_uri: uri, checksum, width: dims.width ?? null, height: dims.height ?? null,
      duration: dims.duration ?? null, file_size: null, provider, model: null, provider_job_id: null,
      source_artifact_ids: [], version: 1, status, created_at: new Date().toISOString(),
    };
    validate("media-artifact.schema.json", a, a.id);
    return a;
  },

  /** Complete video production package (produced even without a video provider). */
  _videoPackage(job, ctx, outDir) {
    const script = ctx.script || `# Video script (${job.asset_type})\n\nHook: ${ctx.headline || ""}\nScene: ${ctx.body || ""}\nMechanism: ${ctx.mechanism || ""}\nCTA: ${ctx.cta || ""}\n`;
    const files = {
      "script.md": script,
      "voiceover.txt": ctx.voiceover || ctx.body || "",
      "shot-list.md": (ctx.shots || []).map((s, i) => `${i + 1}. ${s}`).join("\n") || "1. Hook shot\n2. Problem shot\n3. Mechanism shot\n4. CTA shot",
      "on-screen-text.md": ctx.on_screen_text || "",
      "captions.srt": ctx.captions || "",
      "music-guidance.md": ctx.music || "No licensed music required.",
      "render-manifest.json": JSON.stringify({ render_status: "PENDING_EXTERNAL_PROVIDER", final_video: null, asset_id: job.asset_id }, null, 2) + "\n",
    };
    const out = [];
    for (const [name, content] of Object.entries(files)) {
      const w = writeFile(outDir, name, content);
      out.push(this._artifact(job, name.replace(/\.[a-z]+$/, "").toUpperCase(), "text/plain", w.path, w.checksum, {}, "internal-layout", "RENDERED"));
    }
    return out;
  },

  _voiceoverText(job, ctx, outDir) {
    const w = writeFile(outDir, "voiceover.txt", ctx.voiceover || "");
    return [this._artifact(job, "VOICEOVER_TEXT", "text/plain", w.path, w.checksum, {}, "internal-layout", "RENDERED")];
  },

  saveJob(job) { return save("media-jobs", job); },
};
