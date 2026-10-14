"use strict";

const { findCatalogGift } = require("../../shared/gift-identity");
const { defaultEffectParameters } = require("./commands");

/** Association indépendante de catalogue, avec paramètres et métadonnées cadeaux. */
function defaultGameInteractionRule(
  pack,
  effect,
  mapping,
  version,
  giftCatalog = null
) {
  const triggerEnabled = mapping.triggerEnabled !== false;
  const giftName = String(mapping.giftName || "").trim();
  const giftCondition = giftName
    ? defaultGiftCondition(mapping, giftCatalog?.gifts || [])
    : null;
  const title = String(mapping.title || effect.name).trim();
  const safePresetId = String(mapping.id || effect.id)
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return {
    id: `rule_${pack.id}_${safePresetId}`,
    name: `${pack.name} · ${title}`,
    enabled: mapping.enabled !== false,
    priority: 50,
    trigger: {
      enabled: triggerEnabled,
      type: mapping.triggerType || "gift",
      source: "*",
      threshold: Math.max(1, Number(mapping.threshold || 1))
    },
    conditions: triggerEnabled
      ? Array.isArray(mapping.conditions)
        ? structuredClone(mapping.conditions)
        : giftCondition
          ? [giftCondition]
          : []
      : [],
    cooldown: {
      globalMs: Math.max(
        0,
        Number(mapping.cooldownSeconds || 0) * 1000
      ),
      perUserMs: 0
    },
    chance: 1,
    gameInteraction: {
      catalogVersion: version,
      default: true,
      presetId: mapping.id,
      title
    },
    actions: [
      {
        id: `action_${pack.id}_${safePresetId}`,
        type: mapping.actionType || effect.actionType || "game.effect",
        config: {
          packId: pack.id,
          effectId: effect.id,
          quantity: Number(mapping.quantity || effect.quantity || 1),
          duration: Number(
            mapping.duration ?? effect.duration ?? 0
          ),
          parameters: {
            ...defaultEffectParameters(effect),
            ...(mapping.parameters || {})
          },
          ...(effect.winCounter
            ? {
                amount: Number(
                  mapping.amount ?? effect.winCounter.amount ?? 0
                ),
                operation:
                  mapping.operation ||
                  effect.winCounter.operation ||
                  "adjust"
              }
            : {}),
          ...(mapping.actionConfig || {})
        }
      }
    ]
  };
}

/** Résout les ID et variantes de cadeaux sans les confondre sur leur seul visuel. */
function defaultGiftCondition(mapping, gifts = []) {
  const configuredIds = [
    String(mapping.giftId || "").trim(),
    ...(Array.isArray(mapping.giftIds) ? mapping.giftIds : [])
  ].filter(Boolean);
  const catalogGift = findCatalogGift(gifts, {
    id: configuredIds[0] || "",
    giftIds: configuredIds.slice(1),
    name: mapping.giftName,
    cost: mapping.giftCost
  });
  const resolvedIds = [
    ...configuredIds,
    String(catalogGift?.id || "").trim(),
    ...(Array.isArray(catalogGift?.alternateIds)
      ? catalogGift.alternateIds
      : [])
  ].filter(Boolean);
  const giftId = resolvedIds[0] || "";
  const giftIds = [...new Set(resolvedIds)].filter((id) => id !== giftId);
  const giftImageUrl = String(catalogGift?.imageUrl || "").trim();
  const giftCost = Math.max(
    0,
    Number(mapping.giftCost ?? catalogGift?.cost) || 0
  );
  const giftFamily = String(
    mapping.giftFamily || catalogGift?.giftFamily || ""
  ).trim();
  return {
    field: "data.giftName",
    operator: "equals",
    value: String(mapping.giftName || catalogGift?.name || "").trim(),
    ...(giftId ? { giftId } : {}),
    ...(giftIds.length ? { giftIds } : {}),
    ...(giftCost ? { giftCost } : {}),
    ...(giftFamily ? { giftFamily } : {}),
    ...(giftImageUrl ? { giftImageUrl } : {})
  };
}

/** Répare une association héritée connue sans modifier son activation. */
function repairDefaultGiftInteraction(rule, expectedRule, mapping, version) {
  if (
    !mapping.giftId ||
    rule?.gameInteraction?.default !== true ||
    String(rule.gameInteraction.presetId || "") !== String(mapping.id || "") ||
    Number(rule.gameInteraction.catalogVersion || 0) >= version
  ) {
    return false;
  }
  const enabled = rule.enabled !== false;
  const triggerEnabled = rule.trigger?.enabled !== false;
  const replacement = structuredClone(expectedRule);
  for (const key of Object.keys(rule)) delete rule[key];
  Object.assign(rule, replacement);
  rule.enabled = enabled;
  rule.trigger.enabled = triggerEnabled;
  return true;
}

/** Répare les valeurs génériques Minecraft, jamais un montant personnalisé. */
function repairDefaultWinCounterInteraction(
  packId,
  rule,
  effect,
  mapping
) {
  if (
    !["minecraft-bedrock-box", "minecraft-sandbox-3"].includes(packId) ||
    !effect.winCounter ||
    rule?.gameInteraction?.default !== true ||
    String(rule.gameInteraction.presetId || "") !== String(mapping.id || "")
  ) {
    return false;
  }
  const action = (rule.actions || []).find(
    (entry) =>
      entry?.type === "overlay.win-counter" &&
      entry.config?.effectId === effect.id
  );
  if (!action?.config) return false;

  const expectedAmount = Number(
    mapping.amount ?? effect.winCounter.amount ?? 0
  );
  const genericAmount = Number(effect.winCounter.amount ?? 0);
  const currentAmount = Number(action.config.amount);
  if (
    !Number.isFinite(expectedAmount) ||
    expectedAmount === genericAmount ||
    (Number.isFinite(currentAmount) && currentAmount !== genericAmount)
  ) {
    return false;
  }

  action.config.amount = expectedAmount;
  action.config.operation =
    mapping.operation || effect.winCounter.operation || "adjust";
  return true;
}

module.exports = { defaultGameInteractionRule, defaultGiftCondition, repairDefaultGiftInteraction, repairDefaultWinCounterInteraction };
