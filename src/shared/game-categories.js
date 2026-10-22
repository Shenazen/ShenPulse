"use strict";

/** Classement commun au catalogue et à ses filtres ; une catégorie principale par jeu. */
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
    horror: ["the-mortuary-assistant", "demonologist", "resident-evil-3", "resident-evil-7-biohazard", "dead-by-daylight", "inscryption", "dredge"],
    action: ["escape-from-duckov", "fortnite", "deep-rock-galactic", "deep-rock-galactic-survivor", "fallout-4", "hades", "hades-ii", "vampire-survivors"],
    gta: ["gtav-montchiliad", "gta-v-community-bridge", "gta-v", "gta-iv", "gta-san-andreas"],
    racing: ["super-mario-kart", "rocket-league", "euro-truck-simulator-2"],
    simulation: ["find-the-needle-demo", "supermarket-simulator", "stardew-valley", "cities-skylines", "cult-of-the-lamb", "balatro"],
    adventure: ["crash-bandicoot-n-sane-trilogy", "unturned", "pokemon-red-blue", "blue-prince", "hollow-knight-silksong", "hollow-knight", "egging-on", "celeste", "no-mans-sky", "palworld", "ark-survival-ascended", "kingdom-come-deliverance-2"],
    sandbox: ["minecraft", "minecraft-java", "minecraft-bedrock-box", "minecraft-sandbox-3", "minecraft-survival-plugin", "terraria", "wobbly-life"],
    shenpulse: ["thiercelieux", "coin-pusher", "connect-four", "deal-or-no-deal", "diamond-bridge", "diamond-drop", "color-strike", "tiklive-climb", "tiklive-cube-wars", "tiklive-stack-tower", "clash-of-live", "generic-sandbox"]
  };
  const byId = Object.freeze(Object.fromEntries(Object.entries(groups).flatMap(([category, ids]) => ids.map((id) => [id, category]))));
  const ids = new Set(categories.slice(1).map((category) => category.id));

  function categoryFor(pack = {}) {
    if (ids.has(pack.catalogCategory)) return pack.catalogCategory;
    if (byId[pack.id]) return byId[pack.id];
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

  /** Le lanceur Minecraft regroupe plusieurs modes déjà filtrés par visibilité. */
  function countGames(packs = []) {
    return packs.reduce((total, pack) => total + (pack.modeSelector && Array.isArray(pack.modes) ? pack.modes.length : 1), 0);
  }

  return Object.freeze({ categories, byId, categoryFor, countGames });
});
