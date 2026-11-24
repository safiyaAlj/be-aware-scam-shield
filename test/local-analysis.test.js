import test from "node:test";
import assert from "node:assert/strict";
import { analyzeUrl, extractUrls, messageSigns } from "../public/js/url-analyzer.js";
import { tokenize, normalizeToken } from "../src/local-model/features.js";
import { classify } from "../src/local-model/classifier.js";
import { analyzeLocally } from "../src/local-analysis.js";

// Same inputs the server builds, but with offline link checks (no network in tests).
const run = text => analyzeLocally({
  text,
  signs: messageSigns(text),
  links: extractUrls(text).map(u => analyzeUrl(u)).filter(r => r && r.valid)
});

test("Arabic normalization unifies letter variants and digits", () => {
  assert.equal(normalizeToken("إشعار"), normalizeToken("اشعار"));
  assert.equal(normalizeToken("مخالفة"), "مخالفه");
  assert.equal(normalizeToken("١٢٣"), "__num__");
});

test("links and phone numbers become placeholders", () => {
  const norms = tokenize("Call +971 55 123 4567 or open http://x.top/pay").map(t => t.norm);
  assert.ok(norms.includes("__phone__"));
  assert.ok(norms.includes("__url__"));
});

test("classifier scores a fake delivery fee higher than a chat message", () => {
  const scam = classify("Your package is on hold. Pay the customs fee of AED 9 today to avoid return");
  const chat = classify("Are we still meeting for lunch tomorrow? I'll book a table");
  assert.ok(scam.probability > 0.5, `scam probability ${scam.probability}`);
  assert.ok(chat.probability < 0.5, `chat probability ${chat.probability}`);
});

test("English delivery scam with a bad link is flagged as a scam", async () => {
  const r = await run("PARCEL NOTICE: Your package is on hold due to an unpaid customs fee (AED 7.50). Pay within 12 hours to avoid return to sender: https://uae-post-track.cfd/pay?id=AE2291");
  assert.equal(r.verdict, "scam");
  assert.equal(r.engine, "local");
  assert.ok(r.red_flags.length > 0);
  assert.match(r.next_steps.join(" "), /901/);
});

test("Arabic fake police fine is flagged and answered in Arabic", async () => {
  const r = await run("شرطة الشارقة: لديك مخالفة غير مدفوعة بقيمة 3000 درهم. ادفع فوراً لتجنب القبض عليك");
  assert.notEqual(r.verdict, "likely_safe");
  assert.match(r.summary, /[؀-ۿ]/);
});

test("ordinary personal message is not flagged", async () => {
  const r = await run("Hi, can you pick up the kids from school today? I'm stuck at work until 6.");
  assert.equal(r.verdict, "likely_safe");
});

test("result has the same fields as the AI result", async () => {
  const r = await run("Congratulations, you won a prize! Send your card number to claim.");
  for (const k of ["verdict", "risk", "scam_type", "summary", "red_flags", "reassuring_signs", "next_steps"]) assert.ok(k in r, k);
  assert.ok(r.risk >= 0 && r.risk <= 100);
});

test("screenshot without text needs the AI", async () => {
  await assert.rejects(analyzeLocally({ text: "", image: { mediaType: "image/png", data: "x" } }), e => e.code === "needs_text");
});
