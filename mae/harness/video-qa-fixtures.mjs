// Deterministic synthetic video fixtures for Wave V-C tests. Local bytes only — no provider, no network.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { persistVideoArtifact, videoConformance } from "../media/video-artifact.js";
import { buildDay6Video } from "./video-fixtures.mjs";

const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0, 0); return b; };
const box = (type, ...parts) => { const body = Buffer.concat(parts); const h = Buffer.alloc(8); h.writeUInt32BE(8 + body.length, 0); h.write(type, 4, "ascii"); return Buffer.concat([h, body]); };

/** Minimal well-formed MP4 (ISO-BMFF) — enough for deterministic container/metadata QA. */
export function syntheticMp4({ width = 1080, height = 1920, durationSeconds = 6, timescale = 1000, audio = false, codec = "avc1" } = {}) {
  const mvhdP = Buffer.alloc(100); mvhdP.writeUInt32BE(timescale, 12); mvhdP.writeUInt32BE(Math.round(durationSeconds * timescale), 16);
  const tkhd = (w, h) => { const b = Buffer.alloc(84); b.writeUInt32BE(Math.round(w * 65536), 76); b.writeUInt32BE(Math.round(h * 65536), 80); return box("tkhd", b); };
  const hdlr = (t) => { const b = Buffer.alloc(12); b.write(t, 8, "ascii"); return box("hdlr", b); };
  const videoTrak = box("trak", tkhd(width, height), box("mdia", hdlr("vide"), box("minf", box("stbl", box("stsd", box(codec, Buffer.alloc(78)))))));
  const audioTrak = box("trak", tkhd(0, 0), box("mdia", hdlr("soun"), box("minf", box("stbl", box("stsd", box("mp4a", Buffer.alloc(28)))))));
  return Buffer.concat([
    box("ftyp", Buffer.from("isom"), u32(0x200), Buffer.from("isomiso2" + codec)),
    box("moov", box("mvhd", mvhdP), videoTrak, audio ? audioTrak : Buffer.alloc(0)),
  ]);
}

/** Persist a synthetic Day-6 artifact and compute conformance against the Day-6 asset spec. */
export function buildVideoQaCase({ mp4 = {}, spec = {}, audio = false, dir = null } = {}) {
  const day6 = buildDay6Video();
  const assetSpec = { ...day6.assetSpec, ...spec };
  const outDir = dir || mkdtempSync(join(tmpdir(), "swt-vqa-"));
  const r = persistVideoArtifact({
    bytes: syntheticMp4({ ...mp4, audio }), name: "day6.mp4", dir: outDir,
    artifactId: "ARTV-VQA-001", videoAssetId: assetSpec.video_asset_id, fixtureId: day6.fixture_id,
    provider: null, requestedModel: null, returnedModel: null,
  });
  return { day6, assetSpec, artifact: r.artifact, conformance: videoConformance({ assetSpec, artifact: r.artifact }) };
}
