"use strict";

const { safeString } = require("../utils");
const { normalizeWindowsInputSequence } = require("../windows-input-service");

/** Vérifie pack, unicité des effets et séquences d'entrée Windows. */
function validatePack(pack) {
  if (!pack?.id || !pack?.name || !Array.isArray(pack.effects) || !pack.connector) {
    throw new Error("Pack de jeu invalide.");
  }
  const ids = new Set();
  for (const effect of pack.effects) {
    if (!effect.id || ids.has(effect.id)) throw new Error(`Effet invalide dans ${pack.id}`);
    ids.add(effect.id);
    if (pack.connector.type === "windows-input") {
      normalizeWindowsInputSequence(effect.inputSequence);
    }
  }
}

/** Hydrate les paramètres et neutralise le nom du viewer dans les commandes. */
function interpolateCommand(template, effect) {
  return String(template || "").replace(
    /\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g,
    (placeholder, key) => {
      if (Object.prototype.hasOwnProperty.call(effect.parameters || {}, key)) {
        const value = Number(effect.parameters[key]);
        return Number.isFinite(value) ? String(value) : "0";
      }
      if (key === "quantity") return String(effect.quantity);
      if (key === "duration") return String(effect.duration);
      if (key === "viewer") {
        return safeString(effect.viewer, 40).replace(/[^\w-]/g, "_");
      }
      return placeholder;
    }
  );
}

/** Résout la variante exacte ou la valeur la plus proche prévue par le pack. */
function resolveEffectCode(effect, runtimeEffect) {
  const variant = effect?.codeByParameter;
  const parameterId = String(variant?.parameter || "");
  if (parameterId) {
    const rawValue = runtimeEffect?.parameters?.[parameterId];
    const numericValue = Number(rawValue);
    const key = Number.isFinite(numericValue)
      ? String(Math.round(numericValue))
      : String(rawValue || "");
    const mapped = variant.values?.[key];
    if (mapped) return String(mapped);
    if (variant.mode === "nearest" && Number.isFinite(numericValue)) {
      const nearest = Object.entries(variant.values || {})
        .map(([value, code]) => ({
          value: Number(value),
          code: String(code || "")
        }))
        .filter(
          (entry) =>
            Number.isFinite(entry.value) &&
            entry.code
        )
        .sort(
          (left, right) =>
            Math.abs(left.value - numericValue) -
              Math.abs(right.value - numericValue) ||
            left.value - right.value
        )[0];
      if (nearest) return nearest.code;
    }
  }
  return String(effect?.code || effect?.id || "");
}

/** Keep enum values intact and reject values absent from the effect's declared choices. */
function effectChoiceValue(parameter, value) {
  const choices=parameter.options||[];
  const choice=choices.find(option=>String(option.value)===String(value));
  if(!choice)throw new Error("Choix invalide pour "+(parameter.label||parameter.id)+".");
  return choice.value;
}

/** Paramètres initiaux communs aux associations automatiques et aux effets exécutés. */
function defaultEffectParameters(effect) {
  return Object.fromEntries((effect.parameters || []).map((parameter) => [
    parameter.id,
    parameter.type === "select"
      ? effectChoiceValue(parameter, parameter.defaultValue ?? parameter.options?.[0]?.value)
      : parameter.type === "text"
      ? safeString(parameter.defaultValue || "", Math.min(80, Number(parameter.maxLength) || 80))
      : Number(parameter.defaultValue || 0)
  ]));
}

module.exports = { validatePack, interpolateCommand, resolveEffectCode, defaultEffectParameters, effectChoiceValue };
