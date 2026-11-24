// Reveal where a short link (bit.ly, tinyurl...) leads, without opening the
// final page. Only known shortener domains are contacted, redirects are read
// one hop at a time, and private/internal addresses are refused so the server
// cannot be used to reach the police internal network (SSRF protection).

import dns from "node:dns/promises";
import net from "node:net";
import { SHORTENERS } from "../public/js/url-analyzer.js";

const MAX_HOPS = 4;

function isPrivate(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  return v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:");
}

async function safeHost(hostname) {
  try {
    const addrs = await dns.lookup(hostname, { all: true });
    return addrs.length > 0 && addrs.every(a => !isPrivate(a.address));
  } catch { return false; }
}

/** @returns {Promise<string|null>} final URL, or null if not a shortener / not resolvable */
export async function expandShortLink(href) {
  let current;
  try { current = new URL(href); } catch { return null; }
  if (!SHORTENERS.has(current.hostname.toLowerCase())) return null;

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    if (!["http:", "https:"].includes(current.protocol)) return current.href;
    if (!SHORTENERS.has(current.hostname.toLowerCase())) return current.href; // left the shortener: stop, never fetch the target
    if (!(await safeHost(current.hostname))) return null;
    let res;
    try {
      res = await fetch(current.href, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(4000) });
    } catch { return null; }
    const loc = res.headers.get("location");
    if (res.status < 300 || res.status >= 400 || !loc) return hop === 0 ? null : current.href;
    try { current = new URL(loc, current); } catch { return null; }
  }
  return current.href;
}
