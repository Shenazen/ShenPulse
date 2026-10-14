"use strict";

/** Manifeste versionné du jeu « color-strike ». Tailles, empreintes et chemins conservés. */
const { COLOR_STRIKE_ASSET_BASE } = require("./constants");

module.exports = {
    version: "1.0.9-shenpulse2",
    title: "ShenPulse Color Strike",
    targetLabel: "dossier autonome géré par ShenPulse",
    managedTarget: true,
    unattended: true,
    launchExecutables: ["ShenPulse Color Strike.exe"],
    warning:
      "ShenPulse télécharge et installe automatiquement la version autonome de Color Strike dans son espace local géré.",
    note:
      "Les fichiers téléchargés et la zone de préparation temporaire sont supprimés après l’installation, y compris en cas d’échec.",
    assets: [
      {
        id: "game",
        fileName: "ShenPulse-Color-Strike-1.0.9-shenpulse2.zip",
        action: "extract",
        targetPath: "",
        size: 36481280,
        sha256:
          "3651ae7d70629530dd47c9945c360bd869dd642e41ed8b86a12dc73d21062d7d",
        url: `${COLOR_STRIKE_ASSET_BASE}/ShenPulse-Color-Strike-1.0.9-shenpulse2.zip`
      }
    ]
  };

