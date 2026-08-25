"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const overlayCatalog = require("../resources/overlays/overlay-catalog");

const root = path.join(__dirname, "..");

test("le manifeste décrit chaque overlay une seule fois avec un contrat maintenable", () => {
  const keys = overlayCatalog.definitions.map((definition) => definition.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(overlayCatalog.manifests.length, overlayCatalog.definitions.length);
  assert.equal(overlayCatalog.matches.length, 8);
  for (const definition of overlayCatalog.definitions) {
    assert.ok(definition.key);
    assert.ok(definition.name);
    assert.ok(definition.description);
    assert.ok(definition.route?.view);
    assert.equal(overlayCatalog.manifest(definition.key)?.definition.key, definition.key);
    if (definition.catalogHidden) continue;
    assert.ok(definition.category);
    assert.ok(definition.icon);
    assert.ok(definition.sourceSize?.every(Number.isFinite));
    assert.ok(Array.isArray(overlayCatalog.settingsFor(definition.key)));
  }
});

test("les valeurs d'un overlay sont isolées dans son manifeste", () => {
  const likeGoal = overlayCatalog.defaultConfig("likeGoal");
  const coinJar = overlayCatalog.defaultConfig("coinJar");
  likeGoal.title = "MODIFICATION LOCALE";
  likeGoal.target = 1;

  assert.equal(overlayCatalog.defaultConfig("likeGoal").title, "LIKE GOAL");
  assert.equal(overlayCatalog.defaultConfig("likeGoal").target, 50000);
  assert.equal(coinJar.title, "COIN JAR");
  assert.equal(coinJar.target, 1000);
  assert.deepEqual(overlayCatalog.settingsFor("match"), [
    "variant", "fit", "autoplay", "loop"
  ]);
});

test("le manifeste construit les routes locales et publiques sans exposer les Matchs", () => {
  const local = overlayCatalog.buildUrls({
    baseUrl: "http://127.0.0.1:19127",
    credentialName: "token",
    credentialValue: "secret",
    proAccess: true
  });
  const publicUrls = overlayCatalog.buildUrls({
    baseUrl: "https://overlay.example.test",
    credentialName: "channel",
    credentialValue: "public-channel",
    proAccess: true,
    publicDelivery: true
  });

  assert.match(local.matchPlayer, /view=match/);
  assert.match(local.matchPlayer, /match=player/);
  assert.match(local.matchX2, /match=x2/);
  assert.equal(publicUrls.matchPlayer, "");
  assert.equal(publicUrls.matchX2, "");
  assert.match(publicUrls.likeGoal, /^https:\/\/overlay\.example\.test\/\?/);
  assert.doesNotMatch(JSON.stringify(publicUrls), /token|127\.0\.0\.1/);
});

test("le serveur, le renderer, le relais et le runtime consomment le même domaine", () => {
  const sources = {
    renderer: fs.readFileSync(
      path.join(root, "src", "renderer", "app", "features", "overlays", "catalog.js"),
      "utf8"
    ),
    server: fs.readFileSync(path.join(root, "src", "main", "overlay-server.js"), "utf8"),
    protocol: fs.readFileSync(
      path.join(root, "src", "shared", "public-overlay-protocol.js"),
      "utf8"
    ),
    runtime: fs.readFileSync(
      path.join(root, "resources", "overlays", "runtime", "transport.js"),
      "utf8"
    )
  };

  assert.match(sources.renderer, /overlayCatalog\.definitionsWithUrls/);
  assert.match(sources.server, /overlayCatalog\.buildUrls/);
  assert.match(sources.server, /overlayCatalog\.acceptsChannel/);
  assert.match(sources.protocol, /overlayCatalog\.buildUrls/);
  assert.match(sources.runtime, /overlayCatalog\.acceptsChannel/);
});

test("les modules restent bornés pour empêcher le retour des monolithes", () => {
  const limits = [
    [path.join(root, "src", "renderer", "app"), ".js", 800],
    [path.join(root, "resources", "overlays", "catalog"), ".js", 250],
    [path.join(root, "resources", "overlays", "runtime"), ".js", 800],
    [path.join(root, "src", "renderer", "styles"), ".css", 1200],
    [path.join(root, "resources", "overlays", "styles"), ".css", 1200]
  ];
  for (const [directory, extension, maximumLines] of limits) {
    const pending = [directory];
    while (pending.length) {
      const current = pending.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const target = path.join(current, entry.name);
        if (entry.isDirectory()) pending.push(target);
        if (!entry.isFile() || path.extname(entry.name) !== extension) continue;
        const lines = fs.readFileSync(target, "utf8").split(/\r?\n/).length;
        assert.ok(
          lines <= maximumLines,
          `${path.relative(root, target)} contient ${lines} lignes (maximum ${maximumLines})`
        );
      }
    }
  }
});
