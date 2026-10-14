"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const publicStore = require("../src/main/store");
const defaults = require("../src/main/defaults");
const { StateStore } = publicStore;
const { readState, selectStatePaths } = require("../src/main/state-projection");
const { normalizeProfileOverlayConfigs, normalizeWheelSegmentActions } = require("../src/main/state/overlay-configs");
const { normalizeRules, normalizeRuleActionSelection } = require("../src/main/state/rule-normalization");
const { normalizeProfileWorkspace, captureProfileWorkspace } = require("../src/main/state/profile-workspace");
const sceneLayout = require("../resources/overlays/scene-layout");
const { normalizeMatchesConfig } = require("../src/shared/matches-contract");

function createStore(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-state-architecture-"));
  const store = new StateStore(directory, { isEncryptionAvailable: () => false });
  store.load();
  t.after(() => {
    store.flush();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return store;
}

test("les façades CommonJS conservent exactement leurs exports publics", () => {
  assert.deepEqual(Object.keys(publicStore).sort(), [
    "StateStore", "normalizeRuleActionSelection", "normalizeRules", "normalizeWheelSegmentActions"
  ]);
  assert.deepEqual(Object.keys(defaults).sort(), [
    "createDefaultOverlayConfigs", "createDefaultState", "createEmptyProfileWorkspace"
  ]);
  assert.equal(publicStore.normalizeRules, normalizeRules);
  assert.equal(publicStore.normalizeRuleActionSelection, normalizeRuleActionSelection);
  assert.equal(publicStore.normalizeWheelSegmentActions, normalizeWheelSegmentActions);
});

test("les fabriques déplacées conservent leurs valeurs et ne partagent aucun objet mutable", () => {
  const first = defaults.createDefaultState();
  const second = defaults.createDefaultState();
  assert.equal(first.schemaVersion, 2);
  assert.equal(first.settings.overlayConfigs.likeGoal.schemaVersion, 2);
  assert.equal(first.settings.overlayConfigs.wheel.schemaVersion, 11);
  assert.notEqual(first.settings.apiToken, second.settings.apiToken);
  assert.notEqual(first.settings.overlayToken, second.settings.overlayToken);
  first.settings.overlayConfigs.wheel.wheels[0].segments[0].label = "Modifié";
  first.profiles[0].workspace.overlayConfigs.likeGoal.title = "Autre titre";
  assert.notEqual(second.settings.overlayConfigs.wheel.wheels[0].segments[0].label, "Modifié");
  assert.notEqual(first.settings.overlayConfigs.likeGoal.title, "Autre titre");
  assert.notEqual(second.profiles[0].workspace.overlayConfigs.likeGoal.title, "Autre titre");
});

test("le même normaliseur d'overlays sert au chargement global et à chaque profil", (t) => {
  const store = createStore(t);
  const legacy = {
    likeGoal: {
      schemaVersion: 1, scale: 60,
      textColor: "#123456", secondaryColor: "#abcdef", title: "Objectif historique"
    },
    wheel: {
      schemaVersion: 1, choices: ["Un", "Deux", "Trois"], colors: ["#ffffff"],
      title: "Roue historique", design: "royal"
    }
  };
  const original = structuredClone(legacy);
  const expected = normalizeProfileOverlayConfigs(legacy);
  const state = defaults.createDefaultState();
  state.settings.overlayConfigs = legacy;
  state.profiles[0].workspace = undefined;
  fs.writeFileSync(store.filePath, JSON.stringify(state), "utf8");
  store.load();
  store.activateAccount("legacy_overlay_owner");
  assert.deepEqual(store.getState().settings.overlayConfigs, expected);
  assert.deepEqual(normalizeProfileWorkspace({ overlayConfigs: legacy }).overlayConfigs, expected);
  assert.deepEqual(legacy, original);
  assert.equal(expected.likeGoal.scale, 100);
  assert.equal(expected.likeGoal.likeGoalTitleColor, "#123456");
  assert.equal(expected.likeGoal.likeGoalContentColor, "#123456");
  assert.equal(expected.likeGoal.likeGoalPercentColor, "#abcdef");
  assert.deepEqual(expected.wheel.wheels[0].segments.map((segment) => segment.label), ["Un", "Deux", "Trois"]);
});

test("la capture mutualisée conserve tous les champs historiques et ajoute Matchs isolé par profil", () => {
  const state = defaults.createDefaultState();
  state.rules = [{ id: "tts", actions: [{ type: "tts.speak" }], trigger: { type: "gift" } }];
  state.goals = [{ id: "goal" }];
  state.commands = [{ id: "command", aliases: ["hello"] }];
  state.timers = [{ id: "timer", repeatDelayMs: 5000 }];
  state.settings.matches = normalizeMatchesConfig({ widgets: { wins: { enabled: true, title: "Mes manches" } },
    automations: [{ id: "match-cue", moment: "victory", enabled: false, reaction: { type: "action", actionId: "tts" } }] });
  state.matchSession.session.wins = 3;
  state.matchSession.history = [{ battleId: "observed-battle", endedAtMs: 1790000000000, result: "win", ownScore: 10, rivalScore: 2 }];
  state.game.interactionRulesByPack = { pack: [{ id: "game", actions: [{ type: "game.effect" }] }] };
  state.session.activeGamePackId = " pack ";
  const fixtures = [
    undefined, null, {},
    { rules: [{ id: "older" }], game: { extraSetting: { keep: true } } },
    { game: { connectorOverrides: [], interactionCatalogVersions: [], activeGamePackId: "old", custom: [1, 2] } },
    { game: [{ custom: true }] }
  ];
  for (const previous of fixtures) {
    const current = normalizeProfileWorkspace(previous);
    const expected = {
      ...current,
      rules: structuredClone(state.rules),
      goals: structuredClone(state.goals),
      commands: structuredClone(state.commands),
      timers: structuredClone(state.timers),
      matches: normalizeMatchesConfig(state.settings.matches),
      matchSession: structuredClone(state.matchSession),
      overlayConfigs: structuredClone(state.settings.overlayConfigs),
      overlayScene: sceneLayout.normalizeScene(state.settings.overlayScene),
      game: {
        ...current.game,
        connectorOverrides: structuredClone(state.game.connectorOverrides || {}),
        interactionCatalogVersions: structuredClone(state.game.interactionCatalogVersions || {}),
        interactionRulesByPack: structuredClone(state.game.interactionRulesByPack || {}),
        activeGamePackId: String(state.session.activeGamePackId || "").trim() || "coin-pusher"
      }
    };
    assert.deepEqual(captureProfileWorkspace(state, previous), expected);
  }
  const previous = { game: { custom: { keep: true } } };
  const capture = captureProfileWorkspace(state, previous);
  capture.rules[0].id = "changed";
  capture.game.custom.keep = false;
  capture.game.interactionRulesByPack.pack[0].id = "changed";
  capture.matches.automations[0].reaction.actionId = "changed";
  capture.matchSession.session.wins = 100;
  capture.matchSession.history[0].result = "lose";
  assert.equal(state.rules[0].id, "tts");
  assert.equal(state.game.interactionRulesByPack.pack[0].id, "game");
  assert.equal(previous.game.custom.keep, true);
  assert.equal(state.settings.matches.automations[0].reaction.actionId, "tts");
  assert.equal(state.matchSession.session.wins, 3);
  assert.equal(state.matchSession.history[0].result, "win");
});

test("une modification de configuration ne resynchronise pas deux fois le profil actif", (t) => {
  const store = createStore(t);
  store.activateAccount("single_profile_sync_owner");
  const original = store.workspaces.syncActiveProfileWorkspace.bind(store.workspaces);
  let calls = 0;
  store.workspaces.syncActiveProfileWorkspace = (...args) => { calls += 1; return original(...args); };
  store.touch();
  assert.equal(calls, 1);
  store.mutateRuntime((state) => { state.statistics.lifetimeEvents += 1; });
  assert.equal(calls, 1);
  store.flush();
  assert.equal(calls, 2, "le checkpoint doit encore intégrer les dernières données du LIVE");
  assert.equal(JSON.parse(fs.readFileSync(store.filePath, "utf8")).statistics.lifetimeEvents, 1);
});

test("le repli de projection partage les règles de chemins, formes de tableaux et isolation", (t) => {
  const store = createStore(t);
  store.state.connections = [{ id: "connection", secretId: "local-secret", secret: "never-expose",
    config: { names: ["a", "b"] } }];
  store.secrets["local-secret"] = { value: "synthetic-secret" };
  const legacyStore = { getState: () => store.getState() };
  const requested = ["connections.0.config.names.1", "settings.tiktok.username", "settings.tiktok"];
  const projected = readState(legacyStore, requested);
  assert.deepEqual(projected, store.getStateProjection(requested));
  assert.ok(Array.isArray(projected.connections));
  assert.ok(Array.isArray(projected.connections[0].config.names));
  projected.connections[0].config.names[1] = "modified";
  assert.equal(store.state.connections[0].config.names[1], "b");
  const secretSelection = readState(legacyStore, ["connections.0.secret"]);
  assert.equal(secretSelection.connections[0].hasSecret, true);
  assert.equal(secretSelection.connections[0].secret, undefined);
  for (const paths of [
    ["accountWorkspaces"], ["activeAccountUid"], ["settings.__proto__.polluted"],
    ["settings.constructor"], ["settings..tiktok"], [null], "settings"
  ]) {
    assert.throws(() => readState(legacyStore, paths), TypeError);
  }
  const inherited = { settings: Object.create({ hidden: "inherited" }) };
  assert.equal(selectStatePaths(inherited, ["settings.hidden"]).settings?.hidden, undefined);
  assert.equal({}.polluted, undefined);
});
