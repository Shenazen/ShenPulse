"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomBytes } = require("node:crypto");

const MARKER = ".shenpulse-profile.json";
const preparing = new Map();
const xml = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
const canonical = value => process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value);
const inside = (root, child) => { const relative = path.relative(canonical(root), canonical(child)); return !relative || (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative)); };

/** Steam's writable profile belongs in AppData. The Xbox edition already uses AppData. */
async function farmingRuntimeProfile(targetPath, options = {}) {
  const original = await require("./farming-profile").farmingProfile(targetPath, options);
  if (original.platform === "xbox") return original;
  const local = options.localAppDataPath || process.env.LOCALAPPDATA;
  if (!local || !path.isAbsolute(local)) throw Error("Le dossier local de ShenPulse est introuvable.");
  const directory = path.join(local, "ShenPulse/game-profiles/farming-simulator-25/steam");
  // Never follow a redirected managed profile back into Documents.
  const effective = await fs.realpath(directory).catch(error => { if (error.code === "ENOENT") return directory; throw error; });
  if (inside(options.documentsPath, effective) || inside(effective, original.directory)) throw Error("Le profil Farming de ShenPulse doit rester dans son dossier local, en dehors de Documents.");
  return { directory, modsDirectory: path.join(directory, "mods"), sourceDirectory: original.directory, sourceModsDirectory: original.modsDirectory, platform: "steam", managed: true };
}

function managedSettings(source, modsDirectory) {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw Error("Les réglages Farming contiennent un format XML non pris en charge.");
  const override = '<modsDirectoryOverride active="true" directory="' + xml(modsDirectory.replace(/\\/g, "/")) + '" />';
  const expression = /<modsDirectoryOverride\b[^>]*(?:\/>|>\s*<\/modsDirectoryOverride>)/i;
  if (expression.test(source)) return source.replace(expression, () => override);
  if (!/<\/gameSettings>/i.test(source)) throw Error("Les réglages Farming sont incomplets.");
  return source.replace(/<\/gameSettings>/i, () => override + "\n</gameSettings>");
}

/** Copy only: no hard links, junctions, moves, or writes into the original profile. */
async function importTree(source, destination, { assertAccess, skip = () => false }) {
  assertAccess();
  const stat = await fs.lstat(source);
  if (stat.isSymbolicLink()) throw Error("Le profil Farming contient un lien de dossier à vérifier avant son import : " + source);
  if (stat.isDirectory()) {
    await fs.mkdir(destination, { recursive: true });
    for (const entry of await fs.readdir(source, { withFileTypes: true })) {
      if (!skip(entry.name)) await importTree(path.join(source, entry.name), path.join(destination, entry.name), { assertAccess });
    }
  } else if (stat.isFile()) {
    await fs.copyFile(source, destination, fs.constants.COPYFILE_EXCL);
    await fs.utimes(destination, stat.atime, stat.mtime);
  }
}

async function verifyMarker(profile) {
  const raw = await fs.readFile(path.join(profile.directory, MARKER), "utf8").catch(error => { if (error.code === "ENOENT") return ""; throw error; });
  if (!raw) return false;
  const marker = JSON.parse(raw);
  if (marker.version !== 1 || marker.game !== "farming-simulator-25" || marker.platform !== "steam" || canonical(marker.sourceDirectory) !== canonical(profile.sourceDirectory)) {
    throw Error("Le profil Farming local ne correspond pas à cette installation Windows. Ses parties ont été conservées.");
  }
  return true;
}

async function initializeProfile(profile, assertAccess, assertClosed) {
  if (await verifyMarker(profile)) return;
  if (await fs.stat(profile.directory).catch(error => { if (error.code === "ENOENT") return null; throw error; })) {
    throw Error("Un profil Farming local sans reçu d’import existe déjà. Ses fichiers ont été conservés ; son import doit être vérifié.");
  }
  await assertClosed();
  const parent = path.dirname(profile.directory);
  await fs.mkdir(parent, { recursive: true });
  const staging = await fs.mkdtemp(path.join(parent, "steam-import-"));
  try {
    const entries = await fs.readdir(profile.sourceDirectory, { withFileTypes: true }).catch(error => { if (error.code === "ENOENT") return []; throw error; });
    const files = /^(?:game\.xml|gameSettings\.xml|inputBinding\.xml|VERSION|(?:AVD|IDT)_\d+\.dat)$/i;
    const folders = /^(?:savegame(?:[1-9]|1[0-9]|20)|savegameBackup|inputDevices|inputDevicesManual|music|pdlc|modSettings)$/i;
    for (const entry of entries) {
      if (files.test(entry.name) || folders.test(entry.name)) {
        await importTree(path.join(profile.sourceDirectory, entry.name), path.join(staging, entry.name), {
          assertAccess, skip: entry.name.toLowerCase() === "modsettings" ? name => name.toLowerCase() === "shenpulse" : () => false
        });
      }
    }
    const mods = path.join(staging, "mods");
    if (await fs.stat(profile.sourceModsDirectory).catch(error => { if (error.code === "ENOENT") return null; throw error; })) {
      await importTree(profile.sourceModsDirectory, mods, { assertAccess, skip: name => name.toLowerCase() === "fs25_shenpulse.zip" });
    } else await fs.mkdir(mods);
    const settings = path.join(staging, "gameSettings.xml");
    const original = await fs.readFile(settings, "utf8").catch(error => { if (error.code === "ENOENT") return ""; throw error; });
    if (original) await fs.writeFile(settings, managedSettings(original, profile.modsDirectory), "utf8");
    assertAccess();
    await fs.writeFile(path.join(staging, MARKER), JSON.stringify({ version: 1, game: "farming-simulator-25", platform: "steam", sourceDirectory: profile.sourceDirectory, importedAt: new Date().toISOString() }, null, 2));
    await fs.rename(staging, profile.directory);
  } finally {
    // The only recursive cleanup target is our own freshly created staging folder.
    if (inside(parent, staging) && path.basename(staging).startsWith("steam-import-")) await fs.rm(staging, { recursive: true, force: true });
  }
}

async function installModule(profile, modulePath, expected, assertAccess, assertClosed) {
  const bytes = await fs.readFile(modulePath);
  if (!/^[a-f0-9]{64}$/.test(expected || "") || createHash("sha256").update(bytes).digest("hex") !== expected) throw Error("Le module Farming doit être réparé depuis ShenPulse.");
  const target = path.join(profile.modsDirectory, "FS25_ShenPulse.zip");
  const previous = await fs.readFile(target).catch(error => { if (error.code === "ENOENT") return null; throw error; });
  if (previous && previous.equals(bytes)) return;
  assertAccess();
  await assertClosed();
  if (previous) {
    const backup = path.join(profile.directory, "shenpulse-module-backups");
    await fs.mkdir(backup, { recursive: true });
    const hash = createHash("sha256").update(previous).digest("hex");
    await fs.writeFile(path.join(backup, hash + ".zip"), previous);
  }
  const temporary = target + "." + randomBytes(6).toString("hex") + ".tmp";
  try {
    await fs.writeFile(temporary, bytes, { flag: "wx" });
    assertAccess();
    await fs.rename(temporary, target);
  } finally { await fs.rm(temporary, { force: true }); }
}

/** Installation and connection use the same profile; reinstallation never reimports saves. */
async function prepareFarmingRuntimeProfile(targetPath, { modulePath, moduleSha256, assertAccess = () => {}, assertClosed, ...options } = {}) {
  const profile = await farmingRuntimeProfile(targetPath, options);
  if (!profile.managed) return profile;
  const key = canonical(profile.directory);
  const operation = (preparing.get(key) || Promise.resolve()).catch(() => {}).then(async () => {
    const closed = assertClosed || (() => require("./mod-installation-ready").assertModGameClosed("farming-simulator-25", targetPath));
    assertAccess();
    await initializeProfile(profile, assertAccess, closed);
    if (modulePath) await installModule(profile, modulePath, moduleSha256, assertAccess, closed);
    assertAccess();
    return profile;
  });
  preparing.set(key, operation);
  try { return await operation; } finally { if (preparing.get(key) === operation) preparing.delete(key); }
}

function farmingSteamLaunchUri(directory) {
  if (!path.isAbsolute(directory) || /["\r\n\0]/.test(directory)) throw Error("Le dossier local Farming est invalide.");
  return "steam://run/2300320//" + encodeURIComponent('-profile "' + directory + '"') + "/";
}

function assertFarmingRunningProfile(existing, profile) {
  if (!existing || !profile.managed) return;
  for (const running of existing.processes || [existing]) {
    const argument = running.CommandLine?.match(/(?:^|\s)-profile\s+(?:"([^"]+)"|(\S+))/i);
    if (!argument || canonical(argument[1] || argument[2]) !== canonical(profile.directory)) throw Error("Farming Simulator 25 est ouvert avec un autre profil. Fermez le jeu, puis relancez-le depuis ShenPulse pour charger vos interactions et vos parties importées.");
  }
}

module.exports = { farmingRuntimeProfile, prepareFarmingRuntimeProfile, farmingSteamLaunchUri, assertFarmingRunningProfile, managedSettings };
