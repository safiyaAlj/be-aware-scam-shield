// Shared link and message heuristics.
// This one file is used by the website (browser), the server (Node.js) and the
// browser extension (copied in by `npm run build:extension`). It has no
// dependencies and makes no network requests.

const TWO_PART = new Set(["co.uk","org.uk","ac.uk","gov.uk","com.au","net.au","org.au","co.in","com.sa","gov.sa","com.eg","co.ae","net.ae","org.ae","gov.ae","ac.ae","sch.ae","mil.ae","com.qa","gov.qa","com.kw","com.bh","com.om","co.jp","com.br","com.tr","com.pk",
  "bank.in","fin.in","gov.in","ac.in","edu.in","net.in","org.in","edu.au","gov.au","edu.sa","net.sa","org.sa","com.kw","edu.eg","gov.eg",
  "co.za","com.sg","com.my","com.hk","com.cn","co.id","ac.id","sch.id","my.id","co.kr","com.mx","com.ng","com.ph","com.vn","edu.pk","gov.pk"]);
const RISKY_TLD = new Set(["top","xyz","click","link","live","shop","online","site","icu","buzz","rest","cfd","sbs","cyou","monster","quest","zip","mov","tk","ml","ga","cf","gq","work","support","country","cam","bond","lol","vip","win","loan","info"]);
export const SHORTENERS = new Set(["bit.ly","tinyurl.com","t.co","goo.gl","ow.ly","is.gd","cutt.ly","rb.gy","shorturl.at","t.ly","s.id","tiny.cc","rebrand.ly","bit.do","lnkd.in","shorturl.gg"]);

// [display name, key to look for, official registrable domains]
// Add organisations that scammers impersonate locally. Keys under 5 letters
// are only matched as whole words to avoid false alarms.
const BRANDS = [
  ["Abu Dhabi Police","adpolice",["adpolice.gov.ae"]],["Abu Dhabi Police","abudhabipolice",["adpolice.gov.ae"]],
  ["Dubai Police","dubaipolice",["dubaipolice.gov.ae"]],["Ministry of Interior","moi",["moi.gov.ae"]],
  ["Sharjah Police","shjpolice",["shjpolice.gov.ae"]],["Sharjah Police","sharjahpolice",["shjpolice.gov.ae"]],
  ["PayPal","paypal",["paypal.com"]],["Apple","apple",["apple.com","icloud.com"]],["Microsoft","microsoft",["microsoft.com","live.com","office.com"]],
  ["Google","google",["google.com","google.ae"]],["Amazon","amazon",["amazon.com","amazon.ae"]],["Netflix","netflix",["netflix.com"]],
  ["Facebook","facebook",["facebook.com"]],["Instagram","instagram",["instagram.com"]],["WhatsApp","whatsapp",["whatsapp.com"]],
  ["LinkedIn","linkedin",["linkedin.com"]],["DHL","dhl",["dhl.com"]],["FedEx","fedex",["fedex.com"]],["Aramex","aramex",["aramex.com"]],
  ["Emirates Post","emiratespost",["emiratespost.ae"]],["etisalat by e&","etisalat",["etisalat.ae","eand.com"]],["Emirates NBD","emiratesnbd",["emiratesnbd.com","emiratesnbd.bank.in"]],
  ["Mashreq","mashreq",["mashreq.com"]],["FAB","bankfab",["bankfab.com"]],["ADCB","adcb",["adcb.com"]],["DEWA","dewa",["dewa.gov.ae"]],["SEWA","sewa",["sewa.gov.ae"]],
  ["UAE PASS","uaepass",["uaepass.ae"]],["Binance","binance",["binance.com"]],["noon","noon",["noon.com"]],["Careem","careem",["careem.com"]],["talabat","talabat",["talabat.com"]],
  ["Salik","salik",["salik.ae"]],["RTA","rta",["rta.ae"]],["TAMM","tamm",["tamm.abudhabi","abudhabi.ae"]],["ICP","icp",["icp.gov.ae"]],
  ["ADIB","adib",["adib.ae","adib.com"]],["Dubai Islamic Bank","dib",["dib.ae"]],["RAKBANK","rakbank",["rakbank.ae"]],["du","du",["du.ae"]],
  ["ADDC","addc",["addc.ae"]],["Etihad","etihad",["etihad.com"]],
  ["Carrefour","carrefour",["carrefouruae.com","mafcarrefour.com","carrefour.com","carrefour.fr","carrefour.es","carrefour.it","carrefour.be","carrefour.pl","carrefour.ro","carrefour.com.br","carrefour.com.ar","carrefour.com.tw","carrefourksa.com","carrefouregypt.com","carrefourjordan.com","carrefourqatar.com","carrefourkuwait.com","carrefourbahrain.com","carrefouroman.com","carrefourpakistan.com","carrefourkenya.com"]],["SHARE rewards","sharerewards",["sharerewards.com"]],
  ["LuLu Hypermarket","luluhypermarket",["luluhypermarket.com","luluretail.com","lulugroupinternational.com","luluexchange.com","lulumoney.app","lulumall.in"]],["LuLu","lulu",["luluhypermarket.com","luluretail.com","lulugroupinternational.com","luluexchange.com","lulumoney.app","lulumall.in"]]
];
const KEYWORDS = ["login","signin","verify","secure","update","account","confirm","wallet","bank","pay","fine","refund","prize","gift","otp","unlock","suspend","customs","redeliver","claim","reward"];

function splitHost(host) {
  const parts = host.split(".");
  if (parts.length < 2) return { sub: [], reg: host, label: host, tld: "" };
  const n = (TWO_PART.has(parts.slice(-2).join(".")) && parts.length >= 3) ? 3 : 2;
  return { sub: parts.slice(0, -n), reg: parts.slice(-n).join("."), label: parts[parts.length - n], tld: parts[parts.length - 1] };
}
function normalize(s) {
  return s.toLowerCase().replace(/rn/g, "m").replace(/vv/g, "w").replace(/0/g, "o").replace(/1/g, "l")
    .replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t").replace(/\$/g, "s");
}
function lev(a, b) {
  const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

/**
 * Analyse a URL string. Returns a plain, JSON-serialisable object:
 * { valid, raw, href, host, parts:{sub,reg,label,tld}, scheme, userinfo, port,
 *   pathAndQuery, noScheme, official, flags:[{sev,title,detail,pts}], score, level }
 * or null for empty input, or { valid:false, raw } when it cannot be parsed.
 */
export function analyzeUrl(raw) {
  const flags = [];
  let s = (raw || "").trim();
  if (!s) return null;
  const add = (sev, title, detail, pts) => flags.push({ sev, title, detail, pts });

  if (/^(javascript|data|vbscript):/i.test(s)) {
    add("high", "Runs code instead of opening a page", "Links starting with javascript: or data: can run code in your browser.", 60);
    return finish({ valid: true, raw: s, href: s, host: "", parts: null, flags });
  }
  let noScheme = false;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) { s = "http://" + s; noScheme = true; }
  let u;
  try { u = new URL(s); } catch { return { valid: false, raw }; }

  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  const isIP = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[");
  const parts = isIP ? { sub: [], reg: host, label: host, tld: "" } : splitHost(host);
  const ctx = {
    valid: true, raw: raw.trim(), href: u.href, host, parts, noScheme, official: null, flags,
    scheme: u.protocol.replace(":", ""), userinfo: u.username ? u.username + (u.password ? ":" + u.password : "") : "",
    port: u.port, pathAndQuery: (u.pathname === "/" ? "" : u.pathname) + u.search
  };

  if (u.protocol === "http:" && !noScheme) add("med", "Not encrypted", "The link uses http, not https. Real payment and login pages always use https.", 12);
  if (u.protocol === "https:") add("good", "Uses https", "The connection is encrypted. Scam sites use https too, so this alone proves nothing.", 0);
  if (isIP) add("high", "Uses a bare IP address", "Real organisations use a named website, not a string of numbers.", 40);
  if (host.includes("xn--")) add("high", "Contains look-alike characters", "The address uses foreign letters that can look identical to English ones (for example Cyrillic а instead of a).", 30);
  if (u.username || u.password || /^[^/]*@/.test(s.replace(/^[a-z]+:\/\//i, ""))) add("high", "Hides the real destination", "Everything before the @ is ignored by the browser. The real site comes after it.", 30);
  if (u.port && !["80", "443"].includes(u.port)) add("med", "Unusual port number", "The :" + u.port + " in the address is rare for real websites.", 10);
  if (SHORTENERS.has(host)) add("med", "Shortened link", "Short links hide where they lead. Check where it really goes before opening it.", 18);
  if (parts.tld && RISKY_TLD.has(parts.tld)) add("med", "Domain ending often used in scams", "Addresses ending in ." + parts.tld + " are cheap and common in phishing campaigns.", 15);
  if (parts.sub.length >= 3) add("low", "Many subdomains", "Long chains of words before the real domain are used to bury it out of sight.", 8);
  if ((parts.label.match(/-/g) || []).length >= 2) add("low", "Many hyphens in the domain", "Names like secure-login-update are a common phishing pattern.", 8);
  if (/\.(apk|exe|scr|msi|bat|apks|xapk)(\?|$)/i.test(u.pathname)) add("high", "Downloads an app file", "This link installs software. Fake APK apps can read your SMS codes and drain bank accounts. Only install apps from the official app store.", 45);
  if (s.length > 110) add("low", "Very long link", "Long links can hide the real address in the noise.", 5);
  if (parts.reg.endsWith(".gov.ae") || parts.reg === "u.ae") add("good", "UAE government domain", parts.reg + " is a government address. Still type it yourself rather than following links in messages.", -25);

  if (isIP) {
    const normPath = normalize(u.pathname);
    const b = BRANDS.find(([, key]) => key.length >= 4 && normPath.includes(key));
    if (b) add("high", "Pretends to be " + b[0], "The link names " + b[0] + " but points to a bare server address that " + b[0] + " would never use.", 25);
  } else {
    const normHost = normalize(host);
    const tokens = normHost.split(/[.\-_]/).filter(Boolean);
    const labelTokens = normalize(parts.label).split(/[\-_]/).filter(Boolean);
    let hits = 0;
    for (const [name, key, domains] of BRANDS) {
      if (hits >= 2) break;
      if (domains.includes(parts.reg)) { if (!ctx.official) { ctx.official = name; add("good", "Official " + name + " domain", parts.reg + " belongs to " + name + ".", -30); hits++; } continue; }
      const inHost = key.length >= 5 ? normHost.includes(key) : tokens.includes(key);
      if (inHost) {
        const disguised = !host.includes(key);
        add("high", (disguised ? "Look-alike spelling of " : "Pretends to be ") + name,
          (disguised ? "The address imitates \"" + key + "\" by swapping letters for numbers or similar shapes. " : "") +
          "It mentions " + name + " but the real site is " + parts.reg + ", which " + name + " doesn't own.", 35);
        hits++; continue;
      }
      if (key.length >= 5) {
        const near = labelTokens.find(t => t.length >= 4 && t !== key && lev(t, key) <= (key.length >= 7 ? 2 : 1));
        if (near) { add("high", "Misspelled " + name, "\"" + near + "\" is one or two letters away from \"" + key + "\". This is called typosquatting.", 35); hits++; continue; }
        if (normalize(u.pathname + u.search).includes(key)) { add("med", "Mentions " + name + " but goes elsewhere", "The rest of the link names " + name + ", but the site is " + parts.reg + ", which " + name + " doesn't own.", 20); hits++; }
      }
    }
  }
  const lower = (u.hostname + u.pathname).toLowerCase();
  const kw = KEYWORDS.filter(k => lower.includes(k));
  if (kw.length && !ctx.official) add("low", "Bait words in the link", "Contains: " + kw.slice(0, 5).join(", ") + ". Scam links lean on words about accounts, payments and urgency.", Math.min(15, kw.length * 5));
  return finish(ctx);
}

export function finish(ctx) {
  const score = Math.max(0, Math.min(100, ctx.flags.reduce((a, f) => a + f.pts, 0)));
  const order = { high: 0, med: 1, low: 2, good: 3 };
  ctx.flags.sort((a, b) => order[a.sev] - order[b.sev]);
  ctx.score = score;
  ctx.level = score >= 60 ? "high" : score >= 30 ? "med" : "low";
  return ctx;
}

/* ---------- message signals ---------- */
export const SIGNS = [
  ["Urgency or threats", /urgent|immediately|within \d+ ?(h|hour|hours|min)|24 ?h|final (notice|warning)|suspend|blocked|deactivat|arrest|legal action|expire|last chance|عاجل|فور|خلال \d+|إيقاف|حظر|القبض/i],
  ["Asks for codes or passwords", /\botp\b|one[- ]time|verification code|\bpin\b|cvv|password|passcode|6[- ]digit|security code|رمز|كلمة (المرور|السر)/i],
  ["Asks for money", /\bpay\b|payment|\bfee\b|\bfine\b|aed ?\d|\d ?aed|dhs|transfer|gift ?card|deposit|crypto|bitcoin|usdt|درهم|ادفع|دفع|رسوم|مخالفة|تحويل/i],
  ["Prize or easy money", /congratulat|you (have )?won|winner|prize|lottery|draw|reward|bonus|earn \d|daily (income|salary)|part[- ]time|مبروك|ربحت|جائزة|سحب|ربح/i],
  ["Claims to be an authority", /police|ministry|customs|court|government|immigration|\bbank\b|emirates id|visa|شرطة|وزارة|جمارك|محكمة|بنك|الهوية/i],
  ["Delivery story", /parcel|package|shipment|delivery|courier|redeliver|tracking|طرد|شحنة|توصيل/i],
  ["Personal details requested", /emirates id copy|passport copy|id copy|card number|date of birth|bank details|iban|صورة (الهوية|الجواز)|رقم البطاقة/i]
];
export function messageSigns(text) {
  return SIGNS.filter(([, re]) => re.test(text || "")).map(([name]) => name);
}

const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"')]+|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:top|xyz|click|link|live|shop|online|site|icu|cfd|sbs|cyou|info|com|net|org|ae|ly|co|me|io)\/[^\s<>"')]*)/gi;
export function extractUrls(text, max = 5) {
  return [...new Set(((text || "").match(URL_RE) || []).map(x => x.replace(/[.,;:!?]+$/, "")))].slice(0, max);
}
