"use strict";

const { preferredImageUrl } = require("../utils");
const exactId = (value) => {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? String(value) : "";
  return typeof value === "string" && /^[1-9]\d{0,19}$/.test(value) && BigInt(value) <= 18446744073709551615n ? value : "";
};
const username = (value) => typeof value === "string" && /^@?[a-z0-9._]{1,24}$/i.test(value.trim())
  ? value.trim().replace(/^@/, "").toLowerCase() : "";

// OPEN's public anchorInfo contains creators, unlike armies' donor lists.
// Only an unambiguous exact displayId and matching exact map/user UIDs can
// establish the configured broadcaster when room/info omits its owner.
function tiktokMatchOwnerMetadata(data, { roomId = "", channelUsername = "" } = {}) {
  const room = exactId(roomId), configured = username(channelUsername);
  if (!data || typeof data !== "object" || data.action !== 4 || !room || !configured ||
    exactId(data.common?.roomId) !== room || !exactId(data.battleId) ||
    !data.anchorInfo || typeof data.anchorInfo !== "object" || Array.isArray(data.anchorInfo)) return null;
  const anchors = Object.entries(data.anchorInfo);
  if (anchors.length > 16) return null;
  const matches = anchors.filter(([, entry]) => username(entry?.user?.displayId) === configured);
  if (matches.length !== 1) return null;
  const [key, entry] = matches[0], user = entry.user;
  const keyId = exactId(key);
  const userIds = [user.id_str, user.userIdStr, user.user_id_str, user.userId, user.id].map(exactId).filter(Boolean);
  if (!keyId || !userIds.length || userIds.some((id) => id !== keyId)) return null;
  let avatarUrl = preferredImageUrl(user.avatarThumb, user.avatarUrl);
  try { const avatar = new URL(avatarUrl); if (avatar.protocol !== "https:" || avatar.username || avatar.password) avatarUrl = ""; }
  catch { avatarUrl = ""; }
  const nickname = typeof user.nickName === "string" && !/[\x00-\x1f\x7f]/.test(user.nickName)
    ? user.nickName.slice(0, 160) : configured;
  return { roomId: room, broadcaster: { userId: keyId, username: configured, nickname: nickname || configured, avatarUrl } };
}

// Pure reconciliation shared by HTTP snapshots and OPEN pushes. A partial
// snapshot may enrich an exact owner but never erase it or silently change it.
function reconcileTikTokOwnerMetadata(metadata, runtime, current, channelUsername) {
  const cache = runtime.verifiedMatchOwner || null, conflict = runtime.matchOwnerConflict === true;
  if (!metadata || runtime.roomId && metadata.roomId !== runtime.roomId) return { metadata, cache, conflict };
  const configured = username(channelUsername), room = metadata.roomId;
  const trusted = (owner) => owner && username(owner.username) === configured ? owner : null;
  const cached = cache?.roomId === room ? trusted(cache.broadcaster) : null;
  const previous = current?.roomId === room && username(current.username) === configured ? trusted(current.broadcaster) : null;
  const incoming = trusted(metadata.broadcaster);
  const ids = new Set([cached?.userId, previous?.userId, incoming?.userId].map(exactId).filter(Boolean));
  if (conflict || metadata.ownerConflict === true || ids.size > 1) {
    return { metadata: { ...metadata, broadcaster: null }, cache: null, conflict: true };
  }
  const base = { ...cached, ...previous }, owner = incoming ? { ...base, ...incoming,
    userId: exactId(incoming.userId) || exactId(base.userId) || undefined,
    avatarUrl: incoming.avatarUrl || base.avatarUrl || "" } : previous || cached;
  const merged = owner && Object.hasOwn(metadata, "broadcaster") ? { ...metadata, broadcaster: owner } : metadata;
  return { metadata: merged, cache: exactId(owner?.userId) ? { roomId: room, broadcaster: owner } : cache, conflict: false };
}

module.exports = { tiktokMatchOwnerMetadata, reconcileTikTokOwnerMetadata };
