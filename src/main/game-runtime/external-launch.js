"use strict";

const { prepareGtaMode, GTA_IDS } = require("./gta-mode");
const { prepareGtaEnhancedSaveForLaunch } = require("./gta-save");
const { gtaEpicLaunchUrl } = require("./gta-epic-launch");
const { supportsPlatformChoice, installationPlatform, assertRunningInstallation, assertSupportedPlatform } = require("./installation-platform");
const { findLaunchTarget } = require("./paths");
const { launchSteamDemo, launchSteamGame } = require("./steam-launch");
const { runProcess } = require("./processes");
const { deadByDaylightProcess } = require("./four-games-installation");
const { assertTruckSimulatorReady } = require("./truck-simulator-installation");
const { assertStandaloneModuleReady } = require("./standalone-module-installation");
const {findModdedGameProcess,assertModdedGameReady,isModdedFarmGame,terrariaManualLauncher}=require("./stardew-terraria");
const { assertShopModuleReady } = require("./shop-games-installation");
const { prepareFarmingRuntimeProfile, assertFarmingRunningProfile, farmingSteamLaunchUri } = require("./farming-managed-profile");
const ownerModules = require("../../../resources/catalogs/owner-prepared-modules.json");
const path = require("node:path");

async function runningGameProcess(names, { platform = process.platform, execute = runProcess, includeCommandLine = false } = {}) {
  if (platform !== "win32" || !names?.length) return null;
  if (!names.every(name => /^[a-z0-9_][a-z0-9_. -]{0,119}$/i.test(name))) throw new Error("Processus de jeu invalide.");
  const encoded = Buffer.from(JSON.stringify(names.map(name => name.replace(/\.exe$/i, ""))), "utf8").toString("base64");
  const output = await execute("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", [
    `$taskNames = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')) | ConvertFrom-Json`,
    "Get-CimInstance Win32_Process | Where-Object { $taskNames -contains [IO.Path]::GetFileNameWithoutExtension($_.Name) } | Select-Object ProcessId,Name,ExecutablePath" + (includeCommandLine ? ",CommandLine" : "") + " | ConvertTo-Json -Compress",
    "exit 0"
  ].join("\n")]);
  if (!String(output).trim()) return null;
  const parsed = JSON.parse(output), processes = Array.isArray(parsed) ? parsed : [parsed];
  if (!processes.length) return null;
  if (processes.some(result => !Number.isSafeInteger(result.ProcessId) || result.ProcessId <= 0)) throw new Error("Le processus du jeu n’a pas pu être vérifié.");
  return { ...processes[0], processes };
}

async function launchExternalGame({ gameId, manifest, installation, shell, assertAccess,
  waitForWindowsProcessWindow, scheduleGtaSaveDeployment, userDataPath, documentsPath, localAppDataPath, findRunning = runningGameProcess, selectGtaMode = prepareGtaMode, prepareGtaSave = prepareGtaEnhancedSaveForLaunch, findEpicLaunchUrl = gtaEpicLaunchUrl, findModdedProcess = findModdedGameProcess,connectFnvXbox=require("./fnv-gamepass").connectFnvXbox }) {
  const detectedPlatform = await installationPlatform(installation.path, manifest);
  const platform = ["steam", "xbox"].includes(installation.platform) ? installation.platform : detectedPlatform;
  if (platform && detectedPlatform && platform !== detectedPlatform) throw new Error("Le dossier mémorisé ne correspond plus à la plateforme choisie. Réinstallez les interactions depuis l’étape Installation.");
  assertSupportedPlatform(manifest, platform);
  const nativeFnv=gameId==="fallout-new-vegas"&&platform==="xbox";
  if(nativeFnv)installation={...installation,path:await require("./fnv-gamepass").fnvXboxRoot(installation.path)};
  const names = manifest.launchExecutables || manifest.executables || [];
  const launchNames = platform === "xbox" ? ["gamelaunchhelper.exe"] : platform === "steam" ? names.filter(name => !/gamelaunchhelper|[\\/]WinGDK[\\/]/i.test(name)) : names;
  const manualTerrariaLauncher = await terrariaManualLauncher(gameId, installation.path, userDataPath);
  const executable = manualTerrariaLauncher || await findLaunchTarget(installation.path, launchNames, !platform);
  assertAccess();
  if (gameId === "find-the-needle-demo") return launchSteamDemo({ gameId, manifest, executable, shell, assertAccess });
  if (!executable) {
    if (manifest.requireLaunchExecutable) throw new Error(`Le lanceur de ${manifest.title} est introuvable. Réparez le jeu dans Steam ou l’application Xbox puis relancez l’installation des interactions.`);
    await shell.openPath(installation.path);
    return { ok: true, openedFolder: true, path: installation.path, message: "Le dossier installé est ouvert. Aucun exécutable sûr n’a été détecté automatiquement." };
  }
  const existing = isModdedFarmGame(gameId) ? await findModdedProcess(gameId,installation.path,{userDataPath}) : await findRunning(manifest.singleInstanceProcesses, { includeCommandLine: gameId === "farming-simulator-25" });
  assertAccess();
  // The native helper verifies the exact Xbox process path, even when Windows
  // hides that path from the unelevated application. It never accepts another edition.
  if(!nativeFnv)await assertRunningInstallation(existing, { ...installation, platform }, manifest);
  assertAccess();
  const farmingProfile = gameId === "farming-simulator-25" ? await prepareFarmingRuntimeProfile(installation.path, {
    documentsPath, localAppDataPath, modulePath: path.join(installation.path, ownerModules[gameId].module), moduleSha256: ownerModules[gameId].moduleSha256, assertAccess
  }) : null;
  if (farmingProfile) assertFarmingRunningProfile(existing, farmingProfile);
  await selectGtaMode({gameId,installation,existing,assertAccess});
  const needsGtaSave = GTA_IDS.has(gameId) && (gameId !== "gtav-montchiliad" || installation.edition === "enhanced");
  const saveDeployment = needsGtaSave && !existing ? await prepareGtaSave({ gameId, userDataPath, documentsPath, assertAccess }) : null;
  assertAccess();
  if (gameId === "euro-truck-simulator-2") await assertTruckSimulatorReady(installation.path);
  await assertStandaloneModuleReady(gameId, installation.path);
  if(gameId === "the-sims-4" && !existing) await require("./sims-managed-profile").prepareSimsRuntimeProfile(installation.path, {
    documentsPath,localAppDataPath,modulePath:path.join(installation.path,ownerModules[gameId].module),moduleSha256:ownerModules[gameId].moduleSha256,
    backupRoot:path.join(userDataPath || localAppDataPath || process.env.LOCALAPPDATA,"game-backups/the-sims-4"),assertAccess
  });
  await require("./owner-integration-installation").assertOwnerIntegrationReady(gameId,installation.path,{documentsPath,localAppDataPath});
  await assertShopModuleReady(gameId, installation.path);
  await require("./palworld-installation").assertPalworldModuleReady(gameId,installation.path);
  await assertModdedGameReady(gameId, installation.path, userDataPath);
  if(nativeFnv&&existing)await connectFnvXbox(installation.path,{assertAccess});
  if (!existing) {
    const epicUrl = needsGtaSave ? await findEpicLaunchUrl(installation.path) : '';
    assertAccess();
    if (farmingProfile?.managed) await shell.openExternal(farmingSteamLaunchUri(farmingProfile.directory));
    else if (epicUrl) await shell.openExternal(epicUrl);
    else if ((gameId === "terraria" && !manualTerrariaLauncher) || gameId === "escape-from-duckov" || (platform === "steam" && !manifest.directLauncher && !isModdedFarmGame(gameId) && (supportsPlatformChoice(manifest) || manifest.forceSteamLaunch))) await launchSteamGame({ gameId, manifest, executable, shell, assertAccess });
    else if (manifest.launchArguments) await require("./prepared-game-launch").launchPreparedProcess(executable,manifest,installation.path,{assertAccess});
    else {
      const error = await shell.openPath(executable);
      if (error) throw new Error(error);
    }
  }
  const processName = gameId === "palworld" ? (platform === "xbox" ? "Palworld-WinGDK-Shipping" : "Palworld-Win64-Shipping") : gameId === "dead-by-daylight" ? deadByDaylightProcess(installation).replace(/\.exe$/i, "") : manifest.waitForWindowProcess;
  if (processName) await waitForWindowsProcessWindow(processName, manifest.waitForWindowTimeoutMs);
  if(nativeFnv&&!existing)await connectFnvXbox(installation.path,{assertAccess});
  assertAccess();
  if (saveDeployment?.pending) scheduleGtaSaveDeployment();
  return { ok: true, path: executable, ...(saveDeployment ? { saveDeployment } : {}), ...(platform ? { platform } : {}), ...(existing ? { alreadyRunning: true, processId: existing.ProcessId } : {}) };
}

module.exports = { launchExternalGame, runningGameProcess };
