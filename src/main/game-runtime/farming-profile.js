"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const XBOX_IDENTITY = "GIANTSSoftware.FarmingSimulator25PC";

/** The Microsoft edition keeps its profile outside Documents. */
async function farmingProfile(targetPath, { documentsPath, localAppDataPath = process.env.LOCALAPPDATA } = {}) {
  const config = await fs.readFile(path.join(targetPath, "MicrosoftGame.config"), "utf8").catch(() => "");
  const xbox = config.match(/<Identity\s+Name="([^"]+)"/i)?.[1] === XBOX_IDENTITY;
  let directory;
  if (xbox) {
    if (!localAppDataPath || !path.isAbsolute(localAppDataPath)) throw Error("Le dossier du profil Xbox de Farming Simulator est introuvable.");
    const packages = path.join(localAppDataPath, "Packages");
    const entries = await fs.readdir(packages, { withFileTypes: true }).catch(() => []);
    const matches = entries.filter(entry => entry.isDirectory() && entry.name.startsWith(XBOX_IDENTITY + "_") && !entry.name.includes(".."));
    if (matches.length !== 1) throw Error("Lancez Farming Simulator 25 depuis Xbox une première fois, puis réessayez l’installation des interactions.");
    directory = path.join(packages, matches[0].name, "LocalCache", "Local");
  } else {
    if (!documentsPath || !path.isAbsolute(documentsPath)) throw Error("Le dossier Documents de Farming Simulator est introuvable.");
    directory = path.join(documentsPath, "My Games", "FarmingSimulator2025");
  }
  const settings = await fs.readFile(path.join(directory, "gameSettings.xml"), "utf8").catch(() => "");
  const override = !/<!DOCTYPE|<!ENTITY/i.test(settings) && settings.match(/<modsDirectoryOverride\b[^>]*\bactive="true"[^>]*>/i)?.[0];
  const custom = override && override.match(/\bdirectory="([^"]+)"/)?.[1];
  const modsDirectory = custom && path.isAbsolute(custom) ? custom : path.join(directory, "mods");
  return { directory, modsDirectory, platform: xbox ? "xbox" : "steam" };
}

module.exports = { farmingProfile, XBOX_IDENTITY };
