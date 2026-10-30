"use strict";

/** Détection des jeux déjà installés, notamment dans les bibliothèques Steam. Les opérations et garde-fous restent identiques. */
const fs = require("node:fs");
const path = require("node:path");
const { runProcess } = require("./processes");
const { findLaunchTarget } = require("./paths");
const { installationPlatform, canonicalPath } = require("./installation-platform");

async function detectInstalledGame(gameId, manifest, previousPath = "") {
  return (await detectInstalledGames(gameId, manifest, previousPath))[0]?.path || "";
}

/** Retourne toutes les éditions valides, sans compter deux fois les jonctions Xbox. */
async function detectInstalledGames(gameId, manifest, previousPath = "", sources = {}) {
  const candidates = [previousPath].filter(Boolean);
  if (manifest.xboxDirectoryNames?.length) candidates.push(...await (sources.xbox || xboxGameInstallCandidates)(manifest));
  if (manifest.xboxIdentity) candidates.push(...await (sources.registeredXbox || registeredXboxInstallCandidates)(manifest));
  if (["gtav-montchiliad","gtav-koth-enhanced","gtav-hiking-enhanced"].includes(gameId)) candidates.push(...await (sources.gta || gtaInstallCandidates)());
  if (Array.isArray(manifest.steamAppIds) || Array.isArray(manifest.directoryNames)) candidates.push(...await (sources.steam || steamGameInstallCandidates)(manifest));
  const found = [], seen = new Set();
  for (let candidate of [...new Set(candidates.map(value => path.resolve(value)))]) {
    if(gameId==="fallout-new-vegas"&&await installationPlatform(candidate,manifest)==="xbox")candidate=await require("./fnv-gamepass").fnvXboxRoot(candidate);
    const stat = await fs.promises.stat(candidate).catch(() => null);
    if (!stat?.isDirectory()) continue;
    const executable = await findLaunchTarget(candidate, manifest.executables || [], false);
    if (!executable) continue;
    const canonical = await canonicalPath(candidate);
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    found.push({ path: candidate, platform: await installationPlatform(candidate, manifest) });
  }
  return found;
}

/** Les packages Xbox peuvent être rangés sous un GUID. On résout leur jonction
 * officielle vers XboxGames sans modifier WindowsApps ni ses autorisations. */
async function registeredXboxInstallCandidates(manifest, { platform = process.platform, execute = runProcess } = {}) {
  if (platform !== "win32" || !/^[A-Za-z0-9.-]+$/.test(manifest.xboxIdentity || "")) return [];
  const output = await execute("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
    `Get-AppxPackage -Name '${manifest.xboxIdentity}' | Select-Object -ExpandProperty InstallLocation`]).catch(() => "");
  const candidates = [];
  for (const location of String(output).trim().split(/\r?\n/).filter(Boolean)) {
    const actual = await fs.promises.realpath(location.trim()).catch(() => "");
    if (actual) candidates.push(actual);
  }
  return candidates;
}

/** Dossiers modifiables gérés par l’application Xbox, sans parcourir WindowsApps. */
async function xboxGameInstallCandidates(manifest) {
  if (process.platform !== "win32") return [];
  const drives = [...new Set([process.env.SystemDrive || "C:", ...Array.from({ length: 26 }, (_, i) => `${String.fromCharCode(65 + i)}:`)])];
  const candidates = [];
  for (const drive of drives) {
    for (const name of manifest.xboxDirectoryNames || []) {
      if (/[\\/]/.test(name) || name === "..") continue;
      const candidate = path.join(`${drive}\\`, "XboxGames", name, "Content");
      const config = await fs.promises.readFile(path.join(candidate, "MicrosoftGame.Config"), "utf8").catch(() => "");
      const identity = config.match(/<Identity\s+Name="([^"]+)"/i)?.[1];
      if (identity === manifest.xboxIdentity) candidates.push(candidate);
    }
  }
  return candidates;
}

async function steamGameInstallCandidates(manifest) {
  const directoryNames = (manifest.directoryNames || [])
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const steamAppIds = (manifest.steamAppIds || [])
    .map((value) => String(value || "").replace(/\D/g, ""))
    .filter(Boolean);
  const programFiles = [
    process.env.ProgramW6432,
    process.env.ProgramFiles,
    process.env["ProgramFiles(x86)"],
    "C:\\Program Files",
    "C:\\Program Files (x86)"
  ].filter(Boolean);
  const steamRoots = [
    ...programFiles.map((root) => path.join(root, "Steam")),
    "C:\\Steam",
    ...(await windowsSteamInstallRoots())
  ];
  const libraryRoots = new Set();
  for (const steamRoot of [...new Set(steamRoots)]) {
    libraryRoots.add(steamRoot);
    const libraryFile = path.join(
      steamRoot,
      "steamapps",
      "libraryfolders.vdf"
    );
    const source = await fs.promises
      .readFile(libraryFile, "utf8")
      .catch(() => "");
    for (const match of source.matchAll(/"path"\s+"([^"]+)"/g)) {
      libraryRoots.add(match[1].replace(/\\\\/g, "\\"));
    }
  }

  const candidates = [];
  for (const libraryRoot of libraryRoots) {
    const steamApps = path.join(libraryRoot, "steamapps");
    const common = path.join(steamApps, "common");
    for (const directoryName of directoryNames) {
      candidates.push(path.join(common, directoryName));
    }
    for (const appId of steamAppIds) {
      const manifestSource = await fs.promises
        .readFile(path.join(steamApps, `appmanifest_${appId}.acf`), "utf8")
        .catch(() => "");
      const installDirectory =
        manifestSource.match(/"installdir"\s+"([^"]+)"/i)?.[1] || "";
      if (installDirectory) {
        candidates.push(path.join(common, installDirectory));
      }
    }
  }
  for (const root of programFiles) {
    for (const directoryName of directoryNames) {
      candidates.push(
        path.join(root, directoryName),
        path.join(root, "GOG Galaxy", "Games", directoryName)
      );
    }
  }
  return candidates;
}

async function windowsSteamInstallRoots() {
  if (process.platform !== "win32") return [];
  const locations = [
    ["HKCU\\Software\\Valve\\Steam", "SteamPath"],
    ["HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam", "InstallPath"],
    ["HKLM\\SOFTWARE\\Valve\\Steam", "InstallPath"]
  ];
  const roots = [];
  for (const [key, valueName] of locations) {
    const source = await runProcess("reg.exe", [
      "query",
      key,
      "/v",
      valueName
    ]).catch(() => "");
    const root = source.match(/REG_(?:SZ|EXPAND_SZ)\s+(.+)$/im)?.[1]?.trim();
    if (root) roots.push(root.replace(/\//g, "\\"));
  }
  return [...new Set(roots.map((root) => path.resolve(root)))];
}

async function gtaInstallCandidates({ epic = require("./gta-epic-launch").gtaEpicInstallCandidates, programFiles = [
    process.env.ProgramW6432,
    process.env.ProgramFiles,
    process.env["ProgramFiles(x86)"],
    "C:\\Program Files",
    "C:\\Program Files (x86)"
  ].filter(Boolean) } = {}) {
  const candidates = [...await epic()];
  for (const root of programFiles) {
    candidates.push(
      path.join(root, "Rockstar Games", "Grand Theft Auto V"),
      path.join(root, "Rockstar Games", "Grand Theft Auto V Enhanced"),
      path.join(root, "Epic Games", "GTAV"),
      path.join(root, "Epic Games", "GTAVEnhanced"),
      path.join(root, "Epic Games", "Grand Theft Auto V"),
      path.join(root, "Epic Games", "Grand Theft Auto V Enhanced"),
      path.join(root, "Steam", "steamapps", "common", "Grand Theft Auto V"),
      path.join(
        root,
        "Steam",
        "steamapps",
        "common",
        "Grand Theft Auto V Enhanced"
      )
    );
  }

  const steamRoots = [
    ...programFiles.map((root) => path.join(root, "Steam")),
    "C:\\Steam"
  ];
  for (const steamRoot of [...new Set(steamRoots)]) {
    const libraryFile = path.join(
      steamRoot,
      "steamapps",
      "libraryfolders.vdf"
    );
    const source = await fs.promises
      .readFile(libraryFile, "utf8")
      .catch(() => "");
    for (const match of source.matchAll(/"path"\s+"([^"]+)"/g)) {
      const libraryRoot = match[1].replace(/\\\\/g, "\\");
      candidates.push(
        path.join(
          libraryRoot,
          "steamapps",
          "common",
          "Grand Theft Auto V"
        ),
        path.join(
          libraryRoot,
          "steamapps",
          "common",
          "Grand Theft Auto V Enhanced"
        )
      );
    }
  }
  return candidates;
}

module.exports = {
  registeredXboxInstallCandidates,
  detectInstalledGame,
  detectInstalledGames,
  steamGameInstallCandidates,
  windowsSteamInstallRoots,
  gtaInstallCandidates,
};

