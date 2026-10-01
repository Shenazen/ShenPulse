"use strict";

const SYNTHETIC_SOURCES = new Set([
  "manual-preview",
  "rule-test",
  "simulator",
  "test"
]);
const ANONYMOUS_VIEWERS = new Set(["anonymous", "unknown", "viewer"]);

/**
 * Accepte un seul follow par spectateur pendant une session LIVE.
 *
 * Les reconnexions conservent le même startedAt et donc le même verrou. Un
 * nouveau LIVE reçoit un nouveau startedAt, ce qui vide automatiquement les
 * spectateurs suivis. Les sources de test restent répétables pour permettre de
 * vérifier les actions depuis l'interface.
 */
class FollowSessionGuard {
  constructor() {
    this.liveIdentity = "";
    this.seenFollowers = new Set();
  }

  accept(state, event) {
    if (event?.type !== "follow") return true;
    if (SYNTHETIC_SOURCES.has(normalizeKey(event.source))) return true;

    const liveIdentity = followLiveIdentity(state);
    if (liveIdentity !== this.liveIdentity) {
      this.liveIdentity = liveIdentity;
      this.seenFollowers.clear();
    }

    const viewerIdentities = followViewerIdentities(event);
    const fallbackEventIdentity = followEventIdentity(event);
    const identities = viewerIdentities.length
      ? viewerIdentities.map((identity) => `viewer:${identity}`)
      : fallbackEventIdentity
        ? [`event:${fallbackEventIdentity}`]
        : [];
    if (!identities.length) return true;
    if (identities.some((identity) => this.seenFollowers.has(identity))) {
      return false;
    }
    identities.forEach((identity) => this.seenFollowers.add(identity));
    return true;
  }

  clear() {
    this.liveIdentity = "";
    this.seenFollowers.clear();
  }
}

function followLiveIdentity(state = {}) {
  const session = state?.session || {};
  const startedAt = normalizeKey(session.startedAt);
  if (startedAt) return `started:${startedAt}`;
  const roomId = normalizeKey(
    session.tiktokRoomId || state?.settings?.tiktok?.roomId
  );
  return roomId ? `room:${roomId}` : "unscoped";
}

function followViewerIdentity(event = {}) {
  return followViewerIdentities(event)[0] || "";
}

function followViewerIdentities(event = {}) {
  const raw = event?.data?.raw || {};
  const user = raw.user || raw.userInfo || raw.sender || {};
  const candidates = [
    event?.user?.id,
    raw.userId,
    raw.user_id,
    user.id,
    user.userId,
    event?.user?.name,
    raw.uniqueId,
    raw.username,
    user.uniqueId,
    user.username
  ];
  return [
    ...new Set(
      candidates
        .map(normalizeViewerKey)
        .filter(
          (identity) => identity && !ANONYMOUS_VIEWERS.has(identity)
        )
    )
  ];
}

function followEventIdentity(event = {}) {
  const raw = event?.data?.raw || {};
  const eventId = normalizeKey(
    raw.common?.msgId || raw.msgId || raw.id || event.id
  );
  if (!eventId) return "";
  return `${normalizeKey(event.source) || "unknown"}:${eventId}`;
}

function normalizeViewerKey(value) {
  return normalizeKey(value).replace(/^@+/, "");
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .normalize("NFKC")
    .toLocaleLowerCase("en");
}

module.exports = {
  FollowSessionGuard,
  followEventIdentity,
  followLiveIdentity,
  followViewerIdentity,
  followViewerIdentities
};
