"use strict";

/**
 * Protocole TikTok pur : normalisation, identité du diffuseur, comptages et
 * déduplication bornée. Aucun connecteur réseau ni accès au magasin.
 * Les limites et le traitement des zéros mesurés sont conservés.
 */
const { preferredImageUrl, safeString } = require("../utils");
const { addBoundedSet } = require("../../shared/bounded-collection");

const TIKTOK_REQUEST_POLLING_INTERVAL_MS = 250;
const MAX_TIKTOK_LIKE_EVENT_IDS = 2000;
const MAX_TIKTOK_EVENT_IDS = 4000;
const DEDUPLICATED_TIKTOK_EVENT_TYPES = new Set([
  "chat",
  "follow",
  "gift",
  "join",
  "like",
  "share",
  "subscribe", "linkMicBattle", "linkMicArmies", "linkMicBattleTask", "linkMicBattlePunishFinish"
]);

function parseTikTokRelayStatus(raw) {
  if (!raw || typeof raw !== "object") return null;
  const data = raw.data && typeof raw.data === "object" ? raw.data : raw;
  const kind = safeString(
    raw.event || raw.type || raw.action || data.event || data.type,
    80
  )
    .replace(/[^a-z]/gi, "")
    .toLowerCase();
  if (["streamend", "liveend", "offline", "disconnected"].includes(kind)) {
    return { status: "offline", roomId: safeString(data.roomId || "", 160) };
  }
  const statusKinds = new Set([
    "status",
    "livestatus",
    "roomstatus",
    "roominfo",
    "live"
  ]);
  if (!statusKinds.has(kind)) return null;
  const rawLive =
    data.live ??
    data.isLive ??
    data.online ??
    data.connected ??
    data.status ??
    raw.live ??
    raw.isLive;
  if (["checking", "connecting", "pending"].includes(String(rawLive).toLowerCase())) {
    return {
      status: "checking",
      roomId: safeString(data.roomId || data.room_id || raw.roomId || "", 160)
    };
  }
  const live =
    rawLive === true ||
    rawLive === 1 ||
    ["true", "1", "live", "online"].includes(String(rawLive).toLowerCase()) ||
    (kind === "roominfo" && Number(rawLive) === 2) ||
    kind === "live";
  return {
    status: live ? "live" : "offline",
    roomId: safeString(data.roomId || data.room_id || raw.roomId || "", 160)
  };
}

function normalizeTikTokMetadataUsername(value) {
  return safeString(value, 80).trim().replace(/^@+/, "").toLowerCase();
}

function tiktokMetadataRoomId(value) {
  if (!value || typeof value !== "object") return "";
  return safeString(value.roomId || value.room_id || value.common?.roomId || "", 160);
}

function nonnegativeViewerCount(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^\d+$/.test(value)) return null;
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

function tiktokCurrentViewerCount(event) {
  const data = tiktokDecodedPayload(event);
  // totalUser is cumulative, and ranksList identifies gifters rather than the host.
  return nonnegativeViewerCount(data?.viewerCount ?? data?.viewer_count);
}

function tiktokRoomLiveMetadata(roomInfo, username, expectedRoomId = "") {
  if (!roomInfo || typeof roomInfo !== "object") return null;
  const room = roomInfo.data && typeof roomInfo.data === "object" ? roomInfo.data : roomInfo;
  const roomId = tiktokMetadataRoomId(room) || safeString(room.id_str || room.id || "", 160);
  if (expectedRoomId && roomId && roomId !== expectedRoomId) return null;
  const metadata = { roomId: roomId || expectedRoomId };
  const owner = room.owner;
  if (owner && typeof owner === "object") {
    const ownerUsername = safeString(owner.uniqueId || owner.unique_id || owner.display_id || owner.username || "", 80)
      .trim().replace(/^@+/, "");
    const configuredUsername = safeString(username, 80).trim().replace(/^@+/, "");
    if (ownerUsername && normalizeTikTokMetadataUsername(ownerUsername) !== normalizeTikTokMetadataUsername(configuredUsername)) return null;
    // Some room responses omit the public @. Accept an owner only when its room
    // id proves this is the room already bound to the configured broadcaster.
    if (ownerUsername || (roomId && roomId === expectedRoomId)) {
      let avatarUrl = preferredImageUrl(
        owner.avatar_thumb?.url_list, owner.avatarThumb,
        owner.avatar_medium?.url_list, owner.avatarMedium,
        owner.avatar_large?.url_list, owner.avatarLarge,
        owner.profilePicture, owner.profilePictureUrl, owner.avatarUrl
      );
      try {
        const avatar = new URL(avatarUrl);
        if (avatar.protocol !== "https:" || avatar.username || avatar.password) avatarUrl = "";
      } catch { avatarUrl = ""; }
      metadata.broadcaster = {
        username: ownerUsername || configuredUsername,
        ...(owner.id || owner.id_str || owner.userId ? { userId: safeString(owner.id || owner.id_str || owner.userId, 120) } : {}),
        nickname: safeString(owner.nickname || owner.displayName || ownerUsername || configuredUsername, 160),
        avatarUrl
      };
    }
  }
  const currentViewers = nonnegativeViewerCount(room.user_count ?? room.userCount ?? room.viewerCount ?? room.viewer_count);
  if (currentViewers !== null) metadata.currentViewers = currentViewers;
  return Object.keys(metadata).length > 1 ? metadata : null;
}

function tiktokRelayLiveMetadata(raw, username, expectedRoomId = "") {
  if (!raw || typeof raw !== "object") return null;
  const data = raw.data && typeof raw.data === "object" ? raw.data : raw;
  const kind = safeString(raw.event || raw.type || raw.action || data.event || data.type, 80)
    .replace(/[^a-z]/gi, "").toLowerCase();
  if (["roomuser", "webcastroomuserseqmessage", "viewercount"].includes(kind)) {
    const currentViewers = tiktokCurrentViewerCount(data);
    return currentViewers === null ? null : { roomId: tiktokMetadataRoomId(data), currentViewers };
  }
  if (!["status", "livestatus", "roomstatus", "roominfo", "live"].includes(kind)) return null;
  const roomInfo = data.roomInfo || raw.roomInfo || data;
  return tiktokRoomLiveMetadata(roomInfo, username, expectedRoomId);
}

function tiktokConnectorPayload(type, event = {}, channelUsername = "") {
  const user = event.user || event.userInfo || event.sender || {};
  const uniqueId = safeString(
    user.uniqueId ||
      user.username ||
      event.uniqueId ||
      event.username ||
      "anonymous",
    120
  );
  const nickname = safeString(
    user.nickname ||
      user.displayName ||
      event.nickname ||
      event.displayName ||
      uniqueId,
    160
  );
  const userId = safeString(
    user.id ||
      user.userId ||
      event.userId ||
      event.user_id ||
      uniqueId,
    120
  );
  const gift = {
    ...(event.extendedGiftInfo || {}),
    ...(event.giftDetails || {}),
    ...(event.gift || {})
  };
  return {
    id: safeString(
      event.common?.msgId || event.msgId || event.id || "",
      160
    ),
    channelUsername: safeString(channelUsername, 80),
    userId,
    uniqueId,
    nickname,
    profilePictureUrl: preferredImageUrl(
      user.profilePictureUrl,
      user.avatarUrl,
      user.profilePicture,
      user.avatarThumb,
      event.profilePictureUrl,
      event.profilePicture,
      event.avatarThumb,
      event.userDetails?.profilePictureUrls
    ),
    isSubscriber: Boolean(
      user.isSubscriber || user.subscriber || event.isSubscriber || event.userIdentity?.isSubscriberOfAnchor === true
    ),
    isModerator: Boolean(
      user.isModerator || user.moderator || event.isModerator || event.userIdentity?.isModeratorOfAnchor === true
    ),
    giftId: safeString(
      event.giftId || gift.giftId || gift.id || "",
      120
    ),
    giftName: safeString(
      event.giftName || gift.giftName || gift.name || "Cadeau",
      160
    ),
    giftType: Math.max(
      0,
      Number(event.giftType || gift.giftType || gift.type || 0)
    ),
    giftCombo: Boolean(event.combo ?? gift.combo ?? gift.isCombo),
    giftImageUri: safeString(
      event.giftImageUri ||
        gift.imageUri ||
        gift.image?.uri ||
        gift.icon?.uri ||
        "",
      1000
    ),
    giftPrimaryEffectId: Math.max(
      0,
      Number(
        event.primaryEffectId ||
          gift.primaryEffectId ||
          gift.primary_effect_id ||
          0
      )
    ),
    giftIsGlobal: Boolean(
      event.isGlobalGift ?? gift.isGlobalGift ?? gift.is_global_gift
    ),
    giftIsDisplayedOnPanel: Boolean(
      event.isDisplayedOnPanel ??
        gift.isDisplayedOnPanel ??
        gift.is_displayed_on_panel
    ),
    giftImageUrl: preferredImageUrl(
      event.giftImageUrl,
      event.giftPictureUrl,
      event.giftImage,
      gift.giftImage,
      gift.imageUrl,
      gift.image,
      gift.icon,
      event.giftDetails?.giftImage,
      event.giftDetails?.image,
      event.extendedGiftInfo?.giftImage,
      event.extendedGiftInfo?.image
    ),
    repeatCount: Math.max(
      1,
      Number(event.repeatCount || event.repeat_count || 1)
    ),
    diamondCount: Math.max(
      0,
      Number(
        event.diamondCount ||
          event.giftCost ||
          event.cost ||
          gift.diamondCount ||
          gift.diamond_count ||
          gift.cost ||
          0
      )
    ),
    likeCount: Math.max(1, Number(event.likeCount || event.count || 1)),
    totalLikes: Math.max(
      0,
      Number(event.totalLikeCount || event.totalLikes || 0)
    ),
    comment: safeString(
      event.comment || event.text || event.message || "",
      1000
    ),
    viewerCount: Math.max(
      0,
      Number(event.viewerCount || event.totalUser || 0)
    ),
    eventType: type
  };
}

function tiktokDirectConnectionOptions() {
  return {
    enableExtendedGiftInfo: true,
    processInitialData: false,
    requestPollingIntervalMs: TIKTOK_REQUEST_POLLING_INTERVAL_MS,
    webClientParams: {
      app_language: "fr",
      browser_language: "fr-FR",
      priority_region: "FR",
      region: "FR",
      tz_name: "Europe/Paris",
      webcast_language: "fr"
    },
    webClientHeaders: {
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.7"
    }
  };
}

function tiktokSocialEventType(event = {}) {
  event = tiktokDecodedPayload(event);
  const display = event.common?.displayText || event.displayText || {};
  const marker = [
    display.displayType,
    display.defaultPattern,
    display.key,
    event.actionDescription,
    event.eventType
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (marker.includes("follow")) return "follow";
  if (marker.includes("share")) return "share";
  if (Number(event.followCount || event.follow_count || 0) > 0) {
    return "follow";
  }
  if (
    Number(event.shareCount || event.share_count || 0) > 0 ||
    event.shareType != null ||
    event.shareTarget != null
  ) {
    return "share";
  }
  return "";
}

function tiktokDecodedPayload(decoded = {}) {
  return decoded?.data && typeof decoded.data === "object"
    ? decoded.data
    : decoded || {};
}

function tiktokDecodedEventType(messageType, event = {}) {
  const type = String(messageType || "");
  const mapped = {
    WebcastChatMessage: "chat",
    WebcastGiftMessage: "gift",
    WebcastLikeMessage: "like",
    WebcastMemberMessage: "join",
    WebcastSubNotifyMessage: "subscribe"
  }[type];
  if (mapped) return mapped;
  return type === "WebcastSocialMessage"
    ? tiktokSocialEventType(event)
    : "";
}

function shouldEmitTikTokEvent(runtime = {}, type, event) {
  if (!DEDUPLICATED_TIKTOK_EVENT_TYPES.has(type)) return true;

  if (event && typeof event === "object") {
    runtime.seenTikTokEventObjects ||= new WeakMap();
    const types = runtime.seenTikTokEventObjects.get(event) || new Set();
    if (types.has(type)) return false;
    types.add(type);
    runtime.seenTikTokEventObjects.set(event, types);
  }

  const eventId = safeString(
    event?.common?.msgId || event?.msgId || event?.id || "",
    160
  );
  if (!eventId) return true;
  runtime.seenTikTokEventIds ||= new Set();
  const key = `${type}:${eventId}`;
  if (runtime.seenTikTokEventIds.has(key)) return false;
  addBoundedSet(runtime.seenTikTokEventIds, key, MAX_TIKTOK_EVENT_IDS);
  return true;
}

function applyTikTokLikeDelta(runtime, payload) {
  const eventId = safeString(payload?.id, 160);
  if (eventId) {
    runtime.seenLikeEventIds ||= new Set();
    if (runtime.seenLikeEventIds.has(eventId)) return null;
    addBoundedSet(runtime.seenLikeEventIds, eventId, MAX_TIKTOK_LIKE_EVENT_IDS);
  }

  const current = Math.max(1, Number(payload?.likeCount) || 1);
  const total = Math.max(0, Number(payload?.totalLikes) || 0);
  if (!total) return { ...payload, likeCount: current };

  const previous = Math.max(0, Number(runtime?.lastTotalLikes) || 0);
  runtime.lastTotalLikes = total;
  if (!previous || total < previous) {
    return { ...payload, likeCount: current };
  }
  return {
    ...payload,
    likeCount: Math.max(current, total - previous)
  };
}

function isTikTokOfflineError(error) {
  const text = tiktokErrorText(error);
  return /offline|not live|isn't live|is not live|isn't online|is not online|room.*(?:missing|not found)|UserOffline|failed to (?:retrieve|extract) room[\s_-]*id/i.test(
    text
  );
}

async function connectTikTokWhenLive(connector) {
  const live = await connector.fetchIsLive();
  if (live !== true) {
    const error = new Error("User is offline or room not found");
    error.code = "TIKTOK_OFFLINE";
    throw error;
  }
  return connector.connect();
}

function tiktokGiftIsFinal(event = {}) {
  const gift = {
    ...(event.extendedGiftInfo || {}),
    ...(event.giftDetails || {}),
    ...(event.gift || {})
  };
  const giftType = Number(
    event.giftType || gift.giftType || gift.type || 0
  );
  return giftType !== 1 || Boolean(event.repeatEnd);
}

function friendlyTikTokError(error, username) {
  if (isTikTokOfflineError(error)) {
    return `@${username} est hors ligne. Surveillance automatique active.`;
  }
  const detail = safeString(tiktokErrorText(error) || "Connexion impossible", 300);
  return `Détection TikTok @${username} : ${detail}`;
}

function tiktokErrorText(error) {
  if (typeof error === "string") return error;
  const candidates = [
    error?.name,
    error?.message,
    error?.reason,
    error?.description,
    error?.code,
    error?.info?.message,
    error?.info?.description,
    typeof error?.info === "string" ? error.info : ""
  ].filter(Boolean);
  if (candidates.length) return candidates.join(" ");
  try {
    const serialized = JSON.stringify(error);
    return serialized === "{}" ? "" : serialized;
  } catch {
    return "";
  }
}

module.exports = {
  TIKTOK_REQUEST_POLLING_INTERVAL_MS,
  connectTikTokWhenLive,
  isTikTokOfflineError,
  parseTikTokRelayStatus,
  tiktokCurrentViewerCount,
  tiktokRelayLiveMetadata,
  tiktokRoomLiveMetadata,
  applyTikTokLikeDelta,
  shouldEmitTikTokEvent,
  tiktokDecodedEventType,
  tiktokDecodedPayload,
  tiktokDirectConnectionOptions,
  tiktokGiftIsFinal,
  tiktokConnectorPayload,
  tiktokSocialEventType,
  normalizeTikTokMetadataUsername,
  tiktokMetadataRoomId,
  friendlyTikTokError
};
