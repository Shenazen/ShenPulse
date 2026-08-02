"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  MinecraftRoundTimer,
  minecraftTimeoutCommands,
  normalizeMinecraftRoundSettings
} = require("../src/main/game-round-timer");

function harness({ autoRestart = false, currentWins = 5 } = {}) {
  const state = {
    game: {
      roundSettingsByPack: {
        "minecraft-bedrock-box": {
          durationMinutes: 10,
          autoRestart
        }
      }
    },
    overlaySession: {
      winCounterCurrent: currentWins
    },
    session: {
      game: {
        running: true,
        packId: "minecraft-bedrock-box",
        profileId: "profile_test",
        startedAt: new Date().toISOString()
      }
    }
  };
  const scheduled = [];
  const actions = [];
  const commands = [];
  const store = {
    getState: () => state,
    mutate: (callback) => callback(state)
  };
  const actionRunner = {
    run: async (action) => {
      actions.push(action);
      if (action.type === "overlay.win-counter") {
        state.overlaySession.winCounterCurrent += Number(
          action.config.amount || 0
        );
        return {
          current: state.overlaySession.winCounterCurrent
        };
      }
      return action.config;
    }
  };
  const gameHub = {
    executeMinecraftCommands: async (packId, entries) => {
      commands.push({ packId, entries });
      return { sent: true };
    }
  };
  const timer = new MinecraftRoundTimer({
    store,
    actionRunner,
    gameHub,
    setTimeoutFn: (callback, milliseconds) => {
      const handle = {
        callback,
        milliseconds,
        unref() {}
      };
      scheduled.push(handle);
      return handle;
    },
    clearTimeoutFn: (handle) => {
      handle.cleared = true;
    }
  });
  return {
    actions,
    commands,
    scheduled,
    state,
    timer
  };
}

test("les manches Minecraft durent dix minutes par défaut", () => {
  assert.deepEqual(normalizeMinecraftRoundSettings(), {
    durationMinutes: 10,
    autoRestart: false
  });
  assert.deepEqual(
    normalizeMinecraftRoundSettings({
      durationMinutes: 25,
      autoRestart: true
    }),
    {
      durationMinutes: 25,
      autoRestart: true
    }
  );
});

test("le chrono démarre avec le serveur et synchronise Minecraft", async () => {
  const runtime = harness();
  const result = await runtime.timer.start(
    "minecraft-bedrock-box",
    "server-start"
  );

  assert.equal(result.durationSeconds, 600);
  assert.equal(runtime.scheduled[0].milliseconds, 600_000);
  assert.equal(runtime.state.session.game.roundStatus, "running");
  assert.ok(runtime.state.session.game.roundEndsAt);
  assert.deepEqual(runtime.actions[0].config, {
    operation: "set",
    seconds: 600,
    label: "Temps restant"
  });
  assert.deepEqual(runtime.commands[0].entries, [
    "shenpulse_win set 5",
    "shenpulse_win timer 600",
    "shenpulse_win show"
  ]);
});

test("un TIME OUT retire une WIN et s'affiche dans Minecraft", async () => {
  const runtime = harness();
  await runtime.timer.start("minecraft-bedrock-box");
  await runtime.scheduled[0].callback();

  assert.equal(runtime.state.overlaySession.winCounterCurrent, 4);
  assert.equal(runtime.state.session.game.roundStatus, "timeout");
  assert.equal(runtime.state.session.game.roundEndsAt, null);
  assert.equal(runtime.scheduled.length, 1);
  assert.ok(
    runtime.commands.some(({ entries }) =>
      entries.includes(
        'title @a title {"text":"TIME OUT","color":"red","bold":true}'
      )
    )
  );
  assert.ok(
    runtime.actions.some(
      (action) =>
        action.type === "overlay.win-counter" &&
        action.config.amount === -1
    )
  );
});

test("la relance automatique arme une nouvelle manche après le TIME OUT", async () => {
  const runtime = harness({ autoRestart: true });
  await runtime.timer.start("minecraft-bedrock-box");
  const firstRoundId = runtime.state.session.game.roundId;
  await runtime.scheduled[0].callback();

  assert.equal(runtime.state.overlaySession.winCounterCurrent, 4);
  assert.equal(runtime.state.session.game.roundStatus, "running");
  assert.notEqual(runtime.state.session.game.roundId, firstRoundId);
  assert.equal(runtime.scheduled.length, 2);
  assert.equal(runtime.scheduled[1].milliseconds, 600_000);
});

test("les commandes TIME OUT sont adaptées aux deux modes Minecraft", () => {
  assert.ok(
    minecraftTimeoutCommands("minecraft-bedrock-box").includes(
      "bedrock reset 1"
    )
  );
  assert.ok(
    minecraftTimeoutCommands("minecraft-sandbox-3").includes("sandbox stop")
  );
  assert.ok(
    minecraftTimeoutCommands("minecraft-bedrock-box").includes(
      "shenpulse_win hide"
    )
  );
  assert.ok(
    minecraftTimeoutCommands("minecraft-bedrock-box").includes(
      "shenpulse_win show"
    )
  );
  const commands = minecraftTimeoutCommands("minecraft-bedrock-box");
  assert.ok(
    commands.indexOf(
      'title @a title {"text":"TIME OUT","color":"red","bold":true}'
    ) < commands.indexOf("bedrock reset 1")
  );
  assert.ok(commands.includes("delay 2500"));
});

test("une victoire native termine la manche sans appliquer ensuite un TIME OUT", async () => {
  const runtime = harness();
  await runtime.timer.start("minecraft-bedrock-box");
  const timeout = runtime.scheduled[0];

  const result = await runtime.timer.resolveNativeOutcome(
    "minecraft-bedrock-box",
    {
      outcome: "win",
      currentWins: 6,
      source: "auto-win"
    }
  );

  assert.equal(result.resolved, true);
  assert.equal(timeout.cleared, true);
  assert.equal(runtime.state.session.game.roundStatus, "won");
  assert.equal(runtime.state.session.game.roundEndsAt, null);
  assert.equal(runtime.state.session.game.roundWinCount, 1);
  assert.ok(
    runtime.actions.some(
      (action) =>
        action.type === "timer.add" && action.config.seconds === 0
    )
  );
});

test("une défaite native est enregistrée sans retirer deux fois une WIN", async () => {
  const runtime = harness({ currentWins: 4 });
  await runtime.timer.start("minecraft-bedrock-box");

  const result = await runtime.timer.resolveNativeOutcome(
    "minecraft-bedrock-box",
    {
      outcome: "loss",
      currentWins: 3,
      source: "timer-penalty"
    }
  );

  assert.equal(result.resolved, true);
  assert.equal(runtime.state.overlaySession.winCounterCurrent, 4);
  assert.equal(runtime.state.session.game.roundStatus, "timeout");
  assert.equal(runtime.state.session.game.roundTimeoutCount, 1);
  assert.ok(
    !runtime.actions.some(
      (action) =>
        action.type === "overlay.win-counter" &&
        action.config.amount === -1
    )
  );
});
