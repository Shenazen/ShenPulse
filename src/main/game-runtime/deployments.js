"use strict";

/** Déploiement transactionnel des packs et conservation des sauvegardes. Les opérations et garde-fous restent identiques. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { runProcess } = require("./processes");
const { safeChildPath, sha256File } = require("./paths");

async function commitInstallationDeployment({
  deploymentRoot,
  targetPath,
  backupRoot,
  tempRoot,
  retiredFiles = [],
  assertAccess = () => {}
}) {
  assertAccess();
  const source = path.resolve(deploymentRoot);
  const target = path.resolve(targetPath);
  const backup = path.resolve(backupRoot);
  // Seuls des fichiers explicites sont retirés, avec sauvegarde préalable.
  for (const relative of retiredFiles) {
    safeChildPath(target, relative);
    safeChildPath(backup, relative);
  }
  const sourceStat = await fs.promises.stat(source).catch(() => null);
  if (!sourceStat?.isDirectory()) {
    throw new Error("Les fichiers préparés pour l’installation sont absents.");
  }
  const files = await collectFiles(source);
  if (!files.length && !retiredFiles.length) {
    return { elevated: false, fileCount: 0 };
  }
  if (await canWriteToDirectory(target)) {
    assertAccess();
    await copyTreeWithBackup(source, target, target, backup, { assertAccess });
    await retireInstallationFiles(target, backup, retiredFiles, assertAccess);
    return { elevated: false, fileCount: files.length };
  }
  assertAccess();
  return commitInstallationDeploymentElevated({
    deploymentRoot: source,
    targetPath: target,
    backupRoot: backup,
    tempRoot,
    retiredFiles,
    fileCount: files.length,
    assertAccess
  });
}

async function canWriteToDirectory(directory) {
  const probe = path.join(
    directory,
    `.shenpulse-write-test-${crypto.randomBytes(6).toString("hex")}.tmp`
  );
  try {
    await fs.promises.writeFile(probe, "ShenPulse", { flag: "wx" });
    await fs.promises.rm(probe, { force: true });
    return true;
  } catch (error) {
    await fs.promises.rm(probe, { force: true }).catch(() => {});
    if (["EACCES", "EPERM", "EROFS"].includes(error?.code)) return false;
    throw error;
  }
}

async function commitInstallationDeploymentElevated({
  deploymentRoot,
  targetPath,
  backupRoot,
  tempRoot,
  fileCount,
  retiredFiles = [],
  assertAccess = () => {}
}) {
  const elevationRoot = path.join(tempRoot, "elevated-commit");
  const helperPath = path.join(elevationRoot, "commit.ps1");
  const launcherPath = path.join(elevationRoot, "request-admin.ps1");
  const resultPath = path.join(elevationRoot, "result.txt");
  await fs.promises.mkdir(elevationRoot, { recursive: true });
  const encode = (value) =>
    Buffer.from(String(value), "utf8").toString("base64");
  const helper = [
    '$ErrorActionPreference = "Stop"',
    "function Decode([string] $value) {",
    "  return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($value))",
    "}",
    `$sourceRoot = [IO.Path]::GetFullPath((Decode '${encode(deploymentRoot)}')).TrimEnd([char[]]'\\/')`,
    `$targetRoot = [IO.Path]::GetFullPath((Decode '${encode(targetPath)}')).TrimEnd([char[]]'\\/')`,
    `$backupRoot = [IO.Path]::GetFullPath((Decode '${encode(backupRoot)}')).TrimEnd([char[]]'\\/')`,
    `$resultPath = [IO.Path]::GetFullPath((Decode '${encode(resultPath)}'))`,
    "try {",
    "  if (-not [IO.Directory]::Exists($sourceRoot)) { throw 'Prepared files are missing.' }",
    "  if (-not [IO.Directory]::Exists($targetRoot)) { throw 'The game folder is missing.' }",
    "  $driveRoot = [IO.Path]::GetPathRoot($targetRoot).TrimEnd([char[]]'\\/')",
    "  if ([string]::Equals($targetRoot, $driveRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe game folder.' }",
    "  $sourcePrefix = $sourceRoot + [IO.Path]::DirectorySeparatorChar",
    "  $targetPrefix = $targetRoot + [IO.Path]::DirectorySeparatorChar",
    "  $backupPrefix = $backupRoot + [IO.Path]::DirectorySeparatorChar",
    "  foreach ($file in Get-ChildItem -LiteralPath $sourceRoot -Recurse -File) {",
    "    $fullSource = [IO.Path]::GetFullPath($file.FullName)",
    "    if (-not $fullSource.StartsWith($sourcePrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe source path.' }",
    "    $relative = $fullSource.Substring($sourcePrefix.Length)",
    "    if ([string]::IsNullOrWhiteSpace($relative) -or $relative.Split([char[]]'\\/') -contains '..') { throw 'Unsafe relative path.' }",
    "    $destination = [IO.Path]::GetFullPath((Join-Path $targetRoot $relative))",
    "    $backup = [IO.Path]::GetFullPath((Join-Path $backupRoot $relative))",
    "    if (-not $destination.StartsWith($targetPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Destination outside game folder.' }",
    "    if (-not $backup.StartsWith($backupPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Backup outside ShenPulse folder.' }",
    "    if ([IO.Directory]::Exists($destination)) { throw ('A folder blocks installation: ' + $relative) }",
    "    if ([IO.File]::Exists($destination)) {",
    "      [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($backup)) | Out-Null",
    "      [IO.File]::Copy($destination, $backup, $true)",
    "    }",
    "    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination)) | Out-Null",
    "    [IO.File]::Copy($fullSource, $destination, $true)",
    "    if ((Get-Item -LiteralPath $destination).Length -ne $file.Length) { throw ('Copy verification failed: ' + $relative) }",
    "  }",
    ...retiredFiles.flatMap((relative) => [
      `  $relative = Decode '${encode(relative)}'`,
      "  $old = [IO.Path]::GetFullPath((Join-Path $targetRoot $relative))",
      "  $saved = [IO.Path]::GetFullPath((Join-Path $backupRoot $relative))",
      "  if (-not $old.StartsWith($targetPrefix, [StringComparison]::OrdinalIgnoreCase) -or -not $saved.StartsWith($backupPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe retired path.' }",
      "  if ([IO.Directory]::Exists($old)) { throw 'A folder blocks mod migration.' }",
      "  if ([IO.File]::Exists($old)) {",
      "    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($saved)) | Out-Null",
      "    [IO.File]::Copy($old, $saved, $true)",
      "    [IO.File]::Delete($old)",
      "  }"
    ]),
    "  [IO.File]::WriteAllText($resultPath, 'OK', [Text.UTF8Encoding]::new($false))",
    "  exit 0",
    "} catch {",
    "  [IO.File]::WriteAllText($resultPath, ('ERROR:' + $_.Exception.Message), [Text.UTF8Encoding]::new($false))",
    "  exit 1",
    "}"
  ].join("\r\n");
  const launcher = [
    '$ErrorActionPreference = "Stop"',
    "$helper = Join-Path $PSScriptRoot 'commit.ps1'",
    "$quotedHelper = '\"' + $helper.Replace('\"', '\\\"') + '\"'",
    "try {",
    "  $process = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', $quotedHelper) -Verb RunAs -WindowStyle Hidden -Wait -PassThru",
    "  exit $process.ExitCode",
    "} catch {",
    "  exit 1223",
    "}"
  ].join("\r\n");
  await fs.promises.writeFile(helperPath, helper, "utf8");
  await fs.promises.writeFile(launcherPath, launcher, "utf8");

  let launchError = null;
  assertAccess();
  try {
    await runProcess("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      launcherPath
    ]);
  } catch (error) {
    launchError = error;
  }
  const result = await fs.promises
    .readFile(resultPath, "utf8")
    .catch(() => "");
  if (result.trim() === "OK") {
    return { elevated: true, fileCount };
  }
  if (result.startsWith("ERROR:")) {
    throw new Error(
      `Windows n’a pas pu terminer la copie dans le dossier du jeu : ${result.slice(6).trim()}`
    );
  }
  throw new Error(
    launchError
      ? "L’autorisation administrateur Windows est nécessaire pour installer les fichiers dans Program Files. Relancez l’installation puis acceptez la demande."
      : "L’installation élevée n’a pas renvoyé de confirmation."
  );
}

async function collectFiles(directory) {
  const result = [];
  const entries = await fs.promises.readdir(directory, {
    withFileTypes: true
  });
  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await collectFiles(candidate)));
    } else if (entry.isFile()) {
      result.push(candidate);
    }
  }
  return result;
}

async function retireInstallationFiles(target, backup, files, assertAccess) {
  for (const relative of files) {
    assertAccess();
    const old = safeChildPath(target, relative);
    const stat = await fs.promises.lstat(old).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (!stat) continue;
    if (!stat.isFile()) throw new Error("Un dossier ou lien bloque la migration du mod local.");
    const saved = safeChildPath(backup, relative);
    await fs.promises.mkdir(path.dirname(saved), { recursive: true });
    await fs.promises.copyFile(old, saved);
    assertAccess();
    await fs.promises.unlink(old);
  }
}

async function copyTreeWithBackup(
  sourceRoot,
  destinationRoot,
  installRoot,
  backupRoot,
  { assertAccess = () => {} } = {}
) {
  assertAccess();
  const stat = await fs.promises.stat(sourceRoot).catch(() => null);
  if (!stat) throw new Error(`Fichier d’installation absent : ${sourceRoot}`);
  if (!stat.isDirectory()) {
    await copyWithBackup(
      sourceRoot,
      destinationRoot,
      installRoot,
      backupRoot,
      { assertAccess }
    );
    return;
  }
  assertAccess();
  await fs.promises.mkdir(destinationRoot, { recursive: true });
  const entries = await fs.promises.readdir(sourceRoot, {
    withFileTypes: true
  });
  for (const entry of entries) {
    const source = path.join(sourceRoot, entry.name);
    const destination = path.join(destinationRoot, entry.name);
    if (entry.isDirectory()) {
      await copyTreeWithBackup(
        source,
        destination,
        installRoot,
        backupRoot,
        { assertAccess }
      );
    } else if (entry.isFile()) {
      await copyWithBackup(
        source,
        destination,
        installRoot,
        backupRoot,
        { assertAccess }
      );
    }
  }
}

async function copyWithBackup(source, destination, installRoot, backupRoot, { assertAccess = () => {} } = {}) {
  assertAccess();
  safeChildPath(installRoot, path.relative(installRoot, destination));
  const existing = await fs.promises.stat(destination).catch(() => null);
  if (existing?.isFile()) {
    const sourceStat = await fs.promises.stat(source);
    if (
      existing.size === sourceStat.size &&
      (await sha256File(destination)) === (await sha256File(source))
    ) {
      return { unchanged: true };
    }
    const relative = path.relative(installRoot, destination);
    const backup = safeChildPath(backupRoot, relative);
    await fs.promises.mkdir(path.dirname(backup), { recursive: true });
    assertAccess();
    await fs.promises.copyFile(destination, backup);
  } else if (existing?.isDirectory()) {
    throw new Error(`Impossible de remplacer le dossier ${destination}.`);
  }
  await fs.promises.mkdir(path.dirname(destination), { recursive: true });
  assertAccess();
  await fs.promises.copyFile(source, destination);
  return { unchanged: false };
}

async function deployAdditionalInstallTargets({
  manifest,
  targetPath,
  backupRoot,
  documentsPath,
  appDataPath,
  programDataPath = process.env.ProgramData,
  edition,
  assertAccess = () => {}
}) {
  const targets = Array.isArray(manifest?.additionalInstallTargets)
    ? manifest.additionalInstallTargets
    : [];
  const deployed = [];
  for (const entry of targets) {
    if (entry.editions?.length && !entry.editions.includes(edition)) continue;
    assertAccess();
    if (!["documents", "appData", "programData"].includes(entry?.root)) {
      throw new Error(
        "Destination d’installation supplémentaire non autorisée."
      );
    }
    const source = safeChildPath(targetPath, entry.sourcePath || "");
    const selectedRoot=entry.root === "programData" ? programDataPath : entry.root === "appData" ? appDataPath : documentsPath;
    if (!selectedRoot || !path.isAbsolute(selectedRoot)) throw new Error("La destination du chargeur n’a pas pu être résolue.");
    const root = path.resolve(selectedRoot);
    const destination = safeChildPath(root, entry.targetPath || "");
    const stat = await fs.promises.stat(source).catch(() => null);
    if (!(entry.directory ? stat?.isDirectory() : stat?.isFile())) {
      throw new Error(
        `Le fichier préparé ${entry.sourcePath || ""} est introuvable.`
      );
    }
    await (entry.directory ? copyTreeWithBackup : copyWithBackup)(
      source,
      destination,
      root,
      path.join(backupRoot, "additional-targets", entry.root),
      { assertAccess }
    );
    deployed.push({
      root: entry.root,
      path: destination
    });
  }
  return deployed;
}

module.exports = {
  commitInstallationDeployment,
  canWriteToDirectory,
  commitInstallationDeploymentElevated,
  collectFiles,
  copyTreeWithBackup,
  copyWithBackup,
  deployAdditionalInstallTargets,
};

