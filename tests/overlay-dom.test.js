"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");
const { JSDOM, VirtualConsole } = require("jsdom");

const overlayDirectory = path.join(__dirname, "..", "resources", "overlays");

async function loadOverlay(view, parameters = {}, setupWindow = () => {}) {
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
      setupWindow(window);
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

test("le moteur Like Goal utilise GTA sans design et remplace les anciens designs Classique", async () => {
  for (const parameters of [{}, { theme: "obsolete" }]) {
    const dom = await loadOverlay("like-goal", parameters);
    try {
      const root = dom.window.document.documentElement;
      assert.equal(root.dataset.theme, "gta");
      sendCardMessage(dom.window, "configuration", { overlayKey: "likeGoal", config: { theme: "naruto" } });
      assert.equal(root.dataset.theme, "naruto");
      sendCardMessage(dom.window, "configuration", { overlayKey: "likeGoal", config: { theme: "classic" } });
      assert.equal(root.dataset.theme, "gta");
    } finally {
      dom.window.close();
    }
  }
});

test("le Like Goal applique les tailles jusqu’à 400 % dans l’URL et les mises à jour", async (t) => {
  const dom = await loadOverlay("like-goal", { titleScale: "350", contentScale: "400" });
  t.after(() => dom.window.close());
  const style = dom.window.document.documentElement.style;
  assert.equal(style.getPropertyValue("--like-goal-title-scale"), "3.5");
  assert.equal(style.getPropertyValue("--like-goal-content-scale"), "4");
  sendCardMessage(dom.window, "configuration", { overlayKey: "likeGoal", config: { titleScale: 400, contentScale: 300 } });
  assert.equal(style.getPropertyValue("--like-goal-title-scale"), "4");
  assert.equal(style.getPropertyValue("--like-goal-content-scale"), "3");
  sendCardMessage(dom.window, "configuration", { overlayKey: "likeGoal", config: { titleScale: 500, contentScale: 25 } });
  assert.equal(style.getPropertyValue("--like-goal-title-scale"), "4");
  assert.equal(style.getPropertyValue("--like-goal-content-scale"), "0.5");
});

test("un Like Goal chargé dans un vrai DOM applique sa configuration et son état", async () => {
  const dom = await loadOverlay("like-goal", { theme: "classic" });
  const { window } = dom;
  const { document } = window;

  assert.equal(document.documentElement.dataset.theme, "gta", "les anciennes URL Classique utilisent GTA");
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

test("le Like Goal utilise le total absolu publié, sans doubler les lots après hydratation", async (t) => {
  const dom = await loadOverlay("like-goal", { theme: "classic", target: "50000" });
  t.after(() => dom.window.close());
  const { window } = dom;
  const value = () => window.document.getElementById("like-goal-current").textContent;
  sendCardMessage(window, "session-state", { hasData: true, likeGoalCurrent: 18300 });
  const first = value();
  for (const [index, current] of [18300, 18345, 18345].entries()) {
    sendCardMessage(window, "event", { id: `canonical-like-${index}`, type: "like",
      user: { id: "viewer" }, data: { count: 45, likeGoalCurrent: current } });
    window.renderLikeGoal(); // Fin d'animation déterministe : ne tester aucun délai matériel.
    if (index === 0) assert.equal(value(), first);
    assert.equal(value().replace(/\D/g, ""), String(current));
  }
  sendCardMessage(window, "event", { id: "canonical-zero", type: "like",
    user: { id: "viewer" }, data: { count: 45, likeGoalCurrent: 0 } });
  window.renderLikeGoal();
  assert.equal(value(), "0", "un zéro canonique ne doit pas devenir +45");
  sendCardMessage(window, "event", { id: "legacy-simulator", type: "like",
    user: { id: "viewer" }, data: { count: 25 } });
  window.renderLikeGoal();
  assert.equal(value(), "25", "les événements d'aperçu anciens gardent leur addition");
});

test("les sources de tous formats montent directement leur scène native", async () => {
  for (const [view, width, height] of [
    ["like-goal", 1300, 200],
    ["timer", 900, 360],
    ["leaderboard", 520, 640],
    ["wheel", 800, 900],
    ["match", 1080, 1920],
    ["game", 1920, 1080]
  ]) {
    const dom = await loadOverlay(view, { native: "" });
    const activeView = dom.window.document.getElementById(`${view}-view`);
    assert.ok(activeView, `${view} doit posséder une scène native`);
    assert.equal(activeView.classList.contains("native-overlay-canvas"), true);
    assert.equal(activeView.style.getPropertyValue("--native-canvas-width"), `${width}px`);
    assert.equal(activeView.style.getPropertyValue("--native-canvas-height"), `${height}px`);
    assert.equal(dom.window.document.querySelector(".native-overlay-shell"), null);
    assert.equal(dom.window.document.getElementById("overlay-root").hidden, false);
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
  assert.equal(root.style.getPropertyValue("--like-goal-title-x"), "");
  assert.equal(root.style.getPropertyValue("--like-goal-title-y"), "");
  assert.equal(root.style.getPropertyValue("--like-goal-title-scale"), "1.45");
  assert.equal(root.style.getPropertyValue("--like-goal-content-x"), "");
  assert.equal(root.style.getPropertyValue("--like-goal-content-y"), "");
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

test("la Coin Jar reste sans compteur ni jauge même avec une configuration historique", async (t) => {
  const dom = await loadOverlay("coin-jar", { model: "fantasy", current: "600", target: "1000", minCoins: "10", showGoal: "true", showBase: "true", showPercent: "true" });
  t.after(() => dom.window.close());
  const { window } = dom;
  const { document } = window;
  for (const config of [{}, { model: "space", current: 500, target: 1000, showGoal: true, showBase: true, showPercent: true, coinJarLabel: "PIÈCES", coinJarShowLabel: true }]) {
    sendCardMessage(window, "configuration", { overlayKey: "coinJar", config });
    assert.equal(document.querySelector(".coin-jar-meter, .coin-jar-level, #coin-jar-current, #coin-jar-target, #coin-jar-percent, #coin-jar-label"), null);
    assert.equal(document.querySelector(".coin-jar-widget").textContent.trim(), "COIN JAR");
    assert.equal(document.querySelectorAll(".coin-jar-gift").length, 0, "aucun cadeau artificiel au repos");
  }
});

test("les 14 bocaux appliquent les titres et tailles sans compteur ni perte des cadeaux", async () => {
  const catalog = require("../resources/overlays/overlay-catalog");
  const dom = await loadOverlay("coin-jar", { current: 60, target: 100, minCoins: 10 });
  const { window } = dom;
  const { document } = window;
  try {
    sendCardMessage(window, "event", { id: "jar-preserved-gift", type: "gift", user: { name: "Test" }, data: { count: 1, value: 1, giftName: "Rose" } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const gift = document.querySelector(".coin-jar-gift");
    assert.ok(gift);
    const count = window.eval("coinJarCurrent");
    sendCardMessage(window, "event", { id: "jar-preserved-gift", type: "gift", data: { count: 1, value: 1 } });
    assert.equal(window.eval("coinJarCurrent"), count);
    for (const [model] of catalog.coinJarModels) {
      sendCardMessage(window, "configuration", { overlayKey: "coinJar", config: {
        model, title: "MON BOCAL", showHeader: true, coinJarLabel: "cadeaux", coinJarShowLabel: true,
        coinJarTitleScale: 350, coinJarValueScale: 400, coinJarLabelScale: 50,
        coinJarTitleColor: "#123456", coinJarValueColor: "#abcdef", coinJarLabelColor: "#654321", coinJarPercentColor: "#fedcba", showPercent: true
      } });
      assert.equal(document.documentElement.dataset.jarModel, model);
      assert.equal(document.getElementById("coin-jar-title").textContent, "MON BOCAL");
      assert.equal(document.querySelector(".coin-jar-meter, .coin-jar-level, #coin-jar-percent, #coin-jar-label"), null);
      assert.equal(window.eval("coinJarCurrent"), count);
      assert.equal(gift.isConnected, true, model);
      assert.equal(document.documentElement.style.getPropertyValue("--coin-jar-title-scale"), "3.5");
      assert.equal(document.documentElement.style.getPropertyValue("--coin-jar-title-color"), "#123456");
    }
    sendCardMessage(window, "configuration", { overlayKey: "timer", config: { title: "NE PAS APPLIQUER", current: 0 } });
    assert.equal(document.getElementById("coin-jar-title").textContent, "MON BOCAL");
    sendCardMessage(window, "configuration", { overlayKey: "coinJar", config: { title: "", coinJarLabel: "", showPercent: false } });
    assert.equal(document.getElementById("coin-jar-title").hidden, true);
    sendCardMessage(window, "configuration", { overlayKey: "coinJar", config: { title: "RETOUR", coinJarLabel: "PIÈCES", showHeader: false, coinJarShowLabel: false } });
    assert.equal(document.getElementById("coin-jar-title").hidden, true);
    sendCardMessage(window, "coin-jar", { operation: "reset" });
    assert.equal(gift.isConnected, false);
    assert.equal(window.eval("coinJarCurrent"), 10);
  } finally {
    dom.window.close();
  }
});

test("les actions, la session et les cadeaux de la Coin Jar restent synchronisés après reconfiguration", async (t) => {
  const dom = await loadOverlay("coin-jar", { preview: "" }, (window) => {
    window.EventSource = class { addEventListener() {} close() {} };
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  const { document } = window;
  window.updateCoinJar({ operation: "set", current: 250 });
  window.receiveCoinJarGift({ id: "live-gift", type: "gift", data: { count: 2, value: 10 } });
  await new Promise((resolve) => setTimeout(resolve, 10));
  const gift = document.querySelector(".coin-jar-gift");
  assert.ok(gift);
  assert.equal(String(window.eval("coinJarCurrent")), "270");
  window.updateOverlayConfiguration({ overlayKey: "coinJar", config: { model: "cyberpunk", current: 0, title: "MON LIVE", coinJarLabel: "cadeaux", coinJarValueScale: 400, showBase: false } });
  assert.equal(String(window.eval("coinJarCurrent")), "270");
  assert.equal(gift.isConnected, true);
  window.updateCoinJar({ operation: "adjust", amount: 5 });
  assert.equal(String(window.eval("coinJarCurrent")), "275");
  window.receiveCoinJarGift({ id: "hydrated-gift", type: "gift", data: { count: 2, value: 10 } }, { authoritativeState: true });
  assert.equal(String(window.eval("coinJarCurrent")), "275", "le total de session inclut déjà ce cadeau");
  window.receiveCoinJarGift({ id: "hydrated-gift", type: "gift", data: { count: 2, value: 10 } });
  assert.equal(String(window.eval("coinJarCurrent")), "275");
  assert.equal(document.getElementById("coin-jar-title").textContent, "MON LIVE");
  window.updateCoinJar({ operation: "reset" });
  assert.equal(gift.isConnected, false);
  assert.equal(String(window.eval("coinJarCurrent")), "0");
  window.hydrateOverlaySession({ hasData: true, coinJarCurrent: 0, recentEvents: [{ id: "live-gift", type: "gift", data: { count: 2, value: 10 } }, { id: "hydrated-gift", type: "gift", data: { count: 2, value: 10 } }] });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(document.querySelectorAll(".coin-jar-gift").length, 0, "la session ne remet pas les anciens cadeaux après réinitialisation");
  window.receiveCoinJarGift({ id: "new-gift-after-reset", type: "gift", data: { value: 5 } });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(String(window.eval("coinJarCurrent")), "5");
  assert.equal(document.querySelectorAll(".coin-jar-gift").length, 1);
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

test("reconfigurer chaque classement garde les scores, les avatars et les événements LIVE indépendants", async (t) => {
  for (const [kind, key, other, type, data] of [["donors", "topDonors", "topTappers", "gift", { count: 2, value: 10 }], ["tappers", "topTappers", "topDonors", "like", { count: 20 }]]) {
    const dom = await loadOverlay("leaderboard", { kind, theme: "classic", preview: "" }, (window) => { window.EventSource = class { addEventListener() {} close() {} }; });
    t.after(() => dom.window.close());
    const { window } = dom;
    const { document } = window;
    window.hydrateOverlaySession({ hasData: true, leaderboards: { [kind]: [{ id: "viewer1", name: "Participant avec un nom long", score: 120, avatarUrl: "https://example.com/avatar.png" }, { id: "viewer2", name: "Second", score: 80 }] } });
    assert.equal(document.documentElement.dataset.theme, "gta");
    window.updateOverlayConfiguration({ overlayKey: key, config: { title: "Nouveau titre", theme: "naruto", maxRows: 1, leaderboardTitleColor: "#123456", nameColor: "#234567", scoreColor: "#345678", rankColor: "#456789", leaderboardTitleScale: 400, leaderboardNameScale: 350, leaderboardScoreScale: 300, rowOpacity: 0 } });
    assert.equal(document.querySelector(".leaderboard-identity strong").textContent, "Participant avec un nom long");
    assert.equal(document.querySelector(".leaderboard-identity em").textContent, `120 ${kind === "donors" ? "coins" : "likes"}`);
    assert.equal(document.querySelector(".leaderboard-avatar-image").getAttribute("src"), "https://example.com/avatar.png");
    for (const [property, value] of Object.entries({ "--leaderboard-title-scale": "4", "--leaderboard-name-scale": "3.5", "--leaderboard-score-scale": "3", "--leaderboard-title-color": "#123456", "--leaderboard-row-opacity": "0" })) assert.equal(document.documentElement.style.getPropertyValue(property), value);
    window.updateOverlayConfiguration({ overlayKey: other, config: { title: "Autre classement", maxRows: 5, leaderboardTitleColor: "#abcdef" } });
    assert.equal(document.getElementById("leaderboard-title").textContent, "Nouveau titre");
    window.updateOverlayConfiguration({ overlayKey: key, config: { maxRows: 5 } });
    for (const [part, color] of [["name", "#234567"], ["score", "#345678"], ["rank", "#456789"]]) assert.equal(document.documentElement.style.getPropertyValue(`--leaderboard-${part}-color`), color);
    assert.equal(document.querySelectorAll(".leaderboard-row:not(.is-empty)").length, 2, "réduire le nombre de places ne détruit pas les autres scores");
    window.updateInteractiveWidgets({ id: `${kind}-after-configuration`, type, user: { id: "viewer1", displayName: "Participant avec un nom long" }, data });
    assert.equal(document.querySelector(".leaderboard-identity em").textContent, `140 ${kind === "donors" ? "coins" : "likes"}`);
  }
});

test("les libellés des classements sont indépendants, masquables et conservés vides", async (t) => {
  for (const [kind, key, other] of [["donors", "topDonors", "topTappers"], ["tappers", "topTappers", "topDonors"]]) {
    const dom = await loadOverlay("leaderboard", { kind, leaderboardMetricLabel: "", leaderboardAvatarScale: "400" });
    t.after(() => dom.window.close());
    const { window } = dom;
    const { document } = window;
    assert.equal(document.querySelector(".leaderboard-score-unit").hidden, true);
    assert.equal(document.documentElement.style.getPropertyValue("--leaderboard-avatar-scale"), "1");
    window.updateOverlayConfiguration({ overlayKey: key, config: { leaderboardMetricLabel: "points", leaderboardShowUnit: true, leaderboardUnitColor: "#123456", leaderboardUnitScale: 250, leaderboardScoreScale: 150, leaderboardAvatarScale: 75 } });
    assert.equal(document.querySelector(".leaderboard-score-unit").textContent, "points");
    assert.equal(document.querySelector(".leaderboard-score-unit").hidden, false);
    assert.equal(document.documentElement.style.getPropertyValue("--leaderboard-unit-color"), "#123456");
    assert.equal(document.documentElement.style.getPropertyValue("--leaderboard-unit-scale"), "2.5");
    assert.equal(document.documentElement.style.getPropertyValue("--leaderboard-score-scale"), "1.5");
    assert.equal(document.documentElement.style.getPropertyValue("--leaderboard-avatar-scale"), "0.75");
    const before = document.querySelector(".leaderboard-score-number").textContent;
    window.updateOverlayConfiguration({ overlayKey: other, config: { leaderboardMetricLabel: "AUTRE" } });
    assert.equal(document.querySelector(".leaderboard-score-unit").textContent, "points");
    window.updateOverlayConfiguration({ overlayKey: key, config: { leaderboardShowUnit: false } });
    assert.equal(document.querySelector(".leaderboard-score-unit").hidden, true);
    assert.equal(document.querySelector(".leaderboard-score-number").textContent, before);
    window.updateOverlayConfiguration({ overlayKey: key, config: { leaderboardShowUnit: true } });
    assert.equal(document.querySelector(".leaderboard-score-unit").textContent, "points");
    window.updateOverlayConfiguration({ overlayKey: key, config: { leaderboardMetricLabel: '<img src="x">' } });
    assert.equal(document.querySelector(".leaderboard-score-unit img"), null);
    assert.equal(document.querySelector(".leaderboard-score-unit").textContent, '<img src="x">');
    window.updateOverlayConfiguration({ overlayKey: key, config: { leaderboardMetricLabel: "" } });
    assert.equal(document.querySelector(".leaderboard-score-unit").hidden, true);
    assert.equal(document.querySelector(".leaderboard-score-number").textContent, before);
  }
});

test("le timer garde son état piloté par les actions pendant une reconfiguration visuelle", async (t) => {
  const dom = await loadOverlay("timer", { preview: "", theme: "classic", timerTitleScale: "350", timerValueScale: "400", timerTitleColor: "#112233", timerValueColor: "#aabbcc" }, (window) => {
    window.EventSource = class { addEventListener() {} close() {} };
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  const root = window.document.documentElement;
  assert.equal(root.dataset.theme, "gta");
  assert.equal(root.style.getPropertyValue("--timer-title-scale"), "3.5");
  assert.equal(root.style.getPropertyValue("--timer-value-scale"), "4");
  assert.equal(root.style.getPropertyValue("--timer-title-color"), "#112233");
  assert.equal(root.style.getPropertyValue("--timer-value-color"), "#aabbcc");
  window.updateTimer({ operation: "set", remainingSeconds: 120, paused: true, label: "Partie" });
  window.updateOverlayConfiguration({ overlayKey: "timer", config: { theme: "naruto", title: "Mon jeu", seconds: 300, timerAutoStart: true, timerTitleScale: 400, timerValueScale: 350, showHeader: false, timerTitleColor: "#123456", timerValueColor: "#fedcba" } });
  assert.equal(window.document.getElementById("timer-value").textContent, "00:02:00");
  assert.equal(window.document.getElementById("timer-value").classList.contains("paused"), true);
  assert.equal(window.document.getElementById("timer-label").hidden, true);
  assert.equal(root.dataset.theme, "naruto");
  assert.equal(root.style.getPropertyValue("--timer-title-scale"), "4");
  assert.equal(root.style.getPropertyValue("--timer-value-scale"), "3.5");
  window.updateOverlayConfiguration({ overlayKey: "timer", config: { showHeader: true } });
  window.updateTimer({ operation: "set", remainingSeconds: 90, paused: true, label: "Autre action" });
  assert.equal(window.document.getElementById("timer-value").textContent, "00:01:30");
  assert.equal(window.document.querySelector("#timer-label > span").textContent, "Mon jeu");
  assert.equal(window.document.querySelectorAll("#timer-value > span").length, 1);
  assert.equal(window.document.getElementById("timer-label").hidden, false);
  assert.equal(root.style.getPropertyValue("--timer-title-color"), "#123456");
  assert.equal(root.style.getPropertyValue("--timer-value-color"), "#fedcba");
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

test("le timer ne rejoue pas un delta déjà inclus dans l'état public", async () => {
  const dom = await loadOverlay("timer", {
    theme: "classic",
    timerAutoStart: "false"
  });
  const { window } = dom;
  const { document } = window;

  sendCardMessage(window, "bootstrap", {
    overlaySession: {
      hasData: true,
      timerSeconds: 20,
      timerEndsAt: 0,
      timerPaused: true,
      timerLabel: "TEMPS RESTANT"
    }
  });
  assert.equal(document.getElementById("timer-value").textContent, "00:00:20");

  sendCardMessage(window, "timer", {
    operation: "add",
    seconds: 20,
    remainingSeconds: 20,
    endsAt: 0,
    paused: true
  });
  assert.equal(document.getElementById("timer-value").textContent, "00:00:20");

  dom.window.close();
});

test("reconfigurer le multiplicateur conserve le bonus actif envoyé par les actions et isole le timer standard", async (t) => {
  const dom = await loadOverlay("multiplier-timer", { preview: "", theme: "classic", multiplier: "20", timerTitleScale: "400", timerValueScale: "350", timerMultiplierColor: "#123456", showHours: "false" }, (window) => {
    window.EventSource = class { addEventListener() {} close() {} };
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  const { document } = window;
  const root = document.documentElement;
  assert.equal(root.dataset.theme, "gta");
  assert.equal(document.getElementById("multiplier-value").textContent, "X20");
  assert.equal(root.style.getPropertyValue("--timer-title-scale"), "4");
  assert.equal(root.style.getPropertyValue("--timer-value-scale"), "3.5");
  window.updateMultiplierTimer({ operation: "set", remainingSeconds: 90, paused: true, multiplier: 20, label: "Bonus du jeu" });
  window.updateOverlayConfiguration({ overlayKey: "multiplierTimer", config: { theme: "naruto", title: "Mon bonus", seconds: 300, multiplier: 2, timerAutoStart: true, timerValueScale: 400, timerValueColor: "#abcdef", timerMultiplierColor: "#fedcba", showHeader: false } });
  assert.equal(document.getElementById("multiplier-value").textContent, "X20", "le facteur actif ne revient pas à la valeur du formulaire");
  assert.equal(document.getElementById("multiplier-timer-value").textContent, "01:30");
  assert.equal(document.getElementById("multiplier-timer-value").classList.contains("paused"), true);
  assert.equal(document.getElementById("multiplier-timer-label").hidden, true);
  assert.equal(root.dataset.theme, "naruto");
  assert.equal(root.style.getPropertyValue("--timer-value-scale"), "4");
  assert.equal(root.style.getPropertyValue("--timer-value-color"), "#abcdef");
  assert.equal(root.style.getPropertyValue("--timer-multiplier-color"), "#fedcba");
  window.updateOverlayConfiguration({ overlayKey: "timer", config: { title: "Autre timer", multiplier: 5, seconds: 600 } });
  assert.equal(document.getElementById("multiplier-value").textContent, "X20");
  window.updateOverlayConfiguration({ overlayKey: "multiplierTimer", config: { showHeader: true } });
  window.updateMultiplierTimer({ operation: "set", remainingSeconds: 60, paused: true, multiplier: 50 });
  assert.equal(document.querySelector("#multiplier-timer-label>span").textContent, "Mon bonus");
  assert.equal(document.getElementById("multiplier-value").textContent, "X50");
  assert.equal(document.getElementById("multiplier-timer-value").textContent, "01:00");
  assert.equal(document.getElementById("timer-label").textContent, "TEMPS RESTANT");
  assert.equal(document.getElementById("timer-value").textContent, "00:00");
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

test("le compteur de wins applique valeurs, objectif, couleurs et centrage automatique", async () => {
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
      winCounterTitleColor: "#123456",
      winCounterGoalColor: "#abcdef",
      winCounterTitleScale: 350,
      winCounterValueScale: 400,
      winCounterGoalScale: 200,
      labelX: 17,
      labelY: -9
    }
  });

  const value = document.getElementById("win-counter-value");
  assert.equal(value.textContent, "-4");
  assert.equal(value.style.color, "rgb(170, 17, 34)");
  assert.equal(document.getElementById("win-counter-target").textContent, "12");
  assert.equal(document.querySelector(".win-counter-content > span").textContent, "VICTOIRES TEST");
  assert.equal(document.querySelector(".win-counter-content").style.translate, "");
  assert.equal(document.documentElement.dataset.theme, "gta");
  for (const [property, expected] of Object.entries({ "--wins-title-color": "#123456", "--wins-goal-color": "#abcdef", "--wins-title-scale": "3.5", "--wins-value-scale": "4", "--wins-goal-scale": "2" })) {
    assert.equal(document.documentElement.style.getPropertyValue(property), expected);
  }

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

test("modifier le design des wins conserve la valeur LIVE, le multiplicateur et la synchronisation des jeux", async (t) => {
  const dom = await loadOverlay("win-counter", { theme: "gta", preview: "", current: 0 }, (window) => {
    window.EventSource = class { addEventListener() {} close() {} };
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  const { document } = window;
  const value = document.getElementById("win-counter-value");
  window.updateWinCounter({ operation: "set", amount: 7 });
  window.updateWinCounter({ operation: "multiplier", amount: 3, durationSeconds: 60 });
  window.updateWinCounter({ operation: "adjust", amount: 2 });
  assert.equal(value.textContent, "13");
  window.updateOverlayConfiguration({ overlayKey: "winCounter", config: { theme: "naruto", current: 0, title: "Wins du jeu", showHeader: false, winCounterValueScale: 400, winCounterTitleColor: "#123456", positiveColor: "#abcdef" } });
  assert.equal(value.textContent, "13");
  assert.equal(value.style.color, "rgb(171, 205, 239)");
  assert.equal(document.documentElement.style.getPropertyValue("--wins-value-scale"), "4");
  assert.equal(document.getElementById("win-counter-title").hidden, true);
  window.updateWinCounter({ operation: "adjust", amount: 1 });
  assert.equal(value.textContent, "16", "le bonus actif reste appliqué après un changement de design");
  window.updateWinCounter({ operation: "adjust", amount: 2, current: 42 });
  assert.equal(value.textContent, "42", "une valeur absolue envoyée par un jeu ne doit pas être multipliée une seconde fois");
  window.updateOverlayConfiguration({ overlayKey: "timer", config: { current: 0, title: "Autre widget" } });
  assert.equal(value.textContent, "42");
  window.updateOverlayConfiguration({ overlayKey: "winCounter", config: { showHeader: true } });
  assert.equal(document.getElementById("win-counter-title").textContent, "Wins du jeu");
  assert.equal(document.getElementById("win-counter-title").hidden, false);
  window.updateWinCounter({ operation: "set", amount: -5 });
  assert.equal(value.textContent, "-5");
  window.updateOverlayConfiguration({ overlayKey: "winCounter", config: { allowNegative: false } });
  window.updateWinCounter({ operation: "adjust", amount: -1 });
  assert.equal(value.textContent, "0");
});

test("les titres, tailles et résultats de chaque design de roue restent indépendants", async (t) => {
  for (const design of ["classic", "royal"]) {
    const dom = await loadOverlay("wheel", { design, choices: "A|B", wheelTitle: "", wheelShowTitle: "false", wheelTextScale: "50" });
    t.after(() => dom.window.close());
    const { window } = dom;
    const { document } = window;
    const title = document.getElementById("wheel-caption");
    const stage = document.getElementById("wheel-stage");
    assert.equal(title.textContent, "");
    assert.equal(title.hidden, true);
    window.syncWheelResponsiveTypography();
    const before = parseFloat(document.querySelector(".segment-label > span").style.fontSize);
    sendCardMessage(window, "configuration", { overlayKey: "wheel", config: {
      wheelTitle: "Ma roue <LIVE>", wheelShowTitle: true, wheelTitleColor: "#123456", wheelTitleScale: 400,
      wheelTextScale: 400, wheelWinnerColor: "#abcdef", wheelWinnerScale: 350, glow: 0, textShadowStrength: 0, lineSpacing: 0, letterSpacing: 0
    } });
    window.syncWheelResponsiveTypography();
    assert.equal(title.textContent, "Ma roue <LIVE>");
    assert.equal(title.querySelector("live"), null);
    assert.equal(title.hidden, false);
    assert.equal(stage.style.getPropertyValue("--wheel-title-scale"), "4");
    assert.equal(stage.style.getPropertyValue("--wheel-winner-scale"), "3.5");
    assert.equal(stage.style.getPropertyValue("--wheel-title-color"), "#123456");
    assert.equal(stage.style.getPropertyValue("--wheel-winner-color"), "#abcdef");
    assert.equal(document.getElementById("wheel-machine").style.getPropertyValue("--wheel-glow"), "0");
    assert.equal(document.getElementById("wheel-machine").style.getPropertyValue("--wheel-shadow-strength"), "0");
    assert.equal(document.getElementById("wheel-machine").style.getPropertyValue("--wheel-line-spacing"), "0.84");
    assert.equal(document.getElementById("wheel-machine").style.getPropertyValue("--wheel-letter-spacing"), `${-50 / 900}em`);
    assert.ok(parseFloat(document.querySelector(".segment-label > span").style.fontSize) > before);
    for (const label of document.querySelectorAll(".segment-label")) assert.equal(label.style.textAlign, "center");
    sendCardMessage(window, "configuration", { overlayKey: "wheel", config: { wheelTitle: "", wheelShowTitle: false } });
    assert.equal(title.hidden, true);
    assert.equal(title.textContent, "");
  }
});

test("le résultat de la roue s’arrête sur son pointeur dans les deux designs", async (t) => {
  for (const design of ["classic", "royal"]) {
    for (const [pointer, angle] of Object.entries({ top: 0, right: 90, bottom: 180, left: 270 })) {
      const dom = await loadOverlay("wheel", { design });
      t.after(() => dom.window.close());
      const { window } = dom;
      const pending = [];
      window.setTimeout = (callback, delay) => { pending.push({ callback, delay }); return 0; };
      sendCardMessage(window, "wheel", {
        design, wheelName: "Roue liée au jeu", choices: ["A", "B", "C", "D"], winner: "C", winnerIndex: 2,
        settings: { pointerPosition: pointer, spinDuration: 1, waitDuration: 0, soundActive: false, wheelShowTitle: true }
      });
      const rotation = parseFloat(window.document.getElementById("wheel").style.getPropertyValue("--wheel-spin-rotation"));
      assert.equal((225 + rotation) % 360, angle, `${design} · ${pointer}`);
      assert.equal(window.document.getElementById("wheel-caption").textContent, "Roue liée au jeu");
      pending.filter((timer) => timer.delay === 1000).forEach((timer) => timer.callback());
      const result = window.document.getElementById("wheel-winner");
      assert.equal(result.textContent, "C");
      assert.equal(result.classList.contains("visible"), true);
      assert.equal(result.firstElementChild.tagName, "SPAN");
    }
  }
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
  assert.equal(document.getElementById("wheel").style.getPropertyValue("--wheel-spin-rotation"), "2880deg");

  dom.window.close();
});
