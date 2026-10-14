"use strict";

/** Manifeste versionné du jeu « clash-of-live ». Tailles, empreintes et chemins conservés. */
const { CLASH_OF_LIVE_ASSET_BASE } = require("./constants");

module.exports = {
    version: "1.0.0-shenpulse1",
    title: "Clash Of ShenPulse",
    targetLabel: "dossier autonome géré par ShenPulse",
    managedTarget: true,
    unattended: true,
    launchExecutables: ["Clash Of ShenPulse.exe"],
    warning:
      "ShenPulse télécharge et installe automatiquement la version autonome de Clash Of ShenPulse dans son espace local géré.",
    note:
      "Les fichiers téléchargés et la zone de préparation temporaire sont supprimés après l’installation, y compris en cas d’échec.",
    assets: [
      {
        id: "game",
        fileName: "Clash-Of-ShenPulse-1.0.0-shenpulse1.zip",
        action: "extract",
        targetPath: "",
        size: 35021268,
        sha256:
          "bf49da011d7029864e1456eab64700d448b476cdefeaf4a95ceb1e4456c98a56",
        url: `${CLASH_OF_LIVE_ASSET_BASE}/Clash-Of-ShenPulse-1.0.0-shenpulse1.zip`
      }
    ]
  };

