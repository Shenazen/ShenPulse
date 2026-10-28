"use strict";

/** Coordonne le cycle des jeux et les résultats Minecraft.
 * Les services métier restent injectés ; le noyau conserve son API publique.
 */
const { safeString } = require("../utils");
const { readState } = require("../state-projection");
const { isMinecraftRoundGame, normalizeMinecraftRoundSettings } = require("../game-round-timer");

const {normalizeGameRoundSettings}=require('../../shared/minecraft-round-settings');
const {writeGtaRoundSettings}=require('../game-runtime/gta-round-settings');
class GameSessionService {
  constructor({ store, gameHub, minecraftRoundTimer, ruleEngine, actionRunner, notifyRenderer, onActivity, onChanged, getSnapshot }) {
    this.store = store;
    this.gameHub = gameHub;
    this.minecraftRoundTimer = minecraftRoundTimer;
    this.ruleEngine = ruleEngine;
    this.actionRunner = actionRunner;
    this.notifyRenderer = notifyRenderer;
    this.onActivity = onActivity;
    this.onChanged = onChanged;
    this.getSnapshot = getSnapshot;
  }

  async startGameSession(packId) {
    const targetId = safeString(packId, 160);
    const pack = this.gameHub
      .listPacks()
      .find((entry) => entry.id === targetId);
    if (!pack) throw new Error("Ce jeu n’existe plus dans ShenPulse.");
    this.gameHub.assertAccess(targetId);
    const currentGame = readState(this.store, ["session.game"]).session.game || {};
    if (
      currentGame.running === true &&
      currentGame.packId === targetId
    ) {
      return this.getSnapshot();
    }
    const currentPackId =
      readState(this.store, ["session.game"]).session.game?.packId || "";
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
    if(['gtav-koth-enhanced','gtav-hiking-enhanced'].includes(targetId))await writeGtaRoundSettings(targetId,readState(this.store,['game.roundSettingsByPack']).game?.roundSettingsByPack?.[targetId],{assertAccess:()=>this.gameHub.assertAccess(targetId)});
    this.ruleEngine.resetProfileState();
    this.onActivity(
      "success",
      "game",
      `Session ${pack.name} active`,
      "Les interactions de ce jeu sont maintenant disponibles sur toutes les pages."
    );
    this.onChanged();
    return this.getSnapshot();
  }

  async stopGameSession({ notify = true } = {}) {
    const state = readState(this.store, ["session.game"]);
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
      this.onActivity(
        "info",
        "game",
        `Session ${activePack.name} arrêtée`,
        "Ses interactions ne seront plus exécutées."
      );
    }
    if (notify) this.onChanged();
    return this.getSnapshot();
  }

  async saveGameRoundSettings(packId, incoming = {}) {
    const targetId = safeString(packId, 160);
    const pack = this.gameHub.assertAccess(targetId);
    if (!isMinecraftRoundGame(targetId)&&!["gtav-koth-enhanced","gtav-hiking-enhanced"].includes(targetId)) {
      throw new Error(
        "Ce jeu ne possède pas de chrono de partie."
      );
    }
    const settings = normalizeGameRoundSettings(targetId,incoming);
    if(['gtav-koth-enhanced','gtav-hiking-enhanced'].includes(targetId))await writeGtaRoundSettings(targetId,settings,{assertAccess:()=>this.gameHub.assertAccess(targetId)});
    this.store.mutate((state) => {
      state.game.roundSettingsByPack ||= {};
      state.game.roundSettingsByPack[targetId] = settings;
    });
    const restarted = ['gtav-koth-enhanced','gtav-hiking-enhanced'].includes(targetId)?true:await this.minecraftRoundTimer.restartIfActive(
      targetId,
      "settings-change"
    );
    this.onActivity(
      "success",
      "game",
      `Réglages de partie ${pack.name}`,
      `${settings.durationMinutes} minute${
        settings.durationMinutes > 1 ? "s" : ""
      } · relance automatique ${settings.autoRestart ? "activée" : "désactivée"}${
        restarted ? " · chrono redémarré" : ""
      }`
    );
    this.onChanged();
    return this.getSnapshot();
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
    const session = readState(this.store, ["session.game"]).session?.game || {};
    if (session.running !== true || session.packId !== packId) {
      return { synchronized: false };
    }
    const previous = Number(
      readState(this.store, ["overlaySession.winCounterCurrent"]).overlaySession?.winCounterCurrent || 0
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
    this.onActivity(
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
    this.onChanged(true);
    return {
      synchronized: true,
      previous,
      current: synchronizedCurrent,
      outcome,
      resolution
    };
  }

}

module.exports = { GameSessionService };
