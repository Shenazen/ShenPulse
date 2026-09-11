"use strict";

/**
 * Initialisation de la roue, des classements et des vidéos Match.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

function setupWheel() {
  const wheel = document.getElementById("wheel");
  if (!wheel) return;
  applyWheelSettings();
  drawWheel(wheelRuntimeChoices, wheelParameterColors);
}

function wheelBoolean(value, fallback) {
  return typeof value === "boolean" ? value : value === undefined ? fallback : value !== "false";
}

function applyWheelSettings(settings = {}) {
  wheelRuntimeSettings = { ...wheelRuntimeSettings, ...settings };
  const stage = document.getElementById("wheel-stage");
  const machine = document.getElementById("wheel-machine");
  if (!stage || !machine) return;
  const runtimeDesign = settings.design || document.documentElement.dataset.wheelDesign || wheelDesign;
  document.documentElement.dataset.wheelDesign = runtimeDesign;
  stage.classList.toggle("royal", runtimeDesign === "royal");
  stage.classList.toggle("wheel-overlay--royal", runtimeDesign === "royal");
  stage.classList.toggle("wheel-overlay--classic", runtimeDesign !== "royal");
  stage.classList.toggle(
    "without-base",
    !wheelBoolean(wheelRuntimeSettings.showBase, true)
  );
  stage.classList.toggle(
    "idle-hidden",
    !wheelBoolean(wheelRuntimeSettings.alwaysVisible, true)
  );
  stage.dataset.pointer = wheelRuntimeSettings.pointerPosition || "top";
  const pointer = document.getElementById("wheel-pointer");
  if (pointer) {
    pointer.className = `wheel-pointer wheel-pointer--${wheelRuntimeSettings.pointerPosition || "top"}`;
  }
  stage.dataset.textOrientation = wheelRuntimeSettings.textOrientation || "horizontal";
  stage.classList.toggle(
    "wheel-overlay--text-clamp",
    wheelBoolean(wheelRuntimeSettings.textClamp, true)
  );
  machine.style.setProperty(
    "--wheel-font",
    JSON.stringify(String(wheelRuntimeSettings.font || "Kalam"))
  );
  machine.style.setProperty(
    "--wheel-font-size",
    `${0.48 + Math.min(120, Math.max(10, Number(wheelRuntimeSettings.fontSize || 50))) / 100}rem`
  );
  machine.style.setProperty("--wheel-text-color", wheelRuntimeSettings.textColor || "#fff8ec");
  machine.style.setProperty("--wheel-shadow-color", wheelRuntimeSettings.textShadowColor || "#2b170c");
  machine.style.setProperty(
    "--wheel-shadow-strength",
    Math.min(100, Math.max(0, Number(wheelRuntimeSettings.textShadowStrength || 55))) / 100 * 7
  );
  machine.style.setProperty(
    "--wheel-text-radius",
    `${Math.min(135, Math.max(20, Number(wheelRuntimeSettings.textRadius || 100)))}%`
  );
  machine.style.setProperty(
    "--wheel-text-offset",
    `${Math.min(100, Math.max(-100, Number(wheelRuntimeSettings.textSegmentOffset || 0)))}px`
  );
  machine.style.setProperty(
    "--wheel-text-width",
    `${Math.min(260, Math.max(45, Number(wheelRuntimeSettings.textBoxWidth || 100)))}px`
  );
  machine.style.setProperty(
    "--wheel-text-height",
    `${Math.min(320, Math.max(20, Number(wheelRuntimeSettings.textBoxHeight || 240)))}px`
  );
  machine.style.setProperty(
    "--wheel-angle-offset",
    `${Math.min(180, Math.max(-180, Number(wheelRuntimeSettings.textAngleOffset || 0)))}deg`
  );
  machine.style.setProperty(
    "--wheel-line-spacing",
    0.84 + Math.min(100, Math.max(0, Number(wheelRuntimeSettings.lineSpacing || 50))) / 140
  );
  machine.style.setProperty(
    "--wheel-letter-spacing",
    `${(Math.min(100, Math.max(0, Number(wheelRuntimeSettings.letterSpacing || 50))) - 50) / 900}em`
  );
  machine.style.setProperty(
    "--wheel-glow",
    Math.min(140, Math.max(0, Number(wheelRuntimeSettings.glow || 82))) / 100
  );
  machine.style.setProperty("--wheel-local-scale", "1");
  machine.style.setProperty(
    "--wheel-spin-duration",
    `${Math.min(30, Math.max(1, Number(wheelRuntimeSettings.spinDuration || 5)))}s`
  );
}

function drawWheel(choices, customColors = []) {
  const wheel = document.getElementById("wheel");
  if (!wheel || !choices.length) return;
  const segmentAngle = 360 / choices.length;
  document
    .getElementById("wheel-frame")
    ?.style.setProperty("--segment-angle", `${segmentAngle}deg`);
  wheel.style.setProperty("--segment-angle", `${segmentAngle}deg`);
  const design = document.documentElement.dataset.wheelDesign || wheelDesign;
  const colors = customColors.length
    ? customColors
    : design === "royal"
    ? ["#5f310b", "#eabf65", "#1d143b", "#ca8f2e", "#fff0a6", "#6f3b13"]
    : ["#ff6a00", "#111111", "#f59f00", "#2a1207", "#ff8a1f", "#1e1e1e"];
  const step = 100 / choices.length;
  wheel.style.background = `conic-gradient(from 0deg, ${choices.map((_choice, index) => `${colors[index % colors.length]} ${index * step}% ${(index + 1) * step}%`).join(",")})`;
  wheel.replaceChildren(...choices.map((choice, index) => {
    const label = document.createElement("span");
    label.className = "segment-label";
    const copy = document.createElement("span");
    copy.textContent = choice;
    label.append(copy);
    label.style.setProperty("--segment", index);
    label.style.setProperty("--segments", choices.length);
    label.style.setProperty(
      "--label-angle",
      `${360 / choices.length * (index + 0.5)}deg`
    );
    label.style.setProperty(
      "--label-inverse-angle",
      `${-360 / choices.length * (index + 0.5)}deg`
    );
    label.dataset.orientation = wheelRuntimeSettings.textOrientation || "radial";
    label.style.textAlign = wheelRuntimeSettings.textAlign || "center";
    const layout = wheelSegmentLabelStyle(index, choices.length, choice);
    Object.entries(layout.styles).forEach(
      ([property, value]) => label.style.setProperty(property, value)
    );
    label.dataset.fontScale = String(layout.fontScale);
    label.dataset.orientation = layout.orientation;
    if (wheelBoolean(wheelRuntimeSettings.textClamp, true)) {
      copy.style.webkitLineClamp = String(
        layout.maxLines
      );
    } else {
      label.classList.add("unclamped");
    }
    return label;
  }));
  renderWheelDecorations(choices.length);
  requestAnimationFrame(syncWheelResponsiveTypography);
}

function wheelSegmentLabelStyle(index, segmentCount, label = "") {
  const design = document.documentElement.dataset.wheelDesign || wheelDesign;
  const layout = globalThis.WheelLayout.resolveSegmentLayout({
    index,
    segmentCount,
    label,
    design,
    settings: wheelRuntimeSettings
  });
  return {
    fontScale: layout.fontScale,
    maxLines: layout.maxLines,
    orientation: layout.orientation,
    styles: {
      "--segment-label-x": `${layout.x.toFixed(3)}%`,
      "--segment-label-y": `${layout.y.toFixed(3)}%`,
      "--segment-label-rotation": `${layout.rotation.toFixed(3)}deg`,
      "--segment-label-width": `${layout.widthPercent.toFixed(3)}%`,
      "--segment-label-cross-size": `${layout.heightPercent.toFixed(3)}%`,
      "--segment-font-scale": layout.fontScale
    }
  };
}

function syncWheelResponsiveTypography() {
  const wheel = document.getElementById("wheel");
  if (!wheel) return;
  const diameter = wheel.getBoundingClientRect().width || 420;
  const responsiveScale = Math.min(1.35, Math.max(.72, diameter / 420));
  const configuredSize = Math.min(
    120,
    Math.max(10, Number(wheelRuntimeSettings.fontSize || 50))
  );
  const baseFontPixels = (0.48 + configuredSize / 100) * 16;
  wheel.querySelectorAll(".segment-label").forEach((label) => {
    const scale = Number(label.dataset.fontScale || 1);
    const pixels = Math.min(34, Math.max(8, baseFontPixels * scale * responsiveScale));
    label.querySelector("span")?.style.setProperty("font-size", `${pixels.toFixed(2)}px`);
  });
}

function renderWheelDecorations(segmentCount) {
  const frame = document.getElementById("wheel-frame");
  const wheel = document.getElementById("wheel");
  if (!frame || !wheel) return;
  frame
    .querySelectorAll("[data-wheel-decoration]")
    .forEach((element) => element.remove());
  const addOrbit = (className, count, radius, prefix) => {
    for (let index = 0; index < count; index += 1) {
      const angle = (360 / count) * index - 90;
      const radians = (angle * Math.PI) / 180;
      const decoration = document.createElement("span");
      decoration.className = className;
      decoration.dataset.wheelDecoration = "true";
      decoration.style.setProperty(`--${prefix}-x`, `${50 + Math.cos(radians) * radius}%`);
      decoration.style.setProperty(`--${prefix}-y`, `${50 + Math.sin(radians) * radius}%`);
      decoration.style.setProperty(`--${prefix}-rotation`, `${angle + 90}deg`);
      frame.insertBefore(decoration, wheel);
    }
  };
  addOrbit("rim-star wheel-rim-star", 28, 53.2, "rim-star");
  addOrbit("royal-light wheel-royal-light", 18, 52.2, "royal-light");
  addOrbit(
    "royal-bead wheel-royal-bead",
    Math.max(2, Math.min(24, Number(segmentCount) || 2)),
    45.8,
    "royal-bead"
  );
}

function seedStaticLeaderboardPreview() {
  if (
    !isStaticPreview ||
    viewName !== "leaderboard" ||
    leaderboardScores.size
  ) {
    return;
  }
  [
    ["APERÇU 1", leaderboardKind === "tappers" ? 2450 : 820],
    ["APERÇU 2", leaderboardKind === "tappers" ? 1870 : 540],
    ["APERÇU 3", leaderboardKind === "tappers" ? 920 : 310]
  ].forEach(([name, score], index) => leaderboardScores.set(`demo-${index}`, {
    avatarUrl: "",
    name,
    score
  }));
}

function setupLeaderboard() {
  const title = document.getElementById("leaderboard-title");
  const icon = document.getElementById("leaderboard-icon");
  if (title) title.textContent = leaderboardKind === "tappers"
    ? "CLASSEMENT TAPOTEURS"
    : "CLASSEMENT DONATEURS";
  if (title && overlayTitle) title.textContent = overlayTitle;
  if (icon) icon.textContent = leaderboardKind === "tappers" ? "♥" : "♛";
  seedStaticLeaderboardPreview();
  renderLeaderboard();
}

function markMatchSourceInactive() {
  if (viewName !== "match" || isCatalogPreview) return;
  matchSourceInactive = true;
  document.getElementById("match-video")?.pause();
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
  const requestedVariant = String(payload.variant || "tikcontrol")
    .trim()
    .toLowerCase();
  return {
    requestId: String(payload.requestId || "").trim(),
    match: requestedMatch,
    variant:
      requestedMatch === "enigma" || !MATCH_VIDEO_VARIANTS.has(requestedVariant)
        ? "tikcontrol"
        : requestedVariant,
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
  video.dataset.matchPlaybackId = playbackId;
  video.dataset.matchPlaybackLoading = "true";
  title.textContent = MATCH_VIDEO_LABELS[request.match];
  video.loop = false;
  video.autoplay = false;
  video.style.objectFit = request.fit;
  video.parentElement?.classList.add("has-video", "playing");
  video.pause();
  video.removeAttribute("src");
  video.load();

  let source = mediaUrl(`video/${request.match}-${request.variant}.webm`);
  if (matchSourceBasePath || isPublicMatchSource) {
    try {
      const ticketUrl = matchTicketUrl(request);
      if (!ticketUrl) throw new Error("Lecteur Match local indisponible.");
      const response = await fetch(ticketUrl, {
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`Ticket Match refusé (${response.status}).`);
      const ticket = await response.json();
      source = new URL(String(ticket.url || ""), ticketUrl).toString();
      if (!source) throw new Error("Ticket Match incomplet.");
    } catch {
      finishMatchPlayback(playbackId);
      return;
    }
  }
  if (video.dataset.matchPlaybackId !== playbackId) return;
  video.src = source;
  video.load();
  delete video.dataset.matchPlaybackLoading;

  const playFromStart = () => {
    if (video.dataset.matchPlaybackId !== playbackId) return;
    try {
      video.currentTime = 0;
      video.play().catch(() => finishMatchPlayback(playbackId));
    } catch {
      finishMatchPlayback(playbackId);
    }
  };
  if (video.readyState >= 2) playFromStart();
  else video.addEventListener("canplay", playFromStart, { once: true });
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
        finishMatchPlayback(video.dataset.matchPlaybackId || "");
      });
    }
    return;
  }
  title.textContent = MATCH_VIDEO_LABELS[matchName] || matchName.toUpperCase();
  const variant = matchName === "enigma" ? "tikcontrol" : matchVariant;
  video.loop = matchLoop;
  video.autoplay = isStaticPreview ? false : matchAutoplay;
  video.style.objectFit = matchFit;
  setupMatchActivationRecovery();
  const source = mediaUrl(`video/${matchName}-${variant}.webm`);
  video.dataset.previewSource = source;
  video.addEventListener("canplay", () => {
    video.parentElement?.classList.add("has-video");
    if (isStaticPreview) positionStaticMatchPreview(video, source);
    else if (
      viewName === "match" &&
      video.autoplay &&
      document.visibilityState !== "hidden"
    ) {
      video.play().catch(() => {});
    } else if (document.visibilityState === "hidden") {
      markMatchSourceInactive();
    }
  }, { once: true });
  video.addEventListener("ended", () => {
    video.currentTime = 0;
  });
  video.src = source;
  positionStaticMatchPreview(video, source);
  video.load();
}
