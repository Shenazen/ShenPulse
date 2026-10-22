"use strict";

module.exports = {
  version: "1.0.0", title: "Dead by Daylight",
  targetLabel: "dossier contenant DeadByDaylight.exe (Content pour Xbox Game Pass)",
  setupOnly: true, autoDetect: true, unattended: true,
  directoryNames: ["Dead by Daylight"], steamAppIds: ["381210"],
  xboxDirectoryNames: ["Dead By Daylight"], xboxIdentity: "BehaviourInteractive.DeadbyDaylightWindows",
  executables: ["DeadByDaylight/Binaries/WinGDK/DeadByDaylight-WinGDK-Shipping.exe", "DeadByDaylight/Binaries/Win64/DeadByDaylight-Win64-Shipping.exe"],
  launchExecutables: ["gamelaunchhelper.exe", "DeadByDaylight.exe"],
  requireLaunchExecutable: true,
  singleInstanceProcesses: ["DeadByDaylight", "DeadByDaylight-WinGDK-Shipping", "DeadByDaylight-Win64-Shipping"],
  waitForWindowTimeoutMs: 180000,
  warning: "ShenPulse prépare les commandes clavier et souris sans modifier le jeu. Choisissez WASD ou ZQSD et utilisez les raccourcis par défaut.",
  assets: []
};
