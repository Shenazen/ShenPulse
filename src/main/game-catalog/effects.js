"use strict";

/** Catalogue de jeux : domaine « effects », données et identifiants conservés. */
const fs = require("node:fs");
const path = require("node:path");

function interactionEffects(baseDirectory, gameId) {
  const directory = path.join(baseDirectory, gameId);
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((file) => file.toLowerCase().endsWith(".webp"))
    .sort((left, right) => left.localeCompare(right, "en", { numeric: true }))
    .map((file, index) => {
      const stem = path.basename(file, path.extname(file));
      const match = stem.match(/-(native|s2e|cc)-(\d+)-(.+)$/i);
      const service = match?.[1]?.toLowerCase() || "visual";
      const code = match?.[3] || stem;
      return {
        id: stem,
        code,
        name: readableCode(code),
        description:
          service === "native"
            ? "Interaction locale ShenPulse prête à être envoyée au pack du jeu."
            : "Interaction de référence répertoriée ; aucun pack ShenPulse natif n’est encore exécutable.",
        category: inferCategory(code),
        icon: iconForCategory(inferCategory(code)),
        image: `../../resources/game-interactions/${gameId}/${file}`,
        available: service === "native",
        service,
        sortOrder: index
      };
    });
}

function effectFromTitle(title, index) {
  const code = slug(title);
  const category = inferCategory(code);
  return {
    id: code || `effect-${index + 1}`,
    code: code || `effect-${index + 1}`,
    name: title,
    description: `Déclenche « ${title} » dans la session de jeu active.`,
    category,
    icon: iconForCategory(category),
    available: true,
    service: "native",
    sortOrder: index
  };
}

function readableCode(value) {
  return String(value || "")
    .replace(/[-_.]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferCategory(value) {
  const text = String(value || "").toLowerCase();
  if (/heal|give|add|money|xp|boon|item|win|bonus/.test(text)) return "Aide";
  if (/spawn|enemy|mob|boss|vehicle|pet|customer/.test(text)) return "Apparition";
  if (/kill|damage|hurt|take|remove|bomb|explode|lose|poison/.test(text)) return "Sabotage";
  if (/weather|time|teleport|speed|gravity|camera|control|move/.test(text)) return "Contrôle";
  return "Chaos";
}

function iconForCategory(category) {
  return {
    Aide: "✚",
    Apparition: "◇",
    Sabotage: "⚠",
    Contrôle: "⌁",
    Chaos: "✦"
  }[category] || "◇";
}

module.exports = { interactionEffects, effectFromTitle, readableCode, slug, inferCategory, iconForCategory };

