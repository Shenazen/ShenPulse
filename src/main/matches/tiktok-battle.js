"use strict";

/** Adaptateur du SDK TikTok installé, d’après ses enums/types publics.
 * BattleAction OPEN=4, FINISH=5 ; Result WIN=0, LOSE=1, DRAW=2.
 * Les cartes ne sont pas décodées par cette version : aucun cadeau ne sert
 * de preuve implicite de gant, brume, marteau ou prolongation.
 */
const { preferredImageUrl, safeString } = require("../utils");
const EVENTS = Object.freeze({ linkMicBattle: "battle", linkMicArmies: "scores", linkMicBattleTask: "task", linkMicBattlePunishFinish: "punish" });
const DECODED = Object.freeze({ WebcastLinkMicBattle: "linkMicBattle", WebcastLinkMicArmies: "linkMicArmies",
  WebcastLinkmicBattleTaskMessage: "linkMicBattleTask", WebcastLinkMicBattlePunishFinish: "linkMicBattlePunishFinish" });
/** Seuls les événements réellement décodés par le SDK sont reconnus, y
 * compris leur nom protobuf lorsqu'un relais autorisé conserve ce nom. */
function tiktokBattleEventKind(value) {
  const key = String(value || "").replace(/[^a-z]/gi, "").toLowerCase();
  return Object.keys(EVENTS).find((name) => name.toLowerCase() === key) ||
    Object.entries(DECODED).find(([name]) => name.toLowerCase() === key)?.[1] || "";
}
const finiteScore = (value) => value === undefined || value === null || value === "" || !Number.isFinite(Number(value)) || Number(value) < 0 ? null : Math.min(Number.MAX_SAFE_INTEGER, Number(value));
const timestamp = (value) => { const n = Number(value); return Number.isFinite(n) && n > 0 ? (n < 1e12 ? n * 1000 : n) : 0; };
const identifier = (...values) => values.map((value) => safeString(value, 160)).find((value) => value && value !== "0") || "";
function publicUser(user = {}, fallback = "") {
  return { id: identifier(user.userIdStr, user.userId, user.id, fallback).slice(0, 120),
    username: safeString(user.displayId || user.uniqueId || user.username || "", 120).replace(/^@+/, ""),
    displayName: safeString(user.nickName || user.nickname || user.displayName || "", 160),
    avatarUrl: preferredImageUrl(user.avatarThumb, user.avatarUrl, user.profilePictureUrl),
    score: finiteScore(user.hostScore ?? user.score), diamonds: finiteScore(user.diamondScore) };
}
function normalizeTikTokBattle(kind, data = {}, { roomId = "", channelUsername = "", receivedAtMs = Date.now() } = {}) {
  const category = EVENTS[tiktokBattleEventKind(kind)]; if (!category) return null;
  const reportedRoomId = identifier(data.common?.roomId, data.roomId);
  if (roomId && reportedRoomId && String(roomId) !== reportedRoomId) return null;
  const setting = data.battleSetting || data.battleSettings || {};
  const battleId = identifier(data.battleId, setting.battleId); if (!battleId) return null;
  const participants = new Map();
  const ensure = (id) => { id = safeString(id, 120); if (!id || id === "0") return null;
    if (!participants.has(id) && participants.size < 16) participants.set(id, { id, username: "", displayName: "", avatarUrl: "", score: null, donors: [], result: null });
    return participants.get(id); };
  for (const [id, anchor] of Object.entries(data.anchorInfo || {}).slice(0, 16)) {
    const user = publicUser(anchor?.user || anchor || {}, id), row = ensure(user.id || id); if (row) Object.assign(row, user);
  }
  for (const user of (Array.isArray(data.battleUsers) ? data.battleUsers : []).slice(0, 16)) {
    const normalized = publicUser(user), row = ensure(normalized.id); if (row) Object.assign(row, normalized);
  }
  for (const [id, army] of Object.entries(data.battleItems || data.armies || {}).slice(0, 16)) {
    const row = ensure(identifier(army.anchorIdStr, id)); if (!row) continue;
    row.score = finiteScore(army.hostScore);
    row.donors = (army.userArmy || []).slice(0, 10).map((user) => publicUser(user)).filter((user) => user.id);
  }
  for (const [id, result] of Object.entries(data.battleResult || {}).slice(0, 16)) {
    const row = ensure(identifier(result.userId, id)); if (!row) continue;
    row.score = finiteScore(result.score); row.result = ({ 0: "win", 1: "lose", 2: "draw" })[result.result] || null;
  }
  for (const team of (data.teamArmies || []).slice(0, 8)) {
    for (const user of (team.teamUsers || []).slice(0, 8)) {
      const row = ensure(identifier(user.userIdStr, user.userId)); if (row) { row.score = finiteScore(user.score); row.teamId = safeString(team.teamId, 120); }
    }
  }
  const startsAtMs = timestamp(setting.startTimeMs), durationMs = Math.min(7200000, Math.max(0, Number(setting.duration) || 0) * 1000);
  const extraDurationMs = Math.min(3600000, Math.max(0, Number(setting.extraDurationSecond) || 0) * 1000);
  const period = data.taskStart?.battleBonusConfig?.rewardPeriodConfig || {};
  const rewardStartsAtMs = timestamp(data.taskSettle?.rewardStartTimestamp || data.taskSettle?.rewardStartTime || period.rewardStartTimestamp || period.rewardStartTime);
  const multiplier = [2, 3].includes(Number(period.rewardMultiple)) ? Number(period.rewardMultiple) : null;
  const phase = category === "battle" ? ({ 4: "start", 5: "end", 6: "cancel", 3: "cancel", 11: "cancel" })[data.action] :
    category === "scores" ? Number(data.battleStatus) === 2 ? "end" : "update" : category === "task" ? "task" : "punish";
  if (!phase) return null;
  return { id: identifier(data.common?.msgId, data.msgId), battleId, phase, roomId: safeString(reportedRoomId || roomId, 160),
    channelUsername: safeString(channelUsername, 120), receivedAtMs, startsAtMs,
    endsAtMs: timestamp(setting.endTimeMs) || (startsAtMs && durationMs ? startsAtMs + durationMs + extraDurationMs : 0),
    participants: [...participants.values()], multiplier, rewardStartsAtMs,
    rewardDurationMs: Math.min(3600000, Math.max(0, Number(period.duration) || 0) * 1000), rewardFinished: category === "task" && Number(data.battleTaskMessageType) === 3,
    confirmedEnd: phase === "end" };
}
module.exports = { EVENTS, DECODED, normalizeTikTokBattle, tiktokBattleEventKind };
