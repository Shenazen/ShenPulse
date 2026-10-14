"use strict";

/** Contrat commun des associations déclencheur/effet des catalogues de mods. */


function mapping(id, effectId, title, options = {}) {
  return {
    id,
    effectId,
    title,
    triggerType: options.triggerType || "gift",
    giftName: options.giftName || "",
    threshold: Math.max(1, Number(options.threshold || 1)),
    cooldownSeconds: Math.max(0, Number(options.cooldownSeconds || 0)),
    duration: Math.max(0, Number(options.duration || 0)),
    enabled: options.enabled !== false,
    triggerEnabled: options.triggerEnabled !== false,
    parameters: { ...(options.parameters || {}) }
  };
}

module.exports = { mapping };

