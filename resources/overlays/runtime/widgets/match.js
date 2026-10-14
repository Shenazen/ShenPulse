"use strict";

/** Lecteur Match : file, tickets vidéo et reprise après inactivité de la source. */

function restartMatchVideo() {
  const video = document.getElementById("match-video");
  if (!video || viewName !== "match") return;
  try {
    matchLastRestartAt = performance.now();
    video.pause();
    video.currentTime = 0;
    if (matchAutoplay) playMatchVideo(video, { isCurrent: () => viewName === "match" &&
      !matchSourceInactive && document.visibilityState !== "hidden",
      onFailure: () => setMatchPlaybackDiagnostic("autoplay-refused") });
  } catch {
    // The static fallback remains visible if the media cannot start.
  }
}

function markMatchSourceInactive() {
  if (viewName !== "match" || isCatalogPreview) return;
  matchSourceInactive = true;
  const video = document.getElementById("match-video");
  if (video) { stopMatchVideoAudio(video); video.pause(); }
}

function reactivateMatchSource() {
  if (
    viewName !== "match" ||
    isCatalogPreview ||
    document.visibilityState === "hidden"
  ) {
    return;
  }
  matchSourceInactive = false;
  if (performance.now() - matchLastRestartAt < 250) return;
  restartMatchVideo();
}

function setupMatchActivationRecovery() {
  if (
    matchActivationRecoveryReady ||
    viewName !== "match" ||
    matchName === "player" ||
    isCatalogPreview
  ) {
    return;
  }
  matchActivationRecoveryReady = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      markMatchSourceInactive();
    } else if (matchSourceInactive) {
      reactivateMatchSource();
    }
  });
  window.addEventListener("pagehide", markMatchSourceInactive);
  window.addEventListener("pageshow", () => {
    if (matchSourceInactive) reactivateMatchSource();
  });
  document.addEventListener("freeze", markMatchSourceInactive);
  document.addEventListener("resume", reactivateMatchSource);

  const monitorSourceRendering = (timestamp) => {
    if (
      matchActivationLastFrameAt > 0 &&
      timestamp - matchActivationLastFrameAt > MATCH_SOURCE_SUSPEND_GAP_MS
    ) {
      reactivateMatchSource();
    }
    matchActivationLastFrameAt = timestamp;
    requestAnimationFrame(monitorSourceRendering);
  };
  requestAnimationFrame(monitorSourceRendering);
}

function normalizedMatchPlayback(payload = {}) {
  const requestedMatch = String(payload.match || "").trim().toLowerCase();
  if (!MATCH_VIDEO_NAMES.has(requestedMatch)) return null;
  const variant = overlayCatalog.normalizeAnimationVariant(requestedMatch, payload.variant);
  if (!variant) return null;
  return {
    requestId: String(payload.requestId || "").trim(),
    match: requestedMatch,
    variant,
    fit: payload.fit === "cover" ? "cover" : "contain"
  };
}

function matchTicketUrl(payload = {}) {
  const query = new URLSearchParams({
    match: String(payload.match || ""),
    variant: String(payload.variant || "tikcontrol"),
    fit: payload.fit === "cover" ? "cover" : "contain"
  });
  if (matchSourceBasePath) {
    return `${matchSourceBasePath}/ticket?${query.toString()}`;
  }
  if (!isPublicMatchSource) return "";
  const source = publicMatchRelayDocument?.matchSource || {};
  const localPort = Number(source.localPort || 0);
  if (
    source.enabled !== true ||
    source.accountNumber !== publicMatchAccountNumber ||
    !Number.isInteger(localPort) ||
    localPort < 1 ||
    localPort > 65_535
  ) {
    return "";
  }
  return `http://127.0.0.1:${localPort}/match-bridge/${encodeURIComponent(
    publicMatchAccountNumber
  )}/${encodeURIComponent(publicMatchChannel)}/ticket?${query.toString()}`;
}

function setMatchPlaybackDiagnostic(reason = "") {
  const stage = document.getElementById("match-video")?.parentElement;
  const previous = document.getElementById("match-playback-error");
  if (!reason) {
    previous?.remove();
    delete document.documentElement.dataset.matchPlaybackError;
    return;
  }
  const labels = {
    "ticket-timeout": "Animation indisponible : ShenPulse ne répond pas. Vérifiez l'accès réseau local de cette source.",
    "ticket-unavailable": "Animation indisponible : vérifiez que ShenPulse est ouvert sur ce PC et que le navigateur autorise l'accès réseau local.",
    "media-timeout": "Le média du match ne répond pas. Vérifiez sa disponibilité.",
    "media-unavailable": "Le média du match ne peut pas être chargé.",
    "video-stalled": "La vidéo du match reste figée dans cette source. Actualisez la source Matchs dans Studio.",
    "autoplay-refused": "Le navigateur refuse la lecture automatique. Autorisez la lecture pour cette source.",
    "audio-unavailable": "Le son du match ne peut pas être lu. Vérifiez le média et l'autorisation de lecture audio."
  };
  document.documentElement.dataset.matchPlaybackError = reason;
  console.warn("[ShenPulse Matchs] Lecture indisponible :", reason);
  if (!stage) return;
  const node = previous || document.createElement("p");
  node.id = "match-playback-error";
  node.setAttribute("role", "status");
  node.textContent = labels[reason] || labels["media-unavailable"];
  Object.assign(node.style, { position: "absolute", bottom: "20px", left: "20px", right: "20px", zIndex: "5",
    padding: "14px 18px", margin: "0", borderRadius: "12px", background: "rgba(16,9,28,.92)",
    color: "#ffffff", font: "20px/1.5 sans-serif", pointerEvents: "none" });
  if (!previous) stage.appendChild(node);
}

function finishMatchPlayback(playbackId = "") {
  if (viewName !== "match" || matchName !== "player") return;
  const video = document.getElementById("match-video");
  if (
    playbackId &&
    video?.dataset.matchPlaybackId &&
    video.dataset.matchPlaybackId !== playbackId
  ) {
    return;
  }
  const stage = video?.parentElement;
  stage?.classList.remove("playing");
  if (video) {
    stopMatchVideoAudio(video);
    if (typeof finishMatchCompatiblePlayback === "function") finishMatchCompatiblePlayback(playbackId);
    // Révocation/remplacement : une réponse de ticket ou un « canplay » déjà
    // en vol ne doit jamais pouvoir rattacher l'ancien média à la source.
    video.matchPlaybackAbort?.abort();
    video.matchPlaybackAbort = null;
    video.matchPlaybackProgress?.stop();
    video.matchPlaybackProgress = null;
    if (video.matchPlaybackDeadline) clearTimeout(video.matchPlaybackDeadline);
    video.matchPlaybackDeadline = null;
    if (video.matchPlaybackCanPlay) {
      video.removeEventListener("canplay", video.matchPlaybackCanPlay);
      video.matchPlaybackCanPlay = null;
    }
    delete video.dataset.matchPlaybackId;
    delete video.dataset.matchPlaybackLoading;
    video.matchPlaybackFailure = null;
    video.pause();
    video.removeAttribute("src");
    video.load();
  }
  matchPlaybackQueue?.complete(playbackId);
}

async function startQueuedMatchPlayback(payload = {}) {
  const request = normalizedMatchPlayback(payload);
  const video = document.getElementById("match-video");
  const title = document.getElementById("match-title");
  if (!request || !video || !title) {
    matchPlaybackQueue?.complete(request?.requestId || "");
    return;
  }

  const playbackId = request.requestId || `${Date.now()}-${request.match}`;
  if (video.dataset.matchPlaybackId) {
    finishMatchPlayback(video.dataset.matchPlaybackId);
  }
  video.dataset.matchPlaybackId = playbackId;
  video.dataset.matchPlaybackLoading = "true";
  title.textContent = MATCH_VIDEO_LABELS[request.match];
  video.loop = false;
  video.autoplay = false;
  // La piste intégrée appartient à l'animation. Le canal sonore optionnel
  // reste indépendant ; il ne doit pas couper les voix/effets de la vidéo.
  video.playsInline = true;
  video.style.objectFit = request.fit;
  video.parentElement?.classList.add("has-video", "playing");
  video.pause();
  video.removeAttribute("src");
  video.load();
  setMatchPlaybackDiagnostic();
  if (typeof startMatchCompatiblePlayback === "function") {
    startMatchCompatiblePlayback(request, playbackId);
  }
  const failPlayback = (reason) => {
    if (video.dataset.matchPlaybackId !== playbackId) return;
    stopMatchVideoAudio(video);
    video.matchPlaybackProgress?.stop();
    video.matchPlaybackProgress = null;
    const compatible = typeof startMatchCompatiblePlayback === "function"
      && startMatchCompatiblePlayback.state?.id === playbackId;
    if (compatible) {
      // Le visuel HTTPS est déjà à l'écran. Le refus du pont local ne doit
      // ni l'effacer ni remplacer ce secours par une grande erreur sur le LIVE.
      document.documentElement.dataset.matchPlaybackError = reason;
      console.warn("[ShenPulse Matchs] Vidéo indisponible, mode compatible :", reason);
      video.matchPlaybackAbort?.abort(); video.matchPlaybackAbort = null;
      if (video.matchPlaybackDeadline) clearTimeout(video.matchPlaybackDeadline);
      video.matchPlaybackDeadline = null;
      if (video.matchPlaybackCanPlay) video.removeEventListener("canplay", video.matchPlaybackCanPlay);
      video.matchPlaybackCanPlay = null;
      video.dataset.matchPlaybackLoading = "true";
      video.pause(); video.removeAttribute("src"); video.load();
      return;
    }
    // Code sans URL, jeton ni données utilisateur, utile au diagnostic Studio.
    setMatchPlaybackDiagnostic(reason);
    finishMatchPlayback(playbackId);
  };
  video.matchPlaybackFailure = failPlayback;

  let source = mediaUrl(`video/${request.match}-${request.variant}.webm`);
  if (matchSourceBasePath || isPublicMatchSource) {
    try {
      const ticketUrl = matchTicketUrl(request);
      if (!ticketUrl) throw new Error("Lecteur Match local indisponible.");
      const controller = new AbortController();
      video.matchPlaybackAbort = controller;
      video.matchPlaybackDeadline = setTimeout(() => {
        controller.abort();
        failPlayback("ticket-timeout");
      }, 8000);
      const response = await fetch(ticketUrl, {
        cache: "no-store",
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Ticket Match refusé (${response.status}).`);
      const ticket = await response.json();
      if (typeof ticket.url !== "string" || !ticket.url.trim()) {
        throw new Error("Ticket Match incomplet.");
      }
      const resolvedSource = new URL(ticket.url, new URL(ticketUrl, location.href));
      if (!["http:", "https:"].includes(resolvedSource.protocol)) {
        throw new Error("Ticket Match invalide.");
      }
      source = resolvedSource.toString();
    } catch {
      failPlayback("ticket-unavailable");
      return;
    }
  }
  if (video.dataset.matchPlaybackId !== playbackId) return;
  if (video.matchPlaybackDeadline) clearTimeout(video.matchPlaybackDeadline);
  video.matchPlaybackAbort = null;
  video.src = source;
  video.load();
  delete video.dataset.matchPlaybackLoading;

  const playFromStart = () => {
    if (video.dataset.matchPlaybackId !== playbackId) return;
    if (video.matchPlaybackDeadline) clearTimeout(video.matchPlaybackDeadline);
    video.matchPlaybackDeadline = null;
    video.matchPlaybackCanPlay = null;
    try {
      video.currentTime = 0;
      if (typeof globalThis.MatchVideoProgress?.watch !== "function") {
        failPlayback("media-unavailable");
        return;
      }
      video.matchPlaybackProgress?.stop();
      video.matchPlaybackProgress = globalThis.MatchVideoProgress.watch(video, {
        isCurrent: () => video.dataset.matchPlaybackId === playbackId,
        onProgress: () => {
          if (video.dataset.matchPlaybackId !== playbackId) return;
          if (typeof finishMatchCompatiblePlayback === "function") finishMatchCompatiblePlayback(playbackId);
          delete document.documentElement.dataset.matchPlaybackError;
        },
        onStall: failPlayback
      });
      playMatchVideo(video, { isCurrent: () => video.dataset.matchPlaybackId === playbackId,
        onFailure: failPlayback });
    } catch {
      failPlayback("media-unavailable");
    }
  };
  if (video.readyState >= 2) playFromStart();
  else {
    video.matchPlaybackCanPlay = playFromStart;
    video.matchPlaybackDeadline = setTimeout(() => failPlayback("media-timeout"), 10000);
    video.addEventListener("canplay", playFromStart, { once: true });
  }
}

function enqueueMatchPlayback(payload = {}) {
  const request = normalizedMatchPlayback(payload);
  if (!request || viewName !== "match") return false;
  if (matchName !== "player") {
    if (request.match !== matchName) return false;
    restartMatchVideo();
    return true;
  }
  if (
    request.requestId &&
    matchPlaybackRequestIds.has(request.requestId)
  ) {
    return false;
  }
  if (request.requestId) {
    matchPlaybackRequestIds.add(request.requestId);
    if (matchPlaybackRequestIds.size > 500) {
      matchPlaybackRequestIds.delete(matchPlaybackRequestIds.values().next().value);
    }
  }
  matchPlaybackQueue?.enqueue(request);
  return true;
}

function stopMatchSourcePlayback() {
  finishMatchPlayback();
  if (typeof finishMatchMediaPlayback === "function") finishMatchMediaPlayback();
  if (typeof stopMatchAudio === "function") stopMatchAudio();
  setMatchPlaybackDiagnostic();
}

function positionStaticMatchPreview(video, expectedSource = video?.dataset.previewSource) {
  if (!isStaticPreview || !video) return;
  const seekToRepresentativeFrame = () => {
    if (
      expectedSource &&
      video.dataset.previewSource &&
      video.dataset.previewSource !== expectedSource
    ) {
      return;
    }
    const duration = Number(video.duration || 0);
    if (!Number.isFinite(duration) || duration <= 0) return;
    const target = Math.min(
      Math.max(0.25, duration * 0.45),
      Math.max(0.25, duration - 0.1)
    );
    const previewKey = expectedSource || video.currentSrc || video.src;
    if (
      video.dataset.previewFrameSource === previewKey &&
      ["playing", "seeking", "ready"].includes(video.dataset.previewFrameStatus)
    ) {
      return;
    }
    video.dataset.previewFrameSource = previewKey;
    const canSeek = Array.from(
      { length: video.seekable.length },
      (_, index) => [
        video.seekable.start(index),
        video.seekable.end(index)
      ]
    ).some(([start, end]) => start <= target && end >= target);
    if (canSeek) {
      video.dataset.previewFrameStatus = "seeking";
      video.pause();
      video.addEventListener("seeked", () => {
        if (video.dataset.previewFrameSource !== previewKey) return;
        video.pause();
        video.dataset.previewFrameStatus = "ready";
      }, { once: true });
      try {
        video.currentTime = target;
      } catch {
        video.dataset.previewFrameStatus = "";
      }
      return;
    }

    // Some imported WebM files do not expose a seekable range. Fast-forwarding
    // them muted produces a representative card image without delaying the UI.
    video.dataset.previewFrameStatus = "playing";
    video.muted = true;
    video.playbackRate = 16;
    const stopOnRepresentativeFrame = () => {
      if (video.dataset.previewFrameSource !== previewKey) return;
      if (video.currentTime >= target || video.ended) {
        video.pause();
        video.playbackRate = 1;
        video.dataset.previewFrameStatus = "ready";
        return;
      }
      if (typeof video.requestVideoFrameCallback === "function") {
        video.requestVideoFrameCallback(stopOnRepresentativeFrame);
      } else {
        requestAnimationFrame(stopOnRepresentativeFrame);
      }
    };
    video.play()
      .then(() => stopOnRepresentativeFrame())
      .catch(() => {
        video.playbackRate = 1;
        video.dataset.previewFrameStatus = "";
      });
    setTimeout(() => {
      if (
        video.dataset.previewFrameSource !== previewKey ||
        video.dataset.previewFrameStatus !== "playing"
      ) {
        return;
      }
      video.pause();
      video.playbackRate = 1;
      video.dataset.previewFrameStatus = video.currentTime > 0 ? "ready" : "";
    }, 1200);
  };
  for (const eventName of ["loadedmetadata", "loadeddata", "canplay"]) {
    video.addEventListener(eventName, seekToRepresentativeFrame, {
      once: true
    });
  }
  requestAnimationFrame(seekToRepresentativeFrame);
  setTimeout(seekToRepresentativeFrame, 80);
  setTimeout(seekToRepresentativeFrame, 300);
}

function setupMatch() {
  const video = document.getElementById("match-video");
  const title = document.getElementById("match-title");
  if (!video || !title) return;
  if (matchName === "player") {
    activeView.classList.add("match-player");
    title.textContent = "MATCH";
    video.loop = false;
    video.autoplay = false;
    if (!matchPlaybackQueue) {
      matchPlaybackQueue = globalThis.MatchPlaybackQueue.create({
        onStart: startQueuedMatchPlayback
      });
      video.addEventListener("ended", () =>
        finishMatchPlayback(video.dataset.matchPlaybackId || "")
      );
      video.addEventListener("error", () => {
        if (video.dataset.matchPlaybackLoading === "true") return;
        if (video.matchPlaybackFailure) {
          video.matchPlaybackFailure("media-unavailable");
          return;
        }
        if (video.dataset.matchPlaybackId) {
          setMatchPlaybackDiagnostic("media-unavailable");
        }
        finishMatchPlayback(video.dataset.matchPlaybackId || "");
      });
    }
    return;
  }
  title.textContent = MATCH_VIDEO_LABELS[matchName] || matchName.toUpperCase();
  const variant = overlayCatalog.normalizeAnimationVariant(matchName, matchVariant);
  if (!variant) {
    if (typeof stopProtectedMatchPreview === "function") stopProtectedMatchPreview(video);
    video.pause(); video.removeAttribute("src"); video.load();
    setMatchPlaybackDiagnostic("media-unavailable");
    return;
  }
  video.loop = matchLoop;
  video.autoplay = isStaticPreview ? false : matchAutoplay;
  video.style.objectFit = matchFit;
  setupMatchActivationRecovery();
  const source = `${matchName}:${variant}`;
  video.dataset.previewSource = source;
  video.addEventListener("canplay", () => {
    video.parentElement?.classList.add("has-video");
    if (isStaticPreview) positionStaticMatchPreview(video, source);
    else if (
      viewName === "match" &&
      video.autoplay &&
      document.visibilityState !== "hidden"
    ) {
      playMatchVideo(video, { isCurrent: () => video.dataset.previewSource === source &&
        document.visibilityState !== "hidden" && !matchSourceInactive,
        onFailure: () => setMatchPlaybackDiagnostic("autoplay-refused") });
    } else if (document.visibilityState === "hidden") {
      markMatchSourceInactive();
    }
  }, { once: true });
  video.addEventListener("ended", () => {
    video.currentTime = 0;
  });
  positionStaticMatchPreview(video, source);
  startProtectedMatchPreview(video, { match: matchName, variant, fit: matchFit }, source);
}
