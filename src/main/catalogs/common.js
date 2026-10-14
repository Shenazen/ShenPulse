"use strict";

/** catalogs : module « common », sans initialisation externe au chargement. */


function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_value, index) => start + index);
}

function titleCase(value) {
  return String(value)
    .replace(/[_-]/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[œŒ]/g, "oe")
    .replace(/[æÆ]/g, "ae")
    .toLowerCase()
    .trim();
}

module.exports = { range, titleCase, normalizeSearch };

