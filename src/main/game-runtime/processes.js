"use strict";

/** Gestion des processus enfants et des fenêtres de jeux sous Windows. Les opérations et garde-fous restent identiques. */
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

function waitForProcessSpawn(child, label) {
  if (child.pid && child.exitCode === null) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const onSpawn = () => {
      cleanup();
      resolve();
    };
    const onError = (error) => {
      cleanup();
      reject(
        new Error(
          `${label} nâ€™a pas pu dÃ©marrer : ${error.message}`
        )
      );
    };
    const cleanup = () => {
      child.off("spawn", onSpawn);
      child.off("error", onError);
    };
    child.once("spawn", onSpawn);
    child.once("error", onError);
  });
}

async function stopChildProcess(child) {
  if (!child || child.exitCode !== null || child.killed) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  try {
    child.kill();
  } catch {
    return;
  }
  await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(resolve, 2_000))
  ]);
}

async function stopOrphanedManagedProcesses(installationPath) {
  if (process.platform !== "win32") return [];
  const target = path.resolve(installationPath);
  const parsed = path.parse(target);
  if (target === parsed.root) {
    throw new Error("Dossier Minecraft géré non sûr.");
  }
  const encodedTarget = Buffer.from(target, "utf8").toString("base64");
  const script = [
    '$ErrorActionPreference = "Stop"',
    `$target = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedTarget}'))`,
    "$prefix = [IO.Path]::GetFullPath($target).TrimEnd([char[]]'\\/') + [IO.Path]::DirectorySeparatorChar",
    "$stopped = @()",
    "Get-Process -ErrorAction Stop | Where-Object { @('java','javaw','AutoClicker') -contains $_.ProcessName } | ForEach-Object {",
    "  $candidate = ''",
    "  try { $candidate = $_.Path } catch { $candidate = '' }",
    "  if (-not [string]::IsNullOrWhiteSpace($candidate)) {",
    "    $full = [IO.Path]::GetFullPath($candidate)",
    "    if ($full.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {",
    "      $stopped += [string]$_.Id",
    "      Stop-Process -Id $_.Id -Force -PassThru -ErrorAction Stop | Wait-Process -Timeout 10 -ErrorAction SilentlyContinue",
    "    }",
    "  }",
    "}",
    "if ($stopped.Count -gt 0) { $stopped -join ',' }"
  ].join("\r\n");
  const output = await runProcess("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    script
  ]);
  const processIds = String(output || "")
    .trim()
    .split(",")
    .map((entry) => Number(entry))
    .filter((entry) => Number.isSafeInteger(entry) && entry > 0);
  if (processIds.length) {
    await waitForProcessIdsToExit(processIds);
    await waitForUnlockedMinecraftFiles(target);
  }
  return processIds;
}

async function waitForProcessIdsToExit(processIds) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const remaining = processIds.filter((processId) => {
      try {
        process.kill(processId, 0);
        return true;
      } catch (error) {
        if (error?.code === "ESRCH") return false;
        throw error;
      }
    });
    if (!remaining.length) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    "Le serveur Minecraft ne s’est pas arrêté à temps. Réessayez dans quelques secondes."
  );
}

async function waitForUnlockedMinecraftFiles(installationPath) {
  const serverJar = path.join(
    installationPath,
    "paper-1.21-130.jar"
  );
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const stat = await fs.promises.stat(serverJar).catch(() => null);
    if (!stat?.isFile()) return;
    let locked = false;
    const handle = await fs.promises.open(serverJar, "r+").catch((error) => {
      if (["EBUSY", "EACCES", "EPERM"].includes(error?.code)) {
        locked = true;
        return null;
      }
      throw error;
    });
    await handle?.close();
    if (!locked) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    "Le serveur Minecraft a été arrêté, mais Windows verrouille encore ses fichiers. Réessayez dans quelques secondes."
  );
}

async function runProcess(file, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      if (stdout.length < 32 * 1024 * 1024) stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      if (stderr.length < 1024 * 1024) stderr += chunk.toString();
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `${file} a échoué (${code}).`));
    });
  });
}

async function waitForWindowsProcessWindow(
  processName,
  timeoutMs = 90_000,
  { platform = process.platform, execute = runProcess } = {}
) {
  if (platform !== "win32") return;
  const safeProcessName = String(processName || "")
    .replace(/\.exe$/i, "").trim();
  if (!/^[a-z0-9_][a-z0-9_. -]{0,119}$/i.test(safeProcessName)) {
    throw new Error("Le processus du jeu à attendre est invalide.");
  }
  const safeTimeout = Math.min(
    600_000,
    Math.max(5_000, Number(timeoutMs || 90_000))
  );
  const script = [
    `$deadline = [DateTime]::UtcNow.AddMilliseconds(${safeTimeout})`,
    "do {",
    `  $target = Get-CimInstance Win32_Process -Filter "Name = '${safeProcessName}.exe'" -ErrorAction SilentlyContinue | ForEach-Object { try { [Diagnostics.Process]::GetProcessById([int]$_.ProcessId) } catch {} } | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1`,
    "  if ($target) { exit 0 }",
    "  Start-Sleep -Milliseconds 500",
    "} while ([DateTime]::UtcNow -lt $deadline)",
    "exit 1"
  ].join("\n");
  try {
    await execute("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      script
    ]);
  } catch {
    throw new Error(
      `${processName}.exe a été lancé, mais sa fenêtre n’est pas encore prête. Attendez son écran d’accueil puis réessayez.`
    );
  }
}

module.exports = {
  waitForProcessSpawn,
  stopChildProcess,
  stopOrphanedManagedProcesses,
  waitForProcessIdsToExit,
  waitForUnlockedMinecraftFiles,
  runProcess,
  waitForWindowsProcessWindow,
};

