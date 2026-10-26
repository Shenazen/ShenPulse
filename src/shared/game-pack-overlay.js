"use strict";
const {normalizeGamePackPresentation}=require("./game-pack-presentation");
const {title: interactionTitle} = require("./game-interaction-titles");
const sceneLayout = require("../../resources/overlays/scene-layout");
const effects = require("../../resources/catalogs/supermarket-simulator-effects.json");
const PACK_ID = "supermarket-simulator";
const STATE_PATHS = ["session.profileId", "game.interactionRulesByPack." + PACK_ID, "commerce.subscription", "settings.overlayConfigs.gameInteractionOverlays.supermarket-simulator"];
const help = new Set(["SpawnCustomers", "CustomerRush", "GiveMoney", "Jackpot", "FillShelves", "MaxLevel", "AntiChaos", "SpeedBoost", "OpenStore", "DeliverProducts", "HireEmployees", "UnlockAllLicenses", "UpgradeStore", "DeliverFurniture", "ResetEffects"]);
const neutral = new Set(["SpeedUpTime", "ThrowItem", "DropAllItems", "RandomizePrices", "Teleport", "ChangeFOV", "GameSpeedUp", "ChangeLanguage", "AutoDiscount", "FinishDay", "ResetGame"]);
const text = (value, limit = 120) => String(value || "").slice(0, limit);
function effectArtwork(effect) {
  const image = String(effect.image || "").replace(/^\.\.\/\.\.\/resources\/overlays\//, "");
  return /^media\/game-interactions\/supermarket-simulator\/[a-z0-9_-]+\.png$/.test(image) ? image : "";
}
function createGamePackOverlay(state) {
  const profileId = text(state?.session?.profileId), enabled = sceneLayout.activeProAccess(state);
  const rules = state?.game?.interactionRulesByPack?.[PACK_ID] || [];
  const cards = !enabled ? [] : rules.slice(0, 180).flatMap((rule) => {
    if (rule.enabled === false || rule.trigger?.enabled === false || !["gift", "follow", "like", "likes"].includes(rule.trigger?.type)) return [];
    const action = rule.actions?.find((item) => item.type === "game.effect" && item.config?.packId === PACK_ID);
    const effect = effects.find((item) => item.id === action?.config?.effectId && item.available !== false);
    if (!effect) return [];
    const gift = rule.conditions?.find((item) => item.field === "data.giftName") || {};
    const column = ["help", "neutral", "trap"].includes(rule.gameInteraction?.marketColumn) ? rule.gameInteraction.marketColumn : help.has(effect.code) ? "help" : neutral.has(effect.code) ? "neutral" : "trap";
    let giftImageUrl = "";
    try { const url = new URL(gift.giftImageUrl); if (url.protocol === "https:") giftImageUrl = url.href.slice(0, 2000); } catch { /* Optional gift artwork. */ }
    return [{ id: text(rule.id), title: text(interactionTitle(rule, effect)), column,
      actionLabels:[text(interactionTitle(rule,effect)),...rule.actions.filter(a=>a!==action&&a.type==="game.effect"&&a.config?.packId===PACK_ID).map(a=>effects.find(e=>e.id===a.config.effectId&&e.available!==false)?.name).filter(Boolean).map(n=>text(n))].slice(0,16),
      triggerType: rule.trigger.type, threshold: Math.max(1, Number(rule.trigger.threshold) || 1),
      effectImageUrl: effectArtwork(effect), giftName: text(gift.value), giftImageUrl, giftCost: Math.max(0, Number(gift.giftCost) || 0) }];
  });
  return { profileId, packId: PACK_ID, enabled, cards, presentation:normalizeGamePackPresentation(state?.settings?.overlayConfigs?.gameInteractionOverlays?.[PACK_ID]||{}) };
}
function gamePackOverlayTrigger({ ok, rule, action, event, profileId }) {
  if (!ok || !rule || !action || action.type !== "game.effect" || action.config?.packId !== PACK_ID) return null;
  const first = rule.actions?.find((item) => item.type === "game.effect" && item.config?.packId === PACK_ID);
  if (first !== action && (!first?.id || first.id !== action.id)) return null;
  return { profileId: text(profileId), packId: PACK_ID, ruleId: text(rule.id), viewer: text(event?.user?.displayName || event?.user?.uniqueId || "Viewer", 80) };
}
module.exports = { PACK_ID, STATE_PATHS, createGamePackOverlay, gamePackOverlayTrigger };
