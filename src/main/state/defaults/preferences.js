"use strict";

const { clone } = require("../../utils");

/** Préférences de voix uniquement : jamais de compte, port ou référence au coffre. */
function createDefaultTtsSettings() {
  return { enabled: true, language: "fr-FR", voice: "", rate: 1, pitch: 1, volume: 0.9, profanityFilter: true };
}

/** Un ancien profil hérite des réglages de son compte, sans écraser ses valeurs propres. */
function normalizeTtsSettings(value, fallback) {
  const defaults = createDefaultTtsSettings();
  const source = value && typeof value === "object" ? value : {};
  const inherited = fallback && typeof fallback === "object" ? fallback : {};
  return Object.fromEntries(Object.entries(defaults).map(([key, defaultValue]) => [
    key, clone(source[key] !== undefined ? source[key] : inherited[key] !== undefined ? inherited[key] : defaultValue)
  ]));
}

module.exports = { createDefaultTtsSettings, normalizeTtsSettings };
