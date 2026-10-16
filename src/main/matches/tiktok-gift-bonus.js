"use strict";

// A gift's credited multiplier is a contemporaneous observation, not a task
// announcement or a promise that a bonus lasts 30 seconds. Keep the recipient
// evidence separate from the donor and let the match service bind it to the
// current broadcaster/battle before executing anything.
const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const integer = (value) => {
  if (typeof value !== "number" && (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value))) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
};
const uid = (value) => {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? String(value) : "";
  return typeof value === "string" && /^[1-9]\d{0,19}$/.test(value) && BigInt(value) <= 18446744073709551615n ? value : "";
};
const text = (value, limit) => typeof value === "string" && value.length <= limit && !/[\x00-\x1f\x7f]/.test(value) ? value.trim() : "";
const timestamp = (value) => {
  const number = integer(value);
  if (number === null || number < 1e9) return 0;
  const milliseconds = number < 1e12 ? number * 1000 : number;
  return Number.isSafeInteger(milliseconds) && milliseconds <= 8.64e15 ? milliseconds : 0;
};

function normalizeTikTokGiftBonus(data, { roomId = "", channelUsername = "", receivedAtMs = Date.now(), clockOffsetMs = 0 } = {}) {
  if (!object(data) || !object(data.matchInfo) || !object(data.common)) return null;
  const multiplier = integer(data.matchInfo.multiplierValue);
  // Other types are critical-strike/top-2/top-3/vault/music item cards, not the
  // ordinary x2/x3 match bonus requested here. Missing fields are not proof.
  if (![2, 3].includes(multiplier) || integer(data.matchInfo.multiplierType) !== 0 ||
    ![0, 1].includes(integer(data.matchInfo.critical)) || data.matchInfo.effectCardInUse !== false) return null;
  const expectedRoom = uid(roomId), reportedRoom = uid(data.common.roomId);
  if (!expectedRoom || reportedRoom !== expectedRoom) return null;
  const id = text(data.common.msgId, 160) || text(data.msgId, 160) || text(data.id, 160);
  const created = timestamp(data.common.createTime);
  const received = timestamp(receivedAtMs);
  if (!id || id === "0" || !created || !received) return null;
  const offset = Number.isSafeInteger(clockOffsetMs) && clockOffsetMs >= 0 && clockOffsetMs <= 30000 ? clockOffsetMs : 0;
  // The installed SDK calls GiftMonitorInfo `giftExtra`; legacy converters can
  // rename its toUserId to receiverUserId. anchorId is NEVER a recipient proof.
  const recipientIds = [...new Set([
    data.toUser?.id_str, data.toUser?.userIdStr, data.toUser?.user_id_str,
    data.toUser?.userId, data.toUser?.id, data.giftExtra?.toUserId,
    data.toMemberId, data.toMemberIdInt, data.toUserId, data.receiverUserId
  ].map(uid).filter(Boolean))];
  if (!recipientIds.length) return null;
  return { phase: "gift-bonus", id, roomId: reportedRoom,
    channelUsername: text(channelUsername, 80).replace(/^@+/, ""), receivedAtMs: received,
    createdAtMs: created - offset, giftBonus: { multiplier, recipientIds } };
}

module.exports = { normalizeTikTokGiftBonus };
