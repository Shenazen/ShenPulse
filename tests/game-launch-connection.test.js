"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { waitForGameConnection } = require("../src/main/game-hub/connection-ready");
const { registerGamesIpc } = require("../src/main/ipc/games");

function fixture(statuses, timeout = 500) {
  let elapsed = 0, calls = 0;
  const pack = { name: "Crash", connector: { launchConnectionTimeoutMs: timeout } };
  const hub = {
    assertAccess() { return pack; },
    async prepareConnection() { return statuses[Math.min(calls++, statuses.length - 1)]; }
  };
  return { hub, pack, options: { now: () => elapsed, sleep: async ms => { elapsed += ms; }, intervalMs: 100 }, calls: () => calls };
}

test("le lancement Crash attend le pont connecté après l’ouverture du serveur", async () => {
  const f = fixture([{ listening: true, connected: false }, { listening: true, connected: false }, { listening: true, connected: true }]);
  assert.equal((await waitForGameConnection(f.hub, "crash", f.options)).connected, true);
  assert.equal(f.calls(), 3);
});

test("un pont absent ne produit pas un faux lancement réussi et le délai est borné", async () => {
  const f = fixture([{ listening: true, connected: false }]);
  await assert.rejects(waitForGameConnection(f.hub, "crash", f.options), /pont local.*connexion/);
  assert.equal(f.calls(), 5);
});

test("les autres jeux ne reçoivent pas d’attente supplémentaire", async () => {
  const f = fixture([{ listening: true, connected: false }], 0);
  assert.equal(await waitForGameConnection(f.hub, "other", f.options), undefined);
  assert.equal(f.calls(), 0);
});

test("la révocation d’accès interrompt l’attente sans nouvelle tentative", async () => {
  const f = fixture([{ listening: true, connected: false }]);
  f.hub.prepareConnection = async () => { throw new Error("Accès révoqué"); };
  await assert.rejects(waitForGameConnection(f.hub, "crash", f.options), /Accès révoqué/);
});

function launchFixture() {
  const handlers = new Map(), order = [];
  let confirm, fail;
  const ready = new Promise((resolve, reject) => { confirm = resolve; fail = reject; });
  registerGamesIpc({ handle: (channel, listener) => handlers.set(channel, listener), store: {},
    requireGameAccess: () => {}, requireGameSessionAvailability: id => id,
    core: {
      gameHub: { prepareConnection: async () => order.push("listen"), waitForConnection: async () => { order.push("wait"); await ready; order.push("connected"); } },
      startGameSession: async () => { order.push("session"); return { fixture: true }; }
    },
    gameRuntime: { launch: async () => { order.push("launch"); return { ok: true }; } }
  });
  return { launch: handlers.get("game:launch"), order, confirm, fail };
}

test("l’IPC ne démarre la session qu’après confirmation de la connexion du pont", async () => {
  const f = launchFixture();
  const launched = f.launch(null, "crash");
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.order, ["listen", "launch", "wait"]);
  f.confirm();
  assert.deepEqual(await launched, { ok: true, snapshot: { fixture: true } });
  assert.deepEqual(f.order, ["listen", "launch", "wait", "connected", "session"]);
});

test("l’IPC ne démarre aucune session si la connexion du pont échoue", async () => {
  const f = launchFixture();
  const launched = f.launch(null, "crash");
  const rejected = assert.rejects(launched, /Pont absent/);
  await new Promise(resolve => setImmediate(resolve));
  f.fail(new Error("Pont absent"));
  await rejected;
  assert.deepEqual(f.order, ["listen", "launch", "wait"]);
});
