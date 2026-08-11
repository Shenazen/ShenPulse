"use strict";

const MAX_TRACKED_LIVE_SCOPES = 8;
const SYNTHETIC_SOURCES = new Set([
  "manual-preview",
  "rule-test",
  "simulator",
  "test"
]);
const UNKNOWN_VIEWERS = new Set(["anonymous", "inconnu", "unknown"]);

class FollowSessionGuard {
  constructor({ maxTrackedLiveScopes = MAX_TRACKED_LIVE_SCOPES } = {}) {
    this.maxTrackedLiveScopes = Math.max(
      1,
      Math.trunc(Number(maxTrackedLiveScopes) || MAX_TRACKED_LIVE_SCOPES)
    );
    this.viewersByLiveScope = new Map();
  }

  accept(state, event) {
    if (event?.type !== "follow") return true;
    if (SYNTHETIC_SOURCES.has(normalizeKey(event.source))) return true;

    const liveScope = followLiveScope(state, event);
    const viewer = followViewerIdentity(event);
    if (!liveScope || !viewer) return true;

    let viewers = this.viewersByLiveScope.get(liveScope);
    if (!viewers) {
      viewers = new Set();
      this.viewersByLiveScope.set(liveScope, viewers);
      this.#evictOldLiveScopes();
    } else {
      // Conserver la portée active comme entrée la plus récente pour que les
      // brèves reconnexions TikTok ne la fassent pas sortir du cache.
      this.viewersByLiveScope.delete(liveScope);
      this.viewersByLiveScope.set(liveScope, viewers);
    }

    if (viewers.has(viewer)) return false;
    viewers.add(viewer);
    return true;
  }

  clear() {
    this.viewersByLiveScope.clear();
  }

  #evictOldLiveScopes() {
    while (this.viewersByLiveScope.size > this.maxTrackedLiveScopes) {
      const oldest = this.viewersByLiveScope.keys().next().value;
      this.viewersByLiveScope.delete(oldest);
    }
  }
}

function followLiveScope(state, event) {
  if (state?.session?.running !== true) return "";

  const source = normalizeKey(event?.source) || "unknown";
  const roomId = normalizeKey(state?.settings?.tiktok?.roomId);
  if (roomId && source.includes("tiktok")) {
    const channel = normalizeKey(
      event?.data?.raw?.channelUsername || state?.settings?.tiktok?.username
    );
    return `tiktok:${channel || "channel"}:${roomId}`;
  }

  const startedAt = String(state?.session?.startedAt || "").trim();
  if (!startedAt) return "";
  return `session:${startedAt}`;
}

function followViewerIdentity(event) {
  const source = normalizeKey(event?.source) || "unknown";
  for (const candidate of [event?.user?.id, event?.user?.name]) {
    const viewer = normalizeKey(candidate).replace(/^@+/, "");
    if (viewer && !UNKNOWN_VIEWERS.has(viewer)) {
      return `${source}:${viewer}`;
    }
  }
  return "";
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .normalize("NFKC")
    .toLocaleLowerCase("en");
}

module.exports = {
  FollowSessionGuard,
  followLiveScope,
  followViewerIdentity
};
