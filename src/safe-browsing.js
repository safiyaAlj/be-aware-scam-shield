// Google Safe Browsing Lookup API (v4) client with a small in-memory cache.
// Docs: https://developers.google.com/safe-browsing/v4/lookup-api
// Note: the Lookup API is for non-commercial use. If this service's use is
// considered commercial by Google, switch to Google Cloud Web Risk
// (https://cloud.google.com/web-risk), which has the same request shape.

const ENDPOINT = "https://safebrowsing.googleapis.com/v4/threatMatches:find";
const THREAT_TYPES = ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"];
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map(); // url -> { at, result }

const LABELS = {
  MALWARE: "Malware",
  SOCIAL_ENGINEERING: "Phishing or deceptive site",
  UNWANTED_SOFTWARE: "Unwanted software",
  POTENTIALLY_HARMFUL_APPLICATION: "Harmful app"
};

/** @returns {Promise<{available:boolean, matches:string[], error?:string}>} */
export async function checkSafeBrowsing(urls) {
  const key = process.env.GOOGLE_SAFE_BROWSING_KEY;
  if (!key) return { available: false, matches: [], error: "not_configured" };
  const list = [...new Set(urls)].slice(0, 20);
  const now = Date.now();
  const fresh = list.filter(u => !(cache.get(u) && now - cache.get(u).at < CACHE_MS));

  if (fresh.length) {
    try {
      const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(5000),
        body: JSON.stringify({
          client: { clientId: "kunwaeyan-scam-check", clientVersion: "1.0.0" },
          threatInfo: {
            threatTypes: THREAT_TYPES,
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: fresh.map(url => ({ url }))
          }
        })
      });
      if (!res.ok) return { available: false, matches: [], error: `http_${res.status}` };
      const data = await res.json();
      const byUrl = new Map(fresh.map(u => [u, []]));
      for (const m of data.matches || []) {
        const arr = byUrl.get(m.threat?.url);
        if (arr) arr.push(LABELS[m.threatType] || m.threatType);
      }
      for (const [u, matches] of byUrl) cache.set(u, { at: now, result: matches });
    } catch (err) {
      return { available: false, matches: [], error: err.name === "TimeoutError" ? "timeout" : "network" };
    }
  }
  const matches = [...new Set(list.flatMap(u => cache.get(u)?.result || []))];
  if (cache.size > 5000) cache.clear();
  return { available: true, matches };
}
