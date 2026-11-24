// Turns a message into features for the local scam classifier.
// Used by both the training script and the live check, so they always agree.

const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:top|xyz|click|link|live|shop|online|site|icu|cfd|sbs|cyou|info|com|net|org|ae|ly|co|me|io|uk)\b\S*/gi;
const PHONE_RE = /(?:\+|00)?\d[\d\s-]{7,}\d/g;
const WORD_RE = /[\p{L}\p{N}_]+/gu;

// Arabic: drop diacritics/tatweel and unify common letter variants; Arabic-Indic digits -> 0-9.
export function normalizeToken(tok) {
  return tok
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/\d+/g, n => (n.length >= 4 ? "__longnum__" : "__num__"));
}

/** Words of a message, each with its original spelling (for quoting) and normalized form. */
export function tokenize(text) {
  const marked = String(text || "")
    .slice(0, 8000)
    .replace(URL_RE, " __url__ ")
    .replace(PHONE_RE, " __phone__ ");
  const out = [];
  for (const m of marked.matchAll(WORD_RE)) {
    const raw = m[0];
    out.push({ raw, norm: raw.startsWith("__") ? raw : normalizeToken(raw) });
  }
  return out;
}

/** Feature names for a token list: words, word pairs, and 3-letter chunks (helps with Arabic prefixes). */
export function featurize(tokens) {
  const feats = new Set();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].norm;
    feats.add("w:" + t);
    if (i + 1 < tokens.length) feats.add("b:" + t + " " + tokens[i + 1].norm);
    if (!t.startsWith("__") && t.length >= 3) {
      const padded = `<${t}>`;
      for (let j = 0; j + 3 <= padded.length; j++) feats.add("c:" + padded.slice(j, j + 3));
    }
  }
  return [...feats];
}

/** Number of real words (not links, phone numbers or numbers). */
export const wordCount = tokens => tokens.filter(t => !t.norm.startsWith("__")).length;
