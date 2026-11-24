// Runs on Google, Bing and DuckDuckGo results pages.
// Finds every result and sponsored-ad link, asks the background script to check them
// (one request per batch to the كن واعياً server; only the links are sent, never the
// search words), and puts a coloured badge next to each title.
(() => {
  if (window.__kunwaeyanBadges) return;
  window.__kunwaeyanBadges = true;

  const AR = /^ar/i.test(document.documentElement.lang || navigator.language || "");
  const TEXT = AR
    ? { high: "احتيال محتمل", med: "مشبوه", low: "لا تحذيرات", listed: "موقع احتيال مُبلّغ عنه", checking: "جارٍ الفحص…", tip: "اضغط لعرض الفحص الكامل", by: "كن واعياً" }
    : { high: "Likely scam", med: "Suspicious", low: "No warnings", listed: "Reported phishing site", checking: "Checking…", tip: "Click for the full check", by: "كن واعياً" };
  const COLORS = {
    high: { bg: "#E2574F", fg: "#fff" },
    med: { bg: "#E9B250", fg: "#2B2219" },
    low: { bg: "#e7f4ec", fg: "#1f6b3f" },
    wait: { bg: "#ECE4D8", fg: "#2B2219" }
  };
  const MARK = "data-kunwaeyan";

  // ---- finding result links on each search engine ----
  function decodeBing(href) {
    // Bing wraps results as https://www.bing.com/ck/a?...&u=a1<base64url of the real address>
    try {
      const u = new URL(href).searchParams.get("u");
      if (!u || !u.startsWith("a1")) return null;
      const b64 = u.slice(2).replace(/-/g, "+").replace(/_/g, "/");
      return atob(b64 + "===".slice((b64.length + 3) % 4));
    } catch { return null; }
  }
  function realHref(a) {
    const href = a.href || "";
    try {
      const u = new URL(href);
      if (/(^|\.)google\.[a-z.]+$/.test(u.hostname) && u.pathname === "/url") return u.searchParams.get("q") || u.searchParams.get("url");
      if (/(^|\.)bing\.com$/.test(u.hostname) && u.pathname.startsWith("/ck/")) return decodeBing(href);
      if (/(^|\.)duckduckgo\.com$/.test(u.hostname) && u.searchParams.get("uddg")) return u.searchParams.get("uddg");
      if (/(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|microsoft\.com|msn\.com)$/.test(u.hostname)) return null; // the engine's own pages
      if (u.hostname === location.hostname) return null; // links within the same site
      return /^https?:$/.test(u.protocol) ? href : null;
    } catch { return null; }
  }
  /** [{ anchor, title (element to put the badge in), url }] for results not yet marked. */
  function findResults() {
    const host = location.hostname;
    let pairs = [];
    if (/google\./.test(host)) {
      // Organic results and ads: a link that contains the result heading.
      for (const h of document.querySelectorAll("#search a h3, #rso a h3, #tads a [role='heading'], #bottomads a [role='heading'], #tvcap a [role='heading']")) {
        pairs.push([h.closest("a"), h]);
      }
    } else if (/bing\.com$/.test(host)) {
      for (const a of document.querySelectorAll("#b_results li.b_algo h2 a, #b_results li.b_ad h2 a, #b_results .b_adSlug ~ h2 a")) pairs.push([a, a.closest("h2") || a]);
    } else if (/duckduckgo\.com$/.test(host)) {
      for (const a of document.querySelectorAll("a[data-testid='result-title-a']")) pairs.push([a, a]);
    } else if (location.pathname.startsWith("/demo/search")) {
      // The كن واعياً server's demo results page (for presentations).
      for (const h of document.querySelectorAll(".demo-result a h3")) pairs.push([h.closest("a"), h]);
    }
    const out = [];
    for (const [anchor, title] of pairs) {
      if (!anchor || !title || title.hasAttribute(MARK)) continue;
      const url = realHref(anchor);
      if (!url) continue;
      title.setAttribute(MARK, "");
      out.push({ anchor, title, url });
    }
    return out;
  }

  // ---- badges ----
  function badge(state, result) {
    const b = document.createElement("span");
    b.setAttribute(MARK + "-badge", state);
    const c = COLORS[state] || COLORS.wait;
    Object.assign(b.style, {
      display: "inline-flex", alignItems: "center", gap: "4px", marginInlineStart: "8px", padding: "1px 8px",
      borderRadius: "999px", font: "600 12px/18px system-ui, sans-serif", verticalAlign: "middle", whiteSpace: "nowrap",
      background: c.bg, color: c.fg, cursor: "pointer", textDecoration: "none", border: state === "low" ? "1px solid #b9dcc6" : "0"
    });
    if (state === "wait") { b.textContent = TEXT.checking; return b; }
    const icon = state === "high" ? "⛔" : state === "med" ? "⚠" : "✓";
    const label = result.listed ? TEXT.listed : TEXT[state];
    b.textContent = state === "low" ? `${icon} ${label}` : `${icon} ${label} · ${result.score}`;
    const reasons = (result.reasons || []).join(" · ");
    b.title = `${TEXT.by}: ${label}${reasons ? "\n" + reasons : ""}\n${result.domain || ""}\n${TEXT.tip}`;
    b.addEventListener("click", e => {
      e.preventDefault(); e.stopPropagation();
      chrome.runtime.sendMessage({ type: "open-check", url: result.url });
    }, true);
    return b;
  }
  function place(item, el) {
    item.title.querySelector(`[${MARK}-badge]`)?.remove();
    item.title.append(el);
  }

  // ---- run ----
  let busy = false, again = false;
  async function scan() {
    if (busy) { again = true; return; }
    busy = true;
    try {
      const items = findResults().slice(0, 25);
      if (items.length) {
        for (const it of items) place(it, badge("wait"));
        const res = await chrome.runtime.sendMessage({ type: "check-links", urls: items.map(i => i.url) });
        const results = res?.results || [];
        items.forEach((it, i) => {
          const r = results[i];
          if (r && r.valid) place(it, badge(r.level, r));
          else it.title.querySelector(`[${MARK}-badge]`)?.remove();
        });
      }
    } catch { /* extension reloaded or server down: leave the page as it is */ }
    busy = false;
    if (again) { again = false; scan(); }
  }

  chrome.storage?.sync.get({ markSearch: true }, prefs => {
    if (prefs && prefs.markSearch === false) return;
    scan();
    let t;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(scan, 400); }).observe(document.body, { childList: true, subtree: true });
  });
})();
