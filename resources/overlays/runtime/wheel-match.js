"use strict";

/* FICHIER GÉNÉRÉ — compatibilité anciens loaders ; sources : widgets/ et session.js. */

"use strict";

/** Ancien point d'entrée wheel-match : réutilise les moteurs canoniques.
 * Téléchargements parallèles, exécution ordonnée par async=false. Le transport
 * attend le résultat avant tout abonnement ; un échec reste explicite, borné,
 * sans lecture de secours ni reprise artificielle d'un ancien événement.
 */
(function loadLegacyMatchReactions() {
  if (typeof document === "undefined" || typeof viewName !== "string" ||
    viewName !== "match") return;
  if (globalThis.shenPulseMatchCompatibilityReady) return;
  const current = new URL(document.currentScript?.src || "runtime/wheel-match.js", document.baseURI);
  const modules = [
    ["match-compatible", typeof startMatchCompatiblePlayback === "function" && typeof finishMatchCompatiblePlayback === "function"],
    ["match-progress", typeof globalThis.MatchVideoProgress?.watch === "function"],
    ["match-audio", typeof playMatchVideo === "function" && typeof stopMatchVideoAudio === "function"],
    ["match-reactions", typeof playMatchMedia === "function" && typeof playMatchAudio === "function"],
    ["match-preview", typeof startProtectedMatchPreview === "function"],
    ["match", typeof setupMatch === "function" && typeof enqueueMatchPlayback === "function"]
  ].filter(([, available]) => !available).map(([name]) => name);
  if (!modules.length) return;
  globalThis.shenPulseMatchCompatibilityReady = Promise.all(modules.map((name) => {
    const script = document.createElement("script");
    const target = new URL(`widgets/${name}.js`, current);
    target.search = current.search;
    script.src = target.toString();
    script.async = false;
    const completion = new Promise((resolve) => {
      const deadline = setTimeout(() => resolve(false), 4000);
      script.addEventListener("load", () => { clearTimeout(deadline); resolve(true); }, { once: true });
      script.addEventListener("error", () => { clearTimeout(deadline); resolve(false); }, { once: true });
    });
    document.head.appendChild(script);
    return completion;
  })).then((results) => {
    const ready = results.every(Boolean);
    if (!ready) document.documentElement.dataset.overlayLoadError = "match-runtime-unavailable";
    return ready;
  });
})();


function applyCoinJarAppearance(payload = null) {
  const style = document.documentElement.style;
  const previous = Number(style.getPropertyValue("--coin-jar-title-scale")) * 100 || Number(parameters.get("coinJarTitleScale")) || 100;
  const scale = payload ? previewNumber(payload, "coinJarTitleScale", previous, 50, 400) : previous;
  style.setProperty("--coin-jar-title-scale", String(Math.min(400, Math.max(50, scale)) / 100));
  const color = payload?.coinJarTitleColor || style.getPropertyValue("--coin-jar-title-color") || parameters.get("coinJarTitleColor") || parameters.get("textColor") || "#ffffff";
  style.setProperty("--coin-jar-title-color", color);
}

function fitCoinJarText() {
  if (viewName !== "coin-jar") return;
  const zone = document.getElementById("coin-jar-title");
  const text = zone?.firstElementChild;
  if (!text || !zone.clientWidth || !zone.clientHeight) return;
  zone.style.setProperty("--coin-jar-text-fit", "1");
  const fit = Math.min(1,
    Math.max(1, zone.clientWidth - 8) / Math.max(1, text.offsetWidth),
    Math.max(1, zone.clientHeight - 2) / Math.max(1, text.offsetHeight));
  zone.style.setProperty("--coin-jar-text-fit", String(fit));
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
  const title = document.getElementById("wheel-caption");
  if (title) {
    title.hidden = !wheelBoolean(wheelRuntimeSettings.wheelShowTitle, true);
    if (wheelRuntimeSettings.wheelTitle !== undefined) title.textContent = String(wheelRuntimeSettings.wheelTitle);
  }
  stage.style.setProperty("--wheel-title-color", wheelRuntimeSettings.wheelTitleColor || "#fff1c2");
  stage.style.setProperty("--wheel-winner-color", wheelRuntimeSettings.wheelWinnerColor || "#fff7d3");
  for (const [key, property] of [["wheelTitleScale", "--wheel-title-scale"], ["wheelWinnerScale", "--wheel-winner-scale"]]) {
    stage.style.setProperty(property, Math.min(400, Math.max(50, Number(wheelRuntimeSettings[key]) || 100)) / 100);
  }
  stage.style.setProperty("--wheel-caption-font", JSON.stringify(String(wheelRuntimeSettings.font || "Kalam")));
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
    `${(0.48 + 0.5) * Math.min(400, Math.max(50, Number(wheelRuntimeSettings.wheelTextScale) || 100)) / 100}rem`
  );
  machine.style.setProperty("--wheel-text-color", wheelRuntimeSettings.textColor || "#fff8ec");
  machine.style.setProperty("--wheel-shadow-color", wheelRuntimeSettings.textShadowColor || "#2b170c");
  machine.style.setProperty(
    "--wheel-shadow-strength",
    Math.min(100, Math.max(0, Number(wheelRuntimeSettings.textShadowStrength ?? 55))) / 100 * 7
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
    0.84 + Math.min(100, Math.max(0, Number(wheelRuntimeSettings.lineSpacing ?? 50))) / 140
  );
  machine.style.setProperty(
    "--wheel-letter-spacing",
    `${(Math.min(100, Math.max(0, Number(wheelRuntimeSettings.letterSpacing ?? 50))) - 50) / 900}em`
  );
  machine.style.setProperty(
    "--wheel-glow",
    Math.min(140, Math.max(0, Number(wheelRuntimeSettings.glow ?? 82))) / 100
  );
  machine.style.setProperty("--wheel-local-scale", "1");
  machine.style.setProperty(
    "--wheel-spin-duration",
    `${Math.min(30, Math.max(1, Number(wheelRuntimeSettings.spinDuration || 5)))}s`
  );
  requestAnimationFrame(syncWheelResponsiveTypography);
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
    label.style.textAlign = "center";
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
    Math.max(10, wheelRuntimeSettings.wheelTextScale === undefined ? Number(wheelRuntimeSettings.fontSize || 50) : 50)
  );
  const baseFontPixels = (0.48 + configuredSize / 100) * 16;
  const textScale = Math.min(400, Math.max(50, Number(wheelRuntimeSettings.wheelTextScale) || 100)) / 100;
  wheel.querySelectorAll(".segment-label").forEach((label) => {
    const scale = Number(label.dataset.fontScale || 1);
    let pixels = Math.min(96, Math.max(8, baseFontPixels * textScale * scale * responsiveScale));
    const copy = label.querySelector("span");
    if (!copy) return;
    copy.style.setProperty("font-size", `${pixels.toFixed(2)}px`);
    // Le calcul géométrique est affiné avec la police réellement chargée.
    while (pixels > 8 && label.clientWidth > 0 && label.clientHeight > 0 &&
      (copy.scrollWidth > label.clientWidth + 1 || copy.scrollHeight > label.clientHeight + 1)) {
      pixels = Math.max(8, pixels - 0.5);
      copy.style.setProperty("font-size", `${pixels.toFixed(2)}px`);
    }
  });
  fitWheelText(document.getElementById("wheel-caption"));
  fitWheelText(document.getElementById("wheel-winner"));
}

function fitWheelText(target) {
  if (!target) return;
  let copy = target.firstElementChild;
  if (!copy) {
    copy = document.createElement("span");
    copy.textContent = target.textContent;
    target.replaceChildren(copy);
  }
  copy.style.removeProperty("transform");
  const style = getComputedStyle(target);
  const width = target.clientWidth - parseFloat(style.paddingLeft || 0) - parseFloat(style.paddingRight || 0);
  const height = target.clientHeight - parseFloat(style.paddingTop || 0) - parseFloat(style.paddingBottom || 0);
  if (width <= 0 || height <= 0) return;
  const scale = Math.min(1, width / Math.max(1, copy.scrollWidth), height / Math.max(1, copy.scrollHeight));
  copy.style.transform = `scale(${scale})`;
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
  if (title) (title.firstElementChild || title).textContent = leaderboardKind === "tappers"
    ? "CLASSEMENT TAPOTEURS"
    : "CLASSEMENT DONATEURS";
  if (title && overlayTitle) (title.firstElementChild || title).textContent = overlayTitle;
  if (icon) icon.textContent = leaderboardKind === "tappers" ? "♥" : "♛";
  seedStaticLeaderboardPreview();
  renderLeaderboard();
}
