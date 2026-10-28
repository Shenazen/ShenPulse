"use strict";

const { readState } = require("../state-projection");

/** Installation orchestrée : confirmation, préparation, sauvegarde, déploiement et nettoyage. Dépendances injectées via runtime. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { installerForGame, isIntegratedGame } = require("../game-installer-manifest");
const { isDotNetDesktopRuntimeInstalled } = require("../dotnet-desktop-runtime");
const { writeMinecraftEula } = require("./minecraft-server");
const { stopOrphanedManagedProcesses } = require("./processes");
const { detectGtaEdition, deployGtaEnhancedSave } = require("./gta-save");
const { commitInstallationDeployment, deployAdditionalInstallTargets } = require("./deployments");
const { installationSlotPercent, cleanupStaleInstallerRuns } = require("./housekeeping");
const { installFindTheNeedleMod } = require("./find-the-needle-mod-installation");
const { detectBalatroEdition, stageBalatroInstallation } = require("./balatro-installation");
const { stageBluePrinceInstallation } = require("./blue-prince-installation");
const { installationPlatform } = require("./installation-platform");
const { assertModGameClosed } = require("./mod-installation-ready");
const { stageFourGamesInstallation, detectDredgeEdition } = require("./four-games-installation");
const { stageTruckSimulatorInstallation } = require("./truck-simulator-installation");
const { stageStandaloneModule } = require("./standalone-module-installation");
const { prepareShopUninstallReceipt } = require("./shop-game-uninstall");
const { stageShopGameInstallation, assertShopModuleReady } = require("./shop-games-installation");

async function installGame(runtime, gameId) {
    runtime.assertAccess(gameId);
    // Le runtime réel capture compte/profil et relit Pro avant chaque nouvelle
    // étape. Les doubles historiques restent compatibles via assertAccess.
    const assertAccess = runtime.createAccessGuard?.(gameId) || (() => runtime.assertAccess(gameId));
    if (isIntegratedGame(gameId)) {
      return runtime.launch(gameId);
    }
    const manifest = installerForGame(gameId);
    if (!manifest) {
      throw new Error(
        "Ce jeu utilise un installateur tiers. ShenPulse conserve son guide officiel, mais aucun fichier privé n’est publié pour ce pack."
      );
    }
    if (runtime.activeInstalls.has(gameId)) {
      throw new Error("Une installation est déjà en cours pour ce jeu.");
    }
    const previousInstallation =
      readState(runtime.store, ["game.installations"]).game.installations?.[gameId] || null;

    runtime.activeInstalls.add(gameId);
    try {
    runtime.progress(gameId, {
      phase: "prepare",
      current: 0,
      total: Math.max(1, manifest.assets.length),
      percent: 2,
      message: "Recherche automatique du jeu…"
    });
    const targetPath = manifest.temporaryTarget
      ? path.join(
          runtime.app.getPath("temp"),
          "ShenPulse",
          "games",
          `${gameId}-${manifest.version || "current"}`
        )
      : manifest.managedTarget
        ? path.join(
            runtime.app.getPath("userData"),
            "games",
            gameId
          )
      : await runtime.pickTarget(gameId, manifest);
    if (!targetPath) return { canceled: true };
    assertAccess();
    await runtime.validateTarget(targetPath, manifest);
    const platform = await installationPlatform(targetPath, manifest);
    await assertModGameClosed(gameId, targetPath);
    if (gameId === "pokemon-red-blue") await runtime.pokemonRedBlue?.stop();
    if (gameId === "super-mario-kart") await runtime.superMarioKart?.stop();
    assertAccess();
    if (manifest.localArchiveOnly) {
      return await installFindTheNeedleMod(runtime, { gameId, manifest, targetPath, previousInstallation, assertAccess });
    }
    if (manifest.setupOnly) {
      const installedAt = new Date().toISOString();
      runtime.store.mutate((state) => {
        state.game.installations ||= {};
        state.game.installations[gameId] = {
          gameId,
          path: targetPath,
          ...(platform ? { platform } : {}),
          backupPath: "",
          installedAt,
          assetCount: 0,
          installerVersion: String(manifest.version || ""),
          elevated: false,
          additionalDeployments: [],
          source: "local-setup"
        };
      });
      runtime.progress(gameId, {
        phase: "complete",
        current: 1,
        total: 1,
        percent: 100,
        message: `${manifest.title} est prêt`
      });
      return {
        ok: true,
        gameId,
        path: targetPath,
        ...(platform ? { platform } : {}),
        backupPath: "",
        installedAt,
        setupOnly: true
      };
    }
    const edition =
      ["gtav-montchiliad","gtav-koth-enhanced","gtav-hiking-enhanced"].includes(gameId)
        ? await detectGtaEdition(targetPath)
        : gameId === "balatro" ? await detectBalatroEdition(targetPath)
        : gameId === "dredge" ? await detectDredgeEdition(targetPath) : "";
    const candidateAssets = manifest.assets.filter(
      (asset) =>
        !asset.editions?.length || asset.editions.includes(edition)
    );
    const assets = [];
    for (const asset of candidateAssets) {
      if (
        asset.action === "dotnet-desktop-runtime" &&
        (await isDotNetDesktopRuntimeInstalled(asset.major || 8))
      ) {
        continue;
      }
      assets.push(asset);
    }
    if (!assets.length) {
      throw new Error(
        "Aucun fichier d’installation compatible avec cette édition du jeu."
      );
    }

    if (!manifest.unattended) {
      const confirmation = await runtime.dialog.showMessageBox(runtime.getWindow(), {
        type: "warning",
        title: `Installer ${manifest.title}`,
        message: `Installer automatiquement ${manifest.title} ?`,
        detail: [
          manifest.warning ||
            "Les fichiers existants remplacés seront sauvegardés avant la copie.",
          manifest.note || "",
          "Seuls les téléchargements temporaires seront supprimés à la fin."
        ]
          .filter(Boolean)
          .join("\n\n"),
        buttons: [
          manifest.requiresMinecraftEula
            ? "J’accepte le CLUF et installer"
            : "Installer",
          "Annuler"
        ],
        defaultId: 0,
        cancelId: 1,
        noLink: true
      });
      if (confirmation.response !== 0) return { canceled: true };
    }
    assertAccess();

    const runId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const downloadsRoot = path.join(
      runtime.app.getPath("temp"),
      "ShenPulse",
      "installer-downloads"
    );
    const tempRoot = path.join(downloadsRoot, `${gameId}-${runId}`);
    const backupRoot = manifest.temporaryTarget
      ? path.join(tempRoot, "replaced-files")
      : path.join(
          runtime.app.getPath("userData"),
          "game-backups",
          gameId,
          runId
        );
    const deploymentRoot = path.join(tempRoot, "deployment");
    let stardewBootstrap = null;
    try {
      if (manifest.minecraftServer) {
        await runtime.stopMinecraftServers();
        await stopOrphanedManagedProcesses(targetPath);
      }
      assertAccess();
      await cleanupStaleInstallerRuns(downloadsRoot, gameId);
      assertAccess();
      await fs.promises.mkdir(tempRoot, { recursive: true });
      await fs.promises.mkdir(targetPath, { recursive: true });
      await fs.promises.mkdir(deploymentRoot, { recursive: true });
      const total = assets.length;
      let saveDeployment = null;
      let preparedSaveDirectory = "";
      for (let index = 0; index < assets.length; index += 1) {
        assertAccess();
        const asset = assets[index];
        runtime.progress(gameId, {
          phase: "download",
          current: index + 1,
          total,
          percent: installationSlotPercent(index, total, 0),
          downloadPercent: null,
          indeterminate: true,
          bytesReceived: 0,
          totalBytes: 0,
          speedBps: 0,
          etaSeconds: null,
          message: `Connexion au téléchargement (${index + 1}/${total})`
        });
        const downloadPath = path.join(tempRoot, asset.fileName);
        await runtime.downloadAsset(gameId, asset, downloadPath, {
          index,
          total
        });
        assertAccess();
        runtime.progress(gameId, {
          phase: "install",
          current: index + 1,
          total,
          percent: installationSlotPercent(index, total, 0.88),
          downloadPercent: 100,
          indeterminate: true,
          message: `Préparation automatique (${index + 1}/${total})`
        });
        const assetResult = await runtime.installAsset({
          gameId,
          asset,
          downloadPath,
          targetPath: deploymentRoot,
          sourceGamePath: targetPath,
          backupRoot: path.join(tempRoot, "staging-backups"),
          tempRoot,
          assertAccess
        });
        if (assetResult?.preparedSaveDirectory) {
          preparedSaveDirectory = assetResult.preparedSaveDirectory;
        }
      }
      if (gameId === "balatro") await stageBalatroInstallation({ targetPath, deploymentRoot, edition, assertAccess });
      if (gameId === "euro-truck-simulator-2") await stageTruckSimulatorInstallation({ deploymentRoot, assertAccess });
      if (["blue-prince", "dredge"].includes(gameId)) await stageBluePrinceInstallation({ targetPath, deploymentRoot, tempRoot, assertAccess });
      const preparedModule = ["dredge", "egging-on", "fallout-4", "escape-from-duckov"].includes(gameId)
        ? await stageFourGamesInstallation({ gameId, targetPath, deploymentRoot, edition, assertAccess }) : null;
      await stageStandaloneModule({ gameId, deploymentRoot, assertAccess });
      const preparedShop = await stageShopGameInstallation({ gameId, targetPath, deploymentRoot, assertAccess });
      const preparedPalworld = await require("./palworld-installation").stagePalworldInstallation({gameId,targetPath,deploymentRoot,assertAccess});
      runtime.progress(gameId, {
        phase: "install",
        current: total,
        total,
        percent: 97,
        downloadPercent: 100,
        indeterminate: true,
        message:
          "Installation dans le dossier du jeu. Confirmez la demande Windows si elle apparaît."
      });
      if (manifest.temporaryTarget) {
        assertAccess();
        await fs.promises.rm(targetPath, {
          recursive: true,
          force: true,
          maxRetries: 3,
          retryDelay: 200
        });
        await fs.promises.mkdir(targetPath, { recursive: true });
      }
      assertAccess();
      await assertModGameClosed(gameId, targetPath);
      const uninstallReceiptPath = ['supermarket-simulator','tcg-card-shop-simulator','shift-at-midnight'].includes(gameId) ? await prepareShopUninstallReceipt({gameId,targetPath,deploymentRoot,backupRoot,userData:runtime.app.getPath('userData'),previousInstallation,assertAccess}) : '';
      stardewBootstrap = await require("./stardew-terraria").prepareStardewGamePassBootstrap({gameId,targetPath,deploymentRoot,backupRoot,assertAccess});
      const deployment = await commitInstallationDeployment({
        deploymentRoot,
        targetPath,
        backupRoot,
        tempRoot,
        retiredFiles: [...(manifest.retiredFiles || []), ...(preparedModule?.retiredFiles || []), ...(preparedShop?.retiredFiles || []), ...(preparedPalworld?.retiredFiles || [])],
        assertAccess
      });
      if (gameId === "terraria") await require("./stardew-terraria").configureTerrariaMod({gameId,targetPath,documentsPath:runtime.app.getPath("documents"),userDataPath:runtime.app.getPath("userData"),backupRoot,tempRoot,assertAccess});
      await assertShopModuleReady(gameId, targetPath);
      await require("./palworld-installation").assertPalworldModuleReady(gameId,targetPath);
      assertAccess();
      const additionalDeployments =
        await deployAdditionalInstallTargets({
          manifest,
          targetPath,
          backupRoot,
          documentsPath: runtime.app.getPath("documents"),
          appDataPath: runtime.app.getPath("appData"),
          edition,
          assertAccess
        });

      assertAccess();
      const emulatorSetup =
        gameId === "pokemon-red-blue"
          ? await runtime.pokemonRedBlue.prepareInstallation(
              targetPath,
              previousInstallation
            )
          : gameId === "super-mario-kart"
            ? await runtime.superMarioKart.prepareInstallation(
                targetPath,
                previousInstallation
              )
            : null;
      assertAccess();
      if (preparedSaveDirectory) {
        saveDeployment = await deployGtaEnhancedSave({
          sourceDirectory: preparedSaveDirectory,
          backupRoot: path.join(backupRoot, "save-profile"),
          documentsPath: runtime.app.getPath("documents")
        });
      }

      let server = null;
      if (manifest.minecraftServer) {
        assertAccess();
        await writeMinecraftEula(targetPath);
        runtime.progress(gameId, {
          phase: "launch",
          current: total,
          total,
          percent: 99,
          downloadPercent: 100,
          indeterminate: true,
          message:
            "Premier démarrage du serveur Minecraft. PaperMC prépare ses composants…"
        });
        server = await runtime.startMinecraftServer(
          gameId,
          targetPath,
          manifest,
          { assertAccess }
        );
      }

      const installedAt = new Date().toISOString();
      assertAccess();
      runtime.store.mutate((state) => {
        state.game.installations ||= {};
        state.game.installations[gameId] = {
          gameId,
          path: targetPath,
          backupPath: manifest.temporaryTarget ? "" : backupRoot,
          installedAt,
          ...(uninstallReceiptPath ? {uninstallReceiptPath} : {}),
          assetCount: assets.length,
          satisfiedAssetCount: candidateAssets.length,
          satisfiedAssetIds: candidateAssets
            .map((asset) => String(asset.id || "").trim())
            .filter(Boolean),
          installerVersion: String(manifest.version || ""),
          ...(platform ? { platform } : {}),
          edition: edition || undefined,
          elevated: deployment.elevated,
          additionalDeployments,
          ...(emulatorSetup || {}),
          saveDeployment,
          server: server
            ? {
                address: server.address,
                port: server.port,
                serverJar: path.basename(server.serverPath)
              }
            : undefined,
          source: assets.some((asset) => asset.url)
            ? assets.every((asset) =>
                String(asset.url || "").includes("backblazeb2.com")
              )
              ? "backblaze-b2"
              : "official-download"
            : "shenpulse-private-assets"
        };
      });
      runtime.progress(gameId, {
        phase: "complete",
        current: assets.length,
        total: assets.length,
        percent: 100,
        message: `${manifest.title} est installé`
      });
      stardewBootstrap = null;
      return {
        ok: true,
        gameId,
        path: targetPath,
        backupPath: manifest.temporaryTarget ? "" : backupRoot,
        installedAt,
        server,
        ...(emulatorSetup || {})
      };
    } catch (error) {
      if (stardewBootstrap) await stardewBootstrap.rollback();
      throw error;
    } finally {
      await fs.promises.rm(tempRoot, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 200
      });
    }
    } catch (error) {
      runtime.progress(gameId, {
        phase: "error",
        indeterminate: false,
        message:
          error?.message || "L’installation n’a pas pu se terminer."
      });
      throw error;
    } finally {
      if (
        !["complete", "error"].includes(
          runtime.installProgress.get(gameId)?.phase
        )
      ) {
        runtime.progress(gameId, {
          phase: "canceled",
          indeterminate: false
        });
      }
      runtime.activeInstalls.delete(gameId);
      runtime.installProgress.delete(gameId);
    }
  }

module.exports = { installGame };

