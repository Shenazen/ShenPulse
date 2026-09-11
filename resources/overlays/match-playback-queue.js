"use strict";

(function exposeMatchPlaybackQueue(globalScope) {
  function create({ onStart } = {}) {
    if (typeof onStart !== "function") {
      throw new TypeError("MatchPlaybackQueue exige une fonction onStart.");
    }

    let current = null;

    return {
      enqueue(payload) {
        const previous = current;
        current = payload;
        try {
          onStart(current, previous);
        } catch {
          if (current === payload) current = null;
          return "failed";
        }
        if (!previous) return "started";
        return previous.match === payload.match &&
          previous.variant === payload.variant
          ? "restarted"
          : "replaced";
      },
      complete(requestId = "") {
        if (!current) return false;
        if (
          requestId &&
          current.requestId &&
          current.requestId !== requestId
        ) {
          return false;
        }
        current = null;
        return true;
      },
      clear() {
        const hadCurrent = Boolean(current);
        current = null;
        return hadCurrent;
      },
      snapshot() {
        return {
          active: Boolean(current),
          current,
          pending: []
        };
      }
    };
  }

  const api = { create };
  globalScope.MatchPlaybackQueue = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
