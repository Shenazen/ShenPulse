(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ShenPulseActionAudio = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function descriptor(action) {
    const config = action?.config || {};
    if (action?.type === "audio.play") return { url: config.url || "", name: config.soundName || "", reference: config.soundActionId || "" };
    if (["overlay.media", "overlay.alert"].includes(action?.type)) return { url: config.soundUrl || "", name: config.soundName || "", reference: config.soundActionId || "" };
    return null;
  }
  /** Résout seulement les sons du profil fourni ; les cycles restent invalides. */
  function resolve(action, actions = [], visited = new Set()) {
    const value = descriptor(action);
    if (!value) return null;
    if (visited.size >= 32) return null;
    if (action.id && visited.has(action.id)) return null;
    if (action.id) visited.add(action.id);
    if (value.reference) {
      const next = actions.find(item => String(item.id) === String(value.reference));
      return next ? resolve(next, actions, visited) : null;
    }
    return value.url ? { url: String(value.url), name: String(value.name), sourceId: String(action.id || "") } : null;
  }
  function isAudioOnly(rule) {
    return Boolean(rule?.actions?.length) && rule.actions.every(action => ["audio.play", "tts.speak"].includes(action.type));
  }
  return { descriptor, resolve, isAudioOnly };
});
