"use strict";

const { normalizeEvent } = require("../event-normalizer");
const { enrichGiftEvent, findCatalogGift } = require("../../shared/gift-identity");
const { readState } = require("../state-projection");
const { resolveLikeGoalCompletionChange } = require("./trigger-policy");

/** Flux LIVE : observation et statistiques d'abord, interactions autorisées ensuite.
 * Les participants bloqués sont comptabilisés, mais aucune émission brute n'est
 * envoyée aux jeux, overlays interactifs ou commandes de voix/musique/actions.
 */
async function ingestCreatorEvent(core, hooks, raw, source) {
  // L'origine choisie par le connecteur/API fait autorité, même si son payload
  // ressemble déjà à un événement normalisé. Une API locale ne peut se faire
  // passer pour le chat TikTok vérifié en ajoutant source_tiktok à son JSON.
  // Les appels internes sans origine explicite conservent l'événement fourni.
  const normalized = raw?.type && raw?.user && raw?.data
    ? { ...raw, source: source ?? raw.source ?? "manual" }
    : normalizeEvent(raw, source ?? "manual");
  if (normalized.type === "gift" && core.giftCatalog.mergeLiveGift(normalized.data || {}) === true) {
    // Uniquement les métadonnées réellement nouvelles : un cadeau public, pas
    // toute la liste ni les données du viewer. Les sauvegardes sont regroupées.
    const gift = findCatalogGift(core.giftCatalog.gifts, normalized.data || {});
    if (gift) core.notifyRenderer("gift-catalog-updated", [gift]);
    hooks.catalogChanged?.();
  }
  const event = enrichGiftEvent(normalized, core.giftCatalog.gifts);
  if (!core.followSessionGuard.accept(event.type === "follow"
    ? readState(core.store, ["session.startedAt", "session.tiktokRoomId", "settings.tiktok.roomId"]) : {}, event)) return null;
  core.viewerService.recordEvent(event);
  const overlayChange = hooks.recordEvent(event);
  if (core.viewerService.isBlocked(event)) {
    // Seul le total anonyme du LIVE est diffusé : ni identité, ni événement
    // interactif, ni règle/commande/action de fin d'objectif pour le compte bloqué.
    if (overlayChange?.recordedLiveLike === true && Number.isFinite(overlayChange.likeGoalCurrent)) {
      core.overlayServer.publish("like-goal", { operation: "set", current: overlayChange.likeGoalCurrent });
    }
    hooks.changed(true);
    return { ...event, moderationBlocked: true };
  }
  // La musique ne remplace pas les commandes/règles existantes ; sa réponse
  try { core.matches?.handleLiveEvent?.(event); }
  catch { hooks.activity?.("warning", "matches", "Contribution de match indisponible", "Les autres interactions LIVE restent actives."); }
  // reste locale à ShenPulse et n'est jamais envoyée au chat de la plateforme.
  if (event.type === "chat" && !core.liveEventActions?.chatbot?.hasFunctionalCommand?.(event)) {
    const musicFailed = () => hooks.activity?.("warning", "spotify", "Commande musicale indisponible", "Les autres interactions LIVE restent actives.");
    try { core.spotifyService?.songRequests?.handleChat(event)?.catch(musicFailed); }
    catch { musicFailed(); }
  }
  const completionChange = resolveLikeGoalCompletionChange(event, overlayChange);
  // Les vues OBS et les aperçus reçoivent le même total absolu déjà enregistré,
  // sans changer le lot utilisé par les règles ni l'événement du connecteur.
  const overlayEvent = event.type === "like" && Number.isFinite(overlayChange?.likeGoalCurrent)
    ? { ...event, data: { ...event.data, likeGoalCurrent: overlayChange.likeGoalCurrent } }
    : event;
  core.overlayServer.publishEvent(overlayEvent);
  core.notifyRenderer("live-event", overlayEvent);
  await hooks.handleCommand(event);
  await hooks.handleWheelGiftTriggers(event);
  await core.ruleEngine.process(event);
  await core.overlayCompletionController.handleLikeGoalChange(
    completionChange.previousLikeGoalCurrent, completionChange.likeGoalCurrent,
    { ...event, event, now: new Date().toISOString() }
  );
  hooks.changed(true);
  return event;
}

module.exports = { ingestCreatorEvent };
