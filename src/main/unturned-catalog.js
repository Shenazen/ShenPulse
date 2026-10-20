"use strict";

const GAME_ID = "unturned";
const parameter = (id, label, min, max, defaultValue, step = 1) => ({ id, label, min, max, defaultValue, step });
const count = () => parameter("amount", "Nombre d’apparitions", 1, 50, 1);
const radius = () => parameter("radius", "Rayon autour du joueur (mètres)", 3, 30, 8);
const asset = (label) => parameter("assetId", `${label} (0 = aléatoire)`, 0, 65535, 0);
const variation = (label = "Variation (points)") => parameter("value", label, -100, 100, 25);

// Les 27 familles d'interactions de la référence publique sont implémentées
// par notre module original, compilé contre les API du client Unturned.
const rows = [
  ["spawn_enemy", "Faire apparaître des zombies", "Apparitions", "Ajoute des zombies près du survivant, y compris hors des villes. Ils poursuivent et attaquent le joueur.", [count(), radius(), parameter("speciality", "Type de zombie (1 normal, 2 méga, 3 rampant, 4 sprinteur)", 1, 24, 1)]],
  ["spawn_animals", "Faire apparaître des animaux", "Apparitions", "Fait apparaître l’animal choisi ou une espèce aléatoire disponible.", [count(), radius(), asset("ID de l’animal")]],
  ["spawn_vehicles", "Faire apparaître des véhicules", "Apparitions", "Fait apparaître des véhicules au sol près du joueur.", [count(), radius(), asset("ID du véhicule")]],
  ["give_item", "Donner des objets", "Inventaire", "Ajoute des objets à l’inventaire. Si celui-ci est plein, ils sont déposés au sol.", [count(), asset("ID de l’objet")]],
  ["drop_item", "Déposer des objets", "Inventaire", "Dépose des objets devant le survivant.", [count(), asset("ID de l’objet")]],
  ["heal", "Modifier la vie", "Survie", "Ajoute ou retire des points de vie, dans les limites du jeu.", [variation("Variation de vie (points)")]],
  ["food", "Modifier la nourriture", "Survie", "Ajoute ou retire des points de nourriture.", [variation("Variation de nourriture (points)")]],
  ["water", "Modifier l’hydratation", "Survie", "Ajoute ou retire des points d’hydratation.", [variation("Variation d’hydratation (points)")]],
  ["virus", "Modifier l’immunité", "Survie", "Ajoute ou retire des points d’immunité contre l’infection.", [variation("Variation d’immunité (points)")]],
  ["stamina", "Modifier l’endurance", "Survie", "Ajoute ou retire des points d’endurance.", [variation("Variation d’endurance (points)")]],
  ["oxygen", "Modifier l’oxygène", "Survie", "Ajoute ou retire des points d’oxygène.", [variation("Variation d’oxygène (points)")]],
  ["kill_all_zombies", "Éliminer tous les zombies", "Nettoyage", "Élimine les zombies actuellement chargés sur la carte.", []],
  ["kill_all_animals", "Éliminer tous les animaux", "Nettoyage", "Élimine les animaux actuellement chargés sur la carte.", []],
  ["day", "Passer au jour", "Monde", "Fait commencer la journée suivant le cycle de la carte.", []],
  ["night", "Passer à la nuit", "Monde", "Fait commencer la nuit suivant le cycle de la carte.", []],
  ["set_time", "Choisir le moment de la journée", "Monde", "Place le cycle de la carte au pourcentage choisi.", [parameter("value", "Progression de la journée (%)", 0, 100, 50)]],
  ["add_experience", "Modifier l’expérience", "Survie", "Ajoute ou retire de l’expérience, sans dépasser les limites du jeu.", [parameter("value", "Variation d’expérience", -100000, 100000, 100)]],
  ["airdrop", "Déclencher un largage aérien", "Monde", "Déclenche un largage aérien vers la position du survivant, sur les cartes disposant d’une cargaison.", []],
  ["inventory_shuffle", "Mélanger l’inventaire", "Inventaire", "Réorganise les objets personnels ; ceux qui ne rentrent plus sont déposés au sol.", []],
  ["drop_all_items", "Lâcher tout l’inventaire", "Inventaire", "Dépose les objets personnels au sol sans toucher aux coffres et conteneurs.", []],
  ["break_item", "Casser l’objet équipé", "Inventaire", "Réduit à zéro la qualité de l’objet actuellement équipé.", []],
  ["repair_item", "Réparer l’objet équipé", "Inventaire", "Restaure à 100 % la qualité de l’objet actuellement équipé.", []],
  ["item_rain", "Pluie d’objets", "Apparitions", "Fait tomber des objets au-dessus du survivant.", [count(), radius(), asset("ID de l’objet")]],
  ["respawn", "Revenir au point d’apparition", "Déplacement", "Fait réapparaître un survivant mort ou téléporte un survivant vivant à un point d’apparition.", []],
  ["slap", "Projeter le survivant", "Déplacement", "Projette le survivant vers le haut et l’avant. Les dégâts de chute du jeu restent actifs.", [parameter("force", "Force de projection", 1, 30, 10)]],
  ["set_weather", "Changer la météo", "Monde", "Impose un ciel clair, la pluie ou la neige selon les ressources disponibles.", [parameter("value", "Météo (0 clair, 1 pluie, 2 neige)", 0, 2, 1)]],
  ["boom", "Explosion autour du joueur", "Pièges", "Déclenche une explosion avec dégâts configurables sur les personnages et véhicules, en préservant les bâtiments.", [parameter("value", "Dégâts de l’explosion", 1, 100, 25), radius()]]
];
const icons = { Apparitions: "◈", Inventaire: "▣", Survie: "♥", Nettoyage: "✦", Monde: "☀", Déplacement: "➜", Pièges: "☄" };
const UNTURNED_EFFECTS = Object.freeze(rows.map(([code, name, category, description, parameters], sortOrder) => Object.freeze({
  id: `unturned-${code.replaceAll("_", "-")}`, code, name, category, description, parameters,
  icon: icons[category], quantity: 1, duration: 0, available: true, service: "native", sortOrder,
  ...(parameters.some(({ id }) => id === "amount") ? { quantityParameter: "amount" } : {})
})));
const UNTURNED_DEFAULT_MAPPINGS = Object.freeze(UNTURNED_EFFECTS.map((effect) => Object.freeze({
  id: `catalog-${effect.id}`, effectId: effect.id, title: effect.name,
  triggerType: "gift", threshold: 1, cooldownSeconds: 0, enabled: true, triggerEnabled: false,
  parameters: Object.fromEntries(effect.parameters.map(({ id, defaultValue }) => [id, defaultValue]))
})));
module.exports = { UNTURNED_GAME_ID: GAME_ID, UNTURNED_EFFECTS, UNTURNED_DEFAULT_MAPPINGS, UNTURNED_INTERACTION_CATALOG_VERSION: 20261020 };
