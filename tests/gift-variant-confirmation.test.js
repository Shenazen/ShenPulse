"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { collectGiftReferenceUpdates, applyGiftReferenceUpdates } = require("../src/main/state/gift-upgrade-migration");
const { giftConditionMatches } = require("../src/shared/gift-identity");

const catalog = [
  { id: "6007", name: "Gants de boxe", cost: 299, alternateIds: ["boxing-gloves"], imageUrl: "boxing-299.png" },
  { id: "12869", name: "Gants de boxe", cost: 1999, imageUrl: "boxing-1999.png" },
  { id: "6890", name: "Love You", cost: 1, alternateIds: ["love-you-6890"], imageUrl: "love-1.png" },
  { id: "6671", name: "Love You", cost: 199, imageUrl: "love-199.png" },
  { id: "15231", name: "Je t'adore", cost: 1, imageUrl: "different-love.png" },
  { id: "8913", name: "Rosa", cost: 10, alternateIds: ["rosa"], imageUrl: "rosa-10.png" },
  { id: "549679", name: "Rosa", cost: 1, imageUrl: "rosa-1.png" },
  { id: "6089", name: "Voiture de sport", cost: 7000, alternateIds: ["sports-car"], imageUrl: "car-7000.png" },
  { id: "13061", name: "Voiture de sport", cost: 4999, imageUrl: "car-4999.png" },
  { id: "5655", name: "Rose", cost: 1, imageUrl: "rose.png" }
];
const selections = [
  { name: "Gants de boxe", cost: 299 }, { name: "Love You", cost: 1 },
  { name: "Rosa", cost: 10 }, { name: "Voiture de sport", cost: 7000 }
];
const options = { confirmedVariants: selections, onlyConfirmed: true };
const clone = (value) => JSON.parse(JSON.stringify(value));
const condition = (name, overrides = {}) => ({ field: "data.giftName", operator: "equals", value: name, ...overrides });
function rule(name) {
  return { id: name, name, enabled: false, trigger: { type: "gift", threshold: 2 },
    conditions: [condition(name)], cooldown: { globalMs: 5000 },
    actions: [{ type: "game.effect", config: { effect: "reset-wins", quantity: 27 } }] };
}

test("les confirmations explicites réparent les quatre homonymes sans modifier les actions", () => {
  const state = { game: { interactionRulesByPack: { game: selections.map((entry) => rule(entry.name)) } } };
  const before = clone(state);
  const updates = collectGiftReferenceUpdates(state, catalog, options);
  assert.deepEqual(state, before);
  applyGiftReferenceUpdates(updates);
  const rules = state.game.interactionRulesByPack.game;
  for (const [index, expected] of [catalog[0], catalog[2], catalog[5], catalog[7]].entries()) {
    assert.equal(rules[index].conditions[0].giftId, expected.id);
    assert.equal(rules[index].conditions[0].giftCost, expected.cost);
    assert.equal(rules[index].conditions[0].giftImageUrl, expected.imageUrl);
    assert.deepEqual(rules[index].conditions[0].giftIds, expected.alternateIds);
    assert.deepEqual(rules[index].actions, before.game.interactionRulesByPack.game[index].actions);
    assert.deepEqual(rules[index].cooldown, before.game.interactionRulesByPack.game[index].cooldown);
    assert.deepEqual(rules[index].trigger, before.game.interactionRulesByPack.game[index].trigger);
    assert.equal(rules[index].enabled, false);
  }
  assert.equal(collectGiftReferenceUpdates(state, catalog, options).length, 0);
});

test("la migration automatique ne choisit jamais les prix confirmés pour un autre utilisateur", () => {
  const state = { rules: selections.map((entry) => rule(entry.name)) };
  const before = clone(state);
  assert.equal(collectGiftReferenceUpdates(state, catalog).length, 0);
  assert.deepEqual(state, before);
});

test("une confirmation ne remplace ni ID connu ou inconnu, ni alias, ni prix précis différent", () => {
  const conditions = [
    condition("Rosa", { giftId: "549679", giftImageUrl: "saved.png" }),
    condition("Rosa", { giftId: "retired", giftImageUrl: "saved.png" }),
    condition("Rosa", { giftIds: ["rosa"], giftImageUrl: "saved.png" }),
    condition("Rosa", { giftCost: 1, giftImageUrl: "saved.png" }),
    condition("Rosa", { operator: "contains" }), condition("Rose")
  ];
  const state = { rules: [{ conditions: clone(conditions) }] };
  assert.equal(collectGiftReferenceUpdates(state, catalog, options).length, 0);
  assert.deepEqual(state.rules[0].conditions, conditions);
});

test("les confirmations refusent un prix seul, une variante absente ou ambiguë et un conflit", () => {
  for (const selection of [{ name: "", cost: 1 }, { name: "Rosa", cost: 0 },
    { name: "Rosa", cost: 1.5 }, { name: "Rosa", cost: 999 }, { name: "Rosa", cost: Infinity }]) {
    assert.throws(() => collectGiftReferenceUpdates({ rules: [] }, catalog, { confirmedVariants: [selection] }));
  }
  assert.throws(() => collectGiftReferenceUpdates({}, catalog, {
    confirmedVariants: [{ name: "Rosa", cost: 10 }, { name: "Rosa", cost: 1 }]
  }), /Plusieurs variantes/);
  assert.throws(() => collectGiftReferenceUpdates({}, [...catalog, { ...catalog[5], id: "other" }], {
    confirmedVariants: [{ name: "Rosa", cost: 10 }]
  }), /pas unique/);
});

test("sons, profils, réglages intégrés et roues utilisent la même confirmation, pas les historiques", () => {
  const state = { rules: [rule("Love You")], profiles: [{ workspace: { rules: [rule("Rosa")] } }],
    game: { connectorOverrides: { "coin-pusher": {
      giftRules: [{ name: "Gants de boxe", cost: 0, image: "", quantity: 42 }],
      queue: [{ name: "Gants de boxe", image: "old.png" }]
    } } }, settings: { overlayConfigs: { wheel: { wheels: [
      { trigger: "Voiture de sport", segments: [{ label: "Garder", weight: 2 }] },
      { trigger: "Rosa", triggerGift: { giftImageUrl: "wrong.png" } },
      { trigger: "Rosa", giftValueFilter: { value: 10 } }, { trigger: "Rose" }
    ] } } } };
  const before = clone(state);
  applyGiftReferenceUpdates(collectGiftReferenceUpdates(state, catalog, options));
  assert.equal(state.rules[0].conditions[0].giftId, "6890");
  assert.equal(state.profiles[0].workspace.rules[0].conditions[0].giftId, "8913");
  const integrated = state.game.connectorOverrides["coin-pusher"];
  assert.equal(integrated.giftRules[0].giftId, "6007");
  assert.equal(integrated.giftRules[0].image, "boxing-299.png");
  assert.equal(integrated.giftRules[0].quantity, 42);
  assert.equal(integrated.giftRules[0].cost, 0);
  assert.deepEqual(integrated.queue, before.game.connectorOverrides["coin-pusher"].queue);
  const wheels = state.settings.overlayConfigs.wheel.wheels;
  assert.equal(wheels[0].triggerGift.giftId, "6089");
  assert.equal(wheels[0].triggerGift.giftCost, 7000);
  assert.deepEqual(wheels[0].segments, before.settings.overlayConfigs.wheel.wheels[0].segments);
  assert.equal(wheels[1].triggerGift.giftId, "8913");
  assert.deepEqual(wheels.slice(2), before.settings.overlayConfigs.wheel.wheels.slice(2));
});

test("les déclenchements après confirmation acceptent le bon ID et refusent les autres variantes", () => {
  const state = { rules: selections.map((entry) => rule(entry.name)) };
  applyGiftReferenceUpdates(collectGiftReferenceUpdates(state, catalog, options));
  for (const [index, good, bad] of [[0, catalog[0], catalog[1]], [1, catalog[2], catalog[3]],
    [2, catalog[5], catalog[6]], [3, catalog[7], catalog[8]]]) {
    const expected = state.rules[index].conditions[0];
    assert.equal(giftConditionMatches(expected, { data: { giftId: good.id, giftName: good.name, giftCost: good.cost } }, catalog), true);
    assert.equal(giftConditionMatches(expected, { data: { giftId: bad.id, giftName: bad.name, giftCost: bad.cost } }, catalog), false);
  }
  assert.equal(giftConditionMatches(state.rules[1].conditions[0], {
    data: { giftId: "15231", giftName: "Je t'adore", giftCost: 1 }
  }, catalog), false);
});
