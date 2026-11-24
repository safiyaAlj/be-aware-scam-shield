import test from "node:test";
import assert from "node:assert/strict";
import { hostOf, hostFeatures } from "../src/local-model/url-features.js";
import { phishingProbability } from "../src/local-model/url-classifier.js";
import { lookupPhishLists, normalizeUrl, _loadForTest } from "../src/phish-lists.js";
import { checkLink } from "../src/check-link.js";

delete process.env.GOOGLE_SAFE_BROWSING_KEY; // keep tests offline

test("hostOf strips scheme, www, port and path", () => {
  assert.equal(hostOf("https://WWW.Example.com:8443/a/b?c=1"), "example.com");
  assert.equal(hostOf("adpolice.gov.ae"), "adpolice.gov.ae");
  assert.equal(hostOf("not a url"), null);
});

test("features are stable and within the hash table", () => {
  const a = hostFeatures("adcb-verify.site"), b = hostFeatures("adcb-verify.site");
  assert.deepEqual(a, b);
  assert.ok(a.every(i => Number.isInteger(i) && i >= 0 && i < 2 ** 18));
});

test("model rates UAE look-alikes above genuine UAE sites", () => {
  for (const bad of ["emiratesnbd-secure-login.online", "salik-ae-topup.shop", "uaepass-login.top"]) {
    assert.ok(phishingProbability(bad) >= 0.7, `${bad} = ${phishingProbability(bad)}`);
  }
  for (const good of ["u.ae", "adpolice.gov.ae", "emiratesnbd.com", "aramex.com", "en.wikipedia.org"]) {
    assert.ok(phishingProbability(good) < 0.5, `${good} = ${phishingProbability(good)}`);
  }
});

test("phishing list matches exact addresses and listed domains", () => {
  _loadForTest({ urls: ["https://evil-page.example.top/login/"], domains: ["bad-domain.xyz", "docs.google.com"] });
  assert.equal(normalizeUrl("http://www.Evil-Page.example.top/login"), "evil-page.example.top/login");
  assert.equal(lookupPhishLists("http://evil-page.example.top/login", "evil-page.example.top").listed, true);
  assert.equal(lookupPhishLists("https://bad-domain.xyz/anything", "bad-domain.xyz").listed, true);
  assert.equal(lookupPhishLists("https://shop.bad-domain.xyz/", "shop.bad-domain.xyz").listed, true);
  assert.equal(lookupPhishLists("https://fine.example.com/", "fine.example.com").listed, false);
});

test("shared and official sites are never flagged by domain alone", () => {
  _loadForTest({ urls: ["https://docs.google.com/forms/d/scam123/viewform"], domains: ["docs.google.com", "sites.google.com"] });
  assert.equal(lookupPhishLists("https://docs.google.com/document/d/abc", "docs.google.com", true).listed, false);
  assert.equal(lookupPhishLists("https://sites.google.com/view/school", "sites.google.com").listed, false);
  // The exact reported page still counts.
  assert.equal(lookupPhishLists("https://docs.google.com/forms/d/scam123/viewform", "docs.google.com", true).listed, true);
});

test("full link check: listed site is high risk", async () => {
  _loadForTest({ urls: [], domains: ["parcel-uae-fee.xyz"] });
  const r = await checkLink("https://parcel-uae-fee.xyz/pay");
  assert.equal(r.level, "high");
  assert.equal(r.phishLists.listed, true);
  assert.match(r.flags[0].title, /known phishing/);
});

test("full link check: official site stays low risk", async () => {
  _loadForTest({ urls: [], domains: [] });
  const r = await checkLink("https://www.adpolice.gov.ae/en/services");
  assert.equal(r.level, "low");
  assert.equal(r.model, null); // official domains skip the model
});
