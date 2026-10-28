"use strict";

const { safeString } = require("../utils");

const QUEUE_LIMIT = 50;
const DEFAULT_COMMANDS = { request: "!sr", skip: "!skip", nowPlaying: "!np", queue: "!queue" };

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
}

/** Contrat pur partagé par le service musical et les migrations de profils. */
function normalizeSongRequestSettings(value = {}, strict = false) {
  const source = value && typeof value === "object" ? value : {};
  const commands = {};
  for (const [key, fallback] of Object.entries(DEFAULT_COMMANDS)) {
    const command = safeString(source.commands?.[key] || fallback, 30).trim().toLowerCase();
    if (!/^![a-z][a-z0-9_-]{0,20}$/.test(command)) {
      if (strict) throw new Error("Les commandes musicales doivent commencer par ! et ne contenir aucun espace.");
      commands[key] = fallback;
    } else commands[key] = command;
  }
  if (new Set(Object.values(commands)).size !== 4) {
    if (strict) throw new Error("Utilisez quatre commandes musicales différentes.");
    Object.assign(commands, DEFAULT_COMMANDS);
  }
  return {
    enabled: source.enabled === true, allowExplicit: source.allowExplicit === true,
    maxDurationMinutes: boundedNumber(source.maxDurationMinutes, 10, 1, 120),
    maxQueue: boundedNumber(source.maxQueue, 20, 1, QUEUE_LIMIT),
    maxPerViewer: boundedNumber(source.maxPerViewer ?? source.maxPerUser, 3, 1, 10),
    cooldownSeconds: boundedNumber(source.cooldownSeconds, 10, 0, 3600),
    allowViewerSkip: source.allowViewerSkip === true,
    blockedArtists: Array.isArray(source.blockedArtists) ? [...new Set(source.blockedArtists.map((artist) => safeString(artist, 120).trim()).filter(Boolean))].slice(0, 100) : [],
    commandEnabled: Object.fromEntries(Object.keys(DEFAULT_COMMANDS).map((key) => [key, source.commandEnabled?.[key] !== false])),
    commands
  };
}

module.exports = { normalizeSongRequestSettings, QUEUE_LIMIT };
