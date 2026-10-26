"use strict";
/** Display-only upgrades of shipped default names. Custom titles are never truncated. */
(function expose(root, factory) {
  const titles = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = titles;
  else root.ShenPulseGameInteractionTitles = titles;
})(globalThis, () => {
  function title(rule, effect) {
    const saved = String(rule?.gameInteraction?.title || '').trim();
    if (!saved || (effect?.previousNames || []).includes(saved)) return effect?.name || saved;
    return saved;
  }
  return { title };
});
