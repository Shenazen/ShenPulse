"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { pipeline } = require("node:stream/promises");
const { Readable, Transform } = require("node:stream");
const {
  BrowserWindow,
  dialog,
  nativeImage,
  shell
} = require("electron");
const {
  installerForGame,
  isIntegratedGame
} = require("./game-installer-manifest");

const ASSET_ORIGIN = "https://shenpulse.leuridan.fr";
const ASSET_SECRET = "shenpulse-installer-assets-v1-local-fallback";
const LAUNCHER_VERSION = "ShenPulseNew/1.0";

class GameRuntimeService {
  constructor({
    app,
    store,
    getWindow,
    notifyRenderer,
    assertAccess = () => {}
  }) {
    this.app = app;
    this.store = store;
    this.getWindow = getWindow;
    this.notifyRenderer = notifyRenderer;
    this.assertAccess = assertAccess;
    this.gameWindows = new Map();
    this.activeInstalls = new Set();
    this.minecraftServers = new Map();
    this.minecraftAutoClickers = new Map();
    this.saveDeploymentJobs = new Map();
  }

  status(gameId) {
    this.assertAccess(gameId);
    const installation =
      this.store.getState().game.installations?.[gameId] || null;
    return {
      gameId,
      integrated: isIntegratedGame(gameId),
      automated: Boolean(installerForGame(gameId)),
      installing: this.activeInstalls.has(gameId),
      serverRunning: this.#minecraftServerRunning(gameId),
      autoClickerRunning: this.#minecraftAutoClickerRunning(gameId),
      installation
    };
  }

  minecraftConnectionStatus(gameId) {
    this.assertAccess(gameId);
    const record = this.minecraftServers.get(gameId);
    if (!this.#minecraftServerRunning(gameId)) {
      throw new Error(
        "Le serveur Minecraft ShenPulse n’est pas lancé. Ouvrez le jeu depuis ShenPulse, puis réessayez."
      );
    }
    return {
      ok: true,
      type: "minecraft-runtime",
      ...minecraftServerResult(record)
    };
  }

  async executeMinecraftCommands(gameId, commands) {
    this.assertAccess(gameId);
    const record = this.minecraftServers.get(gameId);
    if (!this.#minecraftServerRunning(gameId)) {
      throw new Error(
        "Le serveur Minecraft ShenPulse n’est pas lancé. Ouvrez le jeu depuis ShenPulse, puis réessayez."
      );
    }
    const entries = (Array.isArray(commands) ? commands : [commands])
      .map((command) => sanitizeMinecraftConsoleCommand(command))
      .filter(Boolean);
    if (!entries.length) {
      throw new Error("Cette interaction Minecraft ne contient aucune commande.");
    }
    let sent = 0;
    for (const command of entries) {
      const delay = command.match(/^delay\s+(\d+)$/i);
      if (delay) {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(600_000, Number(delay[1]) || 0))
        );
        continue;
      }
      await writeMinecraftServerCommand(record, command);
      sent += 1;
    }
    return {
      status: "success",
      sent: true,
      commandCount: sent,
      gameId
    };
  }

  async install(gameId) {
    this.assertAccess(gameId);
    if (isIntegratedGame(gameId)) {
      return this.launch(gameId);
    }
    const manifest = installerForGame(gameId);
    if (!manifest) {
      throw new Error(
        "Ce jeu utilise un installateur tiers. ShenPulse conserve son guide officiel, mais aucun fichier privé n’est publié pour ce pack."
      );
    }
    if (this.activeInstalls.has(gameId)) {
      throw new Error("Une installation est déjà en cours pour ce jeu.");
    }

    this.#progress(gameId, {
      phase: "prepare",
      current: 0,
      total: manifest.assets.length,
      percent: 2,
      message: "Recherche automatique du jeu…"
    });
    const targetPath = manifest.managedTarget
      ? path.join(
          this.app.getPath("userData"),
          "games",
          gameId
        )
      : await this.#pickTarget(gameId, manifest);
    if (!targetPath) return { canceled: true };
    await this.#validateTarget(targetPath, manifest);
    const edition =
      gameId === "gtav-montchiliad"
        ? await detectGtaEdition(targetPath)
        : "";
    const assets = manifest.assets.filter(
      (asset) =>
        !asset.editions?.length || asset.editions.includes(edition)
    );
    if (!assets.length) {
      throw new Error(
        "Aucun fichier d’installation compatible avec cette édition du jeu."
      );
    }

    if (!manifest.unattended) {
      const confirmation = await dialog.showMessageBox(this.getWindow(), {
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

    this.activeInstalls.add(gameId);
    const runId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const downloadsRoot = path.join(
      this.app.getPath("temp"),
      "ShenPulse",
      "installer-downloads"
    );
    const tempRoot = path.join(downloadsRoot, `${gameId}-${runId}`);
    const backupRoot = path.join(
      this.app.getPath("userData"),
      "game-backups",
      gameId,
      runId
    );
    const deploymentRoot = path.join(tempRoot, "deployment");
    try {
      if (manifest.minecraftServer) {
        await this.#stopMinecraftServers();
      }
      await cleanupStaleInstallerRuns(downloadsRoot, gameId);
      await fs.promises.mkdir(tempRoot, { recursive: true });
      await fs.promises.mkdir(targetPath, { recursive: true });
      await fs.promises.mkdir(deploymentRoot, { recursive: true });
      const total = assets.length;
      let saveDeployment = null;
      let preparedSaveDirectory = "";
      for (let index = 0; index < assets.length; index += 1) {
        const asset = assets[index];
        this.#progress(gameId, {
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
        await this.#downloadAsset(gameId, asset, downloadPath, {
          index,
          total
        });
        this.#progress(gameId, {
          phase: "install",
          current: index + 1,
          total,
          percent: installationSlotPercent(index, total, 0.88),
          downloadPercent: 100,
          indeterminate: true,
          message: `Préparation automatique (${index + 1}/${total})`
        });
        const assetResult = await this.#installAsset({
          gameId,
          asset,
          downloadPath,
          targetPath: deploymentRoot,
          backupRoot: path.join(tempRoot, "staging-backups"),
          tempRoot
        });
        if (assetResult?.preparedSaveDirectory) {
          preparedSaveDirectory = assetResult.preparedSaveDirectory;
        }
      }
      this.#progress(gameId, {
        phase: "install",
        current: total,
        total,
        percent: 97,
        downloadPercent: 100,
        indeterminate: true,
        message:
          "Installation dans le dossier du jeu. Confirmez la demande Windows si elle apparaît."
      });
      const deployment = await commitInstallationDeployment({
        deploymentRoot,
        targetPath,
        backupRoot,
        tempRoot
      });
      const additionalDeployments =
        await deployAdditionalInstallTargets({
          manifest,
          targetPath,
          backupRoot,
          documentsPath: this.app.getPath("documents")
        });
      if (preparedSaveDirectory) {
        saveDeployment = await deployGtaEnhancedSave({
          sourceDirectory: preparedSaveDirectory,
          backupRoot: path.join(backupRoot, "save-profile"),
          documentsPath: this.app.getPath("documents")
        });
      }

      let server = null;
      if (manifest.minecraftServer) {
        await writeMinecraftEula(targetPath);
        this.#progress(gameId, {
          phase: "launch",
          current: total,
          total,
          percent: 99,
          downloadPercent: 100,
          indeterminate: true,
          message:
            "Premier démarrage du serveur Minecraft. PaperMC prépare ses composants…"
        });
        server = await this.#startMinecraftServer(
          gameId,
          targetPath,
          manifest
        );
      }

      const installedAt = new Date().toISOString();
      this.store.mutate((state) => {
        state.game.installations ||= {};
        state.game.installations[gameId] = {
          gameId,
          path: targetPath,
          backupPath: backupRoot,
          installedAt,
          assetCount: assets.length,
          installerVersion: String(manifest.version || ""),
          edition: edition || undefined,
          elevated: deployment.elevated,
          additionalDeployments,
          saveDeployment,
          server: server
            ? {
                address: server.address,
                port: server.port,
                serverJar: path.basename(server.serverPath)
              }
            : undefined,
          source: assets.some((asset) => asset.url)
            ? "backblaze-b2"
            : "shenpulse-private-assets"
        };
      });
      this.#progress(gameId, {
        phase: "complete",
        current: assets.length,
        total: assets.length,
        percent: 100,
        message: `${manifest.title} est installé`
      });
      return {
        ok: true,
        gameId,
        path: targetPath,
        backupPath: backupRoot,
        installedAt,
        server
      };
    } finally {
      this.activeInstalls.delete(gameId);
      await fs.promises.rm(tempRoot, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 200
      });
    }
  }

  async launch(gameId) {
    this.assertAccess(gameId);
    if (isIntegratedGame(gameId)) {
      return this.#launchIntegrated(gameId);
    }
    const manifest = installerForGame(gameId);
    const installation =
      this.store.getState().game.installations?.[gameId];
    if (!manifest || !installation?.path) {
      throw new Error(
        "Installez d’abord ce jeu ou son pack depuis l’étape Installation."
      );
    }
    if (manifest.minecraftServer) {
      const server = await this.#startMinecraftServer(
        gameId,
        installation.path,
        manifest
      );
      return {
        ok: true,
        gameId,
        server,
        message: `${manifest.title} est prêt sur ${server.address}`
      };
    }
    const executable = await findLaunchTarget(
      installation.path,
      manifest.launchExecutables || manifest.executables || []
    );
    if (!executable) {
      await shell.openPath(installation.path);
      return {
        ok: true,
        openedFolder: true,
        path: installation.path,
        message:
          "Le dossier installé est ouvert. Aucun exécutable sûr n’a été détecté automatiquement."
      };
    }
    const error = await shell.openPath(executable);
    if (error) throw new Error(error);
    if (
      gameId === "gtav-montchiliad" &&
      installation.edition === "enhanced"
    ) {
      this.#scheduleGtaSaveDeployment(gameId);
    }
    return { ok: true, path: executable };
  }

  async stop(gameId) {
    const record = this.minecraftServers.get(gameId);
    if (record) {
      this.minecraftServers.delete(gameId);
      await this.#stopMinecraftAutoClicker(gameId);
      await stopMinecraftServerRecord(record);
      return {
        stopped: true,
        gameId,
        type: "minecraft-server"
      };
    }
    const gameWindow = this.gameWindows.get(gameId);
    if (gameWindow && !gameWindow.isDestroyed()) {
      gameWindow.close();
      this.gameWindows.delete(gameId);
      return {
        stopped: true,
        gameId,
        type: "integrated-window"
      };
    }
    return { stopped: false, gameId };
  }

  async dispose() {
    await this.#stopMinecraftServers();
    await this.#stopMinecraftAutoClickers();
    for (const window of this.gameWindows.values()) {
      if (window && !window.isDestroyed()) window.close();
    }
    this.gameWindows.clear();
  }

  #minecraftServerRunning(gameId) {
    const record = this.minecraftServers.get(gameId);
    return Boolean(
      record?.process &&
        record.process.exitCode === null &&
        !record.process.killed
    );
  }

  #minecraftAutoClickerRunning(gameId) {
    const record = this.minecraftAutoClickers.get(gameId);
    return Boolean(
      record?.process &&
        record.process.exitCode === null &&
        !record.process.killed
    );
  }

  async #startMinecraftServer(gameId, installationPath, manifest) {
    if (this.#minecraftServerRunning(gameId)) {
      const existing = this.minecraftServers.get(gameId);
      await existing.ready;
      const autoClicker = await this.#startMinecraftAutoClicker(
        gameId,
        installationPath,
        manifest
      );
      return {
        ...minecraftServerResult(existing),
        autoClicker
      };
    }
    await this.#stopMinecraftServers();

    const serverConfig = manifest.minecraftServer || {};
    const serverPath = safeChildPath(
      installationPath,
      serverConfig.serverJar || ""
    );
    const javaRoot = safeChildPath(
      installationPath,
      serverConfig.javaDirectory || "runtime/java"
    );
    const serverStat = await fs.promises.stat(serverPath).catch(() => null);
    if (!serverStat?.isFile()) {
      throw new Error(
        "Le serveur PaperMC ShenPulse est introuvable. Réparez l’installation."
      );
    }
    const javaPath = await findNamedFile(javaRoot, "java.exe").catch(
      () => ""
    );
    if (!javaPath) {
      throw new Error(
        "Java 21 ShenPulse est introuvable. Réparez l’installation."
      );
    }

    await writeMinecraftEula(installationPath);
    await configureMinecraftServerCommandFeedback(installationPath);
    const child = spawn(
      javaPath,
      [
        `-Xms${serverConfig.xms || "1024M"}`,
        `-Xmx${serverConfig.xmx || "2048M"}`,
        "-Dfile.encoding=UTF-8",
        "-jar",
        serverPath,
        "nogui"
      ],
      {
        cwd: installationPath,
        windowsHide: true,
        shell: false,
        stdio: ["pipe", "pipe", "pipe"]
      }
    );
    const record = createMinecraftServerRecord({
      child,
      gameId,
      installationPath,
      javaPath,
      serverPath,
      port: Number(serverConfig.port || 25565)
    });
    this.minecraftServers.set(gameId, record);
    child.once("exit", () => {
      if (this.minecraftServers.get(gameId) === record) {
        this.minecraftServers.delete(gameId);
      }
      this.#stopMinecraftAutoClicker(gameId).catch(() => {});
    });

    try {
      await record.ready;
      await silenceMinecraftCommandFeedback(record);
      const autoClicker = await this.#startMinecraftAutoClicker(
        gameId,
        installationPath,
        manifest
      );
      return {
        ...minecraftServerResult(record),
        autoClicker
      };
    } catch (error) {
      await this.#stopMinecraftAutoClicker(gameId);
      await stopMinecraftServerRecord(record);
      if (this.minecraftServers.get(gameId) === record) {
        this.minecraftServers.delete(gameId);
      }
      throw error;
    }
  }

  async #stopMinecraftServers() {
    const records = [...this.minecraftServers.values()];
    this.minecraftServers.clear();
    await this.#stopMinecraftAutoClickers();
    await Promise.all(records.map(stopMinecraftServerRecord));
  }

  async #startMinecraftAutoClicker(
    gameId,
    installationPath,
    manifest
  ) {
    const config = manifest.autoClicker || {};
    if (!config.autoStart || !config.executable) return null;
    if (this.#minecraftAutoClickerRunning(gameId)) {
      return minecraftAutoClickerResult(
        this.minecraftAutoClickers.get(gameId)
      );
    }
    await this.#stopMinecraftAutoClickers();

    const executablePath = safeChildPath(
      installationPath,
      config.executable
    );
    const executable = await fs.promises
      .stat(executablePath)
      .catch(() => null);
    if (!executable?.isFile()) {
      throw new Error(
        "Lâ€™AutoClicker Minecraft ShenPulse est introuvable. Mettez Ã  jour ou rÃ©parez lâ€™installation."
      );
    }
    const child = spawn(executablePath, [], {
      cwd: path.dirname(executablePath),
      windowsHide: false,
      shell: false,
      stdio: "ignore"
    });
    const record = {
      process: child,
      gameId,
      executablePath
    };
    this.minecraftAutoClickers.set(gameId, record);
    child.once("exit", () => {
      if (this.minecraftAutoClickers.get(gameId) === record) {
        this.minecraftAutoClickers.delete(gameId);
      }
    });
    try {
      await waitForProcessSpawn(child, "AutoClicker Minecraft");
      return minecraftAutoClickerResult(record);
    } catch (error) {
      if (this.minecraftAutoClickers.get(gameId) === record) {
        this.minecraftAutoClickers.delete(gameId);
      }
      throw error;
    }
  }

  async #stopMinecraftAutoClicker(gameId) {
    const record = this.minecraftAutoClickers.get(gameId);
    if (!record) return;
    this.minecraftAutoClickers.delete(gameId);
    await stopChildProcess(record.process);
  }

  async #stopMinecraftAutoClickers() {
    const records = [...this.minecraftAutoClickers.values()];
    this.minecraftAutoClickers.clear();
    await Promise.all(
      records.map((record) => stopChildProcess(record.process))
    );
  }

  #scheduleGtaSaveDeployment(gameId) {
    if (this.saveDeploymentJobs.has(gameId)) return;
    const stagingDirectory = path.join(
      this.app.getPath("userData"),
      "game-assets",
      gameId,
      "enhanced-save"
    );
    const tryDeployment = async (attempt = 0) => {
      const backupRoot = path.join(
        this.app.getPath("userData"),
        "game-backups",
        gameId,
        "save-profile",
        `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`
      );
      try {
        const result = await deployGtaEnhancedSave({
          sourceDirectory: stagingDirectory,
          backupRoot,
          documentsPath: this.app.getPath("documents")
        });
        if (result.deployed || result.alreadyPresent) {
          this.saveDeploymentJobs.delete(gameId);
          this.store.mutate((state) => {
            const installation = state.game.installations?.[gameId];
            if (installation) installation.saveDeployment = result;
          });
          return;
        }
      } catch {
        // Le profil peut être temporairement verrouillé pendant la synchronisation Rockstar.
      }
      if (attempt >= 29) {
        this.saveDeploymentJobs.delete(gameId);
        return;
      }
      const timer = setTimeout(
        () => tryDeployment(attempt + 1),
        10_000
      );
      this.saveDeploymentJobs.set(gameId, timer);
    };
    const timer = setTimeout(() => tryDeployment(0), 20_000);
    this.saveDeploymentJobs.set(gameId, timer);
  }

  async #pickTarget(gameId, manifest) {
    const previous =
      this.store.getState().game.installations?.[gameId]?.path;
    let detected = "";
    if (manifest.autoDetect) {
      detected = await detectInstalledGame(
        gameId,
        manifest,
        previous
      );
    }

    if (detected) {
      const confirmation = await dialog.showMessageBox(this.getWindow(), {
        type: "question",
        title: `Confirmer le dossier de ${manifest.title}`,
        message: `${manifest.title} a été détecté à cet emplacement :`,
        detail: [
          detected,
          "",
          "ShenPulse vérifiera une dernière fois le dossier avant de télécharger et d’installer les fichiers."
        ].join("\n"),
        buttons: [
          "Oui, installer ici",
          "Non, choisir un autre dossier",
          "Annuler"
        ],
        defaultId: 0,
        cancelId: 2,
        noLink: true
      });
      if (confirmation.response === 2) return "";
      if (confirmation.response === 0) {
        try {
          await this.#validateTarget(detected, manifest);
          return detected;
        } catch (error) {
          const retry = await this.#showInvalidTarget(
            detected,
            manifest,
            error
          );
          if (!retry) return "";
        }
      }
    } else if (manifest.autoDetect) {
      const missing = await dialog.showMessageBox(this.getWindow(), {
        type: "info",
        title: `${manifest.title} n’a pas été détecté`,
        message: "Choisissez le dossier d’installation du jeu.",
        detail: `Sélectionnez précisément le ${manifest.targetLabel || "dossier du jeu"}. ShenPulse vérifiera son contenu avant de continuer.`,
        buttons: ["Choisir le dossier", "Annuler"],
        defaultId: 0,
        cancelId: 1,
        noLink: true
      });
      if (missing.response !== 0) return "";
    }

    let defaultPath = detected || previous || "";
    while (true) {
      const result = await dialog.showOpenDialog(this.getWindow(), {
        title: `Choisissez le ${manifest.targetLabel || `dossier de ${manifest.title}`}`,
        defaultPath: defaultPath || undefined,
        buttonLabel: "Vérifier ce dossier",
        properties: ["openDirectory"]
      });
      if (result.canceled || !result.filePaths[0]) return "";

      const selected = path.resolve(result.filePaths[0]);
      try {
        await this.#validateTarget(selected, manifest);
        return selected;
      } catch (error) {
        defaultPath = selected;
        const retry = await this.#showInvalidTarget(
          selected,
          manifest,
          error
        );
        if (!retry) return "";
      }
    }
  }

  async #showInvalidTarget(targetPath, manifest, error) {
    const result = await dialog.showMessageBox(this.getWindow(), {
      type: "error",
      title: "Dossier de jeu incorrect",
      message: `Ce dossier ne correspond pas à ${manifest.title}.`,
      detail: [
        targetPath,
        "",
        error?.message || "L’exécutable attendu n’a pas été trouvé.",
        "",
        `Choisissez précisément le ${manifest.targetLabel || "dossier du jeu"}.`
      ].join("\n"),
      buttons: ["Choisir un autre dossier", "Annuler"],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    });
    return result.response === 0;
  }

  async #validateTarget(targetPath, manifest) {
    const absolute = path.resolve(targetPath);
    const parsed = path.parse(absolute);
    if (absolute === parsed.root) {
      throw new Error(
        "Choisissez un dossier de jeu précis, pas la racine du disque."
      );
    }
    const stat = await fs.promises.stat(absolute).catch(() => null);
    if (stat && !stat.isDirectory()) {
      throw new Error("La destination sélectionnée n’est pas un dossier.");
    }
    if (manifest.executables?.length) {
      const found = await findLaunchTarget(absolute, manifest.executables, false);
      if (!found) {
        throw new Error(
          `Ce dossier ne contient pas ${manifest.executables.join(" ou ")}.`
        );
      }
    }
  }

  async #downloadAsset(
    gameId,
    asset,
    destinationPath,
    { index = 0, total = 1 } = {}
  ) {
    const pathname = `/api/installer-assets/${encodeURIComponent(
      gameId
    )}/${encodeURIComponent(asset.id)}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const origin =
      process.env.SHENPULSE_INSTALLER_ASSET_ORIGIN || ASSET_ORIGIN;
    const directUrl = safeInstallerAssetUrl(asset.url);
    const requestUrl = directUrl || `${origin}${pathname}`;
    const headers = {
      "X-ShenPulse-Launcher-Version": LAUNCHER_VERSION
    };
    if (!directUrl) {
      const canonical = `GET\n${pathname}\n${timestamp}`;
      headers["X-ShenPulse-Asset-Timestamp"] = timestamp;
      headers["X-ShenPulse-Asset-Signature"] = crypto
        .createHmac("sha256", ASSET_SECRET)
        .update(canonical)
        .digest("hex");
    }
    const controller = new AbortController();
    const transferStartedAt = Date.now();
    let receivedBytes = 0;
    let lastReportAt = 0;
    let stalled = false;
    let stallTimer = 0;
    const resetStallTimer = () => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        stalled = true;
        controller.abort();
      }, 60_000);
    };
    resetStallTimer();
    try {
      const response = await fetch(requestUrl, {
        headers,
        redirect: directUrl ? "follow" : "error",
        signal: controller.signal
      });
      if (!response.ok || !response.body) {
        throw new Error(
          `Le serveur d’installation ne répond pas correctement (code ${response.status}). Réessayez dans quelques instants.`
        );
      }
      const responseLength = Number(
        response.headers.get("content-length") || 0
      );
      const expectedLength = Number(asset.size || responseLength || 0);
      if (
        responseLength &&
        asset.size &&
        responseLength !== Number(asset.size)
      ) {
        throw new Error(
          "Le fichier distant ne correspond pas à la version publiée."
        );
      }
      const report = (force = false) => {
        const now = Date.now();
        if (!force && now - lastReportAt < 200) return;
        lastReportAt = now;
        const elapsedSeconds = Math.max(
          0.001,
          (now - transferStartedAt) / 1000
        );
        const speedBps = receivedBytes / elapsedSeconds;
        const downloadRatio = expectedLength
          ? Math.min(1, receivedBytes / expectedLength)
          : 0;
        this.#progress(gameId, {
          phase: "download",
          current: index + 1,
          total,
          percent: installationSlotPercent(
            index,
            total,
            expectedLength ? downloadRatio * 0.82 : 0.06
          ),
          downloadPercent: expectedLength
            ? Math.round(downloadRatio * 100)
            : null,
          indeterminate: !expectedLength,
          bytesReceived: receivedBytes,
          totalBytes: expectedLength,
          speedBps: Math.round(speedBps),
          etaSeconds:
            expectedLength && speedBps > 0
              ? Math.max(
                  0,
                  Math.round((expectedLength - receivedBytes) / speedBps)
                )
              : null,
          transferStartedAt: new Date(transferStartedAt).toISOString(),
          message: `Téléchargement en cours (${index + 1}/${total})`
        });
      };
      report(true);
      await fs.promises.mkdir(path.dirname(destinationPath), {
        recursive: true
      });
      const partialPath = `${destinationPath}.partial`;
      const meter = new Transform({
        transform: (chunk, _encoding, callback) => {
          receivedBytes += chunk.length;
          resetStallTimer();
          report(receivedBytes === expectedLength);
          callback(null, chunk);
        }
      });
      await pipeline(
        Readable.fromWeb(response.body),
        meter,
        fs.createWriteStream(partialPath, { flags: "wx" })
      );
      report(true);
      const stat = await fs.promises.stat(partialPath);
      if (stat.size < 1) {
        throw new Error(
          "Le serveur a renvoyé un téléchargement vide. Réessayez dans quelques instants."
        );
      }
      if (expectedLength && stat.size !== expectedLength) {
        throw new Error(
          "Le téléchargement a été interrompu avant la fin. ShenPulse a supprimé le fichier incomplet ; vous pouvez réessayer."
        );
      }
      if (asset.sha256) {
        const actualHash = await sha256File(partialPath);
        if (
          actualHash.toLowerCase() !==
          String(asset.sha256).toLowerCase()
        ) {
          throw new Error(
            "Le contrôle d’intégrité du téléchargement a échoué. Le fichier a été refusé."
          );
        }
      }
      await fs.promises.rename(partialPath, destinationPath);
    } catch (error) {
      if (stalled || error?.name === "AbortError") {
        throw new Error(
          "Le téléchargement ne reçoit plus de données depuis une minute. Vérifiez votre connexion puis réessayez."
        );
      }
      if (error?.code === "ENOSPC") {
        throw new Error(
          "L’espace disque disponible est insuffisant pour terminer l’installation."
        );
      }
      if (error?.code === "EACCES" || error?.code === "EPERM") {
        throw new Error(
          "ShenPulse ne peut pas enregistrer les fichiers dans ce dossier. Fermez le jeu et réessayez."
        );
      }
      if (
        error instanceof TypeError ||
        ["ECONNRESET", "ENETUNREACH", "ETIMEDOUT"].includes(
          error?.cause?.code || error?.code
        )
      ) {
        throw new Error(
          "Impossible de contacter le serveur d’installation. Vérifiez votre connexion Internet puis réessayez."
        );
      }
      throw error;
    } finally {
      clearTimeout(stallTimer);
    }
  }

  async #installAsset({
    gameId,
    asset,
    downloadPath,
    targetPath,
    backupRoot,
    tempRoot
  }) {
    const destinationRoot = safeChildPath(
      targetPath,
      asset.targetPath || ""
    );
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
    if (asset.action === "gta-enhanced-save") {
      const stagingDirectory = path.join(
        this.app.getPath("userData"),
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

  #launchIntegrated(gameId) {
    const existing = this.gameWindows.get(gameId);
    if (existing && !existing.isDestroyed()) {
      existing.show();
      existing.focus();
      return { ok: true, focused: true, gameId };
    }
    const iconPath = path.join(
      __dirname,
      "..",
      "..",
      "build",
      "shenpulse.ico"
    );
    const icon = nativeImage.createFromPath(iconPath);
    const gameWindow = new BrowserWindow({
      width: 1280,
      height: 820,
      minWidth: 980,
      minHeight: 680,
      title: `ShenPulse · ${gameId}`,
      backgroundColor: "#070914",
      icon: icon.isEmpty() ? undefined : icon,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true
      }
    });
    this.gameWindows.set(gameId, gameWindow);
    gameWindow.on("closed", () => this.gameWindows.delete(gameId));
    gameWindow.loadFile(
      path.join(__dirname, "..", "renderer", "games", "host.html"),
      { query: { gameId } }
    );
    return { ok: true, opened: true, gameId };
  }

  #progress(gameId, progress) {
    this.notifyRenderer("game-install-progress", {
      gameId,
      occurredAt: new Date().toISOString(),
      ...progress
    });
  }
}

async function writeMinecraftEula(installationPath) {
  const eulaPath = safeChildPath(installationPath, "eula.txt");
  await fs.promises.mkdir(path.dirname(eulaPath), { recursive: true });
  await fs.promises.writeFile(
    eulaPath,
    [
      "# Accepted explicitly through ShenPulse.",
      "# https://aka.ms/MinecraftEULA",
      "eula=true",
      ""
    ].join("\r\n"),
    "utf8"
  );
}

async function configureMinecraftServerCommandFeedback(installationPath) {
  const propertiesPath = safeChildPath(
    installationPath,
    "server.properties"
  );
  const original = await fs.promises
    .readFile(propertiesPath, "utf8")
    .catch(() => "");
  let updated = original;
  updated = upsertMinecraftServerProperty(
    updated,
    "broadcast-console-to-ops",
    "false"
  );
  updated = upsertMinecraftServerProperty(
    updated,
    "broadcast-rcon-to-ops",
    "false"
  );
  if (updated !== original) {
    await fs.promises.writeFile(propertiesPath, updated, "utf8");
  }
  return propertiesPath;
}

function upsertMinecraftServerProperty(source, key, value) {
  const newline = String(source).includes("\r\n") ? "\r\n" : "\n";
  const lines = String(source || "")
    .replace(/\r\n/g, "\n")
    .split("\n");
  let replaced = false;
  const next = [];
  for (const line of lines) {
    if (!line.startsWith(`${key}=`)) {
      next.push(line);
      continue;
    }
    if (!replaced) next.push(`${key}=${value}`);
    replaced = true;
  }
  if (!replaced) {
    while (next.length && !next[next.length - 1]) next.pop();
    next.push(`${key}=${value}`, "");
  }
  return next.join(newline);
}

async function silenceMinecraftCommandFeedback(record) {
  for (const command of [
    "gamerule sendCommandFeedback false",
    "gamerule commandBlockOutput false",
    "gamerule logAdminCommands false"
  ]) {
    await writeMinecraftServerCommand(record, command);
  }
}

function createMinecraftServerRecord({
  child,
  gameId,
  installationPath,
  javaPath,
  serverPath,
  port
}) {
  const record = {
    process: child,
    gameId,
    installationPath,
    javaPath,
    serverPath,
    port,
    logTail: "",
    ready: null
  };
  let settled = false;
  let partial = "";
  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  record.ready = ready;
  const timer = setTimeout(() => {
    fail(
      "Le serveur Minecraft n’a pas terminé son premier démarrage dans les cinq minutes."
    );
  }, 300_000);

  const succeed = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    resolveReady(record);
  };
  const fail = (message) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    const detail = record.logTail
      ? `\n\nDernier message PaperMC : ${record.logTail}`
      : "";
    rejectReady(new Error(`${message}${detail}`));
  };
  const remember = (chunk) => {
    partial += String(chunk || "");
    const lines = partial.split(/\r?\n/);
    partial = lines.pop() || "";
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      record.logTail = line.slice(-800);
      if (
        /\bDone \(.+\)! For help, type/i.test(line) ||
        /For help, type "help"/i.test(line)
      ) {
        succeed();
      } else if (
        /FAILED TO BIND TO PORT|Address already in use|Failed to bind to port/i.test(
          line
        )
      ) {
        fail(
          "Le port Minecraft 25565 est déjà utilisé. Fermez l’autre serveur puis réessayez."
        );
      } else if (
        /You need to agree to the EULA|eula\.txt.*false/i.test(line)
      ) {
        fail(
          "PaperMC n’a pas reconnu l’acceptation du CLUF Minecraft."
        );
      }
    }
  };

  child.stdout?.on("data", remember);
  child.stderr?.on("data", remember);
  child.once("error", (error) => {
    fail(`Impossible de lancer Java 21 : ${error.message}`);
  });
  child.once("exit", (code) => {
    if (!settled) {
      fail(
        `Le serveur Minecraft s’est arrêté avant d’être prêt (code ${String(
          code ?? "inconnu"
        )}).`
      );
    }
  });
  return record;
}

function minecraftServerResult(record) {
  return {
    running: Boolean(
      record?.process &&
        record.process.exitCode === null &&
        !record.process.killed
    ),
    address: `127.0.0.1:${Number(record?.port || 25565)}`,
    host: "127.0.0.1",
    port: Number(record?.port || 25565),
    javaPath: record?.javaPath || "",
    serverPath: record?.serverPath || ""
  };
}

function minecraftAutoClickerResult(record) {
  return {
    installed: Boolean(record?.executablePath),
    running: Boolean(
      record?.process &&
        record.process.exitCode === null &&
        !record.process.killed
    ),
    executablePath: record?.executablePath || ""
  };
}

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

function sanitizeMinecraftConsoleCommand(value) {
  return String(value || "")
    .replace(/[\0\r\n]/g, " ")
    .trim()
    .replace(/^\/+/, "")
    .slice(0, 2000);
}

function writeMinecraftServerCommand(record, command) {
  const child = record?.process;
  if (
    !child ||
    child.exitCode !== null ||
    child.killed ||
    !child.stdin ||
    child.stdin.destroyed
  ) {
    throw new Error("La console du serveur Minecraft n’est plus disponible.");
  }
  return new Promise((resolve, reject) => {
    child.stdin.write(`${command}\r\n`, "utf8", (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function stopMinecraftServerRecord(record) {
  const child = record?.process;
  if (!child || child.exitCode !== null || child.killed) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  try {
    child.stdin?.write("stop\r\n");
    child.stdin?.end();
  } catch {
    // Le serveur peut avoir fermé sa console pendant son arrêt.
  }
  const graceful = await Promise.race([
    exited.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 10_000))
  ]);
  if (graceful || child.exitCode !== null) return;
  try {
    child.kill();
  } catch {
    // Le processus a pu se fermer entre les deux contrôles.
  }
  await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(resolve, 2_000))
  ]);
}

function installationSlotPercent(index, total, slotProgress = 0) {
  const safeTotal = Math.max(1, Number(total || 1));
  const safeIndex = Math.max(0, Math.min(safeTotal - 1, Number(index || 0)));
  const safeProgress = Math.max(0, Math.min(1, Number(slotProgress || 0)));
  return Math.min(
    96,
    Math.max(
      3,
      Math.round(3 + ((safeIndex + safeProgress) / safeTotal) * 93)
    )
  );
}

async function cleanupStaleInstallerRuns(downloadsRoot, gameId) {
  const absoluteRoot = path.resolve(downloadsRoot);
  const entries = await fs.promises
    .readdir(absoluteRoot, { withFileTypes: true })
    .catch(() => []);
  for (const entry of entries) {
    if (
      !entry.isDirectory() ||
      !entry.name.startsWith(`${gameId}-`)
    ) {
      continue;
    }
    const target = path.resolve(absoluteRoot, entry.name);
    if (path.dirname(target) !== absoluteRoot) continue;
    await fs.promises.rm(target, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 200
    });
  }
}

function safeChildPath(root, relativePath) {
  const absoluteRoot = path.resolve(root);
  const target = path.resolve(absoluteRoot, relativePath || ".");
  const relative = path.relative(absoluteRoot, target);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error("Chemin d’installation non sûr.");
  }
  return target;
}

function safeInstallerAssetUrl(value) {
  const source = String(value || "").trim();
  if (!source) return "";
  let url;
  try {
    url = new URL(source);
  } catch {
    throw new Error("URL de téléchargement d’installation invalide.");
  }
  if (
    url.protocol !== "https:" ||
    !(
      url.hostname === "backblazeb2.com" ||
      url.hostname.endsWith(".backblazeb2.com")
    )
  ) {
    throw new Error("Hôte de téléchargement d’installation non autorisé.");
  }
  return url.href;
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function extractArchiveSafe(archivePath, destinationPath) {
  const listing = await runProcess("tar.exe", ["-tf", archivePath]);
  const entries = listing.split(/\r?\n/).filter(Boolean);
  if (!entries.length) throw new Error("Archive vide ou illisible.");
  for (const entry of entries) {
    const normalized = entry.replace(/\\/g, "/");
    if (
      normalized.startsWith("/") ||
      /^[a-zA-Z]:/.test(normalized) ||
      normalized.split("/").includes("..")
    ) {
      throw new Error("Archive refusée : un chemin sort de la destination.");
    }
  }
  await fs.promises.mkdir(destinationPath, { recursive: true });
  await runProcess("tar.exe", [
    "-xf",
    archivePath,
    "-C",
    destinationPath
  ]);
}

async function detectGtaEdition(gamePath) {
  const enhanced = await findLaunchTarget(
    gamePath,
    ["GTA5_Enhanced.exe"],
    false
  );
  return enhanced ? "enhanced" : "legacy";
}

async function stageGtaEnhancedSave(
  extractedDirectory,
  stagingDirectory
) {
  const expectedFiles = ["SGTA50001", "SGTA50015", "SGTA50015.bak"];
  await fs.promises.mkdir(stagingDirectory, { recursive: true });
  for (const fileName of expectedFiles) {
    const source = await findNamedFile(extractedDirectory, fileName);
    if (!source) {
      throw new Error(
        `Fichier de sauvegarde GTA Enhanced absent : ${fileName}.`
      );
    }
    const destination = safeChildPath(stagingDirectory, fileName);
    await fs.promises.copyFile(source, destination);
  }
  const canonical = path.join(stagingDirectory, "SGTA50015");
  const stat = await fs.promises.stat(canonical).catch(() => null);
  if (!stat?.isFile() || stat.size < 512 * 1024) {
    throw new Error("La sauvegarde GTA Enhanced préparée est invalide.");
  }
  return stagingDirectory;
}

async function deployGtaEnhancedSave({
  sourceDirectory,
  backupRoot,
  documentsPath = ""
}) {
  const canonical =
    (await existingFile(path.join(sourceDirectory, "SGTA50015"))) ||
    (await existingFile(path.join(sourceDirectory, "SGTA50001")));
  if (!canonical) {
    return {
      deployed: false,
      pending: true,
      reason: "save-not-staged"
    };
  }
  const profile = await findGtaEnhancedProfile({ documentsPath });
  if (!profile) {
    return {
      deployed: false,
      pending: true,
      reason: "rockstar-profile-not-found"
    };
  }

  const canonicalHash = await sha256File(canonical);
  for (let slot = 1; slot <= 15; slot += 1) {
    const existing = path.join(
      profile,
      `SGTA5${String(slot).padStart(4, "0")}`
    );
    if (!(await existingFile(existing))) continue;
    if ((await sha256File(existing)) === canonicalHash) {
      return {
        deployed: false,
        alreadyPresent: true,
        pending: false,
        profile,
        slot,
        savePath: existing
      };
    }
  }

  let selectedSlot = 0;
  for (let slot = 15; slot >= 1; slot -= 1) {
    const baseName = `SGTA5${String(slot).padStart(4, "0")}`;
    const main = path.join(profile, baseName);
    const backup = `${main}.bak`;
    if (
      !(await fs.promises.stat(main).catch(() => null)) &&
      !(await fs.promises.stat(backup).catch(() => null))
    ) {
      selectedSlot = slot;
      break;
    }
  }
  if (!selectedSlot) selectedSlot = 15;

  const targetName = `SGTA5${String(selectedSlot).padStart(4, "0")}`;
  const target = path.join(profile, targetName);
  const targetBackup = `${target}.bak`;
  const sourceBackup =
    (await existingFile(path.join(sourceDirectory, "SGTA50015.bak"))) ||
    canonical;
  const replaced = [];
  for (const existing of [target, targetBackup]) {
    if (!(await existingFile(existing))) continue;
    await fs.promises.mkdir(backupRoot, { recursive: true });
    const backupDestination = safeChildPath(
      backupRoot,
      path.basename(existing)
    );
    await fs.promises.copyFile(existing, backupDestination);
    replaced.push({
      source: existing,
      backup: backupDestination
    });
  }

  await fs.promises.copyFile(canonical, target);
  await fs.promises.copyFile(sourceBackup, targetBackup);
  if ((await sha256File(target)) !== canonicalHash) {
    throw new Error(
      "La vérification de la sauvegarde GTA Enhanced copiée a échoué."
    );
  }
  return {
    deployed: true,
    alreadyPresent: false,
    pending: false,
    profile,
    slot: selectedSlot,
    savePath: target,
    backupPath: replaced.length ? backupRoot : "",
    replaced
  };
}

async function findGtaEnhancedProfile({ documentsPath = "" } = {}) {
  const testPath = String(
    process.env.SHENPULSE_GTAV_PROFILE_TEST_PATH || ""
  ).trim();
  const profileRoots = testPath
    ? [testPath]
    : gtaEnhancedProfileRoots(documentsPath);
  const profiles = [];
  for (const root of [...new Set(profileRoots.map((item) => path.resolve(item)))]) {
    const entries = await fs.promises
      .readdir(root, { withFileTypes: true })
      .catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const directory = path.join(root, entry.name);
      const files = await fs.promises
        .readdir(directory, { withFileTypes: true })
        .catch(() => []);
      const saves = files.filter(
        (file) => file.isFile() && /^SGTA5\d{4}(?:\.bak)?$/i.test(file.name)
      ).length;
      const stat = await fs.promises.stat(directory).catch(() => null);
      profiles.push({
        directory,
        saves,
        modifiedAt: stat?.mtimeMs || 0
      });
    }
  }
  profiles.sort(
    (left, right) =>
      right.saves - left.saves || right.modifiedAt - left.modifiedAt
  );
  return profiles[0]?.directory || "";
}

function gtaEnhancedProfileRoots(documentsPath = "") {
  const candidates = [
    documentsPath,
    process.env.USERPROFILE
      ? path.join(process.env.USERPROFILE, "Documents")
      : "",
    process.env.OneDrive
      ? path.join(process.env.OneDrive, "Documents")
      : "",
    process.env.OneDriveConsumer
      ? path.join(process.env.OneDriveConsumer, "Documents")
      : "",
    process.env.OneDriveCommercial
      ? path.join(process.env.OneDriveCommercial, "Documents")
      : ""
  ].filter(Boolean);
  return candidates.map((root) =>
    path.join(root, "Rockstar Games", "GTAV Enhanced", "Profiles")
  );
}

async function existingFile(filePath) {
  const stat = await fs.promises.stat(filePath).catch(() => null);
  return stat?.isFile() ? filePath : "";
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

async function commitInstallationDeployment({
  deploymentRoot,
  targetPath,
  backupRoot,
  tempRoot
}) {
  const source = path.resolve(deploymentRoot);
  const target = path.resolve(targetPath);
  const backup = path.resolve(backupRoot);
  const sourceStat = await fs.promises.stat(source).catch(() => null);
  if (!sourceStat?.isDirectory()) {
    throw new Error("Les fichiers préparés pour l’installation sont absents.");
  }
  const files = await collectFiles(source);
  if (!files.length) {
    return { elevated: false, fileCount: 0 };
  }
  if (await canWriteToDirectory(target)) {
    await copyTreeWithBackup(source, target, target, backup);
    return { elevated: false, fileCount: files.length };
  }
  return commitInstallationDeploymentElevated({
    deploymentRoot: source,
    targetPath: target,
    backupRoot: backup,
    tempRoot,
    fileCount: files.length
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
  fileCount
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

async function copyTreeWithBackup(
  sourceRoot,
  destinationRoot,
  installRoot,
  backupRoot
) {
  const stat = await fs.promises.stat(sourceRoot).catch(() => null);
  if (!stat) throw new Error(`Fichier d’installation absent : ${sourceRoot}`);
  if (!stat.isDirectory()) {
    await copyWithBackup(
      sourceRoot,
      destinationRoot,
      installRoot,
      backupRoot
    );
    return;
  }
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
        backupRoot
      );
    } else if (entry.isFile()) {
      await copyWithBackup(
        source,
        destination,
        installRoot,
        backupRoot
      );
    }
  }
}

async function copyWithBackup(source, destination, installRoot, backupRoot) {
  safeChildPath(installRoot, path.relative(installRoot, destination));
  const existing = await fs.promises.stat(destination).catch(() => null);
  if (existing?.isFile()) {
    const relative = path.relative(installRoot, destination);
    const backup = safeChildPath(backupRoot, relative);
    await fs.promises.mkdir(path.dirname(backup), { recursive: true });
    await fs.promises.copyFile(destination, backup);
  } else if (existing?.isDirectory()) {
    throw new Error(`Impossible de remplacer le dossier ${destination}.`);
  }
  await fs.promises.mkdir(path.dirname(destination), { recursive: true });
  await fs.promises.copyFile(source, destination);
}

async function deployAdditionalInstallTargets({
  manifest,
  targetPath,
  backupRoot,
  documentsPath
}) {
  const targets = Array.isArray(manifest?.additionalInstallTargets)
    ? manifest.additionalInstallTargets
    : [];
  const deployed = [];
  for (const entry of targets) {
    if (entry?.root !== "documents") {
      throw new Error(
        "Destination d’installation supplémentaire non autorisée."
      );
    }
    const source = safeChildPath(targetPath, entry.sourcePath || "");
    const root = path.resolve(documentsPath);
    const destination = safeChildPath(root, entry.targetPath || "");
    const stat = await fs.promises.stat(source).catch(() => null);
    if (!stat?.isFile()) {
      throw new Error(
        `Le fichier préparé ${entry.sourcePath || ""} est introuvable.`
      );
    }
    await copyWithBackup(
      source,
      destination,
      root,
      path.join(backupRoot, "additional-targets", entry.root)
    );
    deployed.push({
      root: entry.root,
      path: destination
    });
  }
  return deployed;
}

async function findNamedFile(directory, name) {
  const entries = await fs.promises.readdir(directory, {
    withFileTypes: true
  });
  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === name.toLowerCase()) {
      return candidate;
    }
    if (entry.isDirectory()) {
      const found = await findNamedFile(candidate, name);
      if (found) return found;
    }
  }
  return "";
}

async function detectInstalledGame(gameId, manifest, previousPath = "") {
  const candidates = [previousPath].filter(Boolean);
  if (gameId === "gtav-montchiliad") {
    candidates.push(...(await gtaInstallCandidates()));
  }
  if (
    Array.isArray(manifest.steamAppIds) ||
    Array.isArray(manifest.directoryNames)
  ) {
    candidates.push(...(await steamGameInstallCandidates(manifest)));
  }
  for (const candidate of [
    ...new Set(candidates.map((item) => path.resolve(item)))
  ]) {
    const stat = await fs.promises.stat(candidate).catch(() => null);
    if (!stat?.isDirectory()) continue;
    const executable = await findLaunchTarget(
      candidate,
      manifest.executables || [],
      false
    );
    if (executable) return path.dirname(executable);
  }
  return "";
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
    "C:\\Steam"
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

async function gtaInstallCandidates() {
  const programFiles = [
    process.env.ProgramW6432,
    process.env.ProgramFiles,
    process.env["ProgramFiles(x86)"],
    "C:\\Program Files",
    "C:\\Program Files (x86)"
  ].filter(Boolean);
  const candidates = [];
  for (const root of programFiles) {
    candidates.push(
      path.join(root, "Rockstar Games", "Grand Theft Auto V"),
      path.join(root, "Rockstar Games", "Grand Theft Auto V Enhanced"),
      path.join(root, "Epic Games", "GTAV"),
      path.join(root, "Epic Games", "Grand Theft Auto V"),
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

async function findLaunchTarget(directory, names, recursive = true) {
  for (const name of names) {
    const candidate = path.join(directory, name);
    if ((await fs.promises.stat(candidate).catch(() => null))?.isFile()) {
      return candidate;
    }
  }
  if (!recursive) return "";
  const entries = await fs.promises
    .readdir(directory, { withFileTypes: true })
    .catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const found = await findLaunchTarget(path.join(directory, entry.name), names, false);
    if (found) return found;
  }
  return "";
}

module.exports = {
  GameRuntimeService,
  commitInstallationDeployment,
  configureMinecraftServerCommandFeedback,
  deployAdditionalInstallTargets,
  deployGtaEnhancedSave,
  detectGtaEdition,
  extractArchiveSafe,
  findGtaEnhancedProfile,
  safeChildPath,
  safeInstallerAssetUrl,
  sha256File,
  stageGtaEnhancedSave
};
