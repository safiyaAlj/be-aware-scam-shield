import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { messageSigns, extractUrls } from "../public/js/url-analyzer.js";
import { checkLinkCached as checkLink, cacheStats } from "./check-link.js";
import { startPhishLists, sampleListedDomain } from "./phish-lists.js";
import { startWatch, watchItems, setStatus } from "./brand-watch.js";
import { AnalysisError } from "./claude.js";
import { analyze, analysisEngine } from "./analyze.js";
import { whatsappRouter } from "./whatsapp.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS || 1)); // behind a reverse proxy / load balancer

// Optional password for the whole site (for example before a public launch).
// Set SITE_PASSWORD (and optionally SITE_USER, default "be-aware") to turn it on; remove it to open the site.
// The health check and the WhatsApp webhook stay open: the host and Meta can't log in.
const SITE_PASSWORD = process.env.SITE_PASSWORD || "";
const SITE_USER = process.env.SITE_USER || "be-aware";
const sameText = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
if (SITE_PASSWORD) {
  app.use((req, res, next) => {
    if (req.path === "/healthz" || req.path.startsWith("/webhooks/")) return next();
    const [scheme, encoded] = (req.get("authorization") || "").split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = Buffer.from(encoded, "base64").toString("utf8");
      const i = decoded.indexOf(":");
      if (i > 0 && sameText(decoded.slice(0, i), SITE_USER) & sameText(decoded.slice(i + 1), SITE_PASSWORD)) return next();
    }
    res.set("WWW-Authenticate", 'Basic realm="Be Aware Scam Shield", charset="UTF-8"').status(401).send("Password required.");
  });
}

// Keep the raw body for WhatsApp signature checks; allow screenshots up to ~5 MB.
app.use(express.json({ limit: "8mb", verify: (req, _res, buf) => { req.rawBody = buf; } }));

// Basic security headers.
app.use((_req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'"
  });
  next();
});

// CORS for the browser extension only.
const EXT_ORIGINS = (process.env.EXTENSION_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
app.use("/api", (req, res, next) => {
  const origin = req.get("origin");
  if (origin && EXT_ORIGINS.includes(origin)) {
    res.set({ "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" });
    if (req.method === "OPTIONS") return res.sendStatus(204);
  }
  next();
});

const linkLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false });
const aiLimiter = rateLimit({ windowMs: 60_000, limit: 6, standardHeaders: "draft-7", legacyHeaders: false,
  message: { error: "rate_limited", message: "Too many checks. Please wait a minute and try again." } });

app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/api/config", (_req, res) => res.json({ engine: analysisEngine() }));
app.get("/api/stats", (_req, res) => res.set("Cache-Control", "no-store").json({ linkCache: cacheStats, uptimeSeconds: Math.round(process.uptime()) }));

// Link check: heuristics + short-link expansion + Google Safe Browsing.
app.post("/api/check-url", linkLimiter, async (req, res) => {
  const url = String(req.body?.url || "").slice(0, 2048);
  if (!url.trim()) return res.status(400).json({ error: "missing_url" });
  const result = await checkLink(url);
  if (!result || !result.valid) return res.status(400).json({ error: "invalid_url" });
  res.json(result);
});

// Batch link check for the browser extension's search-result badges (one call per results page).
// Returns a short summary per link, in the same order. Search words are never sent, only result links.
const batchLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false });
app.post("/api/check-urls", batchLimiter, async (req, res) => {
  const urls = Array.isArray(req.body?.urls) ? req.body.urls.slice(0, 25).map(u => String(u || "").slice(0, 2048)) : [];
  if (!urls.length) return res.status(400).json({ error: "missing_urls" });
  const results = await Promise.all(urls.map(async url => {
    try {
      const r = await checkLink(url);
      if (!r || !r.valid) return { url, valid: false };
      return {
        url, valid: true, level: r.level, score: r.score, domain: r.parts?.reg || r.host, official: r.official || null,
        listed: Boolean(r.phishLists?.listed),
        reasons: r.flags.filter(f => f.sev === "high" || f.sev === "med").slice(0, 3).map(f => f.title)
      };
    } catch { return { url, valid: false }; }
  }));
  res.json({ results });
});

// AI analysis of a message, a link, or a screenshot.
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
app.post("/api/analyze", aiLimiter, async (req, res) => {
  const text = String(req.body?.text || "").slice(0, 8000);
  let image;
  if (req.body?.image) {
    const { mediaType, data } = req.body.image;
    if (!IMAGE_TYPES.has(mediaType) || typeof data !== "string" || data.length > 7_000_000) {
      return res.status(400).json({ error: "image_rejected", message: "Use a PNG, JPG, WebP or GIF under 5 MB." });
    }
    image = { mediaType, data };
  }
  if (!text.trim() && !image) return res.status(400).json({ error: "empty", message: "Paste a message or add a screenshot." });

  try {
    const links = (await Promise.all(extractUrls(text).map(u => checkLink(u)))).filter(r => r && r.valid);
    const analysis = await analyze({ text, image, signs: messageSigns(text), links });
    res.json({ analysis, links });
  } catch (err) {
    const code = err instanceof AnalysisError ? err.code : "upstream";
    console.error("analyze failed:", code, err instanceof AnalysisError ? "" : err.message); // never log the submitted content
    const status = code === "rate_limited" ? 429 : code === "refused" || code === "bad_request" || code === "needs_text" ? 422 : 502;
    res.status(status).json({ error: code });
  }
});

// Fake sites watch (public page at /watch): sites impersonating UAE organisations.
// Viewing shows public information (domain names from public lists). Changing a site's status
// needs WATCH_TOKEN (header x-watch-token); without one set, only this machine may change it.
// Early warnings first (newly registered look-alikes), each group by risk.
const isNewReg = it => (it.sources || []).includes("Newly registered domain");
const watchSort = (a, b) => (isNewReg(b) - isNewReg(a)) || (b.score ?? -1) - (a.score ?? -1) || (b.registeredDay || "").localeCompare(a.registeredDay || "") || (b.firstSeen || "").localeCompare(a.firstSeen || "");
app.get("/api/watch", (_req, res) => {
  const w = watchItems();
  res.set("Cache-Control", "no-store").json({ ...w, items: w.items.slice().sort(watchSort) });
});
app.get("/api/watch.csv", (_req, res) => {
  const q = v => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const rows = watchItems().items.slice().sort(watchSort).map(it => [it.domain, it.brand, it.score, it.level, (it.sources || []).join(" + "), it.registeredDay || it.registered?.slice(0, 10) || "", it.ageDays ?? "", it.firstSeen?.slice(0, 10) || "", (it.reasons || []).join("; "), it.status].map(q).join(","));
  res.type("text/csv").set("Content-Disposition", 'attachment; filename="brand-watch.csv"')
    .send(["domain,impersonates,risk,level,source,registered,age_days,first_seen,reasons,status", ...rows].join("\r\n"));
});
app.post("/api/watch/status", (req, res) => {
  const token = process.env.WATCH_TOKEN;
  const local = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress) && !req.get("x-forwarded-for");
  if (token ? req.get("x-watch-token") !== token : !local) return res.status(403).json({ error: "forbidden" });
  const ok = setStatus(String(req.body?.domain || ""), String(req.body?.status || ""));
  res.status(ok ? 200 : 400).json({ ok });
});

// Demo results page for presentations: the extension marks these like real search results.
// Links are disabled on the page (public/js/demo-search.js) so nobody opens a scam site by accident.
app.get("/demo/search", (_req, res) => {
  const listed = sampleListedDomain();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const rows = [
    ["https://www.salik.ae/en", "Salik - Recharge your account", "Official Salik website. Check or recharge your balance, add a vehicle or set up automatic payments."],
    ["https://salik-ae-topup.shop/pay", "Salik Top Up - Instant Recharge 50% Bonus", "Recharge your Salik tag online in seconds. Limited time bonus credit for all UAE drivers."],
    ["https://www.adpolice.gov.ae/en", "Abu Dhabi Police - Pay traffic fines", "Official Abu Dhabi Police services: traffic fines, reports and e-services."],
    ["https://adpolice-fines.top/pay?ref=AE-2291", "Abu Dhabi Police Fines - Pay Now and Avoid Black Points", "Pay your overdue traffic fine today with 50% discount. Avoid vehicle impound."],
    ["https://emiratesnbd-login.web.app/", "Emirates NBD Online Banking - Secure Login", "Log in to verify your account and avoid suspension of your card."],
    ["https://www.emiratesnbd.com/en", "Emirates NBD - Personal Banking", "Accounts, cards, loans and digital banking from Emirates NBD."],
    ...(listed ? [[`https://${listed}/`, "Customer Support - Account Verification", "This website is on today's public phishing list (Phishing.Database)."]] : [])
  ];
  res.type("html").send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Demo search results | كن واعياً</title><link rel="icon" type="image/png" href="/assets/logo.png">
<style>body{margin:0;font:15px/1.5 system-ui,sans-serif;background:#fff;color:#202124}main{max-width:720px;padding:16px}
.banner{background:#ECE4D8;color:#2B2219;border-radius:10px;padding:10px 14px;margin-bottom:18px;font-size:14px}
.q{border:1px solid #dadce0;border-radius:24px;padding:10px 18px;margin-bottom:18px;color:#5f6368}
.demo-result{margin:0 0 26px}.demo-result cite{display:block;font-style:normal;font-size:13px;color:#4d5156;overflow-wrap:anywhere}
.demo-result a{text-decoration:none}.demo-result h3{margin:2px 0;font-size:19px;font-weight:400;color:#1a0dab}
.demo-result p{margin:0;font-size:14px;color:#4d5156}.ad{font-weight:700;font-size:12px;color:#202124;margin-inline-end:6px}</style>
<script type="module" src="/js/demo-search.js"></script></head><body><main>
<div class="banner"><b>Demo page.</b> Sample search results, not a real search engine. The badges are what the كن واعياً browser extension adds to every result and ad on Google, Bing and DuckDuckGo. Click a badge for the full check. The sample links are disabled.</div>
<div class="q">salik recharge · abu dhabi police fines · emirates nbd login</div>
${rows.map(([u, t, d], i) => `<div class="demo-result"><cite>${i === 1 || i === 3 ? '<span class="ad">Sponsored</span>' : ""}${esc(u)}</cite><a href="${esc(u)}"><h3>${esc(t)}</h3></a><p>${esc(d)}</p></div>`).join("\n")}
</main></body></html>`);
});

// The awareness game (public/game/index.html) is one self-contained page with inline scripts,
// so it gets its own security policy. It may be shown in a frame on this site only.
app.use("/game", (_req, res, next) => {
  res.set({
    "X-Frame-Options": "SAMEORIGIN",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self'; connect-src 'self' data: blob:; worker-src 'self' blob:; frame-ancestors 'self'"
  });
  next();
});

app.use("/webhooks/whatsapp", whatsappRouter());
// Pages, styles and scripts are re-checked on every load (cheap: unchanged files return 304),
// so after an update a browser never mixes a new page with an old stylesheet.
// Fonts and images rarely change and are cached for a day.
app.use(express.static(path.join(here, "..", "public"), {
  extensions: ["html"],
  setHeaders(res, filePath) {
    res.setHeader("Cache-Control", /\.(html|css|js|mjs|json)$/i.test(filePath) ? "no-cache" : "public, max-age=86400");
  }
}));

const port = Number(process.env.PORT || 8080);
startPhishLists();
startWatch();
app.listen(port, () => console.log(`Scam Check listening on http://localhost:${port} (message analysis: ${analysisEngine()})`));
