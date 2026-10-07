"use strict";

const GAME_ID = "demonologist";

// Séquences du pack Demonologist officiel de Crowd Control relevées le
// 7 octobre 2026. Le catalogue reste complet pour les utilisateurs de la
// version intégrale ; la Démo Steam n’expose qu’une partie de ces commandes.
const RAW_EFFECTS = [
  effect(
    "tipsy-walk",
    "d_demo_drunk_walk",
    "Tipsy Walk",
    "Marche titubante",
    "Enchaîne des déplacements désordonnés dans les quatre directions.",
    "Chaos",
    "⌁",
    "k,0,87,0;k,0,65,0;k,400,65,1;k,0,68,0;k,400,87,1;k,0,68,1;k,0,83,0;k,0,68,0;k,400,68,1;k,0,65,0;k,400,83,1;k,0,65,1;k,0,87,0;k,0,65,0;k,400,65,1;k,0,68,0;k,400,87,1;k,0,68,1;k,0,83,0;k,0,68,0;k,400,68,1;k,0,65,0;k,400,83,1;k,0,65,1;k,0,87,0;k,0,65,0;k,400,65,1;k,0,68,0;k,400,87,1;k,0,68,1;k,0,83,0;k,0,68,0;k,400,68,1;k,0,65,0;k,400,83,1;k,0,65,1"
  ),
  effect(
    "flashlight-spam",
    "d_demo_flashlight_rave",
    "Flashlight Spam",
    "Lampe stroboscopique",
    "Allume et éteint frénétiquement la lampe torche.",
    "Équipement",
    "☼",
    "k,0,70,2;k,200,70,2;k,200,70,2;k,200,70,2;k,200,70,2;k,200,70,2;k,200,70,2;k,200,70,2;k,200,70,2;k,200,70,2"
  ),
  effect(
    "panic-sprint",
    "d_demo_panic_sprint",
    "Panic Sprint",
    "Sprint paniqué",
    "Force un sprint vers l’avant avec des écarts à gauche et à droite.",
    "Déplacements",
    "⇈",
    "k,0,16,0;k,0,87,0;k,1500,65,0;k,1000,65,1;k,0,68,0;k,1500,68,1;k,0,16,1;k,0,87,1"
  ),
  effect(
    "equipment-spam",
    "d_demo_item_roulette",
    "Equipment Spam",
    "Roulette d’équipement",
    "Parcourt rapidement les emplacements d’équipement.",
    "Équipement",
    "⌘",
    "k,0,49,2;k,400,50,2;k,400,51,2;k,400,52,2;k,400,49,2;k,400,50,2"
  ),
  effect(
    "drop-and-pick-up",
    "d_demo_drop_panic",
    "Item Drop n' Pick Up",
    "Lâcher et ramasser",
    "Lâche l’objet courant puis tente de le ramasser à plusieurs reprises. Nécessite un objet équipé et correctement visé au sol.",
    "Équipement",
    "↕",
    "k,0,71,2;k,800,69,2;k,800,71,2;k,800,69,2"
  ),
  effect(
    "sneaky-crawl",
    "d_demo_crouch_hide",
    "Sneaky Crawl",
    "Reptation discrète",
    "Maintient l’accroupissement et recule pendant huit secondes.",
    "Déplacements",
    "⇣",
    "k,0,17,0;k,0,83,0;k,8000,17,1;k,0,83,1"
  ),
  effect(
    "journal-spam",
    "d_demo_journal_panic",
    "Journal Spam",
    "Journal frénétique",
    "Ouvre et ferme rapidement le journal d’enquête.",
    "Interface",
    "▤",
    "k,0,74,2;k,300,74,2;k,300,74,2;k,300,74,2;k,300,74,2;k,300,74,2;k,300,74,2"
  ),
  effect(
    "interact-spam",
    "d_demo_interact_spam",
    "Interact Spam",
    "Interactions frénétiques",
    "Appuie rapidement et plusieurs fois sur la touche d’interaction. Nécessite un élément interactif visé.",
    "Actions directes",
    "✦",
    "k,0,69,2;k,300,69,2;k,300,69,2;k,300,69,2;k,300,69,2;k,300,69,2;k,300,69,2"
  ),
  effect(
    "backwards-run",
    "d_demo_backwards_run",
    "Backwards Run",
    "Course arrière",
    "Force un sprint en arrière pendant six secondes et demie.",
    "Déplacements",
    "⇊",
    "k,0,16,0;k,0,83,0;k,6500,16,1;k,0,83,1"
  ),
  effect(
    "interact",
    "d_demo_interact",
    "Interact",
    "Interagir",
    "Interagit une fois avec l’objet visé. Nécessite un élément interactif à portée.",
    "Actions directes",
    "E",
    "k,0,69,2"
  ),
  effect(
    "flashlight",
    "d_demo_flashlight",
    "Flashlight",
    "Lampe torche",
    "Bascule une fois l’état de la lampe torche.",
    "Équipement",
    "☀",
    "k,0,70,2"
  ),
  effect(
    "drop-item",
    "d_demo_drop",
    "Drop Item",
    "Lâcher l’objet",
    "Lâche immédiatement l’objet actuellement équipé. Sans objet en main, aucun effet n’est visible.",
    "Équipement",
    "↓",
    "k,0,71,2"
  ),
  effect(
    "slot-1",
    "d_demo_slot1",
    "Slot 1",
    "Équipement 1",
    "Sélectionne le premier emplacement d’équipement.",
    "Équipement",
    "1",
    "k,0,49,2"
  ),
  effect(
    "slot-2",
    "d_demo_slot2",
    "Slot 2",
    "Équipement 2",
    "Sélectionne le deuxième emplacement d’équipement.",
    "Équipement",
    "2",
    "k,0,50,2"
  ),
  effect(
    "slot-3",
    "d_demo_slot3",
    "Slot 3",
    "Équipement 3",
    "Sélectionne le troisième emplacement d’équipement.",
    "Équipement",
    "3",
    "k,0,51,2"
  ),
  effect(
    "open-journal",
    "d_demo_journal",
    "Open Journal",
    "Ouvrir le journal",
    "Ouvre ou ferme le journal d’enquête.",
    "Interface",
    "▤",
    "k,0,74,2"
  ),
  effect(
    "jump",
    "d_demo_jump",
    "Jump",
    "Sauter",
    "Déclenche un saut.",
    "Déplacements",
    "↑",
    "k,0,32,2"
  ),
  effect(
    "open-map",
    "d_demo_map",
    "Open Map",
    "Ouvrir la carte",
    "Ouvre ou ferme la carte.",
    "Interface",
    "⌖",
    "k,0,77,2"
  ),
  effect(
    "sprint-forward",
    "d_demo_sprint",
    "Sprint Forward",
    "Sprint avant",
    "Force un sprint vers l’avant pendant quatre secondes.",
    "Déplacements",
    "⇧",
    "k,0,16,0;k,0,87,0;k,4000,16,1;k,0,87,1"
  ),
  effect(
    "crouch",
    "d_demo_crouch",
    "Crouch",
    "S’accroupir",
    "Maintient la touche d’accroupissement pendant une seconde et demie.",
    "Déplacements",
    "⇣",
    "k,0,17,0;k,1500,17,1"
  ),
  effect(
    "walk-forward",
    "d_demo_walk",
    "Walk Forward",
    "Marcher en avant",
    "Force la marche vers l’avant pendant trois secondes.",
    "Déplacements",
    "↑",
    "k,0,87,0;k,3000,87,1"
  ),
  effect(
    "strafe-left",
    "d_demo_strafe_left",
    "Strafe Left",
    "Pas à gauche",
    "Force un déplacement vers la gauche pendant trois secondes.",
    "Déplacements",
    "←",
    "k,0,65,0;k,3000,65,1"
  ),
  effect(
    "strafe-right",
    "d_demo_strafe_right",
    "Strafe Right",
    "Pas à droite",
    "Force un déplacement vers la droite pendant trois secondes.",
    "Déplacements",
    "→",
    "k,0,68,0;k,3000,68,1"
  ),
  effect(
    "use-tool",
    "d_demo_tool_use",
    "Use Tool",
    "Utiliser l’outil",
    "Utilise une fois l’outil actuellement équipé. Nécessite un outil utilisable en main.",
    "Outils",
    "●",
    "b,0,0,2"
  ),
  effect(
    "rotate-tool",
    "d_demo_rotate_tool",
    "Rotate Tool",
    "Faire pivoter l’outil",
    "Actionne le bouton droit pour faire pivoter l’outil courant.",
    "Outils",
    "↻",
    "b,0,2,2"
  ),
  effect(
    "push-to-talk",
    "d_demo_ptt",
    "Push to Talk",
    "Maintenir le micro",
    "Maintient V pendant deux secondes. Cette action n’émet aucun son seule : le microphone doit être configuré et une voix doit parler pendant ce délai.",
    "Communication",
    "◉",
    "k,0,86,0;k,2000,86,1"
  ),
  effect(
    "text-to-speech-key",
    "d_demo_tts",
    "Text to Speech",
    "Déclencher la voix du jeu",
    "Appuie sur la touche prévue par le pack pour la synthèse vocale.",
    "Communication",
    "♪",
    "k,0,80,2"
  ),
  effect(
    "crouch-spam",
    "d_demo_crouch_spam",
    "Crouch Spam",
    "Accroupissements répétés",
    "Alterne rapidement les positions debout et accroupie.",
    "Chaos",
    "↕",
    "k,0,17,0;k,250,17,1;k,250,17,0;k,250,17,1;k,250,17,0;k,250,17,1;k,250,17,0;k,250,17,1;k,250,17,0;k,250,17,1"
  ),
  effect(
    "jump-spam",
    "d_demo_jump_spam",
    "Jump Spam",
    "Sauts répétés",
    "Déclenche dix sauts très rapprochés.",
    "Chaos",
    "⇈",
    "k,0,32,2;k,200,32,2;k,200,32,2;k,200,32,2;k,200,32,2;k,200,32,2;k,200,32,2;k,200,32,2;k,200,32,2;k,200,32,2"
  ),
  effect(
    "slot-spam",
    "d_demo_slot_spam",
    "Slot Spam",
    "Équipements frénétiques",
    "Parcourt très rapidement quatre emplacements d’équipement.",
    "Chaos",
    "⌘",
    "k,0,49,2;k,200,50,2;k,200,51,2;k,200,52,2;k,200,49,2;k,200,50,2;k,200,51,2;k,200,52,2"
  ),
  effect(
    "spin-aim",
    "d_demo_spin",
    "Spin Aim",
    "Rotation de la caméra",
    "Fait tourner rapidement la caméra vers la droite.",
    "Chaos",
    "⟳",
    "r,0,60,0;r,50,60,0;r,50,60,0;r,50,60,0;r,50,60,0;r,50,60,0;r,50,60,0;r,50,60,0;r,50,60,0;r,50,60,0;r,50,60,0;r,50,60,0;r,50,60,0;r,50,60,0;r,50,60,0;r,50,60,0;r,50,60,0;r,50,60,0;r,50,60,0;r,50,60,0;r,50,60,0;r,50,60,0;r,50,60,0;r,50,60,0"
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
    id: `${GAME_ID}-${id}`,
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

const DEMONOLOGIST_EFFECTS = Object.freeze(RAW_EFFECTS);
const DEMONOLOGIST_DEFAULT_MAPPINGS = Object.freeze(
  DEMONOLOGIST_EFFECTS.map((entry) =>
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
const DEMONOLOGIST_INTERACTION_CATALOG_VERSION = 20261007;

module.exports = {
  DEMONOLOGIST_DEFAULT_MAPPINGS,
  DEMONOLOGIST_EFFECTS,
  DEMONOLOGIST_INTERACTION_CATALOG_VERSION,
  GAME_ID
};
