"use strict";

/** Cache de développement hors dépôt. Aucun pack compilé n'est requis dans les sources. */
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { downloadAsset } = require("../../src/main/game-runtime/asset-download");
const { verifyLocalAsset } = require("./installer-assets");
const pending = new Map();

function gamePackCacheRoot() {
  return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), ".cache"), "ShenPulseDev", "game-packs");
}

function gamePackCachePath(asset, cacheRoot = gamePackCacheRoot()) {
  if (!/^[a-f0-9]{64}$/.test(asset.sha256 || "")) throw new Error("Empreinte du pack invalide");
  return path.join(cacheRoot, asset.sha256);
}

async function cachedGamePack(asset, { cacheRoot = gamePackCacheRoot(), fetchImpl = globalThis.fetch } = {}) {
  const destination = gamePackCachePath(asset, cacheRoot);
  if (pending.has(destination)) return pending.get(destination);
  const promise = (async () => {
    try { await verifyLocalAsset(destination, asset); return destination; } catch { /* Cache absent ou altéré. */ }
    await fs.mkdir(cacheRoot, { recursive: true });
    const temporary = `${destination}.${randomUUID()}.download`;
    try {
      await downloadAsset({ progress() {} }, asset.gameId || "game-pack", asset, temporary, { fetchImpl });
      await fs.rename(temporary, destination);
      return destination;
    } finally { await fs.rm(temporary, { force: true }); }
  })();
  pending.set(destination, promise);
  try { return await promise; } finally { pending.delete(destination); }
}

module.exports = { gamePackCacheRoot, gamePackCachePath, cachedGamePack };
