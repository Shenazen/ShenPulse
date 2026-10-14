"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { KickService } = require("../src/main/kick-service");
const { SpotifyService } = require("../src/main/spotify-service");
const { spotifyCapabilities } = require("../src/shared/spotify-capabilities");

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function storeFixture() {
  const state = { settings: { account: { uid: "owner-a" }, kick: {
    clientId: "fixture-client", clientSecretId: "fixture-client-secret", refreshTokenSecretId: "kick-refresh-a",
    accessTokenSecretId: "kick-access-a", account: { id: "99" }, expiresAt: Date.now() + 3600000,
    webhookUrl: "https://fixture.invalid/kick/webhook"
  }, spotify: { refreshTokenSecretId: "spotify-refresh-a", accessTokenSecretId: "spotify-access-a", expiresAt: Date.now() + 3600000 } }, connections: [] };
  const secrets = new Map([
    ["fixture-client-secret", "fixture-secret"], ["kick-refresh-a", "fixture-refresh"], ["kick-access-a", "fixture-access"],
    ["spotify-refresh-a", "fixture-refresh"], ["spotify-access-a", "fixture-access"]
  ]);
  const writes = [];
  const store = {
    getState: () => state, getActiveAccountUid: () => state.settings.account.uid,
    getSecret: (id) => secrets.get(id) || "", setSecret: (id, value) => { const key = id || `fixture-secret-${secrets.size}`; secrets.set(key, value); writes.push(key); return key; },
    set: (key, value) => { const parts = key.split("."); let target = state; while (parts.length > 1) target = target[parts.shift()]; target[parts[0]] = value; writes.push(key); },
    mutate: (mutator) => mutator(state), mutateRuntime: (mutator) => mutator(state)
  };
  return { state, secrets, writes, store };
}

function response(value, status = 200) { return new Response(JSON.stringify(value), { status }); }

test("Kick OAuth : une réponse de jeton de l'ancien propriétaire ne touche aucun compte", async () => {
  const f = storeFixture(), tokens = deferred();
  const service = new KickService({ store: f.store, openExternal: async () => service.pending.resolve("fixture-code"),
    fetchImpl: async () => tokens.promise });
  service.ensureServer = async () => {};
  const connection = service.connect();
  const rejected = assert.rejects(connection, /compte ou l'autorisation Kick a changé/);
  await Promise.resolve(); await Promise.resolve();
  f.state.settings.account.uid = "owner-b";
  tokens.resolve(response({ access_token: "must-not-save", refresh_token: "must-not-save" }));
  await rejected;
  assert.deepEqual(f.writes, []);
  assert.equal(service.pending, null);
});

test("Kick OAuth : une identité absente ne remplace pas les anciens jetons", async () => {
  const f = storeFixture();
  const service = new KickService({ store: f.store, openExternal: async () => service.pending.resolve("fixture-code"),
    fetchImpl: async (url) => String(url).endsWith("/token") ? response({ access_token: "new-access", refresh_token: "new-refresh" }) : response({ data: [] }) });
  service.ensureServer = async () => {};
  await assert.rejects(service.connect(), /identité du compte/);
  assert.equal(f.secrets.get("kick-access-a"), "fixture-access");
  assert.deepEqual(f.writes, []);
});

test("Kick refresh : partage par propriétaire, jamais entre deux comptes ni écriture d'une ancienne réponse", async () => {
  const f = storeFixture(), first = deferred(), second = deferred();
  const calls = [];
  const service = new KickService({ store: f.store, openExternal: async () => {}, fetchImpl: async (url) => {
    calls.push(String(url)); return calls.length === 1 ? first.promise : second.promise;
  } });
  const old = service.refresh();
  const rejected = assert.rejects(old, /compte ou l'autorisation Kick a changé/);
  f.state.settings.account.uid = "owner-b";
  f.state.settings.kick = { ...f.state.settings.kick, refreshTokenSecretId: "kick-refresh-b", accessTokenSecretId: "kick-access-b" };
  f.secrets.set("kick-refresh-b", "fixture-refresh-b");
  const current = service.refresh();
  second.resolve(response({ access_token: "access-b", expires_in: 3600, scope: "chat:write events:subscribe" }));
  await current;
  first.resolve(response({ access_token: "must-not-save" }));
  await rejected;
  assert.equal(calls.length, 2);
  assert.equal(f.secrets.get("kick-access-b"), "access-b");
  assert.equal(f.secrets.get("kick-access-a"), "fixture-access");
  assert.deepEqual(f.state.settings.kick.scopes, ["chat:write", "events:subscribe"]);
});

test("Kick HTTP : le retry d'une réponse 401 ne part pas sur un nouveau propriétaire", async () => {
  const f = storeFixture(), pending = deferred();
  let calls = 0;
  const service = new KickService({ store: f.store, openExternal: async () => {}, fetchImpl: async () => { calls += 1; return pending.promise; } });
  const request = service.request("/channels");
  const rejected = assert.rejects(request, /compte ou l'autorisation Kick a changé/);
  f.state.settings.account.uid = "owner-b";
  pending.resolve(response({ message: "expired" }, 401));
  await rejected;
  assert.equal(calls, 1);
});

test("Kick : un refresh révoqué supprime l'état connecté, pas les secrets du compte", async () => {
  const f = storeFixture();
  f.state.settings.kick.expiresAt = 0;
  const service = new KickService({ store: f.store, openExternal: async () => {}, fetchImpl: async () => response({ error: "invalid_grant" }, 400) });
  await assert.rejects(service.request("/channels"), /invalid_grant/);
  assert.equal(service.status().connected, false);
  assert.match(service.status().message, /Autorisez à nouveau/);
  assert.equal(f.secrets.get("kick-refresh-a"), "fixture-refresh");
});

test("Kick : une référence de secret orpheline n'annonce jamais une application configurée", () => {
  const f = storeFixture();
  const service = new KickService({ store: f.store, openExternal: async () => {}, fetchImpl: async () => { throw new Error("Aucun HTTP attendu"); } });
  assert.equal(service.status().configured, true);
  f.secrets.delete("fixture-client-secret");
  assert.equal(service.status().configured, false);
  assert.equal(service.status().connected, true, "la configuration de l'application est distincte de l'autorisation sauvegardée");
});

test("Kick déconnexion : changer de compte pendant DELETE n'autorise jamais la révocation du nouveau jeton", async () => {
  const f = storeFixture(), pending = deferred();
  f.state.settings.kick.subscriptions = [{ id: "fixture-subscription" }];
  const calls = [];
  const service = new KickService({ store: f.store, openExternal: async () => {}, fetchImpl: async (url) => { calls.push(String(url)); return pending.promise; } });
  const disconnect = service.disconnect();
  const rejected = assert.rejects(disconnect, /compte ou l'autorisation Kick a changé/);
  await Promise.resolve(); await Promise.resolve();
  f.state.settings.account.uid = "owner-b";
  pending.resolve(response({ data: [] }));
  await rejected;
  assert.equal(calls.length, 1);
  assert.doesNotMatch(calls[0], /revoke/);
  assert.equal(f.secrets.get("kick-access-a"), "fixture-access");
});

test("Kick : une permission d'envoi connue manquante propose une réautorisation sans HTTP", async () => {
  const f = storeFixture();
  f.state.settings.kick.scopes = ["user:read"];
  let calls = 0;
  const service = new KickService({ store: f.store, openExternal: async () => {}, fetchImpl: async () => { calls += 1; } });
  await assert.rejects(service.send({ message: "Bonjour" }), /chat:write/);
  await assert.rejects(service.start(), /events:subscribe/);
  assert.equal(calls, 0);
});

test("Kick chat : seul l'accusé is_sent=true de la plateforme confirme un envoi", async () => {
  const f = storeFixture();
  let payload;
  const service = new KickService({ store: f.store, openExternal: async () => {}, fetchImpl: async () => response(payload) });
  for (const result of [{ data: { is_sent: false } }, { data: {} }, { data: [] }, {}, { data: { is_sent: "true" } }]) {
    payload = result;
    await assert.rejects(service.send({ message: "Bonjour" }), (error) => error.code === "kick-chat-not-confirmed");
  }
  payload = { data: { is_sent: true, message_id: "fixture-message" } };
  assert.deepEqual(await service.send({ message: "Bonjour" }), { sent: true, acknowledged: true, confirmation: "platform" });
});

test("Kick chat : 500 graphèmes et 2 048 octets maximum, jamais de troncature silencieuse", async () => {
  const f = storeFixture(), bodies = [];
  const service = new KickService({ store: f.store, openExternal: async () => {}, fetchImpl: async (_url, options) => {
    bodies.push(JSON.parse(options.body));
    return response({ data: { is_sent: true, message_id: "fixture-message" } });
  } });
  const allowed = ["x".repeat(500), "😀".repeat(500), "e\u0301".repeat(500)];
  for (const message of allowed) {
    await service.send({ message });
    assert.equal(bodies.at(-1).content, message, "le contenu autorisé est envoyé intégralement");
  }
  for (const message of ["x".repeat(501), "😀".repeat(501), "👨‍👩‍👧‍👦".repeat(100), "e\u0301\u0301".repeat(500)]) {
    await assert.rejects(service.send({ message }), /500 caractères ou 2 048 octets/);
  }
  assert.equal(bodies.length, allowed.length, "aucun HTTP pour les contenus hors limite");
});

test("Spotify : anciennes métadonnées inconnues tolérées, preuves de scope/Premium/appareil refusées précisément", () => {
  assert.equal(spotifyCapabilities({ connected: true }).canControlPlayback, true);
  assert.equal(spotifyCapabilities({ connected: true, scopes: [] }).scopesKnown, false);
  assert.equal(spotifyCapabilities({ connected: true, scopes: [], scopesKnown: true }).canControlPlayback, false);
  assert.match(spotifyCapabilities({ connected: true, scopes: ["user-read-playback-state"] }).reason, /permission/);
  assert.match(spotifyCapabilities({ connected: true, account: { product: "free" } }).reason, /Premium/);
  assert.match(spotifyCapabilities({ connected: true, devices: [], devicesKnown: true }).reason, /Ouvrez Spotify/);
  assert.equal(spotifyCapabilities({ connected: true, devicesKnown: true, devices: [{ id: "restricted", isRestricted: true }] }).canControlPlayback, false);
  assert.equal(spotifyCapabilities({ connected: true, devicesKnown: true, devices: [{ id: "available", isActive: false }] }).canControlPlayback, true);
  assert.equal(spotifyCapabilities({ connected: true, activeDevice: { supportsVolume: false } }).canControlVolume, false);
});

test("Spotify : les contrôles connus impossibles sont refusés sans empêcher la recherche", async (t) => {
  // Un unique mock par test : plusieurs mock.method successifs sur la même
  // globale se restaurent mal avec --test-isolation=none (mock antérieur retenu).
  let calls;
  t.mock.method(global, "fetch", async (url) => { calls.push(String(url)); return response({ tracks: { items: [] } }); });
  for (const settings of [{ account: { product: "free" } }, { scopes: ["user-read-playback-state"] }, { scopes: [], scopesKnown: true }]) {
    const f = storeFixture(); Object.assign(f.state.settings.spotify, settings);
    calls = [];
    const service = new SpotifyService({ store: f.store, notifyRenderer: () => {} });
    await assert.rejects(service.control({ operation: "play" }));
    assert.equal(calls.length, 0);
    await service.control({ operation: "search", query: "titre" });
    assert.equal(calls.length, 1);
  }
});

test("Spotify : changement de compte pendant la résolution d'appareil, aucune écriture de lecture", async (t) => {
  const f = storeFixture(), devices = deferred();
  const calls = [];
  t.mock.method(global, "fetch", async (url, options) => { calls.push({ url: String(url), options }); return devices.promise; });
  const service = new SpotifyService({ store: f.store, notifyRenderer: () => {} });
  const playback = service.control({ operation: "play" });
  const rejected = assert.rejects(playback, /compte Spotify a changé/);
  await Promise.resolve(); await Promise.resolve();
  f.state.settings.account.uid = "owner-b";
  devices.resolve(response({ devices: [{ id: "fixture-device", is_active: true }] }));
  await rejected;
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, "GET");
});

test("Spotify OAuth : l'échec tardif de A ne ferme jamais le serveur de l'autorisation B", async () => {
  const f = storeFixture(), tokens = deferred(), tokenStarted = deferred(), servers = [], opened = [];
  const localRequire = createRequire(path.join(__dirname, "../src/main/spotify-service.js"));
  let tokenCalls = 0;
  const shell = { openExternal: async (url) => {
    opened.push(new URL(url));
    if (opened.length !== 1) return;
    const callback = new URL(opened[0].searchParams.get("redirect_uri"));
    callback.searchParams.set("state", opened[0].searchParams.get("state"));
    callback.searchParams.set("code", "fixture-code");
    servers[0].listener({ url: `${callback.pathname}${callback.search}` }, { writeHead: () => {}, end: () => {} });
  } };
  const http = { createServer: (listener) => {
    const server = { listener, closed: false, once: () => {}, listen: () => {}, close: () => { server.closed = true; } };
    servers.push(server); return server;
  } };
  const module = { exports: {} };
  const context = vm.createContext({ module, exports: module.exports,
    require: (id) => id === "electron" ? { shell } : id === "node:http" ? http : localRequire(id),
    fetch: async () => { tokenCalls += 1; tokenStarted.resolve(); return tokens.promise; },
    URL, URLSearchParams, Buffer, AbortSignal, process: { env: {} },
    setTimeout: () => ({}), clearTimeout: () => {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/main/spotify-service.js"), "utf8"), context);
  const service = new module.exports.SpotifyService({ store: f.store, notifyRenderer: () => {} });
  const previous = service.connect();
  const previousRejected = assert.rejects(previous, /compte ShenPulse a changé/);
  await tokenStarted.promise;
  assert.equal(tokenCalls, 1);
  f.state.settings.account.uid = "owner-b";
  const current = service.connect();
  const currentRejected = assert.rejects(current, /refusé la connexion/);
  await Promise.resolve();
  tokens.resolve(response({ access_token: "must-not-save", refresh_token: "must-not-save" }));
  await previousRejected;
  assert.equal(service.pendingServer, servers[1]);
  assert.equal(servers[1].closed, false);
  servers[1].listener({ url: "/spotify/callback?error=access_denied" }, { writeHead: () => {}, end: () => {} });
  await currentRejected;
  assert.equal(servers[1].closed, true);
  assert.deepEqual(f.writes, []);
});

test("Spotify : pas de volume envoyé à un appareil qui ne le supporte pas", async (t) => {
  const f = storeFixture(), calls = [];
  t.mock.method(global, "fetch", async (url, options) => { calls.push({ url: String(url), options }); return response({ devices: [{ id: "device", is_active: true, supports_volume: false }] }); });
  const service = new SpotifyService({ store: f.store, notifyRenderer: () => {} });
  await assert.rejects(service.control({ operation: "volume", volume: 50 }), /volume de cet appareil/);
  await assert.rejects(service.control({ operation: "volume_up" }), /volume de cet appareil/);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(({ options }) => options.method === "GET"));
});

test("Spotify : le statut distingue autorisation, permission d'écriture et découverte d'appareils", async (t) => {
  const f = storeFixture();
  f.state.settings.spotify.scopes = ["user-read-playback-state"];
  t.mock.method(global, "fetch", async (url) => String(url).endsWith("/devices") ? response({ devices: [] }) : response({ item: null }));
  const status = await new SpotifyService({ store: f.store, notifyRenderer: () => {} }).status();
  assert.equal(status.connected, true);
  assert.equal(status.devicesKnown, true);
  assert.equal(status.capabilities.canControlPlayback, false);
  assert.equal(status.capabilities.canSearch, true);
});

test("carte Kick : un vrai statut négatif n'est jamais écrasé par un ancien identifiant de secret", () => {
  const context = vm.createContext({ window: {}, snapshot: { state: { settings: { account: { uid: "owner-a" }, kick: { refreshTokenSecretId: "stale", clientId: "old", clientSecretId: "old" } }, connections: [] } }, escapeHtml: String });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app/features/controllers.js"), "utf8"), context);
  vm.runInContext('ensureControllerWorkspace(); kickConnectionStatus = { connected: false, configured: false, receiving: false, message: "Réautorisez Kick" };', context);
  const markup = context.renderKickConnectionCard();
  assert.doesNotMatch(markup, /COMPTE AUTORISÉ/);
  assert.match(markup, /Réautorisez Kick/);
  assert.match(markup, /data-action="kick-connect" disabled/);
});

test("interface musique : contrôles refusés mais demandes/recherche et réautorisation conservées", () => {
  const context = vm.createContext({ window: { ShenPulseSpotifyCapabilities: { spotifyCapabilities } }, spotifyStatus: {
    connected: true, scopes: ["user-read-playback-state"], playback: { item: { name: "Titre", uri: "spotify:track:fixture" } }
  }, escapeHtml: String });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app/features/creator-music.js"), "utf8"), context);
  assert.match(context.renderCreatorMusicPlayer(), /data-operation="play"[^>]*disabled/);
  assert.match(context.creatorMusicConnectionMarkup(), /permission de piloter/);
  assert.match(context.creatorMusicConnectionMarkup(), /Autoriser à nouveau/);
  const row = context.creatorMusicTrackRow({ name: "Titre", uri: "spotify:track:fixture" });
  assert.match(row, /data-action="music-play-track"[^>]*disabled/);
  assert.doesNotMatch(row, /data-action="music-request-add"[^>]*disabled/);
});
