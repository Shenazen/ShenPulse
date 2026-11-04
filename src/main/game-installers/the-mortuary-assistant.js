"use strict";

module.exports = {
  version: "1.0.2",
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
      fileName: "the-mortuary-assistant-shenpulse-1.0.2.zip",
      action: "extract",
      url: "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/the-mortuary-assistant/1.0.2/the-mortuary-assistant-shenpulse-1.0.2.zip",
      size: 20644878,
      sha256: "a4abf67dfd20996aaae360ed58be29161e0e834c1e0855b909dd0f4d57fd10e9"
    }
  ]
};
