"use strict";

const GAME_ID = "crash-bandicoot-n-sane-trilogy";
const rows = [
  ["givelife", "Ajouter des vies", "Compteurs", "Ajoute des vies, dans la limite de 99.", 0, 9],
  ["takelife", "Retirer des vies", "Compteurs", "Retire des vies sans descendre sous zéro.", 0, 9],
  ["givefruit", "Ajouter des fruits Wumpa", "Compteurs", "Ajoute des fruits Wumpa au compteur courant.", 0, 255],
  ["takefruit", "Retirer des fruits Wumpa", "Compteurs", "Retire des fruits Wumpa disponibles.", 0, 255],
  ["giveboxes", "Ajouter des caisses", "Compteurs", "Augmente le compteur de caisses du niveau, sans dépasser son total.", 0, 9],
  ["takeboxes", "Retirer des caisses", "Compteurs", "Diminue le compteur de caisses du niveau.", 0, 9],
  ["infinitejump", "Sauts infinis", "Déplacement", "Permet de sauter à nouveau en l’air.", 10],
  ["invisiblefloor", "Sol invisible", "Visuel", "Masque temporairement l’affichage du sol.", 10],
  ["groundspeed_300", "Course accélérée", "Déplacement", "Triple la vitesse de déplacement.", 15],
  ["groundspeed_50", "Course ralentie", "Déplacement", "Divise la vitesse de déplacement par deux.", 15],
  ["groundspeed_m100", "Déplacement inversé", "Déplacement", "Inverse les déplacements du personnage.", 15],
  ["nojump", "Saut interdit", "Déplacement", "Empêche temporairement de sauter.", 5],
  ["nospin", "Actions interdites", "Déplacement", "Désactive temporairement les actions, dont la tornade.", 10],
  ["burnorcalmeyes_300", "Lumière éblouissante", "Visuel", "Renforce fortement la luminosité.", 20],
  ["burnorcalmeyes_20", "Lumière atténuée", "Visuel", "Réduit fortement la luminosité.", 20],
  ["fov_30", "Caméra rapprochée", "Caméra", "Réduit l’angle de vue à 30 degrés.", 15],
  ["fov_150", "Caméra grand angle", "Caméra", "Élargit l’angle de vue à 150 degrés.", 15],
  ["fov_280", "Caméra renversée", "Caméra", "Applique un angle de vue extrême de 280 degrés.", 15],
  ["funnycolorone", "Couleurs perturbées", "Visuel", "Modifie temporairement le rendu des couleurs.", 20],
  ["fadedreality", "Réalité estompée", "Visuel", "Applique un rendu visuel estompé.", 10],
  ["floatyjump", "Saut flottant", "Déplacement", "Modifie le comportement du personnage en l’air.", 10],
  ["jumpspeed_300", "Saut accéléré", "Déplacement", "Triple la vitesse du saut.", 10],
  ["jumpspeed_70", "Saut ralenti", "Déplacement", "Réduit la vitesse du saut à 70 %.", 10],
  ["crashsize_0", "Personnage invisible", "Personnage", "Réduit la taille visuelle du personnage à zéro.", 10],
  ["crashsize_200", "Personnage géant", "Personnage", "Double la taille visuelle du personnage.", 10],
  ["crashsize_50", "Personnage miniature", "Personnage", "Divise la taille visuelle du personnage par deux.", 10]
];
const icons = { Compteurs: "✚", Déplacement: "➜", Visuel: "✦", Caméra: "◉", Personnage: "◈" };
const CRASH_BANDICOOT_EFFECTS = Object.freeze(rows.map(([code, name, category, description, duration, quantity], sortOrder) => Object.freeze({
  id: `${GAME_ID}-${code.replaceAll("_", "-")}`, code, name, category, description,
  icon: icons[category], available: true, service: "native", sortOrder, quantity: 1, duration,
  ...(quantity ? { quantityParameter: "amount" } : { durationParameter: "durationSeconds" }),
  parameters: quantity
    ? [{ id: "amount", label: "Quantité", min: 1, max: quantity, step: 1, defaultValue: 1 }]
    : [{ id: "durationSeconds", label: "Durée (secondes)", min: 1, max: 600, step: 1, defaultValue: duration }]
})));
const CRASH_BANDICOOT_DEFAULT_MAPPINGS = Object.freeze(CRASH_BANDICOOT_EFFECTS.map(effect => Object.freeze({
  id: `catalog-${effect.id}`, effectId: effect.id, title: effect.name,
  triggerType: "gift", threshold: 1, cooldownSeconds: 0, enabled: true, triggerEnabled: false,
  parameters: Object.fromEntries(effect.parameters.map(({ id, defaultValue }) => [id, defaultValue]))
})));
module.exports = { CRASH_BANDICOOT_EFFECTS, CRASH_BANDICOOT_DEFAULT_MAPPINGS, CRASH_BANDICOOT_INTERACTION_CATALOG_VERSION: 20261020 };
