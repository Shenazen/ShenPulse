"use strict";

const { clone } = require("../utils");
const { isGameInteractionActionType } = require("../../shared/game-interaction-action-types");

/** Répartit uniquement les règles d'interaction reconnues dans leurs packs de jeu. */
function normalizeGameInteractionRules(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([packId, rules]) => packId && Array.isArray(rules))
      .flatMap(([packId, rules]) => {
        const normalizedRules = normalizeRules(rules).filter(
          isGameInteractionRule
        );
        return normalizedRules.length ? [[packId, normalizedRules]] : [];
      })
  );
}

/** Distingue une interaction de jeu d'une action globale, notamment pour les sons ordinaires. */
function isGameInteractionRule(rule) {
  return Boolean(
    rule?.gameInteraction ||
      (rule?.actions || []).some((action) =>
        isGameInteractionActionType(action.type) &&
        (action.type !== "audio.play" ||
          (String(action.config?.packId || "").trim() &&
            String(action.config?.effectId || "").trim()))
      )
  );
}

/** Pack associé à la première action de jeu ; une chaîne vide déclenche le repli du profil. */
function gameInteractionPackId(rule) {
  return String(
    (rule?.actions || []).find((action) =>
      isGameInteractionActionType(action.type)
    )?.config?.packId || ""
  ).trim();
}

/** Copie les règles et préserve la compatibilité des anciens déclencheurs TTS. */
function normalizeRules(rules) {
  if (!Array.isArray(rules)) return [];
  return clone(rules).map((rule) => {
    const actions = Array.isArray(rule.actions) ? rule.actions : [];
    const actionSelection = normalizeRuleActionSelection(
      rule.actionSelection
    );
    const isTtsOnly =
      actions.length > 0 &&
      actions.every((action) => action?.type === "tts.speak");
    return {
      ...rule,
      ...(actionSelection ? { actionSelection } : {}),
      trigger: isTtsOnly
        ? {
            ...(rule.trigger || {}),
            enabled: true,
            type: "chat",
            source: "*",
            threshold: 1
          }
        : {
            ...(rule.trigger || {}),
            source: "*"
          },
      ...(isTtsOnly
        ? {
            conditions: [],
            cooldown: { globalMs: 0, perUserMs: 0 }
          }
        : {})
    };
  });
}

/** Déduplique la sélection d'actions et borne le nombre de tirages aléatoires. */
function normalizeRuleActionSelection(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const actionIds = [
    ...new Set(
      (Array.isArray(value.actionIds) ? value.actionIds : [])
        .map(String)
        .filter(Boolean)
    )
  ];
  const mode = value.mode === "random" ? "random" : "all";
  return {
    mode,
    actionIds,
    randomCount:
      mode === "random"
        ? Math.min(
            Math.max(1, actionIds.length),
            Math.max(1, Math.floor(Number(value.randomCount) || 1))
          )
        : actionIds.length
  };
}

module.exports = { normalizeGameInteractionRules, isGameInteractionRule, gameInteractionPackId, normalizeRules, normalizeRuleActionSelection };
