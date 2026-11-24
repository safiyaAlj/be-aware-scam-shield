// Runs the trained local scam classifier (see scripts/train-model.mjs). No network, no cost.
import fs from "node:fs";
import { tokenize, featurize, wordCount } from "./features.js";

const MODEL = JSON.parse(fs.readFileSync(new URL("./model.json", import.meta.url), "utf8"));

const sigmoid = z => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));

/**
 * @returns {{ probability:number, words:number, evidence:string[] }}
 *   probability: 0..1 chance the message is a scam
 *   words:       real words in the message (few words = less reliable)
 *   evidence:    short phrases from the message that pushed most towards "scam"
 */
export function classify(text) {
  const tokens = tokenize(text);
  const feats = featurize(tokens);
  const scale = 1 / Math.sqrt(Math.max(1, feats.length));
  let z = MODEL.bias;
  for (const f of feats) z += (MODEL.weights[f] || 0) * scale;

  // Quote whole words or word pairs (not letter chunks) so the evidence is readable.
  const scored = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.norm.startsWith("__")) continue;
    const w1 = MODEL.weights["w:" + t.norm] || 0;
    if (w1 > 0) scored.push({ quote: t.raw, w: w1 });
    const next = tokens[i + 1];
    if (next && !next.norm.startsWith("__")) {
      const w2 = MODEL.weights["b:" + t.norm + " " + next.norm] || 0;
      if (w2 > 0) scored.push({ quote: t.raw + " " + next.raw, w: w2 + w1 });
    }
  }
  scored.sort((a, b) => b.w - a.w);
  const evidence = [];
  for (const s of scored) {
    const q = s.quote.toLowerCase();
    if (evidence.some(e => e.toLowerCase().includes(q) || q.includes(e.toLowerCase()))) continue;
    evidence.push(s.quote);
    if (evidence.length === 3) break;
  }

  return { probability: sigmoid(z), words: wordCount(tokens), evidence };
}

export const modelInfo = { trained_at: MODEL.trained_at, examples: MODEL.examples, held_out_metrics: MODEL.held_out_metrics };
