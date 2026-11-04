"use strict";

(function exposeManifestGroup(root, factory) {
  const group = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = group;
  else {
    root.ShenPulseOverlayMatchCatalog = group;
    (root.ShenPulseOverlayManifests ||= []).push(...group.manifests);
  }
})(typeof globalThis === "undefined" ? this : globalThis, () => {
  const variants = Object.freeze([
    ["tikcontrol", "TikControl"],
    ["gladiador", "Gladiador"],
    ["cyber", "Cyber"],
    ["dragon", "Dragon"]
  ]);
  // Les options décrivent uniquement des fichiers réellement livrés. Le pack
  // Cyber et Dragon ne contiennent ni Coffre ni Enigma.
  const legacyVariants = Object.freeze(["tikcontrol", "gladiador"]);
  const fullVariants = Object.freeze([...legacyVariants, "cyber", "dragon"]);
  const matches = Object.freeze([
    { key: "matchX2", name: "Match x2", match: "x2", variants: fullVariants },
    { key: "matchX3", name: "Match x3", match: "x3", variants: fullVariants },
    { key: "matchGants", name: "Match Gants", match: "guantes", variants: fullVariants },
    { key: "matchCoffre", name: "Match Coffre", match: "cofre", variants: legacyVariants },
    { key: "matchSnipe", name: "Match Snipe", match: "snipe", variants: fullVariants },
    { key: "matchTapTap", name: "Match TapTap", match: "taptap", variants: fullVariants },
    { key: "matchQuiereme", name: "Match Cœur du jour", match: "quiereme", variants: fullVariants },
    { key: "matchEnigma", name: "Match Enigma", match: "enigma", variants: Object.freeze(["tikcontrol"]) }
  ]);
  const byMatch = new Map(matches.map((entry) => [entry.match, entry]));
  function animationVariants(match) {
    const allowed = byMatch.get(String(match || "").trim().toLowerCase())?.variants || [];
    return variants.filter(([variant]) => allowed.includes(variant));
  }
  function normalizeAnimationVariant(match, variant) {
    const entry = byMatch.get(String(match || "").trim().toLowerCase());
    if (!entry) return null;
    const requested = String(variant || "tikcontrol").trim().toLowerCase();
    if (entry.variants.includes(requested)) return requested;
    // Compatibilité des configurations historiques : une ancienne variante
    // inconnue ou Gladiador/Enigma conserve son repli de lecture TikControl.
    // Ces packs sont des choix explicites : ne jamais les remplacer en silence.
    return ["cyber", "dragon"].includes(requested) ? null : "tikcontrol";
  }
  const defaults = Object.freeze({
    variant: "tikcontrol",
    fit: "contain",
    autoplay: true,
    loop: true
  });
  const settings = Object.freeze(["variant", "fit", "autoplay", "loop"]);
  const parameters = Object.freeze({
    variant: "variant",
    fit: "fit",
    autoplay: "autoplay",
    loop: "loop"
  });
  const manifests = matches.map(({ key, name, match }) => ({
    definition: {
      key,
      name,
      description: `Animation ${name.replace("Match ", "")} plein écran pour les temps forts des matchs TikTok.`,
      category: "matches",
      icon: "VS",
      route: { view: "match", match },
      delivery: "public",
      public: false,
      urlKey: "matchPlayer",
      parameter: "variant",
      options: animationVariants(match),
      defaultOption: "tikcontrol",
      previewView: "match",
      previewKind: "match",
      match,
      sourceSize: [1080, 1920],
      settingsProfile: "match",
      requiresPro: true
    },
    defaults,
    settings,
    parameters
  }));

  return Object.freeze({
    manifests,
    matches,
    variants,
    animationVariants,
    normalizeAnimationVariant,
    extraRoutes: Object.freeze([
      {
        key: "matchPlayer",
        view: "match",
        parameters: { match: "player" },
        requiresPro: true,
        public: false
      },
      ...[["matchesWins", "wins"], ["matchesStarDonor", "starDonor"], ["matchesTopDonor", "topDonor"], ["matchesDonors", "donors"], ["matchesTimer", "timer"], ["matchesVictory", "victory"], ["matchesScoreboard", "scoreboard"]].map(([key, widget]) => Object.freeze({
        key, view: "match-widget", parameters: { widget }, sourceSize: [1080, 540], requiresPro: true, public: false
      }))
    ])
  });
});
