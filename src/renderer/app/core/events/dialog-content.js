"use strict";

/** Commandes internes des éditeurs et soumission des pages. */

dialog.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-overlay-editor-tab]");
  if (!tab) return;
  const editor = tab.closest("[data-overlay-config-editor]");
  if (!editor || editor.classList.contains("wheel-config-editor")) return;
  event.preventDefault();
  const section = tab.dataset.overlayEditorTab;
  editor.querySelectorAll("[data-overlay-editor-tab]").forEach((button) => {
    const active = button.dataset.overlayEditorTab === section;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  editor.querySelectorAll("[data-overlay-editor-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.overlayEditorPanel !== section;
  });
  editor.querySelector(`[data-overlay-editor-panel="${section}"]`)?.scrollTo({
    top: 0,
    behavior: "instant"
  });
});

dialog.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-wheel-command]");
  if (!target || !wheelEditorContext) return;
  event.preventDefault();
  const previousWheelScrollTop = dialogBody.scrollTop;
  collectWheelEditorForm();
  const config = wheelEditorContext.config;
  const wheel = config.wheels.find(
    (entry) => entry.id === config.selectedWheelId
  );
  const command = target.dataset.wheelCommand;
  if (command === "section") {
    const section = target.dataset.wheelSection;
    if (!["setup", "segments", "appearance", "playback"].includes(section)) {
      return;
    }
    wheelEditorContext.section = section;
    dialogBody.querySelectorAll("[data-wheel-section]").forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.wheelSection === section
      );
    });
    dialogBody
      .querySelectorAll("[data-wheel-section-panel]")
      .forEach((panel) => {
        panel.hidden = panel.dataset.wheelSectionPanel !== section;
      });
    dialogBody
      .querySelector(`[data-wheel-section-panel="${section}"]`)
      ?.scrollIntoView({ block: "start" });
    return;
  }
  if (command === "select") {
    config.selectedWheelId = target.dataset.wheelId;
    wheelEditorContext.section = "setup";
  } else if (command === "add") {
    const nextWheel = {
      id: `wheel_${cryptoId()}`,
      name: `Nouvelle roue ${config.wheels.length + 1}`,
      enabled: true,
      trigger: "",
      giftValueFilter: null,
      design: "classic",
      settings: wheelDefaultSettings(),
      segments: wheelSeedSegments("classic")
    };
    config.wheels.push(nextWheel);
    config.selectedWheelId = nextWheel.id;
    wheelEditorContext.section = "setup";
  } else if (command === "delete") {
    if (config.wheels.length <= 1) {
      return toast(
        "Suppression impossible",
        "Conservez au moins une roue d’actions.",
        true
      );
    }
    if (
      !(await confirmAction(`Supprimer la roue « ${wheel.name} » ?`, {
        title: "Supprimer cette roue",
        confirmLabel: "Supprimer"
      }))
    ) {
      return;
    }
    config.wheels = config.wheels.filter((entry) => entry.id !== wheel.id);
    config.selectedWheelId = config.wheels[0].id;
    wheelEditorContext.section = "setup";
  } else if (command === "segment-add") {
    wheel.segments.push({
      id: `segment_${cryptoId()}`,
      label: `Nouveau segment ${wheel.segments.length + 1}`,
      color: wheel.design === "royal" ? "#7b1fa2" : "#ff6a00",
      action: "none",
      actionId: ""
    });
  } else if (command.startsWith("segment-")) {
    const index = Number(target.dataset.index);
    if (!Number.isInteger(index) || !wheel.segments[index]) return;
    if (command === "segment-delete" && wheel.segments.length > 2) {
      wheel.segments.splice(index, 1);
    }
    if (command === "segment-up" && index > 0) {
      [wheel.segments[index - 1], wheel.segments[index]] = [
        wheel.segments[index],
        wheel.segments[index - 1]
      ];
    }
    if (command === "segment-down" && index < wheel.segments.length - 1) {
      [wheel.segments[index + 1], wheel.segments[index]] = [
        wheel.segments[index],
        wheel.segments[index + 1]
      ];
    }
  }
  openWheelOverlayConfig(wheelEditorContext.item);
  if (command.startsWith("segment-")) {
    requestAnimationFrame(() => {
      if (command === "segment-add") {
        dialogBody
          .querySelector("[data-wheel-segment-row]:last-child")
          ?.scrollIntoView({ block: "center" });
        return;
      }
      dialogBody.scrollTop = previousWheelScrollTop;
    });
  }
});

dialog.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-profile-action]");
  if (!target) return;
  const action = target.dataset.profileAction;
  const profile = snapshot.state.profiles.find(
    (item) => item.id === target.dataset.id
  );
  if (action === "create" || action === "edit") {
    openProfileEditor(action === "edit" ? profile : null);
    return;
  }
  if (action === "activate" && profile) {
    await perform(async () => {
      await api.selectProfile(profile.id);
      snapshot = await api.getSnapshot();
      openProfileManager();
      render();
    }, `Profil « ${profile.name} » activé`);
    return;
  }
  if (action === "delete" && profile) {
    if (snapshot.state.profiles.length <= 1) {
      toast("Suppression impossible", "ShenPulse doit conserver au moins un profil.", true);
      return;
    }
    if (
      !(await confirmAction(`Supprimer le profil « ${profile.name} » ?`, {
        title: "Supprimer ce profil",
        confirmLabel: "Supprimer"
      }))
    ) {
      return;
    }
    await perform(async () => {
      if (snapshot.state.session.profileId === profile.id) {
        const fallback = snapshot.state.profiles.find(
          (item) => item.id !== profile.id
        );
        await api.selectProfile(fallback.id);
      }
      await api.remove("profiles", profile.id);
      snapshot = await api.getSnapshot();
      openProfileManager();
      render();
    }, "Profil supprimé");
  }
});

content.addEventListener("submit", async (event) => {
  if (!isAccountAuthenticated()) {
    event.preventDefault();
    toast(
      "Connexion requise",
      "Aucune modification n’est autorisée en mode consultation.",
      true
    );
    openAccountLogin();
    return;
  }
  if (event.target.id === "premium-seat-form") {
    event.preventDefault();
    const data = new FormData(event.target);
    await perform(async () => {
      const response = await api.assignPremiumSeat({
        beneficiaryEmail: data.get("beneficiaryEmail")
      });
      if (response?.snapshot) acceptSnapshot(response.snapshot);
      render();
    }, "Accès Pro offert");
    return;
  }
  const coinPusherInteractionsForm = event.target.closest(
    "[data-coin-pusher-interactions]"
  );
  if (coinPusherInteractionsForm) {
    event.preventDefault();
    const pack = snapshot.packs.find((item) => item.id === "coin-pusher");
    if (!requireGameAccess(pack)) return;
    const data = new FormData(coinPusherInteractionsForm);
    await perform(async () => {
      snapshot = await api.configureGame(
        "coin-pusher",
        coinPusherInteractionSettingsFromForm(data)
      );
      gamePageMessages.set("coin-pusher", {
        type: "success",
        scope: "interactions",
        title: "Interactions enregistrées",
        detail:
          "Le barème, les cadeaux précis et les bonus spéciaux sont prêts pour le prochain LIVE."
      });
      render();
    }, "Interactions Coin Pusher enregistrées");
    return;
  }
  const integratedSettingsForm = event.target.closest(
    "[data-integrated-game-settings]"
  );
  if (integratedSettingsForm) {
    event.preventDefault();
    const gameId = integratedSettingsForm.dataset.integratedGameSettings;
    const pack = snapshot.packs.find((item) => item.id === gameId);
    if (!requireGameAccess(pack)) return;
    const launchAfterSave =
      event.submitter?.dataset.launchAfterSave === "true";
    const data = new FormData(integratedSettingsForm);
    await perform(async () => {
      const nextConfig = integratedSettingsFromForm(gameId, data);
      if (launchAfterSave && gameId === "thiercelieux") {
        const setup = thiercelieuxSetupState(nextConfig);
        if (!setup.ready) throw new Error(setup.errors[0]);
      }
      snapshot = await api.configureGame(
        gameId,
        nextConfig
      );
      if (launchAfterSave) {
        const result = await api.launchGame(gameId);
        if (result?.snapshot) acceptSnapshot(result.snapshot);
        if (gameId === "thiercelieux") {
          integratedSettingsPanels.set("thiercelieux", "live");
        }
      }
      gamePageMessages.set(gameId, {
        type: "success",
        scope: "installation",
        title: launchAfterSave ? "Jeu ouvert" : "Réglages enregistrés",
        detail: launchAfterSave
          ? `${pack?.name || "Le jeu"} utilise maintenant les réglages du profil actif.`
          : "Les prochains lancements utiliseront cette configuration."
      });
      render();
    }, launchAfterSave ? "Jeu configuré et lancé" : "Réglages du jeu enregistrés");
    return;
  }
  if (event.target.id === "admin-trial-form") {
    event.preventDefault();
    const data = new FormData(event.target);
    const games = data.has("games");
    await perform(async () => {
      adminBusy = true;
      render();
      try {
        await api.admin.grantTrial({
          email: data.get("email"),
          days: Number(data.get("days") || 7),
          subscription: data.has("subscription"),
          games,
          gameIds: games ? adminTrialGameIdsFromForm(data) : []
        });
        adminDashboard = await api.admin.dashboard();
      } finally {
        adminBusy = false;
        render();
        restoreAdminTrialFormInteractivity({ focusEmail: true });
      }
    }, "Offre d’essai accordée");
    return;
  }
  if (event.target.id === "admin-game-cheat-form") {
    event.preventDefault();
    const data = new FormData(event.target);
    const email = String(data.get("email") || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return toast(
        "Adresse invalide",
        "Renseignez l’adresse e-mail exacte du compte ShenPulse.",
        true
      );
    }
    if (
      email === ADMIN_OWNER_EMAIL ||
      adminGameCheatEntries().includes(email)
    ) {
      return toast(
        "Compte déjà autorisé",
        "Cette adresse possède déjà l’accès aux onglets de triche.",
        true
      );
    }
    await perform(
      () =>
        saveAdminGameCheatEntries([
          ...adminGameCheatEntries(),
          email
        ]),
      "Accès aux triches accordé"
    );
    return;
  }
  if (event.target.id === "simulator-form") {
    event.preventDefault();
    const data = new FormData(event.target);
    const values = Object.fromEntries(data.entries());
    const selectedGift = values.type === "gift" ? giftForIdentity(
      values.giftName || "Rose",
      values.giftNameGiftId
    ) : null;
    await perform(
      () =>
        api.simulateEvent({
          type: values.type,
          username: values.username,
          nickname: values.nickname,
          count: Number(values.count || 1),
          value:
            values.type === "gift" && selectedGift
              ? Math.max(1, Number(selectedGift.cost || 1))
              : Number(values.value || 0),
          ...(values.type === "gift" ? {
            giftId: values.giftNameGiftId || selectedGift?.id || "",
            giftName: values.giftName || "Rose",
            giftImageUrl: selectedGift?.imageUrl || ""
          } : {}),
          message: values.message || "!help"
        }),
      `Événement ${values.type} injecté dans les déclencheurs`
    );
    return;
  }
  if (event.target.id !== "settings-form") return;
  event.preventDefault();
  const data = new FormData(event.target);
  const values = Object.fromEntries(data.entries());
  await perform(async () => {
    snapshot = await api.saveSettings({
      startOverlayServer: data.has("startOverlayServer"),
      minimizeToTray: data.has("minimizeToTray"),
      allowKeystrokes: data.has("allowKeystrokes"),
      telemetry: data.has("telemetry"),
      overlayPort: Number(values.overlayPort),
      apiPort: Number(values.apiPort),
      tts: { voice: values.ttsVoice, rate: Number(values.ttsRate), pitch: Number(values.ttsPitch), volume: Number(values.ttsVolume) },
      obs: { url: values.obsUrl },
      obsPassword: values.obsPassword,
      spotify: {
        redirectPort: Number(values.spotifyRedirectPort)
      }
    });
    render();
  }, "Paramètres enregistrés");
});

api.on("game-install-progress", (progress) => {
  if (!progress?.gameId) return;
  if (progress.phase === "canceled") {
    if (gameInstallProgress?.gameId === progress.gameId) {
      gameInstallProgress = null;
    }
    if (gameInstallBusyId === progress.gameId) {
      gameInstallBusyId = "";
    }
    render();
    return;
  }
  const sameOperation = gameInstallProgress?.gameId === progress.gameId;
  const repairing = Boolean(
    snapshot?.state?.game?.installations?.[progress.gameId]
  );
  gameInstallBusyId = ["complete", "error"].includes(progress.phase)
    ? ""
    : progress.gameId;
  gameInstallProgress = {
    ...(sameOperation ? gameInstallProgress : {}),
    ...progress,
    operation:
      (sameOperation && gameInstallProgress?.operation) ||
      (repairing ? "repair" : "install"),
    lastActivityAt:
      progress.occurredAt ||
      (sameOperation && gameInstallProgress?.lastActivityAt) ||
      new Date().toISOString(),
    open: true
  };
  render();
});

api.on("deal-host-state", (state) => {
  dealOrNoDealHostState =
    state && typeof state === "object" ? state : null;
  syncDealPrivateMonitor();
});

api.on("thiercelieux-host-state", (state) => {
  thiercelieuxHostState =
    state && typeof state === "object" ? state : null;
  syncThiercelieuxLivePanel();
});

function handleRendererStateChanged(value) {
  const previous = snapshot;
  if (!rendererVisualsActive()) {
    creatorDeferredSnapshot ||= previous;
    acceptSnapshot(value);
    return;
  }
  acceptSnapshot(value);
  refreshRendererStateComparison(previous, value);
}

function refreshRendererStateComparison(previous, value) {
  if (currentPage === "commands" && typeof syncCreatorChatbotActivity === "function") {
    // Une réponse reçue ne reconstruit ni les formulaires, ni la bannière ChatBot.
    syncCreatorChatbotActivity();
  }
  const overlaySessionChanged =
    hasOverlayRuntimePreview() && overlayPreviewSessionChanged(previous, value);
  const overlayStateHandledLocally =
    currentPage === "overlays" &&
    consumeLocallyHandledOverlayState(previous, value);
  const refreshOverlayPage =
    currentPage === "overlays" &&
    !overlayStateHandledLocally &&
    overlayPageStateSignature(previous) !== overlayPageStateSignature(value);
  const refreshGamePage =
    currentPage === "games" &&
    gamePageStateSignature(previous) !== gamePageStateSignature(value);
  const pageDataChanged = creatorPageDataChanged(previous, value);
  const matchesStructureChanged = currentPage === "matches" &&
    JSON.stringify([previous.state?.settings?.matches, previous.state?.session?.profileId,
      previous.state?.rules, previous.state?.commerce, previous.state?.settings?.account?.uid,
      previous.state?.settings?.siteVisibility, previous.overlayUrls, previous.localOverlayUrls]) !==
    JSON.stringify([value.state?.settings?.matches, value.state?.session?.profileId,
      value.state?.rules, value.state?.commerce, value.state?.settings?.account?.uid,
      value.state?.settings?.siteVisibility, value.overlayUrls, value.localOverlayUrls]);
  const refreshCurrentPage = refreshGamePage || refreshOverlayPage ||
    matchesStructureChanged ||
    (!["dashboard", "users", "games", "overlays", "matches"].includes(currentPage) && pageDataChanged);
  if (overlaySessionChanged) {
    postOverlayPreviewEvent(
      "session-state",
      value.state?.overlaySession || {}
    );
    const sceneFrame = content.querySelector("[data-scene-preview]");
    if (sceneFrame && typeof hydrateSceneComposerPreview === "function") hydrateSceneComposerPreview(sceneFrame);
  }
  scheduleRendererRefresh({
    redraw: refreshCurrentPage,
    dashboard: currentPage === "dashboard" && pageDataChanged,
    users: currentPage === "users" && pageDataChanged,
    matches: currentPage === "matches" && pageDataChanged
  });
}

api.on("state-changed", handleRendererStateChanged);

api.on("gift-room-catalog-updated", (result) => {
  if (!rememberRoomGifts(result?.roomGifts, result?.room)) return;
  if (!rendererVisualsActive()) return;
  updateAllGiftPickerSelections();
  refreshGiftVisuals();
  const input = document.activeElement;
  if (input?.matches?.("[data-gift-picker]")) void hydrateGiftCatalog(input.value, input);
});

api.on("gift-catalog-updated", (gifts) => {
  if (!Array.isArray(gifts) || !gifts.length) return;
  rememberGifts(gifts);
  if (rendererVisualsActive()) {
    updateAllGiftPickerSelections();
    refreshGiftVisuals();
  }
  // Le lot est limité aux cadeaux modifiés. Le regroupement existant protège
  // les rafales et les fenêtres masquées ; les formulaires ouverts sont préservés.
  scheduleRendererRefresh({
    redraw: ["actions", "rules", "sounds", "voice", "music", "games", "overlays", "live"].includes(currentPage)
      && !dialog.open && !content.querySelector("form"),
    dashboard: currentPage === "dashboard"
  });
});

api.on("runtime-state-changed", (patch) => {
  if (!snapshot || !patch?.state) return;
  handleRendererStateChanged({
    ...snapshot,
    ...patch,
    state: {
      ...snapshot.state,
      ...patch.state,
      // Runtime metadata patches contain only the changing platform settings.
      // Keep account, locale, scene and other persisted settings intact.
      ...(patch.state.settings ? {
        settings: { ...snapshot.state.settings, ...patch.state.settings }
      } : {})
    }
  });
});

api.on("public-overlay-relay-status", (status) => {
  if (!snapshot) return;
  snapshot.publicOverlayRelay = status;
  if (!rendererVisualsActive()) return;
  if (currentPage === "overlays") syncPublicOverlayRelayStatus(status);
  syncChrome();
});

api.on("live-directory-status", (status) => {
  if (!snapshot || !status || typeof status !== "object") return;
  snapshot.liveDirectory = status;
  if (!rendererVisualsActive()) return;
  if (currentPage === "home") syncCreatorHomeLive();
  syncCreatorLiveDirectoryPreference();
});

api.on("chat-transport-changed", () => {
  if (currentPage === "connections" && typeof refreshCreatorChatbotDelivery === "function") refreshCreatorChatbotDelivery(true);
});

api.on("game-round-timeout", (entry) => {
  toast(
    "TIME OUT Minecraft",
    `${entry.appliedAmount} WIN${
      Math.abs(Number(entry.appliedAmount || 0)) === 1 ? "" : "S"
    } · total ${entry.currentWins}${
      entry.autoRestart ? " · nouveau chrono démarré" : ""
    }`,
    true
  );
});

api.on("overlay-completion-fired", (entry) => {
  const source =
    entry.kind === "likeGoal" ? "Like Goal atteint" : "Timer terminé";
  if (!entry.ok) {
    toast(
      `${source} · action impossible`,
      entry.error || "L’action sélectionnée n’a pas pu être exécutée.",
      true
    );
    return;
  }
  toast(
    source,
    `Action exécutée : ${
      ACTION_TYPE_LABELS[entry.actionType] || entry.actionType || "Action"
    }`
  );
});

api.on("live-event", (event) => {
  void handleThiercelieuxRegistrationEvent(event).catch((error) =>
    toast(
      "Inscription Thiercelieux impossible",
      error.message || String(error),
      true
    )
  );
  liveEvents.unshift(event);
  liveEvents = liveEvents.slice(0, 100);
  rememberCreatorAudienceEvent(event);
  postOverlayPreviewEvent("event", event);
  scheduleRendererRefresh({
    redraw: currentPage === "live",
    dashboard: currentPage === "dashboard",
    users: currentPage === "users"
  });
});

api.on("game-effect", (payload) => {
  void handleThiercelieuxControlEffect(payload).catch((error) =>
    toast(
      "Commande Thiercelieux impossible",
      error.message || String(error),
      true
    )
  );
});

api.on("playback", async (payload) => {
  if (payload.type === "tts" && "speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(payload.text);
    utterance.rate = Number(payload.rate || 1);
    utterance.pitch = Number(payload.pitch || 1);
    utterance.volume = Number(payload.volume ?? 1);
    let selectedVoice = null;
    if (payload.voice) {
      selectedVoice = window.speechSynthesis
        .getVoices()
        .find((entry) => entry.name === payload.voice);
      if (selectedVoice) utterance.voice = selectedVoice;
    }
    utterance.lang = selectedVoice?.lang || payload.language || "fr-FR";
    window.speechSynthesis.speak(utterance);
  } else if (payload.type === "audio") {
    await playRendererAudio(payload);
  }
});
