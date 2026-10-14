"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const { createDefaultState } = require("../src/main/defaults");

const sourceRoot = path.join(__dirname, "..", "src");
const publicMatchSource = "https://shenpulse-overlays.web.app/m/123456789012/fixture-match-channel-1234567890";
function context(t) {
  const dom = new JSDOM('<main id="content"></main><dialog><form></form></dialog>', { runScripts: "outside-only", url: "https://shenpulse.example.test" });
  t.after(() => dom.window.close());
  const window = dom.window, state = createDefaultState();
  const account = { uid: "match-user", authenticated: true };
  const calls = [], snapshots = [], mediaFields = [];
  state.settings.account.uid = account.uid;
  state.session.profileId = "match-profile";
  state.commerce.subscription = { tier: "pro", status: "active", source: "own" };
  window.snapshot = { state, localOverlayUrls: { matchPlayer: "http://127.0.0.1/match?token=fixture", matchesWins: "http://127.0.0.1/wins?token=fixture" }, overlayUrls: { matchPlayer: publicMatchSource, matchesWins: `${publicMatchSource}?widget=wins` } };
  window.content = window.document.getElementById("content");
  window.dialog = window.document.querySelector("dialog");
  window.dialogForm = window.dialog.querySelector("form");
  window.currentPage = "matches";
  window.visibleAccountSession = () => account;
  window.isAccountAuthenticated = () => account.authenticated;
  window.hasProAccess = () => window.ShenPulseProAccess.hasProAccess(window.snapshot.state);
  window.canNavigateTo = (id) => id === "matches" && account.authenticated && window.hasProAccess();
  window.escapeHtml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  window.renderStudioHero = (id, title, description) => `<header data-studio-hero="${id}"><h2>${title}</h2><p>${description}</p></header>`;
  window.renderPrivateDataPlaceholder = (_title, description) => `<p class="private-placeholder">${description}</p>`;
  window.field = (...args) => window.inputFieldMarkup(...args);
  window.cryptoId = () => "fixture-new";
  window.creatorCommandActionRows = () => [{ rule: { name: "Ballon" }, action: { id: "action-balloon", type: "irl.shelly" } }];
  window.actionTypeLabel = (type) => type;
  window.MATCH_OVERLAYS = [["matchX2", "Match x2", "x2"], ["matchX3", "Match x3", "x3"], ["matchGants", "Match Gants", "guantes"], ["matchCoffre", "Match Coffre", "cofre"], ["matchSnipe", "Match Snipe", "snipe"], ["matchTapTap", "Match TapTap", "taptap"], ["matchQuiereme", "Match Cœur du jour", "quiereme"], ["matchEnigma", "Match Enigma", "enigma"]];
  window.overlayDefinitions = () => window.MATCH_OVERLAYS.map(([key, name, match]) => ({ key, name, match }));
  window.canAccessOverlay = () => true;
  window.overlayConfig = () => ({ variant: "tikcontrol" });
  window.overlayPlaceholderMatch = (item) => `<span data-poster="${item.match}"></span>`;
  window.soundPickerField = (name, value) => { mediaFields.push({ kind: "sound", name }); return `<input type="hidden" name="${name}" value="${window.escapeHtml(value)}">`; };
  window.mediaPickerField = (name, _label, value) => { mediaFields.push({ kind: "visual", name }); return `<input type="hidden" name="${name}" value="${window.escapeHtml(value)}">`; };
  window.openEditor = (options) => { window.editor = options; window.dialogForm.innerHTML = options.body; };
  window.perform = async (work) => work();
  window.toast = () => {};
  window.confirmAction = async () => true;
  window.render = () => { window.content.innerHTML = window.renderCreatorMatches(); };
  window.acceptSnapshot = (snapshot) => { snapshots.push(snapshot); window.snapshot = snapshot; };
  window.registerActionHandler = (_actions, handler) => { window.matchesHandler = handler; };
  window.ACTION_NOT_HANDLED = Symbol("not handled");
  window.api = { copy: async (value) => calls.push({ method: "copy", value }), matches: Object.fromEntries([
    "saveConfig", "saveAutomation", "removeAutomation", "testAutomation", "testWidget", "resetWins", "resetContributors", "adjustWins"
  ].map((method) => [method, async (...args) => { calls.push({ method, args }); return { snapshot: window.snapshot }; }])) };
  window.api.matches.status = async () => { calls.push({ method: "status" }); return { config: state.settings.matches, runtime: state.matchSession }; };
  const run = (code) => vm.runInContext(code, dom.getInternalVMContext());
  run(fs.readFileSync(path.join(sourceRoot, "../resources/overlays/catalog/matches.js"), "utf8"));
  for (const file of ["shared/pro-access.js", "shared/matches-contract.js", "renderer/app/core/components.js", "renderer/app/core/account-operation-guard.js", "renderer/app/features/creator-matches.js", "renderer/app/features/matches/reactions.js", "renderer/app/features/matches/editor.js", "renderer/app/features/matches/widgets.js", "renderer/app/actions/handlers/creator-matches.js"]) run(fs.readFileSync(path.join(sourceRoot, file), "utf8"));
  state.settings.matches = window.ShenPulseMatches.normalizeMatchesConfig({});
  state.matchSession = window.ShenPulseMatches.createMatchSession();
  const click = async (action, target = {}) => window.matchesHandler({ action, id: target.id, target: { dataset: { ...target }, disabled: false, ...target } });
  return { window, state, account, calls, snapshots, mediaFields, run, click };
}

test("Matchs possède trois onglets et rend les deux panneaux réels sans réseau ni effet", (t) => {
  const { window, calls } = context(t);
  window.render();
  const page = window.content;
  assert.equal(page.querySelectorAll(".matches-tab").length, 3);
  assert.equal(page.querySelectorAll(".matches-dashboard-grid > section").length, 2);
  assert.match(page.querySelector(".matches-current").textContent, /Le match en direct.*Connectez votre LIVE/s);
  assert.match(page.querySelector(".matches-donors").textContent, /Donateurs du LIVE/);
  assert.equal(page.querySelector(".matches-participant"), null);
  assert.match(page.querySelector(".matches-capability-note").textContent, /pas détectées automatiquement/);
  assert.deepEqual(calls, []);
});

test("l’aide distingue un LIVE TikTok réellement connecté d’une session ou d’un relais générique", (t) => {
  const { window, state, calls } = context(t);
  state.session.running = true;
  state.settings.tiktok.status = "live";
  const source = { id: "source_tiktok", type: "tiktok-direct", enabled: true, status: "connected" };
  state.connections = [source];
  for (const type of ["tiktok-direct", "tiktok-relay"]) {
    source.type = type;
    window.render();
    assert.equal(window.content.querySelector(".matches-empty h4").textContent, "En attente d’un match TikTok");
    assert.match(window.content.querySelector("[data-matches-detection-label]").textContent, /Détection automatique active/);
    assert.match(window.content.querySelector("[data-matches-detection-detail]").textContent, /cours de match attend le prochain événement reçu/);
    assert.match(window.content.querySelector(".matches-live-note").textContent, /aucune automatisation activée.*effets restent désactivés/s);
  }
  for (const change of [
    () => { source.type = "websocket"; },
    () => { source.id = "source_secondary"; },
    () => { source.enabled = false; },
    () => { source.status = "connecting"; },
    () => { source.liveStatus = "offline"; },
    () => { state.session.running = false; },
    () => { state.settings.tiktok.status = "offline"; }
  ]) {
    Object.assign(source, { id: "source_tiktok", type: "tiktok-direct", enabled: true, status: "connected", liveStatus: "live" });
    state.session.running = true;
    state.settings.tiktok.status = "live";
    change();
    window.render();
    assert.equal(window.content.querySelector(".matches-empty h4").textContent, "Connectez votre LIVE TikTok");
    assert.match(window.content.querySelector("[data-matches-detection-label]").textContent, /LIVE TikTok déconnecté/);
  }
  assert.equal(state.settings.matches.automations.some((item) => item.enabled), false);
  assert.deepEqual(calls, []);
});

test("la connexion seule actualise l’aide sans recréer les onglets puis conserve le dernier résultat hors ligne", (t) => {
  const { window, state, calls } = context(t);
  window.render();
  window.syncCreatorMatchesRuntime();
  const hero = window.content.querySelector("[data-studio-hero]");
  const tabs = window.content.querySelector(".matches-tabs");
  const current = window.content.querySelector(".matches-current");
  const control = current.querySelector('[data-action="matches-correct-wins"]');
  const hint = current.querySelector("[data-matches-detection-label]");
  state.session.running = true;
  state.settings.tiktok.status = "live";
  state.connections = [{ id: "source_tiktok", type: "tiktok-direct", enabled: true, status: "connected" }];
  assert.equal(window.syncCreatorMatchesRuntime(), true);
  assert.equal(current.querySelector("[data-matches-detection-label]"), hint);
  assert.equal(current.querySelector('[data-action="matches-correct-wins"]'), control);
  assert.match(hint.textContent, /Détection automatique active/);
  assert.equal(current.querySelector(".matches-empty h4").textContent, "En attente d’un match TikTok");
  Object.assign(state.matchSession, { status: "running", battleId: "received-battle", participants: [{ id: "own", own: true, username: "creator", avatarUrl: "https://example.test/creator.png", score: 123 }] });
  window.syncCreatorMatchesRuntime();
  assert.equal(current.querySelector("[data-matches-detection-label]").textContent, "Match détecté automatiquement");
  const avatar = current.querySelector(".matches-avatar img");
  Object.assign(state.matchSession, { status: "finished", result: "win" });
  state.session.running = false;
  state.settings.tiktok.status = "disconnected";
  state.connections[0].status = "disconnected";
  window.syncCreatorMatchesRuntime();
  assert.equal(current.querySelector("[data-matches-detection-label]").textContent, "Match terminé");
  assert.equal(current.querySelector(".matches-state").textContent, "Victoire");
  assert.equal(current.querySelector(".matches-avatar img"), avatar);
  assert.match(current.querySelector("[data-matches-detection-detail]").textContent, /dernier match reçu reste consultable/);
  assert.equal(window.content.querySelector("[data-studio-hero]"), hero);
  assert.equal(window.content.querySelector(".matches-tabs"), tabs);
  // Seul le passage sans participants -> participants remplace l’intérieur.
  assert.notEqual(current.querySelector('[data-action="matches-correct-wins"]'), control);
  assert.deepEqual(calls, []);
});

test("les scores et likes actualisent les nœuds sans reconstruire bannière, photos ou contrôles", (t) => {
  const { window, state } = context(t);
  Object.assign(state.matchSession, { status: "running", participants: [{ id: "own", own: true, username: "creator", displayName: "Créateur", avatarUrl: "https://example.test/own.png", score: 500 }, { id: "opponent", username: "other", score: 450 }], liveContributors: [{ id: "fan", username: "fan", avatarUrl: "https://example.test/fan.png", likes: 10, gifts: 1, diamonds: 1 }] });
  window.render();
  const hero = window.content.querySelector("[data-studio-hero]");
  const own = window.content.querySelector('[data-matches-person="own"]');
  const avatar = own.querySelector("img");
  const donor = window.content.querySelector('[data-matches-donor="fan"]');
  const donorAvatar = donor.querySelector("img");
  const correct = window.content.querySelector('[data-action="matches-correct-wins"]');
  state.matchSession.participants[0].score = 700;
  state.matchSession.liveContributors[0].likes = 25;
  assert.equal(window.syncCreatorMatchesRuntime(), true);
  assert.equal(window.content.querySelector("[data-studio-hero]"), hero);
  assert.equal(window.content.querySelector('[data-matches-person="own"]'), own);
  assert.equal(own.querySelector("img"), avatar);
  assert.equal(window.content.querySelector('[data-matches-donor="fan"]'), donor);
  assert.equal(donor.querySelector("img"), donorAvatar);
  assert.equal(window.content.querySelector('[data-action="matches-correct-wins"]'), correct);
  assert.equal(own.querySelector(".matches-score").textContent, "700");
  assert.equal(donor.querySelector(".matches-donor-likes").textContent, "25 likes");
});

test("Widgets présente les six widgets de parité, le scoreboard bonus et huit configurations d’animations", async (t) => {
  const { window, click, calls } = context(t);
  window.render();
  await click("matches-tab", { value: "widgets" });
  assert.equal(window.content.querySelectorAll(".matches-widget-card").length, 7);
  assert.equal(window.content.querySelectorAll(".matches-animation-card").length, 8);
  assert.equal(window.content.querySelectorAll('[data-action="configure-overlay"]:not(:disabled)').length, 8);
  assert.equal(window.content.querySelector('[data-action="matches-widget-copy"][data-id="starDonor"]').disabled, true);
  assert.equal(window.content.querySelector('[data-action="matches-widget-copy"][data-id="wins"]').disabled, false);
  assert.equal(window.content.querySelector("iframe, video, audio"), null);
  assert.deepEqual(calls, []);
  await click("matches-widget-copy", { id: "wins" });
  assert.equal(calls[0].method, "copy");
  assert.equal(calls[0].value, `${publicMatchSource}?widget=wins`);
  await assert.rejects(click("matches-widget-test", { id: "starDonor" }), /pas disponible/);
});

test("les données des widgets changent en place et un classement réordonné conserve les avatars et contrôles", async (t) => {
  const { window, state, click, calls } = context(t);
  const fan = { id: "fan", username: "fan", avatarUrl: "https://example.test/fan.png", diamonds: 10, likes: 20 };
  Object.assign(state.matchSession, { status: "running", rounds: { own: 2, opponent: 1 },
    participants: [{ id: "own", own: true, username: "creator", score: 500 }],
    lastContribution: { user: fan }, liveContributors: [fan, { id: "other", username: "other", diamonds: 1, likes: 1 }] });
  window.render();
  await click("matches-tab", { value: "widgets" });
  const hero = window.content.querySelector("[data-studio-hero]"), tabs = window.content.querySelector(".matches-tabs");
  const poster = window.content.querySelector(".matches-animation-poster");
  const wins = window.content.querySelector('[data-matches-widget-preview="wins"]');
  const donors = window.content.querySelector('[data-matches-widget-preview="donors"]');
  const row = donors.querySelector('[data-matches-preview-person="fan"]'), image = row.querySelector("img");
  const starImage = window.content.querySelector('[data-matches-widget-preview="starDonor"] img');
  const controls = [...window.content.querySelectorAll(".matches-widget-card button")];
  controls[0].focus();
  state.matchSession = { ...state.matchSession, rounds: { own: 4, opponent: 1 },
    participants: [{ ...state.matchSession.participants[0], score: 750 }],
    liveContributors: [{ ...fan, diamonds: 12, likes: 35 }, { id: "other", username: "other", diamonds: 100, likes: 1 }] };
  assert.equal(window.syncCreatorMatchesRuntime(), true);
  assert.equal(wins.querySelector(".matches-widget-value").textContent, "4");
  assert.equal(window.content.querySelector('[data-matches-widget-preview="scoreboard"] b').textContent, "750");
  assert.equal(donors.querySelector('[data-matches-preview-person="fan"]'), row);
  assert.equal(row.querySelector("img"), image);
  assert.match(row.textContent, /12.*35 likes/s);
  assert.equal(donors.querySelector(".matches-widget-score").dataset.matchesPreviewPerson, "other");
  assert.equal(window.content.querySelector('[data-matches-widget-preview="starDonor"] img'), starImage);
  assert.equal(window.content.querySelector("[data-studio-hero]"), hero);
  assert.equal(window.content.querySelector(".matches-tabs"), tabs);
  assert.equal(window.content.querySelector(".matches-animation-poster"), poster);
  assert.deepEqual([...window.content.querySelectorAll(".matches-widget-card button")], controls);
  assert.equal(window.document.activeElement, controls[0]);
  assert.equal(window.content.querySelector("iframe, video, audio"), null);
  assert.deepEqual(calls, []);
});

test("une rafale de scores ne referme ni ne recrée un sélecteur d’automatisation inchangé", async (t) => {
  const { window, state, click, calls } = context(t);
  window.render();
  await click("matches-tab", { value: "automations" });
  const select = window.content.querySelector('[data-action="matches-automation-animation"]');
  const card = select.closest(".matches-automation-card");
  select.value = "snipe:gladiador";
  select.focus();
  for (let index = 0; index < 25; index++) {
    state.matchSession = { ...state.matchSession, lastEventAtMs: index + 1, participants: [{ id: "own", own: true, score: index }] };
    assert.equal(window.syncCreatorMatchesRuntime(), true);
  }
  assert.equal(window.content.querySelector('[data-action="matches-automation-animation"]'), select);
  assert.equal(select.closest(".matches-automation-card"), card);
  assert.equal(select.value, "snipe:gladiador");
  assert.equal(window.document.activeElement, select);
  assert.deepEqual(calls, []);
});

test("un changement de profil élimine les anciens aperçus de match sans republier de données étrangères", async (t) => {
  const { window, state, click, calls } = context(t);
  state.matchSession.scope = { uid: "match-user", profileId: "match-profile" };
  state.matchSession.rounds = { own: 17, opponent: 1 };
  state.matchSession.liveContributors = [{ id: "private-fan", username: "ancien-profil", avatarUrl: "https://example.test/old-profile.png", diamonds: 999, likes: 50 }];
  window.render();
  await click("matches-tab", { value: "widgets" });
  assert.match(window.content.querySelector('[data-matches-widget-preview="donors"]').textContent, /ancien-profil/);
  state.session.profileId = "new-profile";
  window.syncCreatorMatchesRuntime();
  assert.equal(window.content.querySelector('[data-matches-widget-preview="donors"] img'), null);
  assert.doesNotMatch(window.content.querySelector('[data-matches-widget-preview="donors"]').textContent, /ancien-profil|999/);
  assert.equal(window.content.querySelector('[data-matches-widget-preview="wins"] .matches-widget-value').textContent, "0");
  assert.deepEqual(calls, []);
});

test("toutes les sources Matchs copiées utilisent le canal HTTPS dédié, jamais les URL locales", async (t) => {
  const { window, click, calls } = context(t);
  const entries = [
    ["wins", "matchesWins"], ["starDonor", "matchesStarDonor"], ["topDonor", "matchesTopDonor"],
    ["donors", "matchesDonors"], ["timer", "matchesTimer"], ["victory", "matchesVictory"], ["scoreboard", "matchesScoreboard"]
  ];
  for (const [key, urlKey] of entries) {
    window.snapshot.overlayUrls[urlKey] = `${publicMatchSource}?widget=${key}`;
    window.snapshot.localOverlayUrls[urlKey] = `http://127.0.0.1/overlay?view=match-widget&widget=${key}&token=fixture`;
    await click("matches-widget-copy", { id: key });
    assert.equal(calls.at(-1).value, window.snapshot.overlayUrls[urlKey]);
  }
  await click("matches-player-copy");
  assert.equal(calls.at(-1).value, publicMatchSource);
  assert.equal(calls.length, 8);
  assert.ok(calls.every((entry) => entry.method === "copy" && entry.value.startsWith("https://shenpulse-overlays.web.app/m/")));
});

test("une source publique absente ou invalide ne bascule pas vers 127.0.0.1 et reste verrouillée sans Pro", async (t) => {
  const { window, state, account, click, calls } = context(t);
  for (const value of [
    "", "http://127.0.0.1/overlay?token=fixture", "https://127.0.0.1/m/123456789012/fixture-match-channel-1234567890",
    "https://localhost/m/123456789012/fixture-match-channel-1234567890", "javascript:alert(1)",
    `${publicMatchSource}?token=local`, `${publicMatchSource}?channel=generic`, `${publicMatchSource}?widget=timer`,
    `${publicMatchSource}?widget=wins&widget=wins`, publicMatchSource,
    `https://user:secret@shenpulse-overlays.web.app/m/123456789012/fixture-match-channel-1234567890`
  ]) {
    window.snapshot.overlayUrls.matchesWins = value;
    assert.equal(window.creatorMatchesWidgetUrl({ key: "wins", urlKey: "matchesWins" }), "");
    await assert.rejects(click("matches-widget-copy", { id: "wins" }), /source HTTPS.*pas disponible/);
  }
  window.snapshot.overlayUrls.matchesWins = `${publicMatchSource}?widget=wins`;
  window.snapshot.overlayUrls.matchPlayer = `${publicMatchSource}?widget=wins`;
  await assert.rejects(click("matches-player-copy"), /source HTTPS.*pas disponible/);
  window.snapshot.overlayUrls.matchPlayer = "";
  await assert.rejects(click("matches-player-copy"), /source HTTPS.*pas disponible/);
  state.commerce.subscription = { tier: "free", status: "free" };
  assert.equal(window.creatorMatchesWidgetUrl({ urlKey: "matchesWins" }), "");
  await assert.rejects(click("matches-widget-copy", { id: "wins" }), /Pro ou Premium/);
  state.commerce.subscription = { tier: "pro", status: "active", source: "own" };
  account.authenticated = false;
  assert.equal(window.creatorMatchesWidgetUrl({ urlKey: "matchesWins" }), "");
  assert.deepEqual(calls, []);
});

test("le bouton Studio copie uniquement une entrée HTTPS locale explicite sans modifier les widgets", async (t) => {
  const { window, click, calls, state } = context(t);
  await click("matches-player-copy", { transport: "local" });
  assert.equal(calls.at(-1).value, `${publicMatchSource}?transport=local`);
  assert.equal(window.creatorMatchesWidgetUrl({ key: "wins", urlKey: "matchesWins" }), `${publicMatchSource}?widget=wins`);
  await assert.rejects(click("matches-player-copy", { transport: "unknown" }), /Transport Match inconnu/);
  window.render();
  await click("matches-tab", { value: "widgets" });
  assert.match(window.content.querySelector('[data-transport="local"]').textContent, /TikTok Studio/);
  assert.match(window.content.querySelector(".matches-player-source").textContent, /vraies vidéos.*sans hébergement/);
  state.commerce.subscription = { tier: "free", status: "free" };
  assert.equal(window.creatorMatchesStudioSourceUrl(), "");
});

test("les boutons des widgets suivent l’arrivée ou le retrait des liens publics sans changement de configuration", async (t) => {
  const { window, click, calls } = context(t);
  window.snapshot.overlayUrls = {};
  window.render();
  await click("matches-tab", { value: "widgets" });
  assert.equal(window.content.querySelector('[data-action="matches-widget-copy"][data-id="wins"]').disabled, true);
  assert.equal(window.content.querySelector('[data-action="matches-player-copy"]').disabled, true);
  assert.match(window.content.querySelector(".matches-source-warning").textContent, /Aucun lien local/);
  const hero = window.content.querySelector("[data-studio-hero]");
  const tabs = window.content.querySelector(".matches-tabs");
  window.snapshot.overlayUrls = { matchPlayer: publicMatchSource, matchesWins: `${publicMatchSource}?widget=wins` };
  assert.equal(window.syncCreatorMatchesRuntime(), true);
  assert.equal(window.content.querySelector('[data-action="matches-widget-copy"][data-id="wins"]').disabled, false);
  assert.equal(window.content.querySelector('[data-action="matches-player-copy"]').disabled, false);
  assert.equal(window.content.querySelector("[data-studio-hero]"), hero);
  assert.equal(window.content.querySelector(".matches-tabs"), tabs);
  window.snapshot.overlayUrls = {};
  window.syncCreatorMatchesRuntime();
  assert.equal(window.content.querySelector('[data-action="matches-widget-copy"][data-id="wins"]').disabled, true);
  assert.equal(window.content.querySelector('[data-action="matches-player-copy"]').disabled, true);
  assert.deepEqual(calls, []);
});

test("les vrais posters Matchs restent confinés à leur carte et ne capturent aucun clic", async (t) => {
  const { window, run, click, calls } = context(t);
  // Le stub de poster des tests fonctionnels ne reproduit pas sa position absolue.
  window.overlayCatalogPreviewUrl = () => "http://127.0.0.1/overlay?token=fixture";
  run(fs.readFileSync(path.join(sourceRoot, "renderer/app/features/overlays/placeholders.js"), "utf8"));
  for (const file of ["creator-overlays.css", "overlay-placeholders.css", "creator-matches.css"]) {
    const style = window.document.createElement("style");
    style.textContent = fs.readFileSync(path.join(sourceRoot, "renderer/styles", file), "utf8");
    window.document.head.append(style);
  }
  window.render();
  assert.equal(window.content.querySelector(".overlay-placeholder-match-poster"), null);
  await click("matches-tab", { value: "widgets" });
  const posters = [...window.content.querySelectorAll(".overlay-placeholder-match-poster")];
  assert.equal(posters.length, 8);
  for (const poster of posters) {
    const frame = poster.closest(".matches-animation-poster");
    const preview = poster.parentElement;
    const frameStyle = window.getComputedStyle(frame);
    const previewStyle = window.getComputedStyle(preview);
    const posterStyle = window.getComputedStyle(poster);
    assert.equal(frameStyle.position, "relative");
    assert.equal(frameStyle.height, "130px");
    assert.equal(frameStyle.overflow, "hidden");
    assert.equal(frameStyle.isolation, "isolate");
    assert.equal(frameStyle.contain, "layout paint");
    assert.equal(frameStyle.pointerEvents, "none");
    assert.equal(previewStyle.position, "relative");
    assert.equal(previewStyle.width, "100%");
    assert.equal(previewStyle.height, "100%");
    assert.equal(posterStyle.position, "absolute");
    assert.equal(posterStyle.objectFit, "contain");
    assert.equal(posterStyle.pointerEvents, "none");
    const file = new URL(poster.src).pathname.split("/video/posters/")[1];
    assert.ok(file && fs.existsSync(path.join(sourceRoot, "..", "resources/overlays/media/video/posters", file)));
    assert.ok(frame.closest(".matches-animation-card").querySelector('[data-action="configure-overlay"]'));
  }
  assert.equal(window.content.querySelector("iframe, video, audio"), null);
  await click("matches-tab", { value: "automations" });
  assert.equal(window.content.querySelector(".overlay-placeholder-match-poster"), null);
  await click("matches-tab", { value: "dashboard" });
  assert.equal(window.content.querySelector(".matches-animation-poster"), null);
  assert.deepEqual(calls, []);
});

test("un score inconnu reste distinct de zéro et les manches ne sont pas plafonnées à onze", async (t) => {
  const { window, state, click } = context(t);
  state.matchSession.participants = [{ id: "own", own: true, username: "creator", score: null }, { id: "other", username: "other", score: 0 }];
  state.matchSession.rounds = { own: 23, opponent: 12 };
  window.render();
  assert.equal(window.content.querySelector('[data-matches-person="own"] .matches-score').textContent, "—");
  assert.equal(window.content.querySelector('[data-matches-person="other"] .matches-score').textContent, "0");
  assert.match(window.content.querySelector("[data-matches-rounds]").textContent, /23.*12/);
  assert.equal(window.content.querySelector(".matches-rounds-track"), null);
  state.matchSession.participants[0].score = 5;
  window.syncCreatorMatchesRuntime();
  assert.equal(window.content.querySelector('[data-matches-person="own"] .matches-score').textContent, "5");
  state.matchSession.participants[0].score = null;
  await click("matches-tab", { value: "widgets" });
  const scoreboard = [...window.content.querySelectorAll(".matches-widget-card")].find((card) => card.querySelector('[data-action="matches-widget-edit"]')?.dataset.id === "scoreboard");
  assert.equal(scoreboard.querySelector(".matches-widget-score b").textContent, "—");
});

test("les onze moments sont OFF au départ et les cartes unsupported ne peuvent s’armer", async (t) => {
  const { window, state, click, calls } = context(t);
  window.render();
  await click("matches-tab", { value: "automations" });
  assert.equal(window.content.querySelectorAll(".matches-automation-card").length, 10);
  assert.equal(window.content.querySelectorAll('[data-action="matches-automation-toggle"]:checked').length, 0);
  assert.match(window.content.textContent, /Détection automatique indisponible/);
  state.settings.matches.automations = [window.ShenPulseMatches.normalizeMatchAutomation({ ...window.creatorMatchesAutomationDefault("card"), id: "card-test" })];
  window.syncCreatorMatchesRuntime();
  assert.equal(window.content.querySelector('[data-action="matches-automation-toggle"]').disabled, true);
  await assert.rejects(click("matches-automation-toggle", { id: "card-test", checked: true }), /détection automatique.*indisponible/i);
  assert.deepEqual(calls, []);
});

test("les temps forts suivent la grille de référence sans changer les onze moments ni déclencher un effet", async (t) => {
  const { window, calls, click } = context(t);
  window.render();
  await click("matches-tab", { value: "automations" });
  assert.equal(window.content.querySelectorAll(".matches-automation-section").length, 2);
  assert.equal(window.content.querySelectorAll('[data-matches-moment-card="multiplier"]').length, 1);
  assert.equal(window.content.querySelectorAll('[data-action="matches-automation-animation"]').length, 11);
  assert.equal(window.content.querySelectorAll('[data-action="matches-automation-output"]').length, 18);
  assert.equal(window.content.querySelectorAll('[data-action="matches-automation-group-output"]').length, 2);
  assert.equal(window.content.querySelectorAll('.matches-automation-card footer button:not(:disabled)').length, 0);
  assert.match(window.content.querySelector('[data-matches-moment-card="battleStart"]').textContent, /Animation Premium.*Ajouter une vidéo.*Ajouter un son/s);
  assert.equal(window.content.querySelector("video, audio, iframe"), null);
  const css = fs.readFileSync(path.join(sourceRoot, "renderer/styles/creator-matches.css"), "utf8");
  assert.match(css, /\.matches-automation-grid\s*\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.deepEqual(calls, []);
});

test("les sélecteurs des temps forts présentent six libellés Cyber lisibles, sans Coffre ou Enigma fictif", async (t) => {
  const { window, state, calls, click } = context(t);
  const before = JSON.stringify(state.settings.matches);
  window.render();
  await click("matches-tab", { value: "automations" });
  const expected = [
    ["x2:cyber", "x2 - Cyber"], ["x3:cyber", "x3 - Cyber"],
    ["guantes:cyber", "Gant de boxe - Cyber"], ["snipe:cyber", "Snipe - Cyber"],
    ["taptap:cyber", "Tap Tap - Cyber"], ["quiereme:cyber", "Merci pour ton cœur - Cyber"]
  ];
  for (const select of window.content.querySelectorAll('[data-action="matches-automation-animation"]')) {
    const cyber = [...select.options].filter((option) => option.value.endsWith(":cyber"));
    assert.deepEqual(cyber.map((option) => [option.value, option.textContent]), expected);
    assert.equal(select.querySelector('option[value="cofre:cyber"], option[value="enigma:cyber"]'), null);
    assert.doesNotMatch(select.textContent, /Coffre - Cyber|Enigma - Cyber|Indisponible/);
  }
  assert.equal(JSON.stringify(state.settings.matches), before);
  assert.deepEqual(calls, []);
});

test("la galerie des animations utilise les noms Cyber demandés tout en gardant les deux anciens packs", async (t) => {
  const { window, state, calls, click } = context(t);
  const cyber = new Set(["matchX2", "matchX3", "matchGants", "matchSnipe", "matchTapTap", "matchQuiereme"]);
  window.overlayConfig = (key) => ({ variant: cyber.has(key) ? "cyber" : key === "matchCoffre" ? "gladiador" : "tikcontrol" });
  const before = JSON.stringify(state.settings.matches);
  window.render();
  await click("matches-tab", { value: "widgets" });
  const cards = [...window.content.querySelectorAll(".matches-animation-card")];
  const titles = cards.map((card) => card.querySelector("h4").textContent);
  assert.deepEqual(titles, ["x2 - Cyber", "x3 - Cyber", "Gant de boxe - Cyber", "Match Coffre", "Snipe - Cyber", "Tap Tap - Cyber", "Merci pour ton cœur - Cyber", "Match Enigma"]);
  assert.equal(cards[3].querySelector("small").textContent, "Gladiador");
  assert.equal(cards[7].querySelector("small").textContent, "TikControl");
  assert.equal(JSON.stringify(state.settings.matches), before);
  assert.equal(window.content.querySelector("iframe, video, audio"), null);
  assert.deepEqual(calls, []);
});

test("l’éditeur avancé garde Cyber pour les animations compatibles et replie uniquement son brouillon sinon", (t) => {
  const { window, state, calls } = context(t);
  const entry = window.ShenPulseMatches.normalizeMatchAutomation({ ...window.creatorMatchesAutomationDefault("multiplierX2"),
    id: "stored-cyber", enabled: true, reaction: { type: "animation", match: "x2", variant: "cyber", fit: "cover" } });
  state.settings.matches.automations = [entry];
  const before = JSON.stringify(state.settings.matches);
  window.openCreatorMatchesAutomationEditor(entry);
  const animation = window.dialogForm.querySelector('[name="matchAnimation"]');
  const variant = window.dialogForm.querySelector('[name="matchVariant"]');
  const change = (match) => { animation.value = match; animation.dispatchEvent(new window.Event("change", { bubbles: true })); };
  const versions = () => [...variant.options].map((option) => option.value);
  assert.equal(variant.value, "cyber");
  for (const match of ["x3", "guantes", "taptap", "quiereme", "snipe", "x2"]) {
    change(match);
    assert.deepEqual(versions(), ["tikcontrol", "gladiador", "cyber"]);
    assert.equal(variant.value, "cyber");
  }
  change("cofre");
  assert.deepEqual(versions(), ["tikcontrol", "gladiador"]);
  assert.equal(variant.value, "tikcontrol");
  variant.value = "gladiador";
  change("x3");
  assert.equal(variant.value, "gladiador");
  change("enigma");
  assert.deepEqual(versions(), ["tikcontrol"]);
  assert.equal(variant.value, "tikcontrol");
  assert.equal(JSON.stringify(state.settings.matches), before, "les changements du brouillon ne réécrivent aucune automatisation persistée");
  assert.deepEqual(calls, []);
});

test("un choix d’animation conserve son, média et action du profil sans lancer le test", async (t) => {
  const { window, state, click, calls } = context(t);
  const original = window.ShenPulseMatches.normalizeMatchAutomation({ ...window.creatorMatchesAutomationDefault("lead"), id: "lead-outputs", enabled: true,
    reaction: { type: "bundle", reactions: [{ type: "sound", url: "https://example.test/crowd.mp3", volume: .25, outputMode: "local" }, { type: "action", actionId: "action-balloon" }, { type: "media", mediaUrl: "https://example.test/lead.mp4", durationMs: 4000, screen: 3 }] } });
  state.settings.matches.automations = [original];
  await click("matches-automation-animation", { id: original.id, value: "x3:gladiador" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "saveAutomation");
  const saved = calls[0].args[0];
  assert.equal(saved.reaction.type, "bundle");
  assert.equal(saved.reaction.reactions.length, 4);
  assert.equal(saved.reaction.reactions.find((item) => item.type === "animation").match, "x3");
  for (const type of ["sound", "media", "action"]) assert.deepEqual(saved.reaction.reactions.find((item) => item.type === type), original.reaction.reactions.find((item) => item.type === type));
  assert.equal(calls[0].args[1].profileId, "match-profile");
  assert.equal(state.matchSession.session.battles, 0);
});

test("un son ajouté par sa tuile utilise les bibliothèques et la source Match, sans effacer l’animation", async (t) => {
  const { window, state, calls, click, mediaFields } = context(t);
  const original = window.ShenPulseMatches.normalizeMatchAutomation({ ...window.creatorMatchesAutomationDefault("battleStart"), id: "start-animation" });
  state.settings.matches.automations = [original];
  await click("matches-automation-output", { id: original.id, output: "sound" });
  assert.deepEqual(mediaFields.map((entry) => entry.kind), ["sound"]);
  assert.equal(window.dialogForm.querySelector('[name="matchOutputMode"]').value, "live");
  assert.deepEqual(calls, []);
  window.dialogForm.querySelector('[name="matchOutputUrl"]').value = "https://example.test/start.mp3";
  await window.editor.onSubmit(new window.FormData(window.dialogForm));
  const outputs = calls[0].args[0].reaction.reactions;
  assert.equal(calls[0].method, "saveAutomation");
  assert.deepEqual(outputs.find((item) => item.type === "animation"), original.reaction);
  assert.equal(outputs.find((item) => item.type === "sound").outputMode, "live");
  assert.equal(calls[0].args[0].enabled, false);
});

test("retirer la dernière sortie désarme le brouillon sans l’effacer ni armer une animation par défaut", async (t) => {
  const { window, state, calls, click } = context(t);
  state.settings.matches.automations = [window.ShenPulseMatches.normalizeMatchAutomation({ ...window.creatorMatchesAutomationDefault("victory"), id: "last-output", enabled: true })];
  await click("matches-automation-animation", { id: "last-output", value: "" });
  assert.equal(calls[0].args[0].enabled, false);
  assert.equal(calls[0].args[0].reaction.type, "bundle");
  assert.equal(calls[0].args[0].reaction.reactions.length, 0);
  await click("matches-automation-animation", { moment: "lead", value: "snipe:tikcontrol" });
  assert.equal(calls[1].args[0].moment, "lead");
  assert.equal(calls[1].args[0].enabled, false);
  assert.deepEqual(Array.from(calls[1].args[0].reaction.reactions, (item) => item.match), ["snipe"]);
});

test("les bonus groupés conservent les moments distincts et chaque test reste soumis à confirmation", async (t) => {
  const { window, state, calls, click } = context(t);
  state.settings.matches.automations = ["multiplierX2", "multiplierX3"].map((moment) => window.ShenPulseMatches.normalizeMatchAutomation({ ...window.creatorMatchesAutomationDefault(moment), id: moment }));
  await click("matches-automation-group-toggle", { ids: "multiplierX2,multiplierX3", checked: true });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((item) => item.args[0].moment), ["multiplierX2", "multiplierX3"]);
  assert.ok(calls.every((item) => item.method === "saveAutomation" && item.args[0].enabled));
  window.confirmAction = async () => false;
  await click("matches-automation-group-test", { ids: "multiplierX2,multiplierX3" });
  assert.equal(calls.length, 2);
  window.confirmAction = async () => true;
  await click("matches-automation-group-test", { ids: "multiplierX2,multiplierX3" });
  assert.deepEqual(calls.slice(2).map((item) => item.method), ["testAutomation", "testAutomation"]);
  assert.deepEqual(calls.slice(2).map((item) => item.args[0]), ["multiplierX2", "multiplierX3"]);
});

test("les deux tuiles du bonus peuvent appliquer un son aux deux moments sans modifier leurs animations", async (t) => {
  const { window, state, calls, click } = context(t);
  const originals = ["multiplierX2", "multiplierX3"].map((moment) => window.ShenPulseMatches.normalizeMatchAutomation({ ...window.creatorMatchesAutomationDefault(moment), id: moment }));
  state.settings.matches.automations = originals;
  await click("matches-automation-group-output", { ids: JSON.stringify(originals.map((item) => item.id)), output: "sound" });
  assert.deepEqual(calls, []);
  assert.equal(window.dialogForm.querySelector('[name="matchOutputBonus"]').value, "both");
  window.dialogForm.querySelector('[name="matchOutputUrl"]').value = "https://example.test/bonus.mp3";
  await window.editor.onSubmit(new window.FormData(window.dialogForm));
  assert.equal(calls.length, 2);
  for (let index = 0; index < 2; index++) {
    const saved = calls[index].args[0];
    assert.equal(saved.moment, originals[index].moment);
    assert.equal(saved.enabled, false);
    assert.deepEqual(saved.reaction.reactions.find((item) => item.type === "animation"), originals[index].reaction);
    assert.equal(saved.reaction.reactions.find((item) => item.type === "sound").url, "https://example.test/bonus.mp3");
  }
});

test("une vidéo dans la source Match n’offre pas un faux choix d’écran et conserve les champs anciens", async (t) => {
  const { window, state, calls, click } = context(t);
  state.settings.matches.automations = [window.ShenPulseMatches.normalizeMatchAutomation({ ...window.creatorMatchesAutomationDefault("lead"), id: "legacy-media", reaction: { type: "media", mediaUrl: "https://example.test/lead.mp4", screen: 6 } })];
  await click("matches-automation-output", { id: "legacy-media", output: "media" });
  assert.equal(window.dialogForm.querySelector('[name="matchOutputScreen"]'), null);
  await window.editor.onSubmit(new window.FormData(window.dialogForm));
  assert.equal(calls[0].args[0].reaction.reactions.find((item) => item.type === "media").screen, 6);
});

test("les doublons de bonus sont conservés et les identifiants groupés ambigus refusés", async (t) => {
  const { window, state, calls, click } = context(t);
  state.settings.matches.automations = ["x2,one", "x2-two", "x3"].map((id, index) => window.ShenPulseMatches.normalizeMatchAutomation({ ...window.creatorMatchesAutomationDefault(index === 2 ? "multiplierX3" : "multiplierX2"), id }));
  window.render();
  await click("matches-tab", { value: "automations" });
  const groups = window.content.querySelectorAll('[data-matches-moment-card="multiplier"]');
  assert.equal(groups.length, 2);
  assert.deepEqual(JSON.parse(groups[0].querySelector('[data-action="matches-automation-group-toggle"]').dataset.ids), ["x2,one", "x3"]);
  await assert.rejects(click("matches-automation-group-test", { ids: '["x3","x3"]' }), /invalide/);
  await assert.rejects(click("matches-automation-group-output", { ids: '["missing"]', output: "media" }), /a changé/);
  assert.deepEqual(calls, []);
});

test("l’éditeur réutilise les bibliothèques, enregistre un effet sans test et épingle son profil", async (t) => {
  const { window, calls, mediaFields } = context(t);
  window.openCreatorMatchesAutomationEditor(null, "likeRush");
  assert.equal(window.dialogForm.querySelector('[name="enabled"]').checked, false);
  assert.equal(window.dialogForm.querySelector('[name="matchLikeThreshold"]').value, "300");
  assert.equal(window.dialogForm.querySelector('[name="matchLikeWindow"]').value, "5");
  assert.equal(window.dialogForm.querySelector('[name="matchAnimation"]').options.length, 8);
  assert.deepEqual(mediaFields.map((entry) => entry.kind), ["visual", "sound", "sound"]);
  window.dialogForm.querySelector('[name="reactionType"]').value = "sound";
  window.dialogForm.querySelector('[name="matchSoundUrl"]').value = "https://example.test/alert.mp3";
  window.dialogForm.querySelector('[name="matchSoundVolume"]').value = "30";
  await window.editor.onSubmit(new window.FormData(window.dialogForm));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "saveAutomation");
  assert.equal(calls[0].args[0].enabled, false);
  assert.equal(calls[0].args[0].reaction.type, "sound");
  assert.equal(calls[0].args[0].reaction.volume, .3);
  assert.equal(calls[0].args[1].ownerUid, "match-user");
  assert.equal(calls[0].args[1].profileId, "match-profile");
});

test("le formulaire widget ne touche qu’au widget choisi et conserve les réglages communs et spécifiques", async (t) => {
  const { window, calls } = context(t);
  window.openCreatorMatchesWidgetEditor("wins");
  assert.equal(window.dialogForm.querySelector('[name="switchSeconds"]').value, "6");
  assert.equal(window.dialogForm.querySelector('[name="donorPhoto"]').checked, true);
  window.dialogForm.querySelector('[name="title"]').value = "Mon duel";
  window.dialogForm.querySelector('[name="showScores"]').checked = false;
  await window.editor.onSubmit(new window.FormData(window.dialogForm));
  const payload = calls[0].args[0];
  assert.deepEqual(Object.keys(payload), ["widgets"]);
  assert.deepEqual(Object.keys(payload.widgets), ["wins"]);
  assert.equal(payload.widgets.wins.title, "Mon duel");
  assert.equal(payload.widgets.wins.showScores, false);
  assert.equal(payload.widgets.wins.backgroundOpacity, 50);
  assert.equal(payload.widgets.wins.borderRadius, 12);
  assert.equal(payload.widgets.wins.animation, "none");
  assert.equal(payload.widgets.wins.enabled, false);
  assert.equal(calls[0].method, "saveConfig");
});

test("un formulaire ancien ou une réponse tardive ne sont jamais appliqués au nouveau compte/profil", async (t) => {
  const { window, state, account, click, calls, snapshots } = context(t);
  window.openCreatorMatchesAutomationEditor(null, "battleStart");
  state.session.profileId = "new-profile";
  await assert.rejects(window.editor.onSubmit(new window.FormData(window.dialogForm)), /profil a changé/);
  assert.deepEqual(calls, []);
  state.session.profileId = "match-profile";
  let resolve;
  window.api.matches.status = () => new Promise((done) => { resolve = done; });
  const work = click("matches-refresh");
  await Promise.resolve();
  account.uid = "another-account";
  window.invalidateCreatorPrivateOperations();
  resolve({ config: state.settings.matches, runtime: state.matchSession });
  await assert.rejects(work, /compte a changé/);
  assert.deepEqual(snapshots, []);
});

test("tester une automatisation exige confirmation explicite mais ne réécrit ni scores ni règles", async (t) => {
  const { window, state, click, calls } = context(t);
  state.settings.matches.automations = [window.ShenPulseMatches.normalizeMatchAutomation({ ...window.creatorMatchesAutomationDefault("card"), id: "manual-card" })];
  window.confirmAction = async () => false;
  await click("matches-automation-test", { id: "manual-card" });
  assert.deepEqual(calls, []);
  window.confirmAction = async () => true;
  await click("matches-automation-test", { id: "manual-card" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "testAutomation");
  assert.equal(calls[0].args[0], "manual-card");
  assert.equal(state.matchSession.session.wins, 0);
});

test("les noms sont échappés, les avatars dangereux absents et une session d’un autre profil est ignorée", (t) => {
  const { window, state } = context(t);
  state.matchSession.participants = [{ id: "x", displayName: '<script>alert("non")</script>', avatarUrl: "javascript:alert(1)", score: 5 }];
  window.render();
  assert.equal(window.content.querySelector("script"), null);
  assert.equal(window.content.querySelector(".matches-avatar img"), null);
  assert.equal(window.content.querySelector(".matches-participant-copy strong").textContent, '<script>alert("non")</script>');
  state.matchSession.scope = { uid: "match-user", profileId: "another-profile" };
  window.syncCreatorMatchesRuntime();
  assert.equal(window.content.querySelector(".matches-participant"), null);
  state.commerce.subscription = { tier: "free", status: "free" };
  assert.throws(() => window.openCreatorMatchesAutomationEditor(null, "battleStart"), /Pro ou Premium/);
});

test("les corrections et la remise à zéro des donateurs restent explicites et distinctes des résultats TikTok", async (t) => {
  const { window, state, click, calls } = context(t);
  state.matchSession.session.wins = 5;
  state.matchSession.manualWins = 3;
  window.openCreatorMatchesWinsEditor();
  assert.equal(window.dialogForm.querySelector('[name="amount"]').value, "3");
  window.dialogForm.querySelector('[name="amount"]').value = "4";
  await window.editor.onSubmit(new window.FormData(window.dialogForm));
  assert.equal(calls[0].method, "adjustWins");
  assert.equal(calls[0].args[0].operation, "set");
  assert.equal(calls[0].args[0].amount, 4);
  assert.equal(calls[0].args[1].profileId, "match-profile");
  assert.equal(state.matchSession.session.wins, 5);
  window.confirmAction = async () => false;
  await click("matches-clear-donors");
  assert.equal(calls.length, 1);
  window.confirmAction = async () => true;
  await click("matches-clear-donors");
  assert.equal(calls[1].method, "resetContributors");
  assert.equal(calls[1].args[0].ownerUid, "match-user");
});

test("un ancien cache de statut ne ressuscite pas les compteurs après reset ni les références manquantes", async (t) => {
  const { window, state, calls } = context(t);
  const owner = window.creatorMatchesCaptureOwner();
  window.creatorMatchesAcceptResult({ status: { runtime: { ...state.matchSession, lastEventAtMs: Date.now(), session: { wins: 999 } } } }, owner);
  state.matchSession = window.ShenPulseMatches.createMatchSession();
  assert.equal(window.creatorMatchesModel().runtime.session.wins, 0);
  const current = window.ShenPulseMatches.normalizeMatchAutomation({ ...window.creatorMatchesAutomationDefault("victory"), id: "missing-action", reaction: { type: "action", actionId: "removed-action" } });
  window.openCreatorMatchesAutomationEditor(current);
  assert.equal(window.dialogForm.querySelector('[name="matchActionId"]').value, "removed-action");
  assert.match(window.dialogForm.querySelector('[name="matchActionId"]').selectedOptions[0].textContent, /indisponible/);
  await window.editor.onSubmit(new window.FormData(window.dialogForm));
  assert.equal(calls[0].args[0].reaction.actionId, "removed-action");
  assert.equal(calls[0].args[0].enabled, false);
});
