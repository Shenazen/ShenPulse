"use strict";

/** Identifiants, actions et interactions inclus dans les exports. */

function normalizedOverlayTriggerType(rule) {
  const type = String(rule?.trigger?.type || "").trim();
  if (type === "like") return "likes";
  if (type === "message") return "chat";
  if (type === "subscription") return "subscribe";
  return [
    "gift",
    "likes",
    "chat",
    "follow",
    "share",
    "subscribe",
    "join",
    "raid"
  ].includes(type)
    ? type
    : "";
}

function triggeredOverlayActionKey(row) {
  return String(
    row?.action?.id || `${row?.rule?.id || "rule"}:${row?.actionIndex || 0}`
  );
}

function triggeredOverlayActions() {
  const rows = flattenActions().filter(
    ({ action }) =>
      action?.enabled !== false && canAccessActionType(action?.type)
  );
  const rowsByActionId = new Map(
    rows
      .filter(({ action }) => action?.id)
      .map((row) => [String(row.action.id), row])
  );
  const entriesByAction = new Map();

  for (const triggerRule of snapshot?.state?.rules || []) {
    const triggerType = normalizedOverlayTriggerType(triggerRule);
    if (
      triggerRule.enabled === false ||
      !hasAutomaticTrigger(triggerRule) ||
      !triggerType
    ) {
      continue;
    }
    const selectedIds = triggerRule.actionSelection?.actionIds;
    const triggeredRows = Array.isArray(selectedIds)
      ? [...new Set(selectedIds.map(String).filter(Boolean))]
          .map((actionId) => rowsByActionId.get(actionId))
          .filter(Boolean)
      : rows.filter((row) => row.rule.id === triggerRule.id);

    for (const row of triggeredRows) {
      const key = triggeredOverlayActionKey(row);
      const current = entriesByAction.get(key) || {
        ...row,
        triggerRules: []
      };
      if (!current.triggerRules.some((rule) => rule.id === triggerRule.id)) {
        current.triggerRules.push(triggerRule);
      }
      entriesByAction.set(key, current);
    }
  }
  return [...entriesByAction.values()];
}

function overlayTriggerKey(rule, triggerType = normalizedOverlayTriggerType(rule)) {
  if (triggerType === "gift") {
    const condition = ruleGiftCondition(rule);
    return String(
      condition?.giftId || condition?.value || ruleGiftValueLabel(rule) ||
        triggerLabel(rule)
    );
  }
  if (triggerType === "chat") {
    const messageCondition = (rule?.conditions || []).find(
      (condition) => condition.field === "data.message"
    );
    return String(messageCondition?.value || triggerLabel(rule));
  }
  return String(triggerLabel(rule));
}

function overlayTriggerGift(rule) {
  const condition = ruleGiftCondition(rule);
  const name = String(condition?.value || ruleGiftValueLabel(rule) || "Cadeau");
  const gift = giftForSavedReference(name, condition?.giftId, condition);
  return {
    id: String(condition?.giftId || gift?.id || ""),
    imageUrl: String(gift?.imageUrl || condition?.giftImageUrl || ""),
    name
  };
}

function overlayActionLabel(row) {
  const ownerName = String(row?.rule?.name || "Action").trim();
  const siblingCount = (row?.rule?.actions || []).length;
  return siblingCount > 1
    ? `${ownerName} · ${actionTypeLabel(row.action.type)}`
    : ownerName;
}

function overlayActionEffectImageUrl(action, pack) {
  const config = action?.config || {};
  if (["game.effect", "overlay.win-counter"].includes(action?.type)) {
    return String(
      (pack?.effects || []).find((effect) => effect.id === config.effectId)
        ?.image || ""
    );
  }
  if (canonicalActionType(action?.type) !== "overlay.media") return "";
  const media = mediaLibraryEntry(config.mediaUrl);
  const source = String(media?.previewUrl || media?.url || config.mediaUrl || "");
  const kind = media?.kind || mediaKindFromUrl(source);
  return ["image", "gif"].includes(kind) ? resolvedMediaUrl(source) : "";
}

function overlayEntriesForTriggeredAction(row, pack) {
  const actionKey = triggeredOverlayActionKey(row);
  const label = overlayActionLabel(row);
  const effectImageUrl = overlayActionEffectImageUrl(row.action, pack);
  const seenTriggers = new Set();
  return row.triggerRules.map((triggerRule) => {
    const triggerType = normalizedOverlayTriggerType(triggerRule);
    const gift = triggerType === "gift" ? overlayTriggerGift(triggerRule) : null;
    return {
      effectId: `global-action-${actionKey}`,
      isWinEffect: false,
      title: label,
      trigger: triggerLabel(triggerRule),
      triggerType,
      triggerKey:
        triggerType === "gift" && gift?.id
          ? gift.id
          : overlayTriggerKey(triggerRule, triggerType),
      likeAmount:
        triggerType === "likes"
          ? Math.max(1, Number(triggerRule.trigger?.threshold || 1))
          : 0,
      groupKey: `global-action:${actionKey}`,
      badgeLayout: row.triggerRules.length > 1 ? "top-row" : "corners",
      effectImageUrl,
      giftImageUrl: gift?.imageUrl || "",
      giftLabel: gift?.name || triggerLabel(triggerRule)
    };
  }).filter((entry) => {
    const identity = gameOverlayEntryTriggerIdentity(entry);
    if (seenTriggers.has(identity)) return false;
    seenTriggers.add(identity);
    return true;
  });
}

function gameOverlayEntryTriggerIdentity(entry) {
  const triggerType = String(entry?.triggerType || "");
  if (triggerType === "likes") {
    return `likes:${Math.max(1, Math.round(Number(entry?.likeAmount) || 1))}`;
  }
  if (["follow", "share", "subscribe", "join", "raid"].includes(triggerType)) {
    return triggerType;
  }
  if (triggerType !== "gift") {
    return `${triggerType}:${String(entry?.triggerKey || "").toLowerCase()}`;
  }
  const gift = giftForIdentity(entry?.giftLabel, entry?.triggerKey, { giftImageUrl: entry?.giftImageUrl });
  const identity = String(
    gift?.id || entry?.triggerKey || normalizeGiftName(entry?.giftLabel)
  );
  return `gift:${identity.toLowerCase()}`;
}

function mergeGameOverlayEntries(gameEntries, additionalEntries) {
  const merged = [...gameEntries];
  for (const entry of additionalEntries) {
    const identity = gameOverlayEntryTriggerIdentity(entry);
    let matchingIndex = -1;
    merged.forEach((candidate, index) => {
      if (gameOverlayEntryTriggerIdentity(candidate) === identity) {
        matchingIndex = index;
      }
    });
    merged.splice(matchingIndex < 0 ? merged.length : matchingIndex + 1, 0, entry);
  }
  return merged;
}

function overlayTriggerPickerVisual(rule) {
  const triggerType = normalizedOverlayTriggerType(rule);
  const gift = triggerType === "gift" ? overlayTriggerGift(rule) : null;
  const iconType = triggerType === "likes" ? "like" : triggerType;
  return eventIconMarkup(iconType, {
    ...ruleGiftCondition(rule),
    giftId: gift?.id,
    giftName: gift?.name,
    imageUrl: gift?.imageUrl
  });
}

function overlayActionPickerVisual(row, pack) {
  const imageUrl = overlayActionEffectImageUrl(row.action, pack);
  if (imageUrl) {
    return `<img src="${escapeHtml(imageUrl)}" alt="" loading="lazy">`;
  }
  return `<span>${escapeHtml(
    ACTION_TYPE_ICONS[canonicalActionType(row.action.type)] || "◆"
  )}</span>`;
}
