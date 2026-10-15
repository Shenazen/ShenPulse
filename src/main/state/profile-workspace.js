"use strict";

const { clone } = require("../utils");
const { createEmptyProfileWorkspace } = require("../defaults");
const sceneLayout = require("../../../resources/overlays/scene-layout");
const { normalizeProfileOverlayConfigs } = require("./overlay-configs");
const { normalizeRules, isGameInteractionRule, normalizeGameInteractionRules, gameInteractionPackId } = require("./rule-normalization");
const { normalizeObjectMap } = require("./normalization-utils");
const { normalizeMatchesConfig, createMatchSession } = require("../../shared/matches-contract");
const { normalizeTtsSettings } = require("./defaults/preferences");
const { normalizeSongRequestSettings } = require("../spotify/song-request-settings");

/** Convertit un profil hérité sans mélanger actions globales et interactions de jeu. */
function normalizeProfileWorkspace(workspace, { ttsFallback, songRequestSettingsFallback } = {}) {
  const defaults = createEmptyProfileWorkspace();
  const saved = workspace && typeof workspace === "object" ? workspace : {};
  const savedGame =
    saved.game && typeof saved.game === "object" ? saved.game : {};
  const inheritedSongs = songRequestSettingsFallback && typeof songRequestSettingsFallback === "object" ? songRequestSettingsFallback : {};
  const savedSongs = saved.songRequestSettings && typeof saved.songRequestSettings === "object" ? saved.songRequestSettings : {};
  const normalizedRules = normalizeRules(saved.rules);
  const legacyGameRules = normalizedRules.filter(isGameInteractionRule);
  const globalRules = normalizedRules.filter(
    (rule) => !isGameInteractionRule(rule)
  );
  const globalRuleKeys = new Set(
    globalRules.map((rule) =>
      String(rule?.id || "").trim() || JSON.stringify(rule)
    )
  );
  const savedInteractionRulesByPack =
    savedGame.interactionRulesByPack &&
    typeof savedGame.interactionRulesByPack === "object" &&
    !Array.isArray(savedGame.interactionRulesByPack)
      ? savedGame.interactionRulesByPack
      : {};
  for (const rules of Object.values(savedInteractionRulesByPack)) {
    for (const rule of normalizeRules(rules)) {
      if (isGameInteractionRule(rule)) continue;
      const key = String(rule?.id || "").trim() || JSON.stringify(rule);
      if (globalRuleKeys.has(key)) continue;
      globalRuleKeys.add(key);
      globalRules.push(rule);
    }
  }
  const interactionRulesByPack = normalizeGameInteractionRules(
    savedInteractionRulesByPack
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
    schemaVersion: 2,
    rules: globalRules,
    goals: Array.isArray(saved.goals) ? clone(saved.goals) : [],
    commands: Array.isArray(saved.commands) ? clone(saved.commands) : [],
    timers: Array.isArray(saved.timers) ? clone(saved.timers) : [],
    tts: normalizeTtsSettings(saved.tts, ttsFallback),
    songRequestSettings: normalizeSongRequestSettings({ ...inheritedSongs, ...savedSongs,
      commands: { ...(inheritedSongs.commands || {}), ...(savedSongs.commands || {}) } }),
    matches: normalizeMatchesConfig(saved.matches),
    matchSession: createMatchSession(saved.matchSession, { disconnected: true }),
    overlayConfigs: normalizeProfileOverlayConfigs(saved.overlayConfigs),
    overlayScene: sceneLayout.normalizeScene(saved.overlayScene),
    game: {
      ...defaults.game,
      ...clone(savedGame),
      connectorOverrides: normalizeObjectMap(savedGame.connectorOverrides),
      interactionCatalogVersions: normalizeObjectMap(savedGame.interactionCatalogVersions),
      interactionRulesByPack,
      activeGamePackId:
        String(savedGame.activeGamePackId || "").trim() || "coin-pusher"
    }
  };
}

/**
 * Capture la configuration active dans un profil indépendant.
 * Les extensions du jeu précédent sont conservées ; les champs actifs les remplacent.
 * Aucune normalisation du catalogue précédent n'est nécessaire : il est remplacé,
 * et les migrations effectuent déjà la normalisation lors du chargement.
 */
function captureProfileWorkspace(state, previousWorkspace = {}) {
  const previousGame = previousWorkspace?.game && typeof previousWorkspace.game === "object"
    ? previousWorkspace.game : {};
  // Ces quatre collections sont remplacées ci-dessous : ne pas copier l'ancien catalogue.
  const { connectorOverrides: _overrides, interactionCatalogVersions: _versions,
    interactionRulesByPack: _rules, activeGamePackId: _pack, ...gameExtensions } = previousGame;
  return {
    schemaVersion: 2,
    rules: clone(state.rules),
    goals: clone(state.goals),
    commands: clone(state.commands),
    timers: clone(state.timers),
    tts: normalizeTtsSettings(state.settings.tts),
    songRequestSettings: normalizeSongRequestSettings(state.settings.spotify?.songRequests),
    matches: normalizeMatchesConfig(state.settings.matches),
    matchSession: clone(state.matchSession || createMatchSession()),
    overlayConfigs: clone(state.settings.overlayConfigs),
    overlayScene: sceneLayout.normalizeScene(state.settings.overlayScene),
    game: {
      ...clone(gameExtensions),
      connectorOverrides: clone(state.game.connectorOverrides || {}),
      interactionCatalogVersions: clone(state.game.interactionCatalogVersions || {}),
      interactionRulesByPack: clone(state.game.interactionRulesByPack || {}),
      activeGamePackId: String(state.session.activeGamePackId || "").trim() || "coin-pusher"
    }
  };
}

module.exports = { normalizeProfileWorkspace, captureProfileWorkspace };
