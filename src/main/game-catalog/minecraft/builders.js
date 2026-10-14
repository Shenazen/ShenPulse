"use strict";

/** Données et règles du domaine Minecraft « builders » ; identifiants publics inchangés. */


const IMAGE_ROOT = "../../resources/game-interactions/minecraft";

const CATALOG_VERSION = 1;

const SANDBOX_COLORS = Object.freeze([
  ["white", "white", "blanc"],
  ["orange", "orange", "orange"],
  ["magenta", "magenta", "magenta"],
  ["light-blue", "light_blue", "bleu clair"],
  ["yellow", "yellow", "jaune"],
  ["lime", "lime", "vert lime"],
  ["pink", "pink", "rose"],
  ["gray-gravel", "gray_gravel", "gravier gris"],
  ["random", "random", "aléatoire"],
  ["gray", "gray", "gris"],
  ["light-gray", "light_gray", "gris clair"],
  ["cyan", "cyan", "cyan"],
  ["purple", "purple", "violet"],
  ["blue", "blue", "bleu"],
  ["brown", "brown", "marron"],
  ["green", "green", "vert"],
  ["red", "red", "rouge"],
  ["black", "black", "noir"],
  ["red-sand", "red_sand", "rouge naturel"]
]);

function parameter(id, label, defaultValue, min, max, step = 1) {
  return Object.freeze({ id, label, defaultValue, min, max, step });
}

function effect({
  id,
  name,
  description,
  category,
  commands,
  image,
  parameters = [],
  duration = 0,
  quantity = 1
}) {
  const commandList = Array.isArray(commands) ? commands : [commands];
  return Object.freeze({
    id,
    code: commandList[0],
    command: commandList[0],
    commands: commandList,
    name,
    description,
    category,
    duration,
    quantity,
    parameters,
    icon: "◆",
    image: `${IMAGE_ROOT}/${image}`,
    available: true,
    service: "native"
  });
}

function titled(command, title) {
  return [
    command,
    `/title @a title "${title}"`,
    '/title @a subtitle "{{viewer}}"'
  ];
}

function winEffect(id, name, description, image, amount, operation) {
  return Object.freeze({
    id,
    code: id,
    name,
    description,
    category: "WINS",
    duration: operation === "multiplier" ? 60 : 0,
    quantity: 1,
    icon: "★",
    image: `${IMAGE_ROOT}/${image}`,
    available: true,
    service: "overlay",
    actionType: "overlay.win-counter",
    winCounter: Object.freeze({ amount, operation })
  });
}

function withSortOrder(effects) {
  return Object.freeze(
    effects.map((entry, index) =>
      Object.freeze({ ...entry, sortOrder: index })
    )
  );
}

module.exports = { IMAGE_ROOT, CATALOG_VERSION, SANDBOX_COLORS, parameter, effect, titled, winEffect, withSortOrder };

