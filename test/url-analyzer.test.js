import test from "node:test";
import assert from "node:assert/strict";
import { analyzeUrl, extractUrls, messageSigns } from "../public/js/url-analyzer.js";

test("flags look-alike brand in subdomain as high risk", () => {
  const r = analyzeUrl("https://www.paypa1-account.com.secure-verify.xyz/signin");
  assert.equal(r.parts.reg, "secure-verify.xyz");
  assert.equal(r.level, "high");
});

test("official government domain is low risk", () => {
  assert.equal(analyzeUrl("https://u.ae/en/information-and-services").level, "low");
  assert.equal(analyzeUrl("https://www.shjpolice.gov.ae/").level, "low");
});

test("fake Sharjah Police domain is flagged", () => {
  assert.equal(analyzeUrl("http://shjpolice-fines.top/pay").level, "high");
});

test("APK download and IP host are high risk", () => {
  assert.equal(analyzeUrl("https://parcel-redelivery.click/download/Tracker.apk").level, "high");
  assert.equal(analyzeUrl("http://185.24.77.10/emiratesnbd/update.php").level, "high");
});

test("invalid input", () => {
  assert.equal(analyzeUrl(""), null);
  assert.equal(analyzeUrl("http://").valid, false);
});

test("extracts links and signs from a message", () => {
  const msg = "Pay the AED 7.50 fee within 12 hours: https://uae-post-track.cfd/pay?id=1.";
  assert.deepEqual(extractUrls(msg), ["https://uae-post-track.cfd/pay?id=1"]);
  assert.ok(messageSigns(msg).includes("Asks for money"));
  assert.ok(messageSigns("ادفع الرسوم عاجل").includes("Urgency or threats"));
});

test("fake Abu Dhabi Police domain is flagged, real one is not", () => {
  assert.equal(analyzeUrl("http://adpolice-fines.top/pay").level, "high");
  assert.equal(analyzeUrl("https://www.adpolice.gov.ae/").level, "low");
});
