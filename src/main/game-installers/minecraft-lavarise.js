"use strict";
module.exports = {
  "version": "1.0.0",
  "title": "Minecraft Lava Rise",
  "managedTarget": true,
  "requiresMinecraftEula": true,
  "minecraftServer": {
    "serverJar": "paper-26.1.2-74.jar",
    "javaDirectory": "runtime/java",
    "port": 25585,
    "xms": "512M",
    "xmx": "1536M",
    "creativeMode": false
  },
  "warning": "ShenPulse installe votre serveur Minecraft Java 26.1.2 sur 127.0.0.1:25585. En continuant, vous acceptez le CLUF Minecraft : https://aka.ms/MinecraftEULA",
  "assets": [
    {
      "id": "paper",
      "fileName": "paper-26.1.2-74.jar",
      "action": "copy",
      "size": 52893229,
      "sha256": "1d70b1dab9cf4a6de615209a536f3a45a2186240253c428213ce2188ab95e5f7",
      "url": "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/minecraft-lavarise/1.0.0/paper-26.1.2-74.jar"
    },
    {
      "id": "java",
      "fileName": "java25-windows-x64.zip",
      "action": "extract",
      "targetPath": "runtime/java",
      "size": 37998012,
      "sha256": "bd30ffaa08d2e010e5293abeb252dfb025cc428bf333cd161a5c3e9c02690fa5",
      "url": "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/minecraft-lavarise/1.0.0/java25-windows-x64.zip"
    },
    {
      "id": "plugin",
      "fileName": "shenpulse-lavarise.jar",
      "action": "copy",
      "targetPath": "plugins",
      "size": 121975,
      "sha256": "6be3588fc96dcb1d5bc7265194cf591e7fecf64b2ed7a3bde29c07e905689162",
      "url": "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/minecraft-lavarise/1.0.0/shenpulse-lavarise.jar"
    },
    {
      "id": "config",
      "fileName": "config.yml",
      "action": "copy",
      "targetPath": "plugins/ShenPulse-LavaRise",
      "size": 427,
      "sha256": "c388b59507799324fee8bb3014d6f46e6a08171c34ca6f99778b0729c26e0ef8",
      "url": "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/minecraft-lavarise/1.0.0/config.yml"
    },
    {
      "id": "serverProperties",
      "fileName": "server.properties",
      "action": "copy",
      "size": 462,
      "sha256": "cef2e665dc6203cc9cae29dec435b7c6aae67f4413d63414fa2cca72cfdd136d",
      "url": "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/minecraft-lavarise/1.0.0/server.properties"
    }
  ]
};
