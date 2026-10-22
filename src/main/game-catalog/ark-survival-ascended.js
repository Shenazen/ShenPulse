"use strict";

const { game } = require("./builders");
// Pack public Crowd Control relevé le 21/10/2026. Les séquences sont conservées
// à l’identique ; seuls les intitulés et les descriptions sont traduits.
const sourceEffects = require("../../../resources/catalogs/ark-survival-ascended-effects.json");

const labels = {
  ark_forward: ["Avancer pendant 3 secondes", "Maintient la commande d’avance pendant trois secondes.", "Déplacements", "↑", "control"],
  ark_backward: ["Reculer pendant 3 secondes", "Maintient la commande de recul pendant trois secondes.", "Déplacements", "↓", "control"],
  ark_strafe_left: ["Aller à gauche pendant 3 secondes", "Maintient le déplacement latéral gauche pendant trois secondes.", "Déplacements", "←", "control"],
  ark_strafe_right: ["Aller à droite pendant 3 secondes", "Maintient le déplacement latéral droit pendant trois secondes.", "Déplacements", "→", "control"],
  ark_sprint: ["Sprint pendant 4 secondes", "Maintient sprint et avance pendant quatre secondes. Nécessite de pouvoir courir.", "Déplacements", "⇈", "control"],
  ark_jump: ["Sauter", "Appuie une fois sur la commande de saut.", "Déplacements", "↟", "control"],
  ark_crouch: ["S’accroupir / se relever", "Bascule la posture accroupie avec la commande du jeu.", "Déplacements", "⇣", "control"],
  ark_prone: ["S’allonger / se relever", "Appuie sur la commande de posture allongée.", "Déplacements", "↧", "control"],
  ark_drunk_walk: ["Marche désordonnée", "Enchaîne les déplacements avant, arrière, gauche et droite pendant quatre secondes.", "Chaos", "↝", "chaos"],
  ark_fire: ["Attaquer / tirer", "Effectue un clic gauche. L’action dépend de l’arme ou de l’outil équipé.", "Combat", "✧", "sabotage"],
  ark_aim: ["Viser pendant 1,5 seconde", "Maintient le clic droit pendant une seconde et demie. Nécessite un équipement compatible.", "Combat", "⊕", "sabotage"],
  ark_reload: ["Recharger", "Appuie sur la commande de rechargement. Nécessite une arme et des munitions compatibles.", "Combat", "↻", "assist"],
  ark_melee: ["Attaque au corps à corps", "Maintient la commande de mêlée pendant une demi-seconde.", "Combat", "✊", "sabotage"],
  ark_toggle_fists: ["Ranger / sortir l’équipement", "Bascule l’équipement en main avec la commande des poings du jeu.", "Équipement", "⌘", "utility"],
  ark_weapon_attachment: ["Activer / désactiver l’accessoire", "Bascule l’accessoire de l’arme. Nécessite un accessoire compatible.", "Équipement", "☼", "utility"],
  ark_use: ["Interagir", "Utilise l’objet ou la créature visée, selon le contexte du jeu.", "Interaction", "↗", "utility"],
  ark_inventory: ["Ouvrir / fermer l’inventaire", "Bascule l’inventaire du joueur.", "Interface", "▣", "utility"],
  ark_access_other: ["Ouvrir l’inventaire ciblé", "Accède à l’inventaire du conteneur ou de la créature visée, si disponible.", "Interface", "▤", "utility"],
  ark_map: ["Ouvrir / fermer la carte", "Appuie sur la commande de carte.", "Interface", "▧", "utility"],
  ark_craftables: ["Ouvrir la fabrication", "Appuie sur la commande du menu de fabrication.", "Interface", "⚒", "progression"],
  ark_hotbar_1: ["Utiliser le raccourci 1", "Utilise l’objet placé dans le premier emplacement de la barre.", "Équipement", "1", "utility"],
  ark_hotbar_2: ["Utiliser le raccourci 2", "Utilise l’objet placé dans le deuxième emplacement de la barre.", "Équipement", "2", "utility"],
  ark_hotbar_3: ["Utiliser le raccourci 3", "Utilise l’objet placé dans le troisième emplacement de la barre.", "Équipement", "3", "utility"],
  ark_drag_body: ["Traîner un corps", "Maintient la commande de transport pendant deux secondes. Nécessite un corps à portée.", "Interaction", "⇥", "utility"],
  ark_jump_spam: ["Dix sauts successifs", "Appuie dix fois sur la commande de saut, à intervalles de 200 ms. Les sauts effectifs dépendent de l’atterrissage.", "Chaos", "⇈", "chaos"],
  ark_fire_spam: ["Huit attaques successives", "Effectue huit clics gauches espacés de 250 ms. Le résultat dépend de l’équipement et de sa cadence.", "Chaos", "✹", "chaos"],
  ark_crouch_spam: ["Accroupissements répétés", "Appuie huit fois sur la commande d’accroupissement, à intervalles de 300 ms.", "Chaos", "↕", "chaos"],
  ark_hotbar_roulette: ["Parcourir les raccourcis 1 à 8", "Active successivement les huit premiers emplacements de la barre. Les objets consommables peuvent être utilisés.", "Chaos", "⌁", "chaos"],
  ark_spin_aim: ["Tourner la caméra en attaquant", "Maintient le clic gauche et déplace la souris vers la droite pendant environ une seconde. L’angle dépend de la sensibilité du jeu.", "Chaos", "⟳", "chaos"]
};

const effects = Object.entries(sourceEffects).map(([code, source]) => {
  const [name, description, category, icon, art] = labels[code];
  return {
    id: code.replaceAll("_", "-"), code, sourceEffectId: code,
    sourceName: source.name, name, description, category, icon,
    image: `../../resources/game-interactions/ark-survival-ascended/ark-survival-ascended-cc-${art}.webp`,
    available: true, inputSequence: source.action.sequence.events,
    // Les chiffres de la barre doivent aussi fonctionner sans Maj sur AZERTY.
    ...(/^ark_hotbar_/.test(code) ? { keyboardInputMode: "scan-code" } : {})
  };
});

const ARK_SURVIVAL_ASCENDED = game("ark-survival-ascended", "ARK: Survival Ascended", {
  included: true,
  artworkUrl: "https://resources.crowdcontrol.live/images/ARKSurvivalAscended/box.jpg",
  source: "Crowd Control · ARK Input Disrupts",
  description: "29 interactions clavier et souris pour les déplacements, le combat, les inventaires et les raccourcis. Préparation automatique Steam ou Xbox Game Pass.",
  tags: ["inclus", "clavier et souris", "Steam", "Game Pass"],
  installerVersion: "1.0.0", interactionCatalogVersion: 20261021,
  connector: { type: "windows-input", processName: "ArkAscended.exe", keyLayout: "azerty" },
  effects,
  defaultMappings: effects.map(effect => ({
    id: `catalog-${effect.id}`, effectId: effect.id, title: effect.name,
    triggerType: "gift", threshold: 1, cooldownSeconds: 0,
    enabled: true, triggerEnabled: false
  }))
});

module.exports = { ARK_SURVIVAL_ASCENDED };
