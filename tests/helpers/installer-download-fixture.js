"use strict";

const fs = require("node:fs/promises");
const assert = require("node:assert/strict");
const { downloadAsset } = require("../../src/main/game-runtime/asset-download");
const { cachedGamePack } = require("../../scripts/lib/game-pack-cache");
const publication = require("../../scripts/manifests/game-packs.json");

async function localAssetPath(asset) {
  const fixture = publication.assets.find(entry => entry.sha256 === asset.sha256);
  if (!fixture) throw new Error(`Fixture locale absente : ${asset.id}`);
  return cachedGamePack({ ...fixture, url: `https://f003.backblazeb2.com/file/shenpulse-media/${fixture.key}` });
}

// Warm caches are offline; a clean checkout fetches and verifies fixtures from Backblaze once.
async function downloadFixtureAsset(runtime, gameId, asset, destination, options = {}) {
  const fixture = publication.assets.find(entry => entry.gameId === gameId && entry.id === asset.id);
  assert.ok(fixture, `Fixture absente : ${gameId}/${asset.id}`);
  const source = await localAssetPath(fixture);
  return downloadAsset(runtime, gameId, asset, destination, { ...options, fetchImpl: async url => {
    assert.equal(url, asset.url);
    const bytes = await fs.readFile(source);
    return new Response(bytes, { headers: { "content-length": String(bytes.length) } });
  } });
}

module.exports = { localAssetPath, downloadFixtureAsset };
