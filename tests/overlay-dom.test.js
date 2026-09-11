"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");
const { JSDOM, VirtualConsole } = require("jsdom");

const overlayDirectory = path.join(__dirname, "..", "resources", "overlays");

async function loadOverlay(view, parameters = {}) {
  const htmlFile = path.join(overlayDirectory, "index.html");
  const url = new URL(pathToFileURL(htmlFile));
  url.search = new URLSearchParams({
    view,
    preview: "static",
    native: "1",
    ...parameters
  }).toString();
  const runtimeErrors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => runtimeErrors.push(error));
  const dom = new JSDOM(fs.readFileSync(htmlFile, "utf8"), {
    url: url.toString(),
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      // Lottie crée un pixel transparent au chargement. JSDOM ne fournit pas
      // de moteur Canvas natif, ce stub suffit à cette initialisation sans
      // modifier le comportement du widget testé.
      window.HTMLCanvasElement.prototype.getContext = () => ({
        fillStyle: "",
        fillRect() {}
      });
      window.HTMLMediaElement.prototype.load = () => {};
      window.HTMLMediaElement.prototype.pause = () => {};
      window.HTMLMediaElement.prototype.play = async () => {};
    }
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Le runtime overlay ne s'est pas chargé.")),
      5000
    );
    dom.window.addEventListener(
      "load",
      () => {
        clearTimeout(timeout);
        setTimeout(resolve, 0);
      },
      { once: true }
    );
  });
  assert.deepEqual(
    runtimeErrors
      .map((error) => error.message)
      .filter((message) => message !== "Not implemented: HTMLMediaElement's load() method"),
    [],
    "le chargement réel du widget ne doit produire aucune erreur DOM"
  );
  return dom;
}

function sendCardMessage(window, channel, payload) {
  window.dispatchEvent(
    new window.MessageEvent("message", {
      source: window,
      data: {
        source: "shenpulse-overlay-card",
        channel,
        payload
      }
    })
  );
}

test("un Like Goal chargé dans un vrai DOM applique sa configuration et son état", async () => {
  const dom = await loadOverlay("like-goal", { theme: "classic" });
  const { window } = dom;
  const { document } = window;

  assert.equal(document.documentElement.dataset.theme, "classic");
  assert.equal(document.getElementById("like-goal-view").classList.contains("active"), true);

  sendCardMessage(window, "configuration", {
    overlayKey: "likeGoal",
    config: {
      title: "OBJECTIF DU TEST",
      current: 250,
      target: 500,
      progressLabel: "likes vérifiés",
      showPercent: true
    }
  });

  assert.equal(document.getElementById("like-goal-title").textContent, "OBJECTIF DU TEST");
  assert.equal(document.getElementById("like-goal-current").textContent, "250");
  assert.equal(document.getElementById("like-goal-target").textContent, "500");
  assert.equal(document.getElementById("like-goal-percent").textContent, "50%");
  assert.equal(document.getElementById("like-goal-progress").style.width, "50%");

  sendCardMessage(window, "like-goal", { operation: "add", amount: 50 });
  assert.equal(document.getElementById("like-goal-current").textContent, "250");
  await new Promise((resolve) => setTimeout(resolve, 600));
  assert.equal(document.getElementById("like-goal-current").textContent, "300");
  assert.equal(document.getElementById("like-goal-percent").textContent, "60%");

  dom.window.close();
});

test("les sources de tous formats montent leur scène native avant le rendu", async () => {
  for (const [view, width, height] of [
    ["like-goal", 1300, 200],
    ["timer", 900, 360],
    ["leaderboard", 520, 640],
    ["wheel", 800, 900],
    ["match", 1080, 1920],
    ["game", 1920, 1080]
  ]) {
    const dom = await loadOverlay(view, { native: "" });
    const shell = dom.window.document.querySelector(".native-overlay-shell");
    const frame = shell?.querySelector("iframe");
    assert.ok(shell, `${view} doit créer son conteneur natif`);
    assert.equal(shell.style.getPropertyValue("--native-overlay-width"), `${width}px`);
    assert.equal(shell.style.getPropertyValue("--native-overlay-height"), `${height}px`);
    assert.equal(new URL(frame.src).searchParams.get("native"), "1");
    assert.equal(dom.window.document.getElementById("overlay-root").hidden, true);
    dom.window.close();
  }
});

test("tous les réglages communs et visuels du Like Goal modifient le DOM réel", async () => {
  const dom = await loadOverlay("like-goal", { theme: "classic" });
  const { window } = dom;
  const { document } = window;
  const root = document.documentElement;
  const view = document.getElementById("like-goal-view");

  sendCardMessage(window, "configuration", {
    overlayKey: "likeGoal",
    config: {
      enabled: false,
      scale: 135,
      x: 24,
      y: -18,
      title: "OBJECTIF COMPACT",
      current: 320,
      target: 800,
      goalBaseline: 120,
      progressLabel: "likes du test",
      showHeader: false,
      showGoal: false,
      showPercent: false,
      showShadow: false,
      showWhenIdle: false,
      font: "Georgia",
      fontSize: 125,
      rtl: true,
      saturation: 43,
      hue: -21,
      accent: "#123456",
      secondary: "#654321",
      textColor: "#abcdef",
      background: "#102030",
      backgroundOpacity: 47,
      shadowColor: "#223344",
      titleX: 31,
      titleY: -12,
      titleScale: 145,
      titleColor: "#fedcba",
      contentX: -22,
      contentY: 19,
      contentScale: 160,
      contentColor: "#aabbcc",
      percentColor: "#cc33aa"
    }
  });

  assert.equal(root.style.getPropertyValue("--overlay-scale"), "1.35");
  assert.equal(root.style.getPropertyValue("--overlay-x"), "24px");
  assert.equal(root.style.getPropertyValue("--overlay-y"), "-18px");
  assert.equal(root.style.getPropertyValue("--overlay-font-size"), "1.25");
  assert.equal(root.style.getPropertyValue("--overlay-background-opacity"), "47%");
  assert.equal(root.style.getPropertyValue("--overlay-shadow-color"), "#223344");
  assert.equal(root.style.getPropertyValue("--like-goal-title-x"), "31px");
  assert.equal(root.style.getPropertyValue("--like-goal-title-y"), "-12px");
  assert.equal(root.style.getPropertyValue("--like-goal-title-scale"), "1.45");
  assert.equal(root.style.getPropertyValue("--like-goal-content-x"), "-22px");
  assert.equal(root.style.getPropertyValue("--like-goal-content-y"), "19px");
  assert.equal(root.style.getPropertyValue("--like-goal-content-scale"), "1.6");
  assert.equal(view.style.fontFamily, 'Georgia, "Times New Roman", serif');
  assert.equal(view.style.direction, "rtl");
  assert.equal(view.style.filter, "saturate(43%) hue-rotate(-21deg)");
  assert.equal(view.classList.contains("overlay-config-disabled"), true);
  assert.equal(view.classList.contains("overlay-idle-hidden"), true);
  assert.equal(view.classList.contains("overlay-without-shadow"), true);
  assert.equal(document.getElementById("like-goal-title").hidden, true);
  assert.equal(document.getElementById("like-goal-progress-label").hidden, true);
  assert.equal(document.getElementById("like-goal-percent").hidden, true);
  assert.equal(document.getElementById("like-goal-progress").style.width, "29.411764705882355%");

  dom.window.close();
});

test("le Coin Jar affiche ses valeurs, son objectif, son minimum et sa jauge", async () => {
  const dom = await loadOverlay("coin-jar", { model: "fantasy" });
  const { window } = dom;
  const { document } = window;
  const widget = document.querySelector(".coin-jar-widget");
  const meter = document.querySelector(".coin-jar-meter");

  sendCardMessage(window, "configuration", {
    overlayKey: "coinJar",
    config: {
      model: "space",
      current: 60,
      target: 100,
      minCoins: 10,
      showGoal: true,
      showBase: true
    }
  });

  assert.equal(document.documentElement.dataset.jarModel, "space");
  assert.equal(document.getElementById("coin-jar-current").textContent, "60");
  assert.equal(document.getElementById("coin-jar-target").textContent, "100");
  assert.equal(document.getElementById("coin-jar-level").style.height, "55.55555555555556%");
  assert.equal(widget.classList.contains("without-base"), false);
  assert.equal(meter.hidden, false);

  sendCardMessage(window, "configuration", {
    overlayKey: "coinJar",
    config: {
      current: 0,
      target: 100,
      minCoins: 80,
      showGoal: false,
      showBase: false
    }
  });

  assert.equal(document.getElementById("coin-jar-current").textContent, "80");
  assert.equal(document.getElementById("coin-jar-level").style.height, "0%");
  assert.equal(widget.classList.contains("without-base"), true);
  assert.equal(meter.hidden, true);

  dom.window.close();
});

test("les champs de classement pilotent le titre, les lignes, badges et couleurs", async () => {
  const dom = await loadOverlay("leaderboard", {
    kind: "donors",
    theme: "classic"
  });
  const { window } = dom;
  const { document } = window;
  const view = document.getElementById("leaderboard-view");

  sendCardMessage(window, "configuration", {
    overlayKey: "topDonors",
    config: {
      title: "TOP TESTÉ",
      maxRows: 2,
      showHeader: true,
      showRank: false,
      showAvatars: false,
      showCrown: false,
      showRankBadges: false,
      showMetricLabel: false,
      nameColor: "#112233",
      scoreColor: "#334455",
      rankColor: "#556677",
      rowOpacity: 31
    }
  });

  assert.equal(document.getElementById("leaderboard-title").textContent, "TOP TESTÉ");
  assert.equal(document.querySelectorAll(".leaderboard-row").length, 2);
  assert.equal(view.classList.contains("leaderboard-without-rank"), true);
  assert.equal(view.classList.contains("leaderboard-without-avatars"), true);
  assert.equal(document.querySelectorAll(".leaderboard-rank-medal").length, 0);
  assert.equal(document.querySelectorAll(".leaderboard-crown").length, 0);
  assert.equal(document.querySelector(".leaderboard-identity em").hidden, true);
  assert.equal(document.documentElement.style.getPropertyValue("--leaderboard-name-color"), "#112233");
  assert.equal(document.documentElement.style.getPropertyValue("--leaderboard-score-color"), "#334455");
  assert.equal(document.documentElement.style.getPropertyValue("--leaderboard-rank-color"), "#556677");
  assert.equal(document.documentElement.style.getPropertyValue("--leaderboard-row-opacity"), "0.31");

  dom.window.close();
});

test("les classements donateurs et tapoteurs restent totalement isolés", async () => {
  const cases = [
    {
      kind: "donors",
      overlayKey: "topDonors",
      otherOverlayKey: "topTappers",
      title: "DONATEURS UNIQUEMENT",
      acceptedType: "gift",
      acceptedData: { giftName: "Rose", count: 5, value: 1_000 },
      rejectedType: "like",
      rejectedData: { count: 50_000, likeCount: 50_000 }
    },
    {
      kind: "tappers",
      overlayKey: "topTappers",
      otherOverlayKey: "topDonors",
      title: "TAPOTEURS UNIQUEMENT",
      acceptedType: "like",
      acceptedData: { count: 5_000, likeCount: 5_000 },
      rejectedType: "gift",
      rejectedData: { giftName: "Rose", count: 50, value: 1_000 }
    }
  ];

  for (const entry of cases) {
    const dom = await loadOverlay("leaderboard", {
      kind: entry.kind,
      theme: "classic"
    });
    const { window } = dom;
    const { document } = window;

    sendCardMessage(window, "configuration", {
      overlayKey: entry.overlayKey,
      config: { title: entry.title, maxRows: 5 }
    });
    sendCardMessage(window, "configuration", {
      overlayKey: entry.otherOverlayKey,
      config: { title: "TITRE DE L’AUTRE CLASSEMENT" }
    });
    sendCardMessage(window, "event", {
      id: `rejected-${entry.kind}`,
      type: entry.rejectedType,
      timestamp: Date.now(),
      user: { id: "intrus", displayName: "AUTRE CLASSEMENT" },
      data: entry.rejectedData
    });
    sendCardMessage(window, "event", {
      id: `accepted-${entry.kind}`,
      type: entry.acceptedType,
      timestamp: Date.now(),
      user: { id: "valid", displayName: "CLASSEMENT CORRECT" },
      data: entry.acceptedData
    });

    assert.equal(document.getElementById("leaderboard-title").textContent, entry.title);
    assert.match(document.getElementById("leaderboard-rows").textContent, /CLASSEMENT CORRECT/);
    assert.doesNotMatch(document.getElementById("leaderboard-rows").textContent, /AUTRE CLASSEMENT/);
    dom.window.close();
  }
});

test("le timer standard applique chaque champ et son démarrage automatique", async () => {
  const dom = await loadOverlay("timer", {
    theme: "classic",
    timerAutoStart: "false"
  });
  const { window } = dom;
  const { document } = window;

  sendCardMessage(window, "configuration", {
    overlayKey: "timer",
    config: {
      title: "CHRONO TEST",
      seconds: 3661,
      showHours: true,
      timerTitleScale: 130,
      timerValueScale: 155,
      timerAutoStart: false,
      accent: "#22aaee"
    }
  });

  assert.equal(document.getElementById("timer-label").textContent, "CHRONO TEST");
  assert.equal(document.getElementById("timer-value").textContent, "01:01:01");
  assert.equal(document.documentElement.style.getPropertyValue("--timer-title-scale"), "1.3");
  assert.equal(document.documentElement.style.getPropertyValue("--timer-value-scale"), "1.55");

  sendCardMessage(window, "timer", {
    operation: "set",
    seconds: 3661,
    label: "TITRE DU MULTIPLICATEUR"
  });
  assert.equal(
    document.getElementById("timer-label").textContent,
    "CHRONO TEST"
  );

  sendCardMessage(window, "configuration", {
    overlayKey: "timer",
    config: { seconds: 90_061, showHours: true, timerAutoStart: false }
  });
  assert.equal(document.getElementById("timer-value").textContent, "25:01:01");

  sendCardMessage(window, "configuration", {
    overlayKey: "timer",
    config: { seconds: 90_061, showHours: false, timerAutoStart: false }
  });
  assert.equal(document.getElementById("timer-value").textContent, "1501:01");

  sendCardMessage(window, "configuration", {
    overlayKey: "timer",
    config: {
      title: "CHRONO TEST",
      seconds: 3,
      showHours: false,
      timerAutoStart: true
    }
  });
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal(document.getElementById("timer-value").textContent, "00:02");

  sendCardMessage(window, "configuration", {
    overlayKey: "timer",
    config: { seconds: 3, showHours: false, timerAutoStart: false }
  });
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal(document.getElementById("timer-value").textContent, "00:03");

  dom.window.close();
});

test("les deux timers conservent chacun leur propre titre", async () => {
  const dom = await loadOverlay("multiplier-timer", {
    theme: "classic",
    timerAutoStart: "false"
  });
  const { window } = dom;
  const { document } = window;

  sendCardMessage(window, "configuration", {
    overlayKey: "multiplierTimer",
    config: {
      title: "BONUS PERSONNALISÉ",
      seconds: 120,
      multiplier: 3,
      showHours: false,
      timerAutoStart: false
    }
  });
  sendCardMessage(window, "multiplier-timer", {
    operation: "set",
    seconds: 90,
    multiplier: 3,
    label: "TITRE DU TIMER STANDARD"
  });

  assert.equal(
    document.getElementById("multiplier-timer-label").textContent,
    "BONUS PERSONNALISÉ"
  );
  assert.equal(document.getElementById("multiplier-timer-value").textContent, "01:30");
  assert.equal(document.getElementById("multiplier-value").textContent, "X3");
  assert.equal(document.getElementById("timer-label").textContent, "TEMPS RESTANT");

  dom.window.close();
});

test("le compteur de wins applique valeurs, objectif, couleurs et placement", async () => {
  const dom = await loadOverlay("win-counter", { theme: "classic" });
  const { window } = dom;
  const { document } = window;

  sendCardMessage(window, "configuration", {
    overlayKey: "winCounter",
    config: {
      title: "VICTOIRES TEST",
      current: -4,
      target: 12,
      showHeader: true,
      showGoal: true,
      allowNegative: true,
      negativeColor: "#aa1122",
      neutralColor: "#ddeeff",
      positiveColor: "#22aa44",
      labelX: 17,
      labelY: -9
    }
  });

  const value = document.getElementById("win-counter-value");
  assert.equal(value.textContent, "-4");
  assert.equal(value.style.color, "rgb(170, 17, 34)");
  assert.equal(document.getElementById("win-counter-target").textContent, "12");
  assert.equal(document.querySelector(".win-counter-content > span").textContent, "VICTOIRES TEST");
  assert.equal(document.querySelector(".win-counter-content").style.translate, "17px -9px");

  sendCardMessage(window, "configuration", {
    overlayKey: "winCounter",
    config: {
      current: 5,
      target: 12,
      showHeader: false,
      showGoal: false,
      allowNegative: true,
      positiveColor: "#22aa44"
    }
  });
  assert.equal(value.style.color, "rgb(34, 170, 68)");
  assert.equal(document.querySelector(".win-counter-content > span").hidden, true);
  assert.equal(document.querySelector(".win-counter-content > small").hidden, true);

  dom.window.close();
});

test("tous les champs visuels de la roue atteignent son moteur", async () => {
  const dom = await loadOverlay("wheel", { design: "classic" });
  const { window } = dom;
  const { document } = window;

  sendCardMessage(window, "configuration", {
    overlayKey: "wheel",
    config: {
      design: "royal",
      title: "ROUE TEST",
      choices: "ALPHA|BETA|GAMMA",
      colors: "#111111|#222222|#333333",
      font: "Impact",
      fontSize: 72,
      textOrientation: "vertical",
      textColor: "#abcdef",
      textShadowColor: "#123456",
      textShadowStrength: 88,
      textRadius: 115,
      textSegmentOffset: 13,
      textBoxWidth: 170,
      textBoxHeight: 210,
      textAngleOffset: 7,
      textAlign: "right",
      textClamp: false,
      textMaxLines: 2,
      lineSpacing: 64,
      letterSpacing: 35,
      showBase: false,
      spinDuration: 8,
      scale: 125,
      glow: 110,
      pointerPosition: "left",
      alwaysVisible: true
    }
  });

  const stage = document.getElementById("wheel-stage");
  const machine = document.getElementById("wheel-machine");
  const labels = document.querySelectorAll(".segment-label");
  assert.equal(document.documentElement.dataset.wheelDesign, "royal");
  assert.equal(document.getElementById("wheel-caption").textContent, "ROUE TEST");
  assert.equal(labels.length, 3);
  assert.deepEqual([...labels].map((label) => label.textContent), ["ALPHA", "BETA", "GAMMA"]);
  assert.equal(stage.classList.contains("royal"), true);
  assert.equal(stage.classList.contains("without-base"), true);
  assert.equal(stage.dataset.pointer, "left");
  assert.equal(stage.dataset.textOrientation, "vertical");
  assert.equal(stage.classList.contains("wheel-overlay--text-clamp"), false);
  assert.equal(document.getElementById("wheel-pointer").classList.contains("wheel-pointer--left"), true);
  assert.equal(machine.style.getPropertyValue("--wheel-text-color"), "#abcdef");
  assert.equal(machine.style.getPropertyValue("--wheel-shadow-color"), "#123456");
  assert.equal(machine.style.getPropertyValue("--wheel-text-radius"), "115%");
  assert.equal(machine.style.getPropertyValue("--wheel-text-offset"), "13px");
  assert.equal(machine.style.getPropertyValue("--wheel-text-width"), "170px");
  assert.equal(machine.style.getPropertyValue("--wheel-text-height"), "210px");
  assert.equal(machine.style.getPropertyValue("--wheel-angle-offset"), "7deg");
  assert.equal(machine.style.getPropertyValue("--wheel-spin-duration"), "8s");

  sendCardMessage(window, "wheel", {
    choices: ["RÉSULTAT A", "RÉSULTAT B"],
    colors: ["#aa0000", "#00aa00"],
    winnerIndex: 1,
    winner: "RÉSULTAT B",
    settings: { spinDuration: 1, alwaysVisible: true, soundActive: false },
    design: "classic"
  });
  assert.deepEqual(
    [...document.querySelectorAll(".segment-label")].map((label) => label.textContent),
    ["RÉSULTAT A", "RÉSULTAT B"]
  );
  assert.equal(document.documentElement.dataset.wheelDesign, "classic");
  assert.equal(document.getElementById("wheel").style.getPropertyValue("--wheel-spin-rotation"), "2610deg");

  dom.window.close();
});
