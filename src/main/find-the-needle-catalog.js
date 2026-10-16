"use strict";

/**
 * Contrat du mod fourni par l’utilisateur : S2E Find The Needle 1.2.7,
 * démo V62 (Steam 5165210, build 25867630). Aucune source du mod n’est redistribuée.
 * Les codes et limites proviennent de commands.json et effects.gd de cette version.
 */
const GAME_ID = "find-the-needle-demo";
const FIND_THE_NEEDLE_CONNECTOR = Object.freeze({
  type: "find-the-needle-http", url: "http://127.0.0.1:55001", timeoutMs: 5000
});

const number = (min, max, defaultValue, label) => ({ kind: "number", min, max, defaultValue, label });
const seconds = (defaultValue = 10, max = 120) => ({ kind: "duration", min: 1, max, defaultValue, label: "Durée (secondes)" });
const target = () => ({ kind: "target", defaultValue: "random", label: "Identifiant ou random (aléatoire)" });
const none = () => ({ kind: "none" });

const DEFINITIONS = [
  ["givemoney", "Donner de l’argent", "Économie", "Ajoute le montant choisi au solde.", number(0, 10000000, 100, "Montant")],
  ["takemoney", "Retirer de l’argent", "Économie", "Retire le montant choisi sans solde négatif.", number(0, 10000000, 100, "Montant")],
  ["setmoney", "Définir le solde", "Économie", "Remplace le solde par le montant choisi.", number(0, 10000000, 100, "Nouveau solde")],
  ["tornado", "Tornade de foin", "Foin", "Disperse du vrai foin récupérable avec une tornade.", seconds(6, 20)],
  ["hayrain", "Pluie de foin", "Foin", "Fait tomber du foin récupérable, sans ajouter d’aiguille.", number(20, 30000, 2000, "Brins de foin")],
  ["scatterhay", "Disperser du foin", "Foin", "Extrait et disperse du foin à ramasser ou vendre.", number(20, 30000, 2000, "Brins de foin")],
  ["sellhay", "Livrer du foin à vendre", "Foin", "Transfère le foin de la meule au tapis de vente.", number(20, 30000, 2000, "Brins de foin")],
  ["haymagnet", "Aimant à foin", "Foin", "Rassemble du foin devant le joueur.", number(1, 120, 40, "Touffes de foin")],
  ["sellloosehay", "Vendre le foin au sol", "Foin", "Amène les touffes de foin proches sur le tapis.", number(1, 120, 40, "Touffes de foin")],
  ["unlocktech", "Débloquer une technologie", "Technologies", "Débloque une technologie éligible, aléatoire ou par identifiant.", target()],
  ["locktech", "Bloquer une technologie", "Technologies", "Bloque une technologie acquise, aléatoire ou par identifiant.", target()],
  ["randomupgrade", "Amélioration aléatoire", "Technologies", "Ajoute un niveau à une technologie disponible dans la démo.", none()],
  ["randomdowngrade", "Régression aléatoire", "Technologies", "Retire une technologie acquise aléatoire.", none()],
  ["lockshop", "Fermer la boutique", "Boutique", "Empêche temporairement les achats.", seconds(20, 180)],
  ["unlockshop", "Rouvrir la boutique", "Boutique", "Annule la fermeture de boutique imposée par le mod.", none()],
  ["stopmachines", "Arrêter les machines", "Machines", "Suspend les machines et le tapis de vente.", seconds(10, 60)],
  ["startmachines", "Redémarrer les machines", "Machines", "Annule l’arrêt des machines imposé par le mod.", none()],
  ["freeze", "Geler le joueur", "Joueur", "Suspend temporairement les déplacements et les outils.", seconds()],
  ["slowmotion", "Ralenti", "Joueur", "Passe temporairement le jeu à une vitesse de 0,5×.", seconds()],
  ["fastforward", "Accélération", "Joueur", "Passe temporairement le jeu à une vitesse de 2×.", seconds()],
  ["stamina", "Endurance infinie", "Joueur", "Régénère continuellement l’endurance.", seconds(20)],
  ["rush", "Extra Life", "Joueur", "Applique le bonus natif de déplacement et de saut.", seconds(15)],
  ["dropheld", "Tout lâcher", "Joueur", "Lâche l’outil ou le récipient tenu avec son foin.", none()],
  ["unlockbuilding", "Débloquer un bâtiment", "Bâtiments", "Débloque un bâtiment du catalogue éligible.", target()],
  ["lockbuilding", "Bloquer un bâtiment", "Bâtiments", "Bloque un bâtiment sans retirer les machines existantes.", target()],
  ["spawnbuilding", "Offrir un bâtiment", "Bâtiments", "Place gratuitement un bâtiment éligible sur un emplacement libre.", target()],
  ["priceup", "Augmenter les prix", "Économie", "Augmente temporairement les prix du catalogue.", { ...number(1, 200, 25, "Hausse (%)"), duration: seconds(30, 300) }],
  ["pricedown", "Baisser les prix", "Économie", "Baisse temporairement les prix, sans descendre sous 10 % du tarif de base.", { ...number(1, 200, 25, "Baisse (%)"), duration: seconds(30, 300) }],
  ["spillhay", "Lâcher le foin uniquement", "Joueur", "Déverse le foin en conservant l’outil ou le récipient.", none()],
  ["fling", "Projeter le joueur", "Joueur", "Projette le joueur grâce à la physique du jeu.", number(3, 18, 10, "Force")],
  ["respawn", "Retour au départ", "Joueur", "Replace le joueur au point d’apparition.", none()],
  ["fisheye", "Vision large", "Ambiance", "Élargit temporairement le champ de vision à 110°.", seconds(15)],
  ["tunnelvision", "Vision en tunnel", "Ambiance", "Réduit temporairement le champ de vision à 35°.", seconds(15)],
  ["blackout", "Obscurité", "Ambiance", "Assombrit temporairement la cour.", seconds(15)],
  ["disco", "Disco", "Ambiance", "Fait varier la couleur de l’éclairage.", seconds(15)],
  ["fog", "Brouillard dense", "Ambiance", "Ajoute temporairement du brouillard dans la cour.", seconds(15)],
  ["reset", "Effacer les effets temporaires", "Gestion", "Annule les effets temporaires et le foin en attente ; ne restaure pas l’argent, les bâtiments ou technologies.", none()]
];

const FIND_THE_NEEDLE_COMMAND_SPECS = Object.freeze(Object.fromEntries(
  DEFINITIONS.map(([code, , , , spec]) => [code, Object.freeze(spec)])
));

function parameter(id, spec) {
  return spec.kind === "target"
    ? { id, type: "text", label: spec.label, defaultValue: "random", maxLength: 80 }
    : { id, label: spec.label, min: spec.min, max: spec.max, step: 1, defaultValue: spec.defaultValue };
}

const FIND_THE_NEEDLE_EFFECTS = Object.freeze(DEFINITIONS.map(([code, name, category, description, spec]) => Object.freeze({
  id: `${GAME_ID}-${code}`, code, sourceEffectId: code, name, category, description,
  available: true, icon: { Foin: "🌾", Économie: "◈", Joueur: "♟", Ambiance: "✦", Bâtiments: "⌂", Technologies: "⚙", Machines: "⚙", Boutique: "◇", Gestion: "↺" }[category],
  parameters: [
    ...(spec.kind === "none" ? [] : [parameter("effect", spec)]),
    ...(spec.duration ? [parameter("duration", spec.duration)] : []),
    ...(["unlocktech", "locktech"].includes(code) ? [{ id: "rank", label: "Niveau demandé (limité par le jeu)", min: 1, max: 100, step: 1, defaultValue: 1 }] : [])
  ]
})));

// Les quatre associations observées dans le modèle gratuit sont conservées.
// Les autres effets sont préparés sans déclencheur : aucun cadeau générique
// ne doit envoyer simultanément les 37 commandes au jeu.
const PRESETS = {
  sellloosehay: { triggerType: "like", threshold: 100 },
  spillhay: { triggerType: "follow" },
  dropheld: { giftName: "Rose", giftId: "5655", giftCost: 1 },
  rush: { giftName: "Cœur avec les doigts", giftId: "5487", giftCost: 5 }
};
const FIND_THE_NEEDLE_DEFAULT_MAPPINGS = Object.freeze(FIND_THE_NEEDLE_EFFECTS.map(effect => Object.freeze({
  id: effect.id, effectId: effect.id, title: effect.name,
  triggerEnabled: Boolean(PRESETS[effect.code]), cooldownSeconds: 1,
  ...PRESETS[effect.code]
})));

module.exports = {
  FIND_THE_NEEDLE_CONNECTOR, FIND_THE_NEEDLE_COMMAND_SPECS,
  FIND_THE_NEEDLE_EFFECTS, FIND_THE_NEEDLE_DEFAULT_MAPPINGS,
  FIND_THE_NEEDLE_INTERACTION_CATALOG_VERSION: 20261015
};
