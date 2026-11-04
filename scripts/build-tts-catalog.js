"use strict";

// Métadonnées publiques seulement : les modèles vocaux restent chez leur fournisseur.
const fs = require("node:fs");
const path = require("node:path");
const { MsEdgeTTS } = require("msedge-tts");
async function main() {
  const source = process.argv[2];
  const client = new MsEdgeTTS();
  let voices;
  try { voices = source ? JSON.parse(fs.readFileSync(source, "utf8")) : await client.getVoices(); }
  finally { client.close(); }
  const language = new Intl.DisplayNames("fr", { type: "language" });
  const region = new Intl.DisplayNames("fr", { type: "region" });
  const entries = voices.map((voice) => {
    const parts = voice.Locale.split("-");
    const lang = language.of(parts[0]);
    const country = parts.at(-1).length === 2 ? region.of(parts.at(-1)) : voice.Locale;
    const name = voice.ShortName.slice(voice.Locale.length + 1).replace(/MultilingualNeural$/, " multilingue").replace(/Neural$/, "");
    return { name: voice.ShortName, lang: voice.Locale, label: `${name} · ${lang[0].toUpperCase() + lang.slice(1)} (${country})` };
  });
  const root = path.join(__dirname, "..");
  fs.writeFileSync(path.join(root, "src/shared/tts-voice-catalog.js"), `// Métadonnées vocales publiques embarquées. Généré par scripts/build-tts-catalog.js.\n(function(root){\n  const voices = ${JSON.stringify(entries)};\n  if(typeof module === "object" && module.exports) module.exports = voices;\n  else root.ShenPulseTtsCatalog = voices;\n})(typeof globalThis === "object" ? globalThis : this);\n`);
  fs.mkdirSync(path.join(root, ".artifacts/tts-audit"), { recursive: true });
  fs.writeFileSync(path.join(root, ".artifacts/tts-audit/voices.json"), JSON.stringify(entries));
  process.stdout.write(`${entries.length} voix préparées.\n`);
}
main().catch((error) => { process.stderr.write(error.message + "\n"); process.exitCode = 1; });
