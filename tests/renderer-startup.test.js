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

test("le renderer complet démarre sans exception et quitte l'écran de préparation", async () => {
  const htmlFile = path.join(rendererDirectory, "index.html");
  const runtimeErrors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => runtimeErrors.push(error));

  const snapshot = rendererSnapshot();
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
  } finally {
    dom.window.close();
  }
});
