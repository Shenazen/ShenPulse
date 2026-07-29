"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ActionRunner } = require("../src/main/action-runner");

function createRunner(
  published,
  state = { settings: { tts: {} } },
  onOverlayOperation = () => {},
  options = {}
) {
  const triggered = [];
  return new ActionRunner({
    store: { getState: () => state },
    overlayServer: {
      publish: (event, payload) => published.push({ event, payload })
    },
    gameHub: {
      trigger: async (...args) => {
        triggered.push(args);
        return { ok: true };
      }
    },
    obsClient: {},
    sourceHub: {},
    spotifyService: {},
    notifyRenderer: () => {},
    onOverlayOperation,
    ...options
  });
}

test("le runner transmet toutes les commandes du timer à l'overlay", async () => {
  const published = [];
  const runner = createRunner(published);

  for (const operation of ["add", "set", "pause", "resume", "reset"]) {
    const result = await runner.run(
      {
        type: "timer.add",
        config: { operation, seconds: 30, label: "TEMPS RESTANT" }
      },
      {}
    );
    assert.equal(result.operation, operation);
  }

  assert.deepEqual(
    published.map(({ event, payload }) => [event, payload.operation]),
    [
      ["timer", "add"],
      ["timer", "set"],
      ["timer", "pause"],
      ["timer", "resume"],
      ["timer", "reset"]
    ]
  );
});

test("l'overlay gère le réglage, la pause, la reprise et la remise à zéro", () => {
  const overlayScript = fs.readFileSync(
    path.join(__dirname, "..", "resources", "overlays", "overlay.js"),
    "utf8"
  );

  assert.match(overlayScript, /operation === "set"/);
  assert.match(overlayScript, /operation === "pause"/);
  assert.match(overlayScript, /operation === "resume"/);
  assert.match(overlayScript, /operation === "reset"/);
  assert.match(overlayScript, /if \(!timerPaused && timerSeconds > 0\)/);
  assert.match(overlayScript, /runtime\.timerEndsAt/);
  assert.match(overlayScript, /persistedTimerSeconds/);
});

test("le runner persiste le timer avant de le diffuser", async () => {
  const published = [];
  const state = { settings: { tts: {} }, overlaySession: {} };
  const runner = createRunner(published, state);

  const result = await runner.run(
    {
      type: "timer.add",
      config: { operation: "set", seconds: 600, label: "Temps restant" }
    },
    {}
  );

  assert.equal(state.overlaySession.timerSeconds, 600);
  assert.ok(state.overlaySession.timerEndsAt > Date.now());
  assert.equal(state.overlaySession.timerPaused, false);
  assert.equal(result.endsAt, state.overlaySession.timerEndsAt);
});

test("le runner signale les changements persistés du timer", async () => {
  const published = [];
  const changes = [];
  const state = {
    settings: { tts: {} },
    overlaySession: {
      timerSeconds: 5,
      timerEndsAt: 0,
      timerPaused: true
    }
  };
  const runner = createRunner(
    published,
    state,
    (change) => changes.push(change)
  );

  await runner.run(
    {
      id: "timer-action",
      type: "timer.add",
      config: { operation: "set", seconds: 30 }
    },
    { user: { displayName: "Viewer" } }
  );

  assert.equal(changes.length, 1);
  assert.equal(changes[0].channel, "timer");
  assert.equal(changes[0].originActionId, "timer-action");
  assert.equal(changes[0].previous.timerSeconds, 5);
  assert.equal(changes[0].runtime.timerSeconds, 30);
});

test("les interactions WINS pilotent réellement le compteur Mont Chiliad", async () => {
  const published = [];
  const runner = createRunner(published);
  const result = await runner.run(
    {
      id: "wins",
      type: "overlay.win-counter",
      config: {
        effectId: "overlay_win_add_20",
        operation: "adjust",
        amount: 20,
        duration: 0
      }
    },
    { user: { displayName: "Viewer" } }
  );
  assert.equal(result.amount, 20);
  assert.equal(result.viewer, "Viewer");
  assert.equal(published[0].event, "win-counter");

  const overlayScript = fs.readFileSync(
    path.join(__dirname, "..", "resources", "overlays", "overlay.js"),
    "utf8"
  );
  assert.match(overlayScript, /function updateWinCounter/);
  assert.match(overlayScript, /"win-counter": updateWinCounter/);
  assert.match(overlayScript, /winCounterMultiplier/);
});

test("les interactions WINS synchronisent aussi le compteur natif Minecraft", async () => {
  const published = [];
  const commands = [];
  const state = {
    settings: { tts: {} },
    overlaySession: {
      hasData: true,
      winCounterCurrent: 7,
      winCounterMultiplier: 1,
      winCounterMultiplierUntil: 0
    }
  };
  const runner = new ActionRunner({
    store: { getState: () => state },
    overlayServer: {
      publish: (event, payload) => published.push({ event, payload })
    },
    gameHub: {
      executeMinecraftCommands: async (packId, entries) => {
        commands.push({ packId, entries });
        return { ok: true };
      }
    },
    obsClient: {},
    sourceHub: {},
    spotifyService: {},
    notifyRenderer: () => {}
  });

  const result = await runner.run(
    {
      type: "overlay.win-counter",
      config: {
        packId: "minecraft-bedrock-box",
        operation: "adjust",
        amount: 3
      }
    },
    {}
  );

  assert.equal(result.current, 10);
  assert.equal(result.nativeSynchronized, true);
  assert.deepEqual(commands, [{
    packId: "minecraft-bedrock-box",
    entries: ["shenpulse_win set 10"]
  }]);
});

test("le multiplicateur WINS démarre son overlay dédié et reste centralisé", async () => {
  const published = [];
  const state = {
    settings: { tts: {} },
    overlaySession: {
      hasData: true,
      winCounterCurrent: 7
    }
  };
  const runner = createRunner(published, state);

  await runner.run(
    {
      type: "overlay.win-counter",
      config: {
        packId: "gtav-montchiliad",
        effectId: "overlay_win_x2",
        operation: "multiplier",
        amount: 2,
        duration: 60
      }
    },
    { user: { displayName: "Viewer" } }
  );

  assert.equal(state.overlaySession.winCounterMultiplier, 2);
  assert.equal(
    published.find(({ event }) => event === "multiplier-timer")?.payload.seconds,
    60
  );
  assert.equal(
    published.find(({ event }) => event === "multiplier-timer")?.payload.multiplier,
    2
  );
  assert.equal(
    published.find(({ event }) => event === "win-counter")?.payload.nativeSynchronized,
    true
  );
});

test("la roue utilise ses segments, couleurs, design et réglages persistants", async () => {
  const published = [];
  const state = {
    settings: {
      tts: {},
      overlayConfigs: {
        wheel: {
          selectedWheelId: "wheel_royal",
          wheels: [{
            id: "wheel_royal",
            name: "Roue royale",
            design: "royal",
            settings: { spinDuration: 7, showWinner: true },
            segments: [
              { id: "a", label: "Aide", color: "#f59f00", action: "none" },
              { id: "b", label: "Chaos", color: "#7b1fa2", action: "none" }
            ]
          }]
        }
      }
    },
    rules: []
  };
  const runner = createRunner(published, state);
  const result = await runner.run(
    { id: "spin", type: "wheel.spin", config: { wheelId: "wheel_royal" } },
    {}
  );

  assert.deepEqual(result.choices, ["Aide", "Chaos"]);
  assert.deepEqual(result.colors, ["#f59f00", "#7b1fa2"]);
  assert.equal(result.design, "royal");
  assert.equal(result.settings.spinDuration, 7);
  assert.ok(result.choices.includes(result.winner));
  assert.equal(published[0].event, "wheel");
});

test("la roue exécute l'action liée lorsque le secteur gagnant est affiché", async () => {
  const published = [];
  const scheduled = [];
  const state = {
    settings: {
      tts: {},
      overlayConfigs: {
        wheel: {
          selectedWheelId: "wheel_actions",
          wheels: [{
            id: "wheel_actions",
            enabled: true,
            settings: {
              announceDuration: 5,
              spinDuration: 1,
              waitDuration: 0,
              resultDuration: 1
            },
            segments: [
              {
                id: "linked",
                label: "Google",
                color: "#f59f00",
                action: "none",
                actionId: "linked_action"
              },
              {
                id: "empty",
                label: "Rien",
                color: "#111111",
                action: "none",
                actionId: ""
              }
            ]
          }]
        }
      }
    },
    rules: [{
      id: "rule_linked",
      actions: [{
        id: "linked_action",
        type: "overlay.media",
        config: { mediaUrl: "https://media.test/{{user.displayName}}.png" }
      }]
    }]
  };
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    const runner = createRunner(
      published,
      state,
      () => {},
      {
        setTimeoutImpl: (callback, delay) => {
          const handle = { callback, delay, unref() {} };
          scheduled.push(handle);
          return handle;
        }
      }
    );
    const result = await runner.run(
      { id: "spin", type: "wheel.spin", config: {} },
      { user: { displayName: "Alice" } }
    );

    assert.equal(result.winner, "Google");
    assert.equal(result.winnerAction, "action");
    assert.equal(result.settings.announceDuration, 0);
    assert.equal(
      published.filter(({ event }) => event === "alert").length,
      0
    );

    scheduled.find(({ delay }) => delay === 1000).callback();
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(
      published.find(({ event }) => event === "alert")?.payload.mediaUrl,
      "https://media.test/Alice.png"
    );
  } finally {
    Math.random = originalRandom;
  }
});

test("la roue met les rotations rapprochées en file", async () => {
  const published = [];
  const scheduled = [];
  const state = {
    settings: {
      tts: {},
      overlayConfigs: {
        wheel: {
          selectedWheelId: "wheel_queue",
          wheels: [{
            id: "wheel_queue",
            enabled: true,
            settings: {
              announceDuration: 5,
              spinDuration: 1,
              waitDuration: 0,
              resultDuration: 1
            },
            segments: [
              { id: "a", label: "A", color: "#f59f00" },
              { id: "b", label: "B", color: "#111111" }
            ]
          }]
        }
      }
    },
    rules: []
  };
  const runner = createRunner(
    published,
    state,
    () => {},
    {
      setTimeoutImpl: (callback, delay) => {
        const handle = { callback, delay, unref() {} };
        scheduled.push(handle);
        return handle;
      }
    }
  );

  await runner.run(
    { id: "spin_one", type: "wheel.spin", config: {} },
    {}
  );
  const queued = await runner.run(
    { id: "spin_two", type: "wheel.spin", config: {} },
    {}
  );

  assert.equal(queued.queued, true);
  assert.equal(published[0].payload.settings.announceDuration, 0);
  assert.equal(published.filter(({ event }) => event === "wheel").length, 1);

  scheduled.find(({ delay }) => delay === 2700).callback();
  await Promise.resolve();

  assert.equal(published.filter(({ event }) => event === "wheel").length, 2);
});

test("la roue ignore toutes les configurations désactivées", async () => {
  const published = [];
  const state = {
    settings: {
      tts: {},
      overlayConfigs: {
        wheel: {
          selectedWheelId: "wheel_disabled",
          wheels: [
            {
              id: "wheel_disabled",
              name: "Roue désactivée",
              enabled: false,
              segments: [
                { id: "a", label: "Interdit A", color: "#111111" },
                { id: "b", label: "Interdit B", color: "#222222" }
              ]
            },
            {
              id: "wheel_enabled",
              name: "Roue active",
              enabled: true,
              segments: [
                { id: "c", label: "Actif A", color: "#33aa66" },
                { id: "d", label: "Actif B", color: "#44bb77" }
              ]
            }
          ]
        }
      }
    },
    rules: []
  };
  const runner = createRunner(published, state);
  const result = await runner.run(
    { id: "spin", type: "wheel.spin", config: { wheelId: "wheel_disabled" } },
    {}
  );

  assert.equal(result.wheelId, "wheel_enabled");
  assert.deepEqual(result.choices, ["Actif A", "Actif B"]);
  assert.equal(published.length, 1);

  state.settings.overlayConfigs.wheel.wheels[1].enabled = false;
  await assert.rejects(
    runner.run({ id: "spin", type: "wheel.spin", config: {} }, {}),
    /Aucune roue active/
  );
  assert.equal(published.length, 1);
});

test("les actions Media ciblent une file d'ecran et conservent l'ancien alias", async () => {
  const published = [];
  const runner = createRunner(published);

  await runner.run(
    {
      id: "media-screen-4",
      type: "overlay.media",
      config: { title: "Video", screen: 4 }
    },
    {}
  );
  await runner.run(
    {
      id: "legacy-alert",
      type: "overlay.alert",
      config: { title: "Ancienne alerte" }
    },
    {}
  );
  await runner.run(
    {
      id: "media-screen-clamped",
      type: "overlay.media",
      config: { title: "Ecran maximal", screen: 99 }
    },
    {}
  );

  assert.deepEqual(
    published.map(({ event, payload }) => [event, payload.screen]),
    [
      ["alert", 4],
      ["alert", 1],
      ["alert", 8]
    ]
  );
  assert.deepEqual(
    published.map(({ payload }) => payload.displayMode),
    ["media-only", "media-only", "media-only"]
  );
  assert.equal(
    published.some(({ payload }) => payload.title || payload.message || payload.color),
    false
  );

  const overlayScript = fs.readFileSync(
    path.join(__dirname, "..", "resources", "overlays", "overlay.js"),
    "utf8"
  );
  assert.match(overlayScript, /parameters\.has\("screen"\)/);
  assert.match(overlayScript, /payloadScreen !== mediaScreen/);
  assert.match(overlayScript, /payload\.displayMode === "media-only"/);
  assert.match(overlayScript, /class="alert-media-only"/);
});
