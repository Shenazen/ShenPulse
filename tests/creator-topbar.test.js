"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");
const { JSDOM, VirtualConsole } = require("jsdom");
const { createDefaultState } = require("../src/main/defaults");
const { version: appVersion } = require("../package.json");

async function waitUntil(predicate, message) {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
}

function createRenderer({ authenticated = true, photoUrl = "", hooks = {} } = {}) {
  const htmlFile = path.join(__dirname, "..", "src", "renderer", "index.html");
  const state = createDefaultState();
  const account = authenticated
    ? { authenticated: true, uid: "topbar-creator", email: "creator@example.test", displayName: "Musique Modifier", photoUrl, emailVerified: true }
    : { authenticated: false, uid: "", email: "", displayName: "", photoUrl: "", emailVerified: false };
  Object.assign(state.settings.account, account);
  state.commerce.subscription = { tier: "pro", status: "active", source: "own" };
  state.profiles[0].name = "Musique";
  state.profiles.push({ ...state.profiles[0], id: "profile_second", name: "Second profil" });
  state.settings.tiktok = { ...state.settings.tiktok, username: "old_creator", status: "disconnected" };
  state.connections.push({ id: "source_tiktok", type: "tiktok-direct", name: "TikTok @old_creator", enabled: false, status: "disconnected", config: { username: "old_creator" } });
  if (!authenticated) {
    Object.assign(state.settings.account, { email: "private@example.test", displayName: "Private remembered creator", photoUrl: "https://private.example/avatar.png" });
    state.commerce.subscription = { tier: "premium", status: "active", source: "own" };
  }
  const snapshot = { appVersion, state, packs: [], soundCatalog: [], mediaCatalog: [], catalogCounts: {}, timerRuntime: [], overlayUrls: {}, localOverlayUrls: {}, publicOverlayRelay: { connected: false } };
  const handlers = new Map();
  const calls = [];
  const errors = [];
  const preferences = new Map();
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => errors.push(error));
  function setTikTok(status, connectionStatus = "disconnected", enabled = false, emit = true) {
    state.settings.tiktok = { ...state.settings.tiktok, status };
    state.connections = state.connections.map((source) => source.id === "source_tiktok"
      ? { ...source, status: connectionStatus, enabled, liveStatus: status }
      : source);
    if (emit) handlers.get("runtime-state-changed")({ state: { settings: { ...state.settings }, connections: [...state.connections] } });
  }
  const dom = new JSDOM(fs.readFileSync(htmlFile, "utf8"), {
    url: pathToFileURL(htmlFile).toString(), runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole,
    beforeParse(window) {
      Object.defineProperty(window, "localStorage", { value: {
        getItem: (key) => preferences.get(key) || null,
        setItem: (key, value) => preferences.set(key, String(value)),
        removeItem: (key) => preferences.delete(key)
      } });
      window.shenPulse = {
        getSnapshot: async () => snapshot,
        saveSettings: async (incoming) => {
          calls.push({ name: "saveSettings", incoming: JSON.parse(JSON.stringify(incoming)) });
          Object.assign(state.settings, incoming);
          return snapshot;
        },
        saveTikTok: async (incoming) => {
          calls.push({ name: "saveTikTok", incoming: JSON.parse(JSON.stringify(incoming)) });
          if (hooks.saveTikTok) return hooks.saveTikTok(incoming);
          state.settings.tiktok = { ...state.settings.tiktok, username: incoming.username, status: "disconnected", autoConnect: true };
          state.connections = state.connections.map((source) => source.id === "source_tiktok"
            ? { ...source, name: `TikTok @${incoming.username}`, enabled: true, status: "disconnected", config: { username: incoming.username } }
            : source);
          if (!state.connections.some((source) => source.id === "source_tiktok")) {
            state.connections.push({ id: "source_tiktok", type: "tiktok-direct", name: `TikTok @${incoming.username}`, enabled: true, status: "disconnected", config: { username: incoming.username } });
          }
          return snapshot;
        },
        startTikTok: async () => {
          calls.push({ name: "startTikTok" });
          if (hooks.startTikTok) return hooks.startTikTok();
          setTikTok("checking", "connecting", true, false);
          return snapshot;
        },
        stopTikTok: async () => {
          calls.push({ name: "stopTikTok" });
          setTikTok("disconnected", "disconnected", false, false);
          return snapshot;
        },
        selectProfile: async (id) => {
          calls.push({ name: "selectProfile", id });
          state.session.profileId = id;
          return snapshot;
        },
        openExternal: async (url) => calls.push({ name: "openExternal", url }),
        liveDirectoryConfigure: async (incoming) => {
          calls.push({ name: "liveDirectoryConfigure", incoming: JSON.parse(JSON.stringify(incoming)) });
          if (hooks.liveDirectoryConfigure) await hooks.liveDirectoryConfigure(incoming);
          state.settings.liveDirectory = { ...state.settings.liveDirectory, publishEnabled: incoming.publishEnabled === true };
          snapshot.liveDirectory = { ...snapshot.liveDirectory, enabled: incoming.publishEnabled === true };
          return snapshot;
        },
        startSession: async () => { calls.push({ name: "startSession" }); return snapshot; },
        testAction: async (action) => calls.push({ name: "testAction", action }),
        searchGifts: async () => ({ gifts: [], total: 0 }),
        getGameRuntimeStatus: async () => null,
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
      window.addEventListener("unhandledrejection", (event) => errors.push(event.reason || new Error("Promesse rejetée")));
    }
  });
  return { dom, state, account, snapshot, handlers, calls, errors, setTikTok };
}

async function ready(fixture) {
  await waitUntil(() => fixture.dom.window.document.querySelector(".creator-home-page"), "L’accueil ne démarre pas.");
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(fixture.errors.length, 0, fixture.errors.map((error) => error.stack || error.message).join("\n"));
}

function assertNoErrors(fixture) {
  assert.equal(fixture.errors.length, 0, fixture.errors.map((error) => error.stack || error.message).join("\n"));
}

test("l’annuaire reste désactivé par défaut et le menu compte explique puis sauvegarde le choix volontaire", async () => {
  let release;
  const fixture = createRenderer({ hooks: { liveDirectoryConfigure: () => new Promise((resolve) => { release = resolve; }) } });
  const { dom, calls, state, handlers } = fixture;
  try {
    await ready(fixture);
    const document = dom.window.document;
    const menu = document.getElementById("account-menu");
    const toggle = document.getElementById("account-directory-toggle");
    assert.ok(menu.contains(toggle));
    assert.equal(document.getElementById("account-directory-preference").hidden, false);
    assert.equal(toggle.getAttribute("aria-checked"), "false");
    assert.match(document.getElementById("account-directory-description").textContent, /@, photo publique, plateforme et audience/);
    assert.match(document.getElementById("account-directory-description").textContent, /90 s.*Désactivé par défaut/);
    assert.equal(calls.filter((entry) => entry.name === "liveDirectoryConfigure").length, 0);
    toggle.click();
    await waitUntil(() => typeof release === "function", "L’opt-in ne déclenche pas sa sauvegarde.");
    assert.equal(toggle.disabled, true);
    assert.equal(toggle.getAttribute("aria-checked"), "false", "Un choix en attente n’est pas présenté comme enregistré.");
    toggle.click();
    assert.equal(calls.filter((entry) => entry.name === "liveDirectoryConfigure").length, 1);
    assert.deepEqual(calls.find((entry) => entry.name === "liveDirectoryConfigure").incoming, { publishEnabled: true });
    release();
    await waitUntil(() => !toggle.disabled && toggle.getAttribute("aria-checked") === "true", "Le choix enregistré n’est pas reflété.");
    assert.equal(state.settings.liveDirectory.publishEnabled, true);
    handlers.get("live-directory-status")({ available: true, connected: true, enabled: false, rows: [] });
    assert.equal(toggle.getAttribute("aria-checked"), "false", "Un statut main fait autorité sur un ancien snapshot.");
    assert.equal(calls.filter((entry) => entry.name === "liveDirectoryConfigure").length, 1, "Le feed et le rendu ne publient pas implicitement.");
    assertNoErrors(fixture);
  } finally { dom.window.close(); }
});

test("un invité ne peut pas modifier la visibilité publique, même avec un ancien réglage opt-in mémorisé", async () => {
  const fixture = createRenderer({ authenticated: false });
  const { dom, state, calls, handlers } = fixture;
  try {
    await ready(fixture);
    state.settings.liveDirectory = { publishEnabled: true };
    handlers.get("live-directory-status")({ available: true, connected: true, enabled: true, rows: [] });
    const toggle = dom.window.document.getElementById("account-directory-toggle");
    assert.equal(dom.window.document.getElementById("account-directory-preference").hidden, true);
    assert.equal(toggle.disabled, true);
    assert.equal(toggle.getAttribute("aria-checked"), "false");
    toggle.click();
    assert.equal(calls.filter((entry) => entry.name === "liveDirectoryConfigure").length, 0);
    assertNoErrors(fixture);
  } finally { dom.window.close(); }
});

test("un refus de l’opt-in laisse la préférence désactivée, libère le bouton et affiche une erreur", async () => {
  const fixture = createRenderer({ hooks: { liveDirectoryConfigure: async () => { throw new Error("Publication refusée."); } } });
  const { dom, calls } = fixture;
  try {
    await ready(fixture);
    const document = dom.window.document;
    const toggle = document.getElementById("account-directory-toggle");
    toggle.click();
    await waitUntil(() => !toggle.disabled && /Publication refusée/.test(document.body.textContent), "Le refus ne rétablit pas le bouton ni ne signale l’erreur.");
    assert.equal(toggle.getAttribute("aria-checked"), "false");
    assert.deepEqual(calls.filter((entry) => entry.name === "liveDirectoryConfigure").map((entry) => entry.incoming), [{ publishEnabled: true }]);
    assertNoErrors(fixture);
  } finally { dom.window.close(); }
});

test("le compte avec photo, les abonnements et les profils fonctionnent dans la barre supérieure", async () => {
  const fixture = createRenderer({ photoUrl: "https://avatar.example.test/creator.png" });
  const { dom, state, calls } = fixture;
  try {
    await ready(fixture);
    const document = dom.window.document;
    const topbar = document.querySelector(".topbar");
    for (const id of ["account-menu-button", "account-avatar", "account-name", "account-plan", "membership-popup-button"]) {
      assert.equal(document.querySelectorAll(`#${id}`).length, 1, `${id} reste unique`);
      assert.ok(topbar.contains(document.getElementById(id)), `${id} est placé en haut`);
    }
    assert.equal(document.querySelector("aside #account-menu-button"), null);
    assert.equal(document.getElementById("account-name").textContent, "Musique Modifier");
    assert.match(document.getElementById("account-plan").textContent, /\bpro\b/i);
    const avatar = document.getElementById("account-avatar");
    const avatarSource = avatar.querySelector("img")?.getAttribute("src") || avatar.style.backgroundImage;
    assert.ok(avatarSource.includes(fixture.account.photoUrl), "La photo du compte est utilisée");
    const photoNode = avatar.querySelector("img");
    fixture.handlers.get("runtime-state-changed")({ state: { statistics: { ...state.statistics, sessionEvents: 3 } } });
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(avatar.querySelector("img"), photoNode, "Le rafraîchissement du chrome conserve la photo chargée");
    assert.ok((avatar.querySelector("img")?.getAttribute("src") || avatar.style.backgroundImage).includes(fixture.account.photoUrl));
    if (photoNode) {
      photoNode.dispatchEvent(new dom.window.Event("error"));
      assert.equal(avatar.textContent.trim(), "MM", "Une photo indisponible revient aux initiales");
    }
    const menuButton = document.getElementById("account-menu-button");
    const menu = document.getElementById("account-menu");
    menuButton.click();
    assert.equal(menu.hidden, false);
    assert.equal(menuButton.getAttribute("aria-expanded"), "true");
    assert.equal(menu.querySelector(".account-logout-action").hidden, false);
    assert.equal(menu.querySelector(".account-login-action").hidden, true);
    menuButton.click();
    assert.equal(menu.hidden, true);
    assert.equal(menuButton.getAttribute("aria-expanded"), "false");

    const profilePicker = document.getElementById("profile-picker-button");
    assert.equal(document.querySelectorAll("#profile-picker-button").length, 1);
    profilePicker.click();
    assert.equal(document.getElementById("profile-menu").hidden, false);
    assert.equal(profilePicker.getAttribute("aria-expanded"), "true");
    document.querySelector('[data-profile-select="profile_second"]').click();
    await waitUntil(() => state.session.profileId === "profile_second" && document.getElementById("profile-current-name").textContent === "Second profil", "Le changement de profil ne fonctionne plus.");
    assert.equal(calls.filter((entry) => entry.name === "selectProfile").length, 1);
    document.getElementById("profile-manage-button").click();
    await waitUntil(() => document.querySelector("dialog[open] .profile-manager"), "Le gestionnaire de profils ne s’ouvre pas.");
    document.querySelector("dialog[open]").close();

    assert.equal(document.getElementById("membership-popup-button").hidden, true, "Le compte Pro n’affiche plus une promotion d’abonnement");
    menuButton.click();
    document.getElementById("account-membership-button").click();
    await waitUntil(() => document.querySelector("dialog[open] .membership-popup-shell"), "La popup des abonnements ne s’ouvre pas.");
    assert.equal(document.querySelector('#navigation .active').dataset.navigate, "home", "La popup n’éloigne pas l’utilisateur de sa page");
    document.querySelector("dialog[open] [data-membership-close]").click();
    document.getElementById("studio-language").click();
    await waitUntil(() => document.documentElement.lang === "en", "La barre supérieure n’est pas traduite.");
    assert.match(document.getElementById("membership-popup-button").title, /subscription|plan/i);
    assert.equal(document.getElementById("tiktok-connection-button").textContent.trim(), "Connect");
    assert.equal(document.getElementById("account-name").textContent, "Musique Modifier", "La traduction ne modifie pas le nom du compte");
    document.getElementById("profile-manage-button").click();
    await waitUntil(() => document.querySelector("dialog[open] .profile-manager"), "Le gestionnaire de profils anglais ne s’ouvre pas.");
    assert.match(document.getElementById("dialog-title").textContent, /profile/i);
    assert.equal(document.querySelector(".profile-manager-card h3").textContent.trim(), "Musique", "Le nom du profil reste une donnée utilisateur, pas un libellé à traduire");
    document.querySelector("dialog[open]").close();
    document.getElementById("studio-language").click();
    await waitUntil(() => document.documentElement.lang === "fr", "Le retour au français échoue.");
    assert.match(document.getElementById("membership-popup-button").title, /abonnement|offre/i);
    assert.equal(document.getElementById("tiktok-connection-button").textContent.trim(), "Connecter");
    assert.equal(calls.some((entry) => ["openExternal", "startSession", "testAction", "startTikTok"].includes(entry.name)), false);
    assertNoErrors(fixture);
  } finally { dom.window.close(); }
});

test("la promotion affiche le vrai prix Pro sans masquer l’essai, puis disparaît seulement pour les abonnés ou un siège offert", async () => {
  const fixture = createRenderer();
  const { dom, state, handlers } = fixture;
  try {
    await ready(fixture);
    const document = dom.window.document;
    const button = document.getElementById("membership-popup-button");
    const label = document.getElementById("membership-popup-label");
    const now = Date.now();
    const cases = [
      { subscription: { tier: "free", status: "free", source: "free" }, visible: true, badge: /GRATUIT/ },
      { subscription: { tier: "pro", status: "active", source: "trial", expiresAtMs: now + 86400000 }, visible: true, badge: /PRO · ESSAI/ },
      { subscription: { tier: "pro", status: "trial", source: "trial", expiresAtMs: now - 86400000 }, visible: true, badge: /GRATUIT/ },
      { subscription: { tier: "pro", status: "active", source: "own" }, visible: false, badge: /^PRO$/ },
      { subscription: { tier: "premium", status: "paid", source: "own" }, visible: false, badge: /PREMIUM/ },
      { subscription: { tier: "pro", status: "active", source: "premiumSeat" }, visible: false, badge: /PRO · OFFERT/ },
      { subscription: { tier: "pro", status: "active", source: "own", pendingChange: { targetTier: "free", effectiveAt: new Date(now + 86400000).toISOString() } }, visible: false, badge: /^PRO$/ }
    ];
    for (const entry of cases) {
      state.commerce.subscription = entry.subscription;
      handlers.get("runtime-state-changed")({ state: { commerce: { ...state.commerce } } });
      await waitUntil(() => button.hidden === !entry.visible && entry.badge.test(document.getElementById("account-plan").textContent),
        `Abonnement mal reflété : ${JSON.stringify(entry.subscription)}`);
      assert.match(label.textContent, /^Pro - 9,99\s*€$/, "La promotion est toujours le tarif Pro ShenPulse, pas Premium ni le prix de référence");
      assert.equal(button.closest(".creator-topbar-left").hidden, !entry.visible);
      assert.equal(document.getElementById("account-membership-button").hidden, false, "Tous gardent accès à leur abonnement via le compte");
    }
    document.getElementById("account-menu-button").click();
    const menu = document.getElementById("account-menu");
    assert.equal(menu.hidden, false);
    const light = document.getElementById("studio-light-mode");
    const language = document.getElementById("studio-language");
    assert.ok(menu.contains(light));
    assert.ok(menu.contains(language));
    light.click();
    await waitUntil(() => light.getAttribute("aria-pressed") === "true", "Le mode léger déplacé doit garder son handler.");
    assert.equal(document.body.classList.contains("studio-light-mode"), true);
    assert.equal(menu.hidden, false, "Changer une préférence reste dans le menu compte");
    language.click();
    await waitUntil(() => document.documentElement.lang === "en", "La langue déplacée doit garder son handler.");
    assert.equal(language.textContent, "EN");
    assert.match(language.parentElement.textContent, /Language/);
    language.click();
    await waitUntil(() => document.documentElement.lang === "fr", "La langue revient au français depuis le menu.");
    assert.equal(language.textContent, "FR");
    assert.match(language.parentElement.textContent, /Langue/);
    assert.equal(fixture.calls.filter((entry) => !["saveSettings"].includes(entry.name)).length, 0,
      "L’affichage et les préférences ne déclenchent ni paiement, ni opération LIVE");
    assertNoErrors(fixture);
  } finally { dom.window.close(); }
});

test("la barre supérieure utilise les initiales sans photo et ne révèle aucun compte ou abonnement privé à l’invité", async () => {
  const authenticated = createRenderer();
  try {
    await ready(authenticated);
    assert.equal(authenticated.dom.window.document.getElementById("account-avatar").textContent.trim(), "MM");
    assert.equal(authenticated.dom.window.document.getElementById("account-avatar").querySelector("img"), null);
  } finally { authenticated.dom.window.close(); }

  const guest = createRenderer({ authenticated: false });
  try {
    await ready(guest);
    const document = guest.dom.window.document;
    for (const id of ["account-name", "account-avatar", "account-plan", "account-menu-name", "account-menu-email"]) {
      const markup = document.getElementById(id).outerHTML;
      assert.doesNotMatch(markup, /private@example|Private remembered creator|private\.example/);
    }
    assert.doesNotMatch(document.getElementById("account-plan").textContent, /premium|pro/i);
    assert.equal(document.getElementById("membership-popup-button").hidden, false, "Un invité garde accès aux offres publiques");
    assert.match(document.getElementById("membership-popup-label").textContent, /^Pro - 9,99\s*€$/, "Le prix invité ne révèle pas l’ancien abonnement local");
    assert.ok(document.getElementById("profile-control").hidden);
    assert.ok(document.getElementById("tiktok-username").closest("[hidden]"));
    document.getElementById("account-menu-button").click();
    const menu = document.getElementById("account-menu");
    assert.equal(menu.hidden, false);
    assert.equal(menu.querySelector(".account-login-action").hidden, false);
    assert.equal(menu.querySelector(".account-logout-action").hidden, true);
    menu.querySelector(".account-login-action").click();
    await waitUntil(() => document.querySelector("dialog[open] .account-login-dialog"), "L’invité ne peut pas se connecter depuis la barre supérieure.");
    document.querySelector("dialog[open]").close();
    document.getElementById("membership-popup-button").click();
    await waitUntil(() => document.querySelector("dialog[open] .membership-popup-shell"), "L’invité ne peut pas consulter les abonnements.");
    assert.ok(document.querySelector(".membership-popup-card.tier-free[aria-current='true']"), "L’invité voit l’offre publique Free, pas l’abonnement local privé");
    document.querySelector("dialog[open] [data-membership-close]").click();
    document.getElementById("studio-language").click();
    await waitUntil(() => document.documentElement.lang === "en", "Le chrome invité n’est pas traduit.");
    assert.match(document.getElementById("account-plan").textContent, /guest/i);
    assert.doesNotMatch(document.getElementById("account-name").textContent, /Aucun compte/);
    assert.match(document.getElementById("membership-popup-button").title, /subscription|plan/i);
    document.getElementById("studio-language").click();
    await waitUntil(() => document.documentElement.lang === "fr", "Le chrome invité ne revient pas au français.");
    assert.match(document.getElementById("account-plan").textContent, /invité/i);
    assert.equal(guest.calls.some((entry) => ["startTikTok", "saveTikTok", "openExternal", "startSession"].includes(entry.name)), false);
    assertNoErrors(guest);
  } finally { guest.dom.window.close(); }
});

test("TikTok en barre supérieure conserve la saisie, ne sauvegarde qu’à la connexion et permet d’annuler l’attente du live", async () => {
  const hooks = {};
  const fixture = createRenderer({ hooks });
  const { dom, state, calls, handlers, setTikTok } = fixture;
  let releaseStart;
  hooks.startTikTok = () => new Promise((resolve) => {
    releaseStart = () => { setTikTok("checking", "connecting", true, false); resolve(fixture.snapshot); };
  });
  try {
    await ready(fixture);
    const document = dom.window.document;
    const input = document.getElementById("tiktok-username");
    const button = document.getElementById("tiktok-connection-button");
    assert.ok(input && button);
    assert.equal(input.value, "old_creator");
    assert.equal(input.disabled, false);
    assert.equal(button.textContent.trim(), "Connecter");
    input.value = " @#$ ";
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    button.click();
    await waitUntil(() => input.getAttribute("aria-invalid") === "true", "Un @ invalide doit être signalé dans le champ.");
    assert.equal(document.getElementById("tiktok-input-error").hidden, false);
    assert.equal(calls.filter((entry) => ["saveSettings", "saveTikTok", "startTikTok"].includes(entry.name)).length, 0);
    for (const value of ["@", "@@", "@@ creator", "  @@ creator.name  "]) {
      input.value = value;
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    }
    input.focus();
    input.blur();
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(calls.filter((entry) => ["saveSettings", "saveTikTok", "startTikTok"].includes(entry.name)).length, 0,
      "La frappe et la perte de focus ne doivent pas couper ou démarrer TikTok");
    input.focus();
    for (let index = 0; index < 100; index += 1) {
      handlers.get("runtime-state-changed")({ state: { statistics: { ...state.statistics, sessionEvents: index + 1 } } });
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(document.getElementById("tiktok-username"), input);
    assert.equal(input.value, "  @@ creator.name  ");
    assert.equal(document.activeElement, input);
    button.click();
    await waitUntil(() => typeof releaseStart === "function", "Le bouton ne démarre pas la détection TikTok.");
    assert.deepEqual(calls.filter((entry) => ["saveTikTok", "startTikTok"].includes(entry.name)).map((entry) => entry.name), ["saveTikTok", "startTikTok"]);
    assert.equal(calls.find((entry) => entry.name === "saveTikTok").incoming.username, "creator.name");
    assert.equal(input.disabled, true);
    assert.equal(button.disabled, true);
    button.click();
    assert.equal(calls.filter((entry) => entry.name === "startTikTok").length, 1, "Une connexion en cours ne peut pas être lancée deux fois");
    releaseStart();
    await waitUntil(() => !button.disabled && /En attente du live/i.test(button.textContent), "L’attente du live n’est pas annulable.");
    assert.equal(input.disabled, true, "Le @ est verrouillé pendant sa surveillance");
    button.click();
    await waitUntil(() => /Connecter/.test(button.textContent) && !input.disabled, "L’annulation ne réactive pas le champ TikTok.");
    assert.equal(calls.filter((entry) => entry.name === "stopTikTok").length, 1);

    for (const [status, connectionStatus] of [["offline", "connecting"], ["checking", "connecting"], ["error", "reconnecting"]]) {
      setTikTok(status, connectionStatus, true);
      await waitUntil(() => /En attente du live/i.test(button.textContent), `${status} doit rester annulable.`);
      assert.equal(button.disabled, false);
      assert.equal(input.disabled, true);
      button.click();
      await waitUntil(() => /Connecter/.test(button.textContent) && !input.disabled, "L’arrêt de la surveillance échoue.");
    }
    for (const [status, connectionStatus, enabled] of [["disconnected", "disconnected", false], ["disconnected", "disconnected", true], ["error", "error", false]]) {
      setTikTok(status, connectionStatus, enabled);
      await waitUntil(() => button.textContent.trim() === "Connecter" && !input.disabled, `${status} ne permet pas de reconnecter.`);
      assert.equal(button.disabled, false);
    }
    setTikTok("live", "connected", true);
    await waitUntil(() => button.textContent.trim() === "Déconnecter", "Une connexion live doit proposer sa déconnexion.");
    assert.equal(button.disabled, false);
    assert.equal(input.disabled, true);
    button.click();
    await waitUntil(() => button.textContent.trim() === "Connecter", "La déconnexion live ne revient pas à Connecter.");

    hooks.startTikTok = null;
    input.value = state.settings.tiktok.username;
    input.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await waitUntil(() => calls.filter((entry) => entry.name === "startTikTok").length === 2, "Entrée ne connecte pas le compte enregistré.");
    assert.equal(calls.filter((entry) => entry.name === "saveTikTok").length, 1, "Reconnecter le même compte ne le réenregistre pas inutilement");
    assert.equal(calls.some((entry) => entry.name === "saveSettings" && entry.incoming.tiktok), false, "TikTok passe par sa sauvegarde dédiée, pas saveSettings");
    document.getElementById("studio-language").click();
    await waitUntil(() => document.documentElement.lang === "en" && /Waiting/i.test(button.textContent), "L’attente TikTok n’est pas traduite.");
    assert.equal(button.disabled, false);
    assert.equal(input.value, "creator.name");
    button.click();
    await waitUntil(() => button.textContent.trim() === "Connect" && !input.disabled, "Le bouton anglais n’annule pas la surveillance.");
    state.connections = state.connections.filter((source) => source.id !== "source_tiktok");
    handlers.get("runtime-state-changed")({ state: { connections: [...state.connections] } });
    input.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await waitUntil(() => calls.filter((entry) => entry.name === "startTikTok").length === 3, "Une source absente doit être recréée avant la connexion.");
    assert.equal(calls.filter((entry) => entry.name === "saveTikTok").length, 2);
    assert.equal(state.connections.find((source) => source.id === "source_tiktok").config.username, "creator.name");
    assertNoErrors(fixture);
  } finally { dom.window.close(); }
});

test("un rejet de la sauvegarde TikTok conserve le nouveau brouillon et libère la connexion sans démarrer le live", async () => {
  let rejectSave;
  const hooks = { saveTikTok: () => new Promise((_resolve, reject) => { rejectSave = reject; }) };
  const fixture = createRenderer({ hooks });
  const { dom, state, calls, handlers } = fixture;
  try {
    await ready(fixture);
    const document = dom.window.document;
    const input = document.getElementById("tiktok-username");
    const button = document.getElementById("tiktok-connection-button");
    const error = document.getElementById("tiktok-input-error");
    input.value = "  @new_creator  ";
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    button.click();
    await waitUntil(() => typeof rejectSave === "function", "Le nouveau compte n’est pas proposé à la sauvegarde.");
    assert.equal(input.disabled, true);
    assert.equal(button.disabled, true);
    assert.equal(button.getAttribute("aria-busy"), "true");
    assert.equal(state.settings.tiktok.username, "old_creator", "La sauvegarde en attente n’a pas encore muté l’ancien compte");
    rejectSave(new Error("Le serveur refuse la sauvegarde de ce compte."));
    await waitUntil(() => !button.disabled && !error.hidden, "L’échec ne libère pas le contrôle TikTok ou ne montre pas son erreur.");
    assert.equal(input.disabled, false);
    assert.equal(button.getAttribute("aria-busy"), "false");
    assert.equal(button.textContent.trim(), "Connecter");
    assert.equal(input.value, "new_creator", "L’échec ne doit pas restaurer l’ancien @ à la place du brouillon normalisé");
    assert.match(error.textContent, /Le serveur refuse la sauvegarde/);
    assert.equal(state.settings.tiktok.username, "old_creator");
    assert.equal(state.connections.find((source) => source.id === "source_tiktok").config.username, "old_creator");
    assert.deepEqual(calls.map((entry) => entry.name), ["saveTikTok"], "Un save refusé ne doit ni démarrer ni arrêter TikTok");
    assert.equal(calls[0].incoming.username, "new_creator");

    input.blur();
    for (let index = 0; index < 100; index += 1) {
      handlers.get("runtime-state-changed")({ state: { statistics: { ...state.statistics, sessionEvents: index + 1 } } });
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(document.getElementById("tiktok-username"), input);
    assert.equal(input.value, "new_creator", "Le brouillon refusé survit aussi aux rafraîchissements runtime sans focus");
    assert.equal(error.hidden, false);
    assert.deepEqual(calls.map((entry) => entry.name), ["saveTikTok"]);
    assertNoErrors(fixture);
  } finally { dom.window.close(); }
});

test("une source TikTok démarrée ailleurs remplace le brouillon par le vrai compte surveillé sans mutation due au rendu", async () => {
  const fixture = createRenderer();
  const { dom, state, calls, setTikTok } = fixture;
  try {
    await ready(fixture);
    const document = dom.window.document;
    const input = document.getElementById("tiktok-username");
    const button = document.getElementById("tiktok-connection-button");
    input.focus();
    input.value = "unsaved_creator";
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    assert.equal(state.settings.tiktok.username, "old_creator");
    assert.deepEqual(calls, [], "La saisie non validée est uniquement un brouillon local");

    setTikTok("checking", "connecting", true);
    await waitUntil(() => input.disabled && input.value === "old_creator", "La source externe en connexion ne rétablit pas le vrai @ surveillé.");
    assert.equal(document.getElementById("tiktok-username"), input);
    assert.equal(button.disabled, false);
    assert.match(button.textContent, /En attente du live/i);
    assert.deepEqual(calls, [], "L’affichage du monitoring externe ne doit pas déclencher save, stop ou start");
    setTikTok("live", "connected", true);
    await waitUntil(() => button.textContent.trim() === "Déconnecter", "Le passage externe en live n’est pas reflété.");
    assert.equal(input.disabled, true);
    assert.equal(input.value, "old_creator");
    assert.deepEqual(calls, []);

    setTikTok("disconnected", "disconnected", false);
    await waitUntil(() => !input.disabled && button.textContent.trim() === "Connecter", "La source externe arrêtée ne libère pas le champ.");
    assert.equal(input.value, "old_creator", "Le brouillon remplacé ne doit pas réapparaître après l’arrêt externe");
    assert.equal(state.settings.tiktok.username, "old_creator");
    assert.deepEqual(calls, [], "Le cycle de rendu complet reste sans mutation backend");
    assertNoErrors(fixture);
  } finally { dom.window.close(); }
});
