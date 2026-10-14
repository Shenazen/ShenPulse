"use strict";

/** Sessions LIVE et tests des règles, actions et timers.
 * Les canaux sont toujours enregistrés par le garde d’accès central injecté.
 */
const { id, safeString } = require("../utils");
const { sanitizeEntity } = require("./sanitizers");
const { assertProFeatureAccess } = require("../pro-feature-access");

function registerSessionIpc({ handle, core, store }) {
  handle("session:start", () => core.startSession());
  
  handle("session:stop", () => core.stopSession());
  
  handle("event:test", (_event, type) => core.testEvent(safeString(type, 40)));
  
  handle("event:simulate", (_event, incoming) =>
    core.simulateEvent(sanitizeEntity(incoming || {}))
  );
  
  handle("rule:test", (_event, ruleId, incoming) =>
    core.testRule(safeString(ruleId, 160), sanitizeEntity(incoming || {}))
  );
  
  handle("action:test", (_event, incoming) => {
    const action = sanitizeEntity(incoming || {});
    const allowed = new Set([
      "overlay.alert",
      "overlay.media",
      "tts.speak",
      "audio.play",
      "goal.add",
      "timer.add",
      "overlay.multiplier-timer",
      "wheel.spin",
      "overlay.match",
      "game.effect",
      "overlay.like-goal",
      "overlay.coin-jar",
      "overlay.win-counter",
      "action.group",
      "obs.request",
      "http.request",
      "websocket.send",
      "chat.reply",
      "spotify.queue",
      "irl.shelly",
      "system.keys",
      "system.open",
      "delay"
    ]);
    if (!allowed.has(action.type)) {
      throw new Error("Cette action ne peut pas être prévisualisée directement.");
    }
    if (action.type === "irl.shelly") assertProFeatureAccess(store, "irl");
    if (action.type === "game.effect" || action.config?.packId) assertProFeatureAccess(store, "games");
    return core.previewAction({
      id: safeString(action.id || id("preview"), 160),
      type: action.type,
      config: action.config || {}
    }, {
      type: safeString(action.testEventType || "gift", 40),
      message: safeString(action.testMessage || "", 1000)
    });
  });
  
  handle("timer:test", (_event, timerId) =>
    core.testTimer(safeString(timerId, 160))
  );
}

module.exports = { registerSessionIpc };
