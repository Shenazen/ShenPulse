"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");
const { JSDOM, VirtualConsole } = require("jsdom");
const { version: packageVersion } = require("../package.json");
const { createDefaultState } = require("../src/main/defaults");

const rendererDirectory = path.join(__dirname, "..", "src", "renderer");

function rendererSnapshot() {
  return {
    appVersion: packageVersion,
    state: createDefaultState(),
    packs: [],
    soundCatalog: [],
    mediaCatalog: [],
    catalogCounts: { sounds: 0, media: 0, gifts: 0 },
    timerRuntime: {},
    overlayUrls: {},
    localOverlayUrls: {},
    publicOverlayRelay: { connected: false }
  };
}

function rendererApi(snapshot) {
  return {
    getSnapshot: async () => snapshot,
    searchGifts: async () => ({ gifts: [], total: 0 }),
    getGameRuntimeStatus: async () => null,
    updates: {
      check: async () => ({ available: false }),
      install: async () => ({ installed: false })
    },
    account: {
      status: async () => ({
        authenticated: false,
        email: "",
        uid: "",
        displayName: "",
        photoUrl: "",
        providerId: "",
        emailVerified: false,
        lastAuthenticatedAt: "",
        offline: false
      }),
      gameCheatAccess: async () => ({ allowed: false, checkedAt: "" }),
      syncEntitlements: async () => null
    },
    admin: {
      status: async () => ({ authorized: false }),
      visibility: async () => snapshot.state.settings.siteVisibility,
      dashboard: async () => ({})
    },
    on: () => () => {}
  };
}

async function waitUntil(predicate, message) {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

function loadRenderer(snapshot, { configureApi = () => {}, hidden = false } = {}) {
  const htmlFile = path.join(rendererDirectory, "index.html");
  const runtimeErrors = [];
  const startupSignals = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => runtimeErrors.push(error));

  const dom = new JSDOM(fs.readFileSync(htmlFile, "utf8"), {
    url: pathToFileURL(htmlFile).toString(),
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      const api = rendererApi(snapshot);
      api.startupReady = () => {
        startupSignals.push({ dialogOpen: window.document.getElementById("editor-dialog").open,
          variant: window.document.getElementById("editor-dialog").dataset.variant,
          content: window.document.getElementById("content").innerHTML,
          navigation: window.document.querySelectorAll("#navigation .nav-item").length });
        return Promise.resolve({ ready: true });
      };
      configureApi(api, window);
      window.shenPulse = api;
      if (hidden) Object.defineProperty(window.document, "visibilityState", { configurable: true, get: () => "hidden" });
      window.HTMLDialogElement.prototype.showModal = function() { this.setAttribute("open", ""); };
      window.HTMLDialogElement.prototype.close = function() { this.removeAttribute("open"); };
      window.HTMLCanvasElement.prototype.getContext = () => ({
        clearRect() {},
        drawImage() {},
        fillRect() {},
        getImageData: () => ({ data: new Uint8ClampedArray(4) }),
        putImageData() {}
      });
      window.addEventListener("error", (event) => {
        runtimeErrors.push(event.error || new Error(event.message));
      });
      window.addEventListener("unhandledrejection", (event) => {
        runtimeErrors.push(event.reason || new Error("Promesse rejetée sans gestionnaire"));
      });
    }
  });
  return { dom, runtimeErrors, startupSignals };
}

test("le renderer complet démarre sur Accueil sans exception et quitte l'écran de préparation", async () => {
  const { dom, runtimeErrors } = loadRenderer(rendererSnapshot());

  try {
    await waitUntil(
      () => dom.window.document.querySelectorAll("#navigation .nav-item").length > 0,
      "La navigation n'a pas été rendue."
    );
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.equal(
      runtimeErrors.length,
      0,
      runtimeErrors.map((error) => error.stack || error.message).join("\n")
    );
    assert.notEqual(
      dom.window.document.getElementById("content").textContent.trim(),
      "Préparation de ShenPulse…"
    );
    assert.equal(
      dom.window.document.getElementById("app-version").textContent.trim(),
      `Version : ${packageVersion}`
    );
    const home = dom.window.document.querySelector('#navigation [data-navigate="home"]');
    assert.ok(home, "Accueil est présent dans la navigation");
    assert.equal(home.classList.contains("active"), true, "Accueil est la page par défaut");
    assert.ok(dom.window.document.querySelector(".creator-home-page"));
    assert.equal(dom.window.document.querySelector("#simulator-form"), null);
  } finally {
    dom.window.close();
  }
});

test("l’accueil invité reste public sans révéler les données locales et permet le retour au tableau de bord", async () => {
  const snapshot = rendererSnapshot();
  const sensitive = {
    account: "private_creator_account", profile: "private_profile_name",
    activity: "private_activity_title", source: "private_live_source",
    url: "https://private.example/secret-channel", token: "private_local_overlay_token"
  };
  snapshot.state.settings.tiktok.username = sensitive.account;
  snapshot.state.settings.overlayToken = sensitive.token;
  snapshot.state.profiles[0].name = sensitive.profile;
  snapshot.state.activity = [{ title: sensitive.activity }];
  snapshot.state.connections = [{ id: "private-source", name: sensitive.source, status: "connected" }];
  snapshot.state.statistics.sessionEvents = 987654321;
  snapshot.overlayUrls = { scene: sensitive.url };
  snapshot.localOverlayUrls = { scene: `http://127.0.0.1:17654/?token=${sensitive.token}` };
  const { dom, runtimeErrors } = loadRenderer(snapshot);
  try {
    await waitUntil(() => dom.window.document.querySelector(".creator-home-page"), "L’accueil invité n’est pas rendu.");
    await new Promise((resolve) => setTimeout(resolve, 60));
    const home = dom.window.document.querySelector(".creator-home-page");
    for (const value of Object.values(sensitive)) {
      assert.equal(home.innerHTML.includes(value), false, `${value} ne doit pas apparaître sur l’accueil invité`);
    }
    assert.doesNotMatch(home.textContent, /987654321/);
    assert.equal(home.querySelector("#simulator-form"), null);
    assert.equal(home.querySelector('[data-action="test-action"]'), null);
    assert.ok(home.querySelector('[data-action="account-login"]'), "Le visiteur peut ouvrir la connexion");
    dom.window.document.querySelector('#navigation [data-navigate="dashboard"]').click();
    await waitUntil(() => dom.window.document.querySelector(".guest-dashboard"), "Le dashboard invité n’est pas accessible.");
    assert.equal(dom.window.document.querySelector("#simulator-form"), null);
    for (const value of Object.values(sensitive)) {
      assert.equal(dom.window.document.getElementById("content").innerHTML.includes(value), false);
    }
    dom.window.document.querySelector('#navigation [data-navigate="home"]').click();
    await waitUntil(() => dom.window.document.querySelector(".creator-home-page"), "Le retour vers Accueil échoue.");
    assert.equal(dom.window.document.querySelector('#navigation [data-navigate="home"]').classList.contains("active"), true);
    assert.equal(runtimeErrors.length, 0, runtimeErrors.map((error) => error.stack || error.message).join("\n"));
  } finally { dom.window.close(); }
});

test("une page Accueil masquée respecte la visibilité et démarre sur la première page accessible", async () => {
  const snapshot = rendererSnapshot();
  snapshot.state.settings.siteVisibility = {
    ...snapshot.state.settings.siteVisibility,
    schemaVersion: 8,
    navigation: { home: { scope: "hidden" }, dashboard: { scope: "public" } }
  };
  const { dom, runtimeErrors } = loadRenderer(snapshot);
  try {
    await waitUntil(() => dom.window.document.querySelector('.nav-item.active[data-navigate="dashboard"]'),
      "La navigation ne choisit pas de page accessible quand Accueil est masquée.");
    assert.equal(dom.window.document.querySelector('#navigation [data-navigate="home"]'), null);
    assert.ok(dom.window.document.querySelector(".guest-dashboard"));
    assert.equal(dom.window.document.querySelector(".creator-home-page"), null);
    assert.equal(runtimeErrors.length, 0, runtimeErrors.map((error) => error.stack || error.message).join("\n"));
  } finally { dom.window.close(); }
});

test("le premier rendu caché prépare une connexion utilisable avant le signal, sans attendre les catalogues ni le réseau", async () => {
  const f = loadRenderer(rendererSnapshot(), { hidden: true, configureApi(api) {
    api.searchGifts = () => new Promise(() => {});
    api.account.status = () => new Promise(() => {});
    api.admin.visibility = () => new Promise(() => {});
  } });
  try {
    await waitUntil(() => f.startupSignals.length, "Le premier rendu caché n'a pas été signalé.");
    const signal = f.startupSignals[0];
    assert.equal(signal.dialogOpen, true); assert.equal(signal.variant, "account-auth");
    assert.ok(signal.navigation > 0); assert.match(signal.content, /creator-home-page/);
    assert.doesNotMatch(signal.content, /Préparation de ShenPulse/);
    const email = f.dom.window.document.querySelector('#dialog-body [name="email"]');
    assert.equal(email.disabled, false); assert.equal(email.readOnly, false);
    email.value = "fixture@example.test";
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(email.value, "fixture@example.test");
    assert.equal(f.dom.window.document.activeElement, email);
    assert.equal(f.dom.window.document.querySelectorAll("iframe,video,audio").length, 0);
    assert.equal(f.runtimeErrors.length, 0);
  } finally { f.dom.window.close(); }
});

test("la session locale ouvre directement l'application et une vérification hors ligne ne demande pas la connexion", async () => {
  const snapshot = rendererSnapshot();
  snapshot.state.settings.account = { uid: "fixture-member", email: "fixture@example.test", displayName: "Compte de test" };
  let releaseStatus;
  const f = loadRenderer(snapshot, { configureApi(api) { api.account.status = () => new Promise((resolve) => { releaseStatus = resolve; }); } });
  try {
    await waitUntil(() => releaseStatus && f.startupSignals.length, "Le compte local n'a pas préparé son écran.");
    assert.equal(f.startupSignals[0].dialogOpen, false);
    releaseStatus({ authenticated: true, ...snapshot.state.settings.account, offline: true });
    await waitUntil(() => f.dom.window.eval("accountSession.offline === true"), "La session hors ligne n'est pas conservée.");
    assert.equal(f.dom.window.document.getElementById("editor-dialog").open, false);
    assert.equal(f.startupSignals.length, 1);
    assert.equal(f.runtimeErrors.length, 0);
  } finally { f.dom.window.close(); }
});

test("une session révoquée après le premier rendu ouvre la connexion sans redemander le signal de démarrage", async () => {
  const snapshot = rendererSnapshot(); snapshot.state.settings.account = { uid: "fixture-expired", email: "expired@example.test" };
  let releaseStatus;
  const f = loadRenderer(snapshot, { configureApi(api) { api.account.status = () => new Promise((resolve) => { releaseStatus = resolve; }); } });
  try {
    await waitUntil(() => releaseStatus && f.startupSignals.length, "Le premier rendu est absent.");
    assert.equal(f.startupSignals[0].dialogOpen, false);
    releaseStatus({ authenticated: false, uid: "", email: "" });
    await waitUntil(() => f.dom.window.document.getElementById("editor-dialog").open, "La connexion n'est pas proposée après révocation.");
    assert.equal(f.startupSignals.length, 1);
    assert.equal(f.runtimeErrors.length, 0);
  } finally { f.dom.window.close(); }
});

test("un statut initial tardif conserve le formulaire d'inscription et son brouillon", async () => {
  let releaseStatus;
  const f = loadRenderer(rendererSnapshot(), { configureApi(api) { api.account.status = () => new Promise((resolve) => { releaseStatus = resolve; }); } });
  try {
    await waitUntil(() => releaseStatus && f.startupSignals.length, "La connexion initiale est absente.");
    f.dom.window.document.querySelector('[data-account-command="register"]').click();
    const email = f.dom.window.document.querySelector('#dialog-body [name="email"]');
    const password = f.dom.window.document.querySelector('#dialog-body [name="password"]');
    email.value = "draft@example.test"; password.value = "synthetic-password";
    releaseStatus({ authenticated: false, uid: "", email: "" });
    await new Promise((resolve) => setTimeout(resolve, 70));
    assert.equal(f.dom.window.document.querySelector('#dialog-body [name="email"]'), email);
    assert.equal(email.value, "draft@example.test"); assert.equal(password.value, "synthetic-password");
    assert.ok(f.dom.window.document.querySelector('[name="passwordConfirmation"]'));
    assert.equal(f.startupSignals.length, 1);
    assert.equal(f.runtimeErrors.length, 0);
  } finally { f.dom.window.close(); }
});

test("un statut initial tardif ne déconnecte ni une connexion en cours ni son résultat plus récent", async () => {
  const snapshot = rendererSnapshot(); let releaseStatus, releaseLogin;
  const connected = { authenticated: true, uid: "fixture-new", email: "new@example.test", emailVerified: true };
  const f = loadRenderer(snapshot, { configureApi(api) {
    api.account.status = () => new Promise((resolve) => { releaseStatus = resolve; });
    api.account.login = () => new Promise((resolve) => { releaseLogin = () => {
      snapshot.state.settings.account = { ...connected }; resolve(connected);
    }; });
  } });
  try {
    await waitUntil(() => releaseStatus && f.startupSignals.length, "La connexion n'est pas prête.");
    await new Promise((resolve) => setTimeout(resolve, 50));
    const form = f.dom.window.document.getElementById("editor-form");
    form.querySelector('[name="email"]').value = connected.email;
    form.querySelector('[name="password"]').value = "synthetic-password";
    form.dispatchEvent(new f.dom.window.Event("submit", { bubbles: true, cancelable: true }));
    await waitUntil(() => releaseLogin, "La connexion synthétique n'a pas commencé.");
    releaseStatus({ authenticated: false, uid: "", email: "" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(form.getAttribute("aria-busy"), "true");
    assert.equal(form.querySelector('[name="email"]').value, connected.email);
    releaseLogin();
    await waitUntil(() => f.dom.window.eval("accountSession.uid === 'fixture-new' && accountSession.authenticated"), "La nouvelle connexion a été écrasée.");
    await waitUntil(() => !f.dom.window.document.getElementById("editor-dialog").open, "Le dialogue connecté ne se ferme pas.");
    assert.equal(f.startupSignals.length, 1);
    assert.equal(f.runtimeErrors.length, 0);
  } finally { f.dom.window.close(); }
});

test("un invité qui ferme la connexion n'est pas interrompu une seconde fois par le statut initial", async () => {
  let releaseStatus;
  const f = loadRenderer(rendererSnapshot(), { configureApi(api) { api.account.status = () => new Promise((resolve) => { releaseStatus = resolve; }); } });
  try {
    await waitUntil(() => releaseStatus && f.startupSignals.length, "La connexion n'est pas prête.");
    f.dom.window.document.getElementById("editor-dialog").close();
    releaseStatus({ authenticated: false, uid: "", email: "" });
    await new Promise((resolve) => setTimeout(resolve, 70));
    assert.equal(f.dom.window.document.getElementById("editor-dialog").open, false);
    assert.equal(f.startupSignals.length, 1);
  } finally { f.dom.window.close(); }
});

test("une erreur initiale affiche une page d'erreur réelle et libère aussi l'introduction", async () => {
  const f = loadRenderer(rendererSnapshot(), { configureApi(api) { api.getSnapshot = async () => { throw new Error("Erreur synthétique de préparation"); }; } });
  try {
    await waitUntil(() => f.startupSignals.length, "L'erreur initiale bloque l'introduction.");
    assert.match(f.startupSignals[0].content, /ShenPulse n’a pas pu démarrer/);
    assert.match(f.startupSignals[0].content, /Erreur synthétique/);
    assert.equal(f.startupSignals.length, 1);
    assert.equal(f.runtimeErrors.length, 0);
  } finally { f.dom.window.close(); }
});
