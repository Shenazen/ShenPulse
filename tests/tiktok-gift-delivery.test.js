"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { EventEmitter } = require("node:events");
const { ControlEvent, WebcastEvent } = require("tiktok-live-connector");
const { TikTokGiftDelivery } = require("../src/main/sources/tiktok-gift-delivery");
const { tiktokConnectorPayload } = require("../src/main/sources/tiktok-protocol");
const { normalizeEvent } = require("../src/main/event-normalizer");
const { RuleEngine } = require("../src/main/rule-engine");
const { recordEventStatistics } = require("../src/main/core/event-statistics");
const { createDefaultState } = require("../src/main/defaults");

const ROOM = "7123456789012345678";
const clone = (value) => JSON.parse(JSON.stringify(value));
function gift(count = 1, extra = {}) {
  return { common: { roomId: ROOM, msgId: "same-message" }, groupId: "combo-1",
    user: { id: "viewer-1", uniqueId: "viewer", nickname: "Viewer" }, giftId: 16212,
    giftDetails: { id: 16212, name: "Cool", type: 1, diamondCount: 1 }, repeatCount: count,
    repeatEnd: false, ...extra };
}
function accept(delivery, event) {
  return delivery.accept(event, { ...tiktokConnectorPayload("gift", event, "creator"), roomId: ROOM });
}

test("combo 1 → 2 → 5 → fin 5 : chaque nouvelle unité part aussitôt, sans rejouer le total", () => {
  const delivery = new TikTokGiftDelivery();
  const payloads = [gift(1), gift(2), gift(5), gift(5, { repeatEnd: true })].map((event) => accept(delivery, event));
  assert.deepEqual(payloads.map((payload) => payload?.repeatCount ?? 0), [1, 1, 3, 0]);
  assert.deepEqual(payloads.slice(0, 3).map((payload) => payload.giftComboTotal), [1, 2, 5]);
  assert.equal(new Set(payloads.filter(Boolean).map((payload) => payload.id)).size, 3);
  assert.equal(payloads[0].sourceMessageId, "same-message");
});

test("le total final rattrape les incréments manquants ; un final reçu seul livre tout le combo", () => {
  const delivery = new TikTokGiftDelivery();
  assert.equal(accept(delivery, gift(2)).repeatCount, 2);
  const final = accept(delivery, gift(7, { repeatEnd: true }));
  assert.equal(final.repeatCount, 5);
  assert.equal(final.giftComboFinal, true);
  assert.equal(accept(delivery, gift(4, { groupId: "final-only", repeatEnd: true })).repeatCount, 4);
});

test("doublons typed/decoded, compteurs en retard, finales répétées et objet réutilisé ne doublent rien", () => {
  const delivery = new TikTokGiftDelivery();
  const event = gift(1);
  assert.equal(accept(delivery, event).repeatCount, 1);
  assert.equal(accept(delivery, clone(event)), null);
  event.repeatCount = 3;
  assert.equal(accept(delivery, event).repeatCount, 2, "un même msgId et objet peut porter une progression");
  assert.equal(accept(delivery, gift(2)), null);
  assert.equal(accept(delivery, gift(3, { repeatEnd: true })), null);
  assert.equal(accept(delivery, gift(3, { common: { roomId: ROOM, msgId: "new-final-id" }, repeatEnd: true })), null);
  assert.equal(accept(delivery, gift(4, { repeatEnd: true })).repeatCount, 1);
});

test("les combos restent indépendants par série, spectateur, cadeau, destinataire et salle", () => {
  const delivery = new TikTokGiftDelivery();
  for (const event of [gift(), gift(1, { groupId: "combo-2" }), gift(1, { user: { id: "viewer-2" } }),
    gift(1, { giftId: 5655 }), gift(1, { toUser: { id: "7234567890123456789" } }),
    gift(1, { common: { roomId: "another-room", msgId: "same-message" } })]) {
    assert.equal(accept(delivery, event).repeatCount, 1);
    assert.equal(accept(delivery, clone(event)), null);
  }
  assert.equal(delivery.combos.size, 6);
});

test("une série sans identifiant conserve le total final ; un cadeau hors combo reste immédiat et dédupliqué", () => {
  const delivery = new TikTokGiftDelivery();
  for (const groupId of [undefined, "", "0"]) assert.equal(accept(delivery, gift(1, { groupId })), null);
  assert.equal(accept(delivery, gift(3, { groupId: "", repeatEnd: true })).repeatCount, 3);
  const ordinary = gift(2, { giftType: 0, giftDetails: { type: 0 }, common: { msgId: "ordinary" } });
  assert.equal(accept(delivery, ordinary).repeatCount, 2);
  assert.equal(accept(delivery, clone(ordinary)), null);
});

test("le suivi borné n'évince jamais une série partiellement livrée", () => {
  const delivery = new TikTokGiftDelivery({ maxCombos: 1 });
  assert.equal(accept(delivery, gift(1)).repeatCount, 1);
  assert.equal(accept(delivery, gift(2, { groupId: "overflow" })), null);
  assert.equal(accept(delivery, gift(5)).repeatCount, 4);
  assert.equal(accept(delivery, gift(2, { groupId: "overflow", repeatEnd: true })).repeatCount, 2);
  assert.equal(accept(delivery, gift(5, { repeatEnd: true })), null);
  assert.equal(delivery.combos.size, 1);
});

test("un compteur invalide ne crée pas de livraison ni de progression irrécupérable", () => {
  const delivery = new TikTokGiftDelivery();
  for (const repeatCount of [NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(accept(delivery, gift(repeatCount)), null);
  }
  assert.equal(accept(delivery, gift(2)).repeatCount, 2);
});

test("règles, seuils et statistiques consomment les incréments une seule fois", async () => {
  const delivery = new TikTokGiftDelivery();
  const state = createDefaultState();
  const rules = [1, 5].map((threshold) => ({ id: `rule-${threshold}`, enabled: true, chance: 1,
    trigger: { type: "gift", threshold }, actions: [{ id: `action-${threshold}`, type: "fixture", config: {} }] }));
  state.rules = rules;
  state.profiles[0].enabledRuleIds = rules.map((rule) => rule.id);
  state.session.profileId = state.profiles[0].id;
  const executions = [];
  const engine = new RuleEngine({ store: { getRuleEngineState: () => state },
    actionRunner: { run: async (_action, context) => executions.push(context.rule.id) } });
  const before = state.statistics.gifts;
  for (const raw of [gift(1), gift(2), gift(5), gift(5, { repeatEnd: true }), gift(7, { repeatEnd: true })]) {
    const payload = accept(delivery, raw);
    if (!payload) continue;
    const event = normalizeEvent({ event: "gift", data: payload }, "source_tiktok");
    recordEventStatistics(state, event);
    await engine.process(event);
  }
  assert.equal(executions.filter((id) => id === "rule-1").length, 7);
  assert.equal(executions.filter((id) => id === "rule-5").length, 1);
  assert.equal(state.statistics.gifts - before, 7);
  assert.equal(engine.thresholds.get("rule-5:viewer-1"), 2);
});

function workspace(context) {
  const connectors = [], sourcePath = path.resolve(__dirname, "../src/main/source-hub.js"), realRequire = createRequire(sourcePath);
  class FakeConnector extends EventEmitter {
    constructor() { super(); this.roomId = ROOM; connectors.push(this); }
    async fetchIsLive() { return true; }
    async connect() { return { roomId: this.roomId }; }
    async disconnect() {}
    async fetchRoomInfo() { return null; }
  }
  const module = { exports: {} };
  const reconnects = [];
  new vm.Script(fs.readFileSync(sourcePath, "utf8"), { filename: sourcePath }).runInNewContext({
    require: (request) => request === "tiktok-live-connector"
      ? { ControlEvent, WebcastEvent, TikTokLiveConnection: FakeConnector } : realRequire(request),
    module, exports: module.exports, URL, setTimeout: (callback) => {
      reconnects.push(callback); return { unref() {} };
    }, clearTimeout() {}, clearInterval, queueMicrotask, console
  });
  const state = createDefaultState();
  state.settings.tiktok.username = "creator";
  state.connections.push({ id: "source_tiktok", type: "tiktok-direct", enabled: true, status: "disconnected", config: { username: "creator" } });
  const hub = new module.exports.SourceHub({ store: { getState: () => clone(state), mutateRuntime: (mutate) => mutate(state), getSecret: () => "" } });
  const events = [];
  hub.on("event", (event) => events.push(clone(event)));
  context.after(() => hub.stopAll());
  return { hub, connectors, events, reconnects };
}

test("SourceHub livre avant repeatEnd sur les deux chemins SDK, même avec un msgId réutilisé", async (context) => {
  const { hub, connectors, events } = workspace(context);
  await hub.start("source_tiktok");
  const connector = connectors[0];
  connector.emit(WebcastEvent.GIFT, gift(1));
  assert.deepEqual(events.map((event) => event.data.count), [1], "aucune attente de la fin du combo");
  connector.emit(ControlEvent.DECODED_DATA, "WebcastGiftMessage", { data: gift(1) });
  connector.emit(WebcastEvent.GIFT, gift(2));
  connector.emit(ControlEvent.DECODED_DATA, "WebcastGiftMessage", { data: gift(5) });
  await new Promise(setImmediate);
  connector.emit(WebcastEvent.GIFT, gift(7, { repeatEnd: true }));
  await new Promise(setImmediate);
  assert.deepEqual(events.map((event) => event.data.count), [1, 1, 3, 2]);
  assert.equal(new Set(events.map((event) => event.id)).size, 4);
  assert.equal(events.at(-1).data.raw.giftComboTotal, 7);
  assert.equal(events.at(-1).data.raw.giftComboFinal, true);
});

test("une reconnexion automatique garde le compteur du combo et ignore les callbacks de l'ancien connecteur", async (context) => {
  const { hub, connectors, events, reconnects } = workspace(context);
  await hub.start("source_tiktok");
  const first = connectors[0], staleListener = first.listeners(WebcastEvent.GIFT)[0];
  first.emit(WebcastEvent.GIFT, gift(2));
  first.emit(ControlEvent.DISCONNECTED);
  assert.equal(reconnects.length, 1);
  reconnects[0]();
  await new Promise(setImmediate);
  const second = connectors[1];
  assert.ok(second);
  staleListener(gift(10));
  second.emit(WebcastEvent.GIFT, gift(2));
  second.emit(WebcastEvent.GIFT, gift(5));
  second.emit(WebcastEvent.GIFT, gift(5, { repeatEnd: true }));
  assert.deepEqual(events.map((event) => event.data.count), [2, 3]);
});

test("les preuves de bonus Match et les incréments de cadeaux restent indépendants", async (context) => {
  const { hub, connectors, events } = workspace(context);
  const matches = [];
  hub.on("match-event", (event) => matches.push(event));
  await hub.start("source_tiktok");
  const proof = { common: { roomId: ROOM, msgId: "proof", createTime: String(Date.now()) },
    giftExtra: { toUserId: "7234567890123456789" },
    matchInfo: { critical: "0", effectCardInUse: false, multiplierType: 0, multiplierValue: "2" } };
  connectors[0].emit(WebcastEvent.GIFT, gift(1, proof));
  connectors[0].emit(ControlEvent.DECODED_DATA, "WebcastGiftMessage", { data: gift(1, proof) });
  connectors[0].emit(WebcastEvent.GIFT, gift(2, proof));
  connectors[0].emit(WebcastEvent.GIFT, gift(2, { ...proof, repeatEnd: true }));
  await new Promise(setImmediate);
  assert.equal(matches.length, 1);
  assert.deepEqual(events.map((event) => event.data.count), [1, 1]);
});
