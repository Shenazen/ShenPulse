"use strict";

module.exports = {
  "version": "1.0.0",
  "title": "Palworld",
  "targetLabel": "dossier racine du jeu (Content pour Xbox / Game Pass)",
  "autoDetect": true,
  "unattended": true,
  "directoryNames": [
    "Palworld"
  ],
  "steamAppIds": [
    "1623730"
  ],
  "xboxIdentity": "PocketpairInc.Palworld",
  "xboxDirectoryNames": [
    "Palworld"
  ],
  "executables": [
    "Pal/Binaries/Win64/Palworld-Win64-Shipping.exe",
    "Pal/Binaries/WinGDK/Palworld-WinGDK-Shipping.exe"
  ],
  "launchExecutables": [
    "gamelaunchhelper.exe",
    "Palworld.exe",
    "Pal/Binaries/Win64/Palworld-Win64-Shipping.exe"
  ],
  "requireLaunchExecutable": true,
  "singleInstanceProcesses": [
    "Palworld-Win64-Shipping",
    "Palworld-WinGDK-Shipping"
  ],
  "waitForWindowProcess": "Palworld-Win64-Shipping",
  "waitForWindowTimeoutMs": 600000,
  "warning": "Fermez Palworld. Choisissez l’édition Steam ou Xbox / Game Pass. ShenPulse télécharge le pack depuis Backblaze, vérifie ses fichiers et sauvegarde les éléments remplacés. Le lancement réutilise l’édition installée.",
  "assets": [
    {
      "id": "module",
      "fileName": "palworld-shenpulse-1.0.0.zip",
      "action": "extract",
      "size": 8733611,
      "sha256": "dcd496afdcdc51da61ac794043c287ca26fd0f169e81a7d23b8bca78e247d407",
      "url": "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/palworld/1.0.0/palworld-shenpulse-1.0.0.zip"
    }
  ]
};
