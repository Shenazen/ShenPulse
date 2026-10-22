"use strict";

const { EventEmitter } = require("node:events");
const { synchronizeSessionWithTikTok, liveKickConnection, synchronizeSessionWithKick, clearSessionState } = require("./core/session-state");
const { resetSessionStatistics, recordEventStatistics, finishLiveStatistics, recordLiveAudience } = require("./core/event-statistics");
const { wheelGiftTriggerMatches, defaultTestEventCount, resolveLikeGoalCompletionChange, shouldRecordActivity } = require("./core/trigger-policy");
const { readMontChiliadCounterEvent } = require("./core/game-counter-events");
const { readState } = require("./state-projection");
const { isRealLiveEvent } = require("../shared/live-statistics");
const { bindCoreEvents } = require("./core/event-bindings");
const { GameSessionService } = require("./core/game-sessions");
const { createTestEvent } = require("./core/test-events");
const { LiveEventActionService } = require("./core/live-event-actions");
const { createCoreMatches } = require("./matches/core-integration");
const { ingestCreatorEvent } = require("./core/ingestion");
const { reconcileGiftReferencesSafely } = require("./core/gift-recovery");
const { giftCatalogScope, sameGiftCatalogScope, synchronizeGiftCatalogScope } = require("./core/gift-scope");
const { normalizeEvent } = require("./event-normalizer");
const { ViewerService } = require("./viewer-service");
const { createCoreRuntimeSnapshot } = require("./core/runtime-snapshot");
const path = require("node:path");
const { shell } = require("electron");
const { KickService } = require("./kick-service");
const { ControllerService } = require("./controller-service");
const { hasAuthenticatedAccount } = require("./account-access");
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
const { createMatchAccessKey } = require("./match-access");
const { PublicOverlayRelay } = require("./public-overlay-relay");
const { LiveDirectoryService } = require("./live-directory-service");
const {
  RuleEngine,
  giftEventCount,
  giftExecutionEvent
} = require("./rule-engine");
const { SourceHub } = require("./source-hub");
const { commandActivityMetadata } = require("./core/command-activity");
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
const { safeString, serializeError } = require("./utils");
const {
  finishOverlaySession,
  recordOverlayEvent,
  resetOverlaySession
} = require("./overlay-session-state");

class ShenPulseCore extends EventEmitter {
  constructor({ store, resourcesDirectory, notifyRenderer, appVersion = "", liveDirectoryIdentityProvider }) {
    super();
    this.store = store;
    this.notifyRenderer = notifyRenderer;
    this.appVersion = String(appVersion || "");
    this.giftCatalog = new GiftCatalog(resourcesDirectory);
    this.viewerService = new ViewerService({ store });
    this.ingestionHooks = { recordEvent: (event) => this.#recordEvent(event),
      handleCommand: (event) => this.#handleCommand(event), handleWheelGiftTriggers: (event) => this.#handleWheelGiftTriggers(event),
      changed: (deferred) => this.#changed(deferred), activity: (...args) => this.#activity(...args),
      catalogChanged: () => reconcileGiftReferencesSafely(this, { immediate: false }) };
    this.gameHub = new GameHub({
      store,
      appVersion: this.appVersion,
      packsDirectory: path.join(resourcesDirectory, "packs"),
      resourcesDirectory,
      giftCatalog: this.giftCatalog
    });
    this.kickService = new KickService({ store, openExternal: (url) => shell.openExternal(url) });
    this.sourceHub = new SourceHub({ store, kickService: this.kickService });
    this.obsClient = new ObsClient({ store });
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
    this.liveDirectory = typeof liveDirectoryIdentityProvider === "function"
      ? new LiveDirectoryService({ store, identityProvider: liveDirectoryIdentityProvider,
        canPublish: () => hasAuthenticatedAccount(store) })
      : null;
    this.liveDirectory?.on("changed", (status) => this.notifyRenderer("live-directory-status", status));
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
    this.controllerService = new ControllerService({
      store,
      pluginDirectory: path.join(resourcesDirectory, "controllers", "com.shenpulse.control.sdPlugin"),
      executeAction: async (actionId) => {
        const row = readState(store, ["rules"]).rules.flatMap((rule) => (rule.actions || []).map((action) => ({ rule, action })))
          .find(({ action }) => action.id === actionId);
        if (!row || !row.rule.enabled || row.action.enabled === false) throw new Error("Cette action est désactivée ou introuvable.");
        return this.previewAction(row.action, { username: "ShenPulse", nickname: "Contrôleur" });
      },
      selectProfile: async (profileId) => {
        this.liveEventActions?.chatbot.reset();
        await this.stopGameSession({ notify: false });
        store.selectProfile(profileId);
        this.ruleEngine.resetProfileState();
        this.liveEventActions?.chatbot.syncTimers();
        this.notifyRenderer("state-changed", this.snapshot());
      }
    });
    this.cachedCatalogSource = null;
    this.cachedCatalogPacks = null;
    this.gameCounterCursors = new Map();
    this.liveEventActions = new LiveEventActionService({
      store: this.store,
      sourceHub: this.sourceHub,
      overlayServer: this.overlayServer,
      actionRunner: this.actionRunner,
      giftCatalog: this.giftCatalog,
      commandCooldowns: this.commandCooldowns,
      gameCounterCursors: this.gameCounterCursors,
      onActivity: (...args) => this.#activity(...args),
      onChanged: (deferred) => this.#changed(deferred)
    });
    this.followSessionGuard = new FollowSessionGuard();
    this.matches = createCoreMatches(this, (...args) => this.#activity(...args), (deferred) => this.#changed(deferred));
    this.gameSessions = new GameSessionService({
      store: this.store,
      gameHub: this.gameHub,
      minecraftRoundTimer: this.minecraftRoundTimer,
      ruleEngine: this.ruleEngine,
      actionRunner: this.actionRunner,
      notifyRenderer: this.notifyRenderer,
      onActivity: (...args) => this.#activity(...args),
      onChanged: (deferred) => this.#changed(deferred),
      getSnapshot: () => this.snapshot()
    });
    this.deferredChangeTimer = null;
    this.publicOverlayRelay.on("status", (status) => {
      this.notifyRenderer("public-overlay-relay-status", status);
    });
    this.#wireEvents();
  }

  async initialize() {
    reconcileGiftReferencesSafely(this);
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
      state.settings.tiktok.broadcaster = null;
      state.settings.tiktok.currentViewers = null;
      if (tiktokConnection) {
        tiktokConnection.status = "disconnected";
        tiktokConnection.liveStatus = state.settings.tiktok.status;
        tiktokConnection.roomId = "";
        tiktokConnection.error = "";
      }
    }, true);
    this.liveDirectory?.start();
    this.gameHub.loadPacks();
    this.gameHub.repairMinecraftWinCounterInteractions();
    this.timerScheduler.start();
    if (readState(this.store, ["settings.startOverlayServer"]).settings?.startOverlayServer) {
      try {
        await this.overlayServer.start();
      } catch (error) {
        this.#activity("error", "server", "Serveur local indisponible", error.message);
      }
    }
    this.publicOverlayRelay.prepareConfiguration();
    if (readState(this.store, ["settings.account.uid"]).settings?.account?.uid) {
      this.publicOverlayRelay.start().catch(() => {
        // Le serveur local et l'interface restent disponibles hors connexion.
      });
    }
    this.publicOverlayRelay.publishState();
    await this.overlayCompletionController.initialize();
    const tiktokConnection = readState(this.store, ["connections"])
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
    await this.startCreatorIntegrations();
    return this.snapshot();
  }

  async suspendAccountWorkspace() {
    this.matches.reset();
    this.liveEventActions.chatbot.reset();
    // Retire la fiche publique avant d’effacer ou de remplacer l’identité chiffrée.
    await this.liveDirectory?.suspendPublication();
    await this.controllerService.stop();
    await this.kickService.dispose();
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

  async startCreatorIntegrations() {
    if (!hasAuthenticatedAccount(this.store)) return;
    if (this.controllerService.status().pluginInstalled || readState(this.store, ["settings.controllers.devices"]).settings?.controllers?.devices?.length) {
      try { await this.controllerService.start(); }
      catch (error) { this.#activity("warning", "controller", "Contrôleurs indisponibles", error.message); }
    }
    const connection = readState(this.store, ["connections"]).connections.find((entry) => entry.type === "kick-native" && entry.enabled);
    if (connection) {
      try { await this.sourceHub.start(connection.id); }
      catch (error) { this.#activity("warning", "kick", "Connexion Kick différée", error.message); }
    }
  }

  async resumeAccountWorkspace() {
    reconcileGiftReferencesSafely(this);
    this.liveDirectory?.resumePublication();
    this.store.mutate((state) => {
      clearSessionState(state);
    }, true);
    this.publicOverlayRelay.prepareConfiguration();
    this.timerScheduler.start();
    if (readState(this.store, ["settings.startOverlayServer"]).settings?.startOverlayServer) {
      await this.overlayServer.start();
    }
    if (readState(this.store, ["settings.account.uid"]).settings?.account?.uid) {
      this.publicOverlayRelay.start().catch(() => {
        // Le compte reste utilisable si le relais distant est indisponible.
      });
    }
    this.publicOverlayRelay.publishState();
    await this.overlayCompletionController.initialize();
    const tiktokConnection = readState(this.store, ["connections"])
      .connections.find((item) => item.id === "source_tiktok");
    if (
      readState(this.store, ["settings.account.uid"]).settings?.account?.uid &&
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
    await this.startCreatorIntegrations();
    this.#changed(true);
    return this.snapshot();
  }

  snapshot() {
    const state = this.store.getState();
    const customSounds = state.customSounds || [];
    const customMedia = state.customMedia || [];
    const soundCatalog = [...this.soundCatalog, ...customSounds];
    const mediaCatalog = [...this.mediaCatalog, ...customMedia];
    return {
      appVersion: this.appVersion,
      state,
      packs: this.catalogSnapshot(),
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
      publicOverlayRelay: this.publicOverlayRelay.status(),
      liveDirectory: this.liveDirectory?.status() || {
        available: false, connected: false, publishing: false, enabled: false, rows: [], capped: false, error: ""
      }
    };
  }

  runtimeSnapshot() {
    return createCoreRuntimeSnapshot(this.store, this.timerScheduler);
  }

  catalogSnapshot() {
    // The catalogue is immutable after loadPacks; avoid cloning thousands of effects per live snapshot.
    if (this.cachedCatalogSource !== this.gameHub.packs || !this.cachedCatalogPacks) {
      this.cachedCatalogSource = this.gameHub.packs;
      this.cachedCatalogPacks = this.gameHub.listPacks();
    }
    return this.cachedCatalogPacks;
  }

  async refreshGiftCatalog({ force = false } = {}) {
    const scope = synchronizeGiftCatalogScope(this);
    if (!scope.username) return this.giftCatalog.gifts;
    try {
      await this.giftCatalog.refreshLocalized(scope.username, { force, roomId: scope.roomId });
    } catch {
      // Le catalogue fusionné embarqué reste disponible hors ligne.
    }
    if (!sameGiftCatalogScope(scope, giftCatalogScope(this.store))) {
      synchronizeGiftCatalogScope(this);
      return this.giftCatalog.gifts;
    }
    this.notifyRenderer?.("gift-room-catalog-updated", this.giftCatalog.getRoomCatalog());
    reconcileGiftReferencesSafely(this);
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

  async rotateMatchOverlayAccess() {
    this.store.mutate((state) => {
      state.settings.matchAccess = {
        accessKey: createMatchAccessKey()
      };
    }, true);
    await this.publicOverlayRelay.rotateMatchChannel();
    this.overlayServer.refreshAccess();
    this.#activity(
      "success",
      "overlay",
      "URL Match régénérée",
      "L’ancienne source Match a été révoquée immédiatement."
    );
    this.#changed();
    return { snapshot: this.snapshot() };
  }

  async startSession() {
    const currentState = readState(this.store, ["settings.tiktok", "settings.kick.live", "connections"]);
    const tiktok = currentState.settings.tiktok || {};
    if (tiktok.username && tiktok.status !== "live" && !liveKickConnection(currentState)) {
      const results = await this.sourceHub.startEnabled();
      if (liveKickConnection(readState(this.store, ["settings.kick.live", "connections"]))) {
        this.#changed();
        return { ...this.snapshot(), sourceResults: results, waitingForTikTokLive: false };
      }
      this.store.mutate((state) => {
        state.session.running = false;
        state.session.startedAt = null;
        state.session.startedBy = "";
        state.session.tiktokRoomId = "";
        state.session.tiktokInterruptedAt = null;
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
      state.session.tiktokRoomId = "";
      state.session.tiktokInterruptedAt = null;
      state.session.activeConnectionIds = currentState.connections
        .filter((connection) => connection.enabled &&
          ((connection.type === "kick-native" && currentState.settings.kick?.live === true) ||
           (["tiktok-direct", "tiktok-relay"].includes(connection.type) && tiktok.status === "live")))
        .map((connection) => connection.id);
      resetSessionStatistics(state);
      resetOverlaySession(state, startedAt);
    });
    const results = await this.sourceHub.startEnabled();
    this.overlayServer.publish(
      "session-state",
      readState(this.store, ["overlaySession"]).overlaySession
    );
    await this.overlayCompletionController.startConfiguredTimer(
      "session-start"
    );
    this.#activity("success", "session", "Session démarrée", "Les sources actives se connectent.");
    this.#changed();
    return { ...this.snapshot(), sourceResults: results };
  }

  async stopSession() {
    this.matches.reset();
    this.liveEventActions.chatbot.reset();
    await this.sourceHub.stopAll();
    const endedAt = new Date().toISOString();
    this.store.mutate((state) => {
      finishLiveStatistics(state, endedAt);
      state.session.running = false;
      state.session.startedAt = null;
      state.session.startedBy = "";
      state.session.tiktokRoomId = "";
      state.session.tiktokInterruptedAt = null;
      state.session.activeConnectionIds = [];
      finishOverlaySession(state, endedAt);
    });
    this.overlayServer.publish(
      "session-state",
      readState(this.store, ["overlaySession"]).overlaySession
    );
    this.#activity("info", "session", "Session arrêtée", "");
    this.#changed();
    return this.snapshot();
  }
  handleKickStatus({ connectionId = "source_kick", live = false, viewers } = {}) {
    if (!hasAuthenticatedAccount(this.store)) return;
    const connection = readState(this.store, ["connections"]).connections.find((entry) => entry.id === connectionId && entry.type === "kick-native");
    if (!connection) return;
    let transition = "";
    this.store.mutateRuntime((state) => {
      state.settings.kick = { ...(state.settings.kick || {}), live: connection.enabled && live === true };
      transition = synchronizeSessionWithKick(state, { connectionId, live: connection.enabled && live === true });
    });
    if (transition === "started") {
      this.overlayCompletionController.stop();
      this.overlayServer.publish("session-state", readState(this.store, ["overlaySession"]).overlaySession);
      this.#activity("success", "session", "Session démarrée automatiquement", "LIVE Kick détecté.");
      this.overlayCompletionController.startConfiguredTimer("kick-session-start").catch((error) =>
        this.#activity("error", "overlay", "Démarrage automatique du timer impossible", serializeError(error).message)
      );
    } else if (transition === "stopped") {
      this.overlayCompletionController.stop();
      this.overlayServer.publish("session-state", readState(this.store, ["overlaySession"]).overlaySession);
      this.#activity("info", "session", "LIVE Kick terminé", "Les données de la session sont conservées.");
    }
    if (Number.isFinite(Number(viewers))) {
      this.store.mutateRuntime((state) => {
        state.settings.kick.viewers = Math.max(0, Number(viewers));
        if (live === true) recordLiveAudience(state, "kick", viewers);
      });
    }
    this.#changed();
  }
  async startGameSession(packId) {
    return this.gameSessions.startGameSession(packId);
  }

  async stopGameSession(options) {
    return this.gameSessions.stopGameSession(options);
  }

  async saveGameRoundSettings(packId, incoming = {}) {
    return this.gameSessions.saveGameRoundSettings(packId, incoming);
  }

  async ingest(raw, source) {
    return ingestCreatorEvent(this, this.ingestionHooks, raw, source);
  }

  async testEvent(type = "gift") {
    return this.ingest(this.createTestEvent(type), "test");
  }

  createTestEvent(type = "gift", overrides = {}) {
    return createTestEvent(type, overrides, readState(this.store, ["settings.tiktok.username"]).settings.tiktok?.username);
  }

  async simulateEvent(incoming = {}) {
    const type = safeString(incoming.type || "gift", 40).toLowerCase();
    return this.ingest(this.createTestEvent(type, incoming), "simulator");
  }

  async testRule(ruleId, overrides = {}) {
    const rule = readState(this.store, ["rules"])
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
    if (readState(this.store, ["settings.startOverlayServer"]).settings?.startOverlayServer) {
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

  async handleMinecraftWinCounter(options) {
    return this.gameSessions.handleMinecraftWinCounter(options);
  }

  async shutdown() {
    this.matches.reset();
    this.liveEventActions.chatbot.reset();
    await this.liveDirectory?.stop();
    await this.controllerService.stop();
    await this.kickService.dispose();
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
    bindCoreEvents({
      minecraftRoundTimer: this.minecraftRoundTimer,
      timerScheduler: this.timerScheduler,
      sourceHub: this.sourceHub,
      ruleEngine: this.ruleEngine,
      matches: this.matches,
      gameHub: this.gameHub,
      store: this.store,
      overlayCompletionController: this.overlayCompletionController,
      overlayServer: this.overlayServer,
      notifyRenderer: this.notifyRenderer,
      onActivity: (...args) => this.#activity(...args),
      onChanged: (deferred) => this.#changed(deferred),
      onGameBridgeMessage: (pack, message) => this.liveEventActions.handleGameBridgeMessage(pack, message),
      ingest: (event, source) => this.ingest(event, source),
      handleKickStatus: (status) => this.handleKickStatus(status),
      refreshGiftCatalog: (options) => this.refreshGiftCatalog(options),
      synchronizeGiftCatalogScope: () => synchronizeGiftCatalogScope(this)
    });
  }

  #recordEvent(event) {
    let previousLikeGoalCurrent = 0;
    let likeGoalCurrent = 0;
    let recordedLiveLike = false;
    this.store.mutateRuntime((state) => {
      previousLikeGoalCurrent = Number(
        state.overlaySession?.likeGoalCurrent || 0
      );
      recordEventStatistics(state, event);
      recordedLiveLike = event.type === "like" && isRealLiveEvent(state, event);
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
    return { previousLikeGoalCurrent, likeGoalCurrent, recordedLiveLike };
  }

  async #handleCommand(event) {
    return this.liveEventActions.handleCommand(event);
  }

  async #handleWheelGiftTriggers(event) {
    return this.liveEventActions.handleWheelGiftTriggers(event);
  }

  #activity(level, category, title, detail, metadata) {
    const entry = {
      level,
      category,
      title: safeString(title, 200),
      detail: safeString(detail, 1000)
    };
    if (category === "chatbot" && metadata) {
      Object.assign(entry, commandActivityMetadata(metadata));
    }
    const checkState = ["connection", "tiktok"].includes(String(category || "").trim().toLowerCase())
      ? readState(this.store, ["session.running", "session.game.running", ...(level === "error" ? ["activity"] : [])]) : {};
    if (!shouldRecordActivity(checkState, entry)) return;
    this.store.addActivity(entry);
  }

  #changed(deferred = false) {
    // Les changements structurels/sources relancent les timers ; aucun parcours
    // supplémentaire de commandes sur les rafales d'événements LIVE différés.
    if (!deferred) this.liveEventActions?.chatbot.syncTimers();
    this.liveDirectory?.sync();
    this.publicOverlayRelay.publishState();
    if (!deferred) {
      if (this.deferredChangeTimer) clearTimeout(this.deferredChangeTimer);
      this.deferredChangeTimer = null;
      this.notifyRenderer("state-changed", this.snapshot());
      return;
    }
    if (this.deferredChangeTimer) return;
    this.deferredChangeTimer = setTimeout(() => {
      this.deferredChangeTimer = null;
      this.notifyRenderer("runtime-state-changed", this.runtimeSnapshot());
    }, 50);
    this.deferredChangeTimer.unref?.();
  }
}

module.exports = {
  ShenPulseCore,
  clearSessionState,
  defaultTestEventCount,
  readMontChiliadCounterEvent,
  recordEventStatistics,
  resolveLikeGoalCompletionChange,
  resetSessionStatistics,
  shouldRecordActivity,
  liveKickConnection,
  synchronizeSessionWithKick,
  synchronizeSessionWithTikTok,
  wheelGiftTriggerMatches
};
