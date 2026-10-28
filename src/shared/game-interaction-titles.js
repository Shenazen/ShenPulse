"use strict";
/** Display-only upgrades of shipped default names. Custom titles are never truncated. */
(function expose(root, factory) {
  const titles = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = titles;
  else root.ShenPulseGameInteractionTitles = titles;
})(globalThis, () => {
  function title(rule, effect, {compact = false, defaultTitles = []} = {}) {
    const saved = String(rule?.gameInteraction?.title || '').trim();
    if (!saved || (effect?.previousNames || []).includes(saved) || compact && (saved === effect?.name || defaultTitles.includes(saved))) return compact ? shortDefaultTitle(effect?.name || saved) : effect?.name || saved;
    return saved;
  }
  function capitalize(value) { return String(value || "").replace(/\p{L}/u, letter => letter.toLocaleUpperCase("fr")); }
  function shortDefaultTitle(value) {
    const words=String(value||'').trim().split(/\s+/);
    if(words.length<=2)return capitalize(words.join(' '));
    const meaningful=words.filter(word=>!['de','du','des','la','le','les','un','une','à','au','aux','en','dans','pour','avec','pendant','et',':'].includes(word.toLowerCase()));
    if(meaningful.length<=2)return capitalize(meaningful.join(' '));
    const number=meaningful.find(word=>/^[+−-]?\d/.test(word));
    return capitalize((number?[meaningful.find(word=>word!==number)||number,number]:meaningful.slice(0,2)).join(' '));
  }
  return { title, shortDefaultTitle, capitalize };
});
