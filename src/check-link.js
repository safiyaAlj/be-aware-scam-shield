// Full link check: local heuristics + short-link expansion + public phishing lists
// + trained phishing-address model + Google Safe Browsing (when a key is set).
import { analyzeUrl, finish } from "../public/js/url-analyzer.js";
import { checkSafeBrowsing } from "./safe-browsing.js";
import { expandShortLink } from "./expand.js";
import { lookupPhishLists, phishListStatus } from "./phish-lists.js";
import { phishingProbability } from "./local-model/url-classifier.js";
import { domainAge, ageFlag } from "./domain-age.js";

// Recent results, so the same link (a popular scam, or a search page reloaded) answers instantly.
// Kept for 10 minutes; the phishing lists refresh every few hours, so results stay current.
const CACHE_MS = 10 * 60 * 1000, CACHE_MAX = 5000;
const cache = new Map(); // link -> { at, promise }
export const cacheStats = { hits: 0, misses: 0 };

/** checkLink with a short-lived cache. Use for people's requests; the brand watch uses checkLink. */
export function checkLinkCached(raw) {
  const key = String(raw || "").trim().slice(0, 2048);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    cacheStats.hits++;
    cache.delete(key); cache.set(key, hit); // keep recently used entries
    return hit.promise;
  }
  cacheStats.misses++;
  const promise = checkLink(key).catch(err => { cache.delete(key); throw err; });
  cache.set(key, { at: Date.now(), promise });
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return promise;
}

/** @param {number} ageWaitMs  how long to wait for the website-age lookup (cached afterwards) */
export async function checkLink(raw, { ageWaitMs = 3000 } = {}) {
  const result = analyzeUrl(raw);
  if (!result || !result.valid) return result;

  let final = result;
  if (result.href && /^https?:/.test(result.href)) {
    const expanded = await expandShortLink(result.href);
    if (expanded && expanded !== result.href) {
      const target = analyzeUrl(expanded);
      if (target && target.valid) {
        final = target;
        final.expandedFrom = result.raw;
        final.flags.unshift({ sev: "med", title: "Short link revealed", detail: `${result.host} redirects to ${target.host}. The checks below are for the real destination.`, pts: 10 });
      }
    }
  }

  // Public phishing lists, downloaded to this server (nothing is sent out).
  let listed = { listed: false };
  for (const r of final === result ? [result] : [final, result]) {
    const hit = lookupPhishLists(r.href, r.host, Boolean(r.official));
    if (hit.listed) { listed = hit; break; }
  }
  final.phishLists = { ...phishListStatus(), ...listed };
  if (listed.listed) {
    final.flags.unshift({ sev: "high", title: "On a list of known phishing sites", detail: `This ${listed.match === "address" ? "address" : "website"} is listed as phishing by ${listed.source}, a public list of reported scam sites. Do not open it.`, pts: 100 });
  }

  // Trained model: does the website name look like the phishing sites it learned from?
  // Skipped for official brand domains and raw IP addresses (the rules already cover those).
  const p = final.official || !final.parts ? null : phishingProbability(final.host);
  final.model = p === null ? null : { phishingProbability: Math.round(p * 100) / 100 };
  if (p !== null && !listed.listed) {
    const detail = `A model trained on 369,000 known phishing and genuine website names rates this one ${Math.round(p * 100)}% likely to be phishing. It judges the name only, not the page.`;
    // On its own, a model score of 70%+ makes a link at least "suspicious" (30+ points).
    if (p >= 0.9) final.flags.push({ sev: "high", title: "Website name looks like phishing sites", detail, pts: 45 });
    else if (p >= 0.7) final.flags.push({ sev: "med", title: "Website name resembles phishing sites", detail, pts: 30 });
  }

  // How old is the website? (Registry RDAP; skipped for official brand domains.)
  if (!final.official && final.parts) {
    const age = await domainAge(final.host, ageWaitMs);
    final.domainAge = age;
    const f = ageFlag(age);
    if (f) final.flags.push(f);
  }

  const urls = [result.href, final.href].filter(Boolean);
  const sb = await checkSafeBrowsing(urls);
  final.safeBrowsing = sb;
  if (sb.available && sb.matches.length) {
    final.flags.unshift({ sev: "high", title: "Listed by Google Safe Browsing", detail: `Google has flagged this address as: ${sb.matches.join(", ")}. Do not open it.`, pts: 100 });
  } else if (sb.available) {
    final.flags.push({ sev: "good", title: "Not on Google's threat lists", detail: "Google Safe Browsing has no record of this address. New scam sites appear every hour, so this is not a guarantee.", pts: 0 });
  }
  return finish(final);
}
