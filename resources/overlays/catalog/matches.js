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
    ["gladiador", "Gladiador"]
  ]);
  const matches = Object.freeze([
    { key: "matchX2", name: "Match x2", match: "x2" },
    { key: "matchX3", name: "Match x3", match: "x3" },
    { key: "matchGants", name: "Match Gants", match: "guantes" },
    { key: "matchCoffre", name: "Match Coffre", match: "cofre" },
    { key: "matchSnipe", name: "Match Snipe", match: "snipe" },
    { key: "matchTapTap", name: "Match TapTap", match: "taptap" },
    { key: "matchQuiereme", name: "Match Cœur du jour", match: "quiereme" },
    { key: "matchEnigma", name: "Match Enigma", match: "enigma" }
  ]);
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
      delivery: "local",
      urlKey: "matchPlayer",
      parameter: "variant",
      options: match === "enigma" ? [variants[0]] : variants,
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
    extraRoutes: Object.freeze([
      {
        key: "matchPlayer",
        view: "match",
        parameters: { match: "player" },
        requiresPro: true,
        public: false
      }
    ])
  });
});
