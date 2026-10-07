"use strict";

// Catalogue public Crowd Control relevé le 7 octobre 2026.
// Les effets marqués "inactive" par leur API ne sont pas affichés par leur
// interface et ne font donc pas partie du catalogue actif ShenPulse.
const GAME_ID = "euro-truck-simulator-2";
const CROWD_CONTROL_IMAGE_ROOT =
  "https://resources.crowdcontrol.live/images/EuroTruckSimulator2/EuroTruckSimulator2/icons";

const RAW_EFFECTS = [
  effect(
    "time-noon",
    "time_noon",
    "Plein midi",
    "Météo et heure",
    "Règle l’heure du jeu sur midi sans modifier la fatigue ni le délai de livraison.",
    "sunny",
    25
  ),
  timedEffect(
    "hazard-lights",
    "hazards",
    "Feux de détresse",
    "Éclairage",
    "Active les feux de détresse pendant 10 secondes.",
    "hazards",
    15,
    10
  ),
  timedEffect(
    "gearbox-gremlin",
    "gear_chaos",
    "Gremlin dans la boîte de vitesses",
    "Transmission",
    "Passe aléatoirement les rapports supérieurs et inférieurs pendant 10 secondes.",
    "gear",
    75,
    10
  ),
  timedEffect(
    "disco-lights",
    "lights_disco",
    "Éclairage disco",
    "Éclairage",
    "Fait clignoter aléatoirement les phares, les pleins phares et les appels de phares pendant 10 secondes.",
    "disco",
    50,
    10
  ),
  timedEffect(
    "floor-it",
    "speed_boost",
    "Plein gaz",
    "Conduite",
    "Maintient l’accélérateur au plancher pendant 10 secondes.",
    "speedup",
    50,
    10
  ),
  timedEffect(
    "speed-limiter",
    "speed_governor",
    "Limiteur de vitesse",
    "Conduite",
    "Freine automatiquement pour limiter le camion à environ 50 km/h pendant 20 secondes.",
    "gaugedown",
    75,
    20
  ),
  effect(
    "drop-to-neutral",
    "neutral_drop",
    "Passer au point mort",
    "Transmission",
    "Passe immédiatement la transmission au point mort.",
    "arrowdown",
    50
  ),
  effect(
    "toggle-cruise-control",
    "cruise_control",
    "Basculer le régulateur de vitesse",
    "Conduite",
    "Active ou désactive le régulateur de vitesse si la vitesse minimale est atteinte.",
    "gauge",
    15
  ),
  timedEffect(
    "air-horn",
    "airhorn",
    "Klaxon pneumatique",
    "Klaxons",
    "Maintient le klaxon pneumatique pendant 5 secondes.",
    "horn",
    20,
    5
  ),
  timedEffect(
    "trailer-brake",
    "trailer_brake",
    "Frein de remorque",
    "Conduite",
    "Maintient le frein de la remorque pendant 5 secondes.",
    "stop",
    40,
    5
  ),
  effect(
    "jerk-left",
    "steer_left",
    "Coup de volant à gauche",
    "Direction",
    "Force un brusque écart vers la gauche.",
    "arrowleft",
    40
  ),
  effect(
    "kill-engine",
    "engine_off",
    "Couper le moteur",
    "Moteur",
    "Coupe le contact si le moteur est actuellement allumé.",
    "engineoff",
    100
  ),
  effect(
    "honk",
    "honk",
    "Klaxonner",
    "Klaxons",
    "Actionne le klaxon pendant une seconde.",
    "horn",
    10
  ),
  timedEffect(
    "blinker-party",
    "blinker_party",
    "Festival de clignotants",
    "Éclairage",
    "Alterne les clignotants gauche et droit pendant 10 secondes.",
    "blinkerparty",
    25,
    10
  ),
  timedEffect(
    "engine-brake",
    "slow_down",
    "Frein moteur",
    "Conduite",
    "Applique le frein moteur et une forte résistance au freinage pendant 10 secondes.",
    "slowdown",
    40,
    10
  ),
  effect(
    "windows-down",
    "windows_down",
    "Descendre les vitres",
    "Cabine",
    "Descend complètement les deux vitres.",
    "arrowdown",
    15
  ),
  effect(
    "parking-brake",
    "parking_brake",
    "Tirer le frein de stationnement",
    "Moteur",
    "Enclenche immédiatement le frein de stationnement.",
    "stop",
    75
  ),
  effect(
    "jerk-right",
    "steer_right",
    "Coup de volant à droite",
    "Direction",
    "Force un brusque écart vers la droite.",
    "arrowright",
    40
  ),
  effect(
    "time-midnight",
    "time_midnight",
    "Minuit",
    "Météo et heure",
    "Règle l’heure du jeu sur minuit sans modifier la fatigue ni le délai de livraison.",
    "midnight",
    25
  ),
  effect(
    "random-weather",
    "weather_random",
    "Météo aléatoire",
    "Météo et heure",
    "Applique immédiatement une météo choisie au hasard.",
    "weather",
    25
  ),
  timedEffect(
    "slam-brakes",
    "brake_slam",
    "Freinage d’urgence",
    "Conduite",
    "Maintient les freins de service à pleine puissance pendant 3 secondes.",
    "stop",
    75,
    3
  ),
  effect(
    "cycle-wipers",
    "wipers",
    "Changer les essuie-glaces",
    "Cabine",
    "Passe au mode suivant des essuie-glaces.",
    "rain",
    10
  ),
  effect(
    "clear-skies",
    "weather_clear",
    "Ciel dégagé",
    "Météo et heure",
    "Force une météo claire.",
    "sunny",
    25
  ),
  effect(
    "windows-up",
    "windows_up",
    "Remonter les vitres",
    "Cabine",
    "Remonte complètement les deux vitres.",
    "arrowup",
    15
  ),
  effect(
    "flash-high-beams",
    "high_beams",
    "Appel de phares",
    "Éclairage",
    "Bascule les pleins phares.",
    "lightson",
    10
  ),
  timedEffect(
    "drunk-steering",
    "steering_chaos",
    "Direction chaotique",
    "Direction",
    "Donne des coups de volant aléatoires pendant 12 secondes.",
    "steering",
    100,
    12
  ),
  effect(
    "make-it-rain",
    "weather_rain",
    "Faire tomber la pluie",
    "Météo et heure",
    "Force immédiatement une météo pluvieuse.",
    "rain",
    25
  ),
  timedEffect(
    "horn-spam",
    "horn_spam",
    "Rafale de klaxon",
    "Klaxons",
    "Fait klaxonner le camion en rythme pendant 8 secondes.",
    "horn",
    25,
    8
  ),
  effect(
    "next-radio-station",
    "radio_next",
    "Changer de station radio",
    "Cabine",
    "Passe à la station de radio suivante.",
    "nextstation",
    10
  ),
  timedEffect(
    "camera-chaos",
    "camera_chaos",
    "Caméra chaotique",
    "Cabine",
    "Change de vue toutes les quelques secondes pendant 10 secondes.",
    "spin",
    50,
    10
  )
];

const EURO_TRUCK_SIMULATOR_2_EFFECTS = Object.freeze(
  RAW_EFFECTS.map((entry, index) =>
    Object.freeze({
      ...entry,
      available: true,
      service: "native",
      sortOrder: index
    })
  )
);

const EURO_TRUCK_SIMULATOR_2_DEFAULT_MAPPINGS = Object.freeze(
  EURO_TRUCK_SIMULATOR_2_EFFECTS.map((effect) =>
    Object.freeze({
      id: `catalog-${effect.id}`,
      effectId: effect.id,
      title: effect.name,
      triggerType: "gift",
      threshold: 1,
      cooldownSeconds: 0,
      duration: effect.duration,
      enabled: true,
      triggerEnabled: false
    })
  )
);

function effect(
  id,
  code,
  name,
  category,
  description,
  imageName,
  crowdControlPrice
) {
  return {
    id: `ets2-${id}`,
    code,
    name,
    category,
    description,
    image: `${CROWD_CONTROL_IMAGE_ROOT}/${imageName}.png`,
    icon: iconForCategory(category),
    quantity: 1,
    duration: 0,
    crowdControlPrice
  };
}

function timedEffect(
  id,
  code,
  name,
  category,
  description,
  imageName,
  crowdControlPrice,
  seconds
) {
  return {
    ...effect(
      id,
      code,
      name,
      category,
      description,
      imageName,
      crowdControlPrice
    ),
    duration: seconds
  };
}

function iconForCategory(category) {
  return {
    Cabine: "◉",
    Conduite: "➤",
    Direction: "↔",
    Éclairage: "☀",
    Klaxons: "♫",
    "Météo et heure": "☁",
    Moteur: "⚙",
    Transmission: "⇅"
  }[category] || "◇";
}

module.exports = {
  EURO_TRUCK_SIMULATOR_2_DEFAULT_MAPPINGS,
  EURO_TRUCK_SIMULATOR_2_EFFECTS,
  EURO_TRUCK_SIMULATOR_2_GAME_ID: GAME_ID,
  EURO_TRUCK_SIMULATOR_2_INTERACTION_CATALOG_VERSION: 20261007
};
