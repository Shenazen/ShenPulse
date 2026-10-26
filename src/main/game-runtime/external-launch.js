"use strict";

const { supportsPlatformChoice, installationPlatform, assertRunningInstallation } = require("./installation-platform");
const { findLaunchTarget } = require("./paths");
const { launchSteamDemo, launchSteamGame } = require("./steam-launch");
const { runProcess } = require("./processes");
const { deadByDaylightProcess } = require("./four-games-installation");
const { assertTruckSimulatorReady } = require("./truck-simulator-installation");
const { assertStandaloneModuleReady } = require("./standalone-module-installation");
const { assertShopModuleReady } = require("./shop-games-installation");

async function runningGameProcess(names, { platform = process.platform, execute = runProcess } = {}) {
  if (platform !== "win32" || !names?.length) return null;
  if (!names.every(name => /^[a-z0-9_][a-z0-9_. -]{0,119}$/i.test(name))) throw new Error("Processus de jeu invalide.");
  const encoded = Buffer.from(JSON.stringify(names.map(name => name.replace(/\.exe$/i, ""))), "utf8").toString("base64");
  const output = await execute("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", [
    `$taskNames = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')) | ConvertFrom-Json`,
    "Get-CimInstance Win32_Process | Where-Object { $taskNames -contains [IO.Path]::GetFileNameWithoutExtension($_.Name) } | Select-Object ProcessId,Name,ExecutablePath | ConvertTo-Json -Compress",
    "exit 0"
  ].join("\n")]);
  if (!String(output).trim()) return null;
  const parsed = JSON.parse(output), processes = Array.isArray(parsed) ? parsed : [parsed];
  if (!processes.length) return null;
  if (processes.some(result => !Number.isSafeInteger(result.ProcessId) || result.ProcessId <= 0)) throw new Error("Le processus du jeu n’a pas pu être vérifié.");
  return { ...processes[0], processes };
}

async function launchExternalGame({ gameId, manifest, installation, shell, assertAccess,
  waitForWindowsProcessWindow, scheduleGtaSaveDeployment, findRunning = runningGameProcess }) {
  const detectedPlatform = await installationPlatform(installation.path, manifest);
  const platform = ["steam", "xbox"].includes(installation.platform) ? installation.platform : detectedPlatform;
  if (platform && detectedPlatform && platform !== detectedPlatform) throw new Error("Le dossier mémorisé ne correspond plus à la plateforme choisie. Réinstallez les interactions depuis l’étape Installation.");
  const names = manifest.launchExecutables || manifest.executables || [];
  const launchNames = platform === "xbox" ? ["gamelaunchhelper.exe"] : platform === "steam" ? names.filter(name => !/gamelaunchhelper|[\\/]WinGDK[\\/]/i.test(name)) : names;
  const executable = await findLaunchTarget(installation.path, launchNames, !platform);
  assertAccess();
  if (gameId === "find-the-needle-demo") return launchSteamDemo({ gameId, manifest, executable, shell, assertAccess });
  if (!executable) {
    if (manifest.requireLaunchExecutable) throw new Error(`Le lanceur de ${manifest.title} est introuvable. Réparez le jeu dans Steam ou l’application Xbox puis relancez l’installation des interactions.`);
    await shell.openPath(installation.path);
    return { ok: true, openedFolder: true, path: installation.path, message: "Le dossier installé est ouvert. Aucun exécutable sûr n’a été détecté automatiquement." };
  }
  const existing = await findRunning(manifest.singleInstanceProcesses);
  assertAccess();
  await assertRunningInstallation(existing, { ...installation, platform }, manifest);
  assertAccess();
  if (gameId === "euro-truck-simulator-2") await assertTruckSimulatorReady(installation.path);
  await assertStandaloneModuleReady(gameId, installation.path);
  await assertShopModuleReady(gameId, installation.path);
  if (!existing) {
    if (gameId === "escape-from-duckov" || (platform === "steam" && supportsPlatformChoice(manifest))) await launchSteamGame({ gameId, manifest, executable, shell, assertAccess });
    else {
      const error = await shell.openPath(executable);
      if (error) throw new Error(error);
    }
  }
  const processName = gameId === "dead-by-daylight" ? deadByDaylightProcess(installation).replace(/\.exe$/i, "") : manifest.waitForWindowProcess;
  if (processName) await waitForWindowsProcessWindow(processName, manifest.waitForWindowTimeoutMs);
  assertAccess();
  if (gameId === "gtav-montchiliad" && installation.edition === "enhanced") scheduleGtaSaveDeployment();
  return { ok: true, path: executable, ...(platform ? { platform } : {}), ...(existing ? { alreadyRunning: true, processId: existing.ProcessId } : {}) };
}

module.exports = { launchExternalGame, runningGameProcess };
