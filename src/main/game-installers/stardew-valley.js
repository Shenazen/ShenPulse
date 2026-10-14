"use strict";

/** Manifeste versionné du jeu « stardew-valley ». Tailles, empreintes et chemins conservés. */
const { STARDEW_VALLEY_ASSET_BASE } = require("./constants");

module.exports = {
    version: "1.0.0",
    title: "Stardew Valley",
    targetLabel: "dossier contenant Stardew Valley.exe",
    autoDetect: true,
    unattended: true,
    directoryNames: ["Stardew Valley", "StardewValley"],
    steamAppIds: ["413150"],
    executables: ["Stardew Valley.exe", "StardewValley.exe"],
    launchExecutables: [
      "StardewModdingAPI.exe",
      "Stardew Valley.exe",
      "StardewValley.exe"
    ],
    warning:
      "Stardew Valley doit être fermé. ShenPulse sauvegarde les fichiers remplacés, installe SMAPI puis le mod local préconfiguré sur le port 58432.",
    assets: [
      {
        id: "smapi",
        fileName: "SMAPI-4.5.2-installer.zip",
        action: "smapi",
        size: 41889142,
        sha256:
          "dd01ddca7b566bfe0d3b3d2d03833496abc56c53da976241f2ab443f5484acc4",
        url: `${STARDEW_VALLEY_ASSET_BASE}/SMAPI-4.5.2-installer.zip`
      },
      {
        id: "mod",
        fileName: "CrowdControl-StardewValley-ShenPulse-1.0.0.zip",
        action: "extract",
        targetPath: "Mods",
        size: 170804,
        sha256:
          "90e72ececa5d3b548e34049ab08387e534968aacc9e6c3a8286b4f4509783443",
        url: `${STARDEW_VALLEY_ASSET_BASE}/CrowdControl-StardewValley-ShenPulse-1.0.0.zip`
      },
      {
        id: "ccver",
        fileName: "ccver",
        action: "copy",
        size: 5,
        sha256:
          "74b860b3270666137a4d543c3e3d1e4e473d54636f7593d1c17bf693e6540bbe",
        url: `${STARDEW_VALLEY_ASSET_BASE}/ccver`
      }
    ]
  };

