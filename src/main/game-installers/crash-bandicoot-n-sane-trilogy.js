"use strict";

module.exports = {
  version: "1.0.1",
  title: "Crash Bandicoot N. Sane Trilogy",
  targetLabel: "dossier contenant CrashBandicootNSaneTrilogy.exe",
  autoDetect: true,
  unattended: true,
  directoryNames: ["Crash Bandicoot - N Sane Trilogy", "Crash Bandicoot N. Sane Trilogy"],
  steamAppIds: ["731490"],
  executables: ["CrashBandicootNSaneTrilogy.exe"],
  launchExecutables: ["ShenPulse.CrashBridge.exe"],
  waitForWindowProcess: "CrashBandicootNSaneTrilogy",
  warning: "ShenPulse installe son pont local. Lancez ensuite le jeu depuis ShenPulse, Steam ouvert, puis chargez un niveau. Version Steam 2964270 prise en charge.",
  assets: [{
    id: "bridge", action: "extract", fileName: "crash-bandicoot-shenpulse-1.0.1.zip",
    bundledPath: "installer-assets/crash-bandicoot-n-sane-trilogy/1.0.1/crash-bandicoot-shenpulse-1.0.1.zip",
    size: 13482,
    sha256: "1d86fcb4f33d834a477baed8906c8d01d5ee10e641919ed02eabc8bc6a2b229b"
  }]
};
