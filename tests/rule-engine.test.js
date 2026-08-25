"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  RuleEngine,
  selectRuleActions
} = require("../src/main/rule-engine");

function createStore(rule) {
  return {
    getState() {
      return {
        session: { profileId: "p" },
        profiles: [{ id: "p", enabledRuleIds: [rule.id] }],
        rules: [rule]
      };
    }
  };
}

test("exécute une règle et hydrate son action", async () => {
  const actions = [];
  const rule = {
    id: "r",
    name: "Gift",
    enabled: true,
    priority: 10,
    chance: 1,
    trigger: { type: "gift", source: "*", threshold: 1 },
    conditions: [{ field: "data.giftName", operator: "equals", value: "Rose" }],
    cooldown: { globalMs: 0, perUserMs: 0 },
    actions: [{ id: "a", type: "overlay.alert", config: { title: "{{user.displayName}}" } }]
  };
  const engine = new RuleEngine({
    store: createStore(rule),
    actionRunner: {
      async run(action) {
        actions.push(action);
        return { ok: true };
      }
    }
  });
  await engine.process({
    type: "gift",
    source: "demo",
    user: { id: "1", displayName: "Alice" },
    data: { giftName: "Rose", count: 1 }
  });
  assert.equal(actions.length, 1);
  assert.equal(actions[0].config.title, "Alice");
});

test("déclenche une ancienne règle française sur le cadeau LIVE anglais", async () => {
  const calls = [];
  const imageHash = "2f1e4f3f5c728ffbfa35705b480fdc92";
  const rule = {
    id: "localized_gift",
    name: "Orbeez 1",
    enabled: true,
    chance: 1,
    trigger: { type: "gift", source: "*", threshold: 1 },
    conditions: [
      {
        field: "data.giftName",
        operator: "equals",
        value: "Chapeau et moustache"
      }
    ],
    actions: [{ id: "irl", type: "test", config: {} }]
  };
  const engine = new RuleEngine({
    store: createStore(rule),
    giftCatalog: {
      gifts: [
        {
          id: "hat-and-mustache",
          name: "Chapeau et moustache",
          cost: 99,
          imageUrl: `https://p16.example/${imageHash}~tplv-obj.webp`
        }
      ]
    },
    actionRunner: {
      async run(action) {
        calls.push(action.id);
      }
    }
  });

  await engine.process({
    type: "gift",
    user: { id: "viewer" },
    data: {
      giftId: "",
      giftName: "Hat and Mustache",
      giftImageUrl: `https://p19.example/${imageHash}~tplv-obj.png`,
      value: 99,
      count: 1
    }
  });

  assert.deepEqual(calls, ["irl"]);
});

test("un déclencheur réutilise plusieurs actions existantes", async () => {
  const calls = [];
  const trigger = {
    id: "trigger_group",
    name: "Groupe cadeau",
    enabled: true,
    priority: 10,
    chance: 1,
    trigger: { enabled: true, type: "gift", source: "*", threshold: 1 },
    conditions: [],
    cooldown: { globalMs: 0, perUserMs: 0 },
    actions: [],
    actionSelection: {
      mode: "all",
      actionIds: ["action_first", "action_second"],
      randomCount: 2
    }
  };
  const rules = [
    trigger,
    {
      id: "owner_first",
      enabled: false,
      trigger: { enabled: false },
      actions: [{ id: "action_first", type: "test", config: {} }]
    },
    {
      id: "owner_second",
      enabled: false,
      trigger: { enabled: false },
      actions: [{ id: "action_second", type: "test", config: {} }]
    }
  ];
  const engine = new RuleEngine({
    store: {
      getState() {
        return {
          session: { profileId: "p" },
          profiles: [{ id: "p", enabledRuleIds: [trigger.id] }],
          rules
        };
      }
    },
    actionRunner: {
      async run(action) {
        calls.push(action.id);
      }
    }
  });

  await engine.process({
    type: "gift",
    source: "demo",
    user: { id: "viewer" },
    data: { giftName: "Rose", count: 1 }
  });

  assert.deepEqual(calls, ["action_first", "action_second"]);
});

test("le mode aléatoire tire exactement le nombre obligatoire sans doublon", () => {
  const rules = Array.from({ length: 5 }, (_value, index) => ({
    id: `owner_${index + 1}`,
    actions: [
      { id: `action_${index + 1}`, type: "test", config: {} }
    ]
  }));
  const selected = selectRuleActions(
    {
      actionSelection: {
        mode: "random",
        actionIds: rules.map((rule) => rule.actions[0].id),
        randomCount: 3
      }
    },
    rules,
    () => 0.25
  );

  assert.equal(selected.length, 3);
  assert.equal(new Set(selected.map((action) => action.id)).size, 3);
  assert.ok(
    selected.every((action) => /^action_[1-5]$/.test(action.id))
  );
});

test("filtre tous les cadeaux par valeur sans imposer un cadeau précis", async () => {
  const executions = [];
  const rule = {
    id: "gift_value_filter",
    name: "Cadeaux de 500 pièces ou plus",
    enabled: true,
    priority: 10,
    chance: 1,
    trigger: { type: "gift", source: "*", threshold: 1 },
    conditions: [
      { field: "data.value", operator: "greaterOrEqual", value: 500 }
    ],
    cooldown: { globalMs: 0, perUserMs: 0 },
    actions: [{ id: "premium_gift", type: "test", config: {} }]
  };
  const engine = new RuleEngine({
    store: createStore(rule),
    actionRunner: {
      async run(_action, context) {
        executions.push(context.data.value);
      }
    }
  });

  for (const value of [499, 500, 1200, 0]) {
    await engine.process({
      type: "gift",
      user: { id: `viewer_${value}` },
      data: { giftName: `Cadeau ${value}`, count: 1, value }
    });
  }

  assert.deepEqual(executions, [500, 1200]);
});

test("un déclencheur message du chat ignore tous les autres événements", async () => {
  const events = [];
  const rule = {
    id: "tts_chat",
    name: "Lecture des commentaires",
    enabled: true,
    priority: 10,
    chance: 1,
    trigger: { type: "chat", source: "*", threshold: 1 },
    conditions: [],
    cooldown: { globalMs: 0, perUserMs: 0 },
    actions: [
      {
        id: "tts_comment",
        type: "tts.speak",
        config: { text: "{{data.message}}" }
      }
    ]
  };
  const engine = new RuleEngine({
    store: createStore(rule),
    actionRunner: {
      async run(_action, context) {
        events.push(context);
      }
    }
  });

  for (const type of ["gift", "like", "follow", "share", "subscribe", "join"]) {
    await engine.process({
      type,
      user: { id: "viewer" },
      data: { message: "Ne pas lire", giftName: "Rose", count: 1 }
    });
  }
  await engine.process({
    type: "chat",
    user: { id: "viewer" },
    data: { message: "Le seul commentaire à lire" }
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].type, "chat");
  assert.equal(events[0].data.message, "Le seul commentaire à lire");
});

test("exécute chaque cadeau d'un lot comme une interaction distincte", async () => {
  const executions = [];
  const rule = {
    id: "gift_batch",
    name: "Lot de Roses",
    enabled: true,
    priority: 10,
    chance: 1,
    trigger: { type: "gift", source: "*", threshold: 1 },
    conditions: [
      { field: "data.giftName", operator: "equals", value: "Rose" }
    ],
    cooldown: { globalMs: 60_000, perUserMs: 60_000 },
    actions: [{ id: "rose_action", type: "test", config: {} }]
  };
  const engine = new RuleEngine({
    store: createStore(rule),
    actionRunner: {
      async run(_action, context) {
        executions.push(context);
      }
    }
  });

  await engine.process({
    id: "gift_event",
    type: "gift",
    source: "simulator",
    user: { id: "viewer", displayName: "Alice" },
    data: { giftName: "Rose", count: 5 }
  });

  assert.equal(executions.length, 5);
  assert.deepEqual(
    executions.map((context) => context.data.count),
    [1, 1, 1, 1, 1]
  );
  assert.deepEqual(
    executions.map((context) => context.data.batchIndex),
    [1, 2, 3, 4, 5]
  );
  assert.equal(executions[0].data.batchCount, 5);
  assert.equal(new Set(executions.map((context) => context.id)).size, 5);
});

test("conserve le reste d'un lot lorsque le seuil cadeau dépasse un", async () => {
  const executions = [];
  const rule = {
    id: "gift_threshold",
    name: "Deux Roses",
    enabled: true,
    chance: 1,
    trigger: { type: "gift", source: "*", threshold: 2 },
    conditions: [],
    cooldown: {},
    actions: [{ id: "pair_action", type: "test", config: {} }]
  };
  const engine = new RuleEngine({
    store: createStore(rule),
    actionRunner: {
      async run(_action, context) {
        executions.push(context.data.count);
      }
    }
  });
  const event = {
    id: "gift_threshold_event",
    type: "gift",
    user: { id: "viewer" },
    data: { count: 5 }
  };

  await engine.process(event);
  await engine.process({
    ...event,
    id: "gift_threshold_event_2",
    data: { count: 1 }
  });

  assert.deepEqual(executions, [2, 2, 2]);
});

test("un cooldown ne jette pas les cadeaux envoyés séparément", async () => {
  let calls = 0;
  const rule = {
    id: "gift_cooldown",
    name: "Cadeaux rapprochés",
    enabled: true,
    chance: 1,
    trigger: { type: "gift", source: "*", threshold: 1 },
    conditions: [],
    cooldown: { globalMs: 60_000, perUserMs: 60_000 },
    actions: [{ id: "gift_action", type: "test", config: {} }]
  };
  const engine = new RuleEngine({
    store: createStore(rule),
    actionRunner: {
      async run() {
        calls += 1;
      }
    }
  });
  const event = {
    type: "gift",
    user: { id: "viewer" },
    data: { count: 1 }
  };

  await engine.process({ ...event, id: "gift_one" });
  await engine.process({ ...event, id: "gift_two" });

  assert.equal(calls, 2);
});

test("respecte le seuil cumulatif", async () => {
  let calls = 0;
  const rule = {
    id: "r2",
    name: "Likes",
    enabled: true,
    trigger: { type: "like", source: "*", threshold: 10 },
    conditions: [],
    cooldown: {},
    chance: 1,
    actions: [{ id: "a", type: "test", config: {} }]
  };
  const engine = new RuleEngine({
    store: createStore(rule),
    actionRunner: { async run() { calls += 1; } }
  });
  const base = { type: "like", source: "demo", user: { id: "1" }, data: { count: 4 } };
  await engine.process(base);
  await engine.process(base);
  assert.equal(calls, 0);
  await engine.process({ ...base, data: { count: 3 } });
  assert.equal(calls, 1);
});

test("cumule le seuil de likes entre tous les spectateurs", async () => {
  let calls = 0;
  const rule = {
    id: "r_global_likes",
    name: "Likes du LIVE",
    enabled: true,
    trigger: { type: "like", source: "*", threshold: 10 },
    conditions: [],
    cooldown: {},
    chance: 1,
    actions: [{ id: "a", type: "test", config: {} }]
  };
  const engine = new RuleEngine({
    store: createStore(rule),
    actionRunner: { async run() { calls += 1; } }
  });

  await engine.process({
    type: "like",
    user: { id: "alice" },
    data: { count: 4 }
  });
  await engine.process({
    type: "like",
    user: { id: "bob" },
    data: { count: 4 }
  });
  await engine.process({
    type: "like",
    user: { id: "charlie" },
    data: { count: 3 }
  });

  assert.equal(calls, 1);
});

test("exécute chaque tapotage d'un lot comme une interaction distincte", async () => {
  const executions = [];
  const rule = {
    id: "like_batch",
    name: "Tapotages rapprochés",
    enabled: true,
    trigger: { type: "like", source: "*", threshold: 1 },
    conditions: [],
    cooldown: { globalMs: 60_000, perUserMs: 60_000 },
    chance: 1,
    actions: [{ id: "tap_action", type: "test", config: {} }]
  };
  const engine = new RuleEngine({
    store: createStore(rule),
    actionRunner: {
      async run(_action, context) {
        executions.push(context);
      }
    }
  });

  await engine.process({
    id: "like_event",
    type: "like",
    source: "tiktok-direct",
    user: { id: "viewer", displayName: "Alice" },
    data: { count: 5 }
  });

  assert.equal(executions.length, 5);
  assert.deepEqual(
    executions.map((context) => context.data.count),
    [1, 1, 1, 1, 1]
  );
  assert.deepEqual(
    executions.map((context) => context.data.batchIndex),
    [1, 2, 3, 4, 5]
  );
  assert.equal(executions[0].data.batchCount, 5);
  assert.equal(new Set(executions.map((context) => context.id)).size, 5);
});

test("exécute immédiatement tous les paliers de likes franchis par une rafale", async () => {
  const executions = [];
  const rule = {
    id: "like_threshold_batch",
    name: "Likes par groupes de dix",
    enabled: true,
    trigger: { type: "like", source: "*", threshold: 10 },
    conditions: [],
    cooldown: { globalMs: 60_000, perUserMs: 60_000 },
    chance: 1,
    actions: [{ id: "like_action", type: "test", config: {} }]
  };
  const engine = new RuleEngine({
    store: createStore(rule),
    actionRunner: {
      async run(_action, context) {
        executions.push(context.data);
      }
    }
  });

  await engine.process({
    id: "like_burst_1",
    type: "like",
    user: { id: "alice" },
    data: { count: 25 }
  });
  await engine.process({
    id: "like_burst_2",
    type: "like",
    user: { id: "bob" },
    data: { count: 5 }
  });

  assert.equal(executions.length, 3);
  assert.deepEqual(
    executions.map((data) => data.count),
    [10, 10, 10]
  );
  assert.deepEqual(
    executions.map((data) => data.batchCount),
    [25, 25, 5]
  );
});

test("une action lente ne bloque pas les événements suivants", async () => {
  let releaseSlowAction;
  const slowAction = new Promise((resolve) => {
    releaseSlowAction = resolve;
  });
  const calls = [];
  const rules = [
    {
      id: "slow_rule",
      name: "Lente",
      enabled: true,
      trigger: { type: "gift", threshold: 1 },
      conditions: [{ field: "user.id", operator: "equals", value: "slow" }],
      cooldown: {},
      chance: 1,
      actions: [{ id: "slow", type: "test", config: {} }]
    },
    {
      id: "fast_rule",
      name: "Rapide",
      enabled: true,
      trigger: { type: "gift", threshold: 1 },
      conditions: [{ field: "user.id", operator: "equals", value: "fast" }],
      cooldown: {},
      chance: 1,
      actions: [{ id: "fast", type: "test", config: {} }]
    }
  ];
  const engine = new RuleEngine({
    store: {
      getState() {
        return {
          session: { profileId: "p" },
          profiles: [{ id: "p", enabledRuleIds: rules.map((rule) => rule.id) }],
          rules
        };
      }
    },
    actionRunner: {
      async run(action) {
        calls.push(action.id);
        if (action.id === "slow") await slowAction;
      }
    }
  });

  const slow = engine.process({
    type: "gift",
    user: { id: "slow" },
    data: { count: 1 }
  });
  await Promise.resolve();
  await engine.process({
    type: "gift",
    user: { id: "fast" },
    data: { count: 1 }
  });

  assert.deepEqual(calls, ["slow", "fast"]);
  releaseSlowAction();
  await slow;
});

test("ignore un déclencheur automatique désactivé tout en gardant son action testable", async () => {
  let calls = 0;
  const rule = {
    id: "r_manual",
    name: "Action manuelle",
    enabled: true,
    trigger: { enabled: false, type: "gift", source: "*", threshold: 1 },
    conditions: [],
    cooldown: {},
    chance: 1,
    actions: [{ id: "a_manual", type: "test", config: {} }]
  };
  const engine = new RuleEngine({
    store: createStore(rule),
    actionRunner: {
      async run() {
        calls += 1;
      }
    }
  });

  const event = {
    type: "gift",
    source: "demo",
    user: { id: "1" },
    data: { giftName: "Rose", count: 1 }
  };
  await engine.process(event);
  assert.equal(calls, 0);

  await engine.test(rule.id, event);
  assert.equal(calls, 1);
});

test("écoute toujours toutes les sources même avec une ancienne valeur enregistrée", async () => {
  let calls = 0;
  const rule = {
    id: "r_all_sources",
    name: "Toutes les sources",
    enabled: true,
    trigger: {
      enabled: true,
      type: "gift",
      source: "ancienne_source_filtrée",
      threshold: 1
    },
    conditions: [],
    cooldown: {},
    chance: 1,
    actions: [{ id: "a_all_sources", type: "test", config: {} }]
  };
  const engine = new RuleEngine({
    store: createStore(rule),
    actionRunner: {
      async run() {
        calls += 1;
      }
    }
  });

  await engine.process({
    type: "gift",
    source: "simulator",
    user: { id: "1" },
    data: { count: 1 }
  });
  assert.equal(calls, 1);
});

test("teste une règle précise sans seuil, condition ni cooldown", async () => {
  const actions = [];
  const rule = {
    id: "r3",
    name: "Test ciblé",
    enabled: false,
    trigger: { type: "gift", source: "source_tiktok", threshold: 999 },
    conditions: [
      { field: "data.giftName", operator: "equals", value: "Galaxy" }
    ],
    cooldown: { globalMs: 60000, perUserMs: 60000 },
    chance: 0,
    actions: [
      {
        id: "a3",
        type: "overlay.alert",
        config: { title: "{{user.displayName}} · {{data.giftName}}" }
      }
    ]
  };
  const engine = new RuleEngine({
    store: createStore(rule),
    actionRunner: {
      async run(action) {
        actions.push(action);
      }
    }
  });
  await engine.test("r3", {
    type: "gift",
    source: "rule-test",
    user: { id: "viewer", displayName: "Alice" },
    data: { giftName: "Rose", count: 1 }
  });
  assert.equal(actions.length, 1);
  assert.equal(actions[0].config.title, "Alice · Rose");
});

test("exécute les interactions du seul jeu dont la session est active", async () => {
  let calls = 0;
  const gameRule = {
    id: "game_rule",
    name: "Interaction du jeu",
    enabled: true,
    trigger: { enabled: true, type: "gift", threshold: 1 },
    conditions: [],
    cooldown: {},
    chance: 1,
    gameInteraction: { title: "Effet" },
    actions: [
      {
        id: "game_action",
        type: "game.effect",
        config: { packId: "game_a", effectId: "effect_a" }
      }
    ]
  };
  const state = {
    session: {
      profileId: "p",
      game: {
        running: false,
        packId: "",
        profileId: "",
        startedAt: null
      }
    },
    profiles: [{ id: "p", enabledRuleIds: [] }],
    rules: [],
    game: {
      interactionRulesByPack: {
        game_a: [gameRule]
      }
    }
  };
  const engine = new RuleEngine({
    store: { getState: () => state },
    actionRunner: {
      async run() {
        calls += 1;
      }
    }
  });
  const event = {
    type: "gift",
    user: { id: "viewer" },
    data: { giftName: "Rose", count: 3 }
  };

  await engine.process(event);
  assert.equal(calls, 0);

  state.session.game = {
    running: true,
    packId: "game_a",
    profileId: "p",
    startedAt: new Date().toISOString()
  };
  await engine.process(event);
  assert.equal(calls, 3);

  state.session.game.packId = "game_b";
  await engine.process(event);
  assert.equal(calls, 3);
});
