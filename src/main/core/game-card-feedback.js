"use strict";

const {
  gamePackOverlayTrigger,
  linkedGamePackOverlayTriggers,
  STATE_PATHS
} = require("../../shared/game-pack-overlay");
const { readState } = require("../state-projection");

/** Le cadeau est mis en valeur au départ de l'action, jamais à sa fin. */
function bindGameCardFeedback({ ruleEngine, store, overlayServer }) {
  const linkedReactions = new WeakMap();
  function publishCardFeedback({ action, rule, event }) {
    const profileId = readState(store, ["session.profileId"]).session?.profileId;
    const trigger = gamePackOverlayTrigger({ started: true, action, rule, event, profileId });
    if (trigger) {
      overlayServer.publish("game-pack-trigger", {
        ...trigger,
        ...(event?.id ? { eventKey: String(event.id).slice(0, 220) } : {})
      });
      return;
    }
    if (!rule || !event || typeof event !== "object") return;
    let fired = linkedReactions.get(event);
    if (!fired) {
      fired = new Set();
      linkedReactions.set(event, fired);
    }
    if (fired.has(rule.id)) return;
    fired.add(rule.id);
    const selections = readState(store, ["settings.overlayConfigs.gameInteractionOverlays"])
      .settings?.overlayConfigs?.gameInteractionOverlays || {};
    if (!Object.values(selections).some(config =>
      config.linkedActionsEnabled === true && config.linkedRuleIds?.includes(rule.id)
    )) return;
    for (const payload of linkedGamePackOverlayTriggers({
      started: true, rule, event, profileId, state: readState(store, STATE_PATHS)
    })) overlayServer.publish("game-pack-trigger", payload);
  }
  ruleEngine.on("action-start", payload => {
    try {
      publishCardFeedback(payload);
    } catch {
      // Une source navigateur indisponible ne doit jamais bloquer l'action.
    }
  });
}

module.exports = { bindGameCardFeedback };
