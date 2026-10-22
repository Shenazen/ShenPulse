"use strict";

module.exports = {
  version: "1.0.1",
  title: "Unturned",
  targetLabel: "dossier contenant Unturned.exe",
  autoDetect: true,
  unattended: true,
  directoryNames: ["Unturned"],
  steamAppIds: ["304930"],
  executables: ["Unturned.exe"],
  launchExecutables: ["Unturned.exe"],
  warning: "Fermez Unturned. ShenPulse installe son module local et sauvegarde les fichiers remplacés. Lancez ensuite une partie solo sans BattlEye.",
  assets: [{
    id: "mod", action: "extract", fileName: "unturned-shenpulse-1.0.1.zip",
    url: "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/unturned/1.0.1/unturned-shenpulse-1.0.1.zip",
    size: 874358,
    sha256: "83f6212de87d4996b67166254e113ff3e7232e73fc829d789886331bc7062134"
  }]
};
