"use strict";

/** Manifeste versionné du jeu « euro-truck-simulator-2 ». Tailles, empreintes et chemins conservés. */
const { EURO_TRUCK_SIMULATOR_2_ASSET_BASE } = require("./constants");

module.exports = {
    version: "1.0.5",
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
    requireLaunchExecutable: true,
    singleInstanceProcesses: ["eurotrucks2"],
    waitForWindowProcess: "eurotrucks2",
    waitForWindowTimeoutMs: 180000,
    warning:
      "Fermez Euro Truck Simulator 2. ShenPulse installe son module d’interactions dans le dossier plugins du jeu. Lancez ensuite le jeu depuis ShenPulse et confirmez le message du SDK avancé si le jeu l’affiche.",
    assets: [
      {
        id: "mod",
        fileName: "TruckSimulator-CC-1.0.4.zip",
        action: "extract",
        targetPath: "bin/win_x64/plugins",
        size: 181790,
        sha256:
          "e144ab89e14c538baa72c7219c92dc93688f737f9a8f12f14b9b5cdac8c30795",
        url: `${EURO_TRUCK_SIMULATOR_2_ASSET_BASE}/TruckSimulator-CC-1.0.4.zip`
      }
    ]
  };

