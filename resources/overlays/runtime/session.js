"use strict";

/** Hydratation légère pour les overlays d'alertes, de flux et de classement. */
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
  if (title) title.textContent = leaderboardKind === "tappers"
    ? "CLASSEMENT TAPOTEURS"
    : "CLASSEMENT DONATEURS";
  if (title && overlayTitle) title.textContent = overlayTitle;
  if (icon) icon.textContent = leaderboardKind === "tappers" ? "♥" : "♛";
  seedStaticLeaderboardPreview();
  renderLeaderboard();
}
