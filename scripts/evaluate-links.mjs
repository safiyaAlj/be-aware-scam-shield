// Measures the link checker on fresh data it was not trained on, and writes docs/EVALUATION.md.
//
//   npm run evaluate
//
// Phishing set: the live OpenPhish feed in data/feeds/openphish.txt (start the server once to
//   download it), minus any website whose name is in the training data.
// Genuine set: data/eval/uae-legit-hosts.txt (real UAE websites), minus any in the training data.
//
// It reports two things:
//   1. The website-name model alone.
//   2. The full check WITHOUT the phishing lists and without network lookups: rules + model.
//      This is how the system does on a brand-new scam site that nobody has reported yet.
// (With the lists, every phishing address here is caught by definition, since they come from a list.)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.DOMAIN_AGE = "off";            // offline: no registry lookups
delete process.env.GOOGLE_SAFE_BROWSING_KEY;

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { hostOf, registrableOf } = await import("../src/local-model/url-features.js");
const { phishingProbability } = await import("../src/local-model/url-classifier.js");
const { _loadForTest } = await import("../src/phish-lists.js");
const { checkLink } = await import("../src/check-link.js");
_loadForTest({ urls: [], domains: [] }); // lists empty: measure rules + model only

const read = f => fs.readFileSync(path.join(root, f), "utf8").split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith("#"));

// Everything the model learned from.
const trained = new Set();
for (const f of fs.readdirSync(path.join(root, "data", "urls")).filter(f => f.endsWith(".tsv"))) {
  for (const line of read(path.join("data", "urls", f))) { const h = line.split("\t")[1]; if (h) { trained.add(h); trained.add(registrableOf(h)); } }
}
const unseen = host => host && !trained.has(host) && !trained.has(registrableOf(host));

const feedFile = path.join("data", "feeds", "openphish.txt");
if (!fs.existsSync(path.join(root, feedFile))) { console.error("No data/feeds/openphish.txt yet. Start the server once (npm start) so it downloads the lists."); process.exit(1); }
const feedDate = fs.statSync(path.join(root, feedFile)).mtime.toISOString().slice(0, 10);
const phishAll = [...new Set(read(feedFile))];
const phish = phishAll.filter(u => unseen(hostOf(u)));
const legitAll = [...new Set(read(path.join("data", "eval", "uae-legit-hosts.txt")))];
const legit = legitAll.filter(h => unseen(hostOf(h)));

async function measure(label, list, isPhish) {
  let modelFlag = 0, fullFlag = 0, ms = 0;
  const misses = [], alarms = [];
  for (const item of list) {
    const url = /^https?:\/\//.test(item) ? item : "https://" + item + "/";
    const p = phishingProbability(url);
    if (p !== null && p >= 0.7) modelFlag++;
    const t = performance.now();
    const r = await checkLink(url, { ageWaitMs: 0 });
    ms += performance.now() - t;
    const flagged = r && r.valid && r.level !== "low";
    if (flagged) fullFlag++;
    if (isPhish && !flagged) misses.push(url);
    if (!isPhish && flagged) alarms.push(`${item} (${r.level} ${r.score}: ${r.flags.filter(f => f.sev === "high" || f.sev === "med").map(f => f.title).join("; ")})`);
  }
  return { label, n: list.length, modelFlag, fullFlag, avgMs: ms / Math.max(1, list.length), misses, alarms };
}

const P = await measure("phishing", phish, true);
const L = await measure("genuine", legit, false);
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + "%" : "n/a");

const report = `# Link checker evaluation

Measured on ${new Date().toISOString().slice(0, 10)} with \`npm run evaluate\` (scripts/evaluate-links.mjs). Nothing in these test sets was used for training.

**Test data**
- Phishing: ${P.n} live phishing addresses from the OpenPhish community feed (downloaded ${feedDate}); ${phishAll.length - P.n} more were skipped because their website name is in the training data.
- Genuine: ${L.n} real UAE websites from \`data/eval/uae-legit-hosts.txt\` (government, banks, telecoms, airlines, shops, news, universities, hospitals); ${legitAll.length - L.n} skipped because they are in the training data.

**Results without the phishing lists** (a brand-new scam site nobody has reported yet; no internet lookups)

| | Website-name model alone (≥ 70%) | Full check: rules + model |
|---|---|---|
| Phishing sites caught | ${P.modelFlag} / ${P.n} (${pct(P.modelFlag, P.n)}) | ${P.fullFlag} / ${P.n} (${pct(P.fullFlag, P.n)}) |
| Genuine UAE sites wrongly flagged | ${L.modelFlag} / ${L.n} (${pct(L.modelFlag, L.n)}) | ${L.fullFlag} / ${L.n} (${pct(L.fullFlag, L.n)}) |

"Flagged" for the full check means a result of *suspicious* or *likely scam*. With the phishing lists switched on, every address in a list is caught as well; the lists cover reported sites, the rules and model cover new ones.

**Speed:** ${P.avgMs.toFixed(2)} ms per link on average (one CPU core, no network).

**Genuine sites wrongly flagged by the full check**
${L.alarms.length ? L.alarms.map(a => "- " + a).join("\n") : "- none"}

**Examples of phishing addresses it missed** (first 10)
${P.misses.slice(0, 10).map(m => "- `" + m.replace(/`/g, "") + "`").join("\n") || "- none"}
`;
fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(path.join(root, "docs", "EVALUATION.md"), report);
console.log(report);
setTimeout(() => process.exit(0), 50);
