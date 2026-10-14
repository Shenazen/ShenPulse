"use strict";

/** Manifeste versionné du jeu « minecraft-bedrock-box ». Tailles, empreintes et chemins conservés. */
const { MINECRAFT_COMMON_ASSET_BASE, MINECRAFT_COMMON_TOOLS_ASSET_BASE, MINECRAFT_BEDROCK_ASSET_BASE, MINECRAFT_BEDROCK_PATCH_ASSET_BASE, MINECRAFT_BEDROCK_CONFIG_ASSET_BASE, MINECRAFT_BEDROCK_WIN_FIX_ASSET_BASE, MINECRAFT_BEDROCK_NATIVE_WIN_BRIDGE_ASSET_BASE } = require("./constants");

module.exports = {
    version: "1.1.5",
    title: "Minecraft Bedrock Box",
    managedTarget: true,
    requiresMinecraftEula: true,
    minecraftServer: {
      serverJar: "paper-1.21-130.jar",
      javaDirectory: "runtime/java",
      port: 25565,
      xms: "1024M",
      xmx: "2048M",
      creativeMode: true
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
        size: 33284,
        sha256:
          "dabc2fc47644127ac7a7b8bb35eede8e0b7324cd21f7996ecadba08d03ffcc66",
        url: `${MINECRAFT_BEDROCK_WIN_FIX_ASSET_BASE}/shenpulse-bedrock-guard.jar`
      },
      {
        id: "nativeWinBridge",
        fileName: "shenpulse-bedrock-native-win-bridge.jar",
        action: "copy",
        targetPath: "plugins",
        size: 4074,
        sha256:
          "ca8f680956dd8840bbb65ba00d72467b66275437af60dd291725885ebfe37f69",
        url: `${MINECRAFT_BEDROCK_NATIVE_WIN_BRIDGE_ASSET_BASE}/shenpulse-bedrock-native-win-bridge.jar`
      },
      {
        id: "effectsPatch",
        fileName: "shenpulse-bedrock-effects-patch.jar",
        action: "copy",
        targetPath: "plugins",
        size: 12783,
        sha256:
          "c68e9c3ac1c7840be1a0591ef011c9a67c7718fe56876c23de480ef96823a052",
        url: `${MINECRAFT_BEDROCK_PATCH_ASSET_BASE}/shenpulse-bedrock-effects-patch.jar`
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
        size: 1361,
        sha256:
          "d2e540a222a82a548edf403a72679694c0dbe8f0af533db5669081d79f9ef14c",
        url: `${MINECRAFT_BEDROCK_CONFIG_ASSET_BASE}/server.properties`
      },
      {
        id: "world",
        fileName: "world.zip",
        action: "extract",
        size: 13700404,
        sha256:
          "8720d7c3b394ca822c9e22bb735d8054e46d99a4d136ce027b02dd4cc28774e9",
        url: `${MINECRAFT_BEDROCK_ASSET_BASE}/world.zip`
      },
      {
        id: "autoClicker",
        fileName: "AutoClicker.exe",
        action: "copy",
        targetPath: "tools",
        size: 1187192,
        sha256:
          "1ce7da6f2813c2ad1d2e496be6714e08cd618e6d9fe2df26c2bd4d894c9a6ec1",
        url: `${MINECRAFT_COMMON_TOOLS_ASSET_BASE}/AutoClicker.exe`
      }
    ],
    autoClicker: {
      executable: "tools/AutoClicker.exe",
      autoStart: true
    }
  };

