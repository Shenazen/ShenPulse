"use strict";

/** Actions issues des événements LIVE : commandes, roues et compteurs natifs.
 * Les cartes cadeaux sont consultées au moment du déclenchement, sans cache périmé.
 */
const { readState } = require("../state-projection");
const { readMontChiliadCounterEvent } = require("./game-counter-events");
const { wheelGiftTriggerMatches } = require("./trigger-policy");
const { giftEventCount, giftExecutionEvent } = require("../rule-engine");
const { ChatbotService } = require("../chatbot-service");
const { CommandExecutor } = require("../commands/executor");

class LiveEventActionService {
  constructor({ store, sourceHub, overlayServer, actionRunner, giftCatalog, commandCooldowns, gameCounterCursors, onActivity, onChanged }) {
    this.store = store;
    this.sourceHub = sourceHub;
    this.overlayServer = overlayServer;
    this.actionRunner = actionRunner;
    this.giftCatalog = giftCatalog;
    this.commandCooldowns = commandCooldowns;
    this.gameCounterCursors = gameCounterCursors;
    this.onActivity = onActivity;
    this.onChanged = onChanged;
    this.commandExecutor = new CommandExecutor({ store, actionRunner });
    this.chatbot = new ChatbotService({ store, sourceHub, overlayServer, commandExecutor: this.commandExecutor, functionalOnly: true,
      cooldowns: commandCooldowns, onActivity, onChanged });
  }

  async handleGameBridgeMessage(pack, message) {
    if(require('./gta-round-events').synchronizeGtaRoundState(this.store,pack,message))this.onChanged(true);
    const counterEvent = readMontChiliadCounterEvent(
      pack,
      message,
      this.gameCounterCursors
    );
    if (!counterEvent) return;
    if(["gtav-koth-enhanced","gtav-hiking-enhanced"].includes(pack.id)){
      const session=readState(this.store,["session.game"]).session?.game;
      if(!session?.running||session.packId!==pack.id)return;
    }
    const previous = Number(
      readState(this.store, ["overlaySession.winCounterCurrent"]).overlaySession?.winCounterCurrent
    );
    const result = await this.actionRunner.run(
      {
        id: `native_counter_${counterEvent.sessionId}_${counterEvent.eventId}`,
        type: "overlay.win-counter",
        config: {
          packId: pack.id,
          effectId: `native_${counterEvent.eventName}`,
          operation: "adjust",
          amount: counterEvent.amount
        }
      },
      {
        source: "gtav-native",
        user: {
          id: "gtav",
          name: "gtav",
          displayName: pack.name || "GTA V"
        }
      }
    );
    const current = Number(result?.current);
    const applied =
      Number.isFinite(previous) && Number.isFinite(current)
        ? current - previous
        : counterEvent.amount;
    this.onActivity(
      "success",
      "game",
      counterEvent.eventName === "win"
        ? (pack.id==="gtav-koth-enhanced"?"Victoire KOTH":pack.id==="gtav-hiking-enhanced"?"Victoire Hiking":"Victoire Mont Chiliad")
        : counterEvent.eventName === "timeout" ? "Temps écoulé GTA" : counterEvent.eventName === "fall" ? "Chute hors de la rampe KOTH" : "Mort dans GTA V",
      `${applied > 0 ? "+" : ""}${applied} WIN${
        Math.abs(applied) === 1 ? "" : "S"
      }${Number.isFinite(current) ? ` · total ${current}` : ""}`
    );
    this.onChanged(true);
  }

  async handleCommand(event) {
    return this.chatbot.handleChat(event);
  }

  async handleWheelGiftTriggers(event) {
    if (event.type !== "gift") return;
    const wheelConfig =
      readState(this.store, ["settings.overlayConfigs.wheel"]).settings?.overlayConfigs?.wheel || {};
    const wheels = Array.isArray(wheelConfig.wheels)
      ? wheelConfig.wheels
      : [];
    const matchingWheels = wheels.filter((wheel) => {
      return wheelGiftTriggerMatches(
        wheel,
        event,
        this.giftCatalog.gifts
      );
    });
    const deliveryCount = giftEventCount(event);
    for (let index = 0; index < deliveryCount; index += 1) {
      const deliveryEvent = giftExecutionEvent(
        event,
        index,
        deliveryCount,
        1
      );
      await Promise.all(
        matchingWheels.map((wheel) =>
          this.actionRunner.run(
            {
              id: `wheel_trigger_${wheel.id}`,
              type: "wheel.spin",
              config: { wheelId: wheel.id }
            },
            deliveryEvent
          )
        )
      );
    }
  }

}

module.exports = { LiveEventActionService };
