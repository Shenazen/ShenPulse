"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { app, safeStorage } = require("electron");

const root = path.join(__dirname, "..");
const options = parseArguments(process.argv.slice(2));
if (options["user-data"]) {
  app.setPath("userData", path.resolve(options["user-data"]));
}

main().catch((error) => {
  process.stderr.write(`Échec : ${error.message}\n`);
  app.exit(1);
});

async function main() {
  await app.whenReady();
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("le coffre-fort Windows de ShenPulse est indisponible");
  }

  const userData = path.resolve(requiredOption("user-data"));
  const state = JSON.parse(
    fs.readFileSync(path.join(userData, "shenpulse-state.json"), "utf8")
  );
  const secrets = JSON.parse(
    fs.readFileSync(path.join(userData, "shenpulse-secrets.json"), "utf8")
  );
  const settings = state.settings?.backblaze || {};
  const keyId = readSecret(secrets, settings.keyIdSecretId);
  const applicationKey = readSecret(
    secrets,
    settings.applicationKeySecretId
  );
  const requiredSettings = [
    settings.bucket,
    settings.endpoint,
    settings.region,
    settings.publicBaseUrl,
    keyId,
    applicationKey
  ];
  if (requiredSettings.some((value) => !String(value || "").trim())) {
    throw new Error("la configuration Backblaze de ShenPulse est incomplète");
  }

  const childArguments = [
    path.join(root, "scripts", "upload-minecraft-installer-assets.js"),
    "--source-root",
    path.resolve(requiredOption("source-root")),
    "--manifest",
    path.resolve(requiredOption("manifest"))
  ];
  const code = await runElectronAsNode(childArguments, {
    B2_MEDIA_BUCKET: settings.bucket,
    B2_MEDIA_ENDPOINT: settings.endpoint,
    B2_MEDIA_REGION: settings.region,
    B2_MEDIA_PUBLIC_BASE_URL: settings.publicBaseUrl,
    B2_MEDIA_KEY_ID: keyId,
    B2_MEDIA_APPLICATION_KEY: applicationKey
  });
  app.exit(code);
}

function readSecret(secrets, secretId) {
  const entry = secrets[String(secretId || "")];
  if (!entry?.value) return "";
  if (!entry.encrypted) return String(entry.value);
  return safeStorage.decryptString(
    Buffer.from(String(entry.value), "base64")
  );
}

function runElectronAsNode(args, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      windowsHide: true,
      shell: false,
      stdio: "inherit",
      env: {
        ...process.env,
        ...environment,
        ELECTRON_RUN_AS_NODE: "1"
      }
    });
    child.once("error", reject);
    child.once("close", resolve);
  });
}

function parseArguments(args) {
  const result = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = String(args[index] || "").replace(/^--/, "");
    if (key) result[key] = args[index + 1] || "";
  }
  return result;
}

function requiredOption(name) {
  const value = options[name];
  if (!value) throw new Error(`option --${name} manquante`);
  return value;
}
