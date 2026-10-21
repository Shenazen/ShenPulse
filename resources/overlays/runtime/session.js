"use strict";

/** Hydratation unique : restaure les compteurs, classements et flux de la vue active. */

function hydrateOverlaySession(state = {}, options = {}) {
  const runtime = state.overlaySession || state;
  if (!runtime || runtime.hasData !== true) return false;

  if (viewName === "like-goal") {
    const previousCurrent = likeGoalCurrent;
    cancelLikeGoalCompletion();
    likeGoalCurrent = Math.max(0, Number(runtime.likeGoalCurrent || 0));
    if (options.animate === true && likeGoalCurrent !== previousCurrent) {
      renderLikeGoalChange(previousCurrent);
    } else {
      renderLikeGoal();
    }
    return true;
  }

  if (viewName === "coin-jar") {
    coinJarCurrent = Math.max(
      coinJarMinimum,
      Number(runtime.coinJarCurrent || 0)
    );
    const recentEvents = Array.isArray(runtime.recentEvents)
      ? runtime.recentEvents
      : [];
    recentEvents
      .filter((event) => event.type === "gift")
      .slice(0, 40)
      .reverse()
      .forEach((event) => spawnCoinJarDrop(event));
    renderCoinJar();
    return true;
  }

  if (viewName === "win-counter") {
    winCounter = Number(runtime.winCounterCurrent || 0);
  }
  const multiplierUntil = Number(runtime.winCounterMultiplierUntil || 0);
  const multiplierSeconds = Math.max(
    0,
    Math.ceil((multiplierUntil - Date.now()) / 1000)
  );
  winCounterMultiplier =
    multiplierSeconds > 0
      ? Math.max(1, Number(runtime.winCounterMultiplier || 1))
      : 1;
  if (viewName === "timer") {
    const timerEndsAt = Number(runtime.timerEndsAt || 0);
    const persistedTimerSeconds = runtime.timerPaused
      ? Math.max(0, Number(runtime.timerSeconds || 0))
      : timerEndsAt > 0
        ? Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000))
        : Math.max(0, Number(runtime.timerSeconds || 0));
    updateTimer({
      operation: "set",
      seconds: persistedTimerSeconds,
      paused: runtime.timerPaused === true,
      label: overlayTitle || runtime.timerLabel || "TEMPS RESTANT"
    });
  }
  if (viewName === "multiplier-timer") {
    const multiplierTimerEndsAt = Number(
      runtime.multiplierTimerEndsAt || multiplierUntil || 0
    );
    const persistedMultiplierSeconds = runtime.multiplierTimerPaused
      ? Math.max(0, Number(runtime.multiplierTimerSeconds || 0))
      : multiplierTimerEndsAt > 0
        ? Math.max(
            0,
            Math.ceil((multiplierTimerEndsAt - Date.now()) / 1000)
          )
        : multiplierSeconds;
    updateMultiplierTimer({
      operation: "set",
      seconds: persistedMultiplierSeconds,
      paused: runtime.multiplierTimerPaused === true,
      multiplier:
        runtime.multiplierTimerMultiplier || winCounterMultiplier,
      label:
        overlayTitle || runtime.multiplierTimerLabel || "BONUS ACTIF"
    });
  }

  if (viewName === "leaderboard") {
    leaderboardScores.clear();
    const entries = runtime.leaderboards?.[leaderboardKind] || [];
    for (const entry of entries) {
      const key = String(entry.id || entry.name || "");
      if (!key) continue;
      leaderboardScores.set(key, {
        avatarUrl: safeLeaderboardAvatarUrl(entry.avatarUrl),
        name: String(entry.name || "Viewer"),
        score: Math.max(0, Number(entry.score || 0))
      });
    }
    seedStaticLeaderboardPreview();
    renderLeaderboard();
  }

  if (["feed", "my-actions"].includes(viewName)) {
    feed = Array.isArray(runtime.recentEvents)
      ? runtime.recentEvents.slice(0, 6)
      : [];
    if (viewName === "feed") renderFeed();
    if (viewName === "my-actions") {
      myActions = feed.slice(0, 5).map((event) => ({
        icon: icons[event.type] || "\u26A1",
        title: event.user?.displayName || event.user?.name || "Viewer",
        detail: eventDetail(event),
        at: new Date(event.timestamp || Date.now())
      }));
      renderMyActions();
    }
  }

  if (viewName === "win-counter") renderWinCounter();
  return true;
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
  if (title) (title.firstElementChild || title).textContent = leaderboardKind === "tappers"
    ? "CLASSEMENT TAPOTEURS"
    : "CLASSEMENT DONATEURS";
  if (title && overlayTitle) (title.firstElementChild || title).textContent = overlayTitle;
  if (icon) icon.textContent = leaderboardKind === "tappers" ? "♥" : "♛";
  seedStaticLeaderboardPreview();
  renderLeaderboard();
}
