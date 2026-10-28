"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const { createDefaultState } = require("../src/main/defaults");
const viewerRanks = require("../src/shared/viewer-ranks");

function creatorContext(t) {
  const dom = new JSDOM('<main id="content"></main>', { pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const context = vm.createContext({
    document: dom.window.document, window: dom.window,
    content: dom.window.document.getElementById("content"),
    snapshot: { state: createDefaultState(), packs: [] }, liveEvents: [],
    currentPage: "users", isAccountAuthenticated: () => true,
    ShenPulseViewerRanks: viewerRanks,
    escapeHtml: (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"),
    asNumber: (value) => String(value || 0), formatTime: (value) => value || "—",
    normalizeCatalogSearch: (value) => String(value || "").toLowerCase(),
    renderPrivateDataPlaceholder: () => "private"
  });
  const file = path.join(__dirname, "..", "src", "renderer", "app", "features", "creator-users.js");
  const guard = path.join(__dirname, "..", "src", "renderer", "app", "core", "account-operation-guard.js");
  vm.runInContext(fs.readFileSync(guard, "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "app", "features", "studio-design.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(file, "utf8"), context);
  return context;
}

function historicalUser(index, overrides = {}) {
  return { id: `user_${index}`, userId: String(index), username: `viewer_${index}`, name: `Viewer ${index}`, streamer: "creator", platform: "tiktok", avatarUrl: "", diamonds: index, gifts: index, likes: 5, comments: 2, shares: 1, events: 8, firstSeen: "2026-10-12T10:00:00Z", lastSeen: "2026-10-13T10:00:00Z", blocked: false, ...overrides };
}

function connectUsersDatabase(context, rows) {
  const calls = [];
  context.api = { users: { snapshot: async (query) => {
    calls.push(query);
    const filtered = rows.filter((row) => !query.query || `${row.username} ${row.name}`.toLowerCase().includes(query.query.toLowerCase()));
    return { rows: filtered.slice(query.offset, query.offset + query.limit), total: rows.length, filteredTotal: filtered.length, stats: { diamonds: rows.reduce((sum, row) => sum + row.diamonds, 0), dominantRank: "Fan" }, streamers: ["creator"], blockedUsers: ["@blocked"] };
  } } };
  return calls;
}

function connectAudienceActions(context) {
  context.perform = async (work) => work();
  context.registerActionHandler = () => {};
  context.ACTION_NOT_HANDLED = Symbol("not-handled");
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "app", "actions", "handlers", "creator-audience.js"), "utf8"), context);
}

function connectBlockedDatabase(context, entries) {
  const reads = [];
  const unblocked = [];
  context.api = { users: {
    snapshot: async (query) => {
      reads.push(query);
      return { rows: [], total: 0, filteredTotal: 0, stats: {}, streamers: ["creator", "other_creator"], blockedUsers: entries.map((entry) => entry.username), blockedTotal: entries.length,
        ...(query.includeBlocked ? { blockedEntries: entries.slice(query.blockedOffset, query.blockedOffset + query.blockedLimit) } : {}) };
    },
    unblock: async (entry, expectedUid) => {
      assert.equal(expectedUid, context.snapshot.state.settings.account.uid || "");
      unblocked.push(entry);
      const index = entries.findIndex((row) => row.platform === entry.platform && row.streamer === entry.streamer && row.username === entry.username && row.rowId === entry.rowId);
      if (index >= 0) entries.splice(index, 1);
      return { updated: index >= 0 };
    }
  } };
  connectAudienceActions(context);
  return { reads, unblocked };
}

function musicContext(t, { connected = false, track, requests = {}, responses = {} } = {}) {
  const context = creatorContext(t);
  const calls = [];
  const status = { settings: { enabled: false, maxQueue: 20, maxPerViewer: 3, cooldownSeconds: 10 }, queue: [], history: [], ...requests };
  context.currentPage = "music";
  context.spotifyStatus = { configured: true, connected, activeDevice: { name: "Appareil de test", volume: 60 }, playback: track ? { item: track, isPlaying: true, progressMs: 30000 } : null };
  context.canAccessFeature = () => true;
  context.canAccessActionType = () => true;
  context.flattenActions = () => [];
  context.acceptSnapshot = (updated) => { context.snapshot = updated; };
  context.api = { getSnapshot: async () => context.snapshot, controlSpotify: async (config) => {
    calls.push(config);
    if (config.operation === "requests_status") return status;
    if (config.operation === "requests_settings") { status.settings = { ...status.settings, ...config.settings, commands: { ...status.settings.commands, ...config.settings.commands }, commandEnabled: { ...status.settings.commandEnabled, ...config.settings.commandEnabled } }; context.snapshot.state.settings.spotify.songRequests = status.settings; return status; }
    return responses[config.operation] || { ok: true };
  } };
  context.perform = async (work) => work();
  context.refreshSpotifyStatus = async () => context.spotifyStatus;
  context.confirmAction = async () => true;
  context.registerActionHandler = () => {};
  context.ACTION_NOT_HANDLED = Symbol("not-handled");
  for (const file of ["features/creator-music.js", "actions/handlers/creator-music.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "app", file), "utf8"), context);
  }
  return { context, calls, status };
}

const musicTrack = { id: "track", uri: "spotify:track:1234567890123456789012", name: "Un titre réel de test", artists: ["Artiste"], durationMs: 182000, imageUrl: "https://example.test/cover.png" };

function liveParticipant(overrides = {}) {
  return { id: "alice", name: "Alice", username: "alice_live", platform: "tiktok", avatarUrl: "https://example.test/alice.png", events: 6, likes: 15, gifts: 2, coins: 20, comments: 3, shares: 1, follows: 1, lastSeen: "2026-10-13T10:05:00Z", ...overrides };
}

test("l'audience utilise exactement le résumé persistant, sans recomptage du journal ni du simulateur", (t) => {
  const context = creatorContext(t);
  context.snapshot.state.statistics.liveSession = { hasData: true, startedAt: "2026-10-13T10:00:00Z", participants: [liveParticipant()] };
  context.snapshot.state.overlaySession.leaderboards.donors = [{ id: "alice", name: "Mauvais ancien total", score: 999 }];
  context.liveEvents = [{ id: "simulated", source: "simulator", type: "gift", timestamp: "2026-10-13T10:05:00Z", user: { id: "alice", name: "alice" }, data: { value: 500, count: 1 } }];
  const before = JSON.stringify(context.snapshot.state.statistics.liveSession);
  for (let index = 0; index < 5; index += 1) {
    const row = context.creatorAudienceRows()[0];
    assert.equal(row.coins, 20);
    assert.equal(row.gifts, 2);
    assert.equal(row.comments, 3);
    assert.equal(row.displayName, "Alice");
    assert.equal(row.name, "alice_live");
    assert.equal(row.lastSeenAt, "2026-10-13T10:05:00Z");
  }
  assert.equal(JSON.stringify(context.snapshot.state.statistics.liveSession), before);
});

test("un même identifiant sur TikTok et Kick reste deux participants distincts", (t) => {
  const context = creatorContext(t);
  context.snapshot.state.statistics.liveSession = { hasData: true, participants: [liveParticipant(), liveParticipant({ platform: "kick", coins: 30 })] };
  const rows = context.creatorAudienceRows();
  assert.deepEqual(Array.from(rows, (row) => row.id), ["kick:alice", "tiktok:alice"]);
});

test("le dernier LIVE reste consultable hors session et un nouveau LIVE vide ne récupère pas l'ancien journal", (t) => {
  const context = creatorContext(t);
  context.snapshot.state.session.running = false;
  context.snapshot.state.statistics.liveSession = { hasData: true, startedAt: "2026-10-13T10:00:00Z", endedAt: "2026-10-13T11:00:00Z", participants: [liveParticipant()] };
  assert.equal(context.creatorAudienceRows().length, 1);
  context.snapshot.state.overlaySession.leaderboards.donors = [{ id: "old", name: "Ancien", score: 50 }];
  context.snapshot.state.statistics.liveSession = { hasData: true, startedAt: "2026-10-13T12:00:00Z", participants: [] };
  assert.equal(context.creatorAudienceRows().length, 0);
});

test("les anciennes sessions ne comptent jamais les événements explicitement simulés", (t) => {
  const context = creatorContext(t);
  context.snapshot.state.statistics.liveSession = undefined;
  for (const source of ["simulator", "test", "rule-test", "manual-preview", "demo"]) {
    context.rememberCreatorAudienceEvent({ id: source, source, type: "gift", user: { id: "fake", name: "test_viewer" }, data: { count: 1, value: 10 } });
  }
  assert.equal(context.creatorAudienceRows().length, 0);
});

test("le repli ancien preload ne confond pas les cinq donateurs projetés avec toute l'audience", (t) => {
  const context = creatorContext(t);
  context.snapshot.state.statistics.liveSession = { hasData: true, participantCount: 1000, participants: [liveParticipant()] };
  context.rememberCreatorAudienceEvent({ id: "real_chat", source: "tiktok", type: "chat", user: { id: "chat_only", name: "chat_only", displayName: "Sans cadeau" }, data: {} });
  assert.equal(context.creatorPersistedAudience(), null);
  assert.ok(context.creatorAudienceRows().some((row) => row.name === "chat_only"));
});

test("la base historique utilise une page bornée, conserve les filtres et le focus après actualisation", async (t) => {
  const context = creatorContext(t);
  const calls = connectUsersDatabase(context, Array.from({ length: 130 }, (_, index) => historicalUser(index)));
  context.content.innerHTML = context.renderCreatorUsers();
  const hero = context.content.querySelector('[data-studio-hero="users"]');
  assert.ok(hero);
  assert.equal(context.content.querySelector(".creator-users-page").firstElementChild, hero);
  assert.equal(hero.querySelector(".studio-hero-art").getAttribute("src"), "assets/studio/users.webp");
  await context.refreshCreatorUsersDatabase({ force: true });
  assert.equal(context.content.querySelectorAll("[data-creator-user-row]").length, 50);
  assert.equal(calls.at(-1).limit, 50);
  assert.equal(context.content.querySelectorAll(".audience-metric").length, 3);
  assert.equal(context.content.querySelectorAll(".audience-rank-chip").length, 11);
  const search = context.content.querySelector("[data-creator-user-search]");
  const blocked = context.content.querySelector("[data-creator-users-blocked]");
  blocked.value = "@en_cours";
  blocked.dataset.edited = "true";
  search.value = "viewer_129";
  search.focus();
  await context.filterCreatorUsers(search);
  assert.equal(context.content.querySelectorAll("[data-creator-user-row]").length, 1);
  assert.equal(context.content.querySelector("[data-creator-user-search]"), search);
  assert.equal(context.document.activeElement, search);
  assert.equal(blocked.value, "@en_cours");
  assert.equal(context.content.querySelector('[data-studio-hero="users"]'), hero);
  assert.match(context.content.querySelector("[data-creator-users-table]").textContent, /Viewer 129/);
});

test("le tri et la sélection des doublons passent par la délégation commune sans reconstruire les filtres", async (t) => {
  const context = creatorContext(t);
  const calls = connectUsersDatabase(context, [historicalUser(1), historicalUser(2)]);
  context.content.innerHTML = context.renderCreatorUsers();
  await context.refreshCreatorUsersDatabase({ force: true });
  const sort = context.content.querySelector('[data-creator-users-filter="sort"]');
  sort.value = "lastSeen";
  assert.equal(context.handleCreatorAudienceChange(sort), true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.at(-1).sort, "lastSeen");
  assert.equal(context.content.querySelector('[data-creator-users-filter="sort"]'), sort);
  const selectAll = context.content.querySelector("[data-creator-users-select-all]");
  selectAll.checked = true;
  context.handleCreatorAudienceChange(selectAll);
  assert.equal(context.content.querySelectorAll("[data-creator-users-select]:checked").length, 2);
  assert.match(context.content.querySelector("[data-audience-selection-count]").textContent, /2 sélectionnés/);
});

test("une suppression refusée ne touche aucune fiche et les détails ne déclenchent aucune interaction", async (t) => {
  const context = creatorContext(t);
  connectUsersDatabase(context, [historicalUser(1)]);
  await context.refreshCreatorUsersDatabase({ force: true });
  const removed = [];
  const details = [];
  context.api.users.remove = async (id) => removed.push(id);
  context.confirmAction = async () => false;
  context.registerActionHandler = () => {};
  context.ACTION_NOT_HANDLED = Symbol("not-handled");
  context.openEditor = (value) => details.push(value);
  const file = path.join(__dirname, "..", "src", "renderer", "app", "actions", "handlers", "creator-audience.js");
  vm.runInContext(fs.readFileSync(file, "utf8"), context);
  await context.handleCreatorAudienceAction({ action: "audience-delete", id: "user_1", target: { dataset: {} } });
  await context.handleCreatorAudienceAction({ action: "audience-details", id: "user_1", target: { dataset: {} } });
  assert.equal(removed.length, 0);
  assert.equal(details.length, 1);
  assert.match(details[0].body, /Diamants.*Cadeaux.*Likes.*Commentaires/s);
  const detail = context.document.createElement("div");
  detail.innerHTML = details[0].body;
  const rank = viewerRanks.rankForDiamonds(1);
  assert.equal(detail.querySelector(".audience-rank-pill .audience-rank-icon").textContent, rank.icon || context.CREATOR_VIEWER_RANK_ICONS?.[rank.id] || "🔰");
  assert.equal(detail.querySelector(".audience-rank-icon").getAttribute("aria-hidden"), "true");
});

test("les onze filtres de rang présentent l'icône observée avant le libellé accessible", (t) => {
  const context = creatorContext(t);
  connectUsersDatabase(context, []);
  context.content.innerHTML = context.renderCreatorUsers();
  const expected = { new: "🌱", fan: "🔰", supporter: "💙", active: "⭐", loyal: "💎", vip: "🏆", legend: "👑", mythic: "🌟", divine: "🔱", cosmic: "🌌", immortal: "☄️" };
  const buttons = context.content.querySelectorAll(".audience-rank-chip");
  assert.equal(buttons.length, Object.keys(expected).length);
  for (const button of buttons) {
    const icon = button.querySelector(".audience-rank-icon");
    const rank = viewerRanks.ranks.find((entry) => entry.id === button.dataset.id);
    assert.equal(icon.textContent, expected[rank.id]);
    assert.equal(icon.getAttribute("aria-hidden"), "true");
    assert.equal(button.firstElementChild, icon);
    assert.equal(icon.nextSibling.textContent, rank.label);
    assert.equal(button.title, context.creatorViewerRankCondition(rank));
  }
});

test("le rang dominant et les cellules utilisent le même rendu d'icône, y compris un ancien rang libellé", async (t) => {
  const context = creatorContext(t);
  const dominantRank = viewerRanks.ranks.find((entry) => entry.id === "fan");
  context.api = { users: { snapshot: async () => ({ rows: [historicalUser(0)], total: 1, filteredTotal: 1, stats: { diamonds: 0, dominantRank }, streamers: [], blockedUsers: [] }) } };
  context.content.innerHTML = context.renderCreatorUsers();
  await context.refreshCreatorUsersDatabase({ force: true });
  const tableRank = context.content.querySelector(".audience-history-table .audience-rank-pill");
  const dominant = context.content.querySelector(".audience-dominant-rank");
  assert.equal(tableRank.querySelector(".audience-rank-icon").textContent, "🌱");
  assert.match(tableRank.textContent, /Nouveau/);
  assert.equal(dominant.querySelector(".audience-rank-icon").textContent, "🔰");
  assert.match(dominant.textContent, /Fan/);
  assert.equal(tableRank.title, context.creatorViewerRankCondition(viewerRanks.ranks[0]));
  vm.runInContext('creatorUserDatabase.stats.dominantRank = "Fan"', context);
  context.syncCreatorUsersRuntime({ request: false });
  assert.equal(context.content.querySelector(".audience-dominant-rank .audience-rank-icon").textContent, "🔰");
});

test("le guide des rangs reste fermé par défaut et reprend exclusivement les conditions du moteur partagé", async (t) => {
  const context = creatorContext(t);
  connectUsersDatabase(context, [historicalUser(0)]);
  context.content.innerHTML = context.renderCreatorUsers();
  const guide = context.content.querySelector("details.audience-rank-guide");
  assert.equal(guide.open, false);
  assert.equal(guide.querySelector("summary").textContent, "Conditions des rangs");
  assert.equal(guide.previousElementSibling.className, "audience-ranks");
  const explanation = guide.querySelector("p").textContent;
  assert.match(explanation, /Seule la valeur cumulée des cadeaux détermine le rang/);
  assert.match(explanation, /entre vos LIVE.*plateforme et streamer/);
  assert.match(explanation, /likes.*messages du chat.*nouveaux abonnés ne modifient pas le rang/);
  const rows = guide.querySelectorAll(".audience-rank-guide-grid > li");
  assert.equal(rows.length, viewerRanks.ranks.length);
  viewerRanks.ranks.forEach((rank, index) => {
    const badge = rows[index].querySelector(".audience-rank-pill");
    assert.equal(badge.querySelector(".audience-rank-icon").textContent, rank.icon);
    assert.equal(badge.lastChild.textContent, rank.label);
    assert.equal(badge.title, viewerRanks.describeRank(rank));
    assert.equal(rows[index].lastElementChild.textContent, viewerRanks.describeRank(rank));
  });
  guide.open = true;
  await context.refreshCreatorUsersDatabase({ force: true });
  assert.equal(context.content.querySelector(".audience-rank-guide"), guide);
  assert.equal(guide.open, true, "un rafraîchissement des données ne referme pas le guide consulté");
});

test("FR → EN → FR traduit les rangs et leurs conditions sans modifier un utilisateur nommé Actif ni ses icônes", async (t) => {
  const context = creatorContext(t);
  const activeRank = viewerRanks.ranks.find((rank) => rank.id === "active");
  connectUsersDatabase(context, [historicalUser(1, { name: "Actif", username: "Actif", diamonds: activeRank.minimum })]);
  context.content.innerHTML = context.renderCreatorUsers();
  await context.refreshCreatorUsersDatabase({ force: true });
  context.NodeFilter = context.window.NodeFilter;
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "app", "features", "studio-language.js"), "utf8"), context);
  const conditions = context.content.querySelector(".audience-rank-guide-content > p").textContent;
  const badges = Array.from(context.content.querySelectorAll("[data-studio-viewer-rank]"));
  const originals = badges.map((badge) => ({ label: badge.lastChild.textContent, title: badge.title }));
  const icons = Array.from(context.content.querySelectorAll(".audience-rank-icon"), (icon) => icon.outerHTML);
  const standalone = context.document.createElement("span");
  standalone.dataset.testRuleState = "";
  standalone.textContent = "Actif";
  standalone.title = viewerRanks.describeRank("immortal");
  context.content.append(standalone);
  const protectedContent = context.document.createElement("span");
  protectedContent.dataset.studioUserContent = "";
  protectedContent.innerHTML = '<span data-studio-viewer-rank>Actif</span>';
  context.content.append(protectedContent);

  context.snapshot.state.settings.locale = "en-US";
  context.applyStudioLanguage(context.content);
  assert.equal(context.content.querySelector('.audience-rank-chip[data-id="active"]').lastChild.textContent, "Active");
  assert.equal(context.content.querySelector(".audience-history-table .audience-rank-pill").lastChild.textContent, "Active");
  assert.equal(context.content.querySelector(".creator-user-identity strong").textContent, "Actif");
  assert.match(context.content.querySelector(".creator-user-identity small").textContent, /@Actif/);
  assert.equal(context.content.querySelector(".audience-rank-guide summary").textContent, "Rank requirements");
  assert.match(context.content.querySelector(".audience-rank-guide-content > p").textContent, /^Ranks depend only on cumulative gift value/);
  const rankLabels = { Nouveau: "New", Fan: "Fan", Supporter: "Supporter", Actif: "Active", Fidèle: "Loyal", VIP: "VIP", Légende: "Legend", Mythique: "Mythic", Divin: "Divine", Cosmique: "Cosmic", Immortel: "Immortal" };
  badges.forEach((badge, index) => {
    assert.equal(badge.lastChild.textContent, rankLabels[originals[index].label]);
    assert.equal(badge.title, context.studioTranslate(originals[index].title));
  });
  const guideRows = context.content.querySelectorAll(".audience-rank-guide-grid > li");
  viewerRanks.ranks.forEach((rank, index) => assert.equal(guideRows[index].lastElementChild.textContent, context.studioTranslate(viewerRanks.describeRank(rank))));
  assert.equal(context.studioTranslate(viewerRanks.describeRank("new")), "0 cumulative diamonds");
  assert.match(context.studioTranslate(viewerRanks.describeRank("immortal")), /^At least /);
  assert.equal(standalone.textContent, "Enabled", "Actif conserve son sens d'état en dehors des rangs");
  assert.equal(standalone.title, viewerRanks.describeRank("immortal"), "les autres titres conservent leur traitement historique");
  assert.equal(protectedContent.textContent, "Actif", "un marqueur imbriqué dans des données utilisateur reste protégé");
  assert.deepEqual(Array.from(context.content.querySelectorAll(".audience-rank-icon"), (icon) => icon.outerHTML), icons);

  context.snapshot.state.settings.locale = "fr-FR";
  context.applyStudioLanguage(context.content);
  badges.forEach((badge, index) => {
    assert.equal(badge.lastChild.textContent, originals[index].label);
    assert.equal(badge.title, originals[index].title);
  });
  assert.equal(context.content.querySelector(".creator-user-identity strong").textContent, "Actif");
  assert.equal(context.content.querySelector(".audience-rank-guide summary").textContent, "Conditions des rangs");
  assert.equal(context.content.querySelector(".audience-rank-guide-content > p").textContent, conditions);
  assert.equal(standalone.textContent, "Actif");
  assert.deepEqual(Array.from(context.content.querySelectorAll(".audience-rank-icon"), (icon) => icon.outerHTML), icons);
});

test("le badge conserve un repli d'icône sans métadonnées partagées et échappe les valeurs affichées", (t) => {
  const context = creatorContext(t);
  context.ShenPulseViewerRanks = undefined;
  const badge = context.document.createElement("div");
  badge.innerHTML = context.creatorViewerRankMarkup({ id: "legend", label: "Légende", color: "#dd9a4f" });
  assert.equal(badge.querySelector(".audience-rank-icon").textContent, "👑");
  badge.innerHTML = context.creatorViewerRankMarkup({ id: "unknown", label: '<img src="x" onerror="alert(1)">', icon: "<svg onload=alert(1)>", color: "#fff" });
  assert.equal(badge.querySelector("img,svg"), null);
  assert.equal(badge.querySelector(".audience-rank-icon").textContent, "<svg onload=alert(1)>");
  assert.match(badge.textContent, /<img/);
});

test("les paliers des rangs sont définis explicitement par ShenPulse et partagés avec le backend", () => {
  assert.equal(viewerRanks.ranks.length, 11);
  assert.equal(viewerRanks.rankForDiamonds(-1).label, "Nouveau");
  assert.equal(viewerRanks.rankForDiamonds(0).label, "Nouveau");
  assert.equal(viewerRanks.rankForDiamonds(1).label, "Fan");
  assert.equal(viewerRanks.rankForDiamonds(499).label, "Fidèle");
  assert.equal(viewerRanks.rankForDiamonds(500).label, "VIP");
  assert.equal(viewerRanks.rankForDiamonds(100000).label, "Immortel");
  assert.ok(Object.isFrozen(viewerRanks.ranks[0]));
});

test("la fiche expose le prochain rang et son reste à atteindre sans réécrire les contributions historiques", (t) => {
  const context = creatorContext(t);
  context.registerActionHandler = () => {};
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "app", "actions", "handlers", "creator-audience.js"), "utf8"), context);
  const row = historicalUser(1, { diamonds: 300, rank: { id: "immortal" } });
  const before = JSON.stringify(row);
  let editor;
  context.openEditor = (value) => { editor = value; };
  context.openCreatorAudienceDetails(row);
  const detail = context.document.createElement("div");
  detail.innerHTML = editor.body;
  const progress = detail.querySelector(".audience-rank-progress");
  assert.match(progress.querySelector(".audience-rank-progress-heading").textContent, /Prochain rang.*VIP/);
  assert.equal(progress.querySelector("progress").max, 400);
  assert.equal(progress.querySelector("progress").value, 200);
  assert.equal(progress.querySelector("progress").getAttribute("aria-label"), "Progression dans le palier");
  assert.match(progress.querySelector("p").textContent, /200 diamants restants/);
  assert.match(detail.querySelector(".creator-user-identity .audience-rank-pill").textContent, /Fidèle/);
  assert.equal(JSON.stringify(row), before, "le vieux snapshot de rang ne devient pas autoritaire");
  detail.innerHTML = context.creatorViewerRankProgressMarkup(100000);
  assert.match(detail.textContent, /Rang maximal atteint.*Immortel/);
  assert.equal(detail.querySelector("progress"), null, "aucun objectif fictif après le dernier rang");
  detail.innerHTML = context.creatorViewerRankProgressMarkup(Infinity);
  assert.match(detail.textContent, /Prochain rang.*Fan/);
  assert.equal(detail.querySelector("progress").value, 0);
  assert.match(detail.textContent, /1 diamant restant/);
  context.ShenPulseViewerRanks = { ...viewerRanks, progressForDiamonds: undefined };
  assert.equal(context.creatorViewerRankProgressMarkup(300), "", "le vieux preload peut continuer d'afficher la fiche");
});

test("la progression reste traduisible en FR et EN, sans modifier ses chiffres ni les noms des rangs sources", (t) => {
  const context = creatorContext(t);
  context.NodeFilter = context.window.NodeFilter;
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "app", "features", "studio-language.js"), "utf8"), context);
  context.content.innerHTML = context.creatorViewerRankProgressMarkup(300);
  const original = context.content.textContent;
  context.snapshot.state.settings.locale = "en-US";
  context.applyStudioLanguage(context.content);
  assert.match(context.content.textContent, /Next rank.*VIP.*200 diamonds remaining/);
  assert.equal(context.content.querySelector("progress").getAttribute("aria-label"), "Progress within the current rank");
  assert.equal(context.content.querySelector("progress").value, 200);
  context.snapshot.state.settings.locale = "fr-FR";
  context.applyStudioLanguage(context.content);
  assert.equal(context.content.textContent, original);
  assert.equal(context.content.querySelector("progress").getAttribute("aria-label"), "Progression dans le palier");
});

test("les filtres de rang exposent l'état sélectionné aux lecteurs d'écran, y compris Tous", async (t) => {
  const context = creatorContext(t);
  const calls = connectUsersDatabase(context, [historicalUser(1)]);
  context.registerActionHandler = () => {};
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "app", "actions", "handlers", "creator-audience.js"), "utf8"), context);
  context.content.innerHTML = context.renderCreatorUsers();
  const all = context.content.querySelector(".audience-rank-reset");
  const fan = context.content.querySelector('.audience-rank-chip[data-id="fan"]');
  assert.equal(all.getAttribute("aria-pressed"), "true");
  assert.equal(fan.getAttribute("aria-pressed"), "false");
  await context.handleCreatorAudienceAction({ action: "audience-rank", id: "fan", target: fan });
  assert.equal(calls.at(-1).rank, "fan");
  assert.equal(fan.getAttribute("aria-pressed"), "true");
  assert.equal(all.getAttribute("aria-pressed"), "false");
  await context.handleCreatorAudienceAction({ action: "audience-rank", id: "fan", target: fan });
  assert.equal(calls.at(-1).rank, "");
  assert.equal(fan.getAttribute("aria-pressed"), "false");
  assert.equal(all.getAttribute("aria-pressed"), "true");
});

test("Musique présente cinq onglets et aucun faux contrôle de lecture quand Spotify est déconnecté", async (t) => {
  const { context, calls } = musicContext(t);
  context.content.innerHTML = context.renderCreatorMusic();
  await context.refreshCreatorMusicData();
  assert.equal(context.content.querySelectorAll('.music-tabs [data-action="music-tab"]').length, 5);
  assert.match(context.content.textContent, /Spotify Premium requis/);
  assert.equal(context.content.querySelectorAll('[data-action="music-control"]:disabled').length, 3);
  await context.handleCreatorMusicAction({ action: "music-tab", target: { dataset: { value: "playlists" } } });
  assert.match(context.content.textContent, /Connectez Spotify pour voir vos playlists/);
  assert.equal(calls.some((config) => ["play", "playlists", "play_playlist"].includes(config.operation)), false);
});

test("la navigation musicale aligne icônes, libellés et état accessible sans recréer les boutons au rafraîchissement", async (t) => {
  const { context } = musicContext(t);
  context.content.innerHTML = context.renderCreatorMusic();
  await context.refreshCreatorMusicData();
  const tabs = [...context.content.querySelectorAll(".music-tab")];
  assert.equal(tabs.length, 5);
  assert.deepEqual(tabs.map((tab) => tab.querySelector(".music-tab-label").textContent), ["Lecteur", "File d’attente", "Rechercher", "Mes playlists", "Paramètres"]);
  for (const tab of tabs) {
    assert.equal(tab.type, "button");
    assert.equal(tab.tabIndex, 0);
    assert.equal(tab.querySelector(".music-tab-icon svg").getAttribute("aria-hidden"), "true");
    assert.equal(tab.getAttribute("aria-controls"), "creator-music-panel");
  }
  assert.equal(tabs[0].getAttribute("aria-pressed"), "true");
  tabs[4].focus();
  // Un libellé traduit n'est pas une raison de reconstruire la navigation au poll.
  tabs[0].querySelector(".music-tab-label").textContent = "Player";
  context.syncCreatorMusicRuntime();
  assert.equal(context.content.querySelector('[data-value="player"]'), tabs[0]);
  assert.equal(context.document.activeElement, tabs[4]);
  context.acceptCreatorSongRequestsStatus({ settings: {}, queue: [{ id: "request_1" }] });
  const focused = context.content.querySelector('[data-value="settings"]');
  assert.equal(context.document.activeElement, focused);
  assert.equal(context.content.querySelector(".music-tab-count").textContent, "1");
  await context.handleCreatorMusicAction({ action: "music-tab", target: focused });
  assert.equal(context.content.querySelector('[data-value="settings"]').getAttribute("aria-pressed"), "true");
  assert.equal(context.document.activeElement.dataset.value, "settings");
  assert.equal(context.content.querySelectorAll('.music-tab[aria-pressed="true"]').length, 1);
});

test("la navigation musicale possède un focus visible et une grille responsive dédiée, sans styler ses libellés en badges", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "styles", "creator-music.css"), "utf8");
  assert.match(css, /\.music-tabs\s*\{[^}]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css, /\.music-tabs \.music-tab:focus-visible\s*\{[^}]*outline:2px solid/);
  assert.match(css, /@media\(max-width:850px\)\s*\{\s*\.music-tabs\s*\{[^}]*repeat\(3,/);
  assert.match(css, /@media\(max-width:650px\)\s*\{[\s\S]*\.music-tabs\s*\{[^}]*repeat\(2,/);
  assert.doesNotMatch(css, /\.music-tabs button span\s*,/);
});

test("le lecteur utilise les métadonnées Spotify et ses commandes envoient seulement l'opération choisie", async (t) => {
  const { context, calls } = musicContext(t, { connected: true, track: musicTrack });
  context.content.innerHTML = context.renderCreatorMusic();
  assert.equal(context.content.querySelector(".music-player-cover img").getAttribute("src"), musicTrack.imageUrl);
  assert.match(context.content.textContent, /Un titre réel de test.*Artiste/s);
  assert.equal(context.content.querySelector('[data-action="music-control"][data-operation="pause"]').disabled, false);
  await context.handleCreatorMusicAction({ action: "music-control", target: { dataset: { operation: "previous" } } });
  assert.equal(calls.filter((config) => config.operation === "previous").length, 1);
  assert.equal(calls.some((config) => config.operation === "next"), false);
});

test("la file des demandes est distincte de Spotify et une vidange annulée ne touche aucune file", async (t) => {
  const { context, calls } = musicContext(t, { connected: true, requests: { queue: [{ id: "request_1", track: musicTrack, user: { name: "viewer" } }] }, responses: { queue_list: { queue: [musicTrack] } } });
  context.content.innerHTML = context.renderCreatorMusic();
  await context.handleCreatorMusicAction({ action: "music-tab", target: { dataset: { value: "queue" } } });
  assert.match(context.content.textContent, /Vider les demandes ShenPulse/);
  assert.match(context.content.textContent, /Demandé par viewer/);
  assert.match(context.content.querySelector(".music-native-queue").textContent, /Spotify ne permet pas de la vider/);
  context.confirmAction = async () => false;
  await context.handleCreatorMusicAction({ action: "music-request-clear", target: { dataset: {} } });
  assert.equal(calls.some((config) => config.operation === "requests_clear"), false);
});

test("les paramètres de demandes restent éditables lors des notifications et passent par la validation backend", async (t) => {
  const { context, calls } = musicContext(t);
  context.content.innerHTML = context.renderCreatorMusic();
  await context.handleCreatorMusicAction({ action: "music-tab", target: { dataset: { value: "settings" } } });
  const input = context.content.querySelector('[name="maxQueue"]');
  assert.equal(input.min, "1");
  assert.equal(input.max, "50");
  assert.equal(context.content.querySelector('[name="maxPerViewer"]').max, "10");
  assert.equal(context.content.querySelector('[name="maxDurationMinutes"]').min, "1");
  assert.equal(context.content.querySelector('[name="request"]').maxLength, 22);
  input.value = "12";
  input.focus();
  context.content.querySelector('[name="enabled"]').checked = true;
  context.content.querySelector('[name="blockedArtists"]').value = "Artiste 1\nArtiste 2";
  context.acceptCreatorSongRequestsStatus({ settings: { maxQueue: 20 }, queue: [] });
  assert.equal(context.content.querySelector('[name="maxQueue"]'), input);
  assert.equal(input.value, "12");
  assert.equal(context.document.activeElement, input);
  await context.handleCreatorMusicAction({ action: "music-settings-save", target: { dataset: {} } });
  const saved = calls.find((config) => config.operation === "requests_settings");
  assert.equal(saved.settings.maxQueue, 12);
  assert.equal(saved.settings.enabled, true);
  assert.deepEqual(Array.from(saved.settings.blockedArtists), ["Artiste 1", "Artiste 2"]);
  assert.equal(saved.settings.commands.request, "!sr");
  assert.equal(saved.settings.allowViewerSkip, false);
});

test("la recherche et l'ouverture d'une playlist ne lancent jamais automatiquement la lecture", async (t) => {
  const { context, calls } = musicContext(t, { connected: true, responses: { search: { tracks: [musicTrack] }, playlists: { playlists: [{ id: "playlist_1", name: "Ma playlist", total: 1 }] }, playlist_tracks: { tracks: [musicTrack] } } });
  context.content.innerHTML = context.renderCreatorMusic();
  await context.handleCreatorMusicAction({ action: "music-tab", target: { dataset: { value: "search" } } });
  context.content.querySelector("[data-music-search]").value = "Artiste";
  await context.handleCreatorMusicAction({ action: "music-search", target: { dataset: {} } });
  assert.match(context.content.querySelector(".music-track-list").textContent, /Un titre réel de test/);
  await context.handleCreatorMusicAction({ action: "music-tab", target: { dataset: { value: "playlists" } } });
  await context.handleCreatorMusicAction({ action: "music-playlist", id: "playlist_1", target: { dataset: {} } });
  assert.match(context.content.querySelector(".music-section-heading h3").textContent, /Ma playlist/);
  assert.equal(calls.some((config) => ["play_tracks", "play_playlist"].includes(config.operation)), false);
});

test("une réponse privée tardive est ignorée après changement de compte, même sans nouveau rendu de la page", async (t) => {
  const context = creatorContext(t);
  context.snapshot.state.settings.account.uid = "account_a";
  let resolve;
  context.api = { users: { snapshot: () => new Promise((done) => { resolve = done; }) } };
  const pending = context.refreshCreatorUsersDatabase({ force: true });
  context.snapshot.state.settings.account.uid = "account_b";
  resolve({ rows: [historicalUser(1)], total: 1, filteredTotal: 1 });
  assert.equal(await pending, null);
  assert.equal(vm.runInContext("creatorUserDatabase", context), null);
});

test("le lecteur n'actualise que Spotify toutes les cinq secondes tant que sa vue est visible", async (t) => {
  const { context, calls } = musicContext(t, { connected: true, track: musicTrack });
  const timers = new Map();
  let timerId = 0;
  let refreshes = 0;
  context.window.setTimeout = (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; };
  context.window.clearTimeout = (id) => timers.delete(id);
  context.refreshSpotifyStatus = async () => { refreshes += 1; return context.spotifyStatus; };
  context.rendererVisualsActive = () => true;
  context.content.innerHTML = context.renderCreatorMusic();
  await context.refreshCreatorMusicData();
  assert.equal(timers.size, 1);
  const scheduled = timers.values().next().value;
  assert.equal(scheduled.delay, 5000);
  timers.clear();
  calls.length = 0;
  await scheduled.callback();
  assert.equal(refreshes, 1);
  assert.equal(calls.length, 0, "la file, la recherche et les playlists ne sont pas repollées");
  context.currentPage = "home";
  context.synchronizeCreatorMusicPolling();
  assert.equal(timers.size, 0, "quitter le lecteur supprime son timer");
  context.currentPage = "music";
  context.rendererVisualsActive = () => false;
  context.synchronizeCreatorMusicPolling();
  assert.equal(timers.size, 0, "aucun polling en fenêtre cachée");
});

test("changer de compte pendant une confirmation annule la suppression sur le nouveau compte", async (t) => {
  const context = creatorContext(t);
  context.snapshot.state.settings.account.uid = "account_a";
  connectUsersDatabase(context, [historicalUser(1)]);
  await context.refreshCreatorUsersDatabase({ force: true });
  const removed = [];
  context.api.users.remove = async (id) => removed.push(id);
  context.perform = async (work) => work();
  context.confirmAction = async () => { context.snapshot.state.settings.account.uid = "account_b"; return true; };
  context.registerActionHandler = () => {};
  context.ACTION_NOT_HANDLED = Symbol("not-handled");
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "app", "actions", "handlers", "creator-audience.js"), "utf8"), context);
  await assert.rejects(context.handleCreatorAudienceAction({ action: "audience-delete", id: "user_1", target: { dataset: {} } }), /compte a changé/);
  assert.equal(removed.length, 0);
});

test("une rafale d'événements ne reconstruit pas la page historique ni ses indicateurs à données identiques", async (t) => {
  const context = creatorContext(t);
  const calls = connectUsersDatabase(context, [historicalUser(1)]);
  context.content.innerHTML = context.renderCreatorUsers();
  await context.refreshCreatorUsersDatabase({ force: true });
  const row = context.content.querySelector("[data-creator-user-row]");
  const metric = context.content.querySelector(".audience-metric");
  const reads = calls.length;
  for (let index = 0; index < 100; index += 1) context.syncCreatorUsersRuntime();
  assert.equal(context.content.querySelector("[data-creator-user-row]"), row);
  assert.equal(context.content.querySelector(".audience-metric"), metric);
  assert.equal(calls.length, reads, "la limite d'une lecture par seconde reste appliquée");
});

test("un bouton explicite affiche les blocages sans historique et débloque seulement la portée choisie", async (t) => {
  const context = creatorContext(t);
  const entries = [
    { id: "tiktok-alice", platform: "tiktok", streamer: "creator", username: "alice", name: "Alice", rowId: "", avatarUrl: "" },
    { id: "kick-alice", platform: "kick", streamer: "other_creator", username: "alice", name: "Alice Kick", rowId: "", avatarUrl: "" }
  ];
  const { reads, unblocked } = connectBlockedDatabase(context, entries);
  context.content.innerHTML = context.renderCreatorUsers();
  await context.refreshCreatorUsersDatabase({ force: true });
  const toggle = context.content.querySelector('[data-action="audience-show-blocked"]');
  const panel = context.content.querySelector("[data-creator-users-blocked-panel]");
  assert.equal(panel.hidden, true);
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.equal(toggle.querySelector("[data-audience-blocked-count]").textContent, "2");
  assert.equal(reads.at(-1).includeBlocked, false);
  const draft = context.content.querySelector("[data-creator-users-blocked]");
  draft.value = "@brouillon_non_enregistré";
  draft.dataset.edited = "true";
  await context.handleCreatorAudienceAction({ action: "audience-show-blocked", target: toggle });
  assert.equal(panel.hidden, false);
  assert.equal(toggle.getAttribute("aria-expanded"), "true");
  assert.equal(reads.at(-1).includeBlocked, true);
  assert.equal(panel.querySelectorAll(".audience-blocked-entry").length, 2);
  assert.match(panel.textContent, /Kick · Streamer @other_creator/);
  await context.handleCreatorAudienceAction({ action: "audience-unblock", id: "tiktok-alice", target: {} });
  assert.deepEqual(JSON.parse(JSON.stringify(unblocked)), [{ platform: "tiktok", streamer: "creator", username: "alice", rowId: "" }]);
  assert.equal(panel.querySelectorAll(".audience-blocked-entry").length, 1);
  assert.equal(toggle.querySelector("[data-audience-blocked-count]").textContent, "1");
  assert.equal(entries[0].id, "kick-alice");
  assert.equal(draft.value, "@brouillon_non_enregistré", "le déblocage ciblé ne remplace pas le brouillon de modération");
  await context.handleCreatorAudienceAction({ action: "audience-show-blocked", target: toggle });
  assert.equal(panel.hidden, true);
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
});

test("les blocages sont paginés et le retrait du dernier élément revient à la dernière page valide", async (t) => {
  const context = creatorContext(t);
  const entries = Array.from({ length: 51 }, (_, index) => ({ id: `entry-${index}`, platform: "tiktok", streamer: "creator", username: `viewer_${index}`, name: `Viewer ${index}`, rowId: "", avatarUrl: "" }));
  const { reads } = connectBlockedDatabase(context, entries);
  context.content.innerHTML = context.renderCreatorUsers();
  await context.refreshCreatorUsersDatabase({ force: true });
  await context.handleCreatorAudienceAction({ action: "audience-show-blocked", target: {} });
  const panel = context.content.querySelector("[data-creator-users-blocked-panel]");
  assert.equal(panel.querySelectorAll(".audience-blocked-entry").length, 50);
  await context.handleCreatorAudienceAction({ action: "audience-blocked-page", target: { dataset: { direction: "1" } } });
  assert.equal(reads.at(-1).blockedOffset, 50);
  assert.equal(panel.querySelectorAll(".audience-blocked-entry").length, 1);
  await context.handleCreatorAudienceAction({ action: "audience-unblock", id: "entry-50", target: {} });
  assert.equal(reads.at(-1).blockedOffset, 0);
  assert.equal(panel.querySelectorAll(".audience-blocked-entry").length, 50);
  assert.match(panel.textContent, /50 blocages · page 1 \/ 1/);
});

test("un déblocage tardif ne cible pas la base d'un nouveau compte et une ancienne liste est invalidée", async (t) => {
  const context = creatorContext(t);
  context.snapshot.state.settings.account.uid = "account_a";
  const entry = { id: "entry", platform: "tiktok", streamer: "creator", username: "alice", name: "Alice", rowId: "", avatarUrl: "" };
  const { unblocked } = connectBlockedDatabase(context, [entry]);
  context.content.innerHTML = context.renderCreatorUsers();
  await context.refreshCreatorUsersDatabase({ force: true });
  await context.handleCreatorAudienceAction({ action: "audience-show-blocked", target: {} });
  context.perform = async (work) => { context.snapshot.state.settings.account.uid = "account_b"; return work(); };
  await assert.rejects(context.handleCreatorAudienceAction({ action: "audience-unblock", id: "entry", target: {} }), /compte a changé/);
  assert.equal(unblocked.length, 0);
  context.resetCreatorUsersAccount();
  assert.equal(vm.runInContext("creatorBlockedOpen", context), false);
  assert.equal(vm.runInContext("creatorUserDatabase", context), null);
  await assert.rejects(context.handleCreatorAudienceAction({ action: "audience-unblock", id: "entry", target: {} }), /page courante/);
});

test("changer de compte pendant la lecture d'un fichier interdit son import dans le nouveau compte", async (t) => {
  const context = creatorContext(t);
  context.snapshot.state.settings.account.uid = "account_a";
  let resolve;
  const imported = [];
  context.api = { users: { import: async (data) => imported.push(data) } };
  context.registerActionHandler = () => {};
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "app", "actions", "handlers", "creator-audience.js"), "utf8"), context);
  const pending = context.importCreatorAudienceFile({ value: "selected", files: [{ size: 20, text: () => new Promise((done) => { resolve = done; }) }] });
  context.snapshot.state.settings.account.uid = "account_b";
  resolve('{"format":"shenpulse-viewers"}');
  await assert.rejects(pending, /compte a changé/);
  assert.equal(imported.length, 0);
});

test("une réponse Spotify tardive et une sauvegarde musicale ne remplacent pas les données du nouveau compte", async (t) => {
  const { context } = musicContext(t);
  context.snapshot.state.settings.account.uid = "account_a";
  context.content.innerHTML = context.renderCreatorMusic();
  await context.handleCreatorMusicAction({ action: "music-tab", target: { dataset: { value: "settings" } } });
  let resolve;
  context.api.controlSpotify = () => new Promise((done) => { resolve = done; });
  const pending = context.handleCreatorMusicAction({ action: "music-settings-save", target: { dataset: {} } });
  await new Promise((done) => setImmediate(done));
  context.snapshot.state.settings.account.uid = "account_b";
  context.resetCreatorMusicAccount(true);
  resolve({ settings: { enabled: true }, queue: [{ id: "private_a" }] });
  await assert.rejects(pending, /compte a changé/);
  assert.equal(vm.runInContext("creatorMusicData.requests", context), undefined);
  const sentinel = { connected: false, account: { displayName: "Compte B" } };
  context.spotifyStatus = sentinel;
  context.api.getSpotifyStatus = () => new Promise((done) => { resolve = done; });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "app", "features", "media", "spotify.js"), "utf8"), context);
  const oldStatus = context.refreshSpotifyStatus({ redraw: false });
  context.snapshot.state.settings.account.uid = "account_c";
  resolve({ connected: true, account: { displayName: "Ancien B" } });
  assert.equal(await oldStatus, null);
  assert.equal(context.spotifyStatus, sentinel);
});

test("une déconnexion puis reconnexion au même UID invalide les opérations de l'ancienne session", async (t) => {
  const context = creatorContext(t);
  context.snapshot.state.settings.account.uid = "same_account";
  const owner = context.captureCreatorPrivateOperation();
  context.invalidateCreatorPrivateOperations();
  assert.equal(context.creatorPrivateOperationActive(owner), false);
  assert.throws(() => context.assertCreatorPrivateOperation(owner), /compte a changé/);
  assert.equal(context.creatorPrivateOperationActive(context.captureCreatorPrivateOperation()), true);
});

test("les lectures Spotify anciennes ne remplacent ni une réponse récente ni un statut vidé", async (t) => {
  const context = creatorContext(t);
  context.spotifyStatus = { connected: false };
  const pending = [];
  context.api = { getSpotifyStatus: () => new Promise((resolve) => pending.push(resolve)) };
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "app", "features", "media", "spotify.js"), "utf8"), context);
  const old = context.refreshSpotifyStatus({ redraw: false });
  const recent = context.refreshSpotifyStatus({ redraw: false });
  pending[1]({ connected: true, account: { displayName: "Plus récent" } });
  await recent;
  pending[0]({ connected: true, account: { displayName: "Ancien" } });
  assert.equal(await old, null);
  assert.equal(context.spotifyStatus.account.displayName, "Plus récent");
  const discarded = context.refreshSpotifyStatus({ redraw: false });
  context.clearCreatorSpotifyStatus();
  pending[2]({ connected: true, account: { displayName: "Privé" } });
  assert.equal(await discarded, null);
  assert.equal(context.spotifyStatus.account, null);
  assert.equal(context.spotifyStatus.playback, null);
});

test("les notifications de demandes préservent la recherche musicale en cours et rejettent l'ancien compte", async (t) => {
  const { context } = musicContext(t, { connected: true });
  context.snapshot.state.settings.account.uid = "current_account";
  context.content.innerHTML = context.renderCreatorMusic();
  await context.handleCreatorMusicAction({ action: "music-tab", target: { dataset: { value: "search" } } });
  const input = context.content.querySelector("[data-music-search]");
  input.value = "Saisie non envoyée";
  input.focus();
  input.setSelectionRange(4, 8);
  context.acceptCreatorSongRequestsStatus({ ownerUid: "current_account", queue: [] });
  const refreshed = context.content.querySelector("[data-music-search]");
  assert.equal(refreshed.value, "Saisie non envoyée");
  assert.equal(context.document.activeElement, refreshed);
  assert.equal(refreshed.selectionStart, 4);
  context.acceptCreatorSongRequestsStatus({ ownerUid: "old_account", queue: [{ id: "private" }] });
  assert.equal(vm.runInContext("creatorMusicData.requests.queue.length", context), 0);
});

test("les commandes Spotify historiques rejettent OAuth, confirmation et contrôle d'un ancien compte", async (t) => {
  for (const action of ["spotify-connect", "spotify-disconnect", "spotify-control"]) {
    const context = creatorContext(t);
    context.snapshot.state.settings.account.uid = "account_a";
    const sentinel = { connected: false, account: null };
    context.spotifyStatus = sentinel;
    let resolve;
    let accepted = 0;
    let refreshed = 0;
    let disconnects = 0;
    context.api = {
      connectSpotify: () => new Promise((done) => { resolve = done; }),
      controlSpotify: () => new Promise((done) => { resolve = done; }),
      disconnectSpotify: async () => { disconnects += 1; return {}; },
      getSpotifyStatus: async () => { refreshed += 1; return {}; }
    };
    context.confirmAction = () => new Promise((done) => { resolve = done; });
    context.perform = async (work) => work();
    context.acceptSnapshot = () => { accepted += 1; };
    context.render = () => {};
    context.registerActionHandler = () => {};
    context.ACTION_NOT_HANDLED = Symbol("not-handled");
    for (const file of ["features/media/spotify.js", "actions/handlers/content-commerce.js"]) {
      vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "app", file), "utf8"), context);
    }
    const pending = context.handleContentAndCommerceAction({ action, target: { dataset: { operation: "next" } } });
    context.snapshot.state.settings.account.uid = "account_b";
    resolve(action === "spotify-disconnect" ? true : { status: { connected: true, account: { displayName: "Ancien" } }, snapshot: context.snapshot });
    await assert.rejects(pending, /compte a changé/, action);
    assert.equal(context.spotifyStatus, sentinel, action);
    assert.equal(accepted, 0, action);
    assert.equal(refreshed, 0, action);
    assert.equal(disconnects, 0, action);
  }
});

test("Musique reprend les commandes Spotify et les actions musicales du profil, avec les derniers réglages partagés", (t) => {
  const { context } = musicContext(t);
  context.canAccessPage = () => true;
  context.ShenPulseCommandExecution = require("../src/shared/command-execution");
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src/renderer/app/features/chatbot/execution.js"), "utf8"), context);
  context.snapshot.state.commands = [
    { id:"pause", command:"!pause", enabled:true, execution:{type:"music",operation:"pause"} },
    { id:"action-music", command:"!ambiance", enabled:false, execution:{type:"action",actionId:"spotify-action"} },
    { id:"sound", command:"!son", execution:{type:"action",actionId:"sound-action"} }
  ];
  context.snapshot.state.rules = [{id:"rule",enabled:true,actions:[
    {id:"spotify-action",type:"spotify.queue",config:{operation:"next"}},
    {id:"sound-action",type:"audio.play",config:{url:"fake.mp3"}}
  ]}];
  context.snapshot.state.settings.spotify.songRequests={enabled:true,commands:{request:"!chanson"},commandEnabled:{queue:false}};
  vm.runInContext('creatorMusicData.requests = { settings: { commands: {request: "!ancien"} } };',context);
  context.content.innerHTML = context.renderCreatorMusicSettings();
  assert.equal(context.content.querySelector('[name="request"]').value,"!chanson");
  assert.equal(context.content.querySelector('[name="queueEnabled"]').checked,false);
  assert.equal(context.content.querySelectorAll(".music-linked-command-list article").length,2);
  assert.match(context.content.textContent,/!pause/);assert.match(context.content.textContent,/!ambiance/);
  assert.doesNotMatch(context.content.textContent,/!son/);
  assert.equal(context.content.querySelectorAll('[data-action="chatbot-edit"]').length,2);
  context.canAccessPage = () => false;
  context.content.innerHTML = context.renderCreatorMusicSettings();
  assert.equal(context.content.querySelectorAll('[data-action="chatbot-edit"]').length,0);
});

test("désactiver une commande dans Musique est enregistré sans bouton Enregistrer et met à jour le vrai store", async (t) => {
  const { context, calls } = musicContext(t);
  const { StateStore } = require("../src/main/store");
  const { SongRequestsService } = require("../src/main/spotify/song-requests");
  const store = new StateStore("unused-autosave-test", { isEncryptionAvailable: () => false });
  store.touch = () => {};
  store.state.activeAccountUid = "owner";
  store.state.settings.account.uid = "owner";
  const service = new SongRequestsService({ store, spotify: {} });
  service.configure({ enabled: true });
  context.snapshot = { state: store.getState(), packs: [] };
  context.api.getSnapshot = async () => ({ state: store.getState(), packs: [] });
  context.api.controlSpotify = async (config) => {
    calls.push(config);
    return config.operation === "requests_settings" ? service.configure(config.settings) : service.status();
  };
  context.content.innerHTML = context.renderCreatorMusic();
  await context.handleCreatorMusicAction({ action: "music-tab", target: { dataset: { value: "settings" } } });
  // Un autre champ en brouillon ne doit pas empêcher ni être enregistré par l’interrupteur.
  context.content.querySelector('[name="request"]').value = "brouillon invalide";
  const skip = context.content.querySelector('[name="skipEnabled"]');
  skip.checked = false;
  assert.equal(context.handleCreatorMusicChange(skip), true);
  assert.equal(skip.disabled, true);
  const queue = context.content.querySelector('[name="queueEnabled"]');
  queue.checked = false;
  assert.equal(context.handleCreatorMusicChange(queue), true);
  await vm.runInContext("creatorMusicSettingsWrite", context);
  await new Promise((done) => setImmediate(done));
  assert.equal(store.state.commands.find((row) => row.execution.operation === "requests_skip").enabled, false);
  assert.equal(store.state.commands.find((row) => row.execution.operation === "requests_list").enabled, false);
  assert.equal(context.snapshot.state.commands.find((row) => row.execution.operation === "requests_skip").enabled, false);
  assert.equal(context.content.querySelector('[name="request"]').value, "brouillon invalide");
  assert.equal(store.state.settings.spotify.songRequests.commands.request, "!sr");
  assert.equal(skip.disabled, false);
  assert.equal(queue.disabled, false);
  const saved = calls.filter((call) => call.operation === "requests_settings");
  assert.equal(saved.length, 2);
  assert.deepEqual(Object.keys(saved[0].settings), ["commandEnabled"]);
});

test("l’interrupteur musical revient à son état initial si l’enregistrement échoue", async (t) => {
  const { context } = musicContext(t);
  context.content.innerHTML = context.renderCreatorMusic();
  await context.handleCreatorMusicAction({ action: "music-tab", target: { dataset: { value: "settings" } } });
  context.api.controlSpotify = async () => { throw new Error("Stockage indisponible"); };
  const input = context.content.querySelector('[name="skipEnabled"]');
  input.checked = false;
  context.handleCreatorMusicChange(input);
  await vm.runInContext("creatorMusicSettingsWrite", context);
  await new Promise((done) => setImmediate(done));
  assert.equal(input.checked, true);
  assert.equal(input.disabled, false);
});

test("une désactivation est aussi rafraîchie si Commandes est ouvert avant la fin de l’enregistrement", async (t) => {
  const { context } = musicContext(t);
  context.content.innerHTML = context.renderCreatorMusic();
  await context.handleCreatorMusicAction({ action: "music-tab", target: { dataset: { value: "settings" } } });
  let release, refreshed = 0;
  context.api.controlSpotify = () => new Promise((done) => { release = done; });
  context.syncCreatorChatbotRuntime = () => { refreshed += 1; return true; };
  const input = context.content.querySelector('[name="skipEnabled"]');
  input.checked = false;
  context.handleCreatorMusicChange(input);
  await new Promise((done) => setImmediate(done));
  context.currentPage = "commands";
  release({ settings: { enabled: true, commandEnabled: { skip: false } }, queue: [] });
  await vm.runInContext("creatorMusicSettingsWrite", context);
  assert.equal(refreshed, 1);
});
