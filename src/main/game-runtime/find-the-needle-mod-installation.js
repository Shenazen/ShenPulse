"use strict";

/** Installation du ZIP détenu par l’utilisateur, sans hébergement ni copie du mod dans ShenPulse. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { extractArchiveSafe } = require("./archives");
const { commitInstallationDeployment } = require("./deployments");
const { runProcess } = require("./processes");
const { safeChildPath } = require("./paths");

const MOD_ARCHIVE_SHA256 = "8f49ffa901842f0308efa1ee25aac6533a11657937c59260dbcf166754a3b703";
const MOD_ARCHIVE_NAME = "1791902097404_s2e-find-the-needle-v1.zip";
const MOD_DIRECTORY = "mods/s2e-find-the-needle/";
const MOD_FILES = Object.freeze([
  "commands.json", "config.json", "construction.gd", "effect_icon.gd", "effects.gd",
  "english_text.gd", "game_adapter.gd", "http_server.gd", "persistent_props.gd",
  "persistent_strands.gd", "presentation.gd", "priced_build_manager.gd",
  "priced_build_tool.gd", "s2e.gd", "tornado.gd"
].map((file) => `${MOD_DIRECTORY}${file}`));
const ARCHIVE_FILES = new Set([...MOD_FILES, "override.cfg", "README.txt", "s2e_info.json", "find-the-needle-commands.json"]);
const AUTOLOAD_ENTRY = 'S2EFindTheNeedle="*mods/s2e-find-the-needle/s2e.gd"';

/** Conserve intégralement rendu, autres autoloads et commentaires ; ne remplace que notre clé. */
function mergeNeedleOverride(source = "") {
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const lines = String(source).replaceAll("\r\n", "\n").split("\n");
  let section = "";
  let firstAutoloadEnd = -1;
  let foundAutoload = false;
  let entryWritten = false;
  const output = [];
  for (const line of lines) {
    const header = line.trim().replace(/^\uFEFF/, "").match(/^\[([^\]]+)\]\s*(?:;.*)?$/);
    if (header) {
      if (section === "autoload" && firstAutoloadEnd < 0) firstAutoloadEnd = output.length;
      section = header[1].trim();
      if (section === "autoload") foundAutoload = true;
    }
    if (section === "autoload" && /^\s*S2EFindTheNeedle\s*=/.test(line)) {
      if (!entryWritten) output.push(AUTOLOAD_ENTRY);
      entryWritten = true;
    } else output.push(line);
  }
  if (!entryWritten) {
    if (!foundAutoload) output.push("", "[autoload]", "", AUTOLOAD_ENTRY);
    else output.splice(firstAutoloadEnd < 0 ? output.length : firstAutoloadEnd, 0, AUTOLOAD_ENTRY);
  }
  return output.join(newline).replace(/(?:\r?\n)*$/, newline);
}

async function assertGameClosed() {
  if (process.platform !== "win32") return;
  const listing = await runProcess("tasklist.exe", ["/FI", "IMAGENAME eq FindTheNeedle.exe", "/FO", "CSV", "/NH"]);
  if (/"FindTheNeedle\.exe"/i.test(listing)) {
    throw new Error("Fermez Find The Needle Demo avant d’installer le mod, puis réessayez.");
  }
}

/** Refuse les jonctions/liens avant toute écriture dans une arborescence de jeu. */
async function assertSafeModTargets(targetPath, relativeFiles) {
  const root = path.resolve(targetPath);
  if (root === path.parse(root).root) throw new Error("Le dossier du jeu ne peut pas être une racine de disque.");
  for (const relative of ["", ...relativeFiles]) {
    const target = safeChildPath(root, relative);
    const components = path.relative(root, target).split(path.sep).filter(Boolean);
    let current = root;
    for (const component of ["", ...components]) {
      if (component) current = path.join(current, component);
      const stat = await fs.promises.lstat(current).catch((error) => { if (error.code === "ENOENT") return null; throw error; });
      if (stat?.isSymbolicLink()) throw new Error("Installation refusée : le dossier du mod contient un lien ou une jonction.");
    }
  }
}

async function validateExtractedMod(directory) {
  const files = [];
  async function walk(current, prefix = "") {
    for (const entry of await fs.promises.readdir(current, { withFileTypes: true })) {
      const relative = `${prefix}${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error("Le ZIP du mod contient un lien interdit.");
      if (entry.isDirectory()) {
        if (!["mods", "mods/s2e-find-the-needle"].includes(relative)) throw new Error("Dossier du ZIP non autorisé.");
        await walk(path.join(current, entry.name), `${relative}/`);
      } else if (entry.isFile() && ARCHIVE_FILES.has(relative)) files.push(relative);
      else throw new Error(`Fichier du ZIP non autorisé : ${relative}`);
    }
  }
  await walk(directory);
  if (files.length !== ARCHIVE_FILES.size || [...ARCHIVE_FILES].some((file) => !files.includes(file))) {
    throw new Error("Le ZIP est incomplet ou ne correspond pas au mod Find The Needle pris en charge.");
  }
  return files;
}

async function selectArchive(runtime, previousInstallation) {
  const candidates = [previousInstallation?.archivePath, path.join(runtime.app.getPath("downloads"), MOD_ARCHIVE_NAME)].filter(Boolean);
  for (const candidate of candidates) {
    if ((await fs.promises.stat(candidate).catch(() => null))?.isFile()) return candidate;
  }
  const selection = await runtime.dialog.showOpenDialog(runtime.getWindow(), {
    title: "Choisissez le ZIP du mod Find The Needle v1",
    buttonLabel: "Utiliser ce mod local",
    properties: ["openFile"],
    filters: [{ name: "Mod Find The Needle (ZIP)", extensions: ["zip"] }]
  });
  return selection.canceled ? "" : selection.filePaths[0] || "";
}

async function readVerifiedArchive(archivePath) {
  const stat = await fs.promises.stat(archivePath);
  if (!stat.isFile() || stat.size !== 37888) throw new Error("Le ZIP fourni ne correspond pas à la version 1 du mod Find The Needle.");
  const archive = await fs.promises.readFile(archivePath);
  const hash = crypto.createHash("sha256").update(archive).digest("hex");
  if (hash !== MOD_ARCHIVE_SHA256) throw new Error("ZIP du mod inconnu ou modifié. Fournissez l’archive originale Find The Needle v1.");
  return { archive, hash };
}

async function installFindTheNeedleMod(runtime, { gameId, manifest, targetPath, previousInstallation, assertAccess }, dependencies = {}) {
  if (gameId !== "find-the-needle-demo") throw new Error("Ce mod local est réservé à Find The Needle Demo.");
  const ensureClosed = dependencies.assertGameClosed || assertGameClosed;
  const extract = dependencies.extractArchiveSafe || extractArchiveSafe;
  const commit = dependencies.commitInstallationDeployment || commitInstallationDeployment;
  const readArchive = dependencies.readVerifiedArchive || readVerifiedArchive;
  assertAccess();
  await ensureClosed();
  const archivePath = await selectArchive(runtime, previousInstallation);
  if (!archivePath) return { canceled: true };
  const { archive, hash } = await readArchive(archivePath);
  assertAccess();
  await assertSafeModTargets(targetPath, [...MOD_FILES, "override.cfg"]);
  const tempRoot = await fs.promises.mkdtemp(path.join(runtime.app.getPath("temp"), "shenpulse-needle-mod-"));
  try {
    const localArchive = path.join(tempRoot, "user-mod.zip");
    const extractedRoot = path.join(tempRoot, "extracted");
    const deploymentRoot = path.join(tempRoot, "deployment");
    await fs.promises.writeFile(localArchive, archive, { flag: "wx" });
    runtime.progress(gameId, { phase: "prepare", percent: 20, message: "Vérification du mod local fourni…" });
    await extract(localArchive, extractedRoot);
    await validateExtractedMod(extractedRoot);
    let modConfig;
    let originalConfig = null;
    for (const relative of MOD_FILES) {
      const destination = safeChildPath(deploymentRoot, relative);
      await fs.promises.mkdir(path.dirname(destination), { recursive: true });
      const existingConfig = relative.endsWith("/config.json") ? await fs.promises.readFile(safeChildPath(targetPath, relative)).catch((error) => { if (error.code === "ENOENT") return null; throw error; }) : null;
      if (relative.endsWith("/config.json")) {
        originalConfig = existingConfig;
        const configBuffer = existingConfig || await fs.promises.readFile(safeChildPath(extractedRoot, relative));
        try { modConfig = JSON.parse(configBuffer.toString("utf8")); }
        catch { throw new Error("Le fichier config.json du mod est invalide. Il n’a pas été modifié."); }
        if (!modConfig || typeof modConfig !== "object" || Array.isArray(modConfig) || !Number.isInteger(modConfig.port) || modConfig.port < 1024 || modConfig.port > 65535 || typeof modConfig.token !== "string" || modConfig.token && !/^[\x21-\x7e]{1,512}$/.test(modConfig.token)) {
          throw new Error("La configuration locale du mod contient un port ou un jeton invalide. Elle n’a pas été modifiée.");
        }
        if (!existingConfig) {
          modConfig.token = crypto.randomBytes(32).toString("hex");
          await fs.promises.writeFile(destination, `${JSON.stringify(modConfig, null, 2)}\n`);
        } else await fs.promises.writeFile(destination, configBuffer);
        if (modConfig.token && typeof runtime.store.setSecret !== "function") throw new Error("Le stockage chiffré du jeton local n’est pas disponible.");
        if (modConfig.token && Object.hasOwn(runtime.store, "safeStorage") && runtime.store.safeStorage?.isEncryptionAvailable?.() !== true) throw new Error("Le chiffrement local du jeton n’est pas disponible. Aucun fichier du jeu n’a été modifié.");
      } else await fs.promises.copyFile(safeChildPath(extractedRoot, relative), destination);
    }
    const overridePath = safeChildPath(targetPath, "override.cfg");
    const before = await fs.promises.readFile(overridePath, "utf8").catch((error) => { if (error.code === "ENOENT") return ""; throw error; });
    await fs.promises.writeFile(path.join(deploymentRoot, "override.cfg"), mergeNeedleOverride(before), "utf8");
    assertAccess();
    await ensureClosed();
    await assertSafeModTargets(targetPath, [...MOD_FILES, "override.cfg"]);
    const current = await fs.promises.readFile(overridePath, "utf8").catch((error) => { if (error.code === "ENOENT") return ""; throw error; });
    if (current !== before) throw new Error("override.cfg a changé pendant la préparation. Réessayez pour conserver ses nouveaux réglages.");
    const currentConfig = await fs.promises.readFile(safeChildPath(targetPath, `${MOD_DIRECTORY}config.json`)).catch((error) => { if (error.code === "ENOENT") return null; throw error; });
    if (Boolean(currentConfig) !== Boolean(originalConfig) || currentConfig && !currentConfig.equals(originalConfig)) throw new Error("config.json a changé pendant la préparation. Réessayez pour conserver ses nouveaux réglages.");
    const installedAt = new Date().toISOString();
    const backupRoot = path.join(runtime.app.getPath("userData"), "installer-backups", gameId, `${installedAt.replace(/[:.]/g, "-")}-${crypto.randomBytes(3).toString("hex")}`);
    runtime.progress(gameId, { phase: "install", percent: 70, message: "Installation du mod et sauvegarde des fichiers remplacés…" });
    assertAccess();
    // Écrire d’abord un nouveau secret, jamais écraser l’ancien : en cas d’échec
    // du déploiement il reste au pire une référence inutilisée, pas un mod bloqué.
    const secretId = modConfig.token ? runtime.store.setSecret("", modConfig.token) : "";
    if (modConfig.token && !secretId) throw new Error("Le jeton local n’a pas pu être conservé dans le coffre chiffré.");
    assertAccess();
    let deployment;
    try {
      deployment = await commit({ deploymentRoot, targetPath, backupRoot, tempRoot, assertAccess });
    } catch (error) {
      error.backupPath = backupRoot;
      const hasBackup = (await fs.promises.stat(backupRoot).catch(() => null))?.isDirectory();
      if (hasBackup) error.message += `\nLes fichiers déjà sauvegardés sont conservés ici : ${backupRoot}`;
      else error.message += `\nDossier de sauvegarde prévu : ${backupRoot}`;
      throw error;
    }
    assertAccess();
    runtime.store.mutate((state) => {
      state.game.installations ||= {};
      state.game.installations[gameId] = {
        gameId, path: targetPath, backupPath: backupRoot, installedAt,
        assetCount: MOD_FILES.length + 1, installerVersion: manifest.version,
        source: "user-provided-mod", modVersion: "1", modArchiveSha256: hash,
        archivePath, elevated: deployment.elevated, additionalDeployments: []
      };
      state.game.connectorOverrides ||= {};
      state.game.connectorOverrides[gameId] = { ...(state.game.connectorOverrides[gameId] || {}), secretId, url: `http://127.0.0.1:${modConfig.port}` };
    });
    runtime.progress(gameId, { phase: "complete", percent: 100, message: "Mod installé. Lancez la démo depuis Steam puis chargez votre partie." });
    return { ok: true, gameId, path: targetPath, backupPath: backupRoot, installedAt, modInstalled: true };
  } finally {
    await fs.promises.rm(tempRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  }
}

module.exports = { MOD_ARCHIVE_SHA256, MOD_FILES, mergeNeedleOverride, validateExtractedMod, assertSafeModTargets, readVerifiedArchive, installFindTheNeedleMod };
