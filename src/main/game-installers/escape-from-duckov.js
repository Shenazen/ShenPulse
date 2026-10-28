"use strict";

module.exports = {
  version: "1.1.2", title: "Escape From Duckov", targetLabel: "dossier Steam contenant Duckov.exe",
  autoDetect: true, unattended: true,
  directoryNames: ["Escape from Duckov", "EscapeFromDuckov"], steamAppIds: ["3167020"],
  executables: ["Duckov.exe"], launchExecutables: ["Duckov.exe"], requireLaunchExecutable: true,
  singleInstanceProcesses: ["Duckov"], waitForWindowProcess: "Duckov", waitForWindowTimeoutMs: 90000,
  steamLaunchAppId: "3167020",
  warning: "Fermez Escape From Duckov. ShenPulse installe MelonLoader et le module d’interactions en sauvegardant les fichiers remplacés. Les sauvegardes du jeu sont conservées.",
  assets: [{
    id: "mod", fileName: "duckov-shenpulse-1.1.2.zip", action: "extract",
    size: 11979934, sha256: "d202d647f351a28cefa0b4405267e5102c724016612bda900823ea4d8d9730a2",
    url: "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/escape-from-duckov/1.1.2/duckov-shenpulse-1.1.2.zip"
  }]
};
