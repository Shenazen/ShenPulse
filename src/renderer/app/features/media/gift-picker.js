function giftPickerField(
  name,
  label,
  value = "",
  extra = "",
  help = "",
  giftId = "",
  savedReference = {}
) {
  const selectedGift = giftForSavedReference(value, giftId, savedReference);
  const reference = {
    ...savedReference,
    giftName: value,
    giftId: String(giftId || selectedGift?.id || ""),
    giftImageUrl: String(selectedGift?.imageUrl || ""),
    giftCost: Math.max(0, Number(savedReference.giftCost ?? savedReference.cost ?? selectedGift?.cost) || 0)
  };
  return `<div class="field gift-picker ${extra.includes("full") ? "full" : ""}" data-gift-picker-root data-gift-reference="${escapeHtml(JSON.stringify(reference))}">
    ${help ? fieldLabelWithInfo(label, help) : `<span>${escapeHtml(label)}</span>`}
    <div class="gift-picker-input">
      <input name="${escapeHtml(name)}" value="${escapeHtml(value)}" data-gift-picker autocomplete="off" placeholder="Rechercher un cadeau TikTok…" ${extra.replace("full", "")}>
      <input type="hidden" name="${escapeHtml(name)}GiftId" value="${escapeHtml(giftId || selectedGift?.id || "")}" data-gift-id-input ${extra.includes("disabled") ? "disabled" : ""}>
      <span class="gift-picker-selection" data-gift-selected title="${escapeHtml(selectedGift?.name || "Cadeau TikTok")}">
        ${selectedGift?.imageUrl ? `<img src="${escapeHtml(selectedGift.imageUrl)}" alt="">` : eventIconMarkup("gift")}
      </span>
      <button type="button" data-gift-clear title="Effacer">×</button>
    </div>
    <div class="gift-picker-results" data-gift-results hidden></div>
    <small>Recherche par nom, ID ou pièces. Les cadeaux du créateur sont proposés en priorité ; les références enregistrées sont conservées.</small>
  </div>`;
}

function giftTriggerConditionFields(
  conditions = [],
  {
    giftName = "giftNameCondition",
    giftLabel = "Cadeau TikTok",
    giftId = "",
    savedReference = null,
    giftValue,
    modeName = "giftTriggerMode",
    operatorName = "giftValueOperator",
    amountName = "giftValueAmount"
  } = {}
) {
  const valueCondition = giftValueCondition(conditions);
  const currentOperator = valueCondition?.operator || "greaterOrEqual";
  const selectedGiftValue = giftValue === undefined
    ? conditionValue(conditions, "data.giftName", "equals")
    : giftValue;
  const selectedGiftCondition = (conditions || []).find(
    (condition) =>
      condition.field === "data.giftName" &&
      String(condition.operator || "equals") === "equals"
  );
  const currentMode = valueCondition ? "value" : "specific";
  return `<div class="gift-trigger-condition full" data-gift-trigger-condition>
    <div class="gift-trigger-mode-heading">
      <span>Méthode de déclenchement</span>
      <small>Choisissez une seule façon d’identifier les cadeaux concernés.</small>
    </div>
    <div class="gift-trigger-mode" role="radiogroup" aria-label="Méthode de déclenchement par cadeau">
      <label class="gift-trigger-mode-option">
        <input type="radio" name="${escapeHtml(modeName)}" value="specific" data-gift-trigger-mode ${currentMode === "specific" ? "checked" : ""}>
        <span class="gift-trigger-mode-icon" aria-hidden="true">🎁</span>
        <span class="gift-trigger-mode-copy"><strong>Cadeau précis</strong><small>Choisir un cadeau dans le catalogue TikTok</small></span>
        <span class="gift-trigger-mode-check" aria-hidden="true">✓</span>
      </label>
      <label class="gift-trigger-mode-option">
        <input type="radio" name="${escapeHtml(modeName)}" value="value" data-gift-trigger-mode ${currentMode === "value" ? "checked" : ""}>
        <span class="gift-trigger-mode-icon" aria-hidden="true">◎</span>
        <span class="gift-trigger-mode-copy"><strong>Valeur en pièces</strong><small>Comparer le prix de tous les cadeaux reçus</small></span>
        <span class="gift-trigger-mode-check" aria-hidden="true">✓</span>
      </label>
    </div>
    <div class="gift-trigger-panel" data-gift-trigger-panel="specific" ${currentMode === "specific" ? "" : "hidden"}>
      ${giftPickerField(
        giftName,
        giftLabel,
        selectedGiftValue,
        currentMode === "specific" ? "" : "disabled",
        "",
        giftId || selectedGiftCondition?.giftId || "",
        savedReference || selectedGiftCondition || {}
      )}
    </div>
    <div class="gift-trigger-panel gift-value-condition" data-gift-trigger-panel="value" ${currentMode === "value" ? "" : "hidden"}>
      <label class="field">
        <span>Comparer la valeur</span>
        <select name="${escapeHtml(operatorName)}" ${currentMode === "value" ? "" : "disabled"}>
          ${GIFT_VALUE_OPERATOR_OPTIONS.map(
            ([value, label]) =>
              `<option value="${value}" ${currentOperator === value ? "selected" : ""}>${escapeHtml(label)}</option>`
          ).join("")}
        </select>
      </label>
      <label class="field">
        <span>Montant en pièces</span>
        <input name="${escapeHtml(amountName)}" type="number" min="1" step="1" value="${escapeHtml(valueCondition?.value ?? "")}" placeholder="500" ${currentMode === "value" ? "" : "disabled"}>
      </label>
    </div>
    <small class="gift-trigger-condition-note">La méthode sélectionnée remplace l’autre : elles ne sont jamais cumulées.</small>
  </div>`;
}

function syncGiftTriggerCondition(root) {
  if (!root) return;
  const mode =
    root.querySelector("[data-gift-trigger-mode]:checked")?.value === "value"
      ? "value"
      : "specific";
  root.querySelectorAll("[data-gift-trigger-panel]").forEach((panel) => {
    const active = panel.dataset.giftTriggerPanel === mode;
    panel.hidden = !active;
    panel.querySelectorAll("input, select, button").forEach((control) => {
      control.disabled = !active;
    });
  });
}

function giftPickerCatalogContext() {
  const state = typeof snapshot === "undefined" ? null : snapshot?.state;
  return { uid: state?.settings?.account?.uid || "", profileId: state?.session?.profileId || "",
    username: String(state?.settings?.tiktok?.username || "").trim().replace(/^@+/, "").toLowerCase(),
    roomId: String(state?.settings?.tiktok?.roomId || "") };
}

function giftPickerRoomMatches(room) {
  const current = giftPickerCatalogContext();
  return Boolean(current.username && room && typeof room.username === "string" &&
    room.username.trim().replace(/^@+/, "").toLowerCase() === current.username &&
    (!current.roomId || String(room.roomId || "") === current.roomId));
}

function acceptGiftCatalogResult(result) {
  // Display grouping never changes the identity lookup or the stored aliases.
  rememberGifts(Array.isArray(result?.gifts) ? result.gifts : []);
  if (giftPickerRoomMatches(result?.room) && typeof rememberRoomGifts === "function") {
    rememberRoomGifts(Array.isArray(result.roomGifts) ? result.roomGifts : [], result.room);
  }
}

function giftPickerDisplayGroups(gifts, options) {
  const rows = (gifts || []).filter((gift) => gift?.selectable !== false).map((gift) => giftForPresentation(gift));
  return typeof ShenPulseGiftDisplay !== "undefined"
    ? ShenPulseGiftDisplay.groupGiftDisplayRows(rows, options)
    : rows.map((gift) => ({ gift, variants: [gift] }));
}

function giftPickerResultButton(gift, variant = false) {
  return `<button type="button" class="gift-result" data-gift-choice="${escapeHtml(gift.name)}" data-gift-id="${escapeHtml(gift.id || "")}" data-gift-image="${escapeHtml(gift.imageUrl || "")}">
    ${gift.imageUrl ? `<img src="${escapeHtml(gift.imageUrl)}" alt="" loading="lazy">` : '<span class="gift-result-fallback">🎁</span>'}
    <span><strong>${escapeHtml(gift.name)}</strong><small>${escapeHtml(gift.cost)} pièce${gift.cost > 1 ? "s" : ""}${variant ? ` · ID ${escapeHtml(gift.id || "non précisé")}` : ""}</small></span>
    <span class="gift-result-select">Choisir</span></button>`;
}

function renderGiftCatalogResults(result, input, query = "") {
  const list = document.getElementById("gift-catalog-options"), root = input?.closest("[data-gift-picker-root]");
  if (!list) return;
  const scope = JSON.stringify(giftPickerCatalogContext());
  if (root && root.dataset.giftCatalogScope !== scope) {
    root.dataset.giftCatalogScope = scope; root.dataset.giftCatalogView = "room";
  }
  const room = result.room || {}, roomKnown = giftPickerRoomMatches(room) && (room.available === true || room.partial === true);
  const showRoom = roomKnown && root?.dataset.giftCatalogView !== "global";
  const groups = giftPickerDisplayGroups(showRoom ? result.roomGifts || [] : result.gifts || [], {
    preferredId: root?.querySelector("[data-gift-id-input]")?.value || "", query
  });
  list.innerHTML = groups.map(({ gift }) => `<option value="${escapeHtml(gift.name)}">${escapeHtml(gift.cost)} pièces · ${escapeHtml(gift.id)}</option>`).join("");
  list.dataset.total = String(groups.length);
  const results = root?.querySelector("[data-gift-results]");
  if (!results) return;
  const roomLabel = room.available === true ? "Cadeaux du LIVE" : "Cadeaux reçus";
  const label = showRoom ? `${roomLabel} de @${room.username}` : "Catalogue global";
  results.innerHTML = `<div class="gift-results-summary"><strong>${groups.length} cadeau${groups.length > 1 ? "x" : ""}</strong><span>Tri : pièces ↑ puis A–Z</span></div>
    <div class="gift-results-scope"><strong>${escapeHtml(label)}</strong>
      ${showRoom ? room.available === true ? "" : "<small>Liste partielle observée pendant ce LIVE, pas un catalogue complet.</small>" : "<small>Références globales : disponibilité sur ce LIVE non garantie.</small>"}
      ${roomKnown ? `<button type="button" class="button small ghost" data-gift-catalog-view="${showRoom ? "global" : "room"}">${showRoom ? "Voir le catalogue global" : `Voir les ${roomLabel.toLowerCase()}`}</button>` : ""}</div>
    ${groups.map(({ gift, variants }) => giftPickerResultButton(gift) + (variants.length > 1
      ? `<details class="gift-result-variants"><summary>Autres variantes (${variants.length - 1})</summary>${variants.filter((variant) => variant !== gift).map((variant) => giftPickerResultButton(variant, true)).join("")}</details>` : "")).join("")}
    ${groups.length ? "" : `<p class="picker-empty">${showRoom ? "Aucun cadeau correspondant dans cette liste du créateur." : "Aucun cadeau trouvé."}</p>`}`;
  results.querySelector("[data-gift-catalog-view]")?.addEventListener("click", (event) => {
    if (JSON.stringify(giftPickerCatalogContext()) !== scope || !document.contains(input)) return;
    root.dataset.giftCatalogView = event.currentTarget.dataset.giftCatalogView;
    renderGiftCatalogResults(result, input, query);
  });
  results.hidden = false; positionGiftResults(root);
}

async function hydrateGiftCatalog(query = "", input = null) {
  const list = document.getElementById("gift-catalog-options");
  if (!list) return;
  const requestId = String(++giftRequestSequence), scope = JSON.stringify(giftPickerCatalogContext());
  if (input) input.dataset.giftRequestId = requestId;
  const current = () => requestId === String(giftRequestSequence) && JSON.stringify(giftPickerCatalogContext()) === scope &&
    (!input || document.contains(input) && input.dataset.giftRequestId === requestId);
  try {
    // Keep the complete identity cache; only the visible options are grouped.
    const result = await api.searchGifts(query, String(query || "").trim() ? 1000 : 10000);
    if (!current()) return;
    acceptGiftCatalogResult(result); renderGiftCatalogResults(result, input, query);
    if (input) updateGiftPickerSelection(input.closest("[data-gift-picker-root]"));
    else updateAllGiftPickerSelections();
  } catch {
    if (!current()) return;
    list.innerHTML = "";
    const results = input?.closest("[data-gift-picker-root]")?.querySelector("[data-gift-results]");
    if (results) { results.innerHTML = '<p class="picker-empty">Catalogue indisponible. Vos cadeaux enregistrés sont conservés ; réessayez la recherche.</p>'; results.hidden = false; }
  }
}

function updateGiftPickerSelection(root, gift = null) {
  const input = root?.querySelector("[data-gift-picker]");
  const idInput = root?.querySelector("[data-gift-id-input]");
  const selected = root?.querySelector("[data-gift-selected]");
  if (!input || !selected) return;
  if (gift) {
    gift = giftForIdentity(input.value, idInput?.value || gift.id) || giftForPresentation(gift, idInput?.value || gift.id);
    // An explicit choice can repair an old menu's label; ordinary hydration
    // never alters an existing field, selected technical ID or draft.
    if (gift?.name) input.value = gift.name;
  }
  if (gift) {
    root.dataset.giftReference = JSON.stringify({
      giftName: input.value,
      giftId: idInput?.value || gift.id || "",
      giftImageUrl: gift.imageUrl || "",
      giftCost: Number(gift.cost || giftForIdentity(input.value, idInput?.value)?.cost || 0)
    });
  }
  const exactGift = gift || giftForSavedReference(input.value, idInput?.value, giftPickerSavedReference(root));
  selected.title = exactGift?.name || "Cadeau TikTok";
  selected.innerHTML = exactGift?.imageUrl
    ? `<img src="${escapeHtml(exactGift.imageUrl)}" alt="">`
    : eventIconMarkup("gift");
}

function giftPickerSavedReference(root) {
  const input = root?.querySelector("[data-gift-picker]");
  const idInput = root?.querySelector("[data-gift-id-input]");
  try {
    const saved = JSON.parse(root?.dataset.giftReference || "{}");
    const same = saved.giftId && idInput?.value
      ? String(saved.giftId) === idInput.value
      : normalizeGiftName(saved.giftName) === normalizeGiftName(input?.value);
    return same ? saved : {};
  } catch {
    return {};
  }
}

function updateAllGiftPickerSelections() {
  document
    .querySelectorAll("[data-gift-picker-root]")
    .forEach((root) => updateGiftPickerSelection(root));
}

function positionGiftResults(root) {
  const inputBox = root?.querySelector(".gift-picker-input");
  const results = root?.querySelector("[data-gift-results]");
  if (!inputBox || !results || results.hidden) return;
  const rect = inputBox.getBoundingClientRect();
  const margin = 10;
  const roomBelow = window.innerHeight - rect.bottom - margin;
  const roomAbove = rect.top - margin;
  const openAbove = roomBelow < 260 && roomAbove > roomBelow;
  const available = Math.max(
    80,
    Math.min(430, openAbove ? roomAbove : roomBelow)
  );
  results.style.left = `${Math.max(margin, rect.left)}px`;
  results.style.width = `${Math.min(
    rect.width,
    window.innerWidth - Math.max(margin, rect.left) - margin
  )}px`;
  results.style.maxHeight = `${available}px`;
  results.style.top = openAbove ? "auto" : `${rect.bottom + 6}px`;
  results.style.bottom = openAbove
    ? `${window.innerHeight - rect.top + 6}px`
    : "auto";
}

function scheduleGiftCatalog(input) {
  const root = input?.closest("[data-gift-picker-root]");
  const idInput = root?.querySelector("[data-gift-id-input]");
  const saved = giftPickerSavedReference(root);
  if (
    idInput &&
    normalizeGiftName(saved.giftName) !== normalizeGiftName(input?.value)
  ) {
    idInput.value = "";
  }
  updateGiftPickerSelection(root);
  clearTimeout(giftSearchTimer);
  giftSearchTimer = setTimeout(
    () => hydrateGiftCatalog(input?.value || "", input),
    160
  );
}
