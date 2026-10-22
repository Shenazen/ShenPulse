"use strict";

module.exports = {
  version: "1.0.1", title: "Blue Prince",
  targetLabel: "dossier contenant BLUE PRINCE.exe",
  autoDetect: true, unattended: true,
  directoryNames: ["Blue Prince", "BluePrince"], steamAppIds: ["1569580"],
  xboxDirectoryNames: ["Blue Prince"], xboxIdentity: "RawFury.BluePrince",
  executables: ["BLUE PRINCE.exe", "BluePrince.exe"],
  launchExecutables: ["gamelaunchhelper.exe", "BLUE PRINCE.exe", "BluePrince.exe"],
  warning: "Fermez Blue Prince. ShenPulse installe BepInEx et le mod d’interactions officiel, en sauvegardant les fichiers remplacés. Le premier lancement prépare les composants IL2CPP.",
  assets: [{
    id: "mod", fileName: "BluePrince-CC.zip", action: "extract",
    size: 34688932,
    sha256: "cbe4c3cc9d4ec5a3d26e70031f53272ec053f093dd44c4913cc46a891d5e647e",
    url: "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/blue-prince/1.0.0/BluePrince-CC.zip"
  }, {
    id: "bepinex", fileName: "BepInEx-IL2CPP-be790.zip", action: "extract",
    size: 34336811,
    sha256: "7e2c83e38db7744d6457839bc869b311aa29a47517938a3a7643be24d00c72ec",
    url: "https://builds.bepinex.dev/projects/bepinex_be/790/BepInEx-Unity.IL2CPP-win-x64-6.0.0-be.790%2B4e98359.zip"
  }]
};
