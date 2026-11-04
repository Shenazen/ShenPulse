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
  onTest,
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
  dialogForm.querySelector("[data-dialog-test]")?.remove();
  if (typeof onTest === "function") {
    const testButton = document.createElement("button");
    testButton.type = "button";
    testButton.className = "button";
    testButton.dataset.dialogTest = "true";
    testButton.textContent = "▶ Tester";
    testButton.title = "Envoyer le test sur les écrans Media configurés, sans enregistrer";
    const sessionId = dialogSessionId;
    testButton.addEventListener("click", async () => {
      if (testButton.disabled || dialogForm.getAttribute("aria-busy") === "true") return;
      clearDialogError();
      testButton.disabled = true;
      testButton.textContent = "Chargement…";
      try { await onTest(); }
      catch (error) { if (sessionId === dialogSessionId) showDialogError(error.message || String(error)); }
      finally { if (sessionId === dialogSessionId) { testButton.disabled = false; testButton.textContent = "▶ Tester"; } }
    });
    dialogSubmitButton.before(testButton);
  }
  dialog.scrollTop = 0;
  dialogForm.scrollTop = 0;
  dialogBody.scrollTop = 0;
  if (!dialog.open) dialog.showModal();
  syncActionEditorVisibility();
  if (typeof applyStudioLanguage === "function") applyStudioLanguage(dialog);
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
  return inputFieldMarkup(name, label, value, type, extra);
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
  const natural = typeof ShenPulseTtsVoices !== "undefined" ? ShenPulseTtsVoices.NATURAL_VOICES : [];
  const voices = [...ttsVoices];
  if (
    selectedVoice &&
    !voices.some((voice) => voice.name === selectedVoice) && !natural.some((voice) => voice.id === selectedVoice) && selectedVoice !== "random:fr"
  ) {
    voices.unshift({
      name: selectedVoice,
      lang: "",
      legacy: true
    });
  }
  return [
    `<option value="" ${selectedVoice ? "" : "selected"}>Voix Windows par défaut</option>`,
    `<optgroup label="Voix naturelles · Internet">${natural.map((voice) => `<option value="${voice.id}" ${voice.id === selectedVoice ? "selected" : ""}>${escapeHtml(voice.label)}</option>`).join("")}<option value="random:fr" ${selectedVoice === "random:fr" ? "selected" : ""}>Une voix française par viewer</option></optgroup>`,
    '<optgroup label="Voix Windows · sur cet ordinateur">',
    ...voices.map(
      (voice) =>
        `<option value="${escapeHtml(voice.name)}" ${voice.name === selectedVoice ? "selected" : ""}>${escapeHtml(`${voice.name}${voice.lang ? ` · ${voice.lang}` : voice.legacy ? " · ancienne configuration" : ""}`)}</option>`
    ), '</optgroup>'
  ].join("");
}

function ttsVoiceField(name, currentVoice = "", extraClass = "") {
  return `<div class="field tts-voice-field ${extraClass}"><label for="tts-select-${escapeHtml(name)}">Voix <small data-tts-voice-count>${typeof ShenPulseTtsVoices !== "undefined" ? ShenPulseTtsVoices.NATURAL_VOICES.length : 0} voix naturelles</small></label><div class="tts-voice-controls"><select id="tts-select-${escapeHtml(name)}" name="${escapeHtml(name)}" data-tts-voice-select>${ttsVoiceOptions(currentVoice)}</select><button type="button" class="button tts-voice-test" data-action="tts-voice-preview" data-voice-field="${escapeHtml(name)}" aria-label="Tester la voix sélectionnée">▶ Tester</button></div><small>Voix naturelles en ligne ou voix Windows locales. Secours Windows si le service est indisponible.</small><small role="status" aria-live="polite" data-voice-preview-status></small></div>`;
}

function ttsSlider(name, label, value, min, max, step) {
  return `<label class="field tts-slider"><span>${label} <output data-voice-output="${name}">${value}</output></span><input type="range" name="${name}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
}

let ttsCatalogRefreshPending = null;
function refreshNaturalTtsVoices() {
  if (typeof api.ttsVoices !== "function" || ttsCatalogRefreshPending) return ttsCatalogRefreshPending;
  ttsCatalogRefreshPending = api.ttsVoices().then((entries) => {
    ShenPulseTtsVoices.installCatalog(entries);
    refreshTtsVoiceSelects();
    document.querySelectorAll("[data-tts-voice-count]").forEach((node) => { node.textContent = `${ShenPulseTtsVoices.NATURAL_VOICES.length} voix naturelles`; });
  }).catch(() => {}).finally(() => { ttsCatalogRefreshPending = null; });
  return ttsCatalogRefreshPending;
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
  const allowedRoles = Array.isArray(config.allowedRoles) ? config.allowedRoles : ["all"];
  return `<div class="tts-moderation-fields full">
    <fieldset class="tts-audience-roles"><legend>Qui peut être lu à voix haute ?</legend>${[["all", "Tout le chat"], ["viewer", "Spectateurs"], ["subscriber", "Abonnés"], ["moderator", "Modérateurs"], ["team", "Équipe TikTok"]].map(([role, label]) => `<label class="filter-check"><input type="checkbox" name="ttsAllowedRole" value="${role}" ${allowedRoles.includes(role) ? "checked" : ""}><span>${label}</span></label>`).join("")}<small>« Tout le chat » autorise tous les rôles. Les autres choix peuvent se cumuler.</small></fieldset>
    <div class="form-grid">${field("ttsMaxCharacters", "Longueur maximale", config.maxCharacters || 300, "number", 'min="1" max="1000" step="1"')}<label class="field full"><span>Mots ou expressions bloqués</span><textarea name="ttsBlockedWords" rows="2" placeholder="Une expression par ligne">${escapeHtml((config.blockedWords || []).join("\n"))}</textarea><small>Les commentaires contenant ces expressions sont ignorés, sans distinction de majuscules ni d’accents.</small></label><label class="field full"><span>Comptes bloqués</span><textarea name="ttsBlockedUsers" rows="2" placeholder="Un @ par ligne">${escapeHtml((config.blockedUsers || []).join("\n"))}</textarea></label></div>
    <div class="tts-comment-filters">
    ${checkRow(
      "Lire les emojis",
      "Désactivé : aucun emoji du téléphone ou de TikTok n’est lu.",
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
  </div></div>`;
}

function readTtsModerationFields(data) {
  const lines = (name) => [...new Set(String(data.get(name) || "").split(/\r?\n/).map((value) => value.trim()).filter(Boolean))].slice(0, 100);
  return {
    allowedRoles: data.getAll("ttsAllowedRole").filter((role) => ["all", "viewer", "subscriber", "moderator", "team"].includes(role)),
    maxCharacters: Math.max(1, Math.min(1000, Math.round(Number(data.get("ttsMaxCharacters")) || 300))),
    blockedWords: lines("ttsBlockedWords"),
    blockedUsers: lines("ttsBlockedUsers")
  };
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
  const components = dialogBody.querySelector("[data-action-components-editor]");
  if (components) syncActionComponentsEditor();
  else if (actionType) {
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
  if (!components) {
    syncActionGroupEditor();
    if (typeof syncActionAlertDisplay === "function") syncActionAlertDisplay();
  }
}

function syncActionGroupEditor(scope = dialogBody) {
  const active =
    scope.querySelector("[name='actionType']")?.value === "action.group";
  const mode = scope.querySelector(
    '[name="actionGroupMode"]'
  )?.value;
  if (!mode) return;
  const randomCountField = scope.querySelector(
    "[data-action-group-random-count]"
  );
  setEditorConditionalVisibility(
    randomCountField,
    active && mode === "random"
  );
  const selectedCount = scope.querySelectorAll(
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

function collectGiftTriggerConditions(existing, data, {
  giftName = "giftNameCondition", modeName = "giftTriggerMode",
  operatorName = "giftValueOperator", amountName = "giftValueAmount"
} = {}) {
  const all = name => typeof data.getAll === "function" ? data.getAll(name) : [data.get(name)];
  if (data.get(modeName) === "value") {
    const value = Number(data.get(amountName));
    if (!Number.isFinite(value) || value <= 0) return [];
    const operator = GIFT_VALUE_OPERATOR_OPTIONS.some(([option]) => option === data.get(operatorName)) ? data.get(operatorName) : "greaterOrEqual";
    return [{ field: "data.value", operator, value }];
  }
  const ids = all(`${giftName}GiftId`), operators = all(`${giftName}Operator`);
  return all(giftName).flatMap((value, index) => {
    const name = String(value || "").trim(), giftId = String(ids[index] || "").trim();
    if (!name && !giftId) return [];
    const previous = (existing || []).find(condition => condition.field === "data.giftName" &&
      (giftId ? String(condition.giftId || "") === giftId : normalizeGiftName(condition.value) === normalizeGiftName(name))) || {};
    return [{ ...giftReferenceForSave(name, giftId, previous), field: "data.giftName",
      operator: operators[index] === "notEquals" ? "notEquals" : "equals", value: name }];
  });
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
  const username = String(data.get("usernameCondition") || "")
    .trim()
    .replace(/^@+/, "");
  const message = String(data.get("messageCondition") || "").trim();
  conditions.push(...collectGiftTriggerConditions(existing, data));
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
