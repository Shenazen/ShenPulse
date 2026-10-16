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

module.exports = { launchSteamDemo };
