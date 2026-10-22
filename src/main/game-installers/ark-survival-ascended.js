"use strict";

module.exports = {
  version: "1.0.0",
  title: "ARK: Survival Ascended",
  targetLabel: "dossier ARK contenant ShooterGame (dossier Content pour Xbox Game Pass)",
  setupOnly: true, autoDetect: true, unattended: true,
  directoryNames: ["ARK Survival Ascended"],
  steamAppIds: ["2399830"],
  xboxDirectoryNames: ["ARK- Survival Ascended", "ARK Survival Ascended"],
  xboxIdentity: "StudioWildcard.ARKSurvivalAscended",
  executables: ["ShooterGame/Binaries/WinGDK/ArkAscended.exe", "ShooterGame/Binaries/Win64/ArkAscended.exe"],
  launchExecutables: ["gamelaunchhelper.exe", "ShooterGame/Binaries/Win64/ArkAscended.exe"],
  requireLaunchExecutable: true,
  waitForWindowProcess: "ArkAscended", waitForWindowTimeoutMs: 180000,
  warning: "ShenPulse associe le dossier Steam ou Xbox Game Pass au connecteur clavier et souris. Aucun fichier du jeu ni aucune sauvegarde n’est modifié.",
  assets: []
};
