"use strict";
/**
 * Paramètres, état et configuration commune du runtime overlay.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

const parameters = new URLSearchParams(location.search);
const matchSourceRoute = /^\/match\/(\d{12})\/([A-Za-z0-9_-]{32,128})\/?$/i.exec(location.pathname);
const publicMatchSourceRoute = /^\/m\/(\d{12})\/([A-Za-z0-9_-]{24,128})\/?$/i.exec(location.pathname);
const matchSourceBasePath = matchSourceRoute ? `/match/${matchSourceRoute[1]}/${matchSourceRoute[2]}` : "";
const publicMatchAccountNumber = publicMatchSourceRoute?.[1] || "";
const publicMatchChannel = publicMatchSourceRoute?.[2] || "";
const isPublicMatchSource = Boolean(publicMatchSourceRoute);
const overlayCatalog = globalThis.ShenPulseOverlayCatalog;
if (!overlayCatalog) {
  throw new Error("Le catalogue commun des overlays n'est pas chargé.");
}
const viewName = matchSourceRoute || isPublicMatchSource ? "match"
  : parameters.get("view") || "alerts";
const token = parameters.get("token") || "";
const relayChannel = publicMatchChannel || parameters.get("channel") || "";
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
const matchName = matchSourceRoute || isPublicMatchSource
  ? "player"
  : parameters.get("match") || "x2";
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
activeView.classList.add("active"); configureNativeOverlayCanvas(viewName, activeView, overlayCatalog); configureLikeGoalViewport(viewName, activeView);
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
activeView.style.fontFamily = overlayFontStack(parameters.get("font"));
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
let timerConfigurationTicker = false;
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
let matchActivationRecoveryReady = false;
let matchSourceInactive = document.visibilityState === "hidden";
let matchActivationLastFrameAt = 0;
let matchLastRestartAt = 0;
let matchPlaybackQueue = null;
let publicMatchRelayDocument = {};
let publicMatchRelayReady = false;
const matchPlaybackRequestIds = new Set();

const MATCH_SOURCE_SUSPEND_GAP_MS = 3000;
const MATCH_VIDEO_LABELS = Object.freeze(
  Object.fromEntries(
    overlayCatalog.matches.map(({ match, name }) => [
      match,
      name.replace(/^Match\s+/i, "").toLocaleUpperCase("fr-FR")
    ])
  )
);
const MATCH_VIDEO_NAMES = new Set(Object.keys(MATCH_VIDEO_LABELS));
const MATCH_VIDEO_VARIANTS = new Set(["tikcontrol", "gladiador"]);

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
  const previousTimerAutoStart = timerAutoStart;

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

  coinJarMinimum = previewNumber(
    payload,
    "minCoins",
    coinJarMinimum,
    0,
    999999999
  );
  coinJarCurrent = Math.max(coinJarMinimum, coinJarCurrent);
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
  document.documentElement.style.setProperty("--overlay-shadow-color", payload.shadowColor || parameters.get("shadowColor") || "#000000");
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
  activeView.style.fontFamily = overlayFontStack(payload.font || parameters.get("font"));
  activeView.style.direction = String(payload.rtl) === "true" ? "rtl" : "ltr";
  activeView.dataset.layout = payload.layout || activeView.dataset.layout || "wide";
  const saturation = previewNumber(payload, "saturation", 100, 0, 200);
  const hue = previewNumber(payload, "hue", 0, -180, 180);
  activeView.style.filter = `saturate(${saturation}%) hue-rotate(${hue}deg)`;
  activeView.classList.toggle("overlay-without-shadow", !showShadow);
  activeView.classList.toggle("overlay-idle-hidden", !showWhenIdle);
  activeView.classList.toggle("overlay-config-disabled", !overlayEnabled);

  if (
    isCatalogPreview &&
    ["timer", "multiplier-timer"].includes(viewName)
  ) {
    if (timerAutoStart && !previousTimerAutoStart) {
      timerPaused = false;
      timerConfigurationTicker = true;
      ensureTimerTicker();
    } else if (
      !timerAutoStart &&
      previousTimerAutoStart &&
      timerConfigurationTicker
    ) {
      clearInterval(timerHandle);
      timerHandle = null;
      timerConfigurationTicker = false;
    }
  }

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
    leaderboard: "leaderboard-title",
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
