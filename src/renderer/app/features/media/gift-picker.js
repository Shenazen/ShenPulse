function giftPickerField(
  name,
  label,
  value = "",
  extra = "",
  help = "",
  giftId = ""
) {
  const selectedGift = giftForIdentity(value, giftId);
  return `<div class="field gift-picker ${extra.includes("full") ? "full" : ""}" data-gift-picker-root>
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
    <small>Recherche rapide par nom ou nombre de pièces dans le catalogue TikTok français/anglais.</small>
  </div>`;
}

function giftTriggerConditionFields(
  conditions = [],
  {
    giftName = "giftNameCondition",
    giftLabel = "Cadeau TikTok",
    giftId = "",
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
        giftId || selectedGiftCondition?.giftId || ""
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

async function hydrateGiftCatalog(query = "", input = null) {
  const list = document.getElementById("gift-catalog-options");
  if (!list) return;
  const requestId = String(++giftRequestSequence);
  if (input) input.dataset.giftRequestId = requestId;
  try {
    const result = await api.searchGifts(query, 1000);
    if (input && input.dataset.giftRequestId !== requestId) return;
    rememberGifts(result.gifts || []);
    list.innerHTML = (result.gifts || [])
      .map(
        (gift) =>
          `<option value="${escapeHtml(gift.name)}">${escapeHtml(gift.cost)} pièces · ${escapeHtml(gift.id)}</option>`
      )
      .join("");
    list.dataset.total = String(result.total || 0);
    const root = input?.closest("[data-gift-picker-root]");
    const results = root?.querySelector("[data-gift-results]");
    if (results) {
      const gifts = result.gifts || [];
      results.innerHTML = `<div class="gift-results-summary">
          <strong>${gifts.length} cadeau${gifts.length > 1 ? "x" : ""}</strong>
          <span>Tri : pièces ↑ puis A–Z</span>
        </div>${gifts
        .map(
          (gift) => `<button type="button" class="gift-result" data-gift-choice="${escapeHtml(gift.name)}" data-gift-id="${escapeHtml(gift.id || "")}" data-gift-image="${escapeHtml(gift.imageUrl || "")}">
            ${gift.imageUrl ? `<img src="${escapeHtml(gift.imageUrl)}" alt="" loading="lazy">` : '<span class="gift-result-fallback">🎁</span>'}
            <span><strong>${escapeHtml(gift.name)}</strong><small>${escapeHtml(gift.cost)} pièce${gift.cost > 1 ? "s" : ""}</small></span>
            <span class="gift-result-select">Choisir</span>
          </button>`
        )
        .join("")}${gifts.length ? "" : `<p class="picker-empty">Aucun cadeau trouvé.</p>`}`;
      results.hidden = false;
      positionGiftResults(root);
    }
    if (input) updateGiftPickerSelection(input.closest("[data-gift-picker-root]"));
    else updateAllGiftPickerSelections();
  } catch {
    list.innerHTML = "";
  }
}

function updateGiftPickerSelection(root, gift = null) {
  const input = root?.querySelector("[data-gift-picker]");
  const idInput = root?.querySelector("[data-gift-id-input]");
  const selected = root?.querySelector("[data-gift-selected]");
  if (!input || !selected) return;
  const exactGift = gift || giftForIdentity(input.value, idInput?.value);
  selected.title = exactGift?.name || "Cadeau TikTok";
  selected.innerHTML = exactGift?.imageUrl
    ? `<img src="${escapeHtml(exactGift.imageUrl)}" alt="">`
    : eventIconMarkup("gift");
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
  const selectedById = giftCatalogById.get(String(idInput?.value || ""));
  if (
    idInput &&
    selectedById &&
    normalizeGiftName(selectedById.name) !== normalizeGiftName(input?.value)
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
