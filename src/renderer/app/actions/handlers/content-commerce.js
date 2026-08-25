"use strict";

/**
 * Actions, audio, overlays, Spotify et abonnements.
 * Une commande ajoutée ici doit être déclarée dans CONTENT_COMMERCE_ACTIONS.
 */

const CONTENT_COMMERCE_ACTIONS = new Set([
  "add-action",
  "add-trigger",
  "edit-trigger",
  "delete-trigger",
  "edit-action",
  "test-action",
  "duplicate-action",
  "delete-action",
  "add-sound",
  "upload-sound",
  "add-tts",
  "edit-tts",
  "add-timer",
  "edit-timer",
  "test-timer",
  "toggle-timer",
  "edit-sound",
  "set-sound-volume",
  "set-audio-output",
  "preview-sound",
  "preview-tts",
  "spotify-connect",
  "spotify-disconnect",
  "spotify-refresh",
  "spotify-control",
  "preview-overlay",
  "overlay-quick",
  "configure-overlay",
  "toggle-session",
  "configure-tiktok",
  "toggle-tiktok",
  "subscription-checkout-cancel",
  "subscription-stop",
  "subscription-checkout"
]);

async function handleContentAndCommerceAction({ action, target, id }) {
  if (!CONTENT_COMMERCE_ACTIONS.has(action)) return ACTION_NOT_HANDLED;
  if (action === "add-action") return openActionEditor();
  if (action === "add-trigger") return openRuleEditor();
  if (action === "edit-trigger") {
    return openRuleEditor(
      snapshot.state.rules.find((item) => item.id === id)
    );
  }
  if (action === "delete-trigger") {
    return deleteTriggerRule(
      snapshot.state.rules.find((item) => item.id === id)
    );
  }
  if (action === "edit-action") {
    const row = findActionRow(
      target.dataset.rule,
      id,
      target.dataset.index
    );
    return row?.action.type === "tts.speak"
      ? openTtsEditor(row)
      : openActionEditor(row);
  }
  if (action === "test-action") {
    const row = findActionRow(target.dataset.rule, id, target.dataset.index);
    return perform(() => testActionRow(row), "Action de test exécutée");
  }
  if (action === "duplicate-action") {
    const row = findActionRow(target.dataset.rule, id, target.dataset.index);
    return perform(() => duplicateActionRow(row), "Action dupliquée");
  }
  if (action === "delete-action") {
    return deleteActionRow(
      findActionRow(target.dataset.rule, id, target.dataset.index)
    );
  }
  if (action === "add-sound") return openSoundEditor(null, target.dataset.sound || "");
  if (action === "upload-sound") {
    return perform(async () => {
      const result = await api.uploadCustomSound();
      if (result.canceled) return;
      acceptSnapshot(result.snapshot);
      soundSearch = "";
      soundCategory = "custom";
      render();
      toast("Son personnalisé ajouté", result.sound.name);
    });
  }
  if (action === "add-tts") return openTtsEditor();
  if (action === "edit-tts") {
    return openTtsEditor(
      findActionRow(target.dataset.rule, id, target.dataset.index)
    );
  }
  if (action === "add-timer") return openTimerEditor();
  if (action === "edit-timer") {
    return openTimerEditor(
      scheduledTimers().find((timer) => timer.id === id)
    );
  }
  if (action === "test-timer") {
    return perform(() => api.testTimer(id), "Timer exécuté");
  }
  if (action === "toggle-timer") {
    return updateToggle("timers", id, target.checked);
  }
  if (action === "edit-sound") {
    return openSoundEditor(
      findActionRow(target.dataset.rule, id, target.dataset.index)
    );
  }
  if (action === "set-sound-volume") {
    return perform(() =>
      setSoundVolume(
        findActionRow(target.dataset.rule, id, target.dataset.index),
        target.value
      )
    );
  }
  if (action === "set-audio-output") {
    const row = findActionRow(
      target.dataset.rule,
      id,
      target.dataset.index
    );
    if (!row) throw new Error("Sortie audio introuvable.");
    if (target.checked) {
      target.checked = false;
      return openLiveAudioOutputEditor(row);
    }
    return perform(async () => {
      await updateAudioOutput(
        row,
        "local",
        normalizedLiveScreen(row.action.config)
      );
      render();
    }, "Lecture réservée à ShenPulse");
  }
  if (action === "preview-sound") {
    const sound = SOUND_LIBRARY.find((item) => item.id === id);
    if (!sound) throw new Error("Son introuvable dans le catalogue global.");
    return perform(
      () => api.testAction({
        id: `preview_${sound.id}`,
        type: "audio.play",
        config: { url: sound.url, volume: 0.9 }
      }),
      `${sound.name} lancé`
    );
  }
  if (action === "preview-tts") {
    return perform(
      () => api.testAction({
        id: "preview_tts",
        type: "tts.speak",
        testEventType: "chat",
        testMessage: "ShenPulse est prêt pour votre prochain live.",
        config: { text: "{{data.message}}" }
      }),
      "Test vocal lancé"
    );
  }
  if (action === "spotify-connect") {
    return perform(async () => {
      const result = await api.connectSpotify();
      spotifyStatus = result.status;
      acceptSnapshot(result.snapshot);
      render();
    }, "Spotify connecté");
  }
  if (action === "spotify-disconnect") {
    if (
      !(await confirmAction("Déconnecter le compte Spotify de ShenPulse ?", {
        title: "Déconnecter Spotify",
        confirmLabel: "Déconnecter"
      }))
    ) {
      return;
    }
    return perform(async () => {
      const result = await api.disconnectSpotify();
      spotifyStatus = result.status;
      acceptSnapshot(result.snapshot);
      render();
    }, "Spotify déconnecté");
  }
  if (action === "spotify-refresh") {
    return perform(() => refreshSpotifyStatus(), "État Spotify actualisé");
  }
  if (action === "spotify-control") {
    return perform(async () => {
      await api.controlSpotify({ operation: target.dataset.operation });
      await refreshSpotifyStatus();
    }, "Commande Spotify envoyée");
  }
  if (action === "preview-overlay") {
    return perform(() => previewOverlay(id), "Test visible sur la carte");
  }
  if (action === "overlay-quick") {
    return perform(
      () => performOverlayQuickAction(
        id,
        target.dataset.operation,
        Number(target.dataset.amount || 0)
      ),
      "Overlay mis à jour"
    );
  }
  if (action === "configure-overlay") {
    const overlay = overlayDefinitions().find((item) => item.key === id);
    if (!overlay || !canAccessOverlay(overlay)) {
      return toast(
        "Overlay indisponible",
        "Cet overlay est masqué par la configuration ShenPulse.",
        true
      );
    }
    return openOverlayConfig(overlay);
  }
  if (action === "toggle-session") return toggleSession();
  if (action === "configure-tiktok") return openTikTokEditor();
  if (action === "toggle-tiktok") return toggleTikTok();
  if (action === "subscription-checkout-cancel") {
    if (!subscriptionCheckoutBusyTier) return;
    target.disabled = true;
    target.textContent = "Annulation…";
    return perform(() =>
      api.account.cancelCheckout({ type: "subscription" })
    );
  }
  if (action === "subscription-stop") {
    if (subscriptionStopBusy || pendingSubscriptionStop()) return;
    const subscription = currentSubscription();
    if (
      subscription.source !== "own" ||
      !["pro", "premium"].includes(subscription.tier) ||
      !["active", "paid"].includes(String(subscription.status || ""))
    ) {
      return;
    }
    const planName =
      SUBSCRIPTION_PLANS.find((plan) => plan.tier === subscription.tier)
        ?.name || subscription.tier;
    const endDate = membershipDateLabel(subscription.renewalDate);
    if (
      !(await confirmAction(
        `Arrêter le renouvellement de l’abonnement ${planName} ? ` +
          (endDate
            ? `Il restera actif jusqu’au ${endDate}, sans nouveau renouvellement.`
            : "Il restera actif jusqu’à la fin de la période déjà payée."),
        {
          title: "Arrêter l’abonnement ?",
          confirmLabel: "Arrêter le renouvellement"
        }
      ))
    ) {
      return;
    }
    subscriptionStopBusy = true;
    render();
    try {
      return await perform(async () => {
        const response = await api.account.stopSubscription();
        const result = response?.result || response;
        if (response?.snapshot) {
          acceptSnapshot(response.snapshot);
          currentPage = "membership";
          render();
        }
        if (result?.scheduled) {
          const date = membershipDateLabel(result.effectiveAt);
          toast(
            "Arrêt programmé",
            date
              ? `Votre abonnement reste actif jusqu’au ${date}.`
              : "Votre abonnement reste actif jusqu’à la fin de la période déjà payée."
          );
        } else {
          toast(
            "Abonnement arrêté",
            "Votre compte utilise maintenant l’offre Free."
          );
        }
        return response;
      });
    } finally {
      subscriptionStopBusy = false;
      render();
    }
  }
  if (action === "subscription-checkout") {
    const tier = target.dataset.tier;
    const plan = SUBSCRIPTION_PLANS.find((item) => item.tier === tier);
    if (subscriptionCheckoutBusyTier) return;
    subscriptionCheckoutBusyTier = tier;
    render();
    try {
      return await perform(async () => {
        const response = await api.account.startSubscriptionCheckout({ tier });
        const result = response?.result || response;
        if (response?.snapshot) {
          acceptSnapshot(response.snapshot);
          currentPage = "membership";
          render();
        }
        if (result?.cancelled) {
          toast(
            "Paiement annulé",
            "L’abonnement n’a pas été modifié."
          );
        } else if (result?.checkoutCompleted) {
          toast(
            "Abonnement synchronisé",
            `L’offre ${plan?.name || tier} est maintenant reliée à ShenPulse.`
          );
        } else if (result?.scheduled) {
          toast(
            "Changement programmé",
            "Le changement prendra effet à la prochaine échéance."
          );
        }
        return response;
      });
    } finally {
      subscriptionCheckoutBusyTier = "";
      render();
    }
  }
}

registerActionHandler(CONTENT_COMMERCE_ACTIONS, handleContentAndCommerceAction);
