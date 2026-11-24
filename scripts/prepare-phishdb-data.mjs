// Adds fresh phishing website names to the training data, from the Phishing.Database list
// the server downloads (data/feeds/phishing-database.txt, MIT licence).
//
//   node scripts/prepare-phishdb-data.mjs [sampleSize=150000]
//
// Writes data/urls/phishing-database-hosts.tsv ("phish <TAB> hostname"). Left out:
//   - official domains of brands the checker knows (a reported page on google.com is not google.com)
//   - shared sites where many people publish pages (docs.google.com, github.com, bit.ly ...)
//   - anything in data/eval/ (kept for honest evaluation)
//   - anything in the current OpenPhish feed (also used for evaluation)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hostOf, registrableOf } from "../src/local-model/url-features.js";
import { analyzeUrl } from "../public/js/url-analyzer.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const N = Number(process.argv[2] || 150000);
const read = f => fs.readFileSync(path.join(root, f), "utf8").split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith("#"));

const SHARED = new Set(["google.com", "googleapis.com", "googleusercontent.com", "gle", "dropbox.com", "dropboxusercontent.com", "live.com", "1drv.ms",
  "sharepoint.com", "office.com", "microsoft.com", "github.com", "githubusercontent.com", "gitlab.com", "bitbucket.org", "t.me", "telegra.ph", "wa.me",
  "linktr.ee", "bit.ly", "tinyurl.com", "t.co", "goo.gl", "cutt.ly", "rb.gy", "is.gd", "ow.ly", "s.id", "forms.gle", "amazonaws.com", "cloudfront.net",
  "azurewebsites.net", "blob.core.windows.net", "apple.com", "icloud.com", "facebook.com", "instagram.com", "whatsapp.com", "linkedin.com", "youtube.com"]);

const evalHosts = new Set(read("data/eval/uae-legit-hosts.txt").map(h => registrableOf(hostOf(h) || h)));
const openphish = new Set(fs.existsSync(path.join(root, "data/feeds/openphish.txt")) ? read("data/feeds/openphish.txt").map(u => registrableOf(hostOf(u) || "")) : []);

const all = read("data/feeds/phishing-database.txt").map(h => hostOf(h)).filter(Boolean);
let skipped = 0;
const kept = [];
for (const h of new Set(all)) {
  const reg = registrableOf(h);
  if (SHARED.has(reg) || evalHosts.has(reg) || openphish.has(reg)) { skipped++; continue; }
  const r = analyzeUrl("https://" + h + "/");
  if (r && r.official) { skipped++; continue; }
  kept.push(h);
}
// Deterministic sample.
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
for (let i = kept.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [kept[i], kept[j]] = [kept[j], kept[i]]; }
const sample = kept.slice(0, N).sort();
fs.writeFileSync(path.join(root, "data", "urls", "phishing-database-hosts.tsv"), sample.map(h => "phish\t" + h).join("\n") + "\n");
console.log(`${all.length} listed names -> ${kept.length} usable (${skipped} left out) -> ${sample.length} written to data/urls/phishing-database-hosts.tsv`);
