"use strict";

/**
 * Infrastructure commune des formulaires et conditions.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

function openEditor({
  title,
  kicker = "CONFIGURATION",
  body,
  submitLabel = "Enregistrer",
  pendingLabel = "Enregistrement…",
  successMessage = "Configuration enregistrée",
  onSubmit,
  variant = "standard"
}) {
  dialogSessionId += 1;
  dialog.dataset.variant = variant;
  dialog.removeAttribute("inert");
  dialogForm.removeAttribute("inert");
  dialogForm.setAttribute("aria-busy", "false");
  dialogTitle.textContent = title;
  dialogKicker.textContent = kicker;
  dialogBody.innerHTML = body;
  dialogSubmitButton.textContent = submitLabel;
  dialogSubmitButton.hidden = typeof onSubmit !== "function";
  dialogSubmitButton.disabled = false;
  dialogSubmitButton.dataset.defaultLabel = submitLabel;
  dialogSubmitButton.dataset.pendingLabel = pendingLabel;
  dialog.dataset.successMessage = successMessage;
  clearDialogError();
  dialogSubmitHandler = onSubmit;
  dialog.scrollTop = 0;
  dialogForm.scrollTop = 0;
  dialogBody.scrollTop = 0;
  if (!dialog.open) dialog.showModal();
  syncActionEditorVisibility();
  bindOverlayRuntimeFrames(dialogBody);
  requestAnimationFrame(() => {
    dialog.scrollTop = 0;
    dialogForm.scrollTop = 0;
    dialogBody.scrollTop = 0;
    bindOverlayRuntimeFrames(dialogBody);
    const focusTarget = dialogBody.querySelector(
      "[autofocus], input:not([type='hidden']):not([disabled]), select:not([disabled]), textarea:not([disabled])"
    );
    if (!focusTarget) return;
    focusTarget.focus({ preventScroll: true });
    if (
      focusTarget instanceof HTMLInputElement &&
      focusTarget.type !== "password"
    ) {
      focusTarget.select();
    }
  });
}

function clearDialogError() {
  dialogError.hidden = true;
  dialogError.textContent = "";
}

function showDialogError(message) {
  dialogError.textContent =
    String(message || "").trim() ||
    "Vérifiez les champs indiqués avant d’enregistrer.";
  dialogError.hidden = false;
}

function field(name, label, value = "", type = "text", extra = "") {
  return `<label class="field ${extra.includes("full") ? "full" : ""}"><span>${escapeHtml(label)}</span><input name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" ${extra.replace("full", "")}></label>`;
}

function readTtsVoices() {
  if (!("speechSynthesis" in window)) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((voice) => voice?.name)
    .sort((first, second) => {
      const firstFrench = /^fr(?:-|$)/i.test(first.lang || "") ? 0 : 1;
      const secondFrench = /^fr(?:-|$)/i.test(second.lang || "") ? 0 : 1;
      return (
        firstFrench - secondFrench ||
        String(first.lang || "").localeCompare(String(second.lang || ""), "fr") ||
        first.name.localeCompare(second.name, "fr")
      );
    });
}

function ttsVoiceOptions(currentVoice = "") {
  const available = readTtsVoices();
  if (available.length) ttsVoices = available;
  const selectedVoice = String(currentVoice || "");
  const voices = [...ttsVoices];
  if (
    selectedVoice &&
    !voices.some((voice) => voice.name === selectedVoice)
  ) {
    voices.unshift({
      name: selectedVoice,
      lang: "",
      legacy: true
    });
  }
  return [
    `<option value="" ${selectedVoice ? "" : "selected"}>Voix Windows par défaut</option>`,
    ...voices.map(
      (voice) =>
        `<option value="${escapeHtml(voice.name)}" ${voice.name === selectedVoice ? "selected" : ""}>${escapeHtml(`${voice.name}${voice.lang ? ` · ${voice.lang}` : voice.legacy ? " · ancienne configuration" : ""}`)}</option>`
    )
  ].join("");
}

function ttsVoiceField(name, currentVoice = "", extraClass = "") {
  return `<label class="field ${extraClass}"><span>Voix</span><select name="${escapeHtml(name)}" data-tts-voice-select>${ttsVoiceOptions(currentVoice)}</select><small>Voix de synthèse installées dans Windows.</small></label>`;
}

function refreshTtsVoiceSelects() {
  const available = readTtsVoices();
  if (available.length) ttsVoices = available;
  document.querySelectorAll("[data-tts-voice-select]").forEach((select) => {
    const selectedVoice = select.value;
    select.innerHTML = ttsVoiceOptions(selectedVoice);
    select.value = selectedVoice;
  });
}

function ttsCommentFilterFields(config = {}) {
  return `<div class="tts-comment-filters">
    ${checkRow(
      "Lire les emojis",
      "Windows prononcera le nom des emojis présents dans le commentaire.",
      "ttsReadEmojis",
      config.readEmojis === true
    )}
    ${checkRow(
      "Lire les mentions commençant par @",
      "Autorise les commentaires adressés directement à un autre compte.",
      "ttsAllowMentions",
      config.allowMentions === true
    )}
    ${checkRow(
      "Lire les commandes ! et /",
      "Autorise les commentaires qui commencent comme une commande.",
      "ttsAllowCommands",
      config.allowCommands === true
    )}
    ${checkRow(
      "Lire les messages contenant un lien",
      "Autorise les URL et adresses présentes dans les commentaires.",
      "ttsAllowLinks",
      config.allowLinks === true
    )}
  </div>`;
}

function dialogSection(
  title,
  description,
  content,
  className = "",
  headerControl = ""
) {
  return `<section class="dialog-section ${className}">
    <header><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p></div>${headerControl}</header>
    <div class="form-grid">${content}</div>
  </section>`;
}

function conditionalFields(types, content, extraClass = "") {
  return `<div class="editor-conditional full ${extraClass}" data-action-types="${escapeHtml(types)}">${content}</div>`;
}

function triggerTypeOptions(currentType = "gift") {
  const options = [
    ["gift", "Cadeau"],
    ["like", "Likes"],
    ["follow", "Nouveau follow"],
    ["chat", "Message du chat"],
    ["share", "Partage du LIVE"],
    ["subscribe", "Nouvel abonnement"],
    ["join", "Arrivée dans le LIVE"]
  ];
  return options
    .map(
      ([value, label]) =>
        `<option value="${value}" ${currentType === value ? "selected" : ""}>${escapeHtml(`${eventIcons[value] || "◆"}\u00A0\u00A0${label}`)}</option>`
    )
    .join("");
}

function syncActionEditorVisibility() {
  const actionType = dialogBody.querySelector("[name='actionType']")?.value;
  if (actionType) {
    dialogBody.querySelectorAll("[data-action-types]").forEach((element) => {
      const types = String(element.dataset.actionTypes || "").split(/\s+/);
      setEditorConditionalVisibility(
        element,
        types.includes("*") || types.includes(actionType)
      );
    });
  }
  const triggerEnabledControl = dialogBody.querySelector(
    "[data-editor-trigger-enabled]"
  );
  const triggerEnabled =
    !triggerEnabledControl || triggerEnabledControl.checked;
  triggerEnabledControl
    ?.closest(".dialog-section")
    ?.classList.toggle("is-trigger-disabled", !triggerEnabled);
  dialogBody.querySelectorAll("[data-trigger-enabled]").forEach((element) => {
    setEditorConditionalVisibility(element, triggerEnabled);
  });
  const triggerType = dialogBody.querySelector("[name='triggerType']")?.value;
  if (triggerType) {
    dialogBody.querySelectorAll("[data-trigger-types]").forEach((element) => {
      const types = String(element.dataset.triggerTypes || "").split(/\s+/);
      setEditorConditionalVisibility(
        element,
        triggerEnabled &&
          (types.includes("*") || types.includes(triggerType))
      );
    });
  }
  syncActionGroupEditor();
}

function syncActionGroupEditor() {
  const active =
    dialogBody.querySelector("[name='actionType']")?.value === "action.group";
  const mode = dialogBody.querySelector(
    '[name="actionGroupMode"]'
  )?.value;
  if (!mode) return;
  const randomCountField = dialogBody.querySelector(
    "[data-action-group-random-count]"
  );
  setEditorConditionalVisibility(
    randomCountField,
    active && mode === "random"
  );
  const selectedCount = dialogBody.querySelectorAll(
    '[name="groupActionIds"]:checked'
  ).length;
  const randomCountInput = randomCountField?.querySelector(
    '[name="actionGroupRandomCount"]'
  );
  if (!randomCountInput) return;
  const maximum = Math.max(1, selectedCount);
  randomCountInput.max = String(maximum);
  if (Number(randomCountInput.value) > maximum) {
    randomCountInput.value = String(maximum);
  }
  const count = Math.max(1, Number(randomCountInput.value) || 1);
  const help = randomCountField.querySelector(
    "[data-action-group-random-count-help]"
  );
  if (help) {
    help.textContent = selectedCount
      ? `Exactement ${count} action${count > 1 ? "s" : ""} sera${count > 1 ? "ont" : ""} tirée${count > 1 ? "s" : ""} parmi ${selectedCount} à chaque exécution.`
      : "Sélectionnez d’abord les actions disponibles pour le tirage.";
  }
}

function syncTriggerSelectionEditor() {
  const mode = dialogBody.querySelector(
    '[name="actionSelectionMode"]'
  )?.value;
  if (!mode) return;
  const randomCountField = dialogBody.querySelector(
    "[data-trigger-random-count]"
  );
  setEditorConditionalVisibility(randomCountField, mode === "random");
  const selectedCount = dialogBody.querySelectorAll(
    '[name="actionIds"]:checked'
  ).length;
  const randomCountInput = randomCountField?.querySelector(
    '[name="randomCount"]'
  );
  if (!randomCountInput) return;
  const maximum = Math.max(1, selectedCount);
  randomCountInput.max = String(maximum);
  if (Number(randomCountInput.value) > maximum) {
    randomCountInput.value = String(maximum);
  }
  const count = Math.max(1, Number(randomCountInput.value) || 1);
  const help = randomCountField.querySelector(
    "[data-trigger-random-count-help]"
  );
  if (help) {
    help.textContent = selectedCount
      ? `Exactement ${count} action${count > 1 ? "s" : ""} sera${count > 1 ? "ont" : ""} tirée${count > 1 ? "s" : ""} parmi ${selectedCount} à chaque déclenchement.`
      : "Sélectionnez d’abord les actions disponibles pour le tirage.";
  }
}

function setEditorConditionalVisibility(element, visible) {
  if (!element) return;
  element.hidden = !visible;
  element
    .querySelectorAll("input, select, textarea, button")
    .forEach((control) => {
      if (!visible) {
        if (!control.disabled) {
          control.dataset.editorConditionalDisabled = "true";
          control.disabled = true;
        }
      } else if (control.dataset.editorConditionalDisabled === "true") {
        delete control.dataset.editorConditionalDisabled;
        control.disabled = false;
      }
    });
}

function conditionValue(conditions, fieldName, operator) {
  return (
    (conditions || []).find(
      (condition) =>
        condition.field === fieldName &&
        (!operator || condition.operator === operator)
    )?.value || ""
  );
}

function buildTriggerConditions(existing, data) {
  const managedFields = new Set([
    "data.giftName",
    "data.value",
    "user.name",
    "data.message"
  ]);
  const conditions = (existing || []).filter(
    (condition) => !managedFields.has(condition.field)
  );
  const giftTriggerMode = data.get("giftTriggerMode") === "value"
    ? "value"
    : "specific";
  const giftName = String(data.get("giftNameCondition") || "").trim();
  const giftId = String(data.get("giftNameConditionGiftId") || "").trim();
  const giftValueAmount = String(data.get("giftValueAmount") || "").trim();
  const giftValueOperator = String(
    data.get("giftValueOperator") || "greaterOrEqual"
  );
  const username = String(data.get("usernameCondition") || "")
    .trim()
    .replace(/^@+/, "");
  const message = String(data.get("messageCondition") || "").trim();
  if (giftTriggerMode === "specific" && giftName) {
    const selectedGift = giftForIdentity(giftName, giftId);
    const condition = {
      field: "data.giftName",
      operator: "equals",
      value: giftName
    };
    if (selectedGift) {
      condition.giftId = String(selectedGift.id || "");
      condition.giftCost = Math.max(0, Number(selectedGift.cost) || 0);
      condition.giftImageUrl = String(selectedGift.imageUrl || "");
    }
    conditions.push(condition);
  }
  if (
    giftTriggerMode === "value" &&
    giftValueAmount &&
    Number.isFinite(Number(giftValueAmount)) &&
    Number(giftValueAmount) > 0
  ) {
    const supportedOperator = GIFT_VALUE_OPERATOR_OPTIONS.some(
      ([operator]) => operator === giftValueOperator
    )
      ? giftValueOperator
      : "greaterOrEqual";
    conditions.push({
      field: "data.value",
      operator: supportedOperator,
      value: Number(giftValueAmount)
    });
  }
  if (username) {
    conditions.push({ field: "user.name", operator: "equals", value: username });
  }
  if (message) {
    conditions.push({
      field: "data.message",
      operator: "contains",
      value: message
    });
  }
  return conditions;
}
