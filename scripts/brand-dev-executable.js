"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const packageJson = require("../package.json");

if (process.platform !== "win32") {
  process.stdout.write(
    "Identité de développement ShenPulse : aucune modification requise.\n"
  );
  process.exit(0);
}

const root = path.join(__dirname, "..");
const executable = path.join(
  root,
  "node_modules",
  "electron",
  "dist",
  "electron.exe"
);
const editor = path.join(
  root,
  "node_modules",
  "electron-winstaller",
  "vendor",
  "rcedit.exe"
);
const icon = path.join(root, "build", "shenpulse.ico");

for (const target of [executable, editor, icon]) {
  if (!fs.existsSync(target)) {
    throw new Error(`Ressource Windows ShenPulse introuvable : ${target}`);
  }
}

const versionParts = String(packageJson.version || "1.0.0")
  .split(".")
  .slice(0, 4);
while (versionParts.length < 4) versionParts.push("0");
const windowsVersion = versionParts.join(".");
const result = spawnSync(
  editor,
  [
    executable,
    "--set-icon",
    icon,
    "--set-version-string",
    "ProductName",
    "ShenPulse",
    "--set-version-string",
    "FileDescription",
    "ShenPulse",
    "--set-version-string",
    "InternalName",
    "ShenPulse",
    "--set-version-string",
    "OriginalFilename",
    "ShenPulse.exe",
    "--set-file-version",
    windowsVersion,
    "--set-product-version",
    windowsVersion
  ],
  {
    encoding: "utf8",
    windowsHide: true
  }
);

if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(
    String(result.stderr || result.stdout || "Échec de rcedit.").trim()
  );
}

process.stdout.write(
  "Exécutable Electron de développement marqué avec l’identité ShenPulse.\n"
);
