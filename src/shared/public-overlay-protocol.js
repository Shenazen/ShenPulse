"use strict";

const PUBLIC_OVERLAY_PROTOCOL_VERSION = 1;
const PUBLIC_OVERLAY_RELAY_PATH = "publicOverlayRelay";
const DEFAULT_PUBLIC_OVERLAY_BASE_URL =
  "https://shenpulse-overlays.web.app";
const DEFAULT_FIREBASE_DATABASE_URL =
  "https://shenazenoverlay-default-rtdb.firebaseio.com";
const DEFAULT_FIREBASE_API_KEY =
  "AIzaSyDHcC8ngIhy2Av8N7J-XdCQq9G8KimGGJk";

const PRO_PUBLIC_OVERLAY_KEYS = new Set([
  "game",
  "multiplierTimer",
  "winCounter",
  "matchX2",
  "matchX3",
  "matchGants",
  "matchCoffre",
  "matchSnipe",
  "matchTapTap",
  "matchQuiereme",
  "matchEnigma"
]);

const PUBLIC_OVERLAY_CONFIG_PARAMETER_MAPPINGS = Object.freeze({
  accentColor: "accent",
  secondaryColor: "secondary",
  textColor: "textColor",
  backgroundColor: "background",
  backgroundOpacity: "backgroundOpacity",
  shadowColor: "shadowColor",
  showShadow: "showShadow",
  showWhenIdle: "showWhenIdle",
  font: "font",
  fontSize: "fontSize",
  layout: "layout",
  animation: "animation",
  displayTime: "displayTime",
  pauseTime: "pauseTime",
  soundEnabled: "soundEnabled",
  soundVolume: "soundVolume",
  saturation: "saturation",
  hue: "hue",
  rtl: "rtl",
  scale: "scale",
  xOffset: "x",
  yOffset: "y",
  title: "title",
  current: "current",
  target: "target",
  seconds: "seconds",
  multiplier: "multiplier",
  fit: "fit",
  autoplay: "autoplay",
  loop: "loop",
  showHeader: "showHeader",
  showGoal: "showGoal",
  showPercent: "showPercent",
  likeGoalTitleOffsetX: "titleX",
  likeGoalTitleOffsetY: "titleY",
  likeGoalTitleScale: "titleScale",
  likeGoalTitleColor: "titleColor",
  likeGoalContentOffsetX: "contentX",
  likeGoalContentOffsetY: "contentY",
  likeGoalContentScale: "contentScale",
  likeGoalContentColor: "contentColor",
  likeGoalPercentColor: "percentColor",
  showRank: "showRank",
  showAvatars: "showAvatars",
  showCrown: "showCrown",
  showRankBadges: "showRankBadges",
  showMetricLabel: "showMetricLabel",
  showBase: "showBase",
  showHours: "showHours",
  timerTitleScale: "timerTitleScale",
  timerValueScale: "timerValueScale",
  timerAutoStart: "timerAutoStart",
  allowNegative: "allowNegative",
  minCoins: "minCoins",
  goalBaseline: "goalBaseline",
  progressLabel: "progressLabel",
  whenReached: "whenReached",
  winCounterLabelColorNegative: "negativeColor",
  winCounterLabelColorNeutral: "neutralColor",
  winCounterLabelColorPositive: "positiveColor",
  winCounterLabelOffsetX: "labelX",
  winCounterLabelOffsetY: "labelY",
  maxRows: "maxRows",
  enabled: "enabled",
  nameColor: "nameColor",
  scoreColor: "scoreColor",
  rankColor: "rankColor",
  rowOpacity: "rowOpacity",
  theme: "theme",
  model: "model",
  design: "design",
  variant: "variant",
  textOrientation: "textOrientation",
  textShadowColor: "textShadowColor",
  textShadowStrength: "textShadowStrength",
  textRadius: "textRadius",
  textSegmentOffset: "textSegmentOffset",
  textBoxWidth: "textBoxWidth",
  textBoxHeight: "textBoxHeight",
  textAngleOffset: "textAngleOffset",
  textAlign: "textAlign",
  textClamp: "textClamp",
  textMaxLines: "textMaxLines",
  lineSpacing: "lineSpacing",
  letterSpacing: "letterSpacing",
  soundActive: "soundActive",
  spinDuration: "spinDuration",
  waitDuration: "waitDuration",
  glow: "glow",
  showWinner: "showWinner",
  pointerPosition: "pointerPosition",
  alwaysVisible: "alwaysVisible",
  entranceAnimation: "entranceAnimation",
  exitAnimation: "exitAnimation",
  resultDuration: "resultDuration"
});

function trimTrailingSlash(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function relayDatabaseUrl(databaseUrl, channelId, child = "") {
  const base = trimTrailingSlash(databaseUrl);
  const channel = encodeURIComponent(String(channelId || "").trim());
  const suffix = String(child || "")
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  return `${base}/${PUBLIC_OVERLAY_RELAY_PATH}/${channel}${
    suffix ? `/${suffix}` : ""
  }.json`;
}

function publicOverlayUrls({
  baseUrl = DEFAULT_PUBLIC_OVERLAY_BASE_URL,
  channelId,
  proAccess = true
} = {}) {
  const base = trimTrailingSlash(baseUrl);
  const channel = String(channelId || "").trim();
  const overlayUrl = (view, parameters = {}) => {
    if (!base || !channel) return "";
    const query = new URLSearchParams({
      view,
      channel,
      ...parameters
    });
    return `${base}/?${query.toString()}`;
  };
  const urls = {
    base,
    alerts: overlayUrl("alerts"),
    mediaScreens: Array.from({ length: 8 }, (_value, index) =>
      overlayUrl("alerts", { screen: index + 1 })
    ),
    myActions: overlayUrl("my-actions"),
    goals: overlayUrl("goals"),
    likeGoal: overlayUrl("like-goal"),
    feed: overlayUrl("feed"),
    game: overlayUrl("game"),
    topDonors: overlayUrl("leaderboard", { kind: "donors" }),
    topTappers: overlayUrl("leaderboard", { kind: "tappers" }),
    coinJar: overlayUrl("coin-jar"),
    timer: overlayUrl("timer"),
    multiplierTimer: overlayUrl("multiplier-timer"),
    winCounter: overlayUrl("win-counter"),
    wheel: overlayUrl("wheel"),
    matchX2: overlayUrl("match", { match: "x2" }),
    matchX3: overlayUrl("match", { match: "x3" }),
    matchGants: overlayUrl("match", { match: "guantes" }),
    matchCoffre: overlayUrl("match", { match: "cofre" }),
    matchSnipe: overlayUrl("match", { match: "snipe" }),
    matchTapTap: overlayUrl("match", { match: "taptap" }),
    matchQuiereme: overlayUrl("match", { match: "quiereme" }),
    matchEnigma: overlayUrl("match", { match: "enigma" })
  };
  if (!proAccess) {
    for (const key of PRO_PUBLIC_OVERLAY_KEYS) urls[key] = "";
  }
  return urls;
}

function publicMediaUrl(value, baseUrl = DEFAULT_PUBLIC_OVERLAY_BASE_URL) {
  const source = String(value || "");
  let mediaPath = "";
  if (source.startsWith("/overlay/media/")) {
    mediaPath = source.slice("/overlay/media/".length).split(/[?#]/)[0];
  } else {
    try {
      const url = new URL(source);
      if (
        ["127.0.0.1", "localhost"].includes(url.hostname) &&
        url.pathname.startsWith("/overlay/media/")
      ) {
        mediaPath = url.pathname.slice("/overlay/media/".length);
      }
    } catch {
      return source;
    }
  }
  if (!mediaPath) return source;
  const decodedPath = mediaPath
    .split("/")
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    })
    .join("/");
  const encodedPath = decodedPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${trimTrailingSlash(baseUrl)}/media/${encodedPath}`;
}

function sanitizeRelayValue(
  value,
  { baseUrl = DEFAULT_PUBLIC_OVERLAY_BASE_URL, depth = 0 } = {}
) {
  if (depth > 12 || value === undefined) return null;
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    return publicMediaUrl(value.slice(0, 10_000), baseUrl);
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, 1_000)
      .map((entry) => sanitizeRelayValue(entry, { baseUrl, depth: depth + 1 }));
  }
  if (typeof value !== "object") return null;
  const result = {};
  for (const [key, entry] of Object.entries(value).slice(0, 1_000)) {
    if (entry === undefined || typeof entry === "function") continue;
    result[String(key).slice(0, 160)] = sanitizeRelayValue(entry, {
      baseUrl,
      depth: depth + 1
    });
  }
  return result;
}

function effectiveOverlayConfiguration(overlayKey, configuration = {}) {
  if (
    overlayKey !== "wheel" ||
    !Array.isArray(configuration.wheels)
  ) {
    return configuration;
  }
  const selected =
    configuration.wheels.find(
      (wheel) => wheel?.id === configuration.selectedWheelId
    ) || configuration.wheels[0];
  if (!selected) return configuration;
  return {
    ...configuration,
    ...(selected.settings || {}),
    design: selected.design || configuration.design,
    choices: Array.isArray(selected.segments)
      ? selected.segments.map((segment) => segment?.label || "")
      : configuration.choices,
    colors: Array.isArray(selected.segments)
      ? selected.segments.map((segment) => segment?.color || "")
      : configuration.colors
  };
}

function createPublicOverlayConfiguration(
  overlayKey,
  configuration = {},
  options = {}
) {
  const effective = effectiveOverlayConfiguration(
    String(overlayKey || ""),
    configuration && typeof configuration === "object" ? configuration : {}
  );
  const result = {};
  for (const [key, parameter] of Object.entries(
    PUBLIC_OVERLAY_CONFIG_PARAMETER_MAPPINGS
  )) {
    if (effective[key] === undefined || effective[key] === "") continue;
    result[parameter] = effective[key];
  }
  for (const key of ["choices", "colors"]) {
    if (!Array.isArray(effective[key])) continue;
    result[key] = effective[key]
      .map((entry) => String(entry || "").trim())
      .filter(Boolean)
      .join("|");
  }
  return sanitizeRelayValue(result, options);
}

function createPublicOverlayConfigurations(state, options = {}) {
  const configurations = state?.settings?.overlayConfigs || {};
  const result = {};
  for (const [overlayKey, configuration] of Object.entries(configurations)) {
    result[String(overlayKey).slice(0, 80)] =
      createPublicOverlayConfiguration(
        overlayKey,
        configuration,
        options
      );
  }
  return result;
}

function createRelayState(state, options = {}) {
  const statistics = state?.statistics || {};
  return sanitizeRelayValue(
    {
      goals: (state?.goals || []).map((goal) => ({
        id: goal.id || "",
        name: goal.name || goal.title || "",
        current: Number(goal.current || 0),
        target: Number(goal.target || 0),
        unit: goal.unit || "",
        color: goal.color || "#EC4899",
        enabled: goal.enabled !== false
      })),
      session: {
        running: state?.session?.running === true,
        startedAt: state?.session?.startedAt || null
      },
      overlaySession: state?.overlaySession || {},
      statistics: {
        sessionEvents: Number(statistics.sessionEvents || 0),
        sessionActions: Number(statistics.sessionActions || 0),
        sessionLikes: Number(statistics.sessionLikes || 0),
        sessionUniqueViewers: Array.isArray(
          statistics.sessionUniqueViewers
        )
          ? statistics.sessionUniqueViewers.length
          : Number(statistics.sessionUniqueViewers || 0),
        lifetimeEvents: Number(statistics.lifetimeEvents || 0),
        likes: Number(statistics.likes || 0),
        gifts: Number(statistics.gifts || 0),
        follows: Number(statistics.follows || 0),
        subscribers: Number(statistics.subscribers || 0)
      }
    },
    options
  );
}

function createRelayMessage(channel, payload, options = {}) {
  return {
    channel: String(channel || "").slice(0, 80),
    payload: sanitizeRelayValue(payload, options),
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  DEFAULT_FIREBASE_API_KEY,
  DEFAULT_FIREBASE_DATABASE_URL,
  DEFAULT_PUBLIC_OVERLAY_BASE_URL,
  PRO_PUBLIC_OVERLAY_KEYS,
  PUBLIC_OVERLAY_PROTOCOL_VERSION,
  PUBLIC_OVERLAY_RELAY_PATH,
  createPublicOverlayConfiguration,
  createPublicOverlayConfigurations,
  createRelayMessage,
  createRelayState,
  publicMediaUrl,
  publicOverlayUrls,
  relayDatabaseUrl,
  sanitizeRelayValue,
  trimTrailingSlash
};
