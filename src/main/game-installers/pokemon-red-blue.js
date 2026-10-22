"use strict";

/** Manifeste versionné du jeu « pokemon-red-blue ». Tailles, empreintes et chemins conservés. */
const { POKEMON_RED_BLUE_ASSET_BASE } = require("./constants");

module.exports = {
    version: "1.1.0",
    title: "Pokémon Rouge/Bleu",
    targetLabel: "dossier de la passerelle Pokémon",
    managedTarget: true,
    unattended: true,
    launchExecutables: ["EmuHawk.exe"],
    warning:
      "ShenPulse installe automatiquement BizHawk, Pokémon Rouge et le pack d’interactions.",
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
        url: `${POKEMON_RED_BLUE_ASSET_BASE}/Bizhawk-2.9.1.zip`
      },
      {
        id: "bridge", fileName: "emulator-bridge-1.0.0.zip", action: "extract",
        size: 43051596, sha256: "cd75f36ccaae9a8a8a21ff843abad4a92263773763b33d9e740acb7d4aa3e3ef",
        url: "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/pokemon-red-blue/1.1.0/emulator-bridge-1.0.0.zip"
      },
      {
        id: "pack",
        fileName: "PokemonRedBlue.dll",
        action: "copy",
        targetPath: "Bridge/Packs",
        size: 259408,
        sha256:
          "586f82e6a888abda25ba5c518d11d70befa52495b2484890759b6e45c7578329",
        url: `${POKEMON_RED_BLUE_ASSET_BASE}/PokemonRedBlue.dll`
      },
      {
        id: "rom",
        fileName: "PokemonRedBlue-Original.gb",
        action: "copy",
        targetPath: "ROM",
        size: 1048576,
        sha256:
          "5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b",
        url: `${POKEMON_RED_BLUE_ASSET_BASE}/PokemonRedBlue-Original.gb`
      },
      {
        id: "redPatch",
        fileName: "PokemonRedBlue.Red.ips",
        action: "copy",
        targetPath: "Patches",
        size: 94412,
        sha256:
          "fc328c76d28a55e60135a3e2cd0fd49bdd95fb8445d6355a96955734e3dda2ad",
        url: `${POKEMON_RED_BLUE_ASSET_BASE}/PokemonRedBlue.Red.ips`
      },
      {
        id: "bluePatch",
        fileName: "PokemonRedBlue.Blue.ips",
        action: "copy",
        targetPath: "Patches",
        size: 94416,
        sha256:
          "29272a8411ba49718030f56531680fcb9981d07c41867b2d28db9a7593a2cf37",
        url: `${POKEMON_RED_BLUE_ASSET_BASE}/PokemonRedBlue.Blue.ips`
      }
    ],
    note:
      "La ROM Pokémon Rouge autorisée est téléchargée, vérifiée puis préparée automatiquement pour BizHawk."
  };

