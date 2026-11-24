// Scores a hostname with the trained phishing-address model (see scripts/train-url-model.mjs).
// Runs on this server only. No network, no cost.
import fs from "node:fs";
import { hostOf, hostFeatures, registrableOf, HASH_BITS } from "./url-features.js";

const MODEL = JSON.parse(fs.readFileSync(new URL("./url-model.json", import.meta.url), "utf8"));
if (MODEL.hash_bits !== HASH_BITS) throw new Error(`url-model.json was trained with ${MODEL.hash_bits}-bit hashing; run npm run train:urls`);
const buf = Buffer.from(MODEL.weights_int16_base64, "base64");
const W = new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);

const sigmoid = z => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));

function score(host) {
  const feats = hostFeatures(host);
  const scale = 1 / Math.sqrt(feats.length);
  let z = MODEL.bias;
  for (const f of feats) z += W[f] * MODEL.scale * scale;
  return sigmoid(z);
}

/**
 * Chance (0..1) that this address's website is a phishing site, or null if it has no hostname.
 * Scores the full name and the main domain and keeps the lower one: the training data has no
 * genuine sites with subdomains, so "secure.etisalat.ae" alone would look suspicious, while
 * its main domain "etisalat.ae" doesn't. Scam domains and the free hosting sites scammers use
 * (weebly.com, vercel.app ...) score high both ways.
 */
export function phishingProbability(urlOrHost) {
  const host = hostOf(urlOrHost);
  if (!host) return null;
  const reg = registrableOf(host);
  return reg === host ? score(host) : Math.min(score(host), score(reg));
}

export const urlModelInfo = { trained_at: MODEL.trained_at, examples: MODEL.examples, held_out_metrics: MODEL.held_out_metrics };
