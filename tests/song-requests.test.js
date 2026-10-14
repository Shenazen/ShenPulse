"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { SongRequestsService, normalizeSongRequestSettings, commandMatch } = require("../src/main/spotify/song-requests");

function fixture() {
  const state = { settings: { account: { uid: "owner-a" }, spotify: { songRequests: { enabled: true } } } };
  let now = Date.UTC(2026, 9, 13, 10);
  let owner = "owner-a";
  const calls = []; const notices = [];
  const track = { id: "4uLU6hMCjMI75M1A2tKUQC", uri: "spotify:track:4uLU6hMCjMI75M1A2tKUQC", name: "Titre", artists: ["Artiste"], durationMs: 180000, explicit: false };
  const spotify = { resolveTrack: async (config) => { calls.push(["resolve", config]); return { ...track }; },
    control: async (config) => { calls.push(["control", config]); return { ok: true, operation: config.operation, playback: { item: track } }; } };
  const store = { getState: () => state, getActiveAccountUid: () => owner,
    mutateRuntime: (mutator) => mutator(state), set: (key, value) => { assert.equal(key, "settings.spotify.songRequests"); state.settings.spotify.songRequests = value; } };
  const service = new SongRequestsService({ store, spotify, notifyRenderer: (channel, payload) => notices.push({ channel, payload }), now: () => now });
  return { state, service, spotify, calls, notices, track, tick: (seconds = 11) => { now += seconds * 1000; }, changeOwner: () => { owner = "owner-b"; state.settings.account.uid = owner; state.settings.spotify = { songRequests: { enabled: true } }; } };
}
function chat(message, user = {}) {
  return { type: "chat", source: "source_tiktok", user: { id: "alice", name: "alice", displayName: "Alice", ...user }, data: { message } };
}

test("configuration bornée, commandes distinctes et commandes sans faux préfixe", () => {
  const defaults = normalizeSongRequestSettings();
  assert.equal(defaults.enabled, false); assert.equal(defaults.maxQueue, 20); assert.equal(defaults.maxPerViewer, 3);
  assert.equal(defaults.cooldownSeconds, 10); assert.equal(defaults.allowViewerSkip, false);
  assert.equal(normalizeSongRequestSettings({ maxQueue: Infinity }).maxQueue, 20);
  assert.equal(normalizeSongRequestSettings({ maxQueue: 99999 }).maxQueue, 50);
  assert.throws(() => normalizeSongRequestSettings({ commands: { request: "!same", skip: "!same" } }, true), /différentes/);
  assert.throws(() => normalizeSongRequestSettings({ commands: { request: "bad command" } }, true), /commencer/);
  assert.deepEqual(commandMatch("!SR Un titre", defaults.commands), { kind: "request", argument: "Un titre" });
  assert.equal(commandMatch("!srfoo Un titre", defaults.commands), null);
});

test("désactivées par défaut et événements locaux ignorés sans appeler Spotify", async () => {
  const f = fixture(); f.state.settings.spotify.songRequests.enabled = false;
  assert.deepEqual(await f.service.handleChat(chat("!sr titre")), { handled: false });
  f.state.settings.spotify.songRequests.enabled = true;
  for (const source of ["simulator", "test", "rule-test", "manual-preview", "demo", "source_demo"]) {
    assert.equal((await f.service.handleChat({ ...chat("!sr titre"), source })).handled, false);
  }
  assert.equal((await f.service.handleChat({ ...chat("!sr titre"), moderationBlocked: true })).handled, false);
  assert.equal(f.calls.length, 0);
});

test("une commande ajoute une demande locale normalisée sans remplir ni vider la file Spotify", async () => {
  const f = fixture();
  const response = await f.service.handleChat(chat("!sr titre"));
  assert.equal(response.ok, true); assert.equal(response.transport, "local-ui");
  assert.equal(f.service.status().queue.length, 1);
  assert.equal(f.service.status().queue[0].user.displayName, "Alice");
  assert.deepEqual(f.calls.map(([kind]) => kind), ["resolve"]);
  f.service.clear();
  assert.equal(f.service.status().queue.length, 0);
  assert.deepEqual(f.calls.map(([kind]) => kind), ["resolve"]);
});

test("la file, le nombre de titres par spectateur et le délai limitent les recherches", async () => {
  const f = fixture(); f.service.configure({ maxQueue: 3, maxPerViewer: 2 });
  await f.service.add({ query: "one", user: chat("").user, creator: false });
  await assert.rejects(f.service.add({ query: "two", user: chat("").user, creator: false }), /Patientez/);
  f.tick(); await f.service.add({ query: "two", user: chat("").user, creator: false });
  f.tick(); await assert.rejects(f.service.add({ query: "three", user: chat("").user, creator: false }), /limite/);
  await f.service.add({ query: "three", user: { id: "bob", name: "Bob" }, creator: false });
  await assert.rejects(f.service.add({ query: "four" }), /pleine/);
  assert.equal(f.calls.length, 3);
});

test("explicite, durée et artistes bloqués sont vérifiés avant la mise en file", async () => {
  const f = fixture();
  f.track.explicit = true; await assert.rejects(f.service.add({ query: "explicite" }), /explicite/);
  f.track.explicit = false; f.track.durationMs = 700000;
  await assert.rejects(f.service.add({ query: "long" }), /durée/);
  f.track.durationMs = 180000; f.track.artists = ["ÁRTISTE Exemple"];
  f.service.configure({ blockedArtists: ["artiste"] });
  await assert.rejects(f.service.add({ query: "artiste" }), /bloqué/);
  assert.equal(f.service.status().queue.length, 0);
  assert.equal(f.calls.filter(([kind]) => kind === "control").length, 0);
});

test("skip réservé aux modérateurs, puis autorisation tous viewers explicite", async () => {
  const f = fixture();
  assert.equal((await f.service.handleChat(chat("!skip"))).ok, false);
  assert.equal(f.calls.length, 0);
  f.tick(); assert.equal((await f.service.handleChat(chat("!skip", { moderator: true }))).ok, true);
  assert.equal(f.calls.at(-1)[1].operation, "next");
  f.tick(); f.service.configure({ allowViewerSkip: true });
  assert.equal((await f.service.handleChat(chat("!skip"))).ok, true);
});

test("lecture de la première demande après succès, conservation en cas d’échec et historique borné", async () => {
  const f = fixture();
  await f.service.add({ query: "titre" });
  f.spotify.control = async () => { throw new Error("Spotify 403"); };
  await assert.rejects(f.service.playNext(), /403/);
  assert.equal(f.service.status().queue.length, 1);
  f.spotify.control = async () => ({ ok: true });
  await f.service.playNext();
  assert.equal(f.service.status().queue.length, 0); assert.equal(f.service.status().history.length, 1);
  for (let index = 0; index < 35; index += 1) { await f.service.add({ query: "titre" }); await f.service.playNext(); }
  assert.equal(f.service.status().history.length, 30);
});

test("changement de compte pendant une recherche ne pollue pas la file du nouveau propriétaire", async () => {
  const f = fixture();
  f.spotify.resolveTrack = async () => { f.changeOwner(); return { ...f.track }; };
  await assert.rejects(f.service.add({ query: "titre" }), /compte.*changé/);
  assert.equal(f.service.status().queue.length, 0);
  assert.equal(f.service.status().lastResponse, null);
});

test("demandes concurrentes sérialisées : pas de dépassement après une recherche lente", async () => {
  const f = fixture(); f.service.configure({ maxQueue: 2 });
  const results = await Promise.allSettled(Array.from({ length: 6 }, () => f.service.add({ query: "titre" })));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 2);
  assert.equal(f.service.status().queue.length, 2);
  assert.equal(f.calls.length, 2);
});

test("np et queue retournent un résultat local honnête, sans automatiser un envoi au chat", async () => {
  const f = fixture();
  const result = await f.service.handleChat(chat("!np"));
  assert.match(result.message, /En lecture : Titre/); assert.equal(result.transport, "local-ui");
  f.tick(); const queue = await f.service.handleChat(chat("!queue"));
  assert.match(queue.message, /Aucune demande/); assert.equal(queue.transport, "local-ui");
});
