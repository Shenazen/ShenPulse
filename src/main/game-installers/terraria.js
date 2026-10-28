"use strict";

module.exports = {
  "version": "1.1.0",
  "title": "Terraria / tModLoader",
  "targetLabel": "dossier Terraria contenant Terraria.exe",
  "autoDetect": true,
  "unattended": true,
  "directoryNames": [
    "Terraria"
  ],
  "steamAppIds": [
    "105600"
  ],
  "executables": [
    "tModLoader.dll"
  ],
  "launchExecutables": [
    "start-tModLoader.bat",
    "tModLoader.exe"
  ],
  "requireLaunchExecutable": true,
  "steamLaunchAppId": "1281930",
  "warning": "Fermez Terraria et tModLoader. ShenPulse télécharge tModLoader, son runtime et les interactions depuis Backblaze, puis les installe dans un sous-dossier séparé du jeu original. Les fichiers remplacés sont sauvegardés.",
  "assets": [
    {
      "id": "tmodloader",
      "fileName": "tModLoader-v2026.08.3.0.zip",
      "action": "extract",
      "targetPath": "",
      "size": 61142677,
      "sha256": "61e865f3702b12ce4a26c5a90b9de99a12c65ffc228455eb3390ce54af1eab15",
      "url": "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/terraria/1.1.0/tModLoader-v2026.08.3.0.zip"
    },
    {
      "id": "runtime",
      "fileName": "dotnet-runtime-8.0.0-win-x64.zip",
      "action": "extract",
      "targetPath": "dotnet",
      "size": 33177718,
      "sha256": "5fa43823748af6448505bb7b18f44a709d3dd313d685cb7f7a83d030a702fa41",
      "url": "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/terraria/1.1.0/dotnet-runtime-8.0.0-win-x64.zip"
    },
    {
      "id": "mod",
      "fileName": "ShenPulseTerraria.tmod",
      "action": "copy",
      "targetPath": "Mods",
      "size": 20076,
      "sha256": "a01800e150cc96dc9f4a1e8ede4a886e89aad128918f555f40a44ecaaac9f222",
      "url": "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/terraria/1.1.0/ShenPulseTerraria.tmod"
    }
  ],
  "retiredFiles": [
    "Mods/CrowdControlMod.tmod"
  ],
  "terrariaBundledLoader": true
};
