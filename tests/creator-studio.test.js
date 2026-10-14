"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const { createDefaultState } = require("../src/main/defaults");
const { ActionRunner, filterTtsChatComment } = require("../src/main/action-runner");
const liveStatistics = require("../src/shared/live-statistics");

function source(name) {
  return fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "app", "features", name), "utf8");
}

function rendererContext(t) {
  const dom = new JSDOM('<main id="content"></main>', { pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const state = createDefaultState();
  const context = vm.createContext({
    document: dom.window.document,
    window: dom.window,
    content: dom.window.document.getElementById("content"),
    snapshot: { state, packs: [] },
    liveEvents: [],
    ShenPulseLiveStatistics: liveStatistics,
    currentPage: "dashboard",
    isAccountAuthenticated: () => true,
    renderStudioHero: (id, title) => `<section data-hero="${id}">${title}</section>`,
    canNavigateTo: () => true,
    visibleActivityEntries: (value) => value.activity,
    giftForIdentity: () => null,
    giftPickerField: () => '<label>Cadeau<input name="giftName" value="Rose"></label>',
    eventIcons: {},
    escapeHtml: (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"),
    asNumber: (value) => String(value || 0),
    formatTime: (value) => value || "—",
    normalizeCatalogSearch: (value) => String(value || "").toLowerCase(),
    setTimeout,
    renderPrivateDataPlaceholder: () => "private"
  });
  vm.runInContext(`${source("dashboard.js")}\n${source("creator-users.js")}`, context);
  return context;
}

test("les actualisations du dashboard conservent le cadeau saisi et le focus du simulateur", (t) => {
  const context = rendererContext(t);
  context.content.innerHTML = context.renderDashboard();
  const giftInput = context.content.querySelector('[name="giftName"]');
  const userInput = context.content.querySelector('[name="username"]');
  giftInput.value = "Galaxy";
  userInput.value = "alice_test";
  giftInput.focus();
  context.snapshot.state.statistics.sessionEvents = 42;
  context.snapshot.state.overlaySession.leaderboards.donors = [{ id: "alice", name: "Alice", score: 900 }];
  Object.assign(context.snapshot.state.statistics.liveSession, { hasData: true, likes: 42,
    participants: [{ id: "alice", name: "Alice", username: "alice", coins: 900, gifts: 2 }] });
  assert.equal(context.syncDashboardRuntime(), true);
  assert.equal(context.content.querySelector('[name="giftName"]'), giftInput);
  assert.equal(giftInput.value, "Galaxy");
  assert.equal(userInput.value, "alice_test");
  assert.equal(context.document.activeElement, giftInput);
  assert.match(context.content.querySelector("[data-dashboard-stats]").textContent, /42/);
  assert.match(context.content.querySelector("[data-dashboard-donors]").textContent, /Alice.*900/);
});

test("le repli des anciennes sessions évite les doublons et conserve les classements enregistrés", (t) => {
  const context = rendererContext(t);
  const event = { id: "gift_1", type: "gift", timestamp: "2026-10-13T10:01:00Z", user: { id: "alice", name: "alice", displayName: "Alice" }, data: { count: 2, value: 10 } };
  context.snapshot.state.overlaySession.startedAt = "2026-10-13T10:00:00Z";
  context.snapshot.state.overlaySession.recentEvents = [event];
  context.snapshot.state.overlaySession.leaderboards.donors = [{ id: "alice", name: "Alice", score: 150 }];
  context.liveEvents = [event];
  context.rememberCreatorAudienceEvent(event);
  let rows = context.creatorAudienceRows();
  assert.equal(rows[0].events, 1);
  assert.equal(rows[0].gifts, 2);
  assert.equal(rows[0].coins, 150);
  context.creatorAudienceRows();
  assert.equal(context.creatorAudienceRows()[0].events, 1);
  context.snapshot.state.overlaySession.startedAt = "2026-10-13T11:00:00Z";
  context.snapshot.state.overlaySession.leaderboards.donors = [];
  rows = context.creatorAudienceRows();
  assert.equal(rows.length, 0, "les événements de la session précédente ne doivent pas ressurgir");
});

test("la recherche de l'historique parcourt la base entière et les événements ne remplacent pas son champ", async (t) => {
  const context = rendererContext(t);
  context.currentPage = "users";
  const viewers = Array.from({ length: 450 }, (_, index) => ({ id: `viewer_${index}`, username: `viewer_${index}`, name: `viewer_${index}`, platform: "tiktok", streamer: "creator", diamonds: 0 }));
  context.api = { users: { snapshot: async ({ query, limit, offset }) => {
    const rows = viewers.filter((row) => !query || row.username.includes(query));
    return { rows: rows.slice(offset, offset + limit), total: viewers.length, filteredTotal: rows.length, stats: { diamonds: 0 }, blockedUsers: [], streamers: ["creator"] };
  } } };
  context.content.innerHTML = context.renderCreatorUsers();
  await context.refreshCreatorUsersDatabase({ force: true });
  assert.equal(context.content.querySelectorAll("[data-creator-user-row]").length, 50);
  const search = context.content.querySelector("[data-creator-user-search]");
  search.value = "viewer_449";
  search.focus();
  await context.filterCreatorUsers(search);
  assert.equal(context.content.querySelectorAll("[data-creator-user-row]").length, 1);
  context.syncCreatorUsersRuntime();
  assert.equal(context.content.querySelector("[data-creator-user-search]"), search);
  assert.equal(context.document.activeElement, search);
  assert.match(context.content.querySelector("[data-creator-users-table]").textContent, /viewer_449/);
});

test("cent événements successifs ne déclenchent qu'une seule actualisation sur la frame suivante", (t) => {
  const context = rendererContext(t);
  const callbacks = [];
  const counts = { render: 0, navigation: 0, chrome: 0, dashboard: 0 };
  context.window.requestAnimationFrame = (callback) => callbacks.push(callback);
  context.render = () => { counts.render += 1; };
  context.renderNavigation = () => { counts.navigation += 1; };
  context.syncChrome = () => { counts.chrome += 1; };
  context.syncDashboardRuntime = () => { counts.dashboard += 1; return true; };
  context.syncPublicOverlayRelayStatus = () => {};
  vm.runInContext(source("creator-performance.js"), context);
  for (let index = 0; index < 100; index += 1) context.scheduleRendererRefresh({ dashboard: true });
  assert.equal(callbacks.length, 1);
  assert.equal(counts.chrome, 0);
  callbacks.shift()();
  assert.deepEqual(counts, { render: 0, navigation: 1, chrome: 1, dashboard: 1 });
  context.scheduleRendererRefresh({ dashboard: true });
  context.scheduleRendererRefresh({ redraw: true });
  callbacks.shift()();
  assert.equal(counts.render, 1);
});

test("un événement du live n'invalide pas les formulaires audio et les actions inchangées", (t) => {
  const context = rendererContext(t);
  vm.runInContext(source("creator-performance.js"), context);
  const before = context.snapshot;
  const after = { ...before, state: { ...before.state, statistics: { ...before.state.statistics, sessionEvents: 100 }, activity: [{ title: "Cadeau reçu" }] } };
  for (const page of ["home", "actions", "voice", "music", "sounds"]) {
    assert.equal(context.creatorPageStateSignature(before, page), context.creatorPageStateSignature(after, page), page);
  }
  assert.notEqual(context.creatorPageStateSignature(before, "dashboard"), context.creatorPageStateSignature(after, "dashboard"));
});

test("Dashboard et Utilisateurs détectent un changement du compteur projeté sans tableaux d'identités", (t) => {
  const context = rendererContext(t);
  vm.runInContext(source("creator-performance.js"), context);
  const before = context.snapshot;
  const projected = { ...before, state: { ...before.state, statistics: { ...before.state.statistics,
    sessionUniqueViewerCount: 20, sessionUniqueViewers: [] } } };
  for (const page of ["dashboard", "users"]) assert.equal(context.creatorPageDataChanged(before, projected, page), true, page);
  for (const page of ["home", "actions", "music"]) assert.equal(context.creatorPageDataChanged(before, projected, page), false, page);
  const legacy = { ...before, state: { ...before.state, statistics: { ...before.state.statistics, sessionUniqueViewers: Array.from({ length: 20 }, (_, index) => String(index)) } } };
  for (const page of ["dashboard", "users"]) assert.equal(context.creatorPageDataChanged(projected, legacy, page), false, page);
});

test("les droits commerce et les configurations des nouveaux modules invalident leurs pages", (t) => {
  const context = rendererContext(t);
  vm.runInContext(source("creator-performance.js"), context);
  const before = context.snapshot;
  const upgraded = { ...before, state: { ...before.state, commerce: { ...before.state.commerce, subscription: { tier: "pro", status: "active" } } } };
  for (const page of ["home", "actions", "voice", "music", "studio", "controllers", "games", "overlays", "membership"]) assert.equal(context.creatorPageDataChanged(before, upgraded, page), true, page);
  for (const [page, field] of [["controllers", "controllers"], ["connections", "kick"], ["overlays", "overlayScene"]]) {
    const next = { ...before, state: { ...before.state, settings: { ...before.state.settings, [field]: { changed: true } } } };
    assert.equal(context.creatorPageDataChanged(before, next, page), true, field);
  }
});

test("le mode léger regroupe les actualisations sur 100 ms", (t) => {
  const context = rendererContext(t);
  const callbacks = [];
  context.studioLightMode = true;
  context.setTimeout = (callback, delay) => { callbacks.push({ callback, delay }); };
  context.render = () => {};
  vm.runInContext(source("creator-performance.js"), context);
  context.scheduleRendererRefresh({ redraw: true });
  context.scheduleRendererRefresh({ redraw: true });
  assert.equal(callbacks.length, 1);
  assert.equal(callbacks[0].delay, 100);
  callbacks[0].callback();
});

test("l’accueil ne reconstruit plus de galerie : seuls les accès l’invalident, jamais le catalogue ni le LIVE", (t) => {
  const context = rendererContext(t);
  vm.runInContext(source("creator-performance.js"), context);
  const before = context.snapshot;
  const live = { ...before, state: { ...before.state, session: { ...before.state.session, running: true }, connections: [{ status: "connected" }], statistics: { ...before.state.statistics, sessionEvents: 20, sessionUniqueViewerCount: 10 }, overlaySession: { leaderboards: { donors: [{ name: "Private viewer", score: 100 }] } } } };
  assert.equal(context.creatorPageDataChanged(before, live, "home"), false);
  const catalog = { ...before, packs: [{ id: "connect-four", name: "Connect Four" }] };
  assert.equal(context.creatorPageDataChanged(before, catalog, "home"), false, "La galerie retirée ne doit plus invalider les illustrations fixes de l’accueil.");
  assert.equal(context.creatorPageDataChanged(before, catalog, "games"), true, "Le catalogue unique continue de se mettre à jour dans Jeux.");
  const account = { ...before, state: { ...before.state, settings: { ...before.state.settings, account: { uid: "signed-in-user" } } } };
  assert.equal(context.creatorPageDataChanged(before, account, "home"), true);
  const subscription = { ...before, state: { ...before.state, commerce: { ...before.state.commerce, subscription: { tier: "pro", status: "active" } } } };
  assert.equal(context.creatorPageDataChanged(before, subscription, "home"), true, "Un changement d’abonnement actualise les accès de l’accueil.");
  const visibility = { ...before, state: { ...before.state, settings: { ...before.state.settings, siteVisibility: { ...before.state.settings.siteVisibility, navigation: { games: "hidden" } } } } };
  assert.equal(context.creatorPageDataChanged(before, visibility, "home"), true, "Masquer une destination retire aussi ses raccourcis de l’accueil.");
  assert.equal(context.creatorPageDataChanged(before, { ...catalog, state: visibility.state }, "home"), true, "Un accès modifié reste prioritaire même si le catalogue change en même temps.");
  assert.equal(context.creatorPageDataChanged(before, JSON.parse(JSON.stringify(before)), "home"), false, "Une copie des mêmes droits ne provoque aucun rendu supplémentaire.");
});

test("le catalogue partagé de l’accueil ne mélange pas les jeux communautaires avec les intégrations PC", (t) => {
  const context = rendererContext(t);
  const packs = [{ id: "connect-four", name: "Connect Four", effects: [] }, { id: "minecraft", name: "Minecraft", effects: [] }];
  context.visibleGamePacks = () => packs;
  context.SHENPULSE_PLATFORM_GAME_IDS = new Set(["connect-four"]);
  vm.runInContext(source("games/community.js"), context);
  assert.deepEqual(Array.from(context.creatorCommunityGames(), (pack) => pack.id), ["connect-four"]);
});

test("la modération TTS filtre rôles, comptes, expressions accentuées et longueur", async () => {
  assert.equal(filterTtsChatComment("Un message INTERDÎT", { blockedWords: ["interdit"] }), "");
  assert.equal(filterTtsChatComment("trop long", { maxCharacters: 3 }), "");
  assert.equal(filterTtsChatComment("OK", { maxCharacters: 3 }), "OK");
  const published = [];
  const runner = new ActionRunner({ store: { getState: () => ({ settings: { tts: { enabled: true } } }) }, overlayServer: { publish: () => {} }, notifyRenderer: (event, payload) => published.push(payload) });
  const event = (id, user) => ({ event: { id, type: "chat", user, data: { message: `Bonjour ${id}` } } });
  const action = { type: "tts.speak", config: { allowedRoles: ["subscriber", "moderator"], blockedUsers: ["@bob"] } };
  assert.equal((await runner.run(action, event("one", { name: "alice" }))).reason, "audience-filter");
  assert.equal((await runner.run(action, event("two", { name: "bob", subscriber: true }))).reason, "audience-filter");
  assert.equal((await runner.run(action, event("three", { name: "carol", moderator: true }))).queued, true);
  assert.equal(published.length, 1);
  // Les règles existantes sans politique de rôles gardent leur comportement.
  assert.equal((await runner.run({ type: "tts.speak", config: {} }, event("four", { name: "viewer" }))).queued, true);
});

test("la demande !song retire la commande et ignore les commentaires sans titre ou hors commande", async () => {
  const requests = [];
  const runner = new ActionRunner({ store: { getState: () => ({ settings: {} }) }, spotifyService: { control: async (config) => { requests.push(config); return { ok: true }; } } });
  const action = { type: "spotify.queue", config: { chatCommand: "!song", operation: "queue", uri: "!song ancien titre", maxDurationMinutes: 10, allowExplicit: false } };
  const run = (message) => runner.run(action, { event: { type: "chat", data: { message } } });
  assert.equal((await run("!song Daft Punk One More Time")).ok, true);
  assert.equal(requests[0].query, "Daft Punk One More Time");
  assert.equal(requests[0].uri, "");
  assert.equal(requests[0].allowExplicit, false);
  assert.equal((await run("bonjour !song Daft Punk")).reason, "song-command");
  assert.equal((await run("!song")).reason, "empty-song-request");
  assert.equal(requests.length, 1);
});
