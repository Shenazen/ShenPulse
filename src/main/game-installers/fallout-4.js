"use strict";

module.exports = {
  version: "1.0.1", title: "Fallout 4",
  targetLabel: "dossier Fallout 4 Steam 1.11.240 avec les six DLC et F4SE 0.7.9",
  autoDetect: true, unattended: true, preflight: "fallout-4",
  directoryNames: ["Fallout 4", "Fallout4"], steamAppIds: ["377160"],
  xboxDirectoryNames: ["Fallout 4"], xboxIdentity: "BethesdaSoftworks.Fallout4-CoreGame",
  executables: ["Fallout4.exe"], launchExecutables: ["f4se_loader.exe"],
  requireLaunchExecutable: true,
  singleInstanceProcesses: ["Fallout4", "f4se_loader"], waitForWindowProcess: "Fallout4", waitForWindowTimeoutMs: 90000,
  warning: "Édition Steam 1.11.240 et six DLC requis. Installez F4SE 0.7.9 depuis son site officiel avant de continuer. L’édition Xbox Game Pass est incompatible. Activez CrowdControl.esp dans CREATIONS après installation.",
  assets: [{
    id: "mod", fileName: "Fallout4Anniversary-CC.zip", action: "extract", targetPath: "Data", size: 288295,
    sha256: "4c176ba939b05d57abc13967e0593217fb9861dc0654d72bf81b38bd95edeba9",
    url: "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/fallout-4/1.0.0/Fallout4Anniversary-CC.zip"
  }]
};
