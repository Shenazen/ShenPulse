"use strict";
module.exports = {
  "version": "1.0.9",
  "title": "GTA V KOTH Enhanced",
  "targetLabel": "dossier GTA V Enhanced",
  "autoDetect": true,
  "unattended": true,
  "executables": [
    "GTA5_Enhanced.exe"
  ],
  "launchExecutables": [
    "PlayGTAV.exe",
    "GTA5_Enhanced.exe"
  ],
  "requireLaunchExecutable": true,
  "singleInstanceProcesses": [
    "GTA5_Enhanced.exe",
    "GTA5.exe"
  ],
  "directoryNames": [
    "Grand Theft Auto V Enhanced"
  ],
  "warning": "Fermez GTA V. ShenPulse sauvegarde les fichiers remplacés et installe le module commun KOTH / Mont Chiliad. Le mode Histoire est requis.",
  "assets": [
    {
      "id": "scripthook-enhanced",
      "fileName": "ScriptHookV_3889.0_1158.13.zip",
      "action": "extract",
      "sourcePath": "bin",
      "includeFiles": [
        "args.txt",
        "dinput8.dll",
        "xinput1_4.dll",
        "ScriptHookV.dll"
      ],
      "editions": [
        "enhanced"
      ],
      "size": 1722210,
      "sha256": "b64c97c3353906f14621e7e9511e4aec2a7d436ecc21ed124d3816585e2e6188",
      "url": "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/gtav-montchiliad/1.0.0/script-hook-v-enhanced-3889.0-1158.13.zip"
    },
    {
      "id": "koth-module",
      "fileName": "ShenPulseMontChiliadEnhanced.asi",
      "action": "copy",
      "editions": [
        "enhanced"
      ],
      "size": 698368,
      "sha256": "b7cd61135b124fb3df2cd4a9f73fbe1e60e7050a1555e0b075296762feb75b48",
      "url": "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/gtav-koth-enhanced/1.0.9/shenpulse-gta-enhanced.asi"
    }
  ]
};
