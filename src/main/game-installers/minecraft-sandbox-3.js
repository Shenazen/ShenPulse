"use strict";

/** Manifeste versionné du jeu « minecraft-sandbox-3 ». Tailles, empreintes et chemins conservés. */
const { MINECRAFT_COMMON_ASSET_BASE, MINECRAFT_COMMON_TOOLS_ASSET_BASE, MINECRAFT_SANDBOX_ASSET_BASE, MINECRAFT_SANDBOX_CONFIG_ASSET_BASE, MINECRAFT_SANDBOX_WIN_FIX_ASSET_BASE } = require("./constants");

module.exports = {
    version: "1.1.3",
    title: "Minecraft SandBox 3",
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
        size: 34113,
        sha256:
          "da6fd533ecdab1d3b437622d7d00f7e1325746ae79f6d9eb562d932a867e141f",
        url: `${MINECRAFT_SANDBOX_WIN_FIX_ASSET_BASE}/shenpulse-bedrock-guard.jar`
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
        size: 1044,
        sha256:
          "f635078fd71c49e15b99f0795b257dff983f952efabba5e157be3e02635e9a18",
        url: `${MINECRAFT_SANDBOX_CONFIG_ASSET_BASE}/server.properties`
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

