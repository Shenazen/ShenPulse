"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const test = require("node:test");
const overlayCatalog = require("../resources/overlays/overlay-catalog");
const {
  MatchVideoCache,
  resolveMatchVideo,
  safeFilePart
} = require("../src/main/match-video-export");

const resourcesDirectory = path.join(__dirname, "..", "resources");

function temporaryCacheRoot() {
  return path.join(
    os.tmpdir(),
    `shenpulse-match-video-test-${randomUUID()}`
  );
}

test("les huit overlays Match exposent une vidéo WebM TikControl", () => {
  assert.equal(overlayCatalog.matches.length, 8);
  for (const match of overlayCatalog.matches) {
    const video = resolveMatchVideo(resourcesDirectory, {
      key: match.key,
      variant: "tikcontrol"
    });
    assert.equal(video.key, match.key);
    assert.equal(video.match, match.match);
    assert.match(video.defaultFileName, /^ShenPulse-.+-TikControl\.webm$/);
    assert.equal(path.extname(video.sourcePath), ".webm");
    assert.ok(fs.statSync(video.sourcePath).size > 1000);
  }
});

test("les quinze variantes vidéo déclarées existent dans le paquet", () => {
  const videos = overlayCatalog.definitions
    .filter((definition) => definition.previewKind === "match")
    .flatMap((definition) =>
      definition.options.map(([variant]) =>
        resolveMatchVideo(resourcesDirectory, {
          key: definition.key,
          variant
        })
      )
    );

  assert.equal(videos.length, 15);
  assert.equal(new Set(videos.map((video) => video.sourcePath)).size, 15);
});

test("le cache Match prépare puis supprime définitivement les vidéos à la perte d'accès", async (t) => {
  const root = temporaryCacheRoot();
  const cacheDirectory = path.join(root, "ShenPulse", "match-videos");
  let allowed = true;
  const cache = new MatchVideoCache({
    resourcesDirectory,
    cacheDirectory,
    hasAccess: () => allowed
  });
  t.after(async () => {
    cache.dispose();
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  const result = await cache.prepare({
    key: "matchX2",
    variant: "tikcontrol"
  });
  assert.equal(result.temporary, true);
  assert.equal(path.dirname(result.filePath), cacheDirectory);
  assert.ok(fs.statSync(result.filePath).size > 1000);

  allowed = false;
  const reconciliation = await cache.reconcile();
  assert.deepEqual(reconciliation, { allowed: false, cleared: true });
  assert.equal(fs.existsSync(cacheDirectory), false);
  await assert.rejects(
    cache.prepare({ key: "matchX2", variant: "tikcontrol" }),
    /Pro ou Premium actif/
  );
});

test("un fichier Match encore verrouillé n'empêche pas ShenPulse de démarrer", async () => {
  const busyError = new Error("locked by streaming software");
  busyError.code = "EBUSY";
  const cache = new MatchVideoCache({
    resourcesDirectory,
    cacheDirectory: path.join(os.tmpdir(), "ShenPulse", "match-videos"),
    hasAccess: () => false,
    removeDirectory: async () => {
      throw busyError;
    }
  });

  assert.deepEqual(await cache.reconcile(), {
    allowed: false,
    cleared: false,
    pending: true
  });
  await assert.rejects(
    cache.prepare({ key: "matchX2", variant: "tikcontrol" }),
    /Pro ou Premium actif/
  );
});

test("la résolution Match refuse les clés et designs non déclarés", () => {
  assert.throws(
    () => resolveMatchVideo(resourcesDirectory, {
      key: "../../matchX2",
      variant: "tikcontrol"
    }),
    /introuvable/
  );
  assert.throws(
    () => resolveMatchVideo(resourcesDirectory, {
      key: "matchEnigma",
      variant: "gladiador"
    }),
    /pas disponible/
  );
  assert.equal(safeFilePart("Match Cœur du jour"), "Match-Coeur-du-jour");
});

test("le pont Electron prépare le cache uniquement derrière l'accès compte", () => {
  const ipc = fs.readFileSync(
    path.join(__dirname, "..", "src", "main", "ipc.js"),
    "utf8"
  );
  const preload = fs.readFileSync(
    path.join(__dirname, "..", "src", "main", "preload.js"),
    "utf8"
  );
  const packageJson = require("../package.json");
  const guestChannels = ipc.slice(
    ipc.indexOf("const guestAllowedChannels"),
    ipc.indexOf("const handle =", ipc.indexOf("const guestAllowedChannels"))
  );

  assert.match(ipc, /handle\("overlay:match-video-prepare"/);
  assert.match(ipc, /matchVideoCache\.prepare\(incoming\)/);
  assert.doesNotMatch(guestChannels, /overlay:match-video-prepare/);
  assert.match(preload, /invoke\("overlay:match-video-prepare", options\)/);
  assert.ok(
    packageJson.build.asarUnpack.includes("resources/overlays/media/video/**")
  );
});
