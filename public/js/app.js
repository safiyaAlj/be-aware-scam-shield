import { analyzeUrl, extractUrls, SIGNS } from "./url-analyzer.js";
import { t, isAr, LANG, brand, flagTitle, flagDetail } from "./i18n.js";

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

// Logo: remove the slot if the file isn't there yet.
const logo = $(".logo");
if (logo) { logo.addEventListener("error", () => logo.remove()); if (logo.complete && !logo.naturalWidth) logo.remove(); }

/* ---------- tabs ---------- */
const views = { link: "view-link", message: "view-message", quiz: "view-quiz" };
function show(name) {
  if (!views[name]) name = "link";
  for (const k in views) {
    $("#tab-" + k).setAttribute("aria-selected", String(k === name));
    $("#" + views[k]).hidden = k !== name;
  }
  if (name === "quiz") loadGame();
}
for (const k in views) $("#tab-" + k).addEventListener("click", () => { show(k); history.replaceState(null, "", location.pathname + location.search + "#" + k); });
window.addEventListener("hashchange", () => show(location.hash.slice(1)));
show(location.hash.slice(1));

/* ---------- rendering helpers ---------- */
const LEVEL_TEXT = {
  high: [t("Likely a scam"), t("Don't open it. Delete the message.")],
  med: [t("Suspicious"), t("Don't enter details or pay. Go to the official site yourself.")],
  low: [t("No obvious red flags"), t("That doesn't prove it's safe. Stay alert on the page that opens.")]
};
const SEV_TEXT = { high: t("High"), med: t("Medium"), low: t("Low"), good: t("Good sign") };

function verdictBox(score, level, title, sub) {
  const v = el("div", "verdict"); v.dataset.level = level;
  const sc = el("div", "score", String(score)); sc.append(el("small", null, t("Risk")));
  const right = el("div"); right.append(el("div", "vtitle", title), el("p", null, sub));
  const m = el("div", "meter"); const mk = el("i"); mk.style.left = score + "%"; m.append(mk); right.append(m);
  v.append(sc, right); return v;
}
function flagList(flags) {
  const ul = el("ul", "flags");
  for (const f of flags) {
    const li = el("li", "flag"); li.append(el("span", "sev " + f.sev, SEV_TEXT[f.sev] || f.sev));
    const d = el("div"); d.append(el("strong", null, flagTitle(f.title)), el("p", null, flagDetail(f.detail))); li.append(d); ul.append(li);
  }
  return ul;
}
function anatomy(r) {
  const box = el("div", "anatomy"); const line = el("div", "line");
  const seg = (t, c) => { if (t) line.append(el("span", "seg " + c, t)); };
  if (!r.parts) { seg(r.raw, "path bad"); box.append(line); return box; }
  const bad = r.level !== "low";
  seg(r.noScheme ? "" : r.scheme + "://", "scheme");
  if (r.userinfo) seg(r.userinfo + "@", "sub bad");
  seg(r.parts.sub.length ? r.parts.sub.join(".") + "." : "", "sub");
  seg(r.parts.reg, "reg" + (bad ? " bad" : ""));
  seg(r.port ? ":" + r.port : "", "path");
  seg(r.pathAndQuery, "path");
  box.append(line);
  const g = el("p", "goes");
  const reg = el("b", null, r.parts.reg); reg.dir = "ltr";
  if (isAr) {
    if (r.expandedFrom) { const from = el("b", null, r.expandedFrom); from.dir = "ltr"; g.append("الرابط المختصر ", from, " يذهب فعلياً إلى ", reg); }
    else g.append("هذا الرابط يذهب فعلياً إلى ", reg);
  } else {
    if (r.expandedFrom) g.append("Short link ", el("b", null, r.expandedFrom), " really goes to ");
    else g.append("This link really goes to ");
    g.append(reg);
  }
  if (r.official) g.append(" (" + brand(r.official) + ")");
  box.append(g);
  return box;
}
function renderLinkResult(out, r, status) {
  out.replaceChildren();
  const [t, s] = LEVEL_TEXT[r.level];
  out.append(verdictBox(r.score, r.level, t, s));
  if (status) out.append(el("p", "status", status));
  out.append(anatomy(r));
  if (r.flags.length) out.append(flagList(r.flags));
}

/* ---------- link check ---------- */
let linkReq = 0;
async function checkLink() {
  const out = $("#link-result");
  $("#link-ai-out").replaceChildren();
  const raw = $("#url-in").value;
  const local = analyzeUrl(raw);
  if (!local) { out.replaceChildren(el("p", "hint", t("Paste a link above to check it."))); return; }
  if (!local.valid) { out.replaceChildren(el("p", "note", t("That doesn't look like a web address. Paste the full link, for example https://example.com/page."))); return; }

  const id = ++linkReq;
  renderLinkResult(out, local, t("Checking phishing lists…"));
  try {
    const res = await fetch("/api/check-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: raw }) });
    if (id !== linkReq) return;
    if (!res.ok) throw new Error(String(res.status));
    const full = await res.json();
    const sb = full.safeBrowsing, lists = full.phishLists;
    const checked = ["pattern checks", full.model ? "the trained model" : null, lists?.available ? "public phishing lists" : null, sb?.available ? "Google Safe Browsing" : null].filter(Boolean);
    const names = checked.map(t);
    renderLinkResult(out, full, isAr
      ? "تم الفحص باستخدام " + (names.length > 1 ? names.slice(0, -1).join("، ") + " و" + names[names.length - 1] : names[0]) + "."
      : "Checked with " + names.join(", ").replace(/, ([^,]*)$/, " and $1") + ".");
  } catch {
    if (id === linkReq) renderLinkResult(out, local, t("Online checks are unavailable right now. Showing pattern checks only."));
  }
}
$("#link-form").addEventListener("submit", e => { e.preventDefault(); checkLink(); });
document.querySelectorAll("[data-url]").forEach(b => b.addEventListener("click", () => { $("#url-in").value = b.dataset.url; checkLink(); }));

// Prefill from ?url= (used by the browser extension's "Check this link" menu).
const preset = new URLSearchParams(location.search).get("url");
if (preset) { $("#url-in").value = preset.slice(0, 2048); show("link"); }
checkLink();

/* ---------- AI ---------- */
const AI_LEVEL = { scam: ["high", t("Likely a scam")], suspicious: ["med", t("Suspicious")], likely_safe: ["low", t("Probably legitimate")] };
const ERRORS = {
  rate_limited: t("Too many checks just now. Please wait a minute and try again."),
  refused: t("This text couldn't be analyzed. Try removing personal details or shortening it."),
  image_rejected: t("That screenshot couldn't be used. Try a PNG or JPG under 5 MB."),
  empty: t("Paste a message or add a screenshot first."),
  needs_text: t("Screenshots can't be read at the moment. Please paste the text of the message instead.")
};

// Without an AI service the server uses a free on-site model that reads text only.
fetch("/api/config").then(r => r.json()).then(cfg => {
  if (cfg.engine !== "local") return;
  document.querySelector("#view-link .ai")?.setAttribute("hidden", "");
  $(".drop")?.setAttribute("hidden", "");
  $("#msg-ai-btn").textContent = t("Check message");
}).catch(() => {});

function renderAI(box, d) {
  box.replaceChildren();
  const local = d.engine === "local";
  const [lvl, title] = AI_LEVEL[d.verdict] || AI_LEVEL.suspicious;
  box.append(verdictBox(d.risk, lvl, title + (d.scam_type ? " · " + d.scam_type : ""), local ? t("Automatic check") : t("AI assessment")));
  const p = el("p", "sum", d.summary); p.dir = "auto"; box.append(p);
  if (d.red_flags?.length) {
    box.append(el("h3", null, t("Red flags")));
    const ul = el("ul", "flags");
    for (const f of d.red_flags.slice(0, 6)) {
      const li = el("li", "flag"); li.append(el("span", "sev high", t("Flag")));
      const dv = el("div"); dv.dir = "auto";
      if (f.quote) dv.append(el("span", "quote", "“" + f.quote + "”"));
      dv.append(el("p", null, f.why)); li.append(dv); ul.append(li);
    }
    box.append(ul);
  }
  if (d.reassuring_signs?.length) {
    box.append(el("h3", null, t("Reassuring signs")));
    const ul = el("ul", "steps"); ul.dir = "auto"; d.reassuring_signs.slice(0, 4).forEach(g => ul.append(el("li", null, g))); box.append(ul);
  }
  if (d.next_steps?.length) {
    box.append(el("h3", null, t("What to do")));
    const ol = el("ol", "steps"); ol.dir = "auto"; d.next_steps.slice(0, 5).forEach(g => ol.append(el("li", null, g))); box.append(ol);
  }
  box.append(el("p", "note", (local ? t("This automatic check can be wrong, especially with new kinds of scams.") : t("AI can be wrong.")) + t(" If money or personal details are involved, contact the organization through its official app, website or phone number, or call the police on 901.")));
}
async function runAI(btn, box, body) {
  btn.disabled = true; const label = btn.textContent; btn.textContent = t("Analyzing…");
  box.replaceChildren(el("p", "thinking", t("Reading it now. This usually takes 10 to 30 seconds.")));
  try {
    const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw data;
    renderAI(box, data.analysis);
  } catch (e) {
    box.replaceChildren(el("p", "note", ERRORS[e?.error] || t("The AI check isn't available right now. The pattern checks above still work, or call 901 for advice.")));
  } finally { btn.disabled = false; btn.textContent = label; }
}
$("#link-ai-btn").addEventListener("click", () => {
  const raw = $("#url-in").value.trim();
  if (!raw) return;
  runAI($("#link-ai-btn"), $("#link-ai-out"), { text: "Is this link safe to open?\n" + raw });
});

/* ---------- message ---------- */
if (isAr && $("#msg-in").value.startsWith("PARCEL NOTICE")) $("#msg-in").value = "إشعار طرد: شحنتك متوقفة بسبب رسوم جمركية غير مدفوعة (7.50 درهم). ادفع خلال 12 ساعة لتجنب إعادتها إلى المرسل: https://uae-post-track.cfd/pay?id=AE2291";
function quickScan() {
  const t = $("#msg-in").value;
  const tags = $("#qs-tags"); tags.replaceChildren();
  for (const [name, re] of SIGNS) { const on = re.test(t); tags.append(el("span", "tag" + (on ? " on" : ""), (on ? "● " : "○ ") + t(name))); }
  const box = $("#qs-links"); box.replaceChildren();
  const urls = extractUrls(t);
  if (urls.length) box.append(el("p", "hint", t("Links in this message")));
  for (const raw of urls) {
    const r = analyzeUrl(raw); if (!r || !r.valid) continue;
    const row = el("div", "mini-item"); row.title = raw;
    row.append(el("span", null, r.parts ? r.parts.reg : raw), el("span", "sev " + r.level, LEVEL_TEXT[r.level][0] + " · " + r.score));
    box.append(row);
  }
}
$("#msg-in").addEventListener("input", quickScan);
quickScan();

let shot = null;
const fileToBase64 = f => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(",")[1]);
  r.onerror = reject; r.readAsDataURL(f);
});
$("#img-in").addEventListener("change", e => {
  shot = e.target.files?.[0] || null;
  if (shot && shot.size > 5 * 1024 * 1024) { shot = null; $("#img-in").value = ""; $("#img-name").textContent = t("That image is over 5 MB. Try a smaller screenshot."); return; }
  $("#img-name").textContent = shot ? shot.name : t("No screenshot added");
  $("#img-clear").hidden = !shot;
});
$("#img-clear").addEventListener("click", () => { shot = null; $("#img-in").value = ""; $("#img-name").textContent = t("No screenshot added"); $("#img-clear").hidden = true; });

$("#msg-form").addEventListener("submit", async e => {
  e.preventDefault();
  const text = $("#msg-in").value.trim();
  if (!text && !shot) { $("#msg-ai-out").replaceChildren(el("p", "note", ERRORS.empty)); return; }
  const body = { text };
  if (isAr) body.lang = "ar"; // explain in Arabic even when the message is in English
  if (shot) body.image = { mediaType: shot.type, data: await fileToBase64(shot) };
  runAI($("#msg-ai-btn"), $("#msg-ai-out"), body);
});

/* ---------- challenge (game) ---------- */
// The game page is about 4 MB, so it only loads the first time its tab is opened.
function loadGame() {
  const f = $("#game-frame");
  if (f && !f.getAttribute("src")) f.setAttribute("src", f.dataset.src);
}
