"use strict";

// Outil local Electron : aucun identifiant B2 n'est intégré dans l'application.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { app, safeStorage } = require("electron");
const { presignPutObjectUrl, publicMediaUrl } = require("../src/main/backblaze-media");
const { CATALOG_MIRROR } = require("../src/main/tts-voice-catalog");
const profile = process.argv[process.argv.indexOf("--user-data") + 1];
if (!process.argv.includes("--user-data") || !profile) throw new Error("--user-data requis");
app.setPath("userData", path.resolve(profile));
app.disableHardwareAcceleration();
async function main() {
  await app.whenReady();
  const state = JSON.parse(fs.readFileSync(path.join(profile, "shenpulse-state.json"), "utf8"));
  const secrets = JSON.parse(fs.readFileSync(path.join(profile, "shenpulse-secrets.json"), "utf8"));
  const settings = state.settings.backblaze;
  const secret = (id) => {
    const entry = secrets[id];
    return entry?.encrypted ? safeStorage.decryptString(Buffer.from(entry.value, "base64")) : String(entry?.value || "");
  };
  const config = { bucket: settings.bucket, endpoint: settings.endpoint.replace(/^https?:\/\//, "").replace(/\/+$/, ""), region: settings.region, publicBaseUrl: settings.publicBaseUrl.replace(/\/+$/, ""), keyId: secret(settings.keyIdSecretId), applicationKey: secret(settings.applicationKeySecretId) };
  const key = "tts/catalog/2026-11-03/voices.json";
  if (publicMediaUrl(config, key) !== CATALOG_MIRROR) throw new Error("Destination du catalogue incorrecte");
  const bytes = fs.readFileSync(path.join(__dirname, "../.artifacts/tts-audit/voices.json"));
  const hash = (buffer) => createHash("sha256").update(buffer).digest("hex");
  let response = await fetch(CATALOG_MIRROR, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (response.status === 404) {
    await response.body?.cancel();
    response = await fetch(presignPutObjectUrl({ config, key, ttl: 600 }), { method: "PUT", headers: { "Content-Type": "application/json", "Content-Length": String(bytes.length) }, body: bytes, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Publication refusée (${response.status})`);
    await response.body?.cancel();
    response = await fetch(CATALOG_MIRROR, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  }
  if (!response.ok || hash(Buffer.from(await response.arrayBuffer())) !== hash(bytes)) throw new Error("Le catalogue distant ne correspond pas au catalogue local");
  const report = { url: CATALOG_MIRROR, voices: JSON.parse(bytes).length, size: bytes.length, sha256: hash(bytes), verifiedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(__dirname, "../.artifacts/tts-audit/backblaze.json"), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify(report) + "\n");
}
main().then(() => app.exit(0)).catch((error) => { process.stderr.write(error.message + "\n"); app.exit(1); });
