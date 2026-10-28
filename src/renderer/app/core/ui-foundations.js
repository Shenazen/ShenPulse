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
  if (typeof ShenPulseGiftIdentity !== "undefined") {
    return ShenPulseGiftIdentity.normalizeGiftName(value);
  }
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[œŒ]/g, "oe")
    .replace(/[æÆ]/g, "ae")
    .trim()
    .toLocaleLowerCase("fr");
}

function trueCommunityHeartId(value) {
  const id = String(value || "").trim().toLowerCase();
  return typeof ShenPulseGiftIdentity !== "undefined" && typeof ShenPulseGiftIdentity.isCommunityHeartGiftId === "function"
    ? ShenPulseGiftIdentity.isCommunityHeartGiftId(id) : id === "7934" || id === "heart-me";
}

function compatibleGiftAlias(gift, id) {
  return !gift?.id || !id || trueCommunityHeartId(gift.id) === trueCommunityHeartId(id);
}

/** Presentation policy only: a creator skin cannot recolor the true Heart Me.
 * Other exact IDs retain their provider's name and artwork, never its family. */
function giftForPresentation(gift, id = gift?.id || "") {
  if (!gift || typeof gift !== "object") return gift;
  const result = { ...gift };
  if (typeof ShenPulseGiftIdentity !== "undefined" && trueCommunityHeartId(id)) {
    result.name = ShenPulseGiftIdentity.COMMUNITY_HEART_CANONICAL_NAME;
    result.imageUrl = ShenPulseGiftIdentity.COMMUNITY_HEART_IMAGE_URL;
    result.giftFamily = "community-heart";
  } else if (id) {
    if (result.giftFamily === "community-heart") result.giftFamily = "";
    if (result.family === "community-heart") result.family = "";
  }
  for (const key of ["alternateIds", "giftIds"]) if (Array.isArray(result[key])) {
    const filtered = result[key].filter((alias) => compatibleGiftAlias({ id }, alias));
    if (filtered.length !== result[key].length) result[key] = filtered;
  }
  return Object.keys(result).every((key) => result[key] === gift[key]) ? gift : result;
}

// Creator-specific artwork is ephemeral and separate from historical IDs.
// Changing account, profile, @ or room immediately makes the old artwork inert.
let currentRoomGiftVisuals = null;
function giftVisualRoomContext() {
  const state = typeof snapshot !== "undefined" ? snapshot?.state : null;
  const username = String(state?.settings?.tiktok?.username || "").trim().replace(/^@+/, "").toLowerCase();
  return { username, roomId: String(state?.settings?.tiktok?.roomId || ""),
    key: JSON.stringify([state?.settings?.account?.uid || "", state?.session?.profileId || "", username]) };
}

function rememberRoomGifts(gifts, room) {
  const context = giftVisualRoomContext();
  const target = String(room?.username || "").trim().replace(/^@+/, "").toLowerCase();
  const roomId = String(room?.roomId || "");
  if (!context.username || context.username !== target || !/^[1-9]\d{0,19}$/.test(roomId) ||
    context.roomId && context.roomId !== roomId) return false;
  if (room.available !== true && room.partial !== true) { currentRoomGiftVisuals = null; return true; }
  const rows = (Array.isArray(gifts) ? gifts : []).slice(0, 10000).filter((gift) =>
    typeof gift?.id === "string" && gift.id.length <= 160 && typeof gift.name === "string" &&
    /^https:\/\//i.test(String(gift.imageUrl || "")));
  const byId = currentRoomGiftVisuals?.key === context.key && currentRoomGiftVisuals.roomId === roomId
    ? new Map(currentRoomGiftVisuals.byId) : new Map();
  // Search responses contain only matching rows. A search for Rose must not
  // erase a different already verified creator gift used elsewhere on the page.
  for (const gift of rows) { byId.delete(gift.id); byId.set(gift.id, { ...giftForPresentation(gift) }); }
  while (byId.size > 10000) byId.delete(byId.keys().next().value);
  currentRoomGiftVisuals = { key: context.key, roomId, byId };
  return true;
}

function currentRoomGiftForId(id) {
  if (!id || !currentRoomGiftVisuals) return null;
  const context = giftVisualRoomContext();
  if (currentRoomGiftVisuals.key !== context.key || context.roomId && context.roomId !== currentRoomGiftVisuals.roomId) {
    currentRoomGiftVisuals = null; return null;
  }
  return currentRoomGiftVisuals.byId.get(String(id)) || null;
}

function preferCurrentRoomGift(gift, id = "") {
  if (!compatibleGiftAlias(gift, id)) return null;
  const exact = currentRoomGiftForId(id) || currentRoomGiftForId(gift?.id);
  if (exact && compatibleGiftAlias(exact, id || gift?.id)) return giftForPresentation(exact, id || exact.id);
  const matches = [...new Set((gift?.alternateIds || []).filter((alias) => compatibleGiftAlias(gift, alias))
    .map(currentRoomGiftForId).filter(Boolean))];
  return giftForPresentation(matches.length === 1 ? matches[0] : gift, id || gift?.id);
}

function currentRoomGiftForName(name) {
  const firstId = currentRoomGiftVisuals?.byId.keys().next().value;
  if (!firstId || !currentRoomGiftForId(firstId)) return null;
  const key = normalizeGiftName(name);
  const matches = [...currentRoomGiftVisuals.byId.values()].filter((gift) => normalizeGiftName(gift.name) === key);
  return matches.length === 1 ? matches[0] : null;
}

function rememberGifts(gifts = []) {
  const replacements = new Map();
  // Discard only incorrect in-memory red-heart cross-ID associations left by
  // older catalogues. Historical conditions and their IDs are not rewritten.
  for (const [id, gift] of giftCatalogById) if (!compatibleGiftAlias(gift, id)) giftCatalogById.delete(id);
  for (const input of gifts) {
    const gift = giftForPresentation(input);
    const ids = [gift.id, ...(gift.alternateIds || [])]
      .map((id) => String(id || "").trim())
      .filter(Boolean);
    const names = [gift.name, gift.originalName, ...(gift.alternateNames || [])]
      .map(normalizeGiftName)
      .filter(Boolean);
    for (const id of ids) {
      const previous = giftCatalogById.get(id);
      if (previous && previous !== gift && compatibleGiftAlias(previous, gift.id)) replacements.set(previous, gift);
      giftCatalogById.set(id, gift);
    }
    for (const key of names) {
      const previous = giftCatalogByName.get(key);
      const matches = Array.isArray(previous) ? previous : previous ? [previous] : [];
      if (!matches.includes(gift)) matches.push(gift);
      giftCatalogByName.set(key, matches);
    }
  }
  // Les alias déjà chargés continuent de résoudre le même cadeau, mais avec
  // ses données actualisées. Un seul parcours par lot évite les scans répétés.
  if (replacements.size) {
    for (const [id, gift] of giftCatalogById) {
      if (replacements.has(gift)) giftCatalogById.set(id, replacements.get(gift));
    }
    for (const [name, gifts] of giftCatalogByName) {
      giftCatalogByName.set(name, [...new Set(gifts.map((gift) => replacements.get(gift) || gift))]);
    }
  }
  GIFT_CATALOG = [...new Set(giftCatalogById.values())];
}

function giftForName(name) {
  return giftForIdentity(name);
}

function giftForIdentity(name, id = "", metadata = {}) {
  metadata = metadata && typeof metadata === "object" ? metadata : {};
  const candidate = {
    ...metadata,
    giftName: name,
    giftId: id,
    giftCost: metadata.giftCost ?? metadata.cost ?? metadata.giftValue,
    giftImageUrl: metadata.giftImageUrl || metadata.imageUrl || metadata.image || metadata.giftImage
  };
  const currentRoomGift = currentRoomGiftForId(String(id || "").trim());
  if (currentRoomGift) return giftForPresentation(currentRoomGift, id);
  if (!String(id || "").trim()) {
    const namedRoomGift = currentRoomGiftForName(name);
    if (namedRoomGift) return giftForPresentation(namedRoomGift);
  }
  // Les alias confirmés lors d'un lot précédent restent valides après rafraîchissement.
  const byId = giftCatalogById.get(String(id || "").trim());
  if (byId && compatibleGiftAlias(byId, id)) return preferCurrentRoomGift(byId, id);
  if (typeof ShenPulseGiftIdentity !== "undefined") {
    const gift = ShenPulseGiftIdentity.findCatalogGift(GIFT_CATALOG, candidate);
    if (gift && compatibleGiftAlias(gift, id)) return preferCurrentRoomGift(gift, id);
  }
  if (trueCommunityHeartId(id)) return giftForPresentation({ id: String(id), name, cost: Number(metadata.giftCost ?? metadata.cost) || 1 }, id);
  // Repli aux noms déjà connus : jamais de choix arbitraire entre homonymes.
  if (String(id || "").trim()) return null;
  const previous = giftCatalogByName.get(normalizeGiftName(name));
  const matches = Array.isArray(previous) ? previous : previous ? [previous] : [];
  const cost = Number(metadata.giftCost ?? metadata.cost ?? 0);
  const compatible = cost > 0 ? matches.filter((gift) => Number(gift.cost) === cost) : matches;
  return compatible.length === 1 ? preferCurrentRoomGift(compatible[0], id) : null;
}

/** Affiche les références sauvegardées même si TikTok ne les propose plus. */
function giftForSavedReference(name, id = "", metadata = {}) {
  metadata = metadata && typeof metadata === "object" ? metadata : {};
  const gift = giftForIdentity(name, id, metadata);
  const savedImage = String(metadata.giftImageUrl || metadata.imageUrl || metadata.image || metadata.giftImage || "");
  if (gift) {
    // Un catalogue partiel ne doit pas effacer le visuel de ce même cadeau.
    return !gift.imageUrl && savedImage ? { ...gift, imageUrl: savedImage } : gift;
  }
  if (!String(name || "").trim() && !String(id || "").trim()) return null;
  // Plusieurs IDs peuvent partager un même dessin vérifié. L'image est alors
  // utilisable sans choisir un ID ni fabriquer une nouvelle association.
  const commonImage = !String(id || "").trim() && !savedImage &&
    typeof ShenPulseGiftIdentity !== "undefined" && typeof ShenPulseGiftIdentity.giftVisualUrl === "function"
    ? ShenPulseGiftIdentity.giftVisualUrl(GIFT_CATALOG, {
        ...metadata,
        giftName: name,
        giftId: "",
        giftCost: metadata.giftCost ?? metadata.cost ?? metadata.giftValue
      })
    : "";
  return {
    id: String(id || metadata.giftId || ""),
    name: String(name || metadata.name || "Cadeau TikTok"),
    cost: Math.max(0, Number(metadata.giftCost ?? metadata.cost ?? metadata.giftValue) || 0),
    imageUrl: savedImage || commonImage,
    giftFamily: String(metadata.giftFamily || metadata.family || "")
  };
}

/** Une modification sans changement de cadeau conserve son ID et ses conditions. */
function giftReferenceForSave(name, id = "", existing = {}) {
  existing = existing && typeof existing === "object" ? existing : {};
  const cleanName = String(name || "").trim();
  const cleanId = String(id || "").trim();
  if (!cleanName && !cleanId) return null;
  const previousId = String(existing.giftId || existing.id || "").trim();
  const previousName = existing.value ?? existing.giftName ?? existing.name ?? "";
  const unchanged = cleanId && previousId
    ? cleanId === previousId
    : normalizeGiftName(cleanName) === normalizeGiftName(previousName);
  const saved = unchanged ? existing : {};
  const effectiveId = cleanId || (unchanged ? previousId : "");
  const gift = giftForSavedReference(cleanName, effectiveId, saved);
  const result = {
    ...saved,
    giftId: effectiveId || String(gift?.id || ""),
    giftCost: Math.max(0, Number(saved.giftCost ?? saved.cost ?? saved.giftValue ?? gift?.cost) || 0),
    giftImageUrl: String(gift?.imageUrl || "")
  };
  const family = String(saved.giftFamily || gift?.giftFamily || gift?.family || "");
  if (family) result.giftFamily = family;
  const knownIds = [gift?.id, ...(gift?.alternateIds || [])].map((value) => String(value || ""))
    .filter((knownId) => knownId && compatibleGiftAlias({ id: effectiveId || gift?.id }, knownId));
  const catalogGift = giftCatalogById.get(String(gift?.id || ""));
  if (catalogGift && knownIds.length && (!effectiveId || knownIds.includes(effectiveId) || giftCatalogById.get(effectiveId) === catalogGift || knownIds.some((knownId) => saved.giftIds?.includes(knownId)))) {
    result.giftIds = [...new Set([...(Array.isArray(saved.giftIds) ? saved.giftIds : []), ...knownIds])];
  }
  return result;
}

function eventIconMarkup(type, options = {}) {
  const kind = String(type || "").toLocaleLowerCase("fr");
  const referenceAttribute = kind === "gift" && (options.giftId || options.giftName)
    ? ` data-gift-visual-reference="${escapeHtml(JSON.stringify(options))}"`
    : "";
  const imageUrl = kind === "gift"
    ? giftForSavedReference(options.giftName, options.giftId, options)?.imageUrl || options.imageUrl
    : options.imageUrl;
  if (imageUrl) {
    return `<span class="event-visual event-${escapeHtml(kind)}"${referenceAttribute}><img src="${escapeHtml(imageUrl)}" alt="" loading="lazy"></span>`;
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
  return `<span class="event-visual event-${escapeHtml(kind || "other")}"${referenceAttribute}><svg viewBox="0 0 24 24" aria-hidden="true">${paths[kind] || '<circle cx="12" cy="12" r="7"/>'}</svg></span>`;
}

/** Actualise seulement les visuels, jamais les valeurs saisies dans un formulaire. */
function refreshGiftVisuals(root = document) {
  root.querySelectorAll("[data-gift-visual-reference]").forEach((node) => {
    try {
      const reference = JSON.parse(node.dataset.giftVisualReference);
      const template = document.createElement("template");
      template.innerHTML = eventIconMarkup("gift", reference);
      node.replaceWith(template.content.firstElementChild);
    } catch {
      // Une référence illisible ne justifie pas de supprimer le badge existant.
    }
  });
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
  return `${symbols[filter.operator] || "≥"} ${rendererFormatters.integer.format(value)} pièces`;
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

function triggerPill(rule, { compact = false } = {}) {
  if (!hasAutomaticTrigger(rule)) {
    return `<span class="trigger-pill trigger-manual">${eventIconMarkup("manual")}<span>Lancement manuel</span></span>`;
  }
  const type = rule?.trigger?.type || "*";
  const giftCondition = type === "gift" ? ruleGiftCondition(rule) : null;
  const giftName = giftCondition?.value || "";
  const gift = giftForSavedReference(giftName, giftCondition?.giftId, giftCondition);
  const threshold = Number(rule.trigger?.threshold || 1);
  const cost = Number(gift?.cost ?? giftCondition?.giftCost ?? 0);
  const compactLabel = compact ? type === "gift" ? giftName || EVENT_LABELS.gift || "Cadeau" : EVENT_LABELS[type] || type : "";
  const valueFilter = compact && type === "gift" ? ruleGiftValueLabel(rule) : "";
  return `<span class="trigger-pill${compact ? " automation-trigger-compact" : ""}" data-trigger-type="${escapeHtml(type)}">${eventIconMarkup(type, {
    ...giftCondition,
    giftId: giftCondition?.giftId,
    giftName,
    imageUrl: gift?.imageUrl || giftCondition?.giftImageUrl
  })}<span>${escapeHtml(compact ? `${compactLabel}${threshold > 1 ? ` ×${threshold}` : ""}` : triggerLabel(rule))}</span>${compact && type === "gift" && Number.isFinite(cost) && cost > 0 ? `<span class="automation-gift-price" title="${cost} pièce${cost > 1 ? "s" : ""}" aria-label="${cost} pièce${cost > 1 ? "s" : ""}">${rendererFormatters.integer.format(cost)}<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true"><ellipse cx="10" cy="4" rx="4" ry="2"/><path d="M6 4v3c0 1 1.8 2 4 2s4-1 4-2V4M6 7v3c0 1 1.8 2 4 2s4-1 4-2V7"/><ellipse cx="5" cy="10" rx="4" ry="2"/><path d="M1 10v3c0 1 1.8 2 4 2s4-1 4-2v-3"/></svg></span>` : ""}</span>${valueFilter ? `<small class="automation-row-note">${escapeHtml(valueFilter)}</small>` : ""}`;
}

function asNumber(value) {
  return rendererFormatters.compact.format(Number(value || 0));
}

function formatTime(value) {
  if (!value) return "—";
  return rendererFormatters.time.format(new Date(value));
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
    danger = true,
    acknowledge = false
  } = {}
) {
  if (confirmationResolver) finishConfirmation(false);
  confirmationTitle.textContent = title;
  confirmationMessage.textContent = String(message || "");
  confirmationSubmitButton.textContent = confirmLabel;
  confirmationSubmitButton.classList.toggle("danger", danger);
  confirmationCancelButton.hidden = acknowledge;
  return new Promise((resolve) => {
    confirmationResolver = resolve;
    if (!confirmationDialog.open) confirmationDialog.showModal();
    requestAnimationFrame(() => {
      if (acknowledge) confirmationSubmitButton.focus({ preventScroll: true });
      else confirmationCancelButton.focus({ preventScroll: true });
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
    const message = error.message || String(error);
    if (/Activation impossible|Configuration incomplète/.test(message)) {
      void confirmAction(message.replace(/^.*?(?:Activation impossible|Configuration incomplète)\s*:\s*/, ''), {title:'Configuration incomplète',confirmLabel:'Compris',danger:false,acknowledge:true});
    } else toast("Action impossible", message, true);
    throw error;
  }
}

function acceptSnapshot(value) {
  const previousUid = String(snapshot?.state?.settings?.account?.uid || "");
  const nextUid = String(value?.state?.settings?.account?.uid || "");
  if (previousUid !== nextUid ||
      snapshot?.state?.session?.profileId !== value?.state?.session?.profileId) {
    if (typeof stopRendererAudioPlayback === "function") stopRendererAudioPlayback();
  }
  if (previousUid !== nextUid) {
    // Les aperçus importés ne doivent jamais survivre au changement de compte.
    if (typeof mediaSessionEntries !== "undefined") mediaSessionEntries.clear();
    if (typeof globalMediaLibrary !== "undefined") globalMediaLibrary.close();
  }
  snapshot = value;
  if (typeof synchronizeGiftPickerCatalog === "function") synchronizeGiftPickerCatalog();
  if (value?.state?.settings?.siteVisibility) {
    siteVisibility = value.state.settings.siteVisibility;
  }
  if (Array.isArray(value?.soundCatalog)) {
    SOUND_LIBRARY = value.soundCatalog;
  }
  if (Array.isArray(value?.mediaCatalog)) {
    MEDIA_LIBRARY = value.mediaCatalog;
  }
  if (typeof synchronizeOverlayAssetWarmup === "function") synchronizeOverlayAssetWarmup();
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
    overlayScene: state.settings?.overlayScene || {},
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
    overlayScene: state.settings?.overlayScene || {},
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
