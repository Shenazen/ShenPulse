"use strict";

/**
 * Utilitaires d'affichage, confirmations et bibliothèques de médias.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeGiftName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[œŒ]/g, "oe")
    .replace(/[æÆ]/g, "ae")
    .trim()
    .toLocaleLowerCase("fr");
}

function rememberGifts(gifts = []) {
  for (const gift of gifts) {
    const key = normalizeGiftName(gift.name);
    const id = String(gift.id || "").trim();
    if (id) giftCatalogById.set(id, gift);
    if (key && !giftCatalogByName.has(key)) {
      giftCatalogByName.set(key, gift);
    }
  }
  GIFT_CATALOG = [...giftCatalogById.values()];
}

function giftForName(name) {
  return giftCatalogByName.get(normalizeGiftName(name)) || null;
}

function giftForIdentity(name, id = "") {
  return giftCatalogById.get(String(id || "").trim()) || giftForName(name);
}

function eventIconMarkup(type, options = {}) {
  const kind = String(type || "").toLocaleLowerCase("fr");
  const imageUrl =
    options.imageUrl ||
    (kind === "gift"
      ? giftForIdentity(options.giftName, options.giftId)?.imageUrl
      : "");
  if (imageUrl) {
    return `<span class="event-visual event-${escapeHtml(kind)}"><img src="${escapeHtml(imageUrl)}" alt="" loading="lazy"></span>`;
  }
  const paths = {
    gift: '<path d="M4 10h16v10H4zM3 7h18v4H3zM12 7v13M12 7H8.8A2.8 2.8 0 1 1 12 4.2V7Zm0 0h3.2A2.8 2.8 0 1 0 12 4.2V7Z"/>',
    follow: '<circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0M18 8v6M15 11h6"/>',
    like: '<path d="M20.8 5.8a5.4 5.4 0 0 0-7.6 0L12 7l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 22l8.8-8.6a5.4 5.4 0 0 0 0-7.6Z"/>',
    chat: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/>',
    subscribe: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"/>',
    join: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/><path d="m18 4 2 2 3-3"/>',
    raid: '<path d="m13 2-9 12h7l-1 8 9-12h-7Z"/>',
    manual: '<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4Z"/>'
  };
  return `<span class="event-visual event-${escapeHtml(kind || "other")}"><svg viewBox="0 0 24 24" aria-hidden="true">${paths[kind] || '<circle cx="12" cy="12" r="7"/>'}</svg></span>`;
}

function ruleGiftCondition(rule) {
  return (rule?.conditions || []).find(
    (condition) =>
      condition.field === "data.giftName" &&
      String(condition.operator || "equals") === "equals"
  ) || null;
}

function ruleGiftName(rule) {
  return ruleGiftCondition(rule)?.value || "";
}

const GIFT_VALUE_OPERATOR_OPTIONS = [
  ["less", "< · Moins de"],
  ["lessOrEqual", "≤ · Inférieur ou égal"],
  ["equals", "= · Égal à"],
  ["notEquals", "≠ · Différent de"],
  ["greaterOrEqual", "≥ · Supérieur ou égal"],
  ["greater", "> · Plus de"]
];

function giftValueCondition(conditions = []) {
  return (conditions || []).find(
    (condition) =>
      condition.field === "data.value" &&
      GIFT_VALUE_OPERATOR_OPTIONS.some(
        ([operator]) => operator === condition.operator
      )
  ) || null;
}

function giftValueFilterLabel(filter) {
  const value = Number(filter?.value);
  if (!Number.isFinite(value) || value <= 0) return "";
  const symbols = {
    less: "<",
    lessOrEqual: "≤",
    equals: "=",
    notEquals: "≠",
    greaterOrEqual: "≥",
    greater: ">"
  };
  return `${symbols[filter.operator] || "≥"} ${new Intl.NumberFormat("fr-FR").format(value)} pièces`;
}

function normalizeGiftValueFilterConfig(filter) {
  const value = Number(filter?.value);
  if (!Number.isFinite(value) || value <= 0) return null;
  const operator = GIFT_VALUE_OPERATOR_OPTIONS.some(
    ([candidate]) => candidate === filter?.operator
  )
    ? filter.operator
    : "greaterOrEqual";
  return { operator, value };
}

function ruleGiftValueLabel(rule) {
  return giftValueFilterLabel(giftValueCondition(rule?.conditions || []));
}

function hasAutomaticTrigger(rule) {
  return rule?.trigger?.enabled !== false;
}

function triggerPill(rule) {
  if (!hasAutomaticTrigger(rule)) {
    return `<span class="trigger-pill trigger-manual">${eventIconMarkup("manual")}<span>Lancement manuel</span></span>`;
  }
  const type = rule?.trigger?.type || "*";
  const giftCondition = type === "gift" ? ruleGiftCondition(rule) : null;
  const giftName = giftCondition?.value || "";
  const gift = giftForIdentity(giftName, giftCondition?.giftId);
  return `<span class="trigger-pill">${eventIconMarkup(type, {
    giftId: giftCondition?.giftId,
    giftName,
    imageUrl: gift?.imageUrl || giftCondition?.giftImageUrl
  })}<span>${escapeHtml(triggerLabel(rule))}</span></span>`;
}

function asNumber(value) {
  return new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0));
}

function formatTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value));
}

function formatDuration(startedAt) {
  if (!startedAt) return "00:00:00";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const hours = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const rest = String(seconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${rest}`;
}

function toast(title, detail = "", isError = false) {
  const node = document.createElement("div");
  node.className = `toast${isError ? " error" : ""}`;
  node.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span>`;
  toastRegion.appendChild(node);
  setTimeout(() => node.remove(), 4200);
}

function storePackageVersionLabel(value) {
  const parts = String(value || "").split(".").filter(Boolean);
  while (parts.length > 3 && parts.at(-1) === "0") parts.pop();
  return parts.join(".");
}

function renderStoreUpdateBanner() {
  const available = storeUpdateStatus?.available === true;
  storeUpdateBanner.hidden = !available;
  if (!available) return;

  const version = storePackageVersionLabel(
    storeUpdateStatus.packageVersion
  );
  storeUpdateBanner.classList.toggle(
    "mandatory",
    storeUpdateStatus.mandatory === true
  );
  storeUpdateTitle.textContent = storeUpdateStatus.mandatory
    ? "Mise à jour ShenPulse requise"
    : "Une mise à jour ShenPulse est disponible";
  storeUpdateDetail.textContent = version
    ? `La version ${version} est disponible sur Microsoft Store.`
    : "Microsoft Store propose une nouvelle version de l’application.";
  storeUpdateButton.disabled = storeUpdateInstalling;
  storeUpdateButton.textContent = storeUpdateInstalling
    ? "Mise à jour…"
    : "Mettre à jour";
}

function refreshStoreUpdate({ force = false } = {}) {
  if (storeUpdateCheckPromise) return storeUpdateCheckPromise;
  storeUpdateCheckPromise = api.updates
    .check({ force })
    .then((status) => {
      storeUpdateStatus = status;
      renderStoreUpdateBanner();
      return status;
    })
    .catch(() => null)
    .finally(() => {
      storeUpdateCheckPromise = null;
    });
  return storeUpdateCheckPromise;
}

async function installStoreUpdate() {
  if (storeUpdateInstalling || !storeUpdateStatus?.available) return;
  const confirmed = await confirmAction(
    "ShenPulse va demander au Microsoft Store d’installer la nouvelle version. L’application peut se fermer pendant l’installation.",
    {
      title: "Installer la mise à jour ?",
      confirmLabel: "Mettre à jour",
      danger: false
    }
  );
  if (!confirmed) return;

  storeUpdateInstalling = true;
  renderStoreUpdateBanner();
  try {
    const result = await api.updates.install();
    if (result?.installed || result?.state === "completed") {
      toast(
        "Mise à jour installée",
        "Relancez ShenPulse si l’application ne redémarre pas automatiquement."
      );
      storeUpdateStatus = { ...storeUpdateStatus, available: false };
    } else if (result?.openedStore) {
      toast(
        "Microsoft Store ouvert",
        "Terminez la mise à jour de ShenPulse depuis la page affichée."
      );
    } else if (result?.available === false) {
      toast("ShenPulse est à jour");
      storeUpdateStatus = { ...storeUpdateStatus, available: false };
    }
  } catch (error) {
    toast(
      "Mise à jour impossible",
      error?.message || "Microsoft Store n’a pas pu être ouvert.",
      true
    );
  } finally {
    storeUpdateInstalling = false;
    renderStoreUpdateBanner();
  }
}

function finishConfirmation(confirmed) {
  const resolve = confirmationResolver;
  if (!resolve) return;
  confirmationResolver = null;
  if (confirmationDialog.open) {
    confirmationDialog.close(confirmed ? "confirm" : "cancel");
  }
  requestAnimationFrame(() => {
    window.focus();
    resolve(confirmed);
  });
}

function confirmAction(
  message,
  {
    title = "Confirmer l’action",
    confirmLabel = "Confirmer",
    danger = true
  } = {}
) {
  if (confirmationResolver) finishConfirmation(false);
  confirmationTitle.textContent = title;
  confirmationMessage.textContent = String(message || "");
  confirmationSubmitButton.textContent = confirmLabel;
  confirmationSubmitButton.classList.toggle("danger", danger);
  return new Promise((resolve) => {
    confirmationResolver = resolve;
    if (!confirmationDialog.open) confirmationDialog.showModal();
    requestAnimationFrame(() => {
      confirmationCancelButton.focus({ preventScroll: true });
    });
  });
}

async function perform(work, successMessage) {
  try {
    const result = await work();
    const feedback = typeof successMessage === "function"
      ? successMessage(result)
      : successMessage;
    if (typeof feedback === "string" && feedback) {
      toast(feedback);
    } else if (feedback?.title) {
      toast(feedback.title, feedback.detail || "", feedback.isError === true);
    }
    return result;
  } catch (error) {
    toast("Action impossible", error.message || String(error), true);
    throw error;
  }
}

function acceptSnapshot(value) {
  snapshot = value;
  if (value?.state?.settings?.siteVisibility) {
    siteVisibility = value.state.settings.siteVisibility;
  }
  if (Array.isArray(value?.soundCatalog) && value.soundCatalog.length) {
    SOUND_LIBRARY = value.soundCatalog;
  }
  if (Array.isArray(value?.mediaCatalog)) {
    MEDIA_LIBRARY = value.mediaCatalog;
  }
  return value;
}

function overlayRelayPageSignature(value) {
  const relay = value?.publicOverlayRelay || {};
  return {
    enabled: relay.enabled !== false,
    channelId: relay.channelId || "",
    matchChannelId: relay.matchChannelId || "",
    publicBaseUrl: relay.publicBaseUrl || ""
  };
}

function overlayPageStateSignature(value) {
  const state = value?.state || {};
  return JSON.stringify({
    overlayUrls: value?.overlayUrls || {},
    localOverlayUrls: value?.localOverlayUrls || {},
    publicOverlayRelay: overlayRelayPageSignature(value),
    profileId: state.session?.profileId || "",
    profiles: (state.profiles || []).map((profile) => [
      profile.id,
      profile.name
    ]),
    overlayConfigs: state.settings?.overlayConfigs || {},
    overlayVisibility: state.settings?.siteVisibility?.overlays || {},
    subscription: state.commerce?.subscription || {}
  });
}

function overlayPageStableStateSignature(value) {
  const state = value?.state || {};
  return JSON.stringify({
    overlayUrls: value?.overlayUrls || {},
    localOverlayUrls: value?.localOverlayUrls || {},
    publicOverlayRelay: overlayRelayPageSignature(value),
    profileId: state.session?.profileId || "",
    profiles: (state.profiles || []).map((profile) => [
      profile.id,
      profile.name
    ]),
    overlayVisibility: state.settings?.siteVisibility?.overlays || {},
    subscription: state.commerce?.subscription || {}
  });
}

function gamePageStateSignature(value) {
  const state = value?.state || {};
  return JSON.stringify({
    packs: value?.packs || [],
    overlayUrls: value?.overlayUrls || {},
    localOverlayUrls: value?.localOverlayUrls || {},
    profileId: state.session?.profileId || "",
    activeGamePackId: state.session?.activeGamePackId || "",
    gameSession: state.session?.game || {},
    game: state.game || {},
    interactionRulesByPack: state.game?.interactionRulesByPack || {},
    overlayConfigs: state.settings?.overlayConfigs || {},
    gameVisibility: state.settings?.siteVisibility?.games || {},
    subscription: state.commerce?.subscription || {},
    gameEntitlements: state.commerce?.gameEntitlements || []
  });
}

function consumeLocallyHandledOverlayState(previous, value) {
  if (
    overlayPageStableStateSignature(previous) !==
    overlayPageStableStateSignature(value)
  ) {
    return false;
  }
  const previousConfigs = previous?.state?.settings?.overlayConfigs || {};
  const nextConfigs = value?.state?.settings?.overlayConfigs || {};
  const keys = new Set([
    ...Object.keys(previousConfigs),
    ...Object.keys(nextConfigs)
  ]);
  const changedKeys = [...keys].filter(
    (key) =>
      JSON.stringify(previousConfigs[key] || {}) !==
      JSON.stringify(nextConfigs[key] || {})
  );
  if (
    !changedKeys.length ||
    !changedKeys.every(
      (key) =>
        locallyHandledOverlayConfigs.get(key) ===
        JSON.stringify(nextConfigs[key] || {})
    )
  ) {
    return false;
  }
  for (const key of changedKeys) locallyHandledOverlayConfigs.delete(key);
  return true;
}
