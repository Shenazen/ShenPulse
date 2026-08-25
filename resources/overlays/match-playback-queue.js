"use strict";

(function exposeMatchPlaybackQueue(globalScope) {
  function create({ onStart } = {}) {
    if (typeof onStart !== "function") {
      throw new TypeError("MatchPlaybackQueue exige une fonction onStart.");
    }

    const pending = [];
    let current = null;

    const startNext = () => {
      if (current || !pending.length) return;
      current = pending.shift();
      try {
        onStart(current);
      } catch {
        current = null;
        startNext();
      }
    };

    return {
      enqueue(payload) {
        pending.push(payload);
        const position = pending.length + (current ? 1 : 0);
        startNext();
        return position;
      },
      complete() {
        if (!current) return false;
        current = null;
        startNext();
        return true;
      },
      clear() {
        pending.length = 0;
      },
      snapshot() {
        return {
          active: Boolean(current),
          current,
          pending: [...pending]
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
