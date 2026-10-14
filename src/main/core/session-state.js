"use strict";

/** Transitions des sessions LIVE TikTok/Kick : reprise, interruption et compteurs conservés. */
const { safeString } = require("../utils");
const { finishOverlaySession, resetOverlaySession } = require("../overlay-session-state");
const { resetSessionStatistics, finishLiveStatistics, ensureLiveStatistics, refreshLiveAudience } = require("./event-statistics");

function synchronizeSessionWithTikTok(
  state,
  status,
  details = {},
  now = new Date().toISOString()
) {
  // Compatibilité avec les anciens appels internes qui passaient directement
  // l'horodatage en troisième argument.
  if (typeof details === "string") {
    now = details;
    details = {};
  }

  const session = state.session;
  const incomingRoomId = safeString(details.roomId || "", 160);
  const currentRoomId = safeString(session.tiktokRoomId || "", 160);
  const roomChanged = Boolean(
    incomingRoomId && currentRoomId && incomingRoomId !== currentRoomId
  );

  if (status === "live") {
    const wasInterrupted = Boolean(session.tiktokInterruptedAt);
    const canResumeSameLive =
      wasInterrupted &&
      !roomChanged &&
      (session.running || (session.startedBy === "tiktok" && session.startedAt));

    if (canResumeSameLive) {
      session.running = true;
      session.tiktokRoomId = incomingRoomId || currentRoomId;
      session.tiktokInterruptedAt = null;
      ensureLiveStatistics(state).endedAt = null;
      session.activeConnectionIds = Array.from(
        new Set([...(session.activeConnectionIds || []), "source_tiktok"])
      );
      if (state.overlaySession) {
        state.overlaySession.active = true;
        state.overlaySession.endedAt = null;
        state.overlaySession.updatedAt = now;
      }
      return "resumed";
    }

    if (session.running && (!roomChanged || liveKickConnection(state))) {
      session.tiktokRoomId = incomingRoomId || currentRoomId;
      session.tiktokInterruptedAt = null;
      const live = ensureLiveStatistics(state);
      live.roomId = session.tiktokRoomId;
      live.endedAt = null;
      session.activeConnectionIds = Array.from(
        new Set([...(session.activeConnectionIds || []), "source_tiktok"])
      );
      return "";
    }

    session.running = true;
    session.startedAt = now;
    session.startedBy = "tiktok";
    session.tiktokRoomId = incomingRoomId;
    session.tiktokInterruptedAt = null;
    session.activeConnectionIds = Array.from(
      new Set([...(session.activeConnectionIds || []), "source_tiktok"])
    );
    resetSessionStatistics(state);
    resetOverlaySession(state, now);
    return "started";
  }

  if (
    ["disconnected", "error", "offline"].includes(status) &&
    session.running &&
    (session.startedBy === "tiktok" || session.tiktokRoomId ||
      (session.activeConnectionIds || []).includes("source_tiktok")) &&
    !session.tiktokInterruptedAt
  ) {
    session.tiktokInterruptedAt = now;
    // Les chiffres restent visibles comme dernier LIVE pendant la détection/reconnexion.
    if (!liveKickConnection(state)) finishLiveStatistics(state, now);
    else refreshLiveAudience(state, now, "tiktok");
    session.activeConnectionIds = (session.activeConnectionIds || []).filter(
      (connectionId) => connectionId !== "source_tiktok"
    );
    return "interrupted";
  }
  return "";
}

function liveKickConnection(state) {
  if (state.settings?.kick?.live !== true) return null;
  return (state.connections || []).find((connection) => connection.type === "kick-native" && connection.enabled) || null;
}

function synchronizeSessionWithKick(state, { connectionId = "source_kick", live = false } = {}, now = new Date().toISOString()) {
  const session = state.session;
  const connection = (state.connections || []).find((entry) => entry.id === connectionId && entry.type === "kick-native");
  const active = live === true && connection?.enabled === true;
  if (active) {
    session.activeConnectionIds = Array.from(new Set([...(session.activeConnectionIds || []), connectionId]));
    if (session.running) return "";
    session.running = true;
    session.startedAt = now;
    session.startedBy = "kick";
    session.tiktokRoomId = "";
    session.tiktokInterruptedAt = null;
    resetSessionStatistics(state);
    resetOverlaySession(state, now);
    return "started";
  }
  session.activeConnectionIds = (session.activeConnectionIds || []).filter((id) => id !== connectionId);
  if (state.settings?.tiktok?.status === "live") refreshLiveAudience(state, now, "kick");
  // TikTok conserve ses compteurs pendant une reconnexion. La même session
  // reste active si TikTok a participé ou si le créateur l’a lancée manuellement.
  if (!session.running || session.startedBy !== "kick" || session.activeConnectionIds.length ||
      session.tiktokRoomId || session.tiktokInterruptedAt || state.settings?.tiktok?.status === "live") return "";
  session.running = false;
  finishLiveStatistics(state, now);
  session.startedAt = null;
  session.startedBy = "";
  finishOverlaySession(state, now);
  return "stopped";
}

function clearSessionState(state) {
  finishLiveStatistics(state);
  state.session.running = false;
  state.session.startedAt = null;
  state.session.startedBy = "";
  state.session.tiktokRoomId = "";
  state.session.tiktokInterruptedAt = null;
  state.session.activeConnectionIds = [];
}

module.exports = { synchronizeSessionWithTikTok, liveKickConnection, synchronizeSessionWithKick, clearSessionState };
