"use strict";

const source = require("../../resources/catalogs/pokemon-red-blue-effects.json");

const POKEMON_RED_BLUE_INTERACTION_CATALOG_VERSION = 2;

const POKEMON_RED_BLUE_EFFECTS = Object.freeze(
  source.map((entry, index) => ({
    id: String(entry.id || ""),
    code: String(entry.id || ""),
    name: String(entry.name || entry.id || "Interaction Pokémon"),
    description: `Déclenche « ${String(entry.name || entry.id || "Interaction Pokémon")} » dans Pokémon Rouge/Bleu.`,
    category: String(entry.category || "Pokémon"),
    icon: pokemonEffectIcon(entry.category),
    available: entry.available !== false,
    service: "native",
    sortOrder: index
  }))
);

const POKEMON_RED_BLUE_DEFAULT_MAPPINGS = Object.freeze([]);

function pokemonEffectIcon(category) {
  const value = String(category || "").toLowerCase();
  if (value.includes("status") || value.includes("statut")) return "✚";
  if (value.includes("item") || value.includes("objet")) return "◆";
  if (value.includes("give") || value.includes("donner")) return "+";
  if (value.includes("remove") || value.includes("retirer")) return "−";
  if (value.includes("dv")) return "◇";
  return "◉";
}

module.exports = {
  POKEMON_RED_BLUE_DEFAULT_MAPPINGS,
  POKEMON_RED_BLUE_EFFECTS,
  POKEMON_RED_BLUE_INTERACTION_CATALOG_VERSION
};
