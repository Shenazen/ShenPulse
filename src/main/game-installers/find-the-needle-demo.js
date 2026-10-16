"use strict";

/** Installe uniquement le mod local fourni par l’utilisateur ; aucune redistribution du mod tiers. */
module.exports = {
  version: "1.1.0",
  title: "Find The Needle Demo",
  targetLabel: "dossier contenant FindTheNeedle.exe (démo Steam)",
  localArchiveOnly: true,
  autoDetect: true,
  unattended: true,
  directoryNames: ["Find The Needle Demo"],
  steamAppIds: ["5165210"],
  steamLaunchAppId: "5165210",
  executables: ["FindTheNeedle.exe"],
  launchExecutables: ["FindTheNeedle.exe"],
  warning:
    "Fermez la démo. ShenPulse installe le mod ZIP que vous fournissez, sans le télécharger ni le redistribuer. Les fichiers remplacés sont sauvegardés et les autres réglages de override.cfg sont conservés. Lancez ensuite la démo depuis Steam.",
  assets: []
};
