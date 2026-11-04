"use strict";

const { clone } = require("../../utils");
const { normalizeAssignments } = require("../../../shared/tts-voices");

/** Préférences de voix uniquement : jamais de compte, port ou référence au coffre. */
function createDefaultTtsSettings() {
  return { enabled: true, language: "fr-FR", voice: "", rate: 1, pitch: 1, volume: 0.9, profanityFilter: true, assignments: { roles: {}, viewers: [] } };
}

/** Un ancien profil hérite des réglages de son compte, sans écraser ses valeurs propres. */
function normalizeTtsSettings(value, fallback) {
  const defaults = createDefaultTtsSettings();
  const source = value && typeof value === "object" ? value : {};
  const inherited = fallback && typeof fallback === "object" ? fallback : {};
  const settings = Object.fromEntries(Object.entries(defaults).map(([key, defaultValue]) => [
    key, clone(source[key] !== undefined ? source[key] : inherited[key] !== undefined ? inherited[key] : defaultValue)
  ]));
  settings.assignments = normalizeAssignments(settings.assignments);
  return settings;
}

module.exports = { createDefaultTtsSettings, normalizeTtsSettings };
