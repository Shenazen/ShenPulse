"use strict";

const fs = require("node:fs");
const { NaturalVoiceService } = require("../src/main/natural-voice-service");
const { NATURAL_VOICES } = require("../src/shared/tts-voices");
async function main() {
  const service = new NaturalVoiceService();
  const extra = new Set(["en-US-JennyNeural", "en-GB-SoniaNeural", "de-DE-KatjaNeural", "es-ES-ElviraNeural", "pt-BR-FranciscaNeural", "ja-JP-NanamiNeural", "zh-CN-XiaoxiaoNeural", "ar-SA-ZariyahNeural"]);
  const results = [];
  try {
    for (const voice of NATURAL_VOICES.filter((entry) => entry.lang.startsWith("fr") || extra.has(entry.name))) {
      const start = performance.now();
      const payload = { voice: voice.id, text: "Bienvenue sur ShenPulse.", rate: 1, pitch: 1 };
      let result = await service.synthesize(payload), attempts = 1;
      if (!result?.audioUrl) { service.unavailableUntil = 0; attempts++; result = await service.synthesize(payload); }
      const row = { name: voice.name, audio: Boolean(result?.audioUrl), attempts, bytes: result?.audioUrl ? Buffer.from(result.audioUrl.split(",")[1], "base64").length : 0, latencyMs: Math.round(performance.now() - start) };
      results.push(row);
      process.stdout.write(JSON.stringify(row) + "\n");
      if (!row.audio) service.unavailableUntil = 0;
    }
  } finally { service.close(); }
  fs.writeFileSync(".artifacts/tts-audit/voices-verified.json", JSON.stringify(results, null, 2));
  if (results.some((row) => !row.audio)) process.exitCode = 1;
}
main().catch((error) => { process.stderr.write(error.message + "\n"); process.exitCode = 1; });
