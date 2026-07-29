"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  createDefaultOverlayConfigs,
  createDefaultState,
  createEmptyProfileWorkspace
} = require("./defaults");
const { clone, id } = require("./utils");
const {
  normalizeOverlaySession
} = require("./overlay-session-state");

class StateStore {
  constructor(userDataDirectory, safeStorage) {
    this.directory = userDataDirectory;
    this.filePath = path.join(userDataDirectory, "shenpulse-state.json");
    this.secretPath = path.join(userDataDirectory, "shenpulse-secrets.json");
    this.safeStorage = safeStorage;
    this.state = createDefaultState();
    this.secrets = {};
    this.writeTimer = null;
  }

  load() {
    fs.mkdirSync(this.directory, { recursive: true });
    this.state = this.#readJson(this.filePath, createDefaultState());
    this.secrets = this.#readJson(this.secretPath, {});
    this.#migrate();
    return this.getState();
  }

  #readJson(filePath, fallback) {
    try {
      if (!fs.existsSync(filePath)) return fallback;
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
      const corruptPath = `${filePath}.corrupt-${Date.now()}`;
      try {
        fs.copyFileSync(filePath, corruptPath);
      } catch {
        // The clean fallback is still usable.
      }
      return fallback;
    }
  }

  #migrate() {
    const defaults = createDefaultState();
    this.state.schemaVersion = 2;
    this.state.settings = { ...defaults.settings, ...(this.state.settings || {}) };
    this.state.settings.tts = {
      ...defaults.settings.tts,
      ...(this.state.settings.tts || {})
    };
    this.state.settings.obs = {
      ...defaults.settings.obs,
      ...(this.state.settings.obs || {})
    };
    this.state.settings.spotify = {
      ...defaults.settings.spotify,
      ...(this.state.settings.spotify || {})
    };
    this.state.settings.backblaze = {
      ...defaults.settings.backblaze,
      ...(this.state.settings.backblaze || {})
    };
    this.state.settings.admin = {
      ...defaults.settings.admin,
      ...(this.state.settings.admin || {})
    };
    this.state.settings.publicOverlayRelay = {
      ...defaults.settings.publicOverlayRelay,
      ...(this.state.settings.publicOverlayRelay || {})
    };
    this.state.settings.tiktok = {
      ...defaults.settings.tiktok,
      ...(this.state.settings.tiktok || {})
    };
    const overlayDefaults = createDefaultOverlayConfigs();
    const storedOverlayConfigs = this.state.settings.overlayConfigs || {};
    this.state.settings.overlayConfigs = Object.fromEntries(
      Object.entries(overlayDefaults).map(([overlayId, config]) => {
        const stored = storedOverlayConfigs[overlayId] || {};
        const merged = { ...config, ...stored };
        if (overlayId === "likeGoal") {
          if (
            Number(stored.schemaVersion || 0) < 2 &&
            Number(stored.scale) === 60
          ) {
            merged.scale = 100;
          }
          merged.schemaVersion = Math.max(
            2,
            Number(merged.schemaVersion) || 0
          );
        }
        if (
          overlayId === "wheel" &&
          !Array.isArray(stored.wheels) &&
          Array.isArray(stored.choices) &&
          stored.choices.length >= 2
        ) {
          const legacyColors = Array.isArray(stored.colors)
            ? stored.colors
            : [];
          merged.wheels = structuredClone(config.wheels);
          merged.wheels[0].name = stored.title || merged.wheels[0].name;
          merged.wheels[0].design =
            stored.design === "royal" ? "royal" : "classic";
          merged.wheels[0].settings = {
            ...merged.wheels[0].settings,
            ...stored
          };
          merged.wheels[0].segments = stored.choices
            .slice(0, 16)
            .map((label, index) => ({
              id: `segment_legacy_${index + 1}`,
              label: String(label),
              color:
                legacyColors[index] ||
                ["#ff6a00", "#111111", "#f59f00", "#2a1207"][
                  index % 4
                ],
              action: "none",
              actionId: ""
            }));
          merged.selectedWheelId = merged.wheels[0].id;
        }
        if (overlayId === "wheel") {
          const defaultWheels = Array.isArray(config.wheels)
            ? config.wheels
            : [];
          const storedWheels = Array.isArray(merged.wheels)
            ? structuredClone(merged.wheels)
            : [];
          for (const preset of defaultWheels) {
            if (
              !storedWheels.some(
                (wheel) => wheel.design === preset.design
              )
            ) {
              storedWheels.push(structuredClone(preset));
            }
          }
          normalizeWheelSegmentActions(storedWheels);
          merged.wheels = storedWheels;
          merged.schemaVersion = Math.max(
            11,
            Number(merged.schemaVersion) || 0
          );
          if (
            !storedWheels.some(
              (wheel) => wheel.id === merged.selectedWheelId
            )
          ) {
            merged.selectedWheelId = storedWheels[0]?.id || "";
          }
        }
        return [overlayId, merged];
      })
    );
    for (const key of [
      "connections",
      "profiles",
      "rules",
      "goals",
      "commands",
      "timers",
      "customSounds",
      "customMedia",
      "activity"
    ]) {
      if (!Array.isArray(this.state[key])) this.state[key] = defaults[key];
    }
    const tiktokUsername = String(this.state.settings.tiktok.username || "")
      .trim()
      .replace(/^@+/, "");
    if (tiktokUsername) {
      const tiktokConnection = this.state.connections.find(
        (item) => item.id === "source_tiktok"
      );
      const nextConnection = {
        ...(tiktokConnection || {}),
        id: "source_tiktok",
        name: `TikTok @${tiktokUsername}`,
        type: "tiktok-direct",
        enabled: this.state.settings.tiktok.autoConnect !== false,
        status: "disconnected",
        config: { username: tiktokUsername }
      };
      if (tiktokConnection) {
        Object.assign(tiktokConnection, nextConnection);
      } else {
        this.state.connections.push(nextConnection);
      }
      this.state.settings.tiktok.username = tiktokUsername;
      this.state.settings.tiktok.relayUrl = "";
      this.state.settings.tiktok.status = "disconnected";
      this.state.settings.tiktok.roomId = "";
    } else {
      this.state.settings.tiktok.status = "unconfigured";
    }
    this.state.session = { ...defaults.session, ...(this.state.session || {}) };
    this.state.session.game = {
      ...defaults.session.game,
      ...(this.state.session.game || {})
    };
    // A LIVE session is a runtime state and can never survive an application
    // restart. Keeping it persisted produced a stale timer after TikTok ended.
    this.state.session.running = false;
    this.state.session.startedAt = null;
    this.state.session.startedBy = "";
    this.state.session.activeConnectionIds = [];
    this.state.session.game = clone(defaults.session.game);
    this.state.statistics = {
      ...defaults.statistics,
      ...(this.state.statistics || {})
    };
    this.state.statistics.sessionEvents = 0;
    this.state.statistics.sessionActions = 0;
    this.state.statistics.sessionLikes = 0;
    this.state.statistics.sessionUniqueViewers = [];
    this.state.overlaySession = normalizeOverlaySession(
      this.state.overlaySession
    );
    this.state.overlaySession.active = false;
    if (this.state.overlaySession.hasData && !this.state.overlaySession.endedAt) {
      this.state.overlaySession.endedAt = new Date().toISOString();
    }
    this.state.game = { ...defaults.game, ...(this.state.game || {}) };
    this.state.commerce = {
      ...defaults.commerce,
      ...(this.state.commerce || {}),
      subscription: {
        ...defaults.commerce.subscription,
        ...(this.state.commerce?.subscription || {})
      },
      premiumSeat: {
        ...defaults.commerce.premiumSeat,
        ...(this.state.commerce?.premiumSeat || {})
      },
      gameEntitlements: Array.isArray(this.state.commerce?.gameEntitlements)
        ? this.state.commerce.gameEntitlements
        : [],
      trial: {
        ...defaults.commerce.trial,
        ...(this.state.commerce?.trial || {}),
        gameIds: Array.isArray(this.state.commerce?.trial?.gameIds)
          ? this.state.commerce.trial.gameIds
          : [],
        grants: Array.isArray(this.state.commerce?.trial?.grants)
          ? this.state.commerce.trial.grants
          : [],
        cachedGrants: Array.isArray(
          this.state.commerce?.trial?.cachedGrants
        )
          ? this.state.commerce.trial.cachedGrants
          : []
      }
    };
    this.#migrateProfileWorkspaces();
  }

  #migrateProfileWorkspaces() {
    const defaults = createDefaultState();
    if (!this.state.profiles.length) {
      this.state.profiles = clone(defaults.profiles);
    }

    const activeProfile =
      this.state.profiles.find(
        (profile) => profile.id === this.state.session.profileId
      ) || this.state.profiles[0];
    this.state.session.profileId = activeProfile.id;

    const legacyWorkspace = {
      schemaVersion: 1,
      rules: clone(this.state.rules),
      goals: clone(this.state.goals),
      commands: clone(this.state.commands),
      timers: clone(this.state.timers),
      overlayConfigs: clone(this.state.settings.overlayConfigs),
      game: {
        connectorOverrides: clone(this.state.game.connectorOverrides || {}),
        interactionCatalogVersions: clone(
          this.state.game.interactionCatalogVersions || {}
        ),
        interactionRulesByPack: clone(
          this.state.game.interactionRulesByPack || {}
        ),
        activeGamePackId:
          String(this.state.session.activeGamePackId || "").trim() ||
          "coin-pusher"
      }
    };
    const now = new Date().toISOString();

    for (const profile of this.state.profiles) {
      if (!profile.workspace || typeof profile.workspace !== "object") {
        const hasLegacyRuleSelection = Array.isArray(profile.enabledRuleIds);
        const enabledRuleIds = new Set(profile.enabledRuleIds || []);
        const rules = hasLegacyRuleSelection
          ? legacyWorkspace.rules.filter((rule) => enabledRuleIds.has(rule.id))
          : profile.id === activeProfile.id
            ? legacyWorkspace.rules
            : [];
        profile.workspace = {
          ...clone(legacyWorkspace),
          rules: clone(rules)
        };
      }

      profile.workspace = normalizeProfileWorkspace(profile.workspace);
      profile.enabledRuleIds = profile.workspace.rules.map((rule) => rule.id);
      profile.createdAt ||= now;
      profile.updatedAt ||= now;
    }

    this.#loadProfileWorkspace(activeProfile.id);
  }

  #activeProfile() {
    return this.state.profiles.find(
      (profile) => profile.id === this.state.session.profileId
    );
  }

  #syncActiveProfileWorkspace() {
    const profile = this.#activeProfile();
    if (!profile) return;

    const current = normalizeProfileWorkspace(profile.workspace);
    const nextWorkspace = {
      ...current,
      rules: clone(this.state.rules),
      goals: clone(this.state.goals),
      commands: clone(this.state.commands),
      timers: clone(this.state.timers),
      overlayConfigs: clone(this.state.settings.overlayConfigs),
      game: {
        ...current.game,
        connectorOverrides: clone(this.state.game.connectorOverrides || {}),
        interactionCatalogVersions: clone(
          this.state.game.interactionCatalogVersions || {}
        ),
        interactionRulesByPack: clone(
          this.state.game.interactionRulesByPack || {}
        ),
        activeGamePackId:
          String(this.state.session.activeGamePackId || "").trim() ||
          "coin-pusher"
      }
    };
    const nextRuleIds = nextWorkspace.rules.map((rule) => rule.id);

    if (
      JSON.stringify(profile.workspace) !== JSON.stringify(nextWorkspace) ||
      JSON.stringify(profile.enabledRuleIds || []) !==
        JSON.stringify(nextRuleIds)
    ) {
      profile.workspace = nextWorkspace;
      profile.enabledRuleIds = nextRuleIds;
      profile.updatedAt = new Date().toISOString();
    }
  }

  #loadProfileWorkspace(profileId) {
    const profile = this.state.profiles.find((item) => item.id === profileId);
    if (!profile) return false;

    const workspace = normalizeProfileWorkspace(profile.workspace);
    profile.workspace = workspace;
    profile.enabledRuleIds = workspace.rules.map((rule) => rule.id);
    this.state.rules = clone(workspace.rules);
    this.state.goals = clone(workspace.goals);
    this.state.commands = clone(workspace.commands);
    this.state.timers = clone(workspace.timers);
    this.state.settings.overlayConfigs = clone(workspace.overlayConfigs);
    this.state.game.connectorOverrides = clone(
      workspace.game.connectorOverrides
    );
    this.state.game.interactionCatalogVersions = clone(
      workspace.game.interactionCatalogVersions
    );
    this.state.game.interactionRulesByPack = clone(
      workspace.game.interactionRulesByPack
    );
    this.state.session.activeGamePackId = workspace.game.activeGamePackId;
    return true;
  }

  getState() {
    const result = clone(this.state);
    for (const connection of result.connections) {
      connection.hasSecret = Boolean(connection.secretId && this.secrets[connection.secretId]);
      delete connection.secret;
    }
    return result;
  }

  set(pathParts, value) {
    const parts = Array.isArray(pathParts)
      ? [...pathParts]
      : String(pathParts).split(".");
    if (parts.join(".") === "session.profileId") {
      return this.selectProfile(value);
    }
    let target = this.state;
    while (parts.length > 1) {
      const part = parts.shift();
      if (!target[part] || typeof target[part] !== "object") target[part] = {};
      target = target[part];
    }
    target[parts[0]] = clone(value);
    this.touch();
    return this.getState();
  }

  mutate(mutator, immediate = false) {
    mutator(this.state);
    this.touch(immediate);
    return this.getState();
  }

  mutateRuntime(mutator, immediate = false) {
    mutator(this.state);
    this.touch(immediate, false);
  }

  upsert(collection, item) {
    return this.mutate((state) => {
      const entries = state[collection];
      const copy = clone(item);
      if (!copy.id) copy.id = id(collection.slice(0, -1));
      const index = entries.findIndex((entry) => entry.id === copy.id);
      if (collection === "profiles") {
        if (index >= 0) {
          copy.workspace = entries[index].workspace;
          copy.enabledRuleIds = entries[index].enabledRuleIds || [];
          entries[index] = { ...entries[index], ...copy };
        } else {
          copy.workspace = createEmptyProfileWorkspace();
          copy.enabledRuleIds = [];
          entries.push(copy);
        }
      } else if (index >= 0) {
        entries[index] = { ...entries[index], ...copy };
      } else {
        entries.push(copy);
      }
    });
  }

  upsertGameInteraction(packId, item) {
    const targetPackId = String(packId || "").trim();
    if (!targetPackId) throw new Error("Jeu introuvable.");
    return this.mutate((state) => {
      state.game.interactionRulesByPack ||= {};
      const entries =
        state.game.interactionRulesByPack[targetPackId] ||= [];
      const copy = clone(item);
      if (!copy.id) copy.id = id("game_rule");
      const index = entries.findIndex((entry) => entry.id === copy.id);
      if (index >= 0) entries[index] = { ...entries[index], ...copy };
      else entries.push(copy);
    });
  }

  removeGameInteraction(packId, ruleId) {
    const targetPackId = String(packId || "").trim();
    const targetRuleId = String(ruleId || "").trim();
    return this.mutate((state) => {
      state.game.interactionRulesByPack ||= {};
      const entries =
        state.game.interactionRulesByPack[targetPackId] || [];
      state.game.interactionRulesByPack[targetPackId] = entries.filter(
        (entry) => entry.id !== targetRuleId
      );
    });
  }

  remove(collection, itemId) {
    if (collection === "profiles") {
      if (this.state.profiles.length <= 1) {
        throw new Error("Au moins un profil doit être conservé.");
      }
      this.#syncActiveProfileWorkspace();
      const wasActive = this.state.session.profileId === itemId;
      this.state.profiles = this.state.profiles.filter(
        (profile) => profile.id !== itemId
      );
      if (wasActive) {
        this.state.session.profileId = this.state.profiles[0].id;
        this.#loadProfileWorkspace(this.state.session.profileId);
      }
      this.touch();
      return this.getState();
    }
    return this.mutate((state) => {
      state[collection] = state[collection].filter((item) => item.id !== itemId);
    });
  }

  selectProfile(profileId) {
    const targetId = String(profileId || "").trim();
    const target = this.state.profiles.find(
      (profile) => profile.id === targetId
    );
    if (!target) throw new Error("Ce profil n’existe plus.");
    if (targetId === this.state.session.profileId) return this.getState();

    this.#syncActiveProfileWorkspace();
    this.state.session.game = {
      running: false,
      packId: "",
      profileId: "",
      startedAt: null
    };
    this.state.session.profileId = targetId;
    this.#loadProfileWorkspace(targetId);
    this.touch(true);
    return this.getState();
  }

  addActivity(entry) {
    this.mutateRuntime((state) => {
      state.activity.unshift({
        id: entry.id || id("activity"),
        timestamp: entry.timestamp || new Date().toISOString(),
        ...clone(entry)
      });
      state.activity = state.activity.slice(
        0,
        Math.max(100, Number(state.settings.historyLimit) || 2000)
      );
    });
  }

  setSecret(secretId, value) {
    const targetId = secretId || id("secret");
    const plainText = String(value || "");
    if (!plainText) {
      delete this.secrets[targetId];
    } else if (this.safeStorage?.isEncryptionAvailable()) {
      this.secrets[targetId] = {
        encrypted: true,
        value: this.safeStorage.encryptString(plainText).toString("base64")
      };
    } else {
      this.secrets[targetId] = {
        encrypted: false,
        value: Buffer.from(plainText, "utf8").toString("base64")
      };
    }
    this.#writeSecrets();
    return targetId;
  }

  getSecret(secretId) {
    const secret = this.secrets[secretId];
    if (!secret?.value) return "";
    const buffer = Buffer.from(secret.value, "base64");
    try {
      return secret.encrypted
        ? this.safeStorage.decryptString(buffer)
        : buffer.toString("utf8");
    } catch {
      return "";
    }
  }

  clearAllData() {
    this.state = createDefaultState();
    this.secrets = {};
    this.touch(true);
    this.#writeSecrets();
    return this.getState();
  }

  importState(imported) {
    if (!imported || typeof imported !== "object" || !Array.isArray(imported.rules)) {
      throw new Error("Le fichier importé n'est pas un profil ShenPulse valide.");
    }
    const preservedSettings = this.state.settings;
    this.state = clone(imported);
    this.state.settings = {
      ...createDefaultState().settings,
      ...preservedSettings,
      ...(imported.settings || {}),
      apiToken: preservedSettings.apiToken,
      overlayToken: preservedSettings.overlayToken
    };
    this.#migrate();
    this.touch(true);
    return this.getState();
  }

  touch(immediate = false, syncWorkspace = true) {
    if (syncWorkspace) this.#syncActiveProfileWorkspace();
    this.state.updatedAt = new Date().toISOString();
    if (this.writeTimer) clearTimeout(this.writeTimer);
    if (immediate) this.#writeState();
    else this.writeTimer = setTimeout(() => this.#writeState(), 200);
  }

  flush() {
    if (this.writeTimer) clearTimeout(this.writeTimer);
    this.#writeState();
    this.#writeSecrets();
  }

  #writeState() {
    this.writeTimer = null;
    this.#atomicWrite(this.filePath, JSON.stringify(this.state, null, 2));
  }

  #writeSecrets() {
    this.#atomicWrite(this.secretPath, JSON.stringify(this.secrets, null, 2));
  }

  #atomicWrite(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath, content, { encoding: "utf8", mode: 0o600 });
    fs.renameSync(temporaryPath, filePath);
  }
}

function normalizeWheelSegmentActions(wheels = []) {
  for (const wheel of wheels) {
    for (const segment of wheel?.segments || []) {
      if (segment.action !== "spin" && String(segment.actionId || "").trim()) {
        segment.action = "action";
      }
    }
  }
  return wheels;
}

function normalizeProfileOverlayConfigs(storedConfigs) {
  const defaults = createDefaultOverlayConfigs();
  const stored =
    storedConfigs && typeof storedConfigs === "object" ? storedConfigs : {};

  return Object.fromEntries(
    Object.entries(defaults).map(([overlayId, defaultConfig]) => {
      const saved =
        stored[overlayId] && typeof stored[overlayId] === "object"
          ? stored[overlayId]
          : {};
      const merged = { ...clone(defaultConfig), ...clone(saved) };

      if (overlayId === "likeGoal") {
        if (
          Number(saved.schemaVersion || 0) < 2 &&
          Number(saved.scale) === 60
        ) {
          merged.scale = 100;
        }
        merged.schemaVersion = Math.max(
          2,
          Number(merged.schemaVersion) || 0
        );
        return [overlayId, merged];
      }

      if (overlayId !== "wheel") return [overlayId, merged];

      if (
        !Array.isArray(saved.wheels) &&
        Array.isArray(saved.choices) &&
        saved.choices.length >= 2
      ) {
        const colors = Array.isArray(saved.colors) ? saved.colors : [];
        merged.wheels = clone(defaultConfig.wheels);
        merged.wheels[0].name = saved.title || merged.wheels[0].name;
        merged.wheels[0].design =
          saved.design === "royal" ? "royal" : "classic";
        merged.wheels[0].settings = {
          ...merged.wheels[0].settings,
          ...saved
        };
        merged.wheels[0].segments = saved.choices
          .slice(0, 16)
          .map((label, index) => ({
            id: `segment_legacy_${index + 1}`,
            label: String(label),
            color:
              colors[index] ||
              ["#ff6a00", "#111111", "#f59f00", "#2a1207"][index % 4],
            action: "none",
            actionId: ""
          }));
        merged.selectedWheelId = merged.wheels[0].id;
      }

      const wheels = Array.isArray(merged.wheels)
        ? clone(merged.wheels)
        : [];
      for (const preset of defaultConfig.wheels || []) {
        if (!wheels.some((wheel) => wheel.design === preset.design)) {
          wheels.push(clone(preset));
        }
      }
      normalizeWheelSegmentActions(wheels);
      merged.wheels = wheels;
      merged.schemaVersion = Math.max(
        11,
        Number(merged.schemaVersion) || 0
      );
      if (
        !wheels.some((wheel) => wheel.id === merged.selectedWheelId)
      ) {
        merged.selectedWheelId = wheels[0]?.id || "";
      }
      return [overlayId, merged];
    })
  );
}

function normalizeProfileWorkspace(workspace) {
  const defaults = createEmptyProfileWorkspace();
  const saved = workspace && typeof workspace === "object" ? workspace : {};
  const savedGame =
    saved.game && typeof saved.game === "object" ? saved.game : {};
  const normalizedRules = normalizeRules(saved.rules);
  const legacyGameRules = normalizedRules.filter(isGameInteractionRule);
  const globalRules = normalizedRules.filter(
    (rule) => !isGameInteractionRule(rule)
  );
  const interactionRulesByPack = normalizeGameInteractionRules(
    savedGame.interactionRulesByPack
  );
  const fallbackPackId =
    String(savedGame.activeGamePackId || "").trim() || "coin-pusher";
  for (const rule of legacyGameRules) {
    const packId = gameInteractionPackId(rule) || fallbackPackId;
    interactionRulesByPack[packId] ||= [];
    if (
      !interactionRulesByPack[packId].some(
        (entry) => entry.id === rule.id
      )
    ) {
      interactionRulesByPack[packId].push(rule);
    }
  }

  return {
    schemaVersion: 1,
    rules: globalRules,
    goals: Array.isArray(saved.goals) ? clone(saved.goals) : [],
    commands: Array.isArray(saved.commands) ? clone(saved.commands) : [],
    timers: Array.isArray(saved.timers) ? clone(saved.timers) : [],
    overlayConfigs: normalizeProfileOverlayConfigs(saved.overlayConfigs),
    game: {
      ...defaults.game,
      ...clone(savedGame),
      connectorOverrides:
        savedGame.connectorOverrides &&
        typeof savedGame.connectorOverrides === "object" &&
        !Array.isArray(savedGame.connectorOverrides)
          ? clone(savedGame.connectorOverrides)
          : {},
      interactionCatalogVersions:
        savedGame.interactionCatalogVersions &&
        typeof savedGame.interactionCatalogVersions === "object" &&
        !Array.isArray(savedGame.interactionCatalogVersions)
          ? clone(savedGame.interactionCatalogVersions)
          : {},
      interactionRulesByPack,
      activeGamePackId:
        String(savedGame.activeGamePackId || "").trim() || "coin-pusher"
    }
  };
}

function normalizeGameInteractionRules(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([packId, rules]) => packId && Array.isArray(rules))
      .map(([packId, rules]) => [
        packId,
        normalizeRules(rules).filter(isGameInteractionRule)
      ])
  );
}

function isGameInteractionRule(rule) {
  return Boolean(
    rule?.gameInteraction ||
      (rule?.actions || []).some((action) =>
        ["game.effect", "overlay.win-counter"].includes(action.type)
      )
  );
}

function gameInteractionPackId(rule) {
  return String(
    (rule?.actions || []).find((action) =>
      ["game.effect", "overlay.win-counter"].includes(action.type)
    )?.config?.packId || ""
  ).trim();
}

function normalizeRules(rules) {
  if (!Array.isArray(rules)) return [];
  return clone(rules).map((rule) => ({
    ...rule,
    trigger: {
      ...(rule.trigger || {}),
      source: "*"
    }
  }));
}

module.exports = { StateStore, normalizeWheelSegmentActions };
