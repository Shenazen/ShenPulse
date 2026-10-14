"use strict";

/** admin : module « configuration », sans initialisation externe au chargement. */
const { GAME_CHEAT_ACCESS_ID, isValidGameCheatEmail } = require("../../shared/game-cheat-access");
const { ADMIN_EMAIL, PUBLIC_VISIBILITY_SECTIONS, VISIBILITY_SECTIONS } = require("./constants");
const { normalizeScope, cleanKey, cleanUsername, normalizeEmail } = require("./validation");
const { migrateVisibility } = require("../../shared/visibility-catalog");

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
      if (!id) continue;
      result[section][id] = { scope: normalizeScope(rawConfig) };
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
      if (!id) continue;
      result[section][id] = { scope: normalizeScope(rawConfig) };
    }
  }
  return migrateVisibility(result);
}

module.exports = { normalizeSiteSettings, normalizePublicVisibility };

