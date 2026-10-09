"use strict";

const source = require("../../resources/catalogs/super-mario-kart-effects.json");

const SUPER_MARIO_KART_INTERACTION_CATALOG_VERSION = 2;

const SUPER_MARIO_KART_EFFECTS = Object.freeze(
  source.map((entry, index) => ({
    id: String(entry.id || ""),
    code: String(entry.id || ""),
    name: String(entry.name || entry.id || "Interaction Super Mario Kart"),
    description: `Déclenche « ${String(
      entry.name || entry.id || "Interaction Super Mario Kart"
    )} » dans Super Mario Kart.`,
    category: String(entry.category || "Super Mario Kart"),
    icon: superMarioKartEffectIcon(entry.category),
    available: entry.available !== false,
    service: "native",
    sortOrder: index
  }))
);

const SUPER_MARIO_KART_DEFAULT_MAPPINGS = Object.freeze([]);

function superMarioKartEffectIcon(category) {
  const value = String(category || "").toLowerCase();
  if (value.includes("item") || value.includes("objet")) return "◆";
  if (value.includes("character") || value.includes("personnage")) return "♟";
  if (value.includes("music") || value.includes("musique")) return "♫";
  if (value.includes("camera") || value.includes("caméra")) return "◉";
  if (value.includes("speed") || value.includes("vitesse")) return "»";
  return "★";
}

module.exports = {
  SUPER_MARIO_KART_DEFAULT_MAPPINGS,
  SUPER_MARIO_KART_EFFECTS,
  SUPER_MARIO_KART_INTERACTION_CATALOG_VERSION
};
