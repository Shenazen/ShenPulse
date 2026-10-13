"use strict";

const GAME_ID = "rocket-league";

// Séquences clavier et souris vérifiées le 9 octobre 2026 auprès du catalogue
// public de référence. Le format conserve les délais et les états d’origine :
// k = clavier, b = bouton de souris, 0 = enfoncé, 1 = relâché, 2 = appui.
const RAW_EFFECTS = [
  effect(
    "rocket-league-conduite-titubante",
    "rl_rl_drunk_drive",
    "Conduite titubante",
    "Impose une trajectoire désordonnée en accélérant et en alternant les virages à gauche et à droite.",
    "Chaos",
    "↝",
    "k,0,87,0;k,0,65,0;k,2500,65,1;k,0,68,0;k,2250,65,0;k,250,68,1;k,2250,65,1;k,0,68,0;k,750,87,1;k,1750,68,1"
  ),
  effect(
    "rocket-league-pleine-vitesse",
    "rl_rl_full_boost",
    "Pleine vitesse",
    "Maintient l’accélération et le turbo pendant près de dix secondes.",
    "Conduite",
    "⇈",
    "k,0,87,0;b,0,0,0;k,9500,87,1;b,0,0,1"
  ),
  effect(
    "rocket-league-marche-arriere",
    "rl_rl_reverse",
    "Marche arrière",
    "Force la voiture à reculer pendant quatre secondes et demie.",
    "Conduite",
    "↓",
    "k,0,83,0;k,4500,83,1"
  ),
  effect(
    "rocket-league-tete-a-queue",
    "rl_rl_spin_out",
    "Tête-à-queue",
    "Accélère, braque à gauche et active le turbo pour provoquer une rotation incontrôlée.",
    "Chaos",
    "⟳",
    "k,0,65,0;k,0,87,0;b,0,0,0;k,4750,65,1;k,0,87,1;b,0,0,1"
  ),
  effect(
    "rocket-league-sauts-repetes",
    "rl_rl_jump_spam",
    "Sauts à répétition",
    "Maintient l’accélération et déclenche huit sauts successifs.",
    "Chaos",
    "↟",
    "k,0,87,0;b,0,1,2;b,960,1,2;b,1210,1,2;b,960,1,2;b,1210,1,2;b,960,1,2;b,960,1,2;b,1210,1,2;k,960,87,1"
  ),
  effect(
    "rocket-league-derapage-sauvage",
    "rl_rl_powerslide_chaos",
    "Dérapage sauvage",
    "Accélère en maintenant le dérapage, puis braque longuement à gauche et à droite.",
    "Chaos",
    "⌁",
    "k,0,87,0;k,0,17,0;k,0,65,0;k,3250,65,1;k,1250,68,0;k,3250,68,1;k,1250,87,1;k,0,17,1"
  ),
  effect(
    "rocket-league-camera-ballon-en-boucle",
    "rl_rl_camera_spam",
    "Caméra ballon en boucle",
    "Bascule rapidement six fois entre la caméra ballon et la caméra libre.",
    "Caméra et interface",
    "◉",
    "k,0,32,0;k,40,32,1;k,515,32,0;k,40,32,1;k,515,32,0;k,40,32,1;k,515,32,0;k,40,32,1;k,515,32,0;k,40,32,1;k,515,32,0;k,40,32,1"
  ),
  effect(
    "rocket-league-tentative-aerienne",
    "rl_rl_aerial",
    "Tentative aérienne",
    "Enchaîne deux sauts puis maintient le turbo pour tenter une envolée.",
    "Chaos",
    "✦",
    "b,0,1,2;b,515,1,0;b,0,0,0;b,40,1,1;b,4210,0,1"
  ),
  effect(
    "rocket-league-tourner-en-rond",
    "rl_rl_circle",
    "Tourner en rond",
    "Maintient l’accélération et la direction gauche pendant plus de neuf secondes.",
    "Conduite",
    "↺",
    "k,0,65,0;k,0,87,0;k,9250,65,1;k,0,87,1"
  ),
  effect(
    "rocket-league-arret-complet",
    "rl_rl_brake_panic",
    "Arrêt complet",
    "Maintient le frein pendant près de six secondes.",
    "Conduite",
    "■",
    "k,0,83,0;k,5750,83,1"
  ),
  effect(
    "rocket-league-conduite-zigzag",
    "rl_rl_zigzag",
    "Conduite en zigzag",
    "Accélère avec le turbo en alternant plusieurs braquages à gauche et à droite.",
    "Chaos",
    "〰",
    "k,0,87,0;b,0,0,0;k,0,65,0;k,1500,65,1;k,0,68,0;k,1500,68,1;k,250,65,0;k,1500,65,1;k,0,68,0;k,1500,87,1;b,0,0,1;k,0,68,1"
  ),
  effect(
    "rocket-league-salto-arriere",
    "rl_rl_flip_reverse",
    "Salto arrière",
    "Force la marche arrière et déclenche un double saut pour effectuer un salto.",
    "Chaos",
    "⤵",
    "k,0,83,0;b,1250,1,2;b,210,1,2;k,1960,83,1"
  ),
  effect(
    "rocket-league-burnout",
    "rl_rl_burnout",
    "Burnout",
    "Maintient simultanément l’accélération, le frein et le turbo pour faire patiner la voiture.",
    "Chaos",
    "♨",
    "k,0,87,0;k,0,83,0;b,0,0,0;k,3250,83,1;k,2250,87,1;b,0,0,1"
  ),
  effect(
    "rocket-league-accelerer",
    "rl_rl_gas",
    "Accélérer",
    "Maintient l’accélération pendant un peu plus de trois secondes.",
    "Actions directes",
    "↑",
    "k,0,87,0;k,3250,87,1"
  ),
  effect(
    "rocket-league-freiner",
    "rl_rl_brake",
    "Freiner",
    "Maintient le frein pendant deux secondes et demie.",
    "Actions directes",
    "↓",
    "k,0,83,0;k,2500,83,1"
  ),
  effect(
    "rocket-league-sauter",
    "rl_rl_jump",
    "Sauter",
    "Déclenche un saut unique.",
    "Actions directes",
    "↥",
    "b,0,1,2"
  ),
  effect(
    "rocket-league-turbo",
    "rl_rl_boost",
    "Turbo",
    "Maintient le turbo pendant près de deux secondes.",
    "Actions directes",
    "⚡",
    "b,0,0,0;b,1750,0,1"
  ),
  effect(
    "rocket-league-tourner-gauche",
    "rl_rl_steer_left",
    "Tourner à gauche",
    "Maintient la direction gauche pendant près de deux secondes.",
    "Actions directes",
    "←",
    "k,0,65,0;k,1750,65,1"
  ),
  effect(
    "rocket-league-tourner-droite",
    "rl_rl_steer_right",
    "Tourner à droite",
    "Maintient la direction droite pendant deux secondes et demie.",
    "Actions directes",
    "→",
    "k,0,68,0;k,2500,68,1"
  ),
  effect(
    "rocket-league-camera-ballon",
    "rl_rl_ball_cam",
    "Caméra ballon",
    "Bascule entre la caméra ballon et la caméra libre.",
    "Caméra et interface",
    "◎",
    "k,0,32,0;k,40,32,1"
  ),
  effect(
    "rocket-league-tableau-des-scores",
    "rl_rl_scoreboard",
    "Tableau des scores",
    "Affiche le tableau des scores pendant deux secondes et demie.",
    "Caméra et interface",
    "▤",
    "k,0,9,0;k,2500,9,1"
  )
];

function effect(
  id,
  sourceEffectId,
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
    name,
    description,
    category,
    icon,
    available: true,
    inputSequence
  });
}

const ROCKET_LEAGUE_EFFECTS = Object.freeze(RAW_EFFECTS);
const ROCKET_LEAGUE_DEFAULT_MAPPINGS = Object.freeze(
  ROCKET_LEAGUE_EFFECTS.map((entry) =>
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
const ROCKET_LEAGUE_INTERACTION_CATALOG_VERSION = 20261009;

module.exports = {
  GAME_ID,
  ROCKET_LEAGUE_DEFAULT_MAPPINGS,
  ROCKET_LEAGUE_EFFECTS,
  ROCKET_LEAGUE_INTERACTION_CATALOG_VERSION
};
