"use strict";

const { clone } = require("../utils");

/** Copie une table objet valide ; les tableaux ne sont pas des dictionnaires de réglages. */
function normalizeObjectMap(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? clone(value)
    : {};
}

module.exports = { normalizeObjectMap };
