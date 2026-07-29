"use strict";

const { id, preferredImageUrl, safeString } = require("./utils");

const EVENT_ALIASES = {
  member: "join",
  social: "share",
  subscribe: "subscribe",
  subscription: "subscribe",
  roomuser: "roomUser",
  streamend: "streamEnd"
};

function normalizeType(value) {
  const key = safeString(value, 50).replace(/[^a-z]/gi, "").toLowerCase();
  return EVENT_ALIASES[key] || key || "unknown";
}

function pickUser(payload = {}) {
  const user = payload.user || payload.userInfo || payload.sender || {};
  const userId =
    user.id ||
    user.userId ||
    payload.userId ||
    payload.uniqueId ||
    payload.username ||
    "anonymous";
  const name =
    user.name ||
    user.uniqueId ||
    user.username ||
    payload.uniqueId ||
    payload.username ||
    "anonymous";
  return {
    id: safeString(userId, 120),
    name: safeString(name, 120),
    displayName: safeString(
      user.displayName || user.nickname || payload.nickname || name,
      160
    ),
    avatarUrl: preferredImageUrl(
      user.avatarUrl,
      user.profilePictureUrl,
      user.profilePicture,
      user.avatarThumb,
      payload.profilePictureUrl,
      payload.profilePicture,
      payload.avatarThumb,
      payload.userDetails?.profilePictureUrls
    ),
    subscriber: Boolean(
      user.subscriber || user.isSubscriber || payload.isSubscriber
    ),
    moderator: Boolean(user.moderator || user.isModerator || payload.isModerator),
    teamLevel: Number(user.teamLevel || payload.teamMemberLevel || 0)
  };
}

function normalizeEvent(raw, source = "unknown") {
  const wrapper = raw && typeof raw === "object" ? raw : { data: raw };
  const payload =
    wrapper.data && typeof wrapper.data === "object" ? wrapper.data : wrapper;
  const type = normalizeType(wrapper.event || wrapper.type || payload.eventType);
  const gift = payload.gift || payload.giftDetails || {};
  const count = eventCount(type, payload);

  return {
    id: safeString(wrapper.id || payload.id || id("evt"), 160),
    type,
    source: safeString(source, 80),
    timestamp: new Date(wrapper.timestamp || payload.timestamp || Date.now()).toISOString(),
    user: pickUser(payload),
    data: {
      message: safeString(payload.message || payload.comment || payload.text || "", 1000),
      giftId: safeString(
        payload.giftId || payload.gift_id || gift.id || gift.giftId || "",
        120
      ),
      giftName: safeString(
        payload.giftName || payload.gift_name || gift.name || "Cadeau",
        160
      ),
      giftImageUrl: preferredImageUrl(
        payload.giftImageUrl,
        payload.giftPictureUrl,
        payload.giftImage,
        gift.giftImage,
        gift.imageUrl,
        gift.image,
        gift.icon,
        payload.giftDetails?.giftImage,
        payload.giftDetails?.image,
        payload.extendedGiftInfo?.giftImage,
        payload.extendedGiftInfo?.image
      ),
      count: Number.isFinite(count) ? Math.max(1, count) : 1,
      value: Number(payload.value || payload.diamondCount || gift.value || 0),
      totalLikes: Number(payload.totalLikes || payload.totalLikeCount || 0),
      viewers: Number(payload.viewers || payload.viewerCount || 0),
      raw: payload
    }
  };
}

function eventCount(type, payload = {}) {
  const value =
    type === "like"
      ? payload.likeCount ?? payload.count ?? 1
      : type === "gift"
        ? payload.repeatCount ??
          payload.repeat_count ??
          payload.count ??
          1
        : payload.count ?? 1;
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(1, count) : 1;
}

module.exports = { eventCount, normalizeEvent, normalizeType };
