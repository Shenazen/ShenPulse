"use strict";

/** Manifeste versionné du jeu « euro-truck-simulator-2 ». Tailles, empreintes et chemins conservés. */
const { EURO_TRUCK_SIMULATOR_2_ASSET_BASE } = require("./constants");

module.exports = {
    version: "1.0.4",
    title: "Euro Truck Simulator 2",
    targetLabel: "dossier racine d’Euro Truck Simulator 2",
    autoDetect: true,
    unattended: true,
    directoryNames: [
      "Euro Truck Simulator 2",
      "Euro Truck Simulator 2 Demo"
    ],
    steamAppIds: ["227300", "231120"],
    executables: ["bin/win_x64/eurotrucks2.exe"],
    launchExecutables: ["bin/win_x64/eurotrucks2.exe"],
    warning:
      "Euro Truck Simulator 2 doit être fermé. ShenPulse installe le plugin officiel Crowd Control dans le dossier plugins du jeu et le configure pour le port local 51337.",
    assets: [
      {
        id: "mod",
        fileName: "TruckSimulator-CC-1.0.4.zip",
        action: "extract",
        targetPath: "bin/win_x64/plugins",
        size: 181790,
        sha256:
          "e144ab89e14c538baa72c7219c92dc93688f737f9a8f12f14b9b5cdac8c30795",
        url: `${EURO_TRUCK_SIMULATOR_2_ASSET_BASE}/TruckSimulator-CC.zip?ver=1.0.4`
      }
    ]
  };

