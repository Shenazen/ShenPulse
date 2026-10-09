"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { JSDOM } = require("jsdom");

const catalogSource = fs.readFileSync(
  path.join(
    __dirname,
    "..",
    "src",
    "renderer",
    "app",
    "features",
    "overlays",
    "catalog.js"
  ),
  "utf8"
);

test("précharge et réutilise les iframes overlay avant d'ouvrir la galerie", () => {
  const dom = new JSDOM("<!doctype html><body><main id='content'></main></body>", {
    runScripts: "outside-only",
    url: "http://127.0.0.1:41738/"
  });
  const { window } = dom;
  const items = [
    {
      key: "likeGoal",
      name: "Like Goal",
      previewView: "like-goal",
      sourceSize: [1300, 200]
    },
    {
      key: "timer",
      name: "Timer",
      previewView: "timer",
      sourceSize: [900, 360]
    },
    {
      key: "winCounter",
      name: "Compteur de wins",
      previewView: "win-counter",
      sourceSize: [900, 360]
    },
    {
      key: "matchX2",
      name: "Match X2",
      previewKind: "match",
      previewView: "match",
      sourceSize: [1080, 1920]
    }
  ];

  window.snapshot = {
    localOverlayUrls: {
      likeGoal: "http://127.0.0.1:17654/overlay/?view=like-goal&token=test",
      timer: "http://127.0.0.1:17654/overlay/?view=timer&token=test",
      winCounter: "http://127.0.0.1:17654/overlay/?view=win-counter&token=test",
      matchX2: "http://127.0.0.1:17654/overlay/?view=match&match=x2&token=test"
    },
    overlayUrls: {},
    previewOverlayUrls: {},
    state: {
      settings: {
        overlayConfigs: {},
        overlayToken: "test"
      }
    }
  };
  window.overlayCatalog = {
    configParameterMappings: {},
    defaultConfig: () => ({}),
    definitionsWithUrls: () => items
  };
  window.normalizeWheelConfig = (value) => value;
  window.overlaySourceSize = (item) => ({
    height: item.sourceSize[1],
    width: item.sourceSize[0]
  });
  window.escapeHtml = (value) => String(value || "");
  window.canAccessOverlay = () => true;
  window.isAccountAuthenticated = () => true;
  window.hasProAccess = () => true;
  window.content = window.document.getElementById("content");
  window.hydrateOverlayPreviewFrame = () => {};

  window.eval(`${catalogSource}
    window.__overlayWarmupTest = {
      adopt: adoptWarmedOverlayPreview,
      cacheSize: () => overlayBackgroundPreviewCache.size,
      clearTimer: () => clearTimeout(overlayPreviewWarmupTimer),
      preserve: preserveOverlayRuntimeFrames,
      warm: warmOverlayRuntimePreviews
    };
  `);
  window.__overlayWarmupTest.warm();

  const host = window.document.querySelector(
    "[data-overlay-preview-warmup-host]"
  );
  assert.ok(host);
  assert.equal(
    window.__overlayWarmupTest.cacheSize(),
    items.length - 1
  );
  assert.equal(host.querySelectorAll("iframe").length, 2);

  const warmedFrame = host.querySelector("iframe");
  const runtimeFrame = window.document.createElement("div");
  runtimeFrame.dataset.overlayNativeFrame = "true";
  runtimeFrame.dataset.overlayPreviewKey = warmedFrame.dataset.overlayPreviewKey;
  runtimeFrame.innerHTML = `<iframe data-overlay-runtime-preview="true" data-overlay-src="${warmedFrame.src}" src="about:blank"></iframe>`;
  window.content.appendChild(runtimeFrame);
  const adoptedFrame = window.__overlayWarmupTest.adopt(runtimeFrame);
  assert.equal(adoptedFrame, warmedFrame);
  assert.equal(runtimeFrame.querySelector("iframe"), warmedFrame);

  window.__overlayWarmupTest.preserve(window.content);
  assert.equal(host.querySelector(`[data-overlay-preview-key="${warmedFrame.dataset.overlayPreviewKey}"]`), warmedFrame);
  window.__overlayWarmupTest.clearTimer();
  dom.window.close();
});
