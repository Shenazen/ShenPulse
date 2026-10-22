"use strict";

/** Manifeste versionné du jeu « resident-evil-3 ». Tailles, empreintes et chemins conservés. */
const { RESIDENT_EVIL_3_ASSET_BASE, DOTNET_DESKTOP_RUNTIME_8_ASSET_BASE } = require("./constants");

module.exports = {
    version: "2.1.4",
    title: "Resident Evil 3",
    targetLabel: "dossier contenant re3.exe",
    autoDetect: true,
    unattended: true,
    directoryNames: ["RE3", "Resident Evil 3"],
    steamAppIds: ["952060"],
    executables: ["re3.exe"],
    launchExecutables: ["re3.exe"],
    warning:
      "Resident Evil 3 doit être fermé. ShenPulse sauvegarde les fichiers remplacés puis installe, si nécessaire, le runtime Bureau .NET 8 officiel, REFramework et son module local d’interactions.",
    assets: [
      {
        id: "dotnet-desktop-runtime-8",
        fileName: "windowsdesktop-runtime-8.0.31-win-x64.exe",
        action: "dotnet-desktop-runtime",
        major: 8,
        size: 58715896,
        sha256:
          "c375dfd80a967405cfeff634912c1fccc56261ce3d9209ea473f60a21184d1cc",
        url: `${DOTNET_DESKTOP_RUNTIME_8_ASSET_BASE}/windowsdesktop-runtime-8.0.31-win-x64.exe`
      },
      {
        id: "mod",
        fileName: "RE3net-CC-2.1.2.zip",
        action: "extract",
        size: 20825046,
        sha256:
          "34a5b87eeff7b0fddf7e3069a7af4de42c6c3448ce2c0896f4c64db78fd44fba",
        url: `${RESIDENT_EVIL_3_ASSET_BASE}/RE3net-CC-2.1.2.zip`
      }
    ]
  };

