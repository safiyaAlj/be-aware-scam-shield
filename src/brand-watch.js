// Brand watch: finds websites that impersonate UAE organisations, ideally before
// anyone receives the scam message, so the public can be warned and the sites taken down.
//
// Sources
//   1. Newly registered domains: WhoisDS publishes yesterday's new domain names every day
//      (free, ~70,000 a day: https://www.whoisds.com/newly-registered-domains). A look-alike
//      is often registered days before the scam messages go out, so this is the early warning.
//   2. The public phishing lists already downloaded by src/phish-lists.js (live, reported sites).
//
// A name is kept only if the site's own rules say it "pretends to be" or uses a
// "look-alike spelling of" a watched organisation (whole-word brand matching, official
// domains excluded). Each find is then scored with the full link check: rules, trained
// model, phishing lists and website age. Results are saved in data/watch/watch.json.
//
// Settings: WATCH=off disables it. WATCH_BRANDS (comma-separated brand keys) overrides
// the list below. WATCH_DAYS (default 14) is how many past days of new domains to scan.
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeUrl } from "../public/js/url-analyzer.js";
import { checkLink } from "./check-link.js";
import { listedEntries } from "./phish-lists.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(here, "..", "data", "watch");
const FILE = path.join(DIR, "watch.json");
// Results shipped with the code, so a fresh server (for example after a free host restarts it)
// starts with a full list and only scans days it hasn't seen. Refresh it with:
//   cp data/watch/watch.json data/watch-snapshot.json
const SNAPSHOT = path.join(here, "..", "data", "watch-snapshot.json");

// Organisations people in the UAE are most often tricked with. Keys are the brand keys in
// public/js/url-analyzer.js (BRANDS); the display names come from there.
const DEFAULT_KEYS = ["adpolice", "abudhabipolice", "dubaipolice", "moi", "uaepass", "tamm", "icp", "salik", "rta", "dewa", "sewa", "addc",
  "emiratesnbd", "adcb", "bankfab", "mashreq", "adib", "dib", "rakbank", "etisalat", "du", "emiratespost", "aramex", "noon", "careem", "talabat", "etihad", "carrefour", "sharerewards", "luluhypermarket", "lulu", "amazon"];
const MAX_CHECKS_PER_RUN = 300;

const state = { items: new Map(), runs: { nrd: null, lists: null }, nrdDays: [], running: false };
try {
  const saved = JSON.parse(fs.readFileSync(fs.existsSync(FILE) ? FILE : SNAPSHOT, "utf8"));
  for (const it of saved.items || []) state.items.set(it.domain, it);
  state.runs = { ...state.runs, ...(saved.runs || {}) };
  state.nrdDays = saved.nrdDays || [];
} catch { /* first run */ }

const keys = () => (process.env.WATCH_BRANDS ? process.env.WATCH_BRANDS.split(",").map(s => s.trim().toLowerCase()).filter(Boolean) : DEFAULT_KEYS);
const wait = ms => new Promise(r => setTimeout(r, ms));
// Scans cover hundreds of thousands of names. Pausing every few thousand lets website
// requests through, so the site stays fast on a small server while the watch runs.
const breathe = () => new Promise(r => setImmediate(r));

function save() {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify({ runs: state.runs, nrdDays: state.nrdDays, items: [...state.items.values()] }));
  } catch (err) { console.error("watch: could not save:", err.message); }
}

// Brands with very short names (du, DIB, RTA, MOI, ICP) also appear in unrelated sites
// ("7college.du.ac.bd"), so for them the name must also contain a UAE or payment word.
const CONTEXT = /(^|[.\-_0-9])(ae|uae|dubai|abudhabi|emirates|bank|card|cards|pay|payment|refund|login|verify|account|bill|recharge|topup|fine|fines|secure|update)([.\-_0-9]|$)/;
let shortNames = new Set();   // brands whose key is a short or common word (du, noon, tamm ...)
let keyOf = new Map();        // display name -> brand key

// The watch scans hundreds of thousands of names, so it is stricter than the checker:
// the brand must start or end a word of the name ("aramexltd", "ketihad", "salik.sbs"),
// not sit inside another word ("friendsalikegroup", "elguadalajaramexican"), and a
// look-alike spelling must be about as long as the brand ("careernestacademy" is not "careem").
function brandPlacedLikeImpersonation(host, key, lookalike) {
  const words = host.split(/[.\-_0-9]+/).filter(Boolean);
  if (lookalike) return words.some(w => Math.abs(w.length - key.length) <= 2);
  return words.some(w => w === key || w.startsWith(key) || w.endsWith(key));
}

/** Which watched brand (if any) does this hostname impersonate? */
export function impersonatedBrand(host) {
  const r = analyzeUrl("https://" + host + "/");
  if (!r || !r.valid || r.official) return null;
  for (const f of r.flags) {
    const m = /^(Pretends to be|Look-alike spelling of) (.+)$/.exec(f.title);
    if (!m) continue;
    const name = m[2], key = keyOf.get(name);
    if (key && !brandPlacedLikeImpersonation(host, key, m[1] !== "Pretends to be")) return null;
    if (shortNames.has(name) && !CONTEXT.test(host)) return null;
    return name;
  }
  return null;
}

function watchedBrandNames() {
  // Map brand keys to display names by testing a made-up name for each key.
  const names = new Set(), short = new Set(), map = new Map();
  shortNames = new Set(); keyOf = new Map();
  for (const k of keys()) {
    const b = impersonatedBrand(`${k}-verify-account.top`);
    if (b) { names.add(b); if (!map.has(b)) map.set(b, k); if (k.length <= 4) short.add(b); }
  }
  shortNames = short; keyOf = map;
  return names;
}

function note(domain, brand, source, seen) {
  const it = state.items.get(domain) || { domain, brand, sources: [], firstSeen: seen, status: "new" };
  if (!it.sources.includes(source)) it.sources.push(source);
  if (seen && (!it.firstSeen || seen < it.firstSeen)) it.firstSeen = seen;
  state.items.set(domain, it);
  return it;
}

// ---- source 1: newly registered domains (WhoisDS daily list) ----
function unzipSingle(buf) {
  // The daily file is a zip with one text file (deflate). Read its local header directly.
  if (buf.readUInt32LE(0) !== 0x04034b50) throw new Error("not a zip");
  const method = buf.readUInt16LE(8), size = buf.readUInt32LE(18), nlen = buf.readUInt16LE(26), xlen = buf.readUInt16LE(28);
  const start = 30 + nlen + xlen, data = buf.subarray(start, size ? start + size : buf.length);
  return (method === 8 ? zlib.inflateRawSync(data) : data).toString("utf8");
}

async function newDomainsFor(day) {
  const id = Buffer.from(day + ".zip").toString("base64");
  const res = await fetch(`https://www.whoisds.com/whois-database/newly-registered-domains/${id}/nrd`, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  return unzipSingle(buf).split(/\r?\n/).map(x => x.trim().toLowerCase()).filter(Boolean);
}

async function scanNewDomains(brands) {
  const days = Number(process.env.WATCH_DAYS || 14);
  let scanned = 0, found = 0, failed = 0;
  for (let i = days; i >= 1; i--) {
    const day = new Date(Date.now() - i * 24 * 3600_000).toISOString().slice(0, 10);
    if (state.nrdDays.includes(day)) continue;
    try {
      const names = await newDomainsFor(day);
      scanned += names.length;
      let n = 0;
      for (const d of names) {
        if (++n % 2000 === 0) await breathe();
        const brand = impersonatedBrand(d);
        if (!brand || !brands.has(brand)) continue;
        const it = note(d, brand, "Newly registered domain", day + "T00:00:00Z");
        it.registeredDay = day;
        found++;
      }
      state.nrdDays.push(day);
    } catch { failed++; }
    await wait(1500); // be gentle with a free service
  }
  state.nrdDays = state.nrdDays.slice(-60);
  state.runs.nrd = { at: new Date().toISOString(), scanned, found, failed, daysCovered: state.nrdDays.length };
}

// ---- source 2: public phishing lists ----
async function scanLists(brands) {
  const { domains, urls } = listedEntries();
  const now = new Date().toISOString();
  let found = 0, n = 0;
  for (const d of domains) {
    if (++n % 2000 === 0) await breathe();
    const brand = impersonatedBrand(d);
    if (brand && brands.has(brand)) { note(d, brand, "Phishing.Database", now); found++; }
  }
  for (const u of urls) {
    const host = u.split("/")[0];
    const brand = impersonatedBrand(host);
    if (brand && brands.has(brand)) { const it = note(host, brand, "OpenPhish", now); it.sampleUrl = it.sampleUrl || "https://" + u; found++; }
  }
  state.runs.lists = { at: now, found };
}

// ---- scoring ----
async function scoreNew() {
  const todo = [...state.items.values()].filter(it => !it.checkedAt).sort((a, b) => (b.firstSeen || "").localeCompare(a.firstSeen || "")).slice(0, MAX_CHECKS_PER_RUN);
  let i = 0;
  const worker = async () => {
    while (i < todo.length) {
      const it = todo[i++];
      try {
        const r = await checkLink(it.sampleUrl || "https://" + it.domain + "/", { ageWaitMs: 10_000 });
        if (r && r.valid) {
          Object.assign(it, {
            checkedAt: new Date().toISOString(), level: r.level, score: r.score, listed: Boolean(r.phishLists?.listed),
            model: r.model?.phishingProbability ?? null, registered: r.domainAge?.created || null, ageDays: r.domainAge?.ageDays ?? null,
            reasons: r.flags.filter(f => f.sev === "high" || f.sev === "med").map(f => f.title).slice(0, 4)
          });
        }
      } catch { /* try again next run */ }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return todo.length;
}

/** Runs the watch once. includeNew=false skips the new-domain download (lists only, fast). */
export async function runWatch({ includeNew = true } = {}) {
  if (state.running) return false;
  state.running = true;
  try {
    const brands = watchedBrandNames();
    await scanLists(brands);
    if (includeNew) await scanNewDomains(brands);
    const checked = await scoreNew();
    save();
    console.log(`brand watch: ${state.items.size} sites (${checked} newly checked); new domains: ${state.runs.nrd ? `${state.runs.nrd.scanned} scanned, ${state.runs.nrd.found} found, ${state.runs.nrd.failed} days failed` : "not run"}`);
  } finally { state.running = false; }
  return true;
}

let started = false;
export function startWatch() {
  if (started || (process.env.WATCH || "").toLowerCase() === "off") return;
  started = true;
  // First run a minute after start-up (the phishing lists download first), then every 6 hours.
  // New-domain lists are published once a day; days already scanned are skipped.
  setTimeout(() => runWatch(), 60_000).unref();
  setInterval(() => runWatch(), 6 * 3600_000).unref();
}

export function watchItems() {
  return { running: state.running, runs: state.runs, brands: [...watchedBrandNames()], items: [...state.items.values()] };
}

/** Marks a site as reviewed / reported for takedown / ignored (authorised staff). */
export function setStatus(domain, status) {
  const it = state.items.get(domain);
  if (!it || !["new", "reviewed", "reported", "ignored"].includes(status)) return false;
  it.status = status; it.statusAt = new Date().toISOString(); save();
  return true;
}
