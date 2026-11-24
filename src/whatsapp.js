// WhatsApp bot using the WhatsApp Business Platform (Cloud API).
// People send a link, a message, or a screenshot to the كن واعياً WhatsApp number
// and get a verdict back. Setup: the WHATSAPP_* values in .env (see README).

import crypto from "node:crypto";
import express from "express";
import { extractUrls, messageSigns } from "../public/js/url-analyzer.js";
import { checkLinkCached as checkLink } from "./check-link.js";
import { analyze, analysisEngine } from "./analyze.js";

const API_VERSION = process.env.WHATSAPP_API_VERSION || "v23.0";
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;
const seen = new Set(); // message ids already handled (WhatsApp may resend)

const T = {
  en: {
    welcome: "👋 Welcome to *كن واعياً (Be Aware) Scam Check*.\n\nForward me a suspicious *message*, paste a *link*, or send a *screenshot*, and I'll tell you if it looks like a scam.\n\n_Never send passwords, PINs or OTP codes._",
    working: "🔎 Checking… this takes a few seconds.",
    high: "🔴 *Likely a scam*", med: "🟠 *Suspicious*", low: "🟢 *No obvious warning signs*",
    risk: "Risk", type: "Type", flags: "Red flags", steps: "What to do", goesTo: "Really goes to",
    lowNote: "That doesn't guarantee it's safe. Open the organisation's official app or website yourself instead of the link.",
    footer: "Questions or want to report a scam? Call the police on *901* (non-emergency). Emergency: *999*.",
    error: "Sorry, I couldn't check that right now. Please try again in a few minutes, or call *901* for advice.",
    unsupported: "Please send text, a link, or a screenshot image.",
    needsText: "I can't read screenshots at the moment. Please copy and paste the text of the message instead."
  },
  ar: {
    welcome: "👋 مرحباً بك في خدمة *كن واعياً للتحقق من الاحتيال*.\n\nأرسل لي *رسالة* مشبوهة أو *رابطاً* أو *صورة شاشة*، وسأخبرك إن كانت تبدو احتيالاً.\n\n_لا ترسل أبداً كلمات المرور أو الرقم السري أو رموز التحقق._",
    working: "🔎 جارٍ التحقق… يستغرق ذلك بضع ثوانٍ.",
    high: "🔴 *على الأرجح احتيال*", med: "🟠 *مشبوه*", low: "🟢 *لا توجد علامات تحذير واضحة*",
    risk: "درجة الخطورة", type: "النوع", flags: "علامات التحذير", steps: "ماذا تفعل", goesTo: "الوجهة الحقيقية",
    lowNote: "هذا لا يضمن أنه آمن. افتح التطبيق أو الموقع الرسمي للجهة بنفسك بدلاً من الرابط.",
    footer: "لديك استفسار أو تريد الإبلاغ عن احتيال؟ اتصل بالشرطة على *901* (لغير الطوارئ). للطوارئ: *999*.",
    error: "عذراً، لم أتمكن من التحقق الآن. يرجى المحاولة بعد دقائق، أو الاتصال على *901* للاستشارة.",
    unsupported: "يرجى إرسال نص أو رابط أو صورة شاشة.",
    needsText: "لا يمكنني قراءة صور الشاشة حالياً. يرجى نسخ نص الرسالة ولصقه بدلاً من ذلك."
  }
};
const langOf = text => /[؀-ۿ]/.test(text || "") ? "ar" : "en";
const LEVEL = { scam: "high", suspicious: "med", likely_safe: "low" };

function validSignature(req) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  const header = req.get("x-hub-signature-256") || "";
  if (!secret || !req.rawBody || !header.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(req.rawBody).digest("hex");
  const a = Buffer.from(header.slice(7)), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function graph(path, init = {}) {
  const res = await fetch(`${GRAPH}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json", ...(init.headers || {}) },
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error(`Graph API ${res.status}`);
  return res;
}

async function send(to, body) {
  await graph(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: body.slice(0, 4000), preview_url: false } })
  });
}

async function downloadImage(mediaId) {
  const meta = await (await graph(mediaId)).json();
  const res = await fetch(meta.url, { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`media ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 5 * 1024 * 1024) throw new Error("image too large");
  return { mediaType: meta.mime_type?.split(";")[0] || "image/jpeg", data: buf.toString("base64") };
}

// Defang links so WhatsApp doesn't make them tappable in our reply.
const defang = s => String(s).replace(/\./g, "[.]").replace(/^http/i, "hxxp");

function formatLink(r, t) {
  const lines = [`${t[r.level]} · ${t.risk} ${r.score}/100`, `${t.goesTo}: ${defang(r.parts?.reg || r.host)}`, ""];
  for (const f of r.flags.filter(f => f.sev !== "good").slice(0, 4)) lines.push(`• *${f.title}*: ${f.detail}`);
  if (r.level === "low") lines.push(t.lowNote);
  return lines.join("\n");
}

function formatAI(d, t) {
  const lines = [`${t[LEVEL[d.verdict] || "med"]} · ${t.risk} ${d.risk}/100`];
  if (d.scam_type) lines.push(`${t.type}: ${d.scam_type}`);
  lines.push("", d.summary);
  if (d.red_flags?.length) {
    lines.push("", `*${t.flags}*`);
    for (const f of d.red_flags.slice(0, 5)) lines.push(`• "${defang(f.quote)}": ${f.why}`);
  }
  if (d.next_steps?.length) {
    lines.push("", `*${t.steps}*`);
    d.next_steps.slice(0, 4).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  }
  return lines.join("\n");
}

async function handleMessage(msg) {
  if (seen.has(msg.id)) return;
  seen.add(msg.id); if (seen.size > 10000) seen.clear();
  const from = msg.from;
  const text = msg.type === "text" ? msg.text?.body || "" : msg.image?.caption || "";
  const t = T[langOf(text)];

  try {
    if (msg.type !== "text" && msg.type !== "image") return send(from, `${t.unsupported}\n\n${t.footer}`);
    const trimmed = text.trim();
    if (msg.type === "text" && (trimmed.length < 25 && !extractUrls(trimmed).length)) return send(from, `${t.welcome}\n\n${t.footer}`);

    const urls = extractUrls(text);
    const links = (await Promise.all(urls.map(u => checkLink(u)))).filter(r => r && r.valid);

    // A bare link: answer from the link checks alone (fast, no AI cost).
    if (msg.type === "text" && urls.length === 1 && links.length === 1 && trimmed.replace(/[\s<>]/g, "") === urls[0]) {
      return send(from, `${formatLink(links[0], t)}\n\n${t.footer}`);
    }

    // The free local check can't read screenshots, only text.
    if (analysisEngine() === "local" && !trimmed) return send(from, `${t.needsText}\n\n${t.footer}`);

    await send(from, t.working);
    const image = msg.type === "image" && analysisEngine() === "claude" ? await downloadImage(msg.image.id) : undefined;
    const result = await analyze({ text, image, signs: messageSigns(text), links });
    await send(from, `${formatAI(result, t)}\n\n${t.footer}`);
  } catch (err) {
    console.error("whatsapp: failed to handle message:", err.code || err.message); // never log message content
    try { await send(from, t.error); } catch { /* ignore */ }
  }
}

export function whatsappRouter() {
  const router = express.Router();

  // Webhook verification (Meta calls this once when you save the webhook URL).
  router.get("/", (req, res) => {
    if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === process.env.WHATSAPP_VERIFY_TOKEN) {
      return res.status(200).send(String(req.query["hub.challenge"]));
    }
    res.sendStatus(403);
  });

  // Incoming messages.
  router.post("/", (req, res) => {
    if (!validSignature(req)) return res.sendStatus(401);
    res.sendStatus(200); // acknowledge immediately; Meta retries slow webhooks
    for (const entry of req.body?.entry || []) {
      for (const change of entry.changes || []) {
        for (const msg of change.value?.messages || []) handleMessage(msg);
      }
    }
  });
  return router;
}
