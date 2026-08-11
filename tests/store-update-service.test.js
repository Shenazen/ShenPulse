"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  STORE_UPDATES_URI,
  StoreUpdateService
} = require("../src/main/store-update-service");

function createService({ bridge, packaged = true, now = () => 1000 } = {}) {
  const opened = [];
  return {
    opened,
    service: new StoreUpdateService({
      app: { isPackaged: packaged },
      shell: {
        openExternal: async (url) => opened.push(url)
      },
      nativeBridge: bridge,
      now,
      timeoutMs: 1000
    })
  };
}

test("détecte une mise à jour réellement renvoyée par Microsoft Store", async () => {
  let checks = 0;
  const { service } = createService({
    bridge: {
      checkForUpdates: async () => {
        checks += 1;
        return {
          supported: true,
          available: true,
          mandatory: false,
          packageCount: 1,
          packageVersion: "1.0.11.0",
          state: "available"
        };
      }
    }
  });

  const first = await service.check();
  const cached = await service.check();

  assert.equal(first.available, true);
  assert.equal(first.packageVersion, "1.0.11.0");
  assert.equal(cached.available, true);
  assert.equal(checks, 1);
});

test("reste silencieux hors du package Microsoft Store", async () => {
  const { service } = createService({ packaged: false });
  const status = await service.check();

  assert.equal(status.supported, false);
  assert.equal(status.available, false);
  assert.equal(status.state, "development");
});

test("ouvre la page des mises à jour si l’installation silencieuse est indisponible", async () => {
  const { service, opened } = createService({
    bridge: {
      checkForUpdates: async () => ({
        supported: true,
        available: true,
        packageCount: 1,
        state: "available"
      }),
      installUpdatesSilently: async () => ({
        supported: true,
        available: true,
        state: "store-required",
        reason: "silent-install-unavailable"
      })
    }
  });

  const result = await service.install();

  assert.equal(result.openedStore, true);
  assert.deepEqual(opened, [STORE_UPDATES_URI]);
});

test("garde le Store comme secours si la seconde vérification réseau échoue", async () => {
  const { service, opened } = createService({
    bridge: {
      checkForUpdates: async () => ({
        supported: false,
        available: false,
        state: "unavailable",
        reason: "network-error"
      }),
      installUpdatesSilently: async () => ({})
    }
  });

  const result = await service.install();

  assert.equal(result.openedStore, true);
  assert.deepEqual(opened, [STORE_UPDATES_URI]);
});

test("embarque le pont natif WinRT dans chaque build Windows", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")
  );
  const source = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "native",
      "store-update",
      "src",
      "store_update.cc"
    ),
    "utf8"
  );

  assert.match(packageJson.scripts["build:store"], /native:store-update/);
  assert.ok(
    packageJson.build.asarUnpack.includes("resources/store-update/**")
  );
  assert.match(source, /GetAppAndOptionalStorePackageUpdatesAsync/);
  assert.match(source, /TrySilentDownloadAndInstallStorePackageUpdatesAsync/);
});

test("affiche le bandeau uniquement après la réponse positive du Store", () => {
  const root = path.join(__dirname, "..");
  const html = fs.readFileSync(
    path.join(root, "src", "renderer", "index.html"),
    "utf8"
  );
  const renderer = fs.readFileSync(
    path.join(root, "src", "renderer", "app.js"),
    "utf8"
  );
  const preload = fs.readFileSync(
    path.join(root, "src", "main", "preload.js"),
    "utf8"
  );
  const ipc = fs.readFileSync(
    path.join(root, "src", "main", "ipc.js"),
    "utf8"
  );

  assert.match(html, /id="store-update-banner"[\s\S]*hidden/);
  assert.match(renderer, /storeUpdateStatus\?\.available === true/);
  assert.match(renderer, /api\.updates[\s\S]*\.check\(\{ force \}\)/);
  assert.match(renderer, /api\.updates\.install\(\)/);
  assert.match(preload, /invoke\("updates:check"/);
  assert.match(ipc, /storeUpdateService\.check/);
});
