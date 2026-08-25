"use strict";

/** Événements des pages, filtres et formulaires dynamiques. */

async function updateToggle(collection, id, enabled) {
  const item = snapshot.state[collection].find((entry) => entry.id === id);
  if (!item) return;
  await perform(() => api.upsert(collection, { ...item, enabled }));
  snapshot = await api.getSnapshot();
  render();
}

async function updateGameInteractionToggle(packId, rule, enabled) {
  await perform(() =>
    api.saveGameInteraction(packId, { ...rule, enabled })
  );
  snapshot = await api.getSnapshot();
  render();
}

async function toggleTikTok() {
  const tiktok = tiktokMeta();
  if (!tiktok.username) {
    openTikTokEditor();
    return;
  }
  await perform(async () => {
    snapshot = tiktok.connected
      ? await api.stopTikTok()
      : await api.startTikTok();
    render();
  }, tiktok.connected ? "Détection TikTok arrêtée" : "Surveillance LIVE démarrée");
}

async function toggleSession() {
  const wasRunning = snapshot.state.session.running;
  const confirmedLive = tiktokMeta().live;
  await perform(async () => {
    snapshot = wasRunning ? await api.stopSession() : await api.startSession();
    render();
  }, wasRunning
    ? "Session arrêtée"
    : confirmedLive
      ? "Session démarrée"
      : "Détection du LIVE relancée");
}

content.addEventListener("input", (event) => {
  const artworkUrlInput = event.target.closest(
    "[data-coin-pusher-artwork-url]"
  );
  if (artworkUrlInput) {
    updateCoinPusherArtworkDraft(artworkUrlInput, artworkUrlInput.value, {
      syncUrl: false
    });
    return;
  }
  if (event.target.matches("[data-gift-picker]")) {
    scheduleGiftCatalog(event.target);
  }
  const input = event.target.closest("[data-search]");
  if (!input) return;
  const key = input.dataset.search;
  if (key === "actions") actionsSearch = input.value;
  if (key === "overlays") overlaySearch = input.value;
  if (key === "sounds") soundSearch = input.value;
  if (key === "sounds" && soundSearch.trim()) soundCategory = "all";
  if (key === "games") gameSearch = input.value;
  if (key === "game-effects") gameEffectSearch = input.value;
  if (key === "irl-actions") irlActionSearch = input.value;
  if (key === "admin-visibility") adminVisibilitySearch = input.value;
  if (key === "admin-commerce") adminCommerceSearch = input.value;
  const position = input.selectionStart;
  render();
  const replacement = content.querySelector(`[data-search="${key}"]`);
  if (replacement) {
    replacement.focus();
    replacement.setSelectionRange(position, position);
  }
});

content.addEventListener("change", (event) => {
  const artworkFileInput = event.target.closest(
    "[data-coin-pusher-artwork-file]"
  );
  if (artworkFileInput) {
    importCoinPusherArtwork(artworkFileInput).catch((error) =>
      toast("Import impossible", error.message || String(error), true)
    );
    return;
  }
  if (event.target.matches('[name="integratedSettingsPanel"]')) {
    const form = event.target.closest("[data-integrated-game-settings]");
    if (form?.dataset.integratedGameSettings) {
      integratedSettingsPanels.set(
        form.dataset.integratedGameSettings,
        event.target.value
      );
    }
    return;
  }
  const scopePicker = event.target.closest(
    'select[data-action="admin-scope"]'
  );
  if (scopePicker) {
    perform(
      () =>
        saveAdminVisibilityScope(
          scopePicker.dataset.section,
          scopePicker.dataset.id,
          scopePicker.value
        ),
      "Visibilité mise à jour"
    ).catch(() => {});
    return;
  }
  const picker = event.target.closest("[data-overlay-design]");
  if (!picker) return;
  const item = overlayDefinitions().find(
    (entry) => entry.key === picker.dataset.overlayDesign
  );
  if (!item) return;
  if (!isAccountAuthenticated()) {
    previewOverlayDesignSelection(item, picker.value);
    return;
  }
  perform(
    () => persistOverlayDesignSelection(item, picker.value),
    overlayUnlocked(item)
      ? "Design lié au profil mis à jour"
      : "Aperçu du design Pro mis à jour"
  ).catch(() => {});
});

dialogBody.addEventListener("input", (event) => {
  if (event.target.matches("[data-gift-picker]")) {
    scheduleGiftCatalog(event.target);
  }
  if (event.target.matches("[data-timer-action-search]")) {
    const query = event.target.value.trim().toLowerCase();
    dialogBody.querySelectorAll("[data-timer-action-option]").forEach((item) => {
      item.hidden =
        Boolean(query) &&
        !String(item.dataset.searchable || "").includes(query);
    });
  }
  if (event.target.matches("[data-trigger-action-search]")) {
    const query = event.target.value.trim().toLowerCase();
    dialogBody
      .querySelectorAll("[data-trigger-action-option]")
      .forEach((item) => {
        item.hidden =
          Boolean(query) &&
          !String(item.dataset.searchable || "").includes(query);
      });
  }
  if (event.target.matches('[name="randomCount"]')) {
    syncTriggerSelectionEditor();
  }
  if (event.target.closest("[data-overlay-config-editor]")) {
    scheduleOverlayLivePreview();
  }
});

document.addEventListener("focusin", (event) => {
  if (event.target.matches("[data-gift-picker]")) {
    hydrateGiftCatalog(event.target.value, event.target);
  }
});

dialogBody.addEventListener("change", (event) => {
  if (
    event.target.matches('[name="actionIds"]') ||
    event.target.matches("[data-trigger-selection-mode]")
  ) {
    syncTriggerSelectionEditor();
  }
  if (event.target.matches("[data-gift-trigger-mode]")) {
    syncGiftTriggerCondition(
      event.target.closest("[data-gift-trigger-condition]")
    );
  }
  if (event.target.matches('[name="liveScreen"]')) {
    syncLiveAudioScreenDialog();
  }
  if (
    event.target.matches('[name="wheelSegmentActionId"]') &&
    event.target.value
  ) {
    const row = event.target.closest("[data-wheel-segment-row]");
    const mode = row?.querySelector('[name="wheelSegmentAction"]');
    if (mode && mode.value !== "spin") mode.value = "action";
  }
  if (
    event.target.matches(
      '[name="wheelSegmentAction"], [name="wheelSegmentActionId"]'
    )
  ) {
    if (
      event.target.matches('[name="wheelSegmentAction"]') &&
      event.target.value !== "action"
    ) {
      const actionSelect = event.target
        .closest("[data-wheel-segment-row]")
        ?.querySelector('[name="wheelSegmentActionId"]');
      if (actionSelect) actionSelect.value = "";
    }
    syncWheelSegmentActionVisibility();
  }
  if (event.target.closest("[data-overlay-config-editor]")) {
    scheduleOverlayLivePreview();
  }
  if (
    event.target.matches('[name="wheelDesign"]') &&
    wheelEditorContext
  ) {
    collectWheelEditorForm();
    dialogBody.querySelectorAll(".wheel-design-option").forEach((option) => {
      option.classList.toggle(
        "selected",
        option.querySelector('[name="wheelDesign"]')?.checked === true
      );
    });
    scheduleOverlayLivePreview();
    return;
  }
  if (
    event.target.matches("[data-editor-action-type]") ||
    event.target.matches("[data-editor-trigger-type]") ||
    event.target.matches("[data-editor-trigger-enabled]")
  ) {
    syncActionEditorVisibility();
  }
  if (event.target.matches('[name="gamePackId"]')) {
    const effectSelect = dialogBody.querySelector('[name="effectId"]');
    const pack = snapshot.packs.find(
      (entry) => entry.id === event.target.value
    );
    if (effectSelect && pack) {
      effectSelect.innerHTML = pack.effects.map(
        (effect) =>
          `<option value="${escapeHtml(effect.id)}">${escapeHtml(effect.name)} · ${escapeHtml(effect.id)}</option>`
      ).join("");
    }
  }
});

content.addEventListener("click", (event) => {
  const navigate = event.target.closest("[data-navigate]");
  if (navigate) {
    if (!canNavigateTo(navigate.dataset.navigate)) {
      return toast(
        "Page indisponible",
        "Cette page est masquée par la configuration ShenPulse.",
        true
      );
    }
    currentPage = navigate.dataset.navigate;
    render();
    content.scrollTop = 0;
    if (currentPage === "sounds" && isAccountAuthenticated()) {
      refreshSpotifyStatus();
    }
    if (currentPage === "admin" && !adminDashboard) {
      refreshAdminDashboard().catch((error) =>
        toast("Administration indisponible", error.message || String(error), true)
      );
    }
    content.focus();
    return;
  }
  const action = event.target.closest("[data-action]");
  if (
    ["set-audio-output", "irl-toggle"].includes(action?.dataset.action) &&
    action.matches('input[type="checkbox"]')
  ) {
    return;
  }
  if (action) handleAction(action).catch(() => {});
});

content.addEventListener("change", (event) => {
  const action = event.target.closest("[data-action]");
  if (action) handleAction(action).catch(() => {});
});

document.body.addEventListener("click", (event) => {
  if (!event.target.closest(".account-control")) {
    accountMenu.hidden = true;
    accountMenuButton.setAttribute("aria-expanded", "false");
  }
  if (!event.target.closest("[data-gift-picker-root]")) {
    document.querySelectorAll("[data-gift-results]").forEach((results) => {
      results.hidden = true;
    });
  }
  const giftChoice = event.target.closest("[data-gift-choice]");
  if (giftChoice && !dialog.contains(giftChoice)) {
    const root = giftChoice.closest("[data-gift-picker-root]");
    const input = root?.querySelector("[data-gift-picker]");
    const idInput = root?.querySelector("[data-gift-id-input]");
    if (input) input.value = giftChoice.dataset.giftChoice;
    if (idInput) idInput.value = giftChoice.dataset.giftId || "";
    updateGiftPickerSelection(root, {
      id: giftChoice.dataset.giftId,
      name: giftChoice.dataset.giftChoice,
      imageUrl: giftChoice.dataset.giftImage
    });
    const results = root?.querySelector("[data-gift-results]");
    if (results) results.hidden = true;
    return;
  }
  const giftClear = event.target.closest("[data-gift-clear]");
  if (giftClear && !dialog.contains(giftClear)) {
    const root = giftClear.closest("[data-gift-picker-root]");
    const input = root?.querySelector("[data-gift-picker]");
    const idInput = root?.querySelector("[data-gift-id-input]");
    if (input) input.value = "";
    if (idInput) idInput.value = "";
    updateGiftPickerSelection(root);
    const results = root?.querySelector("[data-gift-results]");
    if (results) results.hidden = true;
    return;
  }
  const navigate = event.target.closest("[data-navigate]");
  if (navigate && !content.contains(navigate)) {
    if (!canNavigateTo(navigate.dataset.navigate)) {
      return toast(
        "Page indisponible",
        "Cette page est masquée par la configuration ShenPulse.",
        true
      );
    }
    currentPage = navigate.dataset.navigate;
    render();
    content.scrollTop = 0;
    if (currentPage === "sounds" && isAccountAuthenticated()) {
      refreshSpotifyStatus();
    }
    if (currentPage === "admin" && !adminDashboard) {
      refreshAdminDashboard().catch((error) =>
        toast("Administration indisponible", error.message || String(error), true)
      );
    }
    accountMenu.hidden = true;
    accountMenuButton.setAttribute("aria-expanded", "false");
  }
  const globalAction = event.target.closest("[data-action]");
  if (globalAction && !content.contains(globalAction)) {
    handleAction(globalAction).catch(() => {});
  }
  const windowButton = event.target.closest("[data-window]");
  if (windowButton) api.window[windowButton.dataset.window]?.();
});
