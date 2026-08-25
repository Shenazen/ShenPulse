"use strict";

/**
 * Navigation des pages et édition des interactions de jeux.
 * Une commande ajoutée ici doit être déclarée dans NAVIGATION_GAME_ACTIONS.
 */

const NAVIGATION_GAME_ACTIONS = new Set([
  "set-actions-section",
  "select-simulator-type",
  "filter-enabled-actions",
  "set-overlay-category",
  "set-sound-category",
  "set-game-filter",
  "open-game",
  "open-minecraft-mode",
  "close-game",
  "add-coin-pusher-tier",
  "remove-coin-pusher-tier",
  "add-coin-pusher-gift-rule",
  "remove-coin-pusher-gift-rule",
  "add-deal-banker-request",
  "remove-deal-banker-request",
  "game-step",
  "dismiss-game-message",
  "dismiss-game-progress",
  "set-game-effect-category",
  "set-game-overlay-background",
  "save-game-round-settings",
  "download-game-interaction-overlay",
  "save-game-interactions",
  "toggle-game-interaction",
  "add-game-interaction",
  "edit-game-interaction",
  "delete-game-interaction",
  "test-game-interaction",
  "create-game-action"
]);

async function handleNavigationAndGameEditorAction({ action, target, id }) {
  if (!NAVIGATION_GAME_ACTIONS.has(action)) return ACTION_NOT_HANDLED;
  if (action === "set-actions-section") {
    actionsSection = target.dataset.value;
    return render();
  }
  if (action === "select-simulator-type") {
    simulatorType = target.dataset.type || "gift";
    return render();
  }
  if (action === "filter-enabled-actions") {
    onlyEnabledActions = target.checked;
    return render();
  }
  if (action === "set-overlay-category") {
    overlayCategory = target.dataset.value;
    return render();
  }
  if (action === "set-sound-category") {
    soundCategory = target.dataset.value;
    return render();
  }
  if (action === "set-game-filter") {
    gameFilter = target.dataset.value;
    return render();
  }
  if (action === "open-game") {
    const pack =
      id === MINECRAFT_LAUNCHER_ID
        ? visibleGamePacks().find(
            (item) => item.id === MINECRAFT_LAUNCHER_ID
          )
        : snapshot.packs.find((item) => item.id === id);
    if (!pack) throw new Error("Jeu introuvable.");
    if (!pack.modeSelector && !canAccessGame(pack)) {
      return toast(
        "Jeu indisponible",
        "Ce jeu est masqué par la configuration ShenPulse.",
        true
      );
    }
    if (
      pack.accessMode === "purchase" &&
      !hasGameEntitlement(pack)
    ) {
      return openGamePurchaseDialog(pack);
    }
    if (showActiveGameConflict(pack)) return;
    if (!requireGameAccess(pack)) return;
    if (pack.modeSelector) return openMinecraftModeSelector(pack);
    await enterGameWorkspace(pack);
    return;
  }
  if (action === "open-minecraft-mode") {
    const pack = snapshot.packs.find(
      (item) => item.id === id && MINECRAFT_MODE_IDS.includes(item.id)
    );
    if (!pack || !canAccessGame(pack)) {
      return toast(
        "Mode Minecraft indisponible",
        "Ce mode est masqué par la configuration ShenPulse.",
        true
      );
    }
    if (showActiveGameConflict(pack)) return;
    if (!requireGameAccess(pack)) return;
    dialog.close();
    await enterGameWorkspace(pack);
    return;
  }
  if (action === "close-game") {
    gamePageMode = "catalog";
    gameEffectSearch = "";
    gameEffectCategory = "all";
    render();
    content.scrollTop = 0;
    return;
  }
  if (
    action === "add-coin-pusher-tier" ||
    action === "remove-coin-pusher-tier" ||
    action === "add-coin-pusher-gift-rule" ||
    action === "remove-coin-pusher-gift-rule"
  ) {
    const form = target.closest("[data-coin-pusher-interactions]");
    const pack = snapshot.packs.find((item) => item.id === "coin-pusher");
    if (!form || !pack || !requireGameAccess(pack)) return;
    if (action === "add-coin-pusher-tier") {
      const list = form.querySelector("[data-coin-pusher-tier-list]");
      const rows = [...list.querySelectorAll("[data-coin-pusher-tier-row]")];
      if (rows.length >= 20) return;
      const usedValues = new Set(
        rows.map((row) => Number(row.querySelector('[name="coinPusherTierDiamonds"]')?.value))
      );
      const suggested = [5, 25, 50, 250, 500, 2500, 10000].find(
        (value) => !usedValues.has(value)
      ) || Math.max(2, ...usedValues) + 1;
      list.insertAdjacentHTML(
        "beforeend",
        renderCoinPusherTierRow({ diamonds: suggested, coinCount: 1 })
      );
      list.lastElementChild
        ?.querySelector('[name="coinPusherTierDiamonds"]')
        ?.focus();
      target.disabled = rows.length + 1 >= 20;
      return;
    }
    if (action === "remove-coin-pusher-tier") {
      const row = target.closest("[data-coin-pusher-tier-row]");
      const value = Number(
        row?.querySelector('[name="coinPusherTierDiamonds"]')?.value
      );
      if (value === 1) {
        return toast(
          "Palier indispensable",
          "Conservez un palier de 1 diamant pour calculer toutes les valeurs.",
          true
        );
      }
      row?.remove();
      const addButton = form.querySelector('[data-action="add-coin-pusher-tier"]');
      if (addButton) addButton.disabled = false;
      return;
    }
    if (action === "add-coin-pusher-gift-rule") {
      const list = form.querySelector("[data-coin-pusher-gift-rule-list]");
      const rows = list.querySelectorAll("[data-coin-pusher-gift-rule-row]");
      if (rows.length >= 100) return;
      list.querySelector("[data-coin-pusher-empty-rules]")?.remove();
      list.insertAdjacentHTML("beforeend", renderCoinPusherGiftRuleRow());
      list.lastElementChild
        ?.querySelector('[name="coinPusherGiftRuleName"]')
        ?.focus();
      target.disabled = rows.length + 1 >= 100;
      return;
    }
    target.closest("[data-coin-pusher-gift-rule-row]")?.remove();
    const list = form.querySelector("[data-coin-pusher-gift-rule-list]");
    if (!list.querySelector("[data-coin-pusher-gift-rule-row]")) {
      list.innerHTML = '<div class="coin-pusher-empty-rules" data-coin-pusher-empty-rules><span>＋</span><strong>Aucune exception</strong><small>Tous les cadeaux utilisent actuellement leur valeur.</small></div>';
    }
    const addButton = form.querySelector(
      '[data-action="add-coin-pusher-gift-rule"]'
    );
    if (addButton) addButton.disabled = false;
    return;
  }
  if (
    action === "add-deal-banker-request" ||
    action === "remove-deal-banker-request"
  ) {
    const form = target.closest("[data-integrated-game-settings]");
    const pack = snapshot.packs.find(
      (item) => item.id === "deal-or-no-deal"
    );
    if (!form || !pack || !requireGameAccess(pack)) return;
    await perform(async () => {
      const config = integratedSettingsFromForm(
        "deal-or-no-deal",
        new FormData(form)
      );
      if (action === "add-deal-banker-request") {
        if (config.bankerRequests.length >= 12) return;
        config.bankerRequests.push({
          id: `banker-request-${Date.now()}`,
          type: "cashOffer",
          enabled: true,
          weight: 10,
          amount: 0,
          targetMode: "random",
          forceAfterOpenedCount: 0
        });
      } else {
        const requestIndex = Math.max(
          0,
          Math.round(Number(target.dataset.index) || 0)
        );
        if (config.bankerRequests.length <= 1) return;
        config.bankerRequests.splice(requestIndex, 1);
      }
      snapshot = await api.configureGame(pack.id, config);
      integratedSettingsPanels.set(pack.id, "banker");
      render();
    }, "Demandes du banquier mises à jour");
    return;
  }
  if (action === "game-step") {
    const nextStep = target.dataset.value || "installation";
    const pack = snapshot.packs.find(
      (item) => item.id === selectedGameId
    );
    if (!requireGameAccess(pack)) {
      gamePageMode = "catalog";
      render();
      return;
    }
    if (!gameJourneyFor(pack).some((step) => step.id === nextStep)) {
      return;
    }
    if (nextStep === "interactions") {
      if (pack) {
        const result = await api.initializeGameInteractions(pack.id);
        if (result?.snapshot) acceptSnapshot(result.snapshot);
      }
    }
    gameWorkspaceStep = nextStep;
    render();
    content.scrollTop = 0;
    return;
  }
  if (action === "dismiss-game-message") {
    gamePageMessages.delete(id);
    render();
    return;
  }
  if (action === "dismiss-game-progress") {
    if (gameInstallBusyId) return;
    gameInstallProgress = null;
    render();
    return;
  }
  if (action === "set-game-effect-category") {
    gameEffectCategory = target.dataset.value || "all";
    render();
    return;
  }
  if (action === "set-game-overlay-background") {
    return saveGameInteractionOverlayBackground(
      id,
      target.value || target.dataset.value
    );
  }
  if (action === "save-game-round-settings") {
    const pack = snapshot.packs.find((item) => item.id === id);
    if (showActiveGameConflict(pack)) return;
    if (!requireGameAccess(pack)) return;
    const form = target.closest("[data-minecraft-round-settings]");
    if (!form) return;
    const durationMinutes = Number(
      form.querySelector('[name="durationMinutes"]')?.value || 10
    );
    const autoRestart = Boolean(
      form.querySelector('[name="autoRestart"]')?.checked
    );
    return perform(async () => {
      acceptSnapshot(
        await api.saveGameRoundSettings(id, {
          durationMinutes,
          autoRestart
        })
      );
      render();
    }, "Réglages de partie enregistrés");
  }
  if (action === "download-game-interaction-overlay") {
    const pack = snapshot.packs.find((item) => item.id === id);
    if (
      !(await confirmGameInteractionReadiness(
        pack,
        "de télécharger l’overlay"
      ))
    ) {
      return;
    }
    return perform(
      () => downloadGameInteractionOverlay(
        id,
        Number(target.dataset.model || 1)
      ),
      `Overlay modèle ${Number(target.dataset.model || 1)} téléchargé`
    );
  }
  if (action === "save-game-interactions") {
    return toast(
      "Interactions enregistrées",
      "Chaque modification est sauvegardée automatiquement dans ce profil."
    );
  }
  if (action === "toggle-game-interaction") {
    const packId = target.dataset.pack;
    const pack = snapshot.packs.find((item) => item.id === packId);
    if (!requireGameAccess(pack)) return;
    const rule = gameInteractionRules(packId).find(
      (item) => item.id === target.dataset.rule
    );
    if (!rule) throw new Error("Interaction introuvable.");
    return updateGameInteractionToggle(
      packId,
      rule,
      rule.enabled === false
    );
  }
  if (action === "add-game-interaction") {
    const pack = snapshot.packs.find(
      (item) => item.id === target.dataset.pack
    );
    if (!pack) throw new Error("Jeu introuvable.");
    if (!requireGameAccess(pack)) return;
    return openGameInteractionCatalog(pack);
  }
  if (action === "edit-game-interaction") {
    const pack = snapshot.packs.find(
      (item) => item.id === target.dataset.pack
    );
    const effect = pack?.effects.find(
      (item) => item.id === target.dataset.effect
    );
    if (!pack || !effect) throw new Error("Interaction introuvable.");
    if (!requireGameAccess(pack)) return;
    const row = target.dataset.rule
      ? findGameInteractionRow(
          pack.id,
          target.dataset.rule,
          target.dataset.rowAction,
          target.dataset.index
        )
      : gameMappedEffects(pack).find(
          (item) => item.action.config?.effectId === effect.id
        );
    return openGameInteractionEditor(pack, effect, row);
  }
  if (action === "delete-game-interaction") {
    const packId = target.dataset.pack;
    const pack = snapshot.packs.find((item) => item.id === packId);
    if (!requireGameAccess(pack)) return;
    const rule = gameInteractionRules(packId).find(
      (item) => item.id === target.dataset.rule
    );
    if (!rule) throw new Error("Interaction introuvable.");
    if (
      !(await confirmAction(
        `Supprimer l’interaction « ${rule.gameInteraction?.title || rule.name} » ?`,
        { title: "Supprimer l’interaction", confirmLabel: "Supprimer" }
      ))
    ) {
      return;
    }
    return perform(async () => {
      acceptSnapshot(
        await api.removeGameInteraction(packId, rule.id)
      );
      render();
    }, "Interaction supprimée");
  }
  if (action === "test-game-interaction") {
    const pack = snapshot.packs.find(
      (item) => item.id === target.dataset.pack
    );
    if (!requireGameAccess(pack)) return;
    const row = findGameInteractionRow(
      target.dataset.pack,
      target.dataset.rule,
      target.dataset.rowAction,
      target.dataset.index
    );
    return perform(
      () => testActionRow(row),
      "Interaction de jeu testée"
    );
  }
  if (action === "create-game-action") {
    const pack = snapshot.packs.find(
      (item) => item.id === target.dataset.pack
    );
    const effect = pack?.effects.find((item) => item.id === id);
    if (!pack || !effect) throw new Error("Interaction introuvable.");
    if (!requireGameAccess(pack)) return;
    return openGameInteractionEditor(pack, effect);
  }
}

registerActionHandler(
  NAVIGATION_GAME_ACTIONS,
  handleNavigationAndGameEditorAction
);
