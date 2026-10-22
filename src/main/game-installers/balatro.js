"use strict";

module.exports = {
  version: "1.0.0", title: "Balatro",
  targetLabel: "dossier contenant Balatro.exe (Steam) ou love.exe (Xbox Game Pass)",
  autoDetect: true, unattended: true,
  directoryNames: ["Balatro"], steamAppIds: ["2379780"],
  xboxDirectoryNames: ["Balatro"], xboxIdentity: "PlayStack.Balatro",
  executables: ["Balatro.exe", "love.exe"],
  launchExecutables: ["gamelaunchhelper.exe", "Balatro.exe"],
  warning: "Fermez Balatro. ShenPulse sauvegarde les fichiers remplacés et installe les interactions adaptées à votre édition. Les sauvegardes du jeu sont conservées.",
  assets: [{
    id: "module", fileName: "balatro-shenpulse-1.0.0.zip", action: "extract",
    url: "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/balatro/1.0.0/balatro-shenpulse-1.0.0.zip",
    size: 33506, sha256: "a6448f6bb94f860f4c69d4eb60f19b3389ebd28818028fb3ee9fa1d6bc573f22"
  }, {
    id: "lovely", fileName: "lovely-v0.10.0.zip", action: "extract", editions: ["steam"],
    size: 1830980, sha256: "7f481f984ab8ee633c90ce18220c88a2da8f93ca86b6c3e3ff70a725c05807ab",
    url: "https://github.com/ethangreen-dev/lovely-injector/releases/download/v0.10.0/lovely-x86_64-pc-windows-msvc.zip"
  }, {
    id: "steamodded", fileName: "smods-26.1002.0.zip", action: "extract", editions: ["steam"],
    sourcePath: "smods-26.1002.0", targetPath: ".shenpulse-balatro-mods/smods",
    size: 774954, sha256: "c88e15b869faf0627c5db4caa79ca2c362ae39f2ef4556d7bc52c1182210598b",
    url: "https://github.com/Steamodded/smods/archive/refs/tags/26.1002.0.zip"
  }],
  additionalInstallTargets: [{ root: "appData", sourcePath: ".shenpulse-balatro-mods", targetPath: "Balatro/Mods", directory: true, editions: ["steam"] }]
};
