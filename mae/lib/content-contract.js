// MAE lib · Campaign content contract (integrity closure).
//
// Type-aware "is the content materially present?" check for a Marketing Campaign asset / generated
// record. This is the GENERATION GUARD half of the content-completeness invariant (S10.2); the QA
// half lives in services/qa.js and services/marketing-pack.js.
//
// Contract reuse (no new asset taxonomy): the asset types are the ones already carried by the
// campaign records (SOCIAL_STATIC / SOCIAL_CAROUSEL / SOCIAL_STORY_SEQUENCE / SOCIAL_REEL / GENERIC).
// A canonical asset_record.content is a single composed string; a campaign content object uses the
// fields below. Both are accepted.
//
// A field is "materially present" only when it is a non-empty, non-whitespace string.

export const COMPLETENESS_CODES = Object.freeze({
  CONTENT_MISSING: "CONTENT_MISSING",
  CONTENT_EMPTY: "CONTENT_EMPTY",
  CONTENT_REQUIRED_FIELD_EMPTY: "CONTENT_REQUIRED_FIELD_EMPTY",
  CONTENT_COLLECTION_TOO_SHORT: "CONTENT_COLLECTION_TOO_SHORT",
  CONTENT_ITEM_EMPTY: "CONTENT_ITEM_EMPTY",
});

const isObj = (v) => v != null && typeof v === "object" && !Array.isArray(v);
const filled = (v) => typeof v === "string" && v.trim().length > 0;

/** Minimum populated items for multi-panel types (matches ASSET_TYPE_LIMITS in social-design-spec.js). */
export const MULTI_PANEL_MIN = Object.freeze({ SOCIAL_CAROUSEL: 2, SOCIAL_STORY_SEQUENCE: 1 });

/**
 * Type-aware required-content description. Returns a list of requirement descriptors so the same
 * contract drives both the guard (fail) and diagnostics (what is missing).
 * @returns {{kind:"STRING",path:string}[]|{kind:"COLLECTION",path:string,min:number,itemPaths:string[]}[]}
 */
export function contentRequirements(assetType) {
  switch (assetType) {
    case "SOCIAL_REEL":
      return [{ kind: "STRING", path: "script.opening_hook" }, { kind: "STRING", path: "script.problem_narrative" }, { kind: "STRING", path: "script.desired_change" }];
    case "SOCIAL_CAROUSEL":
      return [{ kind: "COLLECTION", path: "slides", min: MULTI_PANEL_MIN.SOCIAL_CAROUSEL, itemPaths: ["text"] }];
    case "SOCIAL_STORY_SEQUENCE":
      return [{ kind: "COLLECTION", path: "sequence", min: MULTI_PANEL_MIN.SOCIAL_STORY_SEQUENCE, itemPaths: ["text"] }];
    case "SOCIAL_STATIC":
    case "GENERIC":
    default:
      return [{ kind: "STRING", path: "hook_text" }, { kind: "STRING", path: "problem_text" }, { kind: "STRING", path: "bold_line" }];
  }
}

function getPath(obj, path) {
  return path.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

/**
 * Validate content completeness for a campaign asset type.
 * @param {string} assetType
 * @param {string|object} content
 * @returns {{complete:boolean, failures:{code:string,path:string,detail:string}[]}}
 */
export function contentCompleteness(assetType, content) {
  const failures = [];
  if (content == null) return { complete: false, failures: [{ code: COMPLETENESS_CODES.CONTENT_MISSING, path: "", detail: "no content" }] };

  // Canonical asset_record.content is one composed string.
  if (typeof content === "string") {
    if (!filled(content)) failures.push({ code: COMPLETENESS_CODES.CONTENT_EMPTY, path: "", detail: "content is empty" });
    return { complete: failures.length === 0, failures };
  }
  if (!isObj(content)) return { complete: false, failures: [{ code: COMPLETENESS_CODES.CONTENT_MISSING, path: "", detail: `content must be a string or object (got ${Array.isArray(content) ? "array" : typeof content})` }] };

  for (const req of contentRequirements(assetType)) {
    if (req.kind === "STRING") {
      const v = getPath(content, req.path);
      if (!filled(v)) failures.push({ code: COMPLETENESS_CODES.CONTENT_REQUIRED_FIELD_EMPTY, path: req.path, detail: `required content field "${req.path}" is empty` });
      continue;
    }
    const coll = getPath(content, req.path);
    if (!Array.isArray(coll) || coll.length < req.min) {
      failures.push({ code: COMPLETENESS_CODES.CONTENT_COLLECTION_TOO_SHORT, path: req.path, detail: `required collection "${req.path}" needs >= ${req.min} populated item(s)` });
      continue;
    }
    coll.forEach((item, i) => {
      for (const ip of req.itemPaths) {
        if (!filled(getPath(item, ip))) failures.push({ code: COMPLETENESS_CODES.CONTENT_ITEM_EMPTY, path: `${req.path}[${i}].${ip}`, detail: `"${req.path}[${i}].${ip}" is empty` });
      }
    });
  }
  return { complete: failures.length === 0, failures };
}

/** Convenience boolean form. */
export function isContentComplete(assetType, content) { return contentCompleteness(assetType, content).complete; }

/** True for the production-success states an incomplete record must never hold. */
export const SUCCESS_STATES = Object.freeze(["GENERATED", "QA_PASSED", "APPROVED", "PASS", "READY"]);

/** The failure state an incomplete production record resolves to (closest existing vocabulary). */
export const INCOMPLETE_STATE = "REVISION_REQUIRED";
