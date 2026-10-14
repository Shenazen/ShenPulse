"use strict";

/**
 * Ajoute une valeur dans un Set borné en conservant l’ordre d’insertion.
 * La première valeur est retirée au dépassement ; les doublons restent
 * traités par l’appelant pour préserver sa politique de déduplication.
 * @param {Set} collection Ensemble possédé par le consommateur.
 * @param {*} value Valeur à ajouter.
 * @param {number} maximum Capacit? positive convenue par le protocole.
 */
function addBoundedSet(collection, value, maximum) {
  collection.add(value);
  if (collection.size > maximum) collection.delete(collection.values().next().value);
  return collection;
}

module.exports = { addBoundedSet };
