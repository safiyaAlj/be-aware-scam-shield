// Features of a web address's hostname for the local phishing-address model.
// Shared by scripts/train-url-model.mjs and the live check so both agree.
// Only the hostname is used (see scripts/prepare-url-data.mjs for why).

export const HASH_BITS = 18; // 262,144 buckets
const MASK = (1 << HASH_BITS) - 1;

/** Lower-case hostname without "www.", port or trailing dot; null if there isn't one. */
export function hostOf(urlOrHost) {
  let s = String(urlOrHost || "").trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = "http://" + s;
  let host;
  try { host = new URL(s).hostname; } catch { return null; }
  host = host.toLowerCase().replace(/\.$/, "").replace(/^www\d*\./, "");
  return host && host.includes(".") ? host : null;
}

const SECOND_LEVEL = new Set(["com", "co", "gov", "net", "org", "ac", "edu", "mil", "sch", "ne", "or", "go"]);

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) & MASK;
}

/** Named features (readable) for a hostname. */
export function hostFeatureNames(host) {
  const f = [];
  const labels = host.split(".");
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
  if (isIp) return ["ip"];
  let tld = labels[labels.length - 1];
  let core = labels.slice(0, -1);
  if (labels.length >= 3 && tld.length === 2 && SECOND_LEVEL.has(labels[labels.length - 2])) {
    tld = labels.slice(-2).join(".");
    core = labels.slice(0, -2);
  }
  f.push("tld:" + tld);
  f.push("labels:" + Math.min(core.length, 5));
  f.push("len:" + Math.min(Math.floor(host.length / 6), 10));
  const hy = (host.match(/-/g) || []).length;
  f.push("hyph:" + Math.min(hy, 4));
  const dg = (host.match(/\d/g) || []).length;
  f.push("digits:" + (dg === 0 ? 0 : dg < 3 ? 1 : dg < 6 ? 2 : 3));
  if (host.includes("xn--")) f.push("punycode");
  // The registrable part (just before the ending) and anything in front of it.
  const reg = core[core.length - 1] || "";
  f.push("reg:" + reg);
  if (core.length > 1) f.push("sub:" + core.slice(0, -1).join("."));
  f.push("parent:" + reg + "." + tld); // hosting platforms (weebly.com, vercel.app ...)
  for (const w of core.join("-").split(/[-_.0-9]+/).filter(x => x.length >= 3)) f.push("word:" + w);
  // Letter chunks of the whole host catch look-alikes and random-looking names.
  const s = "^" + host + "$";
  for (let n = 3; n <= 5; n++) for (let i = 0; i + n <= s.length; i++) f.push("g" + n + ":" + s.slice(i, i + n));
  return f;
}

/** Main (registrable) domain: "secure.etisalat.ae" -> "etisalat.ae", "news.bbc.co.uk" -> "bbc.co.uk". */
export function registrableOf(host) {
  const l = host.split(".");
  const two = l.length >= 3 && l[l.length - 1].length === 2 && SECOND_LEVEL.has(l[l.length - 2]);
  return l.slice(two ? -3 : -2).join(".");
}

/** Hashed feature indexes (deduplicated) for a hostname. */
export function hostFeatures(host) {
  return [...new Set(hostFeatureNames(host).map(fnv1a))];
}
