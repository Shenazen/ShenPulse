"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const { createDefaultState } = require("../src/main/defaults");
const { StateStore } = require("../src/main/store");
const liveStatistics = require("../src/shared/live-statistics");
const os = require("node:os");

function renderer(t) {
  const dom = new JSDOM('<main id="content"></main>');
  t.after(() => dom.window.close());
  const state = createDefaultState();
  const context = vm.createContext({ content: dom.window.document.getElementById("content"),
    snapshot: { state }, liveEvents: [], currentPage: "dashboard", simulatorType: "gift", ShenPulseLiveStatistics: liveStatistics,
    isAccountAuthenticated: () => true, canNavigateTo: () => true, giftForIdentity: () => null,
    giftForSavedReference: () => ({ id: "5655", name: "Rose", cost: 1, imageUrl: "" }),
    eventIconMarkup: () => '<svg></svg>', escapeHtml: (value) => String(value ?? "").replace(/[<>&"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[char]),
    asNumber: (value) => String(value ?? 0), formatTime: (value) => String(value || "—"), eventIcons: {} });
  for (const file of ["studio-design.js", "dashboard.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app/features", file), "utf8"), context);
  }
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app/features/media/gift-picker.js"), "utf8"), context);
  context.content.addEventListener("click", context.handleDashboardChartClick);
  return { context, dom, state, live: state.statistics.liveSession };
}

test("bannière photo restaurée, cinq KPI ordonnés et quatre panneaux sous le simulateur", (t) => {
  const { context, live } = renderer(t);
  Object.assign(live, { hasData: true, currentViewers: 9, peakViewers: 11, likes: 426, platformLikes: 18300, gifts: 2, giftCoins: 20, followers: 1, shares: 3 });
  context.content.innerHTML = context.renderDashboard();
  const cards = context.content.querySelectorAll(".dashboard-metric");
  assert.equal(cards.length, 5);
  assert.deepEqual([...cards].map((card) => card.querySelector(".dashboard-metric-label").textContent), ["Viewers", "Likes", "Cadeaux", "Diamants", "Followers"]);
  assert.deepEqual([...cards].map((card) => card.querySelector(".dashboard-metric-value").textContent), ["9", "18300", "2", "20", "1"]);
  assert.match(context.content.textContent, /Dernier LIVE/);
  assert.equal(context.content.querySelectorAll(".dashboard-live-grid>.card").length, 4);
  assert.equal(context.content.querySelectorAll('[data-action="select-simulator-type"]').length, 7);
  assert.equal(context.content.querySelectorAll('[data-studio-hero="dashboard"]').length, 1);
  assert.equal(context.content.querySelector(".creator-dashboard").firstElementChild.dataset.studioHero, "dashboard");
  assert.equal(context.content.querySelector(".studio-hero-art").getAttribute("src"), "assets/studio/dashboard.webp");
  assert.equal(context.content.querySelectorAll('[data-navigate="studio"]').length, 0);
  assert.match(cards[3].textContent, /EUR non fourni/);
});

test("le choix cadeau ne prend plus une ligne entière et aucun cadeau ne reste sur les autres types", (t) => {
  const { context, state } = renderer(t);
  context.giftForIdentity = (name) => name === "Rose" ? { id: "5655", name: "Rose", cost: 1, imageUrl: "" } : null;
  const before = JSON.stringify(state);
  context.content.innerHTML = context.renderDashboard();
  const metrics = context.content.querySelector(".dashboard-metrics");
  const username = context.content.querySelector('[name="username"]');
  username.value = "spectateur_conservé";
  assert.ok(context.content.querySelector(".gift-picker:not(.full)"));
  assert.ok(context.content.querySelector('[data-action="creator-simulate-gift"]'));
  for (const type of ["like", "follow", "chat", "share", "subscribe", "join"]) {
    assert.equal(context.setDashboardSimulatorType(type), true);
    const form = context.content.querySelector("#simulator-form");
    assert.equal(form.querySelector('[name="type"]').value, type);
    assert.equal(form.querySelector('[name="username"]').value, "spectateur_conservé");
    assert.equal(context.content.querySelector(".dashboard-metrics"), metrics);
    assert.equal(form.querySelector('[data-gift-picker-root], [name="giftName"], [name="giftNameGiftId"]'), null);
    assert.equal(context.content.querySelector('[data-dashboard-gifts], [data-action="creator-simulate-gift"]'), null);
    assert.equal(Boolean(form.querySelector('[name="count"]')), type === "like");
    context.syncDashboardRuntime();
    assert.equal(context.content.querySelector('[data-dashboard-gifts]'), null, "une mise à jour LIVE ne réaffiche pas les cadeaux");
  }
  assert.equal(context.setDashboardSimulatorType("gift"), true);
  assert.ok(context.content.querySelector(".gift-picker:not(.full)"));
  assert.ok(context.content.querySelector('[data-dashboard-gifts]'));
  const form = context.content.querySelector("#simulator-form");
  assert.equal(context.setDashboardSimulatorType("unknown"), false);
  assert.equal(context.content.querySelector("#simulator-form"), form);
  assert.equal(JSON.stringify(state), before, "la présentation ne modifie aucun profil");
});

test("le vrai submit conserve les sept événements et n'attache pas de cadeau aux autres interactions", async (t) => {
  const { context, dom } = renderer(t), calls = [];
  let lookups = 0;
  context.FormData = dom.window.FormData;
  context.perform = async (operation) => operation();
  context.api = { simulateEvent: async (payload) => calls.push(payload) };
  context.giftForIdentity = () => { lookups += 1; return { id: "5655", name: "Rose", cost: 1, imageUrl: "fixture.webp" }; };
  const source = fs.readFileSync(path.join(__dirname, "../src/renderer/app/core/events/dialog-content.js"), "utf8");
  const start = source.indexOf('if (event.target.id === "simulator-form")');
  const end = source.indexOf('if (event.target.id !== "settings-form")', start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext(`async function submitSimulator(event) { ${source.slice(start, end)} }`, context);
  context.content.innerHTML = context.renderDashboard();
  for (const type of ["gift", "like", "follow", "chat", "share", "subscribe", "join"]) {
    context.setDashboardSimulatorType(type);
    const form = context.content.querySelector("#simulator-form");
    lookups = 0;
    let prevented = false;
    await context.submitSimulator({ target: form, preventDefault() { prevented = true; } });
    const request = calls.at(-1);
    assert.equal(prevented, true);
    assert.equal(request.type, type);
    assert.equal(request.count, type === "like" ? 25 : 1);
    assert.equal(lookups, type === "gift" ? 1 : 0);
    for (const key of ["giftId", "giftName", "giftImageUrl"]) assert.equal(key in request, type === "gift");
    if (type === "gift") { assert.equal(request.giftId, "5655"); assert.equal(request.value, 1); }
    if (type === "chat") assert.equal(request.message, "!help");
  }
  assert.equal(calls.length, 7);
});

test("données absentes, rien de cumulé historiquement ni d’audience unique inventée", (t) => {
  const { context, state } = renderer(t);
  state.statistics.likes = 100000; state.statistics.gifts = 900;
  state.statistics.sessionUniqueViewers = ["alice", "bob"];
  context.content.innerHTML = context.renderDashboard();
  assert.equal(context.content.querySelector(".dashboard-metric-viewers .dashboard-metric-value").textContent, "—");
  assert.equal(context.content.querySelector(".dashboard-metric-likes .dashboard-metric-value").textContent, "0");
  assert.equal(context.content.querySelector(".dashboard-metric-gifts .dashboard-metric-value").textContent, "0");
});

test("les pages masquées ne sont pas proposées par le dashboard", (t) => {
  const { context } = renderer(t);
  context.canNavigateTo = () => false;
  context.content.innerHTML = context.renderDashboard();
  assert.equal(context.content.querySelector('[data-navigate="users"]'), null);
  assert.equal(context.content.querySelector('[data-navigate="activity"]'), null);
  assert.equal(context.content.querySelectorAll(".dashboard-live-grid>.card").length, 4);
});

test("un changement d’audience sans nouvel événement invalide seulement le dashboard", (t) => {
  const { context, state } = renderer(t);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app/features/creator-performance.js"), "utf8"), context);
  const before = context.snapshot;
  const after = { ...before, state: { ...state, statistics: { ...state.statistics,
    liveSession: { ...state.statistics.liveSession, currentViewers: 12, peakViewers: 12 } } } };
  assert.equal(context.creatorPageDataChanged(before, after, "dashboard"), true);
  assert.equal(context.creatorPageDataChanged(before, after, "actions"), false);
  assert.equal(context.creatorPageDataChanged(before, after, "home"), false);
});

test("graphiques bornés et changement d’onglet sans perdre le formulaire ni le focus", (t) => {
  const { context, live, dom } = renderer(t);
  const timestamp = "2026-10-13T10:00:00Z";
  Object.assign(live, { hasData: true, audienceHistory: [{ timestamp, viewers: 0 }], engagementHistory: [{ timestamp, likes: 0 }] });
  context.content.innerHTML = context.renderDashboard();
  const hero = context.content.querySelector('[data-studio-hero="dashboard"]');
  const input = context.content.querySelector('[name="username"]');
  input.value = "mon_test"; input.focus();
  context.content.querySelector('[data-dashboard-chart-tab="engagement"]').click();
  assert.equal(context.content.querySelector('[name="username"]'), input);
  assert.equal(context.content.querySelector('[data-studio-hero="dashboard"]'), hero);
  assert.equal(input.value, "mon_test"); assert.equal(dom.window.document.activeElement, input);
  assert.equal(context.content.querySelector(".dashboard-chart.is-engagement") !== null, true);
  assert.doesNotMatch(context.content.querySelector("[data-dashboard-chart]").innerHTML, /NaN|Infinity/);
});

test("donateurs du vrai LIVE et chat dédupliqué, échappé, sans anciens événements ni simulateur", (t) => {
  const { context, live, state } = renderer(t);
  Object.assign(live, { hasData: true, startedAt: "2026-10-13T10:00:00Z", comments: 1,
    participants: [{ id: "a", name: "Alice", username: "alice", coins: 20, gifts: 2 }] });
  const chat = { id: "real", type: "chat", source: "source_tiktok", timestamp: "2026-10-13T10:01:00Z",
    user: { name: "alice", displayName: "Alice", moderator: true }, data: { message: '<script>alert("x")</script>' } };
  context.liveEvents = [chat, { ...chat, id: "test", source: "simulator" }, { ...chat, id: "old", timestamp: "2026-10-13T09:00:00Z" }];
  state.overlaySession.recentEvents = [chat];
  state.overlaySession.leaderboards.donors = [{ id: "fake", name: "Simulation", score: 9999 }];
  context.content.innerHTML = context.renderDashboard();
  assert.equal(context.content.querySelectorAll(".dashboard-chat-row").length, 1);
  assert.equal(context.content.querySelectorAll(".dashboard-chat-row script").length, 0);
  assert.match(context.content.querySelector("[data-dashboard-chat]").textContent, /<script>/);
  assert.match(context.content.querySelector("[data-dashboard-donors]").textContent, /Alice/);
  assert.doesNotMatch(context.content.querySelector("[data-dashboard-donors]").textContent, /Simulation/);
});

test("le résumé du dernier LIVE survit au rechargement disque contrairement au runtime ancien", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-live-stats-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const state = createDefaultState();
  Object.assign(state.statistics.liveSession, { hasData: true, roomId: "same-room", gifts: 7, giftCoins: 99, likes: 420, currentViewers: 4, peakViewers: 8, startedAt: "2026-10-13T10:00:00Z" });
  state.statistics.sessionLikes = 420; state.session.running = true;
  state.accountWorkspaceSchemaVersion = 0;
  state.settings.account.uid = "live_stats_test_owner";
  state.settings.account.refreshTokenSecretId = "live_stats_test_secret";
  fs.writeFileSync(path.join(directory, "shenpulse-secrets.json"), JSON.stringify({
    live_stats_test_secret: { encrypted: false, value: Buffer.from("dummy-test-token").toString("base64") }
  }));
  fs.writeFileSync(path.join(directory, "shenpulse-state.json"), JSON.stringify(state));
  const store = new StateStore(directory);
  store.load();
  assert.equal(store.state.session.running, false);
  assert.equal(store.state.statistics.sessionLikes, 0);
  assert.equal(store.state.statistics.liveSession.likes, 420);
  assert.equal(store.state.statistics.liveSession.gifts, 7);
  assert.equal(store.state.statistics.liveSession.peakViewers, 8);
  assert.ok(store.state.statistics.liveSession.endedAt);
});
