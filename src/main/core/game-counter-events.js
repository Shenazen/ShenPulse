"use strict";

/** Interprétation des compteurs natifs GTA avec curseurs anti-doublons par session. */
const { safeString } = require("../utils");

function readMontChiliadCounterEvent(pack, message, cursors = new Map()) {
  if (
    pack?.id !== "gtav-montchiliad" ||
    message?.type !== "montchiliad:victory"
  ) {
    return null;
  }
  const sessionId = safeString(message.sessionId, 160);
  const eventId = Math.max(0, Math.trunc(Number(message.counterEventId || 0)));
  const amount = Math.trunc(Number(message.counterDelta || 0));
  const eventName = safeString(message.counterEvent, 40);
  if (!sessionId || !Number.isFinite(eventId)) return null;

  const previous = cursors.get(pack.id);
  if (!previous || previous.sessionId !== sessionId) {
    cursors.set(pack.id, { sessionId, eventId });
    return null;
  }
  if (
    eventId <= Number(previous.eventId || 0)
  ) {
    return null;
  }
  cursors.set(pack.id, { sessionId, eventId });
  if (
    eventId <= 0 ||
    amount === 0 ||
    !["win", "death"].includes(eventName)
  ) {
    return null;
  }
  return {
    sessionId,
    eventId,
    amount: Math.max(-1000, Math.min(1000, amount)),
    eventName
  };
}

module.exports = { readMontChiliadCounterEvent };
