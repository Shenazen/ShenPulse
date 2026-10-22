"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { GAME_INSTALLERS } = require("../src/main/game-installer-manifest");
const { downloadAsset } = require("../src/main/game-runtime/asset-download");
const publication = require("../scripts/manifests/game-packs.json");

test("les packs migrés gardent exactement leurs versions et empreintes sur Backblaze", () => {
  assert.equal(publication.assets.length, 14);
  const keys = new Set();
  for (const entry of publication.assets) {
    const installer = GAME_INSTALLERS[entry.gameId];
    const asset = installer.assets.find(asset => asset.id === entry.id);
    // L’installateur peut évoluer pour configurer un port local sans remplacer
    // l’archive distante dont l’URL, la taille et l’empreinte restent figées.
    const localRevisions = { "euro-truck-simulator-2": "1.0.5", "blue-prince": "1.0.1", "resident-evil-3": "2.1.4", "fallout-4": "1.0.1" };
    assert.equal(installer.version, localRevisions[entry.gameId] || entry.version);
    assert.equal(asset.url, `https://f003.backblazeb2.com/file/shenpulse-media/${entry.key}`);
    assert.equal(asset.size, entry.size);
    assert.equal(asset.sha256, entry.sha256);
    assert.ok(!keys.has(entry.key)); keys.add(entry.key);
  }
  for (const installer of Object.values(GAME_INSTALLERS)) for (const asset of installer.assets || []) {
    assert.equal(asset.bundledPath, undefined);
    assert.doesNotMatch(asset.url || "", /crowdcontrol\.live/);
  }
  assert.ok(require("../package.json").build.files.includes("!resources/installer-assets/**"));
});

test("les archives compilées restent hors du dépôt, y compris après une compilation locale", async () => {
  const root = path.resolve(__dirname, "..");
  const files = await fs.readdir(path.join(root, "resources/installer-assets"), { recursive: true, withFileTypes: true });
  assert.ok(!files.some(file => file.isFile() && /\.(zip|dll|exe|jar)$/i.test(file.name)));
  for (const entry of publication.assets) {
    assert.equal(entry.sourcePath, undefined);
    if (entry.buildPath) assert.ok(entry.buildPath.startsWith(".artifacts/game-pack-builds/"));
  }
  const { gamePackCacheRoot } = require("../scripts/lib/game-pack-cache");
  const relative = path.relative(root, gamePackCacheRoot());
  assert.ok(relative.startsWith("..") || path.isAbsolute(relative));
});

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "shenpulse-download-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const bytes = Buffer.from("versioned game module");
  const asset = { id: "mod", url: "https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/test/1.0.0/mod.zip", size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex") };
  const destination = path.join(directory, "mod.zip");
  const runtime = { progress() {} };
  return { directory, bytes, asset, destination, runtime };
}

test("un transfert vérifié est publié seulement après sa réception complète", async t => {
  const { bytes, asset, destination, runtime } = await fixture(t);
  await downloadAsset(runtime, "test", asset, destination, { fetchImpl: async () => new Response(bytes) });
  assert.deepEqual(await fs.readFile(destination), bytes);
  await assert.rejects(fs.access(`${destination}.partial`));
});

test("coupure, archive tronquée et corruption nettoient le fichier partiel et permettent de réessayer", async t => {
  const { bytes, asset, destination, runtime } = await fixture(t);
  const invalidResponses = [
    () => new Response(bytes.subarray(0, 3)),
    () => new Response(Buffer.alloc(bytes.length)),
    () => new Response(new ReadableStream({ start(controller) {
      controller.enqueue(bytes.subarray(0, 3));
      controller.error(new TypeError("Connection lost"));
    } }))
  ];
  for (const response of invalidResponses) {
    await assert.rejects(downloadAsset(runtime, "test", asset, destination, { fetchImpl: async () => response() }));
    await assert.rejects(fs.access(destination));
    await assert.rejects(fs.access(`${destination}.partial`));
  }
  await downloadAsset(runtime, "test", asset, destination, { fetchImpl: async () => new Response(bytes) });
  assert.deepEqual(await fs.readFile(destination), bytes);
});

test("un téléchargement concurrent ne supprime pas le fichier partiel d’une autre installation", async t => {
  const { bytes, asset, destination, runtime } = await fixture(t);
  await fs.writeFile(`${destination}.partial`, "other transfer");
  await assert.rejects(downloadAsset(runtime, "test", asset, destination, { fetchImpl: async () => new Response(bytes) }), { code: "EEXIST" });
  assert.equal(await fs.readFile(`${destination}.partial`, "utf8"), "other transfer");
});

test("un serveur indisponible, une taille annoncée incorrecte ou une URL étrangère ne déploient rien", async t => {
  const { bytes, asset, destination, runtime } = await fixture(t);
  for (const response of [new Response("offline", { status: 503 }), new Response(bytes, { headers: { "content-length": "1" } })]) {
    await assert.rejects(downloadAsset(runtime, "test", asset, destination, { fetchImpl: async () => response }));
    await assert.rejects(fs.access(destination));
    await assert.rejects(fs.access(`${destination}.partial`));
  }
  await assert.rejects(downloadAsset(runtime, "test", { ...asset, url: "https://unknown.invalid/mod.zip" }, destination,
    { fetchImpl: () => { throw new Error("must not fetch"); } }), /non autorisé/);
});

test("un poste sans cache télécharge sa fixture une fois et répare une copie altérée", async t => {
  const { directory, bytes, asset } = await fixture(t);
  const { cachedGamePack } = require("../scripts/lib/game-pack-cache");
  const cacheRoot = path.join(directory, "cache");
  let requests = 0;
  const fetchImpl = async () => { requests++; return new Response(bytes); };
  const [first, second] = await Promise.all([
    cachedGamePack(asset, { cacheRoot, fetchImpl }), cachedGamePack(asset, { cacheRoot, fetchImpl })
  ]);
  assert.equal(first, second);
  assert.equal(requests, 1);
  await cachedGamePack(asset, { cacheRoot, fetchImpl });
  assert.equal(requests, 1);
  await fs.writeFile(first, "broken fixture");
  await cachedGamePack(asset, { cacheRoot, fetchImpl });
  assert.equal(requests, 2);
  assert.deepEqual(await fs.readFile(first), bytes);
});
