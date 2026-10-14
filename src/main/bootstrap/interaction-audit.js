"use strict";

/** Campagnes de validation manuelle des interactions.
 * Services/fenêtre obtenus à la demande pour conserver le comportement du bootstrap.
 * Aucune campagne ne démarre lors du simple chargement du module.
 */
const fs = require("node:fs");
const path = require("node:path");
const { orderInteractionAuditEffects } = require("../interaction-audit-plan");

function createInteractionAuditRunner({ getCore, getGameRuntime, getIpcController, getWindow, getUserDataDirectory, dialog }) {
  let activeInteractionAudit = null;

  async function startInteractionAuditFromArgs(args = []) {
    const gameArgument = args.find((entry) =>
      String(entry).startsWith("--audit-game=")
    );
    if (!gameArgument || !getCore() || !getIpcController()) return null;
    const gameId = String(gameArgument)
      .slice("--audit-game=".length)
      .trim();
    if (!/^[a-z0-9-]{1,160}$/.test(gameId)) return null;
    const startArgument = args.find((entry) =>
      String(entry).startsWith("--audit-start=")
    );
    const startIndex = Math.max(
      0,
      Number.parseInt(
        String(startArgument || "").slice("--audit-start=".length),
        10
      ) || 0
    );
    const failedOnly = args.some(
      (entry) => String(entry) === "--audit-failed-only"
    );
    return runInteractionAudit(gameId, startIndex, { failedOnly });
  }
  
  async function runInteractionAudit(
    gameId,
    startIndex = 0,
    { failedOnly = false } = {}
  ) {
    if (activeInteractionAudit) {
      if (getWindow() && !getWindow().isDestroyed()) {
        getWindow().show();
        getWindow().focus();
      }
      return activeInteractionAudit;
    }
    activeInteractionAudit = (async () => {
      const pack = getCore().gameHub
        .listPacks()
        .find((entry) => entry.id === gameId);
      if (!pack) throw new Error(`Jeu introuvable : ${gameId}`);
      const allEffects = orderInteractionAuditEffects(
        gameId,
        pack.effects.filter((effect) => effect.available !== false)
      );
      const previousStatus = readInteractionAuditStatus();
      let failures = rememberedInteractionAuditFailures(
        previousStatus,
        gameId
      );
      const failedIds = new Set(
        failures.map((failure) => failure.effectId)
      );
      const effects = allEffects
        .map((step, originalIndex) => ({ ...step, originalIndex }))
        .filter(({ effect, originalIndex }) =>
          failedOnly
            ? failedIds.has(effect.id)
            : originalIndex >= startIndex
        );
      if (!effects.length) {
        throw new Error(
          failedOnly
            ? "Aucune interaction refusée n’est en attente de nouveau test."
            : "Aucune interaction n’est disponible pour cette campagne."
        );
      }
      await getCore().gameHub.prepareConnection(gameId);
      await getCore().startGameSession(gameId);
      const runtimeStatus = getGameRuntime().status(gameId);
      if (runtimeStatus.automated && !runtimeStatus.serverRunning) {
        await getGameRuntime().launch(gameId);
      }
      await waitForInteractionAuditConnection(gameId);
      for (let index = 0; index < effects.length; index += 1) {
        const { effect, preparation, originalIndex } = effects[index];
        const current = failedOnly ? index + 1 : originalIndex + 1;
        const total = failedOnly ? effects.length : allEffects.length;
        writeInteractionAuditStatus({
          status: "waiting",
          phase: failedOnly ? "retest" : "initial",
          gameId,
          gameName: pack.name,
          current,
          total,
          effectId: effect.id,
          effectName: effect.name,
          expectation: effect.description || "",
          preparation,
          failures,
          updatedAt: new Date().toISOString()
        });
        let result;
        try {
          result = await getIpcController().auditGameInteraction(
            gameId,
            effect.id,
            {
              current,
              total,
              expectation: effect.description || "",
              preparation,
              observationDelayMs: interactionAuditDelay(effect)
            }
          );
        } catch (error) {
          if (getWindow() && !getWindow().isDestroyed()) {
            if (getWindow().isMinimized()) getWindow().restore();
            getWindow().show();
            getWindow().focus();
          }
          const executionError = String(error?.message || error);
          const decision = await dialog.showMessageBox(
            getWindow(),
            {
              type: "error",
              title: `Interaction en échec — ${current}/${total}`,
              message: `${effect.name} n’a pas pu être exécutée.`,
              detail: [
                "Erreur renvoyée par le jeu :",
                executionError,
                "",
                "L’échec est mémorisé. Continuez pour tester automatiquement l’interaction suivante."
              ].join("\n"),
              buttons: [
                "Mémoriser et continuer",
                "Arrêter la campagne"
              ],
              defaultId: 0,
              cancelId: 1,
              noLink: true
            }
          );
          result = {
            answer: decision.response === 0 ? "no" : "cancel",
            packId: gameId,
            packName: pack.name,
            effectId: effect.id,
            effectName: effect.name,
            description: effect.description || "",
            expectation: effect.description || "",
            executionError,
            current,
            total
          };
        }
        if (result.answer === "no") {
          failures = [
            ...failures.filter(
              (failure) => failure.effectId !== result.effectId
            ),
            {
              effectId: result.effectId,
              effectName: result.effectName,
              description: result.description,
              expectation: result.expectation,
              originalIndex,
              firstRejectedAt:
                failures.find(
                  (failure) => failure.effectId === result.effectId
                )?.firstRejectedAt || new Date().toISOString(),
              lastRejectedAt: new Date().toISOString()
            }
          ].sort((left, right) => left.originalIndex - right.originalIndex);
        } else if (result.answer === "yes" && failedOnly) {
          failures = failures.filter(
            (failure) => failure.effectId !== result.effectId
          );
        }
        writeInteractionAuditStatus({
          status:
            result.answer === "yes"
              ? "validated"
              : result.answer === "no"
                ? "failed"
                : "canceled",
          phase: failedOnly ? "retest" : "initial",
          ...result,
          failures,
          nextIndex: originalIndex + 1,
          updatedAt: new Date().toISOString()
        });
        if (result.answer === "cancel") return result;
      }
      const completed = {
        status: failures.length ? "repair-needed" : "completed",
        phase: failedOnly ? "retest" : "initial",
        answer: failures.length ? "failures-recorded" : "complete",
        gameId,
        gameName: pack.name,
        current: failedOnly ? effects.length : allEffects.length,
        total: failedOnly ? effects.length : allEffects.length,
        failures,
        updatedAt: new Date().toISOString()
      };
      writeInteractionAuditStatus(completed);
      await dialog.showMessageBox(getWindow(), {
        type: failures.length ? "warning" : "info",
        title: "Campagne terminée",
        message: failures.length
          ? `${failures.length} interaction(s) à réparer`
          : `${completed.total}/${completed.total} interactions validées`,
        detail: failures.length
          ? `Les refus ont été mémorisés. ShenPulse peut maintenant les réparer puis ne rejouer que ces ${failures.length} test(s).`
          : `Toutes les interactions de ${pack.name} ont été confirmées.`,
        buttons: ["Fermer"],
        defaultId: 0,
        noLink: true
      });
      return completed;
    })();
    try {
      return await activeInteractionAudit;
    } catch (error) {
      writeInteractionAuditStatus({
        status: "error",
        gameId,
        error: String(error?.message || error),
        updatedAt: new Date().toISOString()
      });
      await dialog.showMessageBox(getWindow(), {
        type: "error",
        title: "Campagne de test interrompue",
        message: "Impossible de lancer l’interaction.",
        detail: String(error?.message || error),
        buttons: ["Fermer"],
        defaultId: 0,
        noLink: true
      });
      throw error;
    } finally {
      activeInteractionAudit = null;
    }
  }
  
  async function waitForInteractionAuditConnection(
    gameId,
    timeoutMs = 10 * 60 * 1000
  ) {
    const deadline = Date.now() + Math.max(10_000, Number(timeoutMs || 0));
    let lastError = null;
    while (Date.now() < deadline) {
      try {
        return await getCore().gameHub.testConnection(gameId);
      } catch (error) {
        lastError = error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw (
      lastError ||
      new Error(
        "Le jeu ne sâ€™est pas connectÃ© Ã  ShenPulse dans le dÃ©lai prÃ©vu."
      )
    );
  }
  
  function interactionAuditDelay(effect) {
    if (
      [
        "bedrock-blackhole",
        "bedrock-comets",
        "bedrock-longhands",
        "bedrock-glass-prison"
      ].includes(effect.id)
    ) {
      return 12_000;
    }
    if (
      [
        "bedrock-tnt-step",
        "bedrock-tnt-rocket",
        "bedrock-meteor",
        "bedrock-tnt-ring"
      ].includes(effect.id)
    ) {
      return 6_000;
    }
    return 3_500;
  }
  
  function writeInteractionAuditStatus(value) {
    try {
      fs.writeFileSync(
        path.join(getUserDataDirectory(), "interaction-audit-status.json"),
        JSON.stringify(value, null, 2),
        "utf8"
      );
    } catch {
      // La campagne reste utilisable même si son état de reprise ne peut pas être écrit.
    }
  }
  
  function readInteractionAuditStatus() {
    try {
      return JSON.parse(
        fs.readFileSync(
          path.join(getUserDataDirectory(), "interaction-audit-status.json"),
          "utf8"
        )
      );
    } catch {
      return {};
    }
  }
  
  function rememberedInteractionAuditFailures(status, gameId) {
    if (!status || (status.gameId || status.packId) !== gameId) return [];
    const failures = Array.isArray(status.failures)
      ? status.failures.filter((failure) => failure?.effectId)
      : [];
    if (status.answer !== "no" || !status.effectId) return failures;
    if (failures.some((failure) => failure.effectId === status.effectId)) {
      return failures;
    }
    return [
      ...failures,
      {
        effectId: status.effectId,
        effectName: status.effectName || status.effectId,
        description: status.description || "",
        expectation: status.expectation || "",
        originalIndex: Math.max(0, Number(status.current || 1) - 1),
        firstRejectedAt: status.updatedAt || new Date().toISOString(),
        lastRejectedAt: status.updatedAt || new Date().toISOString()
      }
    ];
  }

  return { startInteractionAuditFromArgs, runInteractionAudit };
}

module.exports = { createInteractionAuditRunner };
