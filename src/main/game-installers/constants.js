"use strict";

/** Identifiants intégrés et origines versionnées des assets publiés : valeurs inchangées. */
const INTEGRATED_GAME_IDS = Object.freeze([
  "coin-pusher",
  "connect-four",
  "deal-or-no-deal",
  "thiercelieux",
  "diamond-bridge",
  "diamond-drop"
]);
const GTA_ASSET_BASE =
  "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/gtav-montchiliad/1.0.0";
const GTA_ENHANCED_PLUGIN_BASE =
  "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/gtav-montchiliad/1.0.17";
const MINECRAFT_COMMON_ASSET_BASE =
  "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/minecraft-common/1.0.0";
const MINECRAFT_COMMON_TOOLS_ASSET_BASE =
  "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/minecraft-common/1.1.0";
const MINECRAFT_BEDROCK_ASSET_BASE =
  "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/minecraft-bedrock-box/1.1.0";
const MINECRAFT_BEDROCK_PATCH_ASSET_BASE =
  "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/minecraft-bedrock-box/1.1.5";
const MINECRAFT_BEDROCK_CONFIG_ASSET_BASE =
  "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/minecraft-bedrock-box/1.1.2";
const MINECRAFT_BEDROCK_WIN_FIX_ASSET_BASE =
  "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/minecraft-bedrock-box/1.1.5";
const MINECRAFT_BEDROCK_NATIVE_WIN_BRIDGE_ASSET_BASE =
  "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/minecraft-bedrock-box/1.1.3";
const MINECRAFT_SANDBOX_ASSET_BASE =
  "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/minecraft-sandbox-3/1.1.0";
const MINECRAFT_SANDBOX_CONFIG_ASSET_BASE =
  "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/minecraft-sandbox-3/1.1.2";
const MINECRAFT_SANDBOX_WIN_FIX_ASSET_BASE =
  "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/minecraft-sandbox-3/1.1.3";
const CULT_OF_THE_LAMB_ASSET_BASE =
  "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/cult-of-the-lamb/1.0.2";
const STARDEW_VALLEY_ASSET_BASE =
  "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/stardew-valley/1.0.0";
const TERRARIA_ASSET_BASE =
  "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/terraria/1.0.0";
const EURO_TRUCK_SIMULATOR_2_ASSET_BASE =
  "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/euro-truck-simulator-2/1.0.4";
const RESIDENT_EVIL_3_ASSET_BASE =
  "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/resident-evil-3/2.1.3";
const DOTNET_DESKTOP_RUNTIME_8_ASSET_BASE =
  "https://builds.dotnet.microsoft.com/dotnet/WindowsDesktop/8.0.31";
const POKEMON_RED_BLUE_ASSET_BASE =
  "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/pokemon-red-blue/1.0.1";
const SUPER_MARIO_KART_ASSET_BASE =
  "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/super-mario-kart/1.0.0";
const COLOR_STRIKE_ASSET_BASE =
  "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/color-strike/1.0.9-shenpulse2";
const TIKLIVE_CLIMB_ASSET_BASE =
  "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/tiklive-climb/1.0.0-shenpulse1";
const TIKLIVE_CUBE_WARS_ASSET_BASE =
  "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/tiklive-cube-wars/1.0.0-shenpulse1";
const TIKLIVE_STACK_TOWER_ASSET_BASE =
  "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/tiklive-stack-tower/1.0.0-shenpulse1";
const CLASH_OF_LIVE_ASSET_BASE =
  "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/clash-of-live/1.0.0-shenpulse1";

module.exports = { INTEGRATED_GAME_IDS, GTA_ASSET_BASE, GTA_ENHANCED_PLUGIN_BASE, MINECRAFT_COMMON_ASSET_BASE, MINECRAFT_COMMON_TOOLS_ASSET_BASE, MINECRAFT_BEDROCK_ASSET_BASE, MINECRAFT_BEDROCK_PATCH_ASSET_BASE, MINECRAFT_BEDROCK_CONFIG_ASSET_BASE, MINECRAFT_BEDROCK_WIN_FIX_ASSET_BASE, MINECRAFT_BEDROCK_NATIVE_WIN_BRIDGE_ASSET_BASE, MINECRAFT_SANDBOX_ASSET_BASE, MINECRAFT_SANDBOX_CONFIG_ASSET_BASE, MINECRAFT_SANDBOX_WIN_FIX_ASSET_BASE, CULT_OF_THE_LAMB_ASSET_BASE, STARDEW_VALLEY_ASSET_BASE, TERRARIA_ASSET_BASE, EURO_TRUCK_SIMULATOR_2_ASSET_BASE, RESIDENT_EVIL_3_ASSET_BASE, DOTNET_DESKTOP_RUNTIME_8_ASSET_BASE, POKEMON_RED_BLUE_ASSET_BASE, SUPER_MARIO_KART_ASSET_BASE, COLOR_STRIKE_ASSET_BASE, TIKLIVE_CLIMB_ASSET_BASE, TIKLIVE_CUBE_WARS_ASSET_BASE, TIKLIVE_STACK_TOWER_ASSET_BASE, CLASH_OF_LIVE_ASSET_BASE };

