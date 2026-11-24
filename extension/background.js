// Runs in the background. Three jobs:
// 1. Show a warning badge on the toolbar icon when the current page looks risky.
//    This uses only the local pattern checks: page addresses never leave the browser.
// 2. Right-click menu "Check this link with كن واعياً" opens the full check.
// 3. Badges on search results (see below and search-badges.js).

import { analyzeUrl } from "./url-analyzer.js";
import { API_BASE } from "./config.js";

const BADGE = {
  high: { text: "!", color: "#b8321c", title: "Warning: this site looks like a scam" },
  med: { text: "?", color: "#9a6411", title: "Careful: this site has warning signs" }
};

function updateBadge(tabId, url) {
  if (!url || !/^https?:/.test(url)) { chrome.action.setBadgeText({ tabId, text: "" }); return; }
  const r = analyzeUrl(url);
  const b = r && r.valid ? BADGE[r.level] : null;
  chrome.action.setBadgeText({ tabId, text: b ? b.text : "" });
  if (b) chrome.action.setBadgeBackgroundColor({ tabId, color: b.color });
  chrome.action.setTitle({ tabId, title: b ? b.title : "Scam Check" });
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => { if (info.url || info.status === "complete") updateBadge(tabId, tab.url); });
chrome.tabs.onActivated.addListener(async ({ tabId }) => { try { const tab = await chrome.tabs.get(tabId); updateBadge(tabId, tab.url); } catch { /* tab closed */ } });

// 3. Search-result badges (search-badges.js asks us to check the result links on a page).
//    One request per page to our server: phishing lists + trained model + rules.
//    If the server can't be reached, the local pattern checks are used instead.
const cache = new Map(); // url -> { at, result }
const CACHE_MS = 30 * 60 * 1000;

function localResult(url) {
  const r = analyzeUrl(url);
  if (!r || !r.valid) return { url, valid: false };
  return { url, valid: true, level: r.level, score: r.score, domain: r.parts?.reg || r.host, official: r.official || null, listed: false,
    reasons: r.flags.filter(f => f.sev === "high" || f.sev === "med").slice(0, 3).map(f => f.title), offline: true };
}

async function checkLinks(urls) {
  const now = Date.now();
  const todo = [...new Set(urls)].filter(u => !(cache.get(u)?.at > now - CACHE_MS));
  if (todo.length) {
    let results;
    try {
      const res = await fetch(`${API_BASE}/api/check-urls`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ urls: todo }) });
      if (!res.ok) throw new Error(String(res.status));
      results = (await res.json()).results;
    } catch {
      results = todo.map(localResult);
    }
    results.forEach((r, i) => { if (!r.offline) cache.set(todo[i], { at: now, result: r }); else cache.set(todo[i], { at: now - CACHE_MS + 60_000, result: r }); });
    if (cache.size > 2000) cache.clear();
  }
  return urls.map(u => cache.get(u)?.result || localResult(u));
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type === "check-links" && Array.isArray(msg.urls)) {
    checkLinks(msg.urls.slice(0, 25).map(String)).then(results => reply({ results }));
    return true; // reply asynchronously
  }
  if (msg?.type === "open-check" && msg.url) {
    chrome.tabs.create({ url: `${API_BASE}/?url=${encodeURIComponent(msg.url)}#link`, index: sender.tab ? sender.tab.index + 1 : undefined });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "check-link", title: "Check this link with كن واعياً", contexts: ["link"] });
  chrome.contextMenus.create({ id: "check-text", title: "Check this text with كن واعياً", contexts: ["selection"] });
});

chrome.contextMenus.onClicked.addListener(info => {
  if (info.menuItemId === "check-link" && info.linkUrl) {
    chrome.tabs.create({ url: `${API_BASE}/?url=${encodeURIComponent(info.linkUrl)}#link` });
  } else if (info.menuItemId === "check-text" && info.selectionText) {
    const urls = info.selectionText.match(/https?:\/\/\S+/);
    if (urls) chrome.tabs.create({ url: `${API_BASE}/?url=${encodeURIComponent(urls[0])}#link` });
    else chrome.tabs.create({ url: `${API_BASE}/#message` });
  }
});
