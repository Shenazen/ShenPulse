"use strict";

/** Contrôleur de roue : file FIFO, résultat et actions différées.
 * Chaque ActionRunner possède sa file ; aucune action LIVE ne change d’ordre.
 */
const { readState } = require("../state-projection");
const { activeGameInteractionRules } = require("../rule-engine");
const { renderValue } = require("../template");
const { COMMAND_WHEEL_RESPIN } = require("../commands/context-guard");
const { selectRuntimeWheel } = require("./wheel-selection");

function normalizeWheelRuntimeSettings(settings = {}, design = "classic") {
  const referenceDefaults = {
    font: "Kalam",
    fontSize: 50,
    textOrientation: "horizontal",
    textColor: "#fff8ec",
    textShadowColor: "#2b170c",
    textShadowStrength: 55,
    textRadius: 100,
    textSegmentOffset: 0,
    textBoxWidth: 100,
    textBoxHeight: 240,
    textAngleOffset: 0,
    textAlign: "center",
    textClamp: false,
    textMaxLines: 4,
    lineSpacing: 50,
    letterSpacing: 50,
    showBase: true,
    soundActive: true,
    announceDuration: 0,
    spinDuration: 5,
    waitDuration: 3,
    scale: 100,
    glow: 82,
    showWinner: true,
    pointerPosition: "top",
    alwaysVisible: true,
    entranceAnimation: "fade",
    exitAnimation: "fade",
    resultDuration: 4
  };
  const usesRegressedDefaults =
    settings.font === "Inter" &&
    Number(settings.fontSize) === 19 &&
    settings.textOrientation === "radial" &&
    Number(settings.textRadius) === 34 &&
    Number(settings.textBoxHeight) === 42;
  const overrides = usesRegressedDefaults
    ? design === "royal"
      ? {
          font: "Georgia",
          textColor: "#fff5cb",
          glow: 100,
          spinDuration: 7
        }
      : {}
    : settings;
  return { ...referenceDefaults, ...overrides, announceDuration: 0 };
}

class WheelActionController {
  constructor({ store, overlayServer, setTimeoutImpl, runAction }) {
    Object.assign(this, { store, overlayServer, setTimeoutImpl, runAction });
    this.wheelSpinActive = false;
    this.wheelSpinQueue = [];
  }

  async spin(action, config, context) {
    const wheelConfig =
      readState(this.store, ["settings.overlayConfigs.wheel"]).settings?.overlayConfigs?.wheel || {};
    const configuredWheels = Array.isArray(wheelConfig.wheels)
      ? wheelConfig.wheels
      : [];
    const selectedWheel = selectRuntimeWheel(wheelConfig, config);
    if (configuredWheels.length && !selectedWheel) {
      throw new Error("Aucune roue active n’est disponible.");
    }
    if (this.wheelSpinActive) {
      // Les commandes peuvent arriver de nombreux viewers différents. Leur
      // file d'effets ne doit pas croître au-delà de la borne du moteur LIVE.
      if (typeof context.shouldExecute === "function" && this.wheelSpinQueue.length >= 50) {
        return { skipped: true, reason: "wheel-command-queue-full" };
      }
      this.wheelSpinQueue.push({ action, context });
      return {
        queued: true,
        queuePosition: this.wheelSpinQueue.length,
        wheelId: config.wheelId || selectedWheel?.id || ""
      };
    }
    this.wheelSpinActive = true;
    const overrideChoices = Array.isArray(config.choices)
      ? config.choices.filter(Boolean).slice(0, 100)
      : [];
    const configuredSegments = Array.isArray(selectedWheel?.segments)
      ? selectedWheel.segments.slice(0, 100)
      : [];
    const segments =
      overrideChoices.length >= 2
        ? overrideChoices.map((label, index) => ({
            id: `temporary_${index}`,
            label,
            color:
              selectedWheel?.segments?.[index]?.color ||
              config.color ||
              "#ff6a00",
            action: "none",
            actionId: ""
          }))
        : configuredSegments.length >= 2
          ? configuredSegments
          : [
              { id: "bonus", label: "Bonus", color: "#ff6a00" },
              { id: "challenge", label: "Défi", color: "#111111" }
            ];
    const winnerIndex = Math.floor(Math.random() * segments.length);
    const winnerSegment = segments[winnerIndex] || null;
    const winnerAction =
      winnerSegment?.action === "spin"
        ? "spin"
        : winnerSegment?.actionId
          ? "action"
          : winnerSegment?.action || "none";
    const choices = segments.map((segment) => segment.label);
    const payload = {
      wheelId: selectedWheel?.id || "",
      wheelName: selectedWheel?.name || "Roue d’actions",
      choices,
      colors: segments.map(
        (segment) => segment.color || config.color || "#ff6a00"
      ),
      winner: winnerSegment?.label || null,
      winnerIndex,
      winnerAction,
      design: selectedWheel?.design || wheelConfig.design || "classic",
      settings: normalizeWheelRuntimeSettings(
        {
          ...(wheelConfig || {}),
          ...(selectedWheel?.settings || {})
        },
        selectedWheel?.design || wheelConfig.design || "classic"
      ),
      color: config.color || "#ff6a00"
    };
    let linkedAction = null;
    const commandFlow = typeof context.resolveCommandActions === "function";
    if (winnerAction === "action" && winnerSegment.actionId) {
      if (commandFlow) {
        try {
          linkedAction = context.resolveCommandActions([winnerSegment.actionId])[0]?.[1]?.action || null;
          if (!linkedAction) throw Object.assign(new Error("Action de secteur indisponible."), { code: "COMMAND_TARGET_MISSING" });
          context.assertActionAllowed?.({ ...linkedAction, config: renderValue(linkedAction.config || {}, context) }, context);
        } catch (error) {
          // Le tirage reste visible, mais une ancienne liaison désactivée ou
          // hors profil ne remet jamais une prise/un effet en service.
          linkedAction = null;
          payload.effectSkipped = true;
          payload.partial = true;
          payload.effectReason = /^COMMAND_[A-Z_]+$/.test(error?.code || "") ? error.code : "COMMAND_EXECUTION_FAILED";
        }
      } else {
        const state = this.store.getRuleEngineState?.() || readState(this.store, ["rules", "session.game", "session.profileId", "game.interactionRulesByPack"]);
        linkedAction = [...(state.rules || []), ...activeGameInteractionRules(state)]
          .flatMap((rule) => rule.actions || []).find((item) => item.id === winnerSegment.actionId) || null;
      }
    }
    this.overlayServer.publish("wheel", payload);
    const resultDelayMs =
      (
        Math.min(
          30,
          Math.max(1, Number(payload.settings.spinDuration || 6))
        ) +
        Math.max(0, Number(payload.settings.waitDuration || 0))
      ) * 1000;
    if (linkedAction && linkedAction.id !== action.id) {
      const hydratedLinkedAction = { ...linkedAction, config: renderValue(linkedAction.config || {}, context) };
      const actionTimer = this.setTimeoutImpl(() => {
        this.runWinnerAction(hydratedLinkedAction, context, commandFlow).catch(() => {});
      }, resultDelayMs);
      actionTimer.unref?.();
    }
    if (
      winnerSegment?.action === "spin" &&
      Number(config.reSpinDepth || 0) < 3
    ) {
      const reSpin = this.setTimeoutImpl(() => {
        this.runAction(
          {
            ...action,
            config: {
              ...config,
              wheelId: selectedWheel?.id || config.wheelId,
              reSpinDepth: Number(config.reSpinDepth || 0) + 1
            }
          },
          { ...context, [COMMAND_WHEEL_RESPIN]: {
            rootActionId: action.id, depth: Number(config.reSpinDepth || 0) + 1,
            wheelId: selectedWheel?.id || config.wheelId
          } }
        ).catch(() => {});
      }, resultDelayMs);
      reSpin.unref?.();
    }
    const cycleDelayMs =
      resultDelayMs +
      Math.min(
        30,
        Math.max(1, Number(payload.settings.resultDuration || 4))
      ) * 1000 +
      700;
    const queueTimer = this.setTimeoutImpl(() => {
      this.wheelSpinActive = false;
      const nextSpin = this.wheelSpinQueue.shift();
      if (nextSpin) {
        this.runAction(nextSpin.action, nextSpin.context).catch(() => {});
      }
    }, cycleDelayMs);
    queueTimer.unref?.();
    return payload;
  }

  /** Revalide une liaison différée avant tout effet ; seule une catégorie
   * locale est envoyée au journal, jamais le texte d'une erreur fournisseur. */
  async runWinnerAction(action, context, commandFlow) {
    try {
      if (commandFlow) context.resolveCommandActions([action.id]);
      const result = await this.runAction(action, context);
      if (commandFlow && result?.partial === true && !result?.skipped) {
        context.onDeferredActionResult?.({ executed: true, partial: true,
          reason: "COMMAND_WHEEL_EFFECT_PARTIAL",
          description: "L’action du secteur gagnant de la roue n’a été exécutée qu’en partie." });
      }
      if (!result?.skipped) return;
      throw Object.assign(new Error("Effet de secteur ignoré."), { code: "COMMAND_WHEEL_EFFECT_SKIPPED" });
    } catch (error) {
      if (!commandFlow) return;
      context.onDeferredActionResult?.({ executed: false,
        reason: /^COMMAND_[A-Z_]+$/.test(error?.code || "") ? error.code : "COMMAND_EXECUTION_FAILED",
        description: "L’action du secteur gagnant de la roue n’a pas été exécutée : elle est indisponible ou a changé." });
    }
  }
}

module.exports = { WheelActionController, normalizeWheelRuntimeSettings };
