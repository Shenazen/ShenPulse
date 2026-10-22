"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { copyTreeWithBackup } = require("./deployments");
const { safeChildPath } = require("./paths");

const LEGACY_INJECTION = "\n-- ShenPulse Balatro adapter\nrequire('shenpulse.init')\n";
const INJECTION = "\n-- ShenPulse Balatro adapter\ndo local ok, err = pcall(require, 'shenpulse.init'); if not ok then print('ShenPulse: '..tostring(err)) end end\n";

async function detectBalatroEdition(targetPath) {
  const config = await fs.readFile(path.join(targetPath, "MicrosoftGame.Config"), "utf8").catch(() => "");
  if (/Identity\s+Name="PlayStack\.Balatro"/i.test(config)) return "gamepass";
  if (await fs.stat(path.join(targetPath, "Balatro.exe")).catch(() => null)) return "steam";
  throw new Error("Ce dossier ne contient pas une édition compatible de Balatro.");
}

/** Prépare les seuls fichiers du module, sans recopier le jeu ni toucher aux sauvegardes. */
async function stageBalatroInstallation({ targetPath, deploymentRoot, edition, assertAccess = () => {} }) {
  const payload = safeChildPath(deploymentRoot, ".shenpulse-balatro");
  assertAccess();
  if (edition === "gamepass") {
    const mainPath = path.join(targetPath, "Assets/main.lua");
    const original = await fs.readFile(mainPath, "utf8");
    if (!original.includes('function love.run()') || !original.includes('require "game"')) throw new Error("La version Game Pass de Balatro ne correspond pas au moteur attendu.");
    const moduleRoot = path.join(deploymentRoot, "Assets/shenpulse");
    await copyTreeWithBackup(path.join(payload, "gamepass"), moduleRoot, deploymentRoot, path.join(payload, "backup"), { assertAccess });
    const codes = require("../../../resources/catalogs/balatro-effects.json").map(effect => effect.code);
    await fs.mkdir(path.join(moduleRoot, "channel"), { recursive: true });
    await fs.writeFile(path.join(moduleRoot, "channel/config.json"), JSON.stringify({
      token: crypto.randomBytes(32).toString("hex"), codes,
      directory: path.join(targetPath, "Assets/shenpulse/channel").replace(/\\/g, "/")
    }));
    await fs.writeFile(path.join(deploymentRoot, "Assets/main.lua"), original.replace(LEGACY_INJECTION, "").replace(INJECTION, "") + INJECTION);
    await fs.rm(safeChildPath(deploymentRoot, ".shenpulse-balatro-mods"), { recursive: true, force: true });
  }
  assertAccess();
  // Le payload de préparation ne doit pas être installé dans le dossier du jeu.
  await fs.rm(payload, { recursive: true, force: true });
}

module.exports = { detectBalatroEdition, stageBalatroInstallation, INJECTION };
