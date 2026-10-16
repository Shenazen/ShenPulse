"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const vm = require("node:vm");
const { OverlayServer } = require("../src/main/overlay-server");
const { matchAccountNumber } = require("../src/main/match-access");
const { selectStatePaths } = require("../src/main/state-projection");
const { getOverlayCodeVersion, versionLocalMatchDocument } = require("../src/main/overlay-code-version");

const loaderSource = fs.readFileSync(path.join(__dirname, "../resources/overlays/runtime/loader.js"), "utf8");
const publicVersion = JSON.parse(fs.readFileSync(path.join(__dirname, "../resources/overlays/runtime-version.json"), "utf8")).version;

/** DOM minimal : les modules sont recensés, jamais exécutés ni diffusés. */
async function collectLoaderUrls(version, source = loaderSource) {
  const nodes = [];
  const context = {
    URLSearchParams,
    encodeURIComponent,
    location: { search: "", pathname: "/match-bridge/123456789012/fixture-channel" },
    performance: { now: () => 0 },
    console,
    document: {
      querySelector: () => version == null ? null : { content: version, getAttribute: () => version },
      createElement: (tagName) => ({ tagName, listeners: {}, addEventListener(event, listener) { this.listeners[event] = listener; } }),
      body: { appendChild(node) { nodes.push(node); queueMicrotask(() => node.listeners.load?.()); } },
      head: { appendChild(node) { nodes.push(node); } },
      documentElement: { classList: { remove() {} }, dataset: {} }
    }
  };
  await vm.runInNewContext(source, context);
  return nodes.map((node) => node.src || node.href);
}

const freePort = () => new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once("error", reject);
  probe.listen(0, "127.0.0.1", () => {
    const port = probe.address().port;
    probe.close(() => resolve(port));
  });
});

function writeFixture(directory, revision) {
  const files = {
    "index.html": `<!doctype html><html><head><meta name="shenpulse-overlay-version" content="${publicVersion}" />
<script data-overlay-base-path>/* ancien calcul de base public */</script>
<script src="runtime/dependencies.js?v=${publicVersion}"></script>
<script src="runtime/loader.js?v=${publicVersion}"></script>
<link rel="stylesheet" href="styles/core.css?v=${publicVersion}" />
<link rel="preload" href="fonts/test.woff2?v=${publicVersion}" as="font" /></head><body></body></html>`,
    "runtime/loader.js": loaderSource,
    "runtime/dependencies.js": "/* dépendances inchangées */",
    "runtime/widgets/match.js": `globalThis.fixtureRevision = ${JSON.stringify(revision)};`,
    "styles/core.css": "html { background: transparent; }",
    "fonts/test.woff2": "fixture-font"
  };
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(directory, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
}

function fixtureServer(staticDirectory, ports) {
  const state = {
    settings: { overlayPort: ports.overlay, apiPort: ports.api, overlayToken: "fixture-overlay-token", apiToken: "fixture-api-token",
      account: { uid: "fixture-cache-account", email: "fixture@example.invalid", refreshTokenSecretId: "fixture-secret" },
      matchAccess: { accessKey: "a".repeat(32) }, publicOverlayRelay: { matchChannelId: "m".repeat(24) } },
    session: { profileId: "fixture-profile" }, commerce: { subscription: { tier: "pro", status: "active" } }
  };
  const store = { getStateProjection: (keys) => selectStatePaths(state, keys), getSecret: () => "fixture-refresh" };
  const server = new OverlayServer({ store, staticDirectory, onInboundEvent: async () => {}, onEffectRequest: async () => ({}) });
  const base = `http://127.0.0.1:${ports.overlay}`;
  const source = `${base}/match-bridge/${matchAccountNumber(state.settings.account.uid)}/${state.settings.publicOverlayRelay.matchChannelId}`;
  return { server, base, source };
}

test("Studio ne conserve pas le moteur Match périmé après une relance sur le même port et la même version applicative", { timeout: 15000 }, async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-match-code-cache-"));
  const ports = { overlay: await freePort(), api: await freePort() };
  const cache = new Map();
  const documents = [];
  const results = [];
  let active;
  // Cache navigateur déterministe : un contenu immutable reste conservé sous
  // son URL exacte, sans revalidation, même si le serveur a redémarré.
  const browserRead = async (url) => {
    if (cache.has(url)) return cache.get(url);
    const response = await fetch(url, { headers: { Connection: "close" } });
    assert.equal(response.status, 200);
    const text = await response.text();
    if (/immutable/.test(response.headers.get("cache-control") || "")) cache.set(url, text);
    return text;
  };
  try {
    for (const revision of ["première-version", "version-corrigée"]) {
      const staticDirectory = path.join(directory, revision);
      writeFixture(staticDirectory, revision);
      active = fixtureServer(staticDirectory, ports);
      await active.server.start();
      const response = await fetch(active.source, { headers: { Connection: "close" } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const html = await response.text();
      const version = /name="shenpulse-overlay-version"\s+content="([^"]+)"/.exec(html)?.[1];
      const loader = /src="(runtime\/loader\.js[^\"]*)"/.exec(html)?.[1];
      assert.ok(version);
      assert.ok(loader);
      documents.push({ html, version, loader });
      const servedLoader = await browserRead(new URL(loader, `${active.base}/overlay/`).href);
      const urls = await collectLoaderUrls(version, servedLoader);
      const module = urls.find((url) => url.startsWith("runtime/widgets/match.js?"));
      assert.ok(module);
      results.push(await browserRead(new URL(module, `${active.base}/overlay/`).href));
      const ordinary = await fetch(`${active.base}/overlay/?token=fixture-overlay-token`, { headers: { Connection: "close" } });
      assert.equal(ordinary.status, 200);
      assert.equal(await ordinary.text(), fs.readFileSync(path.join(staticDirectory, "index.html"), "utf8"), "les autres overlays ne sont pas réécrits");
      await active.server.stop();
      active = null;
    }
    assert.match(results[0], /première-version/);
    assert.match(results[1], /version-corrigée/, "une URL immutable réutilisée sert l'ancien moteur au lieu de la correction");
    assert.notEqual(documents[1].version, documents[0].version);
    assert.notEqual(documents[1].loader, documents[0].loader);
    for (const { html, version } of documents) {
      assert.match(version, /^match-local-[a-f0-9]+$/);
      for (const [, url] of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css|woff2?)(?:\?[^"]*)?)"/g)) {
        assert.equal(new URL(url, "http://fixture.invalid/overlay/").searchParams.get("v"), version);
      }
    }
  } finally {
    await active?.server.stop();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("le chargeur propage la version du document à tous les modules et au CSS Match", async () => {
  const version = "match-local-fixture + spécial";
  const urls = await collectLoaderUrls(version);
  assert.ok(urls.some((url) => url.startsWith("styles/match-player.css?")));
  assert.ok(urls.some((url) => url.startsWith("runtime/widgets/match.js?")));
  assert.ok(urls.length > 10);
  for (const url of urls) {
    assert.equal(new URL(url, "http://fixture.invalid/overlay/").searchParams.get("v"), version);
    assert.ok(url.endsWith(`?v=${encodeURIComponent(version)}`));
  }
});

test("sans métadonnée locale, le chargeur garde la version publique distribuée", async () => {
  const urls = await collectLoaderUrls(null);
  assert.ok(urls.length > 10);
  for (const url of urls) assert.equal(new URL(url, "https://fixture.invalid/").searchParams.get("v"), publicVersion);
});

test("l'empreinte est déterministe, couvre tous les moteurs et ignore les vidéos ou données privées", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-match-code-scope-"));
  try {
    const baseline = path.join(directory, "baseline");
    writeFixture(baseline, "même-révision");
    const version = getOverlayCodeVersion(baseline);
    assert.match(version, /^match-local-[a-f0-9]{24}$/);
    const ignored = path.join(directory, "ignored");
    fs.cpSync(baseline, ignored, { recursive: true });
    for (const relative of ["media/video/protected.webm", "private/account.js", "settings.json", "runtime/private.json", "fonts/test.woff2"]) {
      const target = path.join(ignored, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, "ne doit jamais participer à l'empreinte du code");
    }
    assert.equal(getOverlayCodeVersion(ignored), version);
    for (const relative of ["index.html", "root-runtime.js", "catalog/test.js", "runtime/widgets/match.js", "styles/core.css", "vendor/nested/test.js"]) {
      const changed = path.join(directory, relative.replaceAll(/[/.]/g, "-"));
      fs.cpSync(baseline, changed, { recursive: true });
      const target = path.join(changed, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.appendFileSync(target, "/* moteur corrigé */");
      assert.notEqual(getOverlayCodeVersion(changed), version, relative);
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("l'empreinte du paquet est mémorisée pendant le processus, pas recalculée à chaque requête", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-match-code-memo-"));
  try {
    writeFixture(directory, "paquet-immuable");
    const first = getOverlayCodeVersion(directory);
    fs.appendFileSync(path.join(directory, "runtime/widgets/match.js"), "/* modification après chargement */");
    assert.equal(getOverlayCodeVersion(directory), first);
    assert.equal(getOverlayCodeVersion(path.join(directory, ".")), first);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("la réécriture HTML reste locale et préserve les autres paramètres et fragments", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-match-code-html-"));
  try {
    writeFixture(directory, "test-html");
    const version = getOverlayCodeVersion(directory);
    const html = `<html><head><script src='runtime/loader.js?view=match&v=ancien#fin'></script>
<link href="/overlay/styles/core.css?theme=dark#css" rel="stylesheet">
<link href="fonts/test.woff2" rel="preload">
<script src="https://cdn.example.invalid/external.js?v=externe"></script>
<link href="//cdn.example.invalid/external.css?v=externe">
<img src="media/image.png?v=image"></head></html>`;
    const rendered = versionLocalMatchDocument(html, directory);
    assert.match(rendered, new RegExp(`name="shenpulse-overlay-version" content="${version}"`));
    assert.ok(rendered.includes(`runtime/loader.js?view=match&v=${version}#fin`));
    assert.ok(rendered.includes(`/overlay/styles/core.css?theme=dark&v=${version}#css`));
    assert.ok(rendered.includes(`fonts/test.woff2?v=${version}`));
    assert.ok(rendered.includes("https://cdn.example.invalid/external.js?v=externe"));
    assert.ok(rendered.includes("//cdn.example.invalid/external.css?v=externe"));
    assert.ok(rendered.includes("media/image.png?v=image"));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
