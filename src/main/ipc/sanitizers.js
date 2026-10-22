"use strict";

/** Validation des données IPC : bornes, types et champs autorisés.
 * Les exclusions anti-pollution de prototype restent appliquées récursivement.
 */
const { safeString } = require("../utils");

function sanitizeEntity(value, depth = 0) {
  if (depth > 12) throw new Error("Objet trop profond.");
  if (value == null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  if (typeof value === "string") return safeString(value, 20000);
  if (Array.isArray(value)) {
    if (value.length > 1000) throw new Error("Tableau trop volumineux.");
    return value.map((entry) => sanitizeEntity(entry, depth + 1));
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length > 500) throw new Error("Objet trop volumineux.");
    return Object.fromEntries(
      entries.map(([key, entry]) => [
        safeString(key, 120),
        sanitizeEntity(entry, depth + 1)
      ])
    );
  }
  return undefined;
}

function sanitizeGameConfiguration(packId, value) {
  const input =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const sanitized = sanitizeEntity(input);
  const next =
    sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)
      ? sanitized
      : {};
  if (
    ["fortnite", "rocket-league", "demonologist"].includes(
      safeString(packId, 160)
    )
  ) {
    return {
      keyLayout:
        String(input.keyLayout || "azerty").toLowerCase() === "azerty"
          ? "azerty"
          : "wasd"
    };
  }
  if (safeString(packId, 160) !== "coin-pusher") return next;
  for (const field of ["platformImageUrl", "plinkoImageUrl"]) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      next[field] = sanitizeCoinPusherArtworkUrl(input[field]);
    }
  }
  return next;
}

function sanitizeCoinPusherArtworkUrl(value) {
  const url = typeof value === "string" ? value.trim() : "";
  if (!url || /^javascript:/i.test(url)) return "";
  if (!/^data:/i.test(url)) return safeString(url, 4000);
  if (
    !/^data:image\/(?:avif|gif|jpe?g|png|webp);base64,[a-z0-9+/=]+$/i.test(
      url
    )
  ) {
    return "";
  }
  if (url.length > 1000000) {
    throw new Error(
      "L’image Coin Pusher est trop volumineuse après optimisation."
    );
  }
  return url;
}

function sanitizeDealOrNoDealHostState(value) {
  const payload =
    value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  const seenIds = new Set();
  const boxes = (Array.isArray(payload.boxes) ? payload.boxes : [])
    .map((box) => {
      const idValue = Math.round(Number(box?.id));
      const boxValue = Math.round(Number(box?.value));
      if (
        !Number.isFinite(idValue) ||
        idValue < 1 ||
        idValue > 24 ||
        seenIds.has(idValue) ||
        !Number.isFinite(boxValue)
      ) {
        return null;
      }
      seenIds.add(idValue);
      return {
        id: idValue,
        value: Math.max(-999999, Math.min(999999, boxValue)),
        opened: box?.opened === true,
        own: box?.own === true
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.id - right.id);
  return {
    phase: safeString(payload.phase, 40) || "lobby",
    playerName: safeString(payload.playerName, 100),
    payoutMultiplier: Math.max(
      0.01,
      Math.min(100, Number(payload.payoutMultiplier) || 1)
    ),
    entryOptionId:
      safeString(payload.entryOptionId, 20) === "premium"
        ? "premium"
        : "base",
    updatedAt: Math.max(0, Number(payload.updatedAt) || Date.now()),
    boxes,
    bankerRequestType: safeString(payload.bankerRequestType, 40),
    bankerRequestText: safeString(payload.bankerRequestText, 300),
    bonusValue: Math.max(
      -999999,
      Math.min(999999, Math.round(Number(payload.bonusValue) || 0))
    )
  };
}

const THIERCELIEUX_COMMAND_TYPES = new Set([
  "start",
  "resume",
  "reveal-card",
  "confirm-reveal",
  "reveal-result",
  "confirm-result",
  "begin-night",
  "select-target",
  "set-choice",
  "toggle-heal",
  "validate-night",
  "skip-night",
  "repeat",
  "toggle-pause",
  "open-discussion",
  "open-vote",
  "second-vote",
  "confirm-vote",
  "abstain-vote",
  "death-target",
  "validate-death",
  "skip-death",
  "elect-captain",
  "continue-verdict",
  "new-round",
  "toggle-music",
  "set-volume"
]);

function sanitizeThiercelieuxCommand(value) {
  const payload =
    value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  const type = safeString(payload.type, 40);
  if (!THIERCELIEUX_COMMAND_TYPES.has(type)) {
    throw new Error("Commande Thiercelieux inconnue.");
  }
  return {
    type,
    playerId: safeString(payload.playerId, 160),
    choice: safeString(payload.choice, 80),
    multiple: payload.multiple === true,
    value: Math.max(0, Math.min(100, Math.round(Number(payload.value) || 0)))
  };
}

function sanitizeThiercelieuxHostState(value) {
  const payload =
    value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  const sanitizePlayer = (player) => ({
    id: safeString(player?.id, 160),
    name: safeString(player?.name, 100),
    seat: Math.max(1, Math.min(8, Math.round(Number(player?.seat) || 1))),
    alive: player?.alive !== false,
    selected: player?.selected === true,
    disabled: player?.disabled === true,
    status: safeString(player?.status, 80)
  });
  const players = (Array.isArray(payload.players) ? payload.players : [])
    .slice(0, 8)
    .map(sanitizePlayer)
    .filter((player) => player.id && player.name);
  const availableTargets = (Array.isArray(payload.availableTargets)
    ? payload.availableTargets
    : [])
    .slice(0, 8)
    .map(sanitizePlayer)
    .filter((player) => player.id && player.name);
  return {
    screen: safeString(payload.screen, 30) || "ready",
    phase: safeString(payload.phase, 40) || "ready",
    phaseTitle: safeString(payload.phaseTitle, 140),
    stepLabel: safeString(payload.stepLabel, 100),
    title: safeString(payload.title, 160),
    dialogue: safeString(payload.dialogue, 1200),
    expected: safeString(payload.expected, 500),
    privateAlert: safeString(payload.privateAlert, 500),
    currentPlayerId: safeString(payload.currentPlayerId, 160),
    currentPlayerName: safeString(payload.currentPlayerName, 100),
    currentSeat: Math.max(0, Math.min(8, Math.round(Number(payload.currentSeat) || 0))),
    revealIndex: Math.max(0, Math.min(8, Math.round(Number(payload.revealIndex) || 0))),
    revealTotal: Math.max(0, Math.min(8, Math.round(Number(payload.revealTotal) || 0))),
    revealUnlocked: payload.revealUnlocked === true,
    resultPending: payload.resultPending === true,
    resultUnlocked: payload.resultUnlocked === true,
    resultPlayerId: safeString(payload.resultPlayerId, 160),
    resultPlayerName: safeString(payload.resultPlayerName, 100),
    resultSeat: Math.max(0, Math.min(8, Math.round(Number(payload.resultSeat) || 0))),
    canStart: payload.canStart === true,
    hasSavedGame: payload.hasSavedGame === true,
    paused: payload.paused === true,
    audioEnabled: payload.audioEnabled !== false,
    ambienceVolume: Number.isFinite(Number(payload.ambienceVolume))
      ? Math.max(0, Math.min(100, Math.round(Number(payload.ambienceVolume))))
      : 70,
    remainingSeconds: Math.max(0, Math.min(3600, Math.round(Number(payload.remainingSeconds) || 0))),
    currentVoterId: safeString(payload.currentVoterId, 160),
    action: safeString(payload.action, 80),
    multipleTargets: payload.multipleTargets === true,
    requiresChoice: payload.requiresChoice === true,
    choice: safeString(payload.choice, 80),
    healSelected: payload.healSelected === true,
    canSkip: payload.canSkip !== false,
    secondVoteAvailable: payload.secondVoteAvailable === true,
    players,
    availableTargets,
    winnerLabel: safeString(payload.winnerLabel, 200),
    error: safeString(payload.error, 500),
    updatedAt: Math.max(0, Number(payload.updatedAt) || Date.now())
  };
}

function cleanTikTokUsername(value) {
  return safeString(value, 80)
    .trim()
    .replace(/^@+/, "")
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9._]/g, "")
    .slice(0, 30);
}

module.exports = { sanitizeEntity, sanitizeGameConfiguration, sanitizeDealOrNoDealHostState, sanitizeThiercelieuxCommand, sanitizeThiercelieuxHostState, cleanTikTokUsername };
