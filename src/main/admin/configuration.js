"use strict";

/** admin : module « configuration », sans initialisation externe au chargement. */
const { GAME_CHEAT_ACCESS_ID, isValidGameCheatEmail } = require("../../shared/game-cheat-access");
const { ADMIN_EMAIL, PUBLIC_VISIBILITY_SECTIONS, VISIBILITY_SECTIONS } = require("./constants");
const { normalizeScope, cleanKey, cleanUsername, normalizeEmail } = require("./validation");
const { migrateVisibility, gamePlatformConfig, gameVersionConfig, normalizeAppVersion } = require("../../shared/visibility-catalog");

/** Une portée de jeu invalide ne doit jamais devenir une publication explicite.
 * L'absence de réglage conserve le défaut du catalogue (notamment propriétaire).
 */
function hasValidVisibilityEntry(section, value) {
  if (section !== "games") return true;
  const scope = value && typeof value === "object" ? value.scope : value;
  return ["public", "admin", "hidden", false].includes(scope);
}

function normalizeSiteSettings(value) {
  const candidate = value && typeof value === "object" ? value : {};
  const result = {
    schemaVersion: Math.max(1, Math.min(100, Number(candidate.schemaVersion) || 6)),
    actionTypeOverrides: {},
    cheatAccess: {}
  };
  for (const section of VISIBILITY_SECTIONS) {
    const source =
      candidate[section] && typeof candidate[section] === "object"
        ? candidate[section]
        : {};
    result[section] = {};
    for (const [rawId, rawConfig] of Object.entries(source).slice(0, 500)) {
      const id = cleanKey(rawId);
      if (!id || !hasValidVisibilityEntry(section, rawConfig)) continue;
      result[section][id] = { scope: normalizeScope(rawConfig), ...(section === "games" ? { ...gamePlatformConfig(rawConfig), ...gameVersionConfig(rawConfig) } : {}) };
    }
  }
  for (const [rawId, enabled] of Object.entries(
    candidate.actionTypeOverrides || {}
  ).slice(0, 500)) {
    const id = cleanKey(rawId);
    if (id) result.actionTypeOverrides[id] = enabled !== false;
  }
  for (const [rawId, rawAccess] of Object.entries(candidate.cheatAccess || {}).slice(
    0,
    100
  )) {
    const id = cleanKey(rawId);
    if (!id) continue;
    const entries = Array.isArray(rawAccess?.entries) ? rawAccess.entries : [];
    result.cheatAccess[id] = {
      entries: entries
        .slice(0, 250)
        .map((entry) => ({
          email: normalizeEmail(entry?.email).slice(0, 254),
          username: cleanUsername(entry?.username)
        }))
        .filter(
          (entry) =>
            isValidGameCheatEmail(entry.email) &&
            (id === GAME_CHEAT_ACCESS_ID || entry.username) &&
            (id !== GAME_CHEAT_ACCESS_ID || entry.email !== ADMIN_EMAIL)
        )
        .filter(
          (entry, index, allEntries) =>
            allEntries.findIndex(
              (candidateEntry) => candidateEntry.email === entry.email
            ) === index
        )
        .map((entry) =>
          id === GAME_CHEAT_ACCESS_ID
            ? { email: entry.email }
            : entry
        )
    };
  }
  return migrateVisibility(result);
}

function normalizePublicVisibility(value) {
  const candidate = value && typeof value === "object" ? value : {};
  const result = {
    schemaVersion: Math.max(
      7,
      Math.min(100, Number(candidate.schemaVersion) || 7)
    )
  };
  for (const section of PUBLIC_VISIBILITY_SECTIONS) {
    const source =
      candidate[section] && typeof candidate[section] === "object"
        ? candidate[section]
        : {};
    result[section] = {};
    for (const [rawId, rawConfig] of Object.entries(source).slice(0, 500)) {
      const id = cleanKey(rawId);
      if (!id || !hasValidVisibilityEntry(section, rawConfig)) continue;
      const version = section === "games" ? gameVersionConfig(rawConfig) : {};
      const scope = section === "games" && rawConfig?.scope === "hidden" && rawConfig.versionScope === "public" && version.minAppVersion
        ? "public" : normalizeScope(rawConfig);
      result[section][id] = { scope, ...(section === "games" ? { ...gamePlatformConfig(rawConfig), ...version } : {}) };
    }
  }
  return migrateVisibility(result);
}

function validateGameVersions(settings) {
  for (const entry of Object.values(settings.games || {})) {
    if (entry.minAppVersion && !normalizeAppVersion(entry.minAppVersion)) {
      throw new Error("Version minimale ShenPulse invalide. Utilisez le format 2.0.5 ou laissez le champ vide.");
    }
  }
}

/** Les clients déjà diffusés ignorent minAppVersion : ils doivent lire Masqué.
 * Les nouveaux décodent versionScope puis comparent leur propre version.
 */
function publicVisibilityDocument(settings) {
  const document = normalizePublicVisibility(settings);
  for (const entry of Object.values(document.games || {})) {
    if (entry.scope === "public" && entry.minAppVersion) {
      entry.scope = "hidden";
      entry.versionScope = "public";
    }
  }
  return document;
}

module.exports = { normalizeSiteSettings, normalizePublicVisibility, validateGameVersions, publicVisibilityDocument };

