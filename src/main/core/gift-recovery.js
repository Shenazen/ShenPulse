"use strict";

/**
 * Reprise au démarrage et après enrichissement réel du catalogue, pas à chaque
 * tapotage/cadeau inchangé. Pendant le LIVE, les écritures sont regroupées.
 * Un échec de sauvegarde ne doit ni bloquer le LIVE ni autoriser une réparation
 * sans sauvegarde préalable ; le store garantit alors les références intactes.
 */
function reconcileGiftReferencesSafely(core, { immediate = true } = {}) {
  if (typeof core.store?.reconcileGiftReferences !== "function") return;
  try {
    const result = core.store.reconcileGiftReferences(core.giftCatalog.gifts, { immediate });
    core.giftReferenceRecoveryWarning = false;
    return result;
  } catch {
    if (!core.giftReferenceRecoveryWarning) {
      core.ingestionHooks?.activity?.("warning", "catalog", "Réparation des cadeaux différée",
        "La sauvegarde préalable n’a pas pu être créée ou validée. Vos associations de cadeaux ont été conservées.");
    }
    core.giftReferenceRecoveryWarning = true;
    return { changed: 0, deferred: true };
  }
}

module.exports = { reconcileGiftReferencesSafely };
