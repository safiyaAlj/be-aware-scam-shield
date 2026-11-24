// Converts the PhiUSIIL phishing URL dataset into data/urls/phiusiil-hosts.tsv
// (one "phish|legit <TAB> hostname" per line) for scripts/train-url-model.mjs.
//
//   node scripts/prepare-url-data.mjs path/to/PhiUSIIL_Phishing_URL_Dataset.csv
//
// Download: https://archive.ics.uci.edu/dataset/967/phiusiil+phishing+url+dataset (CC BY 4.0).
// In that dataset label 1 = legitimate, 0 = phishing.
//
// Only the hostname is kept, without "www.". Every legitimate URL in the dataset is
// "https://www.<domain>" with no path, so keeping the scheme, "www" or the path would
// teach the model "has a path / no www = phishing", which is wrong in real life.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { hostOf } from "../src/local-model/url-features.js";

const src = process.argv[2];
if (!src) { console.error("Usage: node scripts/prepare-url-data.mjs <PhiUSIIL csv>"); process.exit(1); }
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "data", "urls", "phiusiil-hosts.tsv");

const parse = line => {
  const f = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ",") { f.push(cur); cur = ""; } else cur += ch;
  }
  f.push(cur); return f;
};

const labels = new Map(); // host -> Set of labels
let head, iU, iL, rows = 0;
for await (const raw of readline.createInterface({ input: fs.createReadStream(src, "utf8") })) {
  const line = raw.replace(/^﻿/, "");
  if (!head) { head = parse(line); iU = head.indexOf("URL"); iL = head.indexOf("label"); continue; }
  const f = parse(line);
  if (f.length !== head.length) continue;
  const host = hostOf(f[iU]);
  if (!host) continue;
  const y = f[iL] === "1" ? "legit" : f[iL] === "0" ? "phish" : null;
  if (!y) continue;
  if (!labels.has(host)) labels.set(host, new Set());
  labels.get(host).add(y);
  rows++;
}
let kept = 0, conflicts = 0;
const lines = [];
for (const [host, ys] of labels) {
  if (ys.size > 1) { conflicts++; continue; } // same host labelled both ways: unusable
  lines.push(`${[...ys][0]}\t${host}`); kept++;
}
lines.sort();
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, lines.join("\n") + "\n");
console.log(`${rows} rows -> ${kept} unique hostnames (${conflicts} dropped as conflicting). Saved ${path.relative(root, out)}`);
