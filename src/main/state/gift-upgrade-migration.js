"use strict";

const { findCatalogGift, giftIdentity, giftVisualUrl, normalizeGiftName } = require("../../shared/gift-identity");

const INTEGRATED_GIFT_KEYS = new Set(["guardGift", "mysteryCube", "tickets", "giftRules"]);
const HISTORY_KEYS = new Set(["queue", "activePlayers", "participants", "history", "events"]);

/**
 * Prépare une réparation sans écrire ni modifier l'état. Seuls un identifiant
 * reconnu (y compris ses alias) ou un nom exact et non ambigu autorisent un lien.
 * Une ancienne image, un prix seul ou une ressemblance de nom ne suffisent pas.
 */
function collectGiftReferenceUpdates(state, gifts = [], { confirmedVariants = [], onlyConfirmed = false } = {}) {
  if (!state || typeof state !== "object" || !Array.isArray(gifts) || !gifts.length) return [];
  // Ces choix explicites sont ponctuels et propres à l'espace fourni par
  // l'appelant. La migration automatique n'impose aucun prix aux utilisateurs.
  const confirmations = new Map();
  for (const selection of confirmedVariants) {
    const nameKey = normalizeGiftName(selection?.name);
    const cost = Number(selection?.cost);
    if (!nameKey || !Number.isSafeInteger(cost) || cost <= 0) {
      throw new Error("La variante confirmée doit préciser un nom et un prix entier positif.");
    }
    const gift = findCatalogGift(gifts, { giftName: selection.name, giftCost: cost });
    if (!gift) throw new Error(`Le cadeau confirmé « ${selection.name} » à ${cost} pièces n'est pas unique dans le catalogue.`);
    const previous = confirmations.get(nameKey);
    if (previous && giftIdentity(previous).id !== giftIdentity(gift).id) {
      throw new Error(`Plusieurs variantes ont été confirmées pour « ${selection.name} ».`);
    }
    confirmations.set(nameKey, gift);
  }
  const updates = [];
  const visited = new WeakSet();

  function propose(target, key, value) {
    if (JSON.stringify(target[key]) !== JSON.stringify(value)) updates.push({ target, key, value });
  }

  function resolve(candidate) {
    const identity = giftIdentity(candidate);
    if (!identity.ids.length && !identity.nameKey) return null;
    const gift = findCatalogGift(gifts, candidate);
    if (!gift) return null;
    const confirmed = giftIdentity(gift);
    // Défense supplémentaire pour les anciens résolveurs : un ID inconnu ne
    // peut jamais être réattribué parce que son image ou son libellé ressemble.
    if (identity.ids.length && !identity.ids.some((id) => confirmed.ids.includes(id))) return null;
    return gift;
  }

  function repair(target, { name = "", imageKey = "giftImageUrl", cost } = {}) {
    if (!target || typeof target !== "object" || Array.isArray(target)) return;
    const candidate = {
      giftId: target.giftId,
      giftIds: target.giftIds,
      giftName: name || target.giftName || target.name,
      giftCost: cost ?? target.giftCost ?? target.cost ?? target.giftValue
    };
    const originalIdentity = giftIdentity(candidate);
    const confirmed = !originalIdentity.ids.length
      ? confirmations.get(originalIdentity.nameKey) : null;
    // Un ancien choix précis (ID ou prix différent) n'est pas une sélection
    // ambiguë à réparer : conserver sa variante, même si le nom est identique.
    const compatibleConfirmation = confirmed &&
      (!originalIdentity.cost || originalIdentity.cost === giftIdentity(confirmed).cost);
    if (onlyConfirmed && !compatibleConfirmation) return;
    if (compatibleConfirmation) candidate.giftCost = giftIdentity(confirmed).cost;
    const gift = resolve(candidate);
    if (!gift) {
      // Plusieurs ID peuvent partager avec certitude le même visuel. Cette
      // réparation d'affichage ne crée ni identité, ni alias d'exécution.
      if (!giftIdentity(candidate).ids.length) {
        const commonImage = giftVisualUrl(gifts, candidate);
        if (commonImage) propose(target, imageKey, commonImage);
      }
      return;
    }
    const identity = giftIdentity(gift);
    const selectedId = String(target.giftId || "").trim();
    if (!selectedId && identity.id) propose(target, "giftId", identity.id);
    const aliases = Array.isArray(target.giftIds) ? [...target.giftIds] : [];
    const known = new Set(aliases.map((id) => String(id).trim().toLowerCase()));
    for (const id of identity.ids) {
      if (id === (selectedId || identity.id).toLowerCase() || known.has(id)) continue;
      aliases.push(id);
      known.add(id);
    }
    if (aliases.length) propose(target, "giftIds", aliases);
    if (identity.family) propose(target, "giftFamily", identity.family);
    if (identity.imageUrl) propose(target, imageKey, identity.imageUrl);
    if (compatibleConfirmation) propose(target, "giftCost", identity.cost);
    // Ne pas réécrire value/name/giftName, coût, quantité, cooldown ou actions :
    // ces champs définissent les choix et le comportement voulu par le créateur.
  }

  function rules(entries) {
    for (const rule of Array.isArray(entries) ? entries : []) {
      for (const condition of Array.isArray(rule?.conditions) ? rule.conditions : []) {
        if (condition?.field === "data.giftName" && condition.operator === "equals") {
          repair(condition, { name: condition.value });
        }
      }
    }
  }

  function integrated(value, key = "") {
    if (!value || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      for (const item of value) integrated(item, key);
      return;
    }
    if (Object.prototype.hasOwnProperty.call(value, "giftId") || INTEGRATED_GIFT_KEYS.has(key)) {
      repair(value, {
        imageKey: Object.prototype.hasOwnProperty.call(value, "giftImage")
          ? "giftImage" : Object.prototype.hasOwnProperty.call(value, "giftImageUrl")
            ? "giftImageUrl" : "image"
      });
    }
    for (const [childKey, child] of Object.entries(value)) {
      if (!HISTORY_KEYS.has(childKey)) integrated(child, childKey);
    }
  }

  function overlays(configs) {
    for (const wheel of Array.isArray(configs?.wheel?.wheels) ? configs.wheel.wheels : []) {
      // Les critères de prix restent des critères de prix, même si un ancien
      // sélecteur spécifique subsiste dans la configuration de la roue.
      if (wheel?.giftValueFilter || !String(wheel?.trigger || "").trim()) continue;
      if (wheel.triggerGift && typeof wheel.triggerGift === "object") {
        repair(wheel.triggerGift, { name: wheel.trigger });
      } else {
        const confirmed = confirmations.get(normalizeGiftName(wheel.trigger));
        if (onlyConfirmed && !confirmed) continue;
        const gift = resolve({ giftName: wheel.trigger, giftCost: confirmed ? giftIdentity(confirmed).cost : undefined });
        if (!gift) {
          const commonImage = giftVisualUrl(gifts, { giftName: wheel.trigger });
          if (commonImage) propose(wheel, "triggerGift", { giftImageUrl: commonImage });
          continue;
        }
        const identity = giftIdentity(gift);
        const triggerGift = { giftId: identity.id };
        if (identity.ids.length > 1) triggerGift.giftIds = identity.ids.filter((id) => id !== identity.id);
        if (identity.family) triggerGift.giftFamily = identity.family;
        if (identity.imageUrl) triggerGift.giftImageUrl = identity.imageUrl;
        if (confirmed) triggerGift.giftCost = identity.cost;
        propose(wheel, "triggerGift", triggerGift);
      }
    }
  }

  function workspace(value) {
    if (!value || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);
    rules(value.rules);
    for (const entries of Object.values(value.game?.interactionRulesByPack || {})) rules(entries);
    integrated(value.game?.connectorOverrides);
    overlays(value.overlayConfigs || value.settings?.overlayConfigs);
    for (const profile of Array.isArray(value.profiles) ? value.profiles : []) workspace(profile?.workspace);
  }

  workspace(state);
  for (const account of Object.values(state.accountWorkspaces || {})) workspace(account);
  workspace(state.unclaimedAccountWorkspace);
  return updates;
}

/** Applique seulement les métadonnées préparées, après la sauvegarde du store. */
function applyGiftReferenceUpdates(updates) {
  for (const { target, key, value } of updates) target[key] = value;
  return updates.length;
}

module.exports = { collectGiftReferenceUpdates, applyGiftReferenceUpdates };
