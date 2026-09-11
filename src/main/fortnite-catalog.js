"use strict";

const GAME_ID = "fortnite";

// Séquences relevées dans le pack Fortnite officiel de Crowd Control le
// 9 septembre 2026. Le format est : clavier, délai, code virtuel, état
// (0 = touche enfoncée, 1 = touche relâchée).
const RAW_EFFECTS = [
  effect(
    "fortnite-tipsy-walk",
    "f_drunk_walk",
    "Tipsy Walk",
    "Déplacements désordonnés",
    "Déplace le joueur successivement en avant, à gauche, à droite, en arrière, à gauche, en avant puis à droite.",
    "Déplacements",
    "↝",
    "k,0,87,0;k,1500,87,1;k,15,65,0;k,1500,65,1;k,15,68,0;k,2250,68,1;k,15,83,0;k,1500,83,1;k,15,65,0;k,1500,65,1;k,15,87,0;k,2250,87,1;k,15,68,0;k,2250,68,1"
  ),
  effect(
    "fortnite-rhythm-jumps",
    "f_disco_fever",
    "Emote Jump",
    "Six sauts en rythme",
    "Déclenche exactement six sauts espacés. La séquence Crowd Control n’ouvre aucune emote.",
    "Déplacements",
    "↟",
    "k,500,32,0;k,40,32,1;k,1210,32,0;k,40,32,1;k,960,32,0;k,40,32,1;k,1210,32,0;k,40,32,1;k,1210,32,0;k,40,32,1;k,960,32,0;k,40,32,1"
  ),
  effect(
    "fortnite-sprint-route",
    "f_panic_sprint",
    "Random Run",
    "Sprint avant-gauche-droite-avant",
    "Maintient le sprint et impose quatre directions de 2,5 secondes. L’ordre est fixe, pas aléatoire.",
    "Déplacements",
    "⌁",
    "k,0,16,0;k,0,87,0;k,2500,87,1;k,0,65,0;k,2500,65,1;k,0,68,0;k,2500,68,1;k,0,87,0;k,2500,16,1;k,0,87,1"
  ),
  effect(
    "fortnite-strafe-dance",
    "f_sidestep_dancer",
    "Strafe Dance",
    "Pas latéraux alternés",
    "Alterne quatre déplacements à gauche et quatre à droite pendant environ dix secondes.",
    "Déplacements",
    "↔",
    "k,0,65,0;k,1250,65,1;k,15,68,0;k,1250,68,1;k,15,65,0;k,1250,65,1;k,15,68,0;k,1250,68,1;k,15,65,0;k,1250,65,1;k,15,68,0;k,1250,68,1;k,15,65,0;k,1250,65,1;k,15,68,0;k,1250,68,1"
  ),
  effect(
    "fortnite-backwards-walk",
    "f_moonwalk_warrior",
    "Backwards Walk",
    "Recul forcé pendant 9 secondes",
    "Maintient la touche de recul pendant 9,25 secondes.",
    "Déplacements",
    "↓",
    "k,0,83,0;k,9250,83,1"
  ),
  effect(
    "fortnite-jump-spam",
    "f_bunny_hopper",
    "Jump Spam",
    "Course avec sauts répétés",
    "Maintient sprint et avance tout en déclenchant quinze sauts pendant environ huit secondes.",
    "Déplacements",
    "⇈",
    "k,0,16,0;k,0,87,0;k,0,32,0;k,40,32,1;k,460,32,0;k,40,32,1;k,460,32,0;k,40,32,1;k,460,32,0;k,40,32,1;k,460,32,0;k,40,32,1;k,460,32,0;k,40,32,1;k,460,32,0;k,40,32,1;k,460,32,0;k,40,32,1;k,460,32,0;k,40,32,1;k,460,32,0;k,40,32,1;k,460,32,0;k,40,32,1;k,460,32,0;k,40,32,1;k,460,32,0;k,40,32,1;k,460,32,0;k,40,32,1;k,460,32,0;k,40,32,1;k,960,16,1;k,0,87,1"
  ),
  effect(
    "fortnite-weapon-carousel",
    "f_weapon_carousel",
    "Weapon Spam",
    "Défilement rapide des armes",
    "Parcourt rapidement les emplacements d’équipement 1 à 5 selon la séquence Crowd Control.",
    "Équipement",
    "⌘",
    "k,0,49,0;k,40,49,1;k,515,50,0;k,40,50,1;k,515,51,0;k,40,51,1;k,515,52,0;k,40,52,1;k,515,53,0;k,40,53,1;k,515,49,0;k,40,49,1;k,515,51,0;k,40,51,1;k,515,53,0;k,40,53,1;k,515,50,0;k,40,50,1;k,515,52,0;k,40,52,1;k,515,49,0;k,40,49,1;k,515,53,0;k,40,53,1;k,515,51,0;k,40,51,1;k,515,50,0;k,40,50,1;k,515,52,0;k,40,52,1"
  ),
  effect(
    "fortnite-reload-spam",
    "f_reload_neurosis",
    "Reload Spam",
    "Rechargements répétés",
    "Appuie onze fois sur la touche de rechargement pendant environ neuf secondes.",
    "Équipement",
    "↻",
    "k,0,82,0;k,40,82,1;k,765,82,0;k,40,82,1;k,765,82,0;k,40,82,1;k,765,82,0;k,40,82,1;k,765,82,0;k,40,82,1;k,765,82,0;k,40,82,1;k,765,82,0;k,40,82,1;k,765,82,0;k,40,82,1;k,765,82,0;k,40,82,1;k,765,82,0;k,40,82,1;k,765,82,0;k,40,82,1"
  ),
  effect(
    "fortnite-crouch-spam",
    "f_teabag_dance",
    "Teabag",
    "Accroupissements répétés",
    "Appuie quinze fois sur la touche d’accroupissement.",
    "Déplacements",
    "↕",
    "k,0,17,0;k,40,17,1;k,265,17,0;k,40,17,1;k,265,17,0;k,40,17,1;k,265,17,0;k,40,17,1;k,265,17,0;k,40,17,1;k,265,17,0;k,40,17,1;k,265,17,0;k,40,17,1;k,265,17,0;k,40,17,1;k,265,17,0;k,40,17,1;k,265,17,0;k,40,17,1;k,265,17,0;k,40,17,1;k,265,17,0;k,40,17,1;k,265,17,0;k,40,17,1;k,265,17,0;k,40,17,1;k,265,17,0;k,40,17,1"
  ),
  effect(
    "fortnite-emote-wheel",
    "f_emote_party",
    "Emote Picker",
    "Ouvrir la roue des emotes",
    "Ouvre la roue des emotes sans sélectionner ni jouer une emote.",
    "Interface",
    "☺",
    "k,0,66,0;k,40,66,1"
  ),
  effect(
    "fortnite-map-spam",
    "f_map_checker",
    "Map Spam",
    "Carte ouverte et fermée à répétition",
    "Bascule sept fois l’affichage de la carte pendant environ six secondes.",
    "Interface",
    "▧",
    "k,0,77,0;k,40,77,1;k,1015,77,0;k,40,77,1;k,1015,77,0;k,40,77,1;k,1015,77,0;k,40,77,1;k,1015,77,0;k,40,77,1;k,1015,77,0;k,40,77,1;k,1015,77,0;k,40,77,1"
  ),
  effect(
    "fortnite-forward-left",
    "f_circle_runner",
    "Circle Shooter",
    "Déplacement diagonal avant-gauche",
    "Maintient avance et gauche pendant 7,5 secondes. La séquence Crowd Control ne tire pas.",
    "Déplacements",
    "↖",
    "k,0,87,0;k,0,65,0;k,7500,87,1;k,0,65,1"
  ),
  effect(
    "fortnite-crouch-walk",
    "f_crouch_walk",
    "Sneaky Walk",
    "Avance accroupie pendant 10 secondes",
    "Maintient simultanément accroupissement et avance pendant 10,5 secondes.",
    "Déplacements",
    "⇥",
    "k,0,17,0;k,0,87,0;k,10500,17,1;k,0,87,1"
  ),
  effect(
    "fortnite-chaos-mode",
    "f_adhd_agent",
    "Chaos Mode",
    "Commandes chaotiques",
    "Enchaîne déplacements, sauts, accroupissements et changements d’équipement pendant environ huit secondes.",
    "Chaos",
    "✦",
    "k,0,87,0;k,1000,87,1;k,15,49,0;k,40,49,1;k,15,32,0;k,40,32,1;k,15,65,0;k,1000,65,1;k,15,50,0;k,40,50,1;k,15,17,0;k,40,17,1;k,15,68,0;k,1000,68,1;k,15,51,0;k,40,51,1;k,15,32,0;k,40,32,1;k,15,83,0;k,1000,83,1;k,15,52,0;k,40,52,1;k,15,17,0;k,40,17,1;k,15,87,0;k,1000,87,1;k,15,53,0;k,40,53,1;k,15,32,0;k,40,32,1;k,15,65,0;k,1000,65,1;k,15,49,0;k,40,49,1;k,15,17,0;k,40,17,1;k,15,68,0;k,1000,68,1;k,15,88,0;k,40,88,1;k,15,32,0;k,40,32,1"
  ),
  effect(
    "fortnite-jump",
    "f_jump",
    "Jump",
    "Saut",
    "Appuie une fois sur la touche de saut.",
    "Actions directes",
    "↑",
    "k,0,32,0;k,40,32,1"
  ),
  effect(
    "fortnite-crouch",
    "f_crouch",
    "Crouch",
    "Maintenir accroupi pendant 5 secondes",
    "Maintient la touche d’accroupissement pendant cinq secondes.",
    "Actions directes",
    "⇣",
    "k,0,17,0;k,5000,17,1"
  ),
  effect(
    "fortnite-reload",
    "f_reload",
    "Reload",
    "Recharger",
    "Appuie une fois sur la touche de rechargement.",
    "Actions directes",
    "⟳",
    "k,0,82,0;k,40,82,1"
  ),
  effect(
    "fortnite-weapon-slot-1",
    "f_weapon_1",
    "Weapon 1",
    "Sélectionner l’emplacement d’arme 1",
    "Sélectionne directement l’équipement placé dans l’emplacement 1.",
    "Actions directes",
    "1",
    "k,0,49,0;k,40,49,1"
  ),
  effect(
    "fortnite-weapon-slot-2",
    "f_weapon_2",
    "Weapon 2",
    "Sélectionner l’emplacement d’arme 2",
    "Sélectionne directement l’équipement placé dans l’emplacement 2.",
    "Actions directes",
    "2",
    "k,0,50,0;k,40,50,1"
  ),
  effect(
    "fortnite-weapon-slot-3",
    "f_weapon_3",
    "Weapon 3",
    "Sélectionner l’emplacement d’arme 3",
    "Sélectionne directement l’équipement placé dans l’emplacement 3.",
    "Actions directes",
    "3",
    "k,0,51,0;k,40,51,1"
  ),
  effect(
    "fortnite-weapon-slot-4",
    "f_weapon_4",
    "Weapon 4",
    "Sélectionner l’emplacement d’arme 4",
    "Sélectionne directement l’équipement placé dans l’emplacement 4.",
    "Actions directes",
    "4",
    "k,0,52,0;k,40,52,1"
  ),
  effect(
    "fortnite-weapon-slot-5",
    "f_weapon_5",
    "Weapon 5",
    "Sélectionner l’emplacement d’arme 5",
    "Sélectionne directement l’équipement placé dans l’emplacement 5.",
    "Actions directes",
    "5",
    "k,0,53,0;k,40,53,1"
  )
];

function effect(
  id,
  sourceEffectId,
  sourceName,
  name,
  description,
  category,
  icon,
  inputSequence
) {
  return Object.freeze({
    id,
    code: sourceEffectId,
    sourceEffectId,
    sourceName,
    name,
    description,
    category,
    icon,
    available: true,
    inputSequence
  });
}

const FORTNITE_EFFECTS = Object.freeze(RAW_EFFECTS);
const FORTNITE_DEFAULT_MAPPINGS = Object.freeze(
  FORTNITE_EFFECTS.map((entry) =>
    Object.freeze({
      id: entry.id,
      effectId: entry.id,
      title: entry.name,
      triggerType: "gift",
      threshold: 1,
      cooldownSeconds: 0,
      enabled: true,
      triggerEnabled: false
    })
  )
);
const FORTNITE_INTERACTION_CATALOG_VERSION = 20260909;

module.exports = {
  FORTNITE_DEFAULT_MAPPINGS,
  FORTNITE_EFFECTS,
  FORTNITE_INTERACTION_CATALOG_VERSION,
  GAME_ID
};
