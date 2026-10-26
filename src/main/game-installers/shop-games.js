"use strict";

const assets = require("../../../resources/catalogs/shop-game-assets.json");
const definitions = {
  "hogwarts-legacy": { title: "Hogwarts Legacy", directoryNames: ["Hogwarts Legacy"], steamAppIds: ["990080"], xboxDirectoryNames: ["Hogwarts Legacy"], xboxIdentity: "WarnerBros.Interactive.PHX", executables: ["Phoenix/Binaries/WinGDK/HogwartsLegacy.exe", "Phoenix/Binaries/Win64/HogwartsLegacy.exe"], launchExecutables: ["gamelaunchhelper.exe", "HogwartsLegacy.exe", "Phoenix/Binaries/Win64/HogwartsLegacy.exe"], process: "HogwartsLegacy" },
  "tcg-card-shop-simulator": { title: "TCG Card Shop Simulator", directoryNames: ["TCG Card Shop Simulator"], steamAppIds: ["3070070"], xboxDirectoryNames: ["TCG Card Shop Simulator"], xboxIdentity: "OPNEONGAMES.TCGCardShopSimulator", executables: ["Card Shop Simulator.exe"], process: "Card Shop Simulator" },
  "supermarket-simulator": { title: "Supermarket Simulator", directoryNames: ["Supermarket Simulator"], steamAppIds: ["2670630"], xboxDirectoryNames: ["Supermarket Simulator"], xboxIdentity: "18814NAISU.SupermarketSimulator", executables: ["Supermarket Simulator.exe"], process: "Supermarket Simulator" },
  "shift-at-midnight": { title: "Shift At Midnight", directoryNames: ["ShiftAtMidnight", "Shift At Midnight"], steamAppIds: ["3722330"], xboxDirectoryNames: ["Shift At Midnight"], xboxIdentity: "Kwalee.ShiftAtMidnight", executables: ["ShiftAtMidnight.exe"], process: "ShiftAtMidnight" }
};

module.exports = Object.fromEntries(Object.entries(definitions).map(([id, { process: processName, ...definition }]) => [id, {
  ...definition, version: assets[id].version, autoDetect: true, unattended: true,
  targetLabel: "dossier racine du jeu installé (Content pour Xbox / Game Pass)",
  launchExecutables: definition.launchExecutables || ["gamelaunchhelper.exe", ...definition.executables],
  requireLaunchExecutable: true, singleInstanceProcesses: [processName], waitForWindowProcess: processName, waitForWindowTimeoutMs: 600000,
  warning: `Fermez ${definition.title}. ShenPulse télécharge le pack depuis Backblaze, vérifie son empreinte puis sauvegarde les fichiers remplacés.`,
  assets: [{ id: "module", action: "extract", ...assets[id] }]
}]));
