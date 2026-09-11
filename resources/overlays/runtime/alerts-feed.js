"use strict";

let likeGoalDisplayedCurrent = likeGoalCurrent;
let likeGoalAnimationFrame = 0;

/**
 * Alertes, audio, objectifs, flux et classements.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

function eventDetail(event) {
  if (event.type === "chat") return event.data.message;
  if (event.type === "gift") return `${event.data.giftName} ×${event.data.count}`;
  if (event.type === "like") return `${event.data.count} likes`;
  return event.type;
}

function showAlert(payload) {
  const payloadScreen = Math.min(
    8,
    Math.max(1, Math.round(Number(payload.screen) || 1))
  );
  if (parameters.has("screen") && payloadScreen !== mediaScreen) return;
  revealOverlay();
  alertQueue.push(payload);
  addMyAction({
    icon: "✦",
    title: payload.title || "Media",
    detail: payload.message || "Action exécutée"
  });
  drainAlerts();
}

function addMyAction(payload) {
  const stage = document.getElementById("my-actions-stage");
  if (!stage) return;
  myActions.unshift({
    icon: payload.icon || "⚡",
    title: payload.title || "Action exécutée",
    detail: payload.detail || "",
    at: new Date()
  });
  myActions = myActions.slice(0, 5);
  renderMyActions();
}

function renderMyActions() {
  const stage = document.getElementById("my-actions-stage");
  if (!stage) return;
  stage.innerHTML = myActions.slice(0, overlayMaxRows).map((item) => `
    <article>
      <span>${escapeHtml(item.icon)}</span>
      <div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></div>
      <time>${item.at.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</time>
    </article>
  `).join("");
}

async function drainAlerts() {
  if (alertRunning || !alertQueue.length) return;
  alertRunning = true;
  const payload = alertQueue.shift();
  const stage = document.getElementById("alert-stage");
  const mediaOnly = payload.displayMode === "media-only";
  if (mediaOnly && !payload.mediaUrl) {
    alertRunning = false;
    drainAlerts();
    return;
  }
  const duration = Math.max(
    700,
    parameters.has("displayTime")
      ? overlayDisplayTime * 1000
      : Number(payload.durationMs || 5000)
  );
  const node = document.createElement("article");
  node.className = mediaOnly
    ? "alert media-only"
    : `alert${payload.mediaUrl ? " has-media" : ""}`;
  node.dataset.animation = overlayAnimation;
  node.style.setProperty("--alert-color", payload.color || "#A855F7");
  node.style.setProperty("--alert-duration", `${duration}ms`);
  node.innerHTML = mediaOnly
    ? `<div class="alert-media-only">${actionMediaMarkup(payload.mediaUrl)}</div>`
    : `
      <div class="alert-icon">${actionMediaMarkup(payload.mediaUrl)}</div>
      <div><strong>${escapeHtml(payload.title || "Nouvelle interaction")}</strong><span>${escapeHtml(payload.message || "")}</span></div>
      <div class="alert-progress"></div>`;
  stage.classList.toggle("media-only-stage", mediaOnly);
  stage.replaceChildren(node);
  if (
    overlaySoundEnabled &&
    payload.soundUrl &&
    /^https?:|^data:|^blob:/i.test(payload.soundUrl)
  ) {
    const audio = new Audio(payload.soundUrl);
    audio.volume = overlaySoundVolume;
    audio.play().catch(() => {});
  }
  await new Promise((resolve) => setTimeout(resolve, duration));
  node.classList.add("leaving");
  await new Promise((resolve) => setTimeout(resolve, 430));
  node.remove();
  stage.classList.remove("media-only-stage");
  if (overlayPauseTime) {
    await new Promise((resolve) => setTimeout(resolve, overlayPauseTime * 1000));
  }
  alertRunning = false;
  drainAlerts();
}

const liveAudioQueue = [];
const handledPlaybackIds = new Set();
let liveAudioRunning = false;

function queueLivePlayback(type, payload = {}) {
  const playbackId = String(payload.playbackId || "").trim();
  if (playbackId && handledPlaybackIds.has(playbackId)) return;
  if (playbackId) {
    handledPlaybackIds.add(playbackId);
    if (handledPlaybackIds.size > 500) {
      handledPlaybackIds.delete(handledPlaybackIds.values().next().value);
    }
  }
  liveAudioQueue.push({ type, payload });
  drainLiveAudioQueue();
}

async function drainLiveAudioQueue() {
  if (liveAudioRunning || !liveAudioQueue.length) return;
  liveAudioRunning = true;
  const entry = liveAudioQueue.shift();
  try {
    if (entry.type === "audio") {
      await playLiveAudio(entry.payload);
    } else if (entry.type === "tts") {
      await playLiveTts(entry.payload);
    }
  } finally {
    liveAudioRunning = false;
    drainLiveAudioQueue();
  }
}

function playLiveAudio(payload = {}) {
  const url = String(payload.url || "").trim();
  if (!/^https?:|^data:|^blob:/i.test(url)) return Promise.resolve();
  return new Promise((resolve) => {
    const audio = new Audio(url);
    audio.preload = "auto";
    audio.volume = Math.min(1, Math.max(0, Number(payload.volume ?? 1)));
    const done = () => resolve();
    audio.addEventListener("ended", done, { once: true });
    audio.addEventListener("error", done, { once: true });
    audio.play().catch(done);
  });
}

function playLiveTts(payload = {}) {
  const text = String(payload.text || "").trim();
  if (!text || !("speechSynthesis" in window)) return Promise.resolve();
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = Number(payload.rate || 1);
    utterance.pitch = Number(payload.pitch || 1);
    utterance.volume = Math.min(
      1,
      Math.max(0, Number(payload.volume ?? 1))
    );
    if (payload.voice) {
      const voice = window.speechSynthesis
        .getVoices()
        .find((entry) => entry.name === payload.voice);
      if (voice) utterance.voice = voice;
    }
    utterance.lang = utterance.voice?.lang || payload.language || "fr-FR";
    utterance.addEventListener("end", resolve, { once: true });
    utterance.addEventListener("error", resolve, { once: true });
    window.speechSynthesis.speak(utterance);
  });
}

function actionMediaMarkup(value = "") {
  const url = String(value || "").trim();
  if (!url) return "✦";
  const safeUrl = escapeHtml(url);
  if (/\.json(?:[?#]|$)/i.test(url)) {
    return `<lottie-player src="${safeUrl}" background="transparent" speed="1" loop autoplay></lottie-player>`;
  }
  if (/\.(?:mp4|webm)(?:[?#]|$)/i.test(url)) {
    return `<video src="${safeUrl}" autoplay loop muted playsinline></video>`;
  }
  return `<img src="${safeUrl}" alt="">`;
}

function renderGoals() {
  const stage = document.getElementById("goals-stage");
  stage.innerHTML = goals
    .filter((goal) => goal.enabled)
    .map((goal) => {
      const progress = Math.min(100, Math.max(0, (Number(goal.current) / Math.max(1, Number(goal.target))) * 100));
      return `<article class="overlay-panel goal">
        <div class="goal-title"><strong>${escapeHtml(goal.name)}</strong><span>${Math.round(progress)}%</span></div>
        <div class="goal-bar"><span style="width:${progress}%;--goal-color:${escapeHtml(goal.color || "#EC4899")}"></span></div>
        <div class="goal-numbers"><span>${formatNumber(goal.current)}</span><span>${formatNumber(goal.target)}</span></div>
      </article>`;
    })
    .join("");
}

function cancelLikeGoalCompletion() {
  if (!likeGoalCompletionTimer) return;
  clearTimeout(likeGoalCompletionTimer);
  likeGoalCompletionTimer = null;
}

function cancelLikeGoalAnimation() {
  if (!likeGoalAnimationFrame) return;
  cancelAnimationFrame(likeGoalAnimationFrame);
  likeGoalAnimationFrame = 0;
}

function paintLikeGoal(displayedCurrent) {
  const current = Math.max(0, Math.round(Number(displayedCurrent || 0)));
  const target = likeGoalTarget;
  const progressRange = Math.max(1, target - likeGoalBaseline);
  const progress = Math.min(
    100,
    Math.max(0, ((current - likeGoalBaseline) / progressRange) * 100)
  );
  const title = document.getElementById("like-goal-title");
  const currentLabel = document.getElementById("like-goal-current");
  const targetLabel = document.getElementById("like-goal-target");
  const percentLabel = document.getElementById("like-goal-percent");
  const progressLabel = document.getElementById("like-goal-progress-label");
  const bar = document.getElementById("like-goal-progress");
  if (title) title.textContent = overlayTitle || "LIKE GOAL";
  if (title) title.hidden = !showHeader;
  if (currentLabel) currentLabel.textContent = formatNumber(current);
  if (targetLabel) targetLabel.textContent = formatNumber(target);
  if (percentLabel) {
    percentLabel.textContent = `${Math.round(progress)}%`;
    percentLabel.hidden = !showPercent;
  }
  if (progressLabel) {
    progressLabel.textContent = likeGoalProgressLabel;
    progressLabel.hidden = !showGoal || !likeGoalProgressLabel;
  }
  if (bar) bar.style.width = `${progress}%`;
}

function animateLikeGoal() {
  cancelLikeGoalAnimation();
  const from = Number.isFinite(likeGoalDisplayedCurrent)
    ? likeGoalDisplayedCurrent
    : likeGoalCurrent;
  const to = likeGoalCurrent;
  const distance = Math.abs(to - from);
  if (distance < 0.5) {
    likeGoalDisplayedCurrent = to;
    paintLikeGoal(to);
    return;
  }
  const duration = Math.min(
    850,
    Math.max(260, 260 + Math.log10(distance + 1) * 140)
  );
  const startedAt = performance.now();
  const tick = (now) => {
    const progress = Math.min(1, Math.max(0, (now - startedAt) / duration));
    const eased = 1 - Math.pow(1 - progress, 3);
    likeGoalDisplayedCurrent = from + (to - from) * eased;
    paintLikeGoal(likeGoalDisplayedCurrent);
    if (progress < 1) {
      likeGoalAnimationFrame = requestAnimationFrame(tick);
      return;
    }
    likeGoalAnimationFrame = 0;
    likeGoalDisplayedCurrent = to;
    paintLikeGoal(to);
  };
  likeGoalAnimationFrame = requestAnimationFrame(tick);
}

function renderLikeGoal(options = {}) {
  const preserveTarget =
    options.preserveTarget ?? Boolean(likeGoalCompletionTimer);
  const forceVisible = options.forceVisible === true;
  const completion = globalThis.LikeGoalPolicy.resolveCompletion(
    likeGoalCurrent,
    likeGoalInitialTarget,
    likeGoalWhenReached
  );
  if (!preserveTarget) likeGoalTarget = completion.target;
  document
    .getElementById("like-goal-view")
    ?.classList.toggle(
      "like-goal-reached-hidden",
      forceVisible ? false : completion.hidden
    );
  if (options.animate === true) {
    animateLikeGoal();
    return;
  }
  cancelLikeGoalAnimation();
  likeGoalDisplayedCurrent = likeGoalCurrent;
  paintLikeGoal(likeGoalCurrent);
}

function renderLikeGoalChange(previousCurrent) {
  const previous = Math.max(0, Number(previousCurrent || 0));
  const completedTarget = Math.max(1, Number(likeGoalTarget || 1));
  const crossedTarget =
    previous < completedTarget && likeGoalCurrent >= completedTarget;

  if (likeGoalCompletionTimer) {
    if (likeGoalCurrent >= completedTarget) {
      renderLikeGoal({ preserveTarget: true, forceVisible: true, animate: true });
      return;
    }
    cancelLikeGoalCompletion();
  }

  if (!crossedTarget) {
    renderLikeGoal({ animate: true });
    return;
  }

  likeGoalTarget = completedTarget;
  renderLikeGoal({ preserveTarget: true, forceVisible: true, animate: true });
  likeGoalCompletionTimer = setTimeout(() => {
    likeGoalCompletionTimer = null;
    renderLikeGoal();
  }, 1200);
}

function updateLikeGoal(payload = {}) {
  revealOverlay();
  const operation = String(payload.operation || "adjust");
  const amount = Number(payload.amount || 0);
  const synchronizedCurrent = Number(payload.current);
  const previousCurrent = likeGoalCurrent;
  likeGoalCurrent = Number.isFinite(synchronizedCurrent)
    ? Math.max(0, synchronizedCurrent)
    : operation === "reset"
      ? 0
      : operation === "set"
        ? Math.max(0, amount)
        : Math.max(0, likeGoalCurrent + amount);
  renderLikeGoalChange(previousCurrent);
}

function addFeedEvent(event, options = {}) {
  const eventId = String(event?.id || "").trim();
  if (eventId && interactiveEventIds.has(eventId)) return;
  if (eventId) {
    interactiveEventIds.add(eventId);
    if (interactiveEventIds.size > 500) {
      interactiveEventIds.delete(interactiveEventIds.values().next().value);
    }
  }
  revealOverlay();
  feed.unshift(event);
  feed = feed.slice(0, 6);
  renderFeed();
  if (options.skipInteractiveState !== true) updateInteractiveWidgets(event);
}

function renderFeed() {
  const stage = document.getElementById("feed-stage");
  if (!stage) return;
  stage.innerHTML = feed
    .map((item) => `<div class="feed-row">
      <span class="feed-icon">${icons[item.type] || "•"}</span>
      <span><strong>${escapeHtml(item.user?.displayName || "Viewer")}</strong><small>${escapeHtml(eventDetail(item))}</small></span>
      <span class="feed-time">${new Date(item.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
    </div>`)
    .join("");
}

function updateInteractiveWidgets(event) {
  const viewer = event.user?.displayName || event.user?.username || "Viewer";
  addMyAction({
    icon: icons[event.type] || "⚡",
    title: viewer,
    detail: eventDetail(event)
  });

  if (event.type === "gift") {
    const giftCount = Math.max(1, Number(event.data?.count || 1));
    const coins = Math.max(1, Number(event.data?.value || 1)) * giftCount;
    if (leaderboardKind === "donors") updateLeaderboardScore(event, coins);
    coinJarCurrent += coins;
    spawnCoinJarDrop(event);
    renderCoinJar();
  }

  if (event.type === "like") {
    const likes = Math.max(1, Number(event.data?.count || 1));
    const previousCurrent = likeGoalCurrent;
    likeGoalCurrent += likes;
    renderLikeGoalChange(previousCurrent);
    if (leaderboardKind === "tappers") {
      updateLeaderboardScore(event, likes);
    }
  }
  renderLeaderboard();
}

function safeLeaderboardAvatarUrl(value) {
  const candidate = String(value || "").trim();
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function updateLeaderboardScore(event, amount) {
  const user = event.user || {};
  const name = user.displayName || user.name || "Viewer";
  const key = String(user.id || user.name || name);
  const current = leaderboardScores.get(key) || {
    avatarUrl: "",
    name,
    score: 0
  };
  leaderboardScores.set(key, {
    avatarUrl: safeLeaderboardAvatarUrl(user.avatarUrl) || current.avatarUrl,
    name,
    score: current.score + Math.max(0, Number(amount) || 0)
  });
}

function renderLeaderboard() {
  const stage = document.getElementById("leaderboard-rows");
  if (!stage) return;
  const maxRows = Math.min(5, overlayMaxRows);
  const ranking = [...leaderboardScores.values()]
    .sort((left, right) =>
      right.score - left.score || left.name.localeCompare(right.name, "fr")
    )
    .slice(0, maxRows);
  const rows = Array.from({ length: maxRows }, (_value, index) => ranking[index] || null);
  stage.style.setProperty("--leaderboard-row-count", String(maxRows));
  stage.innerHTML = rows.map((entry, index) => {
    if (!entry) return `<article class="leaderboard-row is-empty" aria-hidden="true"></article>`;
    const avatarUrl = safeLeaderboardAvatarUrl(entry.avatarUrl);
    const medalPath = leaderboardRankMedals[index];
    const ringPath = leaderboardRankRings[index];
    return `
      <article class="leaderboard-row leaderboard-position-${index + 1}">
        <span class="leaderboard-rank" ${showRank ? "" : "hidden"}>
          ${showRankBadges && medalPath ? `<img class="leaderboard-rank-medal" src="${escapeHtml(mediaUrl(medalPath))}" alt="">` : ""}
          <b class="leaderboard-rank-number">${index + 1}</b>
        </span>
        <span class="leaderboard-avatar-shell ${showAvatars && avatarUrl ? "has-avatar-image" : ""}" ${showAvatars ? "" : "hidden"}>
          ${showAvatars && avatarUrl ? `<img class="leaderboard-avatar-image" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(entry.name)}" referrerpolicy="no-referrer">` : ""}
          <span class="leaderboard-avatar-fallback">${escapeHtml(entry.name.slice(0, 1).toUpperCase())}</span>
          ${showRankBadges && ringPath ? `<img class="leaderboard-avatar-ring" src="${escapeHtml(mediaUrl(ringPath))}" alt="">` : ""}
          ${showCrown && index === 0 ? `<img class="leaderboard-crown" src="${escapeHtml(mediaUrl(leaderboardRankCrown))}" alt="">` : ""}
        </span>
        <span class="leaderboard-identity">
          <strong>${escapeHtml(entry.name)}</strong>
          <em ${showMetricLabel ? "" : "hidden"}>${formatNumber(entry.score)} ${leaderboardKind === "tappers" ? "likes" : "coins"}</em>
        </span>
      </article>
    `;
  }).join("");
  stage.querySelectorAll(".leaderboard-avatar-image").forEach((image) => {
    image.addEventListener("error", () => {
      image.hidden = true;
      image.closest(".leaderboard-avatar-shell")?.classList.remove("has-avatar-image");
    }, { once: true });
  });
}
