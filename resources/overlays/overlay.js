"use strict";

const parameters = new URLSearchParams(location.search);
const viewName = parameters.get("view") || "alerts";
const token = parameters.get("token") || "";
const relayChannel = parameters.get("channel") || "";
const relayDatabaseUrl =
  "https://shenazenoverlay-default-rtdb.firebaseio.com";
const mediaScreen = Math.min(
  8,
  Math.max(1, Math.round(Number(parameters.get("screen")) || 1))
);
const hasMediaScreen = parameters.has("screen");
const previewMode = parameters.get("preview") || "";
const isStaticPreview = previewMode === "static";
const isCatalogPreview =
  isStaticPreview || previewMode === "animated";
let themeName = parameters.get("theme") || "classic";
let jarModel = parameters.get("model") || "fantasy";
let wheelDesign = parameters.get("design") || "classic";
const leaderboardKind = parameters.get("kind") === "tappers" ? "tappers" : "donors";
const matchName = parameters.get("match") || "x2";
let matchVariant = parameters.get("variant") || "tikcontrol";
let overlayScale = Math.min(1.8, Math.max(0.5, Number(parameters.get("scale") || 100) / 100));
let overlayX = Math.min(1000, Math.max(-1000, Number(parameters.get("x") || 0)));
let overlayY = Math.min(1000, Math.max(-1000, Number(parameters.get("y") || 0)));
let overlayTitle = parameters.get("title") || "";
let showHeader = parameters.get("showHeader") !== "false";
let showGoal = parameters.get("showGoal") !== "false";
let showBase = parameters.get("showBase") !== "false";
let showPercent = parameters.get("showPercent") !== "false";
let showRank = parameters.get("showRank") !== "false";
let showHours = parameters.get("showHours") !== "false";
let showShadow = parameters.get("showShadow") !== "false";
let showWhenIdle = parameters.get("showWhenIdle") !== "false";
let overlayEnabled = parameters.get("enabled") !== "false";
let allowNegative = parameters.get("allowNegative") !== "false";
let showAvatars = parameters.get("showAvatars") !== "false";
let showCrown = parameters.get("showCrown") !== "false";
let showRankBadges = parameters.get("showRankBadges") !== "false";
let showMetricLabel = parameters.get("showMetricLabel") !== "false";
let timerAutoStart = parameters.get("timerAutoStart") === "true";
let timerTitleScale = Math.min(2, Math.max(.5, Number(parameters.get("timerTitleScale") || 100) / 100));
let timerValueScale = Math.min(2, Math.max(.5, Number(parameters.get("timerValueScale") || 100) / 100));
const overlaySoundEnabled = parameters.get("soundEnabled") !== "false";
const overlaySoundVolume = Math.min(1, Math.max(0, Number(parameters.get("soundVolume") || 70) / 100));
const overlayDisplayTime = Math.min(120, Math.max(1, Number(parameters.get("displayTime") || 8)));
const overlayPauseTime = Math.min(30, Math.max(0, Number(parameters.get("pauseTime") || 2)));
const overlayAnimation = parameters.get("animation") || "pop";
let overlayFontSize = viewName === "wheel"
  ? 1
  : Math.min(2, Math.max(.5, Number(parameters.get("fontSize") || 100) / 100));
let overlayBackgroundOpacity = Math.min(100, Math.max(0, Number(parameters.get("backgroundOpacity") || 82)));
let leaderboardRowOpacity = Math.min(100, Math.max(0, Number(parameters.get("rowOpacity") || 68)));
let likeGoalBaseline = Math.max(0, Number(parameters.get("goalBaseline") || 0));
let likeGoalProgressLabel = String(parameters.get("progressLabel") || "likes").trim();
let likeGoalTitleX = Math.min(500, Math.max(-500, Number(parameters.get("titleX") || 0)));
let likeGoalTitleY = Math.min(500, Math.max(-500, Number(parameters.get("titleY") || 0)));
let likeGoalTitleScale = Math.min(2, Math.max(.5, Number(parameters.get("titleScale") || 100) / 100));
let likeGoalTitleColor = parameters.get("titleColor") || parameters.get("textColor") || "#ffffff";
let likeGoalContentX = Math.min(500, Math.max(-500, Number(parameters.get("contentX") || 0)));
let likeGoalContentY = Math.min(500, Math.max(-500, Number(parameters.get("contentY") || 0)));
let likeGoalContentScale = Math.min(2, Math.max(.5, Number(parameters.get("contentScale") || 100) / 100));
let likeGoalContentColor = parameters.get("contentColor") || parameters.get("textColor") || "#ffffff";
let likeGoalPercentColor = parameters.get("percentColor") || parameters.get("secondary") || "#ff4f86";
let overlayMaxRows = Math.min(12, Math.max(1, Number(parameters.get("maxRows") || 5)));
let matchFit = parameters.get("fit") === "cover" ? "cover" : "contain";
let matchAutoplay = parameters.get("autoplay") !== "false";
let matchLoop = parameters.get("loop") !== "false";
let multiplierValue = Math.min(5, Math.max(2, Number(parameters.get("multiplier") || 2)));
let wheelParameterColors = String(parameters.get("colors") || "")
  .split("|")
  .map((color) => color.trim())
  .filter(Boolean);
let wheelRuntimeChoices = String(parameters.get("choices") || "Cadeau mystère|+30 secondes|Bonus x2|Défi du chat|Effet de jeu|Relancer")
  .split("|")
  .map((choice) => choice.trim())
  .filter(Boolean)
  .slice(0, 16);
let wheelRuntimeSettings = {
  font: parameters.get("font") || "Kalam",
  fontSize: Number(parameters.get("fontSize") || 50),
  textOrientation: parameters.get("textOrientation") || "horizontal",
  textColor: parameters.get("textColor") || "#fff8ec",
  textShadowColor: parameters.get("textShadowColor") || "#2b170c",
  textShadowStrength: Number(parameters.get("textShadowStrength") || 55),
  textRadius: Number(parameters.get("textRadius") || 100),
  textSegmentOffset: Number(parameters.get("textSegmentOffset") || 0),
  textBoxWidth: Number(parameters.get("textBoxWidth") || 100),
  textBoxHeight: Number(parameters.get("textBoxHeight") || 240),
  textAngleOffset: Number(parameters.get("textAngleOffset") || 0),
  textAlign: parameters.get("textAlign") || "center",
  textClamp: parameters.get("textClamp") === "true",
  textMaxLines: Number(parameters.get("textMaxLines") || 4),
  lineSpacing: Number(parameters.get("lineSpacing") || 50),
  letterSpacing: Number(parameters.get("letterSpacing") || 50),
  showBase,
  soundActive: parameters.get("soundActive") !== "false",
  announceDuration: Number(parameters.get("announceDuration") || 3),
  spinDuration: Number(parameters.get("spinDuration") || 5),
  waitDuration: Number(parameters.get("waitDuration") || 3),
  scale: Number(parameters.get("scale") || 100),
  glow: Number(parameters.get("glow") || 82),
  showWinner: parameters.get("showWinner") !== "false",
  pointerPosition: parameters.get("pointerPosition") || "top",
  alwaysVisible: parameters.get("alwaysVisible") !== "false",
  entranceAnimation: parameters.get("entranceAnimation") || "fade",
  exitAnimation: parameters.get("exitAnimation") || "fade",
  resultDuration: Number(parameters.get("resultDuration") || 4)
};
const activeView = document.getElementById(`${viewName}-view`) || document.getElementById("alerts-view");
activeView.classList.add("active");
document.documentElement.dataset.theme = themeName;
document.documentElement.dataset.jarModel = jarModel;
document.documentElement.dataset.wheelDesign = wheelDesign;
document.documentElement.style.setProperty("--overlay-scale", overlayScale);
document.documentElement.style.setProperty("--overlay-x", `${overlayX}px`);
document.documentElement.style.setProperty("--overlay-y", `${overlayY}px`);
document.documentElement.style.setProperty("--cyan", parameters.get("accent") || "#22d3ee");
document.documentElement.style.setProperty("--overlay-text", parameters.get("textColor") || "#ffffff");
document.documentElement.style.setProperty("--overlay-secondary", parameters.get("secondary") || "#ff4f86");
document.documentElement.style.setProperty("--overlay-background", parameters.get("background") || "#111315");
document.documentElement.style.setProperty("--overlay-background-opacity", `${overlayBackgroundOpacity}%`);
document.documentElement.style.setProperty("--overlay-shadow-color", parameters.get("shadowColor") || "#000000");
document.documentElement.style.setProperty("--overlay-font-size", overlayFontSize);
document.documentElement.style.setProperty("--timer-title-scale", timerTitleScale);
document.documentElement.style.setProperty("--timer-value-scale", timerValueScale);
document.documentElement.style.setProperty("--like-goal-title-x", `${likeGoalTitleX}px`);
document.documentElement.style.setProperty("--like-goal-title-y", `${likeGoalTitleY}px`);
document.documentElement.style.setProperty("--like-goal-title-scale", likeGoalTitleScale);
document.documentElement.style.setProperty("--like-goal-title-color", likeGoalTitleColor);
document.documentElement.style.setProperty("--like-goal-content-x", `${likeGoalContentX}px`);
document.documentElement.style.setProperty("--like-goal-content-y", `${likeGoalContentY}px`);
document.documentElement.style.setProperty("--like-goal-content-scale", likeGoalContentScale);
document.documentElement.style.setProperty("--like-goal-content-color", likeGoalContentColor);
document.documentElement.style.setProperty("--like-goal-percent-color", likeGoalPercentColor);
document.documentElement.style.setProperty("--leaderboard-name-color", parameters.get("nameColor") || "#ffffff");
document.documentElement.style.setProperty("--leaderboard-score-color", parameters.get("scoreColor") || "#ffe575");
document.documentElement.style.setProperty("--leaderboard-rank-color", parameters.get("rankColor") || "#ffe575");
document.documentElement.style.setProperty("--leaderboard-row-opacity", `${leaderboardRowOpacity / 100}`);
activeView.style.fontFamily = parameters.get("font") || "Inter";
activeView.style.direction = parameters.get("rtl") === "true" ? "rtl" : "ltr";
activeView.style.filter = `saturate(${Math.min(200, Math.max(0, Number(parameters.get("saturation") || 100)))}%) hue-rotate(${Math.min(180, Math.max(-180, Number(parameters.get("hue") || 0)))}deg)`;
activeView.classList.toggle("overlay-without-shadow", !showShadow);
activeView.classList.toggle("overlay-idle-hidden", !isCatalogPreview && !showWhenIdle);
activeView.classList.toggle("overlay-config-disabled", !overlayEnabled);
activeView.dataset.layout = parameters.get("layout") || "wide";

const icons = {
  gift: "🎁",
  follow: "＋",
  like: "♥",
  chat: "✦",
  share: "↗",
  subscribe: "★",
  join: "→",
  raid: "⚡"
};

let goals = [];
let feed = [];
let timerSeconds = Math.max(0, Number(parameters.get("seconds") || 0));
let timerHandle = null;
let timerPaused = false;
let winCounter = Number(parameters.get("current") || parameters.get("value") || 0);
let winCounterTarget = Math.max(1, Number(parameters.get("target") || 20));
let winCounterNegativeColor = parameters.get("negativeColor") || "#ff4f6d";
let winCounterNeutralColor = parameters.get("neutralColor") || "#f8fafc";
let winCounterPositiveColor = parameters.get("positiveColor") || "#31ff74";
let winCounterLabelX = Number(parameters.get("labelX") || 0);
let winCounterLabelY = Number(parameters.get("labelY") || 0);
let winCounterMultiplier = 1;
let winCounterMultiplierTimer = null;
let coinJarMinimum = Math.max(0, Number(parameters.get("minCoins") || 0));
let coinJarCurrent = Math.max(
  coinJarMinimum,
  Number(parameters.get("current") || 0)
);
let coinJarTarget = Math.max(1, Number(parameters.get("target") || 1000));
const coinJarDrops = [];
const coinJarEventIds = new Set();
const coinJarSpawnTimers = new Set();
let coinJarSpawnGeneration = 0;
let coinJarAnimationFrame = 0;
let coinJarAnimationTimestamp = 0;
let coinJarSettledFrames = 0;
let coinJarGeometry = null;
let likeGoalCurrent = Math.max(0, Number(parameters.get("current") || 0));
let likeGoalInitialTarget = Math.max(
  1,
  Number(parameters.get("target") || 50000)
);
let likeGoalTarget = likeGoalInitialTarget;
let likeGoalWhenReached = globalThis.LikeGoalPolicy.normalizeBehavior(
  parameters.get("whenReached")
);
let likeGoalCompletionTimer = null;
const leaderboardScores = new Map();
const leaderboardRankMedals = [
  "widgets/leaderboard/rank-medal-1.webp",
  "widgets/leaderboard/rank-medal-2.webp",
  "widgets/leaderboard/rank-medal-3.webp"
];
const leaderboardRankRings = [
  "widgets/leaderboard/rank-ring-1.webp",
  "widgets/leaderboard/rank-ring-2.webp",
  "widgets/leaderboard/rank-ring-3.webp"
];
const leaderboardRankCrown = "widgets/leaderboard/rank-crown.webp";
let myActions = [];
const interactiveEventIds = new Set();
const alertQueue = [];
let alertRunning = false;
let overlayIdleTimer = null;
let wheelSoundStopper = null;
const wheelSpinQueue = [];
let wheelSpinActive = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatNumber(value) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function revealOverlay() {
  if (overlayIdleTimer) clearTimeout(overlayIdleTimer);
  activeView.classList.remove("overlay-idle-hidden");
  if (!showWhenIdle) {
    overlayIdleTimer = setTimeout(() => {
      activeView.classList.add("overlay-idle-hidden");
      overlayIdleTimer = null;
    }, (overlayDisplayTime + overlayPauseTime) * 1000);
  }
}

function mediaUrl(relativePath) {
  if (relayChannel) {
    if (/^lottie\/[^/]+\.json$/i.test(relativePath)) {
      return `https://tikfinity.zerody.one/assets/lotties/${encodeURIComponent(
        String(relativePath).slice("lottie/".length)
      )}`;
    }
    return `/media/${String(relativePath)
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/")}`;
  }
  return `/overlay/media/${relativePath}?token=${encodeURIComponent(token)}`;
}

function setThemeFrame(elementId, kind, classicPath = "") {
  const element = document.getElementById(elementId);
  if (!element) return;
  const path = themeName === "classic"
    ? classicPath
    : `widgets/interactive-overlays/${kind}-theme-${themeName}.png`;
  if (!path) {
    element.hidden = true;
    element.removeAttribute("src");
    return;
  }
  element.src = mediaUrl(path);
  element.hidden = false;
}

function setupOverlayDesign() {
  if (viewName === "like-goal") {
    setThemeFrame(
      "like-goal-frame",
      "like-goal",
      "widgets/goals/banniere_mystique_transparente_1300x200.png"
    );
    const frame = document.getElementById("like-goal-frame");
    document.querySelectorAll(".like-goal-frame-slice").forEach((slice) => {
      slice.src = frame?.src || "";
      slice.hidden = !frame?.src || frame.hidden;
    });
  }
  if (viewName === "leaderboard") setThemeFrame("leaderboard-frame", "leaderboard");
  if (viewName === "timer") setThemeFrame("timer-frame", "timer");
  if (viewName === "multiplier-timer") setThemeFrame("multiplier-timer-frame", "timer");
  if (viewName === "win-counter") setThemeFrame("win-counter-frame", "win-counter");

  if (viewName === "coin-jar") {
    const jarBack = document.getElementById("coin-jar-back");
    const jarFront = document.getElementById("coin-jar-front");
    if (jarBack && jarFront) {
      const backName = jarModel === "fantasy"
        ? "jar-test-back-clean-localized.png"
        : `jar-${jarModel}-back.png`;
      const frontName = jarModel === "fantasy"
        ? "jar-test-front-smooth8.png"
        : `jar-${jarModel}-front.png`;
      jarBack.src = mediaUrl(`widgets/coin-jar/${backName}`);
      jarFront.src = mediaUrl(`widgets/coin-jar/${frontName}`);
    }
  }

  setupConfiguration();
  if (viewName === "wheel") {
    document.getElementById("wheel-stage")?.classList.toggle("royal", wheelDesign === "royal");
    setupWheel();
  }
  if (viewName === "leaderboard") setupLeaderboard();
  if (viewName === "match") setupMatch();
  if (viewName === "coin-jar") renderCoinJar();
  if (viewName === "win-counter") renderWinCounter();
}

function updatePreviewDesign(payload = {}) {
  const value = String(payload.value || "").trim();
  if (!value) return;
  if (payload.parameter === "model") {
    jarModel = value;
    document.documentElement.dataset.jarModel = value;
  } else if (payload.parameter === "design") {
    wheelDesign = value;
    document.documentElement.dataset.wheelDesign = value;
  } else if (payload.parameter === "variant") {
    matchVariant = value;
  } else {
    themeName = value;
    document.documentElement.dataset.theme = value;
  }
  setupOverlayDesign();
}

function previewBoolean(payload, key, current) {
  return Object.prototype.hasOwnProperty.call(payload, key)
    ? String(payload[key]) !== "false"
    : current;
}

function previewNumber(payload, key, current, min, max) {
  if (!Object.prototype.hasOwnProperty.call(payload, key)) return current;
  const value = Number(payload[key]);
  if (!Number.isFinite(value)) return current;
  return Math.min(max, Math.max(min, value));
}

function updatePreviewConfiguration(payload = {}) {
  const previousTheme = themeName;
  const previousModel = jarModel;
  const previousDesign = wheelDesign;
  const previousVariant = matchVariant;

  if (payload.theme) themeName = String(payload.theme);
  if (payload.model) jarModel = String(payload.model);
  if (payload.design) wheelDesign = String(payload.design);
  if (payload.variant) matchVariant = String(payload.variant);
  document.documentElement.dataset.theme = themeName;
  document.documentElement.dataset.jarModel = jarModel;
  document.documentElement.dataset.wheelDesign = wheelDesign;

  overlayScale = previewNumber(payload, "scale", overlayScale * 100, 50, 180) / 100;
  overlayX = previewNumber(payload, "x", overlayX, -1000, 1000);
  overlayY = previewNumber(payload, "y", overlayY, -1000, 1000);
  overlayFontSize = viewName === "wheel"
    ? 1
    : previewNumber(payload, "fontSize", overlayFontSize * 100, 50, 200) / 100;
  overlayBackgroundOpacity = previewNumber(
    payload,
    "backgroundOpacity",
    overlayBackgroundOpacity,
    0,
    100
  );
  leaderboardRowOpacity = previewNumber(
    payload,
    "rowOpacity",
    leaderboardRowOpacity,
    0,
    100
  );
  overlayMaxRows = Math.round(
    previewNumber(payload, "maxRows", overlayMaxRows, 1, 12)
  );
  overlayTitle = Object.prototype.hasOwnProperty.call(payload, "title")
    ? String(payload.title || "")
    : overlayTitle;
  likeGoalBaseline = previewNumber(
    payload,
    "goalBaseline",
    likeGoalBaseline,
    0,
    999999999
  );
  likeGoalTitleX = previewNumber(payload, "titleX", likeGoalTitleX, -500, 500);
  likeGoalTitleY = previewNumber(payload, "titleY", likeGoalTitleY, -500, 500);
  likeGoalTitleScale = previewNumber(
    payload,
    "titleScale",
    likeGoalTitleScale * 100,
    50,
    200
  ) / 100;
  likeGoalTitleColor = payload.titleColor || likeGoalTitleColor;
  likeGoalContentX = previewNumber(payload, "contentX", likeGoalContentX, -500, 500);
  likeGoalContentY = previewNumber(payload, "contentY", likeGoalContentY, -500, 500);
  likeGoalContentScale = previewNumber(
    payload,
    "contentScale",
    likeGoalContentScale * 100,
    50,
    200
  ) / 100;
  likeGoalContentColor = payload.contentColor || likeGoalContentColor;
  likeGoalPercentColor = payload.percentColor || likeGoalPercentColor;
  likeGoalProgressLabel = Object.prototype.hasOwnProperty.call(payload, "progressLabel")
    ? String(payload.progressLabel || "").trim()
    : likeGoalProgressLabel;
  likeGoalWhenReached = Object.prototype.hasOwnProperty.call(payload, "whenReached")
    ? globalThis.LikeGoalPolicy.normalizeBehavior(payload.whenReached)
    : likeGoalWhenReached;
  showHeader = previewBoolean(payload, "showHeader", showHeader);
  showGoal = previewBoolean(payload, "showGoal", showGoal);
  showBase = previewBoolean(payload, "showBase", showBase);
  showPercent = previewBoolean(payload, "showPercent", showPercent);
  showRank = previewBoolean(payload, "showRank", showRank);
  showHours = previewBoolean(payload, "showHours", showHours);
  showShadow = previewBoolean(payload, "showShadow", showShadow);
  showWhenIdle = previewBoolean(payload, "showWhenIdle", showWhenIdle);
  overlayEnabled = previewBoolean(payload, "enabled", overlayEnabled);
  allowNegative = previewBoolean(payload, "allowNegative", allowNegative);
  showAvatars = previewBoolean(payload, "showAvatars", showAvatars);
  showCrown = previewBoolean(payload, "showCrown", showCrown);
  showRankBadges = previewBoolean(payload, "showRankBadges", showRankBadges);
  showMetricLabel = previewBoolean(payload, "showMetricLabel", showMetricLabel);
  timerAutoStart = previewBoolean(payload, "timerAutoStart", timerAutoStart);
  timerTitleScale = previewNumber(
    payload,
    "timerTitleScale",
    timerTitleScale * 100,
    50,
    200
  ) / 100;
  timerValueScale = previewNumber(
    payload,
    "timerValueScale",
    timerValueScale * 100,
    50,
    200
  ) / 100;
  matchAutoplay = previewBoolean(payload, "autoplay", matchAutoplay);
  matchLoop = previewBoolean(payload, "loop", matchLoop);
  matchFit = payload.fit === "cover" ? "cover" : payload.fit ? "contain" : matchFit;

  if (Object.prototype.hasOwnProperty.call(payload, "current")) {
    const current = Number(payload.current || 0);
    if (viewName === "like-goal") likeGoalCurrent = Math.max(0, current);
    if (viewName === "coin-jar") coinJarCurrent = Math.max(coinJarMinimum, current);
    if (viewName === "win-counter") {
      winCounter = allowNegative ? current : Math.max(0, current);
    }
  }
  if (Object.prototype.hasOwnProperty.call(payload, "target")) {
    const target = Math.max(1, Number(payload.target || 1));
    if (viewName === "like-goal") {
      likeGoalInitialTarget = target;
      likeGoalTarget = target;
    }
    if (viewName === "coin-jar") coinJarTarget = target;
    if (viewName === "win-counter") winCounterTarget = target;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "seconds")) {
    timerSeconds = Math.max(0, Number(payload.seconds || 0));
  }
  coinJarMinimum = previewNumber(
    payload,
    "minCoins",
    coinJarMinimum,
    0,
    999999999
  );
  multiplierValue = Math.round(
    previewNumber(payload, "multiplier", multiplierValue, 2, 5)
  );
  winCounterNegativeColor = payload.negativeColor || winCounterNegativeColor;
  winCounterNeutralColor = payload.neutralColor || winCounterNeutralColor;
  winCounterPositiveColor = payload.positiveColor || winCounterPositiveColor;
  winCounterLabelX = previewNumber(payload, "labelX", winCounterLabelX, -500, 500);
  winCounterLabelY = previewNumber(payload, "labelY", winCounterLabelY, -500, 500);

  document.documentElement.style.setProperty("--overlay-scale", overlayScale);
  document.documentElement.style.setProperty("--overlay-x", `${overlayX}px`);
  document.documentElement.style.setProperty("--overlay-y", `${overlayY}px`);
  document.documentElement.style.setProperty("--cyan", payload.accent || parameters.get("accent") || "#22d3ee");
  document.documentElement.style.setProperty("--overlay-secondary", payload.secondary || parameters.get("secondary") || "#ff4f86");
  document.documentElement.style.setProperty("--overlay-text", payload.textColor || parameters.get("textColor") || "#ffffff");
  document.documentElement.style.setProperty("--overlay-background", payload.background || parameters.get("background") || "#111315");
  document.documentElement.style.setProperty("--overlay-background-opacity", `${overlayBackgroundOpacity}%`);
  document.documentElement.style.setProperty("--overlay-font-size", overlayFontSize);
  document.documentElement.style.setProperty("--timer-title-scale", timerTitleScale);
  document.documentElement.style.setProperty("--timer-value-scale", timerValueScale);
  document.documentElement.style.setProperty("--like-goal-title-x", `${likeGoalTitleX}px`);
  document.documentElement.style.setProperty("--like-goal-title-y", `${likeGoalTitleY}px`);
  document.documentElement.style.setProperty("--like-goal-title-scale", likeGoalTitleScale);
  document.documentElement.style.setProperty("--like-goal-title-color", likeGoalTitleColor);
  document.documentElement.style.setProperty("--like-goal-content-x", `${likeGoalContentX}px`);
  document.documentElement.style.setProperty("--like-goal-content-y", `${likeGoalContentY}px`);
  document.documentElement.style.setProperty("--like-goal-content-scale", likeGoalContentScale);
  document.documentElement.style.setProperty("--like-goal-content-color", likeGoalContentColor);
  document.documentElement.style.setProperty("--like-goal-percent-color", likeGoalPercentColor);
  document.documentElement.style.setProperty("--leaderboard-name-color", payload.nameColor || parameters.get("nameColor") || "#ffffff");
  document.documentElement.style.setProperty("--leaderboard-score-color", payload.scoreColor || parameters.get("scoreColor") || "#ffe575");
  document.documentElement.style.setProperty("--leaderboard-rank-color", payload.rankColor || parameters.get("rankColor") || "#ffe575");
  document.documentElement.style.setProperty("--leaderboard-row-opacity", `${leaderboardRowOpacity / 100}`);
  activeView.style.fontFamily = payload.font || parameters.get("font") || "Inter";
  activeView.style.direction = String(payload.rtl) === "true" ? "rtl" : "ltr";
  const saturation = previewNumber(payload, "saturation", 100, 0, 200);
  const hue = previewNumber(payload, "hue", 0, -180, 180);
  activeView.style.filter = `saturate(${saturation}%) hue-rotate(${hue}deg)`;
  activeView.classList.toggle("overlay-without-shadow", !showShadow);
  activeView.classList.toggle("overlay-idle-hidden", !showWhenIdle);
  activeView.classList.toggle("overlay-config-disabled", !overlayEnabled);

  if (payload.colors !== undefined) {
    wheelParameterColors = String(payload.colors || "").split("|").filter(Boolean);
  }
  if (payload.choices !== undefined) {
    wheelRuntimeChoices = String(payload.choices || "")
      .split("|")
      .map((choice) => choice.trim())
      .filter(Boolean)
      .slice(0, 16);
  }
  const wheelSettingKeys = [
    "font",
    "fontSize",
    "textOrientation",
    "textColor",
    "textShadowColor",
    "textShadowStrength",
    "textRadius",
    "textSegmentOffset",
    "textBoxWidth",
    "textBoxHeight",
    "textAngleOffset",
    "textAlign",
    "textClamp",
    "textMaxLines",
    "lineSpacing",
    "letterSpacing",
    "showBase",
    "soundActive",
    "announceDuration",
    "spinDuration",
    "waitDuration",
    "scale",
    "glow",
    "showWinner",
    "pointerPosition",
    "alwaysVisible",
    "entranceAnimation",
    "exitAnimation",
    "resultDuration",
    "design"
  ];
  const wheelSettings = {};
  for (const key of wheelSettingKeys) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) wheelSettings[key] = payload[key];
  }

  const designChanged =
    previousTheme !== themeName ||
    previousModel !== jarModel ||
    previousDesign !== wheelDesign ||
    previousVariant !== matchVariant;
  if (designChanged) {
    setupOverlayDesign();
    if (viewName === "wheel") {
      applyWheelSettings(wheelSettings);
      drawWheel(wheelRuntimeChoices, wheelParameterColors);
    }
  } else {
    setupConfiguration();
    if (viewName === "wheel") {
      applyWheelSettings(wheelSettings);
      drawWheel(wheelRuntimeChoices, wheelParameterColors);
    }
    if (viewName === "match") {
      const video = document.getElementById("match-video");
      if (video) {
        video.loop = matchLoop;
        video.autoplay = isStaticPreview ? false : matchAutoplay;
        video.style.objectFit = matchFit;
        if (isStaticPreview) {
          video.pause();
          positionStaticMatchPreview(video);
        } else if (matchAutoplay) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      }
    }
  }
  renderLikeGoal();
  renderCoinJar();
  renderWinCounter();
  renderTimer();
  renderLeaderboard();
  renderMyActions();
}

function activeOverlayConfigKey() {
  if (viewName === "leaderboard") {
    return leaderboardKind === "tappers" ? "topTappers" : "topDonors";
  }
  if (viewName === "match") {
    return {
      x2: "matchX2",
      x3: "matchX3",
      guantes: "matchGants",
      cofre: "matchCoffre",
      snipe: "matchSnipe",
      taptap: "matchTapTap",
      quiereme: "matchQuiereme",
      enigma: "matchEnigma"
    }[matchName] || "";
  }
  return {
    alerts: "alerts",
    "my-actions": "myActions",
    goals: "goals",
    "like-goal": "likeGoal",
    feed: "feed",
    game: "game",
    "coin-jar": "coinJar",
    timer: "timer",
    "multiplier-timer": "multiplierTimer",
    "win-counter": "winCounter",
    wheel: "wheel"
  }[viewName] || "";
}

function configurationWithoutRuntimeReset(configuration = {}) {
  if (isCatalogPreview) return configuration;
  const next = { ...configuration };
  delete next.current;
  delete next.seconds;
  return next;
}

function updateOverlayConfiguration(
  payload = {},
  { applyRuntimeDefaults = false } = {}
) {
  const overlayKey = String(payload.overlayKey || "").trim();
  if (overlayKey && overlayKey !== activeOverlayConfigKey()) return;
  const configuration =
    payload.config && typeof payload.config === "object"
      ? payload.config
      : payload;
  updatePreviewConfiguration(
    applyRuntimeDefaults
      ? configuration
      : configurationWithoutRuntimeReset(configuration)
  );
}

function applyRelayConfiguration(configurations = {}) {
  const overlayKey = activeOverlayConfigKey();
  const configuration = configurations?.[overlayKey];
  if (!overlayKey || !configuration || typeof configuration !== "object") {
    return;
  }
  const signature = JSON.stringify(configuration);
  if (signature === lastRelayConfigurationSignature) return;
  lastRelayConfigurationSignature = signature;
  updateOverlayConfiguration(
    { overlayKey, config: configuration },
    {
      applyRuntimeDefaults:
        relayDocument?.state?.overlaySession?.hasData !== true
    }
  );
}

function setupConfiguration() {
  const titleTargets = {
    "my-actions": "my-actions-title",
    "like-goal": "like-goal-title",
    timer: "timer-label",
    "multiplier-timer": "multiplier-timer-label",
    wheel: "wheel-caption"
  };
  const targetId = titleTargets[viewName];
  if (overlayTitle && targetId) {
    const target = document.getElementById(targetId);
    if (target) target.textContent = overlayTitle;
  }
  const likeCurrent = document.getElementById("like-goal-current");
  const likeTarget = document.getElementById("like-goal-target");
  const likeProgress = document.getElementById("like-goal-progress");
  const likePercent = document.getElementById("like-goal-percent");
  const likeProgressLabel = document.getElementById("like-goal-progress-label");
  const winTarget = document.getElementById("win-counter-target");
  const winTitle = document.querySelector(".win-counter-content > span");
  const currentValue = Math.max(0, likeGoalCurrent);
  const targetValue = Math.max(1, likeGoalTarget);
  if (likeCurrent) likeCurrent.textContent = formatNumber(likeGoalCurrent);
  if (likeTarget) likeTarget.textContent = formatNumber(likeGoalTarget);
  if (likeProgress) likeProgress.style.width = `${Math.min(100, currentValue / targetValue * 100)}%`;
  if (likePercent) {
    likePercent.textContent = `${Math.round(Math.min(100, currentValue / targetValue * 100))}%`;
    likePercent.hidden = !showPercent;
  }
  if (likeProgressLabel) {
    likeProgressLabel.textContent = likeGoalProgressLabel;
    likeProgressLabel.hidden = !showGoal || !likeGoalProgressLabel;
  }
  if (winTarget) winTarget.textContent = formatNumber(winCounterTarget);
  if (winTitle && overlayTitle) winTitle.textContent = overlayTitle;
  activeView.querySelectorAll("header, #like-goal-title, #timer-label, #multiplier-timer-label, .win-counter-content > span, #wheel-caption").forEach((element) => {
    element.hidden = !showHeader;
  });
  activeView.querySelectorAll("#like-goal-progress-label, .win-counter-content > small").forEach((element) => {
    element.hidden =
      !showGoal ||
      (element.id === "like-goal-progress-label" && !likeGoalProgressLabel);
  });
  activeView.querySelectorAll(".leaderboard-rank").forEach((element) => {
    element.hidden = !showRank;
  });
  activeView.classList.toggle("leaderboard-without-rank", !showRank);
  activeView.classList.toggle("leaderboard-without-avatars", !showAvatars);
  document.querySelector(".coin-jar-widget")?.classList.toggle("without-base", !showBase);
}

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
  const labels = {
    x2: "X2",
    x3: "X3",
    guantes: "GANTS",
    cofre: "COFFRE",
    snipe: "SNIPE",
    taptap: "TAPTAP",
    quiereme: "QUIEREME",
    enigma: "ENIGMA"
  };
  title.textContent = labels[matchName] || matchName.toUpperCase();
  const variant = matchName === "enigma" ? "tikcontrol" : matchVariant;
  video.loop = matchLoop;
  video.autoplay = isStaticPreview ? false : matchAutoplay;
  video.style.objectFit = matchFit;
  const source = mediaUrl(`video/${matchName}-${variant}.webm`);
  video.dataset.previewSource = source;
  video.addEventListener("canplay", () => {
    video.parentElement?.classList.add("has-video");
    if (isStaticPreview) positionStaticMatchPreview(video, source);
    else if (viewName === "match" && video.autoplay) {
      video.play().catch(() => {});
    }
  }, { once: true });
  video.addEventListener("ended", () => {
    video.currentTime = 0;
  });
  video.src = source;
  positionStaticMatchPreview(video, source);
  video.load();
}

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
  renderLikeGoal();
}

function cancelLikeGoalCompletion() {
  if (!likeGoalCompletionTimer) return;
  clearTimeout(likeGoalCompletionTimer);
  likeGoalCompletionTimer = null;
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
  const current = likeGoalCurrent;
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

function renderLikeGoalChange(previousCurrent) {
  const previous = Math.max(0, Number(previousCurrent || 0));
  const completedTarget = Math.max(1, Number(likeGoalTarget || 1));
  const crossedTarget =
    previous < completedTarget && likeGoalCurrent >= completedTarget;

  if (likeGoalCompletionTimer) {
    if (likeGoalCurrent >= completedTarget) {
      renderLikeGoal({ preserveTarget: true, forceVisible: true });
      return;
    }
    cancelLikeGoalCompletion();
  }

  if (!crossedTarget) {
    renderLikeGoal();
    return;
  }

  likeGoalTarget = completedTarget;
  renderLikeGoal({ preserveTarget: true, forceVisible: true });
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

function addFeedEvent(event) {
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
  updateInteractiveWidgets(event);
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
    restartMatchVideo();
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

function renderCoinJar() {
  const current = document.getElementById("coin-jar-current");
  const target = document.getElementById("coin-jar-target");
  if (current) current.textContent = formatNumber(coinJarCurrent);
  if (target) target.textContent = formatNumber(coinJarTarget);
}

function updateCoinJar(payload = {}) {
  revealOverlay();
  const operation = String(payload.operation || "adjust");
  const amount = Number(payload.amount || 0);
  const minimum = coinJarMinimum;
  const synchronizedCurrent = Number(payload.current);
  coinJarCurrent = Number.isFinite(synchronizedCurrent)
    ? Math.max(minimum, synchronizedCurrent)
    : operation === "reset"
      ? minimum
      : operation === "set"
        ? Math.max(minimum, amount)
        : Math.max(minimum, coinJarCurrent + amount);
  if (operation === "reset") clearCoinJarDrops();
  renderCoinJar();
}

function spawnCoinJarDrop(event) {
  const stage = document.getElementById("coin-jar-drops");
  if (!stage) return;
  const eventId = String(event.id || "").trim();
  if (eventId && coinJarEventIds.has(eventId)) return;
  if (eventId) coinJarEventIds.add(eventId);
  const requestedCount = Number(event.data?.count || 1);
  const count = Number.isFinite(requestedCount)
    ? Math.max(1, Math.floor(requestedCount))
    : 1;
  const interval = count > 100 ? 14 : count > 20 ? 34 : 72;
  const generation = coinJarSpawnGeneration;
  const scheduleGift = (index) => {
    if (index >= count || generation !== coinJarSpawnGeneration) return;
    const timer = setTimeout(() => {
      coinJarSpawnTimers.delete(timer);
      if (generation !== coinJarSpawnGeneration) return;
      spawnCoinJarGift(stage, event);
      scheduleGift(index + 1);
    }, index === 0 ? 0 : interval);
    coinJarSpawnTimers.add(timer);
  };
  scheduleGift(0);
}

function currentCoinJarGeometry(stage) {
  const width = Math.max(120, stage.clientWidth || 500);
  const height = Math.max(120, stage.clientHeight || 500);
  const geometryChanged =
    coinJarGeometry &&
    (
      Math.abs(coinJarGeometry.width - width) >= 3 ||
      Math.abs(coinJarGeometry.height - height) >= 3
    );
  if (geometryChanged) {
    const scaleX = width / coinJarGeometry.width;
    const scaleY = height / coinJarGeometry.height;
    const radiusScale = Math.min(scaleX, scaleY);
    for (const gift of coinJarDrops) {
      gift.x *= scaleX;
      gift.y *= scaleY;
      gift.vx *= scaleX;
      gift.vy *= scaleY;
      gift.visualRadius = (gift.visualRadius || gift.radius) * radiusScale;
      gift.radius *= radiusScale;
      gift.mass = gift.radius * gift.radius;
      if (Number.isFinite(gift.restX)) gift.restX *= scaleX;
      if (Number.isFinite(gift.restY)) gift.restY *= scaleY;
      gift.node.style.width = `${gift.visualRadius * 2}px`;
      gift.node.style.height = `${gift.visualRadius * 2}px`;
    }
  }
  coinJarGeometry = globalThis.CoinJarPhysics.createGeometry(width, height);
  return coinJarGeometry;
}

function spawnCoinJarGift(stage, event) {
  const geometry = currentCoinJarGeometry(stage);
  const size = globalThis.CoinJarPhysics.giftDiameter(
    event.data?.value,
    geometry.width
  );
  const visualRadius = size / 2;
  const radius = size * 0.43;
  const node = document.createElement("span");
  node.className = "coin-jar-gift";
  node.style.width = `${size}px`;
  node.style.height = `${size}px`;
  node.title = `${String(event.data?.giftName || "Cadeau")} · ${Math.max(
    1,
    Number(event.data?.value || 1)
  )} pièce(s)`;
  const imageUrl = String(event.data?.giftImageUrl || "").trim();
  if (imageUrl) {
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = String(event.data?.giftName || "Cadeau TikTok");
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => {
      image.remove();
      node.textContent = String(event.data?.giftName || "Cadeau").slice(0, 2);
      node.classList.add("coin-jar-gift-fallback");
    }, { once: true });
    node.append(image);
  } else {
    node.textContent = String(event.data?.giftName || "Cadeau").slice(0, 2);
    node.classList.add("coin-jar-gift-fallback");
  }
  (document.getElementById("coin-jar-overflow-drops") || stage).append(node);
  const body = globalThis.CoinJarPhysics.createBody({
    x:
      geometry.centerX +
      (Math.random() - 0.5) *
        Math.max(0, geometry.mouthRight - geometry.mouthLeft - size),
    y: -visualRadius - Math.random() * geometry.height * 0.035,
    vx: (Math.random() - 0.5) * geometry.width * 0.28,
    vy: geometry.height * (0.05 + Math.random() * 0.08),
    radius,
    angle: (Math.random() - 0.5) * 120,
    angularVelocity: (Math.random() - 0.5) * 120
  });
  body.visualRadius = visualRadius;
  body.node = node;
  coinJarDrops.push(body);
  renderCoinJarGift(body);
  startCoinJarPhysics();
}

function renderCoinJarGift(gift) {
  const visualRadius = gift.visualRadius || gift.radius;
  const diameter = visualRadius * 2;
  const containedLayer = document.getElementById("coin-jar-contained-drops");
  const overflowLayer = document.getElementById("coin-jar-overflow-drops");
  const fullyInsideGlass =
    gift.state === "contained" &&
    coinJarGeometry &&
    gift.y - visualRadius >= coinJarGeometry.mouthTop;
  const targetLayer = fullyInsideGlass ? containedLayer : overflowLayer;
  if (targetLayer && gift.node.parentElement !== targetLayer) {
    targetLayer.append(gift.node);
  }
  gift.node.style.transform =
    `translate3d(${gift.x - visualRadius}px, ${gift.y - visualRadius}px, 0) ` +
    `rotate(${gift.angle}deg)`;
  gift.node.classList.toggle(
    "settled",
    gift.sleeping ||
      (gift.state === "contained" &&
        Math.abs(gift.vx) + Math.abs(gift.vy) < diameter * 0.3)
  );
  gift.node.classList.toggle("spilled", gift.state === "spilled");
  gift.renderedX = gift.x;
  gift.renderedY = gift.y;
  gift.renderedAngle = gift.angle;
  gift.renderedState = gift.state;
  gift.renderedSleeping = gift.sleeping;
}

function coinJarGiftNeedsRender(gift) {
  return (
    !gift.sleeping ||
    gift.renderedX !== gift.x ||
    gift.renderedY !== gift.y ||
    gift.renderedAngle !== gift.angle ||
    gift.renderedState !== gift.state ||
    gift.renderedSleeping !== gift.sleeping
  );
}

function coinJarGiftOutsideOverlay(gift, stage) {
  if (gift.state !== "spilled") return false;
  const bounds = stage.getBoundingClientRect();
  const scaleX = bounds.width / Math.max(1, stage.clientWidth);
  const scaleY = bounds.height / Math.max(1, stage.clientHeight);
  const left = bounds.left + (gift.x - gift.radius) * scaleX;
  const right = bounds.left + (gift.x + gift.radius) * scaleX;
  const top = bounds.top + (gift.y - gift.radius) * scaleY;
  return right < 0 || left > window.innerWidth || top > window.innerHeight;
}

function animateCoinJar(timestamp) {
  coinJarAnimationFrame = 0;
  const stage = document.getElementById("coin-jar-drops");
  if (!stage || !coinJarDrops.length) {
    coinJarAnimationTimestamp = 0;
    return;
  }
  const geometry = currentCoinJarGeometry(stage);
  const elapsed = coinJarAnimationTimestamp
    ? (timestamp - coinJarAnimationTimestamp) / 1000
    : 1 / 60;
  coinJarAnimationTimestamp = timestamp;
  const motion = globalThis.CoinJarPhysics.step(
    coinJarDrops,
    geometry,
    elapsed
  );

  for (let index = coinJarDrops.length - 1; index >= 0; index -= 1) {
    const gift = coinJarDrops[index];
    if (coinJarGiftNeedsRender(gift)) renderCoinJarGift(gift);
    if (coinJarGiftOutsideOverlay(gift, stage)) {
      gift.node.remove();
      coinJarDrops.splice(index, 1);
    }
  }

  const stillMoving =
    coinJarSpawnTimers.size > 0 ||
    motion.falling ||
    motion.active > 0;
  coinJarSettledFrames = stillMoving ? 0 : coinJarSettledFrames + 1;
  if (coinJarDrops.length && coinJarSettledFrames < 36) {
    coinJarAnimationFrame = requestAnimationFrame(animateCoinJar);
  } else {
    coinJarAnimationTimestamp = 0;
  }
}

function startCoinJarPhysics() {
  coinJarSettledFrames = 0;
  if (!coinJarAnimationFrame) {
    coinJarAnimationTimestamp = 0;
    coinJarAnimationFrame = requestAnimationFrame(animateCoinJar);
  }
}

function clearCoinJarDrops() {
  coinJarSpawnGeneration += 1;
  for (const timer of coinJarSpawnTimers) clearTimeout(timer);
  coinJarSpawnTimers.clear();
  if (coinJarAnimationFrame) cancelAnimationFrame(coinJarAnimationFrame);
  coinJarAnimationFrame = 0;
  coinJarAnimationTimestamp = 0;
  coinJarSettledFrames = 0;
  for (const gift of coinJarDrops.splice(0)) gift.node.remove();
  coinJarEventIds.clear();
  coinJarGeometry = null;
}

function renderWinCounter({ animate = false } = {}) {
  const current = document.getElementById("win-counter-value");
  const target = document.getElementById("win-counter-target");
  if (current) {
    current.textContent = String(winCounter);
    current.style.color = winCounter < 0
      ? winCounterNegativeColor
      : winCounter > 0
        ? winCounterPositiveColor
        : winCounterNeutralColor;
    if (animate) {
      current.classList.remove("pulse");
      void current.offsetWidth;
      current.classList.add("pulse");
    }
  }
  if (target) target.textContent = formatNumber(winCounterTarget);
  const content = document.querySelector(".win-counter-content");
  if (content) {
    content.style.translate = `${winCounterLabelX}px ${winCounterLabelY}px`;
  }
}

function updateWinCounter(payload = {}) {
  revealOverlay();
  const operation = String(payload.operation || "adjust");
  const amount = Number(payload.amount || 0);
  const synchronizedCurrent = Number(payload.current);
  const previousCounter = winCounter;
  if (Number.isFinite(synchronizedCurrent)) {
    winCounter = allowNegative
      ? synchronizedCurrent
      : Math.max(0, synchronizedCurrent);
  } else if (operation === "multiplier") {
    winCounterMultiplier = Math.max(1, Math.abs(amount) || 2);
    if (winCounterMultiplierTimer) clearTimeout(winCounterMultiplierTimer);
    winCounterMultiplierTimer = setTimeout(() => {
      winCounterMultiplier = 1;
      winCounterMultiplierTimer = null;
    }, Math.max(1, Number(payload.durationSeconds || 60)) * 1000);
  } else if (operation === "reset") {
    winCounter = 0;
  } else if (operation === "set") {
    winCounter = allowNegative ? amount : Math.max(0, amount);
  } else {
    const signedAmount =
      operation === "random" && Math.random() < 0.5
        ? -Math.abs(amount)
        : amount;
    const nextValue = winCounter + signedAmount * winCounterMultiplier;
    winCounter = allowNegative ? nextValue : Math.max(0, nextValue);
  }
  renderWinCounter({ animate: winCounter !== previousCounter });
  addMyAction({
    icon: "★",
    title:
      operation === "multiplier"
        ? `WINS X${winCounterMultiplier}`
        : `${amount >= 0 ? "+" : ""}${amount} WINS`,
    detail: payload.viewer
      ? `Déclenché par ${payload.viewer}`
      : "Compteur Mont Chiliad"
  });
}

function hydrateOverlaySession(state = {}) {
  const runtime = state.overlaySession || state;
  if (!runtime || runtime.hasData !== true) return false;

  cancelLikeGoalCompletion();
  likeGoalCurrent = Math.max(0, Number(runtime.likeGoalCurrent || 0));
  coinJarCurrent = Math.max(
    coinJarMinimum,
    Number(runtime.coinJarCurrent || 0)
  );
  winCounter = Number(runtime.winCounterCurrent || 0);
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
      label: runtime.timerLabel || "TEMPS RESTANT"
    });
  }
  if (viewName === "multiplier-timer" && multiplierSeconds > 0) {
    updateMultiplierTimer({
      operation: "set",
      seconds: multiplierSeconds,
      multiplier: winCounterMultiplier,
      label: `WINS X${winCounterMultiplier}`
    });
  }
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

  feed = Array.isArray(runtime.recentEvents)
    ? runtime.recentEvents.slice(0, 6)
    : [];
  myActions = feed.slice(0, 5).map((event) => ({
    icon: icons[event.type] || "\u26A1",
    title: event.user?.displayName || event.user?.name || "Viewer",
    detail: eventDetail(event),
    at: new Date(event.timestamp || Date.now())
  }));
  if (viewName === "coin-jar") {
    runtime.recentEvents
      .filter((event) => event.type === "gift")
      .slice(0, 40)
      .reverse()
      .forEach((event) => spawnCoinJarDrop(event));
  }
  renderLikeGoal();
  renderCoinJar();
  renderWinCounter();
  renderLeaderboard();
  renderFeed();
  renderMyActions();
  return true;
}

function restartMatchVideo() {
  const video = document.getElementById("match-video");
  if (!video || viewName !== "match") return;
  try {
    video.currentTime = 0;
    video.play().catch(() => {});
  } catch {
    // The static fallback remains visible if the media cannot start.
  }
}

function addGameEffect(payload) {
  const stage = document.getElementById("game-stage");
  const node = document.createElement("article");
  node.className = "overlay-panel game-effect";
  node.innerHTML = `<span class="game-effect-icon">◇</span><span><strong>${escapeHtml(payload.effectName)}</strong><small>Déclenché par ${escapeHtml(payload.viewer)}</small></span>`;
  stage.prepend(node);
  while (stage.children.length > 4) stage.lastElementChild.remove();
  setTimeout(() => node.remove(), 9000);
  addMyAction({
    icon: "◇",
    title: payload.effectName || "Effet de jeu",
    detail: `Déclenché par ${payload.viewer || "Viewer"}`
  });
}

function updateTimer(payload) {
  revealOverlay();
  const operation = String(payload.operation || "add");
  if (operation === "set") {
    timerSeconds = Math.max(0, Number(payload.seconds || 0));
    timerPaused = payload.paused === true;
  } else if (operation === "reset") {
    timerSeconds = 0;
    timerPaused = false;
  } else if (operation === "pause") {
    timerPaused = true;
  } else if (operation === "resume") {
    timerPaused = false;
  } else {
    timerSeconds = Math.max(0, timerSeconds + Number(payload.seconds || 0));
  }
  document.getElementById("timer-label").textContent = payload.label || "TEMPS RESTANT";
  document.getElementById("multiplier-timer-label").textContent = payload.label || "BONUS ACTIF";
  renderTimer();
  if (!timerHandle) timerHandle = setInterval(() => {
    if (!timerPaused && timerSeconds > 0) timerSeconds -= 1;
    renderTimer();
  }, 1000);
}

function updateMultiplierTimer(payload = {}) {
  if (viewName !== "multiplier-timer") return;
  multiplierValue = Math.max(
    1,
    Math.round(Number(payload.multiplier || multiplierValue || 2))
  );
  updateTimer(payload);
}

function renderTimer() {
  const hours = Math.floor(timerSeconds / 3600);
  const minutes = Math.floor((timerSeconds % 3600) / 60);
  const seconds = String(timerSeconds % 60).padStart(2, "0");
  const value = showHours
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${String(hours * 60 + minutes).padStart(2, "0")}:${seconds}`;
  for (const id of ["timer-value", "multiplier-timer-value"]) {
    const element = document.getElementById(id);
    element.textContent = value;
    element.classList.toggle("paused", timerPaused);
  }
  document.getElementById("multiplier-value").textContent = `X${multiplierValue}`;
}

function spinWheel(payload) {
  if (wheelSpinActive) {
    wheelSpinQueue.push(payload);
    return;
  }
  wheelSpinActive = true;
  revealOverlay();
  wheelSoundStopper?.();
  wheelSoundStopper = null;
  const wheel = document.getElementById("wheel");
  const winner = document.getElementById("wheel-winner");
  const choices = payload.choices || [];
  const settings = { ...(payload.settings || {}), design: payload.design };
  applyWheelSettings(settings);
  if (choices.length) drawWheel(choices, payload.colors || []);
  const stage = document.getElementById("wheel-stage");
  const winnerIndex = Number.isInteger(payload.winnerIndex)
    ? payload.winnerIndex
    : Math.max(0, choices.indexOf(payload.winner));
  const segmentAngle = choices.length ? 360 / choices.length : 0;
  const stopAngle = 360 - (winnerIndex + 0.5) * segmentAngle;
  wheel.style.setProperty("--wheel-spin-rotation", `${360 * 7 + stopAngle}deg`);
  wheel.classList.remove("spinning");
  winner.classList.remove("visible");
  stage?.classList.remove("idle-hidden", "wheel-exiting");
  stage?.classList.add(
    "wheel-entering",
    `entrance-${wheelRuntimeSettings.entranceAnimation || "zoom"}`
  );
  void wheel.offsetWidth;
  wheel.classList.add("spinning");
  const spinSeconds = Math.min(
    30,
    Math.max(1, Number(wheelRuntimeSettings.spinDuration || 6))
  );
  const waitSeconds = Math.max(
    0,
    Number(wheelRuntimeSettings.waitDuration || 0)
  );
  const resultSeconds = Math.min(
    30,
    Math.max(1, Number(wheelRuntimeSettings.resultDuration || 4))
  );
  wheel.style.animationDelay = "0s";
  let tickTimer = null;
  let audioContext = null;
  const startSpinSound = () => {
    try {
      audioContext = new AudioContext();
      tickTimer = setInterval(() => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.frequency.value = 520;
        gain.gain.setValueAtTime(0.025, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          audioContext.currentTime + 0.035
        );
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.04);
      }, 125);
    } catch {
      audioContext = null;
    }
  };
  if (wheelBoolean(wheelRuntimeSettings.soundActive, true)) {
    startSpinSound();
  }
  const stopSpinSound = () => {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    audioContext?.close().catch(() => {});
    audioContext = null;
  };
  wheelSoundStopper = stopSpinSound;
  setTimeout(() => {
    stopSpinSound();
    if (wheelSoundStopper === stopSpinSound) wheelSoundStopper = null;
  }, spinSeconds * 1000);
  setTimeout(() => {
    winner.textContent = payload.winner || "Surprise !";
    if (wheelBoolean(wheelRuntimeSettings.showWinner, true)) {
      winner.classList.add("visible");
    }
    if (!wheelBoolean(wheelRuntimeSettings.alwaysVisible, true)) {
      setTimeout(() => {
        stage?.classList.add(
          "wheel-exiting",
          `exit-${wheelRuntimeSettings.exitAnimation || "fade"}`
        );
        setTimeout(() => stage?.classList.add("idle-hidden"), 650);
      }, resultSeconds * 1000);
    }
  }, (
    spinSeconds +
    Math.max(0, Number(wheelRuntimeSettings.waitDuration || 0))
  ) * 1000);
  setTimeout(() => {
    wheelSpinActive = false;
    const nextPayload = wheelSpinQueue.shift();
    if (nextPayload) spinWheel(nextPayload);
  }, (
    spinSeconds +
    waitSeconds +
    resultSeconds
  ) * 1000 + 700);
}

const overlayChannels = {
  alert: showAlert,
  audio: (payload) => queueLivePlayback("audio", payload),
  tts: (payload) => queueLivePlayback("tts", payload),
  event: addFeedEvent,
  game: addGameEffect,
  goal: (goal) => {
    const index = goals.findIndex((item) => item.id === goal.id);
    if (index >= 0) goals[index] = goal;
    else goals.push(goal);
    renderGoals();
  },
  timer: updateTimer,
  "multiplier-timer": updateMultiplierTimer,
  "like-goal": updateLikeGoal,
  "coin-jar": updateCoinJar,
  "win-counter": updateWinCounter,
  wheel: spinWheel
};
overlayChannels["session-state"] = hydrateOverlaySession;
overlayChannels.design = updatePreviewDesign;
overlayChannels.configuration = updateOverlayConfiguration;

const statefulOverlayViews = new Set([
  "my-actions",
  "feed",
  "leaderboard",
  "like-goal",
  "coin-jar",
  "timer",
  "multiplier-timer",
  "win-counter"
]);

const channelOverlayViews = {
  alert: new Set(["alerts"]),
  game: new Set(["game"]),
  goal: new Set(["goals"]),
  timer: new Set(["timer"]),
  "multiplier-timer": new Set(["multiplier-timer"]),
  "like-goal": new Set(["like-goal"]),
  "coin-jar": new Set(["coin-jar"]),
  "win-counter": new Set(["win-counter"]),
  wheel: new Set(["wheel"]),
  "session-state": statefulOverlayViews
};

function currentViewAcceptsChannel(channel, payload = {}) {
  const normalizedChannel = String(channel || "").trim().toLowerCase();
  if (["audio", "tts"].includes(normalizedChannel)) {
    const targetScreen = Math.min(
      8,
      Math.max(1, Math.round(Number(payload?.screen) || 1))
    );
    return viewName === "alerts" && hasMediaScreen && targetScreen === mediaScreen;
  }
  if (["configuration", "design"].includes(normalizedChannel)) return true;
  if (normalizedChannel === "event") {
    if (["feed", "my-actions"].includes(viewName)) return true;
    const eventType = String(payload?.type || "").trim().toLowerCase();
    if (eventType === "gift") {
      return ["coin-jar", "leaderboard", "match"].includes(viewName);
    }
    if (eventType === "like") {
      return ["like-goal", "leaderboard"].includes(viewName);
    }
    return false;
  }
  return channelOverlayViews[normalizedChannel]?.has(viewName) === true;
}

window.addEventListener("resize", () => {
  if (viewName === "coin-jar" && coinJarDrops.length) startCoinJarPhysics();
});

window.addEventListener("message", (event) => {
  if (
    !isCatalogPreview ||
    event.source !== window.parent ||
    event.data?.source !== "shenpulse-overlay-card"
  ) {
    return;
  }
  if (!currentViewAcceptsChannel(event.data.channel, event.data.payload)) return;
  const handler = overlayChannels[event.data.channel];
  if (typeof handler !== "function") return;
  handler(event.data.payload || {});
});

async function initialize() {
  setupOverlayDesign();
  renderTimer();
  if (relayChannel) {
    connectPublicRelay();
  } else {
    try {
      const response = await fetch(`/api/state?token=${encodeURIComponent(token)}`);
      if (response.ok) {
        applyRelayState(await response.json());
      }
    } catch {
      // The SSE retry loop keeps the overlay alive if the app restarts.
    }
  }
  if (isCatalogPreview) return;
  if (
    timerAutoStart &&
    viewName === "multiplier-timer"
  ) {
    updateTimer({
      operation: "set",
      seconds: timerSeconds,
      label: overlayTitle || (viewName === "timer" ? "TEMPS RESTANT" : "BONUS ACTIF")
    });
  }
  addMyAction({
    icon: "●",
    title: "Overlay connecté",
    detail: "En attente des événements ShenPulse"
  });
  if (relayChannel) return;
  const source = new EventSource(
    `/events?token=${encodeURIComponent(token)}&view=${encodeURIComponent(viewName)}`
  );
  source.addEventListener("access-revoked", () => {
    source.close();
    document.documentElement.hidden = true;
  });
  for (const [channel, handler] of Object.entries(overlayChannels)) {
    source.addEventListener(channel, (event) => {
      try {
        const message = JSON.parse(event.data);
        if (!currentViewAcceptsChannel(channel, message.payload)) return;
        handler(message.payload);
      } catch {
        // Ignore malformed local payloads.
      }
    });
  }
}

function applyRelayState(state) {
  if (!state || typeof state !== "object") return;
  goals = Array.isArray(state.goals) ? state.goals : goals;
  hydrateOverlaySession(state);
  renderGoals();
}

let relayDocument = {};
let relayInitialized = false;
let lastRelayBatchId = "";
let lastRelayConfigurationSignature = "";

function connectPublicRelay() {
  if (isCatalogPreview) return;
  const source = new EventSource(
    `${relayDatabaseUrl}/publicOverlayRelay/${encodeURIComponent(
      relayChannel
    )}.json`
  );
  const handleMutation = (event, patch) => {
    try {
      const mutation = JSON.parse(event.data);
      relayDocument = applyFirebaseMutation(
        relayDocument,
        mutation.path || "/",
        mutation.data,
        patch
      );
      applyRelayConfiguration(relayDocument?.configurations);
      const batch = relayDocument?.lastBatch;
      if (!relayInitialized) {
        lastRelayBatchId = String(batch?.id || "");
        relayInitialized = true;
      } else if (batch?.id && batch.id !== lastRelayBatchId) {
        lastRelayBatchId = batch.id;
        if (relayDocument?.state) applyRelayState(relayDocument.state);
        for (const message of Array.isArray(batch.messages)
          ? batch.messages
          : Object.values(batch.messages || {})) {
          if (!currentViewAcceptsChannel(message?.channel, message?.payload)) {
            continue;
          }
          const handler = overlayChannels[message?.channel];
          if (typeof handler === "function") handler(message.payload || {});
        }
        return;
      }
      if (relayDocument?.state) applyRelayState(relayDocument.state);
    } catch {
      // Firebase reconnecte automatiquement le flux après une coupure réseau.
    }
  };
  source.addEventListener("put", (event) => handleMutation(event, false));
  source.addEventListener("patch", (event) => handleMutation(event, true));
  source.addEventListener("cancel", () => source.close());
  source.addEventListener("auth_revoked", () => source.close());
}

function applyFirebaseMutation(documentValue, path, data, patch) {
  const segments = String(path || "/")
    .split("/")
    .filter(Boolean);
  if (!segments.length) {
    if (
      patch &&
      documentValue &&
      typeof documentValue === "object" &&
      data &&
      typeof data === "object"
    ) {
      return { ...documentValue, ...data };
    }
    return data && typeof data === "object" ? data : {};
  }
  const root =
    documentValue && typeof documentValue === "object"
      ? documentValue
      : {};
  let cursor = root;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const key = segments[index];
    if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = {};
    cursor = cursor[key];
  }
  const key = segments.at(-1);
  if (data === null) {
    delete cursor[key];
  } else if (
    patch &&
    cursor[key] &&
    typeof cursor[key] === "object" &&
    data &&
    typeof data === "object"
  ) {
    cursor[key] = { ...cursor[key], ...data };
  } else {
    cursor[key] = data;
  }
  return root;
}

initialize();
