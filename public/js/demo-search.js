// Demo results page. Shows the same badges the كن واعياً browser extension adds to Google,
// Bing and DuckDuckGo results, so it works without installing anything. If the extension is
// installed it sees the titles are already marked and adds nothing. The sample links are never
// opened: clicking a result explains that; clicking a badge opens the full check.

const COLORS = {
  high: { bg: "#E2574F", fg: "#fff" },
  med: { bg: "#E9B250", fg: "#2B2219" },
  low: { bg: "#e7f4ec", fg: "#1f6b3f" },
  wait: { bg: "#ECE4D8", fg: "#2B2219" }
};
const TEXT = { high: "Likely scam", med: "Suspicious", low: "No warnings", listed: "Reported phishing site", wait: "Checking…" };

function badge(state, r) {
  const b = document.createElement("span");
  b.setAttribute("data-kunwaeyan-badge", state);
  const c = COLORS[state] || COLORS.wait;
  Object.assign(b.style, {
    display: "inline-flex", alignItems: "center", gap: "4px", marginInlineStart: "8px", padding: "1px 8px",
    borderRadius: "999px", font: "600 12px/18px system-ui, sans-serif", verticalAlign: "middle", whiteSpace: "nowrap",
    background: c.bg, color: c.fg, cursor: "pointer", border: state === "low" ? "1px solid #b9dcc6" : "0"
  });
  if (state === "wait") { b.textContent = TEXT.wait; return b; }
  const label = r.listed ? TEXT.listed : TEXT[state];
  const icon = state === "high" ? "⛔" : state === "med" ? "⚠" : "✓";
  b.textContent = state === "low" ? `${icon} ${label}` : `${icon} ${label} · ${r.score}`;
  b.title = `كن واعياً: ${label}${(r.reasons || []).length ? "\n" + r.reasons.join(" · ") : ""}\nClick for the full check`;
  b.addEventListener("click", e => {
    e.preventDefault(); e.stopPropagation();
    window.open("/?url=" + encodeURIComponent(r.url) + "#link", "_blank", "noopener");
  });
  return b;
}

async function markResults() {
  const items = [...document.querySelectorAll(".demo-result a h3")]
    .map(h => ({ h, a: h.closest("a") }))
    .filter(x => x.a && !x.h.hasAttribute("data-kunwaeyan"));
  if (!items.length) return;
  for (const x of items) { x.h.setAttribute("data-kunwaeyan", ""); x.h.append(badge("wait")); }
  let results = [];
  try {
    const res = await fetch("/api/check-urls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ urls: items.map(x => x.a.href) }) });
    results = (await res.json()).results || [];
  } catch { /* leave the page without badges */ }
  items.forEach((x, i) => {
    x.h.querySelector("[data-kunwaeyan-badge]")?.remove();
    const r = results[i];
    if (r && r.valid) x.h.append(badge(r.level, r));
  });
}

// Never navigate to the (possibly malicious) sample links.
document.addEventListener("click", e => {
  if (e.target.closest?.("[data-kunwaeyan-badge]")) return; // badges handle their own clicks
  const a = e.target.closest?.(".demo-result a");
  if (!a) return;
  e.preventDefault();
  alert("Demo page: links are disabled. Click the badge to see the full check.");
}, true);

markResults();
