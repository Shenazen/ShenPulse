"use strict";

module.exports = {
  "version": "1.1.0",
  "title": "Stardew Valley",
  "targetLabel": "dossier contenant Stardew Valley.exe",
  "autoDetect": true,
  "unattended": true,
  "directoryNames": [
    "Stardew Valley",
    "StardewValley"
  ],
  "steamAppIds": [
    "413150"
  ],
  "executables": [
    "Stardew Valley.exe",
    "StardewValley.exe"
  ],
  "launchExecutables": [
    "StardewModdingAPI.exe"
  ],
  "requireLaunchExecutable": true,
  "retiredFiles": [
    "Mods/CrowdControl/manifest.json",
    "Mods/CrowdControl/CrowdControl.dll",
    "Mods/CrowdControl/CrowdControl.Extensions.dll",
    "Mods/CrowdControl/ConnectorLib.JSON.dll",
    "Mods/CrowdControl/ShenPulse.Stardew.dll",
    "Mods/CrowdControl/ccver"
  ],
  "warning": "Stardew Valley doit être fermé. Choisissez Steam ou Xbox / Game Pass. ShenPulse conserve le lanceur original, installe SMAPI et le module local ; Lancer réutilisera cette édition.",
  "assets": [
    {
      "id": "smapi",
      "fileName": "SMAPI-4.5.2-installer.zip",
      "action": "smapi",
      "size": 41889142,
      "sha256": "dd01ddca7b566bfe0d3b3d2d03833496abc56c53da976241f2ab443f5484acc4",
      "url": "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/stardew-valley/1.0.0/SMAPI-4.5.2-installer.zip"
    },
    {
      "id": "mod",
      "fileName": "stardew-shenpulse-1.1.0.zip",
      "action": "extract",
      "targetPath": "Mods",
      "size": 10230,
      "sha256": "26be991567919e5f49e65d7875b986777c82c172bda0395f1d7aaa89301279c3",
      "url": "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/stardew-valley/1.1.0/stardew-shenpulse-1.1.0.zip"
    }
  ],
  "xboxIdentity": "ConcernedApe.StardewValleyPC",
  "xboxDirectoryNames": [
    "Stardew Valley"
  ]
};
