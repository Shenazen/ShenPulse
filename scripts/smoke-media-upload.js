"use strict";

/**
 * Smoke réel du stockage partagé, à lancer exclusivement avec Electron :
 *   node_modules\electron\dist\electron.exe scripts\smoke-media-upload.js --allow-production-upload
 *
 * Aucun LIVE, aucune bibliothèque ni aucun fichier de compte n'est modifié.
 * Deux minuscules objets QA restent dans B2 : le broker ne propose pas de
 * suppression. Les chemins, UID, secrets et URL signées ne sont jamais affichés.
 * Le profil temporaire reçoit seulement « Local State », dont la clé OSCrypt
 * reste protégée par Windows/DPAPI. Cette copie privée n'est jamais publiée.
 * Après l'arrêt d'Electron, nettoyer son dossier exact avec :
 *   node scripts/smoke-media-upload.js --cleanup-profile <dossier-temporaire-exact>
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { AccountService } = require("../src/main/account-service");
const { BackblazeMediaService } = require("../src/main/backblaze-media");

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/** PCM mono 8 kHz silencieux, 10 ms : ce test ne lance aucun lecteur audio. */
function silentWav() {
  const samples = 80;
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(8000, 24);
  buffer.writeUInt32LE(16000, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples * 2, 40);
  return buffer;
}

function fixtures() {
  return [
    { fileName: "shenpulse-qa-silence.wav", kind: "sound", contentType: "audio/wav", body: silentWav() },
    {
      fileName: "shenpulse-qa-pixel.gif", kind: "visual", contentType: "image/gif",
      body: Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64")
    }
  ];
}

/** Store volontairement réduit : seul le jeton actif peut être lu ou renouvelé en mémoire. */
function memoryAccountStore(state, encryptedSecrets, safeStorage) {
  const account = structuredClone(state.settings?.account || {});
  const activeUid = String(state.activeAccountUid || "").trim();
  if (!activeUid || activeUid !== String(account.uid || "").trim() || !account.refreshTokenSecretId) {
    throw new Error("SESSION_MISSING");
  }
  const secretId = account.refreshTokenSecretId;
  const entry = encryptedSecrets[secretId];
  if (!entry?.value) throw new Error("SESSION_MISSING");
  if (entry.encrypted && !safeStorage?.isEncryptionAvailable()) throw new Error("DECRYPTION_UNAVAILABLE");
  const bytes = Buffer.from(entry.value, "base64");
  let refreshToken;
  try { refreshToken = entry.encrypted ? safeStorage.decryptString(bytes) : bytes.toString("utf8"); }
  catch { throw new Error("DECRYPTION_FAILED"); }
  if (!refreshToken) throw new Error("SESSION_MISSING");
  return {
    getAccountSession: () => structuredClone(account),
    getActiveAccountUid: () => activeUid,
    getState: () => ({ activeAccountUid: activeUid, settings: { account: structuredClone(account) } }),
    getSecret: (id) => id === secretId ? refreshToken : "",
    setSecret(id, value) {
      if (id !== secretId) throw new Error("UNEXPECTED_SECRET_WRITE");
      refreshToken = String(value);
      return secretId;
    }
  };
}

function output(record) {
  process.stdout.write(`${JSON.stringify(record)}\n`);
}

/** Aucune exception réseau brute : elle pourrait contenir une URL protégée. */
function safeFailure(error) {
  const code = String(error?.message || "");
  return ["SESSION_MISSING", "DECRYPTION_UNAVAILABLE", "DECRYPTION_FAILED", "PROFILE_CHANGED", "PROFILE_MISSING", "PUBLIC_HASH_MISMATCH", "PUBLIC_TYPE_MISMATCH", "PUBLIC_TOO_LARGE"]
    .includes(code) ? code : "CHECK_FAILED";
}

/** Reproduit le contexte de déchiffrement sans jamais ouvrir le profil réel en écriture. */
function cloneEncryptionProfile(userDataDirectory, fixtureDirectory) {
  const source = path.join(userDataDirectory, "Local State");
  if (!fs.existsSync(source)) throw new Error("PROFILE_MISSING");
  const bytes = fs.readFileSync(source);
  fs.writeFileSync(path.join(fixtureDirectory, "Local State"), bytes, { flag: "wx" });
  return sha256(bytes);
}

/** Suppression limitée à un profil QA marqué, enfant direct du TEMP, et déjà arrêté. */
function removeSmokeProfile(profileDirectory, { isProcessAlive = (pid) => {
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code !== "ESRCH"; }
} } = {}) {
  const invalid = () => new Error("CLEANUP_PATH_INVALID");
  if (!path.isAbsolute(String(profileDirectory || ""))) throw invalid();
  const target = fs.realpathSync(profileDirectory);
  const relative = path.relative(fs.realpathSync(os.tmpdir()), target);
  if (fs.lstatSync(profileDirectory).isSymbolicLink() || path.isAbsolute(relative) ||
      relative.includes(path.sep) || !/^shenpulse-media-smoke-[a-zA-Z0-9_-]+$/.test(relative)) throw invalid();
  let marker;
  try { marker = JSON.parse(fs.readFileSync(path.join(target, ".shenpulse-media-smoke-owned"), "utf8")); }
  catch { throw invalid(); }
  if (marker.kind !== "shenpulse-media-smoke-v1" || !Number.isSafeInteger(marker.pid) || marker.pid <= 0) throw invalid();
  if (isProcessAlive(marker.pid)) throw new Error("CLEANUP_PROCESS_RUNNING");
  fs.rmSync(target, { recursive: true, force: false });
}

async function publicBytes(url, expectedSize) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".backblazeb2.com") ||
      parsed.username || parsed.password || parsed.search || parsed.hash || parsed.port) throw new Error("CHECK_FAILED");
  const response = await fetch(parsed, {
    redirect: "error", credentials: "omit", signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) return { status: response.status, contentType: "", body: Buffer.alloc(0) };
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > expectedSize) throw new Error("PUBLIC_TOO_LARGE");
    chunks.push(buffer);
  }
  return {
    status: response.status,
    contentType: String(response.headers.get("content-type") || "").split(";")[0].trim(),
    body: Buffer.concat(chunks, size)
  };
}

async function runSmoke({ safeStorage, fixtureDirectory, userDataDirectory, clonedProfileHash }) {
  let phase = "read-session";
  let uploaded = 0;
  let uploadedBytes = 0;
  const files = ["shenpulse-state.json", "shenpulse-secrets.json", "Local State"].map((name) => path.join(userDataDirectory, name));
  const before = files.map((file) => fs.readFileSync(file));
  const hashesBefore = before.map(sha256);
  let ok = false;
  try {
    if (clonedProfileHash !== hashesBefore[2]) throw new Error("PROFILE_CHANGED");
    const store = memoryAccountStore(JSON.parse(before[0]), JSON.parse(before[1]), safeStorage);
    // Seule l'identité courante est réutilisée. Pas de login administrateur,
    // création de compte, lookup d'autres utilisateurs ou consultation de LIVE.
    const accountService = new AccountService({ store });
    const service = new BackblazeMediaService({
      store,
      createUpload: (incoming) => accountService.prepareMediaUpload(incoming)
    });
    output({ phase, status: "ready" });
    for (const fixture of fixtures()) {
      const filePath = path.join(fixtureDirectory, fixture.fileName);
      fs.writeFileSync(filePath, fixture.body, { flag: "wx" });
      phase = "upload";
      const media = await service.uploadMedia(filePath, fixture.kind, { expectedUid: store.getActiveAccountUid() });
      uploaded++;
      uploadedBytes += fixture.body.length;
      output({ phase, status: "ok", mime: fixture.contentType, size: fixture.body.length, sha256: sha256(fixture.body) });
      phase = "public-read";
      const downloaded = await publicBytes(media.url, fixture.body.length);
      if (downloaded.status !== 200 || sha256(downloaded.body) !== sha256(fixture.body)) throw new Error("PUBLIC_HASH_MISMATCH");
      if (downloaded.contentType !== fixture.contentType) throw new Error("PUBLIC_TYPE_MISMATCH");
      output({ phase, status: downloaded.status, mime: downloaded.contentType, size: downloaded.body.length, sha256: sha256(downloaded.body) });
    }
    ok = true;
  } catch (error) {
    output({ phase, status: "failed", code: safeFailure(error) });
  } finally {
    // Ne jamais restaurer ou écrire ces fichiers, même si l'application réelle
    // les modifie en parallèle. Un changement externe exige une nouvelle revue.
    const unchanged = files.every((file, index) => sha256(fs.readFileSync(file)) === hashesBefore[index]);
    output({ phase: "real-files", status: unchanged ? "unchanged" : "changed-externally" });
    output({ phase: "persisted-qa-objects", status: uploaded, size: uploadedBytes });
    if (!unchanged) ok = false;
  }
  return ok;
}

async function main() {
  const cleanupIndex = process.argv.indexOf("--cleanup-profile");
  if (cleanupIndex >= 0) {
    removeSmokeProfile(process.argv[cleanupIndex + 1]);
    output({ phase: "cleanup", status: "removed" });
    return;
  }
  if (!process.argv.includes("--allow-production-upload")) {
    output({ phase: "authorization", status: "not-run", code: "ALLOW_PRODUCTION_UPLOAD_REQUIRED" });
    return;
  }
  // Ne pas accéder au getter safeStorage avant d'avoir préparé le profil : sa
  // construction pourrait initialiser OSCrypt avec une autre clé temporaire.
  const { app } = require("electron");
  if (!app?.whenReady) throw new Error("ELECTRON_REQUIRED");
  const roaming = process.env.APPDATA;
  if (!roaming || !path.isAbsolute(roaming)) throw new Error("CHECK_FAILED");
  const userDataDirectory = path.join(roaming, "ShenPulse");
  const fixtureDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-media-smoke-"));
  fs.writeFileSync(path.join(fixtureDirectory, ".shenpulse-media-smoke-owned"), JSON.stringify({
    kind: "shenpulse-media-smoke-v1", pid: process.pid
  }), { flag: "wx" });
  const clonedProfileHash = cloneEncryptionProfile(userDataDirectory, fixtureDirectory);
  // Electron ne doit créer ni cache, ni journaux dans le profil de l'application.
  app.setName("ShenPulseMediaSmoke");
  app.setPath("userData", fixtureDirectory);
  app.setPath("sessionData", fixtureDirectory);
  app.disableHardwareAcceleration();
  await app.whenReady();
  let ok = false;
  try {
    const { safeStorage } = require("electron");
    ok = await runSmoke({ safeStorage, fixtureDirectory, userDataDirectory, clonedProfileHash });
  } finally {
    app.exit(ok ? 0 : 1);
  }
}

/** Electron charge son point d'entrée via son bootstrap, sans require.main fiable. */
function isEntryPoint({ nodeMain, processType, argv = [], scriptPath = __filename }) {
  return nodeMain || (processType === "browser" && argv.some((argument) => {
    try { return path.resolve(argument) === path.resolve(scriptPath); }
    catch { return false; }
  }));
}

if (isEntryPoint({ nodeMain: require.main === module, processType: process.type, argv: process.argv })) {
  main().catch(() => {
    output({ phase: "startup", status: "failed", code: "CHECK_FAILED" });
    // Après app.whenReady, un process Electron sans fenêtre reste vivant s'il
    // n'est pas quitté explicitement, même lorsqu'une exception est remontée.
    if (process.type === "browser") require("electron").app.exit(1);
    process.exitCode = 1;
  });
}

module.exports = { cloneEncryptionProfile, fixtures, isEntryPoint, memoryAccountStore, removeSmokeProfile, runSmoke, safeFailure, sha256, silentWav };
