"use strict";

module.exports = {
  version: "1.0.0",
  title: "The Mortuary Assistant",
  targetLabel: "dossier contenant The Mortuary Assistant.exe",
  autoDetect: true,
  unattended: true,
  directoryNames: ["The Mortuary Assistant"],
  steamAppIds: ["1295920"],
  executables: ["The Mortuary Assistant.exe"],
  launchExecutables: ["The Mortuary Assistant.exe"],
  warning: "Le jeu doit être fermé. ShenPulse sauvegarde les fichiers remplacés et installe le mod local ainsi que ses prérequis.",
  retiredFiles: ["Mods/CrowdControl.TheMortuaryAssistant.dll", "Mods/ccver"],
  assets: [
    {
      id: "dotnet6",
      fileName: "dotnet-runtime-6.0.36-win-x64.exe",
      action: "dotnet-desktop-runtime",
      major: 6,
      size: 28101408,
      sha256: "6bdad7bc4c41fe93d4ae7b0312b1d017cfe369d28e7e2e421f5b675f9feefe84",
      url: "https://builds.dotnet.microsoft.com/dotnet/Runtime/6.0.36/dotnet-runtime-6.0.36-win-x64.exe"
    },
    {
      id: "mod",
      fileName: "the-mortuary-assistant-shenpulse-1.0.0.zip",
      action: "extract",
      bundledPath: "installer-assets/the-mortuary-assistant/1.0.0/the-mortuary-assistant-shenpulse-1.0.0.zip",
      size: 20163863,
      sha256: "bd43b6cf4beb09d0dcbb10c424e116e2c7e5b75bdee92b539471179ef13b5505"
    }
  ]
};
