"use strict";

module.exports = {
  version: "1.1.1", title: "Escape From Duckov", targetLabel: "dossier Steam contenant Duckov.exe",
  autoDetect: true, unattended: true,
  directoryNames: ["Escape from Duckov", "EscapeFromDuckov"], steamAppIds: ["3167020"],
  executables: ["Duckov.exe"], launchExecutables: ["Duckov.exe"], requireLaunchExecutable: true,
  singleInstanceProcesses: ["Duckov"], waitForWindowProcess: "Duckov", waitForWindowTimeoutMs: 90000,
  steamLaunchAppId: "3167020",
  warning: "Fermez Escape From Duckov. ShenPulse installe MelonLoader et le module d’interactions en sauvegardant les fichiers remplacés. Les sauvegardes du jeu sont conservées.",
  assets: [{
    id: "mod", fileName: "duckov-shenpulse-1.1.1.zip", action: "extract",
    size: 11979534, sha256: "29142ce78b597beee17b694514da07848d7e8d96a9cedc2efea4875d8924ff75",
    url: "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/escape-from-duckov/1.1.1/duckov-shenpulse-1.1.1.zip"
  }]
};
