"use strict";

/**
 * Coin Jar, compteurs, timers et animation de roue.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

function renderCoinJar() {
  const current = document.getElementById("coin-jar-current");
  const target = document.getElementById("coin-jar-target");
  const level = document.getElementById("coin-jar-level");
  const widget = document.querySelector(".coin-jar-widget");
  const meter = document.querySelector(".coin-jar-meter");
  if (current) current.textContent = formatNumber(coinJarCurrent);
  if (target) target.textContent = formatNumber(coinJarTarget);
  if (level) {
    const range = Math.max(1, coinJarTarget - coinJarMinimum);
    const progress = Math.min(
      100,
      Math.max(0, ((coinJarCurrent - coinJarMinimum) / range) * 100)
    );
    level.style.height = `${progress}%`;
  }
  widget?.classList.toggle("without-base", !showBase);
  if (meter) meter.hidden = !showGoal;
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

function restartMatchVideo() {
  const video = document.getElementById("match-video");
  if (!video || viewName !== "match") return;
  try {
    matchLastRestartAt = performance.now();
    video.pause();
    video.currentTime = 0;
    if (matchAutoplay) video.play().catch(() => {});
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

function updateTimer(payload = {}) {
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
  const isMultiplierTimer = viewName === "multiplier-timer";
  const label = document.getElementById(
    isMultiplierTimer ? "multiplier-timer-label" : "timer-label"
  );
  if (label) {
    label.textContent =
      overlayTitle ||
      payload.label ||
      (isMultiplierTimer ? "BONUS ACTIF" : "TEMPS RESTANT");
  }
  renderTimer();
  ensureTimerTicker();
}

function ensureTimerTicker() {
  if (timerHandle) return;
  timerHandle = setInterval(() => {
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
  const element = document.getElementById(
    viewName === "multiplier-timer"
      ? "multiplier-timer-value"
      : "timer-value"
  );
  if (element) {
    element.textContent = value;
    element.classList.toggle("paused", timerPaused);
  }
  const multiplier = document.getElementById("multiplier-value");
  if (multiplier) multiplier.textContent = `X${multiplierValue}`;
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
