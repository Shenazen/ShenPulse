"use strict";

/**
 * Entités génériques, installation et exécution des jeux.
 * Une commande ajoutée ici doit être déclarée dans ENTITY_GAME_ACTIONS.
 */

const ENTITY_GAME_ACTIONS = new Set([
  "test-event",
  "copy",
  "open-url",
  "restart-servers",
  "rotate-public-overlay-urls",
  "add-rule",
  "edit-rule",
  "run-rule",
  "toggle-rule",
  "add-goal",
  "edit-goal",
  "toggle-goal",
  "reset-goal",
  "add-command",
  "edit-command",
  "toggle-command",
  "add-connection",
  "edit-connection",
  "start-connection",
  "stop-connection",
  "select-game",
  "configure-game",
  "install-game",
  "launch-game",
  "start-game-session",
  "stop-game-session",
  "test-game",
  "trigger-effect",
  "test-obs",
  "export-data",
  "import-data",
  "clear-data",
  "delete-entity"
]);

async function handleEntityAndGameRuntimeAction({ action, target, id }) {
  if (!ENTITY_GAME_ACTIONS.has(action)) return ACTION_NOT_HANDLED;
  if (action === "test-event") return perform(() => api.testEvent(target.dataset.type), "Événement de test envoyé");
  if (action === "copy") {
    return perform(async () => {
      await api.copy(target.dataset.value);
      if (target.dataset.mediaScreenUrl === "true") {
        rememberCopiedMediaScreenUrl(target.dataset.value);
        render();
      }
    }, "URL copiée");
  }
  if (action === "open-url") return perform(() => api.openExternal(target.dataset.value));
  if (action === "restart-servers") return perform(async () => { await api.restartServers(); snapshot = await api.getSnapshot(); render(); }, "Services redémarrés");
  if (action === "rotate-public-overlay-urls") {
    if (
      !(await confirmAction(
        "Régénérer toutes les URL publiques ? Les anciennes sources TikTok LIVE Studio et OBS ne recevront plus aucun événement.",
        { title: "Régénérer les URL", confirmLabel: "Régénérer" }
      ))
    ) {
      return;
    }
    return perform(async () => {
      const result = await api.rotatePublicOverlayUrls();
      acceptSnapshot(result.snapshot);
      render();
    }, "Nouvelles URL publiques générées");
  }
  if (action === "add-rule") return openRuleEditor();
  if (action === "edit-rule") return openRuleEditor(snapshot.state.rules.find((item) => item.id === id));
  if (action === "run-rule") return perform(() => api.testRule(id), "Règle testée précisément");
  if (action === "toggle-rule") return updateToggle("rules", id, target.checked);
  if (action === "add-goal") return openGoalEditor();
  if (action === "edit-goal") return openGoalEditor(snapshot.state.goals.find((item) => item.id === id));
  if (action === "toggle-goal") return updateToggle("goals", id, target.checked);
  if (action === "reset-goal") {
    const goal = snapshot.state.goals.find((item) => item.id === id);
    return perform(async () => { await api.upsert("goals", { ...goal, current: 0 }); snapshot = await api.getSnapshot(); render(); }, "Objectif réinitialisé");
  }
  if (action === "add-command") return openCommandEditor();
  if (action === "edit-command") return openCommandEditor(snapshot.state.commands.find((item) => item.id === id));
  if (action === "toggle-command") return updateToggle("commands", id, target.checked);
  if (action === "add-connection") return openConnectionEditor();
  if (action === "edit-connection") {
    if (id === "source_tiktok") return openTikTokEditor();
    return openConnectionEditor(
      snapshot.state.connections.find((item) => item.id === id)
    );
  }
  if (action === "start-connection") return perform(async () => { await api.startConnection(id); snapshot = await api.getSnapshot(); render(); }, "Connexion lancée");
  if (action === "stop-connection") return perform(async () => { await api.stopConnection(id); snapshot = await api.getSnapshot(); render(); }, "Connexion arrêtée");
  if (action === "select-game") {
    const pack = snapshot.packs.find((item) => item.id === id);
    if (showActiveGameConflict(pack)) return;
    if (!requireGameAccess(pack)) return;
    return perform(async () => {
    selectedGameId = id;
    await api.selectGame(id);
    snapshot = await api.getSnapshot();
    render();
    });
  }
  if (action === "configure-game") {
    const pack = snapshot.packs.find((item) => item.id === id);
    if (showActiveGameConflict(pack)) return;
    if (!requireGameAccess(pack)) return;
    return openGameConfig(pack);
  }
  if (action === "install-game") {
    const pack = snapshot.packs.find((item) => item.id === id);
    if (showActiveGameConflict(pack)) return;
    if (!requireGameAccess(pack)) return;
    gamePageMessages.delete(id);
    gameInstallBusyId = id;
    const startedAt = new Date().toISOString();
    const operation = snapshot.state.game.installations?.[id]
      ? "repair"
      : "install";
    gameInstallProgress = {
      open: true,
      gameId: id,
      operation,
      phase: "prepare",
      percent: 2,
      startedAt,
      lastActivityAt: startedAt,
      message: "ShenPulse recherche votre jeu."
    };
    render();
    try {
      const result = await api.installGame(id);
      if (result?.canceled) {
        gameInstallProgress = null;
        return result;
      }
      acceptSnapshot(await api.getSnapshot());
      gameInstallProgress = {
        ...(gameInstallProgress || {}),
        open: true,
        gameId: id,
        gameTitle:
          snapshot.packs.find((item) => item.id === id)?.name || "Le jeu",
        phase: "complete",
        percent: 100
      };
      gamePageMessages.set(id, {
        type: "success",
        scope: "installation",
        title: "Installation terminée",
        detail: "Le jeu est prêt. Vous pouvez passer aux interactions."
      });
      return result;
    } catch (error) {
      gameInstallProgress = {
        ...(gameInstallProgress || {}),
        open: true,
        gameId: id,
        operation,
        phase: "error",
        indeterminate: false,
        message:
          error.message ||
          "Vérifiez que le jeu est fermé puis réessayez."
      };
      gamePageMessages.set(id, {
        type: "error",
        scope: "installation",
        title: "L’installation n’a pas pu se terminer",
        detail:
          error.message ||
          "Vérifiez que le jeu est fermé puis réessayez."
      });
      return null;
    } finally {
      gameInstallBusyId = "";
      render();
    }
  }
  if (action === "launch-game") {
    if (gameLaunchBusyId) return;
    const pack = snapshot.packs.find((item) => item.id === id);
    if (showActiveGameConflict(pack)) return;
    if (!requireGameAccess(pack)) return;
    if (
      !(await confirmGameInteractionReadiness(
        pack,
        "de lancer le jeu et son serveur"
      ))
    ) {
      return;
    }
    gamePageMessages.delete(id);
    gameLaunchBusyId = id;
    if (MINECRAFT_MODE_IDS.includes(id)) {
      gameLaunchProgress = {
        open: true,
        gameId: id,
        startedAt: Date.now()
      };
    }
    render();
    try {
      const result = await api.launchGame(id);
      if (result?.snapshot) acceptSnapshot(result.snapshot);
      gamePageMessages.set(id, {
        type: "success",
        scope: "launch",
        title: "Le jeu a été lancé",
        detail: "Chargez votre partie : ShenPulse s’occupe du reste."
      });
      toast("Jeu lancé");
      return result;
    } catch (error) {
      gamePageMessages.set(id, {
        type: "error",
        scope: "launch",
        title: "Le jeu n’a pas pu démarrer",
        detail:
          error.message ||
          "Revenez à l’installation puis essayez à nouveau."
      });
      toast("Démarrage impossible", error.message || String(error), true);
      return null;
    } finally {
      if (gameLaunchBusyId === id) gameLaunchBusyId = "";
      if (gameLaunchProgress?.gameId === id) gameLaunchProgress = null;
      render();
    }
  }
  if (action === "start-game-session") {
    const pack = snapshot.packs.find((item) => item.id === id);
    if (showActiveGameConflict(pack)) return;
    if (!requireGameAccess(pack)) return;
    if (
      !(await confirmGameInteractionReadiness(
        pack,
        "d’activer la session de jeu"
      ))
    ) {
      return;
    }
    return perform(async () => {
      acceptSnapshot(await api.startGameSession(id));
      render();
    }, "Session de jeu activée");
  }
  if (action === "stop-game-session") {
    return perform(async () => {
      acceptSnapshot(await api.stopGameSession());
      render();
    }, "Session de jeu arrêtée");
  }
  if (action === "test-game") {
    const pack = snapshot.packs.find((item) => item.id === id);
    if (!requireGameAccess(pack)) return;
    return perform(
      () => api.testGame(id),
      "Passerelle de jeu opérationnelle"
    );
  }
  if (action === "trigger-effect") {
    const packId = target.dataset.pack ||
      snapshot.state.session.activeGamePackId;
    const pack = snapshot.packs.find((item) => item.id === packId);
    if (!requireGameAccess(pack)) return;
    return perform(async () => {
      if (packId && snapshot.state.session.activeGamePackId !== packId) {
        await api.selectGame(packId);
        snapshot = await api.getSnapshot();
      }
      return api.triggerEffect(id, {});
    }, "Effet déclenché");
  }
  if (action === "test-obs") return perform(() => api.testObs(), "OBS WebSocket connecté");
  if (action === "export-data") return perform(() => api.exportData(), "Export terminé");
  if (action === "import-data") return perform(async () => { const result = await api.importData(); if (!result.canceled) { snapshot = result.snapshot; render(); } }, "Import terminé");
  if (action === "clear-data") {
    if (
      !(await confirmAction(
        "Effacer définitivement la configuration, les secrets et le journal local ?",
        { title: "Effacer les données locales", confirmLabel: "Tout effacer" }
      ))
    ) {
      return;
    }
    return perform(async () => { snapshot = await api.clearData(); render(); }, "Données locales effacées");
  }
  if (action === "delete-entity") {
    if (
      !(await confirmAction("Supprimer cet élément ?", {
        title: "Supprimer l’élément",
        confirmLabel: "Supprimer"
      }))
    ) {
      return;
    }
    return perform(async () => { await api.remove(target.dataset.collection, id); snapshot = await api.getSnapshot(); render(); }, "Élément supprimé");
  }
}

registerActionHandler(ENTITY_GAME_ACTIONS, handleEntityAndGameRuntimeAction);
