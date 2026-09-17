#!/usr/bin/env node
// SWIIPT GLOBALITY PRIMITIVES (extracted from transformation-architect.mjs so both the
// architect and the applicability classifier can share them without an import cycle).
//
// Detection lexicon for geographic tokens in nucleus text. Used ONLY to detect
// (for provenance-visibility and fork comparison) — never to define globality, never to
// approve or refuse a record, and never as a privileged country list. Entries were chosen
// to avoid common-word collisions: "states"/"united" (verb "states that"), "pound"/"dollar"
// (weight, dollar-store), "real" (common adjective), "turkey/china/lima/manila/nice/oxford/
// bath/reading/jersey/cork" (food, place-name and object collisions) are DELIBERATELY absent.
export const GEOGRAPHY_TOKENS = Object.freeze([
  "nigeria", "nigerian", "lagos", "abuja", "ghana", "ghanaian", "accra", "kenya", "kenyan",
  "nairobi", "ethiopia", "ethiopian", "egypt", "egyptian", "cairo", "morocco", "moroccan",
  "rwanda", "rwandan", "uganda", "ugandan", "tanzania", "tanzanian", "senegal", "senegalese",
  "cameroon", "cameroonian", "africa", "african", "diaspora",
  "britain", "british", "england", "english", "london", "manchester", "birmingham", "leeds",
  "dublin", "ireland", "irish", "scotland", "scottish", "uk", "europe", "european",
  "france", "french", "paris", "germany", "german", "berlin", "spain", "spanish", "madrid",
  "italy", "italian", "rome", "milan", "netherlands", "dutch", "amsterdam", "belgium", "belgian",
  "sweden", "swedish", "stockholm", "norway", "norwegian", "oslo", "poland", "polish",
  "portugal", "portuguese", "greece", "greek",
  "america", "american", "usa", "canada", "canadian", "toronto", "vancouver", "ontario",
  "mexico", "mexican", "york", "texas", "california", "boston", "chicago", "atlanta", "sydney", "melbourne",
  "brazil", "brazilian", "peru", "peruvian", "colombia", "colombian", "argentina", "argentinian", "chile", "chilean",
  "india", "indian", "delhi", "mumbai", "japan", "japanese", "tokyo", "korea", "korean", "seoul",
  "vietnam", "vietnamese", "hanoi", "philippines", "filipino", "indonesia", "indonesian",
  "thailand", "thai", "singapore", "malaysia", "malaysian", "pakistan", "pakistani", "bangladesh",
  "australia", "australian", "emirates", "dubai", "qatar", "kuwait", "israel", "saudi", "arabia",
  "russia", "russian",
  "naira", "euro", "euros", "cedi", "cedis", "rupee", "rupees", "yen", "yuan", "won",
  "peso", "pesos", "franc", "francs", "shilling", "shillings", "rand", "dirham",
]);
const GLOBALITY_STOPWORDS = new Set("the,a,an,and,or,to,of,in,on,for,with,without,by,at,from,as,is,are,was,were,be,been,her,his,their,she,he,they,it,its,this,that,these,those,who,what,when,where,how,not,no,so,but,each,every,into,over,after,before,while,can,will,has,have,had,do,does,than,then,also,only,just,more,most,many,much,between,through,during,about,against,per,own,other,same,such,all,any,both".split(","));

const globalityTokens = (text, stripGeography) => new Set(
  String(text ?? "").toLowerCase().split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !GLOBALITY_STOPWORDS.has(w) && !(stripGeography && GEOGRAPHY_TOKENS.includes(w)))
);
/** Sorted geography tokens present in text (detection only — see GEOGRAPHY_TOKENS note). */
export function extractGeographyTokens(text) {
  return [...globalityTokens(text, false)].filter((w) => GEOGRAPHY_TOKENS.includes(w)).sort();
}
/** Text with geography tokens removed (comparison only — never stored back into a record). */
export function stripGeographyTokens(text) {
  const drop = new Set(GEOGRAPHY_TOKENS);
  return String(text ?? "").toLowerCase().split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !GLOBALITY_STOPWORDS.has(w) && !drop.has(w)).join(" ");
}
/** Jaccard similarity of geography-stripped nucleus token sets (0 when either side is empty). */
export function nucleusSimilarity(aText, bText) {
  const a = globalityTokens(aText, true), b = globalityTokens(bText, true);
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}
/** Country-clone threshold: calibrated far above genuine related-product similarity. */
export const COUNTRY_CLONE_THRESHOLD = 0.85;
/** True when two nucleus texts match modulo geography (same Transformation, different geography labels). */
export function sameNucleusModuloContext(aText, bText, threshold = COUNTRY_CLONE_THRESHOLD) {
  return nucleusSimilarity(aText, bText) >= threshold;
}
