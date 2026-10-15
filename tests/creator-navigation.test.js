"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");
const { JSDOM, VirtualConsole } = require("jsdom");
const { createDefaultState } = require("../src/main/defaults");
const { version: appVersion } = require("../package.json");

async function waitUntil(predicate, label) {
  const until = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() > until) throw new Error(label);
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
}

test("une session authentifiée navigue dans tous les espaces créateurs et garde son simulateur lors des événements", async () => {
  const htmlFile = path.join(__dirname, "..", "src", "renderer", "index.html");
  const state = createDefaultState();
  const account = { authenticated: true, email: "creator@example.test", uid: "creator-1", displayName: "Créateur", emailVerified: true };
  Object.assign(state.settings.account, account);
  state.commerce.subscription = { tier: "pro", status: "active", source: "own" };
  const communityPack = { id: "connect-four", name: "Puissance 4 de test", description: "Un jeu communautaire public", accessMode: "included", requiresPro: false, guide: { mode: "integrated" }, connector: { type: "internal" }, effects: [], tags: [] };
  const snapshot = { appVersion, state, packs: [communityPack], soundCatalog: [], mediaCatalog: [], catalogCounts: {}, timerRuntime: [], overlayUrls: {}, localOverlayUrls: {}, publicOverlayRelay: { connected: false }, liveDirectory: { available: true, connected: true, enabled: false, rows: [] } };
  const handlers = new Map();
  const settingsRequests = [];
  const entityRequests = [];
  const operationalCalls = [];
  const preferences = new Map();
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => errors.push(error));
  const dom = new JSDOM(fs.readFileSync(htmlFile, "utf8"), {
    url: pathToFileURL(htmlFile).toString(), runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole,
    beforeParse(window) {
      Object.defineProperty(window, "localStorage", { value: {
        getItem: (key) => preferences.get(key) || null,
        setItem: (key, value) => preferences.set(key, String(value)),
        removeItem: (key) => preferences.delete(key)
      } });
      window.shenPulse = {
        ...Object.fromEntries([
          "startSession", "stopSession", "simulateEvent", "testEvent", "testAction", "previewAction", "testRule",
          "startGameSession", "stopGameSession", "launchGame", "selectGame", "testGame", "triggerEffect", "startConnection", "startTikTok"
        ].map((name) => [name, async (...args) => {
          operationalCalls.push({ name, args });
          return snapshot;
        }])),
        getSnapshot: async () => snapshot,
        upsert: async (collection, item) => {
          assert.equal(collection, "rules", "Le test de statut modifie uniquement la règle visée.");
          entityRequests.push({ collection, item: structuredClone(item) });
          state.rules = state.rules.map((rule) => rule.id === item.id ? { ...item } : rule);
          return snapshot;
        },
        saveSettings: async (incoming) => {
          settingsRequests.push(incoming);
          Object.assign(state.settings, incoming);
          return snapshot;
        },
        searchGifts: async () => ({ gifts: [{ id: "5655", name: "Rose", cost: 1, imageUrl: "" }], total: 1 }),
        getGameRuntimeStatus: async () => null,
        getSpotifyStatus: async () => ({ configured: true, connected: false, devices: [] }),
        controlSpotify: async (config) => {
          assert.equal(config.operation, "requests_status", "La navigation ne doit pas lancer de musique.");
          return { ownerUid: account.uid, settings: { enabled: false }, queue: [], history: [] };
        },
        users: { snapshot: async (options) => {
          const row = { id: "musique", username: "musique", name: "Musique", platform: "tiktok", streamer: "creator", diamonds: 2, events: 1, firstSeen: "2026-10-13T10:00:00Z", lastSeen: "2026-10-13T10:00:00Z" };
          const rows = !options.query || `${row.name} ${row.username}`.toLowerCase().includes(options.query.toLowerCase()) ? [row] : [];
          return { rows, total: 1, filteredTotal: rows.length, stats: { diamonds: 2, dominantRank: "Fan" }, streamers: ["creator"], blockedUsers: [] };
        } },
        controllers: { status: async () => ({ devices: [], mappings: [] }) },
        updates: { check: async () => ({ available: false }) },
        account: { status: async () => account, gameCheatAccess: async () => ({ allowed: false }), syncEntitlements: async () => null },
        admin: { status: async () => ({ authorized: false }), visibility: async () => state.settings.siteVisibility },
        on: (event, callback) => { handlers.set(event, callback); return () => {}; }
      };
      window.HTMLCanvasElement.prototype.getContext = () => ({ clearRect() {}, drawImage() {}, fillRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {} });
      if (!window.HTMLDialogElement.prototype.showModal) window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
      if (!window.HTMLDialogElement.prototype.close) window.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
      window.addEventListener("error", (event) => errors.push(event.error || new Error(event.message)));
      window.addEventListener("unhandledrejection", (event) => errors.push(event.reason));
    }
  });
  try {
    await waitUntil(() => dom.window.document.querySelector(".creator-home-page"), "L’accueil authentifié ne démarre pas.");
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(errors.length, 0, errors.map((error) => error.stack || error.message).join("\n"));
    const navigation = dom.window.document.getElementById("navigation");
    const pageOrder = dom.window.eval("pages.map(page => page.id).filter(Boolean)");
    assert.equal(pageOrder.indexOf("music"), pageOrder.indexOf("voice") + 1,
      "Voix & sons et Musique restent côte à côte");
    assert.equal(pageOrder.indexOf("commands"), pageOrder.indexOf("irl") + 1,
      "Commandes suit immédiatement Interactions IRL");
    assert.equal(pageOrder.indexOf("matches"), pageOrder.indexOf("commands") + 1,
      "Matchs suit Commandes dans la section création");
    const expectedProEntries = dom.window.eval("pages.filter(page => page.id && ShenPulseProAccess.requiresProSection(page.id) && canDisplayPage(page)).map(page => page.id)");
    assert.equal(navigation.querySelectorAll(".nav-pro-badge").length, expectedProEntries.length);
    for (const id of expectedProEntries) {
      const metadata = navigation.querySelector(`[data-navigate="${id}"] .nav-meta`);
      assert.equal(metadata.lastElementChild.className, "nav-pro-badge", `Le badge Pro de ${id} termine la ligne.`);
      const count = metadata.querySelector(".nav-count");
      if (count) assert.equal(metadata.firstElementChild, count, `Le compteur de ${id} précède le badge Pro.`);
    }
    const gamesPage = dom.window.eval("pages.find(page => page.id === 'games')");
    const originalGamesCount = gamesPage.count;
    const gamesNavigation = navigation.querySelector('[data-navigate="games"]');
    const gamesProBadge = gamesNavigation.querySelector(".nav-pro-badge");
    gamesPage.count = () => 49;
    dom.window.renderNavigation();
    const stableGamesCount = gamesNavigation.querySelector(".nav-count");
    assert.equal(stableGamesCount.textContent, "49");
    gamesPage.count = () => 123;
    dom.window.renderNavigation();
    assert.equal(gamesNavigation.querySelector(".nav-count"), stableGamesCount, "Une variation du nombre garde son nœud.");
    assert.equal(stableGamesCount.textContent, "123");
    gamesPage.count = () => null;
    dom.window.renderNavigation();
    assert.equal(gamesNavigation.querySelector(".nav-count"), null);
    gamesPage.count = () => 49;
    dom.window.renderNavigation();
    assert.equal(gamesNavigation.querySelector(".nav-meta").firstElementChild.className, "nav-count");
    assert.equal(gamesNavigation.querySelector(".nav-meta").lastElementChild, gamesProBadge, "Le compteur recréé se place toujours avant le badge stable.");
    gamesPage.count = originalGamesCount;
    dom.window.renderNavigation();
    assert.ok(navigation.querySelector('[data-navigate="irl"]'), "Un abonné non administrateur voit Interactions IRL.");
    assert.match(navigation.querySelector('[data-navigate="irl"]').textContent, /Machines IRL/);
    const homeNavigation = navigation.querySelector('[data-navigate="home"]');
    const dashboardNavigation = navigation.querySelector('[data-navigate="dashboard"]');
    assert.ok(homeNavigation && dashboardNavigation);
    assert.equal(homeNavigation.classList.contains("active"), true);
    assert.ok([...navigation.querySelectorAll("[data-navigate]")].indexOf(homeNavigation) <
      [...navigation.querySelectorAll("[data-navigate]")].indexOf(dashboardNavigation),
    "Accueil doit précéder Tableau de bord");
    const stableHome = dom.window.document.querySelector(".creator-home-page");
    const stableHero = stableHome.querySelector(".home-hero");
    const stableArtwork = stableHome.querySelector(".home-hero-art");
    const stableHomeCta = stableHome.querySelector('.home-hero-actions [data-navigate="dashboard"]');
    assert.equal(typeof handlers.get("runtime-state-changed"), "function");
    assert.equal(typeof handlers.get("live-event"), "function");
    for (let index = 0; index < 100; index += 1) {
      handlers.get("runtime-state-changed")({ state: { statistics: { ...state.statistics, sessionEvents: index + 1, sessionLikes: index + 1 } } });
      handlers.get("live-event")({ id: `home-burst-${index}`, type: "like", timestamp: new Date().toISOString(), user: { id: `home-viewer-${index}`, name: `home-viewer-${index}` }, data: { count: 1 } });
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(dom.window.document.querySelector(".creator-home-page"), stableHome,
      "Une rafale live ne doit pas reconstruire la page Accueil");
    assert.equal(dom.window.document.querySelector(".home-hero"), stableHero);
    assert.equal(dom.window.document.querySelector(".home-hero-art"), stableArtwork);
    assert.equal(dom.window.document.querySelector('.home-hero-actions [data-navigate="dashboard"]'), stableHomeCta);
    const initialTikTok = state.settings.tiktok;
    const initialKick = state.settings.kick;
    const initialConnections = state.connections;
    function patchDetectedHomeLives({ tiktok = "live", kick = false, viewers = 0, statistics } = {}) {
      state.settings = {
        ...state.settings,
        tiktok: { ...initialTikTok, username: "live_creator", status: tiktok },
        kick: { ...initialKick, live: kick, viewers, account: { name: "kick_creator", avatarUrl: "https://avatar.example.test/kick.png" } }
      };
      state.connections = [
        ...initialConnections,
        { id: "source_tiktok", type: "tiktok-direct", enabled: tiktok === "live", status: tiktok === "live" ? "connected" : "disconnected", liveStatus: tiktok, config: { username: "live_creator" } },
        { id: "source_kick", type: "kick-native", enabled: kick, status: kick ? "connected" : "disconnected", liveStatus: kick ? "live" : "offline" }
      ];
      handlers.get("runtime-state-changed")({ state: { settings: state.settings, connections: state.connections, ...(statistics ? { statistics } : {}) } });
    }
    // Explicit public-feed fixture, never a local LIVE fallback or an actual cloud write.
    function publishHomeFeed({ tiktok = true, tiktokViewers = null, tiktokAvatar = "", kick = false, kickViewers = null } = {}) {
      handlers.get("live-directory-status")({
        available: true, connected: true, enabled: true, publishing: tiktok || kick, capped: false,
        rows: [
          ...(tiktok ? [{ id: "source_tiktok", platform: "TikTok", username: "live_creator", avatarUrl: tiktokAvatar, viewers: tiktokViewers, updatedAt: Date.now(), own: true }] : []),
          ...(kick ? [{ id: "source_kick", platform: "Kick", username: "kick_creator", avatarUrl: "https://avatar.example.test/kick.png", viewers: kickViewers, updatedAt: Date.now(), own: true }] : [])
        ]
      });
    }
    patchDetectedHomeLives();
    const liveSection = stableHome.querySelector("[data-home-live]");
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(liveSection.querySelector(".home-live-card"), null, "La détection locale sans opt-in n’est jamais une présence publique.");
    assert.equal(liveSection.querySelector(".home-live-count > strong").textContent, "0");
    assert.equal(dom.window.document.getElementById("account-directory-toggle").getAttribute("aria-checked"), "false");
    state.settings.liveDirectory = { ...state.settings.liveDirectory, publishEnabled: true };
    publishHomeFeed();
    await waitUntil(() => dom.window.document.querySelector('[data-home-live-source="source_tiktok"]'), "Le feed public TikTok ne rejoint pas la section Accueil.");
    assert.equal(liveSection.querySelector('.home-live-card-identity > strong').textContent, "@live_creator");
    assert.equal(liveSection.querySelector(".home-live-count > strong").textContent, "1");
    assert.equal(liveSection.querySelector(".home-live-viewers strong").textContent, "—", "TikTok ne doit pas inventer un compteur de spectateurs courants");
    assert.equal(dom.window.document.querySelector(".creator-home-page"), stableHome);
    assert.equal(dom.window.document.querySelector(".home-hero"), stableHero);
    assert.equal(dom.window.document.querySelector(".home-hero-art"), stableArtwork);
    const retainedSettings = dom.window.eval("snapshot.state.settings");
    const measuredTikTok = {
      ...state.settings.tiktok,
      broadcaster: { username: "live_creator", nickname: "Live Creator", avatarUrl: "https://avatar.example.test/tiktok.png" },
      currentViewers: 12
    };
    stableHomeCta.focus();
    handlers.get("runtime-state-changed")({ state: { settings: { tiktok: measuredTikTok } } });
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(liveSection.querySelector('[data-home-live-source="source_tiktok"] img'), null, "Un patch local ne contourne pas le feed public.");
    publishHomeFeed({ tiktokViewers: 12, tiktokAvatar: measuredTikTok.broadcaster.avatarUrl });
    await waitUntil(() => liveSection.querySelector('[data-home-live-source="source_tiktok"] img'), "L’avatar du feed public TikTok n’est pas affiché.");
    const measuredCard = liveSection.querySelector('[data-home-live-source="source_tiktok"]');
    const measuredAvatar = measuredCard.querySelector("img");
    const measuredButton = measuredCard.querySelector("button");
    assert.equal(measuredAvatar.getAttribute("src"), "https://avatar.example.test/tiktok.png");
    assert.equal(measuredCard.querySelector(".home-live-viewers strong").textContent, "12");
    assert.equal(dom.window.document.activeElement, stableHomeCta);
    measuredButton.focus();
    for (let index = 0; index < 100; index += 1) {
      handlers.get("runtime-state-changed")({ state: { settings: { tiktok: { ...measuredTikTok, currentViewers: index } } } });
      publishHomeFeed({ tiktokViewers: index, tiktokAvatar: measuredTikTok.broadcaster.avatarUrl });
    }
    await waitUntil(() => measuredCard.querySelector(".home-live-viewers strong").textContent === "99", "Le feed public ne met pas à jour le compteur courant.");
    const mergedSettings = dom.window.eval("snapshot.state.settings");
    for (const key of ["account", "locale", "overlayConfigs", "siteVisibility"]) {
      assert.equal(mergedSettings[key], retainedSettings[key], `Le patch TikTok conserve les réglages ${key}`);
    }
    assert.equal(liveSection.querySelector('[data-home-live-source="source_tiktok"]'), measuredCard);
    assert.equal(measuredCard.querySelector("img"), measuredAvatar);
    assert.equal(measuredCard.querySelector("button"), measuredButton);
    assert.equal(dom.window.document.activeElement, measuredButton);
    assert.equal(dom.window.document.querySelector(".creator-home-page"), stableHome);
    assert.equal(dom.window.document.querySelector(".home-hero"), stableHero);
    assert.equal(dom.window.document.querySelector(".home-hero-art"), stableArtwork);
    assert.equal(dom.window.document.querySelector('.home-hero-actions [data-navigate="dashboard"]'), stableHomeCta);
    patchDetectedHomeLives({ kick: true, viewers: 27 });
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(liveSection.querySelector('[data-home-live-source="source_kick"]'), null, "Une deuxième source locale n’est pas ajoutée au feed implicitement.");
    publishHomeFeed({ tiktokViewers: 99, tiktokAvatar: measuredTikTok.broadcaster.avatarUrl, kick: true, kickViewers: 27 });
    await waitUntil(() => liveSection.querySelector('[data-home-live-source="source_kick"]'), "Le live Kick du feed public ne rejoint pas la section Accueil.");
    const kickCard = liveSection.querySelector('[data-home-live-source="source_kick"]');
    const kickAvatar = kickCard.querySelector("img");
    const kickButton = kickCard.querySelector("button");
    assert.equal(kickCard.querySelector(".home-live-viewers strong").textContent, "27");
    assert.equal(liveSection.querySelector(".home-live-count > strong").textContent, "2");
    for (let index = 0; index < 100; index += 1) {
      patchDetectedHomeLives({ kick: true, viewers: index + 28, statistics: { ...state.statistics, sessionEvents: index + 101, sessionUniqueViewers: ["not_a_current_viewer_count"] } });
      publishHomeFeed({ tiktokViewers: 99, tiktokAvatar: measuredTikTok.broadcaster.avatarUrl, kick: true, kickViewers: index + 28 });
    }
    await waitUntil(() => kickCard.querySelector(".home-live-viewers strong").textContent === "127", "Les spectateurs Kick ne sont pas actualisés en place.");
    assert.equal(stableHome.querySelector("[data-home-live]"), liveSection);
    assert.equal(liveSection.querySelector('[data-home-live-source="source_kick"]'), kickCard);
    assert.equal(kickCard.querySelector("img"), kickAvatar);
    assert.equal(kickCard.querySelector("button"), kickButton);
    assert.equal(dom.window.document.querySelector(".creator-home-page"), stableHome);
    assert.equal(dom.window.document.querySelector(".home-hero"), stableHero);
    assert.equal(dom.window.document.querySelector(".home-hero-art"), stableArtwork);
    assert.equal(dom.window.document.querySelector('.home-hero-actions [data-navigate="dashboard"]'), stableHomeCta);
    patchDetectedHomeLives({ tiktok: "offline", kick: false });
    publishHomeFeed({ tiktok: false, kick: false });
    await waitUntil(() => liveSection.querySelectorAll(".home-live-card").length === 0, "La fin des présences publiques ne retire pas ses cartes.");
    assert.equal(liveSection.querySelector(".home-live-count > strong").textContent, "0");
    assert.equal(dom.window.document.querySelector(".home-hero"), stableHero);
    assert.equal(dom.window.document.querySelector(".home-hero-art"), stableArtwork);
    assert.deepEqual(operationalCalls, [], "Les sources détectées se rendent sans lancer ni arrêter un live ou un jeu");
    state.settings = { ...state.settings, tiktok: initialTikTok, kick: initialKick };
    state.connections = initialConnections;
    handlers.get("runtime-state-changed")({ state: { settings: state.settings, connections: state.connections } });
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(stableHome.querySelector('.home-game-card'), null, "La galerie de jeux est retirée de l’accueil");
    assert.ok(stableHome.querySelector('.home-feature[data-navigate="games"]'), "Le raccourci Jeux reste disponible sans galerie");
    const homeRoutes = [...stableHome.querySelectorAll("[data-navigate]")].map((button) => button.dataset.navigate);
    assert.deepEqual([...new Set(homeRoutes)].sort(), ["actions", "connections", "dashboard", "games", "music", "overlays", "users", "voice"]);
    for (const privatePage of ["admin", "controllers", "settings"]) {
      assert.equal(navigation.querySelector(`[data-navigate="${privatePage}"]`), null);
    }
    assert.equal(dom.window.document.querySelector('#account-menu [data-navigate="settings"]').hidden, true);
    for (const [index, route] of homeRoutes.entries()) {
      const button = dom.window.document.querySelectorAll(".creator-home-page [data-navigate]")[index];
      assert.equal(button.dataset.navigate, route);
      assert.equal(button.hasAttribute("data-action"), false, "Un raccourci d’accueil ne doit pas exécuter d’action");
      button.click();
      await waitUntil(() => navigation.querySelector(`.nav-item.active[data-navigate="${route}"]`), `Le raccourci Accueil ${route} ne navigue pas.`);
      assert.equal(dom.window.document.querySelector(".creator-home-page"), null);
      await new Promise((resolve) => setTimeout(resolve, 10));
      assert.deepEqual(operationalCalls, [], "Les raccourcis Accueil ne lancent ni live, ni aperçu d’action, ni jeu");
      assert.equal(errors.length, 0, errors.map((error) => error.stack || error.message).join("\n"));
      homeNavigation.click();
      await waitUntil(() => dom.window.document.querySelector(".creator-home-page"), "Le retour Accueil après un raccourci échoue.");
    }
    const homeDashboardButton = dom.window.document.querySelector('.creator-home-page [data-navigate="dashboard"]');
    assert.ok(homeDashboardButton, "L’accueil propose un accès direct au tableau de bord.");
    homeDashboardButton.click();
    await waitUntil(() => dom.window.document.querySelector("#simulator-form"), "Le bouton Accueil n’ouvre pas le dashboard.");
    assert.equal(dashboardNavigation.classList.contains("active"), true);
    homeNavigation.click();
    await waitUntil(() => dom.window.document.querySelector(".creator-home-page"), "Le retour à l’accueil échoue.");
    assert.equal(homeNavigation.classList.contains("active"), true);
    assert.equal(dom.window.document.querySelector("#simulator-form"), null,
      "l’accueil reste une page distincte du simulateur et des statistiques live");
    assert.equal(dom.window.document.querySelector('#navigation [data-navigate="studio"]'), null, "Studio Live a été retiré de la navigation.");
    for (const [id, selector] of [["games", ".games-gallery-page"], ["users", ".creator-users-page"], ["voice", ".creator-voice-page"], ["music", ".creator-music-page"], ["matches", ".creator-matches-page"]]) {
      const item = dom.window.document.querySelector(`#navigation [data-navigate="${id}"]`);
      assert.ok(item, `La navigation ${id} doit être visible.`);
      item.click();
      await waitUntil(() => dom.window.document.querySelector(selector), `La page ${id} n'est pas rendue.`);
    }
    const matchesHero = dom.window.document.querySelector('.creator-matches-page [data-studio-hero]');
    dom.window.document.querySelector('[data-action="matches-tab"][data-value="widgets"]').click();
    await waitUntil(() => dom.window.document.querySelector(".matches-widget-grid"), "L’onglet Widgets de Matchs ne s’ouvre pas.");
    assert.equal(dom.window.document.querySelectorAll(".matches-widget-card").length, 7);
    assert.equal(dom.window.document.querySelectorAll(".matches-animation-card").length, 8);
    assert.equal(dom.window.document.querySelector('.creator-matches-page [data-studio-hero]'), matchesHero);
    dom.window.document.querySelector('[data-action="matches-widget-edit"][data-id="wins"]').click();
    await waitUntil(() => dom.window.document.getElementById("editor-dialog").open, "L’éditeur du compteur de manches ne s’ouvre pas.");
    assert.equal(dom.window.document.querySelector('[name="switchSeconds"]').value, "6");
    assert.equal(dom.window.document.querySelector('[name="enabled"]').checked, false);
    dom.window.document.getElementById("editor-dialog").close();
    dom.window.document.querySelector('[data-action="matches-tab"][data-value="automations"]').click();
    await waitUntil(() => dom.window.document.querySelectorAll(".matches-automation-card").length === 10, "Les dix cartes Matchs, dont le groupe des bonus, ne sont pas rendues.");
    const animationControls = [...dom.window.document.querySelectorAll('[data-action="matches-automation-animation"]')];
    assert.equal(animationControls.length, 11, "Les onze moments conservent chacun leur réglage d’animation.");
    assert.deepEqual(animationControls.map((control) => control.dataset.moment).sort(),
      ["battleStart", "multiplierX2", "multiplierX3", "card", "lead", "comeback", "tieEnd", "likeRush", "snipe", "victory", "defeat"].sort());
    const bonusCard = dom.window.document.querySelector('[data-matches-moment-card="multiplier"]');
    assert.ok(bonusCard.querySelector('[data-action="matches-automation-animation"][data-moment="multiplierX2"]'));
    assert.ok(bonusCard.querySelector('[data-action="matches-automation-animation"][data-moment="multiplierX3"]'));
    dom.window.document.querySelector('[data-action="matches-automation-edit"][data-moment="card"]').click();
    await waitUntil(() => dom.window.document.getElementById("editor-dialog").open, "L’éditeur de carte de match ne s’ouvre pas.");
    assert.equal(dom.window.document.querySelector('[name="enabled"]').disabled, true);
    assert.equal(dom.window.document.querySelector('[name="matchAnimation"]').value, "guantes");
    dom.window.document.getElementById("editor-dialog").close();
    assert.deepEqual(operationalCalls, [], "Naviguer et configurer les Matchs ne lance aucun effet.");
    dom.window.document.querySelector('#navigation [data-navigate="voice"]').click();
    dom.window.document.querySelector('[data-action="creator-voice-tab"][data-value="sounds"]').click();
    await waitUntil(() => dom.window.document.querySelector('[data-action="add-sound"]'), "L'atelier de sons doit rester accessible.");
    dom.window.document.querySelector('#navigation [data-navigate="dashboard"]').click();
    await waitUntil(() => dom.window.document.querySelector("#simulator-form"), "Le dashboard n’est pas rendu après navigation explicite.");
    const username = dom.window.document.querySelector('#simulator-form [name="username"]');
    username.value = "alice_en_test";
    username.focus();
    handlers.get("runtime-state-changed")({ state: { statistics: { ...state.statistics, sessionEvents: 9 } } });
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(dom.window.document.querySelector('#simulator-form [name="username"]'), username);
    assert.equal(username.value, "alice_en_test");
    assert.equal(dom.window.document.activeElement, username);
    // Exercise the registered preference action and the settings API contract.
    username.value = "Musique";
    state.overlaySession = { ...state.overlaySession, leaderboards: { ...state.overlaySession.leaderboards, donors: [{ id: "musique", name: "Musique", score: 2 }] } };
    state.statistics.liveSession = { ...state.statistics.liveSession, hasData: true, participants: [{ id: "musique", name: "Musique", username: "musique", coins: 2, gifts: 2 }] };
    handlers.get("runtime-state-changed")({ state: { overlaySession: state.overlaySession, statistics: state.statistics } });
    await new Promise((resolve) => setTimeout(resolve, 40));
    dom.window.document.getElementById("studio-language").click();
    await waitUntil(() => dom.window.document.documentElement.lang === "en", "La langue anglaise n'est pas activée.");
    assert.equal(settingsRequests.at(-1).locale, "en-US");
    assert.equal(state.settings.locale, "en-US");
    assert.equal(dom.window.document.getElementById("content").getAttribute("aria-label"), "Dashboard");
    assert.equal(dom.window.document.querySelector(".workspace-heading, .page-heading"), null);
    assert.match(dom.window.document.getElementById("studio-light-mode").textContent, /Light mode/);
    assert.match(dom.window.document.getElementById("session-button").textContent, /Start live/);
    assert.ok(dom.window.document.querySelector('[data-studio-hero="dashboard"] .studio-hero-art'), "Le dashboard retrouve sa bannière photo, sans rétablir l'ancien en-tête de page.");
    assert.equal(dom.window.document.querySelector('#simulator-form [name="username"]'), username);
    assert.equal(username.value, "Musique");
    assert.equal(dom.window.document.querySelector(".dashboard-donor-name strong").textContent, "Musique");
    assert.equal(dom.window.document.querySelector('[name="giftName"]').placeholder, "Search TikTok gifts…");
    dom.window.document.querySelector('#navigation [data-navigate="home"]').click();
    assert.ok(dom.window.document.querySelector(".creator-home-page"));
    assert.equal(dom.window.document.getElementById("content").getAttribute("aria-label"), "Home");
    assert.match(dom.window.document.querySelector('#navigation [data-navigate="home"]').textContent, /Home/);
    const englishHomeButton = dom.window.document.querySelector('.creator-home-page [data-navigate="dashboard"]');
    assert.match(englishHomeButton.textContent, /dashboard/i);
    assert.doesNotMatch(englishHomeButton.textContent, /Ouvrir mon tableau de bord/);
    assert.doesNotMatch(dom.window.document.getElementById("home-heading").textContent, /Toute une communauté aux commandes/);
    dom.window.document.querySelector('#navigation [data-navigate="music"]').click();
    assert.equal(dom.window.document.querySelector(".music-banner h2").textContent, "Song Requests");
    assert.match(dom.window.document.querySelector(".music-tabs").textContent, /Player.*Queue.*Search.*My playlists.*Settings/s);
    for (const [id, title] of [["actions", "Actions & triggers"], ["voice", "A voice for your community."]]) {
      dom.window.document.querySelector(`#navigation [data-navigate="${id}"]`).click();
      assert.equal(dom.window.document.querySelector(`[data-studio-hero="${id}"] h2`).textContent, title, id);
    }
    dom.window.document.querySelector('[data-action="creator-voice-tab"][data-value="voice"]').click();
    await waitUntil(() => dom.window.document.querySelector('[data-action="add-tts"]'), "L'onglet de voix ne s'ouvre pas.");
    dom.window.document.querySelector('[data-action="add-tts"]').click();
    await waitUntil(() => dom.window.document.getElementById("editor-dialog").open, "L'éditeur TTS ne s'ouvre pas.");
    assert.equal(dom.window.document.getElementById("dialog-title").textContent, "Add a TTS rule");
    assert.match(dom.window.document.getElementById("dialog-body").textContent, /Who can be read aloud\?/);
    const blockedWords = dom.window.document.querySelector('[name="ttsBlockedWords"]');
    assert.equal(blockedWords.placeholder, "One phrase per line");
    blockedWords.value = "Musique\nModifier";
    dom.window.document.getElementById("editor-dialog").close();
    dom.window.document.querySelector('#navigation [data-navigate="users"]').click();
    assert.equal(dom.window.document.querySelector(".audience-database-heading h3").textContent, "User database");
    const search = dom.window.document.querySelector("[data-creator-user-search]");
    assert.equal(search.placeholder, "Search users…");
    search.value = "Musique";
    search.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    await waitUntil(() => dom.window.document.querySelector(".creator-user-identity strong")?.textContent === "Musique", "La recherche dans l'historique ne restitue pas le nom utilisateur.");
    assert.equal(dom.window.document.querySelector(".creator-user-identity strong").textContent, "Musique");
    dom.window.document.getElementById("studio-language").click();
    await waitUntil(() => dom.window.document.documentElement.lang === "fr", "Le retour au français a échoué.");
    assert.equal(settingsRequests.at(-1).locale, "fr-FR");
    assert.equal(search.placeholder, "Rechercher un utilisateur…");
    assert.equal(search.value, "Musique");
    assert.equal(dom.window.document.getElementById("content").getAttribute("aria-label"), "Utilisateurs & statistiques");
    assert.equal(dom.window.document.querySelector(".audience-database-heading h3").textContent, "Base de données Utilisateurs");
    dom.window.document.querySelector('#navigation [data-navigate="home"]').click();
    assert.equal(dom.window.document.getElementById("content").getAttribute("aria-label"), "Accueil");
    assert.match(dom.window.document.querySelector('#navigation [data-navigate="home"]').textContent, /Accueil/);
    assert.match(dom.window.document.querySelector('.home-hero-actions [data-navigate="dashboard"]').textContent, /Ouvrir mon tableau de bord/);
    assert.match(dom.window.document.getElementById("home-heading").textContent, /Toute une communauté aux commandes/);
    dom.window.document.getElementById("studio-light-mode").click();
    await waitUntil(() => dom.window.document.body.classList.contains("studio-light-mode"), "Le mode léger n'est pas activé.");
    assert.equal(dom.window.localStorage.getItem("shenpulse.light-mode"), "true");
    assert.equal(dom.window.document.getElementById("studio-light-mode").getAttribute("aria-pressed"), "true");
    dom.window.document.getElementById("studio-light-mode").click();
    await waitUntil(() => !dom.window.document.body.classList.contains("studio-light-mode"), "Le mode léger ne se désactive pas.");
    assert.equal(dom.window.localStorage.getItem("shenpulse.light-mode"), "false");
    assert.deepEqual(operationalCalls, [], "La navigation et les préférences restent sans effet sur le live et les jeux");
    assert.equal(errors.length, 0, errors.map((error) => error.stack || error.message).join("\n"));
    navigation.querySelector('[data-navigate="matches"]').click();
    assert.ok(dom.window.document.querySelector(".creator-matches-page"));
    assert.equal(dom.window.document.querySelectorAll(".matches-tabs button").length, 3);
    assert.equal(dom.window.document.querySelector('.studio-hero[data-studio-hero="matches"]') !== null, true);
    navigation.querySelector('[data-navigate="home"]').click();
    // Le même index et les vrais événements contrôlent les outils du tableau.
    // Aucun clic sur lecture, test, périphérique, Spotify ou exécution de règle.
    state.rules = [
      { id: "table_z", name: "Zèbre", enabled: true, priority: 50, trigger: { type: "follow" }, cooldown: { globalMs: 0 }, actions: [{ id: "table_delay", type: "delay", config: { durationMs: 1000 } }] },
      { id: "table_music", name: "Musique", enabled: true, priority: 50, trigger: { type: "chat" }, cooldown: { globalMs: 0 }, actions: [{ id: "table_spotify", type: "spotify.queue", config: { operation: "queue", query: "Titre choisi" } }] },
      { id: "table_a", name: "Alpha", enabled: false, priority: 50, trigger: { type: "follow" }, cooldown: { globalMs: 0 }, actions: [{ id: "table_delay_a", type: "delay", config: { durationMs: 3000 } }] }
    ];
    handlers.get("state-changed")(snapshot);
    navigation.querySelector('[data-navigate="actions"]').click();
    await waitUntil(() => dom.window.document.querySelector('[data-automation-table="actions"]'), "La table Actions ne s’ouvre pas.");
    const actionsTable = dom.window.document.querySelector('[data-automation-table="actions"]');
    const selectedRow = actionsTable.querySelector('[data-automation-row="table_z"]');
    const selection = selectedRow.querySelector("[data-automation-select]");
    selection.click();
    assert.equal(selection.checked, true);
    assert.equal(selectedRow.classList.contains("automation-row-selected"), true);
    assert.equal(actionsTable.querySelector("[data-automation-select-all]").indeterminate, true);
    actionsTable.querySelector('[data-automation-sort="name"]').click();
    assert.deepEqual([...actionsTable.tBodies[0].rows].map((row) => row.dataset.automationName), ["Alpha", "Musique", "Zèbre"]);
    assert.equal(actionsTable.tBodies[0].rows[2], selectedRow, "Le tri déplace les nœuds existants.");
    assert.equal(selection.checked, true);
    assert.equal(entityRequests.length, 0, "Sélection et tri ne modifient aucun profil.");
    assert.deepEqual(operationalCalls, [], "Les outils visuels ne déclenchent aucune action.");
    const status = selectedRow.querySelector('[data-action="toggle-rule"]');
    const statusLabel = status.closest(".automation-status-toggle");
    assert.equal(statusLabel.matches(":has(input:checked)"), true);
    status.click();
    await waitUntil(() => entityRequests.length === 1 && statusLabel.querySelector("small").textContent === "Inactif", "Le statut du tableau n’est pas actualisé en place.");
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(entityRequests.length, 1, "Un clic checkbox crée une seule écriture, pas une écriture click puis change.");
    assert.equal(entityRequests[0].item.id, "table_z");
    assert.equal(entityRequests[0].item.enabled, false);
    assert.equal(status.checked, false);
    assert.equal(statusLabel.matches(":has(input:checked)"), false, "L’état CSS repose sur la vraie checkbox actualisée.");
    assert.equal(dom.window.document.querySelector('[data-automation-table="actions"]'), actionsTable);
    assert.equal(selectedRow.querySelector("[data-automation-select]"), selection);
    assert.equal(selection.checked, true, "La modification de statut conserve le tri et la sélection visuelle.");
    actionsTable.querySelector("[data-automation-select-all]").click();
    assert.equal(actionsTable.querySelectorAll("[data-automation-select]:checked").length, 3);
    assert.equal(entityRequests.length, 1, "Même la sélection globale ne modifie aucun statut.");
    dom.window.document.querySelector('[data-action="set-actions-section"][data-value="advanced"]').click();
    await waitUntil(() => dom.window.document.querySelector('[data-automation-table="advanced-rules"]'), "La table des automatisations avancées ne s’ouvre pas.");
    const advancedTable = dom.window.document.querySelector('[data-automation-table="advanced-rules"]');
    assert.ok(advancedTable, "Les automatisations avancées réutilisent le même composant.");
    assert.equal(advancedTable.querySelectorAll("thead th").length, 7);
    for (const action of ["run-rule", "edit-rule", "delete-entity", "toggle-rule"]) {
      assert.equal(advancedTable.querySelector(`[data-action="${action}"]`).dataset.id, "table_z");
    }
    advancedTable.querySelector('[data-automation-sort="name"]').click();
    assert.deepEqual([...advancedTable.tBodies[0].rows].map((row) => row.dataset.automationName), ["Alpha", "Musique", "Zèbre"]);
    assert.equal(entityRequests.length, 1);
    navigation.querySelector('[data-navigate="music"]').click();
    await waitUntil(() => dom.window.document.querySelector('[data-automation-table="music-rules"]'), "Les règles Spotify n’utilisent pas le tableau partagé.");
    const musicTable = dom.window.document.querySelector('[data-automation-table="music-rules"]');
    assert.equal(musicTable.querySelectorAll("thead th").length, 7);
    assert.equal(musicTable.querySelector('[data-action="toggle-rule"]').dataset.id, "table_music");
    for (const action of ["test-action", "edit-action"]) {
      const button = musicTable.querySelector(`[data-action="${action}"]`);
      assert.equal(button.dataset.rule, "table_music");
      assert.equal(button.dataset.id, "table_spotify");
      assert.equal(button.dataset.index, "0");
    }
    musicTable.querySelector("[data-automation-select-all]").click();
    musicTable.querySelector('[data-automation-sort="status"]').click();
    assert.equal(entityRequests.length, 1);
    assert.deepEqual(operationalCalls, [], "Règles avancées et Spotify restent consultées sans exécuter leurs effets.");
    assert.equal(errors.length, 0, errors.map((error) => error.stack || error.message).join("\n"));
    navigation.querySelector('[data-navigate="home"]').click();
    // Même index et vrais gestionnaires : Free voit les badges, jamais le contenu Pro.
    state.commerce.subscription = { tier: "free", status: "free", source: "free" };
    handlers.get("state-changed")(snapshot);
    await waitUntil(() => navigation.querySelectorAll(".nav-item.is-pro-locked").length === expectedProEntries.length,
      "Les rubriques Pro doivent se verrouiller après la fin de l'accès.");
    assert.equal(dom.window.eval("canNavigateTo('commands')"), false);
    assert.equal(dom.window.eval("canNavigateTo('games')"), false);
    assert.equal(dom.window.eval("canNavigateTo('irl')"), false);
    assert.equal(dom.window.eval("canNavigateTo('matches')"), false);
    navigation.querySelector('[data-navigate="commands"]').click();
    await waitUntil(() => dom.window.document.querySelector(".membership-popup-dialog[open]"),
      "Un clic Free sur Commandes doit ouvrir les offres, pas la page.");
    assert.ok(dom.window.document.querySelector(".creator-home-page"));
    assert.equal(dom.window.document.querySelector(".creator-chatbot-page"), null);
    dom.window.document.querySelector("[data-membership-close]").click();
    navigation.querySelector('[data-navigate="matches"]').click();
    await waitUntil(() => dom.window.document.querySelector(".membership-popup-dialog[open]"),
      "Un clic Free sur Matchs doit ouvrir uniquement les offres.");
    assert.equal(dom.window.document.querySelector(".creator-matches-page"), null);
    assert.deepEqual(operationalCalls, [], "Le badge Pro ne déclenche ni effet ni achat.");
    assert.equal(errors.length, 0, errors.map((error) => error.stack || error.message).join("\n"));
  } finally { dom.window.close(); }
});

test("les métadonnées du menu ancrent les badges Pro de largeur fixe à droite", (t) => {
  const styles = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "styles", "foundation-shell.css"), "utf8");
  // JSDOM ne mesure pas la géométrie ; cette fixture applique le vrai module CSS
  // directement pour vérifier les propriétés d’alignement sans importer une app.
  const dom = new JSDOM(`<style>${styles}</style><nav>${["games", "irl", "commands", "matches"].map((id, index) => `<button class="nav-item"><span class="nav-icon"></span><span class="nav-label">${id}</span><span class="nav-meta">${index ? '<span class="nav-count">49</span>' : ""}<span class="nav-pro-badge">PRO</span></span></button>`).join("")}</nav>`);
  t.after(() => dom.window.close());
  for (const metadata of dom.window.document.querySelectorAll(".nav-meta")) {
    const metadataStyle = dom.window.getComputedStyle(metadata);
    const badgeStyle = dom.window.getComputedStyle(metadata.lastElementChild);
    assert.equal(metadataStyle.justifySelf, "end");
    assert.equal(metadataStyle.justifyContent, "flex-end");
    assert.equal(badgeStyle.width, "32px");
    assert.equal(badgeStyle.flexBasis, "32px");
    assert.equal(badgeStyle.boxSizing, "border-box");
    assert.equal(badgeStyle.textAlign, "center");
  }
});
