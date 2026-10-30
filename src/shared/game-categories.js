"use strict";

/** Catégories communes au catalogue et à ses filtres ; un jeu peut appartenir à plusieurs familles. */
(function exposeGameCategories(root, factory) {
  const catalog = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = catalog;
  else root.ShenPulseGameCategories = catalog;
})(typeof globalThis === "undefined" ? this : globalThis, () => {
  const categories = Object.freeze([
    { id: "all", label: "Tout", icon: "▦", color: "#b77bff" },
    { id: "horror", label: "Horreur", icon: "☠", color: "#ff626b" },
    { id: "action", label: "Action & tir", icon: "⌖", color: "#ff994f" },
    { id: "gta", label: "GTA", icon: "🚗", color: "#4cda8a" },
    { id: "racing", label: "Course & conduite", icon: "⚑", color: "#22d3ee" },
    { id: "simulation", label: "Simulation & gestion", icon: "▣", color: "#f5cf43" },
    { id: "adventure", label: "Aventure & survie", icon: "◈", color: "#a17cff" },
    { id: "sandbox", label: "Minecraft & bac à sable", icon: "▧", color: "#9bdc38" },
    { id: "shenpulse", label: "Jeux ShenPulse", icon: "♛", color: "#ee57d7" }
  ].map(Object.freeze));
  const groups = {
    horror: ["the-mortuary-assistant", "demonologist", "resident-evil-3", "resident-evil-7-biohazard", "dead-by-daylight", "inscryption", "dredge", "shift-at-midnight"],
    action: ["escape-from-duckov", "fortnite", "deep-rock-galactic", "deep-rock-galactic-survivor", "fallout-4", "hades", "hades-ii", "vampire-survivors"],
    gta: ["gtav-hiking-enhanced", "gtav-koth-enhanced", "gtav-montchiliad", "gta-v-community-bridge", "gta-v", "gta-iv", "gta-san-andreas"],
    racing: ["super-mario-kart", "rocket-league", "euro-truck-simulator-2"],
    simulation: ["find-the-needle-demo", "supermarket-simulator", "tcg-card-shop-simulator", "stardew-valley", "cities-skylines", "cult-of-the-lamb", "balatro"],
    adventure: ["crash-bandicoot-n-sane-trilogy", "unturned", "pokemon-red-blue", "blue-prince", "hollow-knight-silksong", "hollow-knight", "egging-on", "celeste", "no-mans-sky", "palworld", "ark-survival-ascended", "kingdom-come-deliverance-2", "hogwarts-legacy"],
    sandbox: ["minecraft", "minecraft-java", "minecraft-lavarise", "minecraft-bedrock-box", "minecraft-sandbox-3", "minecraft-survival-plugin", "terraria", "wobbly-life"],
    shenpulse: ["shenfarm","shenpaint","shenkite","splash-bombes","thiercelieux", "coin-pusher", "connect-four", "deal-or-no-deal", "diamond-bridge", "diamond-drop", "color-strike", "tiklive-climb", "tiklive-cube-wars", "tiklive-stack-tower", "clash-of-live", "generic-sandbox"]
  };
  // Private integrations use the same explicit category map in the application and in tests.
  const preparationGroups = {
  "sandbox": [
    "minecraft-diamond-rush",
    "minecraft-box-cyber"
  ],
  "gta": [
    "gtav-train"
  ],
  "simulation": [
    "supermarket-together",
    "the-sims-4",
    "cookie-clicker",
    "microsoft-flight-simulator-2024",
    "roadside-research",
    "totally-accurate-battle-simulator",
    "farming-simulator-25"
  ],
  "action": [
    "team-fortress-2",
    "unreal-tournament-99",
    "unreal-tournament-2004",
    "pvz-fusion",
    "ball-x-pit",
    "brotato",
    "halo-combat-evolved",
    "vampire-crawlers",
    "plants-vs-zombies-goty",
    "doom-2016"
  ],
  "adventure": [
    "mari0",
    "sonic-robo-blast-2",
    "nova-the-squirrel",
    "curse-of-the-minesweeper",
    "zelda-again",
    "fallout-new-vegas",
    "final-fantasy-1-pixel-remaster",
    "final-fantasy-2-pixel-remaster",
    "final-fantasy-3-pixel-remaster",
    "final-fantasy-4-pixel-remaster",
    "final-fantasy-5-pixel-remaster",
    "frog-sqwad",
    "rv-there-yet",
    "skyrim-special-edition",
    "peggle-deluxe",
    "peggle-nights",
    "mikoverse"
  ],
  "horror": [
    "escape-the-backrooms",
    "voices-of-the-void",
    "cloverpit",
    "resident-evil-2",
    "resident-evil-village"
  ],
  "shenpulse": [
    "zombie-turret-defense",
    "verba",
    "county-hill-clash",
    "pixel-wall-builder-3d",
    "juicy-merge",
    "crown-clash",
    "jelly-drift",
    "tower-builder"
  ],
  "racing": [
    "snowrunner"
  ]
};
  for (const [category,entries] of Object.entries(preparationGroups)) groups[category].push(...entries);
  const byId = Object.freeze(Object.fromEntries(Object.entries(groups).flatMap(([category, ids]) => ids.map((id) => [id, category]))));
  const ids = new Set(categories.slice(1).map((category) => category.id));
  // La catégorie principale reste compatible avec les consommateurs existants.
  // Les familles supplémentaires décrivent le jeu, pas ses boutiques ou son moteur d’interactions.
  const additionalGroups = {
    action: ["hogwarts-legacy", "crash-bandicoot-n-sane-trilogy", "unturned", "rocket-league", "resident-evil-3", "resident-evil-7-biohazard", "dead-by-daylight", "demonologist", "hollow-knight", "hollow-knight-silksong", "egging-on", "celeste", "palworld", "ark-survival-ascended", "kingdom-come-deliverance-2", "terraria", "no-mans-sky", "wobbly-life", "cult-of-the-lamb", "color-strike", "tiklive-climb", "tiklive-cube-wars", "clash-of-live", "gtav-hiking-enhanced", "gtav-koth-enhanced", "gtav-montchiliad", "gta-v-community-bridge", "gta-v", "gta-iv", "gta-san-andreas", "minecraft-survival-plugin"],
    racing: ["gtav-hiking-enhanced", "gtav-koth-enhanced", "gtav-montchiliad", "gta-v-community-bridge", "gta-v", "gta-iv", "gta-san-andreas"],
    simulation: ["euro-truck-simulator-2", "dredge", "the-mortuary-assistant", "no-mans-sky", "palworld", "wobbly-life", "coin-pusher", "tiklive-stack-tower", "shift-at-midnight"],
    adventure: ["escape-the-backrooms", "the-mortuary-assistant", "demonologist", "resident-evil-3", "resident-evil-7-biohazard", "dead-by-daylight", "inscryption", "dredge", "escape-from-duckov", "fortnite", "deep-rock-galactic", "deep-rock-galactic-survivor", "fallout-4", "hades", "hades-ii", "vampire-survivors", "cult-of-the-lamb", "stardew-valley", "terraria", "wobbly-life", "minecraft", "minecraft-java", "minecraft-lavarise", "minecraft-survival-plugin", "gtav-hiking-enhanced", "gtav-koth-enhanced", "gtav-montchiliad", "gta-v-community-bridge", "gta-v", "gta-iv", "gta-san-andreas", "tiklive-climb", "diamond-bridge"],
    sandbox: ["unturned", "ark-survival-ascended", "palworld", "no-mans-sky", "fallout-4", "stardew-valley", "fortnite", "generic-sandbox"]
  };
  const additionalById = new Map();
  for (const [category, games] of Object.entries(additionalGroups)) {
    for (const id of games) additionalById.set(id, [...(additionalById.get(id) || []), category]);
  }

  function categoryFor(pack = {}) {
    if (ids.has(pack.catalogCategory)) return pack.catalogCategory;
    if (Object.hasOwn(byId, pack.id)) return byId[pack.id];
    if (pack.guide?.mode === "integrated") return "shenpulse";
    const text = `${pack.id || ""} ${pack.name || ""} ${(pack.tags || []).join(" ")}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (/minecraft|sandbox|bac a sable/.test(text)) return "sandbox";
    if (/\bgta\b|grand theft auto/.test(text)) return "gta";
    if (/horreur|horror/.test(text)) return "horror";
    if (/course|racing|conduite/.test(text)) return "racing";
    if (/simulation|simulator|gestion/.test(text)) return "simulation";
    if (/action|shooter|fps/.test(text)) return "action";
    return "adventure";
  }

  function categoriesFor(pack = {}) {
    if (pack.modeSelector && Array.isArray(pack.modes)) return [...new Set(pack.modes.flatMap(categoriesFor))];
    const configured = Array.isArray(pack.catalogCategories) ? pack.catalogCategories.filter(id => ids.has(id)) : [];
    return [...new Set(configured.length ? configured : [categoryFor(pack), ...(additionalById.get(pack.id) || [])])];
  }

  function matchesCategory(pack, category = "all") {
    return category === "all" || categoriesFor(pack).includes(category);
  }

  /** Chaque jeu/mode visible compte une fois, même s’il possède plusieurs catégories. */
  function countGames(packs = [], category = "all") {
    return packs.reduce((total, pack) => total + (pack.modeSelector && Array.isArray(pack.modes)
      ? countGames(pack.modes, category) : Number(matchesCategory(pack, category))), 0);
  }

  return Object.freeze({ categories, byId, categoryFor, categoriesFor, matchesCategory, countGames });
});
