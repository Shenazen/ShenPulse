"use strict";

/** Relie les services au noyau ; callbacks explicites, aucun accès aux champs privés.
 * Ce module ne démarre aucun connecteur : il installe les abonnements une fois.
 */
const { serializeError } = require("../utils");
const { readState } = require("../state-projection");
const { isMinecraftRoundGame } = require("../game-round-timer");
const { synchronizeSessionWithTikTok } = require("./session-state");
const { recordLiveAudience } = require("./event-statistics");

function bindCoreEvents({ minecraftRoundTimer, timerScheduler, sourceHub, ruleEngine, gameHub, store, overlayCompletionController, overlayServer, matches, notifyRenderer, onActivity, onChanged, onGameBridgeMessage, ingest, handleKickStatus, refreshGiftCatalog }) {
  minecraftRoundTimer.on("started", ({ packId, durationSeconds }) => {
    const pack = gameHub
      .listPacks()
      .find((entry) => entry.id === packId);
    onActivity(
      "success",
      "game",
      `Chrono ${pack?.name || "Minecraft"} démarré`,
      `${Math.round(durationSeconds / 60)} minute${
        durationSeconds > 60 ? "s" : ""
      } avant TIME OUT.`
    );
    onChanged();
  });
  minecraftRoundTimer.on(
    "timeout",
    ({ packId, appliedAmount, currentWins, autoRestart }) => {
      const pack = gameHub
        .listPacks()
        .find((entry) => entry.id === packId);
      onActivity(
        "warning",
        "game",
        `TIME OUT ${pack?.name || "Minecraft"}`,
        `${appliedAmount} WIN${
          Math.abs(appliedAmount) === 1 ? "" : "S"
        } · total ${currentWins}${
          autoRestart ? " · nouveau chrono démarré" : ""
        }`
      );
      notifyRenderer("game-round-timeout", {
        packId,
        appliedAmount,
        currentWins,
        autoRestart
      });
      onChanged();
    }
  );
  minecraftRoundTimer.on("error", ({ error }) => {
    onActivity(
      "error",
      "game",
      "Erreur du chrono Minecraft",
      serializeError(error).message
    );
    onChanged();
  });
  timerScheduler.on("fired", (entry) => {
    onActivity(
      "success",
      "timer",
      `Timer exécuté : ${entry.timerName}`,
      `${entry.actionCount} action(s) × ${entry.repeatCount}`
    );
    onChanged(true);
  });
  timerScheduler.on("runtime-changed", () => onChanged());
  timerScheduler.on("error", ({ timer, error }) => {
    onActivity(
      "error",
      "timer",
      timer?.name
        ? `Échec du timer : ${timer.name}`
        : "Échec du planificateur",
      error.message
    );
    onChanged();
  });
  sourceHub.on("event", (event) => {
    ingest(event, event.source).catch((error) =>
      onActivity("error", "source", "Événement rejeté", error.message)
    );
  });
  sourceHub.on("match-event", (event) => {
    try { matches?.handle(event); }
    catch { onActivity("warning", "matches", "Événement de match indisponible", "Les autres interactions LIVE restent actives."); }
  });
  sourceHub.on("status", ({ connectionId, status, error }) => {
    onActivity(
      status === "error" ? "error" : "info",
      "connection",
      `${connectionId} : ${status}`,
      error
    );
    onChanged();
  });
  sourceHub.on("diagnostic", (entry) =>
    onActivity(entry.level, "connection", entry.source, entry.message)
  );
  sourceHub.on("kick-status", (status) => handleKickStatus(status));
  sourceHub.on("chat-capabilities", () => {
    // Un changement de droits relance le calcul des timers, sans redémarrer le LIVE.
    onChanged();
    notifyRenderer("chat-transport-changed", {});
  });
  // Les audiences sont des mises à jour runtime, pas de nouvelles sessions ni entrées du journal.
  sourceHub.on("tiktok-live-metadata", ({ currentViewers } = {}) => {
    store.mutateRuntime((state) => recordLiveAudience(state, "tiktok", currentViewers));
    onChanged(true);
  });
  sourceHub.on("tiktok-status", ({ status, username, roomId }) => {
    if (["disconnected", "error", "offline"].includes(status)) matches?.disconnect?.();
    let sessionTransition = "";
    if (["disconnected", "error", "live", "offline"].includes(status)) {
      store.mutateRuntime((state) => {
        sessionTransition = synchronizeSessionWithTikTok(state, status, {
          roomId
        });
      });
    }
    const labels = {
      live: "Compte TikTok en LIVE",
      offline: "Compte TikTok hors ligne",
      checking: "Vérification du LIVE TikTok",
      disconnected: "Détection TikTok arrêtée",
      error: "Connexion TikTok en erreur"
    };
    onActivity(
      status === "error" ? "error" : status === "live" ? "success" : "info",
      "tiktok",
      labels[status] || "État TikTok mis à jour",
      `@${username || "inconnu"}${roomId ? ` · salle ${roomId}` : ""}`
    );
    if (sessionTransition === "started") {
      refreshGiftCatalog({ force: true })
        .then(() => onChanged(true))
        .catch(() => {
          // Le catalogue fusionné local et les cadeaux appris restent disponibles.
        });
      overlayCompletionController.stop();
      overlayServer.publish(
        "session-state",
        readState(store, ["overlaySession"]).overlaySession
      );
      onActivity(
        "success",
        "session",
        "Session démarrée automatiquement",
        `LIVE TikTok détecté pour @${username || "inconnu"}`
      );
      overlayCompletionController
        .startConfiguredTimer("tiktok-session-start")
        .catch((error) =>
          onActivity(
            "error",
            "overlay",
            "Démarrage automatique du timer impossible",
            serializeError(error).message
          )
        );
    } else if (sessionTransition === "resumed") {
      refreshGiftCatalog()
        .then(() => onChanged(true))
        .catch(() => {
          // La reprise du LIVE ne dépend pas du rafraîchissement du catalogue.
        });
      overlayServer.publish(
        "session-state",
        readState(store, ["overlaySession"]).overlaySession
      );
      onActivity(
        "success",
        "session",
        "Session TikTok reprise",
        `Même LIVE détecté pour @${username || "inconnu"} : compteurs, classements et timers conservés.`
      );
    } else if (sessionTransition === "interrupted") {
      onActivity(
        "warning",
        "session",
        "Connexion au LIVE interrompue",
        `Reconnexion en cours pour @${username || "inconnu"} : les données du LIVE restent intactes.`
      );
    }
    onChanged();
  });
  ruleEngine.on("rule-fired", ({ rule, event }) => {
    onActivity(
      "success",
      "rule",
      rule.name,
      `${event.type} de ${event.user?.displayName || "viewer"}`
    );
  });
  ruleEngine.on("action-result", ({ ok, action, error, result }) => {
    store.mutateRuntime((state) => {
      if (ok) {
        if (state.session.running) {
          state.statistics.sessionActions += 1;
        }
        state.statistics.lifetimeActions += 1;
      }
    });
    if (!ok) {
      onActivity("error", "action", action.type, serializeError(error).message);
    } else if (result?.partial) {
      const failures = Array.isArray(result.failures) ? result.failures : [];
      const detail = failures
        .map((failure) =>
          `${failure.actionName || failure.actionId || "Action"} : ${
            failure.message || "erreur inconnue"
          }`
        )
        .join(" · ");
      onActivity(
        "warning",
        "action",
        "Groupe partiellement exécuté",
        detail || `${Number(result.failed || 0)} sous-action(s) en erreur`
      );
    }
    onChanged(true);
  });
  gameHub.on("effect-start", ({ pack, effect, payload: effectPayload, context }) => {
    const payload = {
      packId: pack.id,
      effectName: effect.name,
      effectId: effect.id,
      quantity: Math.max(1, Number(effectPayload?.effect?.quantity || 1)),
      duration: Math.max(0, Number(effectPayload?.effect?.duration || 0)),
      parameters: { ...(effectPayload?.effect?.parameters || {}) },
      viewer: context.user?.displayName || "Viewer",
      status: "running"
    };
    overlayServer.publish("game", payload);
    notifyRenderer("game-effect", payload);
  });
  gameHub.on("effect-result", ({ pack }) => {
    if (!isMinecraftRoundGame(pack?.id)) return;
    minecraftRoundTimer
      .cancelNativeRoundIfStopped(pack.id)
      .catch(() => {});
  });
  gameHub.on("bridge-message", ({ pack, message }) => {
    onGameBridgeMessage(pack, message).catch((error) => {
      onActivity(
        "error",
        "game",
        "Compteur WINS non synchronisé",
        serializeError(error).message
      );
    });
  });
}

module.exports = { bindCoreEvents };
