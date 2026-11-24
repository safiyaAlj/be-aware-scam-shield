// Trains the free, local phishing-address model from data/urls/*.tsv.
//
//   npm run train:urls
//
// Each line: "phish" or "legit", a TAB, then a hostname (no "www.", no path).
// Rebuild data/urls/phiusiil-hosts.tsv with scripts/prepare-url-data.mjs.
// Any other .tsv in data/urls/ is treated as local (UAE) data and counts more.
//
// The model is logistic regression over hashed hostname features
// (src/local-model/url-features.js), saved to src/local-model/url-model.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hostOf, hostFeatures, HASH_BITS } from "../src/local-model/url-features.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data", "urls");
const outFile = path.join(root, "src", "local-model", "url-model.json");
const PUBLIC_FILES = new Set(["phiusiil-hosts.tsv", "phishing-database-hosts.tsv"]);
const LOCAL_WEIGHT = Number(process.env.LOCAL_WEIGHT || 50);
const EPOCHS = Number(process.env.EPOCHS || 4), LR = 0.1, L2 = 1e-7;

function shuffle(arr, seed) {
  const a = arr.slice(); let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const sigmoid = z => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));

function load() {
  const rows = [];
  for (const file of fs.readdirSync(dataDir).filter(f => f.endsWith(".tsv")).sort()) {
    const weight = PUBLIC_FILES.has(file) ? 1 : LOCAL_WEIGHT;
    let n = 0;
    for (const line of fs.readFileSync(path.join(dataDir, file), "utf8").split(/\r?\n/)) {
      const [label, h] = line.split("\t");
      const host = hostOf(h);
      if (!host || (label !== "phish" && label !== "legit")) continue;
      rows.push({ y: label === "phish" ? 1 : 0, host, weight, file, feats: hostFeatures(host) });
      n++;
    }
    console.log(`  ${file}: ${n} hostnames (weight ${weight})`);
  }
  return rows;
}

function train(rows) {
  const size = 1 << HASH_BITS;
  const w = new Float64Array(size), g2 = new Float64Array(size).fill(1e-8);
  const pos = rows.filter(r => r.y).reduce((a, r) => a + r.weight, 0);
  const neg = rows.filter(r => !r.y).reduce((a, r) => a + r.weight, 0);
  const classW = { 1: (pos + neg) / (2 * pos), 0: (pos + neg) / (2 * neg) };
  let bias = 0, gb = 1e-8;
  for (let e = 0; e < EPOCHS; e++) {
    for (const r of shuffle(rows, 99 + e)) {
      const scale = 1 / Math.sqrt(r.feats.length);
      let z = bias;
      for (const f of r.feats) z += w[f] * scale;
      const err = (sigmoid(z) - r.y) * r.weight * classW[r.y];
      for (const f of r.feats) {
        const grad = err * scale + L2 * w[f];
        g2[f] += grad * grad;
        w[f] -= (LR / Math.sqrt(g2[f])) * grad;
      }
      gb += err * err; bias -= (LR / Math.sqrt(gb)) * err;
    }
  }
  // Store every bucket as a 16-bit whole number (weight / scale): small and exact enough.
  let max = 0;
  for (let i = 0; i < size; i++) max = Math.max(max, Math.abs(w[i]));
  const scale = max / 32767 || 1;
  const q = new Int16Array(size);
  for (let i = 0; i < size; i++) q[i] = Math.round(w[i] / scale);
  return { bias: Math.round(bias * 1000) / 1000, scale, q };
}

function predictor(model) {
  return feats => { const scale = 1 / Math.sqrt(feats.length); let z = model.bias; for (const f of feats) z += model.q[f] * model.scale * scale; return sigmoid(z); };
}

function evaluate(predict, rows) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const r of rows) { const yhat = predict(r.feats) >= 0.5 ? 1 : 0; if (yhat && r.y) tp++; else if (yhat) fp++; else if (r.y) fn++; else tn++; }
  const precision = tp / Math.max(1, tp + fp), recall = tp / Math.max(1, tp + fn);
  return { examples: rows.length, accuracy: +((tp + tn) / Math.max(1, rows.length)).toFixed(4), precision: +precision.toFixed(4), recall: +recall.toFixed(4),
    confusion: { phish_caught: tp, phish_missed: fn, legit_flagged: fp, legit_passed: tn } };
}

console.log("Loading data/urls/*.tsv");
const rows = load();

// Hold out 20% of each file and class to measure accuracy on unseen hostnames.
const test = [], trainRows = [], groups = new Map();
for (const r of rows) { const k = r.file + ":" + r.y; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
for (const g of groups.values()) { const s = shuffle(g, 7); const cut = Math.max(1, Math.round(s.length * 0.2)); test.push(...s.slice(0, cut)); trainRows.push(...s.slice(cut)); }

console.log(`\nTraining on ${trainRows.length}, testing on ${test.length} held-out hostnames`);
const trialPredict = predictor(train(trainRows));
const metrics = { all: evaluate(trialPredict, test) };
for (const file of new Set(test.map(r => r.file))) metrics[file] = evaluate(trialPredict, test.filter(r => r.file === file));
const uaeLegit = test.filter(r => r.file === "phiusiil-hosts.tsv" && !r.y && /\.ae$/.test(r.host));
if (uaeLegit.length) metrics["public .ae legit"] = evaluate(trialPredict, uaeLegit);
for (const [k, m] of Object.entries(metrics)) {
  console.log(`  ${k.padEnd(22)} accuracy ${(m.accuracy * 100).toFixed(1)}%  precision ${(m.precision * 100).toFixed(1)}%  recall ${(m.recall * 100).toFixed(1)}%  (${m.examples})`);
}

console.log("\nTraining final model on all hostnames");
const model = train(rows);
fs.writeFileSync(outFile, JSON.stringify({
  version: 1, trained_at: new Date().toISOString(), hash_bits: HASH_BITS, examples: rows.length,
  sources: [...new Set(rows.map(r => r.file))], held_out_metrics: metrics,
  bias: model.bias, scale: model.scale,
  weights_int16_base64: Buffer.from(model.q.buffer).toString("base64")
}));
console.log(`Saved ${model.q.length} weights to ${path.relative(root, outFile)} (${(fs.statSync(outFile).size / 1024).toFixed(0)} KB)`);
