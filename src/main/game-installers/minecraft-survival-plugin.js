"use strict";

/** Manifeste versionné du jeu « minecraft-survival-plugin ». Tailles, empreintes et chemins conservés. */
const { MINECRAFT_COMMON_ASSET_BASE } = require("./constants");

module.exports = {
    version: "1.1.1",
    title: "Minecraft Survival",
    managedTarget: true,
    requiresMinecraftEula: true,
    minecraftServer: {
      serverJar: "paper-1.21-130.jar",
      javaDirectory: "runtime/java",
      port: 25565,
      xms: "1024M",
      xmx: "2048M",
      creativeMode: false
    },
    warning:
      "ShenPulse installe un serveur PaperMC 1.21 privé en mode survie et Java 21, puis le lance sur 127.0.0.1:25565. En continuant, vous acceptez le CLUF Minecraft : https://aka.ms/MinecraftEULA",
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
  };

