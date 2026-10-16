"use strict";

/** Adaptateur du SDK TikTok installé, d’après ses enums/types publics.
 * BattleAction OPEN=4, FINISH=5 ; Result WIN=0, LOSE=1, DRAW=2.
 * Équipes : BattleTeamUserArmies et WebcastLinkMicBattle_{TeamUsersInfo,
 * BattleTeamResult} du tiktok-schema fourni par tiktok-live-connector 2.1.1-beta1.
 * Les cartes ne sont pas décodées par cette version : aucun cadeau ne sert
 * de preuve implicite de gant, brume, marteau ou prolongation.
 */
const { preferredImageUrl, safeString } = require("../utils");
const { normalizeTikTokBattleBonus } = require("./tiktok-bonus");
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
const list = (value, limit) => Array.isArray(value) ? value.slice(0, limit) : [];
const entries = (value) => value && typeof value === "object" && !Array.isArray(value) ? Object.entries(value).slice(0, 16) : [];
const BATTLE_RESULTS = Object.freeze({ 0: "win", 1: "lose", 2: "draw" });
const battleResult = (value) => Object.hasOwn(BATTLE_RESULTS, value) ? BATTLE_RESULTS[value] : null;
function publicUser(user = {}, fallback = "") {
  user = user && typeof user === "object" ? user : {};
  return { id: identifier(user.userIdStr, user.userId, user.id, fallback).slice(0, 120),
    username: safeString(user.displayId || user.uniqueId || user.username || "", 120).replace(/^@+/, ""),
    displayName: safeString(user.nickName || user.nickname || user.displayName || "", 160),
    avatarUrl: preferredImageUrl(user.avatarThumb, user.avatarUrl, user.profilePictureUrl),
    score: finiteScore(user.hostScore ?? user.score), diamonds: finiteScore(user.diamondScore) };
}
function normalizeTikTokBattle(kind, data = {}, { roomId = "", channelUsername = "", receivedAtMs = Date.now(), clockOffsetMs = 0 } = {}) {
  const category = EVENTS[tiktokBattleEventKind(kind)]; if (!category) return null;
  if (!data || typeof data !== "object") return null;
  const reportedRoomId = identifier(data.common?.roomId, data.roomId);
  if (roomId && reportedRoomId && String(roomId) !== reportedRoomId) return null;
  const setting = data.battleSetting || data.battleSettings || {};
  const battleId = identifier(data.battleId, setting.battleId); if (!battleId) return null;
  const participants = new Map(), teams = new Map(), membership = new Map();
  const ensure = (id) => { id = safeString(id, 120); if (!id || id === "0") return null;
    if (!participants.has(id) && participants.size < 16) participants.set(id, { id, username: "", displayName: "", avatarUrl: "", score: null, donors: [], result: null });
    return participants.get(id); };
  const mergeUser = (user) => {
    const row = ensure(user.id); if (!row) return null;
    // Un relais ancien peut envoyer battleUsers sans @ après anchorInfo :
    // une identité vide ne doit pas effacer celle déjà reçue dans ce paquet.
    Object.assign(row, Object.fromEntries(Object.entries(user).filter(([, value]) => value !== "" && value !== null)));
    return row;
  };
  const ensureTeam = (id) => {
    id = identifier(id).slice(0, 120); if (!id) return null;
    if (!teams.has(id) && teams.size < 8) teams.set(id, { id, participantIds: [], score: null, donors: [], result: null });
    return teams.get(id);
  };
  const addMember = (team, user) => {
    const row = typeof user === "object" ? mergeUser(publicUser(user)) : ensure(identifier(user));
    if (!team || !row) return;
    if (!team.participantIds.includes(row.id) && team.participantIds.length < 8) team.participantIds.push(row.id);
    if (!team.participantIds.includes(row.id)) return;
    if (!membership.has(row.id)) membership.set(row.id, new Set());
    membership.get(row.id).add(team.id);
  };
  const donors = (army) => list(army?.userArmy, 10).map((user) => publicUser(user)).filter((user) => user.id);
  for (const [id, anchor] of entries(data.anchorInfo)) {
    mergeUser(publicUser(anchor?.user || anchor || {}, id));
  }
  for (const user of list(data.battleUsers, 16)) mergeUser(publicUser(user));
  for (const [id, army] of entries(data.battleItems || data.armies)) {
    if (!army || typeof army !== "object") continue;
    const row = ensure(identifier(army.anchorIdStr, id)); if (!row) continue;
    row.score = finiteScore(army.hostScore); row.donors = donors(army);
  }
  for (const [id, result] of entries(data.battleResult)) {
    if (!result || typeof result !== "object") continue;
    const row = ensure(identifier(result.userId, id)); if (!row) continue;
    row.score = finiteScore(result.score); row.result = battleResult(result.result);
  }
  // Champs réels du SDK : teamUsers décrit la composition à OPEN, puis
  // teamArmies et teamBattleResult portent les scores et résultats d'équipe.
  // Le total n'est jamais recopié sur chaque membre, ni calculé depuis les dons.
  for (const item of list(data.teamUsers, 8)) {
    const team = ensureTeam(item?.teamId); if (!team) continue;
    for (const id of list(item.userIds, 8)) addMember(team, id);
  }
  for (const item of list(data.teamArmies, 8)) {
    const team = ensureTeam(item?.teamId); if (!team) continue;
    for (const user of list(item.teamUsers, 8)) addMember(team, user);
    team.score = finiteScore(item.teamTotalScore); team.donors = donors(item.userArmies);
  }
  for (const item of list(data.teamBattleResult, 8)) {
    const team = ensureTeam(item?.teamId); if (!team) continue;
    for (const user of list(item.teamUsers, 8)) addMember(team, user);
    const score = finiteScore(item.totalScore); if (score !== null) team.score = score;
    team.result = battleResult(item.result);
  }
  for (const [id, ids] of membership) {
    // Un membre annoncé dans deux équipes reste ambigu : le service reçoit
    // les deux appartenances, mais aucune teamId individuelle trompeuse.
    if (ids.size === 1) participants.get(id).teamId = [...ids][0];
  }
  const offset = Number.isFinite(clockOffsetMs) && clockOffsetMs >= 0 && clockOffsetMs <= 30000 ? clockOffsetMs : 0;
  const localTimestamp = (value) => { const at = timestamp(value); return at ? at - offset : 0; };
  const startsAtMs = localTimestamp(setting.startTimeMs), durationMs = Math.min(7200000, Math.max(0, Number(setting.duration) || 0) * 1000);
  const extraDurationMs = Math.min(3600000, Math.max(0, Number(setting.extraDurationSecond) || 0) * 1000);
  const endsAtMs = localTimestamp(setting.endTimeMs) || (startsAtMs && durationMs ? startsAtMs + durationMs + extraDurationMs : 0);
  // Le compte à rebours des bonus exclut le temps ajouté par une carte.
  // Le chronomètre et Snipe conservent, eux, la vraie fin prolongée.
  const regulationEnd = startsAtMs && durationMs ? startsAtMs + durationMs : 0;
  const bonusEnd = extraDurationMs ? endsAtMs - extraDurationMs : regulationEnd && regulationEnd <= endsAtMs ? regulationEnd : 0;
  const bonusEndsAtMs = endsAtMs > 1e12 && bonusEnd > Math.max(1e12, startsAtMs) ? bonusEnd : 0;
  const period = data.taskStart?.battleBonusConfig?.rewardPeriodConfig || {};
  const multiplier = [2, 3].includes(Number(period.rewardMultiple)) ? Number(period.rewardMultiple) : null;
  const phase = category === "battle" ? ({ 4: "start", 5: "end", 6: "cancel", 3: "cancel", 11: "cancel" })[data.action] :
    category === "scores" ? Number(data.battleStatus) === 2 ? "end" : "update" : category === "task" ? "task" : "punish";
  if (!phase) return null;
  const normalizedBonus = category === "task" ? normalizeTikTokBattleBonus(data, { clockOffsetMs: offset }) : null;
  // START_BONUS n'a pas de règlement ni d'UID bénéficiaire : sa salle doit
  // donc être explicitement celle de la connexion vérifiée, pas un repli.
  const bonus = normalizedBonus?.stage === "start-bonus" && (!roomId || reportedRoomId !== String(roomId)) ? null : normalizedBonus;
  return { id: identifier(data.common?.msgId, data.msgId), battleId, phase, roomId: safeString(reportedRoomId || roomId, 160),
    channelUsername: safeString(channelUsername, 120), receivedAtMs, startsAtMs,
    endsAtMs, bonusEndsAtMs,
    participants: [...participants.values()], teams: [...teams.values()],
    battleType: [1, 2, 3, 4, 51, 52].includes(Number(setting.battleType)) ? Number(setting.battleType) : 0,
    multiplier, rewardStartsAtMs: bonus?.startsAtMs || 0, bonus,
    rewardDurationMs: Math.min(3600000, Math.max(0, Number(period.duration) || 0) * 1000), rewardFinished: category === "task" && Number(data.battleTaskMessageType) === 3,
    confirmedEnd: phase === "end" };
}
module.exports = { EVENTS, DECODED, normalizeTikTokBattle, tiktokBattleEventKind };
