// Builds the browser extension into dist/extension, ready to load or zip.
//   EXTENSION_API_BASE=https://scamcheck.example.gov.ae npm run build:extension
// - copies the shared url-analyzer.js so the extension and website use the same rules
// - writes the server address into config.js and manifest host_permissions
// - adds icons from extension/icons/ if present (icon16/32/48/128.png)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "extension");
const out = path.join(root, "dist", "extension");
const apiBase = (process.env.EXTENSION_API_BASE || "").replace(/\/+$/, "");
// https for real use; http://localhost is allowed for local testing and demos.
if (!/^https:\/\/[^/]+$/.test(apiBase) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(apiBase)) {
  console.error("Set EXTENSION_API_BASE to your server's https address, e.g. https://scamcheck.example.gov.ae (or http://localhost:8080 for a local demo)");
  process.exit(1);
}

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true });
fs.copyFileSync(path.join(root, "public", "js", "url-analyzer.js"), path.join(out, "url-analyzer.js"));
fs.writeFileSync(path.join(out, "config.js"), `export const API_BASE = ${JSON.stringify(apiBase)};\n`);

const manifest = JSON.parse(fs.readFileSync(path.join(src, "manifest.json"), "utf8"));
manifest.host_permissions = [`${apiBase}/*`];
// The server's demo results page gets the same badges as real search results.
manifest.content_scripts[0].matches.push(`${apiBase}/demo/search*`);
const sizes = [16, 32, 48, 128].filter(s => fs.existsSync(path.join(src, "icons", `icon${s}.png`)));
if (sizes.length) {
  manifest.icons = Object.fromEntries(sizes.map(s => [String(s), `icons/icon${s}.png`]));
  manifest.action.default_icon = manifest.icons;
} else {
  console.warn("No icons found in extension/icons/. Add icon16/32/48/128.png (official logo) before publishing.");
}
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`Extension built in ${path.relative(root, out)} for ${apiBase}`);
