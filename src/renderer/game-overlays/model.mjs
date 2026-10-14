/** Prépare et regroupe les interactions sans perdre leurs déclencheurs. */

import { loadOverlayImage } from "./assets.mjs";
import { triggerColors, triggerLabel } from "./canvas.mjs";
import { cleanCommand, compactTitle, detectOverlayEffect, detectWinEffect, withOverlayImage } from "./effects.mjs";
import { findGiftTriggerOption } from "./gifts.mjs";

async function prepareOverlayItems(mappings = [], giftOptions = []) {
  const activeMappings = mappings.filter((mapping) => mapping.enabled && mapping.commands.length && mappingReady(mapping));
  const items = activeMappings.map((mapping) => {
    const gift = mapping.triggerType === "gift" ? findGiftTriggerOption(mapping.giftTrigger, giftOptions) : null;
    const giftLabel = gift?.name || triggerLabel(mapping);
    const effect = detectOverlayEffect(mapping);
    const badge = {
      colors: gift?.colors?.length ? gift.colors : triggerColors(mapping.triggerType),
      giftImage: null,
      giftImageUrl: String(gift?.imageUrl || "").trim(),
      giftLabel,
      likeAmount: mapping.likeAmount,
      mapping,
      triggerType: mapping.triggerType
    };
    return {
      ...badge,
      actionLabels: [effect.label],
      badges: [badge],
      effect
    };
  });
  const images = await Promise.all(items.map((item) => loadOverlayImage(item.giftImageUrl)));
  return items.map((item, index) => {
    const giftImage = images[index] || null;
    const badge = { ...item.badges[0], giftImage };
    return {
      ...item,
      badges: [badge],
      giftImage
    };
  });
}

async function prepareMinecraftStyledOverlayItems(entries) {
  const items = entries.map((entry, index) => {
    const triggerType = entry.triggerType || "gift";
    const giftLabel = String(entry.giftLabel || entry.triggerKey || "Cadeau").trim();
    const triggerKey = String(entry.triggerKey || giftLabel || `${triggerType}-${index}`).trim();
    const mapping = {
      chatCommand: triggerType === "chat" ? triggerKey : "",
      commands: [`shenpulse styled-overlay ${index}`],
      cooldownSeconds: 0,
      enabled: true,
      giftTrigger: triggerType === "gift" ? triggerKey : "none",
      id: `styled-overlay-${index}`,
      interactionPresetId: "",
      interactionPresetParams: {},
      likeAmount: Math.max(0, Math.round(Number(entry.likeAmount) || 0)),
      repeatByGiftCount: false,
      soundName: "",
      soundUrl: "",
      soundVolume: 1,
      title: String(entry.label || "Interaction").trim(),
      triggerType
    };
    const badge = {
      colors: entry.colors?.length ? entry.colors : triggerColors(triggerType),
      giftImage: null,
      giftImageUrl: String(entry.giftImageUrl || "").trim(),
      giftLabel,
      likeAmount: mapping.likeAmount,
      mapping,
      triggerType
    };
    const effectImageUrl = String(entry.effectImageUrl || "").trim();
    const actionLabels = mergeOverlayActionLabels(
      Array.isArray(entry.actionLabels) && entry.actionLabels.length
        ? entry.actionLabels
        : [entry.label]
    );
    const effect = withOverlayImage(detectWinEffect([], mapping.title) || {
      imageUrl: effectImageUrl || void 0,
      kind: "command",
      label: actionLabels[0] || "ACTION"
    }, effectImageUrl);
    return {
      ...badge,
      actionLabels,
      badgeLayout: entry.badgeLayout,
      badges: [badge],
      effect,
      groupKey: String(entry.groupKey || "").trim()
    };
  });
  const images = await Promise.all(items.map((item) => loadOverlayImage(item.giftImageUrl)));
  return items.map((item, index) => {
    const giftImage = images[index] || null;
    const badge = { ...item.badges[0], giftImage };
    return {
      ...item,
      badges: [badge],
      giftImage
    };
  });
}

function groupOverlayEffectItems(items) {
  const groups = /* @__PURE__ */ new Map();
  for (const item of items) {
    const key = overlayEffectGroupKey(item);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { ...item, badges: [...item.badges] });
      continue;
    }
    existing.badges = mergeOverlayBadges([...existing.badges, ...item.badges]);
    existing.actionLabels = mergeOverlayActionLabels([
      ...existing.actionLabels,
      ...item.actionLabels
    ]);
  }
  return Array.from(groups.values());
}

function mergeOverlayActionLabels(labels) {
  return Array.from(new Set(labels.map((label) => compactTitle(label, "ACTION"))));
}

function overlayEffectGroupKey(item) {
  const explicitGroupKey = String(item.groupKey || "").trim().toLowerCase();
  if (explicitGroupKey) return `styled:${explicitGroupKey}`;
  const commandSignature = item.mapping.commands.map(cleanCommand).filter((command) => {
    const clean = command.toLowerCase();
    return !/^title\s+@a\s+(?:title|subtitle)\b/.test(clean) && !/^delay\s+\d+\b/.test(clean);
  }).map((command) => command.toLowerCase()).join("|");
  return `${item.effect.kind}|${item.effect.label}|${commandSignature || item.mapping.title.toLowerCase()}`;
}

function mergeOverlayBadges(badges) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const badge of badges) {
    const key = overlayBadgeKey(badge);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(badge);
  }
  return result.sort((left, right) => overlayBadgeRank(left) - overlayBadgeRank(right));
}

function overlayBadgeKey(badge) {
  if (badge.triggerType === "gift") return `gift:${badge.mapping.giftTrigger}:${badge.giftLabel}`;
  if (badge.triggerType === "likes") return `likes:${badge.likeAmount}`;
  if (badge.triggerType === "chat") return `chat:${badge.mapping.chatCommand}`;
  return badge.triggerType;
}

function overlayBadgeRank(badge) {
  if (badge.triggerType === "follow") return 0;
  if (badge.triggerType === "gift") return 1;
  if (badge.triggerType === "likes") return 2;
  if (badge.triggerType === "subscribe") return 3;
  if (badge.triggerType === "share") return 4;
  if (badge.triggerType === "chat") return 5;
  if (badge.triggerType === "join") return 6;
  if (badge.triggerType === "raid") return 7;
  return 8;
}

function mappingReady(mapping) {
  if (mapping.triggerType === "gift") return mapping.giftTrigger !== "none";
  if (mapping.triggerType === "likes") return mapping.likeAmount > 0;
  if (mapping.triggerType === "chat") return Boolean(mapping.chatCommand.trim());
  return true;
}

export { prepareOverlayItems, prepareMinecraftStyledOverlayItems, groupOverlayEffectItems, mergeOverlayActionLabels, overlayEffectGroupKey, mergeOverlayBadges, overlayBadgeKey, overlayBadgeRank, mappingReady };

