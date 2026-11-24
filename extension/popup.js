import { analyzeUrl } from "./url-analyzer.js";
import { API_BASE } from "./config.js";

const $ = s => document.querySelector(s);
const TEXT = { high: "Likely a scam. Don't enter any details.", med: "Suspicious. Be careful on this page.", low: "No obvious warning signs." };

function show(box, flagsEl, r) {
  box.dataset.level = r.level;
  box.textContent = `${TEXT[r.level]} (risk ${r.score}/100)`;
  if (!flagsEl) return;
  flagsEl.replaceChildren();
  for (const f of r.flags.filter(f => f.sev !== "good").slice(0, 3)) {
    const li = document.createElement("li"); li.textContent = f.title; flagsEl.append(li);
  }
}

// Current tab, checked locally.
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
const r = tab?.url && /^https?:/.test(tab.url) ? analyzeUrl(tab.url) : null;
if (r && r.valid) {
  $("#cur-host").textContent = r.parts?.reg || r.host;
  show($("#cur-verdict"), $("#cur-flags"), r);
  $("#url").value = tab.url;
} else {
  $("#current").hidden = true;
}

// Search-result badges on/off (search-badges.js reads the same setting).
chrome.storage.sync.get({ markSearch: true }, p => { $("#mark-search").checked = p.markSearch !== false; });
$("#mark-search").addEventListener("change", e => chrome.storage.sync.set({ markSearch: e.target.checked }));

// Full check on the كن واعياً server (Safe Browsing + short-link expansion).
$("#form").addEventListener("submit", async e => {
  e.preventDefault();
  const url = $("#url").value.trim();
  if (!url) return;
  const btn = $("#form button"); btn.disabled = true; btn.textContent = "Checking…";
  const deep = $("#deep"); deep.replaceChildren();
  const box = document.createElement("div"); box.className = "verdict";
  const flags = document.createElement("ul"); flags.className = "flags";
  try {
    const res = await fetch(`${API_BASE}/api/check-url`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
    if (!res.ok) throw new Error(String(res.status));
    show(box, flags, await res.json());
  } catch {
    const local = analyzeUrl(url);
    if (local && local.valid) { show(box, flags, local); box.textContent += " Online check unavailable."; }
    else box.textContent = "That doesn't look like a web address.";
  }
  const more = document.createElement("a");
  more.href = `${API_BASE}/?url=${encodeURIComponent(url)}#link`; more.target = "_blank"; more.textContent = "See full details";
  deep.append(box, flags, more);
  btn.disabled = false; btn.textContent = "Check with كن واعياً";
});
