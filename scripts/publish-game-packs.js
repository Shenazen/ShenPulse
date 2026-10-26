"use strict";

// Run with Electron to read the Windows vault; no credentials are written to disk.
const fs = require("node:fs");
const path = require("node:path");
const { app, safeStorage } = require("electron");
const { spawn } = require("node:child_process");
const sourceProfile = process.argv[process.argv.indexOf("--user-data") + 1];
if (!process.argv.includes("--user-data") || !sourceProfile) throw new Error("--user-data requis");
// safeStorage uses this profile's Local State key. Read state JSON directly,
// without constructing a StateStore or migrating account settings.
app.setPath("userData", path.resolve(sourceProfile));
app.disableHardwareAcceleration();

async function main() {
  await app.whenReady();
  process.stdout.write("Coffre-fort Windows prêt.\n");
  const state = JSON.parse(fs.readFileSync(path.join(sourceProfile, "shenpulse-state.json"), "utf8"));
  const secrets = JSON.parse(fs.readFileSync(path.join(sourceProfile, "shenpulse-secrets.json"), "utf8"));
  const settings = state.settings?.backblaze || {};
  const readSecret = id => {
    const entry = secrets[id];
    if (!entry?.value) return "";
    return entry.encrypted ? safeStorage.decryptString(Buffer.from(entry.value, "base64")) : String(entry.value);
  };
  const args = [
    path.join(__dirname, "upload-game-packs.js"),
    ...(process.argv.includes("--verify-only") ? ["--verify-only"] : []),
    ...process.argv.filter(argument => argument.startsWith("--game="))
  ];
  const environment = {
    ...process.env,
    B2_MEDIA_BUCKET: settings.bucket,
    B2_MEDIA_ENDPOINT: settings.endpoint,
    B2_MEDIA_REGION: settings.region,
    B2_MEDIA_PUBLIC_BASE_URL: settings.publicBaseUrl,
    B2_MEDIA_KEY_ID: readSecret(settings.keyIdSecretId),
    B2_MEDIA_APPLICATION_KEY: readSecret(settings.applicationKeySecretId)
  };
  delete environment.ELECTRON_RUN_AS_NODE;
  const code = await new Promise((resolve, reject) => {
    const child = spawn("node", args, { cwd: path.join(__dirname, ".."), env: environment,
      windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", data => process.stdout.write(data));
    child.stderr.on("data", data => process.stderr.write(data));
    child.once("error", reject);
    child.once("close", code => resolve(code ?? 1));
  });
  return code;
}

main().then(code => app.exit(code)).catch(error => {
  process.stderr.write(`Publication impossible : ${error.message}\n`);
  app.exit(1);
});
