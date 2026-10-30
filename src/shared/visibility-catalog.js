"use strict";

(function exposeVisibilityCatalog(root, factory) {
  const catalog = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = catalog;
  }
  if (root) root.ShenPulseVisibility = catalog;
})(typeof globalThis === "object" ? globalThis : this, () => {
  const SCOPES = new Set(["public", "admin", "hidden"]);
  const VISIBILITY_SCHEMA_VERSION = 11;
  const CONFIGURABLE_PRIVATE_GAMES_SCHEMA_VERSION = 11;
  // Ces jeux avaient un verrou compilé avant v11. Une ancienne valeur public
  // ne pouvait pas les ouvrir et ne doit pas les publier lors de la migration.
  const LEGACY_PRIVATE_GAME_IDS = Object.freeze(["fortnite", "find-the-needle-demo"]);
  // Le seuil de l'ancienne migration IRL ne suit pas les migrations futures.
  const IRL_PUBLIC_SCHEMA_VERSION = 9;
  const SHARED_MEDIA_FEATURES = Object.freeze(["backblaze.sounds", "backblaze.media"]);
  const GAME_PLATFORM_IDS = Object.freeze(["shenpulse", "steam", "game-pass", "epic-games", "rockstar-games", "microsoft-store", "nintendo", "ea", "gog"]);

  function gamePlatformConfig(entry) {
    if (!Array.isArray(entry?.platforms) && entry?.platformsConfigured !== true) return {};
    const platforms = [...new Set((Array.isArray(entry.platforms) ? entry.platforms : [])
      .filter(id => GAME_PLATFORM_IDS.includes(id)))];
    // Firebase retire les tableaux vides : ce marqueur conserve le choix « aucun ».
    return { platforms, platformsConfigured: true };
  }

  function gamePlatformsFor(source, id) {
    const entry = source?.games?.[storageKey(id)] ?? source?.games?.[id];
    return gamePlatformConfig(entry).platforms;
  }

  function parseAppVersion(value) {
    if (typeof value !== "string" || value.length > 128) return null;
    const match = value.trim().match(/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/);
    if (!match) return null;
    const core = match.slice(1, 4).map(Number);
    const prerelease = match[4] ? match[4].split(".") : [];
    if (!core.every(Number.isSafeInteger) || prerelease.some(part => /^\d+$/.test(part) && (part.length > 1 && part[0] === "0"))) return null;
    return { core, prerelease, normalized: `${core.join(".")}${match[4] ? `-${match[4]}` : ""}${match[5] ? `+${match[5]}` : ""}` };
  }

  function normalizeAppVersion(value) {
    return parseAppVersion(value)?.normalized || "";
  }

  function compareAppVersions(current, minimum) {
    const left = parseAppVersion(current), right = parseAppVersion(minimum);
    if (!left || !right) return null;
    for (let index = 0; index < 3; index += 1) {
      if (left.core[index] !== right.core[index]) return left.core[index] > right.core[index] ? 1 : -1;
    }
    if (!left.prerelease.length || !right.prerelease.length) {
      return left.prerelease.length === right.prerelease.length ? 0 : left.prerelease.length ? -1 : 1;
    }
    for (let index = 0; index < Math.max(left.prerelease.length, right.prerelease.length); index += 1) {
      const a = left.prerelease[index], b = right.prerelease[index];
      if (a === b) continue;
      if (a === undefined || b === undefined) return a === undefined ? -1 : 1;
      const aNumeric = /^\d+$/.test(a), bNumeric = /^\d+$/.test(b);
      if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
      if (aNumeric && a.length !== b.length) return a.length > b.length ? 1 : -1;
      return a > b ? 1 : -1;
    }
    return 0;
  }

  function gameVersionConfig(entry) {
    if (entry?.minAppVersion === undefined || entry?.minAppVersion === null) return {};
    const raw = typeof entry.minAppVersion === "string" ? entry.minAppVersion.trim() : "invalid";
    // Une borne distante malformée reste restrictive, sans devenir « toutes versions ».
    return raw ? { minAppVersion: normalizeAppVersion(raw) || (raw.length <= 128 ? raw : "invalid") } : {};
  }

  function gameMinimumVersionFor(source, id, fallback = "") {
    return gameVersionConfig(source?.games?.[storageKey(id)] ?? source?.games?.[id]).minAppVersion || normalizeAppVersion(fallback);
  }

  function gameVersionAllowed(source, pack, appVersion) {
    if (gameScopeFor(source, pack) !== "public") return true;
    const minimum = gameMinimumVersionFor(source, pack?.id, pack?.minAppVersion);
    if (!minimum) return true;
    const comparison = compareAppVersions(appVersion, minimum);
    return comparison !== null && comparison >= 0;
  }

  function isSharedMediaFeature(id) {
    return SHARED_MEDIA_FEATURES.includes(id);
  }

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
      detail: "Stockage ShenPulse partagé, disponible pour tous les comptes connectés",
      icon: "☁",
      fixedScope: "public"
    },
    {
      id: "backblaze.media",
      label: "Médias personnalisés Backblaze B2",
      detail: "Images, GIF et vidéos hébergés par ShenPulse pour tous les comptes connectés",
      icon: "▧",
      fixedScope: "public"
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
      detail: "Association et pilotage local des prises PlugPlus depuis les interactions LIVE",
      icon: "⚡",
      defaultScope: "public"
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
      // Accueil is a new public page; it never inherits a saved dashboard scope.
      home: [],
      live: ["navigation.lives"],
      rules: ["navigation.interactions"],
      voice: ["navigation.sounds"],
      music: ["navigation.song"],
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

  function hasConfigurableGameScopes(source) {
    const version = Number(source?.schemaVersion);
    return Number.isFinite(version) && version >= CONFIGURABLE_PRIVATE_GAMES_SCHEMA_VERSION;
  }

  /** ownerOnly est un défaut privé pour les jeux, pas un verrou irrévocable.
   * Seule une portée explicite valide du nouveau schéma peut les ouvrir.
   * Les pages sensibles conservent leur règle propriétaire indépendante.
   */
  function gameScopeFor(source, pack) {
    const fallback = pack?.ownerOnly === true ? "admin" : "public";
    if (!pack?.id) return fallback;
    const games = source?.games;
    const key = storageKey(pack.id);
    const entry = games && typeof games === "object" && !Array.isArray(games)
      ? Object.hasOwn(games, key) ? games[key] : Object.hasOwn(games, pack.id) ? games[pack.id] : undefined
      : undefined;
    const raw = entry && typeof entry === "object" ? entry.scope : entry;
    if (raw !== false && !SCOPES.has(raw)) return fallback;
    const scope = normalizeScope(raw);
    return pack.ownerOnly === true && scope === "public" &&
      !hasConfigurableGameScopes(source)
      ? "admin" : scope;
  }

  function canAccessGame(source, pack, isOwner, appVersion) {
    return Boolean(pack?.id && canAccessScope(gameScopeFor(source, pack), isOwner) && gameVersionAllowed(source, pack, appVersion));
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

  /** En version 8 et avant, les trois portées IRL étaient forcées propriétaire.
   * L'ouverture aux abonnés ne remplace jamais une interdiction explicite.
   * Une restriction admin ajoutée en version 9 reste pleinement autoritative.
   */
  function migratedIrlScope(source, section, id, value) {
    const irl = (section === "navigation" && id === "irl") ||
      (["features", "actionTypes"].includes(section) && id === "irl.shelly");
    const normalized = normalizeScope(value);
    return irl && Number(source?.schemaVersion || 0) < IRL_PUBLIC_SCHEMA_VERSION && normalized === "admin"
      ? "public" : normalized;
  }

  /** Migration pure du cache local et des configurations Firebase distantes.
   * Ne touche ni aux autres pages, ni aux profils, ni aux restrictions de jeux.
   */
  function migrateVisibility(source) {
    const candidate = source && typeof source === "object" ? JSON.parse(JSON.stringify(source)) : {};
    // En v7, Studio désignait les overlays. Préserver ce droit avant de
    // relever le schéma, sinon scopeFor ne reconnaîtrait plus cet alias.
    if (Number(candidate.schemaVersion || 0) < 8 && candidate.navigation?.studio !== undefined) {
      if (candidate.navigation.overlays === undefined) candidate.navigation.overlays = candidate.navigation.studio;
      delete candidate.navigation.studio;
    }
    if (Number(candidate.schemaVersion || 0) < IRL_PUBLIC_SCHEMA_VERSION) {
      for (const [section, id] of [["navigation", "irl"], ["features", "irl.shelly"], ["actionTypes", "irl.shelly"]]) {
        for (const key of new Set([id, storageKey(id)])) {
          const entry = candidate[section]?.[key];
          if (entry === undefined || normalizeScope(entry) !== "admin") continue;
          candidate[section][key] = entry && typeof entry === "object" ? { ...entry, scope: "public" } : "public";
        }
      }
    }
    // Le stockage n'est plus une fonction propriétaire : ni une ancienne
    // restriction, ni son ancien alias « résumé stockage » ne bloquent l'import.
    // L'authentification et la validation des formats restent côté serveur.
    candidate.features = candidate.features && typeof candidate.features === "object" && !Array.isArray(candidate.features)
      ? candidate.features : {};
    for (const id of SHARED_MEDIA_FEATURES) {
      for (const key of new Set([storageKey(id), ...(candidate.features[id] !== undefined ? [id] : [])])) {
        const entry = candidate.features[key];
        candidate.features[key] = entry && typeof entry === "object" ? { ...entry, scope: "public" } : { scope: "public" };
      }
    }
    if (!hasConfigurableGameScopes(candidate)) {
      for (const id of LEGACY_PRIVATE_GAME_IDS) {
        const entry = candidate.games?.[storageKey(id)] ?? candidate.games?.[id];
        const scope = entry && typeof entry === "object" ? entry.scope : entry;
        if (scope !== "public") continue;
        candidate.games[storageKey(id)] = entry && typeof entry === "object"
          ? { ...entry, scope: "admin" } : { scope: "admin" };
      }
    }
    candidate.schemaVersion = Math.max(VISIBILITY_SCHEMA_VERSION, Number(candidate.schemaVersion) || VISIBILITY_SCHEMA_VERSION);
    return candidate;
  }

  function scopeFor(
    source,
    section,
    id,
    aliases = LEGACY_ALIASES,
    fallback = "public"
  ) {
    // Les anciennes réponses Firebase peuvent arriver avant leur migration.
    if (section === "features" && isSharedMediaFeature(id)) return "public";
    // Before version 8, "studio" named the overlays gallery. It must not
    // become a scope for the new community-games Studio Live page.
    if (section === "navigation" && id === "studio" && Number(source?.schemaVersion || 0) < 8) {
      return normalizeScope(fallback);
    }
    const direct =
      source?.[section]?.[storageKey(id)] ?? source?.[section]?.[id];
    if (direct !== undefined) return migratedIrlScope(source, section, id, direct);
    for (const path of aliases?.[section]?.[id] || []) {
      if (section === "navigation" && id === "overlays" && path === "navigation.studio" &&
        Number(source?.schemaVersion || 0) >= 8) continue;
      const legacy = valueAtPath(source, path);
      if (legacy !== undefined) return migratedIrlScope(source, section, id, legacy);
    }
    return migratedIrlScope(source, section, id, fallback);
  }

  function canonicalizeVisibility(
    source,
    catalogBySection,
    aliases = LEGACY_ALIASES
  ) {
    // Résoudre les aliases Studio sur le schéma original avant de le relever :
    // un ancien navigation.studio doit toujours rester l'accès aux overlays.
    const candidate = source && typeof source === "object" ? source : {};
    const result = {
      ...migrateVisibility(candidate)
    };
    delete result.setupFeatures;
    delete result.maintenanceFeatures;

    for (const [section, items] of Object.entries(catalogBySection || {})) {
      result[section] = {};
      for (const item of Array.isArray(items) ? items : []) {
        const id = String(item?.id || "").trim();
        if (!id) continue;
        result[section][storageKey(id)] = {
          ...(section === "games" ? gamePlatformConfig(candidate.games?.[storageKey(id)] ?? candidate.games?.[id]) : {}),
          ...(section === "games" ? gameVersionConfig(candidate.games?.[storageKey(id)] ?? candidate.games?.[id] ?? item) : {}),
          scope: section === "games"
            ? gameScopeFor(candidate, { id, ownerOnly: item.defaultScope === "admin" })
            : scopeFor(
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
    const sharedStorageNeedsMigration = (catalogBySection?.features || []).some((item) =>
      isSharedMediaFeature(item.id) && normalizeScope(source?.features?.[storageKey(item.id)] ?? source?.features?.[item.id]) !== "public");
    const privateGamesNeedMigration = !hasConfigurableGameScopes(source) &&
      (catalogBySection?.games || []).some(item => item.defaultScope === "admin" &&
        scopeFor(source, "games", item.id) === "public");
    return {
      changed: missing > 0 || obsolete > 0 || sharedStorageNeedsMigration || privateGamesNeedMigration,
      missing,
      obsolete,
      total
    };
  }

  return Object.freeze({
    VISIBILITY_SCHEMA_VERSION,
    GAME_PLATFORM_IDS,
    gamePlatformConfig,
    gamePlatformsFor,
    normalizeAppVersion,
    compareAppVersions,
    gameVersionConfig,
    gameMinimumVersionFor,
    gameVersionAllowed,
    FEATURE_ITEMS,
    SHARED_MEDIA_FEATURES,
    isSharedMediaFeature,
    LEGACY_ALIASES,
    auditVisibility,
    canAccessScope,
    canAccessGame,
    gameScopeFor,
    canonicalizeVisibility,
    normalizeScope,
    migrateVisibility,
    scopeFor,
    storageKey
  });
});
