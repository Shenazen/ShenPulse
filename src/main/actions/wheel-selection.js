"use strict";

/** Sélection partagée entre le préflight des commandes et la roue réelle.
 * Une commande sans roue explicite ne cible que la sélection courante, jamais
 * tous les presets actifs. Les identifiants historiques dupliqués conservent
 * l'ordre déjà utilisé par le moteur : la première roue active correspondante.
 */
function selectRuntimeWheel(wheelConfig = {}, actionConfig = {}) {
  const configuredWheels = Array.isArray(wheelConfig.wheels) ? wheelConfig.wheels : [];
  const enabledWheels = configuredWheels.filter((wheel) => wheel.enabled !== false);
  return enabledWheels.find((wheel) => wheel.id === actionConfig.wheelId) ||
    enabledWheels.find((wheel) => wheel.id === wheelConfig.selectedWheelId) || enabledWheels[0] || null;
}

/** Seules les cases effectivement tirables peuvent déclencher une action.
 * Les choix temporaires remplacent les secteurs et la relance spéciale ignore
 * volontairement un éventuel ancien actionId conservé dans la configuration.
 */
function runtimeWheelActionIds(wheelConfig = {}, actionConfig = {}) {
  const temporary = Array.isArray(actionConfig.choices) ? actionConfig.choices.filter(Boolean) : [];
  if (temporary.length >= 2) return [];
  const wheel = selectRuntimeWheel(wheelConfig, actionConfig);
  const segments = Array.isArray(wheel?.segments) ? wheel.segments.slice(0, 100) : [];
  if (segments.length < 2) return [];
  return [...new Set(segments.filter((segment) => segment.action !== "spin")
    .map((segment) => segment.actionId).filter(Boolean))];
}

module.exports = { selectRuntimeWheel, runtimeWheelActionIds };
