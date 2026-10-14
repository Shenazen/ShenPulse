"use strict";

/** Manifeste versionné du jeu « tiklive-climb ». Tailles, empreintes et chemins conservés. */
const { TIKLIVE_CLIMB_ASSET_BASE } = require("./constants");

module.exports = {
    version: "1.0.0-shenpulse1",
    title: "ShenPulse Climb",
    targetLabel: "dossier autonome géré par ShenPulse",
    managedTarget: true,
    unattended: true,
    launchExecutables: ["ShenPulse Climb.exe"],
    warning:
      "ShenPulse télécharge et installe automatiquement la version autonome de Climb dans son espace local géré.",
    note:
      "Les fichiers téléchargés et la zone de préparation temporaire sont supprimés après l’installation, y compris en cas d’échec.",
    assets: [
      {
        id: "game",
        fileName: "ShenPulse-Climb-1.0.0-shenpulse1.zip",
        action: "extract",
        targetPath: "",
        size: 38061187,
        sha256:
          "1e01dfe77e0dd0e0d7f70e7c9f25e203625a1b60519757775b5273231cb5a688",
        url: `${TIKLIVE_CLIMB_ASSET_BASE}/ShenPulse-Climb-1.0.0-shenpulse1.zip`
      }
    ]
  };

