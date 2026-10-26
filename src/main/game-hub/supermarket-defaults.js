"use strict";

const { isDeepStrictEqual } = require("node:util");
const { defaultGameInteractionRule } = require("./interaction-defaults");
const { manualShopMapping, SUPERMARKET_STARTER_VERSION } = require("../game-catalog/shop-game-presets");

/** Une configuration personnalisée ne reçoit pas de nouveaux cadeaux susceptibles
 * de déclencher des actions en double. Seul l'ancien catalogue intact est remplacé.
 */
function migrateSupermarketDefaults(pack, rules, currentVersion) {
  if (pack.id !== "supermarket-simulator" || currentVersion >= SUPERMARKET_STARTER_VERSION) return { removed: 0, preserve: false };
  if (!currentVersion && !rules.length) return { removed: 0, preserve: false };
  const untouched = rules.length === pack.effects.length && pack.effects.every(effect => {
    const mapping = manualShopMapping(effect);
    const rule = rules.find(item => item?.gameInteraction?.presetId === mapping.id);
    const version = Number(rule?.gameInteraction?.catalogVersion || 0);
    return version > 0 && version < SUPERMARKET_STARTER_VERSION &&
      [effect.name, ...(effect.previousNames || [])].some(title =>
        isDeepStrictEqual(rule, defaultGameInteractionRule(pack, effect, { ...mapping, title }, version)));
  });
  if (!untouched) return { removed: 0, preserve: true };
  const removed = rules.length;
  rules.splice(0);
  return { removed, preserve: false };
}

module.exports = { migrateSupermarketDefaults };
