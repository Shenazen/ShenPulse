"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const visibility = require("../src/shared/visibility-catalog");
const { normalizeSiteSettings, normalizePublicVisibility, publicVisibilityDocument } = require("../src/main/admin/configuration");
const { AdminService, ADMIN_EMAIL } = require("../src/main/admin-service");
const { GameHub } = require("../src/main/game-hub");
const { WindowsInputService } = require("../src/main/windows-input-service");
const { snapshotForRenderer } = require("../src/main/account-access");
const { authenticatedFixtureStore } = require("./helpers/authenticated-store");
const { gameCatalogRenderer } = require("./helpers/game-catalog-renderer");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const APP_VERSION = require("../package.json").version;
const jsonResponse = value => ({ ok: true, text: async () => JSON.stringify(value) });
const pack = { id: "versioned-game", name: "Jeu à publier", accessMode: "included", connector: { type: "windows-input", processName: "Fixture.exe" }, effects: [{ id: "jump", name: "Saut", code: "jump", available: true, inputSequence: "k,0,32,2" }] };

function fixture({ owner = false, minimum = "99.0.0", input, appVersion = APP_VERSION } = {}) {
  const state = {
    settings: { account: { uid: "fixture", email: owner ? ADMIN_EMAIL : "viewer@example.test", emailVerified: true, refreshTokenSecretId: "fixture-account" },
      siteVisibility: { schemaVersion: visibility.VISIBILITY_SCHEMA_VERSION, games: { [pack.id]: { scope: "public", minAppVersion: minimum } } } },
    session: { profileId: "profile", activeGamePackId: pack.id },
    commerce: { subscription: { tier: "pro", status: "active", source: "subscription" } },
    game: { connectorOverrides: {}, installations: {}, interactionRulesByPack: { [pack.id]: [{ id: "custom", title: "Mon cadeau", enabled: true }] } }, rules: [{ id: "kept" }]
  };
  const store = authenticatedFixtureStore({ getState: () => state, mutate: fn => fn(state) });
  let requests = 0;
  const hub = new GameHub({ store, appVersion, packsDirectory: "unused", windowsInputService: input || {
    status: async () => { requests += 1; return { ok: true }; }, play: async () => { requests += 1; return { ok: true }; }
  } });
  hub.packs = [pack];
  return { state, store, hub, requests: () => requests };
}

test("les versions sont comparées numériquement, avec préversions et métadonnées", () => {
  for (const [a, b, expected] of [
    ["2.0.4", "2.0.5", -1], ["2.0.5", "2.0.5", 0], ["2.0.10", "2.0.9", 1],
    ["2.1.0", "2.0.99", 1], ["3.0.0", "2.99.99", 1], ["v2.0.5", "2.0.5+store", 0],
    ["2.0.5-beta.2", "2.0.5-beta.10", -1], ["2.0.5-beta", "2.0.5", -1],
    ["2.0.5", "2.0.5-rc.1", 1], ["2.0.5-alpha", "2.0.5-beta", -1],
    ["2.0.5-alpha.1", "2.0.5-alpha", 1], ["2.0.5-1", "2.0.5-alpha", -1],
    ["2.0.5-99999999999999999999", "2.0.5-100000000000000000000", -1]
  ]) assert.equal(visibility.compareAppVersions(a, b), expected, `${a} / ${b}`);
  for (const invalid of [undefined, null, 2.5, "", "2.0", "2.0.5.0", "2.0.5oops", "2.0.5-beta.01", "02.0.5", "2.0.5<script>", "9".repeat(200)]) {
    assert.equal(visibility.compareAppVersions(invalid, "2.0.5"), null);
  }
  assert.equal(visibility.normalizeAppVersion("  v2.0.5  "), "2.0.5");
});

test("une borne publique est inclusive et ne peut ouvrir ni Masqué ni Moi uniquement", () => {
  for (const owner of [false, true]) {
    const source = { games: { [pack.id]: { scope: "public", minAppVersion: "2.0.5" } } };
    for (const version of ["2.0.4", "2.0.5-rc.1", "invalid", undefined]) assert.equal(visibility.canAccessGame(source, pack, owner, version), false);
    for (const version of ["2.0.5", "2.0.10", "3.0.0"]) assert.equal(visibility.canAccessGame(source, pack, owner, version), true);
    source.games[pack.id].scope = "hidden";
    assert.equal(visibility.canAccessGame(source, pack, owner, "3.0.0"), false);
    source.games[pack.id].scope = "admin";
    assert.equal(visibility.canAccessGame(source, pack, owner, "2.0.4"), owner, "le test privé reste possible avant publication");
    delete source.games[pack.id].minAppVersion;
    source.games[pack.id].scope = "public";
    assert.equal(visibility.canAccessGame(source, pack, owner), true, "les jeux existants sans borne restent inchangés");
  }
});

test("les normalisations et la synchronisation conservent versions et choix de logos", () => {
  const source = { games: { [pack.id]: { scope: "public", minAppVersion: " v2.0.5 ", platforms: ["steam", "game-pass"] } } };
  for (const normalize of [normalizeSiteSettings, normalizePublicVisibility]) {
    const settings = normalize(source);
    const result = visibility.canonicalizeVisibility(settings, { games: [{ id: pack.id }] });
    assert.deepEqual(result.games[pack.id], { scope: "public", minAppVersion: "2.0.5", platforms: ["steam", "game-pass"], platformsConfigured: true });
  }
  assert.equal(source.games[pack.id].minAppVersion, " v2.0.5 ", "aucune mutation du document d’origine");
  for (const invalid of ["invalid", false, {}, `2.0.5${" ".repeat(130)}invalid`]) {
    const settings = normalizePublicVisibility({ games: { [pack.id]: { scope: "public", minAppVersion: invalid } } });
    assert.equal(visibility.canAccessGame(settings, pack, false, "99.0.0"), false, "une borne malformée reste restrictive");
  }
});

test("le document Firebase masque les jeux versionnés aux anciens clients et se décode sans perdre la borne", () => {
  const settings = { games: { future: { scope: "public", minAppVersion: "2.0.5", platformsConfigured: true }, hidden: { scope: "hidden", minAppVersion: "2.0.5" }, private: { scope: "admin", minAppVersion: "2.0.5" }, existing: { scope: "public" } } };
  const published = publicVisibilityDocument(settings);
  assert.equal(published.games.future.scope, "hidden");
  assert.equal(published.games.future.versionScope, "public");
  assert.equal(published.games.hidden.versionScope, undefined);
  assert.equal(published.games.private.versionScope, undefined);
  assert.equal(published.games.existing.scope, "public");
  // Firebase supprime les tableaux vides, sans changer la sémantique « aucun logo ».
  delete published.games.future.platforms;
  const restored = normalizePublicVisibility(JSON.parse(JSON.stringify(published)));
  assert.deepEqual(restored.games.future, { scope: "public", platforms: [], platformsConfigured: true, minAppVersion: "2.0.5" });
  assert.equal(visibility.canAccessGame(restored, { id: "future" }, false, "2.0.4"), false);
  assert.equal(visibility.canAccessGame(restored, { id: "future" }, false, "2.0.5"), true);
  assert.deepEqual(publicVisibilityDocument(restored), publicVisibilityDocument(settings));
  assert.equal(normalizePublicVisibility({ games: { future: { scope: "hidden", versionScope: "public" } } }).games.future.scope, "hidden", "aucune ouverture sans borne explicite");
});

test("la publication propriétaire sépare le réglage désiré du document compatible et conserve le cache hors ligne", async () => {
  const requests = [];
  const state = { settings: { admin: {}, siteVisibility: {} } };
  let publicDocument;
  const service = new AdminService({ store: { getState: () => state, set: (_key, value) => { state.settings.siteVisibility = value; } }, accountService: {
    identityForInternalUse: async () => ({ email: ADMIN_EMAIL, emailVerified: true, uid: "owner", idToken: "fixture-token" })
  }, fetchImpl: async (url, options = {}) => {
    if (options.method !== "PUT") return jsonResponse(publicDocument);
    const body = JSON.parse(options.body); requests.push({ url: String(url), body });
    if (url.includes("publicVisibility")) publicDocument = body;
    return jsonResponse(body);
  } });
  const settings = await service.saveSiteSettings({ games: { [pack.id]: { scope: "public", minAppVersion: "2.0.5", platforms: ["steam"] } } });
  assert.equal(settings.games[pack.id].scope, "public");
  assert.equal(requests.find(r => r.url.includes("adminSettings")).body.games[pack.id].scope, "public");
  assert.equal(publicDocument.games[pack.id].scope, "hidden");
  assert.equal(state.settings.siteVisibility.games[pack.id].minAppVersion, "2.0.5");
  assert.deepEqual((await service.getPublicVisibility()).games, settings.games);
  service.fetch = async () => { throw new Error("hors ligne"); };
  assert.deepEqual((await service.getPublicVisibility()).games, settings.games);
});

test("une version invalide est refusée avant toute écriture distante", async () => {
  let requests = 0;
  const service = new AdminService({ store: { getState: () => ({ settings: {} }) }, fetchImpl: async () => { requests += 1; return jsonResponse({}); } });
  for (const value of ["2.0", "invalid", {}, false]) {
    await assert.rejects(service.saveSiteSettings({ games: { [pack.id]: { scope: "public", minAppVersion: value } } }), /Version minimale ShenPulse invalide/);
  }
  assert.equal(requests, 0);
});

test("la galerie, les modes Minecraft et tous les compteurs attendent la bonne version", t => {
  const catalog = loadShenazenGameCatalog(path.resolve(__dirname, "../resources"));
  const packs = ["hades", "ark-survival-ascended", "minecraft-bedrock-box", "minecraft-sandbox-3"].map(id => catalog.find(pack => pack.id === id));
  const f = gameCatalogRenderer(packs, { owner: true }); t.after(f.close);
  f.context.snapshot.appVersion = "2.0.4";
  f.context.siteVisibility.games = { "ark-survival-ascended": { scope: "public", minAppVersion: "2.0.5" }, "minecraft-sandbox-3": { scope: "public", minAppVersion: "2.0.5" } };
  for (const [version, count, modes] of [["2.0.4", 2, 1], ["2.0.5", 4, 2], ["2.0.10", 4, 2]]) {
    f.context.snapshot.appVersion = version;
    const page = f.render();
    assert.equal(Number(page.querySelector('[data-value="all"] .game-category-count').textContent), count);
    assert.equal(f.context.ShenPulseGameCategories.countGames(f.context.visibleGamePacks()), count, "même total que la navigation");
    assert.equal(f.context.visibleGamePacks().find(pack => pack.id === "minecraft").modes.length, modes);
    assert.equal(Boolean(page.querySelector('.game-gallery-tile[data-id="ark-survival-ascended"]')), count === 4);
    assert.equal(f.context.snapshot.packs.length, 4, "le catalogue complet reste disponible pour la console propriétaire");
  }
});

test("le backend bloque diagnostic, effet et accès direct sous la version minimale, sans toucher aux associations", async () => {
  for (const owner of [false, true]) {
    const f = fixture({ owner });
    const associations = JSON.stringify({ game: f.state.game, rules: f.state.rules });
    await assert.rejects(f.hub.testConnection(pack.id), { code: "GAME_APP_VERSION_REQUIRED" });
    await assert.rejects(f.hub.trigger("jump", {}, { packId: pack.id }), { code: "GAME_APP_VERSION_REQUIRED" });
    assert.equal(f.requests(), 0);
    assert.equal(JSON.stringify({ game: f.state.game, rules: f.state.rules }), associations);
    const snapshot = snapshotForRenderer({ state: f.state, packs: [pack], appVersion: APP_VERSION }, f.store);
    assert.equal(snapshot.packs.length, owner ? 1 : 0, "seul le propriétaire conserve le catalogue à administrer");
    f.state.settings.siteVisibility.games[pack.id].minAppVersion = APP_VERSION;
    assert.equal((await f.hub.testConnection(pack.id)).ok, true);
    assert.equal((await f.hub.trigger("jump", {}, { packId: pack.id })).status, "success");
    assert.equal(f.requests(), 2);
  }
});

test("relever la version minimale annule aussi une interaction déjà en attente dans la file clavier", async () => {
  let release, started;
  const blocked = new Promise(resolve => { release = resolve; });
  const running = new Promise(resolve => { started = resolve; });
  let requests = 0;
  const input = new WindowsInputService({ execute: async () => { requests += 1; started(); await blocked; return { ok: true }; } });
  const f = fixture({ minimum: APP_VERSION, input });
  const first = f.hub.trigger("jump", {}, { packId: pack.id });
  await running;
  const second = f.hub.trigger("jump", {}, { packId: pack.id });
  const rejected = assert.rejects(second, { code: "GAME_APP_VERSION_REQUIRED" });
  f.state.settings.siteVisibility.games[pack.id].minAppVersion = "99.0.0";
  release();
  await first; await rejected;
  assert.equal(requests, 1);
});

test("le transport utilise la version de l’application fournie par le runtime, jamais un réglage du jeu", async () => {
  const below = fixture({ minimum: "2.0.5", appVersion: "2.0.4" });
  below.state.game.connectorOverrides[pack.id] = { appVersion: "99.0.0", minAppVersion: "0.0.0" };
  await assert.rejects(below.hub.trigger("jump", {}, { packId: pack.id }), { code: "GAME_APP_VERSION_REQUIRED" });
  assert.equal(below.requests(), 0);
  for (const appVersion of ["2.0.5", "2.0.10", "3.0.0"]) {
    const upgraded = fixture({ minimum: "2.0.5", appVersion });
    assert.equal((await upgraded.hub.trigger("jump", {}, { packId: pack.id })).status, "success");
    assert.equal(upgraded.requests(), 1);
  }
});
