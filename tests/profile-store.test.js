"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  createDefaultOverlayConfigs,
  createDefaultState
} = require("../src/main/defaults");
const {
  StateStore,
  normalizeRules,
  normalizeWheelSegmentActions
} = require("../src/main/store");

function createStore(directory) {
  return new StateStore(directory, {
    isEncryptionAvailable: () => false
  });
}

test("une règle exclusivement TTS est toujours normalisée sur les commentaires", () => {
  const [rule] = normalizeRules([
    {
      id: "legacy_tts",
      trigger: { enabled: false, type: "gift", threshold: 25 },
      conditions: [
        { field: "data.giftName", operator: "equals", value: "Rose" }
      ],
      cooldown: { globalMs: 5000, perUserMs: 10000 },
      actions: [{ id: "speak", type: "tts.speak", config: {} }]
    }
  ]);

  assert.deepEqual(rule.trigger, {
    enabled: true,
    type: "chat",
    source: "*",
    threshold: 1
  });
  assert.deepEqual(rule.conditions, []);
  assert.deepEqual(rule.cooldown, { globalMs: 0, perUserMs: 0 });
});

test("une règle mixte conserve le déclencheur de ses autres actions", () => {
  const [rule] = normalizeRules([
    {
      id: "mixed_rule",
      trigger: { type: "gift", threshold: 2 },
      conditions: [
        { field: "data.giftName", operator: "equals", value: "Rose" }
      ],
      actions: [
        { id: "sound", type: "audio.play", config: {} },
        { id: "legacy_speak", type: "tts.speak", config: {} }
      ]
    }
  ]);

  assert.equal(rule.trigger.type, "gift");
  assert.equal(rule.trigger.threshold, 2);
  assert.equal(rule.conditions.length, 1);
});

test("une action choisie suffit à activer le secteur de roue", () => {
  const wheels = [{
    id: "wheel",
    segments: [
      { id: "action", action: "none", actionId: "action_google" },
      { id: "spin", action: "spin", actionId: "action_ignored" },
      { id: "display", action: "none", actionId: "" }
    ]
  }];

  normalizeWheelSegmentActions(wheels);

  assert.equal(wheels[0].segments[0].action, "action");
  assert.equal(wheels[0].segments[1].action, "spin");
  assert.equal(wheels[0].segments[2].action, "none");
});

test("un nouveau profil est vierge, indépendant et conserve les droits du compte", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "shenpulse-profile-test-")
  );
  const store = createStore(directory);

  try {
    let state = store.load();
    assert.deepEqual(state.rules, []);
    assert.deepEqual(state.goals, []);
    assert.deepEqual(state.commands, []);
    assert.deepEqual(state.timers, []);

    store.upsert("rules", {
      id: "rule_starter",
      name: "Action du profil de démarrage",
      enabled: true,
      trigger: { type: "follow" },
      actions: [{ type: "tts", config: { text: "Bonjour" } }]
    });
    store.upsert("goals", {
      id: "goal_starter",
      name: "Objectif du profil de démarrage"
    });
    store.upsert("commands", {
      id: "command_starter",
      command: "!bonjour"
    });
    store.upsert("timers", {
      id: "timer_starter",
      name: "Timer du profil de démarrage",
      intervalMs: 60000,
      actionIds: []
    });
    store.set(
      "settings.overlayConfigs.wheel.title",
      "Roue du profil de démarrage"
    );
    store.set("game.connectorOverrides.coin-pusher", { port: 3210 });
    store.set("game.interactionCatalogVersions.gtav-montchiliad", 10);
    store.upsertGameInteraction("gtav-montchiliad", {
      id: "game_rule_starter",
      name: "Interaction GTA du profil de démarrage",
      enabled: true,
      gameInteraction: { title: "Interaction GTA" },
      trigger: { type: "gift" },
      actions: [
        {
          id: "game_action_starter",
          type: "game.effect",
          config: {
            packId: "gtav-montchiliad",
            effectId: "chaos_heal"
          }
        }
      ]
    });

    store.mutate((draft) => {
      draft.commerce.subscription = {
        ...draft.commerce.subscription,
        tier: "pro",
        status: "active"
      };
      draft.commerce.gameEntitlements = ["deal-or-no-deal"];
      draft.commerce.trial.email = "shenazen@example.com";
      draft.game.installations["deal-or-no-deal"] = {
        status: "installed"
      };
      draft.customSounds.push({
        id: "sound_global",
        name: "Son personnalisé global"
      });
    }, true);

    store.upsert("profiles", {
      id: "profile_test",
      name: "Jeu test",
      description: "Profil temporaire",
      enabledRuleIds: ["rule_starter"],
      workspace: {
        rules: [{ id: "rule_copied_by_renderer" }]
      }
    });
    state = store.getState();
    const created = state.profiles.find(
      (profile) => profile.id === "profile_test"
    );
    assert.deepEqual(created.workspace.rules, []);
    assert.deepEqual(created.workspace.goals, []);
    assert.deepEqual(created.workspace.commands, []);
    assert.deepEqual(created.workspace.timers, []);
    assert.deepEqual(created.enabledRuleIds, []);

    store.selectProfile("profile_test");
    state = store.getState();
    assert.deepEqual(state.rules, []);
    assert.deepEqual(state.goals, []);
    assert.deepEqual(state.commands, []);
    assert.deepEqual(state.timers, []);
    assert.equal(
      state.settings.overlayConfigs.wheel.title,
      createDefaultOverlayConfigs().wheel.title
    );
    assert.deepEqual(state.game.connectorOverrides, {});
    assert.deepEqual(state.game.interactionCatalogVersions, {});
    assert.deepEqual(state.game.interactionRulesByPack, {});
    assert.equal(state.commerce.subscription.tier, "pro");
    assert.deepEqual(state.commerce.gameEntitlements, ["deal-or-no-deal"]);
    assert.equal(
      state.game.installations["deal-or-no-deal"].status,
      "installed"
    );
    assert.equal(state.customSounds[0].id, "sound_global");

    store.upsert("rules", {
      id: "rule_test",
      name: "Action du profil test",
      enabled: true,
      trigger: { type: "gift" },
      actions: []
    });
    store.upsert("timers", {
      id: "timer_test",
      name: "Timer du profil test",
      intervalMs: 10000,
      actionIds: []
    });
    store.set("settings.overlayConfigs.wheel.title", "Roue du profil test");

    store.selectProfile("profile_starter");
    state = store.getState();
    assert.deepEqual(
      state.rules.map((rule) => rule.id),
      ["rule_starter"]
    );
    assert.deepEqual(
      state.goals.map((goal) => goal.id),
      ["goal_starter"]
    );
    assert.deepEqual(
      state.commands.map((command) => command.id),
      ["command_starter"]
    );
    assert.deepEqual(
      state.timers.map((timer) => timer.id),
      ["timer_starter"]
    );
    assert.equal(
      state.settings.overlayConfigs.wheel.title,
      "Roue du profil de démarrage"
    );
    assert.deepEqual(state.game.connectorOverrides, {
      "coin-pusher": { port: 3210 }
    });
    assert.deepEqual(state.game.interactionCatalogVersions, {
      "gtav-montchiliad": 10
    });
    assert.equal(
      state.game.interactionRulesByPack["gtav-montchiliad"][0].id,
      "game_rule_starter"
    );

    store.selectProfile("profile_test");
    state = store.getState();
    assert.deepEqual(
      state.rules.map((rule) => rule.id),
      ["rule_test"]
    );
    assert.deepEqual(
      state.timers.map((timer) => timer.id),
      ["timer_test"]
    );
    assert.equal(
      state.settings.overlayConfigs.wheel.title,
      "Roue du profil test"
    );

    store.upsert("profiles", {
      ...state.profiles.find((profile) => profile.id === "profile_test"),
      name: "Jeu modifié",
      enabledRuleIds: ["rule_starter"]
    });
    state = store.getState();
    const edited = state.profiles.find(
      (profile) => profile.id === "profile_test"
    );
    assert.equal(edited.name, "Jeu modifié");
    assert.deepEqual(edited.enabledRuleIds, ["rule_test"]);

    store.selectProfile("profile_starter");
    store.remove("profiles", "profile_test");
    assert.equal(
      store.getState().profiles.some(
        (profile) => profile.id === "profile_test"
      ),
      false
    );
    store.flush();
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("la migration répartit les anciennes règles sans perdre les profils", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "shenpulse-profile-migration-")
  );

  try {
    const legacy = createDefaultState();
    legacy.schemaVersion = 1;
    legacy.profiles = [
      {
        id: "profile_a",
        name: "Profil A",
        enabledRuleIds: ["rule_a"]
      },
      {
        id: "profile_b",
        name: "Profil B",
        enabledRuleIds: ["rule_b"]
      }
    ];
    legacy.session.profileId = "profile_a";
    legacy.rules = [
      { id: "rule_a", name: "Règle A" },
      { id: "rule_b", name: "Règle B" },
      {
        id: "legacy_game_rule",
        name: "Ancienne interaction GTA",
        enabled: true,
        gameInteraction: { title: "GTA" },
        actions: [
          {
            id: "legacy_game_action",
            type: "game.effect",
            config: {
              packId: "gtav-montchiliad",
              effectId: "chaos_heal"
            }
          }
        ]
      }
    ];
    legacy.profiles[0].enabledRuleIds.push("legacy_game_rule");
    legacy.goals = [{ id: "goal_legacy", name: "Objectif existant" }];
    legacy.commands = [{ id: "command_legacy", command: "!ancien" }];
    legacy.settings.overlayConfigs.wheel.title = "Ancienne roue";
    fs.writeFileSync(
      path.join(directory, "shenpulse-state.json"),
      JSON.stringify(legacy),
      "utf8"
    );

    const store = createStore(directory);
    let state = store.load();
    assert.deepEqual(state.rules, []);
    store.activateAccount("legacy_owner_uid");
    state = store.getState();
    assert.deepEqual(
      state.rules.map((rule) => rule.id),
      ["rule_a"]
    );
    assert.deepEqual(
      state.game.interactionRulesByPack[
        "gtav-montchiliad"
      ].map((rule) => rule.id),
      ["legacy_game_rule"]
    );
    assert.deepEqual(
      state.profiles
        .find((profile) => profile.id === "profile_b")
        .workspace.rules.map((rule) => rule.id),
      ["rule_b"]
    );

    store.selectProfile("profile_b");
    state = store.getState();
    assert.deepEqual(
      state.rules.map((rule) => rule.id),
      ["rule_b"]
    );
    assert.deepEqual(
      state.goals.map((goal) => goal.id),
      ["goal_legacy"]
    );
    assert.deepEqual(
      state.commands.map((command) => command.id),
      ["command_legacy"]
    );
    assert.equal(
      state.settings.overlayConfigs.wheel.title,
      "Ancienne roue"
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
