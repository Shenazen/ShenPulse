"use strict";

const { isDeepStrictEqual } = require("node:util");
const { assertAdminAccount, assertAuthenticatedAccount } = require("./account-access");
const { clone, safeString } = require("./utils");
const { normalizeSongRequestSettings } = require("./spotify/song-request-settings");

const CREATOR_SETTING_KEYS = new Set(["locale", "theme", "tts", "overlayConfigs", "overlayScene", "irl"]);
const IMMUTABLE_SETTING_KEYS = new Set(["admin", "account", "siteVisibility", "matches", "kick", "controllers", "liveDirectory"]);
const SERVICE_SETTING_KEYS = new Set(["tiktok", "spotify", "publicOverlayRelay", "matchAccess"]);

function hasOwnerSettingsAccess(store) {
  try { return assertAdminAccount(store); }
  catch (error) {
    if (!["ACCOUNT_REQUIRED", "ADMIN_ACCOUNT_REQUIRED"].includes(error.code)) throw error;
    return false;
  }
}

/** La page Paramètres est privée, mais les autres pages gardent leurs réglages.
 * Les anciens clients renvoient parfois tout le snapshot : les champs privés
 * inchangés sont acceptés et les états gérés par un service ne sont pas réécrits.
 */
function settingsAllowedForAccount(store, incoming, current) {
  assertAuthenticatedAccount(store);
  if (hasOwnerSettingsAccess(store)) return incoming;
  const allowed = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (IMMUTABLE_SETTING_KEYS.has(key) || SERVICE_SETTING_KEYS.has(key)) continue;
    if (!CREATOR_SETTING_KEYS.has(key) && !isDeepStrictEqual(value, current[key])) {
      // Même garde que l'administration : aucun write/secret/effet avant refus.
      assertAdminAccount(store);
    }
    if (CREATOR_SETTING_KEYS.has(key)) allowed[key] = value;
  }
  return allowed;
}

/** Un fichier de profil n'accorde pas les permissions de l'exporteur.
 * Préserve aussi les champs absents, sinon les valeurs par défaut de l'import
 * remplaceraient indirectement les ports et autorisations du compte courant.
 */
function settingsForProfileImport(store, incoming, current) {
  const candidate = incoming && typeof incoming === "object" && !Array.isArray(incoming) ? incoming : {};
  if (hasOwnerSettingsAccess(store)) return clone(candidate);
  const settings = clone(current);
  for (const key of CREATOR_SETTING_KEYS) {
    if (Object.hasOwn(candidate, key)) settings[key] = clone(candidate[key]);
  }
  // Le @ est une donnée fonctionnelle du profil. Les autorisations d'envoi,
  // relais et jetons ne sont jamais adoptés depuis une sauvegarde tierce.
  if (typeof candidate.tiktok?.username === "string") {
    settings.tiktok = { ...(settings.tiktok || {}), username: safeString(candidate.tiktok.username, 120) };
  }
  if (candidate.spotify?.songRequests && typeof candidate.spotify.songRequests === "object") {
    settings.spotify = { ...(settings.spotify || {}), songRequests: normalizeSongRequestSettings(candidate.spotify.songRequests) };
  }
  return settings;
}

module.exports = { settingsAllowedForAccount, settingsForProfileImport };
