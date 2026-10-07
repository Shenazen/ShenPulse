"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

async function isDotNetDesktopRuntimeInstalled(
  incomingMajor,
  { roots = dotNetInstallRoots() } = {}
) {
  const major = Number(incomingMajor);
  if (!Number.isInteger(major) || major < 1 || major > 99) return false;
  for (const root of roots) {
    for (const framework of [
      "Microsoft.WindowsDesktop.App",
      "Microsoft.NETCore.App"
    ]) {
      const directory = path.join(root, "shared", framework);
      const versions = await fs.promises.readdir(directory).catch(() => []);
      if (
        versions.some((version) =>
          String(version).startsWith(`${major}.`)
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

async function installDotNetDesktopRuntime(
  installerPath,
  {
    major = 8,
    platform = process.platform,
    roots,
    runInstaller = runDotNetInstaller,
    detectionTimeoutMs = 120000,
    detectionPollIntervalMs = 500
  } = {}
) {
  if (platform !== "win32") {
    throw new Error(
      "L’installation automatique du runtime .NET est disponible uniquement sous Windows."
    );
  }
  const absolute = path.resolve(installerPath);
  const stat = await fs.promises.stat(absolute).catch(() => null);
  if (!stat?.isFile()) {
    throw new Error("L’installateur officiel du runtime .NET est introuvable.");
  }
  const code = Number(
    await runInstaller(absolute, ["/install", "/quiet", "/norestart"])
  );
  if (![0, 1641, 3010].includes(code)) {
    throw new Error(
      `L’installation du runtime .NET ${major} a échoué (code ${code}).`
    );
  }
  const installed = await waitForDotNetDesktopRuntime(major, {
    roots: roots || dotNetInstallRoots(),
    timeoutMs: detectionTimeoutMs,
    pollIntervalMs: detectionPollIntervalMs
  });
  if (!installed) {
    throw new Error(
      `Le runtime .NET ${major} n’a pas été détecté après son installation.`
    );
  }
  return { installed: true, major, restartRequired: code !== 0 };
}

async function waitForDotNetDesktopRuntime(
  major,
  {
    roots = dotNetInstallRoots(),
    timeoutMs = 120000,
    pollIntervalMs = 500
  } = {}
) {
  const deadline = Date.now() + Math.max(0, Number(timeoutMs) || 0);
  do {
    if (await isDotNetDesktopRuntimeInstalled(major, { roots })) return true;
    if (Date.now() >= deadline) break;
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(10, Number(pollIntervalMs) || 500))
    );
  } while (Date.now() <= deadline);
  return false;
}

function dotNetInstallRoots() {
  return [
    process.env.DOTNET_ROOT,
    process.env.DOTNET_ROOT_X64,
    process.env.ProgramW6432 && path.join(process.env.ProgramW6432, "dotnet"),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, "dotnet"),
    "C:\\Program Files\\dotnet"
  ]
    .filter(Boolean)
    .map((entry) => path.resolve(entry))
    .filter((entry, index, entries) => entries.indexOf(entry) === index);
}

function runDotNetInstaller(executable, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      windowsHide: true,
      shell: false,
      stdio: "ignore"
    });
    child.once("error", reject);
    child.once("close", (code) => resolve(Number(code ?? -1)));
  });
}

module.exports = {
  dotNetInstallRoots,
  installDotNetDesktopRuntime,
  isDotNetDesktopRuntimeInstalled,
  waitForDotNetDesktopRuntime
};
