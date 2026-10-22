"use strict";

module.exports = {
  version: "1.0.0", title: "DREDGE", targetLabel: "dossier contenant DREDGE.exe",
  autoDetect: true, unattended: true,
  directoryNames: ["DREDGE"], steamAppIds: ["1562430"],
  xboxDirectoryNames: ["DREDGE"], xboxIdentity: "Team17DigitalLimited.ProjectShoal",
  executables: ["DREDGE.exe"], launchExecutables: ["gamelaunchhelper.exe", "DREDGE.exe"],
  requireLaunchExecutable: true,
  singleInstanceProcesses: ["DREDGE"], waitForWindowProcess: "DREDGE", waitForWindowTimeoutMs: 90000,
  warning: "Fermez DREDGE. ShenPulse installe BepInEx et le module officiel. Les fichiers remplacés sont sauvegardés.",
  assets: [{
    id: "mod", fileName: "Dredge-CC.zip", action: "extract", size: 661899,
    sha256: "758aceb31692cec940c8a1c9fc11c129a48a88d0851d0a855a01ca5f27d688e7",
    url: "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/dredge/1.0.0/Dredge-CC.zip"
  }, {
    id: "bepinex-x64", fileName: "BepInEx_win_x64_5.4.23.5.zip", action: "extract", editions: ["x64", "gamepass"], size: 639118,
    sha256: "82f9878551030f54657792c0740d9d51a09500eeae1fba21106b0c441e6732c4",
    url: "https://github.com/BepInEx/BepInEx/releases/download/v5.4.23.5/BepInEx_win_x64_5.4.23.5.zip"
  }, {
    id: "managed-patcher", fileName: "BepInEx_Patcher_5.4.23.5.zip", action: "extract", targetPath: ".shenpulse-dredge-patcher", editions: ["gamepass"], size: 8628,
    sha256: "73abf19a0fe43904f40a9f1fa705ca6f2d6cf33933272edd5b3efa49d4c26c55",
    url: "https://github.com/BepInEx/BepInEx/releases/download/v5.4.23.5/BepInEx_Patcher_5.4.23.5.zip"
  }, {
    id: "managed-bootstrap", fileName: "BepInEx.Bootstrap.dll", action: "copy", targetPath: ".shenpulse-dredge-patcher", editions: ["gamepass"], size: 5120,
    sha256: "d57308a296de5912ed9aad11a091acd16595b3f0cc908d5b7201a89fc0e1c5c3",
    url: "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/dredge/1.0.0/BepInEx.Bootstrap.dll"
  }]
};
