"use strict";

// Catalogue public Crowd Control relevé le 7 octobre 2026 pour le pack
// ResidentEvil3NET 2.1.2 (version actuelle recommandée du jeu).
const GAME_ID = "resident-evil-3";
const CROWD_CONTROL_IMAGE_ROOT =
  "https://resources.crowdcontrol.live/images/ResidentEvil3/ResidentEvil3NET/icons";

const RAW_EFFECTS = [
  effect("one-hp", "onehp", "Réduire les PV à 1", "Santé du joueur", "Réduit immédiatement les points de vie du personnage à 1.", "onehp", 500),
  effect("heal", "heal", "Soigner le joueur", "Santé du joueur", "Rend une partie des points de vie au personnage.", "heal", 25),
  effect("damage", "damage", "Blesser le joueur", "Santé du joueur", "Inflige des dégâts au personnage sans le tuer directement.", "damage", 50),
  effect("full-heal", "full", "Soin complet", "Santé du joueur", "Restaure complètement les points de vie du personnage.", "full", 100),
  effect("enemy-one-hp", "eonehp", "Réduire les ennemis à 1 PV", "Ennemis", "Réduit à 1 les points de vie des ennemis actuellement chargés.", "eonehp", 100),
  effect("heal-enemies", "eheal", "Soigner les ennemis", "Ennemis", "Rend des points de vie aux ennemis actuellement chargés.", "eheal", 100),
  effect("damage-enemies", "edamage", "Blesser les ennemis", "Ennemis", "Inflige des dégâts aux ennemis actuellement chargés.", "edamage", 50),
  effect("full-heal-enemies", "efull", "Soigner complètement les ennemis", "Ennemis", "Restaure complètement les points de vie des ennemis chargés.", "efull", 350),
  effect("green-herb", "giveheal_herbg", "Donner une herbe verte", "Soins", "Ajoute une herbe verte à l’inventaire si une place est disponible.", "giveheal_herbg", 25),
  effect("blue-herb", "giveheal_herbb", "Donner une herbe bleue", "Soins", "Ajoute une herbe bleue à l’inventaire si une place est disponible.", "giveheal_herbb", 25),
  effect("red-herb", "giveheal_herbr", "Donner une herbe rouge", "Soins", "Ajoute une herbe rouge à l’inventaire si une place est disponible.", "giveheal_herbr", 25),
  effect("green-green-herb", "giveheal_herbgg", "Donner deux herbes vertes", "Soins", "Ajoute un mélange de deux herbes vertes à l’inventaire.", "giveheal_herbgg", 35),
  effect("green-blue-herb", "giveheal_herbgb", "Donner une herbe verte et bleue", "Soins", "Ajoute un mélange d’herbes verte et bleue à l’inventaire.", "giveheal_herbgb", 35),
  effect("green-red-herb", "giveheal_herbgr", "Donner une herbe verte et rouge", "Soins", "Ajoute un mélange d’herbes verte et rouge à l’inventaire.", "giveheal_herbgr", 100),
  effect("first-aid-spray", "giveheal_spray", "Donner un spray de soin", "Soins", "Ajoute un spray de premiers secours à l’inventaire.", "giveheal_spray", 100),
  effect("green-red-blue-herb", "giveheal_herbgrb", "Donner le mélange complet", "Soins", "Ajoute un mélange d’herbes verte, rouge et bleue à l’inventaire.", "giveheal_herbgrb", 150),
  effect("upgrade-heal", "healup", "Améliorer un soin", "Soins", "Améliore un objet de soin présent dans l’inventaire.", "healup", 25),
  effect("downgrade-heal", "healdown", "Dégrader un soin", "Soins", "Dégrade un objet de soin présent dans l’inventaire.", "healdown", 25),
  effect("take-heal", "takeheal", "Retirer un soin", "Inventaire", "Retire un objet de soin de l’inventaire.", "takeheal", 100),
  effect("take-weapon", "takeweap", "Retirer l’arme actuelle", "Armes", "Retire l’arme actuellement équipée lorsque le jeu l’autorise.", "takeweap", 500),
  effect("take-ammo", "takeammo", "Retirer des munitions", "Munitions", "Retire un lot de munitions de l’inventaire.", "takeammo", 100),
  effect("unequip-weapon", "unequipweap", "Déséquiper l’arme", "Armes", "Range immédiatement l’arme équipée.", "unequipweap", 50),
  effect("fill-weapon", "fillweap", "Remplir le chargeur", "Munitions", "Remplit le chargeur de l’arme actuellement équipée.", "fillweap", 25),
  effect("empty-weapon", "emptyweap", "Vider le chargeur", "Munitions", "Vide le chargeur de l’arme actuellement équipée.", "emptyweap", 50),
  effect("g19-handgun", "giveweap_g19", "Donner le pistolet G19", "Armes", "Ajoute le pistolet G19 à l’inventaire.", "give_weapon", 100),
  effect("g18-burst-handgun", "giveweap_burst", "Donner le G18 rafale", "Armes", "Ajoute le pistolet G18 à rafale à l’inventaire.", "give_weapon", 250),
  effect("g18-handgun", "giveweap_g18", "Donner le pistolet G18", "Armes", "Ajoute le pistolet G18 à l’inventaire.", "give_weapon", 250),
  effect("samurai-edge", "giveweap_edge", "Donner le Samurai Edge", "Armes", "Ajoute le Samurai Edge à l’inventaire.", "give_weapon", 250),
  effect("infinite-mup", "giveweap_mup", "Donner le MUP infini", "Armes", "Ajoute le pistolet MUP à munitions infinies.", "give_weapon", 1500),
  effect("m3-shotgun", "giveweap_m3", "Donner le fusil M3", "Armes", "Ajoute le fusil à pompe M3 à l’inventaire.", "give_weapon", 500),
  effect("cqbr-rifle", "giveweap_cqbr", "Donner le fusil CQBR", "Armes", "Ajoute le fusil d’assaut CQBR à l’inventaire.", "give_weapon", 500),
  effect("lightning-hawk", "giveweap_lightning", "Donner le Lightning Hawk", "Armes", "Ajoute le magnum Lightning Hawk à l’inventaire.", "give_weapon", 500),
  effect("raiden", "giveweap_raiden", "Donner le RAIDEN", "Armes", "Ajoute l’arme spéciale RAIDEN à l’inventaire.", "give_weapon", 1000),
  effect("survival-knife", "giveweap_survive", "Donner le couteau de survie", "Armes", "Ajoute le couteau de survie à l’inventaire.", "giveweap_knife", 100),
  effect("combat-knife", "giveweap_knife", "Donner le couteau de combat", "Armes", "Ajoute le couteau de combat à l’inventaire.", "giveweap_knife", 100),
  effect("hot-dogger", "giveweap_hot", "Donner le HOT DOGGER", "Armes", "Ajoute le couteau HOT DOGGER à l’inventaire.", "giveweap_knife", 250),
  effect("hand-grenade", "giveweap_grenade", "Donner une grenade", "Armes", "Ajoute une grenade à main à l’inventaire.", "give_weapon", 25),
  effect("flash-grenade", "giveweap_flash", "Donner une grenade flash", "Armes", "Ajoute une grenade aveuglante à l’inventaire.", "give_weapon", 25),
  effect("infinite-rocket-launcher", "giveweap_rocket", "Donner le lance-roquettes infini", "Armes", "Ajoute le lance-roquettes à munitions infinies.", "give_weapon", 2000),
  effect("handgun-ammo", "giveammo_handgun", "Donner des balles de pistolet", "Munitions", "Ajoute des munitions de pistolet à l’inventaire.", "give_ammo", 10),
  effect("shotgun-ammo", "giveammo_shotgun", "Donner des cartouches", "Munitions", "Ajoute des cartouches de fusil à pompe à l’inventaire.", "give_ammo", 25),
  effect("assault-rifle-ammo", "giveammo_submachine", "Donner des munitions de fusil d’assaut", "Munitions", "Ajoute des munitions de fusil d’assaut à l’inventaire.", "give_ammo", 10),
  effect("mag-ammo", "giveammo_mag", "Donner des munitions MAG", "Munitions", "Ajoute des munitions de magnum à l’inventaire.", "give_ammo", 10),
  effect("mine-rounds", "giveammo_mine", "Donner des mines", "Munitions", "Ajoute des projectiles mine au lance-grenades.", "give_ammo", 25),
  effect("explosive-rounds", "giveammo_explode", "Donner des grenades explosives", "Munitions", "Ajoute des projectiles explosifs au lance-grenades.", "give_ammo", 25),
  effect("acid-rounds", "giveammo_acid", "Donner des grenades acides", "Munitions", "Ajoute des projectiles acides au lance-grenades.", "give_ammo", 25),
  effect("flame-rounds", "giveammo_flame", "Donner des grenades incendiaires", "Munitions", "Ajoute des projectiles incendiaires au lance-grenades.", "give_ammo", 25),
  timedEffect("one-hit-ko", "ohko", "Mort en un coup", "Effets temporaires", "Le moindre dégât peut tuer le personnage pendant 30 secondes.", "ohko", 500, 30),
  timedEffect("invincible", "invul", "Invincibilité", "Effets temporaires", "Rend le personnage invincible pendant 60 secondes.", "invul", 250, 60),
  timedEffect("wide-camera", "wide", "Caméra grand-angle", "Caméra", "Élargit fortement le champ de vision pendant 30 secondes.", "wide", 15, 30),
  timedEffect("narrow-camera", "narrow", "Caméra rapprochée", "Caméra", "Réduit fortement le champ de vision pendant 30 secondes.", "narrow", 15, 30),
  timedEffect("giant-player", "giant", "Personnage géant", "Effets temporaires", "Agrandit le personnage pendant 30 secondes.", "giant", 25, 30),
  timedEffect("tiny-player", "tiny", "Personnage minuscule", "Effets temporaires", "Réduit la taille du personnage pendant 30 secondes.", "tiny", 25, 30),
  timedEffect("giant-enemies", "egiant", "Ennemis géants", "Ennemis", "Agrandit les ennemis actuellement chargés pendant 30 secondes.", "egiant", 25, 30),
  timedEffect("tiny-enemies", "etiny", "Ennemis minuscules", "Ennemis", "Réduit la taille des ennemis actuellement chargés pendant 30 secondes.", "etiny", 25, 30),
  timedEffect("fast-enemies", "efast", "Ennemis rapides", "Ennemis", "Accélère les ennemis actuellement chargés pendant 15 secondes.", "efast", 200, 15),
  timedEffect("slow-enemies", "eslow", "Ennemis ralentis", "Ennemis", "Ralentit les ennemis actuellement chargés pendant 15 secondes.", "eslow", 100, 15),
  effect("spawn-pale-head", "spawn_em8400", "Faire apparaître un Pale Head", "Apparitions", "Fait apparaître un Pale Head près du joueur lorsque la zone l’autorise.", "spawn_em8400", 300),
  effect("spawn-drain-deimos", "spawn_em3500", "Faire apparaître un Drain Deimos", "Apparitions", "Fait apparaître un Drain Deimos près du joueur lorsque la zone l’autorise.", "spawn_em3500", 300),
  effect("spawn-male-zombie", "spawn_em0000", "Faire apparaître un zombie", "Apparitions", "Fait apparaître un zombie masculin près du joueur.", "spawn_em0000", 100),
  effect("spawn-female-zombie", "spawn_em0100", "Faire apparaître une zombie", "Apparitions", "Fait apparaître un zombie féminin près du joueur.", "spawn_em0100", 100),
  effect("spawn-big-zombie", "spawn_em0200", "Faire apparaître un gros zombie", "Apparitions", "Fait apparaître un zombie massif près du joueur.", "spawn_em0200", 125),
  effect("spawn-licker", "spawn_em3000", "Faire apparaître un Licker", "Apparitions", "Fait apparaître un Licker près du joueur lorsque la zone l’autorise.", "spawn_em3000", 150),
  effect("spawn-zombie-dog", "spawn_em4000", "Faire apparaître un chien zombie", "Apparitions", "Fait apparaître un chien zombie près du joueur.", "spawn_em4000", 150),
  effect("spawn-hunter", "spawn_em3300", "Faire apparaître un Hunter", "Apparitions", "Fait apparaître un Hunter près du joueur lorsque la zone l’autorise.", "spawn_em3300", 300),
  effect("spawn-hunter-gamma", "spawn_em3400", "Faire apparaître un Hunter Gamma", "Apparitions", "Fait apparaître un Hunter Gamma près du joueur lorsque la zone l’autorise.", "spawn_em3400", 500),
  effect("spawn-nemesis", "spawn_em9000", "Faire apparaître Nemesis", "Apparitions", "Fait apparaître Nemesis près du joueur lorsque la progression l’autorise.", "spawn_em9000", 1000)
];

const RESIDENT_EVIL_3_EFFECTS = Object.freeze(
  RAW_EFFECTS.map((entry, index) =>
    Object.freeze({
      ...entry,
      available: true,
      service: "native",
      sortOrder: index
    })
  )
);

const RESIDENT_EVIL_3_DEFAULT_MAPPINGS = Object.freeze(
  RESIDENT_EVIL_3_EFFECTS.map((entry) =>
    Object.freeze({
      id: `catalog-${entry.id}`,
      effectId: entry.id,
      title: entry.name,
      triggerType: "gift",
      threshold: 1,
      cooldownSeconds: 0,
      duration: entry.duration,
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
    id: `re3-${id}`,
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
    "Santé du joueur": "♥",
    Ennemis: "☠",
    Soins: "+",
    Inventaire: "▣",
    Armes: "⚔",
    Munitions: "◉",
    "Effets temporaires": "◷",
    Caméra: "◈",
    Apparitions: "◆"
  }[category] || "◇";
}

module.exports = {
  RESIDENT_EVIL_3_DEFAULT_MAPPINGS,
  RESIDENT_EVIL_3_EFFECTS,
  RESIDENT_EVIL_3_GAME_ID: GAME_ID,
  RESIDENT_EVIL_3_INTERACTION_CATALOG_VERSION: 20261007
};
