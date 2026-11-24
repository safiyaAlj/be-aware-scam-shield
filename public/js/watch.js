// Fake sites watch page: loads /api/watch and filters it. Authorised staff can also set a status per site.
import { t as T, isAr, brand, flagTitle, withLang } from "./i18n.js";

const $ = s => document.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
let DATA = null;

const fmtDate = s => (s ? new Date(s).toLocaleDateString(isAr ? "ar-AE-u-nu-latn" : "en-GB", { day: "numeric", month: "short" }) : "—");
const ago = s => {
  if (!s) return isAr ? "لم يتم بعد" : "never";
  const m = Math.round((Date.now() - Date.parse(s)) / 60000);
  if (isAr) return m < 60 ? `منذ ${m} دقيقة` : m < 1440 ? `منذ ${Math.round(m / 60)} ساعة` : `منذ ${Math.round(m / 1440)} يوم`;
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

function tiles(items) {
  const box = $("#tiles"); box.replaceChildren();
  const isNew = it => it.sources.includes("Newly registered domain");
  const stats = [
    [items.length, "sites found"],
    [items.filter(isNew).length, "newly registered look-alikes"],
    [items.filter(it => it.sources.some(s => s !== "Newly registered domain")).length, "live on phishing lists"],
    [items.filter(it => it.level === "high").length, "high risk"],
    [new Set(items.map(it => it.brand)).size, "organisations targeted"]
  ];
  for (const [n, label] of stats) { const t = el("div", "tile"); t.append(el("b", null, String(n)), el("span", null, T(label))); box.append(t); }
}

function render() {
  const items = DATA.items;
  const b = $("#f-brand").value, src = $("#f-source").value, lv = $("#f-level").value, st = $("#f-status").value;
  const shown = items.filter(it => (!b || it.brand === b) && (!src || it.sources.includes(src)) &&
    (!lv || (lv === "high" ? it.level === "high" : it.level === "high" || it.level === "med")) && (!st || it.status === st));
  const body = $("#rows"); body.replaceChildren();
  if (!shown.length) { const tr = el("tr"); const td = el("td", "hint", DATA.running ? T("The first scan is running. This takes a few minutes…") : T("Nothing matches these filters.")); td.colSpan = 7; tr.append(td); body.append(tr); return; }
  for (const it of shown) {
    const tr = el("tr");
    const risk = el("td"); risk.append(el("span", "risk " + (it.level || "low"), it.score == null ? "…" : String(it.score))); tr.append(risk);
    const site = el("td"); const dom = el("span", "mono dom", it.domain); dom.dir = "ltr"; site.append(dom);
    const chk = el("a", "chk", T("Check")); chk.href = withLang("/?url=" + encodeURIComponent(it.sampleUrl || "https://" + it.domain + "/") + "#link"); chk.target = "_blank"; chk.rel = "noopener";
    site.append(" ", chk); tr.append(site);
    tr.append(el("td", null, brand(it.brand)));
    tr.append(el("td", "src", it.sources.map(T).join(" + ")));
    const reg = it.registeredDay || it.registered;
    tr.append(el("td", null, reg ? `${fmtDate(reg)}${it.ageDays != null ? (isAr ? ` (${it.ageDays} يوم)` : ` (${it.ageDays} d)`) : ""}` : "—"));
    tr.append(el("td", "why", (it.reasons || []).map(flagTitle).join(" · ")));
    const sel = el("select"); sel.setAttribute("aria-label", "Status for " + it.domain);
    for (const s of ["new", "reviewed", "reported", "ignored"]) { const o = el("option", null, T(s)); o.value = s; if (s === it.status) o.selected = true; sel.append(o); }
    sel.addEventListener("change", async () => {
      const res = await fetch("/api/watch/status", { method: "POST", headers: { "Content-Type": "application/json", "x-watch-token": localStorage.getItem("watchToken") || "" }, body: JSON.stringify({ domain: it.domain, status: sel.value }) }).catch(() => null);
      if (res && res.ok) it.status = sel.value;
      else { sel.value = it.status; alert(T("Only authorised staff can change the status.")); }
    });
    const stTd = el("td"); stTd.append(sel); tr.append(stTd);
    body.append(tr);
  }
}

async function load() {
  try {
    DATA = await (await fetch("/api/watch", { cache: "no-store" })).json();
  } catch { $("#rows").replaceChildren(el("tr", null, T("Could not load the watch list."))); return; }
  const sel = $("#f-brand"), cur = sel.value;
  sel.replaceChildren(el("option", null, T("All"))); sel.firstChild.value = "";
  for (const b of [...new Set(DATA.items.map(it => it.brand))].sort()) { const o = el("option", null, brand(b)); o.value = b; sel.append(o); }
  sel.value = cur;
  const r = DATA.runs || {};
  $("#runs").textContent = isAr
    ? `النطاقات الجديدة: ${r.nrd ? `${(r.nrd.daysCovered || 0)} يوم مغطى، آخر فحص ${ago(r.nrd.at)}` : T("not scanned yet")} · قوائم التصيد: ${r.lists ? `آخر فحص ${ago(r.lists.at)}` : T("not scanned yet")}${DATA.running ? " · " + T("scanning now…") : ""}`
    : `New domains: ${r.nrd ? `${(r.nrd.daysCovered || 0)} days covered, last scan ${ago(r.nrd.at)}` : "not scanned yet"} · Phishing lists: ${r.lists ? `last scan ${ago(r.lists.at)}` : "not scanned yet"}${DATA.running ? " · scanning now…" : ""}`;
  tiles(DATA.items);
  render();
  if (DATA.running) setTimeout(load, 15000);
}

for (const id of ["#f-brand", "#f-source", "#f-level", "#f-status"]) $(id).addEventListener("change", render);
load();
