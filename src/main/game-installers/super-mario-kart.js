"use strict";

/** Manifeste versionné du jeu « super-mario-kart ». Tailles, empreintes et chemins conservés. */
const { SUPER_MARIO_KART_ASSET_BASE } = require("./constants");

module.exports = {
    version: "1.1.0",
    title: "Super Mario Kart",
    targetLabel: "dossier de la passerelle Super Mario Kart",
    managedTarget: true,
    unattended: true,
    launchExecutables: ["EmuHawk.exe"],
    warning:
      "ShenPulse installe automatiquement BizHawk, Super Mario Kart et le pack d’interactions.",
    retiredFiles: ["CrowdControl/CrowdControl.Client.Slim.exe", "CrowdControl/CrowdControl.Client.Slim.dll"],
    assets: [
      {
        id: "bizhawk",
        fileName: "Bizhawk-2.9.1.zip",
        action: "extract",
        targetPath: "BizHawk",
        size: 67855842,
        sha256:
          "a8b7b1264002c9a317fb840196d20ec67b0a70d2da3fab496968ff7c9fea4dda",
        url: `${SUPER_MARIO_KART_ASSET_BASE}/Bizhawk-2.9.1.zip`
      },
      {
        id: "bridge", fileName: "emulator-bridge-1.0.0.zip", action: "extract",
        size: 43051596, sha256: "cd75f36ccaae9a8a8a21ff843abad4a92263773763b33d9e740acb7d4aa3e3ef",
        url: "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/super-mario-kart/1.1.0/emulator-bridge-1.0.0.zip"
      },
      {
        id: "pack",
        fileName: "SuperMarioKart.dll",
        action: "copy",
        targetPath: "Bridge/Packs",
        size: 58192,
        sha256:
          "44a2c9e04e641532b42a9f3084b4155b3189c8f2afd797fa20919ad798ba6c4b",
        url: `${SUPER_MARIO_KART_ASSET_BASE}/SuperMarioKart.dll`
      },
      {
        id: "rom",
        fileName: "SuperMarioKart-Original.sfc",
        action: "copy",
        targetPath: "ROM",
        size: 524288,
        sha256:
          "2ada8919688087be60a6a48cace8f877add60c45d2e5d09e2442faa55be62a49",
        url: `${SUPER_MARIO_KART_ASSET_BASE}/SuperMarioKart-Original.sfc`
      }
    ],
    note:
      "La ROM Super Mario Kart USA autorisée est téléchargée et vérifiée automatiquement avant son lancement dans BizHawk."
  };

