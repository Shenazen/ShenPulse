"use strict";

const { readState } = require("./state-projection");
const { createProFeatureGuard } = require("./pro-feature-access");

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const {
  BrowserWindow,
  dialog,
  nativeImage,
  screen,
  shell
} = require("electron");
const {
  installerForGame,
  isIntegratedGame
} = require("./game-installer-manifest");
const {
  sanitizeThiercelieuxEntitlements
} = require("../shared/thiercelieux-products");
const {
  PokemonRedBlueRuntime
} = require("./pokemon-red-blue-runtime");
const {
  SuperMarioKartRuntime
} = require("./super-mario-kart-runtime");
const {
  writeMinecraftEula, configureMinecraftServerCommandFeedback,
  silenceMinecraftCommandFeedback, enforceMinecraftCreativeMode,
  createMinecraftServerRecord, parseMinecraftWinCounterLine,
  minecraftServerResult, minecraftAutoClickerResult,
  sanitizeMinecraftConsoleCommand, writeMinecraftServerCommand,
  stopMinecraftServerRecord
} = require("./game-runtime/minecraft-server");
const {
  waitForProcessSpawn, stopChildProcess, stopOrphanedManagedProcesses,
  waitForWindowsProcessWindow
} = require("./game-runtime/processes");
const {
  safeChildPath, safeInstallerAssetUrl, sha256File, findNamedFile, findLaunchTarget
} = require("./game-runtime/paths");
const { extractArchiveSafe } = require("./game-runtime/archives");
const { detectGtaEdition, stageGtaEnhancedSave, deployGtaEnhancedSave, findGtaEnhancedProfile } = require("./game-runtime/gta-save");
const { commitInstallationDeployment, deployAdditionalInstallTargets } = require("./game-runtime/deployments");
const { detectInstalledGame, steamGameInstallCandidates } = require("./game-runtime/discovery");
const { installGame } = require("./game-runtime/installation");
const { launchExternalGame } = require("./game-runtime/external-launch");
const { pickTarget, showInvalidTarget, validateTarget } = require("./game-runtime/target-selection");
const { downloadAsset } = require("./game-runtime/asset-download");
const { installAsset } = require("./game-runtime/asset-deployment");

/** Façade des jeux : fenêtres, processus et délégation des installations par domaines. */
class GameRuntimeService {
  constructor({
    app,
    store,
    getWindow,
    notifyRenderer,
    assertAccess = () => {},
    onMinecraftWinCounter = () => {}
  }) {
    this.app = app;
    this.store = store;
    this.getWindow = getWindow;
    this.notifyRenderer = notifyRenderer;
    this.assertAccess = assertAccess;
    this.onMinecraftWinCounter = onMinecraftWinCounter;
    this.gameWindows = new Map();
    this.activeInstalls = new Set();
    this.launchJobs = new Map();
    this.installProgress = new Map();
    this.minecraftServers = new Map();
    this.minecraftAutoClickers = new Map();
    this.saveDeploymentJobs = new Map();
    this.pokemonRedBlue = new PokemonRedBlueRuntime({
      app,
      store,
      getWindow,
      dialog
    });
    this.superMarioKart = new SuperMarioKartRuntime({ app, store });
  }

  status(gameId) {
    this.assertAccess(gameId);
    const installation =
      readState(this.store, ["game.installations"]).game.installations?.[gameId] || null;
    return {
      gameId,
      integrated: isIntegratedGame(gameId),
      automated: Boolean(installerForGame(gameId)),
      installing: this.activeInstalls.has(gameId),
      installProgress: this.installProgress.get(gameId) || null,
      serverRunning: this.#minecraftServerRunning(gameId),
      autoClickerRunning: this.#minecraftAutoClickerRunning(gameId),
      installation
    };
  }

  setGameWindowFormat(gameId, format) {
    this.assertAccess(gameId);
    if (!isIntegratedGame(gameId)) {
      throw new Error("Ce format est réservé aux jeux intégrés.");
    }
    const gameWindow = this.gameWindows.get(gameId);
    if (!gameWindow || gameWindow.isDestroyed()) {
      return { ok: false, gameId, reason: "window-not-open" };
    }
    const orientation = format === "portrait" ? "portrait" : "landscape";
    const display = screen.getDisplayMatching(gameWindow.getBounds());
    const area = display.workArea;
    const preferred = orientation === "portrait"
      ? { width: 720, height: 1080, minWidth: 620, minHeight: 720 }
      : { width: 1360, height: 860, minWidth: 980, minHeight: 680 };
    const width = Math.min(preferred.width, area.width);
    const height = Math.min(preferred.height, area.height);
    gameWindow.setMinimumSize(
      Math.min(preferred.minWidth, area.width),
      Math.min(preferred.minHeight, area.height)
    );
    gameWindow.setBounds({
      x: area.x + Math.round((area.width - width) / 2),
      y: area.y + Math.round((area.height - height) / 2),
      width,
      height
    }, true);
    return { ok: true, gameId, format: orientation, width, height };
  }

  sendThiercelieuxCommand(command) {
    this.assertAccess("thiercelieux");
    const gameWindow = this.gameWindows.get("thiercelieux");
    if (!gameWindow || gameWindow.isDestroyed()) {
      throw new Error(
        "Ouvrez d’abord le plateau Thiercelieux depuis la page du jeu."
      );
    }
    gameWindow.webContents.send("thiercelieux-command", command);
    return { ok: true, gameId: "thiercelieux" };
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

  async executeMinecraftCommands(gameId, commands, { assertAccess = () => {} } = {}) {
    this.assertAccess(gameId);
    const assertRuntimeAccess = this.#accessGuard(gameId);
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
      this.assertAccess(gameId);
      assertRuntimeAccess();
      assertAccess();
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

  pokemonConnectionStatus(gameId) {
    this.assertAccess(gameId);
    if (gameId !== "pokemon-red-blue") {
      throw new Error("Ce jeu n’utilise pas la passerelle Pokémon.");
    }
    return this.pokemonRedBlue.connectionStatus();
  }

  async executePokemonEffect(gameId, effectId, effectName) {
    this.assertAccess(gameId);
    if (gameId !== "pokemon-red-blue") {
      throw new Error("Ce jeu n’utilise pas la passerelle Pokémon.");
    }
    return this.pokemonRedBlue.trigger(effectId, effectName);
  }

  superMarioKartConnectionStatus(gameId) {
    this.assertAccess(gameId);
    if (gameId !== "super-mario-kart") {
      throw new Error("Ce jeu n’utilise pas la passerelle Super Mario Kart.");
    }
    return this.superMarioKart.connectionStatus();
  }

  async executeSuperMarioKartEffect(gameId, effectId, effectName) {
    this.assertAccess(gameId);
    if (gameId !== "super-mario-kart") {
      throw new Error("Ce jeu n’utilise pas la passerelle Super Mario Kart.");
    }
    return this.superMarioKart.trigger(effectId, effectName);
  }

  async selectPokemonRom(gameId) {
    const assertAccess = this.#accessGuard(gameId);
    if (gameId !== "pokemon-red-blue") {
      throw new Error("Ce jeu ne prend pas en charge une ROM Game Boy.");
    }
    return this.pokemonRedBlue.selectRom({ assertAccess });
  }

  async install(gameId) {
    return installGame(this.#installationContext(), gameId);
  }

  async launch(gameId) {
    this.assertAccess(gameId);
    if (this.launchJobs.has(gameId)) return this.launchJobs.get(gameId);
    const job = this.#launchGame(gameId).finally(() => this.launchJobs.delete(gameId));
    this.launchJobs.set(gameId, job);
    return job;
  }

  async #launchGame(gameId) {
    this.assertAccess(gameId);
    const assertAccess = this.#accessGuard(gameId);
    if (gameId === "thiercelieux") {
      this.store.mutate((state) => {
        state.game.connectorOverrides.thiercelieux =
          sanitizeThiercelieuxEntitlements(
            state.game.connectorOverrides?.thiercelieux || {},
            state
          );
      }, true);
    }
    if (isIntegratedGame(gameId)) {
      return this.#launchIntegrated(gameId);
    }
    const manifest = installerForGame(gameId);
    const installation =
      readState(this.store, ["game.installations"]).game.installations?.[gameId];
    if (!manifest || !installation?.path) {
      throw new Error(
        "Installez d’abord ce jeu ou son pack depuis l’étape Installation."
      );
    }
    const installationPath = await fs.promises
      .stat(installation.path)
      .catch(() => null);
    assertAccess();
    if (!installationPath?.isDirectory()) {
      throw new Error(
        manifest.temporaryTarget
          ? "Le dossier temporaire du jeu n’existe plus. Réinstallez-le depuis l’étape Installation."
          : "Le dossier d’installation mémorisé n’existe plus. Réinstallez le pack depuis l’étape Installation."
      );
    }
    if (manifest.preflight) await validateTarget(this, installation.path, manifest);
    if (manifest.minecraftServer) {
      const server = await this.#startMinecraftServer(
        gameId,
        installation.path,
        manifest,
        { assertAccess }
      );
      return {
        ok: true,
        gameId,
        server,
        message: `${manifest.title} est prêt sur ${server.address}`
      };
    }
    if (gameId === "pokemon-red-blue") {
      await this.superMarioKart.stop();
      assertAccess();
      return this.pokemonRedBlue.launch({ assertAccess });
    }
    if (gameId === "super-mario-kart") {
      await this.pokemonRedBlue.stop();
      assertAccess();
      return this.superMarioKart.launch({ assertAccess });
    }
    return launchExternalGame({ gameId, manifest, installation, shell, assertAccess,
      waitForWindowsProcessWindow, scheduleGtaSaveDeployment: () => this.#scheduleGtaSaveDeployment(gameId, { assertAccess }) });
  }

  async stop(gameId) {
    if (gameId === "pokemon-red-blue") {
      return this.pokemonRedBlue.stop();
    }
    if (gameId === "super-mario-kart") {
      return this.superMarioKart.stop();
    }
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
    await this.pokemonRedBlue.dispose();
    await this.superMarioKart.dispose();
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

  async #startMinecraftServer(gameId, installationPath, manifest, { assertAccess = this.#accessGuard(gameId) } = {}) {
    assertAccess();
    if (this.#minecraftServerRunning(gameId)) {
      const existing = this.minecraftServers.get(gameId);
      await existing.ready;
      assertAccess();
      const autoClicker = await this.#startMinecraftAutoClicker(
        gameId,
        installationPath,
        manifest,
        { assertAccess }
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
    await configureMinecraftServerCommandFeedback(installationPath, {
      creativeMode: serverConfig.creativeMode !== false
    });
    assertAccess();
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
      port: Number(serverConfig.port || 25565),
      onWinCounter: (event) => {
        try { assertAccess(); } catch { return; }
        this.onMinecraftWinCounter({
          ...event,
          gameId
        });
      }
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
      assertAccess();
      await silenceMinecraftCommandFeedback(record);
      assertAccess();
      if (serverConfig.creativeMode !== false) {
        await enforceMinecraftCreativeMode(record);
      }
      assertAccess();
      const autoClicker = await this.#startMinecraftAutoClicker(
        gameId,
        installationPath,
        manifest,
        { assertAccess }
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
    manifest,
    { assertAccess = () => {} } = {}
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
    assertAccess();
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

  #scheduleGtaSaveDeployment(gameId, { assertAccess = this.#accessGuard(gameId) } = {}) {
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
        assertAccess();
        const result = await deployGtaEnhancedSave({
          sourceDirectory: stagingDirectory,
          backupRoot,
          documentsPath: this.app.getPath("documents")
        });
        assertAccess();
        if (result.deployed || result.alreadyPresent) {
          this.saveDeploymentJobs.delete(gameId);
          this.store.mutate((state) => {
            const installation = state.game.installations?.[gameId];
            if (installation) installation.saveDeployment = result;
          });
          return;
        }
      } catch (error) {
        if (["ACCOUNT_REQUIRED", "PRO_FEATURE_REQUIRED", "FEATURE_ACCESS_FORBIDDEN", "FEATURE_CONTEXT_CHANGED"].includes(error?.code)) {
          this.saveDeploymentJobs.delete(gameId);
          return;
        }
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
    return pickTarget(this.#installationContext(), gameId, manifest);
  }

  async #showInvalidTarget(targetPath, manifest, error) {
    return showInvalidTarget(this.#installationContext(), targetPath, manifest, error);
  }

  async #validateTarget(targetPath, manifest) {
    return validateTarget(this.#installationContext(), targetPath, manifest);
  }

  async #downloadAsset(gameId, asset, destinationPath, { index = 0, total = 1 } = {}) {
    return downloadAsset(this.#installationContext(), gameId, asset, destinationPath, { index, total });
  }

  async #installAsset({
    gameId,
    asset,
    downloadPath,
    targetPath,
    backupRoot,
    tempRoot
  }) {
    return installAsset(this.#installationContext(), {
      gameId,
      asset,
      downloadPath,
      targetPath,
      backupRoot,
      tempRoot
    });
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
    const supportsPortrait = gameId === "thiercelieux";
    const gameWindow = new BrowserWindow({
      width: 1280,
      height: 820,
      minWidth: supportsPortrait ? 620 : 980,
      minHeight: supportsPortrait ? 720 : 680,
      title: `ShenPulse · ${gameId}`,
      backgroundColor: "#070914",
      icon: icon.isEmpty() ? undefined : icon,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        // Une fenêtre de jeu réduite continue à recevoir et exécuter les
        // interactions transmises par ShenPulse.
        backgroundThrottling: false
      }
    });
    this.gameWindows.set(gameId, gameWindow);
    gameWindow.on("closed", () => this.gameWindows.delete(gameId));
    const originalGameHost = new Set([
      "coin-pusher",
      "connect-four",
      "deal-or-no-deal",
      "thiercelieux"
    ]).has(gameId);
    gameWindow.loadFile(
      originalGameHost
        ? path.join(
            __dirname,
            "..",
            "renderer",
            "games",
            "original",
            "index.html"
          )
        : path.join(__dirname, "..", "renderer", "games", "host.html"),
      { query: { gameId } }
    );
    return { ok: true, opened: true, gameId };
  }


  /** Dépendances explicites des installateurs ; aucun objet Electron global dans ces modules. */
  #accessGuard(gameId) {
    this.assertAccess(gameId);
    return createProFeatureGuard(this.store, "games", { assertAdditional: () => this.assertAccess(gameId) });
  }

  #installationContext() {
    return {
      resourcesDirectory: path.join(__dirname, "..", "..", "resources"),
      app: this.app, store: this.store, dialog, getWindow: () => this.getWindow(),
      assertAccess: (...args) => this.assertAccess(...args), activeInstalls: this.activeInstalls,
      createAccessGuard: (gameId) => this.#accessGuard(gameId),
      installProgress: this.installProgress,
      pokemonRedBlue: this.pokemonRedBlue, superMarioKart: this.superMarioKart,
      launch: (...args) => this.launch(...args),
      progress: (...args) => this.#progress(...args),
      pickTarget: (...args) => this.#pickTarget(...args),
      showInvalidTarget: (...args) => this.#showInvalidTarget(...args),
      validateTarget: (...args) => this.#validateTarget(...args),
      downloadAsset: (...args) => this.#downloadAsset(...args),
      installAsset: (...args) => this.#installAsset(...args),
      stopMinecraftServers: (...args) => this.#stopMinecraftServers(...args),
      startMinecraftServer: (...args) => this.#startMinecraftServer(...args)
    };
  }
  #progress(gameId, progress) {
    const occurredAt = new Date().toISOString();
    const previous = this.installProgress.get(gameId) || {};
    const next = {
      ...previous,
      gameId,
      startedAt: previous.startedAt || occurredAt,
      occurredAt,
      ...progress
    };
    this.installProgress.set(gameId, next);
    this.notifyRenderer("game-install-progress", next);
  }
}



module.exports = {
  GameRuntimeService,
  commitInstallationDeployment,
  configureMinecraftServerCommandFeedback,
  deployAdditionalInstallTargets,
  deployGtaEnhancedSave,
  detectInstalledGame,
  detectGtaEdition,
  extractArchiveSafe,
  findGtaEnhancedProfile,
  parseMinecraftWinCounterLine,
  safeChildPath,
  safeInstallerAssetUrl,
  sha256File,
  steamGameInstallCandidates,
  stopOrphanedManagedProcesses,
  stageGtaEnhancedSave,
  waitForWindowsProcessWindow
};
