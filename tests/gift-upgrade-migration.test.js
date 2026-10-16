"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createDefaultState } = require("../src/main/defaults");
const { StateStore } = require("../src/main/store");
const { GiftCatalog } = require("../src/main/catalogs");
const { accountWorkspaceKey } = require("../src/main/state/account-workspace");
const { collectGiftReferenceUpdates, applyGiftReferenceUpdates } = require("../src/main/state/gift-upgrade-migration");
const { COMMUNITY_HEART_IMAGE_URL } = require("../src/shared/gift-identity");
const { reconcileGiftReferencesSafely } = require("../src/main/core/gift-recovery");

const catalog = [
  { id: "7934", alternateIds: ["heart-me"], name: "Cœur sur moi", cost: 1,
    giftFamily: "community-heart", imageUrl: "https://example.com/heart-current.webp" },
  { id: "6267", alternateIds: ["corgi"], alternateNames: ["Chien Corgi"], name: "Corgi", cost: 299,
    imageUrl: "https://example.com/corgi.webp" },
  { id: "5655", alternateIds: ["rose"], name: "Rose", cost: 1, imageUrl: "https://example.com/rose.webp" },
  { id: "17712", name: "Cœur de la communauté", cost: 1, selectable: false,
    imageUrl: "https://example.com/retired-intertwined.webp" }
];

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function condition(overrides = {}) {
  return { field: "data.giftName", operator: "equals", value: "Heart Me", giftId: "7934",
    giftCost: 17, giftImageUrl: "https://example.com/wrong-heart.webp", ...overrides };
}
function rule(id, actionType = "audio.play") {
  return { id, name: `Réglage ${id}`, enabled: false, trigger: { type: "gift", threshold: 3, source: "*" },
    conditions: [condition(), { field: "data.value", operator: "gte", value: 30 }],
    cooldown: { globalMs: 5000, perUserMs: 1200 },
    actions: [{ id: `${id}_action`, type: actionType, enabled: true, config: { text: "Texte personnalisé", duration: 6 } }],
    actionSelection: { mode: "random", randomCount: 1, actionIds: [`${id}_action`] } };
}
function workspace(tag) {
  return {
    schemaVersion: 1,
    rules: [rule(`${tag}_sound`), rule(`${tag}_irl`, "shelly.switch")],
    goals: [{ id: `${tag}_goal`, current: 37, target: 200 }],
    commands: [{ id: `${tag}_command`, command: "!cadeau" }], timers: [{ id: `${tag}_timer`, intervalSeconds: 60 }],
    overlayConfigs: { wheel: { wheels: [
      { id: `${tag}_wheel`, trigger: "Heart Me", enabled: false,
        triggerGift: { giftId: "7934", giftCost: 17, giftImageUrl: "https://example.com/wrong-heart.webp" },
        segments: [{ id: "segment", label: "Ma récompense", actionId: `${tag}_irl_action`, color: "#123456" }] },
      { id: `${tag}_legacy_wheel`, trigger: "Chien Corgi", segments: [] },
      { id: `${tag}_price_wheel`, trigger: "Rose", giftValueFilter: { operator: "gte", value: 4 },
        triggerGift: { giftId: "7934", giftImageUrl: "https://example.com/keep-price.webp" } }
    ] } },
    game: { activeGamePackId: "coin-pusher", interactionRulesByPack: {
      gta: [{ ...rule(`${tag}_game`, "game.effect"), gameInteraction: true }]
    }, connectorOverrides: {
      "coin-pusher": {
        port: 3000, giftRules: [{ giftId: "corgi", name: "Chien Corgi", image: "", cost: 9, coinCount: 27, enabled: false }],
        guardGift: { giftId: "7934", name: "Heart Me", image: "https://example.com/wrong-heart.webp", cost: 17, seconds: 6 },
        mysteryCube: { name: "Corgi", image: "", cost: 299 }, tickets: { name: "Absent ancien", image: "keep.png", cost: 400 }
      },
      thiercelieux: {
        giftId: "7934", giftName: "Heart Me", giftImage: "https://example.com/wrong-heart.webp", giftValue: 17,
        giftQuantity: 8, queue: [{ giftId: "7934", giftName: "Heart Me", giftImage: "historical.png" }],
        activePlayers: [{ giftId: "7934", name: "Spectateur", image: "avatar.png" }]
      }
    } }
  };
}

test("la préparation ne modifie aucun réglage avant sauvegarde", () => {
  const state = workspace("active");
  const original = clone(state);
  const updates = collectGiftReferenceUpdates(state, catalog);
  assert.ok(updates.length > 0);
  assert.deepEqual(state, original);
  applyGiftReferenceUpdates(updates);
  assert.equal(state.rules[0].conditions[0].giftImageUrl, catalog[0].imageUrl);
  assert.equal(state.rules[0].conditions[0].giftId, "7934");
  assert.equal(state.rules[0].conditions[0].giftFamily, "community-heart");
  assert.ok(state.rules[0].conditions[0].giftIds.includes("heart-me"));
});

test("actions, sons, jeux, roues et réglages intégrés sont réparés sans changer leur logique", () => {
  const state = workspace("active");
  const original = clone(state);
  applyGiftReferenceUpdates(collectGiftReferenceUpdates(state, catalog));
  for (let index = 0; index < state.rules.length; index += 1) {
    const repaired = state.rules[index];
    const previous = original.rules[index];
    assert.deepEqual(repaired.actions, previous.actions);
    assert.deepEqual(repaired.cooldown, previous.cooldown);
    assert.deepEqual(repaired.trigger, previous.trigger);
    assert.deepEqual(repaired.actionSelection, previous.actionSelection);
    assert.equal(repaired.enabled, false);
    assert.equal(repaired.conditions[0].value, previous.conditions[0].value);
    assert.equal(repaired.conditions[0].giftCost, 17);
    assert.deepEqual(repaired.conditions[1], previous.conditions[1]);
  }
  assert.equal(state.game.interactionRulesByPack.gta[0].conditions[0].giftImageUrl, catalog[0].imageUrl);
  const game = state.game.connectorOverrides["coin-pusher"];
  assert.equal(game.giftRules[0].giftId, "corgi");
  assert.equal(game.giftRules[0].image, catalog[1].imageUrl);
  assert.equal(game.giftRules[0].cost, 9);
  assert.equal(game.giftRules[0].coinCount, 27);
  assert.equal(game.guardGift.image, catalog[0].imageUrl);
  assert.equal(game.mysteryCube.giftId, "6267");
  assert.deepEqual(game.tickets, original.game.connectorOverrides["coin-pusher"].tickets);
  assert.equal(state.game.connectorOverrides.thiercelieux.giftImage, catalog[0].imageUrl);
  assert.equal(state.game.connectorOverrides.thiercelieux.giftValue, 17);
  assert.equal(state.game.connectorOverrides.thiercelieux.giftQuantity, 8);
  assert.deepEqual(state.game.connectorOverrides.thiercelieux.queue, original.game.connectorOverrides.thiercelieux.queue);
  assert.deepEqual(state.game.connectorOverrides.thiercelieux.activePlayers, original.game.connectorOverrides.thiercelieux.activePlayers);
  const wheels = state.overlayConfigs.wheel.wheels;
  assert.equal(wheels[0].triggerGift.giftImageUrl, catalog[0].imageUrl);
  assert.equal(wheels[0].triggerGift.giftId, "7934");
  assert.deepEqual(wheels[0].segments, original.overlayConfigs.wheel.wheels[0].segments);
  assert.equal(wheels[1].triggerGift.giftId, "6267");
  assert.deepEqual(wheels[2], original.overlayConfigs.wheel.wheels[2]);
  assert.deepEqual(state.goals, original.goals);
  assert.deepEqual(state.commands, original.commands);
  assert.deepEqual(state.timers, original.timers);
});

test("tous les profils et comptes dormants, y compris l'espace non revendiqué, sont mis à jour", () => {
  const active = workspace("active");
  const state = { ...active, settings: { overlayConfigs: active.overlayConfigs },
    profiles: [{ id: "visible", workspace: workspace("visible") }, { id: "dormant", workspace: workspace("dormant") }],
    accountWorkspaces: { dormant: { ...workspace("account"), ownerUid: "autre-uid",
      profiles: [{ id: "account_dormant", workspace: workspace("account_dormant") }] } },
    unclaimedAccountWorkspace: { ...workspace("unclaimed"), ownerUid: "" } };
  applyGiftReferenceUpdates(collectGiftReferenceUpdates(state, catalog));
  const workspaces = [state, ...state.profiles.map((profile) => profile.workspace), state.accountWorkspaces.dormant,
    state.accountWorkspaces.dormant.profiles[0].workspace, state.unclaimedAccountWorkspace];
  for (const space of workspaces) assert.equal(space.rules[0].conditions[0].giftImageUrl, catalog[0].imageUrl);
  assert.equal(state.accountWorkspaces.dormant.ownerUid, "autre-uid");
  assert.equal(state.unclaimedAccountWorkspace.ownerUid, "");
  const once = JSON.stringify(state);
  assert.equal(collectGiftReferenceUpdates(state, catalog).length, 0);
  assert.equal(JSON.stringify(state), once);
});

test("aucun cadeau retiré, ID inconnu, condition partielle ou prix seul n'est réattribué", () => {
  const candidates = [
    condition({ value: "Rose", giftId: "unknown", giftImageUrl: catalog[2].imageUrl, giftCost: 1 }),
    condition({ value: "Absent ancien", giftId: "old-retired", giftImageUrl: "keep.png" }),
    condition({ value: "Corg", giftId: "", giftCost: 299 }),
    condition({ value: "", giftId: "", giftCost: 299 }),
    condition({ operator: "contains", value: "Rose", giftId: "5655", giftImageUrl: "keep-partial.png" })
  ];
  const state = { rules: [{ conditions: clone(candidates) }] };
  assert.equal(collectGiftReferenceUpdates(state, catalog).length, 0);
  assert.deepEqual(state.rules[0].conditions, candidates);
});

test("une référence exacte garde son image sauvegardée si le catalogue n'en fournit pas", () => {
  const state = { rules: [{ conditions: [condition({ giftId: "6267", value: "Corgi", giftImageUrl: "keep-offline.png" })] }] };
  const withoutImage = catalog.map((gift) => ({ ...gift, imageUrl: "" }));
  applyGiftReferenceUpdates(collectGiftReferenceUpdates(state, withoutImage));
  assert.equal(state.rules[0].conditions[0].giftImageUrl, "keep-offline.png");
  assert.equal(collectGiftReferenceUpdates(state, withoutImage).length, 0);
});

test("le store conserve une sauvegarde permanente avant changement et ne réécrit pas au second passage", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-gift-upgrade-"));
  const store = new StateStore(directory, { isEncryptionAvailable: () => false });
  try {
    store.state = { ...createDefaultState(), rules: workspace("active").rules,
      profiles: [{ id: "starter", name: "Ancien profil", workspace: workspace("old-profile") }] };
    store.state.session.profileId = "starter";
    store.state.accountWorkspaces = {
      [accountWorkspaceKey("dormant")]: { ownerUid: "dormant", ...workspace("account"),
        profiles: [{ id: "sleep", workspace: workspace("sleep") }] }
    };
    const original = clone(store.state);
    const result = store.reconcileGiftReferences(catalog);
    assert.ok(result.changed > 0);
    assert.deepEqual(JSON.parse(fs.readFileSync(result.backupPath, "utf8")), original);
    const backupContent = fs.readFileSync(result.backupPath, "utf8");
    const writtenContent = fs.readFileSync(store.filePath, "utf8");
    const written = JSON.parse(writtenContent);
    assert.equal(written.rules[0].conditions[0].giftImageUrl, catalog[0].imageUrl);
    assert.equal(written.accountWorkspaces[accountWorkspaceKey("dormant")].profiles[0].workspace.rules[0].conditions[0].giftImageUrl, catalog[0].imageUrl);
    assert.equal(store.reconcileGiftReferences(catalog).changed, 0);
    assert.equal(fs.readFileSync(result.backupPath, "utf8"), backupContent);
    assert.equal(fs.readFileSync(store.filePath, "utf8"), writtenContent);
  } finally {
    store.flush();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("une installation déjà migrée et redémarrée remplace encore le cœur doré dans les profils, jeux et roues", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-heart-red-upgrade-"));
  let store = new StateStore(directory, { isEncryptionAvailable: () => false });
  try {
    store.load();
    const refreshTokenSecretId = store.setSecret("", "fixture-heart-session-only");
    store.activateAccount("fixture-heart-account", { uid: "fixture-heart-account", refreshTokenSecretId });
    const active = workspace("active");
    store.mutate((state) => {
      state.rules = active.rules;
      state.game = { ...state.game, ...active.game };
      state.settings.overlayConfigs = active.overlayConfigs;
      state.profiles = [
        { id: "active", name: "Profil actif", workspace: workspace("active-profile") },
        { id: "sleep", name: "Profil conservé", workspace: workspace("sleep-profile") }
      ];
      state.session.profileId = "active";
    }, true);
    const gifts = new GiftCatalog(path.join(__dirname, "..", "resources")).gifts;
    const previousGifts = gifts.map((gift) => gift.giftFamily === "community-heart" ? { ...gift,
      imageUrl: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/dad7a63955f98891958e37071bb067f3.png~tplv-obj.webp" } : gift);
    const previousRepair = store.reconcileGiftReferences(previousGifts);
    assert.ok(previousRepair.changed > 0);
    const backup = fs.readFileSync(previousRepair.backupPath, "utf8");
    store.flush();
    store = new StateStore(directory, { isEncryptionAvailable: () => false });
    store.load();
    const before = clone(store.state.rules[0]);
    // Même point d'entrée qu'initialize()/resumeAccountWorkspace(), sans ouvrir
    // de compte réel, de socket, de serveur, de service de jeu ni de LIVE.
    const result = reconcileGiftReferencesSafely({ store, giftCatalog: { gifts } });
    assert.ok(result.changed > 0);
    assert.equal(store.state.rules[0].conditions[0].giftImageUrl, COMMUNITY_HEART_IMAGE_URL);
    assert.equal(store.state.rules[0].conditions[0].giftId, before.conditions[0].giftId);
    assert.equal(store.state.rules[0].conditions[0].giftCost, before.conditions[0].giftCost);
    assert.deepEqual(store.state.rules[0].actions, before.actions);
    assert.equal(store.state.game.interactionRulesByPack.gta[0].conditions[0].giftImageUrl, COMMUNITY_HEART_IMAGE_URL);
    assert.equal(store.state.game.connectorOverrides["coin-pusher"].guardGift.image, COMMUNITY_HEART_IMAGE_URL);
    assert.equal(store.state.settings.overlayConfigs.wheel.wheels[0].triggerGift.giftImageUrl, COMMUNITY_HEART_IMAGE_URL);
    const dormant = store.state.profiles.find((profile) => profile.id === "sleep").workspace;
    assert.equal(dormant.rules[0].conditions[0].giftImageUrl, COMMUNITY_HEART_IMAGE_URL);
    assert.equal(dormant.game.connectorOverrides["coin-pusher"].guardGift.image, COMMUNITY_HEART_IMAGE_URL);
    assert.equal(fs.readFileSync(previousRepair.backupPath, "utf8"), backup);
    assert.equal(store.reconcileGiftReferences(gifts).changed, 0);
    const persisted = JSON.parse(fs.readFileSync(store.filePath, "utf8"));
    assert.equal(persisted.rules[0].conditions[0].giftImageUrl, COMMUNITY_HEART_IMAGE_URL);
  } finally {
    store.flush();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("un échec de sauvegarde laisse absolument toutes les références intactes", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-gift-upgrade-failure-"));
  const store = new StateStore(directory, { isEncryptionAvailable: () => false });
  try {
    store.state.rules = [rule("sound")];
    const original = clone(store.state);
    store.storage.atomicWrite = () => { throw new Error("disque indisponible"); };
    assert.throws(() => store.reconcileGiftReferences(catalog), /disque indisponible/);
    assert.deepEqual(store.state, original);
    assert.equal(store.writeTimer, null);
    assert.equal(store.runtimeWriteTimer, null);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("un import ancien dans le compte actif est lui aussi réconcilié sans affecter un autre compte", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-gift-upgrade-import-"));
  const store = new StateStore(directory, { isEncryptionAvailable: () => false });
  try {
    store.load();
    store.activateAccount("active");
    store.reconcileGiftReferences(catalog);
    const imported = createDefaultState();
    imported.rules = [rule("import")];
    imported.profiles = [{ id: "import-profile", name: "Import historique", enabledRuleIds: ["import"] }];
    imported.session.profileId = "import-profile";
    // Les anciens exports contiennent normalement le workspace ou des règles
    // globales pré-profils ; cet exemple représente le premier format.
    imported.profiles[0].workspace = { ...workspace("import-profile"), rules: imported.rules };
    store.importState(imported);
    assert.equal(store.state.rules[0].conditions[0].giftId, "7934");
    assert.equal(store.state.rules[0].conditions[0].giftImageUrl, catalog[0].imageUrl);
    assert.deepEqual(store.state.rules[0].actions, imported.rules[0].actions);
    assert.equal(store.state.activeAccountUid, "active");
  } finally {
    store.flush();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("une ancienne version sans workspaces conserve ses associations après chargement et première connexion", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-gift-upgrade-legacy-"));
  const store = new StateStore(directory, { isEncryptionAvailable: () => false });
  try {
    const legacy = createDefaultState();
    legacy.schemaVersion = 1;
    delete legacy.accountWorkspaceSchemaVersion;
    legacy.rules = [rule("legacy-sound"), { ...rule("legacy-game", "game.effect"), gameInteraction: true }];
    legacy.profiles = [{ id: "legacy", name: "Mon profil historique", enabledRuleIds: legacy.rules.map((entry) => entry.id) }];
    legacy.session.profileId = "legacy";
    legacy.game.activeGamePackId = "coin-pusher";
    legacy.game.connectorOverrides = workspace("legacy").game.connectorOverrides;
    fs.writeFileSync(store.filePath, JSON.stringify(legacy), "utf8");
    store.load();
    assert.ok(store.state.unclaimedAccountWorkspace);
    store.reconcileGiftReferences(catalog);
    const saved = store.state.unclaimedAccountWorkspace.profiles[0].workspace;
    assert.equal(saved.rules[0].conditions[0].giftImageUrl, catalog[0].imageUrl);
    assert.equal(saved.game.interactionRulesByPack["coin-pusher"][0].conditions[0].giftImageUrl, catalog[0].imageUrl);
    store.activateAccount("legacy-owner");
    assert.equal(store.state.rules[0].conditions[0].giftId, "7934");
    assert.equal(store.state.rules[0].conditions[0].giftImageUrl, catalog[0].imageUrl);
    assert.deepEqual(store.state.rules[0].actions, legacy.rules[0].actions);
    assert.equal(store.state.game.connectorOverrides["coin-pusher"].giftRules[0].image, catalog[1].imageUrl);
    assert.equal(store.reconcileGiftReferences(catalog).changed, 0);
  } finally {
    store.flush();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("les cadeaux explicitement sélectionnés des captures retrouvent leur image sans changer leur ID", () => {
  const gifts = new GiftCatalog(path.join(__dirname, "..", "resources")).gifts;
  const expected = [
    ["Trésor de pirate", "17357"], ["Forever Rosa", "8914"], ["Sunglasses", "5509"],
    ["Saxo-chant", "18606"], ["Rose", "5655"], ["Corgi", "6267"], ["Pistolet à argent", "7168"],
    ["Tu es incroyable", "9948"], ["Elise l'éléphante", "6802"], ["Gerry la girafe", "6842"],
    ["Léon le chaton", "6646"], ["Voiture de course", "7063"], ["Lion", "6369"],
    ["Planète merveilleuse", "6149"], ["Cœur avec les doigts", "5487"], ["Cœur sur moi", "17712"],
    ["Violon onirique", "18605"], ["Chapeau et moustache", "6427"], ["Amour en langue des signes", "8259"],
    ["Chat", "47040"]
  ];
  const state = { rules: expected.map(([name, id], index) => ({ id: `capture_${index}`,
    conditions: [{ field: "data.giftName", operator: "equals", value: name, giftId: id }] })) };
  applyGiftReferenceUpdates(collectGiftReferenceUpdates(state, gifts));
  for (const [index, [name, id]] of expected.entries()) {
    assert.equal(state.rules[index].conditions[0].giftId, id, name);
    assert.match(state.rules[index].conditions[0].giftImageUrl, /^https:\/\//, name);
    assert.equal(state.rules[index].conditions[0].value, name);
  }
  assert.equal(collectGiftReferenceUpdates(state, gifts).length, 0);
});

test("les homonymes sans ID ni montant ne sont pas devinés à la mise à jour", () => {
  const gifts = new GiftCatalog(path.join(__dirname, "..", "resources")).gifts;
  const names = ["Gants de boxe", "Love You", "Rosa", "Voiture de sport"];
  const state = { rules: names.map((name, index) => ({ id: `ambiguous_${index}`,
    conditions: [{ field: "data.giftName", operator: "equals", value: name, giftImageUrl: "keep-legacy.png" }] })) };
  const original = clone(state);
  assert.equal(collectGiftReferenceUpdates(state, gifts).length, 0);
  assert.deepEqual(state, original);
});

test("un visuel commun aux homonymes répare seulement l'image, jamais leur identité ni leur logique", () => {
  const gifts = new GiftCatalog(path.join(__dirname, "..", "resources")).gifts;
  const names = ["Chat", "Voiture de course", "Elise l'éléphante", "Tofu"];
  const state = { rules: names.map((name, index) => ({ ...rule(`shared-image-${index}`),
    conditions: [{ field: "data.giftName", operator: "equals", value: name, giftImageUrl: "old-wrong.png" }] })),
    overlayConfigs: { wheel: { wheels: [{ id: "old-chat-wheel", trigger: "Chat", segments: [{ id: "choice", label: "Mon défi" }] }] } },
    game: { connectorOverrides: { "coin-pusher": { giftRules: [{ name: "Tofu", cost: 5, coinCount: 17, image: "" }] } } } };
  const original = clone(state);
  applyGiftReferenceUpdates(collectGiftReferenceUpdates(state, gifts));
  for (const [index, entry] of state.rules.entries()) {
    const selected = entry.conditions[0];
    assert.match(selected.giftImageUrl, /^https:\/\//, names[index]);
    assert.equal(Object.prototype.hasOwnProperty.call(selected, "giftId"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(selected, "giftIds"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(selected, "giftFamily"), false);
    assert.deepEqual({ ...selected, giftImageUrl: "old-wrong.png" }, original.rules[index].conditions[0]);
    assert.deepEqual(entry.actions, original.rules[index].actions);
    assert.deepEqual(entry.trigger, original.rules[index].trigger);
    assert.deepEqual(entry.cooldown, original.rules[index].cooldown);
  }
  const wheel = state.overlayConfigs.wheel.wheels[0];
  assert.match(wheel.triggerGift.giftImageUrl, /^https:\/\//);
  assert.deepEqual(Object.keys(wheel.triggerGift), ["giftImageUrl"]);
  assert.equal(wheel.trigger, "Chat");
  assert.deepEqual(wheel.segments, original.overlayConfigs.wheel.wheels[0].segments);
  const gameGift = state.game.connectorOverrides["coin-pusher"].giftRules[0];
  assert.match(gameGift.image, /^https:\/\//);
  assert.deepEqual({ ...gameGift, image: "" }, original.game.connectorOverrides["coin-pusher"].giftRules[0]);
  assert.equal(collectGiftReferenceUpdates(state, gifts).length, 0);
});

test("des noms non latins ressemblants ne rendent pas TikTok et Galaxy ambigus", () => {
  const gifts = new GiftCatalog(path.join(__dirname, "..", "resources")).gifts;
  const state = { rules: ["TikTok", "Galaxy"].map((name) => ({
    conditions: [{ field: "data.giftName", operator: "equals", value: name }]
  })) };
  applyGiftReferenceUpdates(collectGiftReferenceUpdates(state, gifts));
  assert.equal(state.rules[0].conditions[0].giftId, "5269");
  assert.equal(state.rules[1].conditions[0].giftId, "11046");
  assert.match(state.rules[0].conditions[0].giftImageUrl, /^https:\/\//);
  assert.match(state.rules[1].conditions[0].giftImageUrl, /^https:\/\//);
  assert.equal(collectGiftReferenceUpdates(state, gifts).length, 0);
});

test("un ancien import sans workspace conserve actions et jeux sans modifier le compte dormant", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-gift-upgrade-legacy-import-"));
  const store = new StateStore(directory, { isEncryptionAvailable: () => false });
  try {
    store.load();
    store.activateAccount("dormant");
    store.upsert("rules", rule("other-owner"));
    store.activateAccount("active");
    store.reconcileGiftReferences(catalog);
    const otherAccount = clone(store.state.accountWorkspaces[accountWorkspaceKey("dormant")]);
    const legacy = createDefaultState();
    legacy.rules = [rule("legacy-sound"), { ...rule("legacy-game", "game.effect"), gameInteraction: true }];
    legacy.profiles = [{ id: "old", name: "Ancien profil importé", enabledRuleIds: ["legacy-sound", "legacy-game"] }];
    legacy.session.profileId = "old";
    legacy.session.activeGamePackId = "coin-pusher";
    legacy.game.connectorOverrides = workspace("old").game.connectorOverrides;
    legacy.commands = [{ id: "command", command: "!ancien" }];
    store.importState(legacy);
    assert.equal(store.state.activeAccountUid, "active");
    assert.equal(store.state.profiles[0].name, "Ancien profil importé");
    assert.equal(store.state.rules[0].id, "legacy-sound");
    assert.deepEqual(store.state.rules[0].actions, legacy.rules[0].actions);
    assert.deepEqual(store.state.rules[0].cooldown, legacy.rules[0].cooldown);
    assert.equal(store.state.rules[0].conditions[0].giftImageUrl, catalog[0].imageUrl);
    const gameRule = store.state.game.interactionRulesByPack["coin-pusher"][0];
    assert.equal(gameRule.id, "legacy-game");
    assert.deepEqual(gameRule.actions, legacy.rules[1].actions);
    assert.equal(gameRule.conditions[0].giftId, "7934");
    assert.equal(gameRule.conditions[0].giftImageUrl, catalog[0].imageUrl);
    assert.equal(store.state.game.connectorOverrides["coin-pusher"].giftRules[0].image, catalog[1].imageUrl);
    assert.deepEqual(store.state.commands, legacy.commands);
    assert.deepEqual(clone(store.state.accountWorkspaces[accountWorkspaceKey("dormant")]), otherAccount);
    assert.equal(store.reconcileGiftReferences(catalog).changed, 0);
  } finally {
    store.flush();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("les métadonnées apprises pendant le LIVE peuvent utiliser la sauvegarde regroupée", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-gift-upgrade-deferred-"));
  const store = new StateStore(directory, { isEncryptionAvailable: () => false });
  try {
    store.state.rules = [rule("sound")];
    const before = JSON.stringify(store.state);
    fs.writeFileSync(store.filePath, before, "utf8");
    const result = store.reconcileGiftReferences(catalog, { immediate: false });
    assert.ok(result.changed > 0);
    assert.ok(store.writeTimer);
    assert.equal(fs.readFileSync(store.filePath, "utf8"), before);
    assert.deepEqual(JSON.parse(fs.readFileSync(result.backupPath, "utf8")), JSON.parse(before));
    assert.equal(store.state.rules[0].conditions[0].giftImageUrl, catalog[0].imageUrl);
    const scheduled = store.writeTimer;
    assert.equal(store.reconcileGiftReferences(catalog, { immediate: false }).changed, 0);
    assert.equal(store.writeTimer, scheduled);
    store.flush();
    assert.equal(store.writeTimer, null);
    assert.equal(JSON.parse(fs.readFileSync(store.filePath, "utf8")).rules[0].conditions[0].giftImageUrl, catalog[0].imageUrl);
  } finally {
    store.flush();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

for (const failure of ["backup", "commit"]) {
  test(`un import échoué (${failure}) ne change ni les profils ni les comptes et un flush garde l'ancien état`, () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `shenpulse-gift-upgrade-import-${failure}-`));
    const store = new StateStore(directory, { isEncryptionAvailable: () => false });
    const originalWrite = store.storage.atomicWrite.bind(store.storage);
    try {
      store.load();
      store.activateAccount("dormant");
      store.upsert("rules", rule("dormant-existing"));
      store.activateAccount("active");
      store.upsert("rules", rule("active-existing"));
      store.flush();
      // Une modification légitime était déjà en attente avant l'import : son
      // échéance doit rester intacte et ne jamais écrire un import partiel.
      store.set("settings.theme", "light");
      const original = clone(store.state);
      const originalState = store.state;
      const originalTimer = store.writeTimer;
      const originalDisk = fs.readFileSync(store.filePath, "utf8");
      const imported = createDefaultState();
      imported.rules = [rule("new-import")];
      imported.profiles = [{ id: "new-profile", name: "Profil à ne pas appliquer", enabledRuleIds: ["new-import"] }];
      imported.session.profileId = "new-profile";
      store.giftReferenceCatalog = catalog;
      store.storage.atomicWrite = (targetPath, ...args) => {
        if ((failure === "backup" && targetPath.includes("before-gift-references-v1")) ||
            (failure === "commit" && targetPath === store.filePath)) throw new Error(`échec ${failure}`);
        return originalWrite(targetPath, ...args);
      };
      assert.throws(() => store.importState(imported), new RegExp(`échec ${failure}`));
      assert.equal(store.state, originalState);
      assert.deepEqual(clone(store.state), original);
      assert.equal(store.writeTimer, originalTimer);
      assert.equal(fs.readFileSync(store.filePath, "utf8"), originalDisk);
      store.storage.atomicWrite = originalWrite;
      store.flush();
      const written = JSON.parse(fs.readFileSync(store.filePath, "utf8"));
      assert.equal(written.rules[0].id, "active-existing");
      assert.equal(written.session.profileId, original.session.profileId);
      assert.equal(written.settings.theme, "light");
      assert.deepEqual(written.profiles, original.profiles);
      assert.equal(written.accountWorkspaces[accountWorkspaceKey("dormant")].profiles[0].workspace.rules[0].id, "dormant-existing");
      assert.equal(JSON.stringify(written).includes("new-import"), false);
      if (failure === "commit") {
        const backup = JSON.parse(fs.readFileSync(path.join(directory, "shenpulse-state.before-gift-references-v1.json"), "utf8"));
        assert.deepEqual(backup, original);
      }
    } finally {
      store.storage.atomicWrite = originalWrite;
      store.flush();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
}
