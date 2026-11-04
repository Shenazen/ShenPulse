"use strict";

const LABELS = {
  fullheal: ["Soin complet", "Restaure tous les PV", "help"],
  smallheal: ["Soin léger", "Restaure une partie des PV", "help"],
  smalldamage: ["Dégâts légers", "Retire une partie des PV, sans mettre K.-O.", "trap"],
  settoone: ["PV minimum", "Réduit les PV à 1", "trap"],
  killplayer: ["Mise K.-O.", "Met K.-O.", "trap"],
  rename: ["Nom viewer", "Donne le nom du viewer", "neutral"],
  givegil: ["Gils offerts", "Ajoute des gils", "help"],
  takegil: ["Gils retirés", "Retire des gils disponibles", "trap"],
  killenemy: ["Ennemis vaincus", "Met K.-O. les ennemis ciblés", "help"],
  damageenemy: ["Ennemis blessés", "Blesse les ennemis ciblés", "help"],
  healenemy: ["Ennemis soignés", "Restaure les PV des ennemis ciblés", "trap"],
  buffaddatk: ["Attaque renforcée", "Renforce l’attaque", "help"],
  buffadddef: ["Défense renforcée", "Renforce la défense", "help"],
  buffaddmega: ["Bonus puissants", "Ajoute plusieurs bonus", "help"],
  buffregen: ["Régénération", "Ajoute une régénération des PV", "help"],
  buffremove: ["Bonus retirés", "Retire les bonus actifs", "trap"],
  statusaddpoison: ["Poison", "Empoisonne", "trap"],
  statusremovepoison: ["Antipoison", "Retire le poison", "help"],
  statusaddrandom: ["Altération aléatoire", "Applique une altération d’état", "trap"],
  statusremoveall: ["Altérations retirées", "Retire les altérations présentes", "help"]
};
const ITEMS = {
  Potion: "Potion", "Hi-Potion": "Potion +", "X-Potion": "Potion X", Ether: "Éther", Elixir: "Élixir",
  "Phoenix+Down": "Queue phénix", "Phoeni+Down": "Queue phénix", Antidote: "Antidote", Cottage: "Chalet",
  Tent: "Tente", "Sleeping+Bag": "Sac couchage", "Gold+Needle": "Aiguille dorée", "Eye+Drops": "Collyre", "Echo+Herb": "Herbe écho",
  "Echo+Herbs": "Herbes écho", Mallet: "Maillet", Cross: "Croix", Garlic: "Ail", RandomTome: "Tome aléatoire",
  "Maidens+Kiss": "Baiser crapaud", "Maiden's+Kiss": "Baiser crapaud", "Gnomish+Bread": "Pain gnome",
  "Gysahl+Greens": "Légume Gysahl", "Antarctic+Wind": "Vent antarctique", "Zeus's+Wrath": "Colère Zeus",
  "Bomb+Fragment": "Fragment bombo", Remedy: "Remède", "Dry+Ether": "Super éther", "Golden+Apple": "Pomme dorée",
  "Silver+Apple": "Pomme argentée", "Soma+Drop": "Goutte Soma", "Holy+Water": "Eau bénite",
  "Magic+Lamp": "Lampe magique", "Flame+Scroll": "Parchemin feu", "Water+Scroll": "Parchemin eau",
  "Lightning+Scroll": "Parchemin foudre", "Strength+Tonic": "Tonique force", "Protect+Drink": "Boisson protectrice",
  "Speed+Drink": "Boisson vitesse", "Giant's+Tonic": "Tonique géant", "Sage's+Wisdom": "Sagesse sage"
};

function finalFantasyRecord(record) {
  if (!/^final-fantasy-[1-5]-pixel-remaster$/.test(record.id)) return record;
  const effects = record.effects.map(effect => {
    const [family, variant, last] = effect.code.split("_");
    const target = variant === "all" ? "Toute l’équipe" : variant === "random" ? "Un personnage aléatoire"
      : /^\d+$/.test(variant) ? "Personnage " + variant : variant === "cecil" ? "Cécil" : "Équipe";
    const combat = /^(buff|status|.*enemy)/.test(family);
    let name, description, column, category = combat ? "Combat" : target;
    if (LABELS[family]) {
      [name, description, column] = LABELS[family];
      description += /enemy$/.test(family) ? "." : ". Cible : " + target + ".";
      if (/gil$/.test(family)) description += " Quantité : " + variant + ".";
      if (/enemy$/.test(family)) description += variant === "all" ? " Tous les ennemis." : " Un ennemi aléatoire.";
    } else if (family === "giveitem") {
      name = ITEMS[variant] || variant.replace(/\+/g, " ").split(/\s+/).slice(0, 2).join(" ");
      description = "Ajoute un objet « " + name + " » dans l’inventaire, s’il reste de la place.";
      column = "help"; category = "Objets";
    } else if (["weapon", "helm", "armor", "gauntlets"].includes(family)) {
      const subject = { weapon: "Arme", helm: "Casque", armor: "Armure", gauntlets: "Gants" }[family];
      name = subject + (variant === "upgrade" ? (family === "gauntlets" ? " améliorés" : family === "helm" ? " amélioré" : " améliorée") : (family === "gauntlets" ? " dégradés" : family === "helm" ? " dégradé" : " dégradée"));
      description = (variant === "upgrade" ? "Améliore" : "Dégrade") + " l’équipement du personnage " + last + ", dans les limites des équipements compatibles.";
      column = variant === "upgrade" ? "help" : "trap"; category = "Personnage " + last;
    } else if (family === "reviveplayer") {
      name = "Résurrection"; description = "Ranime un personnage K.-O. présent dans l’équipe."; column = "help";
    } else if (family === "forcebattle") {
      name = "Combat surprise"; description = "Déclenche une rencontre sur un terrain où les combats sont possibles."; column = "trap";
    } else if (family === "viewerbattle") {
      name = "Boss viewer"; description = "Déclenche une rencontre portant le nom du viewer et sa photo lorsqu’elle est disponible. Sans photo, une image du pack est utilisée. Nécessite une zone à monstres, hors combat."; column = "trap";
    } else return effect;
    if (combat) description += " En combat, à l’écran de choix des actions. Une suppression nécessite que l’état ciblé soit présent.";
    return { ...effect, name, description, category, column };
  });
  const preferred = ["fullheal_all", "givegil_100", "giveitem_Potion_1", "reviveplayer", "weapon_upgrade_1", "armor_upgrade_1",
    "smalldamage_all", "takegil_100", "settoone_random", "forcebattle", "statusaddpoison_all", "killplayer_random"];
  const priority = effect => { const index = preferred.indexOf(effect.code); return index < 0 ? preferred.length : index; };
  return { ...record, effects: effects.sort((a, b) => priority(a) - priority(b)) };
}

module.exports = { finalFantasyRecord };
