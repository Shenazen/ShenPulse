"use strict";

/** Manifeste versionné du jeu « super-mario-kart ». Tailles, empreintes et chemins conservés. */
const { SUPER_MARIO_KART_ASSET_BASE } = require("./constants");

module.exports = {
    version: "1.0.0",
    title: "Super Mario Kart",
    targetLabel: "dossier de la passerelle Super Mario Kart",
    managedTarget: true,
    unattended: true,
    launchExecutables: ["EmuHawk.exe"],
    warning:
      "ShenPulse installe automatiquement BizHawk, Super Mario Kart et le pack d’interactions.",
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
        id: "client",
        fileName: "CrowdControl.Client.Slim-5.0.9736.24149.zip",
        action: "extract",
        targetPath: "CrowdControl",
        size: 65991501,
        sha256:
          "13e7b65a6d19fe0804565433499b4a3827e84a86a07f05d99afd396146b6dcb7",
        url: `${SUPER_MARIO_KART_ASSET_BASE}/CrowdControl.Client.Slim-5.0.9736.24149.zip`
      },
      {
        id: "pack",
        fileName: "SuperMarioKart.dll",
        action: "copy",
        targetPath: "CrowdControl/Packs",
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

