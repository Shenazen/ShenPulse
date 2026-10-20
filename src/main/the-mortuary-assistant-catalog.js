"use strict";

const GAME_ID = "the-mortuary-assistant";
const rows = [
  ["restock_current_supply", "Réapprovisionner le matériel", "Embaumement", "Ajoute un consommable adapté à l’étape d’embaumement en cours si l’inventaire le permet."],
  ["reveal_body_mark", "Révéler une marque du corps", "Investigation", "Révèle une marque encore inconnue sur le corps en cours d’inspection."],
  ["repress_possession", "Réduire la possession", "Possession", "Réduit la possession de 15 points de pourcentage."],
  ["fast_procedures", "Embaumement accéléré", "Embaumement", "Accélère les procédures et animations compatibles sans sauter d’étapes.", 30],
  ["jam_embalming_machine", "Bloquer la machine", "Embaumement", "Interrompt temporairement le pompage sans perdre le mélange ni la progression.", 30],
  ["pause_possession", "Suspendre la possession", "Possession", "Empêche temporairement la possession d’augmenter.", 30],
  ["invert_look", "Inverser la caméra", "Commandes", "Inverse les axes horizontal et vertical de la caméra.", 30],
  ["fill_embalming_machine", "Préparer le mélange", "Embaumement", "Ajoute au mélange les ingrédients manquants disponibles."],
  ["invite_possession", "Augmenter la possession", "Possession", "Augmente la possession de 15 points de pourcentage."],
  ["fast_movement", "Déplacement accéléré", "Déplacement", "Augmente la vitesse de marche de Rebecca.", 30],
  ["reveal_demon_name", "Révéler le nom du démon", "Investigation", "Révèle le nom du démon associé au service en cours."],
  ["reveal_possessed_body", "Identifier le corps possédé", "Investigation", "Révèle quel corps est possédé pendant ce service."],
  ["invert_movement", "Inverser les déplacements", "Commandes", "Inverse les déplacements avant, arrière et latéraux.", 30],
  ["demonic_activity", "Activité démoniaque", "Hantises", "Déclenche un événement démoniaque aléatoire disponible dans la scène."],
  ["quiet_shift", "Calmer les hantises", "Hantises", "Suspend les hantises facultatives en préservant les événements de l’histoire.", 30],
  ["restore_lights", "Rallumer les lumières", "Environnement", "Rallume les éclairages contrôlables sans interrompre une scène de l’histoire."],
  ["slow_movement", "Déplacement ralenti", "Déplacement", "Réduit la vitesse de marche de Rebecca.", 30],
  ["slow_procedures", "Embaumement ralenti", "Embaumement", "Ralentit les procédures et animations compatibles sans réinitialiser la progression.", 30],
  ["give_lettering_strip", "Donner une bandelette", "Investigation", "Ajoute une bandelette de révélation si une place est disponible dans l’inventaire."],
  ["reveal_demonic_sigil", "Révéler un symbole démoniaque", "Investigation", "Révèle un symbole démoniaque encore inconnu."],
  ["lights_out", "Éteindre les lumières", "Environnement", "Éteint temporairement les éclairages non essentiels, puis les restaure.", 30],
  ["accelerate_possession", "Possession accélérée", "Possession", "Accélère la montée de la possession sans déclencher une défaite immédiate.", 30]
];
const icons = { Embaumement: "⚗", Investigation: "◈", Possession: "☠", Commandes: "↔", Déplacement: "➜", Hantises: "◇", Environnement: "☀" };
const THE_MORTUARY_ASSISTANT_EFFECTS = Object.freeze(rows.map(([code, name, category, description, duration = 0], index) => Object.freeze({
  id: `mortuary-${code.replaceAll("_", "-")}`, code, name, category, description,
  icon: icons[category], quantity: 1, duration, available: true, service: "native", sortOrder: index
})));
const THE_MORTUARY_ASSISTANT_DEFAULT_MAPPINGS = Object.freeze(THE_MORTUARY_ASSISTANT_EFFECTS.map((entry) => Object.freeze({
  id: `catalog-${entry.id}`, effectId: entry.id, title: entry.name,
  triggerType: "gift", threshold: 1, cooldownSeconds: 0, duration: entry.duration,
  enabled: true, triggerEnabled: false
})));

module.exports = {
  THE_MORTUARY_ASSISTANT_GAME_ID: GAME_ID,
  THE_MORTUARY_ASSISTANT_EFFECTS,
  THE_MORTUARY_ASSISTANT_DEFAULT_MAPPINGS,
  THE_MORTUARY_ASSISTANT_INTERACTION_CATALOG_VERSION: 20261020
};
