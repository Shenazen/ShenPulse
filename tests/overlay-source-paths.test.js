"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");
const { JSDOM, VirtualConsole } = require("jsdom");

const directory = path.resolve(__dirname, "../resources/overlays");
const index = fs.readFileSync(path.join(directory, "index.html"), "utf8");
const loader = fs.readFileSync(path.join(directory, "runtime/loader.js"), "utf8");
const VERSION = JSON.parse(fs.readFileSync(path.join(directory, "runtime-version.json"), "utf8")).version;

/** JSDOM ne charge aucune ressource externe ; seuls le guard réel et le loader sont exécutés. */
async function loadSource(t, url, { injectedBase = "" } = {}) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => errors.push(error));
  const html = injectedBase ? index.replace("<head>", `<head>\n    <base href="${injectedBase}" />`) : index;
  const dom = new JSDOM(html, { url, runScripts: "dangerously", virtualConsole });
  t.after(() => dom.window.close());
  const generated = [];
  const append = dom.window.document.body.appendChild.bind(dom.window.document.body);
  dom.window.document.body.appendChild = (node) => {
    generated.push(node);
    const result = append(node);
    queueMicrotask(() => node.dispatchEvent(new dom.window.Event("load")));
    return result;
  };
  dom.window.eval(loader);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(errors, []);
  return { window: dom.window, generated };
}

function assertAssets(window, expectedBase) {
  const document = window.document;
  assert.equal(document.baseURI, expectedBase);
  assert.equal(document.querySelectorAll("base").length, 1);
  assert.equal(document.querySelector('meta[name="shenpulse-overlay-version"]').content, VERSION);
  assert.equal(document.querySelector('script[src^="runtime/loader.js"]').src, `${expectedBase}runtime/loader.js?v=${VERSION}`);
  assert.equal(document.querySelector('script[src^="runtime/dependencies.js"]').src, `${expectedBase}runtime/dependencies.js?v=${VERSION}`);
  assert.equal(document.querySelector('link[rel="preload"][as="font"]').href, `${expectedBase}fonts/inter-latin-wght-normal.woff2?v=${VERSION}`);
  for (const stylesheet of document.querySelectorAll('link[rel="stylesheet"]')) {
    assert.ok(stylesheet.href.startsWith(`${expectedBase}styles/`), stylesheet.href);
    assert.equal(new URL(stylesheet.href).searchParams.get("v"), VERSION);
  }
  for (const script of document.querySelectorAll("script[src]")) {
    assert.ok(script.src.startsWith(expectedBase), script.src);
    assert.equal(new URL(script.src).searchParams.get("v"), VERSION);
  }
}

test("sources overlays : la racine publique conserve ses assets à la racine", async (t) => {
  const { window } = await loadSource(t, "https://shenpulse-overlays.web.app/?view=timer&channel=fixture");
  assertAssets(window, "https://shenpulse-overlays.web.app/");
  assert.equal(window.shenPulseOverlayPerformance.view, "timer");
  assert.equal(window.document.querySelector('script[src^="runtime/widgets/timers.js"]').src, `https://shenpulse-overlays.web.app/runtime/widgets/timers.js?v=${VERSION}`);
});

test("sources overlays : l'alias HTTPS Matchs widget ne charge jamais /m/compte/runtime", async (t) => {
  const { window } = await loadSource(t, "https://shenpulse-overlays.web.app/m/123456789012/fixture_channel?widget=wins");
  assertAssets(window, "https://shenpulse-overlays.web.app/");
  assert.equal(window.shenPulseOverlayPerformance.view, "match-widget");
  assert.equal(window.document.querySelector('script[src^="runtime/widgets/match-widgets.js"]').src, `https://shenpulse-overlays.web.app/runtime/widgets/match-widgets.js?v=${VERSION}`);
  assert.equal(window.document.querySelector('link[href^="styles/match-widgets.css"]').href, `https://shenpulse-overlays.web.app/styles/match-widgets.css?v=${VERSION}`);
  assert.equal(window.document.querySelector('script[src^="runtime/widgets/match.js"]'), null);
  for (const node of window.document.querySelectorAll("script[src],link[rel='stylesheet']")) assert.doesNotMatch(node.src || node.href, /\/m\/123456789012\//);
});

test("sources overlays : l'alias HTTPS du lecteur Match garde ses assets publics", async (t) => {
  const { window } = await loadSource(t, "https://shenpulse-overlays.web.app/m/123456789012/fixture_channel");
  assertAssets(window, "https://shenpulse-overlays.web.app/");
  assert.equal(window.shenPulseOverlayPerformance.view, "match");
  assert.equal(window.document.querySelector('script[src^="runtime/widgets/match.js"]').src, `https://shenpulse-overlays.web.app/runtime/widgets/match.js?v=${VERSION}`);
  assert.equal(window.document.querySelector('script[src^="runtime/widgets/match-widgets.js"]'), null);
});

test("sources overlays : les sources locales /overlay/ restent compatibles", async (t) => {
  const { window } = await loadSource(t, "http://127.0.0.1:17654/overlay/?view=match-widget&widget=wins&token=fixture");
  assertAssets(window, "http://127.0.0.1:17654/overlay/");
  assert.equal(window.shenPulseOverlayPerformance.view, "match-widget");
  assert.equal(window.document.querySelector('script[src^="runtime/widgets/match-widgets.js"]').src, `http://127.0.0.1:17654/overlay/runtime/widgets/match-widgets.js?v=${VERSION}`);
});

test("sources overlays : la base injectée par le serveur Match local est conservée", async (t) => {
  const { window } = await loadSource(t, "http://127.0.0.1:17654/match/123456789012/fixture_channel", { injectedBase: "/overlay/" });
  assertAssets(window, "http://127.0.0.1:17654/overlay/");
  assert.equal(window.shenPulseOverlayPerformance.view, "match");
  assert.equal(window.document.querySelector('script[src^="runtime/widgets/match.js"]').src, `http://127.0.0.1:17654/overlay/runtime/widgets/match.js?v=${VERSION}`);
});

test("sources overlays : les aperçus file gardent les assets à côté du document", async (t) => {
  const url = pathToFileURL(path.join(directory, "index.html"));
  url.search = "?view=match-widget&widget=wins&preview=static&native=1";
  const { window } = await loadSource(t, url.href);
  assert.equal(window.document.querySelector("base"), null);
  assert.equal(window.document.querySelector('script[src^="runtime/loader.js"]').src, new URL(`runtime/loader.js?v=${VERSION}`, url).href);
  assert.equal(window.document.querySelector('script[src^="runtime/widgets/match-widgets.js"]').src, new URL(`runtime/widgets/match-widgets.js?v=${VERSION}`, url).href);
});

test("sources overlays : le lecteur Studio local garde tous ses assets sur la même origine", async (t) => {
  const { window } = await loadSource(t, "http://127.0.0.1:17654/match-bridge/123456789012/studio_fixture_capability_123456789");
  assertAssets(window, "http://127.0.0.1:17654/overlay/");
  assert.equal(window.shenPulseOverlayPerformance.view, "match");
  assert.equal(window.document.querySelector('script[src^="runtime/widgets/match-progress.js"]').src, `http://127.0.0.1:17654/overlay/runtime/widgets/match-progress.js?v=${VERSION}`);
  assert.equal(window.document.querySelector('script[src^="runtime/widgets/match.js"]').src, `http://127.0.0.1:17654/overlay/runtime/widgets/match.js?v=${VERSION}`);
});
