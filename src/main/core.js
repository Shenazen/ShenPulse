"use strict";

const { EventEmitter } = require("node:events");
const path = require("node:path");
const { normalizeEvent } = require("./event-normalizer");
const { ActionRunner } = require("./action-runner");
const { ActionTimerScheduler } = require("./action-timer-scheduler");
const { GameHub } = require("./game-hub");
const {
  MinecraftRoundTimer,
  isMinecraftRoundGame,
  normalizeMinecraftRoundSettings
} = require("./game-round-timer");
const { ObsClient } = require("./obs-client");
const { OverlayServer } = require("./overlay-server");
const { PublicOverlayRelay } = require("./public-overlay-relay");
const {
  RuleEngine,
  giftEventCount,
  giftExecutionEvent
} = require("./rule-engine");
const { SourceHub } = require("./source-hub");
const {
  GiftCatalog,
  SOUND_CATALOG,
  createMediaCatalog
} = require("./catalogs");
const { SpotifyService } = require("./spotify-service");
const { IrlPythonBridge } = require("./irl-python-bridge");
const { ShellyService } = require("./shelly-service");
const { FollowSessionGuard } = require("./follow-session-guard");
const {
  OverlayCompletionController
} = require("./overlay-completion-controller");
const { renderValue } = require("./template");
const { preferredImageUrl, safeString, serializeError } = require("./utils");
const {
  giftValueFilterMatches,
  normalizeGiftValueFilter
} = require("../shared/gift-value-filter");
const {
  enrichGiftEvent,
  giftConditionMatches
} = require("../shared/gift-identity");
const {
  finishOverlaySession,
  recordOverlayEvent,
  resetOverlaySession
} = require("./overlay-session-state");

class ShenPulseCore extends EventEmitter {
  constructor({ store, resourcesDirectory, notifyRenderer, appVersion = "" }) {
    super();
    this.store = store;
    this.notifyRenderer = notifyRenderer;
    this.appVersion = String(appVersion || "");
    this.gameHub = new GameHub({
      store,
      packsDirectory: path.join(resourcesDirectory, "packs"),
      resourcesDirectory
    });
    this.sourceHub = new SourceHub({ store });
    this.obsClient = new ObsClient({ store });
    this.giftCatalog = new GiftCatalog(resourcesDirectory);
    this.soundCatalog = SOUND_CATALOG;
    this.mediaCatalog = createMediaCatalog(resourcesDirectory);
    this.spotifyService = new SpotifyService({ store, notifyRenderer });
    this.irlPythonBridge = new IrlPythonBridge({
      scriptPath: path.join(
        resourcesDirectory,
        "irl-python",
        "shenpulse_irl_server.py"
      )
    });
    this.shellyService = new ShellyService({
      store,
      pythonBridge: this.irlPythonBridge
    });
    this.publicOverlayRelay = new PublicOverlayRelay({
      store,
      appVersion
    });
    this.overlayServer = new OverlayServer({
      store,
      staticDirectory: path.join(resourcesDirectory, "overlays"),
      onInboundEvent: (raw, source) => this.ingest(raw, source),
      onEffectRequest: (request) =>
        this.gameHub.trigger(request.effectId, request, request),
      publicRelay: this.publicOverlayRelay
    });
    this.actionRunner = new ActionRunner({
      store,
      overlayServer: this.overlayServer,
      gameHub: this.gameHub,
      obsClient: this.obsClient,
      sourceHub: this.sourceHub,
      spotifyService: this.spotifyService,
      shellyService: this.shellyService,
      notifyRenderer,
      onOverlayOperation: (change) =>
        this.overlayCompletionController?.handleOperation(change)
    });
    this.overlayCompletionController = new OverlayCompletionController({
      store,
      actionRunner: this.actionRunner,
      overlayServer: this.overlayServer,
      onFired: ({ action, kind }) => {
        this.notifyRenderer("overlay-completion-fired", {
          ok: true,
          kind,
          actionId: action.id || "",
          actionType: action.type || ""
        });
        this.#activity(
          "success",
          "overlay",
          kind === "likeGoal"
            ? "Objectif du Like Goal atteint"
            : "Timer arrivé à zéro",
          `Action lancée : ${action.type}`
        );
        this.#changed(true);
      },
      onError: ({ error, kind }) => {
        this.notifyRenderer("overlay-completion-fired", {
          ok: false,
          kind,
          error: serializeError(error).message
        });
        this.#activity(
          "error",
          "overlay",
          kind === "likeGoal"
            ? "Action du Like Goal impossible"
            : "Action de fin du timer impossible",
          serializeError(error).message
        );
        this.#changed(true);
      }
    });
    this.minecraftRoundTimer = new MinecraftRoundTimer({
      store,
      actionRunner: this.actionRunner,
      gameHub: this.gameHub
    });
    this.ruleEngine = new RuleEngine({
      store,
      actionRunner: this.actionRunner,
      giftCatalog: this.giftCatalog
    });
    this.timerScheduler = new ActionTimerScheduler({
      store,
      actionRunner: this.actionRunner
    });
    this.commandCooldowns = new Map();
    this.gameCounterCursors = new Map();
    this.followSessionGuard = new FollowSessionGuard();
    this.deferredChangeTimer = null;
    this.publicOverlayRelay.on("status", (status) => {
      this.notifyRenderer("public-overlay-relay-status", status);
    });
    this.#wireEvents();
  }

  async initialize() {
    this.store.mutate((state) => {
      clearSessionState(state);
      const tiktokConnection = state.connections.find(
        (item) => item.id === "source_tiktok"
      );
      const username = String(
        tiktokConnection?.config?.username ||
          state.settings.tiktok?.username ||
          ""
      ).trim();
      state.settings.tiktok.status =
        username && tiktokConnection?.enabled
          ? "checking"
          : username
            ? "disconnected"
            : "unconfigured";
      state.settings.tiktok.roomId = "";
      if (tiktokConnection) {
        tiktokConnection.status = "disconnected";
        tiktokConnection.liveStatus = state.settings.tiktok.status;
        tiktokConnection.roomId = "";
        tiktokConnection.error = "";
      }
    }, true);
    this.gameHub.loadPacks();
    this.gameHub.repairMinecraftWinCounterInteractions();
    this.timerScheduler.start();
    if (this.store.getState().settings.startOverlayServer) {
      try {
        await this.overlayServer.start();
      } catch (error) {
        this.#activity("error", "server", "Serveur local indisponible", error.message);
      }
    }
    this.publicOverlayRelay.prepareConfiguration();
    if (this.store.getState().settings.account?.uid) {
      this.publicOverlayRelay.start().catch(() => {
        // Le serveur local et l'interface restent disponibles hors connexion.
      });
    }
    this.publicOverlayRelay.publishState(this.store.getState());
    await this.overlayCompletionController.initialize();
    const tiktokConnection = this.store
      .getState()
      .connections.find((item) => item.id === "source_tiktok");
    if (tiktokConnection?.enabled && tiktokConnection.config?.username) {
      this.sourceHub.start(tiktokConnection.id).catch((error) => {
        this.#activity(
          "warning",
          "tiktok",
          "Surveillance TikTok différée",
          error.message
        );
      });
    }
    this.refreshGiftCatalog().then(() => this.#changed(true));
    return this.snapshot();
  }

  async suspendAccountWorkspace() {
    this.overlayCompletionController.stop();
    this.timerScheduler.stop();
    await this.minecraftRoundTimer.dispose();
    await this.sourceHub.stopAll();
    await this.gameHub.disconnectAll();
    await this.obsClient.disconnect();
    await this.publicOverlayRelay.stop();
    await this.overlayServer.stop();
    await this.irlPythonBridge.stop();
    this.ruleEngine.resetProfileState();
    this.commandCooldowns.clear();
    this.gameCounterCursors.clear();
  }

  async resumeAccountWorkspace() {
    this.store.mutate((state) => {
      clearSessionState(state);
    }, true);
    this.publicOverlayRelay.prepareConfiguration();
    this.timerScheduler.start();
    if (this.store.getState().settings.startOverlayServer) {
      await this.overlayServer.start();
    }
    if (this.store.getState().settings.account?.uid) {
      this.publicOverlayRelay.start().catch(() => {
        // Le compte reste utilisable si le relais distant est indisponible.
      });
    }
    this.publicOverlayRelay.publishState(this.store.getState());
    await this.overlayCompletionController.initialize();
    const tiktokConnection = this.store
      .getState()
      .connections.find((item) => item.id === "source_tiktok");
    if (
      this.store.getState().settings.account?.uid &&
      tiktokConnection?.enabled &&
      tiktokConnection.config?.username
    ) {
      this.sourceHub.start(tiktokConnection.id).catch((error) => {
        this.#activity(
          "warning",
          "tiktok",
          "Surveillance TikTok différée",
          error.message
        );
      });
    }
    this.#changed(true);
    return this.snapshot();
  }

  snapshot() {
    const customSounds = this.store.getState().customSounds || [];
    const customMedia = this.store.getState().customMedia || [];
    const soundCatalog = [...this.soundCatalog, ...customSounds];
    const mediaCatalog = [...this.mediaCatalog, ...customMedia];
    return {
      appVersion: this.appVersion,
      state: this.store.getState(),
      packs: this.gameHub.listPacks(),
      soundCatalog,
      mediaCatalog,
      catalogCounts: {
        sounds: soundCatalog.length,
        media: mediaCatalog.length,
        gifts: this.giftCatalog.gifts.length
      },
      timerRuntime: this.timerScheduler.runtime(),
      overlayUrls: {
        ...this.publicOverlayRelay.urls(),
        api: this.overlayServer.urls().api,
        compatibilityApi: this.overlayServer.urls().compatibilityApi
      },
      localOverlayUrls: this.overlayServer.urls({
        includeRestricted: true
      }),
      publicOverlayRelay: this.publicOverlayRelay.status()
    };
  }

  async refreshGiftCatalog({ force = false } = {}) {
    const username =
      this.store.getState().settings.tiktok?.username || "tiktok";
    try {
      await this.giftCatalog.refreshLocalized(username, { force });
    } catch {
      // Le petit catalogue local français/anglais reste disponible hors ligne.
    }
    return this.giftCatalog.gifts;
  }

  async rotatePublicOverlayChannel() {
    const result = await this.publicOverlayRelay.rotateChannel();
    this.#activity(
      "success",
      "overlay",
      "URL publiques régénérées",
      "Les anciennes URL d'overlay ne reçoivent plus les événements."
    );
    this.#changed();
    return { ...result, snapshot: this.snapshot() };
  }

  async startSession() {
    const currentState = this.store.getState();
    const tiktok = currentState.settings.tiktok || {};
    if (tiktok.username && tiktok.status !== "live") {
      const results = await this.sourceHub.startEnabled();
      this.store.mutate((state) => {
        state.session.running = false;
        state.session.startedAt = null;
        state.session.startedBy = "";
        state.session.activeConnectionIds = [];
      });
      this.#activity(
        "info",
        "session",
        "Détection LIVE relancée",
        `@${tiktok.username} sera activé automatiquement dès son passage en LIVE.`
      );
      this.#changed();
      return {
        ...this.snapshot(),
        sourceResults: results,
        waitingForTikTokLive: true
      };
    }

    const startedAt = new Date().toISOString();
    this.overlayCompletionController.stop();
    this.store.mutate((state) => {
      state.session.running = true;
      state.session.startedAt = startedAt;
      state.session.startedBy = "manual";
      resetSessionStatistics(state);
      resetOverlaySession(state, startedAt);
    });
    const results = await this.sourceHub.startEnabled();
    this.overlayServer.publish(
      "session-state",
      this.store.getState().overlaySession
    );
    await this.overlayCompletionController.startConfiguredTimer(
      "session-start"
    );
    this.#activity("success", "session", "Session démarrée", "Les sources actives se connectent.");
    this.#changed();
    return { ...this.snapshot(), sourceResults: results };
  }

  async stopSession() {
    await this.sourceHub.stopAll();
    const endedAt = new Date().toISOString();
    this.store.mutate((state) => {
      state.session.running = false;
      state.session.startedAt = null;
      state.session.startedBy = "";
      state.session.activeConnectionIds = [];
      finishOverlaySession(state, endedAt);
    });
    this.overlayServer.publish(
      "session-state",
      this.store.getState().overlaySession
    );
    this.#activity("info", "session", "Session arrêtée", "");
    this.#changed();
    return this.snapshot();
  }

  async startGameSession(packId) {
    const targetId = safeString(packId, 160);
    const pack = this.gameHub
      .listPacks()
      .find((entry) => entry.id === targetId);
    if (!pack) throw new Error("Ce jeu n’existe plus dans ShenPulse.");
    this.gameHub.assertAccess(targetId);
    const currentGame = this.store.getState().session.game || {};
    if (
      currentGame.running === true &&
      currentGame.packId === targetId
    ) {
      return this.snapshot();
    }
    const currentPackId =
      this.store.getState().session.game?.packId || "";
    if (currentPackId && currentPackId !== targetId) {
      const currentPack = this.gameHub
        .listPacks()
        .find((entry) => entry.id === currentPackId);
      throw new Error(
        `${currentPack?.name || "Un autre jeu"} est déjà actif. Arrêtez-le avant d’ouvrir ${pack.name}.`
      );
    }
    await this.gameHub.prepareConnection(targetId);
    this.gameHub.initializeDefaultInteractions(targetId);
    this.store.mutate((state) => {
      state.session.activeGamePackId = targetId;
      state.session.game = {
        running: true,
        packId: targetId,
        profileId: state.session.profileId,
        startedAt: new Date().toISOString(),
        roundId: "",
        roundStartedAt: null,
        roundEndsAt: null,
        roundDurationSeconds: 0,
        roundAutoRestart: false,
        roundStatus: "stopped",
        roundTimeoutCount: 0,
        lastRoundTimeoutAt: null
      };
    }, true);
    if (isMinecraftRoundGame(targetId)) {
      await this.minecraftRoundTimer.start(targetId, "server-start");
    }
    this.ruleEngine.resetProfileState();
    this.#activity(
      "success",
      "game",
      `Session ${pack.name} active`,
      "Les interactions de ce jeu sont maintenant disponibles sur toutes les pages."
    );
    this.#changed();
    return this.snapshot();
  }

  async stopGameSession({ notify = true } = {}) {
    const state = this.store.getState();
    const activePack = this.gameHub
      .listPacks()
      .find((entry) => entry.id === state.session.game?.packId);
    await this.minecraftRoundTimer.stop();
    if (activePack) {
      await this.gameHub.stopRuntime(activePack.id);
    }
    await this.gameHub.disconnectAll();
    this.store.mutate((draft) => {
      draft.session.game = {
        running: false,
        packId: "",
        profileId: "",
        startedAt: null,
        roundId: "",
        roundStartedAt: null,
        roundEndsAt: null,
        roundDurationSeconds: 0,
        roundAutoRestart: false,
        roundStatus: "stopped",
        roundTimeoutCount: 0,
        lastRoundTimeoutAt: null
      };
    }, true);
    this.ruleEngine.resetProfileState();
    if (activePack) {
      this.#activity(
        "info",
        "game",
        `Session ${activePack.name} arrêtée`,
        "Ses interactions ne seront plus exécutées."
      );
    }
    if (notify) this.#changed();
    return this.snapshot();
  }

  async saveGameRoundSettings(packId, incoming = {}) {
    const targetId = safeString(packId, 160);
    const pack = this.gameHub.assertAccess(targetId);
    if (!isMinecraftRoundGame(targetId)) {
      throw new Error(
        "Les réglages de durée de partie sont réservés aux jeux Minecraft."
      );
    }
    const settings = normalizeMinecraftRoundSettings(incoming);
    this.store.mutate((state) => {
      state.game.roundSettingsByPack ||= {};
      state.game.roundSettingsByPack[targetId] = settings;
    });
    const restarted = await this.minecraftRoundTimer.restartIfActive(
      targetId,
      "settings-change"
    );
    this.#activity(
      "success",
      "game",
      `Réglages de partie ${pack.name}`,
      `${settings.durationMinutes} minute${
        settings.durationMinutes > 1 ? "s" : ""
      } · relance automatique ${settings.autoRestart ? "activée" : "désactivée"}${
        restarted ? " · chrono redémarré" : ""
      }`
    );
    this.#changed();
    return this.snapshot();
  }

  async ingest(raw, source = "manual") {
    const normalized = raw?.type && raw?.user && raw?.data
      ? raw
      : normalizeEvent(raw, source);
    const event = enrichGiftEvent(normalized, this.giftCatalog.gifts);
    if (!this.followSessionGuard.accept(this.store.getState(), event)) {
      return null;
    }
    const overlayChange = this.#recordEvent(event);
    const completionChange = resolveLikeGoalCompletionChange(
      event,
      overlayChange
    );
    this.overlayServer.publishEvent(event);
    this.notifyRenderer("live-event", event);
    await this.#handleCommand(event);
    await this.#handleWheelGiftTriggers(event);
    await this.ruleEngine.process(event);
    await this.overlayCompletionController.handleLikeGoalChange(
      completionChange.previousLikeGoalCurrent,
      completionChange.likeGoalCurrent,
      { ...event, event, now: new Date().toISOString() }
    );
    this.#changed(true);
    return event;
  }

  async testEvent(type = "gift") {
    return this.ingest(this.createTestEvent(type), "test");
  }

  createTestEvent(type = "gift", overrides = {}) {
    const account = this.store.getState().settings.tiktok?.username || "shenpulse";
    const viewer =
      safeString(overrides.username || overrides.uniqueId || "test_viewer", 120)
        .replace(/^@+/, "") || "test_viewer";
    const nickname = safeString(
      overrides.nickname || overrides.displayName || "Spectateur test",
      160
    );
    const count = Math.max(
      1,
      Number(
        overrides.count ??
          (type === "like" ? 25 : type === "gift" ? 5 : 1)
      )
    );
    const shared = {
      uniqueId: viewer,
      nickname,
      channelUsername: account,
      profilePictureUrl: safeString(
        overrides.avatarUrl || overrides.profilePictureUrl || "",
        1000
      )
    };
    const samples = {
      gift: {
        event: "gift",
        data: {
          ...shared,
           giftId: safeString(overrides.giftId || "rose", 120),
           giftName: safeString(overrides.giftName || "Rose", 160),
           giftImageUrl: preferredImageUrl(
             overrides.giftImageUrl,
             overrides.giftPictureUrl,
             overrides.giftImage
           ),
           repeatCount: Math.max(1, Number(overrides.repeatCount ?? count)),
           value: Math.max(1, Number(overrides.value || 1))
        }
      },
      follow: { event: "follow", data: shared },
      like: {
        event: "like",
        data: {
          ...shared,
          likeCount: Math.max(1, Number(overrides.likeCount ?? count))
        }
      },
      chat: {
        event: "chat",
        data: {
          ...shared,
          comment: safeString(
            overrides.message || overrides.comment || "!help",
            1000
          )
        }
      },
      share: { event: "share", data: shared },
      subscribe: { event: "subscribe", data: shared },
      join: { event: "join", data: shared },
      raid: {
        event: "raid",
        data: {
          ...shared,
          count,
          viewers: Number(overrides.viewers || count)
        }
      }
    };
    return samples[type] || samples.gift;
  }

  async simulateEvent(incoming = {}) {
    const type = safeString(incoming.type || "gift", 40).toLowerCase();
    return this.ingest(this.createTestEvent(type, incoming), "simulator");
  }

  async testRule(ruleId, overrides = {}) {
    const rule = this.store
      .getState()
      .rules.find((item) => item.id === safeString(ruleId, 160));
    if (!rule) throw new Error("Règle introuvable.");
    const type = rule.trigger?.type === "*" ? "gift" : rule.trigger?.type;
    const event = normalizeEvent(this.createTestEvent(type, overrides), "rule-test");
    await this.ruleEngine.test(rule.id, event);
    this.#changed();
    return event;
  }

  async previewAction(action, overrides = {}) {
    const event = normalizeEvent(
      this.createTestEvent(overrides.type || "gift", overrides),
      "manual-preview"
    );
    const context = { ...event, event, now: new Date().toISOString() };
    const result = await this.actionRunner.run(
      {
        ...action,
        config: renderValue(action.config || {}, context)
      },
      context
    );
    this.#changed();
    return result;
  }

  async testTimer(timerId) {
    const result = await this.timerScheduler.run(timerId);
    this.#changed();
    return result;
  }

  async restartServers() {
    if (this.store.getState().settings.startOverlayServer) {
      await this.overlayServer.start();
      this.#activity("success", "server", "Serveurs locaux redémarrés", "");
    } else {
      await this.overlayServer.stop();
      this.#activity("success", "server", "Serveurs locaux arrêtés", "");
    }
    this.#changed();
    return this.overlayServer.urls();
  }

  async synchronizeOverlayCompletionSettings(
    previousSettings,
    nextSettings
  ) {
    return this.overlayCompletionController.settingsChanged(
      previousSettings,
      nextSettings
    );
  }

  async handleMinecraftWinCounter({
    gameId,
    current,
    outcome = "win",
    source = "native"
  } = {}) {
    const packId = String(gameId || "");
    if (!isMinecraftRoundGame(packId) || !Number.isFinite(Number(current))) {
      return { synchronized: false };
    }
    const session = this.store.getState().session?.game || {};
    if (session.running !== true || session.packId !== packId) {
      return { synchronized: false };
    }
    const previous = Number(
      this.store.getState().overlaySession?.winCounterCurrent || 0
    );
    const next = Math.max(
      -1_000_000,
      Math.min(1_000_000, Math.round(Number(current)))
    );
    if (previous === next) {
      const resolution =
        await this.minecraftRoundTimer.resolveNativeOutcome(packId, {
          outcome,
          currentWins: next,
          source
        });
      return {
        synchronized: false,
        unchanged: true,
        current: next,
        resolution
      };
    }
    const result = await this.actionRunner.run(
      {
        id: `minecraft_native_${source}_${Date.now()}`,
        type: "overlay.win-counter",
        config: {
          effectId: `minecraft_native_${source}`,
          operation: "set",
          amount: next
        }
      },
      {
        source: "minecraft-native",
        user: {
          id: "minecraft",
          name: "minecraft",
          displayName: "Minecraft"
        }
      }
    );
    const synchronizedCurrent = Number(result?.current ?? next);
    const resolution = await this.minecraftRoundTimer.resolveNativeOutcome(
      packId,
      {
        outcome,
        currentWins: synchronizedCurrent,
        source
      }
    );
    const pack = this.gameHub
      .listPacks()
      .find((entry) => entry.id === packId);
    this.#activity(
      outcome === "loss" ? "warning" : "success",
      "game",
      outcome === "loss"
        ? `Défaite ${pack?.name || "Minecraft"}`
        : `Victoire ${pack?.name || "Minecraft"}`,
      `${synchronizedCurrent > previous ? "+" : ""}${
        synchronizedCurrent - previous
      } WIN${Math.abs(synchronizedCurrent - previous) === 1 ? "" : "S"} · total ${synchronizedCurrent}`
    );
    this.notifyRenderer("minecraft-win-counter", {
      packId,
      previous,
      current: synchronizedCurrent,
      outcome,
      source,
      resolution
    });
    this.#changed(true);
    return {
      synchronized: true,
      previous,
      current: synchronizedCurrent,
      outcome,
      resolution
    };
  }

  async shutdown() {
    if (this.deferredChangeTimer) clearTimeout(this.deferredChangeTimer);
    this.deferredChangeTimer = null;
    this.overlayCompletionController.stop();
    this.timerScheduler.stop();
    await this.minecraftRoundTimer.dispose();
    await this.sourceHub.stopAll();
    await this.gameHub.disconnectAll();
    await this.obsClient.disconnect();
    await this.publicOverlayRelay.stop();
    await this.overlayServer.stop();
    this.store.mutate((state) => {
      clearSessionState(state);
    }, true);
    this.store.flush();
  }

  #wireEvents() {
    this.minecraftRoundTimer.on("started", ({ packId, durationSeconds }) => {
      const pack = this.gameHub
        .listPacks()
        .find((entry) => entry.id === packId);
      this.#activity(
        "success",
        "game",
        `Chrono ${pack?.name || "Minecraft"} démarré`,
        `${Math.round(durationSeconds / 60)} minute${
          durationSeconds > 60 ? "s" : ""
        } avant TIME OUT.`
      );
      this.#changed();
    });
    this.minecraftRoundTimer.on(
      "timeout",
      ({ packId, appliedAmount, currentWins, autoRestart }) => {
        const pack = this.gameHub
          .listPacks()
          .find((entry) => entry.id === packId);
        this.#activity(
          "warning",
          "game",
          `TIME OUT ${pack?.name || "Minecraft"}`,
          `${appliedAmount} WIN${
            Math.abs(appliedAmount) === 1 ? "" : "S"
          } · total ${currentWins}${
            autoRestart ? " · nouveau chrono démarré" : ""
          }`
        );
        this.notifyRenderer("game-round-timeout", {
          packId,
          appliedAmount,
          currentWins,
          autoRestart
        });
        this.#changed();
      }
    );
    this.minecraftRoundTimer.on("error", ({ error }) => {
      this.#activity(
        "error",
        "game",
        "Erreur du chrono Minecraft",
        serializeError(error).message
      );
      this.#changed();
    });
    this.timerScheduler.on("fired", (entry) => {
      this.#activity(
        "success",
        "timer",
        `Timer exécuté : ${entry.timerName}`,
        `${entry.actionCount} action(s) × ${entry.repeatCount}`
      );
      this.#changed(true);
    });
    this.timerScheduler.on("runtime-changed", () => this.#changed());
    this.timerScheduler.on("error", ({ timer, error }) => {
      this.#activity(
        "error",
        "timer",
        timer?.name
          ? `Échec du timer : ${timer.name}`
          : "Échec du planificateur",
        error.message
      );
      this.#changed();
    });
    this.sourceHub.on("event", (event) => {
      this.ingest(event, event.source).catch((error) =>
        this.#activity("error", "source", "Événement rejeté", error.message)
      );
    });
    this.sourceHub.on("status", ({ connectionId, status, error }) => {
      this.#activity(
        status === "error" ? "error" : "info",
        "connection",
        `${connectionId} : ${status}`,
        error
      );
      this.#changed();
    });
    this.sourceHub.on("diagnostic", (entry) =>
      this.#activity(entry.level, "connection", entry.source, entry.message)
    );
    this.sourceHub.on("tiktok-status", ({ status, username, roomId }) => {
      let sessionTransition = "";
      const session = this.store.getState().session;
      const shouldStart = status === "live" && !session.running;
      const shouldStop =
        ["disconnected", "error", "offline"].includes(status) &&
        session.running;
      if (shouldStart || shouldStop) {
        this.store.mutate((state) => {
          sessionTransition = synchronizeSessionWithTikTok(state, status);
        });
      }
      const labels = {
        live: "Compte TikTok en LIVE",
        offline: "Compte TikTok hors ligne",
        checking: "Vérification du LIVE TikTok",
        disconnected: "Détection TikTok arrêtée",
        error: "Connexion TikTok en erreur"
      };
      this.#activity(
        status === "error" ? "error" : status === "live" ? "success" : "info",
        "tiktok",
        labels[status] || "État TikTok mis à jour",
        `@${username || "inconnu"}${roomId ? ` · salle ${roomId}` : ""}`
      );
      if (sessionTransition === "started") {
        this.overlayCompletionController.stop();
        this.overlayServer.publish(
          "session-state",
          this.store.getState().overlaySession
        );
        this.#activity(
          "success",
          "session",
          "Session démarrée automatiquement",
          `LIVE TikTok détecté pour @${username || "inconnu"}`
        );
        this.overlayCompletionController
          .startConfiguredTimer("tiktok-session-start")
          .catch((error) =>
            this.#activity(
              "error",
              "overlay",
              "Démarrage automatique du timer impossible",
              serializeError(error).message
            )
          );
      } else if (sessionTransition === "stopped") {
        this.overlayServer.publish(
          "session-state",
          this.store.getState().overlaySession
        );
        this.#activity(
          "info",
          "session",
          "Session TikTok terminée",
          `@${username || "inconnu"} n’est plus en LIVE`
        );
      }
      this.#changed();
    });
    this.ruleEngine.on("rule-fired", ({ rule, event }) => {
      this.#activity(
        "success",
        "rule",
        rule.name,
        `${event.type} de ${event.user?.displayName || "viewer"}`
      );
    });
    this.ruleEngine.on("action-result", ({ ok, action, error }) => {
      this.store.mutateRuntime((state) => {
        if (ok) {
          if (state.session.running) {
            state.statistics.sessionActions += 1;
          }
          state.statistics.lifetimeActions += 1;
        }
      });
      if (!ok) {
        this.#activity("error", "action", action.type, serializeError(error).message);
      }
      this.#changed(true);
    });
    this.gameHub.on("effect-start", ({ pack, effect, payload: effectPayload, context }) => {
      const payload = {
        packId: pack.id,
        effectName: effect.name,
        effectId: effect.id,
        quantity: Math.max(1, Number(effectPayload?.effect?.quantity || 1)),
        duration: Math.max(0, Number(effectPayload?.effect?.duration || 0)),
        parameters: { ...(effectPayload?.effect?.parameters || {}) },
        viewer: context.user?.displayName || "Viewer",
        status: "running"
      };
      this.overlayServer.publish("game", payload);
      this.notifyRenderer("game-effect", payload);
    });
    this.gameHub.on("effect-result", ({ pack }) => {
      if (!isMinecraftRoundGame(pack?.id)) return;
      this.minecraftRoundTimer
        .cancelNativeRoundIfStopped(pack.id)
        .catch(() => {});
    });
    this.gameHub.on("bridge-message", ({ pack, message }) => {
      this.#handleGameBridgeMessage(pack, message).catch((error) => {
        this.#activity(
          "error",
          "game",
          "Compteur WINS non synchronisé",
          serializeError(error).message
        );
      });
    });
  }

  async #handleGameBridgeMessage(pack, message) {
    const counterEvent = readMontChiliadCounterEvent(
      pack,
      message,
      this.gameCounterCursors
    );
    if (!counterEvent) return;
    const previous = Number(
      this.store.getState().overlaySession?.winCounterCurrent
    );
    const result = await this.actionRunner.run(
      {
        id: `native_counter_${counterEvent.sessionId}_${counterEvent.eventId}`,
        type: "overlay.win-counter",
        config: {
          packId: pack.id,
          effectId: `native_${counterEvent.eventName}`,
          operation: "adjust",
          amount: counterEvent.amount
        }
      },
      {
        source: "gtav-native",
        user: {
          id: "gtav",
          name: "gtav",
          displayName: "GTA V Mont Chiliad"
        }
      }
    );
    const current = Number(result?.current);
    const applied =
      Number.isFinite(previous) && Number.isFinite(current)
        ? current - previous
        : counterEvent.amount;
    this.#activity(
      "success",
      "game",
      counterEvent.eventName === "win"
        ? "Victoire Mont Chiliad"
        : "Mort dans GTA V",
      `${applied > 0 ? "+" : ""}${applied} WIN${
        Math.abs(applied) === 1 ? "" : "S"
      }${Number.isFinite(current) ? ` · total ${current}` : ""}`
    );
    this.#changed(true);
  }

  #recordEvent(event) {
    let previousLikeGoalCurrent = 0;
    let likeGoalCurrent = 0;
    this.store.mutateRuntime((state) => {
      previousLikeGoalCurrent = Number(
        state.overlaySession?.likeGoalCurrent || 0
      );
      recordEventStatistics(state, event);
      const runtime = recordOverlayEvent(state, event);
      likeGoalCurrent = Number(runtime?.likeGoalCurrent || 0);
    });
    this.#activity(
      "event",
      event.type,
      event.user?.displayName || "Viewer",
      event.type === "chat"
        ? event.data.message
        : event.type === "gift"
          ? `${event.data.giftName} ×${event.data.count}`
          : event.type === "like"
            ? `Likes ×${event.data.count}`
            : event.type
    );
    return { previousLikeGoalCurrent, likeGoalCurrent };
  }

  async #handleCommand(event) {
    if (event.type !== "chat" || !event.data.message.startsWith("!")) return;
    const command = this.store
      .getState()
      .commands.find(
        (item) =>
          item.enabled &&
          event.data.message
            .trim()
            .toLowerCase()
            .startsWith(String(item.command).toLowerCase())
      );
    if (!command) return;
    if (command.subscriberOnly && !event.user.subscriber) return;
    const cooldownKey = `${command.id}:${event.user.id}`;
    if (Date.now() < (this.commandCooldowns.get(cooldownKey) || 0)) return;
    this.commandCooldowns.set(
      cooldownKey,
      Date.now() + Number(command.cooldownMs || 0)
    );
    try {
      this.sourceHub.send(event.source, { message: command.response });
    } catch {
      this.overlayServer.publish("chatbot", {
        command: command.command,
        response: command.response,
        user: event.user
      });
    }
  }

  async #handleWheelGiftTriggers(event) {
    if (event.type !== "gift") return;
    const wheelConfig =
      this.store.getState().settings.overlayConfigs?.wheel || {};
    const wheels = Array.isArray(wheelConfig.wheels)
      ? wheelConfig.wheels
      : [];
    const matchingWheels = wheels.filter((wheel) => {
      return wheelGiftTriggerMatches(
        wheel,
        event,
        this.giftCatalog.gifts
      );
    });
    const deliveryCount = giftEventCount(event);
    for (let index = 0; index < deliveryCount; index += 1) {
      const deliveryEvent = giftExecutionEvent(
        event,
        index,
        deliveryCount,
        1
      );
      await Promise.all(
        matchingWheels.map((wheel) =>
          this.actionRunner.run(
            {
              id: `wheel_trigger_${wheel.id}`,
              type: "wheel.spin",
              config: { wheelId: wheel.id }
            },
            deliveryEvent
          )
        )
      );
    }
  }

  #activity(level, category, title, detail) {
    const entry = {
      level,
      category,
      title: safeString(title, 200),
      detail: safeString(detail, 1000)
    };
    if (!shouldRecordActivity(this.store.getState(), entry)) return;
    this.store.addActivity(entry);
  }

  #changed(deferred = false) {
    this.publicOverlayRelay.publishState(this.store.getState());
    if (!deferred) {
      if (this.deferredChangeTimer) clearTimeout(this.deferredChangeTimer);
      this.deferredChangeTimer = null;
      this.notifyRenderer("state-changed", this.snapshot());
      return;
    }
    if (this.deferredChangeTimer) return;
    this.deferredChangeTimer = setTimeout(() => {
      this.deferredChangeTimer = null;
      this.notifyRenderer("state-changed", this.snapshot());
    }, 50);
    this.deferredChangeTimer.unref?.();
  }
}

function wheelGiftTriggerMatches(wheel, event, gifts = []) {
  if (wheel?.enabled === false || event?.type !== "gift") return false;
  const trigger = String(wheel?.trigger || "")
    .trim()
    .toLocaleLowerCase("fr");
  const filter = normalizeGiftValueFilter(wheel?.giftValueFilter);
  if (!trigger && !filter) return false;
  if (filter) return giftValueFilterMatches(filter, event.data?.value);
  return giftConditionMatches(
    {
      field: "data.giftName",
      operator: "equals",
      value: wheel.trigger,
      giftId: wheel.triggerGift?.giftId,
      giftCost: wheel.triggerGift?.giftCost,
      giftImageUrl: wheel.triggerGift?.giftImageUrl
    },
    event,
    gifts
  );
}

function synchronizeSessionWithTikTok(state, status, now = new Date().toISOString()) {
  if (status === "live" && !state.session.running) {
    state.session.running = true;
    state.session.startedAt = now;
    state.session.startedBy = "tiktok";
    state.session.activeConnectionIds = Array.from(
      new Set([...(state.session.activeConnectionIds || []), "source_tiktok"])
    );
    resetSessionStatistics(state);
    resetOverlaySession(state, now);
    return "started";
  }
  if (
    ["disconnected", "error", "offline"].includes(status) &&
    state.session.running
  ) {
    clearSessionState(state);
    finishOverlaySession(state, now);
    return "stopped";
  }
  return "";
}

function resetSessionStatistics(state) {
  state.statistics.sessionEvents = 0;
  state.statistics.sessionActions = 0;
  state.statistics.sessionLikes = 0;
  state.statistics.sessionUniqueViewers = [];
}

function recordEventStatistics(state, event) {
  const statistics = state.statistics;
  const count = Number(event.data?.count || 1);
  statistics.lifetimeEvents += 1;
  if (event.type === "gift") statistics.gifts += count;
  if (event.type === "like") statistics.likes += count;
  if (event.type === "follow") statistics.follows += 1;
  if (event.type === "subscribe") statistics.subscribers += 1;

  const viewerId = event.user?.id;
  if (viewerId && !statistics.uniqueViewers.includes(viewerId)) {
    statistics.uniqueViewers.push(viewerId);
    statistics.uniqueViewers = statistics.uniqueViewers.slice(-5000);
  }

  if (!state.session.running) return;
  statistics.sessionEvents += 1;
  if (event.type === "like") statistics.sessionLikes += count;
  if (
    viewerId &&
    !statistics.sessionUniqueViewers.includes(viewerId)
  ) {
    statistics.sessionUniqueViewers.push(viewerId);
    statistics.sessionUniqueViewers =
      statistics.sessionUniqueViewers.slice(-5000);
  }
}

function readMontChiliadCounterEvent(pack, message, cursors = new Map()) {
  if (
    pack?.id !== "gtav-montchiliad" ||
    message?.type !== "montchiliad:victory"
  ) {
    return null;
  }
  const sessionId = safeString(message.sessionId, 160);
  const eventId = Math.max(0, Math.trunc(Number(message.counterEventId || 0)));
  const amount = Math.trunc(Number(message.counterDelta || 0));
  const eventName = safeString(message.counterEvent, 40);
  if (!sessionId || !Number.isFinite(eventId)) return null;

  const previous = cursors.get(pack.id);
  if (!previous || previous.sessionId !== sessionId) {
    cursors.set(pack.id, { sessionId, eventId });
    return null;
  }
  if (
    eventId <= Number(previous.eventId || 0)
  ) {
    return null;
  }
  cursors.set(pack.id, { sessionId, eventId });
  if (
    eventId <= 0 ||
    amount === 0 ||
    !["win", "death"].includes(eventName)
  ) {
    return null;
  }
  return {
    sessionId,
    eventId,
    amount: Math.max(-1000, Math.min(1000, amount)),
    eventName
  };
}

function clearSessionState(state) {
  state.session.running = false;
  state.session.startedAt = null;
  state.session.startedBy = "";
  state.session.activeConnectionIds = [];
}

function resolveLikeGoalCompletionChange(event, change = {}) {
  const previousLikeGoalCurrent = Math.max(
    0,
    Number(change.previousLikeGoalCurrent || 0)
  );
  let likeGoalCurrent = Math.max(
    0,
    Number(change.likeGoalCurrent || 0)
  );
  if (
    event?.type === "like" &&
    event?.source === "simulator" &&
    likeGoalCurrent === previousLikeGoalCurrent
  ) {
    likeGoalCurrent += Math.max(1, Number(event.data?.count || 1));
  }
  return { previousLikeGoalCurrent, likeGoalCurrent };
}

function shouldRecordActivity(state, entry, nowMs = Date.now()) {
  const category = String(entry?.category || "").trim().toLowerCase();
  if (!["connection", "tiktok"].includes(category)) return true;
  if (
    state?.session?.running === true ||
    state?.session?.game?.running === true
  ) {
    return true;
  }
  if (String(entry?.level || "").trim().toLowerCase() !== "error") {
    return false;
  }
  const title = String(entry?.title || "");
  const detail = String(entry?.detail || "");
  return !(state?.activity || []).some((previous) => {
    if (
      String(previous?.category || "").trim().toLowerCase() !== category ||
      String(previous?.level || "").trim().toLowerCase() !== "error" ||
      String(previous?.title || "") !== title ||
      String(previous?.detail || "") !== detail
    ) {
      return false;
    }
    const timestampMs = Date.parse(String(previous?.timestamp || ""));
    return (
      Number.isFinite(timestampMs) &&
      nowMs - timestampMs >= 0 &&
      nowMs - timestampMs < 15 * 60 * 1000
    );
  });
}

module.exports = {
  ShenPulseCore,
  clearSessionState,
  readMontChiliadCounterEvent,
  recordEventStatistics,
  resolveLikeGoalCompletionChange,
  resetSessionStatistics,
  shouldRecordActivity,
  synchronizeSessionWithTikTok,
  wheelGiftTriggerMatches
};
