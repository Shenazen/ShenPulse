"use strict";

/** Manifeste versionné du jeu « gtav-montchiliad ». Tailles, empreintes et chemins conservés. */
const { GTA_ASSET_BASE, GTA_ENHANCED_PLUGIN_BASE } = require("./constants");

module.exports = {
    version: "1.0.14",
    title: "GTA V Mont Chiliad",
    targetLabel: "dossier GTA V",
    autoDetect: true,
    unattended: true,
    executables: ["GTA5_Enhanced.exe", "GTA5.exe", "PlayGTAV.exe"],
    launchExecutables: ["PlayGTAV.exe", "GTA5_Enhanced.exe", "GTA5.exe"],
    singleInstanceProcesses: ["GTA5_Enhanced.exe","GTA5.exe"],
    warning:
      "GTA V doit être fermé. Les fichiers remplacés seront copiés dans une sauvegarde ShenPulse avant installation.",
    assets: [
      {
        id: "desolidarisation",
        fileName: "Desolidarisation Grand Theft Auto V.rar",
        action: "gta-archive",
        editions: ["legacy"],
        size: 1825174210,
        sha256:
          "61e9ad26a4bddd0ea89bf77e96ac8a9fd0490f26143e3c1348c03c1940bc45d0",
        url: `${GTA_ASSET_BASE}/desolidarisation-gta-v.rar`
      },
      {
        id: "scripthook-legacy",
        fileName: "ScriptHookV_3788.0_1013.34.zip",
        action: "extract",
        sourcePath: "bin",
        editions: ["legacy"],
        size: 1722020,
        sha256:
          "263fe9463894ed960089534619115eca54493c521532688e259f2a1008d14f28",
        url: `${GTA_ASSET_BASE}/script-hook-v-legacy-3788.0-1013.34.zip`
      },
      {
        id: "scripthookvdotnet",
        fileName: "ScriptHookVDotNet-3.7.0.zip",
        action: "extract",
        editions: ["legacy"],
        size: 1406528,
        sha256:
          "419c1b3f52d24cdeae4a61d07bb0a06ae56aa99292b161d6a841374d0481516c",
        url: `${GTA_ASSET_BASE}/script-hook-v-dot-net-3.7.0.zip`
      },
      {
        id: "scripthook-enhanced",
        fileName: "ScriptHookV_3889.0_1158.13.zip",
        action: "extract",
        sourcePath: "bin",
        includeFiles: [
          "args.txt",
          "dinput8.dll",
          "xinput1_4.dll",
          "ScriptHookV.dll"
        ],
        editions: ["enhanced"],
        size: 1722210,
        sha256:
          "b64c97c3353906f14621e7e9511e4aec2a7d436ecc21ed124d3816585e2e6188",
        url: `${GTA_ASSET_BASE}/script-hook-v-enhanced-3889.0-1158.13.zip`
      },
      {
        id: "enhancedplugin",
        fileName: "ShenPulseMontChiliadEnhanced.asi",
        action: "copy",
        editions: ["enhanced"],
        size: 698368,
        sha256:
          "b7cd61135b124fb3df2cd4a9f73fbe1e60e7050a1555e0b075296762feb75b48",
        url: `${GTA_ENHANCED_PLUGIN_BASE}/shenpulse-mont-chiliad-enhanced.asi`
      },
      {
        id: "enhancedsave",
        fileName: "GTA V Enhanced Mont Chiliad Save.zip",
        action: "gta-enhanced-save",
        editions: ["enhanced"],
        size: 789698,
        sha256:
          "13f06f99c75c913b2ce6c953e7bd1d545f14f47c369520cab3e6b681e448111e",
        url: `${GTA_ASSET_BASE}/gta-v-enhanced-mont-chiliad-save.zip`
      }
    ]
  };

