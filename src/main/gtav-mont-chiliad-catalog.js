"use strict";

const GAME_ID = "gtav-montchiliad";
const IMAGE_ROOT = `../../resources/game-interactions/${GAME_ID}`;

const RAW_EFFECTS = [
  ["chaos_upupaway", "Faire sauter le joueur", "Joueur", "Propulse immédiatement le joueur ou son véhicule dans les airs.", "launch"],
  ["chaos_tp_mountchilliad", "Amener au Mont Chiliad", "Téléportation", "Téléporte le joueur au sommet du Mont Chiliad.", "mount-chiliad"],
  ["chaos_tp_random", "Envoyer ailleurs au hasard", "Téléportation", "Téléporte le joueur vers une destination surprise sécurisée.", "random-teleport"],
  ["chaos_time_night", "Passer en nuit", "Monde", "Règle immédiatement l’heure du jeu sur minuit.", "night"],
  ["chaos_time_day", "Passer en jour", "Monde", "Règle immédiatement l’heure du jeu sur midi.", "day"],
  ["chaos_invincible", "Rendre invincible", "Joueur", "Protège le joueur de tous les dégâts pendant 20 secondes.", "invincible", 20],
  ["chaos_5stars", "Mettre la police à fond", "Police", "Passe immédiatement le niveau de recherche à cinq étoiles.", "wanted"],
  ["chaos_random_weapons", "Armer les passants", "PNJ", "Arme les passants proches et les lance contre le joueur.", "armed-peds"],
  ["chaos_playerveh_explode", "Faire exploser le véhicule", "Véhicule", "Fait exploser le véhicule actuellement utilisé par le joueur.", "vehicle-explosion"],
  ["chaos_tp_lsairport", "Envoyer à l’aéroport", "Téléportation", "Téléporte le joueur sur le tarmac de l’aéroport de Los Santos.", "airport"],
  ["chaos_player_suicide", "Éliminer le joueur", "Joueur", "Élimine immédiatement le personnage du joueur.", "eliminate"],
  ["chaos_vehicle_random", "Changer de véhicule au hasard", "Véhicule", "Tire parmi plus de 175 modèles répartis équitablement : vélos, motos, quads, jet-skis, bateaux, tout-terrain, véhicules insolites, classiques, supercars, secours, poids lourds et aéronefs.", "vehicle-random"],
  ["chaos_vehicle_supercar", "Donner une supercar", "Véhicule", "Fait apparaître une supercar et place immédiatement le joueur au volant.", "vehicle-supercar"],
  ["chaos_vehicle_motorcycle", "Donner une moto", "Véhicule", "Fait apparaître une moto sportive et place immédiatement le joueur dessus.", "vehicle-motorcycle"],
  ["chaos_vehicle_tank", "Donner un tank", "Véhicule", "Fait apparaître un tank Rhino et place immédiatement le joueur aux commandes.", "vehicle-tank"],
  ["chaos_vehicle_helicopter", "Donner un hélicoptère", "Véhicule", "Fait apparaître un hélicoptère Buzzard et place le joueur aux commandes.", "vehicle-helicopter"],
  ["chaos_vehicle_repair", "Réparer le véhicule", "Véhicule", "Répare complètement le véhicule conduit par le joueur.", "vehicle-repair"],
  ["chaos_vehicle_boost", "Booster le véhicule", "Véhicule", "Propulse instantanément le véhicule du joueur vers l’avant.", "vehicle-boost"],
  ["chaos_vehicle_flip", "Retourner le véhicule", "Véhicule", "Fait effectuer un tonneau complet au véhicule dans les airs en conservant son élan.", "vehicle-flip"],
  ["chaos_vehicle_random_color", "Repeindre le véhicule", "Véhicule", "Applique deux couleurs surprises au véhicule du joueur.", "vehicle-random-color"],
  ["chaos_vehicle_eject", "Éjecter du véhicule", "Véhicule", "Force le joueur à quitter immédiatement son véhicule.", "vehicle-eject"],
  ["chaos_heal", "Restaurer la vie", "Joueur", "Restaure complètement la vie du personnage.", "heal"],
  ["chaos_damage", "Retirer de la vie", "Joueur", "Retire 50 points de vie sans éliminer directement le personnage.", "damage"],
  ["chaos_armor", "Donner une armure", "Joueur", "Remplit complètement la jauge d’armure du personnage.", "armor"],
  ["chaos_clear_wanted", "Semer la police", "Police", "Supprime immédiatement toutes les étoiles de recherche.", "clear-wanted"],
  ["chaos_wanted_up", "Ajouter une étoile", "Police", "Ajoute une étoile au niveau de recherche actuel.", "wanted-up"],
  ["chaos_ragdoll", "Faire tomber le joueur", "Joueur", "Fait chuter le personnage au sol pendant cinq secondes.", "ragdoll", 5],
  ["chaos_drunk", "Rendre le joueur ivre", "Joueur", "Perturbe fortement la vision du joueur pendant quinze secondes.", "drunk", 15],
  ["chaos_super_jump", "Activer les super sauts", "Joueur", "Active les super sauts pendant vingt secondes.", "super-jump", 20],
  ["chaos_explosive_ammo", "Munitions explosives", "Armes", "Rend les tirs explosifs pendant vingt secondes.", "explosive-ammo", 20],
  ["chaos_explosive_melee", "Coups explosifs", "Armes", "Rend les coups de poing explosifs pendant vingt secondes.", "explosive-melee", 20],
  ["chaos_infinite_ammo", "Munitions infinies", "Armes", "Donne des munitions sans limite pendant vingt secondes.", "infinite-ammo", 20],
  ["chaos_remove_weapons", "Retirer toutes les armes", "Armes", "Retire immédiatement toutes les armes du personnage.", "remove-weapons"],
  ["chaos_give_minigun", "Donner un minigun", "Armes", "Donne un minigun chargé au personnage.", "give-minigun"],
  ["chaos_weather_rain", "Déclencher la pluie", "Monde", "Déclenche immédiatement une pluie persistante.", "weather-rain"],
  ["chaos_weather_thunder", "Déclencher un orage", "Monde", "Déclenche immédiatement un violent orage.", "weather-thunder"],
  ["chaos_weather_clear", "Dégager le ciel", "Monde", "Rétablit immédiatement un ciel dégagé.", "weather-clear"],
  ["chaos_slow_motion", "Ralentir le temps", "Monde", "Ralentit le temps dans le jeu pendant dix secondes.", "slow-motion", 10],
  ["chaos_freeze_player", "Immobiliser le joueur", "Joueur", "Immobilise le joueur ou son véhicule pendant cinq secondes.", "freeze-player", 5],
  ["chaos_explode_nearby_vehicles", "Exploser les véhicules proches", "Véhicule", "Fait exploser jusqu’à vingt véhicules proches sans détruire celui du joueur.", "explode-nearby-vehicles"],
  ["chaos_launch_nearby_vehicles", "Projeter les véhicules proches", "Véhicule", "Projette jusqu’à vingt véhicules proches dans les airs.", "launch-nearby-vehicles"],
  ["chaos_prison", "Prison 60 sec", "Joueur", "Immobilise le joueur dans une prison temporaire pendant une minute.", "prison", 60],
  ["chaos_exit_prison", "Sortie prison", "Joueur", "Libère immédiatement le joueur si une prison ShenPulse est active.", "exit-prison"],
  ["chaos_black_hole", "Trou noir", "Monde", "Attire violemment les véhicules proches vers le joueur.", "black-hole"],
  ["chaos_meteor", "Météorite", "Monde", "Fait exploser une météorite près du joueur.", "meteor"],
  ["chaos_zombie_horde", "Horde de zombies", "PNJ", "Fait apparaître une horde hostile autour du joueur.", "zombie-horde"],
  ["chaos_spawn_alien", "Apparition d’aliens", "PNJ", "Fait apparaître des aliens hostiles autour du joueur.", "spawn-alien"],
  ["chaos_magnetic_storm", "Tempête magnétique", "Monde", "Projette les véhicules proches comme une tempête magnétique.", "magnetic-storm"],
  ["chaos_half_turn", "Demi-tour", "Véhicule", "Retourne le véhicule du joueur de 180 degrés.", "half-turn"],
  ["chaos_dance", "Danse 30 sec", "Joueur", "Force une animation de danse pendant trente secondes.", "dance", 30],
  ["chaos_propulsion", "Propulsion", "Joueur", "Propulse le joueur ou son véhicule vers l’avant.", "propulsion"],
  ["chaos_tank_on_head", "Tank sur la tête", "Véhicule", "Fait tomber un tank au-dessus du joueur.", "tank-on-head"],
  ["chaos_animal_random", "Animal aléatoire", "PNJ", "Fait apparaître un animal surprise près du joueur.", "animal-random"],
  ["chaos_tp_sky", "Téléportation dans le ciel", "Téléportation", "Téléporte le joueur haut dans le ciel.", "tp-sky"],
  ["chaos_train_hit", "Impact de train", "Véhicule", "Frappe le véhicule avec un choc brutal façon train.", "train-hit"],
  ["chaos_delete_vehicle", "Supprimer le véhicule", "Véhicule", "Supprime immédiatement le véhicule actuellement conduit.", "delete-vehicle"]
];

const RAW_WIN_EFFECTS = [
  ["overlay_win_x2", "X2 WINS", "Double pendant 60 secondes les WINS gagnées au Mont Chiliad et perdues lors d’une mort.", "bedrock-win-x2-ai.png", 2, "multiplier"],
  ["overlay_win_remove_1", "-1 WIN", "Retire immédiatement un point au compteur WINS de l’overlay.", "bedrock-win-remove-ai.png", -1, "adjust"],
  ["overlay_win_add_1", "+1 WIN", "Ajoute immédiatement un point au compteur WINS de l’overlay.", "bedrock-win-add-ai.png", 1, "adjust"],
  ["overlay_win_add_20", "+20 WINS", "Ajoute immédiatement vingt points au compteur WINS de l’overlay.", "bedrock-win-add-ai.png", 20, "adjust"],
  ["overlay_win_remove_3", "-3 WINS", "Retire immédiatement trois points au compteur WINS de l’overlay.", "bedrock-win-remove-ai.png", -3, "adjust"],
  ["overlay_win_remove_20", "-20 WINS", "Retire immédiatement vingt points au compteur WINS de l’overlay.", "bedrock-win-remove-ai.png", -20, "adjust"],
  ["overlay_win_remove_50", "-50 WINS", "Retire immédiatement cinquante points au compteur WINS de l’overlay.", "bedrock-win-remove-ai.png", -50, "adjust"],
  ["overlay_win_random_200", "+/- 200 WINS", "Ajoute ou retire au hasard deux cents points au compteur WINS de l’overlay.", "bedrock-win-random-ai.png", 200, "random"],
  ["overlay_win_add_3", "+3 WINS", "Ajoute immédiatement trois points au compteur WINS de l’overlay.", "bedrock-win-add-ai.png", 3, "adjust"],
  ["overlay_win_add_45", "+45 WINS", "Ajoute immédiatement quarante-cinq points au compteur WINS de l’overlay.", "bedrock-win-add-ai.png", 45, "adjust"]
];

const GTAV_MONT_CHILIAD_EFFECTS = Object.freeze([
  ...RAW_EFFECTS.map(
    ([id, name, category, description, imageName, duration = 0], index) => ({
      id,
      code: id,
      name,
      description,
      category,
      duration,
      quantity: 1,
      icon: category === "Joueur" ? "✦" : category === "Véhicule" ? "◇" : "⚡",
      image: `${IMAGE_ROOT}/${imageName}.png`,
      available: true,
      service: "native",
      sortOrder: index
    })
  ),
  ...RAW_WIN_EFFECTS.map(
    ([id, name, description, imageName, amount, operation], index) => ({
      id,
      code: id,
      name,
      description,
      category: "WINS",
      duration: operation === "multiplier" ? 60 : 0,
      quantity: 1,
      icon: "★",
      image: `${IMAGE_ROOT}/${imageName}`,
      available: true,
      service: "overlay",
      sortOrder: RAW_EFFECTS.length + index,
      actionType: "overlay.win-counter",
      winCounter: {
        amount,
        operation
      }
    })
  )
]);

const GTAV_MONT_CHILIAD_DEFAULT_MAPPINGS = Object.freeze([
  gift("mont-relaxed-goose-airport", "chaos_tp_lsairport", "TP AÉROPORT", "Relaxed Goose", 6),
  gift("mont-forever-rosa-chiliad", "chaos_tp_mountchilliad", "TP CHILIAD", "Forever Rosa", 3),
  gift("mont-sunglasses-max-wanted", "chaos_5stars", "RECHERCHE MAX", "Sunglasses", 8),
  gift("mont-boxing-gloves-kill", "chaos_player_suicide", "MORT INSTANTANÉE", "Boxing Gloves", 8),
  gift("mont-rose-random-vehicle", "chaos_vehicle_random", "CHANGER DE VÉHICULE", "Rose", 2),
  gift("mont-corgi-win-x2", "overlay_win_x2", "X2 WINS", "Corgi", 0),
  gift("mont-money-gun-win-minus-1", "overlay_win_remove_1", "-1 WIN", "Money Gun", 0),
  gift("mont-youre-amazing-win-plus-1", "overlay_win_add_1", "+1 WIN", "You’re Amazing", 0),
  gift("mont-ellie-elephant-win-plus-20", "overlay_win_add_20", "+20 WINS", "Ellie the Elephant", 0),
  gift("mont-girafa-win-minus-3", "overlay_win_remove_3", "-3 WINS", "Girafa", 0),
  gift("mont-leon-kitten-win-minus-20", "overlay_win_remove_20", "-20 WINS", "Leon the Kitten", 0),
  gift("mont-voiture-course-win-minus-50", "overlay_win_remove_50", "-50 WINS", "Voiture de course", 0),
  gift("mont-lion-win-random-200", "overlay_win_random_200", "+/- 200 WINS", "Lion", 0),
  gift("mont-galaxy-win-plus-3", "overlay_win_add_3", "+3 WINS", "Galaxy", 0),
  gift("mont-interstellar-win-plus-45", "overlay_win_add_45", "+45 WINS", "Interstellar", 0),
  gift("mont-perfume-big-jump", "chaos_upupaway", "GRAND SAUT", "Perfume", 2),
  gift("mont-heart-me-flip", "chaos_vehicle_flip", "RETOURNER LE VÉHICULE", "Heart Me", 2),
  gift("mont-finger-heart-destroy-vehicle", "chaos_playerveh_explode", "DÉTRUIRE LE VÉHICULE", "Finger Heart", 5),
  gift("mont-hat-mustache-prison", "chaos_prison", "PRISON", "Hat and Mustache", 60),
  gift("mont-sign-language-exit-prison", "chaos_exit_prison", "SORTIE DE PRISON", "Sign language love", 2),
  gift("mont-hand-hearts-black-hole", "chaos_black_hole", "TROU NOIR", "Hand Hearts", 8),
  gift("mont-bruderherz-meteor", "chaos_meteor", "MÉTÉORITE", "Bruderherz", 8),
  gift("mont-family-zombie-horde", "chaos_zombie_horde", "HORDE DE ZOMBIES", "Family", 12),
  gift("mont-doughnut-spawn-alien", "chaos_spawn_alien", "APPARITION D’ALIENS", "Doughnut", 10),
  gift("mont-cap-magnetic-storm", "chaos_magnetic_storm", "TEMPÊTE MAGNÉTIQUE", "Cap", 8),
  gift("mont-confetti-spawn-tank", "chaos_tank_on_head", "TANK SUR LA TÊTE", "Confetti", 10),
  gift("mont-rosa-delete-vehicle", "chaos_delete_vehicle", "SUPPRIMER LE VÉHICULE", "Rosa", 3),
  gift("mont-hearts-random-tp", "chaos_tp_random", "TP ALÉATOIRE", "Hearts", 4),
  {
    id: "mont-follow-random-vehicle",
    effectId: "chaos_vehicle_random",
    title: "CHANGER DE VÉHICULE",
    triggerType: "follow",
    threshold: 1,
    cooldownSeconds: 2,
    enabled: true
  },
  {
    id: "mont-likes-500-random-vehicle",
    effectId: "chaos_vehicle_random",
    title: "CHANGER DE VÉHICULE",
    triggerType: "like",
    threshold: 500,
    cooldownSeconds: 2,
    enabled: true
  },
  {
    id: "mont-catalog-chaos-time-night",
    effectId: "chaos_time_night",
    title: "PASSER EN NUIT",
    triggerType: "gift",
    threshold: 1,
    cooldownSeconds: 0,
    enabled: false,
    triggerEnabled: false
  }
]);

function gift(id, effectId, title, giftName, cooldownSeconds) {
  return {
    id,
    effectId,
    title,
    triggerType: "gift",
    giftName,
    threshold: 1,
    cooldownSeconds,
    enabled: true,
    triggerEnabled: true
  };
}

module.exports = {
  GTAV_MONT_CHILIAD_DEFAULT_MAPPINGS,
  GTAV_MONT_CHILIAD_EFFECTS,
  GTAV_MONT_CHILIAD_GAME_ID: GAME_ID,
  GTAV_MONT_CHILIAD_INTERACTION_CATALOG_VERSION: 10
};
