"use strict";

module.exports = {
  version: "1.0.0", title: "Egging On", targetLabel: "dossier contenant Egging On.exe",
  autoDetect: true, unattended: true,
  directoryNames: ["Egging On"], steamAppIds: ["2897610"],
  xboxDirectoryNames: ["Egging On", "EggingOn"], xboxIdentity: "AlibiGames.EggingOn",
  executables: ["Egging On.exe"], launchExecutables: ["gamelaunchhelper.exe", "Egging On.exe"],
  requireLaunchExecutable: true,
  singleInstanceProcesses: ["Egging On"], waitForWindowProcess: "Egging On", waitForWindowTimeoutMs: 90000,
  warning: "Fermez Egging On. ShenPulse installe MelonLoader et le module officiel en sauvegardant les fichiers remplacés. L’édition Game Pass doit être installée dans un dossier XboxGames modifiable.",
  assets: [{
    id: "mod", fileName: "EggingOn-CC-ML.zip", action: "extract", size: 11870288,
    sha256: "aebf50e685692ce7d6f72301495aa172ba9725057ff7d4e44ca806a5ead7b1ae",
    url: "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/egging-on/1.0.0/EggingOn-CC-ML.zip"
  }]
};
