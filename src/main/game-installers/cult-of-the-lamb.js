"use strict";

/** Manifeste versionné du jeu « cult-of-the-lamb ». Tailles, empreintes et chemins conservés. */
const { CULT_OF_THE_LAMB_ASSET_BASE } = require("./constants");

module.exports = {
    version: "1.0.2",
    title: "Cult of the Lamb",
    targetLabel: "dossier contenant Cult Of The Lamb.exe",
    autoDetect: true,
    unattended: true,
    directoryNames: ["Cult of the Lamb", "CultOfTheLamb"],
    steamAppIds: ["1313140"],
    executables: ["Cult Of The Lamb.exe", "CultOfTheLamb.exe"],
    launchExecutables: ["Cult Of The Lamb.exe", "CultOfTheLamb.exe"],
    warning:
      "Cult of the Lamb doit être fermé. ShenPulse sauvegarde les fichiers remplacés avant d’installer BepInEx et le pont local.",
    assets: [
      {
        id: "mod",
        fileName: "cult-of-the-lamb-shenpulse-1.0.2.zip",
        action: "extract",
        size: 716315,
        sha256:
          "69a0f5a1fec72904d7acfc256de2b51dd562f7a4d9e628052a52eda69da323ea",
        url: `${CULT_OF_THE_LAMB_ASSET_BASE}/cult-of-the-lamb-shenpulse-1.0.2.zip`
      }
    ]
  };

