"use strict";

/** Manifeste versionné du jeu « demonologist ». Tailles, empreintes et chemins conservés. */
module.exports = {
    version: "1.0.0",
    title: "Demonologist",
    targetLabel: "dossier contenant Demonologist.exe",
    setupOnly: true,
    autoDetect: true,
    unattended: true,
    directoryNames: ["Demonologist"],
    steamAppIds: ["1929610", "2302560"],
    executables: ["Demonologist.exe"],
    launchExecutables: ["Demonologist.exe"],
    waitForWindowProcess: "Shivers-Win64-Shipping",
    warning:
      "ShenPulse associe le dossier de Demonologist au connecteur d’interactions clavier et souris. Aucun fichier du jeu n’est modifié.",
    assets: []
  };

