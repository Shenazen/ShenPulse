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

function loadRenderer(snapshot) {
  const htmlFile = path.join(rendererDirectory, "index.html");
  const runtimeErrors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => runtimeErrors.push(error));

  const dom = new JSDOM(fs.readFileSync(htmlFile, "utf8"), {
    url: pathToFileURL(htmlFile).toString(),
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.shenPulse = rendererApi(snapshot);
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
  return { dom, runtimeErrors };
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
