"use strict";

const { EventEmitter } = require("node:events");

const MINECRAFT_ROUND_GAME_IDS = Object.freeze([
  "minecraft-bedrock-box",
  "minecraft-sandbox-3"
]);
const DEFAULT_MINECRAFT_ROUND_MINUTES = 10;

function isMinecraftRoundGame(packId) {
  return MINECRAFT_ROUND_GAME_IDS.includes(String(packId || ""));
}

function normalizeMinecraftRoundSettings(value = {}) {
  const durationMinutes = Math.max(
    1,
    Math.min(
      1440,
      Math.round(
        Number(value.durationMinutes || DEFAULT_MINECRAFT_ROUND_MINUTES)
      )
    )
  );
  return {
    durationMinutes,
    autoRestart: value.autoRestart === true
  };
}

function minecraftRoundSettings(state, packId) {
  return normalizeMinecraftRoundSettings(
    state?.game?.roundSettingsByPack?.[packId]
  );
}

function minecraftTimeoutCommands(packId, appliedAmount = -1) {
  const loss = Math.min(-1, Math.round(Number(appliedAmount) || -1));
  const resetCommand =
    packId === "minecraft-bedrock-box"
      ? "bedrock reset 1"
      : "sandbox stop";
  return [
    "shenpulse_win hide",
    "title @a clear",
    "title @a times 5 60 10",
    `title @a subtitle {"text":"${loss} WIN${
      Math.abs(loss) === 1 ? "" : "S"
    }","color":"red","bold":true}`,
    'title @a title {"text":"TIME OUT","color":"red","bold":true}',
    "delay 2500",
    resetCommand,
    "delay 500",
    "shenpulse_win hide"
  ];
}

class MinecraftRoundTimer extends EventEmitter {
  constructor({
    store,
    actionRunner,
    gameHub,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout
  }) {
    super();
    this.store = store;
    this.actionRunner = actionRunner;
    this.gameHub = gameHub;
    this.setTimeoutFn = setTimeoutFn;
    this.clearTimeoutFn = clearTimeoutFn;
    this.timeoutHandle = null;
    this.sequence = 0;
  }

  async start(packId, reason = "server-start") {
    if (!isMinecraftRoundGame(packId)) return null;
    this.#clearScheduledTimeout();
    const settings = minecraftRoundSettings(this.store.getState(), packId);
    const durationSeconds = settings.durationMinutes * 60;
    const startedAtMs = Date.now();
    const roundId = `${packId}:${startedAtMs}:${++this.sequence}`;
    const endsAtMs = startedAtMs + durationSeconds * 1000;
    this.store.mutate((state) => {
      if (
        state.session.game?.running !== true ||
        state.session.game?.packId !== packId
      ) {
        return;
      }
      state.session.game.roundId = roundId;
      state.session.game.roundStartedAt = new Date(startedAtMs).toISOString();
      state.session.game.roundEndsAt = new Date(endsAtMs).toISOString();
      state.session.game.roundDurationSeconds = durationSeconds;
      state.session.game.roundAutoRestart = settings.autoRestart;
      state.session.game.roundStatus = "running";
    }, true);
    await this.#publishTimer(durationSeconds);
    try {
      await this.gameHub.executeMinecraftCommands(packId, [
        "shenpulse_win hide"
      ]);
    } catch {
      // Le chrono ShenPulse reste la source de vérité si le plugin démarre encore.
    }
    this.timeoutHandle = this.setTimeoutFn(() => {
      this.timeoutHandle = null;
      return this.#handleTimeout(packId, roundId).catch((error) => {
        this.emit("error", { error, packId, roundId });
      });
    }, durationSeconds * 1000);
    this.timeoutHandle?.unref?.();
    this.emit("started", {
      packId,
      roundId,
      reason,
      durationSeconds,
      endsAt: new Date(endsAtMs).toISOString(),
      autoRestart: settings.autoRestart
    });
    return {
      packId,
      roundId,
      durationSeconds,
      endsAt: new Date(endsAtMs).toISOString(),
      autoRestart: settings.autoRestart
    };
  }

  async restartIfActive(packId, reason = "settings-change") {
    const session = this.store.getState().session?.game || {};
    if (
      session.running !== true ||
      session.packId !== packId ||
      !isMinecraftRoundGame(packId)
    ) {
      return null;
    }
    return this.start(packId, reason);
  }

  async stop({ clearState = true, publish = true } = {}) {
    this.#clearScheduledTimeout();
    if (clearState) {
      this.store.mutate((state) => {
        const game = state.session.game;
        if (!game) return;
        game.roundId = "";
        game.roundStartedAt = null;
        game.roundEndsAt = null;
        game.roundDurationSeconds = 0;
        game.roundAutoRestart = false;
        game.roundStatus = "stopped";
      }, true);
    }
    if (publish) await this.#publishTimer(0);
  }

  async cancelNativeRoundIfStopped(packId) {
    const game = this.store.getState().session?.game || {};
    if (
      game.running !== true ||
      game.packId !== packId ||
      game.roundStatus !== "timeout" ||
      game.roundEndsAt ||
      game.roundAutoRestart === true
    ) {
      return false;
    }
    const commands =
      packId === "minecraft-sandbox-3"
        ? ["sandbox stop", "shenpulse_win hide"]
        : ["shenpulse_win hide"];
    try {
      await this.gameHub.executeMinecraftCommands(packId, commands);
      return true;
    } catch {
      return false;
    }
  }

  async dispose() {
    await this.stop({ clearState: false, publish: false });
  }

  #clearScheduledTimeout() {
    if (this.timeoutHandle) {
      this.clearTimeoutFn(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }

  async #publishTimer(seconds) {
    await this.actionRunner.run(
      {
        id: `minecraft_round_timer_${Date.now()}`,
        type: "timer.add",
        config: {
          operation: "set",
          seconds,
          label: "Temps restant"
        }
      },
      {
        source: "minecraft-round",
        user: {
          id: "shenpulse",
          name: "shenpulse",
          displayName: "ShenPulse"
        }
      }
    );
  }

  async #handleTimeout(packId, roundId) {
    const before = this.store.getState();
    const session = before.session?.game || {};
    if (
      session.running !== true ||
      session.packId !== packId ||
      session.roundId !== roundId
    ) {
      return;
    }
    const previousWins = Number(
      before.overlaySession?.winCounterCurrent || 0
    );
    const result = await this.actionRunner.run(
      {
        id: `minecraft_round_timeout_${roundId}`,
        type: "overlay.win-counter",
        config: {
          packId,
          effectId: "minecraft_round_timeout",
          operation: "adjust",
          amount: -1
        }
      },
      {
        source: "minecraft-round-timeout",
        user: {
          id: "minecraft",
          name: "minecraft",
          displayName: "TIME OUT Minecraft"
        }
      }
    );
    const currentWins = Number(
      result?.current ??
        this.store.getState().overlaySession?.winCounterCurrent ??
        previousWins - 1
    );
    const appliedAmount = Number.isFinite(currentWins)
      ? currentWins - previousWins
      : -1;
    let nativeSynchronized = true;
    try {
      await this.gameHub.executeMinecraftCommands(
        packId,
        minecraftTimeoutCommands(packId, appliedAmount)
      );
    } catch {
      nativeSynchronized = false;
    }
    const settings = minecraftRoundSettings(this.store.getState(), packId);
    const timedOutAt = new Date().toISOString();
    this.store.mutate((state) => {
      const game = state.session.game;
      if (
        game?.running !== true ||
        game.packId !== packId ||
        game.roundId !== roundId
      ) {
        return;
      }
      game.roundEndsAt = null;
      game.roundStatus = "timeout";
      game.lastRoundTimeoutAt = timedOutAt;
      game.roundTimeoutCount =
        Math.max(0, Number(game.roundTimeoutCount || 0)) + 1;
    }, true);
    await this.#publishTimer(0);
    this.emit("timeout", {
      packId,
      roundId,
      currentWins,
      appliedAmount,
      nativeSynchronized,
      autoRestart: settings.autoRestart,
      timedOutAt
    });
    const currentSession = this.store.getState().session?.game || {};
    if (
      settings.autoRestart &&
      currentSession.running === true &&
      currentSession.packId === packId &&
      currentSession.roundId === roundId
    ) {
      await this.start(packId, "timeout-restart");
    }
  }
}

module.exports = {
  DEFAULT_MINECRAFT_ROUND_MINUTES,
  MINECRAFT_ROUND_GAME_IDS,
  MinecraftRoundTimer,
  isMinecraftRoundGame,
  minecraftRoundSettings,
  minecraftTimeoutCommands,
  normalizeMinecraftRoundSettings
};
