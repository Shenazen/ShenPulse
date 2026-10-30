"use strict";

const records = require("../../../resources/catalogs/owner-game-preparation.json").games;
const modules = require("../../../resources/catalogs/owner-prepared-modules.json");
const { ownerGameListed } = require("../../shared/owner-game-catalog-policy");
module.exports = Object.fromEntries(records.filter(record => ownerGameListed(record) && modules[record.id]).map(record => {
  const prepared = modules[record.id];
  const definition = prepared.installer || record.installer;
  const executables = definition.executables;
  return [record.id, {
    title: record.name,
    version: prepared.version,
    autoDetect: !definition.managedTarget,
    unattended: true,
    detectPlatform: true,
    forceSteamLaunch: Boolean(definition.steamAppIds?.length),
    targetLabel: "dossier racine de l’édition du jeu à préparer",
    directoryNames: definition.directoryNames || [],
    steamAppIds: definition.steamAppIds || [],
    ...(record.platforms.includes("game-pass") ? {xboxDirectoryNames: definition.directoryNames} : {}),
    executables,
    launchExecutables: ["gamelaunchhelper.exe", ...executables],
    requireLaunchExecutable: true,
    singleInstanceProcesses: executables.map(name => name.split("/").at(-1).replace(/\.exe$/i, "")),
    ...prepared.installer,
    warning: "Fermez le jeu. ShenPulse télécharge le module vérifié depuis Backblaze et conserve les fichiers remplacés." + (prepared.inGameValidation && prepared.inGameValidation !== "pending" ? " Les essais de cette version ont été effectués sur Xbox / Game Pass." : " Ce pack privé n’a pas encore été vérifié en partie."),
    assets: [...(prepared.additionalAssets || []), prepared.asset]
  }];
}));
