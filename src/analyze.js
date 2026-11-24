// Picks which engine analyses messages.
//   ANALYSIS_ENGINE=local   free model on this server (default when there is no ANTHROPIC_API_KEY)
//   ANALYSIS_ENGINE=claude  Claude AI via the Anthropic API (paid, reads screenshots, explains in its own words)
import { analyzeWithClaude } from "./claude.js";
import { analyzeLocally } from "./local-analysis.js";

export function analysisEngine() {
  const chosen = (process.env.ANALYSIS_ENGINE || "").trim().toLowerCase();
  if (chosen === "local" || chosen === "claude") return chosen;
  return process.env.ANTHROPIC_API_KEY ? "claude" : "local";
}

export async function analyze(input) {
  if (analysisEngine() === "claude") return { ...(await analyzeWithClaude(input)), engine: "claude" };
  return analyzeLocally(input);
}
