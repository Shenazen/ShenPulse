"use strict";

/** Nettoyage des seules installations temporaires gérées par ShenPulse. Les opérations et garde-fous restent identiques. */
const fs = require("node:fs");
const path = require("node:path");

function installationSlotPercent(index, total, slotProgress = 0) {
  const safeTotal = Math.max(1, Number(total || 1));
  const safeIndex = Math.max(0, Math.min(safeTotal - 1, Number(index || 0)));
  const safeProgress = Math.max(0, Math.min(1, Number(slotProgress || 0)));
  return Math.min(
    96,
    Math.max(
      3,
      Math.round(3 + ((safeIndex + safeProgress) / safeTotal) * 93)
    )
  );
}

async function cleanupStaleInstallerRuns(downloadsRoot, gameId) {
  const absoluteRoot = path.resolve(downloadsRoot);
  const entries = await fs.promises
    .readdir(absoluteRoot, { withFileTypes: true })
    .catch(() => []);
  for (const entry of entries) {
    if (
      !entry.isDirectory() ||
      !entry.name.startsWith(`${gameId}-`)
    ) {
      continue;
    }
    const target = path.resolve(absoluteRoot, entry.name);
    if (path.dirname(target) !== absoluteRoot) continue;
    await fs.promises.rm(target, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 200
    });
  }
}

module.exports = {
  installationSlotPercent,
  cleanupStaleInstallerRuns,
};

