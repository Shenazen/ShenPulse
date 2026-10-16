"use strict";

const { readState } = require("../state-projection");
const username = (value) => String(value || "").trim().replace(/^@+/, "").toLowerCase();

function giftCatalogScope(store) {
  const state = readState(store, ["settings.account.uid", "session.profileId", "settings.tiktok"]);
  return { accountUid: state.settings?.account?.uid || "", profileId: state.session?.profileId || "",
    username: username(state.settings?.tiktok?.username), roomId: String(state.settings?.tiktok?.roomId || "") };
}

function sameGiftCatalogScope(left, right) {
  return ["accountUid", "profileId", "username", "roomId"].every((key) => left[key] === right[key]);
}

function synchronizeGiftCatalogScope(core) {
  const scope = giftCatalogScope(core.store);
  core.giftCatalog.setRoomScope?.(scope.username, { roomId: scope.roomId });
  return scope;
}

/** Only the current primary direct connector can personalize a room catalogue.
 * A manual/API gift, donor identity, stale room or rival must not do so. */
function trustedRoomGiftContext(core, event) {
  if (event?.source !== "source_tiktok" || event.type !== "gift") return null;
  const state = readState(core.store, ["settings.tiktok", "connections", "session.running"]);
  const tiktok = state.settings?.tiktok, source = state.connections?.find((row) => row.id === "source_tiktok");
  const roomId = String(tiktok?.roomId || ""), configured = username(tiktok?.username), raw = event.data?.raw;
  const ownerId = String(tiktok?.broadcaster?.userId || "");
  const recipients = Array.isArray(raw?.giftRecipientIds) ? raw.giftRecipientIds : [];
  if (tiktok?.status !== "live" || state.session?.running !== true || !configured || !/^[1-9]\d{0,19}$/.test(roomId) ||
    !source?.enabled || source.type !== "tiktok-direct" || username(source.config?.username) !== configured ||
    username(raw?.channelUsername) !== configured || String(raw?.roomId || "") !== roomId ||
    !/^[1-9]\d{0,19}$/.test(ownerId) || !recipients.length || recipients.some((id) => id !== ownerId) ||
    raw.giftMessageRoomId && raw.giftMessageRoomId !== roomId) return null;
  return { username: configured, roomId, verified: true };
}

module.exports = { giftCatalogScope, sameGiftCatalogScope, synchronizeGiftCatalogScope, trustedRoomGiftContext };
