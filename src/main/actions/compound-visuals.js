"use strict";

/** Un texte et un média du même scénario/écran partagent une présentation.
 * Les configurations sauvegardées et les références externes restent intactes.
 */
function composeActionVisuals(actions) {
  const texts = new Map(), embedded = new Set();
  actions.forEach((action, index) => {
    if (action.type !== "overlay.text" || action.config?.alert?.enabled !== true) return;
    const screen = Math.min(8, Math.max(1, Math.round(Number(action.config.alert.screen) || 1)));
    if (!texts.has(screen)) texts.set(screen, { action, index });
  });
  const output = actions.map(action => {
    if (!["overlay.media", "overlay.alert"].includes(action.type) || !action.config?.mediaUrl || action.config?.alert?.enabled === true) return action;
    const screen = Math.min(8, Math.max(1, Math.round(Number(action.config.screen) || 1)));
    const text = texts.get(screen);
    if (!text) return action;
    embedded.add(text.index);
    return { ...action, config: { ...action.config, alert: { ...text.action.config.alert, screen, durationMs: action.config.durationMs || 5000 } } };
  });
  return output.map((action, index) => embedded.has(index)
    ? { ...action, config: { ...action.config, embeddedInMedia: true } } : action);
}

module.exports = { composeActionVisuals };
