// Trains the free, local scam classifier from the labelled examples in data/*.tsv.
//
//   npm run train
//
// Each data file has one example per line:  <label><TAB><message>
// where label is "spam" (scam) or "ham" (normal). Add your own reported
// messages as a new .tsv file in data/ and run this again. Remove names,
// phone numbers and account numbers from real messages before adding them.
//
// The model (logistic regression over words, word pairs and letter chunks)
// is written to src/local-model/model.json, with its test-set accuracy.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tokenize, featurize } from "../src/local-model/features.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const outFile = path.join(root, "src", "local-model", "model.json");

// The public set is old UK English spam. Every other file is local (UAE, Arabic/English)
// data, which is scarce but closer to what people will submit, so it counts more.
const PUBLIC_FILES = new Set(["sms-spam-collection.tsv"]);
const LOCAL_WEIGHT = Number(process.env.LOCAL_WEIGHT || 20);

const EPOCHS = Number(process.env.EPOCHS || 25), LR = 0.2, L2 = 1e-6, MIN_COUNT = 2, PRUNE = 0.01;

function load() {
  const rows = [];
  for (const file of fs.readdirSync(dataDir).filter(f => f.endsWith(".tsv")).sort()) {
    const weight = PUBLIC_FILES.has(file) ? 1 : LOCAL_WEIGHT;
    let n = 0;
    for (const line of fs.readFileSync(path.join(dataDir, file), "utf8").split(/\r?\n/)) {
      const tab = line.indexOf("\t");
      if (tab < 0) continue;
      const label = line.slice(0, tab).trim().toLowerCase();
      const text = line.slice(tab + 1).trim();
      if (!text || (label !== "spam" && label !== "ham")) continue;
      rows.push({ y: label === "spam" ? 1 : 0, text, weight, file });
      n++;
    }
    console.log(`  ${file}: ${n} examples (weight ${weight})`);
  }
  return rows;
}

// Deterministic shuffle so results are repeatable.
function shuffle(arr, seed = 42) {
  const a = arr.slice();
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const sigmoid = z => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));

function train(rows) {
  const counts = new Map();
  for (const r of rows) for (const f of r.feats) counts.set(f, (counts.get(f) || 0) + 1);
  const vocab = new Set([...counts].filter(([, c]) => c >= MIN_COUNT).map(([f]) => f));

  // Balance classes so the rarer "scam" class isn't ignored.
  const pos = rows.filter(r => r.y).reduce((a, r) => a + r.weight, 0);
  const neg = rows.filter(r => !r.y).reduce((a, r) => a + r.weight, 0);
  const classW = { 1: (pos + neg) / (2 * pos), 0: (pos + neg) / (2 * neg) };

  const w = new Map(), g2 = new Map();
  let bias = 0, gBias = 1e-8;
  for (let epoch = 0; epoch < EPOCHS; epoch++) {
    for (const r of shuffle(rows, 1000 + epoch)) {
      const fs_ = r.feats.filter(f => vocab.has(f));
      const scale = 1 / Math.sqrt(Math.max(1, fs_.length));
      let z = bias;
      for (const f of fs_) z += (w.get(f) || 0) * scale;
      const err = (sigmoid(z) - r.y) * r.weight * classW[r.y];
      for (const f of fs_) {
        const wf = w.get(f) || 0;
        const grad = err * scale + L2 * wf;
        const acc = (g2.get(f) || 1e-8) + grad * grad;
        g2.set(f, acc);
        w.set(f, wf - (LR / Math.sqrt(acc)) * grad);
      }
      gBias += err * err;
      bias -= (LR / Math.sqrt(gBias)) * err;
    }
  }
  const weights = {};
  for (const [f, v] of w) if (Math.abs(v) >= PRUNE) weights[f] = Math.round(v * 1e4) / 1e4;
  return { bias: Math.round(bias * 1e4) / 1e4, weights };
}

function predict(model, feats) {
  const known = feats.filter(f => f in model.weights);
  const scale = 1 / Math.sqrt(Math.max(1, feats.length));
  let z = model.bias;
  for (const f of known) z += model.weights[f] * scale;
  return sigmoid(z);
}

function evaluate(model, rows) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const r of rows) {
    const yhat = predict(model, r.feats) >= 0.5 ? 1 : 0;
    if (yhat && r.y) tp++; else if (yhat) fp++; else if (r.y) fn++; else tn++;
  }
  const precision = tp / Math.max(1, tp + fp), recall = tp / Math.max(1, tp + fn);
  return {
    examples: rows.length,
    accuracy: +((tp + tn) / Math.max(1, rows.length)).toFixed(4),
    precision: +precision.toFixed(4),
    recall: +recall.toFixed(4),
    f1: +((2 * precision * recall) / Math.max(1e-9, precision + recall)).toFixed(4),
    confusion: { scam_caught: tp, scam_missed: fn, normal_flagged: fp, normal_passed: tn }
  };
}

console.log("Loading data/*.tsv");
const rows = load().map(r => ({ ...r, feats: featurize(tokenize(r.text)) }));

// Hold out 20% of each class (per file) to measure accuracy honestly.
const test = [], trainRows = [];
const groups = new Map();
for (const r of rows) { const k = r.file + ":" + r.y; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
for (const g of groups.values()) {
  const s = shuffle(g, 7);
  const cut = Math.max(1, Math.round(s.length * 0.2));
  test.push(...s.slice(0, cut)); trainRows.push(...s.slice(cut));
}

console.log(`\nTraining on ${trainRows.length}, testing on ${test.length} held-out examples`);
const trial = train(trainRows);
const metrics = { all: evaluate(trial, test) };
for (const file of new Set(test.map(r => r.file))) metrics[file] = evaluate(trial, test.filter(r => r.file === file));
for (const [k, m] of Object.entries(metrics)) {
  console.log(`  ${k.padEnd(26)} accuracy ${(m.accuracy * 100).toFixed(1)}%  precision ${(m.precision * 100).toFixed(1)}%  recall ${(m.recall * 100).toFixed(1)}%  (${m.examples} examples)`);
}

console.log("\nTraining final model on all examples");
const model = train(rows);
fs.writeFileSync(outFile, JSON.stringify({
  version: 1,
  trained_at: new Date().toISOString(),
  examples: rows.length,
  sources: [...new Set(rows.map(r => r.file))],
  held_out_metrics: metrics,
  bias: model.bias,
  weights: model.weights
}));
console.log(`Saved ${Object.keys(model.weights).length} features to ${path.relative(root, outFile)} (${(fs.statSync(outFile).size / 1024).toFixed(0)} KB)`);
