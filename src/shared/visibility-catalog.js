"use strict";

(function exposeVisibilityCatalog(root, factory) {
  const catalog = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = catalog;
  }
  if (root) root.ShenPulseVisibility = catalog;
})(typeof globalThis === "object" ? globalThis : this, () => {
  const SCOPES = new Set(["public", "admin", "hidden"]);

  const FEATURE_ITEMS = Object.freeze([
    {
      id: "tiktok.live",
      label: "Détection TikTok LIVE",
      detail: "Détection automatique du @, du statut LIVE et des événements TikTok",
      icon: "◉"
    },
    {
      id: "sources.custom",
      label: "Sources et relais personnalisés",
      detail: "WebSocket, Twitch IRC et connecteurs d’événements autorisés",
      icon: "⌁"
    },
    {
      id: "obs.websocket",
      label: "OBS WebSocket",
      detail: "Contrôle des scènes et sources OBS depuis les actions",
      icon: "▣"
    },
    {
      id: "spotify.playback",
      label: "Spotify",
      detail: "Connexion du compte, lecture en cours et ajout de titres à la file",
      icon: "♫"
    },
    {
      id: "backblaze.sounds",
      label: "Sons personnalisés Backblaze B2",
      detail: "Import et hébergement des sons ajoutés par l’utilisateur",
      icon: "☁"
    },
    {
      id: "backblaze.media",
      label: "Médias personnalisés Backblaze B2",
      detail: "Import et hébergement des images, GIF et vidéos de l’utilisateur",
      icon: "▧"
    },
    {
      id: "tts.voices",
      label: "Synthèse vocale",
      detail: "Voix TTS réutilisables dans les actions et déclencheurs",
      icon: "◖"
    },
    {
      id: "local.services",
      label: "Services locaux API et overlays",
      detail: "Serveur d’overlays, API locale et sources navigateur",
      icon: "⌘"
    },
    {
      id: "irl.shelly",
      label: "Interactions IRL Shelly",
      detail: "Association et pilotage local des prises Shelly depuis les interactions LIVE",
      icon: "⚡",
      defaultScope: "admin",
      ownerOnly: true
    },
    {
      id: "data.management",
      label: "Gestion des données locales",
      detail: "Import, export et suppression des données de l’application",
      icon: "⇄"
    }
  ]);

  const LEGACY_ALIASES = Object.freeze({
    navigation: {
      live: ["navigation.lives"],
      rules: ["navigation.interactions"],
      overlays: ["navigation.studio"],
      games: ["navigation.interactive-games"],
      goals: ["navigation.points"],
      commands: ["navigation.chat"],
      connections: ["navigation.setup"],
      activity: ["navigation.maintenance"],
      settings: ["navigation.setup"]
    },
    features: {
      "sources.custom": ["setupFeatures.connectorStreamerbot"],
      "obs.websocket": ["setupFeatures.connectorObs"],
      "spotify.playback": ["navigation.song"],
      "backblaze.sounds": ["maintenanceFeatures.storageSummary"],
      "backblaze.media": ["maintenanceFeatures.storageSummary"],
      "tts.voices": ["actionTypes.tts"],
      "data.management": ["maintenanceFeatures.storageBreakdown"]
    },
    actionTypes: {
      "overlay.alert": ["actionTypes.alert"],
      "overlay.media": [
        "actionTypes.overlay:alert",
        "actionTypes.alert",
        "actionTypes.animation",
        "actionTypes.picture",
        "actionTypes.video"
      ],
      "tts.speak": ["actionTypes.tts"],
      "audio.play": ["actionTypes.sound"],
      "goal.add": ["actionTypes.customGoal"],
      "timer.add": ["actionTypes.timerControl"],
      "game.effect": ["actionTypes.minecraft"],
      "obs.request": [
        "actionTypes.obsScene",
        "actionTypes.obsSource",
        "actionTypes.obsSourceHide"
      ],
      "http.request": ["actionTypes.webhook"],
      "websocket.send": [
        "actionTypes.streamerbot",
        "actionTypes.thirdParty"
      ],
      "chat.reply": ["actionTypes.chatbot"],
      "system.keys": ["actionTypes.keystrokes"],
      "system.open": ["actionTypes.thirdParty"]
    },
    overlays: {
      coinJar: ["overlays.coinJarTest"],
      wheel: ["overlays.wheelActions"]
    }
  });

  function normalizeScope(value) {
    const scope = value && typeof value === "object" ? value.scope : value;
    if (scope === false) return "hidden";
    return SCOPES.has(scope) ? scope : "public";
  }

  function canAccessScope(scope, isAdmin) {
    const normalized = normalizeScope(scope);
    if (normalized === "hidden") return false;
    if (normalized === "admin") return Boolean(isAdmin);
    return true;
  }

  function storageKey(id) {
    return String(id || "")
      .trim()
      .replaceAll(".", ":")
      .replace(/[$#\[\]\/]/g, "-");
  }

  function valueAtPath(source, path) {
    return String(path || "")
      .split(".")
      .reduce(
        (value, key) =>
          value && typeof value === "object" ? value[key] : undefined,
        source
      );
  }

  function scopeFor(
    source,
    section,
    id,
    aliases = LEGACY_ALIASES,
    fallback = "public"
  ) {
    const direct =
      source?.[section]?.[storageKey(id)] ?? source?.[section]?.[id];
    if (direct !== undefined) return normalizeScope(direct);
    for (const path of aliases?.[section]?.[id] || []) {
      const legacy = valueAtPath(source, path);
      if (legacy !== undefined) return normalizeScope(legacy);
    }
    return normalizeScope(fallback);
  }

  function canonicalizeVisibility(
    source,
    catalogBySection,
    aliases = LEGACY_ALIASES
  ) {
    const candidate =
      source && typeof source === "object"
        ? JSON.parse(JSON.stringify(source))
        : {};
    const result = {
      ...candidate,
      schemaVersion: Math.max(7, Number(candidate.schemaVersion) || 7)
    };
    delete result.setupFeatures;
    delete result.maintenanceFeatures;

    for (const [section, items] of Object.entries(catalogBySection || {})) {
      result[section] = {};
      for (const item of Array.isArray(items) ? items : []) {
        const id = String(item?.id || "").trim();
        if (!id) continue;
        result[section][storageKey(id)] = {
          scope: scopeFor(
            candidate,
            section,
            id,
            aliases,
            item?.defaultScope || "public"
          )
        };
      }
    }

    const actionItems = catalogBySection?.actionTypes || [];
    const previousOverrides = candidate.actionTypeOverrides || {};
    result.actionTypeOverrides = {};
    for (const item of actionItems) {
      const id = String(item?.id || "").trim();
      if (!id) continue;
      const aliasesForType = aliases?.actionTypes?.[id] || [];
      const storedId = storageKey(id);
      const legacyOverride = aliasesForType
        .map((path) =>
          path.startsWith("actionTypes.")
            ? previousOverrides[path.slice("actionTypes.".length)]
            : undefined
        )
        .find((value) => value !== undefined);
      result.actionTypeOverrides[storedId] =
        previousOverrides[storedId] !== undefined ||
        previousOverrides[id] !== undefined
          ? (previousOverrides[storedId] ?? previousOverrides[id]) !== false
          : legacyOverride !== false;
    }
    return result;
  }

  function auditVisibility(source, catalogBySection) {
    let missing = 0;
    let obsolete = 0;
    let total = 0;
    for (const [section, items] of Object.entries(catalogBySection || {})) {
      const expected = new Set(
        (Array.isArray(items) ? items : [])
          .map((item) => storageKey(item?.id))
          .filter(Boolean)
      );
      const current = Object.keys(source?.[section] || {});
      total += expected.size;
      missing += [...expected].filter((id) => !current.includes(id)).length;
      obsolete += current.filter((id) => !expected.has(id)).length;
    }
    obsolete += Object.keys(source?.setupFeatures || {}).length;
    obsolete += Object.keys(source?.maintenanceFeatures || {}).length;
    return {
      changed: missing > 0 || obsolete > 0,
      missing,
      obsolete,
      total
    };
  }

  return Object.freeze({
    FEATURE_ITEMS,
    LEGACY_ALIASES,
    auditVisibility,
    canAccessScope,
    canonicalizeVisibility,
    normalizeScope,
    scopeFor,
    storageKey
  });
});
