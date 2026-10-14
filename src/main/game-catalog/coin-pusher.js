"use strict";

/** Catalogue de jeux : domaine « coin-pusher », données et identifiants conservés. */


const COIN_PUSHER_EFFECTS = Object.freeze([
  {
    id: "pluie-de-pieces",
    code: "pluie-de-pieces",
    name: "Pluie de pièces",
    description: "Fait tomber un lot de pièces sur le plateau pour le viewer.",
    category: "Pièces",
    icon: "◉",
    quantity: 20,
    quantityParameter: "coinCount",
    parameters: [
      {
        id: "coinCount",
        label: "Nombre de pièces",
        min: 1,
        max: 500,
        step: 1,
        defaultValue: 20
      }
    ],
    available: true,
    service: "native",
    sortOrder: 0
  },
  {
    id: "pousser-le-plateau",
    code: "pousser-le-plateau",
    name: "Pousser le plateau",
    description: "Fait sortir complètement le poussoir pour vider le plateau et compter les dernières pièces.",
    category: "Machine",
    icon: "⇥",
    available: true,
    service: "native",
    sortOrder: 1
  },
  {
    id: "piece-mystere",
    code: "piece-mystere",
    name: "Pièce mystère",
    description: "Ajoute un lot surprise de pièces dans la partie.",
    category: "Bonus",
    icon: "?",
    quantity: 5,
    quantityParameter: "coinCount",
    parameters: [
      {
        id: "coinCount",
        label: "Nombre de pièces",
        min: 1,
        max: 500,
        step: 1,
        defaultValue: 5
      }
    ],
    available: true,
    service: "native",
    sortOrder: 2
  },
  {
    id: "bonus-multiplicateur",
    code: "bonus-multiplicateur",
    name: "Bonus multiplicateur",
    description: "Déclenche le bonus multiplicateur du Coin Pusher.",
    category: "Bonus",
    icon: "×",
    available: true,
    service: "native",
    sortOrder: 3
  },
  {
    id: "ralentir-le-poussoir",
    code: "ralentir-le-poussoir",
    name: "Ralentir le poussoir",
    description: "Ralentit temporairement le poussoir de la machine.",
    category: "Machine",
    icon: "◷",
    duration: 12,
    durationParameter: "durationSeconds",
    parameters: [
      {
        id: "durationSeconds",
        label: "Durée (secondes)",
        min: 1,
        max: 120,
        step: 1,
        defaultValue: 12
      }
    ],
    available: true,
    service: "native",
    sortOrder: 4
  },
  {
    id: "reinitialiser-la-manche",
    code: "reinitialiser-la-manche",
    name: "Réinitialiser la manche",
    description: "Réinitialise immédiatement la manche Coin Pusher active.",
    category: "Manche",
    icon: "↻",
    available: true,
    service: "native",
    sortOrder: 5
  }
]);

const COIN_PUSHER_DEFAULT_MAPPINGS = Object.freeze(
  COIN_PUSHER_EFFECTS.map((effect) =>
    Object.freeze({
      id: `coin-pusher-${effect.id}`,
      effectId: effect.id,
      title: effect.name,
      triggerType: "gift",
      threshold: 1,
      cooldownSeconds: 0,
      enabled: true,
      triggerEnabled: false
    })
  )
);

module.exports = { COIN_PUSHER_EFFECTS, COIN_PUSHER_DEFAULT_MAPPINGS };

