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
    dialog.close();
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
      snapshot = await api.configureGame(
        gameId,
        integratedSettingsFromForm(gameId, data)
      );
      if (launchAfterSave) {
        const result = await api.launchGame(gameId);
        if (result?.snapshot) acceptSnapshot(result.snapshot);
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
    await perform(async () => {
      adminBusy = true;
      render();
      try {
        await api.admin.grantTrial({
          email: data.get("email"),
          days: Number(data.get("days") || 7),
          subscription: data.has("subscription"),
          games: data.has("games"),
          gameIds: data.getAll("gameIds")
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
    const selectedGift = giftForIdentity(
      values.giftName || "Rose",
      values.giftNameGiftId
    );
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
          giftId: selectedGift?.id || "",
          giftName: values.giftName || "Rose",
          giftImageUrl: selectedGift?.imageUrl || "",
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
      },
      backblaze: {
        bucket: values.backblazeBucket,
        endpoint: values.backblazeEndpoint,
        region: values.backblazeRegion,
        prefix: values.backblazePrefix,
        publicBaseUrl: values.backblazePublicBaseUrl,
        maxBytes: Number(values.backblazeMaxMb || 200) * 1024 * 1024
      },
      backblazeKeyId: values.backblazeKeyId,
      backblazeApplicationKey: values.backblazeApplicationKey
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

api.on("state-changed", (value) => {
  const overlaySessionChanged =
    overlaySessionLifecycleSignature(snapshot) !==
    overlaySessionLifecycleSignature(value);
  const overlayStateHandledLocally =
    currentPage === "overlays" &&
    consumeLocallyHandledOverlayState(snapshot, value);
  const refreshOverlayPage =
    currentPage === "overlays" &&
    !overlayStateHandledLocally &&
    overlayPageStateSignature(snapshot) !== overlayPageStateSignature(value);
  const refreshGamePage =
    currentPage === "games" &&
    gamePageStateSignature(snapshot) !== gamePageStateSignature(value);
  const refreshCurrentPage =
    currentPage === "dashboard" ||
    currentPage === "activity" ||
    currentPage === "connections" ||
    currentPage === "actions" ||
    refreshGamePage ||
    refreshOverlayPage ||
    currentPage === "sounds" ||
    currentPage === "membership";
  acceptSnapshot(value);
  if (overlaySessionChanged) {
    postOverlayPreviewEvent(
      "session-state",
      value.state?.overlaySession || {}
    );
  }
  if (refreshCurrentPage) render();
  else {
    if (currentPage === "overlays") syncPublicOverlayRelayStatus();
    renderNavigation();
    syncChrome();
  }
});

api.on("public-overlay-relay-status", (status) => {
  if (!snapshot) return;
  snapshot.publicOverlayRelay = status;
  if (currentPage === "overlays") syncPublicOverlayRelayStatus(status);
  syncChrome();
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
  liveEvents.unshift(event);
  liveEvents = liveEvents.slice(0, 100);
  postOverlayPreviewEvent("event", event);
  if (currentPage === "live") render();
  else {
    renderNavigation();
    syncChrome();
  }
});

api.on("playback", (payload) => {
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
  } else if (
    payload.type === "audio" &&
    /^https?:|^data:|^blob:/i.test(payload.url || "")
  ) {
    activePreviewAudio?.pause();
    activePreviewAudio?.remove();
    const audioStage = document.getElementById("audio-stage");
    const audio = document.createElement("audio");
    audio.src = payload.url;
    audio.preload = "auto";
    audio.volume = Number(payload.volume ?? 1);
    activePreviewAudio = audio;
    activePreviewAudioScope = payload.previewScope || "";
    audioStage.replaceChildren(audio);
    audio.addEventListener(
      "ended",
      () => {
        if (activePreviewAudio === audio) {
          activePreviewAudio = null;
          activePreviewAudioScope = "";
        }
        audio.remove();
      },
      { once: true }
    );
    audio
      .play()
      .catch((error) =>
        toast(
          "Lecture du son impossible",
          error.message || "Le fichier audio n’est pas accessible.",
          true
        )
      );
  }
});
