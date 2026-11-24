import test from "node:test";
import assert from "node:assert/strict";

process.env.WATCH = "off";
process.env.DOMAIN_AGE = "off";
const { impersonatedBrand, watchItems } = await import("../src/brand-watch.js");
const { ageFlag } = await import("../src/domain-age.js");
watchItems(); // builds the watched-brand tables

test("watch catches UAE look-alike registrations", () => {
  assert.equal(impersonatedBrand("salik.sbs"), "Salik");
  assert.equal(impersonatedBrand("dubai-rta.cfd"), "RTA");
  assert.equal(impersonatedBrand("aramexltd.com"), "Aramex");
  assert.equal(impersonatedBrand("du-ae.lol"), "du");
  assert.equal(impersonatedBrand("adpolice-fines.top"), "Abu Dhabi Police");
});

test("watch ignores brand names inside ordinary words and unrelated sites", () => {
  assert.equal(impersonatedBrand("friendsalikegroup.com"), null);
  assert.equal(impersonatedBrand("elguadalajaramexican.com"), null);
  assert.equal(impersonatedBrand("careernestacademy.com"), null);
  assert.equal(impersonatedBrand("7college.du.ac.bd"), null);
  assert.equal(impersonatedBrand("studio-noon.kr"), null);
});

test("official sites are never on the watch", () => {
  assert.equal(impersonatedBrand("salik.ae"), null);
  assert.equal(impersonatedBrand("adpolice.gov.ae"), null);
  assert.equal(impersonatedBrand("emiratesnbd.bank.in"), null);
});

test("young websites get a warning, old ones don't", () => {
  assert.equal(ageFlag({ domain: "x.top", ageDays: 2 }).sev, "high");
  assert.equal(ageFlag({ domain: "x.top", ageDays: 20 }).sev, "med");
  assert.equal(ageFlag({ domain: "x.com", ageDays: 2000 }), null);
  assert.equal(ageFlag({ domain: "x.ae", ageDays: null }), null); // unknown age: no guess
});
