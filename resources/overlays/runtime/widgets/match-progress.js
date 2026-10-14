"use strict";

/**
 * Surveille uniquement la lecture en cours, jamais une source au repos.
 * Résoudre play() ne garantit pas que Studio décode effectivement des images :
 * le secours n'est retiré qu'après une progression du média. Les callbacks,
 * délais et observations sont annulés au remplacement ou à la révocation.
 */
(function exposeMatchVideoProgress(globalScope) {
  function watch(video, {
    isCurrent = () => true, onProgress = () => {}, onStall = () => {},
    startupTimeoutMs = 1800, stallTimeoutMs = 2000, maxDurationMs = 90000
  } = {}) {
    let active = true, timer = null, frame = null, confirmed = false;
    let useFrames = typeof video?.requestVideoFrameCallback === "function";
    const startedAt = Date.now();
    let lastProgressAt = startedAt, observedTime = Number(video?.currentTime) || 0;
    const initialTime = observedTime;
    const startupLimit = Math.max(200, Math.min(10000, Number(startupTimeoutMs) || 1800));
    const stallLimit = Math.max(200, Math.min(10000, Number(stallTimeoutMs) || 2000));
    const durationLimit = Math.max(2000, Math.min(120000, Number(maxDurationMs) || 90000));

    function stop() {
      if (!active) return;
      active = false;
      if (timer !== null) globalScope.clearTimeout(timer);
      if (frame !== null && typeof video?.cancelVideoFrameCallback === "function") {
        video.cancelVideoFrameCallback(frame);
      }
      timer = null; frame = null;
    }

    function remainsCurrent() {
      if (!active) return false;
      if (!video || !isCurrent() || video.ended) { stop(); return false; }
      return true;
    }

    function observe(mediaTime) {
      if (!remainsCurrent()) return;
      const value = Number(mediaTime);
      if (!Number.isFinite(value) || value <= observedTime + 0.001) return;
      observedTime = value;
      lastProgressAt = Date.now();
      if (!confirmed && value >= initialTime + 0.025) {
        confirmed = true;
        onProgress();
      }
    }

    function nextFrame() {
      if (!remainsCurrent() || !useFrames) return;
      try {
        frame = video.requestVideoFrameCallback((_timestamp, metadata = {}) => {
          frame = null;
          if (!remainsCurrent()) return;
          observe(Number.isFinite(Number(metadata.mediaTime)) ? metadata.mediaTime : video.currentTime);
          nextFrame();
        });
      } catch {
        // Certains moteurs CEF anciens exposent une méthode non utilisable.
        // Leur horloge vidéo reste une preuve meilleure que la promesse play().
        frame = null; useFrames = false;
      }
    }

    function check() {
      timer = null;
      if (!remainsCurrent()) return;
      if (!useFrames) observe(video.currentTime);
      if (!active) return;
      const now = Date.now();
      const expired = now - startedAt >= durationLimit;
      const stalled = confirmed ? now - lastProgressAt >= stallLimit : now - startedAt >= startupLimit;
      if (expired || stalled) {
        stop();
        onStall(expired ? "media-timeout" : "video-stalled");
        return;
      }
      timer = globalScope.setTimeout(check, 200);
    }

    if (remainsCurrent()) {
      nextFrame();
      timer = globalScope.setTimeout(check, 200);
    }
    return { stop };
  }

  const api = { watch };
  globalScope.MatchVideoProgress = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
