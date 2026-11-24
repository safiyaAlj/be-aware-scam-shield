// How old is a website's domain? Most scam sites are only days old.
//
// Uses RDAP, the official registration-data service run by each domain registry
// (IANA publishes which registry answers for which ending: https://data.iana.org/rdap/dns.json).
// Only the main domain name (e.g. "salik-ae-topup.shop") is sent to that registry, never the
// full link or anything a person typed. Answers are cached for a week in data/feeds/.
// Some endings (including .ae) have no RDAP service, and some registries rate-limit:
// then the age is simply unknown, never guessed. DOMAIN_AGE=off disables lookups.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registrableOf } from "./local-model/url-features.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(here, "..", "data", "feeds");
const BOOT_FILE = path.join(DIR, "rdap-dns.json");
const CACHE_FILE = path.join(DIR, "rdap-cache.json");
const WEEK = 7 * 24 * 3600_000, DAY = 24 * 3600_000;

let boot = null;          // tld -> base URL
let bootAt = 0;
const cache = new Map();  // domain -> { at, created|null }
const inflight = new Map();
let dirty = false;

try {
  for (const [d, v] of Object.entries(JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")))) cache.set(d, v);
} catch { /* no cache yet */ }
setInterval(() => {
  if (!dirty) return;
  dirty = false;
  try { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(cache))); } catch { /* ignore */ }
}, 60_000).unref();

const enabled = () => (process.env.DOMAIN_AGE || "").toLowerCase() !== "off";

async function bootstrap() {
  if (boot && Date.now() - bootAt < DAY) return boot;
  let json = null;
  try {
    const res = await fetch("https://data.iana.org/rdap/dns.json", { signal: AbortSignal.timeout(15_000) });
    if (res.ok) { json = await res.json(); fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(BOOT_FILE, JSON.stringify(json)); }
  } catch { /* use the saved copy */ }
  if (!json) { try { json = JSON.parse(fs.readFileSync(BOOT_FILE, "utf8")); } catch { return boot; } }
  const map = new Map();
  for (const [tlds, urls] of json.services || []) for (const t of tlds) map.set(t.toLowerCase(), urls.find(u => u.startsWith("https")) || urls[0]);
  boot = map; bootAt = Date.now();
  return boot;
}

async function lookup(domain) {
  const b = await bootstrap();
  const tld = domain.split(".").pop();
  const base = b && b.get(tld);
  if (!base) return null; // no RDAP for this ending (e.g. .ae)
  const res = await fetch(base.replace(/\/?$/, "/") + "domain/" + encodeURIComponent(domain), {
    headers: { Accept: "application/rdap+json" }, redirect: "follow", signal: AbortSignal.timeout(8_000)
  });
  if (res.status === 404) return { created: null, notFound: true };
  if (!res.ok) throw new Error("HTTP " + res.status);
  const j = await res.json();
  const ev = (j.events || []).find(e => e.eventAction === "registration");
  return { created: ev?.eventDate || null };
}

/**
 * Registration date of a link's main domain.
 * @param {string} host  hostname of the link
 * @param {number} waitMs  how long to wait for a fresh lookup (the lookup keeps running and is cached)
 * @returns {Promise<{domain:string, created:string|null, ageDays:number|null}|null>}
 */
export async function domainAge(host, waitMs = 3000) {
  if (!enabled() || !host || /^\d+(\.\d+){3}$/.test(host) || !host.includes(".")) return null;
  const domain = registrableOf(host.toLowerCase().replace(/^www\./, ""));
  const hit = cache.get(domain);
  const fresh = hit && Date.now() - hit.at < (hit.created ? WEEK : DAY);
  let entry = fresh ? hit : null;
  if (!entry) {
    if (!inflight.has(domain)) {
      inflight.set(domain, lookup(domain)
        .then(r => { if (r) { const e = { at: Date.now(), created: r.created }; cache.set(domain, e); dirty = true; return e; } return null; })
        .catch(() => null)
        .finally(() => inflight.delete(domain)));
    }
    entry = await Promise.race([inflight.get(domain), new Promise(r => setTimeout(() => r(undefined), waitMs))]);
    if (entry === undefined) entry = hit || null; // still waiting: use an older answer if we have one
  }
  if (!entry || !entry.created) return { domain, created: null, ageDays: null };
  const ageDays = Math.max(0, Math.floor((Date.now() - Date.parse(entry.created)) / DAY));
  return { domain, created: entry.created, ageDays };
}

/** Warning flag for a young domain, or null. */
export function ageFlag(age) {
  if (!age || age.ageDays === null) return null;
  const d = age.ageDays, when = d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
  if (d < 7) return { sev: "high", title: "Website registered " + when, detail: `${age.domain} was registered ${when}. Most scam sites are only days old; real banks, couriers and government sites have existed for years.`, pts: 30 };
  if (d < 30) return { sev: "med", title: "Website registered " + when, detail: `${age.domain} is less than a month old. Scam sites are usually new; be careful with any request for payment or details.`, pts: 20 };
  if (d < 180) return { sev: "low", title: "Website is only a few months old", detail: `${age.domain} was registered ${Math.round(d / 30)} months ago.`, pts: 5 };
  return null;
}

/** For tests. */
export function _setCached(domain, created) { cache.set(domain, { at: Date.now(), created }); }
