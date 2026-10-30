"use strict";

const path = require("node:path");
const { runProcess } = require("./processes");

/** Évite de remplacer un module chargé ou le jeton d’une session encore ouverte. */
async function assertModGameClosed(gameId, targetPath, { platform = process.platform, execute = runProcess } = {}) {
  if (["stardew-valley", "terraria"].includes(gameId)) {
    if (await require("./stardew-terraria").findModdedGameProcess(gameId,targetPath,{platform,execute})) throw new Error(`Fermez ${gameId === "terraria" ? "tModLoader / Terraria" : "Stardew Valley"} avant de remplacer son module.`);
    return;
  }
  const shop = require("../game-installers/shop-games")[gameId] || require("../game-installers/shen-native-games")[gameId] || require("../game-installers/owner-integrations")[gameId];
  const names = shop?.singleInstanceProcesses || { palworld: ["Palworld-Win64-Shipping","Palworld-WinGDK-Shipping"], "gtav-koth-enhanced":["GTA5_Enhanced","GTA5"], "gtav-hiking-enhanced":["GTA5_Enhanced","GTA5"], "gtav-montchiliad":["GTA5_Enhanced","GTA5"], "euro-truck-simulator-2": ["eurotrucks2"], "escape-from-duckov": ["Duckov"], balatro: ["Balatro", "love"], "blue-prince": ["BLUE PRINCE", "BluePrince"], dredge: ["DREDGE"], "egging-on": ["Egging On"], "fallout-4": ["Fallout4", "f4se_loader"], "resident-evil-3": ["re3"], "pokemon-red-blue": ["EmuHawk"], "super-mario-kart": ["EmuHawk"] }[gameId] || [];
  if (platform !== "win32" || !names.length) return;
  const root = await require("node:fs/promises").realpath(targetPath).catch(() => path.resolve(targetPath));
  const encoded = Buffer.from(JSON.stringify({ root, names, strictNames: ["palworld","gtav-hiking-enhanced","gtav-koth-enhanced","gtav-montchiliad","euro-truck-simulator-2", "dredge", "egging-on", "fallout-4", "escape-from-duckov", "blue-prince", "resident-evil-3" ].includes(gameId) || Boolean(shop) }), "utf8").toString("base64");
  const script = [
    `$taskConfig = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')) | ConvertFrom-Json`,
    "$taskPrefix = [IO.Path]::GetFullPath($taskConfig.root).TrimEnd([char[]]'\\/') + [IO.Path]::DirectorySeparatorChar",
    "if ($taskConfig.strictNames) { Get-CimInstance Win32_Process | Where-Object { $taskConfig.names -contains [IO.Path]::GetFileNameWithoutExtension($_.Name) } | ForEach-Object { Write-Output $_.ProcessId }; exit 0 }",
    "Get-Process -Name $taskConfig.names -ErrorAction SilentlyContinue | ForEach-Object {",
    "  try { if ($taskConfig.strictNames -or ($_.Path -and [IO.Path]::GetFullPath($_.Path).StartsWith($taskPrefix, [StringComparison]::OrdinalIgnoreCase))) { Write-Output $_.Id } } catch {}",
    "}",
    "exit 0"
  ].join("\r\n");
  const output = await execute("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]);
  if (/\d/.test(String(output))) throw new Error(`Fermez ${{ palworld:"Palworld", "gtav-koth-enhanced":"GTA V", "gtav-hiking-enhanced":"GTA V", "gtav-montchiliad":"GTA V", "euro-truck-simulator-2": "Euro Truck Simulator 2", "escape-from-duckov": "Escape From Duckov", balatro: "Balatro", "blue-prince": "Blue Prince", dredge: "DREDGE", "egging-on": "Egging On", "fallout-4": "Fallout 4", "resident-evil-3": "Resident Evil 3", "pokemon-red-blue": "Pokémon Rouge/Bleu", "super-mario-kart": "Super Mario Kart" }[gameId] || shop?.title} avant d’installer ou de réparer son module, puis réessayez.`);
}

module.exports = { assertModGameClosed };
