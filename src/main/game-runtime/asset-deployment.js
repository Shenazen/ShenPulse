"use strict";

/** Préparation des assets dans une zone temporaire, sans modifier directement le jeu. Dépendances injectées via runtime. */
const path = require("node:path");
const crypto = require("node:crypto");
const { installDotNetDesktopRuntime } = require("../dotnet-desktop-runtime");
const { safeChildPath, findNamedFile } = require("./paths");
const { extractArchiveSafe } = require("./archives");
const { stageGtaEnhancedSave } = require("./gta-save");
const { copyTreeWithBackup, copyWithBackup } = require("./deployments");

async function installAsset(runtime, {
    gameId,
    asset,
    downloadPath,
    targetPath,
    backupRoot,
    tempRoot,
    assertAccess = () => {}
  }) {
    assertAccess();
    const destinationRoot = safeChildPath(
      targetPath,
      asset.targetPath || ""
    );
    if (asset.action === "dotnet-desktop-runtime") {
      await installDotNetDesktopRuntime(downloadPath, {
        major: asset.major || 8,
        assertAccess
      });
      return;
    }
    if (asset.action === "copy") {
      await copyWithBackup(
        downloadPath,
        path.join(destinationRoot, asset.fileName),
        targetPath,
        backupRoot
      );
      return;
    }

    const stage = path.join(
      tempRoot,
      `stage-${asset.id}-${crypto.randomBytes(3).toString("hex")}`
    );
    await extractArchiveSafe(downloadPath, stage);
    assertAccess();
    if (asset.action === "gta-enhanced-save") {
      const stagingDirectory = path.join(
        runtime.app.getPath("userData"),
        "game-assets",
        gameId,
        "enhanced-save"
      );
      await stageGtaEnhancedSave(stage, stagingDirectory);
      return { preparedSaveDirectory: stagingDirectory };
    }
    if (asset.action === "smapi") {
      const installData = await findNamedFile(stage, "install.dat");
      if (!installData) {
        throw new Error("Le payload Windows de SMAPI est introuvable.");
      }
      const payloadStage = `${stage}-payload`;
      await extractArchiveSafe(installData, payloadStage);
      await copyTreeWithBackup(
        payloadStage,
        targetPath,
        targetPath,
        backupRoot
      );
      return;
    }
    if (asset.action === "gta-archive") {
      const gtaRoot = path.join(stage, "Grand Theft Auto V");
      await copyTreeWithBackup(
        path.join(gtaRoot, "Root Folder"),
        targetPath,
        targetPath,
        backupRoot
      );
      await copyTreeWithBackup(
        path.join(gtaRoot, "update"),
        path.join(targetPath, "update"),
        targetPath,
        backupRoot
      );
      return;
    }
    const sourceRoot = asset.sourcePath
      ? safeChildPath(stage, asset.sourcePath)
      : stage;
    if (asset.includeFiles?.length) {
      for (const fileName of asset.includeFiles) {
        if (path.basename(fileName) !== fileName) {
          throw new Error("Liste de fichiers d’installation non sûre.");
        }
        await copyWithBackup(
          safeChildPath(sourceRoot, fileName),
          path.join(destinationRoot, fileName),
          targetPath,
          backupRoot
        );
      }
      return;
    }
    await copyTreeWithBackup(
      sourceRoot,
      destinationRoot,
      targetPath,
      backupRoot
    );
  }

module.exports = { installAsset };

