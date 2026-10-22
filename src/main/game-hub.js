"use strict";

const path = require("node:path");
const { EventEmitter } = require("node:events");
const { loadShenazenGameCatalog } = require("./game-catalog");
const { assertGameAccess } = require("./game-access");
const { assertAdminAccount } = require("./account-access");
const { readState } = require("./state-projection");
const { WindowsInputService } = require("./windows-input-service");
const { ColorStrikeBridge } = require("./color-strike-bridge");
const { TikLiveClimbBridge } = require("./tiklive-climb-bridge");
const { TikLiveCubeWarsBridge } = require("./tiklive-cube-wars-bridge");
const { TikLiveStackTowerBridge } = require("./tiklive-stack-tower-bridge");
const { ClashOfLiveBridge } = require("./clash-of-live-bridge");
const { FindTheNeedleBridge } = require("./find-the-needle-bridge");
const interactions = require("./game-hub/interaction-management");
const { validatePack, interpolateCommand, resolveEffectCode } = require("./game-hub/commands");
const { rconPacket, readRconPacket, rconRequest } = require("./game-hub/rcon");
const { createEffectPayload } = require("./game-hub/effect-payload");
const { GameTransports } = require("./game-hub/transports");
const { httpBridgeFor } = require("./game-hub/http-bridges");
const { assertProFeatureAccess, createProFeatureGuard } = require("./pro-feature-access");
const visibility = require("../shared/visibility-catalog");
const APP_VERSION = require("../../package.json").version;
const { ADMIN_OWNER_EMAIL } = require("./account-access");
const { waitForGameConnection } = require("./game-hub/connection-ready");

/** Façade compatible des jeux : accès, catalogue, connexions, exécution et événements. */
class GameHub extends EventEmitter {
  constructor({
    store,
    appVersion = APP_VERSION,
    packsDirectory,
    resourcesDirectory,
    windowsInputService,
    colorStrikeBridge,
    tikLiveClimbBridge,
    tikLiveCubeWarsBridge,
    tikLiveStackTowerBridge,
    clashOfLiveBridge,
    findTheNeedleBridge,
    giftCatalog
  }) {
    super();
    this.store = store;
    this.appVersion = String(appVersion || APP_VERSION);
    this.packsDirectory = packsDirectory;
    this.resourcesDirectory = resourcesDirectory || path.dirname(packsDirectory);
    this.packs = [];
    this.sockets = new Map();
    this.serverBridges = new Map();
    this.gameRuntime = null;
    this.minecraftRuntime = null;
    this.windowsInputService =
      windowsInputService || new WindowsInputService();
    this.colorStrikeBridge = colorStrikeBridge || new ColorStrikeBridge();
    this.tikLiveClimbBridge =
      tikLiveClimbBridge || new TikLiveClimbBridge();
    this.tikLiveCubeWarsBridge =
      tikLiveCubeWarsBridge || new TikLiveCubeWarsBridge();
    this.tikLiveStackTowerBridge =
      tikLiveStackTowerBridge || new TikLiveStackTowerBridge();
    this.clashOfLiveBridge = clashOfLiveBridge || new ClashOfLiveBridge();
    this.findTheNeedleBridge = findTheNeedleBridge || new FindTheNeedleBridge({
      getToken: (connector) => connector.secretId ? this.store.getSecret(connector.secretId) : ""
    });
    this.giftCatalog = giftCatalog || null;
    this.transports = new GameTransports(this);
  }

  /** Injecte le runtime géré, aussi utilisé par les passerelles Pokémon et Mario Kart. */
  setMinecraftRuntime(runtime) {
    this.gameRuntime = runtime || null;
    this.minecraftRuntime = runtime || null;
  }

  /** Valide les catalogues, garde une sélection valide et désactive les effets indisponibles. */
  loadPacks() {
    const catalogPacks = loadShenazenGameCatalog(this.resourcesDirectory);
    for (const pack of catalogPacks) validatePack(pack);
    this.packs = catalogPacks.sort((first, second) =>
      first.name.localeCompare(second.name)
    );
    const activePackId = readState(this.store, ["session.activeGamePackId"]).session.activeGamePackId;
    if (!this.packs.some((pack) => pack.id === activePackId)) {
      this.store.mutate((state) => {
        state.session.activeGamePackId = "coin-pusher";
        state.game.recentPacks = ["coin-pusher", "connect-four"];
      });
    }
    this.disableUnavailableInteractions();
    return this.listPacks();
  }

  /** Copie isolée du catalogue pour les consommateurs externes. */
  listPacks() {
    return structuredClone(this.packs);
  }

  /** Désactive les règles d'effets explicitement indisponibles. */
  disableUnavailableInteractions() { return interactions.disableUnavailableInteractions(this); }

  /** Répare les WINS hérités sans écraser les réglages personnalisés. */
  repairMinecraftWinCounterInteractions() { return interactions.repairMinecraftWinCounterInteractions(this); }

  /** Valide propriétaire, abonnement et droit de jeu avant toute exécution. */
  assertAccess(packId) {
    const pack = this.#pack(packId);
    const state = assertProFeatureAccess(this.store, "games");
    const account = state.settings?.account || {};
    const admin = account.emailVerified === true && String(account.email || "").trim().toLowerCase() === ADMIN_OWNER_EMAIL;
    const scope = visibility.gameScopeFor(state.settings?.siteVisibility, pack);
    if (pack.ownerOnly === true && scope === "admin") assertAdminAccount(this.store);
    if (!visibility.canAccessScope(scope, admin)) {
      const error = new Error("Ce jeu est désactivé ou réservé par l’administrateur.");
      error.code = "FEATURE_ACCESS_FORBIDDEN";
      throw error;
    }
    if (!visibility.gameVersionAllowed(state.settings?.siteVisibility, pack, this.appVersion)) {
      const error = new Error(`Ce jeu nécessite ShenPulse ${visibility.gameMinimumVersionFor(state.settings?.siteVisibility, pack.id)} ou une version plus récente. Mettez ShenPulse à jour.`);
      error.code = "GAME_APP_VERSION_REQUIRED";
      throw error;
    }
    return assertGameAccess(readState(this.store, ["commerce.subscription", "commerce.gameEntitlements"]), pack);
  }

  /** Initialisation ou réparation versionnée des associations et roues. */
  initializeDefaultInteractions(packId) { return interactions.initializeDefaultInteractions(this, packId); }

  /** Diagnostic d'une connexion autorisée, sans déclencher d'effet. */
  async testConnection(packId) {
    const pack = this.assertAccess(packId);
    const connector = this.#connector(pack);
    if (connector.type === "demo") {
      return {
        ok: true,
        simulated: true,
        message: pack.effects.some((effect) => effect.available)
          ? "Moteur local prêt."
          : "Fiche de référence chargée ; pack natif non disponible."
      };
    }
    const nativeHttpBridge = httpBridgeFor(this, connector.type);
    if (nativeHttpBridge) return nativeHttpBridge.status(connector);
    if (connector.type === "http") {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(connector.url, {
          method: "HEAD",
          signal: controller.signal
        });
        return { ok: response.ok || response.status === 405, status: response.status };
      } finally {
        clearTimeout(timer);
      }
    }
    if (connector.type === "udp") return { ok: true, connectionless: true };
    if (connector.type === "windows-input") {
      return this.windowsInputService.status(connector.processName);
    }
    if (connector.type === "rcon") {
      const password = this.#connectorSecret(pack, connector);
      await rconRequest(connector, password, "list");
      return { ok: true };
    }
    if (connector.type === "minecraft-runtime") {
      if (!this.minecraftRuntime) {
        throw new Error("Le serveur Minecraft ShenPulse n’est pas initialisé.");
      }
      return this.minecraftRuntime.minecraftConnectionStatus(pack.id);
    }
    if (connector.type === "pokemon-runtime") {
      if (!this.gameRuntime) {
        throw new Error("La passerelle Pokémon ShenPulse n’est pas initialisée.");
      }
      return this.gameRuntime.pokemonConnectionStatus(pack.id);
    }
    if (connector.type === "super-mario-kart-runtime") {
      if (!this.gameRuntime) {
        throw new Error(
          "La passerelle Super Mario Kart ShenPulse n’est pas initialisée."
        );
      }
      return this.gameRuntime.superMarioKartConnectionStatus(pack.id);
    }
    if (["tcp-server", "websocket-server", "balatro-gamepass"].includes(connector.type)) {
      const bridge = await this.#getServerBridge(pack, connector);
      const status = bridge.status();
      if (!status.connected) {
        throw new Error(
          `${pack.name} n’est pas encore connecté à ShenPulse. Lancez le jeu, chargez votre partie, puis réessayez.`
        );
      }
      return { ...status, type: connector.type };
    }
    const socket = await this.#getSocket(pack, connector);
    return { ok: Boolean(socket), type: connector.type };
  }

  /** Prépare le serveur TCP après validation de l'accès. */
  async prepareConnection(packId) {
    const pack = this.assertAccess(packId);
    const connector = this.#connector(pack);
    if (!["tcp-server", "websocket-server", "balatro-gamepass"].includes(connector.type)) {
      return { ok: true, listening: false, type: connector.type };
    }
    const bridge = await this.#getServerBridge(pack, connector);
    return { ...bridge.status(), type: connector.type };
  }

  waitForConnection(packId, options) { return waitForGameConnection(this, packId, options); }

  /** Transmet les commandes au runtime Minecraft géré du pack. */
  async executeMinecraftCommands(packId, commands, { shouldExecute } = {}) {
    const pack = this.assertAccess(packId);
    const assertAccess = createProFeatureGuard(this.store, "games", { shouldExecute, assertAdditional: () => this.assertAccess(packId) });
    const connector = this.#connector(pack);
    if (connector.type !== "minecraft-runtime") {
      throw new Error(`${pack.name} n’utilise pas le serveur Minecraft géré par ShenPulse.`);
    }
    if (!this.minecraftRuntime) {
      throw new Error("Le serveur Minecraft ShenPulse n’est pas initialisé.");
    }
    assertAccess();
    return this.minecraftRuntime.executeMinecraftCommands(pack.id, commands, { assertAccess });
  }

  /** Arrête le runtime demandé sans fermer les autres connecteurs. */
  async stopRuntime(packId) {
    const pack = this.#pack(packId);
    if (!this.minecraftRuntime?.stop) {
      return { stopped: false, gameId: pack.id };
    }
    return this.minecraftRuntime.stop(pack.id);
  }

  /** Valide accès et effet, construit la charge utile puis émet début et résultat dans l'ordre. */
  async trigger(effectId, context = {}, options = {}) {
    const packId = options.packId || readState(this.store, ["session.activeGamePackId"]).session.activeGamePackId;
    const pack = this.assertAccess(packId);
    const assertAccess = createProFeatureGuard(this.store, "games", {
      shouldExecute: context.shouldExecute, assertAdditional: () => this.assertAccess(packId)
    });
    const effect = pack.effects.find((item) => item.id === effectId);
    if (!effect) throw new Error(`Effet introuvable : ${effectId}`);
    if (effect.available === false) {
      throw new Error(effect.unavailableReason || "Cet effet est une référence visuelle : aucun pack natif exécutable n’est encore disponible.");
    }
    const connector = this.#connector(pack);
    const payload = createEffectPayload(effect, context, options);
    this.emit("effect-start", { pack, effect, payload, context });
    if (
      connector.focusProcessOnManualTrigger &&
      String(context.source || "").startsWith("manual")
    ) {
      await this.windowsInputService.activate(
        connector.focusProcessOnManualTrigger,
        { assertAccess }
      );
    }
    assertAccess();
    const nativeHttpBridge = httpBridgeFor(this, connector.type);
    let result;
    if (connector.type === "demo") {
      result = { status: "success", message: "Effet simulé." };
    } else if (["tcp-server", "websocket-server", "balatro-gamepass"].includes(connector.type)) {
      result = await this.#sendTcpServer(pack, connector, payload, { assertAccess });
    } else if (connector.type === "tcp") {
      result = await this.#sendTcp(pack, connector, payload, { assertAccess });
    } else if (connector.type === "websocket") {
      result = await this.#sendWebSocket(pack, connector, payload, { assertAccess });
    } else if (nativeHttpBridge) {
      result = await nativeHttpBridge.trigger(connector, payload, { ...context, assertGameAccess: assertAccess });
    } else if (connector.type === "http") {
      result = await this.#sendHttp(connector, payload, { assertAccess });
    } else if (connector.type === "udp") {
      result = await this.#sendUdp(connector, payload, { assertAccess });
    } else if (connector.type === "rcon") {
      const command = interpolateCommand(effect.command, payload.effect);
      result = await rconRequest(
        connector,
        this.#connectorSecret(pack, connector),
        command,
        { assertAccess }
      );
    } else if (connector.type === "minecraft-runtime") {
      if (!this.minecraftRuntime) {
        throw new Error("Le serveur Minecraft ShenPulse n’est pas initialisé.");
      }
      result = await this.minecraftRuntime.executeMinecraftCommands(
        pack.id,
        payload.effect.commands,
        { assertAccess }
      );
    } else if (connector.type === "pokemon-runtime") {
      if (!this.gameRuntime) {
        throw new Error("La passerelle Pokémon ShenPulse n’est pas initialisée.");
      }
      result = await this.gameRuntime.executePokemonEffect(
        pack.id,
        payload.effect.code,
        effect.name
      );
    } else if (connector.type === "super-mario-kart-runtime") {
      if (!this.gameRuntime) {
        throw new Error(
          "La passerelle Super Mario Kart ShenPulse n’est pas initialisée."
        );
      }
      result = await this.gameRuntime.executeSuperMarioKartEffect(
        pack.id,
        payload.effect.code,
        effect.name
      );
    } else if (connector.type === "windows-input") {
      const letterGestures = pack.id === "dead-by-daylight" && connector.gestureKeys === "letters" &&
        ["dbd_dbd_point", "dbd_dbd_come_here", "dbd_dbd_gesture_spam"].includes(effect.code);
      const arkFistsAzerty = pack.id === "ark-survival-ascended" && effect.code === "ark_toggle_fists" && connector.keyLayout === "azerty";
      const inputSequence = letterGestures
        ? effect.inputSequence.replace(/(^|;)(k,\d+,)(49|50)(,[01])(?=;|$)/g,
            (_, separator, prefix, key, action) => `${separator}${prefix}${key === "49" ? 80 : 79}${action}`)
        : arkFistsAzerty ? effect.inputSequence.replace(/,81,/g, ",65,") : effect.inputSequence;
      result = {
        status: "success",
        ...(await this.windowsInputService.play(
          connector.processName,
          inputSequence,
          arkFistsAzerty ? "wasd" : connector.keyLayout,
          letterGestures ? "virtual-key" : effect.keyboardInputMode || connector.keyboardInputMode,
          { assertAccess }
        ))
      };
    } else {
      throw new Error(`Connecteur de jeu inconnu : ${connector.type}`);
    }
    this.emit("effect-result", { pack, effect, payload, result, context });
    return result;
  }

  /** Libère sockets et ponts serveur, puis vide les caches. */
  async disconnectAll() {
    for (const socket of this.sockets.values()) {
      socket.close?.();
      socket.destroy?.();
    }
    this.sockets.clear();
    await Promise.all(
      [...this.serverBridges.values()].map((bridge) => bridge.close())
    );
    this.serverBridges.clear();
  }

  #pack(packId) {
    const pack = this.packs.find((item) => item.id === packId);
    if (!pack) throw new Error(`Pack de jeu introuvable : ${packId}`);
    return pack;
  }

  #connector(pack) {
    // Ce plugin natif est livré pour un endpoint local fixe. Les anciennes
    // valeurs sauvegardées (notamment 51337) ne doivent pas le détourner.
    if (["euro-truck-simulator-2", "blue-prince", "resident-evil-3", "cult-of-the-lamb", "stardew-valley", "terraria", "escape-from-duckov", "dredge", "egging-on", "fallout-4", "gtav-montchiliad", "the-mortuary-assistant", "unturned", "crash-bandicoot-n-sane-trilogy"].includes(pack.id)) return { ...pack.connector };
    if (pack.id === "balatro" && readState(this.store, ["game.installations"]).game.installations?.balatro?.edition === "gamepass") {
      return { ...pack.connector, type: "balatro-gamepass", focusProcessOnManualTrigger: "love" };
    }
    if (pack.id === "balatro") return { ...pack.connector };
    const override = readState(this.store, ["game.connectorOverrides"]).game.connectorOverrides?.[pack.id] || {};
    if (pack.connector?.type === "windows-input") {
      return {
        ...pack.connector,
        ...(pack.id === "dead-by-daylight" ? {
          processName: require("./game-runtime/four-games-installation").deadByDaylightProcess(readState(this.store, ["game.installations"]).game.installations?.[pack.id]),
          gestureKeys: override.gestureKeys === "letters" ? "letters" : "numbers"
        } : {}),
        keyLayout:
          ["wasd", "azerty", "zsqd"].includes(String(override.keyLayout || "").toLowerCase())
            ? String(override.keyLayout).toLowerCase()
            : pack.connector.keyLayout || "azerty"
      };
    }
    return { ...(pack.connector || {}), ...override };
  }

  #connectorSecret(pack, connector) {
    const secretId =
      connector.secretId ||
      readState(this.store, ["game.connectorOverrides"]).game.connectorOverrides?.[pack.id]?.secretId;
    return secretId ? this.store.getSecret(secretId) : connector.password || "";
  }

  #getServerBridge(pack, connector, payload) { return this.transports.getServerBridge(pack, connector, payload); }

  #getSocket(pack, connector, payload) { return this.transports.getSocket(pack, connector, payload); }

  #sendTcp(pack, connector, payload, options) { return this.transports.sendTcp(pack, connector, payload, options); }

  #sendTcpServer(pack, connector, payload, options) { return this.transports.sendTcpServer(pack, connector, payload, options); }

  #sendWebSocket(pack, connector, payload, options) { return this.transports.sendWebSocket(pack, connector, payload, options); }

  #sendHttp(connector, payload, options) { return this.transports.sendHttp(connector, payload, options); }

  #sendUdp(connector, payload, options) { return this.transports.sendUdp(connector, payload, options); }
}

module.exports = {
  GameHub,
  interpolateCommand,
  resolveEffectCode,
  rconPacket,
  readRconPacket,
  validatePack
};
