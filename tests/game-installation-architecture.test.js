"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { installGame } = require("../src/main/game-runtime/installation");
const { validateTarget } = require("../src/main/game-runtime/target-selection");

function context(overrides = {}) {
  const state = { game: { installations: {} } };
  const phases = [];
  const reads = [];
  const runtime = {
    activeInstalls: new Set(), installProgress: new Map(),
    assertAccess: () => {},
    store: {
      getState() { throw new Error("Une installation ne doit pas copier les profils et le catalogue."); },
      getStateProjection(paths) { reads.push(paths); return structuredClone(state); },
      mutate(fn) { fn(state); }
    },
    pickTarget: async () => "C:\\fixture\\Demonologist",
    validateTarget: async () => {},
    progress(id, entry) { phases.push(entry.phase); runtime.installProgress.set(id, entry); },
    ...overrides
  };
  return { runtime, state, phases, reads };
}

test("un jeu intégré vérifie les droits avant de déléguer son lancement", async () => {
  const calls = [];
  const { runtime } = context({ assertAccess: (id) => calls.push(["access", id]),
    launch: (id) => { calls.push(["launch", id]); return { opened: true }; } });
  assert.deepEqual(await installGame(runtime, "coin-pusher"), { opened: true });
  assert.deepEqual(calls, [["access", "coin-pusher"], ["launch", "coin-pusher"]]);
});

test("la préparation sans téléchargement conserve les métadonnées et libère le suivi", async () => {
  const { runtime, state, phases, reads } = context();
  const result = await installGame(runtime, "demonologist");
  assert.equal(result.setupOnly, true);
  assert.equal(state.game.installations.demonologist.source, "local-setup");
  assert.equal(state.game.installations.demonologist.path, result.path);
  assert.deepEqual(phases, ["prepare", "complete"]);
  assert.deepEqual(reads, [["game.installations"]]);
  assert.equal(runtime.activeInstalls.size, 0);
  assert.equal(runtime.installProgress.size, 0);
});

test("annulation et erreur libèrent le suivi sans enregistrer une installation", async () => {
  const cancelled = context({ pickTarget: async () => "" });
  assert.deepEqual(await installGame(cancelled.runtime, "demonologist"), { canceled: true });
  assert.deepEqual(cancelled.phases, ["prepare", "canceled"]);
  assert.equal(cancelled.runtime.activeInstalls.size, 0);
  assert.deepEqual(cancelled.state.game.installations, {});
  const rejected = context({ validateTarget: async () => { throw new Error("Dossier invalide"); } });
  await assert.rejects(installGame(rejected.runtime, "demonologist"), /Dossier invalide/);
  assert.deepEqual(rejected.phases, ["prepare", "error"]);
  assert.equal(rejected.runtime.activeInstalls.size, 0);
  assert.equal(rejected.runtime.installProgress.size, 0);
  assert.deepEqual(rejected.state.game.installations, {});
});

test("la validation refuse toujours une racine de disque avant toute écriture", async () => {
  const root = require("node:path").parse(process.cwd()).root;
  await assert.rejects(validateTarget({}, root, {}), /racine du disque/);
});
