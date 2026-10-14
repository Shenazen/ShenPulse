"use strict";

/** Manifeste versionné du jeu « terraria ». Tailles, empreintes et chemins conservés. */
const { TERRARIA_ASSET_BASE } = require("./constants");

module.exports = {
    version: "1.0.0",
    title: "Terraria / tModLoader",
    targetLabel: "dossier contenant tModLoader.exe",
    autoDetect: true,
    unattended: true,
    directoryNames: ["tModLoader"],
    steamAppIds: ["1281930"],
    executables: ["tModLoader.exe"],
    launchExecutables: ["tModLoader.exe"],
    warning:
      "tModLoader doit être fermé. ShenPulse sauvegarde le mod existant puis installe le pont local préconfiguré sur le port 58433.",
    assets: [
      {
        id: "mod",
        fileName: "CrowdControlMod.tmod",
        action: "copy",
        targetPath: "Mods",
        size: 935576,
        sha256:
          "053e15396bd232e73655a00b782fbe43dae96f5669e6dea44c60e3b6800c4ab2",
        url: `${TERRARIA_ASSET_BASE}/CrowdControlMod.tmod`
      }
    ],
    additionalInstallTargets: [
      {
        sourcePath: "Mods/CrowdControlMod.tmod",
        root: "documents",
        targetPath: "My Games/Terraria/tModLoader/Mods/CrowdControlMod.tmod"
      }
    ]
  };

