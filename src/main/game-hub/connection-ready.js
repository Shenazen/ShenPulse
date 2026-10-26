"use strict";

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function waitForGameConnection(hub, packId, { now = Date.now, sleep = delay, intervalMs = 150 } = {}) {
  const pack = hub.assertAccess(packId);
  const configured = Number(pack.connector?.launchConnectionTimeoutMs || 0);
  if (!Number.isFinite(configured) || configured <= 0) return;
  const maximum = pack.connector?.type === "shop-mod" ? 600_000 : 90_000;
  const deadline = now() + Math.min(maximum, configured);
  do {
    // prepareConnection rechecks access each time. A listening socket alone
    // never confirms that the game's local helper actually started.
    const status = await hub.prepareConnection(packId);
    if (status.connected === true) return status;
    await sleep(Math.min(intervalMs, Math.max(0, deadline - now())));
  } while (now() < deadline);
  throw new Error(pack.connector?.launchConnectionFailureMessage || `${pack.name} est ouvert, mais son pont local n’a pas établi la connexion à ShenPulse. Le lancement n’a pas pu être confirmé. Vérifiez l’éventuel message affiché par le pont au démarrage.`);
}

module.exports = { waitForGameConnection };
