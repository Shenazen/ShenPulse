"use strict";

let overlayDesignRevision = 0;

function decodeOverlayImage(source) {
  if (!source) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", async () => {
      try {
        if (typeof image.decode === "function") await image.decode();
      } catch {
        // Le navigateur peut déjà avoir décodé la ressource.
      }
      resolve(image);
    }, { once: true });
    image.addEventListener("error", reject, { once: true });
    image.src = source;
  });
}

async function setThemeFrame(elementId, kind, classicPath = "", revision = 0) {
  const element = document.getElementById(elementId);
  if (!element) return "";
  const path = themeName === "classic"
    ? classicPath
    : `widgets/interactive-overlays/${kind}-theme-${themeName}.webp`;
  if (!path) {
    element.hidden = true;
    element.removeAttribute("src");
    return "";
  }
  const source = mediaUrl(path);
  element.dataset.pendingSource = source;
  try {
    await decodeOverlayImage(source);
  } catch {
    return element.currentSrc || element.src || "";
  }
  if (
    revision !== overlayDesignRevision ||
    element.dataset.pendingSource !== source
  ) {
    return element.currentSrc || element.src || "";
  }
  element.src = source;
  element.hidden = false;
  return source;
}

async function setupOverlayDesign() {
  const revision = ++overlayDesignRevision;
  setupConfiguration();

  // Le contenu et les interactions sont prêts sans attendre les images.
  if (viewName === "wheel") {
    document.getElementById("wheel-stage")?.classList.toggle("royal", wheelDesign === "royal");
    if (typeof setupWheel === "function") setupWheel();
  }
  if (viewName === "leaderboard" && typeof setupLeaderboard === "function") setupLeaderboard();
  if (viewName === "match" && typeof setupMatch === "function") setupMatch();
  if (viewName === "coin-jar" && typeof renderCoinJar === "function") renderCoinJar();
  if (viewName === "win-counter" && typeof renderWinCounter === "function") renderWinCounter();

  if (viewName === "like-goal") {
    const source = await setThemeFrame(
      "like-goal-frame",
      "like-goal",
      "widgets/goals/banniere_mystique_transparente_1300x200.png",
      revision
    );
    if (revision !== overlayDesignRevision) return;
    document.querySelectorAll(".like-goal-frame-slice").forEach((slice) => {
      slice.src = source;
      slice.hidden = !source;
    });
  }
  if (viewName === "leaderboard") await setThemeFrame("leaderboard-frame", "leaderboard", "", revision);
  if (viewName === "timer") await setThemeFrame("timer-frame", "timer", "", revision);
  if (viewName === "multiplier-timer") await setThemeFrame("multiplier-timer-frame", "timer", "", revision);
  if (viewName === "win-counter") await setThemeFrame("win-counter-frame", "win-counter", "", revision);

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
      const backSource = mediaUrl(`widgets/coin-jar/${backName}`);
      const frontSource = mediaUrl(`widgets/coin-jar/${frontName}`);
      try {
        await Promise.all([
          decodeOverlayImage(backSource),
          decodeOverlayImage(frontSource)
        ]);
        if (revision !== overlayDesignRevision) return;
        jarBack.src = backSource;
        jarFront.src = frontSource;
      } catch {
        // Conserve le design précédent plutôt qu'un rendu partiel.
      }
    }
  }
}
