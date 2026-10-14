"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { ingestCreatorEvent } = require("../src/main/core/ingestion");

function fixture({ blocked = false, musicFails = false } = {}) {
  const order = [];
  const operation = (name) => async () => { order.push(name); };
  const core = {
    giftCatalog: { gifts: [], mergeLiveGift: () => {} }, followSessionGuard: { accept: () => true },
    viewerService: { recordEvent: () => order.push("viewer-stats"), isBlocked: () => blocked },
    spotifyService: { songRequests: { handleChat: async () => {
      order.push("song-request");
      if (musicFails) throw new Error("Private provider detail that must not be logged");
      return { handled: true, ok: true, transport: "local-ui" };
    } } },
    overlayServer: { publishEvent: () => order.push("publish") }, notifyRenderer: (channel) => order.push(channel),
    ruleEngine: { process: operation("rules") }, overlayCompletionController: { handleLikeGoalChange: operation("completion") }
  };
  const hooks = {
    recordEvent: () => { order.push("live-stats"); return {}; },
    handleCommand: operation("legacy-command"), handleWheelGiftTriggers: operation("wheel"),
    changed: () => order.push("changed"), activity: (...args) => order.push(args)
  };
  const event = { type: "chat", source: "source_tiktok", user: { id: "fixture-viewer", name: "viewer" }, data: { message: "!sr title" } };
  return { core, hooks, event, order };
}

test("un échec Matchs ne coupe jamais musique, commandes, roue ou règles et ne divulgue aucun détail privé", async () => {
  const { core, hooks, event, order } = fixture();
  core.matches = { handleLiveEvent: () => { throw new Error("Private match identity/payload"); } };
  await ingestCreatorEvent(core, hooks, event);
  for (const name of ["song-request", "legacy-command", "wheel", "rules", "completion"]) assert.equal(order.includes(name), true);
  assert.equal(JSON.stringify(order).includes("Private match identity"), false);
});

test("la demande musicale vient après les statistiques et conserve les commandes et règles historiques", async () => {
  const { core, hooks, event, order } = fixture();
  await ingestCreatorEvent(core, hooks, event);
  assert.deepEqual(order, ["viewer-stats", "live-stats", "song-request", "publish", "live-event", "legacy-command", "wheel", "rules", "completion", "changed"]);
});

test("la modération garde les statistiques et interdit également les demandes musicales", async () => {
  const { core, hooks, event, order } = fixture({ blocked: true });
  const result = await ingestCreatorEvent(core, hooks, event);
  assert.equal(result.moderationBlocked, true);
  assert.deepEqual(order, ["viewer-stats", "live-stats", "changed"]);
});

test("un échec musical inattendu ne coupe pas le LIVE et ne journalise pas de détails privés", async () => {
  const { core, hooks, event, order } = fixture({ musicFails: true });
  await ingestCreatorEvent(core, hooks, event);
  assert.equal(order.includes("rules"), true);
  assert.equal(order.includes("legacy-command"), true);
  assert.equal(order.at(-1), "changed");
  assert.equal(JSON.stringify(order).includes("Private provider detail"), false);
  assert.equal(order.some((entry) => Array.isArray(entry) && entry[0] === "warning"), true);
});

test("la recherche musicale réseau n'attend pas avant de déclencher les autres interactions", async () => {
  const { core, hooks, event, order } = fixture();
  let release;
  core.spotifyService.songRequests.handleChat = () => new Promise((resolve) => { release = resolve; });
  let timer;
  const immediate = await Promise.race([
    ingestCreatorEvent(core, hooks, event).then(() => true),
    new Promise((resolve) => { timer = setTimeout(() => resolve(false), 100); })
  ]);
  clearTimeout(timer);
  release({ handled: true, ok: true });
  assert.equal(immediate, true, "une API distante lente ne doit pas bloquer les règles LIVE");
  assert.equal(order.includes("rules"), true);
});

test("une commande exécutable revendique son nom : aucune seconde demande musicale ni repli qui contourne son rôle", async () => {
  const { core, hooks, event, order } = fixture();
  core.liveEventActions = { chatbot: { hasFunctionalCommand: () => true } };
  await ingestCreatorEvent(core, hooks, event);
  assert.equal(order.includes("song-request"), false);
  assert.equal(order.includes("legacy-command"), true);
  assert.equal(order.includes("rules"), true);
});
