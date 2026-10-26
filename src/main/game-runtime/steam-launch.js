"use strict";

/** Lancement Steam compilé, limité à la démo autorisée : aucun URI issu du profil. */
async function launchSteamDemo({ gameId, manifest, executable, shell, assertAccess }) {
  if (gameId !== "find-the-needle-demo" || manifest.steamLaunchAppId !== "5165210") {
    throw new Error("L’identifiant de lancement Steam de la démo n’est pas autorisé.");
  }
  if (!executable) {
    throw new Error("FindTheNeedle.exe n’est plus présent dans le dossier mémorisé. Réinstallez la démo dans Steam puis préparez à nouveau le mod local.");
  }
  assertAccess();
  await shell.openExternal("steam://rungameid/5165210");
  return { ok: true, gameId, launcher: "steam", steamAppId: "5165210", path: executable };
}

async function launchSteamGame({ gameId, manifest, executable, shell, assertAccess }) {
  const allowed = { "escape-from-duckov": "3167020" };
  const compiled = require("../game-installer-manifest").installerForGame(gameId);
  const dualPlatform = compiled && require("./installation-platform").supportsPlatformChoice(compiled);
  const appId = allowed[gameId] || (dualPlatform ? compiled.steamAppIds[0] : "");
  if (!/^\d+$/.test(appId) || (allowed[gameId] ? manifest.steamLaunchAppId !== appId : !manifest.steamAppIds?.includes(appId))) {
    throw new Error("Identifiant de lancement Steam non autorisé.");
  }
  if (!executable) throw new Error("L’exécutable du jeu Steam est introuvable. Réparez son installation puis réessayez.");
  assertAccess();
  await shell.openExternal(`steam://rungameid/${appId}`);
  return { ok: true, gameId, launcher: "steam", steamAppId: appId, path: executable };
}

module.exports = { launchSteamDemo, launchSteamGame };
