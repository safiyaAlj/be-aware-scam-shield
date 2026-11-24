// Free public lists of known phishing sites, downloaded to this server and checked locally.
// No link a person submits is ever sent to these services.
//
//   OpenPhish Community feed  ~300 live phishing URLs, updated every 12 h.
//                             Non-commercial use only: https://openphish.com/terms.html
//   Phishing.Database         ~400,000 active phishing domains. MIT licence.
//                             https://github.com/Phishing-Database/Phishing.Database
//
// Lists are refreshed every PHISH_LIST_REFRESH_HOURS (default 6) and cached in data/feeds/
// so the server still has them after a restart without internet. PHISH_LISTS=off disables them.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(here, "..", "data", "feeds");
const MAX_BYTES = 40 * 1024 * 1024;

export const LISTS = [
  { id: "openphish", name: "OpenPhish", kind: "url", url: "https://raw.githubusercontent.com/openphish/public_feed/main/feed.txt" },
  { id: "phishing-database", name: "Phishing.Database", kind: "domain", url: "https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-domains-ACTIVE.txt" }
];

// Sites where many unrelated people publish pages under the same hostname. A listed page on
// one of these must not mark every other page there as phishing, so only exact addresses count.
const SHARED_HOSTS = new Set([
  "docs.google.com", "sites.google.com", "drive.google.com", "forms.gle", "storage.googleapis.com", "firebasestorage.googleapis.com",
  "dropbox.com", "dl.dropboxusercontent.com", "onedrive.live.com", "1drv.ms", "sharepoint.com", "forms.office.com",
  "github.com", "raw.githubusercontent.com", "gitlab.com", "bitbucket.org", "t.me", "telegra.ph", "wa.me", "linktr.ee",
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "cutt.ly", "rb.gy", "is.gd", "ow.ly", "s.id"
]);

const state = { urls: new Set(), domains: new Set(), loadedAt: {}, sizes: {}, errors: {} };

/** "example.com/path?x" without scheme, "www." or trailing slash, for comparing addresses. */
export function normalizeUrl(u) {
  let s = String(u || "").trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = "http://" + s;
  try {
    const x = new URL(s);
    const host = x.hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
    return (host + x.pathname.replace(/\/+$/, "") + x.search).toLowerCase();
  } catch { return null; }
}

function ingest(list, text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith("#"));
  const target = list.kind === "url" ? new Set(lines.map(normalizeUrl).filter(Boolean)) : new Set(lines.map(l => l.toLowerCase().replace(/^www\./, "")));
  if (list.kind === "url") state.urls = target; else state.domains = target;
  state.sizes[list.id] = target.size;
}

async function refresh(list) {
  const file = path.join(CACHE_DIR, list.id + ".txt");
  try {
    const res = await fetch(list.url, { redirect: "follow", signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    if (text.length > MAX_BYTES || text.trimStart().startsWith("<")) throw new Error("unexpected content");
    ingest(list, text);
    state.loadedAt[list.id] = new Date().toISOString();
    delete state.errors[list.id];
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(file, text);
  } catch (err) {
    state.errors[list.id] = err.message;
    // Fall back to the last copy on disk if this process has nothing yet.
    if (!state.loadedAt[list.id] && fs.existsSync(file)) {
      ingest(list, fs.readFileSync(file, "utf8"));
      state.loadedAt[list.id] = fs.statSync(file).mtime.toISOString();
    }
  }
}

let started = false;
/** Loads the lists now and refreshes them in the background. Safe to call more than once. */
export function startPhishLists() {
  if (started || (process.env.PHISH_LISTS || "").toLowerCase() === "off") return;
  started = true;
  const hours = Number(process.env.PHISH_LIST_REFRESH_HOURS || 6);
  let retry = null;
  const run = () => Promise.all(LISTS.map(refresh)).then(() => {
    const summary = LISTS.map(l => `${l.name} ${state.sizes[l.id] ?? 0}${state.errors[l.id] ? ` (update failed: ${state.errors[l.id]})` : ""}`).join(", ");
    console.log("phishing lists:", summary);
    // A list that failed and has nothing loaded yet is retried in 10 minutes, not at the next refresh.
    const missing = LISTS.some(l => state.errors[l.id] && !state.sizes[l.id]);
    if (missing && !retry) retry = setTimeout(() => { retry = null; run(); }, 10 * 60_000).unref();
  });
  run();
  setInterval(run, hours * 3600_000).unref();
}

/**
 * Is this address on a phishing list?
 * @param {string} href   full address
 * @param {string} host   its hostname
 * @param {boolean} trustedDomain  true for official brand domains: then only exact addresses count
 * @returns {{ listed:boolean, source?:string, match?:"address"|"domain" }}
 */
export function lookupPhishLists(href, host, trustedDomain = false) {
  const n = normalizeUrl(href);
  if (n && (state.urls.has(n) || state.urls.has(n.split("?")[0]))) return { listed: true, source: "OpenPhish", match: "address" };
  const h = String(host || "").toLowerCase().replace(/^www\./, "");
  if (!h || trustedDomain || SHARED_HOSTS.has(h)) return { listed: false };
  // The host itself or any parent domain (evil.example.top also matches example.top).
  const parts = h.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    const d = parts.slice(i).join(".");
    if (SHARED_HOSTS.has(d)) break;
    if (state.domains.has(d)) return { listed: true, source: "Phishing.Database", match: "domain" };
  }
  return { listed: false };
}

export function phishListStatus() {
  return { available: state.urls.size + state.domains.size > 0, lists: LISTS.map(l => ({ name: l.name, entries: state.sizes[l.id] ?? 0, updated: state.loadedAt[l.id] ?? null })) };
}

/** One domain currently on Phishing.Database (for the demo page), or null. */
export function sampleListedDomain() {
  for (const d of state.domains) if (/^[a-z0-9-]+.[a-z]{2,}$/.test(d) && d.length < 30) return d;
  return null;
}

/** Everything currently on the lists, for the brand watch: { domains: Set<string>, urls: Set<string> (normalized) }. */
export function listedEntries() {
  return { domains: state.domains, urls: state.urls };
}

/** For tests: load list contents directly. */
export function _loadForTest({ urls = [], domains = [] }) {
  ingest(LISTS[0], urls.join("\n"));
  ingest(LISTS[1], domains.join("\n"));
}
