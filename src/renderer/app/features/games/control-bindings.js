"use strict";

/** Commandes à attribuer dans les options du jeu, indépendantes des interactions composées. */
const GAME_MOVEMENT_BINDINGS = [
  ["Avancer", "k:87"], ["Reculer", "k:83"],
  ["Se déplacer à gauche", "k:65"], ["Se déplacer à droite", "k:68"]
];

const GAME_CONTROL_BINDINGS = {
  fortnite: [
    ...GAME_MOVEMENT_BINDINGS,
    ["Sprinter", "k:16"], ["Sauter", "k:32"], ["S’accroupir / glisser", "k:17"],
    ["Recharger", "k:82"], ["Roue des emotes", "k:66"], ["Afficher la carte", "k:77"],
    ["Outil de collecte / pioche", "k:88"],
    ...Array.from({ length: 5 }, (_, index) => [`Emplacement d’arme ${index + 1}`, `k:${49 + index}`])
  ],
  "rocket-league": [
    ["Accélérer", "k:87"], ["Freiner / reculer", "k:83"],
    ["Tourner à gauche", "k:65"], ["Tourner à droite", "k:68"],
    ["Déraper", "k:17"], ["Sauter", "b:1"], ["Turbo", "b:0"],
    ["Caméra ballon", "k:32"], ["Tableau des scores", "k:9"]
  ],
  demonologist: [
    ...GAME_MOVEMENT_BINDINGS,
    ["Courir", "k:16"], ["Sauter", "k:32"], ["S’accroupir", "k:17"],
    ["Interagir / ramasser", "k:69"], ["Lampe torche", "k:70"], ["Lâcher l’objet", "k:71"],
    ["Ouvrir le journal", "k:74"], ["Afficher la carte", "k:77"],
    ...Array.from({ length: 4 }, (_, index) => [`Emplacement d’équipement ${index + 1}`, `k:${49 + index}`]),
    ["Utiliser l’outil", "b:0"], ["Faire pivoter l’outil", "b:2"],
    ["Microphone — appuyer pour parler", "k:86"], ["Commande vocale par texte", "k:80"],
    ["Regarder autour de soi", "r"]
  ],
  "dead-by-daylight": [
    ...GAME_MOVEMENT_BINDINGS.map(([name, key]) => [name, key, "Survivant et tueur"]),
    ["Courir", "k:16", "Survivant"], ["S’accroupir", "k:17", "Survivant"],
    ["Action — franchir, palette, casier", "k:32", "Survivant"],
    ["Se débattre à gauche", "k:32", "Survivant"], ["Se débattre à droite", "k:32", "Survivant"],
    ["Lâcher l’objet", "k:82", "Survivant"],
    ["Désigner / pointer du doigt", "k:49", "Survivant"], ["Suivez-moi / venez ici", "k:50", "Survivant"],
    ["Attaquer", "b:0", "Tueur"], ["Utiliser le pouvoir", "b:1", "Tueur"],
    ["Briser / franchir", "k:32", "Tueur"]
  ],
  "ark-survival-ascended": [
    ...GAME_MOVEMENT_BINDINGS,
    ["Courir", "k:16"], ["Sauter", "k:32"], ["S’accroupir", "k:67"], ["S’allonger", "k:88"],
    ["Attaquer / tirer", "b:0"], ["Viser / attaque secondaire", "b:1"],
    ["Recharger", "k:82"], ["Attaque au corps à corps", "k:17"],
    ["Poings — ranger / sortir l’équipement", "k:81"], ["Activer l’accessoire de l’arme", "k:78"],
    ["Interagir / utiliser", "k:69"], ["Ouvrir l’inventaire", "k:73"], ["Ouvrir l’inventaire de la cible", "k:70"],
    ["Afficher la carte", "k:77"], ["Ouvrir la fabrication", "k:86"], ["Traîner un corps", "k:71"],
    ...Array.from({ length: 8 }, (_, index) => [`Emplacement de barre rapide ${index + 1}`, `k:${49 + index}`]),
    ["Regarder autour de soi", "r"]
  ]
};

function gameConditionInputRows(pack) {
  const config = snapshot.state.game?.connectorOverrides?.[pack.id] || {};
  const layout = String(config.keyLayout || pack.connector?.keyLayout || "azerty").toLowerCase();
  const movement = layout === "wasd" ? {} : layout === "zsqd"
    ? { 87: 90, 65: 83, 83: 81 } : { 87: 90, 65: 81 };
  const labels = { 9: "Tab", 16: "Maj gauche", 17: "Ctrl gauche", 32: "Espace" };
  return (GAME_CONTROL_BINDINGS[pack.id] || []).map(([name, input, role]) => {
    const [kind, rawCode] = input.split(":"), code = Number(rawCode);
    let key;
    if (kind === "b") key = ["Clic gauche", "Clic droit", "Clic molette"][code];
    else if (kind === "r") key = "Mouvement de la souris";
    else {
      let mapped = movement[code] || code;
      if (pack.id === "dead-by-daylight" && config.gestureKeys === "letters") {
        if (code === 49) mapped = 80;
        else if (code === 50) mapped = 79;
      }
      if (pack.id === "ark-survival-ascended" && layout === "azerty" && code === 81) mapped = 65;
      key = labels[mapped] || String.fromCharCode(mapped);
    }
    return { name, role: role || "", keys: [key], input };
  });
}
