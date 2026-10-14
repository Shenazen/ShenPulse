"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");
const { JSDOM, VirtualConsole } = require("jsdom");
const { createDefaultState } = require("../src/main/defaults");
const { selectStatePaths } = require("../src/main/state-projection");
const { OverlayServer } = require("../src/main/overlay-server");
const { MATCH_WIDGET_KEYS, MATCH_OVERLAY_STATE_PATHS, projectMatchesOverlayState } = require("../src/main/matches-overlay-state");
const { MatchesService } = require("../src/main/matches/service");
const { normalizeTikTokBattle } = require("../src/main/matches/tiktok-battle");
const { createMatchSession, normalizeMatchesConfig } = require("../src/shared/matches-contract");
const catalog = require("../resources/overlays/overlay-catalog");
const directory = path.resolve(__dirname, "../resources/overlays");
const avatar = "https://p16-sign-sg.tiktokcdn.com/public-avatar.webp";

function fixture() {
  const state = createDefaultState();
  state.settings.account = { uid: "fixture-owner", email: "fixture@example.invalid", refreshTokenSecretId: "fixture-token" };
  state.commerce.subscription = { tier: "pro", status: "active" };
  state.settings.overlayToken = "fixture-overlay-token";
  state.settings.apiToken = "fixture-api-token";
  state.settings.matches = { automations: [{ action: { device: "private-device", token: "private-token" } }], widgets: Object.fromEntries(MATCH_WIDGET_KEYS.map((key) => [key, { enabled: true, title: key, theme: "neon" }])) };
  state.matchSession = { status: "active", battleId: "private-battle", roomId: "private-room", ownerUid: "private-owner", timing: { endsAtMs: Date.now() + 60000 }, participants: [
    { id: "private-player", own: true, username: "creator", displayName: "Créateur", avatarUrl: avatar, score: 30, result: "win", donors: [{ id: "private-donor", username: "donor", score: 5, avatarUrl: avatar }] },
    { id: "private-opponent", username: "opponent", displayName: "Adversaire", avatarUrl: avatar, score: null }
  ], session: { battles: 3, wins: 2, losses: 1, draws: 0, winStreak: 2 }, rounds: { own: 2, opponent: 1 }, history: [{ secret: "private-history" }],
  liveContributors: [{ id: "private-contributor", username: "top_donor", displayName: "Top donor", avatarUrl: avatar, diamonds: 90, gifts: 3, likes: 10 }],
  lastGift: { user: { id: "private-last", username: "last_donor", displayName: "Dernier", avatarUrl: avatar }, giftName: "Rose", count: 2, value: 1, atMs: Date.now() },
  lastContribution: { type: "like", user: { id: "private-like", username: "last_like", avatarUrl: avatar }, count: 15, atMs: Date.now() } };
  const reads = [];
  const store = { getState: () => { throw new Error("No full-state cloning"); }, getAccountSession: () => state.settings.account, getActiveAccountUid: () => state.settings.account.uid,
    getSecret: () => "fixture-auth-token", getStateProjection: (paths) => { reads.push([...paths]); return selectStatePaths(state, paths); } };
  const relay = [], sockets = [];
  const server = new OverlayServer({ store, staticDirectory: directory, onInboundEvent: async () => {}, onEffectRequest: async () => ({}), publicRelay: { publish: (...args) => relay.push(args) } });
  server.webSockets = { broadcast: (value) => sockets.push(value), close() {} };
  return { state, store, reads, relay, sockets, server };
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { const port = server.address().port; server.close(() => resolve(port)); });
  });
}

function recordedClient(server, state) {
  const response = { output: "", ended: false, write(value) { this.output += value; }, end() { this.ended = true; } };
  server.sseClients.add({ view: "match-widget", response, matchesIdentity: JSON.stringify([state.settings.account.uid, state.session.profileId || ""]) });
  return response;
}

async function loadWidget(t, key) {
  const file = path.join(directory, "index.html");
  const url = pathToFileURL(file);
  url.search = new URLSearchParams({ view: "match-widget", widget: key, preview: "static", native: "1" });
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => errors.push(error));
  const dom = new JSDOM(fs.readFileSync(file, "utf8"), { url: url.toString(), runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole });
  t.after(() => dom.window.close());
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Widget runtime did not load")), 5000);
    dom.window.addEventListener("load", () => { clearTimeout(timer); setTimeout(resolve, 0); }, { once: true });
  });
  assert.deepEqual(errors, []);
  return dom.window;
}

test("une correction du duo sans scores se voit sur la source, sans transformer les scores absents en zéro", async (t) => {
  const { state } = fixture();
  state.matchSession.participants.forEach((person) => { person.score = null; });
  state.matchSession.rounds = { own: null, opponent: null };
  state.matchSession.manualWins = 7;
  state.matchSession.lastGift = null;
  const window = await loadWidget(t, "wins");
  window.hydrateMatchWidget(projectMatchesOverlayState(state));
  const stage = window.document.getElementById("match-widget-stage");
  assert.equal(stage.querySelector(".match-duo-rounds").textContent, "7");
  assert.deepEqual([...stage.querySelectorAll(".match-duo-score")].map((node) => node.textContent), ["— POINTS", "— POINTS"]);
  window.stopMatchWidget();
});

test("les sept routes Matchs sont locales Pro sans duplication du catalogue Overlays ni URL publique", () => {
  const routes = catalog.routes.filter((row) => row.view === "match-widget");
  assert.equal(routes.length, 7);
  assert.equal(catalog.definitions.some((row) => row.route.view === "match-widget"), false);
  const publicUrls = catalog.buildUrls({ baseUrl: "https://fixture.invalid", credentialName: "channel", credentialValue: "public", publicDelivery: true });
  const freeUrls = catalog.buildUrls({ baseUrl: "http://127.0.0.1", credentialName: "token", credentialValue: "local", proAccess: false });
  for (const route of routes) { assert.equal(route.public, false); assert.equal(route.requiresPro, true); assert.equal(publicUrls[route.key], ""); assert.equal(freeUrls[route.key], ""); }
  assert.equal(catalog.acceptsChannel({ view: "scene", channel: "match-state" }), false);
  assert.equal(catalog.acceptsChannel({ view: "match-widget", channel: "configuration" }), false);
  assert.equal(catalog.acceptsChannel({ view: "match-widget", channel: "match-state" }), true);
});

test("la projection Matchs retire identifiants, historique, automatismes et URL d'avatar non autorisée", () => {
  const { state } = fixture();
  state.matchSession.participants[1].avatarUrl = "https://tiktokcdn.com.attacker.invalid/avatar.png";
  state.matchSession.liveContributors = Array.from({ length: 220 }, () => state.matchSession.liveContributors[0]);
  state.settings.matches.widgets.wins.colors = { primary: "url(https://private.invalid)", secondary: "#f0f" };
  const output = projectMatchesOverlayState(state);
  assert.equal(output.session.liveContributors.length, 200);
  assert.equal(output.session.participants[0].avatarUrl, avatar);
  assert.equal(output.session.participants[1].avatarUrl, "");
  assert.equal(output.config.widgets.wins.colors.primary, "#b865ff");
  assert.equal(output.config.widgets.wins.colors.secondary, "#f0f");
  assert.equal(output.session.participants[1].score, null, "un score inconnu n'est pas inventé à zéro");
  assert.doesNotMatch(JSON.stringify(output), /private-|battleId|roomId|ownerUid|automations|history/);
  assert.equal(MATCH_OVERLAY_STATE_PATHS.some((key) => /history|automations|pairRounds/.test(key)), false);
  state.matchSession.preview = { widget: "wins", expiresAtMs: Date.now() - 1 };
  assert.equal(projectMatchesOverlayState(state).session.preview, undefined);
  state.matchSession.preview.expiresAtMs = Date.now() + 60000;
  assert.equal(projectMatchesOverlayState(state).session.preview, undefined);
});

test("publier Matchs sans source ne lit aucun état, et les sources locales ne diffusent ni au relais ni aux WebSockets", () => {
  const { server, state, reads, relay, sockets } = fixture();
  server.publish("match-state", projectMatchesOverlayState(state));
  assert.deepEqual(reads, []);
  const client = recordedClient(server, state);
  server.publish("match-state", { ...projectMatchesOverlayState(state), extraSecret: "private-secret" });
  server.publish(" MATCH-STATE ", { ...projectMatchesOverlayState(state), extraSecret: "private-secret" });
  assert.match(client.output, /event: match-state/);
  assert.doesNotMatch(client.output, /private-|extraSecret/);
  assert.deepEqual(relay, []);
  assert.deepEqual(sockets, []);
  const paths = reads.flat();
  assert.equal(paths.some((key) => key === "profiles" || key === "matchSession"), false);
});

test("une source Matchs ouverte est révoquée au changement de compte, de profil, de visibilité ou de palier", () => {
  for (const mutate of [
    (state) => { state.settings.account.uid = "next-account"; },
    (state) => { state.session.profileId = "next-profile"; },
    (state) => { state.settings.account = {}; },
    (state) => { state.commerce.subscription = { tier: "free", status: "active" }; },
    (state) => { state.settings.siteVisibility.navigation.matches = "hidden"; },
    (state) => { state.commerce.subscription = { tier: "pro", status: "trial", source: "trial", expiresAt: new Date(Date.now() - 1).toISOString() }; }
  ]) {
    const { server, state } = fixture();
    const client = recordedClient(server, state);
    mutate(state);
    server.publish("match-state", projectMatchesOverlayState(state));
    assert.equal(client.ended, true);
    assert.match(client.output, /event: access-revoked/);
    assert.doesNotMatch(client.output, /event: match-state/);
    assert.equal(server.sseClients.size, 0);
  }
});

test("documents, bootstrap et SSE Matchs contrôlent l'accès complet, sans échappatoire preview/api", { timeout: 10000 }, async () => {
  const { server, state } = fixture();
  state.settings.overlayPort = await freePort(); state.settings.apiPort = await freePort();
  try {
    const urls = await server.start();
    const base = `http://127.0.0.1:${state.settings.overlayPort}`;
    assert.match(urls.matchesWins, /view=match-widget/);
    const response = await fetch(`${base}/api/state?view=match-widget&token=${state.settings.overlayToken}`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.deepEqual(Object.keys(data), ["matches"]);
    assert.doesNotMatch(JSON.stringify(data), /private-|profiles|roomId|automations|history/);
    const controller = new AbortController();
    const sse = await fetch(`${base}/events?view=match-widget&token=${state.settings.overlayToken}`, { signal: controller.signal });
    assert.equal(sse.status, 200);
    const reader = sse.body.getReader();
    const initial = new TextDecoder().decode((await reader.read()).value);
    assert.match(initial, /bootstrap/); assert.match(initial, /"matches"/); assert.doesNotMatch(initial, /private-/);
    controller.abort();
    state.commerce.subscription.tier = "free";
    assert.equal(server.urls().matchesWins, "");
    assert.equal(server.urls({ includeRestricted: true }).matchesWins, "");
    for (const target of [`${urls.matchesWins}&preview=static`, `${urls.matchesWins}&preview=animated&embedded=scene`, `${base}/overlay/index.html?view=match-widget&preview=static&token=${state.settings.overlayToken}`, `${base}/overlay/INDEX.HTML?view=match-widget&preview=animated&token=${state.settings.overlayToken}`, `${base}/api/state?view=match-widget&token=${state.settings.overlayToken}`, `${base}/events?view=match-widget&token=${state.settings.overlayToken}`]) {
      assert.equal((await fetch(target)).status, 403);
    }
    state.commerce.subscription.tier = "pro"; state.settings.account = {};
    assert.equal((await fetch(urls.matchesWins)).status, 403);
    state.settings.account = { uid: "fixture-owner", email: "fixture@example.invalid", refreshTokenSecretId: "fixture-token" };
    state.settings.siteVisibility.navigation.matches = "hidden";
    assert.equal((await fetch(urls.matchesWins)).status, 403);
  } finally { await server.stop(); }
});

test("les widgets réels chargent seulement leur moteur, attendent les vrais événements et affichent les données sûres", async (t) => {
  const { state } = fixture();
  for (const key of MATCH_WIDGET_KEYS) {
    const window = await loadWidget(t, key);
    const stage = window.document.getElementById("match-widget-stage");
    assert.equal(stage.hidden, true, `${key} ne présente pas de démonstration au démarrage`);
    const scripts = [...window.document.scripts].map((node) => node.src);
    assert.equal(scripts.some((url) => /runtime\/widgets\/match-widgets\.js/.test(url)), true);
    assert.equal(scripts.some((url) => /coin-jar|wheel-animation|vendor\/lottie/.test(url)), false);
    if (key === "victory") { state.matchSession.status = "ended"; state.matchSession.endedAtMs = Date.now(); }
    window.hydrateMatchWidget(projectMatchesOverlayState(state));
    assert.equal(stage.hidden, false);
    if (key === "wins") { assert.equal(stage.querySelectorAll(".match-duo-team").length, 2); assert.match(stage.textContent, /2MANCHES/); }
    if (key === "starDonor") { assert.match(stage.textContent, /last_like/); assert.match(stage.textContent, /Merci pour 15 likes/); }
    if (key === "topDonor") assert.match(stage.textContent, /top_donor/);
    if (key === "donors") { assert.match(stage.textContent, /90 PIÈCES/); assert.match(stage.textContent, /10 LIKES/); }
    if (key === "timer") assert.match(stage.textContent, /2 VICTOIRES D’AFFILÉE/);
    if (key === "victory") assert.match(stage.textContent, /VICTOIRE2 MANCHES/);
    if (key === "scoreboard") assert.equal(stage.querySelectorAll(".match-score")[1].textContent, "—");
    const header = stage.querySelector("header");
    window.hydrateMatchWidget(projectMatchesOverlayState(state));
    assert.equal(stage.querySelector("header"), header, "un payload identique ne reconstruit pas la source");
    state.settings.matches.widgets[key].enabled = false;
    window.hydrateMatchWidget(projectMatchesOverlayState(state));
    assert.equal(stage.hidden, true);
    state.settings.matches.widgets[key].enabled = true;
    window.stopMatchWidget();
  }
});

test("les noms, messages personnalisés et avatars Matchs ne créent jamais de HTML actif", async (t) => {
  const window = await loadWidget(t, "starDonor");
  const { state } = fixture();
  state.matchSession.lastContribution = { type: "like", count: 12, user: { username: '<img src=x onerror="window.pwned=1">', avatarUrl: "javascript:alert(1)" } };
  state.settings.matches.widgets.starDonor.likeMessage = "<script>window.pwned=1</script> {n} likes";
  window.hydrateMatchWidget(projectMatchesOverlayState(state));
  const stage = window.document.getElementById("match-widget-stage");
  assert.match(stage.textContent, /<script>window.pwned=1<\/script> 12 likes/);
  assert.equal(stage.querySelector("script, img"), null);
  assert.equal(window.pwned, undefined);
  window.stopMatchWidget();
});

test("les paramètres visuels Matchs atteignent réellement la source sans contrôle fantôme", async (t) => {
  const window = await loadWidget(t, "wins");
  const { state } = fixture();
  state.settings.matches.widgets.wins = { enabled: true, title: "MES MANCHES", theme: "classic", animation: "slide", backgroundOpacity: 0, borderRadius: 40,
    colors: { primary: "#abcdef", secondary: "#123456", text: "#fedcba" }, donorPhoto: false, showScores: false, switchSeconds: 20, goal: 15, customText: "<b>Mon texte</b>" };
  window.hydrateMatchWidget(projectMatchesOverlayState(state));
  const stage = window.document.getElementById("match-widget-stage");
  assert.equal(stage.dataset.theme, "classic");
  assert.equal(stage.style.getPropertyValue("--match-opacity"), "0");
  assert.equal(stage.style.borderRadius, "40px");
  assert.equal(stage.style.getPropertyValue("--match-primary"), "#abcdef");
  assert.equal(stage.querySelector(".match-widget-heading > strong").textContent, "MES MANCHES");
  assert.equal(stage.querySelector(".match-duo-score"), null);
  assert.match(stage.querySelector(".match-duo-team.is-own").textContent, /creator/);
  assert.match(stage.querySelector("footer").textContent, /OBJECTIF 15/);
  assert.equal(stage.querySelector(".match-widget-custom-text").textContent, "<b>Mon texte</b>");
  assert.equal(stage.querySelector(".match-widget-custom-text b"), null);
  assert.equal(stage.querySelector(".match-widget-body").classList.contains("match-enter-slide"), true);
  window.stopMatchWidget();
});

test("le chrono déclenche le repère Snipe à 30 secondes et un aperçu expire sans altérer les vrais compteurs", async (t) => {
  const window = await loadWidget(t, "timer");
  const { state } = fixture();
  const now = Date.now();
  state.matchSession.timing.endsAtMs = now + 25000;
  window.Date.now = () => now;
  window.hydrateMatchWidget(projectMatchesOverlayState(state, now));
  const stage = window.document.getElementById("match-widget-stage");
  assert.equal(stage.classList.contains("is-snipe"), true);
  assert.equal(stage.querySelector(".match-widget-timer").textContent, "00:25");
  const baseline = JSON.stringify(state.matchSession);
  state.settings.matches.widgets.timer.enabled = false;
  const preview = projectMatchesOverlayState({ ...state, matchSession: { ...state.matchSession, preview: { widget: "timer", expiresAtMs: now + 5000 } } }, now);
  window.hydrateMatchWidget(preview);
  assert.equal(stage.hidden, false);
  assert.match(stage.textContent, /APERÇU/);
  assert.match(stage.textContent, /2 VICTOIRES D’AFFILÉE/);
  window.Date.now = () => now + 6000;
  window.updateMatchWidgetClock();
  assert.equal(stage.hidden, true);
  assert.equal(JSON.stringify(state.matchSession), baseline, "l'aperçu ne touche aucun compteur ou session du moteur");
  window.stopMatchWidget();
});

test("la victoire attend un résultat confirmé et la photo temporaire du donateur revient au vrai créateur", async (t) => {
  const { state } = fixture();
  const now = Date.now();
  const victory = await loadWidget(t, "victory");
  victory.Date.now = () => now;
  victory.hydrateMatchWidget(projectMatchesOverlayState(state, now));
  assert.equal(victory.document.getElementById("match-widget-stage").hidden, true);
  state.matchSession.status = "ended"; state.matchSession.endedAtMs = now;
  victory.hydrateMatchWidget(projectMatchesOverlayState(state, now));
  assert.equal(victory.document.getElementById("match-widget-stage").hidden, false);
  victory.Date.now = () => now + 6000;
  victory.updateMatchWidgetClock();
  assert.equal(victory.document.getElementById("match-widget-stage").hidden, true);
  state.matchSession.participants[0].result = "lose";
  victory.hydrateMatchWidget(projectMatchesOverlayState(state, now));
  assert.equal(victory.document.getElementById("match-widget-stage").hidden, true);
  const wins = await loadWidget(t, "wins");
  wins.Date.now = () => now;
  state.matchSession.lastGift.atMs = now;
  wins.hydrateMatchWidget(projectMatchesOverlayState(state, now));
  assert.match(wins.document.querySelector(".match-duo-team.is-own").textContent, /last_donor/);
  wins.Date.now = () => now + 7000;
  wins.updateMatchWidgetClock();
  assert.match(wins.document.querySelector(".match-duo-team.is-own").textContent, /creator/);
  wins.stopMatchWidget(); victory.stopMatchWidget();
});

test("chaîne réelle SDK TikTok → MatchesService → projection → DOM : manches, timer, dons LIVE et victoire restent cohérents", async (t) => {
  const { state, store } = fixture();
  let now = Date.now();
  state.session.running = true;
  state.settings.tiktok = { ...state.settings.tiktok, username: "creator", status: "live", roomId: "fixture-room" };
  state.settings.matches = normalizeMatchesConfig({ widgets: Object.fromEntries(MATCH_WIDGET_KEYS.map((key) => [key, { enabled: true, theme: "neon", snipeSeconds: 30 }])) });
  state.matchSession = createMatchSession();
  store.mutateRuntime = store.mutate = (operation) => operation(state);
  const published = [];
  const service = new MatchesService({ store, actionRunner: { run: async () => { throw new Error("Aucune action réelle dans ce test"); } },
    overlayServer: { publish: (_channel, payload) => published.push(payload) }, now: () => now,
    setTimeoutImpl: () => ({ unref() {} }), clearTimeoutImpl() {} });
  t.after(() => service.reset());
  const expected = { ownerUid: state.settings.account.uid, profileId: state.session.profileId };
  service.adjustWins({ operation: "set", amount: 7 }, expected);
  assert.equal(published.at(-1).session.manualWins, 7);
  const wins = await loadWidget(t, "wins");
  wins.Date.now = () => now;
  wins.hydrateMatchWidget(published.at(-1));
  assert.equal(wins.document.querySelector(".match-duo-team.is-own .match-duo-rounds").textContent, "7");
  const users = [{ userId: "sdk-own-private", displayId: "creator", nickname: "Créateur", score: 10 }, { userId: "sdk-rival-private", displayId: "opponent", nickname: "Adversaire", score: 5 }];
  const event = normalizeTikTokBattle("linkMicBattle", { battleId: "sdk-battle-private", action: 4, battleUsers: users,
    battleSetting: { startTimeMs: now, endTimeMs: now + 25000 } }, { roomId: "fixture-room", channelUsername: "creator", receivedAtMs: now });
  assert.equal(service.handle(event), true);
  assert.equal(state.matchSession.status, "running");
  assert.equal(published.at(-1).session.status, "active");
  assert.equal(published.at(-1).session.timing.endsAtMs, now + 25000);
  assert.equal(published.at(-1).session.rounds.own, 0);
  const timer = await loadWidget(t, "timer");
  timer.Date.now = () => now;
  timer.hydrateMatchWidget(published.at(-1));
  assert.equal(timer.document.querySelector(".match-widget-timer").textContent, "00:25");
  assert.equal(timer.document.getElementById("match-widget-stage").classList.contains("is-snipe"), true);
  service.handleLiveEvent({ type: "gift", source: "source_tiktok", user: { id: "gift-user-private", name: "actual_donor", displayName: "Donateur réel", avatarUrl: avatar }, data: { giftId: 5655, giftName: "Rose", count: 2, value: 100, repeatEnd: true } });
  service.publish();
  const top = await loadWidget(t, "topDonor");
  top.Date.now = () => now;
  top.hydrateMatchWidget(published.at(-1));
  assert.match(top.document.getElementById("match-widget-stage").textContent, /actual_donor.*200.*PIÈCES DE CE LIVE/s);
  now += 1000;
  const ended = normalizeTikTokBattle("linkMicBattle", { battleId: "sdk-battle-private", action: 5, battleUsers: users,
    battleResult: { own: { userId: "sdk-own-private", score: 30, result: 0 }, rival: { userId: "sdk-rival-private", score: 20, result: 1 } } },
  { roomId: "fixture-room", channelUsername: "creator", receivedAtMs: now });
  assert.equal(service.handle(ended), true);
  assert.equal(state.matchSession.status, "finished");
  assert.equal(published.at(-1).session.status, "ended");
  assert.equal(published.at(-1).session.result, "win");
  assert.equal(published.at(-1).session.rounds.own, 1);
  const victory = await loadWidget(t, "victory");
  victory.Date.now = () => now;
  victory.hydrateMatchWidget(published.at(-1));
  assert.equal(victory.document.getElementById("match-widget-stage").hidden, false);
  assert.match(victory.document.getElementById("match-widget-stage").textContent, /VICTOIRE1 MANCHE/);
  const { projectMatchesOverlayPayload } = require("../src/main/matches-overlay-state");
  const secondPass = projectMatchesOverlayPayload(published.at(-1), now);
  assert.deepEqual(secondPass, published.at(-1), "le second passage SSE conserve exactement les champs déjà projetés");
  assert.doesNotMatch(JSON.stringify(secondPass), /sdk-|private|scope|pairRounds|roomId|history/);
  for (const window of [wins, timer, top, victory]) window.stopMatchWidget();
});
