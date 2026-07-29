"use strict";

const INTEGRATED_GAME_IDS = Object.freeze([
  "coin-pusher",
  "connect-four",
  "deal-or-no-deal",
  "diamond-bridge",
  "diamond-drop"
]);

const GTA_ASSET_BASE =
  "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/gtav-montchiliad/1.0.0";
const GTA_ENHANCED_PLUGIN_BASE =
  "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/gtav-montchiliad/1.0.3";
const MINECRAFT_COMMON_ASSET_BASE =
  "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/minecraft-common/1.0.0";
const MINECRAFT_BEDROCK_ASSET_BASE =
  "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/minecraft-bedrock-box/1.1.0";
const MINECRAFT_SANDBOX_ASSET_BASE =
  "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/minecraft-sandbox-3/1.1.0";

const GAME_INSTALLERS = Object.freeze({
  "gtav-montchiliad": {
    version: "1.0.3",
    title: "GTA V Mont Chiliad",
    targetLabel: "dossier GTA V",
    autoDetect: true,
    unattended: true,
    executables: ["GTA5_Enhanced.exe", "GTA5.exe", "PlayGTAV.exe"],
    launchExecutables: ["PlayGTAV.exe", "GTA5_Enhanced.exe", "GTA5.exe"],
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
        size: 394752,
        sha256:
          "9163c6e21a66fbb737b550405229d14d6ea29d4960e12be0b1cdeee7d88ad632",
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
  },
  "cult-of-the-lamb": {
    title: "Cult of the Lamb",
    targetLabel: "dossier contenant Cult Of The Lamb.exe",
    executables: ["Cult Of The Lamb.exe"],
    launchExecutables: ["Cult Of The Lamb.exe"],
    assets: [
      {
        id: "mod",
        fileName: "CultOfTheLamb-CC.zip",
        action: "extract"
      }
    ]
  },
  "stardew-valley": {
    title: "Stardew Valley",
    targetLabel: "dossier contenant Stardew Valley.exe",
    executables: ["Stardew Valley.exe"],
    launchExecutables: ["StardewModdingAPI.exe", "Stardew Valley.exe"],
    assets: [
      {
        id: "smapi",
        fileName: "SMAPI-4.5.2-installer.zip",
        action: "smapi"
      },
      {
        id: "mod",
        fileName: "CrowdControl-StardewValley.zip",
        action: "extract",
        targetPath: "Mods"
      },
      {
        id: "ccver",
        fileName: "ccver",
        action: "copy"
      }
    ]
  },
  terraria: {
    title: "Terraria / tModLoader",
    targetLabel: "dossier tModLoader",
    executables: ["tModLoader.exe", "Terraria.exe"],
    launchExecutables: ["tModLoader.exe", "Terraria.exe"],
    assets: [
      {
        id: "mod",
        fileName: "CrowdControlMod.tmod",
        action: "copy",
        targetPath: "Mods"
      }
    ]
  },
  "minecraft-bedrock-box": {
    version: "1.1.0",
    title: "Minecraft Bedrock Box",
    managedTarget: true,
    requiresMinecraftEula: true,
    minecraftServer: {
      serverJar: "paper-1.21-130.jar",
      javaDirectory: "runtime/java",
      port: 25565,
      xms: "1024M",
      xmx: "2048M"
    },
    warning:
      "ShenPulse installe un serveur PaperMC 1.21 privé et Java 21, puis le lance sur 127.0.0.1:25565. En continuant, vous acceptez le CLUF Minecraft : https://aka.ms/MinecraftEULA",
    assets: [
      {
        id: "paper",
        fileName: "paper-1.21-130.jar",
        action: "copy",
        size: 49049109,
        sha256:
          "ab9bb1afc3cea6978a0c03ce8448aa654fe8a9c4dddf341e7cbda1b0edaa73f5",
        url: `${MINECRAFT_COMMON_ASSET_BASE}/paper-1.21-130.jar`
      },
      {
        id: "java",
        fileName: "temurin-java-21.0.11_10-jre-windows-x64.zip",
        action: "extract",
        targetPath: "runtime/java",
        size: 48850015,
        sha256:
          "7ee06c8f0636b22c7d4cb1e86799c8a1205a99e054bae1871f55308f4069aca9",
        url: `${MINECRAFT_COMMON_ASSET_BASE}/temurin-java-21.0.11_10-jre-windows-x64.zip`
      },
      {
        id: "plugin",
        fileName: "s2e-bedrock-box.jar",
        action: "copy",
        targetPath: "plugins",
        size: 163682,
        sha256:
          "ba1086ffcd93a22052877ce34112ff35a56b8e39955791239e1d04ec02764ebf",
        url: `${MINECRAFT_BEDROCK_ASSET_BASE}/s2e-bedrock-box.jar`
      },
      {
        id: "guard",
        fileName: "shenpulse-bedrock-guard.jar",
        action: "copy",
        targetPath: "plugins",
        size: 34587,
        sha256:
          "6e4b3520396cae669e2dc1c57c4bc34b2b93bb088f5c879142b109f25c91d57e",
        url: `${MINECRAFT_BEDROCK_ASSET_BASE}/shenpulse-bedrock-guard.jar`
      },
      {
        id: "config",
        fileName: "config.yml",
        action: "copy",
        targetPath: "plugins/s2e-bedrock-box",
        size: 668,
        sha256:
          "c7b3d6a1866d02b70e9d652896fdbbfa59801b394c5e08a27f87eb12b4481ad4",
        url: `${MINECRAFT_BEDROCK_ASSET_BASE}/config.yml`
      },
      {
        id: "serverProperties",
        fileName: "server.properties",
        action: "copy",
        size: 1452,
        sha256:
          "15fbbe32588d281cc85a5beb826a75d24d2b036ec8dea2808931d471cf4f54eb",
        url: `${MINECRAFT_BEDROCK_ASSET_BASE}/server.properties`
      },
      {
        id: "world",
        fileName: "world.zip",
        action: "extract",
        size: 13700404,
        sha256:
          "8720d7c3b394ca822c9e22bb735d8054e46d99a4d136ce027b02dd4cc28774e9",
        url: `${MINECRAFT_BEDROCK_ASSET_BASE}/world.zip`
      }
    ]
  },
  "minecraft-sandbox-3": {
    version: "1.1.0",
    title: "Minecraft SandBox 3",
    managedTarget: true,
    requiresMinecraftEula: true,
    minecraftServer: {
      serverJar: "paper-1.21-130.jar",
      javaDirectory: "runtime/java",
      port: 25565,
      xms: "1024M",
      xmx: "2048M"
    },
    warning:
      "ShenPulse installe un serveur PaperMC 1.21 privé et Java 21, puis le lance sur 127.0.0.1:25565. En continuant, vous acceptez le CLUF Minecraft : https://aka.ms/MinecraftEULA",
    assets: [
      {
        id: "paper",
        fileName: "paper-1.21-130.jar",
        action: "copy",
        size: 49049109,
        sha256:
          "ab9bb1afc3cea6978a0c03ce8448aa654fe8a9c4dddf341e7cbda1b0edaa73f5",
        url: `${MINECRAFT_COMMON_ASSET_BASE}/paper-1.21-130.jar`
      },
      {
        id: "java",
        fileName: "temurin-java-21.0.11_10-jre-windows-x64.zip",
        action: "extract",
        targetPath: "runtime/java",
        size: 48850015,
        sha256:
          "7ee06c8f0636b22c7d4cb1e86799c8a1205a99e054bae1871f55308f4069aca9",
        url: `${MINECRAFT_COMMON_ASSET_BASE}/temurin-java-21.0.11_10-jre-windows-x64.zip`
      },
      {
        id: "plugin",
        fileName: "s2e-sand-box.jar",
        action: "copy",
        targetPath: "plugins",
        size: 126213,
        sha256:
          "654cba8f5ee856efef0aa2237a079e1f612d8d82645dad85787080d1b4434a63",
        url: `${MINECRAFT_SANDBOX_ASSET_BASE}/s2e-sand-box.jar`
      },
      {
        id: "guard",
        fileName: "shenpulse-sandbox-bridge.jar",
        action: "copy",
        targetPath: "plugins",
        size: 7281,
        sha256:
          "8de5fd43c162f58e3851d162a2ce012f22c95c83a2c595bb7d0263b182ec2fad",
        url: `${MINECRAFT_SANDBOX_ASSET_BASE}/shenpulse-sandbox-bridge.jar`
      },
      {
        id: "winGuard",
        fileName: "shenpulse-bedrock-guard.jar",
        action: "copy",
        targetPath: "plugins",
        size: 34587,
        sha256:
          "6e4b3520396cae669e2dc1c57c4bc34b2b93bb088f5c879142b109f25c91d57e",
        url: `${MINECRAFT_SANDBOX_ASSET_BASE}/shenpulse-bedrock-guard.jar`
      },
      {
        id: "config",
        fileName: "config.yml",
        action: "copy",
        targetPath: "plugins/s2e-sand-box",
        size: 1313,
        sha256:
          "73fef20a311729248bc48f8263fe24f6a68277bd5c6af485ad1d933f70aebbdc",
        url: `${MINECRAFT_SANDBOX_ASSET_BASE}/config.yml`
      },
      {
        id: "serverProperties",
        fileName: "server.properties",
        action: "copy",
        size: 1090,
        sha256:
          "fad3c1fd94b5a7e9cedc249e1344266687e65047e7e3f3343826bcf26005dd2b",
        url: `${MINECRAFT_SANDBOX_ASSET_BASE}/server.properties`
      }
    ]
  },
  "minecraft-survival-plugin": {
    title: "Minecraft Survival Plugin",
    targetLabel: "dossier du serveur Minecraft",
    assets: [
      {
        id: "plugin",
        fileName: "s2e-survival.jar",
        action: "copy",
        targetPath: "plugins"
      },
      {
        id: "config",
        fileName: "config.yml",
        action: "copy",
        targetPath: "plugins/s2e-survival"
      },
      {
        id: "serverProperties",
        fileName: "server.properties",
        action: "copy"
      }
    ]
  },
  "pokemon-red-blue": {
    title: "Pokémon Rouge/Bleu",
    targetLabel: "dossier de la passerelle Pokémon",
    managedTarget: true,
    launchExecutables: ["CrowdControl.Client.Slim.exe", "EmuHawk.exe"],
    assets: [
      {
        id: "bizhawk",
        fileName: "Bizhawk-2.9.1.zip",
        action: "extract",
        targetPath: "BizHawk"
      },
      {
        id: "client",
        fileName: "CrowdControl.Client.Slim-5.0.9661.26214.zip",
        action: "extract",
        targetPath: "CrowdControl"
      },
      {
        id: "pack",
        fileName: "PokemonRedBlue.dll",
        action: "copy",
        targetPath: "CrowdControl/Packs"
      }
    ],
    note:
      "La ROM n’est volontairement jamais téléchargée : sélectionnez votre propre copie légale après l’installation."
  }
});

function installerForGame(gameId) {
  return GAME_INSTALLERS[gameId] || null;
}

function isIntegratedGame(gameId) {
  return INTEGRATED_GAME_IDS.includes(gameId);
}

module.exports = {
  GAME_INSTALLERS,
  INTEGRATED_GAME_IDS,
  installerForGame,
  isIntegratedGame
};
