"use strict";

/**
 * Agrégateur du domaine Overlay ShenPulse.
 *
 * Les données propres à un widget vivent dans `catalog/<overlay>.js`. Ce
 * fichier assemble ces manifestes et expose le même contrat à Electron, au
 * serveur local, au relais public et aux sources OBS / TikTok LIVE Studio.
 */
(function exposeOverlayCatalog(root, factory) {
  const isCommonJs = typeof module !== "undefined" && module.exports;
  const shared = isCommonJs
    ? require("./catalog/shared")
    : root.ShenPulseOverlayShared;
  const matchCatalog = isCommonJs
    ? require("./catalog/matches")
    : root.ShenPulseOverlayMatchCatalog;
  const manifests = isCommonJs
    ? [
        require("./catalog/my-actions"),
        require("./catalog/game"),
        require("./catalog/like-goal"),
        require("./catalog/top-donors"),
        require("./catalog/top-tappers"),
        require("./catalog/coin-jar"),
        require("./catalog/timer"),
        require("./catalog/multiplier-timer"),
        require("./catalog/win-counter"),
        require("./catalog/wheel"),
        ...matchCatalog.manifests
      ]
    : root.ShenPulseOverlayManifests;
  const catalog = factory(shared, manifests, matchCatalog);
  if (isCommonJs) module.exports = catalog;
  else root.ShenPulseOverlayCatalog = catalog;
})(typeof globalThis === "undefined" ? this : globalThis, (shared, manifests, matchCatalog) => {
  if (!shared || !Array.isArray(manifests) || !matchCatalog) {
    throw new Error("Les manifestes overlay doivent être chargés avant le catalogue.");
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function sameValue(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function mergeParameterMappings(target, additions, owner) {
    for (const [key, value] of Object.entries(additions || {})) {
      if (key in target && target[key] !== value) {
        throw new Error(`Le paramètre overlay ${key} est redéfini par ${owner}.`);
      }
      target[key] = value;
    }
  }

  const MANIFEST_BY_KEY = new Map();
  const SETTINGS_PROFILES = {};
  const SPECIFIC_DEFAULTS = {};
  const CONFIG_PARAMETER_MAPPINGS = { ...shared.commonParameters };
  for (const manifest of manifests) {
    const key = String(manifest?.definition?.key || "").trim();
    if (!key) throw new Error("Un manifeste overlay ne possède pas de clé.");
    if (MANIFEST_BY_KEY.has(key)) {
      throw new Error(`Le manifeste overlay ${key} est déclaré plusieurs fois.`);
    }
    MANIFEST_BY_KEY.set(key, manifest);
    SPECIFIC_DEFAULTS[key] = clone(manifest.defaults || {});
    const profile = manifest.definition.settingsProfile || key;
    const settings = [...(manifest.settings || [])];
    if (SETTINGS_PROFILES[profile] && !sameValue(SETTINGS_PROFILES[profile], settings)) {
      throw new Error(`Le profil de paramètres ${profile} est incohérent.`);
    }
    SETTINGS_PROFILES[profile] = settings;
    mergeParameterMappings(CONFIG_PARAMETER_MAPPINGS, manifest.parameters, key);
  }
  SPECIFIC_DEFAULTS.match = clone(matchCatalog.manifests[0]?.defaults || {});

  const DEFINITIONS = Object.freeze(
    manifests.map(({ definition }) => Object.freeze({ ...definition }))
  );

  function routeFromDefinition(definition) {
    const { view, ...parameters } = definition.route;
    return {
      key: definition.key,
      view,
      ...(Object.keys(parameters).length ? { parameters } : {}),
      ...(definition.requiresPro ? { requiresPro: true } : {}),
      ...(definition.delivery === "local" ? { public: false } : {})
    };
  }

  const ROUTES = Object.freeze([
    ...shared.coreRoutes.map((route) => Object.freeze({ ...route })),
    ...DEFINITIONS.map((definition) => Object.freeze(routeFromDefinition(definition))),
    ...matchCatalog.extraRoutes.map((route) => Object.freeze({ ...route }))
  ]);
  const routeKeys = ROUTES.map(({ key }) => key);
  if (new Set(routeKeys).size !== routeKeys.length) {
    throw new Error("Une route overlay est déclarée plusieurs fois.");
  }

  const PRO_VIEWS = new Set(
    ROUTES.filter(({ requiresPro }) => requiresPro).map(({ view }) => view)
  );
  const STATEFUL_VIEWS = new Set([
    "my-actions", "feed", "leaderboard", "like-goal", "coin-jar", "timer",
    "multiplier-timer", "win-counter"
  ]);
  const CHANNEL_VIEWS = Object.freeze({
    alert: new Set(["alerts"]),
    game: new Set(["game"]),
    goal: new Set(["goals"]),
    timer: new Set(["timer"]),
    "multiplier-timer": new Set(["multiplier-timer"]),
    "like-goal": new Set(["like-goal"]),
    "coin-jar": new Set(["coin-jar"]),
    "win-counter": new Set(["win-counter"]),
    match: new Set(["match"]),
    wheel: new Set(["wheel"]),
    "session-state": STATEFUL_VIEWS
  });

  function manifest(key) {
    return MANIFEST_BY_KEY.get(key) || null;
  }

  function definition(key) {
    return manifest(key)?.definition || null;
  }

  function defaultConfig(key) {
    return {
      ...clone(shared.commonDefaults),
      ...clone(manifest(key)?.defaults || SPECIFIC_DEFAULTS[key] || {})
    };
  }

  function settingsFor(key) {
    return [...(manifest(key)?.settings || SETTINGS_PROFILES[key] || [])];
  }

  function trimTrailingSlash(value) {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  function buildUrls({
    baseUrl,
    credentialName,
    credentialValue,
    proAccess = true,
    includeRestricted = false,
    publicDelivery = false
  } = {}) {
    const base = trimTrailingSlash(baseUrl);
    const credential = String(credentialValue || "").trim();
    const overlayUrl = (view, parameters = {}) => {
      if (!base || !credential || !credentialName) return "";
      const query = new URLSearchParams({
        view,
        [credentialName]: credential,
        ...parameters
      });
      return `${base}/${publicDelivery ? "" : "overlay/"}?${query.toString()}`;
    };
    const urls = { base };
    urls.mediaScreens = Array.from({ length: 8 }, (_value, index) =>
      overlayUrl("alerts", { screen: index + 1 })
    );
    for (const route of ROUTES) {
      const denied = route.requiresPro && !includeRestricted && !proAccess;
      const unavailable = publicDelivery && route.public === false;
      urls[route.key] = denied || unavailable
        ? ""
        : overlayUrl(route.view, route.parameters);
    }
    return urls;
  }

  function definitionsWithUrls({ publicUrls = {}, localUrls = {} } = {}) {
    return DEFINITIONS.map((item) => ({
      ...item,
      options: item.options ? item.options.map((option) => [...option]) : undefined,
      route: { ...item.route },
      url: (item.delivery === "local" ? localUrls : publicUrls)[item.urlKey || item.key] || "",
      settings: settingsFor(item.key)
    }));
  }

  function viewRequiresPro(view) {
    return PRO_VIEWS.has(String(view || "").trim().toLowerCase());
  }

  function acceptsChannel({
    view,
    channel,
    payload = {},
    screen = 0,
    matchName = "",
    hasMediaScreen = Number(screen) > 0
  } = {}) {
    const normalizedView = String(view || "alerts").trim().toLowerCase();
    const normalizedChannel = String(channel || "").trim().toLowerCase();
    if (["audio", "tts"].includes(normalizedChannel)) {
      const targetScreen = Math.min(8, Math.max(1, Math.round(Number(payload?.screen) || 1)));
      return normalizedView === "alerts" && hasMediaScreen && Number(screen) === targetScreen;
    }
    if (["configuration", "design"].includes(normalizedChannel)) return true;
    if (normalizedChannel === "match") {
      if (normalizedView !== "match") return false;
      const selectedMatch = String(matchName || "").trim().toLowerCase();
      const requestedMatch = String(payload?.match || "").trim().toLowerCase();
      return !selectedMatch || selectedMatch === "player" || requestedMatch === selectedMatch;
    }
    if (normalizedChannel === "event") {
      if (["feed", "my-actions"].includes(normalizedView)) return true;
      const eventType = String(payload?.type || "").trim().toLowerCase();
      if (eventType === "gift") return ["coin-jar", "leaderboard"].includes(normalizedView);
      if (eventType === "like") return ["like-goal", "leaderboard"].includes(normalizedView);
      return false;
    }
    return CHANNEL_VIEWS[normalizedChannel]?.has(normalizedView) === true;
  }

  return Object.freeze({
    version: 1,
    themes: shared.themes,
    coinJarModels: shared.coinJarModels,
    matchVariants: matchCatalog.variants,
    matches: matchCatalog.matches,
    manifests: Object.freeze([...manifests]),
    definitions: DEFINITIONS,
    routes: ROUTES,
    commonDefaults: shared.commonDefaults,
    specificDefaults: Object.freeze(SPECIFIC_DEFAULTS),
    settingsProfiles: Object.freeze(SETTINGS_PROFILES),
    configParameterMappings: Object.freeze(CONFIG_PARAMETER_MAPPINGS),
    manifest,
    definition,
    defaultConfig,
    settingsFor,
    buildUrls,
    definitionsWithUrls,
    viewRequiresPro,
    acceptsChannel
  });
});
