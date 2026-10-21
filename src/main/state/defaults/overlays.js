"use strict";

const crypto = require("node:crypto");

function createDefaultWheelSettings(overrides = {}) {
  return {
    font: "Inter",
    fontSize: 19,
    textOrientation: "radial",
    textColor: "#ffffff",
    textShadowColor: "#000000",
    textShadowStrength: 7,
    textRadius: 34,
    textSegmentOffset: 0,
    textBoxWidth: 112,
    textBoxHeight: 42,
    textAngleOffset: 0,
    textAlign: "center",
    textClamp: true,
    textMaxLines: 2,
    lineSpacing: 1,
    letterSpacing: 0,
    showBase: true,
    soundActive: true,
    announceDuration: 0,
    spinDuration: 6,
    waitDuration: 1,
    scale: 100,
    glow: 72,
    showWinner: true,
    pointerPosition: "top",
    alwaysVisible: true,
    entranceAnimation: "zoom",
    exitAnimation: "fade",
    resultDuration: 4,
    ...overrides
  };
}

function createWheelSegment(label, color, action = "none", actionId = "") {
  const signature = crypto
    .createHash("sha1")
    .update(`${label}|${color}|${action}|${actionId}`)
    .digest("hex")
    .slice(0, 12);
  return { id: `segment_${signature}`, label, color, action, actionId };
}

function createDefaultWheels() {
  return [
    {
      id: "wheel_classic",
      name: "Roue Orange Classique - Actions LIVE",
      enabled: true,
      trigger: "",
      giftValueFilter: null,
      design: "classic",
      settings: createDefaultWheelSettings(),
      segments: [
        createWheelSegment("10 pompes", "#ff6a00"),
        createWheelSegment("Choisis un défi", "#111111"),
        createWheelSegment("x2 pendant 1 min", "#f59f00"),
        createWheelSegment("Question chat", "#2a1207"),
        createWheelSegment("Danse 15 sec", "#ff8a1f"),
        createWheelSegment("Rien du tout", "#1e1e1e"),
        createWheelSegment("Action mystère", "#ffb04a"),
        createWheelSegment("Relance", "#371707", "spin")
      ]
    },
    {
      id: "wheel_royal",
      name: "Roue Royale Prestige - Défis Sport",
      enabled: false,
      trigger: "",
      giftValueFilter: null,
      design: "royal",
      settings: createDefaultWheelSettings({
        font: "Georgia",
        fontSize: 17,
        textColor: "#fff5cb",
        glow: 100,
        spinDuration: 7
      }),
      segments: [
        createWheelSegment("15s pompes", "#7b1fa2"),
        createWheelSegment("4x gainage", "#f59f00"),
        createWheelSegment("Rien", "#2f8f00"),
        createWheelSegment("3x abdos", "#0067b8"),
        createWheelSegment("10x pompes", "#c51f12"),
        createWheelSegment("1x relance", "#9b168d", "spin"),
        createWheelSegment("20x abdos", "#008d8f"),
        createWheelSegment("5x gainage", "#d77a00"),
        createWheelSegment("15s pompes", "#005fae"),
        createWheelSegment("1x abdo", "#2e8b00"),
        createWheelSegment("20x pompes", "#d52a16"),
        createWheelSegment("5x abdos", "#0094a3")
      ]
    }
  ];
}

/** Valeurs initiales indépendantes de tous les overlays, avec leurs roues et segments. */
function createDefaultOverlayConfigs() {
  const positioned = {
    enabled: true,
    scale: 100,
    xOffset: 0,
    yOffset: 0,
    accentColor: "#22d3ee",
    textColor: "#ffffff",
    showWhenIdle: true
  };
  const themed = { ...positioned, theme: "classic", showHeader: true };
  const match = {
    ...positioned,
    scale: 100,
    variant: "tikcontrol",
    fit: "contain",
    autoplay: true,
    loop: true
  };
  const wheels = createDefaultWheels();
  return {
    wheel: {
      ...positioned,
      schemaVersion: 11,
      selectedWheelId: wheels[0].id,
      wheels,
      design: "classic",
      title: "ROUE DES ACTIONS",
      choices: wheels[0].segments.map((segment) => segment.label),
      colors: wheels[0].segments.map((segment) => segment.color),
      ...createDefaultWheelSettings()
    },
    myActions: {
      ...positioned,
      title: "MY ACTIONS",
      maxRows: 5,
      showHeader: true
    },
    topDonors: {
      ...themed,
      leaderboardMetricLabel: "coins",
      leaderboardShowUnit: true,
      leaderboardUnitColor: "#ffe575",
      leaderboardUnitScale: 100,
      leaderboardAvatarScale: 100,
      theme: "gta",
      leaderboardTitleColor: "#ffffff",
      leaderboardTitleScale: 100,
      leaderboardNameScale: 100,
      leaderboardScoreScale: 100,
      title: "CLASSEMENT DONATEURS",
      maxRows: 5,
      showRank: true
    },
    topTappers: {
      ...themed,
      leaderboardMetricLabel: "likes",
      leaderboardShowUnit: true,
      leaderboardUnitColor: "#ff8db8",
      leaderboardUnitScale: 100,
      leaderboardAvatarScale: 100,
      theme: "gta",
      leaderboardTitleColor: "#ffffff",
      leaderboardTitleScale: 100,
      leaderboardNameScale: 100,
      leaderboardScoreScale: 100,
      title: "CLASSEMENT TAPOTEURS",
      maxRows: 5,
      showRank: true
    },
    likeGoal: {
      ...themed,
      theme: "gta",
      schemaVersion: 2,
      title: "LIKE GOAL",
      current: 0,
      target: 50000,
      goalBaseline: 0,
      progressLabel: "likes",
      whenReached: "increase",
      completionActionId: "",
      showGoal: true,
      showPercent: true,
      likeGoalTitleScale: 100,
      likeGoalTitleColor: "#ffffff",
      likeGoalContentScale: 100,
      likeGoalContentColor: "#ffffff",
      likeGoalPercentColor: "#ff4f86",
      scale: 100
    },
    coinJar: {
      ...positioned,
      model: "fantasy",
      title: "COIN JAR",
      current: 0,
      target: 1000,
      minCoins: 0,
      showGoal: true
    },
    timer: {
      ...themed,
      theme: "gta",
      title: "TEMPS RESTANT",
      seconds: 300,
      completionActionId: "",
      showHours: true,
      showGoal: true,
      timerTitleScale: 100,
      timerValueScale: 100,
      timerTitleColor: "#ffffff",
      timerValueColor: "#ffffff"
    },
    multiplierTimer: {
      ...themed,
      theme: "gta",
      title: "BONUS ACTIF",
      seconds: 120,
      multiplier: 2,
      showHours: false,
      showGoal: true,
      timerTitleScale: 100,
      timerValueScale: 100,
      timerTitleColor: "#ffffff",
      timerValueColor: "#ffffff",
      timerMultiplierColor: "#ffe575"
    },
    winCounter: {
      ...themed,
      theme: "gta",
      title: "WIN",
      current: 0,
      target: 20,
      showGoal: false,
      allowNegative: true,
      winCounterTitleColor: "#ffffff",
      winCounterGoalColor: "#ffffff",
      winCounterTitleScale: 100,
      winCounterValueScale: 100,
      winCounterGoalScale: 100
    },
    matchX2: { ...match },
    matchX3: { ...match },
    matchGants: { ...match },
    matchCoffre: { ...match },
    matchSnipe: { ...match },
    matchTapTap: { ...match },
    matchQuiereme: { ...match },
    matchEnigma: { ...match, variant: "tikcontrol" }
  };
}

module.exports = { createDefaultOverlayConfigs };
