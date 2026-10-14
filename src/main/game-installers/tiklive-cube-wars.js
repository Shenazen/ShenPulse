"use strict";

/** Manifeste versionné du jeu « tiklive-cube-wars ». Tailles, empreintes et chemins conservés. */
const { TIKLIVE_CUBE_WARS_ASSET_BASE } = require("./constants");

module.exports = {
    version: "1.0.0-shenpulse1",
    title: "ShenPulse Cube Wars",
    targetLabel: "dossier autonome géré par ShenPulse",
    managedTarget: true,
    unattended: true,
    launchExecutables: ["ShenPulse Cube Wars.exe"],
    warning:
      "ShenPulse télécharge et installe automatiquement la version autonome de Cube Wars dans son espace local géré.",
    note:
      "Les fichiers téléchargés et la zone de préparation temporaire sont supprimés après l’installation, y compris en cas d’échec.",
    assets: [
      {
        id: "game",
        fileName: "ShenPulse-Cube-Wars-1.0.0-shenpulse1.zip",
        action: "extract",
        targetPath: "",
        size: 38136590,
        sha256:
          "2ffa7f41ed1197cb725e0af45d7449be80029336ebd2a0093adf79a243c80cf4",
        url: `${TIKLIVE_CUBE_WARS_ASSET_BASE}/ShenPulse-Cube-Wars-1.0.0-shenpulse1.zip`
      }
    ]
  };

