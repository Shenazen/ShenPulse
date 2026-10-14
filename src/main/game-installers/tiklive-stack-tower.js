"use strict";

/** Manifeste versionné du jeu « tiklive-stack-tower ». Tailles, empreintes et chemins conservés. */
const { TIKLIVE_STACK_TOWER_ASSET_BASE } = require("./constants");

module.exports = {
    version: "1.0.0-shenpulse1",
    title: "ShenPulse Stack Tower",
    targetLabel: "dossier autonome géré par ShenPulse",
    managedTarget: true,
    unattended: true,
    launchExecutables: ["ShenPulse Stack Tower.exe"],
    warning:
      "ShenPulse télécharge et installe automatiquement la version autonome de Stack Tower dans son espace local géré.",
    note:
      "Les fichiers téléchargés et la zone de préparation temporaire sont supprimés après l’installation, y compris en cas d’échec.",
    assets: [
      {
        id: "game",
        fileName: "ShenPulse-Stack-Tower-1.0.0-shenpulse1.zip",
        action: "extract",
        targetPath: "",
        size: 38164935,
        sha256:
          "32547a3f680581c36fa3d256f5e3e535fdbca6683266e757eec1832a7e12dc7c",
        url: `${TIKLIVE_STACK_TOWER_ASSET_BASE}/ShenPulse-Stack-Tower-1.0.0-shenpulse1.zip`
      }
    ]
  };

